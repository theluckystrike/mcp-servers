# Section 179 Deduction Calculator MCP Server

This Actor is a **Section 179 deduction calculator** that AI agents and MCP clients can call: Claude, ChatGPT developer mode, Cursor, VS Code, Cline and any agent that speaks the Model Context Protocol (MCP). It returns the exact 2025 and 2026 federal numbers after the One Big Beautiful Bill Act (OBBBA, P.L. 119-21), with the IRS document cited in every answer.

**How you use it:** run it in Standby mode and connect your MCP client to `https://YOUR_USERNAME--section-179-deduction-calculator-mcp.apify.actor/mcp` with your Apify API token. Each successful tool call costs **$0.03**. Listing the tools is free.

## What this MCP server knows that your model does not

- The Section 179 limit is **$2,500,000 for 2025** and **$2,560,000 for 2026** (Rev. Proc. 2025-32), with the phase-out starting at $4,000,000 / $4,090,000. Models trained before OBBBA still quote the old limits.
- **Bonus depreciation is 100% again** for property acquired after January 19, 2025. The acquisition date is the date of a written binding contract, not delivery. Property acquired on or before that date and placed in service in 2025 gets 40%.
- The 2026 heavy SUV Section 179 cap is **$32,000** and the first-year cap on a passenger car of 6,000 lb or less is **$20,300 with bonus** (Rev. Proc. 2026-15).
- The IRS has not published the 2027 limits yet (checked 2026-11-02). The tools say so instead of guessing.

## Tools

| Tool | What it returns |
|---|---|
| `calculate_section_179` | Section 179 deduction with the annual limit, the dollar-for-dollar phase-out, the business income limit and the carryover. |
| `calculate_bonus_depreciation` | Bonus depreciation rate and amount from the acquisition and placed-in-service dates, applied after Section 179. Handles the 40% / 60% election and the phase-down for older property. |
| `get_vehicle_depreciation_limits` | First-year limits by gross vehicle weight: passenger auto caps, heavy SUV Section 179 cap, no cap over 14,000 lb, the over-50% business use rule. |
| `calculate_asset_loan_payment` | Monthly payment, total and first-year interest for an equipment, truck, tractor, RV, land or other asset loan, plus first-year net cash and lifetime after-tax cost for business use. |

Every result has structured JSON, a plain-English summary, `as_of` and `source`, so an agent can quote it and cite it.

## Pricing

Pay per event: **$0.03 per successful tool call** (event `tool-call`). `initialize`, `tools/list` and failed calls are not charged. In Standby mode Apify also bills the small platform usage of the running container on top of the event price. You can set a maximum charge per run in the Apify Console, and the Actor stops answering tool calls when that limit is reached. A normal (non-Standby) run only performs a free self-check.

## How to connect

1. Create a free Apify account and copy your API token from **Settings > API & Integrations** in the Apify Console.
2. The MCP endpoint is `https://YOUR_USERNAME--section-179-deduction-calculator-mcp.apify.actor/mcp` (streamable HTTP). Replace `YOUR_USERNAME` with the Apify username that owns this Actor.
3. Send the token as a Bearer header: `Authorization: Bearer YOUR_APIFY_TOKEN`.

### Claude Code

```bash
claude mcp add --transport http section-179 https://YOUR_USERNAME--section-179-deduction-calculator-mcp.apify.actor/mcp --header "Authorization: Bearer $APIFY_TOKEN"
```

### Cursor, VS Code, Cline and other clients with remote MCP support

```json
{
  "mcpServers": {
    "section-179": {
      "url": "https://YOUR_USERNAME--section-179-deduction-calculator-mcp.apify.actor/mcp",
      "headers": { "Authorization": "Bearer YOUR_APIFY_TOKEN" }
    }
  }
}
```

### Claude Desktop (through the mcp-remote bridge)

```json
{
  "mcpServers": {
    "section-179": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://YOUR_USERNAME--section-179-deduction-calculator-mcp.apify.actor/mcp", "--header", "Authorization: Bearer YOUR_APIFY_TOKEN"]
    }
  }
}
```

### Apify MCP server and the Apify API

You can also reach this Actor through the Apify MCP server (`https://mcp.apify.com`) or call the Standby URL from any HTTP client that speaks MCP.

## Example prompts

- "I am buying a $180,000 excavator in December 2026. How much can I deduct this year with Section 179 and bonus depreciation?"
- "My new SUV weighs 6,400 lb and costs $82,000. What is the 2026 first-year deduction limit if I use it 80% for business?"
- "Compare financing a $95,000 farm tractor over 60 months at 7.5% and what it costs after tax at a 24% marginal rate."

## Data and method

Rules and limits come from IRS revenue procedures and Form 4562 instructions (irs.gov), recorded with an `as_of` date and a `source` field on every result. Source list: `DATA_SOURCES.md` in the repository.

## Limits

Estimates for planning, not tax advice. Check Form 4562, its instructions and Pub. 946, or ask a tax professional before you file.

## FAQ

**Does it call the internet?**  
No. The calculations run inside the Actor from the bundled IRS tables, so results are fast and do not depend on a third-party API.

**Which tax years are covered?**  
2025 and 2026. For 2027 the tools report that the IRS has not published the limits.

**Is it affiliated with the IRS?**  
No. It applies published IRS rules and links to the irs.gov document it used.

**How is the Actor run?**  
The Actor starts the open-source MCP server bundled in this image (MIT licence) and exposes it over streamable HTTP in Apify Standby mode. It is built from the `apify/actor-templates` MCP proxy template. Source: https://github.com/theluckystrike/section-179-deduction-calculator-mcp

**What is MCP?**  
The Model Context Protocol is an open standard that lets AI assistants call tools. See https://modelcontextprotocol.io

## Related searches

Section 179 deduction calculator, Section 179 limit 2026, bonus depreciation calculator, OBBBA depreciation, heavy SUV deduction, equipment loan calculator, Form 4562, MCP server for tax
