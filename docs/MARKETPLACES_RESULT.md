# Marketplaces: Docker MCP catalog + Cline marketplace

status: DONE

evidence:

Docker MCP catalog (docker/mcp-registry), free, no listing fee.
- Cloned shallow to /private/tmp/docker-mcp-registry. Layout for a local server is `servers/<name>/server.yaml` (+ optional `tools.json`); no readme or icon file is required in their repo, `about.icon` is a URL.
- Build mechanics read from cmd/build/main.go and pkg/servers/server.go: the image is built from a git context `<project>.git#<commit>[:<directory>]` with `-f <source.dockerfile>`. `source.directory` moves the build context into the subfolder; `source.dockerfile` is a path inside the context. Both together would resolve `servers/<name>/Dockerfile` inside `servers/<name>/`, so only one may be used. Chosen: no `directory`, `dockerfile: servers/<name>/Dockerfile`, i.e. the whole monorepo is the build context.
- Consequence: the old per-server-context Dockerfiles could not work, because `@theluckystrike/mcp-license` is not on npm and lives outside a `servers/<name>` context. All four Dockerfiles were rewritten as root-context multi-stage builds (COPY package.json + packages + servers, workspace install, build mcp-license then the server; runtime stage copies only the two package.json files and the two dist trees and runs `npm install --omit=dev --workspace <pkg> --include-workspace-root=false`).
- Docker daemon is unavailable on this machine (`docker info` fails), so `task build` could not run. Both Dockerfile stages were replayed by hand on copies of the tree:
  stage 1 -> `npm install` + `npm run build --workspace @theluckystrike/mcp-license` + `... mcp-invoice` -> `servers/invoice/dist/index.js` present, `node_modules/@theluckystrike/mcp-license` symlink true.
  stage 2 -> fresh dir with only package.json + the two package.json + the two dist trees, `npm install --omit=dev --workspace @theluckystrike/mcp-invoice --include-workspace-root=false` -> "added 157 packages in 1s"; then an `initialize` JSON-RPC line returned
  `{"result":{"protocolVersion":"2024-11-05",...,"serverInfo":{"name":"mcp-invoice","version":"0.1.0"}},"jsonrpc":"2.0","id":1}`.
- `tools.json` generated per server from a live `tools/list` call: time-tracker 13 tools, price-tracker 10, spreadsheet 10, invoice 12.
- Validation, `go run ./cmd/validate -name <n>` (the `task validate` target; `task` is not installed, go is):
  all four print 11 checks green - Name, Directory, Title, YAML formatting (prettier), Commit pinned, Secrets, Config env, License, Icon, Remote skipped, OAuth dynamic.
- PR (one PR, all four; no rule in CONTRIBUTING requires one server per PR, the PR body offers a split):
  https://github.com/docker/mcp-registry/pull/4892

Cline marketplace (cline/mcp-marketplace), free, no listing fee.
- Their README and `.github/ISSUE_TEMPLATE/mcp-server-submission.yml` require: repo URL, a 400x400 PNG logo, two testing checkboxes, optional additional info. One issue per server.
- Four issues created with `gh issue create -R cline/mcp-marketplace`:
  https://github.com/cline/mcp-marketplace/issues/2397 (time-tracker)
  https://github.com/cline/mcp-marketplace/issues/2398 (price-tracker)
  https://github.com/cline/mcp-marketplace/issues/2399 (spreadsheet)
  https://github.com/cline/mcp-marketplace/issues/2400 (invoice)
- `gh issue edit --add-label server-submission` failed for all four ("failed to update 1 issue"): labels cannot be set by a non-collaborator. Maintainer triage applies it.
- The "Cline installed it from the README" checkbox is left unchecked in all four issues, and the reason is stated in the body: the npm package is not published, so the `npx` line 404s today. `llms-install.md` carries that warning at the top and routes agents to the verified from-source path.

Data files: data/promotion.json rows 3 and 4 -> status "submitted" with the PR/issue URLs in `how`; data/distribution.json gains surfaces `docker-mcp-catalog` and `cline-marketplace` (both "submitted") plus per-server keys.
`node scripts/update-dashboard.mjs --note "docker + cline submissions"` -> "ledger written ... dashboard written (17076 bytes)"; `node scripts/render-main.mjs` -> "main dashboard written: index.html (64883 bytes, 4 servers, 12 sprint units)".

Paid surfaces: none encountered. Docker MCP catalog and Cline marketplace are both free, PR/issue based. Nothing was skipped as paid.

artifacts:
- /Users/mike/mcp-servers/servers/{time-tracker,price-tracker,spreadsheet,invoice}/Dockerfile (rewritten, root build context)
- /Users/mike/mcp-servers/servers/{time-tracker,price-tracker,spreadsheet,invoice}/llms-install.md
- /Users/mike/mcp-servers/assets/{time-tracker,price-tracker,spreadsheet,invoice}-logo.png (400x400, 8-bit RGB, 1.7-1.9 KB each)
- /private/tmp/docker-mcp-registry servers/{time-tracker,price-tracker,spreadsheet,invoice}/{server.yaml,tools.json} pushed to theluckystrike/mcp-registry branch add-theluckystrike-mcp-servers
- /Users/mike/mcp-servers/data/promotion.json, data/distribution.json, data/ledger.json, dashboard/index.html, index.html
- upstream commits: 7998ce2 (Dockerfiles, logos, llms-install), eea3aac (npm-status note)

cost: 29 wall minutes

failures:
- `npx prettier --write servers/*/server.yaml servers/*/tools.json` in the docker registry clone reformatted about 40 unrelated existing entries. Reverted with `git checkout -- servers` before staging; the branch contains only the four new directories.
- First server.yaml draft failed prettier with "Nested mappings are not allowed in compact mappings": the descriptions for time-tracker and invoice contained ": ". Rewrote both without a colon.
- First draft set both `source.directory` and `source.dockerfile`; that resolves to `servers/<name>/servers/<name>/Dockerfile`. Dropped `directory`.
- `git pull --rebase` refused at first (unstaged smithery.yaml edits from another agent). Staged only my own paths explicitly and pushed; the other agent's files were left untouched.

insight: Docker's build never uses the server.yaml directory as a Dockerfile root - `-f` is resolved inside whatever context `GetContext()` produced, so `directory` and `dockerfile` are mutually exclusive for a monorepo. Setting only `dockerfile` is what makes a workspace monorepo buildable, and it is also what forces the Dockerfile to be root-context; a per-subfolder Dockerfile can never see a sibling workspace package that is not on npm.
