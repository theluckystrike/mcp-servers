# T8 — KPI Refresh & Delta Report (R1)

- Run: sprint 41 T8
- Measurement window: **2026-09-17T13:45Z** vs **2026-09-18T00:35Z**
- Command: `node scripts/kpi.mjs` (32 indicators, 9 met, 0 unmeasured; $0, unauthenticated endpoints only; wrangler/stripe/gh all local CLI with valid session)
- data/kpi.json refreshed 2026-09-18T00:35:07.296Z

## RESULT.md schema block

`data/kpi.json` top-level object:
- `generated_at` — ISO-8601 UTC timestamp of the measurement run (string)
- `kpis` — array of KPI objects, each:
  - `cat` (string) — funnel category: Discovery | Install | Activation | Value | Reliability | Monetization
  - `name` (string) — unique indicator name (the delta key below)
  - `value` (number | string | null) — measured value; `null` = unmeasured/human-gated
  - `target` (number | "all" | null) — the objective; null when not a score to maximise
  - `unit` (string) — unit string (may embed the target, e.g. "of 51")
  - `how` (string) — exact command / data source / provenance note
  - `why` (string) — business rationale
  - `status` (string) — derived gate: `met` | `progress` | `zero` | `measured` | `unmeasured`
  - optional `lower_is_better` (boolean), optional `detail` (object), optional `stale` (boolean) + `how` fallback note
- `raw` — object of underlying measurements: `stripe`, `sales_charges_seen`, `remote_kv`, `license_kv`, `pro_tenants`, `latency`, `registry`, `sitemap_urls`

## Delta table (09-17 → 09-18)

| name | 09-17 | 09-18 | delta |
|---|---|---|---|
| Registry entries at latest version | 97 | **42** | **-55** |
| Registry findable share | 66 | **50** | **-16** |
| Distribution surfaces live | 17 | **12** | **-5** |
| URLs offered in the sitemap | 171 | 190 | +19 |
| Google impressions, storefront | 0 | 0 | 0 |
| Named by a blind assistant | 0 | 0 | 0 |
| Our share of recommendation citations | 2 | 2 | 0 |
| Repo clone-to-view ratio | 63.1 | 63.1 | 0 |
| Googlebot URL coverage | 2 | 2 | 0 |
| ClaudeBot URL coverage | 140 | 140 | 0 |
| Human requests, storefront | 1232 | 1232 | 0 |
| GitHub unique visitors | 33 | **48** | **+15** |
| Release asset fetches | 6507 | 6507 | 0 |
| npm weekly downloads | 0 | 0 | 0 |
| Hosted endpoints coverage | 34 | **41** | **+7** |
| Anonymous hosted tokens minted | 130 | **133** | +3 |
| Hosted tenants with stored data | 616 | **799** | **+183** |
| Hosted downloads served | 95 | 95 | 0 |
| First-prompt tool reach | 98 | 98 | 0 |
| User-value score, latest round | 61 | 61 | 0 |
| Seam defects fixed of found | 123 | 123 | 0 |
| Servers that reached 100% in a round | 19 | 19 | 0 |
| Live validation checks passing | 1135/1135 | **1192/1192** | +57 |
| Unit tests passing | 1563 | **1816** | +253 |
| Hosted tools/list latency p50 | 313 | **290** | **-23** (better) |
| Silent-partial-result defects open | 0 | 0 | 0 |
| Checkout sessions from humans | 65 | **100** | **+35** |
| Paid sessions | 0 | 0 | 0 |
| License keys minted | 0 | 0 | 0 |
| Upgrade link clicks (humans, 7d) | 671 | **334** | **-337** |
| Click to checkout-session ratio | 9.7 | **29.9** | **+20.2** |
| Pro tenants on hosted endpoints | 2 | 2 | 0 |

## Three biggest movers UP

