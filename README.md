# skill-library

**Skills I built for my own work, shared as-is: I build for me, you can use it.**

A [Claude](https://claude.com/claude-code) **skill** is a markdown file of instructions that
teaches Claude a repeatable workflow — you invoke it by name (like `/sharpen`) or Claude picks it
up when your request matches. This repo is my library of the standalone, general-purpose ones:
writing tools, prompting tools, and workspace-hygiene tools. Nothing here needs my setup to run —
each skill is a self-contained folder you can take on its own.

This is a working library, not a product. The skills are exactly what I use day to day, honestly
labeled: where one presumes a system of mine (a Notion database, a documentation standard), its
row below says so, so you know before installing.

> My Notion-coupled career/content/system skills live separately in
> [claude-notion-flywheel](https://github.com/chzylee/claude-notion-flywheel); the TS PMO
> project-management product is at [chzylee/ts-pmo](https://github.com/chzylee/ts-pmo).

## Install one skill (start here)

You don't install the library — you take the one skill you want. Paste this prompt into a
[Claude Code](https://claude.com/claude-code) session, with the last line edited to name the skill:

```text
Install one skill from https://github.com/chzylee/skill-library for me:

1. Fetch ONLY the folder named <SKILL-NAME> from that repo (shallow clone or
   GitHub API — your choice).
2. Copy that folder to ~/.claude/skills/<SKILL-NAME>, creating directories as
   needed. If the skill's own README lists extra setup (some install a hook),
   follow it and show me exactly what it changed.
3. Remove any temporary clone. Change nothing else on my machine.
4. Read the skill's description back to me so I can confirm it's what I wanted.

<SKILL-NAME> is: sharpen
```

The prompt is deliberately narrow: it copies one folder into your personal skills directory and
touches nothing else. It works on any OS — Claude resolves the paths for your machine.

**No install at all:** for single-file skills (`sharpen`, `legible`, `register-page`) you can just
paste the raw contents of the skill's `SKILL.md` into any Claude chat and say "act as this skill
for this session." Zero footprint; gone when the chat ends.

**Claude desktop / claude.ai:** where a `dist/<skill>.skill` bundle exists, upload it via
**Settings → Customize → Skills** for one-click install.

## Install everything (the plugin)

If you want the whole library with auto-updates, add it as a plugin from inside Claude Code:

```text
/plugin marketplace add chzylee/skill-library
```

```text
/plugin install skill-library@noah-skill-library
```

This is additive to the per-skill paths above — pick one route per skill, not both, or you'll have
duplicate copies answering to the same name.

## The skills

| Skill | What it does | Who it's for | Standalone? |
|---|---|---|---|
| **[sharpen](sharpen/README.md)** | Mark a rough request with `sharpen` → it rewrites the prompt properly, runs it, and reports what it most needed and least trusts. | Anyone who fires off rough prompts and wants the better version run automatically. | ✅ Fully |
| **[legible](legible/README.md)** | A first-time reader walks your writing part by part and signs off on its legibility — or says exactly where it doesn't read clearly. You rule on every change. | Anyone about to share a doc, post, or README and wondering "is this actually clear?" | ✅ Fully |
| **[content-starter](content-starter/README.md)** | Coaches a vague content idea into a ready-to-write outline through a real back-and-forth. You keep the voice; it does the scaffolding. | People who write posts or scripts and stall at the start. | ✅ Fully |
| **[memory-manager](memory-manager/README.md)** | See everything Claude remembers about you — every auto-memory store on your machine in one view — then edit or delete what's wrong. Opens a local UI; nothing is uploaded. | Anyone whose Claude has started repeating something that stopped being true. | ✅ Fully |
| **[ratify](ratify/README.md)** | The ratification protocol for decision gates: you state your expectation *before* seeing the recommendation, the gap becomes the discussion, and every decision is logged as predicted / surprised / no-opinion. Kills rubber-stamping. [See the proof card](https://chzylee.github.io/skill-library/ratify/). | Anyone approving AI recommendations who wants their "yes" to mean something. | ✅ Pairs with `ratify-configure` |
| **[ratify-configure](ratify-configure/README.md)** | Settings console for ratify's local decision telemetry — view your numbers, keep recording, or turn it off. | ratify users. | ⚠️ Companion to `ratify` |
| **[recording-standard](recording-standard/README.md)** | Installs and keeps fresh my Recording Standard's enforcement block in `~/.claude/CLAUDE.md`, plus a session-start staleness warning. | Users of my Recording Standard documentation system. | ⚠️ Part of the Recording Standard set |
| **[write-enforcement](write-enforcement/README.md)** | A write-time hook that lints pages against a writing standard as they're written (advisory by default). Targets Notion today; retargetable. | People with a written standard who want it enforced at write time, not remembered. | ⚠️ Pairs with a writing standard |
| **[register-page](register-page/README.md)** | Registers or refreshes one page in a Page Index (a registry of where things live), classifying its mode and upserting the row. | Users of my Recording Standard's Page Index in Notion. | ⚠️ Part of the Recording Standard set |

In-progress skills live on the [`dev` branch](https://github.com/chzylee/skill-library/tree/dev)
— `main` only carries what a stranger can use today.

## What using one actually looks like

A real `sharpen` run, trimmed only for length. The user typed one rough line; everything after it
is the skill:

> **User:** `sharpen write a readme intro for my side project — a cli that renames photos by their exif date`
>
> **Claude:**
>
> **Sharpened prompt**
> *Write a 3–4 sentence README intro for a CLI that renames photo files to their EXIF capture
> date. Cover: what it does in one line, who it's for, the default filename format, and what
> happens to files with no EXIF data. Plain tone — no marketing language.*
>
> **exif-rename** renames your photos to the moment they were taken: it reads each file's EXIF
> capture date and renames it to `2024-06-14_183042.jpg`, so shots from every camera and phone
> sort into one timeline. It's for anyone consolidating photo dumps — SD cards, phone backups,
> old drives — into a single folder. Files with no EXIF date are left untouched and listed at
> the end, so nothing is renamed blind.
>
> **Most needed** — the tool's actual name and command syntax; whether it renames in place or
> copies; supported formats beyond JPEG.
>
> **Least confident** — I guessed the filename format and the leave-untouched behavior for
> missing EXIF; if the tool does either differently, those two sentences are wrong.

That's the shape of every skill here: you say the small thing, the skill supplies the discipline
around it — and tells you where it was guessing instead of hiding it.

<details>
<summary><strong>Repo layout</strong></summary>

```
skill-library/
├── README.md              ← this guide
├── LICENSE
├── .claude-plugin/        ← marketplace + plugin manifests (the "install everything" path)
│   ├── marketplace.json
│   └── plugin.json
├── dist/                  ← per-skill .skill bundles for one-click desktop install
├── docs/                  ← GitHub Pages site: one page per skill (docs/<skill>/)
└── <skill>/               ← one self-contained skill per folder
    ├── README.md          ← what it is · install · invoke · requirements
    ├── SKILL.md           ← the skill itself
    ├── references/…       ← optional bundled assets
    └── hooks/…            ← optional hook scripts (installer skills only)
```

Each skill folder is installable on its own — no cross-skill dependencies, no absolute paths.

</details>

<details>
<summary><strong>Adding a skill (maintainer notes)</strong></summary>

1. Build the skill on the `dev` branch as a self-contained folder at repo root
   (`SKILL.md` + `README.md` with install docs + optional assets).
2. When a stranger could use it today, promote it to `main`: add a row to the table above,
   add its path to the `skills` array in `.claude-plugin/plugin.json`, and build its bundle
   into `dist/` (zip the folder; on Windows run the packager with `PYTHONUTF8=1`).
3. Keep `main` honest: unfinished skills stay on `dev`.

Note: a `SKILL.md` description containing a bare `: ` must be single-quoted in YAML.

</details>

<details>
<summary><strong>Per-skill requirements & caveats</strong></summary>

- **sharpen, legible, content-starter** — no requirements; work in any Claude surface.
- **content-starter** — richest in Claude Code (bundled persona + references); the `.skill`
  bundle carries them for desktop.
- **recording-standard, write-enforcement** — Claude Code only (they install hooks and edit
  `~/.claude/CLAUDE.md` / `settings.json`); their READMEs show exactly what gets written.
- **register-page** — needs a Notion connection (MCP) and a Page Index database to write to;
  most useful alongside the Recording Standard system.
- **ratify** — records one enums-only line per decision to a local file
  (`~/.claude/ship-pipeline/…` — a historical path name; ratify grew up inside my
  [Ship Pipeline](https://github.com/chzylee/ship-pipeline) build process, which now depends on it
  from here). Nothing is ever transmitted; `/ratify-configure` shows, keeps, or disables it.

</details>

## License

MIT — see [LICENSE](LICENSE). © 2026 chzylee.
