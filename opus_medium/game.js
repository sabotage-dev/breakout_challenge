/* PRISM BREAK — a neon brick odyssey
 * Pure HTML5 canvas + WebAudio. No external assets. */
'use strict';
(() => {

// ============================================================ setup
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 960, H = 720;
let baseT = 1;

function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H) * 0.98;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
  canvas.width = Math.floor(W * s * dpr);
  canvas.height = Math.floor(H * s * dpr);
  baseT = s * dpr;
}
window.addEventListener('resize', resize);
resize();

const FONT = '"Avenir Next", "Segoe UI", "Helvetica Neue", "Trebuchet MS", system-ui, sans-serif';
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = n => Math.round(n).toLocaleString('en-US');
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// ============================================================ audio
const SFX = (() => {
  let ac = null, master, sfxBus, musicBus, noiseBuf;
  let muted = localStorage.getItem('pb_muted') === '1';
  let musicOn = localStorage.getItem('pb_music') !== '0';
  let sfxOn = true;
  let nextNote = 0, step = 0, intensity = 0;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.6;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.3 : 0; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextNote = ac.currentTime + 0.1;
    setInterval(schedule, 25);
  }

  function voice(t, f, dur, type, vol, f2, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noiseAt(t, dur, vol, ftype, freq, dest) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = rand(0.8, 1.2);
    const fl = ac.createBiquadFilter(); fl.type = ftype; fl.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  const ok = () => ac && sfxOn && !muted;
  function tone(f, dur, type = 'square', vol = 0.15, f2 = 0, delay = 0) {
    if (!ok()) return;
    voice(ac.currentTime + delay, f, dur, type, vol, f2, sfxBus);
  }
  function noise(dur, vol, ftype = 'lowpass', freq = 1200, delay = 0) {
    if (!ok()) return;
    noiseAt(ac.currentTime + delay, dur, vol, ftype, freq, sfxBus);
  }

  // ---- procedural synthwave loop
  const BPM = 116, S16 = 60 / BPM / 4;
  const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
  function schedule() {
    if (!ac) return;
    while (nextNote < ac.currentTime + 0.15) {
      playStep(step, nextNote);
      nextNote += S16;
      step = (step + 1) % 64;
    }
  }
  function playStep(s, t) {
    if (!musicOn || muted) return;
    const chord = PROG[Math.floor(s / 16)], i = s % 16;
    if (i % 4 === 0) voice(t, 130, 0.2, 'sine', 0.55, 42, musicBus);
    if (intensity > 0 && (i === 4 || i === 12)) noiseAt(t, 0.14, 0.22, 'bandpass', 1900, musicBus);
    if (i % 2 === 1) noiseAt(t, 0.035, 0.07, 'highpass', 7500, musicBus);
    if (i % 2 === 0) voice(t, mtof(chord[0] - 24 + (i % 4 === 2 ? 12 : 0)), S16 * 1.7, 'triangle', 0.3, 0, musicBus);
    const arp = [0, 1, 2, 1, 2, 1, 0, 2];
    voice(t, mtof(chord[arp[i % 8]] + 12), S16 * 0.9, 'square', intensity > 0 ? 0.035 : 0.022, 0, musicBus);
    if (intensity > 1 && i % 2 === 1) voice(t, mtof(chord[arp[(i + 3) % 8]] + 24), S16 * 0.6, 'sawtooth', 0.018, 0, musicBus);
    if (i === 0) for (const n of chord) voice(t, mtof(n), S16 * 15, 'triangle', 0.035, 0, musicBus);
  }

  return {
    init,
    get muted() { return muted; },
    get musicOn() { return musicOn; },
    setSfx(v) { sfxOn = v; },
    setIntensity(v) { intensity = v; },
    toggleMute() {
      muted = !muted; localStorage.setItem('pb_muted', muted ? '1' : '0');
      if (master) master.gain.value = muted ? 0 : 0.6;
    },
    toggleMusic() {
      musicOn = !musicOn; localStorage.setItem('pb_music', musicOn ? '1' : '0');
      if (musicBus) musicBus.gain.value = musicOn ? 0.3 : 0;
    },
    duck(v) { if (musicBus && musicOn) musicBus.gain.value = v ? 0.08 : 0.3; },
    brick(c) {
      const sc = [0, 2, 4, 7, 9];
      const k = Math.min(c, 30);
      const m = 69 + sc[k % 5] + 12 * Math.min(2, Math.floor(k / 5));
      tone(mtof(m), 0.16, 'square', 0.07);
      tone(mtof(m + 12), 0.1, 'triangle', 0.08);
    },
    hard() { tone(330, 0.08, 'triangle', 0.18, 260); noise(0.05, 0.08, 'highpass', 3000); },
    steel() { tone(1400, 0.07, 'square', 0.05, 1100); tone(2100, 0.12, 'sine', 0.06); },
    paddle() { tone(240, 0.09, 'square', 0.08, 360); tone(120, 0.08, 'sine', 0.2); },
    wall() { tone(620, 0.03, 'triangle', 0.06); },
    explode() { noise(0.45, 0.5, 'lowpass', 900); tone(140, 0.4, 'sine', 0.4, 35); },
    power(good) {
      const notes = good ? [72, 76, 79, 84] : [64, 60, 55, 50];
      notes.forEach((n, i) => tone(mtof(n), 0.12, good ? 'square' : 'sawtooth', 0.07, 0, i * 0.055));
    },
    laser() { tone(1500, 0.07, 'square', 0.025, 500); },
    die() { tone(520, 0.9, 'sawtooth', 0.12, 50); noise(0.6, 0.3, 'lowpass', 600); },
    launch() { tone(440, 0.1, 'square', 0.06, 880); },
    clear() { [72, 76, 79, 84, 88].forEach((n, i) => { tone(mtof(n), 0.25, 'square', 0.06, 0, i * 0.08); tone(mtof(n - 12), 0.25, 'triangle', 0.1, 0, i * 0.08); }); },
    gameover() { [69, 65, 62, 57, 45].forEach((n, i) => tone(mtof(n), 0.4, 'sawtooth', 0.07, 0, i * 0.18)); },
    victory() { [60, 64, 67, 72, 67, 72, 76, 79, 84].forEach((n, i) => { tone(mtof(n), 0.3, 'square', 0.06, 0, i * 0.11); tone(mtof(n + 7), 0.3, 'triangle', 0.06, 0, i * 0.11); }); },
    bossHit() { tone(180, 0.18, 'sawtooth', 0.14, 70); noise(0.12, 0.2, 'bandpass', 900); },
    bossShoot() { tone(900, 0.18, 'sawtooth', 0.04, 200); },
    bossRoar() { tone(90, 1.0, 'sawtooth', 0.2, 45); tone(95, 1.0, 'square', 0.1, 40); noise(0.8, 0.2, 'lowpass', 400); },
    bossDie() { for (let i = 0; i < 8; i++) { noise(0.5, 0.35, 'lowpass', 700, i * 0.22); tone(rand(80, 200), 0.4, 'sine', 0.3, 30, i * 0.22); } },
    zap() { tone(1800, 0.25, 'sawtooth', 0.08, 120); noise(0.2, 0.15, 'highpass', 4000); },
    pulse() { tone(200, 0.5, 'sine', 0.35, 1200); noise(0.4, 0.2, 'bandpass', 1500); },
    extra() { [72, 79, 84, 91].forEach((n, i) => tone(mtof(n), 0.18, 'triangle', 0.12, 0, i * 0.07)); },
    barrier() { tone(880, 0.25, 'sine', 0.15, 440); },
    summon() { tone(200, 0.5, 'triangle', 0.15, 600); },
  };
})();

// ============================================================ constants
const COLS = 14, BW = 62, BH = 24, PX = 66, PY = 28, GX = 20, GY = 76, TOP = 56;
const PADDLE_Y = H - 56;
const BARRIER_Y = H - 16;
const MAX_SPEED = 780;
const DROP_CHANCE = 0.13;
const PALETTE = [345, 25, 50, 145, 190, 265];

const PU_TYPES = [
  { id: 'multi',   label: 'M', hue: 190, name: 'MULTIBALL', desc: 'splits every ball in three', w: 12 },
  { id: 'expand',  label: 'E', hue: 130, name: 'EXPAND',    desc: 'a much wider paddle', w: 11 },
  { id: 'laser',   label: 'L', hue: 0,   name: 'LASERS',    desc: 'auto-firing twin cannons', w: 8 },
  { id: 'catch',   label: 'C', hue: 55,  name: 'MAGNET',    desc: 'catch the ball, aim, release', w: 8 },
  { id: 'slow',    label: 'S', hue: 205, name: 'SLOW-MO',   desc: 'calms every ball down', w: 8 },
  { id: 'fire',    label: 'F', hue: 25,  name: 'FIREBALL',  desc: 'melts through anything', w: 6 },
  { id: 'barrier', label: 'B', hue: 275, name: 'BARRIER',   desc: 'one-time safety net', w: 7 },
  { id: 'pulse',   label: 'P', hue: 315, name: 'SHOCKWAVE', desc: 'blasts bricks near each ball', w: 6 },
  { id: 'life',    label: '+', hue: 340, name: 'EXTRA LIFE',desc: 'one more try', w: 2 },
  { id: 'shrink',  label: '−', hue: 0,   name: 'SHRINK',    desc: 'tiny paddle — avoid!', w: 5, bad: true },
  { id: 'speed',   label: '»', hue: 0,   name: 'OVERDRIVE', desc: 'faster balls — avoid!', w: 5, bad: true },
];

// Level legend: 1-6 colour bricks, T tough(2), U ultra(3), S steel, X explosive, ? mystery
const LEVELS = [
  { name: 'FIRST LIGHT', hue: 220, rows: [
    '',
    '11111111111111',
    '22222222222222',
    '333?333333?333',
    '44444444444444',
    '55555555555555',
    '66666666666666',
  ]},
  { name: 'THE PYRAMID', hue: 280, rows: [
    '',
    '......XX......',
    '.....1111.....',
    '....222222....',
    '...333?3333...',
    '..4444444444..',
    '.555555555555.',
    'TTTTTTTTTTTTTT',
  ]},
  { name: 'CITADEL', hue: 190, rows: [
    '',
    'SS.SS....SS.SS',
    'S1?1S....S1?1S',
    'S1X1S2222S1X1S',
    'STTTSTTTTSTTTS',
    '',
    '33333333333333',
    '44444444444444',
    '55555555555555',
  ]},
  { name: 'CHECKMATE', hue: 320, rows: [
    '',
    '1.2.3.4.5.6.1.',
    '.2.3.4.5.6.1.2',
    'X.T.X.T.X.T.X.',
    '.T.X.T.X.T.X.T',
    '4.5.6.1.2.3.4.',
    '.5.6.?.2.3.4.5',
    'U.U.U.U.U.U.U.',
  ]},
  { name: 'THE WARDEN', hue: 0, boss: { name: 'THE WARDEN', hp: 22, fire: 1.9, w: 200, speed: 0.55 }, rows: [
    '', '', '', '', '',
    '..TTTTTTTTTT..',
    '1.2.3.44.3.2.1',
  ]},
  { name: 'DIAMOND HEART', hue: 170, rows: [
    '',
    '......??......',
    '.....1221.....',
    '....123321....',
    '...12344321...',
    '..1234554321..',
    '.123456654321.',
    '..1234554321..',
    '...12344321...',
    '....123321....',
    '.....1XX1.....',
  ]},
  { name: 'CHAIN REACTION', hue: 20, rows: [
    '',
    '66666666666666',
    'X555X5555X555X',
    '44X44X44X44X44',
    'TTTTTTTTTTTTTT',
    '3X33X33X33X33X',
    '22222222222222',
    'U.U.U.??.U.U.U',
  ]},
  { name: 'LABYRINTH', hue: 140, rows: [
    'UUUUUUUUUUUUUU',
    'S............S',
    'S.SSSS..SSSS.S',
    'S.4?44..44?4.S',
    'S.SSSS..SSSS.S',
    'S............S',
    '55555555555555',
    'TTTTTTTTTTTTTT',
  ]},
  { name: 'HEARTBEAT', hue: 330, rows: [
    '',
    '..111....111..',
    '.11111..11111.',
    '11111111111111',
    '111T?1111?T111',
    '.111TTTTTT111.',
    '..1111111111..',
    '...11111111...',
    '....111111....',
    '.....1XX1.....',
    '......11......',
  ]},
  { name: 'THE MONOLITH', hue: 260, boss: { name: 'THE MONOLITH', hp: 40, fire: 1.45, w: 250, speed: 0.7 }, rows: [
    '', '', '', '', '',
    'S.TTTTTTTTTT.S',
    'S.UUU?UU?UUU.S',
    '',
    'X..X..XX..X..X',
  ]},
];

const ENDLESS_NAMES = ['NEON DRIFT', 'GLASS STORM', 'VOID GARDEN', 'STATIC BLOOM', 'HOLLOW STAR', 'PHASE SHIFT',
  'RED SHIFT', 'ECHO CHAMBER', 'IRON RAIN', 'SOLAR WIND', 'NULL SECTOR', 'DEEP SIGNAL', 'AFTERGLOW', 'FRACTURE'];

function genLevel(n) {
  let s = (n * 7919 + 1013) % 2147483647;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const isBoss = n % 5 === 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    const rows = [];
    const lead = isBoss ? 5 : 1;
    for (let r = 0; r < lead; r++) rows.push('');
    const R = isBoss ? 4 : Math.min(10, 6 + Math.floor(n / 2));
    const mode = Math.floor(rnd() * 4);
    const pSteel = Math.min(0.12, 0.02 + n * 0.008);
    const pU = Math.min(0.2, 0.02 * n), pT = Math.min(0.25, 0.06 + 0.02 * n);
    let breakable = 0;
    for (let r = 0; r < R; r++) {
      let half = '';
      for (let c = 0; c < 7; c++) {
        const v = rnd();
        let ch;
        if (v < 0.16) ch = '.';
        else if (v < 0.16 + pSteel) ch = 'S';
        else if (v < 0.21 + pSteel) ch = 'X';
        else if (v < 0.24 + pSteel) ch = '?';
        else if (v < 0.24 + pSteel + pU) ch = 'U';
        else if (v < 0.24 + pSteel + pU + pT) ch = 'T';
        else {
          const idx = mode === 0 ? r : mode === 1 ? c : mode === 2 ? r + c : Math.abs(3 - c) + r;
          ch = String((idx % 6) + 1);
        }
        if (ch !== '.' && ch !== 'S') breakable++;
        half += ch;
      }
      rows.push(half + half.split('').reverse().join(''));
    }
    if (breakable >= 10 || attempt === 19) {
      return {
        name: ENDLESS_NAMES[(n - 1) % ENDLESS_NAMES.length],
        hue: Math.floor(rnd() * 360),
        rows,
        boss: isBoss ? { name: 'OVERSEER MK-' + (n / 5), hp: 36 + n * 3, fire: Math.max(0.8, 1.6 - n * 0.04), w: 230, speed: 0.75 } : null,
      };
    }
  }
}

// ============================================================ state
let state = 'title'; // title | play | paused | clear | gameover | victory
let demo = true;
let time = 0;
let score = 0, displayScore = 0;
let hiscore = +(localStorage.getItem('pb_hi') || 0);
let lives = 3, levelIndex = 0, level = null, levelTime = 0;
let bricks = [], grid = new Map(), balls = [], capsules = [], lasers = [], bolts = [];
let particles = [], texts = [], rings = [], pending = [];
let boss = null;
let combo = 0, lastMult = 1;
const effects = { expand: 0, shrink: 0, laser: 0, catch: 0, slow: 0, fire: 0 };
const EFFECT_MAX = { expand: 20, shrink: 12, laser: 12, catch: 15, slow: 10, fire: 8 };
let barrier = false;
const paddle = { x: W / 2, target: W / 2, w: 120, h: 14, y: PADDLE_Y, stun: 0, squash: 0, laserCd: 0, vx: 0 };
let shake = 0, flashScreen = 0, slowmo = 0, clearing = false, clearTimer = 0, deathTimer = 0, overTimer = 0;
let banner = null;
let themeHue = 220, themeHueTarget = 220;
let armorFailed = false;
let victoryShown = false;
let nextLife = 20000;
let clearStats = null;
let demoLaunch = 1;
let newHigh = false;
const keys = { left: false, right: false };

function saveHi() { localStorage.setItem('pb_hi', String(Math.floor(hiscore))); }

// ============================================================ helpers
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function text(str, x, y, size, color, align = 'center', weight = '700', glow = 0, glowColor) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (glow) { ctx.shadowColor = glowColor || color; ctx.shadowBlur = glow; }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  if (glow) ctx.shadowBlur = 0;
}
function addText(x, y, str, color, size = 16, life = 0.9) {
  texts.push({ x, y, str, color, size, life, max: life });
}
function setBanner(title, sub, color = '#7ff', dur = 2.4) {
  banner = { title, sub, color, t: 0, dur };
}
function levelLabel(idx = levelIndex) {
  return idx < LEVELS.length ? `SECTOR ${idx + 1} / ${LEVELS.length}` : `ENDLESS · DEPTH ${idx - LEVELS.length + 1}`;
}
function getLevelDef(idx) {
  return idx < LEVELS.length ? LEVELS[idx] : genLevel(idx - LEVELS.length + 1);
}

// ============================================================ bricks
function genCracks(br) {
  const out = [];
  for (let i = 0; i < 3; i++) {
    let x = rand(8, br.w - 8), y = rand(4, br.h - 4);
    const pts = [[x, y]];
    for (let k = 0; k < 3; k++) { x = clamp(x + rand(-12, 12), 2, br.w - 2); y = clamp(y + rand(-8, 8), 2, br.h - 2); pts.push([x, y]); }
    out.push(pts);
  }
  return out;
}
function makeBrick(ch, r, c, delay) {
  const br = { r, c, x: GX + c * PX, y: GY + r * PY, w: BW, h: BH, type: 'n', hp: 1, maxHp: 1,
    hue: 0, sat: 90, alive: true, flash: 0, wobble: 0, delay, cracks: null, color: '#fff' };
  if (ch >= '1' && ch <= '6') br.hue = PALETTE[+ch - 1];
  else if (ch === 'T') { br.hp = br.maxHp = 2; br.hue = 228; br.sat = 75; }
  else if (ch === 'U') { br.hp = br.maxHp = 3; br.hue = 292; br.sat = 70; }
  else if (ch === 'S') { br.type = 's'; br.sat = 10; br.hue = 215; }
  else if (ch === 'X') { br.type = 'x'; br.hue = 12; }
  else if (ch === '?') { br.type = '?'; br.hue = 50; }
  else return null;
  br.color = br.type === 's' ? '#c4ccd8' : `hsl(${br.hue},${br.sat}%,62%)`;
  if (br.maxHp > 1) br.cracks = genCracks(br);
  return br;
}
const isBreakable = b => b.alive && b.type !== 's';

function damageBrick(br, dmg) {
  if (!br.alive) return;
  br.flash = 1; br.wobble = 1;
  if (br.type === 's') {
    SFX.steel();
    sparks(clamp(br.x + br.w / 2, 0, W), br.y + br.h / 2, 6, '#dde');
    return;
  }
  br.hp -= dmg;
  if (br.hp <= 0) { destroyBrick(br); return; }
  SFX.hard();
  addScore(10);
  sparks(br.x + br.w / 2, br.y + br.h / 2, 8, br.color);
}

function comboMult() { return Math.min(8, 1 + Math.floor(combo / 4)); }

function destroyBrick(br) {
  if (!br.alive) return;
  br.alive = false;
  grid.delete(br.r * COLS + br.c);
  combo++;
  const m = comboMult();
  const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
  if (m > lastMult && !demo) {
    addText(cx, cy - 18, `×${m} COMBO`, `hsl(${(m * 45) % 360},100%,70%)`, 20, 1.2);
  }
  lastMult = m;
  const base = br.type === 'x' ? 120 : br.type === '?' ? 150 : br.type === 's' ? 200 : 50 * br.maxHp;
  const pts = base * m;
  addScore(pts);
  if (!demo && (m > 1 || pts >= 150)) addText(cx, cy, '+' + pts, '#fff', 13, 0.7);
  burst(br);
  SFX.brick(combo);
  shake = Math.max(shake, 2.5);
  if (br.type === '?') spawnCapsule(cx, cy, true);
  else if (Math.random() < DROP_CHANCE) spawnCapsule(cx, cy, false);
  if (br.type === 'x') explodeAt(br);
  checkClear();
}

