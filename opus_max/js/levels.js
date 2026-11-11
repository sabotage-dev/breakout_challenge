/* SHATTERWAVE — campaign levels, bosses and the procedural Overtime generator */
'use strict';
SW.PALETTE = {
  r: '#ff3b6b', o: '#ff8a3d', y: '#ffd23f', g: '#3dff8a', c: '#2de2ff',
  b: '#4d7cff', p: '#a64dff', m: '#ff4dd8', w: '#e8f0ff',
};
// special brick glyphs -> kind/hp/color
SW.SPECIAL = {
  '2': { kind: 'armor', hp: 2, color: '#8e9cff' },
  '3': { kind: 'armor', hp: 3, color: '#ffb84d' },
  '#': { kind: 'steel', hp: Infinity, color: '#8a93a8' },
  '*': { kind: 'bomb', hp: 1, color: '#ff5a36' },
  '?': { kind: 'mystery', hp: 1, color: '#ffd23f' },
  '+': { kind: 'crystal', hp: 1, color: '#9ff6ff' },
  '~': { kind: 'ghost', hp: 1, color: '#c9b6ff' },
};

SW.SECTORS = [
  { key: 's1', name: 'NEON DRIFT', music: 's1' },
  { key: 's2', name: 'AURORA DEEP', music: 's2' },
  { key: 's3', name: 'SOLAR FORGE', music: 's3' },
];

SW.BOSSES = {
  warden: {
    name: 'THE WARDEN', r: 50, hp: 28, color: '#ff3b8b', iris: '#2de2ff', x: 360, y: 300,
    move: { ax: 170, ay: 22, sx: 0.5, sy: 1.1 },
    rings: [{ n: 10, rad: 94, speed: 0.8, regen: 5 }],
    attack: { kind: 'aimed', every: 2.7, speed: 250 },
    phases: [{ at: 0.5, attack: 'spread3', everyMul: 0.8, speedMul: 1.35, roar: true }],
  },
  sentinelA: {
    name: 'SENTINEL α', r: 38, hp: 16, color: '#21f5c4', iris: '#b26bff', x: 220, y: 320,
    move: { type: 'liss', ax: 105, ay: 60, sx: 0.55, sy: 0.9, phase: 0 },
    rings: [{ n: 6, rad: 68, speed: 1.2, regen: 6 }],
    attack: { kind: 'aimed', every: 3.3, speed: 255, offset: 0 },
    phases: [{ at: 0.5, attack: 'spread3', everyMul: 0.9 }],
  },
  sentinelB: {
    name: 'SENTINEL β', r: 38, hp: 16, color: '#b26bff', iris: '#21f5c4', x: 500, y: 320,
    move: { type: 'liss', ax: 105, ay: 60, sx: 0.55, sy: 0.9, phase: Math.PI },
    rings: [{ n: 6, rad: 68, speed: -1.2, regen: 6 }],
    attack: { kind: 'aimed', every: 3.3, speed: 255, offset: 1.6 },
    phases: [{ at: 0.5, attack: 'spread3', everyMul: 0.9 }],
  },
  helios: {
    name: 'HELIOS PRIME', r: 62, hp: 50, color: '#ff7a1a', iris: '#ffd23f', x: 360, y: 335,
    move: { ax: 150, ay: 28, sx: 0.42, sy: 0.8 },
    rings: [{ n: 10, rad: 100, speed: 0.9, regen: 7, hp: 2 }, { n: 16, rad: 146, speed: -0.55, regen: 9 }],
    attack: { kind: 'aimed', every: 2.5, speed: 265 },
    phases: [
      { at: 0.66, attack: 'spread3', everyMul: 0.85, speedMul: 1.2, roar: true },
      { at: 0.33, attack: 'spread5', everyMul: 0.75, speedMul: 1.5, roar: true, regenMul: 0.6 },
    ],
  },
};

