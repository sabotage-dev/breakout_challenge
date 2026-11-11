'use strict';
/* ==========================================================================
   HADAL — procedural art: vector icons and cached sprites.
   Everything is painted once into offscreen canvases at the current display
   scale, then blitted — no image files anywhere.
   ========================================================================== */

/* ---------- vector icons (drawn in a 24×24 box centred on the origin) ---------- */
const Icons = {
  draw(c, name, size, color) {
    c.save();
    c.scale(size / 24, size / 24);
    c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = color; c.fillStyle = color;
    (this.set[name] || this.set.dot)(c);
    c.restore();
  },
  set: {
    dot(c) { c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill(); },
    wide(c) {
      c.beginPath();
      c.moveTo(-4, 0); c.lineTo(-10, 0); c.moveTo(-7, -3); c.lineTo(-10, 0); c.lineTo(-7, 3);
      c.moveTo(4, 0); c.lineTo(10, 0); c.moveTo(7, -3); c.lineTo(10, 0); c.lineTo(7, 3);
      c.stroke();
      rr(c, -2.6, -4, 5.2, 8, 2); c.fill();
    },
    shrink(c) {
      c.beginPath();
      c.moveTo(-10, 0); c.lineTo(-4, 0); c.moveTo(-7, -3); c.lineTo(-4, 0); c.lineTo(-7, 3);
      c.moveTo(10, 0); c.lineTo(4, 0); c.moveTo(7, -3); c.lineTo(4, 0); c.lineTo(7, 3);
      c.stroke();
      rr(c, -1.2, -4.5, 2.4, 9, 1.2); c.fill();
    },
    multi(c) {
      const p = [[0, -5], [-5.6, 4], [5.6, 4]];
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(p[i][0], p[i][1], 3.3, 0, TAU); c.fill(); }
    },
    twin(c) {
      c.beginPath(); c.arc(-4.6, 0, 4, 0, TAU); c.fill();
      c.beginPath(); c.arc(4.6, 0, 4, 0, TAU); c.fill();
    },
    laser(c) {
      for (let x = -5; x <= 5; x += 10) {
        c.beginPath(); c.moveTo(x, 8); c.lineTo(x, -7);
        c.moveTo(x - 3, -4); c.lineTo(x, -8); c.lineTo(x + 3, -4); c.stroke();
      }
    },
    rack(c) {
      c.beginPath(); c.moveTo(0, 5); c.lineTo(0, -8);
      c.moveTo(-3.5, -4.5); c.lineTo(0, -9); c.lineTo(3.5, -4.5); c.stroke();
      rr(c, -7, 5.5, 14, 3.4, 1.7); c.fill();
    },
    pierce(c) {
      c.beginPath(); c.arc(3.2, -3.2, 4.6, 0, TAU); c.fill();
      c.beginPath();
      c.moveTo(-1.5, 1.5); c.lineTo(-8, 8);
      c.moveTo(-3.5, -3); c.lineTo(-9, 2.5);
      c.moveTo(3, 3.5); c.lineTo(-2.5, 9);
      c.stroke();
    },
    sticky(c) {                                   // an anchor
      c.beginPath(); c.arc(0, -7.2, 2, 0, TAU); c.stroke();
      c.beginPath();
      c.moveTo(0, -5.2); c.lineTo(0, 8.5);
      c.moveTo(-4, -2); c.lineTo(4, -2);
      c.moveTo(-7.5, 2); c.quadraticCurveTo(-7, 8.5, 0, 8.5); c.quadraticCurveTo(7, 8.5, 7.5, 2);
      c.stroke();
    },
    slow(c) {
      for (let y = -3.5; y <= 3.5; y += 7) {
        c.beginPath(); c.moveTo(-9, y);
        c.bezierCurveTo(-5, y - 5, -4, y + 5, 0, y);
        c.bezierCurveTo(4, y - 5, 5, y + 5, 9, y);
        c.stroke();
      }
    },
    net(c) {
      c.save();
      c.beginPath(); c.arc(0, 0, 8.6, 0, TAU); c.clip();
      c.lineWidth = 1.4; c.beginPath();
      for (let k = -18; k <= 18; k += 6) {
        c.moveTo(k - 12, -12); c.lineTo(k + 12, 12);
        c.moveTo(k + 12, -12); c.lineTo(k - 12, 12);
      }
      c.stroke(); c.restore();
      c.beginPath(); c.arc(0, 0, 8.6, 0, TAU); c.stroke();
    },
    life(c) {
      c.beginPath(); c.moveTo(0, 8.5);
      c.bezierCurveTo(-12, 0.5, -8.5, -9.5, 0, -3.5);
      c.bezierCurveTo(8.5, -9.5, 12, 0.5, 0, 8.5);
      c.fill();
    },
    blast(c) {
      c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill();
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        c.moveTo(Math.cos(a) * 6.2, Math.sin(a) * 6.2); c.lineTo(Math.cos(a) * 9.6, Math.sin(a) * 9.6);
      }
      c.stroke();
    },
    volatile(c) {
      c.beginPath(); c.arc(0, 0, 5.2, 0, TAU); c.stroke();
      c.beginPath(); c.arc(0, 0, 1.8, 0, TAU); c.fill();
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + 0.5;
        c.moveTo(Math.cos(a) * 5.2, Math.sin(a) * 5.2); c.lineTo(Math.cos(a) * 9.4, Math.sin(a) * 9.4);
      }
      c.stroke();
    },
    fast(c) {
      c.beginPath();
      c.moveTo(-6, 1); c.lineTo(0, -5); c.lineTo(6, 1);
      c.moveTo(-6, 7.5); c.lineTo(0, 1.5); c.lineTo(6, 7.5);
      c.stroke();
    },
    sonar(c) {
      c.beginPath(); c.arc(-6, 6, 1.9, 0, TAU); c.fill();
      const rs = [5.5, 10, 14.5];
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-6, 6, rs[i], -Math.PI / 2, 0); c.stroke(); }
    },
    amp(c) {
      rr(c, -8, 5, 16, 3.6, 1.8); c.fill();
      c.beginPath();
      c.moveTo(-4.5, 1); c.lineTo(0, -3.5); c.lineTo(4.5, 1);
      c.moveTo(-4.5, -4.5); c.lineTo(0, -9); c.lineTo(4.5, -4.5);
      c.stroke();
    },
    luck(c) {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * TAU / 10, r = i % 2 ? 4 : 9.5;
        if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r); else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath(); c.fill();
    },
    magnet(c) {
      c.lineWidth = 4; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(-5.5, -8); c.lineTo(-5.5, 1.5);
      c.arc(0, 1.5, 5.5, Math.PI, 0, true); c.lineTo(5.5, -8); c.stroke();
    },
    arc(c) {
      c.beginPath();
      c.moveTo(3.5, -9.5); c.lineTo(-5, 1); c.lineTo(0, 1); c.lineTo(-3.5, 9.5);
      c.lineTo(5.5, -2); c.lineTo(0.5, -2); c.closePath(); c.fill();
    },
    chain(c) {
      c.lineWidth = 2.6; c.beginPath();
      c.moveTo(-4.5, -4.5); c.lineTo(4.5, 4.5); c.moveTo(4.5, -4.5); c.lineTo(-4.5, 4.5); c.stroke();
      c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 9.5, 0, TAU); c.stroke();
    },
    heavy(c) {
      c.beginPath(); c.arc(0, 0, 8.6, 0, TAU); c.stroke();
      c.beginPath(); c.arc(0, 0, 4.4, 0, TAU); c.fill();
    },
    timer(c) {
      c.beginPath(); c.moveTo(-6, -8.5); c.lineTo(6, -8.5); c.lineTo(-6, 8.5); c.lineTo(6, 8.5); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-3, 6.5); c.lineTo(3, 6.5); c.lineTo(0, 3); c.closePath(); c.fill();
    },
    hull(c) {
      c.beginPath(); c.moveTo(0, -9.5); c.lineTo(8, -6.5); c.lineTo(8, 0);
      c.quadraticCurveTo(8, 6.5, 0, 10); c.quadraticCurveTo(-8, 6.5, -8, 0); c.lineTo(-8, -6.5);
      c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-3.5, 0); c.lineTo(-1, 3); c.lineTo(4, -3); c.stroke();
    },
    echo(c) {
      c.beginPath(); c.arc(-3.5, 0, 5.2, 0, TAU); c.fill();
      c.setLineDash([2.2, 2.6]);
      c.beginPath(); c.arc(4.5, 0, 5.4, 0, TAU); c.stroke();
      c.setLineDash([]);
    },
    score(c) {
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(0, -9); c.lineTo(8.5, -2); c.lineTo(0, 9.5); c.lineTo(-8.5, -2); c.closePath();
      c.moveTo(-8.5, -2); c.lineTo(8.5, -2);
      c.moveTo(-3.5, -2); c.lineTo(0, 9.5); c.lineTo(3.5, -2);
      c.moveTo(-3.5, -2); c.lineTo(0, -9); c.lineTo(3.5, -2);
      c.stroke();
    },
    gift(c) {
      c.beginPath(); c.arc(0, 0, 8.6, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(0, -4.5); c.lineTo(0, 4.5); c.moveTo(-4.5, 0); c.lineTo(4.5, 0); c.stroke();
    },
    /* small glyphs used in the how-to-play legend */
    pearl(c) {
      c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill();
    },
    pause(c) { rr(c, -6, -7, 4, 14, 1.2); c.fill(); rr(c, 2, -7, 4, 14, 1.2); c.fill(); },
  },
};

