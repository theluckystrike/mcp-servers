# Audience reality check, loop 29 (2026-09-07)

Written by the orchestrator. Every number names the command that produced it.

## Verdict

This project is not conversion-poor. It is audience-poor, by roughly two orders of
magnitude. The dashboard's strongest "met" KPI, 5,105 bundle downloads against a target
of 1,000, does not survive inspection. The real human audience over the last 14 days is
about 22 unique visitors.

## Evidence 1: the download metric is machine traffic

`gh api --paginate repos/theluckystrike/mcp-servers/releases` over 597 release assets:

| Statistic | Value |
|---|---|
| Assets | 597 |
| Total recorded downloads | 5,314 |
| Mean per asset | 8.90 |
| Median | 8 |
| p10 / p50 / p90 / p99 | 6 / 8 / 11 / 28 |
| Coefficient of variation | 0.417 |
| Share held by the top 10 assets | 5.7% |

On the newest release v0.20.0, 30 of its 31 assets sit between 6 and 13 downloads, with a
single outlier at 50.

Human product demand is a power law: one or two products take most of the volume and the
long tail takes almost none. A distribution where the top 10 of 597 assets hold 5.7
percent, and where obsolete releases score the same per asset as the current one, is a
uniform sweep. Something automated is downloading every asset of every release a handful
of times each. Nothing in this repo downloads its own assets: `scripts/measure.mjs` only
reads `download_count` through the API and no script calls `gh release download`, so this
is external machine traffic, not self-inflicted.

## Evidence 2: the direct human numbers

| Metric | Value | Command |
|---|---|---|
| Repo views, 14d | 44 | `gh api repos/theluckystrike/mcp-servers/traffic/views` |
| Repo unique visitors, 14d | 22 | same |
| Stars / forks / watchers | 0 / 0 / 0 | `gh api repos/theluckystrike/mcp-servers` |
| Repo clones, 14d | 1,553 from 268 uniques | `gh api .../traffic/clones` |
| Top referrer | registry.modelcontextprotocol.io, 19 views from 9 uniques | `gh api .../traffic/popular/referrers` |
| Second referrer | github.com, 1 view from 1 unique | same |
| A per-server mirror repo, mcp-invoice, 14d | 1 view from 1 unique | `gh api repos/theluckystrike/mcp-invoice/traffic/views` |

The repo was created 2026-09-02. 1,553 clones from 268 uniques in 14 days is scanner and
mirror traffic, not developers; a human does not clone a repo six times.

The 31 per-server mirror repos were built to win the GitHub name-search axis. The one
sampled has had a single visitor. That axis has not paid yet.

## Evidence 3: indexation is not technically blocked

Served robots.txt allows all agents and carries the sitemap line. Googlebot, ClaudeBot and
GPTBot each receive HTTP 200 and an identical 31,089 byte page on /s/invoice, of which
20,101 characters are real visible text. Cloudflare injects its JS-detections script but
does not challenge these agents. So the pages can be crawled. The problem is that almost
nothing links to them and no search engine has been told they exist.

## What follows from this

1. Supply is not the constraint. Thirty servers, 83 registry manifests, 312 pages and 28
   working checkouts are already more product than 22 visitors can consume. Building
   server 31 does not change the binding constraint.
2. The one channel that demonstrably delivers humans is the official MCP registry, which
   sent 9 of the 22. Everything that raises registry placement or click-through is worth
   more per hour than anything that adds catalogue depth.
3. Getting the 312 pages into a search index at all is the cheapest untapped lever, which
   is why IndexNow was set up this loop.
4. The install command printed on all 312 pages, `npx -y @theluckystrike/mcp-<name>`,
   returns E404 because nothing was ever published to npm. Of the small number of humans
   who do arrive, the ones who try the documented path fail. Fixing that is worth more
   than any new listing.

## Correction to the KPI set

"Bundle downloads (all releases)" should not be reported as an install metric. It should
be renamed to something like "release asset fetches, mostly automated" and given a target
of none, or replaced with GitHub unique visitors, which is a real number and is 22.
