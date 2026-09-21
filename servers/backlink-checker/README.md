# mcp-backlink-checker

**In the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.theluckystrike%2Fbacklink-checker/versions/latest)** (`io.github.theluckystrike/backlink-checker`).
Backlink checking for solopreneurs and small studios: does a page link to
your domain, dofollow or nofollow, with anchor text, HTTP status and robots
guards, read directly from your MCP client — Claude Desktop, Cursor, or any
MCP host. All checks run on demand, nothing stored.

## Tools

- `"link_check"` — check one page: does it link to your domain, dofollow or nofollow, with anchor text and HTTP status.
- `"link_audit"` (Pro) — audit a batch of pages in one call, one verdict row per page.
- `"robots_guard_check"` — read a page's robots rules before you touch it, so audits stay polite.

## The one rule that decides everything else

Nothing is stored. Every call fetches the page live, parses the anchor,
applies the robots guards, and reports — so a verdict is always about the
page as it is now, never as it was.

## Free vs Pro

The free tier is full single-page checking: `link_check` and
`robots_guard_check`, watermark-free, no per-day limits. Pro (an
`MCP_LICENSE_KEY`, activate with `license_activate`) adds batch
`link_audit`. Run `license_status` to see the current tier.

## Quick start

```json
{
  "mcpServers": {
    "backlink-checker": { "command": "npx", "args": ["-y", "@theluckystrike/mcp-backlink-checker"] }
  }
}
```

## Buy

Single-server Pro is $19, or get all 46 servers with one lifetime key for
$39 — see [mcp.zovo.one/buy/backlink-checker](https://mcp.zovo.one/buy/backlink-checker).
