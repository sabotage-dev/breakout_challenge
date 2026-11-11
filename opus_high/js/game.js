/* SHATTERLIGHT — a neon brick-breaking odyssey
 * Pure canvas + WebAudio. No external dependencies.
 */
(() => {
  'use strict';

  // ================================================================ constants
  const W = 960, H = 720;
  const FL = 14, FR = W - 14, FT = 62;          // playfield walls
  const COLS = 14, BW = 60, BH = 22, GAP = 4;
  const GRID_X = Math.round((W - (COLS * (BW + GAP) - GAP)) / 2);
  const GRID_Y = 96;
  const PADDLE_Y = H - 54;
  const PADDLE_H = 14;
  const BASE_PW = 124;
  const BALL_R = 7;
  const SHIELD_Y = H - 18;
  const MAX_BALLS = 32;
  const DROP_CHANCE = 0.12;
  const TAU = Math.PI * 2;
  const STEP = 1 / 120;
  const FONT = '"Avenir Next", "Futura", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  const MONO = '"SF Mono", Menlo, Consolas, "Courier New", monospace';

  const CAPS = {
    expand: { label: 'E', name: 'EXPAND', color: '#4b8bff', w: 13 },
    multi: { label: 'M', name: 'MULTIBALL', color: '#ff4bd2', w: 13 },
    laser: { label: 'L', name: 'LASERS', color: '#ff3b5c', w: 10 },
    catch: { label: 'C', name: 'MAGNET', color: '#4dff88', w: 9 },
    slow: { label: 'S', name: 'SLOW-MO', color: '#3bf0ff', w: 9 },
    fire: { label: 'F', name: 'FIREBALL', color: '#ff8a3b', w: 6 },
    shield: { label: 'B', name: 'BARRIER', color: '#e6ecff', w: 8 },
    zap: { label: 'Z', name: 'CHAIN ZAP', color: '#fff36b', w: 6 },
    life: { label: '1UP', name: 'EXTRA LIFE', color: '#ffd93b', w: 2.5 },
    shrink: { label: '!', name: 'SHRINK', color: '#8d7bb0', w: 7, bad: true },
  };
  const FX_DUR = { expand: 20, shrink: 12, laser: 14, catch: 18, slow: 12, fire: 9 };
  const FX_ORDER = ['expand', 'shrink', 'laser', 'catch', 'slow', 'fire'];

  // ================================================================ utils
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  const load = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  const save = {
    best: +load('sl_best') || 0,
    unlocked: Math.max(1, +load('sl_unlocked') || 1),
    shake: load('sl_shake') !== '0',
  };

  function hexRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(hex, t) {
    const [r, g, b] = hexRgb(hex);
    const f = t >= 0 ? (c) => Math.round(c + (255 - c) * t) : (c) => Math.round(c * (1 + t));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }

  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // ================================================================ canvas
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const wrap = $('wrap');
  let viewScale = 1, dpr = 1;
  const hasSpacing = 'letterSpacing' in ctx;

  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const cw = Math.floor(W * s), ch = Math.floor(H * s);
    wrap.style.width = cw + 'px';
    wrap.style.height = ch + 'px';
    wrap.style.setProperty('--s', (cw / W).toFixed(4));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    viewScale = cw / W;
  }
  window.addEventListener('resize', resize);
  resize();

  function font(size, weight = 800, family = FONT, spacing = 0) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (hasSpacing) ctx.letterSpacing = spacing + 'px';
  }

  // ================================================================ sprites
  const glowCache = {};
  function glowSprite(color) {
    let c = glowCache[color];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const [r, gg, b] = hexRgb(color);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, `rgba(${r},${gg},${b},1)`);
    grd.addColorStop(0.2, `rgba(${r},${gg},${b},0.55)`);
    grd.addColorStop(0.5, `rgba(${r},${gg},${b},0.16)`);
    grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    glowCache[color] = c;
    return c;
  }
  function drawGlow(color, x, y, rad, alpha = 1, sy = 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(glowSprite(color), x - rad, y - rad * sy, rad * 2, rad * 2 * sy);
  }

  const SPR_S = 2, SPR_P = 10;
  const spriteCache = {};
  function brickSprite(br) {
    const key = br.type + br.color + br.w + 'x' + br.h + (br.type === 'tough' ? br.hp : '');
    let c = spriteCache[key];
    if (c) return c;
    const w = br.w, h = br.h, P = SPR_P, S = SPR_S, col = br.color;
    c = document.createElement('canvas');
    c.width = (w + P * 2) * S; c.height = (h + P * 2) * S;
    const g = c.getContext('2d');
    g.scale(S, S); g.translate(P, P);
    const rad = Math.min(5, h / 4);

    // outer glow
    g.save();
    g.shadowColor = col; g.shadowBlur = 8 * S;
    g.fillStyle = rgba(br.type === 'steel' ? '#8090b0' : col, br.type === 'steel' ? 0.35 : 0.6);
    rr(g, 0, 0, w, h, rad); g.fill();
    g.restore();

    if (br.type === 'normal' || br.type === 'prize') {
      const grd = g.createLinearGradient(0, 0, 0, h);
      if (br.type === 'prize') {
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.5, '#e4e0ff'); grd.addColorStop(1, '#9d8cff');
      } else {
        grd.addColorStop(0, shade(col, 0.55)); grd.addColorStop(0.45, col); grd.addColorStop(1, shade(col, -0.5));
      }
      g.fillStyle = grd; rr(g, 0, 0, w, h, rad); g.fill();
      g.save(); rr(g, 0, 0, w, h, rad); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.13)';
      g.beginPath(); g.moveTo(w * 0.58, 0); g.lineTo(w * 0.78, 0); g.lineTo(w * 0.52, h); g.lineTo(w * 0.32, h); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)';
      rr(g, 3, 2, w - 6, h * 0.36, 3); g.fill();
      g.restore();
      g.strokeStyle = br.type === 'prize' ? '#ffffff' : shade(col, 0.7);
      g.lineWidth = 1; rr(g, 0.5, 0.5, w - 1, h - 1, rad); g.stroke();
      if (br.type === 'prize') {
        g.fillStyle = '#4a1d8a';
        g.font = `900 ${Math.round(h * 0.75)}px ${FONT}`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('?', w / 2, h / 2 + 1);
      }
    } else if (br.type === 'tough') {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#56608a'); grd.addColorStop(0.5, '#2a3150'); grd.addColorStop(1, '#141830');
      g.fillStyle = grd; rr(g, 0, 0, w, h, rad); g.fill();
      const ig = g.createLinearGradient(0, 4, 0, h - 4);
      ig.addColorStop(0, shade(col, 0.5)); ig.addColorStop(0.5, col); ig.addColorStop(1, shade(col, -0.45));
      g.fillStyle = ig; rr(g, 4, 4, w - 8, h - 8, 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; rr(g, 5, 5, w - 10, (h - 8) * 0.35, 2); g.fill();
      // hit pips
      g.fillStyle = 'rgba(10,12,30,0.75)';
      for (let i = 0; i < br.hp; i++) {
        const px = w / 2 + (i - (br.hp - 1) / 2) * 9;
        g.beginPath(); g.moveTo(px, h / 2 - 3.5); g.lineTo(px + 3.5, h / 2); g.lineTo(px, h / 2 + 3.5); g.lineTo(px - 3.5, h / 2); g.closePath(); g.fill();
      }
      // cracks for damage taken
      const dmg = br.maxHp - br.hp;
      if (dmg > 0) {
        g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.1;
        for (let k = 0; k < dmg * 2; k++) {
          let x = rand(8, w - 8), y = rand(4, h - 4);
          g.beginPath(); g.moveTo(x, y);
          for (let s = 0; s < 4; s++) { x += rand(-9, 9); y += rand(-6, 6); g.lineTo(clamp(x, 2, w - 2), clamp(y, 2, h - 2)); }
          g.stroke();
        }
      }
      g.strokeStyle = shade(col, 0.4); g.lineWidth = 1; rr(g, 0.5, 0.5, w - 1, h - 1, rad); g.stroke();
    } else if (br.type === 'steel') {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#f2f5fb'); grd.addColorStop(0.48, '#a3acbf'); grd.addColorStop(0.52, '#8b94a8'); grd.addColorStop(1, '#565e72');
      g.fillStyle = grd; rr(g, 0, 0, w, h, 3); g.fill();
      g.save(); rr(g, 0, 0, w, h, 3); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.moveTo(w * 0.2, 0); g.lineTo(w * 0.32, 0); g.lineTo(w * 0.22, h); g.lineTo(w * 0.1, h); g.closePath(); g.fill();
      g.restore();
      for (const [rx, ry] of [[5, 5], [w - 5, 5], [5, h - 5], [w - 5, h - 5]]) {
        g.fillStyle = '#3d4456'; g.beginPath(); g.arc(rx, ry, 2.2, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(rx - 0.6, ry - 0.6, 0.9, 0, TAU); g.fill();
      }
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1; rr(g, 0.5, 0.5, w - 1, h - 1, 3); g.stroke();
    } else if (br.type === 'bomb') {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#8a1a26'); grd.addColorStop(1, '#2a0508');
      g.fillStyle = grd; rr(g, 0, 0, w, h, rad); g.fill();
      // hazard stripes at both ends
      g.save(); rr(g, 0, 0, w, h, rad); g.clip();
      for (const side of [0, w - 12]) {
        g.save(); g.beginPath(); g.rect(side, 0, 12, h); g.clip();
        g.fillStyle = '#ffcf3b'; g.fillRect(side, 0, 12, h);
        g.fillStyle = '#1a0305';
        for (let s = -h; s < 24; s += 7) { g.beginPath(); g.moveTo(side + s, h); g.lineTo(side + s + 3.5, h); g.lineTo(side + s + 3.5 + h, 0); g.lineTo(side + s + h, 0); g.closePath(); g.fill(); }
        g.restore();
      }
      g.restore();
      // trefoil
      const cx = w / 2, cy = h / 2;
      g.fillStyle = '#ffcf3b'; g.beginPath(); g.arc(cx, cy, 8, 0, TAU); g.fill();
      g.fillStyle = '#2a0508';
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * TAU / 3;
        g.beginPath(); g.arc(cx, cy, 7, a - 0.5, a + 0.5); g.arc(cx, cy, 2.6, a + 0.5, a - 0.5, true); g.closePath(); g.fill();
      }
      g.beginPath(); g.arc(cx, cy, 1.5, 0, TAU); g.fill();
      g.strokeStyle = '#ff7a50'; g.lineWidth = 1; rr(g, 0.5, 0.5, w - 1, h - 1, rad); g.stroke();
    }
    spriteCache[key] = c;
    return c;
  }

  // Background per hue (static parts)
  let bgCanvas = null, bgHue = -1;
  function makeBg(hue) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, `hsl(${hue},55%,5%)`);
    grd.addColorStop(0.55, `hsl(${hue + 15},55%,8%)`);
    grd.addColorStop(1, `hsl(${hue + 35},60%,11%)`);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const seed = mulberry32(hue * 31 + 7);
    for (let i = 0; i < 7; i++) {
      const x = seed() * W, y = seed() * H * 0.7, r = 140 + seed() * 260;
      const ng = g.createRadialGradient(x, y, 0, x, y, r);
      ng.addColorStop(0, `hsla(${hue + (seed() - 0.5) * 90},90%,55%,0.07)`);
      ng.addColorStop(1, `hsla(${hue},90%,50%,0)`);
      g.fillStyle = ng; g.fillRect(0, 0, W, H);
    }
    const sy = 430;
    const sg = g.createRadialGradient(W / 2, sy, 0, W / 2, sy, 300);
    sg.addColorStop(0, `hsla(${hue + 50},100%,62%,0.2)`);
    sg.addColorStop(0.5, `hsla(${hue + 30},100%,55%,0.06)`);
    sg.addColorStop(1, `hsla(${hue},100%,50%,0)`);
    g.fillStyle = sg; g.fillRect(0, 0, W, H);
    // vignette
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return c;
  }

  const stars = [];
  for (let i = 0; i < 130; i++) stars.push({ x: Math.random() * W, y: Math.random() * 430, s: Math.random() < 0.15 ? 2 : 1, p: Math.random() * TAU, sp: rand(0.5, 2.5) });

  // ================================================================ state
  const G = {
    state: 'title', demo: true, auto: false,
    phase: 'live', phaseT: 0, t: 0, levelTime: 0,
    levelIdx: 0, def: null, endless: false, startIdx: 0,
    score: 0, shownScore: 0, lives: 3, nextLife: 40000,
    combo: 0, levelBestCombo: 0, bestCombo: 0, lostThisLevel: false,
    balls: [], bricks: [], caps: [], lasers: [], bullets: [], parts: [], texts: [], rings: [], bolts: [], timers: [],
    fx: {}, shield: false, boss: null, remaining: 0,
    shake: 0, flash: 0, flashColor: '#ffffff', timeScale: 1, slowmoT: 0,
    speedMult: 1, laserT: 0, driftAmp: 0,
    baseSpeed: 400, maxSpeed: 680, clearInfo: null, aiOff: 0, shieldPulse: 0,
  };
  const paddle = { x: W / 2, y: PADDLE_Y, w: BASE_PW, h: PADDLE_H, vx: 0, kv: 0, stun: 0, squash: 0 };
  const input = { left: false, right: false, mx: W / 2, mode: 'mouse' };

  function resetFx() { for (const k of FX_ORDER) G.fx[k] = 0; G.shield = false; }
  resetFx();

  // ================================================================ effects helpers
  function addPart(p) { if (G.parts.length < 1800) { p.max = p.life; G.parts.push(p); } }
  function shake(n) { if (save.shake) G.shake = Math.min(26, Math.max(G.shake, n)); }
  function ring(x, y, color, size, w = 3, life = 0.5) { G.rings.push({ x, y, r: 4, size, color, w, life, max: life }); }
  function floatText(x, y, str, color = '#fff', size = 14, big = false) {
    if (G.demo) return;
    G.texts.push({ x, y, str: String(str), color, size, life: big ? 1.4 : 0.9, max: big ? 1.4 : 0.9, big });
  }
  function sparks(x, y, color, n = 8, speed = 260) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(speed * 0.3, speed);
      addPart({ k: 1, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, drag: 3, life: rand(0.2, 0.5), color, size: rand(1, 2.2) });
    }
  }
  function glowBurst(x, y, color, n = 10, speed = 200, size = 14) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(speed * 0.2, speed);
      addPart({ k: 2, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: -40, drag: 2.5, life: rand(0.3, 0.8), color, size: rand(size * 0.5, size) });
    }
  }
  function shatter(o, power = 1) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    for (let i = 0; i < 14; i++) {
      const px = o.x + Math.random() * o.w, py = o.y + Math.random() * o.h;
      const a = Math.atan2(py - cy, px - cx) + rand(-0.6, 0.6);
      const sp = rand(60, 300) * power;
      addPart({
        k: 0, x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(30, 170),
        g: 950, drag: 0.6, life: rand(0.5, 1.1), size: rand(3, 8), rot: rand(0, TAU), vr: rand(-14, 14),
        color: i % 4 === 0 ? '#ffffff' : o.color,
      });
    }
    sparks(cx, cy, o.color, 6, 320 * power);
    addPart({ k: 3, x: o.x, y: o.y, w: o.w, h: o.h, life: 0.28, color: o.color });
  }
  function boltPoints(x0, y0, x1, y1) {
    let pts = [[x0, y0], [x1, y1]];
    let disp = Math.hypot(x1 - x0, y1 - y0) * 0.16;
    for (let it = 0; it < 5; it++) {
      const np = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        np.push(pts[i]);
        const nx = -(by - ay), ny = bx - ax, l = Math.hypot(nx, ny) || 1, o = rand(-disp, disp);
        np.push([(ax + bx) / 2 + (nx / l) * o, (ay + by) / 2 + (ny / l) * o]);
      }
      np.push(pts[pts.length - 1]);
      pts = np; disp *= 0.55;
    }
    return pts;
  }
  function addBolt(x0, y0, x1, y1, color) { G.bolts.push({ pts: boltPoints(x0, y0, x1, y1), color, life: 0.35, max: 0.35 }); }
  function later(t, fn) { G.timers.push({ t, fn }); }

  // ================================================================ score
  function comboMult() { return 1 + Math.min(7, Math.floor(G.combo / 6)); }
  function addScore(n) {
    if (G.demo) return;
    G.score += Math.round(n);
    while (G.score >= G.nextLife) {
      G.nextLife += 50000;
      if (G.lives < 9) {
        G.lives++;
        Sound.sfx.oneup();
        floatText(paddle.x, paddle.y - 50, 'EXTRA LIFE', '#ffd93b', 20, true);
      }
    }
  }

  // ================================================================ level setup
  function makeBrick(ch, r, c) {
    const br = {
      x0: GRID_X + c * (BW + GAP), x: 0, y: GRID_Y + r * (BH + GAP), w: BW, h: BH, r, c,
      alive: true, flash: 0, bump: 0, delay: r * 0.05 + Math.abs(c - 6.5) * 0.035, seed: Math.random() * TAU,
    };
    br.x = br.x0;
    if (BRICK_COLORS[ch]) Object.assign(br, { type: 'normal', hp: 1, maxHp: 1, color: BRICK_COLORS[ch], pts: 50 });
    else if (ch === '2') Object.assign(br, { type: 'tough', hp: 2, maxHp: 2, color: '#3bf0ff', pts: 120 });
    else if (ch === '3') Object.assign(br, { type: 'tough', hp: 3, maxHp: 3, color: '#ff4bd2', pts: 200 });
    else if (ch === '#') Object.assign(br, { type: 'steel', hp: 1e9, maxHp: 1e9, color: '#b8c2d6', pts: 0 });
    else if (ch === '*') Object.assign(br, { type: 'bomb', hp: 1, maxHp: 1, color: '#ff5a36', pts: 80 });
    else if (ch === '?') Object.assign(br, { type: 'prize', hp: 1, maxHp: 1, color: '#ffffff', pts: 100 });
    else return null;
    return br;
  }

  function makeBall(x, y, dx, dy, spd) {
    return { x, y, dx, dy, spd, r: BALL_R, stuck: false, off: 0, serve: false, stuckT: 0, trail: [], dead: false, noProg: 0 };
  }

  function serve() {
    const b = makeBall(paddle.x, paddle.y - paddle.h / 2 - BALL_R - 0.5, 0, -1, G.baseSpeed);
    b.stuck = true; b.serve = true; b.off = 0;
    G.balls = [b];
  }

  function makeBoss(d) {
    const B = {
      def: d, title: d.title, x: W / 2, y: d.y - 360, baseY: d.y, r: 40,
      hp: d.hp, maxHp: d.hp, t: 0, ph: 0, amp: 190, spin: 0, fireT: 3.2, flash: 0, inv: 0,
      dead: false, deathT: 0, gone: false, hits: 0, enter: 0, boomT: 0, eyeX: 0, eyeY: 0, shields: [],
    };
    d.rings.forEach((rg, ri) => {
      for (let i = 0; i < rg.n; i++) {
        B.shields.push({
          ring: ri, a0: (i / rg.n) * TAU, R: rg.r, spd: rg.speed, hp: rg.hp, maxHp: rg.hp, alive: true, respawn: 0,
          x: 0, y: 0, w: 24, h: 24, flash: 0, spawn: 1, type: rg.hp > 1 ? 'tough' : 'normal', color: ri === 0 ? '#3bf0ff' : '#ff8a3b',
        });
      }
    });
    return B;
  }

  function loadLevel(idx) {
    G.levelIdx = idx;
    const def = getLevel(idx);
    G.def = def;
    G.bricks = [];
    G.remaining = 0;
    def.map.forEach((row, r) => {
      for (let c = 0; c < COLS; c++) {
        const ch = row[c];
        if (!ch || ch === '.') continue;
        const br = makeBrick(ch, r, c);
        if (br) { G.bricks.push(br); if (br.type !== 'steel') G.remaining++; }
      }
    });
    // drift amplitude limited by free space at the sides
    G.driftAmp = 0;
    if (def.drift && G.bricks.length) {
      let minX = 1e9, maxX = -1e9;
      for (const br of G.bricks) { minX = Math.min(minX, br.x0); maxX = Math.max(maxX, br.x0 + br.w); }
      G.driftAmp = Math.max(0, Math.min(def.drift, minX - FL - 6, FR - 6 - maxX));
    }
    G.boss = def.boss ? makeBoss(def.boss) : null;
    G.caps = []; G.lasers = []; G.bullets = []; G.bolts = []; G.timers = []; G.texts = [];
    resetFx();
    G.combo = 0; G.levelBestCombo = 0; G.lostThisLevel = false;
    G.levelTime = 0; G.phase = 'live'; G.phaseT = 0; G.slowmoT = 0; G.timeScale = 1;
    G.baseSpeed = Math.min(375 + idx * 11, 510);
    G.maxSpeed = Math.min(620 + idx * 10, 730);
    paddle.x = W / 2; paddle.w = BASE_PW; paddle.stun = 0; paddle.kv = 0;
    serve();
    if (bgHue !== def.hue) { bgCanvas = makeBg(def.hue); bgHue = def.hue; }
    Sound.music(G.demo ? 'title' : def.boss ? 'boss' : ['a', 'b', 'c'][idx % 3]);
    if (def.boss && !G.demo) later(0.4, () => Sound.sfx.warning());
    // remember score/lives at sector start for "restart sector"
    G.levelStartScore = G.score; G.levelStartLives = G.lives;
  }

  // ================================================================ game flow
  function startGame(idx) {
    G.demo = false;
    Sound.setQuiet(false);
    G.state = 'play';
    G.score = 0; G.shownScore = 0; G.lives = 3; G.nextLife = 40000; G.bestCombo = 0;
    G.endless = idx >= CAMPAIGN_LENGTH;
    G.startIdx = idx;
    G.parts = []; G.rings = [];
    loadLevel(idx);
    showScreen(null);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function startDemo() {
    G.demo = true;
    Sound.setQuiet(true);
    G.state = 'title';
    const pool = [0, 1, 2, 3, 5, 6, 7, 8];
    G.parts = []; G.rings = [];
    loadLevel(pool[Math.floor(Math.random() * pool.length)]);
    Sound.music('title');
  }

  function releaseBall(b) {
    const rel = clamp(b.off / (paddle.w / 2), -1, 1);
    let ang = rel * 0.9;
    if (b.serve) {
      ang += rand(-0.25, 0.25);
      if (Math.abs(ang) < 0.08) ang = 0.12 * (Math.random() < 0.5 ? -1 : 1);
    }
    b.dx = Math.sin(ang); b.dy = -Math.cos(ang);
    b.stuck = false; b.serve = false; b.noProg = 0;
    b.y = paddle.y - paddle.h / 2 - b.r - 1;
    Sound.sfx.launch();
    glowBurst(b.x, b.y, '#9ff6ff', 6, 120, 10);
  }

  function action() {
    if (G.state !== 'play') return;
    if (G.phase === 'clear' && G.phaseT > 1.2) { nextLevel(); return; }
    if (G.phase !== 'live') return;
    for (const b of G.balls) if (b.stuck) releaseBall(b);
  }

  function loseLife() {
    G.phase = 'dying'; G.phaseT = 0;
    G.lostThisLevel = true; G.combo = 0;
    Sound.sfx.lose();
    shake(16);
    G.flash = 0.7; G.flashColor = '#ff2050';
    for (let i = 0; i < 40; i++) {
      const a = rand(-Math.PI, 0), sp = rand(80, 420);
      addPart({ k: 0, x: paddle.x + rand(-paddle.w / 2, paddle.w / 2), y: paddle.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 900, drag: 0.5, life: rand(0.6, 1.3), size: rand(3, 7), rot: rand(0, TAU), vr: rand(-10, 10), color: i % 2 ? '#3bf0ff' : '#ff4bd2' });
    }
    glowBurst(paddle.x, paddle.y, '#ff4bd2', 16, 300, 22);
    ring(paddle.x, paddle.y, '#ff2050', 140, 4, 0.7);
    G.caps = []; G.lasers = []; G.bullets = [];
    if (!G.demo && !G.god) G.lives--;
  }

  function afterDeath() {
    if (!G.demo && G.lives <= 0) { gameOver(); return; }
    resetFx();
    paddle.w = BASE_PW; paddle.stun = 0;
    serve();
    G.phase = 'live'; G.phaseT = 0;
    if (!G.demo) floatText(paddle.x, paddle.y - 70, G.lives === 1 ? 'LAST LIFE' : 'READY', G.lives === 1 ? '#ff4b7a' : '#3bf0ff', 22, true);
  }

  function beginClear() {
    G.phase = 'clear'; G.phaseT = 0;
    const n = G.levelIdx + 1;
    const clearBonus = 1000 * n;
    const flawless = G.lostThisLevel ? 0 : 2500;
    G.clearInfo = { clearBonus, flawless, combo: G.levelBestCombo, boss: !!G.boss };
    addScore(clearBonus + flawless);
    for (const c of G.caps) glowBurst(c.x, c.y, CAPS[c.type].color, 6, 120, 10);
    G.caps = []; G.bullets = []; G.lasers = [];
    for (const b of G.balls) if (b.stuck) releaseBall(b);
    if (!G.demo) {
      Sound.sfx.clear();
      save.unlocked = Math.max(save.unlocked, G.levelIdx + 2);
      store('sl_unlocked', save.unlocked);
      updateBest();
    }
  }

  function nextLevel() {
    if (G.demo) { startDemo(); return; }
    if (G.levelIdx === CAMPAIGN_LENGTH - 1 && !G.endless) { victory(); return; }
    loadLevel(G.levelIdx + 1);
  }

  function updateBest() {
    if (G.score > save.best) { save.best = G.score; store('sl_best', save.best); return true; }
    return false;
  }

  function gameOver() {
    G.state = 'over';
    const rec = G.score > 0 && G.score >= save.best && updateBest();
    Sound.stopMusic();
    Sound.sfx.gameover();
    $('over-score').textContent = fmt(G.score);
    $('over-sector').textContent = pad2(G.levelIdx + 1);
    $('over-combo').textContent = G.bestCombo;
    $('over-record').classList.toggle('show', !!rec);
    $('btn-retry').textContent = 'RETRY SECTOR ' + pad2(G.levelIdx + 1);
    showScreen('scr-over');
    canvas.classList.remove('nocursor');
  }

  function victory() {
    G.state = 'victory';
    const prevBest = save.best;
    updateBest();
    $('win-score').textContent = fmt(G.score);
    $('win-lives').textContent = G.lives;
    $('win-combo').textContent = G.bestCombo;
    $('win-record').classList.toggle('show', G.score > prevBest);
    showScreen('scr-victory');
    Sound.music('title');
    canvas.classList.remove('nocursor');
  }

  function pause() {
    if (G.state !== 'play') return;
    G.state = 'paused';
    Sound.setDuck(true);
    showScreen('scr-pause');
    canvas.classList.remove('nocursor');
  }
  function resume() {
    if (G.state !== 'paused') return;
    G.state = 'play';
    Sound.setDuck(false);
    showScreen(null);
    last = performance.now();
  }
  function quitToTitle() {
    updateBest();
    Sound.setDuck(false);
    startDemo();
    showScreen('scr-title');
  }

  // ================================================================ physics
  function circleRect(bx, by, r, rx, ry, rw, rh) {
    const cx = clamp(bx, rx, rx + rw), cy = clamp(by, ry, ry + rh);
    const dx = bx - cx, dy = by - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) return null;
    if (d2 < 1e-9) {
      const l = bx - rx, rt = rx + rw - bx, t = by - ry, b = ry + rh - by;
      const m = Math.min(l, rt, t, b);
      if (m === l) return { nx: -1, ny: 0, pen: l + r };
      if (m === rt) return { nx: 1, ny: 0, pen: rt + r };
      if (m === t) return { nx: 0, ny: -1, pen: t + r };
      return { nx: 0, ny: 1, pen: b + r };
    }
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, pen: r - d };
  }

  function fixAngle(b) {
    const m = Math.hypot(b.dx, b.dy) || 1;
    b.dx /= m; b.dy /= m;
    const MIN = 0.26;
    if (Math.abs(b.dy) < MIN) {
      b.dy = (b.dy < 0 ? -1 : 1) * MIN;
      b.dx = (b.dx < 0 ? -1 : 1) * Math.sqrt(1 - MIN * MIN);
    }
  }

  function bounce(b, n) {
    const dot = b.dx * n.nx + b.dy * n.ny;
    if (dot < 0) { b.dx -= 2 * dot * n.nx; b.dy -= 2 * dot * n.ny; }
    b.x += n.nx * n.pen; b.y += n.ny * n.pen;
    fixAngle(b);
  }

  function rotateBall(b, a) {
    const c = Math.cos(a), s = Math.sin(a);
    const dx = b.dx * c - b.dy * s, dy = b.dx * s + b.dy * c;
    b.dx = dx; b.dy = dy; fixAngle(b);
  }

  function wallHit(x, y) {
    Sound.sfx.wall();
    addPart({ k: 2, x, y, vx: 0, vy: 0, g: 0, drag: 0, life: 0.25, color: '#9ff6ff', size: 18 });
  }

  function paddleCollide(b) {
    const p = paddle, top = p.y - p.h / 2, hw = p.w / 2;
    if (b.y + b.r < top || b.y > p.y) return;
    if (b.x < p.x - hw - b.r * 0.8 || b.x > p.x + hw + b.r * 0.8) return;
    const rel = clamp((b.x - p.x) / hw, -1, 1);
    const ang = rel * 1.05;
    b.dx = Math.sin(ang); b.dy = -Math.cos(ang);
    b.y = top - b.r - 0.1;
    b.spd = Math.min(b.spd + 6, G.maxSpeed);
    p.squash = 1;
    G.combo = 0;
    Sound.sfx.paddle();
    sparks(b.x, top, G.fx.fire > 0 ? '#ff8a3b' : '#9ff6ff', 6, 200);
    if (G.demo || G.auto) G.aiOff = rand(-0.6, 0.6) * hw;
    if (G.fx.catch > 0 && G.phase === 'live') {
      b.stuck = true; b.off = clamp(b.x - p.x, -hw + 4, hw - 4); b.stuckT = 0; b.serve = false;
    }
  }

  function brickCollide(b) {
    const fire = G.fx.fire > 0;
    let best = null, bn = null;
    for (let i = 0; i < G.bricks.length; i++) {
      const br = G.bricks[i];
      if (!br.alive) continue;
      if (b.x + b.r < br.x || b.x - b.r > br.x + br.w || b.y + b.r < br.y || b.y - b.r > br.y + br.h) continue;
      const n = circleRect(b.x, b.y, b.r, br.x, br.y, br.w, br.h);
      if (!n) continue;
      if (fire && br.type !== 'steel') { damageBrick(br, 99, b); continue; }
      if (!bn || n.pen > bn.pen) { best = br; bn = n; }
    }
    if (best) { bounce(b, bn); damageBrick(best, 1, b); }
  }

  function bossCollide(b) {
    const B = G.boss;
    if (!B || B.gone) return;
    let best = null, bn = null;
    for (const s of B.shields) {
      if (!s.alive || s.spawn < 1) continue;
      if (b.x + b.r < s.x || b.x - b.r > s.x + s.w || b.y + b.r < s.y || b.y - b.r > s.y + s.h) continue;
      const n = circleRect(b.x, b.y, b.r, s.x, s.y, s.w, s.h);
      if (n && (!bn || n.pen > bn.pen)) { best = s; bn = n; }
    }
    if (best) {
      if (G.fx.fire > 0) hitShield(best, 99);
      else { bounce(b, bn); hitShield(best, 1); }
      b.noProg = 0;
    }
    const dx = b.x - B.x, dy = b.y - B.y;
    const d = Math.hypot(dx, dy), R = B.r + b.r;
    if (d < R && d > 0.001) {
      bounce(b, { nx: dx / d, ny: dy / d, pen: R - d + 0.5 });
      b.noProg = 0;
      if (!B.dead && B.inv <= 0) damageBoss(G.fx.fire > 0 ? 2 : 1, B.x + (dx / d) * B.r, B.y + (dy / d) * B.r);
    }
  }

  function damageBrick(br, dmg, ball) {
    const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
    if (br.type === 'steel') {
      br.flash = 0.7; br.bump = 0.4;
      Sound.sfx.steel();
      sparks(ball ? ball.x : cx, ball ? ball.y : cy, '#ffffff', 5, 220);
      return;
    }
    if (ball) ball.noProg = 0;
    br.hp -= dmg;
    if (br.hp <= 0) destroyBrick(br);
    else {
      br.flash = 1; br.bump = 1;
      Sound.sfx.tough(br.hp);
      addScore(10);
      sparks(cx, cy, br.color, 8, 240);
    }
  }

  function destroyBrick(br, silent) {
    if (!br.alive) return;
    br.alive = false;
    G.remaining--;
    G.combo++;
    G.levelBestCombo = Math.max(G.levelBestCombo, G.combo);
    G.bestCombo = Math.max(G.bestCombo, G.combo);
    const mult = comboMult();
    const pts = br.pts * mult;
    addScore(pts);
    const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
    floatText(cx, cy, mult > 1 ? `${pts}` : pts, mult > 1 ? '#ffd93b' : '#ffffff', mult > 1 ? 15 + Math.min(mult, 6) : 13);
    shatter(br);
    if (!silent) Sound.sfx.brick(G.combo);
    if (br.type === 'bomb') later(0.09, () => explode(cx, cy));
    if (br.type === 'prize') spawnCap(cx, cy, true);
    else if (Math.random() < DROP_CHANCE) spawnCap(cx, cy, false);
    if (G.remaining <= 0 && !G.boss && G.phase === 'live') {
      G.slowmoT = 1.0;
      G.flash = 0.35; G.flashColor = '#ffffff';
      ring(cx, cy, '#ffffff', 220, 4, 0.8);
    }
  }

  function explode(x, y) {
    Sound.sfx.explode();
    shake(10);
    ring(x, y, '#ff8a3b', 100, 5, 0.5);
    ring(x, y, '#ffd93b', 60, 2, 0.35);
    glowBurst(x, y, '#ff8a3b', 18, 260, 26);
    glowBurst(x, y, '#ffd93b', 8, 160, 18);
    sparks(x, y, '#ffd93b', 16, 480);
    for (const br of G.bricks) {
      if (!br.alive || br.type === 'steel') continue;
      if (Math.abs(br.x + br.w / 2 - x) < BW * 1.6 && Math.abs(br.y + br.h / 2 - y) < BH * 1.7) destroyBrick(br, true);
    }
    const B = G.boss;
    if (B && !B.dead) {
      for (const s of B.shields) if (s.alive && Math.hypot(s.x + s.w / 2 - x, s.y + s.h / 2 - y) < 80) hitShield(s, 99);
      if (Math.hypot(B.x - x, B.y - y) < B.r + 70) damageBoss(2, x, y);
    }
  }

  // ================================================================ power-ups
  function spawnCap(x, y, goodOnly) {
    if (G.phase !== 'live') return;
    const opts = [];
    let total = 0;
    for (const k in CAPS) {
      const c = CAPS[k];
      if (goodOnly && c.bad) continue;
      if (k === 'life' && G.lives >= 6) continue;
      if (k === 'shield' && G.shield) continue;
      opts.push(k); total += c.w;
    }
    let r = Math.random() * total, type = opts[0];
    for (const k of opts) { r -= CAPS[k].w; if (r <= 0) { type = k; break; } }
    G.caps.push({ x, y, type, vy: 110, t: rand(0, 3) });
  }

  function collect(c) {
    const def = CAPS[c.type];
    floatText(paddle.x, paddle.y - 34, def.name, def.color, 18, true);
    ring(paddle.x, paddle.y, def.color, 90, 3, 0.45);
    glowBurst(c.x, c.y, def.color, 10, 180, 16);
    addScore(def.bad ? 0 : 100);
    const fx = G.fx;
    switch (c.type) {
      case 'expand': fx.expand = FX_DUR.expand; fx.shrink = 0; break;
      case 'shrink': fx.shrink = FX_DUR.shrink; fx.expand = 0; break;
      case 'laser': fx.laser = FX_DUR.laser; G.laserT = 0.1; break;
      case 'catch': fx.catch = FX_DUR.catch; break;
      case 'slow': fx.slow = FX_DUR.slow; break;
      case 'fire': fx.fire = FX_DUR.fire; break;
      case 'multi': multiball(); break;
      case 'shield': G.shield = true; Sound.sfx.shieldUp(); break;
      case 'zap': chainZap(); break;
      case 'life': G.lives = Math.min(9, G.lives + 1); Sound.sfx.oneup(); break;
    }
    if (def.bad) Sound.sfx.powerdown();
    else if (c.type !== 'life' && c.type !== 'shield') Sound.sfx.powerup();
  }

  function onFxEnd(k) {
    if (k === 'catch') for (const b of G.balls) if (b.stuck && !b.serve) releaseBall(b);
  }

  function multiball() {
    const src = G.balls.filter((b) => !b.dead);
    const add = [];
    for (const b of src) {
      let dx = b.dx, dy = b.dy;
      if (b.stuck) { dx = 0; dy = -1; }
      for (const a of [-0.5, 0.5]) {
        if (G.balls.length + add.length >= MAX_BALLS) break;
        const c = Math.cos(a), s = Math.sin(a);
        const nb = makeBall(b.x, b.y - (b.stuck ? 2 : 0), dx * c - dy * s, dx * s + dy * c, b.spd);
        fixAngle(nb);
        add.push(nb);
      }
    }
    G.balls.push(...add);
    for (const b of add) glowBurst(b.x, b.y, '#ff4bd2', 4, 100, 10);
  }

  function chainZap() {
    Sound.sfx.zap();
    const pool = G.bricks.filter((br) => br.alive && br.type !== 'steel');
    let from = { x: paddle.x, y: paddle.y - 10 };
    const targets = [];
    for (let i = 0; i < 8 && pool.length; i++) {
      let bi = 0, bd = 1e12;
      for (let j = 0; j < pool.length; j++) {
        const br = pool[j];
        const d = (br.x + br.w / 2 - from.x) ** 2 + (br.y + br.h / 2 - from.y) ** 2;
        if (d < bd) { bd = d; bi = j; }
      }
      const br = pool.splice(bi, 1)[0];
      targets.push(br);
      from = { x: br.x + br.w / 2, y: br.y + br.h / 2 };
    }
    let prev = { x: paddle.x, y: paddle.y - 10 };
    targets.forEach((br, i) => {
      const p0 = prev;
      prev = { x: br.x + br.w / 2, y: br.y + br.h / 2 };
      later(i * 0.07, () => {
        addBolt(p0.x, p0.y, br.x + br.w / 2, br.y + br.h / 2, '#fff36b');
        if (br.alive) destroyBrick(br);
        Sound.sfx.zap();
      });
    });
    if (G.boss && !G.boss.dead) {
      const p0 = prev;
      later(targets.length * 0.07, () => {
        const B = G.boss;
        if (B && !B.dead) { addBolt(p0.x, p0.y, B.x, B.y, '#fff36b'); damageBoss(3, B.x, B.y); Sound.sfx.zap(); }
      });
    }
  }

  // ================================================================ boss
  function hitShield(s, dmg) {
    s.hp -= dmg; s.flash = 1;
    if (s.hp <= 0) {
      s.alive = false; s.respawn = 13;
      G.combo++;
      G.bestCombo = Math.max(G.bestCombo, G.combo);
      const pts = 60 * comboMult();
      addScore(pts);
      floatText(s.x + s.w / 2, s.y + s.h / 2, pts, '#9ff6ff', 13);
      shatter(s, 0.8);
      Sound.sfx.brick(G.combo);
    } else {
      Sound.sfx.tough(s.hp);
      sparks(s.x + s.w / 2, s.y + s.h / 2, s.color, 6, 200);
    }
  }

  function damageBoss(dmg, x, y) {
    const B = G.boss;
    if (!B || B.dead) return;
    B.hp -= dmg; B.flash = 1; B.inv = 0.12; B.hits++;
    G.combo++;
    G.bestCombo = Math.max(G.bestCombo, G.combo);
    const pts = 150 * comboMult();
    addScore(pts);
    floatText(x, y - 12, pts, '#ff9bf0', 16);
    Sound.sfx.bossHit();
    shake(6);
    sparks(x, y, '#ff4bd2', 14, 360);
    glowBurst(x, y, '#ff4bd2', 5, 120, 18);
    if (B.hits % 4 === 0) spawnCap(B.x, B.y + B.r + 12, true);
    if (B.hp <= 0) killBoss();
  }

  function killBoss() {
    const B = G.boss;
    B.dead = true; B.deathT = 0; B.hp = 0;
    for (const bl of G.bullets) glowBurst(bl.x, bl.y, '#ff4bd2', 4, 80, 10);
    G.bullets = [];
    G.slowmoT = 1.3;
    Sound.sfx.explode();
    shake(14);
  }

  function bossFinale() {
    const B = G.boss;
    Sound.sfx.bigBoom();
    shake(26);
    G.flash = 1; G.flashColor = '#ffffff';
    ring(B.x, B.y, '#ffffff', 420, 6, 1.0);
    ring(B.x, B.y, '#ff4bd2', 300, 4, 0.8);
    ring(B.x, B.y, '#3bf0ff', 200, 3, 0.6);
    glowBurst(B.x, B.y, '#ff4bd2', 40, 520, 34);
    glowBurst(B.x, B.y, '#ffffff', 20, 300, 26);
    for (let i = 0; i < 50; i++) {
      const a = rand(0, TAU), sp = rand(150, 650);
      addPart({ k: 0, x: B.x, y: B.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 600, drag: 0.8, life: rand(0.8, 1.8), size: rand(4, 11), rot: rand(0, TAU), vr: rand(-10, 10), color: i % 3 ? '#ff4bd2' : '#ffffff' });
    }
    for (const s of B.shields) if (s.alive) shatter(s, 1.4);
    const bonus = 5000 * (1 + Math.floor(G.levelIdx / 5));
    addScore(bonus);
    floatText(B.x, B.y, `${B.title} DESTROYED  +${fmt(bonus)}`, '#ffd93b', 24, true);
    G.bricks.filter((br) => br.alive && br.type !== 'steel').forEach((br, i) => later(0.25 + i * 0.05, () => destroyBrick(br)));
  }

  function updateBoss(dt) {
    const B = G.boss;
    if (!B) return;
    B.t += dt;
    B.flash = Math.max(0, B.flash - dt * 4);
    B.inv -= dt;
    if (B.gone) return;
    if (B.dead) {
      B.deathT += dt; B.boomT -= dt;
      B.x += rand(-1.5, 1.5); B.y += rand(-1.5, 1.5);
      if (B.boomT <= 0) {
        B.boomT = 0.11;
        const a = rand(0, TAU), r = rand(0, B.r + 40);
        const x = B.x + Math.cos(a) * r, y = B.y + Math.sin(a) * r;
        glowBurst(x, y, Math.random() < 0.5 ? '#ff4bd2' : '#ff8a3b', 8, 200, 22);
        ring(x, y, '#ffd93b', 50, 2, 0.3);
        Sound.sfx.explode();
        shake(5);
      }
      if (B.deathT > 2.0) { B.gone = true; bossFinale(); }
      return;
    }
    B.enter = Math.min(1, B.enter + dt * 0.55);
    const rage = B.hp <= B.maxHp * 0.5;
    B.ph += dt * (rage ? 0.62 : 0.42);
    B.amp = lerp(B.amp, rage ? 250 : 190, 1 - Math.pow(0.3, dt));
    B.spin += dt * (rage ? 1.55 : 1);
    B.x = W / 2 + Math.sin(B.ph) * B.amp;
    B.y = B.baseY + Math.sin(B.t * 1.3) * 14 - (1 - easeOutCubic(B.enter)) * 360;
    for (const s of B.shields) {
      const ang = s.a0 + B.spin * s.spd;
      s.x = B.x + Math.cos(ang) * s.R - s.w / 2;
      s.y = B.y + Math.sin(ang) * s.R - s.h / 2;
      s.flash = Math.max(0, s.flash - dt * 4);
      s.spawn = Math.min(1, s.spawn + dt * 1.5);
      if (!s.alive) {
        s.respawn -= dt;
        if (s.respawn <= 0) { s.alive = true; s.hp = s.maxHp; s.spawn = 0; }
      }
    }
    // eye tracks the most threatening ball (or the paddle)
    let tx = paddle.x, ty = paddle.y;
    let by = -1e9;
    for (const b of G.balls) if (b.y > by && !b.stuck) { by = b.y; tx = b.x; ty = b.y; }
    const ea = Math.atan2(ty - B.y, tx - B.x);
    B.eyeX = lerp(B.eyeX, Math.cos(ea) * 9, 0.15);
    B.eyeY = lerp(B.eyeY, Math.sin(ea) * 9, 0.15);

    if (B.enter >= 1 && G.phase === 'live' && !G.balls.every((b) => b.stuck && b.serve)) {
      B.fireT -= dt;
      if (B.fireT <= 0) {
        B.fireT = B.def.fire * (rage ? 0.72 : 1);
        bossFire(rage, B.hp <= B.maxHp * 0.25);
      }
    }
  }

  function bossFire(rage, fury) {
    const B = G.boss;
    const ang = Math.atan2(paddle.y - B.y, paddle.x - B.x);
    const spread = fury ? [-0.42, -0.21, 0, 0.21, 0.42] : rage ? [-0.26, 0, 0.26] : [0];
    const sp = fury ? 270 : 240;
    for (const s of spread) {
      const a = ang + s;
      G.bullets.push({ x: B.x + Math.cos(a) * B.r, y: B.y + Math.sin(a) * B.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0 });
    }
    Sound.sfx.bossShot();
    glowBurst(B.x + Math.cos(ang) * B.r, B.y + Math.sin(ang) * B.r, '#ff4bd2', 6, 120, 14);
  }

  function updateBullets(dt) {
    const p = paddle;
    for (let i = G.bullets.length - 1; i >= 0; i--) {
      const bl = G.bullets[i];
      bl.t += dt;
      bl.x += bl.vx * dt; bl.y += bl.vy * dt;
      if (bl.t % 0.05 < dt) addPart({ k: 2, x: bl.x, y: bl.y, vx: 0, vy: 0, g: 0, drag: 0, life: 0.25, color: '#ff4bd2', size: 9 });
      let remove = bl.y > H + 20 || bl.x < -20 || bl.x > W + 20;
      if (!remove && G.phase === 'live' && Math.abs(bl.x - p.x) < p.w / 2 + 6 && Math.abs(bl.y - p.y) < p.h / 2 + 6) {
        remove = true;
        stunPaddle(bl.x, bl.y);
      }
      if (remove) G.bullets.splice(i, 1);
    }
  }

  function stunPaddle(x, y) {
    paddle.stun = 1.1;
    G.combo = 0;
    Sound.sfx.stun();
    shake(8);
    sparks(x, y, '#ff4bd2', 18, 340);
    sparks(x, y, '#ffffff', 8, 240);
    floatText(paddle.x, paddle.y - 34, 'STUNNED', '#ff4b7a', 18, true);
  }

  // ================================================================ update
  function predictX(b) {
    if (b.dy <= 0) return b.x;
    const t = (PADDLE_Y - PADDLE_H / 2 - b.r - b.y) / b.dy;
    const x = b.x + b.dx * t;
    const L = FL + b.r, R = FR - b.r, span = R - L;
    let u = (x - L) % (2 * span);
    if (u < 0) u += 2 * span;
    if (u > span) u = 2 * span - u;
    return L + u;
  }

  function aiTarget() {
    let best = null, by = -1e9;
    for (const b of G.balls) if (!b.stuck && b.dy > 0 && b.y > by) { by = b.y; best = b; }
    if (!best) {
      const cap = G.caps.find((c) => !CAPS[c.type].bad && c.y > H * 0.45);
      if (cap) return cap.x;
      const s = G.balls.find((b) => !b.stuck);
      return s ? lerp(paddle.x, s.x, 0.5) : paddle.x + Math.sin(G.t * 2) * 30;
    }
    return predictX(best) - G.aiOff;
  }

  function updatePaddle(dt) {
    const p = paddle;
    const tw = BASE_PW * (G.fx.expand > 0 ? 1.55 : 1) * (G.fx.shrink > 0 ? 0.62 : 1);
    p.w = lerp(p.w, tw, 1 - Math.pow(0.0005, dt));
    const old = p.x;
    if (p.stun > 0) p.stun -= dt;
    else if (G.phase !== 'dying') {
      if (G.demo || G.auto) {
        const tx = aiTarget(), maxd = 1300 * dt;
        p.x += clamp(tx - p.x, -maxd, maxd);
      } else if (input.mode === 'mouse') {
        p.x = input.mx;
      } else {
        const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        p.kv = lerp(p.kv, dir * 920, 1 - Math.pow(1e-7, dt));
        p.x += p.kv * dt;
      }
    }
    p.x = clamp(p.x, FL + p.w / 2, FR - p.w / 2);
    p.vx = (p.x - old) / Math.max(dt, 1e-6);
    p.squash = Math.max(0, p.squash - dt * 6);
  }

  function updateBalls(dt) {
    const sm = G.speedMult;
    let anyDead = false;
    for (const b of G.balls) {
      if (b.stuck) {
        b.x = paddle.x + b.off;
        b.y = paddle.y - paddle.h / 2 - b.r - 0.5;
        b.stuckT += dt;
        b.trail.length = 0;
        if (!b.serve && b.stuckT > 2.5) releaseBall(b);
        else if ((G.demo || G.auto) && b.serve && b.stuckT > 0.9) releaseBall(b);
        continue;
      }
      b.noProg += dt;
      // anti-stall: if a ball hasn't damaged anything for a while, nudge its angle
      if (b.noProg > 10) { rotateBall(b, (Math.random() < 0.5 ? -1 : 1) * rand(0.15, 0.4)); b.noProg = 6; }
      const dist = b.spd * sm * dt;
      const steps = Math.max(1, Math.ceil(dist / 3));
      const sd = dist / steps;
      for (let i = 0; i < steps; i++) {
        b.x += b.dx * sd; b.y += b.dy * sd;
        if (b.x - b.r < FL) { b.x = FL + b.r; b.dx = Math.abs(b.dx); wallHit(FL, b.y); }
        else if (b.x + b.r > FR) { b.x = FR - b.r; b.dx = -Math.abs(b.dx); wallHit(FR, b.y); }
        if (b.y - b.r < FT) { b.y = FT + b.r; b.dy = Math.abs(b.dy); wallHit(b.x, FT); }
        if (b.dy > 0 && G.phase !== 'dying') paddleCollide(b);
        if (b.stuck) break;
        if (G.shield && b.dy > 0 && b.y + b.r > SHIELD_Y) {
          b.y = SHIELD_Y - b.r; b.dy = -Math.abs(b.dy); fixAngle(b);
          G.shield = false;
          Sound.sfx.shieldBreak();
          sparks(b.x, SHIELD_Y, '#e6ecff', 20, 400);
          for (let x = FL; x < FR; x += 24) addPart({ k: 1, x, y: SHIELD_Y, vx: rand(-60, 60), vy: rand(-200, -40), g: 400, drag: 2, life: rand(0.3, 0.6), color: '#e6ecff', size: 1.5 });
        }
        brickCollide(b);
        if (G.boss) bossCollide(b);
        if (b.y - b.r > H + 6) { b.dead = true; anyDead = true; break; }
      }
      b.trail.push(b.x, b.y);
      if (b.trail.length > 24) b.trail.splice(0, 2);
      if (G.fx.fire > 0 && Math.random() < 0.6) {
        addPart({ k: 2, x: b.x + rand(-3, 3), y: b.y + rand(-3, 3), vx: rand(-30, 30), vy: rand(-80, -20), g: -60, drag: 1, life: rand(0.2, 0.45), color: Math.random() < 0.5 ? '#ff8a3b' : '#ffd93b', size: rand(6, 12) });
      }
    }
    if (anyDead) G.balls = G.balls.filter((b) => !b.dead);
  }

  function updateLasers(dt) {
    if (G.fx.laser > 0 && G.phase === 'live') {
      G.laserT -= dt;
      if (G.laserT <= 0) {
        G.laserT = 0.3;
        const off = paddle.w / 2 - 10, y = paddle.y - paddle.h / 2 - 8;
        G.lasers.push({ x: paddle.x - off, y }, { x: paddle.x + off, y });
        Sound.sfx.laser();
      }
    }
    const B = G.boss;
    for (let i = G.lasers.length - 1; i >= 0; i--) {
      const l = G.lasers[i];
      l.y -= 1000 * dt;
      let hit = false;
      for (const br of G.bricks) {
        if (!br.alive) continue;
        if (l.x > br.x - 2 && l.x < br.x + br.w + 2 && l.y < br.y + br.h && l.y + 14 > br.y) {
          damageBrick(br, 1, null); hit = true; break;
        }
      }
      if (!hit && B && !B.gone) {
        for (const s of B.shields) {
          if (s.alive && s.spawn >= 1 && l.x > s.x && l.x < s.x + s.w && l.y < s.y + s.h && l.y + 14 > s.y) { hitShield(s, 1); hit = true; break; }
        }
        if (!hit && !B.dead && Math.hypot(l.x - B.x, l.y - B.y) < B.r) { if (B.inv <= 0) damageBoss(1, l.x, l.y); hit = true; }
      }
      if (!hit) {
        for (let j = G.bullets.length - 1; j >= 0; j--) {
          const bl = G.bullets[j];
          if (Math.abs(bl.x - l.x) < 10 && Math.abs(bl.y - l.y) < 14) { glowBurst(bl.x, bl.y, '#ff4bd2', 5, 100, 10); G.bullets.splice(j, 1); hit = true; break; }
        }
      }
      if (!hit && l.y < FT) hit = true;
      if (hit) { sparks(l.x, l.y, '#ff3b5c', 4, 160); G.lasers.splice(i, 1); }
    }
  }

  function updateCaps(dt) {
    const p = paddle;
    for (let i = G.caps.length - 1; i >= 0; i--) {
      const c = G.caps[i];
      c.t += dt;
      c.vy = Math.min(c.vy + 110 * dt, 250);
      c.y += c.vy * dt;
      if (G.phase === 'live' && Math.abs(c.x - p.x) < p.w / 2 + 20 && Math.abs(c.y - p.y) < p.h / 2 + 9) {
        collect(c);
        G.caps.splice(i, 1);
      } else if (c.y > H + 20) G.caps.splice(i, 1);
    }
  }

  function updateFx(dt) {
    for (const k of FX_ORDER) {
      if (G.fx[k] > 0) {
        G.fx[k] -= dt;
        if (G.fx[k] <= 0) { G.fx[k] = 0; onFxEnd(k); }
      }
    }
  }

  function updateParticles(dt) {
    const ps = G.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      if (p.k === 3) continue;
      const d = 1 - Math.min(1, p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
    }
    for (let i = G.texts.length - 1; i >= 0; i--) {
      const t = G.texts[i];
      t.life -= dt;
      t.y -= (t.big ? 26 : 48) * dt;
      if (t.life <= 0) G.texts.splice(i, 1);
    }
    for (let i = G.rings.length - 1; i >= 0; i--) {
      const r = G.rings[i];
      r.life -= dt;
      r.r = r.size * easeOutCubic(1 - r.life / r.max);
      if (r.life <= 0) G.rings.splice(i, 1);
    }
    for (let i = G.bolts.length - 1; i >= 0; i--) {
      G.bolts[i].life -= dt;
      if (G.bolts[i].life <= 0) G.bolts.splice(i, 1);
    }
  }

  function update(rdt) {
    if (G.slowmoT > 0) {
      G.slowmoT -= rdt;
      G.timeScale = lerp(G.timeScale, 0.28, 0.2);
      if (G.slowmoT <= 0) G.timeScale = 1;
    } else if (G.timeScale < 1) G.timeScale = Math.min(1, G.timeScale + rdt * 3);
    const dt = rdt * G.timeScale;
    G.t += dt; G.phaseT += dt; G.levelTime += dt;
    G.shake = Math.max(0, G.shake - (G.shake * 7 + 6) * rdt);
    G.flash = Math.max(0, G.flash - rdt * 2.4);
    G.speedMult = lerp(G.speedMult, G.fx.slow > 0 ? 0.6 : 1, 1 - Math.pow(0.05, dt));

    if (G.driftAmp) {
      const off = Math.sin(G.levelTime * 0.55) * G.driftAmp;
      for (const br of G.bricks) br.x = br.x0 + off;
    }

    updatePaddle(dt);

    for (let i = G.timers.length - 1; i >= 0; i--) {
      const tm = G.timers[i];
      if (!tm) continue;
      tm.t -= dt;
      if (tm.t <= 0) { G.timers.splice(i, 1); tm.fn(); }
    }

    if (G.phase === 'live' || G.phase === 'clear') {
      if (G.phase === 'live') updateFx(dt);
      updateBalls(dt);
      updateLasers(dt);
      updateCaps(dt);
      updateBullets(dt);
    }
    updateBoss(dt);

    if (G.phase === 'live') {
      if (G.balls.length === 0) loseLife();
      else if (G.remaining <= 0 && (!G.boss || G.boss.gone) && G.timers.length === 0) beginClear();
    } else if (G.phase === 'dying') {
      if (G.phaseT > 1.5) afterDeath();
    } else if (G.phase === 'clear') {
      if (G.phaseT > (G.demo ? 2.5 : 4.5)) nextLevel();
    }

    for (const br of G.bricks) {
      if (br.flash > 0) br.flash = Math.max(0, br.flash - dt * 5);
      if (br.bump > 0) br.bump = Math.max(0, br.bump - dt * 6);
    }
    updateParticles(dt);

    G.shownScore += (G.score - G.shownScore) * (1 - Math.pow(0.002, rdt));
    if (Math.abs(G.score - G.shownScore) < 1) G.shownScore = G.score;
  }

  // ================================================================ render
  let shakeX = 0, shakeY = 0;
  function baseTransform() {
    const k = viewScale * dpr;
    ctx.setTransform(k, 0, 0, k, shakeX * k, shakeY * k);
  }

  function drawBackground() {
    if (bgCanvas) ctx.drawImage(bgCanvas, -30, -30, W + 60, H + 60);
    const hue = G.def ? G.def.hue : 260;
    ctx.globalCompositeOperation = 'lighter';
    // stars
    ctx.fillStyle = '#ffffff';
    for (const s of stars) {
      ctx.globalAlpha = 0.25 + 0.35 * Math.sin(s.p + G.t * s.sp);
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    // perspective grid
    const HY = 430, n = 13;
    const scroll = (G.t * 0.35) % 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = `hsl(${hue + 40},100%,60%)`;
    for (let i = 0; i < n; i++) {
      const p = (i + scroll) / n;
      const y = HY + (H - HY) * p * p;
      ctx.globalAlpha = 0.02 + p * 0.13;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.globalAlpha = 0.09;
    ctx.beginPath();
    for (let j = -14; j <= 14; j++) { ctx.moveTo(W / 2 + j * 10, HY); ctx.lineTo(W / 2 + j * 120, H); }
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = `hsl(${hue + 50},100%,65%)`;
    ctx.fillRect(0, HY, W, 1);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawWalls() {
    const hue = G.def ? G.def.hue : 260;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    const col = `hsl(${hue + 30},100%,65%)`;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(FL - 2, H + 40); ctx.lineTo(FL - 2, FT - 2); ctx.lineTo(FR + 2, FT - 2); ctx.lineTo(FR + 2, H + 40);
    ctx.globalAlpha = 0.12; ctx.lineWidth = 10; ctx.stroke();
    ctx.globalAlpha = 0.25; ctx.lineWidth = 4; ctx.stroke();
    ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    // darken outside the field
    ctx.fillStyle = 'rgba(2,1,8,0.6)';
    ctx.fillRect(-40, FT - 3, FL + 38, H + 80);
    ctx.fillRect(FR + 3, FT - 3, 80, H + 80);
  }

  function drawBricks() {
    const lt = G.levelTime;
    for (const br of G.bricks) {
      if (!br.alive) continue;
      let s = 1, a = 1;
      const k = (lt - br.delay) / 0.45;
      if (k < 1) { if (k <= 0) continue; s = easeOutBack(k); a = Math.min(1, k * 1.5); }
      s *= 1 + br.bump * 0.12;
      const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
      ctx.globalAlpha = a;
      if (br.type === 'prize') { drawPrize(br, cx, cy, s); continue; }
      const spr = brickSprite(br);
      const hw = (br.w / 2 + SPR_P) * s, hh = (br.h / 2 + SPR_P) * s;
      ctx.drawImage(spr, cx - hw, cy - hh, hw * 2, hh * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (const br of G.bricks) {
      if (!br.alive || lt < br.delay + 0.45) continue;
      const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
      if (br.type === 'bomb') drawGlow('#ff5a36', cx, cy, 34, 0.25 + 0.2 * Math.sin(G.t * 6 + br.seed));
      if (br.type === 'prize') drawGlow('#ffffff', cx, cy, 40, 0.18 + 0.1 * Math.sin(G.t * 4 + br.seed));
      // diagonal shimmer sweep
      const sw = ((G.t * 520 - br.x - br.y * 1.5) % 2600 + 2600) % 2600;
      if (sw < 140 && br.type !== 'steel') {
        ctx.globalAlpha = Math.sin((sw / 140) * Math.PI) * 0.22;
        ctx.fillStyle = '#ffffff';
        rr(ctx, br.x, br.y, br.w, br.h, 5); ctx.fill();
      }
      if (br.flash > 0) {
        ctx.globalAlpha = br.flash * 0.85;
        ctx.fillStyle = '#ffffff';
        rr(ctx, br.x - 1, br.y - 1, br.w + 2, br.h + 2, 5); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawPrize(br, cx, cy, s) {
    const w = br.w * s, h = br.h * s, x = cx - w / 2, y = cy - h / 2;
    const h0 = (G.t * 90 + br.c * 22 + br.r * 35) % 360;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, `hsl(${(h0 + i * 50) % 360},95%,${i % 2 ? 62 : 55}%)`);
    ctx.fillStyle = g;
    rr(ctx, x, y, w, h, 5 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    rr(ctx, x + 3 * s, y + 2 * s, w - 6 * s, h * 0.36, 3 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 5 * s); ctx.stroke();
    font(Math.round(16 * s), 900, FONT, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(30,8,60,0.85)';
    ctx.fillText('?', cx, cy + 1 + Math.sin(G.t * 5 + br.seed) * 1.2);
  }

  function drawBoss() {
    const B = G.boss;
    if (!B || B.gone) return;
    const pulse = 0.5 + 0.5 * Math.sin(B.t * 3);
    const rage = B.hp <= B.maxHp * 0.5;
    const coreCol = rage ? '#ff3b5c' : '#ff4bd2';
    ctx.globalCompositeOperation = 'lighter';
    // aura
    drawGlow(coreCol, B.x, B.y, 150 + pulse * 20, 0.35 + B.flash * 0.3);
    // tethers to shields
    ctx.lineWidth = 1.2;
    for (const s of B.shields) {
      if (!s.alive) continue;
      ctx.globalAlpha = 0.15 * s.spawn;
      ctx.strokeStyle = s.color;
      ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(s.x + s.w / 2, s.y + s.h / 2); ctx.stroke();
    }
    // orbit rings
    const radii = [...new Set(B.shields.map((s) => s.R))];
    ctx.setLineDash([4, 10]);
    for (const R of radii) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#ffffff';
      ctx.lineDashOffset = -B.t * 30;
      ctx.beginPath(); ctx.arc(B.x, B.y, R, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // shields
    for (const s of B.shields) {
      if (!s.alive) continue;
      const sc = easeOutBack(clamp(s.spawn, 0, 1));
      if (sc <= 0) continue;
      const spr = brickSprite(s);
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      const hw = (s.w / 2 + SPR_P) * sc, hh = (s.h / 2 + SPR_P) * sc;
      ctx.globalAlpha = s.spawn < 1 ? 0.6 : 1;
      ctx.drawImage(spr, cx - hw, cy - hh, hw * 2, hh * 2);
      if (s.flash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = s.flash * 0.8; ctx.fillStyle = '#fff';
        rr(ctx, s.x, s.y, s.w, s.h, 4); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalAlpha = 1;

    // core body
    ctx.save();
    ctx.translate(B.x, B.y);
    const g = ctx.createRadialGradient(-10, -12, 4, 0, 0, B.r);
    g.addColorStop(0, '#4a1240'); g.addColorStop(0.7, '#1a0418'); g.addColorStop(1, coreCol);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, B.r, 0, TAU); ctx.fill();
    // rotating hex frame
    ctx.rotate(B.t * 0.6);
    ctx.strokeStyle = coreCol; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * TAU; const r = B.r + 7; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.stroke();
    ctx.rotate(-B.t * 1.4);
    ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) { const a = (i / 3) * TAU; const r = B.r + 14; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    // eye
    const charge = !B.dead && B.enter >= 1 && B.fireT < 0.6 ? 1 - B.fireT / 0.6 : 0;
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(coreCol, B.x + B.eyeX, B.y + B.eyeY, 30 + charge * 30, 0.6 + charge * 0.4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffe6fb';
    ctx.beginPath(); ctx.ellipse(B.x + B.eyeX, B.y + B.eyeY, 13, 13 - Math.max(0, Math.sin(B.t * 0.9) * 40 - 38) * 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#120010';
    ctx.beginPath(); ctx.ellipse(B.x + B.eyeX * 1.3, B.y + B.eyeY * 1.3, 4 + charge * 2, 9, 0, 0, TAU); ctx.fill();
    if (B.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = B.flash * 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(B.x, B.y, B.r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (B.dead) {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow('#ffffff', B.x, B.y, 60 + B.deathT * 60, Math.min(1, B.deathT / 2));
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawBossBar() {
    const B = G.boss;
    if (!B || B.gone || G.demo) return;
    const w = 360, x = W / 2 - w / 2, y = 72;
    const a = clamp(B.enter * 2, 0, 1);
    ctx.globalAlpha = a;
    font(10, 800, FONT, 3);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff9bc8';
    ctx.fillText(B.title, x - 12, y + 4);
    ctx.fillStyle = 'rgba(20,4,20,0.8)';
    rr(ctx, x, y, w, 8, 4); ctx.fill();
    const f = clamp(B.hp / B.maxHp, 0, 1);
    const grd = ctx.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, '#ff3b5c'); grd.addColorStop(1, '#ff4bd2');
    ctx.fillStyle = grd;
    if (f > 0) { rr(ctx, x, y, w * f, 8, 4); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,155,200,0.6)'; ctx.lineWidth = 1;
    rr(ctx, x - 0.5, y - 0.5, w + 1, 9, 4.5); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let i = 1; i < 12; i++) ctx.fillRect(x + (w * i) / 12, y, 1, 8);
    ctx.globalAlpha = 1;
    if (hasSpacing) ctx.letterSpacing = '0px';
  }

  function drawCaps() {
    for (const c of G.caps) {
      const def = CAPS[c.type];
      const w = 46, h = 20, x = c.x - w / 2, y = c.y - h / 2;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(def.color, c.x, c.y, 40, 0.45 + 0.15 * Math.sin(c.t * 8));
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const grd = ctx.createLinearGradient(0, y, 0, y + h);
      if (def.bad) { grd.addColorStop(0, '#c9bce0'); grd.addColorStop(0.5, def.color); grd.addColorStop(1, '#2a2040'); }
      else { grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.4, def.color); grd.addColorStop(1, shade(def.color, -0.5)); }
      ctx.fillStyle = grd;
      rr(ctx, x, y, w, h, h / 2); ctx.fill();
      // sheen band
      ctx.save();
      rr(ctx, x, y, w, h, h / 2); ctx.clip();
      const sx = x - 20 + ((c.t * 70) % (w + 40));
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + 8, y); ctx.lineTo(sx - 2, y + h); ctx.lineTo(sx - 10, y + h); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
      rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2); ctx.stroke();
      font(def.label.length > 1 ? 11 : 13, 900, FONT, 1);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = def.bad ? '#ffffff' : '#170a2e';
      ctx.fillText(def.label, c.x, c.y + 1);
    }
    if (hasSpacing) ctx.letterSpacing = '0px';
  }

  function drawLasersAndBullets() {
    ctx.globalCompositeOperation = 'lighter';
    for (const l of G.lasers) {
      drawGlow('#ff3b5c', l.x, l.y + 6, 14, 0.7, 1.6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffd0d8';
      ctx.fillRect(l.x - 1.5, l.y, 3, 14);
    }
    for (const bl of G.bullets) {
      drawGlow('#ff4bd2', bl.x, bl.y, 22 + Math.sin(bl.t * 20) * 3, 0.9);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(bl.x, bl.y, 4.5, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawShieldBarrier() {
    if (!G.shield) return;
    ctx.globalCompositeOperation = 'lighter';
    const a = 0.55 + 0.25 * Math.sin(G.t * 5);
    ctx.globalAlpha = a * 0.35;
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(FL, SHIELD_Y - 3, FR - FL, 6);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#e6ecff';
    ctx.fillRect(FL, SHIELD_Y - 0.75, FR - FL, 1.5);
    // travelling sparkles
    for (let i = 0; i < 6; i++) {
      const x = FL + (((G.t * 160 + i * 160) % (FR - FL)));
      drawGlow('#e6ecff', x, SHIELD_Y, 12, 0.6);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawBalls() {
    const fire = G.fx.fire > 0;
    const col = fire ? '#ff8a3b' : '#7fe9ff';
    ctx.globalCompositeOperation = 'lighter';
    for (const b of G.balls) {
      const tr = b.trail, n = tr.length / 2;
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / n;
        drawGlow(col, tr[i * 2], tr[i * 2 + 1], b.r * (1 + 1.6 * f), f * 0.35);
      }
      drawGlow(col, b.x, b.y, b.r * 4.5, 0.75);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const b of G.balls) {
      const grd = ctx.createRadialGradient(b.x - 2, b.y - 2, 0.5, b.x, b.y, b.r);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.6, fire ? '#fff1c2' : '#e8fdff');
      grd.addColorStop(1, fire ? '#ffb347' : '#8ff3ff');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
    // magnet aim guide
    for (const b of G.balls) {
      if (!b.stuck || G.demo) continue;
      const rel = clamp(b.off / (paddle.w / 2), -1, 1);
      const ang = rel * 0.9;
      ctx.strokeStyle = 'rgba(160,255,200,0.45)';
      ctx.setLineDash([3, 7]);
      ctx.lineDashOffset = -G.t * 40;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.sin(ang) * 90, b.y - Math.cos(ang) * 90); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawPaddle() {
    if (G.phase === 'dying') return;
    const p = paddle;
    const w = p.w * (1 + p.squash * 0.07), h = p.h * (1 - p.squash * 0.3);
    const x = p.x - w / 2, y = p.y - h / 2 + p.squash * 2;
    const fire = G.fx.fire > 0;
    let c1 = fire ? '#ffb347' : '#3bf0ff', c2 = fire ? '#ff4b2b' : '#ff4bd2';
    if (G.fx.shrink > 0) { c1 = '#b9a6e0'; c2 = '#6a4f9a'; }
    const stunned = p.stun > 0;
    if (stunned && Math.floor(G.t * 30) % 2) ctx.globalAlpha = 0.5;

    ctx.globalCompositeOperation = 'lighter';
    drawGlow(c1, p.x, p.y, w * 0.75, 0.35, 0.28);
    ctx.globalAlpha = stunned && Math.floor(G.t * 30) % 2 ? 0.5 : 1;
    ctx.globalCompositeOperation = 'source-over';

    // laser cannons
    if (G.fx.laser > 0) {
      for (const sd of [-1, 1]) {
        const cx = p.x + sd * (w / 2 - 10);
        ctx.fillStyle = '#5a0f1e';
        rr(ctx, cx - 4, y - 8, 8, 10, 2); ctx.fill();
        ctx.fillStyle = '#ff3b5c';
        ctx.fillRect(cx - 1.5, y - 9, 3, 4);
      }
    }
    const grd = ctx.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, c2); grd.addColorStop(0.22, c1); grd.addColorStop(0.5, '#ffffff'); grd.addColorStop(0.78, c1); grd.addColorStop(1, c2);
    ctx.fillStyle = grd;
    rr(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = 'rgba(10,6,30,0.35)';
    rr(ctx, x + 2, y + h * 0.55, w - 4, h * 0.42, h / 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    rr(ctx, x + 6, y + 2, w - 12, h * 0.26, 2); ctx.fill();
    // energy core
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(G.t * 8);
    ctx.fillStyle = c1;
    ctx.fillRect(p.x - w * 0.3, p.y + 0.5, w * 0.6, 1.5);
    if (G.fx.catch > 0) {
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(G.t * 10);
      drawGlow('#4dff88', p.x, y, w * 0.55, 0.5, 0.15);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#4dff88';
      ctx.fillRect(x + 8, y - 1, w - 16, 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (stunned) {
      ctx.strokeStyle = 'rgba(255,120,220,0.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      let px = x, py = p.y;
      ctx.moveTo(px, py);
      while (px < x + w) { px += rand(6, 12); py = p.y + rand(-9, 9); ctx.lineTo(Math.min(px, x + w), py); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    const ps = G.parts;
    const k = viewScale * dpr;
    // shards (normal blend, rotated)
    for (const p of ps) {
      if (p.k !== 0) continue;
      const a = Math.min(1, p.life / p.max * 1.5);
      const c = Math.cos(p.rot), s = Math.sin(p.rot);
      ctx.setTransform(k * c, k * s, -k * s, k * c, k * (p.x + shakeX), k * (p.y + shakeY));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }
    baseTransform();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of ps) {
      const a = p.life / p.max;
      if (p.k === 1) {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
      } else if (p.k === 2) {
        drawGlow(p.color, p.x, p.y, p.size * (0.5 + a * 0.5), a * 0.8);
      } else if (p.k === 3) {
        const e = 1 - a;
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = p.color; ctx.lineWidth = 2;
        rr(ctx, p.x - e * 10, p.y - e * 6, p.w + e * 20, p.h + e * 12, 6); ctx.stroke();
      }
    }
    for (const r of G.rings) {
      const a = r.life / r.max;
      ctx.globalAlpha = a;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w * a + 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    }
    for (const bo of G.bolts) {
      const a = bo.life / bo.max;
      for (const [lw, col, al] of [[7, bo.color, 0.25], [2.5, bo.color, 0.8], [1, '#ffffff', 1]]) {
        ctx.globalAlpha = a * al; ctx.strokeStyle = col; ctx.lineWidth = lw;
        ctx.beginPath();
        bo.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawTexts() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of G.texts) {
      const age = t.max - t.life;
      const a = Math.min(1, t.life / (t.max * 0.4));
      const pop = age < 0.12 ? 0.6 + (age / 0.12) * 0.55 : age < 0.22 ? 1.15 - ((age - 0.12) / 0.1) * 0.15 : 1;
      ctx.globalAlpha = a;
      font(Math.round(t.size * pop), 900, t.big ? FONT : MONO, t.big ? 3 : 0);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,2,24,0.8)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    if (hasSpacing) ctx.letterSpacing = '0px';
  }

  function drawHUD() {
    if (G.demo) return;
    const hue = G.def ? G.def.hue : 260;
    const bg = ctx.createLinearGradient(0, 0, 0, FT - 4);
    bg.addColorStop(0, 'rgba(6,3,20,0.92)'); bg.addColorStop(1, 'rgba(10,5,30,0.75)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, FT - 4);
    ctx.textBaseline = 'alphabetic';

    // score
    ctx.textAlign = 'left';
    font(10, 800, FONT, 3);
    ctx.fillStyle = 'rgba(190,200,255,0.55)';
    ctx.fillText('SCORE', 24, 20);
    ctx.fillText('BEST ' + fmt(Math.max(save.best, G.score)), 100, 20);
    font(26, 800, MONO, 1);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = `hsl(${hue + 40},100%,60%)`; ctx.shadowBlur = 12;
    ctx.fillText(fmt(G.shownScore), 24, 47);
    ctx.shadowBlur = 0;

    // multiplier
    const m = comboMult();
    font(10, 800, FONT, 3);
    ctx.fillStyle = 'rgba(190,200,255,0.55)';
    ctx.fillText('MULT', 236, 20);
    const mc = ['#ffffff', '#9ff6ff', '#4dff88', '#ffd93b', '#ff8a3b', '#ff4bd2', '#ff3b5c', '#ffffff'][m - 1];
    font(24 + (m > 1 ? Math.sin(G.t * 10) * 1.5 : 0), 900, FONT, 0);
    ctx.fillStyle = mc;
    if (m > 1) { ctx.shadowColor = mc; ctx.shadowBlur = 14; }
    ctx.fillText('×' + m, 234, 47);
    ctx.shadowBlur = 0;
    if (G.combo > 1) {
      font(10, 800, MONO, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(G.combo + ' CHAIN', 280, 46);
      // progress to next mult
      const prog = (G.combo % 6) / 6;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(280, 26, 60, 3);
      ctx.fillStyle = mc; ctx.fillRect(280, 26, 60 * (m >= 8 ? 1 : prog), 3);
    }

    // sector
    ctx.textAlign = 'center';
    font(19, 900, FONT, 5);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = `hsl(${hue + 40},100%,60%)`; ctx.shadowBlur = 10;
    ctx.fillText('SECTOR ' + pad2(G.levelIdx + 1), W / 2 + 2, 28);
    ctx.shadowBlur = 0;
    font(10, 700, FONT, 3);
    ctx.fillStyle = `hsl(${hue + 40},90%,72%)`;
    ctx.fillText(G.def ? G.def.name : '', W / 2 + 1, 45);

    // active effects
    let ex = 600;
    const chips = FX_ORDER.filter((k) => G.fx[k] > 0).map((k) => [k, G.fx[k] / FX_DUR[k]]);
    if (G.shield) chips.push(['shield', 1]);
    for (const [k, f] of chips) {
      const def = CAPS[k];
      const cx = ex + 13, cy = 32;
      const blink = f < 0.2 && Math.floor(G.t * 8) % 2;
      ctx.globalAlpha = blink ? 0.4 : 1;
      ctx.fillStyle = rgba(def.color, 0.18);
      ctx.beginPath(); ctx.arc(cx, cy, 13, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(def.color, 0.25); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, 13, 0, TAU); ctx.stroke();
      ctx.strokeStyle = def.color;
      ctx.beginPath(); ctx.arc(cx, cy, 13, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke();
      font(12, 900, FONT, 0);
      ctx.fillStyle = def.color;
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, cx, cy + 1);
      ctx.textBaseline = 'alphabetic';
      ex += 32;
    }
    ctx.globalAlpha = 1;

    // lives
    ctx.textAlign = 'right';
    font(10, 800, FONT, 3);
    ctx.fillStyle = 'rgba(190,200,255,0.55)';
    ctx.fillText('LIVES', W - 22, 20);
    const shown = Math.min(G.lives, 6);
    for (let i = 0; i < shown; i++) {
      const lx = W - 24 - 26 - i * 30, ly = 34;
      const g = ctx.createLinearGradient(lx, 0, lx + 26, 0);
      g.addColorStop(0, '#ff4bd2'); g.addColorStop(0.5, '#3bf0ff'); g.addColorStop(1, '#ff4bd2');
      ctx.fillStyle = g;
      rr(ctx, lx, ly, 26, 7, 3.5); ctx.fill();
    }
    if (G.lives > 6) {
      font(12, 800, MONO, 0);
      ctx.fillStyle = '#fff';
      ctx.fillText('+' + (G.lives - 6), W - 24 - 6 * 30 - 4, 42);
    }
    if (hasSpacing) ctx.letterSpacing = '0px';
  }

  function glowText(str, x, y, size, color, glowCol, spacing = 0, weight = 900) {
    font(size, weight, FONT, spacing);
    ctx.shadowColor = glowCol; ctx.shadowBlur = 24;
    ctx.fillStyle = color;
    ctx.fillText(str, x + spacing / 2, y);
    ctx.shadowBlur = 0;
  }

  function drawBanners() {
    if (G.demo) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const hue = G.def ? G.def.hue : 260;
    // sector intro
    if (G.phase === 'live' && G.levelTime < 3.2) {
      const t = G.levelTime;
      const a = t < 0.3 ? t / 0.3 : t > 2.5 ? Math.max(0, 1 - (t - 2.5) / 0.7) : 1;
      const yy = H * 0.6;
      ctx.globalAlpha = a;
      if (G.boss) {
        const blink = Math.floor(t * 4) % 2 === 0;
        ctx.fillStyle = 'rgba(255,30,80,0.12)';
        ctx.fillRect(0, yy - 62, W, 124);
        ctx.fillStyle = 'rgba(255,60,100,0.8)';
        ctx.fillRect(0, yy - 62, W, 2); ctx.fillRect(0, yy + 60, W, 2);
        if (blink) glowText('⚠  WARNING  ⚠', W / 2, yy - 34, 18, '#ff6b8a', '#ff2050', 8);
        glowText(G.def.boss.title, W / 2, yy + 4, 46, '#ffffff', '#ff2050', 10);
        font(13, 700, FONT, 4);
        ctx.fillStyle = 'rgba(255,200,220,0.85)';
        ctx.fillText('BREAK THE SHIELDS  ·  STRIKE THE CORE', W / 2, yy + 42);
      } else {
        const slide = (1 - easeOutCubic(Math.min(1, t / 0.5))) * 60;
        glowText('SECTOR ' + pad2(G.levelIdx + 1), W / 2 - slide, yy - 10, 48, '#ffffff', `hsl(${hue + 40},100%,60%)`, 12);
        font(15, 700, FONT, 6);
        ctx.fillStyle = `hsl(${hue + 40},100%,78%)`;
        ctx.fillText(G.def.name, W / 2 + slide + 3, yy + 32);
      }
      ctx.globalAlpha = 1;
    }
    // launch hint
    if (G.phase === 'live' && G.balls.some((b) => b.stuck && b.serve) && G.levelTime > 0.6) {
      ctx.globalAlpha = 0.45 + 0.35 * Math.sin(G.t * 4);
      font(12, 800, FONT, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('CLICK  ·  SPACE  TO LAUNCH', W / 2 + 2, PADDLE_Y - 64);
      ctx.globalAlpha = 1;
    }
    // sector clear tally
    if (G.phase === 'clear' && G.clearInfo) {
      const t = G.phaseT, ci = G.clearInfo;
      const a = Math.min(1, t / 0.25);
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = '#05020f';
      ctx.fillRect(0, H * 0.36, W, 220);
      ctx.globalAlpha = a;
      const sc = t < 0.25 ? 1.5 - t * 2 : 1;
      ctx.save();
      ctx.translate(W / 2, H * 0.44);
      ctx.scale(sc, sc);
      glowText(ci.boss ? 'WARDEN DOWN' : 'SECTOR CLEAR', 0, 0, 44, '#ffffff', `hsl(${hue + 40},100%,60%)`, 10);
      ctx.restore();
      const rows = [
        ['CLEAR BONUS', '+' + fmt(ci.clearBonus), '#ffffff'],
        ['FLAWLESS', ci.flawless ? '+' + fmt(ci.flawless) : '—', ci.flawless ? '#ffd93b' : 'rgba(255,255,255,0.4)'],
        ['BEST CHAIN', String(ci.combo), '#9ff6ff'],
      ];
      rows.forEach(([l, v, c], i) => {
        const tt = t - 0.5 - i * 0.3;
        if (tt <= 0) return;
        ctx.globalAlpha = Math.min(1, tt / 0.2);
        const y = H * 0.44 + 52 + i * 26;
        font(12, 800, FONT, 4);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(200,210,255,0.7)';
        ctx.fillText(l, W / 2 - 16, y);
        font(17, 800, MONO, 1);
        ctx.textAlign = 'left';
        ctx.fillStyle = c;
        ctx.fillText(v, W / 2 + 16, y);
      });
      ctx.textAlign = 'center';
      if (t > 1.4) {
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(G.t * 5);
        font(11, 700, FONT, 4);
        ctx.fillStyle = '#ffffff';
        const last = G.levelIdx === CAMPAIGN_LENGTH - 1 && !G.endless;
        ctx.fillText(last ? 'CLICK TO CONTINUE' : 'CLICK FOR NEXT SECTOR', W / 2 + 2, H * 0.44 + 140);
      }
      ctx.globalAlpha = 1;
    }
    if (hasSpacing) ctx.letterSpacing = '0px';
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#030108';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (G.shake > 0.1 && G.state !== 'paused') { shakeX = rand(-1, 1) * G.shake; shakeY = rand(-1, 1) * G.shake; }
    else { shakeX = 0; shakeY = 0; }
    baseTransform();
    drawBackground();
    drawWalls();
    drawBricks();
    drawBoss();
    drawShieldBarrier();
    drawCaps();
    drawLasersAndBullets();
    drawPaddle();
    drawBalls();
    drawParticles();
    drawTexts();

    const k = viewScale * dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawHUD();
    drawBossBar();
    drawBanners();
    if (G.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = G.flash * 0.35;
      ctx.fillStyle = G.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ================================================================ loop
  let last = performance.now(), acc = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (G.state === 'play' || G.state === 'title') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 12) { update(STEP); acc -= STEP; n++; }
      if (n >= 12) acc = 0;
    }
    render();
    requestAnimationFrame(frame);
  }

  // ================================================================ input
  function pointerToGame(e) {
    const r = canvas.getBoundingClientRect();
    input.mx = ((e.clientX - r.left) / r.width) * W;
    input.mode = 'mouse';
  }
  window.addEventListener('pointermove', (e) => { if (G.state === 'play') pointerToGame(e); });
  canvas.addEventListener('pointerdown', (e) => {
    Sound.init();
    if (G.state !== 'play') return;
    pointerToGame(e);
    action();
  });
  document.addEventListener('pointerdown', () => Sound.init(), { once: false, passive: true });

  window.addEventListener('keydown', (e) => {
    Sound.init();
    const code = e.code;
    if (G.state === 'play') {
      if (code === 'ArrowLeft' || code === 'KeyA') { input.left = true; input.mode = 'keys'; }
      if (code === 'ArrowRight' || code === 'KeyD') { input.right = true; input.mode = 'keys'; }
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') { action(); e.preventDefault(); }
      if (code === 'KeyP' || code === 'Escape') { pause(); e.preventDefault(); }
    } else if (G.state === 'paused') {
      if (code === 'KeyP' || code === 'Escape') { resume(); e.preventDefault(); }
    } else if (code === 'Escape') {
      if (curScreen === 'scr-select' || curScreen === 'scr-howto') { showScreen('scr-title'); Sound.sfx.ui(); }
    }
    if (code === 'KeyM') toggleAllSound();
    if ((code === 'Enter' || code === 'Space') && G.state !== 'play' && curScreen) {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; // native click
      const btn = $(curScreen).querySelector('button.primary');
      if (btn) { btn.click(); e.preventDefault(); }
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  });
  window.addEventListener('blur', () => { input.left = input.right = false; pause(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); Sound.suspend(); } else Sound.resume();
  });

  // ================================================================ UI screens
  let curScreen = 'scr-title';
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('show', s.id === id));
    curScreen = id;
    canvas.classList.toggle('nocursor', !id && G.state === 'play');
    if (id === 'scr-title') $('title-best').textContent = fmt(save.best);
    if (id === 'scr-select') buildSectorGrid();
    syncToggles();
  }

  function syncToggles() {
    document.querySelectorAll('[data-act="sfx"]').forEach((b) => { b.textContent = 'SFX ' + (Sound.sfxOn ? 'ON' : 'OFF'); b.classList.toggle('off', !Sound.sfxOn); });
    document.querySelectorAll('[data-act="music"]').forEach((b) => { b.textContent = 'MUSIC ' + (Sound.musicOn ? 'ON' : 'OFF'); b.classList.toggle('off', !Sound.musicOn); });
    document.querySelectorAll('[data-act="shake"]').forEach((b) => { b.textContent = 'SHAKE ' + (save.shake ? 'ON' : 'OFF'); b.classList.toggle('off', !save.shake); });
  }

  function toggleAllSound() {
    const anyOn = Sound.sfxOn || Sound.musicOn;
    if (Sound.sfxOn === anyOn) Sound.toggleSfx();
    if (Sound.musicOn === anyOn) Sound.toggleMusic();
    syncToggles();
    if (!G.demo && G.state === 'play') floatText(W / 2, H * 0.5, anyOn ? 'SOUND OFF' : 'SOUND ON', '#ffffff', 18, true);
  }

  function buildSectorGrid() {
    const grid = $('sector-grid');
    grid.innerHTML = '';
    for (let i = 0; i < CAMPAIGN_LENGTH; i++) {
      const L = LEVELS[i];
      const b = document.createElement('button');
      b.dataset.act = 'level';
      b.dataset.level = i;
      const locked = i + 1 > save.unlocked;
      b.disabled = locked;
      if (L.boss) b.classList.add('boss');
      b.innerHTML = `${pad2(i + 1)}<small>${locked ? 'LOCKED' : L.boss ? 'BOSS' : L.name}</small>`;
      grid.appendChild(b);
    }
    const e = document.createElement('button');
    e.dataset.act = 'level';
    e.dataset.level = CAMPAIGN_LENGTH;
    e.className = 'endless';
    e.disabled = save.unlocked <= CAMPAIGN_LENGTH;
    e.innerHTML = `ENDLESS<small>${e.disabled ? 'DEFEAT WARDEN PRIME TO UNLOCK' : 'PROCEDURAL SECTORS · NO END'}</small>`;
    grid.appendChild(e);
  }

  $('ui').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    Sound.init();
    const act = btn.dataset.act;
    switch (act) {
      case 'play': Sound.sfx.uiGo(); startGame(0); break;
      case 'select': Sound.sfx.ui(); showScreen('scr-select'); break;
      case 'howto': Sound.sfx.ui(); showScreen('scr-howto'); break;
      case 'back': Sound.sfx.ui(); showScreen('scr-title'); break;
      case 'level': Sound.sfx.uiGo(); startGame(+btn.dataset.level); break;
      case 'sfx': Sound.toggleSfx(); Sound.sfx.ui(); syncToggles(); break;
      case 'music': Sound.toggleMusic(); Sound.sfx.ui(); syncToggles(); break;
      case 'shake': save.shake = !save.shake; store('sl_shake', save.shake ? '1' : '0'); Sound.sfx.ui(); syncToggles(); break;
      case 'resume': Sound.sfx.ui(); resume(); break;
      case 'restart': {
        Sound.sfx.uiGo();
        Sound.setDuck(false);
        G.state = 'play';
        showScreen(null);
        // restarting a sector costs nothing but resets the score earned in it
        G.score = G.levelStartScore; G.shownScore = G.score; G.lives = G.levelStartLives;
        loadLevel(G.levelIdx);
        last = performance.now();
        break;
      }
      case 'quit': Sound.sfx.ui(); quitToTitle(); break;
      case 'retry': Sound.sfx.uiGo(); startGame(G.levelIdx); break;
      case 'endless':
        Sound.sfx.uiGo();
        G.endless = true;
        G.state = 'play';
        showScreen(null);
        loadLevel(CAMPAIGN_LENGTH);
        break;
    }
    if (document.activeElement && document.activeElement.blur && G.state === 'play') document.activeElement.blur();
  });
  $('ui').addEventListener('pointerover', (e) => {
    const btn = e.target.closest && e.target.closest('button');
    if (btn && !btn.disabled && e.pointerType === 'mouse' && btn !== $('ui').lastHover) { $('ui').lastHover = btn; Sound.sfx.ui(); }
  });

  // ================================================================ boot
  const params = new URLSearchParams(location.search);
  if (params.has('autoplay')) {
    // hidden attract/test mode: ?autoplay=<sector>
    startGame(Math.max(0, (+params.get('autoplay') || 1) - 1));
    G.auto = true;
    if (params.has('fx')) params.get('fx').split(',').forEach((k) => { if (k in G.fx) G.fx[k] = 30; if (k === 'shield') G.shield = true; if (k === 'multi') { releaseBall(G.balls[0]); multiball(); } });
    window.addEventListener('error', (e) => { document.title = 'RUNTIME ERR ' + e.message + ' ' + e.lineno; });
    G.god = params.has('god');
    if (params.has('lives')) G.lives = +params.get('lives');
    const sim = +params.get('sim') || 0;
    const log = [];
    let lastLvl = G.levelIdx, lvlStart = 0;
    try {
      for (let i = 0; i < sim * 120; i++) {
        if (G.state === 'victory') { G.endless = true; G.state = 'play'; loadLevel(CAMPAIGN_LENGTH); }
        if (G.state !== 'play') break;
        update(STEP);
        if (G.phase === 'clear' && G.phaseT > 1.6) { if (params.has('hold')) break; nextLevel(); }
        if (G.levelIdx !== lastLvl) { log.push(`L${lastLvl + 1}:${((i - lvlStart) / 120).toFixed(0)}s`); lastLvl = G.levelIdx; lvlStart = i; }
      }
      document.title = 'SIM ' + JSON.stringify({ phase: G.phase, ts: G.timeScale, t: G.t.toFixed(1), b0: G.balls[0] && [G.balls[0].x|0, G.balls[0].y|0, G.balls[0].dx.toFixed(2), G.balls[0].dy.toFixed(2), G.balls[0].stuck, G.balls[0].spd|0], px: paddle.x|0, state: G.state, level: G.levelIdx + 1, score: G.score, lives: G.lives, balls: G.balls.length, parts: G.parts.length, remaining: G.remaining, boss: G.boss && G.boss.hp, log });
    } catch (err) {
      document.title = 'SIMERR ' + err.message + ' @ ' + (err.stack || '').split('\n').slice(0, 4).join(' | ');
    }
  } else {
    startDemo();
    showScreen(params.get('screen') || 'scr-title');
  }
  requestAnimationFrame((t) => { last = t; frame(t); });

  // debug hook for automated smoke tests
  window.__SL = { G, paddle, update, render };
})();
