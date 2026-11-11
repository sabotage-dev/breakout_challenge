# Agent output: fable_max

- Model: `claude-fable-5-2`
- Effort: `max`
- Status: success (completed)

---

The game is built: **HADAL**, an original deep-sea brick breaker where you bounce a pearl off a small submarine and descend through the five real ocean zones to the bottom of the Hadal trench. Open `index.html` in a browser to play; it runs straight from disk with no dependencies.

I have not played it by hand or heard the audio. It was tested with an autopilot and in headless Chrome only, so the feel and balance are tuned from bots and screenshots.

## What's in it

- **Campaign:** 15 stages across 5 zones, each with its own palette, backdrop and generative music, ending in three boss fights (a giant jellyfish, an anglerfish fought in darkness, and an armoured serpent).
- **Pulse:** click the instant the pearl lands on your hull and it charges, punching through a brick and keeping your score chain alive.
- **Focus:** hold Shift or right-click to slow time while a meter lasts.
- **Upgrades:** pick one of three after every stage; 20 upgrades stack across the run.
- **Variety:** drifting jellies, flickering phantoms, eels that shock a row, mines, ink clouds, currents, vents, a sinking ceiling, and 11 falling capsules (two of them harmful).
- **Audio:** all sound and music is synthesised live, and brick hits climb the music's scale as your chain grows.
- **Extras:** an autopilot demo behind the title screen, pause/settings/help menus, retry-from-zone checkpoints, and saved best score.

Controls are mouse, keyboard, touch, or gamepad; the in-game "How to play" screen and `README.md` list them.

## What was tested

- **Full playthroughs:** the autopilot finished the whole campaign repeatedly with no errors, including runs with every capsule forced on and every upgrade maxed.
- **Bugs found and fixed:** a soft-lock where one brick could never be hit, a double life loss on the sinking-ceiling stage, and a final boss whose last body segments were nearly unhittable.
- **Real browser:** in headless Chrome, mouse, keyboard and emulated touch all worked through title, play, pause, upgrade pick, game over and retry, with no console errors; I checked screenshots of every zone, boss and menu, plus a phone-sized layout.
- **Audio:** I measured loudness offline and rebalanced it (the music and brick notes were too quiet); nothing clips.
- **Not tested:** Firefox, Safari, a real phone, and a real gamepad.

Three URL switches are left in for poking around: `?stage=7` jumps to a stage (0–14), `?god` stops lives running out, and `?auto` lets the autopilot play.
