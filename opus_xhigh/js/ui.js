'use strict';
/* =====================================================================
   PRISM BREAKER — menus, input and boot
   ===================================================================== */

const UI = {
  current: null,
  optionsReturn: 'scr-title',
  show(id) {
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae.blur) ae.blur();
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    this.current = id || null;
    document.body.classList.toggle('menu-open', !!id);
    if (id === 'scr-title') $('#title-hi').textContent = hiScore().toLocaleString();
    if (id) {
      const first = this.focusables()[0];
      if (first) setTimeout(() => { if (UI.current === id) first.focus({ preventScroll: true }); }, 40);
    }
  },
  hide() { this.show(null); },
  focusables() {
    if (!this.current) return [];
    return [...document.querySelectorAll('#' + this.current + ' button:not([disabled]), #' + this.current + ' input')]
      .filter(el => el.offsetParent !== null);
  },
  showEnd(kind) {
    const id = kind === 'victory' ? 'scr-victory' : 'scr-gameover';
    const root = $('#' + id);
    root.querySelector('.final-score').textContent = Math.floor(G.score).toLocaleString();
    root.querySelector('.final-stage').textContent = G.mode === 'endless'
      ? 'Reached wave ' + (G.levelIndex + 1) + ' of the Endless Rift'
      : (kind === 'victory' ? 'All 15 stages cleared · ' + G.lives + (G.lives === 1 ? ' life' : ' lives') + ' remaining' : 'Fell at stage ' + stageLabel() + ' — ' + G.level.name);
    const retry = root.querySelector('[data-act="retry"]');
    if (retry) retry.textContent = G.mode === 'endless' ? 'Retry the Rift' : 'Retry Sector ' + (Math.floor(G.levelIndex / 5) + 1);
    const box = root.querySelector('.hs');
    const stage = G.mode === 'endless' ? 'E' + (G.levelIndex + 1) : stageLabel();
    const score = Math.floor(G.score);
    if (qualifies(score)) renderEntry(box, score, stage);
    else box.innerHTML = scoresHTML(-1);
    this.show(id);
  },
};

// ---------------------------------------------------------------------
// High scores
// ---------------------------------------------------------------------
let lastName = Store.get('lastName', '');
function qualifies(score) { return score > 0 && (Scores.length < 10 || score > Scores[Scores.length - 1].score); }
function scoresHTML(hl) {
  return '<ol class="scores">' + Scores.map((s, i) =>
    `<li class="${i === hl ? 'hl' : ''}"><span class="rank">${String(i + 1).padStart(2, '0')}</span><span class="nm">${esc(s.name)}</span><span class="st">${esc(s.stage)}</span><span class="sc">${Number(s.score).toLocaleString()}</span></li>`
  ).join('') + '</ol>';
}
function renderEntry(box, score, stage) {
  box.innerHTML = `<div class="entry">
      <div class="entry-title">NEW HIGH SCORE</div>
      <div class="entry-row"><input id="name-in" type="text" maxlength="3" value="${esc(lastName)}" autocomplete="off" spellcheck="false" aria-label="Your initials" placeholder="AAA"><button class="btn small" data-act="savename">Save</button></div>
      <div class="entry-hint">Type your initials · Enter to save</div>
    </div>`;
  box._pending = { score, stage };
  const inp = box.querySelector('#name-in');
  inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); });
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) saveName(box); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const l = UI.focusables(); if (l[1]) l[1].focus(); }
  });
}
function saveName(box) {
  const pend = box._pending;
  if (!pend) return;
  box._pending = null;
  const inp = box.querySelector('#name-in');
  const name = (inp && inp.value ? inp.value : 'ACE').toUpperCase().slice(0, 3);
  lastName = name; Store.set('lastName', name);
  const entry = { name, score: pend.score, stage: pend.stage };
  if (G.runEntry) { const old = Scores.indexOf(G.runEntry); if (old >= 0) Scores.splice(old, 1); }
  G.runEntry = entry;
  Scores.push(entry);
  Scores.sort((a, b) => b.score - a.score);
  Scores = Scores.slice(0, 10);
  Store.set('scores', Scores);
  box.innerHTML = scoresHTML(Scores.indexOf(entry));
  Sound.fx.menuSelect();
  setTimeout(() => { const l = UI.focusables(); if (l[0]) l[0].focus(); }, 30);
}

