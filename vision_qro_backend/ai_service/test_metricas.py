"""Pruebas de metricas.py. Ejecutar: python3 -B -I vision_qro_backend/ai_service/test_metricas.py"""
import asyncio
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import metricas as m  # noqa: E402

fallos = 0
total = 0
D = datetime.date


def prueba(fn):
    global fallos, total
    total += 1
    try:
        fn()
    except Exception as e:
        fallos += 1
        print("FALLA:", fn.__name__, "-", repr(e))


def limitar_dias():
    assert m.limitar_dias(30) == 30
    assert m.limitar_dias(0) == 1 and m.limitar_dias(-5) == 1
    assert m.limitar_dias(5000) == 730 and m.limitar_dias(730) == 730
    assert m.limitar_dias("abc") == 30 and m.limitar_dias(None) == 30
    assert m.limitar_dias("7") == 7


def fechas_y_periodos():
    # 2026-11-11 03:00 UTC = 2026-11-10 21:00 en CDMX (UTC-6): "hoy" local es el 10
    ahora = datetime.datetime(2026, 11, 11, 3, 0, tzinfo=datetime.timezone.utc)
    assert m.fecha_local(ahora) == D(2026, 11, 10), m.fecha_local(ahora)
    desde, hasta, ant = m.periodos(D(2026, 11, 10), 30)
    assert hasta == D(2026, 11, 10) and desde == D(2026, 10, 12), desde
    assert (hasta - desde).days + 1 == 30
    assert ant == D(2026, 9, 12), ant  # el periodo previo termina el 11 oct y dura 30 días
    d1, h1, a1 = m.periodos(D(2026, 11, 10), 1)
    assert d1 == h1 == D(2026, 11, 10) and a1 == D(2026, 11, 9)


def porcentajes():
    assert m.porcentaje(1, 3) == 33.3 and m.porcentaje(2, 3) == 66.7
    assert m.porcentaje(0, 0) is None and m.porcentaje(5, 0) is None
    assert m.porcentaje(0, 4) == 0.0
    assert m.variacion_pct(15, 10) == 50.0 and m.variacion_pct(5, 10) == -50.0
    assert m.variacion_pct(5, 0) is None and m.variacion_pct(0, 0) is None
    assert m.variacion_pct(0, 4) == -100.0


def mediana_y_horas():
    assert m.mediana([]) is None
    assert m.mediana([5]) == 5 and m.mediana([3, 1, 2]) == 2
    assert m.mediana([4, 1, 3, 2]) == 2.5
    assert m.mediana_horas([]) is None
    assert m.mediana_horas([1.04, 3.0, None]) == 2.0, m.mediana_horas([1.04, 3.0, None])
    assert m.mediana_horas([-5, 10]) == 5.0  # negativos se acotan a 0


def antiguedad():
    assert [m.cubeta_antiguedad(d) for d in (0, 7, 8, 30, 31, 400)] == ["0_7", "0_7", "8_30", "8_30", "31_mas", "31_mas"]
    assert m.abiertos_por_antiguedad([]) == {"0_7": 0, "8_30": 0, "31_mas": 0}
    r = m.abiertos_por_antiguedad([(0, 2), (7, 1), (8, 4), (30, 1), (31, 5), (-3, 1)])
    assert r == {"0_7": 4, "8_30": 5, "31_mas": 5}, r


def serie_con_ceros():
    s = m.serie_diaria(D(2026, 11, 8), 5, {D(2026, 11, 9): 3, D(2026, 11, 12): 1})
    assert len(s) == 5
    assert [x["fecha"] for x in s] == ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]
    assert [x["n"] for x in s] == [0, 3, 0, 0, 1], s
    # días fuera del periodo no cuentan
    assert sum(x["n"] for x in m.serie_diaria(D(2026, 11, 8), 2, {D(2026, 11, 20): 9})) == 0


