'use strict';
/* ============ SHATTERSONG · audio (everything is synthesised live) ============ */
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const PENT = [0, 3, 5, 7, 10];

const AudioSys = {
  ctx: null, muted: false, spec: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.18;
      const master = ctx.createGain(); master.gain.value = 1.25;
      master.connect(comp); comp.connect(ctx.destination);
      const an = ctx.createAnalyser(); an.fftSize = 128; an.smoothingTimeConstant = 0.8; comp.connect(an);
      this.an = an; this.spec = new Uint8Array(an.frequencyBinCount);

      const musicBus = ctx.createGain(), sfxBus = ctx.createGain();
      musicBus.connect(master); sfxBus.connect(master);

      // reverb (music)
      const rev = ctx.createConvolver(); rev.buffer = this._impulse(ctx, 2.6, 2.6);
      const revIn = ctx.createGain(), revOut = ctx.createGain(); revOut.gain.value = 0.5;
      revIn.connect(rev); rev.connect(revOut); revOut.connect(musicBus);

      // echo (sfx plucks)
      const dl = ctx.createDelay(1.0); dl.delayTime.value = 0.27;
      const fb = ctx.createGain(); fb.gain.value = 0.34;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
      const echoIn = ctx.createGain(), echoOut = ctx.createGain(); echoOut.gain.value = 0.42;
      echoIn.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(echoOut); echoOut.connect(sfxBus);

      // noise source
      const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

      this.ctx = ctx; this.master = master; this.musicBus = musicBus; this.sfxBus = sfxBus;
      this.revIn = revIn; this.echoIn = echoIn; this.noiseBuf = nb;
      this.setVolumes();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (e) { this.ctx = null; }
  },

  _impulse(ctx, dur, decay) {
    const sr = ctx.sampleRate, len = (sr * dur) | 0, buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  },

  running() { return !!this.ctx && this.ctx.state === 'running'; },

  setVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.muted ? 0 : Save.data.music * 0.9, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.muted ? 0 : Save.data.sfx, t, 0.03);
  },

  spectrum() {
    if (!this.running()) return null;
    this.an.getByteFrequencyData(this.spec);
    return this.spec;
  },

  /* generic oscillator voice: {type,f,f2,slide,t,a,d,vol,lp,lp2,q,dest,send,sendAmt,detune} */
  tone(o) {
    const ctx = this.ctx, t = o.t || ctx.currentTime;
    const a = o.a || 0.003, d = o.d || 0.2, v = o.vol || 0.2;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.slide || d));
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    if (o.lp) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q || 1;
      f.frequency.setValueAtTime(o.lp, t);
      if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + a + d);
      osc.connect(f); f.connect(g);
    } else osc.connect(g);
    g.connect(o.dest || this.sfxBus);
    if (o.send) { const sg = ctx.createGain(); sg.gain.value = o.sendAmt || 0.5; g.connect(sg); sg.connect(o.send); }
    osc.start(t); osc.stop(t + a + d + 0.05);
  },

  /* filtered noise burst: {type,f,f2,q,t,a,d,vol,dest} */
  noise(o) {
    const ctx = this.ctx, t = o.t || ctx.currentTime;
    const a = o.a || 0.002, d = o.d || 0.1, v = o.vol || 0.2;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'highpass'; f.Q.value = o.q || 0.7;
    f.frequency.setValueAtTime(o.f || 4000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + a + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    src.connect(f); f.connect(g); g.connect(o.dest || this.sfxBus);
    src.start(t, Math.random() * 1.5); src.stop(t + a + d + 0.05);
  }
};

