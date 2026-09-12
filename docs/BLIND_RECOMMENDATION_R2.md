# Blind Recommendation Run R2 — 18 Buyer Questions

Run date: 2026-09-12. Method: for each question, web searches phrased as a real user would phrase them; recommendations only where sources actually describe a fitting server. "No confident recommendation" is recorded where nothing solid was found. No vendor priors applied; every candidate was judged only on what the found pages describe.

---

## Q1. How can I get Claude to generate an invoice PDF for my freelance clients?

Searches used:
- `MCP server generate invoice PDF Claude`

Recommendation(s):
- **invoice-mcp (markslorach)** — "Model Context Protocol server for creating professional PDF invoices using natural language." Source: https://github.com/markslorach/invoice-mcp
- **invoice-mcp-server (kmexnx)** — "MCP server for generating invoices as PDFs or sending via email." Source: https://github.com/kmexnx/invoice-mcp-server

Other candidates seen (not recommended over the above): InnarM/blank-invoice-maker-mcp (https://github.com/InnarM/blank-invoice-maker-mcp), techflavors/paypal-invoice-mcp-server (https://github.com/techflavors/paypal-invoice-mcp-server), invoice-pdf-billing-generator remote connector (Glama listing: https://glama.ai/mcp/connectors/io.github.theluckystrike/invoice-pdf-billing-generator — verified via fetch: 13 tools, remote Streamable HTTP at mcp.zovo.one, free tier + license-key Pro), plus SaaS vendors invovate.com, invoicexml.com, invoicemyclients.com.

## Q2. Is there an MCP server that merges and splits PDF files?

Searches used:
- `MCP server merge split PDF files`

Recommendation(s):
- **pdf-mcp-server (Sohaib-2)** — 16 tools incl. `merge_pdfs`, `split_pdf`, `extract_pages`, `rotate_pages`; needs PDFtk/QPDF binaries. Source: https://github.com/Sohaib-2/pdf-mcp-server
- **PDF Toolkit MCP Server (aryanbv)** — 22 tools, merge/split preserving AcroForm fields, zero native deps (`npx -y @aryanbv/pdf-toolkit-mcp`). Source: https://mcpservers.org/servers/aryanbv/pdf-toolkit-mcp

Also seen: pdf-chapter-splitter (https://lobehub.com/mcp/keigoly-pdf-chapter-splitter), mcp-doc-forge (https://glama.ai/mcp/servers/pb9df6lnel), PDF Manipulation (https://mcpmarket.com/server/pdf-manipulation), commercial Foxit MCP (https://developer-api.foxit.com/developer-blogs/use-cases-workflow-examples/automated-document-pipelines/foxit-mcp-server-ai-pdf-tools/) and Apryse (https://apryse.com/blog/ai-mcp-server-pdf-processing-apryse-sdk).

## Q3. I want Claude Desktop to track my business expenses and mileage. What MCP server should I install?

Searches used:
- `MCP server expense tracking mileage Claude Desktop`

Recommendation(s):
- **ExpenseBot MCP Server** — receipt capture, Gmail scanning, expense/income search, client/project grouping, and mileage tracking explicitly; hosted remote connector or local stdio. Source: https://www.expensebot.ai/blog/expensebot-mcp-launch
- **Expensify via Pipedream MCP** — receipt scanning and mileage tracking through Pipedream's hosted Expensify app server. Source: https://mcp.pipedream.com/app/expensify

Also seen (expense-only, no mileage): bzheng29/expense-tracker-mcp (https://github.com/bzheng29/expense-tracker-mcp), RohitBind123/expense-tracker-mcp-server, justfsl50/expense-mcp (https://mcp-marketplace.io/server/io-github-justfsl50-expense-mcp), several student-grade trackers on GitHub/Glama. Note: mileage is the differentiator; only ExpenseBot and Expensify sources explicitly mention it.

## Q4. What MCP server lets an AI assistant read a bank statement PDF and categorise the transactions?

Searches used:
- `MCP server read bank statement PDF categorize transactions`

Recommendation(s):
- **DocuClipper MCP** — stdio server (`npx -y docuclipper-mcp`), `convert_bank_statement` tool extracts transactions from statement PDFs; ~99.6% extraction-accuracy claim. Source: https://www.docuclipper.com/integrations/mcp/
- **MainBook MCP** — five tools (`convert_bank_statement`, `get_conversion`, `list_conversions`, `get_balance`, `output_folder`); JSON inline or XLSX/CSV out; hosted option at https://mcp.mainbook.ai/mcp. Source: https://mainbook.ai/mcp

Caveat: both upload your PDF to a third-party API — check retention policies before sending real statements. Also seen: bank-statement-sheet-mcp (npm, uploads to Bank Statement Sheet API, reconciliation verdict), Redbark (https://redbark.co/convert/bank-statement-to-actual-budget — extract + sync to Actual Budget/YNAB/Sheets, queryable via MCP). Pure-categorisation add-ons exist (Norman MCP skill via https://mcpmarket.com/tools/skills/ai-bookkeeping-transaction-categorization) but need an extractor in front.

## Q5. Best MCP server for creating Word documents from a chat?

Searches used:
- `MCP server create Word documents docx from chat Claude`
- `Office-Word-MCP-Server GongRzhe docx tools`

Recommendation(s):
- **Office-Word-MCP-Server (GongRzhe)** — the de-facto standard: 54 tools over python-docx/FastMCP (headings, tables, images, styles, footnotes, protection, PDF conversion); `uvx --from office-word-mcp-server word_mcp_server`. Sources: https://github.com/gongrzhe/office-word-mcp-server , https://www.modelscope.cn/mcp/servers/@GongRzhe/Office-Word-MCP-Server , https://glama.ai/mcp/servers/@GongRzhe/Office-Word-MCP-Server?locale=zh-CN . Security note: CVE-2026-65695 path traversal in versions <= 1.1.11 (https://radar.offseq.com/threat/cve-2026-65695-improper-limitation-of-a-pathname-to-a-restricted-directory-path-traversal-in-gongrzhe-65de801a29298eae) — pin the latest release.
- **docx-mcp** — alternative MCP server for .docx files. Sources: https://mcpservers.org/servers/securityronin/docx-mcp , https://github.com/hongkongkiwi/docx-mcp

## Q6. How do I let Claude fill in a quote or estimate template for a customer?

Searches used:
- `MCP server quote estimate template fill customer`
- `DocsAutomator MCP server generate documents Google Docs templates`

Recommendation(s):
- **DocsAutomator MCP** — closest general-purpose fit: turn a Google Doc/Word/PDF quote template into `{{placeholder}}` fields, map data, then `create_document` to render a filled PDF; 17 tools + e-sign; remote server at https://mcp.docsautomator.co/mcp (paste-URL custom connector, no install). Sources: https://docsautomator.co/docs/integrations-api/docsautomator-mcp , https://www.docsautomator.co/features/ai-and-agents/
- **Zuper MCP Server** — field-service-specific but directly estimate-shaped: `list_proposal_templates`, `create_estimate`, `update_estimate`, `send_estimate`. Source: https://developers.zuper.co/docs/zupers-model-context-protocol-mcp-server

Also seen: AWS Pricing Calculator MCP sample (https://github.com/aws-samples/sample-aws-pricing-calculator-mcp — AWS-cost estimates only), Warp Freight MCP (https://www.wearewarp.com/agents/mcp — freight quotes only), Xero MCP (has quotes entity — see Q17). No horizontal "fill any business template" open-source server found beyond DocsAutomator.

## Q7. Is there an MCP server for time tracking and timesheets?

Searches used:
- `MCP server time tracking timesheets toggl clockify`

Recommendation(s):
- **mcp-toggl (Very Good Plugins)** — full Toggl Track integration: timers, daily/weekly reports, hydrated entries, smart caching. Source: https://github.com/verygoodplugins/mcp-toggl
- **Sandtime.io MCP** — timesheet-shaped: log hours, fill weeks, billable reports by client, locked-week checks. Source: https://sandtime.io/mcp

Also seen: lazy-toggl-mcp (https://github.com/movstox/lazy-toggl-mcp), TrackingTime official read-only remote server (https://mcpservers.org/servers/trackingtime/mcp), Harvest MCP (https://skywork.ai/skypage/en/harvest-mcp-server-conversational-time-tracking/1977937759672651776), Clockify via Composio hosted (https://composio.dev/toolkits/clockify/framework/crew-ai — no official Clockify server exists as of 2026).

## Q8. MCP server to convert currencies with real exchange rates?

Searches used:
- `MCP server currency conversion real exchange rates`

Recommendation(s):
- **FrankfurterMCP (anirbanbasu)** — real ECB reference rates via the free Frankfurter API, no API key. Source: https://mcpservers.org/servers/anirbanbasu/frankfurtermcp
- **exchange-rates-mcp-server (cyanheads)** — exchange-rate tools server. Source: https://github.com/cyanheads/exchange-rates-mcp-server/blob/main/README.md

Also seen: currency-mcp (https://pypi.org/project/currency-mcp/), @iflow-mcp/currency-conversion-mcp (https://www.npmjs.com/package/@iflow-mcp/currency-conversion-mcp), ruddxxy/currency-exchange-mcp (https://mcpservers.org/servers/ruddxxy/currency-exchange-mcp), efrat-spiegel currency-converter (https://lobehub.com/mcp/efrat-spiegel-currency-converter-mcp), fastFOREX hosted MCP (https://www.fastforex.io/docs/mcp-server).

## Q9. What MCP server helps schedule a meeting across time zones?

Searches used:
- `MCP server schedule meeting across time zones`
- `modelcontextprotocol servers time timezone conversion official reference server`

Recommendation(s):
- **Time (official reference server, mcp-server-time)** — `get_current_time` in any IANA zone + `convert_time` between zones; one of the seven maintained reference servers in modelcontextprotocol/servers; `uvx mcp-server-time`. Sources: https://github.com/modelcontextprotocol/servers (README raw: https://raw.githubusercontent.com/modelcontextprotocol/servers/refs/heads/main/README.md), https://pypi.org/project/mcp-server-time/
- Pair with a calendar server to actually book: **Google Calendar MCP** (setup guide: https://www.codewords.ai/blog/google-calendar-mcp-server) or **Cronofy MCP** scheduling connector (https://learn.microsoft.com/en-us/connectors/cronofymcp/).

Honest note: no single server found that does "find a mutually good time across zones and book it" end-to-end; the working pattern is time-zone math (Time) + calendar free/busy and event creation (Calendar/Cronofy). Also seen: SzeMeng76/mcp-time-server (https://github.com/SzeMeng76/mcp-time-server), Webex Meetings MCP (https://developer.webex.com/mcp/docs/meetings-mcp-server), Clockwise (https://skywork.ai/skypage/en/clockwise-mcp-server-ai-engineers-guide/1980516738248855552), Outlook Calendar via MintMCP (https://www.mintmcp.com/outlook-calendar).

## Q10. I need an MCP server that builds a spreadsheet from data in my conversation.

Searches used:
- `MCP server build spreadsheet xlsx from conversation data Claude`
- `haris-musa excel-mcp-server GitHub create workbook`

Recommendation(s):
- **excel-mcp-server (haris-musa)** — most-established: create/read/update workbooks, formatting, charts, pivot tables, no Excel install needed; stdio or streamable HTTP; ~4k stars. Source: https://github.com/haris-musa/excel-mcp-server
- **mcp-server-spreadsheet (marekrost)** — stateless cell-level ops + DuckDB SQL over .xlsx/.csv/.ods; `uvx mcp-server-spreadsheet`. Source: https://marekrost.cz/mcp-server-spreadsheet/

Also seen: Lido MCP for document-to-spreadsheet extraction (https://www.mcpspreadsheet.com/), Quadratic hosted MCP (https://www.quadratichq.com/ai/mcp), Google Sheets servers (https://github.com/HosakaKeigo/mcp-server-spreadsheet — Google Sheets API variant; https://github.com/ringo380/claude-google-sheets-mcp), ishayoyo/excel-mcp (https://mcpservers.org/servers/ishayoyo/excel-mcp).

## Q11. Is there an MCP server that generates barcodes or QR codes?

Searches used:
- `MCP server generate QR code barcode`

Recommendation(s):
- **barcode-scanner-mcp (domdomegg)** — both directions: `generate_qr` (configurable error correction), `generate_barcode` (25+ formats: Code 128, EAN-13, UPC-A...), plus `decode_image`; `npx -y barcode-scanner-mcp`. Source: https://github.com/domdomegg/barcode-scanner-mcp

Also seen: pandson7/qrcode-mcp-server (https://github.com/pandson7/qrcode-mcp-server), QR-Tool-MCP styled codes (https://glama.ai/mcp/servers/Kalypsokichu-code/QR-Tool-MCP), Aspose.BarCode Cloud MCP, 60+ symbologies, API creds (https://pkg.go.dev/github.com/aspose-barcode-cloud/Aspose.BarCode-Cloud-MCP), mcp-server-qrcode-enhanced (https://mcpservers.org/servers/myownipgit/mcp-server-qrcode-enhanced), QR for Agent (https://qrforagent.com/).

## Q12. What MCP server can zip and unzip archives for Claude?

Searches used:
- `MCP server zip unzip archive files Claude`
- `MCP server archive extract compress zip tar 7z tool`

Recommendation(s):
- **mcp-file-archive-tools (DomoticX)** — most comprehensive: ZIP, 7z, RAR, TAR, GZ, ARJ, CAB etc.; list/extract/create/update/test, password and SFX support (backend binaries like 7za required). Source: https://github.com/DomoticX/mcp-file-archive-tools
- **zip-mcp (7gugu)** — lightweight ZIP-only: `compress`, `decompress`, `getZipInfo`, password support. Source: https://github.com/7gugu/zip-mcp

Also seen: go-crx3 (https://github.com/mmadfox/go-crx3 — zip/unzip tools but framed for Chrome-extension packaging), Encodian via Composio (https://composio.dev/toolkits/encodian/framework/crew-ai — archive extraction inside a document-automation SaaS), CodeSeeker-MCP (search inside archives: https://mcpservers.org/servers/mixelpixx/CodeSeeker-MCP).

## Q13. MCP server for a petty cash book or cash book ledger?

Searches used:
- `MCP server petty cash book ledger bookkeeping`
- `beancount ledger MCP server plain text accounting double entry`

Finding: **No dedicated petty-cash / cash-book MCP server exists in anything I found.** Nearest legitimate fits:
- **finance-mcp (youssefaltai)** — personal-finance double-entry bookkeeping server, 18 tools (accounts, journal entries, budgets), PostgreSQL + FastMCP; a petty-cash account is just one account in it. Source: https://github.com/youssefaltai/finance-mcp
- **beanquery-mcp (vanto)** / **Beancount MCP (StdioA)** — query/analyse Beancount plain-text ledgers (and submit transactions). Sources: https://github.com/vanto/beanquery-mcp , https://mcpservers.org/servers/StdioA/beancount-mcp

Treat as nearest-fit only; flagged as a gap. Round-up source: https://chatforest.com/reviews/accounting-bookkeeping-mcp-servers/ (also 404 on direct fetch at run time; snippet only).

## Q14. Is there an MCP server that produces a delivery schedule or work order document?

Searches used:
- `MCP server delivery schedule work order document generate`
- `"work order" MCP server field service management`

Finding: **No dedicated delivery-schedule server found; work orders exist only inside vertical field-service platforms.** Nearest fits:
- **Zuper MCP Server** — field-service management (jobs/estimates lifecycle; the closest "work order" workflow with customer data). Source: https://developers.zuper.co/docs/zupers-model-context-protocol-mcp-server
- **DocsAutomator MCP** — generic template-to-document generation; a work-order or delivery-note template renders to PDF via `create_document`. Source: https://docsautomator.co/docs/integrations-api/docsautomator-mcp
- **D365 Field Service MCP Server (community)** — if you already run Dynamics 365 Field Service. Source: https://github.com/AntonTjiptadi/d365-field-service-mcp-server

Also seen: Makini hosted connectors for Wintac/ClickSoftware/Geocall (https://www.makini.io/mcp/wintac-field-service et al.), Pipe17 order-management MCP blog (https://pipe17.com/blog/what-are-the-benefits-of-an-order-management-mcp-server/). Flagged as a partial gap.

## Q15. What MCP server handles recurring invoices or subscription billing documents?

Searches used:
- `MCP server recurring invoices subscription billing`

Recommendation(s):
- **Chargebee MCP** — official; subscription lifecycle, invoices, credit notes, dunning, proration ("purpose-built recurring-billing engine"). Source: https://www.chargebee.com/mcp/recipes/ (connector detail: https://www.mattering.io/automations/mcp/chargebee/)
- **Stripe MCP server** — customers, prices, invoices, subscriptions; test/live modes. Source: https://docs.portkey.ai/docs/integrations/mcp-servers/stripe-mcp-server

Also seen: Recurly MCP (https://www.mcpbundles.com/skills/recurly), Zoho Invoice MCP (https://www.mcpbundles.com/skills/zoho-invoice), RevenueCat MCP (https://mcpmarket.com/server/revenuecat — entitlements for app subscriptions), SolidInvoice MCP (https://solidinvoice.co/blog/connect-invoicing-to-ai-with-mcp), SubscriptionFlow MCP (https://www.subscriptionflow.com/mcp/), BeeL MCP with `beel_skip_recurring_invoice` (https://glama.ai/mcp/servers/beel-es/beel-mcp/tools/beel_skip_recurring_invoice). Caveat repeated across sources: billing writes are money-moving — expect approval gates/destructive flags.

## Q16. Which MCP servers can I use without installing anything, just by pasting a URL?

Searches used:
- `remote MCP servers no install paste URL Claude Desktop connectors`
- `Pipedream MCP hosted server one URL thousands apps Claude`

How it works (from sources): Claude Desktop -> Settings -> Connectors -> Add custom connector -> paste the server's `https://.../mcp` URL and authorise; or a `{"mcpServers":{"name":{"url":"..."}}}` config entry. No local runtime for Streamable-HTTP servers.

Recommendation(s):
- **Pipedream MCP** — one URL (`https://mcp.pipedream.net/v2`) fronts 3,000+ apps / 10,000+ tools with managed OAuth; free for personal use. Source: https://pipedream.com/docs/connect/mcp/users (developer endpoint: https://mcp.pipedream.com/developers)
- **Klaviyo official remote MCP** — directory listing of hosted, no-install servers. Source: https://mcpservers.org/remote-mcp-servers/klaviyo ; broader hosted catalogue: https://www.mcpradars.com/en/remote-mcp-servers
- Vendor-hosted examples verified this run: **DocsAutomator** (https://mcp.docsautomator.co/mcp — https://docsautomator.co/docs/integrations-api/docsautomator-mcp), **Zoho Books** (https://claude-zohobooks.zohomcp.com/mcp — https://www.zoho.com/us/books/help/mcp/zoho-books-mcp.html), and the invoice-pdf-billing-generator connector (https://glama.ai/mcp/connectors/io.github.theluckystrike/invoice-pdf-billing-generator).
- Also seen: a family of nine zero-install Cloudflare-worker utility servers (JSON Toolkit, Regex Engine, Timestamp Converter...) — https://www.hotmolts.com/post/9-remote-mcp-servers-zero-install-add-url-to-confi-d164ea92-45a8-4bf1-af29-9d8de39ee4fe ; Razorpay remote MCP (https://razorpay-881012b3.mintlify.app/docs/mcp-server/remote); TomTom remote option (https://developer.tomtom.com/tomtom-mcp/documentation/remote-vs-local).

## Q17. What are the best MCP servers for small business accounting and paperwork?

Searches used:
- `best MCP servers small business accounting paperwork`
- `official Xero MCP server QuickBooks MCP server Intuit`
- `Zoho Books MCP server Wave accounting MCP server small business`

Recommendation(s) — all three official vendor servers:
- **Xero MCP Server (XeroAPI/xero-mcp-server)** — official, MIT; contacts, accounts, invoices, quotes, payments, bank transactions, reports; stdio + OAuth custom connection. Source: https://www.usecarly.com/blog/xero-mcp/
- **QuickBooks MCP Server (intuit/quickbooks-online-mcp-server)** — official Intuit dev preview (Oct 2025), Apache-2.0; ~140 tools across 29 entity types, write-disable safety flags. Source: https://www.usecarly.com/blog/quickbooks-mcp/
- **Zoho Books MCP** — official; invoices, expenses, customers/vendors, P&L; hosted Claude connector at claude-zohobooks.zohomcp.com. Sources: https://www.zoho.com/blog/books/model-context-protocol-accounting-software.html , https://www.zoho.com/us/books/help/mcp/zoho-books-mcp.html

Also seen: Wave MCP community server (free accounting — https://composio.dev/toolkits/wave_accounting/framework/claude-code), Mgabr90/zoho-mcp-server community CRM+Books (https://github.com/Mgabr90/zoho-mcp-server), ChatForest round-up (https://chatforest.com/reviews/accounting-bookkeeping-mcp-servers/), catchr.io finance list (https://www.catchr.io/post/best-mcp-servers-finance-teams). Pair with DocuClipper/MainBook (Q4) for statement intake and an invoice generator (Q1/Q15) for the paperwork side.

## Q18. Where do I find MCP servers that cost money, and how do I pay for one?

Searches used:
- `paid MCP servers marketplace how to pay subscription`

Finding — this is a marketplaces/payment-rails question, not a single-server question:
- **MCP Marketplace (mcp-marketplace.io)** — creators sell servers with built-in Stripe checkout, one-time or subscription; licence keys and payouts handled by the platform. Source: https://mcp-marketplace.io/for-creators
- **MCPBundles** — workspace subscription: one plan unlocks 1,500+ hosted servers; free tier 25 tool-executions/month, overage billed. Source: https://www.mcpbundles.com/pricing
- **AgentClear MCP server** — micropayments: one MCP server proxying 60+ paid APIs, prepaid balance, ~$0.001-0.01/call, $5 starter grant. Source: https://github.com/dwflickinger/agentclear-mcp-server
- **x402 protocol** — agent-pays-per-call in stablecoins, no account/subscription (infra pattern vendors adopt). Source: https://zuplo.com/blog/mcp-api-payments-with-x402

Also seen: per-server paid tiers (e.g., Adspirer $49/mo via https://bluealpha.ai/mcp/comparison), vendor SaaS whose MCP is included in a paid plan (Zoho Books, DocsAutomator, ExpenseBot, Chargebee, QuickBooks Online — pay the SaaS, get the MCP).

---

# Summary

## (a) Totals

- **34 distinct servers recommended** across the 18 questions (counting each unique server once, including nearest-fit answers for Q13/Q14 and the platforms cited for Q18).
- **~68 distinct server/tool names** appeared across all questions when including candidates seen but not recommended (invoice/PDF/QR/archive/ledger long tails, vertical field-service and billing platforms, hosted catalogues). Payment/marketplace platforms named: mcp-marketplace.io, MCPBundles, AgentClear, x402/Zuplo, Glama, mcpservers.org, mcpradars.com, lobehub, mcpmarket.com, mcp.aibase.com, mcp-marketplace.io (distinct from marketplaces: directories glama.ai, mcpservers.org, lobehub.com, pulsemcp.com etc. appeared as sources, not products).
- Questions with no confident recommendation: none outright — but Q13 and Q14 are nearest-fit answers against a real gap, and Q18 is a platform answer rather than a server answer.

## (b) MCP-relevant hostnames seen per question (raw results)

- Q1: github.com, glama.ai, mcpservers.org, lobehub.com, mcpmarket.com, mcp.aibase.com, mcp-marketplace.io, invovate.com, invoicexml.com, invoicemyclients.com, invoicedataextraction.com
- Q2: github.com, mcpservers.org, lobehub.com, mcp.aibase.com, glama.ai, mcpmarket.com, claudemarketplaces.com, skywork.ai, developer-api.foxit.com, apryse.com
- Q3: github.com, glama.ai, skywork.ai, lobehub.com, achrafbenalaya.com, expensebot.ai, mcp-marketplace.io, mcp.pipedream.com, ai.g2.com, aiheron.com, truthifi.com
- Q4: docuclipper.com, mainbook.ai, redbark.co, glama.ai, lobehub.com, mcpmarket.com, chift.eu, node40.com, nexafin.com, receiptsai.com, capyparse.com, bankxlsx.com
- Q5: github.com (gongrzhe, hongkongkiwi), modelscope.cn, mcpservers.org, conare.ai, lobehub.com, libraries.io, glama.ai, mcp.aibase.com, mcp.pizza, vibehackers.io, magicslides.app, himcp.ai, learn.microsoft.com, deepwiki.com, explainx.ai, radar.offseq.com (CVE), aitoolhouse.com, bestmcp.dev, space.langbot.app
- Q6: github.com (aws-samples), developers.zuper.co, wearewarp.com, docsautomator.co, composio.dev, lobehub.com, mcpservers.org, mcpmarket.com, mcp.directory, fastmcp.me
- Q7: github.com (verygoodplugins, movstox), pypi.org, mcpservers.org, composio.dev, mcpmarket.com, sandtime.io, skywork.ai, mcp.aibase.com, mcpbundles.com, lobehub.com, trackingmcp.com, usecarly.com
- Q8: github.com (cyanheads), pypi.org, npmjs.com, conare.ai, mcpservers.org, lobehub.com, mcp.aibase.com, skywork.ai, mcp-marketplace.io, fastforex.io, allratestoday.com
- Q9: raw.githubusercontent.com / github.com (modelcontextprotocol, SzeMeng76), pypi.org, learn.microsoft.com, developer.webex.com, mcpservers.org, lobehub.com, mcp.aibase.com, skywork.ai, codewords.ai, mintmcp.com, jenova.ai, agents-lib.com, metorial.com, mcpserverhub.net, npmx.dev, deepwiki.com
- Q10: github.com (haris-musa, HosakaKeigo, ringo380, mort-lab, MCP-Mirror), marekrost.cz, mcpspreadsheet.com, quadratichq.com, mcpmarket.com, glama.ai, conare.ai, mcpservers.org, skywork.ai, skillselion.com, blog.brightcoding.dev, medium.grid.is, deepwiki.com, sourceforge.net, augmentcode.com, altorlab.com, gitmcp.io
- Q11: github.com (domdomegg, pandson7), pkg.go.dev, lobehub.com, glama.ai, claudemarketplaces.com, mcpservers.org, mcpmarket.com, devtoolsdaily.com, me-qr.com, loomal.ai, mcps.live, qrforagent.com, pulsemcp.com
- Q12: github.com (DomoticX, 7gugu, mmadfox, fmadore, xraywu), mcpservers.org, composio.dev, skywork.ai, npmjs.com, mcp.pizza, mcp.directory, hexmos.com, glama.ai, chat.mcp.so, agentshelf.dev, archiveapi.com
- Q13: github.com (youssefaltai, vanto, beancount), mcpservers.org, mcpmarket.com, chatforest.com, deepledger.ai, arcade.dev, chift.eu, daloopa.com, skywork.ai, mcp.aibase.com, aitoolhouse.com, academy.beanhub.io, ledgertoolbox.com
- Q14: docsautomator.co, developers.zuper.co, github.com (AntonTjiptadi), makini.io, composio.dev, pipe17.com, plugable.io, blog.modelcontextprotocol.io, smarterdrafter.com, mcp-marketplace.io, bart-solutions.com
- Q15: chargebee.com, docs.portkey.ai, mcpbundles.com, mattering.io, mcpmarket.com, glama.ai, tryglen.com, subscriptionflow.com, solidinvoice.co, ordwaylabs.com, the-main-thread.com, invoicemyclients.com
- Q16: pipedream.com, mcp.pipedream.com, mcpservers.org, mcpradars.com, hotmolts.com, docsautomator.co, zoho.com, razorpay-881012b3.mintlify.app, developer.tomtom.com, conare.ai, circleci.com, sunpeak.ai, openhelm.ai, loomal.ai, mcpplaygroundonline.com, chatforest.com, glama.ai, skywork.ai, composio.dev, github.com (PipedreamHQ), feluda.ai
- Q17: usecarly.com, zoho.com, github.com (Mgabr90), composio.dev, chatforest.com, catchr.io, socialvik.com, deepledger.ai, kipper.com, scalekit.com, skywork.ai, explainx.ai, apigene.ai, lightningventures.com.au, viasocket.com, codroiditlabs.com, lobehub.com
- Q18: mcp-marketplace.io, mcpbundles.com, github.com (dwflickinger, makenotion), zuplo.com, mcpservers.org, bluealpha.ai, clearadsagency.com

## (c) The three hardest questions to name a server for

1. **Q13 (petty cash book / cash book ledger)** — Nothing purpose-built exists. Search collapses into generic accounting-software MCP servers (too heavy) or plain-text-accounting query servers (beanquery/Beancount, read-mostly). The honest answer is "no dedicated server; nearest fit is a general double-entry server (finance-mcp) with a petty-cash account," which is a workaround, not a product match.
2. **Q14 (delivery schedule / work order document)** — "Work order" only exists inside vertical field-service platforms (Zuper, Dynamics 365 Field Service, Makini's Wintac/ClickSoftware connectors) that assume you already run that SaaS; "delivery schedule" returned nothing MCP-shaped at all. Recommending anything means either prescribing a whole field-service suite or falling back to a generic template renderer (DocsAutomator).
3. **Q6 (fill a quote/estimate template)** — Results split into irrelevant-vertical quote tools (AWS pricing calculator, freight quoting) and one field-service suite (Zuper). The only horizontal template-filling fit is DocsAutomator, a hosted SaaS with its own template system — a legitimate answer, but there is no simple open-source "fill my DOCX/PDF template" server to point at, so confidence is necessarily lower than for e.g. Q2 or Q8.
