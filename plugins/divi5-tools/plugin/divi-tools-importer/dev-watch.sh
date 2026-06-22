#!/usr/bin/env bash
# dev-watch.sh — auto-deploy plugin source to Local WP on .php file change.
# Watches the canonical source and rsyncs to the installed plugin on every save,
# then clears the Divi CSS cache so changes are immediately visible in the browser.
#
# Usage:
#   ./dev-watch.sh                              # deploy to default Local WP test site
#   ./dev-watch.sh /path/to/other/wp-content/plugins/divi-tools-importer
#
# Prerequisite: fswatch (brew install fswatch)
#
# Pair with deploy.sh (one-shot rsync) for non-watched deploys.

set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-/Users/boss/Local Sites/divi-5-airtable-plugin/app/public/wp-content/plugins/divi-tools-importer}"

# Cache dir = sibling of plugins/ under wp-content/ → wp-content/et-cache/
CACHE_DIR="$(dirname "$(dirname "$DEST")")/et-cache"

if ! command -v fswatch >/dev/null 2>&1; then
  echo "fswatch not found. Install with: brew install fswatch" >&2
  exit 1
fi

if [ ! -d "$DEST" ]; then
  echo "Error: deploy target not found: $DEST" >&2
  echo "Is the Local WP site running? Or pass a custom path as \$1." >&2
  exit 1
fi

trap 'echo ""; echo "Stopped watching."; exit 0' INT

echo "=== dev-watch: auto-deploy plugin to Local WP ==="
echo "Source:  $SRC"
echo "Target:  $DEST"
echo "Cache:   $CACHE_DIR"
echo "Press Ctrl-C to stop."
echo ""

# Initial deploy so the watcher starts from a known-good state.
if "${SRC}/deploy.sh" "$DEST" >/dev/null 2>&1; then
  echo "[$(date +%H:%M:%S)] initial deploy complete"
else
  echo "[$(date +%H:%M:%S)] initial deploy FAILED — continuing to watch anyway" >&2
fi
echo ""

# Watch .php files only. fswatch emits one null-delimited event per change.
# Each event triggers a full rsync (fast — ~200ms for this plugin size).
fswatch -0 --event Created --event Updated --event Removed \
  --exclude '.*' --include '\.php$' \
  "$SRC" | while IFS= read -r -d '' event; do
  if "${SRC}/deploy.sh" "$DEST" >/dev/null 2>&1; then
    # Clear Divi per-page + global CSS cache so preset/style changes render.
    if [ -d "$CACHE_DIR" ]; then
      find "$CACHE_DIR" -name '*.css' -delete 2>/dev/null || true
    fi
    echo "[$(date +%H:%M:%S)] deployed + cache cleared"
  else
    echo "[$(date +%H:%M:%S)] deploy FAILED — check deploy.sh output manually" >&2
  fi
done
