/* SHATTERWAVE — core: namespace, math, color, storage, input */
'use strict';
const SW = (window.SW = {});

// Logical playfield (everything in the world lives in these units)
SW.W = 720;
SW.H = 960;
SW.FIELD = { left: 12, right: 708, top: 84, bottom: 960 };
SW.GRID = { cols: 13, x0: 24, y0: 120, pitchX: 52, pitchY: 28, bw: 48, bh: 24 };
SW.PADDLE_Y = 872;
SW.view = { scale: 1, ox: 0, oy: 0, dpr: 1, w: 720, h: 960 };

/* ---------------- math ---------------- */
const U = (SW.U = {
  TAU: Math.PI * 2,
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  invLerp: (a, b, v) => (v - a) / (b - a),
  rand: (a = 0, b = 1) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  chance: (p) => Math.random() < p,
  sign: (v) => (v < 0 ? -1 : 1),
  approach(v, target, d) { return v < target ? Math.min(v + d, target) : Math.max(v - d, target); },
  damp(a, b, lambda, dt) { return b + (a - b) * Math.exp(-lambda * dt); },
  smoothstep: (t) => t * t * (3 - 2 * t),
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInCubic: (t) => t * t * t,
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  easeOutElastic(t) {
    if (t <= 0) return 0; if (t >= 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  dist2: (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by),
  // seeded RNG (mulberry32)
  rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  fmt(n) { return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); },
  pad(n, len) { let s = String(Math.floor(n)); while (s.length < len) s = '0' + s; return s; },
  fmtTime(sec) { sec = Math.floor(sec); const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; },
});

/* ---------------- color ---------------- */
const C = (SW.C = {
  _cache: new Map(),
  rgb(hex) {
    let c = this._cache.get(hex);
    if (c) return c;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    this._cache.set(hex, c);
    return c;
  },
  rgba(hex, a) { const c = this.rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; },
  toHex(r, g, b) {
    const f = (v) => { v = Math.round(U.clamp(v, 0, 255)).toString(16); return v.length < 2 ? '0' + v : v; };
    return '#' + f(r) + f(g) + f(b);
  },
  mix(h1, h2, t) { const a = this.rgb(h1), b = this.rgb(h2); return this.toHex(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)); },
  lighten(hex, t) { return this.mix(hex, '#ffffff', t); },
  darken(hex, t) { return this.mix(hex, '#000000', t); },
  hsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return this.toHex(f(0) * 255, f(8) * 255, f(4) * 255);
  },
});