// ---------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------
function sectorUnlocked(i) {
  if (i === 3) return Progress.maxLevel >= 5 || Progress.beaten;
  return Progress.maxLevel >= i * 5;
}
function buildSelect() {
  const wrap = $('#select-cards');
  wrap.innerHTML = '';
  [...SECTORS, ENDLESS_SECTOR].forEach((s, i) => {
    const ok = sectorUnlocked(i);
    const btn = document.createElement('button');
    btn.className = 'card' + (ok ? '' : ' locked');
    btn.dataset.act = 'sector';
    btn.dataset.sector = String(i);
    btn.disabled = !ok;
    btn.style.setProperty('--c1', s.accent);
    btn.style.setProperty('--c2', s.accent2);
    let info;
    if (!ok) info = i === 3 ? 'Locked · reach Sector 2 to open the Rift' : 'Locked · reach this sector to unlock';
    else if (i === 3) info = 'Procedural waves · boss every 5th' + (Progress.bestWave ? ' · best: wave ' + Progress.bestWave : '');
    else info = 'Stages ' + (i + 1) + '-1 to ' + (i + 1) + '-5 · Guardian: ' + LEVELS[i * 5 + 4].name;
    btn.innerHTML = `<span class="card-sub">${s.sub}</span><span class="card-name">${s.name}</span><span class="card-info">${info}</span>`;
    wrap.appendChild(btn);
  });
}
function legendImg(paint, w, h) {
  const s = sprite('legend', w, h, 10, paint, 2);
  return s.c.toDataURL();
}
function buildHowTo() {
  const pu = $('#legend-pu');
  pu.innerHTML = Object.keys(PU).map(k => {
    const src = legendImg((g, w, h) => paintCapsule(g, k, w, h), CAP_W, CAP_H);
    return `<li><img src="${src}" alt="" class="cap"><span><b style="color:${PU[k].bad ? '#ff8080' : PU[k].color}">${PU[k].name}</b> ${PU[k].desc}</span></li>`;
  }).join('');
  const kinds = [
    ['normal', '#3de8ff', 'Standard', 'One hit'],
    ['tough', '#ff8a3d', 'Armored', 'Two hits'],
    ['ultra', '#dfe6ff', 'Ultra', 'Three hits'],
    ['steel', '#9aa3b8', 'Steel', 'Indestructible'],
    ['explosive', '#ff3b3b', 'Volatile', 'Explodes · chain reactions'],
    ['prism', '#ffffff', 'Prism', 'Splits light: +2 balls'],
    ['gold', '#ffd84d', 'Gold', 'Guaranteed power-up'],
  ];
  $('#legend-br').innerHTML = kinds.map(([kind, color, name, desc]) => {
    const src = legendImg((g, w, h) => paintBrick(g, kind, color, w, h, 0), 46, 18);
    return `<li><img src="${src}" alt="" class="brk"><span><b>${name}</b> ${desc}</span></li>`;
  }).join('');
}
function applySettings() {
  document.body.classList.toggle('no-crt', !Settings.crt);
  Sound.setVolumes(Settings.music, Settings.sfx);
}
function syncOptions() {
  $('#opt-music').value = Math.round(Settings.music * 100);
  $('#opt-sfx').value = Math.round(Settings.sfx * 100);
  document.querySelectorAll('#scr-options [data-act="toggle"]').forEach(b => {
    const on = !!Settings[b.dataset.key];
    b.querySelector('b').textContent = on ? 'ON' : 'OFF';
    b.classList.toggle('off', !on);
  });
}
let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
}
function retry() {
  if (G.mode === 'endless') startGame(0, 'endless');
  else startGame(Math.floor(G.levelIndex / 5) * 5, 'campaign');
}

