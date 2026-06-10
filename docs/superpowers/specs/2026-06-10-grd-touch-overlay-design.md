# GRD Touch Overlay — Design Spec
**Date:** 2026-06-10
**Status:** Approved

---

## Problem

Once inside a Google Remote Desktop session on iPhone, the interface is unusable:
- Mouse movement requires tiny drag targets
- Scrolling is erratic
- Keyboard is hard to trigger
- No touch gestures map naturally to desktop actions

Google blocks iframe embedding, so a wrapper page is not possible. We need to inject a control layer into the existing GRD page.

---

## Solution

Two additions to the existing `grd-launcher` GitHub Pages repo:

1. **`inject.js`** — A script loaded by a Safari bookmarklet that transforms GRD into a full-screen trackpad with iOS-native gesture control.
2. **`panel.html`** — A companion page in the launcher for bookmarklet setup, clipboard text input, and gesture reference.

---

## Scope

- Personal use, iPhone Safari
- No PC software required
- No server component — all static files on GitHub Pages
- Extends the existing `grd-launcher` repo (no new repo)

---

## File Structure

```
grd-launcher/
├── index.html      ← existing launcher (add Panel button)
├── inject.js       ← NEW: injected into GRD by bookmarklet
└── panel.html      ← NEW: companion panel page
```

---

## Part A — `inject.js`

### Entry Point

The bookmarklet that loads this script:
```
javascript:(function(){var s=document.createElement('script');s.src='https://sairamchinta1510.github.io/grd-launcher/inject.js?_='+Date.now();document.head.appendChild(s);})();
```

The `?_=Date.now()` cache-busting ensures the latest version always loads.

On load, `inject.js`:
1. Checks `location.hostname === 'remotedesktop.google.com'` — aborts with a console warning if not on GRD
2. Prevents double-injection (checks for existing `#grd-overlay` element)
3. Finds the GRD canvas: `document.querySelector('canvas')`
4. Builds and mounts the overlay + toolbar

### Virtual Cursor

A plain object tracks the current pointer position within the canvas:
```js
let cur = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
```

- Clamped to `[0, canvas.clientWidth]` × `[0, canvas.clientHeight]` at all times
- A small dot element (12px circle, semi-transparent white, `pointer-events:none`) is positioned absolutely over the canvas to show cursor position

### Full-Screen Overlay

A `<div id="grd-overlay">` is absolutely positioned over the canvas (same bounding rect, updated on resize via `ResizeObserver`). All touch events are captured here. `preventDefault()` is called on all touch events to suppress native scroll/zoom conflicts.

### Gesture Recognition

All gesture logic is in the `touchstart` / `touchmove` / `touchend` handlers on the overlay.

| Touches | Gesture | Action |
|---------|---------|--------|
| 1 finger, drag | Relative move | `mousemove` on canvas at `cur` |
| 1 finger, tap (< 250ms, < 8px travel) | Left click | `mousedown` + `mouseup` + `click` at `cur` |
| 2 fingers, tap (< 250ms) | Right click | `mousedown(button=2)` + `mouseup(button=2)` + `contextmenu` at `cur` |
| 2 fingers, drag | Scroll | `wheel` event at `cur`, `deltaX`/`deltaY` from touch delta × scroll sensitivity |
| 2 fingers, pinch | Zoom canvas | CSS `transform: scale(n)` on canvas wrapper, clamped to 0.5–3× |
| 3 fingers, swipe up | Open toolbar | `openToolbar()` |
| 1 finger starting in bottom 20px | Open toolbar | `openToolbar()` |

**Sensitivity:** Default multiplier `1.5`. Adjustable via toolbar slider (0.5 – 3.0). Persisted in `localStorage` under `grd_sensitivity`.

**Mouse events** are dispatched via:
```js
canvas.dispatchEvent(new MouseEvent(type, {
  bubbles: true, cancelable: true,
  clientX: canvasRect.left + cur.x,
  clientY: canvasRect.top  + cur.y,
  button, buttons
}));
```

### Toolbar (Bottom Sheet)

`<div id="grd-toolbar">` — fixed, bottom of screen, slides up via CSS transform transition.

