// Long-form guides served at /guides and /guides/<slug>. Hand written, not generated.
// Shape: GUIDES[slug] = { title, description, html, faq: [{ q, a }] }.

// The FAQ section, the related links and the footer are appended by index.js.
const FOOT = "";
const BASE = "https://mcp.zovo.one";
const RELEASES = "https://github.com/theluckystrike/mcp-servers/releases/latest";

/**
 * The servers that answer at https://mcp.zovo.one/mcp/<name>, read off the SERVERS map in
 * remote/src/index.ts (30 of them). office-suite spawns every sibling as a local child
 * process, so it has no hosted form; delivery-schedule has no endpoint yet. A guide about
 * either one gets the bundle and the clone, and is not offered a URL that would 404.
 */
const HOSTED_IDS = new Set([
  "time-tracker", "price-tracker", "invoice", "expense-tracker", "spreadsheet", "currency",
  "timezone", "docx", "resume", "recurring", "clauses", "pdf", "calendar", "kanban", "image",
  "bank-statement", "quotes", "barcode", "zip", "billing-docs", "deposits", "per-diem",
  "asset-register", "statement-of-account", "cash-book", "amortization", "petty-cash",
  "work-order", "catalogue", "change-order",
]);

/**
 * The install block every guide shares.
 *
 * Each guide used to open with `claude mcp add <slug> -- npx -y @theluckystrike/mcp-<slug>`
 * and a Claude Desktop or Cursor config block whose `"command"` was `"npx"`. Nothing has ever
 * been published to npm - registry.npmjs.org returns no versions for any @theluckystrike/mcp-*
 * package, probed 2026-09-07 - so that block does not start a server. Anyone who copied it got
 * a client that failed to boot, which makes it a defect in the product's first instruction
 * rather than a wording preference.
 *
 * So the paths that work today come first: the one-click .mcpb bundle, the hosted URL where
 * there is one, and a clone and build for a client with no bundle installer. The npx form stays
 * last and marked, because it is the line that becomes correct the day the publish happens, with
 * nothing else about it changing.
 *
 * Pass one slug, or an array when a guide needs a pair of servers side by side.
 */
