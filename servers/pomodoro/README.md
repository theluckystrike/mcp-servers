# MCP Pomodoro — focus blocks planned in the chat you are already in

Turn "I have 3 hours before the demo" into a real pomodoro plan without opening a timer app. This MCP server gives Claude (or any MCP client) a `pomodoro_plan` tool that splits your available minutes into 25-minute focus blocks with 5-minute short breaks and a 15-minute long break every 4th block — the classic Pomodoro cadence, computed for your actual schedule instead of an app's default day.

## Why a pomodoro server

Every pomodoro app asks you to plan around it: start a timer, reset it, keep the app open. If your work already happens inside an AI chat, the plan belongs there too. Ask for a plan in one sentence and paste it into your calendar, your notes, or just follow it on screen. No account, no telemetry, no network calls — the entire computation runs on your machine.

## What it does

- `pomodoro_plan` — given total minutes available (and optionally a block count), returns the session structure: how many 25-minute focus blocks, where the 5-minute breaks fall, when the 15-minute long break lands, and what is left over. Half-blocks are handled honestly: 40 minutes does not silently become a fake "50-minute pomodoro".
- Works for short sessions too. A 50-minute window comes back as one focus block and one break, not an error.

## Install

```json
{
  "mcpServers": {
    "mcp-pomodoro": {
      "command": "npx",
      "args": ["-y", "github:theluckystrike/mcp-pomodoro"]
    }
  }
}
```

Or with the Claude Desktop / VS Code / Cursor config block above — one entry, one stdio server, no API keys.

## Try it

- "I have 3 hours free this afternoon — plan it as pomodoros."
- "Plan my next 2 hours with breaks, I keep burning out without them."
- "How many focus blocks fit before my 4pm meeting?"

## Part of the luckystrike MCP suite

Free, part of the [luckystrike MCP suite](https://github.com/theluckystrike) — productivity & finance servers that turn AI chat into working documents and calculations. Listing in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=theluckystrike%2Fpomodoro).

## Docs (GitMCP)

Live docs endpoint: https://gitmcp.io/theluckystrike/mcp-pomodoro
