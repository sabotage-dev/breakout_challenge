/* SHATTERWAVE — bootstrap & main loop */
'use strict';
(function () {
  const canvas = document.getElementById('game');
  const g = canvas.getContext('2d', { alpha: false });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const scale = Math.min(w / SW.W, h / SW.H);
    const v = SW.view;
    v.scale = scale; v.dpr = dpr; v.w = w; v.h = h;
    v.ox = (w - SW.W * scale) / 2;
    v.oy = (h - SW.H * scale) / 2;
    // tall portrait screens: pin the field to the top, leave a thumb strip below
    if (h / w > 1.5) v.oy = Math.min(v.oy, Math.max(6, h * 0.02));
    document.documentElement.style.setProperty('--strip', Math.max(0, h - (v.oy + SW.H * scale)) + 'px');
    SW.gfx.setRes(scale * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  SW.input.init(canvas);
  SW.game.init();
  SW.ui.init();
  SW.game.startDemo();

  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented && e.code === 'Escape') return;
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') return;
    if (e.code === 'KeyM' && SW.ui.booted) {
      const m = SW.audio.toggleMute();
      SW.fx.text(SW.W / 2, 640, m ? 'SOUND OFF' : 'SOUND ON', '#ffffff', 20, { life: 1 });
    }
    if ((e.code === 'Escape' || e.code === 'KeyP') && !SW.ui.current) { SW.ui.pause(); e.preventDefault(); }
    else if (e.code === 'KeyP' && SW.ui.current === 'pause') SW.ui.resume();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { SW.ui.pause(); SW.audio.suspend(); }
    else SW.audio.resume();
  });
  window.addEventListener('blur', () => SW.ui.pause());

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.05) dt = 0.05;
    try {
      SW.input.pollGamepad();
      SW.game.update(dt);
      SW.render.draw(g, canvas, dt);
      SW.ui.updateTouch();
    } catch (err) {
      console.error(err);
    }
    SW.input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  SW.canvas = canvas;
})();
