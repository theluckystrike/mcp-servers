# User value audit, round 3 — 2026-09-02

Rounds 1 and 2 tested four stdio servers, one prompt per conversation. This round tests the three
things a real user actually does that neither round covered: the **bundle** (all five servers behind
one config entry, four prompts in one conversation), the **hosted HTTP endpoints** (state that has to
survive a new session, and a link that has to resolve), and a **regression** pass over the four
round-2 scenarios that scored below 3.

Method, per surface:

- **bundle** — `servers/office-suite/dist/index.js` registered as one server named `office` in
  `/private/tmp/uv4/mcp.json`, fresh `XDG_DATA_HOME=/private/tmp/uv4/data`,
  `XDG_CONFIG_HOME=/private/tmp/uv4/cfg`, `MCP_LICENSE_KEY=""` (free tier). Four prompts in ONE
  conversation: `--session-id <uuid>` for the first, `--resume <uuid>` for the rest.
  `--strict-mcp-config --model sonnet --output-format stream-json --verbose --max-turns 14`.
  The allowlist is written out per tool name (50 entries, `mcp__office__<tool>`), because
  `--allowedTools "mcp__*"` grants nothing (D-E4 in `docs/EXPENSE_AUDIT.md`).
- **remote** — `claude mcp add --transport http --scope local tt https://mcp.zovo.one/mcp/time-tracker
  --header "Authorization: Bearer <token>"`, same for `inv`, in `/private/tmp/uv5`. Token from
  `GET https://mcp.zovo.one/mcp/token` (anonymous free tier, 30 days). Both local-scope entries removed
  at the end (`claude mcp remove tt --scope local`, verified: `claude mcp list` shows neither).
- **stdio** — `/private/tmp/uv2/mcp.json` unchanged from round 2, round-2 data dir intact so the
  entries tt4 needs still exist; expense s1 against a fresh `/private/tmp/uv3b`.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn or extra
noise. 1 = partially wrong, or asked for something the tool could infer. 0 = failed.
Tool-call counts exclude the client's own `ToolSearch` schema lookups.

## Scorecard — 28 / 36

