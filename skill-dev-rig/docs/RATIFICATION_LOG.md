# RATIFICATION_LOG.md

## Architecture — ruled 2026-07-18 (with Noah)

config-form's design was decided in the recording-standard configuration thread: a generic,
domain-agnostic engine that only renders the form and collects values + requested tasks, with
the consuming skill running the privileged actions; vendor-one-file distribution; JSON output at
a skill-chosen path; a stdout-marker handshake; and a small fixed field-type set. It generalizes
the configuration need surfaced by recording-standard into a reusable harness.

Trail: `docs/decision_log.md` (dec. #1–#6); the recording-standard build that surfaced the need.

Not a code ratification yet — the first `/ratify` sitting comes after recording-standard consumes
it (build_status next-action #1), which is also the reuse test: did the engine need any change to
serve a second, real schema?
