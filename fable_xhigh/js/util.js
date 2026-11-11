/* Lanternwake — shared constants & helpers */
(function () {
  'use strict';
  const LW = (window.LW = window.LW || {});

  // Logical playfield. Everything in the game is expressed in these units.
  LW.C = {
    W: 1280, H: 800,
    L: 70, R: 1210, T: 70,       // inner walls of the bamboo frame
    WATER: 708,                  // waterline: a spark that falls past this is lost
    PADDLE_Y: 686, PADDLE_H: 14,
    COLS: 20, ROWS: 9,
    CELL_W: 56, CELL_H: 44,
    GRID_X: 80, GRID_Y: 112,
    BW: 50, BH: 38,              // lantern body inside a cell
    BALL_R: 8,
    JAR: 40,                     // fireflies needed for a spare spark
  };

  const U = (LW.U = {});
  U.TAU = Math.PI * 2;
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => (b === undefined ? Math.random() * (a === undefined ? 1 : a) : a + Math.random() * (b - a));
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  U.chance = (p) => Math.random() < p;
  U.damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
  U.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  U.easeInCubic = (t) => t * t * t;
  U.easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
  U.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  U.easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  U.smooth = (a, b, v) => {
    const t = U.clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // Small deterministic RNG (mulberry32) for scenery that must survive a resize.
  U.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.hsl = (h, s, l, a) => 'hsla(' + (((h % 360) + 360) % 360) + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')';
  U.rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a === undefined ? 1 : a) + ')';
  U.hslToRgb = function (h, s, l) {
    h = (((h % 360) + 360) % 360) / 360; s /= 100; l /= 100;
    const f = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [Math.round(f(p, q, h + 1 / 3) * 255), Math.round(f(p, q, h) * 255), Math.round(f(p, q, h - 1 / 3) * 255)];
  };

  U.shuffle = function (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  U.fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  U.roman = (n) => ['', 'I', 'II', 'III', 'IV', 'V'][n] || String(n);

  // Query-string switches (used for automated playtesting; harmless otherwise).
  const q = {};
  try {
    (window.location.search || '').replace(/^\?/, '').split('&').forEach((kv) => {
      if (!kv) return;
      const p = kv.split('=');
      q[decodeURIComponent(p[0])] = p[1] === undefined ? true : decodeURIComponent(p[1]);
    });
  } catch (e) { /* ignore */ }
  LW.query = q;
  LW.debug = {
    auto: !!q.auto,
    fast: Math.max(1, parseInt(q.fast, 10) || 1),
    stage: q.stage !== undefined ? parseInt(q.stage, 10) || 0 : -1,
    god: !!q.god,
  };
})();
