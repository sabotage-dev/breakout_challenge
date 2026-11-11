'use strict';
/* =====================================================================
   PRISM BREAKER — level data
   Map legend (14 columns):
     .        empty
     1-8      standard brick (palette colour)
     A-H      armored brick, 2 hits (colour 1-8)
     U        ultra brick, 3 hits
     #        steel (indestructible)
     X        volatile — explodes, chain reacts
     *        prism — splits light: spawns 2 extra balls
     $        gold — guaranteed power-up, big points
   ===================================================================== */

const PALETTE = {
  1: '#ff3b6b', 2: '#ff8a3d', 3: '#ffe14d', 4: '#4dff88',
  5: '#3de8ff', 6: '#4d7bff', 7: '#b44dff', 8: '#ff4df0',
};

const SECTORS = [
  { id: 0, name: 'NEON CITY',       sub: 'SECTOR 1', song: 's1', theme: 'city',  accent: '#ff4df0', accent2: '#3de8ff' },
  { id: 1, name: 'ABYSSAL CURRENT', sub: 'SECTOR 2', song: 's2', theme: 'abyss', accent: '#3de8ff', accent2: '#4dff88' },
  { id: 2, name: 'SOLAR CORE',      sub: 'SECTOR 3', song: 's3', theme: 'solar', accent: '#ff8a3d', accent2: '#ffe14d' },
];
const ENDLESS_SECTOR = { id: 3, name: 'ENDLESS RIFT', sub: 'ENDLESS', song: 'endless', theme: 'rift', accent: '#b44dff', accent2: '#3de8ff' };

