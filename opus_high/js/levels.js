/* SHATTERLIGHT — sector data
 *
 * Map legend (14 columns per row):
 *   .        empty
 *   r o y g c b p k w   standard crystal bricks (1 hit) by colour
 *   2 3      armoured bricks (2 / 3 hits)
 *   #        steel (indestructible)
 *   *        volatile — explodes, destroying neighbours
 *   ?        prism — always drops a power-up
 */
'use strict';

const BRICK_COLORS = {
  r: '#ff3b5c', o: '#ff8a3b', y: '#ffd93b', g: '#4dff88', c: '#3bf0ff',
  b: '#4b7bff', p: '#a45bff', k: '#ff4bd2', w: '#e6ecff',
};

const LEVELS = [
  {
    name: 'FIRST LIGHT', hue: 255,
    map: [
      '..............',
      'kkkkkkkkkkkkkk',
      'pppppp??pppppp',
      'bbbbbbbbbbbbbb',
      'cccccccccccccc',
      'gggggggggggggg',
      'yyyyyyyyyyyyyy',
    ],
  },
  {
    name: 'ZIGGURAT', hue: 280,
    map: [
      '......??......',
      '.....kkkk.....',
      '....pppppp....',
      '...bbbbbbbb...',
      '..cccc??cccc..',
      '.gggggggggggg.',
      'yyyyyyyyyyyyyy',
      '22222222222222',
    ],
  },
  {
    name: 'LATTICE', hue: 200,
    map: [
      '2.2.2.2.2.2.2.',
      '.c.c.c.c.c.c.c',
      'b.b.b.?.b.b.b.',
      '.p.p.p.p.p.p.p',
      'k.k.k.k.k.k.k.',
      '..............',
      '#oo#oo??oo#oo#',
      'rrrrrrrrrrrrrr',
    ],
  },
  {
    name: 'POWDER KEG', hue: 15,
    map: [
      'oooooooooooooo',
      'o*oooo**oooo*o',
      'yyyyyyyyyyyyyy',
      'yy*yyy??yyy*yy',
      'rrrrrrrrrrrrrr',
      'r*rrr*rr*rrr*r',
      '22222222222222',
    ],
  },
  {
    name: 'THE WARDEN', hue: 320, boss: {
      title: 'THE WARDEN', hp: 20, y: 252, fire: 2.6,
      rings: [{ n: 8, r: 92, speed: 0.9, hp: 1 }],
    },
    map: [
      'kk?k......k?kk',
    ],
  },
  {
    name: 'INVASION', hue: 140,
    map: [
      '...g......g...',
      '....g....g....',
      '...gggggggg...',
      '..gg3gggg3gg..',
      '.ggggg??ggggg.',
      '.g.gggggggg.g.',
      '.g.g......g.g.',
      '....yy..yy....',
    ],
  },
  {
    name: 'FORTRESS', hue: 220,
    map: [
      '..............',
      '.#####..#####.',
      '.#2222222222#.',
      '.#2?bbbbbb?2#.',
      '.#2bbb**bbb2#.',
      '.#2222222222#.',
      '.###......###.',
    ],
  },
  {
    name: 'DRIFT', hue: 175, drift: 80,
    map: [
      '..kkkkkkkkkk..',
      '..p2pp??pp2p..',
      '..bbbbbbbbbb..',
      '..c*cccccc*c..',
      '..gggggggggg..',
      '..y2yyyyyy2y..',
      '..oooooooooo..',
    ],
  },
  {
    name: 'HEART OF GLASS', hue: 300,
    map: [
      '......33......',
      '.....3223.....',
      '....32kk23....',
      '...32k**k23...',
      '..32kk??kk23..',
      '...32k**k23...',
      '....32kk23....',
      '.....3223.....',
      '......33......',
    ],
  },
  {
    name: 'WARDEN PRIME', hue: 350, boss: {
      title: 'WARDEN PRIME', hp: 32, y: 272, fire: 2.1,
      rings: [{ n: 8, r: 86, speed: 1.0, hp: 1 }, { n: 12, r: 130, speed: -0.6, hp: 2 }],
    },
    map: [
      'kk?kk....kk?kk',
    ],
  },
];