SW.LEVELS = [
  // ---------------- SECTOR 1: NEON DRIFT ----------------
  { name: 'FIRST LIGHT', map: [
    '.............',
    'rrrrrrrrrrrrr',
    'oooo?ooo?oooo',
    'yyyyyyyyyyyyy',
    'ggggggggggggg',
    'ccccccccccccc',
    'bbbbbb+bbbbbb',
  ] },
  { name: 'HEARTBEAT', map: [
    '.............',
    '..mmm...mmm..',
    '.mrrrm.mrrrm.',
    'mrrwrrmrrrrrm',
    'mrrrrrrrrrrrm',
    'mrrr?rrr?rrrm',
    '.mrrrrrrrrrm.',
    '..mrrrrrrrm..',
    '...mrr+rrm...',
    '....mrrrm....',
    '.....m2m.....',
    '......2......',
  ] },
  { name: 'CHEVRONS', map: [
    'yyyy.....yyyy',
    '.............',
    '2...........2',
    'c2.........2c',
    'cc2.......2cc',
    'bcc2.....2ccb',
    '.bcc2...2ccb.',
    '..bcc2.2ccb..',
    '...bcc?ccb...',
    '....bc*cb....',
    '.....b+b.....',
  ], move: [{ row: 0, amp: 60, speed: 1.1 }] },
  { name: 'THE WARDEN', boss: ['warden'], map: [
    'ppppppppppppp',
    'm?mmmmmmmmm?m',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    'cc.........cc',
  ] },
  // ---------------- SECTOR 2: AURORA DEEP ----------------
  { name: 'LATTICE', map: [
    '#.#.#.#.#.#.#',
    '.c.c.c.c.c.c.',
    'c.b.c.*.c.b.c',
    '.b.c.b.b.c.b.',
    'c.c.?.c.?.c.c',
    '.c.b.c.c.b.c.',
    'b.*.b.b.b.*.b',
    '.b.b.b.b.b.b.',
    '2.2.2.2.2.2.2',
  ] },
  { name: 'JELLYFISH', map: [
    '....ppppp....',
    '..ppmmmmmpp..',
    '.pmmwmmmwmmp.',
    'pmmmmm?mmmmmp',
    'pmmmmmmmmmmmp',
    'p2p2p2p2p2p2p',
    '.~.~.~.~.~.~.',
    '.~..~.~.~..~.',
    '~...~...~...~',
    '.~...~.~...~.',
  ], move: [{ row: 6, amp: 14, speed: 1.6 }, { row: 7, amp: 16, speed: 1.6, phase: 0.6 }, { row: 8, amp: 10, speed: 1.6, phase: 1.2 }, { row: 9, amp: 18, speed: 1.6, phase: 1.8 }] },
  { name: 'PINBALL WIZARDRY', map: [
    'ggggggggggggg',
    'g2g2g2?2g2g2g',
    'ccccccccccccc',
    'b.b.b.b.b.b.b',
    '..y.......y..',
  ], bumpers: [[150, 350, 24], [360, 315, 28], [570, 350, 24], [255, 440, 22], [465, 440, 22]],
     portals: [[70, 620, 650, 280]] },
  { name: 'TWIN SENTINELS', boss: ['sentinelA', 'sentinelB'], map: [
    'c.c.c.c.c.c.c',
    '.b.b.b?b.b.b.',
  ] },
  // ---------------- SECTOR 3: SOLAR FORGE ----------------
  { name: 'FIREWALL', map: [
    'yyyyyyyyyyyyy',
    'ooo*ooooo*ooo',
    'rrrrrr+rrrrrr',
    '##.#######.##',
    '.............',
    'r2r2r2*2r2r2r',
    'ooooo?o?ooooo',
    'yy*yyyyyyy*yy',
  ] },
  { name: 'ECLIPSE', map: [
    '....33333....',
    '..33ooooo33..',
    '.3oo#####oo3.',
    '3oo#yyyyy#oo3',
    '3o#yy?w?yy#o3',
    '3o#yyyyyyy#o3',
    '3oo#yyyyy#oo3',
    '.3oo##.##oo3.',
    '..33ooooo33..',
    '....33333....',
  ], portals: [[80, 640, 640, 520]] },
  { name: 'THE GAUNTLET', map: [
    '3333333333333',
    '2+222*2*222+2',
    '..ooo...ooo..',
    '..rrr.?.rrr..',
    '~~~~~~~~~~~~~',
    'ppp*ppppp*ppp',
    '..bbb...bbb..',
    '2222222222222',
  ], move: [{ row: 2, amp: 90, speed: 1.0 }, { row: 3, amp: 90, speed: 1.0, phase: Math.PI }, { row: 6, amp: 90, speed: 1.3, phase: Math.PI / 2 }] },
  { name: 'HELIOS PRIME', boss: ['helios'], map: [
    'w?wwwwwwwww?w',
  ] },
];
SW.LEVELS.forEach((L, i) => { L.index = i; L.sector = Math.floor(i / 4) + 1; L.stage = (i % 4) + 1; L.label = `${L.sector}-${L.stage}`; });