function explodeAt(br) {
  const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
  rings.push({ x: cx, y: cy, r: 8, max: 110, life: 0.45, maxLife: 0.45, hue: 25, w: 8 });
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2), s = rand(100, 420);
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7,
      size: rand(2, 4), color: `hsl(${rand(10, 50)},100%,${rand(55, 75)}%)`, g: 0, drag: 2.5, kind: 'spark' });
  }
  shake = Math.max(shake, 9);
  flashScreen = Math.max(flashScreen, 0.15);
  SFX.explode();
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const r = br.r + dr, c = br.c + dc;
    if (r < 0 || c < 0 || c >= COLS) continue;
    pending.push({ t: 0.09, r, c });
  }
  if (boss && boss.dying <= 0 && Math.hypot(boss.x - cx, boss.y + boss.h / 2 - cy) < 160) damageBoss(3, true);
}

function checkClear() {
  if (clearing || (state !== 'play' && state !== 'title')) return;
  if (boss) return;
  if (bricks.some(isBreakable)) return;
  startClear();
}
let clearLabel = 'CLEAR!';
function startClear() {
  clearing = true;
  slowmo = 1.3;
  capsules = []; bolts = [];
  if (!demo) SFX.clear();
}
function finishClear() {
  clearing = false;
  clearLabel = 'CLEAR!';
  slowmo = 0;
  if (demo) { loadDemo(); return; }
  const bonus = 1000 * (levelIndex + 1) + lives * 250;
  clearStats = { time: levelTime, bonus, name: level.name, label: levelLabel() };
  addScore(bonus);
  saveHi();
  state = 'clear';
  clearTimer = 4.5;
}

// ============================================================ particles
function burst(br) {
  const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
  const col = br.type === '?' ? `hsl(${(time * 200) % 360},100%,65%)` : br.color;
  for (let i = 0; i < 14; i++) {
    particles.push({ x: cx + rand(-br.w / 2, br.w / 2), y: cy + rand(-br.h / 2, br.h / 2),
      vx: rand(-160, 160), vy: rand(-220, 40), life: rand(0.45, 0.95), max: 0.95,
      size: rand(3, 7), color: col, g: 700, drag: 0.5, kind: 'shard' });
  }
  sparks(cx, cy, 8, '#fff');
}
function sparks(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(80, 320);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.15, 0.4), max: 0.4,
      size: 2, color, g: 0, drag: 4, kind: 'spark' });
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    p.vx *= 1 - Math.min(1, p.drag * dt);
    p.vy *= 1 - Math.min(1, p.drag * dt);
    p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
  if (particles.length > 1400) particles.splice(0, particles.length - 1400);
  for (const t of texts) { t.life -= dt; t.y -= 40 * dt; }
  texts = texts.filter(t => t.life > 0);
  for (const r of rings) { r.life -= dt; r.r = lerp(r.max, 8, r.life / r.maxLife); }
  rings = rings.filter(r => r.life > 0);
}

// ============================================================ power-ups
function pickPU(goodOnly) {
  const list = goodOnly ? PU_TYPES.filter(p => !p.bad) : PU_TYPES;
  let total = 0; for (const p of list) total += p.w;
  let v = Math.random() * total;
  for (const p of list) { v -= p.w; if (v <= 0) return p; }
  return list[0];
}
function spawnCapsule(x, y, goodOnly) {
  if (capsules.length > 6 || clearing) return;
  capsules.push({ x, y, type: pickPU(goodOnly), vy: 150, t: rand(0, 3) });
}
function applyPU(pu) {
  const cx = paddle.x;
  switch (pu.id) {
    case 'multi': multiball(); break;
    case 'expand': effects.expand = EFFECT_MAX.expand; effects.shrink = 0; break;
    case 'shrink': effects.shrink = EFFECT_MAX.shrink; effects.expand = 0; break;
    case 'laser': effects.laser = EFFECT_MAX.laser; break;
    case 'catch': effects.catch = EFFECT_MAX.catch; break;
    case 'slow': effects.slow = EFFECT_MAX.slow; break;
    case 'fire': effects.fire = EFFECT_MAX.fire; break;
    case 'barrier': barrier = true; SFX.barrier(); break;
    case 'pulse': pulse(); break;
    case 'life':
      if (lives < 6) { lives++; SFX.extra(); } else addScore(2500);
      break;
    case 'speed': for (const b of balls) b.speed = Math.min(MAX_SPEED, b.speed * 1.25); break;
  }
  if (pu.id !== 'life') SFX.power(!pu.bad);
  addScore(100);
  addText(cx, paddle.y - 26, pu.name, pu.bad ? '#ff5a6a' : `hsl(${pu.hue},100%,70%)`, 20, 1.3);
  sparks(cx, paddle.y, 16, pu.bad ? '#f44' : `hsl(${pu.hue},100%,70%)`);
}
function multiball() {
  const src = balls.filter(b => !b.dead);
  const add = [];
  for (const b of src) {
    if (balls.length + add.length >= 12) break;
    if (b.stuck) { b.stuck = false; b.caught = false; b.dx = 0; b.dy = -1; }
    const a0 = Math.atan2(b.dx, -b.dy);
    for (const da of [-0.45, 0.45]) {
      const nb = makeBall(b.x, b.y, Math.sin(a0 + da), -Math.cos(a0 + da), b.speed);
      fixAngle(nb);
      add.push(nb);
    }
  }
  balls.push(...add);
}
function pulse() {
  SFX.pulse();
  shake = Math.max(shake, 8);
  for (const b of balls) {
    rings.push({ x: b.x, y: b.y, r: 10, max: 150, life: 0.5, maxLife: 0.5, hue: 315, w: 6 });
    for (const br of bricks) {
      if (br.alive && Math.hypot(br.x + br.w / 2 - b.x, br.y + br.h / 2 - b.y) < 150) damageBrick(br, 1);
    }
    if (boss && boss.dying <= 0 && Math.hypot(boss.x - b.x, boss.y + boss.h / 2 - b.y) < 190) damageBoss(2, true);
  }
}

// ============================================================ balls
function makeBall(x, y, dx, dy, speed) {
  return { x, y, dx, dy, speed, r: 8, stuck: false, caught: false, stuckOff: 0, stuckT: 0, trail: [], dead: false };
}
function baseSpeed() { return Math.min(560, 390 + levelIndex * 14); }
function serveBall() {
  const b = makeBall(paddle.x, paddle.y - 9, 0, -1, baseSpeed());
  b.stuck = true;
  b.stuckOff = rand(-18, 18);
  balls = [b];
  demoLaunch = 1.2;
}
function launchBall(b) {
  b.stuck = false; b.caught = false;
  const rel = clamp(b.stuckOff / (paddle.w / 2), -1, 1);
  const a = rel * 0.95 + (Math.abs(rel) < 0.08 ? rand(-0.25, 0.25) : 0);
  b.dx = Math.sin(a); b.dy = -Math.cos(a);
  fixAngle(b);
}
function launch() {
  let any = false;
  for (const b of balls) if (b.stuck) { launchBall(b); any = true; }
  if (any) SFX.launch();
}
function fixAngle(b) {
  const len = Math.hypot(b.dx, b.dy) || 1;
  b.dx /= len; b.dy /= len;
  const MIN = 0.28;
  if (Math.abs(b.dy) < MIN) {
    b.dy = (b.dy < 0 ? -1 : 1) * MIN;
    b.dx = (b.dx < 0 ? -1 : 1) * Math.sqrt(1 - MIN * MIN);
  }
}
function resolveCircleRect(b, rx, ry, rw, rh) {
  const cx = clamp(b.x, rx, rx + rw), cy = clamp(b.y, ry, ry + rh);
  let nx = b.x - cx, ny = b.y - cy;
  const d = Math.hypot(nx, ny);
  let pen;
  if (d < 1e-6) {
    const l = b.x - rx, r = rx + rw - b.x, t = b.y - ry, bo = ry + rh - b.y;
    const m = Math.min(l, r, t, bo);
    if (m === t) { nx = 0; ny = -1; } else if (m === bo) { nx = 0; ny = 1; }
    else if (m === l) { nx = -1; ny = 0; } else { nx = 1; ny = 0; }
    pen = m + b.r;
  } else { nx /= d; ny /= d; pen = b.r - d; }
  b.x += nx * pen; b.y += ny * pen;
  const dot = b.dx * nx + b.dy * ny;
  if (dot < 0) {
    b.dx -= 2 * dot * nx; b.dy -= 2 * dot * ny;
    fixAngle(b);
    return true;
  }
  return false;
}
function wallHit(b) {
  SFX.wall();
  sparks(b.x, b.y, 3, '#9ff');
}
function paddleHit(b) {
  if (deathTimer > 0) return false;
  const p = paddle, hw = p.w / 2;
  if (b.y + b.r < p.y || b.y - b.r > p.y + p.h) return false;
  if (b.x < p.x - hw - b.r * 0.6 || b.x > p.x + hw + b.r * 0.6) return false;
  const rel = clamp((b.x - p.x) / (hw + b.r * 0.5), -1, 1);
  const ang = rel * 1.05 + clamp(p.vx / 4000, -0.15, 0.15);
  b.dx = Math.sin(ang); b.dy = -Math.cos(ang);
  fixAngle(b);
  if (b.dy > 0) b.dy = -b.dy;
  b.y = p.y - b.r - 0.5;
  b.speed = Math.min(MAX_SPEED, b.speed + 4);
  combo = 0; lastMult = 1;
  p.squash = 1;
  SFX.paddle();
  sparks(b.x, p.y, 6, effects.catch > 0 ? '#ff6' : '#7ff');
  if (effects.catch > 0) {
    b.stuck = true; b.caught = true; b.stuckT = 0;
    b.stuckOff = clamp(b.x - p.x, -hw + 4, hw - 4);
  }
  return true;
}
function collideBricks(b) {
  const c0 = Math.floor((b.x - b.r - GX) / PX), c1 = Math.floor((b.x + b.r - GX) / PX);
  const r0 = Math.floor((b.y - b.r - GY) / PY), r1 = Math.floor((b.y + b.r - GY) / PY);
  let best = null, bd = Infinity;
  for (let r = r0; r <= r1; r++) {
    if (r < 0) continue;
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= COLS) continue;
      const br = grid.get(r * COLS + c);
      if (!br || !br.alive) continue;
      const cx = clamp(b.x, br.x, br.x + br.w), cy = clamp(b.y, br.y, br.y + br.h);
      const d = (b.x - cx) ** 2 + (b.y - cy) ** 2;
      if (d < b.r * b.r && d < bd) { bd = d; best = br; }
    }
  }
  if (!best) return false;
  if (effects.fire > 0) {
    destroyBrick(best);
    for (let i = 0; i < 6; i++) particles.push({ x: b.x, y: b.y, vx: rand(-120, 120), vy: rand(-120, 120),
      life: rand(0.2, 0.5), max: 0.5, size: rand(3, 6), color: `hsl(${rand(10, 45)},100%,60%)`, g: -100, drag: 2, kind: 'spark' });
    return true;
  }
  if (resolveCircleRect(b, best.x, best.y, best.w, best.h)) damageBrick(best, 1);
  return true;
}
function collideBoss(b) {
  const bx = boss.x - boss.w / 2, by = boss.y;
  const cx = clamp(b.x, bx, bx + boss.w), cy = clamp(b.y, by, by + boss.h);
  if ((b.x - cx) ** 2 + (b.y - cy) ** 2 >= b.r * b.r) return;
  if (resolveCircleRect(b, bx, by, boss.w, boss.h)) damageBoss(effects.fire > 0 ? 3 : 1);
}
function updateBall(b, dt) {
  if (b.stuck) {
    b.x = paddle.x + b.stuckOff; b.y = paddle.y - b.r - 1;
    b.stuckT += dt;
    if (b.caught && b.stuckT > 2.5) launchBall(b);
    return;
  }
  const sp = b.speed * (effects.slow > 0 ? 0.6 : 1);
  const dist = sp * dt;
  const steps = Math.max(1, Math.ceil(dist / (b.r * 0.5)));
  const st = dist / steps;
  for (let i = 0; i < steps; i++) {
    b.x += b.dx * st; b.y += b.dy * st;
    if (b.x < b.r) { b.x = b.r; b.dx = Math.abs(b.dx); wallHit(b); }
    else if (b.x > W - b.r) { b.x = W - b.r; b.dx = -Math.abs(b.dx); wallHit(b); }
    if (b.y < TOP + b.r) { b.y = TOP + b.r; b.dy = Math.abs(b.dy); wallHit(b); }
    if (barrier && b.dy > 0 && b.y + b.r > BARRIER_Y) {
      b.y = BARRIER_Y - b.r; b.dy = -Math.abs(b.dy); fixAngle(b);
      barrier = false;
      SFX.barrier();
      for (let x = 0; x < W; x += 24) sparks(x, BARRIER_Y, 1, '#c8f');
      rings.push({ x: b.x, y: BARRIER_Y, r: 8, max: 90, life: 0.4, maxLife: 0.4, hue: 275, w: 4 });
    }
    if (b.dy > 0 && paddleHit(b)) { if (b.stuck) return; continue; }
    collideBricks(b);
    if (boss && boss.dying <= 0) collideBoss(b);
    if (b.y - b.r > H) { b.dead = true; return; }
  }
  b.trail.push({ x: b.x, y: b.y });
  if (b.trail.length > 12) b.trail.shift();
  if (effects.fire > 0) {
    particles.push({ x: b.x + rand(-4, 4), y: b.y + rand(-4, 4), vx: rand(-30, 30), vy: rand(-60, 0),
      life: rand(0.2, 0.45), max: 0.45, size: rand(3, 6), color: `hsl(${rand(5, 45)},100%,${rand(50, 65)}%)`, g: -80, drag: 1, kind: 'spark' });
  }
}

