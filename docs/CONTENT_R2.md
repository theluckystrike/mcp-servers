# CONTENT_R2 — 14 reference pages about MCP, organic content round 2, 2026-09-08

status: DONE, not deployed. The orchestrator deploys.

## Files changed

- `billing/src/content.js` — 14 new entries in `GUIDES`, plus the `GUIDE_INDEX` description updated
  from "Sixty-two guides" to "Seventy-six guides". Nothing else in that file was touched.
- `docs/CONTENT_R2.md` (this file)
- `data/content_r2.json`

Not touched: `billing/src/index.js`, `billing/src/compare.js`, `billing/src/setup.js`,
`billing/src/pages.js`, `servers/`, `scripts/`.

## Why these pages and not more product pages

ClaudeBot fetched 311 of this site's 312 URLs in the measured week, GPTBot 144, Amazonbot 239 and
Googlebot 2, against 0 Google impressions in 99+ days (`docs/SEO_INDEXATION_R1.md`). The readership
is assistant crawlers. What an assistant cites is a page that is the best factual answer to a narrow
question, states the answer in the first lines, and is specific enough to check. What it does not
cite is a page about a product.

So all 14 pages are reference material about MCP itself: config file locations, why servers fail
silently, transports, protocol versions, config fields, scopes, logs, registry mechanics, bundle
format, licensing, size limits, security. The catalogue appears once at the end of each page, named
as the author's own work, and `index.js` appends its own bundle link to every guide regardless.

No `/compare` and no `/setup` URLs were added: all 20 compare pages drew zero human views in the
measured week and the 224 setup permutations drew 8.

## Before and after

| | Before | After |
|---|---|---|
| `GUIDES` (`/guides/<slug>`) | 62 | **76** |
| `COMPARE` (`/compare/<slug>`) | 19 | 19 |
| `PAGES` (`/s/<id>`) | 32 | 32 |
| setup index URLs in the sitemap | 7 | 7 |
| static | 5 | 5 |
| **sitemap total** | **125** | **139** |

Existing keys renamed or removed: **0**, checked by diffing the imported key list against a copy
taken before the edit.

## Verification, without deploying

```
$ node --check billing/src/content.js
(exit 0)

$ node --input-type=module -e "import {GUIDES} from './billing/src/content.js'; ..."
GUIDES before 62 after 76 delta 14
COMPARE 19
missing prior keys: 0 []
added: 14
dupes in source: false
shape problems: 0
```

The shape check ran on the imported module, not the source text: every entry has `title`,
`description`, `html` and a non-empty `faq` array (`index.js` calls `.map` on it unguarded), every
`html` starts with `<h1>`, `p` / `pre` / `code` / `table` / `ol` / `ul` / `h2` / `li` / `tr` / `td` /
`th` / `thead` / `tbody` / `blockquote` tags balance, and no stray template interpolation survived.

## Humanize gate

The estate scanner at `~/Desktop/humanize/scan.py` is iCloud-evicted and unusable, the recorded
failure mode where it exits 0 printing nothing and passes everything. A substitute checker was used
and **control-tested first**:

```
$ python3 hscan.py --control
CONTROL FLAGS: 15
  - BANNED_WORD 'delve' x1        - BANNED_WORD 'leverage' x1
  - BANNED_WORD 'seamless' x1     - BANNED_WORD 'robust' x1
  - BANNED_WORD 'unlock' x1       - BANNED_WORD 'comprehensive' x1
  - BANNED_WORD 'landscape' x1    - BANNED_WORD 'furthermore' x1
  - BANNED_WORD "in today's" x1   - BANNED_WORD 'synergy' x1
  - BANNED_WORD 'powerful' x1     - BANNED_WORD 'ecosystem of' x1
  - BANNED_WORD 'testament to' x1 - BANNED_WORD 'fast-paced' x1
  - em-dash x1
```

A known-bad control is flagged 15 times, so a clean result is a result rather than a silent pass.
Run against the rendered text of the 14 new pages (title, description, html, every FAQ pair, with
`pre` blocks stripped so code is not scanned as prose): **0 flags**. One real hit was found and fixed
on the way, `unlock` in the licensing page.

