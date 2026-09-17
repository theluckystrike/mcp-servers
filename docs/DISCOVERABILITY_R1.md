# Discoverability audit R1 — 2026-09-17

Data: `data/discoverability_r1.json` (raw evidence in `/tmp/rows.json`, `/tmp/topics_rank.json`, `/tmp/sp.json`). Method: gh api reads/PATCHes + curl probes; every claim below had a command that produced it.

## Axis 1 — GitHub mirror metadata (38 live `mcp-*` mirrors)

| Item | State | Action |
|---|---|---|
| Topics | 38/38, avg 16.1, unique per capability | None needed (task's concern was wrong) |
| Descriptions | 0/38 carried hosted URL → **38/38 now do** | PATCHed via gh api; 5 hit GitHub's 350-char cap (HTTP 422), retried green after dropping the generic tail |
| Homepage | 38/38 = `https://mcp.zovo.one/s/<server>`, endpoints 200 | None |
| Social preview | 0/38 custom; auto-generated og:image only | Human-gated: GitHub has no write API; Settings → upload per repo |

## Axis 2 — GitHub topics-search rank (the provable root cause)

| Query | Total | Our best rank |
|---|---|---|
| topic:mcp-server invoice | 152 | mcp-invoice-generator #27 |
| topic:mcp-server barcode | 20 | mcp-barcode #4 |
| topic:mcp-server pdf generation | 19 | mcp-invoice-generator #17 |
| topic:mcp-server timesheet | 8 | mcp-time-tracker #3 |
| topic:mcp-server amortization | 1 | mcp-amortization #1 |

We are never absent — we rank mid-pack **purely on 0 stars** (sort=stars → 64/71). The 8–15★ incumbents (e.g. `markslorach/invoice-mcp` 11★) win the contested queries. Name/description were not the limiting factor. The `mcp-servers` monorepo appears in none of the per-capability queries.

## Axis 3 — channels (blind-R3 host distribution)

- reddit.com — human-gated (all submit routes 403, needs OAuth)
- youtube.com — human-gated (sign-in redirect)
- medium.com — human-gated (403)
- mcpservers.org — no-auth form exists but no API path; requires contact email; live search returns 0 zovo hits
- mcpmarket.com — 403 WAF, human-gated

## The biggest hole found (unplanned)

`data/distribution.json` shows only **4 of 42** servers ever submitted to mcpservers.org/mcpmarket.com, and live search confirms 0 hits — but the upstream that feeds these directories is the **Official MCP Registry**, and our registered entries mostly advertise `NO-REMOTE` (sample: 2 of 7 carried `https://mcp.zovo.one/mcp/...`). Hosted endpoints are therefore invisible down the registry → directory chain. **Fixing the registry entries' remote URLs is the highest-leverage organic action available.**

## Honest gap list

1. Registry `remote` URLs missing on most entries → next automatable action.
2. Custom social previews: 0/38, human-gated (one upload per repo).
3. Stars = 0 estate-wide: binding constraint on search rank; only fixable by real adoption.
4. 38/42 never submitted to the two big directories (upstream registry fix may cascade).
5. Reddit/YouTube/Medium/mcpmarket: human-gated, exact URLs above.
