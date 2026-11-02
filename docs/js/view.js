/*
 * 3D view: the same board, card and avatar as in AR, shown without a camera.
 * The current section is also shown as normal text in the reading panel, so nothing needs zooming.
 * Drag the board to tilt it (it springs back); tap the board buttons or the tabs to switch sections.
 */
(function () {
  'use strict';

  const scene = document.getElementById('scene');
  const camEl = document.getElementById('cam');
  const content = document.getElementById('content');
  const remy = document.getElementById('remy');
  const welcome = document.getElementById('welcome');
  const viewBtn = document.getElementById('view');
  const reader = document.getElementById('reader');
  const hotspots = document.getElementById('hotspots');
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const sidebar = window.matchMedia('(min-width: 900px) and (min-aspect-ratio: 1/1)');
  const R = THREE.MathUtils.degToRad;

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
      '<a href="https://mithuncreates99.github.io">Portfolio website</a> · <a href="https://github.com/mithuncreates99">GitHub</a></p>';
    (layout ? layout.panels : []).forEach(function (p) {
      const img = document.createElement('img'); img.src = 'assets/' + p.image; img.alt = p.name; box.appendChild(img);
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

  // ---------- Reading panel ----------
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function richHTML(text) {
    // board text markup: <b>bold</b>, <c>accent</c>, blank line = new paragraph, \n = line break
    return text.split(/\n\s*\n/).map(function (para) {
      const h = esc(para)
        .replace(/&lt;b&gt;/g, '<strong>').replace(/&lt;\/b&gt;/g, '</strong>')
        .replace(/&lt;c&gt;/g, '<strong class="accent">').replace(/&lt;\/c&gt;/g, '</strong>')
        .replace(/\n/g, '<br>');
      return '<p>' + h + '</p>';
    }).join('');
  }
  let board = null, layout = null;
  function renderReader(i) {
    const p = layout.panels[i];
    document.getElementById('s-num').textContent = String(i + 1).padStart(2, '0') + ' / ' + String(layout.panels.length).padStart(2, '0');
    document.getElementById('s-title').textContent = p.title;
    document.getElementById('s-body').innerHTML = richHTML(p.body || '');
    const links = document.getElementById('s-links');
    links.innerHTML = '';
    (p.links || []).forEach(function (l) {
      const a = document.createElement('a');
      a.href = l.url; a.target = '_blank'; a.rel = 'noopener';
      a.innerHTML = esc(l.label) + ' <span>' + esc(l.url.replace(/^https?:\/\//, '')) + ' ↗</span>';
      links.appendChild(a);
    });
    document.getElementById('section').scrollTop = 0;
    document.querySelectorAll('#tabs .tab').forEach(function (t, k) {
      t.setAttribute('aria-selected', k === i ? 'true' : 'false');
      if (k === i) t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
  }
  function buildTabs() {
    const tabs = document.getElementById('tabs');
    layout.panels.forEach(function (p, k) {
      const b = document.createElement('button');
      b.className = 'tab'; b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = p.name;
      b.addEventListener('click', function () { board.show(k); });
      tabs.appendChild(b);
    });
  }
  document.getElementById('hint').textContent = (touch ? 'Tap' : 'Click') + ' a tab or a board button · drag the board to tilt it';

  // ---------- Camera framing: fit the scene into the space the reading panel leaves free ----------
  const WIDE = { x0: -0.78, x1: 1.1, y0: -0.36, y1: 1.3, remy: '0.93 -0.32 0.05' };
  const TALL = { x0: -0.77, x1: 0.77, y0: -0.36, y1: 1.3, remy: '0.5 -0.32 0.16' };   // avatar moves in next to the card

  function frame() {
    const W = window.innerWidth, H = window.innerHeight;
    const side = sidebar.matches;
    const top = 64;
    const right = side ? reader.offsetWidth + 32 : 0;
    const bottom = side ? 16 : reader.offsetHeight + 8;
    const uw = Math.max(120, W - right), uh = Math.max(120, H - top - bottom);
    const L = uw / uh < 0.9 ? TALL : WIDE;
    remy.setAttribute('position', L.remy);

    const w = L.x1 - L.x0, h = L.y1 - L.y0, cx = (L.x0 + L.x1) / 2, cy = (L.y0 + L.y1) / 2;
    const tanV = Math.tan(R(camEl.getObject3D('camera').fov) / 2);
    const margin = L === TALL ? 1.04 : 1.1;
    // distance at which the content fits the free area (pixels per world unit = H / (2 d tanV))
    const d = Math.max(w * margin * H / (2 * tanV * uw), h * margin * H / (2 * tanV * uh));
    const k = 2 * d * tanV / H;                                   // world units per pixel at that distance
    const dx = uw / 2 - W / 2, dy = (top + uh / 2) - H / 2;        // free-area centre vs. screen centre (px)
    camEl.object3D.position.set(cx - dx * k, cy + dy * k, d);
    camEl.object3D.rotation.set(0, 0, 0);
  }

  // ---------- Drag to tilt (springs back), tap to press board buttons ----------
  let dragging = false, dragged = false, x0 = 0, y0 = 0, yaw = 0, pitch = 0, tYaw = 0, tPitch = 0;
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
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
  function wirePointer() {
    const c = scene.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', function (e) {
      dragging = true; dragged = false; x0 = e.clientX; y0 = e.clientY;
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    c.addEventListener('pointermove', function (e) {
      if (dragging) {
        const dx = e.clientX - x0, dy = e.clientY - y0;
        if (Math.hypot(dx, dy) > 8) dragged = true;
        tYaw = THREE.MathUtils.clamp(dx * 0.35, -28, 28);
        tPitch = THREE.MathUtils.clamp(dy * 0.12, -8, 8);
      } else if (e.pointerType === 'mouse') {
        c.style.cursor = hotspotAt(e) ? 'pointer' : 'grab';
      }
    });
    function end(e) {
      if (!dragging) return;
      dragging = false; tYaw = 0; tPitch = 0;
      if (!dragged) { const el = hotspotAt(e); if (el) el.emit('click'); }
    }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  AFRAME.registerComponent('view-tick', {
    tick: function (time) {
      const sway = dragging ? 0 : 5 * Math.sin(time / 1500);
      yaw += ((dragging ? tYaw : sway) - yaw) * (dragging ? 0.35 : 0.1);
      pitch += ((dragging ? tPitch : 0) - pitch) * (dragging ? 0.35 : 0.08);
      content.object3D.rotation.set(R(pitch), R(yaw), 0);
    }
  });
  scene.setAttribute('view-tick', '');

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
    layout = r[0];
    buildTabs();
    board = PortfolioBoard.mount({
      layout: layout,
      board: document.getElementById('board'),
      hotspots: hotspots,
      ignoreClick: function () { return dragged; },
      onChange: function (i) { renderReader(i); }
    });
    window.__showPanel = board.show;
    wirePointer();
    frame();
    return modelReady;
  }).then(function () {
    frame();
    ready = true;
    viewBtn.classList.remove('waiting');
    if (wantsView) enterView();
  }).catch(function () {
    viewBtn.querySelector('small').textContent = 'Could not load. Please refresh.';
  });

  let resizeTimer = 0;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(frame, 120); });
})();