/* ---------- generative music ---------- */
const CH = {
  i:   { bass: 0,  tones: [0, 3, 7, 10] },
  VI:  { bass: -4, tones: [-4, 0, 3, 7] },
  III: { bass: 3,  tones: [3, 7, 10, 14] },
  VII: { bass: -2, tones: [-2, 2, 5, 12] },
  iv:  { bass: 5,  tones: [5, 8, 12, 15] },
  v:   { bass: -5, tones: [-5, -2, 2, 5] }
};
const TRACKS = {
  menu:  { bpm: 88,  root: 52, prog: [CH.i, CH.VI, CH.III, CH.VII] },
  act1:  { bpm: 104, root: 50, prog: [CH.i, CH.VI, CH.III, CH.VII] },
  boss1: { bpm: 114, root: 50, prog: [CH.i, CH.i, CH.VI, CH.VII], drive: true },
  act2:  { bpm: 114, root: 54, prog: [CH.i, CH.VI, CH.iv, CH.v] },
  boss2: { bpm: 124, root: 54, prog: [CH.i, CH.iv, CH.VI, CH.v], drive: true },
  act3:  { bpm: 122, root: 48, prog: [CH.i, CH.VII, CH.VI, CH.iv] },
  boss3: { bpm: 134, root: 48, prog: [CH.i, CH.VI, CH.iv, CH.VII], drive: true }
};
const ARP2 = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0];
const ARP_SEQ = [0, 1, 2, 3, 2, 1];

