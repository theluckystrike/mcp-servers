# MCP Budget — monthly budgets you set and check inside the conversation

Give Claude (or any MCP client) a real envelope budget: `budget_set` to declare a category and its monthly cap, `budget_spend` to record spending against it, `budget_report` to see every category with how much is left. All of it in chat, all of it on your machine, no finance app login and no bank connection.

## Why a budget server

Budget apps want your bank credentials, a subscription, and the discipline to open them. This one asks for none of that. It keeps a simple in-memory ledger for the session: you say "groceries 400" and "spend 62 on groceries", and the report tells you what remains. It is the fastest possible loop between "can I afford this?" and an answer.

## What it does

- `budget_set` — set a monthly cap for a category (groceries, transport, eating out — any name you use).
- `budget_spend` — record an amount against a category; the server rejects nothing and judges nothing, it just does the arithmetic.
- `budget_report` — one table: category, cap, spent, remaining. Over-budget categories are visible at a glance.

## Install

```json
{
  "mcpServers": {
    "mcp-budget": {
      "command": "npx",
      "args": ["-y", "github:theluckystrike/mcp-budget"]
    }
  }
}
```

## Try it

- "Set a 400 monthly grocery budget and log 62 spent today."
- "I spent 30 on transport and 18 on coffee — show my budget report."
- "Which categories am I over on?"

## Part of the luckystrike MCP suite

Free, part of the [luckystrike MCP suite](https://github.com/theluckystrike) — productivity & finance servers that turn AI chat into working documents and calculations. Listing in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=theluckystrike%2Fbudget).

## Docs (GitMCP)

Live docs endpoint: https://gitmcp.io/theluckystrike/mcp-budget
