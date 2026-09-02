/**
 * /setup/<client>/<server> long-tail pages.
 *
 * Every fact in CLIENTS below was read off the client's own public documentation on
 * 2026-09-02 with curl; the `docs` URL on each entry is the page it came from. Every
 * number quoted in the generated prose comes from docs/USER_VALUE_R4.md or from the
 * server READMEs, not from invention.
 *
 * The page bodies are composed from three sources so no two of the 36 pages read alike:
 * the client row (config path, key name, CLI, caveat), the server row (prompts, tools,
 * free tier), and ANGLE[server][client], one sentence written per pair.
 */

const REPO = "https://github.com/theluckystrike/mcp-servers";
const BASE = "https://mcp.zovo.one";

/** Clients, in navigation order. `neighbours` are derived from this order. */
export const CLIENTS = {
  "claude-desktop": {
    name: "Claude Desktop",
    short: "Claude Desktop",
    docs: "https://modelcontextprotocol.io/docs/develop/connect-local-servers",
    file: "claude_desktop_config.json",
    key: "mcpServers",
    paths: [
      ["macOS", "~/Library/Application Support/Claude/claude_desktop_config.json"],
      ["Windows", "%APPDATA%\\Claude\\claude_desktop_config.json"],
    ],
    reach: "The documented route to it is Settings, the Developer tab in the left sidebar, then the Edit Config button, which creates the file if it is not there yet. Linux has no published path, because the documentation says Claude Desktop is available for macOS and Windows.",
    cli: null,
    oneClick: "There is also an install that involves no JSON: an .mcpb bundle, the format the documentation renamed from .dxt, is a zip of the server and its manifest, and opening one with Claude shows an installation dialog. A bundle you built yourself goes in through Settings, Extensions, Advanced settings, the Extension Developer section, Install Extension.",
    restart: "Save, then completely quit Claude Desktop and start it again. A window reload is not enough.",
    caveat: "Two documented facts decide whether the entry works: every path in claude_desktop_config.json must be absolute, and a stdio server started here inherits only a limited, platform-dependent subset of environment variables. If node came from nvm or homebrew, paste what `which npx` prints instead of the bare word. The .mcpb route avoids both: Claude Desktop ships a built-in Node.js environment.",
    caveatShort: "paths must be absolute and env inheritance is limited",
    envNote: "Environment variables go in an \"env\" object next to \"command\".",
  },
  "claude-code": {
    name: "Claude Code",
    short: "Claude Code",
    docs: "https://docs.claude.com/en/docs/claude-code/mcp",
    file: ".mcp.json",
    key: "mcpServers",
    paths: [
      ["local (default)", "~/.claude.json, this project only"],
      ["project", ".mcp.json at the repository root"],
      ["user", "~/.claude.json, every project"],
    ],
    reach: "You rarely open the file. `claude mcp add` writes it, `claude mcp list` and `claude mcp get <name>` read it back with a health check, `claude mcp add-json <name> '<json>'` takes a whole config object, and `/mcp` in a session shows what is connected.",
    cli: true,
    oneClick: null,
    restart: "No restart. The entry is picked up in the next session, and `/mcp` reconnects one on demand.",
    caveat: "The `--` is load-bearing: it separates Claude Code's own options, such as --transport, --env and --scope, from the command that runs the server. And the default scope is local, private to you and to the directory you ran it in, so adding it in the wrong folder leaves the tools absent with no error at all.",
    caveatShort: "local scope is the default and is per-directory",
    envNote: "Use --env KEY=value on the add command, or --header for an HTTP server; -t and -H are the short forms of --transport and --header.",
  },
  cursor: {
    name: "Cursor",
    short: "Cursor",
    docs: "https://cursor.com/docs/context/mcp",
    file: ".cursor/mcp.json",
    key: "mcpServers",
    paths: [
      ["This project only", "<project>/.cursor/mcp.json"],
      ["Every project", "~/.cursor/mcp.json"],
    ],
    reach: "Servers are installed and managed from the Customize page in the sidebar, or configured in mcp.json by hand. The older Tools and MCP settings pane is not where the current documentation sends you.",
    cli: null,
    oneClick: "Cursor's marketplace has Add to Cursor buttons for listed servers. Its documented deeplink scheme covers prompt, command and rule links, and a cursor:// link maps to a web one by swapping the base for https://cursor.com/link/, with a ceiling of 8,000 characters on the URL.",
    restart: "The Customize page shows the server and its tools once it has started.",
    caveat: "The current field table marks `type` as required, with `stdio` for a locally launched server, so write it out rather than relying on command and args alone. The other documented restriction is that `envFile` is stdio-only: a remote HTTP or SSE server does not read it, and its headers belong in the config.",
    caveatShort: "the current field table marks \"type\" as required",
    envNote: "An \"env\" object next to \"command\" is read inline; \"envFile\" is accepted for stdio servers only.",
  },
  vscode: {
    name: "VS Code",
    short: "VS Code",
    docs: "https://code.visualstudio.com/docs/copilot/customization/mcp-servers",
    file: ".vscode/mcp.json",
    key: "servers",
    paths: [
      ["This workspace", "<workspace>/.vscode/mcp.json"],
      ["Every workspace", "the user profile mcp.json, opened by the MCP: Open User Configuration command"],
    ],
    reach: "MCP: Add Server in the command palette walks you through it and asks whether the target is Workspace or Global. MCP: List Servers shows the state of each entry.",
    cli: true,
    oneClick: null,
    restart: "VS Code asks you to confirm you trust the server and its capabilities before it starts. Nothing runs until you answer.",
    caveat: "The top-level key is \"servers\", not \"mcpServers\". A config pasted from a Claude Desktop or Cursor README parses cleanly, contributes no servers, and gives you no error to read, which makes it the most expensive one-word mistake here. Alongside it an \"inputs\" array holds secrets. The newer Agent Host reads a workspace .mcp.json instead.",
    caveatShort: "the key is \"servers\", not \"mcpServers\"",
    envNote: "Secrets belong in the \"inputs\" array and are referenced as ${input:id}. \"sandboxEnabled\": true is macOS and Linux only.",
  },
  windsurf: {
    name: "Windsurf",
    short: "Windsurf",
    docs: "https://docs.devin.ai/desktop/cascade/mcp",
    file: "mcp_config.json",
    key: "mcpServers",
    paths: [["macOS, Windows and Linux", "~/.codeium/windsurf/mcp_config.json"]],
    reach: "The MCPs icon in the top right of the Cascade panel, or Devin Settings, Cascade, MCP Servers. The documentation for this file now lives under the Devin Desktop product name; the Windsurf docs URL redirects there.",
    cli: null,
    oneClick: "Windsurf documents an install deeplink of its own: windsurf://windsurf-mcp-registry?serverName=<server-name>.",
    restart: "Save and reopen the MCP Servers list; Cascade picks it up without restarting the editor.",
    caveat: "Read this first: mcp_config.json applies to the legacy Cascade agent only. The Devin Local agent, the default for new tabs, takes its servers from the Devin CLI config files, so a correct entry here can still be invisible in a fresh tab. The other hard number is a cap: Cascade reaches at most 100 tools at once, and every enabled server spends from it.",
    caveatShort: "legacy Cascade agent only, and a 100-tool ceiling",
    envNote: "An \"env\" object next to \"command\" is supported.",
  },
  cline: {
    name: "Cline",
    short: "Cline",
    docs: "https://docs.cline.bot/mcp/mcp-overview",
    file: "mcp.json",
    key: "mcpServers",
    paths: [
      ["Cline CLI", "~/.cline/mcp.json"],
      ["The editor extension", "opened from the Cline panel, not by path; the documentation deliberately calls it the MCP settings JSON used by the extension"],
    ],
    reach: "In the Cline panel, click the MCP Servers icon in the top toolbar, open the Configure tab, then Configure MCP Servers near the bottom, and add the entry under mcpServers. From a terminal, `cline mcp` opens an interactive wizard and `cline config mcp --json` reads or writes the same thing non-interactively.",
    cli: null,
    oneClick: "Remote servers have their own tab in the same panel.",
    restart: "No full-app restart. The MCP settings actions include restarting an unresponsive server if its tools do not appear.",
    caveat: "Cline is the one client here with an unsafe transport default. `type` selects it, and omitting `type` falls back to the legacy sse transport, so a streamable HTTP endpoint needs it written in or you will debug a server that is fine. Local entries carry \"disabled\" and an \"autoApprove\" array.",
    caveatShort: "omitting \"type\" falls back to the legacy sse transport",
    envNote: "An \"env\" object next to \"command\" is supported, plus \"disabled\" and a per-server \"autoApprove\" array.",
  },
};

