# mcp-expense-tracker: adversarial audit and user-value run

Date 2026-09-02. Scope: `servers/expense-tracker` only. Zero paid API calls, zero network calls
(the server makes none: `grep -rE "fetch|https?://|node:http|node:net|node:dns" src/` is empty).

Part 1 harness: `/private/tmp/mcp-audit/probe.mjs` (the same one used for `docs/AUDIT.md`) spawns
`dist/index.js`, writes JSON-RPC lines to stdin, and flags any stdout line that is not parseable JSON.
Probe file `/private/tmp/expaudit/a.jsonl`, 19 requests, fresh `XDG_DATA_HOME` per run.

Part 2 harness: the real `claude` CLI as an MCP client against `/private/tmp/uv3/mcp.json`, which
registers only `expense-tracker`, with fresh `XDG_DATA_HOME=/private/tmp/uv3/data` and
`XDG_CONFIG_HOME=/private/tmp/uv3/cfg` (free tier, `MCP_LICENSE_KEY=""`). The registered command is a
15-line shim, `/private/tmp/uv3/shim.mjs`, which tees every `tools/call` name to a log and forwards
stdin verbatim to `node /Users/mike/mcp-servers/servers/expense-tracker/dist/index.js`, so tool calls
are countable without changing the output format.

---

## Part 1 — adversarial probes

| # | Probe | Before | Fixed | After |
| --- | --- | --- | --- | --- |
| 1 | `expense_add` with no arguments | PASS | - | zod: `Required at amount` |
| 2 | `expense_add {amount: "12.34"}` (wrong type) | PASS | - | zod: `Expected number, received string` |
| 3 | `expense_add` with a 1 MB `merchant` | **FAIL** | yes | refused at the schema: `must be 500 characters or fewer` |
| 4 | `expense_add {amount: -5}` | PASS | - | `amount must be zero or positive` |
| 5 | `expense_add {amount: 1e308}` | PASS | - | `that amount is too large to represent exactly` |
| 6 | `expense_add {currency: "XYZ"}` | **FAIL** | yes | `"XYZ" is not an ISO 4217 currency code` |
| 7 | `expense_add {date: "2026-13-45"}` | PASS | - | `date must be a real calendar date as YYYY-MM-DD` |
| 8 | `expense_summary {from: "2026-13-45"}` | PASS | - | `from must be YYYY-MM-DD` |
| 9 | `receipt_path` on a nonexistent path | PASS | - | `receipt file not found: /nope/x.pdf` |
| 10 | `receipt_path` / `receipt_attach` on `/etc/passwd` | PASS | - | reads and hashes a world-readable file the caller named; no crash, no write. Files over 25 MB now refused before `readFileSync` |
| 11 | `category_rules` with `(a+)+$`, then a 60-char merchant | **FAIL: no response, process killed at 15 s** | yes | the rule is refused at store time with a named reason; the matcher additionally falls back to substring and caps its input at 512 chars |
| 12 | `expense_export` to `../../../../etc/passwd` | PASS | - | `EACCES ... open '/etc/passwd.<pid>.tmp'`, tmp unlinked, no partial file |
| 13 | `expense_export` to `/etc/passwd` | PASS | - | same clean EACCES |
| 14 | `expense_update` / `expense_delete` / `receipt_attach` with an unknown id | PASS | - | `no expense with id nope.` |
| 15 | `mileage_add {km, miles}` both given | PASS | - | `give exactly one of km or miles` |
| 16 | `mileage_add {km: 1e308}` | PASS | - | `that distance is too large to represent exactly` |
| 17 | `expense_update {currency: "JPY"}` on a EUR expense | **FAIL (silent 100x)** | yes | refused: `EUR has 2 decimals and JPY has 0, so the stored amount cannot carry over. Pass amount as well.` |
| 18 | `expense_to_invoice` over mixed EUR + PLN | PASS | - | two `line_items_per_currency` groups, never summed; EUR 61.50 at 23% emits `unit_price 50.00, tax_rate 23` |
| 19 | free caps never write a partial file | PASS | - | gated csv/xlsx export returns `isError: false` and `existsSync(path) === false` |
| 20 | two processes, one data dir, 40 concurrent `expense_add` | PASS | - | 40 stored, 40 unique ids (`withFileLock`), unchanged from the build run |
| 21 | stdout carries only JSON-RPC | PASS | - | no `console.*` in `src/`; the probe flagged no non-JSON line, and `test/adversarial.test.mjs` asserts it |
| 22 | no network calls | PASS | - | grep for `fetch`, `http`, `net`, `dns` over `src/` returns nothing |

