# AI-assistant index measurement — R1 (2026-09-10)

Assignment: 99 days of zero Google impressions on `mcp.zovo.one` say nothing about the
indexes assistants actually retrieve from. Claude's web search retrieves from **Brave**.
ChatGPT search retrieves from **Bing**. Perplexity runs its own crawler. Nobody had ever
checked any of them.

**Headline: `mcp.zovo.one` IS present in Brave — the index Claude searches — but at a
depth of exactly one URL out of 154. The host is indexed. The catalogue is not.**

Instrument: `scripts/ai-index-probe.mjs`. Machine-readable output: `data/ai_index_r1.json`.

---

## 1. The instrument, and why half the candidate endpoints are unusable

The brief's rule — *a zero from an instrument that has never returned non-zero is
unmeasured, not proven* — turned out to be the whole story here. Three separate traps
appeared, and each one would have produced a confident, false "we are absent".

### Trap 1 — an endpoint that ignores the query and passes its own control

Bing's RSS endpoint returns HTTP 200 and well-formed results, and it returns
`modelcontextprotocol.io` for `model context protocol`. That looks like a passing control.
It is not. The same endpoint returns the **identical ten results** for four different
queries:

```
curl -sS -A "<chrome-ua>" 'https://www.bing.com/search?q=mcp.zovo.one&format=rss'
curl -sS -A "<chrome-ua>" 'https://www.bing.com/search?q=%22mcp.zovo.one%22&format=rss'
curl -sS -A "<chrome-ua>" 'https://www.bing.com/search?q=MCP+servers+for+Claude+invoices+time+tracking+and+freelance+tools&format=rss'
```

All three returned the same list, headed by `modelcontextprotocol.io/docs/...`,
`geeksforgeeks.org/.../model-context-protocol-mcp/`, `en.wikipedia.org/wiki/Model_Context_Protocol`.
The control passed **by accident**: every one of those queries contains the token "mcp".

A discrimination probe shows the mechanism — the endpoint answers the head term, not the query:

```
curl -sS -A "<chrome-ua>" 'https://www.bing.com/search?q=best+hiking+boots+wide+feet&format=rss'
  -> bestbuy.com, merriam-webster.com/dictionary/best, dictionary.cambridge.org/dictionary/english/best
curl -sS -A "<chrome-ua>" 'https://www.bing.com/search?q=python+asyncio+semaphore+example&format=rss'
  -> python.org, python.org/downloads, docs.python.org
```

"best hiking boots wide feet" returning dictionary definitions of *best* is not a search
result. So the instrument carries a **DISCRIMINATION control**: two topically disjoint
queries must return different host sets (Jaccard < 0.5). And a **DOMAIN control**: an
endpoint that cannot return `mcp.zovo.one` for the near-verbatim homepage title is marked
*unmeasured for our domain* and is never allowed to contribute an absence.

### Trap 2 — `site:` silently ignored

Bing ignores the `site:` operator for scripted requests, on both surfaces:

```
curl -sS -A "<chrome-ua>" 'https://www.bing.com/search?q=site%3Agithub.com+model+context+protocol'
```

decodes (results are base64 inside `/ck/a?...u=a1...` wrappers) to `anthropic.com`,
`geeksforgeeks.org`, `cloud.google.com`, `en.wikipedia.org` — a `site:github.com` query
returning mostly non-GitHub hosts. Via RSS it is worse: `site:mcp.zovo.one` returned
Eventbrite, and `site:zovo.one` returned zhihu.com and `meu.inss.gov.br`.

So the instrument runs a **SITE control** (`site:github.com` must return ≥3 github.com URLs
*and* ≥50% on-host) before any `site:` number is allowed to count. Bing fails it. **Every
Bing `site:` result in this report is therefore recorded as unmeasured, not as zero.**

### Trap 3 — the HTTP client itself was the blocker

Brave returns **HTTP 429 to node's `fetch` (undici) on the first request, regardless of
headers**, while the identical request from `curl` returns 200:

```
node  fetch, full browser headers -> 429, 73898 bytes
node  fetch, UA only              -> 429, 73897 bytes
node  fetch, no headers           -> 429, 73778 bytes
curl, same UA                     -> 200, 101264 bytes
```

