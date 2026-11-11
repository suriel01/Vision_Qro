#!/usr/bin/env python3
"""Agrega a n8n_Telegram.json el selector de objeto cuando la foto trae varios (idempotente).

Flujo:
  HTTP Request (/predict) -> ¿Varios objetos?
      no -> Guardar resultado -> Reporte Completado            (como antes)
      sí -> Esperando objeto -> Elegir objeto  [botón por candidato + "Otra cosa"]
  Botones (Switch1):
      obj_<id>_<n>  -> Elegir objeto detectado -> Reporte con objeto elegido  (con "¿Es correcto?")
      obj_<id>_x    -> Elegir otra cosa -> Solicitar nombre objeto            (flujo manual existente)
La persona decide: puede elegir un candidato, elegir "otra cosa" y clasificar a mano, y siempre puede corregir después.
"""
import copy, json, os, uuid

WORKFLOW = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "n8n_Telegram.json"))
d = json.load(open(WORKFLOW, encoding="utf-8"))
N = {n["name"]: n for n in d["nodes"]}
C = d["connections"]

TT = "$('Telegram Trigger').first().json"
PG_CRED = copy.deepcopy(N["Validado"]["credentials"])
TG_CRED = copy.deepcopy(N["Respuesta IA"]["credentials"])
HR = "$('HTTP Request').first().json"


def upsert(node):
    if node["name"] in N:
        N[node["name"]]["parameters"] = node["parameters"]
        return
    d["nodes"].append(node)
    N[node["name"]] = node


def pg(name, query, args, pos):
    return {"parameters": {"operation": "executeQuery", "query": query,
                           "options": {"queryReplacement": "={{ [" + ", ".join(args) + "] }}"}},
            "type": "n8n-nodes-base.postgres", "typeVersion": 2.6, "position": pos, "id": str(uuid.uuid4()),
            "name": name, "credentials": copy.deepcopy(PG_CRED)}


def tg(name, text, rows, pos):
    p = {"chatId": "={{ " + TT + ".message?.chat.id || " + TT + ".callback_query?.message.chat.id }}",
         "text": text, "replyMarkup": "inlineKeyboard",
         "inlineKeyboard": {"rows": [{"row": {"buttons": [{"text": t, "additionalFields": {"callback_data": cb}}]}} for t, cb in rows]},
         "additionalFields": {"appendAttribution": False}}
    return {"parameters": p, "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": pos,
            "id": str(uuid.uuid4()), "name": name, "credentials": copy.deepcopy(TG_CRED)}


def cond(expr, op, right=None, typ="string"):
    c = {"leftValue": expr, "rightValue": right if right is not None else "",
         "operator": ({"type": "boolean", "operation": "true", "singleValue": True} if typ == "boolean" else {"type": typ, "operation": op}),
         "id": str(uuid.uuid4())}
    return c


# 1) ¿Varios objetos?
if_node = {"parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
           "conditions": [cond("={{ $json.ambiguo === true }}", "true", typ="boolean")], "combinator": "and"}, "options": {}},
           "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [21070, 20200], "id": str(uuid.uuid4()), "name": "¿Varios objetos?"}
upsert(if_node)

# 2) esperar la elección
upsert(pg("Esperando objeto",
          "UPDATE reportes\nSET estado = 'esperando_objeto',\n    foto_url = CASE\n        WHEN COALESCE($2, '') NOT IN ('undefined','null','')\n        THEN $2\n        ELSE foto_id\n    END,\n"
          "    telegram_username = $3\nWHERE id = (SELECT id FROM reportes WHERE chat_id = $1 AND estado = 'completado' ORDER BY id DESC LIMIT 1)\nRETURNING id;",
          [TT + ".message.chat.id", "$node[\"Descargar foto\"].json.file_path || ''",
           TT + ".message.from.username || " + TT + ".message.from.first_name"], [21290, 20140]))


def etiqueta(i):
    return "={{ " + HR + ".candidatos[" + str(i) + "].clase + ' (' + Math.round(" + HR + ".candidatos[" + str(i) + "].confianza) + '%)' }}"


upsert(tg("Elegir objeto",
          "📸 Veo varias cosas en tu foto. ¿Cuál quieres reportar?",
          [(etiqueta(0), "={{ 'obj_' + $json.id + '_0' }}"),
           (etiqueta(1), "={{ 'obj_' + $json.id + '_1' }}"),
           ("🔎 Otra cosa", "={{ 'obj_' + $json.id + '_x' }}"),
           ("🚫 Cancelar reporte", "cancelar_reporte_inline")], [21510, 20140]))

