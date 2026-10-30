#!/usr/bin/env bash
# npm-go.sh: the one owner step for npm. Logs in through the npm web page, then publishes
# the 58 @theluckystrike/* estate packages (scripts/publish-all.sh) and the 9 data
# satellites (satellites/*), skipping any name@version already on the registry.
#
#   scripts/npm-go.sh          # login if needed, then publish for real
#   scripts/npm-go.sh --dry    # no login, dry-run pack of the 9 satellites only
set -uo pipefail
export npm_config_cache="${npm_config_cache:-/Users/mike/.npm-cache-local}"
export PATH="/opt/homebrew/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$ROOT/data/s1030/npm-publish.log"
DRY=0; [ "${1:-}" = "--dry" ] && DRY=1

if [ "$DRY" = 0 ] && ! npm whoami >/dev/null 2>&1; then
  echo "Opening the npm login page. Approve it in your browser, then this script continues."
  npm login --auth-type=web || { echo "npm login failed" >&2; exit 1; }
fi
[ "$DRY" = 0 ] && echo "npm user: $(npm whoami)" | tee -a "$LOG"

if [ "$DRY" = 0 ]; then
  "$ROOT/scripts/publish-all.sh" --go 2>&1 | tee -a "$LOG"
fi

ok=0; skip=0; fail=0
for dir in "$ROOT"/satellites/*/; do
  [ -f "$dir/package.json" ] || continue
  name=$(node -p "require('$dir/package.json').name"); ver=$(node -p "require('$dir/package.json').version")
  if npm view "$name@$ver" version >/dev/null 2>&1; then echo "SKIP $name@$ver already published" | tee -a "$LOG"; skip=$((skip+1)); continue; fi
  [ -f "$dir/dist/stdio.js" ] || { echo "FAIL $name missing dist/stdio.js" | tee -a "$LOG"; fail=$((fail+1)); continue; }
  if [ "$DRY" = 1 ]; then
    (cd "$dir" && npm publish --access public --dry-run >/dev/null 2>&1) && { echo "DRY-OK $name@$ver"; ok=$((ok+1)); } || { echo "DRY-FAIL $name"; fail=$((fail+1)); }
  else
    (cd "$dir" && npm publish --access public 2>&1 | tail -2 | tee -a "$LOG") && npm view "$name@$ver" version >/dev/null 2>&1 \
      && { echo "OK $name@$ver" | tee -a "$LOG"; ok=$((ok+1)); } || { echo "FAIL $name" | tee -a "$LOG"; fail=$((fail+1)); }
  fi
done
echo "satellites: ok=$ok skip=$skip fail=$fail" | tee -a "$LOG"
