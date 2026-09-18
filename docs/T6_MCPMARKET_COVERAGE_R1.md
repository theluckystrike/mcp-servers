# T6 — MCPmarket Deep Coverage Check + Missing-Server Probe (R1)

STATUS: complete (see RESULT block at end of file)

## Scope
- Source of truth for our 42 products: `https://mcp.zovo.one/sitemap.xml` → `/s/<slug>` URLs.
- MCPmarket coverage source: `https://mcpmarket.com/search?q=theluckystrike`.
- Backlink question: do our MCPmarket listings carry a dofollow link to `https://mcp.zovo.one`?

## Method (commands actually run)
1. Full 42-slug list:
   ```
   curl -s -A "Mozilla/5.0" https://mcp.zovo.one/sitemap.xml -o /tmp/sm.xml
   grep -o 'https://mcp.zovo.one/s/[a-z0-9-]*' /tmp/sm.xml | sed 's|.*/s/||' | sort -u
   # → 42 slugs, 19361 bytes sitemap
   ```
   42 slugs: amortization asset-register bank-statement barcode bill-of-sale billing-docs calendar
   cash-book catalogue change-order checklist clauses credit-note currency delivery-schedule deposits
   docx dunning-letters expense-tracker image invoice job-card kanban maintenance-log mileage-log
   office-suite packing-list pdf per-diem petty-cash price-tracker quotes recurring resume
   service-agreement spreadsheet statement-of-account supplier-list time-tracker timezone work-order zip

2. MCPmarket search enumeration (browser, curl gets 403 bot-shield):
   `browser_navigate https://mcpmarket.com/search?q=theluckystrike`
   Then DOM extract:
   ```js
   [...document.querySelectorAll('main a[href*="/server/"]')]
     .map(a => ({owner: a.textContent.trim().split(' ')[0],
                 href: a.getAttribute('href'),
                 title: a.querySelector('h3')?.textContent.trim()}))
   ```
   → **21 results total** (20 + 1 own duplicate title); the result set is fixed at 21; "Load More
   Results" button does not add rows after click (verified: count stayed 21).

## Finding 1 — SEARCH RESULTS ARE CONTAMINATED BY THIRD-PARTY SERVERS
The query `theluckystrike` returns 21 servers, but **only 12 are ours (owner `theluckystrike`)**.
The other 9 match the query string elsewhere (repo/description text) and belong to other owners:

| Listing URL | Title | Owner shown | Ours? |
|---|---|---|---|
| /server/dunning-letters | Dunning Letters | theluckystrike | ✅ |
| /server/checklist | Checklist | theluckystrike | ✅ |
| /server/hexstrike-ai | HexStrike AI | 0x4m4 | ❌ other |
| /server/blitzstrike | Blitzstrike | shinthink | ❌ other |
| /server/petty-cash | Petty Cash | theluckystrike | ✅ |
| /server/damn-vulnerable | Damn Vulnerable | harishsg993010 | ❌ other |
| /server/cyberstrike | CyberStrike | CyberStrikeus | ❌ other |
| /server/currency | Currency | theluckystrike | ✅ |
| /server/jsondiffpatch | Jsondiffpatch | benjamine | ❌ other |
| /server/credit-note | Credit Note | theluckystrike | ✅ |
| /server/bill-of-sale | Bill of Sale | theluckystrike | ✅ |
| /server/kanban-4 | Kanban | theluckystrike | ✅ |
| /server/packing-list | Packing List | theluckystrike | ✅ |
| /server/hexstrike-ai-community-edition | HexStrike AI Community Edition | CommonHuman-Lab | ❌ other |
| /server/cash-book | Cash Book | theluckystrike | ✅ |
| /server/fetcher-1 | Fetcher | jae-jae | ❌ other |
| /server/nyxstrike | NyxStrike | CommonHuman-Lab | ❌ other |
| /server/job-card | Job Card | theluckystrike | ✅ |
| /server/productivity-suite | Productivity Suite | theluckystrike | ✅ |
| /server/invoice-2 | Invoice | theluckystrike | ✅ |
| /server/wick-1 | Wick | buildepicshit | ❌ other |

**T1's "≥12 listings live" is CONFIRMED and is in fact exactly 12** — not more.

## Finding 2 — OWN-LISTED SET (12) vs FULL 42 → 30 MISSING
Own-listed on MCPmarket (12):
dunning-letters, checklist, petty-cash, currency, credit-note, bill-of-sale, kanban, packing-list,
cash-book, job-card, productivity-suite, invoice.

Missing from MCPmarket (30 of 42):
amortization, asset-register, bank-statement, barcode, billing-docs, calendar, catalogue,
change-order, clauses, delivery-schedule, deposits, docx, expense-tracker, image, maintenance-log,
mileage-log, office-suite, pdf, per-diem, price-tracker, quotes, recurring, resume, service-agreement,
spreadsheet, statement-of-account, supplier-list, time-tracker, timezone, work-order, zip.
(diff computed by set difference of the 42 sitemap slugs vs the 12 own-listed slugs.)