| Surface | Scenario | Score | Calls | Sec | Note |
|---|---|---|---|---|---|
| bundle | a1 "Start a timer for Acme" | 3 | 1 | 7.3 | `timer_start`. Bundle came up proxying all five children: `proxying [time-tracker, price-tracker, spreadsheet, invoice, expense-tracker], 48 tools` (50 with the two license tools). |
| bundle | a2 "Stop it, log 2.5 more hours ... and log the 61.50 EUR Media Markt USB hub receipt ... as billable." | 3 | 3 | 15.4 | `timer_stop` -> `entry_add` -> `expense_add`. Three different child servers in one turn, no name collisions. **EUR 225.00** correct. Expense stored at EUR 61.50 with no VAT split, and the model volunteered that. |
| bundle | a3 "Now invoice Acme for this week's hours and the rebillable expenses, 23% VAT, due in 14 days, PDF." | **0** | 4 | 47.7 | `entry_list` -> `invoice_summary` -> `expense_to_invoice` -> `invoice_create` -> `Error: no business profile yet. Call business_set first.` No invoice, no PDF; the turn ends asking the user for business details (D-R2). Along the way `expense_to_invoice` emitted the gross 61.50 as a net line (D-R3) and set `marked_rebilled: true` on an invoice that was never created (D-R4). |
| bundle | a4 "What did I spend this month and what is still unbilled?" | 2 | 3 | 32.3 | `expense_summary` -> `expense_list` -> `report`. Spend EUR 61.50 and unbilled EUR 225.00 both correct, and the model caught its own a3 damage: "it got marked `rebilled` ... even though the invoice creation itself failed". Correct, honest, and describing a ledger that is wrong. |
| remote | b1 "Start a timer for Remote Co" | 3 | 1 | 11.8 | `mcp__tt__timer_start` over HTTP. **First attempt scored 0** — see D-R5. |
| remote | b2 "What timer is running and stop it" (NEW session) | 3 | 2 | 13.9 | `timer_status` -> `timer_stop`: "Timer for **Remote Co** was running (started 14:30:15 UTC, ran 23 seconds). Stopped and logged as entry `a4a7db17`." Zero conversation history; the state came back from the server. This is the property the hosted surface exists for and it holds. |
| remote | b3 "Invoice Remote Co for 3 hours at 100 USD, give me the document link" | 1 | 1 | 11.1 | `invoice_from_hours` refused: no business profile. No invoice, no link. The same wall as a3, different transport, different server process (D-R2). |
| remote | b3b (follow-up with the business supplied) | 3 | 3 | 23.5 | `business_set` -> `invoice_from_hours` -> `invoice_pdf`. INV-2026-0001, 3 h x USD 100 = **USD 300.00**, due 2026-09-16. Link returns **HTTP 200**, 1693 bytes — but `Content-Type: text/html` (D-R6). |
| stdio | pt1 natural price question | 2 (was 1) | 2 | 14.5 | `WebFetch` first, then `mcp__price-tracker__price_check`; the answer reported is the server's: **GBP 51.77** plus the low-confidence caveat. |
| stdio | tt4 invoice lines | 3 (was 2) | 5 | 23.5 | `invoice_summary` answers on free now (D-11 closed). 7 calls / 35.6 s -> 5 calls / 23.5 s. Design review 2.50 h at EUR 90.00/h = **EUR 225.00**; the stray 8-second entry shown as 0.00 h and explained. |
| stdio | ss2 top rep North | 3 (was 1) | 2 | 14.5 | `sheet_info` -> `sheet_query`. **Turing 650, Hopper 567, Linus T 551, Lovelace 486, Liskov 290** — ground truth exactly. No self-added `Status` filter (D-10 not reproduced). Deviation: the absolute xlsx path was in the prompt this round. |
| stdio | expense s1 Media Markt | 2 (was 2) | 1 | 18.5 | `expense_add`, one call, fresh dir. EUR 61.50, 2026-09-02, Acme, billable, note "USB hub". VAT 0% with the honest "net = gross with EUR 0 VAT recorded" line. Unchanged. |

Per surface: bundle 8/12, remote 10/12, stdio regression 10/12 (round 2 scored those four 6/12).

## Cross-server arithmetic check

| Quantity | Expected | Observed | Pass |
|---|---|---|---|
| Hours | 2.5 x 90 = EUR 225.00 | EUR 225.00 in `entry_add`, `invoice_summary` and `report` | yes |
| Expense net | EUR 50.00 (61.50 gross at 23%) | **EUR 61.50, `tax_rate: 0`** | **no** |
| Invoice total | (225 + 50) x 1.23 = EUR 338.25 | not produced in conversation; direct probe with correct inputs = **EUR 338.25** | engine yes, flow no |

The expense line is the failure and it is worth stating precisely. `expense_add` with no `vat_rate`
stores net = gross = 61.50. `expense_to_invoice` then hands the invoice `{unit_price: 61.5,
tax_rate: 0}`. Apply the 23% the user asked for and the client is billed **EUR 75.65 for a EUR 61.50
receipt** — the exact double-taxation this check was written to catch. Setting
`expense_settings {default_vat_rate: 23}` afterwards does not repair it: a probe with
`include_rebilled: true` still returns `unit_price 61.5, tax_rate 0, total_net "EUR 61.50"`.

The invoice engine itself is exact. `invoice_create` with `items:[{2.5 x 90}, {1 x 50}]` against a
business whose `default_tax_rate` is 23 returns `subtotal EUR 275.00`, `tax 23%`, **`total EUR 338.25`**
(INV-2026-0003). The same call against a profile where that field was left at 0 returns EUR 275.00 with
`tax_rate "0%"` on both lines and no warning — see D-R7.

