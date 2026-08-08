---
name: skill-forge
description: Use this whenever the user wants to create, forge, generate, draft, or "turn this into" a new Claude skill. From one request it produces the skill, documents it in the user's Notion (a Skill Library page in their house style plus a Skill Index catalog row), and delivers it to wherever they're working — in a claude.ai chat it presents the skill as a saveable artifact so the user can one-click "Save skill" into Claude desktop; in Claude Code it writes the canonical file into the repo. Trigger on "make me a skill", "forge a skill", "create a skill that...", "new skill for...", "turn this workflow into a skill", or any time the user describes a repeatable workflow they want captured. Always use this instead of hand-writing a SKILL.md.
---

# Skill Forge

One request, one skill, delivered to every place it belongs. This skill is
surface-aware: it does the right thing whether it runs in a claude.ai chat or in
Claude Code.

## First: detect the surface

- **Chat path** — you can create/present files as artifacts and the user installs
  skills by clicking **"Save skill"** on a presented SKILL.md artifact. Use this in
  claude.ai / Claude desktop chats. This is the low-click path to Claude desktop.
- **Code path** — you're in Claude Code with this repo's `.claude/skills/` on disk.
  Use this to write canonical files for version control.

If both are possible, ask the user which they want; if only one is possible, use it.

## Steps 1-2 are the same on both paths

### Step 1 — Capture intent
Pin down what the skill does, when it triggers (the user phrasings/contexts), what it
produces, and the target surface. Pull from the conversation first; only ask about real
gaps. If told "just make it," proceed and state assumptions.

### Step 1.5 — Set the rigor: basic vs. thorough
Decide how much the skill should **interrogate before it acts** — this shapes its whole
structure. If it's unclear which fits, ask the user.
- **Basic (task-executor)** — does a well-scoped task in one pass, accepting optional
  extra input to refine. Minimal questions; just do the job cleanly. *(e.g. `humanizer`:
  it humanizes the text in front of it, taking extra direction only if offered.)*
- **Thorough (reasoned)** — the result's quality depends on getting context right, so the
  skill is built to **ask forcing questions, reason, and converse** before producing its
  deliverable. *(e.g. gstack's `office-hours`: a real back-and-forth that yields a
  thoughtful design doc.)*

Pick the **lightest rigor that still reliably produces a quality result** — don't make a
basic task conversational, and don't let a high-stakes task fire on one guess. This is the
gstack skill contract: a thorough skill *gathers what it needs to see the task through in
full quality*; a basic skill just executes well.

### Step 2 — Draft
Produce together:
- **The SKILL.md.** Conventions: `name` kebab-case (≤64 chars, no `claude`/`anthropic`);
  `description` is the trigger — slightly pushy, ≤1024 chars, **no angle brackets**, and
  if it contains a bare `: ` wrap the whole value in single quotes so the YAML parses;
  frontmatter keys limited to `name`, `description`, optional `compatibility`/`license`/
  `metadata`/`allowed-tools`; body imperative, explains *why*, under ~500 lines.
- **The Notion doc fields:** Purpose (one sentence), Trigger (` · `-separated phrases),
  Surface (Claude chat / Claude Code / Both — default Both), Writes to (Work Log / Work Items /
  Work Streams / Core Context / Leverage Board / Efforts / Nothing (read-only)), Tools used (Notion /
  recent_chats / vision / web_search), How to invoke (2-4 bullets).

**Match the structure to the rigor (Step 1.5):** *basic* → a tight imperative procedure that
executes cleanly; *thorough* → an explicit **"ask what you need" / forcing-question phase** up
front, then reasoning, then the deliverable.

Show the user the proposed `name` + `description` and a short summary; confirm before building.

## Step 3 — Deliver the skill (path-specific)

### Chat path → present a saveable "Save skill" artifact
1. Create a skill folder with `SKILL.md` (and any `scripts/`, `references/`, `assets/`).
2. Package it: run the bundled packager to validate and zip:
   `python scripts/package_skill.py <skill-folder> <output-dir>` (this skill bundles
   `scripts/package_skill.py`; use its path).
3. **Present the resulting `.skill`** so it renders as a skill artifact in chat. The
   interface shows a **"Save skill"** button — tell the user to click it to add the skill
   to their Personal skills (it then appears in both Claude desktop and web).
   If packaging isn't available, present the `SKILL.md` itself — the Save skill button
   attaches to a presented SKILL.md skill artifact.

### Code path → write the repo file + a desktop bundle
1. Write `.claude/skills/<name>/SKILL.md` (live in Claude Code immediately).
2. Build `dist/<name>.skill` with `scripts/package_skill.py` for when the user wants it
   in Claude desktop. Note: the one-click "Save skill" button only appears in a chat, so
   to get this skill into desktop with one click, present its `.skill` in a claude.ai
   chat; otherwise upload it via Settings → Customize → Skills.

## Step 4 — Document in Notion (both paths)

Resolve targets by **searching Notion by name** (no hardcoded IDs, so nothing sensitive
lives in committed files): find the **Skill Library** page and the **🛠 Skill Index**
database. (In Claude Code with `.env` present, `NOTION_SKILL_LIBRARY_PAGE_ID` /
`NOTION_SKILL_INDEX_DS_ID` may override the search.) Then, idempotently (search first,
update if present, else create):

**4a. Skill Library child page** under the Skill Library page, with a fitting emoji icon,
in the house style:
```
**Purpose:** <purpose>
**Trigger:** <phrase> · <phrase>
**Surface:** <surface> · **Writes to:** <writes-to>
## How to invoke
- **"<what the user says>"** — <what happens>.
## SKILL.md
```
(then the complete SKILL.md verbatim in a fenced code block)

**4b. 🛠 Skill Index row** keyed by Skill name: set Skill name, Definition, Purpose,
Trigger, Status = Active, Surface, Tools used, Writes to (use existing select options).

## Step 5 — Hand off

- Chat path: confirm the user clicked **Save skill**, give the Notion page link, and paste
  the final `SKILL.md` so they can also drop it into their repo (`.claude/skills/<name>/`)
  and commit — a chat can't write their local repo.
- Code path: give the Notion link, remind them to commit
  (`git add .claude/skills/<name> && git commit`), and note the desktop options above.

## Notes
- **Updating** an existing skill: keep the original `name`/folder unchanged so the repo
  file, Notion page, Index row, and saved skill stay one identity.
- **One generation, all destinations** — the same SKILL.md goes everywhere.
- **Don't forge malicious skills** (unauthorized access, exfiltration, malware, deception).
  Ordinary persona/roleplay is fine.
