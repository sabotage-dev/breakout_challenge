/* Lanternwake — stages, charms, wishes */
(function () {
  'use strict';
  const LW = window.LW;

  // Lantern paper colours. h/s drive the sprite, rgb drives glow & sparks.
  const COLORS = (LW.COLORS = {
    r: { h: 4, s: 92 },
    o: { h: 24, s: 96 },
    y: { h: 44, s: 96 },
    p: { h: 334, s: 88 },
    v: { h: 272, s: 80 },
    b: { h: 214, s: 90 },
    t: { h: 174, s: 82 },
    g: { h: 128, s: 62 },
    w: { h: 42, s: 30, pale: true },
  });
  Object.keys(COLORS).forEach((k) => {
    const c = COLORS[k];
    c.rgb = LW.U.hslToRgb(c.h, c.pale ? 60 : 100, c.pale ? 86 : 66);
  });
  LW.GOLD_RGB = [255, 214, 110];
  LW.STONE_RGB = [170, 180, 200];

  /* Map legend
     lowercase colour  = lit paper lantern (1 hit)
     UPPERCASE colour  = sleeping lantern  (2 hits: wake it, then release it)
     #  stone lantern (3 hits)      @  bronze bell (never breaks, rings)
     *  firecrackers (burst)        $  gilded lantern (always drops a charm)
  */
  LW.STAGES = [
    {
      night: 1, name: 'First Light', theme: 'night1', music: 'night1', speed: 455,
      map: [
        '....................',
        'rrrr.rrrr..rrrr.rrrr',
        'oooo.oooo..oooo.oooo',
        'yyy$.yyyy..yyyy.$yyy',
        'pppp.pppp..pppp.pppp',
        'vvvv.vvvv..vvvv.vvvv',
      ],
    },
    {
      night: 1, name: 'The Koi', theme: 'night1', music: 'night1', speed: 470,
      map: [
        '...................t',
        '.o......wwwwww...t..',
        '.oo...wwRRwwwwww....',
        '.ooo.wwRRRRwwww$ww..',
        '..oowwwwRRwwwwwwwww.',
        '.ooo.wwwwwwRRwwwww..',
        '.oo...wwwwRRRwww....',
        '.o......wwwwww......',
      ],
    },
    {
      night: 1, name: 'Paper Bridge', theme: 'night1', music: 'night1', speed: 485,
      map: [
        '....................',
        '......pppppppp......',
        '...pppooooooooppp...',
        '.ppooo...$$...ooopp.',
        'ppoo....*..*....oopp',
        '#o......y..y......o#',
        '#.......y**y.......#',
        '#.....*.yyyy.*.....#',
      ],
    },
    {
      night: 1, name: 'The Paper Dragon', theme: 'night1', music: 'night1', speed: 480,
      boss: 'dragon', bossTitle: 'Guardian of the River',
      map: [],
    },
    {
      night: 2, name: 'Rain Chains', theme: 'night2', music: 'night2', speed: 500,
      map: [
        '@..@..@..@@..@..@..@',
        'b..t..b..tt..b..t..b',
        'b..t..b..tt..b..t..b',
        'B..T..B..TT..B..T..B',
        'b..t..b..$$..b..t..b',
        'b..*..b..tt..b..*..b',
        'B..T..B..TT..B..T..B',
        'b..t..b..tt..b..t..b',
        '....vvvvvvvvvvvv....',
      ],
      movers: [{ row: 8, amp: 205, speed: 0.55 }],
    },
    {
      night: 2, name: 'Pagoda', theme: 'night2', music: 'night2', speed: 510,
      map: [
        '.........oo.........',
        '.......@rrrr@.......',
        '........yyyy........',
        '.....@rrrrrrrr@.....',
        '.......yyYYyy.......',
        '...@rrrrrrrrrrrr@...',
        '.....yyyY$$Yyyy.....',
        '.@rrrrrrrrrrrrrrrr@.',
        '....#..#....#..#....',
      ],
    },
    {
      night: 2, name: 'Thunderheads', theme: 'night2', music: 'night2', speed: 520,
      map: [
        '...wwww......wwww...',
        '.wwwwwwww..wwwwwwww.',
        'wwwBBwwwwwwwwwwBBwww',
        '.WWWWWWWW..WWWWWWWW.',
        '....*....tt....*....',
        '...*...t....t...*...',
        '....*....tt....*....',
        '.....*........*.....',
        '....$..........$....',
      ],
    },
    {
      night: 2, name: 'The Storm Drum', theme: 'night2', music: 'night2', speed: 515,
      boss: 'drum', bossTitle: 'Voice of the Thunder',
      map: [],
    },
    {
      night: 3, name: 'Lotus', theme: 'night3', music: 'night3', speed: 530,
      map: [
        '.........pp.........',
        '...p....pppp....p...',
        '..ppp..ppPPpp..ppp..',
        '..pppp.pP$$Pp.pppp..',
        '...ppppPPyyPPpppp...',
        '....pppppyyppppp....',
        '.gg..pppppppppp..gg.',
        'gggg...pppppp...gggg',
        '.gggggg......gggggg.',
      ],
    },
    {
      night: 3, name: 'Fox Mask', theme: 'night3', music: 'night3', speed: 540,
      map: [
        '..ww............ww..',
        '..wrw..........wrw..',
        '..wrrwwwwwwwwwwrrw..',
        '..wwwwwwwwwwwwwwww..',
        '...ww$$wwwwww$$ww...',
        '...wwwwwwrrwwwwww...',
        '....wwRwwwwwwRww....',
        '.....wwwwRRwwww.....',
        '.......wwwwww.......',
      ],
    },
    {
      night: 3, name: 'Moongate', theme: 'night3', music: 'night3', speed: 550,
      map: [
        '......vVVVVVVv......',
        '....vVV......VVv....',
        '...VV...@##@...VV...',
        '..vV...#*$$*#...Vv..',
        '..VV...#$**$#...VV..',
        '..vV...#*$$*#...Vv..',
        '...VV...@##@...VV...',
        '....vVV......VVv....',
        '......vVVVVVVv......',
      ],
    },
    {
      night: 3, name: 'The Hollow Moon', theme: 'night3b', music: 'night3', speed: 535,
      boss: 'moon', bossTitle: 'Eater of Light', final: true,
      map: [],
    },
  ];

  LW.NIGHT_NAMES = { 1: 'The Sleeping River', 2: 'The Storm Gate', 3: 'The Hollow Moon' };

  // Falling charms (power-ups). weight = relative drop frequency.
  LW.CHARMS = {
    split:   { name: 'Twin Sparks',   rgb: [255, 196, 92],  weight: 14 },
    wide:    { name: 'Long Boat',     rgb: [120, 200, 255], weight: 13, dur: 18 },
    blaze:   { name: 'Blaze',         rgb: [255, 112, 60],  weight: 9,  dur: 7 },
    slow:    { name: 'Still Water',   rgb: [110, 232, 220], weight: 9,  dur: 10 },
    catch:   { name: "Fisher's Hook", rgb: [204, 164, 255], weight: 8,  dur: 16 },
    rockets: { name: 'Skyrockets',    rgb: [255, 124, 164], weight: 11, dur: 8 },
    bridge:  { name: 'Lotus Bridge',  rgb: [255, 176, 214], weight: 9 },
    swarm:   { name: 'Firefly Swarm', rgb: [196, 255, 120], weight: 9 },
    life:    { name: 'Spare Spark',   rgb: [255, 244, 180], weight: 1.1 },
    gale:    { name: 'Gale',          rgb: [176, 96, 255],  weight: 6,  dur: 8,  bad: true },
    shrink:  { name: 'Leaky Boat',    rgb: [255, 80, 96],   weight: 6,  dur: 10, bad: true },
  };

  // Wishes: one is chosen after every stage and lasts for the whole run.
  LW.WISHES = [
    { id: 'oar',     icon: 'oar',     name: 'Longer Oar',       max: 3, desc: 'Your boat is 14% longer.' },
    { id: 'twin',    icon: 'twin',    name: 'Twin Flame',       max: 2, desc: 'Every launch begins with one more spark in play.' },
    { id: 'cracker', icon: 'cracker', name: 'Firecracker Heart', max: 3, desc: 'One lantern in eight bursts as your spark wakes it, waking its neighbours too.' },
    { id: 'fortune', icon: 'fortune', name: 'Good Fortune',     max: 3, desc: 'Charms fall 35% more often.' },
    { id: 'tide',    icon: 'slow',    name: 'Gentle Tide',      max: 2, desc: 'Sparks travel 8% slower. Breathe.' },
    { id: 'lotus',   icon: 'bridge',  name: 'Lotus Path',       max: 2, desc: 'Every stage begins with a lotus bridge that saves one fallen spark.' },
    { id: 'kindle',  icon: 'flare',   name: 'Kindling',         max: 2, desc: 'Flare shots pierce two more lanterns and are easier to time.' },
    { id: 'friend',  icon: 'swarm',   name: 'Firefly Friend',   max: 1, desc: 'Fireflies seek out your boat and count double.' },
    { id: 'spark',   icon: 'life',    name: 'Spare Spark',      max: 99, desc: 'Gain one spare spark right now.', rare: true },
    { id: 'incense', icon: 'incense', name: 'Slow Incense',     max: 2, desc: 'Charm effects last 40% longer.' },
    { id: 'gold',    icon: 'coin',    name: 'Gilded Paper',     max: 3, desc: 'Everything is worth 25% more.' },
    { id: 'rocket',  icon: 'rockets', name: 'Rocket Crew',      max: 2, desc: 'Your boat launches a skyrocket on its own every few seconds.' },
    { id: 'night',   icon: 'chain',   name: 'Long Night',       max: 2, desc: 'Chains last 1.2 seconds longer before they break.' },
    { id: 'breath',  icon: 'blaze',   name: "Dragon's Breath",  max: 1, desc: 'Reaching a ×4 chain sets your sparks ablaze for a moment.' },
    { id: 'clap',    icon: 'clap',    name: 'Thunderclap',      max: 2, desc: 'A Flare shot bursts on first impact, shaking nearby lanterns awake.' },
  ];
  LW.WISH_BY_ID = {};
  LW.WISHES.forEach((w) => (LW.WISH_BY_ID[w.id] = w));
})();
