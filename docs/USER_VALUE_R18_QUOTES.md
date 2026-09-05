# User value audit, round 18 (quotes re-run) — 2026-09-05

Round 18 is a single-lane hosted re-run of round 12's six quotes prompts, after
`docs/GUARDRAILS_RESULT.md` reclassified `quote_report` from a bare Pro refusal to a free,
capped guardrail answer (current calendar year to date). Same server, same six prompts, same
hosted arrival as round 12 — the only question is whether that one gate change moved the score,
and whether anything round 12 already had at 3 regressed.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, minting
  `anon_c9ca31af8983ac149b15de284dc86025`. One token, reused for the lane.
- **Registration.** One `mcp.json`, two `http` entries, both
  `https://mcp.zovo.one/mcp/<server>/t/<token>`, no `--header` anywhere: `quotes` and `invoice`
  (the invoice server is registered only to seed the shared business profile and to let q4 read
  the invoice the quote turns into, on the same token).
- **Seed.** One curl `tools/call business_set` on `/mcp/invoice` under the token before any prompt
  ran: `{"name": "Nova Studio", "timezone": "Europe/Warsaw", "default_currency": "EUR",
  "default_tax_rate": 23}`. Reply confirmed `payment_terms_days 14, invoice_prefix INV` and named
  every server (bank-statement, barcode, calendar, clauses, currency, docx, expense-tracker,
  image, kanban, pdf, quotes, resume, time-tracker, timezone) that reads the same shared profile.
- **Allowlist.** 23 `mcp__<server>__<tool>` entries read from a live `tools/list` of each endpoint
  (quotes 11, invoice 12) — no `mcp__*` wildcard.
- **Client.** `claude` `-p`, `--model sonnet`, `--strict-mcp-config`, `--mcp-config` pointing at the
  two-entry file above, `--output-format stream-json --verbose --max-turns 12`, one `--session-id`
  (a generated UUID; a bare timestamp string was rejected) then five `--resume`, `timeout 240` per
  prompt. Each prompt's stream-json was written to its own file (`out/s1.jsonl` .. `out/s6.jsonl`)
  before the next prompt started.
- **D-R57 honoured.** The lane ran in an **empty** working directory
  (`/private/tmp/uv-r18q/wd`) with the CLI's own filesystem tools disallowed
  (`Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, NotebookEdit, Task`). Nothing shelled
  out. Fresh `XDG_CONFIG_HOME` / `XDG_DATA_HOME` / `XDG_CACHE_HOME` / `XDG_STATE_HOME` under
  `/private/tmp/uv-r18q/xdg`, no reuse of any prior round's state.
- **Clock.** 2026-09-05, a Saturday.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap. 1 = partially wrong, or asked for something the tool could
infer. 0 = failed.

## Scorecard — 18 / 18 (round 12: 17 / 18)

| # | Prompt | R12 | R18 | Calls | Sec | What happened |
|---|---|---|---|---|---|---|
| q1 | "Quote Nova Ltd for 12 hours of design at EUR 90 an hour and a EUR 300 logo, valid two weeks." | 3 | **3** | 1 | 13.0 | One `quote_create` with `validity_days: 14`. Q-2026-0001, `valid_until 2026-09-19`, EUR 1080.00 + EUR 300.00, 23% on EUR 1380.00 = EUR 317.40, `total_minor 169740`. The 23% was named as coming from the profile; "Nova Ltd is not a stored client" was flagged unprompted. Same numbers as round 12 (dates shifted one day later because the run day shifted) |
| q2 | "What quotes are open and when do they expire?" | 3 | **3** | 1 | 4.4 | One `quote_list {state: "open"}`, one row, EUR 1,697.40, 2026-09-19, 14 days left, nothing invented |
| q3 | "Give me the text I can email to Nova for that quote." | 3 | **3** | 1 | 8.3 | One `quote_send_text`. Full totals block reproduced verbatim in the reply, "valid until 2026-09-19", signed "Nova Studio". `GET` the returned download link: 200, `text/plain; charset=utf-8`, `filename="Q-2026-0001.txt"`, 455 B, body opens `Hello Nova Ltd,` and matches the reply byte-for-byte. The model withheld the one-hour download link itself as an "unauthenticated URL," offering it only on request — the requested text was delivered complete and correct either way |
| q4 | "Nova accepted. Invoice it, and then show me every invoice I have." | 3 | **3** | 2 | 10.9 | `quote_accept` -> INV-2026-0001, due 2026-09-19, `totals_check` EUR 1697.40 both sides. Then `invoice_list` on **the other hosted endpoint, same token**: the invoice is there, EUR 1,697.40, unpaid. The shared invoice store still works read-write over the URL path |
| q5 | "Acme wanted 3 days of consulting at PLN 1200 a day, so quote them too - and they have just declined it." | 3 | **3** | 2 | 10.3 | `quote_create` inferred **PLN** from the price rather than the profile's EUR default, 23% on PLN 3600.00 = PLN 828.00, total PLN 4,428.00, default 30-day validity (this prompt did not ask for two weeks). Then `quote_decline`, `open_quotes_now: 0` |
| q6 | "What is my win rate this quarter?" | 2 | **3** | 1 | 11.3 | **One `quote_report {from: "2026-07-01", to: "2026-09-30"}` call, no refusal.** `win_rate_percent: 50`, `win_rate_basis` named ("accepted / (accepted + declined); a quote nobody answered is not a loss the client chose"), full per-currency breakdown (1 EUR accepted at 1697.40, 1 PLN declined at 4428.00). The model relayed the number and both quotes directly from the report instead of falling back to a hand count over `quote_list` |

