/* SHATTERWAVE — per-frame simulation & collisions */
'use strict';
SW.SHIELD_Y = 914;
Object.assign(SW.game, {
  update(rdt) {
    if (this.paused) return;
    SW.bg.update(rdt);
    this.stateT += rdt;
    for (const bn of this.banners) bn.t += rdt;
    this.banners = this.banners.filter((b) => b.t < b.dur);
    this.pulseFlash = Math.max(0, this.pulseFlash - rdt * 2);
    const diff = this.score - this.shownScore;
    this.shownScore = diff > 0 ? Math.min(this.score, this.shownScore + Math.max(7, diff * rdt * 7)) : this.score;
    if (this.hitstop > 0) { this.hitstop -= rdt; SW.fx.update(0, rdt); return; }
    if (this.slowT > 0) { this.slowT -= rdt; this.timeScale = this.slowK; } else this.timeScale = U.approach(this.timeScale, 1, rdt * 2.5);
    const dt = rdt * this.timeScale;
    this.t += dt;
    const I = SW.input;
    const zt = this.state === 'clear' && this.stateT < 1.25 ? 1 : 0;
    this.zoom.k = U.damp(this.zoom.k, zt, zt ? 5 : 3, rdt);

    // input
    if (!this.demo) {
      if (I.pulse) this.firePulse();
      if (I.action) this.onAction();
      else if (this.pw.laser > 0 && (I.actionHeld || I.padHeld) && this.state === 'play') this.tryLaser();
    } else if ((this.state === 'serve' && this.stateT > 0.7) || this.state === 'play') {
      for (const b of this.balls) if (b.stuck) this.launch(b);
      if (this.state === 'serve') this.setState('play');
    }

    // state machine
    const st = this.state;
    if (st === 'intro' && this.stateT > 1.0) this.setState('serve');
    else if (st === 'clear') {
      if (this.stateT > 1.2 && this.balls.length) {
        for (const b of this.balls) { SW.fx.glow(b.x, b.y, '#ffffff', 40, 0.4); SW.fx.sparks(b.x, b.y, SW.bg.accent(), 10, 200); }
        this.balls.length = 0;
        for (const c of this.capsules) SW.fx.glow(c.x, c.y, SW.POWERS[c.type].color, 40, 0.4);
        this.capsules.length = 0; this.lasers.length = 0;
      }
      if (this.stateT > 1.8) this.startTally();
    } else if (st === 'tally') {
      const T = this.tally;
      const shown = Math.min(T.lines.length + 1, Math.floor((this.stateT - 0.3) / 0.45) + 1);
      if (shown > T.shown) { T.shown = shown; if (shown <= T.lines.length + 1) SW.audio.sfx('tick'); }
      const target = T.lines.slice(0, Math.min(T.shown, T.lines.length)).reduce((s, l) => s + l[1], 0);
      if (T.added < target) { const add = Math.min(target - T.added, Math.ceil(rdt * 9000)); T.added += add; this.addScore(add); }
      if (this.stateT > 4.4 || (this.demo && this.stateT > 1.5)) this.nextLevel();
    } else if ((st === 'play' || st === 'serve') && (this.bosses.length ? this.bosses.every((b) => b.dead) : this.remaining() === 0)) {
      this.beginClear(SW.W / 2, 320);
    } else if (st === 'dying' && this.stateT > 1.6) {
      if (this.demo || this.lives > 0) this.respawn();
      else this.finish(false);
    }

    // world
    this.paddle.update(dt, this);
    for (const b of this.bricks) if (b.alive) b.update(dt, this.t);
    for (const bo of this.bosses) if (!bo.dead) bo.update(dt, this);
    this.updateBalls(dt);
    this.updateProjectiles(dt);
    if (this.state === 'play' || this.state === 'serve') {
      this.updateTimers(dt);
      this.levelTime += dt;
      if (this.stats && !this.demo) this.stats.time += dt;
    }
    if (this.chainT > 0) { this.chainT -= dt; if (this.chainT <= 0) { this.chain = 0; this.mult = 1; } }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const bl = this.blasts[i]; bl.t -= dt;
      if (bl.t <= 0) { this.blasts.splice(i, 1); this.explode(bl.x, bl.y); }
    }
    if (!this.demo && this.state !== 'over') {
      const want = this.bosses.length || this.mult >= 4 || this.waves.length || this.pw.fire > 0 ? 2 : 1;
      if (want !== this.musicLevel) { this.musicLevel = want; SW.audio.intensity(want); }
    }
    if (this.state === 'over' && this.victory && this.stateT < 14) {
      this.fireworkT -= rdt;
      if (this.fireworkT <= 0) {
        this.fireworkT = U.rand(0.25, 0.6);
        const x = U.rand(80, SW.W - 80), y = U.rand(150, 520), col = U.pick(Object.values(SW.PALETTE));
        SW.fx.explosion(x, y, col, U.rand(0.6, 1.1));
        SW.fx.shatter(x - 20, y - 10, 40, 20, col, 14, 1.4);
        SW.audio.sfx('crystal');
      }
    }
    for (const bu of this.bumpers) bu.flash = Math.max(0, bu.flash - dt * 4);
    for (const po of this.portals) po.flash = Math.max(0, po.flash - dt * 3);
    SW.fx.update(dt, rdt);
    if (this.demo) {
      this.demoT += rdt;
      if (this.demoT > 75 && this.state === 'play') { this.demoT = 0; this.startDemo(); }
    }
  },

  onAction() {
    let st = this.state;
    if (st === 'intro' && this.stateT > 0.4) { this.setState('serve'); st = 'serve'; }
    if (st === 'serve' || st === 'play') {
      let launched = false;
      for (const b of this.balls) if (b.stuck) { this.launch(b); launched = true; }
      if (launched && st === 'serve') this.setState('play');
      if (!launched && this.pw.laser > 0 && st === 'play') this.tryLaser();
    } else if (st === 'tally' && this.stateT > 1.0) this.nextLevel();
  },
  tryLaser() {
    if (this.laserCD > 0 || this.paddle.dead || this.paddle.stun > 0) return;
    const p = this.paddle;
    this.laserCD = 0.22;
    this.lasers.push(new SW.Laser(p.x - p.w / 2 + 9, p.y - 8), new SW.Laser(p.x + p.w / 2 - 9, p.y - 8));
    SW.audio.sfx('laser');
  },
  updateTimers(dt) {
    this.laserCD -= dt;
    for (const k in this.pw) {
      if (this.pw[k] <= 0) continue;
      this.pw[k] -= dt;
      if (this.pw[k] > 0) continue;
      this.pw[k] = 0;
      if (k === 'wide' || k === 'shrink') this.paddle.tw = this.paddle.base;
      if (k === 'catch') for (const b of this.balls) if (b.stuck && this.state === 'play') this.launch(b);
      if (k === 'shield') this.shieldHits = 0;
    }
  },

  /* ---------- balls ---------- */
  updateBalls(dt) {
    const p = this.paddle, target = this.targetSpeed();
    const fire = this.pw.fire > 0;
    for (const b of this.balls) {
      b.flash = Math.max(0, b.flash - dt * 4);
      if (b.stuck) {
        b.stuckOff = U.clamp(b.stuckOff, -p.w / 2 + 8, p.w / 2 - 8);
        b.x = p.x + b.stuckOff; b.y = p.y - b.r - 1;
        b.trail.length = 0;
        continue;
      }
      b.speed = U.approach(b.speed, target, 380 * dt);
      b.normalize(b.speed);
      b.portalCD -= dt;
      b.sinceBrick = (b.sinceBrick || 0) + dt;
      const steps = Math.max(1, Math.ceil((b.speed * dt) / 4));
      const sdt = dt / steps;
      for (let s = 0; s < steps && !b.dead && !b.stuck; s++) this.stepBall(b, sdt);
      b.pushTrail();
      if (fire && Math.random() < 0.6) SW.fx.embers(b.x, b.y, U.pick(['#ffb347', '#ff6a2a', '#fff3c0']), 1, 50);
    }
    const before = this.balls.length;
    this.balls = this.balls.filter((b) => !b.dead);
    if (before && !this.balls.length && this.state === 'play') this.loseLife();
  },
  stepBall(b, dt) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    const F = SW.FIELD, r = b.r;
    if (b.x - r < F.left) { b.x = F.left + r; b.vx = Math.abs(b.vx); this.wallHit(b); }
    else if (b.x + r > F.right) { b.x = F.right - r; b.vx = -Math.abs(b.vx); this.wallHit(b); }
    if (b.y - r < F.top) { b.y = F.top + r; b.vy = Math.abs(b.vy); this.wallHit(b); }
    if (this.pw.shield > 0 && b.vy > 0 && b.y + r > SW.SHIELD_Y && b.y < SW.SHIELD_Y + 12) {
      b.y = SW.SHIELD_Y - r; b.vy = -Math.abs(b.vy);
      if (!this.demo) { this.shieldHits--; if (this.shieldHits <= 0) this.pw.shield = 0; }
      SW.audio.sfx('shield');
      SW.fx.ring(b.x, SW.SHIELD_Y, '#21f5c4', 4, 60, 0.4, 3);
      SW.fx.sparks(b.x, SW.SHIELD_Y, '#21f5c4', 10, 260, -Math.PI / 2, 1);
    }
    if (b.vy > 0) this.collidePaddle(b);
    this.collideBricks(b);
    for (const bo of this.bosses) {
      if (!bo.alive) continue;
      const rr = bo.r * 0.98 + r;
      const dx = b.x - bo.x, dy = b.y - bo.y, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d;
      b.x = bo.x + nx * rr; b.y = bo.y + ny * rr;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
      this.hitBoss(bo, this.pw.fire > 0 ? 2 : 1, b.x - nx * r, b.y - ny * r);
      b.sinceBrick = 0; b.flash = 1;
    }
    for (const bu of this.bumpers) {
      const rr = bu.r + r, dx = b.x - bu.x, dy = b.y - bu.y, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d;
      b.x = bu.x + nx * rr; b.y = bu.y + ny * rr;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
      b.speed = Math.min(b.speed * 1.3, 1100);
      bu.flash = 1; bu.hits++;
      this.addScore(25);
      this.addPulse(1);
      SW.audio.sfx('bumper');
      SW.fx.ring(bu.x, bu.y, SW.bg.accent(), bu.r, bu.r + 30, 0.3, 3);
      SW.fx.sparks(b.x, b.y, '#ffffff', 6, 260, Math.atan2(ny, nx), 0.7);
    }
    if (b.portalCD <= 0) {
      for (const po of this.portals) {
        let from = null, to = null;
        if (U.dist2(b.x, b.y, po.a.x, po.a.y) < po.r * po.r) { from = po.a; to = po.b; }
        else if (U.dist2(b.x, b.y, po.b.x, po.b.y) < po.r * po.r) { from = po.b; to = po.a; }
        if (!from) continue;
        SW.fx.ring(from.x, from.y, '#2de2ff', 30, 2, 0.3, 3);
        b.x = to.x; b.y = to.y; b.portalCD = 0.6; b.trail.length = 0;
        po.flash = 1;
        SW.fx.ring(to.x, to.y, '#ff8a3d', 4, 50, 0.4, 3);
        SW.audio.sfx('portal');
        break;
      }
    }
    if (b.y - r > SW.H) b.dead = true;
  },
  wallHit(b) {
    SW.audio.sfx('wall');
    this.nudge(b);
  },
  nudge(b) { // anti-stall: perturb long, scoreless bounce loops
    if (b.sinceBrick > 8) {
      const a = Math.atan2(b.vy, b.vx) + U.rand(-0.3, 0.3);
      b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed;
      b.sinceBrick = 5;
    }
  },
  collidePaddle(b) {
    const p = this.paddle;
    if (p.dead) return;
    const half = p.w / 2;
    if (b.y + b.r < p.y || b.y > p.y + p.h * 0.75) return;
    if (b.x < p.x - half - b.r * 0.7 || b.x > p.x + half + b.r * 0.7) return;
    const off = U.clamp((b.x - p.x) / half, -1, 1);
    const ang = U.clamp(off * 1.05 + U.clamp(p.vx / 2600, -0.22, 0.22), -1.15, 1.15);
    b.y = p.y - b.r;
    this.paddleHits++;
    b.sinceBrick = Math.min(b.sinceBrick || 0, 5);
    if (this.pw.catch > 0 && !this.demo && this.state === 'play') { b.stuck = true; b.stuckOff = b.x - p.x; }
    else b.setAngle(ang);
    p.squash = 1; p.flash = Math.max(p.flash, 0.5);
    SW.audio.sfx('paddle', off);
    SW.fx.sparks(b.x, p.y, SW.C.lighten(SW.bg.accent(), 0.4), 7, 260, -Math.PI / 2 + off * 0.6, 0.6);
  },
  collideBricks(b) {
    let hit = null, best = 0;
    const r = b.r;
    for (const br of this.bricks) {
      if (!br.alive || !br.solid || br.appear < 0.6) continue;
      if (b.x + r < br.x || b.x - r > br.x + br.w || b.y + r < br.y || b.y - r > br.y + br.h) continue;
      const cx = U.clamp(b.x, br.x, br.x + br.w), cy = U.clamp(b.y, br.y, br.y + br.h);
      const dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
      if (d2 > r * r) continue;
      const pen = r - Math.sqrt(d2);
      if (pen > best || !hit) { best = pen; hit = br; }
    }
    if (!hit) return;
    const br = hit;
    const pierce = this.pw.fire > 0 && br.kind !== 'steel';
    if (!pierce) {
      // resolve along the axis of least overlap (stable on brick seams)
      const ox = Math.min(b.x + r - br.x, br.x + br.w - (b.x - r));
      const oy = Math.min(b.y + r - br.y, br.y + br.h - (b.y - r));
      if (ox < oy) {
        const s = b.x < br.x + br.w / 2 ? -1 : 1;
        b.x += s * ox;
        if (b.vx * s < 0) b.vx = -b.vx;
      } else {
        const s = b.y < br.y + br.h / 2 ? -1 : 1;
        b.y += s * oy;
        if (b.vy * s < 0) b.vy = -b.vy;
      }
    }
    b.flash = 1;
    if (br.kind === 'steel') this.nudge(b); else b.sinceBrick = 0;
    this.damageBrick(br, pierce ? 99 : 1, 'ball', b);
  },
  hitBoss(bo, dmg, x, y) {
    if (!bo.hit(dmg, this)) return;
    this.chain++; this.chainT = 2.2; this.mult = Math.min(8, 1 + Math.floor(this.chain / 5));
    this.addScore(200 * this.mult);
    this.addPulse(4);
    SW.audio.sfx('bossHit');
    SW.fx.sparks(x, y, '#ffffff', 12, 380);
    SW.fx.sparks(x, y, bo.color, 10, 280);
    SW.fx.glow(x, y, bo.color, 60, 0.3);
    SW.fx.text(x, y - 10, '-' + dmg, bo.color, 22);
    SW.fx.shake(0.22);
    this.doHitstop(0.04);
  },

  /* ---------- projectiles, capsules, waves ---------- */
  updateProjectiles(dt) {
    const F = SW.FIELD, p = this.paddle;
    for (const l of this.lasers) {
      const ly0 = l.y;
      l.y += l.vy * dt;
      if (l.y < F.top) { l.dead = true; SW.fx.sparks(l.x, F.top, '#ff9ab0', 3, 120); continue; }
      let hitBr = null;
      for (const br of this.bricks) {
        if (!br.alive || !br.solid || br.appear < 0.6) continue;
        if (l.x > br.x - 1.5 && l.x < br.x + br.w + 1.5 && l.y - 9 < br.y + br.h && ly0 > br.y && (!hitBr || br.y > hitBr.y)) hitBr = br;
      }
      if (hitBr) {
        l.dead = true;
        this.damageBrick(hitBr, 1, 'laser');
        SW.fx.sparks(l.x, hitBr.y + hitBr.h, '#ff9ab0', 4, 160, Math.PI / 2, 0.8);
        continue;
      }
      for (const bo of this.bosses) if (bo.alive && U.dist2(l.x, l.y, bo.x, bo.y) < bo.r * bo.r) { l.dead = true; this.hitBoss(bo, 0.5, l.x, l.y); break; }
      for (const o of this.orbs) if (!o.dead && U.dist2(l.x, l.y, o.x, o.y) < 196) { o.dead = l.dead = true; SW.fx.glow(o.x, o.y, o.color, 30, 0.3); SW.fx.sparks(o.x, o.y, o.color, 8, 200); }
    }
    this.lasers = this.lasers.filter((l) => !l.dead);

    for (const o of this.orbs) {
      o.update(dt);
      if (o.y > SW.H + 20 || o.x < -20 || o.x > SW.W + 20) { o.dead = true; continue; }
      if (this.pw.shield > 0 && o.y > SW.SHIELD_Y - 4) { o.dead = true; SW.fx.ring(o.x, SW.SHIELD_Y, '#21f5c4', 4, 34, 0.3, 2); SW.audio.sfx('shield'); continue; }
      if (!p.dead && o.y + o.r > p.y && o.y - o.r < p.y + p.h && o.x > p.x - p.w / 2 - o.r && o.x < p.x + p.w / 2 + o.r) {
        o.dead = true;
        p.stun = 0.8; p.flash = 1;
        SW.audio.sfx('stun');
        SW.fx.shake(0.45); SW.fx.flash(o.color, 0.25);
        SW.fx.sparks(o.x, p.y, o.color, 16, 320, -Math.PI / 2, 1.4);
        SW.fx.text(p.x, p.y - 36, 'STUNNED', '#ff6680', 18);
        this.chain = 0; this.mult = 1;
      }
    }
    this.orbs = this.orbs.filter((o) => !o.dead);

    const canCatch = this.state === 'play' || this.state === 'serve';
    for (const c of this.capsules) {
      c.update(dt);
      if (c.y - c.h > SW.H) { c.dead = true; continue; }
      if (canCatch && !p.dead && c.y + c.h / 2 > p.y && c.y - c.h / 2 < p.y + p.h && c.x + c.w / 2 > p.x - p.w / 2 && c.x - c.w / 2 < p.x + p.w / 2) {
        c.dead = true; this.applyPower(c.type, c.x, c.y);
      }
    }
    this.capsules = this.capsules.filter((c) => !c.dead);

    for (const w of this.waves) {
      const wy0 = w.y;
      w.y += w.vy * dt; w.t += dt;
      const x0 = w.x - w.w / 2, x1 = w.x + w.w / 2, y0 = w.y, y1 = wy0 + 40;
      for (const br of this.bricks) {
        if (!br.alive || w.hit.has(br) || br.appear < 0.6) continue;
        if (br.x + br.w > x0 && br.x < x1 && br.y + br.h > y0 && br.y < y1) {
          w.hit.add(br);
          if (br.kind === 'steel') { br.flash = 1; continue; }
          this.damageBrick(br, 2, 'pulse');
        }
      }
      for (const bo of this.bosses) {
        if (!bo.alive || w.hit.has(bo)) continue;
        if (bo.x + bo.r > x0 && bo.x - bo.r < x1 && bo.y + bo.r > y0 && bo.y - bo.r < y1) { w.hit.add(bo); this.hitBoss(bo, 4, bo.x, bo.y + bo.r * 0.7); }
      }
      for (const o of this.orbs) if (!o.dead && o.x > x0 && o.x < x1 && o.y > y0 - 10 && o.y < y1 + 60) { o.dead = true; SW.fx.glow(o.x, o.y, o.color, 30, 0.3); }
      for (const b of this.balls) {
        if (b.stuck || w.hit.has(b)) continue;
        if (b.x > x0 - 10 && b.x < x1 + 10 && b.y > y0 - 10 && b.y < y1 + 80 && b.vy > 0) {
          w.hit.add(b); b.vy = -Math.abs(b.vy);
          SW.fx.ring(b.x, b.y, '#d7b8ff', 4, 40, 0.35, 3);
          SW.fx.text(b.x, b.y - 20, 'SAVED', '#d7b8ff', 16);
        }
      }
      if (w.y < F.top - 60) w.dead = true;
    }
    this.waves = this.waves.filter((w) => !w.dead);
  },
});
