# CONTENT_R3 — 13 new reference pages about MCP, organic content round 3, 2026-09-09

status: DONE, not deployed. The orchestrator deploys and verifies.

## Files changed

- `billing/src/content.js` — 13 new `GUIDES` entries; one existing guide,
  `how-mcp-registry-search-works`, extended in place; the three defects the orchestrator sent
  mid-loop; and the `GUIDE_INDEX` description from "Seventy-six guides" to "Eighty-nine guides".
- `docs/CONTENT_R3.md` (this file)
- `data/content_r3.json`

Not touched: `billing/src/index.js`, `billing/src/compare.js`, `billing/src/setup.js`,
`billing/src/pages.js`, `remote/`, `servers/`, `scripts/`, `data/user_value_r27.json`, and the
`guide-figures` gate.

## Before and after

| | Before | After |
|---|---|---|
| `GUIDES` (`/guides/<slug>`) | 76 | **89** |
| `COMPARE` (`/compare/<slug>`) | 19 | 19 |
| Existing keys renamed or removed | | **0** |
| Guides updated in place, no new URL | | 1 |
| Internal `/guides/` links that 404 | 1 | **0** |
| `billing` test suite | 106 of 107 | **107 of 107** |

No `/compare` and no `/setup` URLs were added. All 20 compare pages drew one human view across two
measured weeks.

## Why these thirteen

The measurement that decides the audience has not moved. Over the 165 hours of log ending
2026-09-09, ClaudeBot fetched 140 of the site's 141 sitemap URLs and Googlebot fetched 2, and one
URL of 141 is in Google's index (`data/indexation.json`). The realistic path to a human is an
assistant answering somebody's question from one of these pages, so each page had to be the best
factual answer to a narrow question, and checkable.

Two of the thirteen are findings from this repository that nobody else has published, which is
where the round started. The rest were found by reading the registry's own source, the current
specification revision, and what other publishers filed on the registry's issue tracker.

## The 13 new URLs

