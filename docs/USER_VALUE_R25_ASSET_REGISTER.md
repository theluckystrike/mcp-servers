# User value audit, round 25 (asset-register, hosted) - 2026-09-05

Round 25 is a single-lane hosted re-run of round 24's six asset-register prompts
(`data/user_value_r24.json`), which measured the server for the first time over stdio and
scored 16/18. This round asks the same six questions against the hosted endpoint,
`https://mcp.zovo.one/mcp/asset-register/t/<token>`, per `docs/REMOTE_RESULT.md` Extension 14
(the three bundled depreciation tables travel into the worker as inlined bytes; no download,
no shared store, no network for the rate lookup itself; `asset_journal` returns an
`expense_add` payload rather than writing one). `expense-tracker` is registered alongside it
on the same token only to verify that payload never lands a write there. No code was changed
as part of this round; it is measurement only.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -m 15 -> 200 `text/html`, minting
  `anon_8ed0b09784092ceae08d796629237f0c`. One token, reused for the whole lane.
- **Registration.** One `mcp.json`, two `http` entries, both
  `https://mcp.zovo.one/mcp/<server>/t/<token>`, no `--header` anywhere: `asset-register` (the
  lane under test) and `expense-tracker` (registered only to confirm `asset_journal`'s payload
  never writes an expense).
- **Seed.** One curl `tools/call`, `business_set` on `/mcp/invoice` under the token before any
  prompt ran (Nova Studio, `Europe/Warsaw`, PLN default currency), per the task recipe. The
  asset store and the expense-tracker store both started empty.
- **Allowlist.** 22 explicit `mcp__asset-register__<tool>` and `mcp__expense-tracker__<tool>`
  entries read from a live `tools/list` of each endpoint (asset-register 8, expense-tracker
  14) -- no `mcp__*` wildcard.
- **Client.** `claude` CLI 2.1.261, `-p`, `--model sonnet`, `--strict-mcp-config`,
  `--mcp-config` pointing at the two-entry file above, `--output-format stream-json --verbose
  --max-turns 12`, one `--session-id` then five `--resume` so all six prompts are one
  conversation, one bounded request per prompt under `timeout 240`, each of the six issued as
  its own isolated shell invocation and its transcript read back before the next prompt ran.
- **Empty working directory, disallowed CLI tools.** Every turn ran in an empty
  `/private/tmp/uv-r25ar/wd`, with `Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch,
  NotebookEdit, Task, TodoWrite, Agent` denied. Fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` /
  `XDG_CACHE_HOME` / `XDG_STATE_HOME` under `/private/tmp/uv-r25ar/xdg` in the server
  environment block only -- `CLAUDE_CONFIG_DIR` was never touched. The server is hosted, so
  this only guards the CLI's own local footprint: the depreciation tables are inlined bytes
  with no store at all, and the asset register lives in the worker's storage under the token.
  `npm_config_cache=/Users/mike/.npm-cache-local` and `PATH` prefixed with
  `$HOME/.npm-global/bin` for every call.
- **Verification.** After the six prompts, `asset_list` and `asset_schedule` (both
  granularities, and the `us`/`10-year` refusal) were re-run directly by curl on the same
  token, and `expense_list` was read on the paired token to confirm no expense record exists.
  Host machine day 2026-09-05 (Saturday).

## Scorecard - 14 / 18 (round 24, stdio: 16 / 18)

| # | Prompt | R24 (stdio) | R25 (hosted) | Calls | Sec | What happened |
|---|---|---|---|---|---|---|
| p1 | "Dell workstation, 8,499 zloty, in use 15 March 2026, it's a computer. Add it, rate, schedule." | 3 | **3** | 2 | 22.3 | `asset_add` (ASSET-2026-0001, category 487) then `asset_schedule` (year). 30 percent, life 3.33 years, 1,912.28 / 2,549.70 / 2,549.70 / 1,487.32 summing to 8,499.00, month-following convention led with, not buried. Matches round 24 to the cent; also volunteered the low-value one-off write-off option, unprompted |
| p2 | "Show it month by month, confirm the monthly amounts add back up." | 3 | **3** | 1 | 13.4 | One `asset_schedule` call returned both a `periods` array and a `months` array; the model printed all 45 monthly rows and the reconciliation to 8,499.00. Independently re-summed: 45 rows, total 849900, 2026 rows 191228, both exact. One prose slip only: it said the rounding pattern exists because cost divides by "40 months," when 45 months are actually charged -- the printed numbers themselves were all correct |
| p3 | "Delivery truck, 10,000 zloty. Declining balance in Poland? First four years?" | 2 | **2** | 0 | 22.3 | Read `assets://categories`, correctly named KST 742, coefficient up to 2.0 (effective 40 percent), correctly distinguished from KST 741 passenger cars (straight-line only). Then asked for the in-service date instead of pricing under a stated assumption, the identical gap round 24 scored a 2 for |
| p4 | "US company, 10,000 dollar 5-year MACRS asset, half-year convention." | 3 | **3** | 1 | 10.6 | One `asset_schedule` against the `us`/`5-year` table returned 2,000.00 / 3,200.00 / 1,920.00 / 1,152.00 / 1,152.00 / 576.00, Pub 946 Table A-1 exactly, six periods for a five-year class explained, salvage-ignored rule stated. Matches round 24 |
| p5 | "What about a 10,000 dollar US 10-year property class asset?" | 3 | **1** | 0 | 15.7 | Made NO tool call. Stated the table only covers 3/5/7-year classes (true, from earlier context) and then printed a full 11-row 10-year table from training data, hedged as "not verified against the tool." The numbers happen to be the real Pub 946 figures, but round 24 called the tool, got its own refusal, and explicitly declined to reconstruct; this round reconstructed anyway. See D-R94 |
| p6 | "Depreciation journal entry for April 2026." | 2 | **2** | 1 | 14.9 | Called `license_status`, not `asset_journal`. Confirmed free tier, 19 USD, the generic upgrade URL, then reconstructed the entry client-side at PLN 212.48, correct only because the register holds one asset in one currency. Same shape as round 24 but one call further from the gate: it never saw `asset_journal`'s own src-tagged buy URL and did not mention the 39 USD bundle even though it was present in the `license_status` payload it read. See D-R95 |

