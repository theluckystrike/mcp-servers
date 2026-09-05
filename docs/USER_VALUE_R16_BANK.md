# User value audit, round 16 - bank-statement re-run - 2026-09-05

Round 11 (docs/USER_VALUE_R11.md) scored bank-statement hosted at 14/18, with two of the six
deductions caused by the same root cause: `recurring_detect` and `reconcile_expenses` refused
outright on the free tier, so the model hand-computed the answer instead and reproduced the exact
defect the tool exists to prevent (D-R55 - an annualised subscription figure built from two charges
14 days apart). `docs/GUARDRAILS_RESULT.md` reclassified both tools, driven by D-R55, from a bare
refusal to "answers free with a named cap." This round re-runs the same six prompts, same shape,
to see whether that fix holds live. One lane only: bank-statement, hosted, report only, no code
touched.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, 8,623 bytes, minting
  `anon_2d5f0c11d9f0acc11d8e1ddac2ba8d83`. One token, reused for the whole run.
- **Registration.** Two `http` entries in `mcp.json`, `bank-statement` and `expense-tracker`, each
  `https://mcp.zovo.one/mcp/<server>/t/<token>`, **no `--header` anywhere**, each carrying its own
  `env` block with a fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` / `XDG_STATE_HOME`
  under the scratch directory. `expense-tracker` is registered because `reconcile_expenses` reads
  that ledger for the same token.
- **Allowlist.** 29 `mcp__<server>__<tool>` entries read live from `tools/list`
  (bank-statement 15, expense-tracker 14).
- **Client.** `claude` 2.1.261, `--model sonnet`, `--strict-mcp-config`, `--output-format
  stream-json --verbose --max-turns 12`, one `--session-id` then five `--resume`, one per prompt,
  `timeout 240` per prompt, each prompt's raw JSON written to disk before the next ran.
- **Filesystem tools disallowed.** `Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,
  NotebookEdit,Task,TodoWrite`, empty working directory, per r11's D-R57.
- **Fixture.** `remote/fixtures/revolut-main.csv`, committed on `main`, fetched by the hosted
  `bank_upload {url}` shim (Extension 10, `docs/REMOTE_RESULT.md`) from
  `https://raw.githubusercontent.com/theluckystrike/mcp-servers/main/remote/fixtures/revolut-main.csv`
  instead of pasted as text - confirmed `curl` of that URL returns 200 and is byte-identical to the
  file in the repo. 42 data rows, one `REVERTED`, Spotify x2, Adobe Creative Cloud x2 plus one Adobe
  Stock, five Coffee Republic rows, three incoming payments, the rest one-off card spend. Every
  total in this report was independently recomputed with `csv.DictReader` before the run.
- **One curl seed.** `expense_add` on `/mcp/expense-tracker`: EUR 61.50 Adobe Creative Cloud dated
  2026-08-07, matching one of the fixture's two Adobe Creative Cloud debits, so `reconcile_expenses`
  (b5) has something to reconcile, exactly as r11 seeded it.
- **Clock.** 2026-09-05, on a UTC+07 machine.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap. 1 = partially wrong. 0 = failed.

## Scorecard - 16 / 18 (r11: 14 / 18)