export const CLIENT_ORDER = Object.keys(CLIENTS);

/** Servers. Prompts are lines from each README's "What you can say" table. */
export const SETUP_SERVERS = {
  "time-tracker": {
    title: "MCP Time Tracker",
    slug: "time-tracker",
    toolCount: "13 tools",
    pkg: "@theluckystrike/mcp-time-tracker",
    sPage: "/s/time-tracker",
    hosted: "time-tracker",
    tagline: "Track billable time without leaving the chat.",
    does: "It keeps a running timer, takes time you forgot to log, applies an hourly rate per project, and turns the log into a report, a CSV or invoice lines. Plain JSON on disk.",
    prompts: [
      ["Start a timer for the Acme website project.", "timer_start"],
      ["Log 2.5 hours yesterday for Acme, design review, at 90 euros an hour.", "entry_add"],
      ["How many hours did I bill this month, grouped by project?", "report"],
    ],
    free: "unlimited timers and entries, 7 days of reports, 2 rated projects.",
    pro: "Full history, invoice_summary, grouping by tag, unlimited rated projects.",
    measured: "In the audit run each of those sentences took one tool call, at 7.7 s and 14.6 s including a turn that also logged an expense.",
  },
  "price-tracker": {
    title: "MCP Price Tracker",
    slug: "price-tracker",
    toolCount: "10 tools",
    pkg: "@theluckystrike/mcp-price-tracker",
    sPage: "/s/price-tracker",
    hosted: "price-tracker",
    tagline: "Check and watch product prices on ordinary shop pages.",
    does: "It reads the price out of a product page from JSON-LD, microdata, Open Graph or visible markup, normalises 1.299,00 EUR and 1,299.00 USD alike, and keeps a per-watch history.",
    prompts: [
      ["What does this cost right now: <product url>?", "price_check"],
      ["Watch that page and alert me if it goes under 40.", "watch_add"],
      ["Has anything I'm watching hit its target or dropped a lot?", "alerts_pending"],
    ],
    free: "unlimited checks with a confidence score, 3 watches, 30 observations each, alerts.",
    pro: "Unlimited watches, full history, refresh everything at once.",
    measured: "One measured limitation: with a general web fetcher available, a client sometimes answers a price question by fetching the page itself, so nothing is stored. Name the tracker in the sentence.",
  },
  spreadsheet: {
    title: "MCP Spreadsheet",
    slug: "spreadsheet",
    toolCount: "10 tools",
    pkg: "@theluckystrike/mcp-spreadsheet",
    sPage: "/s/spreadsheet",
    hosted: "spreadsheet",
    tagline: "Read, query, edit and convert xlsx and csv files safely.",
    does: "It opens xlsx, xlsm, xlsb, ods, csv and tsv, guesses the header row on a messy export, and queries with an expression language that has no eval.",
    prompts: [
      ["Open sales.xlsx and tell me what's in it.", "sheet_info"],
      ["Which rep sold the most units in the North region? Top 5 with totals.", "sheet_query"],
      ["Add a Revenue column that's Units times Unit Price, save it as a CSV next to the original.", "sheet_add_column"],
    ],
    free: "read, query, stats and find up to 5,000 rows; writes up to 500 rows, never partial.",
    pro: "No row limits.",
    measured: "The group-by ranking above used to cost five tool calls and 71 seconds via a python fallback. It is one sheet_query call here.",
  },
  invoice: {
    title: "MCP Invoice",
    slug: "invoice",
    toolCount: "12 tools",
    pkg: "@theluckystrike/mcp-invoice",
    sPage: "/s/invoice",
    hosted: "invoice",
    tagline: "Numbered invoices with tax lines, rendered to a PDF.",
    does: "It stores your business profile and clients, allocates numbers that never repeat, computes per-line rounding and several VAT rates in integer minor units, and renders an A4 PDF.",
    prompts: [
      ["Invoice Acme for 12 hours at 90 EUR plus 300 EUR setup, 23% VAT, PDF.", "invoice_create then invoice_pdf"],
      ["Which invoices are unpaid and overdue?", "overdue_report"],
      ["Mark INV-2026-0007 as paid in full.", "invoice_mark_paid"],
    ],
    free: "3 invoices a month with a small footer line, overdue report included.",
    pro: "Unlimited invoices, no footer, your logo, your own number prefix.",
    measured: "In the audit run this issued INV-2026-0001: subtotal EUR 275.00, 23% VAT EUR 63.25, total EUR 338.25. The file on disk began with %PDF-1.3 at 2,495 bytes.",
  },
  "expense-tracker": {
    title: "MCP Expense Tracker",
    slug: "expense-tracker",
    toolCount: "14 tools",
    pkg: "@theluckystrike/mcp-expense-tracker",
    sPage: "/s/expense-tracker",
    hosted: "expense-tracker",
    tagline: "Receipts, mileage and expenses that turn into invoice lines.",
    does: "It logs an expense with its own currency and VAT split, records the receipt by path and sha256, and emits invoice lines that are not taxed twice.",
    prompts: [
      ["I paid 61.50 EUR at Media Markt for a USB hub, Acme project, billable.", "expense_add"],
      ["What did I spend this month, by category?", "expense_summary"],
      ["Give me the invoice lines to rebill Acme this month with 10% markup.", "expense_to_invoice"],
    ],
    free: "unlimited logging, 30 days of history, 3 projects, 5 rules, 200 CSV rows.",
    pro: "Full history, unlimited projects and rules, xlsx export, rebill with markup.",
    measured: "The EUR 61.50 receipt above stored as amount_minor 6150, vat_rate 23, and rebilled at a net unit_price of 50.00, so the invoice did not tax it twice.",
  },
  "office-suite": {
    title: "MCP Office Suite",
    slug: "office-suite",
    toolCount: "51 tools",
    pkg: "@theluckystrike/mcp-office-suite",
    sPage: null,
    hosted: null,
    tagline: "One config entry that exposes every tool of the five servers.",
    does: "It starts the time tracker, price tracker, spreadsheet, invoice and expense tracker as child processes and exposes every tool, resource and prompt under one server, with one license pair.",
    prompts: [
      ["Start a timer for Acme.", "timer_start"],
      ["Now invoice Acme for this week's hours and the rebillable expenses, 23% VAT, due in 14 days, PDF.", "six calls, entry_list through invoice_pdf"],
      ["What did I spend this month and what is still unbilled?", "expense_list and entry_list"],
    ],
    free: "each child keeps its own free tier.",
    pro: "One $39 bundle key activates Pro on all five children at once.",
    measured: "Its startup line reads: proxying [time-tracker, price-tracker, spreadsheet, invoice, expense-tracker], 49 tools. Those three sentences are consecutive turns of one audited conversation that scored 12 out of 12.",
  },
};

