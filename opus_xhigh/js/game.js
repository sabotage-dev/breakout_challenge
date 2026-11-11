'use strict';
/* =====================================================================
   PRISM BREAKER — core game
   ===================================================================== */

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------
const W = 960, H = 720;
const HUD_H = 58;
const WALL_L = 18, WALL_R = W - 18, WALL_T = HUD_H + 6;
const COLS = 14, BW = 60, BH = 24, GAP = 4;
const CELL_W = BW + GAP, CELL_H = BH + GAP;
const GRID_X = Math.round((W - (COLS * CELL_W - GAP)) / 2);
const GRID_Y = WALL_T + 42;
const PADDLE_Y = H - 62, PADDLE_H = 14;
const PADDLE_W = { base: 116, wide: 178, shrink: 72 };
const BALL_R = 7;
const SHIELD_Y = H - 28;
const STEP = 1 / 120;
const MAX_BALLS = 18;
const TAU = Math.PI * 2;
const FONT = '"Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace';

// ---------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

const _rgb = {};
function hexRgb(h) {
  let c = _rgb[h]; if (c) return c;
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map(x => x + x).join('');
  const n = parseInt(s, 16);
  c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  _rgb[h] = c; return c;
}
function rgba(h, a) { const c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
function mix(h1, h2, t) {
  const a = hexRgb(h1), b = hexRgb(h2);
  const r = Math.round(lerp(a[0], b[0], t)), g = Math.round(lerp(a[1], b[1], t)), bl = Math.round(lerp(a[2], b[2], t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
const lighten = (h, t) => mix(h, '#ffffff', t);
const darken = (h, t) => mix(h, '#000000', t);
function hslHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hx = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + hx(f(0)) + hx(f(8)) + hx(f(4));
}
const _rainbow = {};
function rainbow(h) {
  const q = ((Math.round(h / 10) * 10) % 360 + 360) % 360;
  return _rainbow[q] || (_rainbow[q] = hslHex(q, 100, 62));
}
function rr(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
function poly(g, n, r, rot) {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + i * TAU / n;
    if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r); else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
}

// ---------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------
const Store = {
  get(k, d) { try { const v = localStorage.getItem('prismbreaker.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('prismbreaker.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};
const Settings = Object.assign({ music: 0.6, sfx: 0.8, shake: true, crt: true, flashes: true }, Store.get('settings', {}));
const Progress = Object.assign({ maxLevel: 0, beaten: false, bestWave: 0 }, Store.get('progress', {}));
const DEFAULT_SCORES = [
  ['NEO', 80000, '3-5'], ['VEX', 62000, '3-2'], ['ION', 48000, '2-5'], ['LUX', 36000, '2-3'], ['RAY', 27000, '2-1'],
  ['ZED', 19000, '1-5'], ['KAI', 13000, '1-4'], ['ORB', 8000, '1-3'], ['JET', 4500, '1-2'], ['PIX', 2000, '1-1'],
].map(([name, score, stage]) => ({ name, score, stage }));
let Scores = Store.get('scores', null);
if (!Array.isArray(Scores)) Scores = DEFAULT_SCORES.slice();
const hiScore = () => (Scores.length ? Scores[0].score : 0);
const saveSettings = () => Store.set('settings', Settings);
const saveProgress = () => Store.set('progress', Progress);

// ---------------------------------------------------------------------
// Canvas & sprite cache
// ---------------------------------------------------------------------
const stageEl = $('#stage');
const canvas = $('#game');
const ctx = canvas.getContext('2d');
let PRX = 1, PRY = 1, PR = 1;
const sprites = new Map();
let bgCanvas = null, bgKey = '';

function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const s = Math.min(vw / W, vh / H);
  const cw = Math.max(240, Math.floor(W * s)), ch = Math.max(180, Math.floor(H * s));
  stageEl.style.width = cw + 'px';
  stageEl.style.height = ch + 'px';
  document.documentElement.style.setProperty('--u', (cw / W).toFixed(4) + 'px');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
  if (pw > 2600) { ph = Math.round(ph * 2600 / pw); pw = 2600; }
  canvas.width = pw; canvas.height = ph;
  PRX = pw / W; PRY = ph / H; PR = PRX;
  sprites.clear(); bgKey = '';
}

function sprite(key, w, h, pad, draw, scale) {
  let s = sprites.get(key);
  if (s) return s;
  const sc = scale || Math.max(1, PR);
  const c = document.createElement('canvas');
  c.width = Math.ceil((w + pad * 2) * sc); c.height = Math.ceil((h + pad * 2) * sc);
  const g = c.getContext('2d');
  g.scale(sc, sc); g.translate(pad, pad);
  draw(g, w, h);
  s = { c, pad, w, h };
  if (!scale) sprites.set(key, s);
  return s;
}

function glowSprite(color) {
  return sprite('glow' + color, 64, 64, 0, (g, w) => {
    const r = w / 2;
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, rgba(lighten(color, 0.7), 1));
    gr.addColorStop(0.2, rgba(color, 0.6));
    gr.addColorStop(0.5, rgba(color, 0.18));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}
function drawGlow(color, x, y, radius, alpha) {
  if (alpha <= 0.002) return;
  const s = glowSprite(color);
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * Math.min(1, alpha);
  ctx.drawImage(s.c, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prev;
}

// ----- Brick painting (shared by game and the How-To legend) -----
function crackLines(g, w, h, dmg, seed) {
  const R = mulberry32(seed);
  g.lineWidth = 1.2;
  for (let k = 0; k < dmg * 2; k++) {
    let x = 6 + R() * (w - 12), y = R() < 0.5 ? 0 : h;
    g.strokeStyle = k % 2 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)';
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (R() - 0.5) * 14; y += (y < h / 2 ? 1 : -1) * (h / 5) * (0.6 + R());
      g.lineTo(clamp(x, 1, w - 1), clamp(y, 1, h - 1));
    }
    g.stroke();
  }
}

function paintBrick(g, kind, color, w, h, dmg) {
  const r = Math.min(5, h / 4);
  switch (kind) {
    case 'normal': {
      g.shadowColor = color; g.shadowBlur = 10;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, lighten(color, 0.45)); gr.addColorStop(0.45, color); gr.addColorStop(1, darken(color, 0.45));
      g.fillStyle = gr; rr(g, 0, 0, w, h, r); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,0.3)'; rr(g, 3, 2, w - 6, h * 0.34, r - 1); g.fill();
      g.strokeStyle = rgba(lighten(color, 0.6), 0.8); g.lineWidth = 1; rr(g, 1.5, 1.5, w - 3, h - 3, r - 1); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(5, h - 3.5, w - 10, 1.5);
      break;
    }
    case 'tough': {
      g.shadowColor = color; g.shadowBlur = 9;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, darken(color, 0.1)); gr.addColorStop(1, darken(color, 0.62));
      g.fillStyle = gr; rr(g, 0, 0, w, h, r); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = lighten(color, 0.4); g.lineWidth = 2.5; rr(g, 1.5, 1.5, w - 3, h - 3, r - 1); g.stroke();
      g.strokeStyle = rgba(lighten(color, 0.5), 0.6); g.lineWidth = 1;
      g.beginPath(); g.moveTo(8, h / 2); g.lineTo(w / 2 - 9, h / 2); g.moveTo(w / 2 + 9, h / 2); g.lineTo(w - 8, h / 2); g.stroke();
      g.fillStyle = lighten(color, 0.6);
      g.beginPath(); g.moveTo(w / 2, h / 2 - 5); g.lineTo(w / 2 + 5, h / 2); g.lineTo(w / 2, h / 2 + 5); g.lineTo(w / 2 - 5, h / 2); g.closePath(); g.fill();
      if (dmg) crackLines(g, w, h, dmg, 77 + dmg * 31);
      break;
    }
    case 'ultra': {
      g.shadowColor = '#cfe0ff'; g.shadowBlur = 12;
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#f4f7ff'); gr.addColorStop(0.5, '#a9b4d6'); gr.addColorStop(1, '#5d6788');
      g.fillStyle = gr; rr(g, 0, 0, w, h, r); g.fill();
      g.shadowBlur = 0;
      g.save(); rr(g, 0, 0, w, h, r); g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3;
      for (let x = -h; x < w + h; x += 12) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.stroke(); }
      g.restore();
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; rr(g, 1, 1, w - 2, h - 2, r); g.stroke();
      g.fillStyle = '#2b3150'; g.font = '900 11px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('III'.slice(0, 3 - dmg) || '·', w / 2, h / 2 + 1);
      if (dmg) crackLines(g, w, h, dmg + 1, 151 + dmg * 17);
      break;
    }
    case 'steel': {
      g.shadowColor = '#9fb4ff'; g.shadowBlur = 4;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#c3cad9'); gr.addColorStop(0.5, '#7a8396'); gr.addColorStop(1, '#3a4152');
      g.fillStyle = gr; rr(g, 0, 0, w, h, 3); g.fill();
      g.shadowBlur = 0;
      g.save(); rr(g, 0, 0, w, h, 3); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath(); g.moveTo(w * 0.25, 0); g.lineTo(w * 0.42, 0); g.lineTo(w * 0.3, h); g.lineTo(w * 0.13, h); g.closePath(); g.fill();
      g.restore();
      g.strokeStyle = '#1b2030'; g.lineWidth = 1.5; rr(g, 0.75, 0.75, w - 1.5, h - 1.5, 3); g.stroke();
      g.fillStyle = '#e8ecf5';
      for (const [px, py] of [[5, 5], [w - 5, 5], [5, h - 5], [w - 5, h - 5]]) { g.beginPath(); g.arc(px, py, 1.6, 0, TAU); g.fill(); }
      break;
    }
    case 'explosive': {
      g.shadowColor = '#ff2a2a'; g.shadowBlur = 12;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#5a0a1e'); gr.addColorStop(1, '#22030b');
      g.fillStyle = gr; rr(g, 0, 0, w, h, r); g.fill();
      g.shadowBlur = 0;
      g.save(); rr(g, 0, 0, w, h, r); g.clip();
      g.fillStyle = 'rgba(255,200,40,0.18)';
      for (let x = -h; x < w + h; x += 14) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 6, h); g.lineTo(x + 6 + h, 0); g.lineTo(x + h, 0); g.closePath(); g.fill(); }
      g.restore();
      g.strokeStyle = '#ff4a3a'; g.lineWidth = 2; rr(g, 1, 1, w - 2, h - 2, r); g.stroke();
      const cx = w / 2, cy = h / 2;
      g.strokeStyle = '#ffd24d'; g.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.beginPath(); g.moveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5); g.lineTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); g.stroke(); }
      g.fillStyle = '#ffdd55'; g.beginPath(); g.arc(cx, cy, 3.6, 0, TAU); g.fill();
      break;
    }
    case 'prism': {
      g.shadowColor = '#ffffff'; g.shadowBlur = 12;
      const gr = g.createLinearGradient(0, 0, w, 0);
      ['#ff3b6b', '#ff8a3d', '#ffe14d', '#4dff88', '#3de8ff', '#4d7bff', '#b44dff'].forEach((c, i) => gr.addColorStop(i / 6, c));
      g.fillStyle = gr; rr(g, 0, 0, w, h, r); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.5, h * 0.5); g.lineTo(w, 0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.5, h * 0.5); g.lineTo(w, h); g.moveTo(w * 0.5, h * 0.5); g.lineTo(w * 0.5, 0); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; rr(g, 1, 1, w - 2, h - 2, r); g.stroke();
      break;
    }
    case 'gold': {
      g.shadowColor = '#ffcc33'; g.shadowBlur = 14;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#fff6b8'); gr.addColorStop(0.4, '#ffcc33'); gr.addColorStop(1, '#a86a00');
      g.fillStyle = gr; rr(g, 0, 0, w, h, r); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#fff3c4'; g.lineWidth = 1.5; rr(g, 1.5, 1.5, w - 3, h - 3, r - 1); g.stroke();
      const cx = w / 2, cy = h / 2;
      g.fillStyle = '#8a5200';
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 3 : 7.5; g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; rr(g, 3, 2, w - 6, h * 0.3, r - 1); g.fill();
      break;
    }
  }
}
function brickSprite(b) {
  const dmg = b.kind === 'steel' ? 0 : Math.max(0, b.maxHp - Math.max(b.hp, 1));
  const key = 'b' + b.kind + b.color + b.w + 'x' + b.h + 'd' + dmg;
  return sprite(key, b.w, b.h, 14, (g, w, h) => paintBrick(g, b.kind, b.color, w, h, dmg));
}

// ---------------------------------------------------------------------
// Power-up catalogue
// ---------------------------------------------------------------------
const PU = {
  multi:  { glyph: 'M', name: 'MULTIBALL',  color: '#3de8ff', w: 14, desc: 'Splits every ball into three' },
  wide:   { glyph: 'W', name: 'WIDE BEAM',  color: '#4dff88', w: 13, dur: 20, desc: 'Extends the paddle' },
  laser:  { glyph: 'L', name: 'LASERS',     color: '#ff3b6b', w: 11, dur: 12, desc: 'Paddle auto-fires twin lasers' },
  catch:  { glyph: 'C', name: 'MAGNET',     color: '#b44dff', w: 9,  dur: 20, desc: 'Catch the ball, release to aim' },
  slow:   { glyph: 'S', name: 'SLOW-MO',    color: '#4d7bff', w: 9,  dur: 14, desc: 'Slows every ball' },
  fire:   { glyph: 'F', name: 'FIREBALL',   color: '#ff8a3d', w: 6,  dur: 9,  desc: 'Ball pierces through bricks' },
  shield: { glyph: 'B', name: 'BARRIER',    color: '#ffe14d', w: 8,  desc: 'Energy floor saves one ball' },
  charge: { glyph: 'O', name: 'OVERCHARGE', color: '#ffffff', w: 6,  desc: '+40% Overdrive meter' },
  life:   { glyph: '1UP', name: 'EXTRA LIFE', color: '#ff4df0', w: 2.2, desc: 'One more try' },
  shrink: { glyph: '><', name: 'SHRINK',    color: '#9a8cb0', w: 6, dur: 12, bad: true, desc: 'Hazard: shrinks the paddle' },
  fast:   { glyph: '>>', name: 'HYPERSPEED', color: '#d04848', w: 5, dur: 10, bad: true, desc: 'Hazard: balls speed up' },
};
const CAP_W = 46, CAP_H = 18;
function paintCapsule(g, type, w, h) {
  const d = PU[type], col = d.color;
  g.shadowColor = col; g.shadowBlur = 12;
  const gr = g.createLinearGradient(0, 0, 0, h);
  if (d.bad) { gr.addColorStop(0, '#3a2a3e'); gr.addColorStop(1, '#140c18'); }
  else { gr.addColorStop(0, lighten(col, 0.55)); gr.addColorStop(0.5, col); gr.addColorStop(1, darken(col, 0.5)); }
  g.fillStyle = gr; rr(g, 0, 0, w, h, h / 2); g.fill();
  g.shadowBlur = 0;
  if (d.bad) {
    g.save(); rr(g, 0, 0, w, h, h / 2); g.clip();
    g.fillStyle = rgba(col, 0.45);
    for (let x = -h; x < w + h; x += 10) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 4, h); g.lineTo(x + 4 + h, 0); g.lineTo(x + h, 0); g.closePath(); g.fill(); }
    g.restore();
    g.strokeStyle = col; g.lineWidth = 1.5; rr(g, 0.75, 0.75, w - 1.5, h - 1.5, h / 2); g.stroke();
  } else {
    g.fillStyle = 'rgba(255,255,255,0.4)'; rr(g, 4, 2, w - 8, h * 0.32, h * 0.16); g.fill();
    g.strokeStyle = rgba(lighten(col, 0.7), 0.9); g.lineWidth = 1; rr(g, 0.5, 0.5, w - 1, h - 1, h / 2); g.stroke();
  }
  g.font = '900 ' + (d.glyph.length > 1 ? 10 : 12) + 'px ' + FONT;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 3; g.strokeStyle = 'rgba(10,0,25,0.85)'; g.strokeText(d.glyph, w / 2, h / 2 + 1);
  g.fillStyle = '#fff'; g.fillText(d.glyph, w / 2, h / 2 + 1);
}

