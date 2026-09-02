# Directories submission — RESULT

status: PARTIAL

evidence:
```
# 0. registry state (precondition, verified)
$ curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=theluckystrike'
{'count': 4}
io.github.theluckystrike/invoice 0.1.0
io.github.theluckystrike/price-tracker 0.1.0
io.github.theluckystrike/spreadsheet 0.1.0
io.github.theluckystrike/time-tracker 0.1.0

# 1. Glama
$ curl -s https://glama.ai/mcp/schemas/server.json
{"$id":"https://glama.ai/mcp/schemas/server.json", ..., "required":["maintainers"], "type":"object"}
# glama.json written at repo root + servers/{time-tracker,price-tracker,spreadsheet,invoice}/
$ git log --oneline -1
19c1687 Add glama.json maintainer claim at root and per server

$ curl -s 'https://glama.ai/mcp/servers?query=theluckystrike'   -> HTTP 200
# 1 pre-existing listing only: /mcp/servers/theluckystrike/bln-mcp-grammar-server
# no listing yet for mcp-servers; directory reports "81,760 servers. Updated 2026-09-02 13:20"
$ curl -o /dev/null -w '%{http_code}' https://glama.ai/mcp/submit                    -> 404
$ curl -o /dev/null -w '%{http_code}' https://glama.ai/mcp/servers/add               -> 200  (it is a search route, author:add)
$ curl -s 'https://glama.ai/api/mcp/v1/servers?query=theluckystrike'                 -> 401
{"error":{"code":"unauthorized","message":"This endpoint requires an API key. Create one at https://glama.ai/settings/api-keys. ..."}}
# "Add Server" on /mcp/servers is a JS <button> with no href; page offers Sign Up. No unauthenticated add endpoint exists.

# 2. awesome-mcp-servers
$ gh repo fork punkpeye/awesome-mcp-servers --clone=false
theluckystrike/awesome-mcp-servers already exists
$ gh repo sync theluckystrike/awesome-mcp-servers      # ok
$ git clone --depth 1 https://github.com/theluckystrike/awesome-mcp-servers /private/tmp/awesome-fork
$ git diff --stat
 README.md | 4 ++++
$ gh pr create --repo punkpeye/awesome-mcp-servers ...
https://github.com/punkpeye/awesome-mcp-servers/pull/13473

# 3. Smithery
$ npx -y @smithery/cli --help
SMITHERY CLI v4.11.1
$ npx -y @smithery/cli auth whoami --json
No token found
$ npx -y @smithery/cli auth login --json < /dev/null
{"auth_url":"https://smithery.ai/auth/cli?s=183af9e6-8c62-4685-85ec-2d5d6a4526ed","session_id":"183af9e6-8c62-4685-85ec-2d5d6a4526ed"}
# REST exists and is fully scriptable once a bearer key is held (https://smithery.ai/docs/llms.txt):
#   PUT https://api.smithery.ai/servers/{namespace}/{server}            create server (idempotent)
#   PUT https://api.smithery.ai/servers/{qualifiedName}/releases        multipart: payload=JSON, bundle=<.mcpb>  (stdio release)
#   POST /tokens                                                        mint service token (needs an API key/bearer first)
# security: bearerAuth on every path. No GitHub-token path, no anonymous submit.

# smithery.yaml validation against the schema the CLI actually enforces
# (extracted from @smithery/cli 4.11.1 dist/index.js):
#   z.object({ name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9-_.../), target: z.enum(["local","remote"]) }).partial().loose()
# Both keys optional, unknown keys passed through. Files had neither key; added them.
$ python3 validate (regex + enum, per file)
time-tracker VALID mcp-time-tracker local ['name', 'target', 'runtime', 'startCommand']
price-tracker VALID mcp-price-tracker local ['name', 'target', 'runtime', 'startCommand']
spreadsheet VALID mcp-spreadsheet local ['name', 'target', 'runtime', 'startCommand']
invoice VALID mcp-invoice local ['name', 'target', 'runtime', 'startCommand']

# 4. mcp.so (Chrome CDP 127.0.0.1:9222, browser ws + Target.createTarget newWindow, attachToTarget flatten, suppress_origin)
URL: https://mcp.so/submit?type=server
TITLE: Submit your project
forms: 1
fields: [ {INPUT url, placeholder "https://github.com/owner/repository", required:true},
          {INPUT text, placeholder "Project name", required:false} ]
buttons: [..., "Pay and submit automatically", ...]
signin: true
body text: "Paid submission  $39  one-time publishing fee / Publish immediately without review /
            Verified badge / Featured and priority placement / Dofollow project link"
screenshot: /private/tmp/mcpso.png  (confirms the paid card is the only submit path; header shows "Sign In")
# NOT submitted.

# 5. dashboard
$ node scripts/update-dashboard.mjs --note "directories: ..."
ledger written: /Users/mike/mcp-servers/data/ledger.json
dashboard written: /Users/mike/mcp-servers/dashboard/index.html (16782 bytes)
$ node scripts/render-main.mjs
main dashboard written: /Users/mike/mcp-servers/index.html (62854 bytes, 4 servers, 10 sprint units)
```

per-surface outcome:
- registry (modelcontextprotocol.io): published, 4 servers v0.1.0, verified live.
- glama: claimed. glama.json committed at root and per server; crawler-only intake, nothing further is possible without a Glama account.
- awesome-mcp-servers: submitted. PR https://github.com/punkpeye/awesome-mcp-servers/pull/13473
- smithery: blocked on one browser login (free). Everything after it is scriptable.
- mcp.so: skipped: paid ($39 one-time listing fee, no free tier on the form).

artifacts:
- /Users/mike/mcp-servers/glama.json
- /Users/mike/mcp-servers/servers/{time-tracker,price-tracker,spreadsheet,invoice}/glama.json
- /Users/mike/mcp-servers/servers/{time-tracker,price-tracker,spreadsheet,invoice}/smithery.yaml (name + target added)
- /Users/mike/mcp-servers/data/distribution.json
- /Users/mike/mcp-servers/docs/DIRECTORIES_RESULT.md
- /private/tmp/mcpso.png
- /private/tmp/awesome-fork (branch add-theluckystrike-mcp-servers)
- https://github.com/punkpeye/awesome-mcp-servers/pull/13473

cost: 24 wall minutes

failures:
- `git pull --rebase` refused: other agents held unstaged changes in packages/ and servers/invoice/src.
  Fixed by committing only the five glama.json paths, then `git -c rebase.autoStash=true pull --rebase`,
  which stashed and reapplied their work (autostash 248b8cb, "Applied autostash").
- The awesome-mcp-servers fork already existed from an earlier session; `gh repo sync` before branching.
- awesome-mcp-servers entry format carries emoji language/scope markers. The four entries were written
  without markers to respect the no-emoji rule; 56 of the 2,237 existing entries also carry no markers,
  so the lines are format-legal. PR title carries no emoji, so it is not opted into the agent fast-track.

insight:
The smithery.yaml files in this repo are decorative. The zod schema that Smithery CLI 4.11.1 actually
parses out of smithery.yaml is `{name?, target?}` and nothing else - `runtime`, `build` and `startCommand`
survive only because the object is `.loose()`. The 2025-era `runtime: typescript` / `startCommand` format
documented in docs/DISTRIBUTION.md section 3 is dead: the current product publishes either a URL or an
.mcpb bundle through `PUT /servers/{qn}/releases`, so the four .mcpb bundles already on GitHub release
v0.1.0 - not the yaml - are the Smithery deliverable, and they need only one browser login to ship.
