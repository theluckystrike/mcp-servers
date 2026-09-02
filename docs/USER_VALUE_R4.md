# User value audit, round 4 — 2026-09-02

Round 4 re-runs **only** the round-3 scenarios that scored below 3, against the code landed in
"Round-3 fixes" (`docs/USER_VALUE_R3.md`). Same method, same rubric, same client. Everything that
scored 3 in round 3 (a1, a2, b2, tt4, ss2) was not re-run; a1 and a2 are included here anyway because
the bundle scenario is one conversation and a3/a4 cannot be reached without them.

Method, per surface:

- **bundle** — `servers/office-suite/dist/index.js` registered as one server named `office` in
  `/private/tmp/uv6/mcp.json`, fresh `XDG_DATA_HOME=/private/tmp/uv6/data`,
  `XDG_CONFIG_HOME=/private/tmp/uv6/cfg`, `MCP_LICENSE_KEY=""` (free tier). Five prompts in ONE
  conversation: `--session-id <uuid>` then `--resume`. `--strict-mcp-config --model sonnet
  --output-format stream-json --verbose --max-turns 14`. Allowlist written out per tool name — **51**
  entries now (`mcp__office__<tool>`, one more than round 3: `expense_mark_rebilled`), because
  `--allowedTools "mcp__*"` grants nothing (D-E4 in `docs/EXPENSE_AUDIT.md`). Startup line:
  `proxying [time-tracker, price-tracker, spreadsheet, invoice, expense-tracker], 49 tools`.
- **remote** — `GET https://mcp.zovo.one/mcp/token` returned **HTTP 429**
  (`"This address has minted 10 anonymous tokens in the last hour"`), so per instruction the run used a
  Pro key signed locally with `node scripts/sign-license.mjs '*'`
  (`MCPL1.eyJ2IjoxLCJwIjoiKiIsImlkIjoiYTc0YjJlMGVmZjdmIiwiaWF0IjoxNzg4MzYwNTc2fQ...`, id `a74b2e0eff7f`).
  A signed key is its own fresh data space, so b3 still ran as a first-session user with no business
  profile. `claude mcp add --transport http --scope local`, local scope removed after every run
  (`claude mcp remove ... --scope local`, 5 removals, verified).
- **stdio** — pt1 against `/private/tmp/uv2` (round-2/3 dir, unchanged); expense s1 against a fresh
  `/private/tmp/uv8`.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn or extra
noise. 1 = partially wrong, or asked for something the tool could infer. 0 = failed.
Tool-call counts exclude the client's own `ToolSearch` schema lookups.

## Scorecard — 20 / 24 (the same eight scenarios scored 13 / 24 in round 3)

| Surface | Scenario | R3 | R4 | Calls | Sec | Note |
|---|---|---|---|---|---|---|
| bundle | a1 "Start a timer for Acme" | 3 | 3 | 1 | 7.7 | `timer_start`. Context prompt for the sequence; unchanged. |
| bundle | a2 "Stop it, log 2.5 more hours ... and the 61.50 EUR Media Markt receipt ... billable" | 3 | 3 | 3 | 14.6 | `timer_stop` -> `entry_add` -> `expense_add`. EUR 225.00 correct; the model again volunteers that no VAT rate was recorded. |
| bundle | a3 "Now invoice Acme for this week's hours and the rebillable expenses, 23% VAT, due in 14 days, PDF." | **0** | **3** | 6 | 53.2 | `entry_list` -> `expense_update {vat_rate:23}` -> `expense_to_invoice` -> `invoice_create` -> `expense_mark_rebilled` -> `invoice_pdf`. **INV-2026-0001, subtotal EUR 275.00, 23% = EUR 63.25, total EUR 338.25**, due 2026-09-16. Real PDF on disk. D-R2, D-R3, D-R4 all closed in one turn. |
| bundle | a4 "What did I spend this month and what is still unbilled?" | 2 | 3 | 3 | 27.3 | `expense_list` -> `entry_list` -> `expense_list`. "This month: EUR 61.50 ... Still unbilled: nothing" — both correct, and true this time, because a3 produced a real invoice. No paragraph of self-correction. |
| bundle | a5 (extra) "My business is Lucky Strike Software, I charge 23% VAT. Re-issue that invoice." | - | 3 | 2 | 13.3 | `business_set` -> `invoice_pdf`. Re-rendered with the real issuer, total unchanged at EUR 338.25. |
| remote | b3 "Invoice Remote Co for 3 hours at 100 USD, give me the document link" | 1 | 3 | 2 | 25.0 | `invoice_from_hours` -> `invoice_pdf`. USD 300.00, due 2026-09-16, link returned. The model relayed the link as "**HTML, print-to-PDF**" — D-R6 closed at the wording level. |
| remote | b1 first-run (D-R5 remeasure, 3 fresh temp projects) | 0 | 2 | 0 / 1 / 3 | 8.9 / 16.9 / 36.7 | **1 of 3 first runs still loses the prompt.** See D-R5 below. |
| stdio | pt1 natural price question | 2 | **1** | 1 | 10.6 | `WebFetch` only. `price_check` was never called. The number is right (GBP 51.77) and comes from the page, not the server. Regression, see D-R9. |
| stdio | expense s1 Media Markt | 2 | 2 | 1 | 13.1 | `expense_add`, one call, fresh dir. EUR 61.50, 2026-09-02, Acme, billable, note "USB hub", VAT 0% with the honest "net = gross" line. Unchanged, as designed. |

