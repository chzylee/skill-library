---
name: life-ledger-view
description: 'Open the Life Ledger viewer — the local, no-dependency UI over a subject''s facts and patterns — freshly rebuilt so it is never stale, and watch for when the user closes it. Read-only companion to the life-ledger skill: this one shows the data, that one writes it. Triggers on "open my life ledger", "view my life ledger", "show my ledger", "look at my life ledger", or /life-ledger-view.'
---

# Life Ledger View

Read-only companion to `life-ledger`. Rebuilds the viewer from the JSONL store (so the
page always reflects the current data), serves it locally, opens the browser, and holds
the session until the user closes the tab. Nothing here writes to the store.

## Run it

```bash
node "<skill-dir>/viewer-server.mjs" --timeout 540
```

Run it from Bash and **let the call block** — the subprocess staying open *is* how the
session waits for the human. Mind the harness ceiling: a blocking Bash call tops out
around 10 minutes, so pass `--timeout 540` and set the Bash timeout to `600000`. If the
user wants it open longer, run in the background with a long `--timeout` instead —
close detection makes that safe: the page pings the server, and when the tab closes the
server shuts itself down within ~12s, so a forgotten tab never leaves a server running.

Markers on stdout:

| Marker | Meaning |
|---|---|
| `LIFE_LEDGER_VIEWER_URL=<url>` | server listening; browser opened |
| `LIFE_LEDGER_VIEWER_CLOSED` | user closed the tab; exit 0 |
| `LIFE_LEDGER_VIEWER_TIMEOUT` | nobody finished in time (default 30 min) |

Flags: `--subject <name>` (default: first subject found), `--port`, `--timeout <sec>`,
`--no-open`, `--no-rebuild`.

When it exits, just confirm to the user — the viewer is read-only, so there is never a
change summary to report. If the ledger itself needs edits, that's the `life-ledger`
skill (interview modes, batch sign-off), not this one.

The rebuild step calls the sibling skill's builder
(`../life-ledger/scripts/build_viewer.py`); both skills ship in the same repo. If the
builder is missing, the last built page is served and a staleness warning goes to
stderr.