// ---------------------------------------------------------------------
// Bosses
// ---------------------------------------------------------------------
const BOSSES = {
  warden: {
    name: 'THE WARDEN', style: 'warden', hp: 16, r: 44, col: '#ff3b6b', col2: '#ffe14d',
    rings: [{ n: 8, rad: 88, spd: 0.85, kinds: ['tough', 'normal'], colors: [1, 8] }],
    fire: [2.4, 1.45], pat: [['aimed'], ['aimed', 'spread3']],
    path: t => [W / 2 + Math.sin(t * 0.5) * 250, 215 + Math.sin(t * 1.3) * 22],
  },
  leviathan: {
    name: 'LEVIATHAN', style: 'leviathan', hp: 26, r: 48, col: '#3de8ff', col2: '#4dff88',
    rings: [
      { n: 8, rad: 84, spd: 1.05, kinds: ['normal'], colors: [5, 4] },
      { n: 10, rad: 126, spd: -0.55, kinds: ['tough', 'normal', 'normal'], colors: [6, 5, 4] },
    ],
    fire: [2.2, 1.3], pat: [['wave', 'aimed'], ['wave', 'spread5', 'aimed']],
    path: t => [W / 2 + Math.sin(t * 0.42) * 220, 225 + Math.sin(t * 0.84) * 45],
  },
  core: {
    name: 'PRISM CORE', style: 'core', hp: 36, r: 52, col: '#ffffff', col2: '#b44dff',
    rings: [
      { n: 5, rad: 84, spd: 1.3, kinds: ['steel'], colors: [0] },
      { n: 14, rad: 128, spd: -0.7, kinds: ['normal', 'normal', 'explosive'], colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    ],
    fire: [2.4, 1.5], pat: [['spiral', 'aimed3'], ['spiral', 'rain', 'aimed3']],
    path: t => [W / 2 + Math.sin(t * 0.33) * 190, 225 + Math.sin(t * 0.66) * 28],
    teleport: true,
  },
};

// ---------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------
const G = {
  state: 'menu', demo: true, autoplay: false, mode: 'campaign',
  levelIndex: 0, level: null, sector: SECTORS[0],
  score: 0, shownScore: 0, lives: 3, nextLife: 30000, scoreAtLevelStart: 0, livesAtLevelStart: 3,
  paddle: null, balls: [], bricks: [], powerups: [], lasers: [], bullets: [], explosions: [], shocks: [], floaters: [], callouts: [],
  boss: null, fx: {}, shield: 0,
  combo: 0, maxCombo: 0, comboT: 9,
  od: 0, odReady: false, odT: 0, odMax: 8,
  time: 0, levelTime: 0, bgTime: 0,
  timeScale: 1, slowT: 0, slowScale: 1, hitstop: 0,
  shake: 0, flash: 0, flashColor: '#ffffff',
  dying: 0, clearing: 0, tally: null, overT: 0, endKind: null,
  banner: null, awaitLaunch: false, laserCD: 0, bricksBroken: 0, livesLostLevel: 0, par: 60,
  aiOffset: 0, aiLaunchT: 0, demoT: 0, demoNext: 0, checkClear: false, endlessSeed: 1,
};
const parts = [];
const bgParts = [];
const Input = { mode: 'pointer', px: W / 2, left: false, right: false, fire: false, firePressed: false, odPressed: false, touch: false };
let acc = 0;

function freshFx() { return { wide: 0, shrink: 0, laser: 0, catch: 0, slow: 0, fast: 0, fire: 0 }; }
function sfx(name, ...args) { if (!G.demo && Sound.fx[name]) Sound.fx[name](...args); }
function stageLabel() {
  if (G.mode === 'endless') return 'WAVE ' + (G.levelIndex + 1);
  return (G.level.sector + 1) + '-' + ((G.levelIndex % 5) + 1);
}
function addShake(v) { if (!G.demo) G.shake = Math.min(22, G.shake + v); }
function flashScreen(color, a) { if (G.demo) return; G.flashColor = color; G.flash = Math.max(G.flash, a); }
function callout(text, color, size = 46, dur = 1.5) {
  G.callouts = G.callouts.filter(c => c.t < c.dur * 0.6);
  G.callouts.push({ text, color, size, t: 0, dur });
}
function floater(text, x, y, color, size = 14) {
  if (G.floaters.length > 40) G.floaters.shift();
  G.floaters.push({ text, x, y, color, size, life: 0.9, max: 0.9 });
}

// ---------------------------------------------------------------------
// Entities: paddle, balls, bricks
// ---------------------------------------------------------------------
function resetPaddle() {
  G.paddle = { x: W / 2, y: PADDLE_Y, w: PADDLE_W.base, vx: 0, kv: 0, stun: 0, squash: 0, dead: false };
  Input.px = W / 2;
}
function baseSpeed() {
  if (G.mode === 'endless') return Math.min(600, 450 + G.levelIndex * 7);
  return 405 + G.levelIndex * 9;
}
const maxSpeed = () => baseSpeed() * 1.4;
function makeBall(x, y, speed) {
  return { x, y, vx: 0, vy: -speed, speed, cur: speed, r: BALL_R, stuck: false, caught: false, off: 0, stuckT: 0, trail: [], idle: 0, hue: rand(0, 360), dead: false };
}
function setDir(b, ang) {
  const s = b.cur || b.speed;
  b.vx = Math.cos(ang) * s; b.vy = Math.sin(ang) * s;
  fixAngle(b);
}
function fixAngle(b) {
  const sp = Math.hypot(b.vx, b.vy) || 1;
  const min = sp * 0.26;
  if (Math.abs(b.vy) < min) {
    b.vy = (b.vy >= 0 ? 1 : -1) * min;
    b.vx = (b.vx >= 0 ? 1 : -1) * Math.sqrt(sp * sp - min * min);
  }
}
function perturb(b, amt) {
  const a = Math.atan2(b.vy, b.vx) + rand(-amt, amt);
  const s = Math.hypot(b.vx, b.vy);
  b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s;
}
function spawnStuckBall() {
  const p = G.paddle;
  const b = makeBall(p.x, p.y - PADDLE_H / 2 - BALL_R - 0.5, baseSpeed());
  b.stuck = true; b.off = rand(-12, 12); b.stuckT = 0;
  G.balls.push(b);
  G.awaitLaunch = true;
  G.aiLaunchT = 0;
}
function launchBall(b) {
  const p = G.paddle;
  b.stuck = false; b.caught = false;
  const off = clamp(b.off / (p.w / 2), -1, 1);
  const ang = -Math.PI / 2 + off * 0.75 + (Math.abs(off) < 0.05 ? rand(-0.15, 0.15) : 0);
  b.cur = b.speed;
  setDir(b, ang);
}
function releaseBalls() {
  let any = false;
  for (const b of G.balls) if (b.stuck) { launchBall(b); any = true; }
  if (any) { sfx('launch'); G.awaitLaunch = false; }
  return any;
}
function currentBallSpeed() {
  let s = 0, n = 0;
  for (const b of G.balls) { s += b.speed; n++; }
  return n ? s / n : baseSpeed();
}

function makeBrick(ch, x, y, w, h) {
  const b = { x, y, bx: x, by: y, w, h, alive: true, flash: 0, intro: 1, kind: 'normal', color: '#ffffff', hp: 1, maxHp: 1, pts: 50, row: 0, col: 0, mv: null, orbit: null, respawn: 0 };
  if (ch >= '1' && ch <= '8') { b.color = PALETTE[ch]; }
  else if (ch >= 'A' && ch <= 'H') { b.kind = 'tough'; b.color = PALETTE[ch.charCodeAt(0) - 64]; b.hp = b.maxHp = 2; b.pts = 120; }
  else if (ch === 'U') { b.kind = 'ultra'; b.color = '#dfe6ff'; b.hp = b.maxHp = 3; b.pts = 220; }
  else if (ch === '#') { b.kind = 'steel'; b.color = '#9aa3b8'; b.hp = b.maxHp = 1; b.pts = 0; }
  else if (ch === 'X') { b.kind = 'explosive'; b.color = '#ff3b3b'; b.pts = 150; }
  else if (ch === '*') { b.kind = 'prism'; b.color = '#ffffff'; b.pts = 200; }
  else if (ch === '$') { b.kind = 'gold'; b.color = '#ffd84d'; b.pts = 500; }
  else return null;
  return b;
}

function buildLevel(def) {
  const bricks = [];
  const map = def.map || [];
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const b = makeBrick(map[r][c] || '.', GRID_X + c * CELL_W, GRID_Y + r * CELL_H, BW, BH);
      if (b) { b.row = r; b.col = c; b.intro = -(r * 0.06 + Math.abs(c - 6.5) * 0.035); bricks.push(b); }
    }
  }
  for (const m of def.move || []) {
    m.rows.forEach((row, k) => {
      const rowB = bricks.filter(b => b.row === row);
      if (!rowB.length) return;
      let minX = Infinity, maxX = -Infinity;
      for (const b of rowB) { minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.w); }
      const amp = Math.min(m.amp, minX - WALL_L - 4, WALL_R - 4 - maxX);
      if (amp < 8) return;
      const ph = (m.phase || 0) + (m.wave || 0) * k;
      for (const b of rowB) b.mv = { amp, spd: m.speed, ph };
    });
  }
  return bricks;
}

function makeBoss(key, scale) {
  const d = BOSSES[key];
  const hp = Math.round(d.hp * (scale || 1));
  const [x, y] = d.path(0);
  const B = { def: d, key, x, y: -150, r: d.r, hp, maxHp: hp, hpLag: hp, phase: 1, t: 0, pt: 0, fireT: 2.6, patIdx: 0,
    inv: 0, flash: 0, enter: 1.8, dying: 0, dead: false, boomT: 0, spiral: 0, alpha: 1, tpT: 7, tpState: 0, rings: [], blink: 0 };
  d.rings.forEach((ring, ri) => {
    B.rings.push({ angle: rand(0, TAU), spd: ring.spd, rad: ring.rad, n: ring.n });
    for (let j = 0; j < ring.n; j++) {
      const kind = ring.kinds[j % ring.kinds.length];
      const ch = kind === 'steel' ? '#' : kind === 'explosive' ? 'X' : kind === 'tough' ? 'ABCDEFGH'[ring.colors[j % ring.colors.length] - 1] : String(ring.colors[j % ring.colors.length]);
      const b = makeBrick(ch, x, y, 42, 18);
      b.orbit = { ring: ri, idx: j };
      b.intro = -0.6 - j * 0.04;
      G.bricks.push(b);
    }
  });
  void x;
  return B;
}

// ---------------------------------------------------------------------
// Level flow
// ---------------------------------------------------------------------
function levelDef(i) { return G.mode === 'endless' ? generateLevel(i, G.endlessSeed) : LEVELS[i]; }

function loadLevel(i) {
  const def = levelDef(i);
  G.levelIndex = i;
  G.level = def;
  G.sector = def.sector === 3 ? ENDLESS_SECTOR : SECTORS[def.sector];
  G.bricks = buildLevel(def);
  G.balls = []; G.powerups = []; G.lasers = []; G.bullets = []; G.explosions = []; G.shocks = [];
  G.floaters = []; G.callouts = [];
  G.fx = freshFx();
  G.combo = 0; G.maxCombo = 0; G.levelTime = 0; G.bricksBroken = 0; G.livesLostLevel = 0; G.sinceBrick = 0;
  G.odT = 0; G.dying = 0; G.clearing = 0; G.slowT = 0; G.timeScale = 1; G.hitstop = 0;
  G.scoreAtLevelStart = G.score; G.livesAtLevelStart = G.lives;
  G.snap = { nextLife: G.nextLife, od: G.od, odReady: G.odReady, shield: G.shield };
  G.boss = null;
  parts.length = 0;
  resetPaddle();
  spawnStuckBall();
  if (def.boss) G.boss = makeBoss(def.boss, def.hpScale);
  const breakable = G.bricks.filter(b => b.kind !== 'steel' && !b.orbit).length;
  G.par = def.boss ? 70 + G.boss.maxHp * 1.5 : 25 + breakable * 1.1;
  if (!G.demo) {
    const firstOfSector = G.mode === 'campaign' ? i % 5 === 0 : i === 0;
    const endless = G.mode === 'endless';
    let top;
    if (def.boss) top = 'WARNING  ·  GUARDIAN APPROACHING';
    else if (endless) top = 'ENDLESS RIFT  ·  ' + stageLabel();
    else top = firstOfSector ? G.sector.sub + '  ·  ' + G.sector.name : 'STAGE ' + stageLabel();
    G.banner = {
      top,
      title: def.name,
      sub: def.boss ? (endless ? stageLabel() : 'STAGE ' + stageLabel()) : (!endless && firstOfSector ? 'STAGE ' + stageLabel() : ''),
      t: 0, dur: 3.2, boss: !!def.boss,
    };
    Sound.play(def.boss ? 'boss' : G.sector.song);
    if (def.boss) Sound.fx.alarm();
    if (G.mode === 'campaign' && i > Progress.maxLevel) { Progress.maxLevel = i; saveProgress(); }
    if (G.mode === 'endless' && i + 1 > Progress.bestWave) { Progress.bestWave = i + 1; saveProgress(); }
  } else {
    G.banner = null;
  }
}

function startGame(levelIdx, mode, keepScore) {
  Sound.init();
  G.demo = false;
  G.mode = mode;
  if (!keepScore) { G.score = 0; G.shownScore = 0; G.lives = 3; G.nextLife = 30000; G.od = 0; G.odReady = false; G.shield = 0; G.runEntry = null; }
  if (mode === 'endless') G.endlessSeed = (Math.random() * 1e9) | 0;
  UI.hide();
  setState('playing');
  acc = 0;
  loadLevel(levelIdx);
}

function startDemo() {
  G.demo = true;
  G.mode = 'campaign';
  G.lives = 3; G.score = 0; G.od = 0; G.odReady = false; G.shield = 0;
  const pool = [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13];
  let pick = pool[Math.floor(Math.random() * pool.length)];
  if (G.level && pick === G.levelIndex) pick = pool[(pool.indexOf(pick) + 3) % pool.length];
  loadLevel(pick);
  G.demoT = 0; G.demoNext = 0;
}

function setState(s) {
  G.state = s;
  document.body.classList.toggle('ingame', s === 'playing' || s === 'tally');
  document.body.classList.toggle('playing', s === 'playing');
}

function toTitle() {
  setState('menu');
  Sound.muffle(false);
  Sound.play('title');
  startDemo();
  UI.show('scr-title');
}

function clearHeldInput() { Input.left = Input.right = Input.fire = false; Input.firePressed = Input.odPressed = false; }
function pauseGame() {
  if (G.state !== 'playing') return;
  clearHeldInput();
  setState('paused');
  Sound.muffle(true);
  UI.show('scr-pause');
}
function resumeGame() {
  if (G.state !== 'paused') return;
  UI.hide();
  setState('playing');
  Sound.muffle(false);
  Input.firePressed = false;
}
function restartLevel() {
  UI.hide();
  setState('playing');
  Sound.muffle(false);
  const lives = Math.min(G.lives, G.livesAtLevelStart);
  if (lives <= 0) { gameOver(); return; }   // the run is already over; restarting can't revive it
  G.score = G.scoreAtLevelStart; G.shownScore = G.score;
  G.lives = lives;
  if (G.snap) { G.nextLife = G.snap.nextLife; G.od = G.snap.od; G.odReady = G.snap.odReady; G.shield = G.snap.shield; }
  loadLevel(G.levelIndex);
}

function loseLife() {
  if (G.demo) { spawnStuckBall(); return; }
  G.dying = 1.8;
  G.lives--;
  G.livesLostLevel++;
  const p = G.paddle;
  for (let i = 0; i < 40; i++) {
    const a = rand(0, TAU), s = rand(80, 520);
    emit({ k: 1, x: p.x + rand(-p.w / 2, p.w / 2), y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 200, life: rand(0.6, 1.3), max: 1.3, color: i % 2 ? '#3de8ff' : '#ffffff', size: rand(3, 7), g: 700, drag: 0.6, rot: rand(0, TAU), vr: rand(-10, 10) });
  }
  sparkBurst(p.x, p.y, '#ff3b6b', 30, 600, 0.7);
  shock(p.x, p.y, 160, '#ff3b6b', 0.7);
  p.dead = true;
  sfx('lifeLost');
  addShake(16);
  flashScreen('#ff2040', 0.35);
  G.combo = 0;
  G.powerups = []; G.lasers = []; G.bullets = [];
  G.fx = freshFx(); G.odT = 0;
  G.slowT = 0.5; G.slowScale = 0.35;
}
function afterDeath() {
  const stageDone = G.boss ? G.boss.dead : !G.bricks.some(b => b.alive && b.kind !== 'steel' && !b.orbit);
  if (stageDone && G.lives <= 0) G.lives = 1;   // saved by the final blast
  if (G.lives <= 0) { gameOver(); return; }
  resetPaddle();
  spawnStuckBall();
  callout(G.lives === 1 ? 'LAST LIFE' : 'READY', G.lives === 1 ? '#ff3b6b' : '#3de8ff', 40, 1.4);
}
function gameOver() {
  setState('over');
  G.banner = null; G.callouts = [];
  G.endKind = 'gameover';
  G.overT = 1.6;
  Sound.stop(1.2);
  Sound.fx.gameOver();
}
function beginClear() {
  if (G.demo) { G.demoNext = 2.0; G.clearing = 2.0; G.slowT = 0.8; G.slowScale = 0.25; return; }
  G.clearing = 1.7;
  G.slowT = 1.2; G.slowScale = 0.2;
  G.bullets = [];
  flashScreen('#ffffff', 0.5);
  sfx('stageClear');
  for (const b of G.balls) shock(b.x, b.y, 120, '#ffffff', 0.6);
}
function startTally() {
  setState('tally');
  const timeBonus = Math.max(0, Math.round(G.par - G.levelTime)) * 50;
  const comboBonus = G.maxCombo * 100;
  const flawless = G.livesLostLevel === 0 ? (G.boss ? 10000 : 5000) : 0;
  G.tally = {
    t: 0, idx: 0, done: false, boss: !!G.boss,
    lines: [
      { label: G.boss ? 'GUARDIAN' : 'BRICKS SHATTERED', stat: G.boss ? 'DESTROYED' : String(G.bricksBroken), pts: 0 },
      { label: 'MAX COMBO', stat: '×' + G.maxCombo, pts: comboBonus },
      { label: 'CLEAR TIME', stat: fmtTime(G.levelTime), pts: timeBonus },
      { label: 'FLAWLESS', stat: G.livesLostLevel ? '—' : 'YES', pts: flawless },
    ],
    shown: [0, 0, 0, 0],
  };
  G.tally.total = comboBonus + timeBonus + flawless;
  G.balls = []; G.powerups = []; G.lasers = [];
}
function updateTally(dt) {
  const T = G.tally;
  T.t += dt;
  if (T.done) return;
  if (T.t < 0.3) return;
  const L = T.lines[T.idx];
  const rate = Math.max(L.pts / 0.6, 1);
  T.shown[T.idx] = Math.min(L.pts, T.shown[T.idx] + rate * dt);
  if (L.pts > 0) Sound.fx.countTick();
  if (T.shown[T.idx] >= L.pts) {
    gainScore(L.pts);
    T.idx++; T.t = 0;
    if (L.pts > 0) Sound.fx.menuSelect();
    if (T.idx >= T.lines.length) T.done = true;
  }
}
function advanceTally() {
  const T = G.tally;
  if (!T) return;
  if (!T.done) {
    for (let i = T.idx; i < T.lines.length; i++) { gainScore(T.lines[i].pts); T.shown[i] = T.lines[i].pts; }
    T.idx = T.lines.length; T.done = true; T.t = 0;
    return;
  }
  if (T.t < 0.25) return;
  G.tally = null;
  nextLevel();
}
function nextLevel() {
  const n = G.levelIndex + 1;
  if (G.mode === 'campaign' && n >= LEVELS.length) { victory(); return; }
  setState('playing');
  loadLevel(n);
}
function victory() {
  setState('over');
  G.endKind = 'victory';
  G.overT = 0.4;
  Progress.beaten = true; saveProgress();
  Sound.play('title');
  Sound.fx.victory();
  G.boss = null; G.bricks = []; G.balls = [];
}

// ---------------------------------------------------------------------
// Scoring & Overdrive
// ---------------------------------------------------------------------
const comboMult = () => 1 + Math.min(7, Math.floor(G.combo / 6));
function gainScore(pts) {
  if (G.demo) return;
  G.score += pts;
  while (G.score >= G.nextLife) {
    G.nextLife += 30000;
    if (G.lives < 9) { G.lives++; callout('EXTRA LIFE', '#ff4df0', 40); sfx('extraLife'); }
  }
}
function addScore(base, x, y) {
  if (G.demo) return 0;
  const mult = comboMult() * (G.odT > 0 ? 2 : 1);
  const pts = Math.round(base * mult);
  gainScore(pts);
  if (x !== undefined && pts >= 100) floater('+' + pts, x, y, mult >= 4 ? '#ffe14d' : mult >= 2 ? '#3de8ff' : '#ffffff', 12 + Math.min(8, mult));
  return pts;
}
function bumpCombo() {
  G.combo++;
  G.comboT = 0;
  if (G.combo > G.maxCombo) G.maxCombo = G.combo;
  if (G.combo % 10 === 0 && !G.demo) callout(G.combo + ' COMBO!', rainbow(G.combo * 12), 34 + Math.min(20, G.combo / 3), 1.1);
}
function addOD(v) {
  if (G.odT > 0 || G.odReady || G.demo && G.od >= 100) return;
  G.od = Math.min(100, G.od + v);
  if (G.od >= 100) {
    G.odReady = true;
    if (!G.demo) { sfx('odReady'); callout('OVERDRIVE READY', '#ffffff', 34, 1.6); }
  }
}
function activateOD() {
  if (!G.odReady || G.odT > 0 || G.dying > 0 || G.clearing > 0) return;
  G.odReady = false; G.od = 0; G.odT = G.odMax = 8;
  sfx('overdrive');
  flashScreen('#ffffff', 0.55);
  addShake(10);
  G.slowT = 0.5; G.slowScale = 0.3;
  G.callouts = [];
  if (!G.demo) callout('OVERDRIVE', '#ffffff', 60, 1.4);
  releaseBalls();
  for (const b of G.balls.slice()) {
    shock(b.x, b.y, 150, '#ffffff', 0.7);
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; emit({ k: 0, x: b.x, y: b.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 0.5, max: 0.5, color: rainbow(i * 15), size: 2.5, drag: 2, g: 0 }); }
    for (const br of G.bricks) {
      if (!br.alive || br.kind === 'steel' || br.intro < 0.6) continue;
      if (Math.hypot(br.x + br.w / 2 - b.x, br.y + br.h / 2 - b.y) < 125) damageBrick(br, 2, 'blast');
    }
    const B = G.boss;
    if (B && !B.dead && B.dying <= 0 && Math.hypot(B.x - b.x, B.y - b.y) < 125 + B.r) damageBoss(3, b.x, b.y);
  }
}

// ---------------------------------------------------------------------
// Bricks, explosions, power-ups
// ---------------------------------------------------------------------
function damageBrick(br, dmg, src) {
  if (!br.alive) return;
  br.flash = 1;
  if (br.kind === 'steel') {
    sfx('steel');
    sparkBurst(br.x + br.w / 2, br.y + br.h / 2, '#cfe0ff', 5, 260, 0.3);
    return;
  }
  bumpCombo();
  G.sinceBrick = 0;
  br.hp -= dmg;
  if (br.hp <= 0) destroyBrick(br, src);
  else {
    sfx('brick', G.combo - 1, 'tough');
    addScore(20);
    sparkBurst(br.x + br.w / 2, br.y + br.h / 2, br.color, 6, 240, 0.3);
  }
}
function destroyBrick(br) {
  br.alive = false;
  const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
  addScore(br.pts, cx, cy);
  shatter(br);
  G.bricksBroken++;
  addOD(2.4 + Math.min(4, G.combo * 0.2));
  sfx('brick', G.combo - 1, 'break');
  if (br.kind === 'explosive') G.explosions.push({ x: cx, y: cy, t: 0.09 });
  else if (br.kind === 'prism') prismSplit(cx, cy);
  if (br.kind === 'gold') { dropPowerup(cx, cy, true); sfx('gold'); }
  else dropPowerup(cx, cy, false);
  if (br.orbit) br.respawn = G.boss && G.boss.phase === 2 ? 7 : 11;
  G.checkClear = true;
}
function prismSplit(x, y) {
  sfx('prism');
  for (let i = 0; i < 18; i++) {
    const a = rand(0, TAU), s = rand(150, 500);
    emit({ k: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, color: rainbow(i * 20), size: 2.5, drag: 2.5, g: 0 });
  }
  shock(x, y, 70, '#ffffff', 0.4);
  const sp = currentBallSpeed();
  for (let i = 0; i < 2 && G.balls.length < MAX_BALLS; i++) {
    const nb = makeBall(x, y, sp);
    nb.cur = sp;
    setDir(nb, rand(0, TAU));
    G.balls.push(nb);
  }
}
function detonate(x, y) {
  sfx('explode', false);
  addShake(7);
  G.hitstop = Math.max(G.hitstop, 0.025);
  shock(x, y, 95, '#ff8a3d', 0.45);
  emit({ k: 2, x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, color: '#ff8a3d', size: 90 });
  for (let i = 0; i < 26; i++) {
    const a = rand(0, TAU), s = rand(100, 520);
    emit({ k: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, color: i % 3 ? '#ff8a3d' : '#ffe14d', size: rand(1.5, 3.5), drag: 2.5, g: 120 });
  }
  for (const b of G.bricks) {
    if (!b.alive || b.kind === 'steel' || b.intro < 0.6) continue;
    const bx = b.x + b.w / 2, by = b.y + b.h / 2;
    if (Math.abs(bx - x) <= CELL_W * 1.1 && Math.abs(by - y) <= CELL_H * 1.1) damageBrick(b, 2, 'blast');
  }
  const B = G.boss;
  if (B && !B.dead && B.dying <= 0 && B.enter <= 0 && Math.hypot(B.x - x, B.y - y) < B.r + 70) damageBoss(2, x, y);
}
function dropPowerup(x, y, force) {
  if (!force) {
    if (G.powerups.length >= 3) return;
    const chance = G.boss ? 0.2 : 0.1;
    if (Math.random() > chance) return;
  }
  let total = 0;
  const keys = Object.keys(PU).filter(k => !(k === 'life' && G.lives >= 6) && !(force && PU[k].bad));
  for (const k of keys) total += PU[k].w;
  let roll = Math.random() * total, type = keys[0];
  for (const k of keys) { roll -= PU[k].w; if (roll <= 0) { type = k; break; } }
  G.powerups.push({ type, x, y, vy: 120, t: rand(0, 3) });
}
function applyPowerup(type) {
  const d = PU[type], p = G.paddle;
  sfx(d.bad ? 'powerBad' : 'powerGood');
  const stack = G.floaters.filter(f => f.size === 15 && f.life > 0.45).length;
  floater(d.name, p.x, p.y - 34 - stack * 18, d.color, 15);
  addScore(100);
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + rand(-1.2, 1.2), s = rand(120, 360);
    emit({ k: 0, x: p.x + rand(-p.w / 2, p.w / 2), y: p.y - 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, max: 0.5, color: d.color, size: 2, drag: 2, g: 0 });
  }
  switch (type) {
    case 'multi': splitBalls(); break;
    case 'wide': G.fx.wide = d.dur; G.fx.shrink = 0; break;
    case 'shrink': G.fx.shrink = d.dur; G.fx.wide = 0; break;
    case 'laser': G.fx.laser = d.dur; break;
    case 'catch': G.fx.catch = d.dur; break;
    case 'slow': G.fx.slow = d.dur; G.fx.fast = 0; break;
    case 'fast': G.fx.fast = d.dur; G.fx.slow = 0; break;
    case 'fire': G.fx.fire = d.dur; break;
    case 'shield': G.shield = Math.min(3, G.shield + 1); break;
    case 'life': if (G.lives < 9) G.lives++; sfx('extraLife'); break;
    case 'charge': addOD(40); break;
  }
}
function splitBalls() {
  const src = G.balls.slice();
  for (const b of src) {
    if (b.stuck) launchBall(b);
    const ang = Math.atan2(b.vy, b.vx);
    for (const d of [-0.42, 0.42]) {
      if (G.balls.length >= MAX_BALLS) return;
      const nb = makeBall(b.x, b.y, b.speed);
      nb.cur = b.cur;
      setDir(nb, ang + d);
      G.balls.push(nb);
    }
  }
  G.awaitLaunch = false;
}
function fireLasers() {
  if (G.fx.laser <= 0 || G.laserCD > 0 || G.dying > 0 || !G.paddle) return;
  G.laserCD = 0.26;
  const p = G.paddle;
  for (const s of [-1, 1]) G.lasers.push({ x: p.x + s * (p.w / 2 - 9), y: p.y - PADDLE_H / 2 - 6, vy: -1000, dead: false });
  sfx('laser');
}

