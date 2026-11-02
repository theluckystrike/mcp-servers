#!/bin/bash
# S1102 follow-up KPI re-read. Run on or after 2026-11-04 (npm stats lag ~3 days).
#   bash ~/mcp-servers/data/s1102/remeasure.sh
# Re-runs the session's own measurement scripts; outputs land beside them (kpi/*.json, visibility/gh_raw.jsonl).
set -u
D=$(cd "$(dirname "$0")" && pwd)
cd "$D/kpi"
for s in npm.py cf.py gh.py gsc.py ga4.py; do echo "== $s"; timeout 600 python3 "$s" 2>&1 | tail -3; done
cd "$D/visibility" && echo "== gh_rank.sh (33 queries, 18 servers)" && timeout 1200 bash gh_rank.sh >/dev/null 2>&1
python3 - "$D/visibility/gh_raw.jsonl" <<'PY'
import json,sys
rows=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
r1=sum(1 for r in rows if r.get('rank')==1)
print(f"GitHub rank 1: {r1} of {len(rows)} queries (baseline 11-02: 26 of 30)")
PY
echo "Then compare with ../kpi.md (11-02 baseline) and write the result into data/sessions/."
