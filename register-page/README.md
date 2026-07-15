# register-page

Register or refresh one page in the **Page Index** — the Recording Standard's registry of homes — so its **mode** and **status** are glanceable and routing stays deterministic. Idempotent: re-running refreshes the row instead of duplicating it.

## What it does

Give it everything needed to check a page (a Notion URL/ID, or pasted content plus title/URL). It reads the opener, classifies the mode by the five-mode taxonomy, drafts a "what lands here" line, and **upserts** a Page Index row (dedup by page URL). It writes only to the index — never the target page.

## Install

**Claude Code (personal):**
```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/register-page ~/.claude/skills/register-page
```
Windows / PowerShell:
```powershell
git clone https://github.com/chzylee/skill-library.git
Copy-Item -Recurse skill-library\register-page $HOME\.claude\skills\register-page
```

## Invoke

- "register this page: `<notion url>`"
- "add `<page>` to the page index"
- "refresh the page index row for `<page>`"
- `/register-page`

## Requirements

- Notion MCP tools available in the session (fetch, query, create/update pages).
- The Page Index database exists; its data-source ID is set in `SKILL.md` (swap it to point at a different index).

## Notes

- Pairs with the **"At a glance"** gallery view on the Page Index, which shows Mode · Status under each title.
- Coupled to a specific Notion Page Index by data-source ID — personal by design; change the ID in `SKILL.md` to reuse it against another index.
