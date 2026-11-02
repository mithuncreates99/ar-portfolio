"""Usage: python make_tiles.py OUT_DIR

Renders the standing-display tiles for the markerless AR version: a header and one tile per section."""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont
OUT = sys.argv[1]
FONT = os.environ.get("INTER_DIR", "/usr/share/fonts/opentype/inter/").rstrip("/") + "/"
def font(n, s): return ImageFont.truetype(FONT + n, round(s))
BG = (17, 21, 40); PANEL = (24, 29, 52); ACCENT = (108, 140, 255); TITLE = (242, 244, 255); BODY = (201, 206, 230)

src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'boards', 'make_boards.py')).read()
ns = {}
exec(src[src.index('NAME ='):src.index('TOP, GAP')], ns)
NAME, TAGLINE, SECTIONS, LINKS = ns['NAME'], ns['TAGLINE'], ns['SECTIONS'], ns['LINKS']

def rich(d, x, y, w, h, text, size):
    for sz in range(size, 14, -1):
        fr, fb = font("Inter-Regular.otf", sz), font("Inter-Bold.otf", sz)
        lh = sz * 1.36; lines = []
        for para in text.split("\n"):
            tokens = re.findall(r"<b>|</b>|<c>|</c>|[^\s<]+|\s+", para); bold = acc = False; line, lw = [], 0
            for t in tokens:
                if t == "<b>": bold = True; continue
                if t == "</b>": bold = False; continue
                if t == "<c>": acc = bold = True; continue
                if t == "</c>": acc = bold = False; continue
                f = fb if bold else fr; tw = d.textlength(t, font=f)
                if t.isspace():
                    if line: line.append((" ", f, BODY, tw)); lw += tw
                    continue
                if lw + tw > w and line:
                    while line and line[-1][0] == " ": lw -= line.pop()[3]
                    lines.append(line); line, lw = [], 0
                line.append((t, f, ACCENT if acc else (TITLE if bold else BODY), tw)); lw += tw
            lines.append(line)
        if len(lines) * lh <= h: break
    cy = y
    for ln in lines:
        cx = x
        for t, f, col, tw in ln: d.text((cx, cy), t, font=f, fill=col); cx += tw
        cy += lh

def tile(i, title, body, links):
    W, H = 1200, 860
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 14], fill=ACCENT)
    d.text((64, 70), f"0{i+1}", font=font("Inter-Bold.otf", 34), fill=ACCENT)
    d.text((64, 118), title, font=font("InterDisplay-Bold.otf", 74), fill=TITLE)
    d.rectangle([64, 226, 184, 232], fill=ACCENT)
    if links:
        rich(d, 64, 272, W - 128, 120, body, 40)
        for k, (label, url) in enumerate(LINKS):
            y = 380 + k * 190
            d.rounded_rectangle([64, y, W - 64, y + 160], radius=28, fill=PANEL, outline=ACCENT, width=4)
            d.text((104, y + 30), label, font=font("Inter-Bold.otf", 44), fill=TITLE)
            d.text((104, y + 92), url.replace("https://", ""), font=font("Inter-Medium.otf", 36), fill=ACCENT)
    else:
        rich(d, 64, 272, W - 128, H - 272 - 60, body, 46)
    return im

def header():
    W, H = 2400, 330
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    d.rectangle([0, H - 14, W, H], fill=ACCENT)
    d.rounded_rectangle([70, 75, 250, 255], radius=40, fill=ACCENT)
    f = font("InterDisplay-Bold.otf", 84); tw = d.textlength("MK", font=f); d.text((160 - tw / 2, 120), "MK", font=f, fill=TITLE)
    d.text((300, 62), NAME, font=font("InterDisplay-Bold.otf", 118), fill=TITLE)
    d.text((304, 212), TAGLINE.replace("  |  ", "   ·   "), font=font("Inter-Medium.otf", 56), fill=ACCENT)
    return im

header().save(f"{OUT}/tile-header.jpg", quality=90)
for i, (btn, title, body, links) in enumerate(SECTIONS):
    tile(i, title if title != "Hi, I'm Mithun" else "About me", "Find me online:" if links else body, links).save(f"{OUT}/tile-{btn.lower()}.jpg", quality=90)
print("ok")
