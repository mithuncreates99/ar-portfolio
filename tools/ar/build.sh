#!/usr/bin/env bash
# Builds docs/assets/ar/portfolio.glb (Android Scene Viewer) and portfolio.usdz (iPhone AR Quick Look).
# Needs: Python 3 + Pillow, Node 18+ with Playwright (Chromium), and Blender's Python module (pip install bpy).
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
"$BLENDER_PY" to_usdz.py ../../docs/assets/ar/portfolio.glb ../../docs/assets/ar/portfolio.usdz
echo "Done: docs/assets/ar/portfolio.glb and portfolio.usdz"
