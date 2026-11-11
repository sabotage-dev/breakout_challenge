# SHATTERLIGHT

A neon brick-breaking game inspired by Breakout. It's plain HTML5 canvas and WebAudio with no dependencies, build step or asset files. Every sprite, sound and music track is generated at runtime.

**To play, open `index.html` in any modern browser.** It also works offline straight from `file://`.

## Controls
| Action | Input |
|---|---|
| Move paddle | Mouse / touch drag / ← → or A D |
| Launch / release a caught ball | Click / tap / Space / ↑ |
| Pause | P or Esc |
| Mute all | M |

## What's in it
- **10 hand-built sectors** plus **endless mode**, which generates seeded symmetric sectors after you beat the campaign. Every fifth endless sector is a stronger Warden.
- **Two boss fights against the Warden.** It's a roaming core with an eye that tracks your ball, guarded by rotating shield rings that regenerate. It fires aimed plasma, and its attacks get stronger at half and quarter health. If plasma hits your paddle, the paddle is stunned briefly.
- **Brick types:** crystal (1 hit), armoured (2–3 hits, visibly cracking), steel (unbreakable), volatile (chain explosions) and prism (always drops a power-up). In the Drift sector the whole formation sways.
- **10 power-ups:** Expand, Multiball, Lasers, Magnet (catch and aim), Slow-mo, Fireball, Barrier, Chain Zap, Extra Life, and Shrink, which is a trap.
- **Musical combos.** Each brick broken in a chain plays the next note of a pentatonic scale, so long combos turn into melodies. Every six links raises the score multiplier (up to ×8).
- **Procedural synthwave soundtrack** with a separate track for the title, three for regular sectors and one for bosses.
- **Game feel:** shatter particles, shockwaves, hit-stop slow motion on the last brick, screen shake (can be turned off), ball trails and lightning arcs.
- **Attract mode.** An AI plays behind the title screen.
- **Saved locally:** high score, unlocked sectors, and sound and shake settings.

## Files
```
index.html      UI screens + canvas
css/style.css   menu / overlay styling
js/audio.js     WebAudio synth: sound effects + step-sequenced music
js/levels.js    sector maps, boss configs, endless generator
js/game.js      engine: physics, entities, rendering, input, flow
```

Developer hook: `index.html?autoplay=N` starts sector N with the AI playing.
