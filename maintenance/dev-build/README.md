# dev-build

Maintainer tooling for this repo. Manages **dev builds** — the `<skill>-dev` skills
deployed from the `dev` branch so work-in-progress is testable side by side with the
stable plugin versions, without ever shadowing them — and handles per-skill promotion
to `main`.

```
/dev-build deploy notion-digest    # generate/refresh ~/.claude/skills/notion-digest-dev from dev
/dev-build status                  # deployed builds · stale/orphans · what's ahead of main
/dev-build promote notion-digest   # folder → main, plugin manifest, README row, bundle, teardown
```

## The model in one paragraph

`main` + the plugin = production: what every session runs. The `dev` branch = source
for work in progress. A dev build is a **generated artifact** deployed from `dev` into
`~/.claude/skills/<skill>-dev` — explicitly invoked only, stamped with the commit it
came from, never hand-edited. Ephemeral like a preview environment: deployed while work
is active, torn down at promotion. A SessionStart hook in this repo (and only this
repo) warns when a deployed build has gone stale or orphaned.

## Install

This is maintainer tooling, not a library skill — install it only if you run this
library or a fork of it:

```text
/plugin install skill-library-maint@noah-skill-library
```

Or work inside a clone of the repo, where the skill is available from the checkout.

## Requirements

- git; the repo cloned with both `main` and `dev` branches
- Python (for building `.skill` bundles at promotion; `PYTHONUTF8=1` on Windows)
