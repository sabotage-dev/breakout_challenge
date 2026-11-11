(() => {
'use strict';
/* ================= NOVABREAK ================= */
const W = 960, H = 720, TOP = 64, COLS = 13, BW = 66, BH = 26, GAP = 4;
const CW = BW + GAP, CH = BH + GAP, OX = (W - (COLS * CW - GAP)) / 2, OY = TOP + 28;
const TAU = Math.PI * 2;
const FONT = '"Futura","Avenir Next","Century Gothic","Trebuchet MS",sans-serif';
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d'), wrap = $('wrap'), ui = $('ui'), panel = $('panel');
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);

/* ---------------- Audio ---------------- */
const A = (() => {
  let ac = null, master, sfxG, musG, nbuf, mode = 0, nextT = 0, step = 0;
  const SD = 60 / 116 / 4;
  const ROOTS = [45, 45, 41, 41, 48, 48, 43, 40], MINOR = [1, 1, 0, 0, 0, 0, 0, 0];
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  const api = { quiet: false };
  api.init = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.8;
      const comp = ac.createDynamicsCompressor();
      master.connect(comp); comp.connect(ac.destination);
      sfxG = ac.createGain(); sfxG.connect(master);
      musG = ac.createGain(); musG.gain.value = 0.55;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800;
      musG.connect(lp); lp.connect(master);
      nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      nextT = ac.currentTime + 0.1;
      setInterval(sched, 40);
    } catch (e) { ac = null; }
  };
  function tone(f, d, type, v, f2, at, dest) {
    if (!ac) return;
    const t = at || ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || sfxG);
    o.start(t); o.stop(t + d + 0.05);
  }
  function noise(d, v, fc, ft, at, dest, fc2) {
    if (!ac) return;
    const t = at || ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; s.loop = true;
    f.type = ft || 'lowpass'; f.frequency.setValueAtTime(fc || 2000, t);
    if (fc2) f.frequency.exponentialRampToValueAtTime(fc2, t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(dest || sfxG);
    s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  function sched() {
    if (!ac) return;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.2) {
      if (mode === 0) playStep(step, nextT);
      nextT += SD; step++;
    }
  }
  function playStep(s, t) {
    const bar = (s >> 4) % 8, i = s & 15, root = ROOTS[bar], third = MINOR[bar] ? 3 : 4;
    const ch = [0, third, 7, 12, 7, third];
    if (i % 4 === 0) tone(120, 0.16, 'sine', 0.55, 38, t, musG);
    if (i % 4 === 2) noise(0.04, 0.07, 7000, 'highpass', t, musG);
    if (i === 4 || i === 12) noise(0.12, 0.11, 1800, 'bandpass', t, musG);
    if (i === 0 || i === 3 || i === 6 || i === 10 || i === 12 || i === 14) tone(mf(root - 12), 0.2, 'sawtooth', 0.15, 0, t, musG);
    const up = ((s >> 5) % 2 && i > 7) ? 12 : 0;
    tone(mf(root + 12 + ch[i % 6] + up), 0.12, 'square', 0.03, 0, t, musG);
    if (i === 0) { tone(mf(root + 12), SD * 15, 'triangle', 0.05, 0, t, musG); tone(mf(root + 12 + third), SD * 15, 'triangle', 0.035, 0, t, musG); }
  }
  api.cycle = () => {
    mode = (mode + 1) % 3;
    if (master) master.gain.value = mode === 2 ? 0 : 0.8;
    return ['SOUND + MUSIC', 'SOUND ONLY', 'MUTED'][mode];
  };
  const PENTA = [0, 2, 4, 7, 9];
  const S = fn => (...a) => { if (ac && !api.quiet && mode < 2) fn(...a); };
  api.brick = S(c => {
    const n = Math.min(c, 14), f = 262 * Math.pow(2, (PENTA[n % 5] + 12 * Math.floor(n / 5)) / 12);
    tone(f, 0.14, 'triangle', 0.3); tone(f * 2, 0.07, 'square', 0.06);
  });
  api.armor = S(() => { tone(190, 0.08, 'square', 0.15, 120); noise(0.05, 0.1, 3000, 'highpass'); });
  api.tink = S(() => { tone(2100, 0.06, 'triangle', 0.12); tone(3150, 0.09, 'sine', 0.08); });
  api.paddle = S(() => tone(180, 0.1, 'triangle', 0.35, 90));
  api.wall = S(() => tone(420, 0.04, 'sine', 0.1));
  api.launch = S(() => tone(220, 0.18, 'sawtooth', 0.12, 880));
  api.boom = S(() => { noise(0.45, 0.5, 1800, 'lowpass', 0, null, 80); tone(90, 0.4, 'sine', 0.5, 30); });
  api.prism = S(() => { [0, 4, 7, 12].forEach((s, i) => tone(660 * Math.pow(2, s / 12), 0.12, 'sine', 0.18, 0, ac.currentTime + i * 0.04)); });
  api.power = S(() => { [0, 5, 9, 12].forEach((s, i) => tone(440 * Math.pow(2, s / 12), 0.1, 'square', 0.12, 0, ac.currentTime + i * 0.05)); });
  api.bad = S(() => { tone(300, 0.3, 'sawtooth', 0.2, 70); noise(0.2, 0.15, 900); });
  api.laser = S(() => tone(1400, 0.09, 'sawtooth', 0.05, 300));
  api.zap = S(() => tone(700, 0.2, 'square', 0.08, 110));
  api.lose = S(() => { tone(440, 0.6, 'sawtooth', 0.25, 55); noise(0.5, 0.2, 1200, 'lowpass', 0, null, 100); });
  api.nova = S(() => { noise(0.9, 0.6, 6000, 'lowpass', 0, null, 60); tone(60, 0.9, 'sine', 0.6, 25); tone(1200, 0.5, 'sawtooth', 0.12, 80); });
  api.ready = S(() => { tone(880, 0.1, 'sine', 0.2); tone(1320, 0.25, 'sine', 0.2, 0, ac.currentTime + 0.09); });
  api.bossHit = S(() => { tone(140, 0.15, 'square', 0.25, 60); noise(0.08, 0.2, 2500); });
  api.clear = S(() => { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(392 * Math.pow(2, s / 12), 0.22, 'triangle', 0.22, 0, ac.currentTime + i * 0.07)); });
  api.over = S(() => { [12, 8, 5, 0].forEach((s, i) => tone(196 * Math.pow(2, s / 12), 0.4, 'sawtooth', 0.16, 0, ac.currentTime + i * 0.22)); });
  api.life = S(() => { [0, 7, 12, 19].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.15, 'sine', 0.25, 0, ac.currentTime + i * 0.06)); });
  return api;
})();

