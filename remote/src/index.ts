/**
 * mcp-remote: the stdio servers' tool sets served over MCP streamable HTTP.
 *
 * One Worker, thirty endpoints. Every POST builds a fresh McpServer and a fresh
 * stateless WebStandardStreamableHTTPServerTransport, hydrates an in-memory
 * filesystem from KV, runs the request, then flushes the filesystem back to KV.
 * The tool handlers are the vendored, unmodified handlers of servers/<name>.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { negotiatedHeaders } from "./accept.js";
import { STORE, type RequestCtx, type Download } from "./shims/ctx.js";
import { PRICE_BUNDLE_USD, PRICE_SINGLE_USD, SERVER_COUNT } from "./shims/license.js";
import { paymentDescriptor } from "./payment.js";
import { TMP_RE, recount } from "./shims/fs.js";
import { createServer as createTimeTracker } from "./vendor/time-tracker/index.js";
import { createServer as createPriceTracker } from "./vendor/price-tracker/index.js";
import { createServer as createInvoice } from "./vendor/invoice/index.js";
import { createServer as createExpenseTracker } from "./vendor/expense-tracker/index.js";
import { createServer as createSpreadsheet } from "./vendor/spreadsheet/index.js";
import { createServer as createCurrency } from "./vendor/currency/index.js";
import { createServer as createTimezone } from "./vendor/timezone/index.js";
import { createServer as createDocx } from "./vendor/docx/index.js";
import { createServer as createResume } from "./vendor/resume/index.js";
import { createServer as createRecurring } from "./vendor/recurring/index.js";
import { createServer as createClauses } from "./vendor/clauses/index.js";
import { createServer as createPdf } from "./vendor/pdf/index.js";
import { createServer as createCalendar } from "./vendor/calendar/index.js";
import { createServer as createKanban } from "./vendor/kanban/index.js";
import { createServer as createImage } from "./vendor/image/index.js";
import { createServer as createBankStatement } from "./vendor/bank-statement/index.js";
import { createServer as createQuotes } from "./vendor/quotes/index.js";
import { createServer as createBarcode } from "./vendor/barcode/index.js";
import { createServer as createZip } from "./vendor/zip/index.js";
import { createServer as createBillingDocs } from "./vendor/billing-docs/index.js";
import { createServer as createDeposits } from "./vendor/deposits/index.js";
import { createServer as createPerDiem } from "./vendor/per-diem/index.js";
import { createServer as createAssetRegister } from "./vendor/asset-register/index.js";
import { createServer as createStatementOfAccount } from "./vendor/statement-of-account/index.js";
import { createServer as createCashBook } from "./vendor/cash-book/index.js";
import { createServer as createAmortization } from "./vendor/amortization/index.js";
import { createServer as createPettyCash } from "./vendor/petty-cash/index.js";
import { createServer as createWorkOrder } from "./vendor/work-order/index.js";
import { createServer as createCatalogue } from "./vendor/catalogue/index.js";
import { createServer as createChangeOrder } from "./vendor/change-order/index.js";

export interface Env { REMOTE_DATA: KVNamespace; SWEEP_SECRET?: string }

const PUBLIC_KEY_B64 = "VZXpvTpJn2XzaEn9ijFXk1vjPjtZvzAHZazC0Z+0pHU=";
const GUIDE = "https://mcp.zovo.one/guides/mcp-server-free-vs-pro";
const ANON_TTL = 60 * 60 * 24 * 30;   // 30 days, refreshed on every write
const DOWNLOAD_TTL = 60 * 60;         // 1 hour
const RATE_LIMIT_FREE = 600;          // calls per hour per token
const RATE_LIMIT_PRO = 6000;
const SWEEP_AFTER_DAYS = 35;          // orphan sweep: docs untouched this long are deleted
const SPREADSHEET_MAX_BYTES = 2 * 1024 * 1024;   // inline-data mode, per token
const DOCX_MAX_BYTES = 2 * 1024 * 1024;          // uploaded .docx templates, per token
const PDF_MAX_BYTES = 2 * 1024 * 1024;           // uploaded and generated PDFs, per token
const CALENDAR_MAX_BYTES = 2 * 1024 * 1024;      // imported .ics calendars, per token
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;         // uploaded and generated images, per token
const BANK_MAX_BYTES = 2 * 1024 * 1024;           // uploaded statements and the ledger, per token
const ZIP_MAX_BYTES = 2 * 1024 * 1024;            // uploaded archives and files, per token
const DEFAULT_MAX_BYTES = 512 * 1024;            // stored document per token per endpoint
/**
 * /mcp/cash-book hydrates SIX sibling documents to derive one ledger, and the cap is
 * charged on everything hydrated, not on what this endpoint writes. Its own register
 * (periods.json and closes.json) is a few kilobytes and never grows with the books, but
 * the six it reads are each legal up to their own endpoint's ceiling - /mcp/bank-statement
 * alone is 2 MB - so a 512 KB cap here would refuse to READ books that are perfectly
 * within limits on the endpoints that own them, and the refusal would name the wrong
 * endpoint. 2 MB is the same ceiling the largest of the six carries.
 */
const CASH_BOOK_MAX_BYTES = 2 * 1024 * 1024;
const MAX_BODY_BYTES = 256 * 1024;               // request body ceiling
const TOKEN_MINTS_PER_IP = 10;                   // anonymous tokens per hour per client IP

/**
 * Bumped whenever a tool set or a description changes. It is the invalidation key of the
 * module-scope tools/list cache below: an isolate started before a deploy is replaced by
 * the deploy, so the only thing the version has to guarantee is that two builds never
 * share a cache entry inside one isolate.
 */
const BUILD_VERSION = "2026-09-06.1";

/** Where the one-click .mcpb bundles live. The install path that works today. */
const RELEASES = "https://github.com/theluckystrike/mcp-servers/releases/latest";

interface ServerCfg {
  factory: () => McpServer;
  /** Which finished atomic writes become one-hour download links. */
  publish?: (path: string) => boolean;
  /** Keep published outputs in the tenant document, or treat them as transient downloads. */
  persistPublished?: boolean;
  /** Ceiling on the tenant document for this endpoint. */
  maxBytes?: number;
  /** Which virtual paths belong in the tenant document at all. Default: all of them. */
  persist?: (path: string) => boolean;
  /**
   * Virtual roots that are an implementation detail rather than something a caller can
   * open, stripped out of the response body after the download links are substituted:
   * on an upload/inline endpoint a file is known by the name it was loaded under.
   */
  strip?: string[];
  /**
   * Sibling tenant documents this endpoint reads. /mcp/recurring creates invoices in the
   * SAME invoice store /mcp/invoice serves, so it hydrates both keys and flushes each
   * path back to the document that owns it.
   *
   * One entry or a list of them: /mcp/statement-of-account reads THREE sibling stores
   * (invoice, billing-docs, deposits) to state one account, and a statement is a view
   * over books other servers own. `readOnly` says so structurally rather than by
   * convention: that document is hydrated and never flushed, so an accidental write
   * inside a handler cannot reach another server's KV document. The read-WRITE form
   * (/mcp/quotes, /mcp/recurring, /mcp/billing-docs, /mcp/deposits) leaves it off.
   */
  sharedDoc?: SharedDoc | SharedDoc[];
}

/** One sibling tenant document, hydrated on top of this endpoint's own. */
interface SharedDoc {
  server: string;
  owns: (path: string) => boolean;
  /** Hydrate it, never flush it: this endpoint reports on that book and does not write it. */
  readOnly?: boolean;
}

/** cfg.sharedDoc in its list form. The single form is kept for every server that had one. */
const sharedDocs = (cfg: ServerCfg): SharedDoc[] =>
  cfg.sharedDoc ? (Array.isArray(cfg.sharedDoc) ? cfg.sharedDoc : [cfg.sharedDoc]) : [];

/** The invoice server's data directory inside the virtual filesystem (homedir shim). */
const INVOICE_DIR = "/home/mcp/.local/share/mcp-servers/invoice/";
/** The expense ledger /mcp/expense-tracker owns; /mcp/bank-statement reconciles against it. */
const EXPENSE_DIR = "/home/mcp/.local/share/mcp-servers/expense-tracker/";
/** The bank ledger /mcp/bank-statement owns; /mcp/expense-tracker's bankLedgerLine (D-B4) reads it. */
const BANK_DIR = "/home/mcp/.local/share/mcp-servers/bank-statement/";
/** The credit note and purchase order store /mcp/billing-docs owns; /mcp/statement-of-account reads it. */
const BILLING_DOCS_DIR = "/home/mcp/.local/share/mcp-servers/billing-docs/";
/** The deposit store /mcp/deposits owns; /mcp/statement-of-account reads it. */
const DEPOSITS_DIR = "/home/mcp/.local/share/mcp-servers/deposits/";
/** The fixed asset register /mcp/asset-register owns; /mcp/cash-book depreciates from it. */
const ASSET_REGISTER_DIR = "/home/mcp/.local/share/mcp-servers/asset-register/";

