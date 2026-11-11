'use strict';
/* ==========================================================================
   HADAL — menus and overlays (plain DOM on top of the canvas)
   ========================================================================== */

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

const UI = {
  cur: null,
  stack: [],
  perkCb: null,
  lockUntil: 0,
  muted: false,
  lastHover: null,
  playing: null,
  toastT: 0,

  $(id) { return document.getElementById(id); },
  on(id, fn) { const el = this.$(id); if (el) el.addEventListener('click', fn); },
  blocking() { return this.cur !== null; },

  init() {
    this.on('btn-dive', () => { this.closeAll(); Game.startRun(null); });
    this.on('btn-continue', () => { this.closeAll(); Game.startRun(Save.data.ckpt); });
    this.on('btn-help', () => this.open('help'));
    this.on('btn-settings', () => this.open('settings'));
    this.on('btn-resume', () => Game.togglePause(false));
    this.on('btn-p-help', () => this.open('help'));
    this.on('btn-p-settings', () => this.open('settings'));
    this.on('btn-quit', () => Game.toTitle());
    this.on('btn-retry', () => Game.retryZone());
    this.on('btn-new', () => { this.closeAll(); Game.startRun(null); });
    this.on('btn-o-title', () => Game.toTitle());
    this.on('btn-w-again', () => { this.closeAll(); Game.startRun(null); });
    this.on('btn-w-title', () => Game.toTitle());
    this.on('btn-pause', () => Game.togglePause());
    const backs = document.querySelectorAll('[data-back]');
    for (let i = 0; i < backs.length; i++) backs[i].addEventListener('click', () => this.back());

    // settings
    const s = Save.data.settings;
    const bindRange = (id, key) => {
      const el = this.$(id);
      el.value = Math.round(s[key] * 100);
      el.addEventListener('input', () => {
        s[key] = clamp(el.value / 100, 0, 1);
        this.muted = false;
        Sound.setVolume(key, s[key]);
        Save.store();
        if (key === 'sfx') Sound.play('tick');
      });
    };
    bindRange('set-music', 'music');
    bindRange('set-sfx', 'sfx');
    const bindToggle = (id, key) => {
      const el = this.$(id);
      const sync = () => { el.classList.toggle('on', !!s[key]); el.setAttribute('aria-pressed', s[key] ? 'true' : 'false'); el.textContent = s[key] ? 'On' : 'Off'; };
      sync();
      el.addEventListener('click', () => { s[key] = !s[key]; sync(); Save.store(); });
    };
    bindToggle('set-shake', 'shake');
    bindToggle('set-flash', 'flash');
    this.on('set-full', () => this.fullscreen());
    Sound.setVolume('music', s.music);
    Sound.setVolume('sfx', s.sfx);

    // feedback sounds
    document.addEventListener('mouseover', (e) => {
      const b = e.target && e.target.closest ? e.target.closest('button') : null;
      if (b && b !== this.lastHover) Sound.play('hover');
      this.lastHover = b;
    });
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('button')) Sound.play('click');
    });

    this.buildHelp();
    const ic = document.querySelectorAll('canvas[data-icon]');
    for (let i = 0; i < ic.length; i++) this.paintIcon(ic[i], ic[i].getAttribute('data-icon'), ic[i].getAttribute('data-color') || '#bff6ff');
  },

  /* ---------------------------------------------------------- navigation */
  show(name) {
    if (this.cur) this.$('scr-' + this.cur).classList.remove('on');
    this.cur = name || null;
    if (this.cur) {
      const el = this.$('scr-' + this.cur);
      el.classList.add('on');
      el.scrollTop = 0;
      const b = el.querySelector('[data-first]') || el.querySelector('button:not([hidden])');
      if (b && b.focus) { try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    } else if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    Input.reset();
  },
  open(name) { this.stack.push(this.cur); this.show(name); },
  back() { this.show(this.stack.length ? this.stack.pop() : null); },
  closeAll() { this.stack.length = 0; this.show(null); },

  tick() {
    const playing = Game.mode === 'play' && !this.cur;
    if (playing !== this.playing) {
      this.playing = playing;
      document.body.classList.toggle('playing', playing);
    }
  },

  key(e) {
    if (!this.cur) return false;
    const c = e.code;
    if (c === 'Escape') {
      if (this.cur === 'help' || this.cur === 'settings') this.back();
      else if (this.cur === 'pause') Game.togglePause(false);
      e.preventDefault();
      return true;
    }
    if (c === 'KeyP' && this.cur === 'pause' && !e.repeat) { Game.togglePause(false); return true; }
    if (this.cur === 'perk' && /^(Digit|Numpad)[1-3]$/.test(c)) {
      const cards = this.$('perk-cards').children, i = +c.slice(-1) - 1;
      if (cards[i]) cards[i].click();
      return true;
    }
    const inRange = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (c === 'ArrowDown' || c === 'ArrowUp' || ((c === 'ArrowLeft' || c === 'ArrowRight') && !inRange)) {
      this.moveFocus(c === 'ArrowDown' || c === 'ArrowRight' ? 1 : -1);
      e.preventDefault();
    }
    return true;       // swallow the rest; Enter / Space activate the focused control natively
  },

  moveFocus(d) {
    const el = this.$('scr-' + this.cur);
    const all = el.querySelectorAll('button, input');
    const items = [];
    for (let i = 0; i < all.length; i++) if (!all[i].hidden && all[i].offsetParent !== null) items.push(all[i]);
    if (!items.length) return;
    let i = items.indexOf(document.activeElement);
    i = i < 0 ? (d > 0 ? 0 : items.length - 1) : (i + d + items.length) % items.length;
    items[i].focus();
  },

  /* -------------------------------------------------------------- screens */
  title() {
    const ck = Save.data.ckpt, bc = this.$('btn-continue');
    if (ck && ck.gi > 0 && STAGES[ck.gi]) {
      bc.hidden = false;
      bc.textContent = 'Continue · ' + ZONES[STAGES[ck.gi].zone].name;
    } else bc.hidden = true;
    const rec = this.$('records');
    if (Save.data.best > 0) {
      rec.innerHTML = 'Best <b>' + fmt(Save.data.best) + '</b><i></i>Deepest <b>' + fmt(Save.data.deepest) + ' m</b>' +
        (Save.data.wins ? '<i></i>Reached the bottom <b>×' + Save.data.wins + '</b>' : '');
    } else rec.textContent = 'Five zones · fifteen stages · one very long way down';
    this.stack.length = 0;
    this.show('title');
  },

  pause() {
    const st = Game.stage;
    this.$('pause-sub').textContent = ZONES[st.zi].name + '  ·  ' + st.def.name + '  ·  ' + fmt(st.def.depth) + ' m';
    this.fillPerks(this.$('pause-perks'), Game.run.perks);
    this.stack.length = 0;
    this.show('pause');
  },

  fillPerks(el, perks) {
    el.innerHTML = '';
    const ids = Object.keys(perks || {});
    if (!ids.length) {
      const s = document.createElement('span');
      s.className = 'none'; s.textContent = 'No upgrades yet — clear a stage to choose one.';
      el.appendChild(s);
      return;
    }
    for (let i = 0; i < ids.length; i++) {
      const P = PERK_BY_ID[ids[i]];
      if (!P) continue;
      const d = document.createElement('div');
      d.className = 'chip'; d.title = P.desc;
      d.appendChild(this.iconCanvas(P.icon, 20, '#bff6ff'));
      const s = document.createElement('span');
      s.textContent = P.name + (perks[ids[i]] > 1 ? ' ' + ROMAN[perks[ids[i]]] : '');
      d.appendChild(s);
      el.appendChild(d);
    }
  },

  stat(label, value, cls) {
    return '<div class="stat ' + (cls || '') + '"><span>' + label + '</span><b>' + value + '</b></div>';
  },

  perk(info, choices, cb) {
    this.perkCb = cb;
    this.lockUntil = performance.now() + 550;
    this.$('perk-kicker').textContent = info.boss ? 'Guardian defeated' : 'Stage clear';
    this.$('perk-title').textContent = info.name;
    this.$('perk-stats').innerHTML =
      this.stat('Stage score', fmt(info.gained)) +
      this.stat('Clear bonus', '+' + fmt(info.bonus)) +
      (info.flawless ? this.stat('Flawless', '+' + fmt(info.flawless), 'gold') : '') +
      this.stat('Best chain', String(info.chain)) +
      this.stat('Total', fmt(info.total), 'big');
    // where we are on the way down
    const track = this.$('perk-track');
    track.innerHTML = '';
    for (let i = 0; i < STAGES.length; i++) {
      if (i && i % 3 === 0) track.appendChild(document.createElement('s'));
      const n = document.createElement('i');
      n.className = (STAGES[i].boss ? 'boss ' : '') + (i <= info.gi ? 'done' : i === info.gi + 1 ? 'next' : '');
      track.appendChild(n);
    }
    const nx = STAGES[info.gi + 1];
    this.$('perk-next').textContent = nx
      ? 'Next  ·  ' + (nx.zone !== STAGES[info.gi].zone ? ZONES[nx.zone].name + '  ·  ' : '') + nx.name + '  ·  ' + fmt(nx.depth) + ' m'
      : '';
    const wrap = this.$('perk-cards');
    wrap.innerHTML = '';
    for (let i = 0; i < choices.length; i++) {
      const P = choices[i], lvl = Game.perk(P.id);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card';
      if (i === 0) b.setAttribute('data-first', '');
      const key = document.createElement('span'); key.className = 'key'; key.textContent = String(i + 1);
      const tag = document.createElement('span'); tag.className = 'tag' + (lvl ? ' up' : ''); tag.textContent = lvl ? 'Upgrade' : 'New';
      const h = document.createElement('h3'); h.textContent = P.name + (lvl ? ' ' + ROMAN[lvl + 1] : '');
      const p = document.createElement('p'); p.textContent = P.desc;
      const pips = document.createElement('div'); pips.className = 'pips';
      for (let q = 0; q < P.max; q++) { const s = document.createElement('i'); if (q <= lvl) s.className = q === lvl ? 'new' : 'on'; pips.appendChild(s); }
      b.appendChild(key); b.appendChild(tag);
      b.appendChild(this.iconCanvas(P.icon, 60, '#dffaff'));
      b.appendChild(h); b.appendChild(p); b.appendChild(pips);
      b.addEventListener('click', () => this.pickPerk(P.id));
      wrap.appendChild(b);
    }
    this.stack.length = 0;
    this.show('perk');
  },

  pickPerk(id) {
    if (!this.perkCb || performance.now() < this.lockUntil) return;
    const cb = this.perkCb;
    this.perkCb = null;
    this.closeAll();
    cb(id);
  },

  over(info) {
    this.$('over-depth').textContent = fmt(info.depth) + ' m';
    this.$('over-where').textContent = info.zone + '  ·  ' + info.stage;
    this.$('over-stats').innerHTML =
      this.stat('Score', fmt(info.score), 'big') +
      this.stat(info.newBest ? 'New best!' : 'Best', fmt(info.best), info.newBest ? 'gold' : '') +
      this.stat('Bricks', fmt(info.stats.bricks)) +
      this.stat('Best chain', String(info.stats.maxChain)) +
      this.stat('Perfect pulses', String(info.stats.pulses));
    const br = this.$('btn-retry');
    br.hidden = !info.canRetry;
    br.textContent = 'Retry from the ' + info.retryZone.replace(/^The /, '');
    this.stack.length = 0;
    this.show('over');
  },

  win(info) {
    const s = info.stats, mins = Math.floor(s.time / 60), secs = Math.floor(s.time % 60);
    this.$('win-stats').innerHTML =
      this.stat('Final score', fmt(info.score), 'big') +
      this.stat(info.newBest ? 'New best!' : 'Best', fmt(info.best), info.newBest ? 'gold' : '') +
      this.stat('Pearls to spare', String(info.lives)) +
      this.stat('Bricks', fmt(s.bricks)) +
      this.stat('Best chain', String(s.maxChain)) +
      this.stat('Perfect pulses', String(s.pulses)) +
      this.stat('Dive time', mins + ':' + (secs < 10 ? '0' : '') + secs);
    this.fillPerks(this.$('win-perks'), info.perks);
    this.stack.length = 0;
    this.show('win');
  },

  banner(top, title, sub, cls) {
    const el = this.$('banner');
    el.className = '';
    void el.offsetWidth;                      // restart the CSS animation
    this.$('b-top').textContent = top;
    this.$('b-title').textContent = title;
    this.$('b-sub').textContent = sub;
    el.className = 'show ' + (cls || '');
  },

  toast(msg) {
    const el = this.$('toast');
    el.textContent = msg;
    el.className = '';
    void el.offsetWidth;
    el.className = 'show';
  },

  toggleMute() {
    const s = Save.data.settings;
    this.muted = !this.muted;
    Sound.setVolume('music', this.muted ? 0 : s.music);
    Sound.setVolume('sfx', this.muted ? 0 : s.sfx);
    this.toast(this.muted ? 'Sound off' : 'Sound on');
  },

  fullscreen() {
    try {
      const d = document, el = d.documentElement;
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } catch (e) { /* not available */ }
  },

  /* ------------------------------------------------------- small canvases */
  iconCanvas(name, size, color) {
    const c = document.createElement('canvas');
    c.className = 'ico';
    c.style.width = size + 'px'; c.style.height = size + 'px';
    this.paintIcon(c, name, color, size);
    return c;
  },
  paintIcon(c, name, color, size) {
    size = size || parseInt(c.getAttribute('data-size'), 10) || 28;
    const k = 2;
    c.width = size * k; c.height = size * k;
    c.style.width = size + 'px'; c.style.height = size + 'px';
    const x = c.getContext('2d');
    if (!x) return;
    x.setTransform(k, 0, 0, k, size * k / 2, size * k / 2);
    Icons.draw(x, name, size * 0.82, color);
  },

  buildHelp() {
    const caps = this.$('help-caps');
    for (const id in POWERUPS) {
      const P = POWERUPS[id];
      const d = document.createElement('div'); d.className = 'legend';
      const c = document.createElement('canvas');
      c.width = 104; c.height = 104; c.style.width = '40px'; c.style.height = '40px';
      const x = c.getContext('2d');
      if (x) { x.scale(2, 2); paintCapsule(x, id); }
      const t = document.createElement('div');
      const b = document.createElement('b'); b.textContent = P.name; if (!P.good) b.className = 'bad';
      const s = document.createElement('span'); s.textContent = P.desc;
      t.appendChild(b); t.appendChild(s);
      d.appendChild(c); d.appendChild(t);
      caps.appendChild(d);
    }
    const bricks = this.$('help-bricks');
    const list = [
      ['stone', '#93a9bd', 'solid', 'Stone', 'Two hits. Banded basalt takes three.'],
      ['steel', '#9aa9ba', 'solid', 'Steel', 'Unbreakable — unless something explodes.'],
      ['oyster', '#f4e9ff', 'solid', 'Oyster', 'Sets a new pearl loose.'],
      ['gold', '#ffc94a', 'solid', 'Treasure', 'Always drops a capsule.'],
      ['mine', '#ff5a5a', 'neon', 'Mine', 'Detonates and takes its neighbours along.'],
      ['eel', '#ffe45c', 'neon', 'Eel', 'Shocks its entire row.'],
      ['phantom', '#7ff5ff', 'neon', 'Phantom', 'Flickers in and out of reach.'],
      ['ink', '#8a5cff', 'neon', 'Ink sac', 'Bursts into a blinding cloud.'],
      ['hot', '#ff7b2e', 'neon', 'Magma', 'Burns on a short fuse, then erupts.'],
    ];
    for (let i = 0; i < list.length; i++) {
      const L = list[i];
      const d = document.createElement('div'); d.className = 'legend';
      const c = document.createElement('canvas');
      c.width = CELL_W * 2; c.height = CELL_H * 2; c.style.width = CELL_W + 'px'; c.style.height = CELL_H + 'px';
      const x = c.getContext('2d');
      if (x) { x.scale(2, 2); paintBrick(x, L[0], L[1], 0, L[2]); }
      const t = document.createElement('div');
      const b = document.createElement('b'); b.textContent = L[3];
      const s = document.createElement('span'); s.textContent = L[4];
      t.appendChild(b); t.appendChild(s);
      d.appendChild(c); d.appendChild(t);
      bricks.appendChild(d);
    }
  },
};
