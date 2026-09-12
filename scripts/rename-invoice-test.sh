#!/usr/bin/env bash
# rename-invoice-test.sh -- execute the R1 rename experiment prepared in
# docs/RENAME_TEST_PLAN_R1.md: rename the mirror repo theluckystrike/mcp-invoice to
# theluckystrike/mcp-invoice-generator and re-sync that one mirror, with the baseline
# already captured at data/rename_test_baseline.json (measured 2026-09-11T18:20:01Z).
#
# What this script touches: exactly one GitHub repo name, one new data file
# (data/mirror_repo_overrides.json), one field in data/distribution.json, four URLs in
# docs/HUMAN_GATED_PACK.md, and one mirror re-sync. What it never touches: the registry
# name io.github.theluckystrike/invoice-pdf-billing-generator (immutable), the npm package
# name @theluckystrike/mcp-invoice, servers/, or the generator scripts themselves (the
# override hook must already exist in them; step 2 refuses to continue otherwise).
#
# Usage:
#   scripts/rename-invoice-test.sh        # forward: rename + updates + re-sync + T0 measure
#   ROLLBACK=1 scripts/rename-invoice-test.sh   # rename back and revert the data files
#   MEASURE_ONLY=t14d scripts/rename-invoice-test.sh  # skip everything, just re-measure
#
# Every step is idempotent: re-running after a partial failure picks up where it stopped.
# /usr/bin/grep only (grep is a broken shell function on this machine). No emoji.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export ROOT

OWNER="theluckystrike"
OLD="mcp-invoice"
NEW="mcp-invoice-generator"
OVERRIDES="data/mirror_repo_overrides.json"
BASELINE="data/rename_test_baseline.json"

say() { echo ""; echo "== $*"; }

# ---------------------------------------------------------------------------
# Measurement block, shared by the T0 read at the end of a forward run and by
# MEASURE_ONLY runs at T+3d / T+7d / T+14d. Writes data/rename_test_<label>.json
# in the baseline schema. Read-only: gh api search calls only.
# ---------------------------------------------------------------------------
measure() {
  local label="$1"
  say "measure: query set -> data/rename_test_${label}.json (read-only gh api)"
  LABEL="$label" python3 - <<'PY'
import json, os, re, subprocess, time

label = os.environ["LABEL"]
queries = ["mcp invoice generator", "mcp quotes", "mcp deposits"]

def gh(args):
    return subprocess.run(["gh"] + args, capture_output=True, text=True, check=True).stdout

def coverage(name, q):
    toks = [t for t in re.split(r"[^a-z0-9]+", name.lower()) if t]
    qts = q.split()
    hit = 0
    for qt in qts:
        if any(t == qt or t == qt.rstrip("s") or t.startswith(qt) for t in toks):
            hit += 1
    return round(hit / len(qts), 3)

def exact(name, q):
    norm = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return norm == q.replace(" ", "-")

rows = []
for q in queries:
    cmd = ["api", "-X", "GET", "search/repositories", "-f", "q=%s" % q, "-f", "per_page=10"]
    r = json.loads(gh(cmd))
    top10 = [{"rank": i + 1,
              "full_name": it["full_name"],
              "stars": it["stargazers_count"],
              "name_token_coverage": coverage(it["full_name"].split("/")[-1], q),
              "exact_phrase": exact(it["full_name"].split("/")[-1], q),
              "description": it["description"]}
             for i, it in enumerate(r["items"])]
    loc = json.loads(gh(["api", "-X", "GET", "search/repositories", "-f", "q=%s" % q,
                         "-f", "per_page=100"]))
    estate = None
    for i, it in enumerate(loc["items"]):
        if it["owner"]["login"].lower() == "theluckystrike":
            estate = {"full_name": it["full_name"], "stars": it["stargazers_count"],
                      "present_in_top10": i < 10,
                      "top10_rank": (i + 1) if i < 10 else None,
                      "top100_rank": i + 1}
            break
    rows.append({"query": q,
                 "command": "gh api -X GET search/repositories -f q='%s' -f per_page=10" % q,
                 "total_count": r["total_count"], "top10": top10,
                 "estate_repo": estate or "absent from top 100"})
    print("  %-22s total=%-4s estate=%s" % (q, r["total_count"],
          estate and "%s @ top100 rank %d" % (estate["full_name"], estate["top100_rank"])))
    time.sleep(3)  # 30 authenticated search requests per minute

out = {"experiment": "rename-one-mirror-r1", "phase": label,
       "measured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
       "queries": rows}
path = "data/rename_test_%s.json" % label
json.dump(out, open(path, "w"), indent=2)
open(path, "a").write("\n")
print("  wrote %s" % path)
PY
}

