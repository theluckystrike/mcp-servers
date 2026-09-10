# mcp-servers

Read `CONVENTIONS.md` first. It is the build contract: stack, package naming, tool
registration, storage, licensing. This file is the operating knowledge that is not in the
code and that has been expensive to learn.

## What this project is, stated honestly

32 local-first MCP servers for freelance and small-business paperwork, 30 of them also hosted
at `https://mcp.zovo.one/mcp/<server>`, sold at 19 dollars for one and 39 for the set. The
engineering is in good shape: root `npm test` is green, live validation runs 951 checks, and
the estate has real honesty gates. **Revenue to date is zero and the audience is about ten
humans per fortnight.** Audience is the binding constraint by two orders of magnitude, and
every plan should be judged against that and nothing else.

## The one number that matters

**Named by a blind assistant: 0 of 18.** A subagent with no knowledge of this estate is given
18 frozen buyer-intent questions from `data/blind_questions.json`, researches each with web
search, and names the server it would recommend. It named 47 servers and none were ours.

Procedure in `docs/BLIND_RECOMMENDATION_PROCEDURE.md`. It must be run by a FRESH agent that
has never seen this repo, or it degenerates into checking whether the site exists.

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
10. **npm is human-gated**, proven not assumed: OIDC returns `ENEEDAUTH` because npmjs.com
    requires a package to exist before trusted publishing can be enabled on it.

## Rules

No emoji anywhere. No paid APIs, listings, featured slots or paid reviews. No account
creation or browser sign-in; record those as human-gated with the exact URL and stop. Every
number in a report carries the command that produced it. A 200 is not evidence. Run a
positive control before believing a zero.
