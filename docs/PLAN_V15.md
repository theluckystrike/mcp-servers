# Plan v15 (2026-09-05, loop 18): the twentieth server

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 2,153 | Past two thousand in four days |
| Clicks 7d | 32; barcode, calendar, docx, pdf, price-tracker caps now clicked; first slotted home click (currency) | Cap messages convert attention across nine servers; still no payment |
| Sales | 0 | Stripe branding still generic |
| GSC | home discovered, never crawled | Wait |
| Empty slots | credit-note 0, purchase-order 0, deposit 0, asset-register 0, per-diem 0 | Build the pair that shares the invoice engine |
| Load | 23 (another session's Chromium) | Two agents now, more when it drops |

## Top 5, ranked by impact x autonomy
1. Build `billing-docs`: credit notes against an invoice (full or partial, per line or amount, negative totals in minor units, CN-YYYY-NNNN), purchase orders (buyer is the profile, supplier is a client record, PO-YYYY-NNNN, accept converts to a bill record), PDF via the invoice renderer, text export, shared profile, free 5 documents a month. Audit, wire, host, content, catalogs, Stripe product, registry names credit-note and purchase-order, release v0.10.0.
2. Hosted round 19 on billing-docs with invoice on the same token.
3. Single-entry list PRs: find lists that accept one entry per PR (TensorBlock style) and submit the bundle.
4. Deposit tracker as the second candidate only if load allows and after billing-docs ships.
5. Click follow-through: the nine cap sources now clicked get a one-line price and bundle mention in their messages if missing (check the codemod output).
