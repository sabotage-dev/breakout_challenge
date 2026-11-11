/* SHATTERWAVE — renderer: world, HUD, overlays */
'use strict';
SW.render = {
  fps: 60, fpsAcc: 0, fpsN: 0,
  ls(g, px) { if ('letterSpacing' in g) g.letterSpacing = px + 'px'; },
  font(size, weight = 800) { return `${weight} ${size}px ${SW.FONT}`; },

  draw(g, canvas, rdt) {
    const v = SW.view, dpr = v.dpr, game = SW.game, F = SW.FIELD, W = SW.W, H = SW.H;
    const cw = canvas.width / dpr, ch = canvas.height / dpr;
    this.fpsAcc += rdt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    SW.bg.draw(g, cw, ch);

    const s = v.scale;
    // field panel (no shake)
    g.setTransform(dpr * s, 0, 0, dpr * s, dpr * v.ox, dpr * v.oy);
    this.panel(g, game);

    // world with shake + final-brick zoom
    const zk = U.smoothstep(U.clamp(game.zoom.k, 0, 1));
    const z = 1 + zk * 0.22;
    const zx = game.zoom.x, zy = game.zoom.y;
    const fx = U.lerp(zx, W / 2, 0.35 * zk), fy = U.lerp(zy, H / 2, 0.35 * zk);
    const tx = v.ox + (SW.fx.sx + fx - z * zx) * s, ty = v.oy + (SW.fx.sy + fy - z * zy) * s;
    g.setTransform(dpr * s * z, 0, 0, dpr * s * z, dpr * tx, dpr * ty);
    g.save();
    g.beginPath(); g.rect(F.left, F.top, F.right - F.left, H - F.top); g.clip();
    this.world(g, game);
    g.restore();

    g.setTransform(dpr * s, 0, 0, dpr * s, dpr * v.ox, dpr * v.oy);
    this.walls(g, game);
    if (!game.demo && game.state !== 'idle') this.hud(g, game);

    // flash
    if (SW.fx.flashA > 0.01) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = SW.fx.flashA;
      g.fillStyle = SW.fx.flashC; g.fillRect(0, 0, cw, ch);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    if (SW.settings.fps) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.font = this.font(12, 600); g.fillStyle = '#9fa6d8'; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(this.fps + ' FPS · ' + SW.fx.parts.length + 'p', 8, ch - 20);
    }
  },

  panel(g, game) {
    const F = SW.FIELD, W = SW.W, H = SW.H;
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, 'rgba(6,3,22,0.86)'); grd.addColorStop(1, 'rgba(4,2,14,0.78)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    // faint column guides
    g.strokeStyle = 'rgba(140,150,255,0.035)'; g.lineWidth = 1;
    g.beginPath();
    for (let x = SW.GRID.x0 - 2; x < F.right; x += SW.GRID.pitchX) { g.moveTo(x, F.top); g.lineTo(x, H); }
    g.stroke();
  },
  walls(g, game) {
    const F = SW.FIELD, H = SW.H, col = SW.bg.accent();
    const beat = SW.audio.ready ? Math.pow(1 - SW.audio.beatPhase(), 3) : 0;
    g.lineCap = 'round';
    g.globalCompositeOperation = 'lighter';
    for (const [w, a] of [[10, 0.08 + beat * 0.05], [4, 0.25], [1.5, 0.9]]) {
      g.strokeStyle = SW.C.rgba(col, a); g.lineWidth = w;
      g.beginPath();
      g.moveTo(F.left - 2, H); g.lineTo(F.left - 2, F.top - 2); g.lineTo(F.right + 2, F.top - 2); g.lineTo(F.right + 2, H);
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  },

  world(g, game) {
    const t = game.t, F = SW.FIELD;
    // shield
    if (game.pw.shield > 0) {
      const a = Math.min(1, game.pw.shield / 2) * (0.6 + 0.4 * Math.sin(t * 10));
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = a;
      g.fillStyle = 'rgba(33,245,196,0.25)'; g.fillRect(F.left, SW.SHIELD_Y, F.right - F.left, 5);
      g.strokeStyle = '#21f5c4'; g.lineWidth = 2;
      g.beginPath();
      for (let x = F.left; x <= F.right; x += 8) g.lineTo(x, SW.SHIELD_Y + Math.sin(x * 0.08 + t * 8) * 1.5);
      g.stroke();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.font = this.font(10, 700); g.textAlign = 'right'; g.fillStyle = 'rgba(33,245,196,0.9)';
      g.fillText('◆'.repeat(Math.max(0, game.shieldHits)), F.right - 6, SW.SHIELD_Y - 6);
    }
    for (const po of game.portals) po.draw(g, t);
    for (const bu of game.bumpers) bu.draw(g, t, SW.bg.accent());
    for (const b of game.bricks) if (b.alive) b.draw(g, t);
    for (const bo of game.bosses) if (!bo.dead) bo.draw(g, t);
    for (const c of game.capsules) c.draw(g);
    for (const w of game.waves) w.draw(g);
    for (const l of game.lasers) l.draw(g);
    for (const o of game.orbs) o.draw(g);
    game.paddle.draw(g, game);
    const fire = game.pw.fire > 0;
    for (const b of game.balls) b.draw(g, fire);
    SW.fx.draw(g);
    SW.fx.drawTexts(g, SW.FONT);
  },

  hud(g, game) {
    const W = SW.W, F = SW.FIELD, acc = SW.bg.accent();
    // top band
    const band = g.createLinearGradient(0, 0, 0, F.top);
    band.addColorStop(0, 'rgba(10,6,34,0.95)'); band.addColorStop(1, 'rgba(14,8,44,0.9)');
    g.fillStyle = band; g.fillRect(0, 0, W, F.top - 3);
    g.textBaseline = 'alphabetic';
    // score
    g.textAlign = 'left'; this.ls(g, 3);
    g.font = this.font(11, 700); g.fillStyle = '#8f93c9';
    g.fillText('SCORE', 24, 24);
    this.ls(g, 1);
    g.font = this.font(30, 800); g.fillStyle = '#ffffff';
    g.shadowColor = acc; g.shadowBlur = 12;
    g.fillText(U.fmt(game.shownScore), 22, 56);
    g.shadowBlur = 0;
    // chain
    if (game.chain > 1) {
      const k = U.clamp(game.chainT / 1.7, 0, 1);
      g.font = this.font(14, 800); g.fillStyle = game.mult >= 4 ? '#ffd23f' : acc;
      g.fillText('×' + game.mult + '  ' + game.chain + ' CHAIN', 24, 76);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(150, 70, 70, 4);
      g.fillStyle = game.mult >= 4 ? '#ffd23f' : acc; g.fillRect(150, 70, 70 * k, 4);
    }
    // level
    g.textAlign = 'center'; this.ls(g, 3);
    const L = game.level;
    g.font = this.font(11, 700); g.fillStyle = acc;
    g.fillText(game.mode === 'endless' ? 'OVERTIME · WAVE ' + (game.levelN + 1) : 'SECTOR ' + L.sector + ' · ' + SW.SECTORS[L.sector - 1].name, W / 2, 24);
    this.ls(g, 2);
    g.font = this.font(21, 800); g.fillStyle = '#ffffff';
    g.fillText(L.name, W / 2, 52);
    if (!game.bosses.length && (game.state === 'play' || game.state === 'serve')) {
      g.font = this.font(11, 600); g.fillStyle = '#8f93c9'; this.ls(g, 2);
      g.fillText(game.remaining() + ' LEFT', W / 2, 72);
    }
    // lives
    g.textAlign = 'right'; this.ls(g, 3);
    g.font = this.font(11, 700); g.fillStyle = '#8f93c9';
    g.fillText('LIVES', W - 24, 24);
    const n = Math.min(game.lives, 6);
    for (let i = 0; i < n; i++) {
      const x = W - 24 - 26 - i * 30;
      g.fillStyle = acc; SW.gfx.rrect(g, x, 38, 26, 8, 4); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + 6, 40, 14, 2);
    }
    if (game.lives > 6) { g.font = this.font(14, 800); g.fillStyle = '#fff'; g.fillText('+' + (game.lives - 6), W - 24 - 6 * 30 - 6, 48); }
    g.font = this.font(11, 700); g.fillStyle = '#8f93c9';
    g.fillText('BEST ' + U.fmt(Math.max(SW.scores.best(), game.score)), W - 24, 74);
    this.ls(g, 0);

    // boss health
    const bosses = game.bosses;
    if (bosses.length && bosses.some((b) => !b.dead) && game.state !== 'tally') {
      const wEach = (W - 48 - (bosses.length - 1) * 16) / bosses.length;
      bosses.forEach((bo, i) => {
        const x = 24 + i * (wEach + 16), y = F.top + 8;
        const k = bo.hp / bo.maxHp;
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y, wEach, 7);
        g.fillStyle = bo.dead || bo.dying > 0 ? '#444' : bo.color; g.fillRect(x, y, wEach * k, 7);
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, y, wEach * k, 2);
        g.textAlign = 'left'; g.font = this.font(10, 700); g.fillStyle = '#fff'; this.ls(g, 2);
        g.fillText(bo.name, x, y + 20);
        this.ls(g, 0);
      });
    }

    // bottom: power-up chips
    let cx = 24;
    for (const k of ['wide', 'laser', 'catch', 'slow', 'fire', 'shield', 'shrink', 'fast']) {
      const left = game.pw[k];
      if (left <= 0) continue;
      const P = SW.POWERS[k], frac = U.clamp(left / P.dur, 0, 1);
      const blink = left < 2.5 ? (Math.sin(game.t * 18) > 0 ? 1 : 0.35) : 1;
      g.globalAlpha = blink;
      g.fillStyle = 'rgba(0,0,0,0.45)'; SW.gfx.rrect(g, cx, 920, 66, 14, 7); g.fill();
      g.fillStyle = SW.C.rgba(P.color, 0.85); SW.gfx.rrect(g, cx, 920, Math.max(14, 66 * frac), 14, 7); g.fill();
      g.font = this.font(10, 800); g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText(P.label, cx + 33, 931);
      g.globalAlpha = 1;
      cx += 72;
    }
    // pulse meter
    const pk = game.pulse / 100, full = pk >= 1;
    const t = performance.now() / 1000;
    g.fillStyle = 'rgba(0,0,0,0.5)'; SW.gfx.rrect(g, 24, 941, W - 48, 8, 4); g.fill();
    if (pk > 0) {
      const pg = g.createLinearGradient(24, 0, W - 24, 0);
      pg.addColorStop(0, '#5b2bff'); pg.addColorStop(0.6, '#b26bff'); pg.addColorStop(1, '#ff7ad9');
      g.fillStyle = pg; SW.gfx.rrect(g, 24, 941, Math.max(8, (W - 48) * pk), 8, 4); g.fill();
    }
    if (full) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 8) + game.pulseFlash * 0.5;
      g.drawImage(SW.gfx.glow('#b26bff'), 0, 915, W, 60);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    g.textAlign = 'right'; g.font = this.font(10, 800); this.ls(g, 2);
    g.fillStyle = full ? '#f0dcff' : '#8f93c9';
    const touch = document.body.classList.contains('touch');
    g.fillText(full ? (touch ? 'PULSE READY · TAP PULSE' : 'PULSE READY · E / RIGHT-CLICK') : 'PULSE ' + Math.floor(pk * 100) + '%', W - 24, 934);
    this.ls(g, 0);

    // serve hint
    if (game.state === 'serve' && !game.paused) {
      g.globalAlpha = 0.55 + 0.45 * Math.sin(t * 5);
      g.textAlign = 'center'; g.font = this.font(14, 700); g.fillStyle = '#fff'; this.ls(g, 4);
      g.fillText(touch ? 'DRAG TO STEER \u00b7 TAP TO LAUNCH' : 'CLICK OR SPACE TO LAUNCH', W / 2, SW.PADDLE_Y - 70);
      this.ls(g, 0); g.globalAlpha = 1;
    }
    this.banners(g, game);
    if (game.state === 'tally' && game.tally) this.tally(g, game);
  },

  banners(g, game) {
    const W = SW.W;
    for (const bn of game.banners) {
      const inT = U.clamp(bn.t / 0.35, 0, 1), outT = U.clamp((bn.dur - bn.t) / 0.35, 0, 1);
      const a = Math.min(inT, outT);
      const y = 560;
      const slide = (1 - U.easeOutCubic(inT)) * 120 - (1 - outT) * 120;
      g.globalAlpha = a * 0.75;
      g.fillStyle = 'rgba(5,2,18,0.8)'; g.fillRect(0, y - 46, W, 80);
      g.globalAlpha = a;
      g.fillStyle = bn.color; g.fillRect(0, y - 46, W * inT, 2); g.fillRect(W * (1 - inT), y + 32, W * inT, 2);
      g.textAlign = 'center';
      if (bn.sub) { g.font = this.font(12, 700); this.ls(g, 5); g.fillStyle = bn.color; g.fillText(bn.sub, W / 2 - slide * 0.5, y - 22); }
      g.font = this.font(bn.text.length > 22 ? 26 : 34, 900); this.ls(g, 4);
      g.shadowColor = bn.color; g.shadowBlur = 18; g.fillStyle = '#ffffff';
      g.fillText(bn.text, W / 2 + slide, y + 16);
      g.shadowBlur = 0; this.ls(g, 0);
      g.globalAlpha = 1;
    }
  },

  tally(g, game) {
    const W = SW.W, T = game.tally, acc = SW.bg.accent();
    const a = U.clamp(game.stateT / 0.3, 0, 1);
    const y0 = 360;
    g.globalAlpha = a * 0.85;
    g.fillStyle = 'rgba(5,2,18,0.85)'; SW.gfx.rrect(g, 110, y0 - 70, W - 220, 320, 14); g.fill();
    g.strokeStyle = SW.C.rgba(acc, 0.6); g.lineWidth = 1.5; SW.gfx.rrect(g, 110, y0 - 70, W - 220, 320, 14); g.stroke();
    g.globalAlpha = a;
    g.textAlign = 'center';
    const L = game.level;
    const title = L.boss ? 'GUARDIAN DESTROYED' : (L.stage === 4 ? 'SECTOR CLEAR' : game.mode === 'endless' ? 'WAVE CLEAR' : 'LEVEL CLEAR');
    g.font = this.font(34, 900); this.ls(g, 5); g.fillStyle = '#fff'; g.shadowColor = acc; g.shadowBlur = 20;
    g.fillText(title, W / 2, y0 - 20); g.shadowBlur = 0;
    g.font = this.font(16, 700); this.ls(g, 3);
    T.lines.forEach((l, i) => {
      if (i >= T.shown) return;
      const y = y0 + 30 + i * 34;
      g.textAlign = 'left'; g.fillStyle = '#8f93c9'; g.fillText(l[0], 150, y);
      g.textAlign = 'right'; g.fillStyle = l[1] > 0 ? '#ffffff' : '#555a80'; g.fillText('+' + U.fmt(l[1]), W - 150, y);
    });
    if (T.shown > T.lines.length) {
      const y = y0 + 30 + T.lines.length * 34 + 16;
      g.fillStyle = SW.C.rgba(acc, 0.5); g.fillRect(150, y - 26, W - 300, 1);
      g.textAlign = 'left'; g.fillStyle = acc; g.font = this.font(20, 900); g.fillText('TOTAL', 150, y + 4);
      g.textAlign = 'right'; g.fillStyle = '#ffd23f'; g.fillText('+' + U.fmt(T.total), W - 150, y + 4);
    }
    if (game.stateT > 1.0) {
      g.globalAlpha = a * (0.5 + 0.5 * Math.sin(performance.now() / 200));
      g.textAlign = 'center'; g.font = this.font(11, 700); g.fillStyle = '#8f93c9'; this.ls(g, 4);
      g.fillText('CLICK TO CONTINUE', W / 2, y0 + 236);
    }
    this.ls(g, 0);
    g.globalAlpha = 1;
  },
};
