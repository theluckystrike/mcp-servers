# User value audit, round 27 - 2026-09-05

Round 27 is the **worked month** round. Round 17 asked six unrelated sentences of a nineteen-child
bundle and measured whether the client still found the right tool at 186 tools. Round 27 asks a
different question of the same shape at a larger scale: **twenty-four children, 224 tools, one stdio
connection, one shared profile, free tier, and nine prompts that are not six samples but one month
closed from the first invoice to the client's statement of account.**

The test is not "did it pick the right tool". It is whether the number at the end agrees with the
numbers at the start. A statement of account is the only document in this suite that reads three
separate stores at once, so it is the only prompt that can be wrong because two servers disagree.

**Result: 26 of 27.** Closing balance EUR 496.30, and it reconciles to the minor unit against the
invoice, the credit note and the deposit that produced it.

## Method

- **Server** - `servers/office-suite/dist/index.js`, built from source this round, registered as ONE
  stdio server named `office`, proxying all **24** children. `statement-of-account` was wired into
  `servers/office-suite/src/index.ts` `CHILDREN` to make the twenty-fourth; that edit is the only
  source change the round required. A live `tools/list` against the built bundle returns **224
  tools**, and exactly four names needed a child prefix: `invoice_business_set`,
  `docx_business_set`, `expense-tracker_category_rules`, `bank-statement_category_rules`.
- **Client** - `claude` CLI **2.1.261**, `-p`, `--model sonnet`, `--strict-mcp-config`,
  `--mcp-config /private/tmp/uv-r27/mcp.json`, `--output-format stream-json --verbose
  --max-turns 14`, one bounded request per prompt under `timeout 240`, **each of the nine issued as
  its own isolated shell invocation** with its transcript read back before the next prompt ran.
- **Allowlist** - **224 explicit `mcp__office__<tool>` entries**, written out by name from the live
  `tools/list`, because `--allowedTools "mcp__*"` grants nothing.
- **The CLI's own tools are denied** - `Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,
  NotebookEdit,Task,TodoWrite,Agent`, and every turn ran in an **empty working directory**
  (`/private/tmp/uv-r27/wd`). Anything the model achieved, it achieved through the bundle.
- **One conversation** - `--session-id` on prompt 1, `--resume` on the eight after it, so "that
  invoice", "the retainer" and "that card" point at something.
- **Free tier throughout** - `MCP_LICENSE_KEY=""` and fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` /
  `XDG_CACHE_HOME` / `XDG_STATE_HOME` under `/private/tmp/uv-r27/xdg`, all set **in the server's own
  `env` block inside `mcp.json`**, never in the CLI's environment and never `CLAUDE_CONFIG_DIR`.
- **Shared profile, seeded once** before prompt 1: Nova Studio, Europe/Warsaw, `default_currency`
  EUR, `default_tax_rate` 23, `payment_terms_days` 14, IBAN PL61109010140000071219812874. Every
  child store started empty.
- **Fixture** - `remote/fixtures/revolut-main.csv` fetched with `curl -o` from
  `raw.githubusercontent.com` to a local path and handed to the model as that path. The bundle
  resolves a bare `http://` argument as a relative filesystem path (D-R83) and the model had no
  `Bash` or `WebFetch` to fetch it itself.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap to close. 1 = partially wrong. 0 = failed. **Tool-call counts
exclude the client's own `ToolSearch` schema lookups.**

## Scorecard - 26 / 27

| # | Child | Prompt | Score | Calls | Sec |
|---|---|---|---|---|---|
| 1 | invoice | "Invoice Acme for 10 hours of design work at 90 euros an hour, dated today." | **3** | 2 | 12.6 |
| 2 | billing-docs | "One of those hours was mine, not billable. Credit Acme one hour on that invoice." | **3** | 1 | 10.0 |
| 3 | deposits | "Acme just paid a 500 euro retainer, today, by bank transfer." | **3** | 1 | 7.2 |
| 4 | deposits | "Yes, apply the retainer to that invoice and tell me what is left to pay." | **2** | 1 | 11.9 |
| 5 | bank-statement | "Import my Revolut export at ... and reconcile it against my expense log for August 2026" | **3** | 3 | 22.5 |
| 6 | expense-tracker | "Log two expenses I paid on that card: OpenAI 72.76 ... Adobe Creative Cloud 61.50 ..." | **3** | 3 | 11.1 |
| 7 | asset-register | "I bought a laptop for 6,000 zloty ... give me September's depreciation journal entry." | **3** | 3 | 20.7 |
| 8 | per-diem | "I am going to Berlin ... Breakfast is included at the hotel both days. What diet am I owed?" | **3** | 1 | 13.5 |
| 9 | statement-of-account | "Give me Acme's statement of account for September 2026 and show me the aging" | **3** | 2 | 9.1 |

