/* Lanternwake — game state, physics and rules */
(function () {
  'use strict';
  const LW = window.LW, U = LW.U, C = LW.C, A = LW.Audio, S = A.sfx;
  const clamp = U.clamp, rand = U.rand, pick = U.pick, TAU = U.TAU;

  const FW = (LW.FW_COLORS = [
    [255, 120, 110], [255, 190, 90], [255, 236, 150], [150, 230, 255],
    [190, 150, 255], [255, 140, 200], [150, 255, 190],
  ]);
  const SPARK = [255, 206, 120];
  const WHITE = [255, 250, 235];
  const FLY_RGB = [200, 255, 120];
  const BASE_PADDLE = 126;
  const MAX_BALLS = 9;

  const G = (LW.G = {
    mode: 'title', paused: false,
    time: 0, realTime: 0, timeScale: 1, slowT: 0, hitstop: 0,
    score: 0, shownScore: 0, lives: 3, jar: 0, stage: 0, def: LW.STAGES[0],
    wishes: {}, effects: { wide: 0, blaze: 0, slow: 0, catch: 0, rockets: 0, gale: 0, shrink: 0 },
    bridge: 0, chain: 0, chainT: 0, mult: 1, stageBestChain: 0,
    balls: [], bricks: [], charms: [], flies: [], rockets: [], hazards: [], swarm: [],
    parts: [], floaters: [], shells: [], popups: [], queue: [], rings: [], ripples: [],
    paddle: { x: 640, w: BASE_PADDLE, vx: 0, kv: 0, kick: 0, dip: 0, flareT: 0, cool: 0, stun: 0, wakeT: 0 },
    boss: null, shakeMag: 0, shakeX: 0, shakeY: 0, flash: 0, flashRgb: WHITE,
    stats: { lanterns: 0, bestChain: 0, flares: 0, time: 0, charms: 0 },
    banner: null, tally: null, clearT: 0, clearSkip: false, dawnT: 0, respawnT: 0,
    speedBonus: 0, stageTime: 0, stallT: 0, dropPity: 0, lifeCharm: false, rocketT: 0, crewT: 0,
    attractT: 0, attractF: 2, lostFlash: 0,
    best: { score: 0, stage: 0, won: false },
    input: { x: 640, useKeys: false, left: false, right: false },
    view: { left: 0, right: C.W, top: 0, bottom: C.H, scale: 1, offX: 0, offY: 0, dpr: 1 },
    opts: { music: 0.55, sfx: 0.8, shake: true },
  });

  const wish = (G.wish = (id) => G.wishes[id] || 0);
  const cxOf = (G.cxOf = (b) => (b.circle ? b.x : b.x + b.w / 2));
  const cyOf = (G.cyOf = (b) => (b.circle ? b.y : b.y + b.h / 2));

  /* ------------------------------------------------------------ save ---- */
  const KEY = 'lanternwake.v1';
  LW.Save = {
    load() {
      try {
        const d = JSON.parse(window.localStorage.getItem(KEY) || '{}');
        if (d.best) Object.assign(G.best, d.best);
        if (d.opts) Object.assign(G.opts, d.opts);
      } catch (e) { /* storage unavailable: play without saving */ }
      A.musicVol = G.opts.music; A.sfxVol = G.opts.sfx;
    },
    store() {
      try { window.localStorage.setItem(KEY, JSON.stringify({ best: G.best, opts: G.opts })); } catch (e) { /* ignore */ }
    },
  };
  function recordBest() {
    let changed = false;
    if (G.score > G.best.score) { G.best.score = G.score; changed = true; }
    if (G.stage + 1 > G.best.stage) { G.best.stage = G.stage + 1; changed = true; }
    if (changed) LW.Save.store();
  }

  /* -------------------------------------------------------- particles ---- */
  // kind: 0 glow spark, 1 paper confetti, 2 stone debris, 3 smoke, 4 water droplet
  function part(x, y, vx, vy, life, size, rgb, o) {
    if (G.parts.length > 1500) return;
    o = o || {};
    G.parts.push({
      x, y, vx, vy, life, max: life, size, rgb,
      g: o.g || 0, drag: o.drag || 0, kind: o.kind || 0, layer: o.layer === undefined ? 1 : o.layer,
      rot: o.kind ? Math.random() * TAU : 0, vr: o.kind ? rand(-9, 9) : 0, tw: o.tw || 0, hot: !!o.hot,
    });
  }
  G.part = part;
  G.sparks = function (x, y, n, rgb, speed, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = o.dir !== undefined ? o.dir + rand(-(o.spread || 0.6), o.spread || 0.6) : rand(TAU);
      const s = speed * (0.25 + Math.random() * 0.75);
      part(x, y, Math.cos(a) * s, Math.sin(a) * s, (o.life || 0.5) * (0.6 + Math.random() * 0.7), o.size || 2.2, rgb,
        { g: o.g === undefined ? 240 : o.g, drag: o.drag === undefined ? 2.4 : o.drag, layer: o.layer, hot: o.hot, tw: o.tw });
    }
  };
  G.confetti = function (x, y, n, rgb, speed) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), s = (speed || 160) * (0.3 + Math.random() * 0.7);
      part(x, y, Math.cos(a) * s, Math.sin(a) * s - 60, rand(0.7, 1.4), rand(3, 5.5), rgb, { g: 300, drag: 2.6, kind: 1 });
    }
  };
  G.debris = function (x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), s = rand(60, 240);
      part(x, y, Math.cos(a) * s, Math.sin(a) * s - 80, rand(0.8, 1.5), rand(3, 7), LW.STONE_RGB, { g: 900, drag: 0.6, kind: 2 });
    }
  };
  G.smoke = function (x, y, n, rgb) {
    for (let i = 0; i < n; i++) {
      part(x + rand(-10, 10), y + rand(-8, 8), rand(-30, 30), rand(-60, -15), rand(0.6, 1.3), rand(12, 26), rgb || [60, 50, 60], { drag: 1.2, kind: 3 });
    }
  };
  G.ring = function (x, y, r0, r1, life, rgb, w) {
    G.rings.push({ x, y, r0, r1, t: 0, life, rgb, w: w || 3 });
  };
  G.popup = function (x, y, text, rgb, size) {
    if (G.popups.length > 40) G.popups.shift();
    G.popups.push({ x: clamp(x, C.L + 40, C.R - 40), y, text, rgb: rgb || WHITE, size: size || 16, t: 0, life: size > 20 ? 1.3 : 0.85 });
  };
  G.shake = function (m) {
    if (!G.opts.shake) return;
    if (m > G.shakeMag) G.shakeMag = m;
  };
  G.flashScreen = function (a, rgb) {
    if (a > G.flash) { G.flash = a; G.flashRgb = rgb || WHITE; }
  };
  G.after = function (delay, fn) { G.queue.push({ t: G.time + delay, fn }); };
  G.splash = function (x, power) {
    power = power === undefined ? 1 : power;
    const n = Math.round(16 * power);
    for (let i = 0; i < n; i++) {
      part(x + rand(-8, 8), C.WATER - 2, rand(-110, 110) * power, rand(-420, -120) * power, rand(0.5, 0.95), rand(1.6, 3.2), [190, 220, 255], { g: 1100, kind: 4 });
    }
    G.ripples.push({ x, t: 0, life: 1.4, w: 70 * power + 30 });
    G.ripples.push({ x, t: -0.18, life: 1.4, w: 46 * power + 20 });
    if (power >= 0.9) S.splash(); else S.plop();
  };

  G.firework = function (x, y, rgb, size, layer) {
    size = size || 1;
    layer = layer === undefined ? 0 : layer;
    const n = Math.floor(58 * size);
    const type = pick(['peony', 'peony', 'ring', 'willow', 'duo']);
    const rgb2 = type === 'duo' ? pick(FW) : rgb;
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n + rand(-0.06, 0.06);
      const sp = (type === 'ring' ? 235 : 250 * (0.3 + 0.7 * Math.sqrt(Math.random()))) * size;
      const will = type === 'willow';
      part(x, y, Math.cos(a) * sp, Math.sin(a) * sp, (will ? 1.7 : 1.05) + Math.random() * 0.6, 2.6, i % 2 ? rgb : rgb2,
        { g: will ? 150 : 66, drag: will ? 1.25 : 1.9, layer, tw: 1 });
    }
    part(x, y, 0, 0, 0.3, 110 * size, rgb, { layer });
    part(x, y, 0, 0, 0.16, 60 * size, WHITE, { layer, hot: true });
    S.firework(size * (G.mode === 'title' ? 0.35 : 0.8));
  };
  G.shell = function (x, y0, ty, rgb, size) {
    G.shells.push({ x, y: y0, ty, vy: -rand(520, 640), rgb, size: size || 1, wob: rand(TAU), t: 0 });
    if (G.mode !== 'title') S.whistle();
  };

  // A released lantern drifting up into the night.
  G.release = function (x, y, type, color, o) {
    o = o || {};
    if (G.floaters.length > 240) G.floaters.shift();
    G.floaters.push({
      x, y, vx: o.vx || rand(-14, 14), vy: o.vy === undefined ? -20 : o.vy, tvy: o.tvy || -rand(56, 96),
      sc: o.sc === undefined ? 1 : o.sc, tsc: o.tsc || rand(0.3, 0.44), type: type === 'gold' ? 'gold' : 'paper',
      color: color || 'r', t: 0, ph: rand(TAU), alpha: o.alpha === undefined ? 1 : o.alpha,
    });
  };

  /* ------------------------------------------------------------ stage ---- */
  function makeBrick(ch, col, row) {
    const x = C.GRID_X + col * C.CELL_W + (C.CELL_W - C.BW) / 2;
    const y = C.GRID_Y + row * C.CELL_H + (C.CELL_H - C.BH) / 2;
    const b = {
      type: 'paper', color: 'r', col, row, x, y, w: C.BW, h: C.BH, baseX: x, baseY: y,
      hp: 1, maxHp: 1, alive: true, indestructible: false, counts: true, circle: false, r: 0, cr: 11,
      sway: 0, swayV: 0, phase: Math.random() * TAU, flash: 0, intro: 0, introDelay: 0.15 + col * 0.016 + row * 0.045,
      ring: 0, boss: false, mover: null, ghost: false,
    };
    const lower = ch.toLowerCase();
    if (ch === '#') { b.type = 'stone'; b.hp = b.maxHp = 3; b.cr = 5; }
    else if (ch === '@') {
      b.type = 'bell'; b.indestructible = true; b.counts = false; b.circle = true; b.r = 19;
      b.x = b.baseX = x + C.BW / 2; b.y = b.baseY = y + C.BH / 2; b.hp = b.maxHp = 1e9;
    }
    else if (ch === '*') { b.type = 'cracker'; b.cr = 5; }
    else if (ch === '$') { b.type = 'gold'; }
    else if (LW.COLORS[lower]) {
      b.color = lower;
      if (ch !== lower) { b.type = 'dark'; b.hp = b.maxHp = 2; }
    } else return null;
    return b;
  }

  function resetField() {
    G.balls.length = 0; G.bricks.length = 0; G.charms.length = 0; G.flies.length = 0;
    G.rockets.length = 0; G.hazards.length = 0; G.swarm.length = 0; G.queue.length = 0;
    G.popups.length = 0;
    for (const k in G.effects) G.effects[k] = 0;
    G.boss = null; G.chain = 0; G.chainT = 0; G.mult = 1; G.stageBestChain = 0;
    G.speedBonus = 0; G.stageTime = 0; G.stallT = 0; G.dropPity = 0; G.lifeCharm = false;
    G.respawnT = 0; G.tally = null; G.slowT = 0; G.hitstop = 0; G.rocketT = 0; G.crewT = 3;
    G.paddle.stun = 0; G.paddle.flareT = 0; G.paddle.cool = 0;
  }

  G.toTitle = function () {
    resetField();
    G.mode = 'title'; G.paused = false; G.banner = null;
    G.floaters.length = 0;
    LW.Render.setTheme('night1');
    A.setTheme('title', 0);
    LW.UI.show('title');
  };

  G.newRun = function (startStage) {
    G.score = 0; G.shownScore = 0; G.lives = 3; G.jar = 0; G.wishes = {};
    G.stats = { lanterns: 0, bestChain: 0, flares: 0, time: 0, charms: 0 };
    G.floaters.length = 0; G.parts.length = 0; G.shells.length = 0; G.rings.length = 0;
    G.paused = false;
    LW.UI.show(null);
    G.loadStage(startStage || 0);
  };

  G.loadStage = function (i) {
    resetField();
    i = clamp(i, 0, LW.STAGES.length - 1);
    const def = LW.STAGES[i];
    G.stage = i; G.def = def;
    G.bridge = wish('lotus');
    const rows = def.map || [];
    for (let r = 0; r < rows.length; r++) {
      const line = rows[r];
      for (let c = 0; c < line.length && c < C.COLS; c++) {
        const ch = line[c];
        if (ch === '.' || ch === ' ') continue;
        const b = makeBrick(ch, c, r);
        if (b) G.bricks.push(b);
      }
    }
    if (def.movers) {
      for (const m of def.movers) for (const b of G.bricks) if (b.row === m.row) b.mover = m;
    }
    if (def.boss) {
      LW.Boss.create(def.boss);
      G.after(0.5, () => {
        if (def.boss === 'dragon') S.roar(); else if (def.boss === 'drum') S.thunder(); else S.eclipse();
        G.shake(6);
      });
    }
    G.paddle.x = G.input.useKeys ? 640 : clamp(G.input.x, C.L + 60, C.R - 60);
    spawnBallOnPaddle();
    G.mode = 'ready';
    const stageInNight = LW.STAGES.filter((s, k) => s.night === def.night && k <= i).length;
    G.banner = {
      t: 0, out: -1, boss: !!def.boss, title: def.name,
      sub: def.boss ? def.bossTitle : 'Night ' + U.roman(def.night) + '  ·  Stage ' + stageInNight,
      night: stageInNight === 1 ? LW.NIGHT_NAMES[def.night] : null,
    };
    LW.Render.setTheme(def.theme);
    A.setTheme(def.music, def.boss ? 2 : 1);
    LW.UI.show(null);
  };

  function spawnBallOnPaddle() {
    const n = 1 + wish('twin');
    for (let i = 0; i < n; i++) {
      const b = makeBall(G.paddle.x, C.PADDLE_Y - C.BALL_R - 1, 0, 0);
      b.stuck = true;
      b.off = n === 1 ? 0 : (i - (n - 1) / 2) * 26;
      G.balls.push(b);
    }
  }
  function makeBall(x, y, vx, vy) {
    return { x, y, vx, vy, r: C.BALL_R, stuck: false, off: 0, trail: [], pierce: 0, flareT: 0, clap: false, alive: true, idle: 0, lastPaddleT: -9, born: G.time };
  }

  function paddleTargetW() {
    let w = BASE_PADDLE * (1 + 0.14 * wish('oar'));
    if (G.effects.wide > 0) w *= 1.45;
    if (G.effects.shrink > 0) w *= 0.62;
    return w;
  }
  function ballSpeed() {
    let s = (G.def.speed || 480) * (1 + G.speedBonus) * (1 - 0.08 * wish('tide'));
    if (G.effects.slow > 0) s *= 0.68;
    if (G.effects.gale > 0) s *= 1.3;
    return s;
  }
  const chainWindow = () => 2.3 + 1.2 * wish('night');
  const durMul = () => 1 + 0.4 * wish('incense');
  const paddleLift = () => G.paddle.kick * 7 - G.paddle.dip * 3;

  function addScore(n, x, y, big) {
    const v = Math.round(n * (1 + 0.25 * wish('gold')));
    G.score += v;
    if (x !== undefined && (v >= 40 || big)) G.popup(x, y, '+' + v, big ? LW.GOLD_RGB : WHITE, big ? 22 : v >= 100 ? 18 : 14);
    return v;
  }
  G.addScore = addScore;

  function remaining() {
    let n = 0;
    for (let i = 0; i < G.bricks.length; i++) if (G.bricks[i].alive && G.bricks[i].counts) n++;
    return n;
  }
  G.remaining = remaining;

  /* ------------------------------------------------------------ input ---- */
  G.action = function () {
    if (G.paused) return;
    const p = G.paddle;
    if (G.mode === 'clear') { G.clearSkip = true; return; }
    if (G.mode === 'dawn') { G.clearSkip = true; return; }
    if (G.mode !== 'ready' && G.mode !== 'play') return;
    let launched = false;
    for (const b of G.balls) {
      if (!b.stuck) continue;
      launchBall(b);
      launched = true;
    }
    if (launched) {
      if (G.mode === 'ready') {
        G.mode = 'play';
        if (G.banner && G.banner.out < 0) G.banner.out = 0;
      }
      S.launch();
      return;
    }
    if (G.mode !== 'play' || p.stun > 0 || p.cool > 0) return;
    p.flareT = 0.15 + 0.05 * wish('kindle');
    p.cool = 0.62;
    p.kick = 1;
    S.swing();
    // forgiving: a click a hair after contact still counts
    for (const b of G.balls) {
      if (!b.stuck && G.time - b.lastPaddleT < 0.085 && b.flareT <= 0) { doFlare(b); break; }
    }
  };

  function launchBall(b) {
    const p = G.paddle;
    b.stuck = false;
    let ang = (b.off / (p.w / 2)) * 0.9 + clamp(p.vx / 1500, -0.45, 0.45);
    if (Math.abs(ang) < 0.08) ang = rand(-0.28, 0.28);
    ang = clamp(ang, -1.1, 1.1);
    const sp = ballSpeed();
    b.vx = Math.sin(ang) * sp; b.vy = -Math.cos(ang) * sp;
    b.idle = 0;
    G.sparks(b.x, b.y, 8, SPARK, 160, { dir: -Math.PI / 2, spread: 0.9, life: 0.35 });
  }

  function doFlare(b) {
    const p = G.paddle;
    b.pierce = 2 + 2 * wish('kindle');
    b.flareT = 1.5;
    b.clap = wish('clap') > 0;
    G.stats.flares++;
    addScore(40 * G.mult, b.x, b.y - 26, true);
    G.popup(b.x, b.y - 52, 'FLARE!', [190, 240, 255], 24);
    S.flare();
    G.shake(5);
    G.hitstop = Math.max(G.hitstop, 0.04);
    G.ring(b.x, b.y, 8, 90, 0.35, [200, 240, 255], 4);
    G.sparks(b.x, b.y, 22, [200, 240, 255], 420, { dir: -Math.PI / 2, spread: 1.2, life: 0.5, hot: true });
    p.flareT = 0; p.cool = 0.2; p.kick = 1;
  }

  /* ------------------------------------------------------- collisions ---- */
  function fixAngle(b) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const minY = 0.2 * sp;
    if (Math.abs(b.vy) < minY) {
      b.vy = (b.vy < 0 ? -1 : 1) * minY;
      b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(sp * sp - minY * minY);
    }
  }

  function wallFx(b, nx, ny) {
    S.wall();
    G.sparks(b.x - nx * b.r, b.y - ny * b.r, 4, SPARK, 110, { dir: Math.atan2(ny, nx), spread: 1, life: 0.3, size: 1.8 });
  }

  function collideWalls(b) {
    if (b.x < C.L + b.r) { b.x = C.L + b.r; if (b.vx < 0) { b.vx = -b.vx; wallFx(b, 1, 0); } }
    else if (b.x > C.R - b.r) { b.x = C.R - b.r; if (b.vx > 0) { b.vx = -b.vx; wallFx(b, -1, 0); } }
    if (b.y < C.T + b.r) { b.y = C.T + b.r; if (b.vy < 0) { b.vy = -b.vy; wallFx(b, 0, 1); fixAngle(b); } }
    if (b.vy > 0 && G.bridge > 0 && b.y + b.r >= C.WATER - 3 && b.y < C.WATER + 6) {
      b.y = C.WATER - 3 - b.r; b.vy = -Math.abs(b.vy);
      G.bridge--;
      fixAngle(b);
      S.catchBall(); S.charm();
      G.confetti(b.x, C.WATER - 4, 16, [255, 176, 214], 200);
      G.ring(b.x, C.WATER - 4, 6, 70, 0.4, [255, 190, 220], 3);
      G.ripples.push({ x: b.x, t: 0, life: 1.2, w: 80 });
      G.popup(b.x, C.WATER - 40, 'LOTUS SAVE', [255, 190, 220], 18);
      return;
    }
    if (b.y - b.r > C.WATER + 4) {
      if (LW.debug.god) { b.y = C.WATER - b.r; b.vy = -Math.abs(b.vy); return; }
      b.alive = false;
      G.splash(b.x, 1);
    }
  }

  function collidePaddle(b) {
    if (b.vy <= 0) return;
    const p = G.paddle;
    const top = C.PADDLE_Y - paddleLift();
    if (b.y + b.r < top || b.y > top + C.PADDLE_H + 3) return;
    const hw = p.w / 2 + b.r * 0.8;
    if (b.x < p.x - hw || b.x > p.x + hw) return;

    const t = clamp((b.x - p.x) / (p.w / 2), -1, 1);
    let ang = t * 1.02 + clamp(p.vx / 2600, -0.2, 0.2);
    ang = clamp(ang, -1.2, 1.2);
    const sp = Math.hypot(b.vx, b.vy) || ballSpeed();
    b.vx = Math.sin(ang) * sp; b.vy = -Math.cos(ang) * sp;
    b.y = top - b.r - 0.5;
    b.idle = 0;
    G.speedBonus = Math.min(0.22, G.speedBonus + 0.011);
    p.dip = 1;

    if (p.flareT > 0) { doFlare(b); return; }
    if (G.effects.catch > 0) {
      b.stuck = true; b.off = b.x - p.x; b.vx = b.vy = 0;
      S.catchBall();
      return;
    }
    b.lastPaddleT = G.time;
    S.paddle(Math.abs(t) > 0.7);
    G.sparks(b.x, top, 6, SPARK, 150, { dir: -Math.PI / 2, spread: 1.1, life: 0.3, size: 1.8 });
    G.ripples.push({ x: p.x, t: 0, life: 0.9, w: p.w * 0.7 });
  }

  function collideBricks(ball) {
    let best = null, bpen = 0, bnx = 0, bny = 0;
    const bricks = G.bricks, br = ball.r;
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      if (!b.alive || b.ghost) continue;
      let nx, ny, pen;
      if (b.circle) {
        const dx = ball.x - b.x, dy = ball.y - b.y, rr = br + b.r;
        if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.001;
        nx = dx / d; ny = dy / d; pen = rr - d;
      } else {
        if (ball.x < b.x - br || ball.x > b.x + b.w + br || ball.y < b.y - br || ball.y > b.y + b.h + br) continue;
        const cr = b.cr;
        const qx = clamp(ball.x, b.x + cr, b.x + b.w - cr), qy = clamp(ball.y, b.y + cr, b.y + b.h - cr);
        const dx = ball.x - qx, dy = ball.y - qy, rr = br + cr, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          nx = dx / d; ny = dy / d; pen = rr - d;
        } else {
          const l = ball.x - b.x, r = b.x + b.w - ball.x, tp = ball.y - b.y, bt = b.y + b.h - ball.y;
          const m = Math.min(l, r, tp, bt);
          nx = 0; ny = 0;
          if (m === l) nx = -1; else if (m === r) nx = 1; else if (m === tp) ny = -1; else ny = 1;
          pen = m + br;
        }
      }
      if (pen > bpen) { bpen = pen; best = b; bnx = nx; bny = ny; }
    }
    if (best) hitBrick(ball, best, bnx, bny, bpen);
  }

  function hitBrick(ball, b, nx, ny, pen) {
    let dmg = 1, pass = false;
    if (!b.indestructible) {
      if (G.effects.blaze > 0) { dmg = b.boss ? 2 : 9; pass = !b.boss; }
      else if (ball.pierce > 0) {
        dmg = 2;
        pass = !b.boss && b.hp <= 2;
        if (pass) ball.pierce--;
      }
      ball.idle = 0;
      if (ball.clap) { ball.clap = false; thunderclap(ball.x, ball.y, b); }
    }
    if (!pass) {
      ball.x += nx * pen; ball.y += ny * pen;
      const d = ball.vx * nx + ball.vy * ny;
      if (d < 0) { ball.vx -= 2 * d * nx; ball.vy -= 2 * d * ny; }
      fixAngle(ball);
    }
    G.damageBrick(b, dmg, ball.x - nx * ball.r, ball.y - ny * ball.r);
  }

  function thunderclap(x, y, src) {
    const rad = 78 + 26 * wish('clap');
    G.ring(x, y, 10, rad, 0.35, [200, 240, 255], 5);
    G.sparks(x, y, 18, [200, 240, 255], 300, { life: 0.4, hot: true });
    G.shake(5); S.boom(0.5);
    for (const o of G.bricks) {
      if (!o.alive || o === src || o.indestructible || o.ghost) continue;
      const d = Math.hypot(cxOf(o) - x, cyOf(o) - y) - (o.circle ? o.r : 0);
      if (d < rad) G.after(0.05 + d * 0.0008, () => G.damageBrick(o, 1, undefined, undefined, 'blast'));
    }
  }

  function brickRgb(b) {
    if (b.type === 'gold') return LW.GOLD_RGB;
    if (b.type === 'stone') return LW.STONE_RGB;
    if (b.type === 'cracker') return [255, 120, 80];
    if (b.type === 'bell') return LW.GOLD_RGB;
    return (LW.COLORS[b.color] || LW.COLORS.r).rgb;
  }
  G.brickRgb = brickRgb;

  G.damageBrick = function (b, dmg, hx, hy, cause) {
    if (!b.alive || b.ghost) return false;
    const cx = cxOf(b), cy = cyOf(b);
    if (hx === undefined) { hx = cx; hy = cy; }
    b.flash = 1;
    b.swayV += (hx < cx ? 1 : -1) * 1.1 + rand(-0.2, 0.2);
    if (b.indestructible) {
      b.ring = 1;
      S.bell();
      G.sparks(hx, hy, 6, LW.GOLD_RGB, 140, { life: 0.35 });
      G.ring(cx, cy, 14, 44, 0.4, LW.GOLD_RGB, 2);
      return false;
    }
    b.hp -= dmg;
    G.stallT = 0;
    if (b.hp <= 0) { destroyBrick(b, hx, hy, cause); return true; }
    if (b.boss) { LW.Boss.onHit(G.boss, b, hx, hy); return false; }
    if (b.type === 'dark') {
      S.ignite();
      const rgb = brickRgb(b);
      G.sparks(cx, cy, 12, rgb, 190, { life: 0.45 });
      G.ring(cx, cy, 12, 46, 0.32, rgb, 3);
    } else if (b.type === 'stone') {
      S.stone();
      G.debris(hx, hy, 4);
      G.shake(1.5);
    }
    addScore(5 * G.mult);
    return false;
  };

  function bumpChain() {
    G.chain++;
    G.chainT = chainWindow();
    if (G.chain > G.stats.bestChain) G.stats.bestChain = G.chain;
    if (G.chain > G.stageBestChain) G.stageBestChain = G.chain;
    const m = Math.min(8, 1 + Math.floor(G.chain / 5));
    if (m > G.mult) {
      G.mult = m;
      S.chainUp(m);
      G.multPulse = 1;
      if (m === 4 && wish('breath')) {
        G.effects.blaze = Math.max(G.effects.blaze, 2.6);
        G.popup(640, 560, "DRAGON'S BREATH", [255, 130, 70], 24);
      }
    }
    if (G.chain % 15 === 0) {
      const v = G.view;
      G.shell(rand(v.left + 60, v.right - 60), C.WATER - 6, rand(110, 300), pick(FW), rand(0.8, 1.15));
    }
  }

  function destroyBrick(b, hx, hy, cause) {
    b.alive = false;
    const x = cxOf(b), y = cyOf(b);
    bumpChain();
    if (b.boss) {
      LW.Boss.onDestroyed(G.boss, b);
      rollCharm(b, x, y);
      return;
    }
    G.stats.lanterns++;
    const rgb = brickRgb(b);
    switch (b.type) {
      case 'stone':
        addScore(60 * G.mult, x, y - 14);
        S.stoneBreak();
        G.debris(x, y, 14);
        G.smoke(x, y, 4, [90, 96, 110]);
        G.shake(3.5);
        break;
      case 'cracker':
        addScore(20 * G.mult, x, y - 14);
        G.explode(x, y, 88, b);
        break;
      case 'gold':
        addScore(100 * G.mult, x, y - 14);
        S.gold();
        G.release(x, y, 'gold', 'y');
        G.sparks(x, y, 26, LW.GOLD_RGB, 300, { life: 0.7, tw: 1 });
        G.ring(x, y, 10, 70, 0.45, LW.GOLD_RGB, 4);
        break;
      default:
        addScore(10 * G.mult, x, y - 14);
        S.lantern(G.chain);
        G.release(x, y, 'paper', b.color);
        G.sparks(x, y, 9, rgb, 200, { life: 0.5 });
        G.ring(x, y, 10, 40, 0.28, rgb, 2.5);
    }
    if (b.type !== 'cracker') {
      const n = b.type === 'gold' ? 4 : (U.chance(0.3) ? 1 : 0) + (U.chance(0.07) ? 1 : 0);
      for (let i = 0; i < n; i++) spawnFly(x + rand(-12, 12), y + rand(-8, 8));
    }
    if (cause !== 'blast' && (b.type === 'paper' || b.type === 'dark') && wish('cracker') && U.chance(0.125 * wish('cracker'))) {
      G.explode(x, y, 64, b, true);
    }
    rollCharm(b, x, y);
    if (!G.boss && remaining() === 0) {
      G.slowT = 0.75;
      G.flashScreen(0.35);
    }
  }

  G.explode = function (x, y, radius, src, small) {
    S.cracker();
    G.shake(small ? 3.5 : 7);
    if (!small) G.hitstop = Math.max(G.hitstop, 0.025);
    part(x, y, 0, 0, 0.22, radius * 1.5, [255, 200, 120], { hot: true });
    G.sparks(x, y, small ? 14 : 26, [255, 210, 120], 380, { life: 0.5, hot: true });
    G.sparks(x, y, small ? 8 : 14, [255, 90, 60], 260, { life: 0.6 });
    G.confetti(x, y, small ? 6 : 12, [220, 50, 40], 240);
    G.smoke(x, y, small ? 2 : 5);
    G.ring(x, y, 12, radius, 0.3, [255, 200, 140], 4);
    for (const o of G.bricks) {
      if (!o.alive || o === src || o.indestructible || o.ghost) continue;
      const d = Math.hypot(cxOf(o) - x, cyOf(o) - y) - (o.circle ? o.r : 0);
      if (d < radius) G.after(0.07 + d * 0.0007 + rand(0.03), () => G.damageBrick(o, 1, undefined, undefined, 'blast'));
    }
  };

  /* ----------------------------------------------------------- charms ---- */
  function pickCharm(goodOnly, gold) {
    const kinds = [];
    let total = 0;
    for (const k in LW.CHARMS) {
      const d = LW.CHARMS[k];
      let w = d.weight;
      if (d.bad && (goodOnly || G.stage < 1)) continue;
      if (k === 'life' && G.lifeCharm) continue;
      if (k === 'rockets' && G.boss) continue;          // guardians must be earned
      if (k === 'split' && G.balls.length >= 8) w *= 0.3;
      if (k === 'bridge' && G.bridge >= 2) continue;
      if (k === 'slow' && G.effects.slow > 4) continue;
      if (gold && k === 'life') w *= 2.5;
      for (const c of G.charms) if (c.kind === k) w *= 0.25;
      kinds.push([k, w]); total += w;
    }
    let r = Math.random() * total, kind = kinds[0][0];
    for (const kw of kinds) { r -= kw[1]; if (r <= 0) { kind = kw[0]; break; } }
    if (kind === 'life') G.lifeCharm = true;
    return kind;
  }
  G.dropCharm = function (x, y, goodOnly, gold) {
    G.charms.push({ kind: pickCharm(goodOnly, gold), x: clamp(x, C.L + 24, C.R - 24), y, vy: -60, t: 0, ph: rand(TAU) });
  };
  function rollCharm(b, x, y) {
    if (G.mode !== 'play' && G.mode !== 'ready') return;
    const gold = b.type === 'gold';
    let p = 0.1 * (1 + 0.35 * wish('fortune'));
    if (b.boss) p = b.counts ? 0 : 0.18;
    G.dropPity++;
    if (gold || (G.dropPity > 15 && !b.boss)) p = 1;
    if (G.charms.length >= 4 && !gold) return;
    if (Math.random() >= p) return;
    G.dropPity = 0;
    G.dropCharm(x, y, gold, gold);
  }

  function applyCharm(kind, x, y) {
    const def = LW.CHARMS[kind], d = durMul(), E = G.effects;
    G.stats.charms++;
    G.popup(x, y - 34, def.name.toUpperCase(), def.rgb, 19);
    G.ring(x, y, 10, 60, 0.4, def.rgb, 3);
    G.sparks(x, y, 14, def.rgb, 220, { life: 0.5 });
    if (def.bad) S.hazard(); else { S.charm(); addScore(50 * G.mult); }
    switch (kind) {
      case 'split': splitBalls(); break;
      case 'wide': E.wide = def.dur * d; E.shrink = 0; break;
      case 'blaze': E.blaze = def.dur * d; break;
      case 'slow': E.slow = def.dur * d; E.gale = 0; break;
      case 'catch': E.catch = def.dur * d; break;
      case 'rockets': E.rockets = def.dur * d; G.rocketT = 0.1; break;
      case 'bridge': G.bridge = Math.min(3, G.bridge + 1); break;
      case 'swarm': releaseSwarm(7, x, y); break;
      case 'life': G.lives++; S.life(); G.lifePulse = 1; break;
      case 'gale': E.gale = def.dur; E.slow = 0; G.shake(4); break;
      case 'shrink': E.shrink = def.dur; E.wide = 0; G.shake(4); break;
    }
  }

  function splitBalls() {
    const cur = G.balls.slice();
    for (const b of cur) {
      if (G.balls.length >= MAX_BALLS) break;
      const sp = ballSpeed();
      let ang = b.stuck ? -Math.PI / 2 : Math.atan2(b.vy, b.vx);
      for (const da of [-0.42, 0.42]) {
        if (G.balls.length >= MAX_BALLS) break;
        const n = makeBall(b.x, b.y - (b.stuck ? 4 : 0), Math.cos(ang + da) * sp, Math.sin(ang + da) * sp);
        fixAngle(n);
        G.balls.push(n);
      }
      G.sparks(b.x, b.y, 10, SPARK, 200, { life: 0.4 });
    }
    if (G.mode === 'ready' && G.balls.some((b) => !b.stuck)) {
      G.mode = 'play';
      if (G.banner && G.banner.out < 0) G.banner.out = 0;
    }
  }

  function releaseSwarm(n, x, y) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-1.2, 1.2);
      G.swarm.push({ x, y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, target: null, t: 0, wait: i * 0.06, ph: rand(TAU) });
    }
  }
  G.releaseSwarm = releaseSwarm;

  function spawnFly(x, y) {
    if (G.flies.length > 70) return;
    G.flies.push({ x, y, vx: rand(-40, 40), vy: rand(-70, -20), t: 0, ph: rand(TAU), caught: false });
  }
  G.spawnFly = spawnFly;
  function collectFly(f) {
    const n = wish('friend') ? 2 : 1;
    G.jar += n;
    addScore(8 * G.mult);
    S.fly();
    G.sparks(f.x, f.y, 4, FLY_RGB, 90, { life: 0.3, g: 0, size: 1.6 });
    G.jarPulse = 1;
    if (G.jar >= C.JAR) {
      G.jar -= C.JAR;
      G.lives++;
      G.lifePulse = 1;
      S.life();
      G.popup(G.paddle.x, C.PADDLE_Y - 46, '+1 SPARE SPARK', FLY_RGB, 22);
      G.ring(G.paddle.x, C.PADDLE_Y, 10, 110, 0.6, FLY_RGB, 4);
    }
  }

  /* ----------------------------------------------------------- updates ---- */
  function updatePaddle(dt) {
    const p = G.paddle;
    p.w = U.damp(p.w, paddleTargetW(), 9, dt);
    const hw = p.w / 2, prev = p.x;
    if (p.stun > 0) {
      p.stun -= dt;
      if (U.chance(dt * 40)) G.sparks(p.x + rand(-hw, hw), C.PADDLE_Y, 1, [170, 220, 255], 120, { life: 0.25, hot: true });
    } else if (G.input.useKeys) {
      const dir = (G.input.right ? 1 : 0) - (G.input.left ? 1 : 0);
      p.kv = U.damp(p.kv, dir * 1000, dir ? 13 : 18, dt);
      p.x += p.kv * dt;
    } else {
      p.x = U.damp(p.x, G.input.x, 34, dt);
    }
    p.x = clamp(p.x, C.L + hw, C.R - hw);
    if (dt > 0) p.vx = U.damp(p.vx, (p.x - prev) / dt, 18, dt);
    p.kick = Math.max(0, p.kick - dt * 6.5);
    p.dip = Math.max(0, p.dip - dt * 6);
    if (p.flareT > 0) p.flareT -= dt;
    if (p.cool > 0) p.cool -= dt;
    p.wakeT -= dt;
    if (p.wakeT <= 0 && Math.abs(p.vx) > 120) {
      p.wakeT = 0.12;
      G.ripples.push({ x: p.x - Math.sign(p.vx) * hw * 0.8, t: 0, life: 0.8, w: 26 + Math.min(40, Math.abs(p.vx) * 0.03) });
    }
  }

  function updateBricks(dt) {
    const st = G.stageTime;
    for (let i = 0; i < G.bricks.length; i++) {
      const b = G.bricks[i];
      if (!b.alive) continue;
      if (b.intro < 1) {
        if (b.introDelay > 0) b.introDelay -= dt;
        else b.intro = Math.min(1, b.intro + dt * 3.4);
      }
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 5);
      if (b.ring > 0) b.ring = Math.max(0, b.ring - dt * 0.8);
      b.swayV += (-b.sway * 62 - b.swayV * 3.4) * dt;
      b.sway += b.swayV * dt;
      if (b.mover) b.x = b.baseX + Math.sin(st * b.mover.speed * 2) * b.mover.amp;
    }
  }

  function updateBalls(dt) {
    const p = G.paddle, target = ballSpeed();
    for (let i = G.balls.length - 1; i >= 0; i--) {
      const b = G.balls[i];
      if (b.stuck) {
        const lim = Math.max(0, p.w / 2 - 6);
        b.off = clamp(b.off, -lim, lim);
        b.x = p.x + b.off; b.y = C.PADDLE_Y - b.r - 1 - paddleLift();
        b.trail.length = 0;
        continue;
      }
      if (b.flareT > 0) { b.flareT -= dt; if (b.flareT <= 0) b.pierce = 0; }
      if (G.boss && G.boss.kind === 'moon') LW.Boss.bend(G.boss, b, dt);
      const want = target * (1 + 0.3 * clamp(b.flareT / 1.2, 0, 1));
      let sp = Math.hypot(b.vx, b.vy);
      if (sp < 1) { b.vx = 0; b.vy = -1; sp = 1; }
      const ns = U.damp(sp, want, 9, dt);
      b.vx *= ns / sp; b.vy *= ns / sp;
      const steps = Math.max(1, Math.ceil((ns * dt) / 5));
      const h = dt / steps;
      for (let s = 0; s < steps && b.alive && !b.stuck; s++) {
        b.x += b.vx * h; b.y += b.vy * h;
        collideWalls(b);
        if (!b.alive) break;
        collidePaddle(b);
        if (b.stuck) break;
        collideBricks(b);
      }
      if (!b.alive) { G.balls.splice(i, 1); continue; }
      b.trail.unshift(b.x, b.y);
      if (b.trail.length > 28) b.trail.length = 28;
      b.idle += dt;
      if (b.idle > 9) {
        const a = Math.atan2(b.vy, b.vx) + rand(-0.6, 0.6);
        b.vx = Math.cos(a) * ns; b.vy = Math.sin(a) * ns;
        fixAngle(b);
        b.idle = 5;
      }
      if (G.effects.blaze > 0 && U.chance(dt * 50)) {
        part(b.x + rand(-4, 4), b.y + rand(-4, 4), rand(-30, 30), rand(-80, -20), rand(0.25, 0.5), rand(3, 6), [255, 120, 50], { drag: 1 });
      }
    }
  }

  function updateRockets(dt) {
    const p = G.paddle;
    if (G.mode === 'play' && p.stun <= 0) {
      if (G.effects.rockets > 0) {
        G.rocketT -= dt;
        if (G.rocketT <= 0) {
          G.rocketT = 0.34;
          fireRocket(p.x - p.w / 2 + 12); fireRocket(p.x + p.w / 2 - 12);
          S.rocket();
        }
      }
      if (wish('rocket')) {
        G.crewT -= dt;
        if (G.crewT <= 0) {
          G.crewT = 5.2 - 1.7 * (wish('rocket') - 1);
          fireRocket(p.x);
          S.rocket();
        }
      }
    }
    for (let i = G.rockets.length - 1; i >= 0; i--) {
      const r = G.rockets[i];
      r.t += dt;
      r.y += r.vy * dt;
      r.x += Math.sin(r.t * 18 + r.ph) * 22 * dt;
      if (U.chance(dt * 70)) part(r.x + rand(-2, 2), r.y + 10, rand(-20, 20), rand(40, 120), rand(0.15, 0.35), rand(1.6, 3), [255, 190, 110], { drag: 1 });
      let hit = null;
      for (const b of G.bricks) {
        if (!b.alive || b.ghost) continue;
        if (b.circle) { if (Math.hypot(r.x - b.x, r.y - b.y) < b.r + 4) { hit = b; break; } }
        else if (r.x > b.x - 3 && r.x < b.x + b.w + 3 && r.y > b.y - 4 && r.y < b.y + b.h + 4) { hit = b; break; }
      }
      if (hit || r.y < C.T + 6) {
        G.sparks(r.x, r.y, 12, r.rgb, 220, { life: 0.4, tw: 1 });
        part(r.x, r.y, 0, 0, 0.16, 34, r.rgb, { hot: true });
        if (hit) G.damageBrick(hit, 1, r.x, r.y);
        G.rockets.splice(i, 1);
      }
    }
  }
  function fireRocket(x) {
    G.rockets.push({ x, y: C.PADDLE_Y - 8, vy: -820, t: 0, ph: rand(TAU), rgb: pick(FW) });
    G.sparks(x, C.PADDLE_Y - 4, 4, SPARK, 120, { dir: Math.PI / 2, spread: 0.8, life: 0.25 });
  }

  function updateCharms(dt) {
    const p = G.paddle;
    for (let i = G.charms.length - 1; i >= 0; i--) {
      const c = G.charms[i];
      c.t += dt;
      c.vy = U.damp(c.vy, 150, 2.4, dt);
      c.y += c.vy * dt;
      c.x += Math.sin(c.t * 2.6 + c.ph) * 22 * dt;
      c.x = clamp(c.x, C.L + 18, C.R - 18);
      if (c.y > C.PADDLE_Y - 20 && c.y < C.PADDLE_Y + 24 && Math.abs(c.x - p.x) < p.w / 2 + 16) {
        applyCharm(c.kind, c.x, C.PADDLE_Y - 8);
        G.charms.splice(i, 1);
      } else if (c.y > C.WATER + 6) {
        G.splash(c.x, 0.45);
        G.charms.splice(i, 1);
      }
    }
  }

  function updateFlies(dt) {
    const p = G.paddle, friend = wish('friend') > 0;
    for (let i = G.flies.length - 1; i >= 0; i--) {
      const f = G.flies[i];
      f.t += dt;
      const dx = p.x - f.x, dy = C.PADDLE_Y - f.y, d = Math.hypot(dx, dy) || 1;
      const reach = friend ? 420 : 120;
      if (d < reach && f.t > 0.3) {
        const pull = (friend ? 900 : 700) * (1 - d / reach) + 120;
        f.vx += (dx / d) * pull * dt; f.vy += (dy / d) * pull * dt;
      } else {
        f.vx = U.damp(f.vx, Math.cos(f.t * 2.1 + f.ph) * 46, 3, dt);
        f.vy = U.damp(f.vy, 58 + Math.sin(f.t * 3.3 + f.ph) * 26, 2.2, dt);
      }
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.x = clamp(f.x, C.L + 6, C.R - 6);
      if (f.y > C.PADDLE_Y - 10 && f.y < C.PADDLE_Y + 22 && Math.abs(f.x - p.x) < p.w / 2 + 12) {
        collectFly(f);
        G.flies.splice(i, 1);
      } else if (f.y > C.WATER - 2) {
        G.sparks(f.x, C.WATER - 3, 2, FLY_RGB, 40, { life: 0.3, g: 0, size: 1.4 });
        G.flies.splice(i, 1);
      }
    }
  }

  function updateHazards(dt) {
    const p = G.paddle;
    for (let i = G.hazards.length - 1; i >= 0; i--) {
      const h = G.hazards[i];
      h.t += dt;
      h.x += h.vx * dt; h.y += h.vy * dt;
      const rgb = h.kind === 'shadow' ? [150, 90, 220] : [255, 130, 60];
      if (U.chance(dt * 40)) part(h.x + rand(-4, 4), h.y + rand(-4, 4), rand(-20, 20), rand(-50, 10), rand(0.25, 0.5), rand(3, 6), rgb, { drag: 1 });
      let dead = false;
      for (const b of G.balls) {
        if (!b.stuck && Math.hypot(b.x - h.x, b.y - h.y) < b.r + h.r + 2) {
          dead = true;
          G.sparks(h.x, h.y, 14, rgb, 240, { life: 0.4 });
          G.ring(h.x, h.y, 6, 40, 0.3, rgb, 3);
          addScore(25 * G.mult, h.x, h.y - 10);
          S.ignite();
          break;
        }
      }
      if (!dead && h.y + h.r > C.PADDLE_Y && h.y - h.r < C.PADDLE_Y + 18 && Math.abs(h.x - p.x) < p.w / 2 + h.r * 0.5) {
        dead = true;
        G.singe(h.kind);
      }
      if (!dead && h.y > C.WATER) { dead = true; G.splash(h.x, 0.5); G.smoke(h.x, C.WATER - 8, 2, [120, 120, 130]); }
      if (!dead && (h.x < C.L - 60 || h.x > C.R + 60)) dead = true;
      if (dead) G.hazards.splice(i, 1);
    }
  }
  G.singe = function (kind) {
    const p = G.paddle;
    if (LW.debug.god) return;
    G.effects.shrink = Math.max(G.effects.shrink, 6);
    G.effects.wide = 0;
    G.shake(8);
    S.hazard();
    G.flashScreen(0.25, kind === 'shadow' ? [150, 90, 220] : [255, 120, 60]);
    G.popup(p.x, C.PADDLE_Y - 34, kind === 'shadow' ? 'SHADOWED' : 'SINGED', kind === 'shadow' ? [190, 140, 255] : [255, 140, 90], 20);
    G.sparks(p.x, C.PADDLE_Y, 18, kind === 'shadow' ? [170, 110, 240] : [255, 140, 70], 260, { life: 0.5 });
    G.smoke(p.x, C.PADDLE_Y - 6, 4);
  };
  G.stun = function (t) {
    const p = G.paddle;
    if (LW.debug.god) return;
    p.stun = Math.max(p.stun, t);
    p.flareT = 0;
    G.popup(p.x, C.PADDLE_Y - 34, 'STUNNED', [170, 220, 255], 20);
    G.sparks(p.x, C.PADDLE_Y, 24, [170, 220, 255], 320, { life: 0.5, hot: true });
  };

  function updateSwarm(dt) {
    for (let i = G.swarm.length - 1; i >= 0; i--) {
      const s = G.swarm[i];
      s.t += dt;
      if (s.wait > 0) { s.wait -= dt; }
      if (!s.target || !s.target.alive || s.target.ghost) {
        s.target = null;
        const opts = [];
        for (const b of G.bricks) if (b.alive && !b.indestructible && !b.ghost) opts.push(b);
        if (opts.length) s.target = pick(opts);
      }
      if (!s.target) {
        if (s.t > 0.6) { G.sparks(s.x, s.y, 5, FLY_RGB, 80, { life: 0.3, g: 0 }); G.swarm.splice(i, 1); continue; }
      } else if (s.wait <= 0) {
        const tx = cxOf(s.target), ty = cyOf(s.target);
        const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
        const wob = Math.sin(s.t * 9 + s.ph) * 0.5;
        const c = Math.cos(wob), sn = Math.sin(wob);
        const ux = (dx / d) * c - (dy / d) * sn, uy = (dx / d) * sn + (dy / d) * c;
        s.vx = U.damp(s.vx, ux * 560, 5, dt); s.vy = U.damp(s.vy, uy * 560, 5, dt);
        if (d < 16 + (s.target.circle ? s.target.r : 12)) {
          G.sparks(s.x, s.y, 8, FLY_RGB, 160, { life: 0.35, g: 0 });
          G.damageBrick(s.target, s.target.boss ? 1 : 2, s.x, s.y);
          G.swarm.splice(i, 1);
          continue;
        }
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (U.chance(dt * 45)) part(s.x, s.y, rand(-12, 12), rand(-12, 12), rand(0.2, 0.4), 2.4, FLY_RGB, { g: 0 });
      if (s.t > 8) G.swarm.splice(i, 1);
    }
  }

  function runQueue() {
    const q = G.queue;
    for (let i = 0; i < q.length;) {
      if (q[i].t <= G.time) {
        const fn = q[i].fn;
        q.splice(i, 1);
        fn();
      } else i++;
    }
  }

  function updateFx(dt) {
    // particles
    const ps = G.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      if (p.kind === 2 && p.y > C.WATER) { p.life = 0; if (U.chance(0.4)) G.ripples.push({ x: p.x, t: 0, life: 0.7, w: 22 }); }
      if (p.kind === 4 && p.y > C.WATER + 2 && p.vy > 0) p.life = 0;
    }
    for (let i = G.rings.length - 1; i >= 0; i--) {
      const r = G.rings[i];
      r.t += dt;
      if (r.t >= r.life) G.rings.splice(i, 1);
    }
    for (let i = G.ripples.length - 1; i >= 0; i--) {
      const r = G.ripples[i];
      r.t += dt;
      if (r.t >= r.life) G.ripples.splice(i, 1);
    }
    if (G.ripples.length > 60) G.ripples.splice(0, G.ripples.length - 60);
    for (let i = G.popups.length - 1; i >= 0; i--) {
      const p = G.popups[i];
      p.t += dt;
      p.y -= 34 * dt * (1 - p.t / p.life);
      if (p.t >= p.life) G.popups.splice(i, 1);
    }
    // released lanterns
    const top = G.view.top - 50;
    for (let i = G.floaters.length - 1; i >= 0; i--) {
      const f = G.floaters[i];
      f.t += dt;
      f.vy = U.damp(f.vy, f.tvy, 1.3, dt);
      f.vx = U.damp(f.vx, 0, 0.8, dt);
      f.y += f.vy * dt;
      f.x += (f.vx + Math.sin(f.t * 0.9 + f.ph) * 9) * dt;
      f.sc = U.damp(f.sc, f.tsc, 1.5, dt);
      if (f.y < top || f.t > 90) G.floaters.splice(i, 1);
    }
    // firework shells
    for (let i = G.shells.length - 1; i >= 0; i--) {
      const s = G.shells[i];
      s.t += dt;
      s.y += s.vy * dt;
      s.vy += 230 * dt;
      s.x += Math.sin(s.t * 14 + s.wob) * 16 * dt;
      if (U.chance(dt * 60)) part(s.x, s.y, rand(-14, 14), rand(20, 70), rand(0.2, 0.5), 2, [255, 210, 150], { layer: 0, drag: 1 });
      if (s.y <= s.ty || s.vy > -90) {
        G.firework(s.x, s.y, s.rgb, s.size, 0);
        G.shells.splice(i, 1);
      }
    }
    // HUD easing
    G.shownScore = G.score - (G.score - G.shownScore) * Math.exp(-10 * dt);
    if (G.score - G.shownScore < 0.6) G.shownScore = G.score;
    if (G.multPulse > 0) G.multPulse = Math.max(0, G.multPulse - dt * 3);
    if (G.jarPulse > 0) G.jarPulse = Math.max(0, G.jarPulse - dt * 4);
    if (G.lifePulse > 0) G.lifePulse = Math.max(0, G.lifePulse - dt * 1.6);
    if (G.lostFlash > 0) G.lostFlash = Math.max(0, G.lostFlash - dt * 1.4);
  }

  function updatePlay(dt) {
    const playing = G.mode === 'play';
    if (playing) { G.stageTime += dt; G.stats.time += dt; }
    if (G.banner) {
      G.banner.t += dt;
      if (G.banner.out >= 0) { G.banner.out += dt; if (G.banner.out > 0.7) G.banner = null; }
    }
    updatePaddle(dt);
    if (G.respawnT > 0) {
      G.respawnT -= dt;
      if (G.respawnT <= 0) spawnBallOnPaddle();
    }
    const E = G.effects;
    const hadCatch = E.catch > 0;
    for (const k in E) if (E[k] > 0) E[k] = Math.max(0, E[k] - dt);
    if (hadCatch && E.catch <= 0 && playing) {
      for (const b of G.balls) if (b.stuck) launchBall(b);
    }
    if (G.chain > 0 && playing) {
      G.chainT -= dt;
      if (G.chainT <= 0) {
        if (G.mult >= 3) S.chainBreak();
        G.chain = 0; G.mult = 1;
      }
    }
    updateBricks(dt);
    if (G.boss) LW.Boss.update(G.boss, dt, playing);
    updateBalls(dt);
    updateRockets(dt);
    updateCharms(dt);
    updateFlies(dt);
    updateHazards(dt);
    updateSwarm(dt);

    if (G.mode !== 'play' && G.mode !== 'ready') return;
    // The last few lanterns can be stubborn: after a dry spell a firefly helps out.
    if (playing && !G.boss) {
      G.stallT += dt;
      const left = remaining();
      if (left > 0 && left <= 4 && G.stallT > 8 && G.swarm.length === 0) {
        G.stallT = 0;
        releaseSwarm(1, G.paddle.x, C.PADDLE_Y - 12);
        G.popup(G.paddle.x, C.PADDLE_Y - 44, 'A FIREFLY LENDS A HAND', FLY_RGB, 17);
        S.fly();
      }
    }
    if (remaining() === 0 && G.queue.length === 0 && (!G.boss || G.boss.dead)) { stageClear(); return; }
    if (G.mode === 'play' && G.balls.length === 0 && G.respawnT <= 0) loseLife();
  }

  function loseLife() {
    if (G.boss && G.boss.dying) { G.respawnT = 0.6; G.mode = 'ready'; return; }
    for (const k in G.effects) G.effects[k] = 0;
    G.chain = 0; G.mult = 1; G.speedBonus = 0;
    G.shake(9);
    G.lostFlash = 1;
    S.lost();
    if (G.lives <= 0) { gameOver(); return; }
    G.lives--;
    G.lifePulse = 1;
    G.mode = 'ready';
    G.respawnT = 0.95;
  }

  function gameOver() {
    G.mode = 'over';
    recordBest();
    S.gameOver();
    A.setTheme(A.currentTheme(), 0);
    const stamp = G.time;
    window.setTimeout(() => { if (G.mode === 'over' && G.time >= stamp) LW.UI.showEnd(false); }, LW.debug.auto ? 200 : 1300);
  }

  function stageClear() {
    G.mode = 'clear'; G.clearT = 0; G.clearSkip = false;
    if (G.banner) G.banner = null;
    const bonus = Math.round((400 + 150 * G.stage + G.lives * 100 + G.stageBestChain * 10) * (1 + 0.25 * wish('gold')));
    G.score += bonus;
    G.tally = { bonus, chain: G.stageBestChain, boss: !!G.def.boss, final: !!G.def.final };
    for (const b of G.balls) {
      G.shell(b.x, b.y, Math.max(110, b.y - rand(180, 320)), pick(FW), 1);
    }
    G.balls.length = 0;
    for (const f of G.flies) { G.jar++; G.sparks(f.x, f.y, 3, FLY_RGB, 60, { g: 0, life: 0.3 }); }
    while (G.jar >= C.JAR) { G.jar -= C.JAR; G.lives++; G.lifePulse = 1; }
    G.flies.length = 0;
    for (const c of G.charms) G.sparks(c.x, c.y, 10, LW.CHARMS[c.kind].rgb, 160, { life: 0.4 });
    G.charms.length = 0; G.hazards.length = 0; G.rockets.length = 0; G.swarm.length = 0;
    for (const k in G.effects) G.effects[k] = 0;
    G.chain = 0; G.mult = 1;
    recordBest();
    if (G.def.final) {
      G.mode = 'dawn'; G.dawnT = 0;
      G.best.won = true; LW.Save.store();
      LW.Render.setTheme('dawn', 4.5);
      A.setTheme('dawn', 0);
      S.dawn();
      return;
    }
    S.stageClear();
    const v = G.view, n = G.def.boss ? 16 : 10;
    for (let i = 0; i < n; i++) {
      G.after(0.2 + i * 0.3 + rand(0.12), () => {
        G.shell(rand(v.left + 80, v.right - 80), C.WATER - 6, rand(100, 340), pick(FW), rand(0.9, 1.4));
      });
    }
  }

  function updateClear(dt, rdt) {
    G.clearT += rdt;
    updatePaddle(dt);
    updateBricks(dt);
    if (G.clearT > 4.4 || (G.clearSkip && G.clearT > 1.1) || (LW.debug.auto && G.clearT > 0.4)) {
      G.mode = 'wish';
      LW.UI.showWish(G.pickWishes());
    }
  }

  function updateDawn(dt, rdt) {
    G.dawnT += rdt;
    updatePaddle(dt);
    const v = G.view;
    // every swallowed lantern pours back into the sky
    if (G.dawnT < 7 && U.chance(rdt * 26)) {
      const col = pick(['r', 'o', 'y', 'p', 'v', 'b', 't', 'w', 'w']);
      if (G.dawnT < 2.2) {
        const a = rand(TAU), s = rand(60, 320);
        G.release(640, 220, 'paper', col, { vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, sc: 0.2, tsc: rand(0.3, 0.6), tvy: -rand(26, 60) });
      } else {
        G.release(rand(v.left, v.right), C.WATER + 4, 'paper', col, { sc: rand(0.3, 0.55), tsc: rand(0.3, 0.6), tvy: -rand(30, 70), vy: -30 });
      }
    }
    if (G.dawnT > 1.5 && G.dawnT < 9 && U.chance(rdt * 1.1)) {
      G.shell(rand(v.left + 80, v.right - 80), C.WATER - 6, rand(100, 320), pick(FW), rand(1, 1.5));
    }
    if (G.dawnT > 10 || (G.clearSkip && G.dawnT > 4) || (LW.debug.auto && G.dawnT > 1.5)) {
      G.mode = 'victory';
      LW.UI.showEnd(true);
    }
  }

  function updateTitle(dt) {
    const v = G.view;
    G.attractT -= dt;
    if (G.attractT <= 0) {
      G.attractT = rand(0.22, 0.5);
      G.release(rand(v.left, v.right), C.WATER + 6, U.chance(0.06) ? 'gold' : 'paper', pick(['r', 'r', 'o', 'o', 'y', 'p', 'v', 'b', 't', 'w']),
        { sc: 0.2, tsc: rand(0.3, 0.75), tvy: -rand(18, 46), vy: -20, vx: rand(-6, 6) });
    }
    G.attractF -= dt;
    if (G.attractF <= 0) {
      G.attractF = rand(2.4, 5);
      G.shell(rand(v.left + 80, v.right - 80), C.WATER - 6, rand(110, 320), pick(FW), rand(0.8, 1.3));
    }
    G.input.x = 640 + Math.sin(G.time * 0.35) * 320;
    G.input.useKeys = false;
    updatePaddle(dt);
  }

  G.pickWishes = function () {
    const pool = LW.WISHES.filter((w) => wish(w.id) < w.max);
    const out = [];
    while (out.length < 3 && pool.length) {
      let total = 0;
      for (const w of pool) total += w.rare ? 0.4 : 1;
      let r = Math.random() * total, idx = 0;
      for (let i = 0; i < pool.length; i++) {
        r -= pool[i].rare ? 0.4 : 1;
        if (r <= 0) { idx = i; break; }
      }
      out.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return out;
  };
  G.takeWish = function (id) {
    G.wishes[id] = wish(id) + 1;
    if (id === 'spark') { G.lives++; G.lifePulse = 1; }
    S.wish();
    G.loadStage(G.stage + 1);
  };

  G.togglePause = function (force) {
    if (G.mode !== 'ready' && G.mode !== 'play' && G.mode !== 'clear') return;
    const want = force === undefined ? !G.paused : force;
    if (want === G.paused) return;
    G.paused = want;
    LW.UI.show(want ? 'pause' : null);
    if (want) S.tick(); else S.select();
  };

  // Simple self-playing pilot used for automated testing (?auto).
  function autopilot() {
    if (G.mode !== 'ready' && G.mode !== 'play') return;
    const p = G.paddle;
    let best = null;
    for (const b of G.balls) if (!b.stuck && b.vy > 0 && (!best || b.y > best.y)) best = b;
    let tx = p.x;
    if (best) {
      const t = (C.PADDLE_Y - best.y) / best.vy;
      tx = best.x + best.vx * t;
      const lo = C.L + best.r, hi = C.R - best.r, span = hi - lo;
      let m = ((tx - lo) % (2 * span) + 2 * span) % (2 * span);
      if (m > span) m = 2 * span - m;
      tx = lo + m + Math.sin(G.time * 1.3) * p.w * 0.32;
    } else if (G.charms.length) tx = G.charms[0].x;
    G.input.x = tx; G.input.useKeys = false;
    if (G.balls.some((b) => b.stuck) && G.time % 0.5 < 0.05) G.action();
    else if (best && C.PADDLE_Y - best.y < 14 && Math.random() < 0.2) G.action();
  }

  G.update = function (rdt) {
    G.realTime += rdt;
    if (G.shakeMag > 0) {
      G.shakeMag = Math.max(0, G.shakeMag - rdt * (18 + G.shakeMag * 3));
      G.shakeX = rand(-1, 1) * G.shakeMag; G.shakeY = rand(-1, 1) * G.shakeMag;
    } else { G.shakeX = G.shakeY = 0; }
    if (G.flash > 0) G.flash = Math.max(0, G.flash - rdt * 2.6);
    if (G.hitstop > 0) { G.hitstop -= rdt; return; }
    if (G.slowT > 0) G.slowT -= rdt;
    G.timeScale = U.damp(G.timeScale, G.slowT > 0 ? 0.26 : 1, 14, rdt);
    const dt = rdt * G.timeScale;
    G.time += dt;
    if (LW.debug.auto) autopilot();
    runQueue();
    switch (G.mode) {
      case 'title': updateTitle(dt); break;
      case 'ready':
      case 'play': updatePlay(dt); break;
      case 'clear': updateClear(dt, rdt); break;
      case 'dawn': updateDawn(dt, rdt); break;
      default: updatePaddle(dt); updateBricks(dt); if (G.boss) LW.Boss.update(G.boss, dt, false);
    }
    updateFx(dt);
  };
})();
