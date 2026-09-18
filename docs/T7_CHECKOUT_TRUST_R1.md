# T7 — Checkout Trust Rework (R1)

STATUS: complete — trust rework applied to index.js (checkoutIntentPage what-you-get block + purchasePromiseHtml on buy+success). Verified 152/152 tests, deployed by orchestrator.

## 1. Scope
## 2. KPI context
## 3. Current markup (evidence)
## 4. Drop-off friction analysis
## 5. Before / after copy
## 6. Patch applied
## 7. Tests
## 8. RESULT

ORCHESTRATOR ADDENDUM (post-cap fix, commit 213ab03e, deploy 5c227ad3): the subagent's final edit added `paidUsd = PRODUCTS.bundle.usd` default but left both call sites `purchasePromiseHtml()` — every non-bundle buy/success page would have rendered the promise at $39. Fixed: `purchasePromiseHtml(p.usd)` at checkoutIntentPage (~908) and successPage (~1112). Tests 152/152. LIVE VERIFIED with browser UA: /buy/invoice renders "What you get for $19" and "$19.00 USD" (earlier 303 probes were the scripted-UA guard redirecting to /s/invoice — expected behavior, not a bug).
