## What this adds

- **Name**: 15 data MCP servers from one author (list below)
- **URL**: https://github.com/theluckystrike (one repository per server)
- **Category**: Finance (9), Search & Knowledge (3), Productivity (1), Marketing & Analytics (1), Security (1)
- **Language**: TypeScript
- **Section**: Servers

One row per server, each in the shape `| [Name](URL) | Description | Language |`, placed alphabetically in its table. I know this is more than one row; the contributing guide says a batch is not a reason to decline. Lake Level MCP from the same author was merged in #255.

| Server | Table |
| --- | --- |
| Car Loan Interest Deduction Calculator MCP, DSCR Loan Calculator MCP, Gold Price Per Gram MCP, Minimum Wage MCP, No Tax on Overtime MCP, Paycheck Calculator MCP, Retirement Contribution Limits 2027 MCP, Section 179 Deduction Calculator MCP, UK Income Tax Salary MCP | Finance |
| AP Score Distributions MCP, Cups to Grams MCP, Recipe Nutrition Calculator MCP | Search & Knowledge |
| US Federal Holidays Business Days MCP | Productivity |
| A/B Test Sample Size Calculator MCP | Marketing & Analytics |
| Subdomain Finder MCP | Security |

## Affiliation

- [x] Yes -- I am connected to this project (I am the author)
- [ ] No -- I am not connected to this project

## Quality standards

- [x] Each repository contains a working MCP implementation (TypeScript source, tests, stdio and Cloudflare Worker entry points)
- [x] Each states the MIT licence in a `LICENSE` file at the root and in `package.json`
- [x] Each README documents installation, configuration, and basic usage
- [x] Each was pushed within the last 180 days (all on 2026-11-02) and none is archived

## Format

- [x] Descriptions are 80 characters or fewer, start with a capital, have no trailing period, and use no em-dash
- [x] Descriptions state what the server does
- [x] Added in alphabetical order within each table
- [x] `python scripts/validate.py` passes locally (449 entries, no duplicates)
- [x] I have starred the repository
- [x] I have not changed any unrelated entry

## Anything else

All 15 servers are free, MIT licensed, and need no API key or token. Each one also has a hosted Streamable HTTP endpoint at `https://<repo-name>.lipmichal.workers.dev/mcp` that answers an MCP `initialize` with HTTP 200. I am the author of all of them.
