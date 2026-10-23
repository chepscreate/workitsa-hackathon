# -*- coding: utf-8 -*-
"""Seed realistic DEMO data into the live Workit project for the 30 Sep 2026
investor demo. Every doc carries demoSeed:true so cleanup_demo.py can remove it.
Auth: gcloud application-default / user token."""
import json, subprocess, urllib.request, urllib.parse, time, io
from PIL import Image, ImageDraw, ImageFont

PROJECT = "workit-6a927"
BUCKET  = "workit-6a927.firebasestorage.app"
DOCS = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
TOK = subprocess.check_output("gcloud auth print-access-token", shell=True, text=True).strip()
H = {"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"}
NOW = int(time.time() * 1000)
DAY = 86400000

def fv(v):
    if isinstance(v, bool): return {"booleanValue": v}
    if isinstance(v, int): return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue": v}
    if isinstance(v, str): return {"stringValue": v}
    if isinstance(v, list): return {"arrayValue": {"values": [fv(x) for x in v]}}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: fv(x) for k, x in v.items()}}}
    raise TypeError(str(type(v)))

def put(collection, docid, data):
    body = json.dumps({"fields": {k: fv(v) for k, v in data.items()}}).encode()
    req = urllib.request.Request(f"{DOCS}/{collection}/{docid}", data=body, headers=H, method="PATCH")
    r = json.load(urllib.request.urlopen(req))
    print("  +", collection + "/" + docid)
    return r

# ---------- 1. proof-of-work photo (stamped, matches the live feature) ----------
def make_proof_image():
    W, Hh = 1200, 900
    img = Image.new("RGB", (W, Hh), (70, 96, 58))       # sage/garden green
    d = ImageDraw.Draw(img)
    for y in range(Hh):                                  # soft vertical gradient
        t = y / Hh
        d.line([(0, y), (W, y)], fill=(int(70 + 40*t), int(96 + 50*t), int(58 + 30*t)))
    try:
        big = ImageFont.truetype("arialbd.ttf", 46); small = ImageFont.truetype("arial.ttf", 34)
    except Exception:
        big = ImageFont.load_default(); small = big
    d.text((60, 60), "Garden tidy-up — completed", font=big, fill=(250, 244, 236))
    d.text((60, 130), "Front lawn mowed, edges trimmed, beds cleared.", font=small, fill=(235, 238, 224))
    # burned-in Workit timestamp watermark (bottom-left), like PhotoUploader stamp
    label = "Workit · 27 Sep 2026, 10:14"
    barH = 64
    tw = d.textlength(label, font=small)
    d.rectangle([0, Hh - barH, int(tw) + 48, Hh], fill=(31, 22, 18))
    d.text((24, Hh - barH + 14), label, font=small, fill=(250, 244, 236))
    buf = io.BytesIO(); img.save(buf, "JPEG", quality=85)
    return buf.getvalue()

def upload(name, data, content_type="image/jpeg"):
    url = f"https://firebasestorage.googleapis.com/v0/b/{BUCKET}/o?uploadType=media&name={urllib.parse.quote(name, safe='')}"
    req = urllib.request.Request(url, data=data, headers={"Authorization": f"Bearer {TOK}", "Content-Type": content_type}, method="POST")
    r = json.load(urllib.request.urlopen(req))
    tok = (r.get("downloadTokens") or "").split(",")[0]
    return f"https://firebasestorage.googleapis.com/v0/b/{BUCKET}/o/{urllib.parse.quote(name, safe='')}?alt=media&token={tok}"

print("Uploading proof-of-work photo…")
proof_url = upload("demo/proof-garden.jpg", make_proof_image())
print("  proof url:", proof_url[:80], "…")

# ---------- 2. demo employer ----------
LAT, LNG = -26.1385, 27.9985   # Linden, Johannesburg
put("users", "demo_emp_nomvula", {
    "demoSeed": True, "displayName": "Nomvula Dlamini", "role": "employer",
    "accountStatus": "approved", "accountReviewedAt": NOW - 20*DAY,
    "email": "demo+nomvula@workitsa.co.za", "phone": "+27821112233",
    "province": "Gauteng", "city": "Johannesburg", "suburb": "Linden",
    "approxLat": -26.14, "approxLng": 28.00, "createdAt": NOW - 22*DAY,
    "phoneVerified": True, "termsAcceptedAt": NOW - 22*DAY,
})

