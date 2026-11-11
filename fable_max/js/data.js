'use strict';
/* ==========================================================================
   HADAL — static game data: geometry, zones, stages, bricks, capsules, perks
   ========================================================================== */

/* ---------- playfield geometry (logical units) ---------- */
const W = 832, H = 880;
const COLS = 13, ROWS = 26;
const CELL_W = 64, CELL_H = 30;
const TOP = 56;                 // y of the ceiling
const BRICK_TOP = 86;           // y of brick row 0
const PADDLE_Y = 800, PADDLE_H = 18, PADDLE_W = 124;
const BALL_R = 8;
const NET_Y = 836;
const FONT = '"Avenir Next", "Segoe UI", "Helvetica Neue", Roboto, "Noto Sans", Arial, sans-serif';

/* ---------- the five zones of the ocean ---------- */
const ZONES = [
  {
    id: 'sun', name: 'Sunlight Zone', sci: 'Epipelagic', range: '0 – 200 m',
    blurb: 'Where the light still reaches.',
    bg: { top: '#52d8dc', mid: '#1b8dc4', bot: '#0a4a8a', rays: 1, kelp: 1, fish: 1, jelly: 0, lumen: 0, snow: 0.35, vent: 0, rock: 0.5, field: 0.34 },
    coral: ['#ff6b6b', '#ff9f5a', '#ffd35c', '#ff8fc7', '#fff1dc', '#b58cff'],
    style: 'solid', stone: '#93a9bd', basalt: '#5f7391', accent: '#bff6ff', song: 'sun', speed: 384,
  },
  {
    id: 'twi', name: 'Twilight Zone', sci: 'Mesopelagic', range: '200 – 1,000 m',
    blurb: 'The last of the sunlight fades.',
    bg: { top: '#1f66b0', mid: '#133c88', bot: '#091a50', rays: 0.4, kelp: 0, fish: 0.45, jelly: 1, lumen: 0.15, snow: 0.6, vent: 0, rock: 0.4, field: 0.36 },
    coral: ['#7c9cff', '#b47bff', '#ff7bd5', '#5cd0ff', '#5ff0d0', '#ffd36b'],
    style: 'solid', stone: '#8794c4', basalt: '#56608f', accent: '#a9c8ff', song: 'twi', speed: 398,
  },
  {
    id: 'mid', name: 'Midnight Zone', sci: 'Bathypelagic', range: '1,000 – 4,000 m',
    blurb: 'No sunlight. Only living light.',
    bg: { top: '#081c42', mid: '#050f2a', bot: '#020510', rays: 0, kelp: 0, fish: 0, jelly: 0.5, lumen: 1, snow: 0.9, vent: 0, rock: 0.3, field: 0.3 },
    coral: ['#3df2ff', '#5dffa8', '#ff5fb7', '#b78bff', '#ffe45c', '#ff8a4c'],
    style: 'neon', stone: '#7f93c9', basalt: '#5868a8', accent: '#7ff5ff', song: 'mid', speed: 424,
  },
  {
    id: 'aby', name: 'The Abyss', sci: 'Abyssopelagic', range: '4,000 – 6,000 m',
    blurb: 'Near freezing. Crushing pressure.',
    bg: { top: '#060e22', mid: '#030816', bot: '#010208', rays: 0, kelp: 0, fish: 0, jelly: 0.15, lumen: 0.55, snow: 1, vent: 0, rock: 0.25, field: 0.3 },
    coral: ['#7fd4ff', '#7f97ff', '#f4e3b8', '#b79cff', '#5fe8d0', '#ff9fd0'],
    style: 'neon', stone: '#93a6d6', basalt: '#6474ae', accent: '#cfe9ff', song: 'aby', speed: 448,
  },
  {
    id: 'had', name: 'Hadal Trench', sci: 'Hadalpelagic', range: '6,000 – 10,935 m',
    blurb: 'The deepest places on Earth.',
    bg: { top: '#0b0712', mid: '#12070a', bot: '#2c0b04', rays: 0, kelp: 0, fish: 0, jelly: 0, lumen: 0.2, snow: 0.7, vent: 1, rock: 1, field: 0.34 },
    coral: ['#ff7043', '#ffb347', '#ff4d6d', '#ffd76b', '#c77dff', '#64dfdf'],
    style: 'neon', stone: '#b08a7c', basalt: '#8a5d55', accent: '#ffb38a', song: 'had', speed: 470,
  },
];

