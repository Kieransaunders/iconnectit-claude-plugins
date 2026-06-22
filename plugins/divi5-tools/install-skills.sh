#!/bin/bash
# install-skills.sh — copies all divi5-tools skills into ~/.claude/skills/
# Usage: bash install-skills.sh

set -e

SKILLS_DIR="$HOME/.claude/skills"
SRC="$(cd "$(dirname "$0")/skills" && pwd)"

mkdir -p "$SKILLS_DIR"

for skill in "$SRC"/*/; do
  name=$(basename "$skill")
  dest="$SKILLS_DIR/$name"
  cp -r "$skill" "$dest"
  echo "✓ installed $name → $dest"
done

echo ""
echo "Done. Restart Claude Code to pick up the new skills."
echo "Available: $(ls "$SRC" | tr '\n' ' ')"
