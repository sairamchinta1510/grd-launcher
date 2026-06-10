(function () {
  'use strict';

  // ── Guards ──────────────────────────────────────────────
  if (location.hostname !== 'remotedesktop.google.com') {
    console.warn('[GRD Touch] Must be on remotedesktop.google.com');
    return;
  }
  if (document.getElementById('grd-overlay')) {
    console.warn('[GRD Touch] Already active');
    return;
  }

  const canvas = document.querySelector('canvas');
  if (!canvas) {
    alert('[GRD Touch] No canvas found. Connect to a machine first, then tap the bookmark.');
    return;
  }

  // ── State ───────────────────────────────────────────────
  let sensitivity  = parseFloat(localStorage.getItem('grd_sensitivity') || '1.5');
  let zoomLevel    = 1;
  let panX         = 0;
  let panY         = 0;
  const r0 = canvas.getBoundingClientRect();
  let cur          = { x: r0.width / 2, y: r0.height / 2 };

  // ── Styles ──────────────────────────────────────────────
  const style = document.createElement('style');
  style.id = 'grd-inject-styles';
  style.textContent = `
    #grd-overlay {
      position: fixed;
      inset: 0;
      z-index: 99998;
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
    }
    #grd-cursor {
      position: fixed;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: rgba(255,255,255,0.85);
      border: 1.5px solid rgba(0,0,0,0.4);
      pointer-events: none;
      z-index: 99999;
      transform: translate(-50%, -50%);
      transition: top 0.04s linear, left 0.04s linear;
    }
    #grd-toolbar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #16213e;
      border-top: 1px solid #0f3460;
      border-radius: 20px 20px 0 0;
      padding: 12px 16px max(16px, env(safe-area-inset-bottom));
      z-index: 100000;
      transform: translateY(100%);
      transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      touch-action: none;
    }
    #grd-toolbar.open { transform: translateY(0); }
    #grd-toolbar-handle {
      width: 36px; height: 4px;
      background: #444; border-radius: 2px;
      margin: 0 auto 14px;
    }
    #grd-toolbar-buttons {
      display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;
    }
    .grd-btn {
      background: #0f3460;
      color: #e0e0e0;
      border: none;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      font-family: system-ui, sans-serif;
      cursor: pointer;
      min-height: 44px;
      min-width: 44px;
      -webkit-tap-highlight-color: transparent;
    }
    .grd-btn:active { background: #e94560; color: #fff; }
    .grd-btn-primary {
      background: #e94560; color: #fff;
    }
    #grd-sensitivity-row {
      display: flex; align-items: center; gap: 10px;
      color: #888; font-size: 12px; font-family: system-ui, sans-serif;
    }
    #grd-sensitivity-row input[type=range] { flex: 1; }
    #grd-hidden-input {
      position: fixed; left: -9999px; top: -9999px;
      width: 1px; height: 1px; opacity: 0;
    }
  `;
  document.head.appendChild(style);

  // ── Overlay ─────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'grd-overlay';
  document.body.appendChild(overlay);

  // ── Cursor dot ──────────────────────────────────────────
  const dot = document.createElement('div');
  dot.id = 'grd-cursor';
  document.body.appendChild(dot);

  function updateDot() {
    const r = canvas.getBoundingClientRect();
    dot.style.left = (r.left + cur.x) + 'px';
    dot.style.top  = (r.top  + cur.y) + 'px';
  }
  updateDot();

  // ── Helpers ─────────────────────────────────────────────
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function pinchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function applyZoom() {
    canvas.style.transformOrigin = '0 0';
    canvas.style.transform = `scale(${zoomLevel}) translate(${panX}px, ${panY}px)`;
  }

  function moveCursor(dx, dy) {
    const r = canvas.getBoundingClientRect();
    cur.x = clamp(cur.x + dx * sensitivity, 0, r.width  / zoomLevel);
    cur.y = clamp(cur.y + dy * sensitivity, 0, r.height / zoomLevel);
    updateDot();
    const r2 = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true, cancelable: true,
      clientX: r2.left + cur.x * zoomLevel,
      clientY: r2.top  + cur.y * zoomLevel,
      buttons: 0,
    }));
  }

  function sendMouseEvent(type, button, buttons) {
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true,
      clientX: r.left + cur.x * zoomLevel,
      clientY: r.top  + cur.y * zoomLevel,
      button, buttons,
    }));
  }

  function sendClick() {
    sendMouseEvent('mousedown', 0, 1);
    sendMouseEvent('mouseup',   0, 0);
    sendMouseEvent('click',     0, 0);
  }

  function sendRightClick() {
    sendMouseEvent('mousedown',   2, 2);
    sendMouseEvent('mouseup',     2, 0);
    sendMouseEvent('contextmenu', 2, 0);
  }

  function sendKey(key, mods) {
    const opts = Object.assign({ key, bubbles: true, cancelable: true }, mods || {});
    canvas.dispatchEvent(new KeyboardEvent('keydown', opts));
    canvas.dispatchEvent(new KeyboardEvent('keyup',   opts));
  }

  function sendScroll(deltaX, deltaY) {
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true,
      clientX: r.left + cur.x * zoomLevel,
      clientY: r.top  + cur.y * zoomLevel,
      deltaX, deltaY, deltaMode: 0,
    }));
  }

  // ── Touch state ──────────────────────────────────────────
  const ts = {
    startTouches:  null,
    lastTouches:   null,
    startTime:     0,
    maxTravel:     0,
    lastPinchDist: null,
    edgeSwipe:     false,
  };

  // ── Touch handlers ───────────────────────────────────────
  overlay.addEventListener('touchstart', function (e) {
    e.preventDefault();
    ts.startTouches  = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
    ts.lastTouches   = ts.startTouches.slice();
    ts.startTime     = Date.now();
    ts.maxTravel     = 0;
    ts.lastPinchDist = e.touches.length === 2 ? pinchDist(e.touches) : null;
    ts.edgeSwipe     = e.touches.length === 1 && e.touches[0].clientY > window.innerHeight - 20;
  }, { passive: false });

  overlay.addEventListener('touchmove', function (e) {
    e.preventDefault();
    const touches = Array.from(e.touches);
    const n = touches.length;

    if (n === 1) {
      const prev = ts.lastTouches[0];
      const curr = { x: touches[0].clientX, y: touches[0].clientY };
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      ts.maxTravel += Math.hypot(dx, dy);

      if (ts.edgeSwipe && dy < -30) {
        openToolbar();
        ts.edgeSwipe = false;
      } else if (!ts.edgeSwipe) {
        if (zoomLevel > 1.05) {
          panX += dx / zoomLevel;
          panY += dy / zoomLevel;
          applyZoom();
        } else {
          moveCursor(dx, dy);
        }
      }
      ts.lastTouches = [curr];

    } else if (n === 2) {
      const prev0 = ts.lastTouches[0];
      const prev1 = ts.lastTouches[1] || ts.lastTouches[0];
      const curr0 = { x: touches[0].clientX, y: touches[0].clientY };
      const curr1 = { x: touches[1].clientX, y: touches[1].clientY };
      const newDist = pinchDist(e.touches);

      if (ts.lastPinchDist && Math.abs(newDist - ts.lastPinchDist) > 3) {
        zoomLevel = clamp(zoomLevel * (newDist / ts.lastPinchDist), 0.5, 3);
        if (zoomLevel <= 1.05) { zoomLevel = 1; panX = 0; panY = 0; }
        applyZoom();
      } else {
        const centerDx = ((curr0.x + curr1.x) - (prev0.x + (prev1 ? prev1.x : prev0.x))) / 2;
        const centerDy = ((curr0.y + curr1.y) - (prev0.y + (prev1 ? prev1.y : prev0.y))) / 2;
        sendScroll(-centerDx * 4, -centerDy * 4);
      }
      ts.maxTravel += Math.hypot(curr0.x - prev0.x, curr0.y - prev0.y);
      ts.lastPinchDist = newDist;
      ts.lastTouches = [curr0, curr1];

    } else if (n === 3) {
      const prevCY = ts.lastTouches.slice(0, 3).reduce((s, t) => s + t.y, 0) / Math.min(ts.lastTouches.length, 3);
      const currCY = touches.reduce((s, t) => s + t.clientY, 0) / 3;
      if (prevCY - currCY > 30) openToolbar();
      ts.lastTouches = touches.map(t => ({ x: t.clientX, y: t.clientY }));
    }
  }, { passive: false });

  overlay.addEventListener('touchend', function (e) {
    e.preventDefault();
    const duration    = Date.now() - ts.startTime;
    const startCount  = ts.startTouches ? ts.startTouches.length : 0;
    const isTap       = duration < 250 && ts.maxTravel < 8;

    if (isTap && !toolbarOpen) {
      if      (startCount === 1) sendClick();
      else if (startCount === 2) sendRightClick();
    }

    ts.startTouches = null;
    ts.lastTouches  = null;
    ts.lastPinchDist = null;
  }, { passive: false });
  // ── Hidden keyboard input ────────────────────────────────
  const hiddenInput = document.createElement('input');
  hiddenInput.id = 'grd-hidden-input';
  hiddenInput.setAttribute('autocorrect',    'off');
  hiddenInput.setAttribute('autocapitalize', 'off');
  hiddenInput.setAttribute('autocomplete',   'off');
  hiddenInput.setAttribute('spellcheck',     'false');
  hiddenInput.type = 'text';
  document.body.appendChild(hiddenInput);

  hiddenInput.addEventListener('input', function () {
    const val = hiddenInput.value;
    for (const ch of val) sendKey(ch);
    hiddenInput.value = '';
  });

  // ── Toolbar ──────────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.id = 'grd-toolbar';
  toolbar.innerHTML = `
    <div id="grd-toolbar-handle"></div>
    <div id="grd-toolbar-buttons">
      <button class="grd-btn grd-btn-primary" id="grd-kb-btn">⌨️ Keyboard</button>
      <button class="grd-btn" data-key="c"     data-ctrl="1">Ctrl+C</button>
      <button class="grd-btn" data-key="v"     data-ctrl="1">Ctrl+V</button>
      <button class="grd-btn" data-key="z"     data-ctrl="1">Ctrl+Z</button>
      <button class="grd-btn" data-key="a"     data-ctrl="1">Ctrl+A</button>
      <button class="grd-btn" data-key="Escape"              >Esc</button>
      <button class="grd-btn" data-key="Tab"                 >Tab</button>
      <button class="grd-btn" data-key="Meta"                >Win</button>
      <button class="grd-btn" data-key="Tab"  data-alt="1"   >Alt+Tab</button>
    </div>
    <div id="grd-sensitivity-row">
      <span>🐢</span>
      <input type="range" id="grd-sens-slider" min="0.5" max="3" step="0.1" value="${sensitivity}">
      <span>🐇</span>
    </div>
    <div style="text-align:right;margin-top:10px">
      <button class="grd-btn" id="grd-close-btn">✕ Close Touch Controls</button>
    </div>
  `;
  document.body.appendChild(toolbar);

  // Wire shortcut buttons
  toolbar.querySelectorAll('.grd-btn[data-key]').forEach(function (btn) {
    btn.addEventListener('touchend', function (e) {
      e.stopPropagation();
      sendKey(btn.dataset.key, {
        ctrlKey: btn.dataset.ctrl === '1',
        altKey:  btn.dataset.alt  === '1',
      });
    });
  });

  // Wire keyboard button
  document.getElementById('grd-kb-btn').addEventListener('touchend', function (e) {
    e.stopPropagation();
    hiddenInput.focus();
  });

  // Wire sensitivity slider
  document.getElementById('grd-sens-slider').addEventListener('input', function () {
    sensitivity = parseFloat(this.value);
    localStorage.setItem('grd_sensitivity', String(sensitivity));
  });

  // ── Toolbar open / close ─────────────────────────────────
  let toolbarOpen = false;

  function openToolbar() {
    if (toolbarOpen) return;
    toolbarOpen = true;
    toolbar.classList.add('open');
  }

  function closeToolbar() {
    toolbarOpen = false;
    toolbar.classList.remove('open');
    hiddenInput.blur();
  }

  // Swipe toolbar down to close
  let tbDragStartY = null;
  toolbar.addEventListener('touchstart', function (e) {
    tbDragStartY = e.touches[0].clientY;
  }, { passive: true });
  toolbar.addEventListener('touchmove', function (e) {
    if (tbDragStartY !== null && e.touches[0].clientY - tbDragStartY > 40) {
      closeToolbar();
      tbDragStartY = null;
    }
  }, { passive: true });
  toolbar.addEventListener('touchend', function () { tbDragStartY = null; }, { passive: true });

  // Tap overlay outside toolbar to close toolbar
  overlay.addEventListener('touchend', function () {
    if (toolbarOpen) closeToolbar();
  }, { passive: true });

  // Wire close button — destroy entire overlay
  document.getElementById('grd-close-btn').addEventListener('touchend', function (e) {
    e.stopPropagation();
    destroy();
  });

  // ── Destroy ──────────────────────────────────────────────
  function destroy() {
    overlay.remove();
    dot.remove();
    toolbar.remove();
    hiddenInput.remove();
    style.remove();
    canvas.style.transform      = '';
    canvas.style.transformOrigin = '';
    console.log('[GRD Touch] Deactivated.');
  }

  console.log('[GRD Touch] Activated. Three-finger swipe up or swipe from bottom edge to open toolbar.');
}());