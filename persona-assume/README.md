# persona-assume

Assume a persona from your **Persona Library** — call one of your saved colleagues into the
room. `persona-builder` writes personas; this skill loads them. It resolves your registry,
finds the persona you name, and **adopts its Profile block** — the paste-ready, consumer-agnostic
stance — as the active perspective for the session, or hands that block to a subagent.

The design mirror of the builder: assumption is **explicitly human-invoked** (a persona's
*when-to-assume* is when *you* reach for it, never an auto-match), it loads **only the Profile
block** and leaves the Maintenance section behind the paste boundary, it **asks which mode**
when a persona has modes, and **you stay the judge** — the persona points the perspective, it
never seizes authority.

Together with `persona-builder`, this is the `persona-*` suite: *build* one, then *assume* it.

## Install

**Claude Code (personal):**

```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/persona-assume ~/.claude/skills/persona-assume
```

Windows / PowerShell:

```powershell
git clone https://github.com/chzylee/skill-library.git
Copy-Item -Recurse skill-library/persona-assume "$HOME/.claude/skills/persona-assume"
```

**Claude desktop (one-click):** upload `dist/persona-assume.skill` via
**Settings → Customize → Skills**, or present the file in a claude.ai chat and click
**Save skill**.

**Project-scoped:** copy the folder into a project's `.claude/skills/` instead.

## Requirements

- **A Persona Library to load from** — a registry built by `persona-builder` (or any registry
  whose pages carry a `## Profile block` section), or personas kept as markdown files.
- **Notion MCP connection** — needed to load from a Notion registry. Set
  `PERSONA_LIBRARY_DS_ID` to pin your registry so no link-pasting is needed. If the handle
  isn't set and you don't give a link, the skill **asks** which registry to load from (and
  offers to set the handle) — it never guesses or fails on missing data. File-based personas
  need no Notion connection.

## Invoke

- **"assume the [name] persona"** / **"be my [name]"** / **"load the [name] persona"** /
  **"put on the [name] persona"** — resolves the registry, adopts that persona's Profile block,
  announces the stance in one line, and (if the persona has modes) asks which mode.
- **"assume a persona"** / **"who's on my team?"** — lists your Active personas and asks which
  to assume; never picks for you.
- **"give me the block for a subagent as [name]"** — outputs the Profile block verbatim as a
  system prompt instead of adopting it in this session.
- **"drop the persona"** / **"back to yourself"** / **"assume [other]"** — releases or swaps the
  active stance.
- **`/persona-assume`** — explicit invocation.

## What it loads (and what it won't)

Loads the **Profile block only** — identity, declared bias, directives, cognitive patterns,
grounding, and hard limits — which is exactly what a subagent would receive, so a session load
and a subagent prompt behave the same. It leaves the **Maintenance** section (known flaws,
changelog) behind the paste boundary and never adopts it as behavior. It adopts **canon** (the
current row); it never edits the block at load time — revisions go through `persona-builder`,
which bumps the version.