const SERVERS: Record<string, ServerCfg> = {
  "time-tracker": {
    factory: createTimeTracker as () => McpServer,
    publish: (p) => p.endsWith(".csv"),
  },
  "price-tracker": { factory: createPriceTracker as () => McpServer },
  "invoice": { factory: createInvoice as () => McpServer },
  "expense-tracker": {
    factory: createExpenseTracker as () => McpServer,
    // Everything the export tool writes; never the ledger itself.
    publish: (p) => !p.endsWith("/data.json") && !p.endsWith(".lock"),
    // D-R76. bankLedgerLine (D-B4) reads servers/bank-statement's ledger to name the bank
    // transaction count in the period, and that is a SEPARATE tenant document here, so it
    // is hydrated on top of this one - the mirror of /mcp/bank-statement's own hydration of
    // the expense ledger. Read-only in practice: this server never writes a path under
    // BANK_DIR, so the flush finds the bank document byte-identical to what it hydrated and
    // writes nothing.
    sharedDoc: { server: "bank-statement", owns: (p) => p.startsWith(BANK_DIR) },
  },
  "spreadsheet": {
    factory: createSpreadsheet as () => McpServer,
    // Inline-data mode: every tool output is a download, and outputs stay under
    // /sheets/ so a follow-up call can open them by name.
    publish: () => true,
    persistPublished: true,
    maxBytes: SPREADSHEET_MAX_BYTES,
    strip: ["/sheets/"],
  },
  "currency": {
    factory: createCurrency as () => McpServer,
    // The ECB files are one shared, cross-tenant cache (see hydrateEcb); this endpoint
    // keeps no per-token state at all, so nothing under /currency/ is ever persisted
    // into a tenant document - not the cache, and not a quarantine marker for it.
    persist: () => false,
  },
  "timezone": {
    factory: createTimezone as () => McpServer,
    publish: (p) => p.endsWith(".ics"),
  },
  "docx": {
    factory: createDocx as () => McpServer,
    // Uploaded templates (/uploads/) and the document register are the tenant's state;
    // everything this server writes lands under /docs/ and is a transient download.
    publish: (p) => p.startsWith("/docs/"),
    maxBytes: DOCX_MAX_BYTES,
  },
  "resume": {
    factory: createResume as () => McpServer,
    // The profile and the letter history are the tenant's state; uploads live under
    // /uploads/ and every generated resume, letter or HTML lands under /docs/ as a
    // transient download.
    publish: (p) => p.startsWith("/docs/"),
    maxBytes: DOCX_MAX_BYTES,
  },
  "recurring": {
    factory: createRecurring as () => McpServer,
    // Schedules and history are this endpoint's own document; the invoices it generates
    // belong to the invoice store, which /mcp/invoice serves for the same token.
    sharedDoc: { server: "invoice", owns: (p) => p.startsWith(INVOICE_DIR) },
  },
  "clauses": {
    factory: createClauses as () => McpServer,
    publish: (p) => p.startsWith("/docs/"),
  },
  "pdf": {
    factory: createPdf as () => McpServer,
    // Uploads (/uploads/) and the operation register are the tenant's state; everything
    // a tool writes lands under /out/ and becomes a one-hour download link. Outputs are
    // kept as well, so a merged file can be stamped by a later call the way a file on a
    // disk could - the overwrite flag stays a real decision rather than a no-op.
    publish: (p) => p.startsWith("/out/"),
    persistPublished: true,
    maxBytes: PDF_MAX_BYTES,
    // An input path a tool echoes back (pdf_split/pdf_rotate/pdf_stamp/pdf_reorder all report
    // "source") is NOT published in that request, so the link substitution never touches it and
    // the caller was shown "/out/invoices-merged.pdf" - a root that exists nowhere they can
    // reach and is not the name they pass back. Stripped like image and bank-statement do (D-R59).
    strip: ["/uploads/", "/out/"],
  },
  "calendar": {
    factory: createCalendar as () => McpServer,
    // Imported calendars are the tenant's state, under /calendar/; an export lands under
    // /exports/ and is a transient download.
    publish: (p) => p.startsWith("/exports/"),
    maxBytes: CALENDAR_MAX_BYTES,
  },
  "kanban": {
    // Zero dependencies and no file outputs: the board is one JSON document per token,
    // under the homedir shim, and the day boundary comes from the shared profile's
    // timezone exactly as it does over stdio.
    factory: createKanban as () => McpServer,
  },
  "image": {
    // Uploads (/uploads/) and the operation register (/image/) are the tenant's state;
    // everything a tool writes lands under /out/ and becomes a one-hour download link
    // served with the real image content type. Outputs are kept as well, so a resized
    // file can be cropped by the next call the way a file on a disk could.
    factory: createImage as () => McpServer,
    publish: (p) => p.startsWith("/out/"),
    persistPublished: true,
    maxBytes: IMAGE_MAX_BYTES,
    strip: ["/uploads/", "/out/"],
  },
  "bank-statement": {
    // Uploaded statements (/uploads/) and the ledger - transactions, rules and accounts,
    // one JSON document under the homedir shim, written tmp + rename exactly as kanban's
    // board is - are the tenant's state; statement_export writes under /out/ and is a
    // transient one-hour download.
    //
    // reconcile_expenses reads servers/expense-tracker's ledger directly, and that is a
    // SEPARATE tenant document here, so it is hydrated on top of this one. Read-only in
    // practice: this server never writes a path under EXPENSE_DIR, so the flush finds the
    // expense document byte-identical to what it hydrated and writes nothing.
    factory: createBankStatement as () => McpServer,
    publish: (p) => p.startsWith("/out/"),
    maxBytes: BANK_MAX_BYTES,
    strip: ["/uploads/", "/out/"],
    sharedDoc: { server: "expense-tracker", owns: (p) => p.startsWith(EXPENSE_DIR) },
  },
  "quotes": {
    // Quotes are this endpoint's own document (quotes.json and its per-year counter, under
    // the homedir shim, tmp + rename). The invoices quote_accept issues are NOT: they are
    // written through the shared invoice engine into the same store /mcp/invoice serves for
    // the same token, so the invoice data directory is hydrated on top of this request and
    // flushed back to the document that owns it - read AND write, unlike bank-statement's
    // read-only hydration of the expense ledger, and exactly what /mcp/recurring does.
    //
    // quote_pdf renders through remote/src/shims/pdf.ts and pushes its own download, so the
    // only thing publish() has to catch is quote_send_text's .txt under /out/.
    factory: createQuotes as () => McpServer,
    publish: (p) => p.startsWith("/out/"),
    strip: ["/out/"],
    sharedDoc: { server: "invoice", owns: (p) => p.startsWith(INVOICE_DIR) },
  },
  "barcode": {
    // The code register (codes.json, one JSON document under the homedir shim, tmp +
    // rename exactly as kanban's board is) is the tenant's state; every SVG and PNG a tool
    // draws lands under /out/ and is a transient one-hour download served with the real
    // image content type.
    //
    // invoice_payment_qr reads the invoice store of the SAME token to get the amount and
    // the reference, so the invoice data directory is hydrated on top of this request -
    // read-only in practice, like /mcp/bank-statement's hydration of the expense ledger:
    // this server never writes a path under INVOICE_DIR, so the flush finds the invoice
    // document byte-identical to what it hydrated and writes nothing.
    factory: createBarcode as () => McpServer,
    publish: (p) => p.startsWith("/out/"),
    strip: ["/out/"],
    sharedDoc: { server: "invoice", owns: (p) => p.startsWith(INVOICE_DIR) },
  },
  "zip": {
    // Uploads (/uploads/) and the archive register are the tenant's state; every archive
    // zip_create writes and every entry zip_extract unpacks lands under /out/ and is a
    // transient one-hour download served application/zip or the entry's own type.
    //
    // zip_bundle_month is the one tool that cannot work here and says so: it bundles the
    // output FOLDERS the sibling servers write on a local install, and every hosted
    // endpoint hands its documents back as a download link instead, so there is no
    // sibling document worth hydrating - unlike /mcp/barcode's read of the invoice store,
    // which is a real JSON document at a known path.
    factory: createZip as () => McpServer,
    publish: (p) => p.startsWith("/out/"),
    maxBytes: ZIP_MAX_BYTES,
    strip: ["/uploads/", "/out/"],
  },
  "billing-docs": {
    // Credit notes, purchase orders and their per-year counter are this endpoint's own
    // document (under the homedir shim, tmp + rename). The invoices a credit note is
    // issued against are NOT: they are the same store /mcp/invoice serves for the same
    // token, so the invoice data directory is hydrated on top of this request and flushed
    // back to the document that owns it - read AND write, the /mcp/quotes arrangement.
    // Read is the common path (an invoice is looked up, its stored numbers copied, and the
    // credit-note link is held on the credit note), but syncInvoiceCredited calls
    // setInvoices whenever the engine's record carries credited_minor, and that write has
    // to reach KV rather than be dropped with the request.
    //
    // credit_note_pdf and purchase_order_pdf render through remote/src/shims/pdf.ts and
    // push their own download, so publish() only has to catch the .txt both text tools
    // write under /out/.
    factory: createBillingDocs as () => McpServer,
    publish: (p) => p.startsWith("/out/"),
    strip: ["/out/"],
    sharedDoc: { server: "invoice", owns: (p) => p.startsWith(INVOICE_DIR) },
  },
  "deposits": {
    // The deposits themselves and their per-year counter are this endpoint's own document
    // (under the homedir shim, tmp + rename). The invoices deposit_apply pays are NOT:
    // they are the same store /mcp/invoice serves for the same token, hydrated on top of
    // this request and flushed back to the document that owns it - read AND write, the
    // /mcp/quotes and /mcp/billing-docs arrangement, and here the write is the COMMON
    // path rather than a future one: deposit_apply sets paid_minor, paid_date and status
    // on the invoice record through the shared engine on every successful call, so a
    // dropped flush would report a payment that never reached the invoice.
    //
    // deposit_statement_pdf renders through remote/src/shims/pdf.ts by way of the
    // vendored @theluckystrike/mcp-billing-docs/lib and pushes its own download, so
    // publish() only has to catch the .txt deposit_statement_text writes under /out/.
    factory: createDeposits as () => McpServer,
    publish: (p) => p.startsWith("/out/"),
    strip: ["/out/"],
    sharedDoc: { server: "invoice", owns: (p) => p.startsWith(INVOICE_DIR) },
  },
  "per-diem": {
    // The plainest endpoint since /mcp/invoice, and deliberately so. The saved trips and
    // their per-year counter are this endpoint's own document (under the homedir shim,
    // tmp + rename) and are the only thing it writes: no out_path, no download, no
    // sibling store. trip_export hands back the expense_add ARGUMENTS rather than
    // appending a row to the expense ledger - the stdio server's D-P1 decision, and the
    // reason there is no sharedDoc here even though this endpoint talks about invoices
    // and expenses. So no publish(), no strip and the default 512 KB tenant cap.
    //
    // The five rate tables are read-only bundled JSON. Over stdio they are files beside
    // the module; here remote/build-vendor.mjs inlines their exact bytes into
    // vendor/per-diem/tables-data.ts, so the same number comes out of the same shipped
    // table and nothing is fetched.
    factory: createPerDiem as () => McpServer,
  },
  "asset-register": {
    // The per-diem arrangement again, and for the same reasons. The register (assets.json
    // and its per-year id counter, under the homedir shim, tmp + rename) is this
    // endpoint's own document and the only thing it writes: no out_path, no download, no
    // sibling store. asset_journal returns an expense_add PAYLOAD rather than appending a
    // row to the expense ledger - the stdio server's D-J1 decision, taken because
    // servers/expense-tracker publishes no library entry point and its id counter,
    // category rules, VAT split and currency defaults all live inside its own expense_add
    // handler - so there is no sharedDoc even though this endpoint talks about expenses.
    // No publish(), no strip and the default 512 KB tenant cap.
    //
    // The three depreciation tables (Polish KST, HMRC capital allowances, IRS MACRS) are
    // read-only bundled JSON. Over stdio they are files beside the module; here
    // remote/build-vendor.mjs inlines their exact bytes into
    // vendor/asset-register/tables-data.ts through the same server-keyed inliner per-diem
    // uses, so the same rate comes out of the same shipped annex and nothing is fetched.
    factory: createAssetRegister as () => McpServer,
  },
  "statement-of-account": {
    // The first endpoint that hydrates THREE sibling documents, and the first that
    // hydrates any of them READ-ONLY by declaration rather than by habit. A statement of
    // account is a view over books other servers own: the invoice ledger (/mcp/invoice),
    // the credit note store (/mcp/billing-docs) and the deposit store (/mcp/deposits) are
    // all read and none is written, so each entry carries readOnly: true and its document
    // is never flushed. /mcp/bank-statement's and /mcp/expense-tracker's hydrations are
    // read-only in PRACTICE - the flush finds them byte-identical and writes nothing -
    // which is a property of the handlers; this is a property of the endpoint.
    //
    // What this endpoint does own is one small register of the statements that were built
    // (statements.json and its per-year counter, under the homedir shim, tmp + rename),
    // metered for the free cap. No balance is ever read back out of it.
    //
    // statement_pdf renders through remote/src/shims/pdf.ts by way of the vendored
    // @theluckystrike/mcp-billing-docs/lib, the /mcp/deposits route, and pushes its own
    // download, so publish() only has to catch the .txt statement_text and dunning_text
    // write under /out/.
    factory: createStatementOfAccount as () => McpServer,
    publish: (p) => p.startsWith("/out/"),
    strip: ["/out/"],
    sharedDoc: [
      { server: "invoice", owns: (p) => p.startsWith(INVOICE_DIR), readOnly: true },
      { server: "billing-docs", owns: (p) => p.startsWith(BILLING_DOCS_DIR), readOnly: true },
      { server: "deposits", owns: (p) => p.startsWith(DEPOSITS_DIR), readOnly: true },
    ],
  },
  "cash-book": {
    // SIX sibling documents, every one of them read-only, and none of them written: this
    // is a double-entry ledger DERIVED from books other servers own, and a ledger that
    // also wrote would be posting entries against itself. Four are reached through their
    // published engines (invoice, billing-docs, deposits, asset-register); the other two,
    // expense-tracker and bank-statement, publish no ./lib, so servers/cash-book/src/
    // sources.ts opens their data.json BY PATH off the same XDG root every store here
    // derives - process.env.XDG_DATA_HOME || join(homedir(), ".local", "share") - which
    // under the os shim is /home/mcp/.local/share. Those two paths therefore resolve
    // INSIDE the virtual filesystem, onto the documents hydrated by the two entries below,
    // and that is the whole reason both are in this list: a by-path read is exactly as
    // dependent on hydration as an engine call, and it fails silently as `rows: 0` rather
    // than loudly if the document is missing.
    //
    // What this endpoint owns is periods.json (the register the free cap is metered on)
    // and closes.json (a trial balance snapshot per closed month), under the homedir shim.
    // No balance is ever read back out of either: every debit and every credit is derived
    // on the call.
    //
    // ledger_export_csv writes the CSV under /out/ and publishes it, so publish() only has
    // to catch that; the cap is raised because six hydrated books are charged to this
    // endpoint (see CASH_BOOK_MAX_BYTES).
    factory: createCashBook as () => McpServer,
    publish: (p) => p.startsWith("/out/"),
    strip: ["/out/"],
    maxBytes: CASH_BOOK_MAX_BYTES,
    sharedDoc: [
      { server: "invoice", owns: (p) => p.startsWith(INVOICE_DIR), readOnly: true },
      { server: "billing-docs", owns: (p) => p.startsWith(BILLING_DOCS_DIR), readOnly: true },
      { server: "deposits", owns: (p) => p.startsWith(DEPOSITS_DIR), readOnly: true },
      { server: "asset-register", owns: (p) => p.startsWith(ASSET_REGISTER_DIR), readOnly: true },
      // The two that publish no ./lib and are read by path. Same hydration, same
      // read-only guarantee; the difference is only how sources.ts opens them.
      { server: "expense-tracker", owns: (p) => p.startsWith(EXPENSE_DIR), readOnly: true },
      { server: "bank-statement", owns: (p) => p.startsWith(BANK_DIR), readOnly: true },
    ],
  },
  "amortization": {
    // No sharedDoc, no publish(), no strip and the default 512 KB tenant cap: the simplest
    // endpoint added since /mcp/asset-register, and for a reason worth stating rather than
    // leaving to be re-derived. This server reads no sibling book, so there is nothing to
    // hydrate; it writes nothing outside loans.json and counter.json, so there is nothing
    // to flush anywhere else; and NO TOOL WRITES A FILE, so there is nothing to publish.
    // Every one of the six tools answers in JSON, and the two that would be documents
    // elsewhere are not: loan_schedule returns the rows in the answer under a row ceiling
    // rather than a CSV, and loan_journal returns the double entry plus an expense_add-ready
    // payload for /mcp/expense-tracker to post, exactly as asset_journal does, because that
    // ledger's id counter, category rules and VAT split live inside its own handler.
    //
    // The register stays small by construction: NO SCHEDULE IS STORED. Only the terms and
    // two derived figures are kept per loan, and every row of every schedule is rebuilt on
    // the call, so the document does not grow with the term. 512 KB holds thousands of them.
    factory: createAmortization as () => McpServer,
  },
  "petty-cash": {
    // The amortization entry for the second time, and the same three absences for the same
    // three reasons. No sharedDoc: this server reads no sibling book, so there is nothing to
    // hydrate. It consumes four sibling ENGINES rather than four sibling stores - the cash
    // book's chart of accounts, the asset register's money formatting, the quotes engine's
    // today() and the timezone engine's readJsonFile - and borrowing CODE charges nothing to
    // this endpoint's cap, while a sharedDoc entry would hydrate four documents it never
    // opens. No publish() and no strip: NO TOOL WRITES A FILE. Every one of the seven tools
    // answers in JSON, and replenish_request - the one that would be a document elsewhere -
    // returns an expense_add-ready payload per category for /mcp/expense-tracker to post,
    // exactly as loan_journal and asset_journal do, because that ledger's id counter,
    // category rules and VAT split live inside its own expense_add handler. Nothing is
    // posted from here and no sibling store is written.
    //
    // The default 512 KB cap, and it does not have to be reasoned about: NO BALANCE IS
    // STORED. A float record holds its imprest, its top-ups and its counts; every balance is
    // derived on the call from those and the vouchers, so this document grows only with the
    // vouchers actually recorded and 512 KB holds many years of a real one-tin office.
    factory: createPettyCash as () => McpServer,
  },
  "work-order": {
    // The first endpoint since /mcp/statement-of-account that hydrates a sibling DOCUMENT
    // rather than only borrowing sibling CODE, and it hydrates exactly ONE, read-only: the
    // invoice client records. work_order_create looks the client up with findClient from
    // @theluckystrike/mcp-invoice/lib so a job carries the same record the invoice will be
    // raised against rather than a second spelling of the name, and a bare name that matches
    // nothing there is refused rather than invented. readOnly: true is the declaration, not
    // the habit - work_order_invoice_payload returns invoice_create ARGUMENTS and creates no
    // invoice, marks nothing paid and writes no client, so that document is never flushed
    // and this endpoint cannot bill a customer behind the invoice server's back.
    //
    // The shared business profile (business_set on /mcp/invoice) travels the same way every
    // other endpoint's does, through the licence shim, and is not a sharedDoc.
    //
    // What this endpoint owns is the board - orders.json and its per-year counter, under the
    // homedir shim, tmp + rename - and NO TOTAL IS STORED: the value, the hours, the
    // materials and the VAT are derived on every call from the lines, so 512 KB is a board
    // of jobs and never a pile of arithmetic.
    //
    // completion_report_pdf renders through remote/src/shims/pdf.ts by way of the vendored
    // @theluckystrike/mcp-billing-docs/lib and pushes its own download, so publish() only has
    // to catch the .txt completion_report_text writes under /out/ - and that one is free on
    // every tier, because the completion report is the document the customer signs.
    factory: createWorkOrder as () => McpServer,
    publish: (p) => p.startsWith("/out/"),
    strip: ["/out/"],
    sharedDoc: { server: "invoice", owns: (p) => p.startsWith(INVOICE_DIR), readOnly: true },
  },
  "catalogue": {
    // NO sharedDoc, and it is the strongest case of the four endpoints that carry none: this
    // one borrows four sibling ENGINES and reads not one sibling DOCUMENT. The money and VAT
    // arithmetic comes from @theluckystrike/mcp-invoice/lib (computeTotals, roundHalfUp,
    // currencyDecimals, formatMoney) so a resolved line and the invoice raised from it cannot
    // disagree by a minor unit; renderDocPdf comes from the billing-docs engine by way of
    // remote/src/shims/pdf.ts; today() and isIsoDate() from the quotes engine; readJsonFile
    // and its corrupt-store quarantine from the timezone engine. Borrowing CODE charges
    // nothing to this endpoint's cap, while a sharedDoc entry would hydrate documents it
    // never opens. The name and address at the top of a price list come from the SHARED
    // business profile (business_set on /mcp/invoice) through readSharedProfile, which
    // travels the licence shim exactly as it does on every other endpoint, and deliberately
    // not through the invoice engine's getBusiness(), whose dataDir() would bring another
    // server's directory into existence as a side effect of a read.
    //
    // lines_resolve returns invoice_create and quote_create ARGUMENTS and creates neither
    // document, so no sibling store is written from here either: the caller passes the
    // payload on, exactly as loan_journal and replenish_request hand theirs to
    // /mcp/expense-tracker.
    //
    // Both price lists go out as downloads. price_list_pdf renders through the pdf shim and
    // pushes its own link, so publish() only has to catch the .txt price_list_text writes
    // under /out/ - and that one is free on every tier, because the price list is the
    // document a customer is sent. out_path is a NAME here and not a path.
    //
    // The default 512 KB cap, and it did not have to be argued for: NO PRICE IS DERIVED AND
    // STORED. A SKU holds its price ROWS with the day each came into force and the price on
    // a date is worked out on the call, so the document grows with the price changes actually
    // booked and never with the dates they are asked about.
    factory: createCatalogue as () => McpServer,
    publish: (p) => p.startsWith("/out/"),
    strip: ["/out/"],
  },
  "change-order": {
    // NO sharedDoc, for the catalogue reason and one more: this endpoint does not open the
    // quotes store or the work-order store to find the contract it changes. The original
    // contract value is stated ONCE per reference, on the first change order raised against
    // it, and every later change order on that reference inherits the figure on file; a call
    // that states a different one is refused, because a contract with two original values
    // has two running values. Over stdio that is what keeps a change order raisable against
    // a quote that was priced on another machine; hosted, it is what keeps this endpoint from
    // hydrating two sibling documents it would never read. What it borrows is CODE: the money
    // and VAT arithmetic from @theluckystrike/mcp-invoice/lib (computeTotals, currencyDecimals,
    // formatMoney, roundHalfUp), so the delta and the invoice raised from it cannot disagree
    // by a minor unit; today() and isIsoDate() from the quotes engine; readJsonFile and its
    // corrupt-store quarantine from the timezone engine. The name and address on the document
    // come from the SHARED business profile (business_set on /mcp/invoice) through
    // readSharedProfile, which travels the licence shim exactly as it does everywhere else.
    //
    // change_order_invoice_payload returns invoice_create and quote_create ARGUMENTS and
    // creates neither document, so no sibling store is written from here either.
    //
    // One document goes out, and it is plain text: change_order_document, the approval sheet
    // the client signs, returns inline AND is written under /out/ as a .txt, which is what
    // publish() catches. It is Pro, exactly as over stdio, and the free tier gets the stdio
    // refusal with the same checkout links; nothing is written on a refusal. There is no
    // path argument on this endpoint to reduce to a name, and the build asserts that.
    //
    // The default 512 KB cap, and it did not have to be argued for: NO DELTA AND NO RUNNING
    // VALUE IS STORED. A change order holds its lines and its status history, and the delta,
    // the VAT and the running contract value are derived on every call, so the document
    // grows with the lines actually booked and never with the questions asked about them.
    factory: createChangeOrder as () => McpServer,
    publish: (p) => p.startsWith("/out/"),
    strip: ["/out/"],
  },
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

/* ------------------------------------------------------------------ auth */

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let keyPromise: Promise<CryptoKey> | null = null;
function publicKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey("raw", b64urlToBytes(PUBLIC_KEY_B64), { name: "Ed25519" }, false, ["verify"]);
  return keyPromise;
}

interface Auth {
  tenant: string;
  isPro: boolean;
  kind: "license" | "anon";
  limit: number;
  /** The anonymous bearer token itself, when kind is "anon". */
  anonToken?: string;
  /** Which of the three forms actually carried the token on this request. */
  via?: "Authorization: Bearer" | "URL path segment (/mcp/<server>/t/<token>)" | "URL query parameter (?token=)";
  /** True when an anonymous tenant is Pro because of a bound purchase, not a pasted key. */
  bound?: boolean;
}

/**
 * The tenant-binding decision, isolated so it can be tested without a Worker.
 *
 * An anonymous token is a data document, not a tier. When a purchase is made from a
 * hosted connection the billing worker writes `bind:<anonToken>` = the minted MCPL1 key;
 * this endpoint reads that key, verifies it with the same public key it verifies a pasted
 * key with, and if it holds, runs the request in Pro mode **against the same anonymous
 * document**. Nothing is copied, nothing is migrated, and a binding that is missing,
 * malformed, expired or signed for another product simply leaves the tenant free.
 */
export function decideBinding(
  verified: { ok: boolean; reason?: string } | null,
  limits: { free: number; pro: number } = { free: RATE_LIMIT_FREE, pro: RATE_LIMIT_PRO },
): { isPro: boolean; limit: number; bound: boolean; reason: string } {
  if (verified === null) return { isPro: false, limit: limits.free, bound: false, reason: "no binding" };
  if (!verified.ok) {
    return { isPro: false, limit: limits.free, bound: false, reason: verified.reason ?? "binding rejected" };
  }
  return { isPro: true, limit: limits.pro, bound: true, reason: "bound key verified" };
}

/**
 * What may appear in a tenant id. KV keys are built as `${tenant}:${server}` and the
 * sweep deletes by the `${tenant}:` prefix, so a ":" or any other delimiter inside an
 * id would make one tenant's prefix a prefix of another's. Ids are refused, not
 * escaped: a licence with an unusable id is a minting mistake, not a caller mistake.
 */
