/**
 * /setup/<client>/<server> long-tail pages.
 *
 * Every fact in CLIENTS below was read off the client's own public documentation on
 * 2026-09-02 with curl; the `docs` URL on each entry is the page it came from. Every
 * number quoted in the generated prose comes from docs/USER_VALUE_R4.md or from the
 * server READMEs, not from invention.
 *
 * The page bodies are composed from three sources so no two of the 72 pages read alike:
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
  "claude-web": {
    name: "Claude.ai and Claude Desktop connectors",
    short: "Claude.ai",
    docs: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
    file: null,
    key: null,
    paths: [
      ["Individual, Pro or Max", "Customize (claude.ai) or Settings (Claude Desktop), Connectors, the + button, Add custom connector"],
      ["Team or Enterprise", "an Owner or Primary Owner adds it once at Organization settings, Connectors, Add, Custom, Web; members then click Connect on it from Customize, Connectors"],
    ],
    reach: "There is no config file here: the Add custom connector form asks for a name and a Remote MCP server URL, with an Advanced settings section for an optional OAuth Client ID and Client Secret.",
    cli: null,
    oneClick: null,
    restart: "No restart. Click Connect once the connector is added, then turn it on for a conversation from the + button, Connectors.",
    caveat: "On an individual Pro or Max plan you add the connector yourself from Customize, Connectors. On Team and Enterprise it is the other way round: only an Owner or Primary Owner can add a custom connector, at Organization settings, Connectors, and members then connect to what the Owner added rather than pasting their own URL.",
    caveatShort: "Team and Enterprise plans need an Owner to add it first",
    envNote: "There is no env or headers field in this form. The token lives in the URL path, so nothing needs to be typed into Advanced settings.",
  },
};

export const CLIENT_ORDER = Object.keys(CLIENTS);

/** Servers that get a page for this client. claude-web skips office-suite: it starts
 * twenty child processes and has no single connector URL. */
