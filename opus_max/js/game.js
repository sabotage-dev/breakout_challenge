/* SHATTERWAVE — game flow, rules, scoring, power-ups */
'use strict';
SW.game = {
  mode: 'demo', demo: true, state: 'idle', paused: false,
  t: 0, stateT: 0, levelN: 0, level: null, themeKey: 's1',
  score: 0, shownScore: 0, lives: 3, nextLife: 30000,
  chain: 0, chainT: 0, mult: 1, pulse: 0, pulseFlash: 0,
  paddle: null, balls: [], bricks: [], capsules: [], lasers: [], orbs: [], bosses: [], bumpers: [], portals: [], waves: [], blasts: [],
  pw: {}, shieldHits: 0, laserCD: 0, paddleHits: 0,
  timeScale: 1, slowT: 0, slowK: 1, hitstop: 0, zoom: { k: 0, x: 360, y: 480 },
  banners: [], tally: null, levelLost: 0, levelTime: 0, demoT: 0,
  stats: null,

  init() { this.paddle = new SW.Paddle(); this.resetPw(); },
  resetPw() { this.pw = { wide: 0, laser: 0, catch: 0, slow: 0, fire: 0, shield: 0, shrink: 0, fast: 0 }; this.shieldHits = 0; },
  setState(s) { this.state = s; this.stateT = 0; },

  /* ---------- sessions ---------- */
  startDemo() {
    this.mode = 'demo'; this.demo = true; this.paused = false; this.victory = false;
    this.score = 0; this.lives = 99;
    const pool = SW.LEVELS.filter((L) => !L.boss).map((L) => L.index);
    this.loadLevel(U.pick(pool));
  },
  newGame(mode, start = 0) {
    this.mode = mode; this.demo = false; this.paused = false; this.victory = false;
    this.score = 0; this.shownScore = 0; this.lives = 3; this.nextLife = 30000; this.pulse = 0;
    this.stats = { bricks: 0, powerups: 0, lost: 0, time: 0, bestChain: 0, bosses: 0, startLevel: start };
    SW.fx.reset();
    this.loadLevel(start);
  },
  loadLevel(n) {
    const endless = this.mode === 'endless';
    this.levelN = n;
    const L = (this.level = SW.getLevel(endless ? 'endless' : 'campaign', n));
    this.themeKey = endless ? 'ot' : SW.SECTORS[L.sector - 1].key;
    SW.bg.setTheme(this.themeKey);
    if (!this.demo) {
      SW.audio.music(L.boss ? 'boss' : endless ? 'endless' : SW.SECTORS[L.sector - 1].music);
      SW.audio.intensity(L.boss ? 2 : 1);
      this.musicLevel = L.boss ? 2 : 1;
      if (!endless && L.sector > SW.progress.sector) { SW.progress.sector = L.sector; SW.saveProgress(); }
    }
    // bricks
    const G = SW.GRID;
    this.bricks = [];
    L.map.forEach((row, r) => {
      for (let c = 0; c < row.length && c < G.cols; c++) {
        const ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        const b = new SW.Brick(ch, G.x0 + c * G.pitchX, G.y0 + r * G.pitchY, G.bw, G.bh);
        b.row = r; b.col = c;
        b.delay = 0.15 + r * 0.045 + Math.abs(c - 6) * 0.03;
        if (L.boss) b.required = false;
        this.bricks.push(b);
      }
    });
    for (const m of L.move || []) {
      const row = this.bricks.filter((b) => b.row === m.row);
      if (!row.length) continue;
      const minX = Math.min(...row.map((b) => b.x)), maxX = Math.max(...row.map((b) => b.x + b.w));
      const amp = Math.max(0, Math.min(m.amp, minX - SW.FIELD.left - 4, SW.FIELD.right - 4 - maxX));
      for (const b of row) b.move = { amp, speed: m.speed, phase: m.phase || 0 };
    }
    this.bumpers = (L.bumpers || []).map((a) => new SW.Bumper(a[0], a[1], a[2]));
    this.portals = (L.portals || []).map((a) => new SW.Portal(a[0], a[1], a[2], a[3]));
    this.bosses = (L.boss || []).map((k) => new SW.Boss(typeof k === 'string' ? SW.BOSSES[k] : k, this));
    this.balls = []; this.capsules = []; this.lasers = []; this.orbs = []; this.waves = []; this.blasts = []; this.banners = [];
    this.resetPw();
    this.paddle.tw = this.paddle.base; this.paddle.dead = false; this.paddle.stun = 0;
    this.chain = 0; this.chainT = 0; this.mult = 1; this.paddleHits = 0;
    this.levelLost = 0; this.levelTime = 0; this.t = 0; this.tally = null;
    this.timeScale = 1; this.slowT = 0; this.zoom.k = 0;
    this.serveBall();
    this.setState('intro');
    if (!this.demo) {
      const sec = endless ? 'OVERTIME' : 'SECTOR ' + L.sector + ' · ' + SW.SECTORS[L.sector - 1].name;
      this.banner(L.label + '  ' + L.name, L.boss ? '#ff3b6b' : SW.bg.accent(), 2.4, L.boss ? 'WARNING · GUARDIAN APPROACHING' : sec);
    }
  },
  baseSpeed() {
    if (this.mode === 'endless') return Math.min(650, 470 + this.levelN * 9);
    if (this.demo) return 470;
    return Math.min(590, 440 + this.levelN * 13);
  },
  targetSpeed() {
    let s = this.baseSpeed() + Math.min(240, this.paddleHits * 5);
    if (this.pw.slow > 0) s *= 0.66;
    if (this.pw.fast > 0) s *= 1.28;
    return s;
  },
  serveBall() {
    const p = this.paddle;
    const b = new SW.Ball(p.x, p.y - 9, this.targetSpeed());
    b.stuck = true; b.stuckOff = U.rand(-p.w * 0.2, p.w * 0.2);
    this.balls.push(b);
  },
  launch(b) {
    if (!b.stuck) return;
    b.stuck = false;
    const p = this.paddle;
    b.speed = this.targetSpeed();
    b.setAngle(U.clamp(b.stuckOff / (p.w / 2), -1, 1) * 0.75 + U.rand(-0.08, 0.08));
    b.y = p.y - b.r - 1;
    SW.audio.sfx('launch');
    SW.fx.ring(b.x, b.y, SW.bg.accent(), 4, 30, 0.3, 2);
  },

  /* ---------- feedback helpers ---------- */
  banner(text, color = '#fff', dur = 1.6, sub = '') { this.banners.push({ text, sub, color, t: 0, dur }); if (this.banners.length > 3) this.banners.shift(); },
  addScore(n) {
    if (this.demo) return;
    this.score += n;
    if (this.score >= this.nextLife) {
      this.nextLife += this.nextLife < 80000 ? 50000 : this.nextLife < 150000 ? 70000 : 100000;
      this.lives++;
      SW.audio.sfx('oneup');
      SW.fx.text(this.paddle.x, this.paddle.y - 50, 'EXTRA LIFE!', '#ff4dd8', 26, { big: true, life: 1.6 });
    }
  },
  addPulse(v) {
    if (this.demo) return;
    const was = this.pulse;
    this.pulse = Math.min(100, this.pulse + v);
    if (was < 100 && this.pulse >= 100) {
      SW.audio.sfx('pulseReady');
      this.pulseFlash = 1;
      SW.fx.text(this.paddle.x, this.paddle.y - 46, 'PULSE READY', '#d7b8ff', 20, { life: 1.4 });
    }
  },
  doHitstop(s) { this.hitstop = Math.max(this.hitstop, s); },
  slowmo(k, s) { this.slowK = k; this.slowT = Math.max(this.slowT, s); },

  /* ---------- bricks ---------- */
  damageBrick(b, dmg, src, ball) {
    if (!b.alive) return false;
    if (b.kind === 'steel') {
      b.flash = 0.8; b.wob = 0.5;
      SW.audio.sfx('steel');
      if (ball) SW.fx.sparks(ball.x, ball.y, '#dfe6ff', 5, 220);
      return false;
    }
    b.hp -= dmg;
    b.flash = 1; b.wob = 1;
    if (b.hp <= 0) { this.destroyBrick(b, ball); return true; }
    SW.audio.sfx('clank');
    SW.fx.sparks(b.x + b.w / 2, b.y + b.h / 2, '#ffffff', 6, 240);
    SW.fx.shatter(b.x, b.y, b.w, b.h, b.color, 3, 0.6);
    this.addScore(20);
    return false;
  },
  destroyBrick(b, ball, quiet) {
    if (!b.alive) return;
    b.alive = false;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (this.stats && !this.demo) this.stats.bricks++;
    this.chain++; this.chainT = this.bosses.length ? 2.2 : 1.7;
    this.mult = Math.min(8, 1 + Math.floor(this.chain / 5));
    if (this.stats) this.stats.bestChain = Math.max(this.stats.bestChain, this.chain);
    const pts = b.value * this.mult;
    this.addScore(pts);
    this.addPulse(2.4 + this.mult * 0.45);
    SW.fx.shatter(b.x, b.y, b.w, b.h, b.color, 11);
    SW.fx.glow(cx, cy, b.color, 46, 0.3);
    SW.fx.sparks(cx, cy, SW.C.lighten(b.color, 0.5), 6, 260);
    const now = performance.now();
    if ((this.mult > 1 || pts >= 300) && now - (this.lastPopup || 0) > 90) { this.lastPopup = now; SW.fx.text(cx, cy, '+' + pts, this.mult >= 4 ? '#ffd23f' : '#ffffff', 14 + this.mult); }
    if (!quiet) { SW.audio.sfx('note', this.chain - 1, this.mult >= 4); SW.fx.shake(0.06); }
    if (this.chain > 0 && this.chain % 10 === 0 && !this.demo) {
      SW.fx.text(SW.W / 2, 560, this.chain + ' CHAIN!', '#ffd23f', 30 + Math.min(20, this.chain / 2), { big: true, life: 1.1, vy: -30 });
    }
    if (b.kind === 'bomb') this.blasts.push({ x: cx, y: cy, t: 0.07 });
    else if (b.kind === 'mystery') this.spawnCapsule(cx, cy, true);
    else if (b.kind === 'crystal') {
      if (this.balls.length < 14) {
        const nb = new SW.Ball(cx, cy + 14, this.targetSpeed());
        nb.setAngle(U.rand(-2.6, 2.6) + Math.PI);
        if (nb.vy < 0) nb.vy *= -1;
        this.balls.push(nb);
      }
      SW.audio.sfx('crystal');
      SW.fx.ring(cx, cy, '#9ff6ff', 4, 50, 0.4, 3);
    } else if (b.required && Math.random() < (this.demo ? 0.12 : 0.11)) this.spawnCapsule(cx, cy);
    if (b.required) this.checkClear(cx, cy);
  },
  explode(x, y) {
    SW.fx.explosion(x, y, '#ff7a1a', 1);
    SW.fx.shake(0.35);
    SW.audio.sfx('explode', 1);
    SW.audio.duck(0.6, 0.4);
    this.doHitstop(0.035);
    for (const b of this.bricks) {
      if (!b.alive) continue;
      const bx = b.x + b.w / 2, by = b.y + b.h / 2;
      if (Math.abs(bx - x) < 80 && Math.abs(by - y) < 46) this.damageBrick(b, 99, 'bomb');
    }
    for (const bo of this.bosses) if (bo.alive && U.dist2(bo.x, bo.y, x, y) < (bo.r + 60) ** 2) bo.hit(3, this);
  },
  remaining() { let n = 0; for (const b of this.bricks) if (b.alive && b.required) n++; return n; },
  checkClear(x, y) {
    if (this.state !== 'play' && this.state !== 'serve') return;
    if (this.bosses.length) return;
    if (this.remaining() === 0) this.beginClear(x, y);
  },
  beginClear(x, y) {
    this.setState('clear');
    this.zoom.x = x; this.zoom.y = y;
    this.slowmo(0.16, 1.1);
    SW.fx.flash('#ffffff', 0.35);
    SW.fx.shake(0.4);
    SW.fx.ring(x, y, '#ffffff', 10, 260, 0.9, 5);
    SW.audio.duck(0.3, 1.2);
    this.orbs.length = 0;
  },

  /* ---------- capsules & power-ups ---------- */
  spawnCapsule(x, y, force) {
    if (!force && this.capsules.length >= 3) return;
    let total = 0;
    const entries = Object.entries(SW.POWERS).filter(([k, P]) => !(k === 'life' && this.demo));
    for (const [, P] of entries) total += P.weight;
    let r = Math.random() * total, type = 'multi';
    for (const [k, P] of entries) { r -= P.weight; if (r <= 0) { type = k; break; } }
    if (force && !SW.POWERS[type].good) type = U.pick(['multi', 'wide', 'laser', 'fire', 'shield']);
    this.capsules.push(new SW.Capsule(x, y, type));
    SW.audio.sfx('capsule');
  },
  applyPower(type, x, y) {
    const P = SW.POWERS[type], p = this.paddle;
    if (this.stats && !this.demo) this.stats.powerups++;
    SW.audio.sfx('power', P.good);
    SW.fx.ring(x, y, P.color, 6, 70, 0.4, 3);
    SW.fx.sparks(x, y, P.color, 14, 300, -Math.PI / 2, 1.2);
    SW.fx.text(p.x, p.y - 34, P.label + (P.good ? '!' : ''), P.good ? P.color : '#ff6680', 20, { life: 1.1 });
    p.flash = 1;
    if (P.good) this.addScore(100);
    switch (type) {
      case 'multi': {
        const add = [];
        for (const b of this.balls) {
          if (b.stuck) this.launch(b);
          for (const da of [-0.38, 0.38]) {
            if (this.balls.length + add.length >= 14) break;
            const nb = new SW.Ball(b.x, b.y, b.speed);
            const ang = Math.atan2(b.vx, -b.vy) + da;
            nb.setAngle(ang); nb.normalize(nb.speed);
            add.push(nb);
          }
        }
        this.balls.push(...add);
        break;
      }
      case 'wide': this.pw.wide = P.dur; this.pw.shrink = 0; p.tw = p.base * 1.55; break;
      case 'shrink': this.pw.shrink = P.dur; this.pw.wide = 0; p.tw = p.base * 0.62; break;
      case 'slow': this.pw.slow = P.dur; this.pw.fast = 0; break;
      case 'fast': this.pw.fast = P.dur; this.pw.slow = 0; break;
      case 'shield': this.pw.shield = P.dur; this.shieldHits = 3; break;
      case 'pulse': this.addPulse(50); break;
      case 'life':
        this.lives++; SW.audio.sfx('oneup');
        break;
      default: this.pw[type] = P.dur;
    }
  },
  firePulse() {
    if (this.demo || this.pulse < 100 || (this.state !== 'play' && this.state !== 'serve')) return;
    this.pulse = 0;
    const p = this.paddle;
    this.waves.push(new SW.Wave(p.x, p.y - 12, 270));
    for (const b of this.balls) if (b.stuck) this.launch(b);
    if (this.state === 'serve') this.setState('play');
    SW.audio.sfx('pulse');
    SW.audio.duck(0.4, 0.6);
    SW.fx.flash('#b26bff', 0.35);
    SW.fx.shake(0.5);
    SW.fx.ring(p.x, p.y, '#d7b8ff', 10, 220, 0.6, 6);
    this.slowmo(0.35, 0.22);
  },

  /* ---------- lives ---------- */
  loseLife() {
    this.setState('dying');
    const p = this.paddle;
    SW.fx.explosion(p.x, p.y + 8, SW.bg.accent(), 1.2);
    SW.fx.shatter(p.x - p.w / 2, p.y, p.w, p.h, SW.bg.accent(), 24, 1.4);
    SW.fx.shake(0.7);
    SW.fx.flash('#ff2050', 0.3);
    SW.audio.sfx('lose');
    SW.audio.duck(0.25, 1.5);
    p.dead = true;
    this.capsules.length = 0; this.orbs.length = 0; this.lasers.length = 0;
    this.resetPw();
    p.tw = p.base;
    this.chain = 0; this.mult = 1;
    this.paddleHits = Math.floor(this.paddleHits * 0.4);
    if (this.demo) return;
    this.lives--; this.levelLost++; this.stats.lost++;
  },
  respawn() {
    const p = this.paddle;
    p.dead = false; p.appear = 0; p.w = 20; p.stun = 0;
    this.serveBall();
    this.setState('serve');
  },

  /* ---------- bosses ---------- */
  onBossDying(boss) {
    SW.audio.sfx('roar');
    SW.fx.flash('#ffffff', 0.5);
    this.slowmo(0.25, 0.9);
    this.orbs.length = 0;
    this.addScore(5000);
    SW.fx.text(boss.x, boss.y - boss.r - 30, '+5000', '#ffd23f', 34, { big: true, life: 1.8 });
    const other = this.bosses.find((b) => b !== boss && b.alive);
    if (other) other.enrage(this);
  },
  onBossDead(boss) {
    SW.fx.explosion(boss.x, boss.y, boss.color, 2.6);
    SW.fx.explosion(boss.x, boss.y, '#ffffff', 1.6);
    SW.fx.shatter(boss.x - boss.r, boss.y - boss.r, boss.r * 2, boss.r * 2, boss.color, 50, 2.2);
    SW.fx.shake(1); SW.fx.flash('#ffffff', 0.8);
    SW.audio.sfx('explode', 2.5);
    if (this.stats) this.stats.bosses++;
    if (this.bosses.every((b) => b.dead)) {
      // every remaining brick shatters in a cascade
      let k = 0;
      for (const b of this.bricks) if (b.alive && b.kind !== 'steel') { b.alive = false; const d = k++ * 0.03; setTimeout(() => SW.fx.shatter(b.x, b.y, b.w, b.h, b.color, 8), d * 1000); this.addScore(b.value); }
      for (const b of this.bricks) if (b.kind === 'steel') b.alive = false;
      if (this.state === 'play' || this.state === 'serve') this.beginClear(boss.x, boss.y);
    }
  },

  /* ---------- level end ---------- */
  startTally() {
    const n = this.mode === 'endless' ? this.levelN + 1 : this.levelN + 1;
    const lines = [
      ['CLEAR BONUS', 1000 + n * 250],
      ['TIME BONUS', Math.max(0, Math.round((100 - this.levelTime) * 30 / 10) * 10)],
      ['NO-MISS BONUS', this.levelLost === 0 ? 2500 : 0],
    ];
    if (this.level.boss) lines.push(['GUARDIAN BONUS', 4000]);
    this.tally = { lines, shown: 0, acc: 0, total: lines.reduce((s, l) => s + l[1], 0), added: 0 };
    this.setState('tally');
    SW.audio.sfx('clear');
  },
  nextLevel() {
    if (this.tally) this.addScore(this.tally.total - this.tally.added);
    this.tally = null;
    if (this.demo) { this.startDemo(); return; }
    if (this.mode === 'campaign' && this.levelN >= SW.LEVELS.length - 1) { this.finish(true); return; }
    this.loadLevel(this.levelN + 1);
  },
  finish(victory) {
    this.setState('over');
    this.victory = !!victory; this.fireworkT = 0;
    this.balls.length = 0;
    if (victory) { SW.audio.music('victory'); SW.audio.intensity(1); }
    else { SW.audio.intensity(0); }
    if (this.mode === 'endless') { SW.progress.bestEndless = Math.max(SW.progress.bestEndless, this.levelN + 1); SW.saveProgress(); }
    SW.ui.gameOver({ victory, score: this.score, reached: this.level.label, mode: this.mode, stats: this.stats, levelN: this.levelN });
  },
  enterOvertime() {
    this.mode = 'endless'; this.victory = false;
    this.lives = Math.max(this.lives, 3);
    this.loadLevel(0);
  },
  retryLevel() {
    const n = this.levelN, mode = this.mode;
    this.newGame(mode, n);
  },

  /* ---------- demo AI ---------- */
  aiTarget() {
    const p = this.paddle, F = SW.FIELD;
    let best = null, bestY = -1;
    for (const b of this.balls) if (!b.stuck && b.vy > 0 && b.y > bestY) { best = b; bestY = b.y; }
    for (const c of this.capsules) if (!best && SW.POWERS[c.type].good) return c.x;
    if (!best) { const b = this.balls[0]; return b ? b.x : p.x; }
    const tt = (p.y - best.r - best.y) / best.vy;
    let x = best.x + best.vx * tt;
    const L = F.left + best.r, R = F.right - best.r, span = R - L;
    let m = (x - L) % (2 * span); if (m < 0) m += 2 * span;
    x = L + (m > span ? 2 * span - m : m);
    return x + Math.sin(this.t * 0.7) * p.w * 0.32;
  },
};
