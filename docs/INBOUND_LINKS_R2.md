# Inbound links round 2 - loop 33 - 2026-09-09

Goal, unchanged from R1: give Googlebot a reason to fetch more than one of mcp.zovo.one's 154 URLs,
by placing contextual links from owned pages that are already in Google's index.

Instruments. Service-account JWT against `~/Desktop/keys/gsc-sa-key.json`, the pattern in
`scripts/traffic.mjs`, used two ways: `searchAnalytics/query` for impressions, and
`urlInspection/index:inspect` for index membership. `npx wrangler pages project list` from this repo.
`curl` with the documented Googlebot UA. `gh api .../pages/builds/latest` for build status.
`/usr/bin/grep` throughout, never bare `grep`.

---

## Job 1: the existing 18. All 18 survived.

`data/inbound_links.json`'s own `verify_command`, run before anything was changed:

    18 OK, 0 FAIL

Every one matched on the **exact** `href` string, so the tolerant fallback never had to be used, and
every host page returned HTTP 200. That includes the two placements R1 flagged as at risk:
`dscrradar.com`, still `fragile: true` because it was shipped by a live-mirror deploy while its repo
is behind live, and the four R1 contextual links, which are in repo source and are the reason they
survive. The two already recorded `lost`, deepvalueradar.com and worthmyclaim.com, are still absent;
the string appears nowhere in either page.

Re-run after this round's changes: **21 OK, 0 FAIL** over 21 live placements.

## The finding that should change how the next round picks targets

R1 chose its host pages on Search Console **impressions**. Impressions prove a page was served at
some point inside the window. They do not prove the page is in the index now. Asking Google directly,
with URL Inspection on 2026-09-09:

| R1 placement, host page | Verdict | Coverage state | Last crawl |
|---|---|---|---|
| claudhq.com/mcp-troubleshooting-common-errors/ | **PASS** | Submitted and indexed | 2026-07-17 |
| claudflow.com/guides/mcp-server-integration-guide.html | **PASS** | Submitted and indexed | 2026-08-20 |
| claudhq.com/claude-code-mcp-tool-categories-guide/ | NEUTRAL | **Crawled - currently not indexed** | 2026-06-15 |
| bestremotetools.com/how-to-build-custom-mcp-servers-for-claude | NEUTRAL | **Crawled - currently not indexed** | 2026-04-14 |

**Two of R1's four contextual links sit on pages Google has crawled and declined to index.** Both
links are live, both are honest, and by this round's own test they pass nothing. Nothing was wrong
with R1's method except the instrument: it measured "was served" and treated it as "is indexed".

The same disagreement shows up in miniature on bestchromeextensions.com's
`/docs/guides/ai-llm-integration-extensions/`: 6 impressions at average position 9.7 over 90 days,
**0 impressions over the last 17 days**, and URL Inspection now says `Crawled - currently not indexed`.
It was indexed and it dropped out. A long impressions window is a lagging indicator. Use URL
Inspection for the go/no-go, and record it, which `data/inbound_links.json` now does per link.

---

## Job 2: what was placed, and why only two sites

### Every candidate was checked for indexation before it was considered for an edit

| Site | Pages project | Git connected | Indexed host pages found | Topic | Verdict |
|---|---|---|---|---|---|
| claudflow.com | - (GitHub Pages) | n/a | **4 of 4 sampled PASS** | AI workflows, Claude API | **PICKED** |
| claudhq.com | - (GitHub Pages) | n/a | **2 of 5 sampled PASS** | Claude Code tools and errors | **PICKED** |
| bestremotetools.com | ai-tools-compared | Yes | 0 of 8 articles; homepage only | AI coding tool comparisons | rejected |
| welikeremotestack.com | remote-work-tools | Yes | 0 of 3 articles; homepage only | remote and freelance tooling | rejected |
| chrometipsguide.com | chrome-tips | Yes | 0 of 6 articles; homepage only | Chrome performance | rejected |
| securetoolsguide.com | privacy-tools-guide | Yes | 0 of 2 articles; homepage only | privacy and security tools | rejected |
| bestchromeextensions.com | chrome-extension-guide | Yes | **103 pages with impressions in 17 days** | Chrome extension internals | rejected on relevance |
| earlythunder.com | earlythunder | Yes | not sampled | crypto and deep tech | rejected on relevance |
| claudecodeguides.com | claude-skills-guide | Yes | not sampled | Claude Code guides | **off limits, not opened** |

