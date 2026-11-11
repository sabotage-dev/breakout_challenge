/* SHATTERWAVE — entities */
'use strict';
SW.POWERS = {
  multi:  { label: 'MULTI',  color: '#2de2ff', good: true,  weight: 14, desc: 'Every ball splits into three' },
  wide:   { label: 'WIDE',   color: '#3dff8a', good: true,  weight: 13, dur: 20, desc: 'Wider paddle' },
  laser:  { label: 'LASER',  color: '#ff3b6b', good: true,  weight: 10, dur: 12, desc: 'Twin cannons — click to fire' },
  catch:  { label: 'CATCH',  color: '#ffd23f', good: true,  weight: 9,  dur: 20, desc: 'Paddle catches the ball' },
  slow:   { label: 'SLOW',   color: '#4d7cff', good: true,  weight: 9,  dur: 12, desc: 'Slows every ball' },
  fire:   { label: 'FIRE',   color: '#ff8a3d', good: true,  weight: 6,  dur: 8,  desc: 'Ball melts through bricks' },
  shield: { label: 'SHIELD', color: '#21f5c4', good: true,  weight: 8,  dur: 20, desc: 'Barrier saves falling balls' },
  pulse:  { label: 'PULSE',  color: '#b26bff', good: true,  weight: 6,  desc: 'Half a Pulse charge' },
  life:   { label: '1UP',    color: '#ff4dd8', good: true,  weight: 2.2, desc: 'Extra life' },
  shrink: { label: 'SHRINK', color: '#c0304f', good: false, weight: 6,  dur: 12, desc: 'Smaller paddle (avoid!)' },
  fast:   { label: 'FAST',   color: '#c0304f', good: false, weight: 5,  dur: 10, desc: 'Faster balls (avoid!)' },
};
SW.FONT = '"Bahnschrift", "Avenir Next Condensed", "DIN Condensed", "Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';