const CAMPAIGN_LENGTH = LEVELS.length;

// Seeded RNG so endless sectors are the same every run
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ADJ = ['NEON', 'HOLLOW', 'SILENT', 'BROKEN', 'VELVET', 'IRON', 'CRIMSON', 'GHOST', 'PRISM', 'SOLAR', 'STATIC', 'LUNAR', 'FERAL', 'GLASS', 'ECHO'];
const NOUN = ['GARDEN', 'CIRCUIT', 'CATHEDRAL', 'MIRAGE', 'ENGINE', 'ORCHARD', 'SPIRAL', 'VAULT', 'TIDE', 'COMET', 'HIVE', 'LABYRINTH', 'BLOOM', 'REACTOR'];

function roman(n) {
  const t = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}

/** Generate endless sector `num` (1-based sector number > campaign length). */
function generateLevel(num) {
  const rng = mulberry32(num * 9973 + 17);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const tier = num - CAMPAIGN_LENGTH; // 1, 2, 3...
  const hue = Math.floor(rng() * 360);

  if (num % 5 === 0) {
    const mk = Math.floor(num / 5) - 1;
    return {
      name: 'WARDEN MK ' + roman(mk), hue, endless: true,
      boss: {
        title: 'WARDEN MK ' + roman(mk), hp: 30 + tier * 2, y: 272, fire: Math.max(1.3, 2.0 - tier * 0.05),
        rings: [
          { n: 8, r: 86, speed: 1.0 + tier * 0.03, hp: 1 + Math.floor(tier / 6) },
          { n: 12, r: 130, speed: -(0.6 + tier * 0.03), hp: 2 + Math.floor(tier / 8) },
        ],
      },
      map: ['kk?kk....kk?kk'],
    };
  }

  const palettes = ['kpb', 'roy', 'cgy', 'bcw', 'pkr', 'ygo', 'gcb', 'okp'];
  const pal = pick(palettes);
  const rows = 6 + Math.min(4, Math.floor(tier / 2) + Math.floor(rng() * 2));
  const pTough = Math.min(0.35, 0.1 + tier * 0.02);
  const pSteel = Math.min(0.08, 0.02 + tier * 0.005);
  const pBomb = 0.05 + rng() * 0.04;
  const pPrize = 0.035;
  const pEmpty = 0.12 + rng() * 0.2;
  const style = Math.floor(rng() * 3); // 0 bands, 1 columns, 2 rings

  const map = [];
  for (let r = 0; r < rows; r++) {
    const half = [];
    for (let c = 0; c < 7; c++) {
      let ch;
      const x = rng();
      if (x < pEmpty) ch = '.';
      else if (x < pEmpty + pSteel && r < rows - 1) ch = '#';
      else if (x < pEmpty + pSteel + pBomb) ch = '*';
      else if (x < pEmpty + pSteel + pBomb + pPrize) ch = '?';
      else if (x < pEmpty + pSteel + pBomb + pPrize + pTough) ch = rng() < 0.3 + tier * 0.03 ? '3' : '2';
      else {
        const band = style === 0 ? r : style === 1 ? c : Math.max(Math.abs(r - rows / 2), Math.abs(c - 6.5) / 2);
        ch = pal[Math.floor(band) % pal.length];
      }
      half.push(ch);
    }
    map.push(half.join('') + half.slice().reverse().join(''));
  }
  // Guarantee plenty of breakable content
  const breakable = map.join('').replace(/[.#]/g, '').length;
  if (breakable < 30) map.push(pal[0].repeat(14));

  return {
    name: pick(ADJ) + ' ' + pick(NOUN), hue, endless: true,
    drift: rng() < 0.3 ? 40 + Math.floor(rng() * 40) : 0,
    map,
  };
}

function getLevel(idx) {
  return idx < LEVELS.length ? LEVELS[idx] : generateLevel(idx + 1);
}
