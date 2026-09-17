# Release v0.22.0 (2026-09-17)

status: done

evidence: registry remotes went from 0 to all 41 hosted endpoints visible in the Official MCP Registry (3 under alias names); GitHub release v0.22.0 with 38 .mcpb assets then 4 more uploaded for the new servers (42 total); fileSha256 placeholders replaced with real digests in 42 manifests and primary server.json switched from npm packages (unpublished, token revoked) to mcpb packages so the registry accepts them; the 2026-09-13 hosted-row waiver for supplier-list, service-agreement, maintenance-log and mileage-log deleted after live initialize probes returned 200; Awesome-MCP PR #52 opened and mergeable with an upstream catalog.yaml conflict fixed as a side effect; 38/38 mirror descriptions patched to carry the hosted endpoint URL; billing 148/148, remote 141/141, validation 1192/1192.

insight: the official registry was the one index the client pickers read and none of our endpoints were reachable through it; a manifest is not published until its referenced artifact resolves, so the mcpb asset had to exist before the remote entry could stick.

artifacts: https://github.com/theluckystrike/mcp-servers/releases/tag/v0.22.0
