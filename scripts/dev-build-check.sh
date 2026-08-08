#!/bin/sh
# dev-build freshness check — SessionStart hook, advisory only, never blocks.
# Reports stale/orphaned deployed dev builds and which skills are ahead of main.
# Fires only in sessions inside this repo (wired via .claude/settings.json).

REPO="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SKILLS_DIR="$HOME/.claude/skills"

command -v git >/dev/null 2>&1 || exit 0
git -C "$REPO" rev-parse --verify dev >/dev/null 2>&1 || exit 0
DEV_HEAD=$(git -C "$REPO" rev-parse dev)

for d in "$SKILLS_DIR"/*-dev; do
  [ -d "$d" ] || continue
  f="$d/SKILL.md"
  [ -f "$f" ] || continue
  grep -q "generated-by: dev-build" "$f" || continue
  base=$(basename "$d")
  skill=${base%-dev}
  sha=$(sed -n 's/^generated-from: *//p' "$f" | head -1)
  if ! git -C "$REPO" cat-file -e "dev:$skill/SKILL.md" 2>/dev/null; then
    echo "dev-build: '$base' is an ORPHAN ('$skill' not on dev) — run /dev-build status"
  elif [ -z "$sha" ] || ! git -C "$REPO" diff --quiet "$sha" dev -- "$skill" 2>/dev/null; then
    echo "dev-build: '$base' is STALE vs dev — run /dev-build deploy $skill"
  fi
done

AHEAD=$(git -C "$REPO" diff --name-only main dev 2>/dev/null \
  | awk -F/ '{print $1}' | sort -u \
  | grep -vE '^\.|^scripts$|^docs$|^dist$|^maintenance$|^README|^LICENSE|^CONTRIBUTING' \
  | tr '\n' ' ')
[ -n "$AHEAD" ] && echo "dev-build: ahead of main on dev: $AHEAD"

exit 0