Per surface: bundle 12/12 (was 8/12 on a1-a4), remote 5/6 (was 1/6 on b1-first + b3), stdio 3/6 (was 4/6).

## Independent verification of the numbers

Not read off the model's prose — read off the stores and the wire.

| Check | Method | Result |
|---|---|---|
| Invoice total EUR 338.25 | `invoice_create` tool result in `out/a3.jsonl`: `"subtotal":"EUR 275.00"`, `"tax":["23% on EUR 275.00 = EUR 63.25"]`, `"total":"EUR 338.25"`, `"total_minor":33825` | PASS |
| The 23% was actually applied | both line items carry `"tax_rate":"23%"`; 275.00 x 1.23 = 338.25 | PASS |
| Expense split 61.50 gross -> 50.00 net | `/private/tmp/uv6/data/mcp-servers/expense-tracker/data.json`: `amount_minor 6150, vat_rate 23`; `expense_to_invoice` emitted `{unit_price: 50, tax_rate: 23}` with `total_net "EUR 50.00"` | PASS (D-R3 closed) |
| Expense not marked before the invoice | `expense_to_invoice` returned `"marked_rebilled": false, "vat_unknown_lines": 0`; the flag was set only by the later `expense_mark_rebilled {invoice_number:"INV-2026-0001"}` -> `{"marked":1,"rebilled_at":"...14:50:44Z"}` | PASS (D-R4 closed) |
| The link between flag and invoice persists | store holds `"rebilled_at":"2026-09-02T14:50:44.094Z","rebilled_invoice":"INV-2026-0001"` | PASS |
| The PDF is a PDF | `head -c 8 data/mcp-servers/invoice/pdf/INV-2026-0001.pdf` -> `%PDF-1.3`, 2495 bytes, contains `(Lucky Strike Software)` after a5 | PASS |
| `tax_rate` alias lands | fresh data dir probe: `business_set {name, tax_rate: 23}` -> profile shows `"default_tax_rate": 23` and the echo line **`Read tax_rate: 23 as default_tax_rate: 23.`**; the following `invoice_create` with no per-item rate -> **EUR 338.25** | PASS (D-R7 closed) |
| Hosted download content type | `curl -sI https://mcp.zovo.one/mcp/download/939925972c580b255e5a1f5c24724adf` -> HTTP 200, `content-type: text/html; charset=utf-8`, `content-disposition: inline; filename="INV-2026-0001.pdf"` | still HTML, see D-R8 |

Note on the alias: the model in a5 wrote `default_tax_rate: 23` on its own and never exercised the
alias, so the alias was verified by direct probe rather than in flow. Both paths reach EUR 338.25.

## D-R5 remeasured: is the first hosted prompt still lost?

Three fresh temp projects (`/private/tmp/uv7/t1..t3`), each: `rm -rf` the dir, `claude mcp add
--transport http --scope local tt https://mcp.zovo.one/mcp/time-tracker --header "Authorization:
Bearer <key>"`, then immediately `claude -p "Start a timer for Remote Co trial N"`, then `claude mcp
remove tt --scope local`.

