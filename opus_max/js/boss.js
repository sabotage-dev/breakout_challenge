/* SHATTERWAVE — boss: a giant watchful eye guarded by orbiting brick rings */
'use strict';
SW.Boss = class {
  constructor(cfg, game) {
    this.cfg = cfg;
    this.name = cfg.name; this.r = cfg.r; this.hp = this.maxHp = cfg.hp;
    this.color = cfg.color; this.iris = cfg.iris;
    this.x0 = cfg.x; this.y0 = cfg.y; this.x = cfg.x; this.y = cfg.y;
    this.move = cfg.move; this.mt = 0; this.t = 0;
    this.attack = cfg.attack.kind; this.every = cfg.attack.every; this.shotSpeed = cfg.attack.speed;
    this.fireT = this.every + 1.2 + (cfg.attack.offset || 0);
    this.speedMul = 1; this.everyMul = 1; this.regenMul = 1;
    this.phaseIdx = 0; this.flash = 0; this.rage = 0; this.charge = 0;
    this.dead = false; this.dying = 0; this.boomT = 0;
    this.eyeX = 0; this.eyeY = 0; this.blink = 0; this.blinkT = U.rand(2, 5);
    this.appear = 0; this.shell = Math.random() * 6;
    this.rings = [];
    for (const rc of cfg.rings || []) {
      const ring = { cfg: rc, angle: Math.random() * 6, bricks: [], regenT: 0 };
      for (let i = 0; i < rc.n; i++) {
        const b = new SW.Brick(rc.hp === 2 ? '2' : 'w', 0, 0, 34, 18);
        if (rc.hp !== 2) b.color = cfg.color;
        b.kind = rc.hp === 2 ? 'armor' : 'normal';
        b.required = false; b.value = 30;
        b.orbit = { ring, i };
        b.delay = 0.6 + i * 0.04;
        ring.bricks.push(b);
        game.bricks.push(b);
      }
      this.rings.push(ring);
    }
    this.layoutRings(0);
  }
  layoutRings(dt) {
    for (const ring of this.rings) {
      ring.angle += ring.cfg.speed * dt * (1 + (this.speedMul - 1) * 0.6);
      const n = ring.bricks.length;
      for (let i = 0; i < n; i++) {
        const b = ring.bricks[i], a = ring.angle + (i / n) * U.TAU;
        b.x = this.x + Math.cos(a) * ring.cfg.rad - b.w / 2;
        b.y = this.y + Math.sin(a) * ring.cfg.rad - b.h / 2;
      }
    }
  }
  get alive() { return !this.dead && this.dying <= 0; }
  update(dt, game) {
    this.t += dt;
    this.appear = Math.min(1, this.appear + dt * 1.2);
    this.flash = Math.max(0, this.flash - dt * 5);
    this.rage = Math.max(0, this.rage - dt * 1.5);
    if (this.dying > 0) {
      this.dying -= dt;
      this.boomT -= dt;
      if (this.boomT <= 0) {
        this.boomT = U.rand(0.08, 0.18);
        const a = Math.random() * U.TAU, d = Math.random() * this.r;
        SW.fx.explosion(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d, U.pick([this.color, this.iris, '#ffffff']), U.rand(0.5, 0.9));
        SW.fx.shake(0.25);
        SW.audio.sfx('explode', 0.8);
      }
      if (this.dying <= 0) { this.dead = true; game.onBossDead(this); }
      return;
    }
    // movement
    const m = this.move;
    this.mt += dt * this.speedMul;
    if (m.type === 'liss') {
      this.x = this.x0 + Math.sin(this.mt * m.sx + m.phase) * m.ax;
      this.y = this.y0 + Math.sin(this.mt * m.sy * 2 + m.phase) * m.ay;
    } else {
      this.x = this.x0 + Math.sin(this.mt * m.sx) * m.ax;
      this.y = this.y0 + Math.sin(this.mt * m.sy) * m.ay;
    }
    this.layoutRings(dt);
    // regenerate shield bricks one at a time
    for (const ring of this.rings) {
      const deadB = ring.bricks.filter((b) => !b.alive);
      if (!deadB.length) { ring.regenT = 0; continue; }
      ring.regenT += dt;
      if (ring.regenT >= ring.cfg.regen * this.regenMul) {
        ring.regenT = 0;
        const b = U.pick(deadB);
        b.alive = true; b.hp = b.maxHp; b.appear = 0; b.delay = 0; b.flash = 1; b.cracks = null;
        SW.fx.ring(b.x + b.w / 2, b.y + b.h / 2, this.color, 2, 26, 0.35, 2);
      }
    }
    // eye tracks the most threatening ball
    let tx = game.paddle.x, ty = game.paddle.y;
    let best = Infinity;
    for (const b of game.balls) { const d = U.dist2(b.x, b.y, this.x, this.y); if (d < best) { best = d; tx = b.x; ty = b.y; } }
    const ang = Math.atan2(ty - this.y, tx - this.x), lim = this.r * 0.24;
    this.eyeX = U.damp(this.eyeX, Math.cos(ang) * lim, 8, dt);
    this.eyeY = U.damp(this.eyeY, Math.sin(ang) * lim, 8, dt);
    // blinking
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = U.rand(2.5, 6); }
    this.blink = Math.max(0, this.blink - dt * 6);
    // attack
    if (game.state === 'play') this.fireT -= dt;
    this.charge = U.clamp(1 - this.fireT / 0.7, 0, 1);
    if (this.fireT <= 0) { this.fire(game); this.fireT = this.every * this.everyMul; }
    // phase changes
    const frac = this.hp / this.maxHp;
    const phases = this.cfg.phases || [];
    while (this.phaseIdx < phases.length && frac <= phases[this.phaseIdx].at) {
      const ph = phases[this.phaseIdx++];
      if (ph.attack) this.attack = ph.attack;
      if (ph.everyMul) this.everyMul *= ph.everyMul;
      if (ph.speedMul) this.speedMul *= ph.speedMul;
      if (ph.regenMul) this.regenMul *= ph.regenMul;
      if (ph.roar !== false) this.roar(game);
    }
  }
  enrage(game) { this.speedMul *= 1.45; this.everyMul *= 0.65; this.attack = 'spread3'; this.roar(game); }
  roar(game) {
    this.rage = 1;
    SW.audio.sfx('roar');
    SW.fx.shake(0.6);
    SW.fx.ring(this.x, this.y, this.color, this.r, this.r * 4, 0.7, 6);
    SW.fx.ring(this.x, this.y, '#ffffff', this.r, this.r * 3, 0.5, 2);
    game.banner(this.name + ' IS ENRAGED', this.color, 1.6);
  }
  fire(game) {
    if (game.state !== 'play') return;
    const sx = this.x + this.eyeX, sy = this.y + this.eyeY + this.r * 0.3;
    const base = Math.atan2(game.paddle.y - sy, game.paddle.x - sx);
    const n = this.attack === 'spread5' ? 5 : this.attack === 'spread3' ? 3 : 1;
    const step = n === 5 ? 0.24 : 0.3;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * step;
      game.orbs.push(new SW.Orb(sx, sy, Math.cos(a) * this.shotSpeed, Math.sin(a) * this.shotSpeed));
    }
    SW.fx.ring(sx, sy, '#ff2a55', 4, 34, 0.3, 3);
    SW.audio.sfx('shoot');
  }
  hit(dmg, game) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.flash = 1;
    if (this.hp <= 0) {
      this.hp = 0; this.dying = 2.3; this.boomT = 0;
      for (const ring of this.rings) for (const b of ring.bricks) if (b.alive) game.destroyBrick(b, null, true);
      game.onBossDying(this);
    }
    return true;
  }
  draw(g, t) {
    const r = this.r * U.easeOutBack(this.appear), x = this.x, y = this.y, C = SW.C;
    if (r <= 1) return;
    const dyingK = this.dying > 0 ? 1 - this.dying / 2.3 : 0;
    const jx = this.dying > 0 ? U.rand(-4, 4) * dyingK : 0, jy = this.dying > 0 ? U.rand(-4, 4) * dyingK : 0;
    const cx = x + jx, cy = y + jy;
    const rage = Math.max(this.rage, this.hp / this.maxHp < 0.34 ? 0.35 + 0.25 * Math.sin(t * 8) : 0);
    // aura
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.35 + this.charge * 0.35 + rage * 0.3;
    g.drawImage(SW.gfx.glow(rage > 0.3 ? '#ff2a2a' : this.color), cx - r * 3.2, cy - r * 3.2, r * 6.4, r * 6.4);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // armored shell (rotating plates)
    const rot = t * 0.4 * this.speedMul + this.shell;
    const plates = 8;
    for (let i = 0; i < plates; i++) {
      const a0 = rot + (i / plates) * U.TAU + 0.06, a1 = rot + ((i + 1) / plates) * U.TAU - 0.06;
      const grd = g.createLinearGradient(cx, cy - r * 1.2, cx, cy + r * 1.2);
      grd.addColorStop(0, '#3a3f5c'); grd.addColorStop(1, '#141626');
      g.fillStyle = grd;
      g.beginPath(); g.arc(cx, cy, r * 1.18, a0, a1); g.arc(cx, cy, r * 0.92, a1, a0, true); g.closePath(); g.fill();
      g.strokeStyle = C.rgba(this.color, 0.85); g.lineWidth = 1.5; g.stroke();
      // plate lights
      const am = (a0 + a1) / 2;
      g.fillStyle = (i + Math.floor(t * 4)) % plates === 0 ? '#ffffff' : this.color;
      g.beginPath(); g.arc(cx + Math.cos(am) * r * 1.05, cy + Math.sin(am) * r * 1.05, 2.2, 0, U.TAU); g.fill();
    }
    // sclera
    const sg = g.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.1, cx, cy, r * 0.92);
    sg.addColorStop(0, '#2a2140'); sg.addColorStop(1, '#07040f');
    g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, r * 0.9, 0, U.TAU); g.fill();
    // iris + pupil
    const ex = cx + this.eyeX, ey = cy + this.eyeY;
    const ir = r * (0.46 + this.charge * 0.08);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.6 + this.charge * 0.4;
    g.drawImage(SW.gfx.glow(this.iris), ex - ir * 2, ey - ir * 2, ir * 4, ir * 4);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const ig = g.createRadialGradient(ex, ey, ir * 0.2, ex, ey, ir);
    ig.addColorStop(0, C.lighten(this.iris, 0.7)); ig.addColorStop(0.6, this.iris); ig.addColorStop(1, C.darken(this.iris, 0.5));
    g.fillStyle = ig; g.beginPath(); g.arc(ex, ey, ir, 0, U.TAU); g.fill();
    // iris spokes
    g.strokeStyle = C.rgba(C.darken(this.iris, 0.6), 0.5); g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * U.TAU + t * 0.3; g.moveTo(ex + Math.cos(a) * ir * 0.45, ey + Math.sin(a) * ir * 0.45); g.lineTo(ex + Math.cos(a) * ir * 0.95, ey + Math.sin(a) * ir * 0.95); }
    g.stroke();
    const pw = ir * (0.22 + this.charge * 0.1), ph = ir * (0.62 - this.charge * 0.25);
    g.fillStyle = '#05020a';
    g.beginPath(); g.ellipse(ex, ey, pw, ph, 0, 0, U.TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(ex - ir * 0.35, ey - ir * 0.4, ir * 0.13, 0, U.TAU); g.fill();
    // cracks as health drops
    const dmg = 1 - this.hp / this.maxHp;
    if (dmg > 0.3) {
      g.strokeStyle = C.rgba(this.color, 0.8); g.lineWidth = 1.5;
      const n = Math.floor(dmg * 7);
      for (let i = 0; i < n; i++) {
        const a = i * 2.4 + 0.5;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
        g.lineTo(cx + Math.cos(a + 0.15) * r * 0.65, cy + Math.sin(a + 0.15) * r * 0.65);
        g.lineTo(cx + Math.cos(a - 0.1) * r * 0.5, cy + Math.sin(a - 0.1) * r * 0.5);
        g.stroke();
      }
    }
    // eyelids (blink)
    const lid = Math.max(this.blink > 0 ? Math.sin(this.blink * Math.PI) : 0, dyingK * 0.6);
    if (lid > 0.01) {
      g.fillStyle = '#1b1830';
      g.save(); g.beginPath(); g.arc(cx, cy, r * 0.91, 0, U.TAU); g.clip();
      g.fillRect(cx - r, cy - r, r * 2, r * lid);
      g.fillRect(cx - r, cy + r - r * lid, r * 2, r * lid);
      g.restore();
    }
    // rim + hit flash
    g.strokeStyle = rage > 0.3 ? '#ff4040' : C.lighten(this.color, 0.3); g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, r * 0.91, 0, U.TAU); g.stroke();
    if (this.flash > 0) {
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = this.flash * 0.8; g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(cx, cy, r * 1.18, 0, U.TAU); g.fill();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  }
};