const Music = {
  track: TRACKS.menu, name: '', pos: 0, stepIdx: 0, nextStep: 0.06, intensity: 0, paused: false,
  arpN: 0, melN: 4, beat: 0, root: 52, bpm: 88, _lt: null,

  setTrack(name) {
    if (this.name === name) return;
    this.name = name; this.track = TRACKS[name]; this.root = this.track.root; this.bpm = this.track.bpm;
    this.pos = 0; this.stepIdx = 0; this.nextStep = 0.08; this.arpN = 0; this.beat = 0;
  },

  /* 1 right on the beat, falling to 0 */
  pulse() { const p = this.beat % 1; return Math.max(0, 1 - p * 2.2); },

  update(dt) {
    const A = AudioSys, run = A.running();
    let d = dt;
    if (run) {
      const now = A.ctx.currentTime;
      if (this._lt !== null) { d = now - this._lt; if (d > 0.25 || d < 0) d = dt; }
      this._lt = now;
    } else this._lt = null;
    if (this.paused || !this.name) return;
    this.pos += d;
    this.beat = this.pos * this.bpm / 60;
    const st = 60 / this.bpm / 4;
    if (run) {
      let guard = 0;
      while (this.nextStep < this.pos + 0.14 && guard++ < 8) {
        const at = A.ctx.currentTime + Math.max(0.005, this.nextStep - this.pos);
        try { this._step(this.stepIdx, at); } catch (e) { /* never let audio break the game */ }
        this.stepIdx++; this.nextStep += st;
      }
      if (this.nextStep < this.pos) { const k = Math.ceil((this.pos - this.nextStep) / st); this.stepIdx += k; this.nextStep += k * st; }
    } else {
      while (this.nextStep < this.pos) { this.stepIdx++; this.nextStep += st; }
    }
  },

  _pad(f, t, dur, v, cut) {
    const A = AudioSys, ctx = A.ctx;
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.45);
    g.gain.setValueAtTime(v, t + dur - 0.1);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.9);
    for (let k = 0; k < 2; k++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = k ? 8 : -8;
      o.connect(lp); o.start(t); o.stop(t + dur + 1);
    }
    lp.connect(g); g.connect(A.musicBus);
    const sg = ctx.createGain(); sg.gain.value = 0.7; g.connect(sg); sg.connect(A.revIn);
  },
  _kick(t, v) {
    const A = AudioSys, M = A.musicBus;
    A.tone({ type: 'sine', f: 155, f2: 42, slide: 0.11, t, a: 0.002, d: 0.24, vol: v, dest: M });
    A.noise({ type: 'lowpass', f: 1800, t, d: 0.02, vol: v * 0.25, dest: M });
  },
  _snare(t, v) {
    const A = AudioSys, M = A.musicBus;
    A.noise({ type: 'bandpass', f: 1900, q: 0.8, t, d: 0.15, vol: v, dest: M });
    A.tone({ type: 'triangle', f: 195, f2: 130, t, d: 0.09, vol: v * 0.6, dest: M });
  },
  _hat(t, v, d) { AudioSys.noise({ type: 'highpass', f: 7600, t, d, vol: v, dest: AudioSys.musicBus }); },

  _step(i, t) {
    const A = AudioSys, tr = this.track, s = i % 16, bar = (i / 16) | 0;
    const ch = tr.prog[bar % tr.prog.length], I = this.intensity, st = 60 / tr.bpm / 4;
    const root = tr.root, M = A.musicBus, R = A.revIn;

    // pad — one chord per bar
    if (s === 0) {
      const v = I >= 2 ? 0.03 : 0.04;
      for (let k = 0; k < ch.tones.length; k++) this._pad(mtof(root + 12 + ch.tones[k]), t, st * 16, v, 620 + I * 360);
    }
    // bass
    const bn = root - 12 + ch.bass;
    if (I === 0) { if (s === 0) A.tone({ type: 'sine', f: mtof(bn + 12), t, a: 0.03, d: st * 12, vol: 0.16, dest: M }); }
    else if (I === 1) {
      if (s === 0 || s === 6 || s === 8 || s === 14) A.tone({ type: 'sawtooth', f: mtof(bn + (s === 14 ? 12 : 0)), t, a: 0.005, d: st * 2.6, vol: 0.2, lp: 520, lp2: 120, q: 2, dest: M });
    } else if (s % 2 === 0) {
      A.tone({ type: 'sawtooth', f: mtof(bn + (s % 4 === 2 ? 12 : 0)), t, a: 0.004, d: st * 1.8, vol: 0.2, lp: I === 3 ? 1500 : 850, lp2: 140, q: 3, dest: M });
    }
    // drums
    if (I >= 1) {
      const four = I >= 2 || tr.drive;
      if (four ? s % 4 === 0 : (s === 0 || s === 8 || s === 11)) this._kick(t, s % 8 === 0 ? 0.78 : 0.62);
      if (I >= 2 && (s === 4 || s === 12)) this._snare(t, 0.3);
      else if (tr.drive && (s === 4 || s === 12)) this._snare(t, 0.18);
      if (I === 1) { if (s % 4 === 2) this._hat(t, 0.09, 0.04); }
      else if (I === 2) { if (s % 2 === 0) this._hat(t, s % 4 === 2 ? 0.13 : 0.06, s % 4 === 2 ? 0.07 : 0.03); }
      else this._hat(t, s % 4 === 2 ? 0.15 : (s % 2 ? 0.045 : 0.08), s % 4 === 2 ? 0.12 : 0.03);
      if (I === 3 && bar % 4 === 3 && s >= 12) this._snare(t, 0.16 + (s - 12) * 0.05);
    }
    // arpeggio
    let play;
    if (I === 0) play = s % 4 === 0; else if (I === 1) play = s % 2 === 0; else if (I === 2) play = ARP2[s] === 1; else play = true;
    if (play) {
      const n = this.arpN++;
      const tone = ch.tones[ARP_SEQ[n % ARP_SEQ.length] % ch.tones.length];
      const oct = (I >= 3 && (n % 12) >= 6) ? 12 : 0;
      const f = mtof(root + 24 + tone + oct);
      A.tone({ type: 'triangle', f, t, a: 0.004, d: I === 0 ? 0.5 : 0.22, vol: I === 0 ? 0.06 : 0.075, dest: M, send: R, sendAmt: 0.6 });
      if (I >= 2) A.tone({ type: 'square', f: f * 2, t, a: 0.003, d: 0.09, vol: 0.016, dest: M, send: R });
    }
    // a wandering lead for the quiet moments (menus, serving, calm play)
    if (I <= 1 && s % 2 === 0 && Math.random() < (s % 8 === 0 ? 0.55 : 0.22)) {
      this.melN = clamp(this.melN + pick([-2, -1, -1, 1, 1, 2]), 0, 9);
      const f = mtof(root + 24 + 12 * Math.floor(this.melN / 5) + PENT[this.melN % 5]);
      A.tone({ type: 'sine', f, t, a: 0.02, d: st * 5, vol: 0.05, dest: M, send: R, sendAmt: 0.9 });
      A.tone({ type: 'triangle', f: f / 2, t, a: 0.02, d: st * 3, vol: 0.025, dest: M, send: R, sendAmt: 0.9 });
    }
  }
};

