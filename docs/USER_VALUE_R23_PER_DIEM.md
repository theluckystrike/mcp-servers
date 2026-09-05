# User value audit, round 23 (per-diem, hosted) - 2026-09-05

Round 23 is a single-lane hosted re-run of round 22's six per-diem prompts (data/user_value_r22.json),
which measured the server for the first time over stdio and scored 17/18. This round asks the same six
questions against the hosted endpoint, `https://mcp.zovo.one/mcp/per-diem/t/<token>`, per
docs/REMOTE_RESULT.md Extension 13 (the five bundled rate tables travel into the worker as inlined bytes;
no download, no shared store, no network for the rate lookup itself). `expense-tracker` is registered
alongside it on the same token only to verify `trip_export`'s Pro gate never lands a write there. No code
was changed as part of this round; it is measurement only.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -m 15 -> 200 `text/html`, minting
  `anon_4b150a6acefb572f9ff413e89f590d18`. One token, reused for the whole lane.
- **Registration.** One `mcp.json`, two `http` entries, both `https://mcp.zovo.one/mcp/<server>/t/<token>`,
  no `--header` anywhere: `per-diem` (the lane under test) and `expense-tracker` (registered only to confirm
  `trip_export` never writes an expense).
- **Seed.** One curl `tools/call`, `business_set` on `/mcp/invoice` under the token before any prompt ran
  (Nova Studio, `Europe/Warsaw`, EUR default currency), per the task recipe. This deliberately differs from
  round 22's stdio seed, which used PLN as `default_currency` so the home scheme resolved to `pl`; here it
  resolves to none, surfaced verbatim in p4's `perdiem_rates` call. The per-diem trip store and the
  expense-tracker store both started empty.