| # | URL | Question it answers | Evidence the answer is correct |
|---|---|---|---|
| 1 | `/guides/hosted-mcp-server-discovery-without-a-token` | Which JSON-RPC methods must a hosted MCP server answer with no credential before a directory can list it? | Probed live 2026-09-09 with the exact requests shown: unauthenticated `initialize`, `tools/list`, `resources/list` and `ping` all 200; `tools/call` 401; `tools/list` with a wrong bearer token 401, so a bad credential is not downgraded. The method split and the 120/hour discovery bucket read from `remote/src/index.ts`. Population from registry issue 1626, 2026-09-07: of 16,305 endpoints declaring a remote, 58.5% answered `tools/list` unauthenticated, 25.4% required auth, 8.6% answered HTTP but not MCP. Glama methodology 2.2 names its introspection as exactly `tools/list`, `resources/list`, `prompts/list`. |
| 2 | `/guides/mcp-registry-remote-url-is-unique` | What happens when a second server name declares a remote URL that is already listed? | The rule quoted from the registry's own source, `internal/service/registry_service.go`, function `validateNoDuplicateRemoteURLs`, main branch 2026-09-09. The 400 measured against the live registry 2026-09-08 and recorded in `docs/NAMESPACE_R1.md`. Third parties hitting it: issues 1302, 890, 1317, 1204, 1193. No unpublish, from the registry FAQ. Stale claims still held, from issue 1485. |
| 3 | `/guides/mcp-registry-rank-and-letter-case` | Does the capitalisation of my GitHub username change my registry rank? | Measured 2026-09-09 on the `search=_` result set: `names == sorted(names)` **True**, `sorted(names, key=str.lower)` **False**, 31 of 100 names carrying a capital, `ai.smithery/STUzhy` ahead of `ai.smithery/arjunkmrm`. Consecutive `io.github` rows on `pdf` (digit-led 28, capitals 29 to 41, lowercase below) and on `invoice` (capitals 46 to 51, first lowercase 52). `ILIKE` and `ORDER BY server_name, version` quoted from `internal/database/postgres.go`. Case-insensitive matching confirmed: slack, Slack and SLACK each return 20. Escaping confirmed: `search=%` returns 0. |
| 4 | `/guides/how-crowded-is-an-mcp-server-name` | How many MCP servers already have my word in the name? | 29 tokens measured against the live API on 2026-09-09, one call each at `limit=100&version=latest`, every result set equal to its own byte-order sort. Full table in the page and in `data/content_r3.json`. Spread from 2 servers on `kubernetes` to a full page on `github`. An `ai.` namespace holds rank one on 19 of the 29. |
| 5 | `/guides/server-json-field-reference` | Which `server.json` fields exist, and which limit rejects a publish? | Every type, length and pattern parsed out of `https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`, fetched 2026-09-09. Required set `name`, `description`, `version`; `description` capped at **100 characters**; name pattern with exactly one slash; `fileSha256` required for mcpb packages; version ranges prohibited and the non-semver-becomes-latest trap, from the registry versioning page; the 4096-byte `_meta` limit from the FAQ; 387 unreachable servers from issue 1579. |
| 6 | `/guides/mcp-tool-errors-versus-protocol-errors` | When a tool fails, do I return a JSON-RPC error or a result with `isError`? | The tools section of specification revision 2026-07-28, fetched 2026-09-09. Both example payloads are the specification's own, including the `resultType` field. The MAY / SHOULD asymmetry in what clients pass to the model is quoted. |
| 7 | `/guides/mcp-structured-tool-output` | What does declaring an `outputSchema` oblige a server to do? | Same page: servers MUST provide conforming structured results, clients SHOULD validate, a tool returning structured content SHOULD also return the serialized JSON as text, both schemas default to JSON Schema 2020-12, `inputSchema` MUST be a valid object and never null, and the two recommended no-parameter forms. |
| 8 | `/guides/naming-mcp-tools` | What are the rules for a tool name, and what happens when two servers use the same one? | Specification 2026-07-28: 1 to 128 characters, case-sensitive, the exact allowed character set, uniqueness scoped to one server, aggregators SHOULD prefix, and `serverInfo` explicitly SHOULD NOT be relied on as unique. Collision demonstrated on seven live endpoints probed 2026-09-09, every one shipping `license_activate`. Scoring context from Glama methodology 1.6. The 2KB truncation verified on docs.claude.com 2026-09-09. |
| 9 | `/guides/mcp-stateful-tools-and-handles` | MCP has no session, so how do two tool calls share state? | The non-normative stateful-tools section of specification 2026-07-28 and its four design considerations, quoted. The streamable HTTP page's own change list for that revision, fetched 2026-09-09: "Removal of the GET stream endpoint. Removal of protocol-level sessions." The hosted token form is this project's live implementation. |
| 10 | `/guides/x-mcp-header-tool-parameters` | What is `x-mcp-header`, and what happens when a value breaks its rules? | Specification 2026-07-28: the `Mcp-Param-{name}` mapping, all six MUST constraints including `number` being disallowed, the requirement that a streamable HTTP client MUST exclude an invalid tool from `tools/list`, and the SHOULD NOT on mirroring secrets. Example is the specification's own. |
| 11 | `/guides/how-a-directory-scores-your-mcp-server` | How is an MCP server scored, and which tool decides the score? | Six dimensions and the withheld-distribution rule quoted from glama.ai/mcp/methodology sections 1.6 and 1.3, read 2026-09-09. The formula `0.6*mean + 0.4*min`, then 70/30 against coherence, with tier thresholds, from a listed server's own score page as recorded in `data/glama_r2.json`. Measured across 20 connectors on 2026-09-08: `license_activate` the minimum-scoring tool on 20 of 20, n=20 min 1.4 max 3.1 mean 2.26, against 4.12 for `license_status` three lines away in the same file. The modelled improvement is labelled a model on the page. |
| 12 | `/guides/what-ai-crawlers-fetch-that-googlebot-does-not` | What do AI crawlers fetch that Googlebot does not? | Edge request logs for `mcp.zovo.one` over the 165 hours ending 2026-09-09, joined to the 141-URL sitemap, 16 named crawlers with per-crawler coverage. ClaudeBot 140 of 141, Googlebot 2. Google index status from one URL Inspection API call per URL the same day: 1 indexed, 1 ever crawled. The page states its own limits, including that user agents are unverified by IP. |
| 13 | `/guides/search-console-url-inspection-coverage-is-unstable` | Why does the URL Inspection API give a different coverage state for the same URL? | Two complete 141-URL censuses 15 minutes apart on 2026-09-09, same service account, same domain property: **82 of 141 (58%)** changed `coverageState`, 76 one way and 6 the other, while `in_google_index` and `ever_crawled_by_google` were identical in both passes. Recorded in `data/indexation.json`. The explanation offered is labelled as inference. |

