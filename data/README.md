# data/

Files consumed and produced by `scripts/update-dashboard.mjs`. All are plain JSON,
regenerated or read on every run. Missing files never crash the script — the
dashboard renders "pending"/"unknown" for anything absent.

## ledger.json (generated, do not hand-edit)
Output of `node scripts/update-dashboard.mjs`. Source of truth for
`dashboard/index.html`. Schema:
- `generated_at`: ISO timestamp of the run that produced this file.
- `session.count`: number of runs invoked with `--note`; `session.history`:
  append-only log of `{at, note}`, persisted across runs by reading the
  previous ledger.json before overwriting it.
- `servers[]`: one entry per `servers/<id>/` directory — npm name/version,
  tool names (parsed from `registerTool("name"` calls in `src/index.ts`),
  free-tier limits (parsed from the README's "Free" row), build status
  (`dist/index.js` exists), test summary and result status (from
  `RESULT.md`), lines of code in `src/*.ts`, which required files exist,
  and distribution status per surface.
- `billing`: status line and URLs parsed from `billing/RESULT.md`, plus a
  product list (from `data/products.json` if present, else derived).
- `docs[]`: every `docs/*.md` file with its first non-empty line.
- `revenue`: from `data/sales.json` if present, else `{stripe_live_sales: 0}`.

## distribution.json (hand-maintained input, optional)
Per-server publish status for external surfaces. Read by the dashboard script;
absent entries default to `"unknown"`. Shape:
```json
{
  "time-tracker": {
    "npm": "published",
    "registry": "unknown",
    "github": "published",
    "smithery": "missing",
    "glama": "unknown"
  }
}
```
Allowed values: `"unknown"`, `"published"`, `"missing"`. Any other agent
(publishing to npm, the MCP registry, Smithery, Glama) should update this
file so the dashboard reflects reality.

## sales.json (hand-maintained input, optional)
Revenue figure surfaced in the KPI row. Shape:
```json
{ "stripe_live_sales": 0, "note": "no sales recorded yet" }
```

## products.json (hand-maintained input, optional)
Overrides the auto-derived billing product list (one row per server at
$19 pointing at `https://mcp.zovo.one/buy/<id>`). Shape:
```json
[{ "id": "time-tracker", "price_usd": 19, "url": "https://mcp.zovo.one/buy/time-tracker" }]
```

## Regenerating
```
node scripts/update-dashboard.mjs --note "what changed"
```
Writes `data/ledger.json` then `dashboard/index.html` from it. Safe to run
at any point in the build — half-finished servers render as "pending"/"no"
rather than crashing the script.
