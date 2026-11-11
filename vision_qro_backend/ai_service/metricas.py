"""Métricas públicas de Vision Qro: lógica pura (sin BD) + consultas SQL + orquestación.

No importa `databases` ni nada pesado: `consultar_metricas` recibe el objeto `database`.
Privacidad: solo salen agregados. Las zonas calientes usan el CENTRO de una celda de ~275 m y
solo si hay al menos K_MINIMO reportes en ella; nunca coordenadas, usuarios ni fotos de un reporte.
"""
import datetime
import time

try:
    from zoneinfo import ZoneInfo
    ZONA = ZoneInfo("America/Mexico_City")
except Exception:  # sin tzdata en el sistema: México ya no usa horario de verano
    ZONA = datetime.timezone(datetime.timedelta(hours=-6))

DIAS_MIN, DIAS_MAX, DIAS_DEFECTO = 1, 730, 30
CELDA_GRADOS = 0.0025      # ~275 m
K_MINIMO = 3               # k-anonimato de las zonas calientes
TOP_ZONAS = 10
RADIO_REPETIDOS_M = 30
TTL_SEGUNDOS = 60

CATEGORIAS = (
    ("bache", "Baches"),
    ("basura_inorganica", "Basura inorgánica"),
    ("basura_organica", "Basura orgánica"),
    ("bolsas", "Bolsas de basura"),
    ("otros", "Otros o pendientes"),
)
TAMANOS = ("pequeno", "mediano", "grande", "sin_tamano")
ESTADOS_GESTION = ("nuevo", "en_proceso", "resuelto")

# ---------------------------------------------------------------- SQL
# Base común: solo reportes con ubicación; categoría/tamaño y hora local de Ciudad de México.
_BASE = """
WITH base AS (
    SELECT id, estado, COALESCE(estado_gestion, 'nuevo') AS estado_gestion, confianza, foto_url, created_at,
           latitud, longitud,
           (created_at AT TIME ZONE 'America/Mexico_City') AS local_ts,
           LOWER(TRIM(COALESCE(NULLIF(subclase, ''), clase_corregida, ''))) AS tipo
    FROM reportes
    WHERE latitud IS NOT NULL AND longitud IS NOT NULL
),
cat AS (
    SELECT base.*,
           CASE WHEN tipo IN ('inorg', 'inorganico') THEN 'basura_inorganica'
                WHEN tipo IN ('org', 'organico') THEN 'basura_organica'
                WHEN tipo = 'bolsa' THEN 'bolsas'
                WHEN tipo IN ('g', 'm', 'p', 'bache') THEN 'bache'
                ELSE 'otros' END AS categoria,
           CASE WHEN tipo = 'g' THEN 'grande'
                WHEN tipo = 'm' THEN 'mediano'
                WHEN tipo = 'p' THEN 'pequeno'
                WHEN tipo = 'bache' THEN 'sin_tamano'
                ELSE NULL END AS tamano
    FROM base
)
"""
# Filtro de periodo (fechas locales, `hasta` inclusive).
_EN_PERIODO = "local_ts >= CAST(:desde AS date) AND local_ts < CAST(:hasta AS date) + 1"

SQL_RESUMEN = _BASE + f"""
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE {_EN_PERIODO}) AS en_periodo,
       COUNT(*) FILTER (WHERE local_ts >= CAST(:desde_anterior AS date) AND local_ts < CAST(:desde AS date)) AS periodo_anterior,
       COUNT(*) FILTER (WHERE estado_gestion = 'nuevo') AS nuevo,
       COUNT(*) FILTER (WHERE estado_gestion = 'en_proceso') AS en_proceso,
       COUNT(*) FILTER (WHERE estado_gestion = 'resuelto') AS resuelto
FROM cat
"""

# Horas entre la creación y la PRIMERA vez que se marcó 'resuelto' (una fila por reporte resuelto).
SQL_HORAS_RESOLUCION = """
SELECT EXTRACT(EPOCH FROM (h.primera - r.created_at)) / 3600.0 AS horas
FROM reportes r
JOIN (SELECT reporte_id, MIN(cambiado_en) AS primera
      FROM reportes_historial WHERE estado = 'resuelto' GROUP BY reporte_id) h ON h.reporte_id = r.id
WHERE r.latitud IS NOT NULL AND r.longitud IS NOT NULL
"""

