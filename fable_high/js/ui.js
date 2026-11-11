'use strict';
/* ============ SHATTERSONG · app shell (menus, input, main loop) ============ */
const $ = id => document.getElementById(id);

const App = {
  state: 'locked', sub: null, canvas: null, ctx: null, last: 0,
  autotest: false, debugStage: 0, crescShown: false, toastT: 0, draftAt: 0,

  init() {
    Save.load();
    this.canvas = $('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    BG.init();
    this.resize();
    Game.onStageClear = () => this.stageCleared();
    Game.onGameOver = () => this.gameOver();
    Music.setTrack('menu');
    this.startDemo();
    this.bind(); this.buildHowto(); this.syncSettings(); this.updateBest();
    const m = /stage=(\d+)/.exec(location.hash);
    if (m) this.debugStage = clamp(+m[1] - 1, 0, STAGES.length - 1);
    if (location.hash.indexOf('autotest') >= 0) this.startAutotest();
    requestAnimationFrame(t => this.frame(t));
  },

  resize() {
    const cw = window.innerWidth, ch = window.innerHeight, cv = this.canvas;
    const dpr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6e6 / Math.max(1, cw * ch))));
    cv.width = Math.max(1, Math.round(cw * dpr)); cv.height = Math.max(1, Math.round(ch * dpr));
    View.dpr = dpr; View.cw = cw; View.ch = ch;
    const s = Math.min(cw / W, ch / H);
    View.scale = s; View.ox = (cw - W * s) / 2; View.oy = (ch - H * s) / 2;
  },

  /* ---------- loop ---------- */
  frame(ts) {
    requestAnimationFrame(t => this.frame(t));
    const now = ts / 1000, dt = clamp(now - this.last, 0, 0.05);
    this.last = now;
    try { this.tick(dt); }
    catch (e) { if (window.__test) window.__test.errors.push(String((e && e.stack) || e)); else throw e; }
  },

  tick(dt) {
    const st = this.state, G = Game;
    Music.paused = st === 'paused';
    Music.intensity = st === 'playing' ? G.musicIntensity() : (st === 'draft' || st === 'gameover' ? 0 : 1);
    Music.update(dt);
    BG.energy += ((G.crescendo > 0 ? 1 : 0) + Music.pulse() * 0.25 - BG.energy) * damp(6, dt);
    BG.update(dt);

    if (st === 'playing' || G.demo) {
      const reps = this.autotest ? 30 : 1;
      for (let i = 0; i < reps; i++) {
        Sfx.quiet = G.demo;
        G.update(this.autotest ? 1 / 60 : dt);
        if (this.state !== 'playing' && !G.demo) break;
      }
      Sfx.quiet = false;
    } else {
      Input.action = Input.tap = false;
      if (st !== 'paused') FX.update(dt);
    }
    this.draw();

    const want = st === 'playing' && Input.touch && G.phase === 'live' && G.resonance >= 100 && G.crescendo <= 0;
    if (want !== this.crescShown) { this.crescShown = want; $('btnCresc').classList.toggle('on', want); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').classList.remove('on'); }
  },

  draw() {
    const c = this.ctx, V = View, cv = this.canvas;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    BG.draw(c, cv.width, cv.height);
    const k = V.scale * V.dpr;
    c.setTransform(k, 0, 0, k, V.ox * V.dpr, V.oy * V.dpr);
    Game.draw(c);
    if (FX.flashA > 0.01) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = Math.min(0.8, FX.flashA); c.fillStyle = FX.flashCol; c.fillRect(0, 0, cv.width, cv.height);
      c.globalAlpha = 1;
    }
  },

  /* ---------- input ---------- */
  bind() {
    const cv = this.canvas;
    const move = e => {
      Input.x = (e.clientX - View.ox) / View.scale;
      Input.mode = 'pointer'; Input.touch = e.pointerType === 'touch';
    };
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', () => this.unlock(), true);
    cv.addEventListener('pointerdown', e => {
      move(e);
      if (this.state === 'playing') { if (e.pointerType === 'touch') Input.tap = true; else if (e.button === 0) Input.action = true; }
    });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => this.key(e, true));
    window.addEventListener('keyup', e => this.key(e, false));
    window.addEventListener('blur', () => { Input.left = Input.right = false; if (!this.autotest) this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !this.autotest) this.pause(); });

    document.addEventListener('click', e => {
      const b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (b) this.act(b.dataset.act);
    });
    $('btnPause').addEventListener('click', () => this.pause());
    $('btnCresc').addEventListener('pointerdown', e => { e.preventDefault(); Input.action = true; });

    $('volMusic').addEventListener('input', e => { Save.data.music = e.target.value / 100; AudioSys.setVolumes(); Save.store(); });
    $('volSfx').addEventListener('input', e => { Save.data.sfx = e.target.value / 100; AudioSys.setVolumes(); Save.store(); Sfx.pop(); });
    $('optShake').addEventListener('change', e => { Save.data.shake = e.target.checked; Save.store(); });
  },

  key(e, down) {
    const code = e.code;
    if (down && this.state === 'locked') { if (!e.metaKey && !e.ctrlKey && !e.altKey) this.unlock(); return; }
    if (e.metaKey || e.ctrlKey) return;
    if (code === 'ArrowLeft' || code === 'KeyA') { Input.left = down; if (down) Input.mode = 'keys'; if (this.state === 'playing') e.preventDefault(); return; }
    if (code === 'ArrowRight' || code === 'KeyD') { Input.right = down; if (down) Input.mode = 'keys'; if (this.state === 'playing') e.preventDefault(); return; }
    if (!down) return;
    this.unlock();
    const playing = this.state === 'playing';
    if (e.repeat) { if (playing && (code === 'Space' || code === 'ArrowUp')) e.preventDefault(); return; }
    switch (code) {
      case 'Space': case 'ArrowUp': case 'KeyW': case 'Enter':
        if (playing) { Input.action = true; e.preventDefault(); }
        else if (!this.sub && document.activeElement.tagName !== 'BUTTON' && document.activeElement.tagName !== 'INPUT') {
          const btn = document.querySelector('.screen.on .btn.primary');
          if (btn) { btn.click(); e.preventDefault(); }
        }
        break;
      case 'KeyP':
        if (playing) this.pause(); else if (this.state === 'paused' && !this.sub) this.act('resume');
        break;
      case 'Escape':
        if (this.sub) this.act('back'); else if (playing) this.pause(); else if (this.state === 'paused') this.act('resume');
        break;
      case 'KeyM':
        AudioSys.muted = !AudioSys.muted; AudioSys.setVolumes(); this.toast(AudioSys.muted ? 'Sound off' : 'Sound on');
        break;
      case 'KeyF': this.fullscreen(); break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Numpad1': case 'Numpad2': case 'Numpad3':
        if (this.state === 'draft') { const card = $('cards').children[+code.slice(-1) - 1]; if (card) card.click(); }
        break;
    }
  },

  unlock() {
    AudioSys.init();
    if (this.state === 'locked') { document.body.classList.remove('locked'); this.state = 'title'; Sfx.ui(); }
  },
  fullscreen() {
    const d = document, el = d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } catch (e) { /* not available */ }
  },
  toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); this.toastT = 1.6; },

  /* ---------- state ---------- */
  screen(id) { for (const el of document.querySelectorAll('.screen')) el.classList.toggle('on', el.id === id); },
  setState(s) {
    this.state = s; this.sub = null;
    document.body.classList.toggle('playing', s === 'playing');
    const map = { title: 'title', locked: 'title', paused: 'pause', draft: 'draft', gameover: 'gameover', victory: 'victory' };
    this.screen(map[s] || null);
    if (s === 'playing') {
      const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur();
      Input.action = Input.tap = false;
    }
  },

  act(name) {
    const G = Game;
    Sfx.ui();
    switch (name) {
      case 'play': case 'newrun': this.startRun(); break;
      case 'howto': case 'settings': this.sub = name; this.screen(name); break;
      case 'back': this.sub = null; this.screen(this.state === 'paused' ? 'pause' : 'title'); break;
      case 'resume': if (this.state === 'paused') this.setState('playing'); break;
      case 'quit': case 'title': this.toTitle(); break;
      case 'continue':
        G.score = 0; G.shownScore = 0; G.lives = 3; G.resonance = 0;
        G.loadStage(G.stageIdx); this.setState('playing'); break;
      case 'encore':
        G.loop++; G.loadStage(0); this.setState('playing'); break;
    }
  },

  startDemo() {
    Game.newRun({ demo: true, stage: pick([0, 1, 2, 4, 5, 8, 10]) });
    Game.lives = 99; Game.resonance = 55;
  },
  startRun() {
    Save.data.runs++; Save.store();
    Game.newRun({ stage: this.debugStage });
    this.setState('playing');
  },
  toTitle() {
    Music.setTrack('menu');
    this.startDemo(); this.updateBest();
    this.setState('title');
  },
  pause() {
    if (this.state !== 'playing') return;
    const G = Game, box = $('perkList');
    const owned = PERKS.filter(p => G.perk(p.id) > 0);
    box.innerHTML = owned.length
      ? owned.map(p => '<span>' + p.name + (G.perk(p.id) > 1 ? '<b>×' + G.perk(p.id) + '</b>' : '') + '</span>').join('')
      : '<em>No upgrades yet</em>';
    this.setState('paused');
  },

  stageCleared() {
    const G = Game;
    if (G.demo) { this.startDemo(); return; }
    if (G.stage.boss) G.lives++; // standing ovation
    const last = G.stageIdx >= STAGES.length - 1;
    if (this.autotest) { this.autoNext(last); return; }
    if (last) { this.victory(); return; }
    this.showDraft();
  },

  showDraft() {
    const G = Game, opts = G.rollPerks(3), box = $('cards'), cols = ['#6ee7ff', '#b388ff', '#ff7ad9'];
    box.innerHTML = '';
    opts.forEach((p, i) => {
      const lvl = G.perk(p.id);
      const note = p.max > 3 ? 'Instant' : lvl > 0 ? 'Level ' + lvl + ' → ' + (lvl + 1) : p.max > 1 ? 'New · stacks ×' + p.max : 'New';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card';
      b.innerHTML = '<span class="key">' + (i + 1) + '</span><canvas width="152" height="152"></canvas><h3>' + p.name + '</h3><p>' + p.desc + '</p><span class="lvl">' + note + '</span>';
      const c = b.querySelector('canvas').getContext('2d');
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.8;
      c.drawImage(Sprites.glow(cols[i % 3]), 0, 0, 152, 152);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.strokeStyle = rgba(cols[i % 3], 0.7); c.lineWidth = 3; c.beginPath(); c.arc(76, 76, 62, 0, TAU); c.stroke();
      drawIcon(c, p.icon, 76, 76, 34, '#ffffff');
      b.addEventListener('click', () => this.pickPerk(p.id));
      box.appendChild(b);
    });
    const next = STAGES[G.stageIdx + 1], act = ACTS[next.act];
    $('draftNote').textContent = (G.stage.boss ? 'Standing ovation: +1 life.  ·  ' : '') + 'Next: Act ' + act.roman + ' — ' + next.name + (next.boss ? ' (boss)' : '') + '  ·  press 1, 2 or 3';
    this.draftAt = performance.now();
    this.setState('draft');
  },
  pickPerk(id) {
    if (this.state !== 'draft' || performance.now() - this.draftAt < 400) return;
    Sfx.pick();
    Game.addPerk(id);
    Game.loadStage(Game.stageIdx + 1);
    this.setState('playing');
  },

  record() {
    const G = Game, D = Save.data;
    D.bestStage = Math.max(D.bestStage, G.stageIdx + 1 + G.loop * STAGES.length);
    const best = G.score > D.best;
    if (best) D.best = G.score;
    Save.store();
    return best && G.score > 0;
  },
  fillStats(el) {
    const G = Game, s = G.stats, m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
    const cell = (v, l) => '<div><b>' + v + '</b><span>' + l + '</span></div>';
    el.innerHTML = cell('Act ' + G.act.roman + ' · ' + G.stage.name, 'Stage') + cell(fmt(s.bricks), 'Bricks') + cell(s.maxCombo, 'Best combo') + cell(m + ':' + (sec < 10 ? '0' : '') + sec, 'Time');
  },
  gameOver() {
    const G = Game;
    if (G.demo) { this.startDemo(); return; }
    if (this.autotest) { G.lives = 99; G.serveBall(); G.setPhase('serve'); return; }
    const best = this.record();
    $('goScore').textContent = fmt(G.score);
    $('goBest').textContent = best ? '★ New best ★' : 'Best ' + fmt(Save.data.best);
    this.fillStats($('goStats'));
    $('btnContinue').textContent = 'Continue · ' + G.stage.name;
    Music.setTrack('menu');
    this.setState('gameover');
  },
  victory() {
    const G = Game, best = this.record();
    Save.data.wins++; Save.store();
    $('viScore').textContent = fmt(G.score);
    $('viBest').textContent = best ? '★ New best ★' : 'Best ' + fmt(Save.data.best);
    this.fillStats($('viStats'));
    Music.setTrack('menu');
    this.setState('victory');
  },

  /* ---------- static UI ---------- */
  updateBest() {
    const D = Save.data;
    $('bestLine').textContent = D.best > 0 ? 'Best ' + fmt(D.best) + (D.wins ? '  ·  ' + D.wins + (D.wins > 1 ? ' ovations' : ' ovation') : '') : '';
  },
  syncSettings() {
    $('volMusic').value = Math.round(Save.data.music * 100);
    $('volSfx').value = Math.round(Save.data.sfx * 100);
    $('optShake').checked = !!Save.data.shake;
  },
  buildHowto() {
    const bricks = [
      ['n', ACTS[0].pal[4], 'Glass', 'One hit.'],
      ['t', '#aebbd0', 'Tough', 'Two hits.'],
      ['h', '#e0aa3e', 'Gilded', 'Three hits.'],
      ['steel', '#4a5266', 'Steel', 'Needs a Crescendo.'],
      ['x', '#ff5a2a', 'Volatile', 'Chain explosions.'],
      ['s', '#c9f6ff', 'Seed', 'Frees an extra ball.'],
      ['phase', '#4de8ff', 'Phase', 'Blinks with the beat.']
    ];
    const lb = $('legendBricks');
    lb.classList.add('two');
    for (const b of bricks) {
      const row = document.createElement('div'), cv = document.createElement('canvas');
      cv.width = 132; cv.height = 76; cv.style.width = '66px'; cv.style.height = '38px';
      cv.getContext('2d').drawImage(Sprites.brick(b[0], b[1], 0), 4 * SS, 5 * SS, (BW + 20) * SS, (BH + 18) * SS, 0, 0, 132, 76);
      row.appendChild(cv);
      const tx = document.createElement('span'); tx.innerHTML = '<b>' + b[2] + '</b><br>' + b[3];
      row.appendChild(tx); lb.appendChild(row);
    }
    const lp = $('legendPower');
    for (const id in POWERUPS) {
      const pu = POWERUPS[id], row = document.createElement('div'), cv = document.createElement('canvas');
      cv.width = 68; cv.height = 68; cv.style.width = '34px'; cv.style.height = '34px';
      const c = cv.getContext('2d');
      c.fillStyle = rgba(pu.color, 0.16); c.beginPath(); c.arc(34, 34, 31, 0, TAU); c.fill();
      c.strokeStyle = rgba(pu.color, 0.9); c.lineWidth = 2.5; c.beginPath(); c.arc(34, 34, 31, 0, TAU); c.stroke();
      drawIcon(c, pu.icon, 34, 34, 16, pu.bad ? '#ff8a8a' : '#ffffff');
      row.appendChild(cv);
      const tx = document.createElement('span'); tx.innerHTML = '<b>' + pu.name + '</b><br>' + pu.desc;
      row.appendChild(tx); lp.appendChild(row);
    }
  },

  /* ---------- self-test (open index.html#autotest) ---------- */
  startAutotest() {
    this.autotest = true;
    window.__test = { done: false, errors: [], log: [] };
    window.addEventListener('error', e => window.__test.errors.push(e.message + ' @' + e.filename + ':' + e.lineno));
    this.unlock();
    Game.newRun({ auto: true, stage: this.debugStage });
    Game.lives = 99;
    this.setState('playing');
  },
  autoNext(last) {
    const G = Game, T = window.__test;
    T.log.push(G.stage.name + ': ' + Math.round(G.stats.time) + 's, score ' + G.score + ', lives ' + G.lives + ', perks ' + JSON.stringify(G.perks));
    if (last) { T.done = true; this.autotest = false; G.auto = false; this.victory(); return; }
    const opts = G.rollPerks(3);
    if (opts.length) G.addPerk(pick(opts).id);
    G.lives = 99;
    G.loadStage(G.stageIdx + 1);
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());
