# Agent output: opus_medium

- Model: `claude-opus-5-5`
- Effort: `medium`
- Status: success (completed)

---

I've built **PRISM BREAK**, a neon synthwave take on Breakout. Open `index.html` in any modern browser to play; it runs fully offline with no dependencies.

I tested it in headless Chrome by driving the game loop directly. Regular levels, both bosses and endless mode all ran with no script errors and cleared, and screenshots of the title, a normal level and a boss fight looked right. Two limits on that testing: I couldn't hear any audio there, and the test bounced the ball back from the bottom automatically, so it doesn't show how hard the game is to actually play. In the Labyrinth sector the test still had a few bricks left after 150 seconds.

**What's in it**
- **10 sectors**, each with its own design and colour theme (Pyramid, Citadel, Chain Reaction, Labyrinth, Heartbeat and others).
- **Two bosses:**
  - **The Warden** (sector 5) and **The Monolith** (sector 10) slide back and forth. Their eye tracks your ball, they fire bolts that briefly freeze your paddle, and they summon new bricks to shield themselves.
  - At half health they speed up and fire three bolts at a time. Beating one blows up every brick left on screen.
- **Endless mode** after you win: new levels are generated forever, with a boss every 5th level.
- **Six brick types:** coloured (one hit), plated (2–3 hits, showing cracks), steel, explosive (sets off nearby bricks in a chain), and mystery `?` bricks that always drop a power-up.
- **11 power-ups:** Multiball, Expand, Lasers (fire automatically), Magnet (catch and aim), Slow-mo, Fireball (melts through steel), Barrier, Shockwave, Extra Life, plus two bad ones to dodge: Shrink and Overdrive.
- **Scoring:** a combo multiplier up to ×8 for hitting bricks without touching the paddle, end-of-sector bonuses, an extra life at 20k and then every 30k, and a high score saved in the browser.
- **Visuals:** a perspective grid floor and stars in the background, bricks that drop in at the start of a level, falling shards, shockwave rings, screen shake, ball trails, and a slow-motion moment on the last brick of each sector.
- **Sound:** all generated in the browser, with no audio files. Brick hits play rising notes as your combo grows, and a synthwave music loop gets more intense during boss fights.
- **Title screen:** a computer-controlled demo plays behind the menu, which also explains every power-up.

**Controls:** mouse, touch, arrow keys or A/D to move · click or Space to launch · P pause · M mute · N music · Esc twice to quit to the title.

**One addition you didn't ask for:** if a sector drags past 90 seconds, its steel bricks become breakable. This stops a level from becoming impossible when bricks are walled in by steel.

The game is two files: `index.html` and `game.js`. `game.js` also exposes a small `window.__pb` object I used for testing; it doesn't affect play.