# Reportes abiertos (nuevo / en_proceso) agrupados por días de antigüedad.
SQL_ABIERTOS_EDAD = _BASE + """
SELECT CAST(FLOOR(EXTRACT(EPOCH FROM (CAST(:ahora AS timestamptz) - created_at)) / 86400) AS integer) AS dias, COUNT(*) AS n
FROM cat
WHERE estado_gestion IN ('nuevo', 'en_proceso')
GROUP BY 1
"""

# Periodo: por categoría y tamaño, con cuántos traen foto.
SQL_CATEGORIAS = _BASE + f"""
SELECT categoria, tamano, COUNT(*) AS n,
       COUNT(*) FILTER (WHERE foto_url IS NOT NULL AND foto_url <> '') AS con_foto
FROM cat
WHERE {_EN_PERIODO}
GROUP BY categoria, tamano
"""

# Periodo: por día local y hora local (la serie diaria, el día de la semana y la hora salen de aquí).
SQL_DIA_HORA = _BASE + f"""
SELECT CAST(local_ts AS date) AS fecha, CAST(EXTRACT(HOUR FROM local_ts) AS integer) AS hora, COUNT(*) AS n
FROM cat
WHERE {_EN_PERIODO}
GROUP BY 1, 2
"""

# Periodo: celdas de rejilla (índices enteros); el centro se calcula en Python. HAVING aplica k-anonimato.
SQL_ZONAS = _BASE + f"""
SELECT CAST(FLOOR(latitud / {CELDA_GRADOS}) AS bigint) AS celda_lat,
       CAST(FLOOR(longitud / {CELDA_GRADOS}) AS bigint) AS celda_lng,
       COUNT(*) AS n
FROM cat
WHERE {_EN_PERIODO}
GROUP BY 1, 2
HAVING COUNT(*) >= {K_MINIMO}
ORDER BY n DESC, celda_lat ASC, celda_lng ASC
LIMIT {TOP_ZONAS}
"""

# Periodo: agrupa reportes a <= 30 m (DBSCAN plano en UTM 14N, metros); minpoints 1 => todo punto pertenece a un grupo.
SQL_REPETIDOS = _BASE + f"""
, puntos AS (
    SELECT ST_Transform(ST_SetSRID(ST_MakePoint(longitud, latitud), 4326), 32614) AS g
    FROM cat
    WHERE {_EN_PERIODO}
),
grupos AS (
    SELECT ST_ClusterDBSCAN(g, {RADIO_REPETIDOS_M}, 1) OVER () AS cid FROM puntos
)
SELECT COUNT(DISTINCT cid) AS puntos_unicos, COUNT(*) AS total FROM grupos
"""

# Solo administrador. Periodo.
SQL_MODELO = _BASE + f"""
SELECT COUNT(*) FILTER (WHERE estado IN ('validado', 'corregido_por_humano')) AS revisados,
       COUNT(*) FILTER (WHERE estado = 'validado') AS aceptados,
       COUNT(*) FILTER (WHERE estado = 'corregido_por_humano') AS corregidos,
       AVG(confianza) AS confianza_media
FROM cat
WHERE {_EN_PERIODO}
"""


# ---------------------------------------------------------------- lógica pura
def limitar_dias(dias):
    """Entero entre 1 y 730; valores raros caen al valor por defecto (nunca 422)."""
    try:
        d = int(dias)
    except (TypeError, ValueError):
        return DIAS_DEFECTO
    return max(DIAS_MIN, min(DIAS_MAX, d))


def fecha_local(ahora):
    """Fecha de hoy en Ciudad de México a partir de un instante (aware o naive UTC)."""
    if ahora.tzinfo is None:
        ahora = ahora.replace(tzinfo=datetime.timezone.utc)
    return ahora.astimezone(ZONA).date()


def periodos(hoy, dias):
    """(desde, hasta, desde_anterior). `hasta` = hoy inclusive; el periodo previo dura lo mismo y termina el día antes de `desde`."""
    desde = hoy - datetime.timedelta(days=dias - 1)
    desde_anterior = desde - datetime.timedelta(days=dias)
    return desde, hoy, desde_anterior


def redondear(x, n=1):
    return None if x is None else round(float(x), n)


def porcentaje(parte, total):
    """parte/total*100 con 1 decimal; None si el denominador es 0."""
    if not total:
        return None
    return round(parte / total * 100, 1)


