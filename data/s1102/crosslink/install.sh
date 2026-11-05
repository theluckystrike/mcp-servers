#!/bin/bash
export npm_config_cache=/Users/mike/.npm-cache-local
cd /Users/mike/mcp-servers/data/s1102/crosslink
for r in lakelevelnow noovertimetax dscrradar ukmoneycalc statewage goldgramprice; do
  echo "== $r $(date +%T)"
  (cd src-$r && timeout 600 /Users/mike/bin/buildslot npm ci --no-audit --no-fund 2>&1 | tail -3)
done
echo DONE
