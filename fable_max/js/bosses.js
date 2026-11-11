'use strict';
/* ==========================================================================
   HADAL — the three guardians
   Each boss exposes: update(dt) · draw(ctx) · collide(ball) · hitShot(x,y)
   · blast(x,y,R) · lights(add) and the fields hp / maxHp / ready / dying / dead.
   ========================================================================== */

/* bounce a ball off a circle; returns the contact normal or null */
function bounceCircle(b, cx, cy, r) {
  const dx = b.x - cx, dy = b.y - cy, rr2 = r + b.r, d2 = dx * dx + dy * dy;
  if (d2 >= rr2 * rr2) return null;
  const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d;
  b.x = cx + nx * rr2; b.y = cy + ny * rr2;
  const dot = b.dx * nx + b.dy * ny;
  if (dot < 0) { b.dx -= 2 * dot * nx; b.dy -= 2 * dot * ny; }
  Game.fixAngle(b);
  b.idle = 0;
  return { nx, ny, x: b.x - nx * b.r, y: b.y - ny * b.r };
}

/* shared death throes: a string of small blasts, then one big one */
function bossDeath(B, dt, cx, cy, spread, col, label) {
  const g = Game;
  B.dying += dt;
  if (B.dying < 2.5) {
    B.boomT = (B.boomT || 0) - dt;
    if (B.boomT <= 0) {
      B.boomT = 0.2;
      const a = Math.random() * TAU, d = Math.random() * spread;
      const ex = cx + Math.cos(a) * d, ey = cy + Math.sin(a) * d * 0.8;
      FX.burst(ex, ey, col, 16, 320, 0.6, 3.8);
      FX.burst(ex, ey, '#ffffff', 6, 200, 0.3, 4);
      FX.ring(ex, ey, 8, 76, 0.4, '#ffffff', 3);
      FX.bubbles(ex, ey, 4, 50, 3.4);
      g.light(ex, ey, 260, 1, 0.5);
      Sound.play('explode', false);
      g.bump(0.42, 0);
    }
  } else if (!B.dead) {
    B.dead = true;
    FX.burst(cx, cy, col, 60, 560, 1.2, 5);
    FX.burst(cx, cy, '#ffffff', 30, 380, 0.8, 5);
    FX.spray(cx, cy, '#ffffff', 40, 900, 0.7, 0, TAU);
    FX.ring(cx, cy, 20, 480, 1.0, '#ffffff', 6);
    FX.ring(cx, cy, 10, 320, 0.8, col, 5);
    FX.ring(cx, cy, 10, 180, 0.6, '#ffffff', 4);
    FX.bubbles(cx, cy, 30, 300, 5);
    g.light(cx, cy, 900, 1, 1.4);
    g.flashScreen(0.7, '#ffffff');
    g.bump(1.2, 0.09);
    g.stage.lit = 99;
    Sound.play('explode', true);
    Sound.play('clear', Sound.root);
    FX.text(W / 2, 330, label, '#ffffff', 30, 2.2);
  }
}

