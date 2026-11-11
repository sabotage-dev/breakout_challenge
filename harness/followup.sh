#!/bin/bash
# Send a follow-up message (e.g. a bug report) to a finished run by resuming
# its original session with the SAME model + effort + flags, so only that
# worker touches its game. --fork-session leaves the original one-shot session
# record untouched; the follow-up gets its own session ID.
#
# Usage: followup.sh <run_name> <model_id> <effort> <session_id> <message_file> <label>
#   e.g. followup.sh opus_low claude-opus-5-5 low 09f11ae9-... _harness/followups/opus_low__fix_1.md fix_1
#
# Report goes to <run_name>/_run_report/<label>/ ; the one-shot report is not modified.
set -u

ROOT="${BREAKOUT_ROOT:-$HOME/dev/breakout_challenge}"
NAME="$1"
MODEL="$2"
EFFORT="$3"
SESSION="$4"
MSG_FILE="$(cd "$(dirname "$5")" && pwd)/$(basename "$5")"
LABEL="$6"
DIR="$ROOT/$NAME"
LIVE="$ROOT/_harness/live"
TAG="${NAME}__${LABEL}"

mkdir -p "$LIVE"
MSG="$(cat "$MSG_FILE")"

START_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START_EPOCH="$(date +%s)"
echo "[$TAG] start $START_ISO model=$MODEL effort=$EFFORT resume=$SESSION cwd=$DIR"

cd "$DIR" || exit 1
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS="${CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS:-0}"
claude -p "$MSG" \
  --resume "$SESSION" \
  --fork-session \
  --model "$MODEL" \
  --effort "$EFFORT" \
  --safe-mode \
  --permission-mode auto \
  --permission-prompts none \
  --output-format stream-json \
  --verbose \
  -n "$TAG" \
  < /dev/null \
  > "$LIVE/$TAG.jsonl" \
  2> "$LIVE/$TAG.stderr.log"
EXIT_CODE=$?

END_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
END_EPOCH="$(date +%s)"
echo "[$TAG] end $END_ISO exit=$EXIT_CODE harness_wall=$((END_EPOCH - START_EPOCH))s"

python3 "$ROOT/_harness/report.py" \
  --root "$ROOT" \
  --name "$NAME" \
  --model "$MODEL" \
  --effort "$EFFORT" \
  --transcript "$LIVE/$TAG.jsonl" \
  --stderr "$LIVE/$TAG.stderr.log" \
  --exit-code "$EXIT_CODE" \
  --start "$START_ISO" \
  --end "$END_ISO" \
  --harness-wall-seconds "$((END_EPOCH - START_EPOCH))" \
  --subdir "$LABEL" \
  --prompt-file "$MSG_FILE" \
  --resumed-from "$SESSION"

echo "[$TAG] report written to $DIR/_run_report/$LABEL/"
cat "$DIR/_run_report/$LABEL/usage.txt"
