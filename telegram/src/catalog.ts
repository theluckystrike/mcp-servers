// Catalog of hosted MCP servers exposed through the Telegram Mini App.
// Each entry maps a server name to a consumer-facing product line and a
// one-line pitch. The array is already ordered by Mini App fit (rank 1 = best).

export interface CatalogEntry {
  /** Hosted MCP server name, matches https://mcp.zovo.one/mcp/<name>. */
  name: string;
  /** Consumer-facing Mini App product line. */
  product: string;
  /** One-line pitch, user language, no emoji. */
  pitch: string;
  /** True when this server is a strong self-serve Mini App (see README ranking). */
  miniAppFit: boolean;
  /** Rank by Mini App fit, 1 = best. Sorted ascending in this array. */
  rank: number;
  /** True when this server has its own hosted endpoint at https://mcp.zovo.one/mcp/<name>. Defaults true. */
  hosted?: boolean;
}

// Ranked by consumer self-serve fit for Telegram's mobile-first audience.
// High fit: a solo user can immediately understand and use it in a chat.
// Medium fit: useful but needs context (documents, project state) or desktop.
// Low fit: developer/AI-client oriented, poor standalone mobile product.
export const CATALOG: CatalogEntry[] = [
  { name: "invoice", product: "Invoice Maker", pitch: "Build a clean PDF invoice from amount, hours, tax and due date.", miniAppFit: true, rank: 1 },
  { name: "expense-tracker", product: "Expense Tracker", pitch: "Log a purchase or trip cost in seconds; keep a dated money log.", miniAppFit: true, rank: 2 },
  { name: "currency", product: "Currency Converter", pitch: "Convert between currencies with a dated, bank-style rate.", miniAppFit: true, rank: 3 },
  { name: "timezone", product: "Time Zone Planner", pitch: "See any city's current time and convert hours without arithmetic.", miniAppFit: true, rank: 4 },
  { name: "calendar", product: "Week Planner", pitch: "Turn free text into a dated plan and see where the week went.", miniAppFit: true, rank: 5 },
  { name: "per-diem", product: "Per Diem Calculator", pitch: "Work out a trip's daily travel allowance on official rate tables.", miniAppFit: true, rank: 6 },
  { name: "mileage-log", product: "Mileage Log", pitch: "Log a drive at tax time, per trip, kept the moment it happens.", miniAppFit: true, rank: 7 },
  { name: "time-tracker", product: "Time Tracker", pitch: "Start and stop a billable timer by name and total your hours.", miniAppFit: true, rank: 8 },
  { name: "quotes", product: "Quote Builder", pitch: "Turn hours, rate and VAT into a numbered, ready-to-send quote.", miniAppFit: true, rank: 9 },
  { name: "credit-note", product: "Credit Note", pitch: "Issue a credit memo on the same engine as your invoices.", miniAppFit: true, rank: 10 },
  { name: "billing-docs", product: "Purchase Order & Credit Note", pitch: "Raise purchase orders and credit notes from one billing engine.", miniAppFit: true, rank: 11 },
  { name: "petty-cash", product: "Petty Cash Tin", pitch: "Run an imprest float with a custodian and dated entries.", miniAppFit: true, rank: 12 },
  { name: "cash-book", product: "Cash Book", pitch: "One double-entry ledger over the invoices and receipts you keep.", miniAppFit: true, rank: 13 },
  { name: "checklist", product: "Checklist Runner", pitch: "Build a checklist once, run it many times, keep the dated record.", miniAppFit: true, rank: 14 },
  { name: "kanban", product: "Task Board", pitch: "Add a card to a project board and move it as work progresses.", miniAppFit: true, rank: 15 },
  { name: "price-tracker", product: "Price Watch", pitch: "Point at any product page and get today's price and history.", miniAppFit: true, rank: 16 },
  { name: "barcode", product: "QR / Barcode Maker", pitch: "Turn a URL or code into a QR image you can save or print.", miniAppFit: true, rank: 17 },
  { name: "bank-statement", product: "Statement Reader", pitch: "Point at a bank statement PDF and get the figures summarized.", miniAppFit: false, rank: 18 },
  { name: "recurring", product: "Recurring Billing", pitch: "Bill the same hours to the same client on a fixed schedule.", miniAppFit: false, rank: 19 },
  { name: "statement-of-account", product: "Statement of Account", pitch: "Send a client the one page that answers what they owe.", miniAppFit: false, rank: 20 },
  { name: "deposits", product: "Deposits Ledger", pitch: "Hold security and retainer deposits per client.", miniAppFit: false, rank: 21 },
  { name: "delivery-schedule", product: "Delivery Schedule", pitch: "Keep dated deliverables against a quote or work order.", miniAppFit: false, rank: 22 },
  { name: "asset-register", product: "Asset Register", pitch: "Track fixed assets and depreciate on published rates.", miniAppFit: false, rank: 23 },
  { name: "amortization", product: "Amortization Schedule", pitch: "Turn a loan's terms into a full payment schedule.", miniAppFit: false, rank: 24 },
  { name: "dunning-letters", product: "Payment Chaser", pitch: "Register an unpaid invoice and draft the chase letter.", miniAppFit: false, rank: 25 },
  { name: "work-order", product: "Work Order", pitch: "Raise a job order for field and trade work.", miniAppFit: false, rank: 26 },
  { name: "job-card", product: "Job Card", pitch: "One card per job with the client, site and logged hours.", miniAppFit: false, rank: 27 },
  { name: "change-order", product: "Change Order", pitch: "Log a variation against a quote or work order.", miniAppFit: false, rank: 28 },
  { name: "catalogue", product: "Price Catalogue", pitch: "One price list and rate card the quote and invoice both read.", miniAppFit: false, rank: 29 },
  { name: "supplier-list", product: "Supplier Directory", pitch: "A supplier directory that does not rot inside a client.", miniAppFit: false, rank: 30 },
  { name: "maintenance-log", product: "Maintenance Log", pitch: "One register of maintenance for workshop, flats or fleet.", miniAppFit: false, rank: 31 },
  { name: "bill-of-sale", product: "Bill of Sale", pitch: "Record a sale ready for a signed paper bill of sale.", miniAppFit: false, rank: 32 },
  { name: "service-agreement", product: "Service Agreement", pitch: "Draft a service agreement from a one-line brief.", miniAppFit: false, rank: 33 },
  { name: "clauses", product: "Contract Clauses", pitch: "Draft a service agreement with real terms from your clauses.", miniAppFit: false, rank: 34 },
  { name: "packing-list", product: "Packing List", pitch: "The packing slip for a shipment and its two key questions.", miniAppFit: false, rank: 35 },
  { name: "resume", product: "Resume & Cover Letter", pitch: "Tailor a CV to a posting and draft the cover letter.", miniAppFit: false, rank: 36 },
  { name: "spreadsheet", product: "Spreadsheet Assistant", pitch: "Hand a spreadsheet to the assistant and talk to it.", miniAppFit: false, rank: 37 },
  { name: "docx", product: "Document Writer", pitch: "Write a real .docx from a plain-language brief.", miniAppFit: false, rank: 38 },
  { name: "pdf", product: "PDF Toolkit", pitch: "Stamp, split, merge and edit pages in a scan.", miniAppFit: false, rank: 39 },
  { name: "office-suite", product: "Office Suite", pitch: "The full office document and spreadsheet suite.", miniAppFit: false, rank: 40, hosted: false },
  { name: "image", product: "Image Toolbox", pitch: "Resize photos and strip GPS in a chat.", miniAppFit: false, rank: 41 },
  { name: "zip", product: "Zip Toolkit", pitch: "Pack, inspect and unpack a folder as a zip.", miniAppFit: false, rank: 42 },
];

/** The first N high-fit servers surfaced in the /start picker. */
export const PICKER_TOP = 17;

export const hostedUrl = (name: string): string =>
  `https://mcp.zovo.one/mcp/${name}`;

export const highFitServers = (): CatalogEntry[] =>
  CATALOG.filter((e) => e.miniAppFit);

/** Servers with their own hosted endpoint (office-suite is the only non-hosted aggregate). */
export const hostedServers = (): CatalogEntry[] =>
  CATALOG.filter((e) => e.hosted !== false);
