# SHATTERWAVE

*Break the bricks. Play the melody.*

A neon, synthwave take on Breakout. All visuals are drawn in code and all audio is synthesized live with WebAudio, so there are no image or sound files and no network requests.

## Run it

Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari). No server or build step is needed, and it works offline from `file://`.

## Controls

| Action | Mouse / Keyboard | Touch | Gamepad |
|---|---|---|---|
| Move | Mouse, ← → or A D | Drag anywhere | Left stick / D-pad |
| Launch / fire lasers | Click, Space, ↑ or W | Tap | A |
| Unleash Pulse | Right-click, E or Shift | PULSE button | X / RB / RT |
| Pause | Esc or P | ❚❚ button | Start |
| Mute | M | | |

## What's inside

- **A procedural soundtrack.** A step sequencer builds drums, bass, arpeggios and pads in real time. Each sector has its own key, tempo and chord progression. Each brick you break plays a note in the current key, and chains climb the scale, so you play the lead line. The music gets more intense during big chains, fire mode and boss fights.
- **3 sectors, 12 levels:** Neon Drift, Aurora Deep and Solar Forge. Each sector has its own animated backdrop (striped sunset, aurora ribbons, a burning star) and its own music.
- **3 boss fights.** Each guardian is a giant eye that tracks your ball. They are shielded by rotating rings of bricks that regrow, fire aimed or spread shots that stun your paddle, and become enraged as they take damage. The Twin Sentinels fight as a pair, and killing one enrages the other.
- **The Pulse.** Breaking bricks charges a meter. When it's full, you can fire a shockwave that shreds bricks above your paddle, destroys enemy shots, damages bosses and knocks falling balls back up.
- **Chains and multipliers.** Quick successive breaks build a chain, and every 5 bricks raises the multiplier, up to ×8.
- **11 power-ups:** Multi, Wide, Laser, Catch, Slow, Fire, Shield, Pulse and 1UP, plus two to avoid: Shrink and Fast.
- **8 brick types:** glass, armored (2 or 3 hits, visibly cracking), steel, volatile (chain explosions), mystery, crystal (frees an extra ball) and phase (flickers in and out of existence). Some levels also have pinball bumpers, portals and sliding rows.
- **Game feel:** hit-stop, screen shake, particle shatter, squash-and-stretch, and a slow-motion zoom on the final brick.
- **Overtime (endless mode):** procedurally generated, mirrored waves with a boss every 5th wave. You can enter it after beating the campaign and keep your score, or start it directly from the title.
- **Extras:** an attract-mode demo behind the title screen, unlockable sector select, a local top-10 high-score table, settings (music and effects volume, shake, flashes, CRT scanlines, FPS counter), auto-pause on focus loss, and a phone-friendly portrait layout with a thumb strip.

## Files

```
index.html          markup + menus
css/style.css       UI styling
js/core.js          namespace, math/color utils, storage, input (mouse/keys/touch/gamepad)
js/audio.js         WebAudio synth: sequencer music + sound effects
js/fx.js            particles, popups, shake/flash, cached glow & brick sprites
js/background.js    themed parallax backdrops
js/levels.js        campaign levels, boss configs, Overtime generator
js/entities.js      paddle, ball, bricks, capsules, projectiles, bumpers, portals
js/boss.js          the guardian eye bosses
js/game.js          game flow, scoring, power-ups
js/physics.js       per-frame simulation and collisions
js/render.js        world + HUD rendering
js/ui.js            menus, settings, high scores
js/main.js          bootstrap and main loop
```
