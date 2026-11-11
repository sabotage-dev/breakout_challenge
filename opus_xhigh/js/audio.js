'use strict';
/* =====================================================================
   PRISM BREAKER — procedural audio engine
   Everything is synthesized live with WebAudio: no samples, no files.
   The music engine exposes the chord currently playing so that brick
   hits can play notes that are always in harmony with the soundtrack.
   ===================================================================== */
const Sound = (() => {
  let ctx = null;
  let master, comp, sfxBus, musicBus, musicFade, musicFilter, sfxEcho, musicEcho, noiseBuf;
  const vol = { music: 0.6, sfx: 0.8 };
  let gate = 1;          // multiplies sfx volume (attract mode is quieter)
  let muted = false;
  const lastPlayed = Object.create(null);

  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
  const now = () => ctx.currentTime;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 16; comp.ratio.value = 5;
    comp.attack.value = 0.002; comp.release.value = 0.18;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);

    musicBus = ctx.createGain();
    musicFade = ctx.createGain(); musicFade.gain.value = 0;
    musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 20000; musicFilter.Q.value = 0.8;
    musicBus.connect(musicFade); musicFade.connect(musicFilter); musicFilter.connect(master);

    sfxBus = ctx.createGain(); sfxBus.connect(master);

    sfxEcho = makeEcho(sfxBus, 0.23, 0.3, 0.45);
    musicEcho = makeEcho(musicBus, 0.75 * 60 / 112, 0.38, 0.5);

    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    applyVolumes();
    setInterval(scheduler, 25);
    if (pendingSong) { const p = pendingSong; pendingSong = null; play(p); }
  }

  function makeEcho(dest, time, fbAmt, wetAmt) {
    const inp = ctx.createGain();
    const dl = ctx.createDelay(2.0); dl.delayTime.value = time;
    const fb = ctx.createGain(); fb.gain.value = fbAmt;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250;
    const wet = ctx.createGain(); wet.gain.value = wetAmt;
    inp.connect(dl); dl.connect(lp); lp.connect(hp); hp.connect(fb); fb.connect(dl);
    hp.connect(wet); wet.connect(dest);
    inp._delay = dl;
    return inp;
  }

  function applyVolumes() {
    if (!ctx) return;
    const m = muted ? 0 : 1;
    musicBus.gain.setTargetAtTime(vol.music * 0.55 * m, now(), 0.05);
    sfxBus.gain.setTargetAtTime(vol.sfx * gate * m, now(), 0.05);
  }

  // ------------------------------------------------------------------
  // Voice helpers
  // ------------------------------------------------------------------
  function osc(t, o) {
    const type = o.type || 'square', f = o.f || 440, dur = o.dur || 0.1;
    const v = Math.max(0.0002, o.v == null ? 0.2 : o.v), a = o.a || 0.003;
    const out = o.dest || sfxBus;
    const node = ctx.createOscillator();
    node.type = type;
    node.frequency.setValueAtTime(f, t);
    if (o.f2) node.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.slide || dur));
    if (o.detune) node.detune.value = o.detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let src = node;
    if (o.lp) {
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass';
      fl.frequency.setValueAtTime(o.lp, t);
      if (o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2, t + dur);
      fl.Q.value = o.q || 1;
      node.connect(fl); src = fl;
    }
    src.connect(g); g.connect(out);
    if (o.echo) {
      const s = ctx.createGain(); s.gain.value = o.echo; g.connect(s);
      s.connect(out === sfxBus ? sfxEcho : musicEcho);
    }
    node.start(t); node.stop(t + dur + 0.05);
  }

  function nz(t, o) {
    const dur = o.dur || 0.2, v = Math.max(0.0002, o.v == null ? 0.3 : o.v), a = o.a || 0.002;
    const out = o.dest || sfxBus;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = o.type || 'lowpass';
    fl.frequency.setValueAtTime(o.f || 2000, t);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    fl.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out);
    if (o.echo) {
      const e = ctx.createGain(); e.gain.value = o.echo; g.connect(e);
      e.connect(out === sfxBus ? sfxEcho : musicEcho);
    }
    s.start(t, Math.random() * 1.2); s.stop(t + dur + 0.05);
  }

  // Throttle: prevents dozens of identical voices stacking in a single frame
  function ok(name, gap) {
    if (!ctx || muted) return false;
    const t = now();
    if (lastPlayed[name] && t - lastPlayed[name] < gap) return false;
    lastPlayed[name] = t;
    return true;
  }

  // ------------------------------------------------------------------
  // MUSIC
  // ------------------------------------------------------------------
  const SONGS = {
    title:   { bpm: 86,  root: 57, prog: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], drums: null,   bass: 'soft',   arp: 'always', arpRate: 2, arpWave: 'triangle' },
    s1:      { bpm: 112, root: 57, prog: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], drums: 'four', bass: 'octave', arpWave: 'square' },
    s2:      { bpm: 100, root: 50, prog: [[0, 'm'], [-4, 'M'], [-7, 'm'], [-5, 'M']], drums: 'half', bass: 'pulse', arpWave: 'triangle' },
    s3:      { bpm: 124, root: 52, prog: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-5, 'M']], drums: 'four', bass: 'gallop', arpWave: 'sawtooth' },
    boss:    { bpm: 138, root: 57, prog: [[0, 'm'], [0, 'm'], [-4, 'M'], [-5, 'M']], drums: 'boss', bass: 'gallop', arp: 'always', arpWave: 'square' },
    endless: { bpm: 118, root: 54, prog: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-5, 'm']], drums: 'four', bass: 'octave', arpWave: 'square' },
  };
  const DRUMS = {
    four: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    half: { k: 'x.........x.....', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
    boss: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: '..x...x...x...x.' },
  };
  const BASS = {
    octave: 'r.o.r.o.r.o.r.o.',
    pulse:  'r.r.r.r.r.r.r.r.',
    gallop: 'r.rrr.rrr.rrr.ro',
    soft:   'r.......f.......',
  };
  const ARP_SEQ = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 5, 4, 2, 3, 1];

  let cur = null, curName = null, pendingSong = null;
  let step = 0, nextTime = 0, energy = 0;
  let curChord = { root: 57, tones: [0, 3, 7] };
  const kickTimes = [];
  let lastKick = -10;

  function chordAt(song, s) {
    const bar = Math.floor(s / 16) % song.prog.length;
    const [off, q] = song.prog[bar];
    return { root: song.root + off, tones: q === 'm' ? [0, 3, 7] : [0, 4, 7] };
  }

  function play(name) {
    if (!ctx) { pendingSong = name; return; }
    if (curName === name && cur) return;
    const song = SONGS[name]; if (!song) return;
    const t = now();
    const had = !!cur;
    musicFade.gain.cancelScheduledValues(t);
    musicFade.gain.setValueAtTime(musicFade.gain.value, t);
    if (had) {
      musicFade.gain.linearRampToValueAtTime(0, t + 0.25);
      musicFade.gain.linearRampToValueAtTime(1, t + 1.0);
    } else {
      musicFade.gain.linearRampToValueAtTime(1, t + 0.8);
    }
    cur = song; curName = name; step = 0;
    nextTime = t + (had ? 0.28 : 0.06);
    try { musicEcho._delay.delayTime.setValueAtTime(0.75 * 60 / song.bpm, t); } catch (e) { /* ignore */ }
  }

  function stop(fade = 0.6) {
    pendingSong = null;
    if (!ctx || !cur) { cur = null; curName = null; return; }
    const t = now();
    musicFade.gain.cancelScheduledValues(t);
    musicFade.gain.setValueAtTime(musicFade.gain.value, t);
    musicFade.gain.linearRampToValueAtTime(0, t + fade);
    cur = null; curName = null;
  }

  function scheduler() {
    if (!ctx || !cur) return;
    if (nextTime < now() - 0.5) nextTime = now() + 0.05; // recovered from a throttled tab
    while (nextTime < now() + 0.12) {
      scheduleStep(step, nextTime);
      nextTime += 60 / cur.bpm / 4;
      step++;
    }
  }

  function scheduleStep(s, t) {
    const song = cur, st = s % 16;
    const ch = chordAt(song, s);
    curChord = ch;
    const s16 = 60 / song.bpm / 4;
    const mb = musicBus;

    if (song.drums) {
      const D = DRUMS[song.drums];
      if (D.k[st] === 'x') { kick(t); kickTimes.push(t); }
      if (D.s[st] === 'x') snare(t);
      if (D.h[st] === 'x') hat(t, true);
      if (energy >= 2 && st % 2 === 1) hat(t, false);
      if (song.drums === 'boss' && st % 2 === 1) hat(t, false);
    } else if (st === 0 || st === 8) {
      kickTimes.push(t);
    }

    // Bass
    const bp = BASS[song.bass];
    const c = bp[st];
    if (c !== '.') {
      let n = ch.root - 12;
      if (c === 'o') n += 12; else if (c === 'f') n += 7;
      const soft = song.bass === 'soft';
      const dur = soft ? s16 * 7.5 : s16 * 1.7;
      osc(t, { type: 'sawtooth', f: mtof(n), dur, v: soft ? 0.12 : 0.17, a: soft ? 0.08 : 0.004, lp: soft ? 500 : 650 + energy * 450, lp2: 160, q: soft ? 1 : 5, dest: mb });
      osc(t, { type: 'sine', f: mtof(n - 12), dur, v: soft ? 0.14 : 0.2, a: soft ? 0.08 : 0.004, dest: mb });
    }

    // Pad, once per bar
    if (st === 0) pad(t, ch, s16 * 16, song.drums ? 0.022 : 0.05);

    // Arpeggio
    const arpOn = song.arp === 'always' || energy >= 1;
    const rate = song.arpRate || 1;
    if (arpOn && st % rate === 0) {
      const notes = [];
      for (let o = 0; o < 2; o++) for (const tn of ch.tones) notes.push(ch.root + 12 + o * 12 + tn);
      const idx = ARP_SEQ[(s / rate | 0) % ARP_SEQ.length] % notes.length;
      const n = notes[idx];
      osc(t, { type: song.arpWave || 'square', f: mtof(n), dur: s16 * rate * 0.9, v: song.drums ? 0.045 : 0.08, lp: 1800 + energy * 1200, lp2: 600, q: 3, echo: 0.4, dest: mb });
    }

    // High lead sparkle when energy is maxed
    if (energy >= 2 && (st === 0 || st === 6 || st === 10)) {
      const n = ch.root + 24 + ch.tones[(s >> 4) % 3];
      osc(t, { type: 'triangle', f: mtof(n), dur: s16 * 3, v: 0.05, echo: 0.5, dest: mb });
    }
  }

  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    g.gain.setValueAtTime(0.85, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.4);
    nz(t, { type: 'highpass', f: 3000, dur: 0.012, v: 0.08, dest: musicBus });
  }
  function snare(t) {
    nz(t, { type: 'bandpass', f: 1800, q: 0.6, dur: 0.18, v: 0.3, dest: musicBus });
    osc(t, { type: 'triangle', f: 210, f2: 140, dur: 0.09, v: 0.16, dest: musicBus });
  }
  function hat(t, open) {
    nz(t, { type: 'highpass', f: 7500, dur: open ? 0.09 : 0.03, v: open ? 0.07 : 0.045, dest: musicBus });
  }
  function pad(t, ch, len, v) {
    const notes = [ch.root, ch.root + ch.tones[1], ch.root + ch.tones[2], ch.root + 12];
    for (const n of notes) {
      for (const det of [-9, 9]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = mtof(n); o.detune.value = det;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100; f.Q.value = 0.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v, t + 0.45);
        g.gain.setValueAtTime(v, t + len - 0.25);
        g.gain.linearRampToValueAtTime(0, t + len + 0.25);
        o.connect(f); f.connect(g); g.connect(musicBus);
        o.start(t); o.stop(t + len + 0.3);
      }
    }
  }

  function beat() {
    if (!ctx) return 0;
    const t = now();
    while (kickTimes.length && kickTimes[0] <= t) lastKick = kickTimes.shift();
    return Math.exp(-(t - lastKick) * 7);
  }

  // ------------------------------------------------------------------
  // SOUND EFFECTS
  // ------------------------------------------------------------------
  function chordNotes() {
    const ch = curChord, list = [];
    for (let o = 0; o < 3; o++) for (const tn of ch.tones) list.push(ch.root + 12 + o * 12 + tn);
    list.push(ch.root + 48);
    return list;
  }

  const fx = {
    // Brick hit: plays the next note of a rising arpeggio of the chord currently in the music
    brick(combo, kind) {
      if (!ok('brick', 0.022)) return;
      const notes = chordNotes(), L = 7; // rising arpeggio capped two octaves up
      const idx = combo < L ? combo : (L - 4) + ((combo - L) % 4);
      const n = notes[Math.max(0, idx)], t = now();
      osc(t, { type: 'triangle', f: mtof(n), dur: 0.32, v: 0.2, echo: 0.22 });
      osc(t, { type: 'square', f: mtof(n), dur: 0.06, v: 0.05, lp: 3800 });
      if (kind === 'break') nz(t, { type: 'bandpass', f: 2600, q: 0.9, dur: 0.09, v: 0.1 });
      if (kind === 'tough') osc(t, { type: 'square', f: mtof(n + 19), dur: 0.05, v: 0.05, lp: 5000 });
    },
    steel() {
      if (!ok('steel', 0.04)) return;
      const t = now();
      osc(t, { type: 'sine', f: 2350, dur: 0.18, v: 0.1 });
      osc(t, { type: 'sine', f: 3720, dur: 0.12, v: 0.05 });
      nz(t, { type: 'highpass', f: 6000, dur: 0.04, v: 0.08 });
    },
    paddle() {
      if (!ok('paddle', 0.03)) return;
      const t = now();
      osc(t, { type: 'triangle', f: 196, f2: 392, dur: 0.12, v: 0.25, slide: 0.03 });
      osc(t, { type: 'sine', f: 784, dur: 0.06, v: 0.06 });
    },
    wall() {
      if (!ok('wall', 0.035)) return;
      osc(now(), { type: 'triangle', f: 1046, dur: 0.035, v: 0.06 });
    },
    launch() {
      if (!ok('launch', 0.05)) return;
      const t = now();
      osc(t, { type: 'sine', f: 300, f2: 1100, dur: 0.18, v: 0.16 });
      osc(t, { type: 'square', f: 600, f2: 2200, dur: 0.12, v: 0.03, lp: 3000 });
    },
    explode(big) {
      if (!ok('explode', 0.05)) return;
      const t = now();
      nz(t, { type: 'lowpass', f: big ? 5000 : 3600, f2: 90, dur: big ? 1.2 : 0.55, v: big ? 0.7 : 0.45, q: 0.7 });
      osc(t, { type: 'sine', f: big ? 110 : 140, f2: 28, dur: big ? 0.9 : 0.45, v: big ? 0.7 : 0.45 });
      if (big) osc(t, { type: 'sawtooth', f: 80, f2: 20, dur: 1.2, v: 0.2, lp: 400 });
    },
    prism() {
      if (!ok('prism', 0.06)) return;
      const t = now(), notes = chordNotes();
      for (let i = 0; i < 5; i++) osc(t + i * 0.04, { type: 'sine', f: mtof(notes[3 + i]), dur: 0.35, v: 0.09, echo: 0.4 });
    },
    gold() {
      if (!ok('gold', 0.06)) return;
      const t = now();
      [76, 83, 88].forEach((n, i) => osc(t + i * 0.05, { type: 'square', f: mtof(n), dur: 0.2, v: 0.06, lp: 4000, echo: 0.3 }));
    },
    powerGood() {
      if (!ok('pg', 0.05)) return;
      const t = now(), notes = chordNotes();
      for (let i = 0; i < 4; i++) osc(t + i * 0.055, { type: 'square', f: mtof(notes[2 + i * 2] || notes[notes.length - 1]), dur: 0.16, v: 0.08, lp: 3500, echo: 0.3 });
      osc(t, { type: 'sine', f: 500, f2: 1500, dur: 0.25, v: 0.1 });
    },
    powerBad() {
      if (!ok('pb', 0.05)) return;
      const t = now();
      osc(t, { type: 'sawtooth', f: 520, f2: 90, dur: 0.45, v: 0.14, lp: 1600 });
      osc(t + 0.06, { type: 'square', f: 300, f2: 70, dur: 0.4, v: 0.06, lp: 900 });
    },
    laser() {
      if (!ok('laser', 0.05)) return;
      osc(now(), { type: 'square', f: 1500, f2: 260, dur: 0.11, v: 0.05, lp: 4200 });
    },
    lifeLost() {
      if (!ctx) return;
      const t = now();
      osc(t, { type: 'sawtooth', f: 440, f2: 50, dur: 1.1, v: 0.22, lp: 2000, lp2: 200 });
      osc(t + 0.05, { type: 'square', f: 220, f2: 30, dur: 1.0, v: 0.08, lp: 800 });
      nz(t, { type: 'lowpass', f: 3000, f2: 100, dur: 0.8, v: 0.35 });
    },
    stageClear() {
      if (!ctx) return;
      const t = now(), r = curChord.root;
      const seq = [0, 4, 7, 12, 16, 19, 24];
      seq.forEach((iv, i) => osc(t + i * 0.07, { type: 'square', f: mtof(r + 12 + iv), dur: 0.25, v: 0.07, lp: 4000, echo: 0.35 }));
      [0, 4, 7, 12].forEach(iv => osc(t + 0.55, { type: 'triangle', f: mtof(r + 12 + iv), dur: 1.4, v: 0.1, echo: 0.4 }));
    },
    gameOver() {
      if (!ctx) return;
      const t = now();
      [69, 65, 62, 57].forEach((n, i) => osc(t + i * 0.32, { type: 'triangle', f: mtof(n), dur: 0.6, v: 0.16, echo: 0.4 }));
      osc(t + 1.28, { type: 'sawtooth', f: mtof(45), dur: 2.2, v: 0.1, lp: 900, lp2: 120 });
    },
    victory() {
      if (!ctx) return;
      const t = now();
      const mel = [69, 72, 76, 81, 79, 76, 77, 81, 84];
      mel.forEach((n, i) => osc(t + i * 0.14, { type: 'square', f: mtof(n), dur: 0.3, v: 0.07, lp: 4500, echo: 0.4 }));
      [57, 64, 69, 73, 76].forEach(n => osc(t + 1.3, { type: 'triangle', f: mtof(n), dur: 2.5, v: 0.08, echo: 0.4 }));
    },
    bossHit() {
      if (!ok('bosshit', 0.05)) return;
      const t = now();
      osc(t, { type: 'square', f: 150, f2: 55, dur: 0.22, v: 0.25, lp: 1400 });
      nz(t, { type: 'bandpass', f: 1200, dur: 0.15, v: 0.25 });
    },
    bossShoot() {
      if (!ok('bossshoot', 0.06)) return;
      osc(now(), { type: 'sawtooth', f: 900, f2: 180, dur: 0.18, v: 0.06, lp: 2500 });
    },
    bossRoar() {
      if (!ctx) return;
      const t = now();
      osc(t, { type: 'sawtooth', f: 70, f2: 45, dur: 1.4, v: 0.3, lp: 600, q: 8 });
      osc(t, { type: 'sawtooth', f: 73, f2: 40, dur: 1.4, v: 0.2, lp: 500, q: 8 });
      nz(t, { type: 'bandpass', f: 400, f2: 150, dur: 1.2, v: 0.3, q: 2 });
    },
    alarm() {
      if (!ctx) return;
      const t = now();
      for (let i = 0; i < 3; i++) {
        osc(t + i * 0.5, { type: 'square', f: 660, dur: 0.24, v: 0.06, lp: 2400 });
        osc(t + i * 0.5 + 0.25, { type: 'square', f: 494, dur: 0.24, v: 0.06, lp: 2400 });
      }
    },
    stun() {
      if (!ok('stun', 0.1)) return;
      const t = now();
      osc(t, { type: 'sawtooth', f: 95, dur: 0.5, v: 0.18, lp: 900 });
      osc(t, { type: 'square', f: 1400, f2: 300, dur: 0.3, v: 0.05, lp: 3000 });
    },
    shield() {
      if (!ok('shield', 0.05)) return;
      const t = now();
      osc(t, { type: 'sine', f: 520, f2: 1560, dur: 0.3, v: 0.16, echo: 0.3 });
    },
    odReady() {
      if (!ctx) return;
      const t = now();
      [0, 7, 12, 19].forEach((iv, i) => osc(t + i * 0.06, { type: 'triangle', f: mtof(curChord.root + 24 + iv), dur: 0.4, v: 0.08, echo: 0.4 }));
    },
    overdrive() {
      if (!ctx) return;
      const t = now();
      nz(t, { type: 'bandpass', f: 300, f2: 6000, dur: 0.7, v: 0.3, q: 3 });
      [0, 7, 12, 16, 19].forEach(iv => osc(t + 0.12, { type: 'sawtooth', f: mtof(curChord.root + iv), dur: 0.9, v: 0.05, lp: 5000, lp2: 600, echo: 0.3 }));
      osc(t, { type: 'sine', f: 60, f2: 30, dur: 0.6, v: 0.5 });
    },
    extraLife() {
      if (!ctx) return;
      const t = now();
      [72, 76, 79, 84, 79, 84].forEach((n, i) => osc(t + i * 0.08, { type: 'square', f: mtof(n), dur: 0.12, v: 0.07, lp: 5000 }));
    },
    catchBall() {
      if (!ok('catch', 0.05)) return;
      osc(now(), { type: 'sine', f: 240, f2: 120, dur: 0.1, v: 0.2 });
    },
    menuMove() {
      if (!ok('menu', 0.03)) return;
      osc(now(), { type: 'triangle', f: 1320, dur: 0.05, v: 0.06 });
    },
    menuSelect() {
      if (!ok('menusel', 0.05)) return;
      const t = now();
      osc(t, { type: 'square', f: 880, dur: 0.07, v: 0.05, lp: 4000 });
      osc(t + 0.06, { type: 'square', f: 1320, dur: 0.12, v: 0.05, lp: 4000, echo: 0.3 });
    },
    countTick() {
      if (!ok('tick', 0.04)) return;
      osc(now(), { type: 'square', f: 1760, dur: 0.025, v: 0.03, lp: 5000 });
    },
    phase() {
      if (!ctx) return;
      const t = now();
      osc(t, { type: 'sawtooth', f: 200, f2: 1600, dur: 0.6, v: 0.1, lp: 3000 });
      nz(t, { type: 'highpass', f: 1000, f2: 8000, dur: 0.6, v: 0.15 });
    },
  };

  return {
    init,
    fx,
    play,
    stop,
    beat,
    get ready() { return !!ctx; },
    get song() { return curName; },
    setEnergy(e) { energy = e; },
    setVolumes(m, s) { vol.music = m; vol.sfx = s; applyVolumes(); },
    setGate(g) { gate = g; applyVolumes(); },
    toggleMute() { muted = !muted; applyVolumes(); return muted; },
    get muted() { return muted; },
    muffle(on) {
      if (!ctx) return;
      const t = now();
      musicFilter.frequency.cancelScheduledValues(t);
      musicFilter.frequency.setValueAtTime(musicFilter.frequency.value, t);
      musicFilter.frequency.exponentialRampToValueAtTime(on ? 420 : 20000, t + 0.35);
    },
  };
})();
