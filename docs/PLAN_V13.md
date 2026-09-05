# Plan v13 (2026-09-05, loop 16): the first five minutes

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 1,932 (+92 in an hour) | Catalog pull accelerating |
| Clicks 7d | 24, no new source since the bundle page went live | Home page clicks stopped; the store.home 15 came in one burst |
| Sales | 0 | Every buyer who clicked saw a generic Stripe page; branding is human-gated |
| GSC | home still "discovered, not indexed", never crawled | Wait |
| Load | 5 | Five agents safe |

## Top 5, ranked by impact x autonomy
1. Round 16 as three single-lane agents (timezone, bank-statement, expense-tracker), per-prompt disk writes, 240 s per prompt. Pass: scores vs round 15 and 13.
2. "First five minutes" per server: a /s/<id>/start page (or a section on the s-page) with three copy-paste prompts taken verbatim from the highest-scoring hosted round for that server, the expected answer shape, and what the free tier covers; generated from data/user_value_r*.json by build-pages so it cannot invent prompts. Pass: 19 pages live, every prompt traceable to a round file.
3. Office-suite path: a guide and setup pages for the one-install bundle measured in round 17 (186 tools, 83 percent reach), naming the two prefixed tools and the cross-server prompts that worked. Pass: live, IndexNow.
4. Click instrument: distinguish which home CTA was clicked (hero, table row, footer) via src=store.home.<slot>; verify /bundle has its own row. Pass: /stats/clicks shows slots after a test click tagged audit.
5. Docker PR: read the one comment; act if it is a reviewer request.
Release v0.9.5 only if server sources change.
