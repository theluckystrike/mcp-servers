# mcp-servers

Read `CONVENTIONS.md` first. It is the build contract: stack, package naming, tool
registration, storage, licensing. This file is the operating knowledge that is not in the
code and that has been expensive to learn.

## What this project is, stated honestly

Current audit (2026-10-26, R38): 58 listed server directories/pages, 49 paid singles, 46 hosted servers and 50 children in the local Office proxy. Office exposes 453 measured tools; 51 of 58 listed builds initialize and seven older free builds are still missing. The supplier standalone gate passes 29/29 without gaps; the wider estate remains red in older metadata/version assertions and missing builds. Do not describe the full estate as release-green. Prices remain $19 single/$39 bundle.

Supplier Statement Check and Office are published at v0.25.0; anonymous archive downloads match the exact tested bytes. Existing product archive versions and tags are immutable. The new supplier workflow is local stdio only, has 8 tools, and compares explicitly supplied open items without balances, payments, PDF/OCR or ERP access. All diagnostics/evidence/CSV stay free; Pro removes only the three-saved-report cap. A same-engine browser task is linked from the product/guide; the two-CSV site iteration is live and passes 22 actual production Chrome groups. Full Office standalone dependency closure is 50 children/453 tools, verified on clean CI and public mirrors.

Fresh completed-history MCP Stripe Checkout gross is $0 with 0 paid matches and 186 paid shared-account positive controls. The rolling 28-day window has 4 untagged Sessions/0 paid; seven days has 0 untagged Sessions. Tagged operator probes are excluded. Finalized GSC Sep 26-Oct 23 has 38 impressions/0 clicks; hosted counters record 19 unmarked successful responses, 7 first token/server/day observations and 0 handoffs. None is people or proven ROI. See `intel/R38-kpi.md`,`data/r38_kpi_audit.json` and the separate completed closing snapshot `data/r38_kpi_final_audit.json`. The old R7 $38 sales claim was unrelated $4.99 subscriptions, not MCP sales.

Hosted readers and billing were deployed in that order through a staged configuration comparison and the supported billing gate. Actual edge probes retain two singles and bundle access across old-key replay; independent bindings follow signed license validity, while anonymous token/data retention still applies. Already-lost purchases require valid-key reactivation; missing history is not reconstructed. Real paid fulfillment and inbox delivery remain untested. Resend is connected and zovo.one can send; the local research queue has no eligible email contacts and no outreach was sent. Further access needs are in `docs/OUTREACH_RESEND_SETUP.md`.

The original R38 observation deadline is 2026-10-26T09:11:29.917Z. Do not reset it after a restart. The loop finished at 09:11:34 UTC with 48 samples and passing final checks. A confirmed process gap is recorded in `data/r38_watch.json`; actual PID liveness, not a statefile, establishes an active watch. Source, exact archives, live behavior, platform publication and commercial results have separate receipts in `intel/R38-session.md`. Use `/Users/mike/bin/buildslot` with the user's 20 GB floor and bounded wait; its path is not on this shell's default PATH. npm uses `npm_config_cache=/Users/mike/.npm-cache-local`. npm is logged in as theluckystrike since 2026-10-30 (61 of 68 packages live, see below); Smithery is unauthenticated; no newly created account or fabricated install route is claimed.


## Prior revenue review, 2026-10-17

At that checkpoint the owner-facing dashboard led with `data/revenue_review.json` and `intel/REVENUE-REVIEW-2026-10-17.md`. Fresh native API evidence is `data/revenue_audit_2026-10-17.json`: complete28-day window has31 untagged MCP Checkout Sessions/0 paid; all182 available completed records contain0 MCP paid matches by exact host, current known prices or product metadata. The old R7 $38 attribution is corrected: those two records are$4.99 subscriptions on zovo.one, not MCP purchases. GSC's finalized28-date window still has34 impressions/0 clicks; fresh inspection finds the two focus products discovered but not indexed. The paid-value hypothesis and proposed buyer-trial thresholds are explicitly unvalidated. No outreach or production changes were made by this review.

## Blind recommendation measurement

Use the 18 frozen buyer-intent questions from `data/blind_questions.json` with a fresh unprimed agent, following `docs/BLIND_RECOMMENDATION_PROCEDURE.md`. R8 (2026-10-16) named an estate server in 9/18 answers, six first-listed; conditional/companion recommendations count. Raw host URLs appeared in 15/18. This is a single documentary search trial, not runtime testing, buyer conversion, or a causal estimate of this sprint's changes. R7's `named_by_blind_assistant:12` meant any credible server, not 12 estate recommendations; do not compare that field directly. Full evidence: `docs/BLIND_RECOMMENDATION_R8.md`.

## Where recommendations actually come from

Measured 2026-09-10, `docs/RECOMMENDATION_SOURCES_R1.md`. Across every URL the blind
instrument cited: github.com 21, glama.ai 7, ours 4, apify.com 4, mcpservers.org 3, and
**registry.modelcontextprotocol.io zero**.

- 20 of the 21 GitHub citations are individual one-server repositories, one is an
  awesome-list. The 32 mirror repos are the primary distribution asset, not a side channel.
- 6 of 7 Glama citations are `/mcp/servers/<owner>/<repo>`; none are `/mcp/connectors/`,
  where we hold 25 listings. Being scored is not being read.
