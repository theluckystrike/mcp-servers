# Content round 20: /guides/month-end-close-with-mcp-servers, round 27 measurement - 2026-09-05

status: DONE

## What shipped

`billing/src/content.js` (one new `GUIDES` entry), `data/user_value_r27.json`,
`docs/USER_VALUE_R27.md`, `billing/test/guide-figures.test.mjs` and this result file.

## The run behind the guide

One worked month through the **office-suite stdio bundle**, built from source, all **24** children,
**224** tools on one `tools/list`, free tier throughout, one shared profile (Nova Studio,
Europe/Warsaw, EUR, 23 percent, IBAN PL61109010140000071219812874) seeded once before the first
prompt into `xdg/data/mcp-servers/profile/business.json`. Nine prompts, each issued as its own
isolated `claude` CLI invocation under `timeout 240`, `--model sonnet`, `--strict-mcp-config`, 224
explicit `mcp__office__<tool>` allowlist entries, CLI tools denied, empty working directory, fresh
XDG dirs and `MCP_LICENSE_KEY=""` in the server's own `env` block. One conversation via
`--session-id` then eight `--resume`.

**26 of 27. 17 bundle tool calls, 118.6 s, every call in the correct child and the correct tool.**

| Step | Server, tool | Figure |
|---|---|---|
| Invoice Acme, 10 h at EUR 90 | invoice, `invoice_from_hours` | INV-2026-0001, EUR 1,107.00, due 2026-09-19 |
| Credit one hour | billing-docs, `credit_note_create` | CN-2026-0001, EUR -110.70 |
| Retainer in | deposits, `deposit_record` | DEP-2026-0001, EUR 500.00 held |
| Apply it | deposits, `deposit_apply` | invoice partial, EUR 496.30 really left |
| Import Revolut, reconcile | bank-statement, `statement_import`, `reconcile_expenses` | 41 transactions, 33 August debits, EUR 1,283.73 unreceipted |
| Log two expenses | expense-tracker, `expense_add` x2 | 31 left, EUR 1,149.47 |
| Laptop PLN 6,000, September journal | asset-register, `asset_add`, `asset_schedule` | KST 487 at 30 percent, September PLN 0.00, October PLN 150.00 |
| Two-day Berlin trip | per-diem, `perdiem_calc` | EUR 46.75 + EUR 23.37 = EUR 70.12 |
| Statement and aging | statement-of-account, `statement_build`, `statement_aging` | closing EUR 496.30, all of it in 0-30, 11 days overdue |

Two open defects recorded, both one store not knowing what another holds: **D-R95** (the shared
profile reader maps only `default_tax_rate`, so a hand-written `vat_rate: 23` silently produces a
zero-VAT invoice, found and worked around before the scored run) and **D-R96** (`invoice_get` and
`deposit_apply` carry no credit-note awareness, so `balance_due` read EUR 607.00 where the real
figure is EUR 496.30; `statement_aging` nets it correctly).

Fixture: `remote/fixtures/revolut-main.csv` fetched with `curl -o` from `raw.githubusercontent.com`
(HTTP 200, 4,422 bytes) and handed to the model as a local path, because a bare `http://` argument
resolves as a relative filesystem path (D-R83) and the model had no `Bash` or `WebFetch`.

## The guide

`/guides/month-end-close-with-mcp-servers`, nine `<h2>` steps in the order the month was closed.
Each step quotes the prompt verbatim in a `<blockquote>`, names the server in bold and the tool in
`<code>`, and states the figure that run produced. It ends with the statement's closing balance of
EUR 496.30 and a section on what the free tier covered: eight of the nine steps needed nothing paid,
one tool was refused by name (`asset_journal`, Pro), and the free `asset_schedule` answered the same
question. Six FAQ entries, including the closing balance and its make-up, and why the mid-month
retainer figure differs.

## The figures test

`billing/test/guide-figures.test.mjs` is new. It strips the guide's HTML, pulls every numeric token
out of the title, description, body and FAQ, and asserts each one appears in
`data/user_value_r27.json`. Commas are stripped from both sides and digit boundaries are enforced,
so `11` cannot satisfy itself out of `1,107.00`. The first run failed on seven tokens; five were a
boundary bug in the test (a figure at the end of a sentence was rejected by its own full stop) and
two were real, `20.70` and `6,000.00`, which are both figures the stores hold and which were added
to the round file's `verification` string rather than removed from the guide. It now passes with
nothing missing.

## Quality gate

    hype words on the new guide entry (title, description, html, faq)  -> 0
    em dashes on the same                                              -> 0
    non-ASCII on the same                                              -> 0
    same three checks on docs/USER_VALUE_R27.md and data/user_value_r27.json -> 0, 0, 0
    node --check billing/src/content.js                                -> syntax OK
    python3 json.load on data/user_value_r27.json                      -> parses

## Verification

    node scripts/release-check.mjs   -> green, 0 recorded gaps
    cd billing && npm test           -> 75/75

## Concurrency note

Another agent was working the same tree throughout. Its commit `882b07d` swept four of this round's
five files in with its own before this round could stage them, and regenerated `billing/src/pages.js`
from the round file as it then stood. A later edit to the round file's `p2` note broke
`first-five.test.mjs`, which checks that the evidence sentence rendered on a `/s/<id>` page is still
a substring of the note it came from. Fixed by restoring both notes to the exact wording `pages.js`
was generated against and putting the two added figures in the round file's `verification` string
instead, which keeps `pages.js` untouched. 75/75 after.

The `statement-of-account` entry in `servers/office-suite/src/index.ts` `CHILDREN`, needed to make
the twenty-fourth child, was already committed in `df258e9`; nothing in this round changed it.

Zero paid API calls.
