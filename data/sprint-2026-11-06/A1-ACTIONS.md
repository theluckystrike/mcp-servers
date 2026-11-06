# A1-ACTIONS.md — top 10 registry actions (sprint 2026-11-06)

Estate: 58 servers / 58 npm pkgs / 525 tools · https://mcp.zovo.one · repo `theluckystrike/mcp-servers`

## Executed this sprint (automated, no credentials needed beyond gh)
1. **mcp.so** — intake issue filed: https://github.com/chatmcp/mcpso/issues/6845 (batch submission of all 58 servers). Listing appears only after maintainer merge.

## Top 10 highest-value actions, in order
1. **Official MCP registry (registry.modelcontextprotocol.io)** — publish the 58 monorepo servers via `mcp-publisher login github` + `mcp-publisher publish`. This is the keystone: Cursor directory and the GitHub/VS Code MCP gallery auto-feed from it. Needs an interactive login once.
2. **Smithery** — create account at smithery.ai, then `npx @smithery/cli publish` per server (config: `https://mcp.zovo.one/mcp/<name>`). Direct API probe confirms we are absent today (404).
3. **mcpservers.org** — human: log in with GitHub at mcpservers.org → "Submit a server"; fields: name, server URL, repo URL, description, hosting (remote). ~2 min/server, submit the top 10 first.
4. **PulseMCP** — human: pulsemcp.com submit form (Cloudflare blocks bots). Fields: server name, URL, description, category, hosting type remote.
5. **Glama** — legacy repos auto-indexed (30+ listings, 1 verified live: glama.ai/mcp/servers/theluckystrike/gold-price-per-gram-mcp), but the monorepo `theluckystrike/mcp-servers` returns 404. Contact Glama or request repo scan to get all 58 indexed in one shot.
6. **Cline marketplace** — PR a JSON entry per server to `cline/cline` docs `mcp_marketplace.json` (name, url, logo). Can be done by agent next sprint.
7. **mcp-get** — PR to `mcp-get/website` `packages.json` with the 58 npm packages. Low effort, npm-only, no hosting needed.
8. **LobeHub MCP** — PR to `lobehub/lobe-chat` marketplace JSON with remote endpoints.
9. **Docker MCP catalog** — PR to `docker/mcp-registry` (yaml + Dockerfile per server); heavier, do after 1–3.
10. **mcpmarket.com / Klavis / mcphub.io** — web-form only, bot-blocked (402/403/404). Human browser session, lowest priority.

## Credentials needed but lacking
- Smithery account + CLI token
- mcp-publisher (official registry) GitHub OIDC login (interactive)
- Glama API key (read API only; listing is auto)
- GitHub/VS Code gallery & Cursor: no key, gated on official-registry publish

## Verified-live inventory (bar: HTTP 200 + body contains 'zovo'/our name)
- npm: 58/58 packages (registry.npmjs.org 200)
- Official registry: 10 legacy repo entries (search 200)
- Glama: 30+ legacy listings; sample URL verified 200 with mcp.zovo.one links in body
- Own estate: mcp.zovo.one + /s/<name> + /mcp/<name> (live, previously verified)
- NOT listed anywhere checked: Smithery, mcp.so, PulseMCP, mcpservers.org, GH/VS Code gallery, Cursor, LobeHub, Fleur, mcpmarket, MCPHub
