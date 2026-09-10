# Why Google indexes zovo.one and will not touch mcp.zovo.one (loop 33, 2026-09-10)

Machine-readable: `data/google_index_r1.json`. Every number below carries the call that produced it.

---

## The instrument, and a memory note that held

`~/Desktop/keys/gsc-sa-key.json` is iCloud-dataless and **hangs**, exactly as the operator's note says:

    $ timeout 20 /usr/bin/wc -l /Users/mike/Desktop/keys/gsc-sa-key.json
    (no output)  exit 124

That is the failure that looks like an outage. The working copy is elsewhere on disk, off iCloud:

    /Users/mike/.config/gcloud/legacy_credentials/zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com/adc.json

Same service account `data/indexation.json` records for prior loops, so these numbers are comparable to
theirs. Positive control before trusting anything from it: `webmasters/v3/sites` returned 51 properties
including `sc-domain:zovo.one` at `siteFullUser`. That permission level matters later.

---

## First, a correction: it is not zero any more. It is one.

`searchAnalytics/query`, `sc-domain:zovo.one`, dimensions `page` + `date`, filter `page contains
mcp.zovo.one`, run over 28 days and again over 90 days. Both return **exactly one row**:

| URL | Date | Impressions | Clicks | Avg position |
|---|---|---|---|---|
| https://mcp.zovo.one/ | 2026-09-08 | 1 | 0 | **7.0** |

The unfiltered control on the same call: 429 pages, 53 clicks, 4,505 impressions, split by host
zovo.one 4,435 / www.zovo.one 69 / mcp.zovo.one 1.

**The day the homepage entered the index is the day it drew an impression, at position 7.** Whatever is
wrong here, it is not ranking and it is not relevance. It is indexation, and indexation only.

---

## The hypothesis is false as stated. The corrected version is much sharper.

The brief's hypothesis: *almost no internal link equity flows to mcp.zovo.one from the indexed part of
zovo.one.*

Measurement: fetch all 429 zovo.one URLs that drew an impression in the window, with the documented
Googlebot UA, and parse every `href`.

| Measure | Value |
|---|---|
| zovo.one pages fetched | 429 |
| pages carrying a followed link to mcp.zovo.one | **129 (30.1%)** |
| distinct mcp.zovo.one URLs those 129 links point at | **1** |
| that URL | `https://mcp.zovo.one`, 129 times |
| www.zovo.one pages linking to it | 0 |
| deep mcp.zovo.one URLs linked from anywhere on zovo.one | **0** |

The link is a single sitewide `<footer>` anchor, `MCP servers for Claude`, no `rel` attribute, emitted
server-side (`api/render.ts:1244`), so it survives a Googlebot-UA fetch with scripts stripped.

Are those 129 pages real index members, or only pages that were served once? Fifteen drawn at random,
URL Inspection: **15 of 15 PASS, "Submitted and indexed"**. They are real.

So equity flows, and there is a lot of it. It is the *distribution* that is degenerate:

> **100 percent of the subdomain's inbound link equity lands on one URL, and that one URL is the only
> one Google has ever crawled, the only one indexed, and the only one with an impression.**

---

## What Google says about the other 153

Full census, `urlInspection/index:inspect`, one call per sitemap URL, `siteUrl: sc-domain:zovo.one`,
154 URLs, 0 API errors:

| Coverage state | Count |
|---|---|
| Discovered - currently not indexed | 115 |
| URL is unknown to Google | 38 |
| Submitted and indexed | **1** |
| **ever crawled (lastCrawlTime non-null)** | **1** |

By section: `/guides` 0 of 90, `/s` 0 of 32, `/compare` 0 of 20, `/setup` 0 of 8, `/bundle`,
`/changelog`, `/privacy` 0 of 1 each. `/` is the one.

The signature is **`Discovered - currently not indexed` with `lastCrawlTime: null`**. Google holds the
URLs and has never fetched them.

Against the 2026-09-09 baseline in `data/indexation.json`: `in_google_index` 1 → 1,
`ever_crawled_by_google` 1 → 1. The known/unknown split moved 52/89 → 116/38 but that split is noise,
and this run reproduced the instability inside 30 minutes:
`/guides/mcp-config-scopes-and-precedence` read `Discovered` at 20:45Z and `URL is unknown to Google`
at 21:15Z, while `/guides/mcp-tool-errors-versus-protocol-errors` moved the opposite way. Only
`in_index` and `ever_crawled` are stable, and both are 1.

---

## Every competing explanation, killed with its test

