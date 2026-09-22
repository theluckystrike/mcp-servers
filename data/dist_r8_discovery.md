# Distribution Discovery — Round 8 (dist_r8)

**STATUS: in progress** (research complete, drafting)

**Target:** https://mcp.zovo.one (47 MCP servers, streamable-http at /mcp/<server>)
**Already used (do NOT redo):** punkpeye/awesome-mcp-servers, glama.ai, rohitg00/awesome-devops-mcp-servers, wagneragent/awesome-mcp-servers-devops, habitoai/awesome-mcp-servers
**In-flight from r7:** mcp.so issue #4227 (open), 12 open PRs to awesome-lists, 8 merged cumulative, Glama 12 servers + 35 connectors.

---

## A. NEW VIABLE SURFACES (ranked by organic-traffic win)

### 1. mcp.directory — **ACTIONABLE TODAY** (highest priority)
- **URL:** https://mcp.directory/submit
- **Method:** Free form (GitHub repo URL) → auto-pull metadata → publish within 24h. ALSO auto-discovers from official MCP Registry (registry.modelcontextprotocol.io) — claim via hello@mcp.directory for verified badge.
- **Cost:** Free. No account needed for submit.
- **Visibility:** 3,000+ servers listed; strong SEO ("MCP.Directory — 3,000+ MCP Servers & Skills"); indexed by Google. High organic value.
- **Submission entry (paste-ready):**
  ```
  GitHub Repository URL: https://github.com/theluckystrike/mcp-servers
  Short Description: 47 production MCP servers (invoice, docx, pdf, kanban, time-tracker, expense-tracker, purchase-requisition, office-suite, change-order, petty-cash, supplier-list, work-order, crx-permission-risk, zovo-lux) exposed over streamable-http at https://mcp.zovo.one/mcp/<server>. Zero-auth remote endpoints, free to use.
  ```
- **Note:** Check if already auto-listed from registry first; if so, claim (email hello@mcp.directory) instead of duplicate submit.

### 2. mcpservers.org — **ALREADY AUTO-INDEXED** (verify + claim)
- **URL:** https://mcpservers.org/submit
- **Method:** Free form at /submit. **Our servers already indexed** (supplier-list, work-order pages live ~15-16h ago) — auto-crawled from registry/GitHub.
- **Cost:** Free. $39 premium optional (skip).
- **Visibility:** 9,800+ servers; strong SEO ("Awesome MCP Servers"); Google-indexed. High value.
- **Action:** Verify all 47 servers present; submit any missing via form. No cost.

### 3. mcpmarket.com — **ACTIONABLE TODAY** (free queue)
- **URL:** https://mcpmarket.com/submit
- **Method:** Free form (GitHub repo URL). Free queue = 4-6 week listing time, no badge, no "Try Now" link. $29 one-time = 24h + badge (optional, skip).
- **Cost:** Free (free queue).
- **Visibility:** Claims 1M+ monthly visitors, 35K+ servers, 200K+ skills. Very high organic value.
- **Submission entry (paste-ready):**
  ```
  GitHub repo: https://github.com/theluckystrike/mcp-servers
  (Select: MCP Server → GitHub repo)
  ```
- **Note:** NOT currently indexed (search "zovo" = no match). Submit the monorepo once; it covers all 47 servers.

### 4. cline/mcp-marketplace — **ACTIONABLE TODAY**
- **URL:** https://github.com/cline/mcp-marketplace
- **Method:** GitHub issue via template `mcp-server-submission.yml` (repo URL + 400x400 PNG logo + brief description).
- **Cost:** Free.
- **Visibility:** Cline is a major VS Code AI agent; marketplace shown in-app to millions of Cline users. High value for dev-tool audience.
- **Submission entry (paste-ready):**
  ```
  Title: Add theluckystrike/mcp-servers (zovo.one MCP estate)
  Body:
  - GitHub repo URL: https://github.com/theluckystrike/mcp-servers
  - Logo: (attach 400x400 PNG)
  - Description: 47 production MCP servers (invoice, docx, pdf, kanban, time-tracker, expense-tracker, purchase-requisition, office-suite, change-order, petty-cash, supplier-list, work-order, crx-permission-risk, zovo-lux) over streamable-http at https://mcp.zovo.one/mcp/<server>. Zero-auth, free.
  ```

### 5. smithery.ai — **ACTIONABLE TODAY** (now part of Arcade.dev)
- **URL:** https://smithery.ai/new (or CLI: `smithery mcp publish "https://mcp.zovo.one/mcp" -n @zovo/mcp-servers`)
- **Method:** CLI publish or web form. Free.
- **Cost:** Free.
- **Visibility:** 2K+ servers, installer for Claude Desktop/Cursor; now under Arcade.dev (larger reach). Medium-high value.
- **Note:** NOT currently indexed (search "zovo" = no match). Publish the base endpoint; Arcade.dev ingestion may auto-pull the rest.

