/*
 * 3D view: the same board, card and avatar as in AR, shown without a camera.
 * Drag to turn, pinch or scroll to zoom, tap the board buttons to switch panels.
 */
(function () {
  'use strict';

  const scene = document.getElementById('scene');
  const camEl = document.getElementById('cam');
  const content = document.getElementById('content');
  const remy = document.getElementById('remy');
  const welcome = document.getElementById('welcome');
  const viewBtn = document.getElementById('view');
  const hint = document.getElementById('hint');
  const resetBtn = document.getElementById('reset');
  const touch = window.matchMedia('(pointer: coarse)').matches;

  // ---------- WebGL check: without it, show the board images as a plain page ----------
  function hasWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function showFallback(layout) {
    const box = document.getElementById('fallback');
    box.hidden = false;
    box.innerHTML = '<p>Your browser can\'t show 3D, so here is the board as images. ' +
      '<a href="https://mithuncreates99.github.io">Portfolio website</a> · ' +
      '<a href="https://github.com/mithuncreates99">GitHub</a></p>';
    (layout ? layout.panels : []).forEach(function (p) {
      const img = document.createElement('img');
      img.src = 'assets/' + p.image;
      img.alt = p.name;
      box.appendChild(img);
    });
    welcome.classList.add('done');
  }

  // ---------- Welcome screen ----------
  let ready = false;
  let wantsView = location.hash === '#view';

  function enterView() {
    wantsView = true;
    if (!ready) { viewBtn.classList.add('waiting'); return; }
    welcome.classList.add('done');
    if (location.hash !== '#view') history.replaceState(null, '', '#view');
  }
  viewBtn.addEventListener('click', enterView);
  if (wantsView) { welcome.style.transition = 'none'; enterView(); }   // ./#view skips the welcome screen

  // ---------- Drag vs. tap: a drag that ends on a button must not press it ----------
  let downX = 0, downY = 0, dragged = false, interacted = false;
  window.addEventListener('pointerdown', function (e) { downX = e.clientX; downY = e.clientY; dragged = false; }, true);
  window.addEventListener('pointermove', function (e) {
    if (e.buttons || e.pointerType === 'touch') {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) { dragged = true; userMoved(); }
    }
  }, true);
  window.addEventListener('wheel', userMoved, { passive: true });

  function userMoved() {
    if (!welcome.classList.contains('done')) return;
    if (!interacted) {
      interacted = true;
      hint.style.opacity = '0';
    }
    resetBtn.classList.add('show');
  }

  // ---------- Camera framing ----------
  let controls = null;
  const home = { pos: new THREE.Vector3(), target: new THREE.Vector3() };

  // Extent of the composition in scene units (card = 1 unit wide). Fixed numbers rather than a measured
  // bounding box, because the avatar's size changes while it waves.
  const WIDE = { x0: -0.78, x1: 1.1, y0: -0.36, y1: 1.3, remy: '0.93 -0.32 0.05' };
  const TALL = { x0: -0.77, x1: 0.77, y0: -0.36, y1: 1.3, remy: '0.5 -0.32 0.16' };   // avatar moves in next to the card

  function frame() {
    if (!controls) return;
    const W = window.innerWidth, H = window.innerHeight, aspect = W / H;
    const L = aspect < 0.9 ? TALL : WIDE;
    remy.setAttribute('position', L.remy);

    const size = new THREE.Vector3(L.x1 - L.x0, L.y1 - L.y0, 0.3);
    const center = new THREE.Vector3((L.x0 + L.x1) / 2, (L.y0 + L.y1) / 2, 0);
    const cam = camEl.getObject3D('camera');
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const tanH = tanV * aspect;

    // Keep the content clear of the header and the button bar.
    const top = 64, bottom = touch ? 120 : 110;
    const usable = Math.max(0.4, (H - top - bottom) / H);
    const margin = aspect < 0.9 ? 1.03 : 1.1;
    const dist = Math.max((size.x / 2) * margin / tanH, (size.y / 2) * margin / (tanV * usable)) + size.z / 2;
    const shift = ((bottom - top) / 2) * (2 * dist * tanV / H);   // world units

    home.target.set(center.x, center.y - shift, 0);
    home.pos.set(center.x, center.y - shift, dist);

    controls.minDistance = dist * 0.3;
    controls.maxDistance = dist * 1.5;
    controls.cursor.copy(home.target);
    controls.maxTargetRadius = Math.max(size.x, size.y) * 0.6;
    goHome(false);
  }

  let tween = null;
  function goHome(animate) {
    const cam = controls.object;
    if (!animate) {
      cam.position.copy(home.pos);
      controls.target.copy(home.target);
      controls.update();
      return;
    }
    tween = { t0: performance.now(), fromPos: cam.position.clone(), fromTarget: controls.target.clone() };
  }

  resetBtn.addEventListener('click', function () {
    goHome(true);
    resetBtn.classList.remove('show');
  });

  // ---------- Per-frame: gentle idle sway (until the visitor takes over) and the reset animation ----------
  AFRAME.registerComponent('view-tick', {
    tick: function (time) {
      if (!interacted) {
        content.object3D.rotation.y = THREE.MathUtils.degToRad(7) * Math.sin(time / 1300);
      } else if (Math.abs(content.object3D.rotation.y) > 1e-4) {
        content.object3D.rotation.y *= 0.9;
      }
      if (tween && controls) {
        const k = Math.min(1, (performance.now() - tween.t0) / 500);
        const e = 1 - Math.pow(1 - k, 3);
        controls.object.position.lerpVectors(tween.fromPos, home.pos, e);
        controls.target.lerpVectors(tween.fromTarget, home.target, e);
        controls.update();
        if (k === 1) tween = null;
      }
    }
  });
  scene.setAttribute('view-tick', '');

  // ---------- Taps on the board ----------
  // The orbit controls take over the pointer, so taps are detected here: a pointer that goes up
  // without having dragged is ray-cast into the scene, and the button it hits receives a click.
  const hotspots = document.getElementById('hotspots');
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function hotspotAt(e) {
    const rect = scene.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camEl.getObject3D('camera'));
    const targets = Array.prototype.map.call(hotspots.querySelectorAll('.clickable'), function (el) { return el.object3D; });
    const hit = raycaster.intersectObjects(targets, true)[0];
    let o = hit && hit.object;
    while (o && !o.el) o = o.parent;
    return o ? o.el : null;
  }

  function wireTaps() {
    const canvas = scene.canvas;
    canvas.addEventListener('pointerup', function (e) {
      if (dragged) return;
      const el = hotspotAt(e);
      if (el) el.emit('click');
    });
    canvas.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse' && !e.buttons) canvas.style.cursor = hotspotAt(e) ? 'pointer' : '';
    });
  }

  hint.textContent = touch
    ? 'Tap the buttons · Drag to turn · Pinch to zoom'
    : 'Click the buttons · Drag to turn · Scroll to zoom';

  // ---------- Start ----------
  if (!hasWebGL()) {
    PortfolioBoard.load('assets/board.json').then(showFallback, function () { showFallback(null); });
    return;
  }

  const modelReady = new Promise(function (resolve) {
    remy.addEventListener('model-loaded', resolve);
    remy.addEventListener('model-error', resolve);
    setTimeout(resolve, 10000);   // never block the page on the avatar
  });
  const sceneReady = new Promise(function (resolve) {
    if (scene.hasLoaded) resolve(); else scene.addEventListener('loaded', resolve);
  });

  Promise.all([PortfolioBoard.load('assets/board.json'), sceneReady]).then(function (r) {
    const board = PortfolioBoard.mount({
      layout: r[0],
      board: document.getElementById('board'),
      hotspots: hotspots,
      ignoreClick: function () { return dragged; }
    });
    window.__showPanel = board.show;
    wireTaps();
    return new Promise(function waitForControls(resolve) {
      const oc = camEl.components['orbit-controls'];
      if (oc && oc.controls) { controls = oc.controls; frame(); resolve(); }
      else setTimeout(function () { waitForControls(resolve); }, 50);
    });
  }).then(function () {
    return modelReady;
  }).then(function () {
    frame();   // re-frame once the avatar's size is known
    ready = true;
    viewBtn.classList.remove('waiting');
    if (wantsView) enterView();
  }).catch(function () {
    viewBtn.querySelector('small').textContent = 'Could not load. Please refresh.';
  });

  let resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(frame, 150);
  });
})();
