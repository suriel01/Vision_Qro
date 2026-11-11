"""Estados de gestión de un reporte y avisos al ciudadano (sin dependencias, se prueba aislado).

Es distinto del campo `estado` que usa el bot de Telegram para su flujo interno:
`estado_gestion` lo cambia una persona administradora y lo ve todo el mundo en el mapa.
"""

ESTADOS = ("nuevo", "en_proceso", "resuelto")
ETIQUETAS = {"nuevo": "nuevo", "en_proceso": "en proceso", "resuelto": "resuelto"}


def es_estado_valido(estado) -> bool:
    return isinstance(estado, str) and estado in ESTADOS


def debe_notificar(anterior, nuevo) -> bool:
    """Se avisa al ciudadano solo al pasar a 'en proceso' o 'resuelto' y solo si el estado cambió.
    Reabrir un reporte ('nuevo') no manda mensaje, para no generar ruido."""
    return nuevo in ("en_proceso", "resuelto") and anterior != nuevo


def mensaje_cambio(reporte_id, estado) -> str:
    etiqueta = ETIQUETAS[estado].upper()
    cierre = "¡Gracias por ayudar a mejorar Querétaro!" if estado == "resuelto" else "Gracias por reportar."
    return f"Actualización de tu reporte #{int(reporte_id)}: ahora está {etiqueta}. {cierre}"