def semana_y_hora():
    filas = [(D(2026, 11, 9), 0, 2), (D(2026, 11, 15), 23, 1), (D(2026, 11, 9), 23, 4)]  # lunes, domingo
    sem, hrs = m.arreglos_semana_hora(filas)
    assert len(sem) == 7 and len(hrs) == 24
    assert sem[0] == 6 and sem[6] == 1 and sum(sem) == 7, sem
    assert hrs[0] == 2 and hrs[23] == 5 and sum(hrs) == 7, hrs
    assert m.conteos_por_dia(filas) == {D(2026, 11, 9): 6, D(2026, 11, 15): 1}


def categorias():
    filas = [("bache", "grande", 2, 1), ("bache", "sin_tamano", 1, 1), ("bache", "pequeno", 3, 0),
             ("bolsas", None, 4, 4), ("raro", None, 1, 0)]
    lista, tam, foto, otros = m.categorias_y_tamanos(filas)
    assert [c["id"] for c in lista] == ["bache", "basura_inorganica", "basura_organica", "bolsas", "otros"]
    assert [c["n"] for c in lista] == [6, 0, 0, 4, 1], lista
    assert lista[4]["etiqueta"] == "Otros o pendientes"
    assert tam == {"pequeno": 3, "mediano": 0, "grande": 2, "sin_tamano": 1}, tam
    assert foto == 6 and otros == 1
    lista0, tam0, f0, o0 = m.categorias_y_tamanos([])
    assert len(lista0) == 5 and all(c["n"] == 0 for c in lista0) and sum(tam0.values()) == 0


def k_anonimato_y_orden():
    celdas = [(10, 10, 2), (5, 7, 3), (4, 9, 3), (6, 6, 9), (1, 1, 1)]
    z = m.zonas_calientes(celdas)
    assert [x["n"] for x in z] == [9, 3, 3], z          # n=2 y n=1 descartadas
    assert z[1]["lat"] == m.centro_celda(4) and z[2]["lat"] == m.centro_celda(5)  # empate: menor celda primero
    assert len(m.zonas_calientes([(i, 0, 3) for i in range(25)])) == 10
    assert m.zonas_calientes([(1, 1, 2)]) == []
    # el centro nunca es una esquina de celda ni una coordenada arbitraria
    assert m.centro_celda(8000) == round(8000.5 * 0.0025, 6) == 20.00125
    assert m.zonas_calientes([(8000, -40001, 3)]) == [{"lat": 20.00125, "lng": -100.00125, "n": 3}]


def repetidos_calculo():
    assert m.repetidos(7, 10) == {"puntos_unicos": 7, "reportes_repetidos": 3}
    assert m.repetidos(0, 0) == {"puntos_unicos": 0, "reportes_repetidos": 0}
    assert m.repetidos(None, None) == {"puntos_unicos": 0, "reportes_repetidos": 0}


def ensamblado():
    ahora = datetime.datetime(2026, 11, 11, 3, 0, tzinfo=datetime.timezone.utc)
    base = dict(ahora=ahora, dias=3, desde=D(2026, 11, 8), hasta=D(2026, 11, 10), resumen={}, por_categoria=[],
                baches={}, serie=[], semana=[0] * 7, horas=[0] * 24, zonas=[], rep={}, calidad={})
    r = m.ensamblar(**base)
    assert "modelo" not in r
    assert r["generado_en"] == "2026-11-11T03:00:00Z", r["generado_en"]
    assert r["periodo"] == {"dias": 3, "desde": "2026-11-08", "hasta": "2026-11-10"}
    claves = {"generado_en", "periodo", "resumen", "por_categoria", "baches_por_tamano", "serie_diaria",
              "por_dia_semana", "por_hora", "zonas_calientes", "repetidos", "calidad"}
    assert set(r) == claves, set(r) ^ claves
    assert m.ensamblar(**base, modelo={"revisados": 0})["modelo"] == {"revisados": 0}


def cache_ttl():
    t = [0.0]
    c = m.CacheTTL(60, lambda: t[0])
    assert c.obtener((30, False)) is None
    c.guardar((30, False), "A")
    t[0] = 59.9
    assert c.obtener((30, False)) == "A"
    assert c.obtener((30, True)) is None       # la clave incluye es_admin
    t[0] = 60.0
    assert c.obtener((30, False)) is None      # expiró
    c.guardar((7, False), "B")
    c.limpiar()
    assert c.obtener((7, False)) is None


