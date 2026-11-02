"""Covers for the closed 'book' tiles and glow textures for the reveal effects."""
import math, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = sys.argv[1] if len(sys.argv) > 1 else 'tex'
F = os.environ.get("INTER_DIR", "/usr/share/fonts/opentype/inter/").rstrip("/") + "/"
def font(n, s): return ImageFont.truetype(F + n, s)
ACCENT = (108, 140, 255); TITLE = (242, 244, 255)
NAMES = ["About", "Education", "Skills", "Projects", "Awards", "Connect"]

# Cover = what a folded tile shows before it opens (half the tile width), rendered TILE_SCALE times larger
S = float(os.environ.get("TILE_SCALE", "2"))
for i, n in enumerate(NAMES):
    W, H = round(600 * S), round(860 * S)
    im = Image.new("RGB", (W, H)); px = im.load()
    for y in range(H):
        for x in range(W):
            k = (x / W * 0.35 + y / H * 0.65)
            px[x, y] = (int(22 + 70 * k), int(26 + 80 * k), int(58 + 170 * k))
    d = ImageDraw.Draw(im)
    for j in range(9):   # faceted highlights, echoing the card's low-poly pattern
        a_, b_ = (j * 97) % 600 * S, (j * 211) % 860 * S
        d.polygon([(a_, b_), (a_ + 180 * S, b_ + 60 * S), (a_ + 40 * S, b_ + 220 * S)], fill=None, outline=(150, 170, 255), width=round(2 * S))
    im = im.filter(ImageFilter.GaussianBlur(0.6 * S)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([40 * S, 40 * S, 140 * S, 140 * S], radius=round(24 * S), fill=TITLE)
    f = font("InterDisplay-Bold.otf", round(46 * S)); tw = d.textlength("MK", font=f); d.text((90 * S - tw / 2, 63 * S), "MK", font=f, fill=ACCENT)
    d.text((40 * S, 470 * S), f"0{i+1}", font=font("InterDisplay-Bold.otf", round(200 * S)), fill=TITLE)
    d.text((44 * S, 700 * S), n, font=font("InterDisplay-Bold.otf", round(76 * S)), fill=TITLE)
    d.rectangle([44 * S, 810 * S, 164 * S, 818 * S], fill=TITLE)
    im.save(f"{OUT}/cover-{n.lower()}.jpg", quality=92)

def save_rgba(arr_fn, w, h, name):
    im = Image.new("RGBA", (w, h)); px = im.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = arr_fn(x, y)
    im.save(f"{OUT}/{name}")

# soft round glow (sparkles)
save_rgba(lambda x, y: (255, 255, 255, int(255 * max(0, 1 - math.hypot(x - 63.5, y - 63.5) / 64) ** 2.2)), 128, 128, "fx-glow.png")
# shockwave ring
def ring(x, y):
    r = math.hypot(x - 255.5, y - 255.5) / 256
    a = math.exp(-((r - 0.82) / 0.07) ** 2) + 0.35 * math.exp(-((r - 0.6) / 0.25) ** 2) * (r < 0.82)
    return (255, 255, 255, int(255 * min(1, a)))
save_rgba(ring, 512, 512, "fx-ring.png")
# light beam (bright core, fades to the top)
save_rgba(lambda x, y: (255, 255, 255, int(255 * math.exp(-((x - 31.5) / 9) ** 2) * (1 - y / 511) ** 0.6 * min(1, (511 - y) / 40 + 0.0))), 64, 512, "fx-beam.png")
# landing flash: glowing rectangle outline
def frame(x, y):
    W, H = 512, 370; m = 40
    dx = max(m - x, x - (W - m), 0); dy = max(m - y, y - (H - m), 0)
    dist_out = math.hypot(dx, dy)
    inside = (m <= x <= W - m) and (m <= y <= H - m)
    din = min(x - m, W - m - x, y - m, H - m - y) if inside else 0
    d = dist_out if not inside else din
    return (255, 255, 255, int(255 * math.exp(-(d / 12) ** 2)))
save_rgba(frame, 512, 370, "fx-frame.png")
print("ok")