const TENANT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Verify an MCPL1 key exactly the way packages/mcp-license does, with WebCrypto.
 * `product` of "*" means "any product": used by /mcp/whoami, which is not one endpoint. */
async function verifyLicense(key: string, product: string): Promise<{ ok: boolean; reason?: string; id?: string; p?: string }> {
  const parts = key.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "MCPL1") return { ok: false, reason: "malformed key" };
  let payload: any;
  try { payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))); }
  catch { return { ok: false, reason: "bad payload" }; }
  let sigOk = false;
  try {
    sigOk = await crypto.subtle.verify({ name: "Ed25519" }, await publicKey(),
      b64urlToBytes(parts[2]), new TextEncoder().encode(parts[1]));
  } catch { sigOk = false; }
  if (!sigOk) return { ok: false, reason: "signature invalid" };
  if (payload?.v !== 1 || typeof payload.p !== "string" || typeof payload.id !== "string") return { ok: false, reason: "bad payload" };
  if (product !== "*" && payload.p !== "*" && payload.p !== product) return { ok: false, reason: `key is for ${payload.p}, not ${product}` };
  if (payload.exp !== undefined && payload.exp <= Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };
  return { ok: true, id: payload.id, p: payload.p };
}

/**
 * Two equivalent ways to present a token, because several MCP clients accept a remote URL
 * and nothing else - Claude.ai custom connectors, the Claude Desktop connector dialog and
 * some IDE pickers have no field for a header:
 *
 *   Authorization: Bearer <token>          the header form
 *   /mcp/<server>/t/<token>                the same token as a path segment
 *   /mcp/<server>?token=<token>            the same token as a query parameter
 *
 * The header wins when both are present. A token in a URL is a URL that grants access, so
 * it is treated exactly like a bearer: same tiers, same rate limits, same tenants.
 */
export const CONNECT_URL = "https://mcp.zovo.one/mcp/connect";

/** Crawlers and HTTP clients, matched anywhere in the User-Agent, never at position 0 only. */
const NOT_A_PERSON_UA = /(googlebot|bingbot|claudebot|gptbot|oai-searchbot|chatgpt-user|perplexitybot|ccbot|bytespider|amazonbot|applebot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|duckduckbot|baiduspider|yandexbot|facebookexternalhit|slackbot|twitterbot|discordbot|telegrambot|linkedinbot|whatsapp|headlesschrome|phantomjs|puppeteer|playwright|selenium|scrapy|crawler|spider|slurp|\bbot\b|bot\/|curl|libcurl|wget|python-requests|python-urllib|node-fetch|undici|axios|httpie|go-http-client|okhttp|java\/|apache-httpclient|libwww|powershell|postmanruntime|insomnia)/i;

/**
 * Is this a person opening this URL in a browser?
 *
 * Every top-level browser navigation since Chrome 76, Firefox 90 and Safari 16.4 sends both
 * `sec-fetch-mode: navigate` and `sec-fetch-dest: document`. No crawler sends them and no
 * HTTP library sends them unless told to, one header at a time. A prefetch is excluded too:
 * it arrives as `sec-purpose: prefetch`, and a prefetch that minted a token would hand the
 * reader a data space they never asked for and then throw the URL away.
 *
 * A browser that strips these headers gets the page with a one-click mint link rather than
 * a token, which costs one click. Getting it wrong the other way costs a 30-day tenant per
 * robot and a 429 for everyone behind a shared address.
 */
export function isBrowserNavigation(headers: Headers): boolean {
  const ua = headers.get("user-agent") ?? "";
  if (!ua || NOT_A_PERSON_UA.test(ua)) return false;
  if ((headers.get("sec-purpose") ?? "").includes("prefetch")) return false;
  return (headers.get("sec-fetch-mode") ?? "").toLowerCase() === "navigate"
    && (headers.get("sec-fetch-dest") ?? "").toLowerCase() === "document";
}

/**
 * The body of the 401 a tokenless request gets.
 *
 * `message` is the only field that reliably reaches a person. An MCP client receiving this
 * 401 does not render the JSON: it surfaces a tool or transport error, and whatever text it
 * shows comes from the top of the payload if it shows any at all. Until 2026-09-10 that one
 * string said where to PUT a token and never where to GET one, so the three places this
 * body does name `/mcp/connect` (`options[0].how`, `connect`, and the guide) were all
 * nested where nothing surfaces them.
 *
 * That mattered more than it looks, because the storefront was telling people to paste the
 * tokenless URL: `https://mcp.zovo.one/mcp/<server>` answers `initialize` and `tools/list`
 * with 200 and the full tool list, so the client connects and every tool appears, and then
 * every `tools/call` lands here. The symptom is a server that connected fine and refuses to
 * do anything, which explains itself to nobody. The storefront copy is fixed
 * (docs/FUNNEL_R1.md); this is the last line of defence behind it, so it names the
 * acquisition URL first and explains the symptom the reader is looking at.
 */
export function unauthorizedBody(product: string) {
  return {
    error: "unauthorized",
    message:
      `This endpoint needs a token and it is free. Open ${CONNECT_URL} in a browser: it mints one and prints a ready URL, ` +
      `https://mcp.zovo.one/mcp/${product}/t/<token>, which you can paste straight into a client that cannot set headers. ` +
      `Or GET https://mcp.zovo.one/mcp/token and send it as \`Authorization: Bearer <token>\`. ` +
      `The bare https://mcp.zovo.one/mcp/${product} answers initialize and tools/list without a token and then refuses every ` +
      `tool call, which is what just happened.`,
    forms: [
      { form: "header", how: "Authorization: Bearer <token>" },
      { form: "url path", how: `https://mcp.zovo.one/mcp/${product}/t/<token>`, note: "for clients that accept only a URL (Claude.ai and Claude Desktop custom connectors, several IDE pickers)" },
      { form: "url query", how: `https://mcp.zovo.one/mcp/${product}?token=<token>` },
    ],
    options: [
      { kind: "anonymous", how: `GET https://mcp.zovo.one/mcp/token, or open ${CONNECT_URL} for ready-made URLs`, tier: "free", limits: "600 calls/hour, free-tier server limits, data kept 30 days" },
      { kind: "pro", how: "Buy a key at https://mcp.zovo.one/buy/" + product + " and send it as the token", tier: "pro", limits: "6000 calls/hour, no server limits" },
    ],
    connect: CONNECT_URL,
    guide: GUIDE,
  };
}

async function authenticate(req: Request, env: Env, product: string, urlToken = "", urlTokenForm: Auth["via"] = "URL path segment (/mcp/<server>/t/<token>)"): Promise<Auth | Response> {
  const header = req.headers.get("authorization") ?? "";
  const fromHeader = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const token = fromHeader || urlToken.trim();
  const via: Auth["via"] = fromHeader ? "Authorization: Bearer" : urlTokenForm;
  if (!token) {
    return json(unauthorizedBody(product), 401, { "www-authenticate": `Bearer realm="mcp.zovo.one", error="invalid_token"` });
  }
  if (token.startsWith("MCPL1.")) {
    const r = await verifyLicense(token, product);
    if (!r.ok) return json({ error: "invalid_license", reason: r.reason, guide: GUIDE }, 401);
    if (!TENANT_ID_RE.test(r.id ?? "")) {
      return json({
        error: "invalid_license",
        reason: "the id in this key is not a usable storage key on the hosted endpoint (allowed: 1-64 characters of letters, digits, underscore or dash)",
        guide: GUIDE,
      }, 401);
    }
    return { tenant: `lic:${r.id}`, isPro: true, kind: "license", limit: RATE_LIMIT_PRO, via };
  }
  if (/^anon_[0-9a-f]{32}$/.test(token)) {
    const id = token.slice(5);
    if (!TENANT_ID_RE.test(id)) return json({ error: "invalid_token", guide: GUIDE }, 401);
    // The token's own record and any purchase bound to it are two independent reads; one
    // round trip, not two, because tools/list is on this path as well.
    const [seen, boundKey] = await Promise.all([
      env.REMOTE_DATA.get(`tok:${token}`),
      env.REMOTE_DATA.get(`bind:${token}`),
    ]);
    if (seen === null) return json({ error: "unknown_token", message: "Mint a new one at GET https://mcp.zovo.one/mcp/token", guide: GUIDE }, 401);
    // The billing worker writes bind:<token> on payment; this endpoint only ever reads it.
    const verified = boundKey ? await verifyLicense(boundKey.trim(), product) : null;
    const d = decideBinding(verified);
    return { tenant: `anon:${id}`, isPro: d.isPro, kind: "anon", limit: d.limit, anonToken: token, bound: d.bound, via };
  }
  return json({ error: "invalid_token", message: "Token is neither an MCPL1 licence key nor an anonymous token.", guide: GUIDE }, 401);
}

/**
 * The read decides; the counter write is deferred with waitUntil so it is not on the
 * caller's clock. The counter was already approximate - two concurrent requests read the
 * same value and both write n+1 - so deferring the write loses nothing that was ever
 * guaranteed, and takes a KV write out of every single call.
 */
async function rateLimit(env: Env, auth: Auth, ctx: ExecutionContext, product?: string): Promise<Response | null> {
  const bucket = Math.floor(Date.now() / 3_600_000);
  const key = `rl:${auth.tenant}:${bucket}`;
  const n = Number((await env.REMOTE_DATA.get(key)) ?? "0") + 1;
  if (n > auth.limit) {
    // D-R53: every other cap on this worker names what it costs to lift and links to
    // checkout with the tenant attached. This one used to name only the number, and the
    // retry-after was a flat hour when the counter is bucketed to the top of the UTC hour.
    const resetsAt = new Date((bucket + 1) * 3_600_000).toISOString();
    const retryAfter = Math.max(1, Math.ceil(((bucket + 1) * 3_600_000 - Date.now()) / 1000));
    const tenantQ = auth.anonToken ? `?tenant=${auth.anonToken}` : "";
    return json({
      error: "rate_limited",
      limit: auth.limit,
      window: "1 hour",
      resets_at: resetsAt,
      retry_after_seconds: retryAfter,
      note: auth.isPro
        ? `This token has made ${auth.limit} calls in the current hour. The counter resets at ${resetsAt}.`
        : `This token has made ${auth.limit} calls in the current hour, which is the free-tier ceiling. The counter resets at ${resetsAt}; a Pro token gets ${RATE_LIMIT_PRO} calls an hour. Note that a client which re-handshakes every registered endpoint on every turn spends several calls per turn before any tool runs. ` +
          `Or all ${SERVER_COUNT} servers for $${PRICE_BUNDLE_USD}: https://mcp.zovo.one/buy/bundle${tenantQ}${tenantQ ? "&" : "?"}src=${product ?? "bundle"}.rate_limit.bundle`,
      // src tags this cap message for the click instrument (docs/CONVERSION_INSTRUMENT.md).
      // The tool has not been parsed off the request body yet at this gate, so the tag is
      // product-level: "<product>.rate_limit".
      upgradeUrl: auth.isPro ? undefined : `https://mcp.zovo.one/buy/${product ?? "bundle"}${tenantQ}${tenantQ ? "&" : "?"}src=${product ?? "bundle"}.rate_limit`,
      // The bundle link is its own src tag, `<product>.rate_limit.bundle`, so a click on
      // the $39 offer is never counted as a click on the $19 one.
      bundleUrl: auth.isPro ? undefined : `https://mcp.zovo.one/buy/bundle${tenantQ}${tenantQ ? "&" : "?"}src=${product ?? "bundle"}.rate_limit.bundle`,
      // The same offer as fields rather than prose, so a client can branch on it instead
      // of reading `note`. It reports agent_settleable: false on purpose - see payment.ts.
      // A Pro caller who is merely over the hourly ceiling is not being asked for money,
      // so no descriptor is attached to that case at all.
      payment: auth.isPro ? undefined : paymentDescriptor({
        product: product ?? "bundle",
        reason: "rate_limit",
        feature: `more than ${auth.limit} calls an hour`,
        checkoutUrl: `https://mcp.zovo.one/buy/${product ?? "bundle"}${tenantQ}${tenantQ ? "&" : "?"}src=${product ?? "bundle"}.rate_limit`,
        bundleUrl: `https://mcp.zovo.one/buy/bundle${tenantQ}${tenantQ ? "&" : "?"}src=${product ?? "bundle"}.rate_limit.bundle`,
        guideUrl: GUIDE,
        priceUsd: PRICE_SINGLE_USD,
        bundlePriceUsd: PRICE_BUNDLE_USD,
        serverCount: SERVER_COUNT,
        tokenBound: Boolean(auth.anonToken),
        tier: "free",
      }),
      guide: GUIDE,
    }, 429, { "retry-after": String(retryAfter) });
  }
  ctx.waitUntil(env.REMOTE_DATA.put(key, String(n), { expirationTtl: 7200 }));
  return null;
}

/**
 * Constant-time secret comparison: both sides are HMAC-SHA-256'd under a key generated
 * fresh in this isolate, and the 32-byte digests are compared with no early exit, so
 * neither the length nor any prefix of the real secret is observable from timing.
 */
let cmpKeyPromise: Promise<CryptoKey> | null = null;
async function secretEquals(a: string, b: string): Promise<boolean> {
  // Generated on first use, not at module scope: Workers forbids random values there.
  cmpKeyPromise ??= crypto.subtle.importKey(
    "raw", crypto.getRandomValues(new Uint8Array(32)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const key = await cmpKeyPromise;
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.sign("HMAC", key, enc.encode(a)),
    crypto.subtle.sign("HMAC", key, enc.encode(b)),
  ]);
  const xa = new Uint8Array(x), ya = new Uint8Array(y);
  let diff = xa.length ^ ya.length;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i % ya.length];
  return diff === 0;
}

/* --------------------------------------------------------------- storage */

const dataKey = (tenant: string, server: string) => `${tenant}:${server}`;

async function hydrate(env: Env, tenant: string, server: string): Promise<Map<string, string>> {
  const raw = await env.REMOTE_DATA.get(dataKey(tenant, server));
  const files = new Map<string, string>();
  if (raw) {
    try {
      for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string>)) files.set(k, v);
    } catch { /* corrupt doc: start empty rather than fail the request */ }
  }
  return files;
}

/** The set of files that persist: no scratch files, and no transient download outputs. */
function persistable(
  files: Map<string, string>, cfg: ServerCfg, published: Map<string, string>,
  only?: (path: string) => boolean,
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of files) {
    if (TMP_RE.test(k)) continue;
    if (only && !only(k)) continue;
    if (cfg.persist && !cfg.persist(k)) continue;
    if (published.has(k) && !cfg.persistPublished) continue;
    obj[k] = v;
  }
  return obj;
}

/**
 * The shared business profile (packages/mcp-license/src/profile.ts, vendored onto the
 * fs shim by remote/src/shims/license.ts) lives at a fixed virtual path and its own
 * tenant document, `${tenant}:profile`, independent of any one server. It is hydrated
 * into every endpoint's request below - not just the ones that read it today - so a
 * server added later that imports readSharedProfile needs no change here.
 */
const PROFILE_SERVER = "profile";
const isProfilePath = (p: string) => p.startsWith("/profile/");

/** Same shape as persistable(), but for the profile document: no server's cfg.persist
 * applies to it (currency's `persist: () => false` must not eat the profile), and it is
 * never a download. */
function persistableProfile(files: Map<string, string>, published: Map<string, string>): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of files) {
    if (TMP_RE.test(k) || !isProfilePath(k) || published.has(k)) continue;
    obj[k] = v;
  }
  return obj;
}

async function flush(env: Env, tenant: string, server: string, after: string, before: string): Promise<void> {
  if (after === before) return;
  await env.REMOTE_DATA.put(dataKey(tenant, server), after);
}

/** Last-seen stamp for the orphan sweep. Data documents carry no TTL; tokens do. */
async function touch(env: Env, tenant: string): Promise<void> {
  await env.REMOTE_DATA.put(`meta:${tenant}`, JSON.stringify({ last_seen: Date.now() }));
}

/* -------------------------------------------------- shared ECB rate cache */

/**
 * The currency server caches two ECB files. They are the same bytes for every caller and
 * eurofxref-hist.xml is about 6 MB, so a per-tenant copy would multiply that by the number
 * of tokens; they live under one shared pair of KV keys instead, and are hydrated into
 * every request's in-memory filesystem at the paths the vendored store module reads.
 * Nothing about them is per-token, so they are exempt from the tenant caps (ctx.shared)
 * and never written into a tenant document (SERVERS.currency.persist).
 *
 * Refresh happens at most once per worker invocation, because the vendored read-through
 * cache only downloads when its own copy is older than the age limit. A KV lock key makes
 * a concurrent refresh in another isolate unlikely rather than impossible: it is
 * best effort, and the worst case is two isolates downloading the same file, after which
 * both write the same content and the last one wins.
 */
const ECB_DAILY_PATH = "/currency/daily.json";
const ECB_HISTORY_PATH = "/currency/history.json";
const SHARED_DAILY = "shared:ecb:daily";
const SHARED_HISTORY = "shared:ecb:history";
const SHARED_LOCK = "shared:ecb:lock";
const ECB_DAILY_MAX_AGE_MS = 6 * 60 * 60 * 1000;    // same limits as servers/currency/src/ecb.ts
const ECB_HISTORY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ECB_LOCK_TTL = 60;                            // seconds; KV's minimum

/** Which tool calls need the 6 MB history file. The daily file is always hydrated. */
function needsEcbHistory(body: string): boolean {
  return /rate_history|rate_on|cache_status|"date"/.test(body);
}