// ---------------------------------------------------------------------
// Boss logic
// ---------------------------------------------------------------------
function damageBoss(amount, x, y) {
  const B = G.boss;
  if (!B || B.dead || B.dying > 0 || B.enter > 0) return;
  B.hp = Math.max(0, B.hp - amount);
  B.flash = 1;
  bumpCombo();
  addScore(Math.round(250 * Math.min(amount, 3)), x, y);
  addOD(1.5 * amount);
  sparkBurst(x, y, B.def.col, 12, 420, 0.45);
  sfx('bossHit');
  addShake(3 + amount);
  if (B.phase === 1 && B.hp <= B.maxHp / 2) {
    B.phase = 2;
    sfx('bossRoar');
    callout('PHASE 2', B.def.col === '#ffffff' ? '#b44dff' : B.def.col, 52, 1.6);
    addShake(12);
    flashScreen(B.def.col, 0.3);
    for (const br of G.bricks) if (br.orbit && !br.alive) { br.alive = true; br.hp = br.maxHp; br.intro = 0; br.respawn = 0; }
  }
  if (B.hp <= 0) {
    B.dying = 2.6; B.boomT = 0;
    G.bullets = [];
    G.slowT = 1.0; G.slowScale = 0.35;
    sfx('bossRoar');
  }
}
function bossFire(pat) {
  const B = G.boss, p = G.paddle;
  const ox = B.x, oy = B.y + B.r * 0.55;
  const aim = Math.atan2(p.y - oy, p.x - ox);
  const sp = 250 * (B.phase === 2 ? 1.15 : 1) * (G.mode === 'endless' ? 1.08 : 1);
  const col = B.def.style === 'core' ? rainbow(B.t * 90) : B.def.col2;
  const shoot = (a, s) => G.bullets.push({ x: ox, y: oy, bx: ox, vx: Math.cos(a) * (s || sp), vy: Math.sin(a) * (s || sp), r: 7, t: 0, color: col, wob: 0, delay: 0 });
  switch (pat) {
    case 'aimed': shoot(aim); break;
    case 'aimed3': [-0.22, 0, 0.22].forEach(d => shoot(aim + d)); break;
    case 'spread3': [-0.38, 0, 0.38].forEach(d => shoot(Math.PI / 2 + d)); break;
    case 'spread5': [-0.64, -0.32, 0, 0.32, 0.64].forEach(d => shoot(Math.PI / 2 + d, sp * 0.9)); break;
    case 'wave':
      for (let i = 0; i < 4; i++) G.bullets.push({ x: ox + (i - 1.5) * 46, y: oy, bx: ox + (i - 1.5) * 46, vx: 0, vy: 175, r: 7, t: 0, color: col, wob: 70, wf: 2.6, ph: i * 1.2, delay: 0 });
      break;
    case 'spiral':
      for (let i = 0; i < 8; i++) shoot(B.spiral + i * TAU / 8, 190);
      B.spiral += 0.33;
      break;
    case 'rain':
      for (let i = 0; i < 6; i++) {
        const x = clamp(p.x + rand(-260, 260), WALL_L + 20, WALL_R - 20);
        G.bullets.push({ x, y: WALL_T + 6, bx: x, vx: 0, vy: 330, r: 6, t: 0, color: col, wob: 0, delay: 0.7 + i * 0.12 });
      }
      break;
  }
  sfx('bossShoot');
}
function updateBoss(dt) {
  const B = G.boss;
  if (!B) return;
  B.t += dt;
  if (B.dead) return;
  B.flash = Math.max(0, B.flash - dt * 5);
  B.hpLag = B.hpLag > B.hp ? Math.max(B.hp, B.hpLag - dt * B.maxHp * 0.4) : B.hp;
  if (B.dying > 0) {
    B.dying -= dt;
    B.boomT -= dt;
    if (B.boomT <= 0) {
      B.boomT = 0.13;
      const a = rand(0, TAU), r = rand(0, B.r);
      const x = B.x + Math.cos(a) * r, y = B.y + Math.sin(a) * r;
      shock(x, y, 70, B.def.col, 0.35);
      sparkBurst(x, y, rand(0, 1) < 0.5 ? B.def.col : B.def.col2, 14, 450, 0.5);
      emit({ k: 2, x, y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ff8a3d', size: 70 });
      sfx('explode', false);
      addShake(4);
    }
    if (B.dying <= 0) killBoss();
    return;
  }
  const speed = B.phase === 2 ? 1.45 : 1;
  B.pt += dt * speed;
  let [tx, ty] = B.def.path(B.pt);
  if (B.enter > 0) {
    B.enter = Math.max(0, B.enter - dt);
    const e = easeOutCubic(1 - B.enter / 1.8);
    ty = lerp(-160, ty, e);
  }
  // teleport (Prism Core, phase 2)
  if (B.def.teleport && B.phase === 2) {
    B.tpT -= dt;
    if (B.tpState === 0 && B.tpT <= 0) { B.tpState = 1; B.tpT = 0.45; }
    else if (B.tpState === 1) {
      B.alpha = Math.max(0, B.tpT / 0.45);
      if (B.tpT <= 0) { B.pt += rand(3, 8); B.tpState = 2; B.tpT = 0.45; sfx('phase'); [tx, ty] = B.def.path(B.pt); }
    } else if (B.tpState === 2) {
      B.alpha = 1 - Math.max(0, B.tpT / 0.45);
      if (B.tpT <= 0) { B.tpState = 0; B.tpT = rand(5, 8); B.alpha = 1; }
    }
  }
  B.x = tx; B.y = ty;
  B.inv -= dt;
  B.blink -= dt;
  if (B.blink < -rand(2.5, 5)) B.blink = 0.14;
  for (const ring of B.rings) ring.angle += ring.spd * dt * speed;
  const launched = G.balls.some(b => !b.stuck);
  if (B.enter <= 0 && G.dying <= 0 && G.clearing <= 0 && launched) {
    B.fireT -= dt;
    if (B.fireT <= 0) {
      const pats = B.def.pat[B.phase - 1];
      bossFire(pats[B.patIdx++ % pats.length]);
      B.fireT = B.def.fire[B.phase - 1] * rand(0.85, 1.15);
    }
  }
  // ring bricks: orbit + regenerate
  for (const br of G.bricks) {
    if (!br.orbit) continue;
    const ring = B.rings[br.orbit.ring];
    const a = ring.angle + br.orbit.idx / ring.n * TAU;
    br.x = B.x + Math.cos(a) * ring.rad - br.w / 2;
    br.y = B.y + Math.sin(a) * ring.rad * 0.8 - br.h / 2;
    if (!br.alive && br.respawn > 0) {
      br.respawn -= dt;
      if (br.respawn <= 0) {
        const blocked = G.balls.some(b => b.x + b.r > br.x && b.x - b.r < br.x + br.w && b.y + b.r > br.y && b.y - b.r < br.y + br.h);
        if (blocked) br.respawn = 0.4;
        else { br.alive = true; br.hp = br.maxHp; br.intro = 0; }
      }
    }
  }
}
function killBoss() {
  const B = G.boss;
  B.dead = true;
  sfx('explode', true);
  addShake(22);
  flashScreen('#ffffff', 0.9);
  shock(B.x, B.y, 320, B.def.col, 0.9);
  shock(B.x, B.y, 200, '#ffffff', 0.6);
  for (let i = 0; i < 80; i++) {
    const a = rand(0, TAU), s = rand(100, 900);
    emit({ k: i % 3 === 0 ? 1 : 0, x: B.x, y: B.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.6, 1.5), max: 1.5, color: i % 2 ? B.def.col : B.def.col2, size: rand(2, 6), drag: 1.5, g: 200, rot: rand(0, TAU), vr: rand(-10, 10) });
  }
  for (const br of G.bricks) if (br.orbit && br.alive) { br.alive = false; shatter(br); }
  G.combo = Math.max(G.combo, 1);
  addScore(8000 * (G.mode === 'endless' ? 1 : 1 + Math.floor(G.levelIndex / 5)), B.x, B.y);
  G.checkClear = true;
}

// ---------------------------------------------------------------------
// Physics step
// ---------------------------------------------------------------------
function circleRect(cx, cy, r, x, y, w, h) {
  const px = clamp(cx, x, x + w), py = clamp(cy, y, y + h);
  const dx = cx - px, dy = cy - py, d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 > 1e-6) { const d = Math.sqrt(d2); return { nx: dx / d, ny: dy / d, pen: r - d }; }
  const l = cx - x, rt = x + w - cx, t = cy - y, bt = y + h - cy;
  const m = Math.min(l, rt, t, bt);
  if (m === l) return { nx: -1, ny: 0, pen: l + r };
  if (m === rt) return { nx: 1, ny: 0, pen: rt + r };
  if (m === t) return { nx: 0, ny: -1, pen: t + r };
  return { nx: 0, ny: 1, pen: bt + r };
}

function step(dt) {
  G.time += dt;
  G.levelTime += dt;
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  updatePaddle(dt);
  updateBricks(dt);
  updateBoss(dt);
  updateBalls(dt);
  updatePowerups(dt);
  updateLasers(dt);
  updateBullets(dt);
  for (let i = G.explosions.length - 1; i >= 0; i--) {
    const e = G.explosions[i];
    e.t -= dt;
    if (e.t <= 0) { G.explosions.splice(i, 1); detonate(e.x, e.y); }
  }
  for (const k in G.fx) {
    if (G.fx[k] > 0) {
      G.fx[k] -= dt;
      if (G.fx[k] <= 0) {
        G.fx[k] = 0;
        if (k === 'catch') for (const b of G.balls) if (b.stuck && b.caught) launchBall(b);
      }
    }
  }
  if (G.odT > 0) G.odT = Math.max(0, G.odT - dt);
  G.laserCD -= dt;
  G.comboT += dt;
  if (G.fx.laser > 0 && G.dying <= 0) fireLasers();
  // supply drop: help hunt down the last stubborn bricks
  if (!G.boss && G.clearing <= 0 && G.dying <= 0 && G.balls.some(b => !b.stuck)) {
    G.sinceBrick += dt;
    if (G.sinceBrick > 22 && G.powerups.length < 3) {
      G.sinceBrick = 0;
      const type = ['laser', 'fire', 'multi'][Math.floor(Math.random() * 3)];
      G.powerups.push({ type, x: rand(WALL_L + 60, WALL_R - 60), y: WALL_T + 20, vy: 90, t: 0 });
      if (!G.demo) { callout('SUPPLY DROP', PU[type].color, 30, 1.4); sfx('gold'); }
    }
  }
  if (G.checkClear && G.clearing <= 0 && G.dying <= 0) {
    G.checkClear = false;
    if (G.boss ? G.boss.dead : !G.bricks.some(b => b.alive && b.kind !== 'steel' && !b.orbit)) beginClear();
  }
}

function updatePaddle(dt) {
  const p = G.paddle;
  let tw = PADDLE_W.base;
  if (G.fx.wide > 0) tw = PADDLE_W.wide; else if (G.fx.shrink > 0) tw = PADDLE_W.shrink;
  p.w += (tw - p.w) * Math.min(1, dt * 12);
  const half = p.w / 2, ox = p.x;
  if (p.stun > 0) p.stun -= dt;
  else if (p.dead) { /* no control while dead */ }
  else if (G.demo || G.autoplay) aiUpdate(dt);
  else if (Input.mode === 'keys') {
    const dir = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
    p.kv = lerp(p.kv, dir * 880, Math.min(1, dt * 16));
    p.x += p.kv * dt;
  } else {
    p.x += (Input.px - p.x) * Math.min(1, dt * 40);
  }
  p.x = clamp(p.x, WALL_L + half, WALL_R - half);
  if (p.x <= WALL_L + half || p.x >= WALL_R - half) p.kv *= 0.5;
  p.vx = (p.x - ox) / dt;
  p.squash = Math.max(0, p.squash - dt * 6);
  for (const b of G.balls) {
    if (!b.stuck) continue;
    b.off = clamp(b.off, -half + 4, half - 4);
    b.x = p.x + b.off;
    b.y = p.y - PADDLE_H / 2 - b.r - 0.5;
    b.stuckT += dt;
    if (b.caught && b.stuckT > 3) { launchBall(b); sfx('launch'); }
  }
}

