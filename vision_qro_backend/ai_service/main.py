from contextlib import asynccontextmanager
from fastapi import FastAPI, File, Form, Request, UploadFile, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.security import APIKeyHeader
from fastapi import Depends
from pydantic import BaseModel
from ultralytics import YOLO
import httpx
import io
import csv
from PIL import Image
import os
import zipfile
import shutil
import datetime
import json
import secrets
import time
from databases import Database
from candidatos import elegir_candidatos
from limite_intentos import LimiteIntentos

# --- 1. LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.connect()
    yield
    await database.disconnect()

app = FastAPI(title="Vision Qro AI", version="1.2.0", lifespan=lifespan)

# --- 2. CORS ---
_cors_env = os.getenv("CORS_ORIGINS", "")
origins = [o.strip() for o in _cors_env.split(",") if o.strip()] or [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 3. BASE DE DATOS ---
DB_USER     = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "password")
DB_HOST     = os.getenv("POSTGRES_HOST", "postgres")
DB_NAME     = os.getenv("POSTGRES_DB", "vision_qro")

DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:5432/{DB_NAME}"
database = Database(DATABASE_URL)

# --- 3.5 SEGURIDAD ---
# Sin valores por defecto: si faltan en el entorno, los endpoints protegidos
# fallan cerrado (503) en lugar de usar un secreto conocido.
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
API_KEY = os.getenv("API_KEY", "")

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def _require_configured():
    if not ADMIN_PASSWORD or not API_KEY:
        raise HTTPException(status_code=503, detail="ADMIN_PASSWORD/API_KEY no configuradas")

def verify_api_key(api_key: str = Depends(api_key_header)):
    _require_configured()
    # Se comparan bytes: compare_digest con texto no ASCII lanzaría un error 500.
    if not api_key or not secrets.compare_digest(api_key.encode(), API_KEY.encode()):
        raise HTTPException(status_code=403, detail="No autorizado")
    return api_key

class LoginRequest(BaseModel):
    password: str

# Freno a las adivinanzas de contraseña: 5 fallos por cliente o 30 en total dentro de 5 minutos.
_limite_login = LimiteIntentos(max_por_cliente=5, max_global=30, ventana_s=300)


def _cliente(request: Request) -> str:
    # Cloudflare pone la IP real en Cf-Connecting-Ip y la sobrescribe, así que no la puede falsear quien llega por internet.
    return request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "desconocido")


@app.post("/api/v1/auth")
async def authenticate(data: LoginRequest, request: Request):
    _require_configured()
    cliente = _cliente(request)
    espera = _limite_login.segundos_de_espera(cliente, time.time())
    if espera:
        raise HTTPException(status_code=429, detail=f"Demasiados intentos. Espera {max(1, espera // 60 + 1)} minuto(s).",
                            headers={"Retry-After": str(espera)})
    if secrets.compare_digest(data.password.encode(), ADMIN_PASSWORD.encode()):
        _limite_login.registrar_exito(cliente)
        return {"token": API_KEY, "role": "admin"}
    _limite_login.registrar_fallo(cliente, time.time())
    raise HTTPException(status_code=401, detail="Contraseña incorrecta")


# --- 4. MODELO YOLO ---
_model_path = os.getenv("YOLO_MODEL_PATH", "models/yolo12n.pt")
model = YOLO(_model_path)

# --- 5. TELEGRAM ---
_tg_token = os.getenv("TELEGRAM_BOT_TOKEN", "")

def _build_foto_url(file_path: str | None) -> str | None:
    """
    Construye la URL de descarga de Telegram.
    Acepta tanto file_path (fotos/xxx.jpg) como file_id (AgACAgIA...).
    Si parece un file_path, construye la URL directamente.
    Si parece un file_id (empieza con Ag o es muy largo sin '/'), resuelve via getFile.
    """
    if not file_path or file_path in ("", "undefined", "null"):
        return None
    if not _tg_token:
        return None
    # Si ya contiene '/' es un file_path (ej: photos/file_xxx.jpg)
    if '/' in file_path:
        return f"https://api.telegram.org/file/bot{_tg_token}/{file_path}"
    # Si no tiene '/' es un file_id — se resuelve en el proxy endpoint
    return None  # El proxy usará getFile para resolverlo

