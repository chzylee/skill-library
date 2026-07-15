# recording-standard

Installs and keeps fresh the **Recording Standard enforcement copy** on a machine — so the
"every written thing has one home you can name" routing rule is present in your global
`~/.claude/CLAUDE.md` on every box, and stays in sync without manual copy-paste.

```
install the recording standard
```

## What it does

The canonical Recording Standard lives in Notion. This skill carries the **enforcement copy**
(the terse, machine-facing version) and installs it two ways:

1. **A marked, dated block in `~/.claude/CLAUDE.md`.** Delimited by
   `<!-- RECORDING-STANDARD vYYYY-MM-DD START -->` … `END -->` markers so it can be upserted
   idempotently — re-running replaces the block in place and leaves the rest of the file untouched.
2. **A SessionStart hook** (`hooks/recording-standard-check.ps1` on Windows,
   `hooks/recording-standard-check.sh` on macOS/Linux) that reads the block's version at the start
   of every session and prints a warning if the block is **missing** or **older** than the version
   this skill ships. It never blocks or errors a session — it only nags on drift.

When the standard changes, the enforcement copy here is re-cut with a new version date; re-run the
skill on each machine to upgrade. Machines that haven't upgraded start seeing the "stale" warning.

## Install

### Claude Code (personal)

```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/recording-standard ~/.claude/skills/recording-standard
```

Windows (PowerShell):

```powershell
git clone https://github.com/chzylee/skill-library.git
Copy-Item -Recurse skill-library\recording-standard $env:USERPROFILE\.claude\skills\recording-standard
```

Restart Claude Code (or start a new session). Project-scoped instead? Copy the `recording-standard`
folder into that project's `.claude/skills/`.

Then **invoke the skill once** (see below) to actually write the block into `~/.claude/CLAUDE.md`
and register the SessionStart hook. Copying the folder in installs the skill; invoking it performs
the machine setup.

### Claude desktop

Upload `dist/recording-standard.skill` via **Settings → Customize → Skills**, or present it in a
claude.ai chat and click **Save skill**. (Desktop has no `~/.claude` hook wiring — the block/hook
install is a Claude Code feature.)

## Invoke

"install the recording standard" · "sync my recording standard" ·
"set up recording-standard enforcement" · "the recording standard block is stale" ·
"update the recording standard block" · `/recording-standard`

Re-run any time — it is idempotent. It shows you a diff of the CLAUDE.md block and the
`settings.json` hook change and confirms before writing.

## How it works

- **The block** is bundled verbatim at [`references/recording-standard-block.md`](references/recording-standard-block.md),
  markers included. That file is the single source of truth for what gets written.
- **The hook** carries the same version date as a constant (`$ExpectedVersion` / `EXPECTED_VERSION`)
  and compares it against the date in the installed block's START marker.

### Windows hook must be exec-form (important)

On Windows the SessionStart hook is registered in **exec form** — an object with `command` set to
`powershell.exe` and the script passed via `args` — **not** as a bash shell string. Claude Code's
default hook shell on Windows is Git Bash, and routing the JSON hook payload through a bash string
corrupts the payload's backslashes. Exec form hands argv straight to `powershell.exe` and avoids
that. The skill writes this form for you; don't rewrite the hook entry as a shell string.

## Requirements

- **Claude Code** (the block + hook wiring live under `~/.claude`).
- **Windows:** Windows PowerShell (`powershell.exe`, present by default) runs the `.ps1` hook.
- **macOS/Linux:** POSIX `sh` runs the `.sh` hook (no `jq` needed — it uses `grep`/`sed`).

## License

MIT — see [LICENSE](../LICENSE).