| # | Prompt | R11 | R16 | Calls | Sec | What happened |
|---|---|---|---|---|---|---|
| b1 | "Here is my bank export at `<fixture URL>` - import it as Main." | 3 | **2** | 7 | 48.8 | `bank_upload {url}` fetched 4,422 bytes / 43 lines from `raw.githubusercontent.com`; `statement_import` read it by name: 41 imported, the `REVERTED` line skipped and named, Revolut auto-detected, date range 2026-07-28 to 2026-09-03 - exactly right. But the same turn then, unasked, set category rules, ran the August summary, ran `recurring_detect` and `reconcile_expenses`, and attempted `statement_export`: six extra tool calls answering b2 through b6 before the user asked them. The import is a 3 on its own; a one-sentence import request did not get an import-only answer, so this scores **2**. See D-R16-1 |
| b2 | "Categorise Spotify and Adobe as Software, coffee as Meals." | 2 | **3** | 2 | 11.8 | Already done by b1's cascade. The model re-verified **live** rather than trusting memory - `accounts_list` (41 transactions, unchanged) then `category_rules` (3 rules, exactly Spotify/Adobe->Software and coffee->Meals, `free_limit: 5`) - and told the user nothing needed redoing, rather than silently re-running the write or inventing a number the way r11's D-R52 did |
| b3 | "What did I spend in August by category?" | 3 | **3** | 1 | 8.7 | One fresh `statement_summary {group_by: category}`: EUR 1,283.73 out over 36 rows, EUR 4,524.99 in kept separate, Software 132.99, Meals 21.30, uncategorised 1,129.44 on 28 rows. Every figure matches the independent CSV computation |
| b4 | "Which subscriptions am I paying?" | 2 | **3** | 1 | 7.2 | `recurring_detect` now **answers free with a cap** instead of refusing (the D-R55 fix, live): Spotify EUR 9.99 and Adobe Creative Cloud EUR 61.50, both `cadence_confirmed: false` on 2 occurrences, `annualised: null`, `free_tier_note` naming the 3-month/5-charge cap. The model relayed the tool's own honest uncertainty instead of hand-computing - r11's defect (Adobe annualised to ~EUR 1,656/year off two charges 14 days apart) did not reproduce |
| b5 | "Which of my expenses have no bank line, and which bank lines have no receipt?" | 2 | **3** | 1 | 8.4 | `reconcile_expenses` now **answers free with a cap** instead of refusing (same fix, live): 0 expenses without a bank line (the seeded Adobe charge matched), 33 of 34 bank lines in the free 31-day window without a receipt, and the note named exactly which slice of the asked range it covered and why the first week was left out. `bank_debits: 34, matched: 1` re-read by curl confirms "33 of 34" |
| b6 | "Export September to a file I can download." | 2 | **2** | 2 | 11.9 | `statement_export` is a volume/export gate and was **not** reclassified - still Pro-refused, no purchase attempted. The model fell back to free `transactions_list`: 4 September rows, 9.99 + 25.00 + 3.60 + 6.40 = EUR 44.99 (matches the independent calc), even hand-typing a CSV block for the user to copy. Right data, no real download link - unchanged from r11 |

**Totals: 16/18, 14 tool calls, 96.8 s (r11: 14/18, method not directly comparable on call count
since r11 registered a fifth server).**

## Independent verification

Every figure below was re-read from the endpoints by `curl tools/call`, not taken from the model's
prose.

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | two `/t/<token>` entries, both connected first try, no `Authorization` anywhere | PASS |
| `bank_upload {url}` fetches the fixture from `raw.githubusercontent.com` | "Fetched 4422 bytes from raw.githubusercontent.com"; `curl` of the same URL returns 200, byte-identical to `remote/fixtures/revolut-main.csv` | PASS |
| August totals are exact | `statement_summary` by curl: EUR 1283.73 out, EUR 4524.99 in, Software 132.99, Meals 21.30; `csv.DictReader` over the fixture computes the identical figures | PASS |
| `recurring_detect` answers free with a cap (D-R55 fix) | `free_tier_note` names 3 months / 5 charges; `cadence_confirmed: false` and `annualised: null` on both Spotify and Adobe - no invented yearly figure | PASS |
| `reconcile_expenses` answers free with a cap (D-R55 fix) | `free_tier_note` names the exact 2026-08-04 to 2026-09-03 window covered; curl re-read: `bank_debits: 34, matched: 1`, 33 `unmatched_bank` entries | PASS |
| `statement_export` stays Pro | "Export is a Pro feature." with tenant-carrying buy links, same shape as r11 | PASS, unchanged by design |
| `category_rules` write path still reports the free limit (D-R52, r11) | b1's write call returned `{rules: 3, categorised: 12, free_limit: 5, rules_remaining: 2}` | PASS, still fixed |
| `date_order` is correct for an ISO date column (D-R54, r11) | `statement_import` returned `date_order: "dmy"`, `date_order_inferred: false` for a `Completed Date` column of `2026-08-07 10:00:00` values; every date parsed correctly regardless | **STILL PRESENT** - logged in r11, not fixed, not fixed here either (report-only round) |
| A one-line import request gets back only an import | b1's single turn also ran `category_rules`, `statement_summary`, `recurring_detect`, `reconcile_expenses` and attempted `statement_export` - six unrequested tool calls | **FAIL, new observation, D-R16-1, documented not fixed** |

