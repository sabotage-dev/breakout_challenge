'use strict';
/* ==========================================================================
   HADAL — particles, floating text and lightning
   kinds: 0 glow spark (additive) · 1 shard · 2 bubble · 3 ring
          4 soft blob (smoke / ink) · 5 streak (additive)
   ========================================================================== */

const FX = {
  p: [],
  texts: [],
  bolts: [],
  MAX: 1500,

  clear() { this.p.length = 0; this.texts.length = 0; this.bolts.length = 0; },

  add(k, x, y, vx, vy, life, size, color) {
    if (this.p.length >= this.MAX) return null;
    const o = { k, x, y, vx, vy, life, max: life, size, s2: size, color, g: 0, drag: 0, rot: 0, vr: 0, a: 1, w: 1, lw: 2 };
    this.p.push(o);
    return o;
  },

  burst(x, y, color, n, speed, life, size) {
    speed = speed || 220; life = life || 0.5; size = size || 3;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = (0.25 + Math.random() * 0.75) * speed;
      const o = this.add(0, x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color);
      if (o) { o.drag = 2.6; o.g = 30; }
    }
  },

  /* directional spray of bright streaks */
  spray(x, y, color, n, speed, life, dir, spread) {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread, v = (0.35 + Math.random() * 0.65) * speed;
      const o = this.add(5, x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.6 + Math.random() * 0.6), 1.2 + Math.random() * 1.4, color);
      if (o) { o.drag = 3; }
    }
  },

  shards(x, y, w, h, color, n, kx, ky) {
    const cx = x + w / 2, cy = y + h / 2;
    for (let i = 0; i < n; i++) {
      const px = x + Math.random() * w, py = y + Math.random() * h;
      const a = Math.atan2(py - cy, px - cx) + (Math.random() - 0.5) * 0.9;
      const v = 50 + Math.random() * 170;
      const o = this.add(1, px, py, Math.cos(a) * v + (kx || 0) * 110, Math.sin(a) * v + (ky || 0) * 110, 0.5 + Math.random() * 0.6, 4 + Math.random() * 6, color);
      if (o) { o.g = 240; o.drag = 2.3; o.rot = Math.random() * TAU; o.vr = (Math.random() - 0.5) * 16; o.w = 0.45 + Math.random() * 0.6; }
    }
  },

  bubbles(x, y, n, spread, size) {
    spread = spread || 20; size = size || 3;
    for (let i = 0; i < n; i++) {
      const o = this.add(2, x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread * 0.5,
        (Math.random() - 0.5) * 40, -30 - Math.random() * 70, 0.7 + Math.random() * 0.9, size * (0.4 + Math.random() * 0.9), '#dff8ff');
      if (o) { o.g = -60; o.drag = 1.2; o.rot = Math.random() * TAU; }
    }
  },

  ring(x, y, r0, r1, life, color, lw) {
    const o = this.add(3, x, y, 0, 0, life, r0, color);
    if (o) { o.s2 = r1; o.lw = lw || 2; }
    return o;
  },

  smoke(x, y, n, color, r0, r1, life, alpha) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = Math.random() * 40;
      const o = this.add(4, x + Math.cos(a) * r0 * 0.4, y + Math.sin(a) * r0 * 0.4, Math.cos(a) * v, Math.sin(a) * v - 10, life * (0.7 + Math.random() * 0.5), r0 * (0.6 + Math.random() * 0.6), color);
      if (o) { o.s2 = r1 * (0.7 + Math.random() * 0.5); o.a = alpha === undefined ? 0.5 : alpha; o.drag = 1.5; }
    }
  },

  text(x, y, str, color, size, life) {
    life = life || 0.9;
    this.texts.push({ x, y, str: String(str), color: color || '#ffffff', size: size || 16, life, max: life, vy: -46 });
    if (this.texts.length > 36) this.texts.shift();
  },

  bolt(x1, y1, x2, y2, color, life, width) {
    life = life || 0.2;
    this.bolts.push({ x1, y1, x2, y2, color: color || '#fff7a8', life, max: life, w: width || 2.4 });
    if (this.bolts.length > 60) this.bolts.shift();
  },

  update(dt) {
    const p = this.p;
    for (let i = p.length - 1; i >= 0; i--) {
      const o = p[i];
      o.life -= dt;
      if (o.life <= 0) { p[i] = p[p.length - 1]; p.pop(); continue; }
      if (o.drag) { const d = Math.exp(-o.drag * dt); o.vx *= d; o.vy *= d; }
      o.vy += o.g * dt;
      o.x += o.vx * dt; o.y += o.vy * dt;
      o.rot += o.vr * dt;
    }
    const tx = this.texts;
    for (let i = tx.length - 1; i >= 0; i--) {
      const t = tx[i];
      t.life -= dt;
      if (t.life <= 0) { tx.splice(i, 1); continue; }
      t.y += t.vy * dt; t.vy *= Math.exp(-2.2 * dt);
    }
    const b = this.bolts;
    for (let i = b.length - 1; i >= 0; i--) {
      b[i].life -= dt;
      if (b[i].life <= 0) b.splice(i, 1);
    }
  },

  /* normal-blend layer */
  draw(ctx) {
    const p = this.p;
    for (let i = 0; i < p.length; i++) {
      const o = p[i], t = o.life / o.max;
      if (o.k === 1) {
        ctx.globalAlpha = Math.min(1, t * 2.2);
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot);
        ctx.fillStyle = o.color;
        ctx.fillRect(-o.size / 2, -o.size * o.w / 2, o.size, o.size * o.w);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-o.size / 2, -o.size * o.w / 2, o.size, 1.2);
        ctx.restore();
      } else if (o.k === 2) {
        ctx.globalAlpha = Math.min(1, t * 3) * 0.7;
        ctx.strokeStyle = o.color; ctx.lineWidth = 1.1;
        const bx = o.x + Math.sin(o.life * 9 + o.rot) * 2;
        ctx.beginPath(); ctx.arc(bx, o.y, o.size, 0, TAU); ctx.stroke();
        if (o.size > 2.2) {
          ctx.beginPath(); ctx.arc(bx, o.y, o.size * 0.55, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
        }
      } else if (o.k === 3) {
        const r = lerp(o.size, o.s2, easeOut(1 - t));
        ctx.globalAlpha = t * o.a;
        ctx.strokeStyle = o.color; ctx.lineWidth = o.lw * (0.35 + t * 0.65);
        ctx.beginPath(); ctx.arc(o.x, o.y, Math.max(0.1, r), 0, TAU); ctx.stroke();
      } else if (o.k === 4) {
        const r = lerp(o.size, o.s2, easeOut(1 - t));
        ctx.globalAlpha = Math.min(1, t * 1.8) * o.a;
        ctx.drawImage(Sprites.blob(o.color), o.x - r, o.y - r, r * 2, r * 2);
      }
    }
    ctx.globalAlpha = 1;
  },

  /* additive layer */
  drawAdd(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    const p = this.p;
    for (let i = 0; i < p.length; i++) {
      const o = p[i];
      if (o.k === 0) {
        const t = o.life / o.max;
        const s = o.size * (0.5 + t * 0.8) * 3.2;
        ctx.globalAlpha = Math.min(1, t * 1.8) * o.a;
        ctx.drawImage(Sprites.glow(o.color), o.x - s, o.y - s, s * 2, s * 2);
      } else if (o.k === 5) {
        const t = o.life / o.max;
        ctx.globalAlpha = Math.min(1, t * 2) * o.a;
        ctx.strokeStyle = o.color; ctx.lineWidth = o.size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x - o.vx * 0.04, o.y - o.vy * 0.04); ctx.stroke();
      }
    }
    // lightning: re-jittered every frame so it crackles
    const b = this.bolts;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let i = 0; i < b.length; i++) {
      const o = b[i], t = o.life / o.max;
      const dx = o.x2 - o.x1, dy = o.y2 - o.y1, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const segs = Math.max(2, Math.ceil(len / 16));
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalAlpha = t * (pass ? 1 : 0.45);
        ctx.strokeStyle = pass ? '#ffffff' : o.color;
        ctx.lineWidth = pass ? o.w * 0.45 : o.w * 2.2;
        ctx.beginPath(); ctx.moveTo(o.x1, o.y1);
        for (let s = 1; s < segs; s++) {
          const u = s / segs, j = (Math.random() - 0.5) * 13;
          ctx.lineTo(o.x1 + dx * u + nx * j, o.y1 + dy * u + ny * j);
        }
        ctx.lineTo(o.x2, o.y2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  drawTexts(ctx) {
    const tx = this.texts;
    if (!tx.length) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < tx.length; i++) {
      const t = tx[i], k = 1 - t.life / t.max;
      const sc = k < 0.16 ? easeOutBack(k / 0.16) : 1;
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2.6);
      ctx.font = '600 ' + (Math.round(t.size * sc * 10) / 10) + 'px ' + FONT;
      ctx.fillStyle = 'rgba(0,8,22,0.6)'; ctx.fillText(t.str, t.x + 1, t.y + 1.6);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  },
};
