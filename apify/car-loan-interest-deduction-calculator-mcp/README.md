# Car Loan Interest Deduction Calculator MCP

This Actor is a **car loan interest deduction calculator** for AI agents and MCP clients (Claude, ChatGPT developer mode, Cursor, VS Code, Cline and others). It applies the 2025-2028 deduction created by the One Big Beautiful Bill Act (OBBBA, P.L. 119-21) and also covers the new SALT cap, the child tax credit and the 2025 and 2026 federal brackets, citing the IRS source for each answer.

**How you use it:** run it in Standby mode and connect your MCP client to `https://YOUR_USERNAME--car-loan-interest-deduction-calculator-mcp.apify.actor/mcp` with your Apify API token. Each successful tool call costs **$0.03**. Listing the tools is free.

## What this MCP server knows that your model does not

- The **car loan interest deduction started in tax year 2025**, after most models were trained. You can take it without itemizing.
- The cap is $10,000 a year and the **phase-out is $200 for each $1,000 (or part of $1,000)** of modified adjusted gross income over $100,000 ($200,000 joint). One dollar over a step removes a whole $200.
- Only **new vehicles with final assembly in the US** qualify, the loan must be originated after December 31, 2024, and leases never count.
- The **SALT cap is $40,000 for 2025 and $40,400 for 2026**, not $10,000, shrinking by 30 cents per dollar above $500,000 of MAGI but never below $10,000. The 2026 standard deduction is $16,100 single and $32,200 joint.

## Tools

| Tool | What it returns |
|---|---|
| `calculate_car_loan_interest_deduction` | Deduction after the $10,000 cap and the MAGI phase-out, with a check of the vehicle and loan tests: new, US final assembly, personal use, loan date, weight, first lien, not a lease. |
| `calculate_salt_deduction` | Deductible state and local tax under the SALT cap for 2025-2030, the 30% phase-down and the $10,000 floor, optionally compared with the standard deduction. |
| `get_tax_brackets_and_standard_deduction` | 2025 and 2026 brackets and standard deductions, the extra amount for age 65 or blind, and the tax and marginal rate on a given taxable income. |
| `calculate_child_tax_credit` | $2,200 per child and $500 per other dependent, the 5% phase-out, the tax liability limit and the refundable part up to $1,700 per child. |

Every result has structured JSON, a plain-English summary, `as_of` and `source`, so an agent can quote it and cite it.

## Pricing

Pay per event: **$0.03 per successful tool call** (event `tool-call`). `initialize`, `tools/list` and failed calls are not charged. In Standby mode Apify also bills the small platform usage of the running container on top of the event price. You can set a maximum charge per run in the Apify Console, and the Actor stops answering tool calls when that limit is reached. A normal (non-Standby) run only performs a free self-check.

## How to connect

1. Create a free Apify account and copy your API token from **Settings > API & Integrations** in the Apify Console.
2. The MCP endpoint is `https://YOUR_USERNAME--car-loan-interest-deduction-calculator-mcp.apify.actor/mcp` (streamable HTTP). Replace `YOUR_USERNAME` with the Apify username that owns this Actor.
3. Send the token as a Bearer header: `Authorization: Bearer YOUR_APIFY_TOKEN`.

### Claude Code

```bash
claude mcp add --transport http car-loan-interest https://YOUR_USERNAME--car-loan-interest-deduction-calculator-mcp.apify.actor/mcp --header "Authorization: Bearer $APIFY_TOKEN"
```

### Cursor, VS Code, Cline and other clients with remote MCP support

```json
{
  "mcpServers": {
    "car-loan-interest": {
      "url": "https://YOUR_USERNAME--car-loan-interest-deduction-calculator-mcp.apify.actor/mcp",
      "headers": { "Authorization": "Bearer YOUR_APIFY_TOKEN" }
    }
  }
}
```

### Claude Desktop (through the mcp-remote bridge)

```json
{
  "mcpServers": {
    "car-loan-interest": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://YOUR_USERNAME--car-loan-interest-deduction-calculator-mcp.apify.actor/mcp", "--header", "Authorization: Bearer YOUR_APIFY_TOKEN"]
    }
  }
}
```

### Apify MCP server and the Apify API

You can also reach this Actor through the Apify MCP server (`https://mcp.apify.com`) or call the Standby URL from any HTTP client that speaks MCP.

## Example prompts

- "I bought a new Ford F-150 built in Michigan in March 2025 and paid $3,200 of interest. My MAGI is $105,000 and I file single. What is my car loan interest deduction?"
- "How much SALT can a married couple with $620,000 MAGI and $52,000 of state taxes deduct in 2026?"
- "What are the 2026 federal tax brackets and what is the tax on $85,000 of taxable income, head of household?"

## Data and method

Rules and amounts come from IRS forms and revenue procedures (Schedule 1-A, Rev. Proc. 2025-32 and others on irs.gov). Every result carries `as_of` and `source`. Source list: `DATA_SOURCES.md` in the repository.

## Limits

Estimates for planning, not tax advice. Check the Schedule 1-A instructions or ask a tax professional before you file.

## FAQ

**Does it need my personal data?**  
It needs only the numbers you give it (filing status, MAGI, interest paid). Nothing is stored by the calculator.

**Which years does it cover?**  
The car loan deduction for 2025-2028, SALT for 2025-2030, brackets and child tax credit for 2025 and 2026. Missing years are reported as not yet published.

**Does it call the internet?**  
No. It runs from the bundled IRS tables.

**How is the Actor run?**  
The Actor starts the open-source MCP server bundled in this image (MIT licence) and exposes it over streamable HTTP in Apify Standby mode. It is built from the `apify/actor-templates` MCP proxy template. Source: https://github.com/theluckystrike/car-loan-interest-deduction-calculator-mcp

**What is MCP?**  
The Model Context Protocol is an open standard that lets AI assistants call tools. See https://modelcontextprotocol.io

## Related searches

car loan interest deduction calculator, OBBBA car loan interest, Schedule 1-A, SALT cap calculator 2026, child tax credit calculator, 2026 tax brackets, MCP server for tax
