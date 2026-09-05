# User value audit, round 26 (statement-of-account, stdio) - 2026-09-05

Round 26 is the first user-value coverage of the NEW statement-of-account server, run
unmodified from `servers/statement-of-account/dist/index.js`. Six prompts, one continuous
conversation, over stdio on the free tier. No code was changed; this is measurement only.

## What the server does

`statement-of-account` reads three sibling stores it never writes to (`mcp-invoice`'s
invoices and clients, `mcp-billing-docs`'s credit notes, `mcp-deposits`'s deposit
applications) and turns them into a statement of account for a period, an aging schedule
as at any date, and a dunning letter at one of three levels. Free vs Pro: `statement_build`
is 5 distinct statements a calendar month with unlimited free rebuilds of anything already
built, `statement_aging` is free and unlimited on every tier, `dunning_text` levels 1 and 2
are free and level 3 (final demand) is Pro, and `statement_pdf` and `statements_report` are
Pro-only outright.

## Method

- **Arrival.** No connect page, no token: the server is spawned locally over stdio as
  `node /Users/mike/mcp-servers/servers/statement-of-account/dist/index.js` from one
  `mcp.json` with a single stdio entry, `MCP_LICENSE_KEY` set to the empty string so the
  whole run measures the FREE tier.
- **Seed.** Rather than registering the sibling `mcp-invoice` server on the same config and
  seeding through its own tools, the three sibling stores were seeded directly on disk with
  a small node script that reproduces `test/_client.mjs`'s seed helpers and its own
  `workedMonth` fixture byte for byte: Acme Ltd and Beta GmbH as clients, four invoices, two
  credit notes and one deposit with a partial application, Studio One as the issuing
  business on EUR. This is the server's own README worked example (opening 500.00, invoiced
  2,750.00, paid 900.00 of which 300.00 is a deposit application, credited 50.00, closing
  2,300.00 for Acme Ltd's June 2026 period), so every figure below can be checked against
  the README directly.
- **Allowlist.** Eight explicit `mcp__statement-of-account__<tool>` entries read from a live
  `tools/list` (`statement_build`, `statement_aging`, `statement_text`, `statement_pdf`,
  `dunning_text`, `statements_report`, `license_status`, `license_activate`) -- no `mcp__*`
  wildcard.
- **Client.** `claude` CLI 2.1.261, `-p`, `--model sonnet`, `--strict-mcp-config`,
  `--mcp-config` pointing at the single stdio entry, `--output-format stream-json --verbose
  --max-turns 12`, one `--session-id` then five `--resume` so all six prompts are one
  conversation, each issued as its own isolated shell invocation under `timeout 280`, each
  transcript read back in full before the next prompt ran.
- **Empty working directory, disallowed CLI tools.** Every turn ran in an empty
  `/private/tmp/uv-r26soa/wd`, with `Bash, Read, Write, Edit, Glob, Grep, WebFetch,
  WebSearch, NotebookEdit, Task, TodoWrite, Agent` denied via `--disallowedTools`. Fresh
  `XDG_DATA_HOME` / `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` / `XDG_STATE_HOME` under
  `/private/tmp/uv-r26soa/xdg` in the server's own env block only, never
  `CLAUDE_CONFIG_DIR`. `npm_config_cache=/Users/mike/.npm-cache-local` and `PATH` prefixed
  with `$HOME/.npm-global/bin` for every call. Host machine day 2026-09-05 (Saturday), which
  is why aging as at today resolves to 2026-09-05 and every invoice in the worked month
  reads as overdue by that date.
- **Verification.** After the six prompts, every figure was re-derived by a second
  JSON-RPC client spawning the same server on the SAME `XDG_DATA_HOME` the conversation
  left behind, so the free-tier statement count for September reflects the conversation's
  own five builds rather than a fresh count. `statement_build` (June rebuild), both
  `statement_aging` calls, both `dunning_text` levels, a sixth `statement_build` to
  re-trigger the cap refusal, `statements_report`, and `license_status` were all called
  directly and compared to the transcript.

## Scorecard - 18 / 18

