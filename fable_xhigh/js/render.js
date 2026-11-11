/* Lanternwake — renderer */
(function () {
  'use strict';
  const LW = window.LW, U = LW.U, C = LW.C, Art = LW.Art;
  const TAU = U.TAU, clamp = U.clamp;
  const R = (LW.Render = {});

  const SERIF = '"Cormorant Garamond","Hoefler Text",Baskerville,"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif';
  const SANS = '"Avenir Next",Avenir,"Segoe UI","Helvetica Neue",Helvetica,Arial,sans-serif';
  R.SERIF = SERIF; R.SANS = SANS;
  const WHITE = [255, 250, 235];
  const SPARK = [255, 196, 110];
  const FLY = [200, 255, 120];

  let canvas, ctx, scene, sg, bgA, bgB, vig, dark, dctx;
  let view = null, G = null;
  let themeCur = 'night1', themePrev = null, fade = 1, fadeDur = 1.6;
  let rumbleArmed = true;

  const twinkles = [];
  (function () {
    const r = U.rng(1234);
    for (let i = 0; i < 34; i++) twinkles.push({ x: -500 + r() * 2280, y: -260 + r() * 660, f: 0.6 + r() * 2.2, ph: r() * TAU, s: 3 + r() * 5 });
  })();

  R.init = function (cv) {
    G = LW.G;
    canvas = cv;
    ctx = cv.getContext('2d', { alpha: false });
    scene = document.createElement('canvas');
    sg = scene.getContext('2d', { alpha: false });
    bgA = document.createElement('canvas');
    bgB = document.createElement('canvas');
    vig = document.createElement('canvas');
    dark = document.createElement('canvas');
    dctx = dark.getContext('2d');
    R.resize();
    window.addEventListener('resize', R.resize);
  };

  R.resize = function () {
    const ww = Math.max(320, window.innerWidth), wh = Math.max(240, window.innerHeight);
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    while (dpr > 1 && ww * dpr * wh * dpr > 4.4e6) dpr -= 0.25;
    const scale = Math.min(ww / C.W, wh / C.H);
    const offX = (ww - C.W * scale) / 2;
    const offY = (wh - C.H * scale) * 0.62;
    view = {
      ww, wh, dpr, scale, offX, offY,
      left: -offX / scale, right: (ww - offX) / scale,
      top: -offY / scale, bottom: (wh - offY) / scale,
    };
    G.view = view;
    const pw = Math.round(ww * dpr), ph = Math.round(wh * dpr);
    [canvas, scene, bgA, bgB, vig].forEach((c) => { c.width = pw; c.height = ph; });
    canvas.style.width = ww + 'px';
    canvas.style.height = wh + 'px';
    dark.width = Math.ceil(ww / 4); dark.height = Math.ceil(wh / 4);
    Art.paintBackground(bgA, themeCur, view);
    if (themePrev) Art.paintBackground(bgB, themePrev, view);
    Art.paintVignette(vig);
  };

  R.setTheme = function (name, dur) {
    if (!Art.THEMES[name] || name === themeCur) return;
    themePrev = themeCur;
    themeCur = name;
    const t = bgA; bgA = bgB; bgB = t;
    if (view) Art.paintBackground(bgA, themeCur, view);
    fade = 0; fadeDur = dur || 1.6;
  };
  R.theme = () => themeCur;

  function world(g, sx, sy) {
    const k = view.dpr * view.scale;
    g.setTransform(k, 0, 0, k, (view.offX + sx * view.scale) * view.dpr, (view.offY + sy * view.scale) * view.dpr);
  }
  function spacing(c, px) { if ('letterSpacing' in c) c.letterSpacing = px + 'px'; }

  /* -------------------------------------------------------------- sky ---- */
  function drawSkyFx(g, th, t) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < twinkles.length; i++) {
      const s = twinkles[i];
      if (s.x < view.left || s.x > view.right) continue;
      const a = (0.22 + 0.22 * Math.sin(t * s.f + s.ph)) * th.star;
      Art.drawGlow(g, WHITE, s.x, s.y, s.s, a, true);
    }
    if (th.rain) {
      // far-off sheet lightning
      const fl = Math.max(0, Math.sin(t * 0.37) * Math.sin(t * 1.31 + 1) * Math.sin(t * 2.9) - 0.6) * 2.4;
      if (fl > 0.02) {
        g.globalAlpha = Math.min(0.3, fl * 0.3);
        g.fillStyle = '#9fd4e8';
        g.fillRect(view.left, view.top, view.right - view.left, 330 - view.top);
        if (rumbleArmed && fl > 0.3 && G.mode !== 'title') { rumbleArmed = false; LW.Audio.sfx.rumble(); }
      } else rumbleArmed = true;
      g.globalAlpha = 0.16;
      g.strokeStyle = '#bfe4ee';
      g.lineWidth = 1;
      g.beginPath();
      const span = view.right - view.left + 200, hgt = C.WATER - view.top;
      for (let i = 0; i < 120; i++) {
        const sp = 760 + (i % 7) * 60;
        const x = view.left - 100 + ((i * 97.13 + t * -130) % span + span) % span;
        const y = view.top + ((i * 53.7 + t * sp) % hgt);
        g.moveTo(x, y); g.lineTo(x - 3.2, y + 15);
      }
      g.stroke();
    }
    // lazy fireflies over the water
    for (let i = 0; i < 14; i++) {
      const bx = view.left + ((i * 0.618 + 0.13) % 1) * (view.right - view.left);
      const x = bx + Math.sin(t * 0.4 + i * 1.7) * 40;
      const y = C.WATER - 26 - ((i * 37) % 60) + Math.sin(t * 0.7 + i) * 12;
      const a = 0.3 + 0.3 * Math.sin(t * 1.6 + i * 2.1);
      if (a > 0.05) Art.drawGlow(g, FLY, x, y, 3.6, a * (th.rain ? 0.25 : 0.5));
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }

  /* ----------------------------------------------------------- lanterns ---- */
  function drawFloaters(g, t) {
    const fs = G.floaters;
    if (!fs.length) return;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < fs.length; i++) {
      const f = fs[i];
      const rgb = f.type === 'gold' ? LW.GOLD_RGB : LW.COLORS[f.color].rgb;
      Art.drawGlow(g, rgb, f.x, f.y, 46 * f.sc + 8, 0.5 * f.alpha);
    }
    g.globalCompositeOperation = 'source-over';
    const k = view.dpr * view.scale;
    for (let i = 0; i < fs.length; i++) {
      const f = fs[i];
      const spr = Art.brickSprite(f.type, f.color, 1);
      const rot = Math.sin(f.t * 1.1 + f.ph) * 0.12;
      const cs = Math.cos(rot) * f.sc * k, sn = Math.sin(rot) * f.sc * k;
      g.setTransform(cs, sn, -sn, cs, (view.offX + (f.x + G.shakeX) * view.scale) * view.dpr, (view.offY + (f.y + G.shakeY) * view.scale) * view.dpr);
      g.globalAlpha = Math.min(1, 0.6 + f.sc * 0.4) * f.alpha;
      g.drawImage(spr, -(C.BW / 2 + Art.PAD), -(C.BH / 2 + Art.PAD), Art.SW, Art.SH);
    }
    g.globalAlpha = 1;
    world(g, G.shakeX, G.shakeY);
  }

  const rowAlive = new Array(C.ROWS + 1);
  function drawRopes(g) {
    for (let i = 0; i <= C.ROWS; i++) rowAlive[i] = 0;
    const bs = G.bricks;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (b.alive && !b.boss && b.row >= 0 && b.row <= C.ROWS) rowAlive[b.row] = Math.max(rowAlive[b.row], b.intro);
    }
    g.lineWidth = 1;
    for (let r = 0; r <= C.ROWS; r++) {
      if (rowAlive[r] <= 0) continue;
      const y = C.GRID_Y + r * C.CELL_H + (C.CELL_H - C.BH) / 2 + 1;
      g.strokeStyle = 'rgba(214,180,128,' + 0.26 * rowAlive[r] + ')';
      g.beginPath(); g.moveTo(C.L, y - 3); g.quadraticCurveTo(640, y + 3, C.R, y - 3); g.stroke();
    }
  }

  function drawBricks(g, t) {
    const bs = G.bricks, k = view.dpr * view.scale;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (!b.alive || b.boss || b.intro <= 0) continue;
      const cx = G.cxOf(b), cy = G.cyOf(b);
      if (b.type === 'paper' || b.type === 'gold' || (b.type === 'dark' && b.hp < 2)) {
        const pulse = (b.type === 'gold' ? 0.5 : 0.36) + 0.07 * Math.sin(t * 1.7 + b.phase);
        Art.drawGlow(g, G.brickRgb(b), cx, cy, b.type === 'gold' ? 52 : 46, pulse * b.intro);
      } else if (b.type === 'stone') {
        Art.drawGlow(g, [255, 170, 80], cx, cy + 1, 20, 0.3 * b.intro * (b.hp / 3));
      }
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (!b.alive || b.boss || b.intro <= 0) continue;
      const spr = Art.brickSprite(b.type, b.color, b.hp);
      const cx = G.cxOf(b), top = b.circle ? b.y - C.BH / 2 : b.y;
      const sc = b.intro < 1 ? Math.max(0.01, U.easeOutBack(b.intro)) : 1;
      let rot = b.sway + Math.sin(t * 1.3 + b.phase) * 0.03;
      if (b.type === 'bell') rot += Math.sin(t * 17) * b.ring * 0.24;
      const cs = Math.cos(rot) * sc * k, sn = Math.sin(rot) * sc * k;
      g.setTransform(cs, sn, -sn, cs, (view.offX + (cx + G.shakeX) * view.scale) * view.dpr, (view.offY + (top + G.shakeY) * view.scale) * view.dpr);
      g.globalAlpha = Math.min(1, b.intro * 1.6);
      g.drawImage(spr, -(C.BW / 2 + Art.PAD), -Art.PAD, Art.SW, Art.SH);
    }
    g.globalAlpha = 1;
    world(g, G.shakeX, G.shakeY);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (!b.alive || b.boss || b.intro < 1) continue;
      const cx = G.cxOf(b), cy = G.cyOf(b);
      if (b.flash > 0) Art.drawGlow(g, WHITE, cx, cy, 42, b.flash * 0.85, true);
      if (b.type === 'cracker') {
        Art.drawGlow(g, [255, 200, 120], cx, b.y + 1.5, 7 + 3 * Math.sin(t * 31 + b.phase), 0.95, true);
      } else if (b.type === 'gold') {
        const a = 0.5 + 0.5 * Math.sin(t * 5 + b.phase);
        Art.drawGlow(g, WHITE, cx + Math.cos(t * 2 + b.phase) * 17, cy + Math.sin(t * 2.6 + b.phase) * 9, 7, a, true);
      }
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }

  /* ----------------------------------------------------------- pickups ---- */
  function drawPickups(g, t) {
    const cs = Art.charmSize;
    g.globalCompositeOperation = 'lighter';
    for (const f of G.flies) {
      Art.drawGlow(g, FLY, f.x, f.y, 17, 0.5 + 0.3 * Math.sin(t * 9 + f.ph));
      Art.drawGlow(g, FLY, f.x, f.y, 6, 1, true);
    }
    for (const s of G.swarm) {
      Art.drawGlow(g, FLY, s.x, s.y, 18, 0.6);
      Art.drawGlow(g, FLY, s.x, s.y, 6, 1, true);
    }
    for (const c of G.charms) {
      const def = LW.CHARMS[c.kind];
      Art.drawGlow(g, def.rgb, c.x, c.y, def.bad ? 38 + 6 * Math.sin(t * 12) : 40, def.bad ? 0.5 : 0.55);
    }
    for (const h of G.hazards) {
      if (h.kind === 'ember') {
        Art.drawGlow(g, [255, 110, 40], h.x, h.y, 34, 0.7);
        Art.drawGlow(g, [255, 200, 110], h.x, h.y, 17, 1, true);
      } else Art.drawGlow(g, [150, 80, 230], h.x, h.y, 34, 0.75);
    }
    for (const r of G.rockets) Art.drawGlow(g, r.rgb, r.x, r.y + 6, 16, 0.9, true);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    for (const h of G.hazards) {
      if (h.kind !== 'shadow') continue;
      g.fillStyle = '#07030c';
      g.beginPath(); g.arc(h.x, h.y, h.r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(210,170,255,0.9)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(h.x, h.y, h.r, 0, TAU); g.stroke();
    }
    for (const r of G.rockets) {
      g.fillStyle = '#fff4dc';
      g.beginPath(); g.moveTo(r.x, r.y - 9); g.lineTo(r.x + 3, r.y - 3); g.lineTo(r.x + 3, r.y + 6); g.lineTo(r.x - 3, r.y + 6); g.lineTo(r.x - 3, r.y - 3); g.closePath(); g.fill();
      g.fillStyle = U.rgba(r.rgb, 1);
      g.fillRect(r.x - 3, r.y - 1, 6, 3);
    }
    for (const c of G.charms) {
      const spr = Art.charmSprite(c.kind);
      g.save();
      g.translate(c.x, c.y);
      g.rotate(Math.sin(c.t * 2.6 + c.ph) * 0.2);
      const pop = Math.min(1, c.t * 5);
      g.scale(pop, pop);
      g.drawImage(spr, -(cs.w / 2 + cs.pad), -(cs.h / 2 + cs.pad), cs.w + cs.pad * 2, cs.h + cs.pad * 2);
      g.restore();
    }
  }

  function drawBalls(g) {
    const blazing = G.effects.blaze > 0;
    g.globalCompositeOperation = 'lighter';
    for (const b of G.balls) {
      const flare = b.flareT > 0;
      const rgb = blazing ? [255, 96, 40] : flare ? [170, 225, 255] : SPARK;
      const big = blazing || flare ? 1.4 : 1;
      const tr = b.trail, n = tr.length >> 1;
      for (let i = n - 1; i >= 0; i--) {
        const k = 1 - i / n;
        Art.drawGlow(g, rgb, tr[i * 2], tr[i * 2 + 1], b.r * (0.8 + 1.5 * k) * big, 0.36 * k * k);
      }
      Art.drawGlow(g, rgb, b.x, b.y, b.r * (blazing ? 4.8 : flare ? 4.6 : 3.5), 0.95, true);
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    for (const b of G.balls) {
      g.fillStyle = '#fffdf2';
      g.beginPath(); g.arc(b.x, b.y, b.r - 1.6, 0, TAU); g.fill();
      g.strokeStyle = blazing ? 'rgba(255,120,50,0.95)' : b.flareT > 0 ? 'rgba(160,220,255,0.95)' : 'rgba(255,190,100,0.95)';
      g.lineWidth = 1.6;
      g.beginPath(); g.arc(b.x, b.y, b.r - 0.8, 0, TAU); g.stroke();
    }
  }

  /* ---------------------------------------------------------- particles ---- */
  function drawParticles(g, layer, t) {
    const ps = G.parts;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.kind !== 0 || p.layer !== layer) continue;
      const k = p.life / p.max;
      let a = k < 0.5 ? k * 2 : 1;
      if (p.tw) a *= 0.55 + 0.45 * Math.sin(p.life * 38 + p.x * 0.3);
      const rad = p.size < 8 ? p.size * (0.7 + 0.3 * k) * 2.9 : p.size * (1.2 - 0.2 * k);
      Art.drawGlow(g, p.rgb, p.x, p.y, rad, a, p.hot);
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    if (layer !== 1) return;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.kind === 0) continue;
      const k = p.life / p.max;
      if (p.kind === 3) {
        Art.drawGlow(g, p.rgb, p.x, p.y, p.size * (1.7 - 0.7 * k), 0.4 * k);
        g.globalAlpha = 1;
        continue;
      }
      if (p.kind === 4) {
        g.globalAlpha = Math.min(1, k * 2) * 0.85;
        g.fillStyle = '#d2e6ff';
        g.beginPath(); g.arc(p.x, p.y, p.size, 0, TAU); g.fill();
        continue;
      }
      g.globalAlpha = Math.min(1, k * 2.5);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      if (p.kind === 1) {
        g.fillStyle = U.rgba(p.rgb, 1);
        g.fillRect(-p.size / 2, -p.size * 0.3 * Math.abs(Math.cos(p.rot * 1.7)) - 0.5, p.size, p.size * 0.6 * Math.abs(Math.cos(p.rot * 1.7)) + 1);
      } else {
        g.fillStyle = '#767c8c';
        g.beginPath(); g.moveTo(-p.size / 2, -p.size / 3); g.lineTo(p.size / 2, -p.size / 2); g.lineTo(p.size / 3, p.size / 2); g.lineTo(-p.size / 2, p.size / 3); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(-p.size / 2, -p.size / 3, p.size * 0.7, 1.2);
      }
      g.restore();
    }
    g.globalAlpha = 1;
  }

  function drawRings(g) {
    g.globalCompositeOperation = 'lighter';
    for (const r of G.rings) {
      const k = clamp(r.t / r.life, 0, 1);
      const rad = r.r0 + (r.r1 - r.r0) * U.easeOutCubic(k);
      g.globalAlpha = (1 - k) * 0.9;
      g.strokeStyle = U.rgba(r.rgb, 1);
      g.lineWidth = r.w * (1 - k) + 0.6;
      g.beginPath(); g.arc(r.x, r.y, Math.max(0.1, rad), 0, TAU); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }

  /* --------------------------------------------------------------- boat ---- */
  function drawBoat(g, t) {
    const p = G.paddle, hw = p.w / 2;
    const y = C.PADDLE_Y - (p.kick * 7 - p.dip * 3);
    const tilt = clamp(p.vx / 5200, -0.05, 0.05);
    let rgb = [255, 214, 140], glow = 0.42;
    if (G.effects.catch > 0) rgb = [204, 164, 255];
    if (p.stun > 0) { rgb = [170, 220, 255]; glow = 0.4 + 0.4 * Math.abs(Math.sin(t * 40)); }
    else if (p.flareT > 0) { rgb = [215, 245, 255]; glow = 1; }
    else if (p.cool > 0.2) glow = 0.22;
    if (G.effects.shrink > 0 && p.stun <= 0) rgb = [255, 120, 110];

    g.save();
    g.translate(p.x, y);
    g.rotate(tilt);
    g.beginPath();
    g.moveTo(-hw - 13, -7);
    g.quadraticCurveTo(-hw + 1, 1, -hw + 14, 0);
    g.lineTo(hw - 14, 0);
    g.quadraticCurveTo(hw - 1, 1, hw + 13, -7);
    g.quadraticCurveTo(hw - 3, 25, hw - 30, 28);
    g.lineTo(-hw + 30, 28);
    g.quadraticCurveTo(-hw + 3, 25, -hw - 13, -7);
    g.closePath();
    const gr = g.createLinearGradient(0, -7, 0, 28);
    gr.addColorStop(0, '#96603a'); gr.addColorStop(0.45, '#5e381c'); gr.addColorStop(1, '#27140a');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(16,6,0,0.85)'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(16,6,0,0.4)';
    g.beginPath(); g.moveTo(-hw + 1, 8); g.quadraticCurveTo(0, 11.5, hw - 1, 8); g.stroke();
    g.beginPath(); g.moveTo(-hw + 12, 16.5); g.quadraticCurveTo(0, 19.5, hw - 12, 16.5); g.stroke();
    g.strokeStyle = 'rgba(255,220,170,0.22)';
    g.beginPath(); g.moveTo(-hw - 11, -6); g.quadraticCurveTo(-hw + 2, 2.5, -hw + 14, 1.6); g.stroke();
    g.beginPath(); g.moveTo(hw + 11, -6); g.quadraticCurveTo(hw - 2, 2.5, hw - 14, 1.6); g.stroke();
    // glowing deck rail = the true bounce surface
    g.lineCap = 'round';
    g.strokeStyle = U.rgba(rgb, 0.5 + glow * 0.5); g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(-hw + 5, 1.2); g.lineTo(hw - 5, 1.2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,' + (0.35 + glow * 0.5) + ')'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-hw + 7, 0.6); g.lineTo(hw - 7, 0.6); g.stroke();
    // bow & stern lanterns
    g.fillStyle = '#fff1c8';
    g.beginPath(); g.arc(-hw - 12, -9, 2.6, 0, TAU); g.fill();
    g.beginPath(); g.arc(hw + 12, -9, 2.6, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    Art.drawGlow(g, [255, 190, 100], -hw - 12, -9, 15, 0.8);
    Art.drawGlow(g, [255, 190, 100], hw + 12, -9, 15, 0.8);
    const n = Math.max(2, Math.round(p.w / 46));
    for (let i = 0; i < n; i++) {
      const x = -hw + 10 + ((p.w - 20) * i) / (n - 1);
      Art.drawGlow(g, rgb, x, 2, 30, 0.2 + glow * 0.4);
    }
    if (p.flareT > 0 || p.kick > 0.3) {
      g.globalAlpha = Math.max(p.kick, 0.3) * 0.8;
      g.strokeStyle = '#dff4ff'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 44, hw + 44, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); g.stroke();
    }
    g.restore();
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }

  /* -------------------------------------------------------------- water ---- */
  function drawWater(c, th, t) {
    const k = view.dpr * view.scale;
    const W = canvas.width, H = canvas.height;
    const wy = Math.round((view.offY + (C.WATER + G.shakeY) * view.scale) * view.dpr);
    if (wy >= H) return;
    let gr = c.createLinearGradient(0, wy, 0, wy + 130 * k);
    gr.addColorStop(0, th.water[0]); gr.addColorStop(1, th.water[1]);
    c.fillStyle = gr;
    c.fillRect(0, wy, W, H - wy);
    // rippled mirror of everything above the waterline
    const strip = Math.max(2, Math.round(3 * k));
    const srcH = strip * 2.3;
    let j = 0;
    for (let dy = 0; wy + dy < H; dy += strip, j++) {
      const d = dy / k;
      if (d > 170) break;
      const sy = wy - (d * 2.3 + d * d * 0.018) * k - srcH;
      if (sy < 0) break;
      const off = Math.sin(t * 2.3 + j * 0.62) * (1.2 + d * 0.085) * k;
      c.globalAlpha = 0.62 * (1 - d / 175);
      c.drawImage(scene, 0, sy, W, srcH, off, wy + dy, W, strip);
    }
    c.globalAlpha = 1;
    gr = c.createLinearGradient(0, wy, 0, wy + 150 * k);
    gr.addColorStop(0, 'rgba(0,0,8,0)'); gr.addColorStop(1, 'rgba(0,0,8,0.6)');
    c.fillStyle = gr;
    c.fillRect(0, wy, W, H - wy);
  }

  function drawWaterFx(c, th, t) {
    // drifting glints
    c.lineWidth = 1;
    c.lineCap = 'round';
    for (let i = 0; i < 15; i++) {
      const y = C.WATER + 4 + i * 2.4 + i * i * 0.36;
      const gap = 150 + (i % 4) * 34;
      const drift = (t * (10 + (i % 3) * 6) * (i % 2 ? 1 : -1) + i * 61) % gap;
      c.strokeStyle = U.rgba(th.accent, 0.05 + 0.05 * Math.sin(t * 1.3 + i));
      c.beginPath();
      for (let x = view.left - gap + drift; x < view.right; x += gap) {
        c.moveTo(x, y); c.lineTo(x + 34 + (i % 5) * 12, y);
      }
      c.stroke();
    }
    c.strokeStyle = U.rgba(th.accent, 0.32 + 0.08 * Math.sin(t * 2));
    c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(view.left, C.WATER + 0.5); c.lineTo(view.right, C.WATER + 0.5); c.stroke();
    // ripples
    for (const r of G.ripples) {
      if (r.t < 0) continue;
      const k = r.t / r.life;
      const rx = r.w * (0.2 + 0.8 * U.easeOutCubic(k));
      c.globalAlpha = (1 - k) * 0.55;
      c.strokeStyle = '#dcebff';
      c.lineWidth = 1.4 * (1 - k) + 0.4;
      c.beginPath(); c.ellipse(r.x, C.WATER + 2 + k * 3, rx, rx * 0.15 + 0.5, 0, 0, TAU); c.stroke();
    }
    c.globalAlpha = 1;
    // lotus bridge
    if (G.bridge > 0) {
      const n = 26;
      for (let i = 0; i < n; i++) {
        const x = C.L + 22 + ((C.R - C.L - 44) * i) / (n - 1);
        if (Math.abs(x - G.paddle.x) < G.paddle.w / 2 + 12) continue;   // the boat nudges them aside
        const y = C.WATER - 1.5 + Math.sin(t * 1.8 + i * 0.9) * 0.9;
        c.fillStyle = i % 2 ? '#2c6a4a' : '#357a52';
        c.beginPath(); c.ellipse(x, y, 19, 4.6, 0, 0.25, TAU - 0.25); c.lineTo(x, y); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(170,240,190,0.5)'; c.lineWidth = 0.8;
        c.beginPath(); c.ellipse(x, y, 19, 4.6, 0, Math.PI, TAU - 0.25); c.stroke();
        const every = G.bridge >= 3 ? 1 : G.bridge === 2 ? 2 : 3;
        if (i % every === 0) {
          c.globalCompositeOperation = 'lighter';
          Art.drawGlow(c, [255, 150, 200], x, y - 5, 16, 0.5 + 0.15 * Math.sin(t * 3 + i));
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = 1;
          Art.icon(c, 'bridge', x, y - 6.5, 15, '#ffc0dc');
        }
      }
    }
  }

  function drawPopups(c) {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    for (const p of G.popups) {
      const k = p.t / p.life;
      const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const pop = p.t < 0.12 ? 0.6 + (p.t / 0.12) * 0.5 : 1.1 - Math.min(0.1, (p.t - 0.12) * 0.6);
      c.font = '700 ' + (p.size * pop).toFixed(1) + 'px ' + SANS;
      c.globalAlpha = a;
      c.strokeStyle = 'rgba(8,4,20,0.7)'; c.lineWidth = 3.5;
      c.strokeText(p.text, p.x, p.y);
      c.fillStyle = U.rgba(p.rgb, 1);
      c.fillText(p.text, p.x, p.y);
    }
    c.globalAlpha = 1;
    c.textBaseline = 'alphabetic';
  }

  function drawDarkness(c, amt) {
    const dw = dark.width, dh = dark.height;
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, dw, dh);
    dctx.fillStyle = 'rgba(2,0,6,' + (0.95 * amt).toFixed(3) + ')';
    dctx.fillRect(0, 0, dw, dh);
    dctx.globalCompositeOperation = 'destination-out';
    const k = view.scale / 4;
    const hole = (x, y, r, a) => {
      const X = (view.offX + x * view.scale) / 4, Y = (view.offY + y * view.scale) / 4, rr = r * k;
      const gr = dctx.createRadialGradient(X, Y, 0, X, Y, rr);
      gr.addColorStop(0, 'rgba(0,0,0,' + a + ')');
      gr.addColorStop(0.5, 'rgba(0,0,0,' + a * 0.62 + ')');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = gr;
      dctx.fillRect(X - rr, Y - rr, rr * 2, rr * 2);
    };
    const p = G.paddle;
    hole(p.x, C.PADDLE_Y, 170 + p.w * 0.4, 1);
    for (const b of G.balls) hole(b.x, b.y, 150, 1);
    for (const ch of G.charms) hole(ch.x, ch.y, 70, 0.9);
    for (const h of G.hazards) hole(h.x, h.y, 64, 0.85);
    for (const f of G.flies) hole(f.x, f.y, 36, 0.7);
    for (const r of G.rockets) hole(r.x, r.y, 50, 0.8);
    if (G.boss) {
      const core = G.boss.core;
      hole(core.x, core.y, 170, 0.8);
      for (const s of G.boss.parts) if (s !== core && s.alive && s.hp <= 1) hole(s.x, s.y, 54, 0.8);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.drawImage(dark, 0, 0, canvas.width, canvas.height);
    world(c, G.shakeX, G.shakeY);
  }

  /* ---------------------------------------------------------------- HUD ---- */
  function label(c, text, x, y, a) {
    c.font = '600 10.5px ' + SANS;
    spacing(c, 2.2);
    c.fillStyle = 'rgba(255,238,210,' + (a === undefined ? 0.55 : a) + ')';
    c.fillText(text, x, y);
    spacing(c, 0);
  }

  function drawHud(c, t) {
    if (G.mode === 'title' || G.mode === 'dawn' || G.mode === 'victory') return;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    label(c, 'SCORE', C.L + 4, 20);
    c.font = '600 27px ' + SANS;
    c.fillStyle = '#fff4dc';
    c.fillText(U.fmt(G.shownScore), C.L + 3, 47);

    // chain
    if (G.chain >= 2) {
      const x = C.L + 214;
      const frac = clamp(G.chainT / (2.3 + 1.2 * G.wish('night')), 0, 1);
      label(c, 'CHAIN ' + G.chain, x, 20, 0.7);
      c.fillStyle = 'rgba(255,255,255,0.14)';
      c.fillRect(x, 26, 92, 3);
      c.fillStyle = G.mult >= 5 ? '#ff9a5a' : '#ffd77a';
      c.fillRect(x, 26, 92 * frac, 3);
      if (G.mult > 1) {
        const s = 1 + (G.multPulse || 0) * 0.35;
        c.save();
        c.translate(x, 50); c.scale(s, s);
        c.font = '700 21px ' + SANS;
        c.fillStyle = G.mult >= 5 ? '#ffa46a' : '#ffd77a';
        c.fillText('×' + G.mult, 0, 0);
        c.restore();
      }
    }

    // centre: stage or boss
    c.textAlign = 'center';
    const boss = G.boss;
    if (boss && !boss.dead && G.mode !== 'clear') {
      c.font = '600 19px ' + SERIF;
      spacing(c, 1.5);
      c.fillStyle = U.rgba(boss.rgb, 0.96);
      c.fillText(boss.name.toUpperCase(), 640, 24);
      spacing(c, 0);
      const bw = 380, bx = 640 - bw / 2, by = 34;
      const frac = clamp(boss.core.hp / boss.core.maxHp, 0, 1);
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillRect(bx - 2, by - 2, bw + 4, 12);
      c.fillStyle = 'rgba(255,255,255,0.1)';
      c.fillRect(bx, by, bw, 8);
      const gr = c.createLinearGradient(bx, 0, bx + bw, 0);
      gr.addColorStop(0, '#ff6a4a'); gr.addColorStop(1, U.rgba(boss.rgb, 1));
      c.fillStyle = gr;
      c.fillRect(bx, by, bw * frac, 8);
      c.fillStyle = 'rgba(255,255,255,' + (0.25 + boss.beat * 0.6) + ')';
      c.fillRect(bx, by, bw * frac, 2.5);
      c.fillStyle = 'rgba(0,0,0,0.45)';
      for (let i = 1; i < boss.core.maxHp; i++) c.fillRect(bx + (bw * i) / boss.core.maxHp - 0.5, by, 1, 8);
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(640 - 0.5, by - 3, 1, 14);
    } else {
      const def = G.def;
      label(c, 'NIGHT ' + U.roman(def.night) + '  ·  ' + (G.stage + 1) + ' / ' + LW.STAGES.length, 640, 20);
      c.font = 'italic 500 23px ' + SERIF;
      c.fillStyle = '#fff0d4';
      c.fillText(def.name, 640, 46);
    }

    // sparks (lives)
    c.textAlign = 'right';
    label(c, 'SPARKS', C.R - 4, 20);
    const lp = G.lifePulse || 0;
    const shown = Math.min(G.lives, 5);
    for (let i = 0; i < shown; i++) {
      const x = C.R - 13 - i * 21, y = 38;
      const s = 19 * (1 + (i === G.lives - 1 ? lp * 0.5 : 0));
      c.globalCompositeOperation = 'lighter';
      Art.drawGlow(c, SPARK, x, y + 2, 15, 0.45);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      Art.icon(c, 'spark', x, y, s, '#ffcf78');
      Art.icon(c, 'spark', x, y + 3, s * 0.48, '#fff8e0');
    }
    if (G.lives > 5) {
      c.font = '600 15px ' + SANS; c.fillStyle = '#ffdc9a';
      c.fillText('+' + (G.lives - 5), C.R - 13 - 5 * 21 + 6, 44);
    }
    if (G.lives === 0) {
      c.font = 'italic 500 15px ' + SERIF; c.fillStyle = 'rgba(255,170,150,0.9)';
      c.fillText('last spark', C.R - 4, 44);
    }

    // firefly jar
    const jx = C.R - 262, jy = 33;
    const jp = G.jarPulse || 0;
    c.globalCompositeOperation = 'lighter';
    Art.drawGlow(c, FLY, jx, jy + 3, 13 + jp * 12, 0.15 + 0.5 * (G.jar / C.JAR) + jp * 0.4);
    const dots = Math.min(9, Math.ceil((G.jar / C.JAR) * 9));
    for (let i = 0; i < dots; i++) {
      const a = t * (0.8 + i * 0.13) + i * 2.4;
      Art.drawGlow(c, FLY, jx + Math.cos(a) * 5.5, jy + 5 + Math.sin(a * 1.3) * 6, 3.4, 0.9, true);
    }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    Art.icon(c, 'jar', jx, jy, 30 * (1 + jp * 0.15), 'rgba(226,255,214,0.85)');
    c.textAlign = 'left';
    label(c, 'FIREFLIES', jx + 20, 20);
    c.font = '600 17px ' + SANS;
    c.fillStyle = '#e4ffc8';
    c.fillText(G.jar + ' / ' + C.JAR, jx + 20, 44);

    // active charms
    let i = 0;
    const E = G.effects;
    for (const kname in E) {
      if (E[kname] <= 0) continue;
      const def = LW.CHARMS[kname];
      const x = C.L + 34 + i * 52, y = 760;
      const frac = clamp(E[kname] / ((def.dur || 10) * (def.bad ? 1 : 1 + 0.4 * G.wish('incense'))), 0, 1);
      const warn = E[kname] < 2.2 && Math.sin(t * 16) > 0;
      c.fillStyle = 'rgba(4,4,16,0.6)';
      c.beginPath(); c.arc(x, y, 20, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y, 20, 0, TAU); c.stroke();
      c.strokeStyle = U.rgba(def.rgb, warn ? 0.4 : 1);
      c.beginPath(); c.arc(x, y, 20, -Math.PI / 2, -Math.PI / 2 + TAU * frac); c.stroke();
      Art.icon(c, kname, x, y, 22, U.rgba(def.rgb, warn ? 0.5 : 1));
      i++;
    }
    if (G.bridge > 0) {
      const x = C.L + 34 + i * 52, y = 760;
      c.fillStyle = 'rgba(4,4,16,0.6)';
      c.beginPath(); c.arc(x, y, 20, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,176,214,0.9)'; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y, 20, 0, TAU); c.stroke();
      Art.icon(c, 'bridge', x, y - 1, 22, '#ffb8d8');
      if (G.bridge > 1) {
        c.font = '700 12px ' + SANS; c.fillStyle = '#fff'; c.textAlign = 'center';
        c.fillText('×' + G.bridge, x + 17, y + 20);
      }
    }

    // wishes carried this run
    const ids = Object.keys(G.wishes).filter((id) => id !== 'spark');
    if (ids.length) {
      const total = ids.length * 34;
      let x = 640 - total / 2 + 17;
      for (const id of ids) {
        const w = LW.WISH_BY_ID[id];
        c.fillStyle = 'rgba(4,4,16,0.5)';
        c.beginPath(); c.arc(x, 766, 14, 0, TAU); c.fill();
        Art.icon(c, w.icon, x, 766, 16, 'rgba(255,232,190,0.85)');
        const n = G.wishes[id];
        if (n > 1) for (let k = 0; k < n; k++) {
          c.fillStyle = '#ffd77a';
          c.beginPath(); c.arc(x - (n - 1) * 3 + k * 6, 784, 1.8, 0, TAU); c.fill();
        }
        x += 34;
      }
    }
    c.textAlign = 'left';
  }

  function glowText(c, text, x, y, font, fill, glow, blur) {
    c.font = font;
    c.shadowColor = glow;
    c.shadowBlur = blur * view.scale * view.dpr;
    c.fillStyle = fill;
    c.fillText(text, x, y);
    c.shadowBlur = 0;
    c.shadowColor = 'transparent';
  }

  function drawBanner(c, t) {
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    const b = G.banner;
    if (b && (G.mode === 'ready' || G.mode === 'play')) {
      const a = Math.min(1, b.t / 0.6) * (b.out >= 0 ? Math.max(0, 1 - b.out / 0.7) : 1);
      const rise = (1 - U.easeOutCubic(Math.min(1, b.t / 0.7))) * 16;
      c.globalAlpha = a;
      if (b.night) {
        label(c, 'NIGHT ' + U.roman(G.def.night) + '  —  ' + b.night.toUpperCase(), 640, 548 + rise, 0.8);
      }
      c.font = '600 13px ' + SANS;
      spacing(c, 4);
      c.fillStyle = b.boss ? 'rgba(255,170,140,0.95)' : 'rgba(255,226,180,0.9)';
      c.fillText(b.sub.toUpperCase(), 640, 572 + rise);
      spacing(c, 0);
      glowText(c, b.title, 640, 626 + rise, '500 58px ' + SERIF, b.boss ? '#ffd9c2' : '#fff3da', b.boss ? 'rgba(255,90,60,0.9)' : 'rgba(255,170,90,0.85)', 22);
      c.globalAlpha = 1;
    }
    if (G.mode === 'ready' && G.respawnT <= 0 && G.balls.length && !G.paused) {
      const a = 0.55 + 0.35 * Math.sin(t * 4);
      c.globalAlpha = a * (b ? Math.min(1, b.t / 1) : 1);
      c.font = '500 14px ' + SANS;
      spacing(c, 2.5);
      c.fillStyle = '#fff3da';
      c.fillText('CLICK  OR  PRESS SPACE  TO LAUNCH', 640, 662);
      spacing(c, 0);
      c.globalAlpha = 1;
    }
    // first-stage coaching
    if (G.stage === 0 && G.mode === 'play') {
      const st = G.stageTime;
      let msg = null, k = 0;
      if (st > 1.5 && st < 11) { msg = 'Click the instant your spark lands on the boat for a piercing FLARE shot'; k = Math.min(1, (st - 1.5) / 0.6, (11 - st) / 0.6); }
      else if (st > 12 && st < 20) { msg = 'Catch falling fireflies — a full jar earns a spare spark'; k = Math.min(1, (st - 12) / 0.6, (20 - st) / 0.6); }
      else if (st > 21 && st < 28) { msg = 'Wake lanterns quickly to build a chain and multiply your score'; k = Math.min(1, (st - 21) / 0.6, (28 - st) / 0.6); }
      if (msg) {
        c.globalAlpha = k * 0.92;
        c.font = 'italic 500 21px ' + SERIF;
        c.fillStyle = '#ffeccc';
        c.strokeStyle = 'rgba(6,4,20,0.6)'; c.lineWidth = 4; c.lineJoin = 'round';
        c.strokeText(msg, 640, 604);
        c.fillText(msg, 640, 604);
        c.globalAlpha = 1;
      }
    }
  }

  function drawTally(c, t) {
    c.textAlign = 'center';
    if (G.mode === 'clear' && G.tally) {
      const ct = G.clearT, ty = G.tally;
      const a = Math.min(1, ct / 0.5);
      const pop = 0.9 + 0.1 * U.easeOutBack(Math.min(1, ct / 0.5));
      c.globalAlpha = a;
      c.save();
      c.translate(640, 300); c.scale(pop, pop);
      glowText(c, ty.boss ? 'Guardian Quelled' : 'Stage Clear', 0, 0, '500 74px ' + SERIF, '#fff6e0', 'rgba(255,180,90,0.9)', 30);
      c.restore();
      const row = (i, l, v) => {
        const ra = clamp((ct - 0.5 - i * 0.28) / 0.35, 0, 1);
        if (ra <= 0) return;
        c.globalAlpha = ra;
        c.font = '600 12px ' + SANS; spacing(c, 3);
        c.fillStyle = 'rgba(255,236,204,0.75)';
        c.textAlign = 'right'; c.fillText(l, 628, 356 + i * 32);
        spacing(c, 0);
        c.font = '600 22px ' + SANS; c.fillStyle = '#ffd77a';
        c.textAlign = 'left'; c.fillText(v, 652, 358 + i * 32);
        c.textAlign = 'center';
      };
      row(0, 'CLEAR BONUS', '+' + U.fmt(ty.bonus));
      row(1, 'LONGEST CHAIN', String(ty.chain));
      row(2, 'SCORE', U.fmt(G.score));
      if (ct > 1.4) {
        c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4);
        label(c, 'CLICK TO MAKE A WISH', 640, 470, 0.9);
      }
      c.globalAlpha = 1;
    }
    if (G.mode === 'dawn') {
      const a = clamp((G.dawnT - 2.6) / 1.6, 0, 1);
      if (a > 0) {
        c.globalAlpha = a;
        glowText(c, 'Dawn', 640, 320, '500 120px ' + SERIF, '#fffaf0', 'rgba(255,200,120,1)', 44);
        c.globalAlpha = clamp((G.dawnT - 4) / 1.4, 0, 1);
        c.font = 'italic 500 26px ' + SERIF; c.fillStyle = '#fff3dc';
        c.fillText('Every lantern is awake, and the river remembers the light.', 640, 372);
        c.globalAlpha = 1;
      }
    }
    c.textAlign = 'left';
  }

  /* --------------------------------------------------------------- frame ---- */
  R.draw = function (rdt) {
    if (!view) return;
    const g = sg, t = G.time;
    const th = Art.THEMES[themeCur];

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (fade < 1) {
      fade = Math.min(1, fade + rdt / fadeDur);
      g.drawImage(bgB, 0, 0);
      g.globalAlpha = U.easeInOut(fade);
      g.drawImage(bgA, 0, 0);
      g.globalAlpha = 1;
    } else g.drawImage(bgA, 0, 0);

    world(g, G.shakeX, G.shakeY);
    drawSkyFx(g, th, t);
    drawFloaters(g, t);
    drawParticles(g, 0, t);
    drawRopes(g);
    drawBricks(g, t);
    if (G.boss) { LW.Boss.draw(g, G.boss); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    drawPickups(g, t);
    drawBalls(g);
    drawParticles(g, 1, t);
    drawRings(g);
    if (G.boss) LW.Boss.drawFront(g, G.boss);
    drawBoat(g, t);

    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.drawImage(scene, 0, 0);
    drawWater(c, th, t);
    world(c, G.shakeX, G.shakeY);
    drawWaterFx(c, th, t);
    if (G.boss && G.boss.dark > 0.01) drawDarkness(c, G.boss.dark);
    drawPopups(c);
    world(c, 0, 0);
    drawHud(c, t);
    drawBanner(c, t);
    drawTally(c, t);

    c.setTransform(1, 0, 0, 1, 0, 0);
    if (G.flash > 0.004) {
      c.globalAlpha = Math.min(1, G.flash);
      c.fillStyle = U.rgba(G.flashRgb, 1);
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (G.lostFlash > 0.004) {
      c.globalAlpha = G.lostFlash * 0.3;
      c.fillStyle = '#7a0a1c';
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (G.mode === 'over') {
      c.globalAlpha = 0.35;
      c.fillStyle = '#000';
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    c.globalAlpha = 1;
    c.drawImage(vig, 0, 0);
  };
})();
