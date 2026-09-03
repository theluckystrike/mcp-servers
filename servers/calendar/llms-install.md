# Installing mcp-calendar (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no OAuth and no
calendar service is required.

Server: **Calendar** (@theluckystrike/mcp-calendar)
What it does: Reads the .ics file a calendar app exports and answers what is on in a window, when the user is free,
what is double-booked, exports selected events, and converts a meeting into a time-tracker entry. All data stays on
the local machine.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/calendar
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-calendar` is not published yet. Until it is, the `npx` command below will fail
with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same
client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is
unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native build tools. The package is pure JavaScript with no calendar or date dependencies.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-calendar
```

The server speaks MCP over stdio. It prints one readiness line to stderr and nothing to stdout except protocol
traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "calendar": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-calendar"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add calendar -- npx -y @theluckystrike/mcp-calendar
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "calendar": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-calendar"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves
the transport works. `tools/list` must show the tool table from the server README.

## Step 4 - the first real call

The server is empty until a calendar is imported. Ask the user to export one:

- Google Calendar: Settings -> Import & export -> Export (a zip; the .ics is inside)
- Apple Calendar: File -> Export -> Export...
- Outlook desktop: File -> Save Calendar, iCalendar (.ics)

Then call `ics_import {path: "<absolute path to the .ics>", name: "work"}` followed by
`events_list {from: "<today>", to: "<today + 7 days>"}`. Local times come from the shared business profile's
timezone if one is set (the invoice or docx server's `business_set`), otherwise from the machine.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README (2 calendars, 31-day windows, 50 events per export, no
URL import). Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere.
Keys: https://mcp.zovo.one/buy/calendar

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `calendar.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto
the Claude Desktop Extensions pane. This installs the server without editing JSON.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build
```

Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/calendar/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/calendar/Dockerfile -t mcp-calendar .
```

The build context is the repository root. Run with
`docker run -i --rm -v mcp-calendar-data:/root/.local/share/mcp-servers mcp-calendar`.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- "No calendars imported yet" - that is the empty state, not an error; run `ics_import` first.
- "the stored copy ... is missing or unreadable" - the data dir was cleaned; re-import, or `ics_forget` the row.
- Data location: `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/calendar/`. Deleting that directory resets the server.

Built by theluckystrike (https://github.com/theluckystrike).
