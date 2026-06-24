import json

FILE_PATH = "/home/surielalcantara/Desktop/Vision_Qro/Enviar foto.json"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

# Re-link Switch to "Check estado nombre"
for node in data["nodes"]:
    if node["name"] == "Switch" and node["type"] == "n8n-nodes-base.switch":
        rules = node["parameters"]["rules"]["values"]
        rules_count = len(rules)
        
        # Ensure fallbackOutput is True
        if "options" not in node["parameters"]:
            node["parameters"]["options"] = {}
        node["parameters"]["options"]["fallbackOutput"] = True
        
        # Now update connections
        if "Switch" in data["connections"]:
            main_conns = data["connections"]["Switch"]["main"]
            # ensure enough arrays
            while len(main_conns) <= rules_count:
                main_conns.append([])
            
            # Remove "Check estado nombre" from any index it might be at
            for idx, conns in enumerate(main_conns):
                main_conns[idx] = [c for c in conns if c["node"] != "Check estado nombre"]
                
            # Add it to the fallback index (which is rules_count)
            main_conns[rules_count].append({
                "node": "Check estado nombre",
                "type": "main",
                "index": 0
            })
            data["connections"]["Switch"]["main"] = main_conns

with open(FILE_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Re-linked properly.")