### The one that hung

Probe 11 is the only probe that took the server down. With `{match: "(a+)+$", category: "Evil"}`
stored, `expense_add {merchant: "aaaa...a!"}` (60 characters) never returned; the run ended in
`TIMEOUT_5S` and the process was SIGKILLed at 15 s. Every request queued behind it — probes 10 and 12
in the same batch — was lost too, because catastrophic backtracking blocks the single event loop that
also serves stdio. A rule list is caller-supplied data, so this is reachable by anything that can call
`category_rules`.

Fix, `src/money.ts` + `src/index.ts`:

- `hasRegexMetacharacters()` — a pattern with none of `\^$.|?*+()[]{}` is a plain substring and never
  reaches the regex engine. Most rules ("Adobe", "Media Markt") are in this class.
- `isSafeRegexSource()` — refuses a source over 100 characters, a quantified group that itself
  contains a quantifier (`(a+)+`), and a quantified group containing an alternation (`(a|a)*`).
- `category_rules` refuses an unsafe pattern outright rather than silently demoting it to a substring
  that would never match, so the user is told: *"a quantified group that itself repeats (such as
  `(a+)+`) can take unbounded time to match. Nothing was changed."*
- `ruleMatches()` caps its input at `MAX_MATCH_INPUT = 512` characters, so a long merchant cannot be
  the cost driver even for a safe pattern.

`uber|bolt` still compiles and still matches, which is what the user-value run actually needed.

### Edits made

| File | Change |
| --- | --- |
| `src/money.ts` | `ISO_4217` (the active alphabetic codes) + `isKnownCurrency()`; `isSafeRegexSource()`, `hasRegexMetacharacters()`, `MAX_MATCH_INPUT` |
| `src/index.ts` | `MAX_TEXT = 500` / `text()` schema helper on every free-text field (`merchant`, `category`, `project`, `note` 2000, `purpose` 2000, ids 64, paths 4096, rule match 200, rule list max 500) |
| `src/index.ts` | `expense_add` and `mileage_add` reject a currency that is not ISO 4217 |
| `src/index.ts` | `expense_update` refuses a currency change that would rescale the minor units unless `amount` is passed too |
| `src/index.ts` | `hashReceipt()` checks existence, type and a 25 MB size cap before `readFileSync` |
| `src/index.ts` | `ruleMatches()` substring-first, bounded regex, bounded input |
| `src/index.ts` | `category_rules` refuses an unsafe pattern with a named reason |
| `src/index.ts` | new `expense_settings` tool, `src/store.ts` `DB.settings` (see D-E1) |
| `src/index.ts` | `markup_percent` is no longer Pro-gated (see D-E2) |
| `test/adversarial.test.mjs` | new file, 7 tests covering all of the above |

---

## Part 2 — user value through a real MCP client

`claude -p "<prompt>" --mcp-config /private/tmp/uv3/mcp.json --strict-mcp-config --model sonnet
--output-format json --max-turns 12 --allowedTools "<the 13 mcp__expense-tracker__* tools>"`,
run in order against one fresh free-tier data dir, so each scenario sees the previous one's state.

Note on the allowlist: the round-2 form `--allowedTools "mcp__*"` no longer grants anything. All
seven scenarios came back with *"the tool call needs your permission approval"* and zero tool calls.
The explicit per-tool list (`mcp__expense-tracker__expense_add,...`) works. This is a harness fact,
not a server defect, but any later run must use the explicit list.

### Scorecard — 19 / 21 (before the two Part 2 fixes: 18 / 21)

3 = correct, right numbers, no clarification. 2 = correct but with a gap the user has to close.
1 = partially wrong. 0 = failed.