function ecbAgeMs(raw: string | null): number {
  if (raw === null) return Number.POSITIVE_INFINITY;
  try {
    const t = Date.parse((JSON.parse(raw) as { fetched_at?: string }).fetched_at ?? "");
    return Number.isFinite(t) ? Date.now() - t : Number.POSITIVE_INFINITY;
  } catch { return Number.POSITIVE_INFINITY; }
}

async function hydrateOneEcb(
  env: Env, key: string, path: string, maxAgeMs: number, files: Map<string, string>,
): Promise<string | null> {
  let raw = await env.REMOTE_DATA.get(key);
  if (raw === null || ecbAgeMs(raw) >= maxAgeMs) {
    // Stale or missing: this request will go to the ECB unless someone else already is.
    const lock = `${SHARED_LOCK}:${key}`;
    if ((await env.REMOTE_DATA.get(lock)) !== null) {
      const again = await env.REMOTE_DATA.get(key);   // the holder may have just finished
      if (again !== null) raw = again;
    } else {
      await env.REMOTE_DATA.put(lock, String(Date.now()), { expirationTtl: ECB_LOCK_TTL });
    }
  }
  if (raw !== null) files.set(path, raw);
  return raw;
}

/** Hydrate the shared cache; returns what was hydrated, so a refresh can be detected. */
async function hydrateEcb(env: Env, files: Map<string, string>, body: string): Promise<Map<string, string | null>> {
  const before = new Map<string, string | null>();
  const wantHistory = needsEcbHistory(body);
  const [daily, history] = await Promise.all([
    hydrateOneEcb(env, SHARED_DAILY, ECB_DAILY_PATH, ECB_DAILY_MAX_AGE_MS, files),
    wantHistory
      ? hydrateOneEcb(env, SHARED_HISTORY, ECB_HISTORY_PATH, ECB_HISTORY_MAX_AGE_MS, files)
      : Promise.resolve(null),
  ]);
  before.set(ECB_DAILY_PATH, daily);
  before.set(ECB_HISTORY_PATH, wantHistory ? history : null);
  return before;
}

/** Write a refreshed shared file back, and drop the lock so the next refresh is not blocked. */
async function flushEcb(env: Env, files: Map<string, string>, before: Map<string, string | null>): Promise<void> {
  for (const [path, key] of [[ECB_DAILY_PATH, SHARED_DAILY], [ECB_HISTORY_PATH, SHARED_HISTORY]] as const) {
    const now = files.get(path);
    if (now === undefined || now === before.get(path)) continue;
    await env.REMOTE_DATA.put(key, now);
    await env.REMOTE_DATA.delete(`${SHARED_LOCK}:${key}`);
  }
}

/* ----------------------------------------------------------------- index */

const TOOLS: Record<string, string[]> = {
  "time-tracker": ["timer_start", "timer_stop", "timer_status", "entry_add", "entry_list", "entry_delete", "entry_edit", "project_set_rate", "report", "invoice_summary", "export_csv", "license_status", "license_activate"],
  "price-tracker": ["price_check", "watch_add", "watch_list", "watch_remove", "watch_refresh", "price_history", "price_add_manual", "alerts_pending", "license_status", "license_activate"],
  "invoice": ["business_set", "client_add", "client_list", "invoice_create", "invoice_from_hours", "invoice_list", "invoice_get", "invoice_mark_paid", "invoice_pdf", "overdue_report", "license_status", "license_activate"],
  "expense-tracker": ["expense_add", "expense_list", "expense_update", "expense_delete", "receipt_attach", "category_rules", "expense_settings", "expense_summary", "mileage_add", "expense_export", "expense_to_invoice", "license_status", "license_activate"],
  "spreadsheet": ["sheet_load", "sheet_files", "sheet_unload", "sheet_info", "sheet_read", "sheet_query", "sheet_stats", "sheet_find", "sheet_add_column", "sheet_convert", "sheet_write", "license_status", "license_activate"],
  "currency": ["rates_latest", "convert", "convert_many", "fx_rates_for", "rate_history", "rate_on", "currencies_list", "cache_status", "license_status", "license_activate"],
  "timezone": ["now", "convert_time", "overlap", "find_meeting_slots", "dst_changes", "business_days", "contacts_set", "contacts_list", "ics_create", "license_status", "license_activate"],
  "docx": ["doc_upload", "doc_files", "doc_delete_upload", "business_set", "doc_create", "doc_from_markdown", "doc_read", "doc_to_html", "doc_fill_template", "proposal_create", "contract_create", "license_status", "license_activate"],
  "resume": ["doc_upload", "doc_files", "doc_delete_upload", "profile_set", "profile_get", "resume_create", "resume_to_markdown", "resume_to_html", "resume_read", "cover_letter_create", "tailor_to_job", "license_status", "license_activate"],
  "recurring": ["schedule_create", "schedule_list", "schedule_get", "schedule_update", "schedule_pause", "schedule_resume", "schedule_delete", "schedule_skip", "schedule_upcoming", "invoice_generate_due", "schedule_history", "forecast", "license_status", "license_activate"],
  "clauses": ["clause_add", "clause_get", "clause_update", "clause_delete", "clause_list", "clause_search", "clause_import", "clause_export", "contract_assemble", "variables_list", "license_status", "license_activate"],
  "pdf": ["pdf_upload", "pdf_files", "pdf_delete_upload", "pdf_info", "pdf_count", "pdf_merge", "pdf_split", "pdf_pages", "pdf_rotate", "pdf_stamp", "pdf_watermark_business", "pdf_reorder", "pdf_text", "license_status", "license_activate"],
  "calendar": ["ics_import", "calendars_list", "events_list", "events_search", "free_busy", "conflicts", "next_event", "event_export", "event_to_time_entry", "ics_forget", "license_status", "license_activate"],
  "kanban": ["task_add", "task_list", "task_move", "task_update", "task_done", "task_delete", "task_search", "board", "task_start_timer", "task_log_time", "project_list", "overdue", "weekly_review", "columns_set", "license_status", "license_activate"],
  "image": ["image_upload", "image_files", "image_delete_upload", "image_info", "image_resize", "image_convert", "image_compress", "image_crop", "image_thumbnails", "image_watermark", "image_strip_metadata", "image_batch_resize", "image_dominant_colors", "license_status", "license_activate"],
  "bank-statement": ["bank_upload", "bank_files", "bank_delete_upload", "statement_import", "transactions_list", "transactions_search", "category_rules", "transaction_categorize", "statement_summary", "reconcile_expenses", "recurring_detect", "statement_export", "accounts_list", "license_status", "license_activate"],
  "barcode": ["qr_create", "qr_wifi", "qr_vcard", "qr_payment_sepa", "invoice_payment_qr", "barcode_create", "barcode_batch", "code_list", "license_status", "license_activate"],
  "quotes": ["quote_create", "quote_list", "quote_get", "quote_update", "quote_send_text", "quote_accept", "quote_decline", "quote_pdf", "quote_report", "license_status", "license_activate"],
  "zip": ["zip_upload", "zip_files", "zip_delete_upload", "zip_create", "zip_list", "zip_extract", "zip_extract_text", "zip_add", "zip_bundle_month", "zip_history", "license_status", "license_activate"],
  "billing-docs": ["credit_note_create", "credit_note_list", "credit_note_get", "credit_note_pdf", "credit_note_text", "purchase_order_create", "purchase_order_list", "purchase_order_get", "purchase_order_pdf", "purchase_order_text", "purchase_order_receive", "billing_docs_report", "license_status", "license_activate"],
  "per-diem": ["perdiem_rates", "perdiem_calc", "trip_record", "trip_list", "trip_export", "perdiem_report", "license_status", "license_activate"],
  "deposits": ["deposit_record", "deposit_list", "deposit_apply", "deposit_refund", "deposit_balance", "deposit_statement_text", "deposit_statement_pdf", "deposits_report", "license_status", "license_activate"],
  "asset-register": ["asset_add", "asset_list", "asset_schedule", "asset_journal", "asset_dispose", "asset_report", "license_status", "license_activate"],
  "statement-of-account": ["statement_build", "statement_aging", "statement_text", "statement_pdf", "dunning_text", "statements_report", "license_status", "license_activate"],
  "cash-book": ["ledger_build", "trial_balance", "ledger_lines", "month_close", "ledger_export_csv", "ledger_report", "license_status", "license_activate"],
  "amortization": ["loan_create", "loan_schedule", "loan_repay_early", "loan_journal", "loan_list", "loans_report", "license_status", "license_activate"],
  "petty-cash": ["float_open", "topup_record", "voucher_add", "voucher_delete", "reconcile", "replenish_request", "float_report", "license_status", "license_activate"],
  "work-order": ["work_order_create", "work_order_add_line", "work_order_status", "work_order_get", "work_order_list", "work_order_delete", "completion_report_text", "completion_report_pdf", "work_order_invoice_payload", "work_orders_report", "license_status", "license_activate"],
  "catalogue": ["sku_set", "sku_get", "sku_list", "sku_delete", "rate_set", "rate_get", "lines_resolve", "price_list_text", "price_list_pdf", "catalogue_report", "license_status", "license_activate"],
  "change-order": ["change_order_create", "change_order_add_line", "change_order_status", "change_order_get", "change_order_list", "change_order_delete", "contract_value", "change_order_document", "change_order_invoice_payload", "license_status", "license_activate"],
};

const ENDPOINT_URLS = (base: string) => Object.keys(SERVERS).map((n) => `${base}/mcp/${n}`);

