# Draft 07 — dev.to: comments on a "Connect Claude Desktop to Local MCP Servers" tutorial

dev.to — `OPEN` with a dev.to account; comments are a normal, welcome part of that platform.
needs a live pick at post time — search dev.to for recent `mcp claude desktop`
tutorials and choose one with an active comment thread and no Windows section.
*Connect Claude Desktop to Local MCP Servers* / *Getting started with MCP*
Most such tutorials are written on macOS and hand-wave Windows. The Windows/PATH section below
is the single most-requested comment on nearly every one of them, so it's a genuinely useful addition
rather than a drive-by link.

https://mcp.zovo.one/guides/mcp-on-windows-paths-and-npx

---

## Draft answer (paste as-is)

Great walkthrough — one thing worth adding for the Windows readers, because this is where the config
came from and it bites nearly everyone:

`%APPDATA%\Claude\claude_desktop_config.json` — paste that into Explorer's address bar, because
`%APPDATA%` is hidden by default. Create the `Claude` folder if it isn't there yet; the app doesn't
always create it before your first edit.

Windows paths in JSON must be either
`"C:\\Users\\you\\invoices"` (doubled) or `"C:/Users/you/invoices"` (forward slashes, which Windows
accepts). A single `\U` is read as a unicode escape and the file fails to parse — which, because one bad
byte kills the whole document, makes *all* your servers vanish at once rather than the one you edited.

A stdio server launched by Claude Desktop gets a
limited environment, not your terminal's. If Node or Python came from a version manager, the bare
`npx`/`uvx` in the config won't resolve — the server exits instantly and the app shows nothing useful.
Run `where npx`, then either paste the absolute path or point `command` at the resolved executable with
the script as the first arg.

for npm-distributed servers — it sidesteps the fact that
`npx` on Windows is a shell script rather than an executable, which is a distinct failure from the PATH
one above and produces the same "nothing happened" symptom.

Restart the app fully after editing — closing the window isn't enough, since the config is read at
startup. And if it still refuses: `%APPDATA%\Claude\logs\` holds one `mcp-server-<name>.log` per
configured server, and a crashed server writes its actual error there.

I wrote the full Windows-specific version of all this (paths, quoting, PATH, logs, working config):
https://mcp.zovo.one/guides/mcp-on-windows-paths-and-npx — free, no signup. Disclosure: I maintain the
local MCP servers behind that site, but the Windows gotchas above are the same for any server.

---

## Notes for the operator
- Pick the target thread at post time via search; the draft is deliberately written to attach to *any*
  recent Claude-Desktop MCP tutorial that lacks a Windows section.
- If the chosen tutorial already covers the `cmd /c` form, drop that paragraph and keep the rest.