def variacion_pct(actual, anterior):
    """(actual-anterior)/anterior*100 con 1 decimal; None si no hay periodo anterior con datos."""
    if not anterior:
        return None
    return round((actual - anterior) / anterior * 100, 1)


def mediana(valores):
    vs = sorted(float(v) for v in valores if v is not None)
    if not vs:
        return None
    m = len(vs) // 2
    return vs[m] if len(vs) % 2 else (vs[m - 1] + vs[m]) / 2


def mediana_horas(horas):
    """Mediana de horas hasta resolver, sin valores negativos (relojes desfasados), 1 decimal."""
    return redondear(mediana([max(0.0, float(h)) for h in horas if h is not None]))


def cubeta_antiguedad(dias):
    if dias is None or dias <= 7:
        return "0_7"
    return "8_30" if dias <= 30 else "31_mas"


def abiertos_por_antiguedad(filas):
    """filas: iterable de (dias, n). Devuelve siempre las tres cubetas."""
    out = {"0_7": 0, "8_30": 0, "31_mas": 0}
    for dias, n in filas:
        out[cubeta_antiguedad(max(0, int(dias)) if dias is not None else None)] += int(n)
    return out


def serie_diaria(desde, dias, conteos):
    """conteos: {date: n}. Exactamente `dias` elementos ascendentes, con ceros."""
    serie = []
    for i in range(dias):
        f = desde + datetime.timedelta(days=i)
        serie.append({"fecha": f.isoformat(), "n": int(conteos.get(f, 0))})
    return serie


def arreglos_semana_hora(filas):
    """filas: (fecha, hora, n). Devuelve (por_dia_semana[7] con 0=lunes, por_hora[24])."""
    semana, horas = [0] * 7, [0] * 24
    for fecha, hora, n in filas:
        semana[fecha.weekday()] += int(n)
        horas[int(hora)] += int(n)
    return semana, horas


def conteos_por_dia(filas):
    out = {}
    for fecha, _hora, n in filas:
        out[fecha] = out.get(fecha, 0) + int(n)
    return out


def categorias_y_tamanos(filas):
    """filas: (categoria, tamano, n, con_foto). Devuelve (por_categoria[5], baches_por_tamano, con_foto_total, otros_total)."""
    por_cat = {cid: 0 for cid, _ in CATEGORIAS}
    tam = {t: 0 for t in TAMANOS}
    con_foto = 0
    for cat, tamano, n, foto in filas:
        n = int(n)
        por_cat[cat if cat in por_cat else "otros"] += n
        con_foto += int(foto)
        if cat == "bache":
            tam[tamano if tamano in tam else "sin_tamano"] += n
    lista = [{"id": cid, "etiqueta": et, "n": por_cat[cid]} for cid, et in CATEGORIAS]
    return lista, tam, con_foto, por_cat["otros"]


def centro_celda(indice):
    return round((int(indice) + 0.5) * CELDA_GRADOS, 6)


def zonas_calientes(celdas, k=K_MINIMO, top=TOP_ZONAS):
    """celdas: (celda_lat, celda_lng, n). Filtra n >= k, ordena por n desc y desempata por celda; devuelve centros."""
    validas = [(int(a), int(b), int(n)) for a, b, n in celdas if int(n) >= k]
    validas.sort(key=lambda c: (-c[2], c[0], c[1]))
    return [{"lat": centro_celda(a), "lng": centro_celda(b), "n": n} for a, b, n in validas[:top]]


def repetidos(puntos_unicos, total):
    pu, t = int(puntos_unicos or 0), int(total or 0)
    return {"puntos_unicos": pu, "reportes_repetidos": max(0, t - pu)}


def ensamblar(ahora, dias, desde, hasta, resumen, por_categoria, baches, serie, semana, horas, zonas, rep,
              calidad, modelo=None):
    """Arma el JSON final; `modelo` solo se incluye si no es None (administrador)."""
    out = {
        "generado_en": ahora.astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "periodo": {"dias": dias, "desde": desde.isoformat(), "hasta": hasta.isoformat()},
        "resumen": resumen,
        "por_categoria": por_categoria,
        "baches_por_tamano": baches,
        "serie_diaria": serie,
        "por_dia_semana": semana,
        "por_hora": horas,
        "zonas_calientes": zonas,
        "repetidos": rep,
        "calidad": calidad,
    }
    if modelo is not None:
        out["modelo"] = modelo
    return out


