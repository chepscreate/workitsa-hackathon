# -*- coding: utf-8 -*-
"""Seed PLACEHOLDER verified worker profiles across Gauteng so the Workers
directory + 'Available now' look populated (demos / first impression).

Every doc carries demoSeed:true + placeholder:true so demo/cleanup_demo.py
removes it. Workers are approved + verification-approved (some Gold), spread
across the same areas as the placeholder jobs, with ratings, categories,
coords and a bio. About half are flagged availableNow (expires after ~8h —
re-run to refresh that flag for a live demo).

Run from repo root:  python demo/seed_placeholder_workers.py
Remove later with:   python demo/cleanup_demo.py
"""
import json, subprocess, urllib.request, time

PROJECT = "workit-6a927"
DOCS = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
TOK = subprocess.check_output("gcloud auth print-access-token", shell=True, text=True).strip()
H = {"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"}
NOW = int(time.time() * 1000)
DAY = 86_400_000

def fv(v):
    if isinstance(v, bool): return {"booleanValue": v}
    if isinstance(v, int): return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue": v}
    if isinstance(v, str): return {"stringValue": v}
    if isinstance(v, list): return {"arrayValue": {"values": [fv(x) for x in v]}}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: fv(x) for k, x in v.items()}}}
    raise TypeError(str(type(v)))

def put(docid, data):
    body = json.dumps({"fields": {k: fv(v) for k, v in data.items()}}).encode()
    req = urllib.request.Request(f"{DOCS}/users/{docid}", data=body, headers=H, method="PATCH")
    urllib.request.urlopen(req)
    print("  +", docid, "-", data["displayName"])

