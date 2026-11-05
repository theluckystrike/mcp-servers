# s1103 canclaude2 (www.mcpstamp.com /can-claude/ wave 2)

14 new /can-claude/ pages, live 2026-11-03, same template as wave 1 (honest answer first, Claude alone vs with server, a real tools/call run today with its actual output, copy-paste setup, link to /free-servers/<repo>/ or /servers/<id>/):
cups to grams, DSCR, take-home pay (US), UK take-home 2026/27, ACA premium tax credit 2026, recipe nutrition, 2026 AP score distributions, Section 179, car loan interest deduction, subdomains, A/B test sample size, RAP student loan, time in another time zone (catalog timezone server), currency at today's rate (catalog currency server).

## Selection
- (a) 11 satellites from the brief list plus student-loan RAP. Federal holidays already covered (count-business-days). Next wave: estate-gift-tax, uk-ssp-smp.
- (b) timezone kept (kpi.md: 562 npm downloads, 11-01 at 7.7x floor); Claude has no clock, DST gap example. invoice and quotes skipped: Claude can draft both alone, so no honest "can't alone" answer. license is not hosted.
- (c) GSC sc-domain:mcpstamp.com 2026-10-06..11-03, dataState all (canclaude2/gsc_q.py, gsc_q2.py): 83 impressions on 37 query/page rows, 0 clicks in those rows; daily 6, 49, 72, 84 for 10-30..11-02. Only intent with no page: "ecb calculator" (6 impr, pos 31.5), mapped to the currency page.

## Evidence
- 26 tools/call runs, raw in canclaude2/calls/. Catalog servers called with a free token marked x-mcp-probe: 1, then re-run through the exact printed URL form /mcp/<id>/t/<token> (200 with results).
- Humanize: control bad sample exit 1; 14 pages + index --strict exit 0, 15/15 clean.
- Template: canClaudeLive.ts server_id + tokenRequired; LiveAnswerPage free-token step; /servers/<id>/ links its answers; index copy updated. Build 201 pages.

## Deploy
- Pre-checks: no deploy/build process; only wave-1 files changed under ~/mcpstamp-work in the last 30 min (commit 4452a49 = origin/main = live 4093cc9c); no new remote commits.
- Commit c83a09c on theluckystrike/mcp-showcase-site (1 push). Deployment 15f770ce-8ebd-47cd-8508-e9b7dec89cf7, previous 4093cc9c-dc8b-46fa-b267-06dd2187a8e9.
- Rollback: `npx wrangler pages deployment rollback 4093cc9c-dc8b-46fa-b267-06dd2187a8e9 --project-name mcp-showcase-preview`
- Live: 14/14 new URLs 200 with H1 and call section; sitemap 191 (was 177); /can-claude/ links 30 answers. IndexNow 200 (17 URLs). GSC sitemap resubmitted (204, 191 submitted).

## RAP fix (follow-up deploy)
- RAP satellite v1.0.1 (worker 4f55cab7). Call re-run, full corrected output now on the page, truncation note removed. FAQ: RAP and the 10-year Standard count toward PSLF, Tiered Standard does not (20 U.S.C. 1087e(m)(1)(A) as amended by P.L. 119-21 sec. 82004).
- Humanize control exit 1, page --strict PASS. Commit 54ed917 (1 push). Deployment d51beea5-6715-4d04-b6ca-2c463c579fcf, previous 15f770ce-8ebd-47cd-8508-e9b7dec89cf7.
- Rollback: `npx wrangler pages deployment rollback 15f770ce-8ebd-47cd-8508-e9b7dec89cf7 --project-name mcp-showcase-preview`
- Live 200 with corrected sentences; old note and "Only RAP counts" gone.

## Two more satellites (follow-up deploy)
- /free-servers/ adds Raw to Cooked Weight and Vegetable Yield Percentage: 27 live (curl). New answers /can-claude/convert-raw-to-cooked-weight/ and /can-claude/calculate-vegetable-yield/, each with 2 real calls run 2026-11-03 against the hosted URL.
- Humanize control exit 1, 6 pages --strict PASS. Commit 0dceb83 (1 push). Deployment 5161b1dd-c9bb-4043-b26b-dbcb3d51e1ef, previous d51beea5-6715-4d04-b6ca-2c463c579fcf.
- Rollback: `npx wrangler pages deployment rollback d51beea5-6715-4d04-b6ca-2c463c579fcf --project-name mcp-showcase-preview`
- Live: 7 URLs 200, sitemap 195. IndexNow 200 (7 URLs). GSC sitemap 204 (195 submitted).
