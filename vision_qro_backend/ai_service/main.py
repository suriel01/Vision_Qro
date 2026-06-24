from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException
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
from databases import Database

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
    allow_origins=["*"],
    allow_credentials=False,
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
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "visionqro2026")
API_KEY = os.getenv("API_KEY", "vsqro_prod_token_9x2b")

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="No autorizado")
    return api_key

class LoginRequest(BaseModel):
    password: str

@app.post("/api/v1/auth")
async def authenticate(data: LoginRequest):
    if data.password == ADMIN_PASSWORD:
        return {"token": API_KEY, "role": "admin"}
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
                confianza,
                telegram_username
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
                "telegram_username": f["telegram_username"] if "telegram_username" in f else None,
                # No enviamos foto_url al frontend; se usa el proxy /api/v1/foto/{id}
                "tiene_foto": bool(f["foto_url"]),
            })
    except Exception as e:
        print(f"⚠️  Consulta completa falló ({e}). Usando consulta básica.")
        query = """
            SELECT id, latitud, longitud, clase_corregida, subclase, telegram_username
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
                "telegram_username": f["telegram_username"] if "telegram_username" in f else None,
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
            # Determinar URL de descarga
            if '/' in raw:
                # Es un file_path directo
                download_url = f"https://api.telegram.org/file/bot{_tg_token}/{raw}"
            else:
                # Es un file_id — resolver con getFile
                get_file = await client.get(
                    f"https://api.telegram.org/bot{_tg_token}/getFile",
                    params={"file_id": raw}
                )
                data = get_file.json()
                if not data.get("ok"):
                    raise HTTPException(status_code=404, detail="file_id no encontrado en Telegram")
                file_path = data["result"]["file_path"]
                download_url = f"https://api.telegram.org/file/bot{_tg_token}/{file_path}"
                # Actualizar foto_url en DB con el path resuelto para la próxima vez
                await database.execute(
                    "UPDATE reportes SET foto_url = :fp WHERE id = :id",
                    values={"fp": file_path, "id": reporte_id}
                )

            resp = await client.get(download_url)
            if resp.status_code != 200:
                raise HTTPException(status_code=404, detail="Foto no encontrada")
            return Response(
                content=resp.content,
                media_type=resp.headers.get("content-type", "image/jpeg"),
                headers={"Cache-Control": "public, max-age=86400"},
            )
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error al contactar Telegram: {e}")


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        content = await file.read()
        img = Image.open(io.BytesIO(content))
        results = model(img)
        detections = []
        for result in results:
            for box in result.boxes:
                detections.append({
                    "clase":     model.names[int(box.cls[0])],
                    "confianza": round(float(box.conf[0]) * 100, 2)
                })
        if detections:
            best = max(detections, key=lambda x: x["confianza"])
            categoria = _CLASE_A_CAT.get(best["clase"].lower())
            cat_label = _CAT_LABEL.get(categoria, "🔍 Requiere clasificación manual")
            return {
                "status":     "success",
                "clase":      best["clase"],
                "confianza":  best["confianza"],
                "categoria":  categoria or "pendiente",
                "mensaje_usuario": (
                    f"🤖 Detecté: *{best['clase']}* ({best['confianza']}%)\n"
                    f"📂 Categoría: {cat_label}"
                ),
            }
        return {
            "status": "no_detections",
            "clase": "desconocido",
            "confianza": 0,
            "categoria": "pendiente",
            "mensaje_usuario": "🔍 No detecté ningún objeto reconocible. Por favor selecciona la categoría manualmente.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/v1/reportes/{reporte_id}")
async def eliminar_reporte(reporte_id: int, token: str = Depends(verify_api_key)):
    try:
        query = "DELETE FROM reportes WHERE id = :id"
        await database.execute(query=query, values={"id": reporte_id})
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