'use strict';
/* ============ SHATTERSONG · sprites, icons, particles, backdrop ============ */

const SPAD = 14, SS = 2; // sprite padding (for baked glow) and supersampling

const Sprites = {
  cache: new Map(),

  glow(color) {
    const key = 'g' + color; let s = this.cache.get(key);
    if (s) return s;
    s = document.createElement('canvas'); s.width = s.height = 64;
    const c = s.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, tint(color, 0.75));
    g.addColorStop(0.18, rgba(color, 0.7));
    g.addColorStop(0.5, rgba(color, 0.2));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    this.cache.set(key, s); return s;
  },

  brick(type, color, dmg) {
    const key = type + color + dmg; let s = this.cache.get(key);
    if (s) return s;
    s = document.createElement('canvas');
    s.width = (BW + SPAD * 2) * SS; s.height = (BH + SPAD * 2) * SS;
    const c = s.getContext('2d');
    c.scale(SS, SS); c.translate(SPAD, SPAD);
    paintBrick(c, type, color, dmg);
    this.cache.set(key, s); return s;
  }
};

function paintBrick(c, type, color, dmg) {
  const w = BW, h = BH, b = 5;
  // halo
  if (type !== 'steel') {
    c.save();
    c.shadowColor = rgba(color, 0.8); c.shadowBlur = 11 * SS;
    c.fillStyle = rgba(color, 0.6); rr(c, 2, 2, w - 4, h - 4, 5); c.fill();
    c.restore();
  }
  // body
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, tint(color, 0.3)); g.addColorStop(0.5, color); g.addColorStop(1, tint(color, -0.45));
  c.fillStyle = g; rr(c, 0, 0, w, h, 5); c.fill();

  c.save();
  rr(c, 0, 0, w, h, 5); c.clip();
  // cut-gem bevels
  poly(c, [[0, 0], [w, 0], [w - b, b], [b, b]], 'rgba(255,255,255,.4)');
  poly(c, [[0, 0], [b, b], [b, h - b], [0, h]], 'rgba(255,255,255,.16)');
  poly(c, [[w, 0], [w, h], [w - b, h - b], [w - b, b]], 'rgba(0,0,0,.2)');
  poly(c, [[0, h], [b, h - b], [w - b, h - b], [w, h]], 'rgba(0,0,0,.38)');

  if (type === 'steel') {
    c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 4;
    for (let x = -h; x < w; x += 13) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + h, 0); c.stroke(); }
    c.fillStyle = 'rgba(220,230,255,.75)';
    for (const p of [[8, 7], [w - 8, 7], [8, h - 7], [w - 8, h - 7]]) { c.beginPath(); c.arc(p[0], p[1], 1.7, 0, TAU); c.fill(); }
  } else {
    // shine streaks
    poly(c, [[w * 0.16, b], [w * 0.30, b], [w * 0.22, h - b], [w * 0.08, h - b]], 'rgba(255,255,255,.22)');
    poly(c, [[w * 0.36, b], [w * 0.40, b], [w * 0.32, h - b], [w * 0.28, h - b]], 'rgba(255,255,255,.12)');
  }

  if (type === 't') {
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5; rr(c, 7.5, 6.5, w - 15, h - 13, 2); c.stroke();
  } else if (type === 'h') {
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.5; rr(c, 7.5, 6.5, w - 15, h - 13, 2); c.stroke();
    poly(c, [[w / 2, 6], [w / 2 + 7, h / 2], [w / 2, h - 6], [w / 2 - 7, h / 2]], 'rgba(255,255,255,.75)');
    poly(c, [[w / 2, 9], [w / 2 + 4, h / 2], [w / 2, h - 9], [w / 2 - 4, h / 2]], 'rgba(120,70,0,.6)');
  } else if (type === 'x') {
    c.fillStyle = 'rgba(40,0,0,.45)'; rr(c, 7, 6, w - 14, h - 12, 3); c.fill();
    const rg = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 9);
    rg.addColorStop(0, '#fff'); rg.addColorStop(0.4, '#ffe27a'); rg.addColorStop(1, 'rgba(255,120,0,0)');
    c.fillStyle = rg; c.beginPath(); c.arc(w / 2, h / 2, 9, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,230,140,.9)'; c.lineWidth = 1.5;
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(w / 2 + sx * 13, h / 2); c.lineTo(w / 2 + sx * 21, h / 2); c.stroke(); }
  } else if (type === 's') {
    c.fillStyle = 'rgba(0,30,50,.5)'; rr(c, 7, 6, w - 14, h - 12, 3); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h / 2, 4.2, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(140,240,255,.9)'; c.lineWidth = 1.3; c.beginPath(); c.arc(w / 2, h / 2, 7, 0, TAU); c.stroke();
  } else if (type === 'phase') {
    c.fillStyle = 'rgba(6,8,26,.5)'; rr(c, 7, 6, w - 14, h - 12, 3); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i <= 20; i++) { const x = w / 2 - 14 + i * 1.4, y = h / 2 + Math.sin(i * 0.63) * 3; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
  }
  // cracks
  if (dmg >= 1) {
    const crack = pts => {
      c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(pts[0] + 1, pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i] + 1, pts[i + 1]); c.stroke();
    };
    crack([w * 0.28, 0, w * 0.36, h * 0.4, w * 0.3, h * 0.62, w * 0.42, h]);
    crack([w * 0.36, h * 0.4, w * 0.52, h * 0.5]);
    if (dmg >= 2) { crack([w * 0.72, 0, w * 0.64, h * 0.35, w * 0.74, h * 0.7, w * 0.66, h]); crack([w * 0.64, h * 0.35, w * 0.5, h * 0.22]); }
  }
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,.36)'; c.lineWidth = 1; rr(c, 0.5, 0.5, w - 1, h - 1, 5); c.stroke();
}

/* ---------- vector icons (unit space, scaled by s) ---------- */
function drawIcon(c, name, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 0.2; c.lineCap = 'round'; c.lineJoin = 'round';
  const L = (...p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); };
  const dot = (px, py, r) => { c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill(); };
  switch (name) {
    case 'multi': dot(0, -0.45, 0.32); dot(-0.5, 0.4, 0.32); dot(0.5, 0.4, 0.32); break;
    case 'wide': L(-0.9, 0, 0.9, 0); c.stroke(); L(-0.5, -0.4, -0.9, 0, -0.5, 0.4); c.stroke(); L(0.5, -0.4, 0.9, 0, 0.5, 0.4); c.stroke(); break;
    case 'shrink': L(-0.95, 0, -0.25, 0); c.stroke(); L(-0.6, -0.38, -0.22, 0, -0.6, 0.38); c.stroke(); L(0.95, 0, 0.25, 0); c.stroke(); L(0.6, -0.38, 0.22, 0, 0.6, 0.38); c.stroke(); break;
    case 'laser': L(-0.45, 0.8, -0.45, -0.3); c.stroke(); L(0.45, 0.8, 0.45, -0.3); c.stroke(); dot(-0.45, -0.7, 0.17); dot(0.45, -0.7, 0.17); break;
    case 'slow': c.beginPath(); c.arc(0, 0, 0.78, 0, TAU); c.stroke(); L(0, -0.45, 0, 0, 0.35, 0.2); c.stroke(); break;
    case 'fast': L(-0.7, -0.55, -0.1, 0, -0.7, 0.55); c.stroke(); L(0.05, -0.55, 0.65, 0, 0.05, 0.55); c.stroke(); break;
    case 'fire':
      c.beginPath(); c.moveTo(0.05, -0.95);
      c.bezierCurveTo(0.2, -0.4, 0.8, -0.2, 0.7, 0.35); c.bezierCurveTo(0.65, 0.75, 0.3, 0.95, 0, 0.95);
      c.bezierCurveTo(-0.4, 0.95, -0.72, 0.7, -0.7, 0.3); c.bezierCurveTo(-0.7, -0.05, -0.45, -0.2, -0.4, -0.45);
      c.bezierCurveTo(-0.2, -0.3, -0.1, -0.2, -0.05, 0); c.bezierCurveTo(0.1, -0.3, 0.15, -0.6, 0.05, -0.95); c.fill(); break;
    case 'shield':
      c.beginPath(); c.moveTo(0, -0.9); c.lineTo(0.75, -0.6); c.lineTo(0.75, 0); c.quadraticCurveTo(0.7, 0.6, 0, 0.95);
      c.quadraticCurveTo(-0.7, 0.6, -0.75, 0); c.lineTo(-0.75, -0.6); c.closePath(); c.stroke(); c.globalAlpha *= 0.35; c.fill(); break;
    case 'heart':
      c.beginPath(); c.moveTo(0, 0.85); c.bezierCurveTo(-1.3, -0.1, -0.75, -1.0, 0, -0.35); c.bezierCurveTo(0.75, -1.0, 1.3, -0.1, 0, 0.85); c.fill(); break;
    case 'star':
      c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 - Math.PI / 2, r = i % 2 ? 0.32 : 0.95; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fill(); break;
    case 'hourglass': L(-0.55, -0.8, 0.55, -0.8, -0.55, 0.8, 0.55, 0.8); c.closePath(); c.stroke(); break;
    case 'waves': dot(-0.7, 0, 0.18); for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-0.7, 0, 0.5 + i * 0.42, -0.7, 0.7); c.stroke(); } break;
    case 'echo':
      dot(-0.45, 0.3, 0.36);
      c.globalAlpha *= 0.7; c.beginPath(); c.arc(0.05, 0, 0.36, 0, TAU); c.stroke();
      c.globalAlpha *= 0.6; c.beginPath(); c.arc(0.52, -0.3, 0.36, 0, TAU); c.stroke(); break;
    case 'bolt': L(0.2, -0.95, -0.55, 0.12, -0.05, 0.12, -0.25, 0.95, 0.55, -0.2, 0.05, -0.2); c.closePath(); c.fill(); break;
    case 'forte':
      c.scale(1 / s, 1 / s);
      c.font = 'italic 700 ' + (s * 2.1) + 'px Georgia, "Times New Roman", serif';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('f', 0, s * 0.05); break;
    case 'burst':
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; L(Math.cos(a) * 0.5, Math.sin(a) * 0.5, Math.cos(a) * 0.95, Math.sin(a) * 0.95); c.stroke(); }
      dot(0, 0, 0.26); break;
    case 'net': L(-0.9, 0.65, 0.9, 0.65); c.stroke(); dot(0, -0.2, 0.3); L(-0.35, 0.3, 0, 0.5, 0.35, 0.3); c.stroke(); break;
    case 'metronome': L(-0.55, 0.85, -0.25, -0.85, 0.25, -0.85, 0.55, 0.85); c.closePath(); c.stroke(); L(0, 0.55, 0.45, -0.6); c.stroke(); dot(0.3, -0.2, 0.15); break;
    case 'magnet':
      c.lineWidth = 0.36; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(-0.55, -0.8); c.lineTo(-0.55, 0.15); c.arc(0, 0.15, 0.55, Math.PI, 0, true); c.lineTo(0.55, -0.8); c.stroke(); break;
    case 'crown': L(-0.85, 0.6, -0.85, -0.5, -0.4, 0.0, 0, -0.75, 0.4, 0.0, 0.85, -0.5, 0.85, 0.6); c.closePath(); c.fill(); break;
    case 'bars': for (let i = 0; i < 4; i++) c.fillRect(-0.85 + i * 0.45, 0.8 - (0.4 + i * 0.4), 0.3, 0.4 + i * 0.4); break;
  }
  c.restore();
}

/* ---------- particles, popups, shake ---------- */
const FX = {
  parts: [], texts: [], rings: [], shakeMag: 0, sx: 0, sy: 0, flashA: 0, flashCol: '#ffffff',

  clear() { this.parts.length = 0; this.texts.length = 0; this.rings.length = 0; },

  spark(x, y, color, n = 6, spd = 160, life = 0.5, size = 3) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 900) return;
      const a = rand(TAU), v = spd * rand(0.25, 1), l = life * rand(0.5, 1);
      this.parts.push({ k: 0, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, size: size * rand(0.6, 1.3), color, g: 160, drag: 1.6 });
    }
  },
  ember(x, y, color, n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 900) return;
      const l = rand(0.3, 0.7);
      this.parts.push({ k: 0, x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-25, 25), vy: rand(-50, 10), life: l, max: l, size: rand(1.6, 3.2), color, g: -60, drag: 1 });
    }
  },
  shards(x, y, w, h, color, n = 7) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 900) return;
      const l = rand(0.5, 1.0), s = rand(4, 9);
      this.parts.push({
        k: 1, x: x + rand(-w / 2, w / 2), y: y + rand(-h / 2, h / 2), vx: rand(-170, 170), vy: rand(-220, 60),
        life: l, max: l, size: s, color: Math.random() < 0.3 ? tint(color, 0.5) : color, g: 620, drag: 0.4,
        rot: rand(TAU), vr: rand(-11, 11), p1: rand(0.4, 1), p2: rand(0.4, 1)
      });
    }
  },
  ring(x, y, color, r1, life = 0.4, width = 3, r0 = 4) { this.rings.push({ x, y, color, r0, r1, life, max: life, width }); },
  text(x, y, str, color = '#ffffff', size = 16, life = 0.8) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x, y, str, color, size, life, max: life });
  },
  shake(m) { if (Save.data.shake) this.shakeMag = Math.max(this.shakeMag, m); },
  flash(col, a) { this.flashCol = col; this.flashA = Math.max(this.flashA, a); },

  update(dt) {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 1) p.rot += p.vr * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.life -= dt; if (r.life <= 0) this.rings.splice(i, 1); }
    for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.life -= dt; t.y -= 34 * dt; if (t.life <= 0) this.texts.splice(i, 1); }
    this.shakeMag *= Math.exp(-9 * dt);
    if (this.shakeMag > 0.2) { this.sx = rand(-1, 1) * this.shakeMag; this.sy = rand(-1, 1) * this.shakeMag; } else { this.sx = this.sy = 0; this.shakeMag = 0; }
    this.flashA = Math.max(0, this.flashA - dt * 1.8);
  },

  draw(c) {
    const P = this.parts;
    // shards (solid)
    for (let i = 0; i < P.length; i++) {
      const p = P[i]; if (p.k !== 1) continue;
      const a = Math.min(1, p.life / p.max * 1.6), cs = Math.cos(p.rot), sn = Math.sin(p.rot), s = p.size;
      c.globalAlpha = a; c.fillStyle = p.color;
      c.beginPath();
      c.moveTo(p.x + cs * s, p.y + sn * s);
      c.lineTo(p.x - sn * s * p.p1, p.y + cs * s * p.p1);
      c.lineTo(p.x - cs * s * p.p2, p.y - sn * s * p.p2);
      c.closePath(); c.fill();
    }
    // sparks + rings (additive)
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < P.length; i++) {
      const p = P[i]; if (p.k !== 0) continue;
      const k = p.life / p.max, s = p.size * (0.5 + k) * 2.4;
      c.globalAlpha = Math.min(1, k * 1.5);
      c.drawImage(Sprites.glow(p.color), p.x - s, p.y - s, s * 2, s * 2);
    }
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i], k = 1 - r.life / r.max, rad = lerp(r.r0, r.r1, Ease.outCubic(k));
      c.globalAlpha = (1 - k) * 0.9; c.strokeStyle = r.color; c.lineWidth = r.width * (1 - k * 0.6);
      c.beginPath(); c.arc(r.x, r.y, rad, 0, TAU); c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
    // popups
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i], k = 1 - t.life / t.max;
      const sc = k < 0.18 ? Ease.outBack(k / 0.18) : 1;
      c.globalAlpha = Math.min(1, t.life / t.max * 2.2);
      c.font = '700 ' + (t.size * sc).toFixed(1) + 'px ' + FONT;
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillText(t.str, t.x + 1, t.y + 2);
      c.fillStyle = t.color; c.fillText(t.str, t.x, t.y);
    }
    c.globalAlpha = 1; c.textBaseline = 'alphabetic';
  }
};