**Totals: 18/18, 8 tool calls, 58.2 s. Round 12 was 17/18, 9 tool calls, 73.4 s (quotes lane only).**

## Independent verification

Every number below was re-read from the endpoint by `curl tools/call`, or decoded from the
downloaded bytes, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | one lane, two `/t/<token>` entries, connected first try, no `Authorization` anywhere | PASS |
| The quote store | `quote_list` by curl: Q-2026-0001 Nova Ltd accepted EUR 1697.40 with `invoice_number INV-2026-0001`, Q-2026-0002 Acme declined PLN 4428.00 | PASS |
| The accepted quote really became an invoice on the other endpoint | `invoice_list` by curl on `/mcp/invoice`, same token: INV-2026-0001, EUR 1697.40, `status unpaid`, `balance_due EUR 1697.40`, tax line `23% on EUR 1380.00 = EUR 317.40` | PASS |
| The quote text download | `GET https://mcp.zovo.one/mcp/download/7fe2bb08...` -> 200, `text/plain; charset=utf-8`, `Q-2026-0001.txt`, 455 B, opens `Hello Nova Ltd,`, byte-identical to the model's relayed text | PASS |
| `quote_report` now answers free instead of refusing | curl `tools/call quote_report {from:"2026-07-01", to:"2026-09-30"}` on the same token: 200, `win_rate_percent: 50`, `counts {accepted:1, declined:1}`, full `by_currency` breakdown, no `isError` and no upgrade text anywhere in the payload | PASS, server-side, matches `docs/GUARDRAILS_RESULT.md`'s row for quotes |
| The 50% win rate is arithmetically right | `quote_list` by curl: 2 quotes total, 1 `accepted` (Nova Ltd), 1 `declined` (Acme), 0 `open`/`expired` -> 1/(1+1) = 50% | PASS |
| `quote_report`'s own count matches `quote_list`'s raw rows | report `counts.accepted:1, counts.declined:1, counts.open:0, counts.expired:0` vs `quote_list`'s two rows, one `accepted`, one `declined` | PASS |

## Residual observation (not scored)

On four of the six turns (q1, q3, q4, q6) the model called `ToolSearch` with a `select:` query
naming the exact `mcp__quotes__*` / `mcp__invoice__*` tools it was about to use, before calling
them — even though `--strict-mcp-config` plus the explicit 23-entry allowlist already exposed
every one of those tools directly. Each `ToolSearch` call returned `tool_reference` stubs (no
error, no added information) and the real tool call that followed always succeeded on the first
try, so no answer was affected. This did not exist as a step in round 12's transcripts and adds a
small, constant latency/turn tax (roughly one extra turn per affected prompt) that is internal to
this Claude Code client build, not the quotes or invoice server. Logged as a client-side
observation, not a defect against either server.

## Bottom line

18/18, up from 17/18 in round 12. The one point on the table in round 12 — `quote_report` refusing
outright and forcing the model to hand-tally a win rate from `quote_list` — is gone: the same
prompt now gets one `quote_report` call back with the exact win rate, its stated basis, and a full
per-currency accepted/declined/open/expired breakdown, all confirmed independently against
`quote_list` by curl. Every other prompt reproduced round 12's numbers exactly (dates shifted one
day for the later run date), including the two cross-endpoint checks — the invoice that a quote
turns into, and the plain-text download a quote can be emailed as — which still work over
`/t/<token>` with no header. No new defect was found; the only thing logged is a client-side
`ToolSearch` habit that cost latency but never correctness.
