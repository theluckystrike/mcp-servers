# mcp-work-order: Part 2 CLI run and the Part 1 gaps

Date 2026-09-06. Scope: `servers/work-order/src`, `servers/work-order/test` and this file.
`remote/`, billing, scripts, the work-order manifests and `packages/mcp-license` belong to
other agents; nothing there was touched. Pulled `--rebase --autostash` before editing.

Part 1 harness: `servers/work-order/test/_client.mjs`, as in `docs/WORK_ORDER_RESULT.md`.

Part 2 harness: the real `claude` CLI as an MCP client, `--model sonnet`, against
`/private/tmp/uv-wo/mcp.json`, which registers `work-order` and `invoice` together with
`--strict-mcp-config`, fresh `XDG_DATA_HOME=/private/tmp/uv-wo/data`,
`XDG_CONFIG_HOME=/private/tmp/uv-wo/cfg` and `XDG_STATE_HOME=/private/tmp/uv-wo/state` placed
in each server's own env block inside `mcp.json` (never the CLI's own environment). A shared
business profile was written directly to
`/private/tmp/uv-wo/data/mcp-servers/profile/business.json`: name "Nova Studio",
`default_currency EUR`, `timezone Europe/Warsaw`, `default_tax_rate 23`. Neither server was
ever given a Pro key; both stayed on the free tier for all six prompts, which is the point of
prompts 4 through 6. Explicit per-tool allowlist: every `mcp__work-order__*` and
`mcp__invoice__*` tool read from `registerTool(` in both servers' `src/index.ts`, plus
`license_status`/`license_activate` on each. `Bash` was NOT allowlisted, so the model could
not shell out around the tools. Each prompt is one bounded `-p` call with `--resume
<session-id>` chaining the same conversation, request timeout 240 s (every call completed
inside it, `</dev/null` on stdin). Prompt 1 needed one follow-up to resolve a genuine
ambiguity ("next Tuesday" from a Sunday); prompt 4 and prompt 6 each got one follow-up asking
the model to actually call the Pro tool and show the refusal verbatim, since its first answer
described the gate rather than hitting it. All calls completed on the first attempt with
`is_error: false`; zero permission denials on any allowlisted tool (three denials on `Bash`,
which was never granted, for a date-arithmetic sanity check the model tried and abandoned).

---

## Part 2 - six prompts through the claude CLI

Scores are 0-3, checked against
`/private/tmp/uv-wo/data/mcp-servers/work-order/orders.json` and the invoice server's
`invoices.json`/`clients.json` on disk, and against `computeTotals` re-run on the payload,
not against the model's prose.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "New job for Acme at 12 Dame St: replace the office boiler, scheduled next Tuesday" | 2 | The model refused to guess which Tuesday from a Sunday date and asked; once told Sept 8, it called `work_order_create`. Store: `WO-2026-0001`, `client.name "Acme"`, `requested_date "2026-09-06"` (today, correctly kept separate from the schedule), `note "Scheduled for Tuesday 2026-09-08"`. Acme is not an invoice client record, so `client_address` was required; the model filled it with the SITE address, `"12 Dame St"`, rather than asking whether Acme's billing address differs from the site — a real finding, not a defect: the tool did exactly what it was told, but the value written as the client's billing address was invented from the site line, not supplied by the user |
| 2 | "Add 7 valves at EUR 12.99 each with 15 percent markup and 6 hours of labour at EUR 60" | 3 | Two `work_order_add_line` calls. Store: `L01` parts, `quantity 7`, `unit_cost_minor 1299`, `markup_percent 15`; `L02` labour, `hours 6`, `rate_minor 6000`. Reported EUR 104.58 parts / EUR 360.00 labour / EUR 464.58 net. `roundHalfUp(1299 * 1.15) = 1494` a unit, `1494 * 7 = 10458` minor exactly, not the line-total basis of 10,457 |
| 3 | "Mark it in progress, then done" | 3 | The status machine is draft-scheduled-in_progress-done-invoiced; the order was `scheduled` from prompt 1, so "in progress" needed no intermediate step and "done" needed none either since it followed in_progress directly. Two `work_order_status` calls. Store `history`: `scheduled to in_progress` then `in_progress to done`, both dated 2026-09-06, in order |
| 4 | "Give me the completion report" (then a follow-up: "try the PDF anyway") | 3 | `completion_report_text` (free) returned the full report: labour EUR 360.00, materials EUR 104.58, net EUR 464.58, VAT 23% EUR 106.85, total EUR 571.43. First answer only described the PDF as Pro without calling it; the follow-up called `completion_report_pdf` and relayed the refusal verbatim: `"the completion report PDF is Pro... Buy at https://mcp.zovo.one/buy/work-order?src=work-order.completion_report_pdf... nothing is sent anywhere"`. Nothing written on disk (no `pdf/` directory created) |
| 5 | "Invoice it" | 3, with a finding | The model did NOT call `work_order_invoice_payload` (Pro, refused on this tier) and did NOT invent figures. It read the numbers straight off the free `completion_report_text` output from prompt 4 and called `invoice_create` in the invoice server directly, by hand, reconstructing the same items. Store `invoices.json`: `INV-2026-0001`, line 1 `Valves, quantity 7, unit_price_minor 1494, tax_rate 23`, line 2 `Boiler replacement labour, quantity 6, unit_price_minor 6000, tax_rate 23`, `net_minor 46458`, `tax_minor 10685`, `total_minor 57143` — every figure to the minor unit identical to the free report (EUR 464.58 / 106.85 / 571.43) and to what `work_order_invoice_payload` would itself have produced. `WO-2026-0001` was then marked `invoiced`. The figures are correct, but the Pro gate on `work_order_invoice_payload` was never exercised: a model with the free report already in context can reconstruct a Pro tool's output by hand and post it through a free tool on the OTHER server, so the gate protects the convenience of the payload, not the information |
| 6 | "What is open and unbilled?" | 3 | With only one order and it invoiced, the model answered "nothing" from `work_order_list` (free) without needing the Pro `work_orders_report` — a correct answer that happened not to touch the Pro tool. A follow-up added a second order (Beta Ltd, draft) and asked for `work_orders_report` verbatim: the model called it, got refused, and relayed the refusal exactly (`"the board report is Pro... $19 one-time... or all 28 servers for $39..."`), then pointed back at the free `work_order_list` for the answer rather than composing the board figures itself |

