# Three instruments, one conclusion

Loop 33 ran three measurements that did not share a method, a data source or an author. They
returned the same answer. That is the loop's result, and it is worth more than any individual
number in it.

## What each one measured, separately

**The blind recommendation test.** A subagent with no knowledge of this estate researched 18
buyer-intent questions with web search and named the server it would recommend. It named 47
distinct servers and not one was ours. Counting every URL it cited: github.com 21, glama.ai 7,
ours 4, apify.com 4, mcpservers.org 3, and the official MCP registry 0. Twenty of the 21 GitHub
citations are individual one-server repositories, and 6 of the 7 Glama citations are the
servers directory rather than the connectors surface we are actually on.

**The assistant-index measurement.** `mcp.zovo.one` IS present in Brave, the index Claude's web
search retrieves from. That is the first evidence in 99 days of any live assistant-visible
surface for this host, and nobody had checked because everyone was watching Google. But the
depth is **1 URL of 154**, 0 of 14 buyer queries put us in the top ten, and the two appearances
sit at rank 16 and 21. The pages are not technically broken: canonicals, titles and robots are
all correct. This is authority, not markup. PerplexityBot has fetched 5 URLs, 3.5% of the
sitemap, so Perplexity is not a channel either.

**The GitHub search measurement.** Repository search indexes name, description and topics and
nothing else, proved with a control pair: a word present only in a repo's topics matches, a
word present only in its package.json does not. Query-term coverage is the gate, at 1.00 mean
coverage for queries where we surfaced and 0.90 where we did not, with every sub-1.00 query
returning nothing of ours. And stars are **not** the ranking factor: across 87 competitor repos
captured in top-five results the median is 1 star and 35 have zero, while the top result for
three separate buyer queries had zero, zero and three stars with no topics at all.

## The conclusion all three reach

**Assistants answering MCP buyer questions return GitHub repositories and directory rows, not
vendor storefronts.** A storefront subdomain is competing in the wrong format. It does not
matter how good its markup is, how many guides it carries or how well its sitemap is tuned,
because the shape of thing that wins these queries is a repository.

The corollary is the useful part. The asset that is already shaped like what wins is the 32
one-server mirror repositories, and `github.com/theluckystrike/*` currently appears for **zero**
of these queries. The gap between owning 32 correctly-shaped assets and ranking for none of
them is the entire opportunity, and the GitHub measurement says the gate on it is word coverage
in three fields rather than popularity, which is a thing that can be fixed in an afternoon.

## What this retires

Effort on the storefront's technical SEO. It is not broken. Two separate measurements say so.

Effort on the official MCP registry's ranking. 443 places were gained across ten contested
tokens in a previous loop and the registry was cited zero times here. Its real job is as an
upstream that `api.mcp.github.com` and Glama consume, which is worth keeping current and worth
no further optimisation.

Effort on the Glama connector score as a discovery lever. The connectors index holds 19,647
entries and its sort options are Featured, Search Relevance, GitHub Stars, Name and Date
Updated. Tool quality score is not among them. The score still matters for a reader who lands
on the page, and the shared tool definitions had genuine defects worth fixing, but it ranks
nothing.

Effort on the VS Code gallery. The subfolder hypothesis is refuted, 14 of 252 entries do use a
monorepo subfolder, and the real onboarding route is a public discussion thread whose measured
yield is 2 of 11 with the 2026-07 to 2026-09 cohort at 0 of 8.

## The honest caveat

None of this establishes that anyone will pay. The blind test found that the question "where do
I find MCP servers that cost money, and how do I pay for one" has no consensus answer anywhere,
which is either the best opportunity in the estate or evidence that the market for paid MCP
servers has not formed yet. Those two readings are not distinguishable from the data available,
and the loop should not pretend otherwise.
