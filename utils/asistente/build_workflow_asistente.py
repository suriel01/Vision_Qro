#!/usr/bin/env python3
"""Inserta (o actualiza) en n8n_Telegram.json los nodos de guardrails del asistente de texto.

El código de los nodos Code se toma de guardrails.js, que es la fuente de verdad y tiene pruebas
(node utils/asistente/test_guardrails.js). Es idempotente: se puede volver a ejecutar tras cambiar las reglas.

Flujo del texto libre:
  Tipo de mensaje -> Clasificar texto -> Ruta del texto
        llm   -> Asistente IA -> Filtrar respuesta -> Respuesta IA     (si el modelo falla: aviso fijo)
        otras -> Respuesta fija
"""
import copy, json, os, re, sys, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
WORKFLOW = os.path.abspath(os.path.join(HERE, "..", "..", "n8n_Telegram.json"))

src = open(os.path.join(HERE, "guardrails.js"), encoding="utf-8").read()
src = re.sub(r"\nif \(typeof module !== 'undefined'.*?\n}\n?$", "\n", src, flags=re.S)  # sin module.exports en n8n
assert "module.exports" not in src

CLASIFICAR_JS = src + """
// --- Nodo: Clasificar texto ---
const msg = $('Telegram Trigger').first().json.message;
const est = $getWorkflowStaticData('global');
const ahora = Date.now();
// Chats sin límite de TEXTO (el equipo). Ej.: ['123456789']. Fotos, ubicaciones y botones nunca tienen límite.
const EXENTOS = [];
const r = clasificar(msg.text);
if (limitarChat(est, msg.chat.id, ahora, { exentos: EXENTOS })) return { json: { ruta: 'limite', respuesta: TXT.LIMITE } };
if (r.ruta === 'llm' && limitarModelo(est, ahora)) return { json: { ruta: 'limite', respuesta: TXT.LIMITE } };
return { json: r };
"""
FILTRAR_JS = src + """
// --- Nodo: Filtrar respuesta ---
return { json: filtrarRespuesta($json.message && $json.message.content) };
"""

d = json.load(open(WORKFLOW, encoding="utf-8"))
N = {n["name"]: n for n in d["nodes"]}
C = d["connections"]
CRED = N["Respuesta IA"]["credentials"]


def upsert(node):
    if node["name"] in N:
        N[node["name"]]["parameters"] = node["parameters"]
        return
    d["nodes"].append(node)
    N[node["name"]] = node


def code_node(name, js, pos):
    return {"parameters": {"mode": "runOnceForEachItem", "jsCode": js}, "type": "n8n-nodes-base.code",
            "typeVersion": 2, "position": pos, "id": str(uuid.uuid4()), "name": name}


upsert(code_node("Clasificar texto", CLASIFICAR_JS, [21040, 21088]))
upsert(code_node("Filtrar respuesta", FILTRAR_JS, [21616, 21088]))

# Ruta del texto: 'llm' -> modelo; cualquier otra -> respuesta fija
sw = {"parameters": {"rules": {"values": [{"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 3},
          "conditions": [{"leftValue": "={{ $json.ruta }}", "rightValue": "llm", "operator": {"type": "string", "operation": "equals"},
                          "id": str(uuid.uuid4())}], "combinator": "and"}}]},
      "options": {"fallbackOutput": "extra"}},
      "type": "n8n-nodes-base.switch", "typeVersion": 3.4, "position": [21264, 21088], "id": str(uuid.uuid4()), "name": "Ruta del texto"}
upsert(sw)

fija = {"parameters": {"chatId": "={{ $('Telegram Trigger').first().json.message.chat.id }}",
        "text": "={{ $json.respuesta }}", "additionalFields": {"appendAttribution": False}},
        "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [21488, 21280], "id": str(uuid.uuid4()),
        "name": "Respuesta fija", "credentials": CRED}
upsert(fija)

# Prompt del sistema: fuente de verdad en guardrails.js (SYSTEM_PROMPT)
import subprocess
prompt = subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./guardrails.js').SYSTEM_PROMPT))"],
                        cwd=HERE, capture_output=True, text=True, check=True).stdout.strip()
# Asistente IA: el texto ya viene recortado y clasificado
ia = N["Asistente IA"]["parameters"]
ia["body"] = re.sub(r"\{role:'user',content:String\(.*?\)\.slice\(0,500\)\}", "{role:'user',content:String($json.texto)}", ia["body"], flags=re.S)
assert "String($json.texto)" in ia["body"], "no se pudo reescribir el cuerpo de Asistente IA"
ia["body"] = re.sub(r'\{role:\'system\',content:"(?:[^"\\]|\\.)*"\}', lambda m: "{role:'system',content:" + prompt + "}", ia["body"], count=1)
assert prompt in ia["body"], "no se pudo actualizar el prompt del sistema"

# Respuesta IA: ya viene filtrada
N["Respuesta IA"]["parameters"]["text"] = "={{ $json.respuesta }}"
N["Respuesta IA"]["position"] = [21840, 21088]

C["Tipo de mensaje"]["main"][0] = [{"node": "Clasificar texto", "type": "main", "index": 0}]
C["Clasificar texto"] = {"main": [[{"node": "Ruta del texto", "type": "main", "index": 0}]]}
C["Ruta del texto"] = {"main": [[{"node": "Asistente IA", "type": "main", "index": 0}],
                                [{"node": "Respuesta fija", "type": "main", "index": 0}]]}
C["Asistente IA"] = {"main": [[{"node": "Filtrar respuesta", "type": "main", "index": 0}],
                              [{"node": "Respuesta fija IA no disponible", "type": "main", "index": 0}]]}
C["Filtrar respuesta"] = {"main": [[{"node": "Respuesta IA", "type": "main", "index": 0}]]}

names = [n["name"] for n in d["nodes"]]
assert len(names) == len(set(names))
for s, cc in C.items():
    assert s in names, s
    for o in cc["main"]:
        for t in o:
            assert t["node"] in names, t
json.dump(d, open(WORKFLOW, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print("nodos:", len(names))
