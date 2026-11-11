'use strict';
/* ==========================================================================
   HADAL — audio: everything is synthesised live with the Web Audio API.
   No samples. A small step sequencer plays a generative score per zone and
   brick hits are tuned to the same scale, so chains turn into melodies.
   ========================================================================== */

const Sound = (() => {
  let ac = null, ok = false;
  let master, lp, comp, revIn, delayNode, noiseBuf;
  let mDry, mWet, mEcho, mVolD, mVolW;
  let sDry, sWet, sVolD, sVolW;
  const vol = { music: 0.7, sfx: 0.8 };
  let quiet = false, focusOn = false, muffled = false;
  const last = Object.create(null);

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const wallClock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

  /* ---------------------------------------------------------------- setup */
  function impulse(sec, decay) {
    const rate = ac.sampleRate, len = Math.floor(rate * sec);
    const buf = ac.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let prev = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const x = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
        prev += (x - prev) * (0.55 - 0.4 * t);      // darker tail: it is underwater, after all
        d[i] = prev * (i < 300 ? i / 300 : 1);
      }
    }
    return buf;
  }

  function init() {
    if (ac) return ok;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.85;
      lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.5;
      comp = ac.createDynamicsCompressor();
      comp.threshold.value = -15; comp.knee.value = 20; comp.ratio.value = 5;
      comp.attack.value = 0.004; comp.release.value = 0.22;
      master.connect(lp); lp.connect(comp); comp.connect(ac.destination);

      // shared reverb
      revIn = ac.createGain();
      const conv = ac.createConvolver(); conv.buffer = impulse(3.0, 2.4);
      const revOut = ac.createGain(); revOut.gain.value = 0.55;
      revIn.connect(conv); conv.connect(revOut); revOut.connect(master);

      // music buses
      mVolD = ac.createGain(); mVolW = ac.createGain();
      mVolD.connect(master); mVolW.connect(master);
      const mSend = ac.createGain(); mSend.gain.value = 0.5; mVolW.connect(mSend); mSend.connect(revIn);
      mDry = ac.createGain(); mDry.connect(mVolD);
      mWet = ac.createGain(); mWet.connect(mVolW);
      mEcho = ac.createGain(); mEcho.connect(mWet);
      delayNode = ac.createDelay(1.5); delayNode.delayTime.value = 0.34;
      const fb = ac.createGain(); fb.gain.value = 0.36;
      const dlp = ac.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2200;
      const dOut = ac.createGain(); dOut.gain.value = 0.42;
      mEcho.connect(delayNode); delayNode.connect(dlp); dlp.connect(fb); fb.connect(delayNode);
      dlp.connect(dOut); dOut.connect(mWet);

      // sfx buses
      sVolD = ac.createGain(); sVolW = ac.createGain();
      sVolD.connect(master); sVolW.connect(master);
      const sSend = ac.createGain(); sSend.gain.value = 0.32; sVolW.connect(sSend); sSend.connect(revIn);
      sDry = ac.createGain(); sDry.connect(sVolD);
      sWet = ac.createGain(); sWet.connect(sVolW);

      // noise source material
      const n = ac.sampleRate * 2;
      noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) nd[i] = Math.random() * 2 - 1;

      ok = true;
      applyVol();
      if (Music.pending) { const p = Music.pending; Music.pending = null; Music.play(p); }
    } catch (e) { ok = false; }
    return ok;
  }

  function applyVol() {
    if (!ok) return;
    const t = ac.currentTime;
    const m = vol.music * vol.music * 1.9, s = vol.sfx * vol.sfx * 1.45;
    mVolD.gain.setTargetAtTime(m, t, 0.03); mVolW.gain.setTargetAtTime(m, t, 0.03);
    sVolD.gain.setTargetAtTime(s, t, 0.03); sVolW.gain.setTargetAtTime(s, t, 0.03);
  }
  function applyFilter() {
    if (!ok) return;
    const t = ac.currentTime;
    const f = muffled ? 620 : focusOn ? 780 : 20000;
    lp.frequency.cancelScheduledValues(t);
    lp.frequency.setTargetAtTime(f, t, f < 5000 ? 0.07 : 0.12);
    master.gain.setTargetAtTime(muffled ? 0.45 : 0.85, t, 0.1);
  }

  /* --------------------------------------------------------------- voices */
  function osc(type, f, t, dur, peak, o) {
    o = o || {};
    const os = ac.createOscillator(); os.type = type;
    os.frequency.setValueAtTime(Math.max(1, f), t);
    if (o.f2) os.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.glide || dur));
    if (o.detune) os.detune.value = o.detune;
    const g = ac.createGain();
    const a = o.attack || 0.004;
    peak = Math.max(0.0002, peak);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    if (o.cut) {
      const fl = ac.createBiquadFilter(); fl.type = 'lowpass';
      fl.frequency.setValueAtTime(o.cut, t);
      if (o.cut2) fl.frequency.exponentialRampToValueAtTime(o.cut2, t + dur);
      fl.Q.value = o.q || 1;
      os.connect(fl); fl.connect(g);
    } else os.connect(g);
    g.connect(o.dest || sWet);
    os.start(t); os.stop(t + a + dur + 0.06);
    return os;
  }

  function noise(t, dur, peak, o) {
    o = o || {};
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
    f.Q.value = o.q || 0.8;
    const g = ac.createGain();
    const a = o.attack || 0.003;
    peak = Math.max(0.0002, peak);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sWet);
    src.start(t, Math.random() * 1.5); src.stop(t + a + dur + 0.06);
  }

  /* two-operator FM: glassy, bell-like — the voice of the pearls */
  function fm(t, f, dur, peak, o) {
    o = o || {};
    const car = ac.createOscillator(), mod = ac.createOscillator();
    const mg = ac.createGain(), g = ac.createGain();
    car.type = 'sine'; mod.type = 'sine';
    car.frequency.setValueAtTime(f, t);
    mod.frequency.setValueAtTime(f * (o.ratio || 2), t);
    const idx = (o.index === undefined ? 1.6 : o.index) * f;
    mg.gain.setValueAtTime(Math.max(0.01, idx), t);
    mg.gain.exponentialRampToValueAtTime(Math.max(0.01, idx * 0.03), t + dur * 0.7);
    mod.connect(mg); mg.connect(car.frequency);
    const a = o.attack || 0.002;
    peak = Math.max(0.0002, peak);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    car.connect(g); g.connect(o.dest || sWet);
    car.start(t); mod.start(t);
    car.stop(t + a + dur + 0.06); mod.stop(t + a + dur + 0.06);
  }

  /* ------------------------------------------------------------------ sfx */
  const SFX = {
    paddle(t, note) {
      osc('sine', 190, t, 0.13, 0.4, { f2: 78, dest: sDry });
      osc('triangle', mtof(note || 48), t, 0.24, 0.17);
      noise(t, 0.03, 0.1, { type: 'highpass', f: 3200, dest: sDry });
    },
    pulse(t, note) {
      const n = note || 72;
      fm(t, mtof(n), 0.55, 0.22, { ratio: 2, index: 2.2 });
      fm(t + 0.05, mtof(n + 7), 0.6, 0.18, { ratio: 2, index: 1.8 });
      osc('sine', 280, t, 0.2, 0.26, { f2: 1500 });
      noise(t, 0.13, 0.18, { type: 'bandpass', f: 1100, f2: 5200, q: 1.2 });
      osc('sine', 130, t, 0.17, 0.4, { f2: 55, dest: sDry });
    },
    pulse0(t) {
      noise(t, 0.08, 0.09, { type: 'bandpass', f: 700, f2: 1900, q: 1 });
      osc('sine', 250, t, 0.07, 0.09, { f2: 380 });
    },
    wall(t) { osc('sine', 540, t, 0.05, 0.1, { f2: 430 }); },
    launch(t) {
      osc('sine', 220, t, 0.2, 0.28, { f2: 900 });
      noise(t, 0.16, 0.1, { type: 'bandpass', f: 600, f2: 3200 });
    },
    stone(t) {
      noise(t, 0.07, 0.3, { type: 'lowpass', f: 1500, f2: 300 });
      osc('triangle', 176, t, 0.09, 0.3, { f2: 110, dest: sDry });
    },
    crack(t) {
      noise(t, 0.12, 0.34, { type: 'lowpass', f: 2400, f2: 240 });
      osc('triangle', 130, t, 0.14, 0.34, { f2: 70, dest: sDry });
    },
    steel(t) {
      osc('square', 1890, t, 0.09, 0.04);
      osc('square', 2815, t, 0.07, 0.03);
      osc('sine', 945, t, 0.16, 0.1);
    },
    explode(t, big) {
      const v = big ? 1 : 0.72;
      noise(t, 0.55, 0.52 * v, { type: 'lowpass', f: 2800, f2: 80 });
      osc('sine', 135, t, 0.5, 0.6 * v, { f2: 30, dest: sDry });
      noise(t, 0.09, 0.22 * v, { type: 'highpass', f: 2200 });
    },
    zap(t) {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      const g = ac.createGain(), f = ac.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 650;
      for (let i = 0; i < 10; i++) o.frequency.setValueAtTime(320 + Math.random() * 2400, t + i * 0.022);
      g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(f); f.connect(g); g.connect(sWet);
      o.start(t); o.stop(t + 0.28);
      noise(t, 0.2, 0.2, { type: 'highpass', f: 4200 });
    },
    stun(t) {
      const o = ac.createOscillator(); o.type = 'square';
      const g = ac.createGain();
      for (let i = 0; i < 8; i++) o.frequency.setValueAtTime(140 + Math.random() * 500, t + i * 0.03);
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g); g.connect(sWet); o.start(t); o.stop(t + 0.3);
      osc('sine', 300, t, 0.3, 0.3, { f2: 90, dest: sDry });
    },
    oyster(t) {
      fm(t, 784, 0.5, 0.2, { ratio: 2, index: 1.4 });
      fm(t + 0.09, 1175, 0.7, 0.2, { ratio: 2, index: 1.4 });
    },
    gold(t) {
      const fs = [1568, 2093, 2637];
      for (let i = 0; i < 3; i++) fm(t + i * 0.055, fs[i], 0.32, 0.15, { ratio: 3, index: 1.1 });
    },
    ink(t) {
      osc('sine', 330, t, 0.32, 0.32, { f2: 66 });
      noise(t, 0.4, 0.22, { type: 'lowpass', f: 520, f2: 110 });
    },
    jelly(t) {
      osc('sine', 520, t, 0.22, 0.2, { f2: 230 });
      osc('sine', 780, t + 0.03, 0.16, 0.08, { f2: 340 });
    },
    phantom(t) { fm(t, 1046, 0.45, 0.18, { ratio: 1.5, index: 2 }); },
    hot(t) {
      osc('sawtooth', 96, t, 0.16, 0.22, { f2: 250, cut: 900 });
      noise(t, 0.16, 0.12, { type: 'bandpass', f: 900, f2: 2600 });
    },
    laser(t) { osc('sawtooth', 1500, t, 0.07, 0.09, { f2: 420, cut: 5000 }); },
    shot(t) { noise(t, 0.04, 0.1, { type: 'highpass', f: 2600 }); },
    net(t) {
      osc('triangle', 300, t, 0.3, 0.3, { f2: 640 });
      osc('sine', 150, t, 0.2, 0.3, { f2: 85, dest: sDry });
      fm(t + 0.04, 880, 0.4, 0.12, { ratio: 2, index: 1 });
    },
    stick(t) { osc('sine', 300, t, 0.09, 0.2, { f2: 160 }); noise(t, 0.05, 0.08, { type: 'lowpass', f: 900 }); },
    capGood(t) {
      const s = [0, 4, 7, 12];
      for (let i = 0; i < 4; i++) fm(t + i * 0.055, mtof(76 + s[i]), 0.36, 0.19, { ratio: 2, index: 1.1 });
    },
    capBad(t) {
      osc('sawtooth', 300, t, 0.32, 0.22, { f2: 130, cut: 1800 });
      osc('sawtooth', 320, t + 0.02, 0.32, 0.19, { f2: 118, cut: 1800 });
    },
    life(t) {
      const s = [0, 7, 12, 16, 19];
      for (let i = 0; i < 5; i++) fm(t + i * 0.07, mtof(72 + s[i]), 0.55, 0.15, { ratio: 2, index: 1 });
    },
    arm(t) { osc('square', 660, t, 0.06, 0.09); osc('square', 990, t + 0.07, 0.09, 0.09); },
    lost(t) {
      osc('sine', 420, t, 0.9, 0.36, { f2: 48 });
      noise(t, 0.9, 0.28, { type: 'lowpass', f: 1800, f2: 70 });
      osc('sine', 72, t + 0.1, 0.6, 0.5, { f2: 30, dest: sDry });
    },
    sonarOn(t) {
      for (let i = 0; i < 3; i++) osc('sine', 1480, t + i * 0.27, 0.5, 0.2 / (i * 1.7 + 1));
      noise(t, 0.45, 0.14, { type: 'lowpass', f: 3200, f2: 180 });
    },
    sonarOff(t) { noise(t, 0.26, 0.22, { type: 'lowpass', f: 300, f2: 2800 }); },
    lock(t) { osc('sine', 1760, t, 0.12, 0.14); osc('sine', 2349, t + 0.1, 0.22, 0.14); },
    clear(t, root) {
      const r = (root || 60) + 12, s = [0, 4, 7, 12, 16, 19, 24];
      for (let i = 0; i < s.length; i++) fm(t + i * 0.085, mtof(r + s[i]), 0.8, 0.16, { ratio: 2, index: 1.2 });
      const ch = [0, 7, 16];
      for (let i = 0; i < 3; i++) osc('triangle', mtof(r - 12 + ch[i]), t + 0.6, 1.6, 0.1, { attack: 0.05 });
      noise(t + 0.55, 1.2, 0.08, { type: 'highpass', f: 6000 });
    },
    over(t, root) {
      const r = (root || 60), s = [12, 10, 7, 3, 0];
      for (let i = 0; i < s.length; i++) osc('triangle', mtof(r + s[i]), t + i * 0.3, 0.9, 0.14, { attack: 0.02 });
      osc('sine', mtof(r - 24), t + 1.3, 2.4, 0.4, { attack: 0.2, dest: sDry });
      noise(t, 2.6, 0.12, { type: 'lowpass', f: 900, f2: 90, attack: 0.5 });
    },
    win(t, root) {
      const r = (root || 61) + 12, s = [0, 4, 7, 12, 7, 12, 16, 19, 24, 28];
      for (let i = 0; i < s.length; i++) fm(t + i * 0.12, mtof(r + s[i]), 1.2, 0.15, { ratio: 2, index: 1.2 });
      const ch = [0, 4, 7, 12];
      for (let i = 0; i < 4; i++) osc('triangle', mtof(r - 12 + ch[i]), t + 1.1, 3.4, 0.09, { attack: 0.3 });
    },
    perk(t) {
      fm(t, 659, 0.5, 0.18, { ratio: 2, index: 1 });
      fm(t + 0.1, 988, 0.8, 0.18, { ratio: 2, index: 1 });
      fm(t + 0.2, 1319, 1.0, 0.14, { ratio: 2, index: 0.8 });
    },
    hover(t) { osc('sine', 1700, t, 0.025, 0.035, { dest: sDry }); },
    click(t) { osc('sine', 880, t, 0.07, 0.13, { f2: 1320, dest: sDry }); },
    tick(t) { osc('sine', 1250, t, 0.02, 0.04, { dest: sDry }); },
    warn(t) {
      osc('square', 196, t, 0.2, 0.15, { cut: 1400 });
      osc('square', 196, t + 0.28, 0.2, 0.15, { cut: 1400 });
    },
    roar(t) {
      osc('sawtooth', 74, t, 1.5, 0.4, { f2: 40, cut: 520, cut2: 160, attack: 0.15 });
      osc('sawtooth', 77, t, 1.5, 0.3, { f2: 43, cut: 420, cut2: 140, attack: 0.15 });
      noise(t, 1.5, 0.3, { type: 'lowpass', f: 420, f2: 70, attack: 0.2 });
    },
    bossHit(t) {
      fm(t, 148, 0.34, 0.4, { ratio: 1.41, index: 5 });
      noise(t, 0.1, 0.26, { type: 'bandpass', f: 950, q: 0.8 });
    },
    clang(t) { fm(t, 430, 0.22, 0.16, { ratio: 2.76, index: 3.5 }); },
    bossDie(t) {
      osc('sawtooth', 110, t, 2.6, 0.4, { f2: 28, cut: 700, cut2: 90, attack: 0.05 });
      noise(t, 2.6, 0.4, { type: 'lowpass', f: 3000, f2: 60 });
    },
    dive(t, dur) {
      const d = dur || 2.4;
      noise(t, d, 0.22, { type: 'bandpass', f: 260, f2: 1700, q: 0.7, attack: d * 0.35 });
      osc('sine', 96, t, d, 0.26, { f2: 44, attack: d * 0.3, dest: sDry });
    },
    vent(t) { noise(t, 1.5, 0.26, { type: 'bandpass', f: 420, f2: 2400, q: 0.6, attack: 0.25 }); },
    drop(t) { osc('sine', 900, t, 0.1, 0.07, { f2: 1500 }); },
    shift(t) {
      osc('sawtooth', 60, t, 0.5, 0.3, { f2: 44, cut: 300 });
      noise(t, 0.4, 0.2, { type: 'lowpass', f: 400, f2: 90 });
    },
  };
  const GAPS = { explode: 0.07, zap: 0.06, wall: 0.04, steel: 0.05, stone: 0.04, laser: 0.05, shot: 0.04, hover: 0.04, capGood: 0.08, bossHit: 0.06, clang: 0.06, crack: 0.04 };
  const UI_SOUNDS = { hover: 1, click: 1, perk: 1, tick: 1 };

  function play(name, a, b) {
    if (!ok || ac.state !== 'running') return;
    if (quiet && !UI_SOUNDS[name]) return;
    const now = ac.currentTime;
    const gap = GAPS[name] || 0.02;
    if (now - (last[name] || -1) < gap) return;
    last[name] = now;
    const f = SFX[name];
    if (f) { try { f(now, a, b); } catch (e) { /* never let audio break the game */ } }
  }

  /* brick hits climb the current scale as the chain grows */
  function brick(chain) {
    if (!ok || quiet || ac.state !== 'running') return;
    const now = ac.currentTime;
    if (now - (last.brick || -1) < 0.034) return;
    last.brick = now;
    const s = Music.song || SONGS.sun, sc = s.scale;
    let i = Math.max(0, chain - 1);
    if (i > 11) i = 8 + (i % 4);
    const note = s.lead + sc[i % sc.length] + 12 * Math.floor(i / sc.length);
    try { fm(now, mtof(note), 0.42, 0.26, { ratio: 2, index: 1.5 }); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------- music */
  const SONGS = {
    sun: {
      bpm: 104, root: 60, lead: 72, scale: [0, 2, 4, 7, 9], bars: 2,
      chords: [[0, 4, 7, 11, 14], [-3, 0, 4, 7, 11], [-7, -3, 0, 4, 7], [-5, -1, 2, 7, 9]],
      padCut: 1500, padVol: 0.026,
      arp: [0, 2, 1, 3, 2, 4, 3, 1], arpDiv: 2, arpWave: 'triangle', arpLen: 0.3, arpVol: 0.075, arpOct: 12, arpProb: 0.85,
      bassPat: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0], bassVol: 0.2, bassLen: 3,
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1], drum: 1,
    },
    twi: {
      bpm: 94, root: 62, lead: 74, scale: [0, 3, 5, 7, 10], bars: 2,
      chords: [[0, 3, 7, 10, 14], [-4, 0, 3, 7, 10], [-7, -4, 0, 3, 7], [-5, -2, 2, 5, 12]],
      padCut: 1200, padVol: 0.03,
      arp: [0, -1, 2, -1, 3, 1, -1, 4, 2, -1, 3, -1, 1, 2, -1, 0], arpDiv: 2, arpWave: 'sine', arpLen: 0.45, arpVol: 0.09, arpOct: 12, arpProb: 0.9,
      bassPat: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0], bassVol: 0.22, bassLen: 3,
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], drum: 0.85, whale: 0.1,
    },
    mid: {
      bpm: 84, root: 57, lead: 69, scale: [0, 3, 5, 7, 10], bars: 2,
      chords: [[0, 3, 7, 10, 14], [-7, -4, 0, 3, 7], [-4, 0, 3, 7, 10], [-5, -2, 2, 5, 7]],
      padCut: 820, padVol: 0.034,
      arp: [0, 3, 2, 4, 1, 3, 2, 0], arpDiv: 2, arpWave: 'fm', fmRatio: 2, arpLen: 0.7, arpVol: 0.065, arpOct: 12, arpProb: 0.4,
      bassPat: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], bassVol: 0.23, bassLen: 5,
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0], drum: 0.75, ping: true, whale: 0.08,
    },
    aby: {
      bpm: 76, root: 52, lead: 64, scale: [0, 3, 5, 7, 10], bars: 2,
      chords: [[0, 7, 12, 15, 19], [1, 8, 12, 17, 20], [0, 7, 12, 15, 22], [-2, 5, 10, 13, 17]],
      padCut: 620, padVol: 0.04,
      arp: [4, -1, -1, 2, -1, -1, 3, -1, -1, -1, 1, -1, -1, 2, -1, -1], arpDiv: 2, arpWave: 'fm', fmRatio: 3, arpLen: 1.1, arpVol: 0.055, arpOct: 0, arpProb: 0.7,
      bassPat: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], bassVol: 0.26, bassLen: 10,
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      hat: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0], drum: 0.7, ping: true, whale: 0.14,
    },
    had: {
      bpm: 116, root: 61, lead: 73, scale: [0, 3, 5, 7, 10], bars: 2,
      chords: [[0, 3, 7, 10, 15], [-4, 0, 3, 8, 12], [3, 7, 10, 15, 19], [-2, 2, 5, 10, 14]],
      padCut: 900, padVol: 0.03,
      arp: [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 4, 2, 3, 2, 1, 2], arpDiv: 1, arpWave: 'sawtooth', arpLen: 0.16, arpVol: 0.036, arpOct: 0, arpProb: 1, arpCut: 1900,
      bassPat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1], bassVol: 0.19, bassLen: 1.6,
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], drum: 1.05,
    },
  };
  // boss themes: the zone's harmony, pushed harder
  SONGS.boss1 = Object.assign({}, SONGS.twi, {
    bpm: 122, arp: [0, 2, 4, 2, 3, 1, 2, 4, 0, 3, 2, 4, 1, 3, 2, 0], arpDiv: 1, arpLen: 0.2, arpVol: 0.07, arpProb: 1,
    bassPat: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], bassLen: 1.8,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], drum: 1.1, whale: 0,
  });
  SONGS.boss2 = Object.assign({}, SONGS.mid, {
    bpm: 110, padCut: 700, arp: [0, 3, 2, 3, 4, 3, 2, 3], arpDiv: 1, arpLen: 0.3, arpVol: 0.05, arpProb: 0.75,
    bassPat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], bassLen: 1.6, bassVol: 0.2,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], drum: 1, whale: 0, ping: false,
  });
  SONGS.boss3 = Object.assign({}, SONGS.had, {
    bpm: 134, arpVol: 0.042, arpCut: 2400, drum: 1.2,
    snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
  });

  function pad(t, notes, dur, s) {
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6;
    f.frequency.setValueAtTime(s.padCut * 0.55, t);
    f.frequency.linearRampToValueAtTime(s.padCut, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(s.padCut * 0.55, t + dur);
    const g = ac.createGain();
    const a = Math.min(1.1, dur * 0.3), r = 1.7;
    g.gain.setValueAtTime(0.0001, t);
    const pv = s.padVol * 1.25;
    g.gain.linearRampToValueAtTime(pv, t + a);
    g.gain.setValueAtTime(pv, t + Math.max(a, dur - 0.2));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + r);
    f.connect(g); g.connect(mWet);
    for (let i = 0; i < notes.length; i++) {
      for (let d = -1; d <= 1; d += 2) {
        const o = ac.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = mtof(notes[i]); o.detune.value = d * 7;
        o.connect(f); o.start(t); o.stop(t + dur + r + 0.1);
      }
    }
  }
  function pluck(t, note, v, s) {
    const f = mtof(note);
    if (s.arpWave === 'fm') fm(t, f, s.arpLen, v, { ratio: s.fmRatio || 2, index: 1.3, dest: mEcho });
    else osc(s.arpWave, f, t, s.arpLen, v, { dest: mEcho, cut: s.arpCut || 0, cut2: s.arpCut ? s.arpCut * 0.4 : 0, q: 3 });
  }
  function bass(t, note, len, v) {
    osc('sine', mtof(note), t, len, v, { dest: mDry, attack: 0.012 });
    osc('triangle', mtof(note), t, len * 0.8, v * 0.3, { dest: mDry, attack: 0.012 });
  }
  function kick(t, v) { osc('sine', 150, t, 0.24, v, { f2: 42, glide: 0.12, dest: mDry, attack: 0.002 }); }
  function hat(t, v) { noise(t, 0.03, v, { type: 'highpass', f: 7200, dest: mDry }); }
  function snare(t, v) {
    noise(t, 0.14, v, { type: 'bandpass', f: 1800, q: 0.7, dest: mWet });
    osc('triangle', 190, t, 0.08, v * 0.6, { f2: 120, dest: mDry });
  }
  function whale(t) {
    const o = ac.createOscillator(); o.type = 'sine';
    const g = ac.createGain();
    const f0 = 130 + Math.random() * 90;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * 1.5, t + 1.1);
    o.frequency.linearRampToValueAtTime(f0 * 0.82, t + 2.6);
    const l = ac.createOscillator(); l.frequency.value = 5;
    const lg = ac.createGain(); lg.gain.value = 4;
    l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + 2.8);
    o.connect(g); g.connect(mEcho);
    o.start(t); l.start(t); o.stop(t + 3); l.stop(t + 3);
  }

  const Music = {
    song: null, id: null, pending: null, on: false,
    step: 0, nextT: 0, I: 0.2, targetI: 0.2, timer: 0, beats: [], lastBeat: -10,

    play(id) {
      if (!SONGS[id]) return;
      if (!ok) { this.pending = id; return; }
      if (this.on && this.id === id) return;
      this.id = id; this.song = SONGS[id];
      this.step = 0; this.nextT = ac.currentTime + 0.12; this.on = true;
      this.beats.length = 0;
      try { delayNode.delayTime.setTargetAtTime(60 / this.song.bpm * 0.75, ac.currentTime, 0.05); } catch (e) { /* ignore */ }
      if (!this.timer) this.timer = setInterval(() => this.tick(), 30);
    },
    stop() { this.on = false; this.id = null; },
    tick() {
      if (!ok || !this.on || ac.state !== 'running') return;
      this.I += (this.targetI - this.I) * 0.06;
      const s = this.song, sd = 60 / s.bpm / 4;
      const now = ac.currentTime;
      if (this.nextT < now - 0.3) this.nextT = now + 0.05;      // resync after a stall
      let guard = 0;
      while (this.nextT < now + 0.14 && guard++ < 12) {
        try { this.schedule(this.step, this.nextT, s, sd); } catch (e) { /* ignore */ }
        this.step++; this.nextT += sd;
      }
    },
    schedule(step, t, s, sd) {
      const st = step % 16, bar = Math.floor(step / 16);
      const ci = Math.floor(bar / s.bars) % s.chords.length;
      const ch = s.chords[ci], I = this.I;
      if (st % 4 === 0) this.beats.push(t);

      if (st === 0 && bar % s.bars === 0) {
        pad(t, [s.root + ch[0] - 12, s.root + ch[1], s.root + ch[2], s.root + ch[3]], s.bars * 16 * sd, s);
      }
      if (I > 0.3 && s.bassPat[st]) {
        bass(t, s.root + ch[0] - 24, sd * s.bassLen, s.bassVol * clamp((I - 0.3) * 2.5 + 0.35, 0, 1));
      }
      if (st % s.arpDiv === 0 && I > 0.06) {
        const k = (step / s.arpDiv) | 0;
        const pi = s.arp[k % s.arp.length];
        if (pi >= 0 && Math.random() < s.arpProb * (0.55 + 0.6 * I)) {
          let note = s.root + ch[pi % ch.length] + s.arpOct;
          if (bar % 4 === 3 && k % 2 === 1) note += 12;
          pluck(t, note, s.arpVol * (0.5 + 0.5 * I) * (st % 4 === 0 ? 1 : 0.8), s);
        }
      }
      if (I > 0.5 && s.hat[st]) hat(t, 0.045 * s.drum * (st % 4 === 2 ? 1 : 0.6));
      if (I > 0.62 && s.kick[st]) kick(t, 0.4 * s.drum);
      if (I > 0.8 && s.snare[st]) snare(t, 0.15 * s.drum);

      if (st === 6 && s.ping && bar % 4 === 0) osc('sine', 1318, t, 1.3, 0.045, { dest: mEcho });
      if (st === 8 && s.whale && Math.random() < s.whale) whale(t);
    },
  };

  /* ------------------------------------------------------------------ api */
  return {
    init,
    get ok() { return ok; },
    resume() { if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* ignore */ } } },
    suspend() { if (ac && ac.state === 'running') { try { ac.suspend(); } catch (e) { /* ignore */ } } },
    setVolume(kind, v) { vol[kind] = clamp(v, 0, 1); applyVol(); },
    getVolume(kind) { return vol[kind]; },
    quiet(q) { quiet = !!q; },
    focus(on) { if (focusOn !== !!on) { focusOn = !!on; applyFilter(); } },
    muffle(on) { if (muffled !== !!on) { muffled = !!on; applyFilter(); } },
    play, brick,
    music(id) { Music.play(id); },
    stopMusic() { Music.stop(); },
    intensity(v) { Music.targetI = clamp(v, 0, 1); },
    get root() { return Music.song ? Music.song.root : 60; },
    /* 1 on the beat, decaying toward 0 — drives small visual pulses */
    pulse() {
      if (!ok || !Music.on || ac.state !== 'running') {
        const ph = (wallClock() * 1.6) % 1;
        return Math.exp(-ph * 4);
      }
      const now = ac.currentTime, q = Music.beats;
      while (q.length && q[0] <= now) Music.lastBeat = q.shift();
      return Math.exp(-(now - Music.lastBeat) * 5);
    },
  };
})();
