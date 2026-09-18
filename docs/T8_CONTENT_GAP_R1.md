# T8 — Organic Content Gap: 3 New Guides (R1)

**STATUS: complete — 3 guides applied to content.js (faq fields added by orchestrator, tests 152/152). Agent hit cap after writing patch; patch content was already applied.

Task: pick the 3 highest-search-volume bookkeeping/invoicing informational keywords not yet covered by existing guides, and author full guide content (600–900 words each, genuinely useful, with config snippets using `https://mcp.zovo.one/mcp/<server>` endpoints) as new GUIDE_INDEX entries in a patch file.

## Chosen keywords (verified gaps against existing 117 guides)

| # | Keyword | Coverage in existing guides | Verdict |
|---|---------|------------------------------|---------|
| 1 | **invoice payment terms best practices** | No guide covers payment terms (Net 30, due dates, late fees, deposits). Nearest: `chase-unpaid-invoices-without-a-crm`, `client-statements-and-dunning-from-chat`, `client-deposits-and-retainers-from-chat`, `vat-and-reverse-charge-invoices-from-chat`. None states terms best practices. | **GAP** |
| 2 | **how to categorize bank transactions** | `bank-statement-csv-categorize-reconcile` (bank CSV import), `mcp-server-that-reads-bank-statements-and-categorizes` (PDF), `reconcile-a-bank-export-with-your-invoices` (CSV reconcile). All file-import-specific; no standalone how-to on the categorization workflow (rules, categories, recurring txn). | **PARTIAL GAP → fill as how-to** |
| 3 | **petty cash log template** | `petty-cash-float-from-chat` (imprest float mechanics), `petty-cash-book-and-cash-ledger-mcp-servers` (does a server exist?). No guide ships an actual petty cash **log template**. | **GAP** |

## Server endpoints referenced (verified present in repo)
- `invoice` → https://mcp.zovo.one/mcp/invoice
- `bank-statement` → https://mcp.zovo.one/mcp/bank-statement
- `expense-tracker` → https://mcp.zovo.one/mcp/expense-tracker
- `petty-cash` → https://mcp.zovo.one/mcp/petty-cash
- `cash-book` → https://mcp.zovo.one/mcp/cash-book

## Deliverable files
- `docs/T8_CONTENT_GAP_R1.md` — this report.
- `docs/T8_CONTENT_GAP_R1.patch` — V4A patch adding 3 new GUIDE_INDEX entries to `billing/src/content.js`.

## Guide authoring (600–900 words each)
- `invoice-payment-terms-best-practices` → target "invoice payment terms best practices"
- `how-to-categorize-bank-transactions` → target "how to categorize bank transactions"
- `petty-cash-log-template` → target "petty cash log template"

All use the established guide schema: `{ title, description, html: \`…\` }`, `${install("<server>")}` install helper, config snippets with `https://mcp.zovo.one/mcp/<server>`, internal `/s/<server>` product links, `<pre><code>` blocks.
