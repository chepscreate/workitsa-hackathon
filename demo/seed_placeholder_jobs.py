# -*- coding: utf-8 -*-
"""Seed PLACEHOLDER open jobs across many Gauteng areas + categories so the
find-work feed looks populated (demos, first-impression, hackathon).

Every doc carries demoSeed:true + placeholder:true so demo/cleanup_demo.py
removes it. Jobs are spread over ~20 areas and varied categories, priced
realistically, with recent (non-stale) createdAt and real coordinates so they
show on the map and in the list.

Auth: gcloud user token (gcloud auth login as tshepowayne2@gmail.com).
Run from repo root:  python demo/seed_placeholder_jobs.py
Remove later with:   python demo/cleanup_demo.py
"""
import json, subprocess, urllib.request, random, time

PROJECT = "workit-6a927"
DOCS = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
TOK = subprocess.check_output("gcloud auth print-access-token", shell=True, text=True).strip()
H = {"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"}
NOW = int(time.time() * 1000)
HOUR = 3600_000

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
    urllib.request.urlopen(req)
    print("  +", collection + "/" + docid)

# ---------- demo employers, one per region (demoSeed:true) ----------
EMPLOYERS = {
    "jhb":  ("demo_pe_jhb",  "Thandi's Home Services",  "Johannesburg", "Linden"),
    "sand": ("demo_pe_sand", "Sandton Lifestyle Co",    "Sandton",      "Sandton"),
    "west": ("demo_pe_west", "West Rand Home Help",      "Roodepoort",   "Roodepoort"),
    "east": ("demo_pe_east", "East Rand Facilities",     "Benoni",       "Benoni"),
    "pta":  ("demo_pe_pta",  "Pretoria Property Care",   "Pretoria",     "Pretoria Central"),
    "vaal": ("demo_pe_vaal", "Vaal Maintenance Co",      "Vereeniging",  "Vereeniging"),
}
for eid, name, city, suburb in EMPLOYERS.values():
    put("users", eid, {
        "demoSeed": True, "placeholder": True, "role": "employer",
        "displayName": name, "accountStatus": "approved",
        "province": "Gauteng", "city": city, "suburb": suburb,
        "createdAt": NOW - 20 * 24 * HOUR,
    })