function install(slug) {
  const ids = Array.isArray(slug) ? slug : [slug];
  const many = ids.length > 1;
  const width = Math.max(...ids.map((id) => id.length));
  const hosted = ids.filter((id) => HOSTED_IDS.has(id));
  const files = ids.map((id) => `<code>${id}.mcpb</code>`).join(" and ");
  const addLines = ids
    .map((id) => `claude mcp add --scope user ${id.padEnd(width)} -- node /absolute/path/to/mcp-servers/servers/${id}/dist/index.js`)
    .join("\n");
  const npxLines = ids
    .map((id) => `claude mcp add ${id.padEnd(width)} -- npx -y @theluckystrike/mcp-${id}`)
    .join("\n");
  const jsonEntries = ids
    .map((id) => `    "${id}": {\n      "command": "node",\n      "args": ["/absolute/path/to/mcp-servers/servers/${id}/dist/index.js"]\n    }`)
    .join(",\n");
  const hostedBlock = hosted.length === 0 ? "" : `
<p><strong>Or a URL, with nothing installed.</strong> <a href="/mcp/connect">/mcp/connect</a> mints a free
anonymous token and prints the ready line${hosted.length > 1 ? "s" : ""}:</p>
<pre><code>${hosted.map((id) => `claude mcp add --transport http ${id.padEnd(width)} https://mcp.zovo.one/mcp/${id}/t/&lt;token&gt;`).join("\n")}</code></pre>`;
  return `<p><strong>One click, no JSON.</strong> Download ${files} from the
<a href="${RELEASES}">latest release</a> and open ${many ? "them" : "it"} in Claude Desktop. ${many ? "They run" : "It runs"} on the
Node runtime Claude Desktop ships with, so your own PATH and node version never come into it.</p>${hostedBlock}
<p><strong>Or from a clone,</strong> for a client with no bundle installer. Build once, then point the
client at the built file:</p>
<pre><code>git clone https://github.com/theluckystrike/mcp-servers.git
cd mcp-servers &amp;&amp; npm install
npm run build -w packages/mcp-license ${ids.map((id) => `-w servers/${id}`).join(" ")}

${addLines}</code></pre>
<p>Claude Desktop, Cursor, Windsurf and Cline take the same two strings as JSON, in
<code>claude_desktop_config.json</code> or the client's own MCP config file:</p>
<pre><code>{
  "mcpServers": {
${jsonEntries}
  }
}</code></pre>
<p>The npm packages are not published yet, so the <code>npx</code> form below returns a 404 today. It is
kept because it is what that config becomes the day the publish lands, with nothing else changed;
<a href="/guides/install-mcp-servers-without-npm">installing these servers when npx does not work yet</a>
has the whole picture.</p>
<pre><code>${npxLines}</code></pre>`;
}

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
${install("time-tracker")}
<p>Whichever path you take, there is no account, no API key and no login step. The server runs locally
over stdio and writes to <code>~/.local/share/mcp-servers/time-tracker/</code>.</p>

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
<a href="/s/time-tracker">MCP Time Tracker</a>. There are thirty-one of these MCP servers in total; one
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
${install("invoice")}

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
${install("spreadsheet")}

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
${install("price-tracker")}

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
${install("expense-tracker")}
<p>Whichever path you take, there is no account, no API key and no login step. The server runs locally
over stdio and writes to <code>~/.local/share/mcp-servers/expense-tracker/</code>.</p>

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
${install("currency")}
<p>Exact config paths per client are on the
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
${install("docx")}
<p>Per client paths are on the <a href="/setup/claude-code/docx">setup pages</a>.</p>

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
${install("timezone")}
<p>Per client paths are on the <a href="/setup/cursor/timezone">setup pages</a>.</p>

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
${install("resume")}
<p>Per client paths are on the <a href="/setup/claude-code/resume">setup pages</a>. The document engine
is shared with <a href="/s/docx">MCP Docx</a> rather than duplicated, so a clone build wants both in the
<code>-w</code> list.</p>

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
${install("recurring")}
<p>A clone build wants <code>servers/invoice</code> in the <code>-w</code> list too, because the
invoicing engine is imported from it rather than duplicated. Per client paths are on the
<a href="/setup/claude-code/recurring">setup pages</a>. Install the invoice server as well: this one has
no <code>business_set</code> of its own on purpose, so there is exactly one issuer profile to keep
correct.</p>

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
${install("clauses")}
<p>Per client paths are on the <a href="/setup/cursor/clauses">setup pages</a>. The document engine is
shared with <a href="/s/docx">MCP Docx</a>, so a clone build wants both in the <code>-w</code> list.</p>

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
${install("pdf")}
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
${install("calendar")}
<p>There is exactly one network call in the whole server, and only when you pass a <code>url</code>
yourself, with a 12-second timeout, a 5 MB cap, and a refusal on loopback and private-network
addresses.</p>

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
${install("kanban")}
<p>No account, no API key on any of those paths: the server runs locally over stdio and writes to
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
${install("image")}
<p>Data lives under <code>~/.local/share/mcp-servers/image/</code>: a register of the last 500
operations, not your images, which stay where you put them.</p>

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
${install("bank-statement")}
<p>See the <a href="/setup">setup pages</a> for the exact config file and key per client.</p>

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
${install("quotes")}
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
${install("barcode")}
<p>See the <a href="/setup">setup pages</a> for the exact config path and key per client.</p>

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
${install("zip")}
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
${install(["invoice", "deposits"])}
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
${install("asset-register")}
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
${install("per-diem")}
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

  "one-ledger-from-every-server": {
    title: "One double-entry ledger out of every server you already run",
    description: "Derive a real set of books from the invoices, credit notes, deposits, expenses, bank import and asset register you already keep, and prove the trial balance comes to zero to the minor unit. Why the bank statement is evidence rather than a source of postings, and why posting it as well double-counts 99.6 percent of your cash while the trial balance still balances perfectly.",
    html: `<h1>One double-entry ledger out of every server you already run</h1>
<p>By the time you have raised invoices, given a credit note, taken a deposit, logged expenses, imported a
bank statement and put a laptop on a depreciation schedule, you have six books. What you do not have is a set
of books. The <a href="/s/cash-book">MCP Cash Book</a> server derives one: a double-entry ledger over a period
in one currency, built on the call from those six stores, with a debit and a credit for every movement and a
trial balance proved to zero to the minor unit. It writes into none of them, and there is no tool for typing
an entry into it.</p>

<h2>Install it</h2>
${install("cash-book")}
<p>It reads <a href="/s/invoice">mcp-invoice</a>, <a href="/s/billing-docs">mcp-billing-docs</a>,
<a href="/s/deposits">mcp-deposits</a>, <a href="/s/expense-tracker">mcp-expense-tracker</a>,
<a href="/s/bank-statement">mcp-bank-statement</a> and <a href="/s/asset-register">mcp-asset-register</a>.
Every one of them is optional. A store you never installed is simply absent from the ledger and reported as
<code>rows: 0</code>; a store that is on disk and did not parse is a different thing, reported as
<code>read: false</code> with the error and a sentence naming what is missing because of it.</p>

<h2>The bank statement is evidence, not a source of postings</h2>
<p>This is the decision the whole ledger rests on, and it is counter-intuitive, because the account is called
cash and the bank statement is the record of cash. Import it and post it and you have built the obvious thing.
It is also wrong.</p>
<p>A bank line and a payment record are not two transactions. They are one transaction seen twice. When you
marked an invoice paid, that receipt was recorded. When the statement is imported, the same receipt arrives
again. So cash is posted from the <em>documents</em>, which are the only rows that carry a second leg (a
receipt against receivables, a payment against an expense and its VAT), and each bank row is then matched to a
posted cash movement of the same amount, the same direction and a date within three days. The match is written
onto the ledger line as <code>bank_ref</code>: evidence that the movement cleared, attached to a posting that
was derived from something else.</p>
<p>Here is what that is worth, measured on one worked month of ten documents and five bank rows:</p>
<pre><code>posted cash movement        1,380,300 minor units
matched to a bank row       1,375,300   (99.6 percent)
new information             7,500       (0.4 percent)

cash balance, matched       -10,543.00 EUR
cash balance, both posted   -21,111.00 EUR</code></pre>
<p>Four of the five bank rows are money that a document already posted. Post the import as well and the cash
balance moves by nearly a factor of two.</p>

<h2>The part that makes it dangerous</h2>
<p>The check does not catch it. Every duplicated receipt arrives with its own contra, so the trial balance
still comes to zero. Debits equal credits, every individual line is plausible and names a real bank row, the
document reconciles, and the only symptom is one account off by 10,568.00 in a direction nobody audits. A
control that passes on a broken ledger is worse than no control, because it has been consulted.</p>
<p>What is left after matching is the 0.4 percent: one withdrawal of 75.00 that no expense, refund or asset
purchase explains. That leftover is the entire reason to import a statement at all. A bank debit with nothing
behind it is a payment nobody entered; a posted cash movement with no bank line behind it either has not
cleared or did not happen. A duplicate-heavy ledger buries both of them inside a number that looks fine.</p>

<h2>Nothing is ever balanced with a plug</h2>
<p>Every entry is posted exactly as its source document states it. When a document's own legs do not add up,
the entry is still posted and the difference is raised by name: <code>offenders</code> lists the entry, the
source server and the source document behind every unit of the imbalance. A trial balance can only find a
broken document if it is allowed to come out non-zero. Forcing a balancing figure would turn the one check
this server exists for into a formality that always passes, which is precisely the failure described above,
manufactured on purpose.</p>
<p>That is also why <code>trial_balance</code> and <code>ledger_lines</code> are free and unlimited on every
tier. Whether the books add up is the question the server exists to answer, and a free tier that hides the
answer is a demo. The meter is on the period instead: three distinct periods a calendar month, keyed by from,
to and currency, so rebuilding one already in the register is free forever.</p>

<h2>Four more rules that change the numbers</h2>
<p><strong>VAT comes out of the gross, never on top of it.</strong> The expense tracker stores an amount
VAT-inclusive, so 123.00 at 23 percent is 100.00 of expense and 23.00 of input VAT, not 123.00 and 28.29.
Adding it on top overstates the expense and the reclaim together, and both figures look ordinary.</p>
<p><strong>A deposit applied to an invoice never touches cash.</strong> The cash arrived earlier, when the
deposit was received. Applying it debits deposits held and credits receivables. Posting it to cash receives
the same money twice.</p>
<p><strong>A purchase order is a memo and is never posted.</strong> An order is a commitment: nothing has been
delivered and nothing is owed. It is carried as <code>purchase_commitments</code>, outside the trial balance.
A ledger that posts an open order reports a liability the business does not have, and it is the kind of
liability that gets believed because it came out of a computer.</p>
<p><strong>Currencies are never added together.</strong> A period holding two is refused by name until you
choose one, and the documents in the other are counted as excluded rather than quietly dropped. There is no
exchange rate in this server, so a single trial balance over a EUR book and a USD one would be an invented
number that balances.</p>

<h2>What a month close actually tells you</h2>
<p><code>month_close</code> is not a freeze. This server does not own the six stores and cannot lock them.
What it does is record what the trial balance said at the moment of closing, alongside the list of what the
month leaves unposted or inconsistent: an invoice with no VAT rate, a bank debit with no expense behind it, a
deposit applied to an invoice that does not exist. Close the same month again after one of those stores has
moved and the drift is reported by name rather than quietly adopted. The snapshot is the only place that
change is visible.</p>
<p>And a bank row that could match two postings is matched to neither, with both candidates named. Picking the
first would be a coin toss written into a ledger, and two candidates for one bank line is exactly the case a
human has to look at.</p>

<p><code>ledger_lines</code> already returns every field <code>ledger_export_csv</code> does, <code>bank_ref</code>
included, free and unlimited: the export just lays the same fields out as RFC 4180 columns in a file. A round
of measured use (prompt 6 of <code>data/user_value_r29.json</code>) found a model take the Pro refusal on
<code>ledger_export_csv</code> correctly, then hand-build a substitute CSV out of <code>ledger_lines</code> and
drop <code>bank_ref</code> along the way, the one column this server exists to produce. The refusal text now
says outright that <code>ledger_lines</code> already carries it, so the answer is to relay that tool's own
output rather than reassemble one by hand.</p>

<h2>Ask it</h2>
<pre class="prompt"><code>Build the double-entry ledger for June and tell me whether the trial balance comes to zero.</code></pre>
<pre class="prompt"><code>Show me every ledger line that hits receivables, with the invoice each one came from.</code></pre>
<pre class="prompt"><code>Close June. What does the month leave unposted or inconsistent?</code></pre>
<p><code>ledger_build</code>, <code>trial_balance</code> and <code>ledger_lines</code> are free;
<code>month_close</code>, <code>ledger_export_csv</code> and <code>ledger_report</code> are Pro
(<a href="/buy/cash-book?src=store.guide.one-ledger-from-every-server">$19 one-time</a>, lifetime, verified
offline, or <a href="/bundle?src=store.guide.one-ledger-from-every-server">every server in the bundle</a>).</p>`,
    faq: [
      { q: "Does it change my invoices, expenses or bank imports?", a: "No. It reads all six stores and writes into none of them. The only file it owns is a register of the periods it built, and no balance is ever read back out of that register: every line is derived from the source documents at the moment you ask. The contract suite asserts the bytes and the mtimes of nine sibling files are unchanged across all six tools." },
      { q: "Why is the bank statement not posted?", a: "Because it is the same money as the documents. A bank line and a payment record are one transaction seen twice. On the worked month, four of five bank rows duplicate a posted movement: 1,375,300 of 1,380,300 minor units of cash, 99.6 percent. Posting both takes the cash balance from -10,543.00 to -21,111.00 EUR. The bank rows are matched to postings as evidence instead, and what fails to match is the output that matters." },
      { q: "If the ledger were double-counting cash, would the trial balance catch it?", a: "No, and that is the point. Every duplicated receipt arrives with its own contra, so debits still equal credits and the trial balance still comes to zero. Every line is individually plausible. The only symptom is one account off by nearly a factor of two. A control that passes on a broken ledger is worse than no control." },
      { q: "What happens when a document's own figures do not add up?", a: "The entry is posted exactly as the document states it and the imbalance is reported by name. offenders lists the entry, the source server and the source document behind every unit of the difference. Nothing is ever plugged to make the trial balance come to zero, because a trial balance that always passes cannot find a broken document." },
      { q: "Is there an opening balance?", a: "No. This ledger opens at nothing and derives only what the period itself contains, so an account figure here is the period's movement. No opening balance is carried in from a book this server does not keep. An opening figure nobody can walk back to a document is the first invented number in a set of books." },
      { q: "What if I only have some of the six servers installed?", a: "It still works. A store you never installed is absent and reported as read: true, rows: 0, which is a figure that is genuinely zero. A store that is on disk and did not parse is reported as read: false with the error and a sentence naming what is missing, which is a figure that could not be computed. The distinction matters because a ledger short one whole store still balances perfectly: both legs of every missing entry are missing." },
      { q: "Can I mix currencies in one period?", a: "No. A period holding two currencies is refused by name until you choose one, and the documents in the other are counted as excluded rather than dropped. There is no exchange rate in this server, so a single trial balance across two currencies would be an invented number that happens to balance." },
      { q: "What does the free tier actually give me?", a: "trial_balance and ledger_lines unlimited on every tier, plus three distinct periods a calendar month through ledger_build. Periods are keyed by from, to and currency, so rebuilding one you already built is free forever. Pro adds unlimited periods, month_close, ledger_export_csv and ledger_report." },
      { q: "Where is the data kept?", a: "The period register is plain JSON under ~/.local/share/mcp-servers/cash-book/, or $XDG_DATA_HOME if you set it. The invoices, credit notes, purchase orders, deposits, expenses, bank imports and assets stay in their own servers' directories and are only read. There is no network call anywhere in this server, no account and no API key, and license keys are verified offline." },
    ],
  },

  "loan-and-lease-schedules-from-chat": {
    title: "Loan and lease schedules from chat, closing exactly on zero",
    description: "Turn the terms of a credit agreement into the level payment, the effective annual rate and a period-by-period schedule in integer minor units, then cost settling early net of the penalty and book each payment correctly. Why rounding the level payment once is a term change rather than a rounding detail, and why a schedule that fills out the declared term can charge negative interest on a debt that is already gone.",
    html: `<h1>Loan and lease schedules from chat, closing exactly on zero</h1>
<p>A credit agreement is four or five numbers and a date. What it costs you is a table nobody hands you: the
level payment, how much of each payment is interest, what is left outstanding on any given day, and what
settling early would actually save once the penalty is taken off. The <a href="/s/amortization">MCP
Amortization</a> server derives that table from the terms, in integer minor units, with every closing balance
reaching the balloon, or zero, exactly. It stores no schedule and it posts nothing anywhere.</p>

<h2>Install it</h2>
${install("amortization")}
<p>It reads no other server's store and writes into none. Its own register is two files: the agreements and an
id counter.</p>

<h2>Rounding the payment once is a term change</h2>
<p>This is the finding worth the whole page, and it is not a rounding detail. Take 1,000,000 minor units at
250 basis points over 360 annual periods. The level payment comes out to a fraction and rounds, once, to
25,292. That rounding is worth a fraction of a minor unit a period, and it repeats. <strong>The balance clears
at period 356: four periods before the term the agreement declares.</strong> The final payment is 4,165.</p>
<p>The reason this matters is what the alternative looks like. A schedule that keeps subtracting in order to
fill out the declared term does not crash and does not warn. It reports four more rows, each with a full
payment of 25,292 against a balance that has gone negative, each charging <em>negative interest</em>, and the
totals still reconcile against themselves. The chain arithmetic is self-consistent the whole way down. The
only thing wrong with it is that the borrower does not owe the last four rows. This server stops the schedule
where the debt stops and says so, and a 720-schedule sweep across six rates, five terms, two methods, three
balloon sizes and four payment frequencies is the standing alarm on it: every one closes exactly on its
balloon and no interest charge is ever negative.</p>

<h2>The residual goes in the split, never in the payment</h2>
<p>Rounding each period's interest to the minor unit leaves the closing balance a few units from zero after a
chain of subtractions, and there are exactly two places to put that difference: the final payment, or the
final period's interest-and-principal split. The payment is what the borrower is contractually due to pay.
The split is not. So the final period's principal is exactly what is left to repay and its interest is the
rest of the same level payment.</p>
<p>On the reference loan, 1,000,000 minor units at a nominal 12 percent compounded monthly over 12 monthly
payments, that puts the final interest at 882 rather than the 880 an unrounded balance carries, the total
interest at 66,188, and the closing balance at exactly zero, with all twelve payments at 88,849. Putting the
2 unit difference into the payment instead would produce a final payment of 88,847, which is an amount that
appears on no agreement anyone signed.</p>

<h2>Compounding and payment frequency are two different clocks</h2>
<p>The rate for one payment period is the equivalent rate taken through the compounding clock, not the nominal
rate divided by the number of payments. Take EUR 10,000 at a nominal 12 percent compounded MONTHLY, repaid in
four quarterly instalments. The quarterly rate is 3.0301 percent, not 3.0000. Three basis points. It sets the
payment at EUR 2,692.21 instead of EUR 2,690.27 and the total interest at EUR 768.84 instead of EUR 761.08:
<strong>EUR 7.76 more, 1.0 percent of the entire interest bill, on a one-year loan of ten thousand</strong>,
in the lender's favour, and invisible in the quote. Every answer prints the periodic rate it used to six
decimal places for that reason.</p>
<p>The same arithmetic is why the effective annual rate is reported beside the nominal one on every loan. A
nominal 12 percent compounded monthly is an effective 12.68 percent, and that 0.68 of a percent is the part
of the price the headline rate does not carry.</p>

<h2>Only the interest is an expense</h2>
<p><code>loan_journal</code> hands back the double entry for a period or a month: debit interest expense,
debit loan liability, credit cash, in the <a href="/s/cash-book">cash book</a>'s own account ids, character
for character, so nothing has to be re-mapped later. Beside it sits an
<a href="/s/expense-tracker">expense_add</a>-ready payload carrying the INTEREST alone. On the reference
loan's first payment that is 100.00, not 888.49.</p>
<p>Booking the whole payment as an expense overstates the cost of the business by the principal, every period,
and it still reconciles perfectly against the bank statement, which is precisely why the error survives a bank
reconciliation and shows up a year later in the accounts. The payload names the principal as excluded so the
hand-off cannot make that mistake silently.</p>

<h2>Settling early can cost money, and it says so</h2>
<p><code>loan_repay_early</code> costs a settlement or an overpayment at any period: the outstanding balance,
the penalty if the agreement carries one, the recalculated remaining schedule and the interest saved, stated
gross AND net. On the reference loan at period 6 the outstanding is 514,920, interest already paid is 48,014,
the saving is 18,174 gross and 13,174 net of a 5,000 penalty. At period 11 the same 5,000 penalty is set
against a saving of 882, and the verdict says the settlement COSTS rather than reporting a smaller saving.
Nothing is written: the stored agreement keeps its terms, because an agreement is amended by whoever signs
it.</p>

<h2>Ask it</h2>
<pre class="prompt"><code>Record the van finance: 1,000,000 minor units, nominal 12 percent compounded monthly, twelve monthly payments, drawn 2026-01-15.</code></pre>
<pre class="prompt"><code>Show me the schedule, and the effective annual rate beside the nominal one.</code></pre>
<pre class="prompt"><code>What would settling at period 6 cost me after the penalty?</code></pre>
<p><code>loan_create</code>, <code>loan_schedule</code> and <code>loan_list</code> are free;
<code>loan_repay_early</code>, <code>loan_journal</code> and <code>loans_report</code> are Pro
(<a href="/buy/amortization?src=store.guide.loan-and-lease-schedules-from-chat">$19 one-time</a>, lifetime,
verified offline, or <a href="/bundle?src=store.guide.loan-and-lease-schedules-from-chat">every server in the
bundle</a>).</p>`,
    faq: [
      { q: "Does the schedule always close on exactly zero?", a: "Yes, or exactly on the balloon. Every figure is an integer minor unit and the final period's principal is exactly what is left to repay, so the closing balance is zero to the unit rather than nearly zero. A 720-schedule sweep across six rates, five terms, two methods, three balloon sizes and four payment frequencies asserts it, and asserts no interest charge is ever negative." },
      { q: "Why does my last payment show a different interest split than a bank quote?", a: "Because the residual left by rounding each period's interest goes into the final period's interest-and-principal split rather than into the payment. The payment is contractual and does not move. On the reference loan that is a final interest of 882 rather than 880. The alternative, adjusting the last payment to 88,847, produces an amount that is on no agreement." },
      { q: "What happens if the debt clears before the term ends?", a: "The schedule stops there and says so. At 250 basis points over 360 annual periods the balance clears at period 356 with a final payment of 4,165. Filling out the declared term would report four more rows charging negative interest on a negative balance, and the totals would still reconcile, which is why this case is swept rather than trusted." },
      { q: "How is the periodic rate worked out?", a: "As the equivalent rate through the compounding clock, (1 + r/m)^(m/p) - 1, never the nominal rate divided by the number of payments. On a quarterly-paid, monthly-compounded loan that is worth about 1.0 percent of the whole interest bill in the lender's favour. The rate actually used is printed to six decimal places on every answer." },
      { q: "Can I post the journal straight into my books?", a: "The journal is a payload, not a posting. It debits interest expense and loan liability and credits cash in the cash book's own account ids, and the expense payload carries the interest alone, 100.00 rather than 888.49 on the reference loan's first payment. The servers that own the ledger and the expense book do the writing, because id allocation, category rules and the VAT split live inside their handlers." },
      { q: "Is a balloon inside the last payment?", a: "No. The closing balance of the final period IS the balloon, and the answer says in words that the borrower owes it on top of the payment shown. Folding it in would make one row the size of a house deposit and would still total correctly, which is the dangerous part." },
      { q: "Are arrangement fees treated as interest?", a: "No. A fee is paid at drawdown, sits outside every payment row and outside the total interest, and the cost of credit is reported as the two added together. Rolling the fee into the interest would make the schedule disagree with the agreement it came from." },
      { q: "What does the free tier actually give me?", a: "loan_schedule and loan_list unlimited on every tier, over three agreements held in the register. The payment and the interest are the question this server exists to answer, so they are never metered; the meter is on holding an agreement, which is the unit of work. Re-deriving the schedule of a loan already recorded is free forever." },
      { q: "Where is the data kept?", a: "Two plain JSON files under ~/.local/share/mcp-servers/amortization/, or $XDG_DATA_HOME if you set it: loans.json and counter.json. No schedule is stored, because a stored schedule is a second copy of what the rate and the term already decide and the copy is the one that gets believed after somebody edits the rate. There is no network call anywhere in this server, no account and no API key, and license keys are verified offline." },
    ],
  },

  "work-orders-and-job-cards-from-chat": {
    title: "Work orders and job cards from chat, and why the markup goes on the unit cost",
    description: "Run a one-van trade's job board from a conversation: a work order against the client your invoices already know, parts and labour logged as they happen, a status that moves one dated step at a time, a completion report with a sign-off block, and an invoice payload that needs no retyping. Why a markup belongs on the unit cost and never on the line total, and what the one minor unit of difference does to an invoice.",
    html: `<h1>Work orders and job cards from chat, and why the markup goes on the unit cost</h1>
<p>A job card is the smallest document in a trade and the one that decides what the invoice says. Somebody
calls, a van goes out, hours and parts get written on a docket, and a week later that docket has to become an
invoice without anything being retyped or remembered. The <a href="/s/work-order">MCP Work Order</a> server
keeps that job card: a work order against a client your invoices already know, lines logged as the job goes,
a status that moves one dated step at a time, a completion report with a sign-off block, and an
<code>invoice_create</code>-ready payload at the end. It stores no total and posts nothing anywhere.</p>

<h2>Install it</h2>
${install("work-order")}
<p>It writes only its own directory. It reads two files it does not own, both read-only and both
best-effort: the shared business profile, for the currency, the VAT rate and the business name on the
completion report, and the invoice server's client records, so a job carries the same customer the invoice
will be raised against rather than a second spelling of the name.</p>

<h2>The markup goes on the unit cost, never on the line total</h2>
<p>This is the finding worth the whole page, and it is worth exactly one minor unit at a time. Seven
thermostats cost you 1,299 each and you add 15 percent. There are two ways to do that and they are both
defensible arithmetic:</p>
<pre><code>on the unit    roundHalfUp(1299 * 1.15) = 1494 a unit,  x 7 = 10,458
on the line    7 x 1299 = 9,093,  roundHalfUp(9093 * 1.15) = 10,457</code></pre>
<p>One minor unit apart, and every internal check passes either way: both reconcile against their own
workings, both look right on a completion report, and neither throws. The difference only appears when the
job becomes an invoice. The <a href="/s/invoice">invoice server</a> rounds a unit price into minor units
FIRST and computes the line from that stored value, so a line it can reproduce is a quantity times a rounded
unit and nothing else. Price the job on the line total and the invoice quietly reprices it back to the unit,
and the completion report the customer signed no longer adds up to the invoice they are sent.</p>
<p>So a parts line's <code>unit_price</code> in the payload is the marked-up unit in major units, and nothing
else. The two obvious alternatives both break the same identity: the bare cost with an invoice-level discount
rounds per line against a different base, and the line total posted as a quantity of one loses the quantity
the customer is being charged for. The unit suite asserts the gap between the two bases is exactly 1, so a
change of basis fails the build rather than silently re-pricing every job on the board.</p>

<h2>The worked job</h2>
<pre><code>Client Harbour Cafe (from the invoice client records), site 12 Quay Street
Requested 2026-03-02, priority high, EUR, VAT 23% from the shared profile

labour  3.5 h   x 8500                     =  29,750
labour  1.25 h  x 8500                     =  10,625
parts   7       x 1299 + 15%  (unit 1494)  =  10,458
parts   2       x 4500 +  0%               =   9,000
                                              ------
hours                                          4.75
labour                                        40,375
materials                                     19,458   (cost 18,093, markup earned 1,365)
net                                           59,833
VAT 23%                                       13,762
gross                                         73,595</code></pre>
<p>Every figure there is asserted in the server's own unit suite, and the last three are asserted a second
time by taking the payload as returned and re-running the invoice server's <code>computeTotals</code> over
<code>invoice_create.arguments.items</code> from the test process. That second assertion is not checking the
arithmetic, which has only one implementation. It is checking that the payload's ITEMS carry what the work
order thought they carried, which is the failure that survives every internal check.</p>

<h2>The status moves one step at a time</h2>
<p>draft, scheduled, in_progress, done, invoiced. A skipped step is refused, naming the step that IS next.
That looks pedantic until you notice that every step carries its own date: a job that went from scheduled
straight to invoiced was never marked done, so no completion report was ever produced and nothing in the
record says the day the work actually finished. Backwards is refused too, because a job that has to go back
out is a new work order and the history of the first one has to stay true. A change dated before the
requested date, or before the step already recorded, is refused for the same reason: the history has to read
as a timeline.</p>

<h2>Nothing is stored twice</h2>
<p>An order record holds its client, its lines and its status history. The value, the hours, the materials
and the VAT are derived on every call. A stored total is a second copy of what the lines already decide, and
the copy is the one that gets believed after somebody edits a line. The contract suite greps the raw store
file for nine derived key names and asserts the record holds the facts only.</p>
<p>Hours are counted on the LINE date rather than the order date, which matters at every month end: a
February call worked in March logged its hours in March. Counting by order date moves a whole visit into the
month the phone rang.</p>

<h2>The free tier counts OPEN jobs</h2>
<p>Five open work orders, which is a one-van trade, and 200 lines on each of them on every tier. The cap
counts jobs that are open, draft, scheduled or in progress, rather than jobs ever raised, so finishing a job
frees its slot and the free tier does not fill up with history. <code>work_order_delete</code> on a draft
with no lines is free on every tier as well, because a way back that only a Pro key can reach is not a way
back. A byte-identical work order is refused BEFORE the cap is consulted, so a double-typed job names the id
already stored rather than being met with an upgrade prompt, and it burns neither a slot nor a WO number.</p>
<p>Pro is $19 once, lifetime: unlimited open work orders, the A4 completion report PDF with the sign-off
block, the invoice payload, and the board report. All servers together are
<a href="/buy/bundle?src=store.guide.work-orders-and-job-cards-from-chat">$39</a>.</p>
`,
    faq: [
      { q: "Why does the markup go on the unit cost rather than on the line total?", a: "Because the invoice server rounds a unit price into minor units first and computes the line from that stored value, so the marked-up unit is the only basis an invoice can reproduce. Seven parts at 1,299 with 15 percent is 1,494 a unit and 10,458 on the line; marking up the line total instead is 10,457. Both are defensible arithmetic and only one of them is what the customer is billed. The unit suite asserts the gap is exactly 1, so a change of basis fails the build rather than quietly re-pricing every job on the board." },
      { q: "Does this server create the invoice?", a: "No. work_order_invoice_payload returns the invoice_create arguments and says so: posted false, marked_invoiced false. You run invoice_create in the invoice server and then set the status here to invoiced. The split is deliberate, because a tool that did both would bill a customer as a side effect of asking what the job was worth. An order already marked invoiced refuses a second payload by name and refuses further lines, so neither route bills anyone twice through this server." },
      { q: "Where do the totals in the payload come from?", a: "From the invoice server's own computeTotals, run over the very items the payload is handing you. There is no second implementation to agree or disagree with. The test then re-runs that same function over the returned payload from its own process and asserts net 59,833, VAT 13,762 and total 73,595, with rounding drift of zero." },
      { q: "Why can I not skip a status step?", a: "Because every step carries its own date. A job that went from scheduled straight to invoiced was never marked done, so no completion report was produced and nothing in the record says the day the work finished. A skipped step is refused naming the step that IS next. Backwards is refused too: a job that has to go back out is a new work order, and the history of the first one has to stay true." },
      { q: "What counts against the five free work orders?", a: "Open ones only: draft, scheduled and in progress. Finishing a job frees its slot, so the free tier does not fill up with history. work_order_delete on a draft with no lines is free on every tier, because a way back that only a Pro key can reach is not a way back, and a byte-identical duplicate is refused before the cap is consulted so it costs neither a slot nor a WO number." },
      { q: "Why is my labour rate refused?", a: "Because it has to be typed. The shared business profile carries a default currency, a default tax rate and payment terms, and nothing else survives the profile reader, so there is no default hourly rate for this server to fall back on today. The lookup is implemented and will start working the day that field exists. Until then rate_minor is refused by name, and the refusal says which field would have filled it. A rate this server invented would be printed on a completion report the customer signs and on an invoice nobody typed it into." },
      { q: "Why is an unknown client name refused?", a: "A bare name that matches no invoice client record is a misspelling far more often than a new customer, and an invoice raised from that job would carry a BILL TO block with nothing in it. Either run client_add in the invoice server first, or pass client_address here, in which case the job records the client inline and notes that the invoice server has no record of it." },
      { q: "Which month do the hours land in?", a: "The month of the LINE date, not the order date. A February call worked in March logs its hours in March. Counting by order date would move a whole visit into the month the phone rang, and the board report's hours-this-month figure would be wrong for every job that ran over a month end." },
      { q: "Does it need the network or an account?", a: "No. There is no network call anywhere in this server except the checkout host named in the licensing copy, and the contract suite asserts that. There is no account and no API key, and license keys are verified offline." },
    ],
  },

  "price-lists-and-rate-cards-from-chat": {
    title: "Price lists and rate cards from chat, and the 100x scale gap between the invoice and the quote",
    description: "Keep one price list and one labour rate card where your invoices and your quotes can both read them: a price with the day it comes into force, the price on any date worked out on the call, and a list of what a customer had handed back already priced in both sibling argument shapes. Why the same unit price is exactly 100x apart in an invoice and in a quote, and what happens when the wrong one is pasted.",
    html: `<h1>Price lists and rate cards from chat, and the 100x scale gap between the invoice and the quote</h1>
<p>Most small businesses keep their prices in a spreadsheet and retype them into every quote and every
invoice. That is not a filing problem, it is a correctness problem: the moment a price goes up, the
spreadsheet is right and every document already sent is unexplainable, and the person retyping is the only
thing standing between a customer and a figure nobody can account for. The
<a href="/s/catalogue">MCP Catalogue</a> server keeps that price list where the
<a href="/s/invoice">invoice</a> and <a href="/s/quotes">quote</a> servers can both read it: a code, a name,
a unit, an optional VAT rate, and prices with the day each one comes into force. It creates no invoice and no
quote, stores no current price, and invents nothing.</p>

<h2>Install it</h2>
${install("catalogue")}
<p>Put it at the same scope as <code>mcp-invoice</code> and <code>mcp-quotes</code>: the whole point is
that all three read one price list.</p>

<h2>The measured thing: the same price is 100x apart in the two payloads</h2>
<p>This is the decision the whole server rests on, and it is not a style preference. The invoice server's
item carries <code>unit_price</code> in MAJOR units, documented in its own schema as "Price per unit in major
units, e.g. 90 for 90 EUR". The quote server's item carries <code>unit_price_minor</code> in MINOR units,
documented as "9000 = 90.00 EUR, 90 = JPY 90. Never a decimal". Both fields are plain numbers. Both are
called the unit price in ordinary speech. And neither tool can tell that the number it was handed was scaled
for the other one: <code>45000</code> passed as <code>unit_price</code> is a perfectly valid invoice line for
EUR 45,000.00, and it reconciles against itself all the way down to the total.</p>
<p>Measured on the worked resolution: the correct payload nets 261,363 minor units. The quote payload's field
fed into the invoice engine nets 26,136,300, which the unit suite asserts is exactly 100x. In a 3-decimal
currency such as KWD the gap is 1000x. There is no arithmetic error anywhere in that: it is two correct
engines handed one number that meant something different in each.</p>
<p>So the store holds MINOR units, which is the only lossless form, and <code>lines_resolve</code> builds
BOTH payloads itself in one call, with the scale printed against each. A catalogue that returned "the price"
and let the caller pick the field would be wrong half the time, and wrong by two orders of magnitude when it
was. Take the payload named for the tool you are about to call, and change no number in it.</p>

<h2>The second measured thing: a price is a history, not a number</h2>
<p>A SKU holds its price ROWS, each one a currency, a tier, a valid-from date and an amount. The price on a
date is the latest valid-from at or before that date, worked out on the call. Put WEB-AUDIT at 39,000 from
2025-01-01, 45,000 from 2026-01-01 and 49,500 from 2026-07-01, and ask what it was on 2026-03-15: the answer
is 45,000, and <code>sku_get</code> names the row it picked, says how many rows it considered, and names the
later row already booked. Raising a price in July does not rewrite what June was quoted at, because there is
no current price stored anywhere to rewrite.</p>
<p>A date before every row has no price, and that is a refusal naming the earliest row and the day it starts.
Filling it with the earliest row is the tempting default and it reprices history: a job done in December 2024
would be billed at the January 2025 price and would reconcile perfectly against a price list that did not
exist yet.</p>

<h2>A worked resolution</h2>
<pre><code>EUR, priced as of 2026-03-15, VAT 23% from the shared profile

WEB-AUDIT          3 x 45000   135,000   (the 2026-01-01 row, not 39000 and not 49500)
HOST-MO           12 x  3999    47,988
senior developer 7.5 h x 8500    63,750
junior developer 3.25 h x 4500   14,625
                                -------
net                             261,363
VAT 23% per line 31050 + 11037 + 14663 + 3364 = 60,114
gross                           321,477
rounding_drift_minor                  0</code></pre>
<p>The test then hands <code>lines_resolve</code>'s OWN <code>invoice_create.arguments.items</code> back to
the invoice server's <code>computeTotals</code> in its own process and gets the same four line grosses and
the same three totals. What that catches is not an arithmetic slip. It is a payload whose ITEMS do not carry
what the catalogue thought they carried, which is the failure that survives every internal check.</p>

<h2>Nothing is invented</h2>
<p>No fallback, no profile default rate, no nearest match. An unknown code is refused by name. A code with no
price in the currency and tier you asked for is refused by name. A line in a second currency is refused,
because one resolution carries one currency and the alternative is a conversion nobody asked for. The
invented number would be printed on a document a customer pays from, and it would look exactly like a real
one.</p>
<p>One row per currency, tier and valid-from date. Setting that key again REPLACES the row, and the response
says what it was and what it became, because two rows on one key make "the price that day" a coin toss
decided by array order. A call that would change nothing at all is refused by name instead, so
<code>updated</code> is not rewritten and no repricing is reported that did not happen.</p>

<h2>Free and Pro</h2>
<p>Free is 25 SKUs, the one <code>standard</code> price tier, unlimited rate cards, and every text answer
including <code>lines_resolve</code> and <code>price_list_text</code>. A price list nobody can read is not a
price list, and withholding <code>lines_resolve</code> would withhold the one thing the sibling servers came
here for. <code>sku_delete</code> is free on every tier, because a way back that only a Pro key can reach is
not a way back. A byte-identical duplicate is refused BEFORE the free cap is consulted, so a product filed
twice names the code already stored rather than being met with an upgrade prompt.</p>
<p>Pro is $19 once, lifetime: an unlimited catalogue, price tiers beyond <code>standard</code> so trade and
wholesale are a second column rather than a second catalogue, the A4 price list PDF, and the catalogue
report. All servers together are
<a href="/buy/bundle?src=store.guide.price-lists-and-rate-cards-from-chat">$39</a>.</p>
`,
    faq: [
      { q: "Why does lines_resolve return two payloads instead of one price?", a: "Because the two servers it feeds take the same price in different scales, and the gap is exactly 100x. invoice_create's item carries unit_price in MAJOR units, 90 for 90 EUR. quote_create's item carries unit_price_minor in MINOR units, 9000 for 90.00 EUR. Both are plain numbers and neither tool can tell it was handed the other one's scale: 45000 as unit_price is a valid invoice line for EUR 45,000.00 that reconciles against itself. Measured on the worked resolution, the correct payload nets 261,363 minor and the quote field fed to the invoice engine nets 26,136,300, asserted as exactly 100x, and 1000x in a 3-decimal currency such as KWD. Returning one price and letting the caller choose the field would be wrong half the time." },
      { q: "What price does it use for a date?", a: "The latest valid_from at or before that date, for that currency and that tier, worked out on the call. sku_get names the row it picked, how many rows it considered and any later row already booked, so a question about a figure on an old invoice lands on one line of one file rather than on an argument. No current price is stored anywhere, because a stored current price is a second copy of what the rows already decide, and the copy is the one still being quoted a month after the rise." },
      { q: "What happens for a date before every price row?", a: "It is refused, and the refusal names the earliest row and the day it starts. Falling back to the earliest row reprices history: a job done in December 2024 would be billed at the January 2025 price and would reconcile perfectly against a price list that did not exist yet." },
      { q: "Does this server create the invoice or the quote?", a: "No. lines_resolve returns arguments and says posted false. You run invoice_create in the invoice server, or quote_create in the quotes server. A tool that did both would bill a customer as a side effect of asking what a job comes to." },
      { q: "What happens if I set the same price row twice?", a: "The key is currency, tier and valid-from date, and setting that key again REPLACES the row. The response says what it was and what it became. Two rows on one key make the price that day a coin toss decided by array order. A call that would change nothing at all is refused by name instead, so nothing reports a repricing that did not happen." },
      { q: "What counts against the 25 free SKUs?", a: "SKUs in the catalogue. Price rows are not metered, rate cards are not metered, and every text answer is free including lines_resolve and price_list_text. sku_delete is free on every tier, and the resolution register is what makes that safe: a code that has priced a line, or that a rate card points at, is refused by name with the times it was used and the last resolution id, because a code printed on a document somebody sent is a fact about that document." },
      { q: "Can it convert currencies?", a: "No, and that is the same rule as the invented price. One resolution carries one currency, and a line in another is refused. catalogue_report counts the SKUs that carry no price in the profile's default currency, because those are the rows that stop a resolution dead, and naming them is more use than converting them at a rate nobody chose." },
      { q: "Why does the price list PDF show a total?", a: "It shows the sum of one of each, and the footer says so in words. A price list has no total of its own. The A4 renderer takes a document with totals, so rather than printing a figure that looks like a document total and means nothing, the page states in words that this is a price list at a quantity of one per line and not a quotation." },
      { q: "Does it need the network or an account?", a: "No. There is no network call anywhere in this server except the checkout host named in the licensing copy, and the contract suite asserts that. It reads exactly one file it does not own, read-only and best-effort: the shared business profile, for the default currency, the default VAT rate and the name at the top of the price list. There is no account and no API key, and license keys are verified offline." },
    ],
  },

  "change-orders-and-contract-value-from-chat": {
    title: "Change orders and the running contract value from chat, and why a changed line is two items",
    description: "Record what changed against a quote or a work order: added, removed and changed lines with a reason and a date, sent to the client and answered, and the contract value today as the original plus only what they approved. Why a changed line comes back as a reversal and a revised line rather than one net figure, and why the same delta is exactly 100x apart in the invoice payload and the quote payload.",
    html: `<h1>Change orders and the running contract value from chat, and why a changed line is two items</h1>
<p>Most quoted jobs change after the quote. A second page is asked for after the kickoff, the hosting is
dropped because the client moved in-house, the audit is widened to five sites. Those changes live in an
email thread and a spreadsheet column called extras, and three months later nobody can say what the
contract is worth or which of the extras the client actually agreed to. The
<a href="/s/change-order">MCP Change Order</a> server keeps each change as a record against the
<a href="/s/quotes">quote</a> or <a href="/s/work-order">work order</a> it changes: the lines, the reason
in the client's words, the day it was sent and the day it was answered. It stores no delta, creates no
invoice, and invents nothing.</p>

<h2>Install it</h2>
${install("change-order")}
<p>Put it at the same scope as <code>mcp-invoice</code>: the VAT rate, the currency and the name on the
document come from the shared business profile that server writes, and the payload this server builds is
that server's argument shape.</p>

<h2>The measured thing: a changed line is two items, not one</h2>
<p>A line that goes from 3 x EUR 450.00 to 5 x EUR 420.00 is worth +EUR 750.00. The tempting payload is one
item of quantity 1 at EUR 750.00. The customer cannot reproduce that figure from anything on the change
order they signed: there is no 750 on it. The payload this server emits is a reversal, -3 x 450.00, and the
revised line, 5 x 420.00. Each reproduces on a calculator from the change order, and the invoice server's own
<code>computeTotals</code> over both is the same +750.00, because its <code>roundHalfUp</code> is symmetric in
sign.</p>
<p>That symmetry is what lets a removal ride through <code>invoice_create</code> as a negative quantity at the
unit price it was booked at. It is also exactly what <code>quote_create</code> refuses, because a quote
quantity must be greater than zero, so the quote payload carries a <code>ready</code> flag and says why it is
false rather than promising a quote it cannot make. The unit suite re-runs <code>computeTotals</code> over the
payload as returned and asserts the four item values and the three totals, so the day someone simplifies the
payload to one net item, the build says so instead of the customer.</p>

<h2>The second measured thing: the same delta is 100x apart in the two payloads</h2>
<p>Once a change order is approved, <code>change_order_invoice_payload</code> builds the delta twice in one
call: <code>invoice_create</code> items with <code>unit_price</code> in MAJOR units, 450 for EUR 450.00, and
<code>quote_create</code> items with <code>unit_price_minor</code> in MINOR units, 45000 for the same price.
Both fields are plain numbers, both are called the unit price, and neither tool can tell it was handed the
other one's scale. The suite feeds the MINOR figure into the invoice engine as though it were MAJOR and asserts
the net is exactly 100x, 11,701,200 against the correct 117,012, re-derived from each payload's own items.
Take the payload named for the tool you are about to call, and change no number in it.</p>

<h2>A worked change order</h2>
<pre><code>Q-2026-0003, Harbour Cafe, EUR, original value 2,000,000 minor, VAT 23% from the shared profile

L01 added    Extra landing page          2 x 450.00                     +900.00
L02 removed  Managed hosting            12 x  39.99                     -479.88
L03 changed  Website audit    was 3 x 450.00, now 5 x 420.00            +750.00
                                                                       --------
delta net                                                              1,170.12
VAT 23% per item: 207.00 - 110.37 - 310.50 + 483.00 =                    269.13
delta gross                                                            1,439.25
rounding_drift_minor                                                          0

contract value while draft or sent:  20,000.00  (1,170.12 pending, not added in)
contract value once approved:        21,170.12</code></pre>
<p>The invoice payload for that delta carries FOUR items, 2 x 450.00, -12 x 39.99, -3 x 450.00 and
5 x 420.00, and their values are 900.00, -479.88, -1,350.00 and 2,100.00. The changed line is the last two,
and they sum to the +750.00 the change order shows.</p>

<h2>The running value counts only what the client approved</h2>
<p><code>contract_value</code> answers the question the whole thing exists for: the original, plus the deltas
the client APPROVED, equals the value today. Draft and sent change orders are shown as a pending delta beside
it and are never added in, and the value if every pending one were approved is stated as its own figure so
the two are never added by hand. Rejected and void change orders count for nothing.</p>
<p>The original value is stated ONCE per reference, on the first change order, and every later one inherits
it. A later change order that states a different figure is refused by name, because a contract with two
original values has two running values and the customer sees whichever was typed last. A reference with no
change order on file has no running value, and the server says so rather than starting from nothing but the
change order's own delta: it does not open the quotes or work-order store to find the figure.</p>

<h2>The status machine</h2>
<p><code>draft</code> to <code>sent</code>; <code>sent</code> to <code>approved</code> or
<code>rejected</code>; <code>draft</code> or <code>sent</code> to <code>void</code>. Approved, rejected and
void are final. A draft cannot be approved directly, because approval is the client's answer to something they
were sent. Lines go only on a draft: a sent change order that needs another line is voided and raised again,
so the client's approval always refers to what they were sent. Every step carries its own date, and a step
dated before the last one is refused, because a history that runs backwards cannot be read as a timeline.</p>

<h2>Free and Pro</h2>
<p>Free is five OPEN change orders, draft and sent, with 200 lines each on every tier. The cap counts the
ones the client has not answered, not the ones ever raised, so approving, rejecting or voiding one frees its
slot, and <code>change_order_delete</code> on a draft with no lines is free on every tier, because a way back
that only a Pro key can reach is not a way back. <code>contract_value</code> is free on every tier. A
byte-identical change order is refused BEFORE the cap is consulted, so a double-typed change names the id
already stored rather than being met with an upgrade prompt.</p>
<p>Pro is $19 once, lifetime: unlimited open change orders, the change order document with the approval
block for the client to sign, and the invoice payload for the approved delta in both scales. All servers
together are <a href="/buy/bundle?src=store.guide.change-orders-and-contract-value-from-chat">$39</a>.</p>
`,
    faq: [
      { q: "Why does a changed line come back as two items on the invoice payload?", a: "Because one net item shows the customer nothing they can check. 3 x 450.00 becoming 5 x 420.00 is +750.00, and an item of quantity 1 at 750.00 reproduces from nothing on the change order the client signed. A reversal of -3 x 450.00 and the revised 5 x 420.00 both reproduce on a calculator and sum to the same +750.00, because the invoice server's roundHalfUp is symmetric in sign. The unit suite re-runs computeTotals over the payload as returned and asserts all four item values, so a payload simplified to one net item fails the build." },
      { q: "What is the contract worth while a change order is sent but not yet answered?", a: "The original plus the deltas already APPROVED, and nothing else. The sent change order's delta is shown as pending beside that figure and never added in, and the value if every pending change order were approved is stated separately so nobody adds the two by hand. Rejected and void change orders count for nothing." },
      { q: "Why is original_value_minor required on the first change order and refused on a later one?", a: "The original value is stated once per reference and inherited by every later change order. This server does not open the quotes or work-order store to find it, so the first change order has to state it, and a later one that states a different figure is refused by name, because a contract with two original values has two running values and the customer sees whichever was typed last. Omit it on later change orders and the figure on file is inherited." },
      { q: "Can I add a line to a change order I have already sent?", a: "No. The client is looking at that change order, and a line added under them makes their approval an approval of something else. Void it and raise a new one with every line. Approved, rejected and void are final for the same reason: a change order the client has answered is a fact about what they answered." },
      { q: "Why can a removal be invoiced but not quoted?", a: "invoice_create accepts a negative quantity, so a removal rides through as -12 x 39.99 at the price it was booked at and the invoice engine's rounding is symmetric in sign. quote_create refuses a quantity that is not greater than zero. So the quote payload is built for its scale and carries ready false with the reason, and the job is re-quoted whole in the quotes server or the delta is invoiced." },
      { q: "Why does the payload carry the same delta twice?", a: "Because the two tools take two scales. invoice_create's unit_price is in MAJOR units, 450 for EUR 450.00; quote_create's unit_price_minor is in MINOR units, 45000 for the same price. Both are plain numbers and neither tool can tell it was handed the other one's scale. The suite feeds the minor figure into the invoice engine as though it were major and asserts the net is exactly 100x, 11,701,200 against 117,012, re-derived from each payload's own items." },
      { q: "Does this server create the invoice?", a: "No. change_order_invoice_payload returns invoice_create's arguments and says posted false. You run invoice_create in the invoice server. A tool that did both would bill a customer as a side effect of asking what a change is worth." },
      { q: "What counts against the five free change orders?", a: "Open ones, draft and sent. Approving, rejecting or voiding a change order frees its slot, and change_order_delete on a draft with no lines is free on every tier. contract_value, change_order_get and change_order_list are free and unlimited. A byte-identical change order is refused before the cap is consulted, so a double-typed change burns neither a slot nor a CO number." },
      { q: "Does it need the network or an account?", a: "No. There is no network call anywhere in this server except the checkout host named in the licensing copy, and the contract suite asserts that. It reads exactly one file it does not own, read-only and best-effort: the shared business profile, for the currency, the default VAT rate and the name on the document. There is no account and no API key, and license keys are verified offline." },
    ],
  },
  "petty-cash-float-from-chat": {
    title: "A petty cash float from chat, and why the cheque is not the sum of the vouchers",
    description: "Run a tin on the imprest system from a conversation: a voucher for every receipt, a count that reconciles to the minor unit, and the replenishment that puts the float back to its imprest. Why the cheque is imprest minus balance rather than the total of the vouchers, and why reimbursing the voucher total shrinks the float a little every cycle while every reconciliation still reports clean.",
    html: `<h1>A petty cash float from chat, and why the cheque is not the sum of the vouchers</h1>
<p>A petty cash tin is the smallest book in the business and the one most likely to be wrong. Somebody holds
some cash, receipts come back, and at the end of the month a cheque goes in to top it up. The
<a href="/s/petty-cash">MCP Petty Cash</a> server runs that tin on the imprest system: a voucher for every
receipt, a count whenever you like with the difference to the minor unit, and a replenishment worked out from
the count rather than from the paperwork. It stores no balance and posts nothing anywhere.</p>

<h2>Install it</h2>
${install("petty-cash")}
<p>It reads no other server's store and writes into none. Its own store is three files: the floats, the
vouchers and an id counter.</p>

<h2>The cheque is not the sum of the vouchers</h2>
<p>This is the finding worth the whole page. Take the worked month: a 50,000 minor unit imprest, EUR 500.00,
and five vouchers.</p>
<pre><code>Imprest                                     50,000
VOU-2026-0001  2026-03-02  postage  Stamps    1,250
VOU-2026-0002  2026-03-05  travel   Taxi      3,480
VOU-2026-0003  2026-03-11  office   Coffee      899
VOU-2026-0004  2026-03-18  office   Paper    12,500
VOU-2026-0005  2026-03-24  travel   Bus       2,065
                                            -------
vouchers                                     20,194
expected on 2026-03-31                       29,806
counted                                      29,795
difference                                      -11
replenishment (50,000 - 29,795)              20,205</code></pre>
<p>The paperwork says the tin holds 29,806 on the 31st. It holds 29,795. The count is short by exactly 11
minor units: eleven cents that no voucher explains and no receipt will ever be found for.
<strong>The replenishment is therefore 20,205, not 20,194.</strong></p>
<p>What makes this worth a test rather than a footnote is what the wrong version looks like. Reimbursing the
voucher total is not obviously wrong. It is the number the paperwork adds up to, it is the number a person
reaches for, it reconciles against the receipts one by one, and the next count comes back short by 11 again,
which reads as a fresh 11 rather than as the same one that was never put back. The unit suite runs three
cycles of exactly that: the float ends at <strong>49,967 against a 50,000 imprest</strong>, 33 minor units
light, with three clean-looking reconciliations behind it, each reporting a difference of exactly 11 and
nothing worse. Nothing ever looks broken. The tin just gets smaller.</p>
<p>So <code>replenish_request</code> computes <code>imprest - balance</code> and never
<code>sum(vouchers)</code>, and the 11 comes back as its own <code>cash_over_short</code> journal line rather
than folded into a category where it would look like postage.</p>

<h2>A count is a fact, so it moves the book balance</h2>
<p>Once a count is recorded, the balance is what was counted. The difference is carried forward as an over or
short rather than re-reported at every later count. The alternative, leaving the book at what the vouchers say
and reporting the same difference forever, makes the second count a copy of the first and hides the moment a
NEW difference appears. Count the tin twice on the same day with nothing spent in between and the second count
comes back at exactly zero, which is the point. The count history keeps every difference, so a tin that is
short by a little every month is visible as a run rather than as one number.</p>

<h2>Under the imprest system the float account does not move</h2>
<p><code>replenish_request</code> hands back the double entry in the <a href="/s/cash-book">cash book</a>'s own
account ids, character for character:</p>
<pre><code>expenses:office            13,399   debit
expenses:postage            1,250   debit
expenses:travel             5,545   debit
cash_over_short                11   debit
cash                       20,205   credit</code></pre>
<p><code>petty_cash</code> is not in that journal at all. It is debited once when the float is opened, and
again only if the imprest itself changes. That is what the imprest system means, and a journal that moves the
float account at every replenishment double-counts the tin. The per-category lines come from the cash book's
own <code>expenseAccount</code>, so a category spelled <em>Office Supplies</em>, <em>office supplies</em> and
<em>&nbsp;&nbsp;OFFICE&nbsp;&nbsp;&nbsp;SUPPLIES&nbsp;&nbsp;</em> is one account and one 300 line, not three.
Beside the journal sits an <a href="/s/expense-tracker">expense_add</a>-ready payload per category.</p>

<h2>A request is not a payment</h2>
<p><code>replenish_request</code> writes nothing. It says what the cheque should be. The cash is recorded with
<code>topup_record</code> when it is physically back in the tin, and it is that call which marks the vouchers
reimbursed. A float that counts a request as cash is short by the whole request until the cheque clears, which
is a bigger error than the one this page opened with.</p>

<h2>What the tin refuses</h2>
<p>A tin holds cash and can never hold less than nothing. A voucher larger than the balance on its own date is
refused. So is a back-dated one that would make any LATER day negative, which an at-the-date check alone does
not catch: back-dating takes the cash out earlier, so every day after it is short too. Record 30,000 on the
10th and then try to back-date 25,000 to the 2nd, and the refusal names the 10th, the day it breaks, not the
day it was typed.</p>
<p>A reconciled voucher cannot be deleted, because the cash it took out was counted on the day of the count,
and removing it would make a recorded count wrong by its own amount. Deletion is free while a voucher is still
uncounted, which is what keeps the monthly cap honest. The VOU series never reissues a number, so a gap in it
is the record that a voucher was deleted. And a byte-identical voucher, same float, date, amount, category,
description, payee and receipt reference, is refused by name, because that is one voucher entered twice far
more often than it is two identical purchases; <code>duplicate_ok</code> admits the second taxi fare of the
day deliberately.</p>

<h2>Ask it</h2>
<pre class="prompt"><code>Open a EUR 500 office float on 2026-03-01, Anna holds the tin.</code></pre>
<pre class="prompt"><code>Stamps 1,250 minor units on 2026-03-02, postage. Taxi 3,480 on the 5th, travel, receipt 4471.</code></pre>
<pre class="prompt"><code>I counted 29,795 in the tin on 2026-03-31. What does the replenishment cheque have to be?</code></pre>
<p><code>float_open</code>, <code>voucher_add</code>, <code>voucher_delete</code>,
<code>topup_record</code> and <code>reconcile</code> are free; <code>replenish_request</code> and
<code>float_report</code> are Pro
(<a href="/buy/petty-cash?src=store.guide.petty-cash-float-from-chat">$19 one-time</a>, lifetime, verified
offline, or <a href="/bundle?src=store.guide.petty-cash-float-from-chat">every server in the bundle</a>).</p>`,
    faq: [
      { q: "Why is the replenishment not the total of my vouchers?", a: "Because the two differ by exactly what the counts found over or short, and that difference is the whole reason a float shrinks. On the worked month the vouchers total 20,194 and the cheque is 20,205: the tin was counted 11 short. Reimbursing 20,194 restores the float 11 light, the same defect repeats every cycle, and every reconciliation still reports a clean 11. Three cycles of it leave a 50,000 float at 49,967." },
      { q: "What happens to the difference a count finds?", a: "It becomes a cash_over_short line in the replenishment journal, on its own, rather than being folded into an expense category. Folded in, eleven cents of unexplained shortfall would look like postage, and the account that exists to carry exactly that would stay empty forever." },
      { q: "Is reconcile metered?", a: "No, on any tier. Whether the cash in the tin matches the paperwork is the question this server exists to answer, and a free tier that withholds the answer is a demo rather than a tool. The meter is on the volume of record keeping: one float and twenty vouchers a calendar month on the free tier." },
      { q: "Why does the second count on the same day come back at zero?", a: "Because a count is treated as a fact and moves the book balance. Once you have counted, the balance IS what you counted, and the difference is carried forward rather than re-reported. Leaving the book at what the vouchers say would make the second count a copy of the first and would hide the moment a genuinely new difference appears." },
      { q: "Can I delete a voucher I typed wrongly?", a: "While it is still uncounted, yes, free on every tier, and the slot goes back. Once a reconciliation has covered it, no: the cash it took out was counted on the day of the count, so removing it would make a recorded count wrong by its own amount, and the refusal says so with the number. The VOU series never reissues a number, so the gap is the record that a voucher was deleted." },
      { q: "Does the petty_cash account move when I replenish?", a: "No. Under the imprest system it is debited once when the float is opened and again only if the imprest itself changes. A replenishment credits cash and debits the expenses per category, and the suite asserts petty_cash is absent from that journal. A journal that moves the float account every cycle double-counts the tin." },
      { q: "Can a voucher take the tin below zero?", a: "No. A voucher larger than the balance on its own date is refused, and so is a back-dated one that would make any later day negative, which the at-the-date check alone does not catch. The whole run of events is replayed in date order and the refusal names the day it breaks rather than the day it was typed." },
      { q: "Does replenish_request record the cash?", a: "No, it writes nothing at all. It says what the cheque should be. topup_record is what registers the cash when it is physically back in the tin, and that call is what marks the vouchers reimbursed. A request is not a payment, and a float that counts one as cash is short by the whole request until the cheque clears." },
      { q: "Where is the data kept?", a: "Three plain JSON files under ~/.local/share/mcp-servers/petty-cash/, or $XDG_DATA_HOME if you set it: floats.json, vouchers.json and counter.json. No balance is stored anywhere, because a stored balance is a second copy of what the vouchers already decide and the copy is the one that gets believed after somebody deletes a voucher. There is no network call anywhere in this server, no account and no API key, and license keys are verified offline." },
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
${install("statement-of-account")}
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
${install(["invoice", "billing-docs"])}
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
    description: "One stdio server proxies 31 sibling servers as 292 tools in one tools/list, measured off a built v0.20.0 bundle on 2026-09-07. What it is, how to install it, the four prefixed tool names, and when a single server is the better choice.",
    html: `<h1>One install, every server: the office-suite bundle</h1>
<p><strong>One config entry, 31 servers, 292 tools.</strong> That is what office-suite is, and both
numbers were read off a built v0.20.0 bundle on 2026-09-07 rather than off any document: one MCP
client connected over stdio, one <code>tools/list</code> returning 292 distinct names, and the
bundle's own <code>office://tools_map</code> resource naming 31 children and mapping 290 of those
tools to the child that owns them. The remaining two are the merged <code>license_status</code> and
<code>license_activate</code> pair, which is one pair for the whole bundle instead of one per child.</p>
<p>The 31 children are: time-tracker, price-tracker, spreadsheet, invoice, expense-tracker, currency,
docx, timezone, resume, recurring, clauses, pdf, calendar, kanban, image, bank-statement, quotes,
barcode, zip, billing-docs, deposits, per-diem, asset-register, statement-of-account, cash-book,
amortization, petty-cash, work-order, catalogue, change-order and delivery-schedule.</p>
<p>Adding all 31 to a client one at a time is 31 config entries and 31 absolute paths. The bundle
starts each one as its own child process over stdio, forwards every tool, resource and prompt call to
whichever child owns the name, and merges their license state. Nothing is reimplemented. Each child
keeps its own local JSON storage, exactly as it does standalone.</p>

<h2>Install it</h2>
<p>The npm packages are not published yet, so the working paths are the one-click bundle and a clone
and build. A probe of <code>registry.npmjs.org</code> on 2026-09-07 returned no versions for the
<code>@theluckystrike/mcp-*</code> packages, which matches the npm status section of the repository
README.</p>
<p><strong>One click.</strong> Download <code>office-suite.mcpb</code> from the
<a href="https://github.com/theluckystrike/mcp-servers/releases/latest">latest release</a> and
double-click it in Claude Desktop. It runs on the Node runtime Claude Desktop ships with, so nothing
about your own PATH matters.</p>
<p><strong>Clone and build.</strong> This one needs a full build rather than a per-server one,
because the bundle spawns every child:</p>
<pre><code>git clone https://github.com/theluckystrike/mcp-servers.git
cd mcp-servers
npm install
npm run build

claude mcp add --scope user office-suite -- \
  node /absolute/path/to/mcp-servers/servers/office-suite/dist/index.js</code></pre>
<p>Cursor, Claude Desktop, Windsurf and Cline take those same two strings as JSON, under
<code>mcpServers</code>:</p>
<pre><code>{
  "mcpServers": {
    "office-suite": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/office-suite/dist/index.js"]
    }
  }
}</code></pre>
<p>The <code>npx</code> line below returns a 404 today, for the reason above. It is what that config
becomes the day the publish lands, with nothing else changed:</p>
<pre><code>claude mcp add office-suite -- npx -y @theluckystrike/mcp-office-suite</code></pre>
<p>There is no account, no API key and no login step on any of these paths: every child runs locally
over stdio and writes to its own folder under
<code>~/.local/share/mcp-servers/&lt;name&gt;/</code>.</p>

<h2>292 tools in one namespace, and the four names that collided</h2>
<p>Read live off a built bundle on 2026-09-07: the 31 children's own <code>tools/list</code> calls
sum to more names than a client ever sees, because each child also registers its own
<code>license_status</code> and <code>license_activate</code> pair. The bundle merges those 31 pairs
down to one, and what is left after that merge is <strong>292 tools</strong> on the bundle's own
<code>tools/list</code>. Out of those 292 names, exactly four needed disambiguating: invoice and
docx both register a tool called <code>business_set</code>, and expense-tracker and bank-statement
both register one called <code>category_rules</code>. The bundle exposes all four, prefixed with the
server they came from: <code>invoice_business_set</code>, <code>docx_business_set</code>,
<code>expense-tracker_category_rules</code> and <code>bank-statement_category_rules</code>. It
rewrites each child's own reply so a message that said "run business_set" or "run category_rules"
says the name you can actually call. Every other tool keeps its bare name unchanged. Thirty-one
servers, and the bundle had to rename exactly two collisions, four tool names in total. The full
mapping is published as the <code>office://tools_map</code> resource, exposed name to
<code>child.tool</code>, with the renamed pairs listed separately, which is where both figures on this
page came from.</p>

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
since grown to 31 servers and 292 tools, measured 2026-09-07; that growth has not been re-measured
against this six-prompt audit.</p>
<p>Three defects came out of the same round and are already fixed in the shipped server: a URL handed
to a tool that expects a local file path used to be silently resolved against the server's own
working directory and fail with a path that never existed; <code>find_meeting_slots</code> now always
states the date range it searched and flags it by name when "this week" rolls into the following
Monday; and an empty client or entry list now says which tool creates one automatically from the
fact you already gave, instead of reading as a dead end that buys a confirmation question.</p>

<h2>When to install single servers instead</h2>
<p>The bundle is not always the right size. Windsurf's Cascade agent caps out at 100 tools across
every enabled server, so 292 tools in one entry is nearly three times the ceiling; installing only the two or three
single servers you actually use, at 9 to 16 tools each, leaves room for the rest of that budget. The
same logic applies anywhere the count matters more than the config-entry count: a project that only
ever needs the time tracker and the invoice server gets the same free tier and the same tools either
way, with fewer license checks and no dormant sibling processes started for the servers it never
calls. Ten of the nineteen children present at the time went untouched by the 2026-09-04 audit's six sentences entirely,
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
      { q: "What exactly is office-suite?", a: "One MCP server, run over stdio, that starts all 31 sibling servers as child processes and proxies their tools, resources and prompts under one connection. Each child stores its data exactly as it does standalone; the bundle adds no storage of its own." },
      { q: "How many tools does it expose?", a: "292 distinct names on one tools/list, and 31 children, both read off a built v0.20.0 bundle on 2026-09-07 by connecting an MCP client to it. The bundle's office://tools_map resource maps 290 of those to the child that owns them; the other two are the merged license_status and license_activate pair, one for the whole bundle rather than one per child. If a page or a README anywhere gives a different figure, this measurement is the one to trust, because it came from the running server." },
      { q: "Which tool names needed a prefix?", a: "Four out of 292: invoice and docx both register business_set, and expense-tracker and bank-statement both register category_rules. The bundle exposes invoice_business_set, docx_business_set, expense-tracker_category_rules and bank-statement_category_rules, and rewrites each child's own replies to match. Every other tool keeps its bare name. That list is the renamed array of office://tools_map, read on 2026-09-07." },
      { q: "Does adding more children make tool selection worse?", a: "Not as of the last measurement. A six-prompt audit needing two or more children per sentence, run on 2026-09-04 against the nineteen-server build with 186 tools, put 20 of 20 tool calls in the correct child and the correct tool, against 50 of 51 at 108 tools with five children. Every remaining defect was a tool declining to say something it already knew, not a wrong pick. The bundle has since grown to 31 servers and 292 tools, measured 2026-09-07; that growth has not been re-measured against this audit." },
      { q: "When should I install a single server instead of the whole bundle?", a: "When a client caps total tools, such as Windsurf's Cascade agent at 100, 292 tools in one entry is nearly three times the ceiling. It is also the better choice when you already know you only need two or three of the 31: same free tier, fewer license checks, no dormant sibling processes started for servers you never call." },
      { q: "How do I buy it?", a: "One bundle key, 39 dollars once, at /buy/office-suite, which routes to the same bundle checkout as /bundle. It activates Pro on every child at once instead of buying each server's own 19 dollar key, and activation is all-or-nothing with a per-child OK or FAILED table printed, so a bundle that is half Pro cannot look like a full success." },
    ],
  },
  "month-end-close-with-mcp-servers": {
    title: "Close a month in chat: invoice, credit note, retainer, bank reconciliation, statement",
    description: "One worked month run end to end through the office-suite MCP bundle on the free tier. Nine prompts, the exact figure each one produced, and the statement of account they all close into.",
    html: `<h1>Close a month in chat: invoice, credit note, retainer, bank reconciliation, statement</h1>
<p>Month end is not one job. It is an invoice, a credit note for the hour you should not have billed,
a retainer sitting on account, a bank export nobody has looked at, two receipts you forgot to log, a
laptop that has to go on the fixed asset register, a trip allowance, and at the end of it a statement
you can send the client without checking it twice. Every one of those steps lives in a different
place, and the reason month end takes a day is that the places disagree.</p>
<p>This guide is one month, closed in nine sentences, through the <a href="/guides/one-install-office-suite-bundle">office-suite
bundle</a>: one stdio server, thirty-one child servers, 292 tools on a single connection, one shared
business profile. It is not a worked example written afterwards. Every prompt below is quoted exactly
as it was typed, and every figure is the figure that run produced, read back off the stores on disk.
The full measurement is in <a href="https://github.com/theluckystrike/mcp-servers/blob/main/docs/USER_VALUE_R27.md">the round 27 audit</a>:
26 of 27, 17 tool calls, 118.6 seconds of wall clock, free tier throughout.</p>

<h2>The setup</h2>
<p>One config entry, and one shared business profile written once. The profile is what stops you
repeating yourself: the VAT rate, the payment terms, the timezone and the IBAN are stated once and
every child server reads them.</p>
<p>One click: download <code>office-suite.mcpb</code> from
<a href="${RELEASES}">the latest release</a> and open it in Claude Desktop. From a clone, build the whole
repository once (the bundle spawns every child) and add it by path:</p>
<pre><code>claude mcp add --scope user office-suite -- node /absolute/path/to/mcp-servers/servers/office-suite/dist/index.js</code></pre>
<p>The <code>npx</code> line the READMEs print is not live yet, because nothing is published to npm.
<a href="/guides/install-mcp-servers-without-npm">Installing these servers when npx does not work yet</a>
has the two paths that are.</p>
<p>The profile used for this run: Nova Studio, Europe/Warsaw, EUR, 23 percent, 14 day payment terms,
IBAN PL61109010140000071219812874. Set it once with "set my business details" and it lands in
<code>mcp-servers/profile/business.json</code>, where every server in the bundle looks for it. One
warning worth knowing if you hand write that file: the key the shared profile reads for VAT is
<code>default_tax_rate</code>. Write <code>vat_rate</code> there instead and the rate is silently
dropped, and your first invoice comes out with no VAT on it and nothing in the answer saying so.</p>

<h2>Step 1. Bill the client</h2>
<pre class="prompt">Invoice Acme for 10 hours of design work at 90 euros an hour, dated today.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>invoice</strong>, <code>invoice_from_hours</code>. Two calls: it looked up the client list,
found no Acme, and wrote the invoice anyway rather than stopping to ask. <strong>INV-2026-0001</strong>:
10 hours at EUR 90.00 is EUR 900.00 net, 23 percent VAT from the profile is EUR 207.00, total
<strong>EUR 1,107.00</strong>, issued 2026-09-05, due 2026-09-19 on the profile's 14 day terms.</p>
<p>It also said, without being asked, that it had created the client with no address and applied a VAT
rate on its own authority. Two loose ends named, neither of them a reason to withhold the write.</p>

<h2>Step 2. Credit the hour that was not billable</h2>
<pre class="prompt">One of those hours was mine, not billable. Credit Acme one hour on that invoice.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>billing-docs</strong>, <code>credit_note_create</code>. One call.
<strong>CN-2026-0001</strong> against INV-2026-0001: one hour at EUR 90.00 back, VAT unwound at the
same 23 percent the invoice charged, EUR 20.70, total <strong>EUR -110.70</strong>. The credit note
is stored against the invoice it names and no other, and it agrees with that invoice to the minor
unit because both documents run on the same money code.</p>

<h2>Step 3. Take the retainer in</h2>
<pre class="prompt">Acme just paid a 500 euro retainer, today, by bank transfer.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>deposits</strong>, <code>deposit_record</code>. One call. <strong>DEP-2026-0001</strong>,
<strong>EUR 500.00</strong> from Acme, received 2026-09-05, held. Held is the point: it is their money
on your account, not your income, until it is set against something. The server offered to apply it
and did not do so unasked.</p>

<h2>Step 4. Set it against the invoice</h2>
<pre class="prompt">Yes, apply the retainer to that invoice and tell me what is left to pay.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>deposits</strong>, <code>deposit_apply</code>. One call. The EUR 500.00 is now recorded as
a payment on INV-2026-0001, which reads partial, so <code>invoice_list</code> and
<code>overdue_report</code> stop chasing money you already have.</p>
<p>This is also the one step of the nine that lost a point, and it is worth saying why. The tool
reported a balance of EUR 607.00, which is the invoice total less the payment and takes no account of
the credit note at all. The invoice store does not know credit notes exist. The right figure is
1,107.00 less 110.70 less 500.00, which is <strong>EUR 496.30</strong>, and the model composed it by
hand from a document the tool it called cannot see. Step 9 gets it right on its own; mid-month, check
it.</p>

<h2>Step 5. Import the bank and reconcile it</h2>
<pre class="prompt">Import my Revolut export at /path/to/revolut-main.csv and reconcile it against my expense log for August 2026, so I can see which card payments have no receipt.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>bank-statement</strong>, <code>statement_import</code> then
<code>reconcile_expenses</code>. The export held 42 data rows; <strong>41</strong> transactions were
stored, because the one reverted card payment in the file is not a transaction. Of those, 36 fall in
August 2026 and <strong>33</strong> are card debits.</p>
<p>The reconciliation ran against an empty receipt log, so it returned all 33 as unreceipted,
<strong>EUR 1,283.73</strong> of card spend with nothing behind it. The answer said that plainly
rather than dressing it up as 33 separate failures, and it excluded the three credits in the file, the
EUR 4,000.00 from Acme, the EUR 500.00 from Beta Corp and the EUR 24.99 refund, as not being expenses
at all.</p>
<p>One practical note: pass a local file path. A bare <code>http://</code> URL is resolved as a
relative filesystem path, so download the export first.</p>

<h2>Step 6. Log the receipts the reconciliation found missing</h2>
<pre class="prompt">Log two expenses I paid on that card: OpenAI 72.76 euros on 27 August, software; and Adobe Creative Cloud 61.50 euros on 7 August, software. Then tell me how many August card payments still have no receipt.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>expense-tracker</strong>, <code>expense_add</code> twice, then
<code>reconcile_expenses</code> again. Both expenses landed with the profile's 23 percent VAT rate on
them without being asked for one. The re-run matched both against their bank debits and returned
<strong>31</strong> of 33 still unreceipted, <strong>EUR 1,149.47</strong>, which is 1,283.73 less
72.76 less 61.50 exactly.</p>
<p>It also warned, unprompted, that the second Adobe Creative Cloud charge of EUR 61.50 on 21 August
is a separate debit and is still unmatched. That is the one thing a person doing this by eye gets
wrong.</p>

<h2>Step 7. Put the laptop on the fixed asset register</h2>
<pre class="prompt">I bought a laptop for 6,000 zloty and put it into use on 1 September 2026. Add it to my fixed asset register and give me September's depreciation journal entry.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>asset-register</strong>, <code>asset_add</code> then <code>asset_schedule</code>.
<strong>ASSET-2026-0001</strong>, KST 487, computers and computer sets, <strong>30 percent</strong>,
useful life 3.33 years, PLN 6,000.00, in service 2026-09-01. The scheme was derived as Polish from the
zloty amount rather than from the profile's EUR.</p>
<p>The answer to the question asked is that <strong>September's charge is PLN 0.00</strong>, because
the Polish convention starts depreciation the month after an asset enters use. The first charge is
October 2026 at <strong>PLN 150.00</strong> a month, debit depreciation expense and credit accumulated
depreciation, holding at PLN 150.00 through 2029 and falling to PLN 12.50 a month in 2030. Read
directly off the schedule afterwards: 51 monthly rows summing to PLN 6,000.00 exactly.</p>
<p><code>asset_journal</code>, which formats that as a ready debit and credit entry, is Pro and was
refused by name on the free tier. Nothing was invented in its place: the free
<code>asset_schedule</code> carries the same numbers and answered the question.</p>

<h2>Step 8. Price the trip</h2>
<pre class="prompt">I am going to Berlin for a client meeting, leaving 14 September 2026 at 8am and back on 15 September at 6pm. Breakfast is included at the hotel both days. What diet am I owed?</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>per-diem</strong>, <code>perdiem_calc</code>. One call, and it resolved four things out of
that sentence with no question asked: Berlin means Germany means the Polish foreign table, the
timezone is Europe/Warsaw from the shared profile, breakfast on both days is two separate deductions,
and one night away is one lodging night.</p>
<p>The German diet is <strong>EUR 55.00</strong> a day. Day one is a full 24 hour period, less 15
percent for the included breakfast: <strong>EUR 46.75</strong>. Day two is 10 hours, which is over 8
and up to 12, so half the diet, less the same 15 percent: <strong>EUR 23.37</strong>. Diet owed
<strong>EUR 70.12</strong>. Lodging came back EUR 0.00 with the reason stated, that the foreign table
bundles no per country lodging limit for Germany, rather than the figure quietly going missing.</p>

<h2>Step 9. Close the month</h2>
<pre class="prompt">Give me Acme's statement of account for September 2026 and show me the aging on what they still owe.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>statement-of-account</strong>, <code>statement_build</code> then
<code>statement_aging</code>. This is the only prompt in the month that reads three separate money
stores at once, which makes it the only one that can be wrong because two servers disagree.</p>
<p><strong>STMT-2026-0001</strong>, 2026-09-01 to 2026-09-30:</p>
<table>
<tr><th>Movement</th><th>EUR</th></tr>
<tr><td>Opening balance</td><td>0.00</td></tr>
<tr><td>Invoiced</td><td>1,107.00</td></tr>
<tr><td>Paid, including the retainer applied</td><td>500.00</td></tr>
<tr><td>Credited</td><td>110.70</td></tr>
<tr><td><strong>Closing balance</strong></td><td><strong>496.30</strong></td></tr>
</table>
<p><code>statement_aging</code> as at 2026-09-30 puts the whole <strong>EUR 496.30</strong> in the 0 to
30 day bucket, EUR 0.00 in 31 to 60, 61 to 90 and over 90, with INV-2026-0001 sitting 11 days past its
2026-09-19 due date and unapplied credit of EUR 0.00.</p>
<p>Note what that closing balance is: it nets the credit note that step 4 could not see. The document
the client receives is right even where the invoice store's own balance is not.</p>

<h2>What the free tier covered</h2>
<p>All nine steps ran with no license key set. Eight of them needed nothing paid at all: the invoice,
the credit note, the retainer and its application, the bank import and both reconciliations, the two
expenses, the asset and its schedule, the trip, the statement and the aging. One thing was refused by
name, <code>asset_journal</code> in step 7, and the free <code>asset_schedule</code> answered the same
question with the same numbers.</p>
<p>The paid gates you would meet next are the PDFs and the portfolio reports: <code>statement_pdf</code>,
<code>credit_note_pdf</code>, <code>deposit_statement_pdf</code>, <code>statements_report</code> and
<code>asset_report</code>. A single bundle key at 39 dollars, once, activates Pro on every child at
the same time. Full detail on <a href="/guides/mcp-server-free-vs-pro">free versus Pro</a>.</p>
<p>Seventeen tool calls, 118.6 seconds, and a statement whose closing balance of EUR 496.30 reconciles
to the minor unit with the invoice, the credit note and the deposit that produced it.</p>
${FOOT}`,
    faq: [
      { q: "Do I need all twenty-four servers to close a month like this?", a: "No. Eight children did the whole month: invoice, billing-docs, deposits, bank-statement, expense-tracker, asset-register, per-diem and statement-of-account. The bundle is one config entry for all 31, which is convenient when you do not know in advance which you will need; installing those eight singly gives the same free tier and the same answers." },
      { q: "Does the order of the steps matter?", a: "Two places. The credit note has to name an invoice that exists, and the statement has to be built last, because it reads the invoice, credit note and deposit stores as they stand when you ask. Everything else is independent. Reconciling before you log receipts is fine and is what this run did: the reconciliation is what tells you which receipts are missing." },
      { q: "What was the closing balance and how is it made up?", a: "EUR 496.30. Invoice INV-2026-0001 at EUR 1,107.00, less credit note CN-2026-0001 at EUR 110.70, less the EUR 500.00 retainer DEP-2026-0001 applied as a payment. Opening balance was EUR 0.00 because the stores started empty." },
      { q: "Why did the retainer step report a different figure?", a: "Because the invoice store does not know credit notes exist. deposit_apply reported a balance of EUR 607.00, which is the invoice total less the payment only. statement-of-account nets the credit note and returns EUR 496.30, so the document you send a client is correct; it is the mid-month balance question that is not. This is recorded as an open defect in the round 27 audit." },
      { q: "How much of this needs a Pro key?", a: "None of the nine steps, on the figures. One tool was refused, asset_journal, and the free asset_schedule carried the same numbers. Pro is what you buy for the PDFs and the cross-client reports: statement_pdf, credit_note_pdf, deposit_statement_pdf, statements_report and asset_report. One bundle key at 39 dollars covers every child." },
      { q: "Are these figures reproducible?", a: "The prompts, the profile, the fixture and the full method are in docs/USER_VALUE_R27.md in the repository, and every figure quoted here was read back off the stores on disk or off a direct tool probe rather than off the model's prose. The run scored 26 of 27 across the nine prompts on 2026-09-05." },
    ],
  },
  "mcp-server-not-showing-up-in-claude-desktop": {
    title: "MCP server not showing up in Claude Desktop: the six checks that find it",
    description: "Your config looks right and the tools are still missing. Run these six checks in order: JSON key, absolute path, PATH inheritance, restart depth, log file, tool ceiling.",
    html: `<h1>MCP server not showing up in Claude Desktop</h1>
<p>Six things break this, and they break it silently. Work down the list in order; the first four
account for nearly everything, and none of them produce an error message you would ever see.</p>
<ol>
<li><strong>The top-level key.</strong> Claude Desktop reads <code>mcpServers</code>. VS Code reads
<code>servers</code>. A block copied from a VS Code README parses as valid JSON, contributes nothing,
and reports no problem.</li>
<li><strong>Absolute paths.</strong> Every path in <code>claude_desktop_config.json</code> has to be
absolute. A relative path resolves against a working directory you did not choose.</li>
<li><strong>Where <code>npx</code> lives.</strong> A stdio server launched by Claude Desktop inherits
a limited subset of your shell environment. If node came from nvm, asdf or Homebrew, the bare word
<code>npx</code> is not on the inherited PATH. Paste what <code>which npx</code> prints.</li>
<li><strong>Quit, do not reload.</strong> Closing the window leaves the app running. Quit it fully
and start it again.</li>
<li><strong>Read the log.</strong> Claude Desktop writes one file per server. On macOS look in
<code>~/Library/Logs/Claude/</code> for <code>mcp-server-&lt;name&gt;.log</code>. A server that died
during startup says so there.</li>
<li><strong>Trailing comma.</strong> JSON has no tolerance for one, and an unparseable config file
means every server disappears at once, not just the one you were editing.</li>
</ol>

<h2>A config that works</h2>
<p>On macOS this file is at <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>,
on Windows at <code>%APPDATA%\\Claude\\claude_desktop_config.json</code>. Settings, then the Developer
tab, then Edit Config creates it if it is not there.</p>
<pre><code>{
  "mcpServers": {
    "invoice": {
      "command": "/Users/you/.nvm/versions/node/v22.14.0/bin/node",
      "args": ["/Users/you/mcp-servers/servers/invoice/dist/index.js"]
    }
  }
}</code></pre>
<p>Absolute node, absolute script, no shell involved. That form survives all three of the failures
above at once.</p>

<h2>The install that skips the file entirely</h2>
<p>Claude Desktop takes <code>.mcpb</code> bundles, which are a zip of the server plus its manifest,
and it ships its own Node runtime, so nothing about your PATH matters. Download a bundle from the
<a href="https://github.com/theluckystrike/mcp-servers/releases/latest">latest release</a> and double
click it. The v0.20.0 release carries 31 of them, one per server, measured with
<code>gh api repos/theluckystrike/mcp-servers/releases/latest</code> on 2026-09-07.</p>
<p>If you built a bundle yourself, it goes in through Settings, Extensions, Advanced settings,
Extension Developer, Install Extension.</p>

<h2>Still nothing?</h2>
<p>Two cases the list above does not cover. First, the tool ceiling: some clients cap how many tools
they will surface at once, so a large bundle can crowd out a small server. The office-suite bundle in
this repository exposes every child at once, which is convenient and is also the fastest way to hit
that ceiling; install the two or three servers you actually use instead. Second, a server that starts
and then exits: that is a crash, not a config problem, and the log file names it.</p>
<p>You can also sidestep local processes completely. <a href="/mcp/connect">mcp/connect</a> mints a
free anonymous token and prints an HTTPS URL per server that any client taking a remote URL will
accept. Nothing is installed and no PATH is consulted.</p>

<h2>Client by client</h2>
<p>The config path, the key name and the one caveat that bites for each client are on the
<a href="/setup">setup pages</a>, one per client and server, with the client's own documentation URL
and the date it was read.</p>
${FOOT}`,
    faq: [
      { q: "Where is the Claude Desktop log file?", a: "macOS: ~/Library/Logs/Claude/, with one mcp-server-<name>.log per configured server plus mcp.log for the client side. Windows: %APPDATA%\\Claude\\logs\\. A server that fails at startup writes its stderr there, which is usually a missing binary or a stack trace from the server itself." },
      { q: "Why does npx work in my terminal but not in Claude Desktop?", a: "Because the app does not run your shell profile. Your terminal PATH is built by .zshrc or .bash_profile; a stdio server spawned by a GUI app inherits a smaller, platform-dependent environment. Run `which npx` and paste the absolute result into the command field." },
      { q: "Do I have to restart after every config change?", a: "In Claude Desktop, yes, and it has to be a full quit rather than closing the window. Claude Code does not need one at all: the entry is live in the next session and /mcp reconnects on demand. Cursor picks the server up when its Customize page next lists it." },
      { q: "Is there a way to test the server without a client at all?", a: "Yes. Run the server binary directly from a terminal and it speaks JSON-RPC over stdio. If it prints a startup banner and waits, the server is fine and the problem is in the client config. If it exits, you have the error text in front of you." },
      { q: "Which install path actually works for these servers today?", a: "The .mcpb bundle or a clone and build. The npm packages are not published yet: a probe of registry.npmjs.org on 2026-09-07 returned no versions for @theluckystrike/mcp-invoice, mcp-time-tracker, mcp-spreadsheet, mcp-zip, mcp-pdf or mcp-quotes, which matches the npm status section of the repository README. The hosted URLs need no install." },
    ],
  },
  "where-is-claude-desktop-config-json": {
    title: "Where is claude_desktop_config.json, and what goes in it",
    description: "The exact path on macOS and Windows, how to open it without hunting, the minimum valid contents, and the two mistakes that make a correct file do nothing.",
    html: `<h1>Where is claude_desktop_config.json</h1>
<table>
<tr><th>macOS</th><td><code>~/Library/Application Support/Claude/claude_desktop_config.json</code></td></tr>
<tr><th>Windows</th><td><code>%APPDATA%\\Claude\\claude_desktop_config.json</code></td></tr>
<tr><th>Linux</th><td>No published path. The documentation lists macOS and Windows only.</td></tr>
</table>
<p>Do not go looking for it in Finder. Open Claude Desktop, go to Settings, click the Developer tab in
the left sidebar, and click Edit Config. That opens the file in your editor and creates it first if it
does not exist, which is the usual reason a search turns up nothing.</p>

<h2>The minimum that works</h2>
<pre><code>{
  "mcpServers": {
    "zip": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/Users/you/mcp-servers/servers/zip/dist/index.js"]
    }
  }
}</code></pre>
<p>One object, one key, one server. Add a second server as a sibling of <code>"zip"</code>, not as a
second <code>mcpServers</code> block. Environment variables go in an <code>"env"</code> object next to
<code>"command"</code>.</p>

<h2>Two mistakes that leave no trace</h2>
<p><strong>Relative paths.</strong> Everything in this file must be absolute. There is no project
directory to resolve against.</p>
<p><strong>A bare command name.</strong> <code>"command": "npx"</code> works only if npx sits on the
limited PATH a GUI app inherits. On a machine where node came from nvm or Homebrew, it does not.
<code>which node</code> in a terminal prints the string to paste.</p>
<p>Both disappear if you use a <code>.mcpb</code> bundle instead: Claude Desktop unpacks it, records
it as an extension, and runs it with its own bundled Node. The
<a href="https://github.com/theluckystrike/mcp-servers/releases/latest">latest release</a> has one per
server, 31 in v0.20.0.</p>

<h2>The same file under other names</h2>
<table>
<tr><th>Client</th><th>File</th><th>Top-level key</th></tr>
<tr><td>Claude Desktop</td><td>claude_desktop_config.json</td><td><code>mcpServers</code></td></tr>
<tr><td>Claude Code</td><td>.mcp.json at the repo root, or ~/.claude.json</td><td><code>mcpServers</code></td></tr>
<tr><td>Cursor</td><td>.cursor/mcp.json, or ~/.cursor/mcp.json</td><td><code>mcpServers</code></td></tr>
<tr><td>VS Code</td><td>.vscode/mcp.json</td><td><code>servers</code></td></tr>
<tr><td>Windsurf</td><td>~/.codeium/windsurf/mcp_config.json</td><td><code>mcpServers</code></td></tr>
<tr><td>Cline</td><td>~/.cline/mcp.json for the CLI; the panel for the extension</td><td><code>mcpServers</code></td></tr>
</table>
<p>Note the VS Code row. It is the one client that does not use <code>mcpServers</code>, and a config
pasted from anywhere else parses cleanly and contributes zero servers. Every row here was read off the
client's own documentation on 2026-09-02 and is recorded with its source URL in
<code>billing/src/setup.js</code>.</p>
<p>Per-server, per-client pages with the full block to paste are at <a href="/setup">setup</a>.</p>
${FOOT}`,
    faq: [
      { q: "The Developer tab is not in my Settings.", a: "It appears in the desktop app only, not on claude.ai. If you are looking at the web app there is no local config file at all; use a hosted server URL instead, which the Claude connector dialog accepts directly." },
      { q: "Can I keep the file in a git repo and symlink it?", a: "It has been reported that Claude Desktop replaces a symlinked claude_desktop_config.json with a regular file when it writes, so the link does not survive. Keep the source of truth elsewhere and copy it in." },
      { q: "How do I add environment variables?", a: "An \"env\" object next to \"command\", holding string values only. Numbers and booleans have to be quoted. For these servers the only one that matters is MCP_LICENSE_KEY, and leaving it out is what runs the free tier." },
      { q: "Does the server name in the config matter?", a: "It is the label the client shows and the prefix it puts on tool names, so keep it short and stable. Changing it later is safe: the servers store their data under a fixed directory in ~/.local/share/mcp-servers/, keyed by the server, not by whatever you called it in the config." },
    ],
  },
  "claude-mcp-add-command-reference": {
    title: "claude mcp add: every flag, and the scope that silently loses your server",
    description: "The full syntax of claude mcp add, what the double dash is for, why local scope is the default and how it makes a working server vanish, and the read-back commands.",
    html: `<h1>claude mcp add, in full</h1>
<pre><code>claude mcp add &lt;name&gt; [flags] -- &lt;command&gt; [args...]</code></pre>
<p>The <code>--</code> is load-bearing. It separates Claude Code's own options from the command line
that starts the server. Leave it out and <code>--transport</code> or <code>--env</code> belonging to
the server gets eaten by the CLI, or the reverse.</p>
<pre><code>claude mcp add zip -- node /Users/you/mcp-servers/servers/zip/dist/index.js</code></pre>

<h2>The flag that costs people an hour</h2>
<p><code>--scope</code> defaults to <code>local</code>, which means private to you and to the
directory you ran the command in. Run it in <code>~</code>, then open a project folder, and the tools
are simply absent. No error, no warning, nothing in <code>/mcp</code>.</p>
<table>
<tr><th>Scope</th><th>Written to</th><th>Who sees it</th></tr>
<tr><td><code>local</code> (default)</td><td>~/.claude.json</td><td>You, in that one directory</td></tr>
<tr><td><code>project</code></td><td>.mcp.json at the repo root</td><td>Anyone who checks out the repo</td></tr>
<tr><td><code>user</code></td><td>~/.claude.json</td><td>You, in every project</td></tr>
</table>
<p>If you want a server everywhere, say so:</p>
<pre><code>claude mcp add --scope user invoice -- node /Users/you/mcp-servers/servers/invoice/dist/index.js</code></pre>

<h2>The other flags</h2>
<table>
<tr><td><code>--transport</code>, <code>-t</code></td><td><code>stdio</code>, <code>http</code> or <code>sse</code>. Defaults to stdio.</td></tr>
<tr><td><code>--env KEY=value</code></td><td>One per variable, before the <code>--</code>.</td></tr>
<tr><td><code>--header</code>, <code>-H</code></td><td>For an HTTP server. Repeatable.</td></tr>
<tr><td><code>add-json &lt;name&gt; '&lt;json&gt;'</code></td><td>Takes a whole config object, which is the fastest way to paste a block out of a README.</td></tr>
</table>

<h2>Reading it back</h2>
<pre><code>claude mcp list          # every server and whether it connected
claude mcp get zip       # one server, with a health check
claude mcp remove zip    # take it out again</code></pre>
<p>Inside a session, <code>/mcp</code> shows what is connected and reconnects one on demand. There is
no restart step in Claude Code at all, which is the main practical difference from Claude Desktop.</p>

<h2>Adding a remote server with no local process</h2>
<pre><code>claude mcp add --transport http invoice https://mcp.zovo.one/mcp/invoice/t/YOUR_TOKEN</code></pre>
<p>Get the token and the ready-made URL for each server from
<a href="/mcp/connect">mcp/connect</a>. The free anonymous token allows 600 calls an hour and keeps
your data space for 30 days, refreshed for another 30 on every write, which the connect page states on
its face. Nothing is installed and no build step is involved.</p>
${FOOT}`,
    faq: [
      { q: "Why does claude mcp list show my server but the tools are missing in the session?", a: "list reports the entry, not a successful handshake. `claude mcp get <name>` runs a health check and is the one that tells you whether the process started and answered. If it started and answered but the tools are still absent, you are in a different directory from the one that holds a local-scope entry." },
      { q: "What is the difference between .mcp.json and ~/.claude.json?", a: ".mcp.json at a repository root is project scope, meant to be committed so a team shares the same servers. ~/.claude.json holds both local scope, which is keyed by directory, and user scope, which is not. Project scope is the one to use when the server is part of how the repo is worked on." },
      { q: "Can I edit .mcp.json by hand?", a: "Yes, and the shape is the same mcpServers object Claude Desktop uses, so a block from any README drops straight in. The CLI is just a writer for it. What the CLI adds is the health check on read-back." },
      { q: "How do I set a license key?", a: "--env MCP_LICENSE_KEY=MCPL1.... before the double dash. Leave it unset and the server runs its free tier, which for most of these servers is a real working tier rather than a trial: per-server limits are listed in data/facts.json in the repository and summarised on the free versus Pro guide." },
    ],
  },
  "mcp-on-windows-paths-and-npx": {
    title: "MCP servers on Windows: spawn npx ENOENT, backslashes and the PATH",
    description: "Why spawn npx ENOENT happens on Windows, the cmd wrapper that fixes it, how to escape backslashes in JSON, and the install path that avoids all of it.",
    html: `<h1>MCP servers on Windows</h1>
<p>Three Windows-only failures account for most of it. Here they are with the fix next to each.</p>

<h2>1. spawn npx ENOENT</h2>
<p>On Windows, <code>npx</code> is not an executable. It is <code>npx.cmd</code>, a batch shim, and
Node's process spawner will not run a batch file unless it goes through the shell. The client tries to
execute a file called exactly <code>npx</code>, finds none, and reports ENOENT.</p>
<pre><code>{
  "mcpServers": {
    "zip": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@scope/some-mcp-server"]
    }
  }
}</code></pre>
<p><code>cmd /c</code> is the wrapper. The same shape works for <code>npm</code>, <code>yarn</code>
and <code>pnpm</code>, all of which are <code>.cmd</code> shims on Windows.</p>

