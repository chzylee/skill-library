# ratify-configure

Settings console for [ratify](../ratify/README.md)'s local decision telemetry. Ratify records one
enums-only line per ratified decision to a file on your machine (never transmitted); this skill is
the one handle for that setting — see your own numbers, keep recording, or turn it off.

```
/ratify-configure
```

## What it does

Opens a small local web form (no network beyond `localhost`), waits for you to save, then writes
`~/.claude/ship-pipeline/config.json` and confirms what changed. It also bootstraps the install
identity file (`install.json`) that ratify's records are keyed by. The `ship-pipeline` path name is
historical — ratify grew up inside the [Ship Pipeline](https://github.com/chzylee/ship-pipeline)
build process; honor `$SHIP_PIPELINE_DATA_DIR` to relocate it.

## Install

Companion to `ratify` — install both. From the repo root prompt in the
[library README](../README.md), use `<SKILL-NAME> is: ratify-configure` (and once more for
`ratify`), or install the whole plugin.

Claude Code only: it shells out to Node for the config form and writes files under `~/.claude/`.

## Requirements

- Node.js (runs `config-form.mjs` locally)
- The `ratify` skill, which reads the config this writes