## Findings

### The D-R55 fix holds, live, on both tools it was meant to fix

r11's worst bank-statement defect was structural: gating a guardrail does not stop the answer, it
strips the guardrail out of the answer. `recurring_detect` refused, so the model computed cadence by
hand from `transactions_list` and annualised two Adobe charges 14 days apart to about EUR
1,656/year - the exact number `cadence_confirmed: false` exists to withhold. `reconcile_expenses`
refused the same way, so the model reconciled by hand across two hosted endpoints, right answer,
entirely by workaround.

This round both tools answered directly, with their own caps and their own honesty about
uncertainty: `recurring_detect` returned `annualised: null` and `cadence_confirmed: false` rather
than an invented figure, and `reconcile_expenses` named precisely which seven days of the asked
range its free window dropped. Both prompts moved from 2 to 3. Nothing was hand-computed, and
nothing needed a curl to invent context the tool had already withheld on purpose.

### D-R16-1 (low, client-side, new) - a one-sentence import produced a five-tool unrequested cascade

Asked only to "import it as Main," the model imported the fixture correctly (41 rows, one
`REVERTED` row skipped and named, right date range) and then, in the same turn and without being
asked, set category rules, ran the August summary, ran `recurring_detect`, ran
`reconcile_expenses`, and attempted `statement_export`. Every one of those calls answered correctly
- verified live by curl, nothing invented - so this is not a server defect. It is a scope problem:
given the whole allowlist up front in one `--strict-mcp-config` session with no instruction to stop
after one action, the agentic model pre-empted every later prompt in the round before the round
asked for it, spending six extra calls under a token metered at 600/hour. It cost b2 nothing, because
that turn re-verified state live rather than trusting the cascade's memory - but it means b1 through
b5 are no longer independent measurements of what each individual sentence produces on this server.
Scored 2, not 1 or 0: nothing was wrong, but "import it as Main" did not get an import-only answer.

### D-R54 still open

`statement_import` still reports `date_order: "dmy"`, `date_order_inferred: false` for a column
whose every value is `2026-08-07 10:00:00` (unambiguous ISO order). Every date still parses
correctly - the August and September splits are exact - so this remains the endpoint being wrong
about itself, not about the data. Logged in r11, not touched since; this round did not fix it either
(report-only).

### D-R52 fix still holds

The write path of `category_rules` still returns `free_limit` and `rules_remaining` alongside
`rules` and `categorised`, so a model that just wrote rules has a real number to relay instead of
guessing - confirmed in b1's write call and again in b2's read call.

## Bottom line

16/18, up from 14/18 in round 11, and the two extra points land exactly where the GUARDRAILS_RESULT
fix aimed them: `recurring_detect` and `reconcile_expenses`, both driven by D-R55, both verified live
against a freshly fetched fixture rather than the model's prose. The one new point lost is not a
regression in the server - it is the first time this round format exposed an agentic client
answering five prompts' worth of a round in the first turn, which is worth watching in any future
round that resumes a single session across a full prompt list rather than assuming each prompt is
independent.
