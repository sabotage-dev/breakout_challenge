/* SHATTERWAVE — themed parallax backdrop (screen space) */
'use strict';
SW.THEMES = {
  s1: { name: 'NEON DRIFT', top: '#0a0326', bot: '#2b0a3d', grid: '#ff2bd6', glow: '#ff5ab0', accent: '#2de2ff', accent2: '#ff3b8b', feature: 'sun' },
  s2: { name: 'AURORA DEEP', top: '#020a18', bot: '#062a40', grid: '#21f5c4', glow: '#2de2ff', accent: '#21f5c4', accent2: '#b26bff', feature: 'aurora' },
  s3: { name: 'SOLAR FORGE', top: '#110205', bot: '#3d0b05', grid: '#ff7a1a', glow: '#ff5a36', accent: '#ffb000', accent2: '#ff3b3b', feature: 'star' },
  ot: { name: 'OVERTIME', top: '#05030f', bot: '#1a0630', grid: '#b26bff', glow: '#7a5cff', accent: '#ffffff', accent2: '#b26bff', feature: 'aurora', cycle: true },
};

SW.bg = {
  cur: SW.THEMES.s1, prev: null, blend: 1,
  stars: [], embers: [], t: 0, hue: 0,
  sunCanvas: null, starCanvas: null, lastW: 0, lastH: 0,
  init() {
    this.stars = [];
    for (let i = 0; i < 190; i++) this.stars.push({ x: Math.random(), y: Math.random(), z: U.rand(0.15, 1), p: Math.random() * 6 });
    this.embers = [];
    for (let i = 0; i < 70; i++) this.embers.push({ x: Math.random(), y: Math.random(), v: U.rand(0.02, 0.07), s: U.rand(1, 3), p: Math.random() * 6 });
  },
  setTheme(key) {
    const th = SW.THEMES[key] || SW.THEMES.s1;
    if (th === this.cur) return;
    this.prev = this.cur; this.cur = th; this.blend = 0;
    const root = document.documentElement.style;
    root.setProperty('--accent', th.accent);
    root.setProperty('--accent2', th.accent2);
  },
  accent() { return this.cur.cycle ? SW.C.hsl(this.hue, 100, 65) : this.cur.accent; },
  update(dt) {
    this.t += dt;
    this.blend = Math.min(1, this.blend + dt * 0.6);
    this.hue = (this.hue + dt * 12) % 360;
    for (const s of this.stars) { s.y += s.z * s.z * dt * 0.02; if (s.y > 1) { s.y -= 1; s.x = Math.random(); } }
    for (const e of this.embers) { e.y -= e.v * dt; e.x += Math.sin(this.t + e.p) * 0.0006; if (e.y < 0) { e.y = 1; e.x = Math.random(); } }
  },
  colors(th) {
    if (!th.cycle) return th;
    const h = this.hue;
    return Object.assign({}, th, { grid: SW.C.hsl(h, 95, 60), glow: SW.C.hsl(h + 40, 95, 60), bot: SW.C.hsl(h + 200, 70, 9) });
  },
  makeSun(R) {
    const c = SW.gfx.canvas(R * 2, R * 2), g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, R * 2);
    grd.addColorStop(0, '#fff07a'); grd.addColorStop(0.45, '#ff8a4a'); grd.addColorStop(1, '#ff1f9a');
    g.fillStyle = grd; g.beginPath(); g.arc(R, R, R, 0, U.TAU); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) {
      const y = R * 0.95 + i * R * 0.12, hgt = 2 + i * R * 0.012;
      g.fillRect(0, y, R * 2, hgt);
    }
    return c;
  },
  makeStar(R) {
    const c = SW.gfx.canvas(R * 2, R * 2), g = c.getContext('2d');
    const rg = g.createRadialGradient(R, R, 0, R, R, R);
    rg.addColorStop(0, '#fff6d8'); rg.addColorStop(0.28, '#ffc061'); rg.addColorStop(0.5, '#ff6a2a');
    rg.addColorStop(0.62, 'rgba(255,60,20,0.55)'); rg.addColorStop(1, 'rgba(255,40,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, R * 2, R * 2);
    return c;
  },
  draw(g, W, H) {
    if (W !== this.lastW || H !== this.lastH) {
      this.lastW = W; this.lastH = H;
      this.sunCanvas = this.makeSun(Math.round(Math.min(W, H) * 0.3));
      this.starCanvas = this.makeStar(Math.round(Math.min(W, H) * 0.42));
    }
    const beat = SW.audio.ready ? Math.pow(1 - SW.audio.beatPhase(), 4) : 0;
    const a = this.colors(this.cur);
    const p = this.prev ? this.colors(this.prev) : a;
    const k = U.smoothstep(this.blend);
    const top = SW.C.mix(p.top, a.top, k), bot = SW.C.mix(p.bot, a.bot, k);
    const grid = SW.C.mix(p.grid, a.grid, k), glow = SW.C.mix(p.glow, a.glow, k);
    const hz = H * 0.64;
    // sky
    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, top); sky.addColorStop(1, bot);
    g.fillStyle = sky; g.fillRect(0, 0, W, hz + 1);
    // stars
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(this.t * (1 + s.z * 2) + s.p);
      g.globalAlpha = tw * s.z;
      g.fillStyle = s.z > 0.8 ? '#ffffff' : '#bcc8ff';
      const sz = s.z * 2.2;
      g.fillRect(s.x * W, s.y * hz * 1.05, sz, sz);
    }
    g.globalAlpha = 1;
    // features (crossfade)
    if (this.prev && k < 1) this.feature(g, this.prev, W, H, hz, 1 - k, beat);
    this.feature(g, this.cur, W, H, hz, k, beat);
    // floor
    const fl = g.createLinearGradient(0, hz, 0, H);
    fl.addColorStop(0, SW.C.darken(bot, 0.2)); fl.addColorStop(1, '#020108');
    g.fillStyle = fl; g.fillRect(0, hz, W, H - hz);
    // horizon glow
    const hg = g.createLinearGradient(0, hz - H * 0.12, 0, hz + H * 0.05);
    hg.addColorStop(0, SW.C.rgba(glow, 0)); hg.addColorStop(0.7, SW.C.rgba(glow, 0.22 + beat * 0.12)); hg.addColorStop(1, SW.C.rgba(glow, 0));
    g.fillStyle = hg; g.fillRect(0, hz - H * 0.12, W, H * 0.17);
    // perspective grid
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = grid;
    const vx = W / 2, depth = H - hz;
    const nV = 22, spread = W * 2.2;
    g.lineWidth = 1;
    g.globalAlpha = 0.28 + beat * 0.2;
    g.beginPath();
    for (let i = -nV; i <= nV; i++) {
      const xb = vx + (i / nV) * spread;
      g.moveTo(vx + (i / nV) * W * 0.08, hz); g.lineTo(xb, H);
    }
    g.stroke();
    const nH = 14, off = (this.t * 0.35) % 1;
    for (let i = 0; i < nH; i++) {
      const z = (i + off) / nH;
      const y = hz + depth * z * z;
      g.globalAlpha = (0.08 + z * 0.5) * (0.75 + beat * 0.5);
      g.lineWidth = 1 + z * 1.5;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.globalAlpha = 0.6 + beat * 0.4; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, hz); g.lineTo(W, hz); g.stroke();
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  },
  feature(g, th, W, H, hz, alpha, beat) {
    if (alpha <= 0.01) return;
    const t = this.t;
    if (th.feature === 'sun') {
      const c = this.sunCanvas, R = c.width / 2;
      g.globalAlpha = alpha * 0.9;
      g.drawImage(SW.gfx.glow('#ff3b8b'), W / 2 - R * 2, hz - R * 2.3, R * 4, R * 4);
      g.drawImage(c, W / 2 - R, hz - R * 1.55 + Math.sin(t * 0.3) * 4);
      g.globalAlpha = 1;
    } else if (th.feature === 'star') {
      const c = this.starCanvas, R = c.width / 2;
      const cx = W * 0.5, cy = hz - R * 0.35;
      g.globalAlpha = alpha * (0.85 + beat * 0.15);
      g.drawImage(c, cx - R, cy - R);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,120,40,0.08)';
      for (let i = 0; i < 14; i++) {
        const an = t * 0.05 + (i / 14) * U.TAU, w = 0.05 + 0.03 * Math.sin(t + i);
        g.beginPath(); g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(an - w) * R * 1.6, cy + Math.sin(an - w) * R * 1.6);
        g.lineTo(cx + Math.cos(an + w) * R * 1.6, cy + Math.sin(an + w) * R * 1.6);
        g.fill();
      }
      g.fillStyle = '#ffb347';
      for (const e of this.embers) {
        g.globalAlpha = alpha * (0.4 + 0.6 * Math.abs(Math.sin(t * 3 + e.p))) * (1 - e.y * 0.3);
        g.fillRect(e.x * W, e.y * H, e.s, e.s);
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    } else if (th.feature === 'aurora') {
      const cols = th.cycle ? [SW.C.hsl(this.hue, 90, 60), SW.C.hsl(this.hue + 120, 90, 60), SW.C.hsl(this.hue + 240, 90, 60)] : ['#21f5c4', '#b26bff', '#2de2ff'];
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'round';
      for (let r = 0; r < 3; r++) {
        const base = hz * (0.25 + r * 0.16), amp = H * 0.05;
        for (let pass = 0; pass < 3; pass++) {
          g.globalAlpha = alpha * (0.05 + pass * 0.03) * (1 + beat * 0.3);
          g.strokeStyle = cols[r];
          g.lineWidth = (90 - pass * 30) * (H / 900);
          g.beginPath();
          for (let i = 0; i <= 32; i++) {
            const x = (i / 32) * W;
            const y = base + Math.sin(i * 0.35 + t * (0.4 + r * 0.13) + r * 2) * amp + Math.sin(i * 0.9 - t * 0.7 + r) * amp * 0.35;
            if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
  },
};
SW.bg.init();
