/* Lanternwake — menus and overlays (DOM) */
(function () {
  'use strict';
  const LW = window.LW, U = LW.U, Art = LW.Art, A = LW.Audio;
  const UI = (LW.UI = { current: null });
  const $ = (id) => document.getElementById(id);
  let G = null;
  let wishOpts = null, wishReadyAt = 0;

  const CHARM_DESC = {
    split: 'Every spark splits into three.',
    wide: 'A longer boat, for a while.',
    blaze: 'Sparks burn straight through lanterns.',
    slow: 'Sparks drift more slowly.',
    catch: 'Sparks stick to the boat. Click to let go.',
    rockets: 'Your boat fires skyrockets.',
    bridge: 'A lotus bridge saves one fallen spark.',
    swarm: 'Fireflies fly out and wake lanterns.',
    life: 'One spare spark.',
    gale: 'Dodge it! Sparks fly faster.',
    shrink: 'Dodge it! Your boat shrinks.',
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  UI.show = function (name) {
    UI.current = name || null;
    const list = document.querySelectorAll('.screen');
    for (let i = 0; i < list.length; i++) list[i].classList.toggle('show', list[i].id === 'scr-' + name);
    if (name === 'title') refreshBest();
    if (name === 'pause') fillOwned($('pause-wishes'), true);
  };

  function refreshBest() {
    const b = G.best, line = $('best-line');
    if (b.score > 0) {
      line.textContent = (b.won ? 'Dawn reached  ·  ' : '') + 'Best ' + U.fmt(b.score) + '  ·  Furthest stage ' + b.stage + ' / ' + LW.STAGES.length;
      line.style.visibility = 'visible';
    } else line.style.visibility = 'hidden';
  }

  function fillOwned(box, withLabel) {
    box.innerHTML = '';
    const ids = Object.keys(G.wishes);
    if (!ids.length) return;
    if (withLabel) box.appendChild(el('p', 'owned-label', 'Wishes this run'));
    const row = el('div', 'owned-row');
    ids.forEach((id) => {
      const w = LW.WISH_BY_ID[id];
      if (!w) return;
      const chip = el('span', 'chip');
      chip.title = w.name + ' — ' + w.desc;
      chip.appendChild(Art.iconCanvas(w.icon, 22, '#ffe6b8'));
      chip.appendChild(el('span', '', w.name + (G.wishes[id] > 1 ? ' ×' + G.wishes[id] : '')));
      row.appendChild(chip);
    });
    box.appendChild(row);
  }

  /* -------------------------------------------------------------- wishes ---- */
  UI.showWish = function (opts) {
    wishOpts = opts;
    wishReadyAt = performance.now() + (LW.debug.auto ? 0 : 520);
    const def = G.def;
    $('wish-eyebrow').textContent = def.boss ? def.name + ' is quelled' : def.name + ' — every lantern awake';
    const wrap = $('wish-cards');
    wrap.innerHTML = '';
    opts.forEach((w, i) => {
      const card = el('button', 'card');
      card.type = 'button';
      card.style.animationDelay = i * 0.11 + 's';
      card.appendChild(el('span', 'key', String(i + 1)));
      const ic = el('div', 'card-icon');
      ic.appendChild(Art.iconCanvas(w.icon, 58, '#fff4dc'));
      card.appendChild(ic);
      card.appendChild(el('h3', '', w.name));
      card.appendChild(el('p', '', w.desc));
      const have = G.wish(w.id);
      if (w.max > 1 && w.max < 50) {
        const pips = el('div', 'pips');
        for (let k = 0; k < w.max; k++) pips.appendChild(el('i', k < have ? 'on' : k === have ? 'next' : ''));
        card.appendChild(pips);
      }
      card.addEventListener('click', () => UI.chooseWish(i));
      card.addEventListener('pointerenter', () => A.sfx.tick());
      wrap.appendChild(card);
    });
    UI.show('wish');
    if (LW.debug.auto) window.setTimeout(() => UI.chooseWish(0), 250);
  };
  UI.chooseWish = function (i) {
    if (UI.current !== 'wish' || !wishOpts || !wishOpts[i]) return;
    if (performance.now() < wishReadyAt) return;
    const w = wishOpts[i];
    wishOpts = null;
    G.takeWish(w.id);
  };

  /* ----------------------------------------------------------------- end ---- */
  UI.showEnd = function (won) {
    const def = G.def, st = G.stats;
    const newBest = G.score > 0 && G.score >= G.best.score;
    $('end-eyebrow').textContent = won ? 'The longest night is over' : 'Night ' + U.roman(def.night) + '  ·  ' + def.name;
    $('end-title').textContent = won ? 'Dawn' : 'The spark went out';
    $('end-sub').textContent = won
      ? 'Every lantern is awake, and the river remembers the light.'
      : U.pick(['The river is patient. Light it again.', 'Somewhere upstream, a lantern is still waiting.', 'Even the longest night can be relit.']);
    const stats = $('end-stats');
    stats.innerHTML = '';
    const mins = Math.floor(st.time / 60), secs = Math.floor(st.time % 60);
    const rows = [
      ['Score', U.fmt(G.score)],
      ['Best', U.fmt(G.best.score)],
      ['Stage reached', (G.stage + 1) + ' / ' + LW.STAGES.length],
      ['Lanterns woken', U.fmt(st.lanterns)],
      ['Longest chain', String(st.bestChain)],
      ['Flare shots', String(st.flares)],
      ['Time on the river', mins + ':' + (secs < 10 ? '0' : '') + secs],
    ];
    rows.forEach((r, i) => {
      stats.appendChild(el('span', 'k', r[0]));
      const v = el('span', 'v' + (i === 0 ? ' big' : ''), r[1]);
      if (i === 0 && newBest) v.appendChild(el('span', 'badge', 'New best'));
      stats.appendChild(v);
    });
    fillOwned($('end-wishes'), true);
    $('scr-end').classList.toggle('won', !!won);
    UI.show('end');
  };

  /* ---------------------------------------------------------------- init ---- */
  function updateSoundBtn() {
    $('btn-sound').classList.toggle('off', A.muted);
    $('btn-sound').title = A.muted ? 'Unmute (M)' : 'Mute (M)';
  }
  UI.toggleMute = function () {
    A.init();
    A.setMuted(!A.muted);
    G.opts.muted = A.muted;
    LW.Save.store();
    updateSoundBtn();
  };
  UI.toggleFullscreen = function () {
    const d = document, e = d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (e.requestFullscreen || e.webkitRequestFullscreen).call(e);
    } catch (err) { /* fullscreen not available */ }
  };
  // Enter / Space on a menu presses its main button.
  UI.primary = function () {
    const map = { title: 'btn-start', how: 'btn-how-back', pause: 'btn-resume', end: 'btn-again' };
    const id = map[UI.current];
    if (id) $(id).click();
    return !!id;
  };
  UI.back = function () {
    if (UI.current === 'how') { $('btn-how-back').click(); return true; }
    return false;
  };

  UI.init = function () {
    G = LW.G;
    const click = (id, fn) => $(id).addEventListener('click', (e) => { A.init(); A.sfx.select(); fn(e); e.currentTarget.blur(); });

    click('btn-start', () => G.newRun(0));
    click('btn-how', () => UI.show('how'));
    click('btn-how-back', () => UI.show('title'));
    click('btn-resume', () => G.togglePause(false));
    click('btn-restart', () => G.newRun(0));
    click('btn-quit', () => G.toTitle());
    click('btn-again', () => G.newRun(0));
    click('btn-title', () => G.toTitle());
    $('btn-pause').addEventListener('click', (e) => { A.init(); G.togglePause(); e.currentTarget.blur(); });
    $('btn-sound').addEventListener('click', (e) => { UI.toggleMute(); e.currentTarget.blur(); });
    $('btn-full').addEventListener('click', (e) => { UI.toggleFullscreen(); e.currentTarget.blur(); });

    const buttons = document.querySelectorAll('.btn');
    for (let i = 0; i < buttons.length; i++) buttons[i].addEventListener('pointerenter', () => A.sfx.tick());

    const m = $('vol-music'), s = $('vol-sfx'), sh = $('opt-shake');
    m.value = Math.round(G.opts.music * 100);
    s.value = Math.round(G.opts.sfx * 100);
    sh.checked = G.opts.shake !== false;
    m.addEventListener('input', () => { G.opts.music = m.value / 100; A.setMusicVol(G.opts.music); LW.Save.store(); });
    s.addEventListener('input', () => { G.opts.sfx = s.value / 100; A.setSfxVol(G.opts.sfx); LW.Save.store(); });
    s.addEventListener('change', () => A.sfx.select());
    sh.addEventListener('change', () => { G.opts.shake = sh.checked; LW.Save.store(); });
    if (G.opts.muted) A.muted = true;
    updateSoundBtn();

    // title lantern + favicon straight from the game's own sprite
    try {
      $('logo-lantern').src = Art.lanternDataURL('r');
    } catch (e) { /* decorative only */ }

    // how-to-play: lantern legend
    const legend = $('lantern-legend');
    [
      ['paper', 'o', 1, 'Lit lantern', 'one touch'],
      ['dark', 'b', 2, 'Sleeping lantern', 'two touches'],
      ['stone', 'r', 3, 'Stone lantern', 'three touches'],
      ['cracker', 'r', 1, 'Firecrackers', 'burst nearby'],
      ['gold', 'y', 1, 'Gilded lantern', 'drops a charm'],
      ['bell', 'r', 1, 'Bronze bell', 'never breaks'],
    ].forEach((d) => {
      const item = el('div', 'legend-item');
      const img = new Image();
      img.src = Art.brickSprite(d[0], d[1], d[2]).toDataURL();
      img.alt = '';
      item.appendChild(img);
      const tx = el('div', 'legend-text');
      tx.appendChild(el('b', '', d[3]));
      tx.appendChild(el('span', '', d[4]));
      item.appendChild(tx);
      legend.appendChild(item);
    });
    const list = $('charm-list');
    Object.keys(LW.CHARMS).forEach((k) => {
      const d = LW.CHARMS[k];
      const item = el('div', 'charm-item' + (d.bad ? ' bad' : ''));
      const img = new Image();
      img.src = Art.charmSprite(k).toDataURL();
      img.alt = '';
      item.appendChild(img);
      const tx = el('div', 'legend-text');
      tx.appendChild(el('b', '', d.name));
      tx.appendChild(el('span', '', CHARM_DESC[k] || ''));
      item.appendChild(tx);
      list.appendChild(item);
    });
  };
})();
