#!/usr/bin/env bash
# 6h autonomous sprint loop — 12 sprints × 30min.
# Each sprint: registry publish-all, glama watch, KPI refresh, dashboard row, insight log.
set -u
cd "$(dirname "$0")/.."
ROOT="$PWD"
LOG="$ROOT/intel/sprints"
mkdir -p "$LOG"
TS() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

for i in $(seq 1 12); do
  START=$(date +%s)
  F="$LOG/sprint-$i-$(date -u +%H%M).md"
  {
    echo "# Sprint $i @ $(TS)"
    echo
  } > "$F"

  # 1. Registry publish-all (catches new versions, confirms 44 dup baseline)
  PUB=$(node scripts/registry-publish-all.mjs 2>&1 | grep -oE 'published [0-9]+, duplicate [0-9]+, failed [0-9]+' | tail -1)
  echo "registry: $PUB" >> "$F"

  # 2. KPI refresh
  KPI=$(node scripts/kpi.mjs 2>&1 | tail -1)
  echo "kpi: $KPI" >> "$F"
  # extract headline deltas
  node -e '
    const d=require("./data/kpi.json");
    const want=["Registry entries at latest version","Registry findable share","Distribution surfaces live","Googlebot URL coverage","ClaudeBot URL coverage"];
    for(const k of d.kpis) if(want.includes(k.name)) console.log(`  ${k.name}: ${k.value}/${k.target??"—"}`);
  ' >> "$F" 2>/dev/null

  # 3. Glama listing watch (fast probe: badge 200 = indexed)
  NEWGLAMA=0
  for s in goods-receipt leave onboarding purchase-requisition; do
    C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "https://glama.ai/mcp/servers/theluckystrike/mcp-$s/badges/score.svg")
    [ "$C" = "200" ] && NEWGLAMA=$((NEWGLAMA+1))
  done
  echo "glama new-server badges 200: $NEWGLAMA/4" >> "$F"

  # 4. Hosted endpoints health probe (sample 6)
  OK=0; for s in price-tracker time-tracker invoice packing-list credit-note office-suite-time-invoice-expense-excel-price; do
    C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "https://mcp.zovo.one/s/$s")
    [ "$C" = "200" ] && OK=$((OK+1))
  done
  echo "hosted sample 200: $OK/6" >> "$F"

  # 5. IndexNow resubmit homepage (keeps crawler attention)
  IN=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json" -d "{\"host\":\"zovo.one\",\"key\":\"$(cat data/indexnow.key)\",\"keyLocation\":\"https://zovo.one/$(cat data/indexnow.key).txt\",\"urlList\":[\"https://mcp.zovo.one/\",\"https://mcp.zovo.one/s/price-tracker\",\"https://mcp.zovo.one/s/time-tracker\"]}")
  echo "indexnow: $IN" >> "$F"

  ELAPSED=$(( $(date +%s) - START ))
  echo "duration: ${ELAPSED}s" >> "$F"
  echo "SPRINT $i DONE $(TS)" >> "$F"

  git add -A >/dev/null 2>&1
  git commit -m "sprint-loop $i: auto intel + kpi refresh" >/dev/null 2>&1
  git push >/dev/null 2>&1 || true

  # sleep ~24 min between sprints (6h / 12 minus work time)
  [ "$i" -lt 12 ] && sleep 1440
done
echo "LOOP_COMPLETE $(TS)"