const LEVELS = [
  // ---------------- SECTOR 1 : NEON CITY ----------------
  { sector: 0, name: 'BOOT SEQUENCE', map: [
    '..............',
    '88888888888888',
    '7777777$777777',
    '666$6666666666',
    '55555555555555',
  ] },
  { sector: 0, name: 'SKYLINE', map: [
    '.....HH.......',
    '.....88...AA..',
    '..GG.88...11..',
    '..77.$8FF.11..',
    'EE77.8866.11EE',
    '5577.8866D1155',
    '5577C886641155',
    '55773886641155',
  ] },
  { sector: 0, name: 'DIAMOND MINE', map: [
    '...C......E...',
    '..C2C....E6E..',
    '.C212C..E676E.',
    'C21X12CE67X76E',
    '.C212C..E676E.',
    '..C2C.**.E6E..',
    '...C......E...',
    '..............',
    '4.4.4.44.4.4.4',
  ] },
  { sector: 0, name: 'CROSSWALK', map: [
    '##....##....##',
    '...BBBBBBBB...',
    '..............',
    '.5.5.5.5.5.5..',
    '..6.6.6.6.6.6.',
    '..............',
    '....3X33X3....',
    '..............',
    '4444$4..4$4444',
  ], move: [
    { rows: [1], amp: 150, speed: 0.7 },
    { rows: [3], amp: 64, speed: 1.3 },
    { rows: [4], amp: 64, speed: 1.3, phase: Math.PI },
    { rows: [6], amp: 220, speed: 0.5, phase: 1 },
  ] },
  { sector: 0, name: 'THE WARDEN', boss: 'warden', map: [] },

  // ---------------- SECTOR 2 : ABYSSAL CURRENT ----------------
  { sector: 1, name: 'JELLYFISH', map: [
    '....EEEEEE....',
    '...E555555E...',
    '..E55*55*55E..',
    '..E66666666E..',
    '..7.7.77.7.7..',
    '...7.7..7.7...',
    '..8.8.88.8.8..',
    '...8.8..8.8...',
  ], move: [{ rows: [0, 1, 2, 3, 4, 5, 6, 7], amp: 96, speed: 0.6, wave: 0.32 }] },
  { sector: 1, name: 'CORAL REEF', map: [
    '#2222#..#2222#',
    '#3$*3#..#3*$3#',
    '#3333#..#3333#',
    '##..##..##..##',
    '..............',
    '4D4D4D44D4D4D4',
    '55555555555555',
    '6.6.6.66.6.6.6',
  ] },
  { sector: 1, name: 'RIPTIDE', map: [
    '..............',
    '..1111111111..',
    '..2222222222..',
    '..33X3333X33..',
    '..4444444444..',
    '..555*55*555..',
    '..6666666666..',
    '..GGGGGGGGGG..',
  ], move: [{ rows: [1, 2, 3, 4, 5, 6, 7], amp: 110, speed: 0.9, wave: 0.55 }] },
  { sector: 1, name: 'PRESSURE CHAMBER', map: [
    'UUUUUUUUUUUUUU',
    'EEEEEEEEEEEEEE',
    '#..###..###..#',
    '..............',
    '5$5555555555$5',
    '66666X66X66666',
    '77777777777777',
    '..............',
    '#.#.#.##.#.#.#',
  ] },
  { sector: 1, name: 'LEVIATHAN', boss: 'leviathan', map: [] },

  // ---------------- SECTOR 3 : SOLAR CORE ----------------
  { sector: 2, name: 'SOLAR FLARE', map: [
    '.....3333.....',
    '...X333333X...',
    '..33X2222X33..',
    '.332211112233.',
    'X32211UU11223X',
    '.332211112233.',
    '..3322222233..',
    '...X333333X...',
    '.....3333.....',
  ] },
  { sector: 2, name: 'THE FORGE', map: [
    'AAAAAAAAAAAAAA',
    '2222#2222#2222',
    '3333#3XX3#3333',
    '##.###..###.##',
    '..............',
    '44444444444444',
    '5555$5555$5555',
    'CCCCCCCCCCCCCC',
  ] },
  { sector: 2, name: 'FUSION GRID', map: [
    '1X1X1X11X1X1X1',
    '22222222222222',
    '3*3333333333*3',
    '44444444444444',
    '5X5X5X55X5X5X5',
    '66666666666666',
    '7777*7777*7777',
    '#..########..#',
  ] },
  { sector: 2, name: 'EVENT HORIZON', map: [
    'UUUUUUUUUUUUUU',
    'H888888888888H',
    'H8##########8H',
    'H8#X7*UU*7X#8H',
    'H8#77777777#8H',
    'H8###....###8H',
    'H888888888888H',
    '..............',
    '..6666666666..',
    '...5X5555X5...',
  ], move: [
    { rows: [8], amp: 120, speed: 0.8 },
    { rows: [9], amp: 150, speed: 0.8, phase: Math.PI },
  ] },
  { sector: 2, name: 'PRISM CORE', boss: 'core', map: [] },
];

// Deterministic PRNG so endless runs can be reproduced from a seed
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RIFT_NAMES = ['FRACTURE', 'STATIC BLOOM', 'GLASS TIDE', 'NULL ORCHARD', 'PHOTON MAZE', 'LATTICE', 'VOLTAGE', 'AFTERIMAGE',
  'PARALLAX', 'HALCYON', 'SPECTRAL ARRAY', 'DEAD PIXEL', 'CHROMA SHIFT', 'HYPERLOOP', 'FLUX GARDEN', 'REFRACTION'];

// Any breakable brick walled in by steel on all sides gets its steel turned into
// armored bricks, so every generated wave is guaranteed to be clearable.
function unsealMap(map) {
  const R = map.length, C = 14;
  const g = map.map(r => r.split(''));
  for (let iter = 0; iter < 40; iter++) {
    const seen = g.map(r => r.map(() => false));
    const q = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if ((r === 0 || r === R - 1 || c === 0 || c === C - 1) && g[r][c] !== '#') { seen[r][c] = true; q.push([r, c]); }
    }
    while (q.length) {
      const [r, c] = q.pop();
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= R || nc < 0 || nc >= C || seen[nr][nc] || g[nr][nc] === '#') continue;
        seen[nr][nc] = true; q.push([nr, nc]);
      }
    }
    let changed = false;
    for (let r = 0; r < R && !changed; r++) for (let c = 0; c < C && !changed; c++) {
      if (seen[r][c] || g[r][c] === '#') continue;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < R && nc >= 0 && nc < C && g[nr][nc] === '#') { g[nr][nc] = 'B'; changed = true; }
      }
    }
    if (!changed) break;
  }
  for (let r = 0; r < R; r++) map[r] = g[r].join('');
  return map;
}

