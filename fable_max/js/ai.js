'use strict';
/* ==========================================================================
   HADAL — a simple autopilot. It plays the attract-mode demo behind the
   title screen (and is handy for soak-testing the campaign).
   ========================================================================== */

const AI = {
  target: W / 2,
  maxV: 1000,
  aim: 0,
  serveT: 0,
  seenHit: -1,
  willPulse: false,
  skill: 0.45,          // chance to attempt a pulse on any given return
  stuckT: 0,

  reset() {
    this.target = Game.paddle ? Game.paddle.x : W / 2;
    this.serveT = 0; this.stuckT = 0;
    this.reroll();
  },

  reroll() {
    this.aim = rand(-0.75, 0.75);
    this.willPulse = Math.random() < this.skill;
  },

  update(rdt) {
    const g = Game, p = g.paddle;
    if (g.phase === 'serve') {
      this.serveT += rdt;
      this.target = W / 2 + Math.sin(g.rt * 1.1) * 150;
      if (this.serveT > 0.9) { this.serveT = 0; g.launch(); }
      return;
    }
    this.serveT = 0;
    if (g.phase !== 'live') return;
    if (p.lastHitT !== this.seenHit) { this.seenHit = p.lastHitT; this.reroll(); }

    // the most urgent falling pearl
    let best = null, bt = 1e9, stuck = false;
    for (let i = 0; i < g.balls.length; i++) {
      const b = g.balls[i];
      if (b.stuck) { stuck = true; continue; }
      if (b.dy <= 0.04) continue;
      const t = (p.y - b.r - b.y) / (b.dy * b.speed);
      if (t >= 0 && t < bt) { bt = t; best = b; }
    }
    if (stuck) {
      this.stuckT += rdt;
      if (this.stuckT > 0.5) { this.stuckT = 0; g.action(); }
    } else this.stuckT = 0;

    if (best) {
      // where will it cross the hull line, folding the path off the side walls
      let x = best.x + (best.dx / best.dy) * (p.y - best.r - best.y);
      const lo = best.r, span = W - 2 * best.r;
      x -= lo;
      x = ((x % (2 * span)) + 2 * span) % (2 * span);
      if (x > span) x = 2 * span - x;
      x += lo;
      this.target = x - this.aim * p.w * 0.36;
      if (this.willPulse && bt < 0.045 && p.pulseCd <= 0 && !stuck) { this.willPulse = false; g.action(); }
      if (bt > 0.9) this.seek(g, p, 0.5);
    } else {
      this.seek(g, p, 1);
    }
  },

  /* with time to spare: collect good capsules, sidestep stingers */
  seek(g, p, w) {
    let cap = null, cy = -1;
    for (let i = 0; i < g.caps.length; i++) {
      const c = g.caps[i];
      if (POWERUPS[c.type].good && c.y > cy && c.y < p.y) { cy = c.y; cap = c; }
    }
    if (cap && cy > 380) { this.target = lerp(this.target, cap.x, w); return; }
    if (w >= 1) {
      // drift under the highest pearl so we are already close when it turns
      let hi = null;
      for (let i = 0; i < g.balls.length; i++) if (!hi || g.balls[i].y > hi.y) hi = g.balls[i];
      if (hi) this.target = hi.x;
    }
  },
};
