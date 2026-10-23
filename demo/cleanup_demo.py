# -*- coding: utf-8 -*-
"""Remove ALL demo data seeded by seed_demo.py (everything tagged demoSeed:true)
plus the demo proof photo in Storage. Run this AFTER the 30 Sep 2026 demo."""
import json, subprocess, urllib.request, urllib.parse

PROJECT = "workit-6a927"
BUCKET  = "workit-6a927.firebasestorage.app"
DOCS = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
TOK = subprocess.check_output("gcloud auth print-access-token", shell=True, text=True).strip()
H = {"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"}

def query_ids(collection):
    body = json.dumps({"structuredQuery": {
        "from": [{"collectionId": collection}],
        "where": {"fieldFilter": {"field": {"fieldPath": "demoSeed"}, "op": "EQUAL", "value": {"booleanValue": True}}},
    }}).encode()
    req = urllib.request.Request(f"{DOCS}:runQuery", data=body, headers=H, method="POST")
    out = []
    for row in json.load(urllib.request.urlopen(req)):
        if "document" in row:
            out.append(row["document"]["name"])   # full resource name
    return out

def query_offer_ids():
    # A collection-group query filtered on demoSeed needs a composite index, so
    # query ALL offers (allDescendants) with no filter and screen client-side.
    body = json.dumps({"structuredQuery": {
        "from": [{"collectionId": "offers", "allDescendants": True}],
    }}).encode()
    req = urllib.request.Request(f"{DOCS}:runQuery", data=body, headers=H, method="POST")
    out = []
    for row in json.load(urllib.request.urlopen(req)):
        d = row.get("document")
        if d and d.get("fields", {}).get("demoSeed", {}).get("booleanValue") is True:
            out.append(d["name"])
    return out

def delete(name):
    req = urllib.request.Request(f"https://firestore.googleapis.com/v1/{name}", headers=H, method="DELETE")
    urllib.request.urlopen(req); print("  -", name.split("/documents/")[-1])

n = 0
# Offers live in jobs/{id}/offers subcollections — deleting the parent job does
# NOT remove them, so sweep them first via a collection-group query.
for name in query_offer_ids():
    delete(name); n += 1
for col in ("jobs", "users"):
    for name in query_ids(col):
        delete(name); n += 1
# storage proof photo
try:
    obj = urllib.parse.quote("demo/proof-garden.jpg", safe="")
    req = urllib.request.Request(f"https://firebasestorage.googleapis.com/v0/b/{BUCKET}/o/{obj}", headers={"Authorization": f"Bearer {TOK}"}, method="DELETE")
    urllib.request.urlopen(req); print("  - storage: demo/proof-garden.jpg")
except Exception as e:
    print("  (storage delete skipped:", e, ")")
print(f"\nCLEANUP COMPLETE. Removed {n} Firestore docs + demo photo.")
