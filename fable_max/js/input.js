'use strict';
/* ==========================================================================
   HADAL — input: mouse, keyboard and touch
   ========================================================================== */

const Input = {
  x: W / 2,
  mode: 'pointer',          // 'pointer' | 'keys' — whichever was used last
  touch: false,
  left: false, right: false,
  focusKey: false, focusBtn: false, focusTouch: false, focusPad: false,
  actionQ: 0,
  primary: null, secondary: null, secondaryT: 0,
  padAxis: 0, padPrev: { a: false, start: false, up: false, down: false },

  get focus() { return this.focusKey || this.focusBtn || this.focusTouch || this.focusPad; },
  consume() { if (this.actionQ > 0) { this.actionQ = 0; return true; } return false; },
  press() { this.actionQ = 1; },
  reset() {
    this.left = this.right = false;
    this.focusKey = this.focusBtn = this.focusTouch = false;
    this.primary = this.secondary = null;
    this.actionQ = 0;
  },

  init(canvas) {
    const unlock = () => { Sound.init(); Sound.resume(); };
    window.addEventListener('mousedown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('touchend', unlock, true);

    /* ---- mouse ---- */
    window.addEventListener('mousemove', (e) => { this.x = View.toX(e.clientX); this.mode = 'pointer'; }, { passive: true });
    canvas.addEventListener('mousedown', (e) => {
      if (UI.blocking()) return;
      e.preventDefault();
      this.x = View.toX(e.clientX); this.mode = 'pointer';
      if (e.button === 2) this.focusBtn = true;
      else if (e.button === 0) this.press();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 2) this.focusBtn = false; });
    window.addEventListener('contextmenu', (e) => { if (Game.mode === 'play' || e.target === canvas) e.preventDefault(); });

    /* ---- touch: first finger steers, a second finger pulses (tap) or focuses (hold) ---- */
    canvas.addEventListener('touchstart', (e) => {
      if (UI.blocking()) return;
      e.preventDefault();
      this.touch = true;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (this.primary === null) {
          this.primary = t.identifier;
          this.x = View.toX(t.clientX); this.mode = 'pointer';
          this.press();
        } else if (this.secondary === null) {
          this.secondary = t.identifier;
          this.secondaryT = performance.now();
          this.press();
        }
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.primary) { this.x = View.toX(t.clientX); this.mode = 'pointer'; }
      }
    }, { passive: false });
    const end = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const id = e.changedTouches[i].identifier;
        if (id === this.primary) { this.primary = this.secondary; this.secondary = null; this.focusTouch = false; }
        else if (id === this.secondary) { this.secondary = null; this.focusTouch = false; }
      }
    };
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);

    /* ---- keyboard ---- */
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));

    window.addEventListener('blur', () => {
      this.reset();
      if (Game.mode === 'play' && !Game.paused && !Game.auto) Game.togglePause(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.reset();
        if (Game.mode === 'play' && !Game.paused && !Game.auto) Game.togglePause(true);
        Sound.suspend();
      } else Sound.resume();
    });
  },

  tick() {
    if (this.secondary !== null && !this.focusTouch && performance.now() - this.secondaryT > 230) this.focusTouch = true;
    this.pollPad();
  },

  /* optional gamepad: stick / d-pad steers, A pulses, triggers focus, Start pauses */
  pollPad() {
    let gp = null;
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : null;
      if (pads) for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
    } catch (e) { gp = null; }
    if (!gp) { this.padAxis = 0; this.focusPad = false; return; }
    const down = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax = gp.axes && Math.abs(gp.axes[0]) > 0.18 ? gp.axes[0] : 0;
    const ay = gp.axes && Math.abs(gp.axes[1]) > 0.5 ? gp.axes[1] : 0;
    const dir = ax || ((down(15) ? 1 : 0) - (down(14) ? 1 : 0));
    this.padAxis = clamp(dir, -1, 1);
    if (dir) this.mode = 'keys';
    const a = down(0) || down(1) || down(2), start = down(9), up = down(12) || ay < 0, dn = down(13) || ay > 0;
    const prev = this.padPrev;
    if (UI.blocking()) {
      if (up && !prev.up) UI.moveFocus(-1);
      if (dn && !prev.down) UI.moveFocus(1);
      if (a && !prev.a && document.activeElement && document.activeElement.click) document.activeElement.click();
      if (start && !prev.start && UI.cur === 'pause') Game.togglePause(false);
      this.focusPad = false;
    } else {
      if (a && !prev.a) { Sound.init(); Sound.resume(); this.press(); }
      if (start && !prev.start) Game.togglePause();
      this.focusPad = down(4) || down(5) || down(6) || down(7);
    }
    prev.a = a; prev.start = start; prev.up = up; prev.down = dn;
  },

  key(e, down) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (down && UI.key(e)) return;            // menus get first refusal
    const c = e.code;
    switch (c) {
      case 'ArrowLeft': case 'KeyA': this.left = down; if (down) this.mode = 'keys'; break;
      case 'ArrowRight': case 'KeyD': this.right = down; if (down) this.mode = 'keys'; break;
      case 'Space': case 'ArrowUp': case 'KeyW': case 'Enter': if (down && !e.repeat) this.press(); break;
      case 'ShiftLeft': case 'ShiftRight': case 'KeyS': case 'ArrowDown': this.focusKey = down; break;
      case 'Escape': case 'KeyP': if (down && !e.repeat) Game.togglePause(); break;
      case 'KeyM': if (down && !e.repeat) UI.toggleMute(); break;
      case 'KeyF': if (down && !e.repeat) UI.fullscreen(); break;
      default: return;
    }
    if (c === 'Space' || c.indexOf('Arrow') === 0) e.preventDefault();
  },
};
