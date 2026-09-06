# Plan v23 (2026-09-06, loop 26): job orders, the test count in the chain, a paid session still missing

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 4,402 | +150 in two hours |
| Clicks 7d | 116, two bundle-sourced | 54 human checkout sessions in the last hundred, zero paid |
| Sales | 0 | The Stripe page is still generic; that is human-gated |
| PRs | Docker and four list PRs open, no comments | Wait |
| GSC | key dataless | Unmeasurable |
| Load | 8 | Three agents |

## Top 5, ranked by impact x autonomy
1. Build `work-order`: job orders with parts and labour lines, status flow (draft, scheduled, in progress, done, invoiced), a completion report as text and PDF via the invoice renderer, an invoice_create-ready payload; registry names work-order and job-card. Audit, wire, host, content, catalogs, release v0.18.0.
2. data/tests.json written by scripts/build-mcpb.sh from the test run it already requires, so the unit-test KPI never depends on the orchestrator writing it by hand.
3. Hosted round 34 single-lane on petty-cash.
4. Price-list and rate-card: decide next loop from the intel with the overlap measured against quotes and invoice line items.
5. The first paid session: nothing to build; the Stripe branding and tax registration remain in docs/HUMAN_GATED_PACK.md.