function updateBricks(dt) {
  for (const b of G.bricks) {
    if (b.intro < 1) b.intro = Math.min(1, b.intro + dt * 2.4);
    if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 7);
    if (b.mv) b.x = b.bx + Math.sin(G.levelTime * b.mv.spd + b.mv.ph) * b.mv.amp;
  }
}

function updateBalls(dt) {
  const mul = (G.fx.slow > 0 ? 0.62 : 1) * (G.fx.fast > 0 ? 1.32 : 1) * (G.odT > 0 ? 1.1 : 1);
  const pierce = G.fx.fire > 0 || G.odT > 0;
  for (const b of G.balls) {
    if (b.stuck || b.dead) continue;
    const target = b.speed * mul;
    b.cur = lerp(b.cur || target, target, Math.min(1, dt * 4));
    const len = Math.hypot(b.vx, b.vy) || 1;
    b.vx = b.vx / len * b.cur; b.vy = b.vy / len * b.cur;
    b.idle += dt;
    const n = Math.max(1, Math.ceil(b.cur * dt / (b.r * 0.5)));
    const sdt = dt / n;
    for (let i = 0; i < n && !b.dead && !b.stuck; i++) {
      b.x += b.vx * sdt; b.y += b.vy * sdt;
      ballWalls(b);
      ballPaddle(b);
      if (b.stuck) break;
      ballBricks(b, pierce);
      ballBoss(b, pierce);
    }
    if (b.y - b.r > H + 4) b.dead = true;
  }
  if (G.balls.some(b => b.dead)) {
    G.balls = G.balls.filter(b => !b.dead);
    const bossFalling = G.boss && (G.boss.dying > 0 || G.boss.dead);
    if (G.balls.length === 0 && G.dying <= 0 && G.clearing <= 0 && !bossFalling) loseLife();
  }
}

function ballWalls(b) {
  let hit = false;
  if (b.x - b.r < WALL_L) { b.x = WALL_L + b.r; b.vx = Math.abs(b.vx); hit = true; }
  else if (b.x + b.r > WALL_R) { b.x = WALL_R - b.r; b.vx = -Math.abs(b.vx); hit = true; }
  if (b.y - b.r < WALL_T) { b.y = WALL_T + b.r; b.vy = Math.abs(b.vy); hit = true; }
  if (G.shield > 0 && b.vy > 0 && b.y + b.r > SHIELD_Y && b.y < SHIELD_Y + 14) {
    b.y = SHIELD_Y - b.r; b.vy = -Math.abs(b.vy);
    G.shield--;
    sfx('shield');
    shock(b.x, SHIELD_Y, 90, '#ffe14d', 0.4);
    sparkBurst(b.x, SHIELD_Y, '#ffe14d', 16, 400, 0.5);
    fixAngle(b);
  }
  if (hit) {
    if (b.idle > 9) perturb(b, 0.2);
    fixAngle(b);
    sfx('wall');
    sparkBurst(b.x, b.y, '#ffffff', 2, 160, 0.2);
  }
}

function ballPaddle(b) {
  const p = G.paddle;
  if (!p || p.dead || b.vy <= 0) return;
  const top = p.y - PADDLE_H / 2, half = p.w / 2;
  if (b.y + b.r < top || b.y - b.r > p.y + PADDLE_H / 2) return;
  if (b.x < p.x - half - b.r || b.x > p.x + half + b.r) return;
  if (b.y > p.y + 2) { b.vx = (b.x < p.x ? -1 : 1) * Math.abs(b.vx); return; }
  const off = clamp((b.x - p.x) / (half + b.r * 0.5), -1, 1);
  const ang = clamp(off * 1.08 + clamp(p.vx / 4000, -0.18, 0.18), -1.2, 1.2);
  const sp = Math.hypot(b.vx, b.vy);
  b.vx = Math.sin(ang) * sp; b.vy = -Math.cos(ang) * sp;
  b.y = top - b.r - 0.5;
  b.speed = Math.min(maxSpeed(), b.speed + 4);
  b.idle = 0;
  p.squash = 1;
  G.combo = 0;
  const col = G.odT > 0 ? rainbow(G.time * 300) : G.sector.accent2;
  sparkBurst(b.x, top, col, 6, 220, 0.3);
  if (G.demo || G.autoplay) G.aiOffset = rand(-0.85, 0.85);
  if (G.fx.catch > 0) {
    b.stuck = true; b.caught = true; b.stuckT = 0; b.off = b.x - p.x;
    sfx('catchBall');
  } else sfx('paddle');
}

function ballBricks(b, pierce) {
  let best = null, bn = null, bp = -1;
  for (const br of G.bricks) {
    if (!br.alive || br.intro < 0.6) continue;
    if (b.x + b.r < br.x || b.x - b.r > br.x + br.w || b.y + b.r < br.y || b.y - b.r > br.y + br.h) continue;
    const hit = circleRect(b.x, b.y, b.r, br.x, br.y, br.w, br.h);
    if (!hit) continue;
    if (pierce && br.kind !== 'steel') { damageBrick(br, 99, b); continue; }
    if (hit.pen > bp) { bp = hit.pen; best = br; bn = hit; }
  }
  if (!best) return;
  let nx = bn.nx, ny = bn.ny;
  if (Math.abs(nx) > Math.abs(ny)) { nx = nx > 0 ? 1 : -1; ny = 0; } else { ny = ny > 0 ? 1 : -1; nx = 0; }
  if (nx > 0) b.x = best.x + best.w + b.r;
  else if (nx < 0) b.x = best.x - b.r;
  else if (ny > 0) b.y = best.y + best.h + b.r;
  else b.y = best.y - b.r;
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
  fixAngle(b);
  b.speed = Math.min(maxSpeed(), b.speed + 0.6);
  damageBrick(best, 1, b);
}

function ballBoss(b, pierce) {
  const B = G.boss;
  if (!B || B.dead || B.dying > 0 || B.enter > 0 || B.alpha < 0.5) return;
  const dx = b.x - B.x, dy = b.y - B.y, d = Math.hypot(dx, dy), min = B.r + b.r;
  if (d >= min || d < 1e-6) return;
  const nx = dx / d, ny = dy / d;
  b.x = B.x + nx * min; b.y = B.y + ny * min;
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
  fixAngle(b);
  if (B.inv <= 0) { B.inv = 0.12; damageBoss(pierce ? 2 : 1, b.x - nx * b.r, b.y - ny * b.r); }
}

function updatePowerups(dt) {
  const p = G.paddle;
  for (const u of G.powerups) {
    u.t += dt;
    u.vy = Math.min(260, u.vy + 60 * dt);
    u.y += u.vy * dt;
    if (!p.dead && u.y + CAP_H / 2 >= p.y - PADDLE_H / 2 && u.y - CAP_H / 2 <= p.y + PADDLE_H / 2 && Math.abs(u.x - p.x) <= p.w / 2 + CAP_W / 2) {
      u.dead = true;
      applyPowerup(u.type);
    } else if (u.y > H + 20) u.dead = true;
  }
  G.powerups = G.powerups.filter(u => !u.dead);
}

function updateLasers(dt) {
  for (const l of G.lasers) {
    l.y += l.vy * dt;
    if (l.y < WALL_T) { l.dead = true; sparkBurst(l.x, WALL_T, '#ff3b6b', 3, 160, 0.2); continue; }
    for (const br of G.bricks) {
      if (!br.alive || br.intro < 0.6) continue;
      if (l.x >= br.x && l.x <= br.x + br.w && l.y >= br.y && l.y <= br.y + br.h + 10) {
        damageBrick(br, 1, 'laser'); l.dead = true;
        sparkBurst(l.x, br.y + br.h, '#ff3b6b', 4, 200, 0.25);
        break;
      }
    }
    const B = G.boss;
    if (!l.dead && B && !B.dead && B.dying <= 0 && B.enter <= 0 && B.alpha > 0.5 && Math.hypot(l.x - B.x, l.y - B.y) < B.r) {
      l.dead = true; damageBoss(0.35, l.x, l.y);
    }
  }
  G.lasers = G.lasers.filter(l => !l.dead);
}

function updateBullets(dt) {
  const p = G.paddle;
  for (const u of G.bullets) {
    if (u.delay > 0) { u.delay -= dt; continue; }
    u.t += dt;
    u.bx += u.vx * dt; u.y += u.vy * dt;
    u.x = u.wob ? u.bx + Math.sin(u.t * u.wf + u.ph) * u.wob : u.bx;
    if (u.y > H + 20 || u.y < WALL_T - 20 || u.x < WALL_L - 20 || u.x > WALL_R + 20) { u.dead = true; continue; }
    if (!p.dead && p.stun <= 0 && G.dying <= 0 &&
        u.y + u.r > p.y - PADDLE_H / 2 && u.y - u.r < p.y + PADDLE_H / 2 && Math.abs(u.x - p.x) < p.w / 2 + u.r) {
      u.dead = true;
      p.stun = 0.9;
      sfx('stun');
      addShake(8);
      flashScreen('#ff3b6b', 0.2);
      sparkBurst(u.x, u.y, u.color, 18, 380, 0.5);
      shock(u.x, u.y, 60, u.color, 0.35);
      if (!G.demo) floater('STUNNED', p.x, p.y - 30, '#ff3b6b', 16);
    }
  }
  G.bullets = G.bullets.filter(u => !u.dead);
}

// ---------------------------------------------------------------------
// Autopilot (attract mode demo)
// ---------------------------------------------------------------------
function predictX(x, vx, t, r) {
  const L = WALL_L + r, R = WALL_R - r, span = R - L;
  let u = (x + vx * t - L) % (2 * span);
  if (u < 0) u += 2 * span;
  return u > span ? L + 2 * span - u : L + u;
}
function aiUpdate(dt) {
  const p = G.paddle;
  let target = null, best = Infinity;
  for (const b of G.balls) {
    if (b.stuck || b.vy <= 0) continue;
    const t = (p.y - PADDLE_H / 2 - b.r - b.y) / b.vy;
    if (t >= -0.05 && t < best) { best = t; target = predictX(b.x, b.vx, Math.max(0, t), b.r); }
  }
  if (target === null) {
    const pu = G.powerups.find(u => !PU[u.type].bad && u.y > 380);
    if (pu) target = pu.x;
    else if (G.balls.length) target = lerp(p.x, G.balls[0].x, 0.5);
    else target = W / 2;
  } else target += G.aiOffset * p.w * 0.38;
  const maxV = 1500 * dt;
  p.x += clamp(target - p.x, -maxV, maxV);
  if (G.balls.some(b => b.stuck)) {
    G.aiLaunchT += dt;
    if (G.aiLaunchT > 0.9) { G.aiLaunchT = 0; G.aiOffset = rand(-0.8, 0.8); releaseBalls(); }
  }
  if (G.odReady) activateOD();
}

// ---------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------
function emit(o) {
  if (parts.length >= 1400) return;
  if (o.drag === undefined) o.drag = 0;
  if (o.g === undefined) o.g = 0;
  if (o.rot === undefined) { o.rot = 0; o.vr = 0; }
  parts.push(o);
}
function sparkBurst(x, y, color, n, speed, life) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(0.3, 1) * speed;
    emit({ k: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.5, 1) * life, max: life, color, size: rand(1.2, 2.4), drag: 3, g: 0 });
  }
}
function shatter(br) {
  const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
  const prism = br.kind === 'prism';
  const n = br.orbit ? 8 : 12;
  for (let i = 0; i < n; i++) {
    emit({ k: 1, x: br.x + rand(0, br.w), y: br.y + rand(0, br.h), vx: rand(-170, 170), vy: rand(-240, 30), rot: rand(0, TAU), vr: rand(-14, 14),
      life: rand(0.5, 0.95), max: 0.95, color: prism ? rainbow(rand(0, 360)) : (br.kind === 'steel' ? '#9aa3b8' : br.color), size: rand(3, 7), g: 900, drag: 0.4 });
  }
  sparkBurst(cx, cy, prism ? '#ffffff' : br.color, 8, 380, 0.45);
  emit({ k: 2, x: cx, y: cy, vx: 0, vy: 0, life: 0.25, max: 0.25, color: br.kind === 'ultra' ? '#cfe0ff' : br.color, size: 50 });
}
function shock(x, y, maxR, color, life) {
  if (G.shocks.length > 30) G.shocks.shift();
  G.shocks.push({ x, y, r: 4, maxR, color, life, max: life });
}
function updateParticles(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; }
    p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  for (const s of G.shocks) { s.life -= dt; s.r += (s.maxR - s.r) * Math.min(1, dt * 9); }
  G.shocks = G.shocks.filter(s => s.life > 0);
  for (const f of G.floaters) { f.life -= dt; f.y -= 40 * dt; }
  G.floaters = G.floaters.filter(f => f.life > 0);
}

// ---------------------------------------------------------------------
// Frame update
// ---------------------------------------------------------------------
function update(dt) {
  G.bgTime += dt;
  for (const c of G.callouts) c.t += dt;
  G.callouts = G.callouts.filter(c => c.t < c.dur);
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 2.5);
  G.shake *= Math.pow(0.0025, dt);
  if (G.shake < 0.15) G.shake = 0;
  G.shownScore = G.shownScore < G.score ? Math.min(G.score, G.shownScore + Math.max(1, (G.score - G.shownScore) * dt * 8)) : G.score;

  if (G.state === 'playing' || G.state === 'menu') {
    if (G.state === 'playing') handleGameInput();
    simulate(dt);
  } else if (G.state === 'tally') {
    if (Input.firePressed) { Input.firePressed = false; advanceTally(); }
    if (G.tally) updateTally(dt);
    updateParticles(dt);
  } else if (G.state === 'over') {
    updateParticles(dt);
    if (G.endKind === 'victory' && Math.random() < dt * 3) firework();
    if (G.overT > 0) { G.overT -= dt; if (G.overT <= 0) UI.showEnd(G.endKind); }
  }
  Input.firePressed = false;
  Input.odPressed = false;

  let e = 0;
  if (G.boss || G.combo >= 8 || G.balls.length >= 3) e = 1;
  if (G.odT > 0 || (G.boss && G.boss.phase === 2 && !G.boss.dead)) e = 2;
  Sound.setEnergy(G.state === 'menu' ? 0 : e);

  // UI flags for touch buttons
  document.body.classList.toggle('od-ready', G.state === 'playing' && G.odReady);
}

function handleGameInput() {
  if (Input.firePressed && !G.paddle.dead && G.dying <= 0) {
    if (releaseBalls()) { /* launched */ }
  }
  if (Input.odPressed) activateOD();
}

function simulate(dt) {
  if (G.slowT > 0) G.slowT -= dt;
  const targetScale = G.slowT > 0 ? G.slowScale : 1;
  G.timeScale += (targetScale - G.timeScale) * Math.min(1, dt * 12);
  if (G.hitstop > 0) G.hitstop -= dt;
  else {
    acc += dt * G.timeScale;
    let n = 0;
    while (acc >= STEP && n < 12) { step(STEP); acc -= STEP; n++; }
    if (n >= 12) acc = 0;
  }
  updateParticles(dt * G.timeScale);
  for (const b of G.balls) {
    b.trail.push(b.x, b.y);
    if (b.trail.length > 28) b.trail.splice(0, 2);
  }
  if (G.dying > 0) { G.dying -= dt; if (G.dying <= 0) { G.dying = 0; afterDeath(); } }
  if (G.clearing > 0) {
    G.clearing -= dt;
    if (G.clearing <= 0) {
      G.clearing = 0;
      if (G.demo) startDemo(); else startTally();
    }
  }
  if (G.demo) {
    G.demoT += dt;
    if (G.demoT > 55 && G.clearing <= 0) startDemo();
  }
}

function firework() {
  const x = rand(120, W - 120), y = rand(120, 380), col = rainbow(rand(0, 360));
  shock(x, y, rand(60, 120), col, 0.6);
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * TAU, s = rand(180, 320);
    emit({ k: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.8, 1.3), max: 1.3, color: i % 4 ? col : '#ffffff', size: 2, drag: 1.8, g: 160 });
  }
  Sound.fx.countTick();
}

// ---------------------------------------------------------------------
// Rendering — backgrounds
// ---------------------------------------------------------------------
function ensureBg() {
  const theme = G.sector.theme;
  const key = theme + ':' + canvas.width + 'x' + canvas.height;
  if (bgKey === key && bgCanvas) return;
  bgKey = key;
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = canvas.width; bgCanvas.height = canvas.height;
  const g = bgCanvas.getContext('2d');
  g.setTransform(PRX, 0, 0, PRY, 0, 0);
  const R = mulberry32(theme.length * 1013 + 7);
  if (theme === 'city') bgCity(g, R);
  else if (theme === 'abyss') bgAbyss(g, R);
  else if (theme === 'solar') bgSolar(g, R);
  else bgRift(g, R);
  bgParts.length = 0;
}
function stars(g, R, n, maxY, col) {
  for (let i = 0; i < n; i++) {
    const s = R() * 1.6 + 0.3;
    g.fillStyle = rgba(col || '#ffffff', 0.25 + R() * 0.6);
    g.fillRect(R() * W, R() * maxY, s, s);
  }
}
function bgCity(g, R) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05000f'); sky.addColorStop(0.42, '#170530'); sky.addColorStop(0.69, '#46104f'); sky.addColorStop(0.7, '#0f021c'); sky.addColorStop(1, '#040009');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  stars(g, R, 160, 420);
  const hz = 500, sr = 165;
  // synthwave sun on its own layer (striped cut-outs)
  const sc = document.createElement('canvas');
  sc.width = Math.ceil(sr * 2 * PR); sc.height = Math.ceil(sr * PR);
  const sg = sc.getContext('2d'); sg.scale(PR, PR);
  const grd = sg.createLinearGradient(0, 0, 0, sr);
  grd.addColorStop(0, '#ffe66d'); grd.addColorStop(0.55, '#ff7a3d'); grd.addColorStop(1, '#ff2e88');
  sg.fillStyle = grd; sg.beginPath(); sg.arc(sr, sr, sr, Math.PI, 0); sg.fill();
  sg.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 8; i++) sg.fillRect(0, sr * 0.45 + i * 12, sr * 2, 1.5 + i * 1.1);
  g.save();
  g.shadowColor = '#ff2e88'; g.shadowBlur = 70;
  g.globalAlpha = 0.55;
  g.drawImage(sc, W / 2 - sr, hz - sr, sr * 2, sr);
  g.restore();
  // skyline
  let x = -10;
  while (x < W + 10) {
    const bw = 24 + R() * 54, bh = 26 + R() * 120 * (0.4 + 0.6 * Math.abs(Math.sin(x / 140)));
    g.fillStyle = '#0c021b'; g.fillRect(x, hz - bh, bw, bh);
    g.fillStyle = 'rgba(255,77,240,0.25)'; g.fillRect(x, hz - bh, bw, 1);
    for (let wy = hz - bh + 6; wy < hz - 6; wy += 8) {
      for (let wx = x + 4; wx < x + bw - 4; wx += 7) {
        if (R() < 0.18) { g.fillStyle = R() < 0.5 ? 'rgba(61,232,255,0.55)' : 'rgba(255,77,240,0.5)'; g.fillRect(wx, wy, 2.5, 3); }
      }
    }
    x += bw + 2 + R() * 6;
  }
  g.fillStyle = 'rgba(255,77,240,0.7)'; g.fillRect(0, hz, W, 1.5);
}
function bgAbyss(g, R) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#00121f'); sky.addColorStop(0.5, '#002433'); sky.addColorStop(1, '#00343f');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 120; i++) { g.fillStyle = rgba('#7ff6ff', 0.05 + R() * 0.2); const s = R() * 2 + 0.5; g.fillRect(R() * W, R() * H, s, s); }
  // distant ridges
  for (let layer = 0; layer < 3; layer++) {
    g.fillStyle = ['#00202c', '#001820', '#000f15'][layer];
    g.beginPath(); g.moveTo(0, H);
    const base = 560 + layer * 50;
    for (let x = 0; x <= W; x += 20) g.lineTo(x, base - Math.abs(Math.sin(x / (90 + layer * 40) + layer)) * (60 - layer * 10) - R() * 12);
    g.lineTo(W, H); g.closePath(); g.fill();
  }
  // kelp silhouettes
  g.strokeStyle = 'rgba(0,60,60,0.7)'; g.lineWidth = 4; g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const kx = R() * W, kh = 80 + R() * 160;
    g.beginPath(); g.moveTo(kx, H);
    for (let s = 0; s <= kh; s += 10) g.lineTo(kx + Math.sin(s / 22 + i) * 8, H - s);
    g.stroke();
  }
}
function bgSolar(g, R) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0d0000'); sky.addColorStop(0.55, '#2c0700'); sky.addColorStop(0.78, '#4a1300'); sky.addColorStop(0.79, '#170300'); sky.addColorStop(1, '#080000');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  stars(g, R, 90, 520, '#ffd9a0');
  const cx = W / 2, cy = 470, r = 120;
  const cor = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 2.6);
  cor.addColorStop(0, 'rgba(255,200,80,0.75)'); cor.addColorStop(0.2, 'rgba(255,110,30,0.35)'); cor.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = cor; g.fillRect(0, 0, W, H);
  g.fillStyle = '#050000'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,230,160,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,120,40,0.75)'; g.fillRect(0, 568, W, 1.5);
}
function bgRift(g, R) {
  g.fillStyle = '#04000c'; g.fillRect(0, 0, W, H);
  const cols = ['#b44dff', '#3de8ff', '#ff4df0', '#4d7bff'];
  for (let i = 0; i < 9; i++) {
    const x = R() * W, y = R() * H, r = 120 + R() * 260;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(cols[i % 4], 0.16)); gr.addColorStop(1, rgba(cols[i % 4], 0));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  stars(g, R, 260, H);
}

function drawBackground(dt) {
  ensureBg();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bgCanvas, 0, 0);
  ctx.setTransform(PRX, 0, 0, PRY, 0, 0);
  const th = G.sector.theme, t = G.bgTime, beat = Sound.beat();
  if (th === 'city') {
    drawGrid(500, '#ff4df0', 0.22 + beat * 0.25, t * 0.5);
  } else if (th === 'abyss') {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = 120 + i * 190 + Math.sin(t * 0.3 + i) * 60;
      const gr = ctx.createLinearGradient(x, 0, x + 80, H * 0.8);
      gr.addColorStop(0, 'rgba(120,240,255,0.10)'); gr.addColorStop(1, 'rgba(120,240,255,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 200, H * 0.85); ctx.lineTo(x + 40, H * 0.85); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = rgba('#3de8ff', 0.12 + beat * 0.15); ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      const y0 = 600 + k * 22;
      for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y0 + Math.sin(x / 70 + t * (0.8 + k * 0.15) + k) * (5 + k * 1.5));
      ctx.stroke();
    }
    if (bgParts.length < 40 && Math.random() < dt * 8) bgParts.push({ x: rand(0, W), y: H + 10, v: rand(20, 60), r: rand(1.5, 4.5), ph: rand(0, TAU) });
    ctx.strokeStyle = 'rgba(160,250,255,0.35)'; ctx.lineWidth = 1;
    for (const b of bgParts) {
      b.y -= b.v * dt;
      ctx.beginPath(); ctx.arc(b.x + Math.sin(t * 2 + b.ph) * 6, b.y, b.r, 0, TAU); ctx.stroke();
    }
    for (let i = bgParts.length - 1; i >= 0; i--) if (bgParts[i].y < -10) bgParts.splice(i, 1);
  } else if (th === 'solar') {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow('#ff8a3d', W / 2, 470, 260 + beat * 30, 0.18 + beat * 0.12);
    ctx.globalCompositeOperation = 'source-over';
    drawGrid(568, '#ff6a2d', 0.2 + beat * 0.25, t * 0.6);
    if (bgParts.length < 60 && Math.random() < dt * 14) bgParts.push({ x: rand(0, W), y: H + 5, v: rand(30, 90), r: rand(1, 2.5), ph: rand(0, TAU) });
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bgParts) {
      b.y -= b.v * dt; b.x += Math.sin(t + b.ph) * 10 * dt;
      ctx.fillStyle = rgba(b.r > 1.8 ? '#ffb347' : '#ff6a2d', clamp((b.y - 80) / 500, 0, 0.8));
      ctx.fillRect(b.x, b.y, b.r, b.r);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = bgParts.length - 1; i >= 0; i--) if (bgParts[i].y < 60) bgParts.splice(i, 1);
  } else {
    // rift: warp-speed starfield
    if (bgParts.length < 90) bgParts.push({ a: rand(0, TAU), d: rand(5, 60), v: rand(40, 140) });
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.2;
    for (const s of bgParts) {
      s.v *= 1 + dt * 0.9; s.d += s.v * dt;
      const x = W / 2 + Math.cos(s.a) * s.d, y = H / 2 + Math.sin(s.a) * s.d;
      const x2 = W / 2 + Math.cos(s.a) * (s.d - s.v * 0.06), y2 = H / 2 + Math.sin(s.a) * (s.d - s.v * 0.06);
      ctx.strokeStyle = rgba(s.a > 3 ? '#b44dff' : '#3de8ff', Math.min(0.7, s.d / 400));
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = bgParts.length - 1; i >= 0; i--) if (bgParts[i].d > 700) bgParts.splice(i, 1);
    drawGrid(600, '#b44dff', 0.15 + beat * 0.2, t * 0.7);
  }
  // dim the playfield for contrast
  ctx.fillStyle = 'rgba(4,0,12,0.42)';
  ctx.fillRect(WALL_L, WALL_T, WALL_R - WALL_L, H - WALL_T);
}
function drawGrid(horizon, color, alpha, scroll) {
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const vx = W / 2;
  for (let i = -14; i <= 14; i++) {
    ctx.moveTo(vx + i * 14, horizon);
    ctx.lineTo(vx + i * 110, H);
  }
  const s = scroll % 1;
  for (let i = 0; i < 14; i++) {
    const p = (i + s) / 14;
    const y = horizon + (H - horizon) * p * p;
    ctx.moveTo(0, y); ctx.lineTo(W, y);
  }
  ctx.stroke();
}

// ---------------------------------------------------------------------
// Rendering — playfield
// ---------------------------------------------------------------------
function drawWalls() {
  const a = G.sector.accent, a2 = G.sector.accent2, beat = Sound.beat();
  ctx.fillStyle = 'rgba(2,0,8,0.75)';
  ctx.fillRect(0, HUD_H, WALL_L, H - HUD_H);
  ctx.fillRect(WALL_R, HUD_H, W - WALL_R, H - HUD_H);
  ctx.fillRect(0, HUD_H, W, WALL_T - HUD_H);
  ctx.save();
  ctx.shadowBlur = 12 + beat * 10;
  ctx.shadowColor = a;
  const gr = ctx.createLinearGradient(0, WALL_T, 0, H);
  gr.addColorStop(0, a); gr.addColorStop(1, rgba(a2, 0.3));
  ctx.fillStyle = gr;
  ctx.fillRect(WALL_L - 3, WALL_T, 3, H - WALL_T);
  ctx.fillRect(WALL_R, WALL_T, 3, H - WALL_T);
  const gt = ctx.createLinearGradient(WALL_L, 0, WALL_R, 0);
  gt.addColorStop(0, a); gt.addColorStop(0.5, a2); gt.addColorStop(1, a);
  ctx.fillStyle = gt;
  ctx.fillRect(WALL_L - 3, WALL_T - 3, WALL_R - WALL_L + 6, 3);
  ctx.restore();
}