const WEB_EXCLUDED = ["office-suite"];
export function serversFor(clientId) {
  return clientId === "claude-web" ? SERVER_ORDER.filter((id) => !WEB_EXCLUDED.includes(id)) : SERVER_ORDER;
}

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
  currency: {
    title: "MCP Currency Converter",
    slug: "currency",
    toolCount: "10 tools",
    pkg: "@theluckystrike/mcp-currency",
    sPage: "/s/currency",
    hosted: null,
    tagline: "ECB reference rates with the rate date on every answer.",
    does: "It caches the European Central Bank's daily and historical euro reference rates, converts between any currencies the ECB quotes through EUR cross rates, and emits the exact fx_rates object the expense tracker needs to rebill a project in one currency.",
    prompts: [
      ["What is 4,500 EUR in USD today?", "convert"],
      ["What was the GBP rate on 30 August?", "rate_on"],
      ["Rebill Nova in USD using today's rates.", "fx_rates_for then expense_to_invoice"],
    ],
    free: "latest rates, convert, convert_many, fx_rates_for, history windows up to 90 days.",
    pro: "Any date and any window back to 1999-01-04.",
    measured: "Counted from the published history file: the ECB series runs 1999-01-04 to 2026-09-02, 10,104 calendar days holding 7,084 dates, so 29.9% of dates carry no rate. Every answer names the rate date it actually used.",
  },
  docx: {
    title: "MCP Docx",
    slug: "docx",
    toolCount: "10 tools",
    pkg: "@theluckystrike/mcp-docx",
    sPage: "/s/docx",
    hosted: null,
    tagline: "Real Word documents from chat: proposals, contracts, quotes.",
    does: "It writes .docx files from sections or from markdown, generates priced proposals and freelance service agreements with reference numbers that never repeat, reads an existing Word file back as text and outline, and fills {{placeholders}} in a template while keeping its styles.",
    prompts: [
      ["Write a proposal for Beta Corp: checkout rebuild, 4,500 EUR, three phases.", "proposal_create"],
      ["Fill my NDA template with this client's details.", "doc_fill_template"],
      ["What does this proposal.docx actually say?", "doc_read"],
    ],
    free: "unlimited create, convert and read; 3 proposals or contracts per calendar month; templates up to 10 placeholders.",
    pro: "Unlimited proposals and contracts, letterhead logo and colour, any template.",
    measured: "The worked proposal issued PROP-2026-0001 at EUR 4,500.00 with a timeline table and a signature block. Template filling substitutes on the joined paragraph text, so a placeholder Word split into three runs is still replaced.",
  },
  timezone: {
    title: "MCP Timezone Planner",
    slug: "timezone",
    toolCount: "11 tools",
    pkg: "@theluckystrike/mcp-timezone",
    sPage: "/s/timezone",
    hosted: null,
    tagline: "Find meeting slots inside everyone's working hours.",
    does: "It converts times between IANA zones with DST read from the ICU data in your Node build, ranks meeting slots where every participant is inside their own working hours, computes the daily overlap and clock changes, and writes .ics files.",
    prompts: [
      ["Find an hour next week for me in Warsaw, my client in New York and my designer in London.", "find_meeting_slots"],
      ["When are Warsaw and New York both at work?", "overlap"],
      ["Write me the .ics for Thursday 3pm Warsaw, 45 minutes.", "ics_create"],
    ],
    free: "conversions, overlap, DST and business days unlimited; slots for 3 participants over 5 days, 5 contacts, 3 ics a month.",
    pro: "Unlimited participants, days, contacts and ics files, plus recurring slot search.",
    measured: "Warsaw and New York on 09:00 to 17:00 days share 2 hours on 2026-09-10 and 3 hours on 2026-03-16, because the United States moves to daylight time on 8 March and Europe on 29 March. The overlap is computed on a real date, so it says so.",
  },
  resume: {
    title: "MCP Resume and Cover Letter",
    slug: "resume",
    toolCount: "10 tools",
    pkg: "@theluckystrike/mcp-resume",
    sPage: "/s/resume",
    hosted: null,
    tagline: "Resumes and cover letters as Word files, from one stored profile.",
    does: "It keeps one structured profile, writes the resume as .docx trimmed to a page budget with the posting's keywords bolded where you actually have them, drafts a one-page cover letter whose every proof line is a verbatim bullet from that profile, and reports the gaps against a job description instead of filling them in.",
    prompts: [
      ["Here is my CV: Ada Rowe, backend engineer, Acme Pay since 2021.", "profile_set"],
      ["How well do I match this posting?", "tailor_to_job"],
      ["Make me a one-page resume for this role and write the letter, direct tone.", "resume_create then cover_letter_create"],
    ],
    free: "profile, the modern style, markdown and HTML exports, 3 cover letters a month, postings up to 2,000 characters.",
    pro: "All three styles, unlimited letters and tailoring, named profile variants, your own accent colour.",
    measured: "There is no page-layout engine in pure JavaScript, so trimming runs on a word budget: 450 words of body text per A4 page, 540 in the compact style. Every role keeps its first bullet before any role gets a second, and every bullet dropped is named in the response.",
  },
  recurring: {
    title: "MCP Recurring Invoices",
    slug: "recurring",
    toolCount: "13 tools",
    pkg: "@theluckystrike/mcp-recurring",
    sPage: "/s/recurring",
    hosted: null,
    tagline: "Retainers and subscriptions billed on a schedule you set once.",
    does: "It stores a billing schedule per client, weekly, monthly, quarterly, yearly or every N days, shows what falls due, and generates exactly one invoice per schedule per period into the invoice server's own store with its number series and its A4 PDF.",
    prompts: [
      ["Bill Acme 12 hours at 90 EUR every month from the 1st, 14 day terms.", "schedule_create"],
      ["Show me what this month's billing run would create before you create it.", "invoice_generate_due with dry_run"],
      ["What is due in the next 30 days?", "schedule_upcoming"],
    ],
    free: "3 active schedules, unlimited generation, a 30 day upcoming view and a 3 month forecast.",
    pro: "Unlimited schedules, a 10 year horizon, a 120 month forecast, the audit log, anchor day and end of month rules.",
    measured: "The worked run created 4 invoices totalling EUR 4,320.00 and, repeated five minutes later, created 0 and skipped 4. The key is the period, not the calendar day, so a billing run you forgot you already did is a no-op rather than four duplicate invoices.",
  },
  clauses: {
    title: "MCP Clause Library",
    slug: "clauses",
    toolCount: "12 tools",
    pkg: "@theluckystrike/mcp-clauses",
    sPage: "/s/clauses",
    hosted: null,
    tagline: "Reusable contract clauses, searched and assembled into Word.",
    does: "It ships 25 generic freelance clauses across 11 categories, each holding {{variables}}, lets you add and rank-search your own, lists which variables a selection still needs, and assembles the picked clauses into a numbered .docx or markdown document that opens with a not-legal-advice line.",
    prompts: [
      ["What clauses do I have about late payment?", "clause_search"],
      ["What do I still need to fill in for those five clauses?", "variables_list"],
      ["Draft a service agreement for Beta Corp: scope, payment, IP, termination. 4,500 EUR, 14 day terms.", "contract_assemble"],
    ],
    free: "the 25 starters plus 10 of your own, ranked search, up to 8 clauses per document, markdown import and export.",
    pro: "Unlimited clauses, jurisdiction and tag filters, JSON import and export, unlimited assembly, clause versions.",
    measured: "A variable you do not supply is never guessed and never blanked: it is printed as a visible bracketed prompt such as [late fee percent], so the unfinished part of the draft is the part you can see. Nothing here has been reviewed by a lawyer in any jurisdiction.",
  },
  "office-suite": {
    title: "MCP Office Suite",
    slug: "office-suite",
    toolCount: "198 tools",
    pkg: "@theluckystrike/mcp-office-suite",
    sPage: null,
    hosted: null,
    tagline: "One config entry that exposes every tool of all twenty servers.",
    does: "It starts all twenty sibling servers as child processes and exposes every tool, resource and prompt under one server, with one license pair. Only two of the 198 tool names collided and needed a server-name prefix: invoice_business_set and docx_business_set.",
    prompts: [
      ["Log 3 hours today on Nova design and invoice them at EUR 90.", "entry_add then invoice_from_hours"],
      ["Resize this logo to 512px and put it on a PAID stamp on invoice INV-2026-0001's PDF.", "image_resize, invoice_pdf, pdf_stamp: three children"],
      ["Zip this month's invoices and quotes.", "zip_bundle_month, one call"],
    ],
    free: "each child keeps its own free tier.",
    pro: "One $39 bundle key activates Pro on all twenty children at once.",
    measured: "A six-prompt audit needing two or more children per sentence put 186 tools on one allowlist, the CLI's own file and web tools denied. Result: 20 of 20 tool calls landed in the correct child and the correct tool, zero wrong-server picks, 13 of 18 scored, against 50 of 51 correct at 108 tools when this bundle held five children.",
  },
  pdf: {
    title: "MCP PDF Tools",
    slug: "pdf",
    toolCount: "12 tools",
    pkg: "@theluckystrike/mcp-pdf",
    sPage: "/s/pdf",
    hosted: null,
    tagline: "Merge, split, stamp and read PDFs, pure JavaScript, no upload.",
    does: "It merges and splits PDFs, extracts and reorders pages, rotates a sideways scan, stamps PAID or DRAFT or any text, watermarks the business name and VAT id from the shared profile, and reads text back best effort with no OCR.",
    prompts: [
      ["Stamp PAID on this invoice and save a copy.", "pdf_stamp"],
      ["Join these three PDFs into one file.", "pdf_merge"],
      ["Split the scan: pages 1-3 are the invoice, 4 onwards is the receipt.", "pdf_split"],
    ],
    free: "info, count and text unlimited; merge up to 5 files; edits on files up to 30 pages; the PAID and DRAFT stamp presets.",
    pro: "Any number of files and pages, custom stamp text and colour, business watermark, page reorder.",
    measured: "The worked run stamped PAID on a 1-page invoice and wrote a new 0.9 MB file; the original file was byte-for-byte unchanged, which every writing tool here guarantees on purpose.",
  },
  calendar: {
    title: "MCP Calendar",
    slug: "calendar",
    toolCount: "12 tools",
    pkg: "@theluckystrike/mcp-calendar",
    sPage: "/s/calendar",
    hosted: null,
    tagline: "Read .ics calendars: events, free and busy, conflicts, exports.",
    does: "It imports a .ics export from Google, Apple or Outlook, expands recurring series correctly across DST, lists events, computes free and busy blocks, flags overlapping events across every imported calendar, exports a selection, and turns a meeting into a time entry.",
    prompts: [
      ["What is on my calendar next week and where am I free for two hours?", "events_list then free_busy"],
      ["Do any of my meetings clash this week?", "conflicts"],
      ["Log yesterday's Nova call as billable time.", "event_to_time_entry"],
    ],
    free: "2 calendars, windows up to 31 days, exports up to 50 events.",
    pro: "Unlimited calendars, any window, unlimited exports, URL and webcal feed imports.",
    measured: "VTIMEZONE blocks in the file are ignored on purpose: every offset is computed from the ICU data inside Node from the TZID name, which is what keeps a weekly 10:00 Warsaw meeting at 10:00 local across the March clock change instead of drifting to 11:00.",
  },
  kanban: {
    title: "MCP Kanban",
    slug: "kanban",
    toolCount: "16 tools",
    pkg: "@theluckystrike/mcp-kanban",
    sPage: "/s/kanban",
    hosted: null,
    tagline: "A task board per project that hands off to the time tracker.",
    does: "It keeps tasks per project in columns with due dates, estimates, priorities and tags, shows the board, overdue items and a weekly review of planned versus done, and starts a time-tracker timer from a task with the link recorded on it.",
    prompts: [
      ["Add a task to the nova site board: write the launch email, due Friday, 90 minutes.", "task_add"],
      ["What's overdue, and start the timer on the API task.", "overdue then task_start_timer"],
      ["Weekly review.", "weekly_review"],
    ],
    free: "3 project boards, 200 open tasks, the default five columns.",
    pro: "Unlimited projects and tasks, custom columns, full weekly review history, estimates versus actuals every week.",
    measured: "Two server processes on one data directory firing 40 concurrent task_add calls at the same board all persisted with unique ids and the counter landed on exactly 41, which is what the advisory lock around the id counter is there to guarantee.",
  },
  image: {
    title: "MCP Image Tools",
    slug: "image",
    toolCount: "12 tools",
    pkg: "@theluckystrike/mcp-image",
    sPage: "/s/image",
    hosted: null,
    tagline: "Resize, convert, compress and watermark images, pure JavaScript.",
    does: "It reads PNG, JPEG, BMP, GIF and TIFF, resizes with inside, cover or exact fit, converts formats, compresses with a byte report, crops, batches thumbnails, strips metadata by re-encoding, and watermarks with the shared business name or custom text.",
    prompts: [
      ["Make this 1200 px wide and under 300 KB.", "image_compress"],
      ["Thumbnail these five and watermark them.", "image_thumbnails then image_watermark"],
      ["Strip the GPS coordinates before I send this.", "image_strip_metadata"],
    ],
    free: "info, resize, convert, compress, crop and strip-metadata on images up to 4 MP; batches of 5.",
    pro: "Any size and any batch, custom watermark text, dominant colours.",
    measured: "Quantizing a 300x220 noisy PNG to 16 colours was measured against the original: 115,451 bytes against 39,262, 2.9 times larger, because quantizing destroys the row similarity PNG's own compression depends on. That is why quality only applies to a JPEG output and the extension of out_path picks the codec.",
  },
  "bank-statement": {
    title: "MCP Bank Statement",
    slug: "bank-statement",
    toolCount: "11 tools",
    pkg: "@theluckystrike/mcp-bank-statement",
    sPage: "/s/bank-statement",
    hosted: null,
    tagline: "Bank CSV exports categorised, summarised and reconciled with expenses.",
    does: "It reads a bank CSV export from Revolut, Wise, mBank, PKO BP, ING, N26 or a generic debit/credit layout, finds the header row under any preamble, parses amounts in the file's own locale, and dedupes on re-import so a second import of the same file adds nothing.",
    prompts: [
      ["Import this Revolut export and categorise it.", "statement_import"],
      ["What did I spend this month, by category?", "statement_summary"],
      ["Which expenses have no bank line, and what subscriptions am I paying?", "reconcile_expenses then recurring_detect"],
    ],
    free: "2 accounts, 12 months of history, 5 category rules, summary and search.",
    pro: "Unlimited accounts, history and rules, reconcile_expenses, recurring_detect, statement_export.",
    measured: "The 60-row test fixture: 60 transactions stored, then 0 stored and 60 duplicates reported on re-import of the same file. recurring_detect on it found a monthly Spotify charge, 3 occurrences, EUR 9.99, annualised EUR 119.88.",
  },
  quotes: {
    title: "MCP Quotes",
    slug: "quotes",
    toolCount: "11 tools",
    pkg: "@theluckystrike/mcp-quotes",
    sPage: "/s/quotes",
    hosted: null,
    tagline: "A priced, VAT-correct quote from chat, turned into an invoice with one call.",
    does: "It quotes a client with line items, VAT and a validity window, sends the quote as pasteable text, tracks it as open, accepted, declined or expired, and turns an accepted quote into a real invoice in the shared invoice store using the quote's own stored lines rather than recomputed prices.",
    prompts: [
      ["Quote Acme for 12 hours at 90 EUR plus a 300 EUR setup, 23% VAT, good for 14 days.", "quote_create"],
      ["Acme said yes. Invoice it.", "quote_accept"],
      ["What is still open, and what is my win rate?", "quote_report"],
    ],
    free: "5 open quotes at a time, unlimited quote_send_text, create/revise/accept/decline, VAT, discounts and multi-currency.",
    pro: "Unlimited open quotes, quote_pdf, quote_report with the win rate and the value still open.",
    measured: "A quote of EUR 1,000.00 net is issued at the profile's 23% default rate, so the client sees EUR 1,230.00. The default rate is then changed to 8% before the client answers. quote_accept still invoices EUR 1,230.00, tax_lines[0].rate === 23, because it copies the quote's stored lines instead of recomputing them against today's profile.",
  },
  barcode: {
    title: "MCP Barcode",
    slug: "barcode",
    toolCount: "10 tools",
    pkg: "@theluckystrike/mcp-barcode",
    sPage: "/s/barcode",
    hosted: "barcode",
    tagline: "QR codes and barcodes drawn locally: SEPA payment codes, WiFi, vCard, Code 128, EAN-13.",
    does: "It draws a QR code from text or a URL, a WiFi join code, a vCard, an EPC069-12 SEPA payment code checked against the shared business profile's IBAN, and Code 128, EAN-13, EAN-8 or UPC-A with the check digit computed or verified. No network call of any kind.",
    prompts: [
      ["Make a QR code for this URL.", "qr_create"],
      ["Put a payment QR code on invoice INV-2026-0007.", "invoice_payment_qr"],
      ["Give this SKU a Code 128 barcode.", "barcode_create"],
    ],
    free: "20 codes a calendar month, every symbology and QR kind, SVG output.",
    pro: "PNG output up to 4000 px, and barcode_batch for up to 500 rows a call.",
    measured: "The first Code 128 table transcription was missing one row, silently shifting 67 of 107 values to their neighbour: a clean-looking barcode that scanned as the wrong string. Comparing against an independent encoder caught it; every table is now pinned against that comparison in the test suite.",
  },
  "billing-docs": {
    title: "MCP Billing Docs",
    slug: "billing-docs",
    toolCount: "14 tools",
    pkg: "@theluckystrike/mcp-billing-docs",
    sPage: "/s/billing-docs",
    hosted: null,
    tagline: "Credit notes and purchase orders written against the invoices the invoice server already holds, with the VAT unwound at the rate you charged.",
    does: "It credits an invoice in full, by a gross amount or by named lines and quantities, storing every money field negative in minor units so a period's documents sum to the net of what was billed, and it refuses to give back more than the invoice's remaining creditable amount. It also raises purchase orders to suppliers with line items, VAT, currency and an expected delivery date, receives them in full or in part, and reports credited and on-order totals per currency alongside deliveries past their date.",
    prompts: [
      ["Credit invoice INV-2026-0001 in full, the client sent the work back.", "credit_note_create"],
      ["Raise a purchase order to Nordic Print for 500 brochures at 1.20 each, due the 20th.", "purchase_order_create"],
      ["Which purchase orders are past their delivery date?", "billing_docs_report"],
    ],
    free: "5 documents a calendar month, credit notes and purchase orders together, counted by issue date. Both text exports are never metered, and full, partial and per-line credit notes, VAT, multiple currencies and receiving orders are all on the free tier.",
    pro: "Unlimited documents, both A4 PDFs with your logo and no footer credit, and the credited, on-order and overdue-delivery report.",
    measured: "Crediting ten percent of a mixed-VAT invoice at a single rate and splitting it across the invoice's own rates give the same gross, EUR 177.00, and VAT lines that differ by EUR 6.10, 22.6 percent. The client's document and the payment are identical either way, so nothing downstream ever surfaces the error; only the VAT return does. The split is done at the point the document is written.",
  },
  deposits: {
    title: "MCP Deposits",
    slug: "deposits",
    toolCount: "10 tools",
    pkg: "@theluckystrike/mcp-deposits",
    sPage: "/s/deposits",
    hosted: null,
    tagline: "Security and retainer deposits held per client, applied to the invoices the invoice server already holds.",
    does: "It records a deposit when the money arrives, in minor units and in the currency it arrived in, then answers for it: what is held per client and per currency, since when, and what has already gone. Applying a deposit to an invoice writes the payment onto that invoice under both locks, adding to what was already paid rather than replacing it, and it can never pay out more than the deposit still holds or more than the invoice still owes. Refunds hand the money back without touching the invoice, and the statement is one client in one currency, as text or as an A4 PDF that matches the invoice and credit note beside it.",
    prompts: [
      ["Record a 500 euro security deposit from Nordic Print, received today.", "deposit_record"],
      ["Apply 300 of that deposit to INV-2026-0001.", "deposit_apply"],
      ["How much are we holding for Nordic Print, and since when?", "deposit_balance"],
    ],
    free: "5 deposits recorded a calendar month, counted by received date. Applying to invoices, refunds, lists, balances and the text statement are unlimited on every tier: a cap that trapped a client's deposit would be a limit on their money rather than on yours.",
    pro: "Unlimited deposits recorded, the A4 statement PDF with your logo and no footer credit, and the held, oldest-held and unapplied report.",
    measured: "deposit_apply ADDS to the invoice's amount paid rather than setting it. Measured through a real client on 2026-09-05: an invoice already carrying a EUR 200.00 bank transfer ended at paid_minor 50000 after a EUR 300.00 deposit was applied, reported as paid EUR 500.00 of EUR 1,230.00 with EUR 730.00 due. Writing this server against the same field is what surfaced that invoice_mark_paid was assigning rather than adding, which silently lost the earlier payment; the invoice server was fixed the same day and now adds too.",
  },
  zip: {
    title: "MCP Zip",
    slug: "zip",
    toolCount: "9 tools",
    pkg: "@theluckystrike/mcp-zip",
    sPage: "/s/zip",
    hosted: null,
    tagline: "Pack, list and unpack zip archives locally, with traversal, symlink and bomb guards read from the header before anything is inflated.",
    does: "It packs files or a directory tree with glob patterns into a new .zip, lists an archive's entries with sizes and ratios while flagging absolute paths, .., symlinks, encrypted entries and duplicate names, unpacks with a dry run and a skip_unsafe option, reads one text entry inline without unpacking anything, and bundles a calendar month of invoices, quotes and exports from the sibling servers into one file.",
    prompts: [
      ["Zip up this folder, everything except node_modules.", "zip_create"],
      ["What's in this zip before I open it?", "zip_list"],
      ["Bundle August's invoices and expense exports into one zip.", "zip_bundle_month"],
    ],
    free: "20 archives a calendar month, up to 25 MB and 200 entries each. Reading (zip_list, zip_extract, zip_extract_text) is unlimited on both tiers.",
    pro: "Unlimited archives, size and entries a month.",
    measured: "A 100,000-byte entry inflated into a 10-byte bounded buffer returned 10 bytes and threw nothing: a lying header would extract as a silent, plausible-looking truncation. The CRC-32 already stored for the entry is checked before anything reaches disk, and that check is what refuses it instead.",
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
  currency: {
    "claude-desktop": "Claude Desktop is the client people ask a quick question in, and this is the one server here where the quick question has a wrong answer if the tool is missing: the model will happily guess a rate. Installed, every answer comes back with the ECB rate date attached.",
    "claude-code": "The whole chain lives in one terminal session: expense_to_invoice to see which currencies are present, fx_rates_for to fetch them, expense_to_invoice again with the rates, invoice_create to issue. Nobody types an exchange rate.",
    cursor: "If you invoice one client per repository, put the currency server in that project's .cursor/mcp.json next to the expense tracker, and the pair that rebills in the client's currency is scoped to the client's project.",
    vscode: "fx_rates_for returns a plain JSON object, so in agent mode it can be written straight into a file in the workspace and committed next to the invoice it justifies, with the rate date in the same commit.",
    windsurf: "Ten tools out of the 100 Cascade can hold, and one outbound host: www.ecb.europa.eu, only when the local cache is older than 6 hours. It is the cheapest server in this collection to leave enabled.",
    cline: "Every tool here except license_activate is a read, so this is the one server whose whole tool list is safe in autoApprove. The only network destination is the ECB, and nothing about your amounts leaves the machine.",
  },
  docx: {
    "claude-desktop": "Claude Desktop has no working directory, so pass an absolute out_path or let the server write to its own documents folder and open the path it hands back. The proposal layout with your letterhead is the reason to use this client for it: you are already reading the result in a window, not a terminal.",
    "claude-code": "The write_proposal_from_hours prompt takes an invoice_summary out of the time tracker and prices a proposal from hours you actually logged, which only reads naturally in the client where both servers are already loaded in the same session.",
    cursor: "Keep the NDA and the statement of work templates in the repository and doc_fill_template against the committed copy. The filled file lands in the same tree, so the diff shows which document went out and when.",
    vscode: "doc_to_html is the PDF route, and VS Code is the client where that is least awkward: the HTML lands in the Explorer, opens in a preview, and prints from the browser with the print stylesheet applied.",
    windsurf: "One config file for every workspace suits a tool you reach for when a proposal is due rather than daily. Ten tools of Cascade's 100 leaves the budget for the servers you use every hour.",
    cline: "Put doc_read and doc_to_html in autoApprove and keep proposal_create and contract_create out of it. Reading a document is harmless; creating a proposal consumes a PROP reference number, and the counter is written before the record, so a burnt number is never handed out again.",
  },
  timezone: {
    "claude-desktop": "This is the client that is open when the question arrives, which is what contacts_list is for: \"who is awake right now\" answers from the five contacts you saved, with each one's local time and whether they are inside their working hours.",
    "claude-code": "Scheduling from the terminal without leaving it is the point, and the server makes no network call at all, so it behaves the same on a locked-down machine as on your own. The only file it writes is the .ics you asked for.",
    cursor: "Put it in the project config for the client you have standing calls with, save that client's contacts once, and the slot search in that workspace already knows the zones and working hours involved.",
    vscode: "The .ics lands in the workspace and can be opened, checked and sent from the Explorer, which matters because an invite is one of the few outputs here you cannot un-send after the fact.",
    windsurf: "Eleven tools out of Cascade's ceiling of 100, no network calls and no account. Because mcp_config.json applies to every workspace, the contacts you save are reachable from whichever project you are in when a client emails.",
    cline: "Put now, convert_time, overlap and dst_changes in autoApprove: they are pure calculation. Keep ics_create out, because on the free tier it spends one of three files a month, and keep contacts_set out because it writes.",
  },
  resume: {
    "claude-desktop": "A job application is the one thing on this list you do outside a repository, in the evening, in the client you already have open. Give an absolute path when you ask it to read your old resume, and open the .docx it hands back from Finder without leaving the window.",
    "claude-code": "The apply_to_job prompt chains the gap analysis, the resume and the letter against one posting in a single turn, and reporting the gaps back at you rather than filling them in is easier to read in a terminal than in a chat bubble.",
    cursor: "Keep the profile in one place and the postings in another: paste the job text into the chat, read the coverage figure, and let the .docx land in the folder you have open so the version you actually sent is the version on disk.",
    vscode: "The printable HTML lands in the Explorer, opens in a preview and prints to PDF with its own print stylesheet, which is the whole PDF story here because there is no resume_to_pdf.",
    windsurf: "Ten tools out of Cascade's ceiling of 100, and no network calls at all, so a server holding your employment history costs nothing to leave enabled and sends nothing anywhere.",
    cline: "Put profile_get, tailor_to_job and resume_to_markdown in autoApprove and keep cover_letter_create out, because on the free tier each letter spends one of three that month.",
  },
  recurring: {
    "claude-desktop": "This is a monthly ritual rather than a daily one, and Claude Desktop is where people do monthly rituals. Ask for the dry run first, read the four lines it would create, then say run it.",
    "claude-code": "The whole month closes in one session: run the schedules, then invoice the ad hoc hours out of the time tracker into the same invoice store, then read overdue_report. All three servers write to the same directory.",
    cursor: "If you keep one repository per client, the retainer schedule belongs in that project's .cursor/mcp.json next to the invoice server, so the recurring part of that client's billing is scoped to that client's project.",
    vscode: "The invoices and their PDFs are written to the invoice server's data directory rather than the workspace, so the useful thing agent mode adds here is reading the dry run back before anything is issued.",
    windsurf: "One config file for every workspace suits a tool you touch once a month: the schedules are reachable from whichever project happens to be open on the first.",
    cline: "Put schedule_list, schedule_upcoming and forecast in autoApprove and keep invoice_generate_due behind a click. Reading what is due is harmless; generating consumes invoice numbers that never repeat.",
  },
  clauses: {
    "claude-desktop": "Assembling a contract is a reading task, so the client with a window is the right one: ask for the variables list, read what is still bracketed, then assemble and open the .docx from the path it prints.",
    "claude-code": "Keep the library in one data directory and the assembled drafts out of your repositories. The one command worth running first is variables_list, because it names every fact the document needs before the document exists.",
    cursor: "Commit nothing but the exported markdown library. clause_export writes the whole set to markdown on the free tier, so the terms you reuse can live in a repository and be diffed like anything else you maintain.",
    vscode: "Assemble to markdown first and read it in the editor. The .docx is the version you send; the markdown is the version you can review line by line before anyone signs it.",
    windsurf: "Twelve tools out of Cascade's ceiling of 100, no network calls and no account, for a server whose entire content is text you wrote or edited yourself.",
    cline: "Put clause_search, clause_list, clause_get and variables_list in autoApprove and keep clause_delete out of it: a deleted starter clause is not re-seeded on the next call.",
  },
  "office-suite": {
    "claude-desktop": "One entry in claude_desktop_config.json instead of twenty, which matters more here than anywhere else: this is the client where each extra server is another absolute path to get right, and a six-prompt audit at 186 tools put all 20 tool calls in the correct child, zero wrong-server picks.",
    "claude-code": "One `claude mcp add` instead of twenty, and one bundle key. The audited round that asked for a logo resize, an invoice PDF and a PAID stamp in one sentence, three children at once, called the right tool in the right child every time.",
    cursor: "Twenty servers' worth of tools arrive as one entry, so mcp.json holds one object with one required type field instead of twenty, and the Customize page lists one server to enable or disable. Only two of the 198 names needed a server-name prefix to stay unique: invoice_business_set, docx_business_set.",
    vscode: "One entry under the servers key, one trust prompt to answer, and 198 tools arrive as one group in the tools picker, which is easier to switch on and off per chat than twenty separate ones.",
    windsurf: "One entry rather than twenty does not mean one entry fits: 198 tools is past Cascade's ceiling of 100 on its own, so this bundle is the wrong shape here. Install the two or three single servers you actually use instead, 9 to 16 tools each.",
    cline: "One entry with one autoApprove array covering 198 tools. Set that array deliberately rather than emptying it, ideally per child if the interface allows it: it now spans twenty servers that write invoices, quotes, spreadsheets, PDFs, images, bank ledgers and calendars.",
  },
  pdf: {
    "claude-desktop": "Claude Desktop has no filesystem sandbox of its own restricting where pdf_stamp or pdf_merge can write, so the out_path you give is exactly where the file lands, absolute path required like every other entry in this config.",
    "claude-code": "Merging or stamping a PDF sits well next to the rest of a terminal workflow: `claude mcp add pdf -- npx -y @theluckystrike/mcp-pdf --scope project` puts it in the repository the invoices or contracts already live in.",
    cursor: "The pattern that saves the most time here is asking in the same chat that just generated a docx proposal: print it, then merge it with a signed cover page before it goes out.",
    vscode: "In agent mode pdf_merge and pdf_stamp are tools the agent can reach mid-task, so \"stamp this PAID, then attach it to the release notes\" is one instruction instead of a manual export step.",
    windsurf: "Twelve tools out of Cascade's 100-tool ceiling is a cheap seat for something used a few times a week rather than continuously, unlike a timer or a spreadsheet tool held open all day.",
    cline: "pdf_info, pdf_count and pdf_text are safe to auto-approve since none of them write a file; leave pdf_merge, pdf_split, pdf_stamp and the rest behind a click, since each one creates a new file on disk.",
  },
  calendar: {
    "claude-desktop": "The .ics file you exported has to reach Claude Desktop's sandboxed process, so give ics_import an absolute path under your home directory rather than a relative one, the same rule every path in this config follows.",
    "claude-code": "Importing a calendar once and asking free_busy questions in the same session as a repo's billing work is the point: `claude mcp add calendar -- npx -y @theluckystrike/mcp-calendar --scope project` keeps the import local to that project.",
    cursor: "The useful chain here starts with a calendar question and ends in the time tracker: \"what did I do this week\" through events_list, then event_to_time_entry for the calls that were billable.",
    vscode: "In agent mode, free_busy and conflicts are tools the agent can call mid-task, so scheduling a follow-up around what is already on the calendar is one instruction rather than a manual lookup first.",
    windsurf: "Twelve tools against Cascade's 100-tool ceiling, and this one is read from a file you re-import occasionally rather than a service polled continuously, so it costs little to leave enabled.",
    cline: "events_list, free_busy, conflicts and next_event are read-only and safe to auto-approve; leave ics_import, event_export and ics_forget, which write or remove local data, behind a click.",
  },
  kanban: {
    "claude-desktop": "The board sits open in the same window all day, so \"what's overdue\" and \"start the timer on NOVA-3\" are the two questions worth asking here before you touch anything else, since both read the same file this client already has a path to.",
    "claude-code": "Give the board the repository's own name as its project so `task_add` in that directory files against the right board automatically, and `claude mcp add kanban -- npx -y @theluckystrike/mcp-kanban --scope project` keeps that mapping in the repo rather than only on your machine.",
    cursor: "The pattern worth building is a chat that starts with \"what's on the nova board\" and ends with \"start the timer on the one I'm about to work on,\" so the task you picked and the task the timer bills are the same string, not two names that drifted apart.",
    vscode: "In agent mode task_add and task_done are tools the agent can reach mid-task, so \"mark NOVA-3 done and log 40 minutes\" is one instruction instead of opening the board separately to close it out.",
    windsurf: "Sixteen tools against Cascade's ceiling of 100, and a board is read constantly through a work session, so it earns its seat more than a server you touch once a week.",
    cline: "board, task_list, overdue and project_list are reads and safe to auto-approve; leave task_add, task_move, task_delete and columns_set behind a click, since each one changes what the board says happened.",
  },
  image: {
    "claude-desktop": "Give it an absolute path to the photo, the same rule every entry in this config follows, and the resized or watermarked copy lands next to the original where Finder can find it without a terminal in between.",
    "claude-code": "Preparing images for a repository's docs or a release asset is a build step you already run from here, so `claude mcp add image -- npx -y @theluckystrike/mcp-image --scope project` keeps the tool scoped to the project whose images it is touching.",
    cursor: "The chain worth building is compress, then thumbnail: get a hero image under the size budget the site enforces, then batch the rest of the folder into the same shape in one sentence.",
    vscode: "In agent mode image_resize and image_convert are reachable mid-task, so \"shrink the screenshots in this PR to 1200 wide before I commit\" runs as one instruction rather than a manual export pass.",
    windsurf: "Twelve tools against Cascade's ceiling of 100, and no network call of any kind, so a server touching client photos costs nothing to leave enabled and sends nothing anywhere.",
    cline: "image_info and image_dominant_colors are reads and safe to auto-approve; leave image_resize, image_compress, image_convert and the rest behind a click, since each one writes a new file to disk.",
  },
  "bank-statement": {
    "claude-desktop": "The CSV your bank emails or you export from its web app is already sitting in Downloads, so point statement_import at the absolute path and the categorised month is the very next message, no terminal in between.",
    "claude-code": "Month-end reconciliation for a project's own account is repo-shaped work, so `claude mcp add bank-statement -- npx -y @theluckystrike/mcp-bank-statement --scope project` keeps the ledger scoped to the project it is reconciling.",
    cursor: "The chain worth building here is import, then reconcile: bring in the export, then ask which of this month's expense-tracker receipts never showed up as a bank line, in the same chat you were already using for the client's invoice.",
    vscode: "In agent mode statement_import and statement_summary are tools the agent can call mid-task, so \"pull in this export and tell me if anything looks uncategorised\" runs as one instruction rather than a separate spreadsheet pass.",
    windsurf: "Eleven tools against Cascade's ceiling of 100, and a bank export is read in one sitting a few times a month rather than polled continuously, so it costs little to leave enabled between statements.",
    cline: "transactions_list, transactions_search and statement_summary are reads and safe to auto-approve; leave statement_import, category_rules and transaction_categorize behind a click, since each one changes what the ledger says happened.",
  },
  quotes: {
    "claude-desktop": "A quote is written in the evening or between calls, in the client people already have open for exactly that kind of task, and quote_send_text hands back plain text ready to paste into whatever mail app is next to it.",
    "claude-code": "Quoting and invoicing share one data directory across two servers, so `claude mcp add quotes -- npx -y @theluckystrike/mcp-quotes --scope project` next to the invoice server in the same project keeps a client's whole paper trail, quote through paid invoice, in one repo-scoped place.",
    cursor: "The chain worth building is quote, then accept: price the work in the same chat you are about to start it in, and when the client answers, \"they said yes, invoice it\" is the next message rather than a context switch to a separate billing tool.",
    vscode: "In agent mode quote_create and quote_accept are tools the agent can reach mid-task, so \"quote this scope change and, if they say yes on the call, invoice it\" is one instruction spanning two calls instead of a manual step in between.",
    windsurf: "Eleven tools against Cascade's ceiling of 100, and a quote is written a handful of times a week rather than polled continuously, so it costs little to leave enabled alongside the invoice server it hands off to.",
    cline: "quote_list, quote_get, quote_report and quote_send_text are reads or produce text only, and are safe to auto-approve; leave quote_create, quote_update, quote_accept and quote_decline behind a click, since each one changes what the quote says or spends an id.",
  },
  barcode: {
    "claude-desktop": "A generated SVG comes back as an inline preview in the reply, which is the exact form you are about to paste into a flyer, a proposal or an invoice template already open in another window, and the 4000 px PNG ceiling on Pro covers a print job without this window ever needing a filesystem picker.",
    "claude-code": "The register that counts the free tier's 20 codes a month lives under one data directory per machine, so `claude mcp add --scope project` still shares that same monthly allowance across every project on the box; it is per install, not per repo.",
    cursor: "Ask for the SEPA payment code on an invoice right after asking for the invoice itself, in the same chat: invoice_payment_qr reads the IBAN from the shared business profile and the total from the invoice you just created, so nothing gets retyped between the two calls.",
    vscode: "In agent mode, `barcode_create` and `qr_create` are tools the agent can reach mid-task the same way it reaches a file write, so \"generate a Code 128 for every SKU in this CSV and save the SVGs next to it\" is a loop the agent can run without a script written for the occasion.",
    windsurf: "Ten tools against Cascade's ceiling of 100, and a code is generated a handful of times a session rather than polled continuously, so leaving it enabled costs little even alongside every other server in this collection.",
    cline: "code_list and license_status are reads and safe to auto-approve; leave the eight drawing tools and license_activate behind a click, since each one writes a file to disk or spends one of this month's 20 free codes.",
  },
  "billing-docs": {
    "claude-desktop": "The invoice that needs crediting was written by mcp-invoice in this same window and its PDF is already in Documents, so \"credit INV-2026-0001 in full\" needs no invoice number looked up and no figures retyped: the credit note copies the stored line totals rather than recomputing them from a rounded unit price.",
    "claude-code": "Both servers read one XDG data directory per machine, so `claude mcp add billing-docs` alongside `claude mcp add invoice` at any scope sees the same invoices and the same client list, and the 5-document monthly allowance is counted once for the box rather than once per project.",
    cursor: "A supplier order and the work it pays for tend to be decided in the same chat, so purchase_order_create takes the line items straight out of the discussion, and purchase_order_text gives you the message to send back without leaving the editor.",
    vscode: "In agent mode the agent can raise the order and later receive it in part, and billing_docs_report is the read that tells it which deliveries are past their date, so chasing suppliers becomes a tool call rather than a spreadsheet somebody keeps.",
    windsurf: "Fourteen tools against Cascade's ceiling of 100, and this one is only useful with mcp-invoice enabled beside it, so budget the pair at roughly 30 tools when you decide what else fits.",
    cline: "credit_note_list, credit_note_get, purchase_order_list, purchase_order_get and billing_docs_report are reads and safe to auto-approve; keep credit_note_create, purchase_order_create and purchase_order_receive behind a click, since each writes a numbered document that spends one of the month's five free ones and burns an id that is never reused.",
  },
  deposits: {
    "claude-desktop": "The invoice the deposit pays down was written by mcp-invoice in this same window, so \"apply 300 of Nordic Print's deposit to INV-2026-0001\" needs no invoice number looked up, and the PDF statement lands in the same Documents folder as the invoice and the credit note, in the same A4 layout.",
    "claude-code": "Both servers read one XDG data directory per machine, so `claude mcp add deposits` beside `claude mcp add invoice` at any scope sees the same invoices, the same clients and the same business profile, and the five-deposit monthly allowance is counted once for the box rather than once per project.",
    cursor: "The deposit and the invoice it settles are usually decided in the same chat as the work, so deposit_apply closes the loop without leaving the editor, and deposit_statement_text gives you the message to send the client without a second tool.",
    vscode: "In agent mode deposit_balance and deposits_report are reads the agent can lean on before it decides anything: how much of theirs you hold, per currency, and what has sat unapplied for ninety days is the whole basis for \"who should we settle with first\".",
    windsurf: "Ten tools against Cascade's ceiling of 100, and this one is only useful with mcp-invoice enabled beside it, so budget the pair at roughly 26 tools when you decide what else fits.",
    cline: "deposit_list, deposit_balance, deposit_statement_text and deposits_report are reads and safe to auto-approve; keep deposit_record, deposit_apply and deposit_refund behind a click, since deposit_apply writes a payment onto an invoice in the other server and deposit_record spends one of the month's five free ones and burns a DEP id that is never reused.",
  },
  zip: {
    "claude-desktop": "This is the client where a zip somebody emailed you already sits in Downloads, so \"what's in this zip, is it safe to open\" is a question asked from the same window the file arrived in, and zip_list answers it without ever running the system Archive Utility on an archive you have not looked inside yet.",
    "claude-code": "The register that counts the free tier's 20 archives a month lives under one data directory per machine, so `claude mcp add --scope project` still shares that same monthly allowance across every project on the box, and zip_bundle_month reaches straight into the sibling servers' output folders on disk without a path being typed for each one.",
    cursor: "Pack a folder with a glob right after generating the files that belong in it, in the same chat: `**/*.csv` for every export and an exclude for `**/node_modules/**` means the archive never needs a second look before it goes out.",
    vscode: "In agent mode, zip_create and zip_extract are tools the agent can reach mid-task the same way it reaches a file write, so \"zip the dist folder and unpack it into /tmp to check it\" is a loop the agent can run without a shell script written for the occasion.",
    windsurf: "Nine tools against Cascade's ceiling of 100, and an archive is built or opened a handful of times a session rather than polled continuously, so leaving it enabled costs little alongside every other server in this collection.",
    cline: "zip_list, zip_extract_text and zip_history are reads and safe to auto-approve; leave zip_create, zip_add and zip_extract behind a click, since each one writes to disk or spends one of this month's 20 free archives.",
  },
};

