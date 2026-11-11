# Breakout challenge: same prompt, 10 games

Ten browser games built from one prompt by Claude Code: Claude Opus 5.5 and Claude Fable 5.2, once at each effort
level (low, medium, high, xhigh, max). Each game is a single headless Claude Code session with no human help, and every
game here is as that session delivered it (one exception, below).

This is the experiment behind the **"Same prompt, 10 games"** video series on TikTok:
**[@sabotage.dev](https://www.tiktok.com/@sabotage.dev)**.

## Play them

Download this repo (Code > Download ZIP) or clone it, then open any game's `index.html` in a browser. They run offline
with no install, no server and no dependencies. Turn the sound on: every game synthesizes its own sound, and none of the models
ever heard it.

## The prompt

The same prompt went to every run, word for word ([`PROMPT.md`](PROMPT.md)):

> Build a complete, polished, playable browser game inspired by the classic arcade game Breakout.
>
> You have full creative freedom over the design, visuals, sound, mechanics, power-ups, and progression. Surprise me.
>
> Use HTML, CSS, and JavaScript. You may generate any local assets or files you need. The game must run entirely
> offline without external dependencies.
>
> This is a one-shot challenge. Make your own decisions and deliver the best game you can.

## The games

| Game | Model | Effort | Cost | Time | Folder |
|---|---|---|---|---|---|
| PRISM BREAKER | Opus 5.5 | low | $0.44 | 2 min | [`opus_low`](opus_low) |
| PRISM BREAK | Opus 5.5 | medium | $2.70 | 16 min | [`opus_medium`](opus_medium) |
| SHATTERLIGHT | Opus 5.5 | high | $5.54 | 25 min | [`opus_high`](opus_high) |
| PRISM BREAKER | Opus 5.5 | xhigh | $14.43 | 53 min | [`opus_xhigh`](opus_xhigh) |
| SHATTERWAVE | Opus 5.5 | max | $16.53 | 69 min | [`opus_max`](opus_max) |
| NOVABREAK | Fable 5.2 | low | $3.25 | 10 min | [`fable_low`](fable_low) |
| PRISMFALL | Fable 5.2 | medium | $3.68 | 10 min | [`fable_medium`](fable_medium) |
| SHATTERSONG | Fable 5.2 | high | $12.49 | 36 min | [`fable_high`](fable_high) |
| Lanternwake | Fable 5.2 | xhigh | $20.94 | 60 min | [`fable_xhigh`](fable_xhigh) |
| HADAL | Fable 5.2 | max | $35.50 | 81 min | [`fable_max`](fable_max) |

Costs are what Claude Code reported for each session. Time is wall-clock time for the session. Tool calls, tokens and
code size for every run are in [`RESULTS.md`](RESULTS.md).

## Things to know

- **Opus low crashed as delivered.** The one-shot threw `TypeError: particles is not iterable` on its first frame. The
  version in `opus_low/` is after one follow-up (the error pasted back with "Please fix it."), which took 8 seconds and
  $0.19. The original crashing version is in [`opus_low_oneshot/`](opus_low_oneshot).
- **One run per model and effort.** A second run of the same setting would make a different game.
- **Opus max's last step was cut short by the harness, not the model.** Headless `claude -p` stops background
  subagents 10 minutes after the agent's last turn, and that ended its final code review early.
- **None of the models played its game by hand or heard it.** Each report says how that run checked its work
  instead, from a syntax check to bots that play every level.

## What's in the repo

- `opus_*/` and `fable_*/`: the ten games.
- `opus_low_oneshot/`: Opus low as originally delivered (it crashes).
- `reports/<run>/`: each session's own final message (`agent_output.md`), its usage and cost (`usage.txt`) and a short
  transcript of its tool calls (`transcript.md`). `reports/opus_low_fix_1/` is the one follow-up, and
  `reports/SMOKE_TEST.md` is a quick check that every game loads and starts without errors.
- `harness/`: the scripts that ran the sessions, wrote the reports and ran the smoke test. They expect the original
  folder layout (`_harness/`, `_run_report/`), and local paths are replaced with `~`.

## Who made this

Run by sabotage.dev. Follow the series on TikTok at [@sabotage.dev](https://www.tiktok.com/@sabotage.dev).

Unofficial. Not affiliated with Anthropic or any company or product named here.