# 3) botones obj_...
CHOOSE_SQL = (
    "WITH p AS (\n  SELECT CASE WHEN split_part($1, '_', 2) ~ '^[0-9]+$' THEN split_part($1, '_', 2)::int END AS rid,\n"
    "         CASE WHEN split_part($1, '_', 3) ~ '^[0-9]+$' THEN split_part($1, '_', 3)::int END AS idx\n),\n"
    "pick AS (\n  SELECT pr.reporte_id, pr.candidatos -> p.idx AS c\n  FROM p\n  JOIN LATERAL (SELECT reporte_id, candidatos FROM predicciones WHERE reporte_id = p.rid ORDER BY id DESC LIMIT 1) pr ON true\n"
    "  WHERE p.idx IS NOT NULL\n)\n"
    "UPDATE reportes r\nSET clase_corregida = pick.c ->> 'clase',\n    confianza = (pick.c ->> 'confianza')::float,\n    subclase = NULLIF(pick.c ->> 'categoria', 'pendiente'),\n    estado = 'completado'\n"
    "FROM pick\nWHERE r.id = pick.reporte_id AND r.chat_id = $2 AND r.estado = 'esperando_objeto' AND pick.c IS NOT NULL\n"
    "RETURNING r.id, r.clase_corregida, r.subclase, r.confianza;")
DATA = TT + ".callback_query.data"
CHAT = TT + ".callback_query.message.chat.id"
upsert(pg("Elegir objeto detectado", CHOOSE_SQL, [DATA, CHAT], [21070, 21500]))
upsert(pg("Elegir otra cosa",
          "UPDATE reportes\nSET estado = 'esperando_nombre'\nWHERE id = (CASE WHEN split_part($1, '_', 2) ~ '^[0-9]+$' THEN split_part($1, '_', 2)::int END)\n"
          "  AND chat_id = $2 AND estado = 'esperando_objeto'\nRETURNING id;", [DATA, CHAT], [21070, 21700]))
upsert(tg("Reporte con objeto elegido",
          "=✅ *Reporte registrado* en el mapa de Vision Qro.\n\nElegiste: *{{ $json.clase_corregida }}* ({{ $json.subclase === 'org' ? 'Orgánico 🍎' : $json.subclase === 'inorg' ? 'Inorgánico ♻️' : 'Pendiente' }})\n\n¿Es correcto?",
          [("✅ Es correcto", "conf_ok"), ("❌ Hay un error", "conf_err")], [21290, 21500]))

# Switch1: dos reglas nuevas al final ('first match wins' por defecto)
sw = N["Switch1"]["parameters"]["rules"]["values"]
def rule(conds):
    return {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 3},
                           "conditions": conds, "combinator": "and"}}
LEFT = "={{ $json.callback_query.data }}"
want = [rule([cond(LEFT, "startsWith", "obj_"), cond(LEFT, "endsWith", "_x")]), rule([cond(LEFT, "startsWith", "obj_")])]
if not any("obj_" in json.dumps(r) for r in sw):
    sw.extend(want)
else:  # idempotente: reemplaza las reglas obj_ existentes conservando las demás
    base = [r for r in sw if "obj_" not in json.dumps(r)]
    sw[:] = base + want
sm = C["Switch1"]["main"]
base_outputs = 12
del sm[base_outputs:]
sm.append([{"node": "Elegir otra cosa", "type": "main", "index": 0}])
sm.append([{"node": "Elegir objeto detectado", "type": "main", "index": 0}])
assert len(sm) == len(sw)

# conexiones del selector
C["HTTP Request"]["main"][0] = [{"node": "¿Varios objetos?", "type": "main", "index": 0}]
C["¿Varios objetos?"] = {"main": [[{"node": "Esperando objeto", "type": "main", "index": 0}],
                                  [{"node": "Guardar resultado", "type": "main", "index": 0}]]}
C["Esperando objeto"] = {"main": [[{"node": "Elegir objeto", "type": "main", "index": 0}]]}
C["Elegir objeto detectado"] = {"main": [[{"node": "Reporte con objeto elegido", "type": "main", "index": 0}]]}
C["Elegir otra cosa"] = {"main": [[{"node": "Solicitar nombre objeto", "type": "main", "index": 0}]]}

# una foto nueva no deja colgado un reporte que esperaba elección: pasa a clasificación manual
q = N["Foto"]["parameters"]["query"]
guard = "UPDATE reportes SET estado = 'pendiente_manual' WHERE chat_id = $1 AND estado = 'esperando_objeto';\n"
if guard not in q:
    N["Foto"]["parameters"]["query"] = guard + q

names = [n["name"] for n in d["nodes"]]
assert len(names) == len(set(names))
for s, cc in C.items():
    assert s in names, s
    for o in cc["main"]:
        for t in o:
            assert t["node"] in names, t
json.dump(d, open(WORKFLOW, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print("nodos:", len(names), "| reglas Switch1:", len(sw))