# ---- orquestación con una BD falsa
HOY = D(2026, 11, 10)
AHORA = datetime.datetime(2026, 11, 11, 3, 0, tzinfo=datetime.timezone.utc)


class BDFalsa:
    def __init__(self, falla_en=None):
        self.consultas, self.valores, self.falla_en = [], [], falla_en

    async def fetch_one(self, query, values=None):
        self.consultas.append(query)
        self.valores.append(values)
        if query is m.SQL_RESUMEN:
            return {"total": 20, "en_periodo": 12, "periodo_anterior": 8, "nuevo": 10, "en_proceso": 6, "resuelto": 4}
        if query is m.SQL_REPETIDOS:
            return {"puntos_unicos": 9, "total": 12}
        if query is m.SQL_MODELO:
            return {"revisados": 4, "aceptados": 3, "corregidos": 1, "confianza_media": 81.26}
        raise AssertionError("consulta inesperada")

    async def fetch_all(self, query, values=None):
        self.consultas.append(query)
        self.valores.append(values)
        if query is self.falla_en:
            raise RuntimeError("bd caída")
        if query is m.SQL_HORAS_RESOLUCION:
            return [{"horas": 10.0}, {"horas": 30.0}]
        if query is m.SQL_ABIERTOS_EDAD:
            return [{"dias": 2, "n": 3}, {"dias": 20, "n": 2}, {"dias": 60, "n": 1}]
        if query is m.SQL_CATEGORIAS:
            return [{"categoria": "bache", "tamano": "grande", "n": 5, "con_foto": 5},
                    {"categoria": "bolsas", "tamano": None, "n": 4, "con_foto": 3},
                    {"categoria": "otros", "tamano": None, "n": 3, "con_foto": 0}]
        if query is m.SQL_DIA_HORA:
            return [{"fecha": D(2026, 11, 9), "hora": 8, "n": 7}, {"fecha": D(2026, 11, 10), "hora": 20, "n": 5}]
        if query is m.SQL_ZONAS:
            return [{"celda_lat": 8000, "celda_lng": -40001, "n": 4}, {"celda_lat": 1, "celda_lng": 1, "n": 2}]
        raise AssertionError("consulta inesperada")


def correr(coro):
    return asyncio.run(coro)


def orquestacion_publica():
    m.limpiar_cache()
    bd = BDFalsa()
    r = correr(m.consultar_metricas(bd, 3, False, ahora=AHORA))
    assert "modelo" not in r
    assert r["periodo"] == {"dias": 3, "desde": "2026-11-08", "hasta": "2026-11-10"}, r["periodo"]
    res = r["resumen"]
    assert res["total"] == 20 and res["en_periodo"] == 12 and res["periodo_anterior"] == 8
    assert res["variacion_pct"] == 50.0 and res["tasa_resolucion_pct"] == 20.0
    assert res["por_estado"] == {"nuevo": 10, "en_proceso": 6, "resuelto": 4}
    assert res["tiempo_mediano_resolucion_h"] == 20.0
    assert res["abiertos_por_antiguedad"] == {"0_7": 3, "8_30": 2, "31_mas": 1}
    assert [c["n"] for c in r["por_categoria"]] == [5, 0, 0, 4, 3]
    assert r["baches_por_tamano"]["grande"] == 5
    assert [x["n"] for x in r["serie_diaria"]] == [0, 7, 5] and len(r["serie_diaria"]) == 3
    assert r["por_dia_semana"][0] == 7 and r["por_dia_semana"][1] == 5   # 9 nov = lunes, 10 = martes
    assert r["por_hora"][8] == 7 and r["por_hora"][20] == 5
    assert r["zonas_calientes"] == [{"lat": 20.00125, "lng": -100.00125, "n": 4}]  # la celda con n=2 se descarta
    assert r["repetidos"] == {"puntos_unicos": 9, "reportes_repetidos": 3}
    assert r["calidad"] == {"con_foto_pct": 66.7, "pendientes_clasificar_pct": 25.0}, r["calidad"]
    assert m.SQL_MODELO not in bd.consultas
    # los parámetros del periodo llegan como fechas
    assert bd.valores[0] == {"desde": D(2026, 11, 8), "hasta": D(2026, 11, 10), "desde_anterior": D(2026, 11, 5)}, bd.valores[0]


