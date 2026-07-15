---
name: write-enforcement
description: 'Installs a PreToolUse hook that enforces the Writing Standard''s mechanical floor at the moment a page is written — re-surfacing the writing rules and flagging likely violations at write time, not merely carrying them in fading context. Advisory (non-blocking) by default; a strict block-on-violation mode is opt-in. Target-agnostic: guards the Notion create/update-page tools today, and retargets to an Obsidian or Confluence write tool by changing one matcher. Triggers on "install write enforcement", "enforce my writing standard at write time", "set up the write-time quality gate", "lint my notion writes", or /write-enforcement. When invoked, wire the hook into settings.json (exec form) and report what was installed.'
---

# write-enforcement

Installs a **PreToolUse hook on the write tool** that applies the Writing Standard's mechanical
floor **at write time**. The value is timing: the quality bar is re-surfaced and checked at the
exact moment a page is written, instead of relying on the rules still being fresh in context.

- **What it screens** — the four mechanically-checkable Writing-Standard rules (mode declaration,
  collapsible headers on long docs, banned coined jargon, no inline change-notes) plus the
  one-paragraph "how to write" reminder. Full detail: [`references/mechanical-floor.md`](references/mechanical-floor.md).
- **Advisory by default (non-blocking).** The hook NEVER hard-blocks or crashes a write. A broken
  gate would disrupt every session, so it fails open: on any error it exits 0 silently, and in
  normal operation it surfaces the rules + flags as advisory context and lets the write proceed.
- **Target-agnostic.** The guarded write tool is configurable. It guards the Notion
  `notion-create-pages` / `notion-update-page` tools today; the same design retargets to an
  Obsidian or Confluence write tool by changing the matcher and the tool-name patterns.

> **Mode: Operational surface.** This page tells Claude Code how to install and wire the hook when
> the skill is invoked. It is a procedure, not a reference — follow the steps and report back.

## What gets installed

Two hook scripts ship in [`hooks/`](hooks/):

- `write-enforcement-lint.ps1` — Windows / PowerShell (the one to wire on Noah's machine).
- `write-enforcement-lint.sh` — POSIX sh (Mac/Linux; `jq` optional, degrades gracefully).

Both read the PreToolUse JSON payload from stdin, and — when the tool is a guarded page-write —
extract the page markdown, re-surface the reminder, and flag violations. They use the documented
**non-blocking** PreToolUse channel: JSON on stdout with `permissionDecision: "defer"` and
`additionalContext` (so Claude *sees* the message while the write still goes through). They mirror
the same text to stderr for the user's transcript.

## Install procedure (Claude Code follows this when invoked)

### 1. Resolve paths at runtime (never hardcode)
- Skill directory: the folder containing this `SKILL.md` (e.g. `$HOME/.claude/skills/write-enforcement`).
  Resolve `$HOME` at runtime; do not bake an absolute user path into the skill.
- Hook script (Windows): `<skill-dir>/hooks/write-enforcement-lint.ps1` — compute its **absolute**
  path (settings.json needs an absolute path, not `$HOME`).
- `powershell.exe`: resolve its absolute path, e.g. `(Get-Command powershell.exe).Source`
  (typically `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`).

### 2. Build the hook entry — EXEC FORM ONLY
Use command + `args` array (exec form). **Do NOT** use a single shell/bash command string.

```json
{
  "matcher": "notion-create-pages|notion-update-page",
  "hooks": [
    {
      "type": "command",
      "command": "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      "args": [
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", "C:\\Users\\<you>\\.claude\\skills\\write-enforcement\\hooks\\write-enforcement-lint.ps1"
      ]
    }
  ]
}
```

> **CRITICAL Windows gotcha — exec form only, never a bash shell string.** On Windows, a hook
> defined as a shell command string is run through Git Bash, and Git Bash's pipe **corrupts the
> JSON payload** delivered on stdin (line-ending / encoding mangling), so the hook can't parse it.
> Invoking `powershell.exe` directly with an `args` array (exec form) bypasses the shell and
> delivers the stdin payload intact. Always wire this hook in exec form.

On Mac/Linux, use the sh script instead:
```json
{
  "matcher": "notion-create-pages|notion-update-page",
  "hooks": [
    { "type": "command", "command": "/bin/sh", "args": ["<skill-dir>/hooks/write-enforcement-lint.sh"] }
  ]
}
```

### 3. Merge into `$HOME/.claude/settings.json` WITHOUT clobbering
- Read the existing `settings.json` (create `{}` if absent).
- Ensure `hooks` exists; ensure `hooks.PreToolUse` is an array.
- **Append** this entry to the `hooks.PreToolUse` array. Do not replace the array — other
  PreToolUse hooks may already be present. If an entry with this exact matcher + script already
  exists, update it in place instead of adding a duplicate (idempotent re-install).
- **Do NOT touch `hooks.SessionEnd`** (ts-pmo's debrief hook lives there) or any other hook event.
- Write the file back with the rest of settings.json intact (preserve `permissions`, `env`, etc.).

### 4. Verify and report
- Confirm the JSON is valid and the script path exists.
- Optionally smoke-test: pipe a sample payload to the script and confirm it exits 0 and prints the
  reminder (see the script header for a sample).
- **Report to the user**: which settings.json was edited, the matcher used, the absolute script
  path wired, the powershell.exe path, that it's installed in **advisory** mode, and how to switch
  to strict mode (below).

## Advisory vs. strict mode

- **Advisory (default).** Surfaces the reminder + any flags via `additionalContext` and lets the
  write proceed. Nothing is blocked.
- **Strict / block-on-violation (opt-in).** Set the environment variable
  `WRITE_ENFORCEMENT_STRICT=1` (in `settings.json` `env`, or the shell). When any violation is
  flagged, the hook emits a PreToolUse `deny` decision and the write is blocked until fixed.
  Parse/read errors still fail open (exit 0) even in strict mode. Only opt in once you trust the
  checks against your real pages — a strict gate that misfires is disruptive.

## Retargeting to a different write tool (Obsidian / Confluence / etc.)

The guard is target-agnostic — the content checks screen page markdown regardless of source. To
guard a different write tool:

1. **Matcher** (settings.json): change it to match the new tool's name, e.g.
   `obsidian-.*write|confluence-.*page`. Matchers are regex-matched against the tool name.
2. **Tool-name patterns** (in the hook script): add the new tool's name substring to
   `$WriteToolPatterns` (PowerShell) / `WRITE_TOOL_PATTERNS` (sh). The script re-checks the tool
   name as belt-and-suspenders, so both must agree.

Nothing else changes — the `references/mechanical-floor.md` checks are content-only.

## Extending the checks

- **Banned jargon** — append new coined offenders to `$Banned` (ps1) / `BANNED` (sh) and to
  `references/mechanical-floor.md`. The list is a floor that compounds as offenders surface.
- **Reminder text** — keep the `$Reminder` block in both scripts in sync with the canonical
  Writing Standard. It is a derived pointer; if the Standard changes, update the scripts.

## Install / requirements

- **Install the skill:** drop this folder into a Claude Code skills path (e.g.
  `~/.claude/skills/write-enforcement/`). See the README for clone + copy commands.
- **Invoke:** say a trigger phrase (e.g. "install write enforcement") or run `/write-enforcement`;
  Claude Code then performs the install procedure above.
- **Requirements:** Windows path uses `powershell.exe` (built in). POSIX path uses `/bin/sh`; `jq`
  is optional (without it, the sh hook degrades to surfacing the static reminder only). No network,
  no external packages.
