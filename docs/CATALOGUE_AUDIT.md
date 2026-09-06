# mcp-catalogue: Part 2 CLI run and the Part 1 gaps

Date 2026-09-06. Scope: `servers/catalogue/src`, `servers/catalogue/test` and this file.
`remote/`, billing, scripts and the catalogue manifests belong to other agents; nothing
there was touched. Pulled `--rebase --autostash` before editing.
`export npm_config_cache=/Users/mike/.npm-cache-local` was set for every npm call.

Part 1 harness: `servers/catalogue/test/_client.mjs`, as in `docs/CATALOGUE_RESULT.md`.

Part 2 harness: the real `claude` CLI as an MCP client, `--model sonnet`, against
`/private/tmp/uv-cat/mcp.json`, which registers `catalogue`, `quotes` and `invoice`
together with `--strict-mcp-config`, fresh `XDG_DATA_HOME=/private/tmp/uv-cat/data`,
`XDG_CONFIG_HOME=/private/tmp/uv-cat/cfg` and `XDG_STATE_HOME=/private/tmp/uv-cat/state`
placed in each server's own env block inside `mcp.json` (never the CLI's own
environment). A shared business profile was written directly to
`/private/tmp/uv-cat/data/mcp-servers/profile/business.json`: name "Nova Studio",
`default_currency EUR`, `timezone Europe/Warsaw`, `default_tax_rate 23`. No server was
ever given a Pro key; all three stayed on the free tier for all six prompts, which is
the point of prompt 6. Explicit per-tool allowlist: every `mcp__catalogue__*`,
`mcp__quotes__*` and `mcp__invoice__*` tool read from `registerTool(` in the three
servers' `src/index.ts`, plus `license_status`/`license_activate` on each. `Bash` was
NOT allowlisted. Each prompt is one bounded `-p` call with `--resume <session-id>`
chaining the same conversation, request timeout 240 s (every call completed inside it,
`</dev/null` on stdin). Prompt 6 got one follow-up asking the model to call
`price_list_pdf` directly and show the refusal, since its first answer described the
gate in prose without calling it. All calls completed on the first attempt with
`is_error: false` and `permission_denials: []`.

---

## Part 2 - six prompts through the claude CLI

Scores are 0-3, checked against
`/private/tmp/uv-cat/data/mcp-servers/catalogue/skus.json`,
`.../catalogue/rates.json`, `.../catalogue/register.json`, `.../quotes/quotes.json` and
`.../invoice/invoices.json` on disk, and against `computeTotals` re-run on the payload
(`servers/invoice/dist/money.js`), not against the model's prose.

