import json
import uuid

FILE_PATH = "/home/surielalcantara/Desktop/Vision_Qro/Enviar foto.json"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

# 1. Update telegram_username fallback
for node in data["nodes"]:
    if node.get("type") == "n8n-nodes-base.postgres":
        if "query" in node["parameters"]:
            q = node["parameters"]["query"]
            if "telegram_username = '{{ $json.callback_query.from.username }}'" in q:
                node["parameters"]["query"] = q.replace(
                    "telegram_username = '{{ $json.callback_query.from.username }}'",
                    "telegram_username = '{{ $json.callback_query.from.username || $json.callback_query.from.first_name }}'"
                )

# 2. Add "Cancelar reporte" button to "solicitar clasificacion"
for node in data["nodes"]:
    if node["name"] == "solicitar clasificacion":
        # inlineKeyboard -> rows
        rows = node["parameters"].get("inlineKeyboard", {}).get("rows", [])
        # Add cancel button
        rows.append({
            "row": {
                "buttons": [
                    {
                        "text": "🚫 Cancelar reporte",
                        "additionalFields": {
                            "callback_data": "cancelar_reporte_inline"
                        }
                    }
                ]
            }
        })

# 3. Add "Cancelar reporte" button to "Categoria basura"
for node in data["nodes"]:
    if node["name"] == "Categoria basura":
        rows = node["parameters"].get("inlineKeyboard", {}).get("rows", [])
        rows.append({
            "row": {
                "buttons": [
                    {
                        "text": "🚫 Cancelar reporte",
                        "additionalFields": {
                            "callback_data": "cancelar_reporte_inline"
                        }
                    }
                ]
            }
        })

# 4. Add "Cancelar reporte" button to "Tamaño bache"
for node in data["nodes"]:
    if node["name"] == "Tamaño bache":
        rows = node["parameters"].get("inlineKeyboard", {}).get("rows", [])
        rows.append({
            "row": {
                "buttons": [
                    {
                        "text": "🚫 Cancelar reporte",
                        "additionalFields": {
                            "callback_data": "cancelar_reporte_inline"
                        }
                    }
                ]
            }
        })

# 5. Route "cancelar_reporte_inline"
# Where does it go? The switch node after Telegram Trigger (for callback_query)
# Let's find the callback_query switch.
# Name is usually "Switch1" or similar.
switch_node = None
for node in data["nodes"]:
    if node.get("type") == "n8n-nodes-base.switch" and "callback_query.data" in json.dumps(node):
        switch_node = node
        break

