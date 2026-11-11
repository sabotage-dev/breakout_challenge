/* Lanternwake — boot, input and the frame loop */
(function () {
  'use strict';
  const LW = window.LW, G = LW.G, A = LW.Audio, UI = LW.UI;
  window.__lwErrors = [];

  function boot() {
    const canvas = document.getElementById('game');
    LW.Save.load();
    LW.Render.init(canvas);
    UI.init();
    G.toTitle();
    if (LW.debug.stage >= 0) {
      if (LW.query.wishes) String(LW.query.wishes).split(',').forEach((id) => { if (LW.WISH_BY_ID[id]) G.wishes[id] = (G.wishes[id] || 0) + 1; });
      const keep = G.wishes;
      G.newRun(LW.debug.stage);
      G.wishes = keep;
    } else if (LW.debug.auto) G.newRun(0);

    const toX = (e) => (e.clientX - G.view.offX) / G.view.scale;
    const inGame = () => !UI.current && (G.mode === 'ready' || G.mode === 'play' || G.mode === 'clear' || G.mode === 'dawn');

    canvas.addEventListener('pointermove', (e) => {
      if (G.mode === 'title') return;
      G.input.x = toX(e);
      G.input.useKeys = false;
    });
    canvas.addEventListener('pointerdown', (e) => {
      A.init();
      if (G.mode !== 'title') { G.input.x = toX(e); G.input.useKeys = false; }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (inGame()) G.action();
      e.preventDefault();
    });
    window.addEventListener('pointerdown', () => A.init(), true);
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      const k = e.code;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      A.init();
      if (k === 'ArrowLeft' || k === 'KeyA') { G.input.left = true; G.input.useKeys = true; e.preventDefault(); return; }
      if (k === 'ArrowRight' || k === 'KeyD') { G.input.right = true; G.input.useKeys = true; e.preventDefault(); return; }
      if (e.repeat) { if (k === 'Space' || k === 'ArrowUp' || k === 'ArrowDown') e.preventDefault(); return; }
      switch (k) {
        case 'Space': case 'ArrowUp': case 'KeyW': case 'Enter':
          e.preventDefault();
          if (UI.current) {
            // let a focused control (slider, button) handle its own key
            const tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'BUTTON') return;
            UI.primary();
          } else if (inGame()) G.action();
          break;
        case 'KeyP': case 'Escape':
          if (UI.back()) break;
          if (UI.current === 'pause' || !UI.current) G.togglePause();
          break;
        case 'KeyM': UI.toggleMute(); break;
        case 'KeyF': UI.toggleFullscreen(); break;
        case 'Digit1': case 'Numpad1': UI.chooseWish(0); break;
        case 'Digit2': case 'Numpad2': UI.chooseWish(1); break;
        case 'Digit3': case 'Numpad3': UI.chooseWish(2); break;
        default: break;
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.code;
      if (k === 'ArrowLeft' || k === 'KeyA') G.input.left = false;
      if (k === 'ArrowRight' || k === 'KeyD') G.input.right = false;
    });

    const autoPause = () => {
      G.input.left = G.input.right = false;
      if (!LW.debug.auto && (G.mode === 'play' || G.mode === 'ready') && !G.paused && !UI.current) G.togglePause(true);
    };
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { autoPause(); if (!LW.debug.auto) A.suspend(); }
      else A.resume();
    });

    let last = performance.now();
    let cursorHidden = null, wasIngame = null;
    function frame(now) {
      window.requestAnimationFrame(frame);
      let rdt = (now - last) / 1000;
      last = now;
      if (rdt > 0.25 || rdt <= 0) rdt = 1 / 60;
      if (rdt > 1 / 30) rdt = 1 / 30;
      try {
        if (!G.paused) for (let i = 0; i < LW.debug.fast; i++) G.update(rdt);
        LW.Render.draw(rdt);
      } catch (err) {
        if (window.__lwErrors.length < 20) {
          window.__lwErrors.push(String(err && err.stack ? err.stack : err));
          if (window.console) console.error(err);
        }
      }
      const hide = !G.paused && !UI.current && (G.mode === 'play' || G.mode === 'ready');
      if (hide !== cursorHidden) {
        cursorHidden = hide;
        document.body.classList.toggle('playing', hide);
      }
      const ingame = G.mode === 'play' || G.mode === 'ready' || G.mode === 'clear';
      if (ingame !== wasIngame) {
        wasIngame = ingame;
        document.body.classList.toggle('ingame', ingame);
      }
    }
    window.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
