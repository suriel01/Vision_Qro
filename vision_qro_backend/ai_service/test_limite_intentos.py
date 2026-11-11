"""Pruebas de limite_intentos.py. Ejecutar: python3 -I vision_qro_backend/ai_service/test_limite_intentos.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from limite_intentos import LimiteIntentos  # noqa: E402

fallos = 0
total = 0


def prueba(fn):
    global fallos, total
    total += 1
    try:
        fn()
    except AssertionError as e:
        fallos += 1
        print("FALLA:", fn.__name__, "-", e)


def cinco_fallos_bloquean_el_sexto():
    l = LimiteIntentos()
    for i in range(5):
        assert l.segundos_de_espera("a", 100 + i) == 0
        l.registrar_fallo("a", 100 + i)
    assert l.segundos_de_espera("a", 110) > 0


def otro_cliente_no_se_afecta():
    l = LimiteIntentos()
    for i in range(5):
        l.registrar_fallo("a", 100 + i)
    assert l.segundos_de_espera("b", 110) == 0


def se_libera_tras_la_ventana():
    l = LimiteIntentos(ventana_s=300)
    for i in range(5):
        l.registrar_fallo("a", 100)
    assert l.segundos_de_espera("a", 150) > 0
    assert l.segundos_de_espera("a", 100 + 301) == 0


def la_espera_es_realista():
    l = LimiteIntentos(ventana_s=300)
    for i in range(5):
        l.registrar_fallo("a", 100)
    e = l.segundos_de_espera("a", 160)
    assert 235 <= e <= 245, e


def exito_borra_los_fallos_del_cliente():
    l = LimiteIntentos()
    for i in range(4):
        l.registrar_fallo("a", 100 + i)
    l.registrar_exito("a")
    for i in range(4):
        l.registrar_fallo("a", 200 + i)
    assert l.segundos_de_espera("a", 210) == 0


def limite_global_con_ips_rotando():
    l = LimiteIntentos(max_por_cliente=5, max_global=30)
    for i in range(30):
        assert l.segundos_de_espera(f"ip{i}", 100 + i) == 0
        l.registrar_fallo(f"ip{i}", 100 + i)
    assert l.segundos_de_espera("ip-nueva", 140) > 0


def exito_no_borra_el_contador_global():
    l = LimiteIntentos(max_por_cliente=5, max_global=3)
    for i in range(3):
        l.registrar_fallo(f"ip{i}", 100 + i)
    l.registrar_exito("ip0")
    assert l.segundos_de_espera("otra", 110) > 0


def memoria_se_purga():
    l = LimiteIntentos(ventana_s=60)
    l.registrar_fallo("a", 100)
    l.segundos_de_espera("b", 100 + 61)
    assert "a" not in l._fallos and l._global == []


for n, f in list(globals().items()):
    if callable(f) and getattr(f, "__module__", "") == "__main__" and n not in ("prueba",):
        prueba(f)
print(f"{total - fallos}/{total} pruebas OK")
sys.exit(1 if fallos else 0)
