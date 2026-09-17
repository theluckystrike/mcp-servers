# S39 T2 — Findable-share token measurement (R2)

STATUS: shippable — subagent timed out mid-run (900s, 10 API calls); its probe script
`scripts/s39_findable_probe.py` was correct and the orchestrator ran it to completion
(proc_1008a1569d72, 71/71 tokens, 0 errors, fully-paginated cursor walks).

Method: for each of the 71 unique tracked tokens (from `data/organic.json`
`servers[].query_set`), fully paginated GET
`https://registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100`
walking `metadata.nextCursor` to exhaustion. Command:
`python3 scripts/s39_findable_probe.py /tmp/s39_tokens.json /tmp/s39probe.log`

## Headline numbers

- Tokens measured: 71, 0 errors.
- Page-1 presence (at least one io.github.theluckystrike/* row on page 1): 47/71 = 66%.
- KPI 'Registry findable share' updated 50 -> 66 (method note in kpi.json: R2 counts
  page-1 only; the old 50 was a softer top-pages estimate — not apples-to-apples).
- Present but pushed off page 1: 13 tokens (worst: `ics`, 1018 rows, our rows on page 10;
  `time`, 492 rows, page 3; `pdf`, 395 rows, page 3).
- Fully absent from search entirely: 11 tokens —
  "time tracker", "product", "shop", "price tracker", "table", "data", "word", "cv",
  "hiring", "agenda", "ical".
- Best page-1 ranks: `billable` pos 1, `invoices` pos 1, `expenses` pos 1, `mileage` pos 1,
  `world-clock` pos 1, `retainer` pos 1.

## Why the 11 absent tokens are absent

These are multi-word phrases ("time tracker") or generic nouns ("data", "table", "word")
that no server name contains and the registry `search` parameter does not match against
description text. This is a registry search-behavior fact, not a content defect: the
descriptions DO carry the concepts, and /llms.txt + per-page content do too.

## Recommended actions (ranked)

1. None of the 11 absent tokens justify renaming a server — registry search matching on
   name only means honest names cannot absorb generic nouns. Leave names alone.
2. The 13 off-page-1 tokens are star-ranked out (competitors have stars, we have 0-6).
   The only autonomous fix is none; stars remain the binding constraint (human-gated).
3. Keep the probe script: re-run monthly; it is the honest findable-share instrument.

## Artifacts

- data/organic_r2.json (R2 snapshot, updated_at 2026-09-17, absent/page1/off-page1 lists)
- /tmp/s39probe.log (71 JSONL rows; permanent copy not kept — results summarized here)
- scripts/s39_findable_probe.py (committed)
