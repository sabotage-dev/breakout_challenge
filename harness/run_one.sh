#!/bin/bash
# Run one headless Claude Code session on the Breakout prompt.
# Usage: run_one.sh <family> <model_id> <effort>
#   e.g. run_one.sh opus claude-opus-5-5 low
#
# The model works in <ROOT>/<family>_<effort>/ (its cwd). While it runs, the
# stream-json transcript is written OUTSIDE that folder (_harness/live/) so the
# model never sees its own log. When the session exits, report.py writes
# <family>_<effort>/_run_report/ (agent output, usage, raw result, transcript)
# and regenerates the top-level RESULTS.md comparison table.
set -u

ROOT="${BREAKOUT_ROOT:-$HOME/dev/breakout_challenge}"
FAMILY="$1"
MODEL="$2"
EFFORT="$3"
NAME="${FAMILY}_${EFFORT}"
DIR="$ROOT/$NAME"
LIVE="$ROOT/_harness/live"

mkdir -p "$DIR" "$LIVE"
PROMPT="$(cat "$ROOT/PROMPT.md")"

START_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START_EPOCH="$(date +%s)"
echo "[$NAME] start $START_ISO model=$MODEL effort=$EFFORT cwd=$DIR"

cd "$DIR" || exit 1
# Without this, `claude -p` kills background subagents still running 10 min
# after the agent's last turn (this cut short the original opus_max run).
# Note: the original 10 runs ran with the default 10-min ceiling.
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS="${CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS:-0}"
claude -p "$PROMPT" \
  --model "$MODEL" \
  --effort "$EFFORT" \
  --safe-mode \
  --permission-mode auto \
  --permission-prompts none \
  --output-format stream-json \
  --verbose \
  -n "$NAME" \
  < /dev/null \
  > "$LIVE/$NAME.jsonl" \
  2> "$LIVE/$NAME.stderr.log"
EXIT_CODE=$?

END_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
END_EPOCH="$(date +%s)"
echo "[$NAME] end $END_ISO exit=$EXIT_CODE harness_wall=$((END_EPOCH - START_EPOCH))s"

python3 "$ROOT/_harness/report.py" \
  --root "$ROOT" \
  --name "$NAME" \
  --model "$MODEL" \
  --effort "$EFFORT" \
  --transcript "$LIVE/$NAME.jsonl" \
  --stderr "$LIVE/$NAME.stderr.log" \
  --exit-code "$EXIT_CODE" \
  --start "$START_ISO" \
  --end "$END_ISO" \
  --harness-wall-seconds "$((END_EPOCH - START_EPOCH))"

echo "[$NAME] report written to $DIR/_run_report/"
cat "$DIR/_run_report/usage.txt"
