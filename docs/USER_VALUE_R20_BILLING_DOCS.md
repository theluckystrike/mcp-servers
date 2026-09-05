# User value audit, round 20 (billing-docs, hosted) - 2026-09-05

Round 20 is a single-lane hosted re-run of round 19's six billing-docs prompts (data/user_value_r19.json),
which measured the server for the first time over stdio and scored 16/18. This round asks the same six
questions against the hosted endpoint, `https://mcp.zovo.one/mcp/billing-docs/t/<token>`, with `invoice`
registered alongside it on the same token per docs/REMOTE_RESULT.md Extension 11, to see whether the one
open defect (D-R86: an over-credit refused client-side with a fabricated total) survives the trip over the
wire. No code was changed or fixed as part of this round; it is measurement only.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, minting
  `anon_4b628badb99564cd87d73d1c7d315cb7`. One token, reused for the whole lane.
- **Registration.** One `mcp.json`, two `http` entries, both `https://mcp.zovo.one/mcp/<server>/t/<token>`,
  no `--header` anywhere: `billing-docs` (the lane under test) and `invoice` (registered only for lookup and
  to seed the shared business profile a credit note is meaningless without).
- **Seed.** Four curl `tools/call`s on `/mcp/invoice` under the token before any prompt ran: `business_set`
  (Nova Studio, `Europe/Warsaw`, EUR, 23 percent), `client_add` (Acme Ltd, Dublin, IE9876543Q), and two
  `invoice_create`s reproducing round 19's exact seed -- INV-2026-0001, a mixed-VAT invoice (EUR 1,000.00
  consulting at 23 percent plus EUR 500.00 print at 8 percent, total EUR 1,770.00), and INV-2026-0002, a
  plain single-rate invoice (EUR 400.00 at 23 percent, total EUR 492.00).
- **Allowlist.** 26 explicit `mcp__billing-docs__<tool>` and `mcp__invoice__<tool>` entries read from a live
  `tools/list` of each endpoint (billing-docs 14, invoice 12) -- no `mcp__*` wildcard.
- **Client.** `claude` CLI 2.1.261, `-p`, `--model sonnet`, `--strict-mcp-config`, `--mcp-config` pointing at
  the two-entry file above, `--output-format stream-json --verbose --max-turns 12`, one `--session-id` then
  five `--resume` so all six prompts are one conversation, one bounded request per prompt under
  `timeout 240`.
- **One shell call per prompt.** An earlier attempt at this round ran all six prompts through a bash loop
  reusing `--resume`; the loop's first turn came back having executed every one of the six prompts' tool
  calls in a single response (visible in its own transcript as "I'll work through these one at a time"),
  which cannot be a legitimate reply to a single-sentence first prompt on a brand-new session. Root cause
  traced to a scripting fault in the loop upstream of the CLI (a failed `mapfile` call on a shell that does
  not support it, on the attempt immediately before), not a server or model defect. That run was discarded
  in full -- a fresh token, fresh seed, fresh session id -- and redone with each of the six prompts issued as
  its own isolated shell invocation, each transcript read back before the next prompt ran, to guarantee one
  prompt in meant one prompt's worth of tool calls out. The scored numbers below are from that clean redo.
- **Empty working directory, disallowed CLI tools.** Per r11 D-R57, every turn ran in an empty
  `/private/tmp/uv-r20bd2/wd`, with `Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, NotebookEdit,
  Task, TodoWrite, Agent` denied, so nothing could shell out or touch a local file. Fresh
  `XDG_DATA_HOME` / `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` / `XDG_STATE_HOME` under `/private/tmp/uv-r20bd2`
  in the shell environment the CLI ran in -- `CLAUDE_CONFIG_DIR` was never touched. The servers themselves
  are hosted, so this only guards the CLI's own local footprint, not the store, which lives entirely in the
  worker's KV under the token.
- **Verification.** After the six prompts, `credit_note_list`, `purchase_order_list` and `invoice_list` were
  read back on the same token by direct curl, and the credit note and purchase order text downloads were
  fetched and diffed against the model's relayed numbers, byte for byte. Two unscored direct JSON-RPC probes
  (the over-credit call, and `billing_docs_report` on free) checked server behaviour the model chose not to
  reach. Host machine day 2026-09-05 (Saturday).

## Scorecard - 17 / 18 (round 19, stdio: 16 / 18)

