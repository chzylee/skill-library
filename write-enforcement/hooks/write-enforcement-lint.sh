#!/bin/sh
# write-enforcement-lint.sh — PreToolUse hook for the Writing Standard's mechanical floor.
#
# POSIX-sh equivalent of write-enforcement-lint.ps1. Advisory (non-blocking) by default.
#
# I/O CONTRACT (Claude Code PreToolUse) — verified 2026-07-14:
#   - Reads the hook JSON payload from STDIN: { tool_name, tool_input, ... }.
#   - Advisory (default): emit JSON on STDOUT with permissionDecision "defer" +
#     additionalContext, and exit 0. That is the documented NON-BLOCKING channel — the write
#     proceeds AND Claude receives the context. The message is also mirrored to stderr for the
#     user's transcript. (Plain stderr + exit 0 does NOT reach Claude; only exit 2 does, and
#     exit 2 blocks — so we do not use it in advisory mode.)
#   - On ANY error / no jq / unparseable input: print the static reminder and exit 0. Fail open.
#
# STRICT / BLOCK MODE (opt-in): set WRITE_ENFORCEMENT_STRICT=1. If violations are flagged, the
#   hook emits a "deny" decision on stdout and exits 0 (Claude sees the reason; write blocked).
#
# RETARGETING: the guard matches the tool name against WRITE_TOOL_PATTERNS below. Add an
#   Obsidian/Confluence write-tool substring there and update the matcher in settings.json.
#
# jq is OPTIONAL. Without jq we cannot reliably parse the payload, so we degrade to printing
# the static reminder (advisory) and exit 0.

# ---- config -------------------------------------------------------------------------------
WRITE_TOOL_PATTERNS="notion-create-pages notion-update-page"
BANNED="carve-out gap-read cohort"

REMINDER='[write-enforcement] Writing Standard reminder — applied at write time:
  Open with an overview (reader grasps the page in one glance). Prefer structure — tables,
  tiers, collapsible sections — over walls of prose. Cite-or-flag every factual claim (link a
  primary source or mark it unverified); label interpretation as interpretation. Teammate-
  engineer voice: no insider jargon or coined labels without their referent (gloss any coinage).
  Current state only — change-history goes to a Changelog, never inline. Default docs to
  collapsible sections. Run the humanizer norm.'

# JSON-escape a string for embedding in our emitted JSON (advisory/strict paths).
json_escape() {
  # escape backslash, double-quote, then convert newlines to \n
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'BEGIN{ORS="\\n"}{print}'
}

emit_advisory() {
  # $1 = full message. Mirror to stderr (transcript), then emit defer+additionalContext JSON.
  printf '%s\n' "$1" >&2
  esc=$(json_escape "$1")
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"defer","additionalContext":"%s"}}\n' "$esc"
  exit 0
}

emit_deny() {
  # strict mode: $1 = full message
  printf '%s\n' "$1" >&2
  esc=$(json_escape "$1")
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$esc"
  exit 0
}

# ---- read stdin ---------------------------------------------------------------------------
PAYLOAD=$(cat 2>/dev/null || true)
[ -z "$PAYLOAD" ] && exit 0

# ---- quick raw guard: only proceed if a guarded write-tool substring is in the payload ----
# (Belt-and-suspenders alongside the settings.json matcher; keeps us quiet on other tools even
#  without jq. The tool name appears literally in the raw JSON.)
RAW_GUARDED=0
for p in $WRITE_TOOL_PATTERNS; do
  case "$PAYLOAD" in
    *"$p"*) RAW_GUARDED=1; break;;
  esac
done
[ "$RAW_GUARDED" -eq 0 ] && exit 0

# ---- no jq: degrade to static reminder ----------------------------------------------------
if ! command -v jq >/dev/null 2>&1; then
  # It's a guarded write, but we can't parse content without jq; surface the static reminder.
  emit_advisory "$REMINDER"
fi

# ---- parse tool name; bail if not a guarded write -----------------------------------------
TOOL_NAME=$(printf '%s' "$PAYLOAD" | jq -r '.tool_name // empty' 2>/dev/null)
[ -z "$TOOL_NAME" ] && exit 0

