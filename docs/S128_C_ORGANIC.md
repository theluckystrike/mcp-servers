# S128_C_ORGANIC — llms-full tool lists + coverage-2026 asset (2026-09-21, orchestrator)

STATUS: complete — delegated subagent exhausted budget during discovery; orchestrator executed and verified at runtime.

## What shipped

1. **llms-full.txt now carries live tool lists for all 45 hosted servers.**
   - Discovered gap: llms-full.txt sections had tagline/free-tier/price/hosted-URL only — no tool names. Assistant crawlers (ClaudeBot, GPTBot, PerplexityBot) indexing llms-full.txt saw the tool surface nowhere.
   - Captured ground truth, not repo drift: called tools/list with a fresh anon token against all 45 hosted endpoints (45/45 answered 200). 15 of 45 diverged from the static `TOOLS` map in remote/src/index.ts (e.g. invoice: live has client_delete, map did not) — so the LIVE lists are what shipped.
   - Patch: added `LIVE_TOOLS` map + one `Tools: ...` line per server section in billing/src/index.js llms-full.txt handler. `node --check` passed, deployed mcp-billing via wrangler (token from ~/.zshenv).
   - Verified live: `curl -s https://mcp.zovo.one/llms-full.txt | grep -c '^Tools: '` → **45**.

2. **SEO asset: docs/coverage-2026/index.md + index.html** generated from /Users/mike/Desktop/platform-analysis-2026 JSON (measured.json, rows.json, mau_union.json, atl_pricing.json) with links back to zovo /s/<slug> landing pages. Generator: docs/coverage-2026/build.py (md → html, no build deps).

3. **IndexNow re-fired** after deploy: `node scripts/indexnow.mjs` → accepted 201, failed 0 (batches 0-99/100-199/200-200 all 200).

## Producing commands
- tool-list capture: `TOK=$(curl -s 'https://mcp.zovo.one/mcp/token?server=<s>' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])'); curl -s -H "Authorization: Bearer $TOK" -X POST https://mcp.zovo.one/mcp/<s>/t/$TOK -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
- deploy: `cd billing && npx wrangler deploy` (env CLOUDFLARE_API_TOKEN from ~/.zshenv)
- live verify: `curl -s https://mcp.zovo.one/llms-full.txt | grep -c '^Tools: '` → 45

## Not done (lower value)
- Install-guide pages already exist at /guides and /setup/<client> (GUIDES/CLIENTS in billing worker) — subagent's task 2 was redundant; nothing added.
- coverage-2026/ is repo-only (docs/ is not served by the worker); it is a repo/README asset, not a live URL.
