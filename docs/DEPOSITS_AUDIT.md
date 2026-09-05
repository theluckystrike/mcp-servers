# mcp-deposits: Part 2 CLI run and the remaining Part 1 probes

Date 2026-09-05. Scope: `servers/deposits` only (src, test) plus this file. `remote/`, billing,
scripts, `servers/invoice` and the deposits manifests belong to other agents; nothing there was
touched.

Part 1 harness: `servers/deposits/test/_client.mjs`, as in `docs/DEPOSITS_RESULT.md`.

Part 2 harness: the real `claude` CLI (2.1.261) as an MCP client, `--model sonnet`, against
`/private/tmp/uv-deposits/mcp.json`, which registers `deposits` and `invoice` together with
`--strict-mcp-config`, fresh `XDG_DATA_HOME=/private/tmp/uv-deposits/data` and
`XDG_CONFIG_HOME=/private/tmp/uv-deposits/cfg` placed in each server's own env block inside
`mcp.json` (never `CLAUDE_CONFIG_DIR`, never the CLI's own environment), free tier, and an
explicit per-tool allowlist of every `mcp__deposits__*` / `mcp__invoice__*` tool plus
`license_status`/`license_activate` on each. A shared business profile was written directly to
`data/mcp-servers/profile/business.json` before the run: name "Nova Studio", `default_currency
EUR`, `default_tax_rate 23`, `timezone Europe/Warsaw`. Each of the six prompts is one bounded
`-p` call with `--resume <session-id>` chaining the same conversation, request timeout 240 s
(each call completed in under 15 s). Machine day: Saturday 2026-09-05.

One harness snag, not a server defect: the first `deposit_apply`-adjacent call needed
`invoice_from_hours`, which was not in the first allowlist draft. The CLI declined the tool
and asked for permission rather than guessing or failing silently; the allowlist was widened to
every tool `servers/invoice/src/index.ts` registers and the same prompt was resent. Recorded here
because a caller who trims an MCP allowlist by hand will hit the same wall.

---

## Part 2 - six prompts through the claude CLI

Scores are 0-3, checked against `deposits.json` and `invoices.json` on disk, not against the
model's prose.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "Acme paid a EUR 2,000 retainer today" | 3 | `deposit_record {client: "Acme", amount_minor: 200000, kind: "retainer", currency: "EUR"}`. Store: `DEP-2026-0001`, `amount_minor 200000` (EUR 2,000.00), `received_date 2026-09-05`, `status held`. Model correctly flagged Acme is not a stored client record |
| 2 | "Invoice Acme 10 hours at EUR 90 and settle it from the retainer" | 3 | `invoice_from_hours` then `deposit_apply {id: "DEP-2026-0001", invoice: "INV-2026-0001"}`. Store: `INV-2026-0001` subtotal EUR 900.00, 23% VAT EUR 207.00, `total_minor 110700` (EUR 1,107.00), `status paid`, `paid_minor 110700`. `DEP-2026-0001.applications` holds one row, `amount_minor 110700`. Reply's EUR 893.00 still held equals `200000 - 110700` exactly |
| 3 | "How much of Acme's retainer is left?" | 3 | Answered EUR 893.00 without a new tool call (single message turn), reproducing prompt 2's own arithmetic. Matches `200000 - 110700 = 89300` on disk exactly |
| 4 | "Refund Acme the rest by bank transfer" | 3 | `deposit_refund {id: "DEP-2026-0001", method: "bank transfer"}` (amount defaulted to everything held). Store: `refunds` holds one row, `amount_minor 89300`, `method "bank transfer"`; `status` becomes `applied` (money went to an invoice, so `applied` outranks `refunded` per `statusOf`, matching the documented derivation). Held after: `200000 - 110700 - 89300 = 0`, and the reply states EUR 0.00 held |
| 5 | "Try to apply the retainer to the invoice again" | 3 | Refused: `deposit_apply` was called (num_turns shows the attempt) and returned the "nothing left held" error; `deposits.json` and `invoices.json` unchanged from prompt 4's state, `INV-2026-0001.paid_minor` still 110700 |
| 6 | "Which clients still have deposits held and since when?" | 3 | Answer: no client currently has anything held, DEP-2026-0001 was the only deposit and it is fully applied/refunded. Matches `deposit_list`/`deposit_balance` over the one-row store exactly (`held_minor 0`) |

Scorecard: **3.00 / 3** (18 of 18). Every number reproduces from `deposits.json` /
`invoices.json` to the cent, including the one non-obvious derived field: `status` reading
`"applied"` rather than `"refunded"` after the deposit ended up at zero held through both an
application and a refund, which is the documented precedence in `store.ts`'s `statusOf` and
matches prompt 6's correct claim that nothing is held.

### Not a defect

`deposit_apply`'s `amount_minor` and `deposit_refund`'s `amount_minor` are both optional and
defaulted (smaller of held/open, and everything held, respectively). Prompts 2 and 4 relied on
those defaults rather than the model computing EUR 1,107.00 / EUR 893.00 itself, and both
defaults landed on the numbers a fully-worked calculation would also produce. This is the
intended design (`inputSchema` description: "Defaults to the smaller of what is held and what
the invoice still owes" / "Defaults to everything still held"), not the model guessing.

---

## Part 1 - probes not yet covered in docs/DEPOSITS_RESULT.md

RESULT.md's 20-row table already covers over-apply by amount and against the invoice's open
balance (rows 1-3), applying to a fully paid invoice (row 4), cross-currency apply (row 5),
applying from an empty deposit (row 6), over-refund and refund-from-empty (rows 7-8), the
decimal/zero/negative schema refusal (row 9), unknown invoice/deposit/ambiguous name (row 10), a
movement dated before the deposit arrived and an impossible calendar date (row 11), a
two-currency statement (row 12), a corrupt `deposits.json` and `counter.json` (row 13),
concurrent id allocation and the concurrent-apply race (rows 14-15), free tier (row 16),
zero-decimal currencies (row 17), 200 deposits for performance timing (row 18), stdout hygiene
(row 19) and the version contract (row 20). The rows below are the ones that table does not
carry, all new in `servers/deposits/test/gapfill.test.mjs`.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| Q | apply across two invoices in one call | NOT SUPPORTED, by construction | `deposit_apply`'s `invoice` field is `z.string()`, asserted directly against the tool's own `inputSchema`: there is no array or list form. Passing `"INV-2026-0001, INV-2026-0002"` as one string is treated as one literal invoice number, matches nothing, and is refused as unknown. The supported path is two separate `deposit_apply` calls against the same deposit id, which both succeed and each pay their own invoice correctly |
| R | apply in a different currency than the deposit | PASS (already asserted in RESULT.md row 5 / `adversarial.test.mjs`); re-verified during this pass, unchanged | `held in EUR and INV-... is in USD ... never converted here`; nothing written on either side |
| S | record with a future date | ACCEPTED, not a defect | `deposit_record {received_date: "2099-01-01"}` succeeds; nothing in the schema or the handler compares `received_date` to `today()`. A deposit received on a future banking value-date is a real business case (e.g. a post-dated transfer already confirmed). The one place this matters is enforced correctly: `deposit_apply`/`deposit_refund` still refuse any movement dated before the deposit's `received_date`, so a deposit recorded for 2099 cannot be applied "today" in 2026 |
| T | negative amount | PASS (already asserted in RESULT.md row 9 / `adversarial.test.mjs` "a decimal, a zero and a negative amount") | `amount_minor: -100` refused at the schema (`.positive()`), before any handler runs; no `deposits.json` created |
| U | statement for a client with no deposits | PASS | `deposit_statement_text {client: "Nobody Ltd"}` refuses by name: `no deposit has ever been recorded for "Nobody Ltd"`, not an empty or zero-balance statement. `deposit_balance` does the same |
| V | 200 deposits, listing size | PASS | 200 deposits recorded for one client (Pro, to clear the free-tier cap), `deposit_list {client}` returns `count: 200` and all 200 rows: `MAX_ROWS` is 2000, so nothing is silently dropped at 200. `deposit_balance` agrees (`deposits: 200`) |
| W | corrupt invoice store while the deposits store is fine | PASS | new test: `invoices.json` is truncated garbage, `deposits.json` is untouched. `deposit_apply` refuses cleanly (`corrupt` / `not valid JSON` in the message) and writes no application row. Every deposits-only tool keeps working on the same data dir: `deposit_list`, `deposit_balance`, `deposit_statement_text` and `deposit_refund` all succeed, because a refund never reads or writes the invoice store. This is the mirror image of RESULT.md row 13 (corrupt deposits store), and it was not previously asserted from this direction |

### No defects found in this pass

All 7 probes (Q-W) passed on the shipped build; R and T were re-verifications of existing
coverage. The design choices that make this so, found while reading `src/index.ts` and
`src/store.ts`:

- `deposit_apply` takes one invoice per call by the schema's own shape (`z.string()`, not an
  array); splitting a deposit across invoices is two calls, which the store already supports
  since each call is its own locked critical section.
- `received_date` has no upper bound check against `today()`, only a real-date check
  (`isIsoDate`). The protection that matters -- a deposit cannot be applied or refunded before it
  arrived -- is enforced independently in `deposit_apply`/`deposit_refund` by comparing the
  movement date to `d.received_date`, which a future `received_date` does not weaken.
- `statementFor`/`forClient` throw "no deposit has ever been recorded" the same way for
  `deposit_statement_text` and `deposit_balance` when the client list comes back empty, so there
  is one refusal path for "client I have never heard of," not a silently empty document.
- `deposit_list`'s row cap (`MAX_ROWS = 2000`) is far above any realistic per-client deposit
  count; 200 is nowhere near it.
- Reads for `deposit_apply` go through `getInvoices()` from `@theluckystrike/mcp-invoice/lib`,
  which quarantines a non-JSON `invoices.json` and throws, independently of this server's own
  `deposits.json` handling. Because `deposit_apply` takes the deposits lock before the invoice
  lock and only writes to `deposits.json` after the invoice write succeeds, a failure reading the
  invoice store leaves `deposits.json` untouched.

One new test file was added to keep this pass from regressing silently:
`servers/deposits/test/gapfill.test.mjs` (5 tests: two-invoices-in-one-call is unsupported by
schema, future received_date accepted but movement-date-before-received still enforced, statement
and balance for an unknown client, 200-deposit listing, corrupt invoice store with the deposits
store intact).

---

## Final test summary

    npm run build -w servers/deposits   tsc clean, no output
    npm test -w servers/deposits        # tests 36 / # pass 36 / # fail 0 / # skipped 0

36 tests: `unit.test.mjs`, `adversarial.test.mjs`, `corrupt.test.mjs`, `concurrency.test.mjs`,
`contract.test.mjs` (the original 31) plus the new `gapfill.test.mjs` (5 tests).

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build -w servers/deposits: tsc clean
    - npm test -w servers/deposits: # tests 36 / # pass 36 / # fail 0 / # skipped 0
    - Part 2: claude CLI 2.1.261, sonnet, deposits + invoice, per-tool allowlist, fresh XDG
      dirs in mcp.json's server env, shared profile (Nova Studio, Europe/Warsaw, EUR 23%), 6
      prompts, 3.00/3, both stores verified on disk (DEP-2026-0001 EUR 2,000.00 -> EUR 1,107.00
      applied to INV-2026-0001 -> EUR 893.00 refunded by bank transfer -> EUR 0.00 held; the
      re-apply attempt correctly refused with no store change)
    - Part 1 gap-fill: 7 probes not in docs/DEPOSITS_RESULT.md's table (two-invoices-in-one-call,
      cross-currency apply, future received_date, negative amount, statement/balance for an
      unknown client, 200-deposit listing, corrupt invoice store with deposits store intact).
      All 7 passed on the shipped build (2 were re-verifications); no defects found. 5 new tests
      added to lock the finding in
    artifacts:
    - /Users/mike/mcp-servers/servers/deposits/test/gapfill.test.mjs
    - /Users/mike/mcp-servers/docs/DEPOSITS_AUDIT.md
    cost: 35 wall minutes
    failures:
    - None found in this pass. A future received_date is accepted by design (a post-dated
      transfer is a real case) and the actual guard -- no movement before the deposit's own
      received_date -- still holds regardless of how far in the future that date is.
    insight:
    - Prompt 5 of the six ("apply the retainer again" after it is already fully settled) is the
      sharpest test in the six-prompt run: the deposit reached zero-held through BOTH an
      application and a refund on the same record, and `statusOf`'s precedence (held > applied >
      refunded) had to report "applied" correctly for the CLI's refusal message to make sense
      rather than claiming a deposit that funded a real invoice was merely "refunded." That
      precedence is asserted in `store.ts`'s own documentation but this run is the first time it
      was exercised through a real "part-billed, then the rest given back" business scenario
      rather than a synthetic amount, matching the same kind of finding
      docs/BILLING_DOCS_AUDIT.md made for its own prompt 3.

Built by theluckystrike. https://github.com/theluckystrike