# ---------- 3. demo workers (approved + verified) ----------
workers = [
    ("demo_wkr_sipho",  "Sipho Nkosi",   ["home-garden"], ["gardening", "lawn-mowing", "tree-pruning"],
     4.9, 23, 24, True,  "Reliable gardener, 6 years' experience. Lawns, hedges, clean-ups.", (-26.140, 27.996)),
    ("demo_wkr_thandi", "Thandi Mokoena", ["home-garden"], ["cleaning", "window-cleaning"],
     4.8, 15, 16, False, "Deep cleans, move-outs, offices. Bring my own supplies.", (-26.137, 28.001)),
    ("demo_wkr_johan",  "Johan Botha",   ["trades"], ["plumbing", "electrical"],
     4.7, 31, 33, True,  "Qualified plumber & handyman. Leaks, geysers, small electrical.", (-26.135, 27.994)),
    ("demo_wkr_lerato", "Lerato Dube",   ["tutoring-education"], ["maths-tutoring"],
     5.0, 9, 9, False,   "Maths & science tutor, Grades 8–12. Patient and results-driven.", (-26.142, 28.003)),
]
for uid, name, cats, skills, avg, rc, jc, gold, bio, (la, ln) in workers:
    put("users", uid, {
        "demoSeed": True, "displayName": name, "role": "worker",
        "accountStatus": "approved", "accountReviewedAt": NOW - 15*DAY,
        "verificationStatus": "approved", "backgroundVerified": gold,
        "categories": cats, "skills": skills, "bio": bio,
        "ratingAvg": avg, "ratingCount": rc, "jobsCompleted": jc,
        "province": "Gauteng", "city": "Johannesburg", "suburb": "Linden",
        "approxLat": round(la, 2), "approxLng": round(ln, 2),
        "phoneVerified": True, "createdAt": NOW - 18*DAY, "termsAcceptedAt": NOW - 18*DAY,
        "email": f"demo+{uid}@workitsa.co.za",
    })

# ---------- 4. open jobs (from the demo employer) ----------
def job(docid, title, desc, cat, sub, price, la, ln, age_days, extra=None):
    data = {
        "demoSeed": True, "employerId": "demo_emp_nomvula", "employerName": "Nomvula Dlamini",
        "title": title, "description": desc, "category": cat, "subcategory": sub,
        "suggestedPrice": price, "suburb": "Linden", "city": "Johannesburg", "province": "Gauteng",
        "lat": la, "lng": ln, "status": "open",
        "createdAt": NOW - age_days*DAY, "updatedAt": NOW - age_days*DAY,
        "workersNeeded": 1, "paymentMethod": "cash",
    }
    if extra: data.update(extra)
    put("jobs", docid, data)

job("demo_job_garden", "Front garden tidy-up & lawn", "Mow the lawn, trim edges and clear the flower beds. About half a day.", "home-garden", "gardening", 350, -26.139, 27.999, 1)
job("demo_job_plumb",  "Fix a leaking kitchen tap", "Kitchen mixer tap dripping constantly. Need it repaired or replaced today.", "trades", "plumbing", 450, -26.136, 27.997, 2, {"urgent": True})
job("demo_job_clean",  "Deep clean of a 2-bed flat", "Move-out deep clean — kitchen, 2 bathrooms, floors and windows.", "home-garden", "cleaning", 500, -26.141, 28.002, 3)
job("demo_job_tutor",  "Grade 10 maths tutor (weekly)", "Looking for a patient maths tutor, one afternoon a week in Linden.", "tutoring-education", "maths-tutoring", 250, -26.143, 28.004, 4)

# ---------- 5. one completed job -> proof-of-work + rating on Sipho's profile ----------
put("jobs", "demo_job_done", {
    "demoSeed": True, "employerId": "demo_emp_nomvula", "employerName": "Nomvula Dlamini",
    "title": "Garden clean-up & lawn mow", "description": "Overgrown front garden — mow, trim and clear.",
    "category": "home-garden", "subcategory": "gardening", "suggestedPrice": 350, "agreedPrice": 350,
    "suburb": "Linden", "city": "Johannesburg", "province": "Gauteng", "lat": -26.138, "lng": 27.998,
    "status": "confirmed", "workersNeeded": 1, "paymentMethod": "cash",
    "assignedWorkerId": "demo_wkr_sipho", "assignedWorkerName": "Sipho Nkosi",
    "completionPhotoURLs": [proof_url],
    "employerRating": {"stars": 5, "text": "Fantastic work — garden looks brand new. Highly recommend!", "at": NOW - 5*DAY},
    "workerRating": {"stars": 5, "text": "Great employer, clear instructions and paid on time.", "at": NOW - 5*DAY},
    "createdAt": NOW - 7*DAY, "assignedAt": NOW - 6*DAY, "completedAt": NOW - 5*DAY, "updatedAt": NOW - 5*DAY,
    "paymentPaidAt": NOW - 5*DAY, "paymentReceivedAt": NOW - 5*DAY, "paymentConfirmedAt": NOW - 5*DAY,
})

print("\nSEED COMPLETE. 1 employer, 4 workers, 4 open jobs, 1 completed job (with stamped proof photo).")
