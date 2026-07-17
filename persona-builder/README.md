# persona-builder

Build a new persona for your **Persona Library** — or finish/revise an existing one — through
a hiring-interview dialogue. You describe the person you want to work with; the skill
interviews you (bias with its cost named, directives as trigger → needs-to-know →
how-to-find-out, optional modes), then writes a schema-v1 persona whose page body is a
**paste-ready, consumer-agnostic profile block**: usable unchanged as a skill launch persona,
a mid-session load, or a subagent system prompt. It plugs into your setup instead of imposing
one — connect a Notion registry by link, let it create one, or just get a markdown file.

The design is research-grounded: personas are **stance and mentality selectors — thinking
frameworks — not knowledge-amplifiers**. A persona built here stores no static factual claims,
but very much stores *how to get facts*: its directives are the procedure for resolving
ambiguity. The AI proposes and writes; **you rule** — the last step is a sign-off gate showing
the exact row (every property, the full profile block) before anything is created.

## Install

**Claude Code (personal):**

```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/persona-builder ~/.claude/skills/persona-builder
```

Windows / PowerShell:

```powershell
git clone https://github.com/chzylee/skill-library.git
Copy-Item -Recurse skill-library/persona-builder "$HOME/.claude/skills/persona-builder"
```

**Claude desktop (one-click):** upload `dist/persona-builder.skill` via
**Settings → Customize → Skills**, or present the file in a claude.ai chat and click
**Save skill**.

**Project-scoped:** copy the folder into a project's `.claude/skills/` instead.

## Requirements

- **Notion MCP connection — optional.** With it, connect your persona registry by link (or
  set `PERSONA_LIBRARY_DS_ID` to pin it), or let the skill create a fresh registry from the
  bundled v1 schema. Without it — or if you simply don't keep a registry — the finished
  persona is written to a markdown file wherever you want it: a valid destination, not a
  degraded mode.

## Invoke

- **"build a persona"** / **"new persona"** / **"hire a persona"** — full interview →
  sign-off gate → the persona is created (Active on approval; Draft only if you park it).
- **Pick a rigor at launch** — three hiring-rigor modes: **Quick hire** (you opt into AI
  proposals; accept or tweak) · **Standard interview** (default — elicits each column,
  challenges the bias's cost once) · **Executive search** (pushes toward a narrow, specific
  fit and stress-tests directives; conflicts named firmly, with reasons). Sovereignty is
  yours in every mode — the skill never refuses to proceed and never overrules.
- **"finish the [name] persona"** / **"revise the [name] persona"** — the same full walk,
  prefilled: wherever a value is already stored, you approve or update it. Content changes
  bump the version (release semantics — copies baked into shared skills are snapshots and
  owe canon nothing).
- **`/persona-builder`** — explicit invocation.

## The schema it enforces (v1)

Required spine: **name · when-to-assume · declared bias · ≥1 directive** — anything less is an
"act as X" prompt and the skill won't write it (at Quick hire it proposes the missing pieces
for your approval instead). No numeric bias weights (tie-break directives instead). Modes are
named selections over the persona's own directive/pattern pool (same-person test decides mode
vs. new persona). Assumption is always explicitly human-invoked — the skill never writes
auto-matching triggers. Known flaws carry provenance: *(predicted — not yet observed)* vs.
*(observed, date)*.
