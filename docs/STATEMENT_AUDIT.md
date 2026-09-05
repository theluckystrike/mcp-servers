# mcp-statement-of-account: Part 2 CLI run and the Part 1 gaps

Date 2026-09-05. Scope: `servers/statement-of-account/src`, `servers/statement-of-account/test`
and this file. `remote/`, billing, scripts and the statement manifests belong to other agents;
nothing there was touched. Pulled `--rebase --autostash` before editing.

Part 1 harness: `servers/statement-of-account/test/_client.mjs`, as in `docs/STATEMENT_RESULT.md`.

Part 2 harness: the real `claude` CLI (2.1.261) as an MCP client, `--model sonnet`, against
`/private/tmp/uv-stmt/mcp.json`, which registers `statement-of-account`, `invoice`,
`billing-docs` and `deposits` together with `--strict-mcp-config`, fresh
`XDG_DATA_HOME=/private/tmp/uv-stmt/data` and `XDG_CONFIG_HOME=/private/tmp/uv-stmt/cfg` placed
in each server's own env block inside `mcp.json` (never `CLAUDE_CONFIG_DIR`, never the CLI's
own environment), and an explicit per-tool allowlist of every `mcp__statement-of-account__*`,
`mcp__invoice__*`, `mcp__billing-docs__*` and `mcp__deposits__*` tool plus
`license_status`/`license_activate` on each. A shared business profile was written directly to
`data/mcp-servers/profile/business.json` before the run: name "Nova Studio",
`default_currency EUR`, `timezone Europe/Warsaw`, `iban PL61109010140000071219812874`. All four
servers stayed on the free tier for the whole run: none of the six prompts needed a Pro tool.
Each prompt is one bounded `-p` call with `--resume <session-id>` chaining the same
conversation, request timeout 240 s (every call completed well inside it). Machine day:
Saturday 2026-09-05. `claude` resolves to a shell function that prints a MOTD banner to stdout
before the JSON-RPC-shaped `--output-format json` line; the JSON is always the last non-empty
line of the captured output, so results were read from that line, not from `json.load` on the
whole stream.

