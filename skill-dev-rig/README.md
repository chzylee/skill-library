# skill-dev-rig

**Rig one Claude Code skill for further development** — a local browser UI, a config form,
dev/prod build separation, and a one-line npx installer. The four are **independent**: take one,
or all four, now or later. Works on a skill you're starting or one you already shipped, and adds only what's missing.

```
/skill-dev-rig
rig this skill for development
add a UI to my skill
give this skill a config form
```

It reads your skill first, so every question arrives already answered:

```
Rigging: my-skill

  1. Local browser UI?      [yes — it writes to ~/.claude/… and the user should see it first]
  2. Config form?           [no  — no user-editable settings found]
  3. Dev/prod separation?   [yes — .dev-build.conf not present]
  4. npx installer?         [yes — README currently says git clone + cp -r]
```

Four confirmations in the normal case. Say no to a part and it's skipped, and nothing about the
other parts changes. Say no to all three and it tells you nothing needed rigging.

## Install

### Claude Code (personal)

```bash
npx github:chzylee/skill-library#skill-dev-rig skill-dev-rig
```

Or list what the repo offers with `npx github:chzylee/skill-library#skill-dev-rig --list`. The
`#skill-dev-rig` suffix is the branch; it drops away once this is promoted to `main`.

## What it does

**Local browser UI.** Vendors `local-ui.mjs` into your skill and writes the consumer script. The
engine owns the parts that are easy to get subtly wrong: loopback-only bind, a Host check that
closes DNS rebinding, a per-run token on every route, tab-close detection with the watchdog armed
only after the first ping, and one serialized shutdown so a session that ends three different ways
still reports exactly once. Your skill keeps its own domain logic and routes.

Two follow-ups pick the shape — *does the page write?* and *must the agent know when the tab
closed?* — giving you a static no-server build, a read-only viewer, a submit-once form, or a full
working session.

**Config form.** Vendors `config-form.mjs`, scaffolds a `*.schema.json`, and drops in a `configure`
verb so your skill's settings are a web form instead of a hand-edited file.

**Dev/prod separation.** Sets the repo up so work-in-progress deploys as a separate `<skill>-dev`
build that can never shadow the stable one. Day-to-day operations after that are
[`skill-ops`](../skill-ops/README.md).

**npx installer.** Scaffolds `install.mjs` and a `bin` entry so a stranger installs your skill with
one line instead of cloning a repo and copying a folder by hand. Nothing is published to npm — npx
runs it straight from the git host. It takes any folder containing a `SKILL.md`, so it needs no
per-skill registration, and it reads `skills_root` from `.dev-build.conf` when present.

Dev/prod and the installer are **per-repo**; the UI and config form are **per-skill**. Rigging a
second skill in the same repo skips the per-repo parts.

**And it writes your skill's SKILL.md run section**, from a fixed template — the markers, the
instruction to read the summary back, and the blocking-Bash ceiling (a blocking call dies at about
10 minutes, so `--timeout 540` with a Bash timeout of `600000`, or background it). That guidance
was hard-won in one skill; every rigged skill now gets it by default.

The contract the engine implements is documented in [`UI-CONTRACT.md`](UI-CONTRACT.md); the config
schema is [`SCHEMA.md`](SCHEMA.md).

## Tests

```bash
cd skill-dev-rig && node --test
```

32 tests against three fixture consumers, covering the marker contract, the security posture, and
the shutdown races.

## Status

On the `dev` branch, not yet promoted to `main`. Fetch with `--branch dev`.

## License

MIT — see [LICENSE](../LICENSE).