/* ---------- sprite cache ---------- */
const Sprites = {
  cache: new Map(),
  scale: 2,

  reset(scale) {
    this.cache.clear();
    this.scale = clamp(Math.ceil((scale || 2) * 4) / 4, 1, 4);
  },

  /* generic cached sprite, painted in logical units */
  get(key, w, h, paint) {
    let s = this.cache.get(key);
    if (!s) {
      const k = this.scale;
      s = makeCanvas(w * k, h * k);
      const c = s.getContext('2d');
      c.scale(k, k);
      paint(c, w, h);
      this.cache.set(key, s);
    }
    return s;
  },

  /* soft additive glow blob */
  glow(color) {
    const key = 'g' + color;
    let s = this.cache.get(key);
    if (!s) {
      s = makeCanvas(128, 128);
      const c = s.getContext('2d');
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, rgba(color, 1));
      g.addColorStop(0.22, rgba(color, 0.55));
      g.addColorStop(0.55, rgba(color, 0.15));
      g.addColorStop(1, rgba(color, 0));
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
      this.cache.set(key, s);
    }
    return s;
  },

  /* soft opaque blob (ink, smoke, darkness holes) */
  blob(color) {
    const key = 'bl' + color;
    let s = this.cache.get(key);
    if (!s) {
      s = makeCanvas(128, 128);
      const c = s.getContext('2d');
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, rgba(color, 1));
      g.addColorStop(0.45, rgba(color, 0.85));
      g.addColorStop(0.8, rgba(color, 0.25));
      g.addColorStop(1, rgba(color, 0));
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
      this.cache.set(key, s);
    }
    return s;
  },

  white() {
    return this.get('white', CELL_W, CELL_H, (c) => {
      c.fillStyle = '#ffffff'; rr(c, 2, 2, CELL_W - 4, CELL_H - 4, 6); c.fill();
    });
  },

  brick(type, color, dmg, style) {
    const key = 'b|' + type + '|' + color + '|' + dmg + '|' + style;
    let s = this.cache.get(key);
    if (!s) s = this.get(key, CELL_W, CELL_H, (c) => paintBrick(c, type, color, dmg, style));
    return s;
  },

  capsule(type) {
    return this.get('cap|' + type, 52, 52, (c) => paintCapsule(c, type));
  },

  ball(kind) {
    return this.get('ball|' + kind, 24, 24, (c) => paintBall(c, kind));
  },
};

