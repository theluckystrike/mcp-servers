# Plan v24 (2026-09-06, loop 27): a catalogue, the version scan in the checker, the key still restricted

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 4,581 | +150 in two hours |
| Clicks 7d | 138, three bundle-sourced | Steady |
| Sales | 0 | 54 human sessions in the last hundred, none paid |
| Stripe key | still restricted, no product write | Work-order checkout stays a named gap; a second server joins it this loop |
| PRs | four list PRs open, no comments; GitHub GraphQL 503 on the Docker check | Wait |
| GSC | key dataless | Unmeasurable |
| Load | 18 | Three agents |

## Top 5, ranked by impact x autonomy
1. Build `catalogue`: SKUs with prices per currency and tier and valid-from dates, a labour rate card, quote and invoice lines resolved by SKU (a payload the quotes and invoice servers accept), price-list text and PDF; registry names price-list and rate-card. Audit, wire (PENDING_HUMAN price, named gap), host, content, catalogs, release v0.19.0.
2. Release-check gains a per-server `dist-version` check: dist/version.js must equal src/version.ts, so a stale build is caught before the bundle step, not by it.
3. Hosted round 36 single-lane on work-order.
4. Intel round 13: 30 fresh tokens.
5. Maintenance-log stays on the list; the Stripe key stays human-gated (docs/HUMAN_GATED_PACK.md).
