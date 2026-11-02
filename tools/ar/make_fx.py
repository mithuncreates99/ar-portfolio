"""Covers for the closed 'book' tiles and glow textures for the reveal effects."""
import math, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = sys.argv[1] if len(sys.argv) > 1 else 'tex'
F = os.environ.get("INTER_DIR", "/usr/share/fonts/opentype/inter/").rstrip("/") + "/"
def font(n, s): return ImageFont.truetype(F + n, s)
ACCENT = (108, 140, 255); TITLE = (242, 244, 255)
NAMES = ["About", "Education", "Skills", "Projects", "Awards", "Connect"]

# Cover = what a folded tile shows before it opens (half the tile width)
for i, n in enumerate(NAMES):
    W, H = 600, 860
    im = Image.new("RGB", (W, H)); px = im.load()
    for y in range(H):
        for x in range(W):
            k = (x / W * 0.35 + y / H * 0.65)
            px[x, y] = (int(22 + 70 * k), int(26 + 80 * k), int(58 + 170 * k))
    d = ImageDraw.Draw(im)
    for j in range(9):   # faceted highlights, echoing the card's low-poly pattern
        a = (j * 97) % W; b = (j * 211) % H
        d.polygon([(a, b), (a + 180, b + 60), (a + 40, b + 220)], fill=None, outline=(150, 170, 255), width=2)
    im = im.filter(ImageFilter.GaussianBlur(0.6)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([40, 40, 140, 140], radius=24, fill=TITLE)
    f = font("InterDisplay-Bold.otf", 46); tw = d.textlength("MK", font=f); d.text((90 - tw / 2, 63), "MK", font=f, fill=ACCENT)
    d.text((40, 470), f"0{i+1}", font=font("InterDisplay-Bold.otf", 200), fill=TITLE)
    d.text((44, 700), n, font=font("InterDisplay-Bold.otf", 76), fill=TITLE)
    d.rectangle([44, 810, 164, 818], fill=TITLE)
    im.save(f"{OUT}/cover-{n.lower()}.jpg", quality=90)

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