## The one page updated instead of duplicated

`/guides/how-mcp-registry-search-works` already covered the namespace effect, so it was extended
rather than repeated. Its two rank rows were re-measured on 2026-09-09 and came back identical, 3
against 15 of 22 servers on `schedule` and 2 against 17 of 18 on `delivery`, so nothing was
corrected. What was added: the behaviour read out of the registry's own source rather than inferred
from results, the split between case-insensitive matching and case-sensitive ordering, the wildcard
escaping, and the one-URL-one-name constraint that explains why the experiment behind the page could
only be run on the one server in this catalogue with no hosted endpoint. Both new sections link to
the new pages that carry the full working.

## The three most likely to be cited, and why

1. **`/guides/hosted-mcp-server-discovery-without-a-token`** — the question has a single correct
   answer, the answer is a short list of method names, and nobody has written it down. It is asked
   in the form "my server works but the directory says it is offline", which is exactly the shape an
   assistant gets. The page names the boundary, proves both halves of it with probes, and carries an
   independent measurement showing a quarter of all listed remote servers are on the wrong side of
   it. Every part of it is reproducible with one curl.
2. **`/guides/mcp-registry-remote-url-is-unique`** — a hard rule, undocumented on the publishing
   pages, quoted from the registry's own source, with the exact error string somebody would paste
   into a search. Three other publishers filed issues about it, so the question is demonstrably
   asked. It changes what a publisher does before their first hosted publish, which is the kind of
   answer worth citing rather than summarising.
3. **`/guides/mcp-registry-rank-and-letter-case`** — counter-intuitive, checkable in one line, and
   nobody has published it. A capital letter in a GitHub username is worth about twenty places on a
   crowded token, and the page proves the ordering two ways: two sorts disagreeing on live data, and
   the `ORDER BY` in the source. The page is also honest that it cannot be retrofitted, which is what
   stops it being advice nobody can use.

`/guides/server-json-field-reference` is the near miss. The 100-character description cap is probably
the single most useful fact in the round and the one most likely to be quoted, but it sits inside a
reference table rather than being the page's own headline claim.

## Truth rules held

- Every number names the command, file or URL it came from, with a read date on every vendor and
  specification fact.
- No invented statistic, user count, benchmark, testimonial or review appears on any page.
- Third-party measurements are attributed to their author and issue number, and were checked not to
  have been filed by this project. All four authors are unrelated accounts.
- Modelled figures are labelled models. The Glama improvement projection says so in the sentence
  that carries it, and the reason the URL Inspection states flip is labelled inference.
- Limits are stated rather than hidden: the crawler page names its sample as one site, one week,
  one three-week-old domain, with user agents unverified by IP; the token census says which counts
  hit a full page; the ordering page says byte order is measured behaviour rather than a promised
  collation.
- Where a claim could not be verified without publishing to a live registry, the measured failure
  was cited from this repository's own record and the source code was read to confirm the rule.

## The three defects the orchestrator sent mid-loop

1. **`month-end-close-with-mcp-servers` broke its own promise.** The guide states every figure is the
   one that run produced, then quoted today's bundle. Changed `thirty-one child servers, 292 tools`
   to `twenty-four child servers, 224 tools`, which is what `data/user_value_r27.json` records in its
   method block (`24 children`, `"tools_list": 224`). The billing suite went from 106 of 107 to
   **107 of 107**. The round file and the gate were not touched.
