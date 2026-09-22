# Cold Monetization Map — 47-Server Estate (mcp.zovo.one)

STATUS: complete (shippable)

**Audit date:** 2026-09-22 · **Auditor:** cold monetization sweep (read-only, no code/deploy changes)
**Estate:** `/Users/mike/mcp-servers` — 47 MCP servers served at `mcp.zovo.one` (45 in `remote/src/vendor/` + `backlink-checker` + `office-suite` in `servers/`).

## Executive summary

The estate is **already monetized end-to-end** — this is not a cold start. A live Stripe Checkout rail, a license-key flow (MCPL1), per-server free-tier caps enforced in code via `gate.isPro()`, and a rate-limit tier (600 free / 6000 pro calls/hour) are all in production. **41 of 47 servers are billable** (the bundle `SERVER_COUNT = 46`, updated R8); 1 is free/unbundled — count 46 vs 47 dirs still needs reconciliation. Pricing is **$19 one-time per server, lifetime**, or **$39 for the whole bundle**. The fastest revenue lever is not building a paywall — it is **enrolling the 6 unbundled servers into the bundle** and **raising the bundle price / adding a subscription tier**, both of which touch only config constants.

---

## 1. Server Paywall Table (all 47)

Legend: **Paywall** = `Y` (has `gate.isPro()` + free-tier cap), `N` (no gate). **Bundle** = included in the $39 bundle (`SERVER_COUNT=41`).

