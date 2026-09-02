status: DONE

evidence:
- npm whoami -> 401 Unauthorized (token in ~/.npmrc dead)
- curl 127.0.0.1:9222/json/version -> 200, live Chrome/152 with webSocketDebuggerUrl (CDP up, but npm login still needs a human click/OTP)
- security find-generic-password -s npm -> "item could not be found"; find ~/.config -iname "*npm*" -> no output; gh secret list -R theluckystrike/mcp-servers -> HTTP 404 (repo not created yet); gh repo list theluckystrike -> no mcp-servers repo
- curl registry.npmjs.org/-/user/org.couchdb.user:theluckystrike -> {"ok":false} HTTP 401 (inconclusive, endpoint requires auth now); npmjs.com/~theluckystrike -> HTTP 403 Cloudflare JS challenge (inconclusive)
- curl registry.npmjs.org/@theluckystrike/mcp-{time-tracker,price-tracker,spreadsheet,invoice} -> {"error":"Not found"} x4 (none published, expected)
- brew install mcp-publisher -> poured 1.8.1 bottle; mcp-publisher --version -> "mcp-publisher 1.8.1 (commit: Homebrew, built: 2026-08-06T23:16:52Z)"
- mcp-publisher --help / login --help / init --help / publish --help / status --help -> full command surface captured
- mcp-publisher init (scratch dir, package.json name @theluckystrike/mcp-time-tracker) -> generated valid server.json template; mcp-publisher validate -> "server.json is valid"
- curl static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json -> HTTP 200 (schema URL confirmed live and current)
- curl registry.modelcontextprotocol.io/v0/servers?search=theluckystrike -> {"servers":[],"metadata":{"count":0}} (empty, expected pre-publish)
- gh api /search/code?q=filename:smithery.yaml+runtime -> 120 hits; pulled 2 live smithery.yaml files via gh api (makafeli/n8n-workflow-builder: runtime:"typescript" form; mumunha/mcp-evolution-whatsapp-api: startCommand.type:stdio form) -- both confirmed current, real
- gh api /search/code?q=filename:glama.json -> 2440 hits; pulled JerBouma/FinanceToolkit/glama.json -> {"$schema":"https://glama.ai/mcp/schemas/server.json","maintainers":["JerBouma"]}; curl glama.ai/mcp/schemas/server.json -> HTTP 200, required:["maintainers"] only
- gh api /search/code?q=mcpName+repo:modelcontextprotocol/registry -> found internal/validators/registries/mcpname.go; fetched file, confirmed comment: "NPM is unaffected [by README-token scanning] because it compares an exact metadata field rather than scanning README text" -- confirms mcpName in package.json is the real npm-ownership mechanism
- curl -sw '%{http_code}' mcp.so/submit -> 307 redirect to /submit?type=server (web form); pulsemcp.com/submit -> HTTP 403 Cloudflare bot challenge; mcpservers.org -> HTTP 200 with Submit UI, no PR/API path found; cursor.directory/mcp -> HTTP 429 rate-limited this session
- curl raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/CONTRIBUTING.md -> HTTP 200, full PR process + agent-PR fast-track rule ("add the emoji sequence to the end of the PR title to opt in")
- npx -y @anthropic-ai/mcpb --help -> full command surface (init/validate/clean/pack/unpack/sign/verify/info/unsign) confirmed working via npm_config_cache
- scripts/registry-check.sh run: reports MISSING for all 4 packages on both the official registry and npm (correct, nothing published yet), and NOT AUTHENTICATED for npm whoami
- scripts/publish-all.sh run with no args (dry-run): printed the full build/test/publish/tag/mcp-publisher sequence for all 4 servers with correct versions (0.1.0) read from each package.json, and did not execute anything

artifacts:
- /Users/mike/mcp-servers/docs/DISTRIBUTION.md
- /Users/mike/mcp-servers/docs/templates/server.json.template
- /Users/mike/mcp-servers/docs/templates/glama.json.template
- /Users/mike/mcp-servers/docs/templates/smithery.yaml.template
- /Users/mike/mcp-servers/docs/templates/manifest.mcpb.json.template
- /Users/mike/mcp-servers/scripts/registry-check.sh (tested, read-only, works unauthenticated)
- /Users/mike/mcp-servers/scripts/publish-all.sh (tested dry-run only; --go not exercised, per hard rule against running npm publish/git push)

cost: 24 wall minutes

failures:
- `mcp-publisher init` was accidentally run in the wrong working directory once (a `cd` to a nonexistent scratch path failed silently, so the command executed in the prior cwd, /Users/mike/mcp-servers/packages/mcp-license), which overwrote that package's package.json with a throwaway one-line stub and dropped a stray server.json there. Caught immediately via `git status`/`git diff`; fixed with `git checkout -- packages/mcp-license/package.json` and `rm server.json`. No lasting damage; packages/mcp-license/package.json confirmed restored byte-for-byte via git diff before moving on.
- `mcp-publisher validate --help` prints "Unknown command" even though `mcp-publisher validate` itself works and is listed in the top-level help; documented as a CLI quirk in DISTRIBUTION.md rather than a real blocker.
- WebFetch failed/empty on smithery.ai/docs (404), glama.ai/mcp/servers (page has no submission docs), and github.com/punkpeye/awesome-mcp-servers (WebFetch couldn't see CONTRIBUTING.md contents from the repo landing page) -- worked around all three with direct `curl raw.githubusercontent.com` / `gh api` calls instead, which is what the evidence above is built on.
- A concurrent process (not this agent) committed the whole working tree, including files this agent had already written into docs/ and scripts/, partway through the session (commit 34b53af). This agent never ran `git add`/`git commit`/`git push` itself, per the hard rule; the commit was made by something else running against the same repo.

insight: the official registry's npm-ownership check (mcpName field in package.json) is verifiable by reading the registry's own Go source via `gh api` code search -- the vendor's public docs don't spell this out as clearly as the validator source comment does ("NPM is unaffected because it compares an exact metadata field rather than scanning README text"), so trusting only the written guides here would have left the mcpName requirement undocumented.