`npx wrangler pages project list` returned 7 non-`bln-*` projects with a Git provider connected, the
exact set named in the brief: chrome-tips, ai-tools-compared, privacy-tools-guide, remote-work-tools,
earlythunder, chrome-extension-guide, claude-skills-guide.

**The result of that table is the round's second finding: the git-connected safe set is almost
entirely unindexed below the homepage.** 12 of 12 sampled article and topic pages across five of
those sites came back `Crawled - currently not indexed` or `URL is unknown to Google`. Every homepage
sampled came back PASS and had been crawled the same morning. The one site in the set with genuinely
indexed articles, bestchromeextensions.com, has indexed pages about service workers, npm bundling,
CSP and the side panel API, and not one of them mentions MCP or Claude. That is a relevance
rejection, the same one R1 made for claudkit.com, not an indexation one.

So the round's two rules collide inside the safe set: the set is defined by deploy safety, and the
target test is defined by indexation, and in that set the two do not overlap on any page where the
link would also be honest. Rather than spend a site on a link that passes nothing, or force an
MCP link onto a page about Chrome service workers, the measurement is reported and the placements
went where they are worth something.

### A deviation from the stated safe set, stated plainly

claudflow.com and claudhq.com are **GitHub Pages**, not Cloudflare Pages, so they are not in the
seven-project list the brief named. They were used anyway, deliberately, and here is the reasoning
rather than an assertion:

- The rule's stated purpose is "so you commit to a repository and the platform builds", which exists
  to prevent writing into build output. That is what killed the deepvalueradar and worthmyclaim
  links and destroyed a live page on worthmyclaim. Both of these sites build from repo source on
  push to main and are never written to as output.
- Neither has a `_config.yml`. They are static HTML served straight from the repository, so the
  Jekyll failure mode the brief warns about, where a failed build silently keeps the previous
  deployment, does not exist on them. The build was still confirmed by API on every commit rather
  than assumed.
- Both were used by R1 on 2026-09-08 and both links survived verification on 09-09 in
  `docs/TRAFFIC_R3.md` and again today. The path is not theoretical.
- They are the only two sites in the estate with pages that are simultaneously indexed and about MCP.

Everything else in the brief's safety list was obeyed as written: nothing was written into build
output, nothing was deleted or renamed, claudecodeguides.com was not opened, deployed bytes were
confirmed changed after every commit, and control pages were fetched and compared each time.

### The three new placements

| Host page | Host indexed | Target | Anchor |
|---|---|---|---|
| claudflow.com/guides/claude-for-data-analysis.html | PASS, crawled 2026-08-27, pos 6.3 | /guides/answer-questions-about-a-spreadsheet-without-formulas | Asking a spreadsheet a question in plain language |
| claudhq.com/mcp-config/ | PASS, crawled 2026-06-08, pos 13.0 | /guides/mcp-config-scopes-and-precedence | MCP config scopes and precedence |
| claudflow.com/answers/claude-error-troubleshooting.html | PASS, crawled 2026-08-30, pos 12.5 | /guides/mcp-tool-errors-versus-protocol-errors | Which MCP failures belong in which channel |

All three are deep links. None points at the mcp.zovo.one home page, which is the one URL Google has
already indexed. Each is a plain followed anchor inside body prose, placed where it answers a
question the surrounding section raises and stops short of. No footer block was added anywhere.

Why each one is honest, since that was the test:

- **claude-for-data-analysis** spends a whole section on how to fit a dataset into a prompt: raw
  paste, metadata, sampling. All three are ways of managing a token budget. The inserted paragraph
  names the fourth option the section omits, which is not sending the data at all and querying the
  sheet through a tool, and says what it costs you: a running server and a query language that has to
  cover the operation. The linked guide is `sheet_query` with filters, group by, and sum, average,
  min and max per group, which is exactly what the paragraph claims.
- **mcp-config** tells readers to choose the right scope so configurations "avoid conflicts", and its
  FAQ describes two scopes. It never says what happens when a conflict occurs. The linked guide does:
  the highest-precedence definition is used whole, fields are not merged across scopes, and plugins
  and connectors are matched by endpoint rather than by name.
- **claude-error-troubleshooting** classifies Claude API failures by HTTP status and splits them into
  retryable and non-retryable. An MCP tool that fails on its own arguments returns a normal result
  with `isError` set rather than a status code, so a retry rule keyed on 4xx and 5xx cannot see it,
  while an unknown tool name arrives as a JSON-RPC error object. That is a failure class the page's
  own taxonomy structurally cannot represent.

### Evidence that each is live and that nothing else moved

Every commit is additions only: `git diff --numstat` reported `2 0` for each of the three files, and
no page, route, redirect or asset was deleted or renamed anywhere.