export const SERVER_ORDER = Object.keys(SETUP_SERVERS);

/**
 * One sentence per (server, client) pair. This is the part that cannot be generated:
 * it is what is actually different about running that server in that client.
 */
const ANGLE = {
  "time-tracker": {
    "claude-desktop": "Claude Desktop is the client people leave open all day, which is the one that a stopwatch needs: the timer keeps running while the window sits in the background, and stopping it is a sentence, not a form.",
    "claude-code": "You are already in the terminal when the work starts, so the timer starts in the same place the work does, and `claude mcp add --scope project` puts the entry in the repository the hours belong to.",
    cursor: "Cursor is where the billable hours are actually spent, so the useful pattern is to start the timer in the same chat you are about to ask for the refactor, and read the week back on Friday. Two rated projects on the free tier is usually two clients.",
    vscode: "In agent mode the timer is one of the tools the agent can reach mid-task, so \"start a timer and then fix the failing test\" is a single instruction rather than two.",
    windsurf: "Because mcp_config.json is loaded for every workspace, the timer follows you between projects, which is what you want from a tracker and not from a file tool. Eleven tools out of the 100 Cascade can hold is a cheap seat.",
    cline: "Confirming every tool call is noisy for a stopwatch. Put timer_start, timer_stop and timer_status in that server's autoApprove array and leave export_csv, which writes a file, out of it.",
  },
  "price-tracker": {
    "claude-desktop": "Claude Desktop has no built-in web fetcher of its own in a default install, which is the one client where price_check is reliably the tool that answers a price question.",
    "claude-code": "Claude Code ships WebFetch, and in a measured run it answered a price question by fetching the page itself and never called the server. Name the tracker in the sentence if you want the point stored.",
    cursor: "Cursor's agent has web access of its own, so ask for the watch rather than the price: \"watch this page and tell me under 40\" has no fetcher equivalent and goes to the server every time.",
    vscode: "Chat has its own fetch tool in the tools picker. Turning that one off for the chats where you are pricing things is the difference between a stored history and a one-off answer.",
    windsurf: "Cascade browses, so the watch list is the reason to install this rather than the single lookup, and the watch list is the half a browser cannot do.",
    cline: "Approval per tool call suits a server whose whole job is fetching a page you chose, and the refusal of private, loopback, link-local and metadata addresses is enforced server-side too, before and after every redirect.",
  },
  spreadsheet: {
    "claude-desktop": "Claude Desktop has no folder open, so give absolute paths: \"open /Users/you/Downloads/sales.xlsx\". That single habit removes most of the confusion people have with file tools in this client.",
    "claude-code": "Claude Code is already rooted in a directory, so relative paths work and the assistant can pair a sheet_query against a data file with a read of the code that produced it.",
    cursor: "Cursor has the workspace open, which means the spreadsheet next to your code is one sentence away, and the output CSV lands in the same tree the editor is showing.",
    vscode: "The generated CSV appears in the Explorer as soon as it is written, so agent mode plus this server is the shortest path from an xlsx export to a file you can commit.",
    windsurf: "Cascade edits files in the workspace; this server reads and writes the ones Cascade should not be parsing by hand, which is any workbook big enough that a model reading it row by row would be guessing.",
    cline: "Leave sheet_write and sheet_add_column out of the autoApprove array. Reads are safe to approve automatically; anything that writes a file next to your original is worth one click.",
  },
  invoice: {
    "claude-desktop": "The PDF is written to your disk and Claude Desktop hands you the path, so the normal flow is: ask for the invoice, then open the file from Finder or Explorer without leaving the app.",
    "claude-code": "The whole month closes in one terminal session: hours out of the time tracker, receipts out of the expense tracker, one invoice_create, one invoice_pdf. That chain was six tool calls and 53 seconds in the audit.",
    cursor: "If you invoice per repository, .cursor/mcp.json inside the client project keeps that client's invoice server scoped to that project, which is the cleanest separation any of the six clients here offers.",
    vscode: "The server writes the PDF itself, so it lands at the path you named inside the workspace and shows up in the Explorer, rather than in a preview you then have to save.",
    windsurf: "One config file for every workspace suits a tool you reach for twice a month: the invoice server is simply there, in whatever project you happen to have open when the month ends.",
    cline: "Put overdue_report in autoApprove and keep invoice_create out of it. Reading the overdue list is harmless; allocating an invoice number consumes one that never repeats.",
  },
  "expense-tracker": {
    "claude-desktop": "receipt_attach needs a real file path and Claude Desktop has no working directory, so drag the receipt to a known folder and paste the absolute path. The file is not copied, only its path and sha256 are stored.",
    "claude-code": "Logging a receipt from the terminal takes one sentence and one tool call, measured at 13.1 seconds on a fresh data directory, and the rebill lines come out in the same session as the invoice.",
    cursor: "Cursor is where a contractor's project directory already is, so \"rebill Acme this month with 10% markup\" maps onto the project you have open rather than a name you have to remember.",
    vscode: "The csv or xlsx export lands in the workspace where you can open it and read the month before any of it becomes an invoice line, which is the review step the chat itself does not give you.",
    windsurf: "Because there is one config for every workspace, the expense log is reachable in whatever project you are in when the receipt arrives, which is the whole point of an expense tool.",
    cline: "Put expense_add and expense_summary in autoApprove and keep expense_mark_rebilled out, because it writes an invoice number onto receipts and clearing it is a separate call with its own flag.",
  },
  "office-suite": {
    "claude-desktop": "One entry in claude_desktop_config.json instead of five, which matters more here than anywhere else: this is the client where each extra server is another absolute path to get right.",
    "claude-code": "One `claude mcp add` instead of five, and one bundle key. The audited conversation that started a timer and finished with a rendered invoice ran entirely through this single server.",
    cursor: "Five servers' worth of tools arrive as one entry, so mcp.json holds one object with one required type field instead of five, and the Customize page lists one server to enable or disable.",
    vscode: "One entry under the servers key, one trust prompt to answer, and every tool arrives as one group in the tools picker, which is easier to switch on and off per chat than five separate ones.",
    windsurf: "One entry rather than five, and the arithmetic is worth doing: 49 tools against Cascade's ceiling of 100 leaves room for roughly one more server of this size, not four.",
    cline: "One entry with one autoApprove array covering 49 tools. Set that array deliberately rather than emptying it: it now spans tools that write invoices, spreadsheets and PDFs.",
  },
};

