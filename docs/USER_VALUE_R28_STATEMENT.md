# User value audit, round 28 (statement-of-account, hosted) - 2026-09-06

Round 28 is a single-lane hosted re-run of round 26's six statement-of-account prompts
(`data/user_value_r26.json`), which measured the server for the first time over stdio and
scored 18/18. This round asks the identical six questions against
`https://mcp.zovo.one/mcp/statement-of-account/t/<token>` per `docs/REMOTE_RESULT.md`
Extension 15, which hydrates the invoice, billing-docs and deposits stores read-only into the
worker from the same token. No code was changed as part of this round; it is measurement
only. Cap: 30 minutes, met.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect -m 15` -> 200 `text/html`, minting
  `anon_0adfaba088693af532ac2c92dde50175`. One token, reused for the whole lane.
- **Registration.** One `mcp.json`, four `http` entries, all
  `https://mcp.zovo.one/mcp/<server>/t/<token>`, no `--header` anywhere: `statement-of-account`
  (the lane under test), `invoice`, `billing-docs` and `deposits` (registered so the fixture
  could be seeded live and the closing balance independently re-derived afterwards).
- **Profile.** `business_set` on `/mcp/invoice` before any prompt ran: Nova Studio,
  `Europe/Warsaw`, EUR, IBAN `PL61109010140000071219812874`, per this task's recipe.
- **Seed.** The hosted lane has no disk to write to directly the way round 26's stdio run
  seeded `invoices.json` etc. byte for byte, so the worked-month fixture from
  `servers/statement-of-account/test/_client.mjs` was reproduced live, by calling the real
  tools over curl before any CLI prompt ran: `client_add` x2 (Acme Ltd with address/email,
  Beta GmbH), `invoice_create` x4 by `issue_date`/`due_days` (INV-2026-0001 EUR 1000 issued
  2026-04-10 due 30d, INV-2026-0002 EUR 2000 issued 2026-06-05 due 30d, INV-2026-0003 EUR 750
  issued 2026-06-20 due 5d, INV-2026-0004 Beta GmbH EUR 500 issued 2026-06-01 due 14d),
  `invoice_mark_paid` x2 on INV-2026-0001 (400.00 on 2026-05-02, 600.00 on 2026-06-12),
  `credit_note_create` x2 (100.00 against INV-2026-0001 issued 2026-05-20, 50.00 against
  INV-2026-0003 issued 2026-06-28), `deposit_record` (500.00 retainer received 2026-03-01) and
  `deposit_apply` (300.00 onto INV-2026-0002 on 2026-06-18). The live server assigned exactly
  the fixture's own invoice numbers, due dates and balances, and a direct `statement_build`
  call afterward returned `closing_balance_minor 230000`, matching the README worked example
  and round 26's stdio figure to the cent before any CLI prompt ran.
- **Allowlist.** 44 explicit `mcp__<server>__<tool>` entries read from a live `tools/list` of
  all four endpoints (statement-of-account 8, invoice 12, billing-docs 14, deposits 10) -- no
  `mcp__*` wildcard.
- **Client.** `claude` CLI 2.1.261, `-p`, `--model sonnet`, `--strict-mcp-config`,
  `--mcp-config` pointing at the four-entry file above, `--output-format stream-json --verbose
  --max-turns 12` (20 for prompt 5), one `--session-id` then five `--resume` so all six
  prompts are one conversation, one bounded request per prompt under `timeout 240`, each of
  the six issued as its own isolated shell invocation and its transcript read back before the
  next prompt ran.
- **Empty working directory, disallowed CLI tools.** Every turn ran in an empty
  `/private/tmp/uv-r28soa/wd`, with `Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch,
  NotebookEdit, Task, TodoWrite, Agent` denied. Fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` /
  `XDG_CACHE_HOME` / `XDG_STATE_HOME` under `/private/tmp/uv-r28soa/xdg` for every `claude`
  invocation, guarding only the CLI's own local footprint since all four servers are hosted
  and hold no local store at all. `npm_config_cache=/Users/mike/.npm-cache-local` and `PATH`
  prefixed with `$HOME/.npm-global/bin` for every call.
- **Verification.** After the six prompts, `invoice_list`, `credit_note_list` and
  `deposit_list` were re-read directly by curl on the same token to recompute the closing
  balance and aging totals from the ledgers, `statement_aging` was re-run for the same as-of
  dates, `statement_build` for May 2026 was re-issued to confirm the register still holds 5
  statements for 2026-09, and the level 1 dunning letter's one-hour download link was fetched
  and diffed byte-for-byte against the transcript. Host machine day 2026-09-06 (Sunday), one
  day after round 26's stdio run (2026-09-05), which is why every aging figure in this round
  is one day further overdue than round 26's.

## Scorecard - 18 / 18 (round 26, stdio: 18 / 18)

| # | Prompt | R26 (stdio) | R28 (hosted) | Calls | Sec | What happened |
|---|---|---|---|---|---|---|
| p1 | Read `statement://sources`, build Acme Ltd's June 2026 statement, report opening/movements/closing | 3 | **3** | 1 | 24.1 | One `statement_build` call: opening 500.00, invoiced 2,750.00, paid 900.00 (300.00 a deposit application), credited 50.00, closing 2,300.00, five movements in order. Matches round 26 to the cent. The model read the real profile name (Nova Studio) off the resource rather than the prompt's own "Studio One" -- correct behaviour, not a defect |
| p2 | Aging as at today, every client, all currencies | 3 | **3** | 1 | 12.0 | Acme Ltd 2,400.00 overdue (63/73 days, one day later than round 26 since the host day advanced) plus 100.00 unapplied credit; Beta GmbH 500.00 overdue at 83 days. Totalled 2,900.00, correctly named empty buckets |
| p3 | Aging as at 2026-06-10 for Acme Ltd, respecting the two-instalment payment | 3 | **3** | 1 | 12.8 | Outstanding 2,500.00, overdue 500.00 at 31 days -- the server's headline insight, reproduced exactly, matching the README worked example and round 26 to the cent |
| p4 | Level 1 dunning letter, then try level 3, explain the free tier | 3 | **3** | 2 | 15.7 | Level 1 letter relayed verbatim with the IBAN and the no-invented-fee footer; level 3 errored with the Pro price ($19/$39) and both buy URLs, relayed without softening or reconstruction |
| p5 | Build 4 more distinct statements, try a 6th (blocked), rebuild the 1st (free) | 3 | **3** | 6 | 31.8 | Jan-Apr built as STMT-0002-0005, May refused by name and price naming the 5-a-month cap, June rebuild returned STMT-2026-0001 unchanged and free. Model correctly explained the cap counts the build month, not the period's month |
| p6 | Run the statements report, refuse to invent totals | 3 | **3** | 1 | 11.2 | `statements_report` errored with the Pro price and URL; model declined to reconstruct a cross-client total from earlier `statement_aging` calls, offered the free alternative instead |

