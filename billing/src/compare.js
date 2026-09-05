// Comparison pages served at /compare and /compare/<our-server>.
// Every competitor fact in these tables was read from that project's public README,
// its GitHub repository metadata, its npm registry record or its official MCP registry
// entry on 2026-09-03. Source URLs are listed in docs/COMPARE_RESULT.md.
// Shape: COMPARE[slug] = { title, description, h1, competitors:[...], rows:[[label, ours, a, b]], html, faq }.

export const COMPARE_INDEX = {
  title: "MCP server comparisons: ours against the closest alternatives",
  description: "Eighteen honest side-by-side pages. Tool counts, licences, hosting model and where your data lives, read from each project's own README and registry entry.",
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
  currency: {
    title: "MCP Currency Converter vs exchange-mcp and tcmb_mcp: which MCP server to pick",
    description: "Keyless local ECB rates against a pay-per-call hosted ECB server and the Turkish central bank series. Tools, cost per call and rate source.",
    html: `<h1>MCP Currency Converter vs exchange-mcp and tcmb_mcp: which MCP server to pick</h1>
<p>All three answer "what is this worth in that currency", and all three read a central bank rather than
a trading venue. <a href="https://registry.smithery.ai/servers/stockvibes07/exchange-mcp">stockvibes07/exchange-mcp</a>
reads the same ECB series we do and serves it as a hosted endpoint you pay for per call.
<a href="https://registry.smithery.ai/servers/ofurkanuygur/tcmb_mcp">ofurkanuygur/tcmb_mcp</a> reads the
Turkish central bank instead, back to 1996. Ours runs on your machine, caches both ECB files and costs
nothing per call.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["exchange-mcp", "tcmb_mcp"], body: [
  ["Tools", "8 plus license_status and license_activate", "4: get_rate, convert, historical, currencies", "6: current rates, historical rates, list, convert, rate history, compare"],
  ["Transport", "stdio (npx or .mcpb bundle)", "Hosted streamable HTTP at exchange-mcp--stockvibes07.run.tools", "Hosted streamable HTTP at tcmb_mcp--ofurkanuygur.run.tools"],
  ["Rate source", "ECB euro reference rates, daily and history back to 1999-01-04", "ECB, 33 currencies, updated daily", "Turkish Central Bank, back to 1996"],
  ["Cost per call", "None. The server runs locally", "x402: 0.001 USDC per call on Base, its listing says no signup and no API key", "Listed on Smithery over run.tools"],
  ["Account or API key", "No", "No signup, but a funded x402 wallet", "None documented on the listing"],
  ["Works with no network", "Yes, from the local cache", "No", "No"],
  ["Rate date stated in the answer", "Yes, with the nearest previous business day rule named", "Not documented on the listing", "Listing describes holiday-aware lookups returning the latest available data"],
  ["Hands rates to another server", "Yes, fx_rates_for returns the expense tracker's fx_rates object", "No", "No"],
] })}
<p>Rows for the two hosted servers were read from their Smithery registry entries on 2026-09-03, which
is where their tool lists, transports and descriptions are published.</p>

<h2>When to pick exchange-mcp</h2>
<p>Pick it if you want zero install and are already set up to pay per call. It is a hosted URL, so there
is nothing on your disk, nothing to update and no Node version to worry about, and it reads the same ECB
reference rates. Its four tools cover the common shape of the question: a rate, a conversion, a
historical lookup and the currency list. If your agent runs somewhere you cannot install packages, that
is a real advantage and it is the reason to choose it.</p>

<h2>When to pick tcmb_mcp</h2>
<p>Pick it if you invoice in Turkish lira or report to a Turkish authority. The ECB quotes TRY, but the
rate a Turkish accountant expects is the central bank's own, and that is what this server publishes,
back to 1996, which is deeper than the ECB series. It also exposes a compare tool that puts several
pairs in one table, which we do not have: ours does one pair at a time in
<code>rate_history</code>, or one amount into several currencies in <code>convert_many</code>.</p>

<h2>When to pick ours</h2>
<p>Pick ours when the conversion ends up on a document somebody will check. Three things follow from
that. Every answer states the rate date, and a date with no published rate resolves by the nearest
previous business day rule with the landing date named, which matters more than it sounds: counted from
the published history file, 7,084 of the 10,104 calendar days from 1999-01-04 to 2026-09-02 carry a
rate, so 29.9% of dates have none. Cross rates are formed at full precision and rounded once to 6
decimals, so the rate printed in the answer reproduces the amount printed in the answer, and results are
rounded to the target currency's own ISO 4217 minor units. And <code>fx_rates_for</code> returns exactly
the object <a href="/s/expense-tracker">the expense tracker</a> needs, so a multi-currency project is
rebilled in one currency without a human typing a rate. It also keeps working with no network, because
both ECB files are cached locally.</p>

<h2>What we measured</h2>
<p>The 29.9% figure above was counted directly from <code>eurofxref-hist.csv</code>, not taken from
documentation: 2025 published 255 dates out of 365 and 2024 published 256 out of 366, both 30.1%
missing. The refusal path was checked too: a history window past the free 90 days returns the reason and
the exact narrower call to make, rather than truncating the table or returning a transport error.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add currency -- npx -y @theluckystrike/mcp-currency</code></pre>
<p>exchange-mcp:</p>
<pre><code>claude mcp add --transport http exchange https://exchange-mcp--stockvibes07.run.tools</code></pre>
<p>tcmb_mcp:</p>
<pre><code>claude mcp add --transport http tcmb https://tcmb_mcp--ofurkanuygur.run.tools</code></pre>
<p>Per client config paths for ours are on the <a href="/setup">setup pages</a>, the product page is
<a href="/s/currency">MCP Currency Converter</a>, and the longer walkthrough is in
<a href="/guides/currency-conversion-ecb-rates-in-claude">ECB rates in Claude</a>.</p>`,
    faq: [
      { q: "Do any of these give me the rate my bank will charge?", a: "No. All three publish central bank reference rates, which exist for accounting and reporting. A dealing rate includes a spread and differs. Ours says so in the tool output rather than implying you can trade on it." },
      { q: "Which one is cheapest to run?", a: "Ours per call, because it runs on your machine and the ECB files are free downloads. exchange-mcp is listed as x402 with 0.001 USDC per call on Base, which is cheap but is not zero and needs a funded wallet. Ours has a one-time $19 Pro for dates before the last 90 days." },
      { q: "Can I get rates from before 1999?", a: "Not from the ECB series; it starts on 1999-01-04, when the euro did. tcmb_mcp publishes the Turkish central bank series back to 1996, so for lira history it reaches further back than either of the ECB-based servers." },
      { q: "What happens on a weekend or a holiday?", a: "Ours returns the last rate published on or before the date and names the date it landed on. That is the convention banks use, and it is load bearing because 29.9% of the calendar dates in the ECB series have no rate of their own." },
      { q: "Where can I read the competitor facts myself?", a: "The two hosted servers publish their tool lists, transports and descriptions on their Smithery registry entries, which is where these rows were read on 2026-09-03. The URLs are in docs/CONTENT_R3_RESULT.md in our repository." },
    ],
  },

  docx: {
    title: "MCP Docx vs docx-mcp and usejunior docx-mcp: which MCP server to pick",
    description: "Proposals and contracts with reference numbers, against a JSON-schema document builder and a tracked-changes editor. Licences and versions.",
    html: `<h1>MCP Docx vs docx-mcp and usejunior docx-mcp: which MCP server to pick</h1>
<p>These three write Word files and almost nothing else about them is the same.
<a href="https://www.npmjs.com/package/@docx-mcp/docx-mcp">@docx-mcp/docx-mcp</a> is a document builder:
you hand it a validated JSON document tree and it renders it, with images, syntax-highlighted code blocks
and page control. <a href="https://www.npmjs.com/package/@usejunior/docx-mcp">@usejunior/docx-mcp</a> is
an editor for documents that already exist, with tracked changes, comments, footnotes and a comparison
between two files. Ours is neither: it is a small set of business documents, proposals, contracts,
letters and template fills, produced from a stored letterhead.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["@docx-mcp/docx-mcp", "@usejunior/docx-mcp"], body: [
  ["Tools", "8 plus license_status and license_activate", "Create, query, edit, open and save operations over a JSON schema", "Read, search, edit, comment, footnote, tracked changes, save, compare, export"],
  ["Licence", "MIT", "MIT", "Apache-2.0"],
  ["Latest version read on npm", "publish pending; .mcpb bundle and clone-and-build", "0.5.0, published 2025-08-26", "0.19.1, published 2026-07-24"],
  ["Transport", "stdio (npx or .mcpb bundle)", "stdio (npx)", "stdio (npx); end users are pointed at the @usejunior/safe-docx wrapper"],
  ["Writes a proposal or contract", "Yes, proposal_create and contract_create with reference numbers", "No, you supply the whole document tree", "No, it edits documents you already have"],
  ["Fills {{placeholders}} in a template", "Yes, on joined paragraph text, keeping styles, headers and images", "Not documented", "Not documented; it edits by content instead"],
  ["Tracked changes and comments", "No. doc_read ignores them", "No", "Yes, inspect and accept tracked changes, comments and footnotes"],
  ["Images in generated documents", "No", "Yes: URL download, local file and base64 embedding", "Editing only"],
  ["PDF output", "No, by design. doc_to_html plus print", "No", "No; exports documents and structured revisions"],
] })}
<p>Rows for the two alternatives were read from their npm registry records and READMEs on 2026-09-03.</p>

<h2>When to pick @docx-mcp/docx-mcp</h2>
<p>Pick it when the document is generated wholesale by a program and the layout matters. It validates a
document against a JSON schema and renders headings, tables, lists, blockquotes, info boxes, text boxes,
horizontal rules, page and section breaks, page settings and per-page headers and footers, plus code
blocks with syntax highlighting for over 180 languages and images from a URL, a local file or base64.
None of that exists in ours. If you are building a report generator rather than sending a proposal, it
is the better fit, and its image support in particular is something we do not offer at all.</p>

<h2>When to pick @usejunior/docx-mcp</h2>
<p>Pick it when the document already exists and the job is to change it carefully. It reads and searches
content, applies text, paragraph, formatting, comment and footnote edits, inspects and accepts tracked
changes, saves clean and tracked copies, and compares two documents. It also handles OpenDocument
<code>.odt</code>. Ours reads a <code>.docx</code> as text and outline and cannot see a tracked change or
a comment at all, so for a contract going back and forth with a counterparty's redlines, that server does
the job and this one does not. Note the licence difference: Apache-2.0 rather than MIT.</p>

<h2>When to pick ours</h2>
<p>Pick ours when you want the document, not a document engine. One sentence produces a client-ready
proposal with your letterhead, a cover title, summary, scope, deliverables, a timeline table, a priced
investment table, terms, validity and a signature block, numbered <code>PROP-YYYY-NNNN</code>, and the
counter is written before the record is stored, so a crash burns a number rather than handing the same
reference to two sent documents. The letterhead comes from the same <code>business_set</code> profile
<a href="/s/invoice">the invoice server</a> uses, so the proposal you win becomes the invoice you send.
Everything is local: no upload, no account, no native dependency, and no network request of any kind.</p>

<h2>What we measured</h2>
<p>Two details are the reason this server reads and fills real files rather than clean ones. Template
filling substitutes on the joined text of each paragraph, not per run, because Word routinely splits a
placeholder you typed as <code>{{client}}</code> into three runs after an edit or a spell-check pass, and
per-run replacement misses those silently. And numbered lists are told apart from bullets by resolving
each paragraph's <code>w:numId</code> against <code>word/numbering.xml</code>, which is the only place
that distinction is recorded: without it, every numbered clause in a contract reads back as a bullet.
The known cost is stated on the page and in the README: a paragraph mixing bold and regular text around a
placeholder comes back in the first run's formatting.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add docx -- npx -y @theluckystrike/mcp-docx</code></pre>
<p>@docx-mcp/docx-mcp:</p>
<pre><code>claude mcp add docx-mcp -- npx -y @docx-mcp/docx-mcp</code></pre>
<p>@usejunior/docx-mcp:</p>
<pre><code>npm install --global @usejunior/safe-docx
claude mcp add safe-docx -- safe-docx</code></pre>
<p>Per client config paths for ours are on the <a href="/setup">setup pages</a>, the product page is
<a href="/s/docx">MCP Docx</a>, and the walkthrough is in
<a href="/guides/word-documents-proposals-from-chat">proposals and contracts from chat</a>.</p>`,
    faq: [
      { q: "Which of these can produce a PDF?", a: "None of the three. Every pure JavaScript path from Word to PDF needs a native dependency or a cloud API. Ours writes semantic HTML with a print stylesheet through doc_to_html so you can print to PDF, and says so in the tool description rather than promising a file it cannot make." },
      { q: "I need to accept a client's redlines. Which one?", a: "@usejunior/docx-mcp. It inspects and accepts tracked changes, handles comments and footnotes, and can compare two documents. Ours reads text, headings, lists and tables only, and ignores tracked changes entirely." },
      { q: "Can any of them put an image in a generated document?", a: "@docx-mcp/docx-mcp can, from a URL, a local file or base64. Ours puts a logo on the letterhead on Pro and nothing else; there is no general image block." },
      { q: "Do the licences differ?", a: "Yes. Ours and @docx-mcp/docx-mcp are MIT. @usejunior/docx-mcp is Apache-2.0, which carries a patent grant and a notice requirement that MIT does not. If your legal review cares, that is the row to read." },
      { q: "Is the generated contract legal advice?", a: "No. contract_create writes a drafting skeleton with bracketed placeholders and prints on the document itself that it is a template and not legal advice. Nothing in it has been reviewed by a lawyer in any jurisdiction." },
    ],
  },

  timezone: {
    title: "MCP Timezone Planner vs meeting-mcp and timezone-toolkit: which MCP server to pick",
    description: "Ranked meeting slots and ics files, locally, against a hosted pay-per-call scheduler with holidays and Google Calendar, and an astronomical time toolkit.",
    html: `<h1>MCP Timezone Planner vs meeting-mcp and timezone-toolkit: which MCP server to pick</h1>
<p>Three servers that all convert a time between zones, and then diverge.
<a href="https://registry.smithery.ai/servers/stockvibes07/meeting-mcp">stockvibes07/meeting-mcp</a> is a
hosted scheduling assistant with a public holiday dataset and Google Calendar event creation, paid per
call. <a href="https://www.npmjs.com/package/@iflow-mcp/timezone-toolkit">@iflow-mcp/timezone-toolkit</a>
is a local time utility that reaches into sunrise, sunset, twilight and moon phase. Ours is a meeting
planner: ranked slots inside everyone's working hours, the honest overlap, and the invite file.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["meeting-mcp", "timezone-toolkit"], body: [
  ["Tools", "9 plus license_status and license_activate", "6: convert_time, get_holidays, check_business_hours, find_meeting_slots, create_calendar_link, create_event", "9: convert_time, get_current_time, sunrise/sunset, moon phase, timezone difference, list_timezones, countdown, business days, format_date"],
  ["Transport", "stdio (npx or .mcpb bundle)", "Hosted streamable HTTP at meeting-mcp--stockvibes07.run.tools", "stdio (npx)"],
  ["Licence", "MIT", "Hosted service, no package licence to read", "ISC"],
  ["Latest version read", "publish pending; .mcpb bundle and clone-and-build", "Smithery registry entry, read 2026-09-03", "1.0.1, published 2025-08-08 on npm"],
  ["Cost per call", "None. Runs locally", "x402: its listing says $0.01 per call, no signup needed", "None"],
  ["Ranks slots by fairness", "Yes, worst participant's distance from 13:00 local", "find_meeting_slots is listed; no ranking rule published", "No slot finder"],
  ["Public holidays", "No. Pass them to business_days yourself", "Yes, 100+ countries", "Bundles date-holidays as a dependency"],
  ["Writes an .ics file", "Yes, UTC times, no VTIMEZONE block", "Calendar link and Google Calendar event creation", "No"],
  ["Saved contacts with working hours", "Yes, 5 free, unlimited on Pro", "No", "No"],
  ["Network calls", "None at all", "Hosted, every call is a request", "Local, but it bundles express-rate-limit and suncalc"],
] })}
<p>The meeting-mcp row was read from its Smithery registry entry and the timezone-toolkit rows from its
npm registry record and README, both on 2026-09-03.</p>

<h2>When to pick meeting-mcp</h2>
<p>Pick it when you want the holidays and the calendar write, and you are happy paying per call. Its
<code>get_holidays</code> covers more than 100 countries, which is real work we have not done: ours knows
weekends and the working hours you give it, and holidays only if you pass them into
<code>business_days</code>. It also creates the Google Calendar event rather than handing you a file to
attach. If the agent needs to put the meeting in a calendar without a human, that is the one.</p>

<h2>When to pick timezone-toolkit</h2>
<p>Pick it when the question is about the sky or the clock rather than about a meeting. Sunrise, sunset,
civil, nautical and astronomical twilight, day length and moon phase for a location and date are things
we do not compute at all, and it adds countdowns and date formatting across locales. It runs locally like
ours and is ISC licensed. It has no slot finder, no overlap window and no <code>.ics</code> output, so it
is a complement to a planner rather than a replacement for one.</p>

<h2>When to pick ours</h2>
<p>Pick ours when the output has to be a time three people will actually accept. Slots are offered only
when the whole meeting, start to end, sits inside every participant's own working window on their own
local calendar day, and every candidate is scored by the worst participant's distance from 13:00 local,
not the average, so a slot that is pleasant for two and 07:00 for the third never outranks one that is
10:00 for everybody. When nothing fits, the server says so and shows the windows instead of proposing a
06:00 call. The <code>.ics</code> it writes carries UTC times and no <code>VTIMEZONE</code> block on
purpose, because a hand-written block with stale rules is the usual way an invite lands an hour off. No
network call is made anywhere, including for license activation.</p>

<h2>What we measured</h2>
<p>DST is not stored here; every offset comes from the ICU data inside your Node build, and the
consequence is measurable. Warsaw and New York, both on 09:00 to 17:00 days, share exactly 2 hours on
2026-09-10, when Warsaw is UTC+2 and New York UTC-4, and 3 hours on 2026-03-16, when Warsaw is still
UTC+1 because Europe does not change until 29 March while the United States changed on 8 March. A
recurring call booked at the edge of that wider March window falls outside somebody's working day at the
end of the month. Place names resolve through a table of 510 entries, each verified against
<code>Intl.supportedValuesOf("timeZone")</code> at startup, and an unknown name returns suggestions
rather than a guess.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add timezone -- npx -y @theluckystrike/mcp-timezone</code></pre>
<p>meeting-mcp:</p>
<pre><code>claude mcp add --transport http meeting https://meeting-mcp--stockvibes07.run.tools</code></pre>
<p>timezone-toolkit:</p>
<pre><code>claude mcp add timezone-toolkit -- npx -y @iflow-mcp/timezone-toolkit</code></pre>
<p>Per client config paths for ours are on the <a href="/setup">setup pages</a>, the product page is
<a href="/s/timezone">MCP Timezone Planner</a>, and the walkthrough is in
<a href="/guides/meeting-slots-across-time-zones">meeting slots across time zones</a>.</p>`,
    faq: [
      { q: "Do any of them know public holidays?", a: "meeting-mcp does, for more than 100 countries, and timezone-toolkit bundles the date-holidays package. Ours does not: business_days excludes weekends and any holidays you pass it, and the README says so rather than implying a holiday calendar exists." },
      { q: "Can any of them create the calendar event for me?", a: "meeting-mcp creates Google Calendar events and calendar links. Ours writes an .ics file to your disk and never connects to a calendar service, which is the trade: nothing of yours is held by a third party, and you attach the file yourself." },
      { q: "Which ones run without a network?", a: "Ours and timezone-toolkit run locally. meeting-mcp is a hosted endpoint, so every call is a request, and its listing prices calls at $0.01 through x402." },
      { q: "How does the slot ranking actually work?", a: "Each candidate is scored by the worst participant's distance from 13:00 in their own local time, in hours, and slots are sorted ascending. A fairness of 0 would be midday for everyone; under about 2 is comfortable. Three hours on a Warsaw and New York pair is the truth about that pair, not a ranking failure." },
      { q: "Where can I read the competitor facts myself?", a: "meeting-mcp publishes its tool list, transport and pricing on its Smithery registry entry; timezone-toolkit publishes its tool table, licence and dependencies on npm. Both were read on 2026-09-03 and the URLs are in docs/CONTENT_R3_RESULT.md." },
    ],
  },
  resume: {
    title: "MCP Resume and Cover Letter vs cv-forge and mcp-resume: which MCP server to pick",
    description: "Word output and a letter that cannot invent a number, against a 14-tool PDF and email generator and a one-tool Chinese CV renderer that uploads the file.",
    html: `<h1>MCP Resume and Cover Letter vs cv-forge and mcp-resume: which MCP server to pick</h1>
<p>Three servers that turn stored facts into a job application, and then differ on almost everything
else. <a href="https://www.npmjs.com/package/cv-forge">cv-forge</a> is the broadest: fourteen tools that
parse a posting, write a CV in four formats, draft a cover letter and an email, and can do all of it in
one call. <a href="https://www.npmjs.com/package/@tgapk/mcp-resume">@tgapk/mcp-resume</a> is one tool
that renders a Chinese-language CV to PDF with bundled CJK fonts. Ours is narrower on purpose: one
profile, Word output, and a letter that is checked against your facts before it is written.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["cv-forge", "@tgapk/mcp-resume"], body: [
  ["Tools", "8 plus license_status and license_activate", "14, numbered in its README", "1: generate_resume"],
  ["Transport", "stdio (npx or .mcpb bundle)", "stdio", "stdio"],
  ["Account or API key needed", "No", "No. Its env vars are output formatting only", "No"],
  ["Output format", ".docx, markdown, printable HTML", "PDF, HTML, markdown, text", "PDF"],
  ["Where the files go", "Local disk, no network call at all", "Local disk, an outputPath per tool", "Rendered locally, then uploaded to a hosted URL by default"],
  ["Cover letter", "Yes, fact-checked against the profile", "Yes, plus four email templates", "No"],
  ["Licence", "MIT", "MIT", "ISC"],
  ["Latest release read", "publish pending; .mcpb bundle and clone-and-build", "1.0.3, published 2025-10-27", "1.1.6, published 2025-12-09"],
  ["Public source repository", "Yes", "Yes", "No. repository is null in the npm record"],
  ["Cost", "Free tier, Pro $19 once", "Free", "Free"],
] })}
<p>Every row was read on 2026-09-03 from the npm registry record for that package and from the README in
it. Download figures below are the last-month point from the npm downloads API for 2026-07-31 to
2026-08-29. Neither competitor was installed or executed, so the tool counts are as documented.</p>

<h2>When to pick cv-forge</h2>
<p>Pick it when you want the whole application produced in one call and you are happy with PDF. Its
<code>draft_complete_application</code> returns the CV, the cover letter and the email together, and
<code>generate_email_template</code> writes four kinds of message, application, follow-up, inquiry and
thank-you, extracting the recipient address and the hiring manager's name from the posting text. We
have nothing that writes the covering email, and no plan to. It also emits PDF, HTML, markdown and text
with configurable page size and margins, where our only PDF route is printing the HTML. It is MIT,
needs no key, and ran 806 downloads in the month read. Two things to check before you commit: the last
publish was 2025-10-27 across four versions, and although <code>docx</code> is listed as a dependency in
its npm record, no DOCX tool is documented, so we could not confirm Word output is reachable.</p>

<h2>When to pick @tgapk/mcp-resume</h2>
<p>Pick it if you are writing a Chinese-language CV. It bundles NotoSerifCJK in regular and bold so the
typesetting is correct, and it takes an <code>order</code> array to arrange education, experience,
projects, skills and honours. That is real work we have not done: our document engine has no CJK font
bundled. Be clear about the rest of it. There is one tool and no cover letter, the README, field labels
and examples are Chinese only, output is PDF, and by default the generated file is <strong>uploaded</strong>
to a hard-coded third-party endpoint on an <code>.icu</code> domain, which its own README tells you to
replace with your own. There is no public repository to audit. It ran 114 downloads in the month read.</p>

<h2>When to pick ours</h2>
<p>Pick ours when the output is a Word file somebody will edit, and when a letter that cannot overstate
you is worth more than a letter written faster. The fact-integrity rule is enforced in code, not asked
for in a prompt: every proof line in the letter is a verbatim bullet from your profile, a highlight the
profile does not support is printed as a bracketed prompt rather than a claim, and every digit run is
checked against the profile and your arguments before the file is written. A number that traces to
neither returns an error and writes nothing. The job description is deliberately not an allowed source,
so the employer's revenue and headcount never come back as yours. Proof lines are printed under the
employer that actually holds them.</p>

<h2>What we measured</h2>
<p>Ten cover letters were generated against ten postings deliberately stuffed with figures: zero posting
numbers reached a letter. Sixty JSON-RPC probes ran over five fresh data directories with no non-JSON
line on stdout, and 26 of 26 automated tests pass. Five scenarios were then driven through the real
Claude CLI with no tool names mentioned, scoring 14 of 15.</p>
<p>That run also produced the useful surprise. With 300 experience bullets stored, a one-page request
kept 78 and dropped 222, filling 390 words against a 392-word budget in 27 ms. With a realistic profile,
the same request used 134 of a 361-word budget and dropped nothing, while coverage against the posting
came back at 75% with a required keyword missing. Real profiles are too thin, not too fat, which is why
<code>tailor_to_job</code> reports the gap rather than filling it.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add resume -- npx -y @theluckystrike/mcp-resume</code></pre>
<p>cv-forge:</p>
<pre><code>npm install -g cv-forge
claude mcp add cv-forge -- cv-forge</code></pre>
<p>@tgapk/mcp-resume:</p>
<pre><code>claude mcp add resume-cn -- npx -y @tgapk/mcp-resume</code></pre>
<p>Per client config paths for ours are on the <a href="/setup">setup pages</a>, the product page is
<a href="/s/resume">MCP Resume and Cover Letter</a>, and the walkthrough is in
<a href="/guides/resume-and-cover-letter-from-chat">writing a resume and cover letter from chat</a>.</p>`,
    faq: [
      { q: "Which of them writes a .docx?", a: "Ours does. cv-forge documents PDF, HTML, markdown and text tools; it lists docx as a dependency in its npm record but no DOCX tool appears in its README, so we could not confirm it. @tgapk/mcp-resume writes PDF only." },
      { q: "Can any of them export a PDF directly?", a: "cv-forge and @tgapk/mcp-resume do. Ours does not, because every pure JavaScript route from Word to PDF needs a native dependency or a cloud API. resume_to_html writes HTML with a print stylesheet, so you print that to PDF." },
      { q: "Does anything leave my machine?", a: "Not with ours: the server makes no network request of any kind, including for licence checks. cv-forge writes to a local outputPath. @tgapk/mcp-resume renders locally and then uploads the PDF to a hard-coded third-party endpoint unless you change it, which its own README tells you to do." },
      { q: "Which has the most tools?", a: "cv-forge, with 14 documented against our 8 plus two licence tools and @tgapk/mcp-resume's single tool. Its email templates and one-call complete application are genuine capabilities we do not have." },
      { q: "Where can I read the competitor facts myself?", a: "Every row comes from the package's npm registry record and the README inside it, read on 2026-09-03: registry.npmjs.org/cv-forge and registry.npmjs.org/@tgapk/mcp-resume. Download figures are the last-month point from api.npmjs.org for 2026-07-31 to 2026-08-29." },
    ],
  },

  recurring: {
    title: "MCP Recurring Invoices vs invovate-mcp-server and paddle-mcp: which MCP server to pick",
    description: "Local retainer schedules that generate invoices you own, against a hosted PDF and UBL renderer and the official client for a merchant of record.",
    html: `<h1>MCP Recurring Invoices vs invovate-mcp-server and paddle-mcp: which MCP server to pick</h1>
<p>Start with the finding, because it shapes the page. Searching npm and the official MCP registry on
2026-09-03 turned up no MCP server that keeps recurring billing schedules locally and generates invoices
into a store you own. The invoice servers are one-shot document generators with no scheduling at all,
and the subscription servers are clients for a vendor's billing platform. Those are the two sides of the
gap, and the two honest comparisons.
<a href="https://www.npmjs.com/package/invovate-mcp-server">invovate-mcp-server</a> renders one invoice
at a time through a hosted API. <a href="https://www.npmjs.com/package/@paddle/paddle-mcp">@paddle/paddle-mcp</a>
is Paddle's own server, and it does real subscription billing against a real payment rail.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["invovate-mcp-server", "@paddle/paddle-mcp"], body: [
  ["Tools", "11 plus license_status and license_activate", "4", "Documented by name and grouped by resource; its README claims near parity with the Paddle API and states no total"],
  ["Transport", "stdio (npx or .mcpb bundle)", "stdio, as a thin client over the hosted Invovate API", "stdio"],
  ["Account or API key needed", "No. No account, no key", "Yes for anything that renders a file: INVOVATE_API_KEY, free signup", "Yes. A Paddle merchant account and PADDLE_API_KEY"],
  ["Recurring schedules", "Yes. weekly, monthly, quarterly, yearly or every N days", "None", "Yes, as Paddle subscriptions"],
  ["Where the data lives", "Local JSON, invoices in the invoice server's own store", "Invovate servers; hosted links expire and the invoice is deleted after 7 days", "The merchant's Paddle account"],
  ["Money actually collected", "No. It produces the invoice and the PDF", "No", "Yes, Paddle is the payment rail"],
  ["Licence", "MIT", "MIT", "Apache-2.0"],
  ["Latest release read", "publish pending; .mcpb bundle and clone-and-build", "0.1.3, published 2026-06-07", "0.1.6, published 2026-04-15"],
  ["Works with no network", "Yes, entirely", "No", "No"],
] })}
<p>Every row was read on 2026-09-03 from that package's npm registry record and the README inside it.
Neither competitor was installed or executed.</p>

<h2>When to pick invovate-mcp-server</h2>
<p>Pick it when the invoice has to leave your language or your alphabet. It renders invoices in eleven
languages, including right-to-left Arabic and Japanese, Hindi and Cyrillic scripts, and it emits UBL 2.1
XML alongside the PDF, plus QR codes and shareable hosted links. We do none of that: our PDF is A4 in
the currency and wording you set. Read two things in its README before you rely on it. The UBL export
is explicitly not regulated e-invoicing, with no Peppol, Factur-X, ZUGFeRD or XRechnung compliance and
no network delivery. And its npm description says no signup, which is true only of
<code>calculate_invoice_totals</code> and <code>get_invoice_capabilities</code>: rendering a PDF or a
UBL file needs the API key. Hosted links expire and the invoice is deleted after 7 days, though a
<code>save_path</code> argument writes the file locally.</p>

<h2>When to pick @paddle/paddle-mcp</h2>
<p>Pick it if you sell a subscription and need the money to actually arrive. This is the official Paddle
server, and nothing in our collection is in the same category: it manages products, prices, discounts
and discount groups, customers, addresses and credit balances, subscription lifecycle, transactions and
financial reports, against a live payment rail with Paddle acting as merchant of record. It also ships a
<code>PADDLE_MCP_TOOLS=non-destructive</code> mode that hides the write tools, which is a good idea for
an agent holding billing credentials. It is Apache-2.0 and free as a package; the account behind it is
not, and we did not verify Paddle's fee schedule, so no rate is quoted here. Two caveats from its own
README and record: Paddle Classic is not supported, only Paddle Billing, and it is still 0.x, last
published 2026-04-15.</p>

<h2>When to pick ours</h2>
<p>Pick ours when the retainer is an invoice rather than a subscription: you are not charging a card,
you are sending a document with payment terms, and the only thing you keep forgetting is to send it. You
define the schedule once and the invoices land in <a href="/s/invoice">the invoice server's</a> own
store, in its number series, with its A4 PDF, its client list and its overdue report. There is no
account, no key and no vendor. The whole thing works with the network off, and a client under NDA never
appears on anybody's server.</p>

<h2>What we measured</h2>
<p>Two design decisions here are worth more than a feature list.</p>
<p><strong>The idempotency key is the period.</strong> History rows are keyed on the schedule id plus the
occurrence date, not on a timestamp and not on the day the run happened. In the worked run, the first
call on 3 September created 4 invoices totalling EUR 4,320.00 and the second call five minutes later
created 0 and skipped 4. Because the key is the period, a repeated billing run is a no-op, and deleting
a schedule keeps its history so a re-created one cannot double-bill.</p>
<p><strong>A run is capped at 60 invoices, and the cap was measured into existence.</strong> Before it
existed, a schedule starting 1900-01-01 offered 1,520 due periods, and one call with a mistyped
<code>as_of</code> year created 1,193 real invoices and 1,193 PDFs, 6.0 MB in 6.8 seconds, burning 1,193
numbers out of a series that never reuses one. The run now bills the oldest periods first, stops at 60
and says how many remain.</p>
<p>The month step is the third: it keeps the start date's day of month and clamps it to the target
month's length without carrying the clamp forward, so a 31st retainer bills on 28 February and returns
to 31 March instead of moving permanently to the 28th.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add recurring -- npx -y @theluckystrike/mcp-recurring
claude mcp add invoice   -- npx -y @theluckystrike/mcp-invoice</code></pre>
<p>invovate-mcp-server:</p>
<pre><code>claude mcp add invovate -e INVOVATE_API_KEY=inv_your-key -- npx -y invovate-mcp-server</code></pre>
<p>@paddle/paddle-mcp:</p>
<pre><code>claude mcp add paddle -e PADDLE_API_KEY=your-key -e PADDLE_ENVIRONMENT=sandbox -- npx -y @paddle/paddle-mcp</code></pre>
<p>Per client config paths for ours are on the <a href="/setup">setup pages</a>, the product page is
<a href="/s/recurring">MCP Recurring Invoices</a>, and the walkthrough is in
<a href="/guides/recurring-invoices-on-a-schedule">billing a retainer on a schedule</a>.</p>`,
    faq: [
      { q: "Is there another MCP server that does local recurring invoicing?", a: "None was found on npm or in the official MCP registry on 2026-09-03. The invoice servers we checked generate one document per call with no scheduling, and the subscription servers are clients for a vendor's billing platform. If you know of one, mail support@zovo.one and this page will say so." },
      { q: "Does any of them take the payment?", a: "Only Paddle, which is the point of it: it is a live payment rail with Paddle as merchant of record. Ours produces the invoice record and the PDF; collecting and chasing are yours, and overdue_report in the invoice server lists who is late. invovate-mcp-server renders documents and does not collect either." },
      { q: "What do the accounts cost?", a: "Ours needs none. invovate-mcp-server needs a free Invovate account for PDF and UBL rendering; no paid tier is documented in its README, and we did not verify whether one exists. Paddle's package is free and Apache-2.0, but it needs a Paddle merchant account, whose fee schedule we did not verify and therefore do not quote." },
      { q: "Where do my invoices live?", a: "With ours, in plain JSON under your home directory, in the invoice server's data directory with the PDFs beside them. Invovate renders on its own servers and deletes the hosted invoice after 7 days, though save_path writes a local copy. With Paddle, everything is in your Paddle account." },
      { q: "Where can I read the competitor facts myself?", a: "Every row comes from the package's npm registry record and the README inside it, read on 2026-09-03: registry.npmjs.org/invovate-mcp-server and registry.npmjs.org/@paddle/paddle-mcp. Neither was installed, so the tool lists are as documented." },
    ],
  },

  clauses: {
    title: "MCP Clause Library vs OpenAgreements and dingdawg-legal-agent: which MCP server to pick",
    description: "A searchable clause library assembled into Word, against a catalogue of real standard forms with source licences, and a paid contract review service.",
    html: `<h1>MCP Clause Library vs OpenAgreements and dingdawg-legal-agent: which MCP server to pick</h1>
<p>Three servers that a freelancer might reach for when a contract is due, doing three different jobs.
<a href="https://www.npmjs.com/package/@open-agreements/contract-templates-mcp">@open-agreements/contract-templates-mcp</a>
fills real, named standard forms: the Common Paper set, the four Y Combinator SAFEs and seven NVCA
venture financing documents. <a href="https://www.npmjs.com/package/dingdawg-legal-agent">dingdawg-legal-agent</a>
reads a contract somebody sent you and scores it. Ours keeps the paragraphs you reuse as searchable
clauses and assembles a document out of the ones you pick.</p>
<p>None of the three is legal advice, and ours says so on every document it writes.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["OpenAgreements", "dingdawg-legal-agent"], body: [
  ["Tools", "10 plus license_status and license_activate", "3: list_templates, get_template, fill_template", "4: review_contract, legal_research, draft_clause, compliance_checklist"],
  ["Transport", "stdio (npx or .mcpb bundle)", "stdio, plus a hosted endpoint at openagreements.org/api/mcp", "stdio, backed by a remote API"],
  ["Account or API key needed", "No", "None documented, for either the local or the hosted mode", "Yes, DINGDAWG_API_KEY"],
  ["What it holds", "Your own clauses plus 25 generic starters, searchable", "Named upstream standard forms with source and licence metadata", "Nothing. It analyses text you send it"],
  ["Clause-level search", "Yes, ranked over titles, tags, categories and bodies", "No. Whole forms only", "No"],
  ["Document output", ".docx or markdown", ".docx", "None documented"],
  ["Where the text goes", "Your disk. No network call at all", "Local stdio stays on your machine; hosted mode does not store filled documents", "Sent to dingdawg.com for analysis"],
  ["Licence", "MIT", "Apache-2.0 for the code; each template's content is licensed separately", "BUSL-1.1, not an open source licence"],
  ["Latest release read", "publish pending; .mcpb bundle and clone-and-build", "0.9.0, published 2026-08-28", "2.0.12, published 2026-07-15"],
  ["Cost", "Free tier, Pro $19 once", "Free", "Free tier of 10 reviews a day; Pro $49 a month; $0.25 a call pay as you go"],
] })}
<p>Every row was read on 2026-09-03 from that project's npm registry record, the README inside it, or
its published documentation. Neither competitor was installed or executed.</p>

<h2>When to pick OpenAgreements</h2>
<p>Pick it when you need a real standard form rather than a paragraph. This is the strongest competitor
on this site and it deserves a plain description: its catalogue is upstream-authoritative documents with
their source and licence recorded, including the Common Paper mutual NDA, cloud service agreements with
and without an SLA and an AI variant, order forms, design partner and pilot agreements, the four YC
SAFEs and seven NVCA venture financing documents. Around them sit jurisdiction guides citing primary
law, 650 verbatim case excerpts linked to CourtListener, review checklists, installable agent skills, a
Gemini CLI extension and a Cursor plugin manifest. It renders DOCX exactly as we do, it is Apache-2.0,
it is actively published, and its CLI ran 7,391 downloads in the month read against 470 for the MCP
package. If you are signing an NDA or raising on a SAFE, use it rather than us.</p>
<p>Two facts bound it. It has three tools and no clause-level search: it fills a whole form, it does not
assemble a document from a library you maintain. And its legal guidance is United States only. Note also
that the NVCA templates are not redistributed; for those it publishes transformation instructions rather
than the source file, so some workflows download the official document at runtime, which its own privacy
note states.</p>

<h2>When to pick dingdawg-legal-agent</h2>
<p>Pick it for the opposite direction of travel: the contract arrived and you want to know what is wrong
with it. It scores clause-level risk against specific sections, flags provisions that are missing,
identifies termination, confidentiality, governing law, force majeure and liability limitation clauses,
returns statute and case law citations with jurisdiction references, and emits a governance receipt per
call. We do none of that and are not attempting it. Price it before you install: the free tier is 10
reviews a day with basic analysis only, where <code>draft_clause</code> is template based and
<code>legal_research</code> is topic classification only; Pro is $49 a month for 100 calls a day, or
$0.25 a call pay as you go. Your contract text is sent to the vendor for analysis, and the package is
BUSL-1.1, which is not an open source licence.</p>

<h2>When to pick ours</h2>
<p>Pick ours when your terms have already diverged from a generic form. After a few years the clauses
that matter are yours: the revision count you allow, the late fee you actually charge, the kill fee, the
jurisdiction you work in. A form filler cannot hold those and a review service cannot write them. This
server keeps them as clauses with <code>{{variables}}</code>, ranks a search over titles, tags,
categories and bodies so a title match beats a body mention, and assembles the ones you pick into a
numbered document. Twenty-five generic freelance starters across eleven categories are there to be
edited or deleted, and a deleted starter is not re-seeded. Everything stays on your machine and the
server makes no network call at all.</p>

<h2>What we measured</h2>
<p><code>variables_list</code> is the tool that makes this work: give it the clauses you picked and it
returns every variable they need and which clause needs it, before the document exists. Variables are
read in first-appearance order, declared ones first and then any the body uses without declaring, so a
clause written in a hurry reports what it actually needs.</p>
<p>A variable you do not supply is never left as raw braces, never blanked and never guessed. It is
printed as a visible bracketed prompt in the document, and the response returns the real names in
<code>unfilled</code>. The prompt prints with spaces for a measured reason: the shared document engine
parses inline markdown, so <code>[late_fee_percent]</code> reaches Word as
<code>[latefeepercent]</code>, because the underscore pair is read as an italic marker and dropped along
with the word boundaries. That defect throws no error and does not look wrong enough to catch by eye.</p>
<p>The disclaimer is a constant in the source, prepended to the .docx, to the markdown and returned in
the tool's own JSON response, so choosing a different output format cannot lose it. It reads: generic
template, not legal advice, have a qualified lawyer review this document before you sign it. No clause
here has been reviewed by a lawyer in any jurisdiction.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add clauses -- npx -y @theluckystrike/mcp-clauses</code></pre>
<p>OpenAgreements, local or hosted:</p>
<pre><code>claude mcp add open-agreements -- npx -y @open-agreements/contract-templates-mcp
claude mcp add --transport http open-agreements https://openagreements.org/api/mcp</code></pre>
<p>dingdawg-legal-agent:</p>
<pre><code>claude mcp add legal -e DINGDAWG_API_KEY=your-key -- npx -y dingdawg-legal-agent</code></pre>
<p>Per client config paths for ours are on the <a href="/setup">setup pages</a>, the product page is
<a href="/s/clauses">MCP Clause Library</a>, and the walkthrough is in
<a href="/guides/contract-clauses-library-assembly">assembling a contract from your own clause library</a>.</p>`,
    faq: [
      { q: "Is any of this legal advice?", a: "No. Our 25 starter clauses are generic freelance templates, not drafted for your country, your trade or your deal, and no clause has been reviewed by a lawyer. Every assembled document opens with a line saying so. OpenAgreements publishes real standard forms with their sources; dingdawg-legal-agent is an analysis service. Take any of their output to a qualified lawyer." },
      { q: "Which one should I use for an NDA or a SAFE?", a: "OpenAgreements. It carries the Common Paper mutual NDA and the four Y Combinator SAFEs as upstream-authoritative forms with their licences recorded, which is a different and better thing than a generic clause somebody wrote. Ours is for the terms that are specific to you." },
      { q: "Does my contract text leave my machine?", a: "Not with ours: every clause and every assembled document stays in your data directory and the server makes no network call at all. OpenAgreements says local stdio stays on your machine and its hosted mode does not store filled documents, with some field-selector workflows downloading an official source document at runtime. dingdawg-legal-agent sends the contract to its own service for analysis." },
      { q: "What do they cost?", a: "OpenAgreements is free and Apache-2.0. dingdawg-legal-agent has a free tier of 10 reviews a day with basic analysis only; Pro is $49 a month for 100 calls a day and pay as you go is $0.25 a call. Ours has a free tier and a one-time $19 Pro key with no subscription." },
      { q: "Where can I read the competitor facts myself?", a: "Every row comes from the npm registry record and README for @open-agreements/contract-templates-mcp and dingdawg-legal-agent, plus the OpenAgreements documentation at github.com/open-agreements/open-agreements, all read on 2026-09-03. Neither was installed, so the tool lists are as documented." },
    ],
  },

  pdf: {
    title: "MCP PDF Tools vs pdf-mcp and DocWand: which MCP server to pick",
    description: "A pure-JavaScript page-level PDF server against a full editing suite and a browser-based signing tool. Tool counts, what pdf_text can and cannot read, and where each one runs.",
    html: `<h1>MCP PDF Tools vs pdf-mcp and DocWand: which MCP server to pick</h1>
<p>All three say they merge, split and stamp a PDF from chat. <a href="https://github.com/nitaiaharoni1/pdf-mcp">pdf-mcp</a>
(npm package <code>mcp-pdf</code>) goes much further than page-level jobs, adding form filling, annotations
and signature fields. <a href="https://docwand.app">DocWand</a> runs the opposite way: no install at all, a
hosted MCP endpoint whose signing and form-filling actually execute in your browser tab rather than on the
server. Ours sits between them: page-level jobs only, done locally, with an honest answer about the one
thing none of the three can promise -- reading text out of a PDF whose font was not built for it.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["pdf-mcp", "DocWand"], body: [
  ["Tools", "12 (10 pdf tools plus 2 license tools)", "~24 across documents, forms, pages, signatures, security, export", "4 documented flows: sign, fill, merge, split"],
  ["Transport", "stdio, no hosted route yet", "stdio (npx or global install)", "streamable HTTP only, hosted at mcp.docwand.app"],
  ["Runs where", "Your machine, no network call of any kind", "Your machine", "Your browser, on the DocWand site, files stay client-side"],
  ["Text extraction", "pdf_text: names the reason when it fails (scan, or subset/CID font returning glyph numbers)", "Extract Text listed as a feature; the README marks it \"requires additional implementation\"", "Not offered; it is a sign-and-fill tool, not an extraction tool"],
  ["Encrypted PDFs", "Refused with the fix named in the message; pdf_info still reports encrypted: true", "Encrypt/decrypt are listed features with limited support noted", "Not documented"],
  ["Account or key needed", "No. No account, no API key", "No. No account, no API key", "No account for the free tools; nothing to sign up for"],
  ["Licence", "MIT", "Not stated in the npm record", "Not published; closed-source hosted service"],
  ["Cost", "Free tier, Pro $19 once", "Free, per its npm listing", "Free tier per its pricing page"],
] })}

<h2>When to pick pdf-mcp</h2>
<p>Pick it for form work: it lists form field discovery, filling single or multiple fields, exporting form
data, flattening forms and adding annotations, none of which we do at all. Its own README also marks
several export features, including text extraction, as "requires additional implementation," so check
that a feature you need is actually wired up before relying on it rather than trusting the feature list on
its own. It installs the same way ours does, with <code>npx</code> in a Claude Desktop or Cursor config.</p>

<h2>When to pick DocWand</h2>
<p>Pick it when you want zero install and the file never has to touch a server you do not control at all,
including ours: DocWand's own description is that signing, filling, merging and splitting run entirely in
the browser tab, so the PDF never leaves the device even over its hosted MCP endpoint. It does not do
page-level jobs like rotate, reorder or per-page stamping, and it has no page-count or metadata reporting
tool; it is a signing and light-editing tool, not a page-manipulation one.</p>

<h2>When to pick ours</h2>
<p>Pick ours for the specific page-level jobs a freelancer actually repeats: merge, split by range, extract
or reorder pages, rotate a scan, stamp PAID or DRAFT or custom text, and a business watermark that reads the
same shared profile <a href="/s/invoice">MCP Invoice</a> and <a href="/s/docx">MCP Docx</a> write. It runs
fully local with no network code at all, not even for licensing, and it is specific about the one thing it
cannot do well: <code>pdf_text</code> is a two-hundred-line parser with no <code>pdfjs</code> dependency, so
a subset-embedded or CID-encoded font returns glyph index numbers instead of letters, and the answer names
the font as the reason rather than returning that garbage as if it were real text.</p>

<h2>What we measured</h2>
<p>The pdf package carries 39 automated tests, all passing, covering merge, split, stamping, rotation,
encrypted-file refusal, the operations register and the shared business profile. Neither competitor
publishes a test count in its README or npm record.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add pdf -- npx -y @theluckystrike/mcp-pdf</code></pre>
<p>pdf-mcp:</p>
<pre><code>claude mcp add pdf-mcp -- npx -y mcp-pdf</code></pre>
<p>DocWand has no install line: it is a remote connector URL, <code>https://mcp.docwand.app/mcp</code>,
pasted into a client that accepts a remote MCP server the way <a href="/guides/connect-mcp-servers-without-installing">connect-by-URL</a> describes.</p>
<p>Exact config file paths per client are on the <a href="/setup">setup pages</a>, and the longer
walkthrough, including the glyph-index caveat in detail, is in
<a href="/guides/pdf-merge-split-stamp-from-chat">merging, splitting and stamping PDFs from chat</a>.</p>`,
    faq: [
      { q: "Can I run MCP PDF Tools and pdf-mcp at the same time?", a: "Yes. MCP clients load several servers at once and the tool names do not collide: ours are pdf_merge, pdf_stamp and so on; pdf-mcp uses its own tool names for the same idea. Nothing is shared between them." },
      { q: "Which one actually extracts text from a PDF?", a: "Ours does, with named limits: no OCR for scans, and glyph numbers instead of letters when a subset or CID font is in the way, both stated in the answer. pdf-mcp lists text extraction as a feature but marks it \"requires additional implementation\" in its own README. DocWand does not offer extraction at all." },
      { q: "Does any of these upload my PDF to a server?", a: "Ours never does: no network call of any kind. pdf-mcp runs locally over stdio the same way. DocWand's processing runs in your browser tab even though the connection is a hosted MCP endpoint, per its own description." },
      { q: "What does each cost?", a: "pdf-mcp is free per its npm listing. DocWand's core tools are free per its pricing page. Ours has a free tier and a one-time $19 Pro key, or $39 for the whole server collection, with no subscription." },
      { q: "Where can I read the competitor facts myself?", a: "pdf-mcp's tool list and text-extraction caveat come from its README at github.com/nitaiaharoni1/pdf-mcp and its npm record for mcp-pdf. DocWand's tool set and hosted endpoint come from its official MCP registry entry, app.docwand/pdf, and docwand.app. All read on 2026-09-03." },
    ],
  },

  calendar: {
    title: "MCP Calendar vs mcp-ical and google-calendar-mcp: which MCP server to pick",
    description: "A local .ics reader with free-busy and conflicts against a bare feed cache and a full Google Calendar API server. Tool counts, OAuth, and what each one actually computes.",
    html: `<h1>MCP Calendar vs mcp-ical and google-calendar-mcp: which MCP server to pick</h1>
<p>All three read calendar data into a chat. <a href="https://github.com/voxxit/mcp-ical">mcp-ical</a>
(npm package <code>@voxxit/mcp-ical</code>) is the closest in shape to ours: it also reads
<code>.ics</code> feeds with no Google or Microsoft account. <a href="https://github.com/nspady/google-calendar-mcp">google-calendar-mcp</a>
is a different kind of tool entirely: it reads and writes real Google Calendar events over OAuth, across
multiple accounts. Ours sits in between: read-only like mcp-ical, but computing the things a freelancer
actually asks for, free and busy blocks, cross-calendar conflicts, and a billable time entry from a
finished meeting, none of which mcp-ical does at all.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["mcp-ical", "google-calendar-mcp"], body: [
  ["Tools", "12 (10 calendar tools plus 2 license tools)", "5: subscribe, list, unsubscribe, get_events, search_events", "12: list/search/get/create/update/delete events, freebusy, colors, current time, respond, manage-accounts"],
  ["Account or key needed", "No. No account, no key", "No. Subscribes to a public .ics URL, no login", "Yes. Google OAuth 2.0 credentials, a consent screen and a browser sign-in before first use"],
  ["Free/busy and conflicts", "free_busy merges busy blocks and daily gaps; conflicts checks every pair across all calendars", "Not offered", "get-freebusy is offered; conflict detection is a separate documented feature (cross-account conflicts)"],
  ["Recurrence handling", "RRULE with COUNT, UNTIL, INTERVAL, BYDAY/BYMONTHDAY/BYMONTH, EXDATE, RDATE and RECURRENCE-ID overrides, computed from Node's own ICU data so DST does not drift", "RFC 5545 parsing stated as a feature; expansion detail not documented in the README", "Native to the Google Calendar API it calls, including advanced recurring-event modification"],
  ["Turns a meeting into billable time", "event_to_time_entry, feeding directly into the time tracker's entry_add", "Not offered", "Not offered"],
  ["Writes to the calendar", "No. Reads only; event_export writes a new file, never the source", "No. Read-only subscription and query", "Yes: create, update, delete and respond to events"],
  ["Licence", "MIT", "Not stated in the npm record", "MIT"],
  ["Cost", "Free tier, Pro $19 once", "Free, per its npm listing", "Free, per its npm listing"],
] })}

<h2>When to pick mcp-ical</h2>
<p>Pick it if all you want is a cached, searchable copy of one or more public <code>.ics</code> feeds with
no setup beyond a URL: <code>subscribe_calendar</code>, <code>list_calendars</code>,
<code>get_events</code> and <code>search_events</code> cover that in five tools. It does not compute free
time, does not check for conflicts across calendars, and does not hand a meeting to a time tracker; if any
of those three is why you wanted a calendar server, it is not there.</p>

<h2>When to pick google-calendar-mcp</h2>
<p>Pick it when the calendar has to stay live and two-way with Google itself: creating, updating, deleting
and responding to events, multiple Google accounts queried at once, and cross-account conflict detection
built on the real API rather than a file you re-import. That comes at the cost every OAuth integration
has: a Google Cloud project, OAuth credentials, a consent screen, and a browser sign-in flow before the
first calendar tool works, none of which our server or mcp-ical require.</p>

<h2>When to pick ours</h2>
<p>Pick ours when the calendar app already exports what you need and you want to ask a freelancer's actual
questions of it without connecting an account: where am I free this week, what clashes with what, and
which of last week's calls should have been billed. <code>free_busy</code>, <code>conflicts</code> and
<code>event_to_time_entry</code> are the three tools neither competitor has, and the recurrence engine was
built against real exports rather than the bare RFC, which is why a weekly Warsaw meeting stays at 10:00
local through the March clock change instead of drifting an hour.</p>

<h2>What we measured</h2>
<p>The calendar package carries 36 automated tests, all passing, covering ICS parsing edge cases (line
folding, escaping, DST, RECURRENCE-ID overrides), free/busy computation and conflict detection. Neither
competitor publishes a test count in its README or npm record.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add calendar -- npx -y @theluckystrike/mcp-calendar</code></pre>
<p>mcp-ical:</p>
<pre><code>claude mcp add ical -- npx -y @voxxit/mcp-ical</code></pre>
<p>google-calendar-mcp:</p>
<pre><code>claude mcp add gcal -e GOOGLE_OAUTH_CREDENTIALS=/path/to/gcp-oauth.keys.json -- npx -y @cocal/google-calendar-mcp</code></pre>
<p>Exact config file paths per client are on the <a href="/setup">setup pages</a>, and the longer
walkthrough is in <a href="/guides/calendar-ics-free-busy-in-claude">reading a .ics calendar in Claude</a>.</p>`,
    faq: [
      { q: "Can I run MCP Calendar and google-calendar-mcp at the same time?", a: "Yes. Tool names do not collide: ours are events_list, free_busy and so on, google-calendar-mcp uses list-events, get-freebusy and its own names. Nothing is shared between them, so a change made in one is invisible to the other." },
      { q: "Which one can create or edit a Google Calendar event?", a: "Only google-calendar-mcp. It reads and writes through the real Google Calendar API with create-event, update-event, delete-event and respond-to-event. Ours and mcp-ical are read-only against a file or feed and never touch a live account." },
      { q: "Does any of these need an account?", a: "google-calendar-mcp does, with a full OAuth 2.0 setup and a browser consent flow before first use. Ours and mcp-ical need no account: ours reads a file you exported or, on Pro, a public feed URL; mcp-ical subscribes to a public .ics URL directly." },
      { q: "What does each cost?", a: "mcp-ical and google-calendar-mcp are free per their npm listings; the Google account and API access behind google-calendar-mcp are free within Google's own quota. Ours has a free tier and a one-time $19 Pro key, or $39 for the whole server collection." },
      { q: "Where can I read the competitor facts myself?", a: "mcp-ical's tool list comes from its README at github.com/voxxit/mcp-ical and its npm record for @voxxit/mcp-ical. google-calendar-mcp's tool list and OAuth requirement come from its README at github.com/nspady/google-calendar-mcp and its npm record for @cocal/google-calendar-mcp. All read on 2026-09-03." },
    ],
  },

  kanban: {
    title: "MCP Kanban vs KanbanThing and SwiftKanban CLI: which MCP server to pick",
    description: "A local board with due dates, estimates and a time-tracker handoff against a hosted no-account board and a CLI for an enterprise SaaS. Tool counts, accounts, and where the board lives.",
    html: `<h1>MCP Kanban vs KanbanThing and SwiftKanban CLI: which MCP server to pick</h1>
<p>All three let an agent move a card. <a href="https://github.com/tronschell/kanban-thing">KanbanThing</a>
hosts the board itself at a shareable link with no account at all, closest to ours in spirit but not in
where the data lives or how long it stays there. <a href="https://github.com/digiteinfotech/sk-cli">SwiftKanban
CLI</a> (npm <code>@nimblework/sk-cli</code>) is a different kind of tool: a client for Nimblework's
SwiftKanban, an existing enterprise product, so it needs an account and a login before its MCP server does
anything. Ours writes JSON files under your home directory, keeps boards until you delete them, and is the
only one of the three that hands a task straight to a time tracker.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["KanbanThing", "SwiftKanban CLI"], body: [
  ["Tools", "16 (14 board tools plus 2 license tools)", "8: create_board, get_board, list_columns, list_cards, create_card, move_card, update_card, delete_card", "Boards, cards list/get/create/update/delete via its CLI/MCP; exact MCP tool count not listed, commands mirror the CLI surface"],
  ["Account or key needed", "No. No account, no key", "No. Streamable HTTP, no login; a tool call needs the board id or URL and its password", "Yes. A SwiftKanban account with the Integration User role, authenticated once with sk login to get a JWT"],
  ["Where the board lives", "Local JSON in ~/.local/share/mcp-servers/kanban/", "KanbanThing's own hosted Supabase storage, reached over the network on every call", "Your organisation's SwiftKanban instance"],
  ["Board lifetime", "Kept until you delete it", "Deleted up to 60 days after creation, stated in its own README", "Whatever your SwiftKanban admin's retention is"],
  ["Due dates, estimates, priority, tags", "All four, plus columns per board", "Due date and colour only; no estimate, priority or tags", "SwiftKanban's own card fields (story points, priority) via update, not documented per MCP tool"],
  ["Hands a task to a time tracker", "task_start_timer returns the exact timer-tracker arguments and records the link", "Not offered", "Not offered"],
  ["Weekly review, overdue, estimate vs actual", "board, overdue and weekly_review, current week free, history on Pro", "Not offered", "Not offered"],
  ["Licence", "MIT", "MIT", "MIT"],
  ["Cost", "Free tier, Pro $19 once", "Free, no paid tier at all per its README", "Free CLI; SwiftKanban itself is a licensed product"],
] })}

<h2>When to pick KanbanThing</h2>
<p>Pick it for a board that needs to be open in a browser too, shared by a link with a password rather than
an account, for something with an end in sight: a retrospective, a short project, a personal board you
restart every few weeks. Its own README says boards are deleted up to 60 days after creation and states
plainly that this is the wrong tool if you need long-lived project history. There is deliberately no way
to list or search boards from its MCP server either, since every tool takes a board id or URL rather than
a name, so the agent (or you) has to hold on to the link.</p>

<h2>When to pick SwiftKanban CLI</h2>
<p>Pick it only if your organisation already runs SwiftKanban. It is a thin client for that product, not a
standalone board: <code>sk login</code> against your account is required before any MCP tool works, and
your account needs the Integration User role, which an admin grants. If SwiftKanban is where your team's
work already lives, this is the correct way to reach it from Claude; if it is not, there is no board to
connect to.</p>

<h2>When to pick ours</h2>
<p>Pick ours when you want the board to still be there next year with no account, no browser tab and no
retention clock, and when the reason you have a board at all is billing the hours behind it. Due date,
estimate, priority and tags on every task, a weekly review comparing planned against done, and
<code>task_start_timer</code> handing the exact project and task name to
<a href="/s/time-tracker">MCP Time Tracker</a> are the parts neither competitor has: KanbanThing has no
time tracking and a 60 day board lifetime, SwiftKanban CLI has no time tracking and no board of its own to
begin with.</p>

<h2>What we measured</h2>
<p>The kanban package carries automated tests covering the protocol handshake, board and task CRUD, corrupt
data recovery, and concurrent writers. Two server processes on one data directory firing 40 concurrent
<code>task_add</code> calls at the same board all persisted with unique ids and the id counter landed on
exactly 41, which is what the advisory lock around the file-backed counter is there to guarantee. Neither
competitor's README states a test count or a concurrency guarantee for its own storage.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add kanban -- npx -y @theluckystrike/mcp-kanban</code></pre>
<p>KanbanThing:</p>
<pre><code>claude mcp add --transport http kanbanthing https://www.kanbanthing.com/mcp</code></pre>
<p>SwiftKanban CLI:</p>
<pre><code>npm install -g @nimblework/sk-cli
sk login --user you@example.com --password yourpassword
claude mcp add swiftkanban -- sk-mcp</code></pre>
<p>Exact config file paths per client are on the <a href="/setup">setup pages</a>, and the longer
walkthrough is in <a href="/guides/kanban-board-in-claude-with-time-tracking">running a kanban board in
Claude with time tracking</a>.</p>`,
    faq: [
      { q: "Can I run MCP Kanban and KanbanThing at the same time?", a: "Yes. Tool names do not collide: ours are task_add, task_move and so on; KanbanThing uses create_card, move_card and its own names. Nothing is shared between them, so a task added in one board is invisible to the other." },
      { q: "Which one keeps a board the longest?", a: "Ours: local JSON is kept until you delete it. KanbanThing's own README states boards are deleted up to 60 days after creation, and calls out that this is on purpose. SwiftKanban's retention is whatever your organisation's admin sets." },
      { q: "Does either competitor start a timer from a task?", a: "No. task_start_timer, which returns the exact arguments for the time tracker's timer_start and records the link on the task, is not offered by KanbanThing or SwiftKanban CLI." },
      { q: "What does each cost?", a: "KanbanThing states in its own README that there are no accounts, no teams and no paid tier at all. SwiftKanban CLI is a free, MIT-licensed client; SwiftKanban itself is a licensed enterprise product you would already be paying for. Ours has a free tier and a one-time $19 Pro key, or $39 for the whole server collection." },
      { q: "Where can I read the competitor facts myself?", a: "KanbanThing's tool list and 60-day retention come from its README at github.com/tronschell/kanban-thing and its CLI documentation page at kanbanthing.com/cli. SwiftKanban CLI's login requirement and commands come from its README at github.com/digiteinfotech/sk-cli and its npm record for @nimblework/sk-cli. All read on 2026-09-04." },
    ],
  },

  image: {
    title: "MCP Image Tools vs Pictomancer and Image Resize API: which MCP server to pick",
    description: "Local resize, compress, crop, watermark and metadata strip against two metered per-call APIs that need a URL. Tool counts, pricing per operation, and what happens to a PNG.",
    html: `<h1>MCP Image Tools vs Pictomancer and Image Resize API: which MCP server to pick</h1>
<p>All three resize an image from a chat. <a href="https://pictomancer.ai">Pictomancer</a>
(<code>ai.pictomancer/image-processing</code> on the official registry, hosted at
<code>api.pictomancer.ai/mcp</code>) is a metered API: six operations, billed per call, and every input is
a URL it fetches, not a file on your disk. <a href="https://github.com/Br0ski777/image-resize-x402">Image
Resize API</a> (<code>io.github.Br0ski777/image-resize</code>) is narrower still: one tool, resize only,
paid per call in USDC through the x402 protocol, also from a URL. Ours reads and writes local files, does
more of the small jobs a freelancer actually needs, and charges nothing per call.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["Pictomancer", "Image Resize API"], body: [
  ["Tools", "12 (10 image tools plus 2 license tools)", "6 operations: analyze, resize, compress, crop, convert, ai-generated (plus a provenance feature)", "1: media_resize_image"],
  ["Input", "A local file path on your machine", "A URL Pictomancer fetches; there is no local file upload path documented", "A URL the server fetches; same constraint"],
  ["Pricing", "Free tier and $19 one-time Pro, or $39 for every server", "Free: analyze. Paid: from $0.001 per operation after 50 free requests, billed per call, no subscription", "$0.008 per call, x402 micropayment in USDC on Base, no free tier stated beyond a 402 challenge per call"],
  ["Account or key needed", "No. No account, no key", "No for the first 50 requests; an API key and card after that, per its own pricing page", "No signup, but a funded x402-capable wallet is required for every call"],
  ["Watermark, thumbnails, dominant colours", "All three offered", "Not offered", "Not offered"],
  ["Strip EXIF and GPS metadata", "image_strip_metadata, a dedicated tool", "Not documented as a distinct operation", "Not offered"],
  ["Decompression bomb guard", "Declared header dimensions checked before decode, refused over 10,000 px per side", "Not documented", "Not documented"],
  ["Licence", "MIT", "Not stated on its site or registry entry", "MIT"],
  ["Works with no network", "Yes, no network call of any kind", "No, every call is a network request to api.pictomancer.ai", "No, every call is a network request plus an on-chain payment"],
] })}

<h2>When to pick Pictomancer</h2>
<p>Pick it when the image already lives at a URL, such as something already uploaded to a CDN or a public
bucket, and you want resize, compress, crop, convert or an AI-generated image pipeline billed by the call
with sub-30ms processing. Its own pricing page states the first 50 requests are free with no card and no
account, and <code>analyze</code>, a free metadata read, lets you know the cost before committing to a
paid operation. It has no watermarking, no metadata stripping as its own operation, and no path for a file
sitting on your machine: everything is fetched from a URL first.</p>

<h2>When to pick Image Resize API</h2>
<p>Pick it if you already pay per call through x402 for other tools in the same marketplace and want one
more: resize from a URL, output PNG, JPEG or WebP, no signup at all beyond a funded wallet. It does one
job. There is no compress, crop, watermark, batch or metadata tool, and its own README says explicitly what
it is not for: OCR, QR codes or screenshots, each pointed at a different tool in the same marketplace.</p>

<h2>When to pick ours</h2>
<p>Pick ours when the photo is already on your machine and should stay there: no URL to fetch, no per-call
charge, no wallet, no upload of a client's product photo to prepare it for a proposal. The measured reason
<code>image_compress</code> only takes a <code>quality</code> parameter seriously for a JPEG output is
that palette quantization was tried against a PNG and made the file 2.9 times larger (115,451 bytes
against a 39,262 byte original) rather than smaller, so the server reports the real byte count instead of
pretending a knob works where it does not. Watermarking, batch thumbnails, dominant colours and metadata
stripping are also not offered by either competitor.</p>

<h2>What we measured</h2>
<p>The image package carries automated tests covering format detection by magic bytes, the resize and crop
math, decompression-bomb refusal from declared header dimensions, and the exclusive-create path reservation
that stops a batch from clobbering itself under concurrent writers. Neither competitor's site or registry
entry states a test count.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add image -- npx -y @theluckystrike/mcp-image</code></pre>
<p>Pictomancer:</p>
<pre><code>claude mcp add --transport http pictomancer https://api.pictomancer.ai/mcp</code></pre>
<p>Image Resize API:</p>
<pre><code>claude mcp add --transport http image-resize https://image-resize.api.klymax402.com/mcp</code></pre>
<p>Exact config file paths per client are on the <a href="/setup">setup pages</a>, and the longer
walkthrough is in <a href="/guides/image-resize-compress-watermark-from-chat">resizing, compressing and
watermarking images from chat</a>.</p>`,
    faq: [
      { q: "Can I run MCP Image Tools and Pictomancer at the same time?", a: "Yes. Tool names do not collide: ours are image_resize, image_compress and so on; Pictomancer's operations are named resize, compress, crop, convert. Nothing is shared between them." },
      { q: "Which one works on a file that is only on my computer?", a: "Ours. Pictomancer and Image Resize API both take a URL they fetch over the network; neither documents a local file upload path. Ours reads and writes files on disk directly and makes no network call at all." },
      { q: "What does each cost per image?", a: "Pictomancer is free for the first 50 requests, then from $0.001 per operation, billed per call. Image Resize API is $0.008 per call in USDC via x402, no free tier beyond its 402 payment challenge. Ours has a free tier with a 4 MP size cap and batches of 5, and a one-time $19 Pro key with no subscription and no per-call charge." },
      { q: "Do either competitors watermark an image or strip its metadata?", a: "No. Neither Pictomancer nor Image Resize API documents a watermark or a dedicated metadata-stripping operation. Ours offers both: image_watermark reads the shared business profile, and image_strip_metadata re-encodes from raw pixels so EXIF, GPS and XMP are never carried across." },
      { q: "Where can I read the competitor facts myself?", a: "Pictomancer's operations and pricing come from its own site at pictomancer.ai and its official MCP registry entry for ai.pictomancer/image-processing. Image Resize API's tool, price and scope come from its README at github.com/Br0ski777/image-resize-x402 and its registry entry for io.github.Br0ski777/image-resize. All read on 2026-09-04." },
    ],
  },

  "bank-statement": {
    title: "MCP Bank Statement vs MainBook and bankstatementparser-mcp: which MCP server to pick",
    description: "A stored, categorized ledger against a paid PDF-to-Excel converter and a stateless multi-format parser. Tool counts, accounts required, and what happens on a second import.",
    html: `<h1>MCP Bank Statement vs MainBook and bankstatementparser-mcp: which MCP server to pick</h1>
<p>All three turn a bank statement into structured data from a chat. <a href="https://github.com/human-beyond/mainbook-mcp">MainBook Bank Statement Converter</a>
(<code>ai.mainbook/bank-statement-converter</code> on the official registry) converts a PDF statement to a
checked Excel, CSV or JSON file through a paid, account-gated cloud job.
<a href="https://github.com/sebastienrousseau/bankstatementparser-mcp">bankstatementparser-mcp</a> parses
CSV, OFX/QFX, SWIFT MT940 and ISO 20022 CAMT.053 content passed inline, one call at a time, with nothing
kept between calls. Ours reads a bank's own CSV export, keeps everything as a local ledger, categorizes it
with your rules, and reconciles it against your expense records.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["MainBook", "bankstatementparser-mcp"], body: [
  ["Tools", "11 (statement_import through license_activate)", "5 (convert_bank_statement, get_conversion, list_conversions, get_balance, output_folder)", "5 (list_supported_formats, detect_format, parse_statement, validate_statement, summarize_statement) plus 1 resource and 1 prompt"],
  ["Input format", "CSV export from Revolut, Wise, mBank, PKO BP, ING, N26, or a generic debit/credit layout", "PDF statement only", "Inline content: CSV, OFX/QFX, SWIFT MT940, ISO 20022 CAMT.053/pain.001"],
  ["Account or key needed", "No. No account, no key", "Yes, a MainBook account and either OAuth sign-in or an mb_live_ API key", "No. No account, no key"],
  ["State between calls", "A persistent local ledger; re-importing the same file stores 0 duplicates", "None: each conversion is a paid job against that one file", "None: every tool call parses the inline content it was given and keeps nothing"],
  ["Categorize by rule", "Yes, category_rules, substring or backtrack-safe regex", "No", "No"],
  ["Reconcile against expense records", "Yes, reconcile_expenses against mcp-expense-tracker", "No", "No"],
  ["Detect subscriptions", "Yes, recurring_detect with an annualised cost", "No", "No"],
  ["Where the data lives", "Local JSON in ~/.local/share/mcp-servers/bank-statement/", "MainBook's cloud service; results also written locally by stdio clients", "Nowhere; a private temp file per call, deleted on exit"],
  ["Licence", "MIT", "MIT", "Apache-2.0"],
  ["Cost of the server", "Free tier, Pro $19 once", "Free account tier, then paid page credits (price not stated in its README)", "Free, open source"],
  ["Works with no network", "Yes", "No, every conversion is a network job against MainBook's API", "Yes"],
] })}

<h2>When to pick MainBook</h2>
<p>Pick it when the statement you have is a PDF and nothing else: no CSV export option, just a scanned or
generated PDF from a bank that does not offer one. Its own worked example converts a 4-page, 63-transaction
PDF and checks that opening balance plus credits minus debits equals the closing balance, flagging any row
that does not fit rather than passing it through silently. That reconciliation-on-import step is real
engineering we do not attempt, because we start from a CSV that already carries clean rows. The cost is an
account, a browser sign-in or an API key, and a page-credit job for every conversion.</p>

<h2>When to pick bankstatementparser-mcp</h2>
<p>Pick it when the job is a one-off parse of a statement in a less common wire format: SWIFT MT940 or
ISO 20022 CAMT.053, the formats banks exchange with each other rather than hand to a customer. It is part
of an eight-server ISO 20022 suite from the same author, so <code>camt053-mcp</code> and
<code>reconcile-mcp</code> in that suite go considerably deeper on those formats than anything here does.
Nothing is stored between calls: every tool takes the statement content inline and returns structured rows
in that one response, which is the right shape for a script but means there is no ledger to categorize,
no re-import to dedupe, and no month-over-month summary without keeping the output yourself.</p>

<h2>When to pick ours</h2>
<p>Pick ours when the statement is an ordinary CSV export from a retail bank and the job repeats every
month. There is no account and no per-conversion charge: import once, and every later import of the same
file adds nothing, because each row is keyed on its date, amount, currency, account and description plus
an occurrence index, not just the row's position in the file. Money in, money out and the net are reported
per currency, never mixed. And it is the only one of the three that talks to another server on purpose:
<code>reconcile_expenses</code> reads the <a href="/s/expense-tracker">expense tracker</a>'s receipts and
reports which bank debits have nothing behind them and which receipts never reached the bank.</p>

<h2>What we measured</h2>
<p>The bank-statement package carries 28 automated tests, all passing, covering all seven bank shapes, the
occurrence-index dedupe, concurrent imports and reconciliation against a seeded expense store. A 60-row
fixture: 60 transactions stored, then 0 stored and 60 duplicates reported on re-importing the identical
file. Eight concurrent imports of one file across two processes on one data directory still leave exactly
the transactions that file contains. Neither MainBook's nor bankstatementparser-mcp's README states a test
count.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add bank-statement -- npx -y @theluckystrike/mcp-bank-statement</code></pre>
<p>MainBook:</p>
<pre><code>uvx mainbook-mcp auth login
claude mcp add-json mainbook '{"command":"uvx","args":["mainbook-mcp","~/Downloads"]}'</code></pre>
<p>bankstatementparser-mcp:</p>
<pre><code>pip install bankstatementparser-mcp
claude mcp add-json bankstatementparser '{"command":"bankstatementparser-mcp"}'</code></pre>
<p>Exact config file paths per client are on the <a href="/setup">setup pages</a>, and the longer
walkthrough is in <a href="/guides/bank-statement-csv-categorize-reconcile">categorizing and reconciling a
bank CSV export</a>.</p>`,
    faq: [
      { q: "Can I run the bank statement server and MainBook at the same time?", a: "Yes. Tool names do not collide: ours are statement_import, transactions_list and so on; MainBook's are convert_bank_statement, get_conversion. Nothing is shared between them, and they read different input formats, CSV against PDF." },
      { q: "Does MainBook or bankstatementparser-mcp categorize transactions or detect subscriptions?", a: "No. Neither documents a category-rule tool or a recurring-charge detector. MainBook converts a PDF to a checked spreadsheet; bankstatementparser-mcp parses one statement per call into structured rows. Rules, reconciliation and recurring detection are specific to ours." },
      { q: "Which one reads a PDF statement?", a: "MainBook, and only MainBook. Ours and bankstatementparser-mcp both read structured formats a bank already exports, CSV for ours, CSV/OFX/QFX/MT940/CAMT.053 for bankstatementparser-mcp; neither extracts a table from a PDF." },
      { q: "What does each cost?", a: "MainBook needs a MainBook account and spends page credits per conversion at a price its README does not state. bankstatementparser-mcp is free and open source (Apache-2.0), with no account. Ours has a free tier (2 accounts, 12 months, 5 rules) and a one-time $19 Pro key, or $39 for every server in this collection." },
      { q: "Where can I read the competitor facts myself?", a: "MainBook's tools, account requirement and PDF-only input come from its README at github.com/human-beyond/mainbook-mcp and its official registry entry for ai.mainbook/bank-statement-converter. bankstatementparser-mcp's tools, formats and licence come from its README at github.com/sebastienrousseau/bankstatementparser-mcp and its registry entry search results for 'statement'. All read on 2026-09-04." },
    ],
  },
  quotes: {
    title: "MCP Quotes vs SendQuoteNow and estimate-invoice: which MCP server to pick",
    description: "A local quote-to-invoice lifecycle against two hosted quote-and-invoice SaaS products behind an API key or OAuth. Tool counts, accounts required, and how each one prices a VAT-rate change.",
    html: `<h1>MCP Quotes vs SendQuoteNow and estimate-invoice: which MCP server to pick</h1>
<p>All three let a chat turn "quote this" into a numbered document and, later, "they said yes" into an
invoice. <a href="https://sendquotenow.com">SendQuoteNow</a> (<code>com.sendquotenow/quote-engine</code>
on the official registry) is a hosted quote-and-invoice generator for contractors, reached over one
remote MCP endpoint behind an API key, with PDF, a client approval page, a QR code and a Stripe payment
link built in. <a href="https://sodatsu-mitsumori.net/features/external-ai-mcp/">estimate-invoice</a>
(<code>net.sodatsu-mitsumori/estimate-invoice</code>, marketed in Japan under a name that translates as
"a quote that grows") is a Japanese billing platform's remote MCP feature, reached over OAuth from an
existing paid account, covering estimates, invoices, delivery notes and purchase orders together. Ours
reads and writes plain JSON on your own machine, needs no account of any kind, and its whole reason to
exist is one design decision: an accepted quote is invoiced from its own stored lines, never recomputed
against whatever the shared tax settings say today.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["SendQuoteNow", "estimate-invoice"], body: [
  ["Tools", "11 (quote_create through license_activate)", "One hosted endpoint behind an API key: instant PDF quote generation, quote-to-invoice conversion, client approval links, quote history", "Remote MCP behind OAuth: create, edit, duplicate and convert estimates, invoices, delivery notes and purchase orders, plus PDF and shareable-URL generation"],
  ["Account or key needed", "No. No account, no key", "Yes, a free SendQuoteNow account and an sqn_live_ API key, or x402 USDC micropayments with no account", "Yes, an existing estimate-invoice account on a paid plan; the free plan cannot use the MCP connection at all"],
  ["Where the data lives", "Local JSON in ~/.local/share/mcp-servers/quotes/", "SendQuoteNow's own cloud account", "estimate-invoice's own cloud platform, optionally synced to freee accounting"],
  ["Quote to invoice", "quote_accept copies the quote's own stored lines, so a VAT-rate change made after the quote was sent cannot move the total the client agreed to", "Described as \"quote-to-invoice conversion\"; no published detail on whether prices are copied or recomputed", "Documents are duplicated and converted between estimate and invoice inside the platform; pricing-at-conversion behaviour is not documented"],
  ["Free tier", "5 open quotes at a time; quote_send_text, revising, accepting and declining are unrestricted", "$0/month, 5 documents a month across quotes, invoices and purchase orders combined, no card required", "None for the MCP feature; it is gated to a paid plan and above"],
  ["Pricing model", "$19 once, lifetime, or $39 for every server in the collection", "$4.99/month for unlimited documents, or pay-per-call from $0.01 to $0.10 via x402 USDC on Base with no subscription", "Bundled into estimate-invoice's own subscription tiers; no price is stated on the MCP feature page itself"],
  ["Licence", "MIT", "Proprietary, no public repository", "Proprietary, no public repository"],
  ["Works with no network", "Yes", "No, every tool is a hosted API call", "No, every tool is a hosted call behind OAuth"],
] })}

<h2>When to pick SendQuoteNow</h2>
<p>Pick it when the quote needs to end in a client clicking something: its own approval page, a QR code
printed on a paper estimate, and a Stripe payment link attached to the same document, none of which a
local JSON file can offer on its own. It also already speaks multi-currency across USD, CAD, EUR, GBP and
AUD from one account, and the pay-per-call x402 route means an agent can quote without a subscription at
all, at $0.10 a generation. The cost is the same one every hosted tool carries here: the quote lives in
SendQuoteNow's account, not yours, and the free tier's 5-document monthly cap is shared across quotes,
invoices and purchase orders together, not 5 quotes on top of separate invoice room.</p>

<h2>When to pick estimate-invoice</h2>
<p>Pick it if the business already runs on estimate-invoice for estimates, invoices, delivery notes and
purchase orders, and the freee accounting sync matters: the MCP connection lets an AI agent read and write
into a system of record that is already the business's real bookkeeping, not a second ledger next to it.
It also states plainly that it does not spend the platform's own AI credit for MCP calls, since the model
doing the work is the connected agent's, not theirs. The requirement that comes with that is a paid
account before the connection can be enabled at all; there is no free way to try the MCP feature itself.</p>

<h2>When to pick ours</h2>
<p>Pick ours when the answer to "where does this data live" should be "nowhere but here." There is no
account to create for either product in this comparison, no monthly document cap shared with an invoice
server, and no subscription: $19 once opens quote_pdf and quote_report for good. The one thing neither
competitor's public material documents is what a recompute-at-acceptance would do to a quote once the
issuing business's own tax settings change before the client answers; ours measured that case directly and
built <code>quote_accept</code> to copy the quote's stored lines specifically because recomputing moved a
EUR 1,230.00 agreed total to EUR 1,080.00 in the test that provoked the decision.</p>

<h2>What we measured</h2>
<p>The quotes package carries adversarial, corruption and concurrency test suites covering 25 probes, all
passing, plus the specific VAT-rate-change case: a quote issued at a profile's 23% default rate, the
default then changed to 8% before the client answers, and the accepted invoice still carrying the original
23% and the original EUR 1,230.00 total. Two processes creating 40 quotes against one data directory left
40 quotes and 40 unique ids. Neither SendQuoteNow's nor estimate-invoice's public material states a test
count or an acceptance-time pricing rule to compare against.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add quotes -- npx -y @theluckystrike/mcp-quotes</code></pre>
<p>SendQuoteNow (remote, once an API key is minted from its dashboard):</p>
<pre><code>claude mcp add-json sendquotenow '{"type":"http","url":"https://sendquotenow.com/mcp","headers":{"X-API-Key":"sqn_live_..."}}'</code></pre>
<p>estimate-invoice is enabled from inside its own product, under its "external AI connection" settings
page, by pasting a setup string it generates there; it is not added by hand as a config block.</p>
<p>Exact config file paths per client are on the <a href="/setup">setup pages</a>, and the longer
walkthrough is in <a href="/guides/quotes-and-estimates-to-invoice-in-claude">quotes and estimates to
invoice</a>.</p>`,
    faq: [
      { q: "Can I run mcp-quotes and SendQuoteNow at the same time?", a: "Yes. Tool names do not collide: ours are quote_create, quote_accept and so on; SendQuoteNow exposes its own hosted endpoint under its own names. Nothing is shared between them, and they store their documents in different places entirely." },
      { q: "Do SendQuoteNow or estimate-invoice copy an accepted quote's prices, or recompute them?", a: "Neither publishes that detail. Ours measured the difference directly: recomputing at acceptance moved a EUR 1,230.00 agreed total to EUR 1,080.00 after a VAT-rate change made between quoting and acceptance, which is why quote_accept copies the quote's own stored lines instead." },
      { q: "Which one can I try without paying anything?", a: "Ours, unrestricted for 5 open quotes at a time with no account. SendQuoteNow has a free tier too, capped at 5 documents a month shared across quotes, invoices and purchase orders. estimate-invoice's MCP connection is not available on its free plan at all; it requires an existing paid subscription." },
      { q: "What does each cost to keep using?", a: "Ours is $19 once, lifetime, or $39 for the whole collection. SendQuoteNow is $4.99/month for unlimited documents, or per-call x402 payments with no subscription. estimate-invoice bundles the MCP feature into its own paid tiers at a price its feature page does not state." },
      { q: "Where can I read the competitor facts myself?", a: "SendQuoteNow's tools, pricing and account model come from its website at sendquotenow.com and its official registry entry for com.sendquotenow/quote-engine. estimate-invoice's tools, OAuth requirement and plan gating come from its feature page at sodatsu-mitsumori.net/features/external-ai-mcp/ and its registry entry for net.sodatsu-mitsumori/estimate-invoice. All read on 2026-09-04." },
    ],
  },

  barcode: {
    title: "MCP Barcode vs qrcode and Barcode Generator API: which MCP server to pick",
    description: "A local, no-network code drawer against two hosted MCP servers, one wrapping a free public QR API, the other charging per call in USDC. Tool counts, accounts required, and where the SEPA payment and check-digit logic lives.",
    html: `<h1>MCP Barcode vs qrcode and Barcode Generator API: which MCP server to pick</h1>
<p>All three let a chat turn "make me a QR code" or "give this a barcode" into a scannable image.
<a href="https://github.com/pipeworx-io/mcp-qrcode">qrcode</a>
(<code>io.github.pipeworx-io/qrcode</code> on the official registry) is one pack of a larger hosted
gateway, wrapping the free public <code>api.qrserver.com</code> service behind a remote MCP endpoint.
<a href="https://github.com/Br0ski777/barcode-generator-x402">Barcode Generator API</a>
(<code>io.github.Br0ski777/barcode-generator</code>) is a single hosted tool that draws EAN-13, UPC-A,
Code 128 and Code 39, paid per call in USDC over the x402 protocol, with no account or API key at all.
Ours draws QR codes, WiFi and vCard codes, SEPA payment codes and four barcode symbologies locally, with
no network call of any kind, and it is the only one of the three that validates an IBAN or a check digit
before drawing rather than just encoding whatever text or number it is given.</p>

<h2>The facts, read from each project</h2>
${t({ head: ["qrcode (pipeworx)", "Barcode Generator API"], body: [
  ["Tools", "10 (qr_create through license_activate)", "create_qr, read_qr, plus roughly 30 shared Pipeworx gateway meta-tools listed on the same endpoint", "One tool, utility_generate_barcode"],
  ["Symbologies", "QR, WiFi, vCard, SEPA payment (EPC069-12), Code 128, EAN-13, EAN-8, UPC-A", "QR only (create and decode)", "Code 128, Code 39, EAN-13, UPC-A; no QR"],
  ["Account or key needed", "No. No account, no key", "No key for the pack itself, but every call also reaches the shared gateway's meta-tool set", "No signup, no API key; pays per call in USDC on Base via x402"],
  ["Where the data lives", "Local JSON register in ~/.local/share/mcp-servers/barcode/, nothing sent anywhere", "Text or URL sent to Pipeworx's gateway, which calls api.qrserver.com on your behalf", "Data sent to Br0ski777's hosted endpoint (klymax402.com) for every call"],
  ["Payment code validation", "IBAN checked with ISO 7064 mod 97 before drawing; check digit computed or verified on every barcode symbology", "Not applicable; the tool only makes and reads plain QR images", "Not applicable; no check-digit verification is documented, only generation from whatever data is given"],
  ["Cost", "Free tier, 20 codes a month; Pro $19 once, or $39 for the whole collection", "Free (wraps a free public API); shares gateway usage with every other Pipeworx pack", "$0.003 per barcode, pay-per-call via x402 USDC, no free tier"],
  ["Licence", "MIT", "MIT", "MIT"],
  ["Works with no network", "Yes", "No, every tool is a hosted API call", "No, every tool is a hosted, paid API call"],
] })}

<h2>When to pick qrcode</h2>
<p>Pick it if a QR code is one of many things you want from a single always-on gateway connection: the
same Pipeworx endpoint that serves <code>create_qr</code> also answers unrelated questions through
<code>ask_pipeworx</code>, reaching over 1,476 other data sources without adding a second server. The
README states plainly that connecting to even one pack lists roughly 30 shared meta-tools alongside the
pack's own two, so the actual tool count on that connection is larger than the QR feature alone. It has
no SEPA payment code, no barcode symbologies and no read/write validation beyond decoding an existing
image.</p>

<h2>When to pick Barcode Generator API</h2>
<p>Pick it if you want to pay per call with no account and no subscription at all: x402 handles the
402-sign-retry cycle automatically for an x402-aware client, at $0.003 a barcode, and there is genuinely
nothing to sign up for. It covers the same four linear symbologies split between EAN-13/UPC-A on one side
and Code 128/Code 39 on the other, drawn server-side and returned as base64 SVG. It has no QR support at
all, and its own docs name the boundary explicitly: "Not for: QR codes."</p>

<h2>When to pick ours</h2>
<p>Pick ours when the codes carry money or a real product identity and getting one wrong is expensive: a
SEPA payment code that goes to the wrong account, or a barcode that scans as a different product because
a check digit was silently corrected instead of refused. Neither competitor validates an IBAN or verifies
a check digit; ours refuses a mismatched EAN-13 by name rather than redrawing it, and refuses a payment
code whose IBAN fails the mod-97 check rather than encoding a typo as if it were an account number. It is
also the only one of the three with no network call at all, so a client's own invoice details, WiFi
password or IBAN never leaves the machine generating the code.</p>

<h2>What we measured</h2>
<p>The barcode package's adversarial suite covers 25 probes: a wrong EAN-13 check digit, a non-EUR
currency on a SEPA payment code, an IBAN with one digit changed, an out_path that is a directory, and two
processes racing for the last few free slots in one month. That race caught a real defect before ship: 23
codes were drawn against a stated allowance of 20, fixed by making the count and the write one atomic
step. Neither competitor's public material documents an adversarial test count of any kind.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add barcode -- npx -y @theluckystrike/mcp-barcode</code></pre>
<p>qrcode (remote, no key):</p>
<pre><code>claude mcp add-json qrcode '{"type":"http","url":"https://gateway.pipeworx.io/qrcode/mcp"}'</code></pre>
<p>Barcode Generator API (remote, x402 client required to pay the per-call price):</p>
<pre><code>claude mcp add-json barcode-generator '{"type":"http","url":"https://barcode-generator.api.klymax402.com/mcp"}'</code></pre>
<p>Exact config file paths per client are on the <a href="/setup">setup pages</a>, and the longer
walkthrough for the payment code specifically is in
<a href="/guides/sepa-payment-qr-codes-on-invoices-from-chat">SEPA payment QR codes on invoices</a>.</p>`,
    faq: [
      { q: "Can I run mcp-barcode alongside qrcode or Barcode Generator API?", a: "Yes. Tool names do not collide: ours are qr_create, barcode_create and so on; the other two expose their own hosted endpoints under their own names. Nothing is shared between them, and none of the three talks to another's data." },
      { q: "Which one makes a SEPA payment QR code?", a: "Only ours. qrcode makes plain QR images from text or a URL and has no payment format. Barcode Generator API has no QR support of any kind, only linear barcodes." },
      { q: "Which one is free to use?", a: "Ours has a free tier of 20 codes a month with every symbology available. qrcode's pack itself is free, since it wraps a free public API, though every call also reaches the shared Pipeworx gateway's meta-tool set. Barcode Generator API has no free tier at all: every call costs $0.003 in USDC." },
      { q: "Do either of the other two check a barcode's check digit before drawing it?", a: "Neither documents doing so. Ours refuses a full-length EAN-13, EAN-8 or UPC-A whose check digit is wrong, naming the correct one, rather than drawing the code the caller asked for and letting it scan as a different product." },
      { q: "Where can I read the competitor facts myself?", a: "qrcode's tools, gateway behaviour and meta-tool count come from its README at github.com/pipeworx-io/mcp-qrcode and its registry entry for io.github.pipeworx-io/qrcode. Barcode Generator API's tool, pricing and x402 details come from its README at github.com/Br0ski777/barcode-generator-x402 and its registry entry for io.github.Br0ski777/barcode-generator. Both read on 2026-09-04." },
    ],
  },

  "per-diem": {
    title: "MCP Per Diem vs gsa-perdiem-mcp: which MCP server to pick",
    description: "Three bundled statutory rate tables against a live reader of the GSA Per Diem API. What each looks up, which schemes, network calls, install path, price and licence, read from each project's own README.",
    html: `<h1>MCP Per Diem vs gsa-perdiem-mcp: which MCP server to pick</h1>
<p>Both answer "what is the per diem for this trip" from a chat client. The difference is what data
sits behind the answer and how many schemes it covers.
<a href="https://github.com/1102tools-dev/federal-contracting-mcps/tree/main/servers/gsa-perdiem-mcp">gsa-perdiem-mcp</a>
(<code>com.1102tools/gsa-perdiem-mcp</code> on the official registry) calls the live <code>api.gsa.gov</code>
Per Diem API for US federal CONUS lodging and M&amp;IE rates, including the non-standard-area rates for
specific cities that a bundled CONUS-standard table cannot carry. Ours ships three bundled rate tables,
Polish, UK and US, and does the trip arithmetic: elapsed hours, the partial-day fraction, meal deductions
and a saved trip record. It has no network call and no US non-standard-locality table.</p>

<h2>The facts, read from each project</h2>
<table>
<thead><tr><th>Fact</th><th>Ours</th><th>gsa-perdiem-mcp</th></tr></thead>
<tbody>
<tr><td>What it looks up</td><td>Prices one trip's allowance: amount per day and total, with the partial-day fraction and meal deductions the scheme applies</td><td>GSA Per Diem API rates by city, state or ZIP, an M&amp;IE meal-tier breakdown, a trip cost estimate and a multi-city comparison</td></tr>
<tr><td>Schemes covered</td><td>Three: Polish delegation regulation (domestic and 34 countries), HMRC UK benchmark scale rates, US GSA CONUS standard</td><td>One: US GSA Per Diem (CONUS), including the non-standard-area rates by city/state/ZIP, not only the standard rate</td></tr>
<tr><td>Network or bundled</td><td>Bundled JSON tables read from disk. No network call anywhere in the server</td><td>Network. Every lookup calls <code>api.gsa.gov</code> live over the api.data.gov gateway</td></tr>
<tr><td>Install path</td><td><code>npx -y @theluckystrike/mcp-per-diem</code>, no account, no key</td><td><code>uvx gsa-perdiem-mcp</code>. Works with the shared DEMO_KEY (about 10 requests/hour across every user of it) or a free personal api.data.gov key (1,000 requests/hour)</td></tr>
<tr><td>Price</td><td>Free tier unlimited on rate lookups and calculations, 5 trips saved a month; Pro $19 once, or $39 for the bundle</td><td>Free. No pricing tier in its README</td></tr>
<tr><td>Licence</td><td>MIT</td><td>MIT</td></tr>
</tbody>
</table>

<h2>When to pick gsa-perdiem-mcp</h2>
<p>Pick it if the trip is US federal or federal-adjacent travel and the destination might be one of the
roughly 300 non-standard-area localities the GSA prices above the CONUS standard rate: New York City,
San Francisco and the rest. Its README states it hits the live GSA API for exactly that reason, so a
mid-year rate change shows up on the next call. It also gives an IGCE-oriented workflow,
<code>estimate_travel_cost</code> and <code>compare_locations</code> across several cities in one call,
and names two companion servers, <code>bls-oews-mcp</code> and <code>gsa-calc-mcp</code>, for the wage and
ceiling-rate side of a cost estimate.</p>

<h2>When to pick ours</h2>
<p>Pick ours for a Polish delegacja or a UK HMRC domestic claim: gsa-perdiem-mcp has no scheme for
either. Pick it too for a US CONUS-standard trip where the destination is not one of the non-standard
localities, since the standard rate does not change between calls and a bundled table needs no network
and no api.data.gov key at all. Ours also does the arithmetic a rate lookup does not: elapsed hours
across a clock change, the partial-day ladder, meal deductions, and a saved trip record with a per-scheme,
per-month report and ready-made expense-tracker export arguments.</p>

<h2>What we measured</h2>
<p>The per-diem package's adversarial suite includes the substring-match defect a country-name lookup can
fall into: a naive fallback priced a trip to Oman at Romania's rate because <code>"romania".includes("oman")</code>
is true. The fix is a prefix match of four characters or more that fails closed instead of guessing, and
it is asserted in <code>test/adversarial.test.mjs</code>. gsa-perdiem-mcp's own README states it carries
437 regression tests across seven rounds of testing against the live GSA API, including one P0
path-traversal fix and 23 P1 silent-wrong-data fixes, and points to its own <code>testing.md</code> for
the record.</p>

<h2>Install lines</h2>
<p>Ours, Claude Code:</p>
<pre><code>claude mcp add per-diem -- npx -y @theluckystrike/mcp-per-diem</code></pre>
<p>gsa-perdiem-mcp, with a personal api.data.gov key (recommended):</p>
<pre><code>claude mcp add gsa-perdiem -e PERDIEM_API_KEY=your-key -- uvx gsa-perdiem-mcp</code></pre>
<p>Exact config file paths per client are on the <a href="/setup">setup pages</a>, and the longer
walkthrough is in <a href="/guides/per-diem-and-travel-allowances-from-chat">per diem and travel
allowances from chat</a>.</p>`,
    faq: [
      { q: "Can I run mcp-per-diem alongside gsa-perdiem-mcp?", a: "Yes. Tool names do not collide: ours are perdiem_calc, trip_record and so on; gsa-perdiem-mcp uses lookup_city_perdiem, estimate_travel_cost and its own names. Nothing is shared between them." },
      { q: "Which one covers Poland or the UK?", a: "Only ours. gsa-perdiem-mcp is US GSA CONUS only; its README names DoD-set OCONUS rates and State Department foreign rates as out of scope for the tool, and has no Polish or UK scheme at all." },
      { q: "Which one needs a network call?", a: "gsa-perdiem-mcp does, every time: it reads live from api.gsa.gov. Ours reads bundled JSON tables on disk and makes no network call, so the same trip priced twice always gives the same answer." },
      { q: "Which one is free?", a: "Both have a free tier. gsa-perdiem-mcp's README states no price at all, though the shared DEMO_KEY caps around 10 requests an hour and a free personal api.data.gov key raises that to 1,000. Ours is free and unlimited on rate lookups and calculations, with a 5-trips-a-month cap on saving; Pro is $19 once." },
      { q: "Where can I read the competitor facts myself?", a: "gsa-perdiem-mcp's tools, pricing and network behaviour come from its README at github.com/1102tools-dev/federal-contracting-mcps/tree/main/servers/gsa-perdiem-mcp and its registry entry for com.1102tools/gsa-perdiem-mcp, read on 2026-09-05." },
    ],
  },
};

export const COMPARE_SLUGS = Object.keys(COMPARE);
