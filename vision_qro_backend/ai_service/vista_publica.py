"""Qué datos de un reporte se entregan según quién los pide (sin dependencias, se prueba aislado).

Todos (también invitados, solo lectura): ubicación, tipo, fecha, estado, resultado del análisis automático y la foto
cuando las fotos son públicas (FOTOS_PUBLICAS). Solo el administrador puede modificar o eliminar.
Nunca se entrega el usuario de Telegram ni el chat por esta vía.
"""

CAMPOS_PUBLICOS = ("id", "lat", "lng", "tipo", "created_at", "estado_gestion", "tiene_foto", "confianza", "objeto_detectado")


def reporte_para_mapa(fila: dict, es_admin: bool, fotos_publicas: bool) -> dict:
    """fila: columnas de la base (dict). Devuelve el diccionario que se envía al navegador."""
    tipo_final = fila.get("subclase") or fila.get("clase_corregida")
    creado = fila.get("created_at")
    confianza = fila.get("confianza")
    salida = {
        "id": int(fila["id"]),
        "lat": float(fila["latitud"]),
        "lng": float(fila["longitud"]),
        "tipo": tipo_final or "pendiente",
        "created_at": creado.isoformat() if creado else None,
        "estado_gestion": fila.get("estado_gestion") or "nuevo",
        # La foto solo se ofrece si hay foto Y quien la pide puede verla.
        "tiene_foto": bool(fila.get("foto_url")) and (es_admin or fotos_publicas),
        "objeto_detectado": fila.get("clase_corregida") or "Desconocido",
        "confianza": float(confianza) if confianza else None,
    }
    return salida