- **Allowlist.** 21 explicit `mcp__per-diem__<tool>` and `mcp__expense-tracker__<tool>` entries read from a
  live `tools/list` of each endpoint (per-diem 8, expense-tracker 14 -- both hosted lists add
  `license_status`/`license_activate` over the 6 tools round 22's stdio server exposed) -- no `mcp__*`
  wildcard.
- **Client.** `claude` CLI 2.1.261, `-p`, `--model sonnet`, `--strict-mcp-config`, `--mcp-config` pointing at
  the two-entry file above, `--output-format stream-json --verbose --max-turns 12`, one `--session-id` then
  five `--resume` so all six prompts are one conversation, one bounded request per prompt under
  `timeout 240`, each of the six issued as its own isolated shell invocation and its transcript read back
  before the next prompt ran.
- **Empty working directory, disallowed CLI tools.** Every turn ran in an empty
  `/private/tmp/uv-r23pd/wd`, with `Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, NotebookEdit,
  Task, TodoWrite, Agent` denied. Fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` /
  `XDG_STATE_HOME` under `/private/tmp/uv-r23pd/xdg` in the server environment block only --
  `CLAUDE_CONFIG_DIR` was never touched. The servers are hosted, so this only guards the CLI's own local
  footprint: the rate tables are inlined bytes with no store at all, and the trip store lives in the
  worker's KV under the token. `npm_config_cache=/Users/mike/.npm-cache-local` and `PATH` prefixed with
  `$HOME/.npm-global/bin` for every call.
- **Verification.** After the six prompts, `perdiem_calc` was re-run directly by curl for all four
  calculation scenarios, `trip_list` and `perdiem_report` were read back on the same token, and
  `expense_list` was read on the paired token to confirm no expense record exists. Host machine day
  2026-09-05 (Saturday).

## Scorecard - 17 / 18 (round 22, stdio: 17 / 18)

| # | Prompt | R22 (stdio) | R23 (hosted) | Calls | Sec | What happened |
|---|---|---|---|---|---|---|
| p1 | "...trip was to Krakow, two hotel nights, breakfast on day one. What per diem am I owed?" | 3 | **3** | 2 | 20.2 | First `perdiem_calc {destination: Krakow}` errored, not in the bundled Polish table; the model read the message, reasoned Krakow is domestic, and retried with `destination: Poland`, landing PLN 258.75 (123.75 subsistence + 135.00 lodging), same figure as round 22, one extra self-correcting turn rather than a question to the user |
| p2 | "...UK domestic, 16 hours, lunch free. What does the HMRC benchmark scale rate give?" | 3 | **3** | 1 | 11.4 | One `perdiem_calc`, GBP 16.67, identical to round 22 including the model's own (correctly conditional) note about a possible late-evening supplement |
| p3 | "...US GSA standard, three calendar days, two hotel nights, no meals." | 3 | **3** | 1 | 9.4 | One `perdiem_calc`, USD 170.00 M&IE, lodging correctly described as a USD 115/night receipted cap not a payment, identical to round 22 |
| p4 | "...sending someone to Oman. What is the foreign dieta?" | 3 | **3** | 2 | 14.2 | `perdiem_calc` on Oman refused (34 of ~120 annex countries bundled), `perdiem_rates {scheme:pl}` confirmed coverage. New this round: the rates header also reported no home scheme, because this round's EUR profile matches none of pl/uk/us, where round 22's PLN profile resolved to pl -- an expected, task-caused difference, not a defect |
| p5 | "Save the Krakow one... and list trips on file." | 3 | **3** | 2 | 12.1 | `trip_record` saved TRIP-2026-0001 at PLN 258.75, `trip_list` read back count 1. Identical outcome to round 22, except the free-tier counter (present in the raw tool result) was dropped from the model's final answer this time rather than relayed |
| p6 | "Report of totals per scheme and month for the month-end pack." | 2 | **2** | 1 | 11.6 | The model called `license_status` (now allowlisted) instead of `perdiem_report`, confirmed free tier, then built the report itself from p5's `trip_list` -- one row, PLN 258.75. It never called `perdiem_report` and so never saw its src-tagged buy URL; its own answer names no URL at all, one step further from the gate than round 22 |

**Totals: 17/18, 9 tool calls, 78.9 s. Round 22 (stdio) was 17/18, 8 tool calls, 123.6 s.**

## Independent verification

Every number below was re-read from the endpoint by direct `curl tools/call` on the same token, not taken
from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| The Polish domestic figure after the self-correction is the server's | `perdiem_calc {scheme:pl, destination:Poland, ...}` returns total_hours 58, subsistence PLN 123.75, lodging PLN 135.00, total_minor 25875 | PASS |
| GBP 16.67 and USD 170.00/USD 230.00-cap are unchanged from stdio | `perdiem_calc {scheme:uk,...}` amount_minor 1667; `perdiem_calc {scheme:us,...}` subsistence_minor 17000, lodging_minor 23000, receipted-cap basis | PASS |
| Oman is genuinely outside the bundled annex; the home-scheme note is EUR-caused, not a defect | `perdiem_calc` Oman isError, 34 bundled countries; `perdiem_rates {scheme:pl}` home note: EUR "matches no bundled scheme ... no home scheme" | PASS |
| TRIP-2026-0001 is in the store correctly | `trip_list {}`: count 1, PLN 258.75, traveller Nova Studio, scheme pl, 3 days | PASS |
| `perdiem_report` is Pro-gated with a URL the model never saw because it never called the tool | `perdiem_report {}` isError: "Buy at https://mcp.zovo.one/buy/per-diem?tenant=anon_...\&src=per-diem.perdiem_report"; the transcript shows only `license_status`, no `perdiem_report` call | PASS |
| No expense record was fabricated from a never-called `trip_export` | `expense_list {}` on the paired token: count 0, totals_per_currency [] | PASS |

## Defects

**D-R90 reproduces hosted with a new shape.** Round 22 stdio: the model called `perdiem_report`, got the
Pro refusal, relayed the price but dropped the buy URL, then reconstructed the report client-side from
`trip_list`. Round 23 hosted: the model never called `perdiem_report` at all, reaching for `license_status`
instead (now allowlisted) and building the same client-side report without ever seeing `perdiem_report`'s
own src-tagged refusal text. The end state is the same or slightly worse -- a right-by-luck one-row table
and zero working links to the tool that would compute it correctly at scale. Not a new defect number: same
family, one call further from the gate.

**D-R92, new, low severity.** p5's `trip_record` response carries the free-tier counter
("1 of 5 trips recorded in 2026-05") exactly as round 22's did; this time the model's final answer dropped
it where round 22 relayed it. The save and list were both still correct, so this did not cost the score, but
it is the same class of loss as D-R90: a server-supplied line reached the model and did not reach the user.

## Bottom line

17 of 18 hosted, matching round 22's 17 of 18 over stdio on the identical six prompts, now reached through
`https://mcp.zovo.one/mcp/per-diem/t/<token>` with the rate tables travelling as inlined bytes in the worker
per REMOTE_RESULT.md Extension 13. Five clean 3s: PLN 258.75 for the Krakow trip (after the model
self-corrected a Krakow-vs-Poland destination miss inside the same turn), GBP 16.67 for the HMRC 15-hour
band, USD 170.00 of GSA M&IE with the lodging cap correctly framed as a ceiling, the Oman gap refused in the
server's own terms, and TRIP-2026-0001 saved and read back correctly. The single 2 is p6, the same shape
defect as round 22 (D-R90) one call further removed from the gate: the model checked `license_status`
instead of calling `perdiem_report` itself, so it never surfaced that tool's buy link, and it built the
report client-side from `trip_list`, right only because a single trip in a single currency exists.
`expense_list` on the paired `expense-tracker` token reads count 0 afterwards, confirming `trip_export` was
never invoked and nothing leaked across the two servers on the shared token. The one hosted-vs-stdio
difference that is not a defect is p4's home-scheme note, a direct and expected consequence of this round's
EUR business profile (as specified in the task) rather than round 22's PLN one.