/* ---------------- Levels ---------------- */
// Each row is the left 7 columns; it is mirrored to 13.
// 1-6 colour bricks, A/B armoured (2/3 hp), S steel, X bomb, P prism (frees a ball)
const LEVELS = [
  { name: 'First Light', hue: 215, rows: ['.......', '1111111', '2222222', '333333P', '4444444', '5555555'] },
  { name: 'Diamond Dust', hue: 265, rows: ['......6', '.....65', '....654', '...654X', '....654', '.....65', '......6', '.......', 'A..A..A'] },
  { name: 'Pillars', hue: 170, rows: ['6.6.6.6', '5.5.5.5', '4.4.P.4', '3.3.X.3', '2.2.2.2', '1.1.1.1', 'AAAAAAA'] },
  { name: 'The Vault', hue: 30, rows: ['4444444', '4AAAAA4', '4AXPXA4', '4AAAAA4', '4444444', '.......', 'SS.S.SS'] },
  { name: 'The Warden', hue: 350, boss: { hp: 22, spread: 1 }, rows: ['', '', '', '', '1.2.3.4', '.A.A.A.', 'P.....X'] },
  { name: 'Chain Reaction', hue: 12, rows: ['1X1X1X1', '2222222', 'X3X3X3X', '4444444', '5X5X5X5', 'AAAAAAA'] },
  { name: 'Prism Garden', hue: 300, rows: ['B.B.B.B', '1P1P1P1', '2222222', 'S.3X3.S', '4444444', '..A.A..', '5.....5'] },
  { name: 'Fortress', hue: 200, rows: ['SSS.SSS', 'B66666B', 'B5XPX5B', 'B44444B', 'AAAAAAA', '.......', 'S.S...S'] },
  { name: 'Checker Storm', hue: 130, rows: ['A6A6A6A', '5B5B5B5', 'A4X4X4A', '3B3P3B3', 'A2A2A2A', '1X1S1X1'] },
  { name: 'The Overseer', hue: 280, boss: { hp: 38, spread: 3 }, rows: ['', '', '', '', 'S..X..S', 'B5B5B5B', 'P.A.A.P', '..1.1..'] },
];
const HUES = { 1: 190, 2: 145, 3: 55, 4: 28, 5: 335, 6: 270 };
const POW = {
  W: { name: 'WIDE', col: '#4df', w: 14 },
  M: { name: 'MULTI', col: '#f6f', w: 14 },
  L: { name: 'LASER', col: '#f66', w: 10 },
  S: { name: 'SLOW', col: '#8f8', w: 9 },
  F: { name: 'FIRE', col: '#fa3', w: 9 },
  B: { name: 'BARRIER', col: '#7af', w: 10 },
  '+': { name: '1UP', col: '#fff', w: 3 },
  X: { name: 'SHRINK', col: '#99a', w: 8, bad: true },
};
const POW_KEYS = Object.keys(POW), POW_TOTAL = POW_KEYS.reduce((s, k) => s + POW[k].w, 0);

/* ---------------- State ---------------- */
let state = 'menu', demo = true, time = 0, last = 0, primaryAct = 'start';
let score = 0, dispScore = 0, lives = 3, levelIdx = 0, hi = 0, newHi = false;
let grid = [], bricks = [], balls = [], capsules = [], bolts = [], sparks = [], pending = [];
let parts = [], texts = [], rings = [];
let boss = null, bossLevel = false, bossDead = false;
let combo = 0, comboT = 0, bestCombo = 0, surge = 0, sinceDrop = 0, speedRamp = 0, baseSpeed = 400;
let shake = 0, flash = 0, bannerT = 0, clearT = 0, cleared = false, laserCd = 0;
let toast = '', toastT = 0, levelHue = 215, bricksBroken = 0;
const T = { wide: 0, laser: 0, slow: 0, fire: 0, shield: 0, shrink: 0 };
const pad = { x: W / 2, y: H - 48, w: 120, h: 16, vx: 0, stun: 0, squash: 0 };
const keys = { left: false, right: false };
let mouseX = W / 2, useKeys = false;
try { hi = +localStorage.getItem('novabreak.hi') || 0; } catch (e) {}

/* ---------------- Sprites & background ---------------- */
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
const SP = 10, spriteCache = {};
function brickSprite(br) {
  const key = br.type + br.hue + '_' + br.hp;
  if (spriteCache[key]) return spriteCache[key];
  const c = document.createElement('canvas');
  c.width = (BW + SP * 2) * 2; c.height = (BH + SP * 2) * 2;
  const g = c.getContext('2d'); g.scale(2, 2); g.translate(SP, SP);
  let h = br.hue, s = 90, l = 56;
  if (br.type === 'a') { h = 215; s = 30; l = 42 + br.hp * 9; }
  if (br.type === 's') { h = 225; s = 10; l = 30; }
  if (br.type === 'x') { h = 6; s = 95; l = 52; }
  g.shadowColor = `hsla(${h},${s}%,${l}%,.85)`; g.shadowBlur = br.type === 's' ? 3 : 9;
  let gr = g.createLinearGradient(0, 0, 0, BH);
  gr.addColorStop(0, `hsl(${h},${s}%,${l + 14}%)`); gr.addColorStop(1, `hsl(${h},${s}%,${l - 20}%)`);
  if (br.type === 'p') {
    gr = g.createLinearGradient(0, 0, BW, BH);
    [0, 60, 150, 200, 280, 330].forEach((hh, i) => gr.addColorStop(i / 5, `hsl(${hh},95%,72%)`));
    g.shadowColor = 'rgba(255,255,255,.9)';
  }
  g.fillStyle = gr; rr(g, 0, 0, BW, BH, 5); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,.2)'; rr(g, 2, 2, BW - 4, BH / 2 - 2, 4); g.fill();
  g.strokeStyle = `hsla(${h},${s}%,${Math.min(95, l + 30)}%,.9)`; g.lineWidth = 1; rr(g, .5, .5, BW - 1, BH - 1, 5); g.stroke();
  if (br.type === 'a') {
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2;
    for (let i = 0; i < br.hp; i++) { const x = BW / 2 + (i - (br.hp - 1) / 2) * 10; g.beginPath(); g.moveTo(x - 3, 8); g.lineTo(x + 2, 13); g.lineTo(x - 3, 18); g.stroke(); }
  } else if (br.type === 's') {
    g.fillStyle = 'rgba(200,215,255,.5)';
    [[5, 5], [BW - 5, 5], [5, BH - 5], [BW - 5, BH - 5]].forEach(p => { g.beginPath(); g.arc(p[0], p[1], 1.6, 0, TAU); g.fill(); });
    g.strokeStyle = 'rgba(160,180,230,.18)'; g.lineWidth = 3;
    for (let x = 6; x < BW - 14; x += 12) { g.beginPath(); g.moveTo(x + 8, 5); g.lineTo(x, BH - 5); g.stroke(); }
  } else if (br.type === 'x') {
    g.fillStyle = '#ffe9a0'; g.beginPath();
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r = i % 2 ? 3.5 : 8.5; g.lineTo(BW / 2 + Math.cos(a) * r, BH / 2 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  } else if (br.type === 'p') {
    g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath();
    g.moveTo(BW / 2, 4); g.lineTo(BW / 2 + 8, BH / 2); g.lineTo(BW / 2, BH - 4); g.lineTo(BW / 2 - 8, BH / 2); g.closePath(); g.fill();
  }
  return spriteCache[key] = c;
}
function glowSprite(inner, mid, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(0.22, mid); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
}
const ballSpr = glowSprite('#fff', 'rgba(120,230,255,.9)', 'rgba(60,120,255,0)');
const fireSpr = glowSprite('#fff', 'rgba(255,180,60,.95)', 'rgba(255,40,0,0)');
const sparkSpr = glowSprite('#fff', 'rgba(255,70,110,.95)', 'rgba(255,0,80,0)');
const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
function paintBg(hue) {
  const g = bg.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, `hsl(${hue},55%,7%)`); gr.addColorStop(1, `hsl(${(hue + 50) % 360},60%,3%)`);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 7; i++) {
    const x = rnd(W), y = rnd(H), r = rnd(160, 380), hh = (hue + rnd(-40, 70) + 360) % 360;
    const n = g.createRadialGradient(x, y, 0, x, y, r);
    n.addColorStop(0, `hsla(${hh},80%,45%,.13)`); n.addColorStop(1, `hsla(${hh},80%,40%,0)`);
    g.fillStyle = n; g.fillRect(0, 0, W, H);
  }
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}
const stars = [];
for (let i = 0; i < 110; i++) stars.push({ x: rnd(W), y: rnd(H), z: rnd(0.2, 1), p: rnd(TAU) });