# (name, suburb, city, lat, lng, category, skills, ratingAvg, ratingCount, jobs, gold, availableNow, bio)
WORKERS = [
    ("Sipho Nkosi","Alberton","Johannesburg",-26.267,28.122,"home-garden",["gardening"],4.8,22,24,False,True,"Gardening, lawns and general outdoor work. Reliable and on time."),
    ("Thabo Mahlangu","Alberton","Johannesburg",-26.267,28.122,"trades",["plumbing"],4.7,31,33,True,False,"Qualified plumber & handyman. Leaks, geysers, drains."),
    ("Nomsa Dlamini","Soweto","Johannesburg",-26.268,27.858,"home-garden",["cleaning"],4.9,40,45,True,True,"House and office cleaning. Detailed and trustworthy."),
    ("Lerato Mokoena","Soweto","Johannesburg",-26.268,27.858,"beauty-wellness",[],5.0,15,16,False,False,"Mobile hairstylist — braids, styling, home visits."),
    ("Johan van Wyk","Roodepoort","Roodepoort",-26.162,27.872,"trades",["electrical"],4.6,18,19,True,True,"Qualified electrician. Fittings, DB boards, faults."),
    ("Precious Khumalo","Roodepoort","Roodepoort",-26.162,27.872,"home-garden",["window-cleaning"],4.8,12,13,False,False,"Window and general cleaning, inside and out."),
    ("Andile Zulu","Sandton","Sandton",-26.107,28.056,"driving-delivery",["delivery"],4.7,27,29,False,True,"Deliveries and collections with my own bakkie."),
    ("Karabo Mothibi","Fourways","Sandton",-26.017,28.010,"care",["elderly-care"],4.9,14,15,True,False,"Caring elderly companion, references available."),
    ("Simphiwe Ndlovu","Benoni","Benoni",-26.189,28.320,"trades",["painting"],4.5,20,22,False,True,"Interior and exterior painting, neat finishes."),
    ("Zanele Mbatha","Benoni","Benoni",-26.189,28.320,"home-garden",["cleaning"],4.8,33,36,True,True,"Reliable domestic & office cleaning."),
    ("Tebogo Sithole","Germiston","Germiston",-26.218,28.167,"driving-delivery",["car-wash"],4.6,10,11,False,False,"Mobile car wash and valet at your place."),
    ("Nandi Cele","Kempton Park","Kempton Park",-26.100,28.231,"tutoring-education",["school-subject"],4.9,8,8,False,True,"Primary & high school tutoring — Maths & English."),
    ("Bongani Mthembu","Katlehong","Germiston",-26.333,28.150,"home-garden",["gardening"],4.7,16,17,False,True,"Garden clean-ups, overgrowth and waste removal."),
    ("Ayanda Khoza","Tembisa","Kempton Park",-25.995,28.226,"driving-delivery",["food-delivery"],4.5,25,27,False,True,"Fast, friendly food and parcel delivery."),
    ("Dineo Mphela","Pretoria Central","Pretoria",-25.746,28.188,"home-garden",["cleaning"],4.8,19,20,True,False,"Deep cleans and move-outs, Pretoria area."),
    ("Pieter Botha","Centurion","Centurion",-25.858,28.188,"trades",["plumbing"],4.7,23,25,True,True,"Plumbing repairs and installs, qualified."),
    ("Lesego Molefe","Mamelodi","Pretoria",-25.705,28.385,"home-garden",["gardening"],4.6,14,15,False,False,"Lawn mowing and garden maintenance."),
    ("Refilwe Ngwenya","Hatfield","Pretoria",-25.748,28.238,"tutoring-education",["university"],4.9,11,11,False,True,"Accounting & stats tutoring for varsity students."),
    ("Kagiso Maluleke","Midrand","Midrand",-25.999,28.126,"driving-delivery",["delivery"],4.7,30,32,False,True,"Reliable courier, own transport, Midrand & north."),
    ("Palesa Tau","Vereeniging","Vereeniging",-26.673,27.932,"home-garden",["cleaning"],4.8,13,14,False,False,"Home cleaning in the Vaal, honest and thorough."),
    ("Mandla Sibeko","Vanderbijlpark","Vanderbijlpark",-26.708,27.838,"trades",["electrical"],4.6,17,18,True,True,"Electrical faults, geysers and compliance work."),
    ("Thandeka Zwane","Randburg","Sandton",-26.093,28.006,"events-catering",["chef"],4.9,9,10,False,False,"Private chef for dinners and functions."),
    ("Sibusiso Dube","Krugersdorp","Roodepoort",-26.085,27.775,"care",["frail-care"],4.8,12,13,True,True,"Frail-care assistant, day shifts, compassionate."),
    ("Naledi Pretorius","Honeydew","Roodepoort",-26.036,27.941,"driving-delivery",["pet-care"],5.0,7,7,False,True,"Dog walking and pet sitting, reliable and caring."),
]

count = 0
for i, (name, suburb, city, la, ln, cat, skills, avg, rc, jc, gold, avail, bio) in enumerate(WORKERS, 1):
    uid = f"demo_pw_{i:03d}"
    data = {
        "demoSeed": True, "placeholder": True,
        "displayName": name, "role": "worker",
        "accountStatus": "approved", "accountReviewedAt": NOW - 12 * DAY,
        "verificationStatus": "approved", "backgroundVerified": gold,
        "categories": [cat], "skills": skills, "bio": bio,
        "ratingAvg": avg, "ratingCount": rc, "jobsCompleted": jc,
        "province": "Gauteng", "city": city, "suburb": suburb,
        "approxLat": round(la, 2), "approxLng": round(ln, 2),
        "phoneVerified": True,
        "createdAt": NOW - 15 * DAY, "termsAcceptedAt": NOW - 15 * DAY,
        "profileCompletedAt": NOW - 15 * DAY,
        "email": f"demo+{uid}@workitsa.co.za",
    }
    if avail:
        data["availableNow"] = True
        data["availableNowAt"] = NOW  # expires ~8h later
    put(uid, data)
    count += 1

navail = sum(1 for w in WORKERS if w[11])
ngold = sum(1 for w in WORKERS if w[10])
print(f"\nSEEDED {count} placeholder workers ({ngold} Gold, {navail} available-now) across "
      f"{len(set(w[1] for w in WORKERS))} areas. demoSeed:true + placeholder:true.")
print("Note: 'available now' expires ~8h after seeding — re-run to refresh for a live demo.")
print("Remove with: python demo/cleanup_demo.py")
