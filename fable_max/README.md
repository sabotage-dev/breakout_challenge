# HADAL

A brick-breaking descent through the five zones of the ocean — from the sunlit
shallows to the floor of the Hadal trench, 10,935 metres down.

Everything is generated at runtime: the art is drawn procedurally on a canvas
and every sound and note of music is synthesised with the Web Audio API.
There are no assets, no dependencies and no build step.

## Play

Open `index.html` in any modern browser. That is all — it runs straight from
disk, fully offline. Sound starts on your first click or key press.

## Controls

| | Mouse | Keyboard | Touch | Gamepad |
|---|---|---|---|---|
| Steer the hull | move | `←` `→` or `A` `D` | drag | stick / d-pad |
| Launch · Pulse | left click | `Space` | tap (or tap a 2nd finger) | A |
| Focus (slow time) | hold right button | hold `Shift` | hold a 2nd finger | triggers |
| Pause | — | `Esc` or `P` | pause button | Start |

`M` mutes, `F` toggles fullscreen.

## How it plays

- **Pulse** — press the action button the instant the pearl touches your hull.
  A pulsed pearl hits harder, punches straight through a brick and refreshes
  your chain timer.
- **Focus** — slows the water while your sonar charge lasts. Your hull keeps
  its full speed.
- **Chain** — break bricks in quick succession and the score multiplier climbs.
  Brick hits climb a musical scale as the chain grows.
- **Upgrades** — clear a stage, pick one of three. Twenty upgrades stack across
  the whole dive, so no two runs build the same sub.
- **Fifteen stages, three guardians** — jellies that drift, phantoms that
  flicker, eels that shock a whole row, mines, ink, currents, hydrothermal
  vents, a ceiling that sinks, and total darkness lit only by what glows.
- Lose all your pearls and you can retry from the top of the zone you reached.
  Progress, best score and settings are kept in the browser's local storage.

## Files

```
index.html          page shell and menus
css/style.css       interface styling
js/data.js          zones, stages, bricks, capsules, upgrades
js/game.js          simulation: physics, bricks, capsules, stage flow
js/bosses.js        Medusa, The Lantern, Leviathan
js/render.js        world, lighting and HUD drawing
js/background.js    the ocean behind the playfield
js/sprites.js       procedural sprites and vector icons
js/particles.js     particles, floating text, lightning
js/audio.js         synthesised sound effects and generative music
js/ai.js            autopilot for the title-screen demo
js/input.js         mouse, keyboard, touch, gamepad
js/ui.js            menu logic
js/main.js          bootstrap, scaling, frame loop
js/util.js          maths, colour and storage helpers
```

A couple of URL switches are handy when poking around: `?stage=7` starts on a
given stage (0–14), `?god` stops lives from running out, `?auto` lets the
autopilot play.
