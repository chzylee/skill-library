---
name: ratify-configure
description: Configure ratify's telemetry through a local web form — the single handle for turning the decision-record corpus on or off and managing this machine's pseudonymous identity. Launches the config-form engine, then runs the setup tasks you asked for. Trigger on "configure ratify", "ratify telemetry settings", "set up ratify telemetry", "turn ratify telemetry on/off", "reset my ratify identity", or the first-run telemetry notice.
---

# ratify-configure

The configuration handle for `/ratify`'s telemetry. Ratify records one enums-only line per
ratified decision to a local corpus so you can measure your own ownership over time; this skill is
where you turn that on or off and manage the pseudonymous identity that groups your records.

**Division of labor:** the engine (`config-form.mjs`) renders the form and writes the config file.
It has no tools — it can't generate an identity file or check what's already on disk. This skill is
the brain: it computes status, launches the form, and runs the tasks the form hands back.

## Inputs

| Input | What it is |
|---|---|
| **Schema** | `ratify.schema.json` (beside this skill). |
| **Engine** | `config-form.mjs` (vendored beside this skill). |
| **Config file** | `~/.claude/ship-pipeline/config.json` — the file `/ratify` reads at each sitting's open. |
| **Identity file** | `~/.claude/ship-pipeline/install.json` — `install_id`, `install_salt`, `sitting_seq`. |

Resolve `$HOME` at runtime; honor `$SHIP_PIPELINE_DATA_DIR` if set (default `~/.claude/ship-pipeline`).

## The loop

read current values → compute status → launch form → read back → run tasks → report

---

**1. Read current values.**

Load `~/.claude/ship-pipeline/config.json` if it exists → a `{ key: value }` object. Write it to a
temp file `values.json`. If the file is absent, the user has never configured telemetry — pass an
empty object so the form prefills from the schema `default` (`telemetry: "local"`).

---

**2. Compute task status.**

For the one task, `bootstrap-identity`, check whether `~/.claude/ship-pipeline/install.json` exists
and parses with a non-empty `install_id`. Write `status.json`:

```
{ "bootstrap-identity": { "done": <bool>, "detail": "install_id 9f3c…, seq <n>" | "no identity yet" } }
```

`done` is true when the identity file is present and valid — that is the whole check; there is
nothing remote to verify.

---

**3. Launch the form.**

It blocks until the user submits, which is intentional.

```
node config-form.mjs --schema ratify.schema.json --values values.json --status status.json \
  --out ~/.claude/ship-pipeline/config.json --tasks-out tasks.json \
  --title "ratify telemetry" --timeout 900 --lock /tmp/ratify-configure.lock --open
```

Parse `CONFIG_FORM_URL=…` from stdout and show it to the user in case the browser didn't open. On
submit the engine prints `CONFIG_FORM_SAVED out=… tasks=…` and exits 0; on no submit before the
timeout it prints `CONFIG_FORM_TIMEOUT` and exits 3.

If there's no browser or display, fall back to asking the single field (`telemetry`: `local` or
`off`) as a plain question and writing `config.json` yourself in the same `{ key: value }` shape,
then treat `bootstrap-identity` as requested when the chosen mode is `local`.

---

**4. On return, read back.**

Read the freshly written `~/.claude/ship-pipeline/config.json` and `tasks.json` (the ids to run)
before acting in step 5.

---

**5. Run the requested tasks.**

Run `bootstrap-identity` if the user checked it (`tasks.json` contains `"bootstrap-identity"`), or
whenever the chosen `telemetry` is `local` and no valid identity exists yet — a `local` corpus needs
an identity to write. Never touch the corpus (`sends.jsonl`); this task only writes the identity.

**Generate the identity with the OS, never by authoring a string yourself** — model-produced
"random" ids are patterned and collide. Shell out:

```bash
python - <<'PY'
import uuid, json, os, pathlib
d = pathlib.Path(os.path.expanduser(os.environ.get("SHIP_PIPELINE_DATA_DIR", "~/.claude/ship-pipeline")))
d.mkdir(parents=True, exist_ok=True)
p = d / "install.json"
obj = {"install_id": uuid.uuid4().hex[:16], "install_salt": uuid.uuid4().hex, "sitting_seq": 0}
p.write_text(json.dumps(obj))
print(obj["install_id"])
PY
```

- **First run:** creates the file. `sitting_seq` starts at 0; `/ratify` increments it at each
  sitting open.
- **Re-run when the file already exists (a reset / "forget me"):** overwrite with a fresh
  `install_id`, a fresh `install_salt`, and `sitting_seq` reset to 0. This deliberately breaks the
  link to prior records — a new salt re-maps every `project_id`, so old and new records no longer
  group together. That is the intended effect of a reset; say so when you report it.

If `telemetry` is `off`, do not create an identity — there is nothing to record.

Never delete the corpus or the identity file on the user's behalf. A reset overwrites identity; it
does not erase already-written records. To remove local records the user deletes `sends.jsonl`
themselves; to remove any transmitted records (once a backend exists) they supply their
`install_id`.

---

**6. Report the final state.**

State the saved `telemetry` mode, whether an identity was created or reset (and its short
`install_id`), and what recording will now do:

- `local` — "Each ratified decision is now recorded to `~/.claude/ship-pipeline/sends.jsonl` on this
  machine. Nothing is sent anywhere. Run `/ratify` and it accumulates; analyze it any time."
- `off` — "No decisions will be recorded. Existing records, if any, are left untouched."

If `local` was chosen but no identity exists (task not run), flag it: recording can't proceed
without one.

---

## Notes

- `config.json` is the single source of truth `/ratify` reads; this form is just an editor for it.
  Re-running this skill is how you reconfigure — the form always reflects current state, so first
  setup and a later change are the same act.
- The two files are separated on purpose: **consent/behavior** lives in `config.json` (this skill's
  to manage), **identity** lives in `install.json` (data-adjacent, in the shared corpus dir so any
  future ship-pipeline emitter reuses it without a migration).
- Sending tiers are intentionally absent until the remote backend exists. When it ships, add
  `anonymous` and `identified` to the schema's `telemetry` options and a first-send disclosure —
  no change to this skill's mechanics is required.
