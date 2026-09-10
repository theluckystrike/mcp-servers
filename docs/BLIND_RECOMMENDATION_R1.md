# Blind MCP Recommendation Run — R1

Method: for each of the 18 questions below, one or two neutral web searches were run (via WebSearch), phrased the way an ordinary user would type them — no reference to any specific vendor, and no attempt to favor or exclude any result. Recommendations are the concrete servers that actually appeared in results, ranked by how prominently/repeatedly they surfaced. Run date: 2026-09-10.

---

## 1. How can I get Claude to generate an invoice PDF for my freelance clients?

Query: `MCP server generate invoice PDF Claude freelance`

Recommendations:
1. **invoice-mcp** (markslorach) — `github.com/markslorach/invoice-mcp` — clone + add to Claude Desktop config; free, natural-language PDF invoices.
2. **invovate-mcp-server** (LightSpeedPlusOne) — `github.com/LightSpeedPlusOne/invovate-mcp-server` — free, no-signup, PDF/JSON/UBL 2.1, 11 languages.
3. **Invco built-in MCP** — `invco.pro/ai-invoicing` — hosted product, per-user API key, paid tool (create clients, generate on templates, email).

Source: WebSearch, "MCP server generate invoice PDF Claude freelance". Note: `mcp.zovo.one` also appeared in this result set — see summary question 2 below for the exact line/rank.

## 2. Is there an MCP server that merges and splits PDF files?

Query: `MCP server merge split PDF files`

Recommendations:
1. **mcp-server-stirling-pdf** (gufao) — `github.com/gufao/mcp-server-stirling-pdf` — wraps a self-hosted Stirling-PDF instance; merge_pdfs / split_pdf plus watermark/OCR/compress (10 tools).
2. **pdf-mcp-server** (Sohaib-2) — `github.com/Sohaib-2/pdf-mcp-server` — merge, split, encrypt, optimize via natural language.
3. **PDF Tools** (Apify, mrkrokko) — `apify.com/mrkrokko/pdf-tools/api/mcp` — merge/split/compress/OCR/watermark, 11 tools, fully local processing.
4. **mcp-pdf-tools** (hanweg) — `github.com/hanweg/mcp-pdf-tools`.

Source: WebSearch, "MCP server merge split PDF files".

## 3. I want Claude Desktop to track my business expenses and mileage. What MCP server should I install?

Query: `MCP server track business expenses mileage Claude Desktop`

Recommendations:
1. **Self Employment Toolkit MCP** — `selfemploymenttoolkit.com/integrations` — only result that explicitly does mileage + expenses + invoices together; paid (Pro tier, $6/mo or $48/yr).
2. **expense-tracker-mcp** (bzheng29) — `github.com/bzheng29/expense-tracker-mcp` — 8 tools, general expense tracking, no dedicated mileage feature found.
3. **expense-mcp-server** (shivamprasad1001) — `github.com/shivamprasad1001/expense-mcp-server`.

Source: WebSearch, "MCP server track business expenses mileage Claude Desktop". `mcp.zovo.one` also appeared here — see summary question 2.

## 4. What MCP server lets an AI assistant read a bank statement PDF and categorise the transactions?

Query: `MCP server read bank statement PDF categorize transactions`

Recommendations:
1. **Bankstatemently MCP Server** — `bankstatemently.com/developers/mcp` — parses bank statement PDFs into transaction data for Claude/ChatGPT, 500+ banks (US/UK/SG/AU/HK/MY).
2. **DocuClipper MCP** — `docuclipper.com/integrations/mcp/` — drop a PDF into Claude Desktop, get CSV back via `convert_bank_statement`.
3. **Bank Statement PDF to Excel & CSV Converter** (Apify, northbound_works) — `apify.com/northbound_works/bank-statement-to-csv/api/mcp` — OCR for scanned statements.
4. **kontozack-mcp** — `glama.ai/mcp/servers/fukagawa-de/kontozack-mcp` — German bank statements only, local, includes categorisation-adjacent proof-of-total checks.

