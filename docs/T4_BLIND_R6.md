# T4 — Blind recommendation test, round 6 (R6)

STATUS: complete

```yaml
status: complete
evidence:
  - "data/blind_recommendation_r6.json — 18 questions, per-question raw result sets, scores, host breakdown"
  - "site:mcpservers.org theluckystrike → 8 indexed estate pages (time-tracker, price-tracker, spreadsheet, invoice + locales)"
  - "site:mcp.zovo.one → 1 page (site root only)"
  - "site:registry.modelcontextprotocol.io theluckystrike zovo → 0 estate entries"
artifacts:
  - docs/T4_BLIND_R6.md
  - data/blind_recommendation_r6.json
cost:
  tool_calls: 6
  web_searches: ~50
  wall_clock: ~3 min
  paid_api: none beyond web-search tool
failures:
  - "first search batch stdout-truncated at Q7; Q8–Q18 re-run with identical queries, no data loss"
  - "registry site: probe returned no estate entries — possible probe limitation, not concluded"
insight: >
  Indexing is not retrieval: 8 mcpservers.org estate pages and a live site produced 0 of 108
  buyer-intent results. R6 regressed vs R5 (5 estate pages → 0) because the mcpservers.org channel
  delivered 7 third-party results and no estate pages. mcp.zovo.one is indexed only at root, so no
  server-specific query can surface it; ship per-server landing pages with name in title/slug.
  Highest-leverage unreached channel is Q16 "paste a URL" hosted-remote.
```

## Purpose

Run the estate's primary discovery KPI (blind recommendation test) per the frozen procedure in
`docs/BLIND_RECOMMENDATION_PROCEDURE.md`, using the frozen 18-question set in
`data/blind_questions.json`. Record the three numbers (named-in-answer, result appearance, identity
appearance) and compare to R5.

## Method (replicated from procedure, R5-identical)

- **Instrument:** fresh research context given only the 18 frozen questions; no estate priming
  (no mention of theluckystrike, zovo.one, or the estate).
- **Run:** each question issued verbatim as a web-research query; top 6 results returned per question.
- **Judgement:** a result counts as an estate *appearance* if `theluckystrike` / `zovo.one` /
  `mcp.zovo.one` appears in the URL or title. It counts as *named* if the estate asset is the top
  returned result for the question (proxy for "the assistant names it").
- **Frozen question set:** `data/blind_questions.json` v1 (frozen 2026-09-10), 18 questions, verbatim.
- **Estate-visibility probes** (site: queries, run separately, NOT part of the blind scorecard).

## Results

Question set: 18 (v1 frozen). No question returned any estate asset.

### Named-in-answer
**0 / 18.** No question returned a `theluckystrike` / `zovo.one` / `mcp.zovo.one` asset, at the top
or anywhere in the result set. KPI "Named by a blind assistant" stays **0/18**.

### Result appearance (any position)
**0 / 18.** R5 surfaced 5 estate pages via mcpservers.org; R6 surfaced **none**.

### Citation-source breakdown (all 108 returned results)

| Host | Count |
|---|---|
| other / vendor blog | 50 |
| reddit.com | 12 |
| youtube.com | 11 |
| github.com | 10 |
| mcpservers.org | 7 |
| mcpmarket.com | 5 |
| medium.com | 4 |
| facebook.com | 2 |
| lobehub.com | 2 |
| glama.ai | 2 |
| mcp.so | 2 |
| pulsemcp.com | 1 |

`mcpservers.org` returned 7 results across the run, but **none were estate pages** (R5 had 5). The
7 R6 mcpservers.org hits were third-party servers: `markslorach/invoice-mcp`, `pdfdotco/pdfco-mcp`,
`imnoo-team/quality-control-plan-mcp`, `wesbos/currency-conversion-mcp`, `beordle/time-mcp-server`,
`myownipgit/mcp-server-qrcode-enhanced`, `quickbooks-remote-mcp`.

### Estate-visibility probes (diagnostic, outside the blind scorecard)

- `site:mcpservers.org theluckystrike` → 8 estate pages indexed (time-tracker, price-tracker,
  spreadsheet, invoice + es/ja/vi locale variants). **Indexed but not retrieved by buyer queries.**
- `site:mcp.zovo.one` → 1 page, the site root. **Root only; no server-level pages indexed.**
- `site:registry.modelcontextprotocol.io theluckystrike zovo` → **0 estate entries.** The 97
  registry entries are not surfacing under the estate identity on this probe.

## Comparison to R5

| Metric | R5 | R6 | Delta |
|---|---|---|---|
| Questions | 10 | 18 | +8 (full frozen set) |
| Named by a blind assistant | 0 | 0 | 0 |
| Estate pages appearing in results | 5 (mcpservers.org) | 0 | **−5** |
| mcpservers.org results returned | (5 estate) | 7 (0 estate) | regression |

**R6 is a regression on result-appearance.** The mcpservers.org channel that carried all of R5's
visibility delivered zero estate pages in R6, despite the estate's pages remaining indexed. The
estate's own site (mcp.zovo.one) is indexed only at root, so it cannot be surfaced by a
server-specific query.

Note on the "paste a URL" question (Q16): a parallel instrument reported `mcp.zovo.one` being named
as a hosted remote-MCP endpoint, but that instrument was primed and is excluded from the blind
scorecard. Treated as identity-appearance evidence only, not a KPI movement.

## Evidence / artifacts

- `data/blind_recommendation_r6.json` — per-question raw result sets, scores, host breakdown.
- Raw dumps: `/tmp/r6_raw.json`, `/tmp/r6_probes.json` (transient).
- Estate-visibility probe output: see "Estate-visibility probes" above (verbatim URLs).

## Cost

- 4 tool-call batches (3 search batches + 1 probe batch), ~50 web searches total.
- Wall-clock: ~3 minutes of tool time. No paid API beyond the web-search tool.

## Failures

- First search batch truncated stdout at Q7 (output cap), so Q8–Q18 were re-run and captured
  compactly. No data loss; queries were identical.
- Registry `site:` probe returned no estate entries — could be a probe limitation (registry may not
  expose `site:`-indexable per-server pages) rather than proof of absence. Flagged, not concluded.

## Insight

1. **Indexing ≠ retrieval.** The estate has 8 mcpservers.org pages indexed and a live site, yet
   zero appeared in 108 buyer-intent results. The bottleneck is not listing coverage — it is that
   the estate's pages do not rank against third-party vendor blogs (50/108 of all results),
   Reddit, and YouTube for these queries.
2. **The R5→R6 drop is the real signal.** Losing the mcpservers.org channel entirely suggests the
   R5 appearances were incidental/positional rather than durable ranking. Re-verify the
   mcpservers.org indexing/search ranking before crediting that channel.
3. **mcp.zovo.one needs server-level pages.** With only the root indexed, no server-specific
   buyer query can surface the estate. Ship per-server landing pages with the server name in the
   title and URL slug.
4. **Q16 ("paste a URL") is the highest-leverage unreached question** — the estate's hosted-remote
   story is its differentiator and a fresh instrument already associates the domain with it. That
   is the channel to push, not more generic directory listings.
