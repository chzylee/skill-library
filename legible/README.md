# legible

A **logical first-time reader** sits down with your writing, walks its core parts in order, and
**signs off that it reads clearly** — or shows you exactly where it doesn't. It **verifies** each part
does its job and **validates** the wording where a reader stumbles, and **you rule change-or-keep on
every call** — so the piece is one you own, not AI prose you rubber-stamped.

```
/legible
readability pass on record/index.html
have a reader sign off on this draft
```

## Install

### Claude Code (personal)

```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/legible ~/.claude/skills/legible
```

Windows (PowerShell):

```powershell
git clone https://github.com/chzylee/skill-library.git
Copy-Item -Recurse skill-library\legible $env:USERPROFILE\.claude\skills\legible
```

Restart Claude Code (or start a new session). Project-scoped instead? Copy the `legible` folder into
that project's `.claude/skills/`.

### Claude desktop

Upload `dist/legible.skill` via **Settings → Customize → Skills**, or present it in a claude.ai chat
and click **Save skill**.

## What it does

1. **Setup** — names the reader (who it's for) and the mode.
2. **Validates the structure** — you state the outline you intend; a reader-agent reports the outline
   it *actually* perceives; the gap is the finding; you rule (reorder / cut / merge / add).
3. **Walks the elements** — per part: **verify** it does its job for the reader, then **validate** the
   wording where the reader stumbles (change or keep — you rule).
4. **Signs off** — a fresh reader confirms it reads start to finish: **"reads clean — good to share."**

## Modes

| Mode | What runs | Reader(s) |
|---|---|---|
| **light** | element pass only | Sonnet |
| **standard** *(default)* | structure + elements | Sonnet |
| **rigorous** | structure + elements | Sonnet + a Haiku stress reader |

The Haiku reader is naturally pickier and harder to satisfy — a clarity stress test. You rule which of
its catches are real.

## Best used on — and what it won't do

- **Best on functional writing** — writing whose job is to be *understood* (artifacts, docs, posts,
  newsletters). It runs on any writing, but that's where it earns its keep.
- **It checks legibility, not voice or style** — a deliberate limit. Want a voice or de-slop pass? Run
  it separately, before or after; legible neither requires nor blocks one.
- **No telemetry, no log** — the readable piece is the whole proof.

## License

MIT — see [LICENSE](../LICENSE).