| Explanation | Test | Result | Verdict |
|---|---|---|---|
| robots.txt blocks, or Cloudflare injects Disallow for AI crawlers into the served file | served bytes vs the literal in `billing/src/index.js:1088` | 154 served bytes, **character-identical** to repo. `Allow: /`. Disallows are `/buy/ /success /recover /verify /bound` only. No injection. | KILLED |
| canonical points off-host | parsed `rel=canonical` on `/`, `/s/invoice`, `/guides/mcp-config-scopes-and-precedence` | self-referential on all three | KILLED |
| noindex header or meta | `curl -I` on three URLs; robots-meta scan on 12 sitemap URLs | no `x-robots-tag` anywhere; 0 of 12 carry a robots meta. The `noindex,follow` rule at `billing/src/index.js:1059` fires only on 3-segment paths and no sitemap URL has three segments. | KILLED |
| hreflang | grep on `/` and `/s/invoice` | 0 elements | KILLED |
| Cloudflare serves Googlebot different bytes | fetched `/` and `/s/invoice` with Googlebot UA and Chrome UA, diffed | identical lengths (60,135 and 38,335); the only differing bytes are the Cloudflare challenge-platform ray id and unix timestamp | KILLED |
| the page needs JS to render | stripped `<script>` and `<style>`, counted text | 33,535 chars on `/`, 23,042 on `/s/invoice` | KILLED |
| sitemap invalid, unreachable or unread | `webmasters/v3 sitemaps` | `mcp.zovo.one/sitemap.xml`: lastSubmitted **2026-09-04T01:41:21Z**, lastDownloaded 2026-09-09T22:42:45Z, errors 0, warnings 0, isPending false, submitted 154 | KILLED |
| **thin / duplicate content across the setup permutations** — loop 29's operative hypothesis | census `lastCrawlTime` over all 154 | **1 of 154 has ever been fetched** | **KILLED as the operative cause** |

That last row is the one that changes the plan. **A crawler that has never fetched a page cannot have
declined it on content.** The 312 → 154 sitemap trim was defensible hygiene, but it fixed an evaluation
Google has not performed and could not have moved this number.

Two instrument warnings for whoever runs this next:

- The sitemaps API `indexed` field reads **0 for every sitemap on this property**, including zovo.one's
  own 714-URL sitemap whose pages are demonstrably indexed. It is not an instrument. Do not quote it.
- crt.sh was tried as a way to date the subdomain and returned **0 certificates** for mcp.zovo.one,
  because Cloudflare universal SSL covers it under a wildcard, and the zovo.one control query failed to
  parse. That is **unmeasured, not zero**, and no host-age number is claimed from it.

---

## Is the split host-level? Yes — and the sibling subdomain shows the mechanism

Same call, same property, same evening, comparable depth and content type:

| URL | Verdict | Coverage | Last crawl |
|---|---|---|---|
| zovo.one/ | PASS | Submitted and indexed | 2026-09-10 |
| zovo.one/tools | PASS | Submitted and indexed | 2026-08-10 |
| zovo.one/glossary | PASS | Submitted and indexed | 2026-08-15 |
| zovo.one/free-tools/html-entity-encoder | PASS | Submitted and indexed | 2026-07-16 |
| zovo.one/free-tools/flow-chart-maker | PASS | Submitted and indexed | 2026-08-15 |
| zovo.one/best/best-free-tab-manager-chrome-extensions | PASS | Submitted and indexed | 2026-08-29 |
| zovo.one/use-cases/recovering-accidentally-overwritten-text | PASS | Submitted and indexed | 2026-09-06 |
| zovo.one/blog/chrome-bookmarks-disappeared-recovery.html | PASS | Indexed, though blocked by robots.txt | 2026-05-20 |
| **8 of 8** | | | |
| mcp.zovo.one/ | PASS | Submitted and indexed | 2026-09-08 |
| mcp.zovo.one/s/invoice | NEUTRAL | Discovered - currently not indexed | **never** |
| mcp.zovo.one/s/time-tracker | NEUTRAL | Discovered - currently not indexed | never |
| mcp.zovo.one/s/spreadsheet | NEUTRAL | Discovered - currently not indexed | never |
| mcp.zovo.one/bundle | NEUTRAL | Discovered - currently not indexed | never |
| mcp.zovo.one/changelog | NEUTRAL | Discovered - currently not indexed | never |
| mcp.zovo.one/privacy | NEUTRAL | Discovered - currently not indexed | never |
| mcp.zovo.one/guides/… (3 sampled) | NEUTRAL | Discovered / unknown | never |
| mcp.zovo.one/compare/invoice-vs-quickbooks | NEUTRAL | URL is unknown to Google | never |
| **1 of 11** | | | |

