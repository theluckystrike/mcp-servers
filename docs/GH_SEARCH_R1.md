# GitHub as the front door: clone traffic, repo search rank, and what the mirrors changed

Round 1, measured and applied 2026-09-10. Agent A10.

Everything below carries the command that produced it. A 200 is not evidence of anything
except a 200, and a zero from an instrument that has never returned non-zero is
unmeasured, not proven; every zero here has a positive control beside it.

---

## 1. What the clone traffic actually is

The headline numbers on `theluckystrike/mcp-servers`:

```
$ gh api repos/theluckystrike/mcp-servers/traffic/clones
{"count":3410,"uniques":502,...}
$ gh api repos/theluckystrike/mcp-servers/traffic/views
views 54 uniques 31
$ gh api repos/theluckystrike/mcp-servers/traffic/popular/referrers
registry.modelcontextprotocol.io 21 (10 uniques) | github.com 1 | mcp.zovo.one 1
```

### The window is 8 days, not 14

```
$ gh api repos/theluckystrike/mcp-servers --jq .created_at
2026-09-02T12:49:39Z
```

The repository was **created on 2026-09-02**. The six zero days at the head of the 14-day
traffic series are not quiet days, they are days before the repository existed. Any rate
computed over 14 days understates by ~1.75x, and the "0 stars in 14 days" figure is really
"0 stars in 8 days".

### It is not our CI

```
$ gh api "repos/theluckystrike/mcp-servers/actions/runs?per_page=100" \
    --jq '.workflow_runs[] | select(.created_at > "2026-08-27") | .created_at' | wc -l
2
$ gh api "repos/theluckystrike/mcp-invoice/actions/runs?per_page=100" ... | wc -l
1
```

Two workflow runs on the monorepo and one on a mirror in the whole window. Three
`actions/checkout` events cannot account for 3,410 clones. Proven not-us.

### It is ecosystem-wide, not a sweep aimed at the monorepo

Every one of the 32 mirrors shows the same shape: zero until the repo is created in early
September, a spike, then decay.

```
$ for n in $(ls servers/); do gh api repos/theluckystrike/mcp-$n/traffic/clones \
    --jq '[(.count|tostring),(.uniques|tostring)]|join(" ")'; done
invoice 341 97 | docx 318 90 | time-tracker 318 88 | office-suite 310 82 | ...
delivery-schedule 20 13 | change-order 31 19 | petty-cash 46 22
```

Mirror clone totals run 20 to 341, uniques 13 to 97. So the monorepo is not being singled
out; the whole account is being read by machines.

### There is an ambient floor, and we are above it

Control repos in the same account that no directory lists and no tooling touches:

```
telegram-trivia-bot           37 clones / 25 uniques
telegram-expense-tracker-bot  31 clones / 21 uniques
geo-citation-check            26 clones / 16 uniques
mcp-registry (a Docker fork)  30 clones / 21 uniques
awesome-mcp (a fork)           5 clones /  5 uniques
```

So a brand-new public GitHub repository that nobody has heard of collects roughly **20-25
unique cloners** within days. That is the ambient scanner floor. Against it:

| | clones | uniques | vs floor (uniques) |
|---|---|---|---|
| ambient control repos | 26-37 | 16-25 | 1x |
| median mirror | ~200 | ~62 | ~3x |
| `mcp-servers` monorepo | 3,410 | 502 | ~22x |

**What is proven:** the traffic is not our CI; it is account-wide, not monorepo-specific;
and the monorepo sits about 22x above the ambient floor while mirrors sit about 3x above
it. The ratio of 3,410 clones to 502 uniques is 6.8 clones per distinct client, which is
the behaviour of an automated fetcher, not of a person evaluating a project.

**What is unknown:** who the 502 are. GitHub's traffic API exposes no user agent, IP or
identity for cloners, so the composition cannot be determined from here. The elevation
above the floor correlates with the monorepo being the entry listed in the MCP registry
(the only referrer with meaningful volume, 21 hits from 10 uniques), but that is a
correlation across two populations, not a demonstrated cause.

**These are not installs and must never be reported as such.** 54 human page views against
3,410 clones is a machine-to-human ratio of 63:1, and the honest reading of the clone
number is "the catalogue is being indexed", not "500 people tried it".

---

## 2. GitHub repository search: the baseline

`scripts/gh-search-rank.mjs` runs 34 buyer-intent queries derived from the 32 servers
through `gh api search/repositories`, records the total result count and our best rank in
the top 30, and captures the top 5 competitors per query with their description, topics
and star count. Raw data in `data/gh_search_r1.json`.

The script runs a positive control first (`q=modelcontextprotocol` must return a non-empty
result set) and aborts otherwise, and retries a 403 with backoff, because the search
endpoint answers 403 at 30 requests/minute and an unretried 403 is indistinguishable in the
output from "nobody has this repo".

**Baseline, 2026-09-10, before any change: 22 of 34 queries surfaced a `theluckystrike`
repo in the top 30.** No errors.

Best ranks: 12 firsts, 5 seconds, and then a long tail. But the ranks separate almost
perfectly on how contested the query is:

| results for the query | queries | in top 30 | in top 3 |
|---|---|---|---|
| 1-3 (uncontested) | 17 | 11 | **11** |
| 4-10 | 5 | 3 | 3 |
| 11-30 | 5 | 3 | 1 |
| 31+ (contested) | 7 | 5 | **0** |

We own the uncontested long tail (`mcp per diem travel allowance`, 1 result, rank 1) and
have never once reached the top 3 of a query with a real field. That is the whole picture
in one table.

---

## 3. What GitHub repo search ranks on, measured

### Only name, description and topics. Not file contents.

```
$ gh api -X GET search/repositories -f "q=repo:theluckystrike/mcp-invoice vat"     -> total=1
$ gh api -X GET search/repositories -f "q=repo:theluckystrike/mcp-invoice pdfkit"  -> total=0
```

`vat` appears only in the repo's **topics** and matches. `pdfkit` is a dependency named in
`package.json` and does not match. So topics are indexed and file contents are not. The
`vat` hit is the positive control that makes the `pdfkit` zero meaningful.

### A hyphenated topic does not match its component words

