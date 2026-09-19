# T1 — MCP Market (mcpmarket.com) Listing Verification — Round 1

STATUS: verified

The theluckystrike MCP estate is publicly listed on
mcpmarket.com and discoverable by author-name search. See "Caveat" below regarding
which repo URL the listings point at.

Verified: 2026-09-18 (sprint 43), via browser tools only (curl is 403-blocked by the
site's bot shield; all evidence below was collected in a real Chrome session).

---

## 1. Method / tooling note

- `curl` to `https://mcpmarket.com/server/theluckystrike-mcp-servers` → **403** (bot shield).
  Recorded as context only; not re-attempted.
- All verification performed with browser navigation on `https://mcpmarket.com`.
- The site is a Next.js SPA: clicking result cards does **not** push `location.href`, so
  in-page clicks report success but leave the URL on `/search`. Direct navigation to the
  `/server/<slug>` URL is the reliable read.

## 2. Evidence — search by author name

Page title: `Search Search results for "theluckystrike" | MCP Market`

Search returned our servers (exact listing titles + descriptions as rendered):

| Listing title | Category shown | Detail URL (captured) |
|---|---|---|
| Dunning Letters | E-COMMERCE SOLUTIONS | `/server/dunning-letters` |
| Checklist | DEVELOPER TOOLS | `/server/checklist` |
| Petty Cash | PRODUCTIVITY & WORKFLOW | `/server/petty-cash` |
| Currency | DEVELOPER TOOLS | `/server/currency` |
| Credit Note | ANALYTICS & MONITORING | `/server/credit-note` |
| Bill of Sale | OTHER | `/server/bill-of-sale` |
| Kanban | DEVELOPER TOOLS | `/server/kanban-4` |
| Packing List | E-COMMERCE SOLUTIONS | `/server/packing-list` |
| Cash Book | DEVELOPER TOOLS | `/server/cash-book` |
| Job Card | ANALYTICS & MONITORING | `/server/job-card` |
| Productivity Suite | WEB SCRAPING & DATA COLLECTION | `/server/productivity-suite` |
| Invoice | DEVELOPER TOOLS | `/server/invoice-2` |

Note: 12 theluckystrike-authored cards are rendered in the first result page (20 items
total including other authors' fuzzy matches such as `hexstrike-ai`, `blitzstrike`,
`cyberstrike`). A "Load More Results" button is present, so the author has **at least 12**
published listings; this run did not expand the full set (not needed for the verdict).
The prior "0 matches for theluckystrike" observation was simply wrong — the current
result page shows the entity clearly.

## 3. Evidence — search by 'zovo'

Result set is fuzzy-matched Z-terms only (Zotero ×4, Zscaler, Zvec, ZeroZen ×2,
Zengram, Z-Image Studio, Zero-Vector, etc.). **No zovo.one / theluckystrike result.**
Interpretation: the market indexes by **author handle + server name**, not by the
contact email domain. Email (`support@zovo.one`) is not a searchable surface — its
absence from results is expected and is NOT evidence against the submission.

## 4. Evidence — individual listing page live

Page title: `Invoice: Generate Professional PDF Invoices from Chat`

Rendered on-page (exact strings observed):
- H1: `Invoice`
- `image "theluckystrike"` → `by` → link `theluckystrike`
- Links present: `GitHub`, `NPM`, category links `API DEVELOPMENT`, `DEVELOPER TOOLS`, `PRODUCTIVITY & WORKFLOW`
- Tagline: "Generate professional, numbered invoices with tax lines and client details,
  rendered as a ready-to-send PDF directly from chat."
- Tabs: `About` / `README` / `FAQ`
- Key Features block 01–06, including `05 0 GitHub stars`
- Use Cases block 01–03
- Related MCPs rail (Neon, Firecrawl, Figma Context) and one `Advertisement` slot
  (sponsored: "Tieline — product intent grounded in code")

A populated About + Key Features + Use Cases body confirms the submitter-supplied
copy was processed and published — the listing is not an empty stub. A full detail
page render (not a 404, not a "pending review" placeholder) is strong evidence the
Free Queue submission was ingested and published.

## 5. CAVEAT — wrong repo URL on the listings

DOM read on `/server/invoice-2`:

```
authorHref: ["https://github.com/theluckystrike"]   <- author profile link, resolves OK
GitHub links on page: https://github.com/theluckystrike/mcp-invoice
```

**The listings link to `github.com/theluckystrike/mcp-invoice` (a per-server repo),
NOT to `github.com/theluckystrike/mcp-servers` (the monorepo that was submitted).**

Consequences to flag for the sprint owner:
1. The submission registered, but the canonical source link attached to at least this
   listing points at the single-server repo, not the estate monorepo.
2. Our monorepo `https://github.com/theluckystrike/mcp-servers` therefore has **no
   inbound GitHub link from mcpmarket.com** as a result of this submission.
3. The `NPM` link on the page also implies a published-package link; confirm per-server
   package URLs are correct if npm distribution was intended.
4. `0 GitHub stars` displayed — the star count is read from the linked repo, so if it
   is reading `mcp-invoice` rather than the monorepo, the estate's social proof is not
   being surfaced.

Recommended follow-up (NOT executed in this round): claim/adopt the listings via a
mcpmarket account, and correct the source repo link to the monorepo where the
per-server link is undesired.

## 6. Non-findings / things that did not resolve

- `https://mcpmarket.com/author/theluckystrike` → **404** (`404 / This page could not
  be found.`). There is no public per-author profile route at that path; the author
  name on a server card links out to GitHub instead (see §5). No author dashboard URL
  was located.
- `https://mcpmarket.com/submit` was **not** opened with a logged-in session (no
  session exists in this browser), so a "submission received / pending" state could not
  be observed. This is not a blocker: §4 already proves publication.
- The 403-returning `curl` URL `/server/theluckystrike-mcp-servers` does not correspond
  to any real route — listings are slugged per **server name** (`/server/invoice-2`),
  not per **repo name**. Chasing that URL was a dead end by design.

## 7. Re-submission decision

Rationale: the required precondition ("clear evidence the earlier
submission never registered") is false — §4 shows a live, fully populated listing for
this author. The Free Queue submission registered. No form was touched, so no
confirmation capture was needed.

---

## STATUS: verified

| Question | Answer |
|---|---|
| Is the listing live? | **YES — CONFIRMED LIVE** |
| Discoverable by author search? | YES — `?q=theluckystrike` returns ≥12 our listings |
| Discoverable by 'zovo'? | NO — expected; email domain is not an indexed field |
| Individual detail page renders? | YES — `/server/invoice-2` fully populated |
| Points at the submitted repo? | **NO — points at `github.com/theluckystrike/mcp-invoice`** |
| Re-submitted this round? | NO — precondition not met |
