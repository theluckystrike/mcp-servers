// Comparison pages served at /compare and /compare/<our-server>.
// Every competitor fact in these tables was read from that project's public README,
// its GitHub repository metadata, its npm registry record or its official MCP registry
// entry on 2026-09-03. Source URLs are listed in docs/COMPARE_RESULT.md.
// Shape: COMPARE[slug] = { title, description, h1, competitors:[...], rows:[[label, ours, a, b]], html, faq }.

export const COMPARE_INDEX = {
  title: "MCP server comparisons: ours against the closest alternatives",
  description: "Five honest side-by-side pages. Tool counts, licences, hosting model and where your data lives, read from each project's own README and registry entry.",
};

const t = (rows) =>
  `<table>\n<thead><tr><th>Fact</th><th>Ours</th><th>${rows.head[0]}</th><th>${rows.head[1]}</th></tr></thead>\n<tbody>\n` +
  rows.body.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("\n") +
  `\n</tbody>\n</table>`;

export const COMPARE = {
  "time-tracker": {
    title: "MCP Time Tracker vs clockify-mcp and timesheet-mcp: which MCP server to pick",
    description: "Local JSON timer against two MCP servers that front a time tracking SaaS. Tool counts, licences, accounts required and where the hours are stored.",
    html: `<h1>MCP Time Tracker vs clockify-mcp and timesheet-mcp: which MCP server to pick</h1>
<p>All three let you say "start a timer for Acme" in Claude Code or Cursor. The difference is what
sits behind the tool call. <a href="https://github.com/tracegazer/clockify-mcp">clockify-mcp</a> and
<a href="https://github.com/timesheetIO/timesheet-mcp">timesheet-mcp</a> are clients for an existing
time tracking service, so the hours land in that account. Ours writes JSON files under your home
directory and never opens a socket. If you already pay for Clockify or timesheet.io, that is a real
reason to pick theirs, and this page says so plainly.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["clockify-mcp", "timesheet-mcp"], body: [
  ["Tools", "11 plus license_status and license_activate", "112 across 18 domains (48 read-only by default)", "18"],
  ["Transport", "stdio, plus a hosted streamable HTTP endpoint", "stdio (pip, uvx, Docker, .mcpb bundle)", "stdio (npx)"],
  ["Account or API key needed", "No. No account, no key", "Yes, CLOCKIFY_API_KEY", "Yes, TIMESHEET_API_TOKEN"],
  ["Where the hours live", "Local JSON in ~/.local/share/mcp-servers/time-tracker/", "Clockify workspace", "timesheet.io account"],
  ["Licence", "MIT", "MIT", "MIT"],
  ["Latest release read", "0.2.3 on the MCP registry", "v0.3.2, 2026-06-09", "npm @timesheet/mcp 1.2.0, 2026-06-13"],
  ["Cost of the server", "Free tier, Pro $19 once", "Free, some tools need a paid Clockify plan", "Free, needs a timesheet.io account"],
  ["Works with no network", "Yes", "No", "No"],
] })}

<h2>When to pick clockify-mcp</h2>
<p>Pick it when your team already runs Clockify. It exposes 112 tools across workspaces, users,
groups, clients, projects, tasks, tags, time entries, reports, shared reports, time off, holidays,
expenses, approvals, custom fields, scheduling, invoices and webhooks. Nothing we ship touches team
approvals, time off balances or scheduling, and we do not intend to. It also ships a one click
<code>.mcpb</code> bundle for Claude Desktop and a container image. Its README states that the time
off, holidays, expenses, approvals, custom fields, scheduling, invoice and webhook tools return 402,
403 or 404 on Clockify plans that do not include those add-ons, so check your plan first.</p>

<h2>When to pick timesheet-mcp</h2>
<p>Pick it if you use timesheet.io on a phone and want the same entries reachable from chat. It is the
official server for that API, it covers pause and resume of a running task (we have no pause), and it
can attach expenses and notes to the task that is running. Eighteen tools, MIT, one npx line plus an
API token.</p>

<h2>When to pick ours</h2>
<p>Pick ours when you do not want a time tracking account at all. There is nothing to sign up for and
no key to paste: install it and the first timer works. Client work under an NDA never leaves the
machine, and the server keeps working on a plane. The parts we spent effort on are the arithmetic and
the handoff to billing: hours are stored as seconds and money as integer minor units, the amount is
computed in one rounding step, and <code>invoice_summary</code> turns a project's tracked time into
invoice lines that the <a href="/s/invoice">invoice server</a> takes as input. Currency is per entry,
so "90 euros an hour" stores EUR.</p>

<h2>What we measured</h2>
<p>The time-tracker package carries 7 automated tests, all passing, covering the stdio protocol
handshake, currency parsing and two concurrent writers. Across the five servers the suites total 144
tests. A separate scripts/validate.mjs probe suite runs 121 checks against a fresh data directory and
is at 121 of 121. In user value round 5, ten fresh scenarios were driven through the real Claude CLI
with no tool names mentioned; the suite scored 26 of 30, and the three time-tracker scenarios scored 9
of 9. Two defects that round 5 and earlier rounds found in this server, a dropped currency and a
project name that split in two, are fixed in the shipped build.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add time-tracker -- npx -y @theluckystrike/mcp-time-tracker</code></pre>
<p>clockify-mcp:</p>
<pre><code>pip install clockify-mcp
claude mcp add clockify -e CLOCKIFY_API_KEY=your-key -- clockify-mcp</code></pre>
<p>timesheet-mcp:</p>
<pre><code>claude mcp add timesheet -e TIMESHEET_API_TOKEN=your-token -- npx -y @timesheet/mcp</code></pre>
<p>Exact config file paths per client are on the <a href="/setup">setup pages</a>, and the longer
walkthrough is in <a href="/guides/track-time-in-claude-code">tracking billable hours in Claude Code</a>.</p>`,
    faq: [
      { q: "Can I run the time tracker and clockify-mcp at the same time?", a: "Yes. MCP clients load several servers at once and the tool names do not collide: ours are timer_start, entry_add and report, the Clockify server uses create_time_entry and generate_summary_report. Nothing is shared between them, so the same hour logged in both is logged twice." },
      { q: "Does your server sync to Clockify or Toggl?", a: "No. It has no network code at all. The export path is export_csv, which writes a CSV you can import elsewhere, and invoice_summary, which produces invoice lines." },
      { q: "Which one has more tools?", a: "clockify-mcp, by a wide margin: 112 tools across 18 domains against our 11 plus two licence tools. Tool count is not the same as coverage of what one freelancer needs, but if you want approvals, time off and scheduling, that server has them and we do not." },
      { q: "What does each cost?", a: "clockify-mcp and timesheet-mcp are MIT licensed and free; the services behind them need an account, and the Clockify README notes that several tool groups need a paid Clockify plan. Ours has a free tier with a 7 day reporting window, and Pro is $19 once with no subscription." },
      { q: "Where can I read the competitor facts myself?", a: "Every row comes from the project's own README, its GitHub repository metadata or its npm record, read on 2026-09-03. The source URLs are listed in docs/COMPARE_RESULT.md in our repository." },
    ],
  },

  "price-tracker": {
    title: "MCP Price Tracker vs keepa-mcp and pricetrack-mcp: which MCP server to pick",
    description: "Watch any shop page locally, or query an Amazon history API, or a SaaS pricing catalogue. Tool counts, keys required and what each one can actually see.",
    html: `<h1>MCP Price Tracker vs keepa-mcp and pricetrack-mcp: which MCP server to pick</h1>
<p>These three answer different questions. <a href="https://github.com/purahmanian/keepa-mcp">keepa-mcp</a>
answers "what has this Amazon ASIN cost over the last year", using the Keepa API.
<a href="https://github.com/PriceTrack-dev/pricetrack-mcp">pricetrack-mcp</a> answers "what does this
SaaS product charge today and when did it last change", from a catalogue of published vendor pricing.
Ours answers "watch this exact URL and tell me when it drops", for any ordinary shop page, with the
history kept on your disk.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["keepa-mcp", "pricetrack-mcp"], body: [
  ["Tools", "8 plus license_status and license_activate", "6", "4 public catalogue tools"],
  ["Transport", "stdio, plus a hosted streamable HTTP endpoint", "stdio (npx)", "Hosted streamable HTTP, plus stdio via npx"],
  ["Account or API key needed", "No", "Yes, KEEPA_API_KEY", "No for the four public tools; OAuth sign-in for account tools"],
  ["What it can see", "Any public product page you give a URL for", "Amazon catalogue data through Keepa", "Published pricing for the SaaS products in the PriceTrack catalogue"],
  ["Where the history lives", "Local JSON in ~/.local/share/mcp-servers/price-tracker/", "Keepa, queried per call", "PriceTrack servers"],
  ["Licence", "MIT", "MIT", "MIT"],
  ["Latest release read", "0.2.3 on the MCP registry", "npm keepa-mcp 0.1.2, 2026-08-09", "npm @pricetrack/mcp 0.1.0, 2026-08-18"],
  ["Target alerts you set yourself", "Yes, per watch", "No, deals are Keepa-wide filters", "No, alerts are an account feature"],
] })}

<h2>When to pick keepa-mcp</h2>
<p>Pick it for Amazon research. Nothing we do comes close to a year of decoded price series, sales rank
history with a demand trend, keyword ASIN search, category best sellers or a deals feed filtered by
drop percentage and rating. Those are the six tools it exposes. It needs a Keepa API key, and its
README states plainly that it is an unofficial client not affiliated with Keepa.</p>

<h2>When to pick pricetrack-mcp</h2>
<p>Pick it when the question is about software vendors rather than products in a basket. It searches a
catalogue the project describes as 33,000 or more SaaS products, returns current plans with billing
periods, lists verified price changes and the biggest 30 day movers, and compares two to five products
side by side. It also has the lowest friction of the three: a hosted URL with no authentication, so
<code>claude mcp add --transport http pricetrack https://pricetrack.dev/api/mcp</code> is the whole
install.</p>

<h2>When to pick ours</h2>
<p>Pick ours when the page you care about is not in anyone's catalogue: a European shop, a niche
retailer, a supplier quote page, a competitor's own pricing page. You pass a URL,
<code>price_check</code> fetches it and reports price, currency, title and the change since the last
stored observation, and <code>watch_add</code> keeps it on a list with an optional target price.
History and alerts stay in local JSON, so nobody learns what you are watching. Extraction reads
JSON-LD, microdata and Open Graph before falling back to text, and returns a confidence level rather
than pretending. Free covers unlimited checks, 3 watches and 30 observations each.</p>

<h2>What we measured</h2>
<p>The price-tracker package carries 39 automated tests, all passing, covering price extraction across
page shapes, redirect handling, the stdio protocol and two concurrent writers. The 121 check
validate.mjs probe suite is at 121 of 121. In user value round 5, the price watch and refresh scenario
was driven through the real Claude CLI and scored 3 of 3. The five suites together are 144 tests.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add price-tracker -- npx -y @theluckystrike/mcp-price-tracker</code></pre>
<p>keepa-mcp:</p>
<pre><code>claude mcp add keepa -e KEEPA_API_KEY=your_key -- npx -y keepa-mcp</code></pre>
<p>pricetrack-mcp:</p>
<pre><code>claude mcp add --transport http pricetrack https://pricetrack.dev/api/mcp</code></pre>
<p>Config file paths per client are on the <a href="/setup">setup pages</a>. The product page for ours
is <a href="/s/price-tracker">MCP Price Tracker</a>, and the <a href="/guides">guides</a> cover the
watch and alert workflow.</p>`,
    faq: [
      { q: "Does your price tracker work on Amazon?", a: "It fetches the URL you give it like any other page, and extraction is best effort with a confidence level. For Amazon specifically, keepa-mcp is built for it and has real history behind it; ours is built for the long tail of shop pages that no catalogue covers." },
      { q: "How often does it check prices?", a: "Only when you ask. It is a local server with no background process, so watch_refresh runs when the model calls it. If you want a schedule, run watch_refresh from a cron job that talks to the server." },
      { q: "Does anyone see the URLs I watch?", a: "Only the shop, when a fetch happens. The watch list and the observation history are JSON files under your home directory and are never uploaded. keepa-mcp and pricetrack-mcp both send your query to their service by design." },
      { q: "Can I use all three together?", a: "Yes, and it is a reasonable setup: keepa-mcp for Amazon history, pricetrack-mcp for SaaS pricing, ours for the specific pages you care about. Tool names do not collide." },
      { q: "What is the free tier limit?", a: "Unlimited price_check calls, 3 watches, and 30 stored observations per watch, with target alerts included. Pro at $19 once removes the watch and history limits and adds refresh all." },
    ],
  },

  spreadsheet: {
    title: "MCP Spreadsheet vs agent-spreadsheet and mcp-server-spreadsheet: which MCP server to pick",
    description: "Three local xlsx and csv servers compared: tool counts, formula recalculation, SQL over sheets, licences and what each one refuses to do.",
    html: `<h1>MCP Spreadsheet vs agent-spreadsheet and mcp-server-spreadsheet: which MCP server to pick</h1>
<p>This is the one category where all three options are local. None of them uploads your workbook.
<a href="https://github.com/PSU3D0/agent-spreadsheet">agent-spreadsheet</a> is a Rust engine aimed at
formula-heavy models, with recalculation and a write, recalc, proof, diff loop.
<a href="https://github.com/marekrost/mcp-server-spreadsheet">mcp-server-spreadsheet</a> is a Python
server with cell level operations and a DuckDB SQL engine over the same file. Ours is a small
TypeScript server aimed at the ordinary case: read a file, answer a question about it, write a column
back without breaking anything.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["agent-spreadsheet", "mcp-server-spreadsheet"], body: [
  ["Tools", "8 plus license_status and license_activate", "27 baseline, up to 31 with capabilities", "25"],
  ["Language and runtime", "TypeScript on Node 18 or newer, no native dependencies", "Rust binary (npm, cargo, Homebrew, Docker)", "Python 3.10 or newer, via uvx"],
  ["Formats", "xlsx, csv", "xlsx, xlsm, xls, xlsb", "xlsx, csv, ods"],
  ["Formula recalculation", "No", "Yes, native Formualizer or LibreOffice backend", "No, values only"],
  ["SQL over sheets", "No, a query tool with filters, group by and sums", "No", "Yes, DuckDB SELECT plus INSERT, UPDATE and DELETE"],
  ["Licence", "MIT", "Apache-2.0", "MIT"],
  ["Latest release read", "0.2.3 on the MCP registry", "v0.15.0, 2026-09-02", "v0.3.3, 2026-08-11"],
  ["Data location", "Your files, local only", "Your files, local only", "Your files, local only"],
] })}

<h2>When to pick agent-spreadsheet</h2>
<p>Pick it for real spreadsheet models: financial workbooks with formula chains where an edit has to
be recalculated and proven. It exposes 27 operations by default and up to 31 with capabilities
enabled, including sheet screenshots and VBA introspection, and it reads xlsm, xls and xlsb, which we
do not. It also runs as an HTTP service with a canonical operation route. It is a Rust binary; the npm
install ships a prebuilt one so no toolchain is needed, and recalculation is off unless you turn it
on. At 54 stars it is the most used of the three.</p>

<h2>When to pick mcp-server-spreadsheet</h2>
<p>Pick it if you want SQL. Its DuckDB engine runs SELECT with JOINs across sheets, GROUP BY,
aggregates and subqueries, and its sql_execute writes INSERT, UPDATE and DELETE back into the file. It
also handles OpenDocument .ods, which neither of the other two do, and it has cell and range level
operations plus sheet management that our eight tools do not cover. It needs a Python 3.10 runtime.</p>

<h2>When to pick ours</h2>
<p>Pick ours when the file is a data export rather than a model, and you want the smallest thing that
answers the question. Eight tools: info, read, query, stats, add column, write, find, convert. No
Python, no Rust, no native dependencies, so <code>npx</code> works on a machine you did not set up.
<code>sheet_query</code> filters, groups and sums in one call rather than making the model read rows
and add them up. Writes are checked before they land: a write that would only partly apply is refused
rather than half done. Free covers reads and queries up to 5,000 rows and writes up to 500.</p>

<h2>What we measured</h2>
<p>The spreadsheet package carries 39 automated tests, all passing, including csv edge cases,
expression evaluation, the query engine and a rounding case. The validate.mjs probe suite is at 121 of
121. In user value round 5, two spreadsheet scenarios were driven through the real Claude CLI and
scored 4 of 6: a 250 row supplier CSV grouped by supplier matched an independent Python sum on all 10
groups to the cent, and an xlsx conversion computed a VAT column correctly at 1,250.00 times 1.23
equals 1,537.50, but 245 of 250 VAT cells carried more than two decimals and 5 of 250 amount cells
were written as strings rather than numbers. Both are recorded as open defects rather than hidden.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add spreadsheet -- npx -y @theluckystrike/mcp-spreadsheet</code></pre>
<p>agent-spreadsheet:</p>
<pre><code>npm i -g agent-spreadsheet
claude mcp add spreadsheet-agent -- agent-spreadsheet-mcp --transport stdio</code></pre>
<p>mcp-server-spreadsheet:</p>
<pre><code>claude mcp add spreadsheet-py -- uvx mcp-server-spreadsheet</code></pre>
<p>Per client config paths are on the <a href="/setup">setup pages</a>, the product page is
<a href="/s/spreadsheet">MCP Spreadsheet</a>, and the <a href="/guides">guides</a> cover querying a
large CSV from chat.</p>`,
    faq: [
      { q: "Which of the three should I use for a workbook full of formulas?", a: "agent-spreadsheet. It is the only one of the three that recalculates. Ours reads cached values and writes values; a formula you write with sheet_write is stored as text, not evaluated." },
      { q: "Do any of them upload my spreadsheet?", a: "No. All three read and write files on your own disk over stdio. That is the one fact all three share, and it is the main reason to use any of them instead of a web converter." },
      { q: "Can your server handle a 200 MB file?", a: "Free covers reads, queries and stats up to 5,000 rows and writes up to 500 rows; Pro removes both limits. Very large xlsx files are held in memory, so for gigabyte workbooks the Rust option will be more comfortable." },
      { q: "What happens if a write fails halfway?", a: "It does not land. Writes are validated first and applied atomically through a temp file and rename, so the original file is either updated completely or left untouched." },
      { q: "Why only 8 tools when the others have 25 and 27?", a: "Different aim. Ours is sized for reading an export and answering a question about it, so one query tool replaces a dozen cell level calls. If you need sheet management, cell ranges or SQL, the other two genuinely cover more surface." },
    ],
  },

  invoice: {
    title: "MCP Invoice vs einvoice-mcp and IMW Invoice: which MCP server to pick",
    description: "A local numbered invoice PDF, a German XRechnung XML generator, or a hosted service. Tool counts, standards covered, and where the data sits.",
    html: `<h1>MCP Invoice vs einvoice-mcp and IMW Invoice: which MCP server to pick</h1>
<p>Three different products with the same word on the tin.
<a href="https://github.com/makririch/einvoice-mcp">einvoice-mcp</a> builds and validates German
XRechnung XML to EN 16931. <a href="https://www.independent.management/ai">IMW Invoice</a> is a hosted
service you connect over streamable HTTP that does invoicing, time tracking and billing behind an
account. Ours produces a numbered A4 PDF from one sentence, on your own disk.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["einvoice-mcp", "IMW Invoice"], body: [
  ["Tools", "10 plus license_status and license_activate", "4", "Not published in the registry entry"],
  ["Transport", "stdio, plus a hosted streamable HTTP endpoint", "stdio (npm global install)", "Hosted streamable HTTP only"],
  ["Output", "A4 PDF, plus CSV-ready invoice lines", "XRechnung UBL 2.1 XML and CII extraction", "Invoices in the hosted service"],
  ["Account or API key needed", "No", "No, the README states no keys and no external services", "Yes, a service account"],
  ["Where invoices live", "Local JSON and PDF files under your home directory", "Files you pass in and out, local only", "The provider's servers"],
  ["Licence", "MIT", "MIT (npm record)", "Not stated in the registry entry"],
  ["Latest release read", "0.2.3 on the MCP registry", "npm einvoice-mcp 0.1.5, 2026-04-13", "1.4.0 on the MCP registry, 2026-09-01"],
  ["Compliance standards", "Free text tax lines, several VAT rates per invoice", "EN 16931, XRechnung 3.0.2, BR-DE rules", "Not stated in the registry entry"],
] })}

<h2>When to pick einvoice-mcp</h2>
<p>Pick it if you invoice German public bodies, or German business customers after the deadlines its
README lists. Its four tools create XRechnung UBL 2.1 XML, validate an invoice against syntax,
mandatory fields and German BR-DE business rules, extract structured data out of UBL or CII XML, and
look up format information. We produce a PDF, which is a different artefact: a PDF is not a valid
e-invoice under that regime. If a customer asks for XRechnung or ZUGFeRD, use that server, or use both
and generate the PDF for your own records.</p>

<h2>When to pick IMW Invoice</h2>
<p>Pick it if you want invoicing, time tracking and billing in one hosted place and are comfortable
with an account. It is a remote server, so there is nothing to install on any machine and it works
from a phone client. Its registry entry publishes a streamable HTTP endpoint and no repository, so the
tool list, licence and pricing are not verifiable from public metadata; read the provider's own site
before committing.</p>

<h2>When to pick ours</h2>
<p>Pick ours when you send ordinary PDF invoices and want them created where you already work. Say the
invoice in a sentence and the server allocates the number, computes the tax lines and renders A4.
Numbers follow INV-YYYY-NNNN and are never reused even after a delete, because a gap in the sequence is
what a tax authority asks about. Allocation happens under a file lock, so two invoices created in the
same second do not collide. Amounts are integer minor units, rounded per line before summing, so the
printed total equals the printed lines added up. <code>invoice_from_hours</code> takes the output of
the <a href="/s/time-tracker">time tracker</a> directly, and <code>overdue_report</code> lists what is
unpaid past its due date. Nothing leaves the machine, which matters for a client under NDA.</p>

<h2>What we measured</h2>
<p>The invoice package carries 23 automated tests, all passing, covering money arithmetic, rounding,
the stdio protocol and two concurrent number allocations. The validate.mjs probe suite is at 121 of
121. In user value round 5 the invoice scenario was driven through the real Claude CLI and scored 1 of
3, the weakest result in the suite: the model produced the invoice but the run exposed defects in the
unbilled-work path. That is the honest number, it is published in our own docs, and it is the reason
this server is the current work item rather than a finished one. An earlier audit verified the
arithmetic end to end: 12 hours at 90 EUR plus a 300 EUR setup fee at 23 percent VAT produced
1,697.40 EUR from a plain sentence.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add invoice -- npx -y @theluckystrike/mcp-invoice</code></pre>
<p>einvoice-mcp:</p>
<pre><code>npm install -g einvoice-mcp
claude mcp add einvoice -- einvoice-mcp</code></pre>
<p>IMW Invoice:</p>
<pre><code>claude mcp add --transport http imw-invoice https://invoice.independent.management/mcp</code></pre>
<p>Per client config paths are on the <a href="/setup">setup pages</a>, the product page is
<a href="/s/invoice">MCP Invoice</a>, and <a href="/guides/invoice-pdf-from-chat">the invoice guide</a>
walks through a full example.</p>`,
    faq: [
      { q: "Can your server produce a valid XRechnung or ZUGFeRD file?", a: "No. It renders a PDF and stores invoice data as JSON. For EN 16931 formats use einvoice-mcp, which is built for exactly that and needs no account." },
      { q: "Are the invoice numbers safe to use for accounting?", a: "Numbers are allocated as INV-YYYY-NNNN under a file lock and are never reused, including after a delete, so the sequence has no reused values. Whether the rest satisfies your jurisdiction is between you and your accountant." },
      { q: "Why publish a 1 of 3 score on your own comparison page?", a: "Because the alternative is a claim we cannot support. Round 5 drove ten fresh scenarios through the real Claude CLI and scored 26 of 30 overall; the invoice scenario scored 1 of 3 and the defects are listed in our repository docs." },
      { q: "Does the PDF render need the network?", a: "No. Rendering is local with pdfkit and the server makes no network calls, so an invoice for a client under NDA never leaves the machine." },
      { q: "What does the free tier allow?", a: "Three invoices a month with a small footer line, and the overdue report is included. Pro at $19 once removes the limit and the footer and adds a logo and a custom number prefix." },
    ],
  },

  "expense-tracker": {
    title: "MCP Expense Tracker vs Expense Budget Tracker and Expense by Labnotes: which MCP server to pick",
    description: "Local receipts and mileage against two hosted expense services with OAuth endpoints. Tools, storage, licences and what each does with a receipt.",
    html: `<h1>MCP Expense Tracker vs Expense Budget Tracker and Expense by Labnotes: which MCP server to pick</h1>
<p>The two closest alternatives are both real applications with a database behind them.
<a href="https://github.com/kirill-markin/expense-budget-tracker">Expense Budget Tracker</a> is a
self-hostable Postgres app with a hosted MCP endpoint that exposes a restricted SQL surface.
<a href="https://github.com/assaf/expense">Expense by Labnotes</a> is a hosted receipt tracker where
you forward receipts by email and an assistant does the data entry. Ours is a plain local ledger built
to feed a freelancer's invoice.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["Expense Budget Tracker", "Expense by Labnotes"], body: [
  ["Tools", "12 plus license_status and license_activate", "4 (list_workspaces, get_schema, sql_query, sql_execute)", "Not enumerated in the README; capabilities listed as five workflows"],
  ["Transport", "stdio, plus a hosted streamable HTTP endpoint", "Hosted streamable HTTP with OAuth and PKCE", "Hosted HTTP with OAuth 2.1 and PKCE"],
  ["Account needed", "No", "Yes, or self-host Docker plus Postgres", "Yes"],
  ["Where the data lives", "Local JSON in ~/.local/share/mcp-servers/expense-tracker/", "Postgres, theirs or yours", "Postgres with receipt images in BYTEA, on their deployment"],
  ["Receipt image handling", "Attach a file path to an expense record", "Agents parse screenshots, CSV and PDF statements into SQL inserts", "OCR and extraction on upload, plus receipts forwarded by email"],
  ["Licence", "MIT", "MIT", "Not stated on the repository"],
  ["Latest release read", "0.2.3 on the MCP registry", "v1.3.0, 2026-08-23", "No releases; last commit 2026-09-02"],
  ["Mileage", "Yes, per km or per mile rates", "Not a listed feature", "Yes, mapped routes at the IRS rate for the year"],
] })}

<h2>When to pick Expense Budget Tracker</h2>
<p>Pick it if you want budgets, balances, transfers between accounts and multi-currency reporting with
a web interface, and you are comfortable running Docker and Postgres, or using their hosted version.
Its MCP surface is deliberately small and general: four tools, of which sql_query and sql_execute give
an agent a restricted SQL view of a flat schema, with write access gated behind an OAuth scope. That
design covers questions our fixed tools cannot phrase.</p>

<h2>When to pick Expense by Labnotes</h2>
<p>Pick it if the painful part is the receipts themselves. Forwarding a receipt to an email address and
having it filed, with OCR, merchant history categorisation, mapped mileage routes priced at the IRS
rate, report PDFs with the images attached and bank statement reconciliation, is a workflow we do not
have. Ours stores a path to a receipt file; it does not read the image.</p>

<h2>When to pick ours</h2>
<p>Pick ours when the expense only matters because it ends up on an invoice, and you do not want an
account or a database. Twelve tools cover logging with auto categorisation, category rules, mileage,
foreign currency with a rate, receipt attachment, a summary, CSV and xlsx export, and
<code>expense_to_invoice</code>, which turns billable spend into invoice lines for the
<a href="/s/invoice">invoice server</a>, with a markup on Pro. Everything is JSON under your home
directory, written atomically, and the server makes no network calls. Free covers unlimited logging,
the last 30 days, 3 projects, 5 rules and CSV up to 200 rows.</p>

<h2>What we measured</h2>
<p>The expense-tracker package carries 36 automated tests, all passing, including an adversarial suite,
foreign exchange handling, money arithmetic and two concurrent writers. The validate.mjs probe suite
is at 121 of 121; one bug found in round 5 was in the probe itself, where a UTC date slice excluded
rows the probe had just written, and it is fixed. In user value round 5, two expense scenarios were
driven through the real Claude CLI with no tool names mentioned, covering a foreign-currency expense
with a metric mileage claim and a no-receipt audit, and both scored full marks, 6 of 6.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add expense-tracker -- npx -y @theluckystrike/mcp-expense-tracker</code></pre>
<p>Expense Budget Tracker:</p>
<pre><code>claude mcp add --transport http expense-budget https://mcp.expense-budget-tracker.com/mcp</code></pre>
<p>Expense by Labnotes:</p>
<pre><code>claude mcp add --transport http expense https://expense.labnotes.org/mcp</code></pre>
<p>Both hosted options open a browser for OAuth on first use. Per client config paths for ours are on
the <a href="/setup">setup pages</a>, the product page is
<a href="/s/expense-tracker">MCP Expense Tracker</a>, and the <a href="/guides">guides</a> cover the
expense to invoice path.</p>`,
    faq: [
      { q: "Can your expense tracker read a photo of a receipt?", a: "No. receipt_attach stores the path to the file alongside the expense record so the audit trail is complete, but there is no OCR. Expense by Labnotes does OCR and extraction, and Expense Budget Tracker expects the agent to parse the image and write the row." },
      { q: "Do the hosted alternatives need a credit card?", a: "Both need an account. Expense Budget Tracker is MIT licensed and can be self-hosted with Docker and Postgres instead, which is the way to use it with no third party holding the data." },
      { q: "How does an expense become an invoice line?", a: "expense_to_invoice selects the billable, unrebilled expenses for a project and returns invoice lines. Pro adds a markup percentage. The invoice server takes those lines directly." },
      { q: "What happens after the free 30 day window?", a: "Nothing is deleted. Logging stays unlimited and older records stay on disk; listings, summaries and exports cover the last 30 days until a Pro key opens the full history." },
      { q: "Is mileage handled in kilometres?", a: "Yes. mileage_add takes a distance and a rate in either unit, and the round 5 scenario that scored full marks included a metric mileage claim alongside a foreign-currency expense." },
    ],
  },
};

export const COMPARE_SLUGS = Object.keys(COMPARE);