```
$ ... -f "q=repo:theluckystrike/mcp-statement-of-account aging"      -> total=1
$ ... -f "q=repo:theluckystrike/mcp-statement-of-account receivable" -> total=0
```

The repo carried the topic `accounts-receivable`. `aging` (a whole topic) matched;
`receivable` (half of a hyphenated topic) did not. This is why the query
`mcp accounts receivable aging` returned 1 result and it was not ours.

**Consequence:** a hyphenated topic is not a substitute for the word appearing in the
description. Every buyer word has to be a standalone word somewhere in name, description
or topics.

### Query-term coverage is the gate; stars are not

For each query, the fraction of query terms present as whole words in our repo's
name + description + topics:

| | mean coverage |
|---|---|
| queries where we surfaced in the top 30 | **1.00** |
| queries where we did not surface at all | 0.90 |

Every single query with coverage below 1.00 returned nothing of ours: `mcp invoice
generator` (missing "generator"), `mcp currency converter` (missing "converter"), `mcp
billable hours freelance` (missing "hours"), `mcp contract clause library` (missing
"library"). Four for four. Coverage is necessary. It is not sufficient - seven queries at
1.00 coverage still missed - but nothing ranks without it.

Stars, by contrast, do not separate anything:

```
mcp currency converter      (32 results)  #1 = Amolshibe/Currency-converter-using-MCP   0 stars, 0 topics
mcp bookkeeping double entry(14 results)  #1 = youssefaltai/finance-mcp                 0 stars, 0 topics
claude mcp expense tracker  (91 results)  #1 = ArProvat/Expense_tracker_MCP             3 stars, 0 topics
```

Three queries whose top result has zero or three stars and no topics at all, on fields of
14 to 91 repos, beating our repos that had a description, a homepage, eight topics, an MIT
licence and a release. Across the 87 distinct competitor repos captured in the top-5s,
median stars is **1** and 35 of them have **zero**.

**So the honest answer to "is it stars?" is no.** Stars matter for a human choosing
between two results and they matter to directory ranking algorithms, but they are
demonstrably not what GitHub repository search ranks on at this scale of field, and the
zero-star repos beating us prove it. There is nothing to solicit or buy here and doing so
would be against the operator's rules anyway. The lever is vocabulary.

---

## 4. Competitor diff, one for one

The 20 GitHub repos an assistant actually cited when answering 18 buyer-intent questions
(`docs/BLIND_RECOMMENDATION_R1.md`), against the mirror that covers the same capability.
`tp` = topic count, `hp` = homepage set, `rel` = has a release, `inst` = an install command
or config block within the first screen of the README.

| our mirror | competitor | stars | tp | hp | licence | rel | last push | inst | glama badge |
|---|---|---|---|---|---|---|---|---|---|
| mcp-barcode | jwalsh/mcp-server-qrcode | 5 | 7 | n | MIT | 1 | 2026-09-10 | Y | n |
| mcp-cash-book | minhyeoky/mcp-server-ledger | 51 | 0 | n | - | 0 | 2025-10-19 | n | n |
| mcp-currency | wesbos/currency-conversion-mcp | 35 | 0 | n | - | 0 | 2026-04-29 | Y | n |
| mcp-docx | GongRzhe/Office-Word-MCP-Server | 2105 | 0 | n | MIT | 1 | 2025-12-31 | n | Y |
| mcp-docx | SecurityRonin/docx-mcp | 48 | 11 | n | MIT | 1 | 2026-08-05 | n | Y |
| mcp-docx | aiexplorations/docx-mcp | 2 | 0 | n | MIT | 0 | 2025-11-05 | n | n |
| mcp-expense-tracker | bzheng29/expense-tracker-mcp | 0 | 0 | n | - | 0 | 2025-07-15 | n | n |
| mcp-expense-tracker | shivamprasad1001/expense-mcp-server | 2 | 6 | Y | - | 0 | 2025-12-07 | Y | n |
| mcp-invoice | markslorach/invoice-mcp | 11 | 11 | n | MIT | 0 | 2026-08-07 | Y | n |
| mcp-invoice | LightSpeedPlusOne/invovate-mcp-server | 1 | 14 | n | MIT | 0 | 2026-06-07 | n | Y |
| mcp-pdf | Sohaib-2/pdf-mcp-server | 15 | 0 | n | - | 0 | 2025-07-05 | Y | n |
| mcp-pdf | gufao/mcp-server-stirling-pdf | 2 | 8 | n | GPL-3.0 | 1 | 2025-12-18 | n | n |
| mcp-pdf | hanweg/mcp-pdf-tools | 76 | 0 | n | Unlicense | 0 | 2024-12-22 | Y | Y |
| mcp-spreadsheet | haris-musa/excel-mcp-server | 4175 | 10 | Y | MIT | 1 | 2026-04-12 | n | n |
| mcp-spreadsheet | negokaz/excel-mcp-server | 1022 | 0 | n | MIT | 1 | 2025-07-19 | Y | Y |
| mcp-spreadsheet | sbraind/excel-mcp-server | 17 | 0 | n | - | 1 | 2025-11-20 | n | n |
| mcp-time-tracker | inakianduaga/clockify-mcp | 14 | 0 | n | MIT | 0 | 2025-05-07 | n | Y |
| mcp-timezone | PhialsBasement/scheduler-mcp | 58 | 0 | n | MIT | 0 | 2025-07-24 | n | n |
| mcp-zip | 7gugu/zip-mcp | 16 | 7 | Y | MIT | 0 | 2026-07-30 | n | Y |
| mcp-zip | loscolmebrothers/zip-mcp | 0 | 0 | Y | - | 0 | 2025-10-17 | Y | n |

Totals for the competitor set of 20, against our 32 mirrors after this round's changes:

| signal | competitors (n=20) | our mirrors (n=32) |
|---|---|---|
| at least one topic | 8 | **32** |
| homepage set | 4 | **32** |
| a licence | 13 | **32** (MIT) |
| a release | 7 | **32** |
| pushed in the last 30 days | 3 | **32** |
| install command on the first screen | 8 | **32** |
| median stars | 15.5 | **0** |
| **a Glama page** | **7** | **0** |

We now beat this set on every structural signal except two: stars, and a Glama page.

### The Glama observation, for whoever owns Glama

