"""Prepares tools/ar/tex/ for build.html: section tiles split into book halves, covers, glow textures,
the card image and the avatar (both copied from docs/assets)."""
import math, os, shutil, subprocess, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, '..', '..', 'docs', 'assets')
TEX = os.path.join(HERE, 'tex'); TILES = os.path.join(TEX, '_tiles')
os.makedirs(TILES, exist_ok=True)
subprocess.run([sys.executable, os.path.join(HERE, 'make_tiles.py'), TILES], check=True)
subprocess.run([sys.executable, os.path.join(HERE, 'make_fx.py'), TILES], check=True)
# text tiles stay PNG so letters keep crisp edges (no JPEG ringing)
for n in ['about', 'education', 'skills', 'projects', 'awards', 'connect']:
    im = Image.open(f'{TILES}/tile-{n}.png'); w, h = im.size
    im.crop((0, 0, w // 2, h)).save(f'{TEX}/{n}-L.png', optimize=True)
    im.crop((w // 2, 0, w, h)).save(f'{TEX}/{n}-R.png', optimize=True)
    shutil.copy(f'{TILES}/cover-{n}.jpg', f'{TEX}/{n}-cover.jpg')
shutil.copy(f'{TILES}/tile-header.png', f'{TEX}/header.png')
for f in ['fx-glow.png', 'fx-ring.png']: shutil.copy(f'{TILES}/{f}', f'{TEX}/{f}')

# card: 2K render of the print PDF when pdftoppm is available, otherwise the web image
SRC = os.path.join(HERE, 'src'); os.makedirs(SRC, exist_ok=True)
pdf = os.path.join(DOCS, 'card-print.pdf')
if shutil.which('pdftoppm'):
    subprocess.run(['pdftoppm', '-png', '-r', '600', '-singlefile', pdf, os.path.join(SRC, 'card-print')], check=True)
    c = Image.open(os.path.join(SRC, 'card-print.png')).convert('RGB')
    c.resize((2048, round(c.height * 2048 / c.width)), Image.LANCZOS).save(f'{TEX}/card.jpg', quality=92)
else:
    shutil.copy(os.path.join(DOCS, 'card.jpg'), f'{TEX}/card.jpg')
# avatar: an optional higher-resolution copy in tools/ar/src/remy-ar.glb (not in git), otherwise the web avatar
hd = os.path.join(SRC, 'remy-ar.glb')
shutil.copy(hd if os.path.exists(hd) else os.path.join(DOCS, 'remy.glb'), f'{TEX}/remy.glb')
print('avatar:', 'HD' if os.path.exists(hd) else 'web (512 px)')

def save(fn, w, h, name):
    im = Image.new('RGBA', (w, h)); px = im.load()
    for y in range(h):
        for x in range(w): px[x, y] = fn(x, y)
    im.save(f'{TEX}/{name}')
# light beam for the cylinders: bright at the base, fading upwards
save(lambda x, y: (255, 255, 255, int(255 * (y / 255) ** 1.6)), 8, 256, 'fx-beam-cyl.png')
# stage disc on the floor: faint fill, bright rim, thin inner ring
def stage(x, y):
    r = math.hypot(x - 255.5, y - 255.5) / 256
    if r > 1: return (0, 0, 0, 0)
    rim = math.exp(-((r - 0.94) / 0.025) ** 2); inner = 0.6 * math.exp(-((r - 0.62) / 0.012) ** 2)
    a = min(1, rim + inner + 0.28 * (1 - r ** 3)); k = rim + inner
    return (int(20 + 120 * k), int(26 + 140 * k), int(60 + 195 * k), int(255 * a))
save(stage, 512, 512, 'fx-stage.png')
print('tex ready')
