# R17 — mirror README product-page links (2026-09-22)

GSC recheck (sc-domain:zovo.one, SA adc): only homepage surfaces (19 imps/28d, 0 clicks) — indexing is the bottleneck, /s/* pages not seeded.

Fix: scripts/mirror-seo.py header now emits "Product page: <https://mcp.zovo.one/s/<name>>" for every hosted server; apply-mirror-seo.mjs pushed it to all 41 hosted mirrors (verified live via README API). office-suite/backlink-checker correctly omit (hosted=None). Repo description/homepage already correct.

Gap found: goods-receipt, leave, onboarding, purchase-requisition have hosted endpoints but no mirror repos (next: run sync-mirrors.sh for those 4).