// Procedural level generator for ENDLESS RIFT. Every 5th wave is a boss.
function generateLevel(n, seed) {
  const R = mulberry32((seed >>> 0) + n * 9973);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pickR = arr => arr[Math.floor(R() * arr.length)];
  const bosses = ['warden', 'leviathan', 'core'];
  if (n % 5 === 4) {
    const k = Math.floor(n / 5);
    return { sector: 3, name: 'RIFT GUARDIAN ' + (k + 1), boss: bosses[k % 3], hpScale: 1 + k * 0.3, map: [] };
  }
  const rows = Math.min(10, 5 + Math.floor(n / 3) + ri(0, 2));
  const style = pickR(['noise', 'stripes', 'checker', 'rings', 'pyramid', 'columns', 'diamonds']);
  const c1 = ri(1, 8), c2 = ((c1 + ri(2, 5)) % 8) + 1;
  const toughP = Math.min(0.38, 0.06 + n * 0.022);
  const steelP = Math.min(0.1, n * 0.008);
  const xP = 0.05, pP = 0.03, gP = 0.025;
  const map = [];
  for (let r = 0; r < rows; r++) {
    const half = [];
    for (let c = 0; c < 7; c++) {
      let filled = true, color = c1;
      switch (style) {
        case 'noise': filled = R() < 0.72; color = R() < 0.5 ? c1 : c2; break;
        case 'stripes': filled = r % 3 !== 2; color = (r % 8) + 1; break;
        case 'checker': filled = (r + c) % 2 === 0 || R() < 0.15; color = (r + c) % 2 ? c1 : c2; break;
        case 'rings': { const d = Math.floor(Math.max(Math.abs(r - (rows - 1) / 2) * 1.6, Math.abs(c - 6.5))); filled = d % 2 === 0; color = (d % 8) + 1; break; }
        case 'pyramid': filled = c >= 6 - r; color = (r % 8) + 1; break;
        case 'columns': filled = c % 2 === 0 || r === 0; color = (c % 8) + 1; break;
        case 'diamonds': { const d = Math.abs((r % 4) - 1.5) + Math.abs((c % 4) - 1.5); filled = d <= 2; color = d < 1.5 ? c1 : c2; break; }
      }
      let ch = '.';
      if (filled) {
        const roll = R();
        if (roll < steelP) ch = '#';
        else if (roll < steelP + xP) ch = 'X';
        else if (roll < steelP + xP + pP) ch = '*';
        else if (roll < steelP + xP + pP + gP) ch = '$';
        else if (roll < steelP + xP + pP + gP + toughP) ch = (n > 6 && R() < 0.3) ? 'U' : 'ABCDEFGH'[color - 1];
        else ch = String(color);
      }
      half.push(ch);
    }
    map.push(half.join('') + half.slice().reverse().join(''));
  }
  unsealMap(map);
  // guarantee enough breakable bricks
  const breakable = map.join('').replace(/[.#]/g, '').length;
  if (breakable < 16) map.push(String(c1).repeat(14), String(c2).repeat(14));
  const move = [];
  if (n >= 2 && R() < 0.55) {
    const count = ri(1, Math.min(4, map.length));
    const rowsSel = [];
    for (let i = 0; i < count; i++) rowsSel.push(ri(0, map.length - 1));
    move.push({ rows: rowsSel, amp: ri(60, 160), speed: 0.5 + R() * 0.8, wave: R() * 1.2 });
  }
  return { sector: 3, name: RIFT_NAMES[n % RIFT_NAMES.length], map, move };
}