**Trigger:** 3-finger swipe up OR swipe from bottom 20px of screen.
**Dismiss:** Tap overlay outside toolbar, or swipe toolbar down.

Contents (single scrollable row of pill buttons + keyboard section):

| Button | Action |
|--------|--------|
| ⌨️ Keyboard | Focuses `#grd-hidden-input`, triggers iOS native keyboard; `input` event forwards characters as `KeyboardEvent` to canvas |
| Ctrl+C | `sendKey('c', { ctrlKey: true })` |
| Ctrl+V | `sendKey('v', { ctrlKey: true })` |
| Ctrl+Z | `sendKey('z', { ctrlKey: true })` |
| Ctrl+A | `sendKey('a', { ctrlKey: true })` |
| Esc | `sendKey('Escape')` |
| Tab | `sendKey('Tab')` |
| Win | `sendKey('Meta')` |
| Alt+Tab | `sendKey('Tab', { altKey: true })` |
| ⊕ / ⊖ Speed | Sensitivity slider |
| ✕ Close | Dismisses toolbar, removes overlay and restores GRD to normal |

**Hidden input** (`#grd-hidden-input`): a 1×1px off-screen `<input>` that captures iOS keyboard input. On `input` event, each character is sent as a `KeyboardEvent` to the canvas, then the input is cleared.

**`sendKey` helper:**
```js
function sendKey(key, mods = {}) {
  const opts = { key, bubbles: true, cancelable: true, ...mods };
  canvas.dispatchEvent(new KeyboardEvent('keydown', opts));
  canvas.dispatchEvent(new KeyboardEvent('keyup',   opts));
}
```

### Zoom

Pinch gesture adjusts a `zoomLevel` variable (clamped 0.5–3). The canvas wrapper receives `transform: scale(zoomLevel) translate(panX, panY)`. Pan (offsetting the scaled canvas) is adjusted by 1-finger drag when `zoomLevel > 1` (zoom mode) vs. sending mouse events (trackpad mode). Mode switches automatically based on zoom level: `> 1.05` = zoom/pan mode, `≤ 1.05` = trackpad mode.

### Styles

All styles are injected via a `<style id="grd-inject-styles">` element. No external CSS. Dark theme matching the launcher palette (`#1a1a2e`, `#16213e`, `#e94560`).

---

## Part B — `panel.html`

Standalone page served from `grd-launcher/panel.html`. Linked from `index.html` with a new **"Touch Controls"** button below the machine list.

### Sections

#### 1. Bookmarklet Setup

Step-by-step instructions:
1. **Copy** — large button that copies the bookmarklet `javascript:...` URL to clipboard
2. Instructions: "In Safari, bookmark any page → Edit the bookmark → Replace the URL with what you just copied → Name it 'GRD Touch'"
3. "Next time you open GRD, tap this bookmark to activate touch controls"

#### 2. Text → Clipboard

- Large `<textarea>` with placeholder "Type or paste text to send to your remote PC"
- **Copy to Clipboard** button — copies textarea value, shows ✅ confirmation for 2s
- Note: "Switch to GRD and press Ctrl+V to paste"

#### 3. Gesture Reference Card

Compact visual cheat sheet (icon + label pairs) for all gestures. Read-only, no interaction.

### Styling

Matches `index.html` dark theme (same CSS variables). Single HTML file, no external dependencies.

---

## `index.html` Change

Add a **"⚙️ Touch Controls"** button to the footer area (above the existing "+ Add Machine" button). Tapping navigates to `panel.html`.

---

## Out of Scope

- Android support (Android GRD has better native touch; iOS is the pain point)
- Storing cursor position across sessions
- Mouse acceleration curves
- Any server-side component

---

## Success Criteria

1. Tap bookmark on remotedesktop.google.com → overlay activates, cursor dot appears
2. Single-finger drag → cursor moves smoothly on remote desktop
3. Tap → click registers on remote at cursor position
4. 3-finger swipe up → toolbar slides up from bottom
5. Tap ⌨️ → iOS native keyboard appears, typing sends characters to remote
6. Pinch → remote canvas zooms in/out
7. panel.html loads from launcher → bookmarklet URL copies in one tap
8. ✕ Close in toolbar → GRD returns to normal, overlay removed