function drawBricks() {
  const t = G.time;
  for (const b of G.bricks) {
    if (!b.alive) continue;
    let y = b.y, a = 1;
    if (b.intro < 1) {
      const k = clamp(b.intro, 0, 1);
      if (k <= 0) continue;
      a = k; y -= (1 - easeOutCubic(k)) * 34;
    }
    const s = brickSprite(b);
    if (b.flash > 0) y -= b.flash * 2;
    ctx.globalAlpha = a;
    ctx.drawImage(s.c, b.x - s.pad, y - s.pad, b.w + s.pad * 2, b.h + s.pad * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  // bricks breathe with the kick drum
  const beat = Sound.beat();
  if (beat > 0.04 && Settings.flashes) {
    ctx.fillStyle = 'rgba(255,255,255,' + (beat * 0.07).toFixed(3) + ')';
    for (const b of G.bricks) if (b.alive && b.intro >= 1 && b.kind !== 'steel') ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
  }
  for (const b of G.bricks) {
    if (!b.alive || b.intro < 1) continue;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (b.kind === 'explosive') drawGlow('#ff3b3b', cx, cy, 36, 0.22 + 0.18 * Math.sin(t * 6 + b.col));
    else if (b.kind === 'prism') drawGlow(rainbow(t * 140 + b.col * 40 + b.row * 25), cx, cy, 42, 0.32);
    else if (b.kind === 'gold') {
      const ph = (t * 0.7 + b.col * 0.37 + b.row * 0.21) % 1;
      if (ph < 0.25) drawGlow('#fff3b0', b.x + ph * 4 * b.w, b.y + 4, 14, 0.9 * Math.sin(ph * 4 * Math.PI));
    }
    if (b.flash > 0) {
      ctx.globalAlpha = b.flash * 0.75;
      ctx.fillStyle = '#ffffff';
      rr(ctx, b.x, b.y - b.flash * 2, b.w, b.h, 4); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawPowerups() {
  for (const u of G.powerups) {
    const s = sprite('cap' + u.type, CAP_W, CAP_H, 14, (g, w, h) => paintCapsule(g, u.type, w, h));
    const d = PU[u.type];
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(d.color, u.x, u.y, 34, 0.25 + 0.15 * Math.sin(u.t * 8));
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.rotate(Math.sin(u.t * 3) * 0.12);
    ctx.scale(1, 0.85 + 0.15 * Math.abs(Math.cos(u.t * 2.2)));
    ctx.drawImage(s.c, -CAP_W / 2 - s.pad, -CAP_H / 2 - s.pad, CAP_W + s.pad * 2, CAP_H + s.pad * 2);
    ctx.restore();
  }
}

function drawLasersAndBullets() {
  ctx.globalCompositeOperation = 'lighter';
  for (const l of G.lasers) {
    drawGlow('#ff3b6b', l.x, l.y, 16, 0.6);
    ctx.fillStyle = '#ffd0dc'; ctx.fillRect(l.x - 1.5, l.y - 9, 3, 18);
  }
  for (const u of G.bullets) {
    if (u.delay > 0) {
      const a = 0.25 + 0.25 * Math.sin(G.time * 30);
      ctx.fillStyle = rgba(u.color, a);
      ctx.fillRect(u.x - 1, WALL_T, 2, H - WALL_T);
      drawGlow(u.color, u.x, WALL_T + 8, 14, 0.8);
      continue;
    }
    drawGlow(u.color, u.x, u.y, u.r * 3.4, 0.8);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(u.x, u.y, u.r * 0.55, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function paddleAccent() {
  const p = G.paddle;
  if (p.stun > 0) return '#8a8a99';
  if (G.odT > 0) return rainbow(G.time * 300);
  if (G.fx.laser > 0) return '#ff3b6b';
  if (G.fx.catch > 0) return '#b44dff';
  if (G.fx.shrink > 0) return '#9a8cb0';
  return G.sector.accent2;
}
function drawPaddle() {
  const p = G.paddle;
  if (!p || p.dead) return;
  if (p.stun > 0 && Math.floor(p.stun * 20) % 2 === 0) return;
  const w = p.w, h = PADDLE_H, x = p.x - w / 2, y = p.y - h / 2;
  const acc2 = paddleAccent();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1 + p.squash * 0.07, 1 - p.squash * 0.3);
  ctx.translate(-p.x, -p.y);
  if (G.fx.catch > 0) {
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createLinearGradient(0, y - 16, 0, y);
    gr.addColorStop(0, 'rgba(180,77,255,0)'); gr.addColorStop(1, 'rgba(180,77,255,0.35)');
    ctx.fillStyle = gr; ctx.fillRect(x + 6, y - 16, w - 12, 16);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (G.fx.laser > 0) {
    ctx.fillStyle = '#ffb3c6';
    for (const s of [-1, 1]) {
      const tx = p.x + s * (w / 2 - 9);
      rr(ctx, tx - 4, y - 7, 8, 9, 2); ctx.fill();
    }
  }
  ctx.shadowColor = acc2; ctx.shadowBlur = 20;
  const gr = ctx.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, lighten(acc2, 0.3)); gr.addColorStop(0.7, darken(acc2, 0.35)); gr.addColorStop(1, darken(acc2, 0.7));
  ctx.fillStyle = gr;
  rr(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.shadowBlur = 0;
  // core strip
  ctx.fillStyle = 'rgba(10,0,30,0.55)';
  rr(ctx, x + 14, p.y - 2, w - 28, 4, 2); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 8);
  ctx.fillStyle = rgba(acc2, 0.5 + pulse * 0.5);
  rr(ctx, x + 14, p.y - 1, (w - 28) * (G.odReady ? 1 : 0.999), 2, 1); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // end caps
  ctx.fillStyle = darken(acc2, 0.2);
  rr(ctx, x + 1, y + 2, 9, h - 4, 4); ctx.fill();
  rr(ctx, x + w - 10, y + 2, 9, h - 4, 4); ctx.fill();
  ctx.restore();
  // magnet/stun indicator
  if (p.stun > 0) sparkBurst(p.x + rand(-w / 2, w / 2), p.y, '#d0d0ff', 1, 120, 0.2);
}

function ballColor(b) {
  if (G.odT > 0) return rainbow(G.time * 400 + b.hue);
  if (G.fx.fire > 0) return '#ff8a3d';
  return '#7ff3ff';
}
function drawBalls() {
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of G.balls) {
    const col = ballColor(b), tr = b.trail, n = tr.length / 2;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      ctx.strokeStyle = rgba(col, t * (G.fx.fire > 0 || G.odT > 0 ? 0.6 : 0.4));
      ctx.lineWidth = b.r * 2 * t * (G.fx.fire > 0 ? 1.3 : 1);
      ctx.beginPath(); ctx.moveTo(tr[(i - 1) * 2], tr[(i - 1) * 2 + 1]); ctx.lineTo(tr[i * 2], tr[i * 2 + 1]); ctx.stroke();
    }
    drawGlow(col, b.x, b.y, G.fx.fire > 0 ? 34 : 26, 0.9);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const b of G.balls) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(ballColor(b), 0.9); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 0.5, 0, TAU); ctx.stroke();
  }
}

function drawShield() {
  if (G.shield <= 0) return;
  const pulse = 0.6 + 0.4 * Math.sin(G.time * 5);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 14;
  for (let i = 0; i < G.shield; i++) {
    ctx.fillStyle = rgba('#ffe14d', (0.5 + 0.3 * pulse) / (i + 1));
    ctx.fillRect(WALL_L, SHIELD_Y + i * 4, WALL_R - WALL_L, 2);
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of parts) {
    if (p.k !== 1) continue;
    ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1);
    ctx.fillStyle = p.color;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const p of parts) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.k === 0) {
      ctx.strokeStyle = rgba(p.color, a);
      ctx.lineWidth = p.size;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
    } else if (p.k === 2) {
      drawGlow(p.color, p.x, p.y, p.size * (1.4 - a * 0.4), a * 0.8);
    }
  }
  for (const s of G.shocks) {
    const a = clamp(s.life / s.max, 0, 1);
    ctx.strokeStyle = rgba(s.color, a * 0.85);
    ctx.lineWidth = 1 + a * 6;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function setFont(size, weight, family) { ctx.font = (weight || 700) + ' ' + size + 'px ' + (family || FONT); }
function spacing(px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
function drawFloaters() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of G.floaters) {
    const a = clamp(f.life / f.max * 1.6, 0, 1);
    setFont(f.size, 800);
    ctx.globalAlpha = a;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,0,15,0.8)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// ----- Bosses -----
function drawEye(B, x, y, w, h, irisCol, slit, charge) {
  const p = G.paddle;
  const dx = p.x - B.x, dy = p.y - B.y, dl = Math.hypot(dx, dy) || 1;
  const ix = x + dx / dl * w * 0.4, iy = y + dy / dl * h * 0.5;
  const open = B.blink > 0 ? 0.1 : 1;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x, y - h * 2 * open, x + w, y);
  ctx.quadraticCurveTo(x, y + h * 2 * open, x - w, y);
  ctx.closePath();
  ctx.fillStyle = '#fff6fb'; ctx.fill();
  ctx.clip();
  const ir = h * 0.95 * (1 + charge * 0.3);
  const ig = ctx.createRadialGradient(ix, iy, 0, ix, iy, ir);
  ig.addColorStop(0, lighten(irisCol, 0.6)); ig.addColorStop(0.6, irisCol); ig.addColorStop(1, darken(irisCol, 0.5));
  ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy, ir, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0a0010';
  ctx.beginPath();
  if (slit) ctx.ellipse(ix, iy, ir * 0.18, ir * 0.85, 0, 0, TAU);
  else ctx.arc(ix, iy, ir * (0.42 - charge * 0.15), 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(ix - ir * 0.35, iy - ir * 0.35, ir * 0.16, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = darken(irisCol, 0.3); ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x, y - h * 2 * open, x + w, y);
  ctx.quadraticCurveTo(x, y + h * 2 * open, x - w, y);
  ctx.stroke();
}
function drawWarden(B, t, charge) {
  const d = B.def, r = B.r;
  const rot = t * 0.7 * (B.phase === 2 ? 1.8 : 1);
  ctx.shadowColor = d.col; ctx.shadowBlur = 18;
  ctx.fillStyle = B.phase === 2 ? '#ff5a3a' : d.col2;
  for (let i = 0; i < 8; i++) {
    const a = rot + i * TAU / 8, len = r * (1.42 + 0.08 * Math.sin(t * 6 + i));
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.17) * r * 0.92, Math.sin(a - 0.17) * r * 0.92);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.lineTo(Math.cos(a + 0.17) * r * 0.92, Math.sin(a + 0.17) * r * 0.92);
    ctx.closePath(); ctx.fill();
  }
  poly(ctx, 8, r, -rot * 0.4 + Math.PI / 8);
  const gr = ctx.createRadialGradient(0, -r * 0.3, r * 0.1, 0, 0, r);
  gr.addColorStop(0, '#521036'); gr.addColorStop(1, '#14000b');
  ctx.fillStyle = gr; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = d.col; ctx.stroke();
  ctx.shadowBlur = 0;
  poly(ctx, 8, r * 0.74, rot * 0.3);
  ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(d.col2, 0.6); ctx.stroke();
  drawEye(B, 0, 0, r * 0.58, r * 0.22, d.col2, false, charge);
}
function drawLeviathan(B, t, charge) {
  const d = B.def, r = B.r;
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const bx = (i - 3) * r * 0.27;
    let px = bx, py = r * 0.55;
    for (let s = 1; s <= 9; s++) {
      const nx = bx + Math.sin(t * 2.4 + i * 0.9 + s * 0.6) * (5 + s * 2.4), ny = r * 0.55 + s * 11;
      ctx.strokeStyle = rgba(s % 2 ? d.col : d.col2, Math.max(0.1, 0.9 - s * 0.085));
      ctx.lineWidth = Math.max(1, 7 - s * 0.7);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
      px = nx; py = ny;
    }
  }
  const flap = Math.sin(t * 3) * 0.25;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.8, -r * 0.25);
    ctx.quadraticCurveTo(side * r * 1.75, -r * (0.95 + flap), side * r * 1.55, r * 0.4);
    ctx.quadraticCurveTo(side * r * 1.2, r * 0.1, side * r * 0.85, r * 0.35);
    ctx.closePath();
    ctx.fillStyle = rgba(d.col, 0.3); ctx.fill();
    ctx.strokeStyle = d.col; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.shadowColor = d.col; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.92, 0, 0, TAU);
  const gr = ctx.createRadialGradient(0, -r * 0.3, r * 0.1, 0, 0, r);
  gr.addColorStop(0, '#0a5560'); gr.addColorStop(1, '#021318');
  ctx.fillStyle = gr; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = B.phase === 2 ? d.col2 : d.col; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU + t * 0.4;
    drawGlow(d.col2, Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.72, 7, 0.5 + 0.5 * Math.sin(t * 4 + i));
  }
  ctx.globalCompositeOperation = 'source-over';
  drawEye(B, 0, -r * 0.08, r * 0.52, r * 0.26, d.col2, true, charge);
}
function drawCore(B, t, charge) {
  const r = B.r, hue = (t * 60) % 360;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = t * 0.4 + i * TAU / 12;
    ctx.strokeStyle = rgba(rainbow(hue + i * 30), 0.16 + charge * 0.2);
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); ctx.lineTo(Math.cos(a) * r * 2.1, Math.sin(a) * r * 2.1); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 16;
  for (let k = 0; k < 3; k++) {
    const rot = t * (k % 2 ? -0.9 : 0.6) * (B.phase === 2 ? 1.6 : 1) + k;
    const col = rainbow(hue + k * 120);
    ctx.shadowColor = col; ctx.strokeStyle = col; ctx.lineWidth = 3;
    poly(ctx, 3, r * (1.3 - k * 0.13), rot); ctx.stroke();
  }
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.85);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, rainbow(hue)); gr.addColorStop(1, '#1a0030');
  ctx.fillStyle = gr;
  ctx.shadowColor = rainbow(hue);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  drawEye(B, 0, 0, r * 0.52, r * 0.24, rainbow(hue + 180), false, charge);
}
function drawBoss() {
  const B = G.boss;
  if (!B || B.dead) return;
  const t = B.t;
  const charge = (B.fireT < 0.5 && B.enter <= 0 && B.dying <= 0) ? 1 - Math.max(0, B.fireT) / 0.5 : 0;
  ctx.save();
  ctx.translate(B.x, B.y);
  if (B.dying > 0) ctx.translate(rand(-5, 5), rand(-5, 5));
  ctx.globalAlpha = B.alpha;
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(B.def.col === '#ffffff' ? rainbow(t * 60) : B.def.col, 0, 0, B.r * 2.5, 0.3 + 0.12 * Math.sin(t * 3) + charge * 0.35);
  ctx.globalCompositeOperation = 'source-over';
  if (B.def.style === 'warden') drawWarden(B, t, charge);
  else if (B.def.style === 'leviathan') drawLeviathan(B, t, charge);
  else drawCore(B, t, charge);
  if (B.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = B.alpha * B.flash * 0.7;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, B.r, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}
function drawBossBar() {
  const B = G.boss;
  if (!B || B.dead) return;
  const x = 300, y = WALL_T + 12, w = 400, h = 8;
  const a = B.enter > 0 ? 1 - B.enter / 1.8 : 1;
  ctx.globalAlpha = a;
  setFont(12, 800); spacing(3);
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillStyle = B.def.col === '#ffffff' ? rainbow(G.time * 80) : B.def.col;
  ctx.fillText(B.def.name, x - 12, y + h / 2 + 1);
  spacing(0);
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, x, y, w, h, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; rr(ctx, x, y, w * (B.hpLag / B.maxHp), h, 4); ctx.fill();
  const gr = ctx.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, B.def.col2); gr.addColorStop(1, B.def.col === '#ffffff' ? '#ff4df0' : B.def.col);
  ctx.fillStyle = gr; rr(ctx, x, y, Math.max(0, w * (B.hp / B.maxHp)), h, 4); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + w / 2 - 1, y - 2, 2, h + 4);
  setFont(11, 700, MONO); ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(B.phase === 2 ? 'PHASE II' : 'PHASE I', x + w + 12, y + h / 2 + 1);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------