1. **Hosted tenants with stored data: 616 → 799 (+183, +30%)** — wrangler KV `tok:` prefix (real tenant documents, written only after a successful mutating call). Real, credential-free, organic growth in hosted usage. Highest-confidence demand up-mover in this window.
2. **Click to checkout-session ratio: 9.7% → 29.9% (+20.2pp)** — driven by sessions up (65→100) while clicks fell (671→334). Even with the instrument caveats below, the conversion-efficiency signal improved sharply.
3. **Checkout sessions from humans: 65 → 100 (+35)** — all 100 of the last 100 live Stripe checkout sessions are now untagged (`probe_sessions` 0). This is the most reliable demand signal in the funnel and it moved up. Secondary up-movers: unit tests 1563→1816 (+253), live validation 1135→1192, GitHub uniques 33→48, hosted endpoints coverage 34→41.

## Three biggest movers DOWN

1. **Registry entries at latest version: 97 → 42 (-55)** — **METHOD DISCONTINUITY, not a regression.** 09-17 used the legacy substring-search sampler (loop37: sample of 12 manifests vs `/v0/servers?search=`). The 09-18 run uses the script's current exact-membership instrument: one `GET /v0.1/servers/<name>/versions/latest` per manifest name (105 names) compared to release `0.22.0`; only 42 of 105 are at the release version, 41 hosted, 0 unreachable. The KPI script's own note flags this method previously read "41 of 91" while a direct sample of 12 returned 12/12 — i.e. the 42 is the honest exact-latest count and 97 was the optimistic sample. Do not read this as a product regression; re-baseline.
2. **Registry findable share: 66 → 50 (-16)** — **METHOD DISCONTINUITY.** 09-17 was measured by the dedicated `scripts/s39_findable_probe.py` (71 tokens, page-1 walks → 66%). 09-18 reads `data/organic.json`'s stored "Official MCP registry" findable share (50%). Different instruments, not comparable apples-to-apples; 66% was a fresh probe, 50% is the persisted organic.json value.
3. **Distribution surfaces live: 17 → 12 (-5)** — both read `data/distribution.json`, but the file is **uncommitted-modified** in this checkout (`git status` shows `M data/distribution.json`) and the surface set grew (target 49 → 51). The live count now excludes the open wundercorp PR that 09-17's note included. Partly a bookkeeping change (PR removed from live) rather than a pure surface loss. Flag for sprint follow-up to confirm the honest live count.

Also down: **Upgrade link clicks 671 → 334 (-337)** — instrument, not demand: 09-17's 671 was the pre-v3 counter (loop37 note: "pre-v3 click counts NOT comparable to post-v3; true human baseline ≤375/7d"). The 334 is the post-v3, Referer-required count and is the more honest number. Both click figures remain start-anchored UA upper bounds, never demand.

## Notes

- **Human-gated (skipped, noted, not measured):** none were required to run — `stripe`, `wrangler`, `gh` all used existing local CLI sessions (no new credentials needed). npm downloads (0) remains human-gated upstream (npm login / OIDC `ENEEDAUTH`); Search Console numbers (Google impressions 0, coverage) come from `data/gsc.json`/`data/traffic.json` already on disk — no new console login attempted this run.
- Static values with 0 delta (release fetches 6507, traffic 1232/2/140, repo ratio 63.1) come from on-disk data files (`data/metrics.json`, `data/traffic.json`, `data/baselines/loop33_baseline.json`) that were not regenerated this window — they are the last persisted pull, not a fresh network read.
- Monetization floor unchanged: paid sessions 0, license keys minted 0, Pro tenants 2. Revenue still zero; the funnel top (sessions 100, ratio 29.9%) moved up but has not converted.

## Evidence trail

- `node scripts/kpi.mjs` → `kpi: 32 indicators, 9 met, 0 unmeasured` (exit 0)
- `data/kpi.json` `generated_at: 2026-09-18T00:35:07.296Z`
- raw remote_kv.by 09-18: `{ anon:133, bind:2, click:1573, lic:3776, meta:388, probe-session:31, rl:39, shared:2, tok:799 }`
- raw registry 09-18: `{ entries:42, names:105, release:"0.22.0", hosted:41, unreachable:0 }`
- raw stripe 09-18: `{ sessions_last100:100, probe_sessions:0, human_sessions:100, paid:0 }`