| # | Scenario | Before | After | Calls | Sec | Tools | Note |
|---|---|---|---|---|---|---|---|
| s1 | "I paid 61.50 EUR at Media Markt for a USB hub today, for the Acme project, it's billable." | 2 | 2 | 1 | 22.1 | `expense_add` | EUR 61.50, 2026-09-02, project Acme, billable, note "USB hub" — all parsed in one call. VAT still 0% because the user named no rate; after the fix the answer says so ("recorded as net=gross with 0 VAT") and offers to set one. See D-E1. |
| s2 | "Log 45 km driving to a client meeting yesterday in Poland." | 3 | 3 | 1 | 9.2 | `mileage_add` | "Poland" -> `region: PL`, "yesterday" -> 2026-09-01, **45 x 1.15 = PLN 51.75**, exact. |
| s3 | "Add a rule: anything from Uber or Bolt is Travel." | 3 | 3 | 2 | 13.0 | `category_rules` x2 | Read the existing rules first, then wrote — correct, because the tool replaces the whole list. Stored `uber|bolt -> Travel`. |
| s4 | "Paid 23 PLN Bolt ride this morning." | 3 | 3 | 1 | 8.4 | `expense_add` | PLN 23.00, auto-categorised `travel` off the s3 rule. |
| s5 | "What did I spend this month by category?" | 3 | 3 | 1 | 8.7 | `expense_summary` | EUR 61.50 uncategorised; PLN mileage 51.75 + travel 23.00 = 74.75. Currencies reported separately and the model said why. |
| s6 | "Give me the invoice lines to rebill Acme for this month's expenses with 10% markup." | **1** | **2** | 2 | 31.0 | `expense_to_invoice`, `expense_list` | Before: the Pro wall on `markup_percent` sent the model to `expense_list` and it did the markup by hand off the gross. After: `expense_to_invoice` answers with the markup; EUR 61.50 x 1.10 = **67.65**, tax_rate 0%. Not a 3 only because the model passed `mark_rebilled: false` and left the expense unflagged. |
| s7 | "Export this month's expenses as CSV to /private/tmp/uv3/exp.csv." | 3 | 3 | 1 | 11.6 | `expense_export` | 4 lines (header + 3), gross/net/vat columns present, path exactly as asked. |

Calls exclude the client's own schema lookups. Total wall time 104.0 s for seven scenarios.

### Numbers verified independently

- Mileage: `45 * 1.15 = 51.74999999999999` in float; the stored `amount_minor` is **5175**, i.e.
  PLN 51.75. `roundHalfUp` absorbs the representation error.
- VAT split of EUR 61.50 at 23%: `roundHalfUp(6150 * 100 / 123) = 5000` net, `6150 - 5000 = 1150` VAT,
  i.e. **net 50.00 + VAT 11.50 = 61.50 exactly**. Asserted in `test/adversarial.test.mjs`. This is the
  split the run did *not* produce, because no rate was ever supplied (D-E1).
- Rebill with markup: net 5000 minor x 1.10 = **unit_price 55.00 with tax_rate 23**, not
  `61.50 x 1.10` on the gross. Asserted.
- CSV: `id,date,currency,gross,net,vat,vat_rate,category,merchant,project,billable,note,receipt_path,receipt_sha256,mileage`
  plus three rows matching `data.json` exactly.

### Defects

**D-E1 (high) — an expense-tracking server that never splits VAT.**
`vat_rate` is a per-call optional and nothing supplies it, so in a realistic session every expense
lands with `vat_rate` absent and `net == gross`, `vat == 0`. The exported CSV's `net` and `vat`
columns are a copy of `gross`. Repro: the s1 prompt above; `data.json` has no `vat_rate` key and
`exp.csv` row 3 reads `61.5,61.5,0,0`.
Fixed, partly. Two server-side changes:
1. New `expense_settings` tool storing an opt-in `default_vat_rate` (and `default_currency`), applied
   by `expense_add` when a call names no rate. Set 23 once and every later expense splits.
2. When no rate applies at all, the `expense_add` reply now says so in the user's own answer: *"No VAT
   rate was given, so net equals gross and the VAT column is 0. Pass vat_rate on the call, or set a
   default once with expense_settings."*
Not fixed: the server still does not invent a rate from the merchant's country, and it should not —
a fabricated tax rate on a real ledger is worse than a visible zero. After the fix the model's own s1
answer surfaced the gap unprompted ("If this was a German receipt (likely 19%), let me know").

**D-E2 (high) — the Pro wall on `markup_percent` produced a wrong invoice line.**
Before the fix, s6 hit `markup_percent is a Pro feature`, and the model did not stop: it re-read the
data with `expense_list` and emitted `unit_price 67.65, tax_rate 0%` computed as
`61.50 (gross) x 1.10`. That is precisely the double-taxable shape `expense_to_invoice` was written to
prevent — on a VAT-bearing expense the client would have been invoiced the gross plus VAT again.
The paywall converted a correct tool into an incorrect hand calculation, and cost 45.7 s.
Repro (on the pre-fix build): the s6 prompt, or
`expense_to_invoice {project:"Acme", from:..., to:..., markup_percent:10}` on a free data dir.
Fixed: `markup_percent` is free. The free-tier limit on this tool is the 20-item cap, which is a
volume limit; the arithmetic is not something to withhold. `servers/expense-tracker/src/index.ts`,
`expense_to_invoice`; README free/pro table updated.