/* ---------- brick painting ---------- */
function plate(c, x, y, w, h, r, col, neon) {
  if (neon) {
    c.fillStyle = mix(col, '#050b18', 0.8); rr(c, x, y, w, h, r); c.fill();
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, rgba(col, 0.46)); g.addColorStop(0.55, rgba(col, 0.1)); g.addColorStop(1, rgba(col, 0.3));
    c.fillStyle = g; rr(c, x, y, w, h, r); c.fill();
    c.strokeStyle = col; c.lineWidth = 1.7; rr(c, x + 0.85, y + 0.85, w - 1.7, h - 1.7, r - 0.8); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.6)'; rr(c, x + 6, y + 2.6, w - 12, 1.5, 0.75); c.fill();
  } else {
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, lighten(col, 0.34)); g.addColorStop(0.42, col); g.addColorStop(1, darken(col, 0.3));
    c.fillStyle = g; rr(c, x, y, w, h, r); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.42)'; rr(c, x + 4, y + 2.4, w - 8, 3, 1.5); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.17)'; rr(c, x + 3, y + h - 5.5, w - 6, 3, 1.5); c.fill();
    c.strokeStyle = 'rgba(0,0,20,0.28)'; c.lineWidth = 1; rr(c, x + 0.5, y + 0.5, w - 1, h - 1, r); c.stroke();
  }
}

