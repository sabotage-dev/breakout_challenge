'use strict';
/* ============ SHATTERSONG · game ============ */
const COLS = 13, CELL_W = 70, CELL_H = 28, GRID_X = (W - COLS * CELL_W) / 2, GRID_Y = HUD_H + 44;
const PADDLE_Y = 668, PADDLE_H = 16, PADDLE_BASE = 118, BALL_R = 7.5, MAX_BALLS = 16;
const CLEAR_TIME = 3.0, CRESCENDO_TIME = 8;
const GOLD = '#ffd36e';
const BRICK_PTS = { n: 10, t: 25, h: 40, x: 15, s: 20, phase: 20, steel: 30 };
const BRICK_DEFS = {
  T: { type: 't', hp: 2, color: '#aebbd0' },
  H: { type: 'h', hp: 3, color: '#e0aa3e' },
  '#': { type: 'steel', hp: 1, color: '#4a5266' },
  X: { type: 'x', hp: 1, color: '#ff5a2a' },
  S: { type: 's', hp: 1, color: '#c9f6ff' },
  P: { type: 'phase', hp: 1, color: '#4de8ff', group: 0 },
  Q: { type: 'phase', hp: 1, color: '#ff6ad5', group: 1 }
};

const Game = {
  demo: false, auto: false,
  phase: 'idle', phaseT: 0, stageT: 0, t: 0, timeScale: 1, slowT: 0, slowTo: 1,
  score: 0, shownScore: 0, lives: 3, loop: 0, stageIdx: 0, stage: STAGES[0], act: ACTS[0],
  balls: [], bricks: [], caps: [], bolts: [], shots: [], delayed: [], boss: null,
  paddle: { x: W / 2, y: PADDLE_Y, w: PADDLE_BASE, h: PADDLE_H, vx: 0, kv: 0, stun: 0, squash: 0 },
  eff: { wide: 0, laser: 0, slow: 0, fire: 0, shrink: 0, fast: 0 },
  perks: {}, stats: { bricks: 0, maxCombo: 0, time: 0, caps: 0, cresc: 0, stages: 0 },
  combo: 0, comboT: 0, multPop: 0, resonance: 0, crescendo: 0, shield: 0, ramp: 0,
  remaining: 0, dropPity: 0, laserCd: 0, lastBreakT: 0, stageMiss: false, clearInfo: null,
  aiX: W / 2, aiOff: 0, aiAct: false, dirty: false, brickId: 0, pending: null,
  onStageClear: null, onGameOver: null,

  perk(id) { return this.perks[id] || 0; },
  mult() { return Math.min(8, 1 + Math.floor(this.combo / 6)); },
  setPhase(p) { this.phase = p; this.phaseT = 0; },
  delay(t, fn) { this.delayed.push({ t, fn }); },
  slowmo(to, dur) { this.slowTo = to; this.slowT = dur; },

  /* ---------- run / stage setup ---------- */
  newRun(o = {}) {
    this.demo = !!o.demo; this.auto = !!o.auto; this.loop = o.loop || 0;
    this.score = 0; this.shownScore = 0; this.lives = 3; this.perks = {}; this.resonance = 0;
    this.stats = { bricks: 0, maxCombo: 0, time: 0, caps: 0, cresc: 0, stages: 0 };
    this.loadStage(o.stage || 0);
  },

  loadStage(i) {
    const st = STAGES[i];
    this.stageIdx = i; this.stage = st; this.act = ACTS[st.act];
    this.balls = []; this.bricks = []; this.caps = []; this.bolts = []; this.shots = []; this.delayed = []; this.boss = null;
    for (const k in this.eff) this.eff[k] = 0;
    this.crescendo = 0; this.combo = 0; this.comboT = 0; this.ramp = 0; this.stageMiss = false; this.clearInfo = null;
    this.shield = this.perk('net') ? 1 : 0;
    if (this.perk('overture')) this.resonance = Math.max(this.resonance, 40);
    this.timeScale = 1; this.slowT = 0; this.stageT = 0; this.lastBreakT = this.t; this.dropPity = 0; this.laserCd = 0;
    this.paddle.stun = 0; this.paddle.kv = 0; this.pending = null; this.dirty = false;
    FX.clear();
    this.remaining = 0;
    for (let r = 0; r < st.map.length; r++) {
      const row = st.map[r], mv = st.move && st.move[r];
      for (let c = 0; c < COLS; c++) {
        const br = this.addBrick(row[c], c, r);
        if (br && mv) br.move = { amp: mv[0], speed: mv[1] };
      }
    }
    if (st.boss) this.boss = this.makeBoss(st.boss);
    BG.setTheme(this.act);
    if (!this.demo) Music.setTrack(st.boss ? this.act.bossTrack : this.act.track);
    this.serveBall();
    this.setPhase('intro');
  },

  addBrick(ch, c, r, extra) {
    let d;
    if (ch >= '1' && ch <= '7') d = { type: 'n', hp: 1, color: this.act.pal[+ch - 1] };
    else d = BRICK_DEFS[ch];
    if (!d) return null;
    let hp = d.hp;
    if (this.loop > 0 && d.type === 'n' && (c + r) % 2 === 0) hp++;
    const x = GRID_X + c * CELL_W + CELL_W / 2, y = GRID_Y + r * CELL_H + CELL_H / 2;
    const br = {
      id: ++this.brickId, c, r, x, y, ox: x, w: BW, h: BH, type: d.type, hp, maxHp: hp, color: d.color, group: d.group || 0,
      alive: true, solid: true, alpha: 1, flash: 0, appear: this.stageT + 0.12 + r * 0.045 + c * 0.018, move: null, counts: d.type !== 'steel'
    };
    if (extra) Object.assign(br, extra);
    if (br.counts) this.remaining++;
    this.bricks.push(br);
    return br;
  },

  spawnBall(x, y, dx, dy, extra) {
    const n = Math.hypot(dx, dy) || 1;
    const b = { x, y, dx: dx / n, dy: dy / n, r: BALL_R, stuck: false, off: 0, trail: [], cd: 0, stall: 0 };
    if (extra) Object.assign(b, extra);
    this.balls.push(b);
    return b;
  },
  serveBall() {
    const p = this.paddle;
    this.balls.length = 0;
    this.spawnBall(p.x, p.y - p.h / 2 - BALL_R - 1, 0, -1, { stuck: true, off: 0 });
  },
  launch() {
    const p = this.paddle;
    for (const b of this.balls) {
      if (!b.stuck) continue;
      const ang = clamp(p.vx / 1600, -0.6, 0.6) + rand(-0.12, 0.12);
      b.dx = Math.sin(ang); b.dy = -Math.cos(ang); b.stuck = false;
    }
    this.setPhase('live'); this.lastBreakT = this.t;
    Sfx.launch();
    FX.ring(p.x, p.y - 12, this.act.accent, 46, 0.35, 3);
  },
  ballSpeed() {
    const e = this.eff;
    let s = (366 + this.stageIdx * 11) * (1 + 0.12 * this.loop) * (1 + this.ramp);
    s *= 1 - 0.08 * this.perk('tempo');
    if (e.slow > 0) s *= 0.68;
    if (e.fast > 0) s *= 1.32;
    if (this.crescendo > 0) s *= 1.08;
    return s;
  },
  addScore(pts, x, y, color, size) {
    pts = Math.round(pts * (1 + 0.25 * this.perk('greed')));
    this.score += pts;
    if (x !== undefined && FX.texts.length < 14) FX.text(x, y, '+' + pts, color || '#ffffff', size || 13, 0.7);
    return pts;
  },
  addPerk(id) {
    this.perks[id] = (this.perks[id] || 0) + 1;
    if (id === 'life') this.lives++;
  },
  rollPerks(n) {
    const pool = PERKS.filter(p => this.perk(p.id) < p.max && !(p.id === 'life' && this.lives >= 6));
    for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    return pool.slice(0, n);
  },
  musicIntensity() {
    if (this.crescendo > 0) return 3;
    const boss = !!this.boss && !this.boss.dead;
    switch (this.phase) {
      case 'live': return (this.combo >= 10 || boss || this.balls.length >= 4) ? 2 : 1;
      case 'bossdie': return 3;
      case 'clear': return 1;
      case 'intro': case 'serve': return boss ? 1 : 0;
      default: return 0;
    }
  },

  /* ---------- main update ---------- */
  update(dt) {
    this.slowT -= dt;
    const tsTarget = this.slowT > 0 ? this.slowTo : 1;
    this.timeScale += (tsTarget - this.timeScale) * damp(this.slowT > 0 ? 40 : 5, dt);
    const sdt = dt * this.timeScale;
    this.t += sdt; this.phaseT += dt; this.stageT += dt;
    FX.update(sdt);
    if (this.shownScore !== this.score) {
      this.shownScore += (this.score - this.shownScore) * damp(9, dt);
      if (Math.abs(this.score - this.shownScore) < 1) this.shownScore = this.score;
    }
    this.multPop = Math.max(0, this.multPop - dt * 3);

    const ai = this.demo || this.auto;
    let act = false, tap = false;
    if (ai) { this.ai(); act = this.aiAct; } else { act = Input.action; tap = Input.tap; }
    Input.action = false; Input.tap = false;

    this.updatePaddle(sdt, dt, ai);

    const ph = this.phase;
    if (ph === 'intro') { if (this.phaseT > 1.25) this.setPhase('serve'); }
    else if (ph === 'serve') { if (act || tap) this.launch(); }
    else if (ph === 'live') {
      this.stats.time += dt;
      if (act && this.resonance >= 100 && this.crescendo <= 0) this.startCrescendo();
    }
    else if (ph === 'lost') {
      if (this.phaseT > 1.0) {
        if (this.lives <= 0) { this.setPhase('over'); this.pending = this.onGameOver; }
        else { this.serveBall(); this.setPhase('serve'); }
      }
    }
    else if (ph === 'bossdie') {
      const b = this.boss;
      if (Math.random() < dt * 16) {
        const k = pick(b.cores), x = k.x + rand(-55, 55), y = k.y + rand(-45, 45);
        FX.spark(x, y, pick([GOLD, '#ffffff', '#ff7ad9']), 14, 280, 0.6, 4);
        FX.ring(x, y, '#ffffff', rand(30, 70), 0.35, 3);
        FX.shake(5); Sfx.explode(true);
      }
      if (this.phaseT > 1.5) {
        b.dead = true;
        for (const k of b.cores) { FX.spark(k.x, k.y, GOLD, 50, 520, 1.1, 5); FX.ring(k.x, k.y, '#ffffff', 320, 0.8, 8); }
        for (const br of this.bricks) if (br.alive) { br.alive = false; FX.shards(br.x, br.y, br.w, br.h, br.color, 5); }
        this.dirty = true; this.shots.length = 0;
        FX.flash('#ffffff', 0.6); FX.shake(22); Sfx.bossDie();
        this.addScore(3000 * (this.stage.act + 1), W / 2, 240, GOLD, 30);
        this.stageClear();
      }
    }
    else if (ph === 'clear') { if (this.phaseT > CLEAR_TIME) { this.setPhase('done'); this.pending = this.onStageClear; } }

    const live = this.phase === 'live' || this.phase === 'bossdie';
    this.updateBricks(sdt);
    if (this.boss && !this.boss.dead) this.updateBoss(sdt, this.phase === 'live');
    this.updateBalls(sdt, live);
    if (live) this.updateTimers(sdt);
    this.updateCaps(sdt); this.updateBolts(sdt); this.updateShots(sdt);

    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const d = this.delayed[i]; if (!d) continue;
      d.t -= sdt;
      if (d.t <= 0) { this.delayed.splice(i, 1); d.fn(); }
    }
    if (this.dirty) { this.bricks = this.bricks.filter(b => b.alive); this.dirty = false; }
    if (this.pending) { const cb = this.pending; this.pending = null; cb(); }
  },

  updatePaddle(sdt, dt, ai) {
    const p = this.paddle, e = this.eff;
    const tw = PADDLE_BASE * (1 + 0.15 * this.perk('wide')) * (e.wide > 0 ? 1.45 : 1) * (e.shrink > 0 ? 0.6 : 1);
    p.w += (tw - p.w) * damp(10, dt);
    const px = p.x;
    if (p.stun > 0) { p.stun -= sdt; if (Math.random() < dt * 30) FX.spark(p.x + rand(-p.w / 2, p.w / 2), p.y, '#ffffff', 1, 90, 0.25, 2); }
    else if (this.phase !== 'over') {
      if (ai) p.x += clamp(this.aiX - p.x, -1000 * dt, 1000 * dt);
      else if (Input.mode === 'keys') {
        const d = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
        p.kv += (d * 900 - p.kv) * damp(20, dt);
        p.x += p.kv * dt;
      } else p.x += (Input.x - p.x) * damp(40, dt);
    }
    p.x = clamp(p.x, p.w / 2 + 3, W - p.w / 2 - 3);
    if (dt > 0) p.vx += ((p.x - px) / dt - p.vx) * damp(18, dt);
    p.squash = Math.max(0, p.squash - dt * 7);
  },

  updateBricks(sdt) {
    const beatOn = Math.floor(Music.beat / 2) % 2;
    const bricks = this.bricks;
    for (let i = 0; i < bricks.length; i++) {
      const br = bricks[i];
      if (!br.alive) continue;
      if (br.flash > 0) br.flash = Math.max(0, br.flash - sdt * 5);
      if (br.move) br.x = br.ox + Math.sin(this.t * br.move.speed) * br.move.amp;
      if (br.type === 'phase') {
        const on = beatOn === br.group;
        if (!on) br.solid = false;
        else if (!br.solid) { // never materialise on top of a ball
          let blocked = false;
          for (const b of this.balls) if (Math.abs(b.x - br.x) < br.w / 2 + b.r + 2 && Math.abs(b.y - br.y) < br.h / 2 + b.r + 2) { blocked = true; break; }
          if (!blocked) br.solid = true;
        }
        br.alpha += ((br.solid ? 1 : 0.16) - br.alpha) * damp(14, sdt);
      }
    }
  },

  updateTimers(sdt) {
    const e = this.eff;
    for (const k in e) if (e[k] > 0) e[k] = Math.max(0, e[k] - sdt);
    if (this.crescendo > 0) {
      this.crescendo -= sdt;
      if (this.crescendo <= 0) { this.crescendo = 0; FX.ring(this.paddle.x, this.paddle.y, GOLD, 200, 0.5, 3); }
    }
    if (this.comboT > 0) { this.comboT -= sdt; if (this.comboT <= 0) this.combo = 0; }
    if (e.laser > 0 && this.phase === 'live') {
      this.laserCd -= sdt;
      if (this.laserCd <= 0) {
        const p = this.paddle; this.laserCd = 0.27;
        this.bolts.push({ x: p.x - p.w / 2 + 9, y: p.y - 12 }, { x: p.x + p.w / 2 - 9, y: p.y - 12 });
        Sfx.laser();
      }
    }
  },

  /* ---------- balls ---------- */
  updateBalls(sdt, live) {
    const balls = this.balls, p = this.paddle;
    const speed = this.ballSpeed();
    const bossUp = !!this.boss && !this.boss.dead;
    const assist = live && (bossUp || this.remaining > 0) && (this.t - this.lastBreakT) > (bossUp ? 9 : 14);
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (!b) continue; // the list can be emptied mid-loop when a stage clears
      if (b.stuck) { b.x = p.x + b.off; b.y = p.y - p.h / 2 - b.r - 1; b.trail.length = 0; continue; }
      if (!live) continue;
      if (b.life !== undefined) {
        b.life -= sdt;
        if (b.life <= 0) {
          if (balls.length === 1) b.life = undefined; // the last ball standing becomes real
          else { FX.spark(b.x, b.y, '#c79bff', 8, 140, 0.4, 3); balls.splice(i, 1); continue; }
        }
      }
      b.cd = Math.max(0, b.cd - sdt); b.stall += sdt;
      if (b.dy < 0) { // bosses tug rising balls toward themselves; stubborn last bricks do too, eventually
        if (assist) this.steer(b, sdt, 1.8); else if (bossUp && live) this.steer(b, sdt, 0.55);
      }
      let remaining = speed * sdt, alive = true;
      while (remaining > 0 && alive) {
        const step = Math.min(remaining, 5); remaining -= step;
        b.x += b.dx * step; b.y += b.dy * step;
        alive = this.collideBall(b);
      }
      if (!alive) { balls.splice(i, 1); continue; }
      if (Math.abs(b.dy) < 0.22) { b.dy = b.dy < 0 ? -0.22 : 0.22; b.dx = sgn(b.dx) * Math.sqrt(1 - b.dy * b.dy); }
      b.trail.push(b.x, b.y); if (b.trail.length > 22) b.trail.splice(0, 2);
      if ((this.eff.fire > 0 || this.crescendo > 0) && Math.random() < 0.6) FX.ember(b.x, b.y, this.crescendo > 0 ? GOLD : '#ff8a3d');
    }
    if (balls.length === 0 && this.phase === 'live') this.loseLife();
  },

  steer(b, sdt, rate) { // gentle homing
    let best = null, bd = 1e12;
    const list = this.boss && !this.boss.dead ? this.boss.cores : this.bricks;
    for (const br of list) {
      if (!br.alive || br.counts === false) continue;
      const d = (br.x - b.x) * (br.x - b.x) + (br.y - b.y) * (br.y - b.y);
      if (d < bd) { bd = d; best = br; }
    }
    if (!best) return;
    const d = Math.sqrt(bd) || 1, tx = (best.x - b.x) / d, ty = (best.y - b.y) / d;
    const a = clamp(b.dx * ty - b.dy * tx, -1, 1) * rate * sdt, cs = Math.cos(a), sn = Math.sin(a);
    const nx = b.dx * cs - b.dy * sn, ny = b.dx * sn + b.dy * cs;
    b.dx = nx; b.dy = ny;
  },
  jitter(b, amt) {
    const a = rand(-amt, amt), cs = Math.cos(a), sn = Math.sin(a);
    const nx = b.dx * cs - b.dy * sn, ny = b.dx * sn + b.dy * cs;
    b.dx = nx; b.dy = ny;
  },
  wallHit(b) {
    Sfx.wall();
    if (b.stall > 6) this.jitter(b, 0.22);
  },

  collideBall(b) {
    const r = b.r, p = this.paddle;
    // walls
    if (b.x < r) { b.x = r; b.dx = Math.abs(b.dx); this.wallHit(b); }
    else if (b.x > W - r) { b.x = W - r; b.dx = -Math.abs(b.dx); this.wallHit(b); }
    if (b.y < HUD_H + r) { b.y = HUD_H + r; b.dy = Math.abs(b.dy); this.wallHit(b); }
    // floor
    if (b.dy > 0) {
      if (this.crescendo > 0 && b.y > H - 8 - r) {
        b.y = H - 8 - r; b.dy = -Math.abs(b.dy);
        FX.spark(b.x, H - 8, GOLD, 8, 200, 0.4, 3); Sfx.shield();
      } else if (this.shield > 0 && b.y > H - 14 - r && b.y < H + r) {
        b.y = H - 14 - r; b.dy = -Math.abs(b.dy); this.shield--;
        FX.spark(b.x, H - 14, '#c79bff', 16, 260, 0.5, 3.5); FX.ring(b.x, H - 14, '#c79bff', 90, 0.4, 3);
        FX.text(b.x, H - 44, 'SAVED', '#c79bff', 15); Sfx.shield();
      } else if (b.y > H + r + 6) return false;
    }
    // paddle
    if (b.dy > 0 && b.y + r >= p.y - p.h / 2 && b.y < p.y + 5 && Math.abs(b.x - p.x) <= p.w / 2 + r * 0.8) this.paddleBounce(b);

    // bricks
    const fire = this.eff.fire > 0 || this.crescendo > 0, cres = this.crescendo > 0;
    const bricks = this.bricks;
    let fx = false, fy = false, best = null, bestD = 1e9;
    for (let k = 0; k < bricks.length; k++) {
      const br = bricks[k];
      if (!br.alive || !br.solid) continue;
      const ddx = b.x - br.x, ddy = b.y - br.y, hw = br.w / 2, hh = br.h / 2;
      const ax = Math.abs(ddx), ay = Math.abs(ddy);
      if (ax > hw + r || ay > hh + r) continue;
      const cx = Math.max(0, ax - hw), cy = Math.max(0, ay - hh);
      if (cx * cx + cy * cy > r * r) continue;
      if (fire && (br.type !== 'steel' || cres)) { this.hitBrick(br, 99, b); b.stall = 0; continue; }
      const ox = hw + r - ax, oy = hh + r - ay;
      if (ox < oy) { if (ddx * b.dx < 0) fx = true; b.x = br.x + sgn(ddx) * (hw + r); }
      else { if (ddy * b.dy < 0) fy = true; b.y = br.y + sgn(ddy) * (hh + r); }
      const d = ax / hw + ay / hh;
      if (d < bestD) { bestD = d; best = br; }
    }
    if (fx) b.dx = -b.dx;
    if (fy) b.dy = -b.dy;
    if (best) {
      if (best.type === 'steel') { if (b.stall > 6) this.jitter(b, 0.22); } else b.stall = 0;
      this.hitBrick(best, 1 + this.perk('forte'), b);
    }

    // boss cores
    if (this.boss && !this.boss.dead) {
      const cores = this.boss.cores;
      for (let k = 0; k < cores.length; k++) {
        const c = cores[k];
        if (!c.alive) continue;
        const ddx = b.x - c.x, ddy = b.y - c.y, R = c.r + r, d2 = ddx * ddx + ddy * ddy;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2) || 1, nx = ddx / d, ny = ddy / d, dot = b.dx * nx + b.dy * ny;
        if (dot < 0) { b.dx -= 2 * dot * nx; b.dy -= 2 * dot * ny; }
        b.x = c.x + nx * R; b.y = c.y + ny * R;
        if (b.cd <= 0) { b.cd = 0.12; b.stall = 0; this.damageBoss(c, (1 + 0.5 * this.perk('forte')) * (fire ? 1.5 : 1), b.x, b.y); }
      }
    }
    return true;
  },

  paddleBounce(b) {
    const p = this.paddle;
    const off = clamp((b.x - p.x) / (p.w / 2), -1, 1);
    const ang = clamp(off * 1.02 + clamp(p.vx / 2600, -0.16, 0.16) + rand(-0.025, 0.025), -1.15, 1.15);
    b.dx = Math.sin(ang); b.dy = -Math.cos(ang);
    b.y = p.y - p.h / 2 - b.r - 0.5;
    b.stall = 0; p.squash = 1;
    this.ramp = Math.min(0.3, this.ramp + 0.012);
    this.aiOff = rand(-1, 1);
    Sfx.paddle(off);
    FX.spark(b.x, b.y + b.r, this.act.accent, 5, 130, 0.3, 2.5);
    const st = this.perk('staccato');
    if (st && this.phase === 'live') {
      if (st === 1) this.bolts.push({ x: p.x, y: p.y - 12 });
      else this.bolts.push({ x: p.x - 16, y: p.y - 12 }, { x: p.x + 16, y: p.y - 12 });
      Sfx.laser();
    }
  },

  /* ---------- bricks ---------- */
  hitBrick(br, dmg, ball) {
    if (!br.alive) return;
    if (br.type === 'steel' && dmg < 99) {
      br.flash = 1; Sfx.steel();
      if (ball) FX.spark(ball.x, ball.y, '#dfe8ff', 4, 150, 0.25, 2);
      return;
    }
    br.hp -= dmg; br.flash = 1;
    if (br.hp <= 0) this.breakBrick(br);
    else { Sfx.crack(); FX.spark(br.x, br.y, br.color, 4, 120, 0.3, 2.5); }
  },

  breakBrick(br) {
    br.alive = false; this.dirty = true;
    this.lastBreakT = this.t; this.stats.bricks++;
    const m0 = this.mult();
    this.combo++; this.comboT = 2.4;
    if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
    const m = this.mult();
    if (m > m0) { this.multPop = 1; FX.text(br.x, br.y - 22, 'COMBO ×' + m, GOLD, 18, 0.9); }
    const cres = this.crescendo > 0;
    const pts = BRICK_PTS[br.type] * m * (cres ? 2 : 1);
    if (m >= 2 || cres) this.addScore(pts, br.x, br.y, cres ? GOLD : '#ffffff', 12 + Math.min(6, m));
    else this.addScore(pts);
    if (!cres && this.resonance < 100) {
      this.resonance = Math.min(100, this.resonance + (1.6 + Math.min(this.combo, 20) * 0.12) * (1 + 0.35 * this.perk('resonant')));
      if (this.resonance >= 100) { Sfx.ready(); FX.text(W / 2, HUD_H + 34, 'CRESCENDO READY', GOLD, 20, 1.6); }
    }
    FX.shards(br.x, br.y, br.w, br.h, br.color, 7);
    FX.spark(br.x, br.y, br.color, 5, 170, 0.45, 3);
    Sfx.note(this.combo - 1);

    if (br.type === 'x') { const x = br.x, y = br.y; this.delay(0.07, () => this.explode(x, y, 94)); }
    else if (br.type === 's') {
      const a = rand(-1.1, 1.1);
      if (this.balls.length < MAX_BALLS) this.spawnBall(br.x, br.y, Math.sin(a), -Math.cos(a));
      FX.ring(br.x, br.y, '#c9f6ff', 60, 0.4, 3); FX.text(br.x, br.y - 20, 'BALL FREED', '#c9f6ff', 14);
    } else if (this.perk('blast') && Math.random() < 0.1 * this.perk('blast')) {
      const x = br.x, y = br.y; this.delay(0.05, () => this.explode(x, y, 66, true));
    }
    if (this.perk('echo') && this.balls.length < MAX_BALLS && Math.random() < 0.06 * this.perk('echo')) {
      const a = rand(-1.2, 1.2);
      this.spawnBall(br.x, br.y, Math.sin(a), -Math.cos(a), { life: 10, echo: true });
    }
    this.maybeDrop(br.x, br.y);
    if (br.counts) {
      this.remaining--;
      if (this.remaining <= 0 && !this.boss && this.phase === 'live') this.stageClear();
    }
  },

  explode(x, y, R, small) {
    FX.ring(x, y, '#ffb347', R * 1.15, 0.4, small ? 4 : 6);
    FX.ring(x, y, '#ffffff', R * 0.7, 0.25, 3);
    FX.spark(x, y, '#ffb347', small ? 14 : 24, 340, 0.6, 4.5);
    FX.spark(x, y, '#ffffff', 8, 200, 0.35, 3);
    FX.shake(small ? 5 : 9); Sfx.explode(small);
    const bricks = this.bricks;
    for (let i = 0; i < bricks.length; i++) {
      const br = bricks[i];
      if (!br.alive) continue;
      const dx = br.x - x, dy = br.y - y;
      if (dx * dx + dy * dy < R * R) this.hitBrick(br, 3, null);
    }
    if (this.boss && !this.boss.dead) for (const c of this.boss.cores) {
      if (c.alive && Math.hypot(c.x - x, c.y - y) < R + c.r) this.damageBoss(c, 1.5, c.x, c.y);
    }
    for (let i = this.shots.length - 1; i >= 0; i--) if (Math.hypot(this.shots[i].x - x, this.shots[i].y - y) < R) this.shots.splice(i, 1);
  },

  /* ---------- power-ups ---------- */
  maybeDrop(x, y, force) {
    this.dropPity++;
    const ch = (0.08 + this.dropPity * 0.012) * (1 + 0.4 * this.perk('luck'));
    if (!force && (this.caps.length >= 4 || Math.random() > ch)) return;
    this.dropPity = 0;
    let tot = 0; const list = [];
    for (const id in POWERUPS) {
      const pu = POWERUPS[id]; let w = pu.weight;
      if (id === 'life' && this.lives >= 5) w = 0;
      if (id === 'shield' && this.shield >= 3) w = 0;
      if (id === 'multi' && this.balls.length >= MAX_BALLS - 2) w = 2;
      if (pu.bad && this.stageIdx === 0 && this.loop === 0) w = 0; // a gentle first stage
      if (w > 0) { list.push(id, w); tot += w; }
    }
    let r = Math.random() * tot, type = 'multi';
    for (let i = 0; i < list.length; i += 2) { r -= list[i + 1]; if (r <= 0) { type = list[i]; break; } }
    this.caps.push({ x: clamp(x, 24, W - 24), y, type, t: rand(TAU) });
  },

  updateCaps(sdt) {
    const p = this.paddle, caps = this.caps, mag = this.perk('magnet');
    const falling = this.phase === 'live' || this.phase === 'bossdie';
    for (let i = caps.length - 1; i >= 0; i--) {
      const c = caps[i];
      c.t += sdt;
      if (!falling) continue;
      c.y += 150 * sdt;
      if (mag && !POWERUPS[c.type].bad && c.y > 240) c.x += clamp(p.x - c.x, -150 * sdt, 150 * sdt);
      if (Math.abs(c.x - p.x) < p.w / 2 + 16 && Math.abs(c.y - p.y) < p.h / 2 + 11) { caps.splice(i, 1); this.applyPower(c.type); continue; }
      if (c.y > H + 30) caps.splice(i, 1);
    }
  },

  applyPower(type) {
    const pu = POWERUPS[type], p = this.paddle, e = this.eff;
    const dur = pu.dur ? pu.dur * (pu.bad ? 1 : 1 + 0.4 * this.perk('sustain')) : 0;
    this.stats.caps++;
    switch (type) {
      case 'multi': {
        const src = this.balls.filter(b => !b.stuck);
        for (const b of src) for (const a of [-0.42, 0.42]) {
          if (this.balls.length >= MAX_BALLS) break;
          const cs = Math.cos(a), sn = Math.sin(a);
          this.spawnBall(b.x, b.y, b.dx * cs - b.dy * sn, b.dx * sn + b.dy * cs, b.life !== undefined ? { life: b.life, echo: true } : null);
        }
        break;
      }
      case 'wide': e.wide = dur; e.shrink = 0; break;
      case 'laser': e.laser = dur; this.laserCd = 0.1; break;
      case 'slow': e.slow = dur; e.fast = 0; break;
      case 'fire': e.fire = dur; break;
      case 'shield': this.shield = Math.min(3, this.shield + 1); break;
      case 'life': this.lives++; break;
      case 'shrink': e.shrink = dur; e.wide = 0; break;
      case 'fast': e.fast = dur; e.slow = 0; break;
    }
    FX.text(p.x, p.y - 34, pu.name, pu.color, 17, 1.0);
    FX.ring(p.x, p.y, pu.color, 70, 0.4, 3);
    FX.spark(p.x, p.y - 8, pu.color, 12, 200, 0.5, 3);
    if (pu.bad) { Sfx.bad(); FX.shake(5); }
    else { if (type === 'life') Sfx.life(); else Sfx.power(); this.addScore(50); }
  },

  /* ---------- projectiles ---------- */
  updateBolts(sdt) {
    const bolts = this.bolts, bricks = this.bricks;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const bo = bolts[i];
      if (!bo) continue;
      let move = 1050 * sdt, dead = false;
      while (move > 0 && !dead) {
        const step = Math.min(move, 12); move -= step; bo.y -= step;
        for (let k = 0; k < bricks.length; k++) {
          const br = bricks[k];
          if (!br.alive || !br.solid) continue;
          if (Math.abs(bo.x - br.x) < br.w / 2 + 2 && Math.abs(bo.y - br.y) < br.h / 2 + 5) {
            this.hitBrick(br, 1, null); FX.spark(bo.x, bo.y, '#ff8aa0', 4, 130, 0.25, 2.5); dead = true; break;
          }
        }
        if (!dead && this.boss && !this.boss.dead) for (const c of this.boss.cores) {
          if (c.alive && Math.hypot(bo.x - c.x, bo.y - c.y) < c.r + 4) { this.damageBoss(c, 0.5, bo.x, bo.y); dead = true; break; }
        }
        if (bo.y < HUD_H) dead = true;
      }
      if (dead) bolts.splice(i, 1);
    }
  },

  shot(x, y, vx, vy) { if (this.shots.length < 40) this.shots.push({ x, y, vx, vy, r: 7, t: 0 }); },
  fan(core, n, speed) {
    const p = this.paddle, a0 = Math.atan2(p.y - core.y, p.x - core.x);
    for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * 0.24; this.shot(core.x, core.y, Math.cos(a) * speed, Math.sin(a) * speed); }
    Sfx.shot();
  },
  rain(n) {
    for (let i = 0; i < n; i++) this.delay(i * 0.13, () => { if (this.phase === 'live') { this.shot(rand(40, W - 40), HUD_H + 8, 0, rand(210, 260)); Sfx.shot(); } });
  },

  updateShots(sdt) {
    const shots = this.shots, p = this.paddle, balls = this.balls;
    const active = this.phase === 'live';
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.t += sdt; s.x += s.vx * sdt; s.y += s.vy * sdt;
      if (s.x < s.r || s.x > W - s.r) { s.vx = -s.vx; s.x = clamp(s.x, s.r, W - s.r); }
      let dead = s.y > H + 20 || s.y < HUD_H - 20;
      if (!dead && active && Math.abs(s.x - p.x) < p.w / 2 + s.r && Math.abs(s.y - p.y) < p.h / 2 + s.r) {
        dead = true;
        if (this.crescendo > 0) FX.spark(s.x, s.y, GOLD, 8, 160, 0.3, 3);
        else {
          p.stun = 0.7; FX.shake(8); FX.flash('#ff3355', 0.14); Sfx.stun();
          FX.spark(s.x, s.y, '#ff5d73', 14, 220, 0.45, 3.5); FX.text(p.x, p.y - 30, 'STUNNED', '#ff5d73', 15);
        }
      }
      if (!dead) for (let k = 0; k < balls.length; k++) {
        const b = balls[k];
        if (Math.abs(b.x - s.x) < 16 && Math.abs(b.y - s.y) < 16) {
          dead = true; Sfx.pop(); FX.spark(s.x, s.y, '#ff9ab0', 8, 160, 0.3, 3); this.addScore(25, s.x, s.y, '#ff9ab0', 12); break;
        }
      }
      if (dead) shots.splice(i, 1);
    }
  },

  /* ---------- bosses ---------- */
  makeBoss(kind) {
    const hpK = 1 + 0.35 * this.loop;
    const core = (r, hp, col) => ({ x: W / 2, y: 200, r, hp: Math.round(hp * hpK), maxHp: Math.round(hp * hpK), flash: 0, alive: true, col });
    const b = { kind, cores: [], t: 0, atk: 2.4, stage: 0, turn: 0, drops: 0, dead: false, bpm: TRACKS[this.act.bossTrack].bpm, ph: 0, ang: 0, ringAng: 0, ring: [] };
    if (kind === 'metronome') { b.name = 'THE METRONOME'; b.cores.push(core(34, 20, GOLD)); }
    else if (kind === 'duet') { b.name = 'THE DUET'; b.cores.push(core(28, 12, '#ff6ad5'), core(28, 12, '#4de8ff')); }
    else { b.name = 'THE MAESTRO'; b.cores.push(core(40, 40, '#c8b6ff')); for (let i = 0; i < 8; i++) b.ring.push({ br: null, cd: 0.4 + i * 0.12 }); }
    this.updateBoss.call(this, 0, false, b);
    return b;
  },

  updateBoss(sdt, attacking, bossArg) {
    const b = bossArg || this.boss, p = this.paddle;
    b.t += sdt;
    for (const c of b.cores) if (c.flash > 0) c.flash = Math.max(0, c.flash - sdt * 6);

    if (b.kind === 'metronome') {
      const c = b.cores[0], frac = c.hp / c.maxHp, per = frac < 0.5 ? 5 : 8;
      b.ph += sdt * (b.bpm / 60) * TAU / per;
      const th = Math.sin(b.ph) * 0.75;
      c.x = W / 2 + Math.sin(th) * 480; c.y = -250 + Math.cos(th) * 480;
      if (attacking) {
        b.atk -= sdt;
        if (b.atk <= 0) {
          b.atk = frac < 0.5 ? 1.15 : 1.9;
          this.shot(c.x, c.y + c.r, clamp((p.x - c.x) * 0.35, -120, 120), 240); Sfx.shot();
        }
        if (b.stage === 0 && frac < 0.66) { b.stage = 1; this.bossSummon(6, 'T', 0); this.fan(c, 5, 250); }
        else if (b.stage === 1 && frac < 0.33) { b.stage = 2; this.bossSummon(6, 'T', 1); this.bossSummon(7, '2', 0); this.fan(c, 7, 260); }
      }
    } else if (b.kind === 'duet') {
      const alive = b.cores.filter(c => c.alive), rage = alive.length < 2;
      b.ang += sdt * (rage ? 1.5 : 0.85);
      b.cores[0].x = W / 2 + Math.cos(b.ang) * 200; b.cores[0].y = 186 + Math.sin(b.ang) * 62;
      b.cores[1].x = W / 2 - Math.cos(b.ang) * 200; b.cores[1].y = 186 - Math.sin(b.ang) * 62;
      if (attacking && alive.length) {
        b.atk -= sdt;
        if (b.atk <= 0) {
          const c = alive[b.turn % alive.length];
          if (b.turn % 2) this.fan(c, rage ? 3 : 1, 280); else this.fan(c, 3, 235);
          b.turn++; b.atk = rage ? 1.2 : 2.0;
        }
      }
    } else {
      const c = b.cores[0], rage = c.hp / c.maxHp < 0.5;
      c.col = rage ? '#ff6a8a' : '#c8b6ff';
      c.x = W / 2 + Math.sin(b.t * 0.45) * 230; c.y = 178 + Math.sin(b.t * 1.1) * 26;
      b.ringAng += sdt * (rage ? -1.15 : 0.7);
      if (bossArg) return; // initial placement only
      for (let i = 0; i < 8; i++) {
        const slot = b.ring[i], a = b.ringAng + i * TAU / 8;
        const x = c.x + Math.cos(a) * 128, y = c.y + Math.sin(a) * 84;
        if (slot.br && !slot.br.alive) { slot.br = null; slot.cd = rage ? 6 : 9; }
        if (slot.br) { slot.br.x = x; slot.br.y = y; }
        else if (c.alive && this.phase !== 'bossdie') {
          slot.cd -= sdt;
          if (slot.cd <= 0) {
            slot.br = this.addBrick('T', 0, 0, { counts: false, ring: true, appear: this.stageT, color: '#b9a8ff' });
            slot.br.x = x; slot.br.y = y;
          }
        }
      }
      if (attacking) {
        b.atk -= sdt;
        if (b.atk <= 0) {
          const m = b.turn++ % 3;
          if (m === 0) this.fan(c, rage ? 7 : 5, 250);
          else if (m === 1) this.rain(rage ? 9 : 6);
          else { this.bossSummon(8, pick(['P', 'Q']), b.turn % 2); this.fan(c, 3, 280); }
          b.atk = rage ? 2.3 : 3.3;
        }
      }
    }
  },

  bossSummon(row, ch, parity) {
    const taken = {};
    for (const br of this.bricks) if (br.alive && br.r === row && !br.ring) taken[br.c] = true;
    let made = false;
    for (let c = parity; c < COLS; c += 2) {
      if (taken[c]) continue;
      const br = this.addBrick(ch, c, row, { counts: false, summoned: true, appear: this.stageT + c * 0.03 });
      if (br) { made = true; FX.spark(br.x, br.y, br.color, 5, 140, 0.4, 3); }
    }
    if (made) Sfx.summon();
  },

  damageBoss(core, dmg, x, y) {
    const b = this.boss;
    if (!core.alive || this.phase !== 'live') return;
    core.hp -= dmg; core.flash = 1; this.lastBreakT = this.t;
    Sfx.bossHit(); FX.spark(x, y, core.col, 10, 240, 0.45, 3.5); FX.shake(3);
    this.addScore(25 * dmg);
    if (this.crescendo <= 0 && this.resonance < 100) {
      this.resonance = Math.min(100, this.resonance + 1.4 * dmg * (1 + 0.35 * this.perk('resonant')));
      if (this.resonance >= 100) { Sfx.ready(); FX.text(W / 2, HUD_H + 34, 'CRESCENDO READY', GOLD, 20, 1.6); }
    }
    b.drops += dmg;
    if (b.drops >= 6) { b.drops = 0; this.maybeDrop(core.x, core.y + core.r, true); }
    if (core.hp <= 0) {
      core.alive = false;
      FX.spark(core.x, core.y, core.col, 40, 420, 0.9, 5); FX.ring(core.x, core.y, core.col, 180, 0.6, 6);
      FX.shake(14); Sfx.explode();
      if (b.cores.every(c => !c.alive)) {
        this.setPhase('bossdie'); this.slowmo(0.35, 1.2); this.shots.length = 0;
      } else FX.text(W / 2, 320, 'SOLO!', '#ff6ad5', 30, 1.4);
    }
  },

  /* ---------- flow ---------- */
  loseLife() {
    this.lives--; this.stageMiss = true; this.combo = 0; this.comboT = 0; this.ramp = 0;
    for (const k in this.eff) this.eff[k] = 0;
    this.caps.length = 0; this.bolts.length = 0; this.shots.length = 0;
    FX.shake(14); FX.flash('#ff3355', 0.28); Sfx.lose();
    FX.spark(this.paddle.x, H - 10, '#ff5d73', 30, 380, 0.8, 4);
    if (this.lives <= 0) Sfx.over();
    this.setPhase('lost');
  },

  stageClear() {
    if (this.phase === 'clear' || this.phase === 'done') return;
    const bossStage = !!this.stage.boss;
    this.setPhase('clear');
    if (!bossStage) this.slowmo(0.25, 0.7);
    for (const b of this.balls) { FX.spark(b.x, b.y, '#ffffff', 16, 260, 0.6, 3.5); FX.ring(b.x, b.y, this.act.accent, 60, 0.4, 3); }
    for (const c of this.caps) FX.spark(c.x, c.y, POWERUPS[c.type].color, 8, 160, 0.4, 3);
    this.balls.length = 0; this.caps.length = 0; this.bolts.length = 0; this.shots.length = 0;
    for (const k in this.eff) this.eff[k] = 0;
    this.crescendo = 0; this.combo = 0;
    const bonus = Math.round((500 + 150 * this.stageIdx) * (1 + 0.25 * this.perk('greed')));
    const flawless = this.stageMiss ? 0 : Math.round(1000 * (1 + 0.25 * this.perk('greed')));
    this.score += bonus + flawless;
    this.clearInfo = { bonus, flawless, boss: bossStage };
    this.stats.stages++;
    if (!bossStage) FX.flash('#ffffff', 0.3);
    Sfx.clear();
  },

  startCrescendo() {
    const p = this.paddle;
    this.crescendo = CRESCENDO_TIME; this.resonance = 0; this.stats.cresc++;
    this.slowmo(0.12, 0.4);
    FX.flash(GOLD, 0.4); FX.shake(10);
    FX.ring(p.x, p.y, GOLD, 520, 0.9, 8); FX.ring(p.x, p.y, '#ffffff', 300, 0.6, 4);
    FX.spark(p.x, p.y, GOLD, 40, 480, 0.9, 4.5);
    FX.text(W / 2, H / 2 + 30, 'CRESCENDO!', GOLD, 56, 1.5);
    Sfx.crescendo();
  },

  /* ---------- autopilot (title-screen demo) ---------- */
  ai() {
    const p = this.paddle;
    this.aiAct = false;
    if (this.phase === 'serve') { this.aiX = W / 2 + Math.sin(this.t * 2.2) * 140; if (this.phaseT > 0.7) this.aiAct = true; return; }
    if (this.phase !== 'live') return;
    let best = null, bt = 1e9;
    for (const b of this.balls) {
      if (b.stuck || b.dy <= 0) continue;
      const tt = (p.y - b.y) / b.dy;
      if (tt >= 0 && tt < bt) { bt = tt; best = b; }
    }
    let tx = W / 2;
    if (best) {
      const lo = best.r, span = W - best.r * 2;
      let x = (best.x + best.dx * bt - lo) % (2 * span);
      if (x < 0) x += 2 * span;
      if (x > span) x = 2 * span - x;
      tx = x + lo + this.aiOff * p.w * 0.3;
    }
    if (!best || bt > 320) {
      let cap = null;
      for (const c of this.caps) if (!POWERUPS[c.type].bad && (!cap || c.y > cap.y)) cap = c;
      if (cap) tx = cap.x; else if (!best && this.balls.length) tx = lerp(this.balls[0].x, W / 2, 0.4);
    }
    this.aiX = tx;
    if (this.resonance >= 100 && this.crescendo <= 0) this.aiAct = true;
  },

  /* =====================================================================
     DRAWING
     ===================================================================== */
  draw(c) {
    c.save();
    c.beginPath(); c.rect(-8, -8, W + 16, H + 16); c.clip();
    if (FX.shakeMag > 0.2) c.translate(FX.sx, FX.sy);
    this.drawField(c);
    this.drawBricks(c);
    if (this.boss && !this.boss.dead) this.drawBoss(c);
    this.drawCaps(c);
    this.drawShots(c);
    this.drawFloor(c);
    this.drawPaddle(c);
    this.drawBalls(c);
    FX.draw(c);
    if (!this.demo) { this.drawHUD(c); this.drawBanners(c); }
    this.drawFrame(c);
    c.restore();
  },

  drawField(c) {
    const acc = this.crescendo > 0 ? GOLD : this.act.accent;
    c.fillStyle = 'rgba(3,4,12,0.6)'; c.fillRect(0, 0, W, H);
    // spectrum bars rising from the floor, driven by the live music
    const spec = AudioSys.spectrum(), n = 32, bw = W / n, t = this.t;
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const j = i < n / 2 ? n / 2 - 1 - i : i - n / 2;
      const v = spec ? spec[1 + j * 2] / 255 : 0.22 + 0.18 * Math.sin(t * 1.7 + j * 0.9) * Math.sin(t * 0.6 + j);
      const hgt = 8 + v * v * 300;
      const g = c.createLinearGradient(0, H - hgt, 0, H);
      g.addColorStop(0, rgba(acc, 0)); g.addColorStop(1, rgba(acc, 0.05 + 0.13 * v));
      c.fillStyle = g; c.fillRect(i * bw + 2, H - hgt, bw - 4, hgt);
    }
    if (this.crescendo > 0) {
      const a = 0.05 + 0.06 * Music.pulse();
      c.fillStyle = rgba(GOLD, a); c.fillRect(0, HUD_H, W, H - HUD_H);
    }
    c.globalCompositeOperation = 'source-over';
  },

  drawFrame(c) {
    const acc = this.crescendo > 0 ? GOLD : this.act.accent, pu = Music.pulse();
    c.strokeStyle = rgba(acc, 0.1 + 0.1 * pu); c.lineWidth = 8; c.strokeRect(0, 0, W, H);
    c.strokeStyle = rgba(acc, 0.55 + 0.3 * pu); c.lineWidth = 1.5; c.strokeRect(0.75, 0.75, W - 1.5, H - 1.5);
    c.fillStyle = rgba(acc, 0.35); c.fillRect(0, HUD_H - 1, W, 1);
  },

  drawBricks(c) {
    const bricks = this.bricks, st = this.stageT, t = this.t;
    const fw = BW + SPAD * 2, fh = BH + SPAD * 2;
    for (let i = 0; i < bricks.length; i++) {
      const br = bricks[i];
      if (!br.alive) continue;
      let s = 1;
      const k = (st - br.appear) / 0.35;
      if (k <= 0) continue;
      if (k < 1) s = Ease.outBack(k);
      const spr = Sprites.brick(br.type, br.color, br.maxHp - br.hp);
      c.globalAlpha = br.alpha;
      c.drawImage(spr, br.x - fw * s / 2, br.y - fh * s / 2, fw * s, fh * s);
      if (br.type === 'x') {
        const p = 0.35 + 0.3 * Math.sin(t * 7 + br.id);
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = p;
        c.drawImage(Sprites.glow('#ff8a3d'), br.x - 30, br.y - 22, 60, 44);
        c.globalCompositeOperation = 'source-over';
      }
      if (br.flash > 0) {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = br.flash * 0.75; c.fillStyle = '#ffffff';
        rr(c, br.x - br.w / 2, br.y - br.h / 2, br.w, br.h, 5); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
    }
    c.globalAlpha = 1;
  },

  drawCore(c, k, t) {
    const p = this.paddle, col = k.col;
    const R = k.r * (1 + 0.04 * Math.sin(t * 6) + Music.pulse() * 0.05);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.75;
    c.drawImage(Sprites.glow(col), k.x - R * 2.6, k.y - R * 2.6, R * 5.2, R * 5.2);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    const ngon = (n, rad) => { c.beginPath(); for (let i = 0; i < n; i++) { const a = i * TAU / n; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } c.closePath(); c.stroke(); };
    c.save(); c.translate(k.x, k.y);
    c.rotate(t * 0.7); c.strokeStyle = rgba(col, 0.85); c.lineWidth = 2.5; ngon(6, R * 1.3);
    c.rotate(-t * 1.9); c.strokeStyle = rgba(col, 0.45); c.lineWidth = 1.5; ngon(3, R * 1.55);
    c.restore();
    const g = c.createRadialGradient(k.x - R * 0.3, k.y - R * 0.35, R * 0.1, k.x, k.y, R);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, tint(col, -0.72));
    c.fillStyle = g; c.beginPath(); c.arc(k.x, k.y, R, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.5; c.stroke();
    const ex = clamp((p.x - k.x) / 300, -1, 1) * R * 0.2, ey = R * 0.12;
    c.fillStyle = 'rgba(8,6,24,.92)'; c.beginPath(); c.arc(k.x + ex * 0.5, k.y + ey * 0.5, R * 0.46, 0, TAU); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(k.x + ex * 1.6, k.y + ey * 1.6, R * 0.16, 0, TAU); c.fill();
    if (k.flash > 0) { c.globalAlpha = k.flash * 0.85; c.fillStyle = '#ffffff'; c.beginPath(); c.arc(k.x, k.y, R, 0, TAU); c.fill(); c.globalAlpha = 1; }
  },

  drawBoss(c) {
    const b = this.boss, t = this.t, dying = this.phase === 'bossdie';
    if (b.kind === 'metronome') {
      const k = b.cores[0];
      c.strokeStyle = rgba(GOLD, 0.16); c.lineWidth = 9; c.beginPath(); c.moveTo(W / 2, HUD_H); c.lineTo(k.x, k.y); c.stroke();
      c.strokeStyle = rgba(GOLD, 0.75); c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2, HUD_H); c.lineTo(k.x, k.y); c.stroke();
      c.fillStyle = GOLD; c.beginPath(); c.arc(W / 2, HUD_H + 2, 6, 0, TAU); c.fill();
    } else if (b.kind === 'duet' && b.cores[0].alive && b.cores[1].alive) {
      const a = b.cores[0], z = b.cores[1];
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(200,160,255,.45)'; c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i <= 24; i++) {
        const u = i / 24, x = lerp(a.x, z.x, u), y = lerp(a.y, z.y, u) + Math.sin(u * 14 + t * 9) * 7 * Math.sin(u * Math.PI);
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.stroke(); c.globalCompositeOperation = 'source-over';
    }
    let hp = 0, mx = 0;
    for (const k of b.cores) {
      hp += Math.max(0, k.hp); mx += k.maxHp;
      if (!k.alive && !dying) continue;
      if (dying && Math.random() < 0.35) continue;
      this.drawCore(c, k, t);
    }
    if (this.demo) return;
    const bw = 360, x = W / 2 - bw / 2, y = HUD_H + 9;
    c.fillStyle = 'rgba(0,0,0,.55)'; rr(c, x - 2, y - 2, bw + 4, 10, 5); c.fill();
    if (hp > 0) {
      const g = c.createLinearGradient(x, 0, x + bw, 0); g.addColorStop(0, '#ff5d73'); g.addColorStop(1, GOLD);
      c.fillStyle = g; rr(c, x, y, Math.max(6, bw * hp / mx), 6, 3); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '700 10px ' + FONT;
    spacedText(c, b.name, W / 2, y + 22, 3, 'center');
  },

  drawCaps(c) {
    for (const cp of this.caps) {
      const pu = POWERUPS[cp.type], w = 38, h = 20;
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6 + 0.2 * Math.sin(cp.t * 6);
      c.drawImage(Sprites.glow(pu.color), cp.x - 34, cp.y - 26, 68, 52);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.save(); c.translate(cp.x, cp.y); c.rotate(Math.sin(cp.t * 3.2) * 0.14);
      const g = c.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, tint(pu.color, 0.45)); g.addColorStop(0.5, pu.color); g.addColorStop(1, tint(pu.color, -0.5));
      c.fillStyle = g; rr(c, -w / 2, -h / 2, w, h, h / 2); c.fill();
      c.fillStyle = 'rgba(6,8,22,.72)'; rr(c, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, (h - 6) / 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; rr(c, -w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, h / 2); c.stroke();
      drawIcon(c, pu.icon, 0, 0, 6.2, pu.bad ? '#ff8a8a' : '#ffffff');
      c.restore();
    }
  },

  drawShots(c) {
    // paddle bolts
    if (this.bolts.length) {
      c.globalCompositeOperation = 'lighter';
      for (const bo of this.bolts) {
        c.drawImage(Sprites.glow('#ff6a8a'), bo.x - 10, bo.y - 16, 20, 40);
        c.fillStyle = '#ffffff'; c.fillRect(bo.x - 1.5, bo.y - 9, 3, 18);
      }
      c.globalCompositeOperation = 'source-over';
    }
    // boss notes
    for (const s of this.shots) {
      c.globalCompositeOperation = 'lighter';
      c.drawImage(Sprites.glow('#ff3d6a'), s.x - 22, s.y - 22, 44, 44);
      c.globalAlpha = 0.5; c.drawImage(Sprites.glow('#ff3d6a'), s.x - s.vx * 0.05 - 12, s.y - s.vy * 0.05 - 12, 24, 24);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.save(); c.translate(s.x, s.y); c.rotate(s.t * 5);
      poly(c, [[0, -s.r], [s.r, 0], [0, s.r], [-s.r, 0]], '#ffe3ea');
      poly(c, [[0, -s.r * 0.5], [s.r * 0.5, 0], [0, s.r * 0.5], [-s.r * 0.5, 0]], '#ff3d6a');
      c.restore();
    }
  },

  drawFloor(c) {
    const t = this.t;
    if (this.shield > 0) {
      const y = H - 14, col = '#c79bff';
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.shield; i++) {
        c.strokeStyle = rgba(col, 0.25); c.lineWidth = 7; c.beginPath(); c.moveTo(4, y + i * 4); c.lineTo(W - 4, y + i * 4); c.stroke();
        c.strokeStyle = rgba(col, 0.9); c.lineWidth = 1.5; c.beginPath();
        for (let x = 4; x <= W - 4; x += 12) { const yy = y + i * 4 + Math.sin(x * 0.05 + t * 5 + i) * 1.5; if (x === 4) c.moveTo(x, yy); else c.lineTo(x, yy); }
        c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
    }
    if (this.crescendo > 0) {
      const y = H - 8, a = Math.min(1, this.crescendo);
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba(GOLD, 0.3 * a); c.lineWidth = 12; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      c.strokeStyle = rgba('#ffffff', 0.9 * a); c.lineWidth = 2; c.beginPath();
      for (let x = 0; x <= W; x += 10) { const yy = y + Math.sin(x * 0.07 + t * 12) * 2.5; if (x === 0) c.moveTo(x, yy); else c.lineTo(x, yy); }
      c.stroke();
      c.globalCompositeOperation = 'source-over';
    }
  },

  drawPaddle(c) {
    const p = this.paddle, e = this.eff, w = p.w, h = p.h * (1 - p.squash * 0.28);
    const x = p.x - w / 2, y = p.y - h / 2 + p.squash * 3;
    let col = this.act.accent;
    if (e.laser > 0) col = '#ff6a8a';
    if (e.fire > 0) col = '#ffb347';
    if (this.crescendo > 0) col = GOLD;
    if (p.stun > 0) col = '#8a8fa8';
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6;
    c.drawImage(Sprites.glow(col), p.x - w * 0.8, p.y - 36, w * 1.6, 72);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (e.laser > 0) {
      c.fillStyle = '#ffd0d8';
      rr(c, x + 4, y - 7, 10, 10, 3); c.fill(); rr(c, x + w - 14, y - 7, 10, 10, 3); c.fill();
    }
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, col); g.addColorStop(1, tint(col, -0.6));
    c.fillStyle = g; rr(c, x, y, w, h, h / 2); c.fill();
    // inlay doubles as a resonance gauge
    const ix = x + 11, iw = w - 22, iy = y + h * 0.4, ih = h * 0.32;
    c.fillStyle = 'rgba(5,8,22,.7)'; rr(c, ix, iy, iw, ih, ih / 2); c.fill();
    const fill = this.crescendo > 0 ? this.crescendo / CRESCENDO_TIME : this.resonance / 100;
    if (fill > 0.02) {
      const full = this.resonance >= 100 || this.crescendo > 0;
      c.fillStyle = full ? (Math.sin(this.t * 14) > 0 ? '#ffffff' : GOLD) : '#ffffff';
      c.globalAlpha = full ? 1 : 0.8;
      rr(c, ix, iy, Math.max(ih, iw * fill), ih, ih / 2); c.fill(); c.globalAlpha = 1;
    }
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; rr(c, x + 0.5, y + 0.5, w - 1, h - 1, h / 2); c.stroke();
  },

  drawBalls(c) {
    const fire = this.eff.fire > 0, cres = this.crescendo > 0;
    for (const b of this.balls) {
      const col = cres ? GOLD : fire ? '#ff8a3d' : b.echo ? '#c79bff' : this.act.accent;
      const gl = Sprites.glow(col), tr = b.trail, n = tr.length;
      c.globalCompositeOperation = 'lighter';
      for (let j = 0; j < n; j += 2) {
        const k = (j + 2) / n, s = b.r * (0.7 + 1.5 * k);
        c.globalAlpha = k * 0.42;
        c.drawImage(gl, tr[j] - s, tr[j + 1] - s, s * 2, s * 2);
      }
      const big = b.r * (fire || cres ? 4.2 : 3.2);
      c.globalAlpha = b.echo ? 0.6 : 0.95;
      c.drawImage(gl, b.x - big, b.y - big, big * 2, big * 2);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = b.echo ? (b.life !== undefined && b.life < 2 ? 0.4 + 0.4 * Math.sin(this.t * 20) : 0.8) : 1;
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
      c.strokeStyle = rgba(col, 0.9); c.lineWidth = 1.5; c.stroke();
      c.globalAlpha = 1;
    }
  },

  drawHUD(c) {
    const acc = this.act.accent, t = this.t;
    const g = c.createLinearGradient(0, 0, 0, HUD_H);
    g.addColorStop(0, 'rgba(9,11,28,.95)'); g.addColorStop(1, 'rgba(9,11,28,.7)');
    c.fillStyle = g; c.fillRect(0, 0, W, HUD_H);
    c.textBaseline = 'alphabetic';

    // score
    c.fillStyle = 'rgba(190,205,255,.6)'; c.font = '600 10px ' + FONT;
    spacedText(c, 'SCORE', 22, 18, 3, 'left');
    c.fillStyle = '#ffffff'; c.font = '700 26px ' + FONT; c.textAlign = 'left';
    c.fillText(fmt(this.shownScore), 21, 45);

    // combo / multiplier
    if (this.combo > 1) {
      const m = this.mult(), x = 232, sc = 1 + this.multPop * 0.5;
      c.fillStyle = m > 1 ? GOLD : 'rgba(255,255,255,.75)';
      c.font = '800 ' + (22 * sc).toFixed(1) + 'px ' + FONT; c.textAlign = 'center';
      c.fillText('×' + m, x, 34);
      c.fillStyle = 'rgba(190,205,255,.6)'; c.font = '600 9px ' + FONT;
      spacedText(c, this.combo + ' HITS', x, 14, 2, 'center');
      c.fillStyle = 'rgba(255,255,255,.12)'; rr(c, x - 28, 42, 56, 4, 2); c.fill();
      c.fillStyle = m > 1 ? GOLD : acc; rr(c, x - 28, 42, Math.max(4, 56 * clamp(this.comboT / 2.4, 0, 1)), 4, 2); c.fill();
    }

    // resonance meter
    const mw = 300, mx = W / 2 - mw / 2, my = 28, mh = 11;
    const cres = this.crescendo > 0, full = this.resonance >= 100 && !cres;
    c.font = '600 10px ' + FONT;
    if (cres) { c.fillStyle = GOLD; spacedText(c, 'CRESCENDO', W / 2, 18, 4, 'center'); }
    else if (full) {
      c.fillStyle = Math.sin(t * 10) > 0 ? GOLD : '#ffffff';
      spacedText(c, Input.touch ? 'CRESCENDO READY' : 'CRESCENDO READY · CLICK / SPACE', W / 2, 18, 3, 'center');
    } else { c.fillStyle = 'rgba(190,205,255,.6)'; spacedText(c, 'RESONANCE', W / 2, 18, 4, 'center'); }
    c.fillStyle = 'rgba(255,255,255,.1)'; rr(c, mx, my, mw, mh, mh / 2); c.fill();
    const frac = cres ? this.crescendo / CRESCENDO_TIME : this.resonance / 100;
    if (frac > 0.01) {
      const mg = c.createLinearGradient(mx, 0, mx + mw, 0);
      if (cres || full) { mg.addColorStop(0, '#ffb347'); mg.addColorStop(0.5, '#fff3c4'); mg.addColorStop(1, GOLD); }
      else { mg.addColorStop(0, '#4cc9ff'); mg.addColorStop(0.55, '#b388ff'); mg.addColorStop(1, '#ff7ad9'); }
      c.fillStyle = mg; rr(c, mx, my, Math.max(mh, mw * frac), mh, mh / 2); c.fill();
      if (cres || full) {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + 0.25 * Math.sin(t * 10);
        c.drawImage(Sprites.glow(GOLD), mx - 20, my - 18, mw + 40, mh + 36);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
    }
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; rr(c, mx + 0.5, my + 0.5, mw - 1, mh - 1, mh / 2); c.stroke();

    // stage + lives
    const st = this.stage, num = (this.stageIdx % 4) + 1;
    c.fillStyle = 'rgba(190,205,255,.6)'; c.font = '600 10px ' + FONT;
    spacedText(c, 'ACT ' + this.act.roman + ' · ' + (st.boss ? 'FINALE' : num + ' OF 4') + (this.loop ? ' · ENCORE ' + this.loop : ''), W - 22, 18, 3, 'right');
    const shown = Math.min(this.lives, 6);
    for (let i = 0; i < shown; i++) {
      const x = W - 22 - 26 - i * 32, y = 34;
      const lg = c.createLinearGradient(0, y, 0, y + 8); lg.addColorStop(0, '#ffffff'); lg.addColorStop(1, acc);
      c.fillStyle = lg; rr(c, x, y, 26, 8, 4); c.fill();
    }
    if (this.lives > 6) { c.fillStyle = '#ffffff'; c.font = '700 13px ' + FONT; c.textAlign = 'right'; c.fillText('+' + (this.lives - 6), W - 22 - 6 * 32 - 2, 43); }

    // active effect pills
    let px = 12;
    const e = this.eff;
    for (const id in e) {
      if (e[id] <= 0) continue;
      const pu = POWERUPS[id], total = pu.dur * (pu.bad ? 1 : 1 + 0.4 * this.perk('sustain'));
      c.fillStyle = 'rgba(6,8,22,.75)'; rr(c, px, H - 26, 74, 18, 9); c.fill();
      c.strokeStyle = rgba(pu.color, 0.8); c.lineWidth = 1; rr(c, px + 0.5, H - 25.5, 73, 17, 9); c.stroke();
      drawIcon(c, pu.icon, px + 12, H - 17, 5, pu.color);
      c.fillStyle = 'rgba(255,255,255,.14)'; rr(c, px + 23, H - 19, 44, 4, 2); c.fill();
      c.fillStyle = pu.color; rr(c, px + 23, H - 19, Math.max(4, 44 * clamp(e[id] / total, 0, 1)), 4, 2); c.fill();
      px += 80;
    }
  },

  drawBanners(c) {
    const st = this.stage, t = this.stageT;
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    // stage intro
    if (t < 2.5 && this.phase !== 'clear') {
      const a = clamp(t / 0.3, 0, 1) * clamp((2.5 - t) / 0.5, 0, 1), y = 520 - Ease.outCubic(clamp(t / 0.5, 0, 1)) * 14;
      c.globalAlpha = a;
      c.fillStyle = st.boss ? '#ff8aa0' : this.act.accent; c.font = '600 13px ' + FONT;
      spacedText(c, 'ACT ' + this.act.roman + ' — ' + this.act.name + (st.boss ? ' — FINALE' : ''), W / 2, y - 44, 5, 'center');
      c.fillStyle = '#ffffff'; c.font = '800 46px ' + FONT;
      spacedText(c, st.name.toUpperCase(), W / 2, y, 6, 'center');
      c.globalAlpha = 1;
    }
    // serve hint
    if (this.phase === 'serve' && this.phaseT > 0.9 && t > 2.3) {
      c.globalAlpha = 0.45 + 0.35 * Math.sin(this.phaseT * 4);
      c.fillStyle = '#ffffff'; c.font = '600 13px ' + FONT;
      spacedText(c, Input.touch ? 'TAP TO LAUNCH' : 'CLICK OR PRESS SPACE TO LAUNCH', W / 2, 560, 4, 'center');
      c.globalAlpha = 1;
    }
    // stage clear
    if (this.phase === 'clear') {
      const k = this.phaseT, info = this.clearInfo, y = 300;
      const a = clamp((k - 0.25) / 0.3, 0, 1), sc = 0.7 + 0.3 * Ease.outBack(clamp((k - 0.25) / 0.45, 0, 1));
      c.globalAlpha = a;
      c.fillStyle = GOLD; c.font = '800 ' + (58 * sc).toFixed(1) + 'px ' + FONT;
      spacedText(c, info && info.boss ? 'SILENCED' : 'STAGE CLEAR', W / 2, y, 8, 'center');
      c.globalAlpha = 1;
      if (info) {
        const line = (label, val, i) => {
          const la = clamp((k - 0.8 - i * 0.35) / 0.3, 0, 1);
          if (la <= 0) return;
          c.globalAlpha = la; c.font = '600 15px ' + FONT;
          c.fillStyle = 'rgba(210,220,255,.85)'; spacedText(c, label, W / 2 - 14, y + 48 + i * 30, 3, 'right');
          c.fillStyle = '#ffffff'; c.font = '700 17px ' + FONT; c.textAlign = 'left'; c.fillText('+' + fmt(val), W / 2 + 14, y + 49 + i * 30);
          c.textAlign = 'center'; c.globalAlpha = 1;
        };
        line('CLEAR BONUS', info.bonus, 0);
        if (info.flawless) line('FLAWLESS', info.flawless, 1);
      }
    }
    if (this.phase === 'lost' && this.lives > 0) {
      c.globalAlpha = clamp(1 - this.phaseT, 0, 1);
      c.fillStyle = '#ff8aa0'; c.font = '700 22px ' + FONT;
      spacedText(c, this.lives === 1 ? 'LAST LIFE' : this.lives + ' LIVES LEFT', W / 2, 560, 5, 'center');
      c.globalAlpha = 1;
    }
  }
};
