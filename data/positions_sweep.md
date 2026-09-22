# Long-Tail Keyword + Content Positioning Sweep

**Estate:** mcp.zovo.one — 47 business/admin MCP servers (invoice, expense-tracker, time-tracker, kanban, pdf, docx, purchase-requisition, delivery-schedule, dunning-letters, etc.). Free. Hosted + local-first. Zero organic search traffic currently.

**Method:** Web-search demand signals (SERP richness, dedicated pages vs GitHub lists, big SaaS players) + estate fit. Aligns with estate strategy in CLAUDE.md: *"stop fighting contested queries, keep winning small-field ones, and make more uncontested questions exist."*

**STATUS: complete**

---

## Summary of findings

- **Contested fields to NOT lead with** (dedicated product pages + big SaaS everywhere): invoice (markslorach/invoice-mcp, SolidInvoice, invoicemyclients, YouTube), expense-tracker (Ramp MCP, bzheng29, OpenBudget), pdf (296 servers on PulseMCP), time-tracker (TrackingTime, Timesheet.io, WebWork 120-tool), docx (MeterLong, GongRzhe, Microsoft Copilot), kanban (bradrisse, Notion, Pipedream), bank-statement (OpenBudget, Bankstatemently, bank MCPs).
- **Winnable fields** (few or zero dedicated MCP product pages; competition is generic blogs, enterprise docs, or GitHub lists): **petty-cash, per-diem, dunning-letters, mileage-log, credit-note, delivery-schedule, purchase-requisition, statement-of-account, service-agreement, packing-list, cash-book, quotes, resume**.
- The 15-20 queries below are ranked by (demand x winnability). Each winnable query maps to an existing estate server — no new builds needed.

---

## Ranking (demand x winnability)

| # | Query | Server | Demand | Winnability | Difficulty signal |
|---|-------|--------|--------|-------------|-------------------|
| 1 | MCP server petty cash (imprest) | petty-cash | Med | **Very high** | No dedicated competitor page; only our mcpservers.org/ahel/claudemcp/github listings |
| 2 | MCP server per diem calculator | per-diem | Med | **Very high** | Only our mcpservers listing; competitors are generic GSA/travel blogs, not MCP pages |
| 3 | MCP server chase overdue invoices / dunning letters | dunning-letters | **High** | High | mcpmarket + our glama + SolidInvoice blog; no dominant product page |
| 4 | MCP server track deductible mileage | mileage-log | Med-High | **Very high** | Only our github; competitors are IRS/Ramp blogs, not MCP servers |
| 5 | MCP server credit note / credit memo refund | credit-note | Med-High | High | mcpmarket + our glama + Upmind; no dominant page |
| 6 | MCP server purchase requisition approval | purchase-requisition | Med | High | Competitors are enterprise docs (ServiceNow, Dynamics); no small-biz MCP page |
| 7 | MCP server statement of account | statement-of-account | Med | High | Competitors are accounting platforms (QuickBooks, Lili, DeepLedger); no dedicated page |
| 8 | MCP server delivery schedule | delivery-schedule | Med | High | Competitors are Shopify/order-MCP + generic "build an MCP"; no small-biz delivery-schedule page |
| 9 | MCP server service agreement / contract | service-agreement | Med | High | Our glama + propper.ai + contracts counsel; no dominant page |
| 10 | MCP server packing list | packing-list | Med | High | Our glama tool page; competitors are Easyship/Shopify shipping, not packing-list MCP |
| 11 | MCP server cash book | cash-book | Low-Med | **Very high** | Only our listings; effectively uncontested |
| 12 | MCP server quotes / proposals | quotes | Med | Med-High | Composio + Reddit; fragmented |
| 13 | MCP server resume builder | resume | Med | Med | resumake discontinued; Reactive Resume; fragmented |
| 14 | MCP server bill of sale | bill-of-sale | Low-Med | High | Uncontested niche |
| 15 | MCP server goods receipt | goods-receipt | Low-Med | High | Enterprise docs only; no dedicated MCP page |
| 16 | MCP server change order | change-order | Low-Med | High | Uncontested niche |
| 17 | MCP server work order / job card | work-order | Med | Med-High | Fragmented; some enterprise |
| 18 | MCP server timezone conversion for scheduling | timezone | Med | Med-High | Generic tools, no dedicated MCP page |
| 19 | MCP server bank statement parsing | bank-statement | Med | Med | OpenBudget/Bankstatemently contested — secondary |
| 20 | MCP server invoice PDF generation | invoice + pdf | **High** | Low | Heavily contested (markslorach, SolidInvoice, 296 PDF servers) — avoid as primary |

---

## Top 8 — Page Title + H1 + 3-bullet content outline