const FAQ = {
  "claude-desktop": (s) => [
    {
      q: "Where is claude_desktop_config.json?",
      a: "macOS: ~/Library/Application Support/Claude/claude_desktop_config.json. Windows: %APPDATA%\\Claude\\claude_desktop_config.json. There is no published Linux path. Settings, Developer, Edit Config opens the right copy and creates it if it does not exist.",
    },
    {
      q: "I added it and " + s.title + " does not appear.",
      a: "In order: did you fully quit and restart, not just close the window? Is every path absolute? And is the command resolvable, given the limited environment a stdio server inherits here? If node came from nvm, paste what which npx prints.",
    },
    {
      q: "Can I install it without editing JSON?",
      a: "Yes. An .mcpb bundle, the format renamed from .dxt, opens with Claude and shows an installation dialog. One you built yourself goes in through Settings, Extensions, Advanced settings, Install Extension.",
    },
  ],
  "claude-code": (s) => [
    {
      q: "Which scope should I use for " + s.title + "?",
      a: "Local, the default, writes ~/.claude.json and is private to you and that directory. --scope project writes .mcp.json at the repository root, shared through version control. --scope user loads it everywhere.",
    },
    {
      q: "Why did my first prompt ignore the server?",
      a: "Measured, not documented: of three fresh projects, one first prompt made zero tool calls although initialize answered in 1.05 seconds. Run claude mcp list once first: it prints Connected, and the next run used the tool.",
    },
    {
      q: "Can I use " + s.title + " without installing anything?",
      a: s.hosted
        ? "Yes: claude mcp add --transport http " + s.hosted + " https://mcp.zovo.one/mcp/" + s.hosted + " --header \"Authorization: Bearer <token>\". Mint a free token at https://mcp.zovo.one/mcp/token or use a Pro key. -t and -H are the short forms."
        : "Not this one; it starts five child processes, so it runs locally over stdio. The five servers behind it are each hosted at https://mcp.zovo.one/mcp if you want a no-install route.",
    },
  ],
  cursor: (s) => [
    {
      q: "Project config or global config?",
      a: "<project>/.cursor/mcp.json applies to that project and can be committed, which suits a server tied to one client. ~/.cursor/mcp.json applies everywhere. Both are managed from the Customize page.",
    },
    {
      q: "Why does my stdio entry not start?",
      a: "The current field table marks type as required, with stdio for a locally launched server, so include it. Pointing at a remote endpoint, envFile is documented as stdio-only and is not read.",
    },
    {
      q: "Is there a one-click install link?",
      a: "Servers in Cursor's marketplace get an Add to Cursor button. The deeplink reference currently documents prompt, command and rule links only, so for " + s.title + " pasting the config block above is the supported route.",
    },
  ],
  vscode: (s) => [
    {
      q: "Why does my mcp.json do nothing?",
      a: "The key is servers, not mcpServers. A config copied from a Claude Desktop README parses cleanly and contributes nothing. Rename it. On the newer Agent Host, use a workspace .mcp.json instead.",
    },
    {
      q: "Do I have to edit the file at all?",
      a: "No. code --add-mcp takes the server object on the command line, and MCP: Add Server in the palette asks whether the target is Workspace or Global.",
    },
    {
      q: "Where do the " + s.title + " tools show up?",
      a: "In Chat, behind the tools picker, once the server has started. Adding or changing one raises a prompt asking you to confirm you trust it; if the picker is empty, that prompt is usually still waiting.",
    },
  ],
  windsurf: (s) => [
    {
      q: "Where does Windsurf keep its MCP config?",
      a: "~/.codeium/windsurf/mcp_config.json, under mcpServers. Reach it from the MCPs icon at the top right of the Cascade panel, or Devin Settings, Cascade, MCP Servers.",
    },
    {
      q: "I edited the file and a new tab still cannot see " + s.title + ".",
      a: "That file applies to the legacy Cascade agent only. The Devin Local agent, the default for new tabs, reads its servers from the Devin CLI config files instead. Check which agent the tab runs.",
    },
    {
      q: "How many servers can I load at once?",
      a: "Cascade reaches at most 100 tools at any one time, and every enabled server spends from that single budget. " + s.title + " contributes " + s.toolCount + ", so keep the enabled list short rather than counting servers.",
    },
  ],
  cline: (s) => [
    {
      q: "Where does the config live?",
      a: "The CLI reads ~/.cline/mcp.json. For the extension, do not hunt for a path: MCP Servers icon, Configure tab, Configure MCP Servers. cline mcp opens a wizard, and cline config mcp --json is the non-interactive form.",
    },
    {
      q: "The hosted endpoint will not connect.",
      a: "Set the transport explicitly. Omitting type falls back to the legacy sse transport, so streamable HTTP needs \"type\": \"streamableHttp\" written in. It is the one default here that sends you debugging a server that works.",
    },
    {
      q: "Should I auto-approve " + s.title + "'s tools?",
      a: "Approve the read-only ones and leave the writing ones behind a click: each entry carries an autoApprove array and a disabled flag.",
    },
  ],
};

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function serverJson(clientId, s) {
  const c = CLIENTS[clientId];
  const typeLine = clientId === "cursor" ? '\n      "type": "stdio",' : "";
  const extra = clientId === "cline" ? ',\n      "disabled": false,\n      "autoApprove": []' : "";
  const inner = `{${typeLine}
      "command": "npx",
      "args": ["-y", "${s.pkg}"]${extra}
    }`;
  return `{
  "${c.key}": {
    "${s.slug}": ${inner}
  }
}`;
}

