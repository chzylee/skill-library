#!/bin/sh
# dev-build freshness check — SessionStart hook, advisory only, never blocks.
# Reports stale/orphaned deployed dev builds and which skills are ahead of stable.
# Fires only in sessions inside this repo (wired via .claude/settings.json).
# Configured by .dev-build.conf at the repo root (sh KEY="value"); sane defaults below.

REPO="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SKILLS_DIR="$HOME/.claude/skills"

skills_root="."
stable_branch="main"
dev_branch="dev"

# Parse the conf; never `.` it. Sourcing EXECUTES command substitution and
# backticks inside double-quoted values, and `release_steps` is documented as a
# PROSE list — prose is exactly where a $(...) or a backtick shows up innocently.
# A cloned repo's conf would then run arbitrary commands under the approval the
# user gave for "run dev-build-check.sh". install.mjs already reads it this way.
conf_get() {
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$2" 2>/dev/null | head -1
}
if [ -f "$REPO/.dev-build.conf" ]; then
  _v=$(conf_get skills_root   "$REPO/.dev-build.conf"); [ -n "$_v" ] && skills_root="$_v"
  _v=$(conf_get stable_branch "$REPO/.dev-build.conf"); [ -n "$_v" ] && stable_branch="$_v"
  _v=$(conf_get dev_branch    "$REPO/.dev-build.conf"); [ -n "$_v" ] && dev_branch="$_v"
fi

prefix=""
[ "$skills_root" != "." ] && prefix="$skills_root/"

command -v git >/dev/null 2>&1 || exit 0
git -C "$REPO" rev-parse --verify "$dev_branch" >/dev/null 2>&1 || exit 0

for d in "$SKILLS_DIR"/*-dev; do
  [ -d "$d" ] || continue
  f="$d/SKILL.md"
  [ -f "$f" ] || continue
  grep -q "generated-by: dev-build" "$f" || continue
  base=$(basename "$d")
  skill=${base%-dev}
  # only judge builds whose source skill belongs to THIS repo (on either branch)
  git -C "$REPO" cat-file -e "$dev_branch:$prefix$skill/SKILL.md" 2>/dev/null \
    || git -C "$REPO" cat-file -e "$stable_branch:$prefix$skill/SKILL.md" 2>/dev/null \
    || continue
  sha=$(sed -n 's/^generated-from: *//p' "$f" | head -1)
  if ! git -C "$REPO" cat-file -e "$dev_branch:$prefix$skill/SKILL.md" 2>/dev/null; then
    echo "dev-build: '$base' is an ORPHAN ('$skill' not on $dev_branch) — run /skill-ops status"
  elif [ -z "$sha" ] || ! git -C "$REPO" diff --quiet "$sha" "$dev_branch" -- "$prefix$skill" 2>/dev/null; then
    echo "dev-build: '$base' is STALE vs $dev_branch — run /skill-ops deploy $skill"
  fi
done

AHEAD=$(git -C "$REPO" diff --name-only "$stable_branch" "$dev_branch" -- "$skills_root" 2>/dev/null \
  | sed "s|^$prefix||" | awk -F/ '{print $1}' | sort -u \
  | grep -vE '^\.|^scripts$|^docs$|^dist$|^maintenance$|^hooks$|^record$|^README|^LICENSE|^CONTRIBUTING' \
  | tr '\n' ' ')
[ -n "$AHEAD" ] && echo "dev-build: ahead of $stable_branch on $dev_branch: $AHEAD"

exit 0