/** One sentence per server for the claude-web (claude.ai / Claude Desktop connector) client.
 * office-suite is excluded: it starts twenty child processes, not one URL. */
const WEB_ANGLE = {
  "time-tracker": "This is the client with no terminal and no filesystem of its own, so the free tier's history window matters more here than anywhere else: a report is read in the chat, not exported to a file you would open elsewhere.",
  "price-tracker": "A watch runs server-side against a URL you gave it, which is exactly the shape a browser tab full of Claude.ai can hold without a local process: no install, no machine that has to stay on.",
  spreadsheet: "The file never touches your disk: it is read from wherever the connector fetched it and any output comes back as a one-hour download link, since a hosted call has nowhere local to write to.",
  invoice: "The PDF is generated server-side and handed back as a download link rather than a path, which is the one thing that changes about this server between a local install and the connector.",
  "expense-tracker": "receipt_attach still wants a path, and the connector has no local filesystem, so the practical route here is amounts and a description rather than a stored receipt file.",
  currency: "Every tool this server has is a read against the ECB rate feed, so the connector needs nothing more than the URL: no file gets written, no download link is ever produced.",
  docx: "The filled document comes back as a one-hour download link instead of a path on disk, which is the same trade every writer server makes when it runs on the hosted route.",
  timezone: "No network call and no file besides the .ics you ask for, and that .ics also arrives as a download link rather than landing in a folder next to your other files.",
  resume: "The generated .docx is a one-hour download link rather than a path, so the practical habit is to download it the same session you ask for it, before the link expires.",
  recurring: "The schedule and the invoices it generates live in the hosted store behind the token, so the dry run and the real run both read the same state whether you connect from claude.ai or Claude Desktop.",
  clauses: "The assembled document is a download link, and the library itself lives behind the token, so the same clause set is there whether you connect from claude.ai in a browser or Claude Desktop.",
  pdf: "A merged or stamped PDF comes back as a one-hour download link rather than a path, and pdf_watermark_business needs the shared business profile to already exist behind that same token, since there is no local profile.json to read it from.",
  calendar: "There is no local .ics file to import from over a browser connector, so the practical route here is ics_import with a url or webcal feed, which is a Pro feature: the free tier's local-file import has nothing to point at from claude.ai.",
  kanban: "The board is a JSON file behind the connector's token rather than on your disk, so it is the same board whether you connect from claude.ai in a browser or from Claude Desktop, and task_start_timer still only hands back arguments for the time tracker connector to use.",
  image: "The resized or watermarked file comes back as a one-hour download link rather than a path, the same trade every writing tool makes on the hosted route, so the practical habit is downloading it in the same session you ask for it.",
  quotes: "The quote and the invoice it becomes live in the same hosted store behind the token, so quote_accept writes the invoice the invoice connector then lists; quote_pdf comes back as a print-to-PDF HTML link, since there is no PDF renderer on the hosted route.",
  "billing-docs": "Credit notes and purchase orders are written against the same invoice store /mcp/invoice serves for this token, so an invoice raised on the hosted invoice endpoint can be credited here without a file changing hands; both PDFs and both text exports come back as one-hour download links rather than paths.",
  deposits: "The deposit ledger and the invoices it pays down are the same store /mcp/invoice serves for this token, so applying a deposit here moves the balance on an invoice raised on the hosted invoice endpoint, with no file changing hands; the A4 statement comes back as a one-hour download link rather than a path, and the text statement, which is what most people actually send, needs no download at all.",
  zip: "An archive goes in through zip_upload by name and every extracted entry comes back as its own one-hour download link, at most twenty per request; zip_bundle_month stays a local-install tool because the hosted route writes no folders for it to collect.",
  "bank-statement": "There is no local CSV to point at over a browser connector, so the statement goes in through bank_upload first, by name, and the export comes back as a one-hour download link; the expense ledger it reconciles against is the same one behind the token.",
  barcode: "SVG still comes back inline, since it is text, but PNG becomes a one-hour download link instead of a path on disk, and invoice_payment_qr reads the IBAN from the same shared business profile behind the token that the invoice connector already wrote.",
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
        : s.slug === "office-suite"
          ? "Not this one; it starts twenty child processes, so it runs locally over stdio. Three of the servers behind it (time-tracker, price-tracker, invoice) are hosted at https://mcp.zovo.one/mcp if you want a no-install route."
          : "Not yet. " + s.title + " runs locally over stdio, which is also how it reads and writes files on your disk. The hosted endpoints at https://mcp.zovo.one/mcp currently cover time-tracker, price-tracker and invoice.",
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
  "claude-web": (s) => [
    {
      q: "Does this need OAuth?",
      a: "No. Add custom connector offers an Advanced settings section with an OAuth Client ID and Client Secret, but the connect-by-URL route does not use it. Leave both blank: the token in the URL path is what authenticates.",
    },
    {
      q: "I am on a Team or Enterprise plan and cannot add a connector.",
      a: "That is documented, not a bug: on Team and Enterprise, only an Owner or Primary Owner can add a custom connector, at Organization settings, Connectors, Add, Custom, Web. After that, members connect to the URL the Owner added from Customize, Connectors.",
    },
    {
      q: "Can I use my Pro key instead of the free anonymous token?",
      a: "Yes. The token segment of the URL from /mcp/connect can be replaced with a Pro key, which removes the free-tier limits on " + s.title + " for that connector.",
    },
    {
      q: "Why did a generated file come back as a link instead of opening?",
      a: "The connector runs server-side with no filesystem of its own, so any file " + s.title + " produces is handed back as a download link that expires after one hour, rather than a path on disk.",
    },
  ],
};

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Trim so the HTML-escaped description still fits the 155-char slice index.js applies. */
function fitDesc(d) {
  let out = d;
  while (esc(out).length > 155) out = out.slice(0, out.lastIndexOf(" "));
  return out;
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
    if (s.slug !== "office-suite") {
      return `<p>There is no hosted endpoint for this one yet. ${esc(s.title)} runs locally over stdio with the config above, which is also the only form in which it reads and writes files on your own disk. Three of the servers in this collection are served at <code>${BASE}/mcp/&lt;name&gt;</code> over MCP streamable HTTP: time-tracker, price-tracker and invoice.</p>`;
    }
    return `<p>The suite starts twenty child processes, so it has no hosted form. Three of the twenty (time-tracker, price-tracker, invoice) are served at <code>${BASE}/mcp/&lt;name&gt;</code> over MCP streamable HTTP instead: mint a free token with <code>curl ${BASE}/mcp/token</code>, or use a Pro key as the bearer.</p>`;
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
  if (clientId === "claude-web" && WEB_EXCLUDED.includes(serverId)) return null;
  const canonical = `${BASE}/setup/${clientId}/${serverId}`;
  const title = `${s.title} in ${c.name}`;

  const promptRows = s.prompts
    .map(([p, t]) => `<tr><td>${esc(p)}</td><td><code>${esc(t)}</code></td></tr>`)
    .join("");

  const pathRows = c.paths.map(([os, p]) => `<tr><td>${esc(os)}</td><td><code>${esc(p)}</code></td></tr>`).join("");

  const [prev, next] = neighbours(clientId);
  const faq = FAQ[clientId](s);

  if (clientId === "claude-web") {
    const description = fitDesc(`Connect ${s.title} in Claude.ai or Claude Desktop with no install: mint a URL at /mcp/connect and paste it into Add custom connector.`);
    const exampleUrl = `${BASE}/mcp/${s.hosted || s.slug}/t/&lt;token&gt;`;
    const body = `<p class="muted"><a href="/">Home</a> &middot; <a href="/setup">Setup</a> &middot; <a href="/setup/${clientId}">${esc(c.name)}</a></p>
<h1>${esc(title)}</h1>
<p>${esc(s.tagline)} ${esc(s.does)}</p>
<p>${esc(WEB_ANGLE[serverId] || "")}</p>

<h2>What you get</h2>
<table><tr><th>You say</th><th>Tool</th></tr>${promptRows}</table>
<p>${esc(s.measured)}</p>

<h2>Connect it, no install</h2>
<p><a href="${BASE}/mcp/connect">${BASE}/mcp/connect</a> mints an anonymous token and prints a URL per server, including this one, shaped like <code>${exampleUrl}</code>. That URL works with no headers: the token is in the path, not in an Authorization field this form does not have.</p>
<ol>
<li>Open <a href="${BASE}/mcp/connect">${BASE}/mcp/connect</a> and copy the URL printed for ${esc(s.title)}.</li>
<li>${esc(c.reach)}</li>
<li>Paste the URL as the Remote MCP server URL. Leave the optional OAuth Client ID and Client Secret blank; this endpoint does not use them.</li>
<li>Click Connect, then turn the connector on for a conversation from the + button, Connectors.</li>
</ol>
<p class="muted">Idle anonymous tokens are swept after 30 days. Since this route has no filesystem, a file ${esc(s.title)} generates comes back as a download link that expires after one hour. A Pro key can replace the token in the same URL and removes the free-tier limits.</p>

<h2>${esc(c.name)} notes worth knowing first</h2>
<p>${esc(c.caveat)}</p>

<p class="muted">Free: ${esc(s.free)} Pro is $19 once, verified offline, and binds to the token after checkout.</p>

<h2>Questions</h2>
${faq.map((f) => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`).join("\n")}