// ============================================================ boss
function makeBoss(cfg) {
  return { x: W / 2, y: -140, ty: 84, w: cfg.w || 230, h: 72, hp: cfg.hp, max: cfg.hp, name: cfg.name,
    fire: cfg.fire, fireT: 3, summonT: 10, ph: 0, speed: cfg.speed || 0.6, flash: 0, inv: 0, phase2: false,
    dying: 0, eye: { x: 0, y: 0 }, charge: 0 };
}
function damageBoss(d, ignoreInv) {
  if (!boss || boss.dying > 0 || (!ignoreInv && boss.inv > 0)) return;
  boss.hp -= d; boss.flash = 1; boss.inv = 0.08;
  SFX.bossHit();
  shake = Math.max(shake, 5);
  sparks(boss.x + rand(-boss.w / 3, boss.w / 3), boss.y + boss.h, 14, boss.phase2 ? '#f66' : '#c8f');
  addScore(100 * d);
  if (!boss.phase2 && boss.hp <= boss.max / 2) {
    boss.phase2 = true;
    setBanner('ENRAGED', boss.name + ' is overheating', '#f55', 1.8);
    SFX.bossRoar();
    shake = 14;
  }
  if (boss.hp <= 0) {
    boss.hp = 0;
    boss.dying = 2.4;
    bolts = [];
    addScore(5000 + 1000 * levelIndex);
    if (!demo) addText(boss.x, boss.y + boss.h / 2, '+' + fmt(5000 + 1000 * levelIndex), '#ff8', 28, 2);
    SFX.bossDie();
    for (const br of bricks) if (isBreakable(br)) pending.push({ t: rand(0.3, 2.0), r: br.r, c: br.c, quiet: true });
  }
}
function updateBoss(dt) {
  const b = boss;
  b.flash = Math.max(0, b.flash - dt * 5);
  b.inv = Math.max(0, b.inv - dt);
  if (b.dying > 0) {
    b.dying -= dt;
    b.x += rand(-3, 3);
    shake = Math.max(shake, 6);
    if (Math.random() < dt * 14) {
      const x = b.x + rand(-b.w / 2, b.w / 2), y = b.y + rand(0, b.h);
      rings.push({ x, y, r: 6, max: rand(40, 90), life: 0.35, maxLife: 0.35, hue: rand(0, 60), w: 5 });
      sparks(x, y, 12, `hsl(${rand(0, 60)},100%,65%)`);
    }
    if (b.dying <= 0) {
      for (let i = 0; i < 120; i++) {
        const a = rand(0, Math.PI * 2), s = rand(100, 700);
        particles.push({ x: b.x, y: b.y + b.h / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.5, 1.4), max: 1.4,
          size: rand(2, 7), color: `hsl(${rand(250, 360)},100%,${rand(55, 80)}%)`, g: 200, drag: 1.2, kind: i % 2 ? 'spark' : 'shard' });
      }
      rings.push({ x: b.x, y: b.y + b.h / 2, r: 10, max: 420, life: 0.8, maxLife: 0.8, hue: 300, w: 14 });
      flashScreen = 1; shake = 20;
      for (const br of bricks) if (isBreakable(br)) destroyBrick(br);
      boss = null;
      clearLabel = 'GUARDIAN DOWN';
      startClear();
    }
    return;
  }
  b.y = lerp(b.y, b.ty, Math.min(1, dt * 1.5));
  b.ph += dt * b.speed * (b.phase2 ? 1.7 : 1);
  const amp = (W - b.w) / 2 - 30;
  b.x = W / 2 + Math.sin(b.ph) * amp;
  // eye tracks the most threatening ball
  let target = null;
  for (const ball of balls) if (!target || ball.y > target.y) target = ball;
  const tx = target ? target.x : paddle.x, ty = target ? target.y : paddle.y;
  const a = Math.atan2(ty - (b.y + b.h / 2), tx - b.x);
  b.eye.x = lerp(b.eye.x, Math.cos(a) * 9, Math.min(1, dt * 8));
  b.eye.y = lerp(b.eye.y, Math.sin(a) * 7, Math.min(1, dt * 8));
  if (b.y < b.ty - 6 || clearing || deathTimer > 0) return;
  b.fireT -= dt;
  b.charge = clamp(1 - b.fireT / 0.6, 0, 1);
  if (b.fireT <= 0) {
    b.fireT = b.fire * (b.phase2 ? 0.6 : 1);
    const ox = b.x, oy = b.y + b.h;
    const ang = Math.atan2(paddle.y - oy, paddle.x - ox);
    const spread = b.phase2 ? [-0.28, 0, 0.28] : [0];
    const sp = b.phase2 ? 330 : 280;
    for (const s of spread) bolts.push({ x: ox, y: oy, vx: Math.cos(ang + s) * sp, vy: Math.sin(ang + s) * sp });
    SFX.bossShoot();
  }
  b.summonT -= dt;
  if (b.summonT <= 0) {
    b.summonT = b.phase2 ? 7 : 10;
    const empty = [];
    for (let c = 1; c < COLS - 1; c++) if (!grid.get(4 * COLS + c)) empty.push(c);
    empty.sort(() => Math.random() - 0.5);
    const n = Math.min(empty.length, b.phase2 ? 5 : 3);
    for (let i = 0; i < n; i++) {
      const br = makeBrick(b.phase2 ? 'U' : 'T', 4, empty[i], levelTime + i * 0.08);
      bricks.push(br); grid.set(4 * COLS + empty[i], br);
      rings.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, r: 4, max: 40, life: 0.4, maxLife: 0.4, hue: 280, w: 3 });
    }
    if (n) SFX.summon();
  }
}