It is fingerprinting the TLS/HTTP2 client, not the User-Agent. The first version of this
script used `fetch` and produced `site:mcp.zovo.one -> 0 URLs` and `site:zovo.one -> 0 URLs`
— a completely false absence for the single most important index, from an endpoint that
had "passed" a control taken minutes earlier. **The script now shells out to `/usr/bin/curl`**,
which also makes every `command` string in the JSON literally reproducible.

Related: throttled responses are now detected (`isSoftBlock`) and recorded as
`unmeasured: true` with `present: null` — never as `present: false`.

### Endpoint qualification table

| Endpoint | Verdict | How it refused / behaved | Evidence |
|---|---|---|---|
| **Brave** (`search.brave.com`) | **MEASURABLE, `site:` SUPPORTED** | works via curl; 429s undici; rate-limits under a tight loop | `site:github.com` -> 55 github.com URLs |
| Bing RSS (`?format=rss`) | MEASURABLE but **`site:` IGNORED**, **domain control FAILED** | answers the head term, not the query | identical 10 results for 4 queries |
| Bing HTML | MEASURABLE but **`site:` IGNORED** | results base64 in `/ck/a` wrappers | `site:github.com` returned anthropic.com, wikipedia |
| Marginalia | INTERMITTENT | HTTP 200 with `Wait For A Moment / currently barraged` backoff page | 1039-byte body vs 53121 when healthy |
| DuckDuckGo HTML/Lite | INTERMITTENT | HTTP **202** + *"Select all squares containing a duck"* | 14217 bytes, captcha |
| Mojeek | BLOCKED | HTTP 200 + *"JavaScript is required to complete this challenge"* | 5511 bytes |
| Startpage | BLOCKED | HTTP 200 + Anubis proof-of-work (`anubis_challenge v1.26.4`) | 22106 bytes |
| Ecosia | BLOCKED | HTTP **403** *"Ecosia Firewall"* | 4645 bytes |
| Yandex | BLOCKED | HTTP **302** to nothing | 0 bytes |
| Seznam | UNUSABLE | HTTP 200, 235999 bytes, JS-rendered, no parseable result URLs | 0 results parsed |

Note DuckDuckGo and Marginalia are *intermittent*, not dead — both qualified MEASURABLE on
one pass and failed on another. They are reported as unmeasured rather than zero.

---

## 2. Presence and DEPTH

Presence is not a channel. A host with one indexed URL and a host with 150 are different
situations, and only the second is a channel. Measured on Brave, the only endpoint that
passed the `site:` control.

### Positive controls first

```
curl -sS -A "<chrome-ua>" 'https://search.brave.com/search?q=site%3Agithub.com+model+context+protocol'
  -> 55 distinct github.com URLs                                    CONTROL PASS
curl -sS -A "<chrome-ua>" 'https://search.brave.com/search?q=site%3Azovo.one'
  -> 20+ distinct zovo.one URLs: /, /about, /about/michael-lip, /best-for, /download,
     /for/students, /free-tools/anagram-solver, /free-tools/internet-speed-checker,
     /free-tools/scientific-notation-converter, /free-tools/unit-converter,
     /free-tools/unit-price-calculator, /free/developer-tools, /industries/freelancers,
     /open-source, /pricing, /services ...                          CONTROL PASS
```

The apex domain is in Brave at real depth. So a low number for the subdomain is a fact
about the subdomain, not about the instrument.

### The result

```
curl -sS -A "<chrome-ua>" 'https://search.brave.com/search?q=site%3Amcp.zovo.one'
  -> HTTP 200, 101264 bytes
  -> exactly ONE URL: https://mcp.zovo.one/
  -> page header text: "Only showing results from mcp.zovo.one … Zovo mcp.zovo.one
     MCP servers for Claude: invoices, time tracking and freelance tools"
```

Depth probes, each an independent query, unioned:

| Probe | Command | mcp.zovo.one URLs |
|---|---|---|
| `site:` page 1 | `?q=site%3Amcp.zovo.one` | **1** (`/`) |
| `site:` page 2 | `?q=site%3Amcp.zovo.one&offset=1` | 0 |
| section `/guides` | `?q=site%3Amcp.zovo.one%2Fguides` | 0 |
| section `/s` | `?q=site%3Amcp.zovo.one%2Fs` | 0 |
| section `/setup` | `?q=site%3Amcp.zovo.one%2Fsetup` | 0 |
| section `/compare` | `?q=site%3Amcp.zovo.one%2Fcompare` | 0 |