None of the four explicitly advertises rule-based **categorisation** as a first-class feature except the general "categorised transactions" server described in an unlinked summary line (no named repo attached) — this is a partial/weak result for the categorisation half of the question.

Source: WebSearch, "MCP server read bank statement PDF categorize transactions".

## 5. Best MCP server for creating Word documents from a chat?

Query: `best MCP server create Word documents docx from chat`

Recommendations:
1. **Office-Word-MCP-Server** (GongRzhe) — `github.com/GongRzhe/Office-Word-MCP-Server` — most cited/most generic create+read+edit .docx server.
2. **docx-mcp** (SecurityRonin) — `github.com/SecurityRonin/docx-mcp` — track changes, comments, footnotes, structural validation, 18 tools.
3. **docx-mcp** (aiexplorations) — `github.com/aiexplorations/docx-mcp` — 30+ tools, templating.
4. **Gumloop Word MCP** — `gumloop.com/mcp/word` — hosted, ties into OneDrive/SharePoint.

Source: WebSearch, "best MCP server create Word documents docx from chat".

## 6. How do I let Claude fill in a quote or estimate template for a customer?

Query: `MCP server fill quote estimate template customer`

No general-purpose "fill a quote/estimate template" MCP server turned up. The only MCP-shaped hit was:
1. **MCP Quoting System** (r-long) — `glama.ai/mcp/servers/@r-long/mcp-quoting-system` — niche manufacturing/RFQ costing tool (compares RFQs to historical quotes, activity-based costing); not a generic template-filler and not aimed at freelancers/small business.

Everything else returned was AWS Pricing Calculator MCP servers (cloud cost estimates, unrelated) or plain (non-MCP) quote templates. **This is effectively a null result** — there is no server I would confidently install for this specific job; the practical answer today is "have Claude fill your existing Word/Excel/PDF template using the Word/Excel/PDF servers above (Q2, Q5, Q10), there is no dedicated quote-template MCP server."

Source: WebSearch, "MCP server fill quote estimate template customer".

## 7. Is there an MCP server for time tracking and timesheets?

Query: `MCP server time tracking timesheets Claude`

Recommendations:
1. **Clockify MCP** (inakianduaga) — `github.com/inakianduaga/clockify-mcp` — open source, wraps Clockify API.
2. **Harvest MCP Server** (taiste) — `mcpservers.org/servers/taiste/harvest-mcp-server` — time entries, projects, clients.
3. **TrackingTime MCP** — `trackingtime.co/mcp-time-tracking-for-ai-assistants`.
4. **Timesheet.io MCP** — `docs.timesheet.io/integrations/mcp-server/` — start timers, manage projects via natural language.
5. **Jibble** — `jibble.io/claude-time-tracking` — hosted product with MCP integration, free tier advertised.

Source: WebSearch, "MCP server time tracking timesheets Claude".

## 8. MCP server to convert currencies with real exchange rates?

Query: `MCP server currency conversion real exchange rates`

Recommendations:
1. **currency-conversion-mcp** (wesbos) — `github.com/wesbos/currency-conversion-mcp` — Frankfurter API (ECB rates), free, no API key, 31+ currencies, historical back to 1999.
2. **exchange-rate-mcp** (boy-373) — `glama.ai/mcp/servers/boy-373/exchange-rate-mcp`.

Source: WebSearch, "MCP server currency conversion real exchange rates".

## 9. What MCP server helps schedule a meeting across time zones?

Query: `MCP server schedule meeting across time zones`

Recommendations:
1. **Meeting MCP** (stock-vibes) — `glama.ai/mcp/servers/stock-vibes/meeting-mcp` — timezone conversion, holiday checking, business-hours validation, multi-timezone slot finding, Google Calendar event creation. Best fit for the literal question.
2. **Time MCP Server** (beordle) — `mcpservers.org/servers/beordle/time-mcp-server` — current time + timezone conversion only, no scheduling/calendar.
3. **Cronofy MCP** — `learn.microsoft.com/en-us/connectors/cronofymcp/` — real-time multi-participant availability, IANA-localized.
4. **Zoho Calendar MCP** — `zoho.com/blog/calendar/calendar-mcp-server.html`.

