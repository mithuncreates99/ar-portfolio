/*
 * "See it in AR" without the card: hands the baked scene to the phone's own AR viewer.
 *   iPhone / iPad  -> AR Quick Look (assets/ar/portfolio.usdz), with a button that opens my portfolio site
 *   Android        -> Google Scene Viewer (assets/ar/portfolio.glb), with the same link
 *   Laptop         -> a QR code to open this page on a phone
 * Both viewers place the display at a fixed, comfortable size on a real floor and play the reveal; you walk closer to read.
 */
(function () {
  'use strict';

  const SITE = 'https://mithuncreates99.github.io';
  const TITLE = 'Mithun Kumar Vijayakumar';
  const SUBTITLE = 'AR Portfolio · NEOMA MiM · B.Tech IT';
  const abs = function (path) { return new URL(path, window.location.href).href; };

  const ua = navigator.userAgent;
  const isAndroid = /android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const quickLook = (function () {
    const a = document.createElement('a');
    return !!(a.relList && a.relList.supports && a.relList.supports('ar'));
  })();

  const modal = document.getElementById('ar-modal');
  function show(kind) {
    modal.querySelectorAll('[data-kind]').forEach(function (el) { el.hidden = el.dataset.kind !== kind; });
    modal.hidden = false;
  }
  modal.addEventListener('click', function (e) { if (e.target === modal || e.target.closest('[data-close]')) modal.hidden = true; });

  function openQuickLook() {
    const a = document.createElement('a');
    a.rel = 'ar';
    // fixed real-world size (no pinch-to-resize), plus a button that opens my portfolio site
    a.href = 'assets/ar/portfolio.usdz?v=20261103#allowsContentScaling=0&callToAction=' + encodeURIComponent('Open my portfolio') +
      '&checkoutTitle=' + encodeURIComponent(TITLE) + '&checkoutSubtitle=' + encodeURIComponent(SUBTITLE);
    a.appendChild(document.createElement('img'));      // Quick Look links need an image child
    a.style.display = 'none';
    a.addEventListener('message', function (e) {         // the button inside Quick Look was tapped
      if (e.data === '_apple_ar_quicklook_button_tapped') window.location.href = SITE;
    }, false);
    document.body.appendChild(a);
    a.click();
  }

  function sceneViewerUrl() {
    const params = 'file=' + encodeURIComponent(abs('assets/ar/portfolio.glb?v=20261103')) +
      '&mode=ar_preferred&resizable=false' +
      '&title=' + encodeURIComponent(TITLE + ' · AR Portfolio') +
      '&link=' + encodeURIComponent(SITE);
    const fallback = encodeURIComponent(abs('./#view'));
    return 'intent://arvr.google.com/scene-viewer/1.0?' + params +
      '#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;' +
      'S.browser_fallback_url=' + fallback + ';end;';
  }
  function openSceneViewer() { window.location.href = sceneViewerUrl(); }

  function launch() {
    if (quickLook) return openQuickLook();
    if (isAndroid) return openSceneViewer();
    if (isIOS) return show('safari');                    // e.g. inside the LinkedIn or Instagram app
    show('qr');                                          // laptop / desktop
  }

  document.querySelectorAll('[data-ar]').forEach(function (b) { b.addEventListener('click', launch); });
  window.__ar = { quickLook: quickLook, isAndroid: isAndroid, isIOS: isIOS, sceneViewerUrl: sceneViewerUrl };
})();