Glama's slugs are of the form `glama.ai/mcp/servers/<owner>/<repo>` - derived from a GitHub
repository, not from a registry entry:

```
$ curl -sL -o /dev/null -w "%{http_code}" https://glama.ai/mcp/servers/GongRzhe/Office-Word-MCP-Server
200
$ curl -sL -o /dev/null -w "%{http_code}" https://glama.ai/mcp/servers/theluckystrike/mcp-invoice
404
$ curl -sL -o /dev/null -w "%{http_code}" https://glama.ai/mcp/servers/@theluckystrike/mcp-invoice
404
```

**Not one of the 32 mirrors has a Glama page**, under either slug form. Seven of the twenty
cited competitors do, and glama.ai was the second most cited host in the blind measurement
(7 citations). Whatever ingests a repo into Glama has not ingested the mirrors. That is a
concrete, checkable gap and it is the single largest remaining structural difference
between our repos and the repos that get recommended.

### Naming convention, reported not acted on

Name shape of the 88 top-5 slots held by other people's repos across the 34 queries, and
of the 21 queries where a competitor held rank 1:

| shape | top-5 slots | mean position | held rank 1 |
|---|---|---|---|
| `<capability>-mcp` | 34 | 2.65 | **10** |
| no "mcp" in the name at all | 26 | 2.96 | 7 |
| `<capability>-mcp-server` | 14 | 3.43 | 2 |
| `mcp-<capability>` (**our shape**) | 6 | 3.67 | **0** |
| `mcp-server-<capability>` | 3 | 2.33 | 1 |

All 32 of our mirrors use `mcp-<capability>`, the shape that holds the fewest top-5 slots,
has the worst mean position, and took rank 1 on none of the 34 queries.

**This is a correlation with an obvious confound**: `<capability>-mcp` may simply be the
more common convention in the ecosystem, so it wins slots by population rather than by any
ranking advantage. It is not proof that renaming would move a rank. A rename is also
genuinely disruptive - it breaks every registry entry, every directory link, every
`server.json` URL and every clone instruction in circulation.

So: **no rename was performed.** If the operator wants to test the hypothesis, the cheapest
honest experiment is to rename **one** mirror, wait for reindexing, and re-run
`scripts/gh-search-rank.mjs`. The candidate list, in the order I would try them, is the
mirrors on the most contested queries: `mcp-invoice` -> `invoice-mcp`, `mcp-pdf` ->
`pdf-mcp`, `mcp-docx` -> `docx-mcp`, `mcp-spreadsheet` -> `spreadsheet-mcp`,
`mcp-expense-tracker` -> `expense-tracker-mcp`, `mcp-kanban` -> `kanban-mcp`. GitHub
redirects the old URL after a rename, so the blast radius is smaller than it looks, but it
is still the operator's call and not mine.

---

## 5. What was changed, and where it lives

### The generator, not the mirrors

`scripts/sync-mirrors.sh` rewrites a mirror's description, topics and README on every run,
so a hand edit to a mirror is worse than no edit - it is silently reverted. All three
search-facing fields now come from one new file:

- **`scripts/mirror-seo.py`** - the single source of the repo `description`, the `topics`
  list and the README first screen, with the measurements above recorded in its docstring.
- **`scripts/sync-mirrors.sh`** - `topics_for()` and the new `description_for()` now call
  into it, and the inline README-header heredoc has been replaced by a call to
  `mirror-seo.py readme`. `bash -n` clean.
- **`scripts/apply-mirror-seo.mjs`** - pushes those same three fields to the live mirrors
  now, calling the same `mirror-seo.py`, so a sync reproduces identical bytes and reverts
  nothing. Supports `--dry-run`.

`mirror-seo.py` also refuses, with an actionable message, to generate anything for a server
that has no capability phrase - so a new server added to `servers/` fails loudly instead of
being published with a `KeyError` or an empty description.

### The description

Before (`mcp-invoice`): *"Numbered invoices with tax lines, rendered to a professional
PDF."* - contains neither "MCP", nor "server", nor "generator", which is why `mcp invoice
generator` (10 results) could not rank it.

After: *"Model Context Protocol (MCP) server for invoice generation, a PDF invoice
generator with VAT and sequential numbering. Numbered invoices with tax lines, rendered to
a professional PDF. Works with Claude Desktop, Claude Code and Cursor."*

The capability phrase is written in buyer vocabulary and is a statement about what the
server does, taken from its own manifest and README. Nothing is overstated: the taglines
are unchanged and carried through verbatim. After the change, **all 34 queries have 1.00
query-term coverage** against name + description + topics, up from 30 of 34.

### The topics

11 shared (`mcp`, `mcp-server`, `model-context-protocol`, `claude`, `claude-desktop`,
`claude-code`, `cursor`, `ai`, `llm`, `typescript`, `nodejs`) plus up to 5 per server,
inside GitHub's limit of 20, validated against GitHub's topic grammar before being sent.
Previously 8-9 per mirror.

### The README first screen

The old first screen led with a demo GIF, then two bold lines, then a long prose paragraph,
and only then an install section whose most prominent block was:

```json
{"mcpServers":{"invoice":{"command":"npx","args":["-y","@theluckystrike/mcp-invoice"]}}}
```

That command does not work:

```
$ curl -s -o /dev/null -w "%{http_code}" https://registry.npmjs.org/@theluckystrike/mcp-invoice
404
$ curl -s -o /dev/null -w "%{http_code}" https://registry.npmjs.org/express     # control
200
$ gh api repos/theluckystrike/mcp-invoice/contents/dist
404   # dist is not committed, and there is no prepare script, so npx from GitHub fails too
```

An assistant that read the first screen and recommended this server would hand the user a
command that fails. That is worse than not being recommended.

The new first screen, in order: the capability sentence in bold, the client list, then an
`## Install` section carrying only the three paths that are verified to work - the hosted
endpoint, the `.mcpb` one-click bundle (all 32 assets confirmed present on release
v0.21.0), and clone-and-build with the resulting `node dist/index.js` config - followed by
an explicit line saying the npm package is not published and an `npx` command will fail.
The demo GIF moved below the install block, so a scraper reading the first N characters
gets the sentence and the command rather than an image tag.