/* ---------- brick types ---------- */
const BT = {
  coral:   { hp: 1, score: 10, counts: true },
  stone:   { hp: 2, score: 25, counts: true },
  basalt:  { hp: 3, score: 40, counts: true },
  steel:   { hp: 1, score: 0, counts: false, steel: true, color: '#9aa9ba' },
  mine:    { hp: 1, score: 20, counts: true, color: '#ff5a5a', glow: '#ff3b3b' },
  eel:     { hp: 1, score: 30, counts: true, color: '#ffe45c', glow: '#ffe45c' },
  oyster:  { hp: 1, score: 30, counts: true, color: '#f4e9ff', glow: '#e9f4ff' },
  gold:    { hp: 1, score: 50, counts: true, color: '#ffc94a', glow: '#ffc94a' },
  phantom: { hp: 1, score: 30, counts: true, color: '#7ff5ff', glow: '#7ff5ff' },
  ink:     { hp: 1, score: 20, counts: true, color: '#8a5cff', glow: '#6a3cff' },
  hot:     { hp: 1, score: 25, counts: true, color: '#ff7b2e', glow: '#ff6a00' },
  jelly:   { hp: 2, score: 40, counts: true, mover: true, color: '#ff9be6', glow: '#ff8fe0' },
  fish:    { hp: 1, score: 30, counts: false, mover: true, color: '#9dfcff', glow: '#7ff5ff' },
};

/* map legend */
const MAP_CHARS = {
  a: { t: 'coral', ci: 0 }, b: { t: 'coral', ci: 1 }, c: { t: 'coral', ci: 2 },
  d: { t: 'coral', ci: 3 }, e: { t: 'coral', ci: 4 }, f: { t: 'coral', ci: 5 },
  S: { t: 'stone' }, T: { t: 'basalt' }, X: { t: 'steel' },
  M: { t: 'mine' }, E: { t: 'eel' }, P: { t: 'oyster' }, G: { t: 'gold' },
  F: { t: 'phantom' }, I: { t: 'ink' }, H: { t: 'hot' }, J: { t: 'jelly' },
};