`zovo.one/free-tools/html-entity-encoder` and `mcp.zovo.one/s/invoice` are the same shape, the same
depth, the same property. One is indexed; the other has never been fetched. **The split is host-level.**

Now the control that stops this from being a story about our content. `tg.zovo.one` is a second new
subdomain of the same parent, carrying the same single sitewide footer anchor:

| URL | Verdict | Coverage | Last crawl |
|---|---|---|---|
| tg.zovo.one/ | PASS | Submitted and indexed | 2026-09-04 |
| tg.zovo.one/ru/ | PASS | Submitted and indexed | 2026-09-09 |
| tg.zovo.one/es/ | PASS | Submitted and indexed | 2026-09-06 |
| tg.zovo.one/pt/ | PASS | Submitted and indexed | 2026-09-09 |
| tg.zovo.one/de/ | PASS | Submitted and indexed | 2026-09-06 |
| tg.zovo.one/id/ | NEUTRAL | Crawled - currently not indexed | 2026-09-08 |
| tg.zovo.one/{,ru,es,pt,id,de}/bots/whisper/ | NEUTRAL | Discovered / unknown, **0 of 6** | **never** |

Identical shape: the entry ring gets crawled, everything below it does not. So mcp.zovo.one is not
being singled out and nothing about its content is being punished. It is roughly four days behind
tg.zovo.one on the same ramp, and **its entry ring is one URL wide because every inbound link it has
points at `/`.**

---

## The cause, stated so it can be acted on

> mcp.zovo.one is a six-day-old crawl target whose entire inbound link graph resolves to a single URL.
> Google has discovered all 154 sitemap URLs — the sitemap is valid, downloaded, error-free, and every
> deep URL is also linked from the one page Google did crawl — and has fetched exactly one of them: the
> one that is linked. The rest sit in a Discovered queue that has not drained since the sitemap was
> submitted on 2026-09-04 (that is `lastSubmitted`; it has not been resubmitted since, and Google re-downloads it on its own).

The only signal in that chain under our control is the number of mcp.zovo.one URLs that carry their own
independent inbound link from a page Google already crawls. Today that number is **one**.

### The honest counter-evidence against my own fix

Loop 32 placed exactly this lever: three honest deep contextual links from indexed claudflow.com and
claudhq.com pages on 2026-09-09. All three are still live (verified today by exact-href grep, 3 of 3).
Twenty-four hours later all three targets read `Discovered` or `unknown`, **never crawled**. The lever
has produced zero movement at n=3, t=1 day. What follows is the same lever at larger n. It has to be
judged on a later census, not on this one.

---

## What I changed

**Repo: `/Users/mike/extension-insiders`** (`git@github.com:theluckystrike/extension-insiders.git`) —
the SSR renderer behind zovo.one. **File: `api/render.ts`. Not committed, not pushed, not deployed.**
`git diff --numstat` = `6 1`. `npx tsc --noEmit --skipLibCheck api/render.ts` exits 0 with no
diagnostics. Backup of the original at `scratchpad/render.ts.bak`.

Every host page was checked with URL Inspection **before** it was chosen, not with impressions — the
correction loop 32 recorded. All five are `Submitted and indexed`.

| Host page (indexed, last crawl) | Exact href added | Anchor | Placement |
|---|---|---|---|
| zovo.one/open-source (2026-09-08) | `https://mcp.zovo.one/s/invoice` | the invoice server and its source | body prose, "Reading the Code" |
| zovo.one/free-tools (2026-09-06) | `https://mcp.zovo.one/guides/free-mcp-servers-for-freelancers` | what those servers actually do on the free tier | body prose, "Elsewhere on Zovo" |
| zovo.one/tools (2026-08-10) | `https://mcp.zovo.one/s/spreadsheet` | ask a spreadsheet on your own disk what is in it | body prose, "Free Browser Tools" |
| zovo.one/about (2026-09-10) | `https://mcp.zovo.one/s/time-tracker` | Tracking billable time from inside an AI chat | list item, "Where to Start" |
| zovo.one/guides (2026-09-06) | `https://mcp.zovo.one/guides/claude-mcp-add-command-reference` | claude mcp add, flag by flag | list item, "Explore More" |