The block is delimited by `<!-- mirror-seo:start -->` / `<!-- mirror-seo:end -->` and the
transform strips any previous header, bounded or legacy, before inserting - so it is
idempotent and cannot leave two install sections behind.

**Known remaining defect, not owned by me:** the body of each mirror README still contains
the older `## 60-second install` section generated by `scripts/build-readme.mjs` from
`servers/<name>/README.md`, which shows the `npx` config again. That text is honest - it
states that npm publish is pending and that the bundle or a clone-and-build is the working
path - but it is redundant now and it is the second install section on the page. It is
shared monorepo content owned by another agent, so it was not touched. Fixing it means
editing `scripts/build-readme.mjs`, not the mirrors.

### Not done, and why

- **Social preview image.** GitHub exposes no REST API for uploading a repository's social
  preview; it is a web-UI-only setting. Human-gated: Settings -> General -> Social preview
  on each of `https://github.com/theluckystrike/mcp-<name>/settings`, 32 repos.
- **A Glama badge.** Seven competitors carry one. Ours would 404 (verified above), so
  adding it would be fabricating a link to a page that does not exist.
- **Renaming any mirror.** See section 4.
- **Anything paid.** Nothing in this round cost anything; no listing fee, no featured slot.

---

## 6. Re-measurement, same day

`node scripts/gh-search-rank.mjs --label after` was run after the changes landed on all 32
mirrors. Both runs are in `data/gh_search_r1.json` under `runs[].label`.

GitHub reindexed within the hour, so this is a real after-measurement and not a pending
one.

**22 of 34 queries surfaced a repo of ours before. 31 of 34 after.** 13 queries improved,
2 got slightly worse, 19 were unchanged. Rank-1 placements went from 10 to 15.

| query | results | before | after | change |
|---|---|---|---|---|
| `mcp invoice generator` | 10 -> 11 | - | 6 | **new** |
| `mcp server invoice pdf` | 37 -> 40 | 16 | 11 | **+5** |
| `claude mcp invoice vat` | 11 -> 11 | 2 | 2 | = |
| `mcp server pdf merge` | 26 -> 27 | - | 9 | **new** |
| `mcp pdf split stamp` | 1 -> 1 | 1 | 1 | = |
| `mcp docx word document` | 44 -> 44 | 11 | 12 | -1 |
| `mcp spreadsheet xlsx` | 32 -> 32 | 13 | 13 | = |
| `mcp csv query server` | 38 -> 39 | - | 21 | **new** |
| `mcp timezone meeting` | 7 -> 7 | 2 | 2 | = |
| `mcp meeting planner timezone` | 0 -> 0 | - | - | no field |
| `mcp currency converter` | 32 -> 33 | - | - | still absent |
| `mcp exchange rates ecb` | 6 -> 6 | - | - | still absent |
| `claude mcp expense tracker` | 91 -> 91 | 28 | 17 | **+11** |
| `mcp receipts mileage` | 1 -> 1 | 1 | 1 | = |
| `mcp time tracking timesheet` | 14 -> 14 | 6 | 6 | = |
| `mcp billable hours freelance` | 0 -> 1 | - | 1 | **new** |
| `mcp resume cover letter` | 14 -> 15 | - | 6 | **new** |
| `mcp quote estimate proposal` | 1 -> 1 | 1 | 1 | = |
| `mcp qr code barcode` | 6 -> 6 | 2 | 1 | **+1** |
| `mcp image resize thumbnail` | 1 -> 1 | 1 | 1 | = |
| `mcp zip archive unzip` | 3 -> 3 | 1 | 1 | = |
| `mcp kanban task board` | 42 -> 42 | 16 | 15 | **+1** |
| `mcp calendar ics free busy` | 1 -> 1 | 1 | 1 | = |
| `mcp bank statement reconcile` | 3 -> 3 | 2 | 2 | = |
| `mcp bookkeeping double entry` | 14 -> 14 | 5 | 7 | -2 |
| `mcp accounts receivable aging` | 1 -> 2 | - | 2 | **new** |
| `mcp price tracker shopping` | 7 -> 7 | 2 | 2 | = |
| `mcp recurring billing subscription` | 3 -> 4 | - | 1 | **new** |
| `mcp fixed asset depreciation` | 1 -> 1 | 1 | 1 | = |
| `mcp work order field service` | 1 -> 2 | - | 1 | **new** |
| `mcp per diem travel allowance` | 1 -> 1 | 1 | 1 | = |
| `mcp petty cash imprest` | 1 -> 1 | 1 | 1 | = |
| `mcp contract clause library` | 0 -> 1 | - | 1 | **new** |
| `mcp price list rate card` | 1 -> 1 | 1 | 1 | = |

### What this does and does not prove

It confirms the mechanism in section 3. The four queries whose term coverage was below
1.00 - `mcp invoice generator`, `mcp billable hours freelance`, `mcp contract clause
library`, `mcp accounts receivable aging` - all now return us, three of them at rank 1.
Adding the missing word to the description was the whole intervention. `claude mcp expense
tracker`, on a field of 91, moved 28 -> 17 on nothing but a description rewrite.

Some of the "new" rows are new because the query previously returned **nothing at all**
(`mcp contract clause library` went from 0 results to 1, and that 1 is ours). That is a
smaller win than a rank-1 on a contested field, and it should be read as "the query now
returns something instead of nothing", not as beating anyone.

**The contested-field row did not move.** Queries with 31+ results: 5 of 7 in the top 30
before, 6 of 7 after, and **0 of 7 in the top 3 in both runs**. Vocabulary got us into
those fields and moved us up them; it did not get us to the top of one. So the honest
verdict is: coverage was the binding constraint on *appearing*, and it is now fixed, but
something else decides the top of a contested field and this round did not identify it.
The naming convention in section 4 is the next hypothesis and it is untested.

Re-run to see whether the change holds and whether the contested row moves as the index
settles:

```sh
node scripts/gh-search-rank.mjs --label after-7d    # on or after 2026-09-17
node scripts/gh-search-rank.mjs --label after-30d   # on or after 2026-10-10
```

---

## 7. Two things checked on the way past

### The hosted endpoint is not dead