/* ---------------- Effects ---------------- */
function burst(x, y, col, n, spd = 220, life = 0.6, size = 3) {
  for (let i = 0; i < n && parts.length < 700; i++) {
    const a = rnd(TAU), s = rnd(spd * 0.2, spd);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(life * 0.4, life), max: life, size: rnd(1, size), col });
  }
}
function floatText(x, y, txt, col = '#fff', size = 16, life = 0.9) { texts.push({ x, y, txt, col, size, life, max: life }); }
function ring(x, y, r, col, life = 0.5) { rings.push({ x, y, r, col, life, max: life }); }
function say(s) { toast = s; toastT = 2; }

/* ---------------- Game setup ---------------- */
function mirror(s) { s = (s + '.......').slice(0, 7); return s + s.slice(0, 6).split('').reverse().join(''); }
function loadLevel(n) {
  levelIdx = n;
  const def = LEVELS[n % LEVELS.length], loop = Math.floor(n / LEVELS.length);
  levelHue = def.hue; paintBg(levelHue);
  grid = []; bricks = []; capsules = []; bolts = []; sparks = []; pending = [];
  def.rows.forEach((row, r) => {
    grid[r] = new Array(COLS).fill(null);
    const s = mirror(row);
    for (let c = 0; c < COLS; c++) {
      const ch = s[c]; if (ch === '.') continue;
      const br = { r, c, x: OX + c * CW, y: OY + r * CH, type: 'n', hp: 1, hue: 200, flash: 0, age: -(0.1 + r * 0.05 + c * 0.025), dead: false };
      if (HUES[ch]) br.hue = HUES[ch];
      else if (ch === 'A') { br.type = 'a'; br.hp = 2; }
      else if (ch === 'B') { br.type = 'a'; br.hp = 3; }
      else if (ch === 'S') br.type = 's';
      else if (ch === 'X') br.type = 'x';
      else if (ch === 'P') br.type = 'p';
      else continue;
      grid[r][c] = br; bricks.push(br);
    }
  });
  for (let r = 0; r < 20; r++) if (!grid[r]) grid[r] = new Array(COLS).fill(null);
  bossLevel = !!def.boss; bossDead = false; boss = null;
  if (def.boss) boss = { x: W / 2, y: TOP + 24, w: 170, h: 58, hp: def.boss.hp + loop * 12, max: def.boss.hp + loop * 12, spread: def.boss.spread, t: 0, fire: 3, flash: 0 };
  baseSpeed = (390 + (n % LEVELS.length) * 13) * (1 + loop * 0.14);
  for (const k in T) T[k] = 0;
  combo = 0; comboT = 0; clearT = 0; cleared = false; bannerT = 2.6; sinceDrop = 0;
  resetBall();
}
function resetBall() {
  balls = [{ x: pad.x, y: pad.y - 8, vx: 0, vy: 0, r: 7, stuck: true, off: 0, trail: [], idle: 0, wait: 0.9 }];
  speedRamp = 0;
}
function newGame() {
  demo = false; A.quiet = false;
  score = 0; dispScore = 0; lives = 3; surge = 0; bestCombo = 0; bricksBroken = 0; newHi = false;
  parts = []; texts = []; rings = [];
  pad.x = mouseX = W / 2; pad.stun = 0;
  loadLevel(0); setState('play');
}
function toMenu() {
  demo = true; A.quiet = true; surge = 0; parts = []; texts = [];
  loadLevel(Math.floor(rnd(4))); setState('menu');
}
function curSpeed() { return (baseSpeed + speedRamp) * (T.slow > 0 ? 0.62 : 1); }
function spawnBall(x, y, a) {
  const s = curSpeed();
  balls.push({ x, y, vx: Math.sin(a) * s, vy: -Math.cos(a) * s, r: 7, stuck: false, off: 0, trail: [], idle: 0, wait: 0 });
}
function launch() {
  let any = false;
  for (const b of balls) if (b.stuck) {
    const a = clamp(pad.vx / 1800, -0.6, 0.6) + rnd(-0.12, 0.12), s = curSpeed();
    b.stuck = false; b.vx = Math.sin(a) * s; b.vy = -Math.cos(a) * s; any = true;
  }
  if (any) A.launch();
  return any;
}
function action() {
  if (state !== 'play' || demo) return;
  if (launch()) return;
  if (surge >= 100) nova();
}

