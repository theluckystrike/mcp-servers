# User value audit, round 21 (deposits, hosted) - 2026-09-05

Round 21 is a single-lane hosted re-run of round 20's six deposits prompts (data/user_value_r20.json),
which measured the server for the first time over stdio and scored 16/18. This round asks the same six
questions against the hosted endpoint, `https://mcp.zovo.one/mcp/deposits/t/<token>`, with `invoice`
registered alongside it on the same token per docs/REMOTE_RESULT.md Extension 12 (deposits shares the
invoice store read-write, and here the write is the ordinary path: `deposit_apply` records the payment on
an invoice `/mcp/invoice` holds for the same token). No code was changed as part of this round; it is
measurement only.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -m 15 -> 200 `text/html`, minting
  `anon_d74d381a27c25d98d4500524d6176b7a`. One token, reused for the whole lane.
- **Registration.** One `mcp.json`, two `http` entries, both `https://mcp.zovo.one/mcp/<server>/t/<token>`,
  no `--header` anywhere: `deposits` (the lane under test) and `invoice` (registered for the shared business
  profile, the seed invoices, and because `deposit_apply` writes through to it).
- **Seed.** Four curl `tools/call`s on `/mcp/invoice` under the token before any prompt ran: `business_set`
  (Nova Studio, `Europe/Warsaw`, EUR, 23 percent), `client_add` (Acme Ltd, Dublin, IE9876543Q),
  `invoice_create` INV-2026-0001 (one line, Consulting services, 1 x EUR 1000.00 at the 23 percent business
  default, total EUR 1230.00) and `invoice_create` INV-2026-0002 (one line, Services, 1 x USD 400.00 at 0
  percent, total USD 400.00). A fifth call, `invoice_mark_paid` on INV-2026-0001 (amount 200, paid_date
  2026-09-03, method bank transfer), left it partial at EUR 200.00 paid / EUR 1030.00 due before any deposit
  prompt ran -- the same shape round 20's stdio seed used, so applying a deposit on top of it is the exact
  case where a naive write would overwrite rather than add. `invoice_list` confirmed the seed before d1 ran.
- **Allowlist.** 22 explicit `mcp__deposits__<tool>` and `mcp__invoice__<tool>` entries read from a live
  `tools/list` of each endpoint (deposits 10, invoice 12) -- no `mcp__*` wildcard.
- **Client.** `claude` CLI 2.1.261, `-p`, `--model sonnet`, `--strict-mcp-config`, `--mcp-config` pointing at
  the two-entry file above, `--output-format stream-json --verbose --max-turns 12`, one `--session-id` then
  five `--resume` so all six prompts are one conversation, one bounded request per prompt under
  `timeout 240`, each of the six issued as its own isolated shell invocation and its transcript read back
  before the next prompt ran.
- **Empty working directory, disallowed CLI tools.** Every turn ran in an empty
  `/private/tmp/uv-r21dep/wd`, with `Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, NotebookEdit,
  Task, TodoWrite, Agent` denied, so nothing could shell out or touch a local file. Fresh `XDG_DATA_HOME` /
  `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` / `XDG_STATE_HOME` under `/private/tmp/uv-r21dep/xdg` in the server
  environment block only -- `CLAUDE_CONFIG_DIR` was never touched. The servers are hosted, so this only
  guards the CLI's own local footprint, not the store, which lives entirely in the worker's KV under the
  token. `npm_config_cache=/Users/mike/.npm-cache-local` and `PATH` prefixed with `$HOME/.npm-global/bin`
  for every call.
- **Verification.** After the six prompts, `deposit_list`, `deposit_balance` and `invoice_list` were read
  back on the same token by direct curl, and the `deposit_statement_text` download link was fetched and
  diffed against the model's relayed text, byte for byte. Host machine day 2026-09-05 (Saturday).

## Scorecard - 16 / 18 (round 20, stdio: 16 / 18)