# --- 6. MAPEO YOLO → CATEGORÍA VISION QRO ---
# Clases del dataset COCO que se mapean automáticamente a categorías del sistema
_CLASE_A_CAT: dict[str, str] = {
    # Inorgánico ♻️
    'bottle': 'inorg',       'cup': 'inorg',        'wine glass': 'inorg',
    'cell phone': 'inorg',   'laptop': 'inorg',     'keyboard': 'inorg',
    'mouse': 'inorg',
    'remote': 'inorg',       'book': 'inorg',        'scissors': 'inorg',
    'toothbrush': 'inorg',   'vase': 'inorg',        'fork': 'inorg',
    'knife': 'inorg',        'spoon': 'inorg',       'bowl': 'inorg',
    'backpack': 'inorg',     'handbag': 'inorg',     'suitcase': 'inorg',
    'umbrella': 'inorg',     'tie': 'inorg',         'frisbee': 'inorg',
    'skateboard': 'inorg',   'surfboard': 'inorg',   'tennis racket': 'inorg',
    'baseball bat': 'inorg', 'baseball glove': 'inorg', 'sports ball': 'inorg',
    # Orgánico 🍎
    'banana': 'org',   'apple': 'org',    'sandwich': 'org',
    'orange': 'org',   'broccoli': 'org', 'carrot': 'org',
    'hot dog': 'org',  'pizza': 'org',    'donut': 'org',    'cake': 'org',
}
_CAT_LABEL = {
    'inorg': 'Inorgánico ♻️',
    'org':   'Orgánico 🍎',
    'bache': 'Bache 🕳️',
}


@app.get("/api/v1/reportes-mapa")
async def obtener_reportes_mapa():
    try:
        query = """
            SELECT
                id,
                latitud, longitud,
                clase_corregida, subclase,
                created_at,
                foto_url,
                confianza
            FROM reportes
            WHERE latitud IS NOT NULL AND longitud IS NOT NULL
            ORDER BY created_at ASC
        """
        filas = await database.fetch_all(query=query)
        resultado = []
        for f in filas:
            tipo_final = f["subclase"] if f["subclase"] else f["clase_corregida"]
            resultado.append({
                "id":         int(f["id"]),
                "lat":        float(f["latitud"]),
                "lng":        float(f["longitud"]),
                "tipo":       tipo_final or "pendiente",
                "objeto_detectado": f["clase_corregida"] or "Desconocido",
                "created_at": f["created_at"].isoformat() if f["created_at"] else None,
                "confianza":  float(f["confianza"]) if f["confianza"] else None,
                # telegram_username no se expone: es un dato personal y este endpoint es público.
                # No enviamos foto_url al frontend; se usa el proxy /api/v1/foto/{id}
                "tiene_foto": bool(f["foto_url"]),
            })
    except Exception as e:
        print(f"⚠️  Consulta completa falló ({e}). Usando consulta básica.")
        query = """
            SELECT id, latitud, longitud, clase_corregida, subclase
            FROM reportes
            WHERE latitud IS NOT NULL AND longitud IS NOT NULL
        """
        filas = await database.fetch_all(query=query)
        resultado = []
        for f in filas:
            tipo_final = f["subclase"] if f["subclase"] else f["clase_corregida"]
            resultado.append({
                "id":         int(f["id"]),
                "lat":        float(f["latitud"]),
                "lng":        float(f["longitud"]),
                "tipo":       tipo_final or "pendiente",
                "objeto_detectado": f["clase_corregida"] or "Desconocido",
                "created_at": None,
                "confianza":  None,
                "tiene_foto": False,
            })

    print(f"✅ Enviando {len(resultado)} puntos al mapa.")
    return resultado