/* ---------- stages: 5 zones × 3 ---------- */
const STAGES = [
  /* ============ SUNLIGHT ZONE ============ */
  {
    zone: 0, name: 'First Light', depth: 40, tip: 'move',
    map: [
      '.............',
      '.aaaaaaaaaaa.',
      '.bbbbbGbbbbb.',
      '.ccccc.ccccc.',
      '.dddd...dddd.',
      '.fff.....fff.',
      '.ee...P...ee.',
    ],
  },
  {
    zone: 0, name: 'Coral Garden', depth: 110, tip: 'pulse',
    map: [
      '.............',
      '...bbbbb...a.',
      '.bbceccebb.aa',
      'bbcPecceccbaa',
      'bccceccecccba',
      'bbcGecceccbaa',
      '.bbceccebb.aa',
      '...bbbbb...a.',
    ],
  },
  {
    zone: 0, name: 'The Vault', depth: 190, tip: 'focus',
    note: 'Stone takes two hits. Something glitters inside.',
    map: [
      '.............',
      '.SSSSSSSSSSS.',
      '.SdddddddddS.',
      '.Sd.P.G.P.dS.',
      '.SdddddddddS.',
      '.aaaaaaaaaaa.',
      '.bb.bb.bb.bb.',
      '.c..c...c..c.',
    ],
  },

  /* ============ TWILIGHT ZONE ============ */
  {
    zone: 1, name: 'Blue Hour', depth: 320,
    note: 'Mines take their neighbours with them.',
    map: [
      'aa....c....aa',
      'ab...cdc...ba',
      '....cdddc....',
      '...cddMddc...',
      '..cdd.G.ddc..',
      '...cddMddc...',
      '....cdddc....',
      'eb...cdc...be',
      'ee....c....ee',
      '.............',
      '..J..........',
      '..........J..',
    ],
  },
  {
    zone: 1, name: 'Drifters', depth: 600,
    note: 'Jellies drift between the reefs.',
    map: [
      '.............',
      'bbbbbbbbbbbbb',
      '..J..........',
      '.S.S.S.S.S.S.',
      '.......J.....',
      'ccccMccccMccc',
      '....J........',
      '.d.d.d.d.d.d.',
      '..........J..',
      'ee.ee.G.ee.ee',
    ],
  },
  {
    zone: 1, name: 'Medusa', depth: 900, boss: 'medusa',
    note: 'Strike the bell. Dodge the stingers.',
    map: [
      '.............', '.............', '.............', '.............', '.............',
      '.............', '.............', '.............', '.............',
      'ab.........ba',
      'Gb.........bG',
      'ab.........ba',
    ],
  },

  /* ============ MIDNIGHT ZONE ============ */
  {
    zone: 2, name: 'Lights Out', depth: 1400, dark: 0.44,
    note: 'Phantoms flicker. Eels shock the whole row.',
    map: [
      '.............',
      'F.F.F.F.F.F.F',
      '.aaaaaEaaaaa.',
      '.b.b.b.b.b.b.',
      'EdddddddddddE',
      '.c.c.c.c.c.c.',
      '.bbbbbEbbbbb.',
      'F.F.F.F.F.F.F',
    ],
  },
  {
    zone: 2, name: 'Eight Arms', depth: 2600, dark: 0.36,
    note: 'Break the eyes and the ink flows.',
    map: [
      '.............',
      '....ddddd....',
      '...ddddddd...',
      '..ddIdddIdd..',
      '..ddddMdddd..',
      '...c.ccc.c...',
      '..cc.c.c.cc..',
      '.cc..c.c..cc.',
      'cc..cc.cc..cc',
      'G...c...c...G',
    ],
  },
  {
    zone: 2, name: 'The Lantern', depth: 3800, boss: 'lantern', dark: 0.9,
    note: 'Its lure is its weakness.',
    map: [
      '.............', '.............', '.............', '.............', '.............',
      '.............', '.............', '.............', '.............', '.............',
      'bb.........bb',
      'aG.........Ga',
    ],
  },

  /* ============ THE ABYSS ============ */
  {
    zone: 3, name: 'Cold Current', depth: 4300,
    note: 'Currents bend the pearl’s path.',
    currents: [{ y0: 410, y1: 530, f: 640 }, { y0: 590, y1: 710, f: -640 }],
    map: [
      '.............',
      'aaaaaaaaaaaaa',
      'bbbbbbbbbbbbb',
      'X.X.X.X.X.X.X',
      'ccccccGcccccc',
      '.............',
      'dd.ddd.ddd.dd',
      '.S..S...S..S.',
      'ee.eee.eee.ee',
    ],
  },
  {
    zone: 3, name: 'The Wreck', depth: 5000,
    note: 'Something valuable is still in the hold.',
    map: [
      '......f......',
      '..f...c...f..',
      '..c..ccc..c..',
      '.ccc.ccc.ccc.',
      '..c...c...c..',
      'SSSSSSSSSSSSS',
      '.SbGbPbPbGbS.',
      '..SbbbMbbbS..',
      '...SSSSSSS...',
    ],
  },
  {
    zone: 3, name: 'Pressure', depth: 5800, descend: 8.5,
    note: 'The ceiling is coming down.',
    map: [
      'aaaaaaaaaaaaa',
      'bMbbbbMbbbbMb',
      'ccccccccccccc',
      'dddSdddddSddd',
      'eeeeeeGeeeeee',
      'fMfffffffffMf',
    ],
  },

  /* ============ HADAL TRENCH ============ */
  {
    zone: 4, name: 'Black Smokers', depth: 6900, vents: [224, 608],
    note: 'Vents hurl pearls skyward. Magma burns on a fuse.',
    map: [
      '.............',
      '.T.........T.',
      'TTT...f...TTT',
      'aHa..fff..aHa',
      'aaa.ffHff.aaa',
      'cHc..fff..cHc',
      'ccc...f...ccc',
      'bbb.......bbb',
      'bGb..eee..bGb',
    ],
  },
  {
    zone: 4, name: 'The Narrows', depth: 8800,
    note: 'Steel does not break. Thread the gap.',
    map: [
      '.aaaaaaaaaaa.',
      '.bbbbbGbbbbb.',
      '.cccMcccMccc.',
      '.ddddHdHdddd.',
      '.XXXX...XXXX.',
      '.XXX.....XXX.',
      '.............',
      'e.ee.e.e.ee.e',
      '.f.........f.',
    ],
  },
  {
    zone: 4, name: 'Leviathan', depth: 10935, boss: 'leviathan', vents: [224, 608],
    note: 'Break its plates. Strike the head.',
    map: [
      '.............', '.............', '.............', '.............', '.............',
      '.............', '.............', '.............', '.............', '.............',
      '.............',
      'dd.........dd',
      'aG.........Ga',
    ],
  },
];