$('#ui').addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  Sound.init();
  const act = el.dataset.act;
  if (act === 'retry' || act === 'title' || act === 'endless') {
    document.querySelectorAll('.hs').forEach(box => { if (box._pending) saveName(box); });
  }
  if (act !== 'toggle' && act !== 'savename') Sound.fx.menuSelect();
  switch (act) {
    case 'new': startGame(0, 'campaign'); break;
    case 'select': buildSelect(); UI.show('scr-select'); break;
    case 'howto': UI.show('scr-howto'); break;
    case 'scores': $('#scores-box').innerHTML = scoresHTML(-1); UI.show('scr-scores'); break;
    case 'options': UI.optionsReturn = UI.current; syncOptions(); UI.show('scr-options'); break;
    case 'back': UI.show(UI.current === 'scr-options' ? UI.optionsReturn : 'scr-title'); break;
    case 'sector': { const s = +el.dataset.sector; if (s === 3) startGame(0, 'endless'); else startGame(s * 5, 'campaign'); break; }
    case 'resume': resumeGame(); break;
    case 'restart': restartLevel(); break;
    case 'quit': case 'title': toTitle(); break;
    case 'retry': retry(); break;
    case 'endless': startGame(0, 'endless', true); break;
    case 'toggle': {
      const key = el.dataset.key;
      Settings[key] = !Settings[key];
      saveSettings(); applySettings(); syncOptions();
      Sound.fx.menuMove();
      break;
    }
    case 'savename': saveName(el.closest('.hs')); break;
  }
});
$('#ui').addEventListener('mouseover', e => {
  const b = e.target.closest('button');
  if (document.activeElement && document.activeElement.id === 'name-in') return;
  if (b && !b.disabled && document.activeElement !== b) {
    b.focus({ preventScroll: true });
    if (Sound.ready) Sound.fx.menuMove();
  }
});
$('#opt-music').addEventListener('input', e => { Settings.music = e.target.value / 100; applySettings(); saveSettings(); });
$('#opt-sfx').addEventListener('input', e => { Settings.sfx = e.target.value / 100; applySettings(); saveSettings(); Sound.fx.paddle(); });

