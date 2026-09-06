# Plan v26 (2026-09-06, loop 29): delivery-schedule, a hosted round on change-order, intel round 14

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 4,772 | +178 in two hours, the fastest two hours so far |
| Clicks 7d | 152 | Steady; 68 human sessions in the last hundred, none paid |
| Sales | 0 | Stripe key still restricted; three checkouts answer 503 |
| Registry | 82 names at 0.20.0 | Findable share 50% |
| Validate | 951/951 | Green |
| Tests | 1507 pass, 0 fail, 11 skipped | Green |
| Round 39 | 11/18 on change-order, server clean | Four client classes; two server mitigations shipped (D-R101, D-R102) |
| GSC | key dataless | Unmeasurable |
| Load | 8-12 | Two or three agents |

## Top 5, ranked by impact x autonomy
1. Build `delivery-schedule` (INTEL_R13 second slot, score 55.25, count 0): dated deliverables against a quote, work-order or change-order reference, each with a due date, a status (planned, in progress, delivered, accepted, late), a delivered date and an acceptance note; a schedule report with what is late as of a date; an invoice-ready milestone payload for delivered-and-accepted items in both scales through the same 100x seam. Checklist-first docs.
2. Wire (DIST_R24 in the DIST_R23 shape) and host (Extension 22) delivery-schedule; audit 18 items; a stdio user-value round so the /s page gets its measured prompt before the billing test sees it.
3. Hosted user-value round 40 on change-order: one undated question, the gross-value trap with the new values_are field, the netting pressure prompt, the Pro refusal relayed as fact.
4. Intel round 14: 30 fresh tokens against the registry, scored the R13 way, to keep the slot list ahead of the builds.
5. Release v0.21.0 by hand in bounded steps at the end; the registry JWT expires within one publish loop, so re-login before the loop and again before any retry batch.

## Not this loop
Stripe key, branding and tax (human). npm login (human). Naming rounds (ceiling measured). Paid listings (never).
