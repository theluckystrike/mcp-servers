# mcp-stripe-billing

stripe-billing MCP server — give Claude (or any MCP client) real stripe-billing tools.

## Install

```json
{
  "mcpServers": {
    "mcp-stripe-billing": {
      "command": "npx",
      "args": ["-y", "github:theluckystrike/mcp-stripe-billing"]
    }
  }
}
```

## Tools

See src/index.js — each tool is self-documenting via the MCP protocol.

Part of the [luckystrike MCP suite](https://github.com/theluckystrike) — finance & productivity servers that turn AI chat into working documents and calculations.

## Docs (GitMCP)

Live docs endpoint: https://gitmcp.io/theluckystrike/mcp-stripe-billing
