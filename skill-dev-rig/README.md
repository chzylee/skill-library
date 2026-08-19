# skill-dev-rig

**Rig one Claude Code skill for further development** — a local browser UI, a config form, and
dev/prod build separation. The three are **independent**: take one, two, or all three, now or
later. Works on a skill you're starting or one you already shipped, and adds only what's missing.

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
```

Three confirmations in the normal case. Say no to a part and it's skipped, and nothing about the
other parts changes. Say no to all three and it tells you nothing needed rigging.

## Install

### Claude Code (personal)

```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/skill-dev-rig ~/.claude/skills/skill-dev-rig
```

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
[`skill-dev-build`](../skill-dev-build/README.md).

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
