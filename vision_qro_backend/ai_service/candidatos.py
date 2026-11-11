"""Elige qué objeto de una foto se va a reportar, sin depender de YOLO (se puede probar aislado).

La detección puede encontrar varios objetos. En vez de quedarse siempre con el de mayor confianza,
se calcula una lista de candidatos y se marca si hay duda real: en ese caso el bot le pregunta a la persona.
La persona siempre puede corregir el resultado.
"""

UMBRAL_CONFIANZA = 40.0   # % mínimo para considerar un objeto como candidato
RATIO_AMBIGUO = 0.5       # el 2.º candidato compite si su puntaje es >= 50 % del 1.º
MAX_CANDIDATOS = 3


def elegir_candidatos(detecciones, clase_a_cat):
    """detecciones: [{'clase': str, 'confianza': 0-100, 'area_frac': 0-1}, ...]
    clase_a_cat: {clase_en_minusculas: categoria}. Solo cuentan los objetos con categoría conocida.

    Devuelve (candidatos, ambiguo). Cada candidato: {clase, confianza, categoria, area_pct, score}.
    El puntaje pondera la confianza con el tamaño del objeto en la foto (raíz cuadrada para no
    ignorar los objetos pequeños por completo): el objeto grande y centrado en la foto suele ser el reportado.
    """
    mejores = {}
    for d in detecciones:
        categoria = clase_a_cat.get(str(d["clase"]).lower())
        if categoria is None or d["confianza"] < UMBRAL_CONFIANZA:
            continue
        area = max(float(d.get("area_frac", 0.0)), 0.0)
        score = d["confianza"] * (area ** 0.5)
        previo = mejores.get(d["clase"])
        if previo is None or score > previo["score"]:
            mejores[d["clase"]] = {
                "clase": d["clase"],
                "confianza": round(float(d["confianza"]), 2),
                "categoria": categoria,
                "area_pct": round(area * 100, 1),
                "score": round(score, 3),
            }
    candidatos = sorted(mejores.values(), key=lambda c: c["score"], reverse=True)[:MAX_CANDIDATOS]
    ambiguo = (
        len(candidatos) >= 2
        and candidatos[0]["score"] > 0
        and candidatos[1]["score"] >= RATIO_AMBIGUO * candidatos[0]["score"]
    )
    return candidatos, ambiguo