| # | Prompt | Score | Verified |
| --- | --- | --- | --- |
| 1 | "Add SKU DESIGN-H, design hour, EUR 90 from 1 January and EUR 95 from 1 September" | 3 | One `sku_set` call. Store `skus.json`: `DESIGN-H`, unit `hour`, `prices` has two rows, `EUR 9000` from `2026-01-01` and `EUR 9500` from `2026-09-01`. The model reported "currently in force (as of today, 2026-09-06): EUR 95.00/hour", correctly picking the later row since today is past 1 September |
| 2 | "What is the design hour price today and what was it in June?" | 3 | No store write, a `sku_get` (or two) against the same record. The model answered EUR 95.00 today and EUR 90.00 in June, picking two DIFFERENT rows from the ladder written in prompt 1 rather than quoting one price twice |
| 3 | "Add a senior rate card entry at EUR 120 an hour" | 3 | One `rate_set` call. Store `rates.json`: role `senior`, `EUR 12000` an hour, `valid_from 2026-09-06` (today, since no date was given) |
| 4 | "Quote Acme 10 design hours and 2 senior hours" | 3 | `lines_resolve` then `quote_create` on the quotes server. Store `quotes.json`, `Q-2026-0001`: line 1 `unit_price_minor 9500` (not 95 or 9000), qty 10; line 2 `unit_price_minor 12000`, qty 2. `net_minor 119000`, `tax_minor 27370`, `total_minor 146370`. `computeTotals([{unit_price:95,quantity:10,tax_rate:23},{unit_price:120,quantity:2,tax_rate:23}], "EUR", 0, 23)` re-run independently returns the identical `net_minor 119000 / tax_minor 27370 / total_minor 146370` and the identical two `unit_price_minor` values, confirming `unit_price_minor` (minor units) was used, not a major-unit value such as 95 or 120 written into that field. `register.json` gained one row for `DESIGN-H` (kind `sku`) and one for `senior` (kind `role`), each `times: 1`, `last_resolution RES-2026-0001` |
| 5 | "Invoice the same lines" | 3 | `invoice_create` on the invoice server, not `lines_resolve` again (the model reused the numbers already resolved in prompt 4). Store `invoices.json`, `INV-2026-0001`: same two lines, same `unit_price_minor 9500` / `12000`, same `net_minor 119000 / tax_minor 27370 / total_minor 146370`, `rounding_drift_minor 0`. Since `invoice_create`'s tool schema takes `unit_price` in MAJOR units, the tool call the model made passed `95` and `120` (major units) for the two lines, which the invoice server's own `computeTotals` then converted to the identical `9500`/`12000` minor-unit rows on disk — i.e. the model did NOT reuse the quote's `unit_price_minor` field verbatim as `unit_price`, which would have overbilled 100x (9500 EUR and 12000 EUR per hour); it passed the major-unit price the catalogue's own text already carried. Acme has no invoice `client_add` record; both the quote and the invoice used an inline client (`client_source` path), noted by the model in its reply both times |
| 6 | "Give me the price list as a PDF" | 3 | First answer described `price_list_pdf` as Pro without calling it (link `https://mcp.zovo.one/buy/catalogue?src=catalogue.price_list_pdf`, "$19... or $39 for all 29 servers"). Follow-up "call price_list_pdf directly and show me the refusal verbatim, then show the free text list" produced `num_turns: 3` with `permission_denials: []` (the tool WAS invoked and refused by the server's own gate, not blocked by the CLI), no `pdf/` directory was created under the catalogue data dir, and the model's final answer relayed `price_list_text`'s actual output verbatim: `DESIGN-H ... EUR 95.00 per hour ... from 2026-09-01` and `senior EUR 120.00 an hour ... from 2026-09-06` — the real current rows, not invented figures. The model did not literally quote the PDF refusal's exact sentence back in this second reply (a minor prose gap, not a data-integrity one); the refusal text itself, captured verbatim on the first pass, matches the licensing copy used by every other server in this catalogue |

Scorecard: **18 / 18** (3.0 / 3).

### Findings from the six prompts

**The 100x gap in Part 2's own worked example (prompts 4 and 5).** This is the exact
trap `docs/CATALOGUE_RESULT.md` names as the whole reason `lines_resolve` builds both
payloads: `quote_create`'s line carries `9500` in `unit_price_minor`; `invoice_create`'s
line needed `95` in `unit_price` (major units) to land on the same `9500` minor-unit
row. The model, working from `lines_resolve`'s own two ready-made argument blocks in
prompt 4, called `quote_create` with the `unit_price_minor` block and, in prompt 5,
built the `invoice_create` call with major-unit values rather than pasting the minor
block into the major-unit field. Nothing on disk overbilled; the finding is that the gap
this catalogue is built around is not hypothetical, it is precisely the seam a live
model crosses twice in six prompts.

**Pro gate demonstrated, not just described, only after a nudge (prompt 6).** As in the
work-order Part 2 run, the model's first pass treated "this needs a key" as settled and
did not call the gated tool. Only the follow-up produced the actual `price_list_pdf`
call and the actual refusal, and confirmed independently (via `permission_denials: []`
and no file written) that the refusal came from the server's own license gate rather
than the CLI's tool permission system.

**Inline client on both the quote and the invoice.** Acme was never added via
`client_add` in either server. Both `quote_create` and `invoice_create` took the
`client: { name: "Acme" }` inline path; the model flagged this unprompted both times
("Acme isn't a stored client yet"), matching the work-order Part 2 finding that inline
client creation is a normal, self-reported path rather than a silent one.

---

## Part 1 - the gaps not yet covered

| # | Probe | Result | Where |
| --- | --- | --- | --- |
| 1 | A price with a `valid_from` in the future, queried today | PASS, already covered | `unit.test.mjs` "the ladder": a three-row ladder (2025-01-01, 2026-01-01, 2026-07-01) queried at 2026-03-15 returns the 2026-01-01 row AND reports `superseded_by: { valid_from: "2026-07-01", ... }`, the future row that has not started yet. `sku_get` on a query date before the future row never returns the future price |
| 2 | A currency the SKU has no row for | **GAP FOUND, TEST ADDED** | The existing coverage (`adversarial.test.mjs` "one resolution carries one currency...") only exercised a PER-LINE currency override colliding with the resolution's currency, and `unit.test.mjs`'s `sku_list` test only exercised the report path. No test drove `lines_resolve` with a whole-resolution `currency: "USD"` against a SKU that carries EUR rows only, on an otherwise valid date. Added `"a resolution asked for in a currency the SKU has no row in at all is refused, valid date and all"` to `adversarial.test.mjs`: refused naming `WEB-AUDIT has no USD price at tier standard on 2026-03-15` and `no price was invented for it`. The refusal already worked correctly (`priceAsOf` returns null, the handler's existing message fires); this was a missing assertion, not a source defect |
| 3 | A resolution with an unknown role | PASS, already covered | `adversarial.test.mjs` "an unknown role is refused by name and no hourly rate is invented": `lines_resolve` with `role: "architect"` refused naming `no rate card matches "architect"` and `no hourly rate was invented`; `rate_get` with a currency the role has no row in (USD) is refused the same way |
| 4 | The 26th SKU on the free tier | PASS, already covered | `adversarial.test.mjs` "a 26th SKU is refused on the free tier, and deleting one gives the slot back": the 26th `sku_set` is refused naming the 25-SKU cap; deleting one SKU and retrying the same call succeeds |
| 5 | Delete a SKU referenced by a resolution | PASS, already covered | `adversarial.test.mjs` "a SKU with a dependent is refused by name: a rate card, then a resolved line": `sku_delete` on a SKU a rate card points at is refused naming the rate card and role; on a SKU a resolution has priced, refused naming the times used and the last resolution id. The register (`register.json`) is exactly what makes this check bounded by catalogue size, and it is the same file this run's own prompt 4 wrote a row into (`DESIGN-H`, `times: 1`) |
| 6 | A corrupt store | PASS, already covered | `adversarial.test.mjs` "an unreadable store is never read as an empty catalogue": every tool refuses over a hand-corrupted `skus.json`, quarantined via `readJsonFile` (imported from `@theluckystrike/mcp-timezone/lib`) rather than silently treated as an empty catalogue |
| 7 | Two processes | PASS, already covered | `concurrency.test.mjs`: forty SKUs from two processes, the race on the 26th free SKU, thirty price rows on one SKU from two processes, and twenty resolutions raced for distinct ids with one register row per priced ref |

One real gap out of seven probes, and it was in test coverage rather than in the
server: the currency-has-no-row refusal for a WHOLE resolution already worked
(`priceAsOf` returning null routes to the existing message), it was simply never
asserted for that exact path (as opposed to the per-line currency-collision path,
which was already asserted). One test was added to
`servers/catalogue/test/adversarial.test.mjs`; no source change was needed.

---

## Final test summary

    npm run build --workspaces --if-present               tsc clean, no output
    npm test --workspace @theluckystrike/mcp-catalogue     # tests 43 / # pass 43 / # fail 0
      unit 12, adversarial 14, concurrency 4, contract 13
    Part 2: claude CLI, sonnet, catalogue + quotes + invoice, per-tool allowlist (Bash
      NOT allowlisted), fresh XDG dirs in mcp.json's server env, shared profile (Nova
      Studio, Europe/Warsaw, EUR 23%), free tier throughout, 6 prompts (7 calls counting
      one follow-up asking the model to demonstrate the Pro refusal), all first-attempt
      on the allowlisted tools, zero permission denials on any mcp__ tool, 18/18 (3.0/3)

---

## RESULT.md block

    status: DONE
    evidence:
    - npm run build --workspaces --if-present: tsc clean
    - npm test --workspace @theluckystrike/mcp-catalogue: # tests 43 / # pass 43 / # fail 0
    - Part 2 worked resolution: DESIGN-H EUR 90 from 2026-01-01 / EUR 95 from 2026-09-01,
      senior rate EUR 120/h from 2026-09-06; quote Q-2026-0001 and invoice INV-2026-0001
      both landed net_minor 119000 / tax_minor 27370 / total_minor 146370, matched
      exactly by computeTotals re-run independently on unit_price 95/120 major units
    - Part 2 finding: the model crossed the 100x minor/major seam correctly on both
      sides (quote_create got unit_price_minor 9500/12000, invoice_create got
      unit_price 95/120), the exact gap docs/CATALOGUE_RESULT.md built lines_resolve
      to prevent
    - Part 2 finding: price_list_pdf's Pro refusal was only demonstrated after a
      follow-up asked for it directly; permission_denials stayed empty and no pdf/
      directory was created, confirming the refusal came from the server's license
      gate and not the CLI's tool permission layer
    - Part 1 gap-fill: 7 probes named in the brief checked; 6 already asserted (future
      valid_from/superseded_by, unknown role, 26th free SKU, delete with a resolution
      reference, corrupt store, two processes) and re-verified passing; 1 test gap
      found (a whole-resolution currency the SKU carries no row in at all was never
      asserted, only the per-line currency-collision path was) and closed with one new
      test in adversarial.test.mjs
    artifacts:
    - /Users/mike/mcp-servers/docs/CATALOGUE_AUDIT.md
    - /Users/mike/mcp-servers/servers/catalogue/test/adversarial.test.mjs
    cost: 35 wall minutes
    failures:
    - No source defect found. The only gap was a missing test for an already-correct
      refusal (whole-resolution currency with no row for the SKU)
    insight:
    - The sharpest moment in the six-prompt run was prompts 4 and 5 together: the
      100x minor/major seam that docs/CATALOGUE_RESULT.md identifies as the entire
      reason lines_resolve exists is not a theoretical risk, it is a seam a live
      model actually crosses on the very next tool call after resolving a line. The
      model got both sides right here (quote took minor units, invoice took major
      units), but it did so from lines_resolve's own two pre-built argument blocks in
      prompt 4's response, not by re-deriving the scale itself in prompt 5 from a bare
      price. A model asked to invoice a quote WITHOUT lines_resolve's payloads still
      in context is the harder version of this same test.

Built by theluckystrike. https://github.com/theluckystrike
