# NAMING_R2_RESULT.md — registry name variants, round 2, 2026-09-03

status: DONE (publish confirmed; post-publish re-measurement partially blocked by a registry API outage)

## What changed

Probed the registry (name-substring search) for 47 candidate tokens users type for our
12 servers. For every server that had at least one near-empty token (under 100 results,
preferably under 20) it did not already hold, published ONE additional registry name —
same v0.4.2 mcpb package/sha as the parent server, new `name`. Old names are untouched
(not deprecated). 7 of 12 servers got a variant; 5 were skipped because no honest unheld
token was available in-budget.

| server | new variant registry name | tokens targeted | pre-publish result counts |
|---|---|---|---|
| time-tracker | io.github.theluckystrike/timer-tracking | timer, tracking | 12, 24 |
| price-tracker | io.github.theluckystrike/prices-deal | prices, deal | 21, 99 |
| invoice | io.github.theluckystrike/invoices-invoicing | invoices, invoicing | 0, 68 |
| expense-tracker | io.github.theluckystrike/expenses | expenses | 0 |
| currency | io.github.theluckystrike/exchange-fx | exchange, fx | 82, 87 |
| timezone | io.github.theluckystrike/calendar | calendar | 90 |
| recurring | io.github.theluckystrike/retainer | retainer | 0 |

Skipped (no honest empty token in the 47-token probe set):

| server | why skipped |
|---|---|
| spreadsheet | excel/xlsx/csv/sheet already held; no other candidate probed |
| docx | only unheld candidate was `word` at 100+ results, over the acceptable ceiling |
| clauses | contract/clause/proposal/docx already held by this or the docx server |
| resume | resume/cv/job/cover-letter all already held or over the 100+ ceiling |
| office-suite | every unheld candidate (invoices/expenses/prices/deal/exchange/fx/calendar/retainer) was topically closer to another server and already assigned there — one variant per token, no duplication |

Files: `servers/{time-tracker,price-tracker,invoice,expense-tracker,currency,timezone,
recurring}/server.variant.json` (new). `data/registry_rank.json` (`variants_r2_2026-09-03`
key). `data/organic.json` (`measured[]`, `servers[]`, `surfaces[]`, `fleet`).

## Deviations from the task spec (and why)

1. **Version 0.4.2, not 0.4.1.** The repo's server.mcpb.json files were already at 0.4.2
   with a real, existing v0.4.2 release asset by the time this task ran; 0.4.1 assets no
   longer exist. Publishing a variant at 0.4.1 would point at a dead download. Used the
   actual current version instead.
2. **remotes[] dropped from every variant.** The task asked for "the same packages block
   ... and remotes." The registry rejects that: publishing a second server name that
   reuses a parent's remote URL fails with `400 Bad Request: remote URL
   https://mcp.zovo.one/mcp/<x> is already used by server io.github.theluckystrike/<parent>`.
   All 7 variants are therefore stdio-only (mcpb package only, no remotes[]) — same
   restriction that already applies to office-suite. This is a hard registry constraint,
   not a choice.
3. **Post-publish re-measurement incomplete.** registry.modelcontextprotocol.io started
   timing out (10-25s, all retries exhausted) on every `/v0/servers` request during the
   scheduled 3-minute-later re-probe window and stayed down for the rest of the task's
   time budget. This is an API outage, distinct from the previously-documented 1-3 minute
   index lag. Only `invoices` and `expenses` could be scored with certainty without a live
   requery: both had exactly 0 results pre-publish, so after publishing our own row with
   that exact substring, the count is necessarily 1 and that 1 result is ours (rank 1,
   p=1) — a deduction, not a live confirmation. The other 9 targeted tokens (timer,
   tracking, prices, deal, invoicing, exchange, fx, calendar, retainer) had nonzero
   pre-publish results, so their post-publish rank is unknown until a live reprobe
   succeeds; their scores were left unchanged (pending) rather than guessed.

## Probe method (bounded, per coordinator instruction)

One request per token: `GET .../v0/servers?search=<token>&limit=100`, 20-25s timeout,
up to 3 retries. `results` = servers.length on that one page; recorded as `"100+"` when
the page was full and a `nextCursor` existed (true total is higher but irrelevant for
near-empty-token selection, since every token actually picked scored under 100 and was
therefore fully captured on one page). `held` = any returned row whose name contains
`theluckystrike/` and the token as a substring.

## Before/after (only the two confirmed slots; see caveat above)

| token | before | after |
|---|---|---|
| invoices | 0 results, no match | 1 result, io.github.theluckystrike/invoices-invoicing, rank 1 (inferred) |
| expenses | 0 results, no match | 1 result, io.github.theluckystrike/expenses, rank 1 (inferred) |

| server | organic before | organic after |
|---|---|---|
| invoice | 6.5 | 19.0 |
| expense-tracker | 66.7 | 86.7 |

Registry surface findable: 0.345 -> 0.381 (36 of 56 -> confirmed gain on 2 of 56 slots;
the other 9 newly-targeted slots are unmeasured pending a working API call).
Registry surface score: 34.5 -> 38.1. Fleet score (noisy-OR): 99.2 -> 99.7 (near ceiling
already; expense-tracker and invoice both moved up but the fleet score is dominated by
timezone's 79.7).

## artifacts

- servers/time-tracker/server.variant.json, servers/price-tracker/server.variant.json,
  servers/invoice/server.variant.json, servers/expense-tracker/server.variant.json,
  servers/currency/server.variant.json, servers/timezone/server.variant.json,
  servers/recurring/server.variant.json
- data/registry_rank.json (`variants_r2_2026-09-03`)
- data/organic.json (`measured[]`, `servers[].organic` for invoice/expense-tracker,
  registry-surface rows, `fleet`)
- docs/NAMING_R2_RESULT.md

## follow-up

- Re-run the post-publish reprobe for timer, tracking, prices, deal, invoicing, exchange,
  fx, calendar, retainer once the registry API is healthy again, and update the
  corresponding server organic scores in data/organic.json.
- recurring is not yet a tracked server row in data/organic.json's `servers[]` — add it
  (query_set, competitors_in_matched_slots) in a future pass; its `retainer` variant
  (0 prior results) is publish-confirmed but not reflected in the organic score yet.
- Consider whether a second, unique remotes[] URL per variant (e.g.
  `/mcp/<slug>` aliasing to the same backend) is worth adding so future variants are not
  forced to stdio-only.