**Totals: 17 bundle tool calls, 118.6 s of wall clock, 26 / 27 (96%).**

## The month, in the figures the stores hold

| Step | Server, tool | What the store holds |
|---|---|---|
| Bill it | invoice, `invoice_from_hours` | INV-2026-0001, 10 x EUR 90.00 = EUR 900.00 net, 23% = EUR 207.00, **EUR 1,107.00**, due 2026-09-19 |
| Credit the hour | billing-docs, `credit_note_create` | CN-2026-0001 against INV-2026-0001, EUR -90.00 net, EUR -20.70 VAT, **EUR -110.70** |
| Take the retainer | deposits, `deposit_record` | DEP-2026-0001, **EUR 500.00** from Acme, held |
| Set it against the invoice | deposits, `deposit_apply` | INV-2026-0001 now `partial`, `paid_minor` 50000 |
| Import the bank | bank-statement, `statement_import` | account `revolut-main`, **41** transactions, 36 in August, 33 card debits |
| Reconcile | bank-statement, `reconcile_expenses` | all **33** unreceipted, **EUR 1,283.73** |
| Log two receipts | expense-tracker, `expense_add` x2 | OpenAI EUR 72.76, Adobe Creative Cloud EUR 61.50; re-reconcile leaves **31**, **EUR 1,149.47** |
| Capitalise the laptop | asset-register, `asset_add` | ASSET-2026-0001, KST 487, **30 percent**, PLN 6,000.00, life 3.33 years |
| September's journal | asset-register, `asset_schedule` | September **PLN 0.00**; first charge October 2026 at **PLN 150.00** a month |
| Price the trip | per-diem, `perdiem_calc` | Germany diet EUR 55.00; day 1 EUR 46.75, day 2 EUR 23.37, **EUR 70.12** |
| Close the month | statement-of-account, `statement_build` | opening EUR 0.00, invoiced EUR 1,107.00, paid EUR 500.00, credited EUR 110.70, **closing EUR 496.30** |
| Age what is left | statement-of-account, `statement_aging` | **EUR 496.30** in 0-30, EUR 0.00 in 31-60, 61-90 and over 90, 11 days overdue |

## What the round actually found

**Every one of the seventeen bundle calls landed in the correct child and the correct tool within
it, at 224 tools on one `tools/list`.** Round 17 recorded the same result at 186 tools with nineteen
children. Adding five more children and 38 more tools did not degrade selection.

**The single point lost is not a selection failure.** On prompt 4 the model called the right tool,
`deposit_apply`, and the tool answered with `balance_due` EUR 607.00, which is the invoice total
less the payment and takes no account of the credit note at all. The model caught it, said so, and
built the real figure by hand: EUR 496.30. The right answer reached the user because the model
remembered a document the tool it called cannot see. That is D-R96 below.

**The free tier covered the whole month except one thing.** `asset_journal` is Pro and refused by
name on prompt 7. The model did not stop and did not invent a journal: it fell back to the free,
unlimited `asset_schedule`, answered the actual question (September's charge is PLN 0.00, because
the Polish convention starts depreciation the month after an asset enters use), and named the Pro
gate and its price rather than hiding the refusal. Eight prompts needed nothing paid at all.

**Three answers volunteered something the user did not ask for and would have got wrong.** Prompt 6
warned that the *second* Adobe Creative Cloud charge of EUR 61.50 on 21 August is a separate debit
and is still unmatched. Prompt 8 reported lodging as EUR 0.00 **with the reason**, that the foreign
table bundles no per-country lodging limit for Germany, instead of quietly dropping it. Prompt 1
flagged both loose ends it had left, the client auto-created with no address and the VAT rate it had
applied on its own, without withholding the write to ask about either.