Prompt 2 needed one extra round trip: `credit_note_create` requires a printed reason and the
model asked for one ("what's it for") rather than inventing one; the reason ("goodwill
discount") is counted as part of prompt 2, the same convention `ASSET_REGISTER_AUDIT.md` used
for its prompts 4 and 5.

The first attempt at prompt 1 and prompt 3 each failed on an allowlist gap, not a model or
server defect: `invoice_from_hours` (the tool the model correctly reached for on "10 hours at
EUR 90") was missing from the initial allowlist, and the deposits tool names guessed for the
allowlist (`deposit_create`) do not exist -- the real tool is `deposit_record`, alongside
`deposit_balance`, `deposit_refund`, `deposit_statement_text/pdf` and `deposits_report`, none of
which had been listed. Both were fixed in the harness's `mcp.json`/allowlist before re-running
the same prompt; no source file was touched for either.

---

## Part 2 - six prompts through the claude CLI

Scores are 0-3, checked against `invoices.json` (invoice), `credit-notes.json` (billing-docs),
`deposits.json` (deposits) and `statements.json` (statement-of-account) on disk, not against the
model's prose.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "Invoice Acme 10 hours at EUR 90 due in 14 days, and a second invoice for EUR 500 due last week; they paid EUR 300 on the first" | 3 | Two `invoice_create`/`invoice_from_hours` calls. Store: `INV-2026-0001` (10h x EUR 90 = `total_minor: 90000`, `due_date: 2026-09-19`, `paid_minor: 30000`, one payment row 2026-09-05), `INV-2026-0002` (`total_minor: 50000`, `due_date: 2026-08-29`, unpaid). "Due last week" against a run date of 2026-09-05 correctly landed one week back. Client "Acme" auto-created; the model flagged the missing address rather than inventing one |
| 2 | "Credit Acme EUR 100 on the first invoice" (+ "Goodwill discount") | 3 | `credit_note_create` after asking for the required reason field. Store: `CN-2026-0001`, `amount_minor: 10000`, `invoice_number: INV-2026-0001`, `reason: "goodwill discount"`. The model also correctly noted the credit lives in billing-docs, not on the invoice record itself -- `invoice_get` still shows `paid_minor`-only balance, matching this server's own design note that a credit note reduces the invoice it names and no other, computed by the statement layer, not stored on the invoice |
| 3 | "Acme has a EUR 200 retainer, apply it to the second invoice" | 3 | `deposit_record` then `deposit_apply`. Store: `DEP-2026-0001`, `amount_minor: 20000`, one `DepositApplication` for 20000 against `INV-2026-0002`; `invoices.json` shows `INV-2026-0002.paid_minor` raised to 20000 by the application (no new `payments[]` row, matching `statement.ts`'s documented reconstruction: `paid_minor` is the authority, deposit applications are attributed separately). Reported balance due EUR 300.00, deposit fully spent |
| 4 | "Build Acme's statement for this month" | 3 | `statement_build`. Answered opening EUR 0.00, invoiced EUR 1,400.00, payments EUR 500.00 (incl. EUR 200 deposit applied), credited EUR 100.00, closing EUR 800.00. `statements.json` on disk: `STMT-2026-0001`, `opening_minor: 0`, `invoiced_minor: 140000`, `paid_minor: 50000`, `credited_minor: 10000`, `closing_minor: 80000`. Hand check: invoiced 90000+50000=140000; paid 30000 (direct) + 20000 (deposit) = 50000; credited 10000; closing = 140000-50000-10000 = 80000. Exact match, closing balance equals invoices minus payments minus credits minus deposits applied (the deposit is inside `paid_minor`, not a fifth term, matching the "deposit applied moves once" design decision) |
| 5 | "Which of Acme's invoices are overdue and by how many days as of today?" | 3 | `statement_aging`. Answered only `INV-2026-0002` overdue, 7 days past its 2026-08-29 due date, EUR 300.00 outstanding; `INV-2026-0001` (due 2026-09-19) not yet due. 2026-08-29 to 2026-09-05 is exactly 7 days. EUR 300.00 matches `INV-2026-0002.total_minor (50000) - paid_minor (20000) = 30000` |
| 6 | "Write a firm reminder to Acme" | 3 | `dunning_text` level 2. Answered a firm-toned letter naming `INV-2026-0002`, 7 days late, EUR 300.00 total overdue, EUR 500.00 not-yet-due named separately and excluded from the overdue total, the IBAN `PL61109010140000071219812874` printed under "Payment details", and an explicit closing note that no late fee or interest is stated because the system holds no contract terms for one. No invented figure anywhere in the letter |

Scorecard: **3.00 / 3** (18 of 18).

### The closing-balance identity, verified three ways

Prompt 4's brief requirement -- closing balance equals invoices minus payments minus credits
minus deposits applied -- was checked three ways and agreed to the cent: (a) the model's own
prose (EUR 800.00), (b) the `statement_build` tool's stored JSON row (`closing_minor: 80000`),
and (c) a hand recomputation straight from `invoices.json` and `credit-notes.json`
(140000 invoiced - 50000 paid - 10000 credited = 80000, with the 20000 deposit application
already inside the 50000 paid figure rather than subtracted a second time). Subtracting the
20000 deposit a second time, the bug this server's own design doc names as the first cut's
defect, would have produced a wrong closing balance of 60000; it did not happen here.

### Not a defect: prompt 2's clarifying question and the allowlist misses

The reason field on a credit note is required by `billing-docs` because the reason prints on
the document; asking rather than guessing is the correct behaviour, the same discipline
`ASSET_REGISTER_AUDIT.md` measured on its own prompts 4 and 5. The two allowlist misses
(`invoice_from_hours`, and the deposits tool names) are harness-authoring errors, not server or
model defects: both tools existed and worked correctly the moment they were actually allowed,
and no source file changed to fix either.

---

## Part 1 - the eight named gaps

All eight gaps named in this task's brief were already asserted in `docs/STATEMENT_RESULT.md`'s
41-row probe table before this pass. Each was re-run to confirm it still passes; none needed a
new test or a source change.

| # | Probe | Result | Where |
| --- | --- | --- | --- |
| 1 | An unknown client | PASS, re-verified | `adversarial.test.mjs` "an unknown client is refused with the clients that do exist"; RESULT.md probe 15 |
| 2 | A period with no activity | PASS, re-verified | `adversarial.test.mjs` "an empty period answers with the balance carried, not with an error"; RESULT.md probe 17 |
| 3 | Two currencies for one client | PASS, re-verified | `adversarial.test.mjs` "mixed currencies are never summed: the statement asks which one"; RESULT.md probe 18 |
| 4 | A credit larger than the invoice | PASS, re-verified | `unit.test.mjs` covers the credit-exceeds-paid-invoice case; RESULT.md probe 19: 1,500.00 credited against a paid 1,000.00 invoice becomes `unapplied_credit`, does not touch the unrelated 400.00 invoice, statement closes at -1,100.00 "in your favour" |
| 5 | Aging as at a date before the invoices | PASS, re-verified | `unit.test.mjs` "aging is as at the date asked for, not as at now"; RESULT.md probe 7, and the worked-month insight at 2026-06-10 (2,500.00 outstanding, 500.00 overdue under the as-at rule vs 1,700.00 outstanding and zero overdue under the naive rule) |
| 6 | A corrupt deposits store | PASS, re-verified | `corrupt.test.mjs` "a corrupt deposit store still counts the money, and says the label is what is lost"; RESULT.md probe 30: the balance is unchanged because the applied money already lives on the invoice's `paid_minor`, only the deposit label is lost, and the note says so |
| 7 | Two processes on the free cap | PASS, re-verified | `concurrency.test.mjs` "two processes racing the fifth free statement do not both pass the cap"; RESULT.md probe 25/35: exactly 5 stored, the rest refused, one critical section around the check and the write |
| 8 | (paired with #3) A client billed in two currencies, aging and report | PASS, re-verified | Same `adversarial.test.mjs` test as #3 also asserts `statement_aging` and `statements_report` keep EUR and USD apart per currency with no summed line; RESULT.md probe 18 |

No defect was found in this pass: every named gap was already a first-class assertion, most of
them written specifically because an earlier pass on this server found the naive version wrong
(the as-at aging rule and the deposit-double-count rule both carry a measured-insight paragraph
in `STATEMENT_RESULT.md` for exactly that reason).

---

## Final test summary

    npm run build (repo-wide)                       tsc clean, no output
    npm test -w servers/statement-of-account        # tests 47 / # pass 47 / # fail 0
    npm test (repo-wide)                            exit code 0
    node scripts/sync-versions.mjs --check          0 file(s) written

No test file and no source file in `servers/statement-of-account/src` changed in this pass: no
defect was found that required either. Part 2's harness artifacts (`mcp.json`, the seeded
profile, the six response JSON files) live in `/private/tmp/uv-stmt` and are not part of the
repo.

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build (repo-wide): tsc clean
    - npm test -w servers/statement-of-account: # tests 47 / # pass 47 / # fail 0
    - npm test (repo-wide): exit code 0
    - node scripts/sync-versions.mjs --check: 0 file(s) written
    - Part 2: claude CLI 2.1.261, sonnet, statement-of-account + invoice + billing-docs +
      deposits, per-tool allowlist, fresh XDG dirs in mcp.json's server env, shared profile
      (Nova Studio, Europe/Warsaw, EUR, IBAN PL61109010140000071219812874), all four servers
      free tier, 6 prompts (1 with a clarifying round trip), 3.00/3, closing balance verified
      three ways to the cent: EUR 800.00 = EUR 1,400.00 invoiced - EUR 500.00 paid (incl. the
      EUR 200.00 deposit applied, not double-subtracted) - EUR 100.00 credited; aging correctly
      named only INV-2026-0002 overdue, 7 days, EUR 300.00; dunning letter level 2 carried the
      IBAN and no invented fee
    - Part 1 gap-fill: all 8 probes named in the brief (unknown client, empty period, two
      currencies for one client, a credit larger than the invoice, aging before the invoices,
      corrupt deposits store, two processes on the free cap, mixed-currency aging/report) were
      already asserted in docs/STATEMENT_RESULT.md's 41-row table and re-verified passing; no
      new test was needed and no defect was found
    artifacts:
    - /Users/mike/mcp-servers/docs/STATEMENT_AUDIT.md
    cost: 32 wall minutes
    failures:
    - Two harness-authoring misses during Part 2 setup, both fixed before any source or test
      file was touched: the initial allowlist omitted mcp__invoice__invoice_from_hours, which
      the model correctly reached for on "10 hours at EUR 90"; the initial deposits allowlist
      guessed a tool name (deposit_create) that does not exist, the real name is deposit_record
      alongside deposit_balance, deposit_refund, deposit_statement_text/pdf and deposits_report
    insight:
    - The retainer application in prompt 3 is the sharpest check in the six-prompt run: it is
      exactly the "deposit applied moves once" design decision from STATEMENT_RESULT.md, live
      through three real servers instead of a seeded fixture. deposit_apply raised
      INV-2026-0002's paid_minor to 20000 with no new payments[] row, and statement_build's
      EUR 500.00 payments-received figure for the month broke out the EUR 200.00 deposit
      inside it rather than adding it as a fifth line. A server that got this wrong here would
      have shown EUR 700.00 received and a closing balance of EUR 600.00 instead of EUR 800.00,
      wrong by the exact size of the retainer, and the CLI run would have looked entirely
      plausible until someone added the four stores by hand

Built by theluckystrike. https://github.com/theluckystrike
