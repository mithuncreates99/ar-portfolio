"""Usage: python make_tiles.py OUT_DIR

Renders the standing-display tiles for the markerless AR version: a header and one tile per section.
Layout is designed on a 1200 x 860 grid and rendered TILE_SCALE times larger (default 2 -> 2400 x 1720)
so text stays sharp when you walk up to it in AR."""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont
OUT = sys.argv[1]
S = float(os.environ.get("TILE_SCALE", "2"))
FONT = os.environ.get("INTER_DIR", "/usr/share/fonts/opentype/inter/").rstrip("/") + "/"
def font(n, s): return ImageFont.truetype(FONT + n, round(s * S))
def P(*v): return [round(x * S) for x in v]
BG = (17, 21, 40); PANEL = (24, 29, 52); ACCENT = (108, 140, 255); TITLE = (242, 244, 255); BODY = (214, 219, 240)

src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'boards', 'make_boards.py')).read()
ns = {}
exec(src[src.index('NAME ='):src.index('TOP, GAP')], ns)
NAME, TAGLINE, SECTIONS, LINKS = ns['NAME'], ns['TAGLINE'], ns['SECTIONS'], ns['LINKS']

def rich(d, x, y, w, h, text, size, min_size=28):
    """Word-wrapped text with <b>bold</b> and <c>accent</c>; shrinks until it fits (sizes in layout units)."""
    for sz in range(size, min_size - 1, -1):
        fr, fb = font("Inter-Regular.otf", sz), font("Inter-SemiBold.otf", sz)
        lh = sz * 1.34 * S; lines = []
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
                if lw + tw > w * S and line:
                    while line and line[-1][0] == " ": lw -= line.pop()[3]
                    lines.append(line); line, lw = [], 0
                line.append((t, f, ACCENT if acc else (TITLE if bold else BODY), tw)); lw += tw
            lines.append(line)
        if len(lines) * lh <= h * S: break
    cy = y * S
    for ln in lines:
        cx = x * S
        for t, f, col, tw in ln: d.text((cx, cy), t, font=f, fill=col); cx += tw
        cy += lh

def tile(i, title, body, links):
    W, H = 1200, 860
    im = Image.new("RGB", tuple(P(W, H)), BG); d = ImageDraw.Draw(im)
    d.rectangle(P(0, 0, W, 12), fill=ACCENT)
    d.text(tuple(P(60, 48)), f"0{i+1}", font=font("Inter-Bold.otf", 32), fill=ACCENT)
    d.text(tuple(P(60, 88)), title, font=font("InterDisplay-Bold.otf", 80), fill=TITLE)
    d.rectangle(P(60, 196, 180, 203), fill=ACCENT)
    if links:
        rich(d, 60, 236, W - 120, 80, body, 50)
        for k, (label, url) in enumerate(LINKS):
            y = 330 + k * 230
            d.rounded_rectangle(P(60, y, W - 60, y + 200), radius=round(30 * S), fill=PANEL, outline=ACCENT, width=round(5 * S))
            d.text(tuple(P(104, y + 34)), label, font=font("Inter-Bold.otf", 58), fill=TITLE)
            d.text(tuple(P(104, y + 116)), url.replace("https://", ""), font=font("Inter-Medium.otf", 46), fill=ACCENT)
    else:
        rich(d, 60, 236, W - 120, H - 236 - 44, body, 58)
    return im

def header():
    W, H, s = 2400, 330, 1.7 / S       # header is 2400 wide in layout units; render at ~4080 px
    im = Image.new("RGB", tuple(P(W * s, H * s)), BG); d = ImageDraw.Draw(im)
    k = s
    d.rectangle(P(0, (H - 14) * k, W * k, H * k), fill=ACCENT)
    d.rounded_rectangle(P(70 * k, 75 * k, 250 * k, 255 * k), radius=round(40 * k * S), fill=ACCENT)
    f = font("InterDisplay-Bold.otf", 84 * k); tw = d.textlength("MK", font=f); d.text((160 * k * S - tw / 2, 120 * k * S), "MK", font=f, fill=TITLE)
    d.text(tuple(P(300 * k, 62 * k)), NAME, font=font("InterDisplay-Bold.otf", 118 * k), fill=TITLE)
    d.text(tuple(P(304 * k, 212 * k)), TAGLINE.replace("  |  ", "   ·   "), font=font("Inter-Medium.otf", 56 * k), fill=ACCENT)
    return im

header().save(f"{OUT}/tile-header.png", optimize=True)
for i, (btn, title, body, links) in enumerate(SECTIONS):
    tile(i, title if title != "Hi, I'm Mithun" else "About me", "Find me online:" if links else body, links).save(f"{OUT}/tile-{btn.lower()}.png", optimize=True)
print("ok", int(1200 * S), "x", int(860 * S))
