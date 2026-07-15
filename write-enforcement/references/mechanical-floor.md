# Mechanical floor — the checkable subset of the Writing Standard

> This is the small, mechanically-checkable subset of the full Writing Standard that the
> write-time hook screens for. It is **not** the whole Standard — most of the Standard is
> judgment (voice, structure, cite-or-flag) that a lint can't score. The hook re-surfaces
> the full reminder (below) on every write, and flags only the four screenable violations.
> Advisory by default: a flag is a nudge, not a verdict.

## The reminder (surfaced on every guarded write)

The hook prints this verbatim so the rules are back in front of Claude at the moment a page
is written, not just carried in fading context:

> **How to write (Writing Standard, short form):** Open with an overview so the reader
> grasps the page in one glance. Prefer structure — tables, tiers, collapsible sections —
> over walls of prose. Cite-or-flag every factual claim (link a primary source, or mark it
> unverified); label interpretation as interpretation. Write in a teammate-engineer voice:
> no insider jargon or coined labels without their referent — if you must coin a term, gloss
> it. Describe current state only; change-history goes to a Changelog, never inline. Default
> documentation pages to collapsible sections. Run the humanizer norm.

Keep this text in sync with the canonical Writing Standard. It is a derived pointer; if it
drifts from the Standard, the Standard wins.

## The four screened checks

Each check is deliberately conservative — it flags a *likely* violation for a human/Claude to
judge, and is tuned to avoid false alarms on legitimate content. All matching is
case-insensitive unless noted.

### 1. Mode declaration present
A deliverable Notion page should open by naming its **mode** (its read/write contract) in a
callout. Look, in roughly the first ~1200 characters of the content, for either:

- a literal `**Mode:` label, **or**
- a `> ` callout opener whose text names one of the five modes:
  **Reference**, **Living documentation** (or "Living doc"), **Operational surface** (or
  "Operational"), **Standard** (or "Contract"), **Log** (or "Archive").

If neither is found near the top, flag: *"No mode declaration found near the top — open with a
callout naming the page's mode (Reference / Living doc / Operational / Standard / Log)."*

### 2. Collapsible headers on long documentation
Documentation pages default to collapsible sections (`<details><summary>…</summary>`). Heuristic:
count `##`-level headings (markdown lines beginning with `##`). If there are **4 or more**
headings and **zero** `<details>` tags in the content, flag: *"Long page (N headings) with no
collapsible sections — wrap sections in `<details><summary>` so the outline reads without
noise. Keep the overview and a worked example visible."*

Short pages (fewer than 4 headings) are exempt — collapsing is overhead there.

### 3. Banned jargon (coined labels without a referent)
Flag any occurrence of a coined label used without glossing its referent. Starter list
(extended as new offenders appear — append to `$BANNED` in the hook, or to this list):

- `carve-out`
- `gap-read`
- `cohort` — only when used as a coinage/shorthand, not the ordinary noun. The hook flags any
  occurrence conservatively; treat a hit as "confirm this reads for a teammate, or gloss it."

For each hit, flag: *"Possible coined jargon 'X' — name its referent or use a descriptive term
(self-describing-names rule)."* This list is a floor, not a ceiling; add offenders as they
surface so the check compounds.

### 4. No inline change-notes (current-state-only)
Deliverables describe current state; change-history belongs in a Changelog subpage, never
inline. Flag inline history patterns (case-insensitive regex):

- `changed on <date>` / `changed on` followed by a date-like token
- `updated after …`
- `(was: …)` — a parenthetical naming a prior value
- `previously,` / `used to be` as a lead-in narrating a change

For each hit, flag: *"Inline change-note 'X' — deliverables are current-state only; move
history to a Changelog."*

## Design notes

- **Conservative by intent.** Each pattern is chosen to minimize false positives; a flagged
  item is a prompt to look, not an assertion of failure. This is why the default mode is
  advisory (below).
- **Advisory vs. strict.** Default: surface the reminder + flags and let the write proceed. The
  hook uses the documented non-blocking PreToolUse channel — JSON on stdout with
  `permissionDecision: "defer"` and `additionalContext` — so Claude *sees* the message while the
  write still goes through (plain stderr on exit 0 would not reach Claude; it is mirrored there
  only for the user's transcript). A broken gate that blocks writes would disrupt every session,
  so the floor never hard-blocks unless the operator opts into strict mode (`deny`, documented in
  the hook and SKILL.md).
- **Target-agnostic.** The checks screen page *content* (markdown), independent of which write
  tool delivered it. Retargeting the hook to Obsidian/Confluence changes only the matcher, not
  these checks.