**Distinct retrievable URLs in Brave: 1 of 154 sitemap URLs (0.65%).**
Not one of the 15 guides, 19 compare pages or 8 setup pages is retrievable.

This corroborates `docs/BLIND_RECOMMENDATION_R1.md` exactly: that blind run surfaced
`mcp.zovo.one` in 2 of 18 assistant result sets, both times the homepage, with the same
title string. Two independent instruments, same answer: **the host is in, at depth 1.**

### Cross-index depth summary

| Index | Depth (distinct URLs of ours) | Basis |
|---|---|---|
| **Brave** (Claude web search) | **1 of 154** | measured, controls passed |
| Google | **1 of 141** (`Submitted and indexed`) | `data/indexation.json`, URL Inspection API, 2026-09-09 |
| Bing (ChatGPT search) | **UNMEASURED** | `site:` ignored, domain control failed — no honest number available |
| Perplexity | **UNMEASURED** — no public index query surface | crawler evidence below |

The two indexes we *can* measure independently both hold exactly one URL: the homepage.
That is a strikingly consistent result and it is unlikely to be coincidence.

---

## 3. Buyer-intent queries on Brave

15 queries in the words a buyer would type, derived from `ls servers/` (32 servers).
Run spaced 14s apart by hand because the script's tighter loop trips Brave's rate limit.

| Query | organic results | our rank |
|---|---|---|
| mcp server invoice | 19 | — |
| mcp server pdf merge | 18 | — |
| **claude mcp expense tracker** | 22 | **21** (`https://mcp.zovo.one`) |
| mcp server generate quotes | 15 | — |
| mcp timezone meeting planner | 23 | — |
| mcp server time tracking | 23 | — |
| mcp server read excel spreadsheet | 24 | — |
| **claude mcp currency converter** | 23 | **16** (`https://mcp.zovo.one`) |
| mcp server word document docx | 24 | — |
| mcp server resume builder | 24 | — |
| mcp server recurring invoices | 21 | — |
| mcp server bank statement csv | 22 | — |
| mcp server barcode qr code | 23 | — |
| mcp server kanban board | 24 | — |
| mcp server for freelancers | **UNMEASURED** (HTTP 429 on two attempts) | — |

**14 of 15 measured. We appear in 2 of 14. We appear in the top 10 of ZERO of 14.**
Both appearances are rank 16 and rank 21 — below the fold, and below the result depth an
assistant typically ingests. `github.com/theluckystrike/*` did not appear for any query.

Who does win these queries: `github.com`, `reddit.com`, `mcpmarket.com`, `mcpservers.org`,
`mcp.directory`, `mcpbundles.com`, `claudemarketplaces.com`, `youtube.com`. The winners are
GitHub repos and MCP directory aggregators — which matches `BLIND_RECOMMENDATION_R1.md`,
where every recommendation an assistant made was a GitHub repo or a directory row.

---

## 4. Is the site technically at fault? No.

Checked, because "only the homepage is indexed" usually means a canonical or noindex defect:

```
curl -sS https://mcp.zovo.one/robots.txt
  User-agent: *
  Allow: /
  Disallow: /buy/ /success /recover /verify /bound
  Sitemap: https://mcp.zovo.one/sitemap.xml
```

| URL | HTTP | canonical | title | noindex |
|---|---|---|---|---|
| `/` | 200 | `https://mcp.zovo.one/` | MCP servers for Claude: invoices, time tracking and freelance tools | none |
| `/s/invoice` | 200 | `https://mcp.zovo.one/s/invoice` | MCP Invoice for Claude, Cursor and any MCP client | none |
| `/guides/invoice-pdf-from-chat` | 200 | self | Create an invoice PDF from a chat message with an MCP server | none |
| `/setup/claude-desktop` | 200 | self | MCP servers for Claude Desktop: install guides | none |
| `/compare/invoice` | 200 | self | MCP Invoice vs einvoice-mcp and IMW Invoice: which MCP server to pick | none |

