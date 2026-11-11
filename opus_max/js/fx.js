/* SHATTERWAVE — fx: particles, popups, shake/flash, cached sprites */
'use strict';
SW.gfx = {
  res: 2,
  cache: new Map(),
  setRes(r) {
    r = Math.max(1, Math.min(3, Math.ceil(r * 2) / 2));
    if (r !== this.res) { this.res = r; this.cache.clear(); }
  },
  canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; },
  glow(color) {
    const key = 'glow' + color;
    let c = this.cache.get(key);
    if (c) return c;
    c = this.canvas(64, 64);
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, SW.C.rgba(SW.C.lighten(color, 0.6), 1));
    rg.addColorStop(0.22, SW.C.rgba(color, 0.75));
    rg.addColorStop(0.55, SW.C.rgba(color, 0.18));
    rg.addColorStop(1, SW.C.rgba(color, 0));
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    this.cache.set(key, c);
    return c;
  },
  rrect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  },
  // Pre-rendered glassy brick sprite. Returns {c, pad}
  brick(kind, color, w, h) {
    const key = `b|${kind}|${color}|${w}|${h}|${this.res}`;
    let s = this.cache.get(key);
    if (s) return s;
    const pad = 12, res = this.res, C = SW.C;
    const c = this.canvas((w + pad * 2) * res, (h + pad * 2) * res);
    const g = c.getContext('2d');
    g.scale(res, res);
    g.translate(pad, pad);
    const rr = (x, y, ww, hh, r) => this.rrect(g, x, y, ww, hh, r);
    // outer glow
    g.save();
    g.shadowColor = C.rgba(color, kind === 'steel' ? 0.35 : 0.9);
    g.shadowBlur = 12 * res;
    g.fillStyle = C.rgba(color, 0.55);
    rr(1, 1, w - 2, h - 2, 5); g.fill();
    g.restore();
    // body
    const top = kind === 'steel' ? '#d9dee8' : C.lighten(color, 0.45);
    const bot = C.darken(color, kind === 'steel' ? 0.45 : 0.4);
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, top); grd.addColorStop(0.45, color); grd.addColorStop(1, bot);
    g.fillStyle = grd;
    if (kind === 'ghost' || kind === 'crystal') g.globalAlpha = 0.72;
    rr(0, 0, w, h, 5); g.fill();
    g.globalAlpha = 1;
    // glass highlight
    g.fillStyle = 'rgba(255,255,255,0.5)';
    rr(4, 2.5, w - 8, 3.5, 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    rr(3, 2, w - 6, h * 0.45, 3); g.fill();
    // rim
    g.strokeStyle = C.rgba(C.lighten(color, 0.6), 0.7); g.lineWidth = 1;
    rr(0.5, 0.5, w - 1, h - 1, 5); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.moveTo(5, h - 0.5); g.lineTo(w - 5, h - 0.5); g.stroke();

    g.lineWidth = 1.5;
    if (kind === 'armor') {
      g.strokeStyle = 'rgba(255,255,255,0.45)';
      rr(4, 4, w - 8, h - 8, 3); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (const [x, y] of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]]) { g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill(); }
    } else if (kind === 'steel') {
      g.save(); rr(0, 0, w, h, 5); g.clip();
      g.strokeStyle = 'rgba(40,46,60,0.35)'; g.lineWidth = 3;
      for (let x = -h; x < w + h; x += 9) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.stroke(); }
      g.restore();
      g.fillStyle = 'rgba(30,34,46,0.7)';
      for (const [x, y] of [[6, h / 2], [w - 6, h / 2]]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
    } else if (kind === 'bomb') {
      g.save(); rr(0, 0, w, h, 5); g.clip();
      g.fillStyle = 'rgba(20,10,0,0.35)';
      for (let x = -h; x < w + h; x += 12) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 6, h); g.lineTo(x + 6 + h, 0); g.lineTo(x + h, 0); g.fill(); }
      g.restore();
      g.fillStyle = '#2a0a00'; g.beginPath(); g.arc(w / 2, h / 2, 7, 0, 7); g.fill();
      g.fillStyle = '#ffe9a0'; g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, r = i % 2 ? 2.2 : 5.5;
        g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
      }
      g.fill();
    } else if (kind === 'mystery') {
      g.fillStyle = 'rgba(60,30,0,0.85)';
      g.font = `900 ${h - 6}px ${getComputedStyle(document.body).fontFamily}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('?', w / 2, h / 2 + 1);
    } else if (kind === 'crystal') {
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1;
      g.beginPath();
      g.moveTo(w * 0.15, h); g.lineTo(w * 0.35, 0); g.moveTo(w * 0.35, 0); g.lineTo(w * 0.55, h);
      g.moveTo(w * 0.55, h); g.lineTo(w * 0.75, 0); g.moveTo(w * 0.75, 0); g.lineTo(w * 0.9, h);
      g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, h / 2, 2.4, 0, 7); g.fill();
    } else if (kind === 'ghost') {
      g.setLineDash([3, 3]); g.strokeStyle = 'rgba(255,255,255,0.8)';
      rr(2.5, 2.5, w - 5, h - 5, 4); g.stroke(); g.setLineDash([]);
    }
    s = { c, pad };
    this.cache.set(key, s);
    return s;
  },
};

SW.fx = {
  parts: [], texts: [], rings: [],
  MAX: 1100,
  trauma: 0, sx: 0, sy: 0, t: 0,
  flashA: 0, flashC: '#ffffff',
  reset() { this.parts.length = 0; this.texts.length = 0; this.rings.length = 0; this.trauma = 0; this.flashA = 0; },
  shake(a) { this.trauma = Math.min(1, this.trauma + a); },
  flash(color, a) { this.flashC = color; this.flashA = Math.max(this.flashA, SW.settings.flash ? a : a * 0.25); },
  add(p) { if (this.parts.length < this.MAX) this.parts.push(p); },

  // gravity shards from a broken brick
  shatter(x, y, w, h, color, n = 10, power = 1) {
    for (let i = 0; i < n; i++) {
      const px = x + Math.random() * w, py = y + Math.random() * h;
      const a = Math.atan2(py - (y + h / 2), px - (x + w / 2)) + U.rand(-0.5, 0.5);
      const sp = U.rand(60, 260) * power;
      this.add({ k: 0, x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - U.rand(40, 160), g: 900, drag: 0.6,
        life: U.rand(0.5, 1.1), max: 1.1, s: U.rand(3, 7), s2: U.rand(2, 4), rot: Math.random() * 6, vr: U.rand(-14, 14), c: Math.random() < 0.25 ? '#ffffff' : color });
    }
  },
  sparks(x, y, color, n = 8, speed = 300, dir = null, spread = Math.PI) {
    for (let i = 0; i < n; i++) {
      const a = dir == null ? Math.random() * U.TAU : dir + U.rand(-spread, spread);
      const sp = U.rand(0.3, 1) * speed;
      this.add({ k: 1, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 200, drag: 3, life: U.rand(0.2, 0.55), max: 0.55, s: U.rand(1.2, 2.4), c: color });
    }
  },
  glow(x, y, color, size = 30, life = 0.35, vx = 0, vy = 0) {
    this.add({ k: 2, x, y, vx, vy, g: 0, drag: 2, life, max: life, s: size, c: color });
  },
  embers(x, y, color, n = 6, speed = 80) {
    for (let i = 0; i < n; i++) this.add({ k: 3, x: x + U.rand(-6, 6), y: y + U.rand(-6, 6), vx: U.rand(-speed, speed), vy: U.rand(-speed * 1.5, -speed * 0.2), g: -30, drag: 1.5, life: U.rand(0.4, 0.9), max: 0.9, s: U.rand(1.5, 3.5), c: color });
  },
  ring(x, y, color, r0, r1, life = 0.4, width = 3) { this.rings.push({ x, y, c: color, r0, r1, life, max: life, w: width }); },
  text(x, y, str, color = '#fff', size = 18, o = {}) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x, y, str, c: color, size, life: o.life || 0.9, max: o.life || 0.9, vy: o.vy == null ? -60 : o.vy, big: !!o.big });
  },
  explosion(x, y, color, scale = 1) {
    this.glow(x, y, '#ffffff', 70 * scale, 0.25);
    this.glow(x, y, color, 140 * scale, 0.5);
    this.ring(x, y, color, 6, 90 * scale, 0.45, 5);
    this.ring(x, y, '#ffffff', 4, 60 * scale, 0.3, 2);
    this.sparks(x, y, '#fff6c0', 18 * scale, 520 * scale);
    this.sparks(x, y, color, 14 * scale, 380 * scale);
    this.embers(x, y, '#ffb347', 10 * scale, 120);
  },

  update(dt, rdt) {
    this.t += dt;
    const P = this.parts;
    let j = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 0) p.rot += p.vr * dt;
      P[j++] = p;
    }
    P.length = j;
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.life -= dt; if (r.life <= 0) this.rings.splice(i, 1); }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.life -= rdt; t.y += t.vy * rdt; t.vy *= Math.exp(-2.5 * rdt);
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    // camera shake uses real time so it settles even in slow motion
    this.trauma = Math.max(0, this.trauma - rdt * 1.5);
    const k = SW.settings.shake ? this.trauma * this.trauma * 16 : 0;
    const tt = performance.now() / 1000;
    this.sx = k * (Math.sin(tt * 71.3) * 0.6 + Math.sin(tt * 43.1 + 1.3) * 0.4);
    this.sy = k * (Math.sin(tt * 63.7 + 2.1) * 0.6 + Math.sin(tt * 37.9) * 0.4);
    this.flashA = Math.max(0, this.flashA - rdt * 3.2);
  },

  draw(g) {
    const P = this.parts;
    // solid shards
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.k !== 0) continue;
      const a = Math.min(1, p.life / (p.max * 0.5));
      g.globalAlpha = a;
      g.fillStyle = p.c;
      const c = Math.cos(p.rot), s = Math.sin(p.rot), hw = p.s / 2, hh = p.s2 / 2;
      g.beginPath();
      g.moveTo(p.x + c * hw - s * hh, p.y + s * hw + c * hh);
      g.lineTo(p.x - c * hw - s * hh, p.y - s * hw + c * hh);
      g.lineTo(p.x - c * hw + s * hh, p.y - s * hw - c * hh);
      g.lineTo(p.x + c * hw + s * hh, p.y + s * hw - c * hh);
      g.fill();
    }
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.k === 0) continue;
      const t = p.life / p.max;
      if (p.k === 1) {
        g.globalAlpha = Math.min(1, t * 1.6);
        g.strokeStyle = p.c; g.lineWidth = p.s;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); g.stroke();
      } else if (p.k === 2) {
        g.globalAlpha = t;
        const s = p.s * (0.6 + 0.4 * t);
        g.drawImage(SW.gfx.glow(p.c), p.x - s, p.y - s, s * 2, s * 2);
      } else {
        g.globalAlpha = t;
        g.fillStyle = p.c;
        g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
      }
    }
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      g.globalAlpha = (1 - t) * 0.9;
      g.strokeStyle = r.c; g.lineWidth = r.w * (1 - t) + 0.5;
      g.beginPath(); g.arc(r.x, r.y, U.lerp(r.r0, r.r1, U.easeOutCubic(t)), 0, U.TAU); g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  },
  drawTexts(g, font) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const t of this.texts) {
      const age = t.max - t.life;
      const sc = age < 0.15 ? U.easeOutBack(age / 0.15) : 1;
      const a = Math.min(1, t.life / 0.3);
      g.globalAlpha = a;
      g.font = `800 ${Math.round(t.size * sc)}px ${font}`;
      g.lineWidth = t.big ? 6 : 4; g.strokeStyle = 'rgba(5,2,20,0.85)';
      g.strokeText(t.str, t.x, t.y);
      g.fillStyle = t.c; g.fillText(t.str, t.x, t.y);
    }
    g.globalAlpha = 1;
  },
};