const Bosses = {
  create(id) { return this[id](); },

  /* ====================================================================
     MEDUSA — queen of the twilight. A vast jelly that drifts, rains
     stingers and buds off small jellies.
     ==================================================================== */
  medusa() {
    return {
      id: 'medusa', name: 'Medusa', color: '#ff8fe0',
      hp: 24, maxHp: 24, x: W / 2, y: -180, r: 86,
      t: 0, mt: 0, flash: 0, ready: false, dying: 0, dead: false, dropAcc: 0,
      atkT: 3.4, spawnT: 6.5, tele: 0, phase2: false, roared: false,

      update(dt) {
        const g = Game;
        this.t += dt;
        this.flash = Math.max(0, this.flash - dt * 4);
        if (this.dying > 0) { bossDeath(this, dt, this.x, this.y, this.r, '#ff8fe0', 'MEDUSA DEFEATED'); return; }
        if (!this.ready) {
          const k = clamp(this.t / 2.4, 0, 1);
          this.y = lerp(-180, 225, easeOut(k));
          if (!this.roared && this.t > 0.3) { this.roared = true; Sound.play('roar'); g.bump(0.5, 0); }
          if (k >= 1) this.ready = true;
          return;
        }
        if (!this.phase2 && this.hp <= this.maxHp / 2) {
          this.phase2 = true;
          Sound.play('roar'); g.bump(0.7, 0); g.flashScreen(0.2, '#ff8fe0');
          FX.ring(this.x, this.y, 30, 320, 0.8, '#ff8fe0', 4);
        }
        this.mt += dt * (this.phase2 ? 1.5 : 1);
        this.x = W / 2 + Math.sin(this.mt * 0.55) * 235;
        this.y = 225 + Math.sin(this.mt * 0.9) * 36;
        if (g.phase !== 'live') return;
        if (this.tele > 0) {
          this.tele -= dt;
          if (this.tele <= 0) this.volley();
        } else {
          this.atkT -= dt;
          if (this.atkT <= 0) { this.tele = 0.6; this.atkT = this.phase2 ? 3.0 : 4.4; }
        }
        this.spawnT -= dt;
        if (this.spawnT <= 0) { this.spawnT = this.phase2 ? 8 : 11; this.bud(); }
      },

      volley() {
        const g = Game, p = g.paddle, n = this.phase2 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const o = i - (n - 1) / 2;
          const sx = this.x + o * 34, sy = this.y + 52;
          const vy = 250 + Math.random() * 50, tHit = (p.y - sy) / vy;
          const tx = clamp(p.x + o * 92 + rand(-30, 30), 10, W - 10);
          g.hazards.push({ kind: 'sting', x: sx, y: sy, vx: (tx - sx) / tHit, vy, r: 7, color: '#ff8fe0', t: 0, g: 0 });
        }
        Sound.play('jelly');
        FX.ring(this.x, this.y + 40, 20, 130, 0.4, '#ff8fe0', 3);
      },

      bud() {
        const g = Game;
        let n = 0;
        for (let i = 0; i < g.movers.length; i++) if (g.movers[i].type === 'jelly') n++;
        if (n >= 4) return;
        for (let s = -1; s <= 1; s += 2) {
          const row = 12 + Math.floor(Math.random() * 3);
          g.spawnMover('jelly', clamp(this.x + s * 60 - 25, 4, W - 56), this.y + 30, row, s * rand(50, 76), { hp: 1, maxHp: 1 });
        }
        Sound.play('jelly');
        FX.ring(this.x, this.y + 40, 10, 90, 0.4, '#ffc4f0', 2);
      },

      collide(b) {
        if (this.dying > 0 || this.dead) return false;
        const hit = bounceCircle(b, this.x, this.y - 8, this.r);
        if (!hit) return false;
        if (b.hitCd <= 0 && this.ready) {
          b.hitCd = 0.14;
          if (b.blast) { b.blast = false; Game.explode(hit.x, hit.y, 135, true); }
          else Game.bossDamage(this, Game.ballDamage(b), hit.x, hit.y);
        }
        return true;
      },
      hitShot(x, y) {
        if (this.dying > 0 || !this.ready) return false;
        const dx = x - this.x, dy = y - (this.y - 8);
        if (dx * dx + dy * dy > this.r * this.r) return false;
        Game.bossDamage(this, 1, x, y);
        return true;
      },
      blast(x, y, R) {
        if (this.dying > 0 || !this.ready) return;
        if (Math.hypot(x - this.x, y - (this.y - 8)) < R * 0.8 + this.r) Game.bossDamage(this, 3, x, y);
      },
      lights(add) { add(this.x, this.y, 260, 0.9); },

      bellPath(ctx, t) {
        ctx.beginPath();
        ctx.moveTo(-92, 40);
        ctx.bezierCurveTo(-106, -40, -60, -90, 0, -90);
        ctx.bezierCurveTo(60, -90, 106, -40, 92, 40);
        const n = 6, w = 184 / n;
        for (let i = 0; i < n; i++) {
          ctx.quadraticCurveTo(92 - (i + 0.5) * w, 62 + Math.sin(t * 3 + i * 1.3) * 5, 92 - (i + 1) * w, 40);
        }
        ctx.closePath();
      },

      draw(ctx) {
        if (this.dead) return;
        const t = this.t, x = this.x + (this.dying > 0 ? Math.sin(t * 46) * 3 : 0), y = this.y;
        const pul = Math.sin(t * 2.4), sx = 1 + pul * 0.05, sy = 1 - pul * 0.06;
        const col = this.phase2 ? '#ff5fb7' : '#ff8fe0', col2 = this.phase2 ? '#ff9a6b' : '#b78bff';
        const fade = this.dying > 0 ? clamp(1 - (this.dying - 1.9) / 0.6, 0, 1) : 1;
        const tele = this.tele > 0 ? 1 - this.tele / 0.6 : 0;

        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.42 + tele * 0.3) * fade * (0.82 + 0.18 * Sound.pulse());
        ctx.drawImage(Sprites.glow(col), x - 240, y - 220, 480, 440);
        // trailing tentacles
        ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const u = (i / 8) * 2 - 1;
          const bx = x + u * 80 * sx, by = y + 40 * sy - Math.abs(u) * 12;
          const len = 150 + (1 - Math.abs(u)) * 76 + Math.sin(i * 1.7) * 26;
          ctx.strokeStyle = i % 2 ? col : col2;
          let px = bx, py = by;
          for (let s = 1; s <= 9; s++) {
            const v = s / 9;
            const qx = bx + Math.sin(t * 2.1 - v * 4.2 + i * 0.9) * (6 + v * 26) + u * v * 18;
            const qy = by + v * len;
            ctx.globalAlpha = (1 - v) * 0.55 * fade;
            ctx.lineWidth = 5 * (1 - v) + 1;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
            px = qx; py = qy;
          }
        }
        ctx.globalCompositeOperation = 'source-over';

        ctx.save();
        ctx.translate(x, y - 8); ctx.scale(sx, sy);
        const g = ctx.createRadialGradient(-22, -44, 6, 0, -6, 110);
        g.addColorStop(0, 'rgba(255,255,255,0.96)');
        g.addColorStop(0.28, rgba(col, 0.88));
        g.addColorStop(0.75, rgba(col2, 0.66));
        g.addColorStop(1, rgba(col2, 0.42));
        ctx.globalAlpha = fade;
        ctx.fillStyle = g;
        this.bellPath(ctx, t); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2; ctx.stroke();
        // radial canals
        ctx.globalAlpha = 0.22 * fade; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath(); ctx.moveTo(i * 5, -70); ctx.quadraticCurveTo(i * 22, -20, i * 27, 38); ctx.stroke();
        }
        // four-leaf heart, like a moon jelly
        ctx.globalAlpha = 0.6 * fade; ctx.lineWidth = 2.4;
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + Math.PI / 4;
          ctx.beginPath(); ctx.ellipse(Math.cos(a) * 20, -26 + Math.sin(a) * 15, 15, 11, a, 0, TAU); ctx.stroke();
        }
        if (this.flash > 0) {
          ctx.globalAlpha = this.flash * 0.75 * fade; ctx.fillStyle = '#ffffff';
          this.bellPath(ctx, t); ctx.fill();
        }
        ctx.restore();

        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.6 + 0.3 * Math.sin(t * 5) + tele) * fade;
        ctx.drawImage(Sprites.glow('#ffffff'), x - 40, y - 74, 80, 80);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      },
    };
  },

  /* ====================================================================
     THE LANTERN — an anglerfish the size of a house, in total darkness.
     Its dangling lure is the only real light, and its weak point.
     ==================================================================== */
  lantern() {
    return {
      id: 'lantern', name: 'The Lantern', color: '#b6ffc0',
      hp: 44, maxHp: 44, x: W / 2, y: -250, rx: 126, ry: 98,
      t: 0, mt: 0, flash: 0, ready: false, dying: 0, dead: false, dropAcc: 0, roared: false,
      lure: { x: W / 2, y: -100, r: 20, glow: 1, flash: 0 },
      stun: 0, mouth: 0.25, anger: 0, phase2: false,
      spitT: 4.5, swarmT: 8, darkT: 13, dark: 0, lunge: 0, lungeT: 8,

      placeLure() {
        const l = this.lure;
        l.x = this.x + Math.sin(this.t * 1.15) * 150;
        l.y = this.y + this.ry + 44 + Math.cos(this.t * 2.3) * 14;
      },

      update(dt) {
        const g = Game;
        this.t += dt;
        this.flash = Math.max(0, this.flash - dt * 4);
        this.lure.flash = Math.max(0, this.lure.flash - dt * 2.5);
        if (this.dying > 0) {
          this.mouth = approach(this.mouth, 1, 6, dt);
          this.placeLure();
          bossDeath(this, dt, this.x, this.y, this.rx, '#b6ffc0', 'THE LANTERN GOES DARK');
          return;
        }
        if (!this.ready) {
          const k = clamp(this.t / 2.7, 0, 1);
          this.y = lerp(-250, 215, easeOut(k));
          if (!this.roared && this.t > 0.4) { this.roared = true; Sound.play('roar'); g.bump(0.55, 0); }
          if (k >= 1) this.ready = true;
          this.placeLure();
          return;
        }
        if (!this.phase2 && this.hp <= this.maxHp / 2) {
          this.phase2 = true;
          Sound.play('roar'); g.bump(0.7, 0);
          FX.ring(this.x, this.y, 40, 360, 0.8, '#ff5a5a', 4);
        }
        if (this.stun > 0) {
          this.stun -= dt;
          this.mouth = approach(this.mouth, 1, 8, dt);
        } else {
          this.mt += dt * (this.phase2 ? 1.3 : 1);
          this.mouth = approach(this.mouth, 0.28 + 0.2 * Math.sin(this.t * 1.7) + this.anger * 0.5, 6, dt);
        }
        let ly = 0;
        if (this.lunge > 0) {
          this.lunge += dt;
          const L = this.lunge;
          if (L < 0.9) { this.anger = 1; ly = -16 * Math.sin(L / 0.9 * Math.PI); }
          else if (L < 1.25) ly = easeIn((L - 0.9) / 0.35) * 250;
          else if (L < 1.55) ly = 250;
          else if (L < 2.4) ly = (1 - easeInOut((L - 1.55) / 0.85)) * 250;
          else { this.lunge = 0; this.anger = 0; }
        }
        this.x = W / 2 + Math.sin(this.mt * 0.42) * 165;
        this.y = 215 + Math.sin(this.mt * 0.7) * 20 + ly;
        this.placeLure();
        if (this.dark > 0) this.dark -= dt;
        this.lure.glow = approach(this.lure.glow, this.dark > 0 ? 0.06 : 1, 4, dt);

        if (g.phase !== 'live' || this.stun > 0) return;
        this.spitT -= dt;
        if (this.spitT <= 0) { this.spitT = this.phase2 ? 3.6 : 5.2; this.spit(); }
        this.swarmT -= dt;
        if (this.swarmT <= 0) { this.swarmT = this.phase2 ? 7.5 : 10; this.swarm(); }
        this.darkT -= dt;
        if (this.darkT <= 0) { this.darkT = this.phase2 ? 11 : 15; this.dark = 3.2; Sound.play('sonarOff'); }
        if (this.phase2 && this.lunge <= 0) {
          this.lungeT -= dt;
          if (this.lungeT <= 0) { this.lungeT = rand(8, 11); this.lunge = 0.0001; Sound.play('roar'); Sound.play('warn'); }
        }
      },

      spit() {
        const g = Game, p = g.paddle, sx = this.x, sy = this.y + 44;
        for (let i = -1; i <= 1; i++) {
          const vy = 230 + Math.random() * 40, tHit = Math.max(0.6, (p.y - sy) / vy);
          const tx = clamp(p.x + i * 132 + rand(-25, 25), 10, W - 10);
          g.hazards.push({ kind: 'blob', x: sx + i * 26, y: sy, vx: (tx - sx - i * 26) / tHit, vy, r: 10, color: '#8a5cff', t: 0, g: 0 });
        }
        this.mouth = 1;
        Sound.play('ink');
      },

      swarm() {
        const g = Game, dir = Math.random() < 0.5 ? 1 : -1;
        const row = 12 + Math.floor(Math.random() * 5);
        for (let i = 0; i < 5; i++) {
          const y = BRICK_TOP + row * CELL_H + 4 + Math.sin(i * 1.3) * 10;
          const m = g.spawnMover('fish', dir > 0 ? -60 - i * 72 : W + 20 + i * 72, y, row, dir * 125, { w: 42, h: 20, fly: true });
          m.ty = m.y;
        }
      },

      lureHit(b, x, y) {
        const g = Game, l = this.lure;
        this.stun = 2.2; this.dark = 0; l.flash = 1;
        g.stage.lit = 4.5;
        g.flashScreen(0.42, '#eaffb0');
        FX.ring(l.x, l.y, 10, 440, 0.8, '#eaffb0', 4);
        FX.text(l.x, l.y - 40, 'DAZZLED', '#eaffb0', 17, 1.3);
        Sound.play('zap');
        g.bossDamage(this, 2 + g.ballDamage(b), x, y);
      },

      collide(b) {
        if (this.dying > 0 || this.dead) return false;
        const l = this.lure;
        const lh = bounceCircle(b, l.x, l.y, l.r);
        if (lh) {
          if (b.hitCd <= 0 && this.ready) { b.hitCd = 0.2; b.blast = false; this.lureHit(b, lh.x, lh.y); }
          return true;
        }
        const ex = this.rx + b.r, ey = this.ry + b.r;
        const px = (b.x - this.x) / ex, py = (b.y - this.y) / ey, q = px * px + py * py;
        if (q >= 1) return false;
        let nx = px / ex, ny = py / ey;
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const s = Math.sqrt(q) || 0.001;
        b.x = this.x + (b.x - this.x) / s; b.y = this.y + (b.y - this.y) / s;
        const dot = b.dx * nx + b.dy * ny;
        if (dot < 0) { b.dx -= 2 * dot * nx; b.dy -= 2 * dot * ny; }
        Game.fixAngle(b); b.idle = 0;
        if (b.hitCd <= 0 && this.ready) {
          b.hitCd = 0.14;
          const cx = b.x - nx * b.r, cy = b.y - ny * b.r;
          if (b.blast) { b.blast = false; Game.explode(cx, cy, 135, true); }
          else Game.bossDamage(this, Game.ballDamage(b), cx, cy);
        }
        return true;
      },
      hitShot(x, y) {
        if (this.dying > 0 || !this.ready) return false;
        const l = this.lure;
        if (Math.hypot(x - l.x, y - l.y) < l.r + 4) { Game.bossDamage(this, 1, x, y); l.flash = 0.6; return true; }
        const px = (x - this.x) / this.rx, py = (y - this.y) / this.ry;
        if (px * px + py * py > 1) return false;
        Game.bossDamage(this, 1, x, y);
        return true;
      },
      blast(x, y, R) {
        if (this.dying > 0 || !this.ready) return;
        if (Math.hypot(x - this.x, y - this.y) < R * 0.8 + 105) Game.bossDamage(this, 3, x, y);
      },
      lights(add) {
        const l = this.lure, gl = l.glow + l.flash;
        add(l.x, l.y, 60 + 190 * Math.min(1.3, gl) * (0.94 + 0.06 * Math.sin(this.t * 13)), Math.min(1, 0.35 + gl));
        add(this.x - 50, this.y - 26, 50, 0.6);
        add(this.x + 50, this.y - 26, 50, 0.6);
        if (this.flash > 0) add(this.x, this.y, 240, this.flash);
      },

      draw(ctx) {
        if (this.dead) return;
        const t = this.t, shiver = (this.stun > 0 || this.dying > 0) ? Math.sin(t * 50) * 2.5 : 0;
        const x = this.x + shiver, y = this.y;
        const fade = this.dying > 0 ? clamp(1 - (this.dying - 1.9) / 0.6, 0, 1) : 1;
        const angry = this.anger > 0.5 || this.phase2;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(x, y);

        // side fins
        const flap = Math.sin(t * 3) * 0.22;
        ctx.fillStyle = '#0d1628';
        for (let s = -1; s <= 1; s += 2) {
          ctx.save();
          ctx.translate(s * (this.rx - 16), 4); ctx.rotate(s * (0.35 + flap));
          ctx.beginPath(); ctx.moveTo(0, -16);
          ctx.quadraticCurveTo(s * 64, -34, s * 78, 12);
          ctx.quadraticCurveTo(s * 40, 4, 0, 20);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(110,160,210,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.restore();
        }
        // dorsal spines
        ctx.fillStyle = '#0d1628';
        for (let i = -3; i <= 3; i++) {
          if (i === 0) continue;
          const a = -Math.PI / 2 + i * 0.26;
          const bx = Math.cos(a) * this.rx, by = Math.sin(a) * this.ry;
          ctx.beginPath();
          ctx.moveTo(bx - 9, by + 5); ctx.lineTo(bx + Math.cos(a) * 26, by + Math.sin(a) * 26 + Math.sin(t * 2 + i) * 2); ctx.lineTo(bx + 9, by + 5);
          ctx.closePath(); ctx.fill();
        }
        // body
        const g = ctx.createRadialGradient(-34, -52, 10, 0, 0, this.rx * 1.12);
        g.addColorStop(0, '#34466c'); g.addColorStop(0.55, '#162038'); g.addColorStop(1, '#070b16');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(0, 0, this.rx, this.ry, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(130,180,230,0.4)'; ctx.lineWidth = 2; ctx.stroke();
        // mottled skin
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        const spots = [[-80, -8, 9], [-64, 46, 7], [78, 2, 10], [60, 50, 6], [-20, -70, 8], [30, -66, 6], [96, -30, 5], [-98, -34, 5]];
        for (let i = 0; i < spots.length; i++) { ctx.beginPath(); ctx.arc(spots[i][0], spots[i][1], spots[i][2], 0, TAU); ctx.fill(); }

        // mouth
        const mo = clamp(this.mouth, 0, 1.1), mw = 90, my = 30, mh = 14 + mo * 40;
        ctx.fillStyle = '#12030a';
        ctx.beginPath(); ctx.moveTo(-mw, my);
        ctx.quadraticCurveTo(0, my - 14, mw, my);
        ctx.quadraticCurveTo(0, my + mh * 2, -mw, my);
        ctx.closePath(); ctx.fill();
        const mg = ctx.createRadialGradient(0, my + mh * 0.5, 2, 0, my + mh * 0.5, 70);
        mg.addColorStop(0, 'rgba(200,40,60,' + (0.35 + 0.4 * mo) + ')'); mg.addColorStop(1, 'rgba(200,40,60,0)');
        ctx.fillStyle = mg; ctx.fill();
        // needle teeth
        ctx.fillStyle = '#eef4dc';
        const N = 9;
        for (let i = 0; i < N; i++) {
          const u = (i + 0.5) / N, tx = lerp(-mw, mw, u), arch = Math.sin(u * Math.PI);
          const ty = my - 28 * u * (1 - u);
          const len = (9 + 17 * arch) * (0.55 + mo * 0.5) * (i % 2 ? 1 : 0.68);
          ctx.beginPath(); ctx.moveTo(tx - 5.5, ty - 1); ctx.lineTo(tx + 5.5, ty - 1); ctx.lineTo(tx + (u - 0.5) * 8, ty + len); ctx.closePath(); ctx.fill();
          const by = my + 4 * mh * u * (1 - u);
          const len2 = (8 + 15 * arch) * (0.55 + mo * 0.5) * (i % 2 ? 0.68 : 1);
          ctx.beginPath(); ctx.moveTo(tx - 5.5, by + 1); ctx.lineTo(tx + 5.5, by + 1); ctx.lineTo(tx - (u - 0.5) * 8, by - len2); ctx.closePath(); ctx.fill();
        }

        // eyes follow the pearl
        let lookX = 0, lookY = 1;
        const ball = Game.balls.length ? Game.balls[0] : null;
        if (ball) { const dx = ball.x - this.x, dy = ball.y - this.y, dl = Math.hypot(dx, dy) || 1; lookX = dx / dl; lookY = dy / dl; }
        for (let s = -1; s <= 1; s += 2) {
          const ex = s * 50, ey = -26;
          ctx.fillStyle = '#05080f'; ctx.beginPath(); ctx.arc(ex, ey, 14, 0, TAU); ctx.fill();
          if (this.stun > 0) {
            ctx.strokeStyle = '#eaffb0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ex - 6, ey - 6); ctx.lineTo(ex + 6, ey + 6); ctx.moveTo(ex + 6, ey - 6); ctx.lineTo(ex - 6, ey + 6); ctx.stroke();
          } else {
            ctx.fillStyle = angry ? '#ff5a5a' : '#c8fbff';
            ctx.beginPath(); ctx.arc(ex, ey, 9.5, 0, TAU); ctx.fill();
            ctx.fillStyle = '#04070d';
            ctx.beginPath(); ctx.arc(ex + lookX * 3.6, ey + lookY * 3.6, 4.4, 0, TAU); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath(); ctx.arc(ex - 3, ey - 3.4, 1.8, 0, TAU); ctx.fill();
          }
          // heavy brow
          ctx.strokeStyle = '#05080f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(ex - s * 15, ey - 15 - (angry ? 0 : 3)); ctx.lineTo(ex + s * 13, ey - 9 + (angry ? 5 : 0)); ctx.stroke();
        }
        if (this.flash > 0) {
          ctx.globalAlpha = this.flash * 0.5 * fade; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.ellipse(0, 0, this.rx, this.ry, 0, 0, TAU); ctx.fill();
          ctx.globalAlpha = fade;
        }
        ctx.restore();

        // the rod and the lure
        const l = this.lure, sx0 = x, sy0 = y - this.ry + 8, dxl = l.x - x;
        ctx.globalAlpha = fade;
        ctx.strokeStyle = '#22324e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx0, sy0);
        ctx.bezierCurveTo(sx0 + dxl * 0.5, sy0 - 130, l.x + dxl * 0.45, y - 40, l.x, l.y - l.r + 4);
        ctx.stroke();
        const gl = Math.min(1.4, l.glow + l.flash);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, 0.2 + gl * 0.7) * fade;
        const gs = 70 + gl * 90;
        ctx.drawImage(Sprites.glow('#d8ff9a'), l.x - gs, l.y - gs, gs * 2, gs * 2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = fade;
        const lg = ctx.createRadialGradient(l.x - 5, l.y - 6, 1, l.x, l.y, l.r);
        lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.5, mix('#31523a', '#eaffb0', clamp(gl, 0, 1))); lg.addColorStop(1, mix('#14251c', '#7dff8a', clamp(gl, 0, 1)));
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.globalAlpha = 1;
      },
    };
  },

  /* ====================================================================
     LEVIATHAN — an armoured serpent coiled at the bottom of the world.
     Every plate you break shortens it; the head can always be struck, and
     once the last plate is gone it takes double damage.
     ==================================================================== */
  leviathan() {
    const N = 12, segs = [];
    for (let i = 0; i < N; i++) segs.push({ hp: 2, r: lerp(29, 17, i / (N - 1)), x: W / 2, y: -200, lag: 0.2 + (i + 1) * 0.17, flash: 0, alive: true });
    return {
      id: 'leviathan', name: 'Leviathan', color: '#ff7043',
      hp: N * 2 + 40, maxHp: N * 2 + 40, segs, x: W / 2, y: -200, r: 38, ang: Math.PI / 2,
      t: 0, mt: 0, flash: 0, ready: false, dying: 0, dead: false, dropAcc: 0, phase2: false,
      spitT: 4, popT: 0, roared: false, jaw: 0, exposed: false,

      path(tt) {
        if (this.phase2) return { x: W / 2 + 300 * Math.sin(tt * 0.9), y: 262 + 140 * Math.sin(tt * 1.55 + 0.6) };
        return { x: W / 2 + 315 * Math.sin(tt * 0.6), y: 245 + 118 * Math.sin(tt * 1.2 + 0.6) };
      },
      aliveSegs() { let n = 0; for (let i = 0; i < this.segs.length; i++) if (this.segs[i].alive) n++; return n; },

      update(dt) {
        const g = Game;
        this.t += dt;
        this.flash = Math.max(0, this.flash - dt * 4);
        this.jaw = Math.max(0, this.jaw - dt * 2);
        if (this.dying > 0) {
          // the remaining plates burst one by one, tail first
          this.popT -= dt;
          if (this.popT <= 0) {
            this.popT = 0.13;
            for (let i = this.segs.length - 1; i >= 0; i--) {
              const s = this.segs[i];
              if (!s.alive) continue;
              s.alive = false;
              FX.burst(s.x, s.y, '#ff8a3c', 14, 300, 0.5, 4);
              FX.ring(s.x, s.y, 6, 64, 0.35, '#ffd9a0', 3);
              FX.shards(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2, '#4a2418', 6, 0, 0);
              break;
            }
          }
          this.x += Math.sin(this.t * 44) * 2.2;
          bossDeath(this, dt, this.x, this.y, 70, '#ff8a3c', 'LEVIATHAN FALLS');
          return;
        }
        const k = clamp(this.t / 3, 0, 1);
        if (!this.ready) {
          if (!this.roared && this.t > 0.4) { this.roared = true; Sound.play('roar'); g.bump(0.6, 0); }
          if (k >= 1) this.ready = true;
        }
        if (!this.phase2 && this.hp <= this.maxHp / 2) {
          this.phase2 = true; this.spitT = Math.min(this.spitT, 2);
          Sound.play('roar'); g.bump(0.8, 0.05); g.flashScreen(0.26, '#ff7043');
          FX.ring(this.x, this.y, 30, 340, 0.8, '#ff7043', 4);
        }
        const off = (1 - easeOut(k)) * -560;
        this.mt += dt;
        const h = this.path(this.mt), ox = this.x, oy = this.y;
        this.x = approach(this.x, h.x, 9, dt);
        this.y = approach(this.y, h.y + off, 9, dt);
        const vx = this.x - ox, vy = this.y - oy;
        if (vx * vx + vy * vy > 1e-6) this.ang = Math.atan2(vy, vx);
        let idx = 0;
        for (let i = 0; i < this.segs.length; i++) {
          const s = this.segs[i];
          if (!s.alive) continue;
          idx++;
          s.lag = approach(s.lag, 0.2 + idx * 0.17, 4, dt);
          const q = this.path(this.mt - s.lag);
          s.x = approach(s.x, q.x, 12, dt);
          s.y = approach(s.y, q.y + off, 12, dt);
          s.flash = Math.max(0, s.flash - dt * 4);
        }
        if (g.phase !== 'live') return;
        this.spitT -= dt;
        if (this.spitT <= 0) { this.spitT = this.phase2 ? 2.7 : 4.2; this.spit(); }
      },

      spit() {
        const g = Game, p = g.paddle, n = this.phase2 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const o = i - (n - 1) / 2;
          const vy = 270 + Math.random() * 30, tHit = Math.max(0.6, (p.y - this.y) / vy);
          const tx = clamp(p.x + o * 150 + rand(-30, 30), 10, W - 10);
          g.hazards.push({ kind: 'magma', x: this.x, y: this.y + 10, vx: (tx - this.x) / tHit, vy, r: 10, color: '#ff8a3c', t: 0, g: 0 });
        }
        this.jaw = 1;
        Sound.play('hot');
        FX.burst(this.x, this.y, '#ffb347', 10, 210, 0.4, 3);
      },

      hurtSeg(s, n, x, y) {
        const g = Game;
        if (!s.alive || g.phase !== 'live') return;
        const dealt = Math.min(n, s.hp);
        s.hp -= dealt; s.flash = 1;
        if (s.hp <= 0) {
          s.alive = false;
          FX.shards(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2, '#4a2418', 10, 0, 0);
          FX.burst(s.x, s.y, '#ff8a3c', 18, 330, 0.6, 4);
          FX.ring(s.x, s.y, 6, 74, 0.4, '#ffd9a0', 3);
          Sound.play('crack');
          g.addScore(150, s.x, s.y - 22, '#ffd76b');
        }
        g.bossDamage(this, dealt, x, y);
        if (!this.exposed && this.aliveSegs() === 0 && this.hp > 0) {
          this.exposed = true;
          g.flashScreen(0.3, '#ffd76b');
          Sound.play('lock');
          FX.text(W / 2, 330, 'HEAD EXPOSED  ·  DOUBLE DAMAGE', '#ffd76b', 19, 2.4);
        }
      },

      headHit(n, x, y) {
        this.jaw = 0.7;
        Game.bossDamage(this, this.exposed ? n * 2 : n, x, y);
      },

      collide(b) {
        if (this.dying > 0 || this.dead) return false;
        // deepest overlapping circle wins
        let best = null, bp = 0, d, pen;
        for (let i = 0; i < this.segs.length; i++) {
          const s = this.segs[i];
          if (!s.alive) continue;
          d = Math.hypot(b.x - s.x, b.y - s.y); pen = s.r + b.r - d;
          if (pen > bp) { best = s; bp = pen; }
        }
        if (!best) {
          d = Math.hypot(b.x - this.x, b.y - this.y);
          if (this.r + b.r - d > 0) best = this;
        }
        if (!best) return false;
        const hit = bounceCircle(b, best.x, best.y, best.r);
        if (!hit) return false;
        if (b.hitCd <= 0 && this.ready) {
          b.hitCd = 0.1;
          if (b.blast) { b.blast = false; Game.explode(hit.x, hit.y, 135, true); }
          else if (best === this) this.headHit(Game.ballDamage(b), hit.x, hit.y);
          else this.hurtSeg(best, Game.ballDamage(b), hit.x, hit.y);
        }
        return true;
      },
      hitShot(x, y) {
        if (this.dying > 0 || !this.ready) return false;
        for (let i = 0; i < this.segs.length; i++) {
          const s = this.segs[i];
          if (s.alive && Math.hypot(x - s.x, y - s.y) < s.r) { this.hurtSeg(s, 1, x, y); return true; }
        }
        if (Math.hypot(x - this.x, y - this.y) < this.r) { this.headHit(1, x, y); return true; }
        return false;
      },
      blast(x, y, R) {
        if (this.dying > 0 || !this.ready) return;
        const list = this.segs.filter((s) => s.alive && Math.hypot(x - s.x, y - s.y) < R * 0.8 + s.r);
        for (let i = 0; i < list.length; i++) this.hurtSeg(list[i], 2, list[i].x, list[i].y);
        if (Math.hypot(x - this.x, y - this.y) < R * 0.8 + this.r) this.headHit(list.length ? 2 : 3, x, y);
      },
      lights(add) { add(this.x, this.y, 180, 0.8); },

      draw(ctx) {
        if (this.dead) return;
        const t = this.t, beat = Sound.pulse();
        const fade = this.dying > 0 ? clamp(1 - (this.dying - 1.9) / 0.6, 0, 1) : 1;
        const alive = [];
        for (let i = 0; i < this.segs.length; i++) if (this.segs[i].alive) alive.push(this.segs[i]);

        ctx.globalCompositeOperation = 'lighter';
        const glow = Sprites.glow('#ff5a1f');
        for (let i = 0; i < alive.length; i++) {
          const s = alive[i];
          ctx.globalAlpha = (0.26 + 0.1 * beat + s.flash * 0.4) * fade;
          ctx.drawImage(glow, s.x - s.r * 2.5, s.y - s.r * 2.5, s.r * 5, s.r * 5);
        }
        ctx.globalAlpha = (0.4 + 0.15 * beat + (this.phase2 ? 0.25 : 0)) * fade;
        ctx.drawImage(glow, this.x - 120, this.y - 120, 240, 240);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = fade;

        for (let i = alive.length - 1; i >= 0; i--) {
          const s = alive[i], prev = i === 0 ? this : alive[i - 1];
          const a = Math.atan2(prev.y - s.y, prev.x - s.x);
          const hurt = s.hp < 2;
          ctx.save();
          ctx.translate(s.x, s.y); ctx.rotate(a);
          ctx.fillStyle = '#35120b';
          for (let m = -1; m <= 1; m += 2) {
            ctx.beginPath();
            ctx.moveTo(-s.r * 0.55, m * s.r * 0.8); ctx.lineTo(-s.r * 1.0, m * s.r * 1.75); ctx.lineTo(s.r * 0.4, m * s.r * 0.86);
            ctx.closePath(); ctx.fill();
          }
          const g = ctx.createRadialGradient(-s.r * 0.3, -s.r * 0.35, 2, 0, 0, s.r);
          g.addColorStop(0, hurt ? '#8a4020' : '#5c4c56'); g.addColorStop(0.7, '#261a22'); g.addColorStop(1, '#0d0a10');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); ctx.fill();
          ctx.strokeStyle = hurt ? '#ffd27a' : 'rgba(255,140,70,0.75)'; ctx.lineWidth = hurt ? 2.4 : 1.6; ctx.stroke();
          ctx.strokeStyle = hurt ? '#fff0b0' : 'rgba(255,120,50,0.85)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(s.r * 0.95, 0, s.r * 1.12, Math.PI * 0.72, Math.PI * 1.28); ctx.stroke();
          if (hurt) {
            ctx.strokeStyle = '#fff0b0'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(-s.r * 0.5, -s.r * 0.5); ctx.lineTo(-s.r * 0.1, -s.r * 0.05); ctx.lineTo(-s.r * 0.5, s.r * 0.3); ctx.lineTo(0, s.r * 0.6); ctx.stroke();
          }
          if (s.flash > 0) {
            ctx.globalAlpha = s.flash * 0.8 * fade; ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); ctx.fill();
            ctx.globalAlpha = fade;
          }
          ctx.restore();
        }

        // head
        const R = this.r, exposed = this.exposed;
        ctx.save();
        ctx.translate(this.x, this.y); ctx.rotate(this.ang);
        // swept horns
        ctx.fillStyle = '#3a140c';
        for (let m = -1; m <= 1; m += 2) {
          ctx.beginPath();
          ctx.moveTo(-R * 0.3, m * R * 0.8); ctx.quadraticCurveTo(-R * 1.2, m * R * 1.5, -R * 1.9, m * R * 1.2);
          ctx.quadraticCurveTo(-R * 1.2, m * R * 0.95, -R * 0.8, m * R * 0.5);
          ctx.closePath(); ctx.fill();
        }
        const jaw = this.jaw * 0.28 + 0.06 + 0.04 * Math.sin(t * 3);
        for (let m = -1; m <= 1; m += 2) {                       // upper and lower jaw halves
          ctx.save(); ctx.rotate(m * jaw);
          const hg = ctx.createLinearGradient(0, 0, 0, m * R);
          hg.addColorStop(0, exposed ? '#8a3a1c' : '#4a3038'); hg.addColorStop(1, '#120b10');
          ctx.fillStyle = hg;
          ctx.beginPath();
          ctx.moveTo(R * 1.4, 0);
          ctx.quadraticCurveTo(R * 0.9, m * R * 0.98, -R * 0.2, m * R * 1.04);
          ctx.quadraticCurveTo(-R * 1.12, m * R * 0.8, -R * 1.02, 0);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = exposed ? '#ffd27a' : 'rgba(255,140,70,0.85)'; ctx.lineWidth = 2; ctx.stroke();
          // teeth along the jaw line
          ctx.fillStyle = '#ffe9c0';
          for (let q = 0; q < 4; q++) {
            const tx = R * (1.15 - q * 0.26);
            ctx.beginPath(); ctx.moveTo(tx, 0); ctx.lineTo(tx - R * 0.09, m * R * 0.02); ctx.lineTo(tx - R * 0.05, -m * R * 0.17); ctx.closePath(); ctx.fill();
          }
          // eye
          ctx.fillStyle = exposed ? '#fff3b0' : '#ffb347';
          ctx.beginPath(); ctx.ellipse(R * 0.3, m * R * 0.5, R * 0.2, R * 0.11, m * -0.35, 0, TAU); ctx.fill();
          ctx.fillStyle = '#1a0500';
          ctx.beginPath(); ctx.ellipse(R * 0.34, m * R * 0.5, R * 0.05, R * 0.1, m * -0.35, 0, TAU); ctx.fill();
          ctx.restore();
        }
        // furnace in the throat
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.35 + this.jaw * 0.6 + (exposed ? 0.3 : 0)) * fade;
        ctx.drawImage(Sprites.glow('#ffb347'), R * 0.2, -R * 0.6, R * 1.2, R * 1.2);
        ctx.globalCompositeOperation = 'source-over';
        if (this.flash > 0) {
          ctx.globalAlpha = this.flash * 0.7 * fade; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      },
    };
  },
};