All canonicals self-referential, all titles distinct, no `noindex` anywhere, nothing
blocked in robots.txt. **The pages are technically indexable and are simply not being
indexed.** This is an authority / crawl-budget outcome, not a defect to fix in the HTML.

One genuinely good thing: the single URL that *is* retrievable is the right one. The
homepage names **all 32 of 32** servers (`for s in $(ls servers/); do grep -qi "$s" home.html`)
in 35,698 characters of visible text. An assistant that retrieves that one page gets the
whole catalogue.

---

## 5. Crawler-side evidence (Cloudflare, `data/traffic.json`, 7 days to 2026-09-09)

| Crawler | URLs fetched | % of 141-URL sitemap |
|---|---|---|
| ClaudeBot | 140 | 99.3 |
| GPTBot | 90 | 63.8 |
| bingbot | 35 | 24.8 |
| Applebot | 33 | 23.4 |
| **PerplexityBot** | **5** | **3.5** |
| Googlebot | 2 | 1.4 |
| DuckDuckBot | 1 | 0.7 |

Two things follow. **Perplexity has barely crawled us** — 5 URLs — so there is no Perplexity
channel to find, and that is a crawl fact, not an index inference. And **being crawled is
not being indexed**: ClaudeBot fetched 140 of 141 URLs while Brave, the index Claude's web
search actually queries, retrieves 1. ClaudeBot is training/answer fetching; it does not
populate the retrieval index. This distinction has been the project's blind spot.

No Brave crawler appears in the log at all, which is consistent with Brave holding only the
homepage — likely via its Web Discovery Project rather than a crawl.

---

## 6. IndexNow — submitted, and what that does and does not mean

IndexNow is free, needs no account, and pushes to Bing, Yandex, Seznam and Naver at once.

Key file verified live first (both keys in the repo are served; see the defect note below):

```
curl -sSI https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt
  HTTP/2 200, content-type: text/plain; charset=utf-8
  body: db6dbf5cfdbc08d1cc9b5365d398145b
```

Submission via the shared aggregator:

```
node scripts/indexnow.mjs
  key file OK at https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt
  sitemap 154 URLs -> submitting 154 (permutations excluded)
  https://api.indexnow.org/indexnow batch 0-99:   200
  https://api.indexnow.org/indexnow batch 100-153: 200
  accepted 154, failed 0
```

And directly to each participating engine, same 154-URL payload:

```
https://www.bing.com/indexnow            -> HTTP 200 ""
https://yandex.com/indexnow              -> HTTP 200 {"success":true}
https://search.seznam.cz/indexnow        -> HTTP 200 ""
https://searchadvisor.naver.com/indexnow -> HTTP 200 ""
```

**Stated plainly: a 200 from IndexNow means *accepted for consideration*. It does not mean
crawled, and it certainly does not mean indexed.** IndexNow exposes no status or read-back
API, so there is no way to verify effect except by re-measuring the index later.
**Re-measure on 2026-09-24** (14 days) with `node scripts/ai-index-probe.mjs`. The number to
watch is Brave depth, currently 1; and bingbot's URL coverage in `data/traffic.json`,
currently 35/141.

Also note Brave is **not** an IndexNow participant, so this submission cannot move the one
index we have proven we are in.

### Defect found: two different IndexNow keys in the repo

`data/indexnow.json` and `data/indexnow_key.txt` carry `db6dbf5c...145b`; `data/indexnow.key`
carries a *different* key, `22fad93b71a88e2e60acae203c4288ae`. Both are served at their
`.txt` locations with HTTP 200, so nothing is currently broken — IndexNow permits multiple
keys per host — but a future script that picks `indexnow.key` while quoting the
`indexnow.json` `keyLocation` would sign submissions with a mismatched pair and be rejected.
Left as-is (not my file); flagged for the owner.

---

## 7. Bing Webmaster Tools — human-gated, stop

There is no keyless path. The API rejects an empty or invented key:

```
curl -sS 'https://ssl.bing.com/webmaster/api.svc/json/GetUrlSubmissionQuota?siteUrl=https%3A%2F%2Fmcp.zovo.one&apikey=x'
  {"ErrorCode":3,"Message":"ERROR!!! InvalidApiKey"}
```

