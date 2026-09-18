# Draft 03 — Reddit r/ClaudeAI: servers not showing in `claude mcp list` or `/mcp`

**Surface:** Reddit r/ClaudeAI — `HUMAN-GATED` (Reddit requires an account to post)
**Thread URL:** https://www.reddit.com/r/ClaudeAI/comments/1n35e7p/mcp_servers_not_showing_in_claude_mcp_list_or_mcp/
**Thread title:** *MCP servers not showing in claude mcp list or /mcp after fresh project setup*
**Fit:** The poster configured servers and sees "No MCP servers configured." This is a scope/key-name
problem, not a server problem, and the fix is a two-line diagnostic.

**Exact guide link to include:** https://mcp.zovo.one/guides/mcp-server-not-showing-up-in-claude-desktop

---

## Draft answer (paste as-is)

"No MCP servers configured" after a project move is almost always scope, not the servers themselves.
Three things to check, in order:

**1. Which scope did you add them to.** Claude Code has three: local (private to you, stored per-project
in `~/.claude.json`), project (shared via a `.mcp.json` in the repo root), and user. If you added with
the default local scope, then `cd`'d into a different directory, your list is empty *by design*. Run
`claude mcp list` from the directory you originally configured, then re-add with
`claude mcp add --scope user <name> ...` to make it follow you everywhere.

**2. Duplicate entries across scopes.** If `claude mcp remove <name>` says the server "exists in multiple
scopes," you have the same name in both `~/.claude.json` and `.mcp.json`. Name collision across scopes
is a common cause of a server appearing not to load — remove the stale one, not both.

**3. The key name, if you hand-edited JSON.** Claude Desktop reads `mcpServers`; VS Code reads
`servers`; `.mcp.json` uses `mcpServers`. A block copied from the wrong client's README parses as valid
JSON and contributes nothing, silently.

Quick way to know whether it's the client or the server: run the server binary directly in a terminal.
It speaks JSON-RPC over stdio — if it prints a banner and waits, the server is fine and the problem is
entirely in config/scope. If it exits, you have the error text.

I wrote the full ordered checklist for this (six checks, plus the working config shape) here:
https://mcp.zovo.one/guides/mcp-server-not-showing-up-in-claude-desktop — free, no signup.
Full disclosure: I build and maintain the MCP servers behind that site.

---

## Notes for the operator
- r/ClaudeAI tolerates self-links only in genuinely helpful comments; the answer must lead and the link trail.
- Keep the disclosure line; removing it is what turns this into spam.