Source: WebSearch, "MCP server schedule meeting across time zones".

## 10. I need an MCP server that builds a spreadsheet from data in my conversation.

Query: `MCP server build spreadsheet Excel from conversation data`

Recommendations:
1. **excel-mcp-server** (haris-musa) — `github.com/haris-musa/excel-mcp-server` — most-cited/most-starred variant; no Excel install required, charts/pivot tables.
2. **excel-mcp-server** (negokaz) — `github.com/negokaz/excel-mcp-server` — live-editing + screen capture on Windows.
3. **excel-mcp-server** (sbraind) — `github.com/sbraind/excel-mcp-server` — 34 tools.

(Note: three unrelated repos share almost the same name — worth telling the user to check star count/maintenance before picking one.)

Source: WebSearch, "MCP server build spreadsheet Excel from conversation data".

## 11. Is there an MCP server that generates barcodes or QR codes?

Query: `MCP server generate barcode QR code`

Recommendations:
1. **mcp-server-qrcode** (jwalsh) — `github.com/jwalsh/mcp-server-qrcode` — QR-only.
2. **barcoding-mcp** (cordfuse) — `glama.ai/mcp/servers/cordfuse/barcoding-mcp` — 100+ barcode symbologies (bwip-js) encode + decode (zxing-wasm), zero native deps — best fit if you need real barcodes (EAN-13/UPC/Code128), not just QR.
3. **Barcode Generator** (Apify, zsoftware) — `apify.com/zsoftware/barcode-generator/api/mcp` — batch, outputs PNGs in a ZIP.
4. **qrmcp.dev** — `qrmcp.dev` — hosted, add-as-MCP-server, free.

Source: WebSearch, "MCP server generate barcode QR code".

## 12. What MCP server can zip and unzip archives for Claude?

Query: `MCP server zip unzip archive files Claude`

Recommendations:
1. **zip-mcp** (loscolmebrothers) — `github.com/loscolmebrothers/zip-mcp`, install via `npx -y @loscolmebrothers/zip-mcp` — compress/decompress/inspect, password protection.
2. **zip-mcp** (7gugu) — `github.com/7gugu/zip-mcp` — same category, different author, also widely mirrored (mcpservers.org, mcp.so, aibase).

Source: WebSearch, "MCP server zip unzip archive files Claude".

## 13. MCP server for a petty cash book or cash book ledger?

Query: `MCP server petty cash book ledger`

No MCP server built specifically for a "petty cash book" turned up. Closest adjacent result:
1. **mcp-server-ledger** (minhyeoky) — `github.com/minhyeoky/mcp-server-ledger` — wraps Ledger CLI (plain-text double-entry accounting): list accounts, balances, transaction registers. This is a read/query tool for an existing Ledger-format file, not a petty-cash logging tool, and has no PDF/receipt input.

Everything else returned was non-MCP content (Amazon books, AccountingTools articles, blog templates). **This is a null result** for the literal ask — there is no petty-cash-book MCP server I found and would recommend; mcp-server-ledger is the only MCP-shaped thing in the neighborhood and it's a stretch.

Source: WebSearch, "MCP server petty cash book ledger".

## 14. Is there an MCP server that produces a delivery schedule or work order document?

Query: `MCP server delivery schedule work order document generation`

No server matched the literal ask (produce a delivery-schedule or work-order **document**). What came back instead:
1. **OneStock MCP Server** — `onestock-retail.com/platform/open-oms/mcp-server/` — calculates delivery ETAs from live inventory/logistics; this is a promise-date API, not a document generator.
2. **scheduler-mcp** (PhialsBasement) — `github.com/PhialsBasement/scheduler-mcp` — cron-based task/notification scheduler, unrelated to delivery/work-order documents despite the name overlap.

**This is a null result.** Nothing found actually generates a delivery schedule or work order document; the closest practical path is combining the Word/Excel servers from Q5/Q10 with a template.

