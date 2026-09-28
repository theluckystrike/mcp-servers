# MCP Loan Calculator — monthly payments and full amortization in one sentence

Give Claude (or any MCP client) real loan math: `loan_payment` for the monthly payment and total interest of a loan, `loan_amortize` for the full month-by-month schedule. Standard amortization formula, computed on your machine, no rate-shopping site and no spreadsheet.

## Why a loan server

Mortgage and loan calculators on the web bury the answer under ads and lead forms. Here you ask "what's the monthly payment on a 420,000 loan at 5.5% for 25 years" and get the number, the total interest, and — if you want it — every row of the amortization schedule: principal vs interest per month, balance after each payment, the month the balance crosses half. Useful for comparing offers side by side in one conversation.

## What it does

- `loan_payment` — principal, annual rate (%), term in years → monthly payment, total paid, total interest. Zero-interest loans are handled exactly (straight-line division), not by a formula edge case.
- `loan_amortize` — the same inputs → the full schedule, month by month, with running balance. Ask for "first 12 months" or the whole term.

## Install

```json
{
  "mcpServers": {
    "mcp-loan-calculator": {
      "command": "npx",
      "args": ["-y", "github:theluckystrike/mcp-loan-calculator"]
    }
  }
}
```

## Try it

- "Monthly payment on a 420,000 mortgage at 5.5% over 25 years, plus total interest."
- "Amortize a 30,000 car loan at 7.9% for 5 years — show me the first year."
- "Compare: 25 years at 5.5% vs 20 years at 5.2%. Which costs less overall?"

## Part of the luckystrike MCP suite

Free, part of the [luckystrike MCP suite](https://github.com/theluckystrike) — productivity & finance servers that turn AI chat into working documents and calculations. Listing in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=theluckystrike%2Floan-calculator).

## Docs (GitMCP)

Live docs endpoint: https://gitmcp.io/theluckystrike/mcp-loan-calculator
