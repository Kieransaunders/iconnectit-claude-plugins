#!/bin/bash
# deploy.sh — sync plugin source to Local WP installation
# Usage: ./deploy.sh [/path/to/local-wp/plugins]

set -e

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-/Users/boss/Local Sites/divi-5-airtable-plugin/app/public/wp-content/plugins/divi-tools-importer}"

if [ ! -d "$DEST" ]; then
  echo "Error: destination not found: $DEST"
  echo "Usage: ./deploy.sh [/path/to/wp-content/plugins/divi-tools-importer]"
  exit 1
fi

rsync -av --delete \
  --exclude='.git' \
  --exclude='deploy.sh' \
  --exclude='dev-watch.sh' \
  --exclude='*.log' \
  "$SRC/" "$DEST/"

echo ""
echo "✓ Deployed to: $DEST"
