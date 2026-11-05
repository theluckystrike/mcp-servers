# Lake Level MCP Server: Live US Lake Levels

This Actor serves **live US lake and reservoir water levels** to AI agents and MCP clients (Claude, ChatGPT developer mode, Cursor, VS Code, Cline and others). It reads USGS, USACE, CDEC, Bureau of Reclamation and TWDB gauges at call time for **44 lakes in 12 states**, including Lake Mead, Lake Powell, Lake Travis, Shasta, Oroville, Folsom, Lake Lanier, Lake Texoma and Kentucky Lake. It needs no API key.

**How you use it:** run it in Standby mode and connect your MCP client to `https://YOUR_USERNAME--lake-level-mcp.apify.actor/mcp` with your Apify API token. Each successful tool call costs **$0.01**. Listing the tools is free.

## What this MCP server knows that your model does not

- **Today's water level.** Lakes move every hour and a model's training data is months old.
- **The right gauge for each lake.** The USGS site and parameter, CDEC station, Reclamation RISE item, TWDB reservoir or USACE time series for each lake is already bound and verified.
- **Full-pool elevations and seasonal guide curves** (USACE, TVA, Alabama Power), so '8 feet low' can be read against the winter target and not only against summer full pool.
- **Feed quirks handled**: unpadded CDEC dates, CWMS loggers that stamp local time as UTC, USGS 15-minute data collapsed to one reading per day.

## Tools

| Tool | What it returns |
|---|---|
| `search_lakes` | Covered lakes by name, river, operator or state, with slug, full pool and gauge. |
| `get_lake_level` | Current elevation, measurement time, change over 24 hours, 7 days and 30 days, feet below full pool, the operator seasonal target where published, percent full where the agency publishes storage, gauge id and data URL. |
| `get_lake_history` | Daily or weekly elevation series for up to 365 days, with first, last, low, high and mean. |
| `compare_lakes` | 2 to 10 lakes side by side, ranked by feet below full pool. A lake whose gauge is down is reported, not fatal. |

Every result has structured JSON, a plain-English summary, `as_of` and `source`, so an agent can quote it and cite it.

## Pricing

Pay per event: **$0.01 per successful tool call** (event `tool-call`). `initialize`, `tools/list` and failed calls are not charged. In Standby mode Apify also bills the small platform usage of the running container on top of the event price. You can set a maximum charge per run in the Apify Console, and the Actor stops answering tool calls when that limit is reached. A normal (non-Standby) run only performs a free self-check.

## How to connect

1. Create a free Apify account and copy your API token from **Settings > API & Integrations** in the Apify Console.
2. The MCP endpoint is `https://YOUR_USERNAME--lake-level-mcp.apify.actor/mcp` (streamable HTTP). Replace `YOUR_USERNAME` with the Apify username that owns this Actor.
3. Send the token as a Bearer header: `Authorization: Bearer YOUR_APIFY_TOKEN`.

### Claude Code

```bash
claude mcp add --transport http lake-level https://YOUR_USERNAME--lake-level-mcp.apify.actor/mcp --header "Authorization: Bearer $APIFY_TOKEN"
```

### Cursor, VS Code, Cline and other clients with remote MCP support

```json
{
  "mcpServers": {
    "lake-level": {
      "url": "https://YOUR_USERNAME--lake-level-mcp.apify.actor/mcp",
      "headers": { "Authorization": "Bearer YOUR_APIFY_TOKEN" }
    }
  }
}
```

### Claude Desktop (through the mcp-remote bridge)

```json
{
  "mcpServers": {
    "lake-level": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://YOUR_USERNAME--lake-level-mcp.apify.actor/mcp", "--header", "Authorization: Bearer YOUR_APIFY_TOKEN"]
    }
  }
}
```

### Apify MCP server and the Apify API

You can also reach this Actor through the Apify MCP server (`https://mcp.apify.com`) or call the Standby URL from any HTTP client that speaks MCP.

## Example prompts

- "What is the Lake Mead water level today and how far below full pool is it?"
- "Compare Lake Powell, Lake Mead and Lake Travis. Which is lowest relative to full pool?"
- "Show the Shasta Lake elevation for the last 90 days, weekly."

## Data and method

USGS Water Services, USACE CWMS, California CDEC, Bureau of Reclamation RISE and Texas Water Development Board, read live. Every result carries `as_of`, the agency `source` URL and a link to the matching lake page on lakelevelnow.com.

## Limits

Gauge data is provisional and comes from third-party agencies. It can be delayed or missing when a gauge is down. Do not use it for flood warnings or safety decisions: use the official agency pages.

## FAQ

**How fresh is the data?**  
Read at call time. The result states the measurement time reported by the agency, which can be hours behind.

**Which lakes are covered?**  
44 major US lakes in 12 states. Use search_lakes to list them.

**What if a gauge is offline?**  
The tool reports it for that lake. compare_lakes keeps going for the others.

**How is the Actor run?**  
The Actor starts the open-source MCP server bundled in this image (MIT licence) and exposes it over streamable HTTP in Apify Standby mode. It is built from the `apify/actor-templates` MCP proxy template. Source: https://github.com/theluckystrike/lake-level-mcp

**What is MCP?**  
The Model Context Protocol is an open standard that lets AI assistants call tools. See https://modelcontextprotocol.io

## Related searches

lake level API, lake water levels today, Lake Mead water level, Lake Powell elevation, reservoir levels, USGS water data, feet below full pool, MCP server
