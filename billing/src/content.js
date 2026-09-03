// Long-form guides served at /guides and /guides/<slug>. Hand written, not generated.
// Shape: GUIDES[slug] = { title, description, html, faq: [{ q, a }] }.

// The FAQ section, the related links and the footer are appended by index.js.
const FOOT = "";

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
};

export const GUIDE_INDEX = {
  title: "Guides for MCP servers in Claude and Cursor",
  description: "Practical guides: track billable hours, invoice PDFs, expenses, Excel queries, price watching, ECB currency rates, Word proposals and meeting slots.",
};