/* ---------- sound effects ---------- */
const Sfx = {
  quiet: false, _last: {},
  _ok(name, gap) {
    const A = AudioSys;
    if (this.quiet || !A.running()) return false;
    const t = A.ctx.currentTime;
    if (gap && this._last[name] !== undefined && t - this._last[name] < gap) return false;
    this._last[name] = t; return true;
  },
  _n(semi) { return mtof(Music.root + semi); },

  /* a brick sings: pitch climbs the scale with the combo */
  note(n) {
    if (!this._ok('note', 0.028)) return;
    const A = AudioSys, m = n % 24, idx = m <= 12 ? m : 24 - m;
    const f = this._n(12 + 12 * Math.floor(idx / 5) + PENT[idx % 5]);
    A.tone({ type: 'triangle', f, a: 0.002, d: 0.32, vol: 0.2, send: A.echoIn, sendAmt: 0.5 });
    A.tone({ type: 'sine', f: f * 2, a: 0.002, d: 0.12, vol: 0.06 });
    A.noise({ type: 'highpass', f: 5200, d: 0.07, vol: 0.08 });
  },
  crack() {
    if (!this._ok('crack', 0.03)) return;
    const A = AudioSys;
    A.noise({ type: 'bandpass', f: 3200, q: 1.2, d: 0.05, vol: 0.2 });
    A.tone({ type: 'square', f: 330, f2: 200, d: 0.05, vol: 0.07 });
  },
  steel() {
    if (!this._ok('steel', 0.04)) return;
    const A = AudioSys;
    A.tone({ type: 'square', f: 820, d: 0.08, vol: 0.045 });
    A.tone({ type: 'square', f: 1263, d: 0.06, vol: 0.035 });
  },
  paddle(off) {
    if (!this._ok('paddle', 0.03)) return;
    const A = AudioSys;
    A.tone({ type: 'triangle', f: this._n(12 + (off > 0.33 ? 7 : off < -0.33 ? -5 : 0)), a: 0.002, d: 0.14, vol: 0.3 });
    A.noise({ type: 'lowpass', f: 1400, d: 0.03, vol: 0.12 });
  },
  wall() { if (this._ok('wall', 0.03)) AudioSys.tone({ type: 'sine', f: this._n(36), d: 0.04, vol: 0.05 }); },
  launch() { if (this._ok('launch')) AudioSys.tone({ type: 'sine', f: 280, f2: 760, d: 0.14, vol: 0.2 }); },
  explode(small) {
    if (!this._ok('explode', 0.05)) return;
    const A = AudioSys, v = small ? 0.3 : 0.5;
    A.noise({ type: 'lowpass', f: 1400, f2: 90, d: small ? 0.3 : 0.5, vol: v });
    A.tone({ type: 'sine', f: 110, f2: 34, d: 0.4, vol: v });
  },
  power() {
    if (!this._ok('power')) return;
    const A = AudioSys, t = A.ctx.currentTime, seq = [12, 15, 19, 24];
    for (let i = 0; i < 4; i++) A.tone({ type: 'triangle', f: this._n(12 + seq[i]), t: t + i * 0.055, d: 0.2, vol: 0.16, send: A.echoIn, sendAmt: 0.4 });
  },
  bad() {
    if (!this._ok('bad')) return;
    const A = AudioSys, t = A.ctx.currentTime;
    A.tone({ type: 'sawtooth', f: this._n(13), t, d: 0.16, vol: 0.13, lp: 1400 });
    A.tone({ type: 'sawtooth', f: this._n(7), t: t + 0.12, d: 0.26, vol: 0.13, lp: 1100 });
  },
  life() {
    if (!this._ok('life')) return;
    const A = AudioSys, t = A.ctx.currentTime, seq = [12, 19, 24, 31, 36];
    for (let i = 0; i < 5; i++) A.tone({ type: 'triangle', f: this._n(12 + seq[i]), t: t + i * 0.07, d: 0.3, vol: 0.15, send: A.echoIn });
  },
  lose() {
    if (!this._ok('lose')) return;
    const A = AudioSys;
    A.tone({ type: 'sawtooth', f: 420, f2: 55, d: 0.75, vol: 0.24, lp: 2200, lp2: 200 });
    A.noise({ type: 'lowpass', f: 900, f2: 100, d: 0.5, vol: 0.2 });
  },
  laser() { if (this._ok('laser', 0.05)) AudioSys.tone({ type: 'sawtooth', f: 1500, f2: 320, d: 0.08, vol: 0.05 }); },
  shield() { if (this._ok('shield', 0.05)) AudioSys.tone({ type: 'sine', f: 420, f2: 980, d: 0.18, vol: 0.2, send: AudioSys.echoIn }); },
  clear() {
    if (!this._ok('clear')) return;
    const A = AudioSys, t = A.ctx.currentTime, seq = [0, 7, 12, 15, 19, 24, 31];
    for (let i = 0; i < seq.length; i++) A.tone({ type: 'triangle', f: this._n(12 + seq[i]), t: t + i * 0.085, d: 0.7, vol: 0.17, send: A.echoIn, sendAmt: 0.6 });
    A.noise({ type: 'highpass', f: 6000, t: t + 0.5, a: 0.1, d: 0.9, vol: 0.06 });
  },
  crescendo() {
    if (!this._ok('cresc')) return;
    const A = AudioSys, t = A.ctx.currentTime;
    A.noise({ type: 'bandpass', f: 300, f2: 7000, q: 1.5, a: 0.3, d: 0.5, vol: 0.2 });
    for (const s of [12, 19, 24, 27]) A.tone({ type: 'sawtooth', f: this._n(s), t, a: 0.02, d: 1.5, vol: 0.085, lp: 400, lp2: 3800, send: A.echoIn });
    A.tone({ type: 'sine', f: 90, f2: 38, d: 0.7, vol: 0.5 });
  },
  ready() {
    if (!this._ok('ready')) return;
    const A = AudioSys, t = A.ctx.currentTime;
    A.tone({ type: 'triangle', f: this._n(36), t, d: 0.25, vol: 0.14, send: A.echoIn });
    A.tone({ type: 'triangle', f: this._n(43), t: t + 0.09, d: 0.4, vol: 0.14, send: A.echoIn });
  },
  ui() { if (this._ok('ui', 0.04)) AudioSys.tone({ type: 'sine', f: 660, f2: 880, d: 0.07, vol: 0.12 }); },
  pick() {
    if (!this._ok('pick')) return;
    const A = AudioSys, t = A.ctx.currentTime;
    A.tone({ type: 'triangle', f: this._n(24), t, d: 0.2, vol: 0.16, send: A.echoIn });
    A.tone({ type: 'triangle', f: this._n(31), t: t + 0.08, d: 0.2, vol: 0.16, send: A.echoIn });
    A.tone({ type: 'triangle', f: this._n(36), t: t + 0.16, d: 0.45, vol: 0.16, send: A.echoIn });
  },
  bossHit() {
    if (!this._ok('bossHit', 0.05)) return;
    const A = AudioSys;
    A.tone({ type: 'square', f: 150, f2: 70, d: 0.13, vol: 0.2, lp: 1600 });
    A.noise({ type: 'bandpass', f: 1200, d: 0.08, vol: 0.18 });
  },
  bossDie() {
    if (!this._ok('bossDie')) return;
    const A = AudioSys;
    A.noise({ type: 'lowpass', f: 3000, f2: 60, d: 1.6, vol: 0.55 });
    A.tone({ type: 'sawtooth', f: 300, f2: 30, d: 1.5, vol: 0.3, lp: 1800, lp2: 100 });
  },
  stun() { if (this._ok('stun', 0.1)) AudioSys.tone({ type: 'sawtooth', f: 96, f2: 60, d: 0.32, vol: 0.28, lp: 900 }); },
  shot() { if (this._ok('shot', 0.06)) AudioSys.tone({ type: 'square', f: 520, f2: 240, d: 0.1, vol: 0.05, lp: 2400 }); },
  pop() { if (this._ok('pop', 0.03)) AudioSys.tone({ type: 'sine', f: 900, f2: 1500, d: 0.05, vol: 0.1 }); },
  summon() { if (this._ok('summon')) AudioSys.tone({ type: 'sawtooth', f: 120, f2: 480, d: 0.35, vol: 0.14, lp: 1800 }); },
  over() {
    if (!this._ok('over')) return;
    const A = AudioSys, t = A.ctx.currentTime, seq = [24, 22, 19, 15, 12];
    for (let i = 0; i < seq.length; i++) A.tone({ type: 'triangle', f: this._n(seq[i]), t: t + i * 0.24, d: 0.8, vol: 0.16, send: A.echoIn, sendAmt: 0.6 });
  }
};
