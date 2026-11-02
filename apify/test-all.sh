#!/bin/bash
# Local test of every Actor without an Apify account: apify run (Standby mode) + raw MCP client, then a normal-run self-check.
# Needs: node_modules installed in each Actor dir (npm install --omit=dev), apify-cli in ./.tools. No login, no network to Apify.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
APIFY="$HERE/.tools/node_modules/.bin/apify"
OUT="${1:-$HERE/test-results}"
mkdir -p "$OUT"
declare -a SPEC=(
 "section-179-deduction-calculator-mcp|3191|calculate_section_179|{\"tax_year\":2026,\"total_section_179_property_cost\":1500000}"
 "car-loan-interest-deduction-calculator-mcp|3192|calculate_car_loan_interest_deduction|{\"filing_status\":\"single\",\"magi\":105000,\"tax_year\":2026,\"interest_paid\":3200}"
 "subdomain-finder-mcp|3193|find_subdomains|{\"domain\":\"example.com\",\"limit\":5}"
 "ab-test-sample-size-calculator-mcp|3194|calculate_sample_size|{\"baseline_rate\":0.05,\"mde\":0.1}"
 "lake-level-mcp|3195|get_lake_level|{\"lake\":\"lake-mead\"}"
)
rc=0
for s in "${SPEC[@]}"; do
  IFS='|' read -r dir port tool args <<<"$s"
  cd "$HERE/$dir" || exit 1
  "$APIFY" validate-schema > "$OUT/$dir.validate.txt" 2>&1; echo "validate-schema exit=$?" >> "$OUT/$dir.validate.txt"
  APIFY_META_ORIGIN=STANDBY ACTOR_WEB_SERVER_PORT=$port timeout 90 "$APIFY" run > "$OUT/$dir.standby.log" 2>&1 &
  RUNPID=$!
  for i in $(seq 1 30); do curl -s -o /dev/null -H 'x-apify-container-server-readiness-probe: 1' "http://127.0.0.1:$port/" && break; sleep 1; done
  node "$HERE/test-local.mjs" "$port" "$tool" "$args" > "$OUT/$dir.mcp.json" 2>&1; r=$?
  echo "$dir mcp-test exit=$r"; [ $r -ne 0 ] && rc=1
  # stop only what this script started: children of the apify run process tree
  # (the listener on our test port is the Actor's node process; its SIGTERM handler closes the stdio children)
  lsof -tiTCP:"$port" -sTCP:LISTEN | xargs kill 2>/dev/null; sleep 1; kill "$RUNPID" 2>/dev/null; wait "$RUNPID" 2>/dev/null
  # normal (non-standby) run = self-check
  timeout 90 "$APIFY" run > "$OUT/$dir.selfcheck.log" 2>&1; r2=$?
  echo "$dir selfcheck exit=$r2"; [ $r2 -ne 0 ] && rc=1
  cp storage/key_value_stores/default/OUTPUT.json "$OUT/$dir.selfcheck-OUTPUT.json" 2>/dev/null
  rm -rf storage
done
exit $rc
