# skill-library

Noah's standalone, shareable [Claude](https://claude.com/claude-code) skills. **Each folder is a
self-contained skill** — its own `SKILL.md`, README, and assets — so any one of them can be installed
on its own without the rest.

> These are general-purpose skills that stand alone. The Notion-coupled career / content / system
> skills live in a separate plugin, [noah-notion-flywheel](https://github.com/chzylee/claude-notion-flywheel);
> the TS PMO project-management product is at [chzylee/ts-pmo](https://github.com/chzylee/ts-pmo).

## Skills

| Skill | What it does | Docs |
|---|---|---|
| **content-starter** | A content coach that walks a vague idea to a ready-to-write outline — a persona-driven *session skill*, grounded in research. | [README](content-starter/README.md) |
| **sharpen** | Mark a rough request with `sharpen` → it rewrites the prompt, runs it, and reflects, in one response. | [README](sharpen/README.md) |
| **recording-standard** | Installs and keeps fresh the Recording Standard enforcement copy — a marked, dated block in the global `~/.claude/CLAUDE.md` plus a SessionStart hook that warns when it's missing or stale. | [README](recording-standard/README.md) |
| **write-enforcement** | Installs a PreToolUse hook that enforces a Writing Standard's mechanical floor at the moment a page is written (advisory by default; strict opt-in). Target-agnostic — Notion today, retargets to Obsidian/Confluence. | [README](write-enforcement/README.md) |
| **register-page** | Register or refresh one page in a Page Index (registry of homes): reads the opener, classifies its mode, drafts "what lands here", and upserts the row (dedup by URL). | [README](register-page/README.md) |
| **persona-builder** | Build or revise a persona in your Persona Library via a hiring-interview dialogue — schema-v1 rows with a paste-ready, consumer-agnostic profile block; AI proposes and writes, you rule. Creates the library from the v1 schema if you don't have one. | [README](persona-builder/README.md) |
| **persona-assume** | Assume a persona from your Persona Library — resolves your registry, finds it by name, and adopts its Profile block as the active stance (or hands the block to a subagent). Human-invoked; asks which mode; you stay the judge. The loader half of the `persona-*` pair. | [README](persona-assume/README.md) |

## Install one skill

Every skill stands alone — grab just the one you want, three ways:

- **Claude desktop (one-click):** upload `dist/<skill>.skill` via **Settings → Customize → Skills**,
  or present it in a claude.ai chat and click **Save skill**.
- **Claude Code (personal):** copy the skill folder into `~/.claude/skills/`.
  ```bash
  git clone https://github.com/chzylee/skill-library.git
  cp -r skill-library/<skill> ~/.claude/skills/<skill>
  ```
- **Project-scoped:** copy the skill folder into a project's `.claude/skills/` instead.

Each skill's own README has the exact commands (including Windows / PowerShell) and any requirements.

## Layout

```
skill-library/
├── README.md              ← this catalog
├── LICENSE
├── dist/                  ← per-skill .skill bundles for one-click desktop install
└── <skill>/               ← one self-contained skill per folder
    ├── README.md          ← what it is · install · invoke · requirements
    ├── SKILL.md           ← the skill itself
    └── references/…       ← optional bundled assets
```

## Adding a skill

Forge it (e.g. with `skill-forge`), drop the self-contained folder in at the repo root, add a row to
the table above, and build its bundle into `dist/`. Keep each folder installable on its own — no
cross-skill dependencies, no absolute paths.

## License

MIT — see [LICENSE](LICENSE). © 2026 chzylee.
