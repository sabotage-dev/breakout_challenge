# Breakout one-shot challenge: Opus 5.5 vs Fable 5.2

Same prompt (`PROMPT.md`) for every run. Each run is an independent headless Claude Code session (`claude -p --model <id> --effort <level> --safe-mode --permission-mode auto`) whose working directory is its own folder. Per-run details live in `reports/<run>/`.

| Run | Model | Effort | Status | Total cost | Duration (API) | Duration (wall) | Turns | Tool calls | Output tokens | Files | Code lines | Entry point |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| opus_low | `claude-opus-5-5` | low | success (completed) | $0.44 | 1m 57s | 1m 59s | 3 | 2 | 14.4k | 1 | 428 | [index.html](opus_low/index.html) |
| opus_medium | `claude-opus-5-5` | medium | success (completed) | $2.70 | 12m 50s | 15m 51s | 12 | 11 | 88.1k | 2 | 1771 | [index.html](opus_medium/index.html) |
| opus_high | `claude-opus-5-5` | high | success (completed) | $5.54 | 23m 30s | 25m 18s | 40 | 39 | 159.8k | 6 | 3078 | [index.html](opus_high/index.html) |
| opus_xhigh | `claude-opus-5-5` | xhigh | success (completed) | $14.43 | 53m 8s | 52m 49s | 75 | 73 | 351.5k | 6 | 3955 | [index.html](opus_xhigh/index.html) |
| opus_max | `claude-opus-5-5` | max | success (completed) [bg subagent killed at 10-min -p wait ceiling] | $16.53 | 1h 10m 27s | 1h 8m 51s | 97 | 95 | 442.5k | 15 | 3574 | [index.html](opus_max/index.html) |
| fable_low | `claude-fable-5-2` | low | success (completed) | $3.25 | 8m 41s | 9m 34s | 9 | 8 | 54.6k | 2 | 927 | [index.html](fable_low/index.html) |
| fable_medium | `claude-fable-5-2` | medium | success (completed) | $3.68 | 9m 32s | 10m 14s | 14 | 13 | 60.9k | 1 | 1157 | [index.html](fable_medium/index.html) |
| fable_high | `claude-fable-5-2` | high | success (completed) | $12.49 | 31m 29s | 36m 17s | 35 | 34 | 202.3k | 8 | 2736 | [index.html](fable_high/index.html) |
| fable_xhigh | `claude-fable-5-2` | xhigh | success (completed) | $20.94 | 49m 14s | 1h 0m 10s | 68 | 67 | 307.2k | 12 | 5698 | [index.html](fable_xhigh/index.html) |
| fable_max | `claude-fable-5-2` | max | success (completed) | $35.50 | 1h 14m 10s | 1h 20m 31s | 100 | 99 | 484.9k | 16 | 6640 | [index.html](fable_max/index.html) |

### Follow-up sessions (after the one-shot)

Bug reports sent back to the same worker (same model, effort and flags, resumed from its original session). The table above is one-shot only; these costs are extra.

| Run | Follow-up | Status | Cost | Duration (API) | Duration (wall) | Turns | Tool calls | Details |
|---|---|---|---|---|---|---|---|---|
| opus_low | fix_1 | success (completed) | $0.19 | 8.0s | 10.0s | 2 | 1 | [report](reports/opus_low_fix_1/) |

### Smoke test: does it error immediately? (headless Chrome, opened via file://)

Load + 3 s on the title screen, then a generic start (Play/Start button, click, Enter, Space) and ~6 s of play. Counts uncaught exceptions, console errors and failed file loads. Details: `reports/SMOKE_TEST.md`.

| Run | Result | Errors on load | Errors after start | Start button clicked |
|---|---|---|---|---|
| opus_low | ✅ pass (after fix_1; the one-shot version did not pass) | 0 | 0 | — |
| opus_medium | ✅ pass | 0 | 0 | — |
| opus_high | ✅ pass | 0 | 0 | PLAY |
| opus_xhigh | ✅ pass | 0 | 0 | NEW GAME |
| opus_max | ✅ pass | 0 | 0 | — |
| fable_low | ✅ pass | 0 | 0 | LAUNCH |
| fable_medium | ✅ pass | 0 | 0 | — |
| fable_high | ✅ pass | 0 | 0 | — |
| fable_xhigh | ✅ pass | 0 | 0 | BEGIN THE NIGHT |
| fable_max | ✅ pass | 0 | 0 | DIVE |

### Harness notes
- **opus_max**: HARNESS CUT-OFF: the agent ended its turn while 1 background subagent(s) it launched were still running. Headless `claude -p` waits at most 10 minutes for background work after the last turn (CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS), then kills it, so the agent never received those results or got another turn. The final message below is therefore an interim one. The game files are as the agent left them at that point. CLI message: "Background tasks still running 10m after the last turn (subagent "Independent bug review of game code"); stopping them. Set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 to wait indefinitely."

**Total spend so far:** $115.50 across 10 one-shot run(s) + $0.19 across 1 follow-up session(s) = $115.69.