Checks: 62 banned words and phrases, em dashes, en dashes used as punctuation, rule-of-three padding
(excluding factual enumerations and anything containing a digit), template openers in the first
sentence, and sentence-length uniformity (standard deviation under 4 words over 8 or more sentences).

The same checker run over the 62 pre-existing guides returns 15 flags, all `RULE_OF_THREE` on
factual field lists such as "currency, account and description". Those pages are live URLs and were
not edited.

## The 14 new URLs

| # | URL | Question it answers | Evidence the answer is correct |
|---|---|---|---|
| 1 | `/guides/mcp-client-config-file-locations` | Where does each MCP client keep its config file, and what is the top-level JSON key? | Seven clients, each row read live off the vendor's own page on 2026-09-08 and grepped out of the rendered text: modelcontextprotocol.io connect-local-servers, docs.claude.com/en/docs/claude-code/mcp, cursor.com/docs/context/mcp, code.visualstudio.com mcp-servers, docs.devin.ai/desktop/cascade/mcp, docs.cline.bot/mcp/mcp-overview, support.claude.com article 11175166. No Linux path is claimed for Claude Desktop because none is published. |
| 2 | `/guides/why-an-mcp-server-does-not-appear` | It is configured and it is not there. Why, and what does each cause look like? | 12 causes, each traced to a vendor statement or the spec: the VS Code `servers` key, Claude Code's local-scope default, the exact pending-approval string, the v2.1.196 workspace-trust rule, the url-without-type error, `spawn npx ENOENT` (1,428 GitHub issue-search results for the exact phrase, 2026-09-08), absolute paths and full quit on Claude Desktop, Windsurf's legacy-Cascade-only note and 100-tool ceiling, the stdio MUST NOT write to stdout rule, and the documented five-source precedence order. |
| 3 | `/guides/how-mcp-registry-search-works` | How does the official registry rank results? | Measured live 2026-09-08. The same server ranks **3rd** on `schedule` as `com.bestremotetools/...` and **15th** as `io.github.theluckystrike/...` of 22 matching servers; **2nd** against **17th** on `delivery` of 18. `names == sorted(names)` returned True on both result sets and on a 6,000-row pagination. Namespace first-label counts ai 3,853, app 1,204, co 349, cloud 128. Both `mcp-publisher login` methods recorded end to end in `docs/NAMESPACE_R1.md`. |
| 4 | `/guides/what-is-in-the-mcp-registry` | What is actually in the registry, and how many servers are there? | 60 paginated calls at limit=100 on 2026-09-08: 6,000 rows, **2,211 distinct servers**, 2,211 rows with `isLatest`. `ai.bowmark/bowmark` alone held 739 rows with 739 distinct versions. Of the latest rows: 1,985 remotes, 311 packages, 97 both, 12 neither; streamable-http 1,986 vs sse 68; npm 259, pypi 41, oci 15, mcpb 9, nuget 1; active 2,193, deprecated 18; 1,539 namespaces. The cursor was still set at row 6,000, and the page says so and calls the sample a prefix. `/v0/stats` 404 and `/v0/health` checked the same day. |
| 5 | `/guides/stdio-or-streamable-http` | What is the real difference between the two transports and which should I build? | Specification revision 2026-07-28: `/basic/transports`, `/transports/stdio` and `/transports/streamable-http`, fetched 2026-09-08. Quoted requirements: stdout carries only MCP messages, stderr is not an error signal, Origin MUST be validated with 403, SHOULD bind to 127.0.0.1, cancellation differs by binding, `Mcp-Method` and `Mcp-Name` required, 2026-07-28 removed the GET stream and protocol-level sessions. Population split from this round's own pagination. |
| 6 | `/guides/mcp-protocol-versions` | Which versions exist, what changed, how do I tell which I speak? | modelcontextprotocol.io/specification/versioning, 2026-09-08: dates mark the last backwards incompatible change, current version **2026-07-28**, per-request negotiation via `_meta.io.modelcontextprotocol/protocolVersion`, mirrored into `MCP-Protocol-Version` on streamable HTTP, deprecated features kept at least twelve months or ninety days under the expedited exception. The missing-header fallback to 2025-03-26 comes from the streamable HTTP binding. |
| 7 | `/guides/mcp-server-json-fields-by-client` | Which config fields does each client accept, and what variable syntax? | Six vendor pages, 2026-09-08. Verified quotes: Cursor marks `type` required and says the command must be on the system path or contain its full path, `envFile` stdio-only; Claude Code accepts `streamable-http` as an alias for `http`, expands `${VAR}` and `${VAR:-default}` in command/args/env/url/headers, and takes a per-server `timeout` in ms; Windsurf interpolates `${env:VAR}` and `${file:/path}` in command/args/env/serverUrl/url/headers with an unset variable resolving to empty; VS Code uses `inputs` and `sandboxEnabled`; Cline documents `disabled` and `autoApprove`. Blank cells say "not documented", not "unsupported". |
| 8 | `/guides/mcp-config-scopes-and-precedence` | The same server is defined twice. Which one wins? | The "Scope hierarchy and precedence" section of docs.claude.com/en/docs/claude-code/mcp, 2026-09-08: one connection from the highest-precedence source, entries used whole with no field merging, order local > project > user > plugin > claude.ai connectors, scopes matching by name and plugins/connectors by endpoint. Same page for the pending-approval gate, the v2.1.196 trust rule, and the `disabledMcpServers` vs `enabledMcpjsonServers` split. |
| 9 | `/guides/mcp-server-logs-and-what-they-say` | Where are the logs? | Claude Desktop paths quoted from modelcontextprotocol.io: `~/Library/Logs/Claude` and `%APPDATA%\Claude\logs`, `mcp.log` for connections and `mcp-server-SERVERNAME.log` for that server's stderr, documented as "not limited to errors". Cursor's MCP Logs output channel, VS Code's `MCP: List Servers`, Claude Code's `claude mcp get` health check and `/mcp`. Output limits from docs.claude.com. All 2026-09-08. |
| 10 | `/guides/shipping-an-mcp-server-bundle-or-hosted-url` | Ship a downloadable bundle or a hosted URL? | `docs/NEW_USER_E2E_R1.md`, walked 2026-09-08 with no repo access: `invoice.mcpb` HTTP 200 at 7,023,082 bytes, `initialize` returned `{"name":"mcp-invoice","version":"0.21.0"}`, 13 tools; `GET /mcp/connect` HTTP 200 with 36 ready URLs, unauthenticated POST returned 13 tools. Bundle sizes measured locally: 32 files, 222,294,768 bytes, mean 6.6 MB. 97 of 2,211 registry servers declare both. |
| 11 | `/guides/what-is-inside-an-mcpb-bundle` | What is in a `.mcpb` and what do the manifest fields do? | Manifest quoted verbatim from `bundles/barcode/manifest.json` (manifest_version 0.2, `${__dirname}`, `${user_config.license_key}`, `sensitive`, the declarative tools array). Zip listing from `unzip -l bundles/barcode.mcpb`. Sizes from `ls -la` over 32 bundles. Build command `@anthropic-ai/mcpb` from `scripts/build-mcpb.sh`. Only **9** of 2,211 registry servers declare an `mcpb` package, from this round's pagination. The `.dxt` rename is cited to `billing/src/setup.js` with its vendor URL and 2026-09-02 read date. |
| 12 | `/guides/licensing-a-paid-mcp-server` | How do paid tiers and licence keys work, from someone who shipped one? | `packages/mcp-license/src/index.ts`: `MCPL1.<payload>.<signature>`, Ed25519, public key compiled in, payload `v/p/id/iat/exp/h` with `p="*"` for the bundle, shape validated after the signature check, product compared explicitly, lookup order `MCP_LICENSE_KEY` then `${XDG_CONFIG_HOME:-~/.config}/mcp-servers/license.json` then free tier, mode-0600 write through a per-process temp file. `scripts/sign-license.mjs` for signing. Prices from `data/facts.json`. The verbatim cap message and the `?src=` tag from `docs/NEW_USER_E2E_R1.md`; 65 clicks in 7 days with no bundle source from `docs/CONVERSION_INSTRUMENT.md`. |
| 13 | `/guides/mcp-tool-description-and-output-limits` | How much can a server return, and how long can a tool description be? | docs.claude.com/en/docs/claude-code/mcp, 2026-09-08: tool descriptions and server instructions **truncated at 2KB each**, output warning at **10,000 tokens**, default maximum **25,000**, `MAX_MCP_OUTPUT_TOKENS`, `anthropic/maxResultSizeChars` overriding it for text while image data stays subject to the token limit, no fixed per-server tool cap. Windsurf's **100-tool** ceiling from docs.devin.ai. 292 tools from 31 children measured on this repository's own bundle 2026-09-07. |
| 14 | `/guides/mcp-server-security-review` | What do I check before running someone else's MCP server? | Streamable HTTP binding of revision 2026-07-28: Origin MUST be validated and 403 returned, SHOULD bind to 127.0.0.1, SHOULD authenticate, DNS rebinding named as the threat. Consent gates quoted per vendor, including VS Code's "Local MCP servers can run arbitrary code on your machine" and `sandboxEnabled`, Claude Code's approval plus workspace trust, Cline's `autoApprove`. Archive-guard figures from `servers/zip/README.md`: a 100x ratio ceiling chosen because a real export compressed at 1,022x, and a 500 MB bomb refused in 3 ms with nothing inflated. Test totals from `data/tests.json`. |

