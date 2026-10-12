# hourly-rate

MCP server: the minimum hourly rate a freelancer must charge to hit a desired annual
after-tax income, given business expenses, billable hours, working weeks and the tax
rate on profit. Plus a break-even rate and side-by-side what-if scenarios.

Free, pure calculation: no storage, no rate tables, no network.

## Tools

- `calculate_rate` — minimum hourly rate from income, expenses, hours, weeks, tax
- `break_even` — the rate that covers expenses only
- `what_if` — compare 2–12 scenarios, highest rate first

## Run

```sh
node servers/hourly-rate/src/index.js
```

## Install

One-click `hourly-rate.mcpb` bundle from the [releases page](https://github.com/theluckystrike/mcp-servers/releases/tag/v0.22.0),
or build from source. See [llms-install.md](llms-install.md).
