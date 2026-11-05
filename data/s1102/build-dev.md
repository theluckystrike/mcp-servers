# S1102 build-dev

Two satellites built per BRIEF-S1030. Details per repo in subdomain-finder-mcp.json and ab-test-sample-size-calculator-mcp.json.

- subdomain-finder-mcp: https://github.com/theluckystrike/subdomain-finder-mcp, https://subdomain-finder-mcp.lipmichal.workers.dev/mcp, worker version a6b35eb7-d553-4c22-a323-ab8713253e01 (rollback `npx wrangler delete --name subdomain-finder-mcp`). 4 tools, 16 fixtures green, 4/4 live curl calls OK, npx github OK, registry visible.
- ab-test-sample-size-calculator-mcp: https://github.com/theluckystrike/ab-test-sample-size-calculator-mcp, https://ab-test-sample-size-calculator-mcp.lipmichal.workers.dev/mcp, worker version 38cd6868-1f75-475a-83dd-58f881a48241 (rollback `npx wrangler delete --name ab-test-sample-size-calculator-mcp`). 5 tools, 16 fixtures green, 5/5 live curl calls OK, npx github OK, registry visible.
- npm: both names returned E404 on `npm view` (free). package.json is npm-ready (bin, files, mcpName, keywords). Not published.
- Evidence: data/s1102/build-dev/ (CT probes, Evan Miller JS, scipy reference output). Raw live responses in each repo's .live/ (gitignored).