| # | Prompt | R19 (stdio) | R20 (hosted) | Calls | Sec | What happened |
|---|---|---|---|---|---|---|
| b1 | "Acme cancelled the whole of invoice INV-2026-0002 after we had already billed it. Please credit that invoice in full." | 3 | **3** | 3 | 13.8 | `invoice_get` then `credit_note_list` then one `credit_note_create` produced CN-2026-0001 for the full EUR 492.00 on the first turn. The model volunteered that the invoice record itself keeps no credited flag, the same fact round 19 surfaced |
| b2 | "Different invoice: we are refunding Acme EUR 177.00 of INV-2026-0001 as a goodwill gesture. Raise a credit note for that amount." | 3 | **3** | 3 | 10.8 | One `credit_note_create {amount_minor: 17700}` split proportionally across both VAT rates the invoice used: EUR 50.00 net + EUR 4.00 VAT at 8%, EUR 100.00 net + EUR 23.00 VAT at 23%, summing to exactly EUR 177.00. Same split round 19 measured |
| b3 | "Acme now want another EUR 1,700 credited on INV-2026-0001 on top of that. Do it." | 1 | **2** | 0 | 4.6 | The model again refused the over-credit itself rather than letting the tool refuse it -- **D-R86's shape survives hosted** -- but this time the arithmetic is right: EUR 1,593.00 still creditable, EUR 1,700.00 is EUR 107.00 over, no fabricated running total. It ended by asking the user to choose an amount rather than reporting a flat refusal, which is why this scores 2 and not 3 |
| b4 | "Raise a purchase order to Paperworks Sp. z o.o. for 500 brochures at EUR 1.20 each and 200 posters at EUR 3.50 each, 23% VAT, expected here on 2026-09-20." | 3 | **3** | 1 | 10.4 | One `purchase_order_create` produced PO-2026-0001, EUR 1,599.00 total, buyer block filled from the shared profile unasked, supplier flagged as unstored |
| b5 | "Only the brochures turned up today, the posters are still coming. Record that on the order." | 3 | **3** | 1 | 8.8 | One `purchase_order_receive {partial: true}` moved the order to `partially_received`, resolving "the order" from context without asking |
| b6 | "Which of my purchase orders are past their delivery date?" | 3 | **3** | 1 | 6.7 | One `purchase_order_list` answered the Pro-shaped question for free: nothing overdue against 2026-09-20. No upgrade text shown |

**Totals: 17/18, 9 tool calls, 55.1 s. Round 19 (stdio) was 16/18, 9 tool calls, 57.8 s.**

## Independent verification

Every number below was re-read from the endpoint by `curl tools/call` or decoded from the downloaded bytes
on the same token, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| The store holds exactly what the run created | `credit_note_list`: count 2, CN-2026-0002 EUR -177.00 / CN-2026-0001 EUR -492.00, credited EUR -669.00; `purchase_order_list {status: all}`: count 1, PO-2026-0001, `partially_received`, EUR 1,599.00; `invoice_list`: both seeded invoices unchanged, still `unpaid` | PASS |
| Mixed-VAT credit splits across both rates | credit note lines EUR -50.00 at 8% and EUR -100.00 at 23%, VAT EUR -4.00 and EUR -23.00, sum EUR -177.00 exactly | PASS |
| Downloaded credit note text matches the reply, byte for byte | `credit_note_text` -> download link -> GET 200, `text/plain`, `filename="CN-2026-0002.txt"`, 713 bytes, same EUR -50.00/-100.00/-4.00/-23.00/-177.00 figures | PASS |
| Downloaded purchase order text matches the reply, byte for byte | `purchase_order_text` -> download link -> GET 200, `text/plain`, `filename="PO-2026-0001.txt"`, 498 bytes, same EUR 600.00/700.00/1300.00/299.00/1599.00 figures | PASS |
| The server's own over-credit refusal matches the model's unaided arithmetic | unscored probe `credit_note_create {amount_minor: 170000}`: isError, "EUR 1770.00 ... EUR 177.00 already credited ... at most EUR 1593.00 can still be credited ... Nothing was stored" -- same numbers the model gave the user without calling the tool | PASS, but b3 never reaches it |
| `billing_docs_report` is Pro and refuses on free, hosted | unscored probe: isError, names the $19/$39 upgrade with a buy link that carries the anonymous token | PASS |
| No filesystem path leaked into any reply | only path-shaped strings across all six transcripts are the two `mcp.zovo.one/mcp/download/<token>` URLs the tools returned themselves | PASS |

## Defect

**D-R86 reproduces hosted, but lighter.** Round 19 found the model refusing an over-credit itself, with a
number no tool produced (EUR 3,400.00 instead of the true EUR 1,877.00 running total). Hosted, the same
client-side pattern appears -- b3 ran zero tool calls -- but the arithmetic this time is correct, matching
the server's own refusal text word for number. The residual gap is unchanged in kind: "do it" got a
clarifying question back instead of either a completed action or the server's authoritative refusal, so the
fix direction from round 19 stands -- let the write attempt fail and relay its text rather than reasoning
ahead of the tool. This is not filed as a new defect number; it is D-R86, measured lighter on the hosted
path.

## Bottom line

17 of 18 hosted, one point up from round 19's 16 of 18 over stdio, on the identical six prompts. Full
credit, proportional mixed-VAT credit, purchase order raise, partial receipt and the free-tier overdue-check
all reproduce as clean 3s with numbers verified against `credit_note_list`, `purchase_order_list`,
`invoice_list` and the downloaded `.txt` bytes on the same token. The one point still missing is b3, where
D-R86's shape (the model pre-empting the server's refusal) survives the move to hosted transport, but its
severity does not: the fabricated total from round 19 is gone, and a direct probe of the identical call on
this token confirms the server would have handed back the exact right numbers if the model had let it try.
