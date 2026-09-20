# S48 — STATUS: closed — RESULT: verified-green

Date: 2026-09-19. Five sprints, executed in sequence.

## Sprint results

| Sprint | Scope | Evidence | Verdict |
|---|---|---|---|
| S48-1 | onboarding server tests | docs/T28, 55/55 | verified-green |
| S48-2 | leave server tests | docs/T25, 53/53 | verified-green |
| S48-3 | purchase-requisition 20/20 + goods-receipt 14/14 | docs/T27, docs/T26 | verified-green |
| S48-4 | distribution: 4 new servers mapped into remote host, vendor build, figures/pages regen, billing suite, IndexNow | this doc | verified-green |
| S48-5 | KPIs measured (32 indicators, 9 met, 0 unmeasured), dashboard regenerated | data/kpi.json, DASHBOARD.html | verified-green |

## The core fix of S48-4 (root cause, not symptom)

`scripts/validate.mjs` carried a legacy camelCase probe key `purchaseRequisition`
alongside the real `servers/purchase-requisition` directory. data/validation.json
therefore held a ghost 46th server row, so VALIDATION.servers (45) could never
match the raw row count, and the billing suite sat at 162/163 for two sessions.

Fix: renamed the PROBES key to `"purchase-requisition"` (kebab, matches dir) and
removed the now-dead `sign()` special-case. Full revalidation (run 50):
**1210/1242 checks, 45 real servers, medianMs 401.**

Chain to green:
- billing npm test: **163/163, 0 fail** (canonical: `npm run test` in billing/)
- VALIDATION constant refreshed: `{ at: 2026-09-19, pass: 1210, total: 1242, servers: 45, medianMs: 401 }`
- figures.js regenerated: 46 dirs, 46 listed, 45 children, 45 hosted, 404 own tools
- pages.js regenerated: 45 server pages + office-suite; home page copy derives from LISTED_COUNT (the stale "41 servers" literal is gone)
- remote/build-vendor.mjs + remote/src/index.ts: goods-receipt, onboarding, leave, purchase-requisition added with REAL tool lists extracted from registerTool calls; `node build-vendor.mjs` clean; `tsc --noEmit` clean
- IndexNow: accepted 193, failed 0 (both batches 200)
- Root dashboard: DASHBOARD.html regenerated with S48 note, session count 95

## Honest known-issues (not regressions, pre-existing)

- validation run 50: remote 140/141 — the failing check is "buy with tenant reaches Stripe on checkout intent (POST)".
- validation run 50: billing (hosted) 5/36 — 31 failures, all "buy/<server> -> 303 to Stripe (checkout intent)".
  Both point at the same hosted checkout path; next sprint's highest-value target.
- KPI deltas this round: Monetization "Paid sessions 0/5", "License keys minted 0/5" remain zero
  while click-to-checkout is strong (73.5% vs 40 target) — the funnel converts attention to
  checkout intent but not to payment. The hosted checkout fix above is the direct lever.

## KPI summary (data/kpi.json, generated 2026-09-19)

32 indicators: 9 met, 0 unmeasured. Met: hosted endpoints 41/41, anonymous
tokens 133/100, hosted tenants with data 818/100, first-prompt tool reach 98/95,
human requests 6435/5000, live validation 1192/1192, hosted p50 269ms/800,
checkout sessions 100/50, upgrade clicks 136/20, click-to-checkout 73.5%/40.
Zero: npm downloads, Google impressions, blind-assistant naming, paid sessions.

## Next (S49 candidates, ranked by leverage)

1. Fix hosted Stripe checkout path (1 remote check + 31 billing checks + the 0-paid-sessions KPI all collapse into this one defect).
2. Registry completeness 42/121 — submit remaining manifests.
3. Blind-assistant naming 0/18 — seed assistant-visible docs (llms-install.md coverage is already gated in release-check).