/* ---------------- storage ---------------- */
SW.store = {
  prefix: 'shatterwave.v1.',
  get(key, def) {
    try { const v = localStorage.getItem(this.prefix + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  },
  set(key, val) { try { localStorage.setItem(this.prefix + key, JSON.stringify(val)); } catch (e) { /* storage unavailable */ } },
};

SW.settings = Object.assign(
  { music: 70, sfx: 85, shake: true, flash: true, crt: true, fps: false },
  SW.store.get('settings', {})
);
SW.saveSettings = () => SW.store.set('settings', SW.settings);

SW.progress = Object.assign({ sector: 1, bestEndless: 0 }, SW.store.get('progress', {}));
SW.saveProgress = () => SW.store.set('progress', SW.progress);

SW.scores = {
  list: SW.store.get('scores', []),
  best() { return this.list.length ? this.list[0].score : 0; },
  qualifies(score) { return score > 0 && (this.list.length < 10 || score > this.list[this.list.length - 1].score); },
  add(entry) {
    entry.id = Date.now() + Math.random();
    this.list.push(entry);
    this.list.sort((a, b) => b.score - a.score);
    this.list = this.list.slice(0, 10);
    SW.store.set('scores', this.list);
    return entry.id;
  },
};

/* ---------------- input ---------------- */
SW.input = {
  keys: Object.create(null),
  pressed: Object.create(null),
  px: SW.W / 2, py: SW.H * 0.8,
  lastPointer: -1e9, lastKey: -1e9,
  action: false, actionHeld: false, pulse: false,
  touch: false, touchId: null, touchStart: null,
  dragTarget: null,

  isDown(...codes) { for (const c of codes) if (this.keys[c]) return true; return false; },
  wasPressed(...codes) { for (const c of codes) if (this.pressed[c]) return true; return false; },
  axis() {
    let a = 0;
    if (this.isDown('ArrowLeft', 'KeyA')) a -= 1;
    if (this.isDown('ArrowRight', 'KeyD')) a += 1;
    return U.clamp(a + this.padAxis, -1, 1);
  },
  padAxis: 0, padPrev: [],
  // Gamepad: stick/d-pad move, A launch/fire, X/RB/RT pulse, Start pause, B back
  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) { this.padAxis = 0; return; }
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const edge = (i) => btn(i) && !this.padPrev[i];
    let ax = gp.axes[0] || 0;
    if (Math.abs(ax) < 0.18) ax = 0;
    if (btn(14)) ax = -1;
    if (btn(15)) ax = 1;
    this.padAxis = ax;
    if (ax !== 0) this.lastKey = performance.now();
    const menu = SW.ui && SW.ui.menuOpen();
    if (menu) {
      const key = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, cancelable: true }));
      if (edge(12)) key('ArrowUp');
      if (edge(13)) key('ArrowDown');
      if (edge(0) || edge(9)) {
        if (SW.ui.current === 'splash') SW.ui.boot();
        else if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.click();
      }
      if (edge(1)) key('Escape');
    } else {
      if (edge(0)) this.action = true;
      this.padHeld = btn(0);
      if (edge(2) || edge(5) || edge(7)) this.pulse = true;
      if (edge(9)) SW.ui.pause();
    }
    this.padPrev = gp.buttons.map((b) => b.pressed);
  },
  toLogical(cx, cy) {
    const v = SW.view;
    return [(cx - v.ox) / v.scale, (cy - v.oy) / v.scale];
  },
  endFrame() {
    for (const k in this.pressed) delete this.pressed[k];
    this.action = false;
    this.pulse = false;
  },
  init(canvas) {
    const I = this;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT')) return;
      if (!I.keys[e.code]) I.pressed[e.code] = true;
      I.keys[e.code] = true;
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) I.lastKey = performance.now();
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { I.action = true; I.actionHeld = true; }
      if (['KeyE', 'ShiftLeft', 'ShiftRight'].includes(e.code)) I.pulse = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !SW.ui?.menuOpen()) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      I.keys[e.code] = false;
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) I.actionHeld = false;
    });
    window.addEventListener('blur', () => { for (const k in I.keys) I.keys[k] = false; I.actionHeld = false; });

    canvas.addEventListener('mousemove', (e) => {
      const p = I.toLogical(e.clientX, e.clientY);
      I.px = p[0]; I.py = p[1];
      I.lastPointer = performance.now();
      I.touch = false;
    });
    canvas.addEventListener('mousedown', (e) => {
      const p = I.toLogical(e.clientX, e.clientY);
      I.px = p[0]; I.py = p[1];
      if (e.button === 0) { I.action = true; I.actionHeld = true; }
      if (e.button === 2) I.pulse = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) I.actionHeld = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointerdown', () => { if (SW.audio.ready) SW.audio.resume(); }, true);

    // Touch: relative drag moves the paddle, quick tap = action
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      I.touch = true;
      document.body.classList.add('touch');
      const t = e.changedTouches[0];
      if (I.touchId === null) {
        I.touchId = t.identifier;
        const p = I.toLogical(t.clientX, t.clientY);
        I.touchStart = { x: p[0], y: p[1], time: performance.now(), paddleX: SW.game?.paddle ? SW.game.paddle.x : SW.W / 2, moved: 0 };
        I.actionHeld = true;
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== I.touchId || !I.touchStart) continue;
        const p = I.toLogical(t.clientX, t.clientY);
        const dx = p[0] - I.touchStart.x;
        I.touchStart.moved = Math.max(I.touchStart.moved, Math.abs(dx), Math.abs(p[1] - I.touchStart.y));
        I.dragTarget = I.touchStart.paddleX + dx * 1.35;
        I.lastPointer = performance.now();
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== I.touchId) continue;
        if (I.touchStart && performance.now() - I.touchStart.time < 280 && I.touchStart.moved < 14) I.action = true;
        I.touchId = null; I.touchStart = null; I.actionHeld = false;
      }
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
  },
};
