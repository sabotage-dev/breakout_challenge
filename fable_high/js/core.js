'use strict';
/* ============ SHATTERSONG · core ============ */
const W = 960, H = 720, HUD_H = 56;
const BW = 66, BH = 24;
const TAU = Math.PI * 2;
const FONT = '"Avenir Next","Futura","Century Gothic","Segoe UI",system-ui,sans-serif';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const sgn = v => v < 0 ? -1 : 1;
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const fmt = n => Math.round(n).toLocaleString('en-US');

const Ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
};

/* ---------- colour helpers ---------- */
const _rgbCache = {};
function hexRgb(hex) {
  let c = _rgbCache[hex];
  if (!c) { const n = parseInt(hex.slice(1), 16); c = _rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  return c;
}
function rgba(hex, a) { const c = hexRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
function tint(hex, amt) { // amt > 0 → toward white, amt < 0 → toward black
  const c = hexRgb(hex), t = amt < 0 ? 0 : 255, k = Math.abs(amt);
  return 'rgb(' + Math.round(lerp(c[0], t, k)) + ',' + Math.round(lerp(c[1], t, k)) + ',' + Math.round(lerp(c[2], t, k)) + ')';
}

/* ---------- canvas helpers ---------- */
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function poly(c, pts, fill) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
}
function spacedText(c, str, x, y, sp, align) { // manual letter-spacing (works everywhere)
  let w = 0; const ws = [];
  for (let i = 0; i < str.length; i++) { const m = c.measureText(str[i]).width; ws.push(m); w += m + sp; }
  w -= sp;
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const old = c.textAlign; c.textAlign = 'left';
  for (let i = 0; i < str.length; i++) { c.fillText(str[i], cx, y); cx += ws[i] + sp; }
  c.textAlign = old;
  return w;
}

/* ---------- persistence ---------- */
const Save = {
  key: 'shattersong.v1',
  data: { best: 0, bestStage: 0, music: 0.65, sfx: 0.8, shake: true, runs: 0, wins: 0 },
  load() { try { const s = localStorage.getItem(this.key); if (s) Object.assign(this.data, JSON.parse(s)); } catch (e) { /* storage unavailable */ } },
  store() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ } }
};

/* ---------- view + input state (filled by ui.js) ---------- */
const View = { scale: 1, ox: 0, oy: 0, dpr: 1, cw: 0, ch: 0 };
const Input = { x: W / 2, mode: 'pointer', left: false, right: false, action: false, tap: false, touch: false };