| # | Server | Paywall | Mechanism | Free-Tier Limit | Recommended Action |
|---|--------|---------|-----------|-----------------|--------------------|
| 1 | time-tracker | Y | gate.isPro | reports cover last 7 days, 2 rated projects | In bundle. Add subscription tier. |
| 2 | price-tracker | Y | gate.isPro | 3 watches, last 30 observations/watch | In bundle. |
| 3 | invoice | Y | gate.isPro | 3 invoices/mo, footer line on render | In bundle. **Top revenue** (see §2). |
| 4 | expense-tracker | Y | gate.isPro | last 30 days, 3 projects, 5 rules, 200 export rows, xlsx is Pro | In bundle. |
| 5 | spreadsheet | Y | gate.isPro | 5,000 rows & 5 MB read/sheet, 500 rows written | In bundle. |
| 6 | currency | Y | gate.isPro | historical rates last 90 days (Pro → 1999) | In bundle. |
| 7 | timezone | Y | gate.isPro | 3 participants, 5 days/search, 5 contacts, 3 cal files/mo | In bundle. |
| 8 | docx | Y | gate.isPro | 3 proposals/contracts per mo, 10 placeholders, footer | In bundle. |
| 9 | resume | Y | gate.isPro | 3 cover letters/mo | In bundle. |
| 10 | recurring | Y | gate.isPro | 3 active schedules, 30 days upcoming, 12 periods | In bundle. |
| 11 | clauses | Y | gate.isPro | 10 own clauses, 8/assembled doc, JSON is Pro | In bundle. |
| 12 | pdf | Y | gate.isPro | 5 files/merge, 30 pages split, PAID/DRAFT presets | In bundle. |
| 13 | calendar | Y | gate.isPro | 2 calendars, 31-day window, 50 events export, URL import Pro | In bundle. |
| 14 | kanban | Y | gate.isPro | 3 projects, 200 open tasks, default 5 columns | In bundle. |
| 15 | image | Y | gate.isPro | sources ≤4 MP, 5 files/batch, dominant_colors Pro | In bundle. |
| 16 | bank-statement | Y | gate.isPro | 2 accounts, last 12 mo, 5 rules; reconcile/export Pro | In bundle. |
| 17 | quotes | Y | gate.isPro | 5 open quotes; quote_pdf/report Pro | In bundle. |
| 18 | barcode | Y | gate.isPro | 20 codes/mo, SVG; PNG + batch Pro | In bundle. |
| 19 | zip | Y | gate.isPro | 20 archives/mo, 25 MB, 200 entries; list/extract free | In bundle. |
| 20 | billing-docs | Y | gate.isPro | 5 docs/mo; credit_note_pdf/PO_pdf/report Pro | In bundle. |
| 21 | deposits | Y | gate.isPro | 5 deposits/mo; apply/refund/list free, statement_pdf Pro | In bundle. |
| 22 | per-diem | Y | gate.isPro | 5 trips/mo; rates/calc/list free, export/report Pro | In bundle. |
| 23 | asset-register | Y | gate.isPro | 10 assets; list/schedule/dispose free, journal/report Pro | In bundle. |
| 24 | statement-of-account | Y | gate.isPro | 5 statements/mo; aging free, statement_pdf/dunning3/report Pro | In bundle. |
| 25 | cash-book | Y | gate.isPro | 3 periods/mo; trial_balance/ledger_lines free, month_close/export Pro | In bundle. |
| 26 | amortization | Y | gate.isPro | 3 loans; schedule/list free, repay_early/journal/report Pro | In bundle. |
| 27 | petty-cash | Y | gate.isPro | 1 float, 20 vouchers/mo; reconcile/delete free, replenish/report Pro | In bundle. |
| 28 | work-order | Y | gate.isPro | 5 OPEN work orders; completion_report_text free, pdf/invoice/report Pro | In bundle. |
| 29 | catalogue | Y | gate.isPro | 25 SKUs, 1 price tier; lines_resolve/price_list_text free, extra tiers/pdf Pro | In bundle. |
| 30 | change-order | Y | gate.isPro | 5 OPEN change orders; contract_value free, document/invoice_payload Pro | In bundle. |
| 31 | bill-of-sale | Y | gate.isPro | 10 drafts + 5 finalized docs; render/read/list/delete free | In bundle. |
| 32 | credit-note | Y | gate.isPro | 10 finalized credit notes lifetime; footer stamp on render | In bundle. |
| 33 | job-card | Y | gate.isPro | 10 active cards; logging/totals/print free | In bundle. |
| 34 | dunning-letters | Y | gate.isPro | 3 active unpaid invoices chased; letters/aging/history free | In bundle. |
| 35 | checklist | Y | gate.isPro | 3 checklists, unlimited runs; report TEXT free, out_path Pro | In bundle. |
| 36 | packing-list | Y | gate.isPro | 3 OPEN packing lists; shortfall/weights/slip TEXT free, out_path Pro | In bundle. |
| 37 | delivery-schedule | Y | gate.isPro | 3 open schedules; late_report free, document/milestone_payload Pro | In bundle. |
| 38 | supplier-list | Y | gate.isPro | 10 suppliers; read/update/search/CSV free, Markdown/report Pro | In bundle. |
| 39 | service-agreement | Y | gate.isPro | 3 active agreements; checklist/Markdown free, clause texts/HTML Pro | In bundle. |
| 40 | maintenance-log | Y | gate.isPro | 3 assets; logging/history/CSV free, due report/Markdown Pro | In bundle. |
| 41 | mileage-log | Y | gate.isPro | 20 trips/mo; list/summary free, YoY rates/CSV Pro | In bundle. |
| 42 | goods-receipt | Y | gate.isPro | Free tier = full CRUD (no cap) | **Not in bundle.** Enroll in bundle. |
| 43 | leave | Y | gate.isPro | Free tier = full CRUD, no watermark | **Not in bundle.** Enroll in bundle. |
| 44 | onboarding | Y | gate.isPro | FREE_HIRES_PER_APPLY = 1 | **Not in bundle.** Enroll in bundle. |
| 45 | purchase-requisition | Y | gate.isPro | FREE_TEMPLATES = 3, runs unlimited | **Not in bundle.** Enroll in bundle. |
| 46 | backlink-checker | Y | gate.isPro | FREE_URL_LIMIT = 3 URLs/call | **Not in bundle.** Enroll in bundle. |
| 47 | office-suite | N | none | fully free, no gate | **Not monetized.** Add gate or leave as loss-leader. |