| # | Prompt | R20 (stdio) | R21 (hosted) | Calls | Sec | What happened |
|---|---|---|---|---|---|---|
| d1 | "Acme Ltd wired us a 500 euro security deposit today, reference SEPA 88213. Please record it." | 3 | **3** | 1 | 9.6 | One `deposit_record` produced DEP-2026-0001 on the first turn. 500 euro converted to 50000 minor units and `kind: security` inferred, nothing asked. The raw result shows `client_record` filled from the invoice server's client list (Dublin, IE9876543Q) though the prompt named only the company, and the free-tier counter (1 of 5) was stated |
| d2 | "Apply 300 euro of that deposit against invoice INV-2026-0001." | 3 | **3** | 1 | 10.3 | One `deposit_apply {amount_minor: 30000}`. The invoice already carried the seeded EUR 200.00 transfer; reply said paid EUR 500.00 of EUR 1230.00, balance due EUR 730.00, partial -- `invoice_list` on `/mcp/invoice` agrees exactly. The write added to `paid_minor` rather than assigning it |
| d3 | "Now apply another 400 euro of the same deposit to that invoice." | 2 | **2** | 0 | 6.0 | The model refused the over-application itself without calling `deposit_apply`, same client-side shape as round 20. The arithmetic was right (EUR 200.00 left, offered instead), but the server's own refusal text never reached the user |
| d4 | "Can we use what's left of Acme's deposit against INV-2026-0002?" | 3 | **3** | 1 | 6.5 | The model tried the call. `deposit_apply` refused: EUR deposit against a USD invoice, "never converted here," offering refund-and-re-record-in-USD or a USD deposit. Both ways out relayed verbatim, unlike d3 |
| d5 | "How much of Acme's money are we still holding, and since when?" | 2 | **2** | 0 | 3.4 | Right answer (EUR 200.00, received 2026-09-05) but from the session's own running total, not a `deposit_balance` call -- same client-side gap as round 20's D-R88 |
| d6 | "Refund what's left to them by bank transfer, and send me the statement text I can email over." | 3 | **3** | 2 | 15.9 | `deposit_refund {method: bank transfer}` (no amount, refunded the full EUR 200.00 held) then `deposit_statement_text {client: Acme Ltd}` returned the three movements plus a one-hour download link. The downloaded `.txt` (720 bytes) is byte-identical to what the model pasted |

**Totals: 16/18, 5 tool calls, 51.7 s. Round 20 (stdio) was 16/18, tool-call and timing details reported per
scenario there (d1-d6: 1,1,0,1,0,2 calls).**

## Independent verification

Every number below was re-read from the endpoint by `curl tools/call` or decoded from the downloaded bytes
on the same token, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| The store holds exactly the movements the run created, and the invoice-side write landed | `deposit_list`: 1 deposit, received EUR 500.00, applied EUR 300.00, refunded EUR 200.00, held EUR 0.00; `deposit_balance {client: Acme Ltd}` agrees; `invoice_list` on `/mcp/invoice`: INV-2026-0001 partial, paid EUR 500.00, balance_due EUR 730.00; INV-2026-0002 unchanged, unpaid, USD 400.00 | PASS |
| `deposit_apply` ADDS to `paid_minor` rather than setting it | seeded invoice carried paid EUR 200.00 before d1; after d2's EUR 300.00 application, `invoice_list` reads paid EUR 500.00 (200 + 300), not EUR 300.00 | PASS |
| A deposit is never converted across currencies | d4's raw tool result is `isError: true` naming both currencies and both ways out; `deposit_list` immediately after still shows held EUR 200.00, unchanged | PASS |
| Downloaded statement text matches the model's reply, byte for byte | `GET https://mcp.zovo.one/mcp/download/e4fcf3b908aa284b04cc01c52ebe5f96` -> HTTP 200, `text/plain`, `filename="deposits-Acme-Ltd-EUR.txt"`, content-length 720, body opens "Hello Acme Ltd," ends "Best regards, Nova Studio" with the same three movement lines and HELD EUR 0.00 the model's turn 6 answer gave | PASS |
| The free-tier counter is stated on the write | `deposit_record` reply carried "Free tier: 1 of 5 deposits recorded in 2026-09. deposit_statement_pdf and deposits_report are Pro." | PASS |

## Defect

**D-R88 reproduces hosted, unchanged.** Round 20 found the model answering "how much are we holding" (d5)
from its own running total instead of calling `deposit_balance`, and refusing an over-application itself
(d3) instead of letting `deposit_apply` refuse it. Both reproduce hosted with the same severity: the
arithmetic was right both times because the session had just computed it in the same conversation, and
`deposit_balance` / `deposit_apply` are both free, hosted, and would have answered exactly. The fix
direction is unchanged and is on the client side of the boundary, not the server. Not filed as a new
defect number; this is D-R88, measured on the hosted path, no change in shape or severity.

## Bottom line

16 of 18 hosted, identical to round 20's 16 of 18 over stdio on the same six prompts, now reached through
`https://mcp.zovo.one/mcp/deposits/t/<token>` with `/mcp/invoice/t/<token>` registered alongside it per
REMOTE_RESULT.md Extension 12. d1, d2, d4 and d6 are clean 3s with every number verified against
`deposit_list`, `deposit_balance`, `invoice_list` and the downloaded statement bytes on the same token; d3
and d5 are the same 2s as round 20, both from the model reasoning ahead of a free, allowed tool instead of
calling it, and both times happening to be right. The invoice-side write `deposit_apply` depends on landed
correctly on the hosted invoice store (`paid_minor` added, not overwritten), the currency refusal was
relayed verbatim, the refund left the invoice untouched, and the downloaded `.txt` statement is
byte-identical to what the model pasted into its reply. Moving the lane onto the wire changed nothing about
where the two open points are lost.