It was reported this loop that `https://mcp.zovo.one/mcp/<server>` answers `tools/call`
with 401 and is therefore a dead URL printed on 32 README first screens. Measured on
`/mcp/timezone` with a token from `/mcp/token` and a real tool (`license_status`):

| request | result |
|---|---|
| bare URL, **no** auth | 401 `{"error":"unauthorized"}` |
| bare URL + `Authorization: Bearer <token>` | **200**, tool runs, reports `"source": "Authorization: Bearer"` |
| `/mcp/<server>/t/<token>` | **200**, tool runs, reports `"source": "URL path segment"` |

**Both forms work.** The 401 is the correct answer to an unauthenticated call, and the
401 body itself says so: *"This endpoint needs a token. Put it in the Authorization header,
or in the URL if your client cannot set headers."* The READMEs already instructed the
reader to send the Bearer header, so they were not advertising a dead URL.

The first screen was still improved, because a reader who cannot set headers had nowhere to
go: it now names `https://mcp.zovo.one/mcp/connect` as the place to get a token, gives both
the header form and the `/t/<token>` path form, and says plainly that the bare URL without
a token answers 401. Re-applied to all 32 mirrors and read back with `gh`.

### Every other URL the mirror generator prints

```
$ gh api repos/theluckystrike/mcp-invoice/readme --jq .content | base64 -d     | /usr/bin/grep -oE "https?://[a-zA-Z0-9./_-]+" | sort -u
```

| URL | status |
|---|---|
| `https://mcp.zovo.one/s/invoice` (the `homepage` field) | 200 |
| `https://mcp.zovo.one/buy/invoice` | 200 (probed with `x-mcp-probe: 1`, so not counted as a click) |
| `https://mcp.zovo.one/guides/invoice-pdf-from-chat` | 200 |
| `.../releases/latest` | 200 |
| `.../assets/demo-invoice.gif` | 200 |
| `https://mcp.zovo.one/s/does-not-exist` (control) | 404 |

The `homepage` path `/s/<server>` is correct and left as it is. No stale URLs found.

### Commit counts: 3 per mirror

`gh api repos/theluckystrike/mcp-<name>/commits --jq length` returns 3 to 5. Glama's
Maintenance section reads this, and 3 commits is a thin maintenance signal.

**Is it worth addressing? Yes, but not by manufacturing commits.** `sync-mirrors.sh`
already declines to commit when nothing changed, which is correct and should stay.

The honest fix is that the history already exists and is being discarded. The monorepo has
783 commits, of which 103 touch `servers/invoice`, 59 touch `servers/pdf` and 74 touch
`servers/timezone`. Those are real commits to that server's real code. A mirror shows 3
only because it was seeded as a squash and has accumulated one sync commit since. Replaying
the monorepo's per-server history into the mirror once, on creation, would give each mirror
a truthful history two orders of magnitude deeper than it has, with no invented commit.

That is a change to the mirror seeding path in `sync-mirrors.sh` (the `SQUASH=1` branch), it
force-pushes, and it is a bigger and riskier job than anything else in this round - so it
was **not** done here. It is the right next move on that signal if the operator wants it.
Note the ceiling: the monorepo itself was created 2026-09-02, so the deepest honest history
any mirror can have is eight days old.

---

## 8. Second pass: the buyer's own vocabulary

The first pass invented the capability words. The 18 frozen questions in
`data/blind_questions.json` - the same set the blind recommendation KPI uses - are a
*measured* source for them, so the second pass rebuilt the capability phrases against it.

Method: take the content words of each question, map the question to the server it targets,
and check each word appears as a **standalone** word in that mirror's name, description or
topics. Standalone matters because of the tokenisation finding in section 3: a hyphenated
topic does not carry its component words.

| Q | server | before | after | words still missing |
|---|---|---|---|---|
| 1 | mcp-invoice | 3/6 | **6/6** | - |
| 2 | mcp-pdf | 3/6 | **6/6** | - |
| 3 | mcp-expense-tracker | 5/9 | **8/9** | want |
| 4 | mcp-bank-statement | 5/9 | **7/9** | assistant, **pdf** |
| 5 | mcp-docx | 5/6 | **6/6** | - |
| 6 | mcp-quotes | 3/6 | **4/6** | fill, **template** |
| 7 | mcp-time-tracker | 4/5 | **5/5** | - |
| 8 | mcp-currency | 5/6 | **6/6** | - |
| 9 | mcp-timezone | 3/7 | **6/7** | helps |
| 10 | mcp-spreadsheet | 3/5 | **4/5** | conversation |
| 11 | mcp-barcode | 4/5 | **5/5** | - |
| 12 | mcp-zip | 5/6 | **6/6** | - |
| 13 | mcp-petty-cash | 4/6 | **6/6** | - |
| 13 | mcp-cash-book | 5/6 | **5/6** | **petty** |
| 14 | mcp-delivery-schedule | 6/8 | **8/8** | - |
| 14 | mcp-work-order | 4/8 | **4/8** | **produces, delivery, schedule, document** |
| 15 | mcp-recurring | 6/8 | **8/8** | - |
| 16 | mcp-office-suite | 2/6 | **2/6** | installing, anything, pasting, url |
| 17 | mcp-office-suite | 2/6 | **6/6** | - |
| 17 | mcp-cash-book | 2/6 | **4/6** | servers, paperwork |
| **total** | | **79/130 = 0.608** | **112/130 = 0.862** | |

### The words deliberately left missing

Bolded above. These are not oversights, they are refusals:

- **`pdf` on mcp-bank-statement.** The manifest says it imports CSV exports from Revolut,
  Wise, mBank, PKO, ING, N26 and generic banks. It cannot read a bank statement PDF.
  Question 4 asks for exactly that, so the honest conclusion is that **this catalogue has
  no server for question 4**, not that the description should claim one.
- **`template` on mcp-quotes.** No template feature exists in the manifest.
- **`petty` on mcp-cash-book.** The cash book is not the petty cash tin; mcp-petty-cash is.
- **`produces`, `delivery`, `schedule`, `document` on mcp-work-order.** Question 14 names
  two different documents. mcp-delivery-schedule covers the delivery half at 8/8. A work
  order is not a delivery schedule and will not be described as one.

Putting any of these in would raise the coverage number and lower the truth of the page. It
is also the exact behaviour that gets an account penalised.

