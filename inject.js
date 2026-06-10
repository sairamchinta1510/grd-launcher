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

  // ── Placeholder: touch handlers ─────────────────────────
  // ── Placeholder: toolbar ────────────────────────────────

  console.log('[GRD Touch] Activated. Three-finger swipe up or swipe from bottom edge to open toolbar.');
}());