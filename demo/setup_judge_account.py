# -*- coding: utf-8 -*-
"""FNB Hackathon 2026 — demo setup.

Two jobs:
  1. promote_judge(UID)  — turns a real signed-up account into an approved,
     ID-verified WORKER in Alberton so judges can log in and explore without
     hitting the verification gate. (The account must already exist — the
     founder creates it via email+password signup; we can't set passwords.)
  2. seed_whatsapp_worker() — creates a Firestore-only verified worker on the
     demo WhatsApp line (+27 67 748 2643) so the live WhatsApp demo + video
     work. No Auth user needed: the WhatsApp channel matches on the Firestore
     user doc (phone + role + whatsappOptIn).

Everything is tagged demoSeed:true so demo/cleanup_demo.py removes it afterwards.

Usage (from repo root, after `gcloud auth login` as tshepowayne2@gmail.com):
    python demo/setup_judge_account.py --uid <JUDGE_ACCOUNT_UID>
    python demo/setup_judge_account.py --wa-only          # just the WhatsApp worker
"""
import argparse, json, subprocess, time, urllib.request

PROJECT = "workit-6a927"
DOCS = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
TOK = subprocess.check_output("gcloud auth print-access-token", shell=True, text=True).strip()
H = {"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"}
NOW = int(time.time() * 1000)

# Alberton, Gauteng
LAT, LNG = -26.2672, 28.1221
WA_WORKER_PHONE = "+27677482643"   # demo worker line (texts JOBS in the demo)


def fv(v):
    if isinstance(v, bool): return {"booleanValue": v}
    if isinstance(v, int): return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue": v}
    if isinstance(v, str): return {"stringValue": v}
    if isinstance(v, list): return {"arrayValue": {"values": [fv(x) for x in v]}}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: fv(x) for k, x in v.items()}}}
    raise TypeError(str(type(v)))


def patch(path, data, mask_fields):
    """Merge-update specific fields on an existing doc (updateMask keeps the rest)."""
    qs = "&".join(f"updateMask.fieldPaths={f}" for f in mask_fields)
    url = f"{DOCS}/{path}?{qs}"
    body = json.dumps({"fields": {k: fv(v) for k, v in data.items()}}).encode()
    req = urllib.request.Request(url, data=body, headers=H, method="PATCH")
    json.load(urllib.request.urlopen(req))
    print("  ~ updated", path, "fields:", ", ".join(mask_fields))


def put(path, data):
    """Create/replace a whole doc (used for the Firestore-only WhatsApp worker)."""
    url = f"{DOCS}/{path}"
    body = json.dumps({"fields": {k: fv(v) for k, v in data.items()}}).encode()
    req = urllib.request.Request(url, data=body, headers=H, method="PATCH")
    json.load(urllib.request.urlopen(req))
    print("  + wrote", path)


def promote_judge(uid):
    """Flip an existing account to an approved, verified Alberton worker."""
    fields = {
        "role": "worker",
        "accountStatus": "approved",
        "verificationStatus": "approved",
        "backgroundVerified": True,
        "phoneVerified": True,
        "city": "Alberton",
        "province": "Gauteng",
        "approxLat": LAT,
        "approxLng": LNG,
        "categories": [],  # open to all so judges see every seeded job
        "demoSeed": True,
        # setting verification.submittedAt stops AccountGate redirecting to
        # /verification (the "complete your submission" loop).
        "verification": {
            "submittedAt": NOW,
            "reviewedAt": NOW,
            "idCheckVerdict": "pass",
            "reviewerNote": "FNB Hackathon demo / judge account",
            "consentAt": NOW,
            "consentVersion": "v1",
        },
    }
    mask = ["role", "accountStatus", "verificationStatus", "backgroundVerified",
            "phoneVerified", "city", "province", "approxLat", "approxLng",
            "categories", "demoSeed", "verification"]
    print(f"Promoting judge account users/{uid} ...")
    patch(f"users/{uid}", fields, mask)
    print("Done. Judge can now log in and explore without the verification gate.")


def seed_whatsapp_worker():
    """A verified worker on the demo WhatsApp line, opted in to alerts."""
    doc_id = "demo_wa_worker"
    fields = {
        "uid": doc_id,
        "role": "worker",
        "displayName": "Thabo (WhatsApp demo)",
        "accountStatus": "approved",
        "verificationStatus": "approved",
        "backgroundVerified": True,
        "phone": WA_WORKER_PHONE,
        "phoneVerified": True,
        "city": "Alberton",
        "province": "Gauteng",
        "approxLat": LAT,
        "approxLng": LNG,
        "categories": [],
        "whatsappOptIn": True,
        "whatsappOptInAt": NOW,
        "whatsappConsentVersion": "wa-v1",
        "demoSeed": True,
        "createdAt": NOW,
    }
    print(f"Seeding WhatsApp demo worker users/{doc_id} ({WA_WORKER_PHONE}) ...")
    put(f"users/{doc_id}", fields)
    print("Done. Text JOBS from", WA_WORKER_PHONE, "to the business line to demo.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--uid", help="UID of the judge account (from /admin or Firebase Auth)")
    ap.add_argument("--wa-only", action="store_true", help="only seed the WhatsApp worker")
    args = ap.parse_args()
    if not args.wa_only:
        if not args.uid:
            ap.error("pass --uid <judge account UID>, or --wa-only")
        promote_judge(args.uid)
    seed_whatsapp_worker()
