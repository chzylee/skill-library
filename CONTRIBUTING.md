# Contributing / running your own copy

This repo is a personal skill library shared as-is — but it's built so a fork is a
complete, working library of your own, maintenance rig included. This guide covers
both: proposing a change here, and running a fork.

## The branch model

- **`main`** — only skills a stranger can use today. Everything on main is in the
  plugin and the README catalog.
- **`dev`** — work in progress. Skills here may be broken, half-renamed, or
  undocumented; that's what dev is for.

## Skill anatomy

Each skill is one self-contained folder at the repo root:

```
<skill>/
├── SKILL.md       # the skill itself — frontmatter (name, description) + instructions
├── README.md      # what it is · install · invoke · requirements
└── references/…   # optional bundled assets
```

Rules: no cross-skill dependencies, no absolute paths, machine-agnostic. Skills that
need a connector (e.g. Notion MCP) are fine; skills that need *my* specific databases
or setup are not — this library is standalone-only.

## The dev-build workflow

Work in progress never shadows a stable skill. While developing:

1. Edit the skill on the `dev` branch — the branch is the only editable home.
2. `/skill-ops deploy <skill>` installs it as `<skill>-dev` — a separate, explicitly
   invoked skill you can test side by side with the stable version.
3. When it's ready: `/skill-ops promote <skill>` moves it to `main`, updates the
   plugin manifest, README row, and desktop bundle, and removes the `-dev` build.

`/skill-ops status` shows what's deployed, what's stale, and what's ahead of main.

The tooling lives in this repo: [`skill-ops`](skill-ops/README.md) runs the workflow above, and
[`skill-dev-rig`](skill-dev-rig/README.md) sets a repo or a skill up for it. Maintainers and
forkers only; library users never need either.

*(The pattern was born here, was briefly extracted to `chzylee/dev-build`, and has come back. If
you installed that plugin, remove it — its trigger phrases collide with `skill-ops`.)*

## The session-start hook (what you're approving when you clone)

This repo ships one hook in `.claude/settings.json`: at session start, *inside this
repo only*, it runs [`scripts/dev-build-check.sh`](scripts/dev-build-check.sh) — a
short, dependency-free POSIX script that prints a warning if a deployed dev build has
gone stale or orphaned. It reads git state, writes nothing, never blocks, and never
runs outside this repo. Declining it costs you only the warnings.

## Proposing a skill or change

PRs target **`dev`**. A new skill should arrive as a self-contained folder passing
the anatomy rules above, with its README's install section written for someone who
has never installed a skill. It reaches `main` (and the plugin) via the promotion
flow once it's usable cold.

## Running a fork as your own library

1. Fork, then rename two identities: the marketplace name in
   `.claude-plugin/marketplace.json` and the plugin name there and in
   `.claude-plugin/plugin.json`.
2. `/plugin marketplace add <you>/<your-fork>` and install your plugin — push-to-update
   distribution to all your machines from day one.
3. The dev-build workflow, hook, and this guide come with it. Replace the skills with
   your own at whatever pace you like.
