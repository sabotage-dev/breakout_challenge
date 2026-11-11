# Agent output: fable_high

- Model: `claude-fable-5-2`
- Effort: `high`
- Status: success (completed)

---

**SHATTERSONG** is finished: a musical brick-breaker in three acts. Open `~/dev/breakout_challenge/fable_high/index.html` in a browser — no server, no dependencies, works offline.

I tested it in headless Chrome: an autopilot cleared all 12 stages with zero runtime errors, and keyboard, mouse, pause, losing lives, game over and continue all behaved correctly. What I could not do is listen to it — the audio is confirmed to produce signal at sane levels, but how the music actually sounds is unjudged by ear. Touch controls are implemented but untested, and a portrait phone only gets a small letterboxed playfield.

## What makes it different

- **Every brick sings.** Breaking a brick plays a note that climbs a scale as your combo grows, always in key with a soundtrack that is synthesised live.
- **The music follows your play.** It layers up as your combo rises, and the spectrum bars behind the playfield are driven by the actual audio.
- **Crescendo.** Combos fill a Resonance meter. Click or press Space when it is full: for 8 seconds balls pierce everything, steel shatters, the floor is sealed and points double.
- **Upgrade draft.** After each stage you pick one of three upgrades from a pool of 14 (echo balls, a paddle that fires on each bounce, random explosions, a safety net and so on).
- **Three bosses.** The Metronome swings in time with the music, The Duet is two orbiting cores, and The Maestro hides behind a rotating ring of regenerating bricks.
- **Brick and power-up variety.** Seven brick types, including chain-exploding ones and "phase" bricks that blink in and out on the beat, plus nine falling power-ups, two of them cursed.

## Controls

| Action | Input |
|---|---|
| Move | Mouse, ← →, A / D, or drag on touch |
| Launch / Crescendo | Click or Space |
| Pause | P or Esc |
| Mute / Fullscreen | M / F |
| Pick an upgrade | 1, 2, 3 or click |

Other things you will find: a title screen with the game playing itself behind the menu, a how-to-play panel, volume and screen-shake settings, a saved best score, "continue" after game over (score resets), and a harder Encore loop after you win.

Boss fights were the main thing I rebalanced: they dragged, so I cut boss health and made rising balls drift gently toward the boss. Difficulty for a human player is still a judgement call, since the tuning was done against an autopilot.

Two developer hooks are left in: `index.html#stage=7` starts a run at that stage, and `index.html#autotest` runs the self-playing test.