function installBlock(clientId, s) {
  const c = CLIENTS[clientId];
  if (clientId === "claude-code") {
    return `<pre><code>claude mcp add ${s.slug} -- npx -y ${esc(s.pkg)}
claude mcp list    # health-check it before the first prompt

# or --scope project, committed to .mcp.json for the team</code></pre>`;
  }
  if (clientId === "vscode") {
    return `<pre><code>// .vscode/mcp.json  (the key is "servers")
${esc(serverJson(clientId, s))}</code></pre>
<p>Or from a terminal:</p>
<pre><code>code --add-mcp '{"name":"${s.slug}","command":"npx","args":["-y","${esc(s.pkg)}"]}'</code></pre>`;
  }
  if (clientId === "claude-desktop") {
    return `<pre><code>${esc(serverJson(clientId, s))}</code></pre>
<p>If node came from nvm, asdf or homebrew, replace <code>"npx"</code> with the absolute path that <code>which npx</code> prints:</p>
<pre><code>"command": "/Users/you/.nvm/versions/node/v22.14.0/bin/npx"</code></pre>`;
  }
  return `<pre><code>${esc(serverJson(clientId, s))}</code></pre>`;
}

function hostedBlock(clientId, s) {
  if (!s.hosted) {
    return `<p>The suite starts five child processes, so it has no hosted form. Each of the five is served at <code>${BASE}/mcp/&lt;name&gt;</code> over MCP streamable HTTP instead: mint a free token with <code>curl ${BASE}/mcp/token</code>, or use a Pro key as the bearer.</p>`;
  }
  const url = `${BASE}/mcp/${s.hosted}`;
  const lead = `<p>The same server runs at <code>${url}</code> over MCP streamable HTTP, no install. Mint a free token with <code>curl ${BASE}/mcp/token</code>, or use a Pro key. It has no filesystem, so a file comes back as a one-hour download link.</p>`;
  if (clientId === "claude-code") {
    return `${lead}
<pre><code>claude mcp add --transport http ${s.slug} ${url} \\
  --header "Authorization: Bearer &lt;token&gt;"</code></pre>`;
  }
  if (clientId === "cline") {
    return `${lead}
<p>Write the transport in. Omitting <code>type</code> falls back to the legacy <code>sse</code> transport, which will not talk to this endpoint:</p>
<pre><code>{
  "mcpServers": {
    "${s.slug}": {
      "type": "streamableHttp",
      "url": "${url}",
      "headers": { "Authorization": "Bearer &lt;token&gt;" }
    }
  }
}</code></pre>`;
  }
  return `${lead}
<pre><code>{
  "${CLIENTS[clientId].key}": {
    "${s.slug}": {
      "url": "${url}",
      "headers": { "Authorization": "Bearer &lt;token&gt;" }
    }
  }
}</code></pre>`;
}