**Did the model ever leave the bundle? No.** All eleven bundle tool calls were `mcp__office__*`:
`timer_start`, `timer_stop`, `entry_add`, `expense_add`, `entry_list`, `invoice_summary`,
`expense_to_invoice`, `invoice_create`, `expense_summary`, `expense_list`, `report`. No Bash, no
python, no WebFetch, no file tools. The only non-office calls in the four turns were six `ToolSearch`
schema lookups, which are the client's own. Cross-server routing through the proxy was clean: a single
turn (a2) hit three different child processes and every result came back to the right tool.

## Defects

**D-R2 (high, invoice) — every invoicing path dead-ends on a missing business profile, after the work.**
Reproduced on two surfaces and two transports, both first sessions: bundle a3 and remote b3.
`invoice_create` / `invoice_from_hours` -> `Error: no business profile yet. Call business_set first.`
In a3 that arrived 47.7 s in, after `entry_list`, `invoice_summary` and `expense_to_invoice` had all
run and one of them had already mutated the ledger. The model cannot invent a business name, so the
turn can only end as a question. This is the single largest score loss in the round (a 0 and a 1).
Fix direction: either let the invoice be created with a placeholder issuer plus a loud note — which
these tools already do for an unknown *client* — or name the prerequisite in the description of every
invoice-producing tool so the model asks first instead of last.

**D-R3 (high, expense-tracker) — `expense_to_invoice` rebills a VAT-inclusive receipt as a net line.**
Repro:
`node /private/tmp/uv4/probe4.mjs '{"name":"expense_to_invoice","args":{"project":"Acme","from":"2026-09-01","to":"2026-09-02","include_rebilled":true}}'`
-> `{"unit_price": 61.5, "tax_rate": 0, "total_net": "EUR 61.50"}`. The receipt was gross. Fix
direction: carry the gross figure alongside the net in the payload and refuse (or warn in-band) when a
rebilled expense has `vat_rate: 0` while a non-zero default exists. Also: `expense_settings
{default_vat_rate}` is not retroactive and does not say so.

**D-R4 (medium, expense-tracker) — the rebilled flag is set before any invoice exists.**
Repro: bundle a3. `expense_to_invoice` returned `marked_rebilled: true`; the following
`invoice_create` failed. The expense is now flagged as billed and will not resurface in the next run.
a4 read the ledger back and reported "EUR 0 shows as pending, but that's misleading". The model caught
it; a user reading the first line of a4 would not. Fix direction: a `dry_run` default, or require an
`invoice_number` so the flag is only set once a line is attached to a created invoice.

**D-R5 (high, hosted) — the first HTTP connection is not ready at session start, so the model runs with zero tools.**
Immediately after `claude mcp add --transport http`, the first `claude -p` run emitted
`system/init` with `[{"name":"tt","status":"pending"},{"name":"inv","status":"pending"}]` and an empty
`mcp__` tool list. The model answered "Could you clarify what you mean by Remote Co?" with **0 tool
calls** in 10.5 s. The identical command about a minute later showed `tt: connected`, 13 tools, and
worked in 11.8 s. The stdio surface never does this. Most likely a cold start on the hosted side
rather than a client bug, but the prompt it loses is the user's very first one.

**D-R7 (medium, invoice) — `business_set` silently drops an unrecognised `tax_rate` key.**
`business_set {name:"Zovo Studio", tax_rate: 23}` succeeds and echoes back a profile containing
`"default_tax_rate": 0`. The wrong key was accepted and discarded. `invoice_create` then produced
INV-2026-0001 with `tax_rate "0%"` on every line and `total EUR 275.00` where EUR 338.25 was intended,
with no warning at any point. The same call with `default_tax_rate: 23` gives EUR 338.25. The field is
called `default_tax_rate`; the user and the model both say "tax rate". Fix direction: accept
`tax_rate` / `vat_rate` as aliases, or make the schema strict so an unknown key errors instead of
vanishing. A silently zero VAT on a delivered invoice is the most expensive quiet failure in this repo.