/* ---------------- Paddle ---------------- */
SW.Paddle = class {
  constructor() {
    this.x = SW.W / 2; this.prevX = this.x; this.y = SW.PADDLE_Y;
    this.base = 124; this.w = 124; this.tw = 124; this.h = 16;
    this.vx = 0; this.kv = 0; this.squash = 0; this.stun = 0; this.flash = 0; this.tilt = 0;
    this.dead = false; this.appear = 1;
  }
  get top() { return this.y; }
  update(dt, game) {
    this.w = U.damp(this.w, this.tw, 12, dt);
    this.appear = Math.min(1, this.appear + dt * 3);
    const F = SW.FIELD, I = SW.input;
    if (this.stun > 0) this.stun -= dt;
    else if (!this.dead) {
      let target = null;
      const ax = game.demo ? 0 : I.axis();
      if (game.demo) target = game.aiTarget();
      else if (ax !== 0) {
        this.kv = U.approach(this.kv, ax * 980, 7200 * dt);
        this.x += this.kv * dt;
      } else {
        this.kv = U.approach(this.kv, 0, 9000 * dt);
        if (I.touch && I.dragTarget != null) target = I.dragTarget;
        else if (I.lastPointer > I.lastKey) target = I.px;
        else this.x += this.kv * dt;
      }
      if (target != null) this.x = game.demo ? U.approach(this.x, target, 1100 * dt) : target;
    }
    const half = this.w / 2;
    this.x = U.clamp(this.x, F.left + half, F.right - half);
    if (I.touch && I.dragTarget != null) I.dragTarget = U.clamp(I.dragTarget, F.left + half, F.right - half);
    this.vx = dt > 0 ? (this.x - this.prevX) / dt : 0;
    this.prevX = this.x;
    this.tilt = U.damp(this.tilt, U.clamp(this.vx / 4000, -0.1, 0.1), 10, dt);
    this.squash = Math.max(0, this.squash - dt * 5);
    this.flash = Math.max(0, this.flash - dt * 4);
  }
  draw(g, game) {
    if (this.dead) return;
    const accent = SW.bg.accent(), C = SW.C;
    const stun = this.stun > 0;
    const sq = U.easeOutElastic(1 - this.squash) ;
    const sy = 1 - this.squash * 0.35 + (1 - sq) * 0.1, sx = 1 + this.squash * 0.1;
    const w = this.w * sx * this.appear, h = this.h * sy;
    const x = this.x - w / 2, y = this.y + (this.h - h);
    const col = stun ? '#7c7f99' : accent;
    g.save();
    g.translate(this.x, y + h / 2); g.rotate(this.tilt); g.translate(-this.x, -(y + h / 2));
    // under-glow
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.55 + this.flash * 0.45;
    g.drawImage(SW.gfx.glow(col), this.x - w * 0.8, y - 34, w * 1.6, h + 68);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // body
    const grd = g.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, C.lighten(col, 0.65)); grd.addColorStop(0.5, col); grd.addColorStop(1, C.darken(col, 0.45));
    g.fillStyle = grd;
    SW.gfx.rrect(g, x, y, w, h, h / 2); g.fill();
    // emitters on the ends
    const cap = Math.min(18, w * 0.18);
    g.fillStyle = stun ? '#555' : C.lighten(SW.THEMES[game.themeKey]?.accent2 || '#ff3b8b', 0.1);
    SW.gfx.rrect(g, x, y, cap, h, h / 2); g.fill();
    SW.gfx.rrect(g, x + w - cap, y, cap, h, h / 2); g.fill();
    // core line
    g.fillStyle = `rgba(255,255,255,${0.75 + this.flash * 0.25})`;
    SW.gfx.rrect(g, x + cap + 4, y + 3, w - cap * 2 - 8, 3, 1.5); g.fill();
    if (this.flash > 0) { g.globalAlpha = this.flash * 0.8; g.fillStyle = '#fff'; SW.gfx.rrect(g, x, y, w, h, h / 2); g.fill(); g.globalAlpha = 1; }
    // laser cannons
    if (game.pw.laser > 0) {
      g.fillStyle = '#ff3b6b';
      for (const cx of [x + 7, x + w - 11]) { g.fillRect(cx, y - 7, 4, 8); g.fillStyle = '#ffd0dc'; g.fillRect(cx + 1, y - 9, 2, 3); g.fillStyle = '#ff3b6b'; }
    }
    // catch field
    if (game.pw.catch > 0) {
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(255,210,63,0.85)'; g.lineWidth = 2;
      const t = performance.now() / 1000;
      g.beginPath();
      for (let i = 0; i <= 20; i++) { const px = x + 6 + (i / 20) * (w - 12); const py = y - 3 + Math.sin(t * 12 + i) * 1.6; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    if (stun) {
      g.strokeStyle = '#d9f6ff'; g.lineWidth = 1.5; g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        g.beginPath(); let px = x + Math.random() * w; g.moveTo(px, y - 4);
        for (let s = 0; s < 4; s++) { px += U.rand(-10, 10); g.lineTo(px, y + U.rand(-8, h + 4)); }
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }
};

/* ---------------- Ball ---------------- */
SW.Ball = class {
  constructor(x, y, speed) {
    this.x = x; this.y = y; this.r = 8;
    this.speed = speed; this.vx = 0; this.vy = -speed;
    this.stuck = false; this.stuckOff = 0; this.dead = false;
    this.trail = []; this.portalCD = 0; this.sincePaddle = 0; this.flash = 0;
  }
  setAngle(a) { this.vx = Math.sin(a) * this.speed; this.vy = -Math.cos(a) * this.speed; }
  normalize(speed) {
    const m = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / m) * speed; this.vy = (this.vy / m) * speed;
    // never let the ball go too flat
    const minVy = speed * 0.26;
    if (Math.abs(this.vy) < minVy) {
      this.vy = (this.vy < 0 ? -1 : 1) * minVy;
      this.vx = U.sign(this.vx) * Math.sqrt(Math.max(0, speed * speed - minVy * minVy));
    }
  }
  pushTrail() {
    this.trail.push(this.x, this.y);
    if (this.trail.length > 24) this.trail.splice(0, 2);
  }
  draw(g, fire) {
    const col = fire ? '#ff8a3d' : SW.bg.accent();
    const tr = this.trail, n = tr.length / 2;
    g.globalCompositeOperation = 'lighter';
    const glow = SW.gfx.glow(col);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) / n;
      const s = this.r * (0.6 + k * 1.6);
      g.globalAlpha = k * 0.45;
      g.drawImage(glow, tr[i * 2] - s, tr[i * 2 + 1] - s, s * 2, s * 2);
    }
    g.globalAlpha = 0.9;
    const s = this.r * (fire ? 4.6 : 3.6) * (1 + this.flash * 0.5);
    g.drawImage(glow, this.x - s, this.y - s, s * 2, s * 2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = fire ? '#fff3c0' : '#ffffff';
    g.beginPath(); g.arc(this.x, this.y, this.r, 0, U.TAU); g.fill();
  }
};