/* ---------- Overtime: procedural, endless ---------- */
SW.genLevel = function (wave) {
  const rnd = U.rng(wave * 7919 + 1337);
  const R = (a, b) => a + rnd() * (b - a);
  const pickR = (arr) => arr[Math.floor(rnd() * arr.length)];
  const cols = 13, half = 7;
  if (wave % 5 === 0) {
    const n = wave / 5;
    const twin = n % 2 === 0;
    const scale = 1 + n * 0.18;
    const mk = (key) => {
      const b = JSON.parse(JSON.stringify(SW.BOSSES[key]));
      b.hp = Math.round(b.hp * scale);
      b.attack.every /= Math.min(1.6, 1 + n * 0.08);
      b.attack.speed *= Math.min(1.35, 1 + n * 0.05);
      return b;
    };
    return {
      name: twin ? 'TWIN ECHOES' : (n % 3 === 1 ? 'WARDEN REBORN' : 'HELIOS ASCENDANT'), endless: true, wave,
      boss: twin ? [mk('sentinelA'), mk('sentinelB')] : [mk(n % 3 === 1 ? 'warden' : 'helios')],
      map: ['m?mmmmmmmmm?m'],
    };
  }
  const rows = Math.min(12, 6 + Math.floor(wave / 2) + Math.floor(R(0, 2)));
  const style = pickR(['sprite', 'rings', 'stripes', 'blocks', 'sprite', 'waves']);
  const letters = 'roygcbpm';
  const start = Math.floor(R(0, 8));
  const colorAt = (r, c) => letters[(start + Math.floor(r / (style === 'stripes' ? 1 : 2)) + (style === 'rings' ? c : 0)) % 8];
  const grid = [];
  const cx = 6, cy = (rows - 1) / 2;
  for (let r = 0; r < rows; r++) {
    const row = new Array(cols).fill('.');
    for (let c = 0; c < half; c++) {
      let on = false;
      if (style === 'sprite') on = rnd() < 0.72;
      else if (style === 'rings') on = Math.floor(Math.abs(c - cx) + Math.abs(r - cy)) % 3 !== 2;
      else if (style === 'stripes') on = (r + c) % 4 < 2 || r % 4 === 0;
      else if (style === 'blocks') on = (Math.floor(r / 2) + Math.floor(c / 2)) % 2 === 0 || rnd() < 0.2;
      else on = Math.abs(Math.sin(c * 0.7 + wave) * 3 - (r % 6) + 2) < 1.6;
      if (!on) continue;
      let ch = colorAt(r, c);
      const t = rnd();
      const a2 = Math.min(0.3, 0.04 + wave * 0.02), a3 = Math.min(0.18, wave * 0.012);
      const st = wave > 2 ? Math.min(0.08, wave * 0.006) : 0;
      if (t < a3) ch = '3';
      else if (t < a3 + a2) ch = '2';
      else if (t < a3 + a2 + st) ch = '#';
      else if (t < a3 + a2 + st + 0.05) ch = '*';
      else if (t < a3 + a2 + st + 0.085) ch = '?';
      else if (t < a3 + a2 + st + 0.1) ch = '+';
      else if (wave > 3 && t < a3 + a2 + st + 0.14) ch = '~';
      row[c] = ch;
      row[cols - 1 - c] = ch === '?' || ch === '+' ? colorAt(r, c) : ch;
    }
    grid.push(row.join(''));
  }
  // guarantee enough breakables
  let count = 0;
  for (const row of grid) for (const ch of row) if (ch !== '.' && ch !== '#') count++;
  if (count < 40) grid.unshift(letters[(start + 3) % 8].repeat(13));
  if (count < 26) grid.push('2'.repeat(13));
  const A = ['STATIC', 'GLASS', 'NULL', 'RIFT', 'ECHO', 'PRISM', 'HEX', 'VOID', 'NEON', 'DATA', 'CHROME', 'LUNAR', 'PHASE', 'QUANTUM', 'SILENT', 'VELVET'];
  const N = ['BLOOM', 'TIDE', 'ORCHARD', 'GARDEN', 'VAULT', 'STORM', 'CHOIR', 'LACE', 'REEF', 'SNOW', 'CATHEDRAL', 'ENGINE', 'MIRAGE', 'HIVE', 'SPIRAL', 'CASCADE'];
  const L = { name: pickR(A) + ' ' + pickR(N), endless: true, wave, map: grid.slice(0, 12) };
  // movement for sparse rows
  if (wave >= 3 && rnd() < 0.5) {
    L.move = [];
    for (let r = 0; r < grid.length; r++) if (rnd() < 0.25) L.move.push({ row: r, amp: R(40, 100), speed: R(0.8, 1.5), phase: R(0, 6) });
  }
  if (rnd() < 0.3) {
    const y = SW.GRID.y0 + grid.length * SW.GRID.pitchY + 90;
    if (y < 640) L.bumpers = [[200, y, 22], [520, y, 22], [360, y + 70, 26]];
  }
  if (rnd() < 0.25) L.portals = [[70, 660, 650, 660]];
  return L;
};

SW.getLevel = function (mode, n) {
  if (mode === 'endless') {
    const L = SW.genLevel(n + 1);
    L.label = 'OT-' + (n + 1);
    L.sector = 4;
    return L;
  }
  return SW.LEVELS[n];
};