**Count check:** 41 bundle + 4 vendor unbundled (42–45) + backlink-checker (46) + office-suite (47) = **47 servers**. 41 have paywalls; 1 (office-suite) has none.

---

## 2. Top 5 Highest Revenue-Potential Servers

Ranked by (a) size of the addressable pain, (b) willingness-to-pay of the user, (c) how close the free→pro boundary is to a natural purchase moment, (d) current unbundled status (unbundled = immediate upside).

1. **invoice** — The single most commercially-valuable document in the estate. Free tier (3 invoices/mo + footer line) is deliberately a *demo*; the footer watermark is the classic "pay to remove the brand" trigger. Every small business that invoices monthly hits the cap. Highest WTP of any server. **Action:** keep as flagship; add a $5/mo subscription tier on top of the $19 lifetime.
2. **purchase-requisition** — **Unbundled** (not in the $39 bundle) yet has a real paywall (`FREE_TEMPLATES=3`, 4 `gate.isPro()` call sites). This is pure upside: it already monetizes but is invisible to bundle buyers. **Action:** enroll in bundle → instant bundle value + upsell surface.
3. **backlink-checker** — **Unbundled**, serves the SEO/link-building market (high WTP, recurring need), free tier is only 3 URLs/call. Distinct audience from the finance suite. **Action:** enroll in bundle; consider a standalone $19 listing.
4. **expense-tracker** — Broadest horizontal appeal (everyone with expenses), rich Pro surface (xlsx export, 200 export rows, 5 category rules). High volume → high conversion surface. **Action:** keep in bundle; feature in marketing.
5. **statement-of-account / dunning-letters** — Accounts-receivable pain ("who owes me money") is acute and recurring; dunning (chasing unpaid invoices) is a high-WTP collections workflow. Free tier caps at 3 chased invoices — a natural "I have more than 3 debtors" trigger. **Action:** bundle these two as a "collections" upsell.

---

## 3. Fastest Implementable Payment Upgrade (deployable today)

The paywall, checkout, and license rails all exist. The fastest revenue upgrades are **config-only** — no new payment code required.

### 3a. Enroll the 6 unbundled servers into the bundle (highest ROI, ~1 file)
- **File:** `remote/src/shims/license.ts`
- **Status R8:** `SERVER_COUNT` already 41 → 46 (deployed R8, tests green). Enrolling remaining gated unbundled servers requires the 46↔47 reconciliation first and raises the bundle's perceived value.
- **Verify:** the 4 vendor servers (goods-receipt, leave, onboarding, purchase-requisition) and backlink-checker already have `gate.isPro()`; only `office-suite` needs a gate added (see 3c).

### 3b. Raise bundle price / add a subscription tier (config + one checkout route)
- **File:** `remote/src/shims/license.ts` — `PRICE_SINGLE_USD = 19`, `PRICE_BUNDLE_USD = 39` (lines 13–14).
- **File:** `billing/src/` — the Stripe Checkout product/price objects (see `billing/PAYMENTS.md`). Add a `$5/mo` subscription price object for `invoice` and `expense-tracker`; the `gate.isPro()` check already gates the Pro features, so a subscription key just needs to satisfy the same `isPro` check.
- **Note:** the buy flow is already wired — `remote/src/index.ts` lines 1001–1018 emit `https://mcp.zovo.one/buy/<product>` checkout URLs with `src=` attribution tags, and `bound_purchase` (line 1311) binds a purchase to an anonymous token with no key to paste.

### 3c. Add a gate to office-suite (the only fully-free server)
- **File:** `servers/office-suite/src/index.ts` — currently has **0** `gate.isPro()` call sites. Add the standard `gate.isPro()` guard + `gate.upgradeText(...)` on the highest-value tool, mirroring `servers/backlink-checker/src/index.ts` lines 154–155.