### 1. petty-cash → "MCP server petty cash"
- **Page title:** `Petty Cash MCP Server — Imprest Float, Vouchers & Replenishment for Claude`
- **H1:** `Petty Cash MCP Server: Run the Imprest System from Your AI Assistant`
- **Bullets:**
  - Issue and reconcile petty-cash vouchers on the imprest system, with the float balanced to the minor currency unit.
  - Track the float, approve replenishment, and export a clean audit trail — no spreadsheet, all from a chat prompt.
  - Free and local-first: connect to Claude/Cursor/VS Code in minutes at mcp.zovo.one.

### 2. per-diem → "MCP server per diem calculator"
- **Page title:** `Per Diem MCP Server — Travel Allowance by City & Role for Finance Agents`
- **H1:** `Per Diem MCP Server: Calculate Travel Allowances Automatically`
- **Bullets:**
  - Compute per-diem and travel allowances by city and role, so finance agents stop hand-lookup of rates.
  - Generate compliant expense claims and per-diem reports directly from a chat conversation.
  - Local-first and free: keep travel data private, connect to any MCP client.

### 3. dunning-letters → "MCP server chase overdue invoices"
- **Page title:** `Dunning Letters MCP Server — Automate Overdue Invoice Reminders & Collections`
- **H1:** `Dunning Letters MCP Server: Chase Overdue Invoices on a Ladder`
- **Bullets:**
  - Escalate reminder → final notice → aging notices automatically, anchored to a dunning ladder.
  - Chase overdue invoices for multiple clients without manual follow-up emails or spreadsheets.
  - Free MCP server for Claude/Cursor/VS Code; connect in minutes and recover cash faster.

### 4. mileage-log → "MCP server track deductible mileage"
- **Page title:** `Mileage Log MCP Server — Track Deductible Driving & Export for Tax`
- **H1:** `Mileage Log MCP Server: Track Deductible Mileage from Chat`
- **Bullets:**
  - Log trips with effective-dated IRS rates, so deductible driving is captured in real time.
  - Summarize mileage, split business vs personal, and export a CSV ready for tax time.
  - Free and local-first — your driving data never leaves your machine.

### 5. credit-note → "MCP server credit note / credit memo"
- **Page title:** `Credit Note MCP Server — Issue Credit Memos & Refunds for Small Business`
- **H1:** `Credit Note MCP Server: Issue Credit Memos from Your AI Assistant`
- **Bullets:**
  - Create and manage credit notes by recipient, reason, status, issue date and total.
  - Track credit memos and refunds against invoices so books stay balanced in chat.
  - Free MCP server for freelancers and small business; connect to Claude in minutes.

### 6. purchase-requisition → "MCP server purchase requisition approval"
- **Page title:** `Purchase Requisition MCP Server — Approval Workflow for Small Business`
- **H1:** `Purchase Requisition MCP Server: Approve & Track Purchases in Chat`
- **Bullets:**
  - Raise, route and approve purchase requisitions without an enterprise ERP.
  - Keep an audit trail of approvals and spend so nothing slips through.
  - Free and local-first — built for small business, not ServiceNow-scale procurement.

### 7. statement-of-account → "MCP server statement of account"
- **Page title:** `Statement of Account MCP Server — Client Balances & Aging for Freelancers`
- **H1:** `Statement of Account MCP Server: Client Balances at a Glance`
- **Bullets:**
  - Generate per-client statements of account showing invoices, payments and running balance.
  - Pull aging and outstanding balances into a chat prompt for quick client follow-up.
  - Free MCP server for freelancers and small business; connect and reconcile in minutes.

### 8. delivery-schedule → "MCP server delivery schedule"
- **Page title:** `Delivery Schedule MCP Server — Track Shipments & Delivery Dates in Chat`
- **H1:** `Delivery Schedule MCP Server: Keep Deliveries on Time from Your AI Assistant`
- **Bullets:**
  - Maintain a delivery schedule across orders and consignees, with dates and status in one place.
  - Query expected deliveries and flag slips before they become customer complaints.
  - Free and local-first — no heavy logistics platform needed for small-business dispatch.

---

## Evidence log

- Iteration 1: created file; surfaced estate server list (47 servers) and CLAUDE.md strategic guidance (win uncontested small fields).
- Iterations 2-4: 30 web searches across all target themes. Recorded difficulty signals per query (SERP composition: dedicated product pages vs GitHub lists vs generic blogs vs enterprise docs).
- Key demand/difficulty observations:
  - Invoice/expense/pdf/time/docx/kanban are contested (dedicated SaaS + product pages + 296 PDF servers on PulseMCP).
  - petty-cash, per-diem, mileage-log, cash-book, bill-of-sale, goods-receipt, change-order show effectively zero dedicated MCP competitor pages — only our own listings + generic blogs. Highest winnability.
  - dunning-letters, credit-note, statement-of-account, purchase-requisition, delivery-schedule, service-agreement, packing-list compete mainly against enterprise docs or adjacent SaaS blogs, not dedicated MCP product pages.
- Recommendation: publish one positioning page per top-8 server targeting its exact long-tail query; lead with the uncontested fields; do not spend primary effort on invoice/pdf/expense/time/docx/kanban.

**STATUS: complete**