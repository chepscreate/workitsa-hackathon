"""Render faithful Workit UI mockups (phone + desktop) as PNGs for the deck.
Uses the real Workit brand palette. Pillow only — no browser needed."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), "assets")
os.makedirs(OUT, exist_ok=True)
S = 2  # supersample factor for crispness

# ---- Workit palette (from the codebase) ----
CREAM   = "#FAF4EC"
CREAM2  = "#F1E7D6"
PAPER   = "#FFFDF9"
INK     = "#1F1612"
INKSOFT = "#4A3A30"
INKMUT  = "#8A7868"
OCHRE   = "#D97742"
OCHRE6  = "#B85A2A"
OCHRE50 = "#FBEEE2"
SAGE    = "#5D7A47"
SAGE7   = "#46603A"
SAGE100 = "#E7EEDF"
LINE    = "#E7DCC8"
BRICK   = "#A93226"
BRICKBG = "#F6E3DF"
WHITE   = "#FFFFFF"

def font(name, size, bold=False):
    candidates = []
    if name == "serif":
        candidates = ["georgiab.ttf"] if bold else ["georgia.ttf"]
        candidates += ["timesbd.ttf"] if bold else ["times.ttf"]
    else:
        candidates = (["segoeuib.ttf", "arialbd.ttf"] if bold
                      else ["segoeui.ttf", "arial.ttf"])
    for c in candidates:
        try:
            return ImageFont.truetype(c, size * S)
        except Exception:
            continue
    return ImageFont.load_default()

def canvas(w, h, bg=CREAM):
    img = Image.new("RGB", (w * S, h * S), bg)
    return img, ImageDraw.Draw(img)

def rr(d, box, radius, fill=None, outline=None, width=1):
    box = [b * S for b in box]
    d.rounded_rectangle(box, radius=radius * S, fill=fill, outline=outline,
                        width=width * S)

def text(d, xy, s, fnt, fill=INK, anchor="la"):
    d.text((xy[0] * S, xy[1] * S), s, font=fnt, fill=fill, anchor=anchor)

def pill(d, x, y, label, fnt, fill, fg, padx=10, h=22):
    w = d.textlength(label, font=fnt) / S + padx * 2
    rr(d, [x, y, x + w, y + h], h / 2, fill=fill)
    text(d, [x + w / 2, y + h / 2], label, fnt, fill=fg, anchor="mm")
    return w

def star(d, cx, cy, r, fill):
    import math
    pts = []
    for i in range(10):
        ang = -math.pi/2 + i * math.pi/5
        rad = r if i % 2 == 0 else r * 0.45
        pts.append(((cx + rad*math.cos(ang)) * S, (cy + rad*math.sin(ang)) * S))
    d.polygon(pts, fill=fill)

def save(img, name):
    img = img.resize((img.width // S, img.height // S), Image.LANCZOS)
    p = os.path.join(OUT, name)
    img.save(p, "PNG")
    print("wrote", p)

# ============ PHONE FRAME ============
PW, PH = 360, 740  # screen content size

def phone():
    fw, fh = PW + 28, PH + 28
    img, d = canvas(fw, fh, "#241C16")
    rr(d, [0, 0, fw, fh], 46, fill="#241C16")
    rr(d, [14, 14, 14 + PW, 14 + PH], 34, fill=CREAM)
    # notch
    rr(d, [fw/2 - 38, 20, fw/2 + 38, 32], 6, fill="#241C16")
    return img, d, 14, 14  # offset x,y of screen

def status_bar(d, ox, oy):
    f = font("sans", 10, bold=True)
    text(d, [ox + 16, oy + 20], "9:41", f, fill=INK)
    text(d, [ox + PW - 16, oy + 20], "5G  100%", f, fill=INKSOFT, anchor="ra")

# ---------- 1. HOME / DASHBOARD ----------
def home():
    img, d, ox, oy = phone()
    status_bar(d, ox, oy)
    y = oy + 40
    # header
    rr(d, [ox, y, ox + PW, y + 38], 0, fill=CREAM)
    text(d, [ox + 16, y + 19], "Workit", font("serif", 18, bold=True), fill=OCHRE6, anchor="lm")
    rr(d, [ox + PW - 44, y + 8, ox + PW - 16, y + 30], 11, fill=OCHRE)
    text(d, [ox + PW - 30, y + 19], "TM", font("sans", 9, bold=True), fill=WHITE, anchor="mm")
    y += 50
    # greeting
    rr(d, [ox + 16, y, ox + 52, y + 36], 18, fill=SAGE)
    text(d, [ox + 34, y + 18], "TM", font("sans", 13, bold=True), fill=WHITE, anchor="mm")
    text(d, [ox + 60, y + 8], "Good morning,", font("sans", 10), fill=INKMUT)
    text(d, [ox + 60, y + 20], "Tshepo.", font("serif", 16, bold=True), fill=INK)
    pill(d, ox + 60, y + 40, "Employer", font("sans", 9, bold=True), OCHRE50, OCHRE6)
    y += 70
    # primary CTA card
    rr(d, [ox + 16, y, ox + PW - 16, y + 96], 16, fill=OCHRE)
    text(d, [ox + 30, y + 20], "Need something done today?", font("serif", 14, bold=True), fill=WHITE)
    text(d, [ox + 30, y + 42], "Post a job in under a minute —", font("sans", 9.5), fill="#FCEbE0")
    text(d, [ox + 30, y + 55], "workers nearby respond with offers.", font("sans", 9.5), fill="#FCEbE0")
    rr(d, [ox + 30, y + 68, ox + 110, y + 88], 10, fill=INK)
    text(d, [ox + 70, y + 78], "Post a job", font("sans", 9.5, bold=True), fill=CREAM, anchor="mm")
    y += 110
    # stats row
    labels = [("Rating", "4.9"), ("Jobs", "23"), ("Done", "19"), ("Stars", None)]
    cw = (PW - 32 - 18) / 4
    for i, (lab, val) in enumerate(labels):
        x = ox + 16 + i * (cw + 6)
        rr(d, [x, y, x + cw, y + 54], 12, fill=PAPER, outline=LINE, width=1)
        text(d, [x + cw/2, y + 16], lab.upper(), font("sans", 7, bold=True), fill=INKMUT, anchor="mm")
        if val is None:
            for s in range(5):
                star(d, x + cw/2 - 16 + s * 8, y + 36, 3.4, OCHRE)
        else:
            text(d, [x + cw/2, y + 36], val, font("serif", 13, bold=True),
                 fill=OCHRE6 if i==0 else INK, anchor="mm")
    y += 70
    # active job strip
    text(d, [ox + 16, y], "Your active job", font("serif", 14, bold=True), fill=INK)
    y += 24
    rr(d, [ox + 16, y, ox + PW - 16, y + 92], 14, fill=PAPER, outline=LINE, width=1)
    rr(d, [ox + 30, y + 16, ox + 62, y + 48], 16, fill=OCHRE)
    text(d, [ox + 46, y + 32], "SM", font("sans", 11, bold=True), fill=WHITE, anchor="mm")
    pill(d, ox + 70, y + 14, "● On the way", font("sans", 8, bold=True), SAGE100, SAGE7)
    text(d, [ox + 70, y + 36], "Cut lawn & trim hedges", font("serif", 12, bold=True), fill=INK)
    text(d, [ox + 70, y + 52], "Sipho M. · Linden, JHB", font("sans", 9), fill=INKMUT)
    # beadwork divider
    bw = ["#D97742", "#1F1612", "#5D7A47", "#FAF4EC"]
    bx = ox + 16
    seg = 0
    while bx < ox + PW - 16:
        d.rectangle([bx*S, (y+72)*S, min((bx+10), ox+PW-16)*S, (y+76)*S], fill=bw[seg % 4]); bx += 10; seg += 1
    text(d, [ox + 30, y + 84], "📍 Linden, Johannesburg", font("sans", 8.5), fill=INKMUT, anchor="lm")
    text(d, [ox + PW - 30, y + 84], "R 350", font("serif", 12, bold=True), fill=OCHRE6, anchor="rm")
    # bottom nav
    ny = oy + PH - 44
    rr(d, [ox, ny, ox + PW, oy + PH], 0, fill=PAPER)
    d.line([ox*S, ny*S, (ox+PW)*S, ny*S], fill=LINE, width=1*S)
    navs = [("Home", True), ("Find work", False), ("Post", False), ("Me", False)]
    nw = PW / 4
    for i, (lab, act) in enumerate(navs):
        cx = ox + nw * i + nw/2
        col = OCHRE6 if act else INKMUT
        if lab == "Me":
            rr(d, [cx-9, ny+8, cx+9, ny+26], 9, fill=SAGE)
            text(d, [cx, ny+17], "TM", font("sans", 7, bold=True), fill=WHITE, anchor="mm")
        else:
            d.ellipse([(cx-7)*S, (ny+9)*S, (cx+7)*S, (ny+23)*S], outline=col, width=2*S)
        text(d, [cx, ny + 34], lab, font("sans", 7, bold=True), fill=col, anchor="mm")
    save(img, "screen_home.png")

# ---------- 2. FIND WORK ----------
def findwork():
    img, d, ox, oy = phone()
    status_bar(d, ox, oy)
    y = oy + 42
    pill(d, ox + 16, y, "Find work", font("sans", 9, bold=True), SAGE100, SAGE7)
    y += 30
    text(d, [ox + 16, y], "Jobs open near you.", font("serif", 19, bold=True), fill=INK)
    y += 34
    # search
    rr(d, [ox + 16, y, ox + PW - 16, y + 30], 15, fill=PAPER, outline=LINE, width=1)
    text(d, [ox + 28, y + 15], "🔍  Search — lawn, leaking tap…", font("sans", 9.5), fill=INKMUT, anchor="lm")
    y += 40
    # category chips
    chips = [("All", True), ("Home & garden", False), ("Trades", False)]
    cx = ox + 16
    for lab, act in chips:
        w = pill(d, cx, y, lab, font("sans", 9, bold=act),
                 INK if act else PAPER, CREAM if act else INKSOFT)
        if not act:
            rr(d, [cx, y, cx + w, y + 22], 11, outline=LINE, width=1)
            text(d, [cx + w/2, y + 11], lab, font("sans", 9), fill=INKSOFT, anchor="mm")
        cx += w + 6
    y += 32
    # saved search row
    text(d, [ox + 16, y], "SAVED SEARCHES", font("sans", 7.5, bold=True), fill=INKMUT)
    y += 16
    pill(d, ox + 16, y, "Home & garden · ≤5km", font("sans", 8, bold=True), CREAM2, INKSOFT)
    y += 30
    # job cards
    jobs = [
        ("Urgent", BRICK, BRICKBG, "Cut lawn and trim hedges", "📍 1.2 km away · Linden", "R 350", "2 workers offered"),
        (None, None, None, "Fix leaking kitchen tap", "📍 3.4 km away · Greenside", "R 500", "1 worker offered"),
        ("Crew · 1/3", SAGE7, SAGE100, "Help move 2-bed flat", "📍 5.0 km away · Randburg", "R 800", "Crew job"),
    ]
    for tag, tcol, tbg, title, loc, price, foot in jobs:
        rr(d, [ox + 16, y, ox + PW - 16, y + 96], 14, fill=PAPER, outline=LINE, width=1)
        cxx = ox + 28
        if tag:
            w = pill(d, cxx, y + 12, tag, font("sans", 8, bold=True), tbg, tcol); cxx += w + 6
        w = pill(d, cxx, y + 12, "Skilled trades" if "tap" in title else "Home & garden",
                 font("sans", 8, bold=True), OCHRE50, OCHRE6)
        text(d, [ox + 28, y + 42], title, font("serif", 13, bold=True), fill=INK)
        text(d, [ox + 28, y + 60], loc, font("sans", 8.5), fill=SAGE7)
        d.line([(ox+28)*S, (y+72)*S, (ox+PW-28)*S, (y+72)*S], fill=LINE, width=1*S)
        text(d, [ox + 28, y + 84], foot, font("sans", 8), fill=INKMUT, anchor="lm")
        text(d, [ox + PW - 28, y + 84], price, font("serif", 13, bold=True), fill=OCHRE6, anchor="rm")
        y += 106
    save(img, "screen_findwork.png")

# ---------- 3. POST A JOB ----------
def postjob():
    img, d, ox, oy = phone()
    status_bar(d, ox, oy)
    y = oy + 42
    text(d, [ox + 16, y], "← Back to dashboard", font("sans", 9), fill=INKMUT)
    y += 22
    text(d, [ox + 16, y], "Post a job.", font("serif", 20, bold=True), fill=INK)
    y += 32
    # form fields
    def field(lab, val, yy, h=30):
        text(d, [ox + 16, yy], lab, font("sans", 8.5, bold=True), fill=INKSOFT)
        rr(d, [ox + 16, yy + 14, ox + PW - 16, yy + 14 + h], 14, fill=PAPER, outline=LINE, width=1)
        text(d, [ox + 28, yy + 14 + h/2], val, font("sans", 10), fill=INK, anchor="lm")
        return yy + 14 + h + 12
    y = field("Job title", "Cut lawn and trim hedges", y)
    y = field("Category", "Home & garden  ▾", y)
    # description
    text(d, [ox + 16, y], "Describe the work", font("sans", 8.5, bold=True), fill=INKSOFT)
    rr(d, [ox + 16, y + 14, ox + PW - 16, y + 70], 14, fill=PAPER, outline=LINE, width=1)
    text(d, [ox + 28, y + 28], "Medium yard, front + back.", font("sans", 9.5), fill=INK)
    text(d, [ox + 28, y + 44], "Bring your own mower please.", font("sans", 9.5), fill=INK)
    y += 82
    y = field("Suggested price (R)", "350", y)
    # payment + crew row
    text(d, [ox + 16, y], "Payment", font("sans", 8.5, bold=True), fill=INKSOFT)
    rr(d, [ox + 16, y + 14, ox + 100, y + 40], 13, fill=OCHRE50, outline=OCHRE, width=1)
    text(d, [ox + 58, y + 27], "Cash", font("sans", 9, bold=True), fill=OCHRE6, anchor="mm")
    rr(d, [ox + 106, y + 14, ox + 180, y + 40], 13, fill=PAPER, outline=LINE, width=1)
    text(d, [ox + 143, y + 27], "EFT", font("sans", 9), fill=INKSOFT, anchor="mm")
    # submit
    yy = oy + PH - 56
    rr(d, [ox + 16, yy, ox + PW - 16, yy + 38], 19, fill=OCHRE)
    text(d, [ox + PW/2, yy + 19], "Post job", font("sans", 12, bold=True), fill=WHITE, anchor="mm")
    save(img, "screen_postjob.png")

# ---------- 4. JOB DETAIL ----------
def jobdetail():
    img, d, ox, oy = phone()
    status_bar(d, ox, oy)
    y = oy + 42
    pill(d, ox + 16, y, "Home & garden", font("sans", 8, bold=True), OCHRE50, OCHRE6)
    pill(d, ox + 110, y, "● Open", font("sans", 8, bold=True), SAGE100, SAGE7)
    y += 28
    text(d, [ox + 16, y], "Cut lawn and trim hedges", font("serif", 16, bold=True), fill=INK)
    y += 24
    text(d, [ox + 16, y], "Linden, Johannesburg · by Tshepo M", font("sans", 9), fill=INKMUT)
    y += 28
    # price card
    rr(d, [ox + 16, y, ox + PW - 16, y + 64], 14, fill=PAPER, outline=LINE, width=1)
    text(d, [ox + 28, y + 14], "SUGGESTED PRICE", font("sans", 7.5, bold=True), fill=INKMUT)
    text(d, [ox + 28, y + 38], "R 350", font("serif", 22, bold=True), fill=OCHRE6, anchor="lm")
    text(d, [ox + PW - 28, y + 38], "Cash on completion", font("sans", 8.5), fill=INKSOFT, anchor="rm")
    y += 76
    # description
    rr(d, [ox + 16, y, ox + PW - 16, y + 70], 14, fill=PAPER, outline=LINE, width=1)
    text(d, [ox + 28, y + 14], "Description", font("serif", 12, bold=True), fill=INK)
    text(d, [ox + 28, y + 34], "Medium yard, front + back.", font("sans", 9.5), fill=INKSOFT)
    text(d, [ox + 28, y + 50], "Bring your own mower please.", font("sans", 9.5), fill=INKSOFT)
    y += 82
    # offer form
    rr(d, [ox + 16, y, ox + PW - 16, y + 120], 14, fill=PAPER, outline=LINE, width=1)
    text(d, [ox + 28, y + 16], "Respond to this job", font("serif", 13, bold=True), fill=INK)
    rr(d, [ox + 28, y + 38, ox + (PW/2), y + 64], 13, fill=PAPER, outline=OCHRE, width=1)
    text(d, [ox + 28 + (PW/2-28)/2, y + 51], "Accept R 350", font("sans", 9, bold=True), fill=OCHRE6, anchor="mm")
    rr(d, [ox + (PW/2) + 6, y + 38, ox + PW - 28, y + 64], 13, fill=PAPER, outline=LINE, width=1)
    text(d, [ox + (PW/2 + 6 + PW - 28)/2, y + 51], "Counter-offer", font("sans", 9), fill=INKSOFT, anchor="mm")
    rr(d, [ox + 28, y + 74, ox + PW - 28, y + 108], 17, fill=INK)
    text(d, [ox + PW/2, y + 91], "Send offer", font("sans", 11, bold=True), fill=CREAM, anchor="mm")
    save(img, "screen_jobdetail.png")

# ---------- 5. ADMIN (desktop) ----------
def admin():
    W, H = 900, 560
    img, d = canvas(W, H, CREAM)
    # sidebar
    rr(d, [0, 0, 210, H], 0, fill=INK)
    text(d, [28, 30], "Workit", font("serif", 18, bold=True), fill=OCHRE, anchor="lm")
    text(d, [28, 50], "Admin", font("sans", 9), fill="#B9A998", anchor="lm")
    items = [("Overview", True), ("Approvals", False), ("Verification", False),
             ("Disputes", False), ("Moderation", False), ("Heatmap", False), ("Audit log", False)]
    yy = 84
    for lab, act in items:
        if act:
            rr(d, [14, yy - 4, 196, yy + 26], 10, fill="#33271F")
        text(d, [30, yy + 11], lab, font("sans", 11, bold=act),
             fill=CREAM if act else "#C9B9A8", anchor="lm")
        yy += 38
    # main
    text(d, [240, 34], "Good evening, Tshepo.", font("serif", 22, bold=True), fill=INK, anchor="lm")
    text(d, [240, 58], "Here's what's happening on Workit right now.", font("sans", 11), fill=INKMUT, anchor="lm")
    # KPI cards
    kpis = [("Signups today", "8", OCHRE6), ("Open jobs", "24", SAGE7), ("Done this week", "31", INK), ("Need attention", "3", BRICK)]
    cw = (W - 240 - 40 - 36) / 4
    for i, (lab, val, col) in enumerate(kpis):
        x = 240 + i * (cw + 12)
        rr(d, [x, 78, x + cw, 150], 14, fill=PAPER, outline=LINE, width=1)
        text(d, [x + 16, 96], lab.upper(), font("sans", 8, bold=True), fill=INKMUT)
        text(d, [x + 16, 124], val, font("serif", 22, bold=True), fill=col, anchor="lm")
    # trends panel with sparklines
    rr(d, [240, 166, W - 36, 330], 14, fill=PAPER, outline=LINE, width=1)
    text(d, [256, 184], "Trends · last 30 days", font("serif", 14, bold=True), fill=INK)
    spark = [("Signups", OCHRE), ("Jobs posted", SAGE), ("Completed", INK), ("Disputes", BRICK)]
    sw = (W - 240 - 36 - 32) / 4
    import math
    for i, (lab, col) in enumerate(spark):
        x = 256 + i * (sw + 8)
        text(d, [x, 210], lab, font("sans", 8.5, bold=True), fill=INKMUT)
        text(d, [x, 224], str([42, 31, 28, 3][i]), font("serif", 18, bold=True), fill=INK)
        # sparkline
        pts = []
        base = 260
        import random
        random.seed(i + 3)
        vals = [random.random() for _ in range(14)]
        for j, v in enumerate(vals):
            px = x + j * (sw - 10) / 13
            py = base + 44 - v * 40
            pts.append((px * S, py * S))
        d.line(pts, fill=col, width=2 * S, joint="curve")
        d.ellipse([(pts[-1][0]/S-3)*S, (pts[-1][1]/S-3)*S, (pts[-1][0]/S+3)*S, (pts[-1][1]/S+3)*S], fill=col)
    # attention list
    rr(d, [240, 346, W - 36, H - 24], 14, fill=PAPER, outline=LINE, width=1)
    text(d, [256, 364], "Needs your attention", font("serif", 14, bold=True), fill=INK)
    att = [("Open disputes", "1", BRICK), ("Accounts waiting approval", "2", OCHRE6),
           ("Workers re-submitted after rejection", "1", BRICK)]
    ay = 392
    for lab, val, col in att:
        d.ellipse([256*S, (ay+3)*S, 262*S, (ay+9)*S], fill=col)
        text(d, [274, ay + 6], lab, font("sans", 10.5), fill=INK, anchor="lm")
        text(d, [W - 56, ay + 6], val, font("serif", 14, bold=True), fill=col, anchor="rm")
        ay += 30
    save(img, "screen_admin.png")

home()
findwork()
postjob()
jobdetail()
admin()
print("done")
