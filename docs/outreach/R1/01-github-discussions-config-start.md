# Draft 01 — GitHub Discussions: config parses, server still fails to start

**Surface:** GitHub Discussions (modelcontextprotocol org) — `OPEN` with a GitHub account
**Thread URL:** https://github.com/orgs/modelcontextprotocol/discussions/325
**Thread title:** *I configured claude_desktop_config.json to configure mcp for claude, but every time I restart claude, I will be prompted that the service failed to start*
**Fit:** The thread's exact symptom is "config is valid, server won't start." The guide below is a
six-check ordered list for precisely that, and the log-file location is the answer nobody in the
thread has given.

**Exact guide link to include:** https://mcp.zovo.one/guides/mcp-server-not-showing-up-in-claude-desktop

---

## Draft answer (paste as-is)

"Service failed to start" with a config file you believe is valid almost always comes down to one of
four things, and none of them print an error you'd actually see. Work down in this order:

1. **Top-level key.** Claude Desktop reads `mcpServers`. VS Code reads `servers`. If the block came
   from a VS Code README it parses as valid JSON and contributes exactly nothing — no error, no server.
2. **Absolute paths everywhere.** Every path in `claude_desktop_config.json` must be absolute. A
   relative path resolves against a working directory you did not pick, so it can work from a terminal
   test and fail inside the app.
3. **Where `npx` lives.** A stdio server spawned by Claude Desktop inherits a limited environment, not
   your shell profile. If node came from nvm/asdf/Homebrew, the bare word `npx` is not on the inherited
   PATH. Run `which npx` (or `where npx` on Windows) and paste the absolute path into `command`:
   `"command": "/Users/you/.nvm/versions/node/v22.14.0/bin/node"` with the script in `args`.
4. **Full quit, not window close.** Closing the window leaves the app running and it never re-reads the
   config. Quit it completely and relaunch.

If it still fails, the log file tells you why directly: macOS `~/Library/Logs/Claude/` with one
`mcp-server-<name>.log` per configured server, Windows `%APPDATA%\Claude\logs\`. A server that dies at
startup writes its stderr there — usually a missing binary or a stack trace from the server, which
distinguishes "config problem" from "crashed server" in one look.

One more worth checking: a trailing comma anywhere in the file. JSON has no tolerance for it, and an
unparseable config makes *every* server disappear at once rather than just the one you edited — which
matches the "everything worked, now nothing does" shape of this report.

I maintain a set of local MCP servers and wrote up the full ordered checklist, including the working
config shape, here: https://mcp.zovo.one/guides/mcp-server-not-showing-up-in-claude-desktop
(free, no signup; the servers run locally and make no network calls). Disclosure: they're mine.

---

## Notes for the operator
- Do not post if the thread has been answered with the log-file step already.
- Answer stands alone without the link. Link is last, single, specific.