function neighbours(clientId) {
  const i = CLIENT_ORDER.indexOf(clientId);
  const prev = CLIENT_ORDER[(i - 1 + CLIENT_ORDER.length) % CLIENT_ORDER.length];
  const next = CLIENT_ORDER[(i + 1) % CLIENT_ORDER.length];
  return [prev, next];
}

/** Build one /setup/<client>/<server> page. Returns {title, description, body, faq, canonical}. */
export function setupPage(clientId, serverId) {
  const c = CLIENTS[clientId];
  const s = SETUP_SERVERS[serverId];
  if (!c || !s) return null;
  const canonical = `${BASE}/setup/${clientId}/${serverId}`;
  const title = `${s.title} in ${c.name}`;
  const description = `Install ${s.title} in ${c.name}: the exact ${c.file} entry, three prompts that work, and ${c.caveatShort}.`.slice(0, 154);

  const promptRows = s.prompts
    .map(([p, t]) => `<tr><td>${esc(p)}</td><td><code>${esc(t)}</code></td></tr>`)
    .join("");

  const pathRows = c.paths.map(([os, p]) => `<tr><td>${esc(os)}</td><td><code>${esc(p)}</code></td></tr>`).join("");

  const [prev, next] = neighbours(clientId);
  const faq = FAQ[clientId](s);

  const body = `<p class="muted"><a href="/">Home</a> &middot; <a href="/setup">Setup</a> &middot; <a href="/setup/${clientId}">${esc(c.name)}</a></p>
<h1>${esc(title)}</h1>
<p>${esc(s.tagline)} ${esc(s.does)}</p>
<p>${esc(ANGLE[serverId][clientId])}</p>

<h2>What you get in ${esc(c.name)}</h2>
<table><tr><th>You say</th><th>Tool</th></tr>${promptRows}</table>
<p>${esc(s.measured)}</p>

<h2>Install it in ${esc(c.name)}</h2>
<p>The file is <code>${esc(c.file)}</code>, and the key inside it is <code>${esc(c.key)}</code>.</p>
<table><tr><th>Scope</th><th>Path</th></tr>${pathRows}</table>
${installBlock(clientId, s)}
<p>${esc(c.restart)}</p>
<p class="muted">The npm publish of <code>${esc(s.pkg)}</code> is pending; until then use the <code>.mcpb</code> bundle or a clone and build from <a href="${REPO}/releases/latest">the latest release</a>.</p>

<h2>No install: the hosted endpoint</h2>
${hostedBlock(clientId, s)}

<h2>${esc(c.name)} notes worth knowing first</h2>
<p>${esc(c.caveat)}</p>

<p class="muted">Free: ${esc(s.free)} Pro is $${serverId === "office-suite" ? 39 : 19} once, verified offline.</p>

<h2>Questions</h2>
${faq.map((f) => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`).join("\n")}

