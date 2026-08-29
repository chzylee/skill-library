# config-form — decision log

Every fork and why. Ruled 2026-07-18 with Noah, in the recording-standard configuration thread.

dec. #1 — Standalone reusable repo. config-form is the generic configuration mechanism, built to
  be reused across skills and repos, not embedded in any one. First consumer: recording-standard.

dec. #2 — The engine is domain-agnostic; the consuming skill runs the tasks. A browser + local
  server can write a file but cannot use Claude Code tools (Notion, cron). So the engine only
  renders the form and collects values + requested task ids; anything privileged is executed by
  the skill afterward. This is the architectural line that keeps the engine universal — if the
  engine ever needs to know a domain, the seam has leaked.

dec. #3 — Distribution: vendor one dependency-free file. `config-form.mjs` uses node stdlib only,
  so a consumer copies the single file and stays self-contained and forkable. Drift is the cost,
  mitigated by it being one file; a shared clone-and-reference is the alternative for easier
  updates. Not shipped as an installed plugin (its skill is a copy-me template).

dec. #4 — Output is JSON at a skill-chosen path. The engine writes `{ key: value }` JSON to
  `--out` and never assumes the path or shape beyond that. Typed and parseable; every consuming
  skill reads the same file.

dec. #5 — Skill<->engine handshake via stdout markers + foreground blocking. The skill runs the
  engine in the foreground; it blocks until submit (or timeout), printing `CONFIG_FORM_URL` /
  `CONFIG_FORM_SAVED` / `CONFIG_FORM_TIMEOUT`. Simpler and more robust than a background poll.

dec. #6 — Fixed, small field-type set (text / url / number / select / toggle / secret / textarea / table).
  Universality comes from constraint: a small set covers almost all config and keeps the engine
  simple. Custom widgets are intentionally out of scope.
