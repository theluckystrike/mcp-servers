# User value audit, round 32 (amortization, hosted) - 2026-09-06

Round 32 is a single-lane hosted re-run of round 31's six amortization prompts
(`data/user_value_r31.json`), which measured the server for the first time over stdio on the
free tier and scored 15/18. This round asks the identical six questions against
`https://mcp.zovo.one/mcp/amortization` per `docs/REMOTE_RESULT.md` Extension 17, with only
`/mcp/cash-book` also registered on the same token, per this task's recipe. No code was
changed as part of this round; it is measurement only. Cap: 30 minutes, met.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect -m 15` -> 200 `text/html`, 8,912 bytes,
  minting `anon_096f6c4a9dd1ed2fc939eee1b0dce56b`. One token, reused for the whole lane.
- **Profile.** `business_set` called directly by curl on `/mcp/invoice` with the same token
  before any prompt ran: Nova Studio, `Europe/Warsaw`, `EUR`. The tool's own confirmation
  lists which endpoints read the shared profile -- asset-register, bank-statement, barcode,
  calendar, clauses, currency, docx, expense-tracker, image, kanban, pdf, per-diem, quotes,
  resume, statement-of-account, time-tracker, timezone -- and amortization and cash-book are
  NOT among them. This step was done anyway per the recipe; it has no measurable effect on
  the lane under test.
- **Registration.** One `mcp.json`, two `http` entries, both
  `https://mcp.zovo.one/mcp/<server>` with an `Authorization: Bearer <token>` header (no
  `/t/<token>` path form, no `--header` flag on the CLI): `amortization` (the lane under
  test) and `cash-book`. Cash-book was registered per the recipe but never called: no prompt
  named it and no journal step reached it (the journal tool tested is `loan_journal` on
  amortization itself, which returns an `expense_add`-ready payload rather than posting
  anywhere).
- **Allowlist.** 16 explicit `mcp__<server>__<tool>` entries read from a live `tools/list` of
  both endpoints: amortization 8 (`license_activate`, `license_status`, `loan_create`,
  `loan_journal`, `loan_list`, `loan_repay_early`, `loan_schedule`, `loans_report`),
  cash-book 8 (`ledger_build`, `ledger_export_csv`, `ledger_lines`, `ledger_report`,
  `license_activate`, `license_status`, `month_close`, `trial_balance`). No `mcp__*`
  wildcard.
- **Client.** `claude` CLI 2.1.261, `-p`, `--model sonnet`, `--strict-mcp-config`,
  `--mcp-config` pointing at the two-entry file above, `--output-format json`, one
  `--session-id` then five `--resume` so all six prompts are one conversation, one bounded
  request per prompt under `timeout 240` (every call completed well inside it), each of the
  six issued as its own isolated shell invocation and its result read back before the next
  prompt ran.
- **Empty working directory, disallowed CLI tools.** Every turn ran in an empty
  `/private/tmp/uv-r32am/wd`, with `Bash, Read, Write, Edit, Glob, Grep, WebFetch,
  WebSearch, NotebookEdit, Task, TodoWrite, Agent` denied. Fresh `XDG_DATA_HOME` /
  `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` / `XDG_STATE_HOME` under `/private/tmp/uv-r32am/xdg`
  for every `claude` invocation, in the server env block context only (the servers
  themselves are hosted; these dirs guard the CLI's own local footprint).
  `npm_config_cache=/Users/mike/.npm-cache-local` and `PATH` prefixed with
  `$HOME/.npm-global/bin` for every call.
- **Verification.** After the six prompts, `loan_list` (`as_of: 2026-06-30`) and
  `loan_schedule` for both `LOAN-2026-0001` (Van finance) and `LOAN-2026-0002` (Office
  fitout) were called directly by curl on the same token, and every numeric figure any
  prompt reported was checked against those calls per loan, never against a currency
  aggregate the model itself constructed.
- **A method limitation, disclosed.** `--output-format json` returns one aggregate result
  object per call and does not enumerate individual `tool_use` blocks the way
  `--output-format stream-json --verbose` does. The `calls` listed per scenario below are
  inferred from the register's resulting state (loan count, ids, terms, the free-cap
  refusal) rather than read off a raw tool-call transcript. This does not affect the figure
  verification, which was done against the register directly, but it is weaker evidence for
  the exact call sequence than round 31's stdio audit had.