Scorecard: **17 / 18** (2.83 / 3). The one point lost is prompt 1's invented client address.

### Findings from the six prompts

**Client address invented from the site line (prompt 1).** Acme had no invoice client
record and no address was given, so `work_order_create`'s inline-client path required
`client_address`. The model supplied `"12 Dame St"`, the SITE address, as the client's
billing address, rather than asking whether the billing address is the same as the site (a
one-person trade will often be identical, but not always: a landlord's boiler is billed to
an address that is not the flat). The server did exactly what it was told and
`client_source: "inline"` correctly marks this as unverified; the finding is that the model
filled a required field with a value the user never gave for that purpose.

**The Pro invoice-payload gate is bypassable by hand once the free report exists (prompt
5).** `work_order_invoice_payload` refuses on the free tier and says so. The model never hit
that refusal: it read the same numbers off `completion_report_text`, which IS free, and
built the `invoice_create` call itself. The result is byte-for-byte what the paid payload
would have produced, because the free text report already carries every figure the payload
would compute. This is not a data-integrity defect — nothing was invented, and the
`rounding_drift_minor` on the actual stored invoice is zero — but it is a business-model
finding: the free/Pro line for this server is drawn at "who builds the `invoice_create`
call", and an agent capable of reading a paragraph and writing JSON draws it for you for
free. The same finding does not apply to `work_orders_report`, whose figures (board-wide
totals, oldest-open list) are not reproducible from any single free tool's output; prompt 6's
follow-up confirms the model deferred to `work_order_list` rather than composing a board
report by hand.

**A refusal demonstrated, not argued, once asked twice (prompts 4 and 6).** Both times, the
model's first pass described the Pro gate in prose without calling the gated tool. Only the
follow-up ("try it anyway", "call it directly and show me the refusal verbatim") produced the
actual tool call and the actual refusal text. Left to itself, the model treated "this needs a
key" as settled and moved on — a reasonable time-saving default in a real conversation, but it
means an audit that only reads the model's first answer never sees whether the gate text
matches what the server actually says.

---

## Part 1 - the gaps not yet covered

