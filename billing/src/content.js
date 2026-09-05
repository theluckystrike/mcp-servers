// Long-form guides served at /guides and /guides/<slug>. Hand written, not generated.
// Shape: GUIDES[slug] = { title, description, html, faq: [{ q, a }] }.

// The FAQ section, the related links and the footer are appended by index.js.
const FOOT = "";
const BASE = "https://mcp.zovo.one";

export const GUIDES = {
  "track-time-in-claude-code": {
    title: "How to track billable hours inside Claude Code and Cursor",
    description: "Start a timer, log forgotten hours, get a weekly report and invoice lines without leaving the chat. Setup, tools and measured call counts.",
    html: `<h1>How to track billable hours inside Claude Code and Cursor</h1>
<p>If you bill by the hour and you already spend the day inside Claude Code or Cursor, the timesheet is
the part that gets lost. You finish a task, move to the next one, and at the end of the week you
reconstruct Tuesday from git history. The MCP Time Tracker puts the timer where the work happens: you
say "start a timer for Acme, task API refactor", keep working, and later ask for the week's hours.
Entries are plain JSON under your home directory. Nothing is uploaded.</p>

<h2>Install it</h2>
<p>One command for Claude Code:</p>
<pre><code>claude mcp add time-tracker -- npx -y @theluckystrike/mcp-time-tracker</code></pre>
<p>Cursor reads the same kind of config. Add this to <code>~/.cursor/mcp.json</code> (or the project-level
<code>.cursor/mcp.json</code>), then restart Cursor:</p>
<pre><code>{
  "mcpServers": {
    "time-tracker": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-time-tracker"]
    }
  }
}</code></pre>
<p>Claude Desktop uses <code>claude_desktop_config.json</code> with exactly the same block. There is no
account, no API key and no login step: the server runs locally over stdio and writes to
<code>~/.local/share/mcp-servers/time-tracker/</code>.</p>

<h2>The four things you actually do</h2>
<p><strong>Start and stop a timer.</strong> Say "start tracking time on the Acme website project". Only one
timer runs at a time, so starting a second one stops and logs the first. "Stop the timer and tell me how
long I worked" closes it and writes the entry.</p>
<p><strong>Log time you forgot.</strong> The timer is not the only path in. "Log 2.5 hours yesterday for Acme,
design review, at 90 euros an hour" writes a complete entry: project, task, duration, rate and currency.
The rate accepts the words you said, so "90 euros an hour" stores 90 EUR rather than defaulting to
dollars.</p>
<p><strong>Get a report.</strong> "How many hours did I put into Acme this week, grouped by task" returns totals
in hours and money. Grouping works by project, day, task or tag.</p>
<p><strong>Turn it into invoice lines.</strong> "Give me invoice lines for Acme in August" returns one line per
task with hours, rate and amount, plus a total. Those lines feed straight into
<a href="/guides/invoice-pdf-from-chat">an invoice PDF</a> if you also run the invoice server.</p>

<h2>What the audit measured</h2>
<p>The servers were driven by the real Claude CLI as an MCP client against a fresh data directory, with
prompts phrased the way a person phrases them and no tool names mentioned. Starting the timer, stopping
it, and logging a forgotten 2.5 hour entry each completed in a single tool call: one call, one correct
result, no clarifying question. The weekly billing question took three calls, because the model asked for
a report and then invoice lines separately. Round trip times were 8.6 s, 9.4 s and 10.0 s for the
single-call steps.</p>
<p>The same audit found two real defects and both are fixed in the shipped server. The currency in
"90 euros an hour" used to be dropped, so a report printed dollars for euro work; <code>entry_add</code>
now takes a currency, in words or as an ISO code. Project names that differed only in phrasing
("the Acme website project" and "for Acme") used to create two projects and split the week's billing;
a partial name that matches exactly one existing project now resolves to that project.</p>

<h2>Money arithmetic</h2>
<p>Hours are stored as seconds and money as integer minor units. An entry's amount is computed from
seconds and the rate in one rounding step, then summed, so the total of a report equals the sum of the
lines you can see. There is no floating point drift between what the report shows and what you invoice.</p>

<h2>Free tier and Pro</h2>
<p>Free gives unlimited timers and entries. Reports, invoice summaries and grouping by project, day, task
or tag all run on the free tier too; the limit is that every read (report, invoice_summary, entry_list,
CSV export) is clamped to the last 7 days, and only two projects can carry an hourly rate. Pro ($19 once,
lifetime) opens the full history and unlimited rated projects. The full comparison is in
<a href="/guides/mcp-server-free-vs-pro">free versus Pro</a>. Product page:
<a href="/s/time-tracker">MCP Time Tracker</a>. There are nineteen of these MCP servers in total; one
lifetime key covering all of them, this one included, is $39.</p>

<h2>Connect without installing</h2>
<p>Claude.ai, the Claude Desktop connector dialog and several IDE pickers take a remote URL and nothing
else, so the command above is not the only way in. <a href="/mcp/connect">mcp/connect</a> mints a token
and prints a ready-to-paste URL for every server, including time-tracker, and the
<a href="/setup/claude-web/time-tracker">claude.ai and Claude Desktop setup page</a> has the exact steps.</p>

<h2>A kanban board on the same task</h2>
<p>If the hours you log start life as a task on a board, <a href="/s/kanban">MCP Kanban</a> hands
<code>task_start_timer</code> the exact project and task name for this server's <code>timer_start</code>,
so the entry never drifts from what the board calls the task; see
<a href="/guides/kanban-board-in-claude-with-time-tracking">running a kanban board with time tracking</a>.</p>
${FOOT}`,
    faq: [
      { q: "Does this work in Cursor as well as Claude Code?", a: "Yes. Both speak MCP over stdio. Claude Code takes the claude mcp add command; Cursor reads the same JSON block from ~/.cursor/mcp.json. The tools and the data directory are identical." },
      { q: "Where is my time data stored?", a: "In plain JSON under ~/.local/share/mcp-servers/time-tracker/ (or $XDG_DATA_HOME if you set it). Writes are atomic. Nothing is sent to a server, and there is no account to create." },
      { q: "Can I bill in euros if my other projects are in dollars?", a: "Yes. Currency is per entry and per project. entry_add takes a currency as an ISO code or as words such as 'euros'. If you give neither, it falls back to the project currency and then to USD." },
      { q: "What happens when the free 7 day window runs out?", a: "Nothing is deleted. Entries keep accumulating; reports, listings and CSV exports cover the last 7 days until you activate a Pro key, which opens the whole history." },
      { q: "Does it work offline?", a: "Yes. The server never makes a network call, and Pro keys are Ed25519 signatures verified locally, so activation works on a machine with no internet connection." },
    ],
  },

  "invoice-pdf-from-chat": {
    title: "Create an invoice PDF from a chat message with an MCP server",
    description: "Say the invoice in one sentence and get a numbered A4 PDF with VAT lines. Worked example: 12 h at 90 EUR plus 300 setup, 23% VAT, 1697.40.",
    html: `<h1>Create an invoice PDF from a chat message with an MCP server</h1>
<p>Most invoicing tools want you to leave what you are doing, open a web app, fill a form and download a
file. If you already have Claude or Cursor open, the whole thing is one sentence: "invoice Acme for 12
hours of API work at 90 EUR plus a 300 EUR setup fee, 23% VAT, due in 14 days, and give me the PDF."
The MCP Invoice server allocates the number, computes the tax lines and renders an A4 PDF on your disk.</p>

<h2>Install</h2>
<pre><code>claude mcp add invoice -- npx -y @theluckystrike/mcp-invoice</code></pre>
<p>For Cursor or Claude Desktop, the same server as a config block:</p>
<pre><code>{
  "mcpServers": {
    "invoice": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-invoice"]
    }
  }
}</code></pre>

<h2>Set your business once</h2>
<p>The issuer block printed at the top of every invoice comes from one call. Say it in free text: your
business name, address, VAT id, IBAN, default currency EUR, default tax rate 23%, payment terms 14 days.
In the audit, every one of those fields was parsed out of a single sentence in a single tool call. After
that you never repeat it.</p>

<h2>Numbering that cannot repeat</h2>
<p>Invoice numbers are allocated in the form <code>INV-YYYY-NNNN</code> and a number is never reused, even
if you delete the invoice afterwards. That matters for the same reason it matters in any accounting
system: a tax authority reading a gap in the sequence wants an explanation. The prefix defaults to
<code>INV</code>; a custom prefix is a Pro feature. Allocation happens under a file lock, so two invoices
created in the same second do not collide.</p>

<h2>The worked example</h2>
<p>Take the request above. Two lines, one tax rate:</p>
<pre><code>invoice_create
  client: "Acme"
  currency: "EUR"
  due_days: 14
  items:
    - description: "API work",   quantity: 12, unit_price: 90,  tax_rate: 23
    - description: "Setup fee",  quantity: 1,  unit_price: 300, tax_rate: 23</code></pre>
<p>The arithmetic: 12 x 90 = 1080.00, plus 300.00, subtotal 1380.00. VAT at 23% on 1380.00 is 317.40.
Total 1697.40 EUR. That is the exact figure the audit produced from the natural language prompt, in two
tool calls including the PDF render. Amounts are held as integer minor units and each line is rounded
before the lines are summed, so the printed total always equals the printed lines added up. Several VAT
rates on one invoice produce one tax line per rate, and a discount percent is applied to every line
before tax.</p>

<h2>The PDF</h2>
<p><code>invoice_pdf</code> renders A4 with pdfkit and returns the file path. The layout is a business name
on the left, INVOICE and the number on the right, an issue/due/status block, a BILL TO block, a
four column line table carrying per-line tax, right aligned subtotal, discount, tax lines and total, then
payment details with IBAN and reference. Long descriptions wrap and long tables page. Nothing about the
render touches the network, so the invoice for a client under NDA never leaves the machine.</p>
<p>One thing worth doing before you send: add the client's postal address. If you create an invoice for a
name the server has never seen, it adds the client silently with nothing but that name, and BILL TO on
the PDF is a bare word. Store the client once with <code>client_add</code> and every later invoice is
complete.</p>

<h2>Getting paid and chasing</h2>
<p><code>invoice_mark_paid</code> records a payment; a smaller amount than the total marks the invoice
partial and reports the balance. <code>overdue_report</code> lists everything unpaid past its due date
with days overdue and outstanding totals per currency. If you also track time, see
<a href="/guides/track-time-in-claude-code">tracking billable hours</a>: the invoice lines the time
tracker produces are the items this server wants.</p>

<h2>Free tier</h2>
<p>Free covers 3 invoices per calendar month, with a small footer line on the PDF; the overdue report is
free and unlimited. Pro ($19 once) removes the count limit and the footer, and adds a logo and a custom
number prefix. Details on <a href="/s/invoice">the MCP Invoice page</a> and in
<a href="/guides/mcp-server-free-vs-pro">free versus Pro</a>.</p>

<h2>Connect without installing</h2>
<p>Claude.ai, the Claude Desktop connector dialog and several IDE pickers take a remote URL and nothing
else, so the command above is not the only way in. <a href="/mcp/connect">mcp/connect</a> mints a token
and prints a ready-to-paste URL for every server, including invoice, and the
<a href="/setup/claude-web/invoice">claude.ai and Claude Desktop setup page</a> has the exact steps.</p>

<h2>Quoting the work before you bill it</h2>
<p>If the client has not said yes yet, <a href="/s/quotes">MCP Quotes</a> keeps a quote and the invoice it
becomes as one lifecycle, in this same client list and number series: "Acme said yes" turns a sent quote
straight into an invoice here. See
<a href="/guides/quotes-and-estimates-to-invoice-in-claude">sending a quote and turning the yes into an invoice</a>.</p>
${FOOT}`,
    faq: [
      { q: "Can I put several VAT rates on one invoice?", a: "Yes. Tax rate is per line item. The totals block prints one tax line per distinct rate, so a 23% line and a 0% reverse-charge line appear separately and the total adds up." },
      { q: "Is the PDF good enough to send to a client's accounts department?", a: "It is a single page A4 with issuer and client blocks, dates, a line table with per-line tax, subtotal, tax lines, total, and payment details with IBAN and reference. Add the client's address with client_add first, otherwise BILL TO shows only the name." },
      { q: "What is the invoice number format and can I change it?", a: "INV-YYYY-NNNN, allocated in sequence and never reused. The prefix is configurable with business_set; a prefix other than INV is a Pro feature." },
      { q: "Does anything get uploaded when the PDF is rendered?", a: "No. Rendering is local with pdfkit, and the invoice records live in ~/.local/share/mcp-servers/invoice/. The server makes no network calls at all." },
      { q: "How exact is the money arithmetic?", a: "Amounts are integer minor units. Each line is rounded once, then lines are summed, so 12 h at 90 EUR plus 300 EUR with 23% VAT gives 1380.00 plus 317.40 = 1697.40 with no floating point residue." },
    ],
  },

  "read-excel-in-cursor": {
    title: "Ask questions about an Excel or CSV file from Cursor or Claude",
    description: "Open xlsx and csv from the chat: describe the sheet, filter and group without code, add a computed column, convert. Handles messy header rows.",
    html: `<h1>Ask questions about an Excel or CSV file from Cursor or Claude</h1>
<p>The usual way an assistant reads a spreadsheet is to write a throwaway pandas script, run it, and read
the output. That works until the file has a title row above the headers, or prices stored as text, or
40,000 rows you do not want printed into the context window. The MCP Spreadsheet server gives the model
four purpose-built tools instead: describe the file, query it, add a computed column, convert it. It
opens xlsx, xlsm, xlsb, ods, csv and tsv.</p>

<h2>Install</h2>
<pre><code>claude mcp add spreadsheet -- npx -y @theluckystrike/mcp-spreadsheet</code></pre>
<p>Cursor, in <code>~/.cursor/mcp.json</code>:</p>
<pre><code>{
  "mcpServers": {
    "spreadsheet": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-spreadsheet"]
    }
  }
}</code></pre>

<h2>Start with sheet_info</h2>
<p>"Open sales.xlsx and tell me what is in it" runs <code>sheet_info</code>: sheet names, row and column
counts, the guessed header row, a type per column, sample values and empty counts. This is the step that
handles the export nobody designed for a machine. In the audit the test file carried a title line and a
blank line above the real headers; <code>sheet_info</code> reported <code>headerRow=2</code>, three
sheets and 400 rows, with correct types and ranges. Delimiters in csv files are sniffed rather than
assumed, so a semicolon-separated European export opens without an argument.</p>

<h2>Query with a filter and a group by</h2>
<p>"Which rep sold the most units in the North region? Top 5 with totals" is one call:</p>
<pre><code>sheet_query
  path: "/Users/you/sales.xlsx"
  sheet: "Sales"
  where: '[Region] = "North"'
  group_by: ["Rep"]
  aggregate: [{"col": "Units", "fn": "sum", "as": "total_units"}]
  sort: {"col": "total_units", "dir": "desc"}
  limit: 5</code></pre>
<p>The <code>where</code> string is a small safe expression language, not eval: comparisons
= != &gt; &gt;= &lt; &lt;=, plus contains, startswith and endswith, combined with AND, OR, NOT and
parentheses. Column names with spaces go in brackets. Aggregate functions are sum, count, avg, min and
max, and <code>sort</code> can name an aggregate alias. Numbers written as text, such as
<code>"$1,250.00"</code>, are read as numbers. Grouping was added after the audit measured the same
ranking taking five tool calls and 71 seconds, because the model had to fall back to python; it is now
one call.</p>

<h2>Add a column, convert the file</h2>
<p>"Add a Revenue column that is Units times Unit Price and save it as CSV next to the original" runs
<code>sheet_add_column</code> with the formula <code>[Units] * [Unit Price]</code>. The source file is
never overwritten unless you pass an output path that points at it. <code>sheet_convert</code> moves
between csv, xlsx and json the same way. <code>sheet_stats</code> gives count, empties, distinct, min,
max, sum, mean and median per column, and <code>sheet_find</code> searches every cell and returns cell
addresses with a preview of the row.</p>

<h2>The free write cap refuses rather than truncating</h2>
<p>The audit caught a bad failure here and it was fixed. Adding a column to a 400 row sheet on the free
tier used to write 200 rows and report success, leaving a file that looked complete and was not. The
write cap now refuses: nothing is written, the tool tells you the row count and the cap, and it suggests
a way through on the free tier, such as filtering with <code>sheet_query</code> first and writing only
the rows you need. A partial file that looks whole is worse than no file.</p>

<h2>Limits</h2>
<p>Free reads files up to 5 MB and 5,000 rows, with every tool available, and writes up to 500 rows per
file. Over a read limit the tool still returns the first 5,000 rows with a note saying what was left out.
Pro ($19 once) removes both, up to a 50 MB file ceiling. See
<a href="/s/spreadsheet">MCP Spreadsheet</a> and
<a href="/guides/mcp-server-free-vs-pro">free versus Pro</a>.</p>
${FOOT}`,
    faq: [
      { q: "Does it handle a spreadsheet with a title row above the headers?", a: "Yes. sheet_info guesses the header row and reports which row it picked, so an export with a title line and a blank line above the real headers opens correctly without you specifying anything." },
      { q: "Can it group and sum, or does it only filter?", a: "It groups. sheet_query takes group_by plus aggregate with sum, count, avg, min or max, and can sort by an aggregate alias, so top-N-by-category questions are a single call." },
      { q: "Will it overwrite my original file?", a: "No, not unless you explicitly pass an output path that points at the source. sheet_add_column and sheet_convert write a new file next to the original by default." },
      { q: "What happens on the free tier with a file bigger than the limit?", a: "Reads return the first 5,000 rows with a note naming what was omitted. Writes over 500 rows are refused outright rather than producing a truncated file, and the message tells you the row count, the cap and a free way round." },
      { q: "Is my data sent anywhere?", a: "No. The server runs locally on your machine and reads your files directly. It makes no network requests, and it stores nothing of its own beyond the files you ask it to write." },
    ],
  },

  "price-drop-alerts-with-claude": {
    title: "Watch a product price with Claude and get told when it drops",
    description: "Check a shop price from the chat, keep a watch with history and a target, refresh on demand. Honest about bot walls and the missing background job.",
    html: `<h1>Watch a product price with Claude and get told when it drops</h1>
<p>You can ask an assistant to fetch a product page and read the price off it, and it will usually get
something. The MCP Price Tracker exists because "usually get something" is a bad basis for a price
watch: you need a normalised decimal price, the currency, a check that you are still on the product page,
and a history to compare against. This guide covers what the server does well and, more usefully, the
two places where it will disappoint you.</p>

<h2>Install</h2>
<pre><code>claude mcp add price-tracker -- npx -y @theluckystrike/mcp-price-tracker</code></pre>
<pre><code>{
  "mcpServers": {
    "price-tracker": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-price-tracker"]
    }
  }
}</code></pre>

<h2>price_check: what does this cost right now</h2>
<p>Paste a product URL and ask what it costs. <code>price_check</code> fetches the page and extracts the
price from JSON-LD, microdata, Open Graph tags, common price markup or a currency-aware text fallback,
in that order of preference. It normalises 1.299,00 EUR and 1,299.00 USD to the same number, returns the
product title and the currency, and reports the change against the last price stored for that URL. Every
reading carries a confidence level: high for JSON-LD, microdata and Open Graph, medium for data
attributes and class hints, low for the regex fallback.</p>

<h2>Read this before you rely on it: five of twelve retailers block bots</h2>
<p>Twelve real retail URLs were tested against the compiled fetcher, with the extracted price checked
against the HTML by hand. Five returned HTTP 403 from a bot wall: H&amp;M, Allegro, MediaMarkt, Home
Depot and Etsy. One timed out after 15 seconds (Best Buy). One followed a redirect off the product page
onto a category listing and returned the cheapest item there, which is the worst possible failure for a
price watcher. That leaves 5 of 12 correct, or 41.7%.</p>
<p>Of the 7 pages that did return HTML, 6 yielded a price and 5 of those were right, so the extractor is
not the constraint; reach is. Apple, Walmart, Newegg and Gap parsed correctly. The redirect case was
fixed afterwards: the server now refuses a reading when the final URL lands on a home page, enters a
category or search segment the request was not in, or the title is generic such as "Products". You get an
error naming the redirect instead of a number that was never the price. For shops behind a bot wall the
403 message names the cause and points you at <code>price_add_manual</code>, which stores a price you
read yourself and creates the watch.</p>

<h2>watch, refresh, and the absence of a background job</h2>
<p>"Watch this page and tell me if it drops under 900" creates a watch with a target. What it does not do
is poll. There is no scheduler, no daemon and no notification path: nothing runs when your chat is
closed. Checks happen when you ask for them. The pattern that works is to say "refresh my watches" at
the start of a session; <code>watch_refresh</code> re-fetches one watch or all of them, appends the new
observations and reports current, previous, min, max, change percent and target hits.
<code>alerts_pending</code> then lists everything that hit its target or fell 5% or more since the last
check, and it is free rather than gated, because a price watcher that cannot tell you what dropped is not
a price watcher.</p>
<p>If you want an unattended check, wire <code>watch_refresh</code> to your own cron or launchd job that
starts the client. That is outside the server on purpose: a local MCP server has no business running a
background process on your machine.</p>

<h2>One more thing that will happen</h2>
<p>With a general web fetch tool available, the model may answer "what does this cost" by fetching the
page itself and never calling the server. That was measured. The tool descriptions now state what the
server adds over a raw fetch, which fixes it most of the time; if you want certainty, name the tool:
"use price_check on this URL".</p>

<h2>Free tier</h2>
<p>Free gives unlimited price checks with confidence, 3 watches with 30 observations each, and pending
alerts. Pro ($19 once) gives unlimited watches, full history and refresh-all.
<a href="/s/price-tracker">Product page</a> &middot;
<a href="/guides/mcp-server-free-vs-pro">free versus Pro</a>.</p>
${FOOT}`,
    faq: [
      { q: "Will it notify me when a price drops while I am away?", a: "No. There is no background job and no notification channel. Watches are checked when you ask, so the working pattern is to say 'refresh my watches' at the start of a session, or to run the client from your own cron job." },
      { q: "Which shops fail?", a: "In a 12 URL test, 5 returned HTTP 403 from a bot wall (H&M, Allegro, MediaMarkt, Home Depot, Etsy) and 1 timed out. Apple, Walmart, Newegg and Gap parsed correctly. For blocked shops, price_add_manual stores a price you read yourself." },
      { q: "How does it avoid reporting the wrong price?", a: "Every reading carries a confidence level by extraction source, and a redirect that leaves the product page for a home page, a category listing or a generically titled page is refused with an error rather than returning the number found there." },
      { q: "Does it handle European number formats?", a: "Yes. 1.299,00 EUR and 1,299.00 USD are normalised to the same value, and the currency is detected from the markup rather than assumed." },
      { q: "Why did Claude fetch the page itself instead of using the server?", a: "With a generic web fetch tool available the model sometimes prefers it. Naming the tool in your message ('use price_check on this URL') forces the right path, and the tool descriptions now spell out what the server adds: normalised price, currency, confidence and history." },
    ],
  },

  "mcp-server-free-vs-pro": {
    title: "What the free tier includes and what Pro adds",
    description: "Exact free and Pro limits for all four MCP servers, the one-time price, how offline Ed25519 keys work, and the refund terms. No subscription.",
    html: `<h1>What the free tier includes and what Pro adds</h1>
<p>Four servers, one pricing rule: $19 once for a server, $39 once for all of them, lifetime, no
subscription and no seat count. The free tier is meant to be the whole product for light use rather than
a demo that stops at the interesting part. This page lists the exact limits so you can decide before
paying rather than after.</p>

<h2>The table</h2>
<table>
<tr><th>Server</th><th>Free</th><th>Pro ($19 once)</th></tr>
<tr><td><a href="/s/time-tracker">Time Tracker</a></td>
<td>Unlimited timers and entries. Reports, listings and CSV export cover the last 7 days. 2 projects with an hourly rate. Currency per entry (EUR, USD, GBP, PLN).</td>
<td>Full history, <code>invoice_summary</code>, grouping by tag, unlimited rated projects.</td></tr>
<tr><td><a href="/s/price-tracker">Price Tracker</a></td>
<td>Unlimited price checks with a confidence level. 3 watches, 30 observations each. <code>alerts_pending</code> is free.</td>
<td>Unlimited watches, full history, refresh every watch at once.</td></tr>
<tr><td><a href="/s/spreadsheet">Spreadsheet</a></td>
<td>Every tool. Reads files up to 5 MB and 5,000 rows. Writes up to 500 rows per file; over that nothing is written and the tool says so.</td>
<td>No row or size limits, up to a 50 MB file ceiling.</td></tr>
<tr><td><a href="/s/invoice">Invoice</a></td>
<td>3 invoices per calendar month, small footer line on the PDF. Overdue report free.</td>
<td>Unlimited invoices, no footer, logo, custom invoice number prefix.</td></tr>
<tr><td>Bundle</td><td>-</td><td><strong>$39 once</strong> for all four, lifetime. Saves $37 against buying them separately.</td></tr>
</table>

<h2>What a limit does when you hit it</h2>
<p>No limit corrupts data or fails silently. Over a spreadsheet read cap, the tool returns the rows it is
allowed to return and appends a note saying how many were left out. Over a write cap, nothing at all is
written: an earlier version wrote 200 of 400 rows and reported success, which produced a file that looked
complete, and that behaviour was removed. Over the time tracker's 7 day window, nothing is deleted;
older entries stay on disk and appear the moment a key is activated. Gated tools return one plain message
naming the feature, the price and the checkout URL.</p>

<h2>How the key works</h2>
<p>After payment you get a key that looks like <code>MCPL1.xxx.yyy</code>. It is an Ed25519 signature over
a small payload: the product, an id, and the issue time. Verification happens locally against a public
key compiled into the server. Two consequences worth stating plainly. The servers never phone home,
because there is nothing to phone home about: no activation server, no license check on startup, no
telemetry, no usage counting. And activation works with the network off, on a plane or on an air-gapped
machine.</p>
<p>Activate it either way:</p>
<pre><code># In the chat, run the license_activate tool with your key, or:
export MCP_LICENSE_KEY=MCPL1.xxxxxxxx.yyyyyyyy

# Or write it once for every server on this machine:
mkdir -p ~/.config/mcp-servers
printf '{"key":"MCPL1.xxxxxxxx.yyyyyyyy"}' > ~/.config/mcp-servers/license.json</code></pre>
<p>Lookup order is the environment variable, then that config file, then the free tier. The bundle key
carries a wildcard product, so one key covers all four servers with the same steps. Every tool ships in
the free build; a Pro key removes limits rather than downloading anything.</p>

<h2>Buying, and getting your money back</h2>
<p>Checkout is Stripe. The key appears on the success page immediately after payment and no email is sent
with it, so save it there. If you lose it, the same page can be reloaded, and support@zovo.one can
recover it from the session id printed on your Stripe receipt. Refunds within 14 days, no argument and no
form: mail support@zovo.one. Prices are one-time; there is no renewal to cancel and no card on file to
remove.</p>

<h2>Which one to buy</h2>
<p>If one server is a daily tool for you, buy that server. If two or more are, the bundle is cheaper than
two. The honest guidance: try the free tier for a week first, and buy when a limit gets in your way,
because for a light user the free tier is the whole product. See the guides for
<a href="/guides/track-time-in-claude-code">time tracking</a>,
<a href="/guides/invoice-pdf-from-chat">invoices</a>,
<a href="/guides/read-excel-in-cursor">spreadsheets</a> and
<a href="/guides/price-drop-alerts-with-claude">price watching</a>.</p>
${FOOT}`,
    faq: [
      { q: "Is this a subscription?", a: "No. $19 once for one server, $39 once for all four, lifetime. There is no renewal, no seat count and no card kept on file." },
      { q: "Does the server check my license online?", a: "No. The key is an Ed25519 signature verified locally against a public key compiled into the server. There is no activation server and no telemetry, so activation and use both work offline." },
      { q: "What happens to my data if I never buy a key?", a: "Nothing is deleted or degraded. Free limits restrict what a tool returns or writes, not what is stored, so activating a key later reveals the whole history that was already on disk." },
      { q: "Can I use one key on more than one machine?", a: "Yes. The key is a signed file, not a per-device activation. Put it in MCP_LICENSE_KEY or ~/.config/mcp-servers/license.json on each machine you work from." },
      { q: "How do refunds work?", a: "Mail support@zovo.one within 14 days and the payment is refunded. Because the key cannot be revoked remotely, this runs on trust in both directions." },
    ],
  },
  "expense-tracking-in-claude": {
    title: "Log expenses and mileage in Claude, split VAT, rebill to an invoice",
    description: "Say a receipt in one line and get it logged, VAT-split and categorised. Worked example: 61.50 EUR at 23% VAT, Polish mileage, rebill without double tax.",
    html: `<h1>Log expenses and mileage in Claude, split VAT, rebill to an invoice</h1>
<p>The usual way to keep a business expense ledger is a spreadsheet you update days later from a pile of
receipts, or an app you open, log into and tap through. The MCP Expense Tracker puts the ledger in the
chat window: say "61.50 euros at Adobe, software, 23% VAT, billable to Acme" and it is logged with the
VAT already split out, categorised from a rule you set once, and marked ready to rebill. Everything is a
plain JSON file on your own machine.</p>

<h2>Install it</h2>
<p>One command for Claude Code:</p>
<pre><code>claude mcp add expense-tracker -- npx -y @theluckystrike/mcp-expense-tracker</code></pre>
<p>Cursor reads the same kind of config. Add this to <code>~/.cursor/mcp.json</code> (or the project-level
<code>.cursor/mcp.json</code>), then restart Cursor:</p>
<pre><code>{
  "mcpServers": {
    "expense-tracker": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-expense-tracker"]
    }
  }
}</code></pre>
<p>Claude Desktop uses <code>claude_desktop_config.json</code> with the same block. There is no account, no
API key and no login step: the server runs locally over stdio and writes to
<code>~/.local/share/mcp-servers/expense-tracker/</code>.</p>

<h2>Log a receipt and watch the VAT split</h2>
<p>Every amount you say is the gross figure printed on the receipt. <code>vat_rate</code> does the rest:
<code>net = round(gross * 100 / (100 + rate))</code> and <code>vat = gross - net</code>, so net plus VAT
is always exactly the gross, to the cent. Take the line above: 61.50 EUR gross at 23% VAT splits to
net 50.00 EUR and VAT 11.50 EUR. Money is stored as integer minor units in the expense's own currency, so
that split has no floating point residue and a summary of many expenses adds up to the same total you
would get by hand.</p>
<p>An empty category is not left blank. If you have told the server that Adobe means software, the same
sentence without a category still files it under software, because <code>expense_add</code> checks the
stored merchant rules before it gives up and leaves the field empty.</p>

<h2>Categories that learn from you, not from a fixed list</h2>
<p><code>category_rules</code> holds a list of match-to-category pairs. Each match is tried first as a
case-insensitive regular expression and, if that is not valid regex, as a plain substring, so "adobe" or
"amazon.*office" both work without escaping. The first rule that matches wins. Call
<code>category_rules</code> with no arguments to see what is stored, or replace the whole list at once:
no machine learning, no confidence score, just the rule you wrote read back to you exactly.</p>

<h2>Mileage from a rate table, not a guess</h2>
<p>"Log a 45 km trip in Poland for a client meeting in Krakow, billable to Acme" prices itself:
<code>mileage_add</code> multiplies distance by the region's rate and rounds once. The built-in table is
PL 1.15 PLN per km, UK 0.45 GBP per mile, US 0.70 USD per mile and EU 0.30 EUR per km. 45 km at the Polish
rate is 45 x 1.15 = 51.75 PLN, stored as an expense in PLN with no VAT rate, because mileage allowances are
not usually VAT-bearing. With no region given, kilometres default to the EU rate and miles to the US rate;
<code>rate_per_km</code> overrides the table entirely if your own employer or tax authority sets a
different figure. These are convenience defaults, not tax advice: check the rate your own authority allows
for the year before you rely on it.</p>

<h2>Receipts you can prove later</h2>
<p><code>receipt_attach</code> takes a path to the receipt file, checks that it exists, and stores the path
together with a sha256 of its bytes. That hash is the part worth having: if the file on disk is ever
edited or replaced, the stored hash no longer matches it, so an audit later has a way to prove the receipt
attached to an expense is the same file that was there when the expense was logged.</p>

<h2>Summaries, always per currency</h2>
<p>"How much did I spend on software this quarter, and what is still billable to Acme" runs
<code>expense_summary</code> grouped by category, project, month or merchant, reporting the gross, the net
and the VAT for each group. Currencies are never mixed: an expense in PLN and one in EUR appear as two
lines under the same category rather than one wrong total. <code>expense_list</code> answers narrower
questions the same way, with totals per currency for whatever date range and filters you gave it.</p>

<h2>Rebilling without taxing twice</h2>
<p>The point of marking an expense billable is to get it onto a client's invoice, and the wiring to
<a href="/guides/invoice-pdf-from-chat">the invoice server</a> is the part worth being precise about.
<code>expense_to_invoice</code> takes a project and a date range and returns line items shaped exactly as
<code>invoice_create</code> expects: <code>{description, quantity, unit_price, tax_rate}</code>. The
<code>unit_price</code> it sends is the <strong>net</strong> amount, not the gross, and <code>tax_rate</code>
carries the VAT rate along with it. The invoice server then computes its own tax line from
<code>unit_price</code> and <code>tax_rate</code>, which lands on the same 11.50 EUR of VAT the expense
already split out. If the rebill sent the gross 61.50 EUR as the unit price instead, the invoice would add
23% VAT on top of an amount that already included VAT once, over-charging the client by the whole VAT
figure. Because one invoice carries one currency, expenses in more than one currency come back grouped by
currency, and you pass one group per invoice. Expenses are marked rebilled once sent, so asking again for
the same project and range does not bill the client twice; <code>include_rebilled</code> and
<code>mark_rebilled</code> exist for the times you want to override that.</p>

<h2>Export and free tier</h2>
<p><code>expense_export</code> writes a date range to csv, xlsx or json and never writes a partial file: if
a limit would be exceeded, nothing is created at all and the tool says why. Free covers unlimited logging
of expenses, mileage and receipts, a 30-day window on <code>expense_list</code> and
<code>expense_summary</code>, 3 projects, 5 category rules, csv and json export up to 200 rows, and
<code>expense_to_invoice</code> for up to 20 items at cost price. Pro ($19 once) opens full history,
unlimited projects and rules, xlsx export, and a <code>markup_percent</code> on the rebill. Full comparison
in <a href="/guides/mcp-server-free-vs-pro">free versus Pro</a>. Product page:
<a href="/s/expense-tracker">MCP Expense Tracker</a>, which pairs with
<a href="/s/invoice">MCP Invoice</a> for the rebill above and
<a href="/s/time-tracker">MCP Time Tracker</a> for the hours on the same project, covered in
<a href="/guides/track-time-in-claude-code">the time tracking guide</a>.</p>

<h2>Connect without installing</h2>
<p>Claude.ai, the Claude Desktop connector dialog and several IDE pickers take a remote URL and nothing
else, so the command above is not the only way in. <a href="/mcp/connect">mcp/connect</a> mints a token
and prints a ready-to-paste URL for every server, including expense-tracker, and the
<a href="/setup/claude-web/expense-tracker">claude.ai and Claude Desktop setup page</a> has the exact
steps.</p>

<h2>Checking the ledger against the bank</h2>
<p>Logging an expense here does not confirm the money actually left an account. <a href="/s/bank-statement">MCP
Bank Statement</a> imports the CSV export from the bank and can flag debits that have no matching expense
logged in this server, or the reverse. See
<a href="/guides/bank-statement-csv-categorize-reconcile">categorizing and reconciling a bank CSV export</a>.</p>
${FOOT}`,
    faq: [
      { q: "How exactly is VAT split out of a receipt amount?", a: "The amount you give is the gross figure on the receipt. net = round(gross * 100 / (100 + vat_rate)) and vat = gross - net, so net plus VAT always equals the gross exactly. 61.50 EUR at 23% VAT splits to net 50.00 EUR and VAT 11.50 EUR." },
      { q: "What are the mileage rates and can I use my own?", a: "The built-in table is PL 1.15 PLN/km, UK 0.45 GBP/mile, US 0.70 USD/mile, EU 0.30 EUR/km, with EU used by default for kilometres and US for miles. rate_per_km overrides the table with your own figure and currency. These are convenience defaults, not tax advice." },
      { q: "Does rebilling an expense charge VAT twice?", a: "No. expense_to_invoice sends the net amount as unit_price and the original rate as tax_rate, so invoice_create computes the same VAT figure once. Sending the gross amount instead would tax an already-taxed figure a second time, which is why the server sends net." },
      { q: "How does it prove a receipt file has not been altered?", a: "receipt_attach stores the file's path together with a sha256 hash of its bytes at the moment you attach it. If the file is later edited or swapped, the stored hash no longer matches it, which is what an audit checks." },
      { q: "Is anything uploaded when I log an expense or export a report?", a: "No. All data is stored in a plain JSON file under ~/.local/share/mcp-servers/expense-tracker/, and the server makes no network calls at all. Exports write to a local path you choose or the server's own data directory." },
    ],
  },
  "currency-conversion-ecb-rates-in-claude": {
    title: "Convert currencies in Claude with real ECB rates, no API key",
    description: "Dated ECB reference rates in chat: why ECB, what happens on a weekend, and how to rebill a project in one currency without typing a rate.",
    html: `<h1>Convert currencies in Claude with real ECB rates, no API key</h1>
<p>Most currency tools give you a number with no date on it. That is fine for curiosity and useless for
an invoice, because the question an accountant asks is not "what is the rate" but "which rate did you
use, and on what date". The MCP Currency Converter reads the European Central Bank's published euro
foreign exchange reference rates, states the rate date in every answer, and needs no API key, no
account and no rate limit, because the ECB publishes the files openly.</p>

<h2>Install</h2>
<pre><code>claude mcp add currency -- npx -y @theluckystrike/mcp-currency</code></pre>
<p>Cursor and Claude Desktop take the same server as a config block:</p>
<pre><code>{
  "mcpServers": {
    "currency": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-currency"]
    }
  }
}</code></pre>
<p>The npm publish of the package is pending, so until it lands use the <code>.mcpb</code> bundle from
the latest release or a clone and build. Exact config paths per client are on the
<a href="/setup/claude-desktop/currency">setup pages</a>.</p>

<h2>Why the ECB series and not a rate API</h2>
<p>Three reasons, in the order they matter. It is the series tax authorities and accountants already
accept, so a converted invoice line is defensible. It is keyless: the two files,
<code>eurofxref-daily.xml</code> and <code>eurofxref-hist.xml</code>, are public downloads, so there is
no signup, no quota and no key to rotate out of a config file. And it is small enough to cache, so the
server keeps answering on a plane: the daily file is refreshed only when the local copy is more than 6
hours old, the history file after 24 hours.</p>
<p>The cost is honesty about what these rates are. They are reference rates published once a day, around
16:00 CET, for accounting and reporting. They are not dealing rates. The number your bank actually
charges you will differ, and the server says so rather than implying you can trade on it.</p>

<h2>The rule that most tools get wrong: 30% of dates have no rate</h2>
<p>The ECB publishes on TARGET business days only. There is no rate for a Saturday, a Sunday, 1 January,
Good Friday, Easter Monday, 1 May, 25 December or 26 December. That is not a small gap. Counting the
published history file directly: the series runs from 1999-01-04 to 2026-09-02, which is 10,104 calendar
days, and it holds 7,084 dates. 29.9% of all calendar dates in the series carry no rate at all. Taking
single years, 2025 has 255 published dates out of 365 and 2024 has 256 out of 366, both 30.1% missing.</p>
<p>So a tool that looks up a date and returns nothing fails on nearly one date in three, and a tool that
quietly returns the next rate it can find is inventing a number your client can check. This server
applies the convention every bank uses: the last rate published on or before the date you asked for,
the nearest previous business day, and the answer names the date it landed on and why. Ask for a rate on
a Sunday and you get Friday's rate, labelled as Friday's rate.</p>
<pre><code>rate_on { pair: "USD/PLN", date: "2026-08-30" }   # a Saturday
  -> rule: nearest previous business day
  -> rate date 2026-08-28, stated in the answer</code></pre>

<h2>Cross rates and rounding</h2>
<p>The ECB quotes everything against the euro, so a USD/PLN rate is a cross rate. The ratio is formed at
full precision, rounded once to 6 decimals, and that rounded rate is the number the result is computed
from. The consequence is the one that matters in a document: the rate printed in the answer reproduces
the amount printed in the answer. Results are rounded to the target currency's own ISO 4217 minor units,
so JPY comes back whole and BHD to three places.</p>

<h2>Chaining fx_rates_for into expense_to_invoice</h2>
<p>This is the reason the server exists rather than a conversion widget. The
<a href="/s/expense-tracker">expense tracker</a> can fold a set of expenses in several currencies into
one invoice currency, but <code>expense_to_invoice</code> will not fetch or invent a rate: you have to
hand it an <code>fx_rates</code> object. <code>fx_rates_for</code> returns exactly that object, plus the
rate date. Three calls, no rate typed by a human:</p>
<pre><code>expense_to_invoice { project: "Nova", from, to }
  -> which currencies are actually present: EUR, GBP

fx_rates_for { target: "USD", currencies: ["EUR", "GBP"] }
  -> { "EUR": 1.0812, "GBP": 1.2717 }, rate date 2026-09-02

expense_to_invoice { project: "Nova", target_currency: "USD", fx_rates: { ... } }
  -> one currency, every converted line annotated

invoice_create { currency: "USD", items: [ ... ] }</code></pre>
<p>The prompt <code>convert_invoice_lines</code> walks that whole chain in one step. Put the returned
<code>invoice_note</code>, which reads "Converted at ECB reference rates of 2026-09-02", on the document,
and the client can verify every line against a public file.</p>

<h2>Free tier and Pro</h2>
<p>Free covers the latest rates, <code>convert</code>, <code>convert_many</code>,
<code>fx_rates_for</code> and history windows up to 90 days, unlimited, in all of the 30 or more
currencies the ECB quotes. Pro ($19 once) opens any date and any window back to 1999-01-04. A refused
window returns the reason and the exact narrower call to make; it never truncates a table silently.
Product page: <a href="/s/currency">MCP Currency Converter</a>. Side by side with the alternatives:
<a href="/compare/currency">currency comparison</a>.</p>
${FOOT}`,
    faq: [
      { q: "Does it need an API key or an account?", a: "No. The ECB publishes eurofxref-daily.xml and eurofxref-hist.xml as open files, so there is no signup, no key and no quota. The only network request the server makes is to www.ecb.europa.eu, and only when the local cache is older than 6 hours for the daily file or 24 hours for the history." },
      { q: "What rate do I get for a Saturday or a public holiday?", a: "The last rate published on or before that date, which is the nearest previous business day convention banks use, and the answer states which date it landed on. This matters more than it sounds: 29.9% of the calendar dates in the ECB series carry no rate of their own." },
      { q: "Can I use these rates on an invoice?", a: "Yes, and that is what they are for. They are the published reference rates used for accounting and reporting. They are not dealing rates, so your bank's rate will differ. Put the returned invoice_note with the rate date on the document so the client can check it." },
      { q: "How do I rebill a multi-currency project in one currency?", a: "Call expense_to_invoice to see which currencies are present, fx_rates_for to get the fx_rates object for your target currency, then expense_to_invoice again with target_currency and that object. The expense tracker never fetches a rate itself, by design, so nothing is invented." },
      { q: "Does it work offline?", a: "After the first download, yes. Both ECB files are cached under ~/.local/share/mcp-servers/currency/ and every answer is served from that copy until it ages out. Set ECB_BASE_URL to a mirror if outbound access is restricted." },
    ],
  },

  "word-documents-proposals-from-chat": {
    title: "Generate Word proposals and contracts from a chat message",
    description: "Say the proposal in one sentence and get a real .docx. Layouts, reference numbers, template fill that survives split runs, and no PDF export.",
    html: `<h1>Generate Word proposals and contracts from a chat message</h1>
<p>A proposal is the least interesting document you write and the one that most often decides whether
you get paid. The MCP Docx server turns one sentence into a real <code>.docx</code>: letterhead, cover
title, summary, scope, deliverables, a timeline table, a priced investment table and a signature block.
It writes Word files rather than PDFs on purpose, because the client is going to want a change to clause
four and you want them to be able to make it.</p>

<h2>Install</h2>
<pre><code>claude mcp add docx -- npx -y @theluckystrike/mcp-docx</code></pre>
<p>Cursor and Claude Desktop take the same server as a config block:</p>
<pre><code>{
  "mcpServers": {
    "docx": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-docx"]
    }
  }
}</code></pre>
<p>The npm publish is pending, so until it lands use the <code>.mcpb</code> bundle from the latest
release or a clone and build. Per client paths are on the
<a href="/setup/claude-code/docx">setup pages</a>.</p>

<h2>Set the letterhead once</h2>
<p><code>business_set</code> stores the sender block printed on every document: name, address, email,
VAT id, IBAN, bank, logo, letterhead colour, default currency, tax rate and payment terms. It is the
same field set as <a href="/s/invoice">MCP Invoice</a>, so one profile serves both and the proposal you
accepted becomes the invoice you send. A missing profile never blocks a document; the response tells you
the sender block is a placeholder.</p>

<h2>A proposal in one call</h2>
<pre><code>You: Write a proposal for Beta Corp. Checkout rebuild, 4,500 EUR, 50% on
signature 50% on delivery, three phases: discovery 1 week, build 3 weeks,
launch 1 week. Valid until the end of the year.

  proposal_create {
    client: "Beta Corp", project_title: "Checkout rebuild",
    scope: ["Audit the current funnel", "Rebuild the checkout", "Ship and measure"],
    timeline: [{phase: "Discovery", duration: "1 week"}, ... ],
    price: {amount: 4500, currency: "EUR", terms: "50% on signature, 50% on delivery"},
    valid_until: "2026-12-31"
  }
  -> PROP-2026-0001, EUR 4,500.00
  -> ~/.local/share/mcp-servers/docx/documents/checkout-rebuild.docx</code></pre>
<p>The file opens in Word, Pages, LibreOffice and Google Docs. Every amount carries its currency code,
so there are no bare numbers for a client to misread. References are <code>PROP-YYYY-NNNN</code> for
proposals and <code>AGR-YYYY-NNNN</code> for agreements, and the counter is written before the record is
stored, so a crash burns a number rather than reusing one on a second sent document.</p>

<h2>Contracts, with the caveat printed on the document</h2>
<p><code>contract_create</code> writes a freelance service agreement skeleton: parties, services, term,
fee, IP, confidentiality, contractor status, termination, liability and governing law, with
<code>[BRACKETED PLACEHOLDERS]</code> where a decision is yours. The document itself says it is a
drafting template and not legal advice, because nothing here has been reviewed by a lawyer in any
jurisdiction. Treat it as the thing you send to a lawyer, not the thing you send to a client.</p>

<h2>Filling a template you already use</h2>
<p><code>doc_fill_template</code> replaces <code>{{placeholders}}</code> in an existing
<code>.docx</code> and writes a new file, keeping every style, table, header, footer and image, because
everything except the paragraphs it rewrites is copied byte for byte. Call it with no
<code>values</code> and it lists the placeholders the template actually contains, which is the fastest
way to end an argument about a name that did not get replaced.</p>
<p>The part worth knowing is why so many template fillers fail on real files. A <code>.docx</code>
paragraph is a sequence of runs, and Word routinely breaks a placeholder you typed as
<code>{{client}}</code> into three runs after an edit or a spell-check pass: <code>{{cli</code>,
<code>ent</code>, <code>}}</code>. Per-run replacement finds nothing and the document comes back with
the placeholder still in it, silently. This server substitutes on the joined text of each paragraph
instead, writes the result into the first run so its formatting survives, and blanks the remaining runs
of that paragraph. The trade is stated plainly: a paragraph that mixes bold and regular text around a
placeholder comes back in the first run's formatting. A placeholder with no value is left in place and
reported, never blanked.</p>

<h2>The numbering.xml insight</h2>
<p>Reading a document back uses no dependency at all. A <code>.docx</code> is a ZIP, so
<code>node:zlib</code> opens it and a small WordprocessingML walk pulls out paragraphs, heading levels
from <code>w:pStyle</code>, list items and tables in document order. One detail decides whether
<code>doc_read</code> is useful: in OOXML a numbered list and a bullet list are the same element. The
distinction lives nowhere in the paragraph itself. It is recorded only by resolving that paragraph's
<code>w:numId</code> against <code>word/numbering.xml</code>. Skip that resolution and every numbered
list in the file reads back as bullets, which quietly destroys the structure of exactly the documents
people want to read back: contracts, scopes of work and anything with numbered clauses.</p>

<h2>There is no doc_to_pdf, deliberately</h2>
<p>Every pure JavaScript path from Word to PDF needs a native dependency, a headless Chromium or a cloud
API. This collection ships none of those, so <code>npx</code> works on any machine with Node and nothing
else. <code>doc_to_html</code> writes semantic HTML with a print stylesheet: open it and print to PDF.
The tool description says the same thing, so the model does not promise a file it cannot produce.</p>

<h2>Free tier and Pro</h2>
<p>Free covers <code>doc_create</code>, <code>doc_from_markdown</code>, <code>doc_read</code> and
<code>doc_to_html</code> without limit, 3 proposals or contracts per calendar month combined, and
templates with up to 10 placeholders. Pro ($19 once) removes those limits and adds your logo and brand
colour on the letterhead. Product page: <a href="/s/docx">MCP Docx</a>. Side by side with the
alternatives: <a href="/compare/docx">docx comparison</a>.</p>
${FOOT}`,
    faq: [
      { q: "Can it export a PDF?", a: "No, and that is a deliberate choice. Every pure JavaScript route from .docx to PDF needs LibreOffice, a Chromium binary or a cloud API, none of which this collection ships. doc_to_html writes semantic HTML with a print stylesheet, so you open it and print to PDF." },
      { q: "Why did my template placeholder not get replaced?", a: "Call doc_fill_template with no values and it lists the placeholders the file actually contains. Names are matched exactly, whitespace inside the braces is ignored, and the response names every key you passed that the template does not have. Placeholders split across runs by Word are handled, because substitution runs on the joined paragraph text." },
      { q: "Is the generated contract safe to sign?", a: "Not as it stands. contract_create writes a drafting skeleton with bracketed placeholders and prints on the document that it is a template and not legal advice. Nothing in it has been reviewed by a lawyer in any jurisdiction. Send it to yours." },
      { q: "Can it read an existing Word file?", a: "Yes. doc_read extracts headings with levels, paragraphs, list items and tables in document order, and format json returns the block structure. It reads .docx only; .doc, .rtf and Pages files are refused with a message that says so. It does not report fonts, colours, comments, tracked changes or footnotes." },
      { q: "Where do the files and the reference numbers live?", a: "Under ~/.local/share/mcp-servers/docx/, with generated files in a documents subfolder when you do not pass out_path. Every mutating call runs inside an advisory lock, so two clients on one data directory cannot allocate the same reference number. The server makes no network request of any kind." },
    ],
  },

  "meeting-slots-across-time-zones": {
    title: "Find a meeting time across time zones without doing the arithmetic",
    description: "Ranked slots inside everyone's working hours, the real overlap, DST traps that move it by an hour, and an ics file you can send. All local.",
    html: `<h1>Find a meeting time across time zones without doing the arithmetic</h1>
<p>Scheduling with a client in another country is a small calculation you get wrong once a year, usually
in March. The MCP Timezone Planner answers it directly: ranked times where every participant is inside
their own working hours, the exact daily overlap, the dates the clocks change, and a
<code>.ics</code> file you can send. It reads no calendar and stores nothing but the contacts you give
it.</p>

<h2>Install</h2>
<pre><code>claude mcp add timezone -- npx -y @theluckystrike/mcp-timezone</code></pre>
<p>Cursor and Claude Desktop take the same server as a config block:</p>
<pre><code>{
  "mcpServers": {
    "timezone": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-timezone"]
    }
  }
}</code></pre>
<p>The npm publish is pending, so until it lands use the <code>.mcpb</code> bundle from the latest
release or a clone and build. Per client paths are on the
<a href="/setup/cursor/timezone">setup pages</a>.</p>

<h2>The overlap is not a constant, and March proves it</h2>
<p>Take the pair a lot of European freelancers actually work: Warsaw and New York, both on 09:00 to
17:00 days. Ask what the shared window is and the honest answer depends on the date, because Europe and
the United States change their clocks on different weekends.</p>
<table>
<thead><tr><th>Date</th><th>Warsaw</th><th>New York</th><th>Shared window, UTC</th><th>Overlap</th></tr></thead>
<tbody>
<tr><td>2026-09-10</td><td>UTC+2</td><td>UTC-4</td><td>13:00 to 15:00</td><td>2 hours</td></tr>
<tr><td>2026-03-16</td><td>UTC+1</td><td>UTC-4</td><td>13:00 to 16:00</td><td>3 hours</td></tr>
</tbody>
</table>
<p>On 16 March 2026 the United States has already moved to daylight time, on 8 March, and Europe has not,
until 29 March. For those three weeks the two cities are 5 hours apart rather than the usual 6, and the
shared working window is 50% wider: 3 hours instead of 2. A recurring call booked at the edge of the
window in that gap moves outside somebody's working day on 29 March. This is the single most useful
thing the server tells you, and it falls out of <code>overlap</code> because the window is computed on a
real date rather than from a stored offset.</p>
<pre><code>overlap { places: ["Warsaw", "New York"], date: "2026-03-16" }
dst_changes { place: "Warsaw", year: 2026 }
  -> the exact UTC instant, the offset before and after, and the local time either side</code></pre>

<h2>Ranked slots, and why the score is the worst person</h2>
<p><code>find_meeting_slots</code> proposes times on a 30-minute grid where the whole meeting, start to
end, is inside every participant's own working window on their own local calendar day. Weekends in the
first participant's zone are skipped. Every candidate is scored by the worst participant's distance from
13:00 local, in hours, and sorted ascending.</p>
<p>The worst, not the average, on purpose. Averaging lets a slot that is pleasant for two people and
07:00 for the third outrank one that is 10:00 for everybody, which is how scheduling tools produce
suggestions nobody accepts. A fairness of 0 would put the meeting at midday for all of them, and
anything under about 2 is comfortable.</p>
<pre><code>find_meeting_slots {
  participants: [{name:"Me", zone:"Warsaw"},
                 {name:"Client", zone:"New York"},
                 {name:"Designer", zone:"London"}],
  duration_minutes: 60, days: 5
}
-> 15 slots fit all 3. Best: 2026-09-07T13:30:00.000Z, fairness 3.00h
   Me 15:30-16:30 | Client 09:30-10:30 | Designer 14:30-15:30</code></pre>
<p>Three hours of fairness is not a ranking flaw, it is the truth about that pair: with 09:00 to 17:00
on both sides the shared window is only two hours wide, so somebody's meeting is always far from the
middle of their day. The score says so instead of hiding it. Widen one person's hours and it improves.
When nothing fits at all, the server says so and shows the windows rather than proposing a 06:00 call.</p>

<h2>The invite</h2>
<pre><code>ics_create { title: "Kickoff with Acme", start: "2026-09-10 15:00", zone: "Warsaw",
             duration_minutes: 45, attendees: ["maria@acme.com"] }
  -> DTSTART 2026-09-10T13:00:00.000Z</code></pre>
<p>The file carries UTC times and no <code>VTIMEZONE</code> block, deliberately: a hand written
<code>VTIMEZONE</code> with stale DST rules is the classic way an invite lands an hour off in somebody
else's calendar. A time with no offset is wall-clock time in <code>from_zone</code>, so
<code>2026-09-10 15:00</code> with Warsaw means 15:00 in Warsaw. A wall time inside a spring-forward gap
does not exist and resolves to the instant right after the jump, which is what calendars do; an
ambiguous time in the autumn fold resolves to the first occurrence.</p>

<h2>How places are resolved</h2>
<p>City and country names resolve through a built-in table of 510 entries covering more than 300 cities,
every commonly used country, US state shorthands and abbreviations like PST, IST and CET. Every entry is
checked against <code>Intl.supportedValuesOf("timeZone")</code> at startup, and an entry this Node build
cannot resolve is dropped with a line on stderr rather than silently answering with the wrong zone. An
unknown name is never guessed: it comes back as an error with suggestions. IANA ids always win, so
<code>America/Denver</code> is exactly that. No DST rules are stored here at all; every offset comes
from the ICU data inside your Node build, so the rules stay current as Node updates.</p>

<h2>What it does not know</h2>
<p>Working hours are the only calendar this server has. It does not read your existing meetings, does
not know public holidays unless you pass them to <code>business_days</code>, and does not model a
Friday-Saturday weekend. Saying so is cheaper than a wrong suggestion.</p>

<h2>Free tier and Pro</h2>
<p>Free covers <code>now</code>, <code>convert_time</code>, <code>overlap</code>,
<code>dst_changes</code> and <code>business_days</code> without limit, slot searches for up to 3
participants over 5 days, 5 saved contacts and 3 <code>.ics</code> files a month. Pro ($19 once) removes
those limits and adds recurring slot search. Product page:
<a href="/s/timezone">MCP Timezone Planner</a>. Side by side with the alternatives:
<a href="/compare/timezone">timezone comparison</a>.</p>
${FOOT}`,
    faq: [
      { q: "Does it read my calendar?", a: "No. It knows only the working hours you give it and the contacts you save. It writes .ics files; it never reads or connects to a calendar service, and it makes no network request at all, including for license activation." },
      { q: "How is daylight saving handled?", a: "It stores no DST rules of its own. Every offset is read from the ICU data inside your Node build via Intl, so it stays current as Node updates. That is why Warsaw and New York come out 5 hours apart between 8 and 29 March 2026 rather than the usual 6, which widens their shared working window from 2 hours to 3." },
      { q: "Why is the best slot still awkward?", a: "Because a real overlap can be two hours wide. Slots are scored by the worst participant's distance from 13:00 local, not the average, so a time that is pleasant for two people and 07:00 for a third never outranks one that is 10:00 for everybody. The score reports the cost so you can decide who absorbs it." },
      { q: "Does it handle half-hour zones?", a: "Yes. India at +05:30, Nepal at +05:45, Adelaide at +09:30 and Chatham are handled like any other zone. The slot grid is 30 minutes, so a half-hour zone produces starts on the hour and the half hour in local time." },
      { q: "Why does the ics file have no VTIMEZONE block?", a: "Because a hand-written VTIMEZONE with stale DST rules is the common way an invite arrives an hour off. The file carries UTC times instead, which every calendar client resolves against its own current rules." },
    ],
  },
  "resume-and-cover-letter-from-chat": {
    title: "Write a resume and a cover letter from chat, without inventing anything",
    description: "One stored profile, a resume trimmed to the page, and a letter whose every proof line is a bullet you wrote. Measured: 0 of 10 postings leaked a number.",
    html: `<h1>Write a resume and a cover letter from chat, without inventing anything</h1>
<p>An assistant will happily write you a cover letter. The problem is not the prose, it is that the
prose contains claims. Ask for a letter for a payments role and you get a sentence about scaling a
platform to a throughput figure that appears nowhere in your career, because the figure was in the job
posting. MCP Resume and Cover Letter exists to make that impossible: you store your facts once, and
every output is assembled from those facts and nothing else.</p>

<h2>Install</h2>
<pre><code>claude mcp add resume -- npx -y @theluckystrike/mcp-resume</code></pre>
<p>Cursor and Claude Desktop take the same server as a config block:</p>
<pre><code>{
  "mcpServers": {
    "resume": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-resume"]
    }
  }
}</code></pre>
<p>The npm publish is pending, so until it lands use the <code>.mcpb</code> bundle from the latest
release or a clone and build. Per client paths are on the
<a href="/setup/claude-code/resume">setup pages</a>. The document engine is shared with
<a href="/s/docx">MCP Docx</a> rather than duplicated, so a clone build lists both.</p>

<h2>Store the profile once</h2>
<p><code>profile_set</code> takes name, email, phone, location, links, a summary, skills, roles with
their bullets, education, certifications and languages. You can dictate it in one message, or point
<code>resume_read</code> at a <code>.docx</code> you already have and let it read the sections back into
the profile shape. Nothing is saved from a read unless you pass <code>save: true</code>, and a role it
could not parse lands in <code>unparsed</code> rather than being dropped quietly.</p>

<h2>The measured surprise: profiles are too thin, not too fat</h2>
<p>The obvious worry about a resume generator is that it will not fit. It was probed from both ends.
With 300 experience bullets stored, a one-page request kept 78 and dropped 222, filling 390 words
against a 392-word budget, in 27 ms. That is the case everybody designs for.</p>
<p>The case that actually happens looked different. Driving the server with the real Claude CLI against
a realistic profile, a one-page modern resume targeting a senior backend role used <strong>134 of a
361-word budget</strong> and dropped <strong>zero</strong> bullets. The trimmer never engaged. Against
the posting in the same session, coverage came back at 75%, with a required keyword missing entirely.</p>
<p>So the constraint on a real application is not space, it is evidence. The tool that earns its place
is <code>tailor_to_job</code>, which returns the keywords the posting asks for, the ones your profile
already supports, the ones it does not, and a coverage figure. Missing keywords never become skills,
and the response says so in plain words. The right response to 75% is to add a true fact to your
profile, not to let something add a false one to your resume.</p>

<h2>The fact-integrity rule</h2>
<p>This is enforced in code rather than asked for in a prompt, and it has five parts.</p>
<p><strong>Every proof line is a verbatim bullet.</strong> The letter quotes what you wrote. It never
paraphrases a bullet into a stronger claim.</p>
<p><strong>A highlight you pass is checked first.</strong> If your profile does not support it, it is
printed as a bracketed prompt saying so, not as a claim.</p>
<p><strong>Every digit run is checked before the file is written.</strong> A number that traces neither
to your profile nor to the arguments you passed is a refusal: the tool returns an error and writes
nothing. The job description is deliberately not an allowed source, because the employer's revenue and
headcount are theirs, not yours. Comparison is on whole numbers, so a profile holding
<code>2012</code> does not license a letter claiming <code>12</code>. Ten letters were generated against
ten postings stuffed with figures: zero posting numbers reached a letter.</p>
<p><strong>Proof lines are printed under the role that holds them.</strong> An audit caught the opposite
behaviour and it was the worst defect found in this server: every ranked bullet was printed under the
most recent employer's heading, so work done at a previous job read as work done at the current one.
That is a fabricated fact from the one tool whose entire promise is that it fabricates none. The letter
now emits one heading per employer it quotes.</p>
<p><strong>A bullet with no figure asks you for one.</strong> It gets <code>[add: metric]</code>
appended rather than a guessed result. The response lists every bracketed prompt in
<code>fills_required</code>, so the letter tells you what it is short of instead of covering it.</p>

<h2>How the page budget works</h2>
<p>There is no page-layout engine in pure JavaScript and this server does not pretend to have one. It
uses a word budget: a full A4 page at 11pt with 2cm margins holds about 520 words of body text, and a
resume spends roughly a seventh of the page on headings, blank lines and the contact block, which gives
450 words per page, or 540 in the <code>compact</code> style. Contact block, summary, skills, role
headers, education, certifications and languages are counted first; the remainder goes to experience
bullets, highest score first. Every role keeps its first bullet before any role gets a second, so
trimming never leaves a job on the page with nothing under it. The response reports the budget, the
words used, the estimated pages and every bullet dropped, so you see the decision rather than discover
it in Word.</p>

<h2>Keywords that are two characters long</h2>
<p>The keyword extractor used to delete every token under three characters as noise, which is correct
until the token is <code>Go</code>, <code>R</code>, <code>C#</code>, <code>ML</code> or <code>UI</code>.
Ties used to break by length, so <code>everywhere</code> outranked <code>kafka</code>. Both are fixed:
short skills are kept, a known skill outranks a longer word of the same frequency, and matching is on
word boundaries, so <code>go</code> does not match <code>Google</code>.</p>

<h2>There is no resume_to_pdf</h2>
<p>Every pure JavaScript route from Word to PDF needs a native dependency, a headless browser or a cloud
API, and this collection ships none of them. <code>resume_to_html</code> writes semantic HTML with a
print stylesheet: open it and print to PDF. <code>resume_to_markdown</code> covers the application form
that wants plain text in a box.</p>

<h2>Free tier and Pro</h2>
<p>Free covers the profile, the <code>modern</code> style, markdown and HTML export without limit, three
cover letters per calendar month, and tailoring against postings up to 2,000 characters. Pro ($19 once)
adds all three styles, unlimited letters and tailoring, named profile variants and your own accent
colour. Product page: <a href="/s/resume">MCP Resume and Cover Letter</a>. Side by side with the
alternatives: <a href="/compare/resume">resume comparison</a>. Everything runs locally: your employment
history makes no network request, including for licence checks.</p>
${FOOT}`,
    faq: [
      { q: "Can it write a cover letter about something not in my profile?", a: "No, and it fails loudly rather than quietly. Every digit run in the letter is checked against your profile and the arguments you passed before the file is written; a number that traces to neither returns an error and writes nothing. A highlight the profile does not support is printed as a bracketed prompt, not as a claim." },
      { q: "Does the job posting count as a source of facts?", a: "Deliberately not. The employer's revenue, headcount and throughput figures are theirs. Ten letters were generated against ten postings full of numbers and none of those numbers reached a letter." },
      { q: "What happens if I have too much experience for one page?", a: "Bullets are ranked by keyword hits and recency and trimmed against a word budget of 450 words per page, 540 in compact style. Every role keeps its first bullet before any role gets a second, and the response names every bullet it dropped. With 300 bullets stored, a one-page request kept 78." },
      { q: "Can it export a PDF?", a: "No. Every pure JavaScript route from Word to PDF needs a native dependency or a cloud API, and this collection ships neither. resume_to_html writes HTML with a print stylesheet, so you open it and print to PDF, and resume_to_markdown covers plain-text application boxes." },
      { q: "Does my CV leave my machine?", a: "No. The server reads and writes files on your computer, stores the profile under your data directory, and makes no network request of any kind. Pro keys are Ed25519 signatures verified locally, so even activation is offline." },
    ],
  },

  "recurring-invoices-on-a-schedule": {
    title: "Bill a retainer on a schedule without a billing SaaS",
    description: "Define the schedule once, generate the invoices that fell due, and run it twice safely. Month-end clamping, the idempotency key and the 60-invoice cap.",
    html: `<h1>Bill a retainer on a schedule without a billing SaaS</h1>
<p>A retainer is the easiest money to invoice and the easiest to forget. The amount does not change, the
date does not move, and that is exactly why nobody notices when a month goes unbilled. MCP Recurring
Invoices holds the schedule so you do not have to: client, line items, cadence, start date, terms. When
you ask, it creates the invoices that have actually fallen due as real records in
<a href="/s/invoice">the invoice server</a>, with its number series, its client list and its A4 PDF.</p>

<h2>Install</h2>
<pre><code>claude mcp add recurring -- npx -y @theluckystrike/mcp-recurring</code></pre>
<pre><code>{
  "mcpServers": {
    "recurring": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-recurring"]
    }
  }
}</code></pre>
<p>The npm publish is pending, so until it lands use the <code>.mcpb</code> bundle from the latest
release or a clone and build; build <code>servers/invoice</code> first, because the engine is imported
from it. Per client paths are on the <a href="/setup/claude-code/recurring">setup pages</a>. Install the
invoice server too: this one has no <code>business_set</code> of its own on purpose, so there is exactly
one issuer profile to keep correct.</p>

<h2>One schedule, then nothing</h2>
<pre><code>schedule_create {
  client: "Acme Retainer", currency: "EUR", every: "monthly",
  start_date: "2026-06-01", due_days: 14,
  items: [{ description: "Retainer hours", quantity: 12, unit_price: 90 }]
}
-> schedule 9f2c1a04, next dates 2026-06-01, 2026-07-01, 2026-08-01, 2026-09-01</code></pre>
<p>Cadences are <code>weekly</code>, <code>monthly</code>, <code>quarterly</code>, <code>yearly</code> or
<code>{days: n}</code>. Occurrence 0 is the start date itself, so a schedule starting today is due
today. <code>end_date</code> is inclusive: an occurrence landing exactly on it is generated and the next
one is not.</p>

<h2>The month-end rule</h2>
<p>This is the part a naive date library gets wrong, and getting it wrong changes a client's payment
date permanently. The month step keeps the day of month of the start date and clamps it to the length of
the target month, and it <strong>never carries the clamp forward</strong>. From
<code>2026-01-31</code> the series is 01-31, <strong>02-28</strong>, 03-31, 04-30, 05-31.</p>
<p>The naive version adds one month to 31 January, lands on 28 February, and then adds one month to that,
so March becomes the 28th and every month after it does too. February silently turns a month-end
retainer into a 28th-of-the-month retainer, and nobody reads the invoice date closely enough to catch
it. The same rule makes a yearly schedule starting <code>2028-02-29</code> fall on 02-28 in common years
and back on <strong>02-29</strong> in the next leap year, because the anchor day is 29 throughout.</p>
<p>On Pro, <code>anchor_day</code> replaces the day of month before clamping, so
<code>anchor_day: 31</code> means the last day of every month regardless of what the start date was, and
<code>end_of_month: true</code> says the same thing explicitly. Both are ignored for
<code>weekly</code> and <code>{days: n}</code>, which have no month to anchor to. An anchored first
occurrence that would land before the start date is dropped rather than billed early.</p>

<h2>The idempotency key is the period, not the day</h2>
<p>Here is the run that matters. On 3 September, against the schedule above:</p>
<pre><code>invoice_generate_due {}
-> as_of 2026-09-03: created 4 invoices, skipped 0 already invoiced.
   INV-2026-0001  period 2026-06-01  EUR 1080.00  due 2026-06-15
   INV-2026-0002  period 2026-07-01  EUR 1080.00  due 2026-07-15
   INV-2026-0003  period 2026-08-01  EUR 1080.00  due 2026-08-15
   INV-2026-0004  period 2026-09-01  EUR 1080.00  due 2026-09-15
   Total: EUR 4320.00

invoice_generate_due {}      # five minutes later, having forgotten
-> as_of 2026-09-03: created 0 invoices, skipped 4 already invoiced.</code></pre>
<p>The second call is the whole design. The key written to the history is
<code>(schedule_id, period)</code>, not a timestamp and not the calendar day the run happened on. That
choice is what makes a billing run safe to repeat, safe to run from two clients, and safe to run after
a crash halfway through. Key it on the run date instead and a second run on a different day re-bills
everything; key it on the day and a run at 23:59 followed by one at 00:01 does the same. Because the
period is the key, "did I already bill September" is a question the data answers rather than one you
have to remember, and <code>dry_run</code> shows you the run before it happens.</p>
<p>The same key survives deletion. Deleting a schedule keeps its history rows deliberately, so a
re-created schedule cannot double-bill a period that was already invoiced, and the tool warns when a new
schedule's periods were covered by an old one.</p>

<h2>Why a run is capped at 60 invoices</h2>
<p>A mistyped year is an ordinary typo. Before the cap existed, a schedule starting 1900-01-01 offered
1,520 due periods, and one call with <code>as_of: "2126-01-01"</code> on a plain monthly schedule
created <strong>1,193 real invoices and 1,193 PDFs, 6.0 MB in 6.8 seconds</strong>, burning 1,193
numbers out of the shared invoice number series. Numbers are never reused, so that damage is permanent
in the sequence a tax authority reads. A run now stops at 60, oldest periods first, and the answer says
how many are still due. Idempotency is untouched by the cap, because the key is still the period: another
call simply continues.</p>

<h2>Two locks, always in the same order</h2>
<p>Anything that writes an invoice takes the recurring lock first and the invoice lock second, always in
that order, so a billing run and a hand-written invoice in the other server cannot interleave, cannot
allocate the same number and cannot deadlock. Numbers are allocated inside the lock and the PDFs are
rendered after it is released, so a slow render never holds up the counter.</p>
<p>One more thing worth knowing: if <code>schedules.json</code> or <code>history.json</code> is
unreadable, it is never treated as empty. The file is moved aside byte for byte, a marker is written and
every tool fails loudly until you restore it. A history file read as empty would re-bill every period
the schedule has ever covered, which is the worst failure this server could have.</p>

<h2>What it does not do</h2>
<p>Nothing runs in the background. This is a stdio MCP server: it exists while your client runs it.
There is no daemon, no cron and no email, so invoices appear when you ask for them, typically through
the <code>monthly_billing_run</code> prompt. Delivering the invoice and chasing payment are still yours;
<code>overdue_report</code> in the invoice server tells you who to chase. There is no proration, no
mid-period cancellation credit and no currency conversion.</p>

<h2>Free tier and Pro</h2>
<p>Free gives 3 active schedules, unlimited generation, a 30 day upcoming view and a 3 month forecast.
Pro ($19 once) gives unlimited schedules, a 10 year horizon, a 120 month forecast, the
<code>schedule_history</code> audit log and the anchor day and end of month rules. Product page:
<a href="/s/recurring">MCP Recurring Invoices</a>. Side by side with the alternatives:
<a href="/compare/recurring">recurring billing comparison</a>. The one-sentence invoice for everything
that is not on a retainer is in <a href="/guides/invoice-pdf-from-chat">the invoice guide</a>.</p>
${FOOT}`,
    faq: [
      { q: "What happens if I run the billing twice?", a: "Nothing the second time. The history key is the schedule id plus the period, not the run date, so a repeated run reports created 0, skipped 4. That is what makes it safe to run from two clients, after a crash, or when you cannot remember whether you already did it." },
      { q: "My retainer bills on the 31st. What happens in February?", a: "It bills on 28 February, then back on 31 March. The month step keeps the start date's day of month and clamps it to the target month's length without carrying the clamp forward, so February does not permanently move a month-end retainer to the 28th." },
      { q: "Does it send the invoice to my client?", a: "No. It creates the invoice record and renders the PDF into the invoice server's store. Delivery and chasing are yours; overdue_report in the invoice server lists who is late." },
      { q: "Where do the generated invoices go?", a: "Into the invoice server's own data directory, with the PDFs in its pdf subfolder, so they appear in invoice_list, count in overdue_report and can be re-rendered with invoice_pdf. Both servers must see the same XDG_DATA_HOME or you end up with two stores." },
      { q: "Can one call create hundreds of invoices by accident?", a: "Not any more. A run is capped at 60 periods, oldest first, and says how many remain. Before the cap, one call with a mistyped as_of year created 1,193 invoices and PDFs and burned 1,193 numbers out of a series that never reuses one." },
    ],
  },

  "contract-clauses-library-assembly": {
    title: "Assemble a contract from your own clause library, in chat",
    description: "Twenty-five starter freelance clauses with variables, ranked search, and an assembled Word file whose unfinished facts are visible. Not legal advice.",
    html: `<h1>Assemble a contract from your own clause library, in chat</h1>
<p>The way most freelancers write a contract is to open last year's signed one, save a copy, and change
every name. It works until the third find-and-replace, when a paragraph keeps the previous client's
jurisdiction and nobody notices for a year. MCP Clause Library replaces the copy with a library: the
paragraphs you reuse, kept as clauses with <code>{{variables}}</code> in them, searched, filled and
assembled into a numbered document.</p>

<h2>This is not legal advice</h2>
<p>Stated first because it decides how you should use the rest of the page. The 25 starter clauses are
generic freelance templates in plain language. They are not drafted for your country, your trade or your
deal, and no clause here has been reviewed by a lawyer. Every starter carries the note that it is a
generic template, and every document <code>contract_assemble</code> writes opens with the line: generic
template, not legal advice, have a qualified lawyer review this document before you sign it. That
sentence is a constant in the source, prepended to the <code>.docx</code> and to the markdown and
returned in the tool's own JSON response, so it cannot be lost by choosing a different output format.
Treat what comes out as the draft you take to a lawyer, not the contract you send to a client.</p>

<h2>Install</h2>
<pre><code>claude mcp add clauses -- npx -y @theluckystrike/mcp-clauses</code></pre>
<pre><code>{
  "mcpServers": {
    "clauses": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-clauses"]
    }
  }
}</code></pre>
<p>The npm publish is pending, so until it lands use the <code>.mcpb</code> bundle from the latest
release or a clone and build. Per client paths are on the
<a href="/setup/cursor/clauses">setup pages</a>. The document engine is shared with
<a href="/s/docx">MCP Docx</a>, so a clone build lists both.</p>

<h2>What ships in the box</h2>
<p>Twenty-five starter clauses across eleven categories, in assembly order: scope (scope of work,
revisions, acceptance of deliverables, change requests), payment (payment terms, late payment, kill fee,
rush fee), expenses, IP (assignment, portfolio and credit), confidentiality, data protection, term,
liability, warranty, disputes, and eight general clauses covering governing law, force majeure,
independent contractor status, non-solicitation, notices, entire agreement, severability and assignment.
<code>clause_add</code> puts your own next to them, and a deleted starter is not re-seeded on the next
call, so pruning the set to the ones you actually use is permanent.</p>

<h2>Variables are the whole mechanism</h2>
<p>A clause body holds placeholders such as <code>{{client}}</code>, <code>{{contractor}}</code>,
<code>{{project}}</code>, <code>{{fee}}</code>, <code>{{currency}}</code>,
<code>{{payment_days}}</code>, <code>{{deposit_percent}}</code>, <code>{{late_fee_percent}}</code>,
<code>{{liability_cap}}</code>, <code>{{notice_days}}</code>, <code>{{revision_rounds}}</code>,
<code>{{acceptance_days}}</code>, <code>{{kill_fee_percent}}</code>,
<code>{{rush_fee_percent}}</code> and <code>{{jurisdiction}}</code>.</p>
<p>The tool that makes this usable is <code>variables_list</code>, which takes the clauses you picked and
returns every variable they need and which clause needs it, <em>before</em> you assemble anything. That
is the difference between filling in a form you can see and discovering a blank in Word. Variables are
read in first-appearance order, declared ones first and then any the body uses without declaring, so a
clause you wrote in a hurry still reports what it actually needs rather than what it claims to.</p>
<pre><code>variables_list { clause_ids: ["scope-of-work", "payment-terms", "late-payment",
                              "intellectual-property-assignment", "governing-law"] }
-> client, contractor, project, fee, currency, payment_days,
   late_fee_percent, jurisdiction</code></pre>

<h2>A missing fact is printed, never guessed</h2>
<p>Assemble with the values you have and the rest are not left as raw <code>{{braces}}</code>, not
blanked, and not invented. They come back as a visible bracketed prompt in the document text, such as
<code>[late fee percent]</code>, and the response also returns the real names in
<code>unfilled</code>. The document you open is therefore readable by a human as a document, with the
unfinished parts obvious at a glance, while the machine-readable list of what is missing stays exact.</p>
<p>The prompt is printed with spaces rather than underscores for a measured reason. The shared document
engine parses inline markdown, so <code>[late_fee_percent]</code> reaches Word as
<code>[latefeepercent]</code>: the pair of underscores is read as an italic marker and dropped, taking
the word boundaries with it. Printing the prompt with spaces is both safe for the writer and easier for
a person to fill in, and <code>unfilled</code> keeps the underscored names for anything programmatic.
This is the sort of defect that never throws an error and never looks wrong enough to catch by eye.</p>

<h2>Search, assemble, export</h2>
<p><code>clause_search</code> ranks over titles, tags, categories and bodies, and a title match outranks
a body mention, so "late payment" finds the late payment clause rather than every clause that mentions
paying late. <code>contract_assemble</code> takes clause ids or whole categories, orders them by
category rank, numbers them, fills the variables, brackets what is missing, prepends the disclaimer and
writes <code>.docx</code> or markdown.</p>
<p>Assembling to markdown first is worth the extra call: it is the version you can read line by line in
an editor, and the <code>.docx</code> is the version you send. <code>clause_export</code> writes the
whole library to markdown on the free tier, which means the terms you reuse can live in a repository and
be diffed like anything else you maintain, rather than existing only inside one machine's data
directory. <code>clause_import</code> reads the same markdown shape back.</p>

<h2>Free tier and Pro</h2>
<p>Free gives the 25 starters plus 10 clauses of your own, ranked search and category filtering, up to 8
clauses per assembled document, and markdown import and export. Pro ($19 once) gives unlimited clauses,
jurisdiction and tag filters, JSON import and export, unlimited clauses per document and version history
on <code>clause_update</code>. Everything stays on your machine and the server makes no network call at
all. Product page: <a href="/s/clauses">MCP Clause Library</a>. Side by side with the alternatives:
<a href="/compare/clauses">clause library comparison</a>. The clause you agreed on payment terms is the
term you bill on: see <a href="/guides/recurring-invoices-on-a-schedule">recurring invoices</a> and
<a href="/guides/word-documents-proposals-from-chat">Word proposals and contracts</a>.</p>
${FOOT}`,
    faq: [
      { q: "Are these clauses safe to sign?", a: "No. They are generic freelance templates in plain language, not drafted for your country, your trade or your deal, and no clause has been reviewed by a lawyer. Every assembled document opens with a line saying it is a generic template and not legal advice. Take the output to a qualified lawyer." },
      { q: "What happens to a variable I do not fill in?", a: "It is printed in the document as a visible bracketed prompt such as [late fee percent], never blanked and never guessed, and the response returns the exact names in unfilled. Run variables_list on your selection first and the document tells you what it needs before it exists." },
      { q: "Why does the bracketed prompt use spaces instead of underscores?", a: "Because the shared document engine parses inline markdown, so [late_fee_percent] reaches Word as [latefeepercent]: the underscore pair is read as an italic marker and dropped. The printed prompt uses spaces, and the machine-readable unfilled list keeps the real underscored names." },
      { q: "Can I keep my clause library in version control?", a: "Yes. clause_export writes the whole library to markdown on the free tier and clause_import reads the same shape back, so the terms you reuse can be committed and diffed. JSON import and export is a Pro feature." },
      { q: "Does it replace the contract generator in the docx server?", a: "They do different things. MCP Docx writes a fixed freelance service agreement skeleton in one call. This server assembles a document from the specific clauses you keep and have edited, which is what you want once your terms have diverged from a generic template." },
    ],
  },

  "connect-mcp-servers-without-installing": {
    title: "Connect MCP servers to Claude.ai, Claude Desktop, Cursor and VS Code without installing anything",
    description: "A remote MCP URL, no config file: claude.ai and Desktop connectors, Claude Code, Cursor, VS Code, what is kept, and where it falls short of local.",
    html: `<h1>Connect MCP servers to Claude.ai, Claude Desktop, Cursor and VS Code without installing anything</h1>
<p>Every setup guide on this site so far has started with a config file: <code>claude_desktop_config.json</code>,
<code>.cursor/mcp.json</code>, <code>.vscode/mcp.json</code>. That is the right route for a server that reads
and writes files on your own disk. It is the wrong route the first time you just want to try something, and
it is not a route at all inside claude.ai in a browser, which has no filesystem to put a config file on.
That gap is what a remote MCP connector closes.</p>

<h2>What a remote MCP connector actually is</h2>
<p>An MCP server does not have to run as a local process talking over stdio. It can run as an HTTP endpoint
that speaks the MCP streamable HTTP transport, and a client that supports remote servers connects to it
the same way a browser connects to a website: with a URL. No process starts on your machine, nothing is
installed, and there is nothing to keep updated. <a href="${BASE}/mcp/connect">${BASE}/mcp/connect</a>
mints an anonymous token and prints one such URL per server, shaped like
<code>${BASE}/mcp/&lt;server&gt;/t/&lt;token&gt;</code>. Paste it where a client asks for a remote server
URL and the connection works with no headers: the token is already in the path, not in an Authorization
field you have to remember to set.</p>

<h2>Claude.ai and Claude Desktop: custom connectors</h2>
<p>Anthropic's own documentation describes this as a Custom Connector. On an individual Pro or Max plan,
Customize, Connectors, the + button, Add custom connector opens a form asking for a name and a Remote MCP
server URL, with an Advanced settings section for an optional OAuth Client ID and Client Secret. Paste the
URL from <code>/mcp/connect</code>, leave the OAuth fields blank, click Add, then Connect. On a Team or
Enterprise plan the same form exists but only an Owner or Primary Owner can use it, at Organization
settings, Connectors, Add, Custom, Web; members then connect to what the Owner added rather than pasting
their own URL. That distinction is documented by Anthropic, not a guess: it was read from the support
article and confirmed with a direct fetch before this page was written, not assumed from how other
products work.</p>

<h2>Claude Code: one command</h2>
<p>Claude Code accepts a remote server on the command line:</p>
<pre><code>claude mcp add --transport http time-tracker ${BASE}/mcp/time-tracker/t/&lt;token&gt;</code></pre>
<p>No header is required for the token form, because it is already in the URL; a Pro key works the same way,
placed in the URL instead of the free token.</p>

<h2>Cursor and VS Code: a remote entry, not a local one</h2>
<p>Cursor's <code>.cursor/mcp.json</code> and VS Code's <code>.vscode/mcp.json</code> both accept a server
entry that is a URL instead of a command and args. In Cursor:</p>
<pre><code>{
  "mcpServers": {
    "time-tracker": { "url": "${BASE}/mcp/time-tracker/t/&lt;token&gt;" }
  }
}</code></pre>
<p>The full field-by-field entry for each client, including VS Code's <code>servers</code> key and the
streamable HTTP type Cline needs written in explicitly, is on the <a href="/setup">per-client setup
pages</a> for each server.</p>

<h2>What is kept, and for how long</h2>
<p>A token maps to an anonymous tenant with no account, no email and no name attached. What gets stored
against it is only what each server needs to answer the next call: timer entries, invoice numbers,
clause text, whatever that server's own data model holds, scoped to that token. A token that goes idle is
swept after 30 days. A file a hosted call generates, such as an invoice PDF or a filled Word document,
does not sit on a disk you can browse: it comes back as a download link that expires after one hour, so
the practical habit is to save it in the same session you generate it. Checking out for Pro on
<code>/buy/&lt;product&gt;?tenant=&lt;token&gt;</code> binds that Pro purchase to the token, and from then
on the same URL you were already using carries Pro limits with no key to paste and no new URL to switch
to.</p>

<h2>Honest limits</h2>
<p>The hosted route is not a like-for-like replacement for a local install, and three gaps are worth
knowing before you rely on it. Invoices render as HTML rather than a locally-rendered PDF file on this
remote path; the download link opens the invoice in a browser, which prints to PDF but is not the same
file object as a stdio install writes to disk. The spreadsheet server runs in an inline mode over the
hosted route: it reads and returns data in the response rather than writing a converted file back to a
folder, because there is no folder on the other end of an HTTP call. And there is no receipts feature on
this path: <code>receipt_attach</code> wants a real file path on a filesystem the connector does not have,
so expense entries taken through a connector carry amounts and a description rather than an attached
file. None of these are bugs to be fixed later so much as the shape of running server-side instead of on
your own machine; a local install through <a href="/setup">the config-file route</a> does not have any of
them.</p>

<h2>Which one to use</h2>
<p>Use the connector URL to try a server in under a minute, to use it from claude.ai in a browser where no
local install is possible at all, or on a machine you do not want to run a local process on. Move to a
local, stdio install once you are relying on filesystem features it does not have: a spreadsheet server
that should write files back to your project, receipts you want kept as real attached files, or invoice
PDFs that need to land on disk rather than behind a one-hour link.</p>
${FOOT}`,
    faq: [
      { q: "Does connecting need OAuth?", a: "No. The Add custom connector form in claude.ai and Claude Desktop offers an Advanced settings section with an OAuth Client ID and Client Secret, but the connect-by-URL route does not use it. Leave both blank; the token in the URL path is what authenticates the connection." },
      { q: "What if my organization is on a Team or Enterprise plan?", a: "Anthropic's documentation is specific here: only an Owner or Primary Owner can add a custom connector at the organization level, from Organization settings, Connectors, Add, Custom, Web. Members then connect to the URL the Owner added; they do not paste their own." },
      { q: "How long does an anonymous token last?", a: "A token that goes 30 days without a call is swept. A Pro key bound to a token has no such sweep, since binding happens on a paid checkout." },
      { q: "Why does a generated invoice or document come back as a link instead of a file?", a: "The hosted route has no filesystem to write to, so anything a server generates, a PDF, a filled Word document, a CSV, is handed back as a download link that expires after one hour rather than a path on disk." },
      { q: "Can I use a Pro key instead of the free token?", a: "Yes. Replace the token segment of the URL with a Pro key and the same connector uses Pro limits instead of the anonymous free tier, with no new URL and no re-adding the connector." },
    ],
  },

  "pdf-merge-split-stamp-from-chat": {
    title: "Merge, split and stamp PDFs from chat, and why some come back as glyph numbers",
    description: "Merge, split, extract, rotate and stamp PDFs from chat. What pdf_text can and cannot read, and how it tells a scan apart from a subset-font PDF.",
    html: `<h1>Merge, split and stamp PDFs from chat, and why some come back as glyph numbers</h1>
<p>Most PDF work a freelancer does is small: join three files into one, pull five pages out of a scan,
turn a contract the right way up, put PAID across an invoice before it goes in the archive folder.
None of that needs a desktop PDF editor, and none of it should mean uploading a client's invoice to a
web tool you do not run. MCP PDF Tools does the job in the chat, on your machine, in pure JavaScript
with no native dependency.</p>

<h2>Install it</h2>
<pre><code>claude mcp add pdf -- npx -y @theluckystrike/mcp-pdf</code></pre>
<p>Cursor's <code>.cursor/mcp.json</code> and Claude Desktop's <code>claude_desktop_config.json</code> take the
same block:</p>
<pre><code>{
  "mcpServers": {
    "pdf": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-pdf"]
    }
  }
}</code></pre>
<p>Nothing is uploaded. The server reads and writes files where you point it and makes no network request
of any kind, not even to check a licence key, which is verified offline.</p>

<h2>The jobs it actually does</h2>
<p><code>pdf_merge</code> joins files in the order given. <code>pdf_split</code> cuts a file into ranges, so
<code>"1-3,5,7-"</code> gives pages 1 to 3, page 5, and page 7 to the end. <code>pdf_pages</code> extracts a
specific set into a new file, and can repeat a page or reorder as it goes: <code>"5,1,1"</code> puts page 5
first and page 1 twice. <code>pdf_rotate</code> turns a sideways scan by a multiple of 90 degrees, added to
whatever rotation the page already carried. <code>pdf_stamp</code> draws text on the page, PAID and DRAFT as
presets in Free, any text, colour, position and size in Pro; a centred stamp goes on the 45-degree diagonal,
and it is drawn text, not a flattened image, so it can still be selected and searched afterward.
<code>pdf_watermark_business</code> reads the business name and VAT id that <code>business_set</code> in
mcp-invoice or mcp-docx already stored, and puts it in the footer of every page.</p>

<h2>Worked example</h2>
<pre><code>You: Stamp PAID on ~/invoices/INV-2026-0007.pdf and save a copy.

  pdf_stamp {
    path: "~/invoices/INV-2026-0007.pdf",
    text: "PAID",
    position: "center",
    out_path: "~/invoices/INV-2026-0007-paid.pdf"
  }
  -> Stamped "PAID" on 1 page
  -> ~/invoices/INV-2026-0007-paid.pdf, 0.9 MB</code></pre>
<p>The original file is byte-for-byte unchanged; every tool that writes refuses an <code>out_path</code>
that already exists unless you pass <code>overwrite: true</code>, and reserves every output path before it
writes any of them, so a multi-file <code>pdf_split</code> that fails on part 3 does not leave parts 1 and
2 behind as a half-finished job.</p>

<h2>What pdf_text can read, and what comes back as numbers instead of letters</h2>
<p>A PDF does not store text the way a Word document does. It stores drawing operators that place glyphs on
a page, and what those glyphs mean depends on the font's own encoding table. <code>pdf_text</code>
decompresses each page's content stream and reads the operators that show text, with no external PDF
library and no OCR. For a PDF written by a normal word processor or invoicing tool, with a standard or fully
embedded font, that gives back clean, readable text.</p>
<p>It breaks in one specific and common case: a subset-embedded font. A PDF that embeds only the glyphs it
actually uses, which is most PDFs a modern tool produces, often renumbers those glyphs into a private table
that has nothing to do with any standard character set, and some fonts go further and encode by a raw
glyph index (CID) rather than by character at all. The bytes the content stream hands to
<code>pdf_text</code> in that case are glyph numbers, not letters: extracting them without decoding that
table gives back digits or symbols that look like text extraction succeeded but read as nonsense, which is
worse than an empty result because nothing about it looks like an error.</p>
<p>The server does not pretend this case is a success. It does not carry a font-encoding decoder, so instead
of returning a string of glyph numbers as if it were the page's text, it checks whether what it extracted
comes back as recognisable characters, and when it does not, the answer says so directly: the font's
encoding is the reason, not a bug, and not a scan. A true scan, an image-only page with no text operators
at all, gets a different message: the page is probably a scan, because there is no OCR here and there will
not be one. Two different failure modes, two different reasons, in the answer, rather than one silent empty
string that leaves you guessing which one happened.</p>

<h2>What still needs a real editor</h2>
<p>There is no OCR, no form filling, no digital signatures, no redaction, and no PDF/A. Rotation is
recorded as page metadata in multiples of 90 degrees; nothing is redrawn. Stamp text goes through a
built-in font covering the WinAnsi character set, so characters outside it are dropped and counted in the
response rather than silently failing the write. Files over 100 MB are refused, because rewriting a PDF
needs several times its size in memory, and an encrypted file is refused by every writing tool with the fix
named in the message: open it in a reader with the password and export a new, unencrypted copy.</p>

<h2>Related</h2>
<p>Setup per client is on the <a href="/setup">setup pages</a>. <a href="/s/pdf">MCP PDF Tools</a> has the
full tool table and the free-vs-Pro limits. <a href="/guides/track-time-in-claude-code">Billable hours</a>
and <a href="/guides/invoice-pdf-from-chat">invoice PDFs</a> are the two guides most people read next,
since <code>mark_invoice_paid</code> chains an invoice lookup straight into <code>pdf_stamp</code>.</p>
${FOOT}`,
    faq: [
      { q: "Why did pdf_text return short strings of digits instead of words?", a: "The PDF's font uses a subset or CID encoding table this parser does not read, so the bytes in the content stream are glyph index numbers, not character codes. The answer names the font as the reason rather than returning the numbers as if they were text." },
      { q: "Does this server do OCR on scanned PDFs?", a: "No, and it will not. An image-only page has no text operators to read at all, and pdf_text says the page is probably a scan instead of returning an empty string with no explanation." },
      { q: "Can I merge more than 5 files on the free tier?", a: "No, 5 files is the free cap for pdf_merge. Files up to 30 pages are free for split, extract and rotate. Pro removes both limits." },
      { q: "Is the PAID stamp a flattened image?", a: "No, it is drawn text through a built-in PDF font, so it can still be selected and searched in a reader afterward, unlike a stamp burned in as a picture." },
      { q: "What happens to an encrypted PDF?", a: "Every tool that writes refuses it, with the reason and the fix in the message: open it in a reader with the password and export or print a new, unencrypted copy, then run the tool on that. pdf_info still reports encrypted: true, and pdf_count counts it as one unreadable file among the rest." },
    ],
  },

  "calendar-ics-free-busy-in-claude": {
    title: "Read a .ics calendar in Claude: free and busy, conflicts, and billable meetings",
    description: "Import a Google, Apple or Outlook .ics export and ask what is on, where you are free, and what clashes. Recurrence, DST and turning a call into billable time.",
    html: `<h1>Read a .ics calendar in Claude: free and busy, conflicts, and billable meetings</h1>
<p>A calendar app answers "what's on Tuesday." It does not answer "where did last month actually go,"
"which two things did I say yes to at the same time," or "how many billable hours were in that block of
calls." MCP Calendar answers those by reading the <code>.ics</code> file your calendar already exports, no
account connected, nothing synced, the file staying on your machine as plain text.</p>

<h2>Getting the .ics out first</h2>
<table>
<tr><th>App</th><th>Where</th></tr>
<tr><td>Google Calendar</td><td>Settings, Import &amp; export, Export. You get a zip; import the .ics inside it.</td></tr>
<tr><td>Apple Calendar</td><td>File, Export, Export...</td></tr>
<tr><td>Outlook (desktop)</td><td>File, Save Calendar, format iCalendar (.ics)</td></tr>
<tr><td>Outlook / Microsoft 365 (web)</td><td>Settings, Calendar, Shared calendars, Publish, then the ICS link (Pro)</td></tr>
</table>
<p>Any other app that publishes a feed URL ending in <code>.ics</code>, or a <code>webcal://</code> link, works
the same way on Pro. Then:</p>
<pre><code>ics_import {path: "~/Downloads/mike@example.com.ics", name: "work"}</code></pre>

<h2>Install it</h2>
<pre><code>claude mcp add calendar -- npx -y @theluckystrike/mcp-calendar</code></pre>
<p>Cursor and Claude Desktop take the same block, with <code>"calendar"</code> as the key under
<code>mcpServers</code>. There is exactly one network call in the whole server, and only when you pass a
<code>url</code> yourself, with a 12-second timeout, a 5 MB cap, and a refusal on loopback and
private-network addresses.</p>

<h2>Recurrence, properly expanded</h2>
<p>The parser was written against real exports, not just the RFC 5545 spec: line folding across CRLF, bare
LF and bare CR, escaped commas and semicolons, whole-day events with an exclusive <code>DTEND</code>,
<code>DURATION</code> in place of <code>DTEND</code>, both <code>TZID</code> and UTC times, floating times,
<code>RRULE</code> for daily, weekly, monthly and yearly series with <code>COUNT</code>, <code>UNTIL</code>,
<code>INTERVAL</code>, <code>BYDAY</code>, <code>BYMONTHDAY</code> and <code>BYMONTH</code>,
<code>EXDATE</code> and <code>RDATE</code> exceptions, a <code>RECURRENCE-ID</code> override replacing the
original occurrence instead of appearing twice, <code>STATUS:CANCELLED</code> and
<code>TRANSP:TRANSPARENT</code>. An event the parser cannot read is skipped and counted, not allowed to cost
you the rest of the file.</p>
<p><code>VTIMEZONE</code> blocks are deliberately ignored. A file's own DST rules are only as fresh as the
app that wrote it, so the server keeps the <code>TZID</code> name and computes every offset from the ICU
data inside Node itself. That is what keeps a weekly 10:00 Warsaw meeting at 10:00 local across the March
clock change instead of drifting to 11:00, and it is why a whole-day event spanning 1 to 3 June is 1 and 2
June: RFC 5545 makes a whole-day <code>DTEND</code> exclusive, and the parser follows the spec rather than
guessing what you meant.</p>

<h2>Free, busy and conflicts</h2>
<p><code>free_busy</code> merges overlapping events into busy blocks and reports the gaps inside your working
hours, day by day; an event marked <code>TRANSP:TRANSPARENT</code> does not count as busy. <code>conflicts</code>
checks every pair of events across every imported calendar at once, with the overlap in minutes, so a client
call that clashes with something on a personal calendar is caught even though the two never lived in the same
place before. <code>events_search</code> finds an event by title, description, location, organiser or
attendee text, and <code>next_event</code> answers "what's next, and how long until it starts."</p>

<h2>Turning a meeting into billable time</h2>
<p><code>event_to_time_entry</code> takes one event and returns the exact arguments the time tracker's
<code>entry_add</code> needs: project, task, date and duration read straight off the calendar instead of
retyped from memory. Nothing is guessed about the rate or the project; that mapping is what you supply when
you ask for it, the same way the price tracker and the invoice server hand off data without you restating
it. The prompt <code>plan_my_day</code> chains the whole loop: what is on, what clashes, where the gaps are,
and which finished meetings are worth billing.</p>

<h2>What it will not do</h2>
<p>It does not connect to a Google or Outlook account: no OAuth, no token, no sync, which also means an
import is a snapshot rather than a live view, and re-importing is how you catch up. It writes new
<code>.ics</code> files through <code>event_export</code> but never edits the calendar it read. Free covers 2
calendars, windows up to 31 days and exports up to 50 events; Pro removes all three limits and adds URL and
webcal feed imports.</p>

<h2>Related</h2>
<p>Setup per client is on the <a href="/setup">setup pages</a>. <a href="/s/calendar">MCP Calendar</a> has
the full tool table. It reads its time zone and .ics engine from
<a href="/guides/meeting-slots-across-time-zones">MCP Timezone Planner</a>, and hands finished meetings to
<a href="/guides/track-time-in-claude-code">MCP Time Tracker</a>.</p>
${FOOT}`,
    faq: [
      { q: "Does this connect to my Google or Outlook account?", a: "No. There is no OAuth, no token and no sync. You export a file, or paste a public feed URL on Pro, and it is read locally. An import is a snapshot, so re-import when the calendar has moved on." },
      { q: "Why is my whole-day event one day shorter than I expected?", a: "It is not: RFC 5545 makes DTEND exclusive for a whole-day event, so 1 to 3 June means the 1st and the 2nd. This server follows the spec, which is what your calendar app does too." },
      { q: "Does a weekly meeting stay at the right time across the DST change?", a: "Yes. VTIMEZONE blocks in the file are ignored on purpose, and every offset is computed from the ICU data inside Node from the TZID name, so a 10:00 Warsaw meeting stays 10:00 local through the March and October changes." },
      { q: "Can it write back to my calendar?", a: "No. event_export writes a new .ics file you can import anywhere, but the server never modifies the calendar it read from." },
      { q: "How big a file can it read?", a: "Up to 5 MB, which is a few thousand events. Export a narrower date range if a full history export is bigger than that." },
    ],
  },

  "kanban-board-in-claude-with-time-tracking": {
    title: "Run a kanban board in Claude, with time tracking on the same task",
    description: "Boards per project, due dates and estimates, and a timer that starts on the exact task. Covers the id counter under concurrent writers and the handoff to the time tracker.",
    html: `<h1>Run a kanban board in Claude, with time tracking on the same task</h1>
<p>A board and a timer are usually two apps, so the task you are billing and the task you are looking at
drift apart within a week. Say "add a task to the nova site board: write the launch email, due Friday, 90
minutes" and the MCP Kanban server creates the board if it does not exist yet, files the task in backlog,
and gives it a short id such as <code>NOVA-1</code>. Ask "what's on the nova board?" or "what's overdue?"
and it answers from the same file. The part that matters for billing is <code>task_start_timer</code>: it
does not start a timer itself, it hands back the exact project and task name for the time tracker's
<code>timer_start</code>, so the hours you log are never a re-typed guess at what the task was called.</p>

<h2>Install it</h2>
<pre><code>claude mcp add kanban -- npx -y @theluckystrike/mcp-kanban</code></pre>
<p>Cursor reads the same shape of config from <code>.cursor/mcp.json</code> (or the project-level file),
then restart Cursor:</p>
<pre><code>{
  "mcpServers": {
    "kanban": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-kanban"]
    }
  }
}</code></pre>
<p>Claude Desktop takes the identical block in <code>claude_desktop_config.json</code>. No account, no
API key: the server runs locally over stdio and writes to
<code>~/.local/share/mcp-servers/kanban/</code>.</p>

<h2>What a task actually carries</h2>
<p>A title, an optional project (a new name creates its board, and a partial name that matches exactly one
existing project is used as that project so "the nova board" and "nova" do not fork into two boards), a
column (backlog, todo, doing, review, done by default), a due date, an estimate, a priority and tags. Each
task's id is a short code like <code>NOVA-1</code> or <code>NOVA-A</code>, base36 of a counter that never
goes backward, so it stays stable once handed out even after the task is done or deleted.</p>

<h2>The id counter under two writers</h2>
<p>The counter that produces <code>NOVA-1</code>, <code>NOVA-2</code> and so on lives inside the same JSON
file as the board it numbers, not in a separate sequence file. That is fine for one client talking to one
server process. It stops being fine the moment a second client, a second Claude window, a second machine
on a synced folder, opens the same data directory: a load the counter, add one, save cycle with no lock lets
two processes both read counter 7, both increment it to 8, and both write a task numbered <code>NOVA-8</code>,
so one of the two tasks is silently gone under the same id the other one now owns. The fix already shipped
here is a lock file next to the data file: a writer takes an advisory lock before it reads the counter and
releases it after the save, so a competing writer waits its turn instead of reading a stale number. This is
tested directly, not assumed: two server processes pointed at one data directory fire 40 concurrent
<code>task_add</code> calls at the same board, and the suite asserts that all 40 tasks persist, that every
id is unique, and that the board's counter ends at exactly 41 (one seed task plus 40), not some smaller
number a lost write would have produced.</p>
<p>The practical reason this matters: it is the same failure mode a shared spreadsheet has when two people
edit a cell at once, except here the two writers are usually a background agent and you typing in the same
chat, both reaching for the board within the same second. Without the lock, the number stamped on your
invoice line could be numbering a task nobody remembers adding.</p>

<h2>Starting the timer from the task, not from memory</h2>
<p>"Start a timer on NOVA-3" calls <code>task_start_timer</code>, which returns the project and task name
to pass straight to the time tracker's <code>timer_start</code> and records the link on the task itself, so
a later "what's still running" or a report knows which board item earned those minutes. There is no shared
process between the two servers and no direct call from one into the other: the kanban server hands back
arguments, and it is the model (or you, reading the response) that makes the second call. That handoff is
the whole point of keeping the two servers separate rather than building a timer into the board: the same
task can also feed <code>task_log_time</code> directly, for minutes you tracked some other way, so
estimate and actual can be compared in the weekly review without ever starting a live timer.</p>

<h2>Planning and looking back</h2>
<p><code>board</code> gives a column-by-column summary with estimate and actual totals and an overdue
count. <code>overdue</code> lists everything past its due date across every board, and takes an
<code>as_of</code> date to check against a day other than today. <code>weekly_review</code> compares what
was planned against what actually got done, and estimate against actual, for a week; the current week is
free, past weeks are Pro. The prompt <code>plan_week</code> turns an open board into a day-by-day plan that
fits the hours you actually have, rather than listing everything at once.</p>

<h2>Free tier and Pro</h2>
<p>Free covers 3 project boards, 200 open tasks and the default five columns. Pro ($19 once, lifetime)
removes both limits, adds custom columns per board, full weekly review history, and estimate-versus-actual
reports for every week instead of only the current one. Product page:
<a href="/s/kanban">MCP Kanban</a>.</p>
${FOOT}`,
    faq: [
      { q: "Can two people or two agents use the same board at once?", a: "Yes, and that is the case the id counter is built for. A file lock around the read-increment-save cycle means two server processes writing to one data directory in parallel still hand out unique ids and lose no tasks, which is verified by a test that fires 40 concurrent task_add calls from two processes and checks every id and the final counter." },
      { q: "Does starting a timer from a task require the time tracker to be running?", a: "It requires the time-tracker server to be configured in the same client. task_start_timer only returns the arguments; it does not start anything itself, so without the time tracker installed you get the project and task name back and nothing else happens." },
      { q: "What happens to a task's id if I delete it?", a: "Nothing reuses it. The counter only moves forward, so a deleted NOVA-4 leaves a gap rather than handing NOVA-4 to the next task you add." },
      { q: "Can I rename the columns?", a: "On Pro, yes, per board, with columns_set. Tasks sitting in a column you remove move to the first column automatically rather than being dropped." },
      { q: "Where is the board data stored?", a: "Plain JSON under ~/.local/share/mcp-servers/kanban/ (or $XDG_DATA_HOME). Nothing is uploaded and there is no account." },
    ],
  },

  "image-resize-compress-watermark-from-chat": {
    title: "Resize, compress and watermark images from a chat message",
    description: "Resize, convert, crop, thumbnail, watermark and strip metadata with no upload. Covers why quantizing a PNG made a test file 2.9x larger, and how the server avoids it.",
    html: `<h1>Resize, compress and watermark images from a chat message</h1>
<p>"Make this 1200 pixels wide" or "get this under a megabyte" is normally a trip to a web uploader,
which is also the moment a client's product photo or a screenshot with something on screen leaves your
machine. The MCP Image server does the same small jobs locally: resize, convert between PNG, JPEG, BMP,
GIF and TIFF, compress with a real before-and-after byte count, crop, batch-thumbnail a folder, watermark
with your business name, and strip the EXIF and GPS block a phone camera writes into every photo. No
network call of any kind, not even for licensing.</p>

<h2>Install it</h2>
<pre><code>claude mcp add image -- npx -y @theluckystrike/mcp-image</code></pre>
<p>Cursor reads the same block from <code>.cursor/mcp.json</code>:</p>
<pre><code>{
  "mcpServers": {
    "image": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-image"]
    }
  }
}</code></pre>
<p>Claude Desktop takes the identical block in <code>claude_desktop_config.json</code>. Data lives under
<code>~/.local/share/mcp-servers/image/</code>: a register of the last 500 operations, not your images,
which stay where you put them.</p>

<h2>Why "compress" means something different for a PNG</h2>
<p>The tool most people reach for first is <code>image_compress</code>, and the surprising part is that
its one real knob, <code>quality</code>, only does anything on a JPEG output. A JPEG throws away detail to
get smaller, and quality controls how much. A PNG is lossless: there is no such dial, and a server that
silently accepted <code>quality: 40</code> for a PNG and returned the same file would look like it worked
while doing nothing.</p>
<p>Before shipping that behaviour, the alternative was actually tried: pass a PNG through palette
quantization, the standard way to shrink a PNG by cutting it down to a small fixed set of colours. Run
against a 300x220 noisy test PNG, quantizing to 16 colours did not shrink the file. It produced a 115,451
byte file against a 39,262 byte original, 2.9 times larger, because the encoder here still writes RGBA
either way, and quantizing colours destroys the row-to-row pixel similarity that PNG's own deflate step
was exploiting to compress in the first place. A tool that claims to compress and hands back a bigger file
is worse than one that is honest about which knob exists at all, so the server does not quantize. Instead
it reports the byte count before and after, the percentage saved, and the method that did the work, and if
compressing a PNG would only reduce it by resizing, it says so plainly: for a PNG the lever is
<code>max_width</code>, not <code>quality</code>. The output format follows the extension of
<code>out_path</code>, so the practical move for a PNG screenshot you actually want smaller is to write it
out as a <code>.jpg</code> instead, where quality applies and a photo typically drops 80 to 95 percent.</p>

<h2>The rest of the toolbox</h2>
<p><code>image_resize</code> fits inside a box, fills and crops the overflow, or stretches exactly, with
one of width or height following the other. <code>image_crop</code> refuses a rectangle that runs past an
edge rather than silently clamping it. <code>image_thumbnails</code> and <code>image_batch_resize</code>
reserve every output path before writing any of them, so a collision on file three does not leave files one
and two behind as a half-finished batch. <code>image_watermark</code> reads the shared business name from
the same profile the invoice and docx servers write, or takes custom text on Pro.
<code>image_dominant_colors</code> reports the hex codes that cover most of an image and the share each one
holds.</p>

<h2>What "strip metadata" actually removes</h2>
<p><code>image_strip_metadata</code> decodes the image to raw pixels and re-encodes from those pixels
alone, so EXIF, GPS coordinates, the camera and lens, the capture time, XMP packets and colour profiles are
not deleted one field at a time, they are simply never handed to the encoder. Every other writing tool here
has the same side effect: resizing a photo also drops its EXIF, since it goes through the same
decode-then-encode path.</p>

<h2>Refusing a decompression bomb before it decodes</h2>
<p>A 4 KB PNG can declare a 20,000 by 20,000 pixel canvas in its header. Decoding that allocates roughly
1.6 GB of raw RGBA and can take the process down before any size check written after the decode would ever
run, so the declared width and height are read out of the file's own header, PNG IHDR, the JPEG SOF
segment, the GIF logical screen descriptor, the BMP info header, the first TIFF IFD, and a file over
10,000 pixels on a side is refused there, with the memory it would have taken named in the error.</p>

<h2>Free tier and Pro</h2>
<p>Free covers <code>image_info</code> unlimited, and resize, convert, compress, crop and strip-metadata on
sources up to 4 megapixels, batches of 5 files. Pro ($19 once, lifetime) removes the size and batch limits,
opens custom watermark text instead of only the business name, and adds dominant-colour reports. Product
page: <a href="/s/image">MCP Image Tools</a>.</p>
${FOOT}`,
    faq: [
      { q: "Why did compressing my PNG not make it smaller?", a: "quality is a JPEG-only parameter; a PNG is lossless and has no such dial. A measured test of the obvious alternative, palette quantization, produced a file 2.9 times larger (115,451 bytes against 39,262) because quantizing destroys the pixel similarity PNG's own compression depends on. Use max_width for a PNG, or write the output as .jpg where quality genuinely shrinks the file." },
      { q: "Does this upload my photos anywhere?", a: "No. There is no network call of any kind, including for licence checks, which are verified offline. A client photo never leaves the machine it was resized on." },
      { q: "What image formats does it read and write?", a: "PNG, JPEG, BMP, GIF and TIFF, detected by magic bytes rather than file extension. No WebP, AVIF, HEIC or SVG: there is no pure JavaScript decoder for those worth shipping without a native dependency." },
      { q: "Can it edit the original file in place?", a: "No, on purpose. Every tool writes a new file and refuses to overwrite an existing out_path unless you pass overwrite: true, and an out_path that resolves to one of the inputs is refused outright so a result can never be written back over the source that produced it." },
      { q: "How big an image can it handle?", a: "Up to 50 MB on disk and 10,000 pixels per side on Pro; free tier tools cap sources at 4 megapixels. The pixel limit is checked from the file header before anything is decoded, specifically to refuse a decompression bomb." },
    ],
  },

  "bank-statement-csv-categorize-reconcile": {
    title: "Categorize and reconcile a bank CSV export from chat",
    description: "Import Revolut, Wise, mBank, PKO BP, ING or N26 exports, categorize with rules, and check which bank debits have no receipt behind them. The occurrence-index dedupe insight.",
    html: `<h1>Categorize and reconcile a bank CSV export from chat</h1>
<p>A bank export is a CSV with a preamble the bank added for humans, a header row somewhere under it, and
amounts written the way that bank's country writes numbers. "Import this Revolut export and categorize
it" is one sentence into the MCP Bank Statement server, and what comes back is a stored ledger: one row
per transaction, a sign that means the same thing on every row, and a category on the ones your rules
already cover. Nothing is uploaded. The file is read once, on your machine, into
<code>~/.local/share/mcp-servers/bank-statement/</code>.</p>

<h2>Install</h2>
<pre><code>claude mcp add bank-statement -- npx -y @theluckystrike/mcp-bank-statement</code></pre>
<p>Cursor, in <code>~/.cursor/mcp.json</code>:</p>
<pre><code>{
  "mcpServers": {
    "bank-statement": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-bank-statement"]
    }
  }
}</code></pre>
<p>Claude Desktop and the other clients take the same block under their own config file; see the
<a href="/setup">setup pages</a> for the exact file and key per client.</p>

<h2>Seven shapes of the same CSV</h2>
<p><code>statement_import</code> ships a profile for Revolut, Wise, mBank, PKO BP, ING and N26, plus a
generic reader that works from the headers alone when a bank matches none of the six. Each one is a real,
measured quirk read off that bank's own export, not a guess:</p>
<ul>
<li><strong>Revolut</strong> signs the amount itself, positive or negative, and a row with
<code>State: REVERTED</code> is dropped rather than counted twice.</li>
<li><strong>Wise</strong> writes the date day first and carries a separate merchant column the generic
reader would otherwise fold into the description.</li>
<li><strong>mBank</strong> puts three lines of preamble above the header, uses <code>;</code> as the
delimiter, and writes an amount like <code>-19,99 PLN</code> with the currency code inside the same
cell as the number.</li>
<li><strong>PKO BP</strong> writes every amount positive and puts the direction in a separate
<code>Typ transakcji</code> column instead of the sign.</li>
<li><strong>ING</strong> names its amount column <code>Kwota transakcji (waluta rachunku)</code>, which
the generic reader would not recognize as an amount at all.</li>
<li><strong>N26</strong> states the currency only once, inside the header itself,
<code>Amount (EUR)</code>, not in a column of its own.</li>
<li>Anything else falls back to the <strong>generic reader</strong>: a header row found under any
preamble, and either one signed amount column or a debit and a credit column read separately.</li>
</ul>
<p><code>statement_import</code> reports back what it detected (the bank, the header line, the date order,
the number locale), what it stored, how many lines were duplicates of what is already there, and every
line it skipped with the reason, rather than silently dropping a row it could not parse.</p>

<h2>Locale amounts, read correctly once</h2>
<p>A number is only unambiguous if you know which country wrote it. <code>1 234,56</code> from an mBank
export and <code>1,234.56</code> from a US bank both mean one thousand two hundred and thirty four units
and a bit, but a parser that assumes one style over the other turns a Polish grocery bill into a number a
thousand times too small or too large. The importer sniffs the locale from the file's own delimiter and
decimal mark rather than assuming a locale from the bank name, and every amount is stored the same way
regardless of source: a debit negative and a credit positive, once, at import, so nothing downstream has
to re-derive the sign from a column that might not exist for a different bank.</p>

<h2>The dedupe insight: an occurrence index, not a row index</h2>
<p>Re-importing the same file should add nothing, and two identical purchases on the same day should still
be two transactions, not one. Those two requirements pull in opposite directions, and the naive fix for
each breaks the other. A key built from date, amount and description alone collapses two identical EUR
3.50 coffees bought on the same day into a single stored transaction, silently understating the month by
one coffee. Adding a plain row index instead breaks re-import, because a bank that reorders its export, or
inserts one late-settling line, shifts every index after it, so the same transaction gets a different key
the second time the file is imported and is stored twice.</p>
<p>The key that works is date, amount, currency, account and description, plus the count of identical rows
seen so far in this file, compared against the count of identical rows already stored: the Nth identical
line in the new file matches the Nth identical line already on record. Measured on a 60-row fixture: 60
transactions stored on the first import, 60 duplicates reported and 0 stored on re-importing the exact
same file. Two identical coffees on one day still come out as two rows. Eight concurrent imports of one
file across two server processes on the same data directory still leave exactly the transactions that file
actually contains, because the occurrence count is read inside the same file lock as the write, not
computed and then written separately.</p>

<h2>Rules that categorize as transactions arrive</h2>
<p><code>category_rules</code> sets or lists the rules that assign a category. A plain rule is a
case-insensitive substring match against the description or counterparty. Setting <code>regex: true</code>
compiles the pattern, but only if it cannot backtrack exponentially against a crafted description; a
pattern shaped like <code>(a+)+</code> is refused and the rule falls back to matching as a literal
substring instead of hanging the server on one bad rule. Setting rules re-applies them to every stored
transaction immediately, so a rule added after import still categorizes the month you already brought in.
<code>transaction_categorize</code> sets the category directly by transaction id when a rule is not worth
writing for a one-off.</p>

<h2>Summaries that never mix currencies</h2>
<p><code>statement_summary</code> reports money in, money out and the net for a date range, grouped by
category, month, account or counterparty. Every total is kept per currency rather than added together,
because 100 EUR plus 100 USD is not 200 of anything real. Import a Revolut account holding EUR and USD
alongside a PKO BP account in PLN and the summary comes back as three separate totals, not one wrong one.</p>

<h2>Reconciling against the expense tracker</h2>
<p>The point of a receipt is that it should show up on the bank statement, and the point of a bank line is
that some receipt should explain it. <code>reconcile_expenses</code> matches bank debits against the
receipts logged in <a href="/s/expense-tracker">the expense tracker</a> by the same currency, the same
amount, inside a date window, and reports three things: matches, bank lines with no receipt behind them,
and receipts that never reached the bank at all, which usually means a card payment that has not settled
yet or an expense logged against the wrong account. The expense ledger is only ever read; reconciling never
writes anything into it. On a seeded test store this found one match one day apart and one expense with no
matching bank line, which is exactly the shape of a receipt logged on the day of purchase against a card
payment that settled the next day.</p>

<h2>Finding the subscriptions</h2>
<p><code>recurring_detect</code> looks for the same counterparty charging an amount that barely moves on a
steady cadence, and reports the cadence, the typical amount, the next expected date and the cost
annualised. On the 60-row test fixture it found a monthly Spotify charge, three occurrences, EUR 9.99,
annualised to EUR 119.88. That annualised figure is the number worth asking for once a quarter: a monthly
charge nobody looks at again is the easiest line item to forget you are still paying.</p>

<h2>Free tier and Pro</h2>
<p>Import always stores every row regardless of tier; silently dropping lines on the way in would make the
stored ledger disagree with the actual bank statement. Free covers 2 accounts, the last 12 months read
back, 5 category rules, and unlimited import, list, search and summary. Pro ($19 once, lifetime) removes
the account and history limits, opens unlimited rules, <code>reconcile_expenses</code>,
<code>recurring_detect</code> and <code>statement_export</code> to csv or json. Full detail on
<a href="/s/bank-statement">the MCP Bank Statement page</a>, and the general
<a href="/guides/mcp-server-free-vs-pro">free versus Pro</a> comparison.</p>
${FOOT}`,
    faq: [
      { q: "Which banks does it read directly?", a: "Revolut, Wise, mBank, PKO BP, ING and N26 each have a dedicated profile tuned to that bank's own column names, sign convention and preamble. Any other bank falls back to a generic reader that finds the header row and either a signed amount column or separate debit and credit columns." },
      { q: "Will importing the same file twice double my numbers?", a: "No. Every row is keyed on its date, amount, currency, account, description and the count of identical rows seen so far, so a second import of an unchanged file stores 0 new transactions and reports the rest as duplicates. Two genuinely identical purchases on the same day still both count." },
      { q: "How are amounts in a different locale handled, like 1 234,56 from mBank?", a: "The importer detects the file's own delimiter and decimal mark rather than assuming one locale for every bank, so 1 234,56 and 1,234.56 both resolve to the same underlying amount. A debit is stored negative and a credit positive at import, once, so nothing downstream has to guess the sign again." },
      { q: "Can it tell me which receipts never showed up on the bank statement?", a: "Yes, with reconcile_expenses, a Pro feature. It matches bank debits against the receipts logged in the expense tracker by currency, amount and a date window, and reports matches, unmatched bank lines and unmatched receipts separately. The expense ledger is only ever read." },
      { q: "Is any of this uploaded anywhere?", a: "No. The server makes no network calls at all, not for import, not for licensing. Statements are parsed locally and stored in plain JSON under ~/.local/share/mcp-servers/bank-statement/; deleting that directory resets it." },
    ],
  },

  "quotes-and-estimates-to-invoice-in-claude": {
    title: "Send a quote from chat, then turn the yes into an invoice",
    description: "The quote lifecycle: create, send as text, chase, accept or decline. Validity is computed in your business timezone, and an accepted quote is invoiced from its own stored lines, not recomputed.",
    html: `<h1>Send a quote from chat, then turn the yes into an invoice</h1>
<p>A quote and an invoice are the same document at two different moments: one is a price you are
proposing, the other is a price you are owed. Most tooling treats them as unrelated, so the numbers get
retyped between a quoting tool and a billing tool, and the two can drift apart. The MCP Quotes server
keeps them as one lifecycle: "quote Acme for 12 hours at 90 EUR plus a 300 EUR setup, 23% VAT, good for
14 days" gets you a numbered quote with a line table, VAT and a validity date, and "Acme said yes" turns
that same quote into a real invoice in the <a href="/s/invoice">invoice server</a>'s own store, same
client list, same number series. Nothing is uploaded; everything lives in plain JSON on your machine.</p>

<h2>Install</h2>
<pre><code>claude mcp add quotes -- npx -y @theluckystrike/mcp-quotes</code></pre>
<p>Cursor and Claude Desktop take the same block, under their own config file:</p>
<pre><code>{
  "mcpServers": {
    "quotes": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-quotes"]
    }
  }
}</code></pre>
<p>Build <code>servers/invoice</code> first if you are running from source: the money, VAT, client and
numbering engine is imported from it rather than duplicated, which is also why a quote and the invoice it
becomes round to the same numbers. See the <a href="/setup">setup pages</a> for the exact file and key per
client.</p>

<h2>The lifecycle: open, sent, accepted or declined, expired</h2>
<p>A quote is created with <code>quote_create</code>: line items in minor units, a VAT rate per line or the
business default, an optional discount, and a validity window in days. It is allocated a <code>Q-YYYY-NNNN</code>
id, the same shape the invoice server uses for <code>INV-YYYY-NNNN</code>, for the same reason: a bare
<code>Q-0001</code> that resets every January collides with last January's quote the moment history spans
a year boundary. From there a quote moves through exactly one of three closing states.
<code>quote_accept</code> marks it accepted and invoices it. <code>quote_decline</code> marks it lost with
a reason, so it stops counting against the open-quote limit and starts counting toward the win rate.
Left untouched past its validity date, it becomes expired on its own, with nothing to call: state is
computed from today's date against <code>valid_until</code>, not stored and left to go stale.</p>
<p><code>quote_send_text</code> renders the aligned line table, the VAT lines, the total and the validity
date as plain text ready to paste into an email, and it is free on every tier. The <code>quote_followup</code>
prompt reviews what is open, what lapses soon and what already lapsed, and drafts the chase, which is the
part of quoting that a stored JSON file does not do for you on its own: nobody enjoys the second email that
just asks whether the first one was seen. An expired quote is refused by <code>quote_accept</code> until
you either extend it with <code>quote_update {valid_until}</code> or pass <code>allow_expired: true</code>,
which is deliberate friction: a lapsed price should be re-confirmed before it becomes an invoice, not
honoured automatically as if nothing changed.</p>

<h2>Validity in the profile timezone, not the laptop's</h2>
<p>Whether a quote has lapsed is a question about "today," and "today" is ambiguous the moment the person
asking and the machine running the server are in different places. The server answers it by computing the
current date in the <code>timezone</code> field of the shared business profile, when one is set, rather
than in the host machine's own zone. A quote issued at 00:30 in Warsaw from a laptop still set to US
Eastern time would otherwise be stamped the previous calendar day and lapse a day earlier than the client
was actually told, which is the kind of one-day-early expiry that looks like a bug in front of a client
and is really a bug in the machine's clock settings.</p>

<h2>The worked example</h2>
<pre><code>quote_create {
  client: "Acme", currency: "EUR", validity_days: 14,
  items: [
    { description: "API work",  quantity: 12, unit_price_minor: 9000,  tax_rate: 23 },
    { description: "Setup fee", quantity: 1,  unit_price_minor: 30000, tax_rate: 23 }
  ]
}
-> Q-2026-0001, valid until 2026-09-18

API work    12  x  EUR 90.00   =  EUR 1080.00
Setup fee    1  x  EUR 300.00  =  EUR 300.00
Subtotal                          EUR 1380.00
VAT 23% on EUR 1380.00             EUR 317.40
TOTAL                              EUR 1697.40
Valid until 2026-09-18.

quote_accept { id: "Q-2026-0001" }
-> accepted, invoice INV-2026-0004, due 2026-09-18, total EUR 1697.40</code></pre>
<p>Prices go in as minor units: <code>9000</code> is EUR 90.00, and there is no decimal anywhere on the
input side, so a price can never land in the system ten times too small because a "90" was read as 90
minor units instead of 90 major units.</p>

<h2>Accept writes the invoice through the shared engine</h2>
<p><code>quote_accept</code> creates the invoice directly in the invoice server's own store when that store
is present, defined as <code>invoices.json</code> or <code>clients.json</code> already existing, or a
shared business profile with a name. When none of those exist yet, the response instead hands back
<code>invoice_create</code>-ready arguments, with unit prices converted back to major units, so the same
sentence still gets you to an invoice, just through one more explicit call. Either way, the invoice is
written by the exact <code>computeTotals</code>, <code>currencyDecimals</code> and <code>formatMoney</code>
code the invoice server itself uses, imported rather than reimplemented, which is what keeps a quote and
the invoice it becomes agreeing line for line and then in the total. One side effect worth knowing:
accepting bypasses the invoice server's own free cap of 3 invoices a month, because it writes through the
shared engine rather than through that server's gated tool handler. The quotes free cap, 5 open quotes at
a time, is the one that applies here, and the accept response says so.</p>

<h2>The measured reason acceptance copies the quote instead of recomputing it</h2>
<p>The obvious way to build <code>quote_accept</code> is to take the client, the line items and today's
tax settings, and run them back through the same pricing logic that made the quote in the first place. That
was tried, measured, and rejected, because a business profile changes over the life of a quote in ways that
have nothing to do with the quote itself: a VAT rate correction, a new client class, a bookkeeping fix
someone made in the meantime.</p>
<p>The measured case (<code>test/adversarial.test.mjs</code>, "a VAT rate change between quote and
acceptance never moves the agreed total"): a quote of EUR 1,000.00 net is issued while the profile's
<code>default_tax_rate</code> is 23%, so the client is given EUR 1,230.00. Before the client answers, the
profile's default rate is changed to 8%. Recomputing at acceptance time invoices EUR 1,080.00 -- EUR 150.00
below the number the client actually agreed to, on one document, with nothing on either record explaining
why they differ. Copying the quote's stored lines instead invoices EUR 1,230.00, and the assertion holds
<code>tax_lines[0].rate === 23</code>. A later tax-rate change in the shared profile cannot move the
agreed total on a quote that already went out the door. The same logic is why prices are taken as minor
units with no decimal on the input side: the integer on the quote and the integer on the invoice are the
same integer, all the way through, with no rounding step in between that a rate change could quietly ride
along with.</p>

<h2>The win rate report</h2>
<p><code>quote_report</code>, a Pro feature, totals open, accepted, declined and expired quotes per
currency, the value still sitting open, and the win rate: accepted divided by accepted plus declined,
expired quotes counted as neither a win nor a loss because nobody actually said no. That last choice
matters for what the number means. Counting an expired quote as a loss would punish a slow client the same
as a client who chose someone else, and the two are different problems: one wants a better follow-up
cadence, and the other wants a better price or a better pitch. Keeping expired quotes out of the ratio
keeps the win rate answering only the question it can actually answer.</p>

<h2>Free tier and Pro</h2>
<p>Free holds 5 open quotes at a time; accepting, declining or letting one lapse frees the slot, so a
freelancer who actually closes their quotes never hits the cap. <code>quote_send_text</code>, creating,
revising, accepting, declining, VAT, discounts and multi-currency are all unrestricted on free.
<code>quote_pdf</code> and <code>quote_report</code> are Pro. Pro is a one-time $19, or $39 for every server
in the collection, lifetime, no subscription. Full detail on <a href="/s/quotes">the MCP Quotes page</a>
and the general <a href="/guides/mcp-server-free-vs-pro">free versus Pro</a> comparison. Once a quote is
accepted, the invoice it produced is the same one the <a href="/guides/invoice-pdf-from-chat">invoice PDF
guide</a> covers.</p>
${FOOT}`,
    faq: [
      { q: "What happens to an unpaid quote once its validity date passes?", a: "It becomes expired on its own; nothing needs to be called. State is computed from today's date against valid_until, so a quote that nobody accepted or declined simply stops being acceptable, and quote_accept refuses it until you extend valid_until or pass allow_expired: true." },
      { q: "If the business's VAT rate changes after a quote is sent, which rate does the invoice use?", a: "The rate the client was quoted. quote_accept copies the quote's own stored lines rather than recomputing them against the shared profile's current default_tax_rate, so a rate change made after the quote went out, for any reason, cannot move the total on a quote the client already agreed to." },
      { q: "Does accepting a quote count against the invoice server's free cap of 3 invoices a month?", a: "No. Accepting writes the invoice through the same engine the recurring-invoice server uses, bypassing the invoice server's own tool-level cap. The quotes server's own cap, 5 open quotes at a time, is the one that applies, and the accept response states this." },
      { q: "What is a quote's win rate and why don't expired quotes count against it?", a: "quote_report divides accepted quotes by accepted plus declined. Expired quotes are excluded because nobody actually said no; folding a slow client in with a lost one would answer a different question than the one a win rate is meant to answer." },
      { q: "Why does validity use the business profile's timezone instead of the computer's own clock?", a: "Because whether a quote has lapsed is a question about today's date, and a quote issued at 00:30 local time from a machine still set to a different zone would otherwise be dated the wrong calendar day and expire early. Setting timezone on the shared business profile fixes the date to where the business actually is." },
    ],
  },

  "sepa-payment-qr-codes-on-invoices-from-chat": {
    title: "Put a SEPA payment QR code on an invoice from chat",
    description: "EPC069-12 fields, IBAN mod-97, why the code is EUR only, invoice_payment_qr from the shared profile, SVG versus PNG bytes, and when to reach for Code 128 instead of EAN-13.",
    html: `<h1>Put a SEPA payment QR code on an invoice from chat</h1>
<p>A banking app that scans a code and fills in the transfer form is not doing anything clever with a
picture: it is reading eleven lines of plain text in a fixed order, a format called EPC069-12, also known
as the EPC QR code or GiroCode. The MCP Barcode server builds that text itself, checks the IBAN before it
draws anything, and can pull the beneficiary's IBAN and name straight from the same
<a href="/guides/invoice-pdf-from-chat">shared business profile</a> the invoice server already has. "Put a
payment QR code on invoice INV-2026-0007" is one call.</p>

<h2>Install</h2>
<pre><code>claude mcp add barcode -- npx -y @theluckystrike/mcp-barcode</code></pre>
<p>Cursor, Claude Desktop and the rest take the same block, under their own config file. See the
<a href="/setup">setup pages</a> for the exact path and key per client.</p>

<h2>The eleven EPC069-12 fields, in order</h2>
<p>The record is not a struct with named keys; it is plain text lines joined by newlines, and a scanner
reads field N as whatever sits on line N. Getting one field wrong or leaving one out of order corrupts
every field after it. The server writes exactly this, dropping only the trailing fields that are empty,
since the specification allows the record to stop early:</p>
<pre><code>BCD                    Service tag, fixed
002                    Version. 002, not 001: 001 makes the BIC mandatory, and no
                       euro-area bank has needed a BIC for SEPA since Feb 2016
1                      Character set, 1 = UTF-8
SCT                    Identification: SEPA Credit Transfer, fixed
&lt;BIC&gt;                 Optional under version 002; blank is valid
&lt;name&gt;                Beneficiary name, max 70 characters
&lt;IBAN&gt;                Validated before this line is written
EUR&lt;amount&gt;           EUR plus the amount with two decimals, e.g. EUR120.50; blank
                       if no amount, so the payer types one in
&lt;purpose&gt;             Optional 4-letter ISO 20022 purpose code, e.g. GDDS
&lt;reference&gt;           Structured creditor reference, max 35 chars
&lt;remittance&gt;          Free remittance text, max 140 chars</code></pre>
<p>Reference and remittance are mutually exclusive on purpose: EPC069-12 carries a structured reference or
free text, never both, and the tool refuses a call that supplies both rather than guessing which one the
banking app should show. The whole record is capped at 331 bytes; a long name plus a long remittance line
pushes past it and the tool says by how much, before anything is drawn.</p>

<h2>The IBAN is checked with ISO 7064 mod 97, digit by digit</h2>
<p>An IBAN carries its own check: move the first four characters to the end, turn every letter into two
digits (A=10 through Z=35), and the resulting number must leave a remainder of 1 when divided by 97. A
German IBAN is 22 characters, which after that substitution is roughly a 30-digit number; a Maltese one
is 31 characters, close to a 47-digit number. <code>Number()</code> in JavaScript cannot hold that many
digits without rounding, and a rounded IBAN can still look plausible, so the check here runs digit by
digit with a running remainder instead of ever forming the full number. Country and length are checked
first against the ISO 13616 registry, since a code that is the wrong length for its country is not an
IBAN no matter what its digits say. A single transposed digit fails the mod-97 check and the tool names
the remainder it got instead of the 1 it needed, rather than drawing a code that would send a payment to
nobody, or to somebody else.</p>

<h2>Why the code is EUR only</h2>
<p>EPC069-12 encodes a SEPA credit transfer specifically, and a SEPA transfer moves euros between
accounts in the SEPA scheme. Passing a non-EUR currency is refused by name, and passing an IBAN from a
country outside the SEPA scheme is refused too, even if the IBAN itself checks out, because the format has
nowhere to put a currency or an exchange rate: the amount field is euro cents or it is nothing. A dollar or
zloty invoice is paid the way it always was, by bank transfer with the account details printed as text; the
guide for that is the <a href="/guides/invoice-pdf-from-chat">invoice PDF</a> itself, which never
depended on this code to carry a payment.</p>

<h2>invoice_payment_qr: the shared profile does the typing</h2>
<p>Rather than pass the IBAN and name on every call, <code>invoice_payment_qr</code> reads them from the
same shared business profile the invoice server's <code>business_set</code> already wrote once, so an
IBAN typed correctly a single time is the IBAN on every invoice's payment code afterward. Give it an
invoice number and it reads the total and currency from the invoice server's own store and uses the
invoice number as the structured reference, so a client's bank statement shows the exact number to match
against the invoice on file:</p>
<pre><code>invoice_payment_qr { invoice_id: "INV-2026-0007" }
-> reads IBAN + name from the shared profile
-> reads total (say EUR 1,697.40) and currency from INV-2026-0007
-> reference defaults to "INV-2026-0007"
-> refuses outright if the invoice is not in EUR</code></pre>
<p>An amount passed alongside an invoice id that disagrees with that invoice's stored total is not
silently corrected to match the invoice: the code carries the amount actually given, and the response
says so, on the theory that a caller who typed a different number on purpose should get that number, not
a second guess.</p>

<h2>SVG versus PNG: measured bytes</h2>
<p>The same EPC payment record, drawn at five sizes, both ways:</p>
<table><tr><th>requested size</th><th>PNG bytes</th><th>SVG bytes</th></tr>
<tr><td>128 px</td><td>1,481</td><td>2,079</td></tr>
<tr><td>256 px</td><td>2,186</td><td>2,079</td></tr>
<tr><td>512 px</td><td>3,589</td><td>2,079</td></tr>
<tr><td>1024 px</td><td>7,585</td><td>2,081</td></tr>
<tr><td>2048 px</td><td>21,688</td><td>2,081</td></tr>
</table>
<p>An SVG stores the module grid, not pixels, so its size barely moves with the requested size; a PNG
grows without limit as the pixel count grows. The two file types cross at roughly 200 px: below that a
PNG is the smaller file, above it the SVG is, and the SVG is also the one that stays sharp when a printer
scales an invoice template up. That is why SVG is the free-tier format here rather than a small PNG: for
the thing most people do with a payment code, put it on a printed or PDF invoice, SVG is the better file
outright, not a limited consolation version of PNG.</p>

<h2>Code 128 or EAN-13: which one to ask for</h2>
<p><code>barcode_create</code> draws Code 128, EAN-13, EAN-8 or UPC-A, and the four are not
interchangeable. EAN-13, EAN-8 and UPC-A are retail symbologies with a fixed digit count and a check
digit defined by the standard: they exist so a barcode scanner at a till can look a number up in a
product catalogue, and a short input gets its check digit computed while a full-length input with the
wrong check digit is refused rather than redrawn, since silently correcting it would print a label that
scans as a different product. Reach for EAN-13 when the thing being labelled already has, or needs, a
real retail GTIN meant for another system to recognise. Reach for Code 128 for everything else that
just needs to be read back as the string you gave it: an internal shelf location, a work order number,
a shipping reference, a serial number, anything alphanumeric or longer than 13 digits, since Code 128
encodes the full ASCII range with no fixed length and no external registry to satisfy.</p>

<h2>Free tier and Pro</h2>
<p>Free gives 20 codes a calendar month across every tool, SVG output for all of them, and every
symbology and QR kind: WiFi, vCard, SEPA payment codes and all four barcode types. Pro ($19 once, or $39
for the whole collection, lifetime) adds PNG output from 32 to 4000 px and <code>barcode_batch</code> for
up to 500 rows in one call. Full detail on <a href="/s/barcode">the MCP Barcode page</a> and the general
<a href="/guides/mcp-server-free-vs-pro">free versus Pro</a> comparison.</p>
${FOOT}`,
    faq: [
      { q: "What exactly does a banking app read when it scans the code?", a: "Eleven plain-text lines joined by newlines, in a fixed order: BCD, version 002, character set, SCT, an optional BIC, the beneficiary name, the IBAN, EUR plus the amount, an optional purpose code, and a structured reference or free remittance text, never both. The whole record is capped at 331 bytes." },
      { q: "Can I put a payment QR code on a USD or PLN invoice?", a: "No. EPC069-12 encodes a SEPA credit transfer, which only moves euros, so a non-EUR currency and an IBAN from outside the SEPA scheme are both refused, even if the IBAN itself is valid. A non-EUR invoice is still paid by bank transfer with the account details printed as plain text." },
      { q: "How is the IBAN checked?", a: "ISO 7064 mod 97, computed digit by digit rather than as one large number, because a long IBAN becomes too many digits for JavaScript's Number type to hold without rounding into a different, still-plausible value. Country and length are checked against the ISO 13616 registry first." },
      { q: "Do I have to type my IBAN into every payment code?", a: "No, if you use invoice_payment_qr. It reads the IBAN and name from the shared business profile the invoice server's business_set already wrote, and the amount, currency and reference from the invoice itself when you give it an invoice number." },
      { q: "Should I use EAN-13 or Code 128 for an internal label?", a: "Code 128, for almost anything that is not a retail product needing a real GTIN. It has no fixed length or check-digit standard tying it to a catalogue, and it encodes the full ASCII range, so a work order number, shelf location or serial number all fit it directly. EAN-13 is for a number meant to be looked up in a retail system." },
    ],
  },

  "zip-archives-safely-from-chat": {
    title: "Zip and unzip archives safely from Claude or Cursor",
    description: "Pack a folder, look inside an archive somebody sent you, and unpack it, with traversal, symlink and zip-bomb guards decided from the header before anything is inflated. Bundle a month of invoices and exports in one file.",
    html: `<h1>Zip and unzip archives safely from Claude or Cursor</h1>
<p>An archive that arrives from outside is exactly the file you least want to just open. It can claim to be a
199 KB download and unpack into 200 MB on disk, or its file list can walk out of the folder you pointed it at
with a <code>../../</code> in an entry name. The MCP Zip server packs, lists and unpacks .zip files in the
conversation you are already in, and every one of those questions is answered by reading the archive's own
central directory, before a single byte is decompressed.</p>

<h2>Install it</h2>
<pre><code>claude mcp add zip -- npx -y @theluckystrike/mcp-zip</code></pre>
<p>Cursor, in <code>.cursor/mcp.json</code>, and Claude Desktop with the same block under
<code>claude_desktop_config.json</code>:</p>
<pre><code>{
  "mcpServers": {
    "zip": { "command": "npx", "args": ["-y", "@theluckystrike/mcp-zip"] }
  }
}</code></pre>
<p>Nothing to sign up for and no network call of any kind: this server has no <code>fetch</code>, no HTTP
client and no telemetry anywhere in it.</p>

<h2>Zip bombs, and why the ratio ceiling is the second guard, not the first</h2>
<p>The instinct is to refuse an archive whose compression ratio looks extreme, and to set that ceiling low. A
measured comparison says why that is the wrong first guard: 4,000 rows of billing CSV with unique values
compress 2.40x, and the same 4,000 rows with forty repeated client names compress <strong>82.69x</strong>,
83% of the way to a 100x ceiling. Nothing about the file being a CSV predicts which one you have; only the
repetition in the actual bytes does. A ceiling tuned to sit safely under a genuine 1022x zeros-file bomb would
also refuse that real monthly export, and the person on the other end learns to pass <code>max_ratio</code>
on every call, which turns the guard off for good.</p>
<p>So the ratio ceiling (100x by default) is the second guard. The first is the total: the selected entries'
declared uncompressed sizes are added up and checked against a ceiling before anything is read
(<code>max_total_mb</code>, 1 GB by default), because 200 MB out of a 199 KB file is a decision you can make
about the archive as a whole without judging any one entry. Both numbers come out of the central directory, so
refusing a bomb costs no decompression: a 500 MB bomb that is 497.8 KB on disk is refused in 3 ms, with
<code>out_dir</code> not even created.</p>

<h2>Traversal and absolute entries</h2>
<p>A zip entry's name is just a string in the header, and nothing stops it from reading
<code>../../escaped.txt</code>, <code>/etc/cron.d/pwn</code> or <code>C:\\Windows\\evil.dll</code>. Each of
those is refused by name before extraction starts, and the resolved target is checked a second time against
<code>out_dir</code> after the traversal check, so a name that passes the first look still cannot land outside
the folder you asked for. A symlink entry is refused the same way and is never recreated, not as a link and
not as a plain file standing in its place. One unsafe entry refuses the whole extraction unless you pass
<code>skip_unsafe: true</code>, which writes the rest and names exactly what it left out.</p>

<h2>CRC per entry: the check a bounded buffer cannot do</h2>
<p>Capping the memory an entry can use while it inflates looks like the whole zip-bomb answer: allocate a
buffer the size the header declares, let the decompressor fill it, and nothing can blow up. Measured on the
compression library this server uses, that cap is not what it looks like: a 100,000-byte entry inflated into a
10-byte buffer returns exactly 10 bytes and <strong>throws nothing</strong>. An archive whose header lies and
declares 10 bytes for a 100 KB entry extracts as a 10-byte file, reported as a success, with the truncation
invisible anywhere in the output.</p>
<p>The buffer bounds the memory; it does not prove the bytes. The CRC-32 the central directory already carries
for every entry does that: this server checks it on every entry before it reaches disk, and a mismatch refuses
that entry by name rather than writing a truncated file with a plausible name. Two different questions,
answered by two different instruments, and only one of the two catches a lying header.</p>

<h2>Bundling a month of invoices and exports</h2>
<p><code>zip_bundle_month</code> collects a calendar month's files out of the sibling servers' own default
output folders (invoice PDFs, quote PDFs, expense-tracker CSV and JSON exports, generated .docx documents and
resumes) into one archive, so the file that goes to an accountant is one attachment instead of five separate
downloads. It is best effort and says so in the reply: every folder it looked in is named, along with how many
files it found in each, and a folder that is not there is reported rather than treated as an error. Files are
chosen by modification date against the month you asked for, so a stray file from a different month sitting in
the same folder does not end up in the bundle.</p>

<h2>Looking before you unpack</h2>
<p>"What's in this zip someone sent me, before I open it" runs <code>zip_list</code>: every entry with its
size, compressed size and ratio, and everything dangerous flagged by name, absolute paths, <code>..</code>,
symlinks, encrypted entries, duplicate names and anything past the ratio ceiling. Reading is never metered on
either tier, because the archive you most need to inspect before opening is exactly the one somebody else
built, and a paywall in front of that would be a paywall in front of the safety check itself.
<code>zip_extract_text</code> goes one step further and reads a single text entry inline, README, changelog,
one CSV row sample, without unpacking anything to disk at all; a binary entry is refused by name rather than
printed as noise into the chat.</p>

<h2>Free tier and Pro</h2>
<p>Free gives 20 archives a calendar month, up to 25 MB and 200 entries each, with every guard active.
Reading, <code>zip_list</code>, <code>zip_extract</code> and <code>zip_extract_text</code>, is unlimited on
both tiers, because it costs nothing to look and everything to guess wrong about what is safe to open. Pro
($19 once, or $39 for the whole collection, lifetime) removes the archive count, size and entry ceilings. Full
detail on <a href="/s/zip">the MCP Zip page</a> and the general
<a href="/guides/mcp-server-free-vs-pro">free versus Pro</a> comparison.</p>
${FOOT}`,
    faq: [
      { q: "Why is a low compression ratio ceiling the wrong way to catch a zip bomb?", a: "A real 4,000-row billing CSV with forty repeated client names measured 82.69x, 83% of the way to a 100x ceiling; a ceiling set well under a bomb's typical ratio would refuse that legitimate export and teach people to disable the check. The primary guard is the total declared uncompressed size, checked before the ratio." },
      { q: "Does this stop an archive from writing outside the folder I unpack it into?", a: "Yes. Absolute paths, .. segments and backslash separators in an entry name are refused before extraction, the resolved target is checked again against out_dir, and a symlink entry is never recreated as a link or a file. One unsafe entry refuses the whole extraction unless skip_unsafe is passed." },
      { q: "Can a bounded output buffer alone catch a bomb or a lying header?", a: "No. A capped buffer bounds memory but a 100,000-byte entry inflated into a 10-byte buffer returns 10 bytes and throws nothing, so a truncated file would look like a success. The CRC-32 already stored for the entry is what proves the bytes, and this server checks it before anything reaches disk." },
      { q: "What does zip_bundle_month actually collect?", a: "It reads the sibling servers' own default output folders for the month you name: invoice and quote PDFs, expense-tracker CSV and JSON exports, and generated docx documents and resumes. It never writes to those folders, only reads, and it names every folder it looked in and how many files it found, missing folders included." },
      { q: "Is reading an archive limited on the free tier?", a: "No. zip_list, zip_extract and zip_extract_text are unlimited on both tiers. Only writing, zip_create and zip_add, counts against the free tier's 20 archives a month, 25 MB and 200 entries per archive." },
    ],
  },

  "client-deposits-and-retainers-from-chat": {
    title: "Client deposits and retainers from chat, applied to your real invoices",
    description: "Record a security deposit or retainer when the money arrives, apply it to an invoice as a real payment, refund what is left, and answer how much of theirs you hold. How writing a second server against the invoice store surfaced a payment field that was being overwritten rather than added to.",
    html: `<h1>Client deposits and retainers from chat, applied to your real invoices</h1>
<p>A deposit is the client's money sitting on your account. A landlord holds one against damage, an agency
takes one before it starts, a trade asks for half up front. It is not revenue and it is not a payment on an
invoice until you make it one, and in between somebody has to be able to answer a plain question: how much
of theirs are you holding, in which currency, and since when. The MCP Deposits server answers that against
the invoices and clients the <a href="/s/invoice">MCP Invoice</a> server already holds, on your machine,
with no network call anywhere in it.</p>

<h2>Install it beside the invoice server</h2>
<pre><code>claude mcp add invoice -- npx -y @theluckystrike/mcp-invoice
claude mcp add deposits -- npx -y @theluckystrike/mcp-deposits</code></pre>
<p>Cursor, in <code>.cursor/mcp.json</code>, and Claude Desktop with the same block under
<code>claude_desktop_config.json</code>:</p>
<pre><code>{
  "mcpServers": {
    "invoice": { "command": "npx", "args": ["-y", "@theluckystrike/mcp-invoice"] },
    "deposits": { "command": "npx", "args": ["-y", "@theluckystrike/mcp-deposits"] }
  }
}</code></pre>
<p>Both read one data directory and one business profile, so your name, address, VAT id and default currency
are set once. Deposits holds no copy of the money, currency or client code: it imports
<code>currencyDecimals</code>, <code>formatMoney</code>, <code>findClient</code>, <code>getInvoices</code>
and <code>setInvoices</code> from the invoice engine, and the A4 page from
<a href="/s/billing-docs">MCP Billing Docs</a>, which is why a deposit statement agrees with the invoice and
the credit note beside it to the minor unit.</p>

<h2>The measured thing: the deposit write path found a silent bug in the invoice server</h2>
<p>The invoice server exports no payment function. Its own <code>invoice_mark_paid</code> tool sets three
fields under the invoice lock, and on 2026-09-05, when this server was built against it, the important word
was <em>sets</em>. Measured against <code>servers/invoice/dist/index.js</code> as it stood that morning, on a
EUR 1,000.00 invoice:</p>
<pre><code>invoice_mark_paid { invoice: "INV-2026-0001", amount: 200 }   -&gt; "balance due EUR 800.00"
invoice_mark_paid { invoice: "INV-2026-0001", amount: 300 }   -&gt; "balance due EUR 700.00"
paid_minor: 30000</code></pre>
<p>The EUR 200.00 bank transfer that actually arrived was gone from the record. Nothing errored and nothing
warned; the only visible trace was a number EUR 200.00 too high, on the line the client gets chased for.</p>
<p><code>deposit_apply</code> writes the same three fields on the same record, because there is no
<code>recordPayment</code> to call, but it adds to <code>paid_minor</code> instead of assigning it. On a real
client run the same day, an invoice seeded with a EUR 200.00 transfer already on it ended at
<code>paid_minor</code> 50000 after a EUR 300.00 deposit was applied, and the tool reported paid EUR 500.00
of EUR 1,230.00 with EUR 730.00 due.</p>
<p><strong>The invoice server was fixed the same day.</strong> <code>invoice_mark_paid</code> now adds too,
refuses a payment that would overpay the open balance, and appends to a <code>payments</code> list, so the
sequence above leaves EUR 500.00 received. That is the better outcome and it is recorded here rather than
quietly dropped: the paragraph above is a dated measurement of how the tool behaved before the fix, not a
claim about it now.</p>
<p>The general form is what survives, and it is worth carrying to any two servers that share a store:
matching field names is not the contract. The arithmetic on them is, and it is only visible by reading the
owning server's write path. A review that checked the schema would have passed the version that assigns.
Nothing found this except writing a second server against the same field.</p>

<h2>What you say, and which tool runs</h2>
<table>
<tr><th>What you say</th><th>Tool</th></tr>
<tr><td>Record a 500 euro security deposit from Nordic Print, received today.</td><td><code>deposit_record</code></td></tr>
<tr><td>Apply 300 of that deposit to INV-2026-0001.</td><td><code>deposit_apply</code></td></tr>
<tr><td>How much are we holding for Nordic Print, and since when?</td><td><code>deposit_balance</code></td></tr>
<tr><td>Refund the rest, sent back by bank transfer.</td><td><code>deposit_refund</code></td></tr>
<tr><td>Send them a statement of their deposit.</td><td><code>deposit_statement_text</code></td></tr>
<tr><td>What has sat unapplied for more than ninety days?</td><td><code>deposits_report</code></td></tr>
</table>

<h2>A deposit pays out at most what it still holds</h2>
<p>Held is received, less everything already applied, less everything already refunded. Every application is
also capped by the invoice's own open balance, <code>total_minor - paid_minor</code>. Both checks and the
write happen in one critical section under both locks, deposits first and then invoice, the same order the
quotes, recurring and billing-docs servers take, so no two processes in this estate can deadlock and no two
can each see room and both take it. Ten concurrent EUR 200.00 applications against a EUR 500.00 deposit
store exactly two and refuse exactly eight.</p>
<p>The refusals name the number rather than the rule. Applying EUR 200.00 when EUR 100.00 is left says so;
applying EUR 200.00 to an invoice that owes EUR 100.00 says the application "would show the invoice overpaid
and leave the difference owed to the client twice"; and a EUR deposit against a USD invoice is refused with
both currencies named and the way out, which is to refund it and record it again in the invoice's currency.
There is no exchange rate anywhere in this server, so there is no rate to be silently wrong.</p>

<h2>A refund is not a payment</h2>
<p><code>deposit_refund</code> does not touch the invoice server at all. Giving a client their own money back
is not the settlement of a bill, and writing it as one would show an invoice paid that nobody paid. The
refund is a movement on the deposit, and the invoice stays exactly as it was.</p>
<p>For the same reason the stored <code>status</code> is derived from the movement list every time a movement
is written, never taken from the caller: <code>held</code> while anything is still held, otherwise
<code>applied</code> if any of it went to an invoice and <code>refunded</code> if all of it went back. A
stored status that is allowed to drift from the movements is how a deposit comes to look returned while the
money is still on your books.</p>

<h2>One statement, one currency</h2>
<p>A client holding EUR and USD has two balances, and adding them would be a made-up number. So
<code>deposit_balance</code> returns one row per currency and never a total across them, and
<code>deposit_statement_text</code> asks which currency you mean, naming both, rather than guessing.</p>

<h2>Free and Pro</h2>
<p>Free records 5 deposits a calendar month, counted by the date the money arrived. Applying to invoices,
refunds, lists, balances and the text statement are unlimited on every tier, deliberately: a cap that
trapped a client's deposit would be a limit on their money rather than on yours. Pro
(<a href="/buy/deposits?src=store.guide.client-deposits-and-retainers-from-chat">$19 one-time</a>, or <a href="/bundle">$39 for the bundle</a>) removes the recording
cap and adds the A4 statement PDF with your logo and the held, oldest-held and unapplied report.</p>`,
    faq: [
      { q: "Does applying a deposit actually change the invoice?", a: "Yes. deposit_apply writes paid_minor, paid_date and status onto the invoice record through the invoice engine's own store, under the invoice lock, so invoice_list and overdue_report stop chasing money you already hold. The one difference from invoice_mark_paid is that it adds to paid_minor rather than setting it, so a payment that arrived earlier is not erased." },
      { q: "Can a deposit in one currency pay an invoice in another?", a: "No, and it is refused by name rather than converted. The message gives both currencies and the way out: refund the deposit and record it again in the invoice's currency. There is no exchange rate anywhere in this server, so there is no rate that can be silently wrong." },
      { q: "What stops a deposit being applied twice?", a: "Held is received less applied less refunded, and the check and the write are one critical section under both locks. Ten concurrent applications of EUR 200.00 against a EUR 500.00 deposit store exactly two and refuse the other eight; the invoice ends at EUR 400.00 paid, never more than was held." },
      { q: "Is a refund recorded on the invoice?", a: "No. Giving a client their own money back is not a payment of a bill, so deposit_refund leaves the invoice untouched. It is a movement on the deposit, and it changes the deposit's derived status once nothing is left held." },
      { q: "What does the free tier actually limit?", a: "Only deposit_record, at 5 a calendar month by received date. Applying, refunding, listing, balances and the text statement are unlimited on every tier. A deposit received in a different month is not blocked by this month's five. The statement PDF and deposits_report are Pro." },
      { q: "Where is the data kept?", a: "Plain JSON under ~/.local/share/mcp-servers/deposits/, or $XDG_DATA_HOME if you set it, with the invoices in the invoice server's own directory beside it. Writes are atomic and locked. A corrupt file is moved aside byte-for-byte rather than overwritten, and no fresh file is silently written in its place." },
    ],
  },

  "fixed-assets-and-depreciation-from-chat": {
    title: "Fixed assets and depreciation from chat, on the rates the tax authorities publish",
    description: "Keep a fixed asset register and depreciate it under the Polish KST annex rates, the UK capital allowance pools or US MACRS GDS, with the convention, the journal entry and the gain on disposal. Why the monthly split, not the yearly one, is where the rounding error is, and why the UK pool rate is applied to one asset with a caveat.",
    html: `<h1>Fixed assets and depreciation from chat, on the rates the tax authorities publish</h1>
<p>Depreciation is somebody else's arithmetic. A tax authority publishes a rate, a life and a convention, and
your job is to apply their rule to your purchase and put the answer in a ledger or on a return. Nothing in
that is a judgement call once the category is settled, which makes it exactly the kind of thing worth handing
to a tool. The <a href="/s/asset-register">MCP Asset Register</a> server holds three of those rate tables as
files inside the package, keeps a register of what you bought, and returns the schedule, the monthly journal
entry and the gain or loss when you sell. There is no network call anywhere in it.</p>

<h2>Install it</h2>
<pre><code>claude mcp add asset-register -- npx -y @theluckystrike/mcp-asset-register</code></pre>
<p>Cursor, in <code>.cursor/mcp.json</code>, and Claude Desktop with the same block under
<code>claude_desktop_config.json</code>:</p>
<pre><code>{
  "mcpServers": {
    "asset-register": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-asset-register"]
    }
  }
}</code></pre>
<p>It reads the same shared business profile as the invoice and expense servers, so your default currency is
set once. The scheme is derived from that currency rather than guessed from an address line, and every answer
that uses a derived scheme says in words that it derived it.</p>

<h2>The three tables, and what each one leaves out</h2>
<p>Every table carries a header with the authority, the instrument, the source URL, the date the rates took
effect and the date they were read, and the <code>assets://categories</code> resource returns those headers
with the rates, so the provenance travels with the number. The rule the tables were built under is that a
value that could not be stated with confidence from the public text was left out rather than guessed, because
a depreciation rate ends up on a return and a wrong one that looks authoritative is worse than an absent one.</p>
<table>
<tr><th>table</th><th>bundled</th><th>deliberately not bundled</th></tr>
<tr><td>Poland, KST</td><td>33 rows at the group and subgroup level: 0 percent (land, art. 16c), 1.5, 2.5, 4.5, 7, 10, 14, 20 and 30 percent, each with its declining-balance eligibility</td><td>The 18 and 25 percent positions of the annex, whose KST membership could not be stated with confidence; and every individual six-digit code, because a taxpayer classifies the asset and the table carries the rate</td></tr>
<tr><td>UK, capital allowances</td><td>The main rate pool at 18 percent, the special rate pool at 6 percent, and the annual investment allowance as a 100 percent first-year row with its GBP 1,000,000 cap</td><td>First-year and full-expensing rules, the structures and buildings allowance, the small pools allowance, the CO2 thresholds that decide which pool a car enters, and every balancing charge</td></tr>
<tr><td>US, MACRS</td><td>The 3, 5 and 7 year GDS classes under the half-year convention, as the published Pub 946 Table A-1 percentages</td><td>Mid-quarter and mid-month conventions, the 27.5 and 39 year real property classes, the 10, 15 and 20 year classes, ADS, section 179 and bonus depreciation</td></tr>
</table>
<p>A category outside a table is refused by name. A US 10-year class is not quietly approximated to the
7-year one, and a Polish asset in one of the two missing annex positions is told the table is partial rather
than told no rate exists.</p>

<h2>The convention belongs to the table, not to you</h2>
<p>The same purchase gives three different first-year figures under the three schemes, and all three are
right. Poland charges from the month <strong>after</strong> the asset enters the register (art. 16h ust. 1
pkt 1), so a computer in service on 15 March starts on 1 April, year one is nine twelfths of the annual rate
and the schedule runs one calendar year longer than the life suggests. The MACRS percentages already carry
the half-year convention inside them, which is why a 5-year class runs six periods rather than five. A UK
writing down allowance is a full-period allowance on a pool and is not prorated by month at all.</p>
<p>The Polish declining-balance method switches, and the answer says which year it switched in. Art. 16k
multiplies the rate by a coefficient of up to 2.0 on the written-down value, and from the first year the
declining amount would fall below the straight-line amount, the rest of the schedule is straight line. A
truck at 20 percent times 2 on 10,000.00 gives 4000.00, 2400.00, 2000.00, 1600.00, and the third period's
<code>basis</code> field names the article, because year three's declining amount would have been 1440.00,
below the 2000.00 straight-line amount. Passenger cars and buildings are excluded from the method by the
annex and are refused rather than computed anyway.</p>

<h2>The measured thing: the rounding error is in the monthly split, not the yearly one</h2>
<p>Take one test asset, cost 12,345.67 with a 45.67 residual, in service 12 March 2026, and put it through
every schedule these three tables can produce: 67 of them across the schemes, categories and methods. The
yearly rows come out clean under almost any rounding rule you like, because an annual amount is a percentage
of a base and lands on or near a whole cent.</p>
<p>Now split those same years into months by rounding each month independently. <strong>35 of the 67 no
longer sum to the depreciable base</strong>, off by up to <strong>390 minor units, 3.90 on a 12,345.67
asset</strong>. The worst offenders are the longest-lived rows: a building at 1.5 percent spreads its base
over 800 months, and 800 half-cent roundings is where the 3.90 comes from.</p>
<table>
<tr><th></th><th>Yearly rows</th><th>Monthly rows, rounded per month</th></tr>
<tr><td>Schedules that sum to the base</td><td>67 of 67</td><td>32 of 67</td></tr>
<tr><td>Worst error</td><td>0</td><td>390 minor units</td></tr>
</table>
<p>That is the wrong way round from the intuition, and the reason is worth stating plainly. The monthly split
feels like the harmless presentational step, the one that happens after the real arithmetic is done, so it is
the step that gets a bare <code>Math.round</code> and no test. It is also the <strong>only</strong> step whose
output anybody posts: nobody journals a year, they journal a month, so the number that reaches the ledger
comes from the step that was not checked.</p>
<p>The fix is that the allocator rounds the <strong>cumulative</strong> total at each step and takes each
period as the difference between two rounded cumulatives, with the last period set to whatever is left. That
makes <code>sum(periods) == cost - residual</code> hold by construction rather than by luck, and the same
rule is applied to the monthly split, so the months sum to their year and the years sum to the base. The
contract suite then asserts the identity for all 67 schedules rather than for the two or three a unit test
would have picked.</p>

<h2>The UK caveat, stated in every answer rather than in a footnote</h2>
<p>A UK writing down allowance is not a per-asset charge at all. It is a percentage of a <strong>pool</strong>:
you put qualifying expenditure into the main rate pool or the special rate pool, claim 18 or 6 percent of the
pool balance for the period, and carry the rest forward. There is no "this van's depreciation" in the
legislation, only the pool the van went into.</p>
<p>This server applies the pool rate to one asset so that a per-asset figure exists at all, which is what a
book ledger needs, and it says so in the answer every time rather than once in the documentation. Two
consequences follow and both are on the record in the output. A pure reducing balance never reaches zero, so
the schedule is cut at 25 periods and the last one writes off what is left, with a <code>basis</code> line
saying that is what happened. And a real capital allowances computation nets disposals against the pool
rather than against the asset, so the per-asset figure here is a book number, not the figure that goes on the
return. The annual investment allowance is bundled as a single 100 percent first-year row with its
GBP 1,000,000 cap, and the note that cars never qualify for it travels with the row.</p>

<h2>The journal, and why it writes nothing</h2>
<p><code>asset_journal</code> returns one month's entry: debit depreciation expense, credit accumulated
depreciation, per asset and in total, balancing to zero on every line and in aggregate. Depreciation is
charged up to and including the month of disposal and then stops, so the month you sold in is charged and
the month after is not. A month with nothing to charge returns no lines rather than a zero line.</p>
<p>It also returns the exact <code>expense_add</code> arguments for the
<a href="/s/expense-tracker">expense tracker</a>, one payload per currency, and writes nothing itself. That is
deliberate. The expense server publishes no library entry point, and its id counter, its category rules, its
VAT split and its currency defaults all live inside its own <code>expense_add</code> handler under its own
lock; appending a row to its data file directly would create an entry with none of those applied, one that
looks native and is not. No <code>vat_rate</code> is set on the payload either, because depreciation is a book
charge rather than a purchase, so there is no input VAT to reclaim on it.</p>
<p>Currencies are never added together anywhere in this server. A PLN register and a USD one stay two
figures, in <code>asset_list</code>, <code>asset_journal</code> and <code>asset_report</code> alike, because
there is no exchange rate here and inventing one would be inventing the total.</p>

<h2>Free and Pro</h2>
<p>Depreciation schedules are free and unlimited on every tier, on all three tables. That is deliberate, and
it is the same rule the per diem server uses: the rates are public information a tax authority published, and
metering the reading of a regulation would be charging for the government's work rather than for this
server's. What the free tier limits is the <strong>size of the register</strong>, at 10 assets, with
<code>asset_list</code> and <code>asset_dispose</code> unlimited. Pro
(<a href="/buy/asset-register?src=store.guide.fixed-assets-and-depreciation-from-chat">$19 one-time</a>, or
<a href="/bundle">$39 for the bundle</a>) removes that cap and adds the monthly journal and the net book value
and disposal report.</p>`,
    faq: [
      { q: "Where do the rates come from, and how do I know they are current?", a: "Each table is a file inside the package carrying the authority, the instrument, the source URL, the date the rates took effect and the date they were read, and the assets://categories resource returns that header with the rates. There is no live feed, deliberately: a depreciation rate that changed under you between two runs of the same register is worse than one that is visibly stale, because the stale one is checkable against the file the build shipped. Read the effective_date in any answer before you rely on it." },
      { q: "Why does my Polish asset start depreciating the month after I bought it?", a: "Because art. 16h ust. 1 pkt 1 says so. Depreciation is charged from the first month AFTER the month the asset entered the register, so an asset in service on 15 March starts on 1 April, year one is nine twelfths of the annual rate and the schedule runs one calendar year longer than the useful life suggests. Every answer names the first charge month rather than leaving you to infer it." },
      { q: "Do the monthly amounts actually add up to the yearly ones?", a: "Yes, by construction rather than by luck. The allocator rounds the cumulative total at each step and takes each period as the difference between two rounded cumulatives, with the last period set to the remainder, and the same rule splits a year into months. So the months sum to their year and the periods sum to cost less residual, to the minor unit, for every input. The contract suite asserts that identity for all 67 schedules these tables can produce, not for a sample." },
      { q: "Can I use the UK figures on my capital allowances return?", a: "No, and the answer says so every time rather than once in the documentation. A writing down allowance is a percentage of a pool, not of an asset: there is no per-asset depreciation in the legislation. This server applies the pool rate to one asset so a book figure exists, cuts the schedule at 25 periods because a reducing balance never reaches zero, and nets nothing against the pool. Use it for the ledger; compute the return on the pool." },
      { q: "What happens to a residual value under MACRS?", a: "It is reported back as ignored and kept on the record for book purposes. The published percentages recover the whole cost, so applying a residual under them would either break the published row or silently rebase it. Saying in the answer that the number was not used is better than either." },
      { q: "What if my category is not in the table?", a: "It is refused by name, with the gap named. A US 10-year property class is refused rather than approximated to the 7-year one, and a Polish asset in the annex's 18 or 25 percent positions is told the table is partial. Matching is exact or by a prefix of four characters or more, never a substring, because \"land\".includes(\"and\") is true and a substring fallback would price a delivery van at the land row's 0 percent and say nothing." },
      { q: "What does the free tier actually limit?", a: "Only the size of the register, at 10 assets. asset_schedule, asset_list and asset_dispose are unlimited on every tier, and asset_schedule works on an asset you are only pricing and have not stored. asset_journal and asset_report are Pro." },
      { q: "Where is the data kept?", a: "Plain JSON under ~/.local/share/mcp-servers/asset-register/, or $XDG_DATA_HOME if you set it. The rate tables are files inside the package. There is no network call anywhere in this server, no account and no API key, and license keys are verified offline." },
    ],
  },

  "per-diem-and-travel-allowances-from-chat": {
    title: "Per diem and travel allowances from chat, on the rate tables the tax authorities publish",
    description: "Price a business trip under the Polish delegation regulation, the HMRC benchmark scale rates or the US GSA standard, with the partial-day ladder and every meal deduction shown. Why a substring match on a country name priced a trip to Oman at Romania's rate, and why the HMRC overseas table is deliberately not bundled.",
    html: `<h1>Per diem and travel allowances from chat, on the rate tables the tax authorities publish</h1>
<p>A per diem is a number somebody else decided. A tax authority publishes a daily amount, a ladder of
partial days and a rule about the meals your host paid for, and your job is to apply their arithmetic to
your trip and put the answer on a claim or a return. That is a calculation, not a judgement, which is
exactly the kind of thing worth handing to a tool. The <a href="/s/per-diem">MCP Per Diem</a> server holds
three of those schemes as files inside the package, prices a trip against one of them, and shows the ladder
and every deduction next to the number that produced it. There is no network call anywhere in it.</p>

<h2>Install it</h2>
<pre><code>claude mcp add per-diem -- npx -y @theluckystrike/mcp-per-diem</code></pre>
<p>Cursor, in <code>.cursor/mcp.json</code>, and Claude Desktop with the same block under
<code>claude_desktop_config.json</code>:</p>
<pre><code>{
  "mcpServers": {
    "per-diem": { "command": "npx", "args": ["-y", "@theluckystrike/mcp-per-diem"] }
  }
}</code></pre>
<p>It reads the same business profile as <a href="/s/invoice">MCP Invoice</a> and
<a href="/s/expense-tracker">MCP Expense Tracker</a>, so the traveller's name and your default currency are
set once, and it borrows its datetime and zone handling from <a href="/s/timezone">MCP Timezone</a> rather
than carrying a second copy of it.</p>

<h2>The three schemes, and what each one counts</h2>
<table>
<tr><th>Scheme</th><th>What a day is</th><th>What it pays</th></tr>
<tr><td>Poland, domestic and per country</td><td>24-hour periods from departure (the <em>doba</em>)</td><td>PLN 45.00 a day at home plus a 150 percent lodging lump sum; abroad the annex diet in the country's own currency</td></tr>
<tr><td>UK, inside the UK</td><td>Hours away, in bands</td><td>GBP 5.00 from 5 hours, GBP 10.00 from 10, GBP 25.00 from 15 when the journey is still going at 8pm, plus the late-evening supplement</td></tr>
<tr><td>US, GSA CONUS standard</td><td>Calendar days in the destination zone</td><td>The standard M&amp;IE at 75 percent on the first and last day, with lodging as a receipted <strong>cap</strong> rather than an allowance paid out</td></tr>
</table>
<p>The same trip gives different answers under different schemes, and both are right. Noon to noon across
Poland's spring clock change is 23 elapsed hours: one Polish <em>doba</em>, PLN 45.00, and two US calendar
days, USD 102.00. The server counts elapsed hours as a difference between two instants, never as text, which
is why it gets that trip right in March and October rather than only in the other ten months. Pass ISO 8601
with an offset, or a local datetime plus an IANA zone.</p>

<h2>What you say, and which tool runs</h2>
<table>
<tr><th>What you say</th><th>Tool</th></tr>
<tr><td>What is the per diem for 58 hours in Krakow, with breakfast provided on the first day and two hotel nights?</td><td><code>perdiem_calc</code></td></tr>
<tr><td>Show me the Polish foreign rates for Germany, and where they come from.</td><td><code>perdiem_rates</code></td></tr>
<tr><td>Save that as the Krakow audit trip.</td><td><code>trip_record</code></td></tr>
<tr><td>What have I claimed this quarter?</td><td><code>trip_list</code></td></tr>
<tr><td>Give me the expense lines for that trip.</td><td><code>trip_export</code></td></tr>
<tr><td>Total my per diems per scheme and per month.</td><td><code>perdiem_report</code></td></tr>
</table>
<p>A worked Polish domestic answer, 58 hours to Krakow with breakfast provided on the first day and two
nights in a hotel:</p>
<pre><code>day 1  45.00 less 25 percent breakfast   PLN 33.75
day 2  full doba                         PLN 45.00
day 3  10 h remainder, over 8 h          PLN 45.00
diets                                    PLN 123.75
lodging lump sum  2 x 67.50              PLN 135.00
total                                    PLN 258.75</code></pre>

<h2>The measured thing: a substring match priced a trip to Oman at Romania's rate</h2>
<p>The first build resolved a destination by exact country name, then by ISO code, then by
<code>country.includes(destination)</code> as a last resort. <code>"romania".includes("oman")</code> is
<code>true</code>. A trip to Oman came back priced at Romania's EUR 42.00 diet, in the wrong currency, from a
country three thousand kilometres away, with no note and no warning. It was caught by a test that expected a
refusal and got a successful calculation instead.</p>
<p>The fix is one line: the fallback is now a prefix match of four characters or more, so a destination that
is genuinely absent is refused by name. The lesson is worth more than the fix. <strong>A fuzzy match is safe
when a miss is cheap and dangerous when a miss is silent</strong>, and here a miss produces a tax figure. It
is the table being <em>deliberately partial</em> that makes the substring fallback unsafe: with a complete
table a wrong row is a near miss on a real country, and with a partial one it is a row that should never
have matched at all, handed to the caller as a confident number in place of the refusal that would have sent
them to the regulation.</p>

<h2>The gap this server will not paper over: HMRC overseas</h2>
<p>HMRC publishes worldwide subsistence scale rates per city, roughly 250 of them with eight figures each in
the destination's own currency. <strong>None of them is bundled here.</strong> They could not be stated with
confidence from the public text at build time, so the file ships with an empty rate list and a header that
says why, <code>perdiem_rates</code> reports the gap in its notes, and
<code>perdiem_calc {scheme: "uk", destination: "Paris"}</code> refuses by name and gives you the HMRC page.
The UK domestic benchmark rates, all four of them, <em>are</em> bundled and complete.</p>
<p>The same rule shapes the other tables. The Polish annex ships 34 countries rather than all of them, and a
country outside those 34 is refused with the words "not verified here", never "no rate exists", because
those are different statements and only one of them is true. The US table ships the CONUS <em>standard</em>
rate rather than the roughly 300 non-standard localities, which is the rate a destination outside those
localities takes anyway.</p>
<p>A per diem ends up on a tax return. A wrong figure that looks authoritative is worse than an absent one,
because an absent one is refused by name and you go and look it up. Every rate that is bundled carries its
authority, its instrument, the source URL and the date it took effect, and <code>perdiem_rates</code> hands
that header back with the numbers so the provenance travels with them.</p>

<h2>Handing a trip to the expense tracker</h2>
<p><code>trip_export</code> returns the exact <code>expense_add</code> arguments for the
<a href="/s/expense-tracker">expense tracker</a>, one payload per currency, and writes nothing itself. That
is deliberate: expense-tracker publishes no library entry point, and its id counter, category rules, VAT
split and currency defaults all live inside its own handler under its own lock. Appending a row to its store
directly would produce an expense with none of those applied, one that looks native and is not. No
<code>vat_rate</code> is set either, because a statutory per diem is an allowance rather than a purchase and
there is no input VAT to reclaim on it.</p>
<p>Currencies are never added together anywhere in this server. A PLN diet and a EUR one stay two figures,
in <code>trip_list</code> and in <code>perdiem_report</code> alike, because there is no exchange rate here
and inventing one would be inventing the total.</p>

<h2>Free and Pro</h2>
<p>Rate lookups and calculations are free and unlimited on every tier, on all three schemes. That is
deliberate: the tables are public regulation, and metering the reading of a regulation would be charging for
the tax authority's work rather than for this server's. What the free tier limits is saving trips, at 5 a
calendar month counted by start date, with trip lists unlimited. Pro
(<a href="/buy/per-diem?src=store.guide.per-diem-and-travel-allowances-from-chat">$19 one-time</a>, or <a href="/bundle">$39 for the bundle</a>) removes that cap and
adds the expense-tracker export payloads and the report of totals per scheme and per calendar month.</p>`,
    faq: [
      { q: "Where do the rates come from, and how do I know they are current?", a: "Each table is a file inside the package carrying the authority, the instrument, the source URL, the date the rates took effect and the date they were read, and perdiem_rates returns that header with the rates. There is no live feed, deliberately: a figure that changed under you between two runs of the same trip is worse than one that is visibly stale, because the stale one is checkable. Read the effective_date in any answer before you rely on it." },
      { q: "Why are the HMRC overseas rates missing?", a: "Because they could not be stated with confidence from the public text at build time, and a wrong per diem that looks authoritative is worse than an absent one. The file ships with an empty rate list and a header saying so, and perdiem_calc with a foreign destination under the uk scheme refuses by name and points at the HMRC page. The four UK domestic benchmark scale rates are bundled and complete." },
      { q: "What happens if my destination is not in the table?", a: "It is refused by name, with the words not verified here rather than no rate exists, and you are pointed at the regulation. It is never priced at a neighbouring country's rate. That is the fix for the Oman defect above: the name fallback is a prefix match of four characters or more, so an absent country fails closed." },
      { q: "Does it handle a trip across a daylight saving change?", a: "Yes, and that is why start and end are instants rather than wall clocks. Noon to noon across Poland's spring change is 23 elapsed hours, one Polish 24-hour period at PLN 45.00, and the same trip under the US scheme is two calendar days at USD 102.00. A local time that falls inside the spring-forward gap resolves forward rather than being kept silently." },
      { q: "How are provided meals deducted?", a: "By each scheme's own rule, and a day never goes below zero. Poland takes 25/50/25 percent of a domestic day and 15/30/30 of a foreign one; the US deducts the published breakfast, lunch and dinner amounts of the M&IE tier and never the incidentals; the UK removes a pro rata share of the band. The UK pro rata is this server's reading of HMRC's principle rather than a published figure, and the answer says so in its rule field." },
      { q: "What does the free tier actually limit?", a: "Only saving a trip, at 5 a calendar month by start date. perdiem_rates, perdiem_calc and trip_list are unlimited on every tier. trip_export and perdiem_report are Pro. A trip starting in a different month is not blocked by this month's five." },
      { q: "Where is the data kept?", a: "Plain JSON under ~/.local/share/mcp-servers/per-diem/, or $XDG_DATA_HOME if you set it. The rate tables are files inside the package. There is no network call anywhere in this server, no account and no API key, and license keys are verified offline." },
    ],
  },

  "client-statements-and-dunning-from-chat": {
    title: "Client statements and payment chasers from chat, aged as at any date you name",
    description: "Turn the invoices, credit notes and deposits you already keep into a statement of account for a period, age what is open into 0-30, 31-60, 61-90 and over 90 days AS AT a date, and draft the chaser. Why aging a past date with today's payment figures reports zero overdue on a day when a third of the book was late, and why paid_minor rather than the payment rows is the authority.",
    html: `<h1>Client statements and payment chasers from chat, aged as at any date you name</h1>
<p>A client asks what they owe you. The honest answer is not one invoice, and it is not five invoices
forwarded in a row: it is a statement of account. The balance they were carrying at the start of the period,
every invoice you issued in it, every payment that came in, every credit note you gave, and the balance at the
end. The <a href="/s/statement-of-account">MCP Statement of Account</a> server builds that document out of
books you already keep, ages what is still open, and drafts the chaser when it is late. It reads three stores
and writes into none of them.</p>

<h2>Install it</h2>
<pre><code>claude mcp add statement-of-account -- npx -y @theluckystrike/mcp-statement-of-account</code></pre>
<p>Cursor, in <code>.cursor/mcp.json</code>, and Claude Desktop with the same block under
<code>claude_desktop_config.json</code>:</p>
<pre><code>{
  "mcpServers": {
    "statement-of-account": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-statement-of-account"]
    }
  }
}</code></pre>
<p>It reads the invoice ledger from <a href="/s/invoice">mcp-invoice</a>, the credit notes from
<a href="/s/billing-docs">mcp-billing-docs</a> and the deposits from <a href="/s/deposits">mcp-deposits</a>,
plus the shared business profile for the bank details a chaser prints. Only the first of those is required:
with no deposits installed the statement simply has no deposit line and says so.</p>

<h2>A statement is a view, never a second copy of a balance</h2>
<p>This server writes exactly one file of its own, a register of the statements it built, and it never reads a
balance back out of it. Every figure in every answer is recomputed from the invoices, the credit notes and the
deposits at the moment you ask. A stored balance is a second number that can be wrong, and the moment it
disagrees with the ledger there is no way to tell from the document which one to believe. The test suite
asserts the bytes <em>and</em> the mtimes of five sibling files are unchanged across all six tools, the PDF
path included.</p>
<p>The same rule decides what an unreadable sibling store means. A store that is not there at all is normal:
you never installed the deposits server, the statement is still correct and it reports <code>rows: 0</code>. A
store that is on disk and did not parse is a different thing entirely: money exists that could not be read, so
the answer carries the error and a sentence naming which figure is therefore incomplete. Turning a balance
that could not be computed into a balance of nothing owed is the one failure that would be invisible in the
document and expensive in the world.</p>

<h2>The measured part: aging is as at a date, in both directions</h2>
<p>Almost every aging report in the wild is written the same way. Take each invoice, subtract what is marked
paid, subtract the credit notes, bucket the remainder by the due date. That rule has a bug that does not
announce itself: the subtraction is not dated. When you ask what was outstanding last month, you get last
month's invoices with this month's payments already taken off them.</p>
<p>Here is what that costs, measured on one worked month with four invoices, two credit notes and one deposit
application, aged at 2026-06-10:</p>
<pre><code>{
  "as_of": "2026-06-10",
  "as_at_rule": { "outstanding": 250000, "overdue": 50000 },
  "naive_rule":  { "outstanding": 170000, "overdue": 0 }
}</code></pre>
<p>The naive rule understates what was owed on that day by 800.00 of 2,500.00, and it reports <strong>nothing
overdue</strong> on a date when 500.00 was 31 days late, because one payment arrived on 12 June and it has
already been subtracted on the 10th. A third of the balance and all of the overdue vanish. The buckets still
add up, so nothing looks broken, and the answer cannot be reproduced next month because the input keeps
moving. This server dates the subtraction: an invoice issued after the date is not on the books, a payment
made after it has not happened, and a credit note issued after it has not been given.</p>
<p>The other half of the same rule: <strong>due today is not overdue</strong>. An invoice enters the 0-30
bucket on the first day past its due date, so that bucket holds days one to thirty and day zero sits in a
<code>not_yet_due</code> line reported beside the four buckets. It is real money and it is shown; it is simply
not late, and putting it in a bucket labelled overdue would send a chaser to a client who has done nothing
wrong.</p>

<h2>paid_minor is the authority, the payment rows are only the attribution</h2>
<p>On a real machine these two do not agree, and the disagreement is normal rather than corrupt.
<code>invoice_mark_paid</code> writes both. <code>deposit_apply</code> in the deposits server raises
<code>paid_minor</code> and appends <strong>nothing</strong> to <code>payments[]</code>, because the movement
lives on the deposit as an application. An invoice created before the payments array existed carries a
<code>paid_minor</code> and a single paid date and no rows at all.</p>
<p>So the payment rows on a statement are assembled as every row in <code>payments[]</code>, plus every
deposit application naming that invoice, plus one residual row at the paid date for whatever
<code>paid_minor</code> still exceeds those two. They sum to <code>paid_minor</code> exactly, and the closing
balance reconciles per invoice. Reconstructing receipts from <code>payments[]</code> alone would have lost
300.00 of the worked month's 900.00 of cash, a third of the receipts, with no error raised anywhere. When the
attribution sums to <em>more</em> than <code>paid_minor</code>, nothing is scaled and nothing is dropped in
silence: the whole attribution is discarded, one row for <code>paid_minor</code> is shown, and a note names
the invoice and the difference.</p>

<h2>A deposit applied is money that moves once</h2>
<p>This is the trap worth stating out loud, because the first build of this server fell into it. A deposit
applied to an invoice has already raised that invoice's <code>paid_minor</code>, so it is <em>inside</em>
payments received. It is broken out as <code>of_which_deposits_applied</code>, which is a breakdown and not a
fourth column. Treating it as a fourth credit paid every deposited invoice twice, and the only reason it was
caught is that the worked month has a deposit in it. Deposit money still held is a memo line and is never in
the balance: it is the client's money until it is applied.</p>

<h2>The chaser escalates in tone and never in figures</h2>
<p><code>dunning_text</code> has three levels: friendly, firm and final demand. The amounts, the invoice list
and the bank details are identical at all three, because a chase whose numbers grow between letters was wrong
at level one. No level states a late fee, an interest rate or a legal cost. This server holds no contract
terms, no statutory rate and no jurisdiction, and a demand for money is the last place to put an invented
number. Bank details print only when the shared profile actually carries them, and when it does not the answer
tells you the letter asks for payment without saying where to send it, rather than sending it anyway. A chaser
for a client with nothing past due is refused, and the refusal names what is outstanding but not yet due.</p>

<h2>Currencies are never added together</h2>
<p>One statement is one currency, and a client billed in two is asked which. Aging and the all-clients report
total per currency and no line anywhere holds the sum. There is no exchange rate in this server, so there is
no rate to be silently wrong.</p>

<h2>A credit note reduces the invoice it names, and no other</h2>
<p>An open balance floors at zero and the excess comes back as <code>unapplied_credit</code>. Letting a
1,500.00 credit note on a paid invoice quietly cancel an unrelated 400.00 invoice would be inventing an
agreement the client never made. The statement, which is a balance rather than an aging, does carry the whole
credit, so a client who is genuinely owed money sees a negative closing balance and the text says it is in
their favour.</p>

<h2>Free and Pro</h2>
<p><code>statement_aging</code> is free and unlimited on every tier, for one client or for all of them. That
is deliberate: who owes me money is the question this server exists for, and a free tier that hides it is a
demo rather than a tool. The meter is on the document that actually goes to a client, five distinct statements
a calendar month, counted by client, period and currency, so rebuilding one already in the register is free
forever in all three renderings. Plain text statements and dunning at levels 1 and 2 are free. Pro
(<a href="/buy/statement-of-account?src=store.guide.client-statements-and-dunning-from-chat">$19 one-time</a>,
or <a href="/bundle">$39 for the bundle</a>) removes the cap and adds the A4 PDF with your logo, the level 3
final demand, and <code>statements_report</code>: every client at once, per currency, ranked by what is
overdue rather than by what is large.</p>`,
    faq: [
      { q: "Does it change my invoices?", a: "No. It reads the invoice ledger, the credit notes and the deposits and writes into none of them. The only file it owns is a register of the statements it built, and no balance is ever read back out of that register: every figure is recomputed from the books when you ask. The contract suite asserts the bytes and the mtimes of five sibling files are unchanged across all six tools, including the PDF path." },
      { q: "Why does aging as at a past date give different numbers from my accounting software?", a: "Because most aging reports do not date the subtraction. They take today's paid figure off an invoice and bucket the remainder by the due date, so a payment that arrived after the date you asked about has already been deducted. Measured on one worked month at 2026-06-10, that rule reports 1,700.00 outstanding and zero overdue where the dated rule reports 2,500.00 outstanding of which 500.00 is 31 days late. The buckets still add up under both, which is why the error is easy to miss." },
      { q: "An invoice is due today. Which bucket is it in?", a: "None of the four. It sits in not_yet_due, which is reported beside the buckets rather than inside them or hidden. The 0-30 bucket holds days one to thirty past the due date. Money that is outstanding and not yet late is real and is shown, but it is not aged, because it is not late." },
      { q: "I applied a deposit to an invoice. Is that counted twice?", a: "No. deposit_apply already raised that invoice's paid_minor, so the money is inside payments received and is broken out as of_which_deposits_applied. It is a breakdown, not a fourth column. The first build of this server did treat it as a fourth credit and paid every deposited invoice twice; the worked month is the test that caught it. Deposit money still held is a memo line and is never in the balance." },
      { q: "What happens when the deposit book and the invoice ledger disagree?", a: "paid_minor on the invoice wins, because it is the field every server writes and the balance is computed from it. If the attribution sums to more than paid_minor the whole attribution is discarded, one row for paid_minor is shown at the paid date, and a note names the invoice and the difference. Nothing is scaled to fit and nothing is dropped in silence." },
      { q: "Does the chaser add interest or a late fee?", a: "Never, at any level. This server holds no contract terms, no statutory rate and no jurisdiction, so any figure it invented would be a number in a demand for money with nothing behind it. The three levels change the tone and the deadline; the amounts, the invoice list and the bank details are identical across all three. Bank details print only if your shared profile carries them, and the answer tells you when it could not." },
      { q: "Can one statement cover a client billed in two currencies?", a: "No, and it asks you which rather than picking one. There is no exchange rate anywhere in this server, so a combined total would be an invented rate. Aging and the all-clients report state each currency separately and no line holds the sum." },
      { q: "What does the free tier actually limit?", a: "Only the statements you build: five distinct ones a calendar month, counted by client, period and currency, so rebuilding one already in the register is free forever. statement_aging is free and unlimited for one client or for everyone, statement_text is free, and dunning at levels 1 and 2 is free. The PDF, the level 3 final demand and statements_report are Pro." },
      { q: "Where is the data kept?", a: "The statement register is plain JSON under ~/.local/share/mcp-servers/statement-of-account/, or $XDG_DATA_HOME if you set it. The invoices, credit notes and deposits stay in their own servers' directories and are only read. There is no network call anywhere in this server, no account and no API key, and license keys are verified offline." },
    ],
  },

  "credit-notes-and-purchase-orders-from-chat": {
    title: "Credit notes and purchase orders from chat, against your real invoices",
    description: "Reverse an invoice in full, by amount or by line, with the VAT unwound at the rates it actually charged, and raise and receive supplier purchase orders. Why a single-rate credit note on a mixed-VAT invoice is wrong by 22.6 percent.",
    html: `<h1>Credit notes and purchase orders from chat, against your real invoices</h1>
<p>Two documents sit either side of an invoice and neither is an invoice. A <strong>credit note</strong> is
what you owe a client when work comes back or you billed twice: it names the invoice it reverses and takes
money off it, with the VAT unwound at the rate you charged. A <strong>purchase order</strong> is what you owe
a supplier before they ship: what you want, at what price, by when, with your own details on it. The MCP
Billing Docs server writes both against the invoices and clients the
<a href="/s/invoice">MCP Invoice</a> server already holds, on your machine, with no network call anywhere in
it.</p>

<h2>Install it beside the invoice server</h2>
<pre><code>claude mcp add invoice -- npx -y @theluckystrike/mcp-invoice
claude mcp add billing-docs -- npx -y @theluckystrike/mcp-billing-docs</code></pre>
<p>Cursor, in <code>.cursor/mcp.json</code>, and Claude Desktop with the same block under
<code>claude_desktop_config.json</code>:</p>
<pre><code>{
  "mcpServers": {
    "invoice": { "command": "npx", "args": ["-y", "@theluckystrike/mcp-invoice"] },
    "billing-docs": { "command": "npx", "args": ["-y", "@theluckystrike/mcp-billing-docs"] }
  }
}</code></pre>
<p>Both read one data directory and one business profile, so your name, address, VAT id and default currency
are set once. Billing Docs holds no copy of the money, VAT or currency code: it imports
<code>computeTotals</code>, <code>currencyDecimals</code> and <code>formatMoney</code> from the invoice
engine, which is why a credit note and the invoice it reverses agree to the minor unit rather than to the
nearest cent.</p>

<h2>The measured thing: a single-rate credit note on a mixed-VAT invoice is wrong by 22.6 percent</h2>
<p>Take an invoice with two rates on it, which is ordinary the moment printing, food, books or transport sit
next to consulting: EUR 1,000.00 of consulting at 23% plus EUR 500.00 of print at 8%, EUR 1,770.00 gross. The
client is owed ten percent back, EUR 177.00.</p>
<p>Written as a single-rate credit note, at the headline 23%, that is net EUR 143.90 and VAT EUR 33.10. Split
across the rates the invoice actually used, in proportion to each rate's share of the total, it is net
EUR 150.00 and VAT EUR 27.00, EUR 23.00 at 23% and EUR 4.00 at 8%.</p>
<table>
<tr><th></th><th>Single rate</th><th>Split across the invoice's rates</th></tr>
<tr><td>Gross</td><td>EUR 177.00</td><td>EUR 177.00</td></tr>
<tr><td>Net</td><td>EUR 143.90</td><td>EUR 150.00</td></tr>
<tr><td>VAT</td><td>EUR 33.10</td><td>EUR 27.00</td></tr>
</table>
<p><strong>The gross is identical.</strong> The document the client receives, the amount they are refunded and
the payment that follows are the same under both methods, so the counterparty has nothing to query and no
later reconciliation surfaces it. The only line that differs is the VAT, by EUR 6.10, which is 22.6 percent of
it, and that is the number that goes on a VAT return.</p>
<p>This generalises past VAT: when a wrong answer and a right answer agree on the one figure the counterparty
checks, no amount of downstream review finds the error. It has to be right at the point the document is
written. <code>credit_note_create</code> with an <code>amount_minor</code> therefore splits the gross across
the invoice's own rates and reuses each one, rather than asking you for a rate.</p>

<h2>Three ways to credit, and why two of them copy rather than recompute</h2>
<p><code>credit_note_create</code> takes an invoice number and one of three things:</p>
<ul>
<li><strong>Nothing else</strong>: the whole invoice is reversed.</li>
<li><strong>An <code>amount_minor</code></strong>: a gross figure in minor units, split across the invoice's
rates as above.</li>
<li><strong><code>lines</code></strong>: named invoice lines with quantities, for "they returned two of the
five".</li>
</ul>
<p>A whole invoice and a whole line copy the stored numbers instead of recomputing them. The client agreed to
the figures the invoice printed, and recomputing a line from a rounded unit price is exactly how a document
and the credit note that reverses it come to differ by a cent. Only a partial quantity is recomputed, and then
on the invoice's own unit price, tax rate and discount.</p>
<p>Every money field is stored negative, including the unit price, while the quantity stays positive: a line
reads <code>10 x EUR -90.00 = EUR -900.00</code>, which reproduces on a calculator, and summing
<code>gross_minor</code> over a period's documents gives the net of what was billed without anybody having to
know which rows to flip.</p>

<h2>You cannot credit more than the invoice charged</h2>
<p>The remaining creditable amount is the invoice total less everything already credited against it, read
from this server's own store. Ask for a cent more and it refuses by name, and stores nothing:</p>
<pre><code>at most EUR 1107.00 can still be credited; this credit note is for EUR 1107.01.
A credit note that gives back more than was billed is a refund, not a credit note.
Nothing was stored.</code></pre>
<p>The check and the write are one critical section under both servers' locks, so two processes cannot each
see room and both take it. Ten concurrent EUR 200.00 credits against a EUR 1,107.00 invoice store exactly
five and refuse exactly five.</p>
<p>The link lives on the credit note rather than on the invoice, deliberately: the invoice engine's record has
no credited field, and adding one would mean two servers writing the same record with whichever saved last
winning. <code>credit_note_list {invoice: "INV-2026-0001"}</code> is the query, and the create response says
so rather than leaving it to be found.</p>

<h2>Purchase orders, and receiving them in part</h2>
<p><code>purchase_order_create</code> takes line items, VAT, a currency and an expected delivery date, and
<code>purchase_order_text</code> gives you the message to send the supplier.
<code>purchase_order_receive</code> marks it received in full or in part, so an order stays open at
"3 of 10 delivered" instead of being a yes or a no. Receiving the same order in full twice is refused with
the date it was already received on; a receipt dated before the order is refused by name; two currencies on
one order is refused before anything is stored.</p>
<p><code>billing_docs_report</code> is the read that makes the pile useful: credited per currency, on order
per currency, and every delivery past its date. There is a <code>chase_deliveries</code> prompt and a
<code>billing-docs://open-orders</code> resource for the same question asked from the client's own UI.</p>

<h2>Numbering</h2>
<p>Ids are <code>CN-YYYY-NNNN</code> and <code>PO-YYYY-NNNN</code>, the same shape as
<code>INV-YYYY-NNNN</code> and <code>Q-YYYY-NNNN</code>. A counter that resets every January collides with
last January's document, so the year is in the id. The counter is written before the row, so a crash burns an
id rather than reusing one, and existing ids are scanned first so a restored store cannot reissue one.</p>

<h2>Free tier and Pro</h2>
<p>Free gives 5 documents a calendar month, credit notes and purchase orders together, counted by issue date.
Everything that decides whether the document is <em>correct</em> is on the free tier: full, partial and
per-line credit notes, the VAT split, multiple currencies, the over-credit refusal and receiving orders, plus
both plain-text exports unmetered. Pro ($19 once, or $39 for the whole collection, lifetime) removes the
monthly count and adds both A4 PDFs with your logo and no footer credit, and
<code>billing_docs_report</code>. Full detail on <a href="/s/billing-docs">the MCP Billing Docs page</a> and
the general <a href="/guides/mcp-server-free-vs-pro">free versus Pro</a> comparison.</p>
${FOOT}`,
    faq: [
      { q: "Why does crediting part of a mixed-VAT invoice at one rate matter if the client is refunded the right amount?", a: "Because only the VAT line is wrong. On an EUR 1,770.00 invoice of consulting at 23% and print at 8%, a EUR 177.00 credit is gross EUR 177.00 either way, so the client's document and the payment are identical and nothing downstream queries it. The VAT differs by EUR 6.10, 22.6 percent of it, and that figure goes on a VAT return. The split has to be right when the document is written." },
      { q: "Can a credit note give back more than the invoice charged?", a: "No. The remaining creditable amount is the invoice total less everything already credited against it, and a request for more is refused by name with nothing stored: a credit note that gives back more than was billed is a refund, not a credit note. The check and the write are one critical section under both locks, so ten concurrent EUR 200.00 credits against EUR 1,107.00 store exactly five." },
      { q: "Does it write to my invoices?", a: "No. The invoice engine's Invoice record has no credited field, and adding one would mean two servers writing the same record with whichever saved last winning. The link lives on the credit note, and credit_note_list {invoice: \"INV-2026-0001\"} is the query. If a future invoice version carries the field, it is written back too, so the two can never disagree by omission." },
      { q: "Why are credit note amounts stored negative?", a: "So a bookkeeper summing gross_minor over a period's documents gets the net of what was billed without knowing which rows to flip. The unit price is negative and the quantity positive, so a line reads 10 x EUR -90.00 = EUR -900.00 and reproduces on a calculator." },
      { q: "What counts against the 5 free documents a month?", a: "Created credit notes and purchase orders together, counted by issue date, so a document dated in another month is not blocked by this month's count. Reading, listing, receiving an order and both plain-text exports are never metered. The two PDFs and billing_docs_report are Pro." },
      { q: "Do I need the invoice server as well?", a: "For credit notes, yes: they are written against invoices and clients that server holds, and the money and VAT code is imported from it rather than copied. Purchase orders only need the shared business profile, so they work with billing-docs alone, but running both is the intended setup." },
    ],
  },

  "one-install-office-suite": {
    title: "One install, every server: the office-suite bundle",
    description: "One stdio server proxies all twenty sibling servers as 198 tools in one tools/list. What it is, the .mcpb and the npx line, the four prefixed tool names, and the six-prompt cross-server audit that scored 13 of 18 against the earlier nineteen-server, 186-tool build.",
    html: `<h1>One install, every server: the office-suite bundle</h1>
<p>Twenty servers in this collection each do one job: time tracking, invoicing, quotes, expenses,
spreadsheets, prices, currency, a Word proposal, contract clauses, a resume, PDF merges, an .ics
calendar, a kanban board, image resize, bank CSV reconciliation, barcodes and SEPA payment QR codes,
safe zip archives, and credit notes and purchase orders against those same invoices. Adding all
twenty to a client one at a time is twenty config entries, twenty absolute paths, twenty things to
remember are running. <strong>office-suite</strong> is the same twenty servers behind one config
entry: it starts each one as its own child process over stdio, forwards every tool, resource and
prompt call to whichever child owns the name, and merges their license state into one pair of tools,
<code>license_status</code> and <code>license_activate</code>. Nothing is reimplemented. Each child
keeps its own local JSON storage, exactly as it does standalone.</p>

<h2>Install it</h2>
<p>One command for Claude Code:</p>
<pre><code>claude mcp add office-suite -- npx -y @theluckystrike/mcp-office-suite</code></pre>
<p>Cursor, VS Code, Windsurf and Cline read the same shape of config. Add this block to the client's
own MCP config file and restart it:</p>
<pre><code>{
  "mcpServers": {
    "office-suite": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-office-suite"]
    }
  }
}</code></pre>
<p>Claude Desktop takes the same block in <code>claude_desktop_config.json</code>, or skips JSON
entirely: <code>office-suite.mcpb</code> is a one-click bundle attached to
<a href="https://github.com/theluckystrike/mcp-servers/releases/latest">the latest release</a>, and
opening it shows an installation dialog. There is no account, no API key and no login step: every
child runs locally over stdio and writes to its own folder under
<code>~/.local/share/mcp-servers/&lt;name&gt;/</code>.</p>

<h2>198 tools in one namespace, and the four names that collided</h2>
<p>Read live off a built bundle on 2026-09-05: the twenty children's own <code>tools/list</code> calls
sum to more names than a client ever sees, because each child also registers its own
<code>license_status</code> and <code>license_activate</code> pair. The bundle merges those twenty
pairs down to one, and what is left after that merge is <strong>198 tools</strong> on the bundle's
own <code>tools/list</code>. Out of those 198 names, exactly four needed disambiguating: invoice and
docx both register a tool called <code>business_set</code>, and expense-tracker and bank-statement
both register one called <code>category_rules</code>. The bundle exposes all four, prefixed with the
server they came from: <code>invoice_business_set</code>, <code>docx_business_set</code>,
<code>expense-tracker_category_rules</code> and <code>bank-statement_category_rules</code>. It
rewrites each child's own reply so a message that said "run business_set" or "run category_rules"
says the name you can actually call. Every other tool keeps its bare name unchanged.
Twenty servers, and the bundle had to rename exactly two collisions, four tool names in total.</p>

<h2>Six sentences that each need two or more children, measured</h2>
<p>An audit ran the real Claude CLI against the built bundle with all 186 tools on an explicit
allowlist, the CLI's own file and web tools denied, an empty working directory, and one running
conversation. Six prompts, each written the way a person phrases a request, each needing two or more
of the children in a single sentence. This was measured on 2026-09-04 against the nineteen-server
build with 186 tools, before billing-docs joined the bundle; the sentences, scores and defects below
are that measurement, unchanged. Quoted verbatim, with what happened:</p>
<ol>
<li><strong>"Log 3 hours today on Nova design and invoice them at EUR 90"</strong>: time-tracker
plus invoice. The model checked for a client named Nova, found none, and asked before writing. Told to
go ahead, it created the client, logged the entry, generated the invoice and marked the hours billed,
unprompted: <code>INV-2026-0001</code>, EUR 270.00 plus 23% VAT is EUR 332.10, due in 14 days from the
shared business profile. Scored 2 of 3 for the unnecessary question.</li>
<li><strong>"Quote Acme 2 days consulting at PLN 1200, then make the payment QR for it"</strong>:
quotes plus barcode. The quote came out right, PLN 2,952.00 with VAT. Then it stopped and explained,
correctly, that the SEPA payment QR format is euro-only and a Polish-zloty invoice cannot carry one,
offering an FX conversion or a plain data code instead of guessing. Scored 2 of 3: right answer, but a
question rather than either alternative done.</li>
<li><strong>"Import this bank CSV http://127.0.0.1:8794/bank.csv and tell me which subscriptions are
not in my expense log"</strong>: bank-statement plus expense-tracker. The import tool treated
the URL as a relative filesystem path and failed with a path that never existed on disk. Given a local
path instead, it found the two subscriptions with no matching expense row, Notion EUR 10.00 and Slack
EUR 8.75, EUR 18.75 untracked, exactly right. Scored 2 of 3 for the wasted turn. This URL-as-path
defect is fixed; see below.</li>
<li><strong>"Find a 45-minute slot with Ann in New York this week and export it as .ics"</strong>
: timezone across contacts, slot-finding and calendar export. The instant produced was correct
to the second, 09:30 to 10:15 America/New_York, translated from Warsaw with no timezone question
asked. Scored 2 of 3 because the run day was a Saturday, the slot landed on the following Monday, and
nothing in the answer said the week asked for had run out. Fixed; see below.</li>
<li><strong>"Resize http://127.0.0.1:8794/logo.png to 512 px and put it on a PAID stamp on invoice
INV-2026-0001's PDF"</strong>: image, invoice and pdf, three children in one sentence. All three
tools ran correctly: a 512x512 PNG, a rendered invoice PDF, a PAID stamp at 45 degrees on a second
copy. It also declined to pretend the logo was composited onto the stamp, since no tool does that, and
said so rather than fabricating it.</li>
<li><strong>"Zip this month's invoices and quotes"</strong>: zip, invoice and quotes. One tool
call, <code>zip_bundle_month</code>, and it named the reason the quote PDF was missing from the
archive: rendering a quote to PDF is a Pro feature and none had been rendered. Scored 3 of 3, the
cleanest prompt of the six.</li>
</ol>

<h2>What the reach numbers actually say</h2>
<p>Across the six prompts, 20 tool calls went to the bundle, and every single one landed in the
correct child and the correct tool inside it: zero cross-child confusion, zero wrong-server picks.
The "first tool called with no hint" reach was 5 of 6, 83%; the stricter "was the very first call the
working tool" reading was 3 of 6, 50%, but all three misses were the same habit, reading an empty
list of clients or contacts before writing to it, not a wrong pick. This was measured on 2026-09-04
against the nineteen-server build with 186 tools, 1.7x the 108 tools measured when this bundle held
five children; tool selection did not get worse: 20 of 20 correct against 50 of 51 at the smaller
count. The total score was 13 of 18 across six prompts, 226.5 seconds of wall clock. The bundle has
since grown to twenty servers and 198 tools; that growth has not been re-measured against this
six-prompt audit.</p>
<p>Three defects came out of the same round and are already fixed in the shipped server: a URL handed
to a tool that expects a local file path used to be silently resolved against the server's own
working directory and fail with a path that never existed; <code>find_meeting_slots</code> now always
states the date range it searched and flags it by name when "this week" rolls into the following
Monday; and an empty client or entry list now says which tool creates one automatically from the
fact you already gave, instead of reading as a dead end that buys a confirmation question.</p>

<h2>When to install single servers instead</h2>
<p>The bundle is not always the right size. Windsurf's Cascade agent caps out at 100 tools across
every enabled server, so 198 tools in one entry does not fit at all; installing only the two or three
single servers you actually use, at 9 to 16 tools each, leaves room for the rest of that budget. The
same logic applies anywhere the count matters more than the config-entry count: a project that only
ever needs the time tracker and the invoice server gets the same free tier and the same tools either
way, with fewer license checks and no dormant sibling processes started for the servers it never
calls. Ten of the nineteen children went untouched by the 2026-09-04 audit's six sentences entirely,
which is the concrete argument for installing single servers when you know in advance which two or
three you will actually use, and the bundle when you do not, or when the client charges per
config entry rather than per tool.</p>

<h2>Free tier and Pro</h2>
<p>Each child keeps its own free tier exactly as documented in its own guide; this bundle changes
nothing about those limits, only how many config entries it takes to reach all of them. A single
bundle Pro key, $39 once, lifetime, activates Pro on every child at once instead of buying each
server's own $19 key separately; activation is all-or-nothing and prints a per-child OK/FAILED table
so a bundle that is half Pro cannot look like a full success. Full detail on
<a href="/guides/mcp-server-free-vs-pro">free versus Pro</a>.</p>
${FOOT}`,
    faq: [
      { q: "What exactly is office-suite?", a: "One MCP server, run over stdio, that starts all twenty sibling servers as child processes and proxies their tools, resources and prompts under one connection. Each child stores its data exactly as it does standalone; the bundle adds no storage of its own." },
      { q: "How many tools does it expose?", a: "198, read live off the built bundle on 2026-09-05. Every child also registers its own license_status/license_activate pair; the bundle merges those twenty pairs down to one, and 198 is what is left on the bundle's own tools/list after that merge." },
      { q: "Which tool names needed a prefix?", a: "Four out of 198: invoice and docx both register business_set, and expense-tracker and bank-statement both register category_rules. The bundle exposes invoice_business_set, docx_business_set, expense-tracker_category_rules and bank-statement_category_rules, and rewrites each child's own replies to match. Every other tool keeps its bare name." },
      { q: "Does adding more children make tool selection worse?", a: "Not as of the last measurement. A six-prompt audit needing two or more children per sentence, run on 2026-09-04 against the nineteen-server build with 186 tools, put 20 of 20 tool calls in the correct child and the correct tool, against 50 of 51 at 108 tools with five children. Every remaining defect was a tool declining to say something it already knew, not a wrong pick. The bundle has since grown to twenty servers and 198 tools; that growth has not been re-measured against this audit." },
      { q: "When should I install a single server instead of the whole bundle?", a: "When a client caps total tools, such as Windsurf's Cascade agent at 100, 198 tools does not fit in one entry at all. It is also the better choice when you already know you only need two or three of the twenty: same free tier, fewer license checks, no dormant sibling processes started for servers you never call." },
    ],
  },
};

export const GUIDE_INDEX = {
  title: "Guides for MCP servers in Claude and Cursor",
  description: "Practical guides: billable hours, invoice PDFs, retainers on a schedule, expenses, Excel, prices, ECB rates, Word proposals, clauses, resumes, PDF merges, .ics calendars, kanban boards, image resize, bank CSV reconciliation, quotes, estimates, SEPA payment QR codes, safe zip archives, credit notes and purchase orders, travel allowances, fixed assets and depreciation, client statements and dunning, and the one-install office-suite bundle.",
};
