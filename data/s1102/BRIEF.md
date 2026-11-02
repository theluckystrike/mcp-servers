# S1102 session brief (2026-11-02, 3h loop, orchestrator = main Claude session "mike-de")

Read this whole file before acting. Then read the lane brief in your prompt.

## Measured state at start (do not re-derive)
- Estate: 58 back-office servers in ~/mcp-servers/servers, 68 npm packages live since 2026-10-30
  (@theluckystrike scope + unscoped), hosted at https://mcp.zovo.one/mcp/<name>, Stripe live ($19 single / $39 bundle).
- MCP paid Checkout gross all time: $0. Google clicks to mcp.zovo.one: 0 (0 pages indexed on 2026-10-28).
- Strategy that stands (intel/S1030-strategy.md): MCP is a DISTRIBUTION CHANNEL, not the product. Build only what a
  model cannot do alone (live data, rules newer than training, exact calendar math), one-server public repos named with
  the full query phrase, small GitHub fields (0-3 competitors), every tool result links to a money site with UTM.
- 10 data satellites live (contract: ~/mcp-servers/satellites/BRIEF-S1030.md, results ~/mcp-servers/data/s1030/*.json):
  lake-level, no-tax-on-overtime, minimum-wage, dscr-loan-calculator, paycheck-calculator, uk-income-tax-salary,
  cups-to-grams, gold-price-per-gram, us-federal-holidays-business-days (+ estate). Workers at
  https://<repo>.lipmichal.workers.dev/mcp, all in the official registry.
- Brand storefront: https://www.mcpstamp.com (Cloudflare Pages project `mcp-showcase-preview`, source under
  ~/mcpstamp-work/a7-site/ci/site).

## CONCURRENT SESSION WARNING
Another Claude session (config ~/.claude-zovo-team) is working RIGHT NOW in ~/mcpstamp-work (a7-site deploys,
a8-registry checks, devmode `wrangler tail mcp-remote`). Rules:
- Never edit files under ~/mcpstamp-work except your own new subdir ~/mcpstamp-work/s1102-<lane>/.
- Never deploy `mcp-remote` or any existing mcp.zovo.one worker. Never kill another process.
- Before any `wrangler pages deploy --project-name mcp-showcase-preview`, run
  `ps -axo pid,command | /usr/bin/grep -E "pages deploy|astro build" | /usr/bin/grep -v grep` and wait if one is running.

## Host rules (mandatory, from ~/.claude/CLAUDE.md)
- `df -g /System/Volumes/Data` before builds: stop under 20 GB Avail. `memory_pressure | tail -1`: do not start a
  build/browser under 25% free.
- npm installs/builds/deploys through `/Users/mike/bin/buildslot` (max 2 heavy jobs host-wide). Use
  `npm_config_cache=/Users/mike/.npm-cache-local`. Wrap long commands in `timeout`.
- `grep` is a shell function here that silently returns nothing: always use `/usr/bin/grep`.
- No browsers unless your lane says so. No LinkedIn. Never the AWS default profile.
- Commits: NO AI attribution, no Co-authored-by, no generated-by footer. Public repos only for pushes in this session;
  for the private repo theluckystrike/mcp-servers do NOT push (the orchestrator pushes once at the end).
- No emoji anywhere. No paid APIs, listings or featured slots. No account creation, no browser sign-in: record those
  as OWNER UNLOCK with exact URL and stop.
- Every number you report carries the command or API call that produced it. A 200 is not evidence. Run a positive
  control before believing a zero.
- After each Cloudflare deploy record the version ID and rollback command.
- Delete your temp dirs when done. Work files go in ~/mcp-servers/data/s1102/<lane>/.

## Output
Write your result to ~/mcp-servers/data/s1102/<lane>.json and ~/mcp-servers/data/s1102/<lane>.md, then return a
summary of at most 15 lines: what changed (paths/URLs), how verified, what is open, owner unlocks.
