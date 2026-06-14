#!/usr/bin/env bash
# wp.sh — run a WP-CLI command against a Local (localwp.com) site.
#
# Usage: wp.sh <site-id> <site-public-dir> <wp args...>
#   e.g. wp.sh abc123 "/Users/me/Local Sites/mysite/app/public" option get siteurl
#
# Mechanism: Local writes a per-site environment script at
#   <LocalData>/ssh-entry/<site-id>.sh
# which exports PATH/env pointing at the site's bundled PHP, MySQL and WP-CLI.
# That script may end by exec-ing an interactive shell, so we do NOT source it
# directly — we extract and eval only its environment lines (export / PATH=),
# then run wp in the site's public dir.
#
# The site must be RUNNING in Local (its MySQL socket must be up).

set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: wp.sh <site-id> <site-public-dir> <wp args...>" >&2
  exit 1
fi

SITE_ID="$1"
PUBLIC_DIR="$2"
shift 2

LOCAL_DATA="${LOCAL_DATA_DIR:-$HOME/Library/Application Support/Local}"
ENTRY="$LOCAL_DATA/ssh-entry/$SITE_ID.sh"

if [ ! -f "$ENTRY" ]; then
  echo "No Local ssh-entry script for site '$SITE_ID' at:" >&2
  echo "  $ENTRY" >&2
  echo "Open the site in Local once (Site Shell) to generate it, or check the site id." >&2
  exit 2
fi

if [ ! -d "$PUBLIC_DIR" ]; then
  echo "Site public dir not found: $PUBLIC_DIR" >&2
  exit 2
fi

# Pull only environment setup out of the entry script (skip cd/exec/interactive bits).
ENV_LINES="$(grep -E '^(export |PATH=|MYSQL_HOME=|PHPRC=|WP_CLI_)' "$ENTRY" || true)"
if [ -z "$ENV_LINES" ]; then
  echo "Warning: no env lines extracted from $ENTRY — falling back to sourcing it." >&2
  # shellcheck disable=SC1090
  source "$ENTRY"
else
  eval "$ENV_LINES"
fi

cd "$PUBLIC_DIR"

if ! command -v wp >/dev/null 2>&1; then
  echo "wp-cli not on PATH after loading Local env. Inspect $ENTRY and adjust the env extraction." >&2
  exit 3
fi

exec wp "$@"