<h2>Related</h2>
<p>${s.sPage ? `<a href="${s.sPage}">${esc(s.title)} in detail</a> &middot; ` : ""}The same server in <a href="/setup/${prev}/${serverId}">${esc(CLIENTS[prev].name)}</a> and <a href="/setup/${next}/${serverId}">${esc(CLIENTS[next].name)}</a> &middot; <a href="/setup/${clientId}">Every server in ${esc(c.name)}</a> &middot; <a href="/guides">Guides</a> &middot; <a href="${esc(c.docs)}">${esc(c.name)} docs</a></p>`;

  return { title, description, body, faq, canonical };
}

/** Build one /setup/<client> hub page. */
export function clientHub(clientId) {
  const c = CLIENTS[clientId];
  if (!c) return null;
  const canonical = `${BASE}/setup/${clientId}`;
  const title = `MCP servers for ${c.name}: install guides`;
  const description = `Six MCP servers set up in ${c.name}, each with the exact ${c.file} entry: time tracking, invoices, expenses, spreadsheets and price watching.`.slice(0, 154);
  const rows = SERVER_ORDER.map(
    (id) =>
      `<tr><td><a href="/setup/${clientId}/${id}">${esc(SETUP_SERVERS[id].title)} in ${esc(c.name)}</a><br><span class="muted">${esc(SETUP_SERVERS[id].tagline)}</span></td></tr>`
  ).join("");
  const pathRows = c.paths.map(([os, p]) => `<tr><td>${esc(os)}</td><td><code>${esc(p)}</code></td></tr>`).join("");
  const [prev, next] = neighbours(clientId);
  const body = `<p class="muted"><a href="/">Home</a> &middot; <a href="/setup">Setup</a></p>