## Scorecard - 15 / 18 (round 31, stdio: 15 / 18)

| # | Prompt | R31 (stdio) | R32 (hosted) | What happened |
|---|---|---|---|---|
| am1 | Record the van finance loan, tell me plainly what it costs | 3 | **3** | LOAN-2026-0001, EUR 888.49/month, EUR 661.88 total interest, 12.68% effective rate. Every figure matches `loan_list` exactly |
| am2 | Show the whole schedule, where the interest goes | 3 | **2** | All 12 rows exact, but the model's own summed six-month interest half-total came out EUR 481.14 against the correct EUR 480.14 -- a 1.00 arithmetic slip on data it had just printed correctly |
| am3 | Is the last row's interest a bug? | 3 | **3** | Correctly defended the design: the final period absorbs the rounding residual so the balance closes exactly at zero, echoing the server's own `basis` field almost verbatim |
| am4 | Straight-line vs annuity, call it "Office fitout" | 2 | **2** | EUR 11.88 cheaper, first/last payments exact, but the average monthly step quoted as "about EUR 7.58" against the true EUR 8.33 -- a second self-computed arithmetic slip. The round 31 defect (a hallucinated duplicate loan record) did NOT recur: `loan_list` shows exactly one Office fitout loan |
| am5 | Add two more loans, total owed 30 June | 2 | **3** | Coffee machine correctly refused at the 3-loan free cap; the reported total EUR 17,789.15 covers exactly the three loans that exist, matching `loan_list`'s own aggregate exactly. The round 31 defect (a bolded total including debt for a refused agreement) did NOT recur |
| am6 | Journal the first payment, price early settlement | 2 | **2** | All arithmetic exact against the free schedule, but the hand-built journal used invented account names ("Loan liability -- Van finance", "Cash / Bank") instead of the real ids (`interest_expense`, `loan_liability`, `cash`) `loan_journal` would have returned. Identical defect to round 31 am6 |

**Totals: 15/18 hosted, matching round 31's 15/18 over stdio on the identical six prompts.**

## Independent verification

| Claim | Evidence | Verdict |
|---|---|---|
| am1's figures | `loan_list` on the token: `payment_minor 88849`, `total_interest_minor 66188`, `effective_annual_rate_bps 1268`, `start_date 2026-01-15` | PASS |
| am2's twelve rows | `loan_schedule` LOAN-2026-0001: all 12 rows match to the minor unit, including period 12 interest 882 | PASS on rows, FAIL on the derived half-total: rows 1-6 interest (10000+9212+8415+7611+6798+5978) = 48014 minor = EUR 480.14, not the reported EUR 481.14 |
| am3's design defence | `loan_schedule`'s `basis` field: "the last period absorbs the rounding residual in its interest and principal split, so the closing balance reaches the balloon, or zero, exactly" | PASS, near-verbatim |
| am4's cost comparison | `loan_schedule` LOAN-2026-0002 (straight-principal): `total_interest_minor 65000` (EUR 650.00, EUR 11.88 less than 661.88), `payment_minor` 93333 falling to 84166 (EUR 933.33 to EUR 841.66) | PASS on the endpoints, FAIL on the derived step: (933.33-841.66)/11 = EUR 8.33/month, not the reported "about EUR 7.58" |
| am4's duplicate-record claim (round 31 only) | `loan_list` on this token shows exactly one `LOAN-2026-0002` "Office fitout" | Not reproduced this round -- there is nothing to fail against, because the model never made the claim |
| am5's total | `loan_list as_of=2026-06-30`: `outstanding_by_currency` EUR 17,789.15 across LOAN-2026-0001 (5,977.91), LOAN-2026-0002 (5,833.33), LOAN-2026-0003 (5,977.91) -- exactly the three loans that exist | PASS, exact match, no phantom balance for the refused Coffee machine |
| am6's journal and settlement arithmetic | `loan_schedule` LOAN-2026-0001 period 1: interest_minor 10000, principal_minor 78849, payment_minor 88849; closing after period 6: 514920; periods 7-12 interest sum 18174; 6 x 88849 = 533094; 533094 - 519920 = 13174 | PASS on every number |
| am6's account names | The hand-built entry used "Loan liability -- Van finance" and "Cash / Bank"; the real `loan_journal` payload (per `docs/AMORTIZATION_AUDIT.md`'s stdio verification) uses the ids `interest_expense`, `loan_liability`, `cash` | FAIL, same defect class as round 31 |

