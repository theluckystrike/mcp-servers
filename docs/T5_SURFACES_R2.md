# T5 SURFACES R2 — unlinked third-party surfaces carrying our servers (2026-09-18)

Method: web_search probes (queries in /tmp/queries.txt); every URL below is a live SERP hit.
Goal: pages that mention or could list our servers but do NOT yet link to mcp.zovo.one → link/request targets.
Honest disclosure rule from R1 applies to any human-posted contact: state we're the authors.

## Category A — third-party pages ALREADY indexing our servers without a link back to us (highest value: they know us, just no mcp.zovo.one link)

1. mcpmetrics.io/servers/io-github-theluckystrike-bill-of-sale — lists endpoint https://mcp.zovo.one/mcp/bill-of-sale but canonical landing link goes to GitHub, not our /s/bill-of-sale page. Action: check profile-claim mechanism; if exists, set landing URL to https://mcp.zovo.one/s/bill-of-sale. $0, form/claim only.
2. feryn.lv/pl/showcase/mcp-io-github-theluckystrike-bill-of-sale — Polish aggregator showcase page for bill-of-sale; same pattern (endpoint shown, no landing link). Action: find contact/claim path.
3. aigregate.com — homepage news feed showing "MCP Credit Note / MCP Bill Of Sale — New" cards. Check if cards link to us; if GitHub-only, request landing swap.
4. glama.ai/mcp/servers/theluckystrike/* — 12 servers indexed with rich tool pages (job-card, dunning-letters, credit-note, office-suite...). Glama links to GitHub; our /s/ pages get nothing. Already covered by T3 re-probe; action remains maintainer verification + README badges (human-gated).

## Category B — directories that accept submissions (no account spent yet; submission issues are bot-friendly but posting left for next batch per "no ping without disclosure" rule)

5. mcp.so — submit via GitHub issue on their repo (docs say 'Submit' button → GitHub issues). Fits existing gh workflow.
6. mcpserver.dev — "Submit your MCP server" public form.
7. mcp.developersdigest.tech — directory with submit form.
8. geekflare.com/guides/mcp-server-directories/ — meta-list; PulseMCP + others named inside (follow-up: read full guide for 3-5 more names).

## Category C — content surfaces where an author-posted guide earns links (account-gated, human decision)

9. invoicecave.com/blog/invoice-mcp-server-guide — 2026 invoice-MCP guide ranking invoice servers; we run hosted invoice MCP. Action: comment/email author with honest disclosure + /s/invoice link. Requires outreach account → human-gated.
10. composio.dev/toolkits/zoho_invoice/framework/claude-cowork — Zoho-invoice how-to page; competitor pattern, not a link target (skip, noted for content parity: our /compare pages should rank for "zoho invoice mcp" queries).

## RESULT (schema)

- task: T5_SURFACES_R2
- status: COMPLETE (research only; zero outbound posts this session)
- surfaces found: 10 (4 in-the-wild already listing us, 3 submission forms, 2 content targets, 1 meta-list)
- producing commands: web_search queries recorded above; no curl/gh posts executed
- next: T5_SUBMIT_R1 — file mcp.so GitHub issue(s) with disclosure for 2-3 flagship servers; mcpserver.dev form needs browser session
- blockers: none for category B; category C needs outreach account (escalated R1, unchanged)
