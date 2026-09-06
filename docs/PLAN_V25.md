# Plan v25 (2026-09-06, loop 28): change-order, a hosted round on catalogue, the key still restricted

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 4,594 | +13 since the v0.19.0 cut two hours ago |
| Clicks 7d | 147 | Steady |
| Sales | 0 | 62 human sessions in the last hundred, none paid |
| Stripe key | still restricted, no product write | Work-order and catalogue checkouts stay named gaps; a third joins them |
| Registry | 79 names at 0.19.0 published; by-name verify running | Findable share 50% |
| Validate | 902/902 | Green |
| Tests | 1455 pass, 0 fail, 11 skipped | Green |
| GSC | key dataless | Unmeasurable |
| Load | 14-19 | Two agents at most |

## Top 5, ranked by impact x autonomy
1. Build `change-order` (INTEL_R13 top slot, score 68, count 0): variations against a quote or work-order (added, removed, changed lines with a reason and a date), running contract value, client approval state, an invoice-ready delta payload built through the same 100x scale seam as catalogue. Checklist-first docs so a killed agent can resume.
2. Wire change-order into the estate from the DIST_R22 checklist shape (office-suite, build-mcpb, mirrors, pages, facts, tools, distribution, setup, guide, validator probe, GIF, logo, Docker fork, Cline issue). Price literal PENDING_HUMAN, /buy 503.
3. Host change-order on the remote worker (Extension 21) with LIB_RESOLUTIONS checked over every vendored file.
4. Hosted user-value round on catalogue (round 38): the undated-question miss from round 37 gets one prompt with no date and the check that the client reads the in_force block.
5. Adversarial audit of change-order (18 items) before the cut.

Release v0.20.0 by hand in bounded steps at the end. Registry: re-login first (`mcp-publisher login github -token "$(gh auth token)"`), probe one manifest, then the loop.

## Not this loop
Stripe key, branding and tax (human). npm login (human). Naming rounds (ceiling measured). Paid listings (never).
