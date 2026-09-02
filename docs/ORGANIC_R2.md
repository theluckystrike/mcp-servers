# ORGANIC_R2.md -- organic re-measurement after v0.2.0, 2026-09-02

status: DONE

v0.2.0 shipped two more word-rich registry names (`expense-tracker`, `office-suite`) on
top of the four renamed in `docs/NAMING_RESULT.md`, and added `remotes[]` to three
servers. This re-measures the fleet's organic position given those changes: 34 tokens
from NAMING_RESULT.md plus `expense`, `expenses`, `receipt`, `receipts`, `mileage`,
`office`, `suite` (41 total across the six servers' own query sets), plus Smithery,
Glama, GitHub, and Bing/DDG checks.

## 1. Official registry -- per-token results, before vs after this pass

"Before" = the naming-only measurement recorded in `docs/NAMING_RESULT.md` /
`data/organic.json` on 2026-09-02 (4 servers, 34 tokens, no `remotes[]` field tracked).
"After" = this measurement (6 servers, 41 tokens, `remotes[]` checked per row).

| token | before: results / our rank | after: results / our rank (v0.2.0 row) | v0.2.0? | remotes? |
|---|---|---|---|---|
| time | 296 / 216 | 297 / 217 | yes | yes |
| timer | 12 / - | 12 / - | - | - |
| timesheet | 2 / 1 | 3 / 2 | yes | yes |
| hours | 2 / 2 | 3 / 3 | yes | yes |
| billable | 1 / 1 | 2 / 2 | yes | yes |
| tracking | 24 / - | 24 / - | - | - |
| time-tracker | 5 / 5 | 6 / 6 | yes | yes |
| time tracker | 0 / - | 0 / - | - | - |
| price | 114 / 100 | 115 / 101 | yes | yes |
| prices | 21 / - | 21 / - | - | - |
| deal | 99 / - | 99 / - | - | - |
| drop | 164 / 159 | 165 / 160 | yes | yes |
| alert | 43 / 35 | 44 / 36 | yes | yes |
| watch | 138 / 128 | 139 / 129 | yes | yes |
| product | 126 / - | 126 / - | - | - |
| shop | 113 / - | 113 / - | - | - |
| price-tracker | 8 / 7 | 9 / 8 | yes | yes |
| price tracker | 0 / - | 0 / - | - | - |
| spreadsheet | 15 / 13 | 16 / 14 | yes | no |
| excel | 163 / 160 | 164 / 161 | yes | no |
| xlsx | 19 / 19 | 20 / 20 | yes | no |
| csv | 17 / 17 | 18 / 18 | yes | no |
| sheet | 113 / 107 | 115 / 108 | yes | no |
| sheets | 80 / - | 80 / - | - | - |
| table | 129 / - | 129 / - | - | - |
| data | 1200 / - | 2891 / - | - | - |
| invoice | 93 / 84 | 94 / 85 | yes | yes |
| invoices | 0 / - | 0 / - | - | - |
| invoicing | 68 / - | 68 / - | - | - |
| billing | 28 / 28 | 29 / 29 | yes | yes |
| pdf | 281 / 258 | 282 / 259 | yes | yes |
| receipt | 15 / - | 16 / 15 (**expense-tracker**, not invoice) | yes | no |
| quote | 55 / - | 55 / - | - | - |
| freelance | 6 / - | 6 / - | - | - |
| expense | n/a | 15 / 15 | yes | no |
| expenses | n/a | 0 / - | - | - |
| receipts | n/a | 5 / 4 | yes | no |
| mileage | n/a | 1 / 1 | yes | no |
| office | n/a | 32 / - (not published) | - | - |
| suite | n/a | 86 / - (not published) | - | - |

`office-suite` (`io.github.theluckystrike/office-suite-time-invoice-expense-excel-price`)
does not appear anywhere in the registry -- confirmed by `search=office`, `search=suite`
and `search=theluckystrike` (17 rows total, none named office-suite), retried once for
the documented 1-3 minute index lag. `mcp-publisher publish` was apparently never run
for it; only `servers/office-suite/server.mcpb.json` exists on disk.

## 2. Smithery -- `GET registry.smithery.ai/servers?q=<token>`

| query | are we present? | top result useCount (context) |
|---|---|---|
| time tracker | no | oura 19 (top of the 10 sampled; several 0-useCount entries above it) |
| invoice | no | OjasKord/vat-validator-mcp 1,299 |
| expense | no | kelnix/kelnix-receipt-mcp 492 |
| spreadsheet | no | googlesheets 56,138 |
| price | no | agentery/agentery-mcp 951 |

Zero `theluckystrike` hits confirmed with a raw grep as well as field inspection. We
have never registered on Smithery (expected, per `data/organic.json` surface note); the
useCount gap (19 to 56,138) is the actual size of the install-ranked-surface problem.

## 3. Glama

`https://glama.ai/mcp/servers?query=theluckystrike` returns only nav chrome and one
unrelated card (another project's "BeLikeNative Grammar Server" text hit, not ours).
`https://glama.ai/mcp/servers?query=github.com%2Ftheluckystrike%2Fmcp-servers` returns
an empty result set for our repo -- the "theluckystrike/mcp-servers" string that
appears 3 times in that page's HTML is the echoed query in `<title>`, canonical link,
and OG tags, not a listing. Repo is not indexed yet.

## 4. GitHub search -- `gh api search/repositories?q=...&sort=stars`, top 30

| query | our rank in top 30 |
|---|---|
| mcp time tracker | not present |
| mcp invoice | not present |
| mcp expense tracker | not present |
| mcp spreadsheet | not present |

0 stars is why; consistent with the prior measurement.

## 5. Google / Bing / DuckDuckGo -- `site:mcp.zovo.one`

Google: no new measurement this pass (still "indexed via IndexNow," estimate unchanged).

Bing (`https://www.bing.com/search?q=site%3Amcp.zovo.one`, desktop Chrome UA via curl):
HTTP 200 both with and without `&setlang=en&mkt=en-US&cc=US`, but in both cases the
10 `b_algo` result blocks decode (via the `u=a1...` base64 wrapper) to entirely
unrelated pages -- Windows display-brightness support articles in one run, Telstra
webmail sign-in pages in the other. The `site:` operator was not honored; this is a
bot-detection/locale fallback SERP, not a real answer. Could not extract an indexed
page count for mcp.zovo.one this way.

DuckDuckGo (`https://html.duckduckgo.com/html/?q=site%3Amcp.zovo.one`): returned HTTP
202 and an anomaly/CAPTCHA challenge page ("Unfortunately, bots use DuckDuckGo too."
-- "Select all squares containing a duck"). No results were served.

**Conclusion: Bing/DDG indexation of mcp.zovo.one is unmeasured via curl.** Recorded as
such in `data/organic.json`'s Google/Bing/DDG surface row rather than assumed zero.
Re-attempting from an actual browser session (not curl) is the fix if this number is
needed.

## 6. Recomputed organic.json -- before / after

Per-server organic (100 x mean(p) over each server's own query set; p = min(1,10/rank)
if matched, else 0):

| server | organic before (4-server, naming-only) | organic after (6-server, this pass) | matched queries |
|---|---|---|---|
| time-tracker | 51 | 50.6 | 5 / 8 |
| price-tracker | 15 | 15.2 | 5 / 10 |
| spreadsheet | 25 | 24.1 | 5 / 8 |
| invoice | 6 | 6.3 | 3 / 8 (lost 'receipt' to expense-tracker) |
| expense-tracker | n/a (did not exist) | 66.7 | 4 / 5 |
| office-suite | n/a (did not exist) | 0.0 | 0 / 2 |

Registry findable (mean p over all query slots, all servers): 0.239 (18 of 34) ->
0.276 (22 of 41).

New "Hosted endpoints" surface (findable = share of query slots whose matched v0.2.0
row carries `remotes[]`): 0.317 (13 of 41 slots resolve to time-tracker, price-tracker
or invoice, all of which publish remotes; spreadsheet and expense-tracker do not,
office-suite has no row). listed 1.0, reach 0.5 (estimate) -> score 15.9.

Surface scores that moved because registry findable moved:
- Official registry: 23.9 -> 27.6
- VS Code gallery: 21.5 -> 24.8
- Cursor/Claude Code pickers: 14.0 -> 16.0

Fleet (fleet_score redefined as noisy-OR across the six per-server organic scores,
applied identically to both sides for comparability -- the previously stored
`fleet_score: 78` used an undocumented aggregation and was not reused):

| metric | before (4 servers) | after (6 servers) |
|---|---|---|
| max_surface | 23.9 | 27.6 |
| mean_live (mean score of "live"-status surfaces) | 12.0 | 13.9 |
| fleet_score (noisy-OR of server organics) | 70.6 | 90.1 |

## RESULT

```
fleet_score:      70.6 -> 90.1   (noisy-OR of 6 server organics; expense-tracker alone
                                   would move it to ~87, office-suite adds nothing)
max_surface:       23.9 -> 27.6   (official registry, findable 0.239 -> 0.276)
mean_live:         12.0 -> 13.9   (new "hosted endpoints" surface, score 15.9, added)
registry findable: 0.239 -> 0.276 (22 of 41 tokens matched, up from 18 of 34)
```

Three biggest movers:

1. **expense-tracker (new server): organic 0 -> 66.7.** Landed rank 1 of 1 on
   'mileage', 4 of 5 on 'receipts', and is matched (if crowded) on 'expense' and
   'receipt'. Now the single strongest server in the fleet by measured organic score,
   entirely because its name uses words nobody else has claimed yet.
2. **office-suite (new server): organic 0, and it is not the naming's fault.** It was
   never published to the registry at all -- confirmed absent on 'office', 'suite' and
   a full 'theluckystrike' listing, retried once. It is real inventory (`remotes`-less
   `.mcpb` sits on disk) earning nothing until someone runs `mcp-publisher publish` on
   it.
3. **Hosted endpoints (remotes[]) went from an untracked field to a measured surface at
   score 15.9.** 3 of 6 servers (time-tracker, price-tracker, invoice) now publish a
   `remotes[]` entry on their v0.2.0 row; spreadsheet and expense-tracker still don't,
   which is now visible as a concrete, closeable gap rather than an unmeasured
   attribute.

Everything else moved by less than 1 point: invoice lost its only zero-competitor route
('receipt') to expense-tracker's name and picked up nothing to replace it (6 -> 6.3,
noise); time-tracker/price-tracker/spreadsheet shifted by fractions of a rank because
the index grew slightly between measurements, not because of anything the fleet did.

## artifacts

- /Users/mike/mcp-servers/data/organic.json (measured[], surfaces[], servers[], fleet)
- /Users/mike/mcp-servers/data/registry_rank.json (`after_v2_2026-09-02_post_expense_office` block)
- /Users/mike/mcp-servers/docs/ORGANIC_R2.md (this file)

## cost

~25 wall minutes (cap).

## failures / instrument notes

1. First reflex was to trust `metadata.count` on the last paginated page as "total
   results" for a token -- that field is the page size of that particular response
   (varies), not the cumulative total across all cursor pages. Fixed by summing
   `len(servers)` across every page actually fetched, matching the methodology
   NAMING_RESULT.md used.
2. First per-server score computation picked "the latest v0.2.0 row that matches this
   query, from ANY of our servers" rather than "the row belonging to THIS server" --
   which silently credited invoice with expense-tracker's rank-15 'receipt' match.
   Fixed by filtering rows to the exact registry name per server before computing p.
3. Bing and DuckDuckGo both defeated the curl approach the task specified (Bing serves
   a locale/bot fallback SERP that quietly drops the `site:` operator instead of
   erroring; DDG serves a CAPTCHA with HTTP 202). Recorded as unmeasured in both
   `organic.json` and this file rather than silently treating "no real results found"
   as "0 indexed pages" -- those are different claims and only one of them is true.