| # | Prompt | Score | Calls | Sec | What happened |
|---|---|---|---|---|---|
| p1 | Confirm the three books via `statement://sources`, build Acme Ltd June 2026 EUR, report opening/movements/closing. | **3** | 1 (+1 resource) | 18.7 | All three stores confirmed read (4/2/1 rows). `statement_build` returned STMT-2026-0001: opening 500.00, invoiced 2,750.00, paid 900.00 (300.00 of which a deposit application), credited 50.00, closing 2,300.00 -- matches the README worked example exactly |
| p2 | Aging as at today, everyone, all currencies. | **3** | 1 | 12.3 | Acme Ltd 2,400.00 overdue (1,700.00 at 62 days, 700.00 at 72 days) plus 100.00 unapplied credit; Beta GmbH 500.00 overdue at 82 days. Total 2,900.00 across both, nothing in 0-30/31-60/over-90 correctly reported as empty rather than omitted |
| p3 | Aging as at 2026-06-10, Acme Ltd, using only what was true that day. | **3** | 1 | 10.8 | Outstanding 2,500.00, overdue 500.00 at 31 days -- matches the README's own headline worked example to the cent. The model named the mechanism: the 600.00 instalment paid 2026-06-12 is excluded because it had not happened yet as at 2026-06-10, and INV-2026-0003 (issued 2026-06-20) is correctly absent, not zeroed |
| p4 | Level 1 dunning letter, then level 3 and report what happens free. | **3** | 2 | 15.8 | Level 1 came back as a full letter with the 2,400.00 total, bank details and the tool's own no-invented-late-fee footer, relayed verbatim. Level 3 errored with the $19 price, the src-tagged buy URL, `license_activate`, and the $39 bundle, all relayed without softening or reconstructing a final demand |
| p5 | Build 4 more distinct statements, try a 6th, then rebuild the 1st. | **3** | 6 | 25.6 | Jan-Apr built cleanly (STMT-2026-0002 to 0005). May, the 6th distinct statement of the month, errored naming `statement_build`, $19, $39 and both URLs, and stated aging stays free and rebuilds are free. The June rebuild (STMT-2026-0001) succeeded with identical figures. The model correctly explained the cap counts the month the statement was BUILT in (September), not the month each period covers |
| p6 | `statements_report`, refuse without inventing totals. | **3** | 1 | 12.4 | Errored outright with the $19/$39/URL Pro text. The model explicitly declined to reconstruct a cross-client total from the free `statement_aging` calls already in the conversation, naming its own uncertainty about the report's internal grouping logic as the reason, rather than approximating |

**Totals: 18/18, 12 tool calls, 95.6 s, 1 resource read, 3 tool errors (all correct
refusals), 0 denied calls, 0 clarifying turns.**

## Independent verification

Every number below was re-read from the same `XDG_DATA_HOME` the conversation left behind,
by a second stdio JSON-RPC client, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| June statement figures | `statement_build`: STMT-2026-0001, opening 50000, invoiced 275000, paid 90000 (deposits 30000), credited 5000, closing 230000 minor | PASS |
| Aging as at today (2026-09-05) | `statement_aging {}`: Acme 61-90 bucket 240000, Beta 61-90 bucket 50000 minor | PASS |
| Aging as at 2026-06-10, the key insight | `statement_aging {as_of:"2026-06-10", client:"Acme Ltd"}`: outstanding 250000, overdue 50000, 31 days, INV-2026-0003 absent | PASS |
| Dunning level 1 and level 3 | level 1 text byte-identical to transcript; level 3 errors with identical Pro text and both URLs | PASS |
| The 5-a-month cap is real, not a client miscount | Re-issuing `statement_build` for May 2026 after the run still errors with the 5-in-2026-09 cap text | PASS |
| `statements_report` refusal | Errors with identical Pro text and buy URL | PASS |
| Free tier confirmed throughout | `license_status`: tier free, reason "no license found" | PASS |

## Bottom line

18 of 18 over stdio on the free tier, the first user-value coverage of
statement-of-account. Every prompt landed a clean three: no clarifying turn, no denied
call, no wrong figure. The round's headline result is p3, the server's own measured
insight reproduced live -- aging as at a past date correctly excludes a payment that had
not happened yet as at that date, giving 2,500.00 outstanding and 500.00 overdue where a
naive today's-`paid_minor` read would show 1,700.00 and nothing overdue at all, exactly
the gap the server's README documents. p5 drove the free cap to its edge and back: five
distinct statements built, a sixth refused by name and price, and a rebuild of the first
one still free, with the model correctly explaining the cap counts the build month, not
the period. p6 refused the Pro-gated `statements_report` and the model declined to
approximate its total from data already in the conversation. No code was touched; this is
a measurement-only report.
