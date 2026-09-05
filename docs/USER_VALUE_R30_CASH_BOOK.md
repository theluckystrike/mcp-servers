# User value audit, round 30 (cash-book, hosted) - 2026-09-06

Round 30 is a single-lane hosted re-run of round 29's six cash-book prompts
(`data/user_value_r29.json`), which measured the server for the first time over stdio and
scored 17/18. This round asks the identical six questions against
`https://mcp.zovo.one/mcp/cash-book/t/<token>` per `docs/REMOTE_RESULT.md` Extension 16, with
only `/mcp/invoice`, `/mcp/expense-tracker` and `/mcp/deposits` also registered on the same
token, per this task's recipe. No code was changed as part of this round; it is measurement
only. Cap: 30 minutes, met.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect -m 15` -> 200 `text/html`, minting
  `anon_31ce428495a7c11f1552c3dc90db8840`. One token, reused for the whole lane.
- **Registration.** One `mcp.json`, four `http` entries, all
  `https://mcp.zovo.one/mcp/<server>/t/<token>`, no `--header` anywhere: `cash-book` (the lane
  under test), `invoice`, `expense-tracker` and `deposits`. `billing-docs`, `bank-statement` and
  `asset-register` were deliberately NOT registered, per the recipe -- cash-book reads all six
  as sibling stores, but this lane only seeds and registers three of them.
- **Profile.** `business_set` on `/mcp/invoice` before any prompt ran: Nova Studio,
  `Europe/Warsaw`, EUR, 23 percent default tax rate.
