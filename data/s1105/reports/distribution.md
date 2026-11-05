# S1105 distribution report

Run on 2026-11-05 by the distribution lane. Read-only checks plus 2 pull requests. No accounts, no browser sign-in, no paid listings.

## Presence table

| Channel | Listed | Count | Evidence command |
|---|---|---|---|
| Official MCP registry | y | 274 server names with an isLatest version (270 active, 4 deprecated), 2000 version rows | `curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.theluckystrike&limit=100"` paged on `metadata.nextCursor`, then `jq` on `.server.name` and `_meta["io.modelcontextprotocol.registry/official"]`. Positive control `search=github` returns other owners' servers. |
| punkpeye/awesome-mcp-servers (97.3k stars) | y | 1 (mcp-statement-of-account, PR 13963 merged) | `curl -sL https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md \| /usr/bin/grep -niE 'theluckystrike\|mcpstamp\|zovo'` |
| punkpeye/awesome-remote-mcp-servers (2.6k) | y | 2 (Zovo Price Tracker, Zovo Time Tracker) | `gh api repos/punkpeye/awesome-remote-mcp-servers/readme --jq .content \| base64 -d \| /usr/bin/grep -E '^- \[' \| /usr/bin/grep -ciE 'theluckystrike\|zovo'` |
| TensorBlock/awesome-mcp-servers (1.0k) | y | 3 (common-ground, price-tracker, Office Suite bundle in docs/*.md) | `gh search code theluckystrike --repo TensorBlock/awesome-mcp-servers` and `gh pr list -R TensorBlock/awesome-mcp-servers --author theluckystrike --state all` (3 merged) |
| yzfly/Awesome-MCP-ZH (7.8k) | n | 0 | README grep 0 hits; prior PR 210 closed |
| appcypher/awesome-mcp-servers (5.8k) | n | 0 | README grep 0; repo `archived=true`, no PR possible |
| wong2/awesome-mcp-servers (4.4k) | n | 0 | README grep 0; README says "We do not accept PRs", workflow auto-closes PRs, submissions go to https://mcpservers.org/submit |
| jaw9c/awesome-remote-mcp-servers (1.2k) | n | 0 | README grep 0; prior PRs 1306 and 769 closed |
| YuzeHao2023/Awesome-MCP-Servers (1.1k) | n | 0 | README grep 0; prior PRs 518 and 473 closed |
| rohitg00/awesome-devops-mcp-servers (1.0k) | n | 0 | README grep 0; prior PR 338 closed |
| chatmcp/mcpso (2.1k, repo of mcp.so) | n | 0 | README grep 0; it is a site repo, listings are added on mcp.so |
| soxoj/awesome-osint-mcp-servers (537) | n before this run | 0, PR 145 open | README grep 0; `gh pr list --author theluckystrike` empty before this run |
| punkpeye/awesome-mcp-devtools (487) | n before this run | 0, PR 437 open | same as above |
| glama.ai | y | at least 34 on the first search page (30 /mcp/servers/theluckystrike/*, 4 /mcp/connectors/io.github.theluckystrike/*). This is a floor; the page is paginated and the API needs a key. | `curl -sL -A "<browser UA>" "https://glama.ai/mcp/servers?query=theluckystrike" \| /usr/bin/grep -oE '/mcp/(servers\|connectors)/[A-Za-z0-9._-]*theluckystrike/[A-Za-z0-9._-]+' \| sort -u \| wc -l` |
| mcp.so | n | 0 | `curl -sL -A "<browser UA>" "https://mcp.so/search?q=theluckystrike"` renders "No servers match"; also 0 for zovo, mcpstamp, "subdomain finder"; "lake level" returns 1 result that is not ours. Positive control `q=playwright` returns 204. |
| pulsemcp.com | unknown | not measurable | Search page returns 403 to curl; the public v0beta API returns `API_SUNSET`. Needs a browser check. |
| mcpservers.org | unknown | not measurable | `/search?query=theluckystrike` returns 403 to curl |

Prior PR inventory: `gh search prs --author theluckystrike --limit 300` returns 300 rows (the cap), including 5 open PRs to punkpeye/awesome-mcp-servers (13964, 13965, 13966, 14681, 18434), 2 open to punkpeye/awesome-remote-mcp-servers (3598, 3709), and many niche awesome lists. Notes in intel/wave3-prs.md, intel/r4-directory-wave4.md and data/s1102/niche-lists.md had skipped soxoj and awesome-mcp-devtools earlier because no OSINT server or MCP devtool existed then. subdomain-finder-mcp and mcpstamp-check now exist.

## Pull requests opened (2 of the 3 allowed)

1. https://github.com/soxoj/awesome-osint-mcp-servers/pull/145
   Subdomain Finder MCP in Network Scanning. The entry uses the list's required format, which puts the list's own legend icons (open source, free) before the name and a long dash before the description. This conflicts with the project's no-emoji rule; the icons are in the list entry only, not in the PR title or body. If the owner objects, close PR 145. Description 266 characters, under the 400 limit, with no tracking parameters. Verified before opening: repo public, MIT, README present; hosted `initialize` and a real `tools/call find_subdomains` on example.com both answer; `tools/list` returns the 4 tools named in the PR. The PR states it is not on npm.
2. https://github.com/punkpeye/awesome-mcp-devtools/pull/437
   theluckystrike/mcpstamp-check in Testing Tools. Verified: repo public, MIT, README present, tag v1 exists for the Action, and a real `tools/call check_mcp_server` through https://mcp.zovo.one/stamp/mcp returns a score. Caveat: this list last merged on 2026-08-04 and has many open PRs, so a merge may be slow.

Both commits are authored by theluckystrike (noreply email), one line each, with no AI attribution. Forks: theluckystrike/awesome-osint-mcp-servers, theluckystrike/awesome-mcp-devtools.

A third PR was not opened. Every remaining list with more than 1000 stars is archived, refuses PRs, or already has a PR from theluckystrike. soxoj's CONTRIBUTING counts cross-posting across many lists as a spam signal, and this account's history already shows that, so a filler PR would lower the odds for the two above.

## Next 5 distribution actions, ranked by expected reach

1. **Get the 2 conflicted punkpeye/awesome-mcp-servers PRs mergeable (agent, about 15 minutes).** PRs 14681 (Office Suite) and 13964 (mcp-spreadsheet) carry the `merge-conflict` label. That list has 97k stars and is the one awesome list the blind test cited. Rebase each on main and keep the one-line diff. Do not open new PRs there; 5 are already open.
2. **Submit to mcpservers.org (owner, about 5 minutes per server).** https://mcpservers.org/submit . wong2's 4.4k-star list routes all submissions there, and mcpservers.org was cited 3 times in the R1 recommendation-source test. Submit mcpstamp-check, the Office Suite (https://github.com/theluckystrike/mcp-servers) and subdomain-finder-mcp. It is a web form, so it needs the owner.
3. **List on mcp.so (owner, about 10 minutes).** https://mcp.so/submit needs a sign-in. We have 0 entries there. Start with the Office Suite and McpStamp Check.
4. **Check PulseMCP by hand (owner, about 5 minutes).** Open https://www.pulsemcp.com/servers?q=theluckystrike in a browser. PulseMCP ingests the official registry, where we have 274 names, so entries may already exist. If they do not, use https://www.pulsemcp.com/submit . curl gets a 403 and the old API is sunset, so an agent cannot measure this.
5. **Add subdomain-finder-mcp and mcpstamp-check to TensorBlock/awesome-mcp-servers (agent, about 15 minutes, next sprint).** That list merged all 3 of our earlier PRs, so it accepts this kind of entry. One server per PR, after #145 and #437 get a response.

## Commands to recheck PR state

```
gh pr view 145 -R soxoj/awesome-osint-mcp-servers --json state,comments
gh pr view 437 -R punkpeye/awesome-mcp-devtools --json state,comments
```
