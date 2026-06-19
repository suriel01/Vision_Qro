import json

FILE_PATH = "/home/surielalcantara/Desktop/Vision_Qro/Enviar foto.json"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

# Remove "If esperando nombre" from nodes
data["nodes"] = [n for n in data["nodes"] if n["name"] != "If esperando nombre"]

# Remove "If esperando nombre" from connections
if "If esperando nombre" in data["connections"]:
    del data["connections"]["If esperando nombre"]

# Connect "Check estado nombre" directly to "Update nombre objeto"
if "Check estado nombre" in data["connections"]:
    data["connections"]["Check estado nombre"]["main"] = [[{
        "node": "Update nombre objeto",
        "type": "main",
        "index": 0
    }]]

# Connect "Switch" directly to "Check estado nombre" (already done, but let's verify)
# (It's already in the JSON)

with open(FILE_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Fixed connections and removed IF node!")
