# S1105 satellites

One row per satellite. Built, tested and packed, not published. npm login is expired, so nothing was pushed to npm, GitHub or the MCP registry.

Selection method (2026-11-05). `~/mcp-servers/data/s1105/suggest.txt` has 0 lines containing uv index, shortage or census (`/usr/bin/grep -c -i -E "uv index|shortage|census" suggest.txt` prints 0); its seeds are "can claude/chatgpt/cursor" and "mcp server for" phrases only. Demand therefore comes from my own Google autocomplete probe, 60 requests 0.5 s apart (`sat-evidence-1105/probe.py`, raw output `sat-evidence-1105/probe-1105.json`). Candidates with strong demand were dropped for competition of 3 or more: tides (gh 4, registry noaa-tides, tides-mcp, findmytide and more), vehicle recalls and NHTSA (registry 4 NHTSA, plus io.github.theluckystrike/vehicle-recalls already exists), Kp index and space weather (registry 5), treasury yields (registry 3 or more), FEMA (registry 6), sunrise sunset (registry 4), air quality, earthquakes, drought, NPI. Raw competition JSON is in `sat-evidence-1105/competition/`. Competitor count = GitHub repos plus distinct registry names that are dedicated to the same question.

| name | question | demand evidence | competitors (command) | data source | test result | stdio transcript | publish commands |
|---|---|---|---|---|---|---|---|
| uv-index-today-mcp | What is the UV index today at my ZIP code or city, when does it peak, and do I need sun protection | Google autocomplete "uv index today" returns 10 completions (near me, hourly, nyc, chicago, in my location, san diego, louisville ky, orlando, okc) | 0 US. `gh search repos "uv index mcp" --json stargazersCount,name -L 30` = 1 (safemap-uv-index-mcp, Korean government data, not US). Registry `curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=uv-index&limit=100"` = 0; same for uvindex, uv_index, ultraviolet | https://data.epa.gov/dmapservice/getEnvirofactsUVDAILY/ZIP/{zip}/JSON and getEnvirofactsUVHOURLY (EPA Envirofacts, keyless); scale https://www.epa.gov/sunsafety/uv-index-scale-0 | `npm test` 14/14 pass (13 fixture tests, 1 stdio test). `mcp-publisher validate` valid. Tarball installed in an empty dir answers initialize and tools/list | ~/mcp-servers/satellites/uv-index-today-mcp/.live/stdio-transcript.jsonl (summary .live/stdio-summary.txt), live calls 3/3 ok: Miami 33101 UV 5, hourly peak 6 at 1 PM | see block A below |
| drug-shortage-list-mcp | Is this drug (generic, brand or NDC) on the FDA shortage list right now, and what is its status, availability and reason | Google autocomplete "drug shortage list" returns 10 completions (fda, 2026, usa, ashp, 2025); "drug recall" and "fda recall" also return 10 each | 2. `gh search repos "drug shortage mcp" --json stargazersCount,name -L 30` = 0 ("drug shortages mcp" 0, "fda shortage mcp" 0). Registry `search=drug-shortage` = 2 (io.github.donniertf-hub/us-drug-shortages-mcp, io.github.mrfentmen/drug-shortages-mcp). Caveat: registry `search=openfda` lists 8 general openFDA servers that may also expose this endpoint | https://api.fda.gov/drug/shortages.json (openFDA, FDA Drug Shortages database, keyless, 1,000 requests per day per IP) | `npm test` 16/16 pass (15 fixture tests, 1 stdio test). `mcp-publisher validate` valid. Tarball install answers initialize and tools/list | ~/mcp-servers/satellites/drug-shortage-list-mcp/.live/stdio-transcript.jsonl (summary .live/stdio-summary.txt), live calls 4/4 ok: Adderall 73 Current listings; 1,113 Current listings across 68 products | see block B below |
| address-to-census-tract-mcp | Which census tract (and block group, county FIPS, congressional and state legislative district) is this US address or point in | Google autocomplete "census geocoder" returns 10 completions (api, tool, address lookup, python, api limit); "address to census tract" returns 5 (converter, address census tract lookup, how to find census tract for an address) | 2. `gh search repos "census tract mcp" --json stargazersCount,name -L 30` = 0, "census geocoder mcp" = 0. Registry `search=census-geocoder` = 1 (io.github.pipeworx-io/census-geocoder), `search=census-tract` = 1 (com.errandkit/census-tract-demographics). Caveat: `gh search repos "census mcp"` = 16 general Census data repos (ACS tables, not address to tract) | https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress and /coordinates (US Census Bureau Geocoder, keyless); FIPS from https://www2.census.gov/geo/docs/reference/state.txt | `npm test` 15/15 pass (14 fixture tests, 1 stdio test). `mcp-publisher validate` valid. Tarball install answers initialize and tools/list | ~/mcp-servers/satellites/address-to-census-tract-mcp/.live/stdio-transcript.jsonl (summary .live/stdio-summary.txt), live calls 3/3 ok: SF City Hall tract 124.05 (06075012405) | see block C below |