**D-E3 (medium, not fixed) — `expense_to_invoice` marks every currency group rebilled at once.**
A mixed-currency selection returns two groups, but the user can only pass one of them to
`invoice_create`. `mark_rebilled` defaults to true and stamps all rows, including the group that was
never invoiced. Repro: the "mixed currencies" test in `test/adversarial.test.mjs` with
`mark_rebilled` left at its default — both the EUR and the PLN rows get `rebilled_at`. Fix direction:
a `currency` argument that both narrows the result to one group and scopes the marking, defaulting to
"all groups" only when the selection is single-currency. Left for the owner; it changes the tool's
contract rather than patching a bug.

**D-E4 (low, harness, not a server defect) — `--allowedTools "mcp__*"` grants nothing.**
Seven of seven scenarios returned a permission-request sentence and zero tool calls until the
allowlist was written out per tool. `docs/USER_VALUE_R2.md` records the glob form; it no longer works.

**D-E5 (low, not fixed) — `expense_summary` cannot be asked for "this month".**
`from` and `to` are both required ISO dates, so "what did I spend this month" only works because the
model computes the month boundaries itself. It got them right here. Fix direction: an optional
`month: "YYYY-MM"` alternative, as the `monthly_close` prompt already constructs internally.

---

## Test summary

```
$ npm run build -w servers/expense-tracker
> tsc -p tsconfig.json && node -e "...chmodSync('dist/index.js',0o755)"
(no output, exit 0)

$ npm test -w servers/expense-tracker
1..21
# tests 21
# pass 21
# fail 0
# duration_ms 818
```

21 tests, up from 14. New file `test/adversarial.test.mjs` (7): regex safety unit checks, ISO 4217
unit checks, a hostile-input stdio test that also asserts stdout carried no non-JSON line, mixed-currency
rebill grouping, the free export cap writing no partial file, `expense_settings` VAT defaulting, and a
free markup rebill that keeps `tax_rate` on the net line.

---

## RESULT.md block

```
status: DONE

evidence:
$ node /private/tmp/mcp-audit/probe.mjs dist/index.js a.jsonl <fresh dir>   # 19 hostile requests
before: TIMEOUT_5S, process SIGKILLed, 3 requests never answered
after:  EXIT=0, 19 responses, every stdout line parseable JSON
$ npm test -w servers/expense-tracker
1..21 / # pass 21 / # fail 0 / # duration_ms 818
$ claude -p ... --mcp-config /private/tmp/uv3/mcp.json --strict-mcp-config --model sonnet
7 scenarios, 19/21, 9 tool calls, 104.0 s total

artifacts:
- /Users/mike/mcp-servers/docs/EXPENSE_AUDIT.md
- /Users/mike/mcp-servers/servers/expense-tracker/src/{index.ts,money.ts,store.ts}
- /Users/mike/mcp-servers/servers/expense-tracker/test/adversarial.test.mjs
- /private/tmp/uv3/{mcp.json,shim.mjs,run.sh,s1..s7.json,exp.csv}

cost: 41 wall minutes

failures:
- category_rules accepted "(a+)+$" and the next expense_add with a 60-character merchant never
  returned; the stdio server was killed at 15 s and every queued request was lost. Fixed:
  substring-first matching, a nested-quantifier check that refuses the pattern at store time, and a
  512-character cap on the matched input.
- markup_percent was Pro-gated; the model routed around it and emitted an invoice line priced off the
  gross with tax_rate 0, the exact double-tax the tool exists to prevent. Fixed: markup is free, the
  20-item cap remains the free limit.
- 1 MB merchant stored verbatim, "XYZ" accepted as a currency, and a EUR-to-JPY currency change
  silently reinterpreted 1234 cents as JPY 1234. All three refused now.

insight:
The paywall was the correctness bug. A limit on a tool the model can approximate by hand does not
stop the work, it moves the arithmetic out of the server and into the model's head, where the invariant
the server enforces (unit_price is the NET, tax_rate carries the VAT) does not exist. Measured: with
markup_percent gated, the model recomputed the line by hand as gross x 1.10; on the same expense
carrying 23% VAT the tool returns net 50.00 x 1.10 = 55.00 with tax_rate 23, while the hand
calculation returns 67.65 with tax_rate 0. Both look like an answer. Only one survives being handed
to invoice_create, which recomputes the tax from tax_rate.
```