function indexDoc(base: string) {
  return {
    name: "mcp.zovo.one remote MCP endpoints",
    protocol: "MCP streamable HTTP (2025-06-18)",
    transport: "streamable-http",
    auth: {
      oauth: "none - this endpoint deliberately has no OAuth flow; a static token is all a client needs",
      forms: [
        {
          form: "header",
          scheme: "Authorization: Bearer <token>",
          use_when: "your client can set a header (Claude Code with --header, curl, an SDK)",
          example: `${base}/mcp/<server>`,
        },
        {
          form: "url-path",
          scheme: `${base}/mcp/<server>/t/<token>`,
          use_when: "your client accepts a URL and nothing else - Claude.ai custom connectors, the Claude Desktop connector dialog, several IDE pickers",
          note: "the same token, the same tiers and the same rate limits as the header; the URL itself is the credential, so treat it as private",
        },
        {
          form: "url-query",
          scheme: `${base}/mcp/<server>?token=<token>`,
          use_when: "a client that takes a query string but not a header",
        },
      ],
      precedence: "an Authorization header wins over a token in the URL",
      connect_page: { url: `${base}/mcp/connect`, what: "mints a free token and prints the ready URL for every server, with per-client instructions" },
      whoami: { url: `${base}/mcp/whoami`, also: `${base}/mcp/whoami/t/<token>`, returns: "{tenant, tier, bound}" },
      anonymous: { mint: `${base}/mcp/token`, format: "anon_<32 hex>", tier: "free", data_retention_days: 30, rate_limit: `${RATE_LIMIT_FREE}/hour`, mint_rate_limit: `${TOKEN_MINTS_PER_IP}/hour per client IP` },
      pro: {
        buy: `${base}/buy/<product>`,
        format: "MCPL1.<payload>.<signature>",
        verified: "Ed25519, offline",
        rate_limit: `${RATE_LIMIT_PRO}/hour`,
        bound_purchase: `Buying through ${base}/buy/<product>?tenant=<anon token> binds that purchase to the anonymous token: the same URL then runs in Pro mode over the same anonymous data document, with no key to paste and nothing to move. The free-cap answers on this endpoint already carry that link.`,
      },
      guide: GUIDE,
    },
    endpoints: [
      { name: "time-tracker", url: `${base}/mcp/time-tracker`, tools: TOOLS["time-tracker"], free_limits: "reports cover the last 7 days, 2 rated projects", notes: "export_csv returns a download link valid for one hour instead of a local file path" },
      { name: "price-tracker", url: `${base}/mcp/price-tracker`, tools: TOOLS["price-tracker"], free_limits: "3 watches, last 30 observations per watch", notes: "public http/https pages only; private, loopback, link-local and metadata addresses are refused, before and after every redirect" },
      { name: "invoice", url: `${base}/mcp/invoice`, tools: TOOLS["invoice"], free_limits: "3 invoices per calendar month, footer line on the rendered document", notes: "invoice_pdf renders a print-ready HTML document behind a one-hour download link" },
      { name: "expense-tracker", url: `${base}/mcp/expense-tracker`, tools: TOOLS["expense-tracker"], free_limits: "last 30 days, 3 projects, 5 category rules, 200 export rows, 20 rebill items per call, csv/json export (xlsx is Pro)", notes: "expense_export returns a download link valid for one hour (xlsx is delivered as the real binary workbook). receipt_attach is not available: this endpoint has no filesystem, so attach receipts with the stdio server" },
      {
        name: "spreadsheet", url: `${base}/mcp/spreadsheet`, tools: TOOLS["spreadsheet"],
        mode: "inline data",
        how: "There is no disk here, so you send the data instead of a path: sheet_load {name, csv} or sheet_load {name, xlsx_base64} stores it under your token, and every other tool takes that name as its `path` argument. sheet_files lists what is loaded, sheet_unload deletes one.",
        outputs: "sheet_convert, sheet_write and sheet_add_column write into the same per-token store and return a download link valid for one hour; xlsx comes back as the real binary workbook.",
        free_limits: "5,000 rows and 5 MB read per sheet, 500 rows written per file",
        storage: `${SPREADSHEET_MAX_BYTES / 1048576} MB of loaded sheets per token`,
      },
      {
        name: "currency", url: `${base}/mcp/currency`, tools: TOOLS["currency"],
        free_limits: "historical rates over the last 90 days (Pro reads the series back to 1999-01-04)",
        notes: "ECB reference rates. The two ECB files are one shared cache for the whole endpoint, refreshed at most every 6 hours (daily) and 24 hours (history); nothing here is per-token, and only https://www.ecb.europa.eu is ever fetched",
      },
      {
        name: "timezone", url: `${base}/mcp/timezone`, tools: TOOLS["timezone"],
        free_limits: "3 participants, 5 days per search, 5 saved contacts, 3 calendar files per month",
        notes: "contacts are kept per token; ics_create returns a download link valid for one hour instead of a local file path, and out_path is only the name that file carries",
      },
      {
        name: "docx", url: `${base}/mcp/docx`, tools: TOOLS["docx"],
        mode: "upload and download",
        how: "There is no disk here: doc_upload {name, docx_base64} stores an existing .docx under your token and every tool takes that name as its `path`; doc_read and doc_fill_template also accept docx_base64 directly, which stores the file under the same root (default name 'inline' / 'template'). doc_files lists what is uploaded, doc_delete_upload removes one.",
        outputs: "doc_create, doc_from_markdown, proposal_create, contract_create, doc_fill_template and doc_to_html return a download link valid for one hour; .docx comes back as the real binary file (application/vnd.openxmlformats-officedocument.wordprocessingml.document).",
        free_limits: "3 proposals or contracts per calendar month, templates up to 10 placeholders, footer line and default letterhead",
        storage: `${DOCX_MAX_BYTES / 1048576} MB of uploaded documents per token, and at most 2 MB in one upload (the ${MAX_BODY_BYTES / 1024} KB request-body cap binds first)`,
      },
      {
        name: "resume", url: `${base}/mcp/resume`, tools: TOOLS["resume"],
        mode: "upload and download",
        how: "The profile is stored per token: profile_set once, then resume_create, resume_to_html, resume_to_markdown, cover_letter_create and tailor_to_job read it. There is no disk here, so resume_read takes docx_base64 directly, or a name uploaded with doc_upload {name, docx_base64}.",
        outputs: "resume_create, resume_to_html and cover_letter_create return a download link valid for one hour; .docx comes back as the real binary file. resume_to_markdown returns the markdown in the answer.",
        free_limits: "3 cover letters per calendar month, the \"modern\" resume style, one default profile variant, 2,000 characters of job description in tailor_to_job",
        storage: `${DOCX_MAX_BYTES / 1048576} MB of profile, letter history and uploaded documents per token`,
      },
      {
        name: "recurring", url: `${base}/mcp/recurring`, tools: TOOLS["recurring"],
        mode: "shares the invoice store",
        how: "invoice_generate_due writes real invoices into the same per-token invoice data the /mcp/invoice endpoint serves, under the same number series, so invoice_list and overdue_report there show them. Set the issuer and the clients once with business_set and client_add on /mcp/invoice.",
        outputs: "each generated invoice comes back as a print-ready HTML document behind a one-hour download link (there is no PDF renderer on Workers)",
        free_limits: "3 active schedules, 30 days of schedule_upcoming, 12 periods per forecast",
      },
      {
        name: "clauses", url: `${base}/mcp/clauses`, tools: TOOLS["clauses"],
        how: "The clause library is per token and is seeded with the starter set on first use. clause_import needs a file on a disk, which this endpoint does not have: add clauses with clause_add, or import locally over stdio.",
        outputs: "contract_assemble and clause_export return a download link valid for one hour; .docx comes back as the real binary file.",
        free_limits: "10 clauses of your own on top of the starter set, 8 clauses per assembled document, markdown import and export (JSON is Pro)",
      },
      {
        name: "pdf", url: `${base}/mcp/pdf`, tools: TOOLS["pdf"],
        mode: "upload and download",
        how: "There is no disk here: pdf_upload {name, pdf_base64} stores a PDF under your token and every `path` argument - and every entry of `paths` - is that name. pdf_files lists what is stored, pdf_delete_upload removes one.",
        outputs: "pdf_merge, pdf_split, pdf_pages, pdf_rotate, pdf_stamp, pdf_watermark_business and pdf_reorder return a download link valid for one hour, served as application/pdf. The file is also kept under your token, so a merged file can be stamped by the next call.",
        free_limits: "up to 5 files per merge, files up to 30 pages for split, pages, rotate and stamp, the PAID and DRAFT stamp presets in their preset colours; pdf_info, pdf_count and pdf_text are unlimited",
        storage: `${PDF_MAX_BYTES / 1048576} MB of stored PDFs per token, and at most ${PDF_MAX_BYTES / 1048576} MB in one upload - the ${MAX_BODY_BYTES / 1024} KB request-body cap binds long first, which is roughly 190 KB of PDF once base64-encoded`,
        notes: "pdf_text is best-effort extraction with node:zlib and has no OCR, exactly as it is over stdio",
      },
      {
        name: "calendar", url: `${base}/mcp/calendar`, tools: TOOLS["calendar"],
        mode: "import and download",
        how: "ics_import {text, name} pastes a calendar export in; ics_import {url, name} fetches a public https or webcal feed (Pro). A path is not available: this endpoint has no filesystem. Calendars are kept per token and calendars_list shows them.",
        outputs: "event_export returns a download link valid for one hour, served as text/calendar; out_path is only the name that file carries",
        free_limits: "2 calendars, a 31-day window per read, 50 events per export; importing from a URL is Pro",
        storage: `${CALENDAR_MAX_BYTES / 1048576} MB of imported calendars per token; one import is capped at 5 MB, and the ${MAX_BODY_BYTES / 1024} KB request-body cap binds long first`,
        notes: "a feed URL is checked against every literal private, loopback, link-local and metadata address before the first hop and again after every redirect; there is no override",
      },
      {
        name: "kanban", url: `${base}/mcp/kanban`, tools: TOOLS["kanban"],
        how: "Boards, columns and tasks are kept per token; nothing is uploaded and nothing is downloaded. task_add creates the board on first use, board renders it as a table, and columns_set changes the column set.",
        free_limits: "3 projects, 200 open tasks, the default 5 columns (a custom column set is Pro)",
        notes: "day boundaries - due today, overdue, weekly_review - are computed in the timezone on the shared business profile for your token when one is set (business_set {timezone} on /mcp/invoice), and in UTC otherwise. task_start_timer hands the task to /mcp/time-tracker, which is a separate document for the same token, so the sibling-project warning the stdio server prints is not available here",
        storage: `${DEFAULT_MAX_BYTES / 1024} KB of boards and tasks per token`,
      },
      {
        name: "image", url: `${base}/mcp/image`, tools: TOOLS["image"],
        mode: "upload and download",
        how: "There is no disk here: image_upload {name, image_base64} stores a PNG, JPEG, BMP, GIF or TIFF under your token and every `path` argument - and every entry of `paths` - is that name. The format is read from the magic bytes, not from the name. image_files lists what is stored, image_delete_upload removes one.",
        outputs: "image_resize, image_convert, image_compress, image_crop, image_strip_metadata, image_thumbnails and image_batch_resize return a download link valid for one hour, served with the real image content type (image/png, image/jpeg, image/bmp, image/gif, image/tiff). The file is also kept under your token, so a resized image can be cropped by the next call. out_dir is not a directory here: each output is its own link.",
        free_limits: "sources up to 4 MP and 5 files per batch call; image_info is unlimited, and image_dominant_colors is Pro",
        storage: `${IMAGE_MAX_BYTES / 1048576} MB of stored images per token, and at most ${IMAGE_MAX_BYTES / 1048576} MB in one upload - the ${MAX_BODY_BYTES / 1024} KB request-body cap binds long first, which is roughly 190 KB of image once base64-encoded`,
        notes: "decoding runs on jimp under nodejs_compat. image_watermark is not available: it draws with bitmap font files loaded from a filesystem, which this endpoint does not have",
      },
      {
        name: "bank-statement", url: `${base}/mcp/bank-statement`, tools: TOOLS["bank-statement"],
        mode: "upload and download",
        how: "There is no disk here: bank_upload {name, content} sends the bank export as text (content_base64 sends the bytes instead, which keeps a UTF-16 export from Excel readable) and statement_import takes that name as its `path`. bank_files lists what is stored, bank_delete_upload removes one. Columns, delimiter, date order and number locale are detected from the file, and a line already stored is skipped rather than doubled, so re-importing an overlapping export is safe.",
        outputs: "statement_export returns a download link valid for one hour, served as text/csv or application/json",
        free_limits: "2 accounts, reads the last 12 months, 5 category rules; reconcile_expenses, recurring_detect and statement_export are Pro",
        storage: `${BANK_MAX_BYTES / 1048576} MB of uploaded statements and stored transactions per token, and at most 1 MB in one upload (the ${MAX_BODY_BYTES / 1024} KB request-body cap binds first)`,
        notes: "reconcile_expenses reads the expense ledger stored for the SAME token on /mcp/expense-tracker, hydrated read-only and never written. The parser reads delimited exports (comma, semicolon, tab), exactly as it does over stdio",
      },
      {
        name: "quotes", url: `${base}/mcp/quotes`, tools: TOOLS["quotes"],
        mode: "shares the invoice store",
        how: "Quote a client with quote_create (prices in MINOR units: 9000 is 90.00 EUR), send it with quote_send_text, and quote_accept turns it into a real invoice in the same per-token invoice data the /mcp/invoice endpoint serves, under the same number series and the same client list. Set the issuer once with business_set on /mcp/invoice; the shared business profile is the same for both.",
        outputs: "quote_pdf returns a print-ready HTML quote behind a one-hour download link (there is no PDF renderer on Workers, so it is the same document invoice_pdf produces, in the quote layout). quote_send_text returns the pasteable text in the answer and the same text as a .txt download link.",
        free_limits: "5 open quotes at a time (accepted, declined and lapsed ones never count); quote_pdf and quote_report are Pro",
        notes: "an accepted quote's stored lines are copied into the invoice, never recomputed, so a VAT default changed between quoting and accepting cannot move the total the client agreed to. The invoice is written through the shared engine, so the /mcp/invoice free cap of 3 invoices a month does not apply to it; the quotes free cap does. Today's date comes from the timezone on the shared profile when one is set, which is what a validity window is counted in",
      },
      {
        name: "barcode", url: `${base}/mcp/barcode`, tools: TOOLS["barcode"],
        mode: "download",
        how: "There is no disk here: out_path is not a path, it is only the name the downloaded file carries (1-64 characters of letters, digits, underscore or dash). Leave it out and an SVG comes back inline in the answer, ready to paste into a document; a PNG always comes back as a link.",
        outputs: "qr_create, qr_wifi, qr_vcard, qr_payment_sepa, invoice_payment_qr, barcode_create and barcode_batch return a download link valid for one hour, served as image/svg+xml or image/png",
        free_limits: "20 codes per calendar month, SVG output; PNG output and barcode_batch are Pro",
        notes: "invoice_payment_qr reads the invoice stored for the SAME token on /mcp/invoice for the amount and the reference, hydrated read-only and never written, and takes the beneficiary IBAN and name from the shared business profile (business_set on /mcp/invoice). A PNG barcode carries no printed digits under the bars: jimp's bitmap fonts are files on a filesystem this endpoint does not have, and the SVG, which is the default, draws its own text and does carry them",
      },
      {
        name: "zip", url: `${base}/mcp/zip`, tools: TOOLS["zip"],
        mode: "upload and download",
        how: "There is no disk here: zip_upload {name, content_base64} sends an archive's bytes (a name ending .zip is checked for the PK magic before it is stored) or {name, content} sends a text file to pack, and every `path` argument is one of those names. zip_files lists what is stored, zip_delete_upload removes one. zip_create packs uploaded files by name; `dir` is refused rather than ignored, because there is no directory tree to walk.",
        outputs: "zip_create and zip_add return the archive as a download link valid for one hour (application/zip), and zip_extract returns ONE link per entry, served with that entry's own content type. There are no directories, so out_dir is accepted and ignored and at most 20 entries are extracted per call.",
        free_limits: "20 archives per calendar month, 25 MB per archive, 200 entries per archive; zip_list, zip_extract and zip_extract_text are free on every tier, because the archive somebody sent you is the one that most needs checking",
        storage: `${ZIP_MAX_BYTES / 1048576} MB of uploaded files and the register per token, and at most 1 MB in one upload - the ${MAX_BODY_BYTES / 1024} KB request-body cap binds long first, which is roughly 190 KB of archive once base64-encoded`,
        notes: "every bomb, traversal, absolute-path and symlink guard is decided from the central directory before a byte is inflated, and each entry's CRC is checked against the data, exactly as over stdio. zip_bundle_month is a local (stdio) tool only: it bundles the output FOLDERS the sibling servers write on a disk, and every hosted endpoint hands its documents back as a download link instead, so there is no folder here to read",
      },
      {
        name: "billing-docs", url: `${base}/mcp/billing-docs`, tools: TOOLS["billing-docs"],
        mode: "shares the invoice store",
        how: "Credit an invoice with credit_note_create (in full, by amount_minor, or line by line: prices in MINOR units, 9000 is 90.00 EUR) against an invoice in the same per-token invoice data the /mcp/invoice endpoint serves, and raise supplier orders with purchase_order_create. Set the issuer once with business_set on /mcp/invoice; the shared business profile is the same for both, and a supplier the invoice server already knows brings its address and VAT id onto the order.",
        outputs: "credit_note_pdf and purchase_order_pdf return a print-ready HTML document behind a one-hour download link (there is no PDF renderer on Workers, so it is the invoice layout titled CREDIT NOTE or PURCHASE ORDER). credit_note_text and purchase_order_text return the pasteable text in the answer and the same text as a .txt download link.",
        free_limits: "5 documents per calendar month, credit notes and purchase orders together; both text exports are free, and credit_note_pdf, purchase_order_pdf and billing_docs_report are Pro",
        notes: "a credit note can never take back more than the invoice's remaining creditable amount, which is the invoice total less everything already credited against it. Crediting a whole invoice or a whole line copies the stored numbers rather than recomputing them; a partial amount is split across the invoice's own VAT rates, in proportion to each rate's share of the total, so a mixed-rate invoice is never credited at one rate. Every money field on a credit note is stored negative, the unit price included",
      },
      {
        name: "deposits", url: `${base}/mcp/deposits`, tools: TOOLS["deposits"],
        mode: "shares the invoice store",
        how: "Record the money a client paid up front with deposit_record (amounts in MINOR units: 50000 is 500.00 EUR), then deposit_apply puts part or all of it on an invoice in the same per-token invoice data the /mcp/invoice endpoint serves, and deposit_refund gives the rest back. deposit_balance and deposits_report say what is still held. Set the issuer once with business_set on /mcp/invoice; the shared business profile is the same for all of them.",
        outputs: "deposit_statement_pdf returns a print-ready HTML statement behind a one-hour download link (there is no PDF renderer on Workers, so it is the same A4 layout the credit note uses, titled DEPOSIT STATEMENT). deposit_statement_text returns the pasteable text in the answer and the same text as a .txt download link.",
        free_limits: "5 deposits recorded per calendar month; deposit_apply, deposit_refund, deposit_list, deposit_balance and deposit_statement_text are free and unlimited on every tier, because money already held has to be able to leave the book. deposit_statement_pdf and deposits_report are Pro",
        notes: "deposit_apply writes the payment onto the invoice the way the invoice server's own invoice_mark_paid writes one - paid_minor, paid_date and status - but ADDS to paid_minor rather than replacing it, so a deposit applied after a bank transfer does not erase that transfer. It can never pay out more than the deposit still holds or more than the invoice still owes, and a deposit is applied at its own currency and never converted. A refund never touches the invoice: giving a client their own money back is not a payment of a bill",
      },
      {
        name: "per-diem", url: `${base}/mcp/per-diem`, tools: TOOLS["per-diem"],
        mode: "bundled rate tables",
        how: "perdiem_rates lists a scheme's rates with the authority, instrument, source URL and effective date they came from; perdiem_calc prices one trip; trip_record saves it. Start and end are instants: either ISO 8601 carrying its own offset, or a local datetime plus an IANA timezone, so a trip across a clock change is 23 or 25 hours and not 24. The traveller's name comes from the shared business profile (business_set on /mcp/invoice).",
        outputs: "JSON only. There is no document to render and nothing is written outside your own trip store. trip_export returns the exact expense_add ARGUMENTS for a trip, one payload for subsistence and, with split_lodging, a second for lodging, to pass to /mcp/expense-tracker yourself: this endpoint never appends to that ledger, because the expense server's id counter, category rules and VAT split all live inside its own expense_add handler.",
        free_limits: "5 trips recorded per calendar month; perdiem_rates, perdiem_calc and trip_list are free and unlimited on every tier, because a per diem rate is public information published by a tax authority. trip_export and perdiem_report are Pro",
        notes: "the rates are BUNDLED tables, not a feed: pl (Dz.U. 2022 poz. 2302), uk (HMRC benchmark scale rates) and us (GSA CONUS). Nothing is fetched, so the same trip prices the same way on every run, and every answer carries the header saying which instrument the figure came from and when it was read. A rate that could not be stated with confidence from the published text was OMITTED rather than guessed, so a destination that is not bundled is REFUSED by name and sent to the source instead of being priced from a near-match. Currencies are never added together: there is no exchange rate in this endpoint",
      },
      {
        name: "asset-register", url: `${base}/mcp/asset-register`, tools: TOOLS["asset-register"],
        mode: "bundled rate tables",
        how: "asset_add puts one fixed asset on the register with the rate, useful life and convention read off the bundled tax table (cost and residual in MINOR units: 600000 is 6,000.00 PLN), asset_schedule builds its depreciation schedule per year or per month, asset_journal gives one month's debit and credit lines, asset_dispose books a sale or a write-off against net book value, and asset_report values the register. The scheme is derived from the shared business profile currency (business_set on /mcp/invoice) when you leave it out, and every answer says so in words rather than pretending it is a stored fact.",
        outputs: "JSON only. There is no document to render and nothing is written outside your own register. asset_journal returns the expense_add ARGUMENTS for the month, one payload per currency, to pass to /mcp/expense-tracker yourself: this endpoint never appends to that ledger, because the expense server's id counter, category rules and VAT split all live inside its own expense_add handler.",
        free_limits: "10 assets in the register; asset_list, asset_schedule and asset_dispose are free and unlimited on every tier, because a depreciation rate is published by a tax authority and an asset already on the register has to be able to leave it. asset_journal and asset_report are Pro",
        notes: "the rates are BUNDLED tables, not a feed: pl (the annual depreciation rate annex to the CIT act of 15 February 1992, keyed to the KST 2016), uk (Capital Allowances Act 2001 writing down allowances) and us (IRS Publication 946 MACRS GDS). Nothing is fetched, so the same asset depreciates the same way on every run, and every answer carries the header saying which instrument the rate came from and when it was read. A category that could not be stated with confidence from the published text was OMITTED rather than guessed, so an unbundled category is REFUSED by name rather than matched to a near neighbour - and never by substring, because \"land\".includes(\"and\") would have priced equipment at the land row's 0 percent in silence. The schedule periods sum EXACTLY to cost less residual to the minor unit, with the rounding remainder placed on the last period rather than dropped, and a residual over cost is refused. Currencies are never added together: there is no exchange rate in this endpoint",
      },
      {
        name: "statement-of-account", url: `${base}/mcp/statement-of-account`, tools: TOOLS["statement-of-account"],
        mode: "reads three stores, writes none of them",
        how: "statement_build states one client's account for a period (opening balance, invoices issued, payments received, credit notes, deposits applied, closing balance), statement_aging breaks what is owed into 0-30, 31-60, 61-90 and over 90 days past the due date AS AT a date you choose, and dunning_text writes the chaser at level 1 friendly, 2 firm or 3 final demand. Every figure is read from the same per-token data your /mcp/invoice, /mcp/billing-docs and /mcp/deposits endpoints serve; the issuer and the bank details a chaser prints come from the shared business profile (business_set on /mcp/invoice).",
        outputs: "statement_pdf returns a print-ready HTML statement behind a one-hour download link (there is no PDF renderer on Workers, so it is the same A4 layout the credit note and the deposit statement use, titled STATEMENT OF ACCOUNT). statement_text and dunning_text return the pasteable text in the answer and the same text as a .txt download link.",
        free_limits: "5 distinct statements per calendar month, counted by client, period and currency, so re-rendering one you already built is free forever in all three renderings; statement_aging is free and unlimited on every tier, because 'who owes me money' is the question this endpoint exists for. statement_pdf, dunning_text level 3 and statements_report are Pro",
        notes: "the three sibling stores are hydrated READ-ONLY and never written: this endpoint reports on books it does not own. A store that is missing is not an error and reads as zero rows; a store that is present and did not parse is reported as unreadable with a sentence naming which figure is incomplete, rather than being read as an empty book, and an unreadable invoice ledger refuses every tool by name. paid_minor on the invoice is the authority and the payment rows are only the attribution, so a deposit already applied is broken out rather than counted twice, and deposit money still HELD is a memo line and never in the balance. Aging is as at the date asked for in both directions - an invoice issued after it is not on the books, a payment made after it has not happened - and due today is not overdue. Currencies are never added together, and no dunning level states a late fee, an interest rate or a legal cost, because this endpoint holds no contract terms and no jurisdiction",
      },
      {
        name: "cash-book", url: `${base}/mcp/cash-book`, tools: TOOLS["cash-book"],
        mode: "reads six stores, writes none of them",
        how: "ledger_build derives one double-entry ledger for one period in one currency from the same per-token data your /mcp/invoice, /mcp/billing-docs, /mcp/deposits, /mcp/expense-tracker, /mcp/bank-statement and /mcp/asset-register endpoints serve; trial_balance proves the debits equal the credits to the minor unit; ledger_lines lists the legs, filtered by account, source server, source document or date; month_close names what the month leaves unposted and records a trial balance snapshot. Every line carries the server, the document id and the document date it came from.",
        outputs: "JSON, plus ledger_export_csv, which returns the period's legs as RFC 4180 CSV behind a one-hour download link (text/csv, one row per leg). Nothing is ever written into any of the six books: no payment, no status, no counter.",
        free_limits: "3 distinct periods per calendar month, metered by from, to and currency, so rebuilding a period already in the register is free forever; trial_balance and ledger_lines are free and unlimited on every tier, because whether the books add up is the question this endpoint exists for and a free tier that hides the answer is a demo. month_close, ledger_export_csv and ledger_report are Pro",
        notes: "the bank import posts NOTHING. A bank line and a payment record are one movement seen twice, so cash is posted from the DOCUMENTS, which are the only rows carrying a second leg, and each bank row is matched to a posted cash movement of the same amount, the same direction and a date within three days, as evidence written onto the line as bank_ref. On the worked month that is 99.6 percent duplication: posting the import as well moves cash from -10,543.00 to -21,111.00 EUR and the trial balance still comes to zero, because every duplicated receipt arrives with its own contra. What is left after matching - a bank debit with no expense behind it, a posted movement with no bank line - is the entire reason to import a statement. Nothing is ever balanced with a plug: an entry whose own legs do not add up is posted as the document states it and the difference is raised by name. A deposit applied to an invoice never touches cash, because the cash arrived when the deposit did. Expense VAT comes OUT of a VAT-inclusive gross, never on top of it. An open purchase order is a memo and is never posted. This ledger opens at nothing: a balance here is the period's MOVEMENT, because an opening figure nobody can walk back to a document is the first invented number in a set of books. Currencies are never added together. A store that is missing reads as zero rows and says so; a store that is present and did not parse is reported as unreadable, distinctly, because a figure that could not be computed is not a figure of zero and a ledger short one whole store still balances perfectly",
      },
      {
        name: "amortization", url: `${base}/mcp/amortization`, tools: TOOLS["amortization"],
        mode: "arithmetic on terms you record",
        how: "loan_create records one loan or lease from its terms (principal, fees and balloon in MINOR units, the rate in nominal annual basis points) and returns its id, its level payment and its effective annual rate; loan_schedule builds every period - opening balance, payment, interest, principal, closing balance - with the total interest; loan_repay_early prices settling or overpaying at a period, gross and net of the lender's penalty; loan_journal gives the double entry for one period or one month; loans_report values the debt per currency and names the next payment due.",
        outputs: "JSON only. NO tool here writes a file, so there is nothing to download and nothing is published. loan_journal returns the expense_add ARGUMENTS for the interest alone, to pass to /mcp/expense-tracker yourself: this endpoint posts to no ledger, because the expense server's id counter, category rules and VAT split live inside its own expense_add handler.",
        free_limits: "3 loans in the register; loan_schedule and loan_list are free and unlimited on every tier, because what a payment is made of is the question this endpoint exists for and a free tier that hides it is a demo. loan_repay_early, loan_journal and loans_report are Pro",
        notes: "the payment never varies and the last period absorbs the rounding residual in its interest and principal SPLIT, not in the payment, so every payment is the amount on the agreement and the closing balance reaches the balloon, or zero, exactly. Compounding and payment frequency are two different clocks: the rate for one payment period is the equivalent rate taken through the compounding clock, never the nominal rate divided by the number of payments, which is worth about 1 percent of the interest on a one-year loan in the lender's favour and is invisible in a quote. NO SCHEDULE IS STORED - only the terms are, and every row is derived on the call, because a stored schedule is a second copy of what the rate and the term already decide and the copy is the one that gets believed after somebody edits the rate. A level payment rounded once can clear the debt before the term ends, and the schedule STOPS where the debt does rather than filling out the term with rows the borrower does not owe. Fees are paid at drawdown and are not interest; a balloon is due WITH the last payment and never inside it. Only the interest is an expense: booking the whole payment overstates the cost of the business by the principal every period and still reconciles against the bank. Nothing is posted from here, and currencies are never added together",
      },
      {
        name: "petty-cash", url: `${base}/mcp/petty-cash`, tools: TOOLS["petty-cash"],
        mode: "a float you keep, on your own token",
        how: "float_open opens a petty cash tin on the imprest system - the amount the tin is topped back up to at every replenishment, in whole MINOR units, so 50000 is EUR 500.00. voucher_add records one receipt paid out of it, voucher_delete removes one entered wrongly, topup_record records cash physically going back in, reconcile counts the tin against the paperwork, replenish_request works out the cheque that restores the imprest and float_report states every float against its imprest with the history of what the counts found.",
        outputs: "JSON only. NO tool here writes a file, so there is nothing to download and nothing is published. replenish_request returns the expense_add ARGUMENTS per category, to pass to /mcp/expense-tracker yourself, and the double entry in /mcp/cash-book's own account ids: this endpoint posts to no ledger and no expense book, because the expense server's id counter, category rules and VAT split live inside its own expense_add handler.",
        free_limits: "1 float and 20 vouchers a calendar month; reconcile and voucher_delete are free and unlimited on every tier, because whether the cash in the tin matches the paperwork is the question this endpoint exists for and a free tier that withholds the answer is a demo. replenish_request and float_report are Pro",
        storage: `${DEFAULT_MAX_BYTES / 1024} KB of floats and vouchers per token`,
        notes: "the replenishment is IMPREST MINUS BALANCE and never the sum of the vouchers. The two differ by exactly what the counts found over or short, and reimbursing the voucher total restores the float that much light for good, every cycle, while every reconciliation still reports a clean difference. NO BALANCE IS STORED - the imprest, the top-ups, the counts and the vouchers decide it on the call, because a stored balance is the copy that gets believed after somebody deletes a voucher. A count is a FACT, so it moves the book balance and the difference is carried forward as a cash_over_short line rather than re-reported at every later count. A float is cash in a tin: a voucher larger than the balance is refused, and so is a back-dated one that would leave any LATER day negative, named by the day it breaks rather than the day it was typed. A voucher already covered by a count cannot be deleted, and a byte-identical one is refused by id unless duplicate_ok says the same thing really was bought twice. Under the imprest system petty_cash does not move: a replenishment credits cash and debits the expenses, and the float account is not in that journal at all. The chart of accounts is IMPORTED from /mcp/cash-book rather than restated, so a category spelled three ways is one account and no rename there can leave this endpoint posting to an account that ledger does not have. Currencies are never added together",
      },
      {
        name: "work-order", url: `${base}/mcp/work-order`, tools: TOOLS["work-order"],
        mode: "your own board, plus the invoice client records read-only",
        how: "work_order_create opens a job against a client already in your /mcp/invoice client records, at a site address, with a requested date and a priority; work_order_add_line records the hours (kind labour, with the rate in MINOR units) and the parts fitted (kind parts, with the unit cost in MINOR units and an optional markup percent); work_order_status walks the job draft to scheduled to in_progress to done to invoiced, one step at a time, each step carrying its own date; completion_report_text and completion_report_pdf are the document the customer signs; work_order_invoice_payload hands back invoice_create arguments; work_orders_report values the board.",
        outputs: "JSON, plus two documents: completion_report_text returns the report inline AND as a .txt download link, and completion_report_pdf returns the A4 report as an HTML print-to-PDF download (there is no PDF renderer on Workers). out_path is a NAME here, not a path: it only decides what the downloaded file is called.",
        free_limits: "5 OPEN work orders, counted on the board rather than on the calendar, so closing a job frees its slot and work_order_delete on a draft with no lines is free on every tier; completion_report_text is free, because the completion report is the one document the customer signs. completion_report_pdf, work_order_invoice_payload and work_orders_report are Pro",
        storage: `${DEFAULT_MAX_BYTES / 1024} KB of work orders per token`,
        notes: "the markup goes on the UNIT cost and never on the line total. Seven parts at 1299 minor units with 15 percent on top is 1494 a unit and 10,458 on the line; marking up the line total is 10,457, and only the first is a figure an invoice can reproduce, because /mcp/invoice rounds a unit price into minor units first and computes the line from that stored value. The payload's totals are computed by the invoice server's OWN computeTotals over the payload's own items, so there is no second implementation to disagree. NO TOTAL IS STORED - the lines decide it on every call, because a stored total is the copy that gets believed after somebody edits a line. The status machine moves one step forward at a time: a skipped step is refused naming the step that IS next, because every step carries its own date and a job that reached invoiced without done was never marked finished. A backwards step is refused, because a job that has to go back is a new work order. Hours are counted on the LINE date, not on the order date, so a February call worked in March logs its hours in March. This endpoint creates NO invoice and marks nothing: work_order_invoice_payload returns arguments, and the invoice client records it reads are hydrated READ-ONLY and never written. A client name that matches no invoice client record is refused unless you pass an address, because a misspelling would raise an invoice with an empty BILL TO block. A labour rate is never improvised: no default hourly rate exists in the shared profile today, so rate_minor is refused by name rather than invented onto a report the customer signs"
      },
      {
        name: "catalogue", url: `${base}/mcp/catalogue`, tools: TOOLS["catalogue"],
        mode: "your own price list",
        how: "sku_set records a product with its unit and a price row carrying the day that price comes into force, per currency and per tier; sku_get and sku_list read the price in force on any date; rate_set and rate_get do the same for hourly labour rates by role; lines_resolve turns a list of sku and role lines into invoice_create-ready and quote_create-ready items priced as of each line's date; price_list_text and price_list_pdf print the list a customer is sent; catalogue_report names the rows in force, the rows a later row already replaces and the SKUs with no price in your default currency.",
        outputs: "JSON, plus two documents: price_list_text returns the list inline AND as a .txt download link, and price_list_pdf returns the A4 list as an HTML print-to-PDF download (there is no PDF renderer on Workers). out_path is a NAME here, not a path: it only decides what the downloaded file is called.",
        free_limits: "25 SKUs, and one price tier; lines_resolve and price_list_text are free and unlimited on every tier, because pricing a line is the one thing the invoice and quote servers come here for and a catalogue nobody can read is not a catalogue. Deleting an unused SKU is free, so the cap is one you can get back under. price tiers other than standard, price_list_pdf and catalogue_report are Pro",
        storage: `${DEFAULT_MAX_BYTES / 1024} KB of SKUs, rate cards and the usage register per token`,
        notes: "NO CURRENT PRICE IS STORED. A SKU holds its price ROWS with the day each came into force, and the price on a date is the latest valid_from at or before it, worked out on the call, because a stored current price is the copy still being quoted a month after the rise. A date before every row has no price and is refused rather than priced off the earliest row. The two payloads are in DIFFERENT SCALES on purpose, because the two servers take them differently: invoice_create takes unit_price in MAJOR units and quote_create takes unit_price_minor in MINOR units, prices are held in minor units as the only lossless form, and swapping the two payloads misprices the job by 100x. The money and VAT arithmetic is /mcp/invoice's own computeTotals, imported rather than copied, so a resolved line and the invoice raised from it cannot disagree by a minor unit. An unknown code is refused BY NAME and never priced, and a partial name matching more than one product is refused with the list rather than resolved to the first. This endpoint creates NO invoice and NO quote: lines_resolve returns arguments, and no sibling store is read or written",
      },
      {
        name: "change-order", url: `${base}/mcp/change-order`, tools: TOOLS["change-order"],
        mode: "your own change orders, against a quote or work order named by its id",
        how: "change_order_create raises a change order against a quote or work order by its id, with the client, a one-line title, the date and, on the first change order against that reference, the original contract value in whole MINOR units, which every later one inherits; change_order_add_line records each added or removed line with its quantity and unit price, or a changed line with the old and the new quantity and price, each with a reason and a date; change_order_status walks it draft to sent to approved or rejected, or draft or sent to void, each step dated; change_order_get and change_order_list read them; contract_value states the running value of one reference; change_order_document is the approval sheet the client signs; change_order_invoice_payload hands back invoice_create and quote_create arguments for the approved delta.",
        outputs: "JSON, plus one document: change_order_document returns the approval sheet inline AND as a .txt download link valid for one hour. change_order_invoice_payload returns the approved delta as invoice_create arguments in MAJOR units and quote_create arguments in MINOR units, and creates neither.",
        free_limits: "5 OPEN change orders (draft and sent), counted on the pile the client has not answered rather than on the calendar, so approving, rejecting or voiding one frees its slot, and change_order_delete on a draft with no lines is free on every tier; contract_value is free and unlimited, because the running value is the question this endpoint exists for. change_order_document and change_order_invoice_payload are Pro",
        storage: `${DEFAULT_MAX_BYTES / 1024} KB of change orders per token`,
        notes: "the original contract value is stated ONCE per reference and inherited by every later change order against it; a call that states a different figure is refused, because a contract with two original values has two running values and the customer sees whichever was typed last. NO DELTA AND NO RUNNING VALUE IS STORED: the lines and the status history decide both on every call. The running value is the original plus APPROVED deltas only; draft and sent deltas are shown as pending and never added in, and rejected and void ones count for nothing. A changed line becomes TWO items on the invoice payload, a reversal of the old quantity at the old price and the new quantity at the new price, never one net item, so both figures reproduce on a calculator; a removed line is a negative quantity at the price it was booked at. The two payloads are in DIFFERENT SCALES on purpose: invoice_create takes unit_price in MAJOR units and quote_create takes unit_price_minor in MINOR units, and swapping them misprices the delta by 100x; quote_create.ready is false whenever any quantity is not positive, because that server refuses one. Lines are added only while a change order is a draft, a draft cannot be approved unsent, and every status date must follow the last. This endpoint opens neither the quotes store nor the work-order store, creates NO invoice and NO quote, and the money arithmetic is /mcp/invoice's own computeTotals, imported rather than copied",
      },
    ],
    limits: {
      request_body_bytes: MAX_BODY_BYTES,
      jsonrpc_batching: "not accepted - send one request object per POST",
      stored_bytes_per_token_per_endpoint: { default: DEFAULT_MAX_BYTES, spreadsheet: SPREADSHEET_MAX_BYTES, docx: DOCX_MAX_BYTES, resume: DOCX_MAX_BYTES, pdf: PDF_MAX_BYTES, calendar: CALENDAR_MAX_BYTES, image: IMAGE_MAX_BYTES, "bank-statement": BANK_MAX_BYTES, zip: ZIP_MAX_BYTES, "cash-book": CASH_BOOK_MAX_BYTES, currency: "no per-token storage" },
      download_ttl_seconds: DOWNLOAD_TTL,
      idle_data_retention_days: SWEEP_AFTER_DAYS,
    },
    // Nothing is published to npm, so `npx -y @theluckystrike/mcp-<name>` returns 404 for
    // everyone who reads this document. It used to be the first install line here. The two
    // that work today lead; the npx form stays last, labelled, because it is the line that
    // becomes correct the day the publish happens and nothing else about it changes.
    one_click_install: `download <name>.mcpb from ${RELEASES} and open it in Claude Desktop; no JSON and no terminal`,
    stdio_install: "git clone https://github.com/theluckystrike/mcp-servers.git, npm install, npm run build -w packages/mcp-license -w servers/<name>, then: claude mcp add <name> -- node /absolute/path/to/mcp-servers/servers/<name>/dist/index.js",
    stdio_install_npm_pending: "claude mcp add <name> -- npx -y @theluckystrike/mcp-<name> - NOT WORKING YET: no @theluckystrike package is published, so this returns 404. Use one_click_install or stdio_install.",
    remote_install: 'claude mcp add --transport http <name> https://mcp.zovo.one/mcp/<name> --header "Authorization: Bearer <token>"',
    remote_install_no_header: "claude mcp add --transport http <name> https://mcp.zovo.one/mcp/<name>/t/<token>",
    source: "https://github.com/theluckystrike/mcp-servers",
  };
}