Notes common to all three
- Structure copied from river-level-mcp (newest live-data satellite): src/core.ts pure core with injected fetch, src/tools.ts registry, src/stdio.ts, src/worker.ts, src/fetch-node.ts, unscoped package name equal to the repo name, MIT LICENSE, glama.json, wrangler.toml, DATA_SOURCES.md, fixture tests under test/.
- `more` links point to https://www.mcpstamp.com/servers/ with utm_source=mcp and utm_medium=<repo>.
- server.json lists the npm package (stdio) and no remote, because no Worker was deployed. The Worker entry is built and type-checked. If it is deployed later, add a `remotes` block and bump the version, since (name, version) is immutable in the registry.
- The README install lines use `npx -y <name>`, so they only work after npm publish.
- .live/ is in .gitignore, as in the existing satellites, so transcripts stay local.

Publish commands. Run them in this order, one satellite at a time. The npm package must exist before the registry publish, because the registry checks `mcpName` in package.json. Open each https://www.npmjs.com/auth/cli/<id> URL that appears in the TTY log within about 5 minutes.

Block A, uv-index-today-mcp
```
cd ~/mcp-servers/satellites/uv-index-today-mcp
git init -b main && git add -A && git commit -m "Initial release 1.0.0"
gh repo create theluckystrike/uv-index-today-mcp --public --source . --push --description "MCP server for today's UV index by US ZIP code or city, hourly peak and UV alert, from EPA and NWS"
gh repo edit theluckystrike/uv-index-today-mcp --add-topic mcp,mcp-server,model-context-protocol,claude,ai-tools,uv-index,uv-index-today,uv-forecast,sun-safety,epa,weather
npm_config_cache=/Users/mike/.npm-cache-local npm_config_browser=false script -a -q ~/mcp-servers/data/s1105/reports/npm-tty.log npm publish --access public
mcp-publisher login github --token "$(gh auth token)" && mcp-publisher publish
curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=uv-index-today-mcp" | jq '.servers[].server.name'
```

Block B, drug-shortage-list-mcp
```
cd ~/mcp-servers/satellites/drug-shortage-list-mcp
git init -b main && git add -A && git commit -m "Initial release 1.0.0"
gh repo create theluckystrike/drug-shortage-list-mcp --public --source . --push --description "MCP server for the FDA drug shortage list: is a drug in shortage now, by name or NDC, from openFDA"
gh repo edit theluckystrike/drug-shortage-list-mcp --add-topic mcp,mcp-server,model-context-protocol,claude,ai-tools,drug-shortage,drug-shortages,fda,openfda,pharmacy,ndc
npm_config_cache=/Users/mike/.npm-cache-local npm_config_browser=false script -a -q ~/mcp-servers/data/s1105/reports/npm-tty.log npm publish --access public
mcp-publisher login github --token "$(gh auth token)" && mcp-publisher publish
curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=drug-shortage-list-mcp" | jq '.servers[].server.name'
```

Block C, address-to-census-tract-mcp
```
cd ~/mcp-servers/satellites/address-to-census-tract-mcp
git init -b main && git add -A && git commit -m "Initial release 1.0.0"
gh repo create theluckystrike/address-to-census-tract-mcp --public --source . --push --description "MCP server: US address to census tract, block group, county FIPS and districts via the Census Geocoder"
gh repo edit theluckystrike/address-to-census-tract-mcp --add-topic mcp,mcp-server,model-context-protocol,claude,ai-tools,census-tract,census-geocoder,address-to-census-tract,fips,geoid,geocoding
npm_config_cache=/Users/mike/.npm-cache-local npm_config_browser=false script -a -q ~/mcp-servers/data/s1105/reports/npm-tty.log npm publish --access public
mcp-publisher login github --token "$(gh auth token)" && mcp-publisher publish
curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=address-to-census-tract-mcp" | jq '.servers[].server.name'
```
