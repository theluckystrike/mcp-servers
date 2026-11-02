# build-edu lane, S1102 (2026-11-02)

Two data satellites built, deployed, pushed and published to the official registry. Not published to npm (package.json is npm-ready; `npm view` returns E404 for both names, positive control cups-to-grams-mcp returns 1.0.0).

| repo | hosted URL | worker version | tests | live tools/call | npx github | registry |
| --- | --- | --- | --- | --- | --- | --- |
| recipe-nutrition-calculator-mcp | https://recipe-nutrition-calculator-mcp.lipmichal.workers.dev/mcp | 204d7edb-006f-41e2-b614-bd36b6f3b6bf | 24/24, 19 fixtures | 4/4 | ok | visible |
| ap-score-distributions-mcp | https://ap-score-distributions-mcp.lipmichal.workers.dev/mcp | 68e9e6cf-78d4-4d8a-9113-fee80ee00316 | 20/20, 15 fixtures | 5/5 | ok | visible |

Rollback for each: `npx wrangler delete --name <repo>` (brand-new workers).
Details and open issues: recipe-nutrition-calculator-mcp.json, ap-score-distributions-mcp.json in this folder. Deletions: build-edu/deletions-manifest.tsv.