# ---------------------------------------------------------------------------
# MEASURE_ONLY: used for the scheduled T+3d / T+7d / T+14d reads.
# ---------------------------------------------------------------------------
if [ -n "${MEASURE_ONLY:-}" ]; then
  measure "$MEASURE_ONLY"
  say "redirect health probe"
  gh api "repos/$OWNER/$OLD" --jq .full_name | sed 's/^/  old name resolves to: /'
  exit 0
fi

# ---------------------------------------------------------------------------
# ROLLBACK
# ---------------------------------------------------------------------------
if [ "${ROLLBACK:-0}" = "1" ]; then
  say "ROLLBACK: rename $NEW back to $OLD and revert the data files"

  say "rollback 1/6: current state (read-only)"
  # gh follows rename redirects, so existence proves nothing; compare the CANONICAL name.
  CANON="$(gh api "repos/$OWNER/$OLD" --jq .name 2>/dev/null || echo MISSING)"
  if [ "$CANON" = "$OLD" ]; then
    echo "  repos/$OWNER/$OLD canonical name is $OLD; rename-back not needed, skipping"
  else
    echo "  old name currently redirects to $CANON; renaming $OWNER/$NEW back to $OLD"
    gh repo rename "$OLD" --repo "$OWNER/$NEW" --yes
    echo "  done: $(gh api "repos/$OWNER/$OLD" --jq .full_name)"
  fi

  say "rollback 2/6: remove the invoice entry from $OVERRIDES"
  python3 - <<'PY'
import json, os
p = "data/mirror_repo_overrides.json"
o = json.load(open(p)) if os.path.exists(p) else {}
if "invoice" in o:
    del o["invoice"]
    json.dump(o, open(p, "w"), indent=2)
    open(p, "a").write("\n")
    print("  removed invoice override; generator now derives mcp-invoice again")
else:
    print("  no invoice override present; nothing to do")
PY

  say "rollback 3/6: revert data/distribution.json github-mirror field"
  python3 - <<'PY'
import json
p = "data/distribution.json"
d = json.load(open(p))
cur = d["per_server"]["invoice"]["github-mirror"]
new = "synced https://github.com/theluckystrike/mcp-invoice"
if cur != new:
    d["per_server"]["invoice"]["github-mirror"] = new
    json.dump(d, open(p, "w"), indent=2)
    open(p, "a").write("\n")
    print("  reverted: %s -> %s" % (cur, new))
else:
    print("  already reverted; nothing to do")
PY

  say "rollback 4/6: revert docs/HUMAN_GATED_PACK.md URLs"
  python3 - <<'PY'
p = "docs/HUMAN_GATED_PACK.md"
t = open(p).read()
n = t.replace("github.com/theluckystrike/mcp-invoice-generator", "github.com/theluckystrike/mcp-invoice")
n = n.replace("mcp.directory/servers/theluckystrike/mcp-invoice-generator", "mcp.directory/servers/theluckystrike/mcp-invoice")
if n != t:
    open(p, "w").write(n)
    print("  reverted HUMAN_GATED_PACK.md URLs")
else:
    print("  no renamed URLs present; nothing to do")
