---
name: skill-dev-rig
description: 'Rig ONE Claude Code skill for further development — new or existing — with any combination of four parts: a local browser UI, a config form, dev/prod build separation, and an npx-callable installer. Each part is independently opt-in. Looks at the skill first, then asks one yes/no question per part with a recommended answer and a reason, so the common case is four confirmations; answering no to a part skips it entirely. Vendors the local-ui engine (and the config-form engine if asked), scaffolds the schema, wires the repo for dev/prod, scaffolds a one-line npx installer, and writes the consuming skill''s SKILL.md run section from a fixed template so the markers, the summary read-back, and the blocking-Bash ceiling are correct without editing. Triggers on "/skill-dev-rig", "rig this skill", "rig <skill> for development", "add a UI to my skill", "give this skill a config form", "set up a local UI for X", "set this skill up for development". Rigging only — ongoing dev-build operations (deploy, status, promote) are /skill-ops.'
---

# /skill-dev-rig — rig a skill for further development

Sets one skill up so it can be developed further: a local browser UI, a config
form, dev/prod build separation, and an npx-callable installer. **The four are
independent.** Rig one, or all four, now or later.

Two are **per-skill** (UI, config form) and two are **per-repo** (dev/prod, the
installer). A per-repo part is done once for the whole repo, so rigging a second
skill there skips it. Running this again to add a part you skipped
is normal and expected — that is what "for further development" means.

Works on a **new skill or an existing one**. On an existing skill it adds only
what is missing and never rewrites what is already there.

The engine (`local-ui.mjs`) and its contract (`UI-CONTRACT.md`) sit beside this
file. **Read `UI-CONTRACT.md` before answering questions from memory.**

**Scope:** one skill per run, in the current repo. `<skill>` below is the
skill's directory; the **marker name** is the skill's name upper-snake-cased
(`my-skill` → `MY_SKILL`). Never use any other string for markers — marker
prefixes derive from the consuming skill's name, nothing else.

**This skill does rigging only.** `deploy`, `status` and `promote` are
`/skill-ops`.

---

## Step 1 — Look at the skill before asking anything

Read the skill's `SKILL.md` and list its directory. The point is that every
question in step 2 arrives already answered, with a reason. Three
confirmations should be the normal path; the interview exists for the cases
where you are wrong.

Look for, per part:

| Part | Already rigged if… | Recommend YES when… |
|---|---|---|
| **UI** | `<skill>/ui/` exists with a vendored `local-ui.mjs` | the skill shows the user something (a viewer, a page, a report), or edits records a human should see before they change |
| **Config form** | `<skill>/<skill>.schema.json` exists | the skill reads user-editable settings — paths, tokens, toggles, a store location — especially if its SKILL.md tells the user to hand-edit a file |
| **Dev/prod** | `.dev-build.conf` exists at the repo root | it does not exist |
| **npx installer** | `install.mjs` + a `bin` entry in the repo's `package.json` | the repo is on a public git host and a stranger would otherwise be told to clone it and copy a folder by hand |

If you cannot tell from the files, say so in the question rather than guessing
confidently. "I can't tell — does it?" is a better question than a wrong
recommendation.

## Step 2 — One question per part

Ask all three at once, each with its recommendation and a one-line reason:

```
Rigging: <skill>

  1. Local browser UI?      [yes — it writes to ~/.claude/… and the user should see it first]
  2. Config form?           [no  — no user-editable settings found]
  3. Dev/prod separation?   [yes — .dev-build.conf not present]
  4. npx installer?         [yes — README currently says git clone + cp -r]
```

- **Any part already rigged** → say so and offer to refresh it rather than
  asking as though it were new.
- **All four no** → report that nothing needed rigging, and stop. This is a
  legitimate outcome, not a failure.
- **Never bundle.** A no to one part changes nothing about the others.

### Only if UI = yes: two follow-ups

Also pre-answered from step 1. These pick the shape; nothing else does.

1. **Does the page need to write anything?** A `file://` page cannot write to
   disk, so a writer can never take the static branch.
2. **Does the agent need to know when the tab closed?** Sets `enders.close`.
   A watched page must be served even when read-only — there is no way to
   watch a `file://` tab.

The two answers pick the shape:

| Writes? | Watch close? | Shape |
|---|---|---|
| No | No | **Static** — one self-contained HTML inlining CSS/JS/data, opened via `file://`. No server, no engine. |
| No | Yes | Served, read-only. `viewer` preset. |
| Yes | No | Served, read/write. `oneshot` preset. |
| Yes | Yes | Served, read/write. `watch` preset. |

