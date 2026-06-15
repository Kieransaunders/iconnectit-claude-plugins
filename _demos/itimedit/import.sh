#!/usr/bin/env bash
# iTimedIT → LocalWP import helper (Divi Tools Importer).
# Run from your Mac (NOT the Claude sandbox — only your Mac can reach localhost:10015).
#
# Usage:
#   export DTI_KEY='dtik_xxx'          # paste your Divi Tools Importer API key
#   bash import.sh ping                # check connection + plugin
#   bash import.sh import              # create/update the DRAFT page
#   bash import.sh publish             # publish it live (only after you've reviewed)
set -euo pipefail

SITE="http://localhost:10015"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD="$DIR/payload.json"
: "${DTI_KEY:?Set DTI_KEY first:  export DTI_KEY='dtik_...'}"

cmd="${1:-ping}"
case "$cmd" in
  ping)
    curl -s "$SITE/wp-json/divi-tools/v1/ping?dti_key=$DTI_KEY" -w "\nHTTP %{http_code}\n"
    ;;
  import)
    curl -s -X POST "$SITE/wp-json/divi-tools/v1/import" \
      -H 'Content-Type: application/json' \
      -H "X-Divi-Tools-Key: $DTI_KEY" \
      -d @"$PAYLOAD" -w "\nHTTP %{http_code}\n"
    ;;
  publish)
    # same payload, publish:true
    tmp="$(mktemp)"; sed 's/"publish":false/"publish":true/' "$PAYLOAD" > "$tmp"
    curl -s -X POST "$SITE/wp-json/divi-tools/v1/import" \
      -H 'Content-Type: application/json' \
      -H "X-Divi-Tools-Key: $DTI_KEY" \
      -d @"$tmp" -w "\nHTTP %{http_code}\n"
    rm -f "$tmp"
    ;;
  *) echo "Unknown command: $cmd (use ping | import | publish)"; exit 1 ;;
esac