<h2>2. Backslashes in JSON</h2>
<p>A Windows path pasted into JSON has to have every backslash doubled, because a single backslash
starts an escape sequence. <code>C:\\Users\\you</code> in JSON is written
<code>C:\\\\Users\\\\you</code>. Forward slashes also work and are less error-prone:
<code>C:/Users/you/mcp-servers/servers/zip/dist/index.js</code> is valid on Windows and needs no
escaping at all.</p>

<h2>3. The config file is not where you think</h2>
<p><code>%APPDATA%\\Claude\\claude_desktop_config.json</code>. Paste that into the Explorer address bar
rather than expanding it by hand. Logs sit next door in <code>%APPDATA%\\Claude\\logs\\</code>, one
file per server, and that is where a startup crash prints its reason.</p>

<h2>The path that avoids all three</h2>
<p>A <code>.mcpb</code> bundle is a zip of the server plus a manifest, and Claude Desktop opens one
with an install dialog and runs it on its own bundled Node. There is no cmd wrapper, no PATH question
and no JSON to escape. Download from the
<a href="https://github.com/theluckystrike/mcp-servers/releases/latest">latest release</a>; v0.20.0
carries 31 bundles, one per server, which is what
<code>gh api repos/theluckystrike/mcp-servers/releases/latest</code> returned on 2026-09-07.</p>
<p>Building from source on Windows works the same way it does elsewhere:</p>
<pre><code>git clone https://github.com/theluckystrike/mcp-servers.git
cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/invoice</code></pre>
<p>Then point <code>command</code> at your node executable and <code>args</code> at
<code>servers/invoice/dist/index.js</code>, both absolute, both with forward slashes.</p>

<h2>File paths inside a conversation</h2>
<p>These servers read and write real files, so the paths you say out loud matter too. A drive letter
path is fine. What does not work is a bare <code>http://</code> argument where a file is expected: it
resolves as a relative filesystem path rather than being downloaded. That behaviour was found and
recorded during a scored run and is written up in <code>docs/USER_VALUE_R27.md</code> as defect D-R83.
Download the file first, then hand over the local path.</p>
${FOOT}`,
    faq: [
      { q: "Is WSL an option?", a: "It works, with one catch: a server running inside WSL sees the Linux filesystem, so /mnt/c/Users/you/... is how it reaches your Windows files, and any path you say in the conversation has to be in that form. If most of your files live on the Windows side, running the server natively is less friction." },
      { q: "Why does the same config work on my Mac and not on Windows?", a: "Almost always the cmd shim. macOS npx is a real executable that the spawner can exec directly; Windows npx is npx.cmd and needs cmd /c. Backslash escaping is the second most common cause, and it produces a JSON parse error that takes out every server in the file at once, not just the one you edited." },
      { q: "Do these servers work on Windows at all?", a: "Yes. They are TypeScript compiled to plain JavaScript with no native modules, so the same dist/index.js runs on all three platforms. Storage goes to the platform data directory rather than a hardcoded Unix path. The full suite of 1,518 tests, of which 1,507 pass, 0 fail and 11 are skipped, is recorded in data/tests.json at release v0.20.0." },
      { q: "What about Claude Desktop on Linux?", a: "There is no published Linux path for claude_desktop_config.json because the documentation lists macOS and Windows only. On Linux, use Claude Code, Cursor, VS Code or Cline, all of which are documented cross-platform, or connect to a hosted URL." },
    ],
  },
  "install-mcp-servers-without-npm": {
    title: "Installing these MCP servers when npx does not work yet",
    description: "The npm packages are not published. The three paths that do work today: the .mcpb one-click bundle, a clone and build, and a hosted URL that installs nothing.",
    html: `<h1>Installing these servers when npx does not work yet</h1>
<p>Straight answer first. The npm packages are not published. A probe of
<code>registry.npmjs.org</code> on 2026-09-07 returned no versions for
<code>@theluckystrike/mcp-invoice</code>, <code>mcp-time-tracker</code>, <code>mcp-spreadsheet</code>,
<code>mcp-zip</code>, <code>mcp-pdf</code> or <code>mcp-quotes</code>. That matches the npm status
section of the repository README: the publish token on the account is dead and re-authenticating it
needs a browser login by a human. The <code>npx -y @theluckystrike/mcp-...</code> lines printed
throughout the READMEs start working the moment that happens, and nothing else about them changes.</p>
<p>Three paths work today.</p>

<h2>1. The one-click bundle</h2>
<p>An <code>.mcpb</code> file is a zip holding the built server and its manifest. Claude Desktop opens
one with an install dialog and runs it on the Node runtime it ships with, so your own PATH, your nvm
version and your JSON escaping never enter into it.</p>
<ol>
<li>Open the <a href="https://github.com/theluckystrike/mcp-servers/releases/latest">latest release</a>.</li>
<li>Download the bundle you want, for example <code>invoice.mcpb</code>.</li>
<li>Double click it. Claude Desktop shows an install dialog.</li>
</ol>
<p>Release v0.20.0 carries 31 bundles, one per server plus the office-suite bundle. Across all releases
the assets have been downloaded 5,314 times, counted by summing
<code>download_count</code> over <code>gh api repos/theluckystrike/mcp-servers/releases --paginate</code>
on 2026-09-07.</p>

<h2>2. Clone and build</h2>
<pre><code>git clone https://github.com/theluckystrike/mcp-servers.git
cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/invoice</code></pre>
<p>Swap <code>servers/invoice</code> for whichever you want, or list several after more
<code>-w</code> flags. The license package has to be in the list because every server links against
it. The result is <code>servers/invoice/dist/index.js</code>, which you point a client at:</p>
<pre><code>claude mcp add --scope user invoice -- node /absolute/path/to/mcp-servers/servers/invoice/dist/index.js</code></pre>
<p>For Claude Desktop, the same two strings go into <code>command</code> and <code>args</code>, both
absolute.</p>

<h2>3. A URL, with nothing installed</h2>
<p>Every server also runs behind streamable HTTP. Open <a href="/mcp/connect">mcp/connect</a> and it
mints a free anonymous token and prints a ready URL per server. Paste one into any client that takes a
remote server URL, which includes the Claude connector dialog and several IDE pickers. There is no
header to set, because the token is already in the path.</p>
<p>The connect page states the free terms on its face: 600 calls an hour, the same free-tier server
limits as a local install, and a data space kept for 30 days and refreshed for another 30 on every
write. Reloading that page mints a new token and a new empty data space, so keep the URL if you want
to keep the data. Anyone holding the URL holds the data space, so treat it as a secret.</p>

<h2>Which one to pick</h2>
<table>
<tr><th>Situation</th><th>Path</th></tr>
<tr><td>Claude Desktop, no terminal</td><td>.mcpb bundle</td></tr>
<tr><td>Claude Code or Cursor, node already set up</td><td>clone and build</td></tr>
<tr><td>claude.ai in a browser, or a locked-down machine</td><td>hosted URL</td></tr>
<tr><td>Files on your own disk have to stay there</td><td>bundle or build, never the hosted URL</td></tr>
</table>
<p>That last row is the one that decides it for most people. The local servers make no network call at
all for anything except live rates and price pages; the hosted ones necessarily see what you send
them.</p>
${FOOT}`,
    faq: [
      { q: "When will npx work?", a: "When someone runs npm login --auth-type=web once from the publishing account in a browser. It is listed as a human-gated step in the repository README alongside the Smithery CLI login. No date is promised here, because promising one would be inventing it." },
      { q: "Is the .mcpb bundle the same code as the source?", a: "Yes. The release workflow builds each server from the repository and packs dist plus the manifest. The version in the bundle name matches the git tag, so invoice.mcpb from v0.20.0 is servers/invoice at v0.20.0." },
      { q: "Do I need to rebuild when I pull?", a: "Yes, npm run build -w again for the servers you use. dist is build output, not tracked source. If a build fails after a pull, run npm install first, because a new server may have added a dependency." },
      { q: "Can I use the hosted URL and a local install at the same time?", a: "You can, but they are separate data spaces. A local install writes under ~/.local/share/mcp-servers/, and the hosted token has its own store on the server side. An invoice created in one is not visible in the other, and there is no sync between them." },
    ],
  },
  "cursor-mcp-json-setup": {
    title: "Cursor MCP setup: mcp.json, the required type field, and where the servers appear",
    description: "The two locations for .cursor/mcp.json, the type field the current docs mark as required, envFile being stdio-only, and how to tell whether Cursor started the server.",
    html: `<h1>Cursor MCP setup</h1>
<p>Cursor reads <code>mcp.json</code> from one of two places, and which one you pick decides who gets
the server.</p>
<table>
<tr><th>This project only</th><td><code>&lt;project&gt;/.cursor/mcp.json</code></td></tr>
<tr><th>Every project</th><td><code>~/.cursor/mcp.json</code></td></tr>
</table>
<p>A working entry, with the field people leave out:</p>
<pre><code>{
  "mcpServers": {
    "time-tracker": {
      "type": "stdio",
      "command": "/opt/homebrew/bin/node",
      "args": ["/Users/you/mcp-servers/servers/time-tracker/dist/index.js"]
    }
  }
}</code></pre>
<p>The current field table marks <code>type</code> as required, with <code>stdio</code> for a server
Cursor launches itself. Write it out rather than relying on <code>command</code> and <code>args</code>
alone.</p>

