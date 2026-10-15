
## R35 (2026-10-15)
- Shipped: free-tier upsell trailer on every successful tools/call (src-tagged Pro links, tenant pre-bound). PR #56 merged (d76f3a30), deployed (7af7c65a), verified live on invoice server.
- Monetization audit: intel/R35-monetization-audit.md — top lever implemented (in-success upsell, 280 free tenants); next: checkout A/B on $19 single vs $39 bundle; Resend outreach needs RESEND_API_KEY from user.
- Distribution: all 149 names live on official registry; 2 dead remote endpoints queued (hourly-rate, office-suite).
- Platform analysis: MCP supply 55x more crowded than Telegram Mini Apps; Stars-paid Mini App re-skins flagged as future round.

## R35b — dead-endpoint audit (2026-10-15)
- Probed /mcp/hourly-rate + /mcp/office-suite live: both 404 on the worker, /mcp/zip 200 (control).
- Root cause: neither is in HOSTED_SERVERS (billing/src/index.js). office-suite absent BY DESIGN (spawns local child processes). hourly-rate is a free standalone never added to the hosted set — its /s/ page correctly omits the hosted sentence.
- data/payment_map.json: office-suite already flagged hosted_endpoint_live:false; hourly-rate absent from servers[] entirely (not a store entry). /s/hourly-rate and /s/office-suite pages both 200 with correct buy links.
- Verdict: NO dead links ship to users. The stale intel note ("2 dead endpoints") is closed; no fix shipped, none required.