if switch_node:
    # Add condition for cancelar_reporte_inline
    rules = switch_node["parameters"]["rules"]["values"]
    rules.append({
        "conditions": {
            "options": {
                "caseSensitive": True,
                "leftValue": "",
                "typeValidation": "strict",
                "version": 3
            },
            "conditions": [
                {
                    "id": str(uuid.uuid4()),
                    "leftValue": "={{ $json.callback_query.data }}",
                    "rightValue": "cancelar_reporte_inline",
                    "operator": {
                        "type": "string",
                        "operation": "equals",
                        "name": "filter.operator.equals"
                    }
                }
            ],
            "combinator": "and"
        }
    })
    
    # We need to add the connection for this new output index!
    # The new output index will be len(rules) - 1.
    new_index = len(rules) - 1
    
    # Add connection to "Cancelar inline" node
    # Let's check if "Cancelar inline" exists
    cancelar_inline_exists = any(n["name"] == "Cancelar inline" for n in data["nodes"])
    if not cancelar_inline_exists:
        # Create Cancelar inline node (Delete query)
        data["nodes"].append({
            "parameters": {
                "operation": "executeQuery",
                "query": "DELETE FROM reportes WHERE chat_id = {{ $json.callback_query.message.chat.id }} AND estado != 'validado';\nSELECT 'cancelado' AS resultado;",
                "options": {}
            },
            "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.6,
            "position": [ 400, 1500 ],
            "id": str(uuid.uuid4()),
            "name": "Cancelar inline",
            "credentials": {
                "postgres": { "id": "Pz7QzPz7Qz", "name": "Postgres account" } # Usually we can just omit or copy from another
            }
        })
        # Try to copy postgres credentials from another node
        for n in data["nodes"]:
            if n.get("type") == "n8n-nodes-base.postgres" and "credentials" in n:
                data["nodes"][-1]["credentials"] = n["credentials"]
                break
        
        # Add "Mensaje cancelar inline"
        data["nodes"].append({
            "parameters": {
                "chatId": "={{ $json.callback_query.message.chat.id }}",
                "text": "🚫 Reporte cancelado.",
                "additionalFields": {}
            },
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [ 600, 1500 ],
            "id": str(uuid.uuid4()),
            "name": "Mensaje cancelar inline",
            "credentials": {
                "telegramApi": { "id": "XaFnB0RjU5Z7dSO9", "name": "Telegram account" }
            }
        })
        # Add connection
        if "Cancelar inline" not in data["connections"]:
            data["connections"]["Cancelar inline"] = {"main": [[{"node": "Mensaje cancelar inline", "type": "main", "index": 0}]]}

    # Connect switch to Cancelar inline
    if switch_node["name"] not in data["connections"]:
        data["connections"][switch_node["name"]] = {"main": []}
    while len(data["connections"][switch_node["name"]]["main"]) <= new_index:
        data["connections"][switch_node["name"]]["main"].append([])
    data["connections"][switch_node["name"]]["main"][new_index].append({
        "node": "Cancelar inline",
        "type": "main",
        "index": 0
    })

# Now the hard part: "ingresar nombre del objeto" before "solicitar clasificacion"
# When AI fails -> "Correcion" node (UPDATE reportes SET estado = 'pendiente_correccion')
# We change "Correcion" to point to a new Telegram node: "Solicitar nombre objeto"
# And we change "Correcion" query to set estado = 'esperando_nombre'
for node in data["nodes"]:
    if node["name"] == "Correcion":
        q = node["parameters"].get("query", "")
        if "estado = 'pendiente_correccion'" in q:
            node["parameters"]["query"] = q.replace("estado = 'pendiente_correccion'", "estado = 'esperando_nombre'")

# Create "Solicitar nombre objeto" node
solicitar_nombre_node = {
    "parameters": {
        "chatId": "={{ $json.callback_query.message.chat.id }}",
        "text": "¡Entendido! Ayúdame a mejorar mi puntería. 🎯\nPor favor, escribe el **nombre del objeto** que aparece en la foto:",
        "replyMarkup": "inlineKeyboard",
        "inlineKeyboard": {
            "rows": [
                {
                    "row": {
                        "buttons": [
                            {
                                "text": "🚫 Cancelar reporte",
                                "additionalFields": {
                                    "callback_data": "cancelar_reporte_inline"
                                }
                            }
                        ]
                    }
                }
            ]
        },
        "additionalFields": {}
    },
    "type": "n8n-nodes-base.telegram",
    "typeVersion": 1.2,
    "position": [ 600, 400 ],
    "id": str(uuid.uuid4()),
    "name": "Solicitar nombre objeto",
    "credentials": {
        "telegramApi": { "id": "XaFnB0RjU5Z7dSO9", "name": "Telegram account" }
    }
}
data["nodes"].append(solicitar_nombre_node)

# Change connection of "Correcion"
if "Correcion" in data["connections"]:
    data["connections"]["Correcion"]["main"] = [[{"node": "Solicitar nombre objeto", "type": "main", "index": 0}]]

# Now, we need to handle when the user types text (the name of the object)
# The first switch handles text commands.
first_switch = None
for node in data["nodes"]:
    if node.get("type") == "n8n-nodes-base.switch" and node["name"] == "Switch":
        first_switch = node
        break

