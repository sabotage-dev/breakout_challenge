#!/usr/bin/env python3
"""Turn one finished headless Claude Code run into a report folder, then
regenerate the top-level RESULTS.md comparison table.

Writes <root>/<name>/_run_report/:
  agent_output.md   the agent's final message (what it said it delivered)
  usage.txt         cost / API duration / wall duration + token breakdown
  result.json       raw `result` event from the CLI (source of truth for usage)
  run_meta.json     harness metadata + derived stats (used to build RESULTS.md)
  transcript.jsonl  full stream-json transcript
  transcript.md     readable transcript (assistant text, thinking, tool calls)
  stderr.log        CLI stderr

Python 3.9 compatible.
"""
import argparse
import json
import os
import shutil
import sys
from collections import Counter

FAMILIES = ["opus", "fable"]
EFFORTS = ["low", "medium", "high", "xhigh", "max"]
TEXT_EXTS = {".html", ".htm", ".css", ".js", ".mjs", ".json", ".md", ".svg", ".txt"}
SKIP_DIRS = {"_run_report", "node_modules", ".git", ".claude"}


def fmt_dur(ms):
    if ms is None:
        return "n/a"
    s = ms / 1000.0
    if s < 60:
        return "%.1fs" % s
    total = int(round(s))
    h, rem = divmod(total, 3600)
    m, sec = divmod(rem, 60)
    if h:
        return "%dh %dm %ds" % (h, m, sec)
    return "%dm %ds" % (m, sec)


def fmt_tok(n):
    if n is None:
        return "0"
    if n >= 1_000_000:
        return "%.1fm" % (n / 1_000_000.0)
    if n >= 1_000:
        return "%.1fk" % (n / 1_000.0)
    return str(n)


def fmt_bytes(n):
    if n >= 1024 * 1024:
        return "%.1f MB" % (n / (1024.0 * 1024.0))
    if n >= 1024:
        return "%.1f KB" % (n / 1024.0)
    return "%d B" % n


def load_events(path):
    events = []
    if not os.path.exists(path):
        return events
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except ValueError:
                pass
    return events


def short(s, n):
    s = s if isinstance(s, str) else json.dumps(s)
    s = s.replace("\n", " ⏎ ")
    return s if len(s) <= n else s[: n - 1] + "…"


def summarize_tool_input(name, inp):
    if not isinstance(inp, dict):
        return short(inp, 200)
    for key in ("file_path", "path", "command", "pattern", "url", "description", "prompt"):
        if key in inp:
            return "%s=%s" % (key, short(inp[key], 200))
    return short(inp, 200)


def scan_outputs(run_dir):
    files = []
    for dirpath, dirnames, filenames in os.walk(run_dir):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, run_dir)
            try:
                size = os.path.getsize(full)
            except OSError:
                continue
            lines = None
            ext = os.path.splitext(fn)[1].lower()
            if ext in TEXT_EXTS:
                try:
                    with open(full, "r", encoding="utf-8", errors="replace") as f:
                        lines = sum(1 for _ in f)
                except OSError:
                    lines = None
            files.append({"path": rel, "bytes": size, "lines": lines})
    files.sort(key=lambda x: x["path"])
    entry = None
    if os.path.exists(os.path.join(run_dir, "index.html")):
        entry = "index.html"
    else:
        htmls = [f["path"] for f in files if f["path"].lower().endswith((".html", ".htm"))]
        if htmls:
            htmls.sort(key=lambda p: (p.count(os.sep), p))
            entry = htmls[0]
    code_lines = sum(
        f["lines"] or 0
        for f in files
        if os.path.splitext(f["path"])[1].lower() in {".html", ".htm", ".css", ".js", ".mjs"}
    )
    return {
        "files": files,
        "file_count": len(files),
        "total_bytes": sum(f["bytes"] for f in files),
        "code_lines": code_lines,
        "entry_point": entry,
    }


DELTA_KEYS = ("inputTokens", "outputTokens", "cacheReadInputTokens", "cacheCreationInputTokens",
              "thinkingTokens", "webSearchRequests", "costUSD",
              "cacheCreationEphemeral5mInputTokens", "cacheCreationEphemeral1hInputTokens")


def cumulative_of(results):
    """Session-cumulative totals from a list of result events (max-cost one)."""
    if not results:
        return None
    c = max(results, key=lambda x: x.get("total_cost_usd") or 0)
    return {
        "cost": c.get("total_cost_usd") or 0.0,
        "api_ms": max((x.get("duration_api_ms") or 0) for x in results),
        "model_usage": c.get("modelUsage") or {},
    }


