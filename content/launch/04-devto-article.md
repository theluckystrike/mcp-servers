# dev.to article

## Title

How to add a remote MCP server to Claude and Cursor (no install) — with a real config, from someone who built 58 of them

## Intro

I've built 58 MCP servers for document and office workflows — invoices, quotes, spreadsheets, PDFs, ZIPs, images, time tracking, amortisation, bank statements, currency conversion. 45 of them run as hosted remote endpoints, which means you can wire them into Claude or Cursor without installing anything. In this article I'll show you exactly how to do that, step by step, with real config JSON you can paste today. Then I'll share the numbers behind the project — including the ones that sting.

## What a remote MCP server actually is

MCP (Model Context Protocol) is a standard that lets AI assistants call external tools. When you add a tool to Claude or Cursor, the client connects to an MCP server that exposes named functions the model can invoke.

There are two transport styles:

- **Local (stdio):** the server runs on your machine, usually installed via npm. Your client launches it as a child process and talks over standard input/output.
- **Remote (HTTP):** the server runs on someone else's infrastructure and your client connects to a URL, like any web API.

For document work, remote has a practical advantage. PDF and spreadsheet tooling tends to drag in binary dependencies, system libraries, and file-handling edge cases that are genuinely unpleasant to install and debug locally. With a remote endpoint, there's nothing to install, nothing to upgrade, and nothing running on your laptop. You paste one config entry and the tools appear in your assistant.

## Step 1 — pick a server

Browse the estate at https://mcp.zovo.one. Each server has a page describing exactly which tools it exposes. 46 of the servers have a checkout — most are $19 each, and there's a $39 lifetime bundle for everything; some are free. The complete source code for all 58 is open at https://github.com/theluckystrike/mcp-servers, and 13 of the 58 are local-only, installable from npm.

## Step 2 — add it to Cursor

Open Cursor's MCP settings (Settings → MCP and click "Add new MCP server"), or edit `~/.cursor/mcp.json` directly:

```json
{
  "mcpServers": {
    "pdf-tools": {
      "url": "https://mcp.zovo.one/mcp/pdf-tools"
    }
  }
}
```

That's the whole setup. Save the file, and Cursor connects to the hosted endpoint over the network. No npm install, no local process, no PATH issues.

## Step 3 — add it to Claude

For Claude Desktop, open Settings → Developer → Edit Config to find `claude_desktop_config.json`. Remote endpoints use the same URL shape:

```json
{
  "mcpServers": {
    "pdf-tools": {
      "url": "https://mcp.zovo.one/mcp/pdf-tools"
    }
  }
}
```

Restart the client and the server's tools become available to the model — you should see them listed under available tools. From there you can just ask Claude things like "split this PDF into pages" or "build a quote spreadsheet from these line items".

If you'd rather self-host, the same servers are published on npm; the repo README shows the local stdio config for each one.

## Step 4 — verify it actually works

Here's the step most guides skip, and it's the one I got wrong first. A server can connect and answer a health check while failing every real tool call — the URL responds, initialize succeeds, and then the call you actually care about breaks.

So my verification is two layers:

1. **1,816 unit tests** pass across the repository — the logic is correct.
2. **1,254 live validation checks** pass against the actual hosted endpoints — a real tool call goes through the exact URL that the product page prints, carrying only what the page tells a reader to have.

The second layer exists because I once advertised a hosted URL that looked perfectly healthy to every automated probe but refused real usage. The lesson generalises: the shipping test for any hosted endpoint is a real tool call through the published URL with only what the docs give you. Discovery succeeding is not the product working.

When you wire in any MCP server — mine or anyone else's — ask it to do one real task immediately, rather than trusting the connection indicator.

## How the discoverability test worked

Code was the easy part, so I got curious about the hard part: can people even find these tools? I ran a blind test. I wrote 18 capability questions — phrased the way a person with a real need would ask, like "I need to amortise a loan" — and searched for them without priming anything. 9 of the 18 answers named this estate. Raw URLs appeared in most results, so the estate is visible; but half the time, people still find something else first.

That test now drives the roadmap: make the right answer exist for the questions people actually ask, instead of fighting broad, contested search terms.

## The honest numbers

Since I believe in showing the uncomfortable data: over the last 28 days, the site got 38 Google impressions, 0 clicks, and there are 0 paid customers so far. The blind test and the search measurements cost nothing to run and taught me more than any amount of guessing would. I'm building this in public, and distribution — not code — is the problem I'm actually working on.

## Try it

Pick a server at https://mcp.zovo.one, paste the URL into the config above, and give it a real document task. If something doesn't work, or a tool you need is missing, open an issue at https://github.com/theluckystrike/mcp-servers — that feedback is how the estate gets better, and it's the most useful thing you can send me.
