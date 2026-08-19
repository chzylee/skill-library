# UI-CONTRACT — the supervised-subprocess contract for skill UIs

This is the agreement between a **consuming skill** (a Node script the agent
launches) and the **calling agent** (Claude Code parsing its stdout). The
engine that implements the server half is `local-ui.mjs`, vendorable as one
stdlib-only file. The contract is the durable artifact; the server is fifteen
well-known lines.

The shape: the agent runs a blocking Bash call, a local server opens a browser
page, the human works in the page, and the process ends by itself on one of
three independent end-conditions — then the agent reads a machine-parseable
account of what the human did. Guaranteed termination is the whole point.

## Markers (stdout — the agent parses ONE stream)

`<NAME>` is the marker prefix derived from the **consuming skill's** name
(e.g. `MEMORY_MANAGER`, `CONFIG_FORM`), matching `/^[A-Z][A-Z0-9_]*$/`. It is
never derived from the engine or any repo name.

```
<NAME>_URL=<url>            listening; browser opened. The URL carries the per-run token.
<NAME>_RESULT=<path>        where the JSON run record lives (see below)
<NAME>_SUMMARY … <NAME>_DONE   the fence the agent must read back and report
<NAME>_CLOSED               the tab closed (pings stopped); summary follows; exit 0
<NAME>_TIMEOUT              nobody finished before the clock; summary follows; exit 3
<NAME>_ERROR <msg>          precondition failed (exit 2) or terminated by signal
```

`_ERROR` goes to **stdout**, not stderr. The agent parses one stream; an error
that lands where the parser is not looking is worse than an error on the
"wrong" stream.

Exit codes: `0` normal or closed · `2` bad args / precondition / signal ·
`3` timeout.

## The run record (`<NAME>_RESULT=`)

A small JSON file, written **twice**: once at listen (`"reason": "running"`,
with `pid`) and once at shutdown (final). A backgrounded session can poll it
and tell apart *still running* (reason `running`, pid alive), *finished*
(reason `done`/`closed`/`timeout`), and *died without finishing* (reason
`running`, pid dead — the one case stdout can never report).

```json
{
  "name": "MEMORY_MANAGER",
  "reason": "done | closed | timeout | error | running",
  "exitCode": 0,
  "pid": 12345,
  "startedAt": "2026-08-17T12:00:00Z",
  "endedAt": "2026-08-17T12:04:12Z",
  "summary": { "whatever": "onSummary returned as data" }
}
```

The `SUMMARY…DONE` fence stays freeform for the human and the agent's report.
The JSON is what tests assert on. If the consumer passes no `resultFile`, the
engine defaults to a per-run file in the OS temp directory.

## The lifetime is NOT a mode

There is no `watch`/`oneshot` enum. There are three independent end-conditions,
each on or off, all funneling into one shutdown:

```js
enders: {
  done:  true,   // enable POST /api/done (a Done button, or ctx.end from a route)
  close: true,   // inject the keepalive ping; arm the watchdog after the FIRST ping
  clock: 540,    // seconds; ABSENT defaults to 540; explicit 0 disables
}
```

The familiar shapes are presets `/skill-dev-rig` writes, not engine concepts:

```js
const watch   = { done: true,  close: true,  clock: 540 };  // memory-manager shape
const oneshot = { done: true,  close: false, clock: 540 };  // config-form shape
const viewer  = { done: false, close: true,  clock: 540 };  // life-ledger-view shape
```

A route handler may also end the run itself — `ctx.end('done')` inside the
handler enters the same shutdown after the response flushes. Use it when a
domain action (saving a form) IS the end of the session; it removes the
close-the-tab-between-two-fetches window entirely.

### One serialized shutdown

All enders (and SIGINT/SIGTERM) enter one path: stop accepting requests, drain
in-flight ones via an engine-owned counter (bounded — a wedged request cannot
make the process outlive its own timeout), call `onSummary` **exactly once**
(it may be async; it is awaited), write the run record, print the fence, exit
with that ender's code. **First ender wins; later ones are no-ops.**