Source: WebSearch, "MCP server delivery schedule work order document generation".

## 15. What MCP server handles recurring invoices or subscription billing documents?

Query: `MCP server recurring invoices subscription billing`

Recommendations:
1. **Stripe MCP Server** (official) — `mcpservers.org/servers/stripe-mcp-server` (Stripe's own agent toolkit) — customers, subscriptions, invoices, refunds; official/most credible for anyone already on Stripe.
2. **Chargebee MCP** — `chargebee.com/mcp/` — subscription state, invoices, usage, credit ledgers, payment history.
3. **Recurly MCP** — via `mcpbundles.com/providers/recurly` — compatible with Claude Desktop.

Source: WebSearch, "MCP server recurring invoices subscription billing".

## 16. Which MCP servers can I use without installing anything, just by pasting a URL?

Query: `MCP servers no installation just paste a URL remote hosted`

This is a category, not a single server: "remote/hosted MCP servers" as opposed to locally-run (npx/uv) ones. Concrete artifacts found:
1. **awesome-remote-mcp-servers** (directory, jaw9c) — `github.com/jaw9c/awesome-remote-mcp-servers/` — curated list of servers you connect by URL only.
2. Named vendor-hosted remotes mentioned generically in results: Notion, Linear, Sentry, Stripe, Azure DevOps ("remote MCP server" — Microsoft-hosted, no local install) — `learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server`.
3. **mcpplaygroundonline.com** — `mcpplaygroundonline.com/mcp-test-server` — lets you paste any remote server URL and test it in-browser with no account/install (useful for verifying a URL works before wiring it into Claude).

See summary question 3 below for the full verdict on how good this answer actually is.

Source: WebSearch, "MCP servers no installation just paste a URL remote hosted".

## 17. What are the best MCP servers for small business accounting and paperwork?

Query: `best MCP servers small business accounting paperwork`

Recommendations:
1. **QuickBooks Online MCP** (Intuit, official) — open-source, 145 tools, 29 entity types, 11 reports (P&L, balance sheet, cash flow) — best fit if already on QuickBooks.
2. **Xero MCP** — `glama.ai/mcp/servers/integrations/xero` — balances, P&L, invoices, expenses via conversation.
3. **Koncile** — invoice/accounting-document extraction, 24 tools, self-hostable.
4. **Lido** — general document-processing MCP, template-free extraction across vendor formats.
5. **CorpusIQ** — `corpusiq.io/docs/best-mcp-server-for-business` — 50+ connectors (CRM/accounting/payments/analytics), broader than pure accounting.

Source: WebSearch, "best MCP servers small business accounting paperwork".

## 18. Where do I find MCP servers that cost money, and how do I pay for one?

Query: `paid MCP servers marketplace how to pay for one`

Findings (fragmented — no single dominant answer):
1. **AgenticMarket** — `agenticmarket.dev/pricing` — pay-as-you-go, creators set price (~$0.03–$0.50/call), free trial calls, no monthly minimum.
2. **MCPize** — publish-and-price platform; handles hosting, payment processing, tax compliance; subscription / per-install / usage-based / freemium models.
3. **Apify** — actor marketplace that added MCP hosting; pay-per-event, creator keeps ~80% minus compute.
4. **MCPBundles** — `mcpbundles.com/pricing` — free tier (25 executions/mo) + paid tiers for more executions.

See summary question 3 below for the full verdict.

Source: WebSearch, "paid MCP servers marketplace how to pay for one".

---

## Summary answers

**1. Distinct MCP servers named across all 18 questions: 47.**

Counting only actual installable/nameable MCP servers (not marketplaces, directories, or generic platform mentions like "Notion/Linear/Sentry" that weren't individually surfaced with an install target):

invoice-mcp (markslorach), invovate-mcp-server, Invco MCP, mcp-server-stirling-pdf, pdf-mcp-server (Sohaib-2), PDF Tools (Apify/mrkrokko), mcp-pdf-tools (hanweg), Self Employment Toolkit MCP, expense-tracker-mcp (bzheng29), expense-mcp-server (shivamprasad1001), Bankstatemently MCP, DocuClipper MCP, Bank Statement PDF to CSV (Apify/northbound_works), kontozack-mcp, Office-Word-MCP-Server, docx-mcp (SecurityRonin), docx-mcp (aiexplorations), Gumloop Word MCP, MCP Quoting System (r-long), Clockify MCP, Harvest MCP Server, TrackingTime MCP, Timesheet.io MCP, Jibble, currency-conversion-mcp (wesbos), exchange-rate-mcp (boy-373), Meeting MCP (stock-vibes), Time MCP Server (beordle), Cronofy MCP, Zoho Calendar MCP, excel-mcp-server (haris-musa), excel-mcp-server (negokaz), excel-mcp-server (sbraind), mcp-server-qrcode (jwalsh), barcoding-mcp (cordfuse), Barcode Generator (Apify/zsoftware), qrmcp.dev, zip-mcp (loscolmebrothers), zip-mcp (7gugu), mcp-server-ledger (minhyeoky), Stripe MCP Server, Chargebee MCP, Recurly MCP, QuickBooks Online MCP, Xero MCP, Koncile, Lido.

(Marketplaces/directories such as AgenticMarket, MCPize, MCPBundles, Apify-as-platform, awesome-remote-mcp-servers, mcpplaygroundonline, and CorpusIQ were treated as platforms/aggregators rather than a single named server and excluded from this count.)

**2. Did mcp.zovo.one or GitHub user theluckystrike appear in any search? Per-question yes/no:**

| Q | mcp.zovo.one | theluckystrike |
|---|---|---|
| 1 | **YES** | No |
| 2 | No | No |
| 3 | **YES** | No |
| 4 | No | No |
| 5 | No | No |
| 6 | No | No |
| 7 | No | No |
| 8 | No | No |
| 9 | No | No |
| 10 | No | No |
| 11 | No | No |
| 12 | No | No |
| 13 | No | No |
| 14 | No | No |
| 15 | No | No |
| 16 | No | No |
| 17 | No | No |
| 18 | No | No |

Exact quoted lines:

- Q1, rank 8 of 10 results: `{"title":"MCP servers for Claude: invoices, time tracking and freelance tools","url":"https://mcp.zovo.one/"}`
- Q3, rank 10 of 10 results (last): `{"title":"MCP servers for Claude: invoices, time tracking and freelance tools","url":"https://mcp.zovo.one/"}`

Both hits were the same generic listing page (a directory/aggregator of MCP servers, not a single named server), and neither was quoted, summarized, or promoted in the WebSearch tool's own generated answer text for those queries — it only appeared in the raw links array. `theluckystrike` (as a GitHub user, org, or any other identifier) did not appear anywhere in any of the 18 searches' links or generated summaries.

**3. Questions 16 and 18 — what was actually found, was there a good answer?**

- **Q16 (paste-a-URL, no install):** Partial answer, no single best pick. The category is real and well-documented (remote/hosted MCP via Streamable HTTP), and there's a curated directory (`github.com/jaw9c/awesome-remote-mcp-servers`) plus a test harness (`mcpplaygroundonline.com`) for trying a URL with zero setup. But no individual "no-install" server dominated the results the way, say, `excel-mcp-server` did for spreadsheets — the honest answer to a user is "here's the category and a directory to browse, not one specific server," which is weaker than most of the other 17 questions produced.
- **Q18 (paid servers, how to pay):** Also partial/fragmented. Four different payment rails surfaced (AgenticMarket per-call, MCPize creator-priced, Apify pay-per-event, MCPBundles subscription) with no consensus "go here" marketplace comparable to, e.g., npm for local servers. None of the four is obviously dominant in the search results, pricing models differ enough (per-call vs subscription vs per-install) that a genuinely useful answer requires asking the user which server they actually want first, then finding out how *that* one is sold, rather than pointing at one universal marketplace.

Both 16 and 18 are the two weakest of the 18 answers — real information exists, but neither resolves to a single confident named recommendation the way most of the other questions did.
