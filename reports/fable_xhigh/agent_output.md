# Agent output: fable_xhigh

- Model: `claude-fable-5-2`
- Effort: `xhigh`
- Status: success (completed)

---

The game is finished: open `index.html` in the project folder and it runs straight from disk, fully offline, with no dependencies.

## Lanternwake

A brick-breaker set at a night festival. Instead of smashing bricks, your spark *wakes* sleeping paper lanterns, which light up and drift into the sky. You steer a small boat along a river whose water reflects everything above it.

**What's in it**
- **Flare shots:** click at the instant the spark lands on the boat and it leaves faster and pierces lanterns, so every catch is a small timing game.
- **Chains:** waking lanterns in quick succession multiplies the score up to ×8, and the notes they play climb the scale as the chain grows.
- **Fireflies:** they drift down from woken lanterns; catching 40 with the boat earns a spare spark.
- **Wishes:** after each stage you pick one of three upgrades that last the whole run (15 in total, stackable).
- **Charms:** 11 falling power-ups, nine helpful and two to dodge.
- **Three nights, 12 stages, 3 bosses:** nine picture layouts (a koi, a pagoda, a fox mask, and so on), plus the Paper Dragon, the Storm Drum and the Hollow Moon. Beating the last one brings a dawn ending.
- **Art and audio:** everything is generated in code, with no image or sound files. The music is generative and changes scale each night.
- **Controls and menus:** mouse, keyboard or touch; pause menu with volume sliders; best score saved locally.

**How it was checked**
- I drove it in headless Chrome with a self-playing pilot through all 12 stages to the ending several times, with no runtime errors, no sparks escaping the field or tunnelling through lanterns.
- Keyboard, pause, stage clear, wish pick, game over and retry were exercised with simulated input.
- Layout was checked on phone-portrait, small and ultrawide windows, and a Firefox render was confirmed.
- The pilot runs led to several balance fixes: a wish that could chain-react and clear a whole stage, spare sparks piling up too fast, and a dragon fight that dragged.

**What I couldn't check:** I have not played it by hand or heard it. Audio was verified only for errors and output levels (no clipping), so how the music and effects actually sound, and how the controls and difficulty feel to a person, are untested. The pilot never misses, so real difficulty will be harder than its runs suggest.

The `README.md` covers controls and a few URL switches such as `?stage=3&god` for jumping to a stage.
