'use strict';
/* ==========================================================================
   HADAL — game state & simulation
   ========================================================================== */

const BOSS_SONG = { medusa: 'boss1', lantern: 'boss2', leviathan: 'boss3' };
const DESCEND_LIMIT = 21;         // bricks reaching this row crush the hull

const Game = {
  mode: 'title',                  // 'title' (attract demo) | 'play' | 'over' | 'win'
  phase: 'idle',                  // intro | serve | live | dying | clearing | perk | dive | idle
  phaseT: 0,
  paused: false, demo: false, auto: false, god: false,
  t: 0, rt: 0,
  timeScale: 1, slowmo: 0, hitstop: 0, shake: 0, flash: 0, flashCol: '#ffffff',
  run: null, stage: null, dive: null, boss: null,
  grid: [], bricks: [], movers: [], balls: [], caps: [], shots: [], hazards: [], inks: [], lights: [], queue: [],
  deadCount: 0,
  paddle: null, fx: null,
  net: 0, netFlash: 0,
  chain: 0, chainT: 0,
  focus: { v: 1, max: 1, on: false, k: 0, lock: false },
  shownScore: 0, depthShown: 0,
  pulseCount: 0, bounceCount: 0, rackT: 1, laserT: 0,
  clearDur: 1.9, introDur: 1.15, lockShown: false,
  popT: 0, popN: 0, labelT: -9, labelN: 0,

  /* ------------------------------------------------------------ helpers */
  newPaddle() {
    return { x: W / 2, y: PADDLE_Y, w: PADDLE_W, tw: PADDLE_W, h: PADDLE_H, vx: 0, svx: 0, kv: 0,
      pulseT: 0, pulseCd: 0, pulseA: 0, stun: 0, glow: 0, lastHitT: -9, lastHitBall: null };
  },
  newFx() { return { wide: 0, shrink: 0, laser: 0, pierce: 0, sticky: 0, slow: 0, fast: 0 }; },
  newRun() {
    return { gi: 0, score: 0, lives: 3, perks: {}, ckpt: null,
      stats: { bricks: 0, pulses: 0, maxChain: 0, lost: 0, time: 0, caps: 0 } };
  },
  perk(id) { return this.run ? (this.run.perks[id] || 0) : 0; },
  maxLives() { return 5 + this.perk('tank'); },
  chainWindow() { return 2.2 + 0.6 * this.perk('chain'); },
  multCap() { return 8 + 2 * this.perk('chain'); },
  mult() { return Math.min(this.multCap(), 1 + Math.floor(this.chain / 4)); },
  zone() { return ZONES[this.stage ? this.stage.zi : 0]; },
  paddleTop() { return this.paddle.y - easeOut(this.paddle.pulseA) * 7; },
  realBalls() { let n = 0; for (let i = 0; i < this.balls.length; i++) if (!(this.balls[i].ghost > 0)) n++; return n; },
  later(delay, fn) { this.queue.push({ t: delay, fn }); },
  /* a caption above the hull; quick successive captions stack instead of overlapping */
  label(str, color, size) {
    const p = this.paddle;
    this.labelN = this.rt - this.labelT < 0.8 ? this.labelN + 1 : 0;
    this.labelT = this.rt;
    FX.text(clamp(p.x, 90, W - 90), p.y - 36 - (this.labelN % 4) * 21, str, color, size || 16, 1.15);
  },
  light(x, y, r, a, life) { if (this.lights.length < 40) this.lights.push({ x, y, r, a, life, max: life }); },
  bump(shake, stop) {
    if (Save.data.settings.shake) this.shake = Math.max(this.shake, shake);
    if (stop) this.hitstop = Math.max(this.hitstop, stop);
  },
  flashScreen(a, col) {
    if (!Save.data.settings.flash) a *= 0.25;
    if (a > this.flash) { this.flash = a; this.flashCol = col || '#ffffff'; }
  },

  addScore(base, x, y, color, size) {
    if (this.demo || !this.run) return 0;
    const m = this.mult();
    const pts = Math.round(base * m * (1 + 0.2 * this.perk('score')));
    if (pts <= 0) return 0;
    this.run.score += pts;
    if (x !== undefined && pts >= 20) {
      if (this.rt - this.popT > 0.12) { this.popT = this.rt; this.popN = 0; }
      if (this.popN++ < 3) FX.text(x, y, '+' + fmt(pts), color || '#ffffff', size || (m >= 4 ? 17 : 13), 0.75);
    }
    return pts;
  },

  /* --------------------------------------------------------- run / flow */
  boot() {
    this.paddle = this.newPaddle();
    this.fx = this.newFx();
    this.startDemo();
  },

  clearWorld() {
    this.grid = []; this.bricks = []; this.movers = []; this.balls = []; this.caps = []; this.shots = [];
    this.hazards = []; this.inks = []; this.lights = []; this.queue = []; this.boss = null;
    this.deadCount = 0;
    this.fx = this.newFx();
    this.chain = 0; this.chainT = 0; this.net = 0; this.netFlash = 0;
    this.slowmo = 0; this.hitstop = 0; this.timeScale = 1;
    this.focus.on = false; this.focus.lock = false;
    Sound.focus(false);
    FX.clear();
  },

  startDemo() {
    this.mode = 'title'; this.demo = true; this.auto = false; this.paused = false;
    this.run = this.newRun();
    this.shownScore = 0;
    const pool = [0, 1, 2, 3, 4, 6, 7, 9];
    let gi = this.stage ? pick(pool) : pick([0, 1]);          // the very first demo is always in the sunlit shallows
    if (this.stage && this.stage.gi === gi) gi = pool[(pool.indexOf(gi) + 1) % pool.length];
    this.run.gi = gi;
    Bg.blendTo(STAGES[gi].zone);
    Bg.speed = 0;
    this.dive = null;
    this.demoBlend = 0;
    Sound.quiet(true);
    Sound.muffle(false);
    Sound.music('sun');
    this.loadStage(gi);
  },

  startRun(ckpt) {
    this.mode = 'play'; this.demo = false; this.paused = false;
    Sound.quiet(false); Sound.muffle(false);
    const r = this.newRun();
    if (ckpt) {
      r.gi = clamp(ckpt.gi | 0, 0, STAGES.length - 1);
      r.score = +ckpt.score || 0;
      r.lives = clamp(+ckpt.lives || 3, 1, 9);
      r.perks = Object.assign({}, ckpt.perks || {});
      r.stats = Object.assign(r.stats, ckpt.stats || {});
    }
    this.run = r;
    this.shownScore = r.score;
    this.pulseCount = 0; this.bounceCount = 0; this.rackT = 1.2;
    this.focus.v = 1 + 0.5 * this.perk('sonar');
    this.saveCheckpoint();
    Bg.setZone(STAGES[r.gi].zone);
    Bg.speed = 0;
    this.loadStage(r.gi);
  },

  saveCheckpoint() {
    const r = this.run;
    r.ckpt = { gi: r.gi, score: r.score, lives: Math.max(r.lives, 3), perks: Object.assign({}, r.perks), stats: Object.assign({}, r.stats) };
    if (!this.auto && !this.demo && r.gi % 3 === 0) {
      Save.data.ckpt = r.gi > 0 ? JSON.parse(JSON.stringify(r.ckpt)) : null;
      Save.store();
    }
  },

  loadStage(gi) {
    const def = STAGES[gi], zi = def.zone, zone = ZONES[zi];
    this.clearWorld();
    this.stage = {
      gi, def, zi, t: 0, remaining: 0, total: 0, lostLife: false,
      scoreStart: this.run.score, pity: 0, drought: 0, lockTries: 0, maxChain: 0,
      speed: (zone.speed + (gi % 3) * 9) * (1 - 0.07 * this.perk('calm')),
      dark: def.dark || 0,
      currents: def.currents || [],
      vents: (def.vents || []).map((x, i) => ({ x, t: 3.5 + i * 2.6, on: 0, warned: false })),
      descend: def.descend || 0, descT: (def.descend || 0) + 2,
      firstServe: true, clearBonus: 0, flawless: 0, lit: 0,
    };
    this.stage.maxSpeed = this.stage.speed * 1.42;
    for (let r = 0; r < ROWS; r++) this.grid.push(new Array(COLS).fill(null));
    for (let r = 0; r < def.map.length && r < ROWS; r++) {
      const row = def.map[r];
      for (let c = 0; c < COLS; c++) {
        const ch = row[c];
        if (ch && ch !== '.') this.addBrick(ch, r, c);
      }
    }
    if (def.boss) this.boss = Bosses.create(def.boss);

    const p = this.paddle;
    p.stun = 0; p.pulseT = 0; p.pulseCd = 0; p.pulseA = 0; p.kv = 0;
    this.net = this.perk('net');
    this.lockShown = false;
    this.spawnServeBall();
    this.phase = 'intro'; this.phaseT = 0;
    this.introDur = this.demo ? 0.9 : 1.2;
    this.depthShown = def.depth;
    AI.reset();

    if (!this.demo) {
      Sound.music(def.boss ? BOSS_SONG[def.boss] : zone.song);
      if (def.depth > Save.data.deepest && !this.auto) { Save.data.deepest = def.depth; Save.store(); }
      const label = zone.name + '  ·  ' + (zi + 1) + '–' + ((gi % 3) + 1);
      if (def.boss) { UI.banner('Warning  ·  ' + fmt(def.depth) + ' m', def.name, def.note || '', 'boss'); Sound.play('warn'); }
      else UI.banner(label, def.name, def.note || (fmt(def.depth) + ' m'), '');
    }
  },

  addBrick(ch, r, c) {
    const m = MAP_CHARS[ch];
    if (!m) return null;
    const T = BT[m.t], zone = ZONES[this.stage.zi];
    let color = T.color;
    if (m.t === 'coral') color = zone.coral[m.ci];
    else if (m.t === 'stone') color = zone.stone;
    else if (m.t === 'basalt') color = zone.basalt;
    const k = {
      type: m.t, r, c, x: c * CELL_W, y: BRICK_TOP + r * CELL_H, w: CELL_W, h: CELL_H,
      hp: T.hp, maxHp: T.hp, dmg: 0, color, alive: true, solid: true, counts: !!T.counts,
      flash: 0, bump: 0, app: 0, born: 0.12 + r * 0.045 + Math.abs(c - 6) * 0.03,
      seed: (c * 0.137 + r * 0.31) % 1, fuse: 0, yo: 0, vis: 1, mover: false,
    };
    if (T.mover) {
      k.mover = true; k.x += 7; k.w = CELL_W - 14; k.y += 2; k.h = CELL_H - 4;
      k.vx = (Math.random() < 0.5 ? -1 : 1) * rand(46, 72); k.ty = k.y; k.fly = false;
      this.movers.push(k);
    } else this.grid[r][c] = k;
    this.bricks.push(k);
    if (k.counts) { this.stage.remaining++; this.stage.total++; }
    return k;
  },

  /* a free-roaming brick (boss minions) */
  spawnMover(type, x, y, row, vx, opts) {
    const T = BT[type];
    const k = {
      type, r: row, c: 0, x, y, w: 50, h: 26, hp: T.hp, maxHp: T.hp, dmg: 0, color: T.color, alive: true, solid: true,
      counts: false, flash: 0, bump: 0, app: 1, born: 0, seed: Math.random(), fuse: 0, yo: 0, vis: 1,
      mover: true, vx, ty: BRICK_TOP + row * CELL_H + 2, fly: false,
    };
    if (opts) Object.assign(k, opts);
    this.movers.push(k); this.bricks.push(k);
    return k;
  },

  newBall(x, y, dx, dy) {
    return { x, y, dx, dy, speed: this.stage.speed, r: BALL_R, stuck: false, serve: false, off: 0, stickT: 0,
      charge: 0, blast: false, ghost: 0, pulsed: false, hitCd: 0, idle: 0, boost: 0, dead: false, trail: [] };
  },
  spawnServeBall() {
    const p = this.paddle;
    const b = this.newBall(p.x, p.y - BALL_R, 0, -1);
    b.stuck = true; b.serve = true; b.off = 0;
    this.balls.push(b);
    return b;
  },

  togglePause(force) {
    if (this.mode !== 'play' || this.phase === 'perk') return;
    const want = force === undefined ? !this.paused : !!force;
    if (want === this.paused) return;
    this.paused = want;
    Sound.muffle(want);
    if (want) UI.pause(); else UI.closeAll();
  },

  toTitle() {
    if (this.mode === 'play' && this.run && !this.auto && this.run.score > Save.data.best) { Save.data.best = this.run.score; Save.store(); }
    this.paused = false;
    UI.closeAll();
    this.startDemo();
    UI.title();
  },

  /* ------------------------------------------------------------- update */
  update(rdt) {
    this.rt += rdt;
    if (this.paused) return;

    this.shake = Math.max(0, this.shake - rdt * 3.2);
    this.flash = Math.max(0, this.flash - rdt * 2.4);
    const target = this.run ? this.run.score : 0;
    this.shownScore = Math.abs(target - this.shownScore) < 1 ? target : approach(this.shownScore, target, 9, rdt);
    if (this.demo && this.demoBlend < 1) { this.demoBlend = Math.min(1, this.demoBlend + rdt * 0.9); Bg.k = smooth(this.demoBlend); }

    const act = Input.consume();
    if (this.hitstop > 0) { this.hitstop -= rdt; if (act) Input.actionQ = 1; return; }

    this.updateFocus(rdt);
    let ts = this.focus.on ? 0.36 : 1;
    if (this.slowmo > 0) { this.slowmo -= rdt; ts = Math.min(ts, 0.3); }
    this.timeScale = approach(this.timeScale, ts, 16, rdt);
    const dt = rdt * this.timeScale;
    this.t += dt; this.phaseT += rdt;

    if (this.demo || this.auto) AI.update(rdt);
    this.runQueue(dt);
    const p = this.paddle;

    switch (this.phase) {
      case 'intro':
        this.updatePaddle(rdt); this.updateBricks(dt, rdt); this.updateMovers(dt); this.updateBalls(dt);
        if (this.boss) this.boss.update(dt);
        if (this.phaseT > this.introDur && (!this.boss || this.boss.ready)) { this.phase = 'serve'; this.phaseT = 0; }
        break;

      case 'serve':
        this.updatePaddle(rdt); this.updateBricks(dt, rdt); this.updateMovers(dt); this.updateBalls(dt);
        if (this.boss) this.boss.update(dt);
        if (act && !this.demo && !this.auto) this.launch();
        break;

      case 'live':
        if (act && !this.demo && !this.auto) this.action();
        this.stage.t += dt; this.stage.drought += dt; this.run.stats.time += dt;
        this.updatePaddle(rdt); this.updateBricks(dt, rdt); this.updateMovers(dt); this.updateFields(dt);
        this.updateBalls(dt); this.updateCaps(dt); this.updateShots(dt); this.updateHazards(dt);
        if (this.boss) this.boss.update(dt);
        this.updateTimers(dt);
        if (this.phase === 'live' && this.stage.descend) {
          this.stage.descT -= dt;
          if (this.stage.descT <= 0) { this.stage.descT = this.stage.descend; this.shiftDown(); }
        }
        if (this.phase === 'live') {
          if (!this.boss && this.stage.remaining > 0 && this.stage.drought > 42) this.crumble();
          if (!this.boss && this.stage.remaining <= 0) this.stageClear();
          else if (this.realBalls() === 0) this.loseBalls();
        }
        break;

      case 'dying':
        this.updatePaddle(rdt); this.updateBricks(dt, rdt); this.updateMovers(dt);
        if (this.boss) this.boss.update(dt);
        if (this.phaseT > 1.15) {
          if (!this.demo && this.run.lives <= 0) this.gameOver();
          else { this.spawnServeBall(); this.phase = 'serve'; this.phaseT = 0; }
        }
        break;

      case 'clearing': {
        this.updatePaddle(rdt); this.updateBricks(dt, rdt); this.updateMovers(dt);
        if (this.boss) this.boss.update(dt);
        // recall pearls and sweep up capsules
        const tx = p.x, ty = p.y - 6;
        for (let i = this.balls.length - 1; i >= 0; i--) {
          const b = this.balls[i];
          b.stuck = false;
          b.x = approach(b.x, tx, 5, rdt); b.y = approach(b.y, ty, 5, rdt);
          this.pushTrail(b);
          if (Math.hypot(b.x - tx, b.y - ty) < 14 && this.phaseT > 0.5) {
            FX.burst(b.x, b.y, '#dff8ff', 8, 160, 0.4, 2.6);
            this.balls.splice(i, 1);
          }
        }
        for (let i = this.caps.length - 1; i >= 0; i--) {
          const c = this.caps[i];
          c.x = approach(c.x, tx, 6, rdt); c.y = approach(c.y, ty, 6, rdt);
          if (Math.hypot(c.x - tx, c.y - ty) < 20) {
            this.addScore(50, c.x, c.y - 16, POWERUPS[c.type].color);
            FX.burst(c.x, c.y, POWERUPS[c.type].color, 8, 160, 0.4, 2.6);
            this.caps.splice(i, 1);
          }
        }
        this.updateTimers(dt);
        if (this.phaseT > this.clearDur) {
          if (this.demo) this.startDemo();
          else if (this.stage.gi >= STAGES.length - 1) this.victory();
          else this.offerPerks();
        }
        break;
      }

      case 'perk':
        this.updatePaddle(rdt);
        break;

      case 'dive': {
        this.updatePaddle(rdt);
        const d = this.dive, k = clamp(this.phaseT / d.dur, 0, 1);
        Bg.speed = Math.pow(Math.sin(Math.PI * k), 1.3) * (d.zoneChange ? 1500 : 1250);
        if (d.zoneChange) Bg.k = smooth(clamp((k - 0.12) / 0.7, 0, 1));
        this.depthShown = lerp(d.from, d.to, easeInOut(k));
        if (Math.random() < rdt * 30 * Math.sin(Math.PI * k)) FX.bubbles(p.x + rand(-p.w / 2, p.w / 2), p.y - 4, 1, 8, 3);
        if (k >= 1) {
          Bg.speed = 0;
          this.run.gi = d.next;
          Bg.setZone(STAGES[d.next].zone);
          this.dive = null;
          if (d.zoneChange && this.run.lives < this.maxLives()) { this.run.lives++; this.zoneGift = true; }
          if (d.next % 3 === 0) this.saveCheckpoint();
          this.loadStage(d.next);
          if (this.zoneGift) {
            this.zoneGift = false;
            FX.text(W - 60, TOP + 26, '+1 PEARL', '#ffffff', 14, 2.2);
            Sound.play('life');
          }
        }
        break;
      }
      default: break;
    }

    this.updateInks(dt);
    for (let i = this.lights.length - 1; i >= 0; i--) {
      this.lights[i].life -= dt;
      if (this.lights[i].life <= 0) this.lights.splice(i, 1);
    }
    FX.update(dt);
    Sound.intensity(this.musicIntensity());
  },

  musicIntensity() {
    if (this.mode === 'title') return 0.2;
    if (this.mode !== 'play') return 0.12;
    if (this.boss) return this.phase === 'live' ? 1 : this.phase === 'clearing' ? 0.3 : 0.62;
    if (this.phase === 'live') {
      const st = this.stage, prog = st.total ? 1 - st.remaining / st.total : 0;
      return clamp(0.36 + prog * 0.4 + Math.min(this.chain, 12) / 12 * 0.3, 0, 1);
    }
    if (this.phase === 'dive') return 0.42;
    if (this.phase === 'serve' || this.phase === 'intro') return 0.3;
    return 0.24;
  },

  runQueue(dt) {
    if (!this.queue.length) return;
    const q = this.queue;
    this.queue = [];
    for (let i = 0; i < q.length; i++) {
      const e = q[i];
      e.t -= dt;
      if (e.t <= 0) e.fn(); else this.queue.push(e);
    }
  },

  updateFocus(rdt) {
    const f = this.focus;
    f.max = 1 + 0.5 * this.perk('sonar');
    const want = !this.demo && !this.auto && Input.focus && this.phase === 'live';
    if (!want) f.lock = false;
    const was = f.on;
    f.on = want && !f.lock && (was ? f.v > 0 : f.v > 0.12);
    if (f.on) {
      f.v -= rdt / 2.4;
      if (f.v <= 0) { f.v = 0; f.on = false; f.lock = true; }
    } else if (this.phase === 'live' || this.phase === 'serve') {
      f.v = Math.min(f.max, f.v + rdt * 0.11 * (1 + 0.4 * this.perk('sonar')));
    }
    if (f.on !== was) {
      Sound.focus(f.on);
      Sound.play(f.on ? 'sonarOn' : 'sonarOff');
      if (f.on) FX.ring(this.paddle.x, this.paddle.y, 20, 560, 1.0, this.zone().accent, 2);
    }
    f.k = approach(f.k, f.on ? 1 : 0, 10, rdt);
  },

  updatePaddle(rdt) {
    const p = this.paddle;
    let tw = PADDLE_W * (1 + 0.14 * this.perk('wide'));
    if (this.fx.wide > 0) tw *= 1.45;
    if (this.fx.shrink > 0) tw *= 0.66;
    p.tw = tw;
    p.w = Math.abs(p.w - tw) < 0.2 ? tw : approach(p.w, tw, 12, rdt);
    const half = p.w / 2, ox = p.x;
    if (p.stun > 0) {
      p.stun -= rdt;
      if (Math.random() < rdt * 30) FX.spray(p.x + rand(-half, half), p.y + 4, '#fff3a0', 1, 160, 0.25, -Math.PI / 2, 2.4);
    } else if (this.demo || this.auto) {
      const mv = AI.maxV * rdt;
      p.x += clamp(AI.target - p.x, -mv, mv);
    } else if (Input.mode === 'keys') {
      const dir = clamp((Input.right ? 1 : 0) - (Input.left ? 1 : 0) + Input.padAxis, -1, 1);
      p.kv = approach(p.kv, dir * 920, dir ? 20 : 30, rdt);
      p.x += p.kv * rdt;
    } else {
      p.x = Input.x; p.kv = 0;
    }
    p.x = clamp(p.x, half, W - half);
    p.vx = (p.x - ox) / Math.max(rdt, 1e-4);
    p.svx = approach(p.svx, p.vx, 18, rdt);
    p.pulseT = Math.max(0, p.pulseT - rdt);
    p.pulseCd = Math.max(0, p.pulseCd - rdt);
    p.pulseA = Math.max(0, p.pulseA - rdt * 5.5);
    p.glow = Math.max(0, p.glow - rdt * 3.5);
    if (Math.abs(p.svx) > 380 && Math.random() < rdt * 16) {
      FX.bubbles(p.x - Math.sign(p.svx) * half, p.y + p.h * 0.6, 1, 6, 2.2);
    }
  },

  /* ------------------------------------------------------ player actions */
  launch() {
    let any = false;
    for (let i = 0; i < this.balls.length; i++) {
      if (this.balls[i].stuck) { this.release(this.balls[i], true); any = true; }
    }
    if (!any) return;
    this.phase = 'live'; this.phaseT = 0;
    Sound.play('launch');
    const p = this.paddle;
    FX.ring(p.x, p.y, 8, 54, 0.35, this.zone().accent, 2.5);
    FX.bubbles(p.x, p.y, 5, p.w * 0.6, 3);
    const st = this.stage;
    if (st.firstServe) {
      st.firstServe = false;
      const src = this.balls[0], n = this.perk('twin');
      for (let i = 0; i < n; i++) {
        const a = (i % 2 ? 1 : -1) * (0.42 + 0.2 * Math.floor(i / 2));
        const nb = this.newBall(src.x, src.y, Math.sin(a), -Math.cos(a));
        this.balls.push(nb);
      }
      const g = this.perk('gift');
      for (let i = 0; i < g; i++) this.dropCapsule(W / 2 + (i ? 150 : -150) * (g > 1 ? 1 : 0), TOP + 20, this.rollPower(true));
    }
  },

  release(b, serve) {
    const p = this.paddle;
    b.stuck = false; b.serve = false;
    let ang;
    if (serve) {
      ang = clamp(p.svx / 1500, -0.5, 0.5) + rand(-0.12, 0.12);
      if (Math.abs(ang) < 0.09) ang = (Math.random() < 0.5 ? -1 : 1) * rand(0.1, 0.22);
    } else {
      ang = clamp(b.off / (p.w / 2), -1, 1) * 1.08;
    }
    b.dx = Math.sin(ang); b.dy = -Math.cos(ang);
    b.y = this.paddleTop() - b.r - 1;
    b.idle = 0;
    if (!serve) { p.pulseA = 1; this.perfect(b); }
  },

  /* click / space while the pearl is in play: release tethered pearls, or pulse */
  action() {
    if (this.phase === 'serve') { this.launch(); return; }
    if (this.phase !== 'live') return;
    let released = false;
    for (let i = 0; i < this.balls.length; i++) {
      if (this.balls[i].stuck) { this.release(this.balls[i], false); released = true; }
    }
    if (released) return;
    const p = this.paddle;
    if (p.pulseCd > 0 || p.stun > 0) return;
    p.pulseT = 0.17; p.pulseCd = 0.8; p.pulseA = 1;
    const lb = p.lastHitBall;
    // forgiving: a press just *after* contact still counts
    if (lb && this.rt - p.lastHitT < 0.09 && !lb.pulsed && !lb.dead && this.balls.indexOf(lb) >= 0) {
      this.perfect(lb);
    } else Sound.play('pulse0');
  },

  perfect(b) {
    const p = this.paddle;
    b.charge = 1 + this.perk('amp'); b.pulsed = true;
    p.pulseCd = Math.min(p.pulseCd, 0.22);            // a clean pulse re-arms quickly
    if (this.chain > 0) this.chainT = this.chainWindow();
    if (this.run) this.run.stats.pulses++;
    this.addScore(25, b.x, b.y - 22, '#8ff6ff', 13);
    FX.ring(b.x, p.y, 8, 76, 0.38, '#8ff6ff', 3.5);
    FX.spray(b.x, p.y - 2, '#bffcff', 12, 520, 0.35, -Math.PI / 2, 1.5);
    this.light(b.x, p.y, 160, 0.8, 0.4);
    this.bump(0.28, 0.035);
    p.glow = 1;
    Sound.play('pulse', Sound.root + 12);
    const dc = this.perk('charge');
    if (dc) {
      this.pulseCount++;
      if (this.pulseCount % (5 - dc) === 0) { b.blast = true; Sound.play('arm'); FX.text(b.x, p.y - 44, 'ARMED', '#ffd35c', 13); }
    }
  },

  /* ---------------------------------------------------------------- balls */
  pushTrail(b) {
    const tr = b.trail;
    tr.push(b.x, b.y);
    if (tr.length > 28) tr.splice(0, 2);
  },

  fixAngle(b) {
    const m = 0.2;
    if (Math.abs(b.dy) < m) {
      const s = b.dy < 0 ? -1 : b.dy > 0 ? 1 : (Math.random() < 0.5 ? -1 : 1);
      b.dy = s * m;
      b.dx = (b.dx < 0 ? -1 : 1) * Math.sqrt(1 - m * m);
    } else {
      const l = Math.hypot(b.dx, b.dy) || 1;
      b.dx /= l; b.dy /= l;
    }
  },

  updateBalls(dt) {
    const p = this.paddle;
    const mul = (this.fx.slow > 0 ? 0.72 : 1) * (this.fx.fast > 0 ? 1.28 : 1);
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.hitCd > 0) b.hitCd -= dt;
      if (b.stuck) {
        b.x = clamp(p.x + b.off, b.r, W - b.r);
        b.y = this.paddleTop() - b.r;
        if (!b.serve && this.phase === 'live') { b.stickT -= dt; if (b.stickT <= 0) this.release(b, false); }
        this.pushTrail(b);
        continue;
      }
      if (b.ghost > 0) {
        b.ghost -= dt;
        if (b.ghost <= 0) { FX.burst(b.x, b.y, '#c9b8ff', 8, 140, 0.4, 2.6); this.balls.splice(i, 1); continue; }
      }
      b.idle += dt;
      if (b.idle > 9) {                       // caught in a loop: nudge it out
        b.idle = 0;
        const a = rand(0.2, 0.42) * (Math.random() < 0.5 ? -1 : 1), cs = Math.cos(a), sn = Math.sin(a);
        const dx = b.dx * cs - b.dy * sn, dy = b.dx * sn + b.dy * cs;
        b.dx = dx; b.dy = dy; this.fixAngle(b);
      }
      if (b.boost > 0) b.boost -= dt;
      this.applyFields(b, dt);
      let dist = b.speed * mul * (b.boost > 0 ? 1.25 : 1) * (b.charge > 0 ? 1.12 : 1) * dt;
      let guard = 0;
      while (dist > 0 && guard++ < 80) {
        const step = dist < 4 ? dist : 4;
        b.x += b.dx * step; b.y += b.dy * step; dist -= step;
        this.collideWalls(b);
        if (b.dy > 0) this.collidePaddle(b);
        if (b.stuck) break;
        this.collideBricks(b);
        if (this.boss) this.boss.collide(b);
        if (b.y - b.r > H + 14) { b.dead = true; break; }
      }
      this.pushTrail(b);
      if (b.dead) {
        this.balls.splice(i, 1);
        FX.bubbles(b.x, H - 6, 6, 30, 3.5);
        FX.ring(b.x, H, 6, 60, 0.5, '#9fd4ff', 2);
      } else if ((b.charge > 0 || this.fx.pierce > 0) && Math.random() < dt * 40) {
        const o = FX.add(0, b.x + rand(-3, 3), b.y + rand(-3, 3), rand(-20, 20), rand(-20, 20), 0.35, 2.2, this.fx.pierce > 0 ? '#ff8a3d' : '#6ff3ff');
        if (o) o.drag = 2;
      } else if (Math.random() < dt * 5) {
        FX.bubbles(b.x, b.y, 1, 4, 1.6);
      }
    }
    // echoes do not keep a run alive
    if (this.phase === 'live' && this.balls.length && this.realBalls() === 0) {
      for (let i = 0; i < this.balls.length; i++) FX.burst(this.balls[i].x, this.balls[i].y, '#c9b8ff', 8, 140, 0.4, 2.6);
      this.balls.length = 0;
    }
  },

  collideWalls(b) {
    let hit = false;
    if (b.x < b.r) { b.x = b.r; if (b.dx < 0) { b.dx = -b.dx; hit = true; } }
    else if (b.x > W - b.r) { b.x = W - b.r; if (b.dx > 0) { b.dx = -b.dx; hit = true; } }
    if (b.y < TOP + b.r) { b.y = TOP + b.r; if (b.dy < 0) { b.dy = -b.dy; hit = true; } }
    if (hit) {
      Sound.play('wall');
      FX.burst(b.x, b.y, '#bfefff', 3, 90, 0.25, 1.6);
    }
    if (this.net > 0 && b.dy > 0 && b.y + b.r >= NET_Y && b.y - b.r < NET_Y + 14) {
      b.y = NET_Y - b.r; b.dy = -Math.abs(b.dy); b.idle = 0;
      this.net--; this.netFlash = 1;
      Sound.play('net');
      FX.ring(b.x, NET_Y, 8, 70, 0.45, '#5ff0d0', 3);
      FX.spray(b.x, NET_Y, '#aaffea', 10, 360, 0.4, -Math.PI / 2, 2.2);
      FX.text(b.x, NET_Y - 26, 'SAVED', '#5ff0d0', 15);
    }
  },

  collidePaddle(b) {
    const p = this.paddle, top = this.paddleTop(), half = p.w / 2;
    if (b.y + b.r < top || b.y - b.r > p.y + p.h) return;
    if (b.x < p.x - half - b.r || b.x > p.x + half + b.r) return;
    if (b.y > p.y + p.h * 0.9) return;                 // already past the hull
    this.paddleHit(b);
  },

  paddleHit(b) {
    const p = this.paddle, st = this.stage;
    const t = clamp((b.x - p.x) / (p.w / 2), -1, 1);
    let ang = t * 1.08 + clamp(p.svx / 2600, -0.2, 0.2) + rand(-0.025, 0.025);
    ang = clamp(ang, -1.22, 1.22);

    // sonar lock: when only a few stubborn bricks remain, guide the pearl
    if (!this.boss && st.remaining > 0 && st.remaining <= 3 && st.drought > 9 && st.lockTries < 3) {
      let best = null, bd = 1e9, ba = 0;
      for (let i = 0; i < this.bricks.length; i++) {
        const k = this.bricks[i];
        if (!k.alive || !k.counts) continue;
        const tx = k.x + k.w / 2, ty = k.y + k.h / 2;
        const a = Math.atan2(tx - b.x, -(ty - b.y));
        if (Math.abs(a) > 1.25) continue;
        const d = Math.abs(tx - b.x) + Math.abs(ty - b.y) * 0.2;
        if (d < bd && this.lineClear(b.x, p.y - b.r, tx, ty, k)) { bd = d; best = k; ba = a; }
      }
      if (best) {
        ang = ba;
        st.lockTries++;
        FX.bolt(b.x, p.y, best.x + best.w / 2, best.y + best.h / 2, this.zone().accent, 0.3, 1.2);
        if (!this.lockShown) { this.lockShown = true; FX.text(W / 2, p.y - 70, 'SONAR LOCK', this.zone().accent, 15, 1.4); Sound.play('lock'); }
      }
    }

    b.dx = Math.sin(ang); b.dy = -Math.cos(ang);
    b.y = this.paddleTop() - b.r - 0.5;
    b.speed = Math.min(st.maxSpeed, b.speed + 5);
    b.pulsed = false; b.idle = 0;
    p.glow = Math.max(p.glow, 0.7); p.lastHitT = this.rt; p.lastHitBall = b;

    if (this.fx.sticky > 0 && !(b.ghost > 0)) {
      b.stuck = true; b.off = b.x - p.x; b.stickT = 2.6;
      Sound.play('stick');
      return;
    }
    if (p.pulseT > 0) this.perfect(b);
    else {
      Sound.play('paddle', Sound.root - 12);
      FX.burst(b.x, p.y, '#bfefff', 4, 120, 0.3, 2);
    }
    const e = this.perk('echo');
    if (e && !(b.ghost > 0)) {
      this.bounceCount++;
      if (this.bounceCount % (5 - e) === 0 && this.balls.length < 12) {
        const g = this.newBall(b.x, b.y, -b.dx, b.dy);
        g.ghost = 6; g.speed = b.speed;
        this.fixAngle(g);
        this.balls.push(g);
        FX.ring(b.x, b.y, 4, 40, 0.4, '#c9b8ff', 2);
      }
    }
  },

  /* is the straight path free of steel (three rays, one pearl wide)? */
  lineClear(x0, y0, x1, y1, target) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, n = Math.ceil(len / 9);
    const px = -dy / len * 7, py = dx / len * 7;
    for (let i = 1; i < n; i++) {
      const u = i / n, x = x0 + dx * u, y = y0 + dy * u;
      for (let s = -1; s <= 1; s++) {
        const k = this.brickAt(x + px * s, y + py * s);
        if (k && k !== target && BT[k.type].steel) return false;
      }
    }
    return true;
  },

  /* safety net: a stage can never stall — after a long drought the pressure cracks a brick */
  crumble() {
    const st = this.stage;
    let best = null, bd = -1;
    for (let i = 0; i < this.bricks.length; i++) {
      const k = this.bricks[i];
      if (!k.alive || !k.counts) continue;
      const d = k.y + Math.random() * 40;
      if (d > bd) { bd = d; best = k; }
    }
    if (!best) return;
    const cx = best.x + best.w / 2, cy = best.y + best.h / 2;
    FX.ring(cx, cy, 60, 8, 0.5, this.zone().accent, 2.5);
    FX.text(cx, cy - 26, 'CRUMBLED', this.zone().accent, 13, 1.2);
    Sound.play('crack');
    this.damageBrick(best, 99, 'blast', 0, 0);
    st.drought = 34;                         // and another every 8 s until something is hit
  },

  collideBricks(b) {
    const r = b.r;
    let best = null, bd = r * r, bx = 0, by = 0;
    const c0 = Math.max(0, Math.floor((b.x - r) / CELL_W)), c1 = Math.min(COLS - 1, Math.floor((b.x + r) / CELL_W));
    const r0 = Math.max(0, Math.floor((b.y - r - BRICK_TOP) / CELL_H)), r1 = Math.min(ROWS - 1, Math.floor((b.y + r - BRICK_TOP) / CELL_H));
    for (let ri = r0; ri <= r1; ri++) {
      const row = this.grid[ri];
      for (let c = c0; c <= c1; c++) {
        const k = row[c];
        if (!k || !k.solid) continue;
        const qx = b.x < k.x ? k.x : b.x > k.x + k.w ? k.x + k.w : b.x;
        const qy = b.y < k.y ? k.y : b.y > k.y + k.h ? k.y + k.h : b.y;
        const dx = b.x - qx, dy = b.y - qy, d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = k; bx = dx; by = dy; }
      }
    }
    const mv = this.movers;
    for (let i = 0; i < mv.length; i++) {
      const k = mv[i];
      if (!k.alive || !k.solid) continue;
      const qx = b.x < k.x ? k.x : b.x > k.x + k.w ? k.x + k.w : b.x;
      const qy = b.y < k.y ? k.y : b.y > k.y + k.h ? k.y + k.h : b.y;
      const dx = b.x - qx, dy = b.y - qy, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = k; bx = dx; by = dy; }
    }
    if (best) this.ballBrick(b, best, bx, by, bd);
  },

  ballBrick(b, k, dx, dy, d2) {
    let nx, ny, pen;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      nx = dx / d; ny = dy / d; pen = b.r - d;
    } else {
      // centre ended up inside the brick: leave through the nearest face
      const l = b.x - k.x, rg = k.x + k.w - b.x, tp = b.y - k.y, bt = k.y + k.h - b.y;
      const m = Math.min(l, rg, tp, bt);
      if (m === l) { nx = -1; ny = 0; } else if (m === rg) { nx = 1; ny = 0; } else if (m === tp) { nx = 0; ny = -1; } else { nx = 0; ny = 1; }
      pen = m + b.r;
    }
    const T = BT[k.type];
    const cx = b.x - nx * b.r, cy = b.y - ny * b.r;
    if (b.blast) { b.blast = false; this.explode(cx, cy, 135, true); }
    let pass = false;
    if (T.steel) {
      if (k.alive) this.hitSteel(k, cx, cy);
    } else if (!k.alive) {
      pass = true;
    } else {
      const magma = this.fx.pierce > 0;
      const dmg = magma ? 99 : 1 + this.perk('heavy') + (b.charge > 0 ? 1 : 0);
      const dead = this.damageBrick(k, dmg, 'ball', nx, ny);
      if (dead) {
        if (magma) pass = true;
        else if (b.charge > 0) { b.charge--; pass = true; }
      } else if (b.charge > 0) b.charge = 0;
      b.idle = 0;
    }
    if (!pass) {
      b.x += nx * pen; b.y += ny * pen;
      const dot = b.dx * nx + b.dy * ny;
      if (dot < 0) { b.dx -= 2 * dot * nx; b.dy -= 2 * dot * ny; }
      this.fixAngle(b);
    }
  },

  hitSteel(k, x, y) {
    k.flash = 0.7;
    Sound.play('steel');
    FX.spray(x, y, '#e8f4ff', 5, 260, 0.25, 0, TAU);
  },

  /* ---------------------------------------------------------------- bricks */
  damageBrick(k, dmg, cause, nx, ny) {
    if (!k.alive) return false;
    const T = BT[k.type];
    if (T.steel && cause !== 'blast') return false;
    if (k.type === 'phantom' && !k.solid && cause === 'shot') return false;
    this.stage.drought = 0; this.stage.lockTries = 0;
    k.flash = 1; k.bump = 1;
    if (k.type === 'hot' && (cause === 'ball' || cause === 'shot')) {
      if (!k.fuse) {
        k.fuse = 1.15; k.dmg = 1;
        Sound.play('hot');
        FX.spray(k.x + k.w / 2, k.y + k.h / 2, '#ffb347', 8, 260, 0.4, 0, TAU);
      }
      return false;
    }
    k.hp -= dmg;
    if (k.hp > 0) {
      k.dmg = k.maxHp - k.hp;
      Sound.play(k.type === 'jelly' ? 'jelly' : 'stone');
      FX.shards(k.x + 6, k.y + 4, k.w - 12, k.h - 8, k.color, 3, nx ? -nx : 0, ny ? -ny : 0);
      return false;
    }
    this.destroyBrick(k, cause, nx, ny);
    return true;
  },

  destroyBrick(k, cause, nx, ny) {
    if (!k.alive) return;
    k.alive = false; k.solid = false;
    this.deadCount++;
    const T = BT[k.type], st = this.stage;
    if (k.mover) {
      const i = this.movers.indexOf(k);
      if (i >= 0) this.movers.splice(i, 1);
    } else if (this.grid[k.r] && this.grid[k.r][k.c] === k) this.grid[k.r][k.c] = null;
    if (k.counts) st.remaining--;
    const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
    const glow = T.glow || k.color;

    if (!T.steel) {
      this.chain++; this.chainT = this.chainWindow();
      if (this.chain > st.maxChain) st.maxChain = this.chain;
      if (this.run) {
        if (this.chain > this.run.stats.maxChain) this.run.stats.maxChain = this.chain;
        this.run.stats.bricks++;
      }
      this.addScore(T.score, cx, cy, lighten(k.color, 0.3));
      Sound.brick(this.chain);
      this.focus.v = Math.min(this.focus.max, this.focus.v + 0.012);
    }

    FX.shards(k.x + 3, k.y + 3, k.w - 6, k.h - 6, T.steel ? '#9aa9ba' : k.color, 7, nx ? -nx : 0, ny ? -ny : 0);
    FX.burst(cx, cy, glow, 6, 170, 0.42, 2.8);
    if (Math.random() < 0.5) FX.bubbles(cx, cy, 2, 30, 2.6);
    if (st.dark) this.light(cx, cy, 120, 0.7, 0.4);

    switch (k.type) {
      case 'mine': this.later(0.07, () => this.explode(cx, cy, 82, false)); break;
      case 'hot': this.later(0.05, () => this.explode(cx, cy, 108, true)); break;
      case 'eel': this.zapRow(k); break;
      case 'oyster': this.releasePearl(cx, cy); break;
      case 'gold':
        this.dropCapsule(cx, cy, this.rollPower(true));
        Sound.play('gold');
        FX.spray(cx, cy, '#fff1a8', 12, 320, 0.5, 0, TAU);
        break;
      case 'ink': this.inkCloud(cx, cy); break;
      case 'jelly': case 'fish': Sound.play('jelly'); break;
      case 'phantom': Sound.play('phantom'); break;
      case 'stone': case 'basalt': Sound.play('crack'); break;
      default: break;
    }

    if (cause === 'ball' || cause === 'shot') {
      const v = this.perk('volatile');
      if (v && Math.random() < 0.09 * v) this.later(0.05, () => this.explode(cx, cy, 66, false));
      const a = this.perk('arc');
      if (a && Math.random() < 0.12 * a) this.arcFrom(cx, cy);
    }
    if (k.type !== 'gold' && !T.steel) this.maybeDrop(cx, cy, k);
  },

  explode(x, y, R, big) {
    Sound.play('explode', big);
    this.bump(big ? 0.95 : 0.6, big ? 0.06 : 0.035);
    this.flashScreen(big ? 0.34 : 0.16, '#ffe9c4');
    FX.ring(x, y, 10, R * 0.95, 0.45, '#ffd9a0', 5);
    FX.ring(x, y, 6, R * 0.6, 0.3, '#ffffff', 3);
    FX.burst(x, y, '#ffb347', big ? 24 : 15, 430, 0.6, 4);
    FX.burst(x, y, '#fff3c4', 9, 260, 0.35, 5);
    FX.spray(x, y, '#ffe0a0', big ? 18 : 10, 620, 0.4, 0, TAU);
    FX.smoke(x, y, big ? 6 : 4, '#1a1016', 18, R * 0.72, 0.9, 0.42);
    FX.bubbles(x, y, big ? 10 : 6, R, 3.6);
    this.light(x, y, R * 2.6, 1, 0.65);
    const R2 = R * R;
    for (let i = 0; i < this.bricks.length; i++) {
      const k = this.bricks[i];
      if (!k.alive) continue;
      const dx = k.x + k.w / 2 - x, dy = (k.y + k.h / 2 - y) * 1.6, d2 = dx * dx + dy * dy;
      if (d2 < R2) this.later(0.02 + Math.sqrt(d2) * 0.0005, () => this.damageBrick(k, 3, 'blast', 0, 0));
    }
    if (this.boss) this.boss.blast(x, y, R);
  },

  zapRow(k) {
    Sound.play('zap');
    const y = k.y + k.h / 2, cx = k.x + k.w / 2;
    FX.bolt(0, y, cx, y, '#ffe45c', 0.3, 3);
    FX.bolt(cx, y, W, y, '#ffe45c', 0.3, 3);
    this.bump(0.4, 0);
    this.light(cx, y, 320, 0.9, 0.5);
    const row = this.grid[k.r];
    if (row) {
      for (let c = 0; c < COLS; c++) {
        const o = row[c];
        if (!o || o === k || !o.alive) continue;
        this.later(0.03 + Math.abs(c - k.c) * 0.03, () => {
          if (!o.alive) return;
          FX.burst(o.x + o.w / 2, o.y + o.h / 2, '#fff7a8', 5, 170, 0.3, 2.4);
          this.damageBrick(o, 1, 'zap', 0, 0);
        });
      }
    }
    for (let i = 0; i < this.movers.length; i++) {
      const m = this.movers[i];
      if (Math.abs(m.y + m.h / 2 - y) < 22) this.later(0.1, () => this.damageBrick(m, 1, 'zap', 0, 0));
    }
  },

  /* perk: lightning jumps to the two nearest bricks */
  arcFrom(cx, cy) {
    const near = [];
    for (let i = 0; i < this.bricks.length; i++) {
      const k = this.bricks[i];
      if (!k.alive || BT[k.type].steel) continue;
      const d = Math.hypot(k.x + k.w / 2 - cx, k.y + k.h / 2 - cy);
      if (d < 170 && d > 1) near.push({ k, d });
    }
    if (!near.length) return;
    near.sort((a, b) => a.d - b.d);
    Sound.play('zap');
    for (let i = 0; i < Math.min(2, near.length); i++) {
      const k = near[i].k;
      FX.bolt(cx, cy, k.x + k.w / 2, k.y + k.h / 2, '#9ff7ff', 0.25, 2.2);
      this.later(0.08, () => this.damageBrick(k, 1, 'zap', 0, 0));
    }
  },

  releasePearl(cx, cy) {
    Sound.play('oyster');
    FX.ring(cx, cy, 6, 60, 0.5, '#ffffff', 3);
    FX.text(cx, cy - 22, 'PEARL', '#ffffff', 14, 0.9);
    if (this.balls.length >= 12) return;
    const a = rand(-0.9, 0.9);
    const b = this.newBall(cx, cy, Math.sin(a), Math.cos(a));
    b.speed = this.stage.speed * 0.92;
    this.balls.push(b);
  },

  inkCloud(cx, cy) {
    Sound.play('ink');
    const blobs = [];
    for (let i = 0; i < 11; i++) {
      const a = Math.random() * TAU, d = Math.random() * 70;
      blobs.push({ ox: Math.cos(a) * d, oy: Math.sin(a) * d * 0.7, r: 60 + Math.random() * 70, vx: rand(-9, 9), vy: rand(-3, 12), ph: Math.random() * TAU });
    }
    this.inks.push({ x: cx, y: cy, t: 0, life: 6.5, blobs });
  },
  updateInks(dt) {
    for (let i = this.inks.length - 1; i >= 0; i--) {
      const k = this.inks[i];
      k.t += dt;
      if (k.t >= k.life) this.inks.splice(i, 1);
    }
  },

  updateBricks(dt, rdt) {
    const list = this.bricks, balls = this.balls;
    for (let i = 0; i < list.length; i++) {
      const k = list[i];
      if (!k.alive) continue;
      if (k.app < 1) { k.born -= rdt; if (k.born <= 0) k.app = Math.min(1, k.app + rdt * 3.4); }
      if (k.flash > 0) k.flash = Math.max(0, k.flash - dt * 5);
      if (k.bump > 0) k.bump = Math.max(0, k.bump - dt * 6);
      if (k.yo) { k.yo = approach(k.yo, 0, 9, dt); if (Math.abs(k.yo) < 0.3) k.yo = 0; }
      if (k.type === 'phantom') {
        const ph = (this.t * 0.24 + k.seed) % 1;
        const want = ph < 0.64;
        k.vis = approach(k.vis, want ? 1 : 0.1, 7, dt);
        if (!want) k.solid = false;
        else if (!k.solid) {
          let free = true;
          for (let j = 0; j < balls.length; j++) {
            const b = balls[j];
            if (b.x > k.x - b.r && b.x < k.x + k.w + b.r && b.y > k.y - b.r && b.y < k.y + k.h + b.r) { free = false; break; }
          }
          if (free) k.solid = true;
        }
      }
      if (k.fuse > 0) {
        k.fuse -= dt;
        if (k.fuse <= 0) this.destroyBrick(k, 'fuse', 0, 0);
      }
    }
    if (this.deadCount > 40) {
      this.bricks = this.bricks.filter((k) => k.alive);
      this.deadCount = 0;
    }
  },

  updateMovers(dt) {
    const mv = this.movers;
    for (let i = mv.length - 1; i >= 0; i--) {
      const m = mv[i];
      if (!m.alive) continue;
      if (m.y !== m.ty) { m.y = approach(m.y, m.ty, 2.2, dt); if (Math.abs(m.y - m.ty) < 0.4) m.y = m.ty; }
      m.x += m.vx * dt;
      if (m.fly) {
        if (m.x < -90 || m.x > W + 90) { m.alive = false; m.solid = false; this.deadCount++; mv.splice(i, 1); }
        continue;
      }
      const lead = m.vx > 0 ? m.x + m.w + 3 : m.x - 3;
      let turn = lead < 0 || lead > W;
      if (!turn && this.grid[m.r]) {
        const k = this.grid[m.r][Math.floor(lead / CELL_W)];
        if (k && k.alive && k.solid) turn = true;
      }
      if (turn) { m.vx = -m.vx; m.x += m.vx * dt * 2; }
      m.x = clamp(m.x, 0, W - m.w);
    }
  },

  /* the ceiling sinks one row */
  shiftDown() {
    let low = -1, top = ROWS;
    for (let i = 0; i < this.bricks.length; i++) {
      const k = this.bricks[i];
      if (!k.alive || k.mover) continue;
      if (k.r > low) low = k.r;
      if (k.r < top) top = k.r;
    }
    if (low < 0) return;
    if (low + 1 >= DESCEND_LIMIT) {
      // crushed: lose the pearls and shove the wall back up
      const up = Math.min(7, top);
      if (up > 0) {
        for (let r = 0; r < ROWS; r++) this.grid[r] = r + up < ROWS ? this.grid[r + up] : new Array(COLS).fill(null);
        for (let i = 0; i < this.bricks.length; i++) {
          const k = this.bricks[i];
          if (k.alive && !k.mover) { k.r -= up; k.y -= up * CELL_H; k.yo += up * CELL_H; }
        }
      }
      FX.text(W / 2, 600, 'CRUSHED', '#ff6b7a', 26, 1.4);
      this.loseBalls();
      return;
    }
    for (let r = ROWS - 1; r > 0; r--) this.grid[r] = this.grid[r - 1];
    this.grid[0] = new Array(COLS).fill(null);
    for (let i = 0; i < this.bricks.length; i++) {
      const k = this.bricks[i];
      if (k.alive && !k.mover) { k.r++; k.y += CELL_H; k.yo -= CELL_H; }
    }
    Sound.play('shift');
    this.bump(0.3, 0);
    if (low + 2 >= DESCEND_LIMIT - 3) Sound.play('warn');
  },

  /* --------------------------------------------------------------- fields */
  applyFields(b, dt) {
    const st = this.stage;
    for (let i = 0; i < st.currents.length; i++) {
      const c = st.currents[i];
      if (b.y > c.y0 && b.y < c.y1) {
        const vx = b.dx * b.speed + c.f * dt, vy = b.dy * b.speed, l = Math.hypot(vx, vy) || 1;
        b.dx = vx / l; b.dy = vy / l;
        this.fixAngle(b);
      }
    }
    for (let i = 0; i < st.vents.length; i++) {
      const v = st.vents[i];
      if (v.on > 0 && Math.abs(b.x - v.x) < 36 && b.y > 330) {
        const vx = b.dx * b.speed * (1 - 2.5 * dt), vy = b.dy * b.speed - 2800 * dt, l = Math.hypot(vx, vy) || 1;
        b.dx = vx / l; b.dy = vy / l;
        b.boost = 1.1; b.idle = 0;
      }
    }
  },

  updateFields(dt) {
    const st = this.stage;
    for (let i = 0; i < st.vents.length; i++) {
      const v = st.vents[i];
      if (v.on > 0) {
        v.on -= dt;
        if (Math.random() < dt * 90) {
          const o = FX.add(0, v.x + rand(-22, 22), H - rand(0, 40), rand(-30, 30), -rand(500, 900), rand(0.4, 0.8), rand(3, 6), Math.random() < 0.5 ? '#ff8a3c' : '#ffd36b');
          if (o) o.drag = 0.6;
        }
        if (Math.random() < dt * 30) FX.bubbles(v.x, H - rand(0, 300), 1, 50, 3.5);
        if (v.on <= 0) { v.on = 0; v.t = rand(5, 8); v.warned = false; }
      } else {
        v.t -= dt;
        if (v.t < 1.3) {
          if (!v.warned) { v.warned = true; }
          if (Math.random() < dt * 26) FX.bubbles(v.x, H - 8, 1, 44, 3);
        }
        if (v.t <= 0) { v.on = 1.9; Sound.play('vent'); this.bump(0.25, 0); }
      }
    }
    for (let i = 0; i < st.currents.length; i++) {
      const c = st.currents[i];
      if (Math.random() < dt * 30) {
        const o = FX.add(5, c.f > 0 ? rand(-20, W * 0.7) : rand(W * 0.3, W + 20), rand(c.y0 + 6, c.y1 - 6), Math.sign(c.f) * rand(380, 640), 0, rand(0.5, 0.9), 1.2, '#bfe9ff');
        if (o) o.a = 0.4;
      }
    }
  },

  /* -------------------------------------------------------------- capsules */
  maybeDrop(x, y, k) {
    const st = this.stage;
    if (k && k.type === 'fish') return;
    st.pity++;
    if (this.caps.length >= 4) return;
    let p = 0.105 * (1 + 0.35 * this.perk('luck'));
    if (this.boss) p *= 2.2;
    if (st.pity > 17) p = 1;
    if (Math.random() < p) { st.pity = 0; this.dropCapsule(x, y, this.rollPower(false)); }
  },

  rollPower(goodOnly) {
    const zi = this.stage.zi, pool = [];
    let total = 0;
    for (const id in POWERUPS) {
      const P = POWERUPS[id];
      if (!P.good && (goodOnly || zi < 1)) continue;
      if (id === 'life' && this.run.lives >= this.maxLives()) continue;
      if (id === 'net' && this.net >= 2) continue;
      if (id === 'multi' && this.balls.length > 7) continue;
      pool.push(id); total += P.w;
    }
    let x = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      x -= POWERUPS[pool[i]].w;
      if (x <= 0) return pool[i];
    }
    return pool[0];
  },

  dropCapsule(x, y, type) {
    if (!type || !POWERUPS[type]) return;
    this.caps.push({ x: clamp(x, 26, W - 26), y, vy: 40, type, t: 0, ph: Math.random() * TAU });
    Sound.play('drop');
  },

  updateCaps(dt) {
    const p = this.paddle, top = this.paddleTop(), st = this.stage;
    const magnet = this.perk('magnet');
    for (let i = this.caps.length - 1; i >= 0; i--) {
      const c = this.caps[i];
      c.t += dt;
      c.vy = approach(c.vy, 150, 3, dt);
      for (let j = 0; j < st.vents.length; j++) {
        const v = st.vents[j];
        if (v.on > 0 && Math.abs(c.x - v.x) < 40 && c.y > 330) c.vy = approach(c.vy, -260, 12, dt);
      }
      for (let j = 0; j < st.currents.length; j++) {
        const cu = st.currents[j];
        if (c.y > cu.y0 && c.y < cu.y1) c.x += Math.sign(cu.f) * 60 * dt;
      }
      c.y += c.vy * dt;
      c.x += Math.sin(c.t * 2.4 + c.ph) * 20 * dt;
      if (magnet && POWERUPS[c.type].good && c.y > 260) c.x = approach(c.x, p.x, 1.9, dt);
      c.x = clamp(c.x, 20, W - 20);
      if (c.y + 15 >= top && c.y - 15 <= p.y + p.h && Math.abs(c.x - p.x) < p.w / 2 + 15) {
        this.caps.splice(i, 1);
        this.applyPower(c.type, c.x, c.y);
        continue;
      }
      if (c.y > H + 40) this.caps.splice(i, 1);
    }
  },

  applyPower(type, x, y) {
    const P = POWERUPS[type], p = this.paddle;
    const dur = (P.dur || 0) * (1 + 0.35 * this.perk('timer'));
    if (this.run) this.run.stats.caps++;
    if (!P.good && this.perk('hull')) {
      this.addScore(150, x, y - 20, '#ffd76b');
      Sound.play('capGood');
      this.label('GUARDED', '#ffd76b', 15);
      FX.burst(x, y, '#ffd76b', 12, 220, 0.5, 3);
      return;
    }
    if (P.good) this.addScore(60, x, y - 20, P.color);
    this.label(P.name.toUpperCase(), P.good ? lighten(P.color, 0.25) : '#ff6b7a', 17);
    FX.ring(x, y, 10, 64, 0.42, P.color, 3);
    FX.burst(x, y, P.color, 12, 230, 0.5, 3);
    this.light(x, y, 150, 0.7, 0.4);
    p.glow = 1;
    Sound.play(P.good ? (type === 'life' ? 'life' : 'capGood') : 'capBad');
    if (!P.good) this.bump(0.4, 0);
    switch (type) {
      case 'wide': this.fx.wide = dur; this.fx.shrink = 0; break;
      case 'shrink': this.fx.shrink = dur; this.fx.wide = 0; break;
      case 'multi': this.multiball(); break;
      case 'laser': this.fx.laser = dur; this.laserT = 0.12; break;
      case 'pierce': this.fx.pierce = dur; break;
      case 'sticky': this.fx.sticky = dur; break;
      case 'slow': this.fx.slow = dur; this.fx.fast = 0; break;
      case 'fast': this.fx.fast = dur; this.fx.slow = 0; break;
      case 'net': this.net = Math.min(3, this.net + 1); this.netFlash = 1; break;
      case 'blast':
        for (let i = 0; i < this.balls.length; i++) this.balls[i].blast = true;
        Sound.play('arm');
        break;
      case 'life': this.run.lives = Math.min(this.maxLives(), this.run.lives + 1); break;
      default: break;
    }
  },

  multiball() {
    const src = this.balls.filter((b) => !(b.ghost > 0));
    for (let i = 0; i < src.length; i++) {
      const b = src[i];
      for (let s = -1; s <= 1; s += 2) {
        if (this.balls.length >= 12) return;
        const a = s * 0.4, cs = Math.cos(a), sn = Math.sin(a);
        const nb = this.newBall(b.x, b.y, b.dx * cs - b.dy * sn, b.dx * sn + b.dy * cs);
        nb.speed = b.speed;
        this.fixAngle(nb);
        this.balls.push(nb);
      }
      FX.ring(b.x, b.y, 4, 46, 0.4, '#c9b8ff', 2.5);
    }
  },

  /* ---------------------------------------------------- harpoons / hazards */
  brickAt(x, y) {
    const r = Math.floor((y - BRICK_TOP) / CELL_H), c = Math.floor(x / CELL_W);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      const k = this.grid[r][c];
      if (k && k.alive && k.solid) return k;
    }
    for (let i = 0; i < this.movers.length; i++) {
      const m = this.movers[i];
      if (m.alive && x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) return m;
    }
    return null;
  },

  fire(x) { this.shots.push({ x, y: this.paddleTop() - 6 }); },

  updateShots(dt) {
    const p = this.paddle;
    if (this.fx.laser > 0) {
      this.laserT -= dt;
      if (this.laserT <= 0) {
        this.laserT = 0.3;
        this.fire(p.x - p.w / 2 + 12); this.fire(p.x + p.w / 2 - 12);
        Sound.play('laser');
      }
    }
    const rk = this.perk('rack');
    if (rk) {
      this.rackT -= dt;
      if (this.rackT <= 0) { this.rackT = [0, 2.4, 1.7, 1.15][rk] || 1.15; this.fire(p.x); Sound.play('laser'); }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (!s) continue;                       // the list can be emptied mid-loop when a boss falls
      let dist = 1000 * dt, dead = false;
      while (dist > 0 && !dead) {
        const step = Math.min(dist, 10);
        s.y -= step; dist -= step;
        if (s.y < TOP) { dead = true; break; }
        const k = this.brickAt(s.x, s.y);
        if (k) {
          if (BT[k.type].steel) this.hitSteel(k, s.x, s.y);
          else this.damageBrick(k, 1, 'shot', 0, 1);
          dead = true;
        } else if (this.boss && this.boss.hitShot(s.x, s.y)) dead = true;
      }
      if (dead) {
        FX.spray(s.x, s.y, '#ffd9a0', 5, 220, 0.25, Math.PI / 2, 2.2);
        Sound.play('shot');
        this.shots.splice(i, 1);
      }
    }
  },

  updateHazards(dt) {
    const p = this.paddle, top = this.paddleTop();
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t += dt;
      if (h.g) h.vy += h.g * dt;
      h.x += h.vx * dt; h.y += h.vy * dt;
      if (Math.random() < dt * 22) {
        const o = FX.add(0, h.x, h.y, rand(-14, 14), rand(-14, 14), 0.4, h.r * 0.34, h.color);
        if (o) o.drag = 1.5;
      }
      if (h.y + h.r >= top && h.y - h.r <= p.y + p.h && Math.abs(h.x - p.x) < p.w / 2 + h.r) {
        this.hazards.splice(i, 1);
        this.hazardHit(h);
        continue;
      }
      if (h.y > H + 40 || h.x < -60 || h.x > W + 60) this.hazards.splice(i, 1);
    }
  },

  hazardHit(h) {
    const p = this.paddle, guard = this.perk('hull') ? 0.5 : 1;
    if (h.kind === 'blob') {
      this.fx.shrink = 6 * guard; this.fx.wide = 0;
      this.label('SQUEEZED', '#ff6b7a', 15);
    } else {
      p.stun = (h.kind === 'magma' ? 0.75 : 0.9) * guard;
      this.label('STUNNED', '#ff6b7a', 15);
    }
    Sound.play('stun');
    this.bump(0.55, 0.03);
    this.flashScreen(0.14, '#ff4d5e');
    FX.burst(h.x, h.y, h.color, 16, 270, 0.5, 3);
    FX.ring(h.x, h.y, 6, 60, 0.4, h.color, 3);
  },

  updateTimers(dt) {
    const f = this.fx;
    for (const k in f) { if (f[k] > 0) { f[k] -= dt; if (f[k] < 0) f[k] = 0; } }
    if (this.chainT > 0) {
      this.chainT -= dt;
      if (this.chainT <= 0) { this.chainT = 0; this.chain = 0; }
    }
    if (this.netFlash > 0) this.netFlash = Math.max(0, this.netFlash - dt * 2.5);
    if (this.stage.lit > 0) this.stage.lit = Math.max(0, this.stage.lit - dt);
  },

  /* ------------------------------------------------------- losing / clearing */
  loseBalls() {
    const r = this.run, st = this.stage;
    this.phase = 'dying'; this.phaseT = 0;
    if (!this.demo) {
      if (!this.god) r.lives--;
      r.stats.lost++; st.lostLife = true;
    }
    this.balls.length = 0; this.caps.length = 0; this.shots.length = 0; this.hazards.length = 0;
    this.fx = this.newFx();
    this.chain = 0; this.chainT = 0;
    this.slowmo = 0;
    this.bump(1, 0.05);
    this.flashScreen(0.26, '#ff4d5e');
    Sound.play('lost');
    FX.bubbles(this.paddle.x, H - 10, 14, W * 0.6, 4);
  },

  stageClear() {
    const st = this.stage, gi = st.gi;
    this.phase = 'clearing'; this.phaseT = 0;
    this.clearDur = st.def.boss ? 4.2 : 1.9;
    this.slowmo = 0.75;
    this.hazards.length = 0; this.shots.length = 0;
    this.focus.on = false; Sound.focus(false);
    st.clearBonus = 300 + 60 * (gi + 1) + (st.def.boss ? 2500 : 0);
    st.flawless = st.lostLife ? 0 : 400 + 40 * gi;
    this.flashScreen(0.3, '#ffffff');
    if (!st.def.boss) {
      Sound.play('clear', Sound.root);
      if (!this.demo) FX.text(W / 2, 400, 'STAGE CLEAR', '#ffffff', 30, 1.7);
    }
    const p = this.paddle;
    FX.ring(p.x, p.y, 10, 300, 0.9, this.zone().accent, 3);
  },

  /* called by a boss when its health reaches zero */
  bossDown() {
    if (this.phase !== 'live') return;
    this.stage.remaining = 0;
    this.stageClear();
    Sound.play('bossDie');
  },

  /* shared boss damage bookkeeping; returns true if the hit landed */
  bossDamage(B, n, x, y) {
    if (B.dying > 0 || B.dead || this.phase !== 'live') return false;
    B.hp = Math.max(0, B.hp - n);
    B.flash = 1;
    this.chain++; this.chainT = this.chainWindow();
    if (this.run && this.chain > this.run.stats.maxChain) this.run.stats.maxChain = this.chain;
    if (this.chain > this.stage.maxChain) this.stage.maxChain = this.chain;
    this.addScore(40 * n, x, y, '#ffffff');
    Sound.play('bossHit');
    FX.burst(x, y, B.color, 14, 300, 0.5, 3.4);
    FX.spray(x, y, '#ffffff', 8, 420, 0.3, 0, TAU);
    FX.ring(x, y, 6, 50, 0.3, '#ffffff', 2.5);
    this.light(x, y, 200, 0.9, 0.4);
    this.bump(0.35, 0.03);
    this.focus.v = Math.min(this.focus.max, this.focus.v + 0.03);
    B.dropAcc = (B.dropAcc || 0) + n;
    if (B.dropAcc >= 6 && this.caps.length < 4) {
      B.dropAcc = 0;
      this.dropCapsule(x, y + 20, this.rollPower(true));
    }
    if (B.hp <= 0) { B.dying = 0.0001; this.bossDown(); }
    return true;
  },

  ballDamage(b) {
    let d = 1 + this.perk('heavy');
    if (b.charge > 0) { d += 1; b.charge = 0; }
    if (this.fx.pierce > 0) d += 1;
    return d;
  },

  rollPerks(n) {
    const r = this.run;
    const pool = PERKS.filter((p) => (r.perks[p.id] || 0) < p.max);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool.slice(0, n);
  },

  offerPerks() {
    const st = this.stage, r = this.run;
    const gained = r.score - st.scoreStart;
    r.score += st.clearBonus + st.flawless;
    this.phase = 'perk'; this.phaseT = 0;
    const choices = this.rollPerks(3);
    if (!choices.length) { this.startDive(); return; }
    if (this.auto) { this.pickPerk(pick(choices).id); return; }
    UI.perk({
      boss: !!st.def.boss, name: st.def.name, gi: st.gi, gained, bonus: st.clearBonus, flawless: st.flawless,
      chain: st.maxChain, total: r.score,
    }, choices, (id) => this.pickPerk(id));
  },

  pickPerk(id) {
    const r = this.run, P = PERK_BY_ID[id];
    if (P && (r.perks[id] || 0) < P.max) {
      r.perks[id] = (r.perks[id] || 0) + 1;
      if (id === 'tank') r.lives = Math.min(this.maxLives(), r.lives + 1);
      if (id === 'sonar') this.focus.v = 1 + 0.5 * this.perk('sonar');
    }
    Sound.play('perk');
    this.startDive();
  },

  startDive() {
    const next = this.stage.gi + 1, nd = STAGES[next];
    const zoneChange = nd.zone !== this.stage.zi;
    this.clearWorld();
    this.phase = 'dive'; this.phaseT = 0;
    this.dive = { dur: zoneChange ? 4.8 : 2.5, from: this.stage.def.depth, to: nd.depth, next, zoneChange };
    if (zoneChange) {
      Bg.blendTo(nd.zone);
      const z = ZONES[nd.zone];
      UI.banner(z.sci + '  ·  ' + z.range, z.name, z.blurb, 'zone');
      Sound.music(z.song);
    }
    Sound.play('dive', this.dive.dur);
  },

  gameOver() {
    const r = this.run, st = this.stage;
    this.mode = 'over'; this.phase = 'idle';
    const newBest = r.score > Save.data.best;
    if (!this.auto) {
      if (newBest) Save.data.best = r.score;
      Save.store();
    }
    Sound.play('over', Sound.root);
    UI.over({
      score: r.score, best: Math.max(Save.data.best, r.score), newBest, depth: st.def.depth,
      zone: ZONES[st.zi].name, stage: st.def.name, stats: r.stats, canRetry: !!r.ckpt,
      retryZone: r.ckpt ? ZONES[STAGES[r.ckpt.gi].zone].name : '',
    });
  },

  retryZone() {
    const c = this.run && this.run.ckpt;
    UI.closeAll();
    this.startRun(c || null);
  },

  victory() {
    const r = this.run, st = this.stage;
    r.score += st.clearBonus + st.flawless + r.lives * 1000;
    this.mode = 'win'; this.phase = 'idle';
    const newBest = r.score > Save.data.best;
    if (!this.auto) {
      if (newBest) Save.data.best = r.score;
      Save.data.wins = (Save.data.wins || 0) + 1;
      Save.data.deepest = Math.max(Save.data.deepest, 10935);
      Save.data.ckpt = null;
      Save.store();
    }
    Sound.play('win', Sound.root);
    UI.win({ score: r.score, best: Math.max(Save.data.best, r.score), newBest, stats: r.stats, lives: r.lives, perks: r.perks });
  },
};
