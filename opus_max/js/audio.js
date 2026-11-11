/* SHATTERWAVE — audio: procedural soundtrack + synthesized effects (WebAudio, no samples) */
'use strict';
SW.audio = (function () {
  const A = { ready: false, muted: SW.store.get('muted', false) };
  let ctx = null, master, comp, musicBus, musicFilter, musicDuck, sfxBus, mDelaySend, mDelay, sDelaySend, noiseBuf, distCurve;
  let voices = 0;
  const lastPlay = Object.create(null);

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const MINOR = [0, 2, 3, 5, 7, 8, 10];
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const PENTA = [0, 3, 5, 7, 10];

  function makeDelay(dest, time, fb, wet, tone) {
    const send = ctx.createGain();
    const d = ctx.createDelay(2);
    d.delayTime.value = time;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = tone;
    const g = ctx.createGain(); g.gain.value = fb;
    const w = ctx.createGain(); w.gain.value = wet;
    send.connect(d); d.connect(f); f.connect(g); g.connect(d); f.connect(w); w.connect(dest);
    return { send, delay: d };
  }

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.18;
    master = ctx.createGain();
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 18000; musicFilter.Q.value = 0.7;
    musicDuck = ctx.createGain();
    musicBus.connect(musicFilter); musicFilter.connect(musicDuck); musicDuck.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    const md = makeDelay(musicBus, 0.4, 0.38, 0.32, 2600); mDelaySend = md.send; mDelay = md.delay;
    const sd = makeDelay(sfxBus, 0.18, 0.3, 0.28, 3800); sDelaySend = sd.send;
    // noise
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; distCurve[i] = Math.tanh(x * 4); }
    A.ready = true;
    A.ctx = ctx;
    A.applyVolumes();
    seq.timer = setInterval(scheduler, 25);
  };

  A.applyVolumes = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(A.muted ? 0 : 0.9, t, 0.03);
    const m = SW.settings.music / 100, s = SW.settings.sfx / 100;
    musicBus.gain.setTargetAtTime(m * m * 0.55, t, 0.05);
    sfxBus.gain.setTargetAtTime(s * s * 0.9, t, 0.05);
  };
  A.toggleMute = function () { A.muted = !A.muted; SW.store.set('muted', A.muted); A.applyVolumes(); return A.muted; };
  A.suspend = function () { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); };
  A.now = () => (ctx ? ctx.currentTime : 0);

  /* ---------- primitive voices ---------- */
  function tone(type, f, t, dur, vol, dest, o = {}) {
    if (voices > 64) return null;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + (o.slideTime || dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const a = o.attack || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
    if (o.hold) g.gain.setValueAtTime(vol, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.filter) {
      const fl = ctx.createBiquadFilter(); fl.type = o.filter; fl.frequency.value = o.ff || 2000; fl.Q.value = o.q || 0.8;
      if (o.fenv) { fl.frequency.setValueAtTime(o.fenv[0], t); fl.frequency.exponentialRampToValueAtTime(o.fenv[1], t + (o.fenvTime || dur)); }
      osc.connect(fl); node = fl;
    }
    node.connect(g); g.connect(dest);
    if (o.send) g.connect(o.send);
    osc.start(t); osc.stop(t + dur + 0.05);
    voices++; osc.onended = () => { voices--; };
    return osc;
  }
  function noise(t, dur, vol, dest, ftype, f, o = {}) {
    if (voices > 64) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = ftype; fl.frequency.value = f; fl.Q.value = o.q || 0.9;
    if (o.sweep) { fl.frequency.setValueAtTime(o.sweep[0], t); fl.frequency.exponentialRampToValueAtTime(o.sweep[1], t + dur); }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(dest);
    if (o.send) g.connect(o.send);
    src.start(t, Math.random() * 1.5, dur + 0.05);
    voices++; src.onended = () => { voices--; };
  }

  /* ---------- music ---------- */
  const TRACKS = {
    menu:    { bpm: 92,  root: 45, scale: MINOR, prog: [0, 5, 2, 6], kick: '', snare: '', hat: '..x...x...x...x.', bass: 'x.......x.......', arp: 'x.xxx.xxx.xxx.x.', arpSeq: [0, 2, 4, 1, 3, 5, 4, 2], lead: 'tri', pad: 1 },
    s1:      { bpm: 112, root: 45, scale: MINOR, prog: [0, 5, 2, 6], kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'x.xo.xx.x.xo.x5.', arp: 'xxxxxxxxxxxxxxxx', arpSeq: [0, 1, 2, 3, 4, 3, 2, 1], lead: 'square', pad: 0.8 },
    s2:      { bpm: 118, root: 50, scale: MINOR, prog: [0, 3, 5, 4], kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', bass: 'x..x..x.o..x..5.', arp: 'x.xx.xx.x.xx.xx.', arpSeq: [0, 2, 1, 3, 2, 4, 3, 5], lead: 'tri', pad: 1 },
    s3:      { bpm: 128, root: 52, scale: MINOR, prog: [0, 6, 5, 6], kick: 'x...x...x...x..x', snare: '....x.......x...', hat: '.xx..xx..xx..xx.', bass: 'xxoxxxoxxxoxxxox', arp: 'x.x.x.x.x.x.x.x.', arpSeq: [0, 1, 2, 5, 4, 3, 2, 1], lead: 'saw', pad: 0.7 },
    boss:    { bpm: 140, root: 48, scale: MINOR, prog: [0, 0, 5, 6], kick: 'x..x..x...x..x..', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', bass: 'xxoxx5xxxxoxx5xo', arp: 'x.x.x.x.xxx.x.x.', arpSeq: [0, 3, 1, 4, 2, 5, 1, 3], lead: 'saw', pad: 0.6 },
    endless: { bpm: 124, root: 47, scale: MINOR, prog: [0, 6, 5, 3], kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..xx..xx..xx..xx', bass: 'x.o.x.o.x.o.x5o.', arp: 'xxx.xxx.xxx.xxx.', arpSeq: [0, 2, 4, 2, 1, 3, 5, 3], lead: 'square', pad: 0.8 },
    victory: { bpm: 104, root: 48, scale: MAJOR, prog: [0, 4, 5, 3], kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.', bass: 'x...x...x...x...', arp: 'xxxxxxxxxxxxxxxx', arpSeq: [0, 1, 2, 3, 4, 5, 4, 3], lead: 'tri', pad: 1 },
  };
  const seq = { track: null, name: '', pending: null, step: 0, bar: 0, nextTime: 0, timer: null, intensity: 1, chord: [0, 3, 7], chordRoot: 45 };

  function chordOf(tr, degree) {
    const sc = tr.scale, out = [];
    for (let k = 0; k < 3; k++) { const d = degree + k * 2; out.push(sc[d % 7] + 12 * Math.floor(d / 7)); }
    return out;
  }
  function scheduleStep(step, t) {
    const tr = seq.track; if (!tr) return;
    const spb = 60 / tr.bpm / 4;
    const deg = tr.prog[seq.bar % tr.prog.length];
    const ch = chordOf(tr, deg);
    seq.chord = ch; seq.chordRoot = tr.root + ch[0];
    const I = seq.intensity;
    const bus = musicBus;
    const fill = seq.bar % 4 === 3 && step >= 12;
    // drums
    if (I >= 1 && tr.kick[step] === 'x' && !(fill && step > 12)) {
      tone('sine', 150, t, 0.34, 0.95, bus, { slide: 44, slideTime: 0.11 });
      noise(t, 0.015, 0.25, bus, 'highpass', 2500);
    }
    if (I >= 1 && (tr.snare[step] === 'x' || (fill && step % 2 === 1 && I >= 1))) {
      noise(t, 0.16, fill ? 0.22 : 0.38, bus, 'bandpass', 1900, { q: 0.6 });
      tone('triangle', 200, t, 0.09, 0.22, bus, { slide: 140 });
    }
    const hatOn = tr.hat[step] === 'x' || (I >= 2 && step % 2 === 0);
    if (hatOn) noise(t, step % 4 === 2 ? 0.07 : 0.035, I === 0 ? 0.07 : 0.13, bus, 'highpass', 7800);
    // bass
    const b = tr.bass[step];
    if (I >= 1 && b && b !== '.') {
      let n = tr.root + ch[0];
      if (b === 'o') n += 12; else if (b === '5') n += 7;
      const f = mtof(n);
      const bright = I >= 2 ? 1700 : 950;
      tone('sawtooth', f, t, spb * 1.8, 0.26, bus, { filter: 'lowpass', fenv: [bright, 160], fenvTime: spb * 1.6, q: 4 });
      tone('square', f / 2, t, spb * 1.8, 0.14, bus, { filter: 'lowpass', ff: 300 });
    } else if (I === 0 && b === 'x') {
      tone('triangle', mtof(tr.root + ch[0]), t, spb * 7, 0.22, bus, { attack: 0.05 });
    }
    // arp
    if (tr.arp[step] === 'x') {
      const notes = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12, ch[2] + 12];
      const idx = tr.arpSeq[(seq.bar * 16 + step) % tr.arpSeq.length];
      const n = tr.root + 24 + notes[idx % notes.length];
      const type = tr.lead === 'tri' ? 'triangle' : tr.lead === 'saw' ? 'sawtooth' : 'square';
      const vol = (type === 'triangle' ? 0.16 : 0.07) * (I === 0 ? 0.8 : 1);
      tone(type, mtof(n), t, spb * 1.5, vol, bus, { filter: 'lowpass', fenv: [I >= 2 ? 5200 : 3200, 700], fenvTime: spb * 1.4, send: mDelaySend });
    }
    // pad
    if (step === 0 && tr.pad) {
      const dur = spb * 16;
      for (let k = 0; k < 3; k++) {
        const f = mtof(tr.root + 12 + ch[k] + (k === 0 ? 12 : 0));
        for (const dt of [-9, 8]) tone('sawtooth', f, t, dur * 1.05, 0.032 * tr.pad, bus, { attack: 0.45, hold: dur * 0.55, detune: dt, filter: 'lowpass', ff: I >= 2 ? 1600 : 900 });
      }
    }
  }
  function scheduler() {
    if (!ctx || !seq.track || ctx.state !== 'running') return;
    if (seq.nextTime < ctx.currentTime - 0.1) {
      const spb = 60 / seq.track.bpm / 4, skip = Math.ceil((ctx.currentTime + 0.05 - seq.nextTime) / spb);
      seq.nextTime += skip * spb; seq.step += skip; seq.bar += Math.floor(seq.step / 16); seq.step %= 16;
    }
    while (seq.nextTime < ctx.currentTime + 0.12) {
      scheduleStep(seq.step, seq.nextTime);
      seq.nextTime += 60 / seq.track.bpm / 4;
      seq.step++;
      if (seq.step >= 16) {
        seq.step = 0; seq.bar++;
        if (seq.pending) { setTrack(seq.pending, seq.nextTime); seq.pending = null; }
      }
    }
  }
  function setTrack(name, t0) {
    seq.track = TRACKS[name]; seq.name = name; seq.bar = 0; seq.step = 0; seq.t0 = t0;
    mDelay.delayTime.setTargetAtTime((60 / seq.track.bpm) * 0.75, ctx.currentTime, 0.05);
  }
  A.music = function (name) {
    if (!ctx || !TRACKS[name]) return;
    if (seq.name === name && !seq.pending) return;
    if (!seq.track) { seq.nextTime = ctx.currentTime + 0.08; setTrack(name, seq.nextTime); }
    else seq.pending = name;
    seq.name = name;
  };
  A.stopMusic = function () { seq.track = null; seq.name = ''; seq.pending = null; };
  A.intensity = function (n) { seq.intensity = n; };
  A.muffle = function (on) { if (ctx) musicFilter.frequency.setTargetAtTime(on ? 700 : 18000, ctx.currentTime, 0.12); };
  A.duck = function (amount = 0.4, time = 0.5) {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicDuck.gain.cancelScheduledValues(t);
    musicDuck.gain.setValueAtTime(musicDuck.gain.value, t);
    musicDuck.gain.linearRampToValueAtTime(amount, t + 0.03);
    musicDuck.gain.linearRampToValueAtTime(1, t + time);
  };
  A.beatPhase = function () {
    if (!ctx || !seq.track) return 0;
    const spb = 60 / seq.track.bpm;
    const p = ((ctx.currentTime - (seq.t0 || 0)) % spb) / spb;
    return p < 0 ? p + 1 : p;
  };
  A.bpm = () => (seq.track ? seq.track.bpm : 100);
  A.keyRoot = () => (seq.track ? seq.track.root : 45);

  /* ---------- sound effects ---------- */
  function gate(name, ms) {
    const now = performance.now();
    if (lastPlay[name] && now - lastPlay[name] < ms) return false;
    lastPlay[name] = now; return true;
  }
  const S = {
    note(chain, big) { // a brick breaks: the player "plays" the melody
      const i = chain % 11;
      const semi = PENTA[i % 5] + 12 * Math.floor(i / 5);
      const n = A.keyRoot() + 24 + semi;
      const t = ctx.currentTime;
      tone('triangle', mtof(n), t, 0.42, 0.34, sfxBus, { send: sDelaySend });
      tone('sine', mtof(n + 12), t, 0.18, 0.12, sfxBus);
      if (big) tone('square', mtof(n + 7), t, 0.25, 0.05, sfxBus, { filter: 'lowpass', ff: 2600, send: sDelaySend });
    },
    paddle(off) {
      const t = ctx.currentTime, r = seq.chordRoot + 12;
      tone('sine', mtof(r) * (1 + off * 0.06), t, 0.16, 0.5, sfxBus, { slide: mtof(r - 12), slideTime: 0.08 });
      tone('triangle', mtof(r + 19), t, 0.07, 0.12, sfxBus);
      noise(t, 0.03, 0.12, sfxBus, 'bandpass', 3200);
    },
    wall() { if (!gate('wall', 40)) return; tone('sine', 1500, ctx.currentTime, 0.04, 0.07, sfxBus, { slide: 900 }); },
    clank() {
      const t = ctx.currentTime;
      noise(t, 0.09, 0.3, sfxBus, 'bandpass', 2600, { q: 3 });
      tone('square', 320, t, 0.08, 0.1, sfxBus, { slide: 240, filter: 'lowpass', ff: 1500 });
    },
    steel() {
      if (!gate('steel', 50)) return;
      const t = ctx.currentTime;
      tone('square', 1180, t, 0.3, 0.06, sfxBus, { filter: 'bandpass', ff: 2400, q: 6, send: sDelaySend });
      tone('triangle', 1693, t, 0.4, 0.1, sfxBus);
    },
    explode(size = 1) {
      if (!gate('explode', 45)) return;
      const t = ctx.currentTime;
      noise(t, 0.35 + size * 0.25, 0.5 * Math.min(1.4, size), sfxBus, 'lowpass', 2000, { sweep: [3500, 120] });
      tone('sine', 110, t, 0.4 + size * 0.2, 0.6, sfxBus, { slide: 30 });
    },
    laser() { if (!gate('laser', 60)) return; tone('square', 1500, ctx.currentTime, 0.12, 0.06, sfxBus, { slide: 260, filter: 'lowpass', ff: 3000 }); },
    capsule() { tone('sine', 500, ctx.currentTime, 0.14, 0.14, sfxBus, { slide: 1000 }); },
    power(good) {
      const t = ctx.currentTime, r = A.keyRoot() + 24;
      const seqn = good ? [0, 7, 12, 19, 24] : [12, 6, 0, -6];
      seqn.forEach((s, k) => tone(good ? 'square' : 'sawtooth', mtof(r + s), t + k * 0.055, 0.16, good ? 0.08 : 0.07, sfxBus, { filter: 'lowpass', ff: good ? 4000 : 1200, send: sDelaySend }));
    },
    oneup() {
      const t = ctx.currentTime, r = A.keyRoot() + 36;
      [0, 4, 7, 12, 16, 19, 24].forEach((s, k) => tone('triangle', mtof(r + s), t + k * 0.06, 0.3, 0.2, sfxBus, { send: sDelaySend }));
    },
    launch() { tone('triangle', 400, ctx.currentTime, 0.14, 0.2, sfxBus, { slide: 900 }); },
    lose() {
      const t = ctx.currentTime;
      tone('sawtooth', 520, t, 0.9, 0.18, sfxBus, { slide: 50, filter: 'lowpass', ff: 1400 });
      tone('sine', 300, t, 0.9, 0.3, sfxBus, { slide: 40 });
      noise(t, 0.6, 0.25, sfxBus, 'lowpass', 900, { sweep: [2000, 100] });
    },
    clear() {
      const t = ctx.currentTime, r = A.keyRoot() + 24;
      [0, 3, 7, 10, 12, 15, 19, 24].forEach((s, k) => tone('square', mtof(r + s), t + k * 0.07, 0.35, 0.07, sfxBus, { filter: 'lowpass', ff: 3500, send: sDelaySend }));
      [0, 7, 12].forEach((s) => tone('triangle', mtof(r + s), t + 0.56, 1.2, 0.14, sfxBus, { send: sDelaySend }));
    },
    pulseReady() {
      const t = ctx.currentTime, r = A.keyRoot() + 36;
      [0, 7, 12, 19].forEach((s, k) => tone('sine', mtof(r + s), t + k * 0.04, 0.4, 0.1, sfxBus, { send: sDelaySend }));
    },
    pulse() {
      const t = ctx.currentTime;
      noise(t, 0.8, 0.5, sfxBus, 'bandpass', 600, { sweep: [200, 6000], q: 1.2, attack: 0.05 });
      tone('sine', 90, t, 0.9, 0.8, sfxBus, { slide: 28 });
      const r = A.keyRoot() + 12;
      [0, 7, 12, 15].forEach((s) => tone('sawtooth', mtof(r + s), t, 0.7, 0.05, sfxBus, { filter: 'lowpass', fenv: [4000, 300], send: sDelaySend }));
    },
    bumper() { if (!gate('bumper', 40)) return; tone('sine', 280, ctx.currentTime, 0.2, 0.35, sfxBus, { slide: 900, slideTime: 0.08 }); },
    portal() { tone('sine', 300, ctx.currentTime, 0.35, 0.22, sfxBus, { slide: 1400, send: sDelaySend }); },
    shield() { tone('triangle', 900, ctx.currentTime, 0.2, 0.2, sfxBus, { slide: 1800 }); noise(ctx.currentTime, 0.1, 0.12, sfxBus, 'highpass', 4000); },
    stun() {
      const t = ctx.currentTime;
      tone('sawtooth', 90, t, 0.5, 0.25, sfxBus, { filter: 'lowpass', ff: 900 });
      tone('square', 133, t, 0.4, 0.08, sfxBus);
      noise(t, 0.25, 0.25, sfxBus, 'bandpass', 3000, { q: 2 });
    },
    bossHit() {
      if (!gate('bossHit', 50)) return;
      const t = ctx.currentTime;
      tone('square', 180, t, 0.18, 0.18, sfxBus, { slide: 70, filter: 'lowpass', ff: 1200 });
      noise(t, 0.12, 0.3, sfxBus, 'bandpass', 1400, { q: 2 });
    },
    roar() {
      const t = ctx.currentTime;
      const ws = ctx.createWaveShaper(); ws.curve = distCurve;
      const g = ctx.createGain(); g.gain.value = 0.5; ws.connect(g); g.connect(sfxBus);
      for (const d of [-20, 0, 15]) tone('sawtooth', 110, t, 1.3, 0.16, ws, { slide: 38, detune: d, attack: 0.08 });
      noise(t, 1.0, 0.25, sfxBus, 'lowpass', 600, { sweep: [1200, 80] });
    },
    shoot() { if (!gate('shoot', 70)) return; tone('square', 700, ctx.currentTime, 0.18, 0.06, sfxBus, { slide: 220, filter: 'lowpass', ff: 2200 }); },
    tick() { if (!gate('tick', 35)) return; tone('square', 2200, ctx.currentTime, 0.03, 0.035, sfxBus, { filter: 'lowpass', ff: 5000 }); },
    uiMove() { tone('triangle', 1300, ctx.currentTime, 0.05, 0.08, sfxBus); },
    uiSelect() { const t = ctx.currentTime; tone('triangle', 880, t, 0.08, 0.14, sfxBus); tone('triangle', 1320, t + 0.06, 0.12, 0.14, sfxBus, { send: sDelaySend }); },
    crystal() { const t = ctx.currentTime, r = A.keyRoot() + 48; [0, 7, 12].forEach((s, k) => tone('sine', mtof(r + s), t + k * 0.03, 0.5, 0.1, sfxBus, { send: sDelaySend })); },
  };
  A.sfx = function (name, ...args) {
    if (!ctx || A.muted || ctx.state !== 'running' || !S[name]) return;
    if (SW.game && SW.game.demo && name !== 'uiMove' && name !== 'uiSelect') return;
    S[name](...args);
  };
  return A;
})();
