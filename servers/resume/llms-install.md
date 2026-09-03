# Installing mcp-resume (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Resume and cover letter** (@theluckystrike/mcp-resume)
What it does: Store CV facts once, then write a tailored resume .docx and a cover letter that states nothing the profile does not contain. All data stays on the local machine.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/resume
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-resume` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native build tools. The package is pure JavaScript.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-resume
```

The server speaks MCP over stdio. It prints one readiness line to stderr and nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "resume": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-resume"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add resume -- npx -y @theluckystrike/mcp-resume
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "resume": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-resume"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves the transport works. `tools/list` must show ten tools: `profile_set`, `profile_get`, `resume_create`, `cover_letter_create`, `tailor_to_job`, `resume_read`, `resume_to_markdown`, `resume_to_html`, `license_status`, `license_activate`.

## Step 4 - first use

Call `profile_set` once with the user's real CV facts, or `resume_read {path, save: true}` against an existing resume .docx. Every other tool reads from that profile and refuses to state anything that is not in it.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README (all resume styles, unlimited cover letters, unlimited tailoring, profile variants, letterhead colour). Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/resume

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `resume.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/docx -w servers/resume
```

`servers/docx` is in that list on purpose: this server imports the document engine from `@theluckystrike/mcp-docx/lib` instead of carrying its own copy, and npm resolves that to the workspace.

Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/resume/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/resume/Dockerfile -t mcp-resume .
```

The build context is the repository root, and the image copies `servers/docx` as well as `servers/resume`. Run with `docker run -i --rm -v mcp-resume-data:/root/.local/share/mcp-servers mcp-resume`.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- `Cannot find package '@theluckystrike/mcp-docx'` after a source build - run `npm install` at the repository root, not inside `servers/resume`.
- Data location: `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/resume/`. Deleting that directory resets the server.

Built by theluckystrike (https://github.com/theluckystrike).