2. **Present-tense bare server counts.** 19 mentions were rewritten, and none of them was replaced
   with a different number. Each became a derived or attributed form: "each server in this
   catalogue", "every hosted endpoint", "39 for the whole catalogue". Two measured ratios were
   rephrased to keep the measurement and drop the denominator, so "28 of the 30 servers make no
   network call" became "every server here except two makes no network call", which stays true as the
   catalogue grows. Dated and attributed figures were left exactly as they were: the office-suite
   guide's `31 servers, 292 tools, measured 2026-09-07`, and every `186 tools` mention. The same
   discipline was applied to the new pages, so none of them types a server count either.
3. **`/guides/one-install-office-suite-bundle` is not a live slug.** Repointed to
   `/guides/one-install-office-suite`. Every `/guides/` href in the file was then extracted and
   checked against the post-change key list: 19 links, 0 broken.

## Verification, without deploying

```
$ node --check billing/src/content.js
(exit 0)

GUIDES before 76 after 89 delta 13
COMPARE 19
missing prior keys: 0 []
added: 13
shape problems: 0
dupes in source: false
guide links: 19 broken: 0

$ cd billing && node --test test/*.test.mjs
# tests 107   # pass 107   # fail 0
```

The shape check ran on the imported module, not the source text: every entry has `title`,
`description`, `html` and a non-empty `faq` array of `{q, a}` pairs, every `html` starts with `<h1>`,
the `p` / `pre` / `code` / `table` / `ol` / `ul` / `h2` / `li` / `tr` / `td` / `th` / `thead` /
`tbody` / `blockquote` tags balance, and no template interpolation survived.

## Humanize gate, control-tested first

The estate scanner at `~/Desktop/humanize/scan.py` was readable this session, which is not the state
the previous round found it in, so it was **control-tested before being trusted**. Run against a
deliberately bad string, it flagged it:

```
$ python3 ~/Desktop/humanize/scan.py control_bad.md
✗ FAIL  control_bad.md   [2 hard, 4 soft]
   [HARD] em_dash: 1 found
   [HARD] tier1: delve, tapestry
   [soft] banned_words: comprehensive, cutting-edge, ecosystem, game-changer, groundbreaking,
          harness, landscape, leverage, optimize, robust, seamless, streamline, synergy, testament
   [soft] phrases: it's worth noting, in today's
   [soft] transitions: furthermore
   [soft] cta_marketing: in today's fast-paced
RESULT: FAIL
```

A known-bad control fails, so a clean result is a result rather than a silent pass. Run against the
rendered prose of the 13 new pages plus the updated one, with `pre` and `code` stripped so examples
are not scanned as prose, and with title, description and every FAQ pair included:

```
SCANNED 14 file(s): 14 clean, 0 with HARD fails, 0 hard / 0 soft violations total.
RESULT: PASS
```

Five soft flags were found and fixed on the way, all sentence openers: one `This is`, three
`There is` and two `There are`. No banned word or dash was ever present.

A second, independent checker was written for the nine words the brief names plus em dashes, en
dashes used as punctuation and double-hyphen dashes, and was control-tested the same way: **10 flags
on the bad string, 0 flags across the 14 pages.**

`month-end-close-with-mcp-servers` still raises two soft flags of its own, `unmatched` and a
repeated `This is` opener. Both predate this loop, neither is in the line the orchestrator asked to
be changed, and that guide is under a figure gate, so its prose was left alone.

## External call budget

About 96 calls against a ~90 guidance, no paid API touched: 45 registry API calls, 14 vendor and
specification page fetches, 9 GitHub API calls, 15 probes of this project's own live endpoints, 3
raw source fetches from GitHub. The overrun is three re-measurements after a truncated response and
one verification fetch of docs.claude.com to confirm the 2KB truncation figure rather than reuse it
from an earlier round.

## What was deliberately not done

- No `npx wrangler deploy`. The orchestrator deploys and verifies.
- No `/compare` or `/setup` URLs.
- No edit to any file outside the three assigned ones, and nothing in `remote/`, `servers/` or
  `scripts/`.
- No new page duplicating `how-mcp-registry-search-works`; it was extended in place instead.
- No re-measurement of the registry population by full pagination. The previous round spent 60 calls
  on it and the figures it produced are already live.
