/* SHATTERWAVE — DOM menus & screens */
'use strict';
SW.ui = {
  current: 'splash', stack: [], booted: false, lastSavedId: null,
  $(id) { return document.getElementById(id); },

  init() {
    // How-to lists
    const pills = this.$('howto-pills');
    for (const [, P] of Object.entries(SW.POWERS)) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="pill" style="background:${P.color};color:${P.good ? '#140726' : '#fff'}">${P.label}</span><span>${P.desc}</span>`;
      pills.appendChild(li);
    }
    const bricks = [
      ['#4d7cff', 'Glass — one hit'], ['#8e9cff', 'Armored — 2 or 3 hits'], ['#8a93a8', 'Steel — unbreakable'],
      ['#ff5a36', 'Volatile — explodes, chains'], ['#ffd23f', 'Mystery — always drops a power-up'], ['#9ff6ff', 'Crystal — frees an extra ball'],
      ['#c9b6ff', 'Phase — flickers in and out'], ['radial-gradient(#fff,#2de2ff)', 'Bumpers & portals redirect the ball'],
    ];
    const bl = this.$('howto-bricks');
    for (const [c, d] of bricks) { const li = document.createElement('li'); li.innerHTML = `<span class="brk" style="background:${c}"></span><span>${d}</span>`; bl.appendChild(li); }

    // buttons
    this.$('ui').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn || btn.disabled || performance.now() - (this.bootTime || 0) < 400) return;
      SW.audio.sfx('uiSelect');
      this.action(btn.dataset.action, btn);
    });
    this.$('ui').addEventListener('mouseover', (e) => {
      const btn = e.target.closest('button');
      if (btn && !btn.disabled && document.activeElement !== btn) { btn.focus({ preventScroll: true }); SW.audio.sfx('uiMove'); }
    });
    // splash -> boot audio
    const boot = (e) => {
      if (this.booted || this.current !== 'splash') return;
      if (e && e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
      this.boot();
    };
    this.$('scr-splash').addEventListener('pointerdown', boot);
    window.addEventListener('keydown', boot);

    // settings
    const S = SW.settings;
    const bindRange = (id, key) => {
      const el = this.$('set-' + id), out = this.$('out-' + id);
      el.value = S[key]; out.textContent = S[key];
      el.addEventListener('input', () => { S[key] = +el.value; out.textContent = el.value; SW.audio.applyVolumes(); SW.saveSettings(); });
      el.addEventListener('change', () => { if (key === 'sfx') SW.audio.sfx('note', 4, false); });
    };
    bindRange('music', 'music'); bindRange('sfx', 'sfx');
    const bindToggle = (id, key, fn) => {
      const el = this.$('set-' + id);
      el.checked = !!S[key];
      el.addEventListener('change', () => { S[key] = el.checked; SW.saveSettings(); if (fn) fn(); SW.audio.sfx('uiMove'); });
    };
    bindToggle('shake', 'shake'); bindToggle('flash', 'flash'); bindToggle('fps', 'fps');
    bindToggle('crt', 'crt', () => document.body.classList.toggle('crt', S.crt));
    document.body.classList.toggle('crt', S.crt);

    // name entry
    this.$('name-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (this.$('name-input').value || 'PLAYER').trim().toUpperCase().slice(0, 12) || 'PLAYER';
      SW.store.set('name', name);
      const info = this.overInfo;
      this.lastSavedId = SW.scores.add({ name, score: info.score, reached: info.reached, mode: info.mode, date: Date.now() });
      this.$('name-form').classList.remove('show');
      SW.audio.sfx('uiSelect');
      this.focusFirst();
    });

    // keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!this.current || this.current === 'splash') return;
      if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
      const scr = this.screenEl(this.current);
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'KeyW') {
        if (document.activeElement && document.activeElement.type === 'range' && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) { /* fallthrough to nav */ }
        const items = [...scr.querySelectorAll('button:not([disabled]), input')].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        let i = items.indexOf(document.activeElement);
        i = e.code === 'ArrowDown' || e.code === 'KeyS' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[i].focus();
        SW.audio.sfx('uiMove');
        e.preventDefault();
      } else if (e.code === 'Escape') {
        if (this.current === 'pause') this.resume();
        else if (this.stack.length) this.back();
        e.preventDefault();
      }
    });

    // touch buttons
    this.$('touch-pulse').addEventListener('touchstart', (e) => { e.preventDefault(); SW.input.pulse = true; }, { passive: false });
    this.$('touch-pulse').addEventListener('click', () => { SW.input.pulse = true; });
    this.$('touch-pause').addEventListener('touchstart', (e) => { e.preventDefault(); this.pause(); }, { passive: false });
    this.$('touch-pause').addEventListener('click', () => this.pause());
    this.refreshTitle();
  },

  boot() {
    this.booted = true;
    this.bootTime = performance.now();
    SW.audio.init();
    SW.audio.music('menu');
    SW.audio.intensity(0);
    this.show('title');
  },
  screenEl(name) { return document.querySelector(`.screen[data-screen="${name}"]`); },
  show(name, push) {
    if (push && this.current) this.stack.push(this.current);
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === name));
    this.current = name;
    document.body.classList.toggle('playing', !name);
    if (name === 'title') { this.stack = []; this.refreshTitle(); }
    if (name === 'scores') this.fillScores();
    if (name === 'sectors') this.fillSectors();
    if (name) setTimeout(() => this.focusFirst(), 30);
  },
  hide() { this.show(null); this.stack = []; },
  back() { const prev = this.stack.pop(); this.show(prev || 'title'); },
  menuOpen() { return !!this.current; },
  focusFirst() {
    const scr = this.current && this.screenEl(this.current);
    if (!scr) return;
    const inp = scr.querySelector('.name-form.show input');
    const el = inp || scr.querySelector('button:not([disabled])');
    if (el) el.focus({ preventScroll: true });
  },
  refreshTitle() {
    const best = SW.scores.best();
    const wave = SW.progress.bestEndless ? ` · OVERTIME WAVE <b>${SW.progress.bestEndless}</b>` : '';
    const esc = (t) => String(t).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
    this.$('title-best').innerHTML = best ? `BEST <b>${U.fmt(best)}</b> · ${esc(SW.scores.list[0].name)}${wave}` : 'ARE YOU READY?';
  },
  fillScores() {
    const body = this.$('score-body');
    body.innerHTML = '';
    if (!SW.scores.list.length) { body.innerHTML = '<tr class="empty"><td colspan="4">No scores yet — go make history.</td></tr>'; return; }
    SW.scores.list.forEach((s, i) => {
      const tr = document.createElement('tr');
      if (s.id === this.lastSavedId) tr.className = 'me';
      const cells = [i + 1, s.name, U.fmt(s.score), s.reached || ''];
      for (const c of cells) { const td = document.createElement('td'); td.textContent = c; tr.appendChild(td); }
      body.appendChild(tr);
    });
  },
  fillSectors() {
    const list = this.$('sector-list');
    list.innerHTML = '';
    SW.SECTORS.forEach((s, i) => {
      const b = document.createElement('button');
      b.dataset.action = 'sector'; b.dataset.idx = i;
      const locked = i + 1 > SW.progress.sector;
      b.disabled = locked;
      b.innerHTML = `<span class="num">0${i + 1}</span>${s.name}<small>${locked ? 'LOCKED · REACH IT IN THE CAMPAIGN' : 'LEVELS ' + (i + 1) + '-1 → ' + (i + 1) + '-4'}</small>`;
      list.appendChild(b);
    });
  },

  action(act, btn) {
    const G = SW.game;
    switch (act) {
      case 'play':
        if (SW.progress.sector > 1) this.show('sectors', true);
        else this.startGame('campaign', 0);
        break;
      case 'sector': this.startGame('campaign', +btn.dataset.idx * 4); break;
      case 'endless': this.startGame('endless', 0); break;
      case 'howto': case 'scores': case 'settings': this.show(act, true); break;
      case 'back': this.back(); break;
      case 'resume': this.resume(); break;
      case 'quit': this.quitToTitle(); break;
      case 'retry': this.hide(); G.retryLevel(); break;
      case 'overtime': this.hide(); G.enterOvertime(); break;
    }
  },
  startGame(mode, lvl) {
    this.hide();
    SW.audio.muffle(false);
    SW.game.newGame(mode, lvl);
  },
  pause() {
    const G = SW.game;
    if (G.demo || G.paused || G.state === 'over' || this.current) return;
    G.paused = true;
    SW.audio.muffle(true);
    this.show('pause');
  },
  resume() {
    SW.game.paused = false;
    SW.audio.muffle(false);
    SW.input.endFrame();
    this.hide();
  },
  quitToTitle() {
    SW.game.paused = false;
    SW.audio.muffle(false);
    SW.audio.music('menu');
    SW.audio.intensity(0);
    SW.game.startDemo();
    this.show('title');
  },
  gameOver(info) {
    this.overInfo = info;
    const prevBest = SW.scores.best();
    this.$('over-title').textContent = info.victory ? 'Victory' : 'Game Over';
    this.$('over-score').textContent = U.fmt(info.score);
    this.$('over-newbest').classList.toggle('show', info.score > prevBest && info.score > 0);
    const st = info.stats || {};
    const rows = [
      ['Reached', info.reached], ['Bricks', U.fmt(st.bricks || 0)], ['Best chain', st.bestChain || 0],
      ['Power-ups', st.powerups || 0], ['Guardians', st.bosses || 0], ['Time', U.fmtTime(st.time || 0)],
    ];
    this.$('over-stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const form = this.$('name-form');
    const q = SW.scores.qualifies(info.score);
    form.classList.toggle('show', q);
    this.$('name-input').value = SW.store.get('name', '');
    this.$('btn-retry').classList.toggle('hidden', !!info.victory);
    this.$('btn-retry').textContent = info.mode === 'endless' ? 'Retry Wave' : 'Retry Level';
    this.$('btn-overtime').classList.toggle('hidden', !info.victory);
    setTimeout(() => { this.show('over'); }, info.victory ? 600 : 300);
  },
  updateTouch() {
    const G = SW.game, touch = document.body.classList.contains('touch');
    const playing = !G.demo && !this.current && G.state !== 'over';
    this.$('touch-pulse').classList.toggle('hidden', !(touch && playing && G.pulse >= 100));
    this.$('touch-pause').classList.toggle('hidden', !(touch && playing));
  },
};
