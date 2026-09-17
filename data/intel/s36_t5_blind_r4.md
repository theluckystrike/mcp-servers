# Blind Recommendation Test R4

Run date: 2026-09-17
Run label: R4
Method: identical to R3 (fresh subagent, neutral web searches, no vendor named, record recommended server + source URLs + candidate hosts). R4 reuses the 6 weakest winners from R3 (thin-margin / no-confident-recommendation questions) plus 4 new buyer-intent questions drawn from the estate's capabilities (supplier list, service agreement, maintenance log, mileage logbook).

## Per-question results

| # | Question (reused/new) | Searches used | Recommended server(s) | Confident? | Candidate hosts seen |
|---|---|---|---|---|---|
| 1 | MCP server for a petty cash book or cash book ledger? (reuse R3 Q13) | `MCP server petty cash book cash book ledger` | mcp-server-ledger (minhyeoky) — nearest fit; Light Finance & Accounting MCP | No | light.inc, github.com, youtube.com, ambrook.com, gocardless.com |
| 2 | Is there an MCP server that produces a delivery schedule or work order document? (reuse R3 Q14) | `MCP server delivery schedule work order document` | Fulcrum MCP — nearest fit, shop/jobs data, not a doc generator | No | fulcrumpro.com, youtube.com, modelcontextprotocol.io, stainless.com, reddit.com |
| 3 | Which MCP servers can I use without installing anything, just by pasting a URL? (reuse R3 Q16) | `MCP servers use without installing paste URL remote hosted` | Pipedream MCP (hosted); DocsAutomator remote MCP | Yes (partial) | modelcontextprotocol.io, circleci.com, youtube.com, reddit.com, medium.com |
| 4 | Where do I find MCP servers that cost money, and how do I pay for one? (reuse R3 Q18) | `paid MCP servers how to pay for one marketplace` | MCP.so; MCPBundles; MCP Marketplace | Yes (partial) | reddit.com, youtube.com, mcp.so, mcp-marketplace.io, docs.aws.amazon.com |
| 5 | I want Claude Desktop to track my business expenses and mileage. What MCP server should I install? (reuse R3 Q3) | `MCP server Claude Desktop track business expenses mileage` | Expensify MCP; ExpenseBot MCP Server; Expense Tracker (mcpmarket) | Yes | reddit.com, expensebot.ai, mcpmarket.com, github.com, use.expensify.com |
| 6 | How do I let Claude fill in a quote or estimate template for a customer? (reuse R3 Q6) | `MCP server create quote estimate template fill in customer` | InvoiceCave MCP; Zuper MCP Server | Yes | invoicecave.com, aws.amazon.com, youtube.com, developers.zuper.co |
| 7 | Is there an MCP server that manages a supplier or vendor list? (NEW) | `MCP server supplier list vendor directory management` | none (no confident named server) | No | reddit.com, mcpservers.org, developer.microsoft.com, agenticskills.io, qveris.ai |
| 8 | What MCP server generates a service agreement or contract document? (NEW) | `MCP server service agreement contract document generation` | Docusign MCP; Scrive MCP server; PandaDoc MCP | Yes | support.docusign.com, reddit.com, scrive.com, pandadoc.com, docsautomator.co |
| 9 | Is there an MCP server that keeps a maintenance log or equipment service history? (NEW) | `MCP server maintenance log equipment service history tracking` | none (no confident named server) | No | gocodes.com, blog.invgate.com, tractian.com, youtube.com, teletracnavman.com |
| 10 | What MCP server tracks a mileage logbook or odometer trip log? (NEW) | `MCP server mileage logbook odometer trip log` | none (no confident named server) | No | youtube.com, reddit.com, apps.apple.com, play.google.com, triplogbook.app |

## Estate-visibility delta (R3 -> R4)

Probe: `site:mcpservers.org zovo`, `site:mcpservers.org theluckystrike`, `site:registry.modelcontextprotocol.io zovo`, `site:registry.modelcontextprotocol.io theluckystrike`.

| Probe | R3 | R4 | Delta |
|---|---|---|---|
| mcp.zovo.one host in any raw result | No | No | none |
| theluckystrike identity surfaced | No | Yes (mcpservers.org: invoice, time-tracker, price-tracker, spreadsheet) | +1 |
| Official MCP Registry (registry.modelcontextprotocol.io) zovo | No | No | none |
| Official MCP Registry theluckystrike | No | No | none |

- `named_ours_in_answer` (KPI): 0 of 10 (unchanged from R3's 0 of 18).
- `host_appeared_count`: 0 of 10 (mcp.zovo.one never retrieved).
- `identity_appeared_count`: 1 of 10 — theluckystrike surfaced on mcpservers.org, but only via a dedicated site: probe, not in any of the 10 neutral buyer-intent searches.

## Honest note

Nothing material changed in the <24h since R3. The estate's GitHub identity (theluckystrike) is now indexed on mcpservers.org (a visibility improvement for the GitHub identity), but the zovo host (mcp.zovo.one) still does not surface in any organic or site: search, and the Official MCP Registry surfaces neither identity. The KPI (named_ours_in_answer) remains 0. The 4 new buyer-intent questions (supplier list, maintenance log, mileage logbook) returned no confident named server — the estate's capabilities in these areas are not being retrieved either. The 6 reused weakest-winner questions produced the same competitor winners as R3 (Expensify/ExpenseBot, InvoiceCave/Zuper, Fulcrum, mcp-server-ledger, Pipedream/DocsAutomator, MCP.so/MCPBundles), confirming no shift in the competitive landscape.

STATUS: complete
