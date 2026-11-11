import json
import uuid

FILE_PATH = "/home/jetson/Vision_Qro/n8n/Telegram_n8n.json"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

# Find Switch1 node
switch_node = None
for node in data["nodes"]:
    if node.get("type") == "n8n-nodes-base.switch" and node.get("name") == "Switch1":
        switch_node = node
        break

if switch_node:
    rules = switch_node["parameters"]["rules"]["values"]
    
    # Check if mat_bolsa is already there
    exists = False
    for r in rules:
        for c in r.get("conditions", {}).get("conditions", []):
            if c.get("rightValue") == "mat_bolsa":
                exists = True
                break
                
    if not exists:
        # Find index of mat_otro to insert right after
        insert_idx = len(rules)
        for i, r in enumerate(rules):
            for c in r.get("conditions", {}).get("conditions", []):
                if c.get("rightValue") == "mat_otro":
                    insert_idx = i + 1
                    break

        new_rule = {
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
                        "rightValue": "mat_bolsa",
                        "operator": {
                            "type": "string",
                            "operation": "equals",
                            "name": "filter.operator.equals"
                        }
                    }
                ],
                "combinator": "and"
            }
        }
        
        rules.insert(insert_idx, new_rule)
        print(f"Added mat_bolsa rule at index {insert_idx}")
        
        # Now update connections
        # The connection for mat_otro is at index `insert_idx - 1` (since we inserted after it)
        # We need to insert a connection at `insert_idx` for mat_bolsa.
        # It should go to "Correcion1"
        
        if "Switch1" in data["connections"]:
            conns = data["connections"]["Switch1"]["main"]
            # Insert a new output array at insert_idx
            conns.insert(insert_idx, [{
                "node": "Correcion1",
                "type": "main",
                "index": 0
            }])
            print(f"Added connection to Correcion1 at index {insert_idx}")

with open(FILE_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
