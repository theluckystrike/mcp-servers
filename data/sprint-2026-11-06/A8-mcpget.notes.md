# A8-mcpget — mcp-get registry PR

STATUS: blocked

## Findings
- The task's named repo `mcp-get/website` does not exist. The real repo is `michaellatman/mcp-get`.
- Registry schema: NOT a single packages.json; it is one JSON file per package under `packages/` (79 existing files).
  Schema: name, description, vendor, sourceUrl, homepage, license, runtime, optional environmentVariables.
  Scoped names: filename = name.lstrip('@').replace('/','--') + '.json' (per getPackageFilename() in src/utils/package-registry.ts).
- Estate packages found live on npm: 59 under @theluckystrike (task brief said 58; npm search returns 59 today).
- Prepared fork github.com/theluckystrike/mcp-get, branch `add-theluckystrike-packages`, commit 7ba9d22 with all 59 entry files, pushed successfully.
- PR creation FAILED: "GraphQL: Repository was archived so is read-only (createPullRequest)".
  Verified via API: repos/michaellatman/mcp-get archived=true.

## Blocker
michaellatman/mcp-get is archived (read-only); GitHub rejects createPullRequest. No merge-capable PR is possible. Work is staged and pushable to the fork branch if the repo is ever unarchived or a successor repo appears.
