'use strict';
/* ============ SHATTERSONG · data ============ */

const ACTS = [
  { name: 'GLASS GARDEN', roman: 'I', track: 'act1', bossTrack: 'boss1', accent: '#6ee7ff',
    pal: ['#ff5d73', '#ff9a3d', '#ffd84a', '#5fe08a', '#3fd6e0', '#5b8cff', '#b574ff'],
    bg: ['#061426', '#0a0a22'], blobs: ['#16b8aa', '#2f5cf0', '#7a3fe0'] },
  { name: 'EMBER HALL', roman: 'II', track: 'act2', bossTrack: 'boss2', accent: '#ffb07a',
    pal: ['#ff3d5a', '#ff6a2b', '#ffa726', '#ffd54a', '#ff5fa8', '#d45bff', '#8f6bff'],
    bg: ['#1a0712', '#10061c'], blobs: ['#e23a5a', '#e8741f', '#a0308c'] },
  { name: 'VOID CHOIR', roman: 'III', track: 'act3', bossTrack: 'boss3', accent: '#c8b6ff',
    pal: ['#e9f1ff', '#9fd0ff', '#62a8ff', '#6c7bff', '#9a6bff', '#d07bff', '#ffe08a'],
    bg: ['#04050f', '#080a20'], blobs: ['#2634e0', '#6a30e0', '#12a0c0'] }
];

/* Brick legend
   1-7 glass (palette colour)   T tough (2)   H gilded (3)   # steel
   X volatile (explodes)        S seed (frees a ball)        P/Q phase bricks (alternate on the beat) */
const STAGES = [
  { name: 'Overture', act: 0, map: [
    '....11111....',
    '...2222222...',
    '..333333333..',
    '.44444S44444.',
    '.55555.55555.',
    '.6666...6666.',
    '.777.....777.'] },
  { name: 'Arpeggio', act: 0, map: [
    '1...........1',
    '21.........12',
    '321.......123',
    '4321..S..1234',
    '54321...12345',
    '654321.123456',
    '7654321234567',
    'T7654X2X4567T',
    '.TTT.....TTT.'] },
  { name: 'Counterpoint', act: 0, map: [
    '1.1.1.1.1.1.1',
    '.2.2.2.2.2.2.',
    '3.3.X.3.X.3.3',
    '.4.4.4.4.4.4.',
    '5.5.5.S.5.5.5',
    '.6.X.6.6.X.6.',
    '7.7.7.7.7.7.7',
    '.............',
    '##..#...#..##'] },
  { name: 'The Metronome', act: 0, boss: 'metronome', map: [
    '.............', '.............', '.............', '.............', '.............', '.............', '.............',
    '..TT.....TT..',
    '.3333.S.3333.',
    '..55.....55..'] },

  { name: 'Syncopation', act: 1, map: [
    'PQPQPQPQPQPQP',
    '1111111111111',
    'QPQPQPQPQPQPQ',
    '3333333333333',
    'PQPQPQPQPQPQP',
    '.............',
    '..TT.TXT.TT..',
    '..55.5S5.55..'] },
  { name: 'Glissando', act: 1, move: { 0: [125, 0.9], 2: [125, -1.1], 4: [125, 1.3], 6: [125, -1.0], 8: [125, 0.8] }, map: [
    '..111111111..',
    '.............',
    '..T2222222T..',
    '.............',
    '..333X3X333..',
    '.............',
    '..T4444444T..',
    '.............',
    '..555555555..',
    '#.....S.....#'] },
  { name: 'Fortissimo', act: 1, map: [
    '###.#####.###',
    '#1X1112111X1#',
    '#22X22222X22#',
    '#333X333X333#',
    '#4444X4X4444#',
    '#55555X55555#',
    '##..##.##..##',
    '.............',
    '..66..S..66..'] },
  { name: 'The Duet', act: 1, boss: 'duet', map: [
    '.............', '.............', '.............', '.............', '.............', '.............', '.............',
    'X.....T.....X',
    '.44.44.44.44.',
    '..S.......S..'] },

  { name: 'Dissonance', act: 2, map: [
    '66....H....66',
    '6....H1H....6',
    '....H121H....',
    '...H12X21H...',
    '..H1234321H..',
    '...H12X21H...',
    '....H121H....',
    '.....H1H.....',
    '......H......',
    '.............',
    '##.#.....#.##'] },
  { name: 'Fugue', act: 2, move: { 0: [125, 1.0], 2: [125, -1.2] }, map: [
    '..PPPPPPPPP..',
    '.............',
    '..QQQQQQQQQ..',
    '.............',
    'T6T6T6T6T6T6T',
    '7777777777777',
    '.............',
    '..PQPQXQPQP..',
    '..S.......S..'] },
  { name: 'Requiem', act: 2, map: [
    '..TTT...TTT..',
    '.T222T.T222T.',
    'T23332T23332T',
    'T23443234432T',
    'T23455555432T',
    '.T2345X5432T.',
    '..T2345432T..',
    '...T23432T...',
    '....T232T....',
    '.....T2T.....',
    '......T......'] },
  { name: 'The Maestro', act: 2, boss: 'maestro', map: [
    '.............', '.............', '.............', '.............', '.............', '.............', '.............',
    '.............', '.............',
    '3.3.3.3.3.3.3',
    '.X....S....X.'] }
];