# ---------------------------------------------------------------- caché
class CacheTTL:
    def __init__(self, ttl=TTL_SEGUNDOS, reloj=time.monotonic):
        self.ttl, self.reloj, self._d = ttl, reloj, {}

    def obtener(self, clave):
        ent = self._d.get(clave)
        if ent is None:
            return None
        if self.reloj() - ent[0] >= self.ttl:
            self._d.pop(clave, None)
            return None
        return ent[1]

    def guardar(self, clave, valor):
        self._d[clave] = (self.reloj(), valor)

    def limpiar(self):
        self._d.clear()


_cache = CacheTTL()


def limpiar_cache():
    _cache.limpiar()


# ---------------------------------------------------------------- orquestación
async def consultar_metricas(database, dias, es_admin, ahora=None):
    """Ejecuta las consultas y arma la respuesta. Los errores de BD se propagan (500)."""
    dias = limitar_dias(dias)
    es_admin = bool(es_admin)
    usar_cache = ahora is None  # con `ahora` fijo (pruebas) no se usa la caché
    clave = (dias, es_admin)
    if usar_cache:
        previo = _cache.obtener(clave)
        if previo is not None:
            return previo
        ahora = datetime.datetime.now(datetime.timezone.utc)
    hoy = fecha_local(ahora)
    desde, hasta, desde_ant = periodos(hoy, dias)
    p = {"desde": desde, "hasta": hasta}

    r = await database.fetch_one(SQL_RESUMEN, values={**p, "desde_anterior": desde_ant})
    horas_res = await database.fetch_all(SQL_HORAS_RESOLUCION)
    edades = await database.fetch_all(SQL_ABIERTOS_EDAD, values={"ahora": ahora})
    cats = await database.fetch_all(SQL_CATEGORIAS, values=p)
    dh = await database.fetch_all(SQL_DIA_HORA, values=p)
    celdas = await database.fetch_all(SQL_ZONAS, values=p)
    rep = await database.fetch_one(SQL_REPETIDOS, values=p)

    total, en_periodo, anterior = int(r["total"]), int(r["en_periodo"]), int(r["periodo_anterior"])
    por_estado = {e: int(r[e]) for e in ESTADOS_GESTION}
    resumen = {
        "total": total,
        "en_periodo": en_periodo,
        "periodo_anterior": anterior,
        "variacion_pct": variacion_pct(en_periodo, anterior),
        "por_estado": por_estado,
        "tasa_resolucion_pct": porcentaje(por_estado["resuelto"], total),
        "tiempo_mediano_resolucion_h": mediana_horas([f["horas"] for f in horas_res]),
        "abiertos_por_antiguedad": abiertos_por_antiguedad([(f["dias"], f["n"]) for f in edades]),
    }
    por_categoria, baches, con_foto, otros = categorias_y_tamanos(
        [(f["categoria"], f["tamano"], f["n"], f["con_foto"]) for f in cats])
    filas_dh = [(f["fecha"], f["hora"], f["n"]) for f in dh]
    semana, horas = arreglos_semana_hora(filas_dh)
    serie = serie_diaria(desde, dias, conteos_por_dia(filas_dh))
    zonas = zonas_calientes([(f["celda_lat"], f["celda_lng"], f["n"]) for f in celdas])
    calidad = {"con_foto_pct": porcentaje(con_foto, en_periodo),
               "pendientes_clasificar_pct": porcentaje(otros, en_periodo)}

    modelo = None
    if es_admin:
        m = await database.fetch_one(SQL_MODELO, values=p)
        revisados = int(m["revisados"])
        modelo = {"revisados": revisados,
                  "aceptados_pct": porcentaje(int(m["aceptados"]), revisados),
                  "corregidos_pct": porcentaje(int(m["corregidos"]), revisados),
                  "confianza_media": redondear(m["confianza_media"])}

    resultado = ensamblar(ahora, dias, desde, hasta, resumen, por_categoria, baches, serie, semana, horas,
                          zonas, repetidos(rep["puntos_unicos"], rep["total"]), calidad, modelo)
    if usar_cache:
        _cache.guardar(clave, resultado)
    return resultado