// ============================================================ level flow
function loadLevel(idx) {
  levelIndex = idx;
  level = getLevelDef(idx);
  levelTime = 0;
  themeHueTarget = level.hue;
  bricks = []; grid = new Map();
  level.rows.forEach((row, r) => {
    const padLeft = Math.floor((COLS - row.length) / 2);
    const padded = '.'.repeat(Math.max(0, padLeft)) + row + '.'.repeat(Math.max(0, COLS - row.length - padLeft));
    for (let c = 0; c < COLS; c++) {
      const br = makeBrick(padded[c], r, c, 0.25 + r * 0.06 + Math.abs(c - 6.5) * 0.025);
      if (br) { bricks.push(br); grid.set(r * COLS + c, br); }
    }
  });
  boss = level.boss ? makeBoss(level.boss) : null;
  capsules = []; lasers = []; bolts = []; pending = [];
  for (const k in effects) effects[k] = 0;
  combo = 0; lastMult = 1;
  clearing = false; slowmo = 0; deathTimer = 0; armorFailed = false;
  paddle.stun = 0;
  serveBall();
  SFX.setIntensity(demo ? 0 : boss ? 2 : 1);
  if (!demo) {
    if (boss) setBanner('⚠ WARNING ⚠', boss.name + ' APPROACHES', '#f55', 2.8);
    else setBanner(levelLabel(idx), level.name, `hsl(${level.hue},100%,72%)`, 2.6);
  }
}
const DEMO_LEVELS = [0, 1, 3, 5, 6, 8];
function loadDemo() {
  demo = true;
  SFX.setSfx(false);
  barrier = false;
  loadLevel(DEMO_LEVELS[Math.floor(Math.random() * DEMO_LEVELS.length)]);
  banner = null;
}
function startGame() {
  demo = false;
  SFX.setSfx(true);
  score = 0; displayScore = 0; lives = 3; nextLife = 20000;
  victoryShown = false; newHigh = false; barrier = false;
  particles = []; texts = []; rings = [];
  paddle.x = paddle.target = W / 2;
  loadLevel(0);
  state = 'play';
  SFX.launch();
}
function nextLevel() {
  const next = levelIndex + 1;
  if (next === LEVELS.length && !victoryShown) {
    victoryShown = true;
    levelIndex = next;
    state = 'victory'; overTimer = 0;
    SFX.victory();
    saveHi();
    return;
  }
  loadLevel(next);
  state = 'play';
}
function loseLife() {
  if (demo) { serveBall(); return; }
  lives--;
  SFX.die();
  shake = 16; flashScreen = 0.5;
  combo = 0; lastMult = 1;
  for (const k in effects) effects[k] = 0;
  capsules = []; lasers = []; bolts = [];
  for (let i = 0; i < 50; i++) {
    const a = rand(Math.PI, Math.PI * 2), s = rand(100, 500);
    particles.push({ x: paddle.x + rand(-paddle.w / 2, paddle.w / 2), y: paddle.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rand(0.5, 1.2), max: 1.2, size: rand(2, 6), color: i % 2 ? '#7ff' : '#f7f', g: 500, drag: 1, kind: 'shard' });
  }
  deathTimer = 1.5;
}
function gameOver() {
  state = 'gameover'; overTimer = 0;
  newHigh = score > 0 && score >= hiscore;
  saveHi();
  SFX.gameover();
  SFX.setIntensity(0);
}
function toTitle() {
  state = 'title';
  particles = []; texts = [];
  loadDemo();
}
function togglePause() {
  if (state === 'play') { state = 'paused'; SFX.duck(true); }
  else if (state === 'paused') { state = 'play'; SFX.duck(false); }
}

function addScore(p) {
  if (demo) return;
  score += p;
  if (score > hiscore) hiscore = score;
  if (score >= nextLife) {
    nextLife += 30000;
    if (lives < 6) {
      lives++;
      SFX.extra();
      addText(W / 2, H * 0.5, 'EXTRA LIFE!', '#f7a', 26, 1.6);
    }
  }
}

// ============================================================ update
function update(rawDt) {
  time += rawDt;
  if (slowmo > 0) slowmo -= rawDt;
  const dt = rawDt * (slowmo > 0 ? 0.25 : 1);
  themeHue = lerp(themeHue, themeHueTarget, Math.min(1, rawDt * 1.5));
  shake = Math.max(0, shake - rawDt * 35);
  flashScreen = Math.max(0, flashScreen - rawDt * 2.5);
  displayScore = lerp(displayScore, score, Math.min(1, rawDt * 8));
  if (Math.abs(displayScore - score) < 1) displayScore = score;
  if (banner) { banner.t += rawDt; if (banner.t > banner.dur) banner = null; }

  if (state === 'paused') return;
  updateParticles(dt);
  if (state === 'clear') {
    clearTimer -= rawDt;
    if (clearTimer <= 0) nextLevel();
    return;
  }
  if (state === 'gameover' || state === 'victory') { overTimer += rawDt; return; }

  // --- play / title demo
  levelTime += dt;
  for (const k in effects) if (effects[k] > 0) effects[k] = Math.max(0, effects[k] - dt);

  // paddle
  const p = paddle;
  if (demo) demoPilot(dt);
  const tw = effects.expand > 0 ? 180 : effects.shrink > 0 ? 76 : 120;
  p.w = lerp(p.w, tw, Math.min(1, dt * 10));
  if (!demo) {
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (dir) p.target += dir * 980 * dt;
  }
  p.target = clamp(p.target, p.w / 2, W - p.w / 2);
  const prevX = p.x;
  if (p.stun > 0) p.stun -= dt;
  else p.x = lerp(p.x, p.target, Math.min(1, dt * (demo ? 16 : 30)));
  p.x = clamp(p.x, p.w / 2, W - p.w / 2);
  p.vx = dt > 0 ? (p.x - prevX) / dt : 0;
  p.squash = Math.max(0, p.squash - dt * 5);
  if (effects.laser > 0 && deathTimer <= 0 && !clearing) {
    p.laserCd -= dt;
    if (p.laserCd <= 0) {
      p.laserCd = 0.26;
      lasers.push({ x: p.x - p.w / 2 + 8, y: p.y - 4 }, { x: p.x + p.w / 2 - 8, y: p.y - 4 });
      SFX.laser();
    }
  }

  // balls
  for (const b of balls) updateBall(b, dt);
  balls = balls.filter(b => !b.dead);

  // lasers
  for (const l of lasers) {
    l.y -= 950 * dt;
    if (l.y < TOP) { l.dead = true; continue; }
    const c = Math.floor((l.x - GX) / PX), r = Math.floor((l.y - GY) / PY);
    const br = c >= 0 && c < COLS && r >= 0 ? grid.get(r * COLS + c) : null;
    if (br && br.alive && l.x >= br.x && l.x <= br.x + br.w && l.y <= br.y + br.h && l.y >= br.y) {
      damageBrick(br, 1); l.dead = true; sparks(l.x, l.y, 4, '#f66'); continue;
    }
    if (boss && boss.dying <= 0 && Math.abs(l.x - boss.x) < boss.w / 2 && l.y > boss.y && l.y < boss.y + boss.h) {
      damageBoss(0.5, true); l.dead = true;
    }
  }
  lasers = lasers.filter(l => !l.dead);

  // capsules
  for (const c of capsules) {
    c.y += c.vy * dt; c.t += dt;
    if (deathTimer <= 0 && c.y + 9 >= p.y && c.y - 9 <= p.y + p.h && Math.abs(c.x - p.x) <= p.w / 2 + 22) {
      c.dead = true; applyPU(c.type);
    } else if (c.y > H + 20) c.dead = true;
  }
  capsules = capsules.filter(c => !c.dead);

  // boss bolts
  for (const bo of bolts) {
    bo.x += bo.vx * dt; bo.y += bo.vy * dt;
    if (deathTimer <= 0 && bo.y + 7 >= p.y && bo.y - 7 <= p.y + p.h && Math.abs(bo.x - p.x) <= p.w / 2 + 7) {
      bo.dead = true;
      p.stun = 0.9;
      shake = Math.max(shake, 8);
      SFX.zap();
      sparks(bo.x, p.y, 20, '#ff4');
      if (!demo) addText(p.x, p.y - 24, 'STUNNED', '#ff4', 18, 1);
    } else if (bo.y > H + 20 || bo.x < -20 || bo.x > W + 20) bo.dead = true;
  }
  bolts = bolts.filter(b => !b.dead);

  if (boss) updateBoss(dt);

  // chained explosions
  if (pending.length) {
    for (const pe of pending) pe.t -= dt;
    const ready = pending.filter(pe => pe.t <= 0);
    pending = pending.filter(pe => pe.t > 0);
    for (const pe of ready) {
      const br = grid.get(pe.r * COLS + pe.c);
      if (br && br.alive) destroyBrick(br);
    }
  }

  for (const br of bricks) {
    if (br.flash > 0) br.flash = Math.max(0, br.flash - dt * 6);
    if (br.wobble > 0) br.wobble = Math.max(0, br.wobble - dt * 4);
  }

  // armour failsafe: steel softens if a sector drags on
  if (!armorFailed && !boss && !clearing && levelTime > 90 && bricks.some(b => b.alive && b.type === 's')) {
    armorFailed = true;
    for (const br of bricks) if (br.alive && br.type === 's') {
      br.type = 'n'; br.hp = br.maxHp = 2; br.hue = 210; br.sat = 15;
      br.color = 'hsl(210,15%,62%)'; br.cracks = genCracks(br); br.flash = 1;
    }
    if (!demo) setBanner('ARMOR FAILING', 'steel plating can now be broken', '#9cf', 2.2);
  }

  if (clearing && slowmo <= 0) { finishClear(); return; }

  // death
  if (deathTimer > 0) {
    deathTimer -= dt;
    if (deathTimer <= 0) {
      if (lives <= 0) gameOver();
      else { serveBall(); }
    }
  } else if (balls.length === 0 && !clearing && !(boss && boss.dying > 0)) {
    loseLife();
  }
}

function predictX(b) {
  if (b.dy <= 0) return b.x;
  const d = (paddle.y - b.y) / b.dy;
  const x = b.x + b.dx * d;
  const minX = b.r, span = W - 2 * b.r;
  let rel = (x - minX) % (2 * span);
  if (rel < 0) rel += 2 * span;
  if (rel > span) rel = 2 * span - rel;
  return minX + rel;
}
function demoPilot(dt) {
  let tb = null;
  for (const b of balls) if (!b.stuck && b.dy > 0 && (!tb || b.y > tb.y)) tb = b;
  if (tb) paddle.target = predictX(tb) + Math.sin(time * 0.9) * paddle.w * 0.3;
  else {
    const c = capsules.find(c => !c.type.bad);
    paddle.target = c ? c.x : lerp(paddle.target, W / 2 + Math.sin(time * 0.6) * 200, dt * 2);
  }
  if (balls.some(b => b.stuck)) {
    demoLaunch -= dt;
    if (demoLaunch <= 0) { for (const b of balls) if (b.stuck) launchBall(b); demoLaunch = 1; }
  }
}

// ============================================================ render
const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: rand(0.2, 1), tw: rand(0, 6) }));

const vignette = (() => {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.07)';
  for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  return c;
})();

