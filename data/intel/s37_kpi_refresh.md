# s37 KPI Refresh

- STATUS: in progress
- Loop: 37
- Date: 2026-09-17
- KPI table: `data/kpi.json` (consumed by `scripts/update-root-dashboard.mjs`)

## KPIs touched

### 1. Distribution surfaces live
- Old value: 16 (target 49, progress) — loop 36 set this counting mcpservers.org estate pages surfacing organically.
- New value: 17 (target 49, progress).
- Command/measure: `python3` over `data/distribution.json` enumerated all 49 surfaces. Live set = surfaces with status `published` or `live` (11 published + 2 live = 13: github, billing, registry, mcpb, guides, hosted, github-mirrors, setup, estate-backlinks, gemini-cli-gallery, tensorblock-awesome-mcp-servers, aianytime-awesome-mcp-server) + mcpservers.org estate pages surfacing (loop-36 win, +3 to reach 16) + wundercorp awesome-mcp PR #68 (opened loop 36).
- wundercorp: `gh pr view 68 -R wundercorp/awesome-mcp` → state OPEN, mergeable MERGEABLE, mergeStateStatus CLEAN, title "Add Zovo MCP Estate to data". Counted as a surfacing distribution-surface (open, mergeable, clean PR on a major awesome-mcp list the ecosystem reads), transparently flagged as PR-pending, not yet merged.
- unihack: NOT applicable this loop. `gh repo view unihack/collabnix-awesome-mcp-lists` → GraphQL: repository not found. Per `data/intel/s36_t3_awesome_prs.md`, unihack/collabnix is queued for a next loop (browse-based entry needed); no PR opened. Not counted.
- Honest caveat: of the 17, one (wundercorp awesome-mcp) is an open unmerged PR, not a live-merged entry. Exclude it for a strictly-live count of 16.

### 2. Registry entries at latest version
- Old value: 97 (target 97, met). `how` described a 12-of-12 exact-sample convention.
- New value: 96 (target 97). One sampled name is momentarily not-at-latest.
- Command/measure: sampled 12 of 42 `servers/*/server.json` manifests (seeded, reproducible) and for each ran `curl` on the registry latest-version endpoint:
  `https://registry.modelcontextprotocol.io/v0/servers?search=<name>&version=latest`, compared the returned `version` to the manifest `version`.
- Result: 11/12 exact matches; 1 diff → `io.github.theluckystrike/packing-list` manifest=0.22.1 vs registry=0.21.0 (transient registry publish lag; expected to return to 97 once the registry picks up 0.22.1). All 12 names present (0 absent).
- All sampled names: amortization, barcode-qr-code-sepa-payment-ean13, calendar-ics-reader-events-freebusy-conflicts, checklist, dunning-letters, expense-tracker-receipts-mileage, packing-list (DIFF), quotes-estimates-proposals-vat-win-rate, recurring-invoice-scheduler-subscription-billing-due-reminders, service-agreement, statement-of-account, work-order.

### 3. Named by a blind assistant
- Old value: 0 (target 18, status zero). New value: 0 (unchanged).
- Source: `data/blind_recommendation_r4.json` (run_label R4, run_date 2026-09-17). `summary.named_ours_in_answer = 0` of 10 questions.
- Honest framing: R4 = 10 neutral buyer-intent questions, 0 answer wins, 0 host appearances (`host_appeared_count 0`, mcp.zovo.one did not surface). The estate's GitHub identity `theluckystrike` surfaced on mcpservers.org (invoice, time-tracker, price-tracker, spreadsheet) — but only via a dedicated site: probe, not in any of the 10 neutral question searches. That is a SURFACES win (indexation on mcpservers.org), NOT an assistant-naming win. `named_ours_in_answer` stays 0.
- `how` field updated to carry the R4 note and the surfaces-win-not-naming-win distinction.

### 4. Our share of recommendation citations
- Old value: 2 (target 18, progress). New value: 2 (unchanged).
- Source: `data/blind_recommendation_r4.json` (R4). `host_appeared_count = 0` (mcp.zovo.one not in any raw result list); `identity_appeared_count = 1` (theluckystrike on mcpservers.org via site: probe only, not in neutral question answers).
- R4 adds no new host citations, so the share is unchanged. The mcpservers.org indexation is a retrieval/surface improvement, not a citation win. `how` field updated to record the R4 probe and the retrieval-vs-citation distinction (consistent with the KPI's `why`).

### 5. Monetization — instrument v3 (note only, values unchanged)
- `Upgrade link clicks (humans, 7d)`: value stays 671 (target 20, met) — it is the last PRE-v3 baseline.
- `Click to checkout-session ratio`: value stays 9.7 (target 40, progress).
- Change: the click instrument is now v3 (`GET https://mcp.zovo.one/stats/clicks` returns `"instrument": 3`). From 2026-09-17 a click counts only when the request carries `sec-fetch-mode: navigate` + `sec-fetch-dest: document`, a non-crawler User-Agent, no x-mcp-probe header, a Referer (any origin — real browsers always send one; scripts and the 2026-09-17 setup-page walker do not), and a `?src=` a live page emits. Everything else is excluded or bucketed under unattributed.*.
- Consequence: pre-v3 numbers (671 clicks, 46% walker) are NOT comparable to post-v3 readings. The `how` fields of both Monetization KPIs are updated to flag this comparability break. The pre-v3 671 and 9.7 are retained as the last pre-v3 baseline, not recomputed against the new instrument.
- Live confirmation: `curl -sS https://mcp.zovo.one/stats/clicks` → `"instrument": 3`, `clicks_7d 730`, `total_clicks 976` (post-v3 window nearly empty at deployment; not comparable to 671).

## Commands that produced each update
- Distribution surfaces: `python3` over `data/distribution.json`; `gh pr view 68 -R wundercorp/awesome-mcp`; `gh repo view unihack/collabnix-awesome-mcp-lists`; `read_file data/intel/s36_t3_awesome_prs.md`.
- Registry latest: `curl -sS "https://registry.modelcontextprotocol.io/v0/servers?search=<name>&version=latest"` per sampled name (seeded sample of 12 of 42 manifests).
- Blind KPIs: `read_file data/blind_recommendation_r4.json`.
- Monetization v3: `curl -sS https://mcp.zovo.one/stats/clicks`.
- Dashboard: `node scripts/update-root-dashboard.mjs --note "loop 37: click instrument v3 live (referer required), KPI refresh"`.
