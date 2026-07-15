#!/bin/sh
# recording-standard-check.sh
# SessionStart hook: warn (never block) when the Recording Standard enforcement
# block in ~/.claude/CLAUDE.md is missing or older than the version this hook ships.
# Behavior contract: never error, never block the session. Always exit 0.
# POSIX sh, jq-free — uses grep/sed only. Warnings go to stderr; incidental
# command errors are suppressed per-command so they never surface or block.

EXPECTED_VERSION='2026-07-14'

CLAUDE_MD="${HOME}/.claude/CLAUDE.md"

if [ ! -f "$CLAUDE_MD" ]; then
    echo "[recording-standard] No ~/.claude/CLAUDE.md found, so the Recording Standard block is not installed. Run the 'recording-standard' skill to install it." >&2
    exit 0
fi

# Pull the version date out of the START marker, if present.
MARKER_LINE=$(grep -E '<!-- RECORDING-STANDARD v[0-9]{4}-[0-9]{2}-[0-9]{2} START -->' "$CLAUDE_MD" 2>/dev/null | head -n 1)

if [ -z "$MARKER_LINE" ]; then
    echo "[recording-standard] The Recording Standard enforcement block is missing from ~/.claude/CLAUDE.md. Run the 'recording-standard' skill to install it." >&2
    exit 0
fi

INSTALLED=$(printf '%s\n' "$MARKER_LINE" | sed -E 's/.*<!-- RECORDING-STANDARD v([0-9]{4}-[0-9]{2}-[0-9]{2}) START -->.*/\1/')

# yyyy-MM-dd compares correctly with the dashes stripped and read as integers.
INSTALLED_NUM=$(printf '%s' "$INSTALLED" | tr -d '-')
EXPECTED_NUM=$(printf '%s' "$EXPECTED_VERSION" | tr -d '-')

# Guard the numeric comparison so a malformed date can't error the hook.
if [ -n "$INSTALLED_NUM" ] && [ "$INSTALLED_NUM" -lt "$EXPECTED_NUM" ] 2>/dev/null; then
    echo "[recording-standard] The installed Recording Standard block is stale (installed v${INSTALLED}, current v${EXPECTED_VERSION}). Re-run the 'recording-standard' skill to refresh it." >&2
    exit 0
fi

# Present and current: say nothing.
exit 0