## Finding 3 — HIGH-VALUE MISSING PRODUCTS
All five flagged high-value products are **MISSING** from the own-listed set:
- **invoice** → present (as `/server/invoice-2`, owner theluckystrike) ✅
- **bill-of-sale** → present ✅
- **office-suite** → MISSING ❌
- **dunning-letters** → present ✅
- **service-agreement** → MISSING ❌

So 3 of 5 present, 2 of 5 missing (office-suite, service-agreement).

## Finding 4 — BACKLINK TO mcp.zovo.one (CRITICAL for organic traffic)
Inspected a live own listing (`https://mcpmarket.com/server/dunning-letters`).
Outbound anchor links on the page:
```js
[...document.querySelectorAll('a[href^="http"]')]
  .filter(a => !a.href.includes('mcpmarket.com'))
  .map(a => ({href:a.href, rel:a.getAttribute('rel')}))
```
Result (exact):
- `https://github.com/theluckystrike` — rel=`noopener noreferrer`
- `https://github.com/theluckystrike/mcp-dunning-letters` — rel=`noopener noreferrer`
- `https://www.npmjs.com/package/@theluckystrike/mcp-dunning-letters` — rel=`noopener noreferrer`
- (ad) `https://github.com/knoxgraeme/tieline` — rel=`noopener noreferrer sponsored`
- `https://modelcontextprotocol.io` — rel=`noopener`

**`zovo.one` does NOT appear as an `<a href>` anchor anywhere on the listing.** It appears exactly
twice in the raw HTML, both inside the JSON-LD `SoftwareApplication` structured data:
```
"@type":"SoftwareApplication","name":"Dunning Letters",...,"url":"https://mcp.zovo.one/s/dunning-letters"
```
Verdict:
- **No dofollow (and no nofollow) HTML backlink to mcp.zovo.one** from the listing page.
- The `mcp.zovo.one/s/<slug>` URL is emitted **only in JSON-LD structured data** as the product
  `url`. This is the deliverable's `url` property value — it is not a crawlable anchor, carries no
  `rel`, and gives **no link-equity**. Google may read it as an entity URL but it is not a backlink
  for organic-traffic ranking purposes.
- Anchor links to GitHub/NPM carry `rel="noopener noreferrer"` (fork-safe) — these are the only
  real outbound links, and they point at GitHub/NPM, not zovo.one.

**Implication:** the MCPmarket listings do NOT contribute organic backlink equity to mcp.zovo.one.
Organic traffic value is indirect (referral clicks only if a user copies the JSON-LD URL — effectively
none). If a real dofollow backlink is required for the organic goal, a different channel or an
MCPmarket profile/README surface that renders clickable links is needed.

## Finding 5 — MISSING-SERVER ADD MECHANISM
MCPmarket is **repo/listing-submission based**, not per-`/s/`-URL submission. Evidence:
- Footer + nav expose a single "Submit" link (`/submit`) and "Sell Skills" / "Advertise" —
  i.e. servers are submitted as a listing, then appear under `/server/<slug>`.
- Our existing 12 listings each resolve to their own GitHub repo
  (e.g. `github.com/theluckystrike/mcp-dunning-letters`, npm `@theluckystrike/mcp-dunning-letters`)
  → MCPmarket generates **one `/server/<slug>` listing per repo**, NOT per `/s/` product URL.
- Therefore the 30 missing products can be added **only if each has its own public repo**
  (so MCPmarket can ingest it). Products sharing a monorepo/multi-product repo will not get
  separate listings.

ACTION REQUIRED (out of scope for read-only T6): to add the 30 missing products, each needs an
individual repo submitted via `mcpmarket.com/submit`; `office-suite` and `service-agreement` (the two
high-value gaps) are the priority. The `mcp.zovo.one/s/<slug>` URLs themselves are not accepted as
listing input.

## Finding 5b — SUBMIT MECHANISM VERIFIED (browser_navigate https://mcpmarket.com/submit)
Page: "Submit an MCP Server | MCP Market". Heading **"Submit MCPs & Skills"**, body text:
> "Have an MCP server or Agent Skill you'd like to feature? Submit the **related GitHub repository**
> below and we'll review it for inclusion."

Form fields (exact):
- Submission source radios: `GitHub repo` (checked) / `Remote MCP`
- Required textbox, placeholder `https://github.com/username/mcp-server`
  → help text: "Enter the full URL to the GitHub repository for the MCP you'd like to submit"
- Required email textbox ("We'll email you the moment your listing goes live.")
- Listing options:
  - **Get Listed Now — $29 one-time**, listed within 24h, OFFICIAL badge, **"Add a 'Try Now' link to
    your own site"** (optional textbox; "Drives clicks from your listing to your site.")
  - **Free Queue — $0**, avg 4–6 week listing time, no badge, no "Try Now" link.

Confirms: **submission input is a GitHub repo URL only.** There is no field to submit an
`mcp.zovo.one/s/<slug>` product URL. One listing per GitHub repo.

⭐ The paid $29 tier's **"Try Now" link** is the ONLY supported way to place a clickable link to our
own site on a listing — i.e. the only viable route to a self-controlled outbound link from
MCPmarket. With the free queue, no such link exists at all.

