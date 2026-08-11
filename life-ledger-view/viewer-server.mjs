#!/usr/bin/env node
// life-ledger-view — serve the Life Ledger viewer, watch for tab close, exit clean.
// Read-only: GET / and GET /ping only. No writes, no API, localhost only.
//
// Markers on stdout:
//   LIFE_LEDGER_VIEWER_URL=<url>   server listening, browser opened
//   LIFE_LEDGER_VIEWER_CLOSED      tab closed (pings stopped); exit 0
//   LIFE_LEDGER_VIEWER_TIMEOUT     nobody opened/closed within --timeout; exit 0
//
// Flags: --subject <name> --port <n> --timeout <sec, default 1800> --no-open --no-rebuild

import { createServer } from "node:http";
import { execFileSync, execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

const ROOT = join(homedir(), ".claude", "life-ledger");
const VIEWER = join(ROOT, "viewer", "index.html");
const subject = opt("--subject", "");
const timeoutSec = parseInt(opt("--timeout", "1800"), 10);
const skillDir = dirname(fileURLToPath(import.meta.url));
const builder = join(skillDir, "..", "life-ledger", "scripts", "build_viewer.py");

// 1. Rebuild so the page is never stale (sibling skill owns the builder).
if (!flag("--no-rebuild") && existsSync(builder)) {
  try {
    execFileSync("python3", subject ? [builder, subject] : [builder], { stdio: "inherit" });
  } catch {
    console.error("rebuild failed; serving last built viewer");
  }
}
if (!existsSync(VIEWER)) {
  console.error("no viewer at " + VIEWER + " — run the life-ledger skill first");
  process.exit(1);
}

// 2. Serve, injecting a keepalive ping before </body>.
const PING_MS = 3000, DEAD_MS = 12000;
let lastPing = 0, opened = false;
const html = readFileSync(VIEWER, "utf8").replace(
  "</body>",
  `<script>setInterval(()=>fetch('/ping').catch(()=>{}),${PING_MS})</script></body>`
);

const server = createServer((req, res) => {
  if (req.url === "/ping") { lastPing = Date.now(); opened = true; res.end("ok"); return; }
  if (req.url === "/" || req.url === "/index.html") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html); return;
  }
  res.statusCode = 404; res.end();
});

server.listen(parseInt(opt("--port", "0"), 10), "127.0.0.1", () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  console.log(`LIFE_LEDGER_VIEWER_URL=${url}`);
  if (!flag("--no-open")) execFile(process.platform === "darwin" ? "open" : "xdg-open", [url]);
});

const started = Date.now();
const tick = setInterval(() => {
  const now = Date.now();
  if (opened && now - lastPing > DEAD_MS) {
    console.log("LIFE_LEDGER_VIEWER_CLOSED");
    clearInterval(tick); server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000);
  } else if (now - started > timeoutSec * 1000) {
    console.log("LIFE_LEDGER_VIEWER_TIMEOUT");
    clearInterval(tick); server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000);
  }
}, 2000);