function drawBackground() {
  const h = themeHue;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `hsl(${h},55%,5%)`);
  g.addColorStop(0.55, `hsl(${(h + 30) % 360},50%,8%)`);
  g.addColorStop(1, `hsl(${(h + 70) % 360},60%,13%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // sun
  const horizon = H * 0.6;
  const sg = ctx.createRadialGradient(W / 2, horizon, 10, W / 2, horizon, 300);
  sg.addColorStop(0, `hsla(${(h + 60) % 360},100%,60%,0.16)`);
  sg.addColorStop(1, `hsla(${(h + 60) % 360},100%,60%,0)`);
  ctx.fillStyle = sg; ctx.fillRect(0, horizon - 300, W, 600);

  // stars
  for (const s of stars) {
    s.y += s.z * 12 * (1 / 60);
    if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    const a = 0.3 + 0.5 * s.z * (0.6 + 0.4 * Math.sin(time * 2 + s.tw));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(s.x, s.y, s.z * 2, s.z * 2);
  }

  // perspective grid floor
  ctx.save();
  ctx.strokeStyle = `hsla(${(h + 80) % 360},100%,65%,0.12)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const N = 12, off = (time * 0.35) % 1;
  for (let i = 0; i < N; i++) {
    const t = (i + off) / N;
    const y = horizon + (H - horizon) * t * t;
    ctx.moveTo(0, y); ctx.lineTo(W, y);
  }
  for (let k = -14; k <= 14; k++) {
    ctx.moveTo(W / 2 + k * 24, horizon);
    ctx.lineTo(W / 2 + k * 150, H);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBricks() {
  for (const br of bricks) {
    if (!br.alive) continue;
    const k = clamp((levelTime - br.delay) / 0.45, 0, 1);
    if (k <= 0) continue;
    const e = 1 - Math.pow(1 - k, 3);
    const y = br.y - (1 - e) * 60;
    const x = br.x + (br.wobble > 0 ? Math.sin(br.wobble * 40) * br.wobble * 2.5 : 0);
    const w = br.w, h = br.h;
    ctx.globalAlpha = e;

    if (br.type === 's') {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#dfe5ee'); g.addColorStop(0.45, '#8c96a6'); g.addColorStop(1, '#4a5160');
      ctx.fillStyle = g; rr(x, y, w, h, 3); ctx.fill();
      const sx = ((time * 60 + br.c * 25 + br.r * 40) % 400) - 100;
      if (sx > -20 && sx < w + 20) {
        ctx.save(); rr(x, y, w, h, 3); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.moveTo(x + sx, y); ctx.lineTo(x + sx + 12, y); ctx.lineTo(x + sx - 4, y + h); ctx.lineTo(x + sx - 16, y + h); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#3a404c';
      for (const [px, py] of [[5, 5], [w - 5, 5], [5, h - 5], [w - 5, h - 5]]) { ctx.beginPath(); ctx.arc(x + px, y + py, 1.8, 0, 7); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; rr(x + 0.5, y + 0.5, w - 1, h - 1, 3); ctx.stroke();
    } else {
      let hue = br.hue, sat = br.sat;
      if (br.type === '?') { hue = (time * 140 + br.c * 22 + br.r * 30) % 360; sat = 95; }
      // glow
      ctx.fillStyle = `hsla(${hue},${sat}%,60%,0.16)`;
      rr(x - 3, y - 3, w + 6, h + 6, 7); ctx.fill();
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      if (br.type === 'x') {
        const pulseA = 0.5 + 0.5 * Math.sin(time * 6 + br.c);
        g.addColorStop(0, `hsl(15,100%,${45 + pulseA * 15}%)`); g.addColorStop(1, 'hsl(0,90%,22%)');
      } else {
        g.addColorStop(0, `hsl(${hue},${sat}%,70%)`);
        g.addColorStop(0.5, `hsl(${hue},${sat}%,52%)`);
        g.addColorStop(1, `hsl(${hue},${sat}%,32%)`);
      }
      ctx.fillStyle = g; rr(x, y, w, h, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.32)'; rr(x + 4, y + 3, w - 8, 4, 2); ctx.fill();

      if (br.maxHp > 1) {
        // armour plate inset
        ctx.strokeStyle = `hsla(${hue},100%,85%,0.55)`; ctx.lineWidth = 1.5;
        rr(x + 4, y + 4, w - 8, h - 8, 3); ctx.stroke();
        for (let i = 0; i < br.hp; i++) {
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(x + w / 2 + (i - (br.hp - 1) / 2) * 9, y + h / 2 + 1, 2.2, 0, 7); ctx.fill();
        }
        const dmg = br.maxHp - br.hp;
        if (dmg > 0 && br.cracks) {
          ctx.strokeStyle = 'rgba(10,0,20,0.7)'; ctx.lineWidth = 1.4;
          for (let i = 0; i < Math.min(3, dmg * 2); i++) {
            const pts = br.cracks[i]; ctx.beginPath(); ctx.moveTo(x + pts[0][0], y + pts[0][1]);
            for (let j = 1; j < pts.length; j++) ctx.lineTo(x + pts[j][0], y + pts[j][1]);
            ctx.stroke();
          }
        }
      }
      if (br.type === 'x') {
        const cx = x + w / 2, cy = y + h / 2, rad = 7 + Math.sin(time * 8 + br.c) * 1.2;
        ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4 + time;
          ctx.moveTo(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3);
          ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
        }
        ctx.stroke();
        ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, 7); ctx.fill();
      }
      if (br.type === '?') text('?', x + w / 2, y + h / 2 + 1, 17, '#fff', 'center', '900', 8);
    }
    if (br.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${br.flash * 0.8})`;
      rr(x, y, w, h, 5); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawBoss() {
  const b = boss;
  const x = b.x - b.w / 2, y = b.y, w = b.w, h = b.h;
  const hue = b.phase2 ? 355 : 280;
  ctx.save();
  // aura
  const ag = ctx.createRadialGradient(b.x, y + h / 2, 10, b.x, y + h / 2, w * 0.8);
  ag.addColorStop(0, `hsla(${hue},100%,60%,0.25)`); ag.addColorStop(1, `hsla(${hue},100%,60%,0)`);
  ctx.fillStyle = ag; ctx.fillRect(b.x - w, y - h, w * 2, h * 3);
  // chamfered body
  const ch = 18;
  ctx.beginPath();
  ctx.moveTo(x + ch, y); ctx.lineTo(x + w - ch, y); ctx.lineTo(x + w, y + ch);
  ctx.lineTo(x + w, y + h - ch); ctx.lineTo(x + w - ch, y + h); ctx.lineTo(x + ch, y + h);
  ctx.lineTo(x, y + h - ch); ctx.lineTo(x, y + ch); ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `hsl(${hue},40%,22%)`); g.addColorStop(1, `hsl(${hue},50%,8%)`);
  ctx.fillStyle = g;
  ctx.shadowColor = `hsl(${hue},100%,60%)`; ctx.shadowBlur = 25;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `hsl(${hue},100%,65%)`; ctx.lineWidth = 3; ctx.stroke();
  // circuitry
  ctx.strokeStyle = `hsla(${hue},100%,70%,0.35)`; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const lx = x + 22 + i * 12;
    ctx.moveTo(lx, y + 12); ctx.lineTo(lx, y + h - 12);
    ctx.moveTo(x + w - 22 - i * 12, y + 12); ctx.lineTo(x + w - 22 - i * 12, y + h - 12);
  }
  ctx.stroke();
  // hp lights
  const segs = 12;
  for (let i = 0; i < segs; i++) {
    const on = i < Math.ceil((b.hp / b.max) * segs);
    ctx.fillStyle = on ? `hsl(${hue},100%,${60 + 15 * Math.sin(time * 6 + i)}%)` : 'rgba(255,255,255,0.08)';
    ctx.fillRect(b.x - segs * 7 + i * 14 + 2, y + h - 9, 10, 4);
  }
  // eye
  const ex = b.x, ey = y + h / 2 - 2;
  ctx.fillStyle = '#05010a';
  ctx.beginPath(); ctx.ellipse(ex, ey, 30, 20, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = `hsl(${hue},100%,70%)`; ctx.lineWidth = 2; ctx.stroke();
  const ig = ctx.createRadialGradient(ex + b.eye.x, ey + b.eye.y, 1, ex + b.eye.x, ey + b.eye.y, 13);
  ig.addColorStop(0, '#fff'); ig.addColorStop(0.3, `hsl(${b.phase2 ? 20 : 300},100%,65%)`); ig.addColorStop(1, `hsla(${hue},100%,40%,0)`);
  ctx.fillStyle = ig;
  ctx.beginPath(); ctx.arc(ex + b.eye.x, ey + b.eye.y, 13, 0, 7); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ex + b.eye.x, ey + b.eye.y, 3, 7, 0, 0, 7); ctx.fill();
  // charging cannon
  if (b.charge > 0 && b.dying <= 0) {
    ctx.fillStyle = `hsla(${b.phase2 ? 30 : 320},100%,70%,${b.charge})`;
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 20 * b.charge;
    ctx.beginPath(); ctx.arc(b.x, y + h + 2, 4 + b.charge * 6, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (b.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.6})`;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function drawCapsule(x, y, pu, t) {
  const w = 46, h = 20;
  ctx.save();
  ctx.translate(x, y);
  const hue = pu.hue;
  ctx.shadowColor = pu.bad ? '#f33' : `hsl(${hue},100%,60%)`;
  ctx.shadowBlur = 14;
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  if (pu.bad) { g.addColorStop(0, '#5a1018'); g.addColorStop(1, '#200408'); }
  else { g.addColorStop(0, `hsl(${hue},100%,72%)`); g.addColorStop(1, `hsl(${hue},90%,35%)`); }
  ctx.fillStyle = g; rr(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save(); rr(-w / 2, -h / 2, w, h, h / 2); ctx.clip();
  if (pu.bad) {
    ctx.fillStyle = 'rgba(255,60,60,0.35)';
    for (let i = -3; i < 4; i++) { ctx.beginPath(); ctx.moveTo(i * 14 + (t * 20 % 14), -h / 2); ctx.lineTo(i * 14 + 7 + (t * 20 % 14), -h / 2); ctx.lineTo(i * 14 + (t * 20 % 14), h / 2); ctx.lineTo(i * 14 - 7 + (t * 20 % 14), h / 2); ctx.fill(); }
  }
  const sx = ((t * 70) % 120) - 60;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(sx, -h / 2, 6, h);
  ctx.restore();
  ctx.strokeStyle = pu.bad ? '#f55' : 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
  rr(-w / 2, -h / 2, w, h, h / 2); ctx.stroke();
  text(pu.label, 0, 1, 14, '#fff', 'center', '900');
  ctx.restore();
}

function drawPaddle() {
  if (deathTimer > 0) return;
  const p = paddle;
  const sq = p.squash;
  const w = p.w * (1 + sq * 0.08), h = p.h * (1 - sq * 0.3);
  const x = p.x - w / 2, y = p.y + (p.h - h);
  const stunned = p.stun > 0;
  ctx.save();
  if (stunned && Math.floor(time * 30) % 2) ctx.globalAlpha = 0.5;
  // cannons
  if (effects.laser > 0) {
    ctx.fillStyle = '#ccd';
    ctx.fillRect(x + 4, y - 8, 8, 10); ctx.fillRect(x + w - 12, y - 8, 8, 10);
    ctx.fillStyle = '#f44'; ctx.fillRect(x + 5, y - 10, 6, 3); ctx.fillRect(x + w - 11, y - 10, 6, 3);
  }
  const mainHue = effects.catch > 0 ? 55 : effects.fire > 0 ? 25 : 190;
  ctx.shadowColor = stunned ? '#ff4' : `hsl(${mainHue},100%,60%)`;
  ctx.shadowBlur = 20;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, `hsl(${mainHue},100%,60%)`);
  g.addColorStop(0.5, 'hsl(300,100%,68%)');
  g.addColorStop(1, `hsl(${mainHue},100%,60%)`);
  ctx.fillStyle = g; rr(x, y, w, h, h / 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; rr(x + 8, y + 2, w - 16, 3, 1.5); ctx.fill();
  ctx.fillStyle = 'rgba(10,0,30,0.5)'; ctx.fillRect(p.x - 1, y + 3, 2, h - 6);
  if (effects.catch > 0) {
    ctx.strokeStyle = `rgba(255,255,120,${0.5 + 0.4 * Math.sin(time * 10)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 6, y - 2); ctx.lineTo(x + w - 6, y - 2); ctx.stroke();
  }
  if (stunned) {
    ctx.strokeStyle = '#ffffa0'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      let lx = x + rand(0, w * 0.3), ly = y + rand(0, h);
      ctx.moveTo(lx, ly);
      for (let i = 0; i < 5; i++) { lx += rand(5, w / 5); ly = y + rand(-6, h + 6); ctx.lineTo(lx, ly); }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawBalls() {
  ctx.save();
  const fire = effects.fire > 0;
  ctx.globalCompositeOperation = 'lighter';
  for (const b of balls) {
    for (let i = 0; i < b.trail.length; i++) {
      const t = b.trail[i], f = i / b.trail.length;
      ctx.fillStyle = fire ? `hsla(25,100%,55%,${f * 0.35})` : `hsla(${190 + f * 110},100%,65%,${f * 0.3})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, b.r * f, 0, 7); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const b of balls) {
    ctx.shadowColor = fire ? '#f80' : '#8ff';
    ctx.shadowBlur = 18;
    const g = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, b.r);
    if (fire) { g.addColorStop(0, '#fff8d0'); g.addColorStop(0.5, '#ffb030'); g.addColorStop(1, '#ff4000'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#d8fbff'); g.addColorStop(1, '#6fe8ff'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    if (p.kind === 'spark') {
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      const s = p.size * (0.5 + a * 0.5);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
  }
  ctx.globalAlpha = 1;
  for (const r of rings) {
    const a = r.life / r.maxLife;
    ctx.strokeStyle = `hsla(${r.hue},100%,65%,${a})`;
    ctx.lineWidth = r.w * a + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke();
  }
  ctx.restore();
  for (const t of texts) {
    ctx.globalAlpha = clamp(t.life / t.max * 1.5, 0, 1);
    text(t.str, t.x, t.y, t.size, t.color, 'center', '900', 10);
  }
  ctx.globalAlpha = 1;
}

function drawProjectiles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lasers) {
    ctx.strokeStyle = 'rgba(255,80,80,0.5)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y + 18); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y + 14); ctx.stroke();
  }
  for (const bo of bolts) {
    const g = ctx.createRadialGradient(bo.x, bo.y, 1, bo.x, bo.y, 14);
    g.addColorStop(0, '#fff'); g.addColorStop(0.3, '#ff5ad0'); g.addColorStop(1, 'rgba(255,0,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bo.x, bo.y, 14, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawBarrier() {
  const a = 0.55 + 0.3 * Math.sin(time * 5);
  ctx.save();
  ctx.shadowColor = '#b6f'; ctx.shadowBlur = 16;
  ctx.strokeStyle = `rgba(200,140,255,${a})`; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = BARRIER_Y + Math.sin(x * 0.05 + time * 6) * 2;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = 'rgba(4,2,18,0.6)'; ctx.fillRect(0, 0, W, TOP - 6);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'hsla(190,100%,60%,0.9)'); g.addColorStop(0.5, 'hsla(300,100%,65%,0.9)'); g.addColorStop(1, 'hsla(190,100%,60%,0.9)');
  ctx.fillStyle = g; ctx.fillRect(0, TOP - 6, W, 2);

  text('SCORE', 20, 14, 11, 'rgba(255,255,255,0.5)', 'left', '700');
  text(fmt(displayScore), 20, 33, 24, '#fff', 'left', '800');
  const m = comboMult();
  if (m > 1) text('×' + m, 190, 32, 24 + Math.sin(time * 12) * 2, `hsl(${(time * 240) % 360},100%,68%)`, 'left', '900', 12);

  if (boss) {
    text(boss.name, W / 2, 14, 12, boss.phase2 ? '#f77' : '#d9f', 'center', '800');
    const bw = 280, bx = W / 2 - bw / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(bx, 26, bw, 12, 6); ctx.fill();
    const f = clamp(boss.hp / boss.max, 0, 1);
    if (f > 0) {
      const hg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      hg.addColorStop(0, '#f36'); hg.addColorStop(1, boss.phase2 ? '#f90' : '#b4f');
      ctx.fillStyle = hg; rr(bx, 26, bw * f, 12, 6); ctx.fill();
    }
  } else if (level) {
    text(levelLabel(), W / 2, 14, 11, 'rgba(255,255,255,0.5)', 'center', '700');
    text(level.name, W / 2, 33, 18, `hsl(${level.hue},100%,78%)`, 'center', '800');
  }

  text('HI', W - 20, 14, 11, 'rgba(255,255,255,0.5)', 'right', '700');
  text(fmt(hiscore), W - 20, 33, 18, '#fff', 'right', '800');
  for (let i = 0; i < lives; i++) {
    const lx = W - 175 - i * 26;
    ctx.fillStyle = 'hsl(190,100%,65%)';
    ctx.shadowColor = '#7ff'; ctx.shadowBlur = 6;
    rr(lx - 10, 28, 20, 7, 3.5); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // active effects
  let ex = 12;
  const items = [];
  for (const k in effects) if (effects[k] > 0) items.push([k, effects[k] / EFFECT_MAX[k]]);
  if (barrier) items.push(['barrier', 1]);
  for (const [k, f] of items) {
    const pu = PU_TYPES.find(p => p.id === k);
    const bad = pu.bad;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(ex, H - 22, 92, 16, 8); ctx.fill();
    ctx.fillStyle = bad ? 'rgba(255,60,60,0.7)' : `hsla(${pu.hue},100%,60%,0.75)`;
    rr(ex, H - 22, 92 * f, 16, 8); ctx.fill();
    text(pu.name, ex + 46, H - 13.5, 10, '#fff', 'center', '800');
    ex += 98;
  }
}

function drawBanner() {
  if (!banner) return;
  const t = banner.t, d = banner.dur;
  const a = clamp(Math.min(t / 0.25, (d - t) / 0.4), 0, 1);
  if (a <= 0) return;
  const y = H * 0.62;
  const slide = (1 - clamp(t / 0.35, 0, 1)) ** 2 * 60;
  ctx.globalAlpha = a;
  const bg = ctx.createLinearGradient(0, 0, W, 0);
  bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(0.5, 'rgba(0,0,0,0.55)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, y - 48, W, 96);
  text(banner.title, W / 2 - slide, y - 12, 42, '#fff', 'center', '900', 24, banner.color);
  text(banner.sub, W / 2 + slide, y + 26, 17, banner.color, 'center', '700');
  ctx.globalAlpha = 1;
}

function dim(a) { ctx.fillStyle = `rgba(3,1,14,${a})`; ctx.fillRect(0, 0, W, H); }

function drawTitleWord(word, y, size) {
  ctx.font = `900 ${size}px ${FONT}`;
  const widths = [...word].map(ch => ctx.measureText(ch).width + size * 0.04);
  let x = W / 2 - widths.reduce((a, b) => a + b, 0) / 2;
  [...word].forEach((ch, i) => {
    const hue = (i * 26 + time * 70) % 360;
    const dy = Math.sin(time * 2.6 + i * 0.45) * 6;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.shadowColor = `hsl(${hue},100%,60%)`; ctx.shadowBlur = 28;
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, '#fff'); g.addColorStop(0.5, `hsl(${hue},100%,70%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360},100%,45%)`);
    ctx.fillStyle = g;
    ctx.fillText(ch, x, y + dy);
    x += widths[i];
  });
  ctx.shadowBlur = 0;
}

function drawTitle() {
  dim(0.55);
  drawTitleWord('PRISM BREAK', 130, 96);
  text('A   N E O N   B R I C K   O D Y S S E Y', W / 2, 200, 16, 'rgba(220,230,255,0.75)', 'center', '600');
  if (Math.floor(time * 2) % 2 === 0) text('CLICK  ·  TAP  ·  PRESS SPACE TO PLAY', W / 2, 262, 22, '#fff', 'center', '800', 16, '#7ff');

  // legend
  const panelY = 310;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; rr(110, panelY, W - 220, 230, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(160,140,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  text('POWER CAPSULES', W / 2, panelY + 20, 12, 'rgba(255,255,255,0.55)', 'center', '800');
  PU_TYPES.forEach((pu, i) => {
    const col = i < 6 ? 0 : 1;
    const row = i < 6 ? i : i - 6;
    const x = col === 0 ? 160 : 520, y = panelY + 50 + row * 30;
    drawCapsule(x, y, pu, time + i);
    text(pu.name, x + 34, y, 14, pu.bad ? '#ff7a80' : `hsl(${pu.hue},100%,75%)`, 'left', '800');
    text(pu.desc, x + 140, y, 12, 'rgba(255,255,255,0.65)', 'left', '500');
  });
  // brick legend in column 2 remaining space
  const by = panelY + 50 + 5 * 30;
  text('BRICKS: colour = 1 hit · plated = 2-3 hits · steel = unbreakable', 520, by, 11, 'rgba(255,255,255,0.5)', 'left', '600');
  text('explosive = chain blast · ? = guaranteed capsule', 520, by + 16, 11, 'rgba(255,255,255,0.5)', 'left', '600');

  text('MOUSE / TOUCH / ← →  move     CLICK / SPACE  launch     P  pause     M  mute     N  music', W / 2, 575, 13, 'rgba(255,255,255,0.7)', 'center', '600');
  text('HIGH SCORE  ' + fmt(hiscore), W / 2, 612, 18, '#ffd36b', 'center', '800', 10);
  text('10 sectors · 2 guardians · endless depths beyond', W / 2, 642, 13, 'rgba(200,180,255,0.6)', 'center', '600');
}

function panel(y, h) {
  ctx.fillStyle = 'rgba(6,3,24,0.82)'; rr(W / 2 - 280, y, 560, h, 18); ctx.fill();
  const g = ctx.createLinearGradient(W / 2 - 280, 0, W / 2 + 280, 0);
  g.addColorStop(0, '#3ef'); g.addColorStop(0.5, '#f4f'); g.addColorStop(1, '#3ef');
  ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.stroke();
}

function drawOverlay() {
  if (state === 'title') { drawTitle(); return; }
  if (state === 'paused') {
    dim(0.6);
    panel(220, 260);
    text('PAUSED', W / 2, 280, 54, '#fff', 'center', '900', 22, '#a7f');
    text('click or press P to resume', W / 2, 335, 16, 'rgba(255,255,255,0.7)');
    text(`M  sound: ${SFX.muted ? 'OFF' : 'ON'}      N  music: ${SFX.musicOn ? 'ON' : 'OFF'}`, W / 2, 380, 15, '#9ef');
    text('ESC × 2 — quit to title', W / 2, 430, 13, 'rgba(255,255,255,0.45)');
    return;
  }
  if (state === 'clear' && clearStats) {
    dim(0.45);
    panel(190, 320);
    text('SECTOR CLEARED', W / 2, 245, 44, '#fff', 'center', '900', 22, `hsl(${themeHue},100%,65%)`);
    text(clearStats.label + ' — ' + clearStats.name, W / 2, 290, 15, 'rgba(255,255,255,0.65)');
    const tm = clearStats.time;
    text('TIME', W / 2 - 140, 340, 13, 'rgba(255,255,255,0.5)', 'left');
    text(`${Math.floor(tm / 60)}:${String(Math.floor(tm % 60)).padStart(2, '0')}`, W / 2 + 140, 340, 18, '#fff', 'right', '800');
    text('SECTOR BONUS', W / 2 - 140, 372, 13, 'rgba(255,255,255,0.5)', 'left');
    text('+' + fmt(clearStats.bonus), W / 2 + 140, 372, 18, '#ffd36b', 'right', '800');
    text('SCORE', W / 2 - 140, 404, 13, 'rgba(255,255,255,0.5)', 'left');
    text(fmt(displayScore), W / 2 + 140, 404, 18, '#fff', 'right', '800');
    const nx = levelIndex + 1;
    const nextName = nx === LEVELS.length && !victoryShown ? '???' : getLevelDef(nx).name;
    text('NEXT: ' + nextName, W / 2, 452, 15, '#9ef', 'center', '700');
    if (clearTimer < 3.6 && Math.floor(time * 3) % 2 === 0) text('click to continue', W / 2, 482, 13, 'rgba(255,255,255,0.6)');
    return;
  }
  if (state === 'gameover') {
    dim(Math.min(0.7, overTimer));
    panel(200, 300);
    text('SIGNAL LOST', W / 2, 260, 56, '#ff5a7a', 'center', '900', 26);
    text('FINAL SCORE', W / 2, 320, 13, 'rgba(255,255,255,0.55)');
    text(fmt(score), W / 2, 356, 40, '#fff', 'center', '900', 12, '#7ff');
    if (newHigh) text('★ NEW HIGH SCORE ★', W / 2, 400, 20, `hsl(${(time * 200) % 360},100%,70%)`, 'center', '900', 12);
    text('reached ' + levelLabel(), W / 2, 432, 14, 'rgba(255,255,255,0.6)');
    if (overTimer > 1) text('click to return to title', W / 2, 470, 14, 'rgba(255,255,255,0.7)');
    return;
  }
  if (state === 'victory') {
    dim(Math.min(0.65, overTimer));
    panel(170, 380);
    drawTitleWord('VICTORY', 235, 70);
    text('The Monolith has fallen. All ten sectors are free.', W / 2, 300, 16, 'rgba(255,255,255,0.8)');
    text('SCORE', W / 2, 345, 13, 'rgba(255,255,255,0.55)');
    text(fmt(score), W / 2, 380, 40, '#fff', 'center', '900', 12, '#f7f');
    text('But the signal goes deeper…', W / 2, 432, 15, '#9ef', 'center', '600');
    if (overTimer > 1.5 && Math.floor(time * 2.5) % 2 === 0) text('CLICK TO DIVE INTO ENDLESS MODE', W / 2, 500, 18, '#fff', 'center', '900', 14, '#7ff');
    for (let i = 0; i < 2; i++) {
      const a = rand(0, Math.PI * 2), s = rand(60, 260);
      particles.push({ x: rand(0, W), y: rand(H * 0.1, H * 0.4), vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, max: 1,
        size: rand(2, 5), color: `hsl(${rand(0, 360)},100%,65%)`, g: 120, drag: 1, kind: 'shard' });
    }
  }
}

function render() {
  ctx.setTransform(baseT, 0, 0, baseT, 0, 0);
  ctx.save();
  if (shake > 0.2) ctx.translate(rand(-shake, shake) * 0.6, rand(-shake, shake) * 0.6);
  drawBackground();
  drawBricks();
  if (boss) drawBoss();
  for (const c of capsules) drawCapsule(c.x, c.y, c.type, c.t);
  drawProjectiles();
  if (barrier) drawBarrier();
  drawPaddle();
  drawBalls();
  drawParticles();
  ctx.restore();

  if (flashScreen > 0) { ctx.fillStyle = `rgba(255,255,255,${flashScreen * 0.45})`; ctx.fillRect(0, 0, W, H); }
  ctx.drawImage(vignette, 0, 0, W, H);
  if (state !== 'title') drawHUD();
  drawBanner();
  if (state === 'play' && !demo && deathTimer <= 0 && balls.some(b => b.stuck && !b.caught) && Math.floor(time * 2.5) % 2 === 0) {
    text('CLICK  /  SPACE  TO LAUNCH', W / 2, PADDLE_Y - 48, 15, 'rgba(255,255,255,0.85)', 'center', '800', 10, '#7ff');
  }
  if (slowmo > 0 && clearing) {
    ctx.globalAlpha = clamp(slowmo, 0, 1) * 0.9;
    text(clearLabel, W / 2, H * 0.45, 64, '#fff', 'center', '900', 30, `hsl(${themeHue},100%,65%)`);
    ctx.globalAlpha = 1;
  }
  drawOverlay();
}

// ============================================================ input
function toGame(cx, cy) {
  const r = canvas.getBoundingClientRect();
  return { x: (cx - r.left) * W / r.width, y: (cy - r.top) * H / r.height };
}
let escArmed = 0;
function onAction() {
  SFX.init();
  switch (state) {
    case 'title': startGame(); break;
    case 'play': launch(); break;
    case 'paused': togglePause(); break;
    case 'clear': if (clearTimer < 3.6) nextLevel(); break;
    case 'gameover': if (overTimer > 1) toTitle(); break;
    case 'victory': if (overTimer > 1.5) { loadLevel(levelIndex); state = 'play'; } break;
  }
}
window.addEventListener('mousemove', e => {
  if (demo || state !== 'play') return;
  paddle.target = toGame(e.clientX, e.clientY).x;
});
window.addEventListener('mousedown', e => { if (e.button === 0) onAction(); });
function touchMove(e) {
  e.preventDefault();
  const t = e.touches[0];
  if (t && !demo && state === 'play') paddle.target = toGame(t.clientX, t.clientY).x;
}
window.addEventListener('touchstart', e => { touchMove(e); onAction(); }, { passive: false });
window.addEventListener('touchmove', touchMove, { passive: false });
window.addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = true;
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = true;
  else if (k === ' ' || k === 'Enter' || k === 'ArrowUp' || k === 'w' || k === 'W') { if (!e.repeat) onAction(); }
  else if (k === 'p' || k === 'P') togglePause();
  else if (k === 'Escape') {
    if (state === 'paused' && time - escArmed < 2) { toTitle(); SFX.duck(false); }
    else if (state === 'play') { togglePause(); escArmed = time; }
    else if (state === 'paused') escArmed = time;
  }
  else if (k === 'm' || k === 'M') { SFX.init(); SFX.toggleMute(); }
  else if (k === 'n' || k === 'N') { SFX.init(); SFX.toggleMusic(); }
});
window.addEventListener('keyup', e => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
});
window.addEventListener('blur', () => { keys.left = keys.right = false; if (state === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
window.addEventListener('beforeunload', saveHi);

// ============================================================ loop
loadDemo();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// tiny debug hook for automated testing
window.__pb = { get state() { return state; }, startGame, loadLevel: i => { loadLevel(i); state = 'play'; }, get balls() { return balls; },
  get bricks() { return bricks; }, get score() { return score; }, get lives() { return lives; }, get boss() { return boss; }, step: n => { for (let i = 0; i < n; i++) update(1 / 60); render(); }, applyPU: id => applyPU(PU_TYPES.find(p => p.id === id)), launch };
})();