@app.get("/api/v1/foto/{reporte_id}")
async def proxy_foto(reporte_id: int):
    """
    Proxy seguro de imágenes de Telegram.
    Soporta file_path y file_id. El token del bot nunca llega al browser.
    """
    query = "SELECT foto_url, foto_id FROM reportes WHERE id = :id"
    row = await database.fetch_one(query=query, values={"id": reporte_id})

    # Preferir foto_url (file_path resuelto), si no usar foto_id como fallback
    raw = row["foto_url"] if row else None
    if not raw or raw in ("", "undefined", "null"):
        raw = row["foto_id"] if row else None
    if not raw:
        raise HTTPException(status_code=404, detail="Sin foto")
    if not _tg_token:
        raise HTTPException(status_code=503, detail="Token de Telegram no configurado")

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            async def resolve_and_download(file_id):
                get_file = await client.get(
                    f"https://api.telegram.org/bot{_tg_token}/getFile",
                    params={"file_id": file_id}
                )
                data = get_file.json()
                if not data.get("ok"):
                    raise HTTPException(status_code=404, detail="file_id no encontrado en Telegram")
                file_path = data["result"]["file_path"]
                dl_url = f"https://api.telegram.org/file/bot{_tg_token}/{file_path}"
                # Actualizar foto_url en DB con el path resuelto para la próxima vez
                await database.execute(
                    "UPDATE reportes SET foto_url = :fp WHERE id = :id",
                    values={"fp": file_path, "id": reporte_id}
                )
                r = await client.get(dl_url)
                if r.status_code != 200:
                    raise HTTPException(status_code=404, detail="Foto no encontrada tras resolver")
                return r

            # Determinar URL de descarga
            if raw and raw.startswith("local/"):
                local_path = os.path.join("/app/uploads", raw.replace("local/", ""))
                if os.path.exists(local_path):
                    with open(local_path, "rb") as f_local:
                        return Response(content=f_local.read(), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
                else:
                    raise HTTPException(status_code=404, detail="Foto local no encontrada")
            elif '/' in raw:
                # Es un file_path directo
                download_url = f"https://api.telegram.org/file/bot{_tg_token}/{raw}"
                resp = await client.get(download_url)
                if resp.status_code != 200:
                    # El file_path expiró (Telegram los expira en 1 hora)
                    if row["foto_id"]:
                        resp = await resolve_and_download(row["foto_id"])
                    else:
                        raise HTTPException(status_code=404, detail="Foto expirada y sin foto_id de respaldo")
            else:
                # Es un file_id — resolver con getFile
                resp = await resolve_and_download(raw)

            return Response(
                content=resp.content,
                media_type=resp.headers.get("content-type", "image/jpeg"),
                headers={"Cache-Control": "public, max-age=86400"},
            )
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error al contactar Telegram: {e}")


# --- 6.5 MUESTRAS PARA MEJORAR EL MODELO ---
# Cada foto analizada se guarda con lo que predijo el modelo. La etiqueta correcta sale después de
# la validación/corrección humana (ver la vista v_muestras_entrenamiento). Se borran junto con el reporte.
_MUESTRAS_DIR = "/app/uploads/entrenamiento"
_MODELO_NOMBRE = os.path.basename(_model_path)


def _solo_red_interna(request: Request):
    """/predict solo lo usa n8n por la red de Docker. Lo que llega por Cloudflare trae
    Cf-Connecting-Ip: se rechaza para que nadie desde internet gaste GPU ni disco."""
    if request.headers.get("cf-connecting-ip"):
        raise HTTPException(status_code=403, detail="No disponible desde internet")


async def _guardar_muestra(content: bytes, ext: str, reporte_id: int | None,
                           clase: str, confianza: float, categoria: str, candidatos: list | None = None):
    """Guarda la foto y la predicción. Nunca debe romper la respuesta al usuario."""
    if reporte_id is None:
        return
    ruta = None
    try:
        os.makedirs(_MUESTRAS_DIR, exist_ok=True)
        ruta = os.path.join(_MUESTRAS_DIR, f"{int(reporte_id)}_{int(time.time())}.{ext}")
        def _escribir():
            with open(ruta, "wb") as fh:
                fh.write(content)
        await run_in_threadpool(_escribir)
        await database.execute(
            "INSERT INTO predicciones (reporte_id, modelo, clase, confianza, categoria, foto_path, candidatos) "
            "VALUES (:r, :m, :c, :f, :cat, :p, CAST(:cand AS JSONB))",
            values={"r": int(reporte_id), "m": _MODELO_NOMBRE, "c": clase,
                    "f": confianza, "cat": categoria, "p": ruta,
                    "cand": json.dumps(candidatos or [])},
        )
    except Exception as e:
        print(f"⚠️  No se pudo guardar la muestra del reporte {reporte_id}: {e}")
        if ruta and os.path.exists(ruta):
            os.remove(ruta)  # sin fila en la base, un archivo huérfano solo ocupa disco


def _borrar_muestras_de(rutas):
    for ruta in rutas:
        try:
            if ruta and ruta.startswith(_MUESTRAS_DIR + "/"):
                os.remove(ruta)
        except FileNotFoundError:
            pass
        except Exception as e:
            print(f"⚠️  No se pudo borrar {ruta}: {e}")


@app.post("/predict")
async def predict(request: Request, file: UploadFile = File(...), reporte_id: int | None = Form(default=None)):
    _solo_red_interna(request)
    try:
        content = await file.read()
        img = Image.open(io.BytesIO(content))
        ext = {"jpeg": "jpg", "png": "png", "webp": "webp"}.get((img.format or "jpeg").lower(), "jpg")
        # La inferencia es síncrona y pesada: en un hilo aparte para no bloquear
        # el event loop (mapa, fotos y login siguen respondiendo mientras YOLO trabaja).
        results = await run_in_threadpool(model, img)
        detections = []
        ancho, alto = img.size
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
                area_frac = (max(x2 - x1, 0.0) * max(y2 - y1, 0.0)) / float(ancho * alto) if ancho and alto else 0.0
                detections.append({
                    "clase":     model.names[int(box.cls[0])],
                    "confianza": round(float(box.conf[0]) * 100, 2),
                    "area_frac": area_frac,
                })
        # Qué objeto se reporta: el que mejor combina confianza y tamaño en la foto; si hay duda real
        # (ambiguo) el bot le pregunta a la persona. Sin candidatos con categoría, se usa el de mayor confianza.
        candidatos, ambiguo = elegir_candidatos(detections, _CLASE_A_CAT)
        if detections:
            best = candidatos[0] if candidatos else max(detections, key=lambda x: x["confianza"])
            categoria = _CLASE_A_CAT.get(best["clase"].lower())
            cat_label = _CAT_LABEL.get(categoria, "🔍 Requiere clasificación manual")
            await _guardar_muestra(content, ext, reporte_id, best["clase"], best["confianza"], categoria or "pendiente", candidatos)
            return {
                "status":     "success",
                "clase":      best["clase"],
                "confianza":  best["confianza"],
                "categoria":  categoria or "pendiente",
                "candidatos": [{k: c[k] for k in ("clase", "confianza", "categoria", "area_pct")} for c in candidatos],
                "ambiguo":    ambiguo,
                "mensaje_usuario": (
                    f"🤖 Detecté: *{best['clase']}* ({best['confianza']}%)\n"
                    f"📂 Categoría: {cat_label}"
                ),
            }
        await _guardar_muestra(content, ext, reporte_id, "desconocido", 0, "pendiente")
        return {
            "status": "no_detections",
            "clase": "desconocido",
            "confianza": 0,
            "categoria": "pendiente",
            "candidatos": [],
            "ambiguo": False,
            "mensaje_usuario": "🔍 No detecté ningún objeto reconocible. Por favor selecciona la categoría manualmente.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/v1/reportes/{reporte_id}")
async def eliminar_reporte(reporte_id: int, token: str = Depends(verify_api_key)):
    try:
        filas = await database.fetch_all(
            "SELECT foto_path FROM predicciones WHERE reporte_id = :id", values={"id": reporte_id})
        query = "DELETE FROM reportes WHERE id = :id"
        await database.execute(query=query, values={"id": reporte_id})
        _borrar_muestras_de([f["foto_path"] for f in filas])
        return {"status": "success", "message": f"Reporte {reporte_id} eliminado."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/reportes/exportar")
async def exportar_reportes(token: str = Depends(verify_api_key)):
    query = """
        SELECT id, latitud, longitud, clase_corregida, subclase, confianza, descripcion,
               telegram_username, estado, created_at
        FROM reportes
        ORDER BY created_at DESC
    """
    filas = await database.fetch_all(query=query)
    
    output = io.StringIO()
    writer = csv.writer(output)
    if filas:
        writer.writerow(filas[0].keys())
        for f in filas:
            writer.writerow(f.values())
            
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": "attachment; filename=reportes_vision_qro.csv"}
    )
@app.delete("/api/v1/reportes-todos")
async def eliminar_todos_reportes(token: str = Depends(verify_api_key)):
    try:
        await database.execute("TRUNCATE TABLE reportes RESTART IDENTITY CASCADE")
        shutil.rmtree(_MUESTRAS_DIR, ignore_errors=True)
        if os.path.exists("/app/uploads/fotos"):
            shutil.rmtree("/app/uploads/fotos")
        os.makedirs("/app/uploads/fotos", exist_ok=True)
        return {"status": "success", "message": "Todos los reportes eliminados."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/reportes/exportar-zip")
async def exportar_reportes_zip(token: str = Depends(verify_api_key)):
    query = "SELECT * FROM reportes ORDER BY created_at DESC"
    filas = await database.fetch_all(query=query)
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        if filas:
            writer.writerow(filas[0].keys())
            for f in filas:
                writer.writerow(f.values())
        zip_file.writestr("reportes.csv", csv_buffer.getvalue())

        async with httpx.AsyncClient(timeout=15.0) as client:
            for f in filas:
                foto_id = f["foto_id"]
                raw = f["foto_url"] or foto_id
                if not raw: continue
                
                if raw.startswith("local/"):
                    local_path = os.path.join("/app/uploads", raw.replace("local/", ""))
                    if os.path.exists(local_path):
                        zip_file.write(local_path, f"fotos/reporte_{f['id']}.jpg")
                else:
                    try:
                        file_path = raw
                        if '/' not in file_path:
                            get_file = await client.get(f"https://api.telegram.org/bot{_tg_token}/getFile", params={"file_id": file_path})
                            data = get_file.json()
                            if data.get("ok"): file_path = data["result"]["file_path"]
                        if '/' in file_path:
                            dl_url = f"https://api.telegram.org/file/bot{_tg_token}/{file_path}"
                            r = await client.get(dl_url)
                            if r.status_code == 200:
                                zip_file.writestr(f"fotos/reporte_{f['id']}.jpg", r.content)
                            elif f["foto_id"]:
                                get_file = await client.get(f"https://api.telegram.org/bot{_tg_token}/getFile", params={"file_id": f["foto_id"]})
                                data = get_file.json()
                                if data.get("ok"):
                                    file_path = data["result"]["file_path"]
                                    dl_url = f"https://api.telegram.org/file/bot{_tg_token}/{file_path}"
                                    r = await client.get(dl_url)
                                    if r.status_code == 200:
                                        zip_file.writestr(f"fotos/reporte_{f['id']}.jpg", r.content)
                    except: pass
    zip_buffer.seek(0)
    return StreamingResponse(iter([zip_buffer.getvalue()]), media_type="application/zip", headers={"Content-Disposition": "attachment; filename=respaldo.zip"})

@app.post("/api/v1/reportes/importar-zip")
async def importar_reportes_zip(file: UploadFile = File(...), token: str = Depends(verify_api_key)):
    try:
        content = await file.read()
        zip_buffer = io.BytesIO(content)
        with zipfile.ZipFile(zip_buffer, "r") as zip_file:
            os.makedirs("/app/uploads/fotos", exist_ok=True)
            for name in zip_file.namelist():
                if name.startswith("fotos/") and not name.endswith("/"):
                    extracted_path = os.path.join("/app/uploads", name)
                    os.makedirs(os.path.dirname(extracted_path), exist_ok=True)
                    with open(extracted_path, "wb") as f_out:
                        f_out.write(zip_file.read(name))
            
            if "reportes.csv" in zip_file.namelist():
                csv_content = zip_file.read("reportes.csv").decode("utf-8")
                reader = csv.DictReader(io.StringIO(csv_content))
                for row in reader:
                    foto_url = row.get("foto_url")
                    foto_path = f"fotos/reporte_{row['id']}.jpg"
                    if foto_path in zip_file.namelist():
                        foto_url = f"local/{foto_path}"
                    
                    query = "INSERT INTO reportes (id, latitud, longitud, clase_corregida, subclase, confianza, descripcion, foto_url, telegram_user_id, telegram_username, chat_id, foto_id, estado, created_at) VALUES (:id, :latitud, :longitud, :clase_corregida, :subclase, :confianza, :descripcion, :foto_url, :telegram_user_id, :telegram_username, :chat_id, :foto_id, :estado, :created_at) ON CONFLICT (id) DO NOTHING"
                    values = {
                        "id": int(row["id"]) if row.get("id") else None,
                        "latitud": float(row["latitud"]) if row.get("latitud") else None,
                        "longitud": float(row["longitud"]) if row.get("longitud") else None,
                        "clase_corregida": row.get("clase_corregida"),
                        "subclase": row.get("subclase"),
                        "confianza": float(row["confianza"]) if row.get("confianza") else None,
                        "descripcion": row.get("descripcion"),
                        "foto_url": foto_url,
                        "telegram_user_id": int(row["telegram_user_id"]) if row.get("telegram_user_id") else None,
                        "telegram_username": row.get("telegram_username"),
                        "chat_id": int(row["chat_id"]) if row.get("chat_id") else None,
                        "foto_id": row.get("foto_id"),
                        "estado": row.get("estado"),
                        "created_at": row.get("created_at") if row.get("created_at") else None
                    }
                    try:
                        await database.execute(query=query, values=values)
                    except Exception as e:
                        print(f"Error: {e}")
                
                try:
                    await database.execute("SELECT setval('reportes_id_seq', (SELECT MAX(id) FROM reportes));")
                except: pass
        return {"status": "success", "message": "Importación completada."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
