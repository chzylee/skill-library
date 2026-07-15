# write-enforcement

A **write-time quality gate** for the Writing Standard. It installs a Claude Code **PreToolUse
hook** on your page-write tool that, at the exact moment a page is written, re-surfaces the
"how to write" rules and flags the handful of mechanically-checkable violations — so the standard
is *applied* at write time, not just carried in fading context.

```
install write enforcement
```

## What it does

When a guarded write fires (the Notion `notion-create-pages` / `notion-update-page` tools by
default), the hook:

1. **Re-surfaces the Writing Standard reminder** — overview-first, structure over prose,
   cite-or-flag, teammate-engineer voice (no jargon), current-state only, collapsible default.
2. **Flags likely violations** of four checkable rules:
   - **Mode declaration** missing from the top of the page.
   - **Collapsible headers** absent on a long doc (4+ headings, zero `<details>`).
   - **Banned coined jargon** (starter list: `carve-out`, `gap-read`, `cohort`; extends over time).
   - **Inline change-notes** (`changed on …`, `(was: …)`, `updated after …`) in a deliverable.

The full check spec is in [`references/mechanical-floor.md`](references/mechanical-floor.md).

## Advisory by default, strict is opt-in

- **Advisory (default) — non-blocking.** The hook NEVER hard-blocks or crashes a write; a broken
  gate would disrupt every session. It surfaces the reminder + flags as advisory context (via the
  PreToolUse `additionalContext` channel, so Claude sees it) and lets the write proceed. On any
  error it exits 0 silently — fail open, always.
- **Strict / block-on-violation — opt-in.** Set `WRITE_ENFORCEMENT_STRICT=1` and the hook emits a
  `deny` decision when a violation is flagged, blocking the write until it's fixed. Parse errors
  still fail open even in strict mode.

## Install

### Claude Code (personal)

```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/write-enforcement ~/.claude/skills/write-enforcement
```

Windows (PowerShell):

```powershell
git clone https://github.com/chzylee/skill-library.git
Copy-Item -Recurse skill-library\write-enforcement $env:USERPROFILE\.claude\skills\write-enforcement
```

Restart Claude Code (or start a new session). Project-scoped instead? Copy the `write-enforcement`
folder into that project's `.claude/skills/`.

Copying the folder in only makes the skill *available*. To actually wire the hook into
`settings.json`, **invoke the skill** (below) — it performs the merge for you, in exec form,
without clobbering your existing hooks.

### Claude desktop

This skill installs a Claude Code hook, so it targets Claude Code, not the desktop app. (A
packaged `.skill` bundle, if built into `dist/`, is for portability only.)

## Invoke

"install write enforcement" · "enforce my writing standard at write time" · "set up the write-time
quality gate" · "lint my notion writes" · `/write-enforcement`

When invoked, Claude Code resolves the script's absolute path, resolves `powershell.exe`, and
**appends** a `hooks.PreToolUse` entry to `$HOME/.claude/settings.json` — merging without
disturbing any existing `PreToolUse` entries or your `SessionEnd` hook. It then reports exactly
what it wired.

## The Windows exec-form gotcha (why the install is careful)

On Windows the hook is wired in **exec form** — `powershell.exe` invoked directly with an `args`
array (`-NoProfile -ExecutionPolicy Bypass -File <abs path>`), **never** as a bash shell command
string. A shell-string hook is run through Git Bash, whose pipe **corrupts the JSON payload** on
stdin, so the hook can't parse it. Exec form delivers the payload intact. The skill always installs
this way.

## Requirements

- **Windows:** `powershell.exe` (built in). No packages.
- **Mac/Linux:** `/bin/sh`; `jq` optional — without it, the sh hook degrades to surfacing the
  static reminder only (still advisory, still exits 0).
- No network access, no external dependencies.

## Retarget the write tool (Obsidian / Confluence / …)

The checks screen page markdown regardless of which tool produced it. To guard a different write
tool: change the settings.json **matcher** to match that tool's name, and add the tool's name
substring to `$WriteToolPatterns` (`.ps1`) / `WRITE_TOOL_PATTERNS` (`.sh`). Both must agree; nothing
else changes. Details in [`SKILL.md`](SKILL.md).

## License

MIT — see [LICENSE](../LICENSE).
