# skill-ops

**Work on a skill without breaking the copy you use every day.** A skill under development deploys
as a *separate* installed skill named `<skill>-dev`, generated from your repo's dev branch, so it
can never shadow the stable version. When it's ready, promote it and the dev build is torn down.

```
/skill-ops deploy my-skill
/skill-ops status
/skill-ops promote my-skill
```

**What "ops" covers here:** the dev-build lifecycle and nothing else — deploy, status, promote. It
does not install skills, update them, or delete them. Installing is
`npx github:chzylee/skill-library#skill-dev-rig <skill>`; setting a repo or skill up is
[`skill-dev-rig`](../skill-dev-rig/README.md).

## Install

### Claude Code (personal)

```bash
npx github:chzylee/skill-library#skill-dev-rig skill-ops
```

The `#skill-dev-rig` suffix is the branch; it drops away once this is promoted to `main`.

**Manual install** (fallback — if you would rather not run `npx` against a repo you have not read):

```bash
git clone --branch skill-dev-rig https://github.com/chzylee/skill-library.git
cp -r skill-library/skill-ops ~/.claude/skills/skill-ops
```

Both paths do the same thing: copy the folder to `~/.claude/skills/skill-ops`. Restart Claude Code,
or open a new session, to load it.

## What it does

**`deploy <skill>`** generates `~/.claude/skills/<skill>-dev` from the dev branch, marked
`disable-model-invocation` so it only ever answers an explicit `/<skill>-dev` call and never wins
auto-routing against the stable version.

**`status`** reports what's deployed and whether it's current, stale, or an orphan; what's ahead of
stable and therefore a promotion candidate; and any `*-dev` directories it doesn't manage.

**`promote <skill>`** moves one skill to the stable branch and runs your repo's release steps, then
deletes the dev build. Deliberately per-skill — promoting one thing never drags other unfinished
work along with it.

Two invariants it exists to protect: in git a skill has **one name** (the `-dev` suffix exists only
in the deployed copy, so promotion is a plain merge of content), and a deployed build is an
**artifact, never a workbench** (edit on the dev branch and regenerate).

**Setting a repo up for this is [`skill-dev-rig`](../skill-dev-rig/README.md)**, where it's one of
the parts you can opt into. This skill operates on a repo that's already rigged — all three verbs
refuse politely if `.dev-build.conf` is missing from the repo root, and point you there.

If you installed only this skill, you don't have it yet:

```bash
npx github:chzylee/skill-library#skill-dev-rig skill-dev-rig
```

## Status

On the `skill-dev-rig` branch, not yet promoted to `main` — and never on `dev`. That is why every
install command here carries the `#skill-dev-rig` fragment, which pins npx to this branch. Once
promoted, drop it:

```bash
npx github:chzylee/skill-library skill-ops
```

## License

MIT — see [LICENSE](../LICENSE).
