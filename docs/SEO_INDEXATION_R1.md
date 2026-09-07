# Why Google will not index this site (loop 29, 2026-09-07)

## The two facts that matter

Google has never sent this site a single impression. The Search Console property
`sc-domain:zovo.one` is verified and does cover the subdomain; a 28-day pull returned
63 clicks and 4,498 impressions for the property and exactly 0 for any mcp.zovo.one page,
with a positive control on `//zovo.one/` returning 63 clicks and 4,392 impressions to
prove the filter works. An archive covering 2026-05-31 to 2026-08-28 agrees. So the count
is zero across at least 99 days.

Google is not being blocked. It is declining. Over 7 days Googlebot fetched robots.txt
four times and sitemap.xml seven times, then crawled two pages: `/` and `/s/invoice`.
Two of 312. Meanwhile ClaudeBot crawled 311 of 312, Amazonbot 239, GPTBot 144 and
bingbot 102. Serving is fine: Googlebot receives HTTP 200 and 20,101 characters of real
text on /s/invoice, and robots.txt allows everything.

A crawler that reads your sitemap seven times and then takes two pages has looked at what
you are offering and decided most of it is not worth its budget.

## The most likely reason, measured

The sitemap is mostly near-duplicate permutations.

| Section | URLs | Share |
|---|---|---|
| /setup/** | 224 | 71.8% |
| /guides/** | 35 | 11.2% |
| /s/** | 30 | 9.6% |
| /compare/** | 20 | 6.4% |
| /, /bundle, /changelog | 3 | 1.0% |

216 of those setup URLs are the product of 8 clients and 27 products. Measured text
similarity between sibling pages, scripts and styles stripped:

| Pair type | Similarity |
|---|---|
| Same client, different product | 73.6% to 77.5% |
| Same product, different client | 44.1% to 54.7% |

So roughly seven-tenths of what the sitemap advertises is three-quarters boilerplate. That
is the classic combinatorial doorway shape, and on a subdomain created 2026-09-02 with no
inbound links and no authority it is a strong reason for a search engine to decline the
whole set rather than sample it.

Those pages are also not earning their place with users. Across all 224 setup URLs there
were 8 human page views in 7 days, spread over 7 pages. All 20 /compare pages got zero.

## The fix, and why it is low risk

Reduce the sitemap to the pages worth crawling: the home page, /bundle, /changelog, the
30 /s product pages, the 35 guides, the 20 comparisons and the 8 per-client setup index
pages. That is about 96 URLs instead of 312. Add `noindex, follow` to the 216 permutation
pages so they keep passing link value and stay available to users who land on them, but
stop diluting the set a crawler is asked to judge.

This is reversible. Nothing is deleted, no URL 404s, and if Google starts crawling the
smaller set the permutations can be reintroduced in batches once the domain has standing.

## The channel that is actually working

ClaudeBot fetched 311 of 312 URLs. GPTBot took 144 and Amazonbot 239. Assistant crawlers
have this catalogue; Google does not. For a product whose buyers live inside Claude,
Cursor and VS Code, that is the channel to write for. It argues for keeping llms.txt
complete and accurate, for factual pages that answer a question outright, and against
spending another round on pages built for a search engine that is not reading them.

## Human traffic, for scale

7 days of Cloudflare data, with a render-engine test used to separate real browsers from
spoofed user agents: 218 human page views in total, 64 excluding the home page, spread
across 49 of the other 311 URLs. 109 URLs received nothing from any browser-shaped agent.
The ten best pages after the home page score 2 or 3 views each. Country split of proven
browser views is US 107, FR 58, CN 28, IE 19, PL 4, so this is not the operator's own
traffic.