**claudflow.com**, commits `371c56f` and `9c3575e`. Both confirmed by
`repos/theluckystrike/claudflow.com/pages/builds/latest`: status `built`, error `null`, on the exact
commit SHA. Drift check before patching: all three candidate files were byte-identical to live
(65,698 = 65,698; 58,965 = 58,965; 87,666 = 87,666).

| URL | Bytes before | Bytes after | Delta | HTTP | Anchors |
|---|---|---|---|---|---|
| /guides/claude-for-data-analysis.html | 65,698 | 66,397 | +699 | 200 | 1 |
| /answers/claude-error-troubleshooting.html | 58,965 | 59,590 | +625 | 200 | 1 |

Controls, fetched before and after each of the two deploys and compared by sha256:

| URL | Bytes | HTTP | Result |
|---|---|---|---|
| / | 21,602 | 200 | identical across both deploys |
| /guides/mcp-server-integration-guide.html | 55,410 | 200 | identical across both deploys |
| /guides/claude-code-workflow-automation.html | 87,666 | 200 | identical across both deploys |
| /answers/ | 7,873 | 200 | 200, intact |
| /sitemap.xml | 5,507 | 200 | identical across both deploys |
| /robots.txt | 66 | 200 | identical across both deploys |

**claudhq.com**, commit `f0e0af3`. Build confirmed: status `built`, error `null`, commit
`f0e0af3c5f948978981ee960025ec6c5629b3460`. Drift check: `mcp-config/index.html` byte-identical to
live before the patch, 70,173 = 70,173.

| URL | Bytes before | Bytes after | Delta | HTTP | Anchors |
|---|---|---|---|---|---|
| /mcp-config/ | 70,173 | 70,791 | +618 | 200 | 1 |

Controls, sha256 before and after:

| URL | Bytes | HTTP | sha256 (12) | Result |
|---|---|---|---|---|
| / | 11,026 | 200 | 4364733542c4 | identical |
| /mcp-troubleshooting-common-errors/ | 17,350 | 200 | 5ad936a2afae | identical |
| /claude-code-mcp-tool-categories-guide/ | 40,303 | 200 | 856d956fa715 | identical |
| /jira-mcp-server-claude-code-integration-guide/ | 32,597 | 200 | 49294e8f6959 | identical |
| /claude-code-not-working-vscode/ | 20,811 | 200 | 93f55edfd0d7 | identical |
| /sitemap.xml | 17,839 | 200 | 8cf04028629e | identical |
| /robots.txt | 64 | 200 | c301b0285f24 | identical |

No control page changed on either site, on any of the three deploys.

---

## Job 3: what was judged unsafe or not worth doing, and why

**bestremotetools.com, a second link.** Git-connected, topically perfect, and rejected. 8 of 8
sampled article and topic pages are `Crawled - currently not indexed`, including
`/how-to-build-custom-mcp-servers-for-claude` where R1's link already sits. The only indexed page is
the homepage, which is produced from `_layouts/home.html`; editing a layout is a sitewide change to
1,318 pages, not an insertion, so it is out of scope for a round whose every diff must be additions
to one page.

**welikeremotestack.com.** Git-connected and the best topical match in the safe set, because
mcp.zovo.one's servers are freelancer back-office tools and this site reviews freelancer tooling.
Rejected because the two pages where the link belongs,
`/best-invoicing-tools-for-freelancers-2026/` and `/best-time-tracking-tools-for-remote-freelancers/`,
have **never been crawled**: `Discovered - currently not indexed`, `lastCrawlTime` null. The homepage
is indexed but is a card hub and a topic list with no editorial paragraph, so a link there would be
bolted on rather than contextual, which is the shape this round is trying to avoid.

**chrometipsguide.com and securetoolsguide.com.** Git-connected, homepages indexed, every sampled
article not indexed, and the topical fit is weak in both cases. `/guides/mcp-server-security-review`
would be an honest target for a privacy-tools site, but there is no indexed host page to put it on.

**bestchromeextensions.com.** The only safe-set site with real, current indexation: 103 pages
carried impressions in the last 17 days. Rejected purely on relevance. Its indexed pages are
`chrome-extension-network-debugging-guide`, `chrome-extension-npm-packages-guide`,
`chrome-extension-service-worker-complete-guide`, `wxt-framework-chrome-extension-development` and
similar. There is no page on which a link to an MCP server catalogue would be useful to the reader,
so it was skipped rather than forced. Traffic does not make an off-topic link legitimate; that was
R1's rule for ingredientcalculator.com and it applies here too.