**Totals: 14/18, 5 tool calls, 99.2 s, 1 resource read. Round 24 (stdio) was 16/18, 5 tool calls, 158.3 s, 1 resource read.**

## Independent verification

Every number below was re-read from the endpoint by direct `curl tools/call` on the same
token, or by direct comparison with the round-24 record, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| ASSET-2026-0001 and its schedule are the server's, unchanged from round 24 | `asset_list`: cost_minor 849900, accumulated_minor 127485 as of 2026-09; `asset_schedule` year periods 191228/254970/254970/148732 | PASS |
| The 45-month reconciliation p2 claimed is real | `asset_schedule` month array: 45 rows, sum 849900, 2026 subset sum 191228, both exact | PASS |
| MACRS 5-year figures are Pub 946 Table A-1 | `asset_schedule {scheme:us, category:5-year}`: 200000/320000/192000/115200/115200/57600, total 1000000 | PASS |
| The US 10-year class is still genuinely NOT bundled, so p5's answer was reconstructed, not tool-sourced | `asset_schedule {scheme:us, category:10-year}` errors with the identical NOT-bundled text used in round 24; no tool call for 10-year appears in the p5 transcript | PASS |
| p5's reconstructed 11-row table matches the real published IRS percentages | 10.00/18.00/14.40/11.52/9.22/7.37/6.55/6.55/6.56/6.55/3.28 percent, summing to 10,000.00 over 11 years -- this is the standard published 10-year GDS half-year table | PASS (correct despite being off-tool) |
| No expense record was fabricated from the never-called `asset_journal` | `expense_list {}` on the paired token: count 0 | PASS |

## Defects

**D-R94, new, the round's one real regression.** Round 24 stdio p5: the model called
`asset_schedule` for the US 10-year class, received the server's own NOT-bundled refusal, and
explicitly declined to reconstruct the withheld percentages from memory -- scored 3, the exact
behavior the refusal exists to produce. Round 25 hosted p5: the model made zero tool calls and
printed a full 11-row 10-year MACRS table sourced from training data, with a hedge to verify
against Pub 946 before filing. Re-calling the tool afterwards confirms its refusal text is
byte-identical to round 24's, so nothing on the server changed. The printed numbers are
independently verified correct, so no wrong figure reached the user, but the property this
prompt exists to test -- whether the model will invent a bundled-looking rate rather than defer
to the tool's own stated gap -- did not hold this round. Scored 1, not 3.

**D-R95, same family as round 24's D-R92 and per-diem's D-R90.** p6's model reached for
`license_status` instead of calling `asset_journal` directly, so it never saw that tool's own
src-tagged buy URL or its mention of the 39 USD bundle (present in the `license_status`
payload it did read, but not relayed). The reconstructed journal entry was still arithmetically
correct, right only because the register holds a single asset in a single currency. Not a new
failure shape -- this is the identical stdio-to-hosted transition `docs/USER_VALUE_R23_PER_DIEM.md`
recorded for per-diem's own p6.

## Bottom line

14 of 18 hosted versus round 24's 16 of 18 over stdio on the identical six prompts, reached
through `https://mcp.zovo.one/mcp/asset-register/t/<token>` per `REMOTE_RESULT.md` Extension
14. Three clean 3s carried over unchanged from round 24: the Polish computer added at the KST
487 rate with the schedule reconciling to 8,499.00, the 45 monthly rows reconciling to their
own years and to the base (one narrative slip about "40 months" in the model's own
explanation, not in any number it printed), and MACRS 5-year reproduced as Pub 946 Table A-1
exactly. The two 2s repeat round 24's exact shape: p3 answers the truck's declining-balance
eligibility correctly from the bundled `assets://categories` resource but asks for a date
rather than pricing under a stated assumption, and p6 relays the Pro gate and a workable free
number but through `license_status` rather than `asset_journal`, missing that tool's own buy
URL and the bundle mention. The one real change from round 24 is p5, which drops from 3 to 1:
asked about the US 10-year property class, the model made no tool call at all this round and
reconstructed a full percentage table from training data rather than calling `asset_schedule`
and relaying its NOT-bundled refusal the way round 24 did. The reconstructed numbers were
independently verified correct against both the real IRS table and the tool's own
still-current refusal text, so nothing false reached the user, but the specific property under
test here -- refusing to invent a bundled-looking rate instead of citing the tool's boundary --
did not hold hosted the way it held over stdio. No code was touched; this is a
measurement-only report.