<h2>Where to look after you save</h2>
<p>The Customize page in the sidebar is where servers are installed and managed, and it lists the
server with its tools once the process has started. The older Tools and MCP settings pane is not where
the current documentation sends you. If the server is listed but has no tools under it, it started and
then failed the handshake, which is a different problem from not starting at all.</p>

<h2>envFile is stdio only</h2>
<p>An <code>env</code> object next to <code>command</code> is read inline. <code>envFile</code> is
accepted for stdio servers only: a remote HTTP or SSE server does not read it, and its credentials
belong in headers in the config instead. This is the documented restriction, and it is easy to trip
over when you convert a local entry into a remote one and the key silently stops being sent.</p>

<h2>A remote server instead</h2>
<pre><code>{
  "mcpServers": {
    "invoice": {
      "type": "http",
      "url": "https://mcp.zovo.one/mcp/invoice/t/YOUR_TOKEN"
    }
  }
}</code></pre>
<p><a href="/mcp/connect">mcp/connect</a> prints the URL with the token already in the path, so there
is no header to configure and nothing to install. Free terms are on that page: 600 calls an hour and a
data space kept 30 days, refreshed on every write.</p>

<h2>What you can do once it is connected</h2>
<p>With the time tracker connected, this is a real session:</p>
<pre class="prompt">Start a timer for Acme, task API refactor.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p>Then, later, "stop the timer and tell me how long I worked", and at the end of the week "how many
hours did I put into Acme, grouped by task". The free tier gives unlimited timers and entries, with
reads clamped to the last seven days and hourly rates on two projects, which is the split recorded in
<code>data/facts.json</code>. There are 11 tools on that server, counted from
<code>data/tools.json</code>.</p>
<p>Per-server Cursor pages with the exact block for each of the 30 servers are under
<a href="/setup/cursor">setup/cursor</a>.</p>
${FOOT}`,
    faq: [
      { q: "Project mcp.json or the home one?", a: "Project, when the server is part of how this repo is worked on and you want it committed for the team. Home, when it is your own tooling and you want it in every window. Both files are read; the project one wins for a name that appears in both." },
      { q: "Cursor lists the server but no tools show up.", a: "The process started and the handshake did not finish. Run the same command in a terminal and watch stderr. With these servers, the usual cause is a dist directory that was never built, so node exits immediately with a module-not-found error." },
      { q: "Is there a tool limit in Cursor?", a: "Cursor's own documentation is the place to check for a current number, and it changes. What is safe to say is that some clients do cap the number of tools they surface at once, and the office-suite bundle in this repository exposes every child server's tools in one connection, which makes it the fastest way to reach any such cap. Installing the two or three servers you use avoids the question." },
      { q: "Does the free tier need an account?", a: "No. A local install has no account, no key and no login: leave MCP_LICENSE_KEY unset and the free tier is what runs. The hosted URLs mint an anonymous token with no sign-up either." },
    ],
  },
  "mcp-servers-that-work-offline": {
    title: "Which MCP servers work with no network at all",
    description: "A per-server list of what makes a network call and what does not, why that matters for client data, and how to verify the claim yourself rather than take it on trust.",
    html: `<h1>MCP servers that work with no network at all</h1>
<p>Of the 30 servers in this repository, 28 make no network call of any kind. Two do, and both only
because the thing they answer lives on someone else's server: the currency server fetches European
Central Bank reference rates, and the price tracker fetches the shop page whose price you asked about.
Everything else reads and writes files on your machine and talks to nothing.</p>

<h2>The list</h2>
<table>
<tr><th>Network calls</th><th>Servers</th></tr>
<tr><td>None</td><td>time-tracker, spreadsheet, invoice, expense-tracker, docx, timezone, resume, recurring, clauses, calendar, pdf, image, bank-statement, kanban, quotes, barcode, zip, billing-docs, deposits, per-diem, asset-register, statement-of-account, cash-book, amortization, petty-cash, work-order, catalogue, change-order</td></tr>
<tr><td>Fetches a public rate table</td><td>currency (ECB reference rates, cached locally)</td></tr>
<tr><td>Fetches a page you name</td><td>price-tracker (the product page you asked about)</td></tr>
</table>

<h2>Why this is the question to ask</h2>
<p>An MCP server runs as a process on your machine with whatever access you gave it, and the tools it
exposes are called by a model rather than by you. If the server also has a network connection, the
data flowing through it can leave, and no amount of reading the README will tell you it did not.
Cutting the network is the only check that does not depend on trust.</p>
<p>These servers are also unmetered offline. There is no license server to phone: a Pro key is an
Ed25519 signature the server verifies locally, so an activated install works on a plane and stays
activated. There is no telemetry endpoint and no usage counter that needs to reach anything.</p>

<h2>Verify it rather than believe it</h2>
<p>On macOS, Little Snitch or the built-in firewall in block-all mode will show you. On Linux:</p>
<pre><code>sudo unshare -n node /path/to/mcp-servers/servers/invoice/dist/index.js</code></pre>
<p>That runs the server in a network namespace with no interfaces. Drive it from a client and every
tool on the invoice server still answers. Try the same with the currency server and
<code>rates_latest</code> fails, which is the expected and honest result: it needs the ECB.</p>
<p>The other check is the source. Every server is TypeScript in <code>servers/&lt;name&gt;/src</code>
in a public repository, and a grep for <code>fetch</code>, <code>http</code> or <code>https</code>
across a server's source is a five-second audit that does not require reading any of it.</p>

<h2>Where the data goes instead</h2>
<p>Under <code>~/.local/share/mcp-servers/&lt;server&gt;/</code>, or the platform equivalent, as plain
JSON. You can read it with any editor, back it up with anything, and delete it by deleting the folder.
The file-handling servers, spreadsheet, pdf, image and zip, keep nothing at all beyond a recent-files
list: they work on the files you name and leave the results where you asked for them.</p>
<p>The one exception to all of this is the hosted endpoints. <a href="/mcp/connect">mcp/connect</a>
gives you a URL instead of an install, and a hosted server necessarily sees what you send it. That is
a genuine trade and the page says which one you are making.</p>
${FOOT}`,
    faq: [
      { q: "Does the currency server work offline once it has rates?", a: "Partly. It caches what it fetched under ~/.local/share/mcp-servers/currency/, so a conversion at a rate already in the cache answers with no network. A rate it has never seen cannot be invented, and it says so rather than guessing." },
      { q: "Does a Pro key need to check in?", a: "No. The key is verified with an offline Ed25519 signature check inside the server. There is no activation server, no seat count and no expiry ping. An air-gapped machine activates from the key string alone." },
      { q: "What about the price tracker, is it scraping?", a: "It fetches the one product page URL you give it and reads the price out of JSON-LD, microdata, Open Graph tags or common price markup. It follows no links, crawls nothing, and refuses a redirect that leaves the product page rather than reporting the price of whatever it landed on. Pages that block bots are handled by typing the price in by hand." },
      { q: "Can I run these on a machine with no internet from the start?", a: "Yes, if you get the code there. Clone and build on a connected machine, copy the repository directory across, and the built dist runs. The .mcpb bundle is a single self-contained file and copies across just as easily." },
    ],
  },
  "vat-and-reverse-charge-invoices-from-chat": {
    title: "Invoicing an EU client with reverse charge, from a chat message",
    description: "Per-line VAT rates, the client VAT id on the document, one tax line per rate, and the one judgement the server will not make for you.",
    html: `<h1>Reverse charge invoices from chat</h1>
<p>Tax rate on this server is per line item, not per invoice. A 23 percent domestic line and a zero
rated reverse charge line sit on the same document, the totals block prints one tax line per distinct
rate, and the total adds up. That is the whole mechanism.</p>
<p>What the server does not do is decide whether reverse charge applies to your sale. That depends on
where both parties are established, what you sold, and whether the customer is VAT registered, and no
tool in this repository is going to guess it. You decide; the server prints what you decided,
correctly and consistently.</p>

<h2>Set up the two parties once</h2>
<pre class="prompt">Set my business profile: Nova Studio, Warsaw, VAT id PL1234567890, default currency EUR, default tax rate 23, payment terms 14 days.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p>That is <code>business_set</code>. It also takes an IBAN, a bank name, a logo path and an invoice
prefix. Anything it does not recognise is reported back to you rather than dropped quietly, so a typo
in a field name surfaces immediately.</p>
<pre class="prompt">Add a client: Beta GmbH, Musterstrasse 1 Berlin, VAT id DE811234567, email billing@beta.example.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>client_add</code>. The client VAT id is the field that matters here: it is what gets printed
on the document, which is the point of recording it. An identical record is refused by name rather
than stored twice.</p>

<h2>The invoice</h2>
<pre class="prompt">Invoice Beta GmbH for 20 hours of development at 90 EUR, zero rated, reverse charge, due in 14 days.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>invoice_create</code> with the line carrying <code>tax_rate: 0</code>. The number is allocated
in sequence as <code>INV-YYYY-NNNN</code> and is never reused. Subtotal 1,800.00 EUR, tax 0.00, total
1,800.00 EUR, with Beta's VAT id in the BILL TO block.</p>
<p>Mixing rates on one document works the same way. Twelve hours at 23 percent and eight hours at
zero produce two tax lines, and the arithmetic is done in integer minor units with each line rounded
once and then summed, so the printed total equals the sum of the printed lines. There is no floating
point drift between what the PDF shows and what the client pays.</p>

<h2>What one invoice cannot do</h2>
<p>Carry two currencies. Items may each declare a currency, and a mix is refused rather than billed as
if it were one. If you have USD hours and a EUR receipt to bill together, convert first and issue in
one currency. The currency server's <code>fx_rates_for</code> gives you European Central Bank
reference rates to do it with, and <code>invoice_from_hours</code> takes
<code>target_currency</code> plus <code>fx_rates</code> so the rate you used is the rate on the
document.</p>

<h2>Free tier</h2>
<p>Three invoices per calendar month, and the PDF carries a small footer line. The overdue report is
free. Pro at 19 dollars once removes the invoice cap and the footer and allows a logo and a custom
prefix. Those figures are from <code>data/facts.json</code> in the repository. Ten tools on this
server, counted from <code>data/tools.json</code>.</p>
${FOOT}`,
    faq: [
      { q: "Does it check whether my client's VAT id is valid?", a: "No. It stores the string you gave it and prints it. There is no VIES lookup, because the server makes no network calls at all. Validate the id yourself before you rely on zero rating." },
      { q: "Can I put the reverse charge wording on the invoice?", a: "Put it in the line description, which is free text and prints on the document. There is no dedicated legal-notice field, so the honest answer is that you supply the wording your jurisdiction requires rather than the server supplying it for you." },
      { q: "What if the client is not VAT registered?", a: "Then charge your domestic rate on the line and the invoice prints one tax line at that rate. Nothing about the mechanism changes; only the number you put in tax_rate does." },
      { q: "Does the same work on quotes?", a: "Yes. The quotes server carries VAT, discounts and multiple currencies on the same engine, holds the client VAT id, and quote_accept turns an accepted quote into the invoice without retyping the lines. Its free tier is 5 open quotes at a time with unlimited pasteable text quotes." },
    ],
  },
  "quote-to-cash-in-claude": {
    title: "Quote, deposit, invoice, statement: the whole cycle in one conversation",
    description: "A worked run through four servers: price a job, take a retainer, bill it, apply the retainer, and produce the statement that says what is actually owed.",
    html: `<h1>From quote to cash, in one conversation</h1>
<p>Four servers, five steps, and every figure below came off a scored run recorded in
<code>docs/USER_VALUE_R27.md</code> on 2026-09-05. The prompts are quoted as they were typed.</p>

<h2>1. Price it</h2>
<pre class="prompt">Quote Acme for 20 hours of design at 90 EUR plus 23 percent VAT, valid 30 days.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>quotes</strong>, <code>quote_create</code>. The free tier holds five open quotes at a time
and unlimited pasteable text quotes, which is a real pipeline rather than a demo.
<code>quote_send_text</code> gives you the block to paste into an email.</p>

<h2>2. They say yes</h2>
<pre class="prompt">Acme accepted the quote. Turn it into an invoice.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>quote_accept</code>, then <strong>invoice</strong> and <code>invoice_create</code>. The lines
carry over. In the recorded run the equivalent step produced INV-2026-0001 at EUR 1,107.00, due
2026-09-19.</p>

<h2>3. Take the retainer</h2>
<pre class="prompt">Acme paid a 500 EUR retainer today. Record it.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>deposits</strong>, <code>deposit_record</code>. DEP-2026-0001, EUR 500.00 held.
<code>deposit_apply</code> then puts it against the invoice as a payment, leaving EUR 496.30 really
outstanding once a credit note in the same run is accounted for.</p>

<h2>4. Something changed</h2>
<pre class="prompt">Credit one hour back to Acme on INV-2026-0001.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>billing-docs</strong>, <code>credit_note_create</code>. CN-2026-0001, EUR -110.70. Same
engine as the invoices, same numbering discipline.</p>

<h2>5. What do they actually owe</h2>
<pre class="prompt">Give me Acme's statement of account for September 2026 and show me the aging on what they still owe.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><strong>statement-of-account</strong>, <code>statement_build</code> then
<code>statement_aging</code>. Opening 0.00, invoiced 1,107.00, paid 500.00, credited 110.70, closing
<strong>EUR 496.30</strong>, all of it in the 0 to 30 day bucket, 11 days past the due date.</p>

<h2>The defect worth knowing about</h2>
<p>Mid-cycle, <code>deposit_apply</code> reported a balance of EUR 607.00, because the invoice store
does not know credit notes exist. The statement nets the credit note and returns EUR 496.30. The
document you send a client is right; the mid-month balance question is the one that is not. This is
recorded as open defect D-R96 in <code>docs/USER_VALUE_R27.md</code>, and it is written here rather
than left for you to find.</p>

<h2>What this costs</h2>
<p>Every step above ran with no license key set. The caps you meet next are the PDFs and the
cross-client reports: <code>statement_pdf</code>, <code>credit_note_pdf</code> and
<code>deposits_report</code>. One bundle key at 39 dollars, paid once, covers every server. Per-server
free tiers are listed in <code>data/facts.json</code>.</p>
${FOOT}`,
    faq: [
      { q: "Do the four servers share a client list?", a: "They share a profile file for the issuer details, and each keeps its own records. A client added on the invoice server is not automatically on the quotes server. In practice you say the client name and the servers resolve it, which is why the recorded run needed no ids typed by hand." },
      { q: "How many tool calls does a cycle like this take?", a: "The nine-step month in docs/USER_VALUE_R27.md took 17 tool calls and 118.6 seconds end to end, scoring 26 of 27 on correctness of server, tool and figure. A five-step cycle is proportionally less; the number is not fixed because the model sometimes splits a request into a report call and a document call." },
      { q: "Can I do this without the deposits server?", a: "Yes. invoice_mark_paid records a payment in full or in part and reports the balance due. The deposits server exists for money held before there is an invoice to put it against, which is what a retainer or a security deposit is." },
      { q: "What happens when the free invoice cap runs out mid-month?", a: "The fourth invoice in a calendar month is refused by name with the reason. Nothing already created is locked away: lists, PDFs of existing invoices, the overdue report and every read stay available. The cap is on creating new documents, not on reaching the ones you have." },
    ],
  },
  "project-profitability-hours-versus-budget": {
    title: "Is this project making money? Hours against costs, without a spreadsheet",
    description: "Put tracked hours and logged costs side by side for one client, work out what is left, and see the two numbers that make a profitable project look unprofitable.",
    html: `<h1>Is this project actually making money</h1>
<p>Two servers hold the answer and neither of them computes it for you, which is worth knowing before
you start. The time tracker holds what the project earned. The expense tracker holds what it cost.
Ask each, then subtract.</p>

<h2>What it earned</h2>
<pre class="prompt">How many hours did I put into Acme this month, grouped by task, with amounts?</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>report</code> on the time tracker returns totals in hours and money, grouped by project, day,
task or tag. Money is computed from seconds and the rate in one rounding step, then summed, so the
total equals the sum of the lines. On the free tier reads are clamped to the last 7 days, which is
enough for a weekly check and not enough for a month; that limit and the two-rated-projects limit are
in <code>data/facts.json</code>.</p>

<h2>What it cost</h2>
<pre class="prompt">Show me the expense summary for Acme this month, grouped by category.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>expense_summary</code> groups by category, project, month or merchant, always per currency
and never mixing currencies into one number. Free covers the last 30 days and 3 projects.</p>

<h2>The two numbers that distort it</h2>
<p><strong>Rebillable costs counted as costs.</strong> A 400 EUR stock photo licence you will invoice
back to the client is not a project cost; it is a pass-through. The expense tracker holds a billable
flag for exactly this, and <code>expense_to_invoice</code> previews the unbilled billable expenses of
a project as invoice line items, with an optional markup. Until you separate them, every rebillable
purchase makes the project look worse than it is.</p>
<p><strong>Unbilled hours.</strong> Hours tracked and never invoiced are revenue you have not got.
<code>entry_mark_billed</code> closes tracked hours against an invoice number, so a report can tell
tracked from billed. If nothing is ever marked, every report reads as though the whole month was paid.</p>

<h2>A worked shape</h2>
<table>
<tr><th>Line</th><th>EUR</th><th>Where it came from</th></tr>
<tr><td>Hours billed, 20 at 90</td><td>1,800.00</td><td>time-tracker <code>report</code></td></tr>
<tr><td>Rebilled costs</td><td>420.00</td><td>expense-tracker, billable, rebilled</td></tr>
<tr><td>Own costs</td><td>-260.00</td><td>expense-tracker, not billable</td></tr>
<tr><td>Cost of the rebilled items</td><td>-420.00</td><td>the same purchases, at cost</td></tr>
<tr><td><strong>Left</strong></td><td><strong>1,540.00</strong></td><td></td></tr>
</table>
<p>Rebilled costs appear twice on purpose, once as revenue and once as cost, and net to zero unless
you added a markup. If they only appear once, the project is either 420 EUR better or 420 EUR worse
than it looks, depending which side you dropped.</p>

<h2>Keeping the hours honest in the first place</h2>
<p>The kanban server has <code>task_start_timer</code> and <code>task_log_time</code>, which push time
into the time tracker from the board rather than from memory. A task you moved to done with no time
against it is the usual source of a project that mysteriously earned nothing. Free tier there is 3
projects and 200 open tasks.</p>
${FOOT}`,
    faq: [
      { q: "Is there one tool that returns profit?", a: "No, and there is no plan to pretend otherwise. Profit depends on what you count as a project cost, whether you allocate overhead, and how you treat unbilled time. Two honest reports you subtract yourself beat one number computed from assumptions you did not make." },
      { q: "Can I compare across currencies?", a: "Not inside one number. Both servers group per currency and refuse to add them. Convert deliberately with the currency server's fx_rates_for, which returns European Central Bank reference rates, and state the rate you used. The free currency tier covers history up to 90 days." },
      { q: "How do I handle a fixed-price project?", a: "Track the hours anyway, with a rate set, and treat the reported amount as what the work would have earned hourly. The gap between that and the fixed price is the thing you actually want to know, and it is invisible if you do not track the hours because the price was fixed." },
      { q: "What is the smallest version of this?", a: "One prompt a week: 'hours on every project this week with amounts'. On the free tier that is exactly the window reads are clamped to, so it costs nothing and needs no key." },
    ],
  },
  "self-employed-tax-year-pack-from-chat": {
    title: "Building a tax year pack for your accountant from chat",
    description: "The six things an accountant asks a sole trader for, which server holds each, and how to hand the whole year over as one archive.",
    html: `<h1>A tax year pack, assembled from chat</h1>
<p>An accountant asks a sole trader for roughly six things. Here is which server holds each, and the
one prompt that produces it.</p>
<table>
<tr><th>What they ask for</th><th>Server</th><th>Tool</th></tr>
<tr><td>Sales, invoice by invoice</td><td>invoice</td><td><code>invoice_list</code></td></tr>
<tr><td>Purchases with VAT split out</td><td>expense-tracker</td><td><code>expense_export</code></td></tr>
<tr><td>The bank, categorised</td><td>bank-statement</td><td><code>statement_export</code></td></tr>
<tr><td>Mileage and travel</td><td>expense-tracker, per-diem</td><td><code>mileage_add</code>, <code>trip_export</code></td></tr>
<tr><td>Fixed assets and depreciation</td><td>asset-register</td><td><code>asset_schedule</code></td></tr>
<tr><td>What clients still owe at year end</td><td>statement-of-account</td><td><code>statement_aging</code></td></tr>
</table>

<h2>The order that saves you a second pass</h2>
<p>Import the bank first, because it is the only record that is complete. Everything else is a record
of what you remembered to write down.</p>
<pre class="prompt">Import this bank CSV export and categorise it, then reconcile it against my logged expenses for the year.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>statement_import</code>, then <code>reconcile_expenses</code>. That second call is the useful
one: it names the bank debits with no receipt behind them, which is your list of missing paperwork.
In the recorded run in <code>docs/USER_VALUE_R27.md</code> a 41-transaction Revolut export produced 33
August debits and EUR 1,283.73 unreceipted. On the free tier reconciliation runs 31 days at a time,
so a year is twelve calls rather than one.</p>

<h2>Then fill the gaps and export</h2>
<pre class="prompt">Log these two: 12.30 EUR at Adobe, software, and 48.00 EUR at the print shop, billable to Acme.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>expense_add</code>. A stored <code>vat_rate</code> splits the gross on the receipt into net
and VAT by rounding the VAT rather than the net, so net plus VAT equals the gross exactly. An expense
with no rate holds a gross amount and is flagged as VAT unknown rather than silently taxed at a
default, which is the behaviour that stops a rate you set in March from rewriting what a receipt in
January meant.</p>
<pre class="prompt">Export every expense for the year to CSV, then show me the aging on unpaid invoices as at 31 December.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>

<h2>Hand it over as one file</h2>
<pre class="prompt">Zip everything in my exports folder into accounts-2026.zip.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p>The zip server packs a folder with a glob and refuses nothing quietly. Free is 20 archives a
calendar month at up to 25 MB and 200 entries each, and reading an archive is never metered on any
tier. If the accountant sends one back, <code>zip_list</code> tells you what is inside before you
unpack it, including the absolute paths, the dot-dot entries and the symlinks that a careless archive
can carry.</p>

<h2>What this does not do</h2>
<p>It does not file anything, compute your tax, or know your allowances. There is no tax engine in
this repository and there is not going to be a claim that there is. What it gives you is the six
exports in a shape a human accountant can read, produced from records you kept as you went rather
than reconstructed in April.</p>
${FOOT}`,
    faq: [
      { q: "Which free tiers run out first over a whole year?", a: "The read windows. The time tracker clamps reads to 7 days on free, the expense tracker to 30, and bank reconciliation runs 31 days at a time. Creating records is unlimited on both trackers, so a year of data accumulates fine on free; it is pulling the year back out in one call that needs Pro. Per-server figures are in data/facts.json." },
      { q: "Does the asset register know my country's depreciation rates?", a: "It ships rate tables the tax authorities published, and every answer names the rate, the instrument and its effective date. Schedules are free and unlimited on every tier, deliberately, because the rates are public regulation. The free cap is on the size of the register, 10 assets." },
      { q: "Can it produce a profit and loss?", a: "The cash-book server builds a double-entry ledger from the books the other servers already keep, and trial_balance and ledger_lines are free and unlimited. It writes into none of those books and there is no way to type an entry into it, so it can only tell you whether what you recorded adds up. That is a different thing from a filed set of accounts." },
      { q: "How do I make sure the mileage figures are right?", a: "Pass your own rate. The bundled table holds one flat approximation per region, PL 1.15 PLN per km, UK 0.45 GBP per mile, US 0.70 USD per mile, EU 0.30 EUR per km, each with the assumption it makes written next to it, and every reply repeats that it is an approximation. rate_per_km overrides it with your exact scheme." },
    ],
  },
  "mileage-log-for-tax-from-chat": {
    title: "Keeping a mileage log in chat, with the rate you actually claim",
    description: "Log a trip in one sentence, why the bundled rates are labelled approximations, and how to pass your own rate so the number matches your scheme.",
    html: `<h1>A mileage log you will actually keep</h1>
<pre class="prompt">Log 84 km to the Krakow site visit yesterday for Acme, billable.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p>That is <code>mileage_add</code> on the expense tracker. It prices the trip from a rate table and
writes it as an expense with a project and a billable flag, so it flows into the same summaries and
the same rebill as everything else you spent.</p>

<h2>Read the rate it used</h2>
<p>Every reply names the rate and repeats a caveat, in this form:</p>
<pre><code>(table rate PL 1.15 PLN/km, an approximation; pass rate_per_km for your exact scheme)</code></pre>
<p>That is deliberate. The bundled table holds one flat rate per region and each row states what it
assumes:</p>
<table>
<tr><th>Region</th><th>Rate</th><th>Assumes</th></tr>
<tr><td>PL</td><td>1.15 PLN/km</td><td>A car over 900 cm3. The limit is 0.89 PLN/km at or below that, with separate motorcycle and moped rates.</td></tr>
<tr><td>UK</td><td>0.45 GBP/mile</td><td>A car, inside the first 10,000 business miles of the tax year. HMRC pays less above that, and different rates for motorcycles and bicycles.</td></tr>
<tr><td>US</td><td>0.70 USD/mile</td><td>The IRS business standard rate for one calendar year. It is reissued annually and has changed mid-year.</td></tr>
<tr><td>EU</td><td>0.30 EUR/km</td><td>A generic per-kilometre allowance. There is no single EU rate; each member state sets its own.</td></tr>
</table>
<p>There are no year, vehicle or threshold tables behind those numbers, and that is a design decision
stated in the server's own README: a table that looks authoritative and is a year stale is worse than
one that says what it is.</p>

<h2>Claim your real rate</h2>
<pre class="prompt">Log 84 km for Acme at 0.89 PLN per km.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>rate_per_km</code> overrides the table for the unit you passed, which is the supported way to
claim an engine class, a mid-year rate, or the band above 10,000 miles. With no region, miles take the
US rate and kilometres the EU rate.</p>

<h2>One refusal that saves real money</h2>
<p><code>currency</code> is accepted only together with <code>rate_per_km</code>. Relabelling a table
rate of PLN 1.15 per km as EUR 1.15 per km converts nothing and books roughly four times the real
cost, so that call is refused rather than answered. Money is <code>round(distance * rate)</code> in
the rate's own currency, and currencies are never added together in a summary.</p>

<h2>Getting it onto an invoice</h2>
<p>A billable mileage line is picked up by <code>expense_to_invoice</code> along with everything else
billable on that project, as <code>invoice_create</code> line items, grouped per currency because one
invoice carries one currency. That call marks nothing as rebilled. Create the invoice, then call
<code>expense_mark_rebilled</code> with the invoice number, which is required. The two-step exists so
a preview can never quietly close out expenses against an invoice that was not issued.</p>

<h2>Free tier</h2>
<p>Logging expenses, mileage and receipts is unlimited on both tiers. The free limits are on reading
back: list and summary cover the last 30 days, 3 projects, 5 merchant rules, CSV export up to 200 rows
and never a partial file. <code>expense_to_invoice</code> handles 20 items at a time on free, markup
included. From <code>data/facts.json</code> and <code>servers/expense-tracker/README.md</code>.</p>
${FOOT}`,
    faq: [
      { q: "Does it track the route or the odometer?", a: "Neither. You say the distance. There is no GPS, no map lookup and no network call anywhere in this server, which is why it can run with the network off entirely." },
      { q: "Can I log a round trip?", a: "Say the total distance. There is no outbound and return concept, because for the claim it makes no difference. What does matter is logging it the same day: the free read window is 30 days, and a trip you never wrote down is not recoverable from anything the server holds." },
      { q: "How do I separate a personal detour?", a: "Log only the business distance. The server records what you tell it and does not audit it. If you need the working shown, put it in the description field, which is free text and survives into the CSV export." },
      { q: "What about per diems for the same trip?", a: "That is a different server. per-diem prices the daily subsistence allowance on the Polish delegation regulation, the HMRC benchmark scale rates or the US GSA CONUS standard, with the partial-day rule and meal deductions shown next to the figure. Rate lookups and calculations are unlimited on every tier there, deliberately, because the tables are public regulation." },
    ],
  },
  "reconcile-a-bank-export-with-your-invoices": {
    title: "Reconciling a bank CSV against what you invoiced and spent",
    description: "Import any bank export, let rules categorise it, and get the list of debits with no receipt behind them. A worked run with real figures.",
    html: `<h1>Reconciling a bank export in chat</h1>
<p>The bank statement is the only complete record you have. Everything else is a record of what you
remembered to write down, which is why reconciliation is the step that finds the missing paperwork
rather than the step that confirms it is all there.</p>

<h2>Import</h2>
<pre class="prompt">Import ~/Downloads/revolut-main.csv as my main account.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>statement_import</code>. It sniffs the delimiter and the header row, which is what makes an
export from any bank work rather than one specific format. A run recorded in
<code>docs/USER_VALUE_R27.md</code> on 2026-09-05 imported a 4,422-byte Revolut export and read
<strong>41 transactions</strong>, of which 33 were August debits.</p>
<p>One thing that trips people: hand it a local path. A bare <code>http://</code> argument where a
file is expected resolves as a relative filesystem path rather than being downloaded. That is recorded
as defect D-R83 in the same document. Download first, then say the path.</p>

<h2>Categorise once, not every month</h2>
<pre class="prompt">Anything from Adobe is software, anything from PKP is travel, and anything from Zabka is subsistence.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>category_rules</code>. Rules are matched on the merchant text and applied to new imports, so
the second month is mostly automatic. Free tier holds 5 rules across 2 accounts with 12 months of
transactions.</p>

<h2>The call that earns its keep</h2>
<pre class="prompt">Reconcile August against my logged expenses and tell me what has no receipt.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>reconcile_expenses</code>. In that recorded run it returned <strong>EUR 1,283.73
unreceipted</strong> across the August debits. That number is the point of the exercise: it is the
list of things you spent money on and never logged, sorted so you can work down it.</p>
<p>On the free tier reconciliation runs 31 days at a time. A year is twelve calls, which is tedious
and works. Pro removes the window.</p>

<h2>Find the subscriptions you forgot</h2>
<pre class="prompt">What is recurring on this account?</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>recurring_detect</code> looks for repeated charges. Free covers the last 3 months and reports
5 charges, which in practice is enough to find the two you were not thinking about.</p>

<h2>Matching money in against invoices</h2>
<p>The bank server categorises and reconciles spending. For money coming in, the pairing is manual and
deliberate: <code>transactions_search</code> finds the credit, and <code>invoice_mark_paid</code> on
the invoice server records it in full or in part and reports the balance due. There is no automatic
matcher, because a payment that is 3 EUR short of an invoice is either a bank fee or a dispute, and
guessing which one costs more than asking.</p>
<p>Ten tools on this server, counted from <code>data/tools.json</code>. Free and Pro splits from
<code>data/facts.json</code>.</p>
${FOOT}`,
    faq: [
      { q: "Which banks does the CSV importer handle?", a: "It is format-agnostic rather than bank-specific: it sniffs the delimiter and guesses the header row, then maps date, description and amount. Exports that split debit and credit into two columns, and exports that use a single signed column, both work. A format it cannot read fails loudly with the row it choked on rather than importing half a file." },
      { q: "Does anything get uploaded?", a: "No. The server makes no network call at all. Transactions live under ~/.local/share/mcp-servers/bank-statement/ as plain JSON, and you can delete the folder to delete the data." },
      { q: "Can I import the same file twice?", a: "Importing overlapping ranges is the normal case, since bank exports usually overlap at the edges. Check the imported count against the file's own row count on the first import so you know what a clean number looks like for your bank, then compare on later ones." },
      { q: "What does reconciliation actually compare?", a: "Bank debits against expenses logged on the expense tracker over the same window, by amount and date proximity. What it returns is the unmatched side: debits with nothing logged against them. It does not create expenses for you, because a bank line has no VAT rate, no project and no billable flag, and inventing those is how a ledger stops being true." },
    ],
  },
  "rebill-client-expenses-with-a-markup": {
    title: "Rebilling client expenses, with a markup and the VAT handled honestly",
    description: "Turn logged billable costs into invoice lines, add a markup, keep multi-currency purchases from being folded into one wrong number, and close them out correctly.",
    html: `<h1>Rebilling what a project cost you</h1>
<pre class="prompt">Show me Acme's unbilled billable expenses as invoice lines with a 10 percent markup.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>expense_to_invoice</code>. It returns the project's unbilled billable expenses in exactly the
line-item shape <code>invoice_create</code> expects, per currency, with your markup applied. It marks
nothing as rebilled, and there is no option to make it, which is the design decision that matters
here.</p>

<h2>Why the preview and the close-out are separate</h2>
<p>Because you can preview and then not issue the invoice. If the preview closed expenses out, a
conversation you abandoned would leave real costs marked as billed and invisible to the next preview.
So the sequence is fixed: preview, create the invoice, then</p>
<pre class="prompt">Mark those expenses rebilled against INV-2026-0007.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>expense_mark_rebilled</code>, and <code>invoice_number</code> is required. Marking by ids is
the precise route. Marking by project and date range additionally requires a currency, so invoicing
the EUR group cannot accidentally close the PLN one.</p>

<h2>Currencies do not get folded together</h2>
<p>One invoice carries one currency. A week of USD hours, a EUR receipt and a GBP mileage line comes
back as three groups, each with its own <code>expense_ids</code>, and you pass one group. To get a
single invoice, supply <code>target_currency</code> and your own <code>fx_rates</code>, which puts the
rate you used on the record instead of a rate the server picked. The currency server's
<code>fx_rates_for</code> returns European Central Bank reference rates in that shape; free covers
history up to 90 days.</p>

<h2>The VAT rule that stops double taxing</h2>
<p>A stored rate of <code>0</code> is a rate, not a gap: an exempt receipt stays exempt. An expense
recorded with no rate at all holds a gross amount and is rebilled as-is with
<code>tax_rate: 0</code> and a description saying so, precisely so a default rate on the invoice
cannot tax a receipt that already included tax. To split those older lines anyway, pass
<code>assume_vat_rate</code> and they come back flagged <code>[vat assumed 23%]</code>.</p>
<p>The <code>expense_settings</code> default is applied when the expense is inserted and never
retroactively at rebill time. Changing that default in March does not rewrite what a receipt entered
in January meant.</p>

<h2>A worked line</h2>
<table>
<tr><th></th><th>EUR</th></tr>
<tr><td>Stock photo licence, logged gross</td><td>48.00</td></tr>
<tr><td>VAT split at 23 percent</td><td>net 39.02, VAT 8.98</td></tr>
<tr><td>Rebilled net with 10 percent markup</td><td>42.92</td></tr>
<tr><td>On the invoice at 23 percent</td><td>52.79 gross</td></tr>
</table>
<p>The split rounds the VAT rather than the net, so net plus VAT is exactly the gross and a half-cent
of VAT rounds up instead of disappearing.</p>

<h2>Free tier</h2>
<p>Logging is unlimited. <code>expense_to_invoice</code> handles 20 items at a time on free, markup
included; Pro removes the item cap and adds xlsx export and unlimited projects and rules. Twelve tools
on this server, counted from <code>data/tools.json</code>.</p>
${FOOT}`,
    faq: [
      { q: "Can I rebill at cost with no markup?", a: "Yes, that is the default. Markup is a parameter you pass, not a setting that lurks. Passing zero and passing nothing produce the same lines." },
      { q: "What if I already invoiced some of them?", a: "The preview only returns unbilled billable expenses, so anything already closed out with expense_mark_rebilled is excluded. That is the whole reason the marker exists rather than a date cutoff, which would break the moment you invoiced out of order." },
      { q: "Can I unmark something?", a: "expense_update with rebilled: false clears both the marker and the invoice number. Changing the amount, currency or VAT rate of an already-rebilled expense is refused unless you pass unlink_rebill: true, because the invoice charged something else and quietly diverging from it is worse than a refusal." },
      { q: "Does the markup show on the invoice?", a: "No. It comes through in the line amount, not as a separate line, which is normally what you want. If you need it visible, put it in the line description before you create the invoice, which is free text." },
    ],
  },
  "chase-unpaid-invoices-without-a-crm": {
    title: "Chasing an unpaid invoice: aging, then the letter",
    description: "Find out who owes what and for how long, then get the chaser drafted at the tone you actually want, all on the free tier.",
    html: `<h1>Chasing an unpaid invoice</h1>
