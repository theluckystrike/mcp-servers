# T9 Off-Page Intel Sweep — R1

2026-09-18
complete

## 1. mcp.so ingestion recheck — NOT INGESTED (confirmed, valid evidence)
- **Method:** rendered-SPA search (curl `/server/...` returns HTTP 404 for ALL paths incl. positive controls, so it is NOT evidence; the SPA is the valid check).
- **Positive control passed:** `https://mcp.so/search?q=filesystem` rendered **many** result cards in a real browser → engine works.
- **Target search:** `https://mcp.so/search?q=theluckystrike` → **"0 results — No servers match 'theluckystrike'"** (rendered DOM, serverLinks=0).
- **Conclusion:** theluckystrike-mcp-invoice and -office-suite are **NOT ingested** in mcp.so.
- **Caveat / reconciliation:** `data/distribution.json` mcp.so surface = `submitted` (issues chatmcp/mcpso #4227+#4228 filed 2026-09-18, 7 flagships listed, disclosure included, awaiting directory ingestion). So: **filed but not yet visible** in search. Re-check ingestion in a later round; the 404 baseline recorded previously is the SPA SSR 404, not a block.

## 2. mcpmux census — one.zovo-invoice.json NOT YET APPEARED
- `GET https://api.github.com/repos/mcpmux/mcp-servers/contents/servers?per_page=1000` → HTTP 200, list of 289 files, **no `one.zovo-invoice.json`**, no zovo/luckystrike anywhere.
- **Consistent with PR #300 still being OPEN** — census file only appears post-merge.

## 3. PR #300 (mcpmux/mcp-servers) — OPEN, MERGEABLE
- `gh pr view 300 --repo mcpmux/mcp-servers`:
  - number 300, title **"Add one.zovo-invoice"**, state **OPEN**
  - head `add-zovo-invoice`, files: `servers/one.zovo-invoice.json` (+48/-0)
  - **mergeable: MERGEABLE** (validated PASS, `pnpm check-conflicts` no conflicts across 289 files)
  - DCO signed-off as required by CONTRIBUTING.md; created/updated 2026-09-18T08:16:52Z
  - body: hosted HTTP endpoint https://mcp.zovo.one/mcp/invoice (probe 200), repo luckystrike/mcp-servers, docs https://mcp.zovo.one/s/invoice
- Note: `gh pr view 300` without `--repo` failed because default origin repo is `theluckystrike/mcp-servers`, not `mcpmux`.

## 4. THREE NEW directory/aggregator candidates (none in data/distribution.json)
Verified all absent from `data/distribution.json` surfaces list. All probed live via curl/browser/web-extract on 2026-09-18.

### Candidate A — MCP Playground (mcpplaygroundonline.com)
- **What:** MCP server directory, "10,000+ free MCP servers" drawn from official MCP Registry + community submissions; includes a free MCP testing tool.
- **Submission method:** web form ("+ Submit a Server") + publishing guide (mcpplaygroundonline.com/blog/how-to-publish-your-mcp-server-to-registry). No account/signup mentioned.
- **Autonomy:** **FULLY AUTONOMOUS** (free web form, no human-gated signup surfaced).
- **Fit:** high — 10k+ listing surface for our invoice/billing/suite servers.

### Candidate B — dotMCP (dotmcp.dev / dotmcp.io)
- **What:** MCP marketplace for building & monetizing MCP servers; publisher can import OpenAPI/GraphQL/Postman, tunnel an existing server, or visual-build.
- **Submission method:** create account (dotmcp.io/register) → then automated import/tunnel flow (auto-generate server, tunnel daemon auto-sync).
- **Autonomy:** **NOT fully autonomous** — human-gated account registration required; post-registration publish flow is automated. (Matches standing rule: operator clicks account signup; tunnel/import after that can be agent-driven.)
- **Fit:** medium-high — monetizable marketplace; our hosted stdio/http invoice fits the tunnel/import path.

### Candidate C — WealthMCP (wealthmcp.ai)
- **What:** free community MCP-server directory focused on wealth-management / finance workflows; editorial curated layer (auth model, read/write, data gaps per listing). Our billing/invoice/price-tracker/spreadsheet servers fit the finance/productivity theme.
- **Submission method:** not an open self-serve form surfaced; curated/editorial intake → **human-gated** (operator submits / contacts).
- **Autonomy:** **NOT fully autonomous** (curated editorial submission).
- **Fit:** medium — finance niche aligns well; best for the money-domain servers.

### Bonus (flag, not a primary) — mcpregistry.dev
- Reddit r/mcp "largest free directory, 28,577 indexed" points at an MCP directory; **unreachable from our network** (curl HTTP 000, browser `ERR_TUNNEL_CONNECTION_FAILED`). Re-probe in a later round; do not rely on it.

## 5. Discarded probes (not candidates)
- mcpregistry.com — GoDaddy "for sale" ($24,995), not a directory.
- mcphub.dev — "retired" (dead).
- mcpbridge.dev — IDE collaboration platform, not a directory.
- aissist.io — AI customer-service agent product, not an MCP directory.
- registry.modelcontextprotocol.io — already tracked as `registry` surface (published, 85 names).
- modelcontextprotocol/servers README list — retired (existing surface note).

## Budget note
~22 of 30 tool-call iterations used; file complete and shippable.