/* ---------------- Brick ---------------- */
SW.Brick = class {
  constructor(ch, x, y, w, h) {
    const sp = SW.SPECIAL[ch];
    this.kind = sp ? sp.kind : 'normal';
    this.hp = this.maxHp = sp ? sp.hp : 1;
    this.color = sp ? sp.color : SW.PALETTE[ch] || '#ffffff';
    this.x = this.baseX = x; this.y = this.baseY = y; this.w = w; this.h = h;
    this.alive = true; this.required = this.kind !== 'steel';
    this.flash = 0; this.wob = 0; this.appear = 0; this.delay = 0;
    this.move = null; this.orbit = null; this.solid = true; this.alpha = 1;
    this.phase = Math.random() * 6;
    this.cracks = null;
    this.value = { normal: 50, armor: 100, bomb: 75, mystery: 120, crystal: 150, ghost: 90, steel: 0 }[this.kind];
  }
  makeCracks() {
    const c = [];
    for (let k = 0; k < 3; k++) {
      let px = U.rand(0.2, 0.8) * this.w, py = U.rand(0.2, 0.8) * this.h;
      const pts = [px, py], ang = Math.random() * U.TAU;
      for (let s = 0; s < 3; s++) { px += Math.cos(ang + U.rand(-0.8, 0.8)) * U.rand(5, 12); py += Math.sin(ang + U.rand(-0.8, 0.8)) * U.rand(3, 7); pts.push(px, py); }
      c.push(pts);
    }
    this.cracks = c;
  }
  update(dt, t) {
    this.flash = Math.max(0, this.flash - dt * 6);
    this.wob = Math.max(0, this.wob - dt * 5);
    if (this.delay > 0) this.delay -= dt; else this.appear = Math.min(1, this.appear + dt * 2.6);
    if (this.move) this.x = this.baseX + Math.sin(t * this.move.speed + this.move.phase) * this.move.amp;
    if (this.kind === 'ghost') {
      const cyc = (t * 0.32 + this.phase * 0.05 + this.baseX * 0.0012) % 1; // 0..1
      const vis = cyc < 0.6 ? 1 : cyc < 0.68 ? 1 - (cyc - 0.6) / 0.08 : cyc < 0.92 ? 0 : (cyc - 0.92) / 0.08;
      this.alpha = 0.08 + vis * 0.92; this.solid = vis > 0.5;
    }
  }
  draw(g, t) {
    const a = U.easeOutBack(Math.min(1, this.appear));
    if (this.appear <= 0) return;
    const spr = SW.gfx.brick(this.kind, this.color, this.w, this.h);
    const ox = this.wob ? Math.sin(t * 90) * this.wob * 3 : 0;
    const dy = (1 - a) * -40;
    g.globalAlpha = Math.min(1, this.appear * 1.5) * this.alpha;
    const pad = spr.pad;
    g.drawImage(spr.c, this.x - pad + ox, this.y - pad + dy, this.w + pad * 2, this.h + pad * 2);
    if (this.kind === 'armor' && this.hp < this.maxHp) {
      if (!this.cracks) this.makeCracks();
      g.strokeStyle = 'rgba(20,10,40,0.75)'; g.lineWidth = 1.4;
      const n = this.maxHp - this.hp === 1 ? 1 : 3;
      for (let k = 0; k < n; k++) {
        const p = this.cracks[k];
        g.beginPath(); g.moveTo(this.x + p[0] + ox, this.y + p[1] + dy);
        for (let i = 2; i < p.length; i += 2) g.lineTo(this.x + p[i] + ox, this.y + p[i + 1] + dy);
        g.stroke();
      }
    }
    if (this.kind === 'bomb' || this.kind === 'mystery') {
      const pulse = 0.5 + 0.5 * Math.sin(t * (this.kind === 'bomb' ? 6 : 3) + this.phase);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.12 + pulse * 0.2;
      g.fillStyle = this.kind === 'bomb' ? '#ff9a3d' : '#fff2b0';
      SW.gfx.rrect(g, this.x + ox, this.y + dy, this.w, this.h, 5); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    if (this.flash > 0) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = this.flash;
      g.fillStyle = '#ffffff';
      SW.gfx.rrect(g, this.x + ox, this.y + dy, this.w, this.h, 5); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  }
};

/* ---------------- Capsule (power-up) ---------------- */
SW.Capsule = class {
  constructor(x, y, type) { this.x = x; this.y = y; this.type = type; this.vy = 140; this.t = 0; this.dead = false; this.w = 58; this.h = 22; }
  update(dt) { this.t += dt; this.vy = Math.min(230, this.vy + 40 * dt); this.y += this.vy * dt; }
  draw(g) {
    const P = SW.POWERS[this.type];
    const x = this.x + Math.sin(this.t * 4) * 2, y = this.y;
    const w = this.w, h = this.h;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5 + 0.2 * Math.sin(this.t * 8);
    g.drawImage(SW.gfx.glow(P.color), x - w, y - h * 1.6, w * 2, h * 3.2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const grd = g.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    grd.addColorStop(0, SW.C.lighten(P.color, 0.6)); grd.addColorStop(0.5, P.color); grd.addColorStop(1, SW.C.darken(P.color, 0.4));
    g.fillStyle = grd;
    SW.gfx.rrect(g, x - w / 2, y - h / 2, w, h, h / 2); g.fill();
    g.strokeStyle = P.good ? 'rgba(255,255,255,0.8)' : '#ff9aa8'; g.lineWidth = 1.5;
    SW.gfx.rrect(g, x - w / 2, y - h / 2, w, h, h / 2); g.stroke();
    // sweeping shine
    const sx = x - w / 2 + ((this.t * 70) % (w + 30)) - 15;
    g.save(); SW.gfx.rrect(g, x - w / 2, y - h / 2, w, h, h / 2); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(sx, y - h / 2); g.lineTo(sx + 8, y - h / 2); g.lineTo(sx - 2, y + h / 2); g.lineTo(sx - 10, y + h / 2); g.fill();
    g.restore();
    g.font = `800 12px ${SW.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = P.good ? '#140726' : '#fff';
    g.fillText(P.label, x, y + 1);
  }
};

/* ---------------- Projectiles & field objects ---------------- */
SW.Laser = class {
  constructor(x, y) { this.x = x; this.y = y; this.vy = -1000; this.dead = false; }
  draw(g) {
    g.globalCompositeOperation = 'lighter';
    g.drawImage(SW.gfx.glow('#ff3b6b'), this.x - 10, this.y - 16, 20, 36);
    g.fillStyle = '#ffe0e8'; g.fillRect(this.x - 1.5, this.y - 9, 3, 18);
    g.globalCompositeOperation = 'source-over';
  }
};

SW.Orb = class { // hostile boss shot: always red, spinning diamond so it never reads as a ball
  constructor(x, y, vx, vy) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.r = 9; this.color = '#ff2a55'; this.t = 0; this.dead = false; }
  update(dt) { this.t += dt; this.x += this.vx * dt; this.y += this.vy * dt; }
  draw(g) {
    const s = 26 + Math.sin(this.t * 22) * 5, x = this.x, y = this.y;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.9;
    g.drawImage(SW.gfx.glow('#ff2a55'), x - s, y - s, s * 2, s * 2);
    g.globalAlpha = 0.5;
    g.drawImage(SW.gfx.glow('#ff7a1a'), x - this.vx * 0.05 - s * 0.6, y - this.vy * 0.05 - s * 0.6, s * 1.2, s * 1.2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const a = this.t * 9, r = this.r * 1.35;
    g.fillStyle = '#ff2a55';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? r * 0.45 : r, an = a + (i / 8) * U.TAU;
      g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
    }
    g.closePath(); g.fill();
    g.fillStyle = '#fff2c0';
    g.beginPath(); g.arc(x, y, this.r * 0.38, 0, U.TAU); g.fill();
  }
};

SW.Bumper = class {
  constructor(x, y, r) { this.x = x; this.y = y; this.r = r; this.flash = 0; this.hits = 0; }
  draw(g, t, color) {
    const f = this.flash, r = this.r * (1 + f * 0.18);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.45 + f * 0.55;
    g.drawImage(SW.gfx.glow(color), this.x - r * 2.4, this.y - r * 2.4, r * 4.8, r * 4.8);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const grd = g.createRadialGradient(this.x - r * 0.3, this.y - r * 0.3, r * 0.1, this.x, this.y, r);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, SW.C.lighten(color, 0.3)); grd.addColorStop(1, SW.C.darken(color, 0.5));
    g.fillStyle = grd; g.beginPath(); g.arc(this.x, this.y, r, 0, U.TAU); g.fill();
    g.strokeStyle = f > 0 ? '#fff' : SW.C.lighten(color, 0.5); g.lineWidth = 2.5;
    g.beginPath(); g.arc(this.x, this.y, r - 4, t * 2, t * 2 + Math.PI * 1.3); g.stroke();
    g.beginPath(); g.arc(this.x, this.y, r + 3, -t * 1.5, -t * 1.5 + Math.PI * 0.8); g.stroke();
  }
};

SW.Portal = class {
  constructor(ax, ay, bx, by) { this.a = { x: ax, y: ay }; this.b = { x: bx, y: by }; this.r = 22; this.flash = 0; }
  draw(g, t) {
    const ends = [[this.a, '#2de2ff', 1], [this.b, '#ff8a3d', -1]];
    g.globalCompositeOperation = 'lighter';
    for (const [p, col, dir] of ends) {
      g.globalAlpha = 0.5 + this.flash * 0.5;
      g.drawImage(SW.gfx.glow(col), p.x - 50, p.y - 50, 100, 100);
      g.globalAlpha = 1;
      g.strokeStyle = col; g.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const rr = this.r - k * 6, a0 = t * (3 + k) * dir + k * 2;
        g.lineWidth = 3 - k * 0.6;
        g.beginPath(); g.arc(p.x, p.y, rr, a0, a0 + Math.PI * 1.2); g.stroke();
        g.beginPath(); g.arc(p.x, p.y, rr, a0 + Math.PI, a0 + Math.PI * 1.6); g.stroke();
      }
    }
    g.globalCompositeOperation = 'source-over';
  }
};

SW.Wave = class { // the Pulse shockwave travelling up the screen
  constructor(x, y, w) { this.x = x; this.y = y; this.w = w; this.vy = -1250; this.hit = new Set(); this.dead = false; this.t = 0; }
  draw(g) {
    const top = this.y, x0 = this.x - this.w / 2, x1 = x0 + this.w;
    const fade = Math.min(1, this.t * 6);
    g.globalCompositeOperation = 'lighter';
    // trailing energy
    const grd = g.createLinearGradient(0, top, 0, top + 90);
    grd.addColorStop(0, 'rgba(178,107,255,0.45)'); grd.addColorStop(1, 'rgba(90,40,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x0, top + 22); g.quadraticCurveTo(this.x, top - 18, x1, top + 22);
    g.lineTo(x1, top + 90); g.lineTo(x0, top + 90); g.closePath();
    g.fill();
    // leading edge
    g.lineCap = 'round';
    for (const [w, c] of [[16, 'rgba(178,107,255,0.25)'], [7, 'rgba(215,184,255,0.6)'], [2.5, '#ffffff']]) {
      g.strokeStyle = c; g.lineWidth = w; g.globalAlpha = fade;
      g.beginPath(); g.moveTo(x0, top + 22); g.quadraticCurveTo(this.x, top - 18, x1, top + 22); g.stroke();
    }
    // speed lines
    g.strokeStyle = 'rgba(215,184,255,0.35)'; g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i < 7; i++) { const lx = x0 + 18 + i * (this.w - 36) / 6; const ly = top + 30 + ((i * 37) % 23); g.moveTo(lx, ly); g.lineTo(lx, ly + 40); }
    g.stroke();
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
};
