# MCP Tax Calculator — 2026 US federal brackets, computed in the conversation

Give Claude (or any MCP client) a tax estimator: `us_federal_tax` applies the 2026 US federal brackets for a single filer — including the $15,750 standard deduction — and returns total tax, effective rate, and marginal bracket. Planning numbers, computed on your machine, in one sentence.

## Why a tax server

Tax estimators on the web want your email before showing a number. This one does the bracket math immediately: give it gross income and get total federal tax, the effective rate, and which marginal bracket your last dollar lands in. Clearly labeled as approximate planning values — not filing advice — but exactly right for "can I afford X this year" conversations.

## What it does

- `us_federal_tax` — gross income → standard deduction applied ($15,750), 2026 brackets walked correctly (10% through 37%), total tax, effective rate, marginal bracket. Bracket edges are exact, not rounded.
- A single-tool server that does one thing: ask it as many income scenarios as you like in one conversation — bonus scenarios, side-income scenarios, comparisons.

## Install

```json
{
  "mcpServers": {
    "mcp-tax-calc": {
      "command": "npx",
      "args": ["-y", "github:theluckystrike/mcp-tax-calc"]
    }
  }
}
```

## Try it

- "Federal tax on 95,000 gross, single filer, 2026 brackets."
- "Compare tax on 85,000 vs 95,000 — what's the effective marginal hit?"

## Part of the luckystrike MCP suite

Free, part of the [luckystrike MCP suite](https://github.com/theluckystrike) — productivity & finance servers that turn AI chat into working documents and calculations. Listing in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=theluckystrike%2Ftax-calc).

## Docs (GitMCP)

Live docs endpoint: https://gitmcp.io/theluckystrike/mcp-tax-calc