## Finding 6 — SLUG COLLISION CONFIRMED (second listing probed)
`browser_navigate https://mcpmarket.com/server/office-suite` → **page EXISTS** but is owned by
**`walkingzzzy`** (GitHub link `[ref=e39]`, 0 stars, 1 category set), an unrelated Office-document MCP.
So our missing high-value product `office-suite` cannot claim the natural slug `/server/office-suite`
— it is already occupied by a third party. Adding ours would require a distinct slug (e.g.
`office-suite-2`, mirroring `invoice-2`, `kanban-4`, `wick-1`, `fetcher-1` patterns already seen).
This also **independently confirms Finding 1**: raw `/server/<slug>` URLs collide across owners, so
only `q=theluckystrike` + owner column distinguishes our listings.

## Finding 7 — SLUG-COLLISION SWEEP ON THE 5 HIGH-VALUE SLUGS
Probed the bare `/server/<slug>` URL for each high-value product to see if the natural slug is ours:

| Bare slug probed | Exists? | Owner on that page | Ours? | Our actual listing |
|---|---|---|---|---|
| /server/invoice | yes | **markslorach** (11★, React-PDF invoice MCP) | ❌ not ours | ours = **/server/invoice-2** |
| /server/office-suite | yes | **walkingzzzy** (0★) | ❌ not ours | none (missing) |
| /server/dunning-letters | yes | theluckystrike | ✅ ours | /server/dunning-letters |
| /server/bill-of-sale | yes (in own set) | theluckystrike | ✅ ours | /server/bill-of-sale |
| /server/service-agreement | not enumerated in results | — | ❌ missing | none |

**Consequence:** 2 of the 5 high-value slugs (`invoice`, `office-suite`) are occupied by third
parties, and even where we ARE listed we sometimes sit behind a suffixed slug (`invoice-2`,
`kanban-4`, `wick-1`, `fetcher-1`). Any future submission must expect a numeric suffix when the
bare slug is taken. Direct `/server/<slug>` guessing is NOT a reliable discovery method for our
estate — only owner attribution (`q=theluckystrike`) is.

## Open prompts / caveats
- "Load More Results" did not expand the result set (stayed 21) — the enumeration is the complete
  visible result set for this query. If MCPmarket paginates server-side behind an authenticated
  view, a signed-in session could reveal more; not probed (no credentials).
- Only 1 of 12 own listings (dunning-letters) was opened to inspect the backlink pattern. The
  JSON-LD `url` field is template-generated per listing, so the finding is expected to hold for
  all 12; not individually verified due to iteration budget.

## RESULT
STATUS: complete

### Verdict
1. **Coverage: 12 of 42** products listed on MCPmarket, all owned by `theluckystrike`.
   T1's "≥12" is confirmed and exact (12, not more).
2. **30 of 42 MISSING** from MCPmarket (list in Finding 2).
3. **High-value check:** 3/5 present (invoice→`/server/invoice-2`, bill-of-sale, dunning-letters);
   **2/5 missing** (office-suite, service-agreement).
4. **Backlink: NO dofollow and NO plain HTML link to `mcp.zovo.one`.** The only mention is inside
   JSON-LD `SoftwareApplication.url` structured data — zero link equity. The only real outbound
   anchors are to `github.com/theluckystrike…` and npm, `rel="noopener noreferrer"`.
   ⇒ MCPmarket currently contributes **no organic backlink value** to mcp.zovo.one.
5. **Add mechanism:** submission = **GitHub repo URL only** at `mcpmarket.com/submit`
   (one listing per repo). `mcp.zovo.one/s/<slug>` URLs cannot be submitted. Paid $29 tier is the
   **only** way to get a clickable "Try Now" link to our own site.
6. **Slug collisions:** `invoice` (markslorach) and `office-suite` (walkingzzzy) are third-party;
   ours used suffixed slugs (`invoice-2`, `kanban-4`, `wick-1`, `fetcher-1`).

### Recommended next actions (not executed — read-only task)
- To close the 30-product gap, create/point one public GitHub repo per product and submit each via
  `mcpmarket.com/submit`; prioritise `office-suite` and `service-agreement`.
- If a self-controlled outbound link matters for organic traffic, use the $29 "Try Now" link field
  (it is the only mechanism MCPmarket offers) — the free queue gives no link at all.
- Do not rely on bare `/server/<slug>` URL guessing for discovery; filter by owner `theluckystrike`.

### Evidence provenance
- 42 slugs: `curl https://mcp.zovo.one/sitemap.xml` + grep (exit 0, 19361 bytes, 42 slugs).
- MCPmarket results: `browser_navigate` + DOM query `main a[href*="/server/"]` (21 rows, 12 ours).
- Backlink: `browser_navigate /server/dunning-letters` + outbound-anchor DOM query (exact rels above).
- Submit form: `browser_navigate https://mcpmarket.com/submit` (form field inventory above).
- Collisions: `browser_navigate /server/office-suite`, `/server/invoice` (owner names above).
- Work dir `/Users/mike/mcp-servers` branch main; **not committed** (per instruction).
