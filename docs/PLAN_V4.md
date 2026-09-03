# Plan v4 (2026-09-03, loop 7): expand and improve

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 556 (343 six hours ago) | Growth continues without GitHub views; catalog-driven |
| Anonymous hosted tenants with data | 19 tokens, 121 tenant docs; anonymous docs: time-tracker 8, invoice 3, then one each | Strangers use time tracking and invoicing first |
| Next empty slots (data/intel_r4.json) | image resize 116, calendar ics reader 77, pdf merge/split 52 | Calendar and PDF pair with the suite; image tools do not |
| Paid | 0 | Unchanged; binding path is live since loop 6 |

## Sprint
1. Build `calendar` (ics reader and writer: parse .ics files and feeds, list events, free-busy, conflicts against the timezone server's contacts, export selected events, no network except an explicit URL). Pairs with timezone and time-tracker.
2. Build `pdf` (merge, split, page ranges, rotate, stamp text such as PAID or DRAFT, extract text, page count, on pdf-lib, pure JS). Pairs with invoice, docx, resume.
3. Round 10 through the hosted connect-by-URL path with a fresh anonymous token, the way a claude.ai user would arrive: onboarding, hours, invoice, proposal, meeting, cap hit and the upgrade link. Fix hosted-specific seams.
4. Distribution status and re-measure: registry re-probe of the nine tokens the outage blocked, Docker and Cline status, Search Console coverage, IndexNow for variant-related pages.
5. Stripe products, storefront, facts, validation probes, bundles, mirrors, registry entries, hosting for the two new servers; release v0.5.0.
Pass conditions: both servers audited (adversarial plus client scenarios) before release; validation database green with probes for both; dashboard updated.