| Trial | `system/init` mcp_servers | `mcp__` tools at init | Tool calls | Sec | Outcome |
|---|---|---|---|---|---|
| 1 | `tt: pending` | 0 | **none** | 8.9 | **FAIL** — no `ToolSearch`, no `timer_start`; the model answered by asking about "duration" and "scheduled reminder". |
| 2 | `tt: pending` | 0 | `ToolSearch`, `timer_start` | 16.9 | PASS — "Timer started for Remote Co trial 2 at 14:50:39 UTC." |
| 3 | `tt: pending` | 0 | `ToolSearch`, `timer_start`, `timer_start`, `entry_delete` | 36.7 | PASS with noise — auto-stopped trial 2's timer, then cleaned up. |
| 4 (workaround) | `tt: pending` | 0 | `ToolSearch`, `timer_start` | 12.3 | PASS — `claude mcp list` first printed `tt: https://mcp.zovo.one/mcp/time-tracker (HTTP) - Connected`. |

**The round-3 diagnosis was wrong in its mechanism.** `status: pending` and `0 mcp__ tools` in the
init line is now the *normal* state for an HTTP server in this client: the tools are deferred and the
model reaches them through its own `ToolSearch`. All four trials showed `pending`; three of four
worked anyway. The real failure is that a run sometimes does not issue the `ToolSearch` at all, and
then answers as if no server existed. So it is not a hosted cold start — it is a tool-discovery miss
in the client, and the hosted latency numbers support that:

| Probe | n | Result |
|---|---|---|
| `GET /mcp/time-tracker`, no auth | 3 | HTTP 401 in 0.949 / 0.706 / 0.396 s |
| `GET /mcp/time-tracker`, `Authorization: Bearer <key>` | 3 | HTTP 406 in 1.680 / 1.189 / 1.041 s (406 is correct: the GET/SSE path wants an `Accept` this probe does not send) |
| `POST /mcp/time-tracker` `initialize` | 3 | HTTP 200 in 1.049 / 1.151 / 1.121 s, correct `serverInfo {"name":"time-tracker","version":"0.1.0"}` |

Nothing here is a cold start: the very first `initialize` answered in 1.05 s, and the three runs are
within 0.1 s of each other. **Documented workaround:** run `claude mcp list` once after
`claude mcp add` and before the first prompt. It forces the health check (`Checking MCP server
health... tt: ... - Connected`) and the following run used the tool (1/1). It is a one-trial result,
not proof, and the honest framing is that it costs two seconds and cannot hurt.

## Defects still open

**D-R5 (medium, downgraded from high; client/hosted) — one first run in three answers with no tools.**
Repro: `rm -rf /tmp/x && mkdir /tmp/x && cd /tmp/x && claude mcp add --transport http --scope local tt
https://mcp.zovo.one/mcp/time-tracker --header "Authorization: Bearer <key>" && claude -p "Start a
timer for Remote Co" --model sonnet --output-format stream-json --verbose --allowedTools
"$(cat allow_tt.txt)"`. Trial 1 of 3 produced zero tool calls in 8.9 s. Transcript
`/private/tmp/uv7/t1/run.jsonl`. Workaround above. Fix direction: the hosted side cannot fix this —
`initialize` is 1.05 s and correct. Either the client should not report `pending` for a server it has
not tried yet, or the server list should be resolved before the first turn.

**D-R9 (medium, price-tracker; D-4 reopened) — `price_check` is now skipped entirely.**
Round 3 scored pt1 a 2 because `WebFetch` ran first and `price_check` second, with the server's answer
being the one reported. Round 4, same prompt, same `/private/tmp/uv2/mcp.json`, same allowlist: the
model called `WebFetch` once, answered GBP 51.77 from the HTML, and never touched the server. The
price is right and the watch list, the history and the confidence flag are all unused. Repro:
`claude -p "What does this cost right now: https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
--mcp-config /private/tmp/uv2/mcp.json --strict-mcp-config --model sonnet --allowedTools
"$(cat /private/tmp/uv2/allow_r3.txt),WebFetch"` -> `out/r4_pt1b.jsonl`, `CALLS(1): WebFetch`.
Fix direction: `price_check`'s description has to claim the URL case explicitly ("use this instead of
fetching the page: it stores the point for history and alerts"), because on capability alone a
generic fetcher wins.

