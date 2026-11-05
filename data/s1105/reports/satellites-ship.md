# S1105 satellites ship log

Shipped the way vegetable-yield-percentage-mcp shipped: public GitHub repo, Cloudflare Worker remote (workers.dev), official MCP registry entry with `remotes` only. npm is not used (E401); `curl -s -o /dev/null -w "%{http_code}" https://registry.npmjs.org/<name>` = 404 for all three on 2026-11-05.

Pre-checks before each deploy: `df -g /System/Volumes/Data` Avail 32 GB, `memory_pressure | tail -1` 49% free. `npm test`: uv 14/14, drug 16/16, census 15/15.

| satellite | Worker URL | deploy command | version ID | rollback (brand-new Worker) | remote evidence |
|---|---|---|---|---|---|
| uv-index-today-mcp | https://uv-index-today-mcp.lipmichal.workers.dev/mcp | `timeout 300 npx wrangler deploy` (wrangler 4.80.0) | 407977ca-8aab-4b8c-921d-4c9e803af557 | `npx wrangler delete --name uv-index-today-mcp` | sat-evidence-1105/uv-index-today-mcp-remote.json: initialize 200, 3 tools, get_uv_index_today {"zip":"33101"} = Miami UV 5, hourly peak 6 at 1 PM |
| drug-shortage-list-mcp | https://drug-shortage-list-mcp.lipmichal.workers.dev/mcp | `timeout 300 npx wrangler deploy` (wrangler 4.80.0) | 7d916a0d-842a-459c-99ae-59869845b97e | `npx wrangler delete --name drug-shortage-list-mcp` | sat-evidence-1105/drug-shortage-list-mcp-remote.json: initialize 200, 4 tools, search_drug_shortages {"drug":"Adderall"} = 73 Current listings (openFDA) |
| address-to-census-tract-mcp | https://address-to-census-tract-mcp.lipmichal.workers.dev/mcp | `timeout 300 npx wrangler deploy` (wrangler 4.80.0) | 23c31595-412a-4409-bbed-a8608984b9b4 | `npx wrangler delete --name address-to-census-tract-mcp` | sat-evidence-1105/address-to-census-tract-mcp-remote.json: initialize 200, 3 tools, get_census_tract_for_address SF City Hall = tract 124.05 (GEOID 06075012405), block group 3, CD 11 |

Changes per satellite before push: server.json now has `remotes` (streamable-http Worker URL) and `repository`; the `packages` npm entry (unpublished package) and `websiteUrl` were removed, because `curl -s -o /dev/null -w "%{http_code}" https://www.mcpstamp.com/servers/<name>/` = 404 and the /servers/ index does not mention them. README Install now starts with the hosted URL; `npx -y <name>` is kept only under "Local stdio (after npm release)". Versions stay 1.0.0.

| satellite | repo (public, 1 push, commit "Initial release 1.0.0" by theluckystrike, Warsaw time) | registry (`mcp-publisher publish`, verified with `curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=<name>"`) |
|---|---|---|
| uv-index-today-mcp | https://github.com/theluckystrike/uv-index-today-mcp, 11 topics | io.github.theluckystrike/uv-index-today-mcp 1.0.0 active, remotes only, packages null, published 2026-11-05T12:38:27Z |
| drug-shortage-list-mcp | https://github.com/theluckystrike/drug-shortage-list-mcp, 11 topics | io.github.theluckystrike/drug-shortage-list-mcp 1.0.0 active, remotes only, packages null |
| address-to-census-tract-mcp | https://github.com/theluckystrike/address-to-census-tract-mcp, 11 topics | io.github.theluckystrike/address-to-census-tract-mcp 1.0.0 active, remotes only, packages null |

Registry token in ~/.config/mcp-publisher/token.json had expired (exp 1793695289 < now 1793882299, publish returned 401). Renewed non-interactively with `mcp-publisher login github --token "$(gh auth token)" </dev/null` (exit 0).