function cracks(c, dmg, neon) {
  if (dmg <= 0) return;
  const sets = [
    [[30, 3], [27, 9], [33, 14], [28, 20], [31, 27]],
    [[12, 4], [17, 11], [13, 16], [19, 26]],
    [[50, 3], [46, 10], [52, 17], [47, 27]],
    [[33, 14], [42, 12], [46, 10]],
  ];
  const n = dmg === 1 ? 1 : 4;
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    c.strokeStyle = pass === 0 ? (neon ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.35)') : (neon ? 'rgba(255,255,255,0.85)' : 'rgba(10,14,30,0.7)');
    c.lineWidth = pass === 0 ? 2.6 : 1.3;
    for (let i = 0; i < n; i++) {
      const s = sets[i];
      c.beginPath();
      for (let j = 0; j < s.length; j++) {
        const px = s[j][0] + (pass === 0 ? 0.8 : 0), py = s[j][1] + (pass === 0 ? 0.6 : 0);
        if (j) c.lineTo(px, py); else c.moveTo(px, py);
      }
      c.stroke();
    }
  }
}

function paintBrick(c, type, color, dmg, style) {
  const x = 2, y = 2, w = CELL_W - 4, h = CELL_H - 4, r = 6;
  const neon = style === 'neon';
  const cx = CELL_W / 2, cy = CELL_H / 2;
  c.lineJoin = 'round'; c.lineCap = 'round';

  switch (type) {
    case 'coral': {
      plate(c, x, y, w, h, r, color, neon);
      // coral pores / polyps
      const seed = (rgb(color)[0] * 3 + rgb(color)[1] * 5 + rgb(color)[2] * 7) | 0;
      const rnd = mulberry32(seed);
      c.fillStyle = neon ? rgba(lighten(color, 0.4), 0.7) : rgba(darken(color, 0.35), 0.4);
      for (let i = 0; i < 5; i++) {
        const px = 9 + rnd() * (w - 16), py = 10 + rnd() * (h - 16);
        c.beginPath(); c.arc(px, py, neon ? 1.1 : 1.5, 0, TAU); c.fill();
      }
      break;
    }
    case 'stone': {
      plate(c, x, y, w, h, r, color, neon);
      c.fillStyle = neon ? rgba(color, 0.12) : 'rgba(0,0,30,0.1)';
      rr(c, x + 5, y + 5, w - 10, h - 10, 3); c.fill();
      c.strokeStyle = neon ? rgba(color, 0.75) : 'rgba(255,255,255,0.4)'; c.lineWidth = 1.2;
      rr(c, x + 5, y + 5, w - 10, h - 10, 3); c.stroke();
      cracks(c, dmg, neon);
      break;
    }
    case 'basalt': {
      plate(c, x, y, w, h, r, color, neon);
      c.fillStyle = neon ? rgba(color, 0.14) : 'rgba(0,0,30,0.16)';
      rr(c, x + 5, y + 5, w - 10, h - 10, 3); c.fill();
      c.strokeStyle = neon ? rgba(color, 0.8) : 'rgba(255,255,255,0.4)'; c.lineWidth = 1.2;
      rr(c, x + 5, y + 5, w - 10, h - 10, 3); c.stroke();
      // reinforcing bars
      c.strokeStyle = neon ? rgba(color, 0.8) : 'rgba(255,255,255,0.4)'; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(x + w / 3, y + 5); c.lineTo(x + w / 3, y + h - 5);
      c.moveTo(x + 2 * w / 3, y + 5); c.lineTo(x + 2 * w / 3, y + h - 5);
      c.stroke();
      cracks(c, dmg, neon);
      break;
    }
    case 'steel': {
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#e3ebf2'); g.addColorStop(0.3, '#94a3b3'); g.addColorStop(0.62, '#56626f'); g.addColorStop(1, '#8b98a6');
      c.fillStyle = g; rr(c, x, y, w, h, 4); c.fill();
      c.strokeStyle = '#1c2530'; c.lineWidth = 1.4; rr(c, x + 0.7, y + 0.7, w - 1.4, h - 1.4, 4); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
      rr(c, x + 6.5, y + 6.5, w - 13, h - 13, 2); c.stroke();
      const rv = [[x + 5.5, y + 5.5], [x + w - 5.5, y + 5.5], [x + 5.5, y + h - 5.5], [x + w - 5.5, y + h - 5.5]];
      for (let i = 0; i < 4; i++) {
        c.fillStyle = '#28323e'; c.beginPath(); c.arc(rv[i][0], rv[i][1], 2, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(rv[i][0] - 0.5, rv[i][1] - 0.6, 0.8, 0, TAU); c.fill();
      }
      break;
    }
    case 'mine': {
      c.fillStyle = '#231018'; rr(c, x, y, w, h, r); c.fill();
      const g0 = c.createLinearGradient(0, y, 0, y + h);
      g0.addColorStop(0, 'rgba(255,90,90,0.35)'); g0.addColorStop(1, 'rgba(255,90,90,0.08)');
      c.fillStyle = g0; rr(c, x, y, w, h, r); c.fill();
      c.strokeStyle = '#ff5a5a'; c.lineWidth = 1.7; rr(c, x + 0.85, y + 0.85, w - 1.7, h - 1.7, r - 0.8); c.stroke();
      // hazard chevrons
      c.strokeStyle = 'rgba(255,120,120,0.75)'; c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(13, cy - 5); c.lineTo(8.5, cy); c.lineTo(13, cy + 5);
      c.moveTo(CELL_W - 13, cy - 5); c.lineTo(CELL_W - 8.5, cy); c.lineTo(CELL_W - 13, cy + 5);
      c.stroke();
      // spiked sphere
      c.strokeStyle = '#ff8a8a'; c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + 0.2;
        c.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); c.lineTo(cx + Math.cos(a) * 10.5, cy + Math.sin(a) * 10.5);
      }
      c.stroke();
      const g = c.createRadialGradient(cx - 2, cy - 2, 0.5, cx, cy, 7.5);
      g.addColorStop(0, '#ffd0d0'); g.addColorStop(0.4, '#e03a44'); g.addColorStop(1, '#5a0d14');
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 7, 0, TAU); c.fill();
      break;
    }
    case 'eel': {
      c.fillStyle = '#0a222c'; rr(c, x, y, w, h, r); c.fill();
      c.strokeStyle = '#ffe45c'; c.lineWidth = 1.7; rr(c, x + 0.85, y + 0.85, w - 1.7, h - 1.7, r - 0.8); c.stroke();
      c.save();
      c.shadowColor = '#ffe45c'; c.shadowBlur = 6 * Sprites.scale;
      c.strokeStyle = '#fffbd0'; c.lineWidth = 2.3;
      c.beginPath();
      c.moveTo(9, 16); c.lineTo(18, 8.5); c.lineTo(26, 19.5); c.lineTo(36, 9); c.lineTo(46, 20.5); c.lineTo(55, 12.5);
      c.stroke();
      c.restore();
      break;
    }
    case 'oyster': {
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#efe2ff'); g.addColorStop(1, '#b3c8ff');
      c.fillStyle = g; rr(c, x, y, w, h, r); c.fill();
      c.strokeStyle = 'rgba(120,110,200,0.55)'; c.lineWidth = 1; rr(c, x + 0.5, y + 0.5, w - 1, h - 1, r); c.stroke();
      // shell ridges
      c.strokeStyle = 'rgba(140,120,210,0.4)'; c.lineWidth = 1.1;
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        c.beginPath(); c.moveTo(cx + i * 4.5, cy + 9); c.quadraticCurveTo(cx + i * 10, cy, cx + i * 12, cy - 9); c.stroke();
      }
      // the pearl
      const pg = c.createRadialGradient(cx - 2.2, cy - 2.4, 0.6, cx, cy, 7.4);
      pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.5, '#ffe3f2'); pg.addColorStop(1, '#b7a6f5');
      c.fillStyle = pg; c.beginPath(); c.arc(cx, cy, 7, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(110,90,190,0.6)'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, 7, 0, TAU); c.stroke();
      break;
    }
    case 'gold': {
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#fff6c0'); g.addColorStop(0.45, '#ffc94a'); g.addColorStop(1, '#b3721a');
      c.fillStyle = g; rr(c, x, y, w, h, r); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.55)'; rr(c, x + 4, y + 2.4, w - 8, 3, 1.5); c.fill();
      c.strokeStyle = 'rgba(110,60,0,0.55)'; c.lineWidth = 1; rr(c, x + 0.5, y + 0.5, w - 1, h - 1, r); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.1; rr(c, x + 5, y + 5, w - 10, h - 10, 3); c.stroke();
      // sparkles
      const sp = (px, py, s) => {
        c.fillStyle = '#ffffff'; c.beginPath();
        c.moveTo(px, py - s); c.quadraticCurveTo(px, py, px + s, py); c.quadraticCurveTo(px, py, px, py + s);
        c.quadraticCurveTo(px, py, px - s, py); c.quadraticCurveTo(px, py, px, py - s); c.fill();
      };
      sp(cx, cy, 7); sp(cx - 15, cy + 3, 3.4); sp(cx + 14, cy - 3, 3.8);
      break;
    }
    case 'phantom': {
      c.fillStyle = rgba(color, 0.16); rr(c, x, y, w, h, r); c.fill();
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, rgba(color, 0.35)); g.addColorStop(1, rgba(color, 0.02));
      c.fillStyle = g; rr(c, x, y, w, h, r); c.fill();
      c.setLineDash([5, 4]);
      c.strokeStyle = color; c.lineWidth = 1.6; rr(c, x + 0.85, y + 0.85, w - 1.7, h - 1.7, r - 0.8); c.stroke();
      c.setLineDash([]);
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath(); c.arc(cx - 6, cy, 2.1, 0, TAU); c.fill();
      c.beginPath(); c.arc(cx + 6, cy, 2.1, 0, TAU); c.fill();
      break;
    }
    case 'ink': {
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#4a2f8f'); g.addColorStop(0.5, '#1f123f'); g.addColorStop(1, '#0c0620');
      c.fillStyle = g; rr(c, x, y, w, h, r); c.fill();
      c.strokeStyle = '#8a5cff'; c.lineWidth = 1.7; rr(c, x + 0.85, y + 0.85, w - 1.7, h - 1.7, r - 0.8); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.35)'; rr(c, x + 6, y + 2.6, w - 12, 1.6, 0.8); c.fill();
      // an eye
      c.fillStyle = '#e9deff'; c.beginPath(); c.ellipse(cx, cy, 9, 6, 0, 0, TAU); c.fill();
      c.fillStyle = '#12071f'; c.beginPath(); c.ellipse(cx, cy, 2.4, 5, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(cx - 3.4, cy - 2, 1.2, 0, TAU); c.fill();
      break;
    }
    case 'hot': {
      const lit = dmg > 0;
      const g = c.createLinearGradient(0, y, 0, y + h);
      if (lit) { g.addColorStop(0, '#7a2408'); g.addColorStop(1, '#3a0f04'); }
      else { g.addColorStop(0, '#2a1a16'); g.addColorStop(1, '#140b09'); }
      c.fillStyle = g; rr(c, x, y, w, h, r); c.fill();
      c.strokeStyle = lit ? '#ffd27a' : '#ff7b2e'; c.lineWidth = 1.7; rr(c, x + 0.85, y + 0.85, w - 1.7, h - 1.7, r - 0.8); c.stroke();
      c.save();
      c.shadowColor = '#ff6a00'; c.shadowBlur = (lit ? 9 : 5) * Sprites.scale;
      c.strokeStyle = lit ? '#fff3c4' : '#ffb347'; c.lineWidth = lit ? 2.6 : 1.9;
      c.beginPath();
      c.moveTo(7, 12); c.lineTo(16, 17); c.lineTo(23, 9); c.lineTo(31, 19); c.lineTo(38, 11); c.lineTo(47, 20); c.lineTo(57, 13);
      c.moveTo(23, 9); c.lineTo(21, 4.5);
      c.moveTo(38, 11); c.lineTo(41, 5);
      c.moveTo(31, 19); c.lineTo(30, 25);
      c.stroke();
      c.restore();
      break;
    }
    default:
      plate(c, x, y, w, h, r, color || '#888888', neon);
  }
}

