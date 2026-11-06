# A7-cline notes
STATUS: done — PR open

## Findings
- cline/cline has no mcp_marketplace.json; catalog lives in cline/marketplace repo (registry/mcps/<slug>/entry.json), served at https://cline.github.io/marketplace/catalog.json. Adapted per task instructions.
- CONTRIBUTING.md: single folder per entry, tags from tags.json only, verified:false.
- Direct push to cline/marketplace denied (403); forked to theluckystrike/marketplace.
- PR: https://github.com/cline/marketplace/pull/413 — 12 entries (zovo-invoice, time-tracker, price-tracker, expense-tracker, bank-statement, quotes, kanban, resume, docx, pdf, spreadsheet, currency).
- Tool counts for 10 servers unknown → description says "focused tool set" instead of inventing numbers. npm run validate not run (no npm install allowed); noted in PR body.

## Plan
1. Find marketplace file in cline/cline
2. Check contribution rules
3. Fork/branch, add entries, PR
