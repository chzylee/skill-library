# memory-manager

See everything Claude remembers about you — every auto-memory store on your machine, in one
view — and fix or delete what's wrong.

Claude Code writes memories about you as it works. They're useful, and they're **invisible**:
partitioned per project directory, loaded silently at the start of each session, with no
built-in way to browse or correct them. The failure mode is quiet and specific — a fact that
was true when it was written keeps being asserted in unrelated sessions after reality moves.
An interview date changes; six sessions later Claude still confidently tells you the old one.

This skill opens a local web UI over **all your stores at once**, so you can read every memory,
edit it, or move it to a trash folder. Nothing is uploaded; the server runs on your machine and
closes when you're done.

The stance behind it: don't try to over-control what an AI writes down. Accept how it behaves,
keep the guidance light, and rely on **transparency to roll back mistakes.**

## Install

**Claude Code (personal):**

```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/memory-manager ~/.claude/skills/memory-manager
```

Windows / PowerShell:

```powershell
git clone https://github.com/chzylee/skill-library.git
Copy-Item -Recurse skill-library/memory-manager "$HOME/.claude/skills/memory-manager"
```

**Project-scoped:** copy the folder into a project's `.claude/skills/` instead.

## Requirements

- **Node 18+** — already present if you run Claude Code. No packages to install; the tool is
  Node standard library only.
- **A browser.** The UI opens automatically; if it can't, the URL is printed and you can open
  it yourself.
- Nothing else. No account, no network, no configuration.

## Invoke

- **"what does Claude remember about me?"** / **"show me my memories"** — opens the UI on every
  store found on the machine.
- **"my memory about X is wrong"** / **"that's stale"** — opens the UI so you can correct or
  delete the record.
- **"audit my memory"** — opens on the reconciliation view: what's broken and what to do about it.
- **`/memory-manager`** — explicit invocation.

Closing the browser tab ends the session too — the tool notices within a few seconds and shuts
itself down, so nothing keeps running after you've stopped looking at it.

When you click **Finish & close**, the tool reports back an itemized summary of everything that
changed, and Claude relays it. That matters: after you edit anything, the memory index Claude
loaded at the start of the session is out of date, and the summary is how it finds out.

## The guide

Click **Guide** in the header and a help panel opens down the right side, beside your notes
rather than over them: what this is, and nine plain questions — where the notes live, why a
chat you already have open won't notice your fix, whether you can lose something, whether
anything leaves your computer. It stays open between runs once you open it.

The longer version is one click further, and also lives at
[chzylee.github.io/skill-library/memory-manager/](https://chzylee.github.io/skill-library/memory-manager/).
Both end on the same question: when would this be wrong?

## What you'll see

**Every memory, grouped by project**, with a filter box across all of them. Each one shows its
type and its date.

**Two things get called out**, because they're where stale facts hide:

- **`project` memories** — world-state facts, the ones that go wrong when reality moves. A
  preference stays true; a date doesn't.
- **Undated memories** — records with no declared date. The tool falls back to the file's
  modification time and labels it as *inferred*, not declared, so you know how much to trust it.

**A reconciliation panel** for divergences between your memory files and the index that
actually loads:

| What it finds | Why it matters |
|---|---|
| Orphaned store | The project was renamed or moved, so every memory in it is unreachable |
| Orphan index line | The line still asserts a memory whose file is gone |
| Unindexed file | The file exists but never loads — it's invisible |
| Name divergence | Internal `[[links]]` between memories break silently |
| Index over budget | The contents page may be too long to load completely |
| `MEMORY.md` isn't an index | That store's memory system is dead, silently |

Each has a one-click fix — **that you approve.** The tool never rewrites your index on its own.
Titles, ordering, and section headings in that index are editorial judgment, yours, and a tool
that regenerates them destroys the part that took thought.

## What it does to your files

- **Editing** rewrites only the fields you changed. Everything else in the file — including
  internal bookkeeping fields — is preserved exactly.
- **Deleting moves the file to a `.trash/` folder inside that project's own memory directory.
  It is never unlinked.** If you delete something you shouldn't have, it's still on disk.
- The **index line is editable directly**, alongside the memory's description, so what loads at
  session start is something you wrote rather than something a tool guessed.
- **Removing a whole store** moves the entire folder to a `.trash/` beside your other stores.
  Also a move, also recoverable.

### When you rename a project

Memory stores are keyed by the project's full path, so **renaming or moving a project orphans
its store**: the old store keeps the old path, the renamed project starts an empty one, and
every memory in the old store becomes unreachable. Nothing tells you this happened.

The tool flags those stores and offers two ways out — **re-home it** to the directory the
project lives in now, or **remove it**. Re-homing suggests the likely destination by matching
the old path against real directories, so usually you just confirm. If the destination already
has memories of its own, they merge: nothing is overwritten, and any name collisions are
reported by name instead of resolved silently.

## Options

```bash
node ~/.claude/skills/memory-manager/memory-manager.mjs --open
```

| Flag | Default | What it does |
|---|---|---|
| `--root <dir>` | `~/.claude/projects` | Where to look for memory stores |
| `--timeout <sec>` | `1800` | Close automatically after this long |
| `--port <n>` | `0` (ephemeral) | Bind a fixed port |
| `--no-open` | — | Print the URL instead of opening a browser |

The server binds to `127.0.0.1` only, and its API is gated on a token generated fresh each run,
so no other page or process on your machine can reach it. Requests with a non-loopback `Host`
or `Origin` are rejected, and store/file names are validated against path traversal.

## Tests

Zero-dependency suite using `node:test` — unit tests for the frontmatter writer, index
parser, and store-path decoder, plus an end-to-end run that spawns the real server against
a synthetic fixture (it never touches `~/.claude/projects`):

```bash
cd memory-manager
node --test test/*.test.mjs
```