<h1>${esc(title)}</h1>
<p>${esc(c.name)} reads its MCP servers from <code>${esc(c.file)}</code> under the <code>${esc(c.key)}</code> key. ${esc(c.reach)} ${esc(c.restart)}</p>
<table><tr><th>Scope</th><th>Path</th></tr>${pathRows}</table>
<h2>The one thing that catches people out</h2>
<p>${esc(c.caveat)}</p>
<h2>Servers</h2>
<table>${rows}</table>
<p>Each page carries the exact config entry, three prompts that were run against the server, and the hosted alternative that needs no install.</p>
<h2>Other clients</h2>
<p><a href="/setup/${prev}">${esc(CLIENTS[prev].name)}</a> &middot; <a href="/setup/${next}">${esc(CLIENTS[next].name)}</a> &middot; <a href="/setup">All clients</a> &middot; <a href="/guides">Guides</a> &middot; <a href="${esc(c.docs)}">${esc(c.name)} MCP docs</a></p>`;
  return { title, description, body, canonical };
}

/** Build the /setup index. */
export function setupIndex() {
  const canonical = `${BASE}/setup`;
  const title = "Set up an MCP server in your client";
  const description = "Exact config file paths and entries for six MCP servers in Claude Desktop, Claude Code, Cursor, VS Code, Windsurf and Cline.";
  const clientRows = CLIENT_ORDER.map(
    (id) =>
      `<tr><td><a href="/setup/${id}">${esc(CLIENTS[id].name)}</a></td><td><code>${esc(CLIENTS[id].file)}</code></td><td><code>${esc(CLIENTS[id].key)}</code></td><td>${esc(CLIENTS[id].caveatShort)}</td></tr>`
  ).join("");
  const serverRows = SERVER_ORDER.map(
    (id) =>
      `<tr><td>${esc(SETUP_SERVERS[id].title)}</td><td>${CLIENT_ORDER.map((c) => `<a href="/setup/${c}/${id}">${esc(CLIENTS[c].short)}</a>`).join(" &middot; ")}</td></tr>`
  ).join("");
  const body = `<p class="muted"><a href="/">Home</a></p>
<h1>${esc(title)}</h1>
<p>Six servers, six clients, one page each: the config file that client actually reads, the entry to put in it, three prompts that were run against the server, and the hosted endpoint if you would rather install nothing. The two facts that cause most failed installs are in the table below: the file name and the top-level key are not the same across clients.</p>
<table><tr><th>Client</th><th>Config file</th><th>Key</th><th>Watch out for</th></tr>${clientRows}</table>
<h2>Pages</h2>
<table><tr><th>Server</th><th>In</th></tr>${serverRows}</table>
<p><a href="/">All servers and prices</a> &middot; <a href="/guides">Guides</a></p>`;
  return { title, description, body, canonical };
}

/** Every URL this module serves, for the sitemap and llms.txt. */
export function setupUrls() {
  const urls = ["/setup"];
  for (const c of CLIENT_ORDER) {
    urls.push(`/setup/${c}`);
    for (const s of SERVER_ORDER) urls.push(`/setup/${c}/${s}`);
  }
  return urls;
}