<h2>Related</h2>
<p>${s.sPage ? `<a href="${s.sPage}">${esc(s.title)} in detail</a> &middot; ` : ""}<a href="/guides/connect-mcp-servers-without-installing">How connect-by-URL works</a> &middot; <a href="/setup/${clientId}">Every server for ${esc(c.name)}</a> &middot; <a href="/setup">All clients</a> &middot; <a href="${esc(c.docs)}">${esc(c.name)} docs</a> &middot; <a class="buy" href="/buy/${esc(serverId)}?src=store.setup.${esc(clientId)}">Buy Pro</a></p>`;
    return { title, description, body, faq, canonical };
  }

  const description = fitDesc(`Install ${s.title} in ${c.name}: the exact ${c.file} entry, three prompts that work, and ${c.caveatShort}.`);
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
<p>${s.sPage ? `<a href="${s.sPage}">${esc(s.title)} in detail</a> &middot; ` : ""}The same server in <a href="/setup/${prev}/${serverId}">${esc(CLIENTS[prev].name)}</a> and <a href="/setup/${next}/${serverId}">${esc(CLIENTS[next].name)}</a> &middot; <a href="/setup/${clientId}">Every server in ${esc(c.name)}</a> &middot; <a href="/guides">Guides</a> &middot; <a href="${esc(c.docs)}">${esc(c.name)} docs</a> &middot; <a class="buy" href="/buy/${esc(serverId)}?src=store.setup.${esc(clientId)}">Buy Pro</a></p>`;

  return { title, description, body, faq, canonical };
}

