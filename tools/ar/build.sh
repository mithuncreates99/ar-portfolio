#!/usr/bin/env bash
# Builds docs/assets/ar/portfolio.glb (Android Scene Viewer) and portfolio.usdz (iPhone AR Quick Look).
# Needs: Python 3 + Pillow, Node 18+ with Playwright (Chromium), and a Python with Blender's module and USD (pip install bpy usd-core).
set -euo pipefail
cd "$(dirname "$0")"
BLENDER_PY="${BLENDER_PY:-python3}"   # a Python that can `import bpy`
PORT="${PORT:-8772}"
npm install --silent
python3 prepare_tex.py
python3 -m http.server "$PORT" >/dev/null 2>&1 & SERVER=$!
trap 'kill $SERVER' EXIT
sleep 1
PORT="$PORT" node run-build.js                   # bakes the reveal and exports out/portfolio-raw.glb
node finish.mjs out/portfolio-raw.glb ../../docs/assets/ar/portfolio.glb
# lighter copy for the website's 3D view: textures capped at 1536 px and stored as WebP
npx --yes @gltf-transform/cli@4.1.1 resize ../../docs/assets/ar/portfolio.glb out/web-resized.glb --width 1536 --height 1536
npx --yes @gltf-transform/cli@4.1.1 webp out/web-resized.glb ../../docs/assets/ar/portfolio-web.glb --quality 90
"$BLENDER_PY" to_usdz.py ../../docs/assets/ar/portfolio.glb out/portfolio-basic.usdz
"$BLENDER_PY" add_behaviors.py out/portfolio-basic.usdz ../../docs/assets/ar/portfolio.usdz out/info.json   # tap-to-zoom for AR Quick Look
echo "Done: docs/assets/ar/portfolio.glb and portfolio.usdz"