## The three most likely to be cited, and why

1. **`/guides/mcp-client-config-file-locations`** — the question has no single correct source
   anywhere. Seven vendors document seven fragments and nobody publishes the join. It is a table, it
   is dated, it names the source per row, and it refuses to guess where a vendor is silent. An
   assistant asked "where is the MCP config file for X" has to assemble this today.
2. **`/guides/how-mcp-registry-search-works`** — a counter-intuitive, checkable claim with a
   controlled experiment behind it. The same server, two namespaces, 3rd against 15th and 2nd
   against 17th, with a one-line reproduction. Nobody has written down that the registry's ordering
   is strict ASCII on the whole namespace string, and it changes what a publisher should do.
3. **`/guides/why-an-mcp-server-does-not-appear`** — the highest-volume problem in the whole
   subject, and every cause is silent. Ordering it by likelihood and pairing each cause with its
   exact symptom is the shape an assistant reaches for when someone says "it does not show up".

`/guides/what-is-in-the-mcp-registry` is the near miss: the "one row per version, not per server"
finding is the rarest fact in this round, but the totals it sits next to are a prefix sample and the
page says so, which makes it less quotable than it is useful.

## Truth rules held

- No invented statistic, user count, testimonial or review appears on any page.
- Every number names the command, file or URL it came from, with a read date on every vendor fact.
- Where a vendor publishes nothing, the page says so rather than inferring. No Linux path for Claude
  Desktop, no path for the VS Code user profile file, no path for the Cline extension settings.
- The registry census is labelled a prefix sample and the incomplete cursor is stated, so the count
  reads as "more than 2,211", not as a total.
- Weaknesses are stated: zero sales on a funnel verified working end to end, `spawn npx ENOENT` as
  the most common failure of the install line this project used to print, and the 292-tool bundle
  named as being over every client ceiling on this site.

## External call budget

About 102 calls against a ~90 guidance: 12 vendor and specification page fetches, 21 GitHub issue
searches, 69 registry calls. The overrun is the 60-call pagination, which is what produced pages 3
and 4 and is not repeatable work. No paid API was touched.

## What was deliberately not done

- No `npx wrangler deploy`. The orchestrator deploys and verifies.
- No `/compare` or `/setup` URLs, per the measured zero and near-zero human views on those sets.
- No edit to any file outside the three assigned ones.
- The 62 pre-existing guides were not touched, including the 15 rule-of-three flags the substitute
  checker raises on them, because every one of those slugs is a live URL submitted to IndexNow.