**D-R1 (medium, time-tracker) — `invoice_summary` prints a blended rate that is nobody's rate.**
In the bundle run, project Acme held one 0.01 h entry with no rate and one 2.50 h entry at EUR 90.00.
Neither has a task, so both land in the same `(no task)` group and the summary printed
`(no task)  2.50  EUR 89.82  EUR 225.00` — 225.00 / 2.505 = 89.82. The amount is right; the rate is a
number the user never agreed to and cannot put on an invoice. The stdio run shows the correct output
when tasks differ: `Design review 2.50 EUR 90.00 EUR 225.00` with a separate `(no task) 0.00 - -` row.
Fix direction: group by (task, rate, currency), or print the rate only when every entry in the group
shares it.

**D-R6 (low, hosted) — the "document link" serves `text/html`, not a PDF.**
`curl https://mcp.zovo.one/mcp/download/81ef3dda6579d2113f6eb6a73ac53c0b` -> HTTP 200, 1693 bytes,
`Content-Type: text/html; charset=utf-8`. The body is a complete A4 print-stylesheet invoice
(`<title>Invoice INV-2026-0001</title>`, `@page{size:A4;margin:18mm}`), so it prints correctly, but
the model called it a PDF and a user who saves it gets `.html`. Fix direction: serve the rendered PDF,
or have the tool response call it a printable invoice page.

## Regression deltas vs round 2

| Scenario | R2 | R3 | Change | Why |
|---|---|---|---|---|
| pt1 | 1 | 2 | +1 | `price_check` is now called and its answer is the one the user reads; WebFetch still goes first, so D-4 is half-closed, not closed. |
| tt4 | 2 | 3 | +1 | D-11 closed. `invoice_summary` answers on free: 7 calls / 35.6 s -> 5 calls / 23.5 s. |
| ss2 | 1 | 3 | +2 | D-10 not reproduced. No self-added `[Status]="Closed"` filter; ranking matches ground truth. |
| expense s1 | 2 | 2 | 0 | Unchanged. VAT 0 by design when the user names no rate, and the tool says so. |

6/12 -> 10/12 on the four scenarios that were failing. None of the three round-2 defects that had a
code fix reproduced.

## Bottom line

The bundle works as a *proxy* and fails as a *workflow*. Routing is clean — five children, 50 tools,
one config entry, three servers touched in a single turn, and the model never once reached outside it
for Bash or WebFetch, which is the thing a bundle is supposed to buy. What breaks is the sequence a
real freelancer runs end to end: the timer and the hours are right, the expense is stored gross,
`expense_to_invoice` hands that gross figure over as net, the rebilled flag is set on an invoice that
then fails to exist because no business profile was ever set, and the user ends the turn being asked
for their own company address instead of holding a PDF. Four of the seven defects in this round sit in
that one chain. The arithmetic engine is not the problem: given correct inputs it returns EUR 338.25
to the cent. Every failure here is a handoff between two servers that each did their own job.

The hosted surface is in better shape than expected on the thing that is hardest — state genuinely
persists server-side, and a fresh session with no history correctly found and stopped a timer started
by a different session. Its two defects are at the edges: a cold first connection that costs the
user's first prompt, and a link that says PDF and serves HTML.

## RESULT.md