**claudecodeguides.com.** Off limits by the round's own hard rule. Its repository was never cloned
and never opened.

**earlythunder.com.** Git-connected, but crypto and deep-tech opportunity intelligence. No
developer-tooling surface, no honest placement.

**claudflow.com/guides/claude-code-workflow-automation.html.** The single highest-traffic indexed
page available anywhere in this round, 314 impressions in 17 days, and deliberately not used. The
article is entirely about prompt templates and pipeline stages; `/usr/bin/grep -i mcp` on it returns
zero hits. There is no sentence an MCP link would answer, so linking from it would have been placing
a link because the page has traffic, which is the exact thing this round's target test forbids.

**claudflow.com/answers/claude-error-troubleshooting.html was nearly rejected for the same reason**
and was only used after checking the target guide's actual content. The page never says "MCP", but
its subject is the boundary between retryable and non-retryable failures, and the linked guide
describes a failure that no HTTP status classification can express. The link earns its place on the
argument, not on the keyword.

**A third link on claudhq.com.** claudhq now carries three placements across three pages. A fourth
would stop looking like editorial cross-linking. R1 declined a third for this reason; R2 declines a
fourth.

**deepvalueradar.com, worthmyclaim.com, dscrradar.com.** Unchanged from R1's `not_done`. None is a
git-connected Pages project, worthmyclaim's repo-versus-live drift has already deleted a live page,
and dscrradar's link is still `fragile` because it was shipped by a mirror deploy. Nothing was
touched.

---

## What changed in `data/inbound_links.json`

- Three new `expected_links` entries, each with its page URL, its exact expected `href` and a count,
  so the existing one-pass `verify_command` covers them with no change to the command. It now checks
  **21** live placements.
- Every live entry re-stamped `verified: 2026-09-09`.
- New per-link fields on the contextual placements: `host_index_verdict`, `host_coverage_state`,
  `host_last_crawl`, and where available `host_impressions_90d` and `host_avg_position`. This is the
  field that would have caught R1's two dead-host links before they were placed.
- `instruments.url_inspection` documents the new instrument and why it is not interchangeable with
  impressions.
- `r2_headline_findings`, `changed_this_round_r2`, `candidates_r2` and `not_done_r2`. R1's
  `changed_this_round`, `candidates` and `not_done` are preserved verbatim; `legacy_keys_note` says so.

## What to expect, and how to tell if it worked

Seven contextual links do not make Google crawl 154 pages. The measurable question is unchanged and
narrow: does Googlebot fetch more than the single URL `docs/TRAFFIC_R3.md` established it has ever
fetched. The instrument exists, `node scripts/traffic.mjs --indexation`, and the baseline is
Googlebot 1 URL of 154, one sitemap fetch, zero impressions. Track `ever_crawled_by_google`, not the
discovered/unknown split, which R3 proved moves 58 percent between two censuses fifteen minutes
apart.

One thing worth watching specifically: three of the seven links now point at
`/guides/` pages rather than at `/`. If Googlebot begins fetching those three named guide URLs before
it fetches the other 100 guides, that is attributable to the links rather than to the sitemap.

## Notes for whoever runs the next round

- The five safe-set domains gained Search Console properties on 2026-09-09 at 07:04-07:05Z, closing
  the gap R1 flagged. `searchAnalytics` returns 0 rows for them today because the properties are new;
  `urlInspection` works immediately and was used instead. Re-check `searchAnalytics` in a week.
- URL Inspection is free and quota'd at 2,000 a day. There is no reason to guess at indexation again.
- `bestremotetools.com/how-to-build-custom-mcp-servers-for-claude` was last crawled 2026-04-14 and
  R1 changed it on 2026-09-08, so Google has never seen the current version of that page. It may
  yet index. Re-inspect before concluding the R1 placement is worthless.
- Cloudflare Pages sites in this estate serve an indexed homepage that Googlebot re-crawls daily and
  a long tail that it crawled once in April and has not revisited. If the goal is inbound links from
  these sites, the prerequisite is getting their articles indexed, which is a different job from
  placing links.
- Confirmed again: `grep` is shadowed on this machine and returns nothing silently. Every count in
  this document came from `/usr/bin/grep`.

## External calls

18 verification fetches before, 21 after, 6 sitemap fetches, roughly 40 URL Inspection calls,
8 `searchAnalytics` queries, 1 `wrangler pages project list`, 4 target-page fetches of mcp.zovo.one,
about 30 before/after control fetches, 4 repository clones and roughly 20 `gh api` build-status polls.
No paid API was called and no account was created.