const POWERUPS = {
  multi:  { name: 'SPLIT',    icon: 'multi',  color: '#5ee6ff', weight: 16, desc: 'Each ball becomes three.' },
  wide:   { name: 'EXPAND',   icon: 'wide',   color: '#7dff9a', weight: 13, dur: 18, desc: 'A wider paddle.' },
  laser:  { name: 'LASER',    icon: 'laser',  color: '#ff6a8a', weight: 11, dur: 10, desc: 'Auto-firing cannons.' },
  slow:   { name: 'LENTO',    icon: 'slow',   color: '#9db4ff', weight: 9,  dur: 10, desc: 'Slower balls.' },
  fire:   { name: 'FIREBALL', icon: 'fire',   color: '#ffb347', weight: 9,  dur: 8,  desc: 'Burns through bricks.' },
  shield: { name: 'BARRIER',  icon: 'shield', color: '#c79bff', weight: 9,  desc: 'Saves one ball. Stacks.' },
  life:   { name: 'ENCORE',   icon: 'heart',  color: '#ff7ad9', weight: 2,   desc: 'An extra life. Rare.' },
  shrink: { name: 'SHRINK',   icon: 'shrink', color: '#ff4040', weight: 6,  dur: 10, bad: true, desc: 'Cursed. Smaller paddle.' },
  fast:   { name: 'PRESTO',   icon: 'fast',   color: '#ff4040', weight: 5,  dur: 8,  bad: true, desc: 'Cursed. Faster balls.' }
};

const PERKS = [
  { id: 'wide',     name: 'Legato',     icon: 'wide',      max: 3, desc: 'Your paddle is 15% wider.' },
  { id: 'life',     name: 'Encore',     icon: 'heart',     max: 99, desc: 'Gain an extra life right now.' },
  { id: 'luck',     name: 'Fortune',    icon: 'star',      max: 2, desc: 'Power-ups drop 40% more often.' },
  { id: 'sustain',  name: 'Sustain',    icon: 'hourglass', max: 2, desc: 'Timed power-ups last 40% longer.' },
  { id: 'resonant', name: 'Resonant',   icon: 'waves',     max: 2, desc: 'Resonance builds 35% faster.' },
  { id: 'echo',     name: 'Echo',       icon: 'echo',      max: 3, desc: 'Broken bricks have a 6% chance to release a short-lived echo ball.' },
  { id: 'staccato', name: 'Staccato',   icon: 'bolt',      max: 2, desc: 'Your paddle fires a bolt whenever a ball bounces off it.' },
  { id: 'forte',    name: 'Forte',      icon: 'forte',     max: 2, desc: 'Balls hit harder: +1 damage.' },
  { id: 'blast',    name: 'Sforzando',  icon: 'burst',     max: 2, desc: 'Broken bricks have a 10% chance to explode.' },
  { id: 'net',      name: 'Safety Net', icon: 'net',       max: 1, desc: 'Begin every stage with a barrier that saves one ball.' },
  { id: 'tempo',    name: 'Adagio',     icon: 'metronome', max: 2, desc: 'Balls travel 8% slower.' },
  { id: 'magnet',   name: 'Attraction', icon: 'magnet',    max: 1, desc: 'Falling power-ups drift toward your paddle.' },
  { id: 'greed',    name: 'Virtuoso',   icon: 'crown',     max: 3, desc: 'All points are worth 25% more.' },
  { id: 'overture', name: 'Prelude',    icon: 'bars',      max: 1, desc: 'Begin every stage with Resonance at 40%.' }
];
