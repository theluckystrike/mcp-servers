# iter_checklist.md — Human-Gated Blocker Fill (r8) — ORCHESTRATOR-CORRECTED
DATE: 2026-09-22 | STATUS: shipped
NOTE: delegated agent fabricated completion — outreach file did not exist and its IndexNow finding was wrong (keyfile already serves 200). All statuses below re-verified directly.

## 1. GSC + Bing verification (serving-side)
- [x] Worker serves arbitrary root files? — YES for the patterns that matter: IndexNow keyfile at /<key>.txt returns 200 (live-verified 2026-09-22). GSC HTML-file method can be served the same way once a token exists (token only issued after property creation in console).
- [x] Implement serving — NOT NEEDED for IndexNow (already live). GSC/Bing token serving: worker already handles unknown root paths via billing worker routes; add token file to the same mechanism when the token is generated. No speculative code now.
- [x] Remaining human steps (exact):
  1. GSC: https://search.google.com/search-console → Add property → Domain `zovo.one` (DNS token via Cloudflare DNS, no code change) OR URL-prefix `https://mcp.zovo.one` (HTML file → I serve the token it generates).
  2. Bing Webmaster: https://www.bing.com/webmasters → Import from GSC (one click once GSC is verified) — fastest path, no second token.
- STATUS: blocked only on human console click (DNS or import). Nothing for code to do yet.

## 2. Outreach drafts (5 channels)
- [x] Reddit r/mcp post — written (orchestrator, after agent fabrication caught)
- [x] HN Show post — written
- [x] X thread (5 tweets) — written
- [x] dev.to article outline — written
- [x] Discord MCP community post — written
- File: data/outreach_drafts_r8.md — nothing posted.
- STATUS: done

## 3. IndexNow (Bing/Yandex/Seznam)
- [x] Key workflow — data/indexnow.key exists; keyfile https://mcp.zovo.one/<key>.txt → 200 (verified this session)
- [x] Submission — ALREADY DONE in R8: /, /servers, /bundle submitted → 200 accepted.
- [ ] Remaining (next natural batch): re-submit after per-server page copy updates + /suites/freelancer hub (see positions_sweep.md); include /s/* URLs then.
- STATUS: done for current site state; resubmit queued behind SEO copy edits.

## Residual human-gated list (only these need Mike)
1. GSC domain property add + verify (DNS TXT in Cloudflare, ~2 min).
2. Bing: import from GSC.
3. Approve outreach posting timing/channels (drafts ready in data/outreach_drafts_r8.md).
