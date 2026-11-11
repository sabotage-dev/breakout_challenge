# Smoke test: does each game error immediately?

**Result: all 10 games pass.** None throw an error on load or when starting a game (after opus_low's fix_1).

| Run | Result | Notes |
|---|---|---|
| opus_low | ✅ pass | **Failed as originally delivered**: one-shot crashed on the first frame with `TypeError: particles is not iterable at updateFx (index.html:273)` (the bug you found). Fixed by its own worker in `fix_1`; passes now. |
| opus_medium | ✅ pass | Reached gameplay. |
| opus_high | ✅ pass | Clicked "PLAY"; reached gameplay. |
| opus_xhigh | ✅ pass | Clicked "NEW GAME"; reached gameplay. |
| opus_max | ✅ pass | Reached gameplay. |
| fable_low | ✅ pass | Clicked "LAUNCH"; reached gameplay. |
| fable_medium | ✅ pass | Reached gameplay. |
| fable_high | ✅ pass | Reached gameplay. |
| fable_xhigh | ✅ pass | Clicked "BEGIN THE NIGHT"; reached gameplay. |
| fable_max | ✅ pass | Clicked "DIVE"; reached gameplay (start button wasn't matched on the first pass, so gameplay was re-tested). |

## Method

- `node harness/smoke.js [run ...]` — headless Google Chrome via Playwright, viewport 1280×800.
- Each game is opened with **file://** (same as double-clicking `index.html`), so file://-only failures (ES modules, `fetch` of local files) would be caught.
- Phase 1 `load`: navigate, wait 3 s on the title screen, screenshot `1_load.png`.
- Phase 2 `start+play`: click a visible Play/Start-style button if any, click the canvas, press Enter and Space, then sweep the mouse for ~6 s; screenshot `2_play.png`.
- Captured: uncaught exceptions (`pageerror`), `console.error` messages, failed requests. Chrome's own file:// messages ("Unsafe attempt to load URL file:…") and favicon 404s are ignored as not being game errors.
- **Control:** the unfixed one-shot `opus_low_oneshot` was run through the same test and correctly FAILED with the `particles is not iterable` crash, so a pass here is meaningful.

## Limits

- "Doesn't error immediately" only: a few seconds of play with a scripted (not skilled) paddle. Later levels, bosses, power-ups and game-over flows are not exercised here.
- Audio is muted; WebAudio errors would still surface as exceptions.

Screenshots and raw data are not included in this repo.
