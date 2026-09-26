# mcp-tax-calc

tax-calc MCP server — give Claude (or any MCP client) real tax-calc tools.

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

## Tools

See src/index.js — each tool is self-documenting via the MCP protocol.

Part of the [luckystrike MCP suite](https://github.com/theluckystrike) — finance & productivity servers that turn AI chat into working documents and calculations.

## Docs (GitMCP)

Live docs endpoint: https://gitmcp.io/theluckystrike/mcp-tax-calc