<p>Two questions, in this order. Who owes me money, and how do I ask for it.</p>

<h2>Who owes what</h2>
<pre class="prompt">Show me the aging on everything outstanding as at today.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>statement_aging</code> on the statement-of-account server, for one client or for everyone. It
buckets what is owed into 0 to 30, 31 to 60, 61 to 90 and over 90 days as at any date you name, and
names the oldest overdue invoice.</p>
<p>This tool is free and unlimited on every tier, for one client or for all of them, and the reason is
stated in the server's own material: who owes me money is the question this server exists for, and a
free tier that hides it is a demo rather than a tool. The metered thing is the document that goes to a
client, five distinct statements a calendar month, counted by client, period and currency, so
rebuilding one already in the register is free forever.</p>
<p>The invoice server has a second, narrower view: <code>overdue_report</code> lists unpaid invoices
past due with days overdue and outstanding totals per currency, and it is free too.</p>

<h2>The letter</h2>
<pre class="prompt">Draft a firm chaser to Acme for the two invoices in the 31 to 60 bucket.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>dunning_text</code>. Friendly and firm are free. The level 3 final demand is Pro, along with
the A4 statement PDF and <code>statements_report</code>, which ranks every client by what is overdue
rather than by what is large and names the oldest overdue invoice in the whole book.</p>

<h2>The document that ends the argument</h2>
<pre class="prompt">Build Acme's statement of account for the year to date and give me the text version.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>statement_build</code> then <code>statement_text</code>. A statement is not an invoice
reprint: it is opening balance, everything invoiced, everything paid, everything credited, closing
balance. In the recorded run in <code>docs/USER_VALUE_R27.md</code> that came to opening 0.00,
invoiced 1,107.00, paid 500.00, credited 110.70, closing <strong>EUR 496.30</strong>.</p>
<p>Note what that closing balance did that nothing else in the run managed: it netted a credit note
the invoice store could not see. <code>deposit_apply</code> in the same run reported EUR 607.00 for
the same client. The document you send is right where the mid-month balance question is not, and that
gap is recorded as open defect D-R96 rather than left for a client to find.</p>

<h2>Before you send it</h2>
<p>Check the invoice was actually receivable. A missing address in the BILL TO block, a wrong VAT id
or a due date the client never agreed to are all reasons a chaser gets ignored rather than paid.
<code>invoice_get</code> returns the full stored record for one number, and
<code>client_add</code> fills in an address on a client that was created from a bare name.</p>
${FOOT}`,
    faq: [
      { q: "Does it send the email?", a: "No. It writes the text and you send it. There is no mail integration and no network call anywhere in this server, which also means no chaser goes out because a model decided it should." },
      { q: "What counts as a distinct statement against the free cap of five?", a: "A combination of client, period and currency. Rebuilding a statement already in the register costs nothing on any tier, so regenerating the same document after a payment lands is free. Five genuinely different statements a calendar month is the limit." },
      { q: "Can I age as at a past date?", a: "Yes, statement_aging takes the as-at date. Ageing as at the last day of a quarter is the usual reason, and it produces different buckets from ageing today, which is the point." },
      { q: "Which tools here are free?", a: "statement_aging for everyone, statement_text, dunning_text at friendly and firm, and the invoice server's overdue_report. Pro buys the PDF on your invoice layout, the final demand, and statements_report across all clients. Figures from data/facts.json." },
    ],
  },
  "price-a-job-with-a-rate-card-and-a-change-order": {
    title: "Pricing a job from a rate card, and what to do when the scope changes",
    description: "Keep one price list the quote and the invoice both read, then handle scope changes as documents with a running contract value instead of an argument.",
    html: `<h1>One rate card, and a paper trail when the job grows</h1>
<p>Two problems here and they are the same problem. Prices typed fresh into every quote drift, and
scope that changes in a phone call does not appear on the invoice. Both are fixed by writing it down
once in a place the other servers can read.</p>

<h2>The price list</h2>
<pre class="prompt">Set a SKU: DEV-HOUR, senior development hour, 90 EUR. And DESIGN-HOUR at 75 EUR.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>sku_set</code> on the catalogue server. <code>lines_resolve</code> is what the quote and the
invoice call to turn a code and a quantity into a priced line, and it is free on every tier, along
with <code>price_list_text</code> and every other text answer. Withholding resolution would withhold
the one thing the sibling servers came for.</p>
<p>Free is 25 SKUs, the one standard price tier, and unlimited rate cards. Pro adds price tiers, so
trade and wholesale are a second column rather than a second catalogue, plus the A4 price list PDF and
a report of which rows a later row already replaces.</p>
<p>One behaviour worth knowing: <code>sku_delete</code> is free on every tier, and a code that has
already priced a line, or that a rate card points at, is refused by name with the number of times it
was used and the last resolution id. A code printed on a document you sent somebody is a fact about
that document, not a row you can quietly remove.</p>

<h2>The job</h2>
<pre class="prompt">Raise a work order for Acme: 12 DEV-HOUR and 4 DESIGN-HOUR, scheduled Thursday.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p>The work-order server prices the job the way the invoice will. Free holds five open work orders,
which is a one-van trade, with 200 lines each on every tier. The cap counts open jobs rather than jobs
ever raised, so finishing one frees its slot. The text completion report is free, because handing the
customer what was done is the thing the job was for.</p>

<h2>Then the scope changes</h2>
<pre class="prompt">Raise a change order against that job: 6 more DEV-HOUR, reason client added a second language.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p>The change-order server holds it as a document against the original quote or work order, with the
reason, the price delta and the client approval state. <code>contract_value</code> is free on every
tier and returns the running value derived from what the client actually approved, which is the
number the whole thing exists to produce.</p>
<p>Free is five open change orders, counted as the ones the client has not answered yet, so approving,
rejecting or voiding one frees its slot. Pro adds <code>change_order_document</code>, a plain-text
document with every line, its reason, the contract value before and after, and an approval block to
sign, plus <code>change_order_invoice_payload</code>, which hands the approved delta straight to
<code>invoice_create</code> with VAT at the profile rate and the rounding drift asserted to zero.</p>

<h2>A duplicate is refused before the cap</h2>
<p>On both the work-order and change-order servers, a byte-identical document is refused before the
free cap is consulted, and the refusal names the id already holding it rather than offering an
upgrade. It burns neither a slot nor a document number. The adversarial test suite asserts that the
refusal text does not contain the words "free tier", because a duplicate is one job filed twice far
more often than it is two jobs.</p>
<p>All free and Pro figures on this page are from <code>data/facts.json</code>. Tool counts from
<code>data/tools.json</code>: 12 on catalogue, 12 on work-order, 11 on change-order.</p>
${FOOT}`,
    faq: [
      { q: "Can the invoice read the price list directly?", a: "lines_resolve returns the priced lines and you pass them to invoice_create. There is no hidden coupling between the stores, which is deliberate: an invoice is a record of what you charged, and a price list that changed afterwards must not be able to rewrite it." },
      { q: "What happens to a SKU whose price changes?", a: "Set the new price and the newer row is what resolves from then on. Documents already issued keep the price they were issued at, because they hold resolved lines rather than a reference. catalogue_report on Pro lists which rows a later row already replaces." },
      { q: "Do I need the work-order server for desk work?", a: "No. It exists for jobs with a site, a schedule and a sign-off, which is trades and field work. For desk work the quote is the job document and change orders attach to the quote instead." },
      { q: "Why is contract_value free?", a: "Because the running value is the thing the change orders exist to answer, and withholding it would withhold the record rather than a convenience. The same reasoning puts trial_balance, statement_aging, loan_schedule and the petty cash reconcile on the free tier of their own servers." },
    ],
  },
  "set-a-freelance-hourly-rate-from-your-own-numbers": {
    title: "Working out your hourly rate from what you actually billed",
    description: "Three measurements you already have if you tracked time, what they mean together, and the honest reason no tool here computes a rate for you.",
    html: `<h1>Your hourly rate, from your own numbers</h1>
<p>The rate you quote and the rate you earn are different numbers, and the gap between them is made of
hours you tracked and never billed. If you have been tracking time, you can measure both today. There
is no calculator in this repository that will do it for you, because the inputs are judgement calls
and a tool that hides them behind a single figure would be lying about how confident it is.</p>

<h2>Measurement one: what you billed</h2>
<pre class="prompt">Give me invoice lines for Acme in August.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>invoice_summary</code> on the time tracker returns one line per task with hours, rate and
amount, plus a total. That total is billed revenue for the period. It is a Pro tool; the free
<code>report</code> gives you totals in hours and money over the last 7 days, which is enough to
sample a week and multiply.</p>

<h2>Measurement two: what you worked</h2>
<pre class="prompt">How many hours did I track last week across every project?</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>report</code> with no project filter. Compare it with measurement one. The difference is
unbilled time, and for most people it is between a fifth and a third of the week. Whatever it is for
you, it is the number that turns a 90 EUR quoted rate into something else entirely.</p>

<h2>Measurement three: what it cost you to work</h2>
<pre class="prompt">Expense summary for this month, grouped by category, excluding anything billable.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>expense_summary</code>. Exclude the billable ones, because those are pass-throughs, not the
cost of being in business. Software, hardware, the accountant, the desk. Free covers 30 days.</p>

<h2>Putting them together</h2>
<table>
<tr><th>Line</th><th>Where</th></tr>
<tr><td>Billed in the month</td><td>invoice_summary or report</td></tr>
<tr><td>less own costs</td><td>expense_summary, non-billable only</td></tr>
<tr><td>= what the month left you</td><td></td></tr>
<tr><td>divided by hours tracked</td><td>report, every project</td></tr>
<tr><td>= what an hour of work is actually worth</td><td></td></tr>
</table>
<p>Two things this leaves out on purpose. Tax, because it depends on your jurisdiction and your
structure and nothing here knows either. Unpaid invoices, because billed is not banked:
<code>statement_aging</code> tells you what is still outstanding, and a month with a large receivable
in it did not leave you what the arithmetic says.</p>

<h2>Making the next measurement easier</h2>
<p><code>project_set_rate</code> puts a rate on a project so every entry prices itself. On the free
tier two projects can carry rates, which covers the case where you want to compare your main client
against everything else. Set the rate before you track, not after: an entry priced at zero and
corrected later is a manual edit you will forget to make.</p>
<p>Free and Pro splits from <code>data/facts.json</code>. Eleven tools on the time tracker, counted
from <code>data/tools.json</code>.</p>
${FOOT}`,
    faq: [
      { q: "Why is invoice_summary a Pro tool when report is free?", a: "The free tier clamps every read to the last 7 days, and an invoice summary over 7 days is not useful for billing a month. Grouping by project, day and task, and the money arithmetic itself, are free. The stated split is in data/facts.json." },
      { q: "What is a realistic utilisation figure?", a: "This page will not invent one. Measure yours: tracked hours against billed hours for one month, from the two reports above. A figure you measured beats a benchmark somebody else's survey produced from a different market." },
      { q: "Should I track non-billable work?", a: "Track it, on a project called something like admin. Otherwise the tracked total is only the billable part and the utilisation measurement above cannot be made at all. Timers are unlimited on the free tier, so the extra project costs nothing except the rate slot, and admin does not need a rate." },
      { q: "Can it tell me what to charge?", a: "No, and nothing in this repository will claim to. What it can tell you is what you charged, what you worked and what it cost, which are the three facts every rate-setting method needs and most people are guessing at." },
    ],
  },
  "csv-to-excel-and-back-in-claude": {
    title: "Converting CSV to xlsx and back without opening Excel",
    description: "One tool call each way, what survives the round trip and what does not, the delimiter and header guessing that makes messy exports work, and the free row limits.",
    html: `<h1>CSV to xlsx and back, in one call</h1>
<pre class="prompt">Convert ~/Downloads/orders.csv to xlsx and save it next to the original.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>sheet_convert</code>. It reads xlsx, xlsm, xlsb, ods, csv and tsv, and writes the format you
ask for. The source is never overwritten unless you say so.</p>
<p>The other direction is the same call with the formats swapped, and it is the one that usually
matters, because most tools that want a data file want CSV and most people are sent xlsx.</p>

<h2>What survives, and what does not</h2>
<table>
<tr><th>Survives CSV to xlsx</th><th>Lost going xlsx to CSV</th></tr>
<tr><td>Every value, as text or number</td><td>Formulas, which become their last computed value</td></tr>
<tr><td>The header row</td><td>Formatting, colours, column widths</td></tr>
<tr><td>Row and column order</td><td>Every sheet but the one you converted</td></tr>
<tr><td>Unicode, including names with accents</td><td>Merged cells, which flatten</td></tr>
</table>
<p>None of that is a defect in the converter. CSV is a text format with no concept of a formula, a
second sheet or a colour, and a converter that pretended otherwise would be inventing data.</p>

<h2>The part that handles real exports</h2>
<p>Exports out of accounting software and bank portals are rarely clean. Two behaviours cover most of
it. The delimiter is sniffed, so a semicolon-separated European export is read correctly rather than
landing in one column. The header row is guessed, so a file with a title line, a blank line and then
the real headers is read from the right row instead of treating "Sales report Q3" as a column name.</p>
<p>Check what it found before you trust it:</p>
<pre class="prompt">Open orders.xlsx and tell me what is in it.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>sheet_info</code> returns the sheets, the dimensions and the header it detected. Thirty
seconds here saves a conversion that silently offset every row by one.</p>

<h2>Doing work in between</h2>
<p>Converting is rarely the actual goal. <code>sheet_query</code> filters, sorts and groups with a
safe expression language that does no eval, <code>sheet_add_column</code> writes a computed column
such as <code>[Qty] * [Unit Price]</code>, and <code>sheet_write</code> saves the result wherever you
name.</p>
<pre class="prompt">In orders.xlsx keep the open orders over 5 units, add a Total column of Qty times Unit Price, sort by Total descending and save it as orders-open.csv.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>

<h2>Free limits, and the one that matters</h2>
<p>Reading, querying, stats and find work on files up to 5,000 rows. Writes go up to 500 rows, and
never a partial file above that: a write that would exceed the limit is refused rather than producing
a truncated file that looks complete. That refusal is the important half. A silently truncated
spreadsheet is the kind of error that gets discovered by an accountant three months later.</p>
<p>Pro removes both limits. Figures from <code>data/facts.json</code>; there are 7 tools on this
server, counted from <code>data/tools.json</code>.</p>
${FOOT}`,
    faq: [
      { q: "Does it need Excel or LibreOffice installed?", a: "No. It parses and writes the formats directly in JavaScript. Nothing is launched, nothing is uploaded, and it runs the same on a machine that has never had an office suite on it." },
      { q: "Can it write multiple sheets into one xlsx?", a: "A conversion produces one sheet from one source. To assemble several, write each and combine them in a tool that does workbooks. What the server does well is the single-table case, which is what almost every data export actually is." },
      { q: "My CSV has European decimal commas.", a: "The delimiter sniffing handles the column separator. Decimal commas inside values are a separate question and depend on the file: check with sheet_info and a small sheet_read before converting a large file, because a value read as text rather than a number will sort and sum wrongly rather than error." },
      { q: "What happens to a file bigger than 5,000 rows on the free tier?", a: "The read is refused with the row count, rather than answering from the first 5,000. Refusing is the honest behaviour: an answer computed from part of a file is worse than no answer, because you cannot tell by looking that it happened." },
    ],
  },
  "answer-questions-about-a-spreadsheet-without-formulas": {
    title: "Asking a spreadsheet questions in plain language",
    description: "Filter, group and total a sheet by describing what you want, with a safe expression language that runs no eval, and the check that stops you trusting a wrong answer.",
    html: `<h1>Asking a spreadsheet a question</h1>
<pre class="prompt">In orders.xlsx, what did each region sell in Q3, totalled, sorted highest first?</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p>That is <code>sheet_query</code>: filters, sorts, group by, and sum, average, min and max per
group. No formula written, no pivot table built, and nothing typed into a cell.</p>

<h2>Why it is a safe expression language and not eval</h2>
<p>The filters and computed columns are parsed and evaluated by the server's own small expression
engine. It has no access to the filesystem, the network or the process, because there is no
<code>eval</code> and no shell anywhere in the path. A model that decides to filter on something
strange produces a wrong answer at worst, not a command that runs.</p>
<p>Column references are bracketed, so <code>[Qty] * [Unit Price]</code> is a computed column and
<code>[Status] = "open" and [Qty] &gt; 5</code> is a filter. That is the whole syntax you ever need to
know, and mostly you do not, because you describe what you want and the model writes it.</p>

<h2>The check to run first, every time</h2>
<pre class="prompt">Open orders.xlsx and tell me what is in it.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>sheet_info</code> returns the sheets, the dimensions and the header row it guessed. On an
export with a title line and a blank row above the real headers, the guess is doing real work, and it
is worth seeing what it decided before you build an answer on it. <code>sheet_stats</code> per column
is the second check: a numeric column that reports as text is the reason a total came back wrong.</p>

<h2>Finding one thing</h2>
<pre class="prompt">Find every row in clients.xlsx that mentions Beta GmbH.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>sheet_find</code> searches values across the sheet and returns the rows with their numbers,
so you can go and look at the source. It searches what is in the cells, not what a formula would have
produced elsewhere.</p>

<h2>Writing the answer back</h2>
<p><code>sheet_add_column</code> adds a computed column and <code>sheet_write</code> saves to a path
you name. The source is not overwritten unless you tell it to be, which is the default that stops a
question from destroying the file it was asked about.</p>

<h2>Free limits</h2>
<p>Read, query, stats and find on files up to 5,000 rows. Writes up to 500 rows, and never a partial
file above that: the write is refused rather than truncated. Pro removes both. From
<code>data/facts.json</code>.</p>
<p>Nothing is uploaded. The server works on the files you name and stores nothing else, which is the
practical difference from pasting a sheet into a chat window.</p>
${FOOT}`,
    faq: [
      { q: "Can it read a formula's result?", a: "It reads the cached value the file stores, which is what the formula last computed when the file was saved. It does not recalculate. A file saved by a tool that did not write cached values will read as blank in those cells, and sheet_info plus sheet_stats will show you that before you build on it." },
      { q: "Does it handle multiple sheets?", a: "sheet_info lists them and the read and query tools take a sheet name. Queries run against one sheet at a time; there is no join across sheets, which is a real limitation and not a temporary one." },
      { q: "Is my file uploaded anywhere?", a: "No. The server makes no network call of any kind. It opens the path you gave it, answers, and keeps a recent-files list and nothing else. That list is the only thing it stores." },
      { q: "How big can a file be?", a: "Free reads up to 5,000 rows and refuses above that with the row count rather than answering from a slice. Pro has no row limit, and the practical ceiling becomes memory. A 200,000-row file is a database question rather than a spreadsheet question." },
    ],
  },
  "combine-receipts-into-one-pdf-for-your-accountant": {
    title: "Merging a folder of receipts into one PDF from chat",
    description: "Merge, check the page count, stamp what is paid, and hand over a single file. Every step runs locally with no upload, and most of it is free.",
    html: `<h1>A folder of receipts, one PDF</h1>
<pre class="prompt">Merge every PDF in ~/Documents/receipts/august into one file called august-receipts.pdf.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>pdf_merge</code>. Free merges up to 5 files at a time, which for a month of receipts usually
means merging in batches and then merging the results, and that works because the output of a merge is
just another PDF. Pro removes the count.</p>

<h2>Check before you send</h2>
<pre class="prompt">How many pages is august-receipts.pdf and what is on the first one?</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>pdf_count</code> and <code>pdf_text</code>, both free and unmetered.
<code>pdf_text</code> pulls the text layer, which on a receipt printed to PDF is the whole receipt and
on a phone photo saved as PDF is nothing at all. If it comes back empty, that page is an image and no
text tool in this repository will read it: there is no OCR here, and there is not going to be a claim
that there is.</p>

<h2>Marking things up</h2>
<pre class="prompt">Stamp august-receipts.pdf as PAID.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>pdf_stamp</code> with PAID or DRAFT is free. Custom stamp text and colours, and the business
watermark, are Pro. Edits on the free tier work on files up to 30 pages.</p>

<h2>Splitting the other way</h2>
<p><code>pdf_split</code> takes one file apart, <code>pdf_pages</code> pulls out a range, and
<code>pdf_rotate</code> fixes the scan that came in sideways. Page reordering is Pro. The usual reason
to split is that a scanner produced one 40-page file containing eleven separate documents, and each
of them needs to go somewhere different.</p>

<h2>Nothing leaves the machine</h2>
<p>The PDF server is pure JavaScript with no network call at all. Receipts frequently carry a home
address, a card's last four digits and a client name, and an online merge tool sees all of it. This
one opens the paths you named and writes the file you asked for.</p>

<h2>Then send the whole month</h2>
<pre class="prompt">Zip the merged PDF and the CSV exports into accounts-august.zip.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p>The zip server packs a folder with a glob. Free is 20 archives a calendar month at up to 25 MB and
200 entries, and reading an archive is never metered on any tier. All figures on this page come from
<code>data/facts.json</code>; there are 10 tools on the PDF server, counted from
<code>data/tools.json</code>.</p>
${FOOT}`,
    faq: [
      { q: "Can it read a scanned receipt?", a: "Only if the scan carries a text layer, which many scanners add and phone cameras do not. pdf_text returns what is there and nothing when there is nothing. There is no OCR in this repository." },
      { q: "Does merging change the pages?", a: "No. The pages are copied as they are, in the order you named the files. Nothing is recompressed and no quality is lost, which also means the merged file is roughly the sum of the inputs in size." },
      { q: "What is the 30-page free limit exactly?", a: "It applies to edits: stamping, rotating, splitting. Info, page count, text extraction and merging up to 5 files are not affected by page count. The distinction is that reading a document is not metered and rewriting one is." },
      { q: "Can I do the same for images?", a: "The image server resizes, converts, compresses, crops and strips metadata, up to 4 megapixels and batches of 5 on free. Stripping metadata is the one to know about for receipts: a phone photo carries GPS coordinates until something removes them." },
    ],
  },
  "split-a-scanned-pdf-into-separate-documents": {
    title: "Splitting one big scan into separate documents",
    description: "Find the boundaries with the text layer, pull out page ranges, rotate the sideways ones, and name the results. What to do when the scan has no text at all.",
    html: `<h1>One 40-page scan, eleven documents</h1>
<p>A batch scanner produces one file. The documents inside it need to go to different places. Here is
the sequence that takes it apart without opening anything.</p>

<h2>1. Find out what is in there</h2>
<pre class="prompt">How many pages is scan-2026-09.pdf, and pull the text off each page.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>pdf_count</code> then <code>pdf_text</code>, both free and unmetered. The text layer is what
tells you where one invoice ends and the next begins, because every first page carries a document
number and a date and the continuation pages do not.</p>
<p>If <code>pdf_text</code> comes back empty, stop. The scan is images and there is no OCR in this
repository. The honest options are rescanning with text recognition on, or splitting by page number
after looking at the file yourself.</p>

<h2>2. Pull out the ranges</h2>
<pre class="prompt">Extract pages 1 to 3 of scan-2026-09.pdf as acme-invoice-0912.pdf.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>pdf_pages</code> for a range you name, <code>pdf_split</code> to break the file apart wholesale.
Free covers edits on files up to 30 pages, so a 40-page scan needs Pro, or a first split into halves
using page ranges, which is itself an edit and subject to the same limit. That is a real friction and
it is better said than discovered.</p>

<h2>3. Fix the ones that came in sideways</h2>
<pre class="prompt">Rotate page 4 of acme-invoice-0912.pdf 90 degrees clockwise.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>pdf_rotate</code>. Free. Page reordering is Pro.</p>

<h2>4. File them</h2>
<p>Once each document is its own file, the rest of the collection can take over. A supplier invoice
becomes a purchase order receipt with <code>purchase_order_receive</code> on the billing-docs server.
A receipt becomes an expense with <code>receipt_attach</code>, which stores the path and a sha256 of
the file so an audit can prove the document has not changed since you attached it. That hash is worth
knowing about: it is the difference between a receipt you filed and a receipt you can defend.</p>

<h2>What this cannot do</h2>
<p>It cannot tell you what a page says if the page is a photograph. It cannot find document boundaries
by looking at the layout. It cannot rename files from their contents on its own, although the model
reading <code>pdf_text</code> output can suggest names and you can accept them. Everything here works
on the text layer or on page numbers, and being clear about that is more useful than a claim that
would fail on the first sideways receipt.</p>
<p>Free and Pro figures from <code>data/facts.json</code>. Ten tools on the PDF server, from
<code>data/tools.json</code>.</p>
${FOOT}`,
    faq: [
      { q: "How do I know whether my scanner adds a text layer?", a: "Run pdf_text on one page. Text comes back, or nothing does. That takes one call and settles it, and it is free on every tier." },
      { q: "Can it split on a keyword rather than a page number?", a: "Not as one call. The model reads pdf_text, works out which pages start a new document, and then issues pdf_pages calls for each range. That is two steps rather than one and it works, provided there is a text layer." },
      { q: "Is the original modified?", a: "No. Every operation writes a new file at the path you name. The source is left as it was, which matters when the source is the only copy of something a client sent." },
      { q: "What about password-protected PDFs?", a: "A file that needs a password to open cannot be read, and the tool says so rather than returning empty pages. Remove the protection in whatever produced it first." },
    ],
  },
  "send-a-month-of-paperwork-as-one-zip": {
    title: "Sending a month of paperwork as one archive, safely",
    description: "Pack a folder with a glob, and check an archive somebody sent you before you unpack it: absolute paths, dot-dot entries, symlinks and the 200 MB file inside a 199 KB zip.",
    html: `<h1>A month of paperwork, one archive</h1>
