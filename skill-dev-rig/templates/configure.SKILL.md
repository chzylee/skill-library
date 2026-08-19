---
name: configure
description: REFERENCE TEMPLATE — copy into your skill's repo and adapt (the /skill-dev-rig verb does this for you). Launches the config-form engine to configure a skill through a web form, then runs the setup tasks the user asked for. Trigger on "configure <skill>", "set up <skill>", "change <skill> settings".
---

# configure (reference template)

Copy this into your repo and fill in the two consumer-specific parts marked
**‹ADAPT›**: how to compute each task's status, and how to run each task.
Everything else is generic.

The engine (`config-form.mjs`, which runs on `local-ui.mjs` — vendor both
together) renders the form and writes values. This skill is the brain: it
computes status with your tools, launches the form, and runs the tasks the
form hands back.

## Inputs
- The **schema** for your skill (e.g. `<skill>/<skill>.schema.json`).
- The **engine** pair (vendored `config-form.mjs` + `local-ui.mjs`, or the
  installed plugin's `skill-dev-rig/` copies).
- The **config file** your skill reads (the schema's `configPath`).

## Steps

1. **Read current values.** Load the config file if it exists → a
   `{ key: value }` object. Write it to a temp file `values.json`.

2. **‹ADAPT› Compute task status.** For each task in the schema, use your
   tools to check whether it's done, and write `status.json` as
   `{ taskId: { "done": bool, "detail": "..." } }`. Examples:
   - `install-block` → is the marked block present and current in `~/.claude/CLAUDE.md`?
   - `create-audit-results` → does the configured `audit_results_url` resolve to a real page?
   - `register-audit-job` → is a schedule registered at the configured cadence?

3. **Launch the form** (it blocks until the user submits — that's intended).
   Mind the ~10-minute blocking-Bash ceiling: keep the engine's default
   `--timeout` (540) and set the Bash tool timeout to `600000`, or run it in
   the background and poll the `CONFIG_FORM_RESULT` file:
   ```
   node <engine>/config-form.mjs --schema <schema> --values values.json --status status.json \
     --out <configPath> --tasks-out tasks.json --title "<skill>" --open
   ```
   Parse `CONFIG_FORM_URL=…` from stdout and show it to the user in case the
   browser didn't open. If a `CONFIG_FORM_WARN` line appears, **tell the user
   before they fill the form**: their existing config could not be read, the
   form is showing defaults, and saving will drop whatever was in that file. On exit, read the `CONFIG_FORM_SUMMARY … CONFIG_FORM_DONE`
   fence and report it. If there's no browser/display, fall back to asking the
   schema's fields as plain questions and writing the config file yourself
   (same shape).

4. **On return**, read the freshly written config file and `tasks.json` (the
   ids to run). Exit 3 (`CONFIG_FORM_TIMEOUT`) means nobody submitted — say so
   and stop; nothing was written.

5. **‹ADAPT› Run the requested tasks** with your tools, in order. Each task
   that produces a value (e.g. a created page URL) should be **written back
   into the config file** so it's set next time. Examples:
   - `create-audit-results` → create the page, store its URL under `audit_results_url`.
   - `register-audit-job` → register/refresh the schedule at `cadence_days`.
   Never delete anything; if a task supersedes something, mark it, don't remove it.

6. **Report** the final state: which values were saved, which tasks ran, and
   what's still outstanding (any required field left blank, any non-optional
   task not done).

## Notes
- The config file is the single source of truth; every other skill of yours
  reads it. The form is just an editor for it.
- Re-running this skill is how you reconfigure — the form always reflects
  current state, so first setup and a later tweak are the same act. This is
  your one configuration handle.
- Launch the form once at a time. If a stale tab from an earlier launch is
  still open, its save simply fails ("is the terminal process still
  running?") — nothing merges silently.