## Independent verification

Read off the stores on disk and off four direct `tools/call` probes against the same data directory,
never off the model's prose.

| Check | Method | Result |
|---|---|---|
| 224 tools, 24 children | `tools/list` against the built `dist/index.js` | PASS |
| Invoice arithmetic | `invoice/invoices.json`: `unit_price_minor` 9000 x 10, `tax_lines` rate 23 base 90000 tax 20700, `total_minor` 110700 | PASS |
| Terms came from the profile | `issue_date` 2026-09-05, `due_date` 2026-09-19 = +14 | PASS |
| VAT unwound at the rate charged | `credit-notes.json` CN-2026-0001: `net_minor` -9000, `tax_minor` -2070, `total_minor` -11070 | PASS |
| The credit names its invoice | same record: `invoice_number` INV-2026-0001, `invoice_total_minor` 110700 | PASS |
| The retainer is a payment on the invoice | `invoices.json` `status` partial, `paid_minor` 50000; `deposits.json` DEP-2026-0001 `status` applied | PASS |
| The bank import | `bank-statement/data.json`: 41 transactions, 36 dated 2026-08, 33 negative summing to -128373 minor | PASS |
| One line was correctly not imported | the CSV holds 42 data rows; the `REVERTED` hotel line is absent from the store | PASS |
| The reconciliation subtraction | 128373 - 7276 - 6150 = 114947, the EUR 1,149.47 the model reported | PASS |
| Expenses took the profile VAT | `expense-tracker/data.json`: both rows `vat_rate` 23, amounts 7276 and 6150 minor | PASS |
| The depreciation rate | `assets.json` `rate_pct` 30, `category` 487, against `servers/asset-register/src/tables/pl-kst.json` KST 487 at 30 percent | PASS |
| The schedule sums to cost | probe: `asset_schedule` granularity month, 51 rows, 39 at 15000 minor and 12 at 1250, total 600000, `first_charge_month` 2026-10 | PASS |
| The German diet | probe payload `subsistence_minor` 7012, days 4675 and 2337, against `servers/per-diem/src/tables/pl-foreign.json` Germany `diet_minor` 5500 | PASS |
| The statement closes | `statement-of-account/statements.json`: opening 0, invoiced 110700, paid 50000, credited 11070, **closing 49630** | PASS |
| The aging agrees | probe: `statement_aging` as at 2026-09-30, `open_minor` 49630 in 0-30, `days_overdue` 11, `unapplied_credit_minor` 0 | PASS |

## Defects

**D-R95, invoice, open.** *A hand-written shared business profile silently loses the VAT rate.*
`business_set` accepts `vat_rate`, `tax_rate` and `vat` as aliases for `default_tax_rate`, but the
shared-profile reader in `servers/invoice/src/store.ts` `getBusiness` maps only the exact key
`default_tax_rate`. A first attempt at this round seeded the profile with `vat_rate: 23`; the very
first invoice came back at EUR 900.00 with `tax_rate` 0 on the line and `tax_minor` 0 in the store,
and **nothing in the response said a rate had been dropped**. Reseeding with `default_tax_rate`
produced EUR 1,107.00. Fix: accept the same aliases the write path already accepts, or say in the
response that the profile carried no default rate.

**D-R96, invoice and deposits, open.** *The invoice store has no idea a credit note exists.*
`deposit_apply` reported `balance_due` EUR 607.00, and a direct `invoice_get` probe carries only
`total_minor` 110700 and `paid_minor` 50000, with no credited or open field at all. CN-2026-0001 is
invisible to both. `statement-of-account` does net it, returning `open_minor` 49630, so the document
a client actually receives is right; the gap is in the two tools a user is most likely to ask
mid-month. Cost this round: the one point on prompt 4.

Both defects are the same shape: one store not knowing what another store holds. Neither put a wrong
number in front of the user, because in each case something downstream caught it. That is a thinner
margin than it should be.

## Bottom line

26 of 27, on the free tier, one stdio connection, one shared profile, eight of twenty-four children
exercised. A worked month came out the other end with a client statement whose closing balance,
**EUR 496.30**, agrees to the minor unit with the invoice, the credit note and the deposit that
produced it. Zero paid API calls.