/**
 * What one endpoint says to a request that carries no credential at all.
 *
 * Every one of these endpoints used to answer a bare `GET /mcp/<server>` with 401. That is
 * the correct answer to a client whose token is wrong, and the wrong answer to the two
 * callers who actually send it: a directory's health prober, and a person who pasted the
 * URL into a browser. The Glama directory mirrors four of these servers from the official
 * MCP registry and displayed all four with a red "Server is not responding" badge, sourced
 * from exactly this 401; one awesome-list rejects entries whose public endpoint does not
 * answer; and Cloudflare logged 24,330 401 responses on this hostname in a single week,
 * making it the most common thing the domain said to anyone.
 *
 * So a credential-free GET now describes the server and says where a token comes from.
 * The authorisation boundary does not move: POST is untouched, a GET that carries an
 * Authorization header still goes through authenticate() (which is also what the
 * Streamable HTTP event stream sends), and so does a GET carrying a token in the URL, so
 * an invalid or expired token is refused exactly as before.
 *
 * Nothing here is typed twice. Every field is lifted from indexDoc(), which is the same
 * document /mcp already serves, so the public description of a server cannot drift from
 * the index's description of it.
 */
/**
 * The human page for a hosted endpoint. Same facts as publicEndpointDoc, laid out for a
 * person who clicked a search result rather than a client that parsed the JSON. It says
 * what the server does, what it costs, and the two ways to actually use it, and it links
 * to the product page which is where a purchase can happen.
 */
