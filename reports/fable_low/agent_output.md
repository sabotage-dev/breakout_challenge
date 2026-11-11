# Agent output: fable_low

- Model: `claude-fable-5-2`
- Effort: `low`
- Status: success (completed)

---

The game is built: **NOVABREAK**, a neon brick-breaker in two files with no dependencies. Open `index.html` in a browser to play.

I tested the logic headlessly (all 10 sectors, both bosses, game over, victory and the loop into a second run completed without errors), but I have not looked at it in a real browser. Visuals, audio and feel are unverified by eye and ear.

What's in it:

- **Nova meter** — breaking bricks charges it; when full, click or press Space to detonate a shockwave from every ball in play.
- **Musical combos** — chained hits climb a pentatonic scale and raise the score multiplier up to ×8.
- **10 sectors, 2 bosses** — sectors 5 and 10 have a moving core that tracks your ball and fires stun shots at the paddle. After sector 10 the game loops, faster.
- **Brick types** — armoured, steel (only explosions destroy them), bombs that chain-react, and prism bricks that release an extra ball.
- **8 power-ups** — Wide, Multi-ball, Laser, Slow, Fireball, Barrier, 1UP, and one bad capsule (Shrink) to dodge.
- **Sound** — all effects and the background music are synthesised in the browser, so there are no audio files.
- **Presentation** — particles, ball trails, screen shake, a self-playing attract mode behind the title screen, and a high score that persists between sessions.

Controls:

| Input | Action |
|---|---|
| Mouse, touch, or ←/→ (A/D) | Move the paddle |
| Click, tap, or Space | Launch the ball; unleash Nova when charged |
| P or Esc | Pause |
| M | Cycle sound + music / sound only / muted |
| F | Fullscreen |

Files are in `~/dev/breakout_challenge/fable_low`:
- index.html
- game.js
