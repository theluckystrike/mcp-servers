# Plan v3 (2026-09-03, loop 6)

Orchestrator: Claude Fable 5.1. Executors: Sonnet and Opus agents. Zero paid APIs, no paid submissions, no emojis.

## What the database says (data/organic.json, data/kpi.json, data/metrics.json, data/user_value_index.json)

| Fact | Number | Consequence |
|---|---|---|
| Bundle downloads in 24 h | 109 to 343 | Installs are arriving, and they arrive with zero GitHub page views: the registry and catalogs are the channel |
| Anonymous hosted tokens | 17, hosted documents served 79 | Strangers already touch the hosted endpoints without reading anything; this is the cheapest first call we have |
| Hosted tools/list p50 | 1,319 ms against an 800 ms target | Round 4 measured first-prompt misses past about a second; latency is a value defect, not a nicety |
| Paid sessions, minted keys | 0, 0 | The free tier delivers value and nothing in the product turns a cap into a purchase at the moment it is hit; hosted users would also have to paste a key by hand |
| Registry findable share | 35% of tracked tokens | Naming moved coverage 7/34 to 36/56; the remaining gaps are tokens where we hold no name at all, and the registry sorts alphabetically so presence beats rank |
| Best organic surface | registry 34.5 of 100; Docker and Cline pending; Claude Desktop directory human-gated | The directories we can still influence from the terminal are the registry (more names) and our own storefront |
| User value latest | 75%, 25 defect ids open in the ledger | Most open ids are round-1 client-side or superseded; the server-side remainder is small and cheap |

## Top 5 tasks, ranked by impact x autonomy

1. **Connect-by-URL for hosted endpoints, plus latency.** Claude.ai and Claude Desktop custom connectors, and several IDE pickers, accept a remote MCP URL and nothing else. A bearer header cannot be entered there. Add a URL-token path (`/mcp/<server>/t/<token>`) and a `/mcp/connect` page that mints a token and prints the exact URLs, so a user connects with zero local install. In the same worker, bring tools/list p50 under 800 ms (measure cold start, module size, KV hydration; hydrate lazily, cache tools/list per server). Pass: a connector-style client with no headers lists tools; p50 under 800 ms in scripts/kpi.mjs.
2. **In-product upgrade path.** When a free cap is hit on a hosted endpoint, the response carries a checkout link pre-bound to that tenant (`/buy/<product>?tenant=<token>`); on payment, the billing worker writes `bind:<token>` to the shared KV and the hosted worker treats that anonymous tenant as Pro without a key paste; the stdio servers keep the key flow. Pass: a signed test purchase path verified with Stripe test mode is not available live, so pass = unit tests on the binding decision plus a live 402-to-checkout round trip that shows the bound tenant in session metadata.
3. **Registry name variants on empty tokens.** For tokens with fewer than 20 results where the fleet holds no name (from data/registry_rank.json plus a fresh probe), publish one additional name per server that contains those tokens, pointing at the same bundle. Pass: findable share rises in data/organic.json on re-measure; no spam (max one variant per server, only honest tokens).
4. **Defect backlog and round 9.** Triage the 25 open ledger ids: close the superseded ones in the ledger with the round that fixed them, fix the server-side remainder with tests, then run round 9 on the scenarios that scored below 3 in round 8. Pass: ledger open count under 10; round 9 above 85%.
5. **Content for the new install path and search re-check.** Setup pages and a guide for connect-by-URL (claude.ai, Claude Desktop connectors, Cursor, VS Code remote), the storefront home leading with it, Search Console coverage re-inspected 24 h after submission, IndexNow for the new pages. Pass: pages live, sitemap grows, GSC inspection recorded.

Plus, in this loop: a Sprint log tab on the dashboard (every session note with commits and outcomes), the KPI and organic tabs refreshed, v0.4.2 only if server sources change.