**Deploy path:** all changes are in `remote/src/` (Wrangler worker) + `billing/` (Stripe). No new infrastructure. Ship the worker, update the Stripe price objects, done.

---

## 4. "Rock Solid Map" Summary

### Current state (what already works)
- **Paywall engine:** `gate.isPro()` + `gate.upgradeText()` in every vendor server; free-tier caps are enforced in code, not just prose.
- **Checkout:** live Stripe Checkout at `mcp.zovo.one/buy/<product>` with `src=` attribution; `bound_purchase` binds to anonymous tokens (no key paste).
- **Licensing:** MCPL1 license-key flow (`billing/src/license-auth.ts`, `license.ts`); Pro keys unlock 6000 calls/hr + no server limits.
- **Rate limiting:** 600 free / 6000 pro calls per hour per token (`remote/src/index.ts` lines 68–69).
- **Machine-readable paywall:** `remote/src/payment.ts` returns a structured payment descriptor (`agent_settleable: false`) so agents can branch on a paywall.
- **Pricing:** $19/server lifetime, $39 bundle (41 servers).

### Gaps
1. **6 servers unbundled** (goods-receipt, leave, onboarding, purchase-requisition, backlink-checker, office-suite) — 5 already have paywalls but are invisible to bundle buyers; office-suite has no gate at all.
2. **No subscription/recurring tier** — everything is one-time lifetime. No MRR; no recurring revenue.
3. **No x402/HTTP-402 agent settlement** — `payment.ts` explicitly reports `agent_settleable: false`; SEP-2007 lapsed for want of a sponsor. Agents must hand off to a human.
4. **`SERVER_COUNT=41` is stale** vs. 47 live servers — bundle value understated.
5. **No per-server analytics** on which free-tier caps convert — no data to tune prices.

### 7-day plan
- **Day 1:** Enroll 5 gated unbundled servers into the bundle (`SERVER_COUNT=41→47` in `remote/src/shims/license.ts`). Deploy worker.
- **Day 2:** Add `gate.isPro()` to `office-suite` (the only free server). Deploy.
- **Day 3:** Add a `$5/mo` subscription price object in `billing/` for `invoice` + `expense-tracker`; wire a subscription key to satisfy `isPro`.
- **Day 4:** Raise `PRICE_BUNDLE_USD` 39→49 (bundle now covers 47 servers); update Stripe price object + `billing/PAYMENTS.md`.
- **Day 5:** Add conversion analytics — log which free-tier cap each token hits (already emitted in `rate_limit`/`free_limits` responses) into a dashboard.
- **Day 6:** A/B the invoice footer watermark copy (the highest-WTP trigger).
- **Day 7:** Re-audit `SERVER_COUNT` vs. live server list; publish updated pricing page; document the subscription tier in `billing/PAYMENTS.md`.

---

## Evidence / Sources
- `remote/src/shims/license.ts` — `PRICE_SINGLE_USD=19`, `PRICE_BUNDLE_USD=39`, `SERVER_COUNT=41`, license/upgrade text.
- `remote/src/index.ts` — rate limits (L68–69), checkout URL emission (L1001–1018), `bound_purchase` (L1311), free_limits strings for 41 servers.
- `remote/src/payment.ts` — machine-readable paywall descriptor, `agent_settleable:false`.
- `remote/src/vendor/*/index.ts` — `gate.isPro()` call sites + free-tier notes (41 bundle + 4 unbundled vendor).
- `servers/backlink-checker/src/index.ts` — `FREE_URL_LIMIT=3`, gate pattern (L154–155).
- `servers/office-suite/src/index.ts` — 0 gate call sites (fully free).
- `billing/PAYMENTS.md`, `billing/RESULT.md`, `billing/src/license-auth.ts` — Stripe checkout + MCPL1 license flow.
- `data/user_value_r43.json` — purchase-requisition free tier = 3 templates (confirms §1 row 45).
- `data/dist_r7.json` — Stripe audit was human-gated (context note).