<pre class="prompt">Zip everything in ~/Documents/accounts/2026-08 into august.zip, but leave out the drafts folder.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p>Packing takes a glob, so <code>**/*.pdf</code> or everything except a subfolder both work. Free is
20 archives a calendar month at up to 25 MB and 200 entries each. Pro removes all three.</p>

<h2>The half that matters more</h2>
<p>Reading an archive is never metered, on any tier. Neither are the guards. When somebody sends you a
zip:</p>
<pre class="prompt">What is inside invoices.zip? Do not unpack it yet.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>zip_list</code> tells you before anything touches your disk:</p>
<ul>
<li><strong>Absolute paths.</strong> An entry named <code>/etc/something</code> wants to write outside
where you unpacked it.</li>
<li><strong>Dot-dot entries.</strong> The classic traversal: <code>../../.ssh/authorized_keys</code>
looks harmless in a listing you never read.</li>
<li><strong>Symlinks.</strong> A link that points somewhere real turns a later write into a write to
that target.</li>
<li><strong>Duplicate names.</strong> Two entries with one name means whichever is extracted second
wins, and you cannot tell from the outside which that is.</li>
<li><strong>The compression ratio.</strong> An entry that claims 200 MB inside a 199 KB file is a zip
bomb, and it is reported as a number rather than discovered as a full disk.</li>
</ul>
<p>These checks run on every tier because a guard behind a paywall is not a guard.</p>

<h2>Reading one file out without unpacking</h2>
<pre class="prompt">Read the README out of that archive.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p><code>zip_extract_text</code> pulls one entry's text without writing anything to disk. Useful for
checking a manifest, and useful for the case where you want one file out of an archive of two hundred.
<code>zip_extract</code> unpacks properly when you have decided to.</p>

<h2>A realistic accountant handover</h2>
<ol>
<li>Export expenses to CSV with <code>expense_export</code>, capped at 200 rows on free and never
partial.</li>
<li>Export the bank with <code>statement_export</code>.</li>
<li>Merge the receipts into one PDF with <code>pdf_merge</code>.</li>
<li>Zip the folder.</li>
</ol>
<p>Four calls, one file, and nothing uploaded at any step. The zip server makes no network call of any
kind, and neither do the three servers feeding it.</p>
<p>Free tiers from <code>data/facts.json</code>. Seven tools on this server, from
<code>data/tools.json</code>. Across all releases the packaged bundles have been downloaded 5,314
times, counted with
<code>gh api repos/theluckystrike/mcp-servers/releases --paginate</code> on 2026-09-07; zip.mcpb is
the single most downloaded of them at 50 in v0.20.0 alone.</p>
${FOOT}`,
    faq: [
      { q: "Does it handle rar or 7z?", a: "No, zip only. Those formats need their own decoders and neither ships here. An archive it cannot read is refused by name rather than half-read." },
      { q: "Can it password-protect an archive?", a: "No. Zip encryption comes in several incompatible flavours with a long history of weak ones, and shipping a checkbox that produces the weak kind would be worse than not offering it. Encrypt the file with a tool built for it if that is the requirement." },
      { q: "What counts against the 20 archives a month?", a: "Creating one. Listing, extracting text and extracting files are unlimited on every tier, as are all the safety checks. So receiving and inspecting archives never runs out; only making them does." },
      { q: "What happens at the 25 MB free limit?", a: "The archive is refused with the size, rather than produced and truncated. The same principle runs through this collection: a partial file that looks complete is the worst possible output, so the servers refuse instead." },
    ],
  },
  "mcp-servers-in-vs-code-copilot-agent-mode": {
    title: "MCP servers in VS Code: the one-word mistake that breaks every config",
    description: "The key is servers, not mcpServers. Plus where the file goes, the trust prompt, the inputs array for secrets, and the newer Agent Host that reads a different file.",
    html: `<h1>MCP servers in VS Code</h1>
<p>The top-level key is <code>servers</code>. Every other client here uses <code>mcpServers</code>. A
config pasted from a Claude Desktop or Cursor README parses as valid JSON, contributes zero servers,
and gives you no error to read. It is the most expensive one-word mistake in this whole area.</p>

<h2>The file</h2>
<table>
<tr><th>This workspace</th><td><code>&lt;workspace&gt;/.vscode/mcp.json</code></td></tr>
<tr><th>Every workspace</th><td>The user profile mcp.json, opened by the <strong>MCP: Open User Configuration</strong> command</td></tr>
</table>
<pre><code>{
  "servers": {
    "spreadsheet": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/Users/you/mcp-servers/servers/spreadsheet/dist/index.js"]
    }
  }
}</code></pre>
<p><strong>MCP: Add Server</strong> in the command palette walks through it and asks whether the
target is Workspace or Global, which is less error-prone than writing the file.
<strong>MCP: List Servers</strong> shows the state of each entry, and is where you look when tools do
not appear.</p>

<h2>The trust prompt</h2>
<p>VS Code asks you to confirm you trust the server and its capabilities before it starts. Nothing
runs until you answer. If a server seems to be doing nothing at all, check for an unanswered prompt
before you check anything else.</p>

<h2>Secrets</h2>
<p>An <code>inputs</code> array holds them, referenced from a server entry as
<code>{input:id}</code> with a dollar sign in front. That keeps a key out of a file you might commit.
For these servers the only variable that exists is <code>MCP_LICENSE_KEY</code>, and leaving it out is
what runs the free tier, so most people need no inputs array at all.</p>
<p>One platform note from the documentation: <code>"sandboxEnabled": true</code> is macOS and Linux
only.</p>

<h2>The newer Agent Host</h2>
<p>It reads a workspace <code>.mcp.json</code> rather than <code>.vscode/mcp.json</code>. If you are
in it, the file you carefully edited is not the file being read, and there is no message saying so.
Check which one you are running before debugging the config.</p>

<h2>Something to do once it works</h2>
<pre class="prompt">Open orders.xlsx and show me the open orders over 5 units, sorted by amount.</pre>
<p class="muted">Paste this into Claude with the server connected.</p>
<p>The spreadsheet server reads xlsx, xlsm, xlsb, ods, csv and tsv, guesses the header row on messy
exports, and answers with a safe expression language that runs no eval. Free covers read, query, stats
and find on files up to 5,000 rows, and writes up to 500 rows with a refusal rather than a truncated
file above that. From <code>data/facts.json</code>.</p>
<p>Per-server VS Code pages with the exact block for each of the 30 servers are under
<a href="/setup/vscode">setup/vscode</a>. The client facts on this page were read off the VS Code
documentation on 2026-09-02 and are recorded with their source URL in
<code>billing/src/setup.js</code>.</p>
${FOOT}`,
    faq: [
      { q: "Workspace file or user file?", a: "Workspace when the server is part of how this repository is worked on and you want it committed. User when it is your own tooling and you want it everywhere. Both are read." },
      { q: "MCP: List Servers shows my server as stopped.", a: "Either the trust prompt is unanswered, or the process exited. Run the same command and args in a terminal: a server that starts prints a banner and waits, and one that exits shows you the reason on stderr. With these servers the usual cause is a dist directory that was never built." },
      { q: "Does GitHub Copilot need to be configured separately?", a: "The MCP configuration is at the editor level rather than per chat participant. What varies by client is whether agent-style tool calling is available in the mode you are in, so check the mode you are chatting in if the server is running and the tools are still not offered." },
      { q: "Can I use a remote server URL instead?", a: "Yes, and it avoids the build step entirely. mcp/connect on this site mints a free anonymous token and prints an HTTPS URL per server, with the token already in the path so there is no header to configure." },
    ],
  },
  "mcp-servers-in-windsurf-and-cline": {
    title: "MCP servers in Windsurf and Cline: two defaults that waste an afternoon",
    description: "Windsurf's config applies to the legacy Cascade agent only and caps tools at 100. Cline falls back to the legacy SSE transport when type is omitted. Both fail quietly.",
    html: `<h1>Windsurf and Cline</h1>
<p>Both work. Both have one non-obvious default that produces a correct-looking config doing nothing,
and neither tells you.</p>

<h2>Windsurf: the file applies to the legacy agent</h2>
<p>The file is <code>~/.codeium/windsurf/mcp_config.json</code> on macOS, Windows and Linux, with
<code>mcpServers</code> as the key. Reach it from the MCPs icon at the top right of the Cascade panel,
or Devin Settings, Cascade, MCP Servers. The documentation now lives under the Devin Desktop product
name and the Windsurf docs URL redirects there.</p>
<p>Here is the catch. <code>mcp_config.json</code> applies to the legacy Cascade agent only. The Devin
Local agent, which is the default for new tabs, takes its servers from the Devin CLI config files
instead. So a perfectly correct entry in this file can be entirely invisible in a fresh tab, with no
error anywhere.</p>
<p>The second hard number is a ceiling: Cascade reaches at most 100 tools at once, and every enabled
server spends from it. That matters here specifically, because the office-suite bundle in this
repository exposes every child server's tools through one connection. One <code>tools/list</code>
against a built v0.20.0 bundle on 2026-09-07 returned <strong>292 tools from 31 child
servers</strong>. In Windsurf that one entry is nearly three times the ceiling on its own. Install
the two or three servers you actually use.</p>
<pre><code>{
  "mcpServers": {
    "invoice": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/Users/you/mcp-servers/servers/invoice/dist/index.js"]
    }
  }
}</code></pre>
<p>Windsurf also documents an install deeplink of its own,
<code>windsurf://windsurf-mcp-registry?serverName=&lt;server-name&gt;</code>.</p>

<h2>Cline: type selects the transport, and omitting it picks the old one</h2>
<p>Cline is the one client here with an unsafe transport default. <code>type</code> selects the
transport, and leaving it out falls back to the legacy SSE transport. Point a streamable HTTP endpoint
at it without <code>type</code> and you will spend an afternoon debugging a server that is fine.</p>
<pre><code>{
  "mcpServers": {
    "invoice": {
      "type": "streamableHttp",
      "url": "https://mcp.zovo.one/mcp/invoice/t/YOUR_TOKEN"
    }
  }
}</code></pre>
<p>For a local server, <code>~/.cline/mcp.json</code> for the CLI. The editor extension keeps its
settings JSON reachable from the panel rather than by path: the MCP Servers icon in the top toolbar,
the Configure tab, then Configure MCP Servers near the bottom. From a terminal,
<code>cline mcp</code> opens an interactive wizard and <code>cline config mcp --json</code> reads or
writes the same thing non-interactively.</p>
<p>Local entries also carry <code>disabled</code> and an <code>autoApprove</code> array. The second
one is worth setting deliberately: it decides which tools run without asking you first.</p>
<p>No full-app restart in Cline. The MCP settings actions include restarting an unresponsive server
if its tools do not appear.</p>

<h2>Where the URLs come from</h2>
<p><a href="/mcp/connect">mcp/connect</a> mints a free anonymous token and prints a ready URL per
server, token already in the path. Free terms are stated there: 600 calls an hour, free-tier server
limits, and a data space kept 30 days and refreshed for another 30 on every write.</p>
<p>Client facts on this page were read off each client's own documentation on 2026-09-02 and are
recorded with their source URLs in <code>billing/src/setup.js</code>. Per-server pages are under
<a href="/setup/windsurf">setup/windsurf</a> and <a href="/setup/cline">setup/cline</a>.</p>
${FOOT}`,
    faq: [
      { q: "Which Windsurf agent am I in?", a: "New tabs default to the Devin Local agent, and Cascade is the legacy one that reads mcp_config.json. If the file is correct and the tools are absent in a fresh tab, that is the first thing to check rather than the last." },
      { q: "How do I stay under Windsurf's 100-tool ceiling?", a: "Count what you have enabled. The servers in this repository run from 6 tools on per-diem and asset-register to 15 on kanban, counted in data/tools.json, so three or four servers is comfortable and the 292-tool office-suite bundle is not." },
      { q: "What is autoApprove for?", a: "A per-server list of tool names Cline may call without asking. Read-only tools are reasonable candidates. Anything that writes a file, issues a document or spends a free-tier slot is worth leaving off it, because the point of the prompt is that you see the call before it happens." },
      { q: "Does Cline support stdio servers?", a: "Yes, with command and args like every other client, and an env object next to command. type matters most for remote servers, where the fallback to legacy SSE is what bites." },
    ],
  },
  "local-mcp-servers-versus-hosted-connectors": {
    title: "Local MCP server or hosted URL: which one, and what you give up",
    description: "The same servers run both ways here. A straight comparison of what each can reach, what each costs you, and the cases where only one of them is defensible.",
    html: `<h1>Local server or hosted URL</h1>
<p>Every server in this repository runs both ways: as a local process your client starts, and as an
HTTPS endpoint you paste a URL for. They are the same code. What differs is what each can reach and
who sees the data.</p>

<table>
<tr><th></th><th>Local (stdio)</th><th>Hosted (HTTPS)</th></tr>
<tr><td>Install</td><td>.mcpb bundle, or clone and build</td><td>Nothing. Paste a URL.</td></tr>
<tr><td>Reads your files</td><td>Yes, any path you name</td><td>No. It cannot see your disk.</td></tr>
<tr><td>Data lives</td><td>~/.local/share/mcp-servers/, plain JSON</td><td>On the server, keyed to your token</td></tr>
<tr><td>Network calls</td><td>None, for 28 of the 30 servers</td><td>Every call, by definition</td></tr>
<tr><td>Rate limit</td><td>None</td><td>600 calls an hour on the free anonymous token</td></tr>
<tr><td>Retention</td><td>Until you delete the folder</td><td>30 days, refreshed for another 30 on every write</td></tr>
<tr><td>Works in claude.ai</td><td>No</td><td>Yes</td></tr>
<tr><td>Works offline</td><td>Yes</td><td>No</td></tr>
</table>

<h2>The row that decides it</h2>
<p>Reading your files. The spreadsheet, PDF, image and zip servers exist to work on files on your
disk, and a hosted endpoint cannot see your disk. Nothing about that is a limitation to be engineered
away: it is what remote means. If your task starts with a file path, it has to run locally.</p>
<p>The record-keeping servers are the opposite case. The invoice, quotes, deposits, statement,
time-tracker and expense servers hold their own data, so a hosted install of those is genuinely usable
from a browser with nothing installed at all.</p>

<h2>What the hosted token is</h2>
<p>Open <a href="/mcp/connect">mcp/connect</a> and it mints one, in the form
<code>anon_</code> plus 32 hex characters, and prints a ready URL per server with the token in the
path. There is no header to configure and no sign-up. Two things that page states plainly and this one
repeats: anyone holding the URL holds that data space, so treat it as a secret; and reloading the page
mints a new token and a new empty space, so keep the URL if you want to keep the data.</p>

<h2>What local costs you</h2>
<p>A build step, today. The npm packages are not published: a probe of
<code>registry.npmjs.org</code> on 2026-09-07 returned no versions for the packages, matching the npm
status section of the repository README. So it is the <code>.mcpb</code> bundle, which is a double
click in Claude Desktop and needs no terminal, or a clone and <code>npm run build</code>. Once built
there is no update mechanism beyond pulling and rebuilding.</p>

<h2>The two commands, side by side</h2>
<pre><code># local: a process your client starts
claude mcp add --scope user invoice -- \
  node /absolute/path/to/mcp-servers/servers/invoice/dist/index.js

# hosted: a URL, nothing installed
claude mcp add --transport http invoice \
  https://mcp.zovo.one/mcp/invoice/t/YOUR_TOKEN</code></pre>
<p>Same server, same tools, same free tier. The first can open a file on your disk and the second
cannot.</p>

<h2>Both at once</h2>
<p>You can, and they are separate data spaces. An invoice created locally is not visible through the
hosted URL and there is no sync between them. Pick one per server and stay with it, or you will be
looking for a document in the wrong store.</p>

<h2>The licence works in both</h2>
<p>A Pro key is an Ed25519 signature verified locally inside the server, with no activation server to
reach. That means an air-gapped local install activates from the key string alone, and the hosted
endpoints accept the same key in place of the anonymous token. One purchase, either deployment.</p>
${FOOT}`,
    faq: [
      { q: "Is the hosted version slower?", a: "It adds a network round trip per tool call, which is real but small next to the model's own latency. A scored nine-step run against the local stdio bundle took 17 tool calls in 118.6 seconds, recorded in docs/USER_VALUE_R27.md, and almost all of that time was the model rather than the servers." },
      { q: "What happens after 30 days?", a: "The data space expires. Every write refreshes it for another 30 days, so an actively used token does not lapse. A token you used once in March is gone by May, deliberately: the alternative is holding strangers' invoice data forever." },
      { q: "Can I move data from hosted to local?", a: "Use the export tools. expense_export, statement_export, export_csv on the time tracker and ledger_export_csv all produce text you can carry across. There is no store-level migration, and the export path is the honest one because it produces something you can read and check." },
      { q: "Which is more private?", a: "Local, without qualification. 28 of the 30 servers make no network call at all, and you can prove it by running one in a network namespace with no interfaces and watching every tool still answer. A hosted server necessarily sees what you send it, and no policy statement changes that." },
    ],
  },
  "free-mcp-servers-for-freelancers": {
    title: "What these 30 MCP servers actually do on the free tier",
    description: "The free tier per server, with the specific limit rather than the word free, and the five tools that are unlimited on every tier because metering them would be dishonest.",
    html: `<h1>What the free tier really gives you</h1>
<p>Free tier is a word people use to mean anything from a full product to a countdown. Here is the
actual limit for each server, taken from <code>data/facts.json</code> in the repository. No account,
no login, no key: leave <code>MCP_LICENSE_KEY</code> unset and this is what runs.</p>
<pre><code>claude mcp add --scope user time-tracker -- \
  node /absolute/path/to/mcp-servers/servers/time-tracker/dist/index.js</code></pre>
<p>No key on that line, so the free tier is what starts. <code>license_status</code> on any server
reports which mode it is in if you want it confirmed rather than assumed.</p>

<h2>Unlimited on every tier, deliberately</h2>
<p>Five tools are never metered, and the reasoning is written into each server's own material.</p>
<table>
<tr><td><code>statement_aging</code></td><td>Who owes me money is the question that server exists for.</td></tr>
<tr><td><code>trial_balance</code></td><td>Whether the books add up is the question that server exists for.</td></tr>
<tr><td><code>loan_schedule</code></td><td>The payment and the interest are the answer, not the teaser.</td></tr>
<tr><td><code>perdiem_calc</code></td><td>The tables are public regulation. Metering the reading of a regulation is charging for the tax authority's work.</td></tr>
<tr><td><code>reconcile</code> (petty cash)</td><td>Whether the cash matches the paperwork is the whole point of a float.</td></tr>
</table>
<p>The same principle puts <code>contract_value</code>, <code>asset_schedule</code>,
<code>lines_resolve</code>, <code>overdue_report</code> and every zip safety check on the free tier
too.</p>

<h2>The limits, server by server</h2>
<table>
<tr><th>Server</th><th>Free tier</th></tr>
<tr><td>time-tracker</td><td>Unlimited timers and entries; reads cover the last 7 days; 2 rated projects</td></tr>
<tr><td>invoice</td><td>3 invoices a calendar month; overdue report free; small PDF footer</td></tr>
<tr><td>expense-tracker</td><td>Unlimited logging; reads cover 30 days; 3 projects, 5 rules, 200-row CSV</td></tr>
<tr><td>spreadsheet</td><td>Read and query files up to 5,000 rows; writes up to 500</td></tr>
<tr><td>quotes</td><td>5 open quotes; unlimited text quotes, accept, decline, revise</td></tr>
<tr><td>pdf</td><td>Merge up to 5 files; edits on files up to 30 pages; PAID and DRAFT stamps</td></tr>
<tr><td>bank-statement</td><td>2 accounts, 12 months, 5 rules; reconcile 31 days at a time</td></tr>
<tr><td>kanban</td><td>3 projects, 200 open tasks</td></tr>
<tr><td>zip</td><td>20 archives a month, 25 MB, 200 entries; reading never metered</td></tr>
<tr><td>image</td><td>Images up to 4 megapixels, batches of 5</td></tr>
<tr><td>currency</td><td>Latest rates and conversion; history up to 90 days</td></tr>
<tr><td>docx</td><td>Unlimited create and read; 3 proposals or contracts a month</td></tr>
<tr><td>timezone</td><td>Slots for up to 3 participants over 5 days; 5 contacts; 3 ics a month</td></tr>
<tr><td>calendar</td><td>2 calendars, windows up to 31 days, exports up to 50 events</td></tr>
<tr><td>resume</td><td>Modern-style resume and exports; 3 cover letters a month</td></tr>
<tr><td>clauses</td><td>Starter set plus 10 own clauses; assemble up to 8</td></tr>
<tr><td>recurring</td><td>3 active schedules, 30-day view</td></tr>
<tr><td>price-tracker</td><td>Unlimited price checks; 3 watches, 30 observations each</td></tr>
<tr><td>barcode</td><td>20 codes a month, SVG at any size, every symbology</td></tr>
<tr><td>billing-docs</td><td>5 documents a month; text exports never metered</td></tr>
<tr><td>deposits</td><td>5 recorded a month; applying, refunds and balances unlimited</td></tr>
<tr><td>statement-of-account</td><td>5 distinct statements a month; aging and dunning free</td></tr>
<tr><td>per-diem</td><td>Rate lookups unlimited; 5 trips saved a month</td></tr>
<tr><td>asset-register</td><td>Schedules unlimited; 10 assets in the register</td></tr>
<tr><td>cash-book</td><td>Trial balance unlimited; 3 periods a month</td></tr>
<tr><td>amortization</td><td>Schedules unlimited; 3 loans held</td></tr>
<tr><td>petty-cash</td><td>Reconcile unlimited; 1 float, 20 vouchers a month</td></tr>
<tr><td>work-order</td><td>5 open work orders, 200 lines each</td></tr>
<tr><td>change-order</td><td>5 open change orders; contract value free</td></tr>
<tr><td>catalogue</td><td>25 SKUs, one price tier, unlimited rate cards and text answers</td></tr>
</table>

<h2>The pattern in the caps</h2>
<p>Look at what is metered. It is nearly always creating a document that goes to somebody else, or
holding more records than a one-person business holds. It is almost never reading back what you
already put in, and it is never a safety check. Where a cap counts open items rather than items ever
created, finishing one frees the slot, which is true on quotes, work orders and change orders.</p>
<p>A byte-identical duplicate is refused before the cap is consulted on several servers, so filing the
same thing twice by accident costs you nothing and the refusal names the id already holding it rather
than offering an upgrade.</p>

<h2>If you outgrow it</h2>
<p>19 dollars once for one server, 39 dollars once for all of them. One-time, not a subscription, and
the key is an Ed25519 signature the server verifies locally with no activation server to phone. Prices
from <code>data/facts.json</code>.</p>
${FOOT}`,
    faq: [
      { q: "Is there a trial that expires?", a: "No. There is no clock anywhere in these servers. The free tier is the free tier in month one and in month twelve, and an install with no key never stops working." },
      { q: "What happens when I hit a cap?", a: "The call is refused by name with the reason and the number. Nothing already created becomes unreachable: reads, lists, exports of existing records and every free tool keep working. The cap is on adding, not on reaching what you have." },
      { q: "Do the servers phone home to count usage?", a: "No. There is no network call in 28 of the 30 servers at all, and the two that make one fetch European Central Bank rates or a product page you named. Counters are local files. Deleting the data folder resets a monthly counter, which is a consequence of not having a server and is stated rather than hidden." },
      { q: "Can I try Pro before buying?", a: "There is no trial key. What there is instead is a free tier designed so the thing each server exists to answer is free: aging, trial balance, loan schedules, per diem calculation and the petty cash reconciliation are all unmetered on purpose. You can judge the answers before you pay for the documents." },
    ],
  },
  "choosing-an-mcp-server-for-invoicing": {
    title: "Choosing an MCP server for invoicing: the seven questions worth asking",
    description: "The registry holds 91 rows matching invoice. Here is what separates them, what to check before you install one, and an honest account of where this one sits.",
    html: `<h1>Choosing an invoicing MCP server</h1>
<p>The official MCP registry fills a whole page of 100 rows for <code>invoice</code> and reports a
cursor for more behind it, and returns 91 complete for <code>invoicing</code>. Both measured on
2026-09-07 with
<code>GET registry.modelcontextprotocol.io/v0/servers?search=&lt;token&gt;&amp;limit=100</code>,
reading <code>metadata.count</code> and <code>metadata.nextCursor</code>. That is a crowded token, and
most of the difference between those rows is not visible from a name.</p>
<p>Run it yourself before you install anything:</p>
<pre><code>curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=invoice&amp;limit=100" \
  | python3 -c "import sys,json;m=json.load(sys.stdin)['metadata'];print(m['count'], bool(m.get('nextCursor')))"</code></pre>
<p>A full page of 100 with a cursor means the number is a floor rather than a total.</p>
<p>Seven questions separate them. Ask them of anything, including this one.</p>

<h2>1. Does it need an account somewhere else?</h2>
<p>Many invoicing servers are API wrappers around a SaaS product. They are useful if you already pay
for that product and useless if you do not, and the README does not always lead with it. Look for an
API key in the config block. No key means no external account.</p>

<h2>2. Where does the money arithmetic happen?</h2>
<p>Floating point money is the classic defect and it survives testing, because it only shows up on
particular values. Ask whether amounts are held in integer minor units and whether each line is
rounded once before summing. In this one they are, so the printed total equals the sum of the printed
lines and there is no drift between the PDF and what the client pays.</p>

<h2>3. Can it put more than one tax rate on a document?</h2>
<p>A single invoice-level rate breaks the moment you have a zero-rated reverse charge line next to a
domestic one. Per-line rates with one tax line per distinct rate in the totals block is the shape that
survives a real client mix.</p>

<h2>4. Are invoice numbers allocated, or generated?</h2>
<p>A number derived from a timestamp or a hash is not a sequence, and most jurisdictions expect a
sequence with no gaps and no reuse. <code>INV-YYYY-NNNN</code> allocated in order, never reused, is
the answer to look for.</p>

<h2>5. Does the PDF go anywhere?</h2>
<p>Rendering server-side means your client list and your rates went to somebody's machine. Local
rendering means they did not. This one renders with pdfkit in-process and makes no network call at
all.</p>

<h2>6. What happens when you hit the free limit?</h2>
<p>The failure mode matters more than the number. A cap that locks you out of invoices you already
created is a hostage situation. Here the cap is 3 new invoices a calendar month; lists, PDFs of
existing invoices and the overdue report keep working.</p>

<h2>7. Is there anything to read about how it fails?</h2>
<p>A project that publishes its defects is telling you it looked. This repository records
<code>docs/USER_VALUE_R27.md</code> with two open defects named in it, D-R95 where a hand-written
<code>vat_rate</code> silently produced a zero-VAT invoice, and D-R96 where <code>invoice_get</code>
reported a balance that ignored a credit note. Both are written down rather than waiting to be found.
The test suite is 1,518 tests with 1,507 passing, 0 failing and 11 skipped at release v0.20.0, from
<code>data/tests.json</code>.</p>

<h2>Where this one is weak</h2>
<p>It is a fair question and the answer should not be nothing. There is no VAT id validation, because
the server makes no network calls. There is no OCR, so a supplier invoice arrives as a PDF and leaves
as a PDF. One invoice carries one currency, and a mix is refused rather than converted. The npm
packages are not published yet, so installing means a bundle or a build. And it does not decide
whether reverse charge applies to your sale; you decide and it prints what you decided.</p>
<p>Product page: <a href="/s/invoice">MCP Invoice</a>. The full comparison against other named
servers is at <a href="/compare/invoice">compare/invoice</a>.</p>
${FOOT}`,
    faq: [
      { q: "How do I check how crowded a token is myself?", a: "curl the registry servers endpoint with search=<token> and limit=100, then read metadata.count and metadata.nextCursor. A full page with a cursor means the count is a floor, not a total. Search is a substring match on the name only, not on descriptions, so a count also includes accidental matches and is an upper bound on real competitors." },
      { q: "Does a high count mean avoid the category?", a: "For picking a server, no: it means read carefully. For building one, it is a real signal, and it is exactly how the server choices in this repository were made. data/intel_r13.json records 30 tokens probed with their counts and a build or no-build decision against a stated rule." },
      { q: "What should I install first to try one out?", a: "Whatever answers a question you have today. For invoicing, set the business profile and issue one real invoice for a client you actually have. Three a month is free, which is enough to find out whether the PDF is good enough to send before anything is paid." },
      { q: "Is a local server slower than a hosted one?", a: "Faster, usually, because there is no network round trip. The cost of local is the install; the cost of hosted is that it cannot see your files and it can see your data." },
    ],
  },
  "do-you-need-an-mcp-server-or-just-a-prompt": {
    title: "When you need an MCP server, and when a prompt is enough",
    description: "Four tests that decide it. Most tasks people reach for a server for are prompt-shaped, and installing one for those makes the answer worse rather than better.",
    html: `<h1>Server or prompt</h1>
<p>Adding an MCP server costs you a config entry, a process, some of your client's tool budget, and a
new place for something to go wrong. Sometimes that is obviously worth it. Often the task is
prompt-shaped and a server makes the answer worse. Four tests decide it.</p>

<h2>1. Does it need to remember?</h2>
<p>A conversation forgets. If the task is "what did I bill Acme in August", something has to have been
recording since August, and no prompt can produce that after the fact. Timers, invoices, expenses,
deposits and ledgers are all this shape. Anything where the value is in the accumulated record needs a
server.</p>
<p>If the task is "rewrite this paragraph", nothing needs to be remembered and a server adds
nothing.</p>

<h2>2. Does it have to be exactly right?</h2>
<p>A model doing arithmetic in prose is usually right and occasionally not, and you cannot tell which
from looking at the output. Money is the case where that is unacceptable. On this collection, amounts
are integer minor units, each line is rounded once and then summed, and the total of a report equals
the sum of the lines you can see. That is a property of the code, not of the model's attention that
day.</p>
<p>Ask: if this number were wrong by a cent, would anyone care? If yes, it belongs in code.</p>

<h2>3. Does it touch a file or a format?</h2>
<p>Reading an xlsx, merging PDFs, writing a real .docx, making a zip, generating a QR code. A model
can describe all of these and produce none of them. This is the clearest case for a server, and it is
also where a hosted endpoint fails, since a remote server cannot see your disk.</p>

<h2>4. Will you do it more than a handful of times?</h2>
<p>A one-off conversion is faster done by hand than by installing anything. The threshold is roughly
weekly. Below that, the install is the expensive part.</p>

<h2>What this means in practice</h2>
<table>
<tr><th>Task</th><th>Verdict</th></tr>
<tr><td>Draft a client email</td><td>Prompt</td></tr>
<tr><td>Summarise a document you pasted</td><td>Prompt</td></tr>
<tr><td>Work out what you billed last month</td><td>Server: it has to have been recording</td></tr>
<tr><td>Make an invoice PDF</td><td>Server: a model cannot produce a file</td></tr>
<tr><td>Decide what to charge a new client</td><td>Prompt, informed by a server's report</td></tr>
<tr><td>Read a 4,000-row spreadsheet</td><td>Server: pasting it costs more than it is worth</td></tr>
<tr><td>Convert 80 EUR to PLN</td><td>Server, if the rate has to be defensible; prompt if it does not</td></tr>
<tr><td>Rename some files</td><td>Neither. Use the shell.</td></tr>
</table>

<h2>The cost of installing too many</h2>
<p>Tool budgets are real. Windsurf's Cascade reaches at most 100 tools at once, and every enabled
server spends from it. The office-suite bundle here exposes every child at once, and one
<code>tools/list</code> against a built v0.20.0 bundle on 2026-09-07 returned <strong>292 tools from
31 child servers</strong>. That is convenient when you do not know in advance what you will need, and
it is over every client ceiling named on this site.</p>
<p>A model also chooses worse from a longer list. Two servers you use daily beat twenty you installed
because they were free. Count what you have before you add another:</p>
<pre><code>claude mcp list</code></pre>
<p>Every entry there is spending from your client's tool budget in every conversation, including the
ones where you needed none of them.</p>

<h2>How to decide in one minute</h2>
<p>Write down the question you actually have. If answering it requires a fact from before this
conversation, a file on your disk, or a number that has to be exact, install something. Otherwise, ask
the question.</p>
${FOOT}`,
    faq: [
      { q: "How many servers is too many?", a: "Count tools rather than servers. The ones here run from 6 tools on per-diem and asset-register to 15 on kanban, counted in data/tools.json. Three or four servers is comfortable in every client listed on the setup pages. The 292-tool office-suite bundle is not." },
      { q: "Can I install a server and only enable it sometimes?", a: "In most clients, yes. Cline has a disabled flag per server, VS Code lists servers so you can stop one, and Claude Code's local scope is per directory, so a server added in one project is absent in another. That last one is a feature once you know about it and a mystery until you do." },
      { q: "Does a server make the model smarter?", a: "No. It makes the model able to do things, and it makes certain answers exact rather than plausible. Those are different from being smarter and it is worth being clear about which one you needed." },
      { q: "What is the smallest useful setup?", a: "One server that answers a question you have weekly. For most freelancers that is the time tracker, because the record only exists if something was recording, and the free tier gives unlimited timers and entries with reads over the last 7 days." },
    ],
  },
  "mcp-client-config-file-locations": {
    title: "MCP config file locations and JSON keys, every client",
    description: "The file each MCP client reads, the top-level JSON key it expects, and the path on each operating system. Read off each vendor's own documentation on 2026-09-08 and dated.",
    html: `<h1>Where each MCP client keeps its config, and the key it expects</h1>
<p>Every row below was read off the client's own documentation on 2026-09-08. The source URL is in
the last column. Where a vendor publishes no path for an operating system, the cell says so rather
than guessing.</p>

<table>
<thead><tr><th>Client</th><th>File</th><th>Top-level key</th><th>Where</th><th>Source, read 2026-09-08</th></tr></thead>
<tbody>
<tr>
  <td>Claude Desktop</td>
  <td><code>claude_desktop_config.json</code></td>
  <td><code>mcpServers</code></td>
  <td>macOS <code>~/Library/Application Support/Claude/claude_desktop_config.json</code><br>Windows <code>%APPDATA%\\Claude\\claude_desktop_config.json</code><br>Linux: no path published</td>
  <td>modelcontextprotocol.io/docs/develop/connect-local-servers</td>
</tr>
<tr>
  <td>Claude Code</td>
  <td><code>.mcp.json</code> and <code>~/.claude.json</code></td>
  <td><code>mcpServers</code></td>
  <td>project scope: <code>.mcp.json</code> at the repository root<br>local and user scope: <code>~/.claude.json</code></td>
  <td>docs.claude.com/en/docs/claude-code/mcp</td>
</tr>
<tr>
  <td>Cursor</td>
  <td><code>mcp.json</code></td>
  <td><code>mcpServers</code></td>
  <td>this project: <code>.cursor/mcp.json</code><br>everywhere: <code>~/.cursor/mcp.json</code></td>
  <td>cursor.com/docs/context/mcp</td>
</tr>
<tr>
  <td>VS Code</td>
  <td><code>mcp.json</code></td>
  <td><strong><code>servers</code></strong></td>
  <td>workspace: <code>.vscode/mcp.json</code><br>user profile: opened by the <code>MCP: Open User Configuration</code> command, not documented as a path</td>
  <td>code.visualstudio.com/docs/copilot/customization/mcp-servers</td>
</tr>
<tr>
  <td>Windsurf, legacy Cascade agent</td>
  <td><code>mcp_config.json</code></td>
  <td><code>mcpServers</code></td>
  <td><code>~/.codeium/windsurf/mcp_config.json</code></td>
  <td>docs.devin.ai/desktop/cascade/mcp</td>
</tr>
<tr>
  <td>Cline</td>
  <td><code>mcp.json</code></td>
  <td><code>mcpServers</code></td>
  <td>CLI: <code>~/.cline/mcp.json</code><br>editor extension: reached from the panel, MCP Servers icon, Configure tab, Configure MCP Servers. No path is published for it.</td>
  <td>docs.cline.bot/mcp/mcp-overview</td>
</tr>
<tr>
  <td>Claude.ai and Claude Desktop connectors</td>
  <td>none</td>
  <td>none</td>
  <td>A form, not a file: Connectors, Add custom connector, then a name and a remote MCP server URL</td>
  <td>support.claude.com/en/articles/11175166</td>
</tr>
</tbody>
</table>

<h2>The one row that costs people an afternoon</h2>
<p>VS Code is the only client here whose top-level key is <code>servers</code>. Six of the seven use
<code>mcpServers</code>. A block copied from a Claude Desktop or Cursor README into
<code>.vscode/mcp.json</code> is valid JSON, contributes no servers, and produces no error message.</p>
<pre><code>{
  "servers": {
    "invoice": {
      "command": "node",
      "args": ["/Users/you/mcp-servers/servers/invoice/dist/index.js"]
    }
  }
}</code></pre>
<p>VS Code also accepts MCP servers in a dev container, under
<code>customizations.vscode.mcp.servers</code> in <code>devcontainer.json</code>, which is the same
key one level down.</p>

<h2>Home-relative paths and Windows</h2>
<p>Cursor, Windsurf and Cline document one path each, written home-relative with a tilde. That is the
path on every operating system they support; the tilde resolves to the user's home directory, which on
Windows is what <code>%USERPROFILE%</code> expands to. Only Claude Desktop publishes two genuinely
different strings, and it publishes none for Linux, because its documentation lists macOS and Windows
as the supported platforms.</p>

<h2>Where these paths are not the answer</h2>
<p>Two clients here have a second configuration surface that the file does not cover.</p>
<p>Windsurf's <code>mcp_config.json</code> applies to the legacy Cascade agent only. The Devin Local
agent, which is the default for new tabs, reads the Devin CLI config files instead, so a correct entry
in this file can be absent in a fresh tab.</p>
<p>Claude Code rarely wants the file edited by hand. <code>claude mcp add</code> writes it,
<code>claude mcp list</code> and <code>claude mcp get &lt;name&gt;</code> read it back with a health
check, and <code>claude mcp add-json &lt;name&gt; '&lt;json&gt;'</code> takes a whole config object.
Which file it writes depends on <code>--scope</code>, and the default is local.</p>

<h2>Checking a path rather than trusting one</h2>
<p>A reference table ages. These two commands do not:</p>
<pre><code>ls -l ~/Library/Application\\ Support/Claude/claude_desktop_config.json
python3 -c 'import json,sys;json.load(open(sys.argv[1]))' ~/.cursor/mcp.json</code></pre>
<p>The second one matters more than it looks. A trailing comma makes the whole file unparseable, and
most clients respond to an unparseable config by loading no servers at all rather than by telling you
which line is wrong.</p>

<p>This table exists because it is the data the 30 MCP servers on this site had to get right to ship a
per-client install page for each one. The per-client pages are under
<a href="/setup/claude-desktop">setup</a>, and the source rows with their caveats live in
<code>billing/src/setup.js</code> in the repository.</p>
${FOOT}`,
    faq: [
      { q: "Which clients use mcpServers and which use servers?", a: "Claude Desktop, Claude Code, Cursor, Windsurf and Cline use mcpServers. VS Code uses servers. That is the only split among the six file-based clients checked on 2026-09-08." },
      { q: "Is there a Linux path for Claude Desktop?", a: "None is published. The documentation at modelcontextprotocol.io names macOS and Windows as the platforms, and gives a path for each. Anything you find for Linux comes from a community build, not from the vendor." },
      { q: "Where is the VS Code user-level mcp.json?", a: "The documentation does not give a path for it. It gives a command instead: MCP: Open User Configuration from the command palette, which opens the file in the active profile. MCP: Open Workspace Folder Configuration opens the workspace one." },
      { q: "Do these files support environment variable expansion?", a: "It varies and it is worth checking before relying on it. Claude Code expands ${VAR} and ${VAR:-default} in command, args, env, url and headers. Cursor resolves ${env:NAME} and ${userHome} in command, args, env, url and headers. VS Code uses an inputs array and ${input:id} for secrets. Claude Desktop documents an env object with literal values." },
      { q: "Why does the same server need a different file in every client?", a: "Because the protocol standardises the wire, not the client. MCP defines how a client and a server talk once they are connected; where a client stores the list of servers to launch is a product decision each vendor made separately." },
    ],
  },
  "why-an-mcp-server-does-not-appear": {
    title: "Why an MCP server does not appear, in order of likelihood",
    description: "Twelve causes, each with the exact symptom it produces. Almost all of them fail silently, which is why the order matters more than the list.",
    html: `<h1>An MCP server that does not appear: the causes, in order</h1>
<p>Work down this list. It is ordered so that the checks which cost seconds come before the ones that
cost minutes, and each entry names the exact symptom, because nearly every failure here is silent.
A client that loads no servers looks identical to a client with no servers configured.</p>

<h2>1. The top-level key is wrong</h2>
<p><strong>Symptom:</strong> the file parses, the client starts, no server is listed, no error appears
anywhere.</p>
<p>VS Code expects <code>servers</code>. Claude Desktop, Claude Code, Cursor, Windsurf and Cline expect
<code>mcpServers</code>. A block copied from the wrong README is valid JSON that contributes nothing.
Full table at <a href="/guides/mcp-client-config-file-locations">MCP config file locations</a>.</p>

<h2>2. The file has a syntax error</h2>
<p><strong>Symptom:</strong> every server disappears at once, including ones that worked yesterday.</p>
<p>A trailing comma after the last entry is the usual cause. If the count went from three servers to
zero rather than from three to two, suspect the file rather than the entry you just added.</p>
<pre><code>python3 -c 'import json,sys;json.load(open(sys.argv[1]))' ~/.cursor/mcp.json</code></pre>

<h2>3. You are in a different directory than the one you added it in</h2>
<p><strong>Symptom:</strong> <code>claude mcp list</code> shows the server in one folder and not in
another.</p>
<p>Claude Code's default scope is <code>local</code>: private to you and to the directory you ran the
command in. <code>--scope user</code> makes it available in every project;
<code>--scope project</code> writes <code>.mcp.json</code> for the whole repository.</p>

<h2>4. The project server is waiting for approval</h2>
<p><strong>Symptom:</strong> Claude Code prints <code>⏸ Pending approval (run \`claude\` to approve)</code>
in <code>claude mcp list</code> and <code>claude mcp get &lt;name&gt;</code>.</p>
<p>A server defined in a repository's <code>.mcp.json</code> is not started until you approve it
interactively. That is deliberate: a cloned repository must not be able to run code on your machine by
committing a config file. As of Claude Code v2.1.196 the approval is read only from settings files that
are not checked into the repository, until you trust the workspace by running <code>claude</code> in it
and accepting the trust dialog.</p>

<h2>5. A remote server was written without a type</h2>
<p><strong>Symptom, Claude Code:</strong> a named error. An entry with a <code>url</code> and no
<code>type</code> is read as a stdio server, the server is skipped, and Claude Code reports that the
entry has a <code>url</code> but no type.</p>
<p><strong>Symptom, Cline:</strong> no error at all. Omitting <code>type</code> falls back to the
legacy SSE transport, so a streamable HTTP endpoint fails to connect while looking correctly
configured.</p>
<pre><code>{ "type": "http", "url": "https://example.com/mcp" }</code></pre>
<p>Claude Code accepts <code>streamable-http</code> as an alias for <code>http</code>, so a config
copied from a server's own documentation works unchanged.</p>

<h2>6. The command is not on the client's PATH</h2>
<p><strong>Symptom:</strong> <code>spawn npx ENOENT</code>, or <code>spawn node ENOENT</code>, in the
client's log. On Claude Desktop that is <code>~/Library/Logs/Claude/mcp-server-&lt;name&gt;.log</code>
on macOS and <code>%APPDATA%\\Claude\\logs</code> on Windows.</p>
<p>A stdio server launched by a desktop application inherits only a limited, platform-dependent subset
of environment variables, and that subset frequently does not include the PATH your shell has. If node
came from nvm or homebrew, paste what <code>which node</code> prints instead of the bare word. GitHub's
issue search returned 1,428 results for the exact phrase <code>"spawn npx ENOENT"</code> on 2026-09-08,
which is the single most common shape of this failure.</p>

<h2>7. The path is relative</h2>
<p><strong>Symptom:</strong> the same ENOENT, or a server that starts and immediately exits.</p>
<p>Claude Desktop's documentation requires every path in <code>claude_desktop_config.json</code> to be
absolute. The working directory a desktop client launches a subprocess from is not the one you think
it is.</p>

<h2>8. The client was not fully restarted</h2>
<p><strong>Symptom:</strong> the config is correct and the server list has not changed.</p>
<p>Claude Desktop needs a complete quit and relaunch; reloading the window is not enough. Claude Code
picks the entry up in the next session, and <code>/mcp</code> reconnects one on demand. Cline and
Windsurf refresh from their own panels without an application restart.</p>

<h2>9. You are in the wrong agent</h2>
<p><strong>Symptom:</strong> Windsurf shows the server in one tab and not in a new one.</p>
<p><code>~/.codeium/windsurf/mcp_config.json</code> applies to the legacy Cascade agent only. The Devin
Local agent, the default for new tabs, reads the Devin CLI config files instead.</p>

<h2>10. The tool ceiling is full</h2>
<p><strong>Symptom:</strong> the server connects, and some of its tools are missing.</p>
<p>Windsurf's Cascade reaches at most 100 tools at once and every enabled server spends from it. Claude
Code imposes no fixed per-server cap; its documentation says the practical limit is the context window
budget, and with tool search enabled only tool names and server instructions load at session start.</p>

<h2>11. The server writes something that is not MCP to stdout</h2>
<p><strong>Symptom:</strong> the connection drops during startup, sometimes with a JSON parse error in
the log.</p>
<p>The stdio binding is explicit: the server MUST NOT write anything to stdout that is not a valid MCP
message. A stray <code>console.log</code>, a banner, or a dependency's progress bar corrupts the
stream. Logging goes to stderr, which clients may capture, forward or ignore, and which the
specification says should not be read as an error signal on its own.</p>

<h2>12. Two definitions of the same server, and the other one won</h2>
<p><strong>Symptom:</strong> the server appears, and it is the wrong version of it.</p>
<p>Claude Code connects once, using the definition from the highest-precedence source, and does not
merge fields across scopes. The order is local, then project, then user, then plugin-provided servers,
then claude.ai connectors. Scopes match duplicates by name; plugins and connectors match by endpoint.</p>

<h2>What to run first</h2>
<pre><code>claude mcp list          # Claude Code, with a health check per server
/mcp                     # inside a session, shows what is connected
tail -f ~/Library/Logs/Claude/mcp.log     # Claude Desktop, macOS</code></pre>
<p>In Cursor, open the Output panel and select MCP Logs from the dropdown. In VS Code, run
<code>MCP: List Servers</code>. In Cline, the MCP settings actions include restarting an unresponsive
server.</p>

<p>Every symptom above came from the vendor's own documentation, read on 2026-09-08, or from the
stdio transport binding in the MCP specification revision 2026-07-28. The 30 servers published from
this repository hit most of them at least once while being packaged for six clients; the per-client
caveats are recorded with their source URLs in <code>billing/src/setup.js</code>.</p>
${FOOT}`,
    faq: [
      { q: "The client shows the server but no tools. What is that?", a: "Usually the server started and then failed during initialisation, or it is filling a tool ceiling. Read the per-server log first: on Claude Desktop, mcp-server-<name>.log holds the server's stderr, and a stdio server may use stderr for all of its logging, so that file is not limited to errors." },
      { q: "Why is there almost never an error message?", a: "Because most of these are not errors from the client's point of view. A config with the wrong top-level key is a valid config describing zero servers. A local-scope entry in another directory is correctly absent. The client is doing what it was told." },
      { q: "Does restarting the machine help?", a: "Only by accident, when it happens to reload a client that was holding a stale config. Nothing on this list is fixed by a reboot, and starting there costs you the two minutes in which the log would have told you the answer." },
      { q: "How do I tell a client problem from a server problem?", a: "Run the server yourself from a terminal with the exact command and arguments in the config. If it starts and speaks when you send it an initialize message, the problem is in the client's config or environment. If it does not, it is the server." },
    ],
  },
  "how-mcp-registry-search-works": {
    title: "How MCP registry search actually works, measured",
    description: "The official registry matches names only and sorts strict ASCII on the whole namespace and name. Your publisher namespace decides your rank, not your server's name. Measured live on 2026-09-08.",
    html: `<h1>Registry search sorts on your namespace, not your name</h1>
<p>The official MCP registry's <code>search=</code> parameter matches the server <em>name</em> only,
and returns matches in strict ASCII order on the whole <code>namespace/local-name</code> string. Your
namespace is the first thing compared, so it decides your position before any word you chose for the
server is looked at.</p>
<p>Here is the measurement. The same server, published under two namespaces on 2026-09-08:</p>
<table>
<thead><tr><th>Search token</th><th><code>com.bestremotetools/...</code></th><th><code>io.github.theluckystrike/...</code></th><th>Servers matching</th></tr></thead>
<tbody>
<tr><td><code>schedule</code></td><td><strong>3</strong></td><td>15</td><td>22</td></tr>
<tr><td><code>delivery</code></td><td><strong>2</strong></td><td>17</td><td>18</td></tr>
</tbody>
</table>
<p>Same code, same description, same local name. Twelve places on one token and fifteen on the other,
bought entirely by the two letters at the front of the namespace. Reproduce it:</p>
<pre><code>curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=schedule&amp;limit=100&amp;version=latest' \\
  | python3 -c 'import json,sys; [print(i,r["server"]["name"]) for i,r in enumerate(json.load(sys.stdin)["servers"],1)]'</code></pre>

<h2>How to prove the sort rather than assume it</h2>
<p>An ordering claim is testable in one line: read the names back and compare them to their own sorted
copy. On 2026-09-08 that returned <code>True</code> for every result set checked, including a
6,000-row full pagination of the whole registry.</p>
<pre><code>names == sorted(names)   # True on schedule, delivery, and 6,000 paginated rows</code></pre>
<p>Strict ASCII means uppercase sorts before lowercase, and digits before letters. It also means the
comparison never reaches your local name until the namespaces are equal.</p>

<h2>What that implies for a namespace</h2>
<p>Reversed-domain namespaces cluster by their first label. In a 6,000-row pagination on 2026-09-08 the
first label distribution was <code>ai</code> 3,853, <code>app</code> 1,204, <code>co</code> 349,
<code>cloud</code> 128, then a long tail. Sixty paginated calls of 100 rows each reached
<code>co.pipeboard/tiktok-ads-mcp</code> and the cursor was still set, so the registry never got past
the letter c.</p>
<p>So <code>io.github.&lt;user&gt;</code>, which is what the GitHub login flow grants and what most
first-time publishers use, sorts after every <code>ai.</code>, <code>app.</code>, <code>com.</code>,
<code>dev.</code> and <code>io.a</code> through <code>io.f</code> namespace that matches the same token.
On a token with more than about twenty matches, that is page two.</p>

<h2>Getting a namespace that is not io.github</h2>
<p>The registry derives your namespace from a domain you prove you control. Two methods are documented,
and both were run from this project:</p>
<ul>
<li><strong>DNS</strong>: <code>mcp-publisher login dns --domain &lt;domain&gt; --private-key &lt;hex&gt;</code>,
an ed25519 key proved by a TXT record.</li>
<li><strong>HTTP</strong>: <code>mcp-publisher login http --domain &lt;domain&gt; --private-key &lt;hex&gt;</code>,
the same key proved by serving one file at <code>/.well-known/mcp-registry-auth</code> whose body is
<code>v=MCPv1; k=ed25519; p=&lt;base64 public key&gt;</code>.</li>
</ul>
<p>The HTTP method needs no DNS credential at all, which matters if the account holding your domain
cannot mint a DNS-edit token. Serving that one static file from anything already attached to the
domain is enough. The granted token then carries a permission on
<code>&lt;reversed domain&gt;/*</code>, and everything you publish under it inherits the sort position
of that namespace.</p>

<h2>The trap in the row count</h2>
<p><code>/v0/servers</code> returns one row per published <em>version</em>, not one per server. The
token <code>schedule</code> returns 63 rows and 22 servers. Add <code>&amp;version=latest</code> to get
one row per server. Any count you quote without that parameter is a version count wearing a server
count's clothes.</p>

<h2>What this does not buy you</h2>
<p>Rank in a name-substring search is findability inside one directory, not demand. This project holds
85 active registry rows and the registry is the only channel that has demonstrably sent it humans:
9 of 22 unique visitors in fourteen days, measured in <code>data/traffic.json</code>. That is a real
channel and a small one. Ranking third instead of fifteenth multiplies a small number.</p>

<p>Everything above was measured against the live API on 2026-09-08 from this repository, which
publishes 30 MCP servers and used both login methods while working it out. The full working, including
the ranks the same servers took under six candidate namespaces, is in <code>docs/NAMESPACE_R1.md</code>.</p>
${FOOT}`,
    faq: [
      { q: "Does the registry search descriptions or keywords?", a: "Not through search=. It matches the name. A server whose description is a perfect answer to a query and whose name does not contain the token does not come back at all, which is why the local name still matters even though the namespace outranks it." },
      { q: "Can I change my namespace later?", a: "You can publish under a new one, but the old rows do not move. Publishing the whole catalogue twice puts your own entries in competition with each other in the same sorted list, so the safer move is one server under the new namespace, measured against the old row for the same server." },
      { q: "Why is version=latest not the default?", a: "The endpoint is a version log, not a catalogue. It is the right shape for a client resolving a specific version and the wrong shape for counting anything. One publisher in the sample had 739 version rows for a single server." },
      { q: "Is ASCII order the same as alphabetical?", a: "Close but not identical. Uppercase letters sort before all lowercase ones and digits sort before both, so a namespace starting with a digit or a capital would sort ahead of every lowercase one. Nothing stops that, and nobody appears to be doing it." },
      { q: "How many servers does a token typically match?", a: "It varies by two orders of magnitude. On 2026-09-08 delivery matched 18 servers and schedule 22, while invoice filled a page of 100 with the cursor still set. Check before you name anything: the count is one API call." },
    ],
  },
  "what-is-in-the-mcp-registry": {
    title: "What is actually in the MCP registry: 6,000 rows counted",
    description: "A full pagination of the official registry on 2026-09-08. One row per version not per server, hosted servers outnumbering installable ones six to one, and streamable HTTP at 29 times SSE.",
    html: `<h1>What a full pagination of the MCP registry returns</h1>
<p>Sixty paginated calls of 100 rows each against
<code>registry.modelcontextprotocol.io/v0/servers</code> on 2026-09-08 returned 6,000 rows containing
<strong>2,211 distinct servers</strong>. The cursor was still set at row 6,000, which stood at
<code>co.pipeboard/tiktok-ads-mcp</code>, so this is the first 6,000 rows in ASCII order and not the
whole registry. Every figure below describes that sample and says so.</p>

<h2>The first thing the numbers show</h2>
<p>Rows are versions. 6,000 rows, 2,211 names, and exactly 2,211 of those rows carry
<code>isLatest: true</code>. One server, <code>ai.bowmark/bowmark</code>, accounted for 739 rows on its
own: 739 distinct version strings from 1.0.0 to 8.99.1, which is 12.3 percent of the entire sample from
a single publisher republishing one server.</p>
<p>So any count taken off this endpoint without <code>&amp;version=latest</code> is inflated, and not
evenly: it is inflated by whoever has the busiest release pipeline.</p>

<h2>Hosted servers now outnumber installable ones</h2>
<p>Of the 2,211 latest rows:</p>
<table>
<thead><tr><th>Declares</th><th>Servers</th></tr></thead>
<tbody>
<tr><td>A remote endpoint (<code>remotes</code>)</td><td>1,985</td></tr>
<tr><td>An installable package (<code>packages</code>)</td><td>311</td></tr>
<tr><td>Both</td><td>97</td></tr>
<tr><td>Neither</td><td>12</td></tr>
</tbody>
</table>
<p>Six hosted servers for every installable one. That is a different registry from the one most
tutorials describe, where an MCP server is a local subprocess you launch with <code>npx</code>.</p>

<h2>Transport, and how dead SSE is</h2>
<p>Across the same 2,211 latest rows, the declared remote transports were <strong>streamable-http
1,986</strong> and <strong>sse 68</strong>. Streamable HTTP replaced HTTP+SSE in protocol version
2025-03-26, and the registry's own data now shows a 29 to 1 split. If you are building a remote server,
SSE is a compatibility path, not a choice.</p>

<h2>What people package, when they package</h2>
<table>
<thead><tr><th>Package registry</th><th>Servers (latest rows)</th></tr></thead>
<tbody>
<tr><td>npm</td><td>259</td></tr>
<tr><td>PyPI</td><td>41</td></tr>
<tr><td>OCI</td><td>15</td></tr>
<tr><td>mcpb</td><td>9</td></tr>
<tr><td>NuGet</td><td>1</td></tr>
</tbody>
</table>
<p>Nine servers in the sample declare an <code>mcpb</code> package, the one-click Claude Desktop bundle
format. That is 0.4 percent of the sample, against 1,985 that publish a URL.</p>

<h2>Concentration</h2>
<p>The 2,211 servers came from 1,539 distinct namespaces, so the median publisher has one server. The
concentration is at the top: <code>ai.smithery</code> held 213 distinct servers, <code>app.wishpool</code>
125 and <code>ai.getvda</code> 94. By row count rather than server count the picture inverts, because
of the republishing effect above: <code>ai.bowmark</code> 739 rows, <code>ai.smithery</code> 288,
<code>ai.intuitek.the-stall</code> 204.</p>

<h2>Deprecation</h2>
<p>18 of the 2,211 latest rows carry status <code>deprecated</code>, the rest <code>active</code>. The
registry marks them rather than removing them, so a client reading the list must filter, and a human
reading a directory built on this data may not be shown the flag at all.</p>

<h2>The sample is a prefix, and that matters</h2>
<p>Because results come back in strict ASCII order on the namespace, the first 6,000 rows are
namespaces <code>ac.</code> through <code>co.</code>. The first-label counts in the sample were
<code>ai</code> 3,853, <code>app</code> 1,204, <code>co</code> 349 and <code>cloud</code> 128. Any
namespace beginning <code>dev.</code>, <code>io.</code> or <code>me.</code> is absent from it entirely,
including every <code>io.github.*</code> server, which is what the GitHub login flow grants and what
most individual publishers use. So treat these ratios as describing commercially published servers, and
expect the <code>io.github</code> tail to be more package-shaped and less hosted.</p>

<h2>Reproducing it</h2>
<pre><code>curl -s 'https://registry.modelcontextprotocol.io/v0/servers?limit=100' | jq '.metadata'
# {"nextCursor": "...", "count": 100}
# follow nextCursor until it is absent; add &version=latest for one row per server</code></pre>
<p>Two things to know before you spend the calls. <code>metadata.count</code> is the size of the page
you were handed, not a total, so a count of 100 with a cursor set is a floor. And there is no totals
endpoint: <code>/v0/stats</code> returns 404 and <code>/v0/health</code> returns only a status and a
GitHub client id, both checked on 2026-09-08.</p>

<p>This count was run from a repository that publishes 30 MCP servers and has 85 active rows in the
same registry, so the motive was practical rather than academic: knowing whether a name is contested is
one API call, and knowing what the whole list looks like turned out to be sixty.</p>
${FOOT}`,
    faq: [
      { q: "How many MCP servers are in the registry in total?", a: "More than 2,211, and this measurement cannot say how many more. Sixty paginated calls covered namespaces ac. through co. and the cursor was still set. What the sample does establish is the shape: mostly hosted, mostly streamable HTTP, one server per publisher at the median." },
      { q: "Why is the row count so much higher than the server count?", a: "The endpoint returns every published version. In this sample 6,000 rows collapsed to 2,211 servers, and a single server accounted for 739 of the extra rows. Pass version=latest to collapse them." },
      { q: "Does a registry entry mean the server works?", a: "No. The registry records what a publisher declared, not what runs. 18 entries in the sample are marked deprecated and still returned. Nothing in the API tests an endpoint or installs a package." },
      { q: "Is the registry the same thing as a directory site?", a: "No, though most directories are built on it. The registry is an API with a strict-ASCII name search. Directory sites add their own ranking, badges and editorial, which is why the same server can be prominent on one and invisible on the other." },
    ],
  },
  "stdio-or-streamable-http": {
    title: "stdio or streamable HTTP: which MCP transport, and what breaks",
    description: "The two standard MCP transports, what each one actually is on the wire, the failure each one has that the other does not, and how to choose. From specification revision 2026-07-28.",
    html: `<h1>stdio or streamable HTTP</h1>
<p>Choose stdio when the server needs the user's machine: their files, their clipboard, their local
database, their credentials already on disk. Choose streamable HTTP when the server needs something you
run: your API, your data, your rate limits, your ability to fix a bug without asking anyone to
reinstall. Everything else follows from that.</p>

<h2>What each one is</h2>
<p><strong>stdio.</strong> The client launches the server as a subprocess and talks to it over the
subprocess's standard streams. One newline-delimited JSON-RPC message per line, stdin in, stdout out.
There is no header layer at all; the protocol version and client capabilities travel inline in
<code>_meta.io.modelcontextprotocol/*</code> in the message body.</p>
<p><strong>Streamable HTTP.</strong> The server is an independent process exposing a single endpoint
that accepts POST. Every client message is its own HTTP POST. The server answers each request with
either one JSON object or an SSE stream scoped to that request, carrying progress notifications and
then the final response. It was introduced in protocol version 2025-03-26 to replace the HTTP+SSE
transport from 2024-11-05.</p>

<h2>The comparison that decides it</h2>
<table>
<thead><tr><th></th><th>stdio</th><th>Streamable HTTP</th></tr></thead>
<tbody>
<tr><td>Who runs it</td><td>the user, as a child process</td><td>you, on a host</td></tr>
<tr><td>Reaches local files</td><td>yes</td><td>no</td></tr>
<tr><td>Concurrent users</td><td>one per launched process</td><td>many on one deployment</td></tr>
<tr><td>Ship a fix</td><td>the user reinstalls</td><td>you deploy</td></tr>
<tr><td>Secrets live</td><td>on the user's disk, in their config</td><td>on your host</td></tr>
<tr><td>Install cost to the user</td><td>a runtime, a path, a config entry</td><td>a URL</td></tr>
<tr><td>Cost to you when nobody uses it</td><td>nothing</td><td>the host bill</td></tr>
<tr><td>Cancellation</td><td>a <code>notifications/cancelled</code> notification</td><td>close the request's response stream</td></tr>
</tbody>
</table>

<h2>What breaks on stdio</h2>
<p><strong>Anything you print.</strong> The specification is explicit: the server MUST NOT write
anything to stdout that is not a valid MCP message. One stray <code>console.log</code>, one dependency
banner, one progress bar, and the client is parsing your greeting as JSON-RPC. Logging goes to stderr,
which the client MAY capture, forward or ignore, and which clients are told not to read as an error
signal on its own.</p>
<p><strong>The environment.</strong> A desktop application launching a subprocess passes on a limited,
platform-dependent subset of environment variables. The PATH your shell has is frequently not the PATH
your client has, which is why <code>spawn npx ENOENT</code> is the single most common MCP failure
report: GitHub's issue search returned 1,428 results for that exact phrase on 2026-09-08. Absolute
paths fix it.</p>
<p><strong>Shutdown.</strong> The client closes your stdin and waits. A server that does not exit on
EOF gets escalated to SIGTERM and then SIGKILL on POSIX, or TerminateProcess on Windows. Honour EOF and
you never meet the escalation.</p>

<h2>What breaks on streamable HTTP</h2>
<p><strong>Origin, and DNS rebinding.</strong> Servers MUST validate the <code>Origin</code> header and
answer an invalid one with 403. A local HTTP server without that check can be driven by any web page
the user has open. Bind to 127.0.0.1 rather than 0.0.0.0 when running locally.</p>
<p><strong>Client transport defaults.</strong> Cline falls back to the legacy SSE transport when
<code>type</code> is omitted, so a correct streamable HTTP endpoint fails against a config that looks
right. Claude Code reads a JSON entry that has a <code>url</code> but no <code>type</code> as a stdio
server, skips it, and says so. Claude Code accepts <code>streamable-http</code> as an alias for
<code>http</code>, so a config copied from a server's own docs works unchanged.</p>
<p><strong>The revision boundary.</strong> Revision 2026-07-28 removed the GET stream endpoint and
removed protocol-level sessions from streamable HTTP. Server-to-client interactions such as sampling,
elicitation and roots are now embedded in results as input requests rather than sent as separate
requests on a stream. A client written against 2025-03-26 through 2025-11-25 expects the old behaviour,
so a server that must serve both needs the compatibility path described in the specification's
backward compatibility section.</p>

<h2>The headers a streamable HTTP request carries</h2>
<pre><code>POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: get_weather</code></pre>
<p><code>Mcp-Method</code> is required on all requests and <code>Mcp-Name</code> on
<code>tools/call</code>, <code>resources/read</code> and <code>prompts/get</code>. They mirror fields
that are already in the body, so an intermediary can route and inspect without parsing JSON. The body
stays the source of truth. Clients MUST send an <code>Accept</code> header listing both
<code>application/json</code> and <code>text/event-stream</code>, because either can come back.</p>

<h2>What the registry chose</h2>
<p>Counted on 2026-09-08 across 2,211 distinct servers in a paginated sample of the official registry:
1,985 declare a remote endpoint and 311 declare an installable package. Among the remote transports,
streamable-http appeared 1,986 times and sse 68. So the published population has already moved to
hosted servers over streamable HTTP, whatever the tutorials still show.</p>

<h2>You can do both</h2>
<p>97 servers in that sample declare both, which is the honest answer for most tools: the same handlers
behind two entry points. This repository's 30 servers run as stdio subprocesses from a bundle and as
streamable HTTP endpoints from one worker, off the same code. The only part that genuinely differs is
where the data lives, and that is a product decision rather than a transport one.</p>
${FOOT}`,
    faq: [
      { q: "Is SSE still a valid MCP transport?", a: "HTTP+SSE was the 2024-11-05 transport and streamable HTTP replaced it in 2025-03-26. Streamable HTTP still uses SSE for a response stream, so the technology is not gone, but a server whose transport type is sse is speaking the old binding. In the registry sample it was 68 servers against 1,986." },
      { q: "Can a stdio server be remote?", a: "Not as launched, but the framing travels. The specification says the stdio wire format is just newline-delimited JSON-RPC over a reliable bidirectional byte stream, and that custom transports over Unix domain sockets or TCP SHOULD reuse it rather than inventing framing. Only the process lifecycle rules are specific to standard streams." },
      { q: "Which one should a first server be?", a: "stdio, unless the server needs a secret you cannot give away. It has no hosting bill, no auth to design and no uptime to hold, and you can convert it later because the handlers do not change." },
      { q: "Does streamable HTTP still have sessions?", a: "Not at the protocol level after revision 2026-07-28, which removed them along with the GET stream endpoint. Anything you were storing per session now needs to be carried in the request or held by your own application." },
      { q: "How do I cancel a long tool call?", a: "It differs by transport, which is easy to miss. On stdio the client sends notifications/cancelled with the request id. On streamable HTTP it closes the request's response stream, and no cancellation message is sent at all." },
    ],
  },
  "mcp-protocol-versions": {
    title: "MCP protocol versions: what each one changed",
    description: "The version identifiers are dates, the current one is 2026-07-28, and negotiation happens per request rather than per connection. What changed, and how to tell which version you are speaking.",
    html: `<h1>MCP protocol versions</h1>
<p>MCP versions are dates in <code>YYYY-MM-DD</code> form, and the date is the last time a backwards
incompatible change was made, not the last release. The current protocol version is
<strong>2026-07-28</strong>, read off modelcontextprotocol.io/specification/versioning on 2026-09-08.
Backwards compatible improvements ship without moving the number.</p>

<h2>Where the version lives</h2>
<p>Every request declares its own version in the
<code>io.modelcontextprotocol/protocolVersion</code> key of its <code>_meta</code> field, and the
server accepts or rejects each request independently. On streamable HTTP the same value is mirrored
into the <code>MCP-Protocol-Version</code> header so an intermediary can read it without parsing the
body. Clients and servers MAY support several versions at once.</p>
<p>That is a real change in shape. Earlier revisions established a connection-scoped session with an
<code>initialize</code> handshake, and negotiated once. Now the unit of negotiation is the request.</p>

<h2>What changed in 2026-07-28</h2>
<ul>
<li>The GET stream endpoint was removed from streamable HTTP.</li>
<li>Protocol-level sessions were removed from streamable HTTP.</li>
<li>Server-to-client interactions, meaning sampling, elicitation and roots, are embedded in results as
input requests under the multi round-trip request model rather than sent as separate JSON-RPC requests
on a stream. In revisions 2025-03-26 through 2025-11-25 a server could send such requests on an SSE
stream; it cannot now.</li>
<li>Servers no longer initiate JSON-RPC requests at all. The specification states the only two message
directions: client requests and notifications to the server, server responses and notifications to the
client.</li>
</ul>

<h2>The versions people still run into</h2>
<table>
<thead><tr><th>Version</th><th>What it is remembered for</th></tr></thead>
<tbody>
<tr><td><code>2024-11-05</code></td><td>The HTTP+SSE transport, two endpoints, replaced in 2025-03-26.</td></tr>
<tr><td><code>2025-03-26</code></td><td>Streamable HTTP introduced. A server supporting older clients MAY read a request with no <code>MCP-Protocol-Version</code> header as this version.</td></tr>
<tr><td><code>2025-06-18</code></td><td>Introduced the <code>MCP-Protocol-Version</code> header. Before it, there was no header to omit.</td></tr>
<tr><td><code>2026-07-28</code></td><td>Current. Sessions and the GET stream removed; per-request negotiation.</td></tr>
</tbody>
</table>
<p>The header rule is the one worth writing down. A server that supports pre-2025-06-18 clients MAY
treat a request with no <code>MCP-Protocol-Version</code> header as 2025-03-26. A server that does not
support them MUST reject a request without the header. Both are conformant, which means the same
missing header produces a working connection against one server and a rejection against another.</p>

<h2>Deprecation, and how long you have</h2>
<p>Features can be marked Deprecated without being removed. A deprecated feature documents a migration
path or states that none is needed, and stays in the specification for at least twelve months, or at
least ninety days under the expedited-removal exception, before it is eligible for removal. Revisions
themselves are marked Draft, Current or Final; a Final revision will not change again.</p>

<h2>How to tell what you are speaking</h2>
<pre><code># streamable HTTP: the header is on the request, so read your own client's
curl -i -X POST https://example.com/mcp \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -H 'MCP-Protocol-Version: 2026-07-28' \\
  -H 'Mcp-Method: tools/list' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'</code></pre>
<p>On stdio there is no header to read, so the version is in the body of every message you send. If you
are debugging a version mismatch on stdio, log the <code>_meta</code> block rather than looking for an
envelope that does not exist.</p>

<h2>Why this bites server authors more than client authors</h2>
<p>A client ships as one product and can decide which version it speaks. A published server is called
by clients of several eras at once. This repository's 30 servers are reachable from Claude Desktop,
Claude Code, Cursor, VS Code, Windsurf, Cline and the claude.ai connector form, and those do not move in
step. The compatibility matrix in the specification's backward compatibility section is the thing to
read before you assume the version you developed against is the one arriving.</p>
${FOOT}`,
    faq: [
      { q: "Do I have to support old versions?", a: "No, and the specification makes both choices conformant. A server that rejects a request with no MCP-Protocol-Version header is correct; so is one that reads it as 2025-03-26. Pick one deliberately and document it, because callers cannot tell which you chose except by being rejected." },
      { q: "Does the version number change on every release?", a: "No. It moves only when a backwards incompatible change lands, which is why the dates are months apart. A specification update that adds something compatible keeps the same identifier." },
      { q: "What replaced the initialize handshake?", a: "Per-request negotiation. Each request carries its protocol version and client capabilities in its _meta field, and the server accepts or rejects it on its own. Earlier revisions set that up once per connection, and the backward compatibility rules describe how each side detects which era the other is from." },
      { q: "Where does the MCP-Protocol-Version header apply?", a: "Streamable HTTP only. It mirrors a body field so intermediaries can route without parsing. stdio has no header layer, so the same information lives only in _meta." },
    ],
  },
  "mcp-server-json-fields-by-client": {
    title: "Every field in an MCP server config entry, by client",
    description: "command, args, env, envFile, type, url, headers, timeout, disabled, autoApprove and the variable syntax each client accepts. Read off six vendors' documentation on 2026-09-08.",
    html: `<h1>The fields in an MCP server entry, and which client reads them</h1>
<p>There is no shared schema for a server entry. Every client invented its own field set on top of the
same two ideas, a command to launch or a URL to call. This is what each one documents, read on
2026-09-08.</p>

<table>
<thead><tr><th>Field</th><th>Claude Desktop</th><th>Claude Code</th><th>Cursor</th><th>VS Code</th><th>Windsurf</th><th>Cline</th></tr></thead>
<tbody>
<tr><td><code>command</code></td><td>yes</td><td>yes</td><td>yes, required for stdio</td><td>yes</td><td>yes</td><td>yes</td></tr>
<tr><td><code>args</code></td><td>yes</td><td>yes</td><td>yes</td><td>yes</td><td>yes</td><td>yes</td></tr>
<tr><td><code>env</code></td><td>yes</td><td>yes, or <code>--env</code></td><td>yes</td><td>yes</td><td>yes</td><td>yes</td></tr>
<tr><td><code>type</code></td><td>not documented</td><td>yes, <code>http</code> / <code>streamable-http</code> / <code>ws</code></td><td><strong>required</strong></td><td>yes</td><td>documented as stdio, HTTP and SSE</td><td>yes, and the default is the trap</td></tr>
<tr><td><code>url</code></td><td>not applicable</td><td>yes</td><td>yes</td><td>yes</td><td><code>serverUrl</code> or <code>url</code></td><td>yes</td></tr>
<tr><td><code>headers</code></td><td>not applicable</td><td>yes, or <code>--header</code></td><td>yes</td><td>yes</td><td>yes</td><td>yes</td></tr>
<tr><td><code>envFile</code></td><td>no</td><td>no</td><td>yes, <strong>stdio only</strong></td><td>no</td><td>no</td><td>no</td></tr>
<tr><td><code>timeout</code></td><td>no</td><td>yes, milliseconds, per server</td><td>no</td><td>no</td><td>no</td><td>set in MCP settings</td></tr>
<tr><td><code>disabled</code></td><td>no</td><td>toggled, stored in <code>~/.claude.json</code></td><td>no</td><td>stored outside <code>mcp.json</code></td><td>toggled per tool</td><td>yes, in the entry</td></tr>
<tr><td><code>autoApprove</code></td><td>no</td><td>no</td><td>no</td><td>no</td><td>no</td><td>yes, an array of tool names</td></tr>
<tr><td><code>inputs</code></td><td>no</td><td>no</td><td>no</td><td>yes, top-level, with <code>&#36;{input:id}</code></td><td>no</td><td>no</td></tr>
<tr><td><code>sandboxEnabled</code></td><td>no</td><td>no</td><td>no</td><td>yes, macOS and Linux</td><td>no</td><td>no</td></tr>
</tbody>
</table>

<h2>Variable syntax, which is where configs stop being portable</h2>
<table>
<thead><tr><th>Client</th><th>Syntax</th><th>Fields it expands in</th></tr></thead>
<tbody>
<tr><td>Claude Code</td><td><code>&#36;{VAR}</code> and <code>&#36;{VAR:-default}</code></td><td>command, args, env, url, headers</td></tr>
<tr><td>Cursor</td><td><code>&#36;{env:NAME}</code>, <code>&#36;{userHome}</code>, <code>&#36;{workspaceFolder}</code></td><td>command, args, env, url, headers</td></tr>
<tr><td>Windsurf</td><td><code>&#36;{env:VAR}</code> and <code>&#36;{file:/path/to/file}</code></td><td>command, args, env, serverUrl, url, headers</td></tr>
<tr><td>VS Code</td><td><code>&#36;{input:id}</code> against a top-level <code>inputs</code> array</td><td>server configuration values</td></tr>
<tr><td>Claude Desktop</td><td>none documented</td><td>literal values in <code>env</code></td></tr>
</tbody>
</table>
<p>Windsurf's <code>&#36;{env:VAR}</code> resolves to an empty string when the variable is unset, and its
<code>&#36;{file:...}</code> is left as-is when the file cannot be read. Both are worth knowing before
you debug an authentication failure: the config did what it was told and told you nothing.</p>

<h2>The four fields that produce silent failures</h2>
<p><strong><code>type</code>, omitted.</strong> Cline falls back to the legacy SSE transport. Claude
Code reads an entry with a <code>url</code> and no <code>type</code> as a stdio server, skips it, and
reports that the entry has a url but no type. Cursor's field table marks it required outright.</p>
<p><strong><code>command</code>, bare.</strong> Cursor's documentation is precise about this: the
command must be available on your system path or contain its full path. The path a desktop client has
is not the path your shell has.</p>
<p><strong><code>envFile</code>, on a remote server.</strong> Cursor supports it for stdio servers only.
An HTTP or SSE server does not read it, and the fix is interpolation from the shell environment
instead.</p>
<p><strong>The top-level key.</strong> Not a field, but the same class of failure. VS Code expects
<code>servers</code>; the other five expect <code>mcpServers</code>. Table at
<a href="/guides/mcp-client-config-file-locations">MCP config file locations</a>.</p>

<h2>One entry, written for each client</h2>
<pre><code>// Claude Desktop, Cursor, Windsurf, Cline, Claude Code
{ "mcpServers": { "invoice": {
    "type": "stdio",
    "command": "/opt/homebrew/bin/node",
    "args": ["/Users/you/mcp-servers/servers/invoice/dist/index.js"]
} } }

// VS Code
{ "servers": { "invoice": {
    "command": "/opt/homebrew/bin/node",
    "args": ["/Users/you/mcp-servers/servers/invoice/dist/index.js"]
} } }</code></pre>
<p><code>type: "stdio"</code> is harmless in the clients that do not require it and required in Cursor,
so writing it always is one less thing to remember.</p>

<h2>Where these came from</h2>
<p>Claude Desktop from modelcontextprotocol.io/docs/develop/connect-local-servers, Claude Code from
docs.claude.com/en/docs/claude-code/mcp, Cursor from cursor.com/docs/context/mcp, VS Code from
code.visualstudio.com/docs/copilot/customization/mcp-servers, Windsurf from
docs.devin.ai/desktop/cascade/mcp, Cline from docs.cline.bot/mcp/mcp-overview. All read 2026-09-08. A
blank cell means the vendor does not document the field, not that it is known to be unsupported.</p>
<p>The 30 MCP servers published from this repository ship a per-client config block for each of these,
generated from one table so a field cannot drift on one page and not the others; the source rows are in
<code>billing/src/setup.js</code>.</p>
${FOOT}`,
    faq: [
      { q: "Is there a standard schema for a client config file?", a: "No. The specification standardises the wire protocol, not the client's server list. The shared shape is a map of server names to objects with command and args or url, and everything past that is per vendor." },
      { q: "Can I use one file for several clients?", a: "Only by symlinking, and only among the five that use mcpServers with the same field names. VS Code's servers key rules it out, and any entry using a client-specific variable syntax stops being portable the moment it is expanded." },
      { q: "What does autoApprove actually skip?", a: "The confirmation prompt before a tool call, per tool name, in Cline. Read-only tools are reasonable candidates. Anything that writes a file, sends a request or spends money is worth leaving off it, because seeing the call before it happens is the point of the prompt." },
      { q: "Which fields hold secrets safely?", a: "None of them hold a secret safely as a literal. VS Code's inputs array and every client's variable interpolation exist so the value stays outside a file that gets committed. Cursor's envFile is the same idea for stdio servers." },
    ],
  },
  "mcp-config-scopes-and-precedence": {
    title: "MCP config scopes: which definition wins when a server is defined twice",
    description: "Claude Code resolves five sources in a fixed order and does not merge fields. Cursor, VS Code and Cline each have a project and a global layer. What each one does with a duplicate.",
    html: `<h1>When the same MCP server is defined twice</h1>
<p>Claude Code connects once, using the definition from the highest-precedence source, and uses that
entry whole: fields are not merged across scopes. The order, from the documentation on 2026-09-08:</p>
<ol>
<li>Local scope</li>
<li>Project scope</li>
<li>User scope</li>
<li>Plugin-provided servers</li>
<li>claude.ai connectors</li>
</ol>
<p>The three scopes match duplicates <em>by name</em>. Plugins and connectors match <em>by
endpoint</em>, so one pointing at the same URL or command as a server above it is treated as a
duplicate of it even under a different name.</p>

<h2>What each Claude Code scope means</h2>
<table>
<thead><tr><th>Scope</th><th>Written to</th><th>Visible in</th></tr></thead>
<tbody>
<tr><td><code>local</code> (default)</td><td><code>~/.claude.json</code></td><td>only you, only the directory you added it in</td></tr>
<tr><td><code>project</code></td><td><code>.mcp.json</code> at the repository root</td><td>everyone who clones the repository, after approval</td></tr>
<tr><td><code>user</code></td><td><code>~/.claude.json</code></td><td>only you, every project</td></tr>
</tbody>
</table>
<p>The default being <code>local</code> is the most common reason a server that was definitely added is
definitely not there. It is per directory. <code>-s</code> is the short form of <code>--scope</code>.</p>
<pre><code>claude mcp add --scope user invoice -- node /abs/path/dist/index.js
claude mcp list      # run it in the directory you are missing the server from</code></pre>

<h2>Project scope has a consent gate, and it is not a bug</h2>
<p>A server defined in a repository's <code>.mcp.json</code> is not started until you approve it. Until
then <code>claude mcp list</code> and <code>claude mcp get &lt;name&gt;</code> show it as pending
approval and do not connect to it. As of v2.1.196, those two commands read <code>.mcp.json</code>
approvals only from settings files that are not checked into the repository, until you trust the
workspace by running <code>claude</code> in it and accepting the trust dialog. A cloned repository
cannot approve its own servers: <code>enableAllProjectMcpServers</code> or
<code>enabledMcpjsonServers</code> committed to the project's <code>.claude/settings.json</code> is
ignored in an untrusted folder.</p>
<p>That is the right default. A config file in a repository is an instruction to run a program, and
cloning a repository should not be enough to do it.</p>

<h2>Enabled and disabled are stored somewhere else</h2>
<p>Toggling a server off in Claude Code records the choice per project in <code>~/.claude.json</code>,
in one of two lists covering disjoint sets of servers: <code>disabledMcpServers</code>, an opt-out list
for user-configured and plugin servers, and a separate pair,
<code>enabledMcpjsonServers</code> and <code>disabledMcpjsonServers</code>, which control approval of
servers defined in a project's <code>.mcp.json</code>. Those two mechanisms are unrelated, which is why
a server can be both approved and disabled, or neither.</p>
<p>VS Code does the same thing for a different reason: the enabled state is stored separately from the
server configuration in <code>mcp.json</code>, so turning a server off locally does not modify a file
your team shares.</p>

<h2>The other clients</h2>
<table>
<thead><tr><th>Client</th><th>Project layer</th><th>Global layer</th></tr></thead>
<tbody>
<tr><td>Cursor</td><td><code>.cursor/mcp.json</code></td><td><code>~/.cursor/mcp.json</code></td></tr>
<tr><td>VS Code</td><td><code>.vscode/mcp.json</code></td><td>user profile, via <code>MCP: Open User Configuration</code></td></tr>
<tr><td>Cline</td><td>none documented</td><td><code>~/.cline/mcp.json</code> for the CLI, panel settings for the extension</td></tr>
<tr><td>Windsurf</td><td>none documented</td><td><code>~/.codeium/windsurf/mcp_config.json</code></td></tr>
<tr><td>Claude Desktop</td><td>none</td><td><code>claude_desktop_config.json</code></td></tr>
</tbody>
</table>
<p>VS Code adds two more surfaces on top: an <code>MCP: Add Server</code> flow that asks whether the
target is Workspace or Global, servers installed into the user profile from the Extensions view, and
<code>customizations.vscode.mcp.servers</code> inside a dev container definition, which VS Code writes
into the container's configuration when the container is created. Sessions running on Agent Host do not
read <code>.vscode/mcp.json</code> directly; VS Code forwards the configuration to it, except servers
that need interactive input.</p>

<h2>The check that answers it in one command</h2>
<pre><code>claude mcp get &lt;name&gt;</code></pre>
<p>It shows the definition Claude Code resolved and runs a health check against it. If the entry that
comes back is not the one you edited, you edited a lower-precedence copy, and no amount of editing that
file will change anything.</p>
<p>This page was written while packaging 30 MCP servers for six clients; the per-client scope facts and
their source URLs are recorded in <code>billing/src/setup.js</code>, read from each vendor's own
documentation on 2026-09-08.</p>
${FOOT}`,
    faq: [
      { q: "Why is local the default scope in Claude Code?", a: "Because the safe default for a command that launches a program is the narrowest one. It costs a flag to widen and costs nothing to be wrong, whereas a user-scope default would put every experiment into every project you open." },
      { q: "Can a repository force its MCP servers on someone who clones it?", a: "No. Project-scoped servers from .mcp.json wait for approval, and since v2.1.196 the approval is not read from files inside the repository until you have trusted the workspace yourself." },
      { q: "If I define a server in both project and user scope, do the fields merge?", a: "No. The documentation is explicit that the entire entry from the highest-precedence source is used. A user-scope entry with an env block and a project-scope entry without one does not produce a merged entry; one of them is used whole." },
      { q: "Do plugin servers and connectors collide with mine?", a: "They can, and they match differently. Named scopes deduplicate by name, while plugins and connectors deduplicate by endpoint, so a connector pointing at the same URL as your server is treated as the same server even if you called it something else." },
    ],
  },
  "mcp-server-logs-and-what-they-say": {
    title: "Where each MCP client writes its logs",
    description: "Claude Desktop writes mcp.log and one file per server. Cursor has an MCP Logs output channel. Claude Code has a health check. The exact paths and commands, verified 2026-09-08.",
    html: `<h1>Where the MCP logs are</h1>
<table>
<thead><tr><th>Client</th><th>Where</th></tr></thead>
<tbody>
<tr><td>Claude Desktop, macOS</td><td><code>~/Library/Logs/Claude/mcp.log</code> and <code>~/Library/Logs/Claude/mcp-server-&lt;name&gt;.log</code></td></tr>
<tr><td>Claude Desktop, Windows</td><td><code>%APPDATA%\\Claude\\logs</code>, same two file shapes</td></tr>
<tr><td>Claude Code</td><td><code>claude mcp get &lt;name&gt;</code> for a health check, <code>/mcp</code> in a session for connection state</td></tr>
<tr><td>Cursor</td><td>Output panel, Cmd+Shift+U or Ctrl+Shift+U, then MCP Logs in the dropdown</td></tr>
<tr><td>VS Code</td><td><code>MCP: List Servers</code>, or right-click the server in the Extensions view under MCP SERVERS - INSTALLED</td></tr>
<tr><td>Cline</td><td>MCP settings actions, which include restarting an unresponsive server</td></tr>
</tbody>
</table>
<p>Verified against each vendor's own documentation on 2026-09-08.</p>

<h2>The two Claude Desktop files do different jobs</h2>
<p><code>mcp.log</code> holds general logging about MCP connections and connection failures. That is
where a launch failure appears, and where <code>spawn npx ENOENT</code> shows up.</p>
<p><code>mcp-server-&lt;name&gt;.log</code> holds the stderr output of that one server. The
documentation makes a point of saying these files are not limited to errors, because a stdio server may
legitimately use stderr for all of its logging. A large file here is not a symptom.</p>
<pre><code>tail -f ~/Library/Logs/Claude/mcp.log
tail -f ~/Library/Logs/Claude/mcp-server-invoice.log</code></pre>

<h2>Why stderr and not stdout</h2>
<p>Because stdout is the wire. The stdio binding says the server MUST NOT write anything to stdout that
is not a valid MCP message, and that the client MAY capture, forward or ignore stderr and SHOULD NOT
assume stderr output indicates an error. So a server logs to stderr because stdout is already carrying
JSON-RPC, and a client keeps stderr because it is the only place a crashing server can say anything.</p>
<p>This is the single most useful thing to know when a connection dies during startup. A JSON parse
error in <code>mcp.log</code> usually means the server printed something friendly.</p>

<h2>When there is no log to read</h2>
<p>Reproduce the launch yourself, with the exact command and arguments from the config:</p>
<pre><code>node /Users/you/mcp-servers/servers/invoice/dist/index.js
# then paste one line and press enter:
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}</code></pre>
<p>A server that answers here and not in the client has an environment or path problem, not a code
problem. A server that does not answer here was never going to work.</p>

<h2>Output size limits, which look like truncation bugs</h2>
<p>Claude Code warns when any MCP tool output exceeds 10,000 tokens and refuses past a default maximum
of 25,000, adjustable with <code>MAX_MCP_OUTPUT_TOKENS</code>. A tool returning a large CSV or a whole
PDF's text will meet that before it meets any limit of yours. It is documented behaviour, not a
failure, and it does not appear in a log file.</p>

<h2>The MCP Inspector</h2>
<p>The specification site lists an Inspector under its developer tools, alongside a debugging guide. It
speaks to a server directly, so it separates "the server is wrong" from "the client's config is wrong"
without involving a client at all. That is the same separation the manual launch above achieves, with a
UI instead of a pasted JSON line.</p>

<p>These paths were collected while shipping 30 MCP servers to six clients, where the per-server stderr
file is what turns a silent absence into a one-line answer. The per-client install pages are under
<a href="/setup/claude-desktop">setup</a>.</p>
${FOOT}`,
    faq: [
      { q: "Is there a Linux log path for Claude Desktop?", a: "None is published, because no Linux path is published for the application at all. Its documentation lists macOS and Windows." },
      { q: "My server's log file is huge. Is that a problem?", a: "Not by itself. mcp-server-<name>.log is that server's stderr, and the documentation says stdio servers may use stderr for all logging, so the file grows in normal operation. Read the last lines rather than the size." },
      { q: "Where does Claude Code keep MCP logs on disk?", a: "The documentation points at commands rather than files: claude mcp get <name> for a per-server health check and /mcp inside a session for connection state. Treat those as the supported surface." },
      { q: "Nothing is in any log and the server is absent. What then?", a: "That is usually a config that was never read: the wrong top-level key, the wrong scope, or an unparseable file. There is no log entry for a server the client never knew about. The ordered list is at /guides/why-an-mcp-server-does-not-appear." },
    ],
  },
  "shipping-an-mcp-server-bundle-or-hosted-url": {
    title: "Shipping an MCP server: a bundle to download or a URL to paste",
    description: "The two ways a stranger can start using your MCP server with no terminal. What each one costs you, what each one can reach, and the case where only one of them works.",
    html: `<h1>Two ways to ship an MCP server to someone who will not open a terminal</h1>
<p>A bundle is a file they double-click. A hosted URL is a line they paste. Both were walked end to end
from a stranger's position on 2026-09-08, with no repository access and no credentials, and both work.
The write-up of that walk is <code>docs/NEW_USER_E2E_R1.md</code> in this repository.</p>

<table>
<thead><tr><th></th><th>Bundle (<code>.mcpb</code>)</th><th>Hosted URL</th></tr></thead>
<tbody>
<tr><td>What the user does</td><td>downloads a file, opens it, clicks install</td><td>pastes a URL into a connector form</td></tr>
<tr><td>Runtime they need</td><td>none; Claude Desktop ships a Node.js runtime</td><td>none</td></tr>
<tr><td>Reaches their files</td><td>yes</td><td>no</td></tr>
<tr><td>Their data lives</td><td>on their disk</td><td>on your host</td></tr>
<tr><td>Works offline</td><td>yes</td><td>no</td></tr>
<tr><td>Shipping a fix</td><td>they download again</td><td>you deploy</td></tr>
<tr><td>Your cost at zero users</td><td>nothing</td><td>the host bill</td></tr>
<tr><td>Clients that take it</td><td>Claude Desktop</td><td>every client with a URL field</td></tr>
<tr><td>Download size</td><td>megabytes; 7,023,082 bytes for the invoice server here</td><td>a URL</td></tr>
</tbody>
</table>

<h2>What the bundle path actually looks like</h2>
<p>Measured on 2026-09-08 by fetching the public release asset and booting it the way the client does:
<code>invoice.mcpb</code> came back HTTP 200 at 7,023,082 bytes, unzipped, answered
<code>initialize</code> with <code>{"name":"mcp-invoice","version":"0.21.0"}</code> and listed 13
tools. No install step, no npm, no path configuration.</p>
<p>The size is the price. A bundle carries the server and its whole dependency tree, because the point
is that nothing is resolved on the user's machine. The 32 bundles in this repository's v0.21.0 release
total 222,294,768 bytes, a mean of 6.6 MB each. Compare that with a package reference, which is a line
of JSON and a resolution failure waiting for someone whose PATH is different from yours.</p>

<h2>What the hosted path actually looks like</h2>
<p><code>GET /mcp/connect</code> returned HTTP 200 with 36 ready-to-paste URLs, one per hosted server,
and a POST to one of them with no headers and no key returned 13 tools. The token sits in the URL path,
so there is nothing to type into an advanced settings box. On Claude.ai and Claude Desktop connectors
that matters more than it sounds: the add-connector form asks for a name and a URL, and its advanced
section is for OAuth client credentials, not for a bearer token.</p>
<p>Hosting has one consequence people underrate. Every user's data is now your problem: your storage,
your retention policy, your breach. The servers here answer that by holding a 30-day data space per
anonymous token, refreshed on every write, and by saying so on the page that mints the token. A local
bundle needs no such policy because there is nothing of theirs on your side.</p>

<h2>Which to choose</h2>
<p><strong>Bundle</strong> when the server's value is the user's own machine: their spreadsheets, their
invoices, their photos, their local database. Also when the tool must work on a plane, and when you do
not want to be the custodian of anything.</p>
<p><strong>Hosted</strong> when the server's value is something only you can reach: your API, your
dataset, your model, your rate limit. Also when you expect to fix bugs weekly, because the alternative
is asking every user to download 7 MB again.</p>
<p><strong>Both</strong> is common and cheap if the handlers are transport-agnostic. In a paginated
sample of the official registry on 2026-09-08, 97 of 2,211 servers declared both a remote endpoint and
an installable package. The 30 servers here do both from one codebase; what differs is where the data
sits, not the tool implementations.</p>

<h2>The path most tutorials show, and why it is the weakest of the three</h2>
<p>A <code>command: "npx"</code> entry with a package name is the most-copied MCP install line and the
most fragile. It needs a Node.js runtime the client can find, network access at launch, and a package
that resolves. Two of those fail routinely under a desktop client, which passes on only a limited,
platform-dependent subset of environment variables to a subprocess. <code>spawn npx ENOENT</code>
returned 1,428 results in GitHub's issue search on 2026-09-08.</p>
<p>It is still the right default for developers, who have a terminal and will read an error. It is the
wrong default for the person you are trying to reach with a download link.</p>

<h2>The measured caveat</h2>
<p>Neither path is a distribution strategy. Everything above works today for a stranger, and this site
still measured 22 unique visitors in fourteen days. A working install path removes a reason not to
start; it does not create the visit. Registry entries and directory listings did that here, and one
channel accounted for 9 of those 22.</p>
${FOOT}`,
    faq: [
      { q: "Can a bundle be installed anywhere except Claude Desktop?", a: "Not as a double-click. Other clients take a command and args, so the same server ships to them as a path to a built file or a package. The bundle format solves the no-terminal case for one client, which is the client most non-developers are using." },
      { q: "Does a hosted server have to require a login?", a: "No, and requiring one costs you most of the people who would have tried it. The endpoints here answer an unauthenticated POST and meter by an anonymous token minted in one GET. Authentication becomes necessary when the data behind the server is worth stealing." },
      { q: "How big is too big for a bundle?", a: "The constraint is patience, not a documented limit. The bundles here run around 6.6 MB on average with a full dependency tree, which downloads in seconds. If yours is much larger, the dependency tree is the thing to look at rather than the format." },
      { q: "Which one gets picked when both are offered?", a: "Unmeasured here, and worth being honest about. This project offers both on every product page and has no data separating which one strangers choose, because the counts are too small to say anything." },
    ],
  },
  "what-is-inside-an-mcpb-bundle": {
    title: "What is inside a .mcpb MCP bundle",
    description: "A .mcpb is a zip with a manifest.json and the whole server. The manifest fields, the ${__dirname} substitution, how user config reaches the server, and measured sizes from 32 real bundles.",
    html: `<h1>Inside a .mcpb bundle</h1>
<p>A <code>.mcpb</code> is an ordinary zip. Unzip one and the top level holds
<code>manifest.json</code> and a <code>server/</code> directory containing the built server and its
entire <code>node_modules</code> tree. Nothing is resolved at install time, which is the whole point:
the user needs no runtime, no package manager and no PATH.</p>
<pre><code>$ unzip -l barcode.mcpb | head
    3464  manifest.json
   28942  server/index.js
     761  server/lib.js
   80732  server/node_modules/.package-lock.json
   ...</code></pre>

<h2>The manifest</h2>
<pre><code>{
  "manifest_version": "0.2",
  "name": "mcp-barcode",
  "display_name": "Barcode",
  "version": "0.21.0",
  "description": "...",
  "author": { "name": "theluckystrike", "url": "https://github.com/theluckystrike" },
  "repository": { "type": "git", "url": "https://github.com/theluckystrike/mcp-servers" },
  "homepage": "https://mcp.zovo.one",
  "license": "MIT",
  "server": {
    "type": "node",
    "entry_point": "server/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["&#36;{__dirname}/server/index.js"],
      "env": { "MCP_LICENSE_KEY": "&#36;{user_config.license_key}" }
    }
  },
  "user_config": {
    "license_key": {
      "type": "string",
      "title": "License key",
      "description": "Optional Pro license key. Leave blank to use the free tier.",
      "sensitive": true,
      "required": false
    }
  },
  "tools": [ { "name": "qr_create", "description": "..." } ],
  "keywords": ["mcp", "model-context-protocol", "qr", "barcode"]
}</code></pre>
<p>That is a real manifest from this repository's v0.21.0 release, trimmed only in the tools array.</p>

<h2>The two substitutions that do the work</h2>
<p><code>&#36;{__dirname}</code> expands to wherever the client unpacked the bundle. This is what makes
the absolute-path problem disappear. Every other client config format needs the user to write an
absolute path themselves, and getting it wrong is the second most common install failure after a
missing runtime.</p>
<p><code>&#36;{user_config.&lt;key&gt;}</code> pulls a value the user typed into the install dialog into
the server's environment. Each key in <code>user_config</code> declares a type, a title, a description,
whether it is <code>required</code>, and whether it is <code>sensitive</code>, which is what keeps a
licence key or an API token out of a plain text file and out of your logs.</p>
<p>The <code>tools</code> array is declarative. It lets the install dialog show what the server will be
able to do before anything runs, which is the only chance a non-developer gets to refuse.</p>

<h2>Measured sizes</h2>
<p>The 32 bundles in the v0.21.0 release of this repository total 222,294,768 bytes, a mean of 6.6 MB.
The largest inspected here, <code>barcode.mcpb</code>, is 14 MB; <code>invoice.mcpb</code> is 7,023,082
bytes. The variance is dependencies, not code: the server entry point in that barcode bundle is 28,942
bytes and everything else is <code>node_modules</code>.</p>

<h2>How rare this format still is</h2>
<p>In a paginated sample of the official MCP registry on 2026-09-08, covering 2,211 distinct servers,
<strong>9</strong> declared an <code>mcpb</code> package. npm had 259, PyPI 41, OCI 15 and NuGet 1,
while 1,985 servers skipped packaging entirely and published a URL. So the one distribution format
aimed at people without a terminal is used by roughly one server in 250.</p>

<h2>Building one</h2>
<pre><code>npx -y @anthropic-ai/mcpb pack &lt;dir&gt;</code></pre>
<p>The directory needs a <code>manifest.json</code> and the built server beside it. The part that takes
the time is vendoring: anything your server imports has to be inside the zip, including workspace
packages that are not published anywhere. In this repository that meant resolving the whole internal
package closure into <code>server/node_modules/</code> and merging their runtime dependencies into one
temporary <code>package.json</code> so a single install covers everything.</p>

<h2>Where it goes</h2>
<p>Claude Desktop's documentation describes opening a bundle to get an installation dialog, and a
bundle you built yourself goes in through Settings, Extensions, Advanced settings, the Extension
Developer section, Install Extension. The format was previously named <code>.dxt</code>; that rename is
recorded with its source URL in <code>billing/src/setup.js</code>, read off the vendor documentation on
2026-09-02.</p>
<p>A bundle downloaded from a public GitHub release, opened with no terminal involved, was verified
working from a stranger's position on 2026-09-08 in <code>docs/NEW_USER_E2E_R1.md</code>.</p>
${FOOT}`,
    faq: [
      { q: "Is a .mcpb signed?", a: "Nothing in the manifest carries a signature, so trust comes from where you downloaded it. Publishing bundles as release assets on the repository that contains the source is what lets someone check that the two match." },
      { q: "Can one bundle contain several servers?", a: "The manifest names one entry point, so a bundle is one server. A server that spawns siblings as child processes is still one entry point from the client's side, which is how a suite ships as a single install." },
      { q: "Why is it so much bigger than the source?", a: "Because the dependency tree is inside it. A bundle trades bytes for the two failures it removes: no runtime resolution and no absolute path for the user to get wrong." },
      { q: "Does the user config get written into the config file?", a: "It goes into the server's environment through the ${user_config.key} substitution in mcp_config.env. Marking a field sensitive is what keeps it out of plain text, which matters for licence keys and API tokens." },
    ],
  },
  "licensing-a-paid-mcp-server": {
    title: "Charging for an MCP server: how licensing actually works",
    description: "There is no billing in the MCP protocol, so a paid tier is something you build. Offline key verification, where the gate goes, what the refusal must say, and what it measured.",
    html: `<h1>Charging for an MCP server</h1>
<p>MCP has no concept of a customer, a plan or a payment. The protocol negotiates capabilities and
carries tool calls. Everything about who is allowed to do what is yours to build, and the shape you
choose is visible to the user at the exact moment they are refused, which makes it a product decision
rather than a plumbing one.</p>

<h2>The three shapes, and what each costs</h2>
<table>
<thead><tr><th>Shape</th><th>Needs a server of yours</th><th>Works offline</th><th>What you learn about usage</th></tr></thead>
<tbody>
<tr><td>Offline signed key</td><td>only to sell the key</td><td>yes</td><td>nothing</td></tr>
<tr><td>Phone-home key check</td><td>yes, on every start</td><td>no</td><td>everything</td></tr>
<tr><td>Hosted server with a token</td><td>yes, always</td><td>no</td><td>everything</td></tr>
</tbody>
</table>
<p>The trade is exact: the more you learn about usage, the less the tool can be trusted with private
data and the more of it stops working when you do. For a local server that reads someone's invoices, an
offline key is the only one of the three that is honest.</p>

<h2>An offline key, concretely</h2>
<p>A key is a signed statement, not a secret. The format used across the 30 servers here is
<code>MCPL1.&lt;payload&gt;.&lt;signature&gt;</code>, base64url, Ed25519. The payload names the product
and an optional expiry:</p>
<pre><code>{ "v": 1, "p": "invoice", "id": "&lt;license id&gt;", "iat": 1757000000 }
// "p": "*" covers every product in the bundle
// "exp" absent means lifetime
// "h" holds a sha256(email) prefix, so a key can be traced to an order</code></pre>
<p>Verification is a signature check against a public key compiled into the server. No network request
is made and no identifier leaves the machine. The private key never ships; it lives on the machine that
signs orders.</p>
<pre><code>node scripts/sign-license.mjs invoice buyer@example.com
MCPL1.eyJ2IjoxLCJwIjoi...</code></pre>
<p>Two details worth copying. Validate the payload's <em>shape</em> after checking the signature, not
before, and reject anything whose fields are missing or the wrong type: a valid signature over a
malformed payload is still malformed. And compare the product field explicitly, so a key for one server
does not silently work on another.</p>

<h2>Where the key comes from at runtime</h2>
<p>Lookup order here: the <code>MCP_LICENSE_KEY</code> environment variable, then
<code>&#36;{XDG_CONFIG_HOME:-~/.config}/mcp-servers/license.json</code>, then the free tier. The
environment variable first is what lets a bundle's install dialog pass a key straight through, using
the manifest's <code>user_config</code> substitution, with nothing for the user to save. The file is
written with mode 0600 through a per-process temporary file and a rename, so two servers activating at
once cannot clobber each other.</p>

<h2>The gate is a message, not a boolean</h2>
<p>This is the part people get wrong, and it is the only part the customer ever sees. A refusal that
says "upgrade to Pro" has told them nothing. A refusal measured from a stranger's install on
2026-09-08 said:</p>
<blockquote>You have already created 3 invoices in 2026-09. The free tier allows 3 invoices per calendar
month.</blockquote>
<p>and then named the price, said the licence is one-time and lifetime, gave the exact next command, and
stated that keys verify offline with nothing sent anywhere. Four facts, at the moment they are relevant,
to someone who has already found the tool useful enough to hit the limit.</p>
<p>The free tier has to do real work for that to land. Here reads are never metered and writes are,
which means a server someone was sent a file for always works, and only producing new documents counts.</p>

<h2>Make the click attributable</h2>
<p>Every upgrade link carries <code>?src=&lt;product&gt;.&lt;tool&gt;</code>, so a click can be traced
to the cap message that produced it. Without that tag, "nobody read the message" and "everybody read it
and did not care" are the same number, which is zero. With it they are different numbers.</p>
<p>What it measured here: 65 upgrade-link clicks in the seven days to 2026-09-05, and not one through a
bundle source, because no cap message carried a bundle link at all. The cheaper option was named in
prose with nothing to click. That defect is invisible without the tag and obvious with it.</p>

<h2>The honest result</h2>
<p>Pricing here is one-time and lifetime, 19 dollars for a single server and 39 for all 30. Every step
of the funnel has been verified working from a stranger's position: the free tier does real work, the
refusal explains itself, the link redirects to a live Stripe checkout. Sales to date: zero. The
constraint was never the gate. It was that 22 people reached the project in fourteen days.</p>
<p>That is worth saying plainly, because most writing on monetising a developer tool is written by
people with traffic, and the advice reads differently when you have none. Build the gate so it is
honest and attributable, then spend the rest of your time on being found.</p>
${FOOT}`,
    faq: [
      { q: "Can an offline key be shared?", a: "Yes, and there is no way to stop it without phoning home. Binding a key to a hashed email and putting a licence id in the payload gives you traceability after the fact, which is the realistic ceiling. Anything stronger costs you the offline guarantee, which is often the reason someone chose a local tool." },
      { q: "Should the free tier be a trial or a permanent limit?", a: "A permanent limit is easier to defend and easier to explain. A trial makes the tool stop working for someone who is not ready to decide, and the message they see at that moment is that it broke." },
      { q: "Where does the gate belong in the code?", a: "At the call site of the capability being sold, not at startup. A server that refuses to start without a key cannot demonstrate anything, and a user who never sees the tool work has no reason to buy." },
      { q: "Does anything in MCP help with payment?", a: "No. The protocol has no billing, entitlement or identity concept, and nothing in the current revision suggests it will. Licensing sits entirely in your server's own code." },
      { q: "How do you verify a key without a network?", a: "Compile the public half of a signing keypair into the server and check the signature locally. The key is a signed claim rather than a lookup token, so verifying it needs no service and works on a plane." },
    ],
  },
  "mcp-tool-description-and-output-limits": {
    title: "How much text an MCP server may return, and how much it may describe",
    description: "Tool descriptions truncate at 2KB in Claude Code, output warns at 10,000 tokens and stops at 25,000 by default, and Windsurf caps at 100 tools. The documented numbers, and what to do about them.",
    html: `<h1>The size limits an MCP server runs into</h1>
<p>Four numbers decide whether a server behaves well inside a client, and none of them are in the
protocol. They are client policy, documented separately by each vendor, read on 2026-09-08.</p>

<table>
<thead><tr><th>Limit</th><th>Value</th><th>Client</th></tr></thead>
<tbody>
<tr><td>Tool description and server instructions</td><td>truncated at 2KB each</td><td>Claude Code</td></tr>
<tr><td>Tool output warning</td><td>10,000 tokens</td><td>Claude Code</td></tr>
<tr><td>Tool output maximum</td><td>25,000 tokens, <code>MAX_MCP_OUTPUT_TOKENS</code> to change</td><td>Claude Code</td></tr>
<tr><td>Tools available at once</td><td>100</td><td>Windsurf, Cascade</td></tr>
</tbody>
</table>

<h2>The 2KB one is the one that changes how you write</h2>
<p>Claude Code truncates tool descriptions and server instructions at 2KB each, and its guidance is to
put critical details near the start. That is a hard constraint on the only text the model reads before
deciding whether to call your tool. Everything that matters, and particularly what the tool must
<em>not</em> be used for, goes in the first sentence.</p>
<p>With tool search enabled, only tool names and server instructions load at session start, and the
full definitions are fetched when needed. That makes the server instructions field more important, not
less: it is what the model searches against. Claude Code's own advice to server authors is to say what
category of tasks the tools handle, when to search for them, and the key capabilities.</p>

<h2>The output limits, and the failure they look like</h2>
<p>A tool returning a whole CSV, a full PDF text extraction or an unbounded list will meet 25,000
tokens before it meets any limit of yours, and the result looks to the user like your server truncating.
It is not; it is documented client behaviour, and it does not appear in any log.</p>
<p>The fixes, in the order worth trying: return a summary with a count and offer detail on request;
paginate with an explicit cursor argument; write the full result to a file and return the path. The
third is underused and often the right answer, because the user wanted the file more than they wanted
the bytes in the conversation.</p>
<p>Two escape hatches exist on the client side. <code>MAX_MCP_OUTPUT_TOKENS</code> raises the ceiling
for a session. A tool that sets <code>anthropic/maxResultSizeChars</code> uses that value instead for
text content regardless of the environment variable, though tools returning image data stay subject to
the token limit.</p>

<h2>The tool count, and why more servers make a model worse</h2>
<p>Windsurf's Cascade reaches at most 100 tools at once and every enabled server spends from it. Claude
Code imposes no fixed per-server cap; its documentation says the practical limit is the context window
budget.</p>
<p>The number that makes this concrete: one <code>tools/list</code> against the office-suite bundle in
this repository on 2026-09-07 returned <strong>292 tools from 31 child servers</strong>. That single
entry is nearly three times Windsurf's ceiling on its own. Convenient when you do not know in advance
what you will need, and unusable as a default.</p>
<p>A model also chooses worse from a longer list, which is the cost nobody bills you for. Two servers
you use daily beat twenty you installed because they were free.</p>
<pre><code>claude mcp list   # every entry here spends budget in every conversation</code></pre>

<h2>What this means for a server you are writing</h2>
<ul>
<li>Fewer, wider tools beat many narrow ones. Each tool costs description budget and choice quality.</li>
<li>Put the disqualifying condition first in the description, not the capability. The model needs to
know when <em>not</em> to call it.</li>
<li>Bound every return by default and let the caller ask for more.</li>
<li>Offer a file path as an output option for anything that can be large.</li>
<li>Write server instructions as if they are the only thing read, because with tool search enabled they
nearly are.</li>
</ul>
<p>Sources: docs.claude.com/en/docs/claude-code/mcp for the 2KB, 10,000 and 25,000 figures and the tool
search behaviour, docs.devin.ai/desktop/cascade/mcp for the 100-tool ceiling, both read 2026-09-08.
The 292-tool measurement is from this repository's own bundle.</p>
${FOOT}`,
    faq: [
      { q: "Is there a protocol-level limit on tool output?", a: "No. The specification does not bound a result's size, so every number here is a client policy that can differ between clients and change between versions. Design for the tightest one you know about rather than for the protocol." },
      { q: "How many tools should one server expose?", a: "Few enough that a person could read the list. The servers in this repository run from 6 to 15 tools each, which sits comfortably inside every documented ceiling when three or four are installed together." },
      { q: "What happens when a description is truncated?", a: "The model sees the first 2KB. Nothing errors and nothing warns, so a long description simply loses its ending, which is where people tend to put the caveats." },
      { q: "Does returning a file path count against the output limit?", a: "Barely, which is the point. A path is a few dozen characters and the content stays on disk where the user can open it with a tool that is better at it than a chat window." },
    ],
  },
  "mcp-server-security-review": {
    title: "What to check before letting an MCP server run",
    description: "An MCP server is a program with your file access and your credentials. The specification's own requirements, the client consent gates, and the checks worth doing on someone else's server.",
    html: `<h1>Reviewing an MCP server before you run it</h1>
<p>A stdio MCP server is a program the client launches with your user account. It can read what you can
read and delete what you can delete. VS Code's own documentation puts it plainly: local MCP servers can
run arbitrary code on your machine. Everything below follows from that being literally true.</p>

<h2>What the specification requires of a server</h2>
<p>For streamable HTTP, these are stated as requirements rather than suggestions:</p>
<ul>
<li>Servers MUST validate the <code>Origin</code> header on all incoming connections, and MUST answer
an invalid one with HTTP 403 Forbidden.</li>
<li>When running locally, servers SHOULD bind only to <code>127.0.0.1</code> rather than
<code>0.0.0.0</code>.</li>
<li>Servers SHOULD implement proper authentication for all connections.</li>
</ul>
<p>The reason is named in the specification: without these, an attacker can use DNS rebinding to
interact with a local MCP server from a remote website. A local server with no Origin check is
reachable by any page the user has open.</p>

<h2>The consent gates the clients give you</h2>
<table>
<thead><tr><th>Client</th><th>Gate</th></tr></thead>
<tbody>
<tr><td>VS Code</td><td>Asks you to confirm you trust the server and its capabilities before it starts. Nothing runs until you answer.</td></tr>
<tr><td>Claude Code</td><td>A project-scoped server from <code>.mcp.json</code> waits for approval, and since v2.1.196 the approval is not read from files inside the repository until you trust the workspace yourself.</td></tr>
<tr><td>Claude Desktop</td><td>An <code>.mcpb</code> install dialog lists the tools declared in the manifest before installing.</td></tr>
<tr><td>Cline</td><td>Tool calls are confirmed unless the tool name is in that server's <code>autoApprove</code> array.</td></tr>
<tr><td>Windsurf</td><td>Tools are toggled per server on its settings page.</td></tr>
</tbody>
</table>
<p>Two of these are worth using deliberately rather than clicking through. <code>autoApprove</code>
decides which tools run without you seeing the call, so read-only tools are reasonable candidates and
anything that writes, sends or spends is not. And VS Code offers <code>"sandboxEnabled": true</code>
for local stdio servers on macOS and Linux, restricting a server to the file paths and network domains
you permit, with a top-level <code>sandbox</code> object for the rules.</p>

<h2>Checks worth doing on someone else's server</h2>
<ol>
<li><strong>Read the tool list before the README.</strong> The tools are the capability surface. A
server whose description says "read your calendar" and whose tool list includes a generic shell
execution tool is a different program from the one described.</li>
<li><strong>Find out where it sends things.</strong> Grep the source for the HTTP client it uses. A
tool that claims to work locally and opens a socket is the single highest-value thing to catch.</li>
<li><strong>Check what it writes, and where.</strong> A path built from a tool argument without
normalisation is a directory traversal waiting for a plausible-looking filename.</li>
<li><strong>Check the input bounds.</strong> Anything that unpacks an archive, parses a document or
follows a link handles input the user did not write. Refusal ratios and total-size ceilings belong
there.</li>
<li><strong>Prefer a pinned version to a floating one.</strong> An install line that resolves the
latest package at every launch is a supply chain you re-accept every morning.</li>
</ol>

<h2>Untrusted input is the part people skip</h2>
<p>Most review attention goes to the server's own code. The larger surface is usually the data it is
pointed at, because that comes from someone else. The zip server in this repository refuses an archive
on the declared total size and the compression ratio read from the central directory, before anything is
inflated: a 500 MB decompression bomb is refused in 3 ms with nothing written and the output directory
not even created. A library that hands back a decompressed map has already inflated the bomb by the
time you can inspect it.</p>
<p>The ratio ceiling is set at 100x rather than 50x for a measured reason: a real monthly export of
plain-text records compressed at 1,022x in testing, so a ceiling tuned comfortably below a bomb would
refuse ordinary work, and the user would learn to pass an override on everything. A guard people
routinely disable is not a guard.</p>

<h2>What to check on your own server</h2>
<ul>
<li>Nothing but MCP messages on stdout. A stray print corrupts the stream, and the specification
forbids it.</li>
<li>Secrets read from the environment or a mode-0600 file, never from a committed config.</li>
<li>Every path argument normalised and confined before it is opened.</li>
<li>Every size and count bounded, with the refusal decided before the work.</li>
<li>Exit cleanly on stdin EOF, so the client never has to escalate to SIGKILL.</li>
</ul>
<p>Sources: the streamable HTTP transport binding of specification revision 2026-07-28 for the Origin,
binding and authentication requirements; each vendor's own documentation, read 2026-09-08, for the
consent gates. The archive figures are measured in <code>servers/zip/README.md</code> in this
repository, whose 30 servers run 1,518 tests with 1,507 passing and 0 failing at v0.20.0, recorded in
<code>data/tests.json</code>.</p>
${FOOT}`,
    faq: [
      { q: "Is a hosted MCP server safer than a local one?", a: "It is safer for your machine and worse for your data. A remote server cannot read your disk, and everything you send it is now on someone else's. Which risk you prefer depends on whether the sensitive thing is the machine or the content." },
      { q: "Does the protocol authenticate anything?", a: "Not by itself. The transport binding says servers SHOULD implement proper authentication and requires Origin validation, and OAuth is layered on by clients for remote servers. A stdio server has no authentication at all, because it is already running as you." },
      { q: "What is DNS rebinding in this context?", a: "A remote page resolving a hostname to 127.0.0.1 so that a request from that page reaches a service listening on your machine. Validating Origin and rejecting anything unexpected with 403 is the defence the specification requires, which is why it is a MUST rather than a suggestion." },
      { q: "Should I autoApprove read-only tools?", a: "It is the defensible case, and it is worth being sure they are read-only first. A tool that fetches a URL is not read-only in the sense that matters, because the argument decides where the request goes." },
    ],
  },
};

export const GUIDE_INDEX = {
  title: "Guides for MCP servers in Claude and Cursor",
  description: "Seventy-six guides: how MCP itself works, from config file locations and transports to protocol versions, registry search and shipping a server; getting an MCP server to start in Claude Desktop, Claude Code, Cursor, VS Code, Windsurf and Cline, and then doing real work with it. then real work with one: billable hours, invoice PDFs, VAT and reverse charge, retainers, expenses and rebilling, Excel and CSV, bank reconciliation, quotes, travel allowances, depreciation, client statements and dunning, petty cash, safe zip archives, and what each free tier actually gives you.",
};
