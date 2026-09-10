# Loop 33 brief (2026-09-10)

Loops 29-32 briefs still apply. This states the thesis for this loop and the hard rules.

## The thesis, stated cold

Two numbers set this loop's agenda:

1. `mcp.zovo.one` has had **0 Google impressions in 99+ days** while `zovo.one` returns
   4,746 impressions and 59 clicks in the same 28-day window on the same verified property.
   Googlebot fetched robots.txt and sitemap.xml repeatedly and then crawled 2 of 141 URLs.
   Google is not blocked. Google is declining. A subdomain is a separate crawl-budget unit
   and this one has never earned any.
2. **ClaudeBot crawled 311 of 312 URLs.** Assistant crawlers already hold this catalogue.
   The buyer of an MCP server is a person who asks an assistant "what can generate an
   invoice for me" - not a person who types a query into Google.

So: stop optimising the channel that is closed and instrument the channel that is open.
The loop's primary question is **does a general-purpose assistant name our servers when
asked the question a buyer would actually ask**, and if not, what changes that.

## Hard rules, unchanged

1. A description must be true of the code. Improving a score by overstating behaviour is a defect.
2. Never rename a tool, a parameter or a schema field.
3. Tool descriptions are a BUILD INPUT. `remote/build-vendor.mjs` patches ~113 exact strings,
   several of them descriptions, and throws on a miss. If you touch any description under
   `servers/*/src`, `/usr/bin/grep -n '<server> <tool> description' remote/build-vendor.mjs`
   first, update both sides, and make `node remote/build-vendor.mjs` exiting cleanly part of
   your verification.
4. Use `/usr/bin/grep`. Plain `grep` is a shell function here and can silently return nothing.
5. **No paid anything.** No paid APIs, no listing fees, no featured slots, no paid review.
   If a surface's only submit control costs money, record `skipped: paid` and move on.
6. **No account creation, no OAuth sign-in, no browser login.** If a path needs one, record it
   as human-gated with the exact URL and the exact fields, and stop.
7. Own only your assigned files. Do NOT deploy. Do NOT `git push`. The orchestrator deploys.
8. Do not run `killall`. See the operator's standing note: it wedges the process table here.

## Evidence rules

- Every number in your report carries the command that produced it and the raw output.
- A 200 is not evidence of anything except a 200.
- Run a **positive control** for any instrument before you trust a zero from it. A zero from
  an instrument that has never returned non-zero is unmeasured, not proven.
- NEVER quote GitHub release `download_count` as installs. Across 597 assets the distribution
  is near-uniform (mean 8.90, CV 0.417); that is a machine sweeping, not demand.
- NEVER quote the /buy/ click counter as human demand; its scripted-UA guard is start-anchored
  and our own probes are in it. Probe with `-I` or send `x-mcp-probe: 1`.

## Where things stand

- 32 servers under `servers/`, 30 with hosted endpoints at `https://mcp.zovo.one/mcp/<name>`.
- 85+ registry names live. Storefront + 89 setup pages + 15 guides. Sitemap 154.
- Estate is green: root `npm test` clean, live validation 951/951, billing gates 107/107.
- Hosted endpoints answer unauthenticated `initialize` with 200 (a 401 there had us published
  as DOWN by Glama). Note they answer **406** to a POST whose Accept header lacks
  `text/event-stream`; that is transport-spec correct but may be read as dead by naive probers.
- Revenue to date: zero.

## Reporting

Write your findings to the file named in your brief under `docs/`, and machine-readable
numbers to the file named under `data/`. Finish with a short verdict that a reader who did
not watch you work can act on.