```
status: DONE
evidence:
  12 scenarios across 3 surfaces, claude CLI as MCP client, free tier
  bundle (/private/tmp/uv4, office-suite as one server "office", 5 children, 50 tools, one conversation)
    a1 3/3 1 call 7.3s | a2 3/3 3 calls 15.4s | a3 0/3 4 calls 47.7s | a4 2/3 3 calls 32.3s  = 8/12
    never left the bundle: 11/11 tool calls were mcp__office__*, 0 Bash/WebFetch/file tools
  remote (mcp.zovo.one over HTTP, anon bearer token, local scope, removed afterwards)
    b1 3/3 1 call 11.8s | b2 3/3 2 calls 13.9s | b3 1/3 1 call 11.1s | b3b 3/3 3 calls 23.5s = 10/12
    b2 ran in a NEW session with no history and recovered the running timer server-side
    download link HTTP 200, 1693 bytes, Content-Type text/html (not PDF)
  stdio regression (/private/tmp/uv2 + /private/tmp/uv3b), 4 round-2 scenarios under 3
    pt1 1->2 | tt4 2->3 | ss2 1->3 | s1 2->2  = 6/12 -> 10/12
  arithmetic: hours 2.5 x 90 = EUR 225.00 PASS
              expense net EUR 50.00 expected, got EUR 61.50 tax_rate 0 FAIL
              invoice total EUR 338.25 exact by direct probe, never produced in conversation
artifacts:
  docs/USER_VALUE_R3.md
  data/user_value_r3.json
  /private/tmp/uv4/out/*.jsonl (bundle transcripts), /private/tmp/uv4/probe4.mjs
  /private/tmp/uv5/*.jsonl (remote transcripts), /private/tmp/uv5/inv.pdf (the html the link served)
  /private/tmp/uv2/out/r3_*.jsonl, /private/tmp/uv3b/s1.json
failures:
  D-R2 high  invoice: no business profile blocks a3 and b3 after the work is done
  D-R3 high  expense-tracker: expense_to_invoice rebills gross 61.50 as a net line
  D-R4 med   expense-tracker: marked_rebilled set before the invoice exists
  D-R5 high  hosted: first HTTP session shows servers "pending", 0 tools, 0 tool calls
  D-R7 med   invoice: business_set silently drops tax_rate, invoice ships with 0% VAT
  D-R1 med   time-tracker: invoice_summary prints a blended rate (EUR 89.82) nobody agreed to
  D-R6 low   hosted: "document link" serves text/html
insight:
  Bundling removed every tool-selection loss and added none. Across four turns the model made
  eleven calls and all eleven stayed inside the proxy; even the price question's WebFetch habit
  has no analogue here. The losses moved entirely to state handoffs between children that each
  behaved correctly in isolation: a gross amount read as net, a flag set on a transaction that
  was then rolled back. Rounds 1 and 2 could not see this class at all, because one prompt per
  conversation never lets two servers touch the same record.
```

## Round-3 fixes

Six of the seven defects above had a code fix in `servers/invoice`, `servers/expense-tracker` and
`servers/time-tracker`. D-R5 is a hosted cold-start and lives in `remote/`, which another agent owns.
Every fix carries a test that fails against the old behaviour.

