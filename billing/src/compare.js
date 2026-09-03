// Comparison pages served at /compare and /compare/<our-server>.
// Every competitor fact in these tables was read from that project's public README,
// its GitHub repository metadata, its npm registry record or its official MCP registry
// entry on 2026-09-03. Source URLs are listed in docs/COMPARE_RESULT.md.
// Shape: COMPARE[slug] = { title, description, h1, competitors:[...], rows:[[label, ours, a, b]], html, faq }.

export const COMPARE_INDEX = {
  title: "MCP server comparisons: ours against the closest alternatives",
  description: "Thirteen honest side-by-side pages. Tool counts, licences, hosting model and where your data lives, read from each project's own README and registry entry.",
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
};

export const COMPARE_SLUGS = Object.keys(COMPARE);
