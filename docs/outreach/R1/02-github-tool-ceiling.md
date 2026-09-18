# Draft 02 — GitHub Issue: server exposes fewer tools than documented

**Surface:** GitHub Issues (modelcontextprotocol/servers) — `OPEN` with a GitHub account
**Thread URL:** https://github.com/modelcontextprotocol/servers/issues/541
**Thread title:** *GitHub MCP Server missing some tools from the listed features*
**Fit:** The report is "README says N tools, client only surfaces M." The real cause is usually a client
tool ceiling rather than a server bug — a genuinely useful diagnostic angle the thread lacks.

**Exact guide link to include:** https://mcp.zovo.one/guides/mcp-server-not-showing-up-in-claude-desktop

---

## Draft answer (paste as-is)

Before treating this as a server bug, rule out a client-side tool ceiling — it produces exactly the
"some tools listed in the README never appear" symptom.

Some clients cap how many tools they will surface from a single server at once. When a server registers
more tools than the cap, the later ones are silently dropped from the tool list; the server is fine, the
client just stops advertising. Two ways to tell this apart from a real regression:

- **Count what you get.** If the surfaced tools are a *prefix* of the declared tool list in a stable
  order across restarts, it's a ceiling, not a random subset.
- **Shrink the surface.** Configure the server to expose fewer tools (or install the specific
  capability set you actually need rather than a mega-bundle) and see whether the missing ones appear.
  If they do, you had a ceiling.

The identical trap shows up in bundles that expose every child server at once — it's convenient and
it's the fastest way to hit the cap. Installing two or three servers you use instead of one bundle that
exposes all of them fixes it.

The other half of this class of bug: a tool that is *defined* but whose handler throws on first call
looks, in some clients, like the tool is absent. Run the server directly from a terminal (it speaks
JSON-RPC over stdio) and call the tool by hand — if the server answers, the problem is the client's
listing; if it exits, you have the stack trace in front of you.

I ran into this building my own local MCP servers and wrote the ordered version of these checks,
including the tool-ceiling case: https://mcp.zovo.one/guides/mcp-server-not-showing-up-in-claude-desktop
(free, no signup, servers run locally). Disclosure: those servers are mine.

---

## Notes for the operator
- Post as a comment only if the issue is still open and lacks the ceiling explanation.
- If a maintainer has already identified a genuine server regression, skip — do not contradict real findings.