/* ---------------- Mechanics ---------------- */
function nova() {
  surge = 0; shake = 16; flash = 0.55; A.nova();
  for (const b of balls) {
    if (b.stuck) continue;
    ring(b.x, b.y, 150, '#fff', 0.6); ring(b.x, b.y, 110, '#8cf', 0.45);
    burst(b.x, b.y, '#bff', 40, 500, 0.8, 4);
    for (const br of bricks) {
      const d = Math.hypot(br.x + BW / 2 - b.x, br.y + BH / 2 - b.y);
      if (d < 150) pending.push({ t: d / 900, br, dmg: 2 });
    }
    if (boss && Math.hypot(boss.x - b.x, boss.y + boss.h / 2 - b.y) < 230) damageBoss(5, b.x, b.y);
    sparks = sparks.filter(s => { if (Math.hypot(s.x - b.x, s.y - b.y) < 260) { burst(s.x, s.y, '#f68', 8); return false; } return true; });
  }
  floatText(W / 2, H / 2, 'NOVA!', '#fff', 54, 1.1);
}
function hitBrick(br, dmg) {
  if (br.dead) return;
  br.flash = 1;
  if (br.type === 's' && dmg < 99) { A.tink(); burst(br.x + BW / 2, br.y + BH / 2, '#cde', 4, 120, 0.3, 2); return; }
  br.hp -= dmg;
  if (br.hp <= 0) killBrick(br);
  else { A.armor(); burst(br.x + BW / 2, br.y + BH / 2, '#bcd', 6, 150, 0.35, 2); }
}
function killBrick(br) {
  br.dead = true; grid[br.r][br.c] = null; bricks = bricks.filter(b => b !== br);
  const cx = br.x + BW / 2, cy = br.y + BH / 2;
  const col = br.type === 'a' ? '#cdf' : br.type === 's' ? '#99a' : br.type === 'x' ? '#fa4' : br.type === 'p' ? '#fff' : `hsl(${br.hue},95%,65%)`;
  burst(cx, cy, col, 14, 260, 0.6, 3.5);
  if (br.type === 's') { score += 5; return; }
  combo++; comboT = 2.6; bricksBroken++;
  if (combo > bestCombo) bestCombo = combo;
  const mult = Math.min(8, 1 + Math.floor(combo / 4));
  const pts = ({ n: 10, a: 25, x: 15, p: 20 })[br.type] * mult;
  score += pts;
  floatText(cx, cy, '+' + pts, mult > 1 ? '#fe8' : '#fff', 12 + mult * 1.5, 0.7);
  if (combo > 1 && combo % 4 === 0 && mult <= 8 && combo <= 28) floatText(cx, cy - 22, 'x' + mult, '#f8f', 22, 1);
  A.brick(combo);
  if (!demo && surge < 100) { surge = Math.min(100, surge + 3 + mult * 0.5); if (surge >= 100) { A.ready(); say('NOVA READY — CLICK / SPACE'); } }
  if (br.type === 'x') {
    A.boom(); shake = Math.max(shake, 9); ring(cx, cy, 80, '#fb5', 0.4); burst(cx, cy, '#fd8', 26, 420, 0.7, 4);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const n = grid[br.r + dr] && grid[br.r + dr][br.c + dc];
      if (n) pending.push({ t: 0.09, br: n, dmg: 99 });
    }
  } else if (br.type === 'p') {
    A.prism(); ring(cx, cy, 50, '#fff', 0.4);
    if (balls.length < 24) spawnBall(cx, cy, rnd(-1, 1) + Math.PI);
  }
  if (Math.random() < 0.15 || ++sinceDrop > 9) dropCapsule(cx, cy);
}
function dropCapsule(x, y) {
  sinceDrop = 0;
  let r = rnd(POW_TOTAL), type = 'W';
  for (const k of POW_KEYS) { r -= POW[k].w; if (r <= 0) { type = k; break; } }
  if (type === '+' && lives >= 5) type = 'M';
  capsules.push({ x, y, type, t: rnd(TAU) });
}
function applyPower(k) {
  const p = POW[k];
  score += 50;
  floatText(pad.x, pad.y - 24, p.name, p.col, 20, 1.1);
  ring(pad.x, pad.y, 60, p.col, 0.35);
  if (p.bad) A.bad(); else if (k === '+') A.life(); else A.power();
  if (k === 'W') { T.wide = 14; T.shrink = 0; }
  else if (k === 'X') { T.shrink = 9; T.wide = 0; }
  else if (k === 'L') T.laser = 9;
  else if (k === 'S') T.slow = 9;
  else if (k === 'F') T.fire = 8;
  else if (k === 'B') T.shield = 13;
  else if (k === '+') lives = Math.min(6, lives + 1);
  else if (k === 'M') {
    launch();
    const cur = balls.slice();
    for (const b of cur) {
      if (balls.length >= 24) break;
      const a = Math.atan2(b.vx, -b.vy);
      spawnBall(b.x, b.y, a + 0.4); spawnBall(b.x, b.y, a - 0.4);
    }
  }
}
function damageBoss(d, x, y) {
  if (!boss) return;
  boss.hp -= d; boss.flash = 1; score += Math.round(20 * d);
  A.bossHit(); burst(x, y, '#f8a', 10, 260, 0.5, 3);
  if (boss.hp <= 0) {
    const bx = boss.x, by = boss.y + boss.h / 2;
    for (let i = 0; i < 6; i++) { burst(bx + rnd(-70, 70), by + rnd(-25, 25), i % 2 ? '#fd8' : '#f6a', 30, 520, 1.1, 5); }
    ring(bx, by, 260, '#fff', 0.8); ring(bx, by, 170, '#f6a', 0.6);
    shake = 24; flash = 0.7; A.boom(); A.nova();
    score += 3000; floatText(bx, by, '+3000', '#fd6', 34, 1.6);
    for (const br of bricks) pending.push({ t: rnd(0.15, 0.9), br, dmg: 99 });
    sparks = []; boss = null; bossDead = true;
  }
}
function hitRect(b, x, y, w, h) {
  const nx = clamp(b.x, x, x + w), ny = clamp(b.y, y, y + h), dx = b.x - nx, dy = b.y - ny;
  if (dx * dx + dy * dy >= b.r * b.r) return false;
  const cx = x + w / 2, cy = y + h / 2;
  const ox = w / 2 + b.r - Math.abs(b.x - cx), oy = h / 2 + b.r - Math.abs(b.y - cy);
  if (ox < oy) { const s = b.x < cx ? -1 : 1; b.x += ox * s; b.vx = Math.abs(b.vx) * s; }
  else { const s = b.y < cy ? -1 : 1; b.y += oy * s; b.vy = Math.abs(b.vy) * s; }
  return true;
}
function ballBricks(b) {
  const c0 = Math.floor((b.x - b.r - OX) / CW), c1 = Math.floor((b.x + b.r - OX) / CW);
  const r0 = Math.floor((b.y - b.r - OY) / CH), r1 = Math.floor((b.y + b.r - OY) / CH);
  let best = null, bd = 1e9;
  for (let r = r0; r <= r1; r++) {
    const row = grid[r]; if (!row) continue;
    for (let c = c0; c <= c1; c++) {
      const br = row[c]; if (!br) continue;
      const nx = clamp(b.x, br.x, br.x + BW), ny = clamp(b.y, br.y, br.y + BH);
      const d = (b.x - nx) ** 2 + (b.y - ny) ** 2;
      if (d < b.r * b.r && d < bd) { bd = d; best = br; }
    }
  }
  if (!best) return;
  b.idle = 0;
  if (T.fire > 0 && best.type !== 's') { hitBrick(best, 3); burst(b.x, b.y, '#fb4', 5, 160, 0.4, 3); return; }
  hitRect(b, best.x, best.y, BW, BH);
  hitBrick(best, 1);
}
function loseBall() {
  if (clearT > 0 || cleared) return;
  if (demo) { resetBall(); return; }
  lives--; A.lose(); shake = 14; flash = 0.3;
  burst(pad.x, pad.y, '#6df', 40, 420, 0.9, 4);
  for (const k in T) T[k] = 0;
  combo = 0; capsules = []; bolts = [];
  if (lives <= 0) return gameOver();
  resetBall();
}
function saveHi() {
  if (score > hi) { hi = score; newHi = true; try { localStorage.setItem('novabreak.hi', hi); } catch (e) {} }
}
function gameOver() {
  saveHi(); A.over();
  showPanel(`<h2>GAME OVER</h2>
    <div class="big">SCORE &nbsp;<span class="gold">${score.toLocaleString()}</span></div>
    ${newHi ? '<div class="big gold">★ NEW HIGH SCORE ★</div>' : `<div class="dim">BEST ${hi.toLocaleString()}</div>`}
    <div class="dim">REACHED SECTOR ${levelIdx + 1} · BEST COMBO ${bestCombo} · ${bricksBroken} BRICKS</div>
    <button data-act="start">Play again</button><br><button class="alt" data-act="menu">Title</button>`, 'start');
  setState('over');
}
function levelDone() {
  if (demo) { loadLevel((levelIdx + 1) % LEVELS.length); return; }
  const bonus = lives * 250 + (levelIdx + 1) * 100;
  score += bonus; saveHi();
  const final = (levelIdx + 1) % LEVELS.length === 0;
  if (final) {
    showPanel(`<h2 class="gold">GALAXY CLEARED</h2>
      <div class="big">The Overseer is dust. You are the nova.</div>
      <div class="big">SCORE &nbsp;<span class="gold">${score.toLocaleString()}</span></div>
      <div class="dim">BEST COMBO ${bestCombo} · ${bricksBroken} BRICKS SHATTERED</div>
      <button data-act="next">Go deeper — Loop ${Math.floor(levelIdx / LEVELS.length) + 2}</button><br><button class="alt" data-act="menu">Title</button>`, 'next');
    setState('win');
  } else {
    const nx = LEVELS[(levelIdx + 1) % LEVELS.length];
    showPanel(`<h2>SECTOR ${levelIdx + 1} CLEARED</h2>
      <div class="big">BONUS &nbsp;<span class="gold">+${bonus}</span></div>
      <div class="dim">SCORE ${score.toLocaleString()} · BEST COMBO ${bestCombo}</div>
      <div class="dim">NEXT: ${nx.boss ? '⚠ BOSS — ' : ''}${nx.name.toUpperCase()}</div>
      <button data-act="next">Continue</button>`, 'next');
    setState('clear');
  }
}

