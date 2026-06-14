#!/usr/bin/env bash
# setup-github.sh — initialise git and publish this marketplace to GitHub.
#
# Run this in your OWN Terminal (not inside Cowork), from the repo folder:
#   cd "/Volumes/External/iConnectIT claude plugins"
#   bash setup-github.sh
#
# Requires: git, and (for the automatic GitHub step) the GitHub CLI `gh`,
# authenticated via `gh auth login`. If you don't have gh, see the manual
# fallback at the bottom.

set -euo pipefail

REPO_NAME="iconnectit-claude-plugins"
VISIBILITY="public"   # change to "private" if you prefer

# Fresh git repo (the partial .git created elsewhere is discarded).
rm -rf .git
git init -b main
git config user.name "Kieran"
git config user.email "kieran@iconnectit.co.uk"
git add -A
git commit -m "Initial commit: iConnectIT Claude plugins marketplace (divi5-tools, wp-dev-tools)"

if command -v gh >/dev/null 2>&1; then
  echo "Creating GitHub repo via gh…"
  gh repo create "$REPO_NAME" --"$VISIBILITY" --source=. --remote=origin --push
  echo "Done. Repo: $(gh repo view --json url -q .url)"
else
  cat <<'EOF'

gh CLI not found. Either install it (brew install gh && gh auth login) and
re-run this script, or finish manually:

  1. Create an empty repo at https://github.com/new named:
     iconnectit-claude-plugins  (no README/licence/gitignore)
  2. Then run:
     git remote add origin https://github.com/Kieransaunders/iconnectit-claude-plugins.git
     git push -u origin main
EOF
fi
