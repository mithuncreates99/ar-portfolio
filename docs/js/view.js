/*
 * 3D view: the same unfolding display as in AR (assets/ar/portfolio-web.glb), without a camera.
 * - The reveal plays once, then the idle part (bobbing, waving) loops.
 * - Tap a section (or its chip) and the camera flies smoothly in to it; tap it again or "All" to fly back out.
 * - While zoomed in: swipe, the ‹ › arrows or the arrow keys move to the next section; Esc zooms out.
 * - In the overview, drag to look around a little; the view springs back when you let go.
 */
(function () {
  'use strict';

  const V = '20261103c';
  const MODEL = 'assets/ar/portfolio-web.glb?v=' + V;
  const IDS = ['about', 'education', 'skills', 'projects', 'awards', 'connect'];
  const INTRO_START = 1.2, INTRO_END = 6.9, DURATION = 30;     // seconds on the baked timeline
  const FLY = 750;                                              // camera flight, ms

  const scene = document.getElementById('scene');
  const camEl = document.getElementById('cam');
  const modelEl = document.getElementById('model');
  const welcome = document.getElementById('welcome');
  const viewBtn = document.getElementById('view');
  const bar = document.getElementById('bar');
  const hint = document.getElementById('bar-hint');
  const chips = document.getElementById('chips');
  const linksBox = document.getElementById('f-links');
  const prevBtn = document.getElementById('prev'), nextBtn = document.getElementById('next');
  const touch = window.matchMedia('(pointer: coarse)').matches;

  let names = ['About', 'Education', 'Skills', 'Projects', 'Awards', 'Connect'], links = [];
  let mixer = null, t = INTRO_START, playing = false;
  let focus = -1;                   // -1 = overview, otherwise index into IDS
  let yaw = 0, pitch = 0, tYaw = 0, tPitch = 0;
  let tween = null;
  const tiles = {};                 // id -> { center, normal, size }
  let overview = null;              // { center, size }

  // ---------- WebGL check ----------
  function hasWebGL() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  }
  function showFallback(layout) {
    const box = document.getElementById('fallback');
    box.hidden = false;
    box.innerHTML = '<p>Your browser can\'t show 3D, so here is my portfolio as images. ' +
      '<a href="https://mithuncreates99.github.io">Portfolio website</a> · <a href="https://github.com/mithuncreates99">GitHub</a></p>';
    (layout ? layout.panels : []).forEach(function (p) {
      const img = document.createElement('img'); img.src = 'assets/' + p.image; img.alt = p.name; box.appendChild(img);
    });
    welcome.classList.add('done');
  }

  // ---------- section names and links (same source as the board) ----------
  const layoutReady = fetch('assets/board.json?v=' + V).then(function (r) { return r.json(); }).then(function (d) {
    names = d.panels.map(function (p) { return p.name; });
    const c = d.panels.find(function (p) { return p.links && p.links.length; });
    links = c ? c.links : [];
    return d;
  }).catch(function () { return null; });

  // ---------- welcome screen; the model only downloads when the 3D view is opened ----------
  let ready = false, wantsView = location.hash === '#view', loading = false;
  function enterView() {
    wantsView = true;
    if (!loading) load();
    if (!ready) { viewBtn.classList.add('waiting'); return; }
    welcome.classList.add('done');
    if (location.hash !== '#view') history.replaceState(null, '', '#view');
    playing = true;
  }
  viewBtn.addEventListener('click', enterView);

  // ---------- UI ----------
  function buildChips() {
    ['All'].concat(names).forEach(function (label, k) {
      const b = document.createElement('button');
      b.className = 'tab'; b.type = 'button'; b.textContent = label;
      b.addEventListener('click', function () { if (k === 0) zoomOut(); else zoomTo(k - 1); });
      chips.appendChild(b);
    });
  }
  function updateUI() {
    chips.querySelectorAll('.tab').forEach(function (b, k) {
      const on = (k === 0 && focus < 0) || k - 1 === focus;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
    if (t < INTRO_END && focus < 0) hint.textContent = (touch ? 'Tap' : 'Click') + ' to skip the intro';
    else if (focus < 0) hint.textContent = (touch ? 'Tap' : 'Click') + ' a section to zoom in · drag to look around';
    else hint.textContent = touch ? 'Swipe for the next section · tap it again to zoom out' : '← → for the next section · click it again or Esc to zoom out';
    const showLinks = focus >= 0 && IDS[focus] === 'connect' && links.length > 0;
    linksBox.hidden = !showLinks;
    if (showLinks && !linksBox.childElementCount) {
      links.forEach(function (l) {
        const a = document.createElement('a'); a.href = l.url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = l.label + ' '; const s = document.createElement('span'); s.textContent = '↗'; a.appendChild(s);
        linksBox.appendChild(a);
      });
    }
    prevBtn.classList.toggle('show', focus >= 0 && !touch);
    nextBtn.classList.toggle('show', focus >= 0 && !touch);
  }
  prevBtn.addEventListener('click', function () { step(-1); });
  nextBtn.addEventListener('click', function () { step(1); });
  window.addEventListener('keydown', function (e) {
    if (!welcome.classList.contains('done')) return;
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Escape') zoomOut();
  });

  // ---------- camera poses ----------
  const UP = new THREE.Vector3(0, 1, 0);
  function insets() { return { top: 64, bottom: bar.offsetHeight + 4, side: focus >= 0 && !touch ? 64 : 12 }; }
  // camera that fits a w x h rectangle (world units) centred at `center`, seen along `normal`,
  // inside the part of the screen the header and bottom bar leave free
  function fitPose(center, normal, w, h, margin) {
    const W = window.innerWidth, H = window.innerHeight, ins = insets();
    const uw = Math.max(100, W - 2 * ins.side), uh = Math.max(100, H - ins.top - ins.bottom);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camEl.getObject3D('camera').fov) / 2);
    const d = Math.max(w * margin * H / (2 * tanV * uw), h * margin * H / (2 * tanV * uh));
    const k = 2 * d * tanV / H;                                       // world units per pixel at distance d
    const dy = (ins.top + uh / 2) - H / 2;                            // free-area centre vs screen centre (px)
    const aim = center.clone().addScaledVector(UP, dy * k);           // shift so the target sits in the free area
    const pos = aim.clone().addScaledVector(normal, d);
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, aim, UP));
    return { pos: pos, quat: quat };
  }
  function overviewPose() {
    const R = THREE.MathUtils.degToRad;
    const n = new THREE.Vector3(Math.sin(R(yaw)), Math.sin(R(pitch)) + 0.12, Math.cos(R(yaw))).normalize();
    return fitPose(overview.center, n, overview.size.x, overview.size.y, window.innerWidth / window.innerHeight < 0.8 ? 1.04 : 1.1);
  }
  function tilePose(i) { const s = tiles[IDS[i]]; return fitPose(s.center, s.normal, s.size.x, s.size.y, 1.08); }
  function flyTo(pose) {
    const cam = camEl.object3D;
    tween = { t0: performance.now(), fromPos: cam.position.clone(), fromQuat: cam.quaternion.clone(), to: pose };
  }
  function zoomTo(i) {
    if (!overview) return;
    if (t < INTRO_END) t = INTRO_END;            // skip the intro if it is still running
    focus = (i + IDS.length) % IDS.length;
    tYaw = tPitch = 0; yaw = pitch = 0;
    flyTo(tilePose(focus)); updateUI();
  }
  function zoomOut() {
    if (focus < 0) return;
    focus = -1; flyTo(overviewPose()); updateUI();
  }
  function step(d) { if (focus >= 0) zoomTo(focus + d); }

  // ---------- measure the finished display once the model is in ----------
  function measure(root) {
    mixer.setTime(INTRO_END + 2); root.updateMatrixWorld(true);
    const all = new THREE.Box3();
    root.traverse(function (o) {
      const m = /^(Tile|Header|Avatar|Card)(_(\w+))?$/.exec(o.name);
      if (!m) return;
      const b = new THREE.Box3().setFromObject(o, true);
      if (!b.isEmpty()) all.union(b);
      if (m[1] === 'Tile') {
        const q = new THREE.Quaternion(); o.getWorldQuaternion(q);
        tiles[m[3]] = { center: b.getCenter(new THREE.Vector3()), normal: new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize(),
          size: new THREE.Vector2(0.58 * 0.76, 0.58 * 860 / 1200 * 0.76) };
      }
    });
    overview = { center: all.getCenter(new THREE.Vector3()), size: all.getSize(new THREE.Vector3()) };
    mixer.setTime(t);
  }

  // ---------- pointer: tap to zoom, swipe between sections, drag to look around ----------
  let down = null, dragged = false;
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function sectionAt(e) {
    const rect = scene.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camEl.getObject3D('camera'));
    const hits = raycaster.intersectObject(modelEl.object3D, true);
    for (const h of hits) {
      for (let o = h.object; o; o = o.parent) {
        const m = /^(Tile|TapOpen|TapClose|Focus)_(\w+)$/.exec(o.name);
        if (m && IDS.indexOf(m[2]) >= 0) return IDS.indexOf(m[2]);
      }
    }
    return -1;
  }
  function wirePointer() {
    const c = scene.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', function (e) {
      down = { x: e.clientX, y: e.clientY }; dragged = false;
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    c.addEventListener('pointermove', function (e) {
      if (!down) {
        if (e.pointerType === 'mouse' && overview) c.style.cursor = sectionAt(e) >= 0 ? 'pointer' : (focus < 0 ? 'grab' : 'zoom-out');
        return;
      }
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 8) dragged = true;
      if (focus < 0 && dragged) { tYaw = THREE.MathUtils.clamp(-dx * 0.12, -22, 22); tPitch = THREE.MathUtils.clamp(dy * 0.05, -6, 10); }
    });
    function up(e) {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down = null; tYaw = 0; tPitch = 0;
      if (!overview) return;
      if (focus >= 0 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) { step(dx < 0 ? 1 : -1); return; }   // swipe
      if (dragged) return;
      if (t < INTRO_END && focus < 0) { t = INTRO_END; updateUI(); return; }                                       // skip intro
      const i = sectionAt(e);
      if (focus >= 0 && (i < 0 || i === focus)) zoomOut();
      else if (i >= 0) zoomTo(i);
    }
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', function () { down = null; tYaw = tPitch = 0; });
  }

  // ---------- per frame: timeline, look-around spring, camera flights ----------
  const ease = function (u) { return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  AFRAME.registerComponent('view-tick', {
    tick: function (time, dt) {
      if (!mixer || !overview) return;
      if (playing) {
        const before = t;
        t += Math.min(dt, 100) / 1000;
        if (t >= DURATION) t = INTRO_END + ((t - INTRO_END) % (DURATION - INTRO_END));   // loop only the idle part
        if (before < INTRO_END && t >= INTRO_END) updateUI();
      }
      mixer.setTime(t);
      const cam = camEl.object3D;
      if (tween) {
        const u = Math.min(1, (performance.now() - tween.t0) / FLY), e = ease(u);
        cam.position.lerpVectors(tween.fromPos, tween.to.pos, e);
        cam.quaternion.slerpQuaternions(tween.fromQuat, tween.to.quat, e);
        if (u === 1) tween = null;
      } else if (focus < 0) {
        yaw += (tYaw - yaw) * (down ? 0.3 : 0.08);
        pitch += (tPitch - pitch) * (down ? 0.3 : 0.08);
        const p = overviewPose(); cam.position.copy(p.pos); cam.quaternion.copy(p.quat);
      }
    }
  });
  scene.setAttribute('view-tick', '');

  // ---------- load ----------
  function load() {
    loading = true;
    if (!hasWebGL()) { layoutReady.then(showFallback); return; }
    const sceneReady = new Promise(function (r) { if (scene.hasLoaded) r(); else scene.addEventListener('loaded', r); });
    const modelReady = new Promise(function (resolve, reject) {
      modelEl.addEventListener('model-loaded', resolve, { once: true });
      modelEl.addEventListener('model-error', reject, { once: true });
    });
    sceneReady.then(function () { modelEl.setAttribute('gltf-model', 'url(' + MODEL + ')'); });
    Promise.all([layoutReady, modelReady]).then(function () {
      const root = modelEl.getObject3D('mesh');
      const clips = modelEl.components['gltf-model'].model.animations || [];
      mixer = new THREE.AnimationMixer(root);
      if (clips[0]) mixer.clipAction(clips[0]).play();
      root.traverse(function (o) { o.frustumCulled = false; });
      buildChips();
      measure(root);
      wirePointer();
      const p = overviewPose(); camEl.object3D.position.copy(p.pos); camEl.object3D.quaternion.copy(p.quat);
      updateUI();
      ready = true;
      viewBtn.classList.remove('waiting');
      if (wantsView) enterView();
    }).catch(function () {
      viewBtn.querySelector('small').textContent = 'Could not load. Please refresh.';
      viewBtn.classList.remove('waiting');
    });
  }
  if (wantsView) { welcome.style.transition = 'none'; enterView(); }   // ./#view opens the 3D view directly

  let resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!overview) return;
      const p = focus >= 0 ? tilePose(focus) : overviewPose();
      tween = null; camEl.object3D.position.copy(p.pos); camEl.object3D.quaternion.copy(p.quat);
    }, 120);
  });

  window.__view = { zoomTo: zoomTo, zoomOut: zoomOut, state: function () { return { focus: focus, t: t, ready: ready }; },
    tileScreen: function (i) {   // for automated tests: where a section's centre is on screen
      const v = tiles[IDS[i]].center.clone().project(camEl.getObject3D('camera'));
      return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
    } };
})();