## Defects

1. **am2**: a plain arithmetic error, not a server-figure error. The model summed its own
   already-correct six monthly interest rows and reported EUR 481.14 instead of the correct
   EUR 480.14.
2. **am4**: a second arithmetic error of the same class. The average monthly step in the
   straight-line schedule was quoted as "about EUR 7.58" against the true EUR 8.33, while
   both endpoints of that same range (the first and the final payment) were exact.
3. **am6**: the same defect as round 31 am6, unchanged. Refused `loan_journal`, the model
   rebuilt the double entry with account names of its own invention rather than the real
   ids the tool's `expense_add`-ready payload carries. The arithmetic is exact; only the ids
   that matter for anything downstream are invented.

## Does the round 31 client-side pattern recur?

Round 31's own bottom line named two client-side failure shapes: totals computed over data
the server had refused to write (am5), and a hand-built journal in account names of the
model's own invention rather than the server's real ids (am6). Only one of those two
recurred in this hosted run.

- **am5 (totals over refused data): did NOT recur.** Asked for a total after Coffee machine
  was refused at the free cap, this run correctly totalled only the three loans that
  actually exist, and that total matches `loan_list`'s own aggregate exactly. This is a
  genuine improvement on the identical prompt, not a coincidence of different wording --
  the prompt text is unchanged from round 31.
- **am6 (hand-written journal, invented account names): recurred unchanged.** Same prompt,
  same defect, same shape: refused the Pro tool, then substituted its own account labels
  for the real ids while getting every number right.
- **A new, different pattern appeared instead, twice (am2, am4).** Both are the model doing
  its own arithmetic over rows it had already fetched and reported correctly, and getting a
  small sum wrong -- by exactly one euro in am2, by about seventy-five cents a month in am4.
  This is not the round 31 pattern: nothing was refused in either case, and every underlying
  server figure the model summed or averaged was itself correct. It is best read as the same
  underlying risk in a different shape -- the model substituting its own computation for a
  server-verified one -- surfacing on free, unlimited data (`loan_schedule`) rather than on
  data a Pro gate withheld.

## Bottom line

15 of 18 hosted, matching round 31's 15 of 18 over stdio on the identical six prompts,
through `https://mcp.zovo.one/mcp/amortization` with `cash-book` also registered but never
called. The total score is identical, but the composition of the three lost points changed
completely. Both of round 31's named client-side failure shapes were tested again on
unchanged prompts: the totals-over-refused-data defect (am5) did not reappear -- the model
correctly excluded the refused Coffee machine from its total, matching the server's own
aggregate to the cent -- while the hand-written-journal-with-invented-account-names defect
(am6) reappeared identically. In their place, two new arithmetic slips surfaced on free,
unrefused data in am2 and am4: the model twice summarised its own already-correct rows and
got the summary wrong by a small margin. Every figure the server itself returned, across all
six prompts, matched `loan_list` and `loan_schedule` re-derived independently on the same
token afterward, asserted per loan and never against a currency aggregate the model
constructed on its own. No code was touched; this is a measurement-only report.

Built by theluckystrike. https://github.com/theluckystrike
