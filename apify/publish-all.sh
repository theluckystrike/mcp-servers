#!/usr/bin/env bash
# publish-all.sh: log in with APIFY_TOKEN and push the 5 MCP Actors, then apply the Store fields the CLI does not push.
# NOT run yet: no Apify account exists. Read PUBLISH.md first (owner steps, Console clicks).
#
#   export APIFY_TOKEN=apify_api_...        # Console > Settings > API & Integrations
#   ./publish-all.sh                        # push all 5 + store config + smoke test
#   DRY_RUN=1 ./publish-all.sh              # print what would happen, touch nothing
#   ONLY=lake-level-mcp ./publish-all.sh    # one Actor
#   STORE_CONFIG=0 ./publish-all.sh         # push only (do SEO/categories/pricing in the Console)
#   SMOKE=0 ./publish-all.sh                # skip the live MCP call (it costs the owner a few cents of PPE + usage)
#   MAKE_PUBLIC=1 ./publish-all.sh          # also try isPublic=true via the API (default: stay private)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ACTORS=(
  section-179-deduction-calculator-mcp
  car-loan-interest-deduction-calculator-mcp
  subdomain-finder-mcp
  ab-test-sample-size-calculator-mcp
  lake-level-mcp
)
DRY_RUN="${DRY_RUN:-0}"; ONLY="${ONLY:-}"; STORE_CONFIG="${STORE_CONFIG:-1}"; SMOKE="${SMOKE:-1}"; MAKE_PUBLIC="${MAKE_PUBLIC:-0}"
API="https://api.apify.com/v2"

if [ -x "$HERE/.tools/node_modules/.bin/apify" ]; then APIFY="$HERE/.tools/node_modules/.bin/apify"
elif command -v apify >/dev/null 2>&1; then APIFY="$(command -v apify)"
else echo "apify CLI not found. Install: npm install --prefix '$HERE/.tools' apify-cli@1.11.0" >&2; exit 2; fi
command -v node >/dev/null || { echo "node not found" >&2; exit 2; }
command -v curl >/dev/null || { echo "curl not found" >&2; exit 2; }
: "${APIFY_TOKEN:?APIFY_TOKEN is not set. Create it in the Apify Console (Settings > API & Integrations) and export it, see PUBLISH.md}"

# Keep the token out of process lists: curl reads the header from a private file.
TMP="$(mktemp -d "${TMPDIR:-/tmp}/apify-publish.XXXXXX")"; chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT
umask 077; printf 'Authorization: Bearer %s\n' "$APIFY_TOKEN" > "$TMP/auth"

jget() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{let v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v?.[k];console.log(v??"")}catch{console.log("")}})' "$1"; }

# 1. Who owns the token?
if [ "$DRY_RUN" = 1 ]; then USERNAME="YOUR_USERNAME"; echo "[dry-run] would GET $API/users/me"
else
  code=$(curl -sS -o "$TMP/me.json" -w '%{http_code}' -H @"$TMP/auth" "$API/users/me")
  [ "$code" = 200 ] || { echo "Token rejected by Apify (HTTP $code). Check APIFY_TOKEN." >&2; exit 3; }
  USERNAME="$(jget data.username < "$TMP/me.json")"
  echo "Apify account: $USERNAME"
fi

# 2. CLI login (stores the token in the OS keyring or ~/.apify/auth.json; remove later with: apify logout)
if [ "$DRY_RUN" = 1 ]; then echo "[dry-run] would run: apify login --token ***"
else "$APIFY" login --token "$APIFY_TOKEN"; fi

fail=0
for name in "${ACTORS[@]}"; do
  if [ -n "$ONLY" ] && [ "$ONLY" != "$name" ]; then continue; fi
  dir="$HERE/$name"
  echo; echo "=== $name"
  # 3. Push: creates the Actor on first push (title, description, Standby on) and builds it
  if [ "$DRY_RUN" = 1 ]; then echo "[dry-run] would run: (cd $dir && apify push)"
  else
    if ! (cd "$dir" && "$APIFY" push); then echo "PUSH FAILED: $name" >&2; fail=1; continue; fi
  fi

  # 4. Store fields the CLI does not push (seo, categories, standby tuning, pay-per-event pricing).
  #    Body comes from $dir/.actor/store-config.json. UNTESTED (no account): if a call is rejected, the script
  #    prints the HTTP error and you do the same step by hand in the Console (PUBLISH.md, part 3).
  if [ "$STORE_CONFIG" = 1 ]; then
    if [ "$DRY_RUN" = 1 ]; then
      echo "[dry-run] would PUT $API/acts/$USERNAME~$name  (metadata: title, description, seoTitle, seoDescription, categories, actorStandby)"
      echo "[dry-run] would PUT $API/acts/$USERNAME~$name  (pricingInfos: PAY_PER_EVENT tool-call)"
    else
      node -e '
        const c=JSON.parse(require("fs").readFileSync(process.argv[1]+"/.actor/store-config.json","utf8"));
        const {pricingInfos,...meta}=c; if(process.argv[2]==="1") meta.isPublic=true;
        require("fs").writeFileSync(process.argv[3]+"/meta.json",JSON.stringify(meta));
        require("fs").writeFileSync(process.argv[3]+"/pricing.json",JSON.stringify({pricingInfos}));
      ' "$dir" "$MAKE_PUBLIC" "$TMP"
      for part in meta pricing; do
        code=$(curl -sS -o "$TMP/$part.out" -w '%{http_code}' -X PUT -H @"$TMP/auth" -H 'Content-Type: application/json' \
          --data @"$TMP/$part.json" "$API/acts/$USERNAME~$name")
        if [ "$code" = 200 ]; then echo "store config ($part): OK"
        else echo "store config ($part): HTTP $code -> $(jget error.message < "$TMP/$part.out"). Do this part in the Console (PUBLISH.md part 3)." >&2; fail=1; fi
      done
    fi
  fi

  # 5. Smoke test the deployed Standby endpoint: initialize + tools/list + one tools/call (billed to the owner's own account)
  if [ "$SMOKE" = 1 ]; then
    tool="$(jget sampleTool < "$dir/actor.config.json")"
    args="$(node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).sampleArgs))' "$dir/actor.config.json")"
    url="https://${USERNAME}--${name}.apify.actor/mcp"
    if [ "$DRY_RUN" = 1 ]; then echo "[dry-run] would run: node test-local.mjs $url $tool '$args'"
    else
      echo "smoke test $url (a cold Standby start can take up to 2 minutes)"
      node "$HERE/test-local.mjs" "$url" "$tool" "$args" > "$TMP/smoke.json" && echo "smoke: PASS" || { echo "smoke: FAIL"; cat "$TMP/smoke.json" >&2; fail=1; }
    fi
  fi
done

echo
if [ "$fail" = 0 ]; then echo "Done. Next: Console steps in PUBLISH.md part 3 (pricing, Publish on Store) for anything marked above."
else echo "Finished with problems (see messages above)." >&2; fi
exit "$fail"
