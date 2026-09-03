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
<p>Free gives unlimited timers and entries, reports and CSV export over the last 7 days, and two projects
with an hourly rate. Pro ($19 once, lifetime) opens full history, invoice summaries, grouping by tag and
unlimited rated projects. The full comparison is in
<a href="/guides/mcp-server-free-vs-pro">free versus Pro</a>. Product page:
<a href="/s/time-tracker">MCP Time Tracker</a>.</p>
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
free. Pro ($19 once) removes the count limit and the footer, and adds a logo and a custom number prefix.
Details on <a href="/s/invoice">the MCP Invoice page</a> and in
<a href="/guides/mcp-server-free-vs-pro">free versus Pro</a>.</p>
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
};

export const GUIDE_INDEX = {
  title: "Guides for MCP servers in Claude and Cursor",
  description: "Practical guides: billable hours, invoice PDFs, retainers on a schedule, expenses, Excel, prices, ECB rates, Word proposals, clauses, resumes, PDF merges, .ics calendars.",
};