Five distinct deep targets across two path types, none pointing at the home page Google already has.
Each claim was verified against the target page before the anchor was written: `/s/spreadsheet` does say
"Point it at any .xlsx … file on your machine and ask what is in it"; `/s/time-tracker` does say "Track
billable time without leaving your AI chat"; `/s/invoice` does carry a Source link to
`github.com/theluckystrike/mcp-servers/tree/main/servers/invoice`.

**One more edit, and it is a repair, not an addition.** `api/render.ts:1244` emitted only the
mcp.zovo.one footer anchor, but the live footer serves two:

    <footer><a href="https://mcp.zovo.one">MCP servers for Claude</a> · <a href="https://tg.zovo.one/">Telegram bots for reminders, expenses &amp; habits</a></footer>

The repo was behind live. Deploying it as it stood would have **deleted a live link from every page on
zovo.one** — the exact failure the operator's "live-only pages get wiped" note describes. The restored
bytes are copied verbatim from the live response.

If deployed, this takes the number of deep mcp.zovo.one URLs with an inbound link from an indexed page
from **3 to 8**.

---

## Before and after, per URL

Both readings are from the same API on the same evening. **The edits are not deployed, so no change is
expected between them and none is claimed.** This is the baseline the next census compares against.

| URL | Before (20:45Z) | After (21:15Z) |
|---|---|---|
| mcp.zovo.one/ | PASS, indexed, crawled 2026-09-08T17:20:24Z | PASS, indexed, crawled 2026-09-08T17:20:24Z |
| mcp.zovo.one/s/invoice | Discovered, never | Discovered, never |
| mcp.zovo.one/s/spreadsheet | Discovered, never | Discovered, never |
| mcp.zovo.one/s/time-tracker | Discovered, never | Discovered, never |
| mcp.zovo.one/guides/free-mcp-servers-for-freelancers | (in census) Discovered, never | Discovered, never |
| mcp.zovo.one/guides/claude-mcp-add-command-reference | (in census) Discovered, never | Discovered, never |
| mcp.zovo.one/guides/answer-questions-about-a-spreadsheet-without-formulas | Discovered, never | Discovered, never |
| mcp.zovo.one/guides/mcp-config-scopes-and-precedence | Discovered, never | **unknown**, never |
| mcp.zovo.one/guides/mcp-tool-errors-versus-protocol-errors | **unknown**, never | Discovered, never |

The two that flipped are the split-instability artefact, not movement. Whole-estate: `in_index` 1,
`ever_crawled` 1, before and after.

---

## One free unlock that needs the operator, with the exact fields

The Google Indexing API would submit all 154 URLs for crawl with no browser and no cost. It was tried:

    POST https://indexing.googleapis.com/v3/urlNotifications:publish
    {"url":"https://mcp.zovo.one/s/invoice","type":"URL_UPDATED"}
    -> HTTP 403  PERMISSION_DENIED  "Permission denied. Failed to verify the URL ownership."

The service account is `siteFullUser` on `sc-domain:zovo.one`, not `siteOwner`, and Search Console
exposes no API to add an owner. **Human-gated, ~30 seconds, free:**

> Search Console → `sc-domain:zovo.one` → Settings → Users and permissions → Add user →
> `zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com` → permission **Owner**

Caveat, stated rather than buried: Google documents the Indexing API as supporting JobPosting and
BroadcastEvent only. The ownership 403 fires before any type check, so whether it would accept these
URLs is untested behind it.

---

## One defect found in a file I do not own

`billing/src/index.js` serves all of mcp.zovo.one (`remote/wrangler.toml` routes only
`mcp.zovo.one/mcp*` to the other worker). Its sitemap ships **zero `<lastmod>` elements**:

    $ curl -sS https://mcp.zovo.one/sitemap.xml | /usr/bin/grep -c '<lastmod>'
    0

`lastmod` is the only field the sitemap protocol gives a crawler for ordering its queue. On a host whose
entire problem is a Discovered queue that has not drained in six days, shipping no freshness signal
removes the one scheduling hint we control. Handing this to whoever owns that file.

---

## Verdict

Google is not declining mcp.zovo.one's content, because it has never read it. It is spending a new
host's small crawl allowance on the only URL anything links to, and 153 URLs are queued behind a link
graph one URL wide. The fix is more distinct linked entry points, not better pages; the sitemap trim of
loop 29 could not have moved this and did not. The lever has one day of null evidence against it at
n=3, five more placements are staged in `extension-insiders` awaiting a deploy, and the reading that
settles it is `ever_crawled_by_google` on the next census — 1 today, on 154 URLs.