// ---------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------
let secret = '';
window.addEventListener('keydown', e => {
  Sound.init();
  const k = e.key;
  const t = e.target;
  if (t && t.tagName === 'INPUT' && t.type === 'text') return;

  if (k.length === 1) {
    secret = (secret + k.toLowerCase()).slice(-5);
    if (secret === 'prism' && G.state === 'menu') {
      Progress.maxLevel = Math.max(Progress.maxLevel, 14); saveProgress();
      toast('ALL SECTORS UNLOCKED');
      Sound.fx.extraLife();
      if (UI.current === 'scr-select') buildSelect();
      return;
    }
  }
  if (k === 'm' || k === 'M') { toast(Sound.toggleMute() ? 'SOUND OFF' : 'SOUND ON'); return; }

  if (UI.current) {
    if (e.repeat && (k === ' ' || k === 'Enter')) { e.preventDefault(); return; }
    const isRange = t && t.type === 'range';
    if (k === 'ArrowDown' || k === 'ArrowUp' || ((k === 'ArrowLeft' || k === 'ArrowRight') && !isRange)) {
      const list = UI.focusables();
      if (!list.length) return;
      e.preventDefault();
      let i = list.indexOf(document.activeElement);
      const back = k === 'ArrowUp' || k === 'ArrowLeft';
      i = back ? (i <= 0 ? list.length - 1 : i - 1) : (i + 1) % list.length;
      list[i].focus({ preventScroll: true });
      Sound.fx.menuMove();
    } else if (k === 'Escape' || k === 'Backspace') {
      e.preventDefault();
      if (UI.current === 'scr-pause') resumeGame();
      else if (UI.current === 'scr-options') UI.show(UI.optionsReturn);
      else if (['scr-select', 'scr-howto', 'scr-scores'].includes(UI.current)) UI.show('scr-title');
    } else if ((k === 'p' || k === 'P') && UI.current === 'scr-pause') {
      resumeGame();
    }
    return;
  }

  switch (k) {
    case 'ArrowLeft': case 'a': case 'A': Input.left = true; Input.mode = 'keys'; e.preventDefault(); break;
    case 'ArrowRight': case 'd': case 'D': Input.right = true; Input.mode = 'keys'; e.preventDefault(); break;
    case ' ': case 'ArrowUp': case 'w': case 'W': case 'Enter':
      if (!e.repeat) Input.firePressed = true;
      Input.fire = true; e.preventDefault(); break;
    case 'e': case 'E': case 'Shift': case 'q': case 'Q': Input.odPressed = true; break;
    case 'p': case 'P': case 'Escape': if (G.state === 'playing') pauseGame(); break;
  }
});
window.addEventListener('keyup', e => {
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': Input.left = false; break;
    case 'ArrowRight': case 'd': case 'D': Input.right = false; break;
    case ' ': case 'ArrowUp': case 'w': case 'W': case 'Enter': Input.fire = false; break;
  }
});
window.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  Input.px = (e.clientX - r.left) / r.width * W;
  if (Input.mode !== 'pointer' && (Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2)) Input.mode = 'pointer';
});
canvas.addEventListener('mousedown', e => {
  Sound.init();
  if (UI.current) return;
  if (e.button === 2) { Input.odPressed = true; return; }
  Input.firePressed = true; Input.fire = true;
  const r = canvas.getBoundingClientRect();
  Input.px = (e.clientX - r.left) / r.width * W;
  Input.mode = 'pointer';
});
window.addEventListener('mouseup', () => { Input.fire = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function touchX(t) {
  const r = canvas.getBoundingClientRect();
  Input.px = (t.clientX - r.left) / r.width * W;
}
stageEl.addEventListener('touchstart', e => {
  Sound.init();
  Input.touch = true;
  document.body.classList.add('touch');
  if (UI.current || e.target.closest('button, input')) return;
  e.preventDefault();
  Input.mode = 'touch';
  if (e.touches.length >= 2) { Input.odPressed = true; return; }
  touchX(e.changedTouches[0]);
  Input.firePressed = true;
}, { passive: false });
stageEl.addEventListener('touchmove', e => {
  if (UI.current || e.target.closest('button, input')) return;
  e.preventDefault();
  touchX(e.touches[0]);
}, { passive: false });
['touchend', 'click', 'pointerup'].forEach(ev => window.addEventListener(ev, () => Sound.init(), { passive: true }));

$('#btn-pause').addEventListener('click', () => { Sound.init(); if (G.state === 'playing') pauseGame(); });
$('#btn-od').addEventListener('click', () => { Input.odPressed = true; });

window.addEventListener('blur', () => { clearHeldInput(); if (G.state === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearHeldInput(); if (G.state === 'playing') pauseGame(); } });

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
function boot() {
  resize();
  window.addEventListener('resize', resize);
  applySettings();
  buildHowTo();
  const q = new URLSearchParams(location.search);
  if (q.has('level') || q.has('mode')) {
    // developer shortcuts: ?level=7  ?mode=endless  ?autoplay=1
    G.autoplay = q.get('autoplay') === '1';
    startGame(clamp(parseInt(q.get('level') || '1', 10) - 1, 0, LEVELS.length - 1), q.get('mode') === 'endless' ? 'endless' : 'campaign');
  } else {
    toTitle();
  }
  requestAnimationFrame(frame);
}
window.PB = { G, startGame, loadLevel, Sound, UI, Progress };
boot();