**D-R10 (low, harness, new) — without `WebFetch` in the allowlist, pt1 dies rather than falling back.**
The first pt1 run used exactly round 3's allowlist (`allow_r3.txt`, MCP tools only). `WebFetch` was
attempted, denied, and the turn ended `"you'll need to approve the WebFetch tool ... Want to grant
it?"` with `price_check` sitting right there unused. 11.9 s, `out/r4_pt1.jsonl`. In round 3 the same
allowlist let `WebFetch` through, so the client's permission behaviour changed under us; the scored
pt1 above is the re-run with `WebFetch` appended, which reproduces round 3's conditions. Recorded so
the round-3/round-4 pt1 comparison is not read as a code change.

**D-R8 (low, hosted) — the download still serves `text/html` under a `.pdf` filename.**
`content-type: text/html; charset=utf-8` with `content-disposition: inline; filename="INV-2026-0001.pdf"`.
The tool text is now honest ("HTML invoice, print to PDF, valid 1 hour") and the model repeated it, so
the user is no longer misled in conversation — but a browser save still writes HTML into a `.pdf`
name. The same response also still ends with `No business profile yet: the PDF shows a placeholder
issuer`, saying PDF about the artifact it just called HTML. Repro:
`curl -sI https://mcp.zovo.one/mcp/download/<hash>`. Fix direction: set the disposition filename to
`.html` on the HTML path, and reuse `documentLabel()` in the business-profile note.

**D-E1 (low, expense-tracker, disclosed) — s1 unchanged.**
`expense_add` with no rate named stores net = gross and says so. Still a 2, still by design.

**D-R1 (medium, time-tracker) — not exercised this round.** a3 reached the invoice through
`entry_list` rather than `invoice_summary`, so the blended-rate path never ran in flow. The fix and
its test (`servers/time-tracker/test/smoke.test.mjs:202`) stand unverified end to end here.

Closed this round: **D-R2, D-R3, D-R4, D-R6 (wording), D-R7** — each confirmed by store or wire, not
by prose.

## Delta vs round 3

| Scenario | R3 | R4 | Change | Why |
|---|---|---|---|---|
| a1 | 3 | 3 | 0 | unchanged. |
| a2 | 3 | 3 | 0 | unchanged. |
| a3 | 0 | 3 | **+3** | The invoice is created with a placeholder issuer instead of erroring (D-R2). The model split the receipt with `expense_update {vat_rate:23}` before rebilling, so the line went in at EUR 50.00 net (D-R3). `expense_to_invoice` reported `marked_rebilled: false` and the model called `expense_mark_rebilled` after `invoice_create` (D-R4). Total EUR 338.25, PDF written. |
| a4 | 2 | 3 | +1 | Nothing to self-correct: the ledger a3 left behind is consistent, so the answer is one clean paragraph. |
| b3 | 1 | 3 | +2 | `invoice_from_hours` no longer refuses without a business profile; USD 300.00 and a link in one turn, and the link is described as HTML. |
| b1 first-run | 0 | 2 | +2 | 2 of 3 fresh first runs now work unaided, 3 of 3 with the `claude mcp list` warm-up. |
| pt1 | 2 | 1 | **-1** | `price_check` dropped out of the turn entirely (D-R9). |
| s1 | 2 | 2 | 0 | unchanged by design. |
| **total** | **13/24** | **20/24** | **+7** | |

## Bottom line

The chain that round 3 called "a workflow failure made of four correct servers" now runs end to end in
one turn. a3 is the whole round: six calls, three child servers, a gross receipt split before it was
rebilled, a rebilled flag set only after the invoice existed and carrying the invoice number, and
EUR 338.25 on a real `%PDF-1.3` file — with the missing business profile downgraded from a wall to a
line of advice the model passed straight to the user. Every one of the four handoff defects is closed
against the store, not against the model's summary of the store.

What is left is smaller and lives outside the bundle. The hosted first-connection loss is real but is
not what round 3 said it was: `initialize` answers in 1.05 s and every trial reported `pending`,
including the three that worked, so the miss is tool discovery in the client and a `claude mcp list`
buys it back. And one regression moved the other way: with a general-purpose fetcher available, the
price server was not merely called second, it was not called at all. That is the one place in this
repo where a server has to argue for itself in its own description, and it currently does not.

## RESULT.md

