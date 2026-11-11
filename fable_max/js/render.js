'use strict';
/* ==========================================================================
   HADAL — renderer: world, lighting, HUD
   ========================================================================== */

const FX_ORDER = ['wide', 'shrink', 'laser', 'pierce', 'sticky', 'slow', 'fast'];
const TIPS = {
  move: [['Slide the hull with the mouse, or  ←  →', 'Break every brick to dive deeper'],
         ['Drag anywhere to slide the hull', 'Break every brick to dive deeper']],
  pulse: [['PULSE — click the instant the pearl lands on your hull', 'A pulsed pearl punches through a brick and keeps your chain alive'],
          ['PULSE — tap the instant the pearl lands on your hull', 'A pulsed pearl punches through a brick and keeps your chain alive']],
  focus: [['FOCUS — hold SHIFT or right-click to slow time', 'It drains quickly. Save it for the close calls'],
          ['FOCUS — hold a second finger down to slow time', 'It drains quickly. Save it for the close calls']],
};

const Render = {
  darkC: null, darkCtx: null, hasLS: false,

  txt(ctx, s, x, y, size, color, align, weight, spacing) {
    ctx.font = (weight || 500) + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    spacing = spacing || 0;
    if (this.hasLS) {
      ctx.letterSpacing = spacing + 'px';
      if (align === 'center') x += spacing / 2; else if (align === 'right') x += spacing;
    }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  },

  draw() {
    const ctx = View.ctx, k = View.s * View.dpr, g = Game;
    this.hasLS = 'letterSpacing' in ctx;
    ctx.setTransform(k, 0, 0, k, View.ox * View.dpr, View.oy * View.dpr);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (this.hasLS) ctx.letterSpacing = '0px';

    Bg.draw(ctx);
    this.field(ctx);

    let sx = 0, sy = 0;
    if (g.shake > 0) {
      const m = g.shake * g.shake * 9;
      sx = (Math.random() - 0.5) * 2 * m; sy = (Math.random() - 0.5) * 2 * m;
    }
    if (g.stage) {
      ctx.save(); ctx.translate(sx, sy);
      this.fields(ctx);
      this.bricks(ctx);
      this.movers(ctx);
      if (g.boss) g.boss.draw(ctx);
      this.caps(ctx);
      this.shots(ctx);
      this.hazards(ctx);
      this.net(ctx);
      FX.draw(ctx);
      this.paddle(ctx);
      this.balls(ctx);
      FX.drawAdd(ctx);
      this.inks(ctx);
      ctx.restore();
      this.darkness(ctx);
      ctx.save(); ctx.translate(sx, sy);
      FX.drawTexts(ctx);
      this.hints(ctx);
      ctx.restore();
      this.hud(ctx);
    }
    this.overlays(ctx);
    if (this.hasLS) ctx.letterSpacing = '0px';
  },

  /* ------------------------------------------------- the shaft / frame */
  field(ctx) {
    const v = View, acc = Bg.accent(), fa = Bg.mv('field');
    const g = ctx.createLinearGradient(0, v.y0, 0, v.y1);
    g.addColorStop(0, 'rgba(1,8,22,' + fa.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(1,6,18,' + (fa * 0.72).toFixed(3) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, v.y0, W, v.h);

    for (let side = 0; side < 2; side++) {
      const x = side ? W : 0, dir = side ? 1 : -1;
      const wg = ctx.createLinearGradient(x, 0, x + dir * 30, 0);
      wg.addColorStop(0, rgba(acc, 0.2)); wg.addColorStop(1, rgba(acc, 0));
      ctx.fillStyle = wg; ctx.fillRect(side ? W : -30, v.y0, 30, v.h);
      ctx.fillStyle = rgba(acc, 0.6); ctx.fillRect(side ? W : -1.5, v.y0, 1.5, v.h);
    }
    ctx.fillStyle = 'rgba(0,6,18,0.4)'; ctx.fillRect(0, v.y0, W, TOP - 1.5 - v.y0);
    ctx.fillStyle = rgba(acc, 0.5); ctx.fillRect(0, TOP - 1.5, W, 1.5);

    // depth rulers along both walls scroll as the sub descends
    ctx.fillStyle = rgba(acc, 0.34);
    const off = ((Bg.scroll * 0.5) % 100 + 100) % 100;
    for (let i = 0; ; i++) {
      const y = TOP + i * 20 - off;
      if (y > v.y1) break;
      if (y < TOP) continue;
      const len = i % 5 === 0 ? 13 : 6;
      ctx.fillRect(-1.5 - len, y, len, 1);
      ctx.fillRect(W + 1.5, y, len, 1);
    }
  },

  /* currents, vents, the crush line */
  fields(ctx) {
    const g = Game, st = g.stage, t = g.t;
    if (g.phase === 'dive') return;
    for (let i = 0; i < st.currents.length; i++) {
      const c = st.currents[i], dir = Math.sign(c.f), my = (c.y0 + c.y1) / 2;
      const gr = ctx.createLinearGradient(0, c.y0, 0, c.y1);
      gr.addColorStop(0, 'rgba(160,220,255,0)'); gr.addColorStop(0.5, 'rgba(160,220,255,0.085)'); gr.addColorStop(1, 'rgba(160,220,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, c.y0, W, c.y1 - c.y0);
      ctx.strokeStyle = 'rgba(200,238,255,0.24)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const sp = 104, off = ((t * 150 * dir) % sp + sp) % sp;
      for (let x = -sp + off; x < W + sp; x += sp) {
        if (x < 14 || x > W - 14) continue;
        ctx.globalAlpha = clamp(Math.min(x, W - x) / 90, 0, 1);
        ctx.beginPath(); ctx.moveTo(x - dir * 9, my - 11); ctx.lineTo(x, my); ctx.lineTo(x - dir * 9, my + 11); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < st.vents.length; i++) {
      const v = st.vents[i];
      const warn = v.on <= 0 && v.t < 1.3 ? 1 - v.t / 1.3 : 0;
      ctx.globalCompositeOperation = 'lighter';
      if (v.on > 0) {
        const a = Math.min(1, v.on / 0.3) * (0.8 + 0.2 * Math.sin(g.rt * 30));
        const gr = ctx.createLinearGradient(0, H, 0, 320);
        gr.addColorStop(0, 'rgba(255,150,60,' + (0.42 * a).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = gr; ctx.fillRect(v.x - 36, 320, 72, H - 320);
        const g2 = ctx.createLinearGradient(0, H, 0, 420);
        g2.addColorStop(0, 'rgba(255,240,190,' + (0.5 * a).toFixed(3) + ')'); g2.addColorStop(1, 'rgba(255,240,190,0)');
        ctx.fillStyle = g2; ctx.fillRect(v.x - 13, 420, 26, H - 420);
      }
      ctx.globalAlpha = 0.35 + warn * 0.6 + (v.on > 0 ? 0.6 : 0);
      ctx.drawImage(Sprites.glow('#ff7a2a'), v.x - 60, H - 46, 120, 80);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0a0508';
      ctx.beginPath(); ctx.moveTo(v.x - 44, H + 2); ctx.lineTo(v.x - 22, H - 14); ctx.lineTo(v.x - 12, H - 9);
      ctx.lineTo(v.x + 12, H - 9); ctx.lineTo(v.x + 24, H - 15); ctx.lineTo(v.x + 44, H + 2); ctx.closePath(); ctx.fill();
      if (warn > 0) {
        ctx.strokeStyle = 'rgba(255,170,90,' + (0.5 * warn * (0.5 + 0.5 * Math.sin(g.rt * 22))).toFixed(3) + ')';
        ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.moveTo(v.x - 36, H); ctx.lineTo(v.x - 36, 340); ctx.moveTo(v.x + 36, H); ctx.lineTo(v.x + 36, 340); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (st.descend) {
      let low = 0;
      for (let i = 0; i < g.bricks.length; i++) { const k = g.bricks[i]; if (k.alive && !k.mover && k.r > low) low = k.r; }
      const near = clamp((low - (DESCEND_LIMIT - 8)) / 7, 0, 1);
      const y = BRICK_TOP + DESCEND_LIMIT * CELL_H;
      ctx.strokeStyle = 'rgba(255,90,110,' + (0.22 + near * 0.55 * (0.6 + 0.4 * Math.sin(g.rt * 9))).toFixed(3) + ')';
      ctx.lineWidth = 1.5; ctx.setLineDash([10, 9]); ctx.lineDashOffset = -g.rt * 22;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      // countdown to the next drop, drawn on the ceiling
      const u = clamp(1 - st.descT / st.descend, 0, 1);
      ctx.fillStyle = 'rgba(255,90,110,0.75)'; ctx.fillRect(0, TOP, W * u, 2.5);
    }
  },

  /* --------------------------------------------------------------- bricks */
  bricks(ctx) {
    const g = Game, list = g.bricks, zone = g.zone(), neon = zone.style === 'neon';
    const beat = Sound.pulse(), t = g.rt;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < list.length; i++) {
      const k = list[i];
      if (!k.alive || k.mover || k.app <= 0) continue;
      const T = BT[k.type];
      let col = T.glow, a = 0.34;
      if (!col) { if (!neon || T.steel) continue; col = k.color; a = 0.2; }
      if (k.type === 'mine') a = 0.22 + 0.34 * (0.5 + 0.5 * Math.sin(t * 6 + k.seed * 20));
      else if (k.type === 'hot') a = k.fuse > 0 ? 0.65 + 0.35 * Math.sin(t * 32) : 0.3;
      else if (k.type === 'phantom') a = 0.3 * k.vis;
      else if (k.type === 'gold' || k.type === 'oyster') a = 0.28 + 0.12 * Math.sin(t * 3 + k.seed * 9);
      ctx.globalAlpha = a * (0.8 + 0.2 * beat) * k.app;
      ctx.drawImage(Sprites.glow(col), k.x - 24, k.y + k.yo - 20, k.w + 48, k.h + 40);
    }
    ctx.globalCompositeOperation = 'source-over';
    const white = Sprites.white();
    for (let i = 0; i < list.length; i++) {
      const k = list[i];
      if (!k.alive || k.mover || k.app <= 0) continue;
      const spr = Sprites.brick(k.type, k.color, k.dmg, zone.style);
      let sc = 1, a = 1;
      if (k.app < 1) { sc = easeOutBack(k.app); a = Math.min(1, k.app * 2); }
      if (k.bump > 0) sc *= 1 + 0.07 * k.bump;
      if (k.type === 'phantom') a *= k.vis;
      let x = k.x, y = k.y + k.yo, w = k.w, h = k.h;
      if (k.fuse > 0) { x += (Math.random() - 0.5) * 2.4; y += (Math.random() - 0.5) * 2.4; }
      if (sc !== 1) { x += (w - w * sc) / 2; y += (h - h * sc) / 2; w *= sc; h *= sc; }
      ctx.globalAlpha = a;
      ctx.drawImage(spr, x, y, w, h);
      if (k.flash > 0) { ctx.globalAlpha = a * k.flash * 0.85; ctx.drawImage(white, x, y, w, h); }
    }
    ctx.globalAlpha = 1;
    // travelling glint on treasure
    ctx.globalCompositeOperation = 'lighter';
    const star = Sprites.glow('#ffffff');
    for (let i = 0; i < list.length; i++) {
      const k = list[i];
      if (!k.alive || k.app < 1 || (k.type !== 'gold' && k.type !== 'oyster')) continue;
      const u = (t * 0.45 + k.seed * 3) % 1;
      if (u > 0.4) continue;
      const q = u / 0.4;
      ctx.globalAlpha = Math.sin(q * Math.PI) * 0.8;
      ctx.drawImage(star, k.x + 6 + q * (k.w - 12) - 9, k.y + k.yo + k.h / 2 - 9, 18, 18);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  movers(ctx) {
    const g = Game, t = g.rt, mv = g.movers;
    for (let i = 0; i < mv.length; i++) {
      const m = mv[i];
      if (!m.alive) continue;
      const cx = m.x + m.w / 2, cy = m.y + m.h / 2;
      if (m.type === 'fish') {
        const dir = m.vx >= 0 ? 1 : -1, wag = Math.sin(t * 14 + m.seed * 9) * 4;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
        ctx.drawImage(Sprites.glow('#7ff5ff'), cx - 34, cy - 26, 68, 52);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.fillStyle = '#12303f'; ctx.strokeStyle = '#9dfcff'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.ellipse(cx + dir * 3, cy, 16, 8.5, 0, 0, TAU);
        ctx.moveTo(cx - dir * 12, cy); ctx.lineTo(cx - dir * 22, cy - 8 + wag); ctx.lineTo(cx - dir * 22, cy + 8 + wag); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#eaffff';
        ctx.beginPath(); ctx.arc(cx + dir * 11, cy - 2, 2.2, 0, TAU); ctx.fill();
        for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.arc(cx + dir * (2 - q * 6), cy + 4, 1.3, 0, TAU); ctx.fill(); }
        if (m.flash > 0) { ctx.globalAlpha = m.flash; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx + dir * 3, cy, 16, 8.5, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
        continue;
      }
      // jelly
      const col = m.hp > 1 ? '#ff9be6' : '#ffc9f2';
      const pul = Math.sin(t * 3.2 + m.seed * 9), wd = (m.w / 2) * (1 + pul * 0.06), bob = Math.sin(t * 2 + m.seed * 5) * 1.5;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45;
      ctx.drawImage(Sprites.glow('#ff8fe0'), cx - 46, cy - 36, 92, 72);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(cx, cy + bob);
      ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (let q = -2; q <= 2; q++) {
        const x0 = q * wd * 0.36;
        ctx.beginPath(); ctx.moveTo(x0, 3);
        ctx.quadraticCurveTo(x0 + Math.sin(t * 4 + q + m.seed * 6) * 3.5, 8, x0 + Math.sin(t * 3 + q * 2) * 3 - Math.sign(m.vx) * 3, 12.5);
        ctx.stroke();
      }
      const gr = ctx.createLinearGradient(0, -m.h * 0.55, 0, 5);
      gr.addColorStop(0, 'rgba(255,255,255,0.96)'); gr.addColorStop(0.5, rgba(col, 0.92)); gr.addColorStop(1, rgba(col, 0.55));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(-wd, 4);
      ctx.bezierCurveTo(-wd, -m.h * 0.74, wd, -m.h * 0.74, wd, 4);
      ctx.quadraticCurveTo(0, -1.5, -wd, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.2; ctx.stroke();
      if (m.flash > 0) { ctx.globalAlpha = m.flash * 0.9; ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.globalAlpha = 1; }
      if (m.hp > 1) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(0, -4.5, 2.8, 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  },

  /* ------------------------------------------------- capsules / projectiles */
  caps(ctx) {
    const list = Game.caps;
    for (let i = 0; i < list.length; i++) {
      const c = list[i], P = POWERUPS[c.type], bob = Math.sin(c.t * 3 + c.ph) * 2;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(c.t * 5);
      ctx.drawImage(Sprites.glow(P.color), c.x - 38, c.y - 38 + bob, 76, 76);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(c.x, c.y + bob); ctx.rotate(Math.sin(c.t * 2 + c.ph) * 0.2);
      ctx.drawImage(Sprites.capsule(c.type), -26, -26, 52, 52);
      ctx.restore();
    }
  },

  shots(ctx) {
    const list = Game.shots;
    if (!list.length) return;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8;
    const gl = Sprites.glow('#ffb05a');
    for (let i = 0; i < list.length; i++) ctx.drawImage(gl, list[i].x - 11, list[i].y - 14, 22, 44);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + 16);
      ctx.moveTo(s.x - 3.5, s.y + 5); ctx.lineTo(s.x, s.y - 1); ctx.lineTo(s.x + 3.5, s.y + 5); ctx.stroke();
    }
  },

  hazards(ctx) {
    const list = Game.hazards;
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7;
      ctx.drawImage(Sprites.glow(h.color), h.x - h.r * 3.4, h.y - h.r * 3.4, h.r * 6.8, h.r * 6.8);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      if (h.kind === 'sting') {
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(Math.atan2(h.vy, h.vx));
        ctx.fillStyle = '#ffe3f8';
        ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-8, -4.8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 4.8); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        const magma = h.kind === 'magma';
        const wob = 1 + Math.sin(h.t * 14) * 0.08;
        const gr = ctx.createRadialGradient(h.x - 3, h.y - 3, 1, h.x, h.y, h.r);
        if (magma) { gr.addColorStop(0, '#fff6d0'); gr.addColorStop(0.5, '#ffb347'); gr.addColorStop(1, '#e0401a'); }
        else { gr.addColorStop(0, '#b99bff'); gr.addColorStop(0.5, '#4a2aa8'); gr.addColorStop(1, '#16083a'); }
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r / wob, h.r * wob, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = magma ? 'rgba(255,240,200,0.8)' : 'rgba(200,170,255,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
      }
    }
  },

  net(ctx) {
    const g = Game;
    if (g.net <= 0 && g.netFlash <= 0) return;
    const a = g.net > 0 ? 0.7 + 0.3 * g.netFlash : g.netFlash;
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createLinearGradient(0, NET_Y - 14, 0, NET_Y + 14);
    gr.addColorStop(0, 'rgba(95,240,208,0)'); gr.addColorStop(0.5, 'rgba(95,240,208,' + (0.3 * a).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(95,240,208,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, NET_Y - 14, W, 28);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(170,255,234,' + (0.85 * a).toFixed(3) + ')'; ctx.lineWidth = 1.3; ctx.lineJoin = 'round';
    const layers = Math.max(1, Math.min(3, g.net));
    for (let ly = 0; ly < layers; ly++) {
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        for (let x = 0, i = 0; x <= W + 1; x += 13, i++) {
          const y = NET_Y + ly * 5 + ((i + pass) % 2 ? 4 : -4);
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
  },

  /* ---------------------------------------------------------------- the sub */
  paddle(ctx) {
    const g = Game, p = g.paddle, acc = Bg.accent();
    const w = p.w, h = p.h, x = p.x - w / 2, y = g.paddleTop(), stunned = p.stun > 0;

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.34 + p.glow * 0.5;
    ctx.drawImage(Sprites.glow(acc), x - 34, y - 30, w + 68, h + 60);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

    if (g.fx.sticky > 0) {
      ctx.fillStyle = 'rgba(125,255,176,' + (0.3 + 0.12 * Math.sin(g.rt * 8)).toFixed(3) + ')';
      rr(ctx, x + 4, y - 5, w - 8, 8, 4); ctx.fill();
    }
    if (g.fx.laser > 0) {
      ctx.fillStyle = '#ffb05a';
      rr(ctx, x + 9, y - 7, 6, 10, 2); ctx.fill();
      rr(ctx, x + w - 15, y - 7, 6, 10, 2); ctx.fill();
    }
    if (g.perk('rack')) { ctx.fillStyle = '#ffcf9a'; rr(ctx, p.x - 2.5, y - 8, 5, 9, 2); ctx.fill(); }

    const gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#f4fdff'); gr.addColorStop(0.16, '#a3deef'); gr.addColorStop(0.5, '#2f7499'); gr.addColorStop(1, '#0c2a48');
    ctx.fillStyle = gr; rr(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2); ctx.stroke();

    const ready = p.pulseCd <= 0 ? 1 : 0.35;            // the light strip dims while the pulse recharges
    ctx.fillStyle = rgba(mix(acc, '#ffffff', 0.4 + 0.6 * p.glow), Math.max(p.glow, 0.66 * ready));
    rr(ctx, x + 13, y + 2.6, w - 26, 2.6, 1.3); ctx.fill();
    ctx.fillStyle = 'rgba(4,18,36,0.55)'; rr(ctx, x + 17, y + 8.5, w - 34, 5, 2.5); ctx.fill();
    ctx.fillStyle = rgba(acc, 0.9);
    for (let i = -1; i <= 1; i++) { if (i === 0) continue; ctx.beginPath(); ctx.arc(p.x + i * w * 0.24, y + 11, 1.7, 0, TAU); ctx.fill(); }

    for (let s = -1; s <= 1; s += 2) {
      const ex = p.x + s * (w / 2 - 9);
      ctx.fillStyle = stunned ? '#ffe45c' : acc;
      ctx.beginPath(); ctx.arc(ex, y + h / 2, 4.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ex - 1, y + h / 2 - 1.2, 1.5, 0, TAU); ctx.fill();
    }
    // canopy
    ctx.fillStyle = 'rgba(200,244,255,0.55)';
    ctx.beginPath(); ctx.ellipse(p.x, y + 1.5, 13, 7, 0, Math.PI, TAU); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.ellipse(p.x - 4, y - 2, 3.2, 1.4, -0.4, 0, TAU); ctx.fill();

    if (stunned) {
      ctx.globalAlpha = 0.3 + 0.3 * Math.sin(g.rt * 44);
      ctx.fillStyle = '#fff3a0'; rr(ctx, x, y, w, h, h / 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  },

  balls(ctx) {
    const g = Game, list = g.balls, magma = g.fx.pierce > 0;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < list.length; i++) {
      const b = list[i], hot = magma || b.charge > 0;
      const col = magma ? '#ff7a2e' : b.charge > 0 ? '#5ff0ff' : b.ghost > 0 ? '#b9a6ff' : '#9fdcff';
      const gl = Sprites.glow(col), tr = b.trail, n = tr.length / 2;
      for (let j = 0; j < n; j++) {
        const u = (j + 1) / n, s = b.r * (0.5 + u * 1.3) * (hot ? 1.4 : 1);
        ctx.globalAlpha = u * u * (hot ? 0.42 : 0.3);
        ctx.drawImage(gl, tr[j * 2] - s, tr[j * 2 + 1] - s, s * 2, s * 2);
      }
      const hs = b.r * (hot ? 4.4 : 3.2);
      ctx.globalAlpha = 0.75;
      ctx.drawImage(gl, b.x - hs, b.y - hs, hs * 2, hs * 2);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const kind = magma ? 'magma' : b.charge > 0 ? 'charged' : b.ghost > 0 ? 'ghost' : 'pearl';
      if (b.ghost > 0) ctx.globalAlpha = Math.min(1, b.ghost) * (0.55 + 0.25 * Math.sin(g.rt * 12));
      ctx.drawImage(Sprites.ball(kind), b.x - 12, b.y - 12, 24, 24);
      ctx.globalAlpha = 1;
      if (b.blast) {
        ctx.strokeStyle = '#ffd35c'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -g.rt * 30;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6 + Math.sin(g.rt * 10) * 1.5, 0, TAU); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
      }
      if (b.stuck && !g.demo && (g.phase === 'serve' || g.phase === 'live')) {
        // aim guide
        const p = g.paddle;
        const ang = b.serve ? 0 : clamp(b.off / (p.w / 2), -1, 1) * 1.08;
        const dx = Math.sin(ang), dy = -Math.cos(ang);
        ctx.fillStyle = rgba(Bg.accent(), 0.75);
        const nd = b.serve ? 4 : 7;
        for (let q = 1; q <= nd; q++) {
          const d = 14 + q * 11 + ((g.rt * 24) % 11);
          ctx.globalAlpha = (1 - q / (nd + 1)) * 0.8;
          ctx.beginPath(); ctx.arc(b.x + dx * d, b.y + dy * d, 1.8, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  },

  inks(ctx) {
    const list = Game.inks;
    if (!list.length) return;
    const spr = Sprites.blob('#0d0720'), halo = Sprites.glow('#7a4dff');
    for (let i = 0; i < list.length; i++) {
      const k = list[i], u = k.t / k.life;
      const grow = easeOut(Math.min(1, k.t / 0.9)), fade = u < 0.68 ? 1 : 1 - (u - 0.68) / 0.32;
      const hr = 250 * (0.3 + 0.7 * grow);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 * fade;
      ctx.drawImage(halo, k.x - hr, k.y - hr * 0.8, hr * 2, hr * 1.6);
      ctx.globalCompositeOperation = 'source-over';
      for (let j = 0; j < k.blobs.length; j++) {
        const bl = k.blobs[j], r = bl.r * (0.3 + 0.7 * grow) * (1 + u * 0.35);
        const x = k.x + bl.ox * grow + bl.vx * k.t + Math.sin(k.t * 0.8 + bl.ph) * 6;
        const y = k.y + bl.oy * grow + bl.vy * k.t;
        ctx.globalAlpha = 0.62 * fade;
        ctx.drawImage(spr, x - r, y - r, r * 2, r * 2);
      }
    }
    ctx.globalAlpha = 1;
  },

  /* -------------------------------------------------- darkness & lighting */
  darkness(ctx) {
    const g = Game, st = g.stage;
    let d = st.dark;
    if (d <= 0.01) return;
    if (g.phase === 'dive') d *= 1 - clamp(g.phaseT / 0.8, 0, 1);
    else if (g.phase === 'intro') d *= clamp(g.phaseT / 1.0, 0, 1);
    if (st.lit > 0) d *= 1 - 0.85 * clamp(st.lit / 0.8, 0, 1);
    if (d <= 0.01) return;
    d = Math.min(d, 0.96);
    const v = View, q = 0.5;
    const cw = Math.ceil(v.w * q), ch = Math.ceil(v.h * q);
    if (!this.darkC || this.darkC.width !== cw || this.darkC.height !== ch) {
      this.darkC = makeCanvas(cw, ch);
      this.darkCtx = this.darkC.getContext('2d');
    }
    const c = this.darkCtx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.clearRect(0, 0, cw, ch);
    c.fillStyle = 'rgba(0,2,10,' + d.toFixed(3) + ')';
    c.fillRect(0, 0, cw, ch);
    c.globalCompositeOperation = 'destination-out';
    c.setTransform(q, 0, 0, q, -v.x0 * q, -v.y0 * q);
    const hole = Sprites.blob('#ffffff');
    const add = (x, y, r, a) => {
      if (a <= 0 || r <= 0) return;
      c.globalAlpha = a > 1 ? 1 : a;
      c.drawImage(hole, x - r, y - r, r * 2, r * 2);
    };
    const p = g.paddle;
    add(p.x, p.y, 175, 0.85);
    for (let i = 0; i < g.balls.length; i++) add(g.balls[i].x, g.balls[i].y, 150, 1);
    for (let i = 0; i < g.caps.length; i++) add(g.caps[i].x, g.caps[i].y, 64, 0.7);
    for (let i = 0; i < g.shots.length; i++) add(g.shots[i].x, g.shots[i].y, 46, 0.6);
    for (let i = 0; i < g.hazards.length; i++) add(g.hazards[i].x, g.hazards[i].y, 54, 0.65);
    for (let i = 0; i < g.bricks.length; i++) {
      const k = g.bricks[i];
      if (!k.alive) continue;
      const T = BT[k.type];
      if (T.glow) add(k.x + k.w / 2, k.y + k.h / 2, 50, 0.5 * (k.type === 'phantom' ? k.vis : 1));
    }
    if (g.boss && !g.boss.dead) g.boss.lights(add);
    for (let i = 0; i < g.lights.length; i++) { const l = g.lights[i]; add(l.x, l.y, l.r, l.a * (l.life / l.max)); }
    c.globalAlpha = 1;
    ctx.globalAlpha = 1;
    ctx.drawImage(this.darkC, v.x0, v.y0, v.w, v.h);
  },

  /* ----------------------------------------------------- prompts and tips */
  hints(ctx) {
    const g = Game;
    if (g.demo || g.mode !== 'play' || g.phase !== 'serve') return;
    const touch = Input.touch ? 1 : 0;
    const a = 0.8 + 0.2 * Math.sin(g.rt * 4);
    this.txt(ctx, touch ? 'TAP TO LAUNCH' : 'CLICK OR SPACE TO LAUNCH', W / 2, 700, 13, 'rgba(240,250,255,' + a.toFixed(3) + ')', 'center', 600, 3.5);
    const tip = g.stage.firstServe && TIPS[g.stage.def.tip];
    if (tip) {
      const lines = tip[touch], k = clamp(g.phaseT / 0.5, 0, 1);
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(2,14,32,0.62)'; rr(ctx, W / 2 - 300, 592, 600, 74, 14); ctx.fill();
      ctx.strokeStyle = rgba(Bg.accent(), 0.35); ctx.lineWidth = 1; rr(ctx, W / 2 - 300, 592, 600, 74, 14); ctx.stroke();
      this.txt(ctx, lines[0], W / 2, 623, 16, '#ffffff', 'center', 600, 0.4);
      this.txt(ctx, lines[1], W / 2, 648, 13.5, 'rgba(200,232,250,0.9)', 'center', 500, 0.3);
      ctx.globalAlpha = 1;
    }
  },

  /* ------------------------------------------------------------------ HUD */
  hud(ctx) {
    const g = Game;
    if (g.demo || !g.run || g.mode === 'title') return;
    const r = g.run, st = g.stage, zi = st.zi, zone = ZONES[zi], acc = Bg.accent();
    const dim = 'rgba(200,232,250,0.62)';

    // score
    this.txt(ctx, 'SCORE', 18, 20, 10, dim, 'left', 600, 2.6);
    this.txt(ctx, fmt(g.shownScore), 17, 46, 25, '#ffffff', 'left', 600, 0.5);

    // stage + depth
    const diving = g.phase === 'dive' && g.dive;
    const nz = diving ? ZONES[STAGES[g.dive.next].zone] : zone;
    const label = diving && g.phaseT / g.dive.dur > 0.5
      ? nz.name.toUpperCase() + '   ' + (STAGES[g.dive.next].zone + 1) + '–' + ((g.dive.next % 3) + 1)
      : zone.name.toUpperCase() + '   ' + (zi + 1) + '–' + ((st.gi % 3) + 1);
    this.txt(ctx, label, W / 2, 20, 10, dim, 'center', 600, 2.6);
    this.txt(ctx, fmt(g.depthShown) + ' m', W / 2, 46, 23, diving ? acc : '#ffffff', 'center', 500, 1);

    // lives
    this.txt(ctx, 'PEARLS', W - 18, 20, 10, dim, 'right', 600, 2.6);
    const ml = Math.max(g.maxLives(), r.lives);
    for (let i = 0; i < ml; i++) {
      const lx = W - 25 - i * 19, ly = 38;
      if (i < r.lives) {
        ctx.drawImage(Sprites.ball('pearl'), lx - 9, ly - 9, 18, 18);
      } else {
        ctx.strokeStyle = 'rgba(200,232,250,0.3)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(lx, ly, 5.4, 0, TAU); ctx.stroke();
      }
    }

    // focus meter
    const f = g.focus, fw = 124, fx0 = 18, fy = 858;
    this.txt(ctx, 'FOCUS', fx0, fy - 7, 9.5, f.lock ? 'rgba(255,120,130,0.9)' : dim, 'left', 600, 2.4);
    ctx.fillStyle = 'rgba(180,225,255,0.14)'; rr(ctx, fx0, fy, fw, 5, 2.5); ctx.fill();
    const fr = clamp(f.v / f.max, 0, 1);
    if (fr > 0.01) {
      ctx.fillStyle = f.on ? '#ffffff' : (fr < 0.14 ? 'rgba(255,120,130,0.9)' : acc);
      rr(ctx, fx0, fy, Math.max(5, fw * fr), 5, 2.5); ctx.fill();
    }

    // active effects
    let ex = fx0 + fw + 36;
    for (let i = 0; i < FX_ORDER.length; i++) {
      const id = FX_ORDER[i], tl = g.fx[id];
      if (!(tl > 0)) continue;
      const P = POWERUPS[id], full = P.dur * (1 + 0.35 * g.perk('timer'));
      const u = clamp(tl / full, 0, 1), cy = fy - 2;
      const blink = tl < 2 ? 0.55 + 0.45 * Math.sin(g.rt * 14) : 1;
      ctx.globalAlpha = blink;
      ctx.fillStyle = 'rgba(2,14,32,0.7)'; ctx.beginPath(); ctx.arc(ex, cy, 13, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(P.color, 0.25); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(ex, cy, 13, 0, TAU); ctx.stroke();
      ctx.strokeStyle = P.color; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(ex, cy, 13, -Math.PI / 2, -Math.PI / 2 + TAU * u); ctx.stroke();
      ctx.save(); ctx.translate(ex, cy); Icons.draw(ctx, id, 15, P.good ? '#ffffff' : '#ff8a96'); ctx.restore();
      ctx.globalAlpha = 1;
      ex += 34;
    }

    // chain
    if (g.chain >= 2 && g.phase !== 'dive') {
      const m = g.mult(), cap = m >= g.multCap();
      const col = m >= 6 ? '#ffd76b' : m >= 3 ? '#8ff6ff' : '#ffffff';
      const u = clamp(g.chainT / g.chainWindow(), 0, 1);
      this.txt(ctx, 'CHAIN ' + g.chain, W - 18, 845, 9.5, dim, 'right', 600, 2.4);
      this.txt(ctx, '×' + m + (cap ? ' MAX' : ''), W - 18, 872, 24, col, 'right', 700, 0.5);
      ctx.fillStyle = 'rgba(180,225,255,0.14)'; ctx.fillRect(W - 18 - 96, 876, 96, 2);
      ctx.fillStyle = col; ctx.fillRect(W - 18 - 96 * u, 876, 96 * u, 2);
    }

    // boss health
    const B = g.boss;
    if (B && !B.dead && g.phase !== 'dive') {
      const bw = 380, bx = W / 2 - bw / 2, by = TOP + 22;
      const k = B.ready ? 1 : clamp(B.t / 2, 0, 1);
      ctx.globalAlpha = k;
      this.txt(ctx, B.name.toUpperCase(), W / 2, by - 6, 10.5, '#ffffff', 'center', 700, 4);
      ctx.fillStyle = 'rgba(2,10,24,0.7)'; rr(ctx, bx - 2, by - 2, bw + 4, 11, 5.5); ctx.fill();
      B.shown = B.shown === undefined ? 0 : B.shown;
      B.shown = approach(B.shown, B.hp / B.maxHp, 6, 0.016);
      B.ghostHp = B.ghostHp === undefined ? 1 : Math.max(B.shown, approach(B.ghostHp, B.shown, 1.4, 0.016));
      if (B.ghostHp > 0.005) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; rr(ctx, bx, by, bw * B.ghostHp, 7, 3.5); ctx.fill(); }
      if (B.shown > 0.005) {
        const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        gr.addColorStop(0, B.color); gr.addColorStop(1, lighten(B.color, 0.45));
        ctx.fillStyle = gr; rr(ctx, bx, by, bw * B.shown, 7, 3.5); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (this.hasLS) ctx.letterSpacing = '0px';
  },

  /* ------------------------------------------- full-screen post overlays */
  overlays(ctx) {
    const g = Game, v = View;
    if (g.focus.k > 0.01) {
      const p = g.paddle, acc = Bg.accent();
      ctx.fillStyle = 'rgba(30,110,200,' + (0.11 * g.focus.k).toFixed(3) + ')';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      ctx.strokeStyle = acc; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const u = (g.rt * 0.55 + i / 3) % 1;
        ctx.globalAlpha = (1 - u) * 0.3 * g.focus.k;
        ctx.beginPath(); ctx.arc(p.x, p.y, 40 + u * 640, Math.PI, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (g.flash > 0.004) {
      ctx.fillStyle = rgba(g.flashCol, Math.min(0.8, g.flash).toFixed(3));
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
    }
    const cx = v.x0 + v.w / 2, cy = v.y0 + v.h / 2;
    const vg = ctx.createRadialGradient(cx, cy, Math.min(v.w, v.h) * 0.42, cx, cy, Math.hypot(v.w, v.h) * 0.56);
    vg.addColorStop(0, 'rgba(0,0,8,0)'); vg.addColorStop(1, 'rgba(0,0,8,' + (0.5 + 0.2 * g.focus.k).toFixed(3) + ')');
    ctx.fillStyle = vg; ctx.fillRect(v.x0, v.y0, v.w, v.h);
  },
};
