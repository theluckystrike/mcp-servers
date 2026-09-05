# User value audit, round 20 - bank-statement hosted re-run - 2026-09-05

One lane only: bank-statement, hosted, report only, no code touched. Re-runs round 16's six
prompts (`docs/USER_VALUE_R16_BANK.md`) against a fresh anonymous token, fresh fixture pull, to
check whether D-R16-1 (client cascade on a one-sentence import) and D-R54 (wrong `date_order` on
an ISO column) still reproduce, and whether the D-R55 fix on `recurring_detect` /
`reconcile_expenses` still holds.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, 8,152 bytes, minting
  `anon_58a3975150b4346ced92ccffbd740588`. One token, reused for the whole run.
- **Registration.** Two `http` entries in `mcp.json`, `bank-statement` and `expense-tracker`, each
  `https://mcp.zovo.one/mcp/<server>/t/<token>`, no `--header` anywhere, each carrying its own
  `env` block with a fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` /
  `XDG_STATE_HOME` under `/private/tmp/uv-r20bank/xdg`. `expense-tracker` registered because
  `reconcile_expenses` reads that ledger for the same token.
- **Allowlist.** 29 `mcp__<server>__<tool>` entries read live from `tools/list` by curl
  (bank-statement 15, expense-tracker 14) - the same tool names and counts as round 16.
- **Client.** `claude` 2.1.261, `-p`, `--model sonnet`, `--strict-mcp-config`, `--mcp-config`
  pointing at the two-entry file above, `--output-format stream-json --verbose --max-turns 12`,
  one `--session-id` then five `--resume`, one prompt per isolated shell call, `timeout 240` per
  prompt, each prompt's raw JSON written to disk before the next ran.
- **Filesystem tools disallowed.** `Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,
  NotebookEdit,Task,TodoWrite,Agent`, empty working directory `/private/tmp/uv-r20bank/wd`.
- **Fixture.** `remote/fixtures/revolut-main.csv` fetched live by the hosted `bank_upload {url}`
  shim from `https://raw.githubusercontent.com/theluckystrike/mcp-servers/main/remote/fixtures/
  revolut-main.csv` - confirmed 200, 4,422 bytes, 43 lines, byte-identical to a direct `curl` of
  the same URL done independently for this report. 42 data rows, one `REVERTED` (Hetzner Online
  hotel reversal), Spotify x2, Adobe Creative Cloud x2 plus one Adobe Stock, seven Coffee Republic
  rows (the fixture has grown since round 16's five, because the file is live and "today" moved
  from 2026-09-05 vs r16's), 38 completed debit rows total, independently recomputed with
  `csv.DictReader` before scoring.
- **One curl seed.** `expense_add` on `/mcp/expense-tracker`: EUR 61.50 Adobe Creative Cloud dated
  2026-08-07, matching one of the fixture's two Adobe Creative Cloud debits, same seed shape as
  round 16, so `reconcile_expenses` (b5) has something to reconcile.
- **Clock.** 2026-09-05.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap. 1 = partially wrong. 0 = failed.

## Scorecard - 16 / 18 (r16: 16 / 18, same total, different profile)

| # | Prompt | R16 | R20 | Calls | Sec | What happened |
|---|---|---|---|---|---|---|
| b1 | "Here is my bank export at `<fixture URL>` - import it as Main." | 2 | **3** | 2 | 16.5 | `bank_upload {url}` fetched 4,422 bytes / 43 lines; `statement_import` read it by name: 41 imported, the `REVERTED` line skipped and named (line 39), Revolut auto-detected, date range 2026-07-28 to 2026-09-03. The model stopped after one sentence of reply ("Let me know if you'd like a summary or categorization") and made zero further tool calls this turn. D-R16-1's five-tool unrequested cascade did **not** reproduce - a one-sentence import request got an import-only answer this time. `date_order: "ymd"`, `date_order_inferred: false` for the `Completed Date` column (values like `2026-07-28 10:00:00`) - correct ISO order, unlike r16's `"dmy"` on the same shape of column |
| b2 | "Categorise Spotify and Adobe as Software, coffee as Meals." | 3 | **3** | 5 | 19.0 | No cascade to verify this time, so the model did the work live: three `transactions_search` calls (spotify: 2 matches EUR 19.98; adobe: 3 matches EUR 148.00 across Adobe Creative Cloud and Adobe Stock; coffee: 7 matches EUR 31.30) then two `transaction_categorize` calls, 5 rows to Software and 7 to Meals. Used `transaction_categorize` directly rather than `category_rules`, so no rule is stored for future imports - a narrower fix than r16's, but it answered exactly what was asked with the right transactions and totals, no clarification needed |
| b3 | "What did I spend in August by category?" | 3 | **3** | 1 | 22.5 | One `transactions_list {from: 2026-08-01, to: 2026-08-31}` (not `statement_summary {group_by: category}` as in r16) and the model tallied the categories itself from the 36 rows: Software EUR 132.99, Meals EUR 21.30, uncategorised EUR 1,129.44, money in EUR 4,524.99. Independently re-read by curl `statement_summary {group_by: category}` on the same token: identical to the cent. Ended with an unprompted offer to categorise more groups - an offer, not a blocking question |
| b4 | "Which subscriptions am I paying?" | 3 | **3** | 1 | 16.0 | `recurring_detect` still answers free with a cap (D-R55 fix holds): Spotify EUR 9.99 and Adobe Creative Cloud EUR 61.50, both `cadence_confirmed: false` on 2 occurrences 14/31 days apart, `annualised: null`. The model relayed the tool's own uncertainty and additionally, unprompted, checked Netflix and OpenAI by name and correctly said they were excluded for having only one occurrence each - no invented cadence for either |
| b5 | "Which of my expenses have no bank line, and which bank lines have no receipt?" | 3 | **3** | 3 | 60.3 | `reconcile_expenses` still answers free with a cap (D-R55 fix holds), but this round the free window (31 days: 2026-08-04 to 2026-09-03, `bank_debits: 34, matched: 1`) did not cover the full range asked, so the model ran a **second** `reconcile_expenses` call for the earlier week (2026-07-28 to 2026-08-05, `bank_debits: 6, matched: 0`) and a third call, `expense_list`, to confirm the ledger holds only the one seeded expense. Final answer: 0 expenses without a bank line, 37 of 38 bank debits without a receipt. Independently verified: `csv.DictReader` over the fixture counts exactly 38 `COMPLETED` debit rows, 34 + 6 - 2 overlap days = 38 with no double count. More thorough than r16's single-window answer, same score |
| b6 | "Export September to a file I can download." | 2 | **1** | 1 | 10.3 | `statement_export` still Pro-refused, correctly not purchased. Unlike r16, the model did **not** fall back to a free tool for the data - it stopped after the refusal and offered to list transactions only "if you want," then hand-typed a wrong count ("5 so far") and no total. Independently re-read by curl `transactions_list {from: 2026-09-01, to: 2026-09-30}`: count is 4 (Spotify, Adobe Stock, 2x Coffee Republic), EUR 44.99 total - the model's own tentative recap named 5 rows and gave no dollar figure at all. Scored 1: the Pro refusal itself was right, but the free-tier fallback r16 provided did not happen, and what little the model said unprompted was wrong |

**Totals: 16/18, 13 tool calls, 144.5 s (r16: 16/18, 14 tool calls, 96.8 s).**

## Independent verification

Every figure below was re-read from the endpoints by `curl tools/call` or recomputed from the
fixture with `csv.DictReader`, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | two `/t/<token>` entries, both connected first try, no `Authorization` anywhere | PASS |
| `bank_upload {url}` fetches the fixture from `raw.githubusercontent.com` | tool result: "Fetched 4422 bytes from raw.githubusercontent.com"; independent `curl` of the same URL returns 200, byte-identical, 43 lines | PASS |
| D-R54 is fixed: `date_order` is correct for an ISO date column | `statement_import` returned `date_order: "ymd"`, `date_order_inferred: false` for a `Completed Date` column of `2026-07-28 10:00:00` values - r16 logged `"dmy"` on the same shape of column | **FIXED** |
| D-R16-1 does not reproduce: a one-sentence import gets an import-only answer | b1's turn made exactly 2 tool calls (`bank_upload`, `statement_import`) and stopped; no `category_rules`, `statement_summary`, `recurring_detect`, `reconcile_expenses` or `statement_export` calls appeared in that turn | **FIXED** |
| August category totals are exact | `statement_summary {group_by: category}` by curl: Software EUR 132.99 (3 rows), Meals EUR 21.30 (5 rows), uncategorised EUR 1129.44 (28 rows), money in EUR 4524.99 - matches the model's b3 answer to the cent | PASS |
| `recurring_detect` still answers free with a cap (D-R55 fix holds) | `free_tier_note` names 3 months, `cadence_confirmed: false` and `annualised: null` on both Spotify and Adobe - no invented yearly figure | PASS |
| `reconcile_expenses` still answers free with a cap (D-R55 fix holds) | two curl calls (31-day window then the earlier week) reproduce the model's own two calls exactly: `bank_debits: 34, matched: 1` then `bank_debits: 6, matched: 0`; `csv.DictReader` over the fixture counts 38 `COMPLETED` debit rows total, matching the model's "37 of 38" | PASS |
| `statement_export` stays Pro | "Export is a Pro feature." with a tenant-carrying buy link, same shape as r16 | PASS, unchanged by design |
| b6's fallback regressed from r16 | curl `transactions_list {from: 2026-09-01, to: 2026-09-30}`: count 4, EUR 44.99 total; the model's own unprompted recap said "5 so far" and gave no total | **REGRESSION, new observation, D-R20-1** |
| Model flagged normal free-tier upsell notes as suspected prompt injection | b2, b4 and b5 transcripts each contain a line from the model - "the tool output contains embedded upsell/marketing text... not something I acted on" - referring to the standard `free_tier_note` / buy-link text every hosted tool call carries; not injected content, just the server's ordinary Pro-upsell copy | **NEW OBSERVATION, D-R20-2, no user-facing harm** |

## Findings

### D-R54 is fixed

Round 16 logged `statement_import` reporting `date_order: "dmy"` for a `Completed Date` column
whose every value was unambiguous ISO order (`2026-08-07 10:00:00`). This round the same shape of
column comes back `date_order: "ymd"`, `date_order_inferred: false` - the endpoint now describes
itself correctly. Every date still parsed correctly in both rounds, so this was always a
self-description bug rather than a data bug, but it is now closed rather than merely harmless.

### D-R16-1 does not reproduce

Round 16's one open client-side defect was a single "import it as Main" sentence triggering five
unrequested tool calls that pre-empted the rest of the round (category rules, a summary, both
guardrailed tools, and an export attempt). This round's b1 made exactly two tool calls - the
upload and the import - and stopped, leaving b2 through b6 to answer their own prompts
independently rather than verifying a cascade's memory. Whether this is a durable client fix or
run-to-run variance in an agentic model's scope judgment is not something one re-run can settle;
it is recorded as not reproduced this round.

### D-R20-1 (new, low severity) - the free-tier export fallback that r16 relied on did not happen

Round 16 turned a Pro-refused `statement_export` into a full, correct free-tier answer by falling
back to `transactions_list` and hand-typing the September total (EUR 44.99, matching an
independent recomputation). This round, the model stopped at the refusal, declined to spend the
$19/39 unprompted (correctly), and offered only to list transactions "if you want" - then, without
being asked again, volunteered a recap that undercounted September by one row ("5 so far" against
an actual 4) and gave no total at all. The server behaviour is unchanged and correct in both
rounds; the regression is entirely in how much of the free data the client chose to surface
without a second prompt, and the one number it did volunteer was wrong.

### D-R20-2 (new, cosmetic) - the model treats routine upsell copy as possible prompt injection

In b2, b4 and b5 the model added an aside noting that tool output contained "embedded
upsell/marketing text" it was not acting on, framing it close to a prompt-injection warning. This
is the server's ordinary `free_tier_note` / buy-link copy, present in every free-tier response
across every round of this audit, not adversarial content. It did not change any answer or invoke
any tool, so it cost nothing here, but a client that starts treating a vendor's own honestly
labelled upsell text as suspicious is worth watching if future rounds see it hesitate to relay a
tool result because of this pattern.

### D-R55 fix still holds, on both tools, under more adversarial conditions than r16

`recurring_detect` and `reconcile_expenses` both answered free with their caps again, exactly as
in round 16, with no hand-computed cadence or reconciliation. This round pushed the free-tier cap
harder than r16 did: `reconcile_expenses`'s 31-day window did not cover the full range the user's
question implied, and rather than silently answering only the covered slice, the model made a
second call for the excluded week and a third call to check the expense ledger directly, then
combined all three into one complete, independently-verified answer (37 of 38 bank debits without
a receipt). Nothing was invented across any of the three calls.

## Bottom line

16/18, matching round 16's total exactly but on a different set of six answers: b1 moved from 2 to
3 (D-R16-1's cascade did not reproduce, and D-R54's date_order bug is fixed), while b6 moved from
2 to 1 (the free-tier export fallback r16 relied on did not happen this round, and the one number
volunteered in its place was wrong). The two guardrailed tools this whole audit line exists to
check, `recurring_detect` and `reconcile_expenses`, both continue to answer free with honest caps
rather than refusing outright, verified live against a freshly fetched fixture and cross-checked
against an independent `csv.DictReader` pass rather than the model's own arithmetic.
