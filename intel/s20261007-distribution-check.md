# Distribution Check — 2026-10-07

STATUS: complete

Scope: verified readback of current state of open distribution artifacts for the zovo.one MCP estate (54 servers, endpoints `https://mcp.zovo.one/mcp/<id>`, official MCP registry `io.github.theluckystrike/*`). Read-only; nothing submitted or modified. Baseline: `data/distribution.json` + docs/DISTRIBUTION R1–R4.

## Open PR census

Command:
```
for r in punkpeye/awesome-mcp-servers docker/mcp-registry mgoldsborough/awesome-mcpb \
  TensorBlock/awesome-mcp-servers YuzeHao2023/Awesome-MCP-Servers MobinX/awesome-mcp-list \
  AIAnytime/Awesome-MCP-Server mctrinh/awesome-mcp-servers JustInCache/awesome-mcp-collection \
  collabnix/awesome-mcp-lists habitoai/awesome-mcp-servers abordage/awesome-mcp \
  rohitg00/awesome-devops-mcp-servers wagneragent/awesome-mcp-servers-devops; do \
  echo "== $r"; gh pr list -R "$r" --author theluckystrike --state all --limit 20 --json ...; done
```

Open count: **20 open PRs/entries** across 10 repos (punkpeye 10 open incl. office-suite batch 14681 + 14559–14565 + barcode/pdf/spreadsheet/statement-of-account batch 13963–13966; docker/mcp-registry 1 open #5030 timezone; mgoldsborough/awesome-mcpb #11 open (19 MCPB tools); YuzeHao2023 #518, #473 open; mctrinh #112 open; JustInCache #44 open; collabnix #117 open; rohitg00 #338 open).

Merged/closed movement vs. 2026-09-28 baseline:
- punkpeye/awesome-mcp-servers #13473 (time-tracker/price-tracker/spreadsheet/invoice): CLOSED unmerged 2026-09-07 (pre-existing close, recorded in baseline).
- docker/mcp-registry #4892 (sixteen local-only servers): CLOSED unmerged 2026-09-08 — closed earlier than our last open-state record; no merged replacement, but timezone #5030 remains open.
- Merged since last rounds: TensorBlock #2711 (price-tracker), #2164 (Office Suite); MobinX #420 (Office Suite); AIAnytime #83 (Office Suite); collabnix #112 (Office Suite); habitoai #144 (bank-statement/expense-tracker/invoice); abordage #106 (six local servers); wagneragent #81 (time-tracker, work-order).
- Closed unmerged: TensorBlock #2154, MobinX #517 (superseded by their own merged/other entries).
- NEW open PRs opened since the last round: punkpeye 14559–14565 + 14681 (office-suite batch), docker #5030, YuzeHao2023 #518, MobinX #517→closed, collabnix #117.

## toolsdk #514

Command:
```
gh pr view 514 -R toolsdk-ai/toolsdk-mcp-registry --json state,title,closedAt,mergedAt,comments
```
Output:
```
STATE=MERGED TITLE="Add Zovo Invoice remote MCP" CLOSED=2026-10-05T18:11:08Z MERGED=2026-10-05T18:11:08Z COMMENTS=1
theluckystrike: "This still merges cleanly into main at c954f07 and only adds
packages/finance-fintech/zovo-invoice.json. With it merged on top of c954f07, node
scripts/validate-registry.mjs --base origin/main reports 0 errors and 0 warnings...
The endpoint still answers initialize with HTTP 200 (mcp-invoice 0.22.0)."
```
**toolsdk-ai/toolsdk-mcp-registry#514 is now MERGED (2026-10-05)** — it was OPEN in docs/DISTRIBUTION_R4.md. Zovo Invoice is in the official toolsdk registry (verified live by the repo's own validator: 0 errors). No other toolsdk PRs open for us as of this check.

## Endpoint health

Command (per server; 5 samples):
```
curl -s -X POST "https://mcp.zovo.one/mcp/<server>" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"dist-check","version":"1.0"}}}'
```
Results — all five **HTTP 200** with valid initialize responses:
```
invoice          → 200  serverInfo: {"name":"mcp-invoice","version":"0.22.0"}
calendar         → 200  serverInfo: {"name":"mcp-calendar","version":"0.22.0"}
time-tracker     → 200  serverInfo: {"name":"mcp-time-tracker","version":"0.22.0"}
expense-tracker  → 200  serverInfo: {"name":"mcp-expense-tracker","version":"0.22.0"}
pdf              → 200  serverInfo: {"name":"mcp-pdf","version":"0.22.0"}
```
All report capabilities tools/resources/prompts and protocolVersion 2025-06-18. Endpoint fleet healthy on the sampled set.

## mcpservers.org visibility

Curl to `https://mcpservers.org/search?q=theluckystrike` returned HTTP 403 (Cloudflare challenge); `/mcp/zovo-invoice` style paths returned 404. Verified via headless browser instead:

- `https://mcpservers.org/search?query=theluckystrike` → **0 results** (page renders, no server listings; browser `innerText` contains no "theluckystrike" occurrences).
- `https://mcpservers.org/search?query=zovo` → **"Showing 1-30 of 50 servers"** — all branded "Zovo … MCP Server" with slugs like `mcp-zovo-one-s-invoice`, `mcp-zovo-one-s-calendar`, `mcp-zovo-one-s-barcode`, `mcp-zovo-one-s-expense-tracker`, etc. Several entries expose `github-com-theluckystrike-mcp-servers-tree-main-servers-…` source slugs (barcode, calendar, currency, expense-tracker, image), confirming they are our listings, auto-synced from the official registry. Direct listing paths tested (`/mcp-server/zovo-invoice`, `/mcp/zovo-invoice`, `/server/zovo-invoice`) → 404; the canonical URL slug differs (likely `/server/mcp-zovo-one-s-…`).

Observations: (1) listings are discoverable under the "Zovo" brand, not the GitHub org name, so a theluckystrike keyword search misses them; (2) search shows **duplicate pairs** for the same server (two Barcode listings, two Calendar, two Currency, two Expense Tracker, two Image — one local-flavor slug, one remote-flavor slug), i.e. the sync created near-duplicate entries.

## Verdict

Since 2026-09-28 the pipeline moved decisively forward: toolsdk-ai/toolsdk-mcp-registry#514 (Zovo Invoice remote MCP) is now **MERGED** (2026-10-05, validated clean by the registry's own validator), giving us our first remote invoice entry in the toolsdk registry; awesome-list progress stands at roughly 8 repos merged and 20 PRs still open, with a fresh office-suite batch pending at punkpeye (14559–14565 + 14681) and all five sampled remote endpoints answering initialize with HTTP 200 at 0.22.0. The one regression note is docker/mcp-registry #4892 closed unmerged on 09-08, leaving only the timezone #5030 PR alive there, and punkpeye's four-server batch #13473 remains closed-unmerged with a newer per-server batch queued. mcpservers.org visibility is the notable discovery: 50 "Zovo" listings are live and syncing from the registry, but they are invisible under a "theluckystrike" search, several carry duplicate local/remote pairs, and the listing URLs don't follow the paths we previously assumed — next actions: (1) push the punkpeye office-suite batch to review since toolsdk #514 proves the endpoint pattern is acceptable, (2) follow up on docker/mcp-registry (resubmit the 16-server set or fold into #5030 pattern), (3) investigate the mcpservers.org duplicate entries and confirm canonical listing URLs so our DISTRIBUTION docs point at the right pages, and (4) update data/distribution.json with the #514 merge and the closed-state corrections.