This designs out a real bug: in the hand-rolled ancestor, a user could click
Done and still have the run reported as `TIMEOUT`/exit 3 if the clock fired
inside a 60ms deferral window. Here the race cannot exist — `done` marks the
run finished synchronously, and the clock finds it already finishing.

## The blocking-Bash ceiling (read this even if you read nothing else)

A blocking Bash call in Claude Code dies at ~10 minutes. So:

- Run the consumer with `--timeout 540` (or let the engine's default 540 hold)
  **and set the Bash tool timeout to `600000`** (10 min), or
- for longer sessions, run it **in the background** with a long `--timeout`,
  and poll the `<NAME>_RESULT` file to learn how it ended.

The engine's default clock is 540 precisely so a consumer that reads no docs
still fits under the ceiling. `clock: 0` is the deliberate opt-out for
backgrounded runs. Note the clock is **wall-clock**, not idle time: a live,
pinging tab still ends at the clock — background the run if the human needs
longer than the ceiling allows.

## Close detection — why it works this way

You can never wait on the browser *process*: browsers open URLs in an existing
process, so the child you spawned exits immediately. You wait on the server,
and the page has to tell the server it is still there.

The engine injects a ping script before the page's last `</body>`: ping every
3s, dead after 12s of silence. The watchdog **arms only after the first ping**,
so a slow browser launch can never kill the server. The injected ping also
fires on `pageshow`/`visibilitychange`, so a machine waking from sleep
re-announces the tab quickly — but a sleep longer than the grace window can
still be reported as `CLOSED` while the tab lives; that edge is inherent to
ping-based liveness and is accepted.

The ping carries the per-run token like every other request.

## Security posture — strict, no dials

- Bind `127.0.0.1` only.
- Reject any request whose `Host` is not loopback (closes DNS rebinding:
  `evil.com` resolving to `127.0.0.1` would otherwise read the token off `/`
  as a same-origin fetch).
- Per-run random token required on **every** route, *including `/`* — nothing
  without it can bootstrap a session.
- Reject cross-origin callers on API routes.
- Request bodies capped at 5MB.
- The server owns every write; the browser only sends intent.
- No opt-outs. A dial that weakens this becomes the default a stranger picks.

### Deliberate non-adoptions (recorded so nobody "fixes" them later)

- **Token stays in the query string.** Fragment + `__Host-` cookie is correct
  for a long-lived server; here the token dies with the process, so history
  retention is post-hoc worthless and the cookie machinery is not worth its
  complexity.
- **No static-file helper.** No consumer needs one, and shipping a
  traversal-guarded file server invites consumers to serve directories,
  manufacturing the surface the guard defends. Pages are self-contained;
  assets are inlined at build time, never `<link>`ed.
- **No instance policy.** Consumers disagree (one wants single-instance, one
  wants two at once). `--port` with ephemeral default lets each decide. The
  PID-file kill pattern is specifically rejected: under PID reuse it kills an
  unrelated process.

## Browser launch

Stdlib only: `open` (darwin), `xdg-open` (linux), and on win32
`spawn('cmd', ['/c', 'start', '', url])` — an argv array, never `shell: true`,
with the empty string filling `start`'s title slot. The URL is entirely
engine-constructed (loopback host, numeric port, hex token, no `&`), so no
shell metacharacter can appear in it. The win32 path is untested on this
machine; the URL construction argument is the guarantee.

## Versioning

The engine file carries a version stamp in its header and exports
`LOCAL_UI_VERSION`. `/skill-dev-rig` vendors the file with the stamp intact so later
`rig status` / `rig upgrade` tooling can detect drift. No tooling exists yet;
the stamp is the hook for it.

## What the engine will never do

No domain logic, no summary body (the consumer's `onSummary` owns it), no
instance policy, no static file serving, no network beyond the loopback
listener. The consuming skill owns its domain.