PY

  say "rollback 5/6: re-sync the mirror under its original name"
  echo "  running: scripts/sync-mirrors.sh invoice"
  scripts/sync-mirrors.sh invoice

  say "rollback 6/6: verify"
  gh api "repos/$OWNER/$OLD" --jq '.full_name + "  homepage=" + .homepage' | sed 's/^/  /'
  echo "  NOTE: $OWNER/$NEW now redirects to $OWNER/$OLD (harmless; GitHub keeps the chain)."
  echo "  NOTE: re-baseline before any further experiment: data/rename_test_baseline.json describes the pre-rename field."

  say "ROLLBACK complete"
  exit 0
fi

# ---------------------------------------------------------------------------
# FORWARD
# ---------------------------------------------------------------------------
say "rename-invoice-test: forward run at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

say "step 1/8: preflight (all read-only)"
gh auth status >/dev/null 2>&1 || { echo "FATAL: gh not authenticated" >&2; exit 1; }
echo "  gh auth: ok"
[ -f "$BASELINE" ] || { echo "FATAL: $BASELINE missing; measure the baseline first (docs/RENAME_TEST_PLAN_R1.md)" >&2; exit 1; }
echo "  baseline: $BASELINE present"
CANON_NEW="$(gh api "repos/$OWNER/$NEW" --jq .name 2>/dev/null || echo MISSING)"
if [ "$CANON_NEW" = "$NEW" ]; then
  echo "  repos/$OWNER/$NEW canonical name is $NEW: rename already happened; the rename step will be skipped"
  ALREADY_RENAMED=1
else
  ALREADY_RENAMED=0
  gh api "repos/$OWNER/$OLD" --jq .name | sed 's/^/  current name: /'
fi

say "step 2/8: override map + generator-hook gate"
python3 - <<'PY'
import json, os
p = "data/mirror_repo_overrides.json"
o = json.load(open(p)) if os.path.exists(p) else {}
if o.get("invoice") == "mcp-invoice-generator":
    print("  %s already maps invoice -> mcp-invoice-generator" % p)
else:
    o["invoice"] = "mcp-invoice-generator"
    json.dump(o, open(p, "w"), indent=2)
    open(p, "a").write("\n")
    print("  wrote %s: invoice -> mcp-invoice-generator" % p)
PY
GATE_FAIL=0
for f in scripts/sync-mirrors.sh scripts/apply-mirror-seo.mjs scripts/mirror-seo.py; do
  if /usr/bin/grep -q "mirror_repo_overrides" "$f"; then
    echo "  hook present: $f"
  else
    echo "  MISSING hook: $f does not read data/mirror_repo_overrides.json" >&2
    GATE_FAIL=1
  fi
done
if [ "$GATE_FAIL" = "1" ]; then
  cat >&2 <<'EOF'
FATAL: the mirror generator derives the repo name from the server directory name
(sync-mirrors.sh:191 REPO="mcp-$NAME", apply-mirror-seo.mjs:74, mirror-seo.py:304).
Without the override hook, the next sync targets the OLD name through the redirect and
re-stamps old-name clone URLs into the renamed repo's README. The designed one-line
patch per file is in docs/RENAME_TEST_PLAN_R1.md, section "The override design".
Land it first, then re-run this script. The rename has NOT been performed.
EOF
  exit 3
fi

say "step 3/8: rename $OWNER/$OLD -> $NEW"
if [ "$ALREADY_RENAMED" = "1" ]; then
  echo "  skipped: already renamed"
else
  # gh repo rename <new-name> -R OWNER/REPO --yes. Equivalent API primitive, kept here
  # for reference: gh api -X PATCH repos/$OWNER/$OLD -f name=$NEW
  gh repo rename "$NEW" --repo "$OWNER/$OLD" --yes
  echo "  renamed: $(gh api "repos/$OWNER/$NEW" --jq .full_name)"
fi

