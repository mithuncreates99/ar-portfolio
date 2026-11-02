/*
 * Portfolio board, shared by the 3D view (index.html) and the AR scan page (scan.html).
 *
 * The board is one textured plane per open panel (assets/board-*.png). board.json lists the
 * buttons on each image in pixels; mount() turns them into invisible clickable planes that sit
 * on top of the board, so taps in 3D switch panels or open links.
 */
(function () {
  'use strict';

  const BOARD_W = 1.5;    // board size in scene units (the card is 1 unit wide)
  const BOARD_H = 0.95;

  function load(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Could not load ' + url);
      return r.json();
    });
  }

  function openLink(url) {
    const w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url;
  }

  /**
   * @param {object} opts
   * @param {object} opts.layout           parsed board.json
   * @param {Element} opts.board           <a-plane> showing the board image
   * @param {Element} opts.hotspots        empty entity on top of the board that receives the click planes
   * @param {function} [opts.ignoreClick]  return true to ignore a click (for example after a drag)
   * @param {function} [opts.onChange]     called with the panel index after a switch
   */
  function mount(opts) {
    const layout = opts.layout;
    let active = 0;

    function toLocal(h) {
      return {
        x: ((h.x + h.w / 2) / layout.width - 0.5) * BOARD_W,
        y: (0.5 - (h.y + h.h / 2) / layout.height) * BOARD_H,
        w: h.w / layout.width * BOARD_W,
        h: h.h / layout.height * BOARD_H
      };
    }

    function show(i) {
      active = i;
      const panel = layout.panels[i];
      opts.board.setAttribute('material', 'src', '#board-' + panel.name.toLowerCase());

      const root = opts.hotspots;
      while (root.firstChild) root.removeChild(root.firstChild);
      panel.hotspots.forEach(function (h) {
        const p = toLocal(h);
        const el = document.createElement('a-plane');
        el.setAttribute('class', 'clickable');
        el.setAttribute('position', p.x + ' ' + p.y + ' 0');
        el.setAttribute('width', p.w);
        el.setAttribute('height', p.h);
        el.setAttribute('material', 'shader: flat; transparent: true; opacity: 0; depthWrite: false');
        el.dataset.type = h.type;
        el.addEventListener('click', function () {
          if (opts.ignoreClick && opts.ignoreClick()) return;
          if (h.type === 'panel') { if (h.index !== active) show(h.index); }
          else if (h.type === 'link') { openLink(h.url); }
        });
        root.appendChild(el);
      });
      if (opts.onChange) opts.onChange(i, panel.name);
    }

    show(0);
    return { show: show, active: function () { return active; } };
  }

  window.PortfolioBoard = { load: load, mount: mount, openLink: openLink, WIDTH: BOARD_W, HEIGHT: BOARD_H };
})();