### 6. mcpfinder.org — **ACTIONABLE TODAY**
- **URL:** https://www.mcpfinder.org/submit
- **Method:** Free form (repo URL, name, tagline ≤160 chars, category, tags, contact email). Auto-approved if gates pass: repo 200, permissive license, README ≥500 chars, activity ≤180 days, valid install command, active maintainer.
- **Cost:** Free. $12.50 priority optional (skip).
- **Visibility:** Niche but growing; reliability-scored listings; dofollow link on paid tier only (free = nofollow). Low-medium value.
- **Submission entry (paste-ready):**
  ```
  Repository URL: https://github.com/theluckystrike/mcp-servers
  Server name: zovo.one MCP Servers
  Tagline: 47 production MCP servers (invoice, docx, pdf, kanban, time-tracker, expense-tracker, purchase-requisition, office-suite) over streamable-http at https://mcp.zovo.one/mcp/<server>. Zero-auth, free.
  Category: Productivity
  Tags: invoice, docx, pdf, kanban, time-tracking, expense, procurement
  Contact email: (maintainer email)
  ```

### 7. Docker MCP Catalog — **ACTIONABLE TODAY** (requires Docker image)
- **URL:** https://github.com/docker/mcp-registry (catalog at hub.docker.com/mcp)
- **Method:** PR to docker/mcp-registry adding a Docker image entry.
- **Cost:** Free.
- **Visibility:** Docker Hub is huge; catalog surfaces in Docker Desktop MCP Toolkit. Medium value (only if we ship Docker images — our servers are remote HTTP, so this needs a Docker wrapper).
- **Note:** Lower priority because our servers are remote streamable-http, not Docker-packaged. Only pursue if a Docker image is added.

### 8. Gemini CLI extensions — **ACTIONABLE TODAY** (auto-index, no submission)
- **URL:** https://geminicli.com/extensions/
- **Method:** No submission needed — add `gemini-extension.json` + `mcp` topic to the repo; Gemini CLI auto-indexes from GitHub topic.
- **Cost:** Free.
- **Visibility:** Gemini CLI is Google's agent; extensions browsable at geminicli.com. Medium value for Google ecosystem.
- **Action:** Add `gemini-extension.json` to theluckystrike/mcp-servers repo + `gemini-cli-extension` topic.

---

## B. AGGREGATOR AUTO-INDEX STATUS (checked live)

| Aggregator | zovo indexed? | How to get listed free | Status |
|---|---|---|---|
| **mcp.so** | NO (search "zovo" = no match) | GitHub issue (r7 #4227 already open) | In-flight from r7 |
| **smithery.ai** | NO | `smithery mcp publish` CLI or /new form | Actionable today |
| **mcpmarket.com** | NO | /submit form, free queue (4-6 wk) | Actionable today |
| **pulsemcp.com** | NO (0 results) | **Submissions PAUSED** ("rework how we ingest listings") | Human-gated / paused |
| **mcpservers.org** | YES (auto) | Auto-crawls registry/GitHub; /submit for missing | Already listed |
| **claudemcp.org** | YES (auto) | Auto-indexes from official MCP registry | Already listed |
| **licium.ai** | YES (auto) | Auto-indexes from mcp_registry source | Already listed |
| **mcpbundles.com** | YES (Zovo Lux) | Auto/claim via email verification | Already listed |
| **mcp.directory** | likely (registry) | Auto from registry; claim via hello@mcp.directory | Verify + claim |

---

## C. NOT VIABLE / SKIP
- **aixploria.com** — "We no longer offer free listings" (paid only). SKIP.
- **PulseMCP** — submissions paused indefinitely. Re-check later; human-gated.
- **Anthropic Claude connector directory** — requires Team org (~$50/mo). Human-gated/paid.
- **Cursor Marketplace** — manual review + Cursor account. Human-gated.
- **LobeHub** — wants write access to all repos. SKIP (security).
- **hesreallyhim/awesome-claude-code** — needs 14+ days old / 100+ stars. Human-gated.

---

## D. RANKED PRIORITY EXECUTION ORDER
1. **mcp.directory** — submit/claim (actionable today, 24h publish, high SEO)
2. **mcpservers.org** — verify all 47 present, submit missing (already auto-indexed)
3. **mcpmarket.com** — free-queue submit (1M+ visitors, 4-6wk)
4. **cline/mcp-marketplace** — GitHub issue (Cline in-app reach)
5. **smithery.ai** — CLI publish (Arcade.dev reach)
6. **mcpfinder.org** — free form (auto-approve if gates pass)
7. **Gemini CLI** — add gemini-extension.json + topic (auto-index)
8. **Docker MCP Catalog** — only if Docker image added (low priority)

**STATUS: complete** — research done, all surfaces verified live. No public submissions made (research/drafts only per contract).
