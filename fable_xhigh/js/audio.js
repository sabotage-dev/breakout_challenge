/* Lanternwake — procedural audio: every sound and all music is synthesised live */
(function () {
  'use strict';
  const LW = window.LW, U = LW.U;
  const A = (LW.Audio = { ready: false, musicVol: 0.55, sfxVol: 0.8, muted: false, ctx: null });

  let ctx = null, master, sfxBus, musicBus, sfxRev, musicRev, musicDelay, noiseBuf;
  const lastPlayed = {};

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const THEMES = {
    title:  { root: 50, scale: [0, 2, 4, 7, 9],  prog: [0, 3, 1, 4], tempo: 70 },
    night1: { root: 50, scale: [0, 2, 4, 7, 9],  prog: [0, 2, 3, 1], tempo: 84 },
    night2: { root: 48, scale: [0, 2, 3, 7, 8],  prog: [0, 3, 1, 4], tempo: 92 },
    night3: { root: 49, scale: [0, 1, 5, 7, 10], prog: [0, 2, 4, 1], tempo: 88 },
    dawn:   { root: 53, scale: [0, 2, 4, 7, 9],  prog: [0, 3, 4, 0], tempo: 76 },
  };
  const M = { theme: THEMES.title, name: 'title', intensity: 0, step: 0, next: 0, chord: 0, chordIdx: 0, walk: 4, on: false, timer: 0 };

  function deg(th, d) {
    const n = th.scale.length;
    const o = Math.floor(d / n);
    return th.root + 12 * o + th.scale[((d % n) + n) % n];
  }

  function makeIR(seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 400 ? i / 400 : 1);
      }
    }
    return buf;
  }

  A.init = function () {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    A.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5;
    comp.attack.value = 0.004; comp.release.value = 0.22;
    master = ctx.createGain();
    master.gain.value = A.muted ? 0 : 0.9;
    master.connect(comp); comp.connect(ctx.destination);

    sfxBus = ctx.createGain(); sfxBus.gain.value = A.sfxVol; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = A.musicVol; musicBus.connect(master);

    const ir = makeIR(2.6, 2.6);
    const c1 = ctx.createConvolver(); c1.buffer = ir;
    sfxRev = ctx.createGain(); sfxRev.gain.value = 1;
    const o1 = ctx.createGain(); o1.gain.value = 0.42;
    sfxRev.connect(c1); c1.connect(o1); o1.connect(sfxBus);

    const c2 = ctx.createConvolver(); c2.buffer = ir;
    musicRev = ctx.createGain(); musicRev.gain.value = 1;
    const o2 = ctx.createGain(); o2.gain.value = 0.5;
    musicRev.connect(c2); c2.connect(o2); o2.connect(musicBus);

    musicDelay = ctx.createDelay(1.5); musicDelay.delayTime.value = 0.4;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    const dOut = ctx.createGain(); dOut.gain.value = 0.5;
    musicDelay.connect(lp); lp.connect(fb); fb.connect(musicDelay);
    lp.connect(dOut); dOut.connect(musicBus);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    A.ready = true;
    M.next = ctx.currentTime + 0.15;
    M.on = true;
    if (!M.timer) M.timer = setInterval(schedule, 30);
  };

  A.suspend = function () { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); };
  A.setMusicVol = function (v) { A.musicVol = v; if (ctx) musicBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05); };
  A.setSfxVol = function (v) { A.sfxVol = v; if (ctx) sfxBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05); };
  A.setMuted = function (m) { A.muted = m; if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.03); };

  function throttled(name, gap) {
    const t = ctx.currentTime;
    if (lastPlayed[name] !== undefined && t - lastPlayed[name] < gap) return true;
    lastPlayed[name] = t;
    return false;
  }

  // One oscillator with a pluck-style envelope.
  function voice(type, f, at, dur, vol, o) {
    o = o || {};
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f), at);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), at + (o.toTime || dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const atk = o.attack || 0.004;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + atk);
    if (o.hold) g.gain.setValueAtTime(vol, at + atk + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + atk + (o.hold || 0) + dur);
    let out = g;
    if (o.lp) {
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, at);
      if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, at + dur);
      g.connect(fl); out = fl;
    }
    osc.connect(g);
    const music = o.bus === 'm';
    out.connect(music ? musicBus : sfxBus);
    if (o.rev) {
      const s = ctx.createGain(); s.gain.value = o.rev;
      out.connect(s); s.connect(music ? musicRev : sfxRev);
    }
    if (o.delay && music) {
      const s2 = ctx.createGain(); s2.gain.value = o.delay;
      out.connect(s2); s2.connect(musicDelay);
    }
    osc.start(at);
    osc.stop(at + atk + (o.hold || 0) + dur + 0.08);
  }

  function noise(at, dur, vol, o) {
    o = o || {};
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = o.type || 'lowpass';
    fl.frequency.setValueAtTime(o.f || 1200, at);
    if (o.to) fl.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), at + dur);
    fl.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    const atk = o.attack || 0.003;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, at + atk + dur);
    src.connect(fl); fl.connect(g);
    const music = o.bus === 'm';
    g.connect(music ? musicBus : sfxBus);
    if (o.rev) {
      const s = ctx.createGain(); s.gain.value = o.rev;
      g.connect(s); s.connect(music ? musicRev : sfxRev);
    }
    src.start(at, Math.random() * 1.2);
    src.stop(at + atk + dur + 0.08);
  }

  function kalimba(midi, at, vol, o) {
    o = o || {};
    const f = mtof(midi);
    voice('sine', f, at, o.dur || 0.55, vol, { bus: o.bus, rev: o.rev === undefined ? 0.35 : o.rev, delay: o.delay });
    voice('sine', f * 2, at, 0.22, vol * 0.3, { bus: o.bus });
    voice('triangle', f * 5.4, at, 0.05, vol * 0.14, { bus: o.bus });
  }

  function bellTone(midi, at, vol, o) {
    o = o || {};
    const f = mtof(midi);
    const parts = [[1, 1, 2.4], [2.0, 0.5, 1.7], [2.76, 0.42, 1.3], [4.07, 0.24, 0.9], [5.4, 0.16, 0.5]];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      voice('sine', f * p[0], at, p[2] * (o.len || 1), vol * p[1], { bus: o.bus, rev: 0.5 });
    }
  }

  const now = () => ctx.currentTime;
  const ok = () => A.ready && ctx && ctx.state === 'running';

  /* ------------------------------------------------------------ SFX ---- */
  const S = (A.sfx = {});

  // Lantern release: climbs the current scale as the chain grows.
  S.lantern = function (step) {
    if (!ok() || throttled('lantern', 0.03)) return;
    const th = M.theme, i = step % 13;
    kalimba(deg(th, i) + 12, now(), 0.26);
    noise(now(), 0.03, 0.05, { type: 'highpass', f: 3500 });
  };
  S.ignite = function () {
    if (!ok() || throttled('ignite', 0.04)) return;
    const t = now();
    noise(t, 0.2, 0.16, { type: 'bandpass', f: 320, to: 1500, q: 1.2 });
    voice('sine', 170, t, 0.16, 0.14, { to: 300 });
  };
  S.gold = function () {
    if (!ok()) return;
    const th = M.theme, t = now();
    for (let i = 0; i < 4; i++) kalimba(deg(th, 5 + i * 2) + 12, t + i * 0.05, 0.16, { rev: 0.5 });
  };
  S.paddle = function (hard) {
    if (!ok() || throttled('paddle', 0.03)) return;
    const t = now();
    voice('sine', 165, t, 0.14, 0.5, { to: 70 });
    noise(t, 0.045, 0.2, { type: 'bandpass', f: 900, q: 2 });
    if (hard) voice('triangle', 330, t, 0.08, 0.1, { to: 200 });
  };
  S.wall = function () {
    if (!ok() || throttled('wall', 0.04)) return;
    const t = now();
    voice('triangle', 560, t, 0.06, 0.1, { to: 380 });
    noise(t, 0.02, 0.07, { type: 'bandpass', f: 1900, q: 3 });
  };
  S.stone = function () {
    if (!ok() || throttled('stone', 0.04)) return;
    const t = now();
    noise(t, 0.09, 0.3, { type: 'bandpass', f: 520, q: 1 });
    voice('sine', 120, t, 0.1, 0.25, { to: 80 });
  };
  S.stoneBreak = function () {
    if (!ok() || throttled('stoneBreak', 0.05)) return;
    const t = now();
    noise(t, 0.38, 0.4, { f: 1100, to: 180 });
    for (let i = 0; i < 4; i++) noise(t + 0.03 + Math.random() * 0.2, 0.03, 0.14, { type: 'bandpass', f: 700 + Math.random() * 900, q: 4 });
    voice('sine', 90, t, 0.25, 0.3, { to: 45 });
  };
  S.bell = function () {
    if (!ok() || throttled('bell', 0.07)) return;
    const th = M.theme;
    bellTone(deg(th, U.pick([5, 7, 8, 10])) + 12, now(), 0.16);
  };
  S.cracker = function () {
    if (!ok() || throttled('cracker', 0.05)) return;
    const t = now();
    const n = 5 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) noise(t + Math.random() * 0.26, 0.03 + Math.random() * 0.04, 0.3, { type: 'highpass', f: 1400 + Math.random() * 1600 });
    voice('sine', 130, t, 0.22, 0.4, { to: 46 });
    noise(t, 0.3, 0.3, { f: 1500, to: 200 });
  };
  S.boom = function (size) {
    if (!ok() || throttled('boom', 0.06)) return;
    const t = now(), v = Math.min(1, size || 1);
    noise(t, 0.6, 0.42 * v, { f: 1400, to: 90, rev: 0.4 });
    voice('sine', 95, t, 0.45, 0.5 * v, { to: 34 });
  };
  S.charm = function () {
    if (!ok()) return;
    const th = M.theme, t = now();
    [5, 7, 9, 12].forEach((d, i) => voice('triangle', mtof(deg(th, d) + 12), t + i * 0.055, 0.3, 0.13, { rev: 0.4 }));
  };
  S.hazard = function () {
    if (!ok() || throttled('hazard', 0.1)) return;
    const t = now();
    voice('sawtooth', 220, t, 0.22, 0.16, { to: 150, lp: 900 });
    voice('sawtooth', 208, t + 0.09, 0.3, 0.16, { to: 104, lp: 700 });
    noise(t, 0.2, 0.14, { type: 'bandpass', f: 400, q: 1 });
  };
  S.swing = function () {
    if (!ok() || throttled('swing', 0.08)) return;
    noise(now(), 0.11, 0.07, { type: 'bandpass', f: 500, to: 1800, q: 1.5 });
  };
  S.flare = function () {
    if (!ok()) return;
    const t = now(), th = M.theme;
    voice('sine', 520, t, 0.16, 0.26, { to: 1900, rev: 0.4 });
    noise(t, 0.24, 0.2, { type: 'bandpass', f: 900, to: 5200, q: 1.2 });
    voice('sine', 110, t, 0.26, 0.5, { to: 48 });
    bellTone(deg(th, 10) + 12, t + 0.02, 0.1, { len: 0.6 });
  };
  S.launch = function () {
    if (!ok()) return;
    const t = now();
    voice('sine', 300, t, 0.14, 0.16, { to: 760 });
    noise(t, 0.1, 0.05, { type: 'bandpass', f: 1200, to: 3000, q: 1 });
  };
  S.catchBall = function () {
    if (!ok() || throttled('catch', 0.05)) return;
    voice('sine', 420, now(), 0.09, 0.14, { to: 260 });
  };
  S.splash = function () {
    if (!ok() || throttled('splash', 0.06)) return;
    const t = now();
    noise(t, 0.5, 0.36, { f: 2600, to: 260, rev: 0.3 });
    voice('sine', 230, t, 0.4, 0.2, { to: 60 });
    for (let i = 0; i < 4; i++) voice('sine', 420 + Math.random() * 600, t + 0.12 + Math.random() * 0.35, 0.05, 0.05, { to: 900 + Math.random() * 500 });
  };
  S.plop = function () {
    if (!ok() || throttled('plop', 0.06)) return;
    const t = now();
    voice('sine', 300, t, 0.09, 0.1, { to: 700 });
    noise(t, 0.12, 0.06, { f: 1800, to: 400 });
  };
  S.lost = function () {
    if (!ok()) return;
    const t = now(), th = M.theme;
    [9, 7, 5, 2].forEach((d, i) => voice('triangle', mtof(deg(th, d)), t + 0.15 + i * 0.16, 0.5, 0.14, { rev: 0.5, lp: 1400 }));
  };
  S.rocket = function () {
    if (!ok() || throttled('rocket', 0.07)) return;
    const t = now();
    noise(t, 0.16, 0.08, { type: 'bandpass', f: 1400, to: 3800, q: 2 });
    voice('sine', 700, t, 0.14, 0.04, { to: 1500 });
  };
  S.whistle = function () {
    if (!ok() || throttled('whistle', 0.12)) return;
    voice('sine', 620 + Math.random() * 200, now(), 0.55, 0.035, { to: 1500 + Math.random() * 500, attack: 0.05 });
  };
  S.firework = function (size) {
    if (!ok() || throttled('firework', 0.05)) return;
    const t = now(), v = Math.min(1.2, size || 1);
    noise(t, 0.7, 0.24 * v, { f: 2200, to: 140, rev: 0.6 });
    voice('sine', 100, t, 0.3, 0.26 * v, { to: 44 });
    for (let i = 0; i < 9; i++) noise(t + 0.12 + Math.random() * 0.55, 0.025, 0.05 * v, { type: 'highpass', f: 3200 });
  };
  S.fly = function () {
    if (!ok() || throttled('fly', 0.04)) return;
    const th = M.theme;
    voice('sine', mtof(deg(th, 10 + ((Math.random() * 5) | 0)) + 12), now(), 0.12, 0.07, { rev: 0.4 });
  };
  S.life = function () {
    if (!ok()) return;
    const th = M.theme, t = now();
    [5, 7, 9, 10, 12, 14].forEach((d, i) => bellTone(deg(th, d) + 12, t + i * 0.07, 0.09, { len: 0.5 }));
  };
  S.chainUp = function (n) {
    if (!ok() || throttled('chainUp', 0.08)) return;
    const th = M.theme, t = now();
    voice('triangle', mtof(deg(th, 5 + n) + 12), t, 0.16, 0.12, { rev: 0.3 });
    voice('triangle', mtof(deg(th, 7 + n) + 12), t + 0.07, 0.24, 0.12, { rev: 0.3 });
  };
  S.chainBreak = function () {
    if (!ok()) return;
    voice('sine', 300, now(), 0.2, 0.06, { to: 150 });
  };
  S.tick = function () {
    if (!ok() || throttled('tick', 0.03)) return;
    voice('sine', 1100, now(), 0.04, 0.05);
  };
  S.select = function () {
    if (!ok()) return;
    const th = M.theme, t = now();
    kalimba(deg(th, 5) + 12, t, 0.2);
    kalimba(deg(th, 8) + 12, t + 0.08, 0.2);
  };
  S.wish = function () {
    if (!ok()) return;
    const th = M.theme, t = now();
    [5, 7, 9, 12, 14].forEach((d, i) => bellTone(deg(th, d) + 12, t + i * 0.09, 0.1, { len: 0.8 }));
    noise(t, 0.6, 0.05, { type: 'highpass', f: 5000, attack: 0.2 });
  };
  S.stageClear = function () {
    if (!ok()) return;
    const th = M.theme, t = now();
    [0, 2, 4, 5, 7, 9, 10, 12].forEach((d, i) => kalimba(deg(th, d) + 12, t + i * 0.085, 0.22, { rev: 0.5 }));
    [0, 2, 4].forEach((d) => bellTone(deg(th, d + 5) + 12, t + 0.75, 0.12));
  };
  S.gameOver = function () {
    if (!ok()) return;
    const th = M.theme, t = now();
    [7, 5, 4, 2, 0].forEach((d, i) => bellTone(deg(th, d), t + i * 0.34, 0.16, { len: 1.2 }));
    voice('sine', mtof(th.root - 12), t, 3, 0.2, { attack: 0.6 });
  };
  S.bossHit = function () {
    if (!ok() || throttled('bossHit', 0.04)) return;
    const t = now();
    voice('sine', 150, t, 0.16, 0.42, { to: 58 });
    voice('square', 233, t, 0.1, 0.08, { lp: 1200, to: 180 });
    noise(t, 0.07, 0.16, { type: 'bandpass', f: 1300, q: 1.5 });
  };
  S.roar = function () {
    if (!ok() || throttled('roar', 0.3)) return;
    const t = now();
    voice('sawtooth', 96, t, 0.9, 0.3, { to: 58, lp: 300, lpTo: 1100, attack: 0.08, rev: 0.5 });
    voice('sawtooth', 143, t, 0.8, 0.16, { to: 80, lp: 400, lpTo: 900, attack: 0.1 });
    noise(t, 0.8, 0.14, { type: 'bandpass', f: 500, to: 1400, q: 0.8, attack: 0.1 });
  };
  S.spit = function () {
    if (!ok() || throttled('spit', 0.08)) return;
    const t = now();
    noise(t, 0.25, 0.16, { type: 'bandpass', f: 1600, to: 500, q: 1 });
    voice('sawtooth', 260, t, 0.2, 0.08, { to: 120, lp: 900 });
  };
  S.telegraph = function () {
    if (!ok() || throttled('telegraph', 0.1)) return;
    noise(now(), 0.85, 0.07, { type: 'highpass', f: 2500, to: 7000, attack: 0.6 });
  };
  S.thunder = function () {
    if (!ok() || throttled('thunder', 0.12)) return;
    const t = now();
    noise(t, 0.06, 0.5, { type: 'highpass', f: 1800 });
    noise(t + 0.02, 1.5, 0.55, { f: 520, to: 55, rev: 0.7 });
    voice('sine', 70, t, 0.9, 0.4, { to: 30 });
  };
  S.rumble = function () {
    if (!ok() || throttled('rumble', 1)) return;
    noise(now(), 2.4, 0.1, { f: 180, to: 60, attack: 0.5, rev: 0.6 });
  };
  S.eclipse = function () {
    if (!ok()) return;
    const t = now();
    voice('sawtooth', 55, t, 1.6, 0.26, { lp: 90, lpTo: 700, attack: 0.5, rev: 0.6 });
    voice('sine', 880, t, 1.4, 0.03, { to: 220, attack: 0.3, rev: 0.6 });
  };
  S.shadow = function () {
    if (!ok() || throttled('shadow', 0.1)) return;
    const t = now();
    voice('sine', 400, t, 0.4, 0.1, { to: 90, rev: 0.5 });
    noise(t, 0.3, 0.06, { type: 'bandpass', f: 300, q: 2 });
  };
  S.dawn = function () {
    if (!ok()) return;
    const th = THEMES.dawn, t = now();
    for (let i = 0; i < 14; i++) bellTone(deg(th, i) + 12, t + 0.4 + i * 0.16, 0.1, { len: 1.2 });
    [0, 2, 4, 7].forEach((d) => voice('triangle', mtof(deg(th, d)), t, 5, 0.07, { attack: 2, lp: 1600, rev: 0.6 }));
    noise(t, 3.5, 0.06, { type: 'highpass', f: 4000, attack: 2 });
  };

  // A sound effect must never be able to break the game loop.
  Object.keys(S).forEach((k) => {
    const f = S[k];
    S[k] = function () {
      try { return f.apply(null, arguments); } catch (e) {
        if (window.__lwErrors && window.__lwErrors.length < 20) window.__lwErrors.push('sfx.' + k + ': ' + e);
        return undefined;
      }
    };
  });

  /* ---------------------------------------------------------- MUSIC ---- */
  A.setTheme = function (name, intensity) {
    const th = THEMES[name] || THEMES.night1;
    M.theme = th; M.name = name;
    M.intensity = intensity === undefined ? 1 : intensity;
  };
  A.currentTheme = () => M.name;

  function pad(midi, at, dur, vol) {
    const f = mtof(midi);
    for (let k = 0; k < 2; k++) {
      const osc = ctx.createOscillator();
      osc.type = k ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = k ? 7 : -6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(vol, at + 1.4);
      g.gain.setValueAtTime(vol, at + dur - 0.4);
      g.gain.linearRampToValueAtTime(0.0001, at + dur + 1.8);
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1300;
      osc.connect(g); g.connect(fl); fl.connect(musicBus);
      const s = ctx.createGain(); s.gain.value = 0.5; fl.connect(s); s.connect(musicRev);
      osc.start(at); osc.stop(at + dur + 2);
    }
  }

  function taiko(at, vol, pitch) {
    voice('sine', (pitch || 105), at, 0.26, vol, { to: 44, bus: 'm' });
    noise(at, 0.05, vol * 0.35, { f: 700, bus: 'm' });
  }

  function scheduleStep(step, t, sd) {
    const th = M.theme, s = step % 32, I = M.intensity;
    if (s === 0) {
      M.chord = th.prog[M.chordIdx % th.prog.length];
      M.chordIdx++;
      const dur = 32 * sd;
      const v = I === 0 ? 0.05 : 0.04;
      pad(deg(th, M.chord) + 12, t, dur, v);
      pad(deg(th, M.chord + 2) + 12, t, dur, v * 0.8);
      pad(deg(th, M.chord + 4) + 12, t, dur, v * 0.7);
      pad(deg(th, M.chord) - 12, t, dur, v * 1.1);
    }
    const d = M.chord;
    if (I >= 1 && (s === 0 || s === 10 || s === 16 || s === 26)) {
      const m = (s === 26 ? deg(th, d + 3) : deg(th, d)) - 12;   // passing note stays in the scale
      voice('triangle', mtof(m), t, 0.5, 0.2, { bus: 'm', lp: 600 });
      voice('sine', mtof(m + 12), t, 0.3, 0.07, { bus: 'm' });
    }
    if (step % 2 === 0) {
      let p = [0.26, 0.46, 0.6][I] || 0.4;
      if (s % 8 === 0) p += 0.25;
      if (Math.random() < p) {
        M.walk = U.clamp(M.walk + U.pick([-2, -1, -1, 1, 1, 2]), 0, 9);
        kalimba(deg(th, d + M.walk) + 24, t, I === 0 ? 0.07 : 0.085, { bus: 'm', rev: 0.5, delay: 0.5, dur: 0.7 });
      }
    }
    if (I >= 2) {
      if (s % 8 === 0) taiko(t, 0.42);
      if (s === 6 || s === 14 || s === 22 || s === 27 || s === 30) taiko(t, 0.2, 150);
      if (step % 4 === 2) noise(t, 0.03, 0.05, { type: 'highpass', f: 5000, bus: 'm' });
    } else if (I === 1) {
      if (s % 16 === 0) taiko(t, 0.14, 90);
      if (s % 16 === 8 && Math.random() < 0.6) noise(t, 0.05, 0.02, { type: 'highpass', f: 6000, bus: 'm' });
    }
  }

  function schedule() {
    if (!ctx || ctx.state !== 'running' || !M.on) return;
    const tempo = M.theme.tempo + (M.intensity >= 2 ? 14 : 0);
    const sd = 60 / tempo / 4;
    if (M.next < ctx.currentTime - 0.3) M.next = ctx.currentTime + 0.05; // recover after a stall
    musicDelay.delayTime.setTargetAtTime(sd * 3, ctx.currentTime, 0.2);
    while (M.next < ctx.currentTime + 0.16) {
      try { scheduleStep(M.step, M.next, sd); } catch (e) {
        // never let music kill the game
        if (window.__lwErrors && window.__lwErrors.length < 20) window.__lwErrors.push('music: ' + e);
      }
      M.step++;
      M.next += sd;
    }
  }
})();