def orquestacion_admin():
    bd = BDFalsa()
    r = correr(m.consultar_metricas(bd, 3, True, ahora=AHORA))
    assert r["modelo"] == {"revisados": 4, "aceptados_pct": 75.0, "corregidos_pct": 25.0, "confianza_media": 81.3}, r["modelo"]


def orquestacion_sin_datos():
    class Vacia(BDFalsa):
        async def fetch_one(self, query, values=None):
            if query is m.SQL_RESUMEN:
                return {"total": 0, "en_periodo": 0, "periodo_anterior": 0, "nuevo": 0, "en_proceso": 0, "resuelto": 0}
            if query is m.SQL_REPETIDOS:
                return {"puntos_unicos": 0, "total": 0}
            return {"revisados": 0, "aceptados": 0, "corregidos": 0, "confianza_media": None}

        async def fetch_all(self, query, values=None):
            return []
    r = correr(m.consultar_metricas(Vacia(), 5, True, ahora=AHORA))
    assert r["resumen"]["variacion_pct"] is None and r["resumen"]["tasa_resolucion_pct"] is None
    assert r["resumen"]["tiempo_mediano_resolucion_h"] is None
    assert r["calidad"] == {"con_foto_pct": None, "pendientes_clasificar_pct": None}
    assert r["modelo"] == {"revisados": 0, "aceptados_pct": None, "corregidos_pct": None, "confianza_media": None}
    assert len(r["serie_diaria"]) == 5 and sum(r["por_hora"]) == 0 and r["zonas_calientes"] == []


def error_de_bd_se_propaga():
    bd = BDFalsa(falla_en=m.SQL_CATEGORIAS)
    try:
        correr(m.consultar_metricas(bd, 3, False, ahora=AHORA))
    except RuntimeError:
        return
    assert False, "el error de la BD fue tragado"


def cache_en_consultar():
    m.limpiar_cache()
    bd = BDFalsa()
    a = correr(m.consultar_metricas(bd, 3, False))
    n = len(bd.consultas)
    b = correr(m.consultar_metricas(bd, 3, False))
    assert len(bd.consultas) == n and a is b, "la segunda llamada debió salir de la caché"
    correr(m.consultar_metricas(bd, 3, True))
    assert len(bd.consultas) > n, "es_admin usa otra clave de caché"
    m.limpiar_cache()
    n = len(bd.consultas)
    correr(m.consultar_metricas(bd, 3, False))
    assert len(bd.consultas) > n, "limpiar_cache debe forzar nueva consulta"
    # dias fuera de rango se acota
    m.limpiar_cache()
    assert correr(m.consultar_metricas(bd, 99999, False))["periodo"]["dias"] == 730
    m.limpiar_cache()


def sql_sin_dobles_dos_puntos_tras_parametro():
    import re
    for nombre in dir(m):
        if nombre.startswith("SQL_"):
            s = getattr(m, nombre)
            assert not re.search(r":\w+::", s), nombre
    # nada que identifique a una persona en las consultas públicas
    for nombre in ("SQL_RESUMEN", "SQL_CATEGORIAS", "SQL_DIA_HORA", "SQL_ZONAS", "SQL_REPETIDOS", "SQL_MODELO"):
        s = getattr(m, nombre)
        assert "telegram_username" not in s.split("cat AS")[1] and "chat_id" not in s.split("cat AS")[1], nombre


for f in (limitar_dias, fechas_y_periodos, porcentajes, mediana_y_horas, antiguedad, serie_con_ceros, semana_y_hora,
          categorias, k_anonimato_y_orden, repetidos_calculo, ensamblado, cache_ttl, orquestacion_publica,
          orquestacion_admin, orquestacion_sin_datos, error_de_bd_se_propaga, cache_en_consultar,
          sql_sin_dobles_dos_puntos_tras_parametro):
    prueba(f)

print(f"{total - fallos}/{total} pruebas OK")
sys.exit(1 if fallos else 0)