def find_baseline(root, name, session_id):
    """A resumed session's result totals INCLUDE the session it resumed from.
    Find that parent session's raw cumulative totals (from its saved result.json)
    so the follow-up's own usage can be reported as a delta."""
    rep_root = os.path.join(root, name, "_run_report")
    cands = [rep_root] + [os.path.join(rep_root, d) for d in sorted(os.listdir(rep_root))
                          if os.path.isdir(os.path.join(rep_root, d))]
    for d in cands:
        mp, rp = os.path.join(d, "run_meta.json"), os.path.join(d, "result.json")
        if not (os.path.isfile(mp) and os.path.isfile(rp)):
            continue
        with open(mp, "r", encoding="utf-8") as f:
            if json.load(f).get("session_id") != session_id:
                continue
        with open(rp, "r", encoding="utf-8") as f:
            raw = json.load(f)
        return cumulative_of(raw if isinstance(raw, list) else ([raw] if raw else []))
    return None


def subtract_usage(cur, base):
    out = {}
    for model, mu in cur.items():
        b = base.get(model) or {}
        d = dict(mu)
        for k in DELTA_KEYS:
            if isinstance(mu.get(k), (int, float)):
                d[k] = mu[k] - (b.get(k) or 0)
        out[model] = d
    return out


def build_transcript_md(events, name):
    out = ["# Transcript: %s" % name, ""]
    for ev in events:
        t = ev.get("type")
        sub = " (subagent)" if ev.get("parent_tool_use_id") else ""
        if t == "system" and ev.get("subtype") == "init":
            out.append("**[init]** model=%s cwd=%s tools=%d" % (
                ev.get("model"), ev.get("cwd"), len(ev.get("tools") or [])))
            out.append("")
        elif t == "assistant":
            for block in (ev.get("message") or {}).get("content") or []:
                bt = block.get("type")
                if bt == "text" and block.get("text", "").strip():
                    out.append("**assistant%s:** %s" % (sub, block["text"].strip()))
                    out.append("")
                elif bt == "thinking" and (block.get("thinking") or "").strip():
                    th = block["thinking"].strip()
                    if len(th) > 3000:
                        th = th[:3000] + " …[truncated; full text in transcript.jsonl]"
                    out.append("> _thinking%s:_ %s" % (sub, th.replace("\n", "\n> ")))
                    out.append("")
                elif bt == "tool_use":
                    out.append("- `%s`%s %s" % (
                        block.get("name"), sub, summarize_tool_input(block.get("name"), block.get("input"))))
        elif t == "user":
            content = (ev.get("message") or {}).get("content")
            if isinstance(content, list):
                for block in content:
                    if block.get("type") == "tool_result" and block.get("is_error"):
                        c = block.get("content")
                        if isinstance(c, list):
                            c = " ".join(x.get("text", "") for x in c if isinstance(x, dict))
                        out.append("  - ⚠️ tool error%s: %s" % (sub, short(c or "", 300)))
        elif t == "result":
            out.append("")
            out.append("**[result]** subtype=%s is_error=%s turns=%s cost=$%.2f" % (
                ev.get("subtype"), ev.get("is_error"), ev.get("num_turns"), ev.get("total_cost_usd") or 0))
    return "\n".join(out) + "\n"


