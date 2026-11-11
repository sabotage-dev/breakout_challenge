/* Lanternwake — procedural art: sprites, icons and painted backdrops */
(function () {
  'use strict';
  const LW = window.LW, U = LW.U, C = LW.C;
  const TAU = U.TAU, hsl = U.hsl;
  const Art = (LW.Art = {});

  const SPR = 3;         // sprite supersampling
  const PAD = 8;         // logical padding around brick sprites
  Art.PAD = PAD;
  const cache = {};

  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * SPR); c.height = Math.ceil(h * SPR);
    const g = c.getContext('2d');
    g.scale(SPR, SPR);
    return [c, g];
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  Art.rr = rr;

  /* ------------------------------------------------------------ glow ---- */
  const glowCache = {};
  Art.glow = function (rgb, hot) {
    const key = rgb[0] + ',' + rgb[1] + ',' + rgb[2] + (hot ? 'h' : 's');
    let c = glowCache[key];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    const col = (a) => 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
    if (hot) {
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.12, 'rgba(255,255,255,0.85)');
      gr.addColorStop(0.3, col(0.55));
      gr.addColorStop(0.62, col(0.14));
      gr.addColorStop(1, col(0));
    } else {
      gr.addColorStop(0, col(0.85));
      gr.addColorStop(0.28, col(0.42));
      gr.addColorStop(0.62, col(0.11));
      gr.addColorStop(1, col(0));
    }
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    glowCache[key] = c;
    return c;
  };
  Art.drawGlow = function (g, rgb, x, y, radius, alpha, hot) {
    if (alpha <= 0.003 || radius <= 0) return;
    g.globalAlpha = alpha > 1 ? 1 : alpha;
    g.drawImage(Art.glow(rgb, hot), x - radius, y - radius, radius * 2, radius * 2);
  };

  /* --------------------------------------------------- lantern sprites ---- */
  const SW = C.BW + PAD * 2, SH = C.BH + PAD * 2 + 6;

  function cap(g, x, y, w, h) {
    rr(g, x, y, w, h, 1.6);
    g.fillStyle = '#1b110b';
    g.fill();
    g.fillStyle = 'rgba(232,180,92,0.75)';
    g.fillRect(x + 1.5, y + 0.8, w - 3, 1);
  }

  function paperLantern(key, lit) {
    const col = LW.COLORS[key] || LW.COLORS.r;
    const hu = col.h, sa = col.s;
    const [c, g] = mk(SW, SH);
    g.translate(PAD, PAD);
    const w = C.BW, h = C.BH;

    // tassel
    g.strokeStyle = lit ? 'rgba(255,214,140,0.85)' : 'rgba(150,140,130,0.5)';
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(w / 2, h - 2); g.lineTo(w / 2, h + 4.5); g.stroke();
    g.fillStyle = lit ? '#e9b24c' : '#6a5a4a';
    g.beginPath(); g.arc(w / 2, h + 4.5, 1.8, 0, TAU); g.fill();

    rr(g, 1, 3, w - 2, h - 6, 13);
    let gr;
    if (lit) {
      gr = g.createRadialGradient(w / 2, h * 0.56, 1, w / 2, h / 2, w * 0.6);
      if (col.pale) {
        gr.addColorStop(0, hsl(48, 100, 97));
        gr.addColorStop(0.35, hsl(44, 62, 85));
        gr.addColorStop(1, hsl(34, 36, 58));
      } else {
        gr.addColorStop(0, hsl(hu + 16, 100, 89));
        gr.addColorStop(0.3, hsl(hu + 4, sa, 63));
        gr.addColorStop(1, hsl(hu - 6, sa, 35));
      }
    } else {
      gr = g.createLinearGradient(0, 3, 0, h - 3);
      gr.addColorStop(0, hsl(hu, sa * 0.42, col.pale ? 26 : 20));
      gr.addColorStop(1, hsl(hu, sa * 0.5, col.pale ? 13 : 9));
    }
    g.fillStyle = gr;
    g.fill();

    g.save();
    g.clip();
    g.strokeStyle = lit ? 'rgba(70,14,0,0.2)' : 'rgba(255,255,255,0.075)';
    g.lineWidth = 0.9;
    for (let i = 1; i < 5; i++) {
      const y = 3 + (i * (h - 6)) / 5;
      g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(w / 2, y + 2.2, w, y); g.stroke();
    }
    const sh = g.createLinearGradient(0, 0, w, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.36)');
    sh.addColorStop(0.28, 'rgba(0,0,0,0)');
    sh.addColorStop(0.72, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.36)');
    g.fillStyle = sh;
    g.fillRect(0, 0, w, h);
    g.fillStyle = lit ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.07)';
    g.beginPath(); g.ellipse(15, 11, 8, 3.4, -0.35, 0, TAU); g.fill();
    if (!lit) {
      const e = g.createRadialGradient(w / 2, h * 0.58, 0, w / 2, h * 0.58, 10);
      e.addColorStop(0, hsl(hu, sa, 58, 0.55));
      e.addColorStop(1, hsl(hu, sa, 50, 0));
      g.fillStyle = e;
      g.fillRect(0, 0, w, h);
    }
    g.restore();

    rr(g, 1, 3, w - 2, h - 6, 13);
    g.lineWidth = 1.1;
    g.strokeStyle = lit ? hsl(hu + 8, 100, col.pale ? 95 : 82, 0.62) : hsl(hu, sa * 0.75, 52, 0.75);
    g.stroke();

    cap(g, w / 2 - 9, 0.5, 18, 4.5);
    cap(g, w / 2 - 9, h - 5, 18, 4.5);
    return c;
  }

  function goldLantern() {
    const [c, g] = mk(SW, SH);
    g.translate(PAD, PAD);
    const w = C.BW, h = C.BH;
    g.strokeStyle = 'rgba(255,90,70,0.9)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(w / 2, h - 2); g.lineTo(w / 2, h + 4.5); g.stroke();
    g.fillStyle = '#ff5a46';
    g.beginPath(); g.arc(w / 2, h + 4.5, 2, 0, TAU); g.fill();

    rr(g, 1, 3, w - 2, h - 6, 13);
    const gr = g.createLinearGradient(0, 3, 0, h - 3);
    gr.addColorStop(0, '#fff6c8');
    gr.addColorStop(0.3, '#ffd65a');
    gr.addColorStop(0.62, '#d9951c');
    gr.addColorStop(0.82, '#ffcf55');
    gr.addColorStop(1, '#a8650c');
    g.fillStyle = gr;
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(110,52,0,0.3)'; g.lineWidth = 0.8;
    for (let i = -6; i < 12; i++) {
      g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8 + h, h); g.stroke();
      g.beginPath(); g.moveTo(i * 8 + h, 0); g.lineTo(i * 8, h); g.stroke();
    }
    const core = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 17);
    core.addColorStop(0, 'rgba(255,255,236,0.95)');
    core.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = core; g.fillRect(0, 0, w, h);
    const sh = g.createLinearGradient(0, 0, w, 0);
    sh.addColorStop(0, 'rgba(70,30,0,0.4)'); sh.addColorStop(0.3, 'rgba(0,0,0,0)');
    sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(70,30,0,0.4)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    g.restore();
    rr(g, 1, 3, w - 2, h - 6, 13);
    g.lineWidth = 1.3; g.strokeStyle = 'rgba(255,250,210,0.9)'; g.stroke();

    const capG = (x, y) => {
      rr(g, x, y, 18, 4.5, 1.6); g.fillStyle = '#7a1410'; g.fill();
      g.fillStyle = 'rgba(255,210,120,0.9)'; g.fillRect(x + 1.5, y + 0.8, 15, 1);
    };
    capG(w / 2 - 9, 0.5); capG(w / 2 - 9, h - 5);
    return c;
  }

  function stoneLantern(hp) {
    const [c, g] = mk(SW, SH);
    g.translate(PAD, PAD);
    const w = C.BW, h = C.BH;
    const rnd = U.rng(31 + hp);
    // base slab
    rr(g, 5, h - 7, w - 10, 7, 2);
    g.fillStyle = '#3b404c'; g.fill();
    // body
    rr(g, 7, 8, w - 14, h - 13, 3);
    let gr = g.createLinearGradient(0, 8, 0, h - 5);
    gr.addColorStop(0, '#8b92a2'); gr.addColorStop(1, '#4b5160');
    g.fillStyle = gr; g.fill();
    // roof
    g.beginPath();
    g.moveTo(0, 11); g.lineTo(w, 11); g.lineTo(w - 3, 8);
    g.quadraticCurveTo(w - 12, 6, w - 17, 1.5);
    g.lineTo(17, 1.5);
    g.quadraticCurveTo(12, 6, 3, 8);
    g.closePath();
    gr = g.createLinearGradient(0, 1, 0, 11);
    gr.addColorStop(0, '#9ea5b5'); gr.addColorStop(1, '#565c6b');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(210,220,240,0.5)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(17, 1.8); g.lineTo(w - 17, 1.8); g.stroke();
    // speckle
    for (let i = 0; i < 46; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
      g.fillRect(2 + rnd() * (w - 4), 2 + rnd() * (h - 4), 1, 1);
    }
    // moss
    g.fillStyle = 'rgba(96,140,84,0.4)';
    g.beginPath(); g.ellipse(9, 9, 6, 2, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(w - 9, h - 7, 5, 1.6, 0, 0, TAU); g.fill();
    // window
    rr(g, w / 2 - 7.5, 14, 15, 13, 3);
    gr = g.createRadialGradient(w / 2, 21, 0, w / 2, 21, 10);
    if (hp >= 3) { gr.addColorStop(0, '#fff3c4'); gr.addColorStop(1, '#ff9d3a'); }
    else if (hp === 2) { gr.addColorStop(0, '#ffe2a0'); gr.addColorStop(1, '#e0762a'); }
    else { gr.addColorStop(0, '#ffb86a'); gr.addColorStop(1, '#8a3a1c'); }
    g.fillStyle = gr; g.fill();
    g.strokeStyle = '#2a2e38'; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w / 2, 27); g.stroke();
    // cracks
    g.strokeStyle = 'rgba(14,16,22,0.85)'; g.lineWidth = 1.1; g.lineJoin = 'round';
    if (hp <= 2) {
      g.beginPath(); g.moveTo(11, 9); g.lineTo(15, 16); g.lineTo(12, 22); g.lineTo(16, 30); g.stroke();
    }
    if (hp <= 1) {
      g.beginPath(); g.moveTo(w - 9, 10); g.lineTo(w - 14, 17); g.lineTo(w - 10, 24); g.lineTo(w - 15, 31); g.stroke();
      g.beginPath(); g.moveTo(15, 16); g.lineTo(20, 13); g.stroke();
      g.beginPath(); g.moveTo(w - 14, 17); g.lineTo(w - 19, 29); g.stroke();
    }
    return c;
  }

  function bellSprite() {
    const [c, g] = mk(SW, SH);
    g.translate(PAD, PAD);
    const w = C.BW, m = w / 2;
    // hanger
    g.strokeStyle = '#8a5c1c'; g.lineWidth = 2;
    g.beginPath(); g.arc(m, 3.5, 3, 0, TAU); g.stroke();
    g.beginPath();
    g.moveTo(m - 11, 14);
    g.quadraticCurveTo(m - 11, 5.5, m, 5.5);
    g.quadraticCurveTo(m + 11, 5.5, m + 11, 14);
    g.lineTo(m + 13.5, 27);
    g.quadraticCurveTo(m + 15, 32, m + 20, 33.5);
    g.lineTo(m + 20, 36);
    g.lineTo(m - 20, 36);
    g.lineTo(m - 20, 33.5);
    g.quadraticCurveTo(m - 15, 32, m - 13.5, 27);
    g.closePath();
    const gr = g.createLinearGradient(m - 20, 0, m + 20, 0);
    gr.addColorStop(0, '#5a3408');
    gr.addColorStop(0.3, '#c98d2c');
    gr.addColorStop(0.44, '#fff0b4');
    gr.addColorStop(0.62, '#c08424');
    gr.addColorStop(1, '#4a2a06');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(40,20,0,0.7)'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(60,30,0,0.45)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(m - 11.5, 15); g.lineTo(m + 11.5, 15); g.stroke();
    g.beginPath(); g.moveTo(m - 13.5, 27); g.lineTo(m + 13.5, 27); g.stroke();
    g.strokeStyle = 'rgba(255,240,190,0.5)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(m - 19, 34); g.lineTo(m + 19, 34); g.stroke();
    // clapper
    g.fillStyle = '#7a4c12';
    g.beginPath(); g.arc(m, 38.5, 3, 0, TAU); g.fill();
    return c;
  }

  function crackerSprite() {
    const [c, g] = mk(SW, SH);
    g.translate(PAD, PAD);
    const w = C.BW;
    // fuses
    g.strokeStyle = '#d8c8a8'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const x = 8 + i * 9.4 + 4.2;
      g.beginPath(); g.moveTo(x, 8); g.quadraticCurveTo(x, 3, w / 2, 1.5); g.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const x = 8 + i * 9.4;
      rr(g, x, 7, 8.4, 28, 2.2);
      const gr = g.createLinearGradient(x, 0, x + 8.4, 0);
      gr.addColorStop(0, '#6a0a0a'); gr.addColorStop(0.45, '#ec3e2c'); gr.addColorStop(1, '#5c0808');
      g.fillStyle = gr; g.fill();
      g.fillStyle = '#f4c552';
      g.fillRect(x, 9.5, 8.4, 2.4);
      g.fillRect(x, 30, 8.4, 2.4);
    }
    rr(g, 5.5, 18.5, w - 11, 4.6, 2);
    g.fillStyle = '#f4c552'; g.fill();
    g.strokeStyle = 'rgba(90,40,0,0.7)'; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = '#7a1410';
    g.beginPath(); g.arc(w / 2, 20.8, 3, 0, TAU); g.fill();
    return c;
  }

  Art.brickSprite = function (type, color, hp) {
    let key;
    if (type === 'paper') key = 'p' + color + '1';
    else if (type === 'dark') key = 'p' + color + (hp >= 2 ? '0' : '1');
    else if (type === 'stone') key = 's' + Math.max(1, Math.min(3, hp));
    else key = type;
    let s = cache[key];
    if (s) return s;
    if (type === 'paper') s = paperLantern(color, true);
    else if (type === 'dark') s = paperLantern(color, hp < 2);
    else if (type === 'stone') s = stoneLantern(Math.max(1, Math.min(3, hp)));
    else if (type === 'bell') s = bellSprite();
    else if (type === 'cracker') s = crackerSprite();
    else if (type === 'gold') s = goldLantern();
    else s = paperLantern('r', true);
    cache[key] = s;
    return s;
  };
  Art.SW = SW; Art.SH = SH;

  /* ------------------------------------------------------------ icons ---- */
  // Each icon draws in a unit box (-1..1) using the current stroke/fill colour.
  function flame(g, cx, cy, s) {
    g.beginPath();
    g.moveTo(cx, cy - 0.95 * s);
    g.bezierCurveTo(cx + 0.18 * s, cy - 0.45 * s, cx + 0.66 * s, cy - 0.2 * s, cx + 0.58 * s, cy + 0.32 * s);
    g.bezierCurveTo(cx + 0.52 * s, cy + 0.76 * s, cx + 0.2 * s, cy + 0.92 * s, cx, cy + 0.92 * s);
    g.bezierCurveTo(cx - 0.2 * s, cy + 0.92 * s, cx - 0.52 * s, cy + 0.76 * s, cx - 0.58 * s, cy + 0.32 * s);
    g.bezierCurveTo(cx - 0.62 * s, cy - 0.02 * s, cx - 0.34 * s, cy - 0.16 * s, cx - 0.3 * s, cy - 0.48 * s);
    g.bezierCurveTo(cx - 0.12 * s, cy - 0.3 * s, cx - 0.1 * s, cy - 0.7 * s, cx, cy - 0.95 * s);
    g.closePath();
  }
  Art.flamePath = flame;
  const dot = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  const ln = (g, a, b, c2, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); };

  const ICONS = {
    split(g) {
      ln(g, 0, 0.6, -0.55, -0.3); ln(g, 0, 0.6, 0, -0.42); ln(g, 0, 0.6, 0.55, -0.3);
      dot(g, 0, 0.62, 0.17); dot(g, -0.62, -0.42, 0.2); dot(g, 0, -0.6, 0.2); dot(g, 0.62, -0.42, 0.2);
    },
    wide(g) {
      ln(g, -0.85, 0, 0.85, 0);
      g.beginPath(); g.moveTo(-0.5, -0.36); g.lineTo(-0.88, 0); g.lineTo(-0.5, 0.36); g.stroke();
      g.beginPath(); g.moveTo(0.5, -0.36); g.lineTo(0.88, 0); g.lineTo(0.5, 0.36); g.stroke();
    },
    blaze(g) { flame(g, 0, 0, 0.9); g.fill(); },
    slow(g) {
      for (let i = -1; i <= 1; i++) {
        const y = i * 0.5;
        g.beginPath(); g.moveTo(-0.8, y);
        g.bezierCurveTo(-0.45, y - 0.36, -0.2, y + 0.36, 0, y);
        g.bezierCurveTo(0.2, y - 0.36, 0.45, y + 0.36, 0.8, y);
        g.stroke();
      }
    },
    catch(g) {
      g.beginPath(); g.arc(0.12, -0.72, 0.13, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(0.12, -0.58); g.lineTo(0.12, 0.3);
      g.arc(-0.22, 0.3, 0.34, 0, Math.PI); g.lineTo(-0.56, 0.02); g.stroke();
      g.beginPath(); g.moveTo(-0.56, 0.02); g.lineTo(-0.3, 0.14); g.stroke();
    },
    rockets(g) {
      g.save(); g.rotate(0.7);
      g.beginPath(); g.moveTo(0, -0.9); g.lineTo(0.26, -0.45); g.lineTo(0.26, 0.2); g.lineTo(-0.26, 0.2); g.lineTo(-0.26, -0.45); g.closePath(); g.fill();
      ln(g, 0, 0.2, 0, 0.85);
      g.restore();
      dot(g, -0.62, 0.3, 0.09); dot(g, -0.4, 0.68, 0.08); dot(g, -0.78, 0.66, 0.07);
    },
    bridge(g) {
      const petal = (a, l) => {
        g.save(); g.rotate(a);
        g.beginPath(); g.moveTo(0, 0.5); g.quadraticCurveTo(-0.34 * l, -0.1, 0, -0.78 * l); g.quadraticCurveTo(0.34 * l, -0.1, 0, 0.5); g.fill();
        g.restore();
      };
      g.save(); g.translate(0, 0.1);
      const ga = g.globalAlpha;
      g.globalAlpha = ga * 0.6; petal(-1.05, 0.95); petal(1.05, 0.95);
      g.globalAlpha = ga * 0.8; petal(-0.52, 1); petal(0.52, 1);
      g.globalAlpha = ga; petal(0, 1.05);
      g.restore();
      g.beginPath(); g.moveTo(-0.85, 0.7); g.quadraticCurveTo(0, 0.95, 0.85, 0.7); g.stroke();
    },
    swarm(g) {
      dot(g, -0.42, -0.34, 0.2); dot(g, 0.46, -0.08, 0.16); dot(g, -0.1, 0.52, 0.18);
      const ga = g.globalAlpha; g.globalAlpha = ga * 0.35;
      dot(g, -0.42, -0.34, 0.4); dot(g, 0.46, -0.08, 0.33); dot(g, -0.1, 0.52, 0.36);
      g.globalAlpha = ga;
    },
    life(g) {
      flame(g, -0.12, 0.08, 0.78); g.fill();
      ln(g, 0.62, -0.78, 0.62, -0.3); ln(g, 0.38, -0.54, 0.86, -0.54);
    },
    gale(g) {
      g.beginPath(); g.moveTo(-0.85, -0.3); g.lineTo(0.3, -0.3); g.arc(0.3, -0.56, 0.26, Math.PI / 2, -Math.PI * 0.9, true); g.stroke();
      g.beginPath(); g.moveTo(-0.85, 0.12); g.lineTo(0.6, 0.12); g.stroke();
      g.beginPath(); g.moveTo(-0.6, 0.5); g.lineTo(0.2, 0.5); g.arc(0.2, 0.72, 0.22, -Math.PI / 2, Math.PI * 0.8); g.stroke();
    },
    shrink(g) {
      ln(g, -0.9, 0, -0.25, 0); ln(g, 0.9, 0, 0.25, 0);
      g.beginPath(); g.moveTo(-0.56, -0.32); g.lineTo(-0.22, 0); g.lineTo(-0.56, 0.32); g.stroke();
      g.beginPath(); g.moveTo(0.56, -0.32); g.lineTo(0.22, 0); g.lineTo(0.56, 0.32); g.stroke();
    },
    oar(g) {
      g.save(); g.rotate(-0.78);
      ln(g, 0, -0.9, 0, 0.3);
      g.beginPath(); g.ellipse(0, 0.6, 0.22, 0.38, 0, 0, TAU); g.fill();
      ln(g, -0.16, -0.9, 0.16, -0.9);
      g.restore();
    },
    twin(g) {
      flame(g, -0.4, 0.05, 0.66); g.fill();
      flame(g, 0.4, 0.05, 0.66); g.fill();
    },
    cracker(g) {
      g.save(); g.rotate(0.5);
      rrU(g, -0.26, -0.5, 0.52, 1.25, 0.1); g.fill();
      g.beginPath(); g.moveTo(0, -0.5); g.quadraticCurveTo(0.1, -0.8, 0.36, -0.86); g.stroke();
      g.restore();
      dot(g, 0.7, -0.62, 0.09); ln(g, 0.52, -0.9, 0.58, -0.78); ln(g, 0.92, -0.74, 0.8, -0.7);
    },
    fortune(g) {
      for (let i = 0; i < 4; i++) {
        g.save(); g.rotate(i * Math.PI / 2 + Math.PI / 4);
        g.beginPath(); g.moveTo(0, 0);
        g.bezierCurveTo(-0.5, -0.3, -0.42, -0.86, 0, -0.62);
        g.bezierCurveTo(0.42, -0.86, 0.5, -0.3, 0, 0);
        g.fill(); g.restore();
      }
      g.beginPath(); g.moveTo(0.05, 0.1); g.quadraticCurveTo(0.2, 0.6, 0.5, 0.86); g.stroke();
    },
    flare(g) {
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU - Math.PI / 2, r = i % 2 ? 0.26 : (i % 4 === 0 ? 0.95 : 0.6);
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath(); g.fill();
    },
    incense(g) {
      ln(g, -0.5, 0.86, 0.1, -0.1);
      g.beginPath(); g.moveTo(0.1, -0.16);
      g.bezierCurveTo(0.5, -0.36, -0.2, -0.54, 0.2, -0.72);
      g.bezierCurveTo(0.44, -0.82, 0.3, -0.94, 0.42, -0.98);
      g.stroke();
      dot(g, 0.1, -0.1, 0.1);
    },
    coin(g) {
      g.beginPath(); g.arc(0, 0, 0.78, 0, TAU); g.stroke();
      g.strokeRect(-0.24, -0.24, 0.48, 0.48);
    },
    chain(g) {
      g.beginPath(); g.arc(0.05, 0, 0.78, 0.5, TAU - 0.5); g.stroke();
      g.beginPath(); g.arc(0.5, 0, 0.6, 2.25, TAU - 2.25); g.stroke();
      dot(g, -0.3, -0.05, 0.1);
    },
    clap(g) {
      g.beginPath(); g.moveTo(0.14, -0.9); g.lineTo(-0.3, 0.06); g.lineTo(0.06, 0.06); g.lineTo(-0.14, 0.9); g.lineTo(0.36, -0.14); g.lineTo(0, -0.14); g.closePath(); g.fill();
      g.beginPath(); g.arc(0, 0, 0.9, -0.5, 0.5); g.stroke();
      g.beginPath(); g.arc(0, 0, 0.9, Math.PI - 0.5, Math.PI + 0.5); g.stroke();
    },
    jar(g) {
      g.beginPath();
      g.moveTo(-0.34, -0.9); g.lineTo(0.34, -0.9); g.lineTo(0.34, -0.66);
      g.quadraticCurveTo(0.66, -0.5, 0.66, -0.1); g.lineTo(0.66, 0.62);
      g.quadraticCurveTo(0.66, 0.9, 0.38, 0.9); g.lineTo(-0.38, 0.9);
      g.quadraticCurveTo(-0.66, 0.9, -0.66, 0.62); g.lineTo(-0.66, -0.1);
      g.quadraticCurveTo(-0.66, -0.5, -0.34, -0.66); g.closePath();
      g.stroke();
      ln(g, -0.34, -0.66, 0.34, -0.66);
    },
    spark(g) { flame(g, 0, 0, 0.92); g.fill(); },
    stun(g) {
      g.beginPath(); g.moveTo(0.2, -0.9); g.lineTo(-0.4, 0.1); g.lineTo(0.05, 0.1); g.lineTo(-0.2, 0.9); g.lineTo(0.45, -0.15); g.lineTo(0, -0.15); g.closePath(); g.fill();
    },
  };
  function rrU(g, x, y, w, h, r) { rr(g, x, y, w, h, r); }

  Art.icon = function (g, name, x, y, size, color) {
    const fn = ICONS[name];
    if (!fn) return;
    g.save();
    g.translate(x, y);
    g.scale(size / 2, size / 2);
    g.lineWidth = 0.14;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = color; g.fillStyle = color;
    fn(g);
    g.restore();
  };
  Art.iconCanvas = function (name, px, color) {
    const c = document.createElement('canvas');
    const d = Math.min(3, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(px * d);
    c.style.width = c.style.height = px + 'px';
    const g = c.getContext('2d');
    g.scale(d, d);
    Art.icon(g, name, px / 2, px / 2, px * 0.82, color);
    return c;
  };

  /* ----------------------------------------------------------- charms ---- */
  const CW = 40, CH = 50, CP = 6;
  Art.charmSize = { w: CW, h: CH, pad: CP };
  Art.charmSprite = function (kind) {
    const key = 'charm:' + kind;
    if (cache[key]) return cache[key];
    const def = LW.CHARMS[kind];
    const [c, g] = mk(CW + CP * 2, CH + CP * 2);
    g.translate(CP, CP);
    const col = U.rgba(def.rgb, 1);
    if (def.bad) {
      // spiky dark seal
      g.beginPath();
      const cx = CW / 2, cy = CH / 2 + 2;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU - Math.PI / 2, r = i % 2 ? 17 : 23;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath();
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 23);
      gr.addColorStop(0, '#2a1230'); gr.addColorStop(1, '#0a040e');
      g.fillStyle = gr; g.fill();
      g.strokeStyle = col; g.lineWidth = 1.6; g.stroke();
      Art.icon(g, kind, cx, cy, 23, col);
    } else {
      // cord
      g.strokeStyle = 'rgba(214,60,50,0.95)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(CW / 2, 4, 3.4, 0, TAU); g.stroke();
      rr(g, 2, 6, CW - 4, CH - 8, 8);
      const gr = g.createLinearGradient(0, 6, 0, CH);
      gr.addColorStop(0, '#fff8e2'); gr.addColorStop(1, '#ecd7a6');
      g.fillStyle = gr; g.fill();
      g.strokeStyle = col; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(120,70,20,0.5)';
      g.beginPath(); g.arc(CW / 2, 10.5, 1.4, 0, TAU); g.fill();
      const cx = CW / 2, cy = 30;
      const dg = g.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 14);
      dg.addColorStop(0, U.rgba(def.rgb.map((v) => Math.min(255, v + 40)), 1));
      dg.addColorStop(1, U.rgba(def.rgb.map((v) => Math.round(v * 0.62)), 1));
      g.fillStyle = dg;
      g.beginPath(); g.arc(cx, cy, 14, 0, TAU); g.fill();
      Art.icon(g, kind, cx, cy, 20, 'rgba(255,255,255,0.96)');
    }
    cache[key] = c;
    return c;
  };

  /* ------------------------------------------------------- backdrops ---- */
  const THEMES = (Art.THEMES = {
    night1: {
      sky: [[0, '#04061a'], [0.42, '#0e1740'], [0.78, '#2c2460'], [1, '#703c66']],
      glow: [255, 150, 96], glowA: 0.34, star: 1,
      moon: { x: 1020, y: 196, r: 56, kind: 'full' },
      mtn: ['#151a4a', '#0c0f30'], shore: '#05060f', win: [255, 196, 112],
      water: ['#1c1c48', '#070818'], mist: [150, 120, 200], clouds: 'wisp', shoreKind: 'village',
      accent: [255, 190, 110],
    },
    night2: {
      sky: [[0, '#010507'], [0.45, '#07171f'], [0.8, '#133038'], [1, '#2a5052']],
      glow: [110, 210, 200], glowA: 0.2, star: 0.22,
      moon: { x: 250, y: 190, r: 40, kind: 'veiled' },
      mtn: ['#0a2029', '#06131a'], shore: '#020709', win: [255, 204, 128],
      water: ['#0d262c', '#02080a'], mist: [100, 170, 170], clouds: 'storm', shoreKind: 'bridge',
      accent: [130, 220, 230], rain: true,
    },
    night3: {
      sky: [[0, '#040107'], [0.45, '#14071e'], [0.8, '#380e2c'], [1, '#782236']],
      glow: [255, 84, 84], glowA: 0.26, star: 0.6,
      moon: { x: 640, y: 150, r: 60, kind: 'hollow' },
      mtn: ['#1c0a22', '#100514'], shore: '#060208', win: [255, 150, 130],
      water: ['#200a22', '#060208'], mist: [200, 90, 130], clouds: 'wisp', shoreKind: 'rocks',
      accent: [255, 130, 160],
    },
    dawn: {
      sky: [[0, '#1c2a60'], [0.36, '#5a5aa0'], [0.62, '#e0859a'], [0.86, '#ffc48a'], [1, '#fff0c0']],
      glow: [255, 230, 160], glowA: 0.7, star: 0.12,
      moon: { x: 640, y: 716, r: 84, kind: 'sun' },
      mtn: ['#6a5a9c', '#3c356e'], shore: '#1c1838', win: [255, 230, 170],
      water: ['#a8788c', '#2c2a5a'], mist: [255, 210, 190], clouds: 'dawn', shoreKind: 'village',
      accent: [255, 220, 150],
    },
  });
  THEMES.night3b = Object.assign({}, THEMES.night3, { moon: null });

  function softBlob(g, x, y, rx, ry, color, a) {
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, U.rgba(color, a));
    gr.addColorStop(0.55, U.rgba(color, a * 0.55));
    gr.addColorStop(1, U.rgba(color, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
    g.restore();
  }

  function pagoda(g, x, base, tiers, w, th) {
    let y = base, tw = w;
    for (let i = 0; i < tiers; i++) {
      const bh = tw * 0.34;
      g.fillRect(x - tw * 0.3, y - bh, tw * 0.6, bh);
      y -= bh;
      g.beginPath();
      g.moveTo(x - tw * 0.62, y + 2);
      g.quadraticCurveTo(x - tw * 0.4, y - 1, x - tw * 0.26, y - tw * 0.16);
      g.lineTo(x + tw * 0.26, y - tw * 0.16);
      g.quadraticCurveTo(x + tw * 0.4, y - 1, x + tw * 0.62, y + 2);
      g.closePath(); g.fill();
      y -= tw * 0.16;
      tw *= 0.8;
    }
    g.fillRect(x - 1.2, y - tw * 0.5, 2.4, tw * 0.5);
    return y;
  }

  function bambooV(g, x, y0, y1, w) {
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, '#0e150c'); gr.addColorStop(0.32, '#3d5230');
    gr.addColorStop(0.5, '#62804a'); gr.addColorStop(1, '#0b100a');
    g.fillStyle = gr;
    g.fillRect(x, y0, w, y1 - y0);
    for (let y = y0 + 38; y < y1; y += 62) {
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y, w, 2);
      g.fillStyle = 'rgba(190,220,150,0.22)'; g.fillRect(x, y + 2, w, 1.2);
    }
  }
  function bambooH(g, x0, x1, y, h) {
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#0e150c'); gr.addColorStop(0.3, '#62804a');
    gr.addColorStop(0.52, '#3d5230'); gr.addColorStop(1, '#090d08');
    g.fillStyle = gr;
    g.fillRect(x0, y, x1 - x0, h);
    for (let x = x0 + 50; x < x1; x += 96) {
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y, 2, h);
      g.fillStyle = 'rgba(190,220,150,0.2)'; g.fillRect(x + 2, y, 1.2, h);
    }
  }
  function lashing(g, x, y, w, h) {
    g.fillStyle = '#b08a52';
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(40,24,6,0.6)'; g.lineWidth = 0.8;
    for (let i = 1; i < 5; i++) {
      g.beginPath(); g.moveTo(x, y + (h * i) / 5); g.lineTo(x + w, y + (h * i) / 5 - 1.5); g.stroke();
    }
  }

  Art.paintBackground = function (cv, name, view) {
    const th = THEMES[name] || THEMES.night1;
    const g = cv.getContext('2d');
    const k = view.dpr * view.scale;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(k, 0, 0, k, view.offX * view.dpr, view.offY * view.dpr);
    const X0 = view.left - 4, X1 = view.right + 4, Y0 = view.top - 4, Y1 = view.bottom + 4;
    const HZ = C.WATER;
    const skyTop = Math.min(Y0, -80);

    // sky
    let gr = g.createLinearGradient(0, skyTop, 0, HZ);
    th.sky.forEach((s) => gr.addColorStop(s[0], s[1]));
    g.fillStyle = gr;
    g.fillRect(X0, Y0, X1 - X0, HZ - Y0 + 1);

    // horizon glow
    softBlob(g, 640, HZ + 20, 980, 300, th.glow, th.glowA);

    // stars
    const rs = U.rng(7);
    for (let i = 0; i < 520; i++) {
      const x = -1000 + rs() * 3280, y = -700 + rs() * (HZ - 80 + 700);
      const sz = 0.35 + Math.pow(rs(), 3) * 1.7, al = 0.25 + rs() * 0.75, tint = rs();
      if (x < X0 || x > X1 || y < Y0) continue;
      const fade = 1 - U.smooth(HZ - 360, HZ - 70, y);
      g.globalAlpha = al * th.star * fade;
      g.fillStyle = tint < 0.2 ? '#ffe2b8' : tint < 0.4 ? '#c4d4ff' : '#ffffff';
      g.beginPath(); g.arc(x, y, sz, 0, TAU); g.fill();
      if (sz > 1.55) {
        g.globalAlpha *= 0.5; g.lineWidth = 0.5; g.strokeStyle = g.fillStyle;
        g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.moveTo(x, y - 5); g.lineTo(x, y + 5); g.stroke();
      }
    }
    g.globalAlpha = 1;

    // moon / sun
    const m = th.moon;
    if (m) {
      if (m.kind === 'full' || m.kind === 'veiled') {
        const dim = m.kind === 'veiled' ? 0.55 : 1;
        softBlob(g, m.x, m.y, m.r * 5, m.r * 5, m.kind === 'veiled' ? [150, 210, 220] : [255, 226, 170], 0.2 * dim);
        softBlob(g, m.x, m.y, m.r * 2, m.r * 2, [255, 240, 200], 0.3 * dim);
        gr = g.createRadialGradient(m.x - m.r * 0.3, m.y - m.r * 0.3, m.r * 0.1, m.x, m.y, m.r);
        if (m.kind === 'veiled') { gr.addColorStop(0, '#e8f6f4'); gr.addColorStop(1, '#8cb8b8'); }
        else { gr.addColorStop(0, '#fffdf0'); gr.addColorStop(0.7, '#ffeebe'); gr.addColorStop(1, '#f2c888'); }
        g.fillStyle = gr;
        g.beginPath(); g.arc(m.x, m.y, m.r, 0, TAU); g.fill();
        if (m.kind === 'full') {
          g.fillStyle = 'rgba(160,110,60,0.1)';
          const rc = U.rng(3);
          for (let i = 0; i < 7; i++) {
            const a = rc() * TAU, d = rc() * m.r * 0.7, cr = m.r * (0.08 + rc() * 0.16);
            g.beginPath(); g.arc(m.x + Math.cos(a) * d, m.y + Math.sin(a) * d, cr, 0, TAU); g.fill();
          }
        } else {
          // rags of storm cloud dragging across the moon
          softBlob(g, m.x - 14, m.y - 10, m.r * 2.1, m.r * 0.34, [5, 14, 19], 0.9);
          softBlob(g, m.x + 22, m.y + 16, m.r * 2.4, m.r * 0.3, [5, 14, 19], 0.85);
          softBlob(g, m.x - 30, m.y + 34, m.r * 1.8, m.r * 0.24, [5, 14, 19], 0.7);
        }
      } else if (m.kind === 'hollow') {
        softBlob(g, m.x, m.y, m.r * 4.4, m.r * 4.4, [255, 100, 140], 0.2);
        softBlob(g, m.x, m.y, m.r * 1.7, m.r * 1.7, [255, 210, 220], 0.5);
        g.fillStyle = '#020003';
        g.beginPath(); g.arc(m.x, m.y, m.r, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,224,230,0.9)'; g.lineWidth = 1.6;
        g.beginPath(); g.arc(m.x, m.y, m.r + 0.5, 0, TAU); g.stroke();
      } else if (m.kind === 'sun') {
        softBlob(g, m.x, m.y, 900, 520, [255, 214, 150], 0.55);
        softBlob(g, m.x, m.y, 300, 300, [255, 244, 210], 0.8);
        g.fillStyle = '#fffbe6';
        g.beginPath(); g.arc(m.x, m.y, m.r, 0, TAU); g.fill();
      }
    }

    // clouds
    const rc2 = U.rng(21);
    if (th.clouds === 'storm') {
      for (let i = 0; i < 70; i++) {
        const x = -900 + rc2() * 3080, y = -260 + rc2() * 470, rx = 150 + rc2() * 260, ry = 34 + rc2() * 60;
        if (x + rx < X0 || x - rx > X1) continue;
        softBlob(g, x, y, rx, ry, [4, 12, 16], 0.62);
      }
      for (let i = 0; i < 26; i++) {
        const x = -900 + rc2() * 3080, y = 20 + rc2() * 260, rx = 120 + rc2() * 200, ry = 14 + rc2() * 22;
        softBlob(g, x, y, rx, ry, [90, 140, 150], 0.06);
      }
    } else if (th.clouds === 'wisp') {
      for (let i = 0; i < 16; i++) {
        const x = -900 + rc2() * 3080, y = 60 + rc2() * 400, rx = 180 + rc2() * 300, ry = 6 + rc2() * 12;
        softBlob(g, x, y, rx, ry, th.mist, 0.07);
      }
    } else if (th.clouds === 'dawn') {
      for (let i = 0; i < 22; i++) {
        const x = -900 + rc2() * 3080, y = 250 + rc2() * 330, rx = 160 + rc2() * 300, ry = 8 + rc2() * 14;
        softBlob(g, x, y, rx, ry, [255, 190, 170], 0.22);
      }
    }

    // mountains
    const ridge = (seed, base, amp, c0, mistA) => {
      const r = U.rng(seed);
      const p = [r() * 9, r() * 9, r() * 9, r() * 9];
      g.beginPath();
      g.moveTo(X0, HZ + 2);
      for (let x = X0; x <= X1 + 6; x += 6) {
        const n = Math.sin(x * 0.0037 + p[0]) * 0.5 + Math.sin(x * 0.0089 + p[1]) * 0.3 + Math.sin(x * 0.021 + p[2]) * 0.14 + Math.sin(x * 0.05 + p[3]) * 0.06;
        g.lineTo(x, base - amp * (0.5 + 0.5 * n));
      }
      g.lineTo(X1 + 6, HZ + 2);
      g.closePath();
      const gg = g.createLinearGradient(0, base - amp, 0, HZ);
      gg.addColorStop(0, c0);
      gg.addColorStop(1, U.rgba(th.mist, mistA));
      g.fillStyle = c0; g.fill();
      g.fillStyle = gg; g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1;
    };
    ridge(101, HZ - 66, 190, th.mtn[0], 0.5);
    ridge(202, HZ - 26, 104, th.mtn[1], 0.34);

    // shoreline silhouettes
    const rsh = U.rng(55);
    g.fillStyle = th.shore;
    const wins = [];
    if (th.shoreKind === 'village' || th.shoreKind === 'bridge') {
      let x = -1000;
      while (x < 2300) {
        const inField = x > 30 && x < 1250;
        const r1 = rsh(), r2 = rsh(), r3 = rsh(), r4 = rsh();
        const w = 16 + r1 * 26;
        if (r2 < 0.26) {
          const tr = (inField ? 8 : 12) + r3 * (inField ? 10 : 30);
          g.beginPath(); g.arc(x + tr, HZ - tr * 0.9, tr, 0, TAU); g.fill();
          g.beginPath(); g.arc(x + tr * 1.9, HZ - tr * 0.6, tr * 0.8, 0, TAU); g.fill();
          g.fillRect(x, HZ - tr * 0.6, tr * 2.6, tr);
          x += tr * 2.6;
        } else {
          const hgt = (inField ? 9 : 14) + r3 * (inField ? 20 : 44);
          g.fillRect(x, HZ - hgt, w, hgt + 1);
          g.beginPath();
          g.moveTo(x - 4, HZ - hgt + 1);
          g.quadraticCurveTo(x + w * 0.3, HZ - hgt - 2, x + w / 2, HZ - hgt - 7 - r4 * 5);
          g.quadraticCurveTo(x + w * 0.7, HZ - hgt - 2, x + w + 4, HZ - hgt + 1);
          g.closePath(); g.fill();
          const nw = 1 + ((r4 * 3) | 0);
          for (let i = 0; i < nw; i++) {
            if (rsh() < 0.7) wins.push([x + 4 + (i * (w - 8)) / Math.max(1, nw - 1 || 1) * (nw > 1 ? 1 : 0.5), HZ - hgt * (0.35 + rsh() * 0.3)]);
          }
          x += w + 2 + r1 * 8;
        }
      }
      // landmarks that frame the field on wide screens
      pagoda(g, -150, HZ, 5, 120, th);
      pagoda(g, 1500, HZ, 4, 96, th);
      pagoda(g, -520, HZ, 3, 80, th);
    }
    if (th.shoreKind === 'bridge') {
      // long arched bridge behind the river
      g.strokeStyle = th.shore; g.lineCap = 'butt';
      g.lineWidth = 7;
      g.beginPath(); g.moveTo(180, HZ - 4); g.quadraticCurveTo(640, HZ - 92, 1100, HZ - 4); g.stroke();
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(180, HZ - 16); g.quadraticCurveTo(640, HZ - 106, 1100, HZ - 16); g.stroke();
      for (let i = 0; i <= 22; i++) {
        const t = i / 22, bx = 180 + 920 * t, by = HZ - 4 - 88 * (1 - Math.pow(2 * t - 1, 2)) * 0.5 * 2 * 0.5;
        const top = (1 - t) * (1 - t) * (HZ - 4) + 2 * (1 - t) * t * (HZ - 92) + t * t * (HZ - 4);
        g.fillRect(bx - 1, top - 13, 2, 13);
        if (i % 5 === 2) g.fillRect(bx - 4, top, 8, HZ - top + 2);
        void by;
      }
    }
    if (th.shoreKind === 'rocks') {
      let x = -1000;
      while (x < 2300) {
        const inField = x > 30 && x < 1250;
        const w = 20 + rsh() * 50, hgt = (inField ? 10 : 30) + rsh() * rsh() * (inField ? 44 : 190);
        g.beginPath();
        g.moveTo(x - w * 0.2, HZ + 2);
        g.lineTo(x + w * 0.22, HZ - hgt * 0.7);
        g.lineTo(x + w * 0.4, HZ - hgt);
        g.lineTo(x + w * 0.58, HZ - hgt * 0.82);
        g.lineTo(x + w * 0.74, HZ - hgt * 0.4);
        g.lineTo(x + w * 1.15, HZ + 2);
        g.closePath(); g.fill();
        x += w * (0.7 + rsh() * 1.6);
      }
    }
    // lit windows
    for (let i = 0; i < wins.length; i++) {
      const wx = wins[i][0], wy = wins[i][1];
      if (wx < X0 || wx > X1) continue;
      softBlob(g, wx, wy, 9, 9, th.win, 0.3);
      g.fillStyle = U.rgba(th.win, 0.95);
      g.fillRect(wx - 1.2, wy - 1.5, 2.4, 3);
    }
    // strings of far-off festival lights
    if (th.shoreKind === 'village') {
      const rl = U.rng(91);
      for (let s = 0; s < 16; s++) {
        const x0 = -900 + rl() * 3000, span = 90 + rl() * 120, y0 = HZ - 24 - rl() * 22;
        for (let i = 0; i <= 9; i++) {
          const t = i / 9, lx = x0 + span * t, ly = y0 + Math.sin(t * Math.PI) * 9;
          softBlob(g, lx, ly, 5, 5, th.win, 0.5);
          g.fillStyle = U.rgba(th.win, 0.95);
          g.fillRect(lx - 0.7, ly - 0.7, 1.4, 1.4);
        }
      }
    }

    // mist over the water's edge
    gr = g.createLinearGradient(0, HZ - 110, 0, HZ);
    gr.addColorStop(0, U.rgba(th.mist, 0));
    gr.addColorStop(1, U.rgba(th.mist, 0.26));
    g.fillStyle = gr;
    g.fillRect(X0, HZ - 110, X1 - X0, 110);

    // water base (the live water is painted over this every frame)
    gr = g.createLinearGradient(0, HZ, 0, HZ + 120);
    gr.addColorStop(0, th.water[0]); gr.addColorStop(1, th.water[1]);
    g.fillStyle = gr;
    g.fillRect(X0, HZ, X1 - X0, Y1 - HZ);

    // the bamboo frame that bounds the playfield
    bambooV(g, C.L - 18, 30, HZ + 40, 18);
    bambooV(g, C.R, 30, HZ + 40, 18);
    bambooH(g, C.L - 40, C.R + 40, C.T - 15, 15);
    lashing(g, C.L - 20, C.T - 18, 22, 21);
    lashing(g, C.R - 2, C.T - 18, 22, 21);
    g.fillStyle = '#0c120a';
    g.fillRect(C.L - 20, 26, 22, 5); g.fillRect(C.R - 2, 26, 22, 5);
    // inner edge light so the walls read clearly
    g.fillStyle = U.rgba(th.accent, 0.16);
    g.fillRect(C.L - 1, C.T, 1.5, HZ - C.T);
    g.fillRect(C.R - 0.5, C.T, 1.5, HZ - C.T);
    g.fillRect(C.L, C.T - 1, C.R - C.L, 1.5);

    g.setTransform(1, 0, 0, 1, 0, 0);
  };

  Art.paintVignette = function (cv) {
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    const w = cv.width, h = cv.height;
    g.save();
    g.translate(w / 2, h / 2);
    g.scale(w / 2, h / 2);
    const gr = g.createRadialGradient(0, 0, 0.55, 0, 0, 1.42);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,6,0.62)');
    g.fillStyle = gr;
    g.fillRect(-1, -1, 2, 2);
    g.restore();
  };

  Art.lanternDataURL = function (color) {
    return Art.brickSprite('paper', color || 'r', 1).toDataURL();
  };
})();