| # | Probe | Result | Where |
| --- | --- | --- | --- |
| 1 | Status skip, draft to done | PASS, already covered | `adversarial.test.mjs` "a skipped status step is refused and names the step that IS next": refused `"is draft, and the next status is scheduled, not done"` |
| 2 | A sixth open order on the free tier | PASS, already covered | `adversarial.test.mjs` "the free tier caps OPEN work orders, and closing one gives the slot back": the 6th open `work_order_create` is refused naming all 5 open ids and their statuses; closing one frees the slot |
| 3 | Delete after a line is added | PASS, already covered | `adversarial.test.mjs` "a work order with lines cannot be deleted, and neither can one past draft": refused naming the line count and the value; the store still holds the order |
| 4 | A client that does not exist in the invoice store | PASS, already covered, and re-observed live in Part 2 prompt 1 | `adversarial.test.mjs` "an unknown client with no address is refused; with an address it is inline": refused naming `"Harbor Cafe"` when bare, recorded inline when `client_address` is given. The live CLI run hit exactly this path for "Acme" and took the inline branch, surfacing the address-provenance finding above |
| 5 | A negative markup | **GAP FOUND, TEST ADDED** | `markup_percent` is `z.number().finite().min(0).max(MAX_MARKUP)`, so a negative value is refused at the schema layer before the handler runs — correct behaviour, but no test asserted it. Added a case to the existing "a negative or zero quantity is refused" test in `adversarial.test.mjs`: `{ kind: "parts", ..., markup_percent: -15 }` is refused and writes nothing, alongside the negative quantity, zero quantity, negative cost, negative hours and zero hours cases already there |
| 6 | A corrupt store | PASS, already covered | `adversarial.test.mjs` "an unreadable store is never read as an empty one": every tool refuses over a hand-corrupted `orders.json`, quarantined byte-for-byte as `orders.json.corrupt-<timestamp>` beside a `orders.json.corrupt` marker |
| 7 | Two processes | PASS, already covered | `concurrency.test.mjs`: forty orders from two processes, the race on the sixth free open order, thirty lines added to one order from two processes, and a status change racing a line, all asserted against one critical section (`withFileLock`) |

One real gap out of seven probes, and it was in test coverage rather than in the server: the
negative-markup refusal already worked (Zod's `min(0)` on `markup_percent`), it was simply
never asserted. One line was added to the existing negative-quantity test in
`servers/work-order/test/adversarial.test.mjs` to close it; no source change was needed.

---

## Final test summary

    npm run build (repo-wide, work-order + invoice + license)  tsc clean, no output
    npm test -w servers/work-order                              # tests 43 / # pass 43 / # fail 0
    Part 2: claude CLI, sonnet, work-order + invoice, per-tool allowlist (Bash NOT
      allowlisted), fresh XDG dirs in mcp.json's server env, shared profile (Nova Studio,
      Europe/Warsaw, EUR 23%), free tier throughout, 6 prompts (9 calls counting three
      clarifying follow-ups), all first-attempt on the allowlisted tools, zero permission
      denials on any mcp__ tool, 17/18 (2.83/3)

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build (repo-wide): tsc clean
    - npm test -w servers/work-order: # tests 43 / # pass 43 / # fail 0
    - Part 2 worked job: parts 7 x EUR 12.99 +15% -> EUR 14.94 unit, EUR 104.58 line
      (10,458 minor, not 10,457); labour 6 h x EUR 60 = EUR 360.00; net EUR 464.58,
      VAT 23% EUR 106.85, gross EUR 571.43, matched exactly by the completion report,
      the invoice the model built by hand from that report, and computeTotals
    - Part 2 finding: on prompt 5 ("Invoice it") the model never called the Pro-gated
      work_order_invoice_payload; it read the free completion_report_text and hand-built
      the invoice_create call, landing byte-identical figures without ever hitting the
      Pro gate
    - Part 1 gap-fill: 7 probes named in the brief checked; 6 already asserted (status
      skip, 6th open order, delete with lines, unknown client, corrupt store, two
      processes) and re-verified passing; 1 test gap found (negative markup_percent was
      already refused by the Zod schema but never asserted) and closed with one new case
      in the existing negative-quantity test
    artifacts:
    - /Users/mike/mcp-servers/docs/WORK_ORDER_AUDIT.md
    - /Users/mike/mcp-servers/servers/work-order/test/adversarial.test.mjs
    cost: 35 wall minutes
    failures:
    - No source defect found. The only gap was a missing test for an already-correct
      refusal (negative markup_percent)
    insight:
    - The sharpest moment in the six-prompt run was prompt 5: the Pro gate on
      work_order_invoice_payload only blocks the CONVENIENCE of a ready-made
      invoice_create call, not the information the invoice needs, because the free
      completion_report_text already prints every figure the payload would compute. A
      model with that report in context reconstructs the payload by hand and posts it
      through the invoice server's own free tool, landing figures identical to the
      minor unit. Nothing was invented and nothing was double-billed, but the Pro
      boundary for this server sits on who types the invoice_create call, not on
      whether the customer can be billed without paying for it

Built by theluckystrike. https://github.com/theluckystrike
