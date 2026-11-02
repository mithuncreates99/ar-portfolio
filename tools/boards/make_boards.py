"""Renders the AR info board (one PNG per open panel) to match the Unity version, plus hotspot JSON."""
import json, os, re, sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
S = 1.5                      # render scale (base layout is 1200 x 760, like Unity)
W, H = 1200, 760
FONT = os.environ.get("INTER_DIR", "/usr/share/fonts/opentype/inter/").rstrip("/") + "/"
def font(name, size): return ImageFont.truetype(FONT + name, round(size * S))

BG = (15, 18, 34, 240); PANEL = (24, 29, 52, 255); BUTTON = (30, 36, 64, 255)
ACCENT = (108, 140, 255, 255); TITLE = (242, 244, 255, 255); BODY = (201, 206, 230, 255)

NAME = "Mithun Kumar Vijayakumar"
TAGLINE = "Master in Management @ NEOMA  |  B.Tech IT  |  Apps & AR"
SECTIONS = [
    ("About", "Hi, I'm Mithun",
     "IT engineer turned business student. I build apps and augmented reality experiences, and I'm now doing a "
     "Master in Management at NEOMA Business School in Rouen, France.\n\n"
     "<c>Looking for:</c> a 6-month internship from January 2027 in IT, business analysis, data, consulting or "
     "digital transformation.", False),
    ("Education", "Education",
     "<b>Master in Management (MiM)</b>\nNEOMA Business School, Rouen, France\n2026 - present\n\n"
     "<b>B.Tech, Information Technology</b>\nBannari Amman Institute of Technology, Tamil Nadu, India\n2022 - 2026", False),
    ("Skills", "Skills",
     "•  Pega Certified System Architect (CSA)\n•  Web and iPhone app development\n"
     "•  Augmented reality with Unity\n•  Business strategy and case analysis\n"
     "•  Languages: English, French (intermediate)", False),
    ("Projects", "Projects",
     "<b>Tell Me</b> - habit-tracker app with daily yes/no check-ins and weekly insights (web + iPhone)\n\n"
     "<b>Xpense</b> - expense and group-split tracker app\n\n"
     "<b>AR Jet Turbine</b> - augmented reality visualization of a jet turbine\n\n"
     "<b>This AR portfolio</b> - built with Unity, Vuforia and WebAR", False),
    ("Awards", "Awards",
     "•  <b>Best Paper Award</b> - ICMCCT'25\n\n"
     "•  <b>State Gold, Woodworking</b> - Tamil Nadu Skills Competition (Dec 2025)\n\n"
     "•  <b>Bronze, Joinery</b> - IndiaSkills Southern Regional 2025-26", False),
    ("Connect", "Let's connect", "Tap a link to open it.", True),
]
LINKS = [("Portfolio website", "https://mithuncreates99.github.io"),
         ("GitHub", "https://github.com/mithuncreates99")]

TOP, GAP = 186, 14
AREA_H = H - TOP - 30
BTN_H = min(90, (AREA_H - GAP * (len(SECTIONS) - 1)) / len(SECTIONS))

def box(d, x, y, w, h, fill, r):
    d.rounded_rectangle([x * S, y * S, (x + w) * S, (y + h) * S], radius=r * S, fill=fill)

def fit(d, text, f_name, size, max_w):
    while size > 10:
        f = font(f_name, size)
        if d.textlength(text, font=f) <= max_w * S: return f
        size -= 1
    return font(f_name, size)

def rich(d, x, y, w, h, text, size=30):
    """Very small rich-text renderer: <b>bold</b>, <c>accent</c>, \\n, word wrap, shrink-to-fit."""
    for sz in range(size, 16, -1):
        fr, fb = font("Inter-Regular.otf", sz), font("Inter-Bold.otf", sz)
        lh = sz * 1.32 * S
        lines, line, lw = [], [], 0
        for para in text.split("\n"):
            tokens = re.findall(r"<b>|</b>|<c>|</c>|[^\s<]+|\s+", para)
            bold = acc = False
            line, lw = [], 0
            for t in tokens:
                if t == "<b>": bold = True; continue
                if t == "</b>": bold = False; continue
                if t == "<c>": acc = bold = True; continue
                if t == "</c>": acc = bold = False; continue
                f = fb if bold else fr
                tw = d.textlength(t, font=f)
                if t.isspace():
                    if line: line.append((" ", f, BODY, tw)); lw += tw
                    continue
                if lw + tw > w * S and line:
                    while line and line[-1][0] == " ": lw -= line.pop()[3]
                    lines.append(line); line, lw = [], 0
                line.append((t, f, ACCENT if acc else (TITLE if bold else BODY), tw)); lw += tw
            lines.append(line)
        if len(lines) * lh <= h * S: break
    cy = y * S
    for ln in lines:
        cx = x * S
        for t, f, col, tw in ln:
            d.text((cx, cy), t, font=f, fill=col); cx += tw
        cy += lh

def render(active):
    img = Image.new("RGBA", (round(W * S), round(H * S)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    box(d, 0, 0, W, H, BG, 28)
    d.text((40 * S, 26 * S), NAME, font=fit(d, NAME, "InterDisplay-Bold.otf", 56, 1120), fill=TITLE)
    d.text((40 * S, 104 * S), TAGLINE, font=fit(d, TAGLINE, "Inter-Medium.otf", 28, 1120), fill=ACCENT)
    box(d, 40, 158, 1120, 3, (255, 255, 255, 30), 1)
    hotspots = []
    for i, (btn, title, body, links) in enumerate(SECTIONS):
        by = TOP + i * (BTN_H + GAP)
        box(d, 40, by, 290, BTN_H, ACCENT if i == active else BUTTON, 16)
        f = fit(d, btn, "Inter-Bold.otf", 32, 260)
        tw = d.textlength(btn, font=f)
        d.text(((40 + 145) * S - tw / 2, (by + BTN_H / 2) * S), btn, font=f, fill=TITLE, anchor="lm")
        hotspots.append({"type": "panel", "index": i, "x": 40, "y": by, "w": 290, "h": BTN_H})
    btn, title, body, links = SECTIONS[active]
    box(d, 360, TOP, 800, AREA_H, PANEL, 20)
    d.text((392 * S, (TOP + 24) * S), title, font=fit(d, title, "InterDisplay-Bold.otf", 42, 736), fill=ACCENT)
    rich(d, 392, TOP + 92, 736, 80 if links else AREA_H - 116, body)
    if links:
        for k, (label, url) in enumerate(LINKS):
            lx, ly = 392 + (k % 2) * 376, TOP + 190 + (k // 2) * 96
            box(d, lx, ly, 356, 76, ACCENT, 16)
            f = fit(d, label, "Inter-Bold.otf", 28, 320)
            tw = d.textlength(label, font=f)
            d.text(((lx + 178) * S - tw / 2, (ly + 38) * S), label, font=f, fill=TITLE, anchor="lm")
            hotspots.append({"type": "link", "url": url, "x": lx, "y": ly, "w": 356, "h": 76})
    return img, hotspots

layout = {"width": W, "height": H, "panels": []}
for i, s in enumerate(SECTIONS):
    img, hs = render(i)
    name = f"board-{s[0].lower()}.png"
    img.save(f"{OUT}/{name}", optimize=True)
    layout["panels"].append({"name": s[0], "image": name, "hotspots": hs})
json.dump(layout, open(f"{OUT}/board.json", "w"), indent=1)
print("ok", [p["image"] for p in layout["panels"]])
