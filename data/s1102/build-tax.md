# S1102 lane build-tax

Two new data satellites, built to the S1030 contract and live.

| repo | hosted URL | worker version | tests | live calls | npx github | registry |
|---|---|---|---|---|---|---|
| car-loan-interest-deduction-calculator-mcp | https://car-loan-interest-deduction-calculator-mcp.lipmichal.workers.dev/mcp | 1692d796-c0d6-4bde-84a3-40fb79bd969f | 26/26 | 4/4 | ok | visible 1.0.0 |
| section-179-deduction-calculator-mcp | https://section-179-deduction-calculator-mcp.lipmichal.workers.dev/mcp | ce1b0808-4348-4788-b029-0579ce01dc36 | 20/20 | 4/4 | ok | visible 1.0.0 |

Rollback for each: `npx wrangler delete --name <repo>` (new workers, one version each).

Sources: all from irs.gov fetched 2026-11-02 (Schedule 1-A, 1040 instructions, Notice 2025-57, Schedule A instructions and 2026 draft, Rev. Proc. 2024-40, 2025-32, 2025-16, 2026-15, Schedule 8812, Form 4562 instructions, Pub. 946, Notice 2026-11) plus IRC 164(b)(7) from Cornell LII for the SALT 2027-2030 steps. Each repo has DATA_SOURCES.md.

2027: no inflation Rev. Proc. yet. Tools say so for 2027.

Open: npm publish (owner 2FA batch); packages are npm-ready and names are free. Details and raw live responses in the per-repo JSON files.