```js
const watch   = { done: true,  close: true,  clock: 540 };  // working session
const oneshot = { done: true,  close: false, clock: 540 };  // submit-once form
const viewer  = { done: false, close: true,  clock: 540 };  // read-only view
```

Leave `clock` unset unless asked: the engine defaults to 540 so the
blocking-Bash ceiling holds even for a consumer that reads no docs.

## Step 3 — Do only what was said yes to

### UI (served)

Scaffold `<skill>/ui/`, vendor `local-ui.mjs` into it keeping the version-stamp
header intact, and write the consumer script with the ender set above. If
read/write: token-gated routes under `/api/...`, the **server owns every
write** (the browser only sends intent), and deletion is **trash-not-delete** —
move to a `.trash/` folder, never unlink.

### UI (static)

Write a build script that inlines CSS, JS and data into one HTML file and opens
it via `file://`. No engine, no server, no markers. Say plainly that the agent
will not know when the user is done.

### Config form

1. Vendor `config-form.mjs` **and** `local-ui.mjs` into the same directory
   (`config-form.mjs` imports `./local-ui.mjs`).
2. Scaffold `<skill>/<skill>.schema.json` from the shape in `SCHEMA.md`
   (groups → settings + tasks). Start minimal: the settings the skill actually
   reads today, not the ones it might.
3. Copy `templates/configure.SKILL.md` in as the skill's configure verb and
   fill its two ‹ADAPT› sections (how to compute task status, how to run tasks).

### Dev/prod

Run the dev/prod setup using the templates in `templates/`
(`dev-build.conf.template`, `dev-build-check.sh`, `settings.snippet.json`):
write `.dev-build.conf` at the repo root, copy the check script to
`scripts/dev-build-check.sh`, merge the SessionStart entry into
`.claude/settings.json`, and create the dev branch. Ongoing operations on a
rigged repo are `/skill-ops`.
**Idempotent:** if `.dev-build.conf` already exists the repo is rigged — say so
and move on, never re-write it. This is per-repo, so rigging a second skill in
the same repo skips it.

### npx installer

Copy `templates/install.mjs` to the **repo root** and add a `bin` entry pointing
at it in the repo's `package.json` (create the file if absent; `"type":
"module"` is required). Nothing is published to npm — `npx github:<owner>/<repo>
<skill>` runs it straight from the git host.

**Per-repo and skill-agnostic.** It takes any folder that contains a `SKILL.md`,
so it needs no per-skill registration and rigging another skill later does not
touch it. It reads `skills_root` from `.dev-build.conf` when that file exists
and falls back to the repo root when it does not, so it works on a repo that was
never rigged for dev/prod.

Already present → say so and move on; never re-write it.

Tell the maintainer the command their users will run, with the branch ref if the
installer has not reached the default branch yet:

    npx github:<owner>/<repo> <skill>
    npx github:<owner>/<repo> --list

## Write the skill's SKILL.md run section — from this template, verbatim

Only when a **served** UI was rigged. Append (or create) the run section of the
**consuming skill's** SKILL.md from the template below. Substitute exactly two
things: `<NAME>` (the marker name) and the launch command line. Do not restyle
it; every sentence is load-bearing and the wording has been tested to survive
an agent reading it cold.

```markdown
## Run it

    node "<skill-dir>/ui/<consumer>.mjs" --open

Run it from Bash and let the call block — the subprocess staying open is how
the session waits for the human.

Mind the harness ceiling: a blocking Bash call tops out around 10 minutes, so
keep the default --timeout 540 and set the Bash tool timeout to 600000. If the
user needs longer, run it in the background with a longer --timeout and poll
the <NAME>_RESULT file to learn how it ended.

It prints markers to stdout:

| Marker | Meaning |
|---|---|
| `<NAME>_URL=<url>` | server listening; browser opened |
| `<NAME>_RESULT=<path>` | JSON run record (reason, exit code, summary data) |
| `<NAME>_SUMMARY` … `<NAME>_DONE` | the user finished; summary of what happened |
| `<NAME>_CLOSED` | the user closed the tab; summary follows; exit 0 |
| `<NAME>_TIMEOUT` | nobody finished in time; exit 3 |
| `<NAME>_ERROR <msg>` | precondition failed; exit 2 |

**When it exits, read the summary block and report it to the user.** Anything
loaded into your context before the session is stale the moment the user edits
through the page, and the summary is your only account of what changed.
```

## Report

End by reporting: which of the four parts were rigged and which were skipped,
every file written, the ender set chosen and why, the marker name, the exact
npx command if the installer was added, and — if the repo was newly rigged for
dev/prod — the note that cloners get one approval prompt for the SessionStart
hook.

Then say what is still unrigged and that re-running adds it, so the skipped
parts read as deferred rather than decided.
