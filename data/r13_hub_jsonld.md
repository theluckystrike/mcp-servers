# R13 — ItemList structured data on suite hubs

STATUS: complete (2026-09-22)

- Audit: /s/* pages already had SoftwareApplication LD; homepage WebSite; /guides + /suites/* had 0.
- Added hubItemList() helper (billing/src/index.js) emitting schema.org ItemList with per-server ListItem URLs.
- Injected on /suites/freelancer, /suites/documents, /suites/field-ops.
- Live-verified: all 3 return ItemList LD; IndexNow resubmit -> 200.
- Tests 164/0. Deploy version b488cb3d.