function endpointPage(base: string, product: string): string {
  const d = publicEndpointDoc(base, product) as Record<string, unknown>;
  const esc = (x: unknown) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const tools = (d.tools as string[] | undefined) ?? [];
  const title = `${product} MCP server, hosted with no install`;
  const desc = String(d.summary ?? "").slice(0, 155);
  const store = `https://mcp.zovo.one/s/${product}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${base}/mcp/${esc(product)}">
<style>:root{color-scheme:light dark}
body{margin:0;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#fbfbfa;color:#18202e}
main{max-width:720px;margin:0 auto;padding:44px 20px 80px}
h1{font-size:26px;margin:0 0 6px}h2{font-size:18px;margin:30px 0 8px}
code{background:#ebf0f8;padding:2px 6px;border-radius:4px;font-size:14px}
pre{background:#18202e;color:#ebf0f8;padding:14px;border-radius:8px;overflow-x:auto;font-size:13px}
a{color:#2a78d6}.muted{color:#52514e;font-size:14px}
ul{padding-left:20px}li{margin:4px 0}
@media(prefers-color-scheme:dark){body{background:#151514;color:#ebf0f8}code{background:#26262b}.muted{color:#a8a79f}}
</style></head><body><main>
<h1>${esc(product)}</h1>
<p>${esc(d.summary)}</p>
<p class="muted">This URL is a Model Context Protocol endpoint. It speaks streamable HTTP to an MCP client; it is not a web app. If you reached it from a search result, the two ways to actually use it are below.</p>

<h2>Use it with no install</h2>
<p>Open <a href="${base}/mcp/connect">${base}/mcp/connect</a>. It mints a free anonymous token and prints a ready-to-paste URL for this server and every other one. Paste that URL into any client that accepts a URL, such as Claude.ai custom connectors or the Claude Desktop connector dialog.</p>
<p>Or set the header yourself:</p>
<pre>curl ${base}/mcp/token
curl -X POST ${base}/mcp/${esc(product)} \\
  -H "Authorization: Bearer &lt;token&gt;" \\
  -H "content-type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'</pre>

<h2>Or run it on your own machine</h2>
<p>Download <code>${esc(product)}.mcpb</code> from the <a href="https://github.com/theluckystrike/mcp-servers/releases/latest">latest release</a> and double-click it in Claude Desktop. Nothing leaves your computer on that path.</p>

<h2>What it can do</h2>
<p>${tools.length} tools:</p>
<ul>${tools.map((t) => `<li><code>${esc(t)}</code></li>`).join("")}</ul>
${d.free_limits ? `<h2>Free tier</h2><p>${esc(d.free_limits)}</p>` : ""}
<p><a href="${store}">Full description, examples and pricing for ${esc(product)}</a> &middot; <a href="https://mcp.zovo.one">all servers</a> &middot; <a href="https://github.com/theluckystrike/mcp-servers">source</a></p>
</main></body></html>`;
}

function publicEndpointDoc(base: string, product: string) {
  const doc = indexDoc(base);
  const e = (doc.endpoints as Record<string, unknown>[]).find((x) => x.name === product) ?? {};
  const tools = (e.tools as string[] | undefined) ?? [];
  const prose = (e.how as string | undefined) ?? (e.notes as string | undefined) ?? "";
  return {
    ok: true,
    name: product,
    url: `${base}/mcp/${product}`,
    protocol: doc.protocol,
    transport: doc.transport,
    build: BUILD_VERSION,
    // The first sentence of the endpoint's own `how`, or its `notes` when it has none.
    summary: prose.split(/(?<=\.)\s/)[0] || `${tools.length} MCP tools over streamable HTTP.`,
    tool_count: tools.length,
    tools,
    free_limits: (e.free_limits as string | undefined) ?? "",
    authentication: {
      note: "This GET is public so a health check and a browser both get an answer. The JSON-RPC traffic is POST and still needs a token.",
      get_a_free_token: `GET ${base}/mcp/token`,
      ready_made_urls: `GET ${base}/mcp/connect`,
      header_form: "Authorization: Bearer <token>",
      url_form: `${base}/mcp/${product}/t/<token>`,
    },
    index: `${base}/mcp`,
    source: doc.source,
  };
}

/* ------------------------------------------------------------ orphan sweep */

/**
 * Anonymous tokens carry a 30-day TTL and disappear on their own; the data documents
 * they wrote do not. Every authenticated request stamps meta:<tenant>; this deletes
 * `${tenant}:*` and the stamp once nothing has touched the tenant for SWEEP_AFTER_DAYS.
 */
