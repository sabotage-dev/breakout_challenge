'use strict';
/* ==========================================================================
   HADAL — bootstrap, view scaling and the frame loop
   ========================================================================== */

const View = {
  canvas: null, ctx: null,
  dpr: 1, s: 1, ox: 0, oy: 0, vw: 0, vh: 0,
  x0: 0, y0: 0, x1: W, y1: H, w: W, h: H,     // visible area in playfield units
  quality: 1,

  toX(clientX) { return (clientX - this.ox) / this.s; },
  toY(clientY) { return (clientY - this.oy) / this.s; },

  resize() {
    const vw = Math.max(240, window.innerWidth || 0), vh = Math.max(240, window.innerHeight || 0);
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.quality;
    const pad = Math.min(vw, vh) < 560 ? 2 : 8;
    const s = Math.min((vw - pad * 2) / W, (vh - pad * 2) / H);
    const free = vh - H * s;
    this.vw = vw; this.vh = vh; this.dpr = dpr; this.s = s;
    this.ox = (vw - W * s) / 2;
    // on tall phones keep the field high, leaving room for a thumb underneath
    this.oy = vh > vw * 1.15 ? Math.min(free / 2, Math.max(pad, free * 0.3)) : free / 2;
    this.canvas.width = Math.round(vw * dpr);
    this.canvas.height = Math.round(vh * dpr);
    this.x0 = -this.ox / s; this.y0 = -this.oy / s;
    this.x1 = (vw - this.ox) / s; this.y1 = (vh - this.oy) / s;
    this.w = this.x1 - this.x0; this.h = this.y1 - this.y0;
    Sprites.reset(s * dpr);
  },
};

(function () {
  let lastT = 0, slow = 0, frames = 0, errors = 0;

  function frame(ts) {
    window.requestAnimationFrame(frame);
    const now = ts / 1000;
    let raw = now - lastT;
    lastT = now;
    if (!(raw > 0) || raw > 0.25) raw = 1 / 60;        // first frame, or the tab was away
    const dt = Math.min(raw, 1 / 30);

    try {
      Input.tick();
      UI.tick();
      Bg.update(Game.paused ? dt * 0.2 : dt);
      Game.update(dt);
      Render.draw();
    } catch (e) {
      if (errors++ < 5 && window.console) console.error(e);
      window.__hadalError = String(e && e.stack || e);
    }

    // if the machine cannot keep up, quietly drop the internal resolution
    frames++;
    if (frames > 120) {
      slow = raw > 0.024 ? slow + 1 : Math.max(0, slow - 0.5);
      if (slow > 50 && View.quality > 0.55) {
        View.quality = Math.max(0.5, View.quality - 0.25);
        slow = 0; frames = 0;
        View.resize();
      }
    }
  }

  function boot() {
    Save.load();
    View.canvas = document.getElementById('game');
    View.ctx = View.canvas.getContext('2d', { alpha: false });
    View.resize();
    window.addEventListener('resize', () => View.resize());
    window.addEventListener('orientationchange', () => View.resize());
    Bg.init();
    UI.init();
    Input.init(View.canvas);
    Game.boot();
    UI.title();

    // developer conveniences:  ?stage=7  ·  ?auto  ·  ?god
    const q = window.location.search || '';
    const m = /[?&]stage=(\d+)/.exec(q);
    if (/[?&]god\b/.test(q)) Game.god = true;
    if (/[?&]auto\b/.test(q)) Game.auto = true;
    if (m || Game.auto) {
      UI.closeAll();
      Game.startRun(m ? { gi: +m[1], score: 0, lives: 3, perks: {} } : null);
    }
    window.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