/* ---------- capsules (falling power-ups) ---------- */
const POWERUPS = {
  wide:   { name: 'Widen',        color: '#6fe7ff', good: true,  w: 12, dur: 16, desc: 'A longer hull for a while.' },
  multi:  { name: 'Tri-Pearl',    color: '#c9b8ff', good: true,  w: 10, dur: 0,  desc: 'Every pearl splits into three.' },
  laser:  { name: 'Harpoons',     color: '#ffb05a', good: true,  w: 8,  dur: 9,  desc: 'Twin harpoons fire on their own.' },
  pierce: { name: 'Magma Pearl',  color: '#ff7a3d', good: true,  w: 6,  dur: 7,  desc: 'Pearls burn straight through bricks.' },
  sticky: { name: 'Tether',       color: '#7dffb0', good: true,  w: 6,  dur: 14, desc: 'Catch pearls, release them charged.' },
  slow:   { name: 'Calm',         color: '#9fd4ff', good: true,  w: 6,  dur: 10, desc: 'The water thickens. Pearls slow.' },
  net:    { name: 'Net',          color: '#5ff0d0', good: true,  w: 7,  dur: 0,  desc: 'Saves one falling pearl.' },
  blast:  { name: 'Depth Charge', color: '#ffd35c', good: true,  w: 7,  dur: 0,  desc: 'The next brick hit detonates.' },
  life:   { name: 'Spare Pearl',  color: '#ff8fb8', good: true,  w: 2,  dur: 0,  desc: 'One extra life.' },
  shrink: { name: 'Squeeze',      color: '#ff4d5e', good: false, w: 5,  dur: 10, desc: 'Urchin — shrinks the hull.' },
  fast:   { name: 'Riptide',      color: '#ff4d5e', good: false, w: 5,  dur: 8,  desc: 'Urchin — pearls speed up.' },
};

/* ---------- perks (chosen between stages) ---------- */
const PERKS = [
  { id: 'wide',     name: 'Wide Hull',       icon: 'wide',     max: 3, desc: 'Your hull is 14% longer.' },
  { id: 'twin',     name: 'Twin Pearls',     icon: 'twin',     max: 2, desc: 'Launch an extra pearl at the start of every stage.' },
  { id: 'tank',     name: 'Spare Pearl',     icon: 'life',     max: 2, desc: 'Gain a life now, and +1 to your maximum.' },
  { id: 'sonar',    name: 'Sonar Array',     icon: 'sonar',    max: 2, desc: 'Focus lasts 50% longer and recharges faster.' },
  { id: 'amp',      name: 'Pulse Amplifier', icon: 'amp',      max: 3, desc: 'Pulsed pearls pierce one more brick.' },
  { id: 'luck',     name: 'Lucky Current',   icon: 'luck',     max: 2, desc: 'Capsules drop 35% more often.' },
  { id: 'magnet',   name: 'Magnetic Keel',   icon: 'magnet',   max: 1, desc: 'Good capsules drift toward your hull.' },
  { id: 'net',      name: 'Safety Net',      icon: 'net',      max: 2, desc: 'Begin every stage with a net beneath you.' },
  { id: 'volatile', name: 'Volatile Coral',  icon: 'volatile', max: 3, desc: 'Broken bricks have a 9% chance to explode.' },
  { id: 'arc',      name: 'Eel Skin',        icon: 'arc',      max: 3, desc: 'Broken bricks have a 12% chance to arc lightning to their neighbours.' },
  { id: 'chain',    name: 'Long Breath',     icon: 'chain',    max: 2, desc: 'Chains last longer and the multiplier cap rises by 2.' },
  { id: 'rack',     name: 'Harpoon Rack',    icon: 'rack',     max: 3, desc: 'Your hull fires a harpoon on its own every few seconds.' },
  { id: 'heavy',    name: 'Dense Core',      icon: 'heavy',    max: 1, desc: 'Pearls deal +1 damage to everything.' },
  { id: 'timer',    name: 'Slow Release',    icon: 'timer',    max: 2, desc: 'Timed capsules last 35% longer.' },
  { id: 'hull',     name: 'Urchin Guard',    icon: 'hull',     max: 1, desc: 'Urchins turn into harmless points. Stuns are halved.' },
  { id: 'echo',     name: 'Echo',            icon: 'echo',     max: 2, desc: 'Every 4th hull bounce spawns a short-lived echo pearl.' },
  { id: 'score',    name: 'Treasure Hunter', icon: 'score',    max: 3, desc: '+20% score from everything.' },
  { id: 'calm',     name: 'Still Water',     icon: 'slow',     max: 2, desc: 'Pearls travel 7% slower.' },
  { id: 'gift',     name: 'Care Package',    icon: 'gift',     max: 2, desc: 'A helpful capsule drops at the start of every stage.' },
  { id: 'charge',   name: 'Depth Charger',   icon: 'blast',    max: 3, desc: 'Every few perfect pulses, your pearl is armed with a depth charge.' },
];
const PERK_BY_ID = {};
PERKS.forEach((p) => { PERK_BY_ID[p.id] = p; });
