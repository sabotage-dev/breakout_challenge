'use strict';
/* ==========================================================================
   HADAL — the ocean behind the playfield.
   One renderer, five moods: every element has a per-zone strength, and the
   strengths cross-fade while the sub dives from one zone into the next.
   ========================================================================== */

const Bg = {
  a: 0, b: 0, k: 0,           // from-zone, to-zone, blend
  scroll: 0, speed: 0, t: 0,
  snow: [], bub: [], rays: [], kelp: [], schools: [], jel: [], lum: [], emb: [],
  whale: null, whaleT: 26,

  init() {
    const R = mulberry32(20261110);
    for (let i = 0; i < 120; i++) this.snow.push({ x: R(), y: R(), z: 0.3 + R() * 0.7, s: 0.7 + R() * 1.7, ph: R() * TAU });
    for (let i = 0; i < 30; i++) this.bub.push({ x: R(), y: R(), z: 0.4 + R() * 0.6, s: 1.4 + R() * 4.2, ph: R() * TAU, v: 26 + R() * 60 });
    for (let i = 0; i < 8; i++) this.rays.push({ x: 0.04 + R() * 0.92, w: 26 + R() * 90, ph: R() * TAU, sp: 0.14 + R() * 0.24, a: 0.45 + R() * 0.55, len: 0.6 + R() * 0.4 });
    for (let i = 0; i < 14; i++) this.kelp.push({ side: i % 2, off: R(), h: 0.26 + R() * 0.5, ph: R() * TAU, w: 6 + R() * 7, tone: R() });
    for (let i = 0; i < 4; i++) this.schools.push(this.newSchool(R, true));
    for (let i = 0; i < 7; i++) this.jel.push({ x: R(), y: R(), s: 16 + R() * 30, ph: R() * TAU, v: 5 + R() * 10, hue: R() });
    for (let i = 0; i < 50; i++) this.lum.push({ x: R(), y: R(), ph: R() * TAU, sp: 0.4 + R() * 1.2, s: 1 + R() * 2.2, c: R() });
    for (let i = 0; i < 44; i++) this.emb.push({ x: R(), y: R(), ph: R() * TAU, v: 26 + R() * 70, s: 0.8 + R() * 1.8 });
  },

  newSchool(R, initial) {
    const dir = R() < 0.5 ? -1 : 1, n = 6 + Math.floor(R() * 9), fish = [];
    for (let i = 0; i < n; i++) fish.push({ ox: (R() - 0.5) * 170, oy: (R() - 0.5) * 64, ph: R() * TAU, s: 0.7 + R() * 0.6 });
    return { x: initial ? R() : (dir > 0 ? -0.2 : 1.2), y: 0.1 + R() * 0.72, dir, v: 0.014 + R() * 0.02, fish, size: 9 + R() * 8 };
  },

  setZone(i) { this.a = this.b = i; this.k = 0; },
  blendTo(i) { if (this.k > 0.5) this.a = this.b; this.b = i; this.k = 0; },

  mv(prop) { return lerp(ZONES[this.a].bg[prop], ZONES[this.b].bg[prop], this.k); },
  mc(prop) { return this.k <= 0 ? ZONES[this.a].bg[prop] : mix(ZONES[this.a].bg[prop], ZONES[this.b].bg[prop], this.k); },
  accent() { return this.k <= 0 ? ZONES[this.a].accent : mix(ZONES[this.a].accent, ZONES[this.b].accent, this.k); },

  update(dt) {
    this.t += dt;
    this.scroll += this.speed * dt;
    for (let i = 0; i < this.schools.length; i++) {
      const s = this.schools[i];
      s.x += s.dir * s.v * dt;
      if (s.x < -0.3 || s.x > 1.3) this.schools[i] = this.newSchool(Math.random, false);
    }
    // now and then, something very large passes in the distance
    if (this.whale) {
      this.whale.x += this.whale.dir * this.whale.v * dt;
      if (this.whale.x < -0.6 || this.whale.x > 1.6) this.whale = null;
    } else {
      this.whaleT -= dt;
      if (this.whaleT <= 0) {
        this.whaleT = 50 + Math.random() * 50;
        const zi = this.k > 0.5 ? this.b : this.a;
        if (zi === 1 || zi === 0) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          this.whale = { x: dir > 0 ? -0.5 : 1.5, y: 0.25 + Math.random() * 0.35, dir, v: 0.022, s: 0.8 + Math.random() * 0.5, ph: Math.random() * TAU };
        }
      }
    }
  },

  /* ----------------------------------------------------------------- draw */
  draw(ctx) {
    const v = View, t = this.t;
    const g = ctx.createLinearGradient(0, v.y0, 0, v.y0 + v.h);
    g.addColorStop(0, this.mc('top')); g.addColorStop(0.5, this.mc('mid')); g.addColorStop(1, this.mc('bot'));
    ctx.fillStyle = g; ctx.fillRect(v.x0 - 1, v.y0 - 1, v.w + 2, v.h + 2);

    const rays = this.mv('rays'), kelp = this.mv('kelp'), fish = this.mv('fish'), jelly = this.mv('jelly');
    const lumen = this.mv('lumen'), snow = this.mv('snow'), vent = this.mv('vent'), rock = this.mv('rock');

    if (rays > 0.01) this.drawRays(ctx, rays);
    if (this.whale) this.drawWhale(ctx);
    if (vent > 0.01) this.drawVentGlow(ctx, vent);
    if (rock > 0.01) this.drawRock(ctx, rock, vent);
    if (fish > 0.01) this.drawFish(ctx, fish);
    if (jelly > 0.01) this.drawJellies(ctx, jelly);
    if (kelp > 0.01) this.drawKelp(ctx, kelp);
    if (lumen > 0.01) this.drawLumens(ctx, lumen, vent);
    if (vent > 0.01) this.drawEmbers(ctx, vent);
    this.drawSnow(ctx, snow, vent);
    this.drawBubbles(ctx, clamp(0.25 + rays * 0.6 + this.speed / 500, 0, 1.3));
  },

  drawRays(ctx, amt) {
    const v = View;
    const beat = 0.9 + 0.1 * Sound.pulse();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.rays.length; i++) {
      const r = this.rays[i];
      const tx = v.x0 + r.x * v.w + Math.sin(this.t * r.sp + r.ph) * 46;
      const len = v.h * r.len, slant = -len * 0.24;
      const wT = r.w * 0.5, wB = r.w * 1.7;
      const a = 0.105 * amt * r.a * (0.72 + 0.28 * Math.sin(this.t * r.sp * 2.3 + r.ph * 2)) * beat;
      const g = ctx.createLinearGradient(0, v.y0, 0, v.y0 + len);
      g.addColorStop(0, 'rgba(215,255,248,' + a.toFixed(4) + ')'); g.addColorStop(1, 'rgba(215,255,248,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(tx - wT, v.y0); ctx.lineTo(tx + wT, v.y0);
      ctx.lineTo(tx + slant + wB, v.y0 + len); ctx.lineTo(tx + slant - wB, v.y0 + len);
      ctx.closePath(); ctx.fill();
    }
    const sg = ctx.createLinearGradient(0, v.y0, 0, v.y0 + 170);
    sg.addColorStop(0, 'rgba(230,255,250,' + (0.24 * amt).toFixed(4) + ')'); sg.addColorStop(1, 'rgba(230,255,250,0)');
    ctx.fillStyle = sg; ctx.fillRect(v.x0, v.y0, v.w, 170);
    ctx.globalCompositeOperation = 'source-over';
  },

  drawRock(ctx, amt, vent) {
    const v = View, margin = Math.max(0, -v.x0);
    if (margin < 34) return;
    const base = this.mc('bot');
    for (let layer = 0; layer < 2; layer++) {
      const maxW = Math.min(margin * (layer ? 0.5 : 0.86), layer ? 150 : 270);
      const par = layer ? 0.75 : 0.42;
      ctx.fillStyle = mix(base, layer ? '#000008' : '#04101e', layer ? 0.62 : 0.4);
      ctx.globalAlpha = clamp(amt * (layer ? 1 : 0.8), 0, 1);
      for (let side = 0; side < 2; side++) {
        const edge = side ? v.x1 + 1 : v.x0 - 1, dir = side ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(edge, v.y0 - 2);
        for (let y = v.y0 - 2; y <= v.y1 + 26; y += 22) {
          const q = y + this.scroll * par;
          const n = noise1(q / 120, side * 31 + layer * 7 + 5) * 0.62 + noise1(q / 37, side * 17 + layer * 3 + 9) * 0.38;
          ctx.lineTo(edge + dir * maxW * (0.2 + 0.8 * n), y);
        }
        ctx.lineTo(edge, v.y1 + 26); ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // hydrothermal chimneys on the trench floor
    if (vent > 0.05 && margin > 80) {
      const flick = 0.75 + 0.25 * Math.sin(this.t * 7.3) * Math.sin(this.t * 3.1);
      const spots = [[v.x0 + margin * 0.42, 150, 0], [v.x0 + margin * 0.74, 95, 1.7], [v.x1 - margin * 0.4, 170, 3.1], [v.x1 - margin * 0.75, 110, 4.4]];
      for (let i = 0; i < spots.length; i++) {
        const sx = spots[i][0], sh = spots[i][1], ph = spots[i][2];
        const top = v.y1 - sh;
        // smoke plume
        for (let j = 0; j < 6; j++) {
          const u = ((this.t * 0.16 + j / 6 + ph) % 1);
          const r = 16 + u * 52;
          ctx.globalAlpha = (1 - u) * 0.5 * vent;
          ctx.drawImage(Sprites.blob('#0a0508'), sx + Math.sin(u * 5 + ph) * 16 * u - r, top - u * 260 - r, r * 2, r * 2);
        }
        ctx.globalAlpha = vent;
        ctx.fillStyle = '#06030a';
        ctx.beginPath();
        ctx.moveTo(sx - 30, v.y1 + 2); ctx.lineTo(sx - 13, top + 14); ctx.lineTo(sx - 9, top);
        ctx.lineTo(sx + 9, top + 3); ctx.lineTo(sx + 15, top + 22); ctx.lineTo(sx + 34, v.y1 + 2);
        ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6 * vent * flick;
        ctx.drawImage(Sprites.glow('#ff7a2a'), sx - 44, top - 40, 88, 80);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    }
  },

  drawVentGlow(ctx, vent) {
    const v = View;
    const pulse = 0.85 + 0.15 * Math.sin(this.t * 1.7);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, v.y1 - v.h * 0.5, 0, v.y1);
    g.addColorStop(0, 'rgba(255,80,20,0)'); g.addColorStop(1, 'rgba(255,80,20,' + (0.26 * vent * pulse).toFixed(4) + ')');
    ctx.fillStyle = g; ctx.fillRect(v.x0, v.y1 - v.h * 0.5, v.w, v.h * 0.5);
    ctx.globalCompositeOperation = 'source-over';
  },

  drawEmbers(ctx, vent) {
    const v = View, img = Sprites.glow('#ff8a3c');
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.emb.length; i++) {
      const e = this.emb[i];
      let y = (e.y * v.h - this.t * e.v - this.scroll * 0.8) % v.h; if (y < 0) y += v.h;
      const u = y / v.h;
      const x = v.x0 + e.x * v.w + Math.sin(this.t * 0.8 + e.ph) * 22;
      const s = e.s * 5;
      ctx.globalAlpha = Math.pow(u, 1.4) * vent * (0.6 + 0.4 * Math.sin(this.t * 5 + e.ph));
      ctx.drawImage(img, x - s, v.y0 + y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  drawFish(ctx, amt) {
    const v = View;
    ctx.fillStyle = mix(this.mc('bot'), '#001424', 0.35);
    for (let i = 0; i < this.schools.length; i++) {
      const s = this.schools[i];
      const bx = v.x0 + s.x * v.w, by = v.y0 + s.y * v.h;
      ctx.globalAlpha = 0.42 * amt;
      for (let j = 0; j < s.fish.length; j++) {
        const f = s.fish[j];
        const len = s.size * f.s;
        const fx = bx + f.ox + Math.sin(this.t * 0.7 + f.ph) * 8;
        const fy = by + f.oy + Math.sin(this.t * 1.4 + f.ph) * 6;
        const wag = Math.sin(this.t * 9 + f.ph) * len * 0.16;
        ctx.beginPath();
        ctx.ellipse(fx, fy, len, len * 0.36, 0, 0, TAU);
        ctx.moveTo(fx - s.dir * len * 0.8, fy);
        ctx.lineTo(fx - s.dir * len * 1.7, fy - len * 0.42 + wag);
        ctx.lineTo(fx - s.dir * len * 1.7, fy + len * 0.42 + wag);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },

  drawWhale(ctx) {
    const v = View, w = this.whale;
    const zi = this.k > 0.5 ? this.b : this.a;
    const amt = zi <= 1 ? 1 : 0;
    if (amt <= 0) return;
    const L = 420 * w.s, x = v.x0 + w.x * v.w, y = v.y0 + w.y * v.h + Math.sin(this.t * 0.4 + w.ph) * 12;
    const d = w.dir, tail = Math.sin(this.t * 1.1 + w.ph) * 16 * w.s;
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = mix(this.mc('bot'), '#000a18', 0.3);
    ctx.beginPath();
    ctx.moveTo(x + d * L * 0.5, y + 6 * w.s);                                             // snout
    ctx.bezierCurveTo(x + d * L * 0.46, y - 46 * w.s, x + d * L * 0.1, y - 60 * w.s, x - d * L * 0.18, y - 34 * w.s);
    ctx.bezierCurveTo(x - d * L * 0.32, y - 22 * w.s, x - d * L * 0.4, y - 10 * w.s + tail * 0.4, x - d * L * 0.46, y - 6 * w.s + tail * 0.7);
    ctx.lineTo(x - d * L * 0.56, y - 42 * w.s + tail);                                    // fluke up
    ctx.lineTo(x - d * L * 0.5, y + tail * 0.9);
    ctx.lineTo(x - d * L * 0.57, y + 36 * w.s + tail);                                    // fluke down
    ctx.lineTo(x - d * L * 0.45, y + 6 * w.s + tail * 0.7);
    ctx.bezierCurveTo(x - d * L * 0.3, y + 16 * w.s, x - d * L * 0.1, y + 42 * w.s, x + d * L * 0.2, y + 46 * w.s);
    ctx.bezierCurveTo(x + d * L * 0.4, y + 46 * w.s, x + d * L * 0.5, y + 28 * w.s, x + d * L * 0.5, y + 6 * w.s);
    ctx.closePath(); ctx.fill();
    // pectoral fin
    ctx.beginPath();
    ctx.moveTo(x + d * L * 0.16, y + 34 * w.s);
    ctx.quadraticCurveTo(x + d * L * 0.06, y + 86 * w.s, x - d * L * 0.06, y + 92 * w.s);
    ctx.quadraticCurveTo(x + d * L * 0.02, y + 56 * w.s, x + d * L * 0.06, y + 40 * w.s);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  },

  drawJellies(ctx, amt) {
    const v = View;
    ctx.lineCap = 'round';
    for (let i = 0; i < this.jel.length; i++) {
      const j = this.jel[i];
      const span = v.h + 240;
      let y = (j.y * span - this.t * j.v - this.scroll * 0.35) % span; if (y < 0) y += span;
      y += v.y0 - 120;
      const x = v.x0 + j.x * v.w + Math.sin(this.t * 0.3 + j.ph) * 22;
      const pul = Math.sin(this.t * 1.6 + j.ph);
      const s = j.s, wd = s * (1 + pul * 0.08), ht = s * 0.8 * (1 - pul * 0.1);
      const col = j.hue < 0.5 ? '#c79bff' : '#ff9be0';
      ctx.globalAlpha = 0.17 * amt;
      ctx.fillStyle = col; ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - wd, y);
      ctx.bezierCurveTo(x - wd, y - ht * 1.5, x + wd, y - ht * 1.5, x + wd, y);
      ctx.quadraticCurveTo(x, y - ht * 0.3, x - wd, y);
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.14 * amt;
      for (let q = -2; q <= 2; q++) {
        ctx.beginPath();
        const tx = x + q * wd * 0.36;
        ctx.moveTo(tx, y - 2);
        ctx.quadraticCurveTo(tx + Math.sin(this.t * 1.3 + q + j.ph) * 9, y + s * 0.8, tx + Math.sin(this.t * 0.9 + q * 2 + j.ph) * 12, y + s * 1.7);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },

  drawKelp(ctx, amt) {
    const v = View, margin = Math.max(0, -v.x0);
    const span = Math.max(margin, 70), N = 12;
    const px = new Array(N + 1), py = new Array(N + 1), pw = new Array(N + 1);
    for (let i = 0; i < this.kelp.length; i++) {
      const kp = this.kelp[i];
      const bx = kp.side ? v.x1 - kp.off * span * 0.92 - 6 : v.x0 + kp.off * span * 0.92 + 6;
      const hgt = v.h * kp.h, by = v.y1 + 12;
      for (let s = 0; s <= N; s++) {
        const u = s / N;
        px[s] = bx + Math.sin(this.t * 0.9 + kp.ph + u * 3.2) * (3 + u * 24) + Math.sin(this.t * 0.37 + kp.ph * 2 + u * 1.3) * u * 14;
        py[s] = by - u * hgt;
        pw[s] = kp.w * (1 - u * 0.86);
      }
      ctx.fillStyle = mix('#0c5a48', '#083a5e', kp.tone);
      ctx.globalAlpha = 0.6 * amt;
      ctx.beginPath(); ctx.moveTo(px[0] - pw[0], py[0]);
      for (let s = 1; s <= N; s++) ctx.lineTo(px[s] - pw[s], py[s]);
      for (let s = N; s >= 0; s--) ctx.lineTo(px[s] + pw[s], py[s]);
      ctx.closePath(); ctx.fill();
      for (let s = 2; s < N; s += 2) {
        const dir = (s / 2) % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.ellipse(px[s] + dir * (pw[s] + 8), py[s] - 3, 11, 3.6, dir * 0.5 + Math.sin(this.t * 0.9 + s + kp.ph) * 0.22, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },

  drawLumens(ctx, amt, vent) {
    const v = View;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.lum.length; i++) {
      const l = this.lum[i];
      const bl = Math.sin(this.t * l.sp + l.ph);
      if (bl <= 0) continue;
      let y = (l.y * v.h - this.scroll * 0.5) % v.h; if (y < 0) y += v.h;
      const x = v.x0 + l.x * v.w + Math.sin(this.t * 0.2 + l.ph) * 18;
      const col = vent > 0.5 ? (l.c < 0.5 ? '#ff9a4c' : '#ffd36b') : (l.c < 0.45 ? '#5ff5ff' : l.c < 0.8 ? '#6dffb0' : '#c79bff');
      const s = l.s * 6;
      ctx.globalAlpha = bl * bl * bl * 0.8 * amt;
      ctx.drawImage(Sprites.glow(col), x - s, v.y0 + y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  drawSnow(ctx, amt, vent) {
    const v = View, sp = this.speed;
    ctx.fillStyle = vent > 0.5 ? '#e8c6b0' : '#e6f6ff';
    for (let i = 0; i < this.snow.length; i++) {
      const p = this.snow[i];
      let x = (p.x * v.w + Math.sin(this.t * 0.3 + p.ph) * 14) % v.w; if (x < 0) x += v.w;
      let y = (p.y * v.h + this.t * 8 * p.z - this.scroll * p.z) % v.h; if (y < 0) y += v.h;
      ctx.globalAlpha = (0.1 + 0.32 * p.z) * clamp(amt + sp / 900, 0, 1.2);
      if (sp > 60) ctx.fillRect(v.x0 + x, v.y0 + y, p.s * 0.8, p.s + Math.min(70, sp * 0.045 * p.z));
      else ctx.fillRect(v.x0 + x, v.y0 + y, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  },

  drawBubbles(ctx, amt) {
    const v = View, sp = this.speed;
    ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 1;
    for (let i = 0; i < this.bub.length; i++) {
      const b = this.bub[i];
      let y = (b.y * v.h - this.t * b.v - this.scroll * b.z * 1.25) % v.h; if (y < 0) y += v.h;
      const x = v.x0 + b.x * v.w + Math.sin(this.t * 1.3 + b.ph) * 8;
      ctx.globalAlpha = 0.26 * amt * b.z;
      ctx.beginPath();
      if (sp > 60) ctx.ellipse(x, v.y0 + y, b.s * 0.75, b.s + Math.min(46, sp * 0.03), 0, 0, TAU);
      else ctx.arc(x, v.y0 + y, b.s, 0, TAU);
      ctx.stroke();
      if (sp <= 60 && b.s > 2.6) {
        ctx.beginPath(); ctx.arc(x, v.y0 + y, b.s * 0.55, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },
};