# ---------- placeholder jobs: (region, suburb, city, lat, lng, category, sub, title, desc, price) ----------
JOBS = [
    ("jhb","Alberton","Johannesburg",-26.2672,28.1221,"home-garden","gardening","Garden tidy-up & lawn mow","Front and back lawn mowed, edges trimmed, beds weeded. Tools provided.",350),
    ("jhb","Alberton","Johannesburg",-26.2672,28.1221,"trades","plumbing","Fix a leaking kitchen tap","Mixer tap drips constantly — needs a washer/cartridge replaced.",450),
    ("jhb","Soweto","Johannesburg",-26.2678,27.8585,"home-garden","cleaning","Deep clean 2-bedroom house","Move-out deep clean: kitchen, bathroom, floors, windows inside.",550),
    ("jhb","Soweto","Johannesburg",-26.2678,27.8585,"driving-delivery","car-wash","Mobile car wash — 2 cars","Wash & vacuum two cars at home this weekend.",200),
    ("jhb","Linden","Johannesburg",-26.1380,27.9980,"home-garden","pool-care","Weekly pool cleaning","Clean pool, backwash, check chemicals. Ongoing weekly if good.",400),
    ("jhb","Melville","Johannesburg",-26.1760,27.9980,"tutoring-education","school-subject","Grade 10 Maths tutor","Twice a week, afternoons. Help with algebra & trig.",250),
    ("jhb","Roodepoort","Johannesburg",-26.1625,27.8723,"trades","painting","Paint a single bedroom","One bedroom, walls + ceiling. Paint supplied, bring your own brushes/rollers.",900),
    ("sand","Sandton","Sandton",-26.1070,28.0560,"home-garden","cleaning","Weekly flat cleaning","3 hours, once a week. Cleaning, laundry, ironing.",350),
    ("sand","Fourways","Sandton",-26.0170,28.0100,"driving-delivery","delivery","Collect & deliver furniture","Collect a couch in Fourways, deliver to Midrand. Need bakkie or help loading.",600),
    ("sand","Bryanston","Sandton",-26.0600,28.0170,"care","elderly-care","Elderly companion (weekdays)","Daytime company and light help for an elderly gentleman, Mon–Fri.",450),
    ("sand","Rivonia","Sandton",-26.0510,28.0620,"events-catering","chef","Chef for a dinner party (8)","Cook a 3-course dinner for 8 guests on Saturday evening.",1500),
    ("sand","Randburg","Sandton",-26.0940,28.0060,"beauty-wellness",None,"Mobile hairstylist for an event","Braids/styling for 3 people before a function, come to the house.",700),
    ("west","Roodepoort","Roodepoort",-26.1625,27.8723,"home-garden","gardening","Monthly garden service","Medium garden, lawn + hedges + general tidy, once a month.",400),
    ("west","Krugersdorp","Roodepoort",-26.0850,27.7750,"trades","electrical","Install 3 light fittings","Replace 3 ceiling lights with new fittings (supplied). Qualified only.",650),
    ("west","Honeydew","Roodepoort",-26.0360,27.9410,"driving-delivery","pet-care","Dog walking (2 dogs)","Walk two friendly dogs weekday mornings, about 40 min.",180),
    ("west","Florida","Roodepoort",-26.1760,27.9080,"home-garden","window-cleaning","Clean windows (double storey)","Inside + outside windows, double-storey house. Ladder available.",500),
    ("east","Benoni","Benoni",-26.1885,28.3200,"home-garden","cleaning","Office cleaning (small office)","Evening clean of a small office, 3x a week ongoing.",450),
    ("east","Boksburg","Boksburg",-26.2120,28.2590,"trades","plumbing","Unblock a drain","Outside drain blocked, water pooling. Need it cleared today if possible.",500),
    ("east","Germiston","Germiston",-26.2180,28.1670,"driving-delivery","delivery","Help move boxes (half day)","2 people to help load and move boxes to a new flat. Half day.",400),
    ("east","Kempton Park","Kempton Park",-26.1000,28.2310,"events-catering","cleanup","Post-party cleanup","Clean up after a birthday party on Sunday morning.",300),
    ("east","Tembisa","Kempton Park",-25.9950,28.2260,"tutoring-education","school-subject","Primary school homework help","Help two kids with homework after school, Mon–Thu.",200),
    ("east","Katlehong","Germiston",-26.3330,28.1500,"home-garden","gardening","Clear an overgrown yard","Cut back overgrowth, remove garden waste. Bring your own tools if possible.",450),
    ("east","Boksburg","Boksburg",-26.2120,28.2590,"driving-delivery","car-wash","Car wash & valet","Full wash, interior vacuum and polish for one car.",250),
    ("pta","Pretoria Central","Pretoria",-25.7460,28.1880,"home-garden","cleaning","Once-off apartment clean","2-bed apartment, standard clean before guests arrive.",400),
    ("pta","Centurion","Centurion",-25.8580,28.1880,"trades","painting","Paint garden wall & gate","Exterior wall and steel gate, one coat. Paint supplied.",1200),
    ("pta","Mamelodi","Pretoria",-25.7050,28.3850,"home-garden","gardening","Lawn mowing (big yard)","Large yard needs mowing and edges done. Mower available.",350),
    ("pta","Hatfield","Pretoria",-25.7480,28.2380,"tutoring-education","university","1st-year Accounting tutor","Weekly sessions to prep for exams. Varsity student welcome.",300),
    ("pta","Centurion","Centurion",-25.8580,28.1880,"care","elderly-care","Weekend caregiver","Saturday & Sunday care and company for an elderly lady.",500),
    ("pta","Midrand","Midrand",-25.9990,28.1260,"driving-delivery","delivery","Parcel collection & drop-off","Collect a parcel in Midrand and drop in Centurion. Own transport.",250),
    ("pta","Midrand","Midrand",-25.9990,28.1260,"trades","electrical","Fix a tripping DB board","Power keeps tripping — need a qualified electrician to diagnose.",800),
    ("vaal","Vereeniging","Vereeniging",-26.6731,27.9319,"home-garden","gardening","General garden clean-up","Weeding, pruning and lawn for a medium garden.",300),
    ("vaal","Vanderbijlpark","Vanderbijlpark",-26.7080,27.8380,"home-garden","cleaning","House clean (3-bed)","Standard clean of a 3-bedroom house, every two weeks.",450),
    ("vaal","Sebokeng","Vereeniging",-26.5750,27.8470,"driving-delivery","delivery","Furniture delivery help","Help deliver and carry a fridge and bed up one flight of stairs.",400),
    ("vaal","Vereeniging","Vereeniging",-26.6731,27.9319,"trades","plumbing","Replace a geyser element","Geyser not heating — replace element and thermostat. Qualified only.",700),
    ("jhb","Alberton","Johannesburg",-26.2672,28.1221,"care","frail-care","Day frail-care assistant","Assist with daily care for a bedridden family member, weekdays.",550),
    ("sand","Midrand","Midrand",-25.9990,28.1260,"events-catering","chef","Braai master for a function","Run the braai for a 20-person family function on Saturday.",900),
    ("west","Roodepoort","Roodepoort",-26.1625,27.8723,"beauty-wellness",None,"Nail tech for a home session","Gel manicures for 2 people at home on Friday.",350),
    ("east","Benoni","Benoni",-26.1885,28.3200,"tutoring-education","language","isiZulu language lessons","Beginner isiZulu, one hour a week, in person.",250),
    ("pta","Pretoria Central","Pretoria",-25.7460,28.1880,"driving-delivery","car-wash","Taxi fleet wash (3 vehicles)","Wash 3 vehicles early morning before shifts. Could be weekly.",450),
    ("jhb","Sandton","Sandton",-26.1070,28.0560,"home-garden","pool-care","Pool green-to-clean","Pool has gone green — needs a full recovery clean and chemicals.",650),
]

random.seed(7)
count = 0
for i, (region, suburb, city, la, ln, cat, sub, title, desc, price) in enumerate(JOBS, 1):
    eid, ename, _, _ = EMPLOYERS[region]
    created = NOW - random.randint(1, 72) * HOUR  # 1–72h ago (recent, not stale)
    data = {
        "demoSeed": True, "placeholder": True,
        "employerId": eid, "employerName": ename,
        "title": title, "description": desc,
        "category": cat,
        "suggestedPrice": price,
        "suburb": suburb, "city": city, "province": "Gauteng",
        "lat": la, "lng": ln,
        "status": "open", "workersNeeded": 1,
        "paymentMethod": random.choice(["cash", "eft"]),
        "offerCount": 0,
        "createdAt": created, "updatedAt": created,
    }
    if sub:
        data["subcategory"] = sub
    put("jobs", f"demo_pj_{i:03d}", data)
    count += 1

print(f"\nSEEDED {count} placeholder jobs across {len(set(j[1] for j in JOBS))} areas + {len(EMPLOYERS)} demo employers.")
print("All tagged demoSeed:true + placeholder:true. Remove with: python demo/cleanup_demo.py")
