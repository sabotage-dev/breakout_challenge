# Agent output: fable_medium

- Model: `claude-fable-5-2`
- Effort: `medium`
- Status: success (completed)

---

The game is finished: **PRISMFALL**, a neon brick-breaker in a single file — open `index.html` in any browser, no server or network needed.

I tested it two ways: a scripted auto-paddle cleared all 12 levels through to the win screen without errors, and I checked headless-Chrome screenshots of the menu and several levels. I have not played it by hand or heard the audio, so feel and difficulty are untuned by a human.

What's in it:

- **Nova:** breaking bricks charges a meter; when full, click or press Space to fire a shockwave from the paddle that damages every brick it passes, erases boss shots and briefly slows time.
- **Combo:** chaining hits without a pause raises a score multiplier up to x8, and each hit plays a higher note in key with the music.
- **Levels:** 12 hand-built levels with armoured bricks that crack, explosive bricks that chain (and are the only way to destroy steel), and ghost bricks that phase in and out.
- **Bosses:** level 6 (The Warden) and level 12 (The Singularity) move, fire shots that stun the paddle, summon bricks and speed up at half health.
- **Capsules:** Multiball, Wide, Laser, Guard, Fireball, Slow, Catch, Extra Life, plus a red Shrink to dodge.
- **Presentation:** all sound effects and the music loop are synthesized in the browser (no audio files), and the music picks up during bosses and high combos. The title screen runs a self-playing demo behind the menu, and the best score is saved locally.

Controls: mouse, touch, or ← → / A D to move; click or Space to launch and fire Nova; P pauses, M mutes, F toggles fullscreen.

On touch screens, Nova fires by tapping the upper half of the screen or with a second finger; this path is the least tested.