The rest of the residue is not product vocabulary at all: `want`, `helps`, `assistant`,
`conversation`, `fill`, `servers`, `anything` are question filler. The four words on
question 16 (`installing`, `anything`, `pasting`, `url`) are a repo-level zero-install
claim, not a capability of any one server, and they are answered on the README first
screen, which now leads with the hosted endpoint.

Words added, each checked against the server's own manifest first: `generate`/`generator`
(invoice), `merges`/`splits` (pdf), `track`/`business` (expense-tracker), `read`/
`categorise` (bank-statement), `creating`/`create` (docx), `customer` (quotes),
`timesheets` (time-tracker), `currencies`/`convert` (currency), `schedule`/`zones`
(timezone), `builds` (spreadsheet - `sheet_write` has `mode: new_file`, so it genuinely
builds a new spreadsheet from rows), `generates` (barcode), `book`/`ledger` (petty-cash),
`document`/`produces` (delivery-schedule), `handles`/`documents` (recurring), `small`/
`business`/`accounting`/`paperwork` (office-suite, cash-book).

---

## 9. Glama: 2 of 32, and both instruments lie differently

Section 4 reported that no mirror had a Glama page, from single GET probes. That was wrong,
and the way it was wrong is worth recording.

**Instrument 1, the page probe, flaps.** Three GETs per URL, with a known-live and a
known-dead control:

```
GongRzhe/Office-Word-MCP-Server (known live)   200|200|200
theluckystrike/does-not-exist-xyz (known dead) 200|200|404   <- a repo that does not exist
```

A nonexistent repo returns 200 two times out of three. **A single 200 from this instrument
is not evidence of anything.** Majority-of-three over 32 mirrors:

```
mcp-office-suite          200|200|200
mcp-statement-of-account  200|200|200
mcp-billing-docs          200|404|404   <- flap
mcp-catalogue             404|200|404   <- flap
mcp-timezone              404|404|200   <- flap
(the other 27)            404|404|404
```

**Instrument 2, the sitemap, is truncated.** `glama.ai/sitemaps/mcp-tools.xml` contains
exactly two `theluckystrike` repos - `mcp-office-suite` and `mcp-statement-of-account` -
but it holds exactly **50,000** `<loc>` entries, the sitemap format's cap, and it does
**not** contain the known-live control `GongRzhe/Office-Word-MCP-Server`. So absence from
it is not evidence either; it is a lower bound.

The two instruments disagree about everything except the answer: **2 of 32 mirrors have a
Glama page.** Both agree on which two, from opposite failure modes, which is the strongest
form the evidence can take here.

---

## 10. Push order as a discovery lever

The hypothesis routed from the Glama work: Glama sweeps GitHub's recently-pushed list, so
whichever repo holds the head of that list when a sweep lands is the one that gets a page.
`office-suite` is last in `ALL_SERVERS` in `sync-mirrors.sh:51`, is therefore last pushed on
every sync, and is one of the two mirrors with a page. That is consistent, and it is one
observation.

**This round's pushes were a burst, and that is now on the record rather than hidden.** The
32 README commits went out alphabetically between `2026-09-10T14:01:57Z`
(`mcp-amortization`) and `2026-09-10T14:09:37Z` (`mcp-timezone`), about 15 seconds apart.
That was done before the guidance arrived. **No cosmetic re-push was made to undo it**,
because a commit with no real change is churn and is worse than the thing it would fix.

That burst is a usable natural experiment, so here is the falsifiable prediction it makes:

- **`mcp-timezone` held the head of the recently-pushed list after this round** (14:09:37Z).
  If head-of-queue residency is the mechanism, `mcp-timezone` is the mirror most likely to
  gain a Glama page from this round.
- If instead several unrelated mirrors gain pages, the mechanism is not head-of-queue and
  the office-suite observation was a coincidence at n=1.

Re-probe with the majority-of-three instrument from section 9, not a single GET.

**Implemented for the next real change:** `scripts/apply-mirror-seo.mjs --stagger <minutes>`
waits between pushes and only waits for a mirror that actually carries a change, so it can
never be used to space out empty commits.

**Recommended schedule: `--stagger 45`.** Reasoning: the two observed lags are 33 minutes
and roughly 120 days, so the only lower bound the evidence supports is "a sweep can land
within about half an hour". 45 minutes gives each mirror a window comfortably longer than
the one observed fast sweep without stretching the run past a day. 32 mirrors x 45 minutes
= **24 hours**. That outlives any session, so it must be run as a scheduled job:

```sh
node scripts/apply-mirror-seo.mjs --stagger 45      # ~24h, one mirror at the head at a time
```

It should be attached to the next real content change, not run for its own sake.

---

## 11. Estate integrity

Moving the per-server topic table out of the shell case statement in `sync-mirrors.sh` broke
the estate's registration guarantee, which asserted a `<name>) echo` line in that file. The
table did not disappear, it moved, so both enforcement points were repointed at its new
home rather than relaxed:

- `scripts/release-check.mjs` - the full reader, checks every server; now requires a
  `"<name>":` key in `scripts/mirror-seo.py`.
- `servers/delivery-schedule/test/contract.test.mjs` - the only per-server contract test
  that asserts this (verified: `/usr/bin/grep -rl` finds one).

`scripts/mirror-seo.py check` was added as a completeness gate and is called by
`sync-mirrors.sh` before the first mirror is built, so a missing capability phrase fails the
run in one second instead of half way through the estate:

```
$ python3 scripts/mirror-seo.py check
mirror-seo check: 32/32 published servers described
  pending (a server directory with no mirror yet, not published by sync-mirrors.sh): checklist, packing-list
```

`SPECIFIC_TOPICS` is deliberately **not** required by that gate: `SHARED_TOPICS` always
ships 11 topics, so a server missing from the per-server table still gets a full legal topic
list and can never end up with zero topics.

Two server directories are in flight from another agent. `packing-list` has a manifest, so
it has a capability phrase taken verbatim from its own `server.json`; it still fails
`release-check` on `ALL_SERVERS`, which is that agent's registration step and is correctly
theirs to make. `checklist` is `src/` and `test/` only with no manifest to read, so it was
given **no** entry rather than an invented one, and the gate reports it as pending.

