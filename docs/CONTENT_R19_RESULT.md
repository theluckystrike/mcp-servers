# Content round 19: /compare/per-diem, closing the compare_none note - 2026-09-05

status: DONE

## What shipped

Edited `billing/src/compare.js` (added the `per-diem` entry to `COMPARE`), `data/facts.json`
(removed `compare_none.per-diem`), and this result file. No other files touched.

## Registry check

`curl -s -m 15 "https://registry.modelcontextprotocol.io/v0/servers?search=com.1102tools/gsa-perdiem-mcp"`
returns three versions of one server. Latest (`isLatest: true`) is 1.0.9, published 2026-08-27, pypi
package `gsa-perdiem-mcp`, stdio transport, 7 tools, repo
`github.com/1102tools-dev/federal-contracting-mcps` subfolder `servers/gsa-perdiem-mcp`. The
`compare_none` note this round closes had recorded 1.0.8; the registry moved on since the 2026-09-05
probe that wrote it.

Also re-ran the registry search for `travel` and `expense per diem` per the task's "second
competitor" instruction: `expense per diem` and `travel per diem` return 0 results; `travel` alone
returns 30 rows, all flight/hotel/booking agents (Booking.com/Airbnb wrappers, award-flight search,
concierge planners) with no per diem or travel-allowance calculation among them. **One competitor was
found**, the same one the compare_none note already named.

## The competitor's README

The repo has no top-level `README.md` at that path (WebFetch 404'd); the actual file is lowercase
`readme.md`, found by listing the directory with the GitHub contents API and fetched over raw.
Facts pulled from it, dated 2026-09-05:

- Looks up: GSA Per Diem API rates by city/state/ZIP, an M&IE tier breakdown, a trip cost estimate,
  a multi-city comparison. Quoting the README: "Exposes the GSA Per Diem API plus a credential-readiness
  check as 7 MCP tools."
- Scheme: US GSA CONUS only, including the non-standard-area rates (cities priced above the
  standard rate), not just the standard table. Quoting: "CONUS only. Non-foreign OCONUS rates
  (Alaska, Hawaii, territories) are set by DoD (DTMO); foreign rates by the State Department."
- Network: live. Quoting: "This server hits `api.gsa.gov`... **Without a key**: falls back to the
  shared `DEMO_KEY` which is capped at **~10 requests per hour across everyone using it**... **With
  a personal key**: 1,000 requests per hour, yours alone."
- Install: `uvx gsa-perdiem-mcp`, no account required, an optional free api.data.gov key.
- Price: no pricing tier stated anywhere in the README; the tool itself is free.
- Licence: MIT, read from the repo's own `license` file (also lowercase), "Copyright (c) James
  Jenrette / 1102tools".

## The page

`/compare/per-diem`: a two-column fact table (Ours, gsa-perdiem-mcp; no third competitor exists),
covering what each looks up, schemes covered, network vs bundled, install path, price and licence,
plus "When to pick gsa-perdiem-mcp", "When to pick ours", "What we measured" (our Oman
substring-match defect against their stated 437-test, seven-round regression record, both quoted
from each project's own material) and install lines for both. Five FAQ entries, the last one naming
the exact README and registry source and the 2026-09-05 read date. Our facts (price, tools, free/pro
split) come from `servers/per-diem/README.md`, already in the repo.

## Quality gate

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|revolutionary|blazing|cutting-edge|leverage' on the new per-diem entry in billing/src/compare.js -> 0
    em dash count on the same lines                                                                                          -> 0
    non-ASCII count on the same lines                                                                                        -> 0
    node --check billing/src/compare.js                                                                                      -> syntax OK
    python3 json.load on data/facts.json                                                                                     -> parses
    Rendered /compare/per-diem HTML itself, checked for the same patterns and em dash                                        -> 0, 0

## Verification

    node scripts/release-check.mjs   -> green, 0 recorded gaps, 22 servers, 26 checks each
      (per-diem's `compare` check now passes because COMPARE["per-diem"] exists, not through the
       note; the note's removal is what makes this the real test rather than the 30-day grace path)
    cd billing && npm test           -> 73/73
    git pull --rebase --autostash    -> already up to date
    wrangler deploy                  -> mcp-billing, Version 04f606dd-88a3-4e44-8210-51f7fde66ad6

    curl -s -o /dev/null -w '%{http_code}' https://mcp.zovo.one/compare/per-diem  -> 200
    curl -s https://mcp.zovo.one/compare | grep -o 'href="/compare/per-diem"'     -> present
    curl -s https://mcp.zovo.one/compare/per-diem | grep -c seamless|powerful|... -> 0
    curl -s https://mcp.zovo.one/compare/per-diem | grep -cP '\x{2014}'          -> 0

    POST https://api.indexnow.org/IndexNow (key from data/indexnow.key, 2 URLs: /compare/per-diem,
      /compare) -> HTTP 200

## Left alone deliberately

The working tree carried a large amount of unrelated uncommitted work from other rounds (bundle
manifests, contract tests, remote/src, packages/mcp-license) when this round started. None of it was
touched, staged or committed here; only `billing/src/compare.js`, `data/facts.json` and this file
were staged for the commit this round makes.

Zero paid API calls.