// Rendering — HUD & overlays
// ---------------------------------------------------------------------
function drawHUD() {
  const acc1 = G.sector.accent, acc2 = G.sector.accent2;
  const bg = ctx.createLinearGradient(0, 0, 0, HUD_H);
  bg.addColorStop(0, 'rgba(8,2,22,0.97)'); bg.addColorStop(1, 'rgba(14,4,32,0.92)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, HUD_H);
  const lg = ctx.createLinearGradient(0, 0, W, 0);
  lg.addColorStop(0, rgba(acc1, 0.1)); lg.addColorStop(0.5, acc1); lg.addColorStop(1, rgba(acc2, 0.1));
  ctx.fillStyle = lg; ctx.fillRect(0, HUD_H - 2, W, 2);
  ctx.textBaseline = 'middle';

  // score
  ctx.textAlign = 'left';
  setFont(10, 800); spacing(3); ctx.fillStyle = rgba(acc2, 0.85);
  ctx.fillText('SCORE', 24, 15);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('HI ' + Math.max(hiScore(), Math.floor(G.score)).toLocaleString(), 96, 15);
  spacing(1);
  setFont(26, 800, MONO);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = acc1; ctx.shadowBlur = 10;
  ctx.fillText(String(Math.floor(G.shownScore)).padStart(7, '0'), 22, 38);
  ctx.shadowBlur = 0;
  spacing(0);

  // center: stage + overdrive meter
  ctx.textAlign = 'center';
  setFont(11, 800); spacing(3);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(stageLabel() + '  ·  ' + G.level.name, W / 2, 14);
  spacing(0);
  const bx = W / 2 - 150, by = 25, bw = 300, bh = 12;
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, bx, by, bw, bh, 6); ctx.fill();
  const active = G.odT > 0, ready = G.odReady;
  const frac = active ? G.odT / G.odMax : G.od / 100;
  if (frac > 0) {
    const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    if (active || ready) for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, rainbow(G.time * 200 + i * 50));
    else { gr.addColorStop(0, acc1); gr.addColorStop(1, acc2); }
    ctx.save();
    if (ready) { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 12 + 6 * Math.sin(G.time * 8); }
    ctx.fillStyle = gr; rr(ctx, bx, by, bw * frac, bh, 6); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(8,2,22,0.8)';
  for (let i = 1; i < 20; i++) ctx.fillRect(bx + i * bw / 20 - 0.5, by, 1, bh);
  setFont(9, 800); spacing(2.5);
  if (active) { ctx.fillStyle = '#ffffff'; ctx.fillText('OVERDRIVE ACTIVE · SCORE ×2', W / 2, 48); }
  else if (ready) { ctx.fillStyle = rainbow(G.time * 300); ctx.fillText(Input.touch ? 'OVERDRIVE READY · TAP ⚡' : 'OVERDRIVE READY · PRESS E / RIGHT-CLICK', W / 2, 48); }
  else { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillText('OVERDRIVE', W / 2, 48); }
  spacing(0);

  // combo
  if (G.combo >= 2) {
    const m = comboMult(), pop = Math.max(0, 1 - G.comboT * 6);
    ctx.textAlign = 'center';
    setFont(22 + pop * 6, 900, MONO);
    ctx.fillStyle = m >= 4 ? '#ffe14d' : m >= 2 ? acc2 : '#ffffff';
    ctx.fillText(String(G.combo), 724, 26);
    setFont(9, 800); spacing(2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('COMBO ×' + m, 724, 46);
    spacing(0);
  }

  // lives
  ctx.textAlign = 'left';
  setFont(10, 800); spacing(3); ctx.fillStyle = rgba(acc2, 0.85);
  ctx.fillText('LIVES', 790, 15);
  spacing(0);
  const shown = Math.min(G.lives, 5);
  for (let i = 0; i < shown; i++) {
    const lx = 790 + i * 22, ly = 33;
    ctx.fillStyle = acc2; rr(ctx, lx, ly, 18, 6, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(lx + 4, ly + 1, 10, 1.5);
  }
  if (G.lives > 5) { setFont(13, 800, MONO); ctx.fillStyle = '#fff'; ctx.fillText('+' + (G.lives - 5), 790 + 5 * 22, 37); }
  if (G.shield > 0) {
    setFont(9, 800); spacing(2); ctx.fillStyle = '#ffe14d';
    ctx.fillText('BARRIER ×' + G.shield, 790, 49);
    spacing(0);
  }
}

function drawEffectChips() {
  const items = [];
  for (const k of ['wide', 'shrink', 'laser', 'catch', 'slow', 'fast', 'fire']) if (G.fx[k] > 0) items.push(k);
  let x = WALL_L + 8;
  const y = H - 14;
  ctx.textBaseline = 'middle';
  for (const k of items) {
    const d = PU[k], frac = G.fx[k] / d.dur;
    const w = 92;
    const blink = G.fx[k] < 2.5 && Math.floor(G.fx[k] * 6) % 2 === 0;
    ctx.globalAlpha = blink ? 0.4 : 1;
    ctx.fillStyle = 'rgba(10,2,24,0.85)'; rr(ctx, x, y - 8, w, 16, 8); ctx.fill();
    ctx.strokeStyle = rgba(d.color, 0.8); ctx.lineWidth = 1; rr(ctx, x + 0.5, y - 7.5, w - 1, 15, 7.5); ctx.stroke();
    ctx.fillStyle = rgba(d.color, 0.35); rr(ctx, x + 1, y - 7, (w - 2) * frac, 14, 7); ctx.fill();
    setFont(9, 800); spacing(1.5); ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    ctx.fillText(d.name, x + w / 2, y + 0.5);
    spacing(0);
    ctx.globalAlpha = 1;
    x += w + 6;
  }
}

function drawLaunchHint() {
  if (G.demo || G.state !== 'playing' || G.dying > 0 || !G.paddle || G.paddle.dead) return;
  const stuck = G.balls.find(b => b.stuck);
  if (!stuck) return;
  const a = 0.55 + 0.45 * Math.sin(G.bgTime * 5);
  ctx.globalAlpha = a;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  setFont(12, 800); spacing(4);
  ctx.fillStyle = '#ffffff';
  const msg = stuck.caught ? (Input.touch ? 'TAP TO RELEASE' : 'CLICK / SPACE TO RELEASE') : (Input.touch ? 'TAP TO LAUNCH' : 'CLICK  ·  SPACE  TO LAUNCH');
  ctx.fillText(msg, W / 2, PADDLE_Y - 64);
  spacing(0);
  ctx.globalAlpha = 1;
}

function drawBanner() {
  const b = G.banner;
  if (!b) return;
  const t = b.t, d = b.dur;
  const a = t < 0.35 ? t / 0.35 : t > d - 0.5 ? Math.max(0, (d - t) / 0.5) : 1;
  const slide = (1 - easeOutCubic(Math.min(1, t / 0.6))) * 120;
  const y = b.boss ? 470 : 480;
  const acc1 = b.boss ? '#ff3b3b' : G.sector.accent, acc2 = b.boss ? '#ffe14d' : G.sector.accent2;
  ctx.globalAlpha = a;
  const gr = ctx.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, 'rgba(5,0,15,0)'); gr.addColorStop(0.2, 'rgba(5,0,15,0.75)'); gr.addColorStop(0.8, 'rgba(5,0,15,0.75)'); gr.addColorStop(1, 'rgba(5,0,15,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, y - 52, W, 104);
  const lgr = ctx.createLinearGradient(0, 0, W, 0);
  lgr.addColorStop(0, rgba(acc1, 0)); lgr.addColorStop(0.5, acc1); lgr.addColorStop(1, rgba(acc1, 0));
  ctx.fillStyle = lgr; ctx.fillRect(0, y - 52, W, 1.5); ctx.fillRect(0, y + 51, W, 1.5);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  setFont(13, 800); spacing(5);
  ctx.fillStyle = b.boss && Math.floor(t * 4) % 2 ? '#ffffff' : acc2;
  ctx.fillText(b.top, W / 2 + slide, y - 30);
  spacing(8);
  setFont(46, 900);
  ctx.shadowColor = acc1; ctx.shadowBlur = 24;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(b.title, W / 2 - slide, y + 6);
  ctx.shadowBlur = 0;
  if (b.sub) { spacing(4); setFont(11, 700); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(b.sub, W / 2 + slide * 0.5, y + 38); }
  spacing(0);
  ctx.globalAlpha = 1;
}

function drawCallouts() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  G.callouts.forEach((c, i) => {
    const p = c.t / c.dur;
    const sc = p < 0.12 ? lerp(1.7, 1, easeOutCubic(p / 0.12)) : 1 + (p - 0.12) * 0.08;
    const a = p > 0.7 ? 1 - (p - 0.7) / 0.3 : Math.min(1, p / 0.06);
    ctx.save();
    ctx.translate(W / 2, 400 - i * 50 - p * 16);
    ctx.scale(sc, sc);
    ctx.globalAlpha = a;
    setFont(c.size, 900); spacing(6);
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(5,0,15,0.7)';
    ctx.strokeText(c.text, 0, 0);
    ctx.shadowColor = c.color; ctx.shadowBlur = 26;
    ctx.fillStyle = c.color === '#ffffff' ? rainbow(G.bgTime * 300) : c.color;
    ctx.fillText(c.text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(c.text, 0, 0);
    spacing(0);
    ctx.restore();
  });
}

function drawTally() {
  const T = G.tally;
  if (!T) return;
  const fade = Math.min(1, (T.done ? 1 : 0.5) + T.t);
  ctx.fillStyle = 'rgba(4,0,12,' + (0.72 * Math.min(1, fade)) + ')';
  ctx.fillRect(0, HUD_H, W, H - HUD_H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  setFont(54, 900); spacing(10);
  const gr = ctx.createLinearGradient(W / 2 - 300, 0, W / 2 + 300, 0);
  for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, rainbow(G.bgTime * 60 + i * 50));
  ctx.fillStyle = gr;
  ctx.shadowColor = G.sector.accent; ctx.shadowBlur = 30;
  ctx.fillText(T.boss ? 'GUARDIAN DOWN' : 'STAGE CLEAR', W / 2, 190);
  ctx.shadowBlur = 0;
  setFont(13, 800); spacing(5); ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(stageLabel() + '  ·  ' + G.level.name, W / 2, 238);
  spacing(2);
  for (let i = 0; i < T.lines.length; i++) {
    if (i > T.idx) break;
    const L = T.lines[i], y = 300 + i * 46;
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(250, y - 18, 460, 36);
    setFont(14, 800); ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(L.label, 270, y);
    setFont(16, 800, MONO); ctx.textAlign = 'center'; ctx.fillStyle = G.sector.accent2;
    ctx.fillText(L.stat, 520, y);
    ctx.textAlign = 'right'; ctx.fillStyle = L.pts ? '#ffffff' : 'rgba(255,255,255,0.3)';
    ctx.fillText(L.pts ? '+' + Math.floor(T.shown[i]).toLocaleString() : '—', 690, y);
  }
  if (T.done) {
    setFont(22, 900, MONO); ctx.textAlign = 'center'; ctx.fillStyle = '#ffe14d';
    ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 16;
    ctx.fillText('BONUS +' + T.total.toLocaleString(), W / 2, 500);
    ctx.shadowBlur = 0;
    const a = 0.55 + 0.45 * Math.sin(G.bgTime * 5);
    ctx.globalAlpha = a;
    setFont(12, 800); spacing(5); ctx.fillStyle = '#ffffff';
    const last = G.mode === 'campaign' && G.levelIndex + 1 >= LEVELS.length;
    ctx.fillText((Input.touch ? 'TAP' : 'CLICK / SPACE') + (last ? ' TO FINISH' : ' TO CONTINUE'), W / 2, 560);
    ctx.globalAlpha = 1;
  }
  spacing(0);
}

function render(dt) {
  drawBackground(dt);
  const shakeOn = Settings.shake && G.shake > 0;
  const sx = shakeOn ? rand(-1, 1) * G.shake : 0, sy = shakeOn ? rand(-1, 1) * G.shake : 0;
  ctx.save();
  ctx.translate(sx, sy);
  drawWalls();
  if (G.state !== 'over' || G.endKind !== 'victory') {
    drawBricks();
    drawBoss();
    drawPowerups();
    drawShield();
    drawLasersAndBullets();
    drawPaddle();
    drawBalls();
  }
  drawParticles();
  drawFloaters();
  ctx.restore();
  if (!G.demo) {
    drawBossBar();
    drawHUD();
    drawEffectChips();
    if (!UI.current) {
      drawLaunchHint();
      drawBanner();
      drawCallouts();
    }
    if (G.state === 'tally') drawTally();
  }
  if (G.flash > 0) {
    ctx.globalAlpha = G.flash * (Settings.flashes ? 0.8 : 0.2);
    ctx.fillStyle = G.flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (G.odT > 0 && Settings.flashes) {
    // rainbow edge glow during Overdrive
    ctx.globalCompositeOperation = 'lighter';
    const c = rainbow(G.bgTime * 200);
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(1, rgba(c, 0.12));
    ctx.fillStyle = gr; ctx.fillRect(0, HUD_H, W, H - HUD_H);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  try {
    update(dt);
    render(dt);
  } catch (err) {
    console.error(err);
  }
}
