# INTEL_R2 — Submission, directory, and registry-slot re-measurement

Measured 2026-09-03 (registry re-probe, PR/issue checks, directory curls, `node scripts/measure.mjs`).
Raw structured data: `data/intel_r2.json`.

## 1. Submission status

| Submission | State | Reviews | Comments | Maintainer request |
|---|---|---|---|---|
| [docker/mcp-registry#4892](https://github.com/docker/mcp-registry/pull/4892) | OPEN | 0 | 0 | none |
| [punkpeye/awesome-mcp-servers#13473](https://github.com/punkpeye/awesome-mcp-servers/pull/13473) | OPEN | 0 | 2 (bots) | **see verbatim below** |
| cline/mcp-marketplace#2397 (Time Tracker) | OPEN | — | 0 | none |
| cline/mcp-marketplace#2398 (Price Tracker) | OPEN | — | 0 | none |
| cline/mcp-marketplace#2399 (Spreadsheet) | OPEN | — | 0 | none |
| cline/mcp-marketplace#2400 (Invoice) | OPEN | — | 0 | none |
| cline/mcp-marketplace#2401 (Expense Tracker) | OPEN | — | 0 | none |

All 7 submissions remain unmerged/unreviewed by a human. No labels on any cline issue.

**Verbatim maintainer/bot requests on PR#13473 (awesome-mcp-servers), both posted 2026-09-02T13:19:09Z:**

1. `glama-check` bot: *"To ensure that only working servers are listed, we're updating our listing requirements. Please complete: 1) Ensure your server is listed on Glama (glama.ai/mcp/servers) and verify it passes all checks (add Dockerfile directly to Glama; server must start and respond to introspection). 2) Update your PR by adding a Glama score badge after the server description: `[![OWNER/REPO MCP server](https://glama.ai/mcp/servers/OWNER/REPO/badges/score.svg)](https://glama.ai/mcp/servers/OWNER/REPO)`."*
2. `emoji-check` bot: *"Your submission is missing a required emoji tag or uses an unrecognized one. Each entry must include at least one of the permitted emojis after the repository link."* (list includes 🐍 Python, 📇 TS/JS, 🏠 Local Service, 🍎 macOS, 🪟 Windows, etc.)

**Action implied:** PR#13473 will not pass CI until (a) each server is separately listed and passing checks on Glama, (b) a Glama badge is added per entry, and (c) a permitted emoji tag is added per entry. Currently none of the 6 servers are listed on Glama at all (see section 2), so this is a hard blocker, not just cosmetic.

## 2. Directory listings (theluckystrike / our 6 server names)

| Directory | Listed? | Evidence |
|---|---|---|
| mcpservers.org | Unverifiable | Client-rendered SPA (Next.js), curl returns only the app shell; no server-rendered results or discoverable JSON/algolia endpoint |
| mcpmarket.com | Unverifiable | HTTP 403 on every request (blocked at edge) |
| glama.ai/mcp/servers?query=theluckystrike | **No** | Only 1 hit for author theluckystrike: `bln-mcp-grammar-server` (pre-existing, unrelated). Direct slug probes `glama.ai/mcp/servers/theluckystrike/<time-tracker\|price-tracker\|spreadsheet\|invoice\|expense-tracker\|office-suite>` all 404 |
| registry.smithery.ai (q=theluckystrike, + per-name queries) | **No** | Zero theluckystrike matches in any of the 6 per-name searches; top rows are unrelated third-party servers |
| PulseMCP | Unverifiable | HTTP 403 on every request (blocked at edge) |

**Bottom line:** confirmed absent from Glama and Smithery (the two we could actually query); mcpservers.org, mcpmarket.com, PulseMCP could not be confirmed either way with curl alone (403 or client-side rendering).

## 3. Official registry slot movement (registry.modelcontextprotocol.io)

Compared to `data/registry_rank.json` → `after_v2_2026-09-02_post_expense_office` snapshot.

| Token | Results before | Results now | Our best rank before | Our best rank now |
|---|---|---|---|---|
| timesheet | 3 | 5 | 2 | **1** |
| billable | 2 | 4 | 2 | **1** |
| hours | 3 | 5 | 3 | **2** |
| mileage | 1 | 3 | 1 | 1 |
| receipts | 5 | 7 | 4 | 4 |
| expense | 15 | 19 | 15 | 15 |
| invoice | 94 | 98 | 83 | 89 (worse: office-suite now also matches, pushing rank down) |
| xlsx | 20 | 22 | 20 | 19 |
| csv | 18 | 20 | 18 | 17 |
| drop | 165 | 167 | 160 | 162 |
| alert | 44 | 47 | 36 | 39 |
| office | 32 | 34 | none (unpublished) | **33** (office-suite server now live) |
| suite | 86 | 88 | none (unpublished) | **78** (office-suite server now live) |

**Key finding:** `io.github.theluckystrike/office-suite-time-invoice-expense-excel-price` — previously recorded as "never published via mcp-publisher" — **is now live in the registry** and appears in the `office` and `suite` slots.

**New (non-ours) servers in these slots:** none detected. Every token's result-count delta (+2 to +4) is fully explained by our own re-publishes (new versions of existing rows + the new office-suite server); no unfamiliar third-party names appeared ahead of or displacing us in the time-tracker, price-tracker, or expense slots.

## 4. GitHub repository search (`gh api search/repositories`)

| Query | Our rank in first 30 |
|---|---|
| "mcp time tracker" | not present |
| "mcp invoice" | not present |
| "mcp expense tracker" | not present |
| "mcp spreadsheet excel" | not present |
| "mcp price tracker" | **present**: `theluckystrike/mcp-price-tracker` #12, `theluckystrike/mcp-servers` (monorepo) #23 |

Only 1 of 5 target queries surfaces us at all, and only via the standalone `mcp-price-tracker` mirror repo plus the monorepo, not via GitHub topic/description matching for the other 4 product categories.

## 5. Downloads and traffic (`node scripts/measure.mjs`)

| Metric | Previous snapshot (2026-09-02T15:18Z) | Current (2026-09-02T23:40Z) | Delta |
|---|---|---|---|
| Release downloads (all .mcpb assets, all tags) | 55 | 79 | **+24** |
| GitHub views/uniques/clones (14d) | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | flat |
| npm weekly downloads (time-tracker/price-tracker/spreadsheet/invoice) | 404 / 404 / 404 / 404 | 404 / 404 / 404 / 404 | flat, identical across all 4 packages -- looks like a placeholder/error value, not real traffic |

## RESULT block

```
INTEL_R2 RESULT — 2026-09-03
- Submissions: 7 open, 0 merged, 0 human reviews. awesome-mcp-servers PR#13473 blocked by 2 bot checks (Glama listing+badge required, emoji tag required) — hard blocker, not yet listed on Glama at all.
- Directories: confirmed NOT listed on Glama or Smithery for any of 6 servers/theluckystrike; mcpservers.org/mcpmarket.com/PulseMCP unverifiable (403 or client-rendered).
- Registry: office-suite server went from unpublished to LIVE, now ranks #33 (office) / #78 (suite). timesheet/billable/hours improved by 1 rank each (new server entry outranks old). invoice/drop/alert ranks slipped slightly (own new rows pushed down by alphabetical/paginated ordering). No third-party competitor growth detected in any of the 13 tokens -- all count deltas trace to our own re-publishes.
- GitHub repo search: visible only for "mcp price tracker" (#12 and #23 of 30); invisible for time tracker, invoice, expense tracker, spreadsheet+excel.
- Downloads: +24 release downloads (55->79) in ~8 hours; GitHub traffic still flat at zero; npm weekly download figures unchanged and suspiciously identical across packages (likely placeholder, not signal).
```
