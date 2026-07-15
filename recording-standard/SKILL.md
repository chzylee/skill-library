---
name: recording-standard
description: 'Installs and keeps fresh the Recording Standard enforcement copy on this machine: a marked, dated block in the global ~/.claude/CLAUDE.md plus a SessionStart hook that warns when the block is missing or stale. Replaces manual copy-paste sync of the standard. Triggers on "install the recording standard", "sync my recording standard", "set up recording-standard enforcement", "the recording standard block is stale", "update the recording standard block", or /recording-standard. Idempotent — re-run any time to refresh to the latest version.'
---

# Recording Standard installer

This skill puts the **Recording Standard enforcement copy** into the machine's global
`~/.claude/CLAUDE.md` as a **marked, dated block**, and wires a **SessionStart hook**
that warns whenever that block is missing or older than the version this skill ships.
It replaces manual copy-paste sync: run it once to install, re-run any time to refresh.

The canonical standard lives in Notion; the block bundled here
(`references/recording-standard-block.md`) is the **enforcement copy** derived from it.
When the Notion standard changes, the enforcement copy in this skill is re-cut and its
version date bumped — re-running the skill upgrades the machine.

> **Mechanism (ratified 2026-07-14):** a versioned block delimited by HTML-comment
> markers, plus a session hook that reads the version and nags on drift. The block's
> version lives in the `<!-- RECORDING-STANDARD vYYYY-MM-DD START -->` marker; the hook
> carries the same date as `$ExpectedVersion` and compares.

## What to do when invoked

Perform an **idempotent install/refresh**. Resolve `$HOME` at runtime — never hardcode an
absolute home path. Show the user what will change and confirm before writing, then report.

### Step 1 — Load the block
Read `references/recording-standard-block.md` from this skill's own folder (resolve the path
relative to where this skill is installed; do not assume a fixed location). This file is the
verbatim enforcement copy, **including** its `<!-- RECORDING-STANDARD v… START -->` /
`… END -->` markers. Treat its content as exact — do not edit, reflow, or re-wrap it.

Note the version date in the START marker (e.g. `2026-07-14`); you will report it.

### Step 2 — Upsert the block into `$HOME/.claude/CLAUDE.md`
Read the current `$HOME/.claude/CLAUDE.md` (UTF-8) if it exists.

- **If a `<!-- RECORDING-STANDARD … START -->` … `<!-- RECORDING-STANDARD … END -->` block
  already exists:** replace everything from the START marker line through the END marker line
  (inclusive) with the new block. Match the markers by their comment pattern, not by a fixed
  version — the existing one may be an older date.
- **If no such block exists:** append the new block as a new section at the **end** of the file
  (with a blank line before it). If the file itself does not exist, create it containing just
  the block.
- **Preserve everything else untouched** — all other CLAUDE.md content, ordering, and spacing
  outside the marker pair must be byte-for-byte unchanged. Only the marked region is rewritten.

Write the file back as UTF-8.

**Before writing, show the user a diff** (old block vs new block, or "no existing block — will
append") and confirm. If the existing block is already identical to the new one, say so and skip
the write — nothing to do.

### Step 3 — Wire the SessionStart hook into `$HOME/.claude/settings.json`
The hook file to register is this skill's `hooks/recording-standard-check.ps1` (Windows) or
`hooks/recording-standard-check.sh` (macOS/Linux). Use its **absolute path** as it sits in the
installed skill folder.

Read `$HOME/.claude/settings.json` (create `{}` if absent). Add the hook under
`hooks.SessionStart`, in **exec form** — an object, never a shell string:

On **Windows**, the entry must be:
```json
{
  "type": "command",
  "command": "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  "args": ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "<ABSOLUTE path to hooks\\recording-standard-check.ps1>"]
}
```

On **macOS/Linux**, the entry must be:
```json
{
  "type": "command",
  "command": "/bin/sh",
  "args": ["<ABSOLUTE path to hooks/recording-standard-check.sh>"]
}
```

Claude Code's `hooks.SessionStart` is an array of matcher groups, each with a `hooks` array.
Merge into the existing structure:
- If `hooks.SessionStart` already exists, **append** this command into an appropriate group's
  `hooks` array (or add a new group) **without removing or altering any existing hook**.
- If it does not exist, create it.
- **Do not touch `hooks.SessionEnd`** (that is the ts-pmo debrief hook) or any other hook type.
- **Idempotency:** if a SessionStart hook already points at `recording-standard-check` (any path
  ending in that script name), update that entry in place instead of adding a duplicate. Re-running
  the skill must not accumulate copies.

**CRITICAL Windows gotcha — honor it, do not "simplify":** the hook must be registered in
**exec form** (the object with `command` + `args` above), *never* as a single bash shell-string
like `"powershell -File …"`. Claude Code's default hook shell on Windows is Git Bash, and piping the
JSON hook payload through a bash string **corrupts the backslashes** in the payload (path escaping
gets mangled), so the hook receives broken input. Exec form bypasses the shell and hands argv
directly to `powershell.exe`, which is the only reliable way. Preserve exec form on every write.

Write `settings.json` back as valid JSON (preserve existing keys and formatting as much as
practical). **Show the user the settings diff and confirm before writing.**

### Step 4 — Report
Tell the user exactly what happened:
- Whether the CLAUDE.md block was **installed / updated (from vOLD to vNEW) / already current**.
- Whether the SessionStart hook was **added / updated / already present**, and the absolute script
  path registered.
- Remind them the hook takes effect on the **next** Claude Code session, and that the block is now
  the machine's live enforcement copy.

## Notes

- **Machine-agnostic:** everything resolves from `$HOME` / `$env:USERPROFILE` at runtime. No absolute
  home paths in the block, the hooks, or the settings entry beyond the runtime-resolved skill path.
- **The hook never blocks.** Both hook scripts always exit 0 and only ever write a warning to stderr;
  a missing or stale block nags but never stops a session.
- **Upgrades:** when the enforcement copy is re-cut (new version date in the block and in the hook's
  `$ExpectedVersion`), simply re-run this skill on each machine. The hook on already-installed machines
  will start warning "stale" until they re-run, which is the intended prompt.
- **This skill only edits `$HOME/.claude/CLAUDE.md` and `$HOME/.claude/settings.json`.** It does not
  edit any project files or the Notion source.
