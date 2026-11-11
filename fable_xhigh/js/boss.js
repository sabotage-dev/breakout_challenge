/* Lanternwake — the three guardians: Paper Dragon, Storm Drum, Hollow Moon */
(function () {
  'use strict';
  const LW = window.LW, U = LW.U, C = LW.C, A = LW.Audio, S = A.sfx, Art = LW.Art;
  const TAU = U.TAU, rand = U.rand, clamp = U.clamp;
  const B = (LW.Boss = {});
  const tmp = { x: 0, y: 0, ang: 0 };

  function mkPart(type, x, y, r, hp, counts) {
    return {
      type, boss: true, circle: true, x, y, r, hp, maxHp: hp, alive: true, indestructible: false,
      counts: !!counts, flash: 0, intro: 1, introDelay: 0, sway: 0, swayV: 0, phase: Math.random() * TAU,
      ring: 0, ghost: false, ghostT: 0, w: 0, h: 0, mover: null, color: 'r', ang: 0,
    };
  }
  function disc(g, x, y, r, c0, c1, c2) {
    const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.08, x, y, r);
    gr.addColorStop(0, c0); gr.addColorStop(0.55, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  function flashDisc(g, p) {
    if (p.flash <= 0) return;
    g.globalAlpha = p.flash * 0.75;
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }

  B.create = function (kind) {
    const G = LW.G;
    let boss;
    if (kind === 'dragon') boss = makeDragon();
    else if (kind === 'drum') boss = makeDrum();
    else boss = makeMoon();
    boss.enraged = false; boss.dead = false; boss.dying = false; boss.enter = 0; boss.beat = 0; boss.dieT = 0;
    G.boss = boss;
    return boss;
  };

  B.update = function (boss, dt, active) {
    const G = LW.G;
    if (boss.dead) return;
    boss.beat = Math.max(0, boss.beat - dt * 5);
    if (boss.dying) boss.dieT += dt;
    if (!boss.enraged && !boss.dying && boss.core.hp <= boss.core.maxHp / 2) {
      boss.enraged = true;
      G.popup(640, 470, boss.rageText, boss.rgb, 26);
      G.shake(9);
      G.flashScreen(0.35, boss.rgb);
      if (boss.kind === 'dragon') S.roar(); else if (boss.kind === 'drum') S.thunder(); else S.eclipse();
    }
    for (const p of boss.parts) {
      if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 5);
      if (p.ghostT > 0) { p.ghostT -= dt; p.ghost = p.ghostT > 0; }
    }
    if (boss.kind === 'dragon') updateDragon(boss, dt, active);
    else if (boss.kind === 'drum') updateDrum(boss, dt, active);
    else updateMoon(boss, dt, active);
  };

  B.onHit = function (boss, p, hx, hy) {
    const G = LW.G;
    S.bossHit();
    G.addScore(15 * G.mult);
    if (p === boss.core) {
      boss.beat = 1;
      G.shake(3.5);
      const q = Math.ceil((p.hp / p.maxHp) * 4);
      if (boss.quarter === undefined) boss.quarter = 4;
      if (q < boss.quarter) { boss.quarter = q; G.dropCharm(p.x, p.y + p.r, true, false); }
      G.sparks(hx, hy, 14, boss.rgb, 280, { life: 0.45 });
      G.ring(p.x, p.y, p.r, p.r + 46, 0.3, boss.rgb, 3);
      if (boss.kind === 'dragon' && U.chance(0.35)) S.roar();
    } else {
      G.sparks(hx, hy, 9, boss.rgb, 200, { life: 0.4 });
      if (p.type === 'shadow') S.ignite();
    }
  };

  B.onDestroyed = function (boss, p) {
    const G = LW.G;
    if (p === boss.core) { killBoss(boss); return; }
    G.addScore(120 * G.mult, p.x, p.y - 16);
    G.shake(4);
    if (p.type !== 'stormShield' || !p.revived) G.spawnFly(p.x, p.y);
    if (p.type === 'dragonSeg') {
      S.boom(0.45);
      G.confetti(p.x, p.y, 14, [220, 50, 40], 240);
      G.sparks(p.x, p.y, 16, [255, 200, 110], 280, { life: 0.5 });
      G.ring(p.x, p.y, 10, 60, 0.3, [255, 190, 110], 3);
      // each body lantern woken saps the dragon itself
      if (boss.core.alive && !boss.dying) G.damageBrick(boss.core, 0.5, boss.core.x, boss.core.y);
    } else if (p.type === 'stormShield') {
      S.boom(0.4);
      p.respawn = boss.enraged ? 10 : 13;
      G.sparks(p.x, p.y, 18, [170, 225, 255], 300, { life: 0.45, hot: true });
      G.ring(p.x, p.y, 10, 60, 0.3, [170, 225, 255], 3);
    } else if (p.type === 'shadow') {
      S.lantern(G.chain);
      G.release(p.x, p.y, 'paper', 'w');
      G.sparks(p.x, p.y, 16, [230, 210, 255], 260, { life: 0.5 });
      G.ring(p.x, p.y, 10, 60, 0.3, [220, 190, 255], 3);
    }
  };

  function killBoss(boss) {
    const G = LW.G;
    boss.dying = true; boss.dieT = 0;
    G.hazards.length = 0;
    G.slowT = 1.3;
    G.hitstop = 0.14;
    G.shake(16);
    G.flashScreen(0.7, boss.rgb);
    G.addScore(2500 * (1 + 0.5 * (LW.G.def.night - 1)), boss.core.x, boss.core.y - 40, true);
    S.boom(1);
    if (boss.kind === 'dragon') S.roar();
    if (boss.kind === 'drum') S.thunder();
    const c = boss.core;
    G.sparks(c.x, c.y, 50, boss.rgb, 520, { life: 0.9, tw: 1 });
    G.confetti(c.x, c.y, 30, boss.rgb, 380);
    G.ring(c.x, c.y, 20, 240, 0.6, boss.rgb, 6);
    // the rest of the body bursts apart, one piece after another
    let k = 0;
    for (const p of boss.parts) {
      if (p === c || !p.alive) continue;
      k++;
      G.after(0.3 + k * 0.1, () => {
        if (!p.alive) return;
        p.alive = false;
        G.addScore(150);
        G.sparks(p.x, p.y, 16, boss.rgb, 300, { life: 0.5 });
        G.ring(p.x, p.y, 8, 56, 0.3, boss.rgb, 3);
        if (p.type === 'shadow') G.release(p.x, p.y, 'paper', 'w');
        else G.confetti(p.x, p.y, 10, boss.rgb, 240);
        G.shake(4);
        S.boom(0.4);
      });
    }
    const extra = boss.kind === 'moon' ? 2.6 : 0.7;
    if (boss.kind === 'moon') {
      for (let i = 0; i < 14; i++) {
        G.after(0.2 + i * 0.17, () => {
          const a = rand(TAU);
          G.sparks(c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r, 16, [255, 230, 170], 340, { life: 0.6, hot: true });
          G.ring(c.x, c.y, c.r * 0.6, c.r + 60 + i * 12, 0.4, [255, 220, 170], 3);
          G.shake(5 + i * 0.5);
          S.boom(0.35 + i * 0.03);
        });
      }
    }
    G.after(0.3 + k * 0.1 + extra, () => {
      boss.dead = true;
      G.flashScreen(boss.kind === 'moon' ? 1 : 0.5, [255, 244, 220]);
      G.shake(14);
      S.boom(1);
      for (let i = 0; i < 5; i++) G.firework(c.x + rand(-160, 160), c.y + rand(-80, 90), U.pick(LW.FW_COLORS), rand(1, 1.5), 1);
    });
  }

  /* ============================================================ DRAGON ==== */
  function dragonPath(t, out) {
    out.x = 640 + 440 * Math.sin(t * 0.52);
    out.y = 252 + 104 * Math.sin(t * 1.21 + 0.5) + 28 * Math.sin(t * 2.3);
  }
  function makeDragon() {
    const G = LW.G;
    const boss = {
      kind: 'dragon', name: 'The Paper Dragon', rgb: [255, 150, 70], rageText: 'THE DRAGON RAGES',
      t: 0, segs: [], hist: [], spitT: 4.2, mouth: 0, parts: [],
    };
    const head = mkPart('dragonHead', 640, -200, 32, 12, true);
    boss.core = head;
    for (let i = 0; i < 14; i++) {
      const s = mkPart('dragonSeg', 640, -200, i > 10 ? 20 - (i - 10) * 2.2 : 20, 2, false);
      s.idx = i; s.off = (i + 1) * 39 + 12;
      boss.segs.push(s);
    }
    for (let k = 420; k >= 0; k--) {
      dragonPath(-k * 0.012, tmp);
      boss.hist.push({ x: tmp.x, y: tmp.y - 430 });
    }
    boss.parts = [head].concat(boss.segs);
    for (const p of boss.parts) G.bricks.push(p);
    return boss;
  }
  function sampleHist(boss, dist, out) {
    const h = boss.hist;
    let acc = 0;
    for (let i = h.length - 1; i > 0; i--) {
      const a = h[i], b = h[i - 1];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (acc + d >= dist) {
        const t = (dist - acc) / (d || 1);
        out.x = a.x + (b.x - a.x) * t; out.y = a.y + (b.y - a.y) * t;
        out.ang = Math.atan2(a.y - b.y, a.x - b.x);
        return;
      }
      acc += d;
    }
    out.x = h[0].x; out.y = h[0].y;
  }
  function updateDragon(boss, dt, active) {
    const G = LW.G, head = boss.core;
    boss.enter = Math.min(1, boss.enter + dt / 1.9);
    let alive = 0;
    for (const s of boss.segs) if (s.alive) alive++;
    if (!boss.dying) {
      const rate = 0.68 + (14 - alive) * 0.014 + (boss.enraged ? 0.1 : 0);
      boss.t += dt * rate;
      dragonPath(boss.t, tmp);
      const hx = tmp.x, hy = tmp.y - 430 * (1 - U.easeOutCubic(boss.enter));
      const last = boss.hist[boss.hist.length - 1];
      const dx = hx - last.x, dy = hy - last.y;
      if (dx * dx + dy * dy > 4) {
        boss.hist.push({ x: hx, y: hy });
        if (boss.hist.length > 760) boss.hist.shift();
        const target = Math.atan2(dy, dx);
        let da = target - head.ang;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        head.ang += da * Math.min(1, dt * 10);
      }
      head.x = hx; head.y = hy;
    }
    let k = 0;
    for (const s of boss.segs) {
      if (!s.alive) continue;
      k++;
      s.off = U.damp(s.off, k * 39 + 12, 5, dt);
      sampleHist(boss, s.off, tmp);
      s.x = tmp.x; s.y = tmp.y; s.ang = tmp.ang;
    }
    if (active && boss.enter >= 1 && !boss.dying) {
      boss.spitT -= dt;
      if (boss.spitT < 0.6) boss.mouth = Math.min(1, boss.mouth + dt * 4);
      if (boss.spitT <= 0) {
        const p = G.paddle;
        const n = boss.enraged ? 3 : 1;
        const base = Math.atan2(C.PADDLE_Y - head.y, p.x - head.x);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.3;
          let vx = Math.cos(a) * 255, vy = Math.sin(a) * 255;
          if (vy < 150) vy = 150;
          G.hazards.push({ kind: 'ember', x: head.x + Math.cos(base) * 26, y: head.y + Math.sin(base) * 26, vx, vy, r: 11, t: 0 });
        }
        S.spit();
        boss.spitT = boss.enraged ? 2.7 : 3.9;
      }
    } else if (boss.mouth > 0 && boss.spitT > 0.6) boss.mouth = Math.max(0, boss.mouth - dt * 3);
    if (boss.spitT > 0.6) boss.mouth = Math.max(0, boss.mouth - dt * 3);
  }

  function drawDragon(g, boss) {
    const G = LW.G, t = G.time, head = boss.core, rr = Art.rr;
    // cloth body
    g.lineCap = 'round'; g.lineJoin = 'round';
    const pts = [];
    if (head.alive) pts.push(head);
    for (const s of boss.segs) if (s.alive) pts.push(s);
    if (pts.length > 1) {
      const path = () => {
        g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      };
      path(); g.strokeStyle = '#4c0a10'; g.lineWidth = 27; g.stroke();
      path(); g.strokeStyle = '#a2181c'; g.lineWidth = 19; g.stroke();
      path(); g.strokeStyle = 'rgba(255,200,90,0.5)'; g.lineWidth = 3; g.setLineDash([3, 9]); g.stroke(); g.setLineDash([]);
    }
    g.globalCompositeOperation = 'lighter';
    for (const s of boss.segs) if (s.alive) Art.drawGlow(g, s.hp > 1 ? [255, 110, 50] : [255, 220, 140], s.x, s.y, s.r * 2.6, 0.4);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

    for (let i = boss.segs.length - 1; i >= 0; i--) {
      const s = boss.segs[i];
      if (!s.alive) continue;
      const hot = s.hp <= 1;
      const jx = hot ? Math.sin(t * 40 + i) * 0.8 : 0;
      // dorsal fin
      let nx = -Math.sin(s.ang), ny = Math.cos(s.ang);
      if (ny > 0) { nx = -nx; ny = -ny; }
      const dx = Math.cos(s.ang), dy = Math.sin(s.ang);
      g.fillStyle = '#ffd24a';
      g.beginPath();
      g.moveTo(s.x + dx * 8 + nx * (s.r - 3), s.y + dy * 8 + ny * (s.r - 3));
      g.lineTo(s.x - dx * 7 + nx * (s.r + 12), s.y - dy * 7 + ny * (s.r + 12));
      g.lineTo(s.x - dx * 9 + nx * (s.r - 3), s.y - dy * 9 + ny * (s.r - 3));
      g.closePath(); g.fill();
      if (hot) disc(g, s.x + jx, s.y, s.r, '#ffffff', '#ffd884', '#ff7c2a');
      else disc(g, s.x, s.y, s.r, '#fff2b8', '#ff8a2c', '#b01a1a');
      g.strokeStyle = 'rgba(90,10,0,0.3)'; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(s.x, s.y, s.r * 0.5, s.r * 0.96, s.ang, 0, TAU); g.stroke();
      g.strokeStyle = '#ffd24a'; g.lineWidth = 2;
      g.beginPath(); g.arc(s.x + jx, s.y, s.r, 0, TAU); g.stroke();
      flashDisc(g, s);
    }
    if (!head.alive) return;

    g.save();
    g.translate(head.x, head.y);
    g.rotate(head.ang);
    if (Math.cos(head.ang) < 0) g.scale(1, -1);
    const R = head.r;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.56 + (i / 6) * Math.PI * 0.88;
      const len = R + 17 + Math.sin(t * 6 + i * 1.3) * 5;
      g.fillStyle = i % 2 ? '#ffd24a' : '#fff1c4';
      g.beginPath();
      g.moveTo(Math.cos(a - 0.22) * R * 0.8, Math.sin(a - 0.22) * R * 0.8);
      g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      g.lineTo(Math.cos(a + 0.22) * R * 0.8, Math.sin(a + 0.22) * R * 0.8);
      g.closePath(); g.fill();
    }
    g.strokeStyle = '#f6e6c0'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-4, -R + 6); g.quadraticCurveTo(-16, -R - 14, -35, -R - 15); g.stroke();
    g.beginPath(); g.moveTo(-15, -R - 9); g.lineTo(-19, -R - 22); g.stroke();
    // lower jaw
    const open = boss.mouth;
    g.save();
    g.translate(8, 8); g.rotate(0.1 + open * 0.5);
    rr(g, 0, 0, 36, 11, 5); g.fillStyle = '#84101a'; g.fill();
    g.fillStyle = '#fff8e8';
    for (let i = 0; i < 3; i++) { const x = 13 + i * 8; g.beginPath(); g.moveTo(x - 3, 0.5); g.lineTo(x, -5); g.lineTo(x + 3, 0.5); g.fill(); }
    g.restore();
    if (open > 0.05) {
      g.globalCompositeOperation = 'lighter';
      Art.drawGlow(g, [255, 150, 60], 36, 12, 26 * open, open, true);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    disc(g, 0, 0, R, '#ff8258', '#cf1f1f', '#740a12');
    rr(g, 6, -15, 43, 23, 10);
    const sg = g.createLinearGradient(0, -15, 0, 8);
    sg.addColorStop(0, '#e63a2c'); sg.addColorStop(1, '#96121a');
    g.fillStyle = sg; g.fill();
    g.strokeStyle = '#ffd24a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(12, 8); g.lineTo(46, 8); g.stroke();
    g.fillStyle = '#fff8e8';
    for (let i = 0; i < 4; i++) { const x = 19 + i * 8; g.beginPath(); g.moveTo(x - 3, 8); g.lineTo(x, 14); g.lineTo(x + 3, 8); g.fill(); }
    g.fillStyle = '#3a0508'; g.beginPath(); g.arc(44, -8, 2.2, 0, TAU); g.fill();
    g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(6, -10, 8.5, 0, TAU); g.fill();
    g.fillStyle = boss.enraged ? '#ff5a20' : '#ffb820'; g.beginPath(); g.arc(7.5, -10, 5.6, 0, TAU); g.fill();
    g.fillStyle = '#1a0508'; g.beginPath(); g.ellipse(8.5, -10, 1.8, 4.6, 0, 0, TAU); g.fill();
    g.strokeStyle = '#ffd24a'; g.lineWidth = 4.5;
    g.beginPath(); g.moveTo(-7, -23); g.quadraticCurveTo(6, -25, 19, -14); g.stroke();
    g.lineWidth = 2;
    for (const k of [-1, 1]) {
      const w = Math.sin(t * 5 + k) * 6;
      g.beginPath(); g.moveTo(45, 2);
      g.bezierCurveTo(62, 10 + w, 42, 28 + k * 4 + w, 14, 32 + k * 7);
      g.stroke();
    }
    if (head.flash > 0) {
      g.globalAlpha = head.flash * 0.7; g.fillStyle = '#fff';
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      rr(g, 6, -15, 43, 23, 10); g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
  }

  /* ======================================================== STORM DRUM ==== */
  function makeDrum() {
    const G = LW.G;
    const boss = {
      kind: 'drum', name: 'The Storm Drum', rgb: [150, 220, 255], rageText: 'THE STORM BREAKS',
      t: 0, swayT: 0, shields: [], strikes: [], strikeT: 4.6, parts: [], cloud: [],
    };
    const core = mkPart('drumCore', 640, -200, 44, 16, true);
    boss.core = core;
    const rings = [{ n: 6, rad: 96, sp: 0.85 }, { n: 10, rad: 172, sp: -0.5 }];
    rings.forEach((r) => {
      for (let i = 0; i < r.n; i++) {
        const s = mkPart('stormShield', 640, -200, 17, 2, false);
        s.ringDef = r; s.slot = i; s.respawn = 0;
        boss.shields.push(s);
      }
    });
    const rc = U.rng(77);
    for (let i = 0; i < 9; i++) boss.cloud.push({ a: rc() * TAU, d: 40 + rc() * 50, r: 60 + rc() * 40, ph: rc() * TAU });
    boss.parts = [core].concat(boss.shields);
    for (const p of boss.parts) G.bricks.push(p);
    return boss;
  }
  function updateDrum(boss, dt, active) {
    const G = LW.G, core = boss.core;
    boss.enter = Math.min(1, boss.enter + dt / 1.8);
    const speed = boss.enraged ? 1.45 : 1;
    if (!boss.dying) {
      boss.t += dt * speed;
      if (boss.enraged) boss.swayT += dt;
    }
    core.x = 640 + 190 * Math.sin(boss.swayT * 0.55);
    core.y = 250 + 6 * Math.sin(boss.t * 1.4) - 420 * (1 - U.easeOutCubic(boss.enter));
    for (const s of boss.shields) {
      const r = s.ringDef, a = (s.slot / r.n) * TAU + boss.t * r.sp;
      s.x = core.x + Math.cos(a) * r.rad;
      s.y = core.y + Math.sin(a) * r.rad * 0.92;
      if (!s.alive && !boss.dying && core.alive) {
        s.respawn -= dt;
        if (s.respawn <= 0) { s.alive = true; s.hp = s.maxHp; s.ghostT = 0.7; s.ghost = true; s.revived = true; }
      }
    }
    if (active && boss.enter >= 1 && !boss.dying) {
      boss.strikeT -= dt;
      if (boss.strikeT <= 0) {
        const p = G.paddle;
        const x = clamp(p.x + p.vx * 0.25, C.L + 40, C.R - 40);
        boss.strikes.push({ x, t: 0, warn: 0.95, fired: false, pts: null });
        if (boss.enraged) {
          const x2 = clamp(x + (x < 640 ? 1 : -1) * rand(170, 260), C.L + 40, C.R - 40);
          boss.strikes.push({ x: x2, t: -0.32, warn: 0.95, fired: false, pts: null });
        }
        S.telegraph();
        boss.strikeT = boss.enraged ? 3.5 : 4.9;
      }
    }
    for (let i = boss.strikes.length - 1; i >= 0; i--) {
      const s = boss.strikes[i];
      s.t += dt;
      if (!s.fired && s.t >= s.warn) {
        s.fired = true;
        const pts = [];
        let x = s.x + rand(-60, 60);
        for (let y = C.T - 20; y < C.WATER; y += 34) {
          pts.push(x, y);
          x += (s.x - x) * 0.3 + rand(-22, 22);
        }
        pts.push(s.x, C.WATER);
        s.pts = pts;
        G.flashScreen(0.5, [200, 235, 255]);
        G.shake(11);
        S.thunder();
        G.splash(s.x, 0.8);
        G.sparks(s.x, C.WATER - 6, 22, [190, 230, 255], 360, { dir: -Math.PI / 2, spread: 1.3, life: 0.5, hot: true });
        const p = G.paddle;
        if (!boss.dying && Math.abs(p.x - s.x) < p.w / 2 + 24) G.stun(1.15);
      }
      if (s.t > s.warn + 0.32) boss.strikes.splice(i, 1);
    }
  }
  function drawDrum(g, boss) {
    const G = LW.G, t = G.time, c = boss.core;
    // storm cloud
    for (const b of boss.cloud) {
      const x = c.x + Math.cos(b.a) * b.d + Math.sin(t * 0.5 + b.ph) * 8;
      const y = c.y + Math.sin(b.a) * b.d * 0.6 + Math.cos(t * 0.4 + b.ph) * 5;
      Art.drawGlow(g, [10, 22, 30], x, y, b.r, 0.85);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'lighter';
    const fl = Math.max(0, Math.sin(t * 3.1) * Math.sin(t * 7.7) - 0.55) * 2;
    Art.drawGlow(g, [150, 210, 255], c.x + Math.sin(t) * 30, c.y - 20, 120, 0.1 + fl * 0.5);
    for (const s of boss.shields) {
      if (!s.alive) continue;
      const al = s.ghost ? 0.3 : 1;
      Art.drawGlow(g, s.hp > 1 ? [110, 190, 255] : [235, 250, 255], s.x, s.y, s.r * 2.5, 0.42 * al);
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // orbit hints
    g.strokeStyle = 'rgba(150,220,255,0.07)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(c.x, c.y, 96, 96 * 0.92, 0, 0, TAU); g.stroke();
    g.beginPath(); g.ellipse(c.x, c.y, 172, 172 * 0.92, 0, 0, TAU); g.stroke();

    for (const s of boss.shields) {
      if (!s.alive) continue;
      g.globalAlpha = s.ghost ? 0.35 + 0.2 * Math.sin(t * 30) : 1;
      g.fillStyle = '#0c1620';
      g.fillRect(s.x - 6, s.y - s.r - 2.5, 12, 4); g.fillRect(s.x - 6, s.y + s.r - 1.5, 12, 4);
      if (s.hp > 1) disc(g, s.x, s.y, s.r, '#c8ecff', '#3a7cc0', '#102c58');
      else disc(g, s.x + Math.sin(t * 44 + s.slot) * 0.8, s.y, s.r, '#ffffff', '#b4e4ff', '#3c8cd0');
      g.strokeStyle = 'rgba(220,244,255,0.9)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.stroke();
      Art.icon(g, 'stun', s.x, s.y, 17, s.hp > 1 ? 'rgba(255,255,255,0.92)' : 'rgba(30,80,140,0.95)');
      flashDisc(g, s);
    }
    g.globalAlpha = 1;
    if (!c.alive) return;
    const sc = 1 + boss.beat * 0.07;
    g.save();
    g.translate(c.x, c.y); g.scale(sc, sc);
    disc(g, 0, 0, c.r + 5, '#9a3220', '#5e1410', '#280608');
    g.fillStyle = '#eabc50';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      g.beginPath(); g.arc(Math.cos(a) * (c.r + 0.5), Math.sin(a) * (c.r + 0.5), 2.5, 0, TAU); g.fill();
    }
    disc(g, 0, 0, c.r - 5, '#fffae8', '#ecdcb8', '#b49868');
    Art.icon(g, 'stun', 0, 0, c.r * 1.25, boss.enraged ? '#c8201a' : '#8a1a14');
    // split skin as it weakens
    const dmg = 1 - c.hp / c.maxHp;
    g.strokeStyle = 'rgba(60,20,10,0.75)'; g.lineWidth = 1.4; g.lineJoin = 'round';
    const rc = U.rng(5);
    const n = Math.floor(dmg * 7);
    for (let i = 0; i < n; i++) {
      let a = rc() * TAU, r = 6 + rc() * 8, x = Math.cos(a) * r, y = Math.sin(a) * r;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { a += rc() - 0.5; r += 7 + rc() * 4; if (r > c.r - 6) r = c.r - 6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.stroke();
    }
    g.restore();
    if (c.flash > 0) {
      g.globalAlpha = c.flash * 0.6; g.fillStyle = '#fff';
      g.beginPath(); g.arc(c.x, c.y, c.r + 5, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
  }
  function drawStrikes(g, boss) {
    const G = LW.G, t = G.time;
    g.globalCompositeOperation = 'lighter';
    for (const s of boss.strikes) {
      if (s.t < 0) continue;
      if (!s.fired) {
        const k = s.t / s.warn;
        const fl = 0.25 + 0.5 * Math.abs(Math.sin(t * (20 + k * 40)));
        g.globalAlpha = fl * (0.25 + k * 0.5);
        g.strokeStyle = '#bfe6ff'; g.lineWidth = 1.2;
        g.setLineDash([6, 10]);
        g.beginPath(); g.moveTo(s.x, C.T); g.lineTo(s.x, C.WATER); g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 0.5 + 0.4 * k;
        g.strokeStyle = '#eaf6ff'; g.lineWidth = 2;
        const rx = 46 - 20 * k;
        g.beginPath(); g.ellipse(s.x, C.WATER - 3, rx, rx * 0.22, 0, 0, TAU); g.stroke();
        Art.drawGlow(g, [150, 210, 255], s.x, C.T + 10, 70 + k * 50, 0.2 + k * 0.5);
        Art.drawGlow(g, [150, 210, 255], s.x, C.WATER - 4, 40, 0.2 + k * 0.4);
      } else if (s.pts) {
        const a = 1 - (s.t - s.warn) / 0.32;
        const path = () => { g.beginPath(); g.moveTo(s.pts[0], s.pts[1]); for (let i = 2; i < s.pts.length; i += 2) g.lineTo(s.pts[i], s.pts[i + 1]); };
        g.lineJoin = 'round';
        g.globalAlpha = a * 0.35; g.strokeStyle = '#78c8ff'; g.lineWidth = 22; path(); g.stroke();
        g.globalAlpha = a * 0.6; g.strokeStyle = '#a8dcff'; g.lineWidth = 9; path(); g.stroke();
        g.globalAlpha = a; g.strokeStyle = '#ffffff'; g.lineWidth = 3.2; path(); g.stroke();
        Art.drawGlow(g, [190, 230, 255], s.x, C.WATER - 6, 110, a * 0.8, true);
      }
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }

  /* ======================================================= HOLLOW MOON ==== */
  function makeMoon() {
    const G = LW.G;
    const boss = {
      kind: 'moon', name: 'The Hollow Moon', rgb: [226, 190, 255], rageText: 'THE MOON DESCENDS',
      t: 0, swayT: 0, ringA: 0, ring: [], atkT: 5.5, next: null, warn: 0, dark: 0, darkT: 0, parts: [], cracks: [], first: true,
    };
    const core = mkPart('moonCore', 640, -300, 60, 30, true);
    boss.core = core;
    for (let i = 0; i < 8; i++) {
      const s = mkPart('shadow', 640, -300, 18, 2, false);
      s.slot = i;
      boss.ring.push(s);
    }
    const rc = U.rng(42);
    for (let i = 0; i < 10; i++) boss.cracks.push(null);
    boss.cracks = boss.cracks.map(() => {
      let a = rc() * TAU, r = 0.05 + rc() * 0.2;
      const pts = [Math.cos(a) * r, Math.sin(a) * r];
      while (r < 1) {
        a += (rc() - 0.5) * 0.9; r = Math.min(1, r + 0.14 + rc() * 0.16);
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      return pts;
    });
    boss.parts = [core].concat(boss.ring);
    for (const p of boss.parts) G.bricks.push(p);
    return boss;
  }
  function updateMoon(boss, dt, active) {
    const G = LW.G, core = boss.core;
    boss.enter = Math.min(1, boss.enter + dt / 2.8);
    if (!boss.dying) {
      boss.t += dt;
      boss.ringA += dt * (boss.enraged ? 0.85 : 0.55);
      if (boss.enraged) boss.swayT += dt;
    }
    core.x = 640 + 240 * Math.sin(boss.swayT * 0.42);
    core.y = 222 + 10 * Math.sin(boss.t * 0.8) - 460 * (1 - U.easeOutCubic(boss.enter));
    for (const s of boss.ring) {
      const a = (s.slot / boss.ring.length) * TAU + boss.ringA;
      s.x = core.x + Math.cos(a) * 130; s.y = core.y + Math.sin(a) * 130;
    }
    if (boss.darkT > 0) { boss.darkT -= dt; boss.dark = U.damp(boss.dark, 1, 3, dt); }
    else boss.dark = U.damp(boss.dark, 0, 2.6, dt);
    if (boss.dying) { boss.darkT = 0; boss.warn = 0; return; }
    if (!active || boss.enter < 1) return;
    boss.atkT -= dt;
    if (boss.atkT <= 1 && !boss.next) {
      let missing = 0;
      for (const s of boss.ring) if (!s.alive) missing++;
      const opts = ['rain', 'rain'];
      if (missing >= 3) opts.push('summon', 'summon');
      if (boss.darkT <= 0 && !boss.first) opts.push('eclipse', boss.enraged ? 'eclipse' : 'rain');
      boss.next = boss.first ? 'rain' : U.pick(opts);
      boss.first = false;
      S.telegraph();
    }
    boss.warn = boss.next ? clamp(1 - boss.atkT, 0, 1) : Math.max(0, boss.warn - dt * 3);
    if (boss.atkT <= 0) {
      const kind = boss.next;
      boss.next = null;
      boss.atkT = boss.enraged ? 5 : 7;
      if (kind === 'eclipse') {
        boss.darkT = 5;
        S.eclipse();
        G.popup(640, 470, 'ECLIPSE', [200, 160, 255], 26);
      } else if (kind === 'summon') {
        for (const s of boss.ring) {
          if (s.alive) continue;
          s.alive = true; s.hp = s.maxHp; s.ghostT = 0.8; s.ghost = true;
          G.ring(s.x, s.y, 40, 8, 0.5, [190, 150, 255], 3);
        }
        S.shadow();
      } else {
        const n = boss.enraged ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const tx = C.L + 70 + ((C.R - C.L - 140) * (i + 0.5)) / n + rand(-50, 50);
          const dx = tx - core.x, dy = C.WATER - core.y, d = Math.hypot(dx, dy);
          const sp = rand(190, 235);
          G.hazards.push({ kind: 'shadow', x: core.x + (dx / d) * core.r, y: core.y + (dy / d) * core.r, vx: (dx / d) * sp, vy: (dy / d) * sp, r: 12, t: 0 });
        }
        S.shadow();
        G.ring(core.x, core.y, core.r, core.r + 70, 0.5, [170, 110, 240], 4);
      }
    }
  }
  // The moon's pull gently bends a spark's path.
  B.bend = function (boss, ball, dt) {
    if (boss.dying || boss.dead || boss.enter < 1) return;
    const c = boss.core;
    const dx = c.x - ball.x, dy = c.y - ball.y, d = Math.hypot(dx, dy);
    if (d > 310 || d < c.r + 14) return;
    const a = 560 * (1 - d / 310);
    ball.vx += (dx / d) * a * dt; ball.vy += (dy / d) * a * dt;
  };
  function drawMoon(g, boss) {
    const G = LW.G, t = G.time, c = boss.core;
    g.globalCompositeOperation = 'lighter';
    for (const s of boss.ring) {
      if (!s.alive) continue;
      Art.drawGlow(g, s.hp > 1 ? [120, 70, 190] : [240, 225, 255], s.x, s.y, s.r * 2.6, (s.ghost ? 0.2 : 0.45));
    }
    if (c.alive) {
      const pulse = 0.5 + 0.08 * Math.sin(t * 2) + boss.warn * 0.3 + boss.beat * 0.3;
      Art.drawGlow(g, [190, 140, 255], c.x, c.y, c.r * 3, pulse * 0.8);
      Art.drawGlow(g, [255, 232, 244], c.x, c.y, c.r * 1.62, 0.7);
      g.globalAlpha = 0.22; g.strokeStyle = '#ecd8ff'; g.lineWidth = 2; g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a0 = t * (0.3 + i * 0.07) * (i % 2 ? 1 : -1) + i;
        g.beginPath(); g.arc(c.x, c.y, c.r + 9 + i * 5, a0, a0 + 1.1 + (i % 3) * 0.4); g.stroke();
      }
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

    for (const s of boss.ring) {
      if (!s.alive) continue;
      g.globalAlpha = s.ghost ? 0.3 + 0.2 * Math.sin(t * 30) : 1;
      g.fillStyle = '#08040c';
      g.fillRect(s.x - 6, s.y - s.r - 2.5, 12, 4); g.fillRect(s.x - 6, s.y + s.r - 1.5, 12, 4);
      if (s.hp > 1) {
        disc(g, s.x, s.y, s.r, '#2c1840', '#140a20', '#04020a');
        g.strokeStyle = 'rgba(190,150,255,0.8)';
      } else {
        disc(g, s.x, s.y, s.r, '#ffffff', '#e6d4ff', '#9a78d0');
        g.strokeStyle = 'rgba(255,255,255,0.9)';
      }
      g.lineWidth = 1.4;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.stroke();
      g.strokeStyle = s.hp > 1 ? 'rgba(190,150,255,0.18)' : 'rgba(80,40,120,0.25)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(s.x, s.y, s.r, s.r * 0.45, 0, 0, TAU); g.stroke();
      flashDisc(g, s);
    }
    g.globalAlpha = 1;
    if (!c.alive && !boss.dying) return;

    const shakeX = boss.dying ? rand(-3, 3) : 0, shakeY = boss.dying ? rand(-3, 3) : 0;
    const x = c.x + shakeX, y = c.y + shakeY;
    const gr = g.createRadialGradient(x, y, c.r * 0.2, x, y, c.r);
    gr.addColorStop(0, '#000000'); gr.addColorStop(0.8, '#06030c'); gr.addColorStop(1, '#1c0e2a');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, c.r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,236,246,0.92)'; g.lineWidth = 1.8;
    g.beginPath(); g.arc(x, y, c.r, 0, TAU); g.stroke();

    // cracks of trapped dawn
    const frac = boss.dying ? 1 : 1 - c.hp / c.maxHp;
    const n = Math.min(boss.cracks.length, Math.floor(frac * (boss.cracks.length + 0.99)));
    g.globalCompositeOperation = 'lighter';
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const pts = boss.cracks[i];
      const path = () => {
        g.beginPath(); g.moveTo(x + pts[0] * c.r, y + pts[1] * c.r);
        for (let k = 2; k < pts.length; k += 2) g.lineTo(x + pts[k] * c.r, y + pts[k + 1] * c.r);
      };
      const fl = 0.75 + 0.25 * Math.sin(t * 9 + i * 2);
      g.globalAlpha = 0.3 * fl; g.strokeStyle = '#ffb050'; g.lineWidth = 7; path(); g.stroke();
      g.globalAlpha = fl; g.strokeStyle = '#fff2c8'; g.lineWidth = 1.8; path(); g.stroke();
    }
    // the eye opens before each attack
    if (boss.warn > 0.02 && !boss.dying) {
      const col = boss.next === 'eclipse' ? [170, 110, 255] : boss.next === 'summon' ? [240, 230, 255] : [255, 90, 120];
      g.globalAlpha = boss.warn;
      g.fillStyle = U.rgba(col, 1);
      g.beginPath(); g.ellipse(x, y, 30, 15 * boss.warn, 0, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000';
      g.beginPath(); g.ellipse(x, y, 5 + 3 * boss.warn, 14 * boss.warn, 0, 0, TAU); g.fill();
      g.globalCompositeOperation = 'lighter';
      Art.drawGlow(g, col, x, y, 70, boss.warn * 0.6);
    }
    if (boss.dying) {
      const k = clamp(boss.dieT / 3.2, 0, 1);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * 0.5, len = 80 + k * 700, wdt = 0.05 + k * 0.05;
        g.globalAlpha = 0.14 + k * 0.26;
        g.fillStyle = '#ffe6b0';
        g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + Math.cos(a - wdt) * len, y + Math.sin(a - wdt) * len);
        g.lineTo(x + Math.cos(a + wdt) * len, y + Math.sin(a + wdt) * len);
        g.closePath(); g.fill();
      }
      Art.drawGlow(g, [255, 236, 190], x, y, c.r * (1 + k * 2.4), 0.5 + k * 0.5, true);
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    if (c.flash > 0 && !boss.dying) {
      g.globalAlpha = c.flash * 0.5; g.fillStyle = '#f0e0ff';
      g.beginPath(); g.arc(x, y, c.r, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
  }

  B.draw = function (g, boss) {
    if (!boss || boss.dead) return;
    if (boss.kind === 'dragon') drawDragon(g, boss);
    else if (boss.kind === 'drum') drawDrum(g, boss);
    else drawMoon(g, boss);
  };
  B.drawFront = function (g, boss) {
    if (!boss) return;
    if (boss.kind === 'drum') drawStrikes(g, boss);
  };
})();
