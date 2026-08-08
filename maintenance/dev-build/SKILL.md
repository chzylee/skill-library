---
name: dev-build
description: 'Maintainer tooling for the skill-library repo: manage dev builds — the *-dev skills deployed from the dev branch — and promote finished skills to main. Three operations: "/dev-build deploy <skill>" (generate/refresh a dev build into ~/.claude/skills/<skill>-dev), "/dev-build status" (report deployed builds, staleness, orphans, and what is ahead of main), "/dev-build promote <skill>" (per-skill promotion to main: folder + plugin manifest + README row + bundle, then tear down the dev build). Triggers on "dev-build", "deploy a dev build of X", "dev build status", "promote X to main", or /dev-build. Only meaningful inside a checkout of this repo (or a fork).'
---

# dev-build — deploy · status · promote

Maintainer tooling for this repo's dev-build doctrine: a skill under active development
is deployed as a **separate installed skill** named `<skill>-dev`, generated from the
`dev` branch, so dev work can never shadow or break the stable plugin version. Dev
builds are **ephemeral**: deployed on demand while work is active, torn down at
promotion, respun if development resumes.

Two invariants this skill exists to protect:

1. **In git, a skill has ONE name.** The `-dev` suffix and the generation stamps exist
   only in the deployed copy, never in the repo — so promotion is a plain merge of
   content, not a rename.
2. **A deployed build is an artifact, never a workbench.** Edits happen on the `dev`
   branch; the build is regenerated. Never edit `~/.claude/skills/<skill>-dev` directly.

Resolve the repo root as the directory containing this skill's `maintenance/` parent
(or the current project directory when working inside the repo). All git commands run
against that repo. Never force-push. Never touch any other repo.

## `/dev-build deploy <skill>`

Generate or refresh the dev build for one skill.

1. Verify `<skill>/` exists on the `dev` branch (`git cat-file -e dev:<skill>/SKILL.md`).
   Missing → say so and stop; suggest `/dev-build status` for what's available.
2. Read the dev-branch version of the folder (`git show dev:<path>` per file — do NOT
   check branches out; the working tree may be on main with uncommitted work).
3. Write it to `~/.claude/skills/<skill>-dev/` as a **real directory** (no junctions or
   symlinks — they have open Claude Code bugs on Windows). Replace wholesale if it
   already exists.
4. In the copy's `SKILL.md` frontmatter only:
   - `name: <skill>-dev`
   - `disable-model-invocation: true`  (dev builds answer only explicit `/<skill>-dev`
     calls — they must never win auto-routing over the stable version)
   - `generated-from: <full sha of dev HEAD>`
   - `generated-by: dev-build`
5. Report: skill, target path, source sha, and a reminder to restart or open a new
   session so the build loads.

## `/dev-build status`

Read-only. Report three lists:

- **Deployed builds** — every `~/.claude/skills/*-dev` directory whose SKILL.md carries
  `generated-by: dev-build`, with its `generated-from` sha and verdict:
  **current** (skill's files unchanged between that sha and `dev` HEAD — use
  `git diff --quiet <sha> dev -- <skill>/`), **stale** (changed since generation), or
  **orphan** (the skill no longer exists on `dev`, or no longer differs from `main`).
- **Ahead of main** — top-level skill folders that differ between `main` and `dev`
  (`git diff --name-only main dev`), i.e. candidates for a dev build or for promotion.
- **Strays** — `*-dev` directories in `~/.claude/skills/` *without* the
  `generated-by: dev-build` marker: flag them as unmanaged, do not touch them.

## `/dev-build promote <skill>`

Per-skill promotion `dev` → `main`. **Show the full plan and get a yes before step 1.**
This is deliberately NOT a whole-branch merge — promoting one skill must never drag
other unfinished dev skills to main.

1. Working tree must be clean on `main` (stash nothing silently — if dirty, stop and
   say what's in the way).
2. `git checkout dev -- <skill>/` and commit on `main` ("Promote <skill> from dev").
3. Add `"./<skill>"` to the `skills` array in `.claude-plugin/plugin.json`.
4. Draft the README catalog-table row (what it does · who it's for · standalone?) and
   show it for the maintainer's edit before inserting.
5. Build `dist/<skill>.skill` — a zip of the folder (`python` + `zipfile`; set
   `PYTHONUTF8=1` on Windows). Skip with a note if the skill installs hooks (bundles
   are for desktop, which can't run hook installs).
6. `claude plugin validate .` — must pass before pushing.
7. Commit the manifest/README/bundle changes and push `main`.
8. **Tear down the dev build**: delete `~/.claude/skills/<skill>-dev/`. Note that other
   machines tear theirs down on their next status check (it will show as an orphan).
9. Report every step taken, and remind: the Skill Index row still needs its update
   (skill-forge/sync owns the catalog, not this skill).

## Notes

- The SessionStart hook (`scripts/dev-build-check.sh`, wired in this repo's
  `.claude/settings.json`) is the automatic-awareness half: it prints stale/orphan
  warnings at session start, only inside this repo. This skill is the acting half.
- Deployment is **deliberate, per skill** — never auto-deploy everything that's ahead
  of main; ambient context stays near zero.
- Forks inherit all of this: the pattern works unchanged on a fork — rename the
  marketplace/plugin entries and the library plus its maintenance rig is yours.
