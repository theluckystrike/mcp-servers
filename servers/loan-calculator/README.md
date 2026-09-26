# mcp-loan-calculator

loan-calculator MCP server — give Claude (or any MCP client) real loan-calculator tools.

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

## Tools

See src/index.js — each tool is self-documenting via the MCP protocol.

Part of the [luckystrike MCP suite](https://github.com/theluckystrike) — finance & productivity servers that turn AI chat into working documents and calculations.

## Docs (GitMCP)

Live docs endpoint: https://gitmcp.io/theluckystrike/mcp-loan-calculator
