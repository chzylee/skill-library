---
name: register-page
description: 'Register (or refresh) a page in the Page Index — the Recording Standard''s registry of homes — so its mode and status are glanceable and routing stays deterministic. Give it everything needed to check a page (a Notion URL/ID, or pasted page content plus its title/URL); it reads the opener, classifies the mode by the five-mode taxonomy, drafts the "what lands here" line, and upserts a row (dedup by page URL). Triggers on "register this page", "register X in the page index", "add X to the page index", "refresh the page index row for X", or /register-page.'
---

# Register Page

Add or refresh one page in the **Page Index** — the registry the [Recording Standard](https://app.notion.com/p/39276356d6fe8139b351fff7cb417e99) routes against. Registering a page makes its **mode** and **status** glanceable and keeps the "index shows every home" invariant true. Idempotent: re-running on the same page refreshes its row rather than duplicating it.

## Input — everything needed to check the page
Accept any of:
- A **Notion page URL or ID** — fetch it and read its opener. (Preferred.)
- **Pasted page content** plus its **title and URL** — use the content directly when a fetch isn't available.
- **"this page"** with a URL in context.

If you have only a title with no way to inspect the page, ask for the URL — do not guess the mode.

## The Page Index
- Data source (collection): `collection://3701b5de-e8cd-4edb-aaa9-8712f0bbbeed`
- Row schema: **Name** (title) · **Mode** (select) · **Status** (select) · **What lands here** (text) · **Page** (url) · **Supersedes** (text).
- Dedup key: the **Page** URL. One row per page.

## Steps
1. **Inspect.** Fetch the page (or use the provided content). Read its opening callout and headings.
2. **Classify the mode** by read/write contract (not topic) — the five-mode taxonomy:
   - **1 Reference** — read as a consumer; rarely changes (glossaries, indexes, navigational hubs).
   - **2 Living documentation** — read and updated in tandem; grows (project wikis, system hubs).
   - **3 Operational surface** — a live board you work from (trackers, leverage/connection hubs).
   - **4 Standard / contract** — a ruleset others are held to (the Recording/Writing Standards).
   - **5 Log / archive** — a dated record, read once as input (ratification logs, changelogs, sweeps).
   If the page's opener already declares a mode, honor it. If the mode is genuinely ambiguous, state your best guess and ask the user to confirm — precision over speed.
3. **Draft "what lands here"** — one line answering *what belongs on this page* (distilled from the opener), phrased for routing, not just identity.
4. **Set status** — default **Live**; use Done / Closed / To-delete only if the page's own state says so.
5. **Upsert.** Query the Page Index for a row whose **Page** equals this URL.
   - **Found:** update that row's Mode / Status / What lands here (and Name if it changed).
   - **Not found:** create a new row with Name (page title, keep its icon emoji), Mode, Status, What lands here, Page.
6. **Report** the row — mode, status, what-lands-here — and the row URL. If you had to guess the mode, say so and invite a correction.

## Notes
- The **"At a glance"** gallery view surfaces Mode · Status under each title; registering a page is what makes it show up there.
- This skill only writes to the Page Index; it never edits the target page.
- The weekly `standards-weekly-sweep` refreshes "what lands here" across rows; this skill is the on-demand path for a single page.