**Totals: 18/18, 12 tool calls, 107.6 s, 1 resource read, 3 tool errors (all expected Pro
refusals). Round 26 (stdio) was 18/18, 12 tool calls, 95.6 s, 1 resource read, 3 tool errors.**

## Independent verification

Every number below was re-read from the endpoint by direct `curl tools/call` on the same
token, or by hand recomputation from the three sibling ledgers, not taken from the model's
prose.

| Claim | Evidence | Verdict |
|---|---|---|
| The seeded fixture matches the stdio worked month exactly | `invoice_list`: INV-2026-0001 paid 1,000.00, INV-2026-0002 partial balance_due 1,700.00, INV-2026-0003 unpaid 750.00, INV-2026-0004 unpaid 500.00; `credit_note_list`: 150.00 total credited; `deposit_list`: DEP-2026-0001 received 500.00, applied 300.00, held 200.00 | PASS |
| June closing balance 2,300.00 is real, not asserted | Hand recompute: opening 500.00 (1,000.00 - 400.00 paid pre-period - 100.00 credited pre-period) + invoiced 2,750.00 (2,000.00 + 750.00 issued in June) - paid 900.00 (600.00 direct + 300.00 deposit applied) - credited 50.00 = 2,300.00, matching `statement_build`'s own `closing_balance_minor 230000` | PASS |
| The as-at-2026-06-10 aging insight is real | `statement_aging {as_of: "2026-06-10"}` direct: `outstanding_minor 250000`, `overdue_minor 50000`, INV-2026-0001 31 days overdue | PASS |
| The level 1 dunning letter download is exactly what was relayed | Fetched `https://mcp.zovo.one/mcp/download/0a6621b748a710c32ee319b7a13a1185`: byte-identical to the transcript's printed letter | PASS |
| The 5-a-month cap and the free rebuild are real, not a client-side miscount | Re-issuing `statement_build` for May 2026 after the run still errors with the identical cap text naming 2026-09 | PASS |
| `statements_report` genuinely refuses on free | Direct call returns the identical Pro-feature text and both buy URLs | PASS |

## Defects

None. All six prompts landed clean threes, no clarifying turn, no denied call, no wrong
figure anywhere in the round.

## Bottom line

18 of 18 hosted, matching round 26's 18 of 18 over stdio on the identical six prompts, reached
through `https://mcp.zovo.one/mcp/statement-of-account/t/<token>` per `REMOTE_RESULT.md`
Extension 15. Because the hosted lane cannot be seeded by writing files directly, the
worked-month fixture was reproduced live through the real `invoice`, `billing-docs` and
`deposits` tools before any CLI prompt ran, and the server assigned the exact invoice numbers
and balances the fixture specifies, confirmed by a direct `statement_build` call returning the
identical closing balance before the conversation began. Every prompt then reproduced round
26's exact behaviour: p1's closing balance checked three ways (transcript, the tool's own
stored figure, and a hand recomputation from `invoice_list`/`credit_note_list`/`deposit_list`
on the same token); p3's as-at-2026-06-10 insight exact to the cent; p4's dunning letter
download byte-identical to the transcript; p5's five-a-month cap driven to its boundary and
re-verified against the same token afterward; and p6's Pro-gated report refused outright with
the model declining to approximate its cross-client total from prior free calls. The one
deliberate difference from round 26 is the business profile, Nova Studio per this task's
recipe rather than the stdio round's Studio One, and the model correctly relayed the real name
from the resource rather than the name printed in the (deliberately unchanged) prompt text.
No code was touched; this is a measurement-only report.

Built by theluckystrike. https://github.com/theluckystrike
