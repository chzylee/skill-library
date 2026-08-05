---
name: memory-manager
description: 'Open a local UI to see and manage everything Claude Code remembers about you — every auto-memory store on the machine, in one view — then edit, delete, or fix the ones that are wrong. Answers "what does Claude remember about me?" and gives a rollback path when a remembered fact goes stale. Triggers on "what does Claude remember about me", "show me my memories", "manage my memory", "my memory is wrong/stale", "delete that memory", "audit my memory", or /memory-manager.'
---

# Memory Manager

Claude Code's auto-memory is invisible by default. It's partitioned per project directory,
it loads silently at session start, and when a remembered fact goes stale there's no obvious
way to find it, let alone fix it. This skill opens a local web UI over **every store on the
machine at once** and makes each memory readable, editable, and deletable.

The stance: don't try to over-control what the model writes down. Accept how it behaves, keep
the guidance light, and rely on **transparency to roll back mistakes**.

## Run it

```bash
node "<skill-dir>/memory-manager.mjs" --open
```

Run it from Bash and **let the call block** — the subprocess staying open *is* how the session
waits for the human.

Mind the harness ceiling: a blocking Bash call tops out around 10 minutes, so pass
`--timeout 540` and set the Bash timeout to `600000`. If the user needs longer, run it in the
background instead and read `/tmp`-logged stdout when they say they're done — don't let the
tool get killed mid-edit by a tool timeout.

It prints markers to stdout:

| Marker | Meaning |
|---|---|
| `MEMORY_MANAGER_URL=<url>` | server is listening; the browser has been opened |
| `MEMORY_MANAGER_SUMMARY` … `MEMORY_MANAGER_DONE` | the user finished; itemized summary of every write |
| `MEMORY_MANAGER_CLOSED` | the user closed the browser tab; the summary follows, exit 0 |
| `MEMORY_MANAGER_TIMEOUT` | nobody finished in time (default 30 min) |

Flags: `--root <dir>` (default `~/.claude/projects`), `--port`, `--timeout <sec>`, `--no-open`.

**Guide** in the header toggles a help panel down the right side of the UI — a short "what this
is" plus nine plain-language questions, written for someone non-technical. The longer FAQ ships
as `faq.html` and is served at `/faq` (linked from the panel). Both work offline, carry no
token, and hold no memories. Point a confused user at the panel rather than explaining the
storage model yourself.

The page holds the session open with a ping. Close the tab and the server shuts itself down
within ~12s and prints `MEMORY_MANAGER_CLOSED` plus the usual summary — so a forgotten tab
never leaves a server running where the user can't see it. This makes backgrounding safe:
run it with `run_in_background` and a long `--timeout`, and it still ends when they're done.

**When it exits, read the summary block and report it to the user.** You need to — the
`MEMORY.md` loaded into your own context at session start is stale the moment anything is
edited or deleted, and you have no other way to know what changed.

If the user asks you to fix a memory *without* opening the UI, that's fine — edit the file
directly. Use this skill when they want to *see* what's there, or when more than one or two
records are in play.

## What it shows

Memories live at `~/.claude/projects/<encoded-cwd>/memory/*.md`, one directory per project.
**There is no global store** — the cross-store union is the point of the tool.

Only `MEMORY.md`, the per-store index, loads at session start, and only for the store matching
the session's working directory. Individual memory files load on demand. The index cap the
budget meter uses — 200 lines / 25 KB — came from the original brief and has **not** been
independently verified; don't restate it to a user as established fact. Two consequences drive
the whole design:

- A file with **no index line is invisible** — it will never surface.
- A **stale index line keeps asserting** a memory even after the file is gone.

Each record surfaces its `type` and its date. `project` records get a distinct mark: they're
world-state facts, the ones that go quietly wrong when reality moves. Records with no declared
`modified:` field are flagged **undated** and fall back to the file mtime, labelled as inferred
rather than declared.

## Reconciliation — surface, never auto-fix

The index is **not derivable from the files**. Section headings, ordering, titles, and hooks
are editorial human judgment. So the tool detects divergence and lets the user rule on it;
it never regenerates an index.

1. **Orphan** — an index line pointing at a missing file
2. **Unindexed** — a file with no index line
3. **Name divergence** — frontmatter `name:` ≠ filename stem, which silently breaks `[[wiki-links]]`
4. **Budget** — index line count and bytes against the 200-line / 25 KB cap
5. **Non-index `MEMORY.md`** — the file exists but holds prose instead of index lines, so the
   store's entire memory system is dead and nothing else would say so
6. **Orphaned store** — the project directory no longer exists at that path

Each gets a one-click fix the user approves. Nothing is written silently.

Stores are keyed by the project's full path, so **renaming or moving a project orphans its
store permanently** — the old store keeps the old path, the renamed project starts an empty
one, and every memory in the old store becomes unreachable with nothing to say so. This is the
most repeatable failure of the set. An orphaned store gets two whole-store actions: **re-home**
it to the directory the project lives in now (the tool ranks likely destinations by matching
the old path against real directories), or **remove** it. Re-homing into an occupied store
merges rather than overwrites, skipping and reporting name collisions. The destination path is
canonicalized before it's encoded, because Claude Code keys stores by the resolved physical
path — `/tmp/x` and `/private/tmp/x` are the same store, and guessing wrong would silently
create one that never loads.

## How writes work

The **server owns every write**; the browser only sends intent. Each operation is a two-part
write — the file and its index line — and both new contents are computed before either lands.

- **Edit** — targeted line replacement in the frontmatter, so unknown keys (`node_type`,
  `originSessionId`, anything added later) survive byte-for-byte. Saving stamps `modified:`.
- **Delete** — moves the file to a `.trash/` folder inside its own store and removes the index
  line. **Never unlinks.** Nothing reads `.trash/`; it's there so a mistake is recoverable.
- **Remove store** — moves the whole store folder to `<root>/.trash/`. Same rule: a move, not
  a delete. Dot-entries are skipped by the scan, so a trashed store stops appearing.
- **The index line is an editable field of the record**, shown next to `description` and written
  back on save. The tool never invents editorial text.

The API is gated on a per-run token and rejects cross-origin callers and path traversal.

## Developing on it

Never point it at the live stores while changing it. Copy them to a fixture and use `--root`:

```bash
cp -R ~/.claude/projects /tmp/memory-fixture
node memory-manager.mjs --root /tmp/memory-fixture --no-open
```
