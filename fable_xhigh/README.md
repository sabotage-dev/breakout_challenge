# Lanternwake

A brick-breaker for a night festival. The lanterns along the river have gone
dark; you steer a small boat, keep one spark in the air, and wake every lantern
before dawn. Nothing is smashed here: each lantern you touch lights up and
drifts off into the sky.

**To play:** open `index.html` in any modern browser. No install, no network,
no dependencies. All art is drawn in code and all sound and music is
synthesised live.

## Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Steer the boat | move / drag | `←` `→` or `A` `D` |
| Launch, release, Flare | click / tap | `Space` |
| Pause | corner button | `P` or `Esc` |
| Mute / fullscreen | corner buttons | `M` / `F` |
| Pick a wish | click a card | `1` `2` `3` |

## What makes it different

- **Flare shots.** Click at the instant a spark lands on the boat and it leaves
  faster, brighter, and pierces lanterns. Every catch is a small timing game.
- **Chains.** Wake lanterns in quick succession to multiply your score (up to
  ×8). The notes they play climb the scale as the chain grows.
- **Fireflies.** They drift down from woken lanterns. Catch forty with the boat
  to earn a spare spark, which gives you something to do while the spark is
  away, and a reason to take risks.
- **Wishes.** After every stage you choose one of three wishes that lasts for
  the whole run. There are fifteen, and they stack and combine.
- **Eleven charms** fall from lanterns: nine helpful, two to dodge.
- **Three nights, twelve stages, three guardians**: the Paper Dragon, the Storm
  Drum and the Hollow Moon, each with its own way of fighting back.
- If the last few lanterns prove stubborn, a firefly lends a hand.

Best score, furthest stage and volume settings are kept in `localStorage`.

## Files

```
index.html      page and menus
css/style.css   interface styling
js/util.js      constants and helpers
js/data.js      stages, charms, wishes
js/audio.js     synthesised sound effects and generative music
js/art.js       procedural sprites, icons and backdrops
js/game.js      rules, physics, state
js/boss.js      the three guardians
js/render.js    canvas renderer and HUD
js/ui.js        menus
js/main.js      input and frame loop
```

## Developer switches

Append to the URL: `?stage=N` (start at stage N, zero-based), `?god` (sparks
cannot be lost), `?auto` (self-playing pilot), `?fast=N` (run N updates per
frame). They can be combined, for example `index.html?stage=3&god`.