| Defect | Fix | Code | Test |
|---|---|---|---|
| D-R2 high, invoice | A missing business profile no longer ends the turn. `createInvoice` drops the `hasBusiness()` guard, issues the document with the placeholder issuer `"Your business"`, and both `invoice_create` and `invoice_from_hours` return the line `No business profile yet: the PDF shows a placeholder issuer. Run business_set {name, address, vat_id, iban} and render the PDF again.` `invoice_pdf` renders with the same placeholder and repeats the line. | `servers/invoice/src/index.ts:45` (`PLACEHOLDER_ISSUER`), `:46` (`NO_BUSINESS_NOTE`), `:54` (`issuer()`), `:254` (guard removed), `:317` (`businessNote`), `:460` (pdf note) | `servers/invoice/test/smoke.test.mjs:269` |
| D-R7 med, invoice | `business_set` takes `tax_rate` / `vat_rate` / `vat` as aliases for `default_tax_rate` and echoes `Read tax_rate: 23 as default_tax_rate: 23.`; its schema is a `passthrough()` object so an unrecognised key produces `Warning: ignored unknown fields ... Accepted fields: name, address, email, vat_id, iban, bank, logo_path, default_currency, default_tax_rate, payment_terms_days, invoice_prefix, ...` instead of vanishing. `invoice_create` items take `vat_rate` / `vat` as aliases for `tax_rate` through a schema transform. | `servers/invoice/src/index.ts:137` (aliases + warning), `:232` (item alias transform) | `servers/invoice/test/smoke.test.mjs:306` |
| D-R6 low, invoice | `invoice_pdf` names the file for what it holds: `Wrote PDF invoice <path>`, or `Wrote HTML invoice (print to PDF) <path>` plus `holds PDF bytes despite the .html name. Use a .pdf path.` when the out path ends in `.html`. `documentLabel(path, html?)` takes an explicit flag so a caller that serves HTML can pass one. | `servers/invoice/src/index.ts:64` (`documentLabel`), `:460` | `servers/invoice/test/smoke.test.mjs:342` |
| D-R3 high, expense-tracker | `expense_to_invoice` no longer emits a gross receipt as a net line. With `expense_settings.default_vat_rate` set, an expense with no recorded rate is split retroactively at rebill time and its description carries `[vat assumed 23%]`. Without one, `unit_price` is the gross, `tax_rate` is 0, and the description carries `[tax_rate: 0 (VAT unknown, gross rebilled as-is; set expense_settings default_vat_rate to split)]`, with `vat_unknown_lines` and a `vat_note` naming the double-tax risk in the payload. `expense_add` also accepts `tax_rate` and `vat` as aliases for `vat_rate`. | `servers/expense-tracker/src/index.ts:646` (split/gross rules), `:665` (suffix), `:690` (`vat_unknown_lines`), `:189` (expense_add aliases) | `servers/expense-tracker/test/adversarial.test.mjs:212`, `:234` |
| D-R4 med, expense-tracker | `expense_to_invoice` is a preview: `mark_rebilled` defaults to **false**, `marked_rebilled` reports it, and `next_step` names the two calls in order. New tool `expense_mark_rebilled {ids[] \| project+from+to, invoice_number?}` sets `rebilled_at` (and `rebilled_invoice`) once the invoice exists. | `servers/expense-tracker/src/index.ts:675` (default off), `:711` (`expense_mark_rebilled`), `servers/expense-tracker/src/store.ts:28` (`rebilled_invoice`) | `servers/expense-tracker/test/adversarial.test.mjs:190`, `servers/expense-tracker/test/smoke.test.mjs:174` |
| D-R1 med, time-tracker | `invoice_summary` groups by (task, rate, currency) instead of task alone, so the EUR 89.82 blend cannot occur: the 2.50 h at EUR 90.00 and the 0.01 h with no rate are two lines, and one task logged at two rates is two lines. The rate column prints `EUR 90.00/h` or `-`, never an average, and the total is unchanged. | `servers/time-tracker/src/index.ts:710` | `servers/time-tracker/test/smoke.test.mjs:202` |

Behaviour changes a caller can see: `expense_to_invoice` no longer marks anything rebilled (call
`expense_mark_rebilled` after `invoice_create`), and `invoice_create` / `invoice_from_hours` no longer
return `isError` when no business profile exists. READMEs for the three servers were updated to match.

### Verbatim test summaries

`npm run build` clean for all three. `npm test -w servers/<name>`:

```
### invoice
# tests 17
# suites 0
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1358.471709
### expense-tracker
# tests 24
# suites 0
# pass 24
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1663.463375
### time-tracker
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 581.191
```

`node scripts/validate.mjs` (run 15, `data/validation.json`), no probe lines changed:

```
expense-tracker: 22/22 in 471 ms
time-tracker: 18/18 in 234 ms
price-tracker: 18/18 in 286 ms
spreadsheet: 18/18 in 396 ms
invoice: 20/20 in 391 ms
remote: 2/7
billing: 11/11
validation db: /Users/mike/mcp-servers/data/validation.json run 15: 109/114
```

All five stdio servers and billing are green (96/96 and 11/11); the `expense_to_invoice` and
`invoice_create` probes pass unchanged. The remote block is not a code regression: it fails at the
first step, `GET https://mcp.zovo.one/mcp/token` ->
`{"error":"rate_limited","message":"This address has minted 10 anonymous tokens in the last hour ..."}`,
so the three `tools/list over HTTP` checks run with no token and see 0 tools. Runs 12 and 13 scored
remote 7/7 from this machine; `remote/` is being changed concurrently by another agent.