def write_report(a):
    run_dir = os.path.join(a.root, a.name)
    subdir = getattr(a, "subdir", None)
    rep = os.path.join(run_dir, "_run_report", subdir) if subdir else os.path.join(run_dir, "_run_report")
    title = "%s / %s" % (a.name, subdir) if subdir else a.name
    os.makedirs(rep, exist_ok=True)
    prompt_file = getattr(a, "prompt_file", None)
    resumed_from = getattr(a, "resumed_from", None)
    if prompt_file and os.path.exists(prompt_file):
        shutil.copyfile(prompt_file, os.path.join(rep, "prompt.md"))

    transcript_src = a.transcript
    transcript_dst = os.path.join(rep, "transcript.jsonl")
    if not os.path.exists(transcript_src) and os.path.exists(transcript_dst):
        transcript_src = transcript_dst
    events = load_events(transcript_src)

    results = []
    init = None
    tool_counts = Counter()
    sub_tool_counts = Counter()
    last_text = None
    for ev in events:
        t = ev.get("type")
        if t == "result":
            results.append(ev)
        elif t == "system" and ev.get("subtype") == "init" and init is None:
            init = ev
        elif t == "assistant":
            for block in (ev.get("message") or {}).get("content") or []:
                if block.get("type") == "tool_use":
                    if ev.get("parent_tool_use_id"):
                        sub_tool_counts[block.get("name")] += 1
                    else:
                        tool_counts[block.get("name")] += 1
                elif block.get("type") == "text" and not ev.get("parent_tool_use_id"):
                    if block.get("text", "").strip():
                        last_text = block["text"]

    outputs = scan_outputs(run_dir)
    # A headless session can emit several `result` events: one each time the
    # agent's turn ends, e.g. it finishes, then is re-woken when a background
    # subagent/monitor it launched completes. total_cost_usd, duration_api_ms
    # and modelUsage are cumulative (take the max); duration_ms and num_turns
    # are per-segment (sum them). Wall time = real process lifetime, which also
    # covers any idle gap while the agent waited on background work.
    result = results[-1] if results else None
    complete = result is not None
    r = result or {}
    cumulative = max(results, key=lambda x: x.get("total_cost_usd") or 0) if results else {}
    cost = cumulative.get("total_cost_usd")
    api_ms = max((x.get("duration_api_ms") or 0) for x in results) if results else None
    active_ms = sum((x.get("duration_ms") or 0) for x in results) if results else None
    turns = sum((x.get("num_turns") or 0) for x in results) if results else None
    wall_ms = a.harness_wall_seconds * 1000 if a.harness_wall_seconds else active_ms

    final_text = r.get("result") if complete else None
    if not final_text:
        final_text = last_text or "(no final message captured)"

    status = "%s (%s)" % (r.get("subtype", "INCOMPLETE - no result event"), r.get("terminal_reason", "n/a"))
    if r.get("is_error"):
        status += " [is_error]"
    if a.exit_code != 0:
        status += " [exit %d]" % a.exit_code

    model_usage = cumulative.get("modelUsage") or {}
    raw_cum = cumulative_of(results)
    baseline = find_baseline(a.root, a.name, resumed_from) if (resumed_from and results) else None
    if baseline:
        cost = (cost or 0.0) - baseline["cost"]
        api_ms = (api_ms or 0) - baseline["api_ms"]
        model_usage = subtract_usage(model_usage, baseline["model_usage"])
    usage_lines = []
    total_out = 0
    total_think = 0
    for model, mu in model_usage.items():
        total_out += mu.get("outputTokens") or 0
        total_think += mu.get("thinkingTokens") or 0
        usage_lines.append("    %s:  %s input, %s output (%s thinking), %s cache read, %s cache write ($%.2f)" % (
            model,
            fmt_tok(mu.get("inputTokens")),
            fmt_tok(mu.get("outputTokens")),
            fmt_tok(mu.get("thinkingTokens")),
            fmt_tok(mu.get("cacheReadInputTokens")),
            fmt_tok(mu.get("cacheCreationInputTokens")),
            mu.get("costUSD") or 0.0,
        ))

    n_tools = sum(tool_counts.values())
    tools_str = ", ".join("%s %d" % (k, v) for k, v in tool_counts.most_common())
    sub_stats = max((x.get("subagent_stats") or {} for x in results),
                    key=lambda s: s.get("spawned", 0), default={})
    denials = [d for x in results for d in (x.get("permission_denials") or [])]

    # Detect background work killed by `claude -p`'s post-turn wait ceiling
    # (default 10 min, CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS). When that fires,
    # the agent never sees the results and never gets another turn, so its
    # final message is cut short by the harness, not by the model.
    stderr_text = ""
    for sp in (a.stderr, os.path.join(rep, "stderr.log")):
        if sp and os.path.exists(sp):
            with open(sp, "r", encoding="utf-8", errors="replace") as f:
                stderr_text = f.read()
            break
    harness_notes = []
    killed_sys = ((sub_stats.get("killed") or {}).get("system") or 0)
    if killed_sys or "Background tasks still running" in stderr_text:
        cli_msg = next((ln.strip() for ln in stderr_text.splitlines() if "Background tasks still running" in ln), "")
        harness_notes.append(
            "HARNESS CUT-OFF: the agent ended its turn while %d background subagent(s) it launched were still "
            "running. Headless `claude -p` waits at most 10 minutes for background work after the last turn "
            "(CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS), then kills it, so the agent never received those results or "
            "got another turn. The final message below is therefore an interim one. The game files are as the "
            "agent left them at that point.%s" % (
                killed_sys or 1, (" CLI message: \"%s\"" % cli_msg) if cli_msg else ""))
        status += " [bg subagent killed at 10-min -p wait ceiling]"

    usage_txt = []
    usage_txt.append("Run:                   %s" % title)
    if subdir:
        usage_txt.append("Follow-up of session:  %s (resumed with --fork-session; message in prompt.md)" % resumed_from)
        if baseline:
            usage_txt.append("Usage below covers this follow-up only. The CLI reports resumed sessions cumulatively "
                             "(incl. the parent session: $%.2f, API %s); the parent's totals were subtracted." % (
                                 raw_cum["cost"], fmt_dur(raw_cum["api_ms"])))
        else:
            usage_txt.append("WARNING: parent session totals not found; figures below may include the parent session.")
    usage_txt.append("Model:                 %s" % a.model)
    usage_txt.append("Effort:                %s" % a.effort)
    usage_txt.append("Status:                %s" % status)
    usage_txt.append("Session ID:            %s" % (r.get("session_id") or (init or {}).get("session_id") or "n/a"))
    usage_txt.append("Started (UTC):         %s" % a.start)
    usage_txt.append("Finished (UTC):        %s" % a.end)
    usage_txt.append("")
    usage_txt.append("Total cost:            %s" % ("$%.2f" % cost if cost is not None else "n/a"))
    usage_txt.append("Total duration (API):  %s" % fmt_dur(api_ms))
    usage_txt.append("Total duration (wall): %s" % fmt_dur(wall_ms))
    usage_txt.append("")
    usage_txt.append("Wall = session process start to exit. Active agent time: %s across %d result event(s)%s." % (
        fmt_dur(active_ms), len(results),
        "; the gap is time spent idle waiting on background work it launched" if len(results) > 1 else ""))
    if api_ms and wall_ms and api_ms > wall_ms:
        usage_txt.append("API time exceeds wall time because subagent API calls ran concurrently with the main agent.")
    usage_txt.append("Turns:                 %s" % (turns if turns is not None else "n/a"))
    usage_txt.append("Tool calls:            %d%s" % (n_tools, (" (%s)" % tools_str) if tools_str else ""))
    if sub_tool_counts:
        usage_txt.append("Subagent tool calls:   %d (%s)" % (
            sum(sub_tool_counts.values()), ", ".join("%s %d" % kv for kv in sub_tool_counts.most_common())))
    usage_txt.append("Subagents spawned:     %s" % sub_stats.get("spawned", 0))
    usage_txt.append("Permission denials:    %d" % len(denials))
    for note in harness_notes:
        usage_txt.append("")
        usage_txt.append(note)
        usage_txt.append("")
    usage_txt.append("Usage by model:")
    usage_txt.extend(usage_lines or ["    (none recorded)"])
    usage_txt.append("")
    usage_txt.append("Output files:          %d files, %s, %d lines of HTML/CSS/JS" % (
        outputs["file_count"], fmt_bytes(outputs["total_bytes"]), outputs["code_lines"]))
    usage_txt.append("Entry point:           %s" % (outputs["entry_point"] or "NONE FOUND"))
    for f in outputs["files"]:
        usage_txt.append("    %-40s %10s  %s" % (
            f["path"], fmt_bytes(f["bytes"]), ("%d lines" % f["lines"]) if f["lines"] is not None else ""))
    with open(os.path.join(rep, "usage.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(usage_txt) + "\n")

    with open(os.path.join(rep, "agent_output.md"), "w", encoding="utf-8") as f:
        f.write("# Agent output: %s\n\n" % title)
        f.write("- Model: `%s`\n- Effort: `%s`\n- Status: %s\n\n" % (a.model, a.effort, status))
        for note in harness_notes:
            f.write("> **%s**\n\n" % note)
        f.write("---\n\n")
        f.write(final_text.strip() + "\n")
        if len(results) > 1:
            f.write("\n---\n\n## Earlier result messages in this session\n\n")
            f.write("_The session ended its turn %d times (it was re-woken by background work it launched). "
                    "The final message is above; earlier ones follow, oldest first._\n" % len(results))
            for i, ev in enumerate(results[:-1]):
                f.write("\n### Result %d of %d\n\n%s\n" % (i + 1, len(results), (ev.get("result") or "").strip()))

    with open(os.path.join(rep, "result.json"), "w", encoding="utf-8") as f:
        json.dump(results[0] if len(results) == 1 else (results or None), f, indent=2)

    meta = {
        "name": a.name,
        "label": subdir,
        "resumed_from": resumed_from,
        "model": a.model,
        "effort": a.effort,
        "complete": complete,
        "status": status,
        "exit_code": a.exit_code,
        "start": a.start,
        "end": a.end,
        "harness_wall_seconds": a.harness_wall_seconds,
        "session_id": r.get("session_id"),
        "total_cost_usd": cost,
        "duration_api_ms": api_ms,
        "wall_ms": wall_ms,
        "active_ms": active_ms,
        "result_events": len(results),
        "num_turns": turns,
        "tool_calls": n_tools,
        "tool_counts": dict(tool_counts),
        "subagents_spawned": sub_stats.get("spawned", 0),
        "permission_denials": len(denials),
        "harness_notes": harness_notes,
        "output_tokens": total_out,
        "thinking_tokens": total_think,
        "outputs": outputs,
    }
    with open(os.path.join(rep, "run_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    with open(os.path.join(rep, "transcript.md"), "w", encoding="utf-8") as f:
        f.write(build_transcript_md(events, title))

    if transcript_src != transcript_dst and os.path.exists(transcript_src):
        shutil.move(transcript_src, transcript_dst)
    if a.stderr and os.path.exists(a.stderr):
        shutil.move(a.stderr, os.path.join(rep, "stderr.log"))


def regenerate_results(root):
    rows = []
    for fam in FAMILIES:
        for eff in EFFORTS:
            name = "%s_%s" % (fam, eff)
            meta_path = os.path.join(root, name, "_run_report", "run_meta.json")
            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    rows.append(json.load(f))
            elif os.path.isdir(os.path.join(root, name)):
                rows.append({"name": name, "pending": True})
    lines = []
    lines.append("# Breakout one-shot challenge: Opus 5.5 vs Fable 5.2")
    lines.append("")
    lines.append("Same prompt (`PROMPT.md`) for every run. Each run is an independent headless Claude Code session "
                 "(`claude -p --model <id> --effort <level> --safe-mode --permission-mode auto`) whose working "
                 "directory is its own folder. Per-run details live in `<run>/_run_report/`.")
    lines.append("")
    lines.append("| Run | Model | Effort | Status | Total cost | Duration (API) | Duration (wall) | Turns | Tool calls | Output tokens | Files | Code lines | Entry point |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for m in rows:
        if m.get("pending"):
            lines.append("| %s | | | running… | | | | | | | | | |" % m["name"])
            continue
        o = m.get("outputs") or {}
        cost = m.get("total_cost_usd")
        entry = o.get("entry_point")
        lines.append("| %s | `%s` | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |" % (
            m["name"], m["model"], m["effort"], m["status"],
            ("$%.2f" % cost) if cost is not None else "n/a",
            fmt_dur(m.get("duration_api_ms")), fmt_dur(m.get("wall_ms", m.get("duration_ms"))),
            m.get("num_turns", ""), m.get("tool_calls", ""), fmt_tok(m.get("output_tokens")),
            o.get("file_count", ""), o.get("code_lines", ""),
            ("[%s](%s/%s)" % (entry, m["name"], entry)) if entry else "NONE",
        ))
    followups = []
    for fam in FAMILIES:
        for eff in EFFORTS:
            name = "%s_%s" % (fam, eff)
            rep_root = os.path.join(root, name, "_run_report")
            if not os.path.isdir(rep_root):
                continue
            for sub in sorted(os.listdir(rep_root)):
                mp = os.path.join(rep_root, sub, "run_meta.json")
                if os.path.isfile(mp):
                    with open(mp, "r", encoding="utf-8") as f:
                        followups.append(json.load(f))
    if followups:
        lines.append("")
        lines.append("### Follow-up sessions (after the one-shot)")
        lines.append("")
        lines.append("Bug reports sent back to the same worker (same model, effort and flags, resumed from its "
                     "original session). The table above is one-shot only; these costs are extra.")
        lines.append("")
        lines.append("| Run | Follow-up | Status | Cost | Duration (API) | Duration (wall) | Turns | Tool calls | Details |")
        lines.append("|---|---|---|---|---|---|---|---|---|")
        for m in followups:
            cost = m.get("total_cost_usd")
            lines.append("| %s | %s | %s | %s | %s | %s | %s | %s | [report](%s/_run_report/%s/) |" % (
                m["name"], m.get("label"), m.get("status"),
                ("$%.2f" % cost) if cost is not None else "n/a",
                fmt_dur(m.get("duration_api_ms")), fmt_dur(m.get("wall_ms")),
                m.get("num_turns", ""), m.get("tool_calls", ""), m["name"], m.get("label")))
    smoke_path = os.path.join(root, "_smoke", "results.json")
    if os.path.isfile(smoke_path):
        with open(smoke_path, "r", encoding="utf-8") as f:
            smoke = json.load(f)
        lines.append("")
        lines.append("### Smoke test: does it error immediately? (headless Chrome, opened via file://)")
        lines.append("")
        lines.append("Load + 3 s on the title screen, then a generic start (Play/Start button, click, Enter, Space) "
                     "and ~6 s of play. Counts uncaught exceptions, console errors and failed file loads. "
                     "Details: `_smoke/SMOKE_TEST.md`.")
        lines.append("")
        lines.append("| Run | Result | Errors on load | Errors after start | Start button clicked |")
        lines.append("|---|---|---|---|---|")
        fixes_by_run = {}
        for fu in followups:
            fixes_by_run.setdefault(fu["name"], []).append(fu.get("label"))
        for s in smoke:
            real = s.get("real") or []
            n_load = sum(1 for x in real if x.get("phase") == "load")
            verdict = "❌ FAIL" if real else "✅ pass"
            if s["run"] in fixes_by_run:
                verdict += " (after %s; the one-shot version did not pass)" % ", ".join(fixes_by_run[s["run"]])
            lines.append("| %s | %s | %d | %d | %s |" % (
                s["run"], verdict, n_load, len(real) - n_load, s.get("clicked") or "—"))
    noted = [m for m in rows if m.get("harness_notes")]
    if noted:
        lines.append("")
        lines.append("### Harness notes")
        for m in noted:
            for note in m["harness_notes"]:
                lines.append("- **%s**: %s" % (m["name"], note))
    done = [m for m in rows if not m.get("pending") and m.get("total_cost_usd") is not None]
    if done:
        lines.append("")
        one_shot = sum(m["total_cost_usd"] for m in done)
        fu_cost = sum((m.get("total_cost_usd") or 0) for m in followups)
        lines.append("**Total spend so far:** $%.2f across %d one-shot run(s)%s." % (
            one_shot, len(done),
            (" + $%.2f across %d follow-up session(s) = $%.2f" % (fu_cost, len(followups), one_shot + fu_cost))
            if followups else ""))
    tmp = os.path.join(root, ".RESULTS.md.tmp.%d" % os.getpid())
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    os.replace(tmp, os.path.join(root, "RESULTS.md"))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--root", required=True)
    p.add_argument("--name")
    p.add_argument("--model")
    p.add_argument("--effort")
    p.add_argument("--transcript")
    p.add_argument("--stderr")
    p.add_argument("--exit-code", type=int, default=0)
    p.add_argument("--start", default="n/a")
    p.add_argument("--end", default="n/a")
    p.add_argument("--harness-wall-seconds", type=int, default=0)
    p.add_argument("--subdir", help="write the report to _run_report/<subdir>/ (follow-up sessions)")
    p.add_argument("--prompt-file", help="follow-up message sent to the agent; copied to prompt.md")
    p.add_argument("--resumed-from", help="session id the follow-up resumed")
    p.add_argument("--results-only", action="store_true")
    p.add_argument("--rebuild-all", action="store_true",
                   help="re-derive every finished run's report from its saved transcript + run_meta.json")
    a = p.parse_args()
    if a.rebuild_all:
        for fam in FAMILIES:
            for eff in EFFORTS:
                name = "%s_%s" % (fam, eff)
                meta_path = os.path.join(a.root, name, "_run_report", "run_meta.json")
                if not os.path.exists(meta_path):
                    continue
                with open(meta_path, "r", encoding="utf-8") as f:
                    m = json.load(f)
                ra = argparse.Namespace(
                    root=a.root, name=name, model=m["model"], effort=m["effort"],
                    transcript=os.path.join(a.root, name, "_run_report", "transcript.jsonl"),
                    stderr=None, exit_code=m.get("exit_code", 0), start=m.get("start", "n/a"),
                    end=m.get("end", "n/a"), harness_wall_seconds=m.get("harness_wall_seconds", 0))
                write_report(ra)
                print("rebuilt", name)
    elif not a.results_only:
        write_report(a)
    regenerate_results(a.root)


if __name__ == "__main__":
    sys.exit(main())
