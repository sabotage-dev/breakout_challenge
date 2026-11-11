/* SHATTERLIGHT — procedural audio engine (WebAudio, no assets) */
'use strict';

const Sound = (() => {
  let ac = null, master, comp, sfxBus, musBus, delay, delayFb, delayWet, noiseBuf;
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  const load = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  let sfxOn = load('sl_sfx') !== '0';
  let musicOn = load('sl_music') !== '0';
  let quiet = false;      // used by the attract-mode demo
  let ducked = false;
  const lastPlayed = {};  // per-sound throttle

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5;
    comp.attack.value = 0.002; comp.release.value = 0.15;
    master = ac.createGain(); master.gain.value = 0.85;
    master.connect(comp); comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = sfxOn ? 0.55 : 0; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = musicOn ? 0.3 : 0; musBus.connect(master);
    delay = ac.createDelay(1.0); delay.delayTime.value = 0.32;
    delayFb = ac.createGain(); delayFb.gain.value = 0.33;
    delayWet = ac.createGain(); delayWet.gain.value = 0.4;
    delay.connect(delayFb); delayFb.connect(delay);
    delay.connect(delayWet); delayWet.connect(musBus);

    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    if (Music.pending) { const m = Music.pending; Music.pending = null; Music.play(m); }
  }

  function throttle(name, gap) {
    const now = ac.currentTime;
    if (lastPlayed[name] && now - lastPlayed[name] < gap) return false;
    lastPlayed[name] = now;
    return true;
  }

  // Generic oscillator voice
  function tone(o) {
    if (!ac) return;
    const t0 = (o.when !== undefined ? o.when : ac.currentTime) + (o.delay || 0);
    const osc = ac.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + (o.slide || o.dur || 0.15));
    if (o.detune) osc.detune.value = o.detune;
    const g = ac.createGain();
    const a = o.a || 0.004, dur = o.dur || 0.15, v = o.v || 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    if (o.hold) g.gain.setValueAtTime(v, t0 + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + (o.hold || 0) + dur);
    let node = osc;
    if (o.lp || o.hp || o.bp) {
      const f = ac.createBiquadFilter();
      f.type = o.lp ? 'lowpass' : o.hp ? 'highpass' : 'bandpass';
      f.frequency.setValueAtTime(o.lp || o.hp || o.bp, t0);
      if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t0 + a + (o.hold || 0) + dur);
      f.Q.value = o.q || 0.8;
      node.connect(f); node = f;
    }
    node.connect(g);
    g.connect(o.bus || sfxBus);
    if (o.send) g.connect(delay);
    osc.start(t0);
    osc.stop(t0 + a + (o.hold || 0) + dur + 0.05);
  }

  function noise(o) {
    if (!ac) return;
    const t0 = (o.when !== undefined ? o.when : ac.currentTime) + (o.delay || 0);
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = o.ft || 'lowpass';
    f.frequency.setValueAtTime(o.f || 2000, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.dur || 0.2));
    f.Q.value = o.q || 0.7;
    const g = ac.createGain();
    const a = o.a || 0.002, dur = o.dur || 0.2, v = o.v || 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    const off = Math.random() * 0.5;
    src.start(t0, off);
    src.stop(t0 + a + dur + 0.05);
  }

  const can = () => ac && sfxOn && !quiet;

  // ---------------- Sound effects ----------------
  const PENTA = [0, 3, 5, 7, 10];
  const sfx = {
    brick(combo) {
      if (!can() || !throttle('brick', 0.022)) return;
      const i = Math.min(Math.max(combo - 1, 0), 13);
      const m = 69 + 12 * Math.floor(i / 5) + PENTA[i % 5];
      tone({ type: 'triangle', f: mtof(m), dur: 0.26, v: 0.2 });
      tone({ type: 'sine', f: mtof(m + 12), dur: 0.14, v: 0.07 });
      tone({ type: 'square', f: mtof(m + 19), dur: 0.05, v: 0.018, lp: 4000 });
      noise({ ft: 'highpass', f: 5000, dur: 0.03, v: 0.06 });
    },
    tough(hp) {
      if (!can() || !throttle('tough', 0.03)) return;
      tone({ type: 'square', f: 1250 + hp * 180, dur: 0.06, v: 0.05, bp: 2200, q: 3 });
      tone({ type: 'triangle', f: 640 + hp * 90, dur: 0.12, v: 0.12 });
      noise({ ft: 'bandpass', f: 3000, q: 2, dur: 0.05, v: 0.1 });
    },
    steel() {
      if (!can() || !throttle('steel', 0.04)) return;
      tone({ type: 'square', f: 260, f2: 200, dur: 0.09, v: 0.06, lp: 1800 });
      tone({ type: 'sine', f: 1780, dur: 0.18, v: 0.04 });
      tone({ type: 'sine', f: 2450, dur: 0.12, v: 0.03 });
    },
    paddle() {
      if (!can() || !throttle('paddle', 0.03)) return;
      tone({ type: 'sine', f: 330, f2: 160, dur: 0.14, v: 0.28 });
      tone({ type: 'triangle', f: 660, dur: 0.05, v: 0.06 });
    },
    wall() {
      if (!can() || !throttle('wall', 0.04)) return;
      tone({ type: 'sine', f: 820, f2: 600, dur: 0.04, v: 0.06 });
    },
    explode() {
      if (!can() || !throttle('explode', 0.05)) return;
      noise({ ft: 'lowpass', f: 2600, f2: 120, dur: 0.6, v: 0.5 });
      tone({ type: 'sine', f: 140, f2: 36, dur: 0.5, v: 0.5 });
      tone({ type: 'square', f: 90, f2: 40, dur: 0.25, v: 0.08, lp: 600 });
    },
    bigBoom() {
      if (!can()) return;
      noise({ ft: 'lowpass', f: 4000, f2: 60, dur: 1.8, v: 0.7 });
      tone({ type: 'sine', f: 110, f2: 24, dur: 1.6, v: 0.7 });
      tone({ type: 'sawtooth', f: 220, f2: 30, dur: 1.2, v: 0.12, lp: 900 });
    },
    powerup() {
      if (!can()) return;
      [0, 4, 7, 12].forEach((n, i) =>
        tone({ type: 'square', f: mtof(76 + n), dur: 0.1, v: 0.06, lp: 3500, delay: i * 0.05 }));
      tone({ type: 'sine', f: 600, f2: 1400, dur: 0.25, v: 0.08 });
    },
    powerdown() {
      if (!can()) return;
      [0, -3, -6].forEach((n, i) =>
        tone({ type: 'sawtooth', f: mtof(64 + n), dur: 0.14, v: 0.06, lp: 1600, delay: i * 0.08 }));
    },
    oneup() {
      if (!can()) return;
      [0, 4, 7, 12, 16, 19, 24].forEach((n, i) =>
        tone({ type: 'square', f: mtof(72 + n), dur: 0.12, v: 0.05, lp: 4000, delay: i * 0.06 }));
    },
    laser() {
      if (!can() || !throttle('laser', 0.05)) return;
      tone({ type: 'sawtooth', f: 1900, f2: 300, dur: 0.09, v: 0.04, lp: 5000 });
    },
    launch() {
      if (!can()) return;
      tone({ type: 'triangle', f: 280, f2: 980, dur: 0.14, v: 0.14 });
      noise({ ft: 'highpass', f: 2500, dur: 0.1, v: 0.05 });
    },
    lose() {
      if (!can()) return;
      tone({ type: 'sawtooth', f: 520, f2: 50, dur: 0.9, v: 0.16, lp: 1400, lp2: 200 });
      tone({ type: 'square', f: 260, f2: 40, dur: 0.9, v: 0.06, lp: 900 });
      noise({ ft: 'lowpass', f: 1500, f2: 100, dur: 0.6, v: 0.25 });
    },
    clear() {
      if (!can()) return;
      const seq = [60, 64, 67, 72, 67, 72, 76, 79];
      seq.forEach((m, i) => {
        tone({ type: 'square', f: mtof(m), dur: 0.16, v: 0.06, lp: 3000, delay: i * 0.085 });
        tone({ type: 'triangle', f: mtof(m - 12), dur: 0.2, v: 0.1, delay: i * 0.085 });
      });
      [72, 76, 79, 84].forEach((m) => tone({ type: 'sawtooth', f: mtof(m), dur: 1.2, v: 0.025, lp: 2200, delay: 0.7, a: 0.05 }));
    },
    bossHit() {
      if (!can() || !throttle('bossHit', 0.05)) return;
      tone({ type: 'square', f: 140, f2: 55, dur: 0.2, v: 0.16, lp: 900 });
      tone({ type: 'sine', f: 70, f2: 40, dur: 0.25, v: 0.35 });
      noise({ ft: 'bandpass', f: 1200, q: 1.5, dur: 0.12, v: 0.2 });
    },
    bossShot() {
      if (!can() || !throttle('bossShot', 0.08)) return;
      tone({ type: 'sine', f: 900, f2: 180, dur: 0.25, v: 0.1 });
      tone({ type: 'square', f: 450, f2: 90, dur: 0.2, v: 0.03, lp: 1500 });
    },
    shieldUp() {
      if (!can()) return;
      tone({ type: 'sine', f: 400, f2: 1200, dur: 0.3, v: 0.12 });
      tone({ type: 'triangle', f: 800, f2: 2400, dur: 0.3, v: 0.05 });
    },
    shieldBreak() {
      if (!can()) return;
      noise({ ft: 'highpass', f: 3000, dur: 0.3, v: 0.2 });
      tone({ type: 'triangle', f: 1600, f2: 300, dur: 0.3, v: 0.1 });
    },
    zap() {
      if (!can() || !throttle('zap', 0.05)) return;
      noise({ ft: 'bandpass', f: 3500, q: 0.8, dur: 0.18, v: 0.22 });
      tone({ type: 'sawtooth', f: 90, f2: 60, dur: 0.18, v: 0.08, lp: 2000 });
    },
    stun() {
      if (!can()) return;
      tone({ type: 'square', f: 70, dur: 0.35, v: 0.12, lp: 1200 });
      tone({ type: 'sawtooth', f: 1400, f2: 200, dur: 0.3, v: 0.05 });
      noise({ ft: 'bandpass', f: 2500, dur: 0.3, v: 0.15 });
    },
    warning() {
      if (!can()) return;
      for (let i = 0; i < 3; i++) {
        tone({ type: 'square', f: 440, dur: 0.18, v: 0.06, lp: 1600, delay: i * 0.45 });
        tone({ type: 'square', f: 330, dur: 0.18, v: 0.06, lp: 1600, delay: i * 0.45 + 0.2 });
      }
    },
    gameover() {
      if (!ac || !sfxOn) return;
      [57, 53, 50, 45].forEach((m, i) =>
        tone({ type: 'sawtooth', f: mtof(m), dur: 0.5, v: 0.07, lp: 1200, delay: i * 0.32, a: 0.02 }));
      tone({ type: 'sine', f: mtof(33), dur: 1.8, v: 0.25, delay: 1.0, a: 0.05 });
    },
    ui() {
      if (!ac || !sfxOn) return;
      tone({ type: 'triangle', f: 1200, dur: 0.05, v: 0.06 });
    },
    uiGo() {
      if (!ac || !sfxOn) return;
      tone({ type: 'triangle', f: 600, f2: 1600, dur: 0.18, v: 0.12 });
      tone({ type: 'square', f: 1200, f2: 2400, dur: 0.12, v: 0.03, lp: 4000 });
    },
  };

  // ---------------- Music sequencer ----------------
  // prog: [root midi, quality] — quality 0 = minor, 1 = major
  const SONGS = {
    title: { bpm: 92, prog: [[57, 0], [53, 1], [48, 1], [55, 1]], drums: 0, arpDiv: 2, bassDiv: 4, arpWave: 'triangle' },
    a: { bpm: 116, prog: [[57, 0], [53, 1], [48, 1], [55, 1]], drums: 1, arpDiv: 1, bassDiv: 2, arpWave: 'square' },
    b: { bpm: 122, prog: [[52, 0], [48, 1], [55, 1], [50, 1]], drums: 1, arpDiv: 1, bassDiv: 2, arpWave: 'square' },
    c: { bpm: 126, prog: [[54, 0], [50, 1], [57, 1], [52, 1]], drums: 1, arpDiv: 1, bassDiv: 2, arpWave: 'triangle' },
    boss: { bpm: 140, prog: [[50, 0], [50, 0], [46, 1], [48, 1]], drums: 2, arpDiv: 1, bassDiv: 1, arpWave: 'sawtooth' },
  };
  const ARP = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 3, 5, 3, 2, 4, 2];

  const Music = {
    pending: null, mode: null, song: null, step: 0, next: 0, timer: null,
    play(mode) {
      if (!ac) { this.pending = mode; return; }
      if (this.mode === mode) return;
      this.mode = mode;
      this.song = SONGS[mode];
      this.step = 0;
      this.next = ac.currentTime + 0.08;
      if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
    },
    stop() {
      this.mode = null; this.song = null; this.pending = null;
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },
    tick() {
      if (!ac || !this.song) return;
      const sp = 60 / this.song.bpm / 4;
      if (this.next < ac.currentTime - 0.2) this.next = ac.currentTime + 0.02; // recover after tab sleep
      while (this.next < ac.currentTime + 0.14) {
        this.playStep(this.step, this.next, sp);
        this.next += sp;
        this.step = (this.step + 1) % 64;
      }
    },
    playStep(step, t, sp) {
      const s = this.song;
      const bar = Math.floor(step / 16), st = step % 16;
      const [root, q] = s.prog[bar];
      const third = q ? 4 : 3;
      const tones = [0, third, 7, 12, 12 + third, 19];
      const bus = musBus;
      // Pad
      if (st === 0) {
        const len = sp * 16;
        [0, third, 7].forEach((n) => {
          tone({ when: t, type: 'sawtooth', f: mtof(root + n), dur: len * 0.6, hold: len * 0.3, a: 0.25, v: 0.022, lp: s.drums === 2 ? 1400 : 900, bus, detune: -8 });
          tone({ when: t, type: 'sawtooth', f: mtof(root + n), dur: len * 0.6, hold: len * 0.3, a: 0.25, v: 0.022, lp: s.drums === 2 ? 1400 : 900, bus, detune: 8 });
        });
      }
      // Bass
      if (st % s.bassDiv === 0) {
        let n = root - 24;
        if (s.drums === 2) n += [0, 0, 12, 0, 0, 12, 0, 3][st % 8];
        else if (st % 8 === 6) n += 12;
        tone({ when: t, type: 'sawtooth', f: mtof(n), dur: sp * (s.bassDiv === 4 ? 3 : 1.6), v: s.drums ? 0.12 : 0.08, lp: s.drums === 2 ? 700 : 520, q: 3, bus });
        tone({ when: t, type: 'sine', f: mtof(n), dur: sp * 1.8, v: 0.09, bus });
      }
      // Arp
      if (st % s.arpDiv === 0) {
        const n = root + 12 + tones[ARP[st]];
        tone({ when: t, type: s.arpWave, f: mtof(n), dur: sp * 1.4, v: s.arpWave === 'sawtooth' ? 0.028 : 0.035, lp: 2600, bus, send: true });
      }
      // Drums
      if (s.drums) {
        if (st % 4 === 0) {
          tone({ when: t, type: 'sine', f: 150, f2: 42, slide: 0.12, dur: 0.24, v: s.drums === 2 ? 0.5 : 0.38, bus });
        }
        if (st % 4 === 2) noise({ when: t, ft: 'highpass', f: 7500, dur: 0.035, v: 0.06, bus });
        if (s.drums === 2 && st % 2 === 1) noise({ when: t, ft: 'highpass', f: 9000, dur: 0.02, v: 0.025, bus });
        if (st === 4 || st === 12) noise({ when: t, ft: 'bandpass', f: 1700, q: 0.9, dur: 0.14, v: 0.14, bus });
      }
    },
  };

  function applyGains() {
    if (!ac) return;
    const now = ac.currentTime;
    sfxBus.gain.setTargetAtTime(sfxOn ? 0.55 : 0, now, 0.02);
    musBus.gain.setTargetAtTime(musicOn ? (ducked ? 0.08 : 0.3) : 0, now, 0.08);
  }

  return {
    init,
    sfx,
    music: (m) => Music.play(m),
    stopMusic: () => Music.stop(),
    setQuiet(q) { quiet = q; },
    setDuck(d) { ducked = d; applyGains(); },
    get sfxOn() { return sfxOn; },
    get musicOn() { return musicOn; },
    toggleSfx() { sfxOn = !sfxOn; store('sl_sfx', sfxOn ? '1' : '0'); applyGains(); return sfxOn; },
    toggleMusic() { musicOn = !musicOn; store('sl_music', musicOn ? '1' : '0'); applyGains(); return musicOn; },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
  };
})();