The key can only be minted from inside a signed-in account. Per the brief's rule 6, no
sign-in was attempted.

- **Exact URL:** `https://www.bing.com/webmasters/` → sign in → add & verify `mcp.zovo.one`
  → **Settings → API access → API Key** → *Generate*.
- **Docs:** `https://learn.microsoft.com/en-us/bingwebmaster/getting-access` (HTTP 200).
- **Fields the human must supply:** a Microsoft/Google/Facebook sign-in, then site
  verification for `https://mcp.zovo.one/` (XML file, meta tag, or CNAME).
- **Why it is worth the five minutes:** Bing Webmaster is the *only* way to get a true
  indexed-URL count for Bing. Section 1 proves Bing's public surfaces cannot answer it —
  the ChatGPT-facing index is the one number this loop could not obtain.

---

## 8. Verdict and what actually follows

1. **`mcp.zovo.one` is present in Brave — the index Claude's web search retrieves from.**
   This is the first evidence of any live assistant-visible organic surface for this host,
   and it was never checked in 99 days of staring at Google.
2. **The depth is 1 URL of 154.** Presence is not a channel. Everything the catalogue knows
   — 15 guides, 19 compare pages, 32 server pages — is unretrievable in that index.
3. **It converts to nothing at current rank.** 0 of 14 measured buyer-intent queries put us
   in the top 10; the two appearances are rank 16 and 21.
4. **The pages are not technically broken.** Canonicals, titles and robots.txt are all
   correct. Nothing in the HTML is worth "fixing" — this is authority, not markup.
5. **The Bing number does not exist yet** and cannot be obtained without a human sign-in.
6. **Perplexity is not a channel** — PerplexityBot has fetched 5 URLs, 3.5% of the sitemap.

The strategic read, stated cold: assistants answering MCP buyer questions return **GitHub
repos and MCP directory rows**, not vendor storefronts — that is what won all 15 queries here
and every recommendation in `BLIND_RECOMMENDATION_R1.md`. A storefront subdomain with one
indexed URL is competing in the wrong format. The 85+ registry names and
`github.com/theluckystrike/*` are the assets shaped like what actually ranks, and
`github.com/theluckystrike/*` currently appears for **zero** of these queries. That gap,
not the storefront's markup, is where the next loop's effort belongs.

---

## Provenance of each number

- **Bing rows** are machine-generated: `node scripts/ai-index-probe.mjs --only bing_rss,bing_html`
  exited 0, 30 buyer-query runs measured, and the script itself placed both endpoints in
  `endpoints_that_cannot_prove_absence` because the domain control failed. Their zeros are
  recorded as unmeasured, exactly as intended.
- **Brave rows** were measured by direct `curl` spaced 14-30s apart. Brave rate-limits to
  roughly **two requests per ~24s window** before returning 429, so a scripted sweep spends
  its wall clock in backoff; by the end of this session Brave was returning 429 to every
  request from this IP, including the `site:zovo.one` control. Every Brave number in this
  report was taken from an **HTTP 200** response and carries the command that produced it.
  A re-run of `node scripts/ai-index-probe.mjs --only brave` from a cooled-down IP
  regenerates them automatically (the endpoint delay is now 30s for this reason).
- That final 429 is itself a demonstration of the instrument's core rule: the run that hit
  it recorded `present: null, unmeasured: true`, not `0 URLs`. Under the first version of
  this script it would have been published as "mcp.zovo.one is absent from Brave".

## Reproducing

```
node scripts/ai-index-probe.mjs                                   # all 10 endpoints (slow: blocked endpoints back off)
node scripts/ai-index-probe.mjs --controls-only                   # just qualify the endpoints
node scripts/ai-index-probe.mjs --only brave,bing_rss,bing_html   # the endpoints that qualified
```

The script refuses to report a zero from an endpoint that has not passed liveness,
discrimination, and — for `site:` numbers — the site-operator control. Blocked and throttled
responses are recorded as `unmeasured: true` with `present: null`, never as `present: false`.
It is slow by design against rate-limited hosts; under heavy machine load a full ten-endpoint
sweep can exceed 30 minutes.
