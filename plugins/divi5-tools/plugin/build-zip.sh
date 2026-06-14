#!/usr/bin/env bash
set -euo pipefail

# Build a clean WordPress plugin zip for Divi Tools Importer.
# Run from the repo root:
#   bash plugins/divi5-tools/plugin/build-zip.sh
#
# Output: divi-tools-importer.zip in the repo root.
# The zip contains a single top-level folder "divi-tools-importer/"
# with the plugin files inside — the format WordPress expects.

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
PLUGIN_DIR="${REPO_ROOT}/plugins/divi5-tools/plugin/divi-tools-importer"
OUTPUT_ZIP="${REPO_ROOT}/divi-tools-importer.zip"

if [[ ! -d "$PLUGIN_DIR" ]]; then
  echo "Plugin source not found: $PLUGIN_DIR" >&2
  exit 1
fi

cd "$(dirname "$PLUGIN_DIR")"

# Remove any existing zip so it cannot be accidentally nested.
rm -f "$OUTPUT_ZIP"

# Zip the plugin folder itself, excluding macOS metadata and any existing zips.
zip -r "$OUTPUT_ZIP" "$(basename "$PLUGIN_DIR")" \
  -x "*.DS_Store" \
  -x "*.zip" \
  -x "*/.git/*"

echo "Built: $OUTPUT_ZIP"
