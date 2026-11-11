"""Pruebas de gestion.py y vista_publica.py. Ejecutar: python3 -B -I vision_qro_backend/ai_service/test_gestion_y_vista.py"""
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gestion import debe_notificar, es_estado_valido, mensaje_cambio  # noqa: E402
from vista_publica import CAMPOS_PUBLICOS, reporte_para_mapa  # noqa: E402

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


FILA = {"id": 7, "latitud": 20.5, "longitud": -100.4, "clase_corregida": "bottle", "subclase": "inorg",
        "confianza": 87.2, "foto_url": "photos/x.jpg", "telegram_username": "alguien", "telegram_user_id": 99, "chat_id": 123,
        "foto_id": "AAA", "created_at": datetime.datetime(2026, 11, 10, 21, 38, tzinfo=datetime.timezone.utc), "estado_gestion": "nuevo"}


def estados_validos():
    assert all(es_estado_valido(e) for e in ("nuevo", "en_proceso", "resuelto"))


def estados_invalidos():
    for e in ("", "Resuelto", "cerrado", None, 3, "nuevo ", "resuelto; DROP TABLE"):
        assert not es_estado_valido(e), e


def notifica_solo_al_avanzar():
    assert debe_notificar("nuevo", "en_proceso") and debe_notificar("en_proceso", "resuelto") and debe_notificar("nuevo", "resuelto")


def no_notifica_si_no_cambia_ni_al_reabrir():
    assert not debe_notificar("resuelto", "resuelto") and not debe_notificar("en_proceso", "en_proceso")
    assert not debe_notificar("resuelto", "nuevo") and not debe_notificar("en_proceso", "nuevo")


def mensaje_dice_el_estado_y_el_id():
    m = mensaje_cambio(7, "en_proceso")
    assert "#7" in m and "EN PROCESO" in m
    assert "RESUELTO" in mensaje_cambio(7, "resuelto")


def mensaje_no_se_deja_inyectar_el_id():
    assert "#12" in mensaje_cambio("12", "resuelto")
    try:
        mensaje_cambio("12; x", "resuelto")
        assert False, "debió fallar con un id no numérico"
    except ValueError:
        pass


def invitado_ve_el_analisis_pero_no_datos_personales():
    r = reporte_para_mapa(FILA, es_admin=False, fotos_publicas=False)
    assert set(r) == set(CAMPOS_PUBLICOS), set(r) ^ set(CAMPOS_PUBLICOS)
    assert r["confianza"] == 87.2 and r["objeto_detectado"] == "bottle"
    for k in ("telegram_username", "telegram_user_id", "chat_id", "foto_url", "foto_id"):
        assert k not in r, k


def invitado_sin_foto_si_no_son_publicas():
    assert reporte_para_mapa(FILA, False, False)["tiene_foto"] is False


def invitado_con_fotos_publicas_ve_foto():
    assert reporte_para_mapa(FILA, False, True)["tiene_foto"] is True


def admin_ve_foto_aunque_no_sean_publicas():
    r = reporte_para_mapa(FILA, True, False)
    assert r["tiene_foto"] is True and r["confianza"] == 87.2 and r["objeto_detectado"] == "bottle"
    assert set(r) == set(CAMPOS_PUBLICOS)
    assert "telegram_username" not in r and "chat_id" not in r


def sin_foto_nadie_tiene_foto():
    f = dict(FILA, foto_url=None)
    assert reporte_para_mapa(f, True, True)["tiene_foto"] is False


def reporte_pendiente_y_valores_por_defecto():
    f = dict(FILA, subclase=None, clase_corregida=None, confianza=None, estado_gestion=None, created_at=None)
    r = reporte_para_mapa(f, True, False)
    assert r["tipo"] == "pendiente" and r["estado_gestion"] == "nuevo" and r["created_at"] is None
    assert r["confianza"] is None and r["objeto_detectado"] == "Desconocido"


def fecha_en_iso():
    assert reporte_para_mapa(FILA, False, False)["created_at"].startswith("2026-11-10T21:38")


for n, f in list(globals().items()):
    if callable(f) and getattr(f, "__module__", "") == "__main__" and n not in ("prueba",):
        prueba(f)
print(f"{total - fallos}/{total} pruebas OK")
sys.exit(1 if fallos else 0)
