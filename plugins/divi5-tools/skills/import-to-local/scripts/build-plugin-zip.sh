#!/usr/bin/env bash
# Builds the installable Divi Tools Importer plugin zip from the canonical
# unpacked source at plugins/divi5-tools/plugin/divi-tools-importer/.
#
# The zip is built on demand rather than committed: the Claude Code plugin
# installer rejects packages that contain a nested .zip. Paths are resolved
# relative to this script (no git required), so it works from an installed
# plugin too. Prints the path to the finished zip on stdout.
set -euo pipefail
src="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../plugin" && pwd)"
[ -d "$src/divi-tools-importer" ] || { echo "source not found: $src/divi-tools-importer" >&2; exit 1; }
dest="${1:-$(mktemp -d)}"
mkdir -p "$dest"
out="$dest/divi-tools-importer.zip"
rm -f "$out"
( cd "$src" && zip -qr "$out" divi-tools-importer -x "*.DS_Store" -x "*.zip" -x "*/.git/*" )
echo "$out"
