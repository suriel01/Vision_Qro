"""Build a binary pothole / no-pothole image-classification dataset from RDD2022 (CC BY 4.0).

Layout produced (Ultralytics classification format):
  OUT/train/{bache,no_bache}/*.jpg   OUT/val/{bache,no_bache}/*.jpg   OUT/manifest.csv
"""
import collections, csv, io, os, random, re, shutil, zipfile

BASE = os.path.expanduser("~/datasets")
SRC = os.path.join(BASE, "rdd2022", "RDD2022.zip")
RAW = os.path.join(BASE, "rdd2022", "raw")
OUT = os.path.join(BASE, "vision_qro_bache")
COUNTRIES = ["India", "Japan", "Czech", "China_MotorBike", "United_States"]
NEG_PER_POS = 2.0      # at most 2 negatives per positive image, per country
VAL_FRACTION = 0.15
MAX_SIDE = 640
RX = re.compile(rb"<name>\s*([A-Za-z0-9]+)\s*</name>")  # regex only: never run an XML parser on untrusted files
random.seed(42)

try:
    from PIL import Image
    HAVE_PIL = True
except Exception:
    HAVE_PIL = False
print("PIL available (resize to %d px):" % MAX_SIDE, HAVE_PIL, flush=True)

if os.path.exists(OUT):
    raise SystemExit(f"{OUT} already exists; refusing to overwrite")
os.makedirs(RAW, exist_ok=True)
for split in ("train", "val"):
    for cls in ("bache", "no_bache"):
        os.makedirs(os.path.join(OUT, split, cls))

outer = zipfile.ZipFile(SRC)
rows, summary = [], collections.defaultdict(collections.Counter)

for country in COUNTRIES:
    member = f"RDD2022/{country}.zip"
    outer.extract(member, RAW)                      # ZipFile.extract sanitizes paths
    inner_path = os.path.join(RAW, member)
    inner = zipfile.ZipFile(inner_path)
    names = inner.namelist()
    imgs = {}
    for n in names:
        if "/train/images/" in n and n.lower().endswith((".jpg", ".jpeg", ".png")):
            imgs[os.path.splitext(os.path.basename(n))[0]] = n
    pos, clean, other = [], [], []
    for n in names:
        if "/train/annotations/xmls/" in n and n.endswith(".xml"):
            stem = os.path.splitext(os.path.basename(n))[0]
            if stem not in imgs:
                continue
            cls = set(RX.findall(inner.read(n)))
            (pos if b"D40" in cls else (other if cls else clean)).append(stem)
    n_neg = int(min(len(pos) * NEG_PER_POS, len(clean) + len(other)))
    half = n_neg // 2
    take_clean = min(half, len(clean))
    take_other = min(n_neg - take_clean, len(other))
    take_clean = min(n_neg - take_other, len(clean))
    random.shuffle(clean); random.shuffle(other)
    neg = [(s, "clean") for s in clean[:take_clean]] + [(s, "other_damage") for s in other[:take_other]]
    chosen = [(s, "bache", "pothole") for s in pos] + [(s, "no_bache", k) for s, k in neg]
    by_cls = collections.defaultdict(list)
    for item in chosen:
        by_cls[item[1]].append(item)
    for cls, items in by_cls.items():
        items.sort(key=lambda t: t[0])              # consecutive frames stay together
        cut = int(len(items) * (1 - VAL_FRACTION))
        for i, (stem, c, kind) in enumerate(items):
            split = "train" if i < cut else "val"
            data = inner.read(imgs[stem])
            dest = os.path.join(OUT, split, c, f"{country}_{stem}.jpg")
            if HAVE_PIL:
                im = Image.open(io.BytesIO(data)).convert("RGB")
                im.thumbnail((MAX_SIDE, MAX_SIDE))
                im.save(dest, "JPEG", quality=90)
            else:
                open(dest, "wb").write(data)
            rows.append([os.path.relpath(dest, OUT), split, c, country, kind, imgs[stem]])
            summary[country][(split, c)] += 1
    inner.close()
    os.remove(inner_path)                           # keep only the original archive as the source
    print(f"{country:16s} pos={len(pos):5d} clean={len(clean):5d} other_damage={len(other):5d} "
          f"-> used pos={len(pos)} neg={len(neg)}", flush=True)

with open(os.path.join(OUT, "manifest.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["file", "split", "class", "country", "negative_kind", "source_path_in_rdd2022"])
    w.writerows(rows)

print("\nFinal counts:")
tot = collections.Counter()
for country, c in summary.items():
    for k, v in c.items():
        tot[k] += v
for k in sorted(tot):
    print(f"  {k[0]:5s} {k[1]:9s} {tot[k]:6d}")
shutil.rmtree(RAW, ignore_errors=True)
print("done")