- The official registry's job is as an UPSTREAM that `api.mcp.github.com` and Glama consume.
  It is not a destination anyone reads. Do not spend another round on registry ranking.

## What ranks on GitHub, split by field size

Measured 2026-09-11, `docs/GH_SEARCH_R2.md`. Repository search reads name, description and
topics only, and query-term coverage is the gate ON SMALL FIELDS. Split by field size:

- **Small fields, 14 to 91 results.** Stars do not gate. Rank-one median is 7.5 stars and 6 of
  18 have zero. Coverage wins, and it did: 22 to 32 of 34 queries surfacing, 15 at rank one.
- **Contested fields, median 648 results.** Rank-one median is **998 stars and none has zero**.
  The `mcp-<capability>` naming hypothesis is REFUTED as stated: our mean name-term coverage is
0.64 against 0.38 for the repositories beating us. Do not rename the fleet.

Open, at n=2 and not acted on: on the two smallest fields the winners carry the FULL query
phrase in the repo name at zero stars while we sit at 0.50. And `mcp-currency` has every term
of `mcp currency converter`, is freshly reindexed, and is still absent from a 35-result top
ten, so coverage is necessary and provably not sufficient.

stop fighting contested queries, keep winning small-field ones,
and make more uncontested questions exist. That is the same answer the blind recommendation
test reaches from the other direction.

## Traps that have each cost a loop

1. **The advertised hosted URL was missing its prerequisite.** `/mcp/<server>` needs a token.
   It answers `initialize` and `tools/list` with 200, deliberately, so directory health probes
   do not mark it down, and refuses every `tools/call` without one. A token works as an
   `Authorization: Bearer` header or in the `/mcp/<server>/t/<token>` path form, and is minted
   at `/mcp/connect`. It was advertised as the zero-install paste-a-URL path on 30 product
   pages and 31 llms.txt lines without saying any of that, and the client that needs a
   paste-a-URL path is exactly the client that cannot set a header. It looked healthy to every
   automated check. **The shipping test for a hosted endpoint is a real `tools/call` through
   the exact URL the marketing prints, carrying only what the page tells a reader to have.**
   Discovery succeeding is not the product working. Note `/mcp/connect` enforces 10 mints per
   IP per hour; exhausting it yields an EMPTY token, which then reads as a spurious 401.
2. **Tool descriptions are a build input.** `remote/build-vendor.mjs` applies about 113 exact
   string patches and throws on a miss. Before editing any description, run
   `/usr/bin/grep -n '<server> <tool> description' remote/build-vendor.mjs`, update both
   sides, and make `node remote/build-vendor.mjs` exiting cleanly part of verification.
3. **`grep` is a shell function here and silently returns nothing.** Always `/usr/bin/grep`.
   And `grep -c` counts LINES: a one-line sitemap with 154 URLs reports 1. Use `grep -o | wc -l`.
4. **The humanize scanner is iCloud-evicted and exits 0 printing nothing**, so it passes
   deliberately terrible text. The rules survive at `~/humanize-durable/HUMANIZE.md`. Always
   control-test a gate with a known-bad input before trusting a pass.
5. **Never quote release `download_count` as installs.** Across 597 assets the distribution is
   near-uniform (mean 8.90, CV 0.417). That is machine sweeping. Human demand is a power law.
6. **Never quote the `/buy/` click counter as demand.** The v1 guard was start-anchored and
   counted our own probes and crawlers. A v2 counter exists; v1 is kept under `legacy`.
7. **A caller-supplied path passed to `mkdirSync({recursive:true})` livelocks forever** on
   Linux under `/proc`, `/sys` and `/dev`. Use the bounded ancestor walk the fixed servers use.
8. **Validate only when nothing is deploying.** A `wrangler deploy` landing mid-run makes a
   stateful sequence fail against a different worker version. Re-run before believing it.
9. **The registry binds one hosted URL to exactly one server name**, so a hosted server cannot
   be published under two namespaces and there is no A/B test. `(name, version)` is immutable.
10. **npm publishing needs a per-publish 2FA approval.** Since 2026-10-30, 61 of 68 packages are live
    (52 estate packages plus 9 satellites). The 7 unbuilt servers (budget, loan-calculator, payroll, pomodoro, receipts,
    stripe-billing, tax-calc) are skipped on purpose, and `publish-all.sh --go` refuses any package without dist/.
    The account requires 2FA on every publish, and npm runs its web 2FA flow only on a TTY, so the scripts wrap
    each `npm publish` in `script -a -q "$NPM_TTY_LOG"` with `npm_config_browser=false`. Watch that log for
    `https://www.npmjs.com/auth/cli/<id>` and open each URL for the owner. Each approval link expires after about
    5 minutes (`404 .../-/v1/done`). The registry lags a few minutes after `+ name@ver`, so a direct
    `npm view` right after publishing reports a false FAILED; recheck later. Registry state is in
    data/s1030/npm-registry-check.tsv.

## Rules

No emoji anywhere. No paid APIs, listings, featured slots or paid reviews. No account
creation or browser sign-in; record those as human-gated with the exact URL and stop. Every
number in a report carries the command that produced it. A 200 is not evidence. Run a
positive control before believing a zero.