- **Seed.** Round 29's own `workedMonth` fixture
  (`servers/cash-book/test/_client.mjs`) was reproduced live by calling the real tools over
  curl, restricted to what the three registered sibling servers can hold: `client_add` Acme
  Ltd; `invoice_create` INV-2026-0001 (net EUR 1000, 23% VAT, issued 2026-06-03) and
  INV-2026-0002 (net EUR 500, 23% VAT, issued 2026-06-10); `invoice_mark_paid` INV-2026-0001
  EUR 630 on 2026-06-20; `expense_add` EUR 123.00 travel/Rail on 2026-06-05 (vat_rate 23
  explicit) and EUR 50.00 software/Editor on 2026-06-12 (no vat_rate passed -- the shared
  profile's 23% default applied automatically, splitting it into net EUR 40.65 / VAT EUR 9.35,
  unlike the stdio fixture's undivided EUR 50.00 line); `deposit_record` EUR 1000 retainer
  received 2026-06-01; `deposit_apply` EUR 600 of it onto INV-2026-0001 on 2026-06-18. Credit
  notes, fixed assets and the bank import from the same fixture were NOT seeded, because
  `billing-docs`, `asset-register` and `bank-statement` were never registered on this token.
- **Allowlist.** 44 explicit `mcp__<server>__<tool>` entries read from a live `tools/list` of
  all four endpoints (cash-book 8, invoice 12, expense-tracker 14, deposits 10) -- no
  `mcp__*` wildcard.
- **Client.** `claude` CLI 2.1.261, `-p`, `--model sonnet`, `--strict-mcp-config`,
  `--mcp-config` pointing at the four-entry file above, `--output-format stream-json --verbose
  --max-turns 12` (20 for prompt 5), one `--session-id` then five `--resume` so all six prompts
  are one conversation, one bounded request per prompt under `timeout 240`, each of the six
  issued as its own isolated shell invocation and its transcript read back before the next
  prompt ran.
- **Empty working directory, disallowed CLI tools.** Every turn ran in an empty
  `/private/tmp/uv-r30cb/wd`, with `Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch,
  NotebookEdit, Task, TodoWrite, Agent` denied. Fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` /
  `XDG_CACHE_HOME` / `XDG_STATE_HOME` under `/private/tmp/uv-r30cb/xdg` for every `claude`
  invocation. `npm_config_cache=/Users/mike/.npm-cache-local` and `PATH` prefixed with
  `$HOME/.npm-global/bin` for every call.
- **Verification.** After the six prompts, `invoice_list` and `deposit_list` were re-read
  directly by curl on the same token to recompute every ledger figure by hand.
  `expense_list` could not verify the two June expense legs directly, because the
  expense-tracker free tier reads only the last 30 days back from the host day (2026-09-06),
  which excludes June entirely -- the tool correctly returns `nothing_read: true` rather than
  an empty result when asked for June explicitly. The two expense legs were instead confirmed
  against their own `expense_add` confirmation replies captured during seeding (ids `2ff10644`
  and `056bd932`). `month_close` and `ledger_export_csv` were called directly on the same token
  after the round to confirm their real Pro prices and, for `ledger_export_csv`, its exact
  refusal text.

## Scorecard - 17 / 18 (round 29, stdio: 17 / 18)

| # | Prompt | R29 (stdio) | R30 (hosted) | Calls | What happened |
|---|---|---|---|---|---|
| cb1 | Build a double-entry ledger for June 2026, do the books balance | 3 | **3** | 4 | 18 lines / 7 transactions, EUR 4,248.00 both ways. The model flagged, unprompted, that bank-statement and asset-register both read 0 rows and that the 4 cash-moving postings are `posted_cash_without_bank_evidence` rather than treating the balanced trial balance as proof of completeness |
| cb2 | Walk me through the cash account, bank evidence | 3 | **3** | 1 | Four cash legs with exact source ids and amounts, closing EUR 1,457.00 Dr, all correctly flagged as unbacked since the bank store is empty on this token |
| cb3 | Why is my bank import not in the ledger | 3 | **3** | 1 | Named its own limitation first (no bank-statement tool registered in this session), re-ran `ledger_build` to confirm rows:0 was fresh not cached, gave three concrete explanations, and still recited the server's real design rule (bank row = evidence, never a posting) |
| cb4 | Full trial balance, what June leaves unposted or inconsistent | 3 | **3** | 1 | Full 8-row trial balance, 4,248.00 each way, repeated the bank/asset gap, described `month_close`'s three exception categories and $19 price accurately from the tool's own listing -- but never called it this session |
| cb5 | March, April, May, then rebuild June | 3 | **3** | 8 | March/April genuinely empty and explained as such; May's build hit the real 3-periods-a-month cap while `trial_balance` still answered for it; June's rebuild came back byte-for-byte identical and free |
| cb6 | Per-account report and CSV export | 2 | **2** | 2 | Hand-built table and CSV from free `ledger_lines` data, both arithmetically correct and disclosed as substitutes -- but `ledger_export_csv` was never called this turn, so the model never saw that tool's own refusal text, which explicitly says not to hand-build a CSV in place of the real export |

**Totals: 17/18, 19 tool calls to the server. Round 29 (stdio) was 17/18, 16 tool calls.**

## Independent verification

| Claim | Evidence | Verdict |
|---|---|---|
| The seeded fixture matches round 29's `workedMonth`, restricted to 3 sibling stores | `invoice_list`: INV-2026-0001 paid in full (630.00 direct + 600.00 deposit application = 1,230.00), INV-2026-0002 unpaid balance 615.00; `deposit_list`: DEP-2026-0001 received 1,000.00, applied 600.00, held 400.00 | PASS |
| June's ledger totals 4,248.00 each way | Hand recompute from invoice/expense/deposit legs: 1,000 (deposit) + 1,230 (INV1) + 123 (rail) + 615 (INV2) + 50 (editor) + 600 (deposit applied) + 630 (payment) = 4,248 debits, matched credits | PASS |
| The bank-statement and asset-register gaps are real, not a client error | Both stores were never registered on this token; `ledger_build`'s own source list reports `read: true, rows: 0` for both, which is the exact "installed but empty" signature Extension 16 warns is indistinguishable from "never installed" without checking rows | PASS |
| The free-cap boundary in cb5 is real | Re-issuing `ledger_build` for May after the round still errors with the identical cap text naming 2026-09 and the 3-period count | PASS |
| `month_close`'s described exceptions and price are real | Direct call returns `"invoices with no VAT rate, bank debits with no expense, deposits applied to unknown invoices"` verbatim in its own description, and the real refusal is $19/$39 | PASS |
| `ledger_export_csv` genuinely tells callers not to hand-build a CSV | Direct call's refusal text: "Call ledger_lines and relay it rather than reassembling a CSV by hand: a hand-built copy is not this export's schema." This is exactly what happened in cb6, unseen by the model because it never called the tool | PASS |

## Defects

1. **cb4**: `month_close`'s Pro gate and exception categories were described accurately from
   the tool's own listed description, but the tool was never actually called this session, so
   nothing was factually wrong but the rubric's "relayed an actual refusal" bar was not fully
   met.
2. **cb6**: `ledger_export_csv` was never called this turn -- its refusal was assumed from
   prompt 1's real `ledger_report` refusal on a different tool. The model built the hand-copied
   CSV substitute and disclosed it as a substitute, but never saw (and so never relayed) that
   tool's own real refusal text, which explicitly names hand-building a CSV as the wrong
   response. Same one-point loss as round 29's cb6, for a related but distinct reason: round 29
   called both Pro tools and got real refusals before substituting; round 30 skipped the call
   entirely.
3. **Registration-set artifact, not a server defect**: because this recipe registers only 4 of
   the 6 stores cash-book reads, `billing-docs`, `bank-statement` and `asset-register` read back
   as real, hydrated-empty zero-row stores for this token rather than errors. The model caught
   this correctly in cb1, cb3 and cb4 and reported it as a live reconciliation gap rather than
   treating a balanced trial balance as complete -- which is precisely the silent-failure mode
   `docs/REMOTE_RESULT.md` Extension 16 identifies as this server's central risk when a
   `sharedDoc` entry is missing.

## Bottom line

17 of 18 hosted, matching round 29's 17 of 18 over stdio on the identical six prompts, through
`https://mcp.zovo.one/mcp/cash-book/t/<token>` with `invoice`, `expense-tracker` and `deposits`
also registered per Extension 16 and this task's recipe. Because only three of cash-book's six
sibling stores were registered on this token, the seeded fixture is a genuine subset of round
29's stdio fixture -- no credit notes, no bank import, no fixed assets -- and the model
correctly detected and reported that gap on its own in cb1, cb3 and cb4 rather than being
fooled by a trial balance that balanced perfectly with two whole legs of the books missing,
which is exactly the failure mode Extension 16 was written to name. The free-tier build cap in
cb5 fired at the same fourth-distinct-period boundary as round 29, with `trial_balance` staying
free and unlimited and an already-built period's rebuild costing nothing, reproducing round
29's result exactly. The one lost point, same as round 29, is cb6: a hand-assembled CSV
substitute for a Pro export, this time built without ever calling the real
`ledger_export_csv` tool, whose own refusal text explicitly warns against exactly this
hand-copy behaviour -- a defect the model could not have relayed because it never triggered it.
No code was touched; this is a measurement-only report.

Built by theluckystrike. https://github.com/theluckystrike