/* ---------------- Update ---------------- */
function update(dt) {
  time += dt;
  for (const k in T) if (T[k] > 0) T[k] = Math.max(0, T[k] - dt);
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  bannerT -= dt;

  // paddle
  const tw = 120 * (T.wide > 0 ? 1.55 : 1) * (T.shrink > 0 ? 0.62 : 1);
  pad.w += (tw - pad.w) * Math.min(1, dt * 12);
  pad.stun = Math.max(0, pad.stun - dt); pad.squash = Math.max(0, pad.squash - dt * 5);
  const px0 = pad.x;
  if (pad.stun <= 0) {
    if (demo) {
      let tgt = null;
      for (const b of balls) if (!b.stuck && (!tgt || (b.vy > 0 && b.y > tgt.y) || tgt.vy < 0)) tgt = b;
      const tx = tgt ? tgt.x + Math.sin(time * 2.3) * pad.w * 0.3 : W / 2 + Math.sin(time) * 200;
      pad.x += clamp(tx - pad.x, -900 * dt, 900 * dt);
    } else {
      const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (dir) { pad.x += dir * 800 * dt; useKeys = true; }
      else if (!useKeys) pad.x += (mouseX - pad.x) * Math.min(1, dt * 32);
    }
  }
  pad.x = clamp(pad.x, pad.w / 2 + 4, W - pad.w / 2 - 4);
  pad.vx = dt > 0 ? (pad.x - px0) / dt : 0;

  // balls
  speedRamp = Math.min(90, speedRamp + dt * 2.2);
  const sp = curSpeed();
  for (const b of balls) {
    if (b.stuck) {
      b.x = pad.x + b.off; b.y = pad.y - b.r - 1;
      if (demo && (b.wait -= dt) < 0) launch();
      continue;
    }
    let m = Math.hypot(b.vx, b.vy) || 1; b.vx *= sp / m; b.vy *= sp / m;
    if (Math.abs(b.vy) < sp * 0.2) { b.vy = (b.vy < 0 ? -1 : 1) * sp * 0.2; b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(sp * sp - b.vy * b.vy); }
    b.idle += dt;
    if (b.idle > 7) { const a = Math.atan2(b.vy, b.vx) + rnd(-0.4, 0.4); b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.idle = 0; }
    const steps = Math.max(1, Math.ceil(sp * dt / 4)), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      b.x += b.vx * h; b.y += b.vy * h;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); A.wall(); }
      else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); A.wall(); }
      if (b.y < TOP + b.r) { b.y = TOP + b.r; b.vy = Math.abs(b.vy); A.wall(); }
      if (b.vy > 0 && b.y + b.r >= pad.y && b.y - b.r < pad.y + pad.h && b.x > pad.x - pad.w / 2 - b.r && b.x < pad.x + pad.w / 2 + b.r) {
        const off = clamp((b.x - pad.x) / (pad.w / 2), -1, 1);
        const a = clamp(off * 1.05 + clamp(pad.vx / 4000, -0.15, 0.15) + (demo ? rnd(-0.6, 0.6) : 0), -1.2, 1.2);
        b.vx = Math.sin(a) * sp; b.vy = -Math.cos(a) * sp; b.y = pad.y - b.r; b.idle = 0;
        pad.squash = 1; A.paddle(); burst(b.x, pad.y, '#8ef', 6, 140, 0.3, 2);
      }
      if (T.shield > 0 && b.vy > 0 && b.y + b.r > H - 10) {
        b.y = H - 10 - b.r; b.vy = -Math.abs(b.vy); A.wall(); burst(b.x, H - 10, '#8bf', 10, 200, 0.4, 3);
      }
      if (boss && hitRect(b, boss.x - boss.w / 2, boss.y, boss.w, boss.h)) { b.idle = 0; damageBoss(T.fire > 0 ? 2 : 1, b.x, b.y); }
      ballBricks(b);
      if (b.y > H + 24) { b.dead = true; break; }
    }
    b.trail.push(b.x, b.y); if (b.trail.length > 24) b.trail.splice(0, 2);
  }
  if (balls.some(b => b.dead)) balls = balls.filter(b => !b.dead);
  if (!balls.length) loseBall();

  // lasers
  if (T.laser > 0 && !balls.some(b => b.stuck)) {
    laserCd -= dt;
    if (laserCd <= 0) { laserCd = 0.26; A.laser(); bolts.push({ x: pad.x - pad.w / 2 + 8, y: pad.y }, { x: pad.x + pad.w / 2 - 8, y: pad.y }); }
  }
  for (const o of bolts) {
    o.y -= 950 * dt;
    const r = Math.floor((o.y - OY) / CH), c = Math.floor((o.x - OX) / CW), br = grid[r] && grid[r][c];
    if (br && o.y <= br.y + BH && o.x >= br.x && o.x <= br.x + BW) { o.dead = true; hitBrick(br, 1); burst(o.x, o.y, '#f88', 4, 120, 0.25, 2); }
    else if (boss && o.x > boss.x - boss.w / 2 && o.x < boss.x + boss.w / 2 && o.y < boss.y + boss.h) { o.dead = true; damageBoss(0.5, o.x, o.y); }
    else if (o.y < TOP) o.dead = true;
  }
  bolts = bolts.filter(o => !o.dead);

  // capsules
  for (const c of capsules) {
    c.y += 165 * dt; c.t += dt * 3;
    if (c.y > pad.y - 10 && c.y < pad.y + pad.h + 10 && Math.abs(c.x - pad.x) < pad.w / 2 + 22) { c.dead = true; applyPower(c.type); }
    else if (c.y > H + 20) c.dead = true;
  }
  capsules = capsules.filter(c => !c.dead);

  // boss
  if (boss) {
    boss.t += dt; boss.flash = Math.max(0, boss.flash - dt * 4);
    boss.x = W / 2 + Math.sin(boss.t * 0.7) * 320;
    boss.fire -= dt;
    if (boss.fire <= 0 && !balls.some(b => b.stuck)) {
      boss.fire = 1.3 + 1.5 * (boss.hp / boss.max);
      const a = Math.atan2(pad.y - boss.y - boss.h, pad.x - boss.x), n = boss.spread;
      for (let i = 0; i < n; i++) { const aa = a + (i - (n - 1) / 2) * 0.32; sparks.push({ x: boss.x, y: boss.y + boss.h, vx: Math.cos(aa) * 260, vy: Math.sin(aa) * 260 }); }
      A.zap();
    }
  }
  for (const s of sparks) {
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (Math.random() < 0.5) parts.push({ x: s.x, y: s.y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.3, max: 0.3, size: 2, col: '#f58' });
    if (s.y > pad.y - 6 && s.y < pad.y + pad.h + 6 && Math.abs(s.x - pad.x) < pad.w / 2 + 6) {
      s.dead = true; burst(s.x, s.y, '#f58', 20, 300, 0.5, 3);
      if (!demo) { pad.stun = 0.9; shake = 10; combo = 0; A.bad(); floatText(pad.x, pad.y - 22, 'STUNNED', '#f68', 18); }
    } else if (s.y > H + 20 || s.x < -20 || s.x > W + 20) s.dead = true;
  }
  sparks = sparks.filter(s => !s.dead);

  // delayed hits
  if (pending.length) {
    const due = [];
    pending = pending.filter(p => { if ((p.t -= dt) <= 0) { due.push(p); return false; } return true; });
    for (const p of due) if (!p.br.dead) hitBrick(p.br, p.dmg);
  }
  for (const br of bricks) { br.age += dt; if (br.flash > 0) br.flash = Math.max(0, br.flash - dt * 5); }

  // fx
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.vx *= 1 - dt * 1.5; p.life -= dt; }
  parts = parts.filter(p => p.life > 0);
  for (const t of texts) { t.y -= 36 * dt; t.life -= dt; }
  texts = texts.filter(t => t.life > 0);
  for (const r of rings) r.life -= dt;
  rings = rings.filter(r => r.life > 0);
  shake = Math.max(0, shake - dt * 40); flash = Math.max(0, flash - dt * 1.6); toastT -= dt;
  dispScore += (score - dispScore) * Math.min(1, dt * 10);

  if (!cleared && (!bossLevel || bossDead) && !pending.length && !bricks.some(b => b.type !== 's')) {
    cleared = true; clearT = 1.5; A.clear(); flash = Math.max(flash, 0.3);
    for (const c of capsules) burst(c.x, c.y, POW[c.type].col, 10);
    capsules = []; sparks = [];
    if (!demo) floatText(W / 2, H / 2 - 40, 'SECTOR CLEAR', '#fff', 44, 1.5);
  }
}

