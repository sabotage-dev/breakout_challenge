'use strict';
/* ==========================================================================
   HADAL — utilities
   ========================================================================== */

const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => (b === undefined ? Math.random() * (a === undefined ? 1 : a) : a + Math.random() * (b - a));
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const chance = (p) => Math.random() < p;

const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeIn = (t) => { t = clamp(t, 0, 1); return t * t * t; };
const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOutBack = (t) => { t = clamp(t, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/* frame-rate independent exponential smoothing */
const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));

/* ---------- colour helpers ---------- */
const _rgbCache = Object.create(null);
function rgb(hex) {
  let c = _rgbCache[hex];
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = _rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return c;
}
function rgba(hex, a) { const c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
function toHex(r, g, b) {
  r = clamp(Math.round(r), 0, 255); g = clamp(Math.round(g), 0, 255); b = clamp(Math.round(b), 0, 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function mix(h1, h2, t) {
  const a = rgb(h1), b = rgb(h2);
  return toHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}
const lighten = (hex, t) => mix(hex, '#ffffff', t);
const darken = (hex, t) => mix(hex, '#000000', t);

function fmt(n) {
  n = Math.round(n);
  const s = String(Math.abs(n));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return (n < 0 ? '-' : '') + out;
}

/* ---------- deterministic rng + smooth 1D noise ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash1(n) {
  let x = Math.imul((n | 0) ^ 0x9E3779B9, 0x85EBCA6B);
  x ^= x >>> 13; x = Math.imul(x, 0xC2B2AE35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
function noise1(x, seed) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  const s = (seed | 0) * 7919;
  return lerp(hash1(i + s), hash1(i + 1 + s), u);
}

/* ---------- canvas helpers ---------- */
function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
}
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/* ---------- persistence ---------- */
const Save = {
  key: 'hadal.save.v1',
  data: {
    best: 0,
    deepest: 0,
    wins: 0,
    ckpt: null,
    settings: { music: 0.7, sfx: 0.8, shake: true, flash: true },
  },
  load() {
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;
      const def = this.data.settings;
      this.data.best = +d.best || 0;
      this.data.deepest = +d.deepest || 0;
      this.data.wins = +d.wins || 0;
      this.data.ckpt = d.ckpt && typeof d.ckpt === 'object' ? d.ckpt : null;
      const s = d.settings || {};
      this.data.settings = {
        music: typeof s.music === 'number' ? clamp(s.music, 0, 1) : def.music,
        sfx: typeof s.sfx === 'number' ? clamp(s.sfx, 0, 1) : def.sfx,
        shake: s.shake !== false,
        flash: s.flash !== false,
      };
    } catch (e) { /* storage unavailable — play without persistence */ }
  },
  store() {
    try { window.localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },
};