GUARDED=0
for p in $WRITE_TOOL_PATTERNS; do
  case "$TOOL_NAME" in
    *"$p"*) GUARDED=1; break;;
  esac
done
[ "$GUARDED" -eq 0 ] && exit 0

# ---- extract all string values from tool_input (robust, target-agnostic) ------------------
CONTENT=$(printf '%s' "$PAYLOAD" | jq -r '[.. | strings] | join("\n")' 2>/dev/null)
if [ -z "$CONTENT" ]; then
  emit_advisory "$REMINDER"
fi

LOWER=$(printf '%s' "$CONTENT" | tr '[:upper:]' '[:lower:]')
FLAGS=""
add_flag() { FLAGS="${FLAGS}  - $1
"; }

# --- Check 1: mode declaration near the top ---
HEAD=$(printf '%s' "$CONTENT" | head -c 1200)
HEAD_LOWER=$(printf '%s' "$HEAD" | tr '[:upper:]' '[:lower:]')
HAS_MODE=0
case "$HEAD_LOWER" in *'**mode:'*) HAS_MODE=1;; esac
if [ "$HAS_MODE" -eq 0 ]; then
  # look for a "> " callout line naming a mode word
  MODE_LINE=$(printf '%s\n' "$HEAD" | grep -i '^[[:space:]]*>' 2>/dev/null | \
    grep -iE 'reference|living doc|operational|standard|contract|log|archive' 2>/dev/null | head -n1)
  [ -n "$MODE_LINE" ] && HAS_MODE=1
fi
[ "$HAS_MODE" -eq 0 ] && add_flag "No mode declaration found near the top — open with a callout naming the page's mode (Reference / Living doc / Operational / Standard / Log)."

# --- Check 2: collapsible headers on long docs ---
HEADINGS=$(printf '%s\n' "$CONTENT" | grep -cE '^[[:space:]]*##' 2>/dev/null || echo 0)
HEADINGS=$(printf '%s' "$HEADINGS" | tr -d '[:space:]')
[ -z "$HEADINGS" ] && HEADINGS=0
DETAILS=$(printf '%s' "$LOWER" | grep -o '<details' 2>/dev/null | wc -l | tr -d '[:space:]')
[ -z "$DETAILS" ] && DETAILS=0
if [ "$HEADINGS" -ge 4 ] && [ "$DETAILS" -eq 0 ]; then
  add_flag "Long page ($HEADINGS headings) with no collapsible sections — wrap sections in <details><summary> so the outline reads without noise. Keep the overview and a worked example visible."
fi

# --- Check 3: banned coined jargon ---
for term in $BANNED; do
  case "$LOWER" in
    *"$term"*) add_flag "Possible coined jargon '$term' — name its referent or use a descriptive term (self-describing-names rule).";;
  esac
done

# --- Check 4: inline change-notes (current-state-only) ---
check_change() {
  # $1 = extended-regex, $2 = human label
  hit=$(printf '%s\n' "$CONTENT" | grep -ioE "$1" 2>/dev/null | head -n1)
  [ -n "$hit" ] && add_flag "Inline change-note '$hit' — deliverables are current-state only; move history to a Changelog."
}
check_change 'changed on[[:space:]]+[[:alnum:]]' 'changed on'
check_change 'updated after' 'updated after'
check_change '\(was:' 'was:'
check_change 'used to be' 'used to be'
check_change 'previously,' 'previously,'

# ---- build message + emit -----------------------------------------------------------------
if [ -n "$FLAGS" ]; then
  N=$(printf '%s' "$FLAGS" | grep -c '  - ' 2>/dev/null || echo 0)
  MESSAGE="$REMINDER

[write-enforcement] possible Writing-Standard issue(s) flagged (advisory — verify, they may be false alarms):
$FLAGS"
else
  MESSAGE="$REMINDER

[write-enforcement] No mechanical-floor violations flagged."
fi

if [ "${WRITE_ENFORCEMENT_STRICT:-}" = "1" ] && [ -n "$FLAGS" ]; then
  emit_deny "$MESSAGE"
fi

emit_advisory "$MESSAGE"