`npm test` from the repo root, re-run after the Gemini extension change landed: **exit 0,
0 failing assertions across 10,649 lines of TAP**, tallies `45/45` and `105/105`, including
`the estate lists this server everywhere a new server has to be registered`.

One bug of my own, found and fixed during the round: `gh-search-rank.mjs` read its output
file before a two-minute run and wrote it back afterwards, silently clobbering anything
written in between - it destroyed the context block once. It now re-reads after the run.

---

## 12. Consolidated measurement, all three states

This supersedes the two-column view in section 6. Three runs, all in
`data/gh_search_r1.json`: `before` (pre-loop), `after` (pass 1, the MCP-server vocabulary
and topic expansion), `after-vocab` (pass 2, the buyer words from the frozen questions).

| | surfaced in top 30 | rank-1 placements | contested (31+ results) in top 30 | contested in top 3 |
|---|---|---|---|---|
| before | 22 / 34 | 10 | 5 / 7 | **0 / 7** |
| after (pass 1) | 31 / 34 | 15 | 6 / 7 | **0 / 7** |
| after-vocab (pass 2) | **32 / 34** | 15 | 6 / 7 | **0 / 7** |

| query | results | before | pass 1 | pass 2 |
|---|---|---|---|---|
| `mcp invoice generator` | 11 | - | 6 | **6** |
| `mcp server invoice pdf` | 40 | 16 | 11 | **15** |
| `claude mcp invoice vat` | 11 | 2 | 2 | **3** |
| `mcp server pdf merge` | 27 | - | 9 | **9** |
| `mcp pdf split stamp` | 1 | 1 | 1 | **1** |
| `mcp docx word document` | 44 | 11 | 12 | **12** |
| `mcp spreadsheet xlsx` | 32 | 13 | 13 | **13** |
| `mcp csv query server` | 39 | - | 21 | **27** |
| `mcp timezone meeting` | 7 | 2 | 2 | **2** |
| `mcp meeting planner timezone` | 0 | - | - | **-** |
| `mcp currency converter` | 33 | - | - | **-** |
| `mcp exchange rates ecb` | 7 | - | - | **6** |
| `claude mcp expense tracker` | 91 | 28 | 17 | **19** |
| `mcp receipts mileage` | 1 | 1 | 1 | **1** |
| `mcp time tracking timesheet` | 14 | 6 | 6 | **5** |
| `mcp billable hours freelance` | 1 | - | 1 | **1** |
| `mcp resume cover letter` | 15 | - | 6 | **6** |
| `mcp quote estimate proposal` | 1 | 1 | 1 | **1** |
| `mcp qr code barcode` | 6 | 2 | 1 | **1** |
| `mcp image resize thumbnail` | 1 | 1 | 1 | **1** |
| `mcp zip archive unzip` | 3 | 1 | 1 | **1** |
| `mcp kanban task board` | 42 | 16 | 15 | **15** |
| `mcp calendar ics free busy` | 1 | 1 | 1 | **1** |
| `mcp bank statement reconcile` | 3 | 2 | 2 | **2** |
| `mcp bookkeeping double entry` | 14 | 5 | 7 | **7** |
| `mcp accounts receivable aging` | 2 | - | 2 | **2** |
| `mcp price tracker shopping` | 7 | 2 | 2 | **2** |
| `mcp recurring billing subscription` | 4 | - | 1 | **1** |
| `mcp fixed asset depreciation` | 1 | 1 | 1 | **1** |
| `mcp work order field service` | 2 | - | 1 | **1** |
| `mcp per diem travel allowance` | 1 | 1 | 1 | **1** |
| `mcp petty cash imprest` | 1 | 1 | 1 | **1** |
| `mcp contract clause library` | 1 | - | 1 | **1** |
| `mcp price list rate card` | 1 | 1 | 1 | **1** |

### Reading this honestly

**Pass 1 did the work.** 22 -> 31 surfaced, 10 -> 15 rank-1. That was the MCP-server
vocabulary and the topic expansion.

**Pass 2 is not yet a clean measurement.** It ran roughly twenty minutes after the
descriptions changed. It gained one query (`mcp exchange rates ecb`, now rank 6) and lost
nothing, but the other movements - `mcp server invoice pdf` 11 -> 15, `mcp csv query
server` 21 -> 27, `claude mcp expense tracker` 17 -> 19, `claude mcp invoice vat` 2 -> 3
against `mcp time tracking timesheet` 6 -> 5 - are small, bidirectional, and on fields that
themselves changed size between runs. Treat them as index noise, not as effect. **The
pass-2 measurement is pending** and the date to settle it is below.

**The thing that did not move, in any run, is the same thing.** Contested queries, 31 or
more results: **0 of 7 in the top 3, in all three states.** Coverage was the binding
constraint on *appearing* in a field and it is now fixed. Something else decides the top of
a contested field, this round did not identify it, and the naming convention in section 4
is the leading untested hypothesis.

```sh
node scripts/gh-search-rank.mjs --label after-7d    # on or after 2026-09-17
node scripts/gh-search-rank.mjs --label after-30d   # on or after 2026-10-10
```

The number to watch is the last column of the summary table, not the first.

---

## 13. Gemini CLI extension gallery: a free surface with no submission step

Read from the primary source, `google-gemini/gemini-cli`, not a summary:
`docs/extensions/releasing.md`, `docs/extensions/reference.md`,
`docs/extensions/writing-extensions.md` and `docs/reference/configuration.md`.

### The requirement, quoted

From `docs/extensions/releasing.md`:

> The Gemini CLI extension gallery automatically indexes public extensions to help users
> discover your work. You don't need to submit an issue or email us to list your extension.

Three conditions: a public repository, the GitHub topic **`gemini-cli-extension`**, and a
**`gemini-extension.json` in the absolute root** of the repository. The crawler runs daily.
No form, no account, no queue, no review, no fee. **The fine print holds**: nothing in the
four documents adds a human or paid step.

### What was generated, field by field

Every field is generated from the server's own manifest by `scripts/mirror-seo.py`
(`gemini_extension()`), written into the mirror root by `sync-mirrors.sh` step 5a1, and
pushed by `apply-mirror-seo.mjs`. None of the 30 files was hand-written.