say "step 4/8: verify the rename and the redirect (all read-only)"
GOT="$(gh api "repos/$OWNER/$NEW" --jq .name)"
[ "$GOT" = "$NEW" ] || { echo "FATAL: repos/$OWNER/$NEW .name is $GOT" >&2; exit 4; }
echo "  repos/$OWNER/$NEW .name = $GOT"
REDIR="$(gh api "repos/$OWNER/$OLD" --jq .full_name)"
echo "  API follows old name to: $REDIR"
[ "$REDIR" = "$OWNER/$NEW" ] || { echo "FATAL: old name does not resolve to the new one" >&2; exit 4; }
curl -sI "https://github.com/$OWNER/$OLD" | /usr/bin/grep -i '^location' | sed 's/^/  web redirect: /'
git ls-remote "https://github.com/$OWNER/$OLD.git" HEAD | sed 's/^/  git ls-remote via old name: /'
echo "  metadata carried over by GitHub (stars, releases, description, topics, homepage):"
gh api "repos/$OWNER/$NEW" --jq '"    stars=" + (.stargazers_count|tostring) + "  homepage=" + .homepage + "  description=" + (.description // "" | .[0:60]) + "..."'

say "step 5/8: data/distribution.json github-mirror field"
python3 - <<'PY'
import json
p = "data/distribution.json"
d = json.load(open(p))
cur = d["per_server"]["invoice"]["github-mirror"]
new = "synced https://github.com/theluckystrike/mcp-invoice-generator"
if cur == new:
    print("  already updated; nothing to do")
else:
    d["per_server"]["invoice"]["github-mirror"] = new
    json.dump(d, open(p, "w"), indent=2)
    open(p, "a").write("\n")
    print("  updated: %s -> %s" % (cur, new))
    print("  (dated round-note prose elsewhere in the file is append-only log text; left as is)")
PY

say "step 6/8: docs/HUMAN_GATED_PACK.md submission URLs"
python3 - <<'PY'
import re
p = "docs/HUMAN_GATED_PACK.md"
t = open(p).read()
n = re.sub(r"github\.com/theluckystrike/mcp-invoice(?!-generator)\b",
           "github.com/theluckystrike/mcp-invoice-generator", t)
n = re.sub(r"mcp\.directory/servers/theluckystrike/mcp-invoice(?!-generator)\b",
           "mcp.directory/servers/theluckystrike/mcp-invoice-generator", n)
if n != t:
    open(p, "w").write(n)
    print("  updated %d URL(s) so the operator submits the canonical new name"
          % (len(re.findall(r"mcp-invoice-generator", n)) - len(re.findall(r"mcp-invoice-generator", t))))
else:
    print("  already updated; nothing to do")
PY

say "step 7/8: re-sync the one mirror"
echo "  running: scripts/sync-mirrors.sh invoice"
echo "  (with the override hook, REPO resolves to $NEW; description/topics/homepage are"
echo "   re-asserted on the renamed repo, and the README/MIRROR.md clone URLs are re-stamped"
echo "   with the new name. Version is unchanged, so the tag already exists and is left alone.)"
scripts/sync-mirrors.sh invoice

say "step 8/8: post-sync verification (all read-only)"
gh api "repos/$OWNER/$NEW" --jq '"  name=" + .name + "  homepage=" + .homepage'
COUNT="$(gh api "repos/$OWNER/$NEW/readme" --jq .content | base64 -d | /usr/bin/grep -c "$NEW" || true)"
echo "  mirror README mentions of $NEW: $COUNT (expect >= 1: the clone URL)"
[ "$COUNT" -ge 1 ] || echo "  WARNING: mirror README does not carry the new clone URL; check the mirror-seo.py hook" >&2

measure t0

say "forward run complete"
echo "  treatment: $OWNER/$OLD -> $OWNER/$NEW (old name redirects; verified above)"
echo "  next reads: MEASURE_ONLY=t3d  scripts/rename-invoice-test.sh   (T0 + 3 days)"
echo "              MEASURE_ONLY=t7d  scripts/rename-invoice-test.sh   (T0 + 7 days, primary)"
echo "              MEASURE_ONLY=t14d scripts/rename-invoice-test.sh   (T0 + 14 days, confirmation)"
echo "  success criterion and control bands: docs/RENAME_TEST_PLAN_R1.md"
echo "  rollback: ROLLBACK=1 scripts/rename-invoice-test.sh"