/* ---------- backdrop: drifting aurora rendered tiny and scaled up ---------- */
const BG = {
  cv: null, c: null, t: 0, cols: null, target: null, motes: [], energy: 0,

  init() {
    this.cv = document.createElement('canvas'); this.cv.width = 256; this.cv.height = 144;
    this.c = this.cv.getContext('2d');
    for (let i = 0; i < 70; i++) this.motes.push({ x: Math.random(), y: Math.random(), z: rand(0.3, 1), tw: rand(TAU) });
  },
  setTheme(act) {
    this.target = { bg0: hexRgb(act.bg[0]), bg1: hexRgb(act.bg[1]), blobs: act.blobs.map(hexRgb) };
    if (!this.cols) this.cols = { bg0: this.target.bg0.slice(), bg1: this.target.bg1.slice(), blobs: this.target.blobs.map(b => b.slice()) };
  },
  update(dt) {
    this.t += dt;
    if (!this.cols) return;
    const k = damp(1.4, dt), mixc = (a, b) => { for (let i = 0; i < 3; i++) a[i] += (b[i] - a[i]) * k; };
    mixc(this.cols.bg0, this.target.bg0); mixc(this.cols.bg1, this.target.bg1);
    for (let i = 0; i < 3; i++) mixc(this.cols.blobs[i], this.target.blobs[i]);
    for (const m of this.motes) { m.y -= dt * 0.012 * m.z; m.x += dt * 0.004 * Math.sin(this.t * 0.3 + m.tw); if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); } }
  },
  draw(c, cw, ch) {
    if (!this.cols) return;
    const b = this.c, w = 256, h = 144, t = this.t, C = this.cols, e = this.energy;
    const css = v => 'rgb(' + (v[0] | 0) + ',' + (v[1] | 0) + ',' + (v[2] | 0) + ')';
    const g = b.createLinearGradient(0, 0, 0, h); g.addColorStop(0, css(C.bg0)); g.addColorStop(1, css(C.bg1));
    b.globalCompositeOperation = 'source-over'; b.fillStyle = g; b.fillRect(0, 0, w, h);
    b.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const q = i * 2 + j, col = C.blobs[i];
        const x = w * (0.5 + 0.46 * Math.sin(t * (0.07 + q * 0.013) + q * 2.1));
        const y = h * (0.5 + 0.44 * Math.cos(t * (0.06 + q * 0.011) + q * 1.3));
        const r = h * (0.5 + 0.14 * Math.sin(t * 0.2 + q));
        const a = 0.2 + e * 0.12;
        const rg = b.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ',' + a + ')');
        rg.addColorStop(1, 'rgba(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ',0)');
        b.fillStyle = rg; b.fillRect(0, 0, w, h);
      }
    }
    b.globalCompositeOperation = 'source-over';
    const vg = b.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.72)');
    b.fillStyle = vg; b.fillRect(0, 0, w, h);

    c.imageSmoothingEnabled = true;
    c.drawImage(this.cv, 0, 0, cw, ch);
    // motes
    c.globalCompositeOperation = 'lighter'; c.fillStyle = '#cfe6ff';
    const u = Math.max(1, cw / 1100);
    for (const m of this.motes) {
      const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + m.tw), s = (1 + m.z * 1.6) * u;
      c.globalAlpha = (0.1 + 0.3 * tw) * m.z;
      c.fillRect(m.x * cw, m.y * ch, s, s);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
};