/* ---------- capsule (bubble with an icon; urchins are the bad ones) ---------- */
function paintCapsule(c, type) {
  const P = POWERUPS[type];
  const cx = 26, cy = 26, R = 16;
  if (P.good) {
    const g = c.createRadialGradient(cx - 4, cy - 5, 1, cx, cy, R);
    g.addColorStop(0, rgba(lighten(P.color, 0.5), 0.75));
    g.addColorStop(0.6, rgba(P.color, 0.5));
    g.addColorStop(1, rgba(darken(P.color, 0.3), 0.55));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    c.strokeStyle = lighten(P.color, 0.35); c.lineWidth = 1.8; c.beginPath(); c.arc(cx, cy, R - 0.9, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath(); c.arc(cx, cy, R - 4.2, Math.PI * 1.08, Math.PI * 1.42); c.stroke();
    c.save(); c.translate(cx, cy);
    c.shadowColor = 'rgba(0,20,40,0.55)'; c.shadowBlur = 3 * Sprites.scale;
    Icons.draw(c, type, 20, '#ffffff');
    c.restore();
  } else {
    // sea urchin
    c.fillStyle = '#5c0c1c'; c.strokeStyle = '#ff6b7a'; c.lineWidth = 1.2; c.lineJoin = 'round';
    c.beginPath();
    const n = 14;
    for (let i = 0; i < n * 2; i++) {
      const a = i * Math.PI / n, r = i % 2 ? 12.5 : 22;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath(); c.fill(); c.stroke();
    const g = c.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, 13.5);
    g.addColorStop(0, '#ff9aa5'); g.addColorStop(0.55, '#e02a44'); g.addColorStop(1, '#7a0f22');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 13.5, 0, TAU); c.fill();
    c.save(); c.translate(cx, cy);
    Icons.draw(c, type, 17, '#ffffff');
    c.restore();
  }
}

