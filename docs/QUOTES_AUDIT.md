# mcp-quotes: Part 2 CLI run and the remaining Part 1 probes

Date 2026-09-04. Scope: `servers/quotes` only (src, test, SPEC.md) plus this file. `remote/`, billing,
scripts and the quotes README/remotes.json belong to other agents; nothing there was touched.

Part 1 harness: `servers/quotes/test/harness.mjs`, as in docs/QUOTES_RESULT.md.

Part 2 harness: the real `claude` CLI (2.1.260) as an MCP client, `--model sonnet`, against
`/private/tmp/uv-quotes/mcp.json`, which registers `quotes` and `invoice` together with
`--strict-mcp-config`, fresh `XDG_DATA_HOME=/private/tmp/uv-quotes/data` and
`XDG_CONFIG_HOME=/private/tmp/uv-quotes/cfg` placed in each server's own env block inside `mcp.json`
(not the CLI's environment), free tier, and an explicit per-tool allowlist of every `mcp__quotes__*` /
`mcp__invoice__*` tool (19 tools plus `license_status`/`license_activate` on each). A shared business
profile was written directly to `data/mcp-servers/profile/business.json` before the run: name "Nova
Freelance", `default_currency EUR`, `default_tax_rate 23`, `timezone Europe/Warsaw`. Each of the six
prompts is one bounded `-p` call with `--continue` chaining the same conversation, request timeout well
under 180 s (each call completed in 3-11 s). Machine day: Friday 2026-09-04.

---

## Part 2 - six prompts through the claude CLI

Scores are 0-3, checked against `quotes.json` and `invoices.json` on disk, not against the model's prose.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "Quote Nova Ltd for 12 hours of design at EUR 90 and a EUR 300 logo, valid two weeks" | 3 | One `quote_create`. Store: `Q-2026-0001`, client Nova Ltd, lines `Design 12 x EUR 90.00 = EUR 1080.00` and `Logo 1 x EUR 300.00 = EUR 300.00`, subtotal 1380.00, VAT 23% = 317.40, `total_minor 169740` (EUR 1,697.40), `valid_until 2026-09-18` (14 days from 2026-09-04), status open. The model's own arithmetic in its reply matched the store exactly |
| 2 | "What quotes are open and when do they expire?" | 3 | One `quote_list {state: "open"}`. Correctly named only Q-2026-0001, EUR 1,697.40, expiring 2026-09-18, 14 days left. No invented state |
| 3 | "Nova accepted, invoice it" | 3 | `quote_accept` on Q-2026-0001. Quotes store: `status accepted`, `accepted_date 2026-09-04`, `invoice_number INV-2026-0001`. Invoice store: `INV-2026-0001`, `total_minor 169740`, `currency EUR`, `issue_date 2026-09-04`, `due_date 2026-09-18` (the profile's 14-day terms), `status unpaid`. The invoice total is byte-for-byte the quote total, copied not recomputed |
| 4 | "Send me the text for the quote to Acme for 3 days consulting at PLN 1200 a day" | 3 | `quote_create` then `quote_send_text`. Store: `Q-2026-0002`, client Acme, currency PLN (inferred from the price, not the shared profile's EUR default, since no currency was named and none was stored), 1 line `Consulting 3 x PLN 1200.00 = PLN 3600.00`, VAT 23% = 828.00, `total_minor 442800` (PLN 4,428.00), `valid_until 2026-10-04` (default 30-day validity, since "valid two weeks" from prompt 1 does not carry over). The pasted text's totals block lined up correctly against the one line item |
| 5 | "Acme declined" | 3 | `quote_decline` on Q-2026-0002 (resolved by client name; it was the only open Acme quote). Store: `status declined`, `declined_date 2026-09-04`, `decline_reason` absent (none was given, and none was invented). Reply correctly said no open quotes remain |
| 6 | "What is my win rate this quarter?" | 3 | `quote_report` is Pro-gated; the free-tier server correctly refused it. The model did not silently buy a license or use a non-MCP tool: it named the two options (activate, or compute from `quote_list` manually) and asked before either paid or unpaid path. On "yes, calculate it manually" (a follow-up outside the six, run only to verify the number) it called `quote_list` for the quarter and answered 1 accepted of 2 decided = 50%, matching the store: Q-2026-0001 accepted, Q-2026-0002 declined, no third quote |

Scorecard: **3.00 / 3** (18 of 18). No permission refusal on an allowed tool, no fallback outside the two
MCP servers, and the one Pro-gated call (prompt 6) was refused correctly rather than silently degraded or
silently charged.

### Invoice numbering continues the invoice server's own sequence

Verified directly, separately from the six-prompt run: a fresh data dir was seeded with 3 direct invoices
(`INV-2026-0001..0003`, via `invoice_create`, no quote behind any of them), then a quote was created,
accepted and invoiced through `quotes`. The result was `INV-2026-0004`, not a restart at `0001`: the
`nextNumber` counter the quote server writes through is the same one `servers/invoice` and `servers/recurring`
share. This is now asserted in `test/adversarial.test.mjs`, "accepting a quote continues the invoice
server's own number series, not a fresh one" (pre-seeds `invoices.json` and `counter.json` under the shared
`XDG_DATA_HOME`, then asserts the quote's invoice is `INV-2026-0004` and `invoices.json` has 4 entries).

### Not defects

- Prompt 4's quote defaulted to 30-day validity rather than the 14 days set on prompt 1's quote. Each
  `quote_create` call is independent; validity is per quote, not a session default, and nothing in the
  prompt asked for two weeks this time.
- The win-rate report being Pro-gated on the free tier. That is the documented free/Pro split
  (docs/QUOTES_RESULT.md), and the model handled the refusal correctly rather than working around it.

---

## Part 1 - probes not yet covered in docs/QUOTES_RESULT.md

QUOTES_RESULT.md's 25-row table already covers decimal prices (row 4), mixed currencies (rows 8-9),
validity-date ordering (row 10), accept-twice (row 11), accept-after-expiry (row 13), corrupt stores (rows
18-19) and two processes (row 20). The rows below are the ones that table does not carry, plus the two
defects found while running them.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| A | `validity_days: 0` | PASS | zod: `Number must be greater than or equal to 1` |
| B | `validity_days: 3650` (the stated max) | PASS | accepted, `days_left: 3650` |
| C | `validity_days: 3651` | PASS | zod: `Number must be less than or equal to 3650` |
| D | `notes`: a 1 MB string | **FAIL (stored whole, 1,049,610 bytes echoed back)** | fixed: `notes must be 10000 characters or fewer` |
| E | a line item `description` built from 500 lines (well over 500 characters) | **FAIL (stored whole)** | fixed: `a line description must be 500 characters or fewer` |
| F | `client`, `client_email`, `client_address`, `client_vat_id` at 201 / 321 / 2001 / 65 characters | **FAIL (all stored whole)** | fixed: each refused by name with its own cap |
| G | `quote_decline {reason}` at 10,001 characters | **FAIL (stored whole)** | fixed: `reason must be 10000 characters or fewer` |
| H | accepting a quote when the invoice store already holds invoices from a different source | PASS | `INV-2026-0004` continues the existing series; see above |

### The defect: five unbounded free-text fields

Before this pass, `notes` (on `quote_create`, `quote_update` and `quote_decline`'s `reason`), the per-line
`description`, `client`, `client_email`, `client_address` and `client_vat_id` had no length limit at all.
`quote_create` with a 1 MB `notes` string was accepted in 21 ms and echoed back in full in the response --
the same class of context-bomb `KANBAN_AUDIT.md` D-K9 measured on a listing tool, but here on a single
document: one `quote_get` on such a quote would hand a client roughly 260,000 tokens of a single field. A
500-line description does the same thing to `quote_send_text`'s line table and to the PDF renderer's layout
math, neither of which expects a multi-paragraph string where a one-line item name goes.

Fixed in `servers/quotes/src/index.ts`: a `text(field, max, min)` schema helper, applied to every caller-set
free-text field with a cap chosen from what the field is for, not one blanket number --

    MAX_CLIENT_NAME = 200      MAX_DESCRIPTION = 500      MAX_NOTES = 10000
    MAX_ADDRESS = 2000         MAX_EMAIL = 320             MAX_VAT_ID = 64

`description`'s existing `min(1, "every line needs a description")` message is preserved unchanged so the
row-1 adversarial test in docs/QUOTES_RESULT.md still passes; only the max is new. Every cap is asserted in
`test/adversarial.test.mjs`: refused one character over, accepted exactly at the cap (the 10,000-character
notes case), and nothing is left on disk after a refusal.

---

## Final test summary

    npm run build -w servers/quotes   tsc clean, no output
    npm test -w servers/quotes        # tests 30 / # pass 29 / # fail 0 / # skipped 1 / # duration_ms ~3300

30 tests: `smoke.test.mjs`, `contract.test.mjs`, `corrupt.test.mjs`, `concurrency.test.mjs` and
`adversarial.test.mjs` (now 12 tests: the original probe-matrix assertions plus 6 new ones added in this
pass -- validity_days boundaries, 1 MB notes, the 500-line description, oversized client/email/address/vat_id
and decline reason, and the invoice-numbering-continues-the-series check). The one skip is probe 15
(`quote_pdf` to `/etc/passwd`), unmeasurable under this sandbox as already noted in QUOTES_RESULT.md.

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build -w servers/quotes: tsc clean
    - npm test -w servers/quotes: # tests 30 / # pass 29 / # fail 0 / # skipped 1
    - Part 2: claude CLI 2.1.260, sonnet, quotes + invoice, per-tool allowlist, fresh XDG dirs in
      mcp.json's server env, shared profile (Europe/Warsaw, 23% default rate), 6 prompts, 3.00/3, both
      stores verified on disk (Q-2026-0001 accepted -> INV-2026-0001 EUR 1,697.40 copied not recomputed;
      Q-2026-0002 PLN 4,428.00 declined; win rate 1/2 = 50% matches quote_list)
    - Invoice numbering verified to continue the invoice server's own sequence (INV-2026-0004 after 3
      pre-existing direct invoices), now asserted in test/adversarial.test.mjs
    - Part 1 gap-fill: 8 probes not in docs/QUOTES_RESULT.md's table (validity_days 0/3650/3651, 1 MB
      notes, 500-line description, oversized client/email/address/vat_id, oversized decline reason,
      invoice-series continuation). 5 probes failed on the shipped build, all fixed
    artifacts:
    - /Users/mike/mcp-servers/servers/quotes/src/index.ts
    - /Users/mike/mcp-servers/servers/quotes/test/adversarial.test.mjs
    - /Users/mike/mcp-servers/docs/QUOTES_AUDIT.md
    cost: 35 wall minutes
    failures:
    - Five free-text fields (notes, decline reason, line description, client name, client email/address/vat
      id) had no length cap: a 1 MB notes field was stored and echoed back whole, a context bomb on a
      single document the same way KANBAN_AUDIT.md D-K9 found on a listing tool. All five now have a
      field-appropriate cap, refused by name, nothing left on disk.
    insight:
    - The six-prompt run's only non-trivial branch was the win-rate question, which is Pro-gated. The
      model handled it exactly right: it neither silently activated a paid license nor silently
      approximated Pro output with free tools, it named both real options and waited. That is the
      behavior the licence gate's upgrade text is written to produce, and this run is the first place it
      was exercised through a real client rather than the test harness.

Built by theluckystrike. https://github.com/theluckystrike