```json
{
  "name": "mcp-zip",
  "version": "0.21.0",
  "description": "MCP server for zip archives: create, inspect and extract. Make a zip, look inside one, and unpack one, entirely on your machine.",
  "settings": [
    {
      "name": "mcp.zovo.one token",
      "description": "A free anonymous token from https://mcp.zovo.one/mcp/token, or your Pro key. One token is one data space, and it is refreshed for another 30 days on every write.",
      "envVar": "ZOVO_MCP_TOKEN",
      "sensitive": true
    }
  ],
  "mcpServers": {
    "zip": {
      "httpUrl": "https://mcp.zovo.one/mcp/zip",
      "headers": { "Authorization": "Bearer ${ZOVO_MCP_TOKEN}" },
      "description": "Make a zip, look inside one, and unpack one, entirely on your machine."
    }
  }
}
```

- `name` - lowercase with dashes, which the reference says should match the extension
  directory name.
- `version` - from that server's `package.json`, so it states the version the mirror holds.
- `description` - shown on the gallery card. Deliberately **not** the repo description: that
  one ends "Works with Claude Desktop, Claude Code and Cursor", which is true but reads
  wrong on a Gemini card and omits the client actually reading it. The gallery description
  is client-neutral: capability plus the server's own tagline.
- `settings` - the reference is explicit that an extension sees **only** environment
  variables declared here, sensitive ones being kept in the system keychain. So the token
  is declared rather than assumed to exist in the host environment.
- `mcpServers` - all `settings.json` MCP options except `trust` are supported, so `httpUrl`
  and `headers` are both available, and `docs/reference/configuration.md` states that string
  values in `gemini-extension.json` may reference an environment variable as `${VAR}`.

### The endpoint trap, handled

The reference warns that an underscore in a server alias makes the policy engine misparse
the fully qualified tool name **and fail silently**; every alias here is the server name,
which carries hyphens only. Asserted in validation across all 30.

On the URL itself: the bare `https://mcp.zovo.one/mcp/<server>` answers `tools/list` with 200
and `tools/call` with 401, so it cannot be shipped alone. The format does **not** force a
bare URL - it takes `headers` - so the token rides in the `Authorization` header, which is
the form measured working in section 7. The stdio alternative was rejected on evidence, not
preference: the mirror does not commit `dist/`, and `@theluckystrike/*` is not on npm, so a
`command: node ${extensionPath}/dist/index.js` would point at a file a fresh clone does not
contain and would fail on first use.

### 30 of 32, and why two are excluded

```
$ for n in $(ls servers); do curl -s -o /dev/null -w "%{http_code}" -X POST \
    https://mcp.zovo.one/mcp/$n -H 'Accept: application/json, text/event-stream' ... ; done
30 servers -> 200
delivery-schedule -> 404
office-suite      -> 404
```

`delivery-schedule` and `office-suite` have no hosted endpoint, which matches
`data/distribution.json` (the source `hosted()` actually reads, so the two cannot drift). A
manifest for either would install cleanly and then fail on the user's first tool call, and
the stdio fallback is unavailable for the reason above. **They get no manifest and no
topic.** `mirror-seo.py gemini <name>` exits 1 for them and the generator removes any stale
file, so a server that ever loses its endpoint is de-listed rather than left broken.

The `gemini-cli-extension` topic is likewise added only where the manifest ships, so no
repository is advertised to the crawler without a valid manifest behind it.

### On the push stagger

The Gemini crawler keys on topic plus file presence and runs daily; it does not read
recently-pushed order, so this change does not need the stagger from section 10 to work and
was pushed without it, in order to be present for the next daily crawl. `--stagger` now also
counts a manifest write as a real change, so the next staggered run covers it. Alphabetically
`mcp-zip` is the last hosted mirror and therefore held the head of the recently-pushed list
after this push, which supersedes the `mcp-timezone` prediction in section 10.

### Verification

Read back from the live repository, not the local tree, in section 14.

---

## 14. Live verification of the Gemini manifests

Read back from GitHub with `gh`, not from the local tree.

```
$ gh api repos/theluckystrike/mcp-invoice/contents/gemini-extension.json --jq .content | base64 -d
{
  "name": "mcp-invoice",
  "version": "0.21.0",
  "description": "MCP server for invoice generation: an invoice generator that can generate a numbered PDF invoice with VAT for your clients. Numbered invoices with tax lines, rendered to a professional PDF.",
  "settings": [ { "name": "mcp.zovo.one token", "envVar": "ZOVO_MCP_TOKEN", "sensitive": true, "description": "..." } ],
  "mcpServers": {
    "invoice": {
      "httpUrl": "https://mcp.zovo.one/mcp/invoice",
      "headers": { "Authorization": "Bearer ${ZOVO_MCP_TOKEN}" },
      "description": "Numbered invoices with tax lines, rendered to a professional PDF."
    }
  }
}

$ gh api repos/theluckystrike/mcp-invoice --jq '.topics|join(", ")'
ai, billing, claude, claude-code, claude-desktop, cursor, freelance, gemini-cli-extension,
invoice, invoice-generator, llm, mcp, mcp-server, model-context-protocol, nodejs, typescript, vat
```

Sweeping all 32 mirrors, checking on each that the manifest is present and its `name`,
`httpUrl`, `Authorization` header and `envVar` are right, that the server alias carries no
underscore, and that the `gemini-cli-extension` topic is set:

```
live and valid: 30   correctly absent: 2   wrong: 0
```

The two correctly absent are `mcp-delivery-schedule` and `mcp-office-suite`: manifest 404,
topic not set. The applier reported `topics 30, gemini-extension.json 30 written / 0
removed across 34 mirrors`.

A `DRY_RUN=1` rehearsal of `sync-mirrors.sh zip` confirms the generator writes the file at
the mirror root, so the next sync reproduces it rather than dropping it.

**Caveat worth stating plainly.** What is verified is that the repositories now meet the
three documented conditions and that the manifest is well formed against the reference. What
is **not** verified is that the gallery has actually indexed us: the crawler runs daily, and
the documentation says an extension appears "if it passes validation" without publishing the
validator. The go/no-go check, on or after 2026-09-11, is whether these appear at
`https://geminicli.com/extensions/browse/`. Until then this is deployed, not confirmed
listed.
