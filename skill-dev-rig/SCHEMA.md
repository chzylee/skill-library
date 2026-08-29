# The config-form schema — the contract

This is the stable interface between a **consuming skill** and the generic engine
(`config-form.mjs`). Get this right and the engine renders any config without changes; a new
skill set just writes a schema. Everything here is plain JSON.

## Top level

```json
{
  "title": "my-skill",
  "configPath": "~/.claude/my-skill.local.json",
  "groups": [ ... ]
}
```

- **title** — shown at the top of the form.
- **configPath** — where the values are meant to live (advisory; the engine writes to whatever
  `--out` it's given, so the skill controls the real path). Document it here so the schema is
  self-describing.
- **groups** — the form's sections, rendered in order.

## Group

```json
{ "name": "Locations", "help": "Where things live.", "settings": [ ... ], "tasks": [ ... ] }
```

Each group renders as a titled section: its **settings** (fields to fill) then its **tasks**
(setup steps with a status). Either array may be empty or omitted.

## Setting (a value to store)

```json
{ "key": "registry_url", "label": "Registry URL", "type": "url",
  "required": true, "default": null, "help": "..." }
```

- **key** — the config key the value is written under. Must be unique across the whole schema.
- **type** — one of the fixed set below. Keep to these; a small fixed set is what makes the
  engine universal.
- **required / default / help** — optional. `default` prefills when there's no current value.

### Field types

| type | renders | value written |
|---|---|---|
| `text` | text input | string |
| `url` | url input | string |
| `number` | number input | number (or null if blank) |
| `select` | dropdown (needs `options: [...]`) | string |
| `toggle` | checkbox (optional `on` label) | boolean |
| `secret` | password input | string |
| `textarea` | multi-line text area | string |
| `table` | editable rows (needs `columns: [{key,label,type}]`) | array of row objects |

## Task (a setup step with a status)

```json
{ "id": "create-audit-results", "label": "Audit results page created",
  "help": "...", "optional": false, "provides": "audit_results_home" }
```

`provides` names a **setting key this task would fill in**, and it is load-bearing rather than
decorative. When it names a setting that is visible in the same group, the engine renders the task
inline directly under that field, so "paste a link you already have" and "create one for me" sit
together as one choice. It also drives two behaviors you get for free: once the field has a value
the checkbox relabels from *set up now* to *create a new one instead*, and field and checkbox
become mutually exclusive — filling one greys the other, so the user cannot ask for both. A task
whose `provides` names no visible field still renders, at the bottom of its group. Omit `provides`
for a task that fills in nothing (registering a cron job, installing a hook).

The engine **does not run tasks** — it renders each task's status and a "set up now" checkbox,
and on submit reports which tasks the user checked. The **consuming skill runs them**, because
they need tools (create a page, register cron) the browser process doesn't have. That division
is the whole design: engine = form + values; skill = task execution.

## What the skill passes IN

- `--schema <path>` (required) — this schema.
- `--values <path>` — current values, `{ key: value }`, to prefill. Optional.
- `--status <path>` — task statuses, `{ taskId: { "done": true, "detail": "..." } }`. Optional;
  the skill computes these with its tools before launching.
- `--out <path>` (required) — where the engine writes the merged values (JSON).
- `--tasks-out <path>` — where the engine writes the requested task ids (JSON array).
- `--result <path>` — where the engine writes the JSON run record (reason, exit code, timestamps,
  summary data). Optional; the engine picks a temp path and always prints `CONFIG_FORM_RESULT=`
  either way, so a backgrounded run always has somewhere to leave its answer.
- `--title`, `--port` (0 = ephemeral), `--timeout` (seconds), `--open` (auto-open browser).

## What the skill reads OUT

- The **config file** at `--out`: the merged `{ key: value }` JSON. Every consuming skill reads
  this same file.
- The **tasks file** at `--tasks-out`: `["taskId", ...]` — what to run now.
- **stdout markers** (parse these; the local-ui engine prints them):
  - `CONFIG_FORM_URL=<url>` — printed when listening; show it to the user.
  - `CONFIG_FORM_RESULT=<path>` — the JSON run record (reason, exit code, summary data).
  - `CONFIG_FORM_SUMMARY … CONFIG_FORM_DONE` — printed after submit, then exit 0. The
    legacy `CONFIG_FORM_SAVED out=<p> tasks=<p>` line is kept inside the fence.
  - `CONFIG_FORM_TIMEOUT` — no submit before `--timeout` (default 540); exits 3.
  - `CONFIG_FORM_ERROR <msg>` — bad args or unreadable schema; exits 2.
  - `CONFIG_FORM_WARN <msg>` — an existing `--values` or `--status` file could not be
    parsed, so the form rendered from defaults. **Relay this one to the user before
    they submit.** Saving writes only what the form carries, so any key that lived in
    the unreadable file is about to be dropped — this warning is the only notice
    anyone gets, and it prints at launch rather than at exit.

## The flow, one line

Skill computes values + status → runs the engine (blocks until submit) → reads the config +
requested tasks → executes the tasks with its tools → writes any resulting values back → done.