if first_switch:
    # Add a fallback connection for text messages
    # Index 5 is usually the fallback if there are 5 rules.
    # We will just add a Postgres node to check if state is 'esperando_nombre'
    check_estado_node = {
        "parameters": {
            "operation": "executeQuery",
            "query": "SELECT id FROM reportes WHERE chat_id = {{ $json.message.chat.id }} AND estado = 'esperando_nombre' LIMIT 1;",
            "options": {}
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [ 400, 200 ],
        "id": str(uuid.uuid4()),
        "name": "Check estado nombre",
        "credentials": {
            "postgres": { "id": "Pz7QzPz7Qz", "name": "Postgres account" }
        }
    }
    # copy credentials
    for n in data["nodes"]:
        if n.get("type") == "n8n-nodes-base.postgres" and "credentials" in n:
            check_estado_node["credentials"] = n["credentials"]
            break
            
    data["nodes"].append(check_estado_node)
    
    # We need an IF node to check if the query returned a row
    if_node = {
        "parameters": {
            "conditions": {
                "options": {
                    "caseSensitive": True,
                    "leftValue": "",
                    "typeValidation": "strict",
                    "version": 3
                },
                "conditions": [
                    {
                        "id": str(uuid.uuid4()),
                        "leftValue": "={{ $json.id }}",
                        "rightValue": "",
                        "operator": {
                            "type": "boolean",
                            "operation": "notEmpty",
                            "singleValue": True
                        }
                    }
                ],
                "combinator": "and"
            },
            "options": {}
        },
        "type": "n8n-nodes-base.if",
        "typeVersion": 3.2,
        "position": [ 600, 200 ],
        "id": str(uuid.uuid4()),
        "name": "If esperando nombre"
    }
    data["nodes"].append(if_node)
    
    # Update object name node
    update_nombre_node = {
        "parameters": {
            "operation": "executeQuery",
            "query": "UPDATE reportes SET clase_corregida = '{{ $(\"Telegram Trigger\").item.json.message.text }}', estado = 'pendiente_correccion', telegram_username = '{{ $(\"Telegram Trigger\").item.json.message.from.username || $(\"Telegram Trigger\").item.json.message.from.first_name }}' WHERE chat_id = {{ $(\"Telegram Trigger\").item.json.message.chat.id }} AND estado = 'esperando_nombre';",
            "options": {}
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [ 800, 200 ],
        "id": str(uuid.uuid4()),
        "name": "Update nombre objeto",
        "credentials": check_estado_node["credentials"]
    }
    data["nodes"].append(update_nombre_node)
    
    # Connect them
    if first_switch["name"] not in data["connections"]:
        data["connections"][first_switch["name"]] = {"main": []}
        
    rules_count = len(first_switch["parameters"]["rules"]["values"])
    # The default branch is after all rules
    while len(data["connections"][first_switch["name"]]["main"]) <= rules_count:
        data["connections"][first_switch["name"]]["main"].append([])
        
    # Assuming text fallbacks go to index `rules_count`
    data["connections"][first_switch["name"]]["main"][rules_count].append({
        "node": "Check estado nombre",
        "type": "main",
        "index": 0
    })
    
    data["connections"]["Check estado nombre"] = {"main": [[{"node": "If esperando nombre", "type": "main", "index": 0}]]}
    data["connections"]["If esperando nombre"] = {"main": [[{"node": "Update nombre objeto", "type": "main", "index": 0}]]}
    
    # After updating the name, we ask for the category ("solicitar clasificacion")
    data["connections"]["Update nombre objeto"] = {"main": [[{"node": "solicitar clasificacion", "type": "main", "index": 0}]]}

    # Also update "solicitar clasificacion" text
    for n in data["nodes"]:
        if n["name"] == "solicitar clasificacion":
            n["parameters"]["text"] = "Perfecto. Ahora, ¿qué es lo que aparece realmente en la foto?"

with open(FILE_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Patch applied successfully!")
