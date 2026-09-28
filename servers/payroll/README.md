# MCP Payroll — gross-to-net for hourly staff, computed in the conversation

Give Claude (or any MCP client) a payroll estimator: `payroll_run` turns hours worked × hourly rate − tax rate into gross pay, tax withheld and net pay; `payroll_invoice_total` sums a batch of runs into one payroll total. For solo operators, small teams and anyone who pays hourly people and wants the arithmetic done right the first time.

## Why a payroll server

Full payroll platforms are built for 50-person companies and price accordingly. If you pay two freelancers and a part-timer, what you actually need is: "Ana worked 32.5 hours at $28, tax 22% — what do I pay her?" answered instantly, and a total across everyone this period. This server does exactly that, locally, with nothing leaving your machine.

## What it does

- `payroll_run` — hours, hourly rate, tax rate (%) → gross, tax withheld, net. Fractional hours (32.5) handled as-is.
- `payroll_invoice_total` — several runs in, one payroll total out: combined gross, tax and net for the period.

## Install

```json
{
  "mcpServers": {
    "mcp-payroll": {
      "command": "npx",
      "args": ["-y", "github:theluckystrike/mcp-payroll"]
    }
  }
}
```

## Try it

- "Ana: 32.5h at 28/h, 22% tax. Ben: 18h at 35/h, 20% tax. Run both and give me the payroll total."
- "What's the net for 40 hours at 24/h with 18% tax?"

## Part of the luckystrike MCP suite

Free, part of the [luckystrike MCP suite](https://github.com/theluckystrike) — productivity & finance servers that turn AI chat into working documents and calculations. Listing in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=theluckystrike%2Fpayroll).

## Docs (GitMCP)

Live docs endpoint: https://gitmcp.io/theluckystrike/mcp-payroll
