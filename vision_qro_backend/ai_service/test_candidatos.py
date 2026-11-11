"""Pruebas de candidatos.py. Ejecutar: python3 vision_qro_backend/ai_service/test_candidatos.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from candidatos import elegir_candidatos  # noqa: E402

CAT = {"bottle": "inorg", "cup": "inorg", "apple": "org", "banana": "org", "bowl": "inorg"}
fallos = 0


def prueba(nombre, fn):
    global fallos
    try:
        fn()
    except AssertionError as e:
        fallos += 1
        print("FALLA:", nombre, "-", e)


def det(clase, conf, area):
    return {"clase": clase, "confianza": conf, "area_frac": area}


def un_objeto():
    c, amb = elegir_candidatos([det("bottle", 90, 0.2)], CAT)
    assert [x["clase"] for x in c] == ["bottle"] and not amb


def dos_comparables_preguntan():
    c, amb = elegir_candidatos([det("bottle", 85, 0.15), det("cup", 80, 0.12)], CAT)
    assert amb and [x["clase"] for x in c] == ["bottle", "cup"]


def uno_domina_no_pregunta():
    c, amb = elegir_candidatos([det("bottle", 90, 0.30), det("cup", 70, 0.005)], CAT)
    assert not amb and c[0]["clase"] == "bottle"


def mayor_confianza_pero_diminuto_pierde():
    c, amb = elegir_candidatos([det("cup", 95, 0.002), det("bottle", 60, 0.25)], CAT)
    assert c[0]["clase"] == "bottle"


def ignora_clases_sin_categoria():
    c, amb = elegir_candidatos([det("person", 99, 0.5), det("bottle", 70, 0.1)], CAT)
    assert [x["clase"] for x in c] == ["bottle"] and not amb


def solo_sin_categoria_no_hay_candidatos():
    c, amb = elegir_candidatos([det("person", 99, 0.5), det("car", 90, 0.3)], CAT)
    assert c == [] and not amb


def umbral_de_confianza():
    c, amb = elegir_candidatos([det("bottle", 39.9, 0.3), det("cup", 40.0, 0.3)], CAT)
    assert [x["clase"] for x in c] == ["cup"]


def mismo_tipo_dos_veces_cuenta_una_vez():
    c, amb = elegir_candidatos([det("bottle", 90, 0.1), det("bottle", 80, 0.3)], CAT)
    assert len(c) == 1 and not amb


def maximo_tres():
    dets = [det("bottle", 80, 0.1), det("cup", 80, 0.1), det("apple", 80, 0.1), det("banana", 80, 0.1)]
    c, amb = elegir_candidatos(dets, CAT)
    assert len(c) == 3 and amb


def sin_detecciones():
    assert elegir_candidatos([], CAT) == ([], False)


def mayusculas_en_clase():
    c, amb = elegir_candidatos([det("Bottle", 80, 0.2)], CAT)
    assert len(c) == 1


def area_cero_no_rompe():
    c, amb = elegir_candidatos([det("bottle", 80, 0), det("cup", 80, 0)], CAT)
    assert not amb


total = 0
for nombre, fn in list(globals().items()):
    if callable(fn) and nombre not in ("prueba", "det", "elegir_candidatos") and fn.__module__ == "__main__" and not nombre.startswith("_"):
        total += 1
        prueba(nombre, fn)
print(f"{total - fallos}/{total} pruebas OK")
sys.exit(1 if fallos else 0)