/** Build one /setup/<client> hub page. */
export function clientHub(clientId) {
  const c = CLIENTS[clientId];
  if (!c) return null;
  const canonical = `${BASE}/setup/${clientId}`;
  const title = `MCP servers for ${c.name}: install guides`;
  const description = fitDesc(`Twelve MCP servers set up in ${c.name}, each with the exact ${c.file} entry: time, invoices, recurring billing, expenses, spreadsheets, prices, currency, Word, clauses, resumes and time zones.`);
  const rows = serversFor(clientId).map(
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
  const description = "Exact config file paths and entries for twelve MCP servers in Claude Desktop, Claude Code, Cursor, VS Code, Windsurf and Cline.";
  const clientRows = CLIENT_ORDER.map(
    (id) =>
      `<tr><td><a href="/setup/${id}">${esc(CLIENTS[id].name)}</a></td><td><code>${esc(CLIENTS[id].file)}</code></td><td><code>${esc(CLIENTS[id].key)}</code></td><td>${esc(CLIENTS[id].caveatShort)}</td></tr>`
  ).join("");
  const serverRows = SERVER_ORDER.map(
    (id) =>
      `<tr><td>${esc(SETUP_SERVERS[id].title)}</td><td>${CLIENT_ORDER.filter((c) => serversFor(c).includes(id)).map((c) => `<a href="/setup/${c}/${id}">${esc(CLIENTS[c].short)}</a>`).join(" &middot; ")}</td></tr>`
  ).join("");
  const body = `<p class="muted"><a href="/">Home</a></p>
<h1>${esc(title)}</h1>
<p>Twelve servers, six clients, one page each: the config file that client actually reads, the entry to put in it, three prompts that were run against the server, and the hosted endpoint if you would rather install nothing. The two facts that cause most failed installs are in the table below: the file name and the top-level key are not the same across clients.</p>
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
    for (const s of serversFor(c)) urls.push(`/setup/${c}/${s}`);
  }
  return urls;
}