/* ---------------- Render ---------------- */
function txt(s, x, y, size, col, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function render(now) {
  const K = cv.width / W;
  ctx.setTransform(K, 0, 0, K, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(bg, 0, 0);
  const st = now / 1000;
  // stars
  ctx.fillStyle = '#fff';
  for (const s of stars) {
    const y = (s.y + st * 14 * s.z) % H;
    ctx.globalAlpha = 0.25 + 0.5 * s.z * (0.6 + 0.4 * Math.sin(st * 2 + s.p));
    ctx.fillRect(s.x, y, s.z * 2, s.z * 2);
  }
  ctx.globalAlpha = 1;
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-shake, shake) * 0.6, rnd(-shake, shake) * 0.6);

  // combo backdrop
  if (combo >= 4 && !demo) {
    const mult = Math.min(8, 1 + Math.floor(combo / 4));
    ctx.globalAlpha = 0.07 + 0.1 * clamp(comboT / 2.6, 0, 1);
    ctx.textBaseline = 'middle';
    txt('×' + mult, W / 2, 500, 220, `hsl(${300 - mult * 25},90%,70%)`, 'center', 800);
    ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
  }

  // barrier
  if (T.shield > 0) {
    const a = T.shield < 3 ? 0.4 + 0.6 * Math.abs(Math.sin(st * 12)) : 0.75 + 0.25 * Math.sin(st * 5);
    ctx.globalAlpha = a; ctx.shadowColor = '#6af'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#aef'; ctx.fillRect(0, H - 10, W, 3);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  // bricks
  for (const br of bricks) {
    if (br.age < 0) continue;
    const spr = brickSprite(br), k = br.age < 0.3 ? easeBack(br.age / 0.3) : 1;
    const cx = br.x + BW / 2, cy = br.y + BH / 2, w = (BW + SP * 2) * k, h = (BH + SP * 2) * k;
    ctx.drawImage(spr, cx - w / 2, cy - h / 2, w, h);
    if (br.type === 'x') { ctx.globalAlpha = 0.25 + 0.25 * Math.sin(st * 8 + br.c); ctx.fillStyle = '#ffd'; rr(ctx, br.x, br.y, BW, BH, 5); ctx.fill(); ctx.globalAlpha = 1; }
    if (br.type === 'p') { ctx.globalAlpha = 0.2 + 0.2 * Math.sin(st * 4 + br.c * 0.7); ctx.fillStyle = '#fff'; rr(ctx, br.x, br.y, BW, BH, 5); ctx.fill(); ctx.globalAlpha = 1; }
    if (br.flash > 0) { ctx.globalAlpha = br.flash * 0.8; ctx.fillStyle = '#fff'; rr(ctx, br.x, br.y, BW, BH, 5); ctx.fill(); ctx.globalAlpha = 1; }
  }

  // boss
  if (boss) {
    const x = boss.x - boss.w / 2, y = boss.y + Math.sin(boss.t * 3) * 2, hpk = boss.hp / boss.max;
    ctx.shadowColor = '#f36'; ctx.shadowBlur = 24;
    const g = ctx.createLinearGradient(0, y, 0, y + boss.h);
    g.addColorStop(0, '#5a2148'); g.addColorStop(1, '#1c0d2c');
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(x + 18, y); ctx.lineTo(x + boss.w - 18, y); ctx.lineTo(x + boss.w, y + boss.h / 2); ctx.lineTo(x + boss.w - 24, y + boss.h);
    ctx.lineTo(x + 24, y + boss.h); ctx.lineTo(x, y + boss.h / 2); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#f69'; ctx.lineWidth = 2; ctx.stroke();
    // eye
    const ex = boss.x, ey = y + boss.h / 2, tb = balls[0];
    let lx = 0, ly = 0;
    if (tb) { const a = Math.atan2(tb.y - ey, tb.x - ex); lx = Math.cos(a) * 7; ly = Math.sin(a) * 5; }
    ctx.fillStyle = '#fde'; ctx.beginPath(); ctx.ellipse(ex, ey, 26, 15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = hpk < 0.35 ? '#f20' : '#c0144e'; ctx.beginPath(); ctx.arc(ex + lx, ey + ly, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#100'; ctx.beginPath(); ctx.arc(ex + lx, ey + ly, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f69';
    for (const sx of [-58, 58]) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(st * 6 + sx); ctx.fillRect(ex + sx - 8, ey - 3, 16, 6); }
    ctx.globalAlpha = 1;
    if (boss.flash > 0) { ctx.globalAlpha = boss.flash * 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(x, y, boss.w, boss.h); ctx.globalAlpha = 1; }
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x + 10, y - 12, boss.w - 20, 5);
    ctx.fillStyle = hpk < 0.35 ? '#f44' : '#f7a'; ctx.fillRect(x + 10, y - 12, (boss.w - 20) * clamp(hpk, 0, 1), 5);
  }

  // capsules
  ctx.textBaseline = 'middle';
  for (const c of capsules) {
    const p = POW[c.type], x = c.x + Math.sin(c.t) * 4;
    ctx.shadowColor = p.col; ctx.shadowBlur = 12; ctx.fillStyle = p.col;
    rr(ctx, x - 22, c.y - 10, 44, 20, 10); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(ctx, x - 19, c.y - 8, 38, 7, 4); ctx.fill();
    txt(c.type === 'X' ? '▼' : c.type, x, c.y + 1, 14, '#012', 'center', 800);
  }
  ctx.textBaseline = 'alphabetic';

  // additive layer
  ctx.globalCompositeOperation = 'lighter';
  for (const o of bolts) { ctx.fillStyle = '#f66'; ctx.fillRect(o.x - 2, o.y - 12, 4, 16); ctx.fillStyle = '#fff'; ctx.fillRect(o.x - 1, o.y - 10, 2, 10); }
  for (const s of sparks) ctx.drawImage(sparkSpr, s.x - 16, s.y - 16, 32, 32);
  for (const p of parts) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.col; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1;
  for (const r of rings) {
    const k = 1 - r.life / r.max;
    ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = r.col; ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.15 + 0.85 * k), 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const spr = T.fire > 0 ? fireSpr : ballSpr;
  for (const b of balls) {
    const n = b.trail.length / 2;
    for (let i = 0; i < n; i++) { const k = (i + 1) / n, s = 8 + 14 * k; ctx.globalAlpha = k * 0.35; ctx.drawImage(spr, b.trail[i * 2] - s / 2, b.trail[i * 2 + 1] - s / 2, s, s); }
    ctx.globalAlpha = 1;
    const s = T.fire > 0 ? 44 : 34; ctx.drawImage(spr, b.x - s / 2, b.y - s / 2, s, s);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const b of balls) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 1.5, 0, TAU); ctx.fill(); }

  // paddle
  {
    const sq = pad.squash, w = pad.w * (1 + sq * 0.06), h = pad.h * (1 - sq * 0.2);
    const x = pad.x - w / 2 + (pad.stun > 0 ? rnd(-3, 3) : 0), y = pad.y + sq * 3;
    const hue = pad.stun > 0 ? 0 : T.fire > 0 ? 30 : T.laser > 0 ? 350 : T.shrink > 0 ? 240 : 190, sat = pad.stun > 0 ? 0 : 95;
    ctx.shadowColor = `hsl(${hue},${sat}%,60%)`; ctx.shadowBlur = 20;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `hsl(${hue},${sat}%,82%)`); g.addColorStop(0.5, `hsl(${hue},${sat}%,52%)`); g.addColorStop(1, `hsl(${hue + 30},${sat}%,28%)`);
    ctx.fillStyle = g; rr(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.55)'; rr(ctx, x + 8, y + 2.5, w - 16, 3, 1.5); ctx.fill();
    ctx.fillStyle = `hsla(${hue + 150},90%,70%,${0.6 + 0.4 * Math.sin(st * 8)})`;
    ctx.fillRect(pad.x - 10, y + h - 5, 20, 2.5);
    if (T.laser > 0) { ctx.fillStyle = '#fbb'; ctx.fillRect(x + 5, y - 6, 6, 8); ctx.fillRect(x + w - 11, y - 6, 6, 8); }
    if (surge >= 100 && !demo) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(st * 10); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rr(ctx, x - 4, y - 4, w + 8, h + 8, h / 2 + 4); ctx.stroke(); ctx.globalAlpha = 1; }
  }

  // floating text
  for (const t of texts) {
    const k = t.life / t.max; ctx.globalAlpha = clamp(k * 2, 0, 1);
    txt(t.txt, t.x, t.y, t.size * (1 + (1 - k) * 0.25), t.col, 'center', 800);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (!demo) drawHud(st);
  if (flash > 0) { ctx.globalAlpha = flash; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
function easeBack(t) { const c = 1.9; t = clamp(t, 0, 1) - 1; return 1 + (c + 1) * t * t * t + c * t * t; }
function drawHud(st) {
  ctx.fillStyle = 'rgba(4,4,18,.72)'; ctx.fillRect(0, 0, W, TOP - 2);
  ctx.shadowColor = `hsl(${levelHue},90%,60%)`; ctx.shadowBlur = 12;
  ctx.fillStyle = `hsl(${levelHue},90%,72%)`; ctx.fillRect(0, TOP - 3, W, 2); ctx.shadowBlur = 0;
  txt('SCORE', 24, 20, 11, '#8ac'); txt(Math.round(dispScore).toLocaleString(), 24, 48, 26, '#fff', 'left', 700);
  txt('BEST', 190, 20, 11, '#8ac'); txt(Math.max(hi, score).toLocaleString(), 190, 46, 18, '#fd8');
  const def = LEVELS[levelIdx % LEVELS.length];
  txt(`SECTOR ${String(levelIdx + 1).padStart(2, '0')} · ${def.name.toUpperCase()}`, W / 2, 20, 12, '#bdf', 'center');
  // nova meter
  const mw = 260, mx = W / 2 - mw / 2, my = 32, full = surge >= 100;
  ctx.fillStyle = 'rgba(120,150,255,.15)'; rr(ctx, mx, my, mw, 14, 7); ctx.fill();
  if (surge > 2) {
    const g = ctx.createLinearGradient(mx, 0, mx + mw, 0);
    g.addColorStop(0, '#48f'); g.addColorStop(0.6, '#c6f'); g.addColorStop(1, '#fff');
    ctx.fillStyle = g; if (full) { ctx.shadowColor = '#c8f'; ctx.shadowBlur = 10 + 8 * Math.sin(st * 10); }
    rr(ctx, mx, my, Math.max(14, mw * surge / 100), 14, 7); ctx.fill(); ctx.shadowBlur = 0;
  }
  txt(full ? 'NOVA READY' : 'NOVA', W / 2, my + 11, 10, full ? '#102' : '#cdf', 'center', 800);
  // lives
  txt('LIVES', W - 24, 20, 11, '#8ac', 'right');
  for (let i = 0; i < lives; i++) { ctx.fillStyle = '#6df'; rr(ctx, W - 50 - i * 32, 34, 26, 8, 4); ctx.fill(); }
  // combo
  if (combo > 1) {
    const mult = Math.min(8, 1 + Math.floor(combo / 4));
    txt(`COMBO ${combo}` + (mult > 1 ? `  ×${mult}` : ''), W - 16, H - 14, 13, '#f9f', 'right', 700);
    ctx.fillStyle = '#f9f'; ctx.fillRect(W - 16 - 90 * clamp(comboT / 2.6, 0, 1), H - 9, 90 * clamp(comboT / 2.6, 0, 1), 2);
  }
  // timers
  let i = 0;
  const tl = [['wide', 'WIDE', '#4df', 14], ['laser', 'LASER', '#f66', 9], ['slow', 'SLOW', '#8f8', 9], ['fire', 'FIRE', '#fa3', 8], ['shield', 'BARRIER', '#7af', 13], ['shrink', 'SHRINK', '#99a', 9]];
  for (const [k, name, col, max] of tl) if (T[k] > 0) {
    const y = H - 22 - i * 18; i++;
    ctx.globalAlpha = 0.85; ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, 10, y, 84, 13, 6); ctx.fill();
    ctx.fillStyle = col; rr(ctx, 10, y, Math.max(12, 84 * T[k] / max), 13, 6); ctx.fill();
    txt(name, 52, y + 10, 9, '#012', 'center', 800); ctx.globalAlpha = 1;
  }
  // banner
  if (bannerT > 0) {
    const a = clamp(bannerT, 0, 1) * clamp((2.6 - bannerT) * 3, 0, 1);
    ctx.globalAlpha = a;
    txt(`SECTOR ${levelIdx + 1}`, W / 2, 430, 20, '#9cf', 'center');
    txt(def.name.toUpperCase(), W / 2, 480, 46, '#fff', 'center', 800);
    if (def.boss) txt('⚠ DESTROY THE CORE ⚠', W / 2, 515, 16, '#f68', 'center', 700);
    ctx.globalAlpha = 1;
  }
  if (balls.length && balls[0].stuck && bannerT < 1.2 && state === 'play') {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(st * 5);
    txt('CLICK or SPACE to launch', W / 2, 600, 15, '#cef', 'center'); ctx.globalAlpha = 1;
  }
  if (toastT > 0) { ctx.globalAlpha = clamp(toastT, 0, 1); txt(toast, W / 2, 660, 14, '#fff', 'center', 700); ctx.globalAlpha = 1; }
}

/* ---------------- UI / flow ---------------- */
function showPanel(html, primary) { panel.innerHTML = html; primaryAct = primary; ui.classList.add('show'); }
function setState(s) {
  state = s;
  if (s === 'play') ui.classList.remove('show');
  wrap.classList.toggle('playing', s === 'play');
}
function menuPanel() {
  const caps = POW_KEYS.map(k => `<span><i class="cap" style="background:${POW[k].col}">${k === 'X' ? '▼' : k}</i>${POW[k].name}</span>`).join('');
  showPanel(`<h1>NOVABREAK</h1>
    <div class="tag">shatter the constellations</div>
    <button data-act="start">Launch</button>
    ${hi ? `<div class="dim gold">BEST ${hi.toLocaleString()}</div>` : ''}
    <div class="grid">${caps}</div>
    <div class="dim"><kbd>MOUSE</kbd> / <kbd>←</kbd><kbd>→</kbd> move &nbsp;·&nbsp; <kbd>CLICK</kbd> / <kbd>SPACE</kbd> launch &amp; unleash NOVA<br>
    <kbd>P</kbd> pause &nbsp;·&nbsp; <kbd>M</kbd> sound &nbsp;·&nbsp; <kbd>F</kbd> fullscreen<br>
    Chain hits to build your combo and charge the NOVA meter.</div>`, 'start');
}
function pause() {
  if (state !== 'play') return;
  showPanel(`<h2>PAUSED</h2><button data-act="resume">Resume</button><br>
    <button class="alt" data-act="start">Restart</button><button class="alt" data-act="menu">Title</button>
    <div class="dim" style="margin-top:1em"><kbd>M</kbd> sound · <kbd>F</kbd> fullscreen</div>`, 'resume');
  setState('paused');
}
function act(a) {
  A.init();
  if (a === 'start') newGame();
  else if (a === 'resume') setState('play');
  else if (a === 'next') { loadLevel(levelIdx + 1); setState('play'); }
  else if (a === 'menu') { toMenu(); menuPanel(); }
}
document.addEventListener('click', e => {
  const b = e.target && e.target.closest && e.target.closest('[data-act]');
  if (b) act(b.dataset.act);
});
function toCanvasX(e) { const r = cv.getBoundingClientRect(); return (e.clientX - r.left) * W / (r.width || 1); }
let tStart = 0, tX = 0;
window.addEventListener('pointermove', e => { mouseX = toCanvasX(e); useKeys = false; });
cv.addEventListener('pointerdown', e => {
  A.init(); mouseX = toCanvasX(e); useKeys = false;
  if (e.pointerType === 'touch') { tStart = performance.now(); tX = e.clientX; }
  else action();
});
cv.addEventListener('pointerup', e => {
  if (e.pointerType === 'touch' && performance.now() - tStart < 240 && Math.abs(e.clientX - tX) < 14) action();
});
cv.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  const k = e.code;
  if (k === 'ArrowLeft' || k === 'KeyA') keys.left = true;
  else if (k === 'ArrowRight' || k === 'KeyD') keys.right = true;
  else if (k === 'Space' || k === 'Enter') {
    e.preventDefault(); if (e.repeat) return;
    A.init();
    if (state === 'play') action(); else act(primaryAct);
  }
  else if (k === 'KeyP' || k === 'Escape') { if (state === 'play') pause(); else if (state === 'paused') setState('play'); }
  else if (k === 'KeyM') { A.init(); say(A.cycle()); }
  else if (k === 'KeyF') { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); }
});
window.addEventListener('keyup', e => {
  const k = e.code;
  if (k === 'ArrowLeft' || k === 'KeyA') keys.left = false;
  else if (k === 'ArrowRight' || k === 'KeyD') keys.right = false;
});
window.addEventListener('blur', () => { keys.left = keys.right = false; pause(); });
function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  const cw = Math.floor(W * s), ch = Math.floor(H * s), dpr = Math.min(window.devicePixelRatio || 1, 2);
  wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px'; wrap.style.fontSize = (16 * s) + 'px';
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
}
window.addEventListener('resize', resize);

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.033, (now - last) / 1000 || 0); last = now;
  if (state === 'play' || state === 'menu') {
    let g = dt;
    if (clearT > 0) {
      g *= 0.4; clearT -= dt;
      if (clearT <= 0) { clearT = 0; levelDone(); }
    }
    if (state === 'play' || state === 'menu') update(g);
  }
  render(now);
}
resize(); toMenu(); menuPanel();
requestAnimationFrame(frame);
})();