```
status: DONE
evidence:
  8 round-3 sub-3 scenarios re-run, claude CLI as MCP client, sonnet, fresh XDG dirs, per-tool allowlist
  bundle (/private/tmp/uv6, office-suite as one server "office", 5 children, 49 tools, one conversation, 51-entry allowlist)
    a1 3/3 1 call 7.7s | a2 3/3 3 calls 14.6s | a3 0->3 6 calls 53.2s | a4 2->3 3 calls 27.3s | a5 extra 3/3 2 calls 13.3s
    a3 produced INV-2026-0001 subtotal EUR 275.00, 23% = EUR 63.25, total EUR 338.25, %PDF-1.3 2495 bytes
    expense split verified in store: amount_minor 6150, vat_rate 23, line unit_price 50 tax_rate 23
    expense_to_invoice marked_rebilled:false; flag set later with rebilled_invoice "INV-2026-0001"
  remote (mcp.zovo.one, GET /mcp/token was HTTP 429 rate_limited, used a locally signed Pro key id a74b2e0eff7f)
    b3 1->3 2 calls 25.0s, USD 300.00, link relayed as "HTML, print-to-PDF"
    download HTTP 200 content-type text/html, content-disposition filename="INV-2026-0001.pdf"
    b1 first-run 0->2: 3 fresh temp projects, trial 1 FAILED (0 tool calls, 8.9s), trials 2 and 3 passed
    all 4 trials showed status "pending" and 0 mcp__ tools at init, including the 3 that worked
    latency: GET 401 0.949/0.706/0.396s, GET+auth 406 1.680/1.189/1.041s, POST initialize 200 1.049/1.151/1.121s
    workaround: `claude mcp list` before the first prompt reports Connected; the following run used the tool (1/1)
  stdio
    pt1 2->1 1 call 10.6s WebFetch only, price_check never called
    s1 2->2 1 call 13.1s unchanged
  tax_rate alias verified by direct probe: business_set {tax_rate:23} -> default_tax_rate 23,
    echo "Read tax_rate: 23 as default_tax_rate: 23.", invoice_create -> EUR 338.25
artifacts:
  docs/USER_VALUE_R4.md
  data/user_value_r4.json
  /private/tmp/uv6/out/a1..a5.jsonl, /private/tmp/uv6/probe_alias.mjs, /private/tmp/uv6/data (stores)
  /private/tmp/uv7/t1..t4/{run.jsonl,list.log} (D-R5 trials)
  /private/tmp/uv9/b3.jsonl
  /private/tmp/uv2/out/r4_pt1.jsonl, /private/tmp/uv2/out/r4_pt1b.jsonl, /private/tmp/uv8/out/s1.jsonl
closed:
  D-R2 invoice issues with a placeholder issuer + hint line (bundle a3 and remote b3)
  D-R3 expense line rebilled net EUR 50.00, tax_rate 23
  D-R4 marked_rebilled false until expense_mark_rebilled, and it stores rebilled_invoice
  D-R6 hosted tool text calls the link an HTML invoice; local invoice_pdf writes real PDF bytes
  D-R7 business_set reads tax_rate as default_tax_rate and says so
failures:
  D-R5  med  client/hosted: 1 of 3 fresh first runs answers with 0 tool calls; `claude mcp list` first is the workaround
  D-R9  med  price-tracker: price_check skipped entirely, WebFetch answers the URL question alone
  D-R8  low  hosted: download serves text/html under filename="INV-2026-0001.pdf"; note still says "the PDF"
  D-R10 low  harness: with round 3's exact allowlist, WebFetch is denied and pt1 ends asking for permission
  D-R1  med  time-tracker: fix not exercised, a3 used entry_list not invoice_summary
  D-E1  low  expense-tracker: net = gross when no VAT rate is named (disclosed, by design)
insight:
  Round 3 read a3's failure as four defects; it was one shape. Each fix removed a place where a
  server made a decision the caller should have made: erroring instead of issuing with a placeholder,
  emitting a number without saying whether it was net, writing a flag before the transaction it
  refers to existed, and dropping a key it did not recognise. The model then assembled the whole
  chain unaided, including a retroactive VAT split nobody asked it for. The one regression points
  the same way from the other side: price_check lost the turn to WebFetch not on capability but on
  description, which is the only argument a tool gets to make.
```
