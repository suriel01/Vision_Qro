import json

FILE_PATH = "/home/surielalcantara/Desktop/Vision_Qro/Enviar foto.json"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

# Update Switch node to have fallbackOutput: true
for node in data["nodes"]:
    if node["name"] == "Switch" and node["type"] == "n8n-nodes-base.switch":
        if "options" not in node["parameters"]:
            node["parameters"]["options"] = {}
        node["parameters"]["options"]["fallbackOutput"] = True

with open(FILE_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Fixed fallback branch for Switch node!")