/* ---------- the pearl ---------- */
function paintBall(c, kind) {
  const cx = 12, cy = 12, R = BALL_R;
  let c0 = '#ffffff', c1 = '#eaf8ff', c2 = '#9cc9ea', rim = 'rgba(255,190,225,0.55)';
  if (kind === 'magma') { c0 = '#fffbe0'; c1 = '#ffc861'; c2 = '#ff5a1f'; rim = 'rgba(255,240,170,0.6)'; }
  else if (kind === 'charged') { c0 = '#ffffff'; c1 = '#c9fdff'; c2 = '#38d6ff'; rim = 'rgba(255,255,255,0.7)'; }
  else if (kind === 'ghost') { c0 = '#ffffff'; c1 = '#e3d7ff'; c2 = '#a68cff'; rim = 'rgba(255,255,255,0.5)'; }
  const g = c.createRadialGradient(cx - 2.6, cy - 2.8, 0.6, cx, cy, R);
  g.addColorStop(0, c0); g.addColorStop(0.45, c1); g.addColorStop(1, c2);
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
  c.strokeStyle = rim; c.lineWidth = 1.2;
  c.beginPath(); c.arc(cx, cy, R - 0.8, 0.15 * Math.PI, 0.75 * Math.PI); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.beginPath(); c.ellipse(cx - 2.8, cy - 3, 2, 1.3, -0.6, 0, TAU); c.fill();
}