async function sweep(env: Env): Promise<{ scanned: number; expired: number; deleted: number }> {
  const cutoff = Date.now() - SWEEP_AFTER_DAYS * 86_400_000;
  let scanned = 0, expired = 0, deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await env.REMOTE_DATA.list({ prefix: "meta:", cursor, limit: 1000 });
    for (const k of page.keys) {
      scanned++;
      const tenant = k.name.slice("meta:".length);
      if (!tenant) continue;
      let lastSeen = 0;
      try { lastSeen = Number(JSON.parse((await env.REMOTE_DATA.get(k.name)) ?? "{}").last_seen ?? 0); } catch { lastSeen = 0; }
      if (lastSeen > cutoff) continue;
      expired++;
      let dc: string | undefined;
      do {
        const docs = await env.REMOTE_DATA.list({ prefix: `${tenant}:`, cursor: dc, limit: 1000 });
        for (const d of docs.keys) { await env.REMOTE_DATA.delete(d.name); deleted++; }
        dc = docs.list_complete ? undefined : docs.cursor;
      } while (dc);
      await env.REMOTE_DATA.delete(k.name);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return { scanned, expired, deleted };
}

/* ------------------------------------------------- tools/list, cached */

/**
 * tools/list is the first thing every client sends and it is pure: the answer depends on
 * the endpoint and the tier, never on the tenant's data. It used to cost a full request -
 * three KV reads, an McpServer with every zod schema, a transport - for an answer that is
 * byte-identical for every caller. It is now built once per isolate per (build, endpoint,
 * tier) by running that same real path once, and served from module scope afterwards.
 *
 * Built from the real server rather than from a hand-written table, so a vendored change
 * to a tool's description or schema cannot drift away from what this returns.
 */
const toolsCache = new Map<string, string>();

async function toolsJson(product: string, cfg: ServerCfg, isPro: boolean, base: string): Promise<string> {
  const key = `${BUILD_VERSION}:${product}:${isPro ? "pro" : "free"}`;
  const hit = toolsCache.get(key);
  if (hit !== undefined) return hit;
  // An empty virtual filesystem: listing tools reads no tenant state, and a handler that
  // tried to would not run here anyway.
  const rctx: RequestCtx = {
    tenant: "cache:tools", server: product, isPro,
    files: new Map(), dirs: new Set(), downloads: [], baseUrl: base,
    publish: cfg.publish, published: new Map(), maxBytes: cfg.maxBytes ?? DEFAULT_MAX_BYTES,
    bytes: 0, nfiles: 0, fds: new Map(), nextFd: 100,
  };
  const text = await STORE.run(rctx, async () => {
    const server = cfg.factory();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      const res = await transport.handleRequest(new Request(`${base}/mcp/${product}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      }));
      return await res.text();
    } finally {
      await transport.close().catch(() => {});
      await server.close().catch(() => {});
    }
  });
  const tools = (JSON.parse(text) as { result?: { tools?: unknown } })?.result?.tools;
  if (!Array.isArray(tools)) throw new Error(`tools/list for ${product} did not return a tool array`);
  const out = JSON.stringify(tools);
  toolsCache.set(key, out);
  return out;
}

/** The JSON-RPC method and id of a request body, without committing to a full parse twice. */
function rpcEnvelope(body: string): { method: string | null; id: unknown; hasId: boolean; hasCursor: boolean } {
  try {
    const o = JSON.parse(body) as Record<string, unknown>;
    const params = (o?.params ?? {}) as Record<string, unknown>;
    return {
      method: typeof o?.method === "string" ? o.method : null,
      id: o?.id,
      hasId: o !== null && typeof o === "object" && "id" in o && o.id !== null,
      hasCursor: typeof params?.cursor === "string",
    };
  } catch {
    return { method: null, id: null, hasId: false, hasCursor: false };
  }
}

/**
 * Methods that cannot touch a tenant document. They are answered without hydrating KV at
 * all - three reads saved on the two calls every client makes before it does any work.
 */
/** Calls per hour an unauthenticated discovery probe may make. Generous enough for any
 * directory health check, small enough that it is not a free anonymous tier. */
const DISCOVERY_LIMIT = 120;

const DATALESS_METHODS = new Set(["tools/list", "initialize", "notifications/initialized", "ping", "prompts/list", "resources/list", "resources/templates/list"]);

/* ------------------------------------------------------------ connect page */

const CONNECT_CSS = `:root{color-scheme:light dark}
body{margin:0;font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#fbfbfa;color:#1a1a1a}
main{max-width:860px;margin:0 auto;padding:40px 20px 80px}
h1{font-size:26px;margin:0 0 6px}h2{font-size:19px;margin:34px 0 10px}h3{font-size:15px;margin:22px 0 6px}
p{margin:10px 0}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px}
pre{background:#f0efec;border:1px solid #e0dedb;border-radius:6px;padding:10px 12px;overflow-x:auto;margin:8px 0}
table{border-collapse:collapse;width:100%;margin:10px 0;font-size:13px}
th,td{border:1px solid #e0dedb;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f0efec;font-weight:600}
td.u{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all}
.tok{background:#f0efec;border:1px solid #e0dedb;border-radius:6px;padding:10px 12px;word-break:break-all}
.note{color:#5a5a5a;font-size:13px}
a{color:#1a4fd6}
a.mint{display:inline-block;background:#1a4fd6;color:#fff;text-decoration:none;border-radius:6px;padding:9px 16px;font-weight:600;margin:6px 0}
@media (prefers-color-scheme:dark){body{background:#16161a;color:#e8e8e6}pre,th,.tok{background:#202027;border-color:#33333c}td,th{border-color:#33333c}.note{color:#a3a3a8}a{color:#8ab4ff}a.mint{background:#2b5fe0;color:#fff}}`;

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A product page of our own, so price-tracker can be tried (and this suite's runs
 * reproduced) without pointing a fetcher at somebody else's shop. `?price=` sets the
 * asking price so a drop can be demonstrated on a URL the caller controls; everything
 * else on the page is fixed. The price is carried in JSON-LD, which is the "high"
 * confidence path in the extractor, and repeated in the visible text.
 */
function sampleProductPage(base: string, priceRaw: string | null): string {
  const price = /^\d{1,6}(\.\d{1,2})?$/.test(String(priceRaw ?? "")) ? Number(priceRaw).toFixed(2) : "49.00";
  const ld = JSON.stringify({
    "@context": "https://schema.org", "@type": "Product",
    name: "Zovo Sample Desk Lamp",
    sku: "ZS-LAMP-01",
    offers: { "@type": "Offer", priceCurrency: "EUR", price, availability: "https://schema.org/InStock", url: `${base}/mcp/sample/product` },
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zovo Sample Desk Lamp</title><style>${CONNECT_CSS}</style>
<script type="application/ld+json">${ld}</script></head><body><main>
<h1>Zovo Sample Desk Lamp</h1>
<p class="tok">EUR ${price}</p>
<p>SKU ZS-LAMP-01. In stock. This is a fixture page served by mcp.zovo.one so you can try the
price-tracker server against a URL nobody else owns. Add <code>?price=39.00</code> to the URL to
serve a different asking price and watch an alert fire.</p>
<p class="note">Not a shop: nothing here is for sale.</p>
</main></body></html>`;
}

/**
 * `token` may be the empty string. Minting is a KV write and a 30-day tenant, so it does
 * NOT happen for a crawler, a prefetch or a HEAD (see the /mcp/connect route). Those get
 * this same page with `<token>` where the token would be and one link that mints. That is
 * what makes the page safe to put in the sitemap, which it needs to be now that it is the
 * hero destination of every product page and of /llms.txt (docs/FUNNEL_R1.md).
 */
function connectPage(base: string, token: string): string {
  const shown = token || "&lt;token&gt;";
  const rows = Object.keys(SERVERS).map((n) =>
    `<tr><td>${n}</td><td class="u">${token ? esc(`${base}/mcp/${n}/t/${token}`) : `${esc(`${base}/mcp/${n}/t/`)}&lt;token&gt;`}</td></tr>`).join("\n");
  const first = Object.keys(SERVERS)[0];
  const ready = token ? `${base}/mcp/${first}/t/${token}` : `${base}/mcp/${first}/t/<token>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to mcp.zovo.one</title><style>${CONNECT_CSS}</style></head><body><main>
<h1>Connect an MCP client</h1>
<p>Every URL below carries a free anonymous token, so there is no header to set, no account
and nothing to install. Paste one into your client and it works.</p>

<h2>Your token</h2>
<p class="tok">${token ? esc(token) : shown}</p>
${token ? `<p class="note">Free tier: 600 calls an hour, free-tier server limits, data kept 30 days and
refreshed for another 30 on every write. Anyone holding this token holds your data space, so
treat the URLs as private. Reloading this page mints a new token and a new, empty data space;
keep this one to keep your data.</p>` : `<p><a class="mint" href="${base}/mcp/connect?mint=1">Get my free token</a> &mdash; one click, no account, nothing to fill in.</p>
<p class="note">A token is minted for you when you open this page in a browser. This copy was
served without one, which happens for crawlers, prefetches and HEAD requests, because minting
stores a data space for 30 days and doing that for a robot would fill the store with tenants
nobody owns. Free tier: 600 calls an hour, free-tier server limits, data kept 30 days and
refreshed for another 30 on every write. Anyone holding your token holds your data space, so
treat the URLs as private.</p>`}

<h2>Ready URLs</h2>
<table><thead><tr><th>Server</th><th>URL</th></tr></thead><tbody>
${rows}
</tbody></table>

<h2>How to add it</h2>

<h3>Claude.ai (custom connector)</h3>
<p>Settings &rarr; Connectors &rarr; Add custom connector. Give it a name, paste the URL,
leave OAuth empty, save, then enable it in a chat.</p>
<pre>${esc(ready)}</pre>

<h3>Claude Desktop (connectors)</h3>
<p>Settings &rarr; Connectors &rarr; Add custom connector, paste the same URL. Desktop treats
it as a remote MCP server over streamable HTTP; no config file edit and no npx.</p>

<h3>Claude Code</h3>
<pre>claude mcp add --transport http ${esc(first)} ${esc(ready)}</pre>
<p class="note">No <code>--header</code> is needed: the token is in the URL.</p>

<h3>Cursor</h3>
<p>Settings &rarr; MCP &rarr; Add new MCP server, or add this to <code>~/.cursor/mcp.json</code>:</p>
<pre>{
  "mcpServers": {
    "${esc(first)}": { "url": "${esc(ready)}" }
  }
}</pre>

<h3>VS Code (remote MCP)</h3>
<p>Command palette &rarr; MCP: Add Server &rarr; HTTP, paste the URL. Or add it to
<code>.vscode/mcp.json</code>:</p>
<pre>{
  "servers": {
    "${esc(first)}": { "type": "http", "url": "${esc(ready)}" }
  }
}</pre>

<h2>Pro</h2>
<p>Pro lifts every free-tier limit. Two ways to get there:</p>
<p><strong>Buy from inside the client.</strong> When a free limit is reached the answer
carries a checkout link that already knows this token. Pay, and this same URL runs in Pro
mode on your next call - no key to paste, and the data you already created stays where it is.</p>
<p><strong>Or paste a key you already own.</strong> Put the key where the token is:</p>
<pre>${esc(`${base}/mcp/${first}/t/MCPL1.<payload>.<signature>`)}</pre>
<p>A key bought for one server works on that server; the bundle key works on all of them.
Keys are at <a href="${esc(base)}/buy/bundle">${esc(base)}/buy/bundle</a>.</p>

<h2>Other forms</h2>
<p>A client that can set headers can use the plain endpoint instead:</p>
<pre>${esc(`${base}/mcp/${first}`)}
Authorization: Bearer ${esc(token)}</pre>
<p>A client that can take a query string but not a header can use:</p>
<pre>${esc(`${base}/mcp/${first}?token=${token}`)}</pre>
<p class="note">Machine-readable index: <a href="${esc(base)}/mcp">${esc(base)}/mcp</a>.
Free versus Pro: <a href="${esc(GUIDE)}">the guide</a>.
Check what a token is: <code>${esc(`${base}/mcp/whoami/t/${token}`)}</code>.</p>
</main></body></html>`;
}

/**
 * Mint one anonymous token, under the same per-IP hourly ceiling wherever it is minted
 * from - the JSON endpoint or the connect page. Returns the token, or the 429 to send.
 */
async function mintAnonToken(req: Request, env: Env): Promise<string | Response> {
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const bucket = Math.floor(Date.now() / 3_600_000);
  const mintKey = `mint:${ip}:${bucket}`;
  const minted = Number((await env.REMOTE_DATA.get(mintKey)) ?? "0") + 1;
  if (minted > TOKEN_MINTS_PER_IP) {
    return json({
      error: "rate_limited",
      message: `This address has minted ${TOKEN_MINTS_PER_IP} anonymous tokens in the last hour, which is the limit. Reuse the token you already have: one token is one data space, and it is refreshed for another 30 days on every write.`,
      limit: TOKEN_MINTS_PER_IP, window: "1 hour", guide: GUIDE,
    }, 429, { "retry-after": "3600" });
  }
  await env.REMOTE_DATA.put(mintKey, String(minted), { expirationTtl: 7200 });
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  const token = "anon_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  await env.REMOTE_DATA.put(`tok:${token}`, String(Date.now()), { expirationTtl: ANON_TTL });
  return token;
}

/* ---------------------------------------------------------------- worker */

/**
 * Read the request body with the cap enforced on the stream, so a chunked body with no
 * content-length is abandoned the moment it crosses the ceiling instead of being
 * buffered whole. Returns null when the cap is exceeded.
 */
async function readBodyCapped(req: Request, limit: number): Promise<string | null> {
  const body = req.body;
  if (!body) {
    const text = await req.text();
    return new TextEncoder().encode(text).length > limit ? null : text;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) { try { await reader.cancel(); } catch { /* client already gone */ } return null; }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
  const buf = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { buf.set(c, at); at += c.byteLength; }
  return new TextDecoder().decode(buf);
}

/** Reject a JSON-RPC batch before the SDK sees it: one POST is one operation here. */
function isBatch(body: string): boolean {
  for (const ch of body) {
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") continue;
    return ch === "[";
  }
  return false;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(sweep(env).then((r) => console.log(`sweep: ${JSON.stringify(r)}`)));
  },

  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const base = `${url.protocol}//${url.host}`;
    let path = url.pathname.replace(/\/+$/, "") || "/mcp";

    // A token carried by the URL rather than a header, for clients whose only input is a
    // URL. `/mcp/<name>/t/<token>` is stripped back to `/mcp/<name>` here and the token is
    // handed to authenticate(), which still prefers an Authorization header if one is set.
    let urlToken = url.searchParams.get("token") ?? "";
    let urlTokenForm: Auth["via"] = urlToken ? "URL query parameter (?token=)" : undefined;
    const tokenInPath = path.match(/^(\/mcp\/[a-z-]+)\/t\/(.+)$/);
    if (tokenInPath) {
      urlTokenForm = "URL path segment (/mcp/<server>/t/<token>)";
      path = tokenInPath[1];
      try { urlToken = decodeURIComponent(tokenInPath[2]); } catch { urlToken = tokenInPath[2]; }
    }

    if (path === "/mcp") return json(indexDoc(base));

    // A price-tracker fixture: a real page, on a host this suite controls, with a price in
    // JSON-LD. `?price=` changes the asking price so a drop and an alert can be demonstrated.
    if (path === "/mcp/sample/product") {
      if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
      return new Response(sampleProductPage(base, url.searchParams.get("price")), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }

    if (path === "/mcp/connect") {
      if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
      // Reusing a token that was passed in is deliberate: a reload with ?token= keeps the
      // caller's data space instead of quietly stranding it behind a fresh one.
      let token = /^anon_[0-9a-f]{32}$/.test(urlToken) ? urlToken : "";
      // Minting is not free: it is a KV read plus two KV writes, one of them a `tok:` key
      // that holds a data space for 30 days, and it is rate limited to
      // TOKEN_MINTS_PER_IP per IP per hour. Before 2026-09-10 every single GET or HEAD
      // minted. That was survivable while nothing linked here; it is not now, because this
      // page is the hero destination of all 30 product pages and of /llms.txt
      // (docs/FUNNEL_R1.md) and is going into the sitemap. Two consequences, both real:
      // a crawler left a 30-day junk tenant per fetch, and 11 loads in an hour from one
      // address returned HTTP 429 - so a NAT, a VPN exit or an office proxy could take the
      // entry point to the whole free tier off the air for everyone behind it.
      // A token is therefore minted only for a request that is actually a person opening
      // the page, or for one that explicitly asks. Everything else gets the same page with
      // `<token>` in it and a link that mints.
      if (!token && req.method === "GET" && (url.searchParams.get("mint") === "1" || isBrowserNavigation(req.headers))) {
        const minted = await mintAnonToken(req, env);
        if (typeof minted !== "string") return minted;
        token = minted;
      }
      const html = connectPage(base, token);
      const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };
      // A HEAD must not differ from the GET it describes, and must not mint either.
      return new Response(req.method === "HEAD" ? null : html, { headers });
    }

    if (path === "/mcp/whoami") {
      // Not one endpoint, so the licence product check is waived ("*"); everything else -
      // token shape, existence, binding - is decided exactly as it is on a real call.
      const who = await authenticate(req, env, "*", urlToken, urlTokenForm);
      if (who instanceof Response) return who;
      return json({
        tenant: who.tenant,
        tier: who.isPro ? "pro" : "free",
        bound: who.bound === true,
        kind: who.kind,
        rate_limit_per_hour: who.limit,
        token_arrived_via: who.via ?? "Authorization: Bearer",
        how: who.kind === "license"
          ? "a licence key was presented"
          : who.bound
            ? "an anonymous token whose purchase is bound to it in KV: Pro tier, same anonymous data document"
            : "an anonymous token with no purchase bound to it",
        connect: `${base}/mcp/connect`,
        guide: GUIDE,
      });
    }

    if (path === "/mcp/admin/sweep") {
      // Method first: the sweep deletes data, so it is never reachable by a link,
      // a prefetch or a GET with the secret in a header.
      if (req.method !== "POST") {
        return json({ error: "method_not_allowed", message: "The sweep is a POST." }, 405, { allow: "POST" });
      }
      const secret = env.SWEEP_SECRET;
      if (!secret || !(await secretEquals(secret, req.headers.get("x-sweep-secret") ?? ""))) {
        return json({ error: "not_found", index: `${base}/mcp` }, 404);
      }
      return json({ ok: true, ...(await sweep(env)), older_than_days: SWEEP_AFTER_DAYS });
    }

    if (path === "/mcp/token") {
      if (req.method !== "GET" && req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
      const minted = await mintAnonToken(req, env);
      if (typeof minted !== "string") return minted;
      const token = minted;
      return json({
        token,
        tier: "free",
        expires_in_days: 30,
        note: "Refreshed for another 30 days on every write. Send it as: Authorization: Bearer " + token,
        endpoints: ENDPOINT_URLS(base),
        pro: `${base}/buy/bundle`,
        guide: GUIDE,
      });
    }

    const dl = path.match(/^\/mcp\/download\/([0-9a-f]{32})$/);
    if (dl) {
      const stored = await env.REMOTE_DATA.get(`dl:${dl[1]}`);
      if (stored === null) return json({ error: "not_found", message: "Download links are valid for one hour." }, 404);
      const { mime, body, filename, encoding } = JSON.parse(stored) as Download;
      const payload: BodyInit = encoding === "base64" ? b64urlToBytes(body.replace(/\+/g, "-").replace(/\//g, "_")) : body;
      return new Response(payload, {
        headers: {
          "content-type": mime,
          "content-disposition": `${encoding === "base64" ? "attachment" : "inline"}; filename="${filename.replace(/"/g, "")}"`,
        },
      });
    }

    const m = path.match(/^\/mcp\/([a-z-]+)$/);
    const product = m?.[1];
    const cfg = product ? SERVERS[product] : undefined;
    if (!product || !cfg) {
      return json({ error: "not_found", index: `${base}/mcp` }, 404);
    }

    // A GET or HEAD with no credential in the header AND none in the URL is not a failed
    // authentication, it is a health check or a person opening the link: answer it. See
    // publicEndpointDoc() for the measured reason this exists. Everything that carries a
    // credential, and every POST, falls through to authenticate() unchanged.
    if ((req.method === "GET" || req.method === "HEAD") && !req.headers.get("authorization") && !urlToken) {
      // A browser gets a page, a machine gets the JSON. Measured 2026-09-09: real people
      // in Chrome, Edge and Mobile Safari are arriving here from Google and Bing results
      // for /mcp/<server> URLs, and every one of them was handed raw JSON. These URLs
      // became indexable the day the endpoint stopped answering 401. Content negotiation
      // is the whole fix: `accept: text/html` means a person, anything else is a client
      // or a directory health check and keeps exactly the document it had before.
      const accept = req.headers.get("accept") ?? "";
      if (accept.includes("text/html")) {
        return new Response(endpointPage(base, product), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
        });
      }
      return json(publicEndpointDoc(base, product), 200, { "cache-control": "public, max-age=300" });
    }

    // Body cap and batch rejection happen before anything is parsed as JSON-RPC. This runs
    // BEFORE authenticate() so the JSON-RPC method is known: a request that only asks what
    // this server is does not need a token (see DISCOVERY below).
    let request = req;
    let bodyText = "";
    if (req.method === "POST") {
      const declared = Number(req.headers.get("content-length") ?? "0");
      if (declared > MAX_BODY_BYTES) {
        return json({ error: "payload_too_large", limit_bytes: MAX_BODY_BYTES, message: `The request body is ${declared} bytes; this endpoint accepts ${MAX_BODY_BYTES}. Send less data per call - for spreadsheet, load a smaller sheet or run the server locally over stdio.` }, 413);
      }
      const body = await readBodyCapped(req, MAX_BODY_BYTES);
      if (body === null) {
        return json({ error: "payload_too_large", limit_bytes: MAX_BODY_BYTES, message: `This endpoint accepts ${MAX_BODY_BYTES} bytes per request and stopped reading at that point. Send less data per call - for spreadsheet, load a smaller sheet or run the server locally over stdio.` }, 413);
      }
      if (isBatch(body)) {
        return json({
          jsonrpc: "2.0", id: null,
          error: { code: -32600, message: "JSON-RPC batching is not supported on this endpoint. Send one request object per POST." },
        }, 400);
      }
      bodyText = body;
      // Content negotiation before the SDK transport sees the request. `Accept: */*` and
      // a missing Accept both admit application/json and text/event-stream, but the SDK
      // tests the header with a literal substring match and answered both 406 - and `*/*`
      // is what curl sends by default, so every naive prober read these endpoints as
      // broken. negotiatedHeaders() rewrites only a header that genuinely admits both
      // types; `Accept: text/html` is still refused by the SDK, unchanged. See accept.ts.
      request = new Request(req.url, { method: "POST", headers: negotiatedHeaders(req.headers), body });
    }

    const rpc = rpcEnvelope(bodyText);

    // DISCOVERY WITHOUT A TOKEN.
    //
    // Directories health-check the exact URL they list. A bare POST used to answer 401,
    // so Glama published four of these servers with a red "Server is not responding"
    // badge, Docker's type:remote entry was unusable and at least one large list rejected
    // an entry outright. The endpoints were healthy the whole time; they simply refused to
    // say so.
    //
    // This is safe rather than a loosening, and the proof is already in this file:
    // DATALESS_METHODS are exactly the methods that cannot read or write a tenant
    // document, and a few lines below every one of them is served with `files` set to an
    // empty Map. Nothing about any user is in scope. The tool schema they return is
    // already public in the registry manifests and on the website.
    //
    // Everything that touches data still needs a token: tools/call, resources/read and
    // the rest fall through to authenticate() unchanged, and a token that is present but
    // wrong is still rejected rather than downgraded to this path.
    const hasCredential = Boolean(req.headers.get("authorization")) || Boolean(urlToken);
    const isDiscovery = req.method === "POST" && !hasCredential
      && rpc.method !== null && DATALESS_METHODS.has(rpc.method);

    let auth: Auth;
    if (isDiscovery) {
      auth = { tenant: `discovery:${req.headers.get("cf-connecting-ip") ?? "unknown"}`, isPro: false, kind: "anon", limit: DISCOVERY_LIMIT };
    } else {
      const authed = await authenticate(req, env, product, urlToken, urlTokenForm);
      if (authed instanceof Response) return authed;
      auth = authed;
    }
    const limited = await rateLimit(env, auth, ctx, product);
    if (limited) return limited;

    // tools/list is answered from module scope: no KV read, no McpServer, no transport.
    // A paginated request (params.cursor) is not cached and takes the full path.
    if (req.method === "POST" && rpc.method === "tools/list" && rpc.hasId && !rpc.hasCursor) {
      const tools = await toolsJson(product, cfg, auth.isPro, base);
      return new Response(
        `{"jsonrpc":"2.0","id":${JSON.stringify(rpc.id)},"result":{"tools":${tools}}}`,
        { headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }

    // Lazy hydration. initialize, ping and the empty list methods cannot read or write a
    // tenant document, so they pay for none of the three KV reads and none of the writes.
    const dataless = req.method === "POST" && rpc.method !== null && DATALESS_METHODS.has(rpc.method);

    const files = dataless ? new Map<string, string>() : await hydrate(env, auth.tenant, product);
    // /mcp/recurring works inside the invoice store: its document is hydrated on top of
    // this endpoint's, and every path is flushed back to whichever document owns it.
    const shares = sharedDocs(cfg);
    if (!dataless) {
      for (const sd of shares) {
        for (const [k, v] of await hydrate(env, auth.tenant, sd.server)) files.set(k, v);
      }
    }
    // The shared business profile (D-R31) is hydrated on top of every endpoint, the same
    // way: business_set on /mcp/invoice must be visible to /mcp/docx, /mcp/expense-tracker,
    // /mcp/recurring, /mcp/resume, /mcp/clauses, /mcp/time-tracker and /mcp/timezone for
    // the same token, so it is not scoped to the servers that read it today.
    if (!dataless) {
      for (const [k, v] of await hydrate(env, auth.tenant, PROFILE_SERVER)) files.set(k, v);
    }
    const ownPaths = (p2: string) => !isProfilePath(p2) && !shares.some((sd) => sd.owns(p2));
    const maxBytes = cfg.maxBytes ?? DEFAULT_MAX_BYTES;
    const counted = recount(files);

    // The ECB cache is shared across tenants: hydrated after recount(), so its bytes are
    // never charged to this token, and listed in `shared` so no write charges them either.
    const shared = new Set<string>();
    let ecbBefore: Map<string, string | null> | null = null;
    if (product === "currency" && !dataless) {
      ecbBefore = await hydrateEcb(env, files, bodyText);
      shared.add(ECB_DAILY_PATH);
      shared.add(ECB_HISTORY_PATH);
    }

    const rctx: RequestCtx = {
      tenant: auth.tenant, server: product, isPro: auth.isPro, anonToken: auth.anonToken, authVia: auth.via,
      files, dirs: new Set<string>(), downloads: [], baseUrl: base,
      publish: cfg.publish, published: new Map<string, string>(), maxBytes,
      bytes: counted.bytes, nfiles: counted.nfiles,
      shared,
      fds: new Map(), nextFd: 100,
    };
    const before = JSON.stringify(persistable(files, cfg, rctx.published, ownPaths));
    // Only the read-write shares need a before-image: a read-only share is never flushed.
    const sharedBefore = new Map<string, string>();
    for (const sd of shares) {
      if (!sd.readOnly) sharedBefore.set(sd.server, JSON.stringify(persistable(files, cfg, rctx.published, sd.owns)));
    }
    const profileBefore = JSON.stringify(persistableProfile(files, rctx.published));

    return await STORE.run(rctx, async () => {
      const server = cfg.factory();
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,   // stateless: one server + one transport per request
        enableJsonResponse: true,
      });
      try {
        await server.connect(transport);
        let res = await transport.handleRequest(request);
        for (const d of rctx.downloads) {
          await env.REMOTE_DATA.put(`dl:${d.token}`, JSON.stringify(d), { expirationTtl: DOWNLOAD_TTL });
        }
        // license_activate asked to bind a key to this anonymous token. The shim can
        // neither reach KV nor verify a signature, so it records the request and the
        // verification happens here, with the same verifyLicense() used on every bearer.
        // This grants nothing new: the caller already holds the key and could send it as
        // a bearer. What it buys them is keeping the documents already stored under this
        // token, instead of moving to a different tenant and leaving their data behind.
        // A key that fails to verify writes nothing at all.
        if (rctx.bindKey && auth.kind === "anon" && auth.anonToken) {
          const v = await verifyLicense(rctx.bindKey.trim(), product);
          if (v.ok) {
            await env.REMOTE_DATA.put(`bind:${auth.anonToken}`, rctx.bindKey.trim(), { expirationTtl: ANON_TTL });
          }
        }
        // The tool handlers report the virtual path they wrote; the caller gets the link.
        // The virtual root is an implementation detail, so it never reaches the caller:
        // in inline-data mode a sheet is known by the name it was loaded under.
        const strip = cfg.strip ?? [];
        if (rctx.published.size > 0 || strip.length > 0) {
          let out = await res.text();
          for (const [p2, u] of [...rctx.published].sort((a, b) => b[0].length - a[0].length)) {
            out = out.split(p2).join(`${u} (valid 1 hour)`);
          }
          for (const prefix of strip) out = out.split(prefix).join("");
          const h = new Headers(res.headers);
          h.delete("content-length");
          res = new Response(out, { status: res.status, headers: h });
        }
        if (ecbBefore) await flushEcb(env, files, ecbBefore);
        // Nothing was hydrated, so there is nothing to flush and no last-seen stamp to
        // move: a dataless method leaves KV exactly as it found it.
        if (!dataless) {
          await flush(env, auth.tenant, product, JSON.stringify(persistable(files, cfg, rctx.published, ownPaths)), before);
          for (const sd of shares) {
            if (sd.readOnly) continue;
            await flush(env, auth.tenant, sd.server,
              JSON.stringify(persistable(files, cfg, rctx.published, sd.owns)), sharedBefore.get(sd.server) ?? "");
          }
          await flush(env, auth.tenant, PROFILE_SERVER, JSON.stringify(persistableProfile(files, rctx.published)), profileBefore);
          // Sweep stamp and token TTL refresh are bookkeeping, not the answer: deferred,
          // so a tool call does not wait on two KV writes nobody reads in this request.
          ctx.waitUntil(touch(env, auth.tenant));
          if (auth.kind === "anon") {
            ctx.waitUntil(env.REMOTE_DATA.put(`tok:anon_${auth.tenant.slice(5)}`, String(Date.now()), { expirationTtl: ANON_TTL }));
          }
        }
        return res;
      } finally {
        await transport.close().catch(() => {});
        await server.close().catch(() => {});
      }
    });
  },
};
