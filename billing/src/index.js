import { mintLicense, verifyLicenseKey, hex } from "./license.js";
import { PAGES } from "./pages.js";
import { GUIDES, GUIDE_INDEX } from "./content.js";
import { COMPARE, COMPARE_INDEX } from "./compare.js";
import { setupPage, clientHub, setupIndex, setupUrls, serversFor, CLIENTS, CLIENT_ORDER, SETUP_SERVERS } from "./setup.js";

export const PRODUCTS = {
  "time-tracker": { desc: "Track billable time from chat: timers, entries, reports, CSV, invoice-ready totals.", free: "Free: unlimited timers, last 7 days of reports, 2 rated projects, currency per entry.", pro: "Pro: full history, invoice summaries, group by tag, unlimited projects.", name: "MCP Time Tracker Pro", price: "price_1UBDU5JKCamubEm1wPMZI8Zf", usd: 19, pkg: "@theluckystrike/mcp-time-tracker", bin: "mcp-time-tracker", payload: "time-tracker" },
  "price-tracker": { desc: "Check and watch product prices on ordinary shop pages, with history and target alerts.", free: "Free: unlimited price checks with confidence, 3 watches, 30 observations each, alerts.", pro: "Pro: unlimited watches, full history, refresh all.", name: "MCP Price Tracker Pro", price: "price_1UBDU6JKCamubEm1ufsEKwSS", usd: 19, pkg: "@theluckystrike/mcp-price-tracker", bin: "mcp-price-tracker", payload: "price-tracker" },
  spreadsheet: { desc: "Read, query, add columns to and convert xlsx and csv files without corrupting them.", free: "Free: read, query with group by and sums, stats up to 5,000 rows; writes up to 500 rows, never partial.", pro: "Pro: no limits.", name: "MCP Spreadsheet Pro", price: "price_1UBDU7JKCamubEm1LZTfrsMd", usd: 19, pkg: "@theluckystrike/mcp-spreadsheet", bin: "mcp-spreadsheet", payload: "spreadsheet" },
  invoice: { desc: "Numbered invoices with tax lines, rendered to a professional PDF, all local.", free: "Free: 3 invoices a month with a small footer line; overdue report included.", pro: "Pro: unlimited, no branding, logo, custom prefix.", name: "MCP Invoice Pro", price: "price_1UBDU8JKCamubEm1Ybcp5IUs", usd: 19, pkg: "@theluckystrike/mcp-invoice", bin: "mcp-invoice", payload: "invoice" },
  "expense-tracker": { desc: "Receipts, mileage and expenses ledger that turns billable spend into invoice lines.", free: "Free: unlimited logging, last 30 days, 3 projects, 5 rules, CSV up to 200 rows.", pro: "Pro: full history, unlimited projects and rules, xlsx export, rebill with markup.", name: "MCP Expense Tracker Pro", price: "price_1UBEoOJKCamubEm1ryEKWxIg", usd: 19, pkg: "@theluckystrike/mcp-expense-tracker", bin: "mcp-expense-tracker", payload: "expense-tracker" },
  currency: { desc: "Currency converter on the European Central Bank reference rates: latest, history, any-date, and fx_rates ready for rebilling.", free: "Free: latest rates, convert, history up to 90 days.", pro: "Pro: full history back to 1999, any-date rates, unlimited windows.", name: "MCP Currency Converter Pro", price: "price_1UBPwqJKCamubEm1dTtEN9PY", usd: 19, pkg: "@theluckystrike/mcp-currency", bin: "mcp-currency", payload: "currency" },
  docx: { desc: "Real Word documents from chat: proposals, contracts, quotes, markdown to .docx, template filling, read existing files.", free: "Free: create, convert and read documents without limit; 3 proposals or contracts a month.", pro: "Pro: unlimited proposals and contracts, letterhead, unlimited template fills.", name: "MCP Docx Pro", price: "price_1UBPwtJKCamubEm1PPpj1fPE", usd: 19, pkg: "@theluckystrike/mcp-docx", bin: "mcp-docx", payload: "docx" },
  timezone: { desc: "Meeting planner across time zones: convert times, find slots inside everyone's working hours, DST changes, .ics files.", free: "Free: conversions, overlap, DST, slots for up to 3 people, 5 contacts.", pro: "Pro: unlimited participants, contacts and calendar files, recurring slot search.", name: "MCP Timezone Planner Pro", price: "price_1UBPwwJKCamubEm13LZyFsDw", usd: 19, pkg: "@theluckystrike/mcp-timezone", bin: "mcp-timezone", payload: "timezone" },
  resume: { desc: "Resumes and cover letters as real Word files from one profile: keyword tailoring, gap analysis, three styles, never invents facts.", free: "Free: profile, modern-style resume, markdown and HTML exports, 3 cover letters a month, tailoring up to 2,000-character job posts.", pro: "Pro: all styles, unlimited cover letters and tailoring, profile variants, letterhead colours.", name: "MCP Resume and Cover Letter Pro", price: "price_1UBSYxJKCamubEm1uaUEIGBI", usd: 19, pkg: "@theluckystrike/mcp-resume", bin: "mcp-resume", payload: "resume" },
  recurring: { desc: "Recurring invoices on a schedule: weekly, monthly, quarterly or yearly, generated into the invoice server with PDFs, idempotent per period, with a revenue forecast.", free: "Free: 3 active schedules, 30-day upcoming view, generate due invoices.", pro: "Pro: unlimited schedules, 12-month forecast, audit history, end-of-month and anchor-day rules.", name: "MCP Recurring Invoices Pro", price: "price_1UBSjCJKCamubEm1gOmfW2db", usd: 19, pkg: "@theluckystrike/mcp-recurring", bin: "mcp-recurring", payload: "recurring" },
  clauses: { desc: "A personal library of contract and proposal clauses with a 25-clause starter set, variables, search, and assembly into Word or markdown.", free: "Free: starter set plus 10 own clauses, search, assemble up to 8 clauses, markdown export.", pro: "Pro: unlimited clauses, jurisdiction and tag filters, JSON import and export, unlimited assembly, versions.", name: "MCP Clause Library Pro", price: "price_1UBSjDJKCamubEm1sA7KYyQs", usd: 19, pkg: "@theluckystrike/mcp-clauses", bin: "mcp-clauses", payload: "clauses" },
  calendar: { desc: "Read .ics calendars and feeds: events in a window, free and busy, conflicts, exports, and meetings turned into billable time entries.", free: "Free: 2 calendars, 31-day windows, exports up to 50 events.", pro: "Pro: unlimited calendars, any window, unlimited exports, URL refresh.", name: "MCP Calendar Pro", price: "price_1UBdQYJKCamubEm1CaxadXyX", usd: 19, pkg: "@theluckystrike/mcp-calendar", bin: "mcp-calendar", payload: "calendar" },
  pdf: { desc: "PDF tools without native code: merge, split, page ranges, rotate, PAID and DRAFT stamps, best-effort text, business watermark.", free: "Free: info, count, text, merge up to 5 files, edits on files up to 30 pages, preset stamps.", pro: "Pro: unlimited files and pages, custom stamps and colours, business watermark, reorder.", name: "MCP PDF Tools Pro", price: "price_1UBdQaJKCamubEm16HxaiJWK", usd: 19, pkg: "@theluckystrike/mcp-pdf", bin: "mcp-pdf", payload: "pdf" },
  image: { desc: "Image tools without native code: resize, convert, compress, crop, thumbnails, strip metadata, watermark with your business name.", free: "Free: info, resize, convert, compress, crop, strip metadata up to 4 MP, batches of 5.", pro: "Pro: unlimited size and batches, custom watermark text, dominant colours.", name: "MCP Image Tools Pro", price: "price_1UBlQEJKCamubEm1u1SKu720", usd: 19, pkg: "@theluckystrike/mcp-image", bin: "mcp-image", payload: "image" },
  "bank-statement": { desc: "Bank CSV exports categorised by your rules, monthly summaries per currency, reconciled against your expenses, subscriptions detected.", free: "Free: 2 accounts, 12 months, 5 rules, summary and search.", pro: "Pro: unlimited accounts, history and rules, reconcile with expenses, recurring detection, export.", name: "MCP Bank Statement Pro", price: "price_1UBlQGJKCamubEm11cATuyBV", usd: 19, pkg: "@theluckystrike/mcp-bank-statement", bin: "mcp-bank-statement", payload: "bank-statement" },
  kanban: { desc: "A local task board per project: columns, due dates, estimates, overdue view, weekly review, and timers that hand off to the time tracker.", free: "Free: 3 projects, 200 open tasks, default columns.", pro: "Pro: unlimited projects and tasks, custom columns, weekly review history, estimates versus actuals.", name: "MCP Kanban Pro", price: "price_1UBlSJJKCamubEm1U7CP7tmo", usd: 19, pkg: "@theluckystrike/mcp-kanban", bin: "mcp-kanban", payload: "kanban" },
  quotes: { desc: "Estimates and quotes on the invoice engine: line items, VAT, validity dates, accept converts to an invoice, PDF, win rate by currency.", free: "Free: 5 open quotes and text export.", pro: "Pro: unlimited quotes, PDF, win-rate report.", name: "MCP Quotes Pro", price: "price_1UBmtuJKCamubEm1y76zV0CC", usd: 19, pkg: "@theluckystrike/mcp-quotes", bin: "mcp-quotes", payload: "quotes" },
  barcode: { desc: "QR codes and barcodes from chat: SEPA payment QR for an invoice, vCard, WiFi, Code128, EAN-13 and UPC-A as SVG or PNG.", free: "Free: 20 codes a month, SVG.", pro: "Pro: unlimited codes, PNG at any size, batch.", name: "MCP Barcode Pro", price: "price_1UBoNQJKCamubEm1X6CTBLdP", usd: 19, pkg: "@theluckystrike/mcp-barcode", bin: "mcp-barcode", payload: "barcode" },
  zip: { desc: "Create, inspect and extract zip archives safely from chat: bomb and traversal guards decided from the central directory, CRC checked per entry, bundle a month of invoices and exports.", free: "Free: archives to 25 MB and 200 entries, 20 archives a month.", pro: "Pro: unlimited size, entries and archives.", name: "MCP Zip Pro", price: "price_1UBqGgJKCamubEm1SoQ76sXZ", usd: 19, pkg: "@theluckystrike/mcp-zip", bin: "mcp-zip", payload: "zip" },
  "billing-docs": { desc: "Credit notes and purchase orders on the same engine as your invoices: the VAT unwound at the rate you charged, and never more credited than the invoice billed.", free: "Free: 5 documents a calendar month, credit notes and purchase orders together, plus unlimited text exports.", pro: "Pro: unlimited documents, both PDFs, your logo, and the credited and on-order report.", name: "MCP Billing Docs Pro", price: "price_1UCCo9JKCamubEm1TyBUQdzO", usd: 19, pkg: "@theluckystrike/mcp-billing-docs", bin: "mcp-billing-docs", payload: "billing-docs" },
  bundle: { desc: "", free: "", pro: "", name: "MCP Servers Bundle (all servers, lifetime)", price: "price_1UBDU9JKCamubEm1dWgRjtoW", usd: 39, pkg: null, bin: null, payload: "*" },
};

/** Every sellable single-server product; `bundle` is the one entry that is not one. */
export const SINGLE_PRODUCT_IDS = Object.keys(PRODUCTS).filter((id) => id !== "bundle");

/** The number of single-server products, computed rather than typed, so adding a server cannot leave the prose stale. */
export const SERVER_COUNT = SINGLE_PRODUCT_IDS.length;

/** Every single license at $19 each, less the $39 bundle. */
export const BUNDLE_SAVING_USD =
  SINGLE_PRODUCT_IDS.reduce((n, id) => n + PRODUCTS[id].usd, 0) - PRODUCTS.bundle.usd;

const NUMBER_WORD = { 19: "Nineteen", 20: "Twenty", 21: "Twenty-one", 22: "Twenty-two" };

/** The server count as a capitalised English word, e.g. "Twenty". Exported so the copy
 * tests can assert the rendered sentence without pinning a number that a new server moves. */
export const countWord = () => NUMBER_WORD[SERVER_COUNT] || String(SERVER_COUNT);

/**
 * The bundle's own one-line description, derived rather than typed. It named nineteen and
 * $322 as literals until billing-docs made both wrong in the same commit; the count and the
 * saving now come from PRODUCTS, so a twenty-first server moves them on its own.
 */
PRODUCTS.bundle.desc =
  `Every server above, one key, lifetime. Saves $${BUNDLE_SAVING_USD} against buying ` +
  `${(NUMBER_WORD[SERVER_COUNT] || String(SERVER_COUNT)).toLowerCase()}.`;

/**
 * The line under the product name on the Stripe hosted checkout page. Stripe renders a
 * line item's description from the Product's `description`, not from anything the
 * Session can pass alongside a `price` id, so this string is the single source of truth
 * for both: the Session builder sends nothing, and `stripe-sync` below (run by hand with
 * a live key) writes exactly this onto each Product.
 *
 * Audit finding (docs/CHECKOUT_AUDIT.md): before this, the hosted page said only
 * "Pro license for the MCP Invoice server. One-time, lifetime." - the server count and
 * the $322 bundle saving appeared nowhere the buyer could see them.
 */
export function checkoutDescription(productId) {
  const p = PRODUCTS[productId];
  if (!p) throw new Error(`unknown product: ${productId}`);
  const word = NUMBER_WORD[SERVER_COUNT] || String(SERVER_COUNT);
  if (productId === "bundle") {
    return `${word} MCP servers for Claude, one lifetime key, saves $${BUNDLE_SAVING_USD} against buying singly`;
  }
  return `Lifetime key for ${p.name}. The ${word.toLowerCase()}-server bundle is $${PRODUCTS.bundle.usd}`;
}

/**
 * Checkout Session `custom_text`. Two messages the buyer reads before and after the
 * pay button:
 *
 * - `submit`: on a single-server session this is the bundle cross-sell. Stripe has no
 *   `cross_sells` parameter on a Product (probed live: `parameter_unknown`). The Session
 *   *does* accept `optional_items`, and that is deliberately not used: an accepted
 *   optional item makes the Session carry two line items, which `fulfillmentAllowed`
 *   rejects, so the buyer would be charged $58 and minted nothing.
 * - `after_submit`: how the key actually arrives. Nothing is emailed - the key is on the
 *   /success page - and a hosted tenant is bound automatically. That was previously
 *   discoverable only after paying.
 */
export function checkoutCustomText(productId) {
  const p = PRODUCTS[productId];
  if (!p) throw new Error(`unknown product: ${productId}`);
  const word = NUMBER_WORD[SERVER_COUNT] || String(SERVER_COUNT);
  const submit = productId === "bundle"
    ? `One payment, one lifetime key for all ${SERVER_COUNT} servers. Saves $${BUNDLE_SAVING_USD} against buying them singly.`
    : `Buying more than one? All ${SERVER_COUNT} servers are $${PRODUCTS.bundle.usd} together, a $${BUNDLE_SAVING_USD} saving: https://mcp.zovo.one/buy/bundle?src=checkout.crosssell.${productId}`;
  const after_submit =
    `Your license key is shown on the confirmation page immediately after payment. It is not emailed, ` +
    `so copy it from that page; the same URL always shows the same key. If you started from a hosted ` +
    `mcp.zovo.one endpoint, that endpoint is upgraded to Pro automatically, with nothing to paste.`;
  return { submit, after_submit };
}

const REPO = "https://github.com/theluckystrike/mcp-servers";

const GUIDE_LINKS = Object.entries(GUIDES)
  .map(([slug, g]) => `<a href="/guides/${slug}">${esc(g.title)}</a>`)
  .join(" &middot; ") + ` &middot; <a href="/guides">All guides</a>`;

/**
 * Pure fulfillment decision (review #3, #8). No I/O: the caller passes a Checkout
 * Session already retrieved with expand[]=line_items.
 * Mint only when the session is a completed one-time payment for exactly the
 * Price ID configured for `product`, at the expected amount. A 100% promotion
 * code yields payment_status "no_payment_required" with amount_total 0; that is
 * accepted only when the recorded discount equals the full expected amount.
 */
export function fulfillmentAllowed(session, product) {
  const p = PRODUCTS[product];
  if (!p) return { ok: false, reason: `unknown product: ${product}` };
  if (!session || typeof session !== "object") return { ok: false, reason: "no session" };
  if (session.mode !== "payment") return { ok: false, reason: `mode is ${session.mode}, not payment` };
  if (session.status !== "complete") return { ok: false, reason: `session status is ${session.status}, not complete` };
  if (session.metadata?.product !== product) return { ok: false, reason: "session metadata product mismatch" };

  const items = session.line_items?.data;
  if (!Array.isArray(items) || items.length !== 1) return { ok: false, reason: "expected exactly one line item" };
  const item = items[0];
  if (item.quantity !== 1) return { ok: false, reason: `quantity is ${item.quantity}, not 1` };
  if (item.price?.id !== p.price) return { ok: false, reason: `price ${item.price?.id} is not the price for ${product}` };

  const expected = p.usd * 100;
  if (item.price?.unit_amount !== expected) return { ok: false, reason: "price unit_amount changed" };
  if ((session.currency || item.currency) !== "usd") return { ok: false, reason: "currency is not usd" };

  if (session.payment_status === "paid") {
    if (session.amount_total !== expected) return { ok: false, reason: `amount_total ${session.amount_total} is not ${expected}` };
    return { ok: true, reason: "paid" };
  }
  if (session.payment_status === "no_payment_required") {
    if (session.amount_total !== 0) return { ok: false, reason: "zero-total session with a nonzero amount_total" };
    if (session.total_details?.amount_discount !== expected) return { ok: false, reason: "discount does not cover the full price" };
    return { ok: true, reason: "100% promotion code" };
  }
  return { ok: false, reason: `payment_status is ${session.payment_status}` };
}

/** Anonymous hosted-endpoint token shape, matches remote/src/index.ts. */
const TENANT_RE = /^anon_[0-9a-f]{32}$/;

/** Pure: is this a well-formed anonymous tenant token? */
export function validTenant(tenant) {
  return typeof tenant === "string" && TENANT_RE.test(tenant);
}

/**
 * Pure: decide whether a fulfilled purchase should write a hosted `bind:<tenant>`
 * record. Only a valid tenant token on an already-fulfilled session binds; an
 * absent or malformed tenant (someone typed `/buy/x?tenant=`) mints the key
 * normally but writes nothing to the shared KV.
 */
export function bindDecision(session, fulfilled) {
  if (!fulfilled) return { bind: false, reason: "not fulfilled" };
  const tenant = session?.metadata?.tenant;
  if (!validTenant(tenant)) return { bind: false, reason: "no valid tenant" };
  return { bind: true, tenant };
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{color-scheme:light dark}
body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;max-width:760px;margin:0 auto;padding:40px 20px}
h1{font-size:28px;margin:0 0 8px}h2{font-size:19px;margin:32px 0 8px}
.muted{opacity:.7}
table{border-collapse:collapse;width:100%;margin:20px 0}
td,th{text-align:left;padding:10px 8px;border-bottom:1px solid rgba(128,128,128,.3);vertical-align:middle}
a.buy{display:inline-block;padding:8px 16px;border:1px solid currentColor;border-radius:6px;text-decoration:none;font-weight:600;white-space:nowrap}
pre{background:rgba(128,128,128,.12);padding:12px;border-radius:6px;overflow-x:auto;font-size:13px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.key{font-size:15px;word-break:break-all;user-select:all}
footer{margin-top:48px;font-size:14px;opacity:.7}
</style></head><body>${body}
<footer>Built by <a href="${REPO}">theluckystrike</a>. Support: support@zovo.one</footer>
</body></html>`;
}

const HOME_DESCRIPTION =
  "Seventeen local-first MCP servers for Claude: invoicing, time tracking, expenses, spreadsheets and more for freelancers and small businesses. Free tier needs no key. Connect by URL in under a minute, or install the .mcpb. Bundle $39 lifetime, or $19 per server.";

const SERVER_IDS = Object.keys(PRODUCTS).filter((id) => id !== "bundle");

function home() {
  const compactRows = SERVER_IDS.map((id) => {
    const p = PRODUCTS[id];
    return `<tr><td><a href="/s/${esc(id)}">${esc(p.name.replace(/ Pro$/, ""))}</a></td><td>${esc(p.desc)}</td><td>$${p.usd}</td></tr>`;
  }).join("\n");
  const rows = Object.entries(PRODUCTS).map(([id, p]) =>
    `<tr><td><strong>${p.pkg ? `<a href="/s/${esc(id)}">${esc(p.name)}</a>` : esc(p.name)}</strong><br>${esc(p.desc)}<br><span class="muted">${esc(p.free)} ${esc(p.pro)}</span>${p.pkg ? `<br><span class="muted">Install: <code>npx -y ${esc(p.pkg)}</code> &middot; <a href="${REPO}/tree/main/servers/${esc(id)}#readme">docs</a></span>` : ""}</td>
<td>$${p.usd}</td><td><a class="buy" href="/buy/${id}?src=store.home.table.${id}">Buy</a></td></tr>`).join("\n");
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "MCP Servers Bundle",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "macOS, Windows, Linux",
      description: HOME_DESCRIPTION,
      url: "https://mcp.zovo.one/",
      author: { "@type": "Person", name: "theluckystrike", url: "https://github.com/theluckystrike" },
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free tier, any server" },
        { "@type": "Offer", price: "19", priceCurrency: "USD", name: "Pro, one server, lifetime" },
        { "@type": "Offer", price: "39", priceCurrency: "USD", name: "Pro bundle, all servers, lifetime" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "MCP servers for Claude",
      itemListElement: SERVER_IDS.map((id, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://mcp.zovo.one/s/${id}`,
        name: PRODUCTS[id].name,
      })),
    },
  ].map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("");
  const meta = `<meta name="description" content="${esc(HOME_DESCRIPTION).slice(0, 155)}"><link rel="canonical" href="https://mcp.zovo.one/">${ld}`;
  const html = page("MCP servers for Claude: invoices, time tracking and freelance tools", `<h1>Seventeen local-first MCP servers for Claude, for freelancers and small businesses</h1>
<p>Invoicing, time tracking, expenses, spreadsheets, quotes, contracts and more, each running as its own MCP server. The free tier works with no key and no account. Connect by URL in under a minute, or install a server locally. The full set is $39 once, for life; one server alone is $19 once, for life. See the full table and price math at <a href="/bundle">/bundle</a>.</p>
<h2>Three ways to start</h2>
<ol>
<li><strong>Connect by URL, no install:</strong> open <a href="/mcp/connect">/mcp/connect</a>, it mints a token and prints a ready URL for every server. Paste that URL into a Claude.ai custom connector, the Claude Desktop connector dialog, Claude Code (<code>claude mcp add --transport http</code>), Cursor, or VS Code. No header, no config file.</li>
<li><strong>Install the .mcpb:</strong> download the Claude Desktop bundle from the <a href="${REPO}/releases/tag/v0.1.1">releases page</a> and open it; Claude Desktop installs the server.</li>
<li><strong>Install locally with npx:</strong> run <code>npx -y @theluckystrike/mcp-&lt;server&gt;</code> and point your client's config at it; exact steps for six clients are on the <a href="/setup">setup pages</a>.</li>
</ol>
<p>A Pro key removes the free-tier limits on any of these three paths: run <code>license_activate</code> with the key in Claude, set <code>MCP_LICENSE_KEY</code>, or paste the key where the connect-by-URL token goes. Keys verify offline; nothing is sent anywhere after checkout. Refunds within 14 days: support@zovo.one.</p>
<h2>Measured, not claimed</h2>
<p>As of 2026-09-04: 399 of 399 automated checks passing across all servers and billing, 25 unit tests green on the billing service, and a hosted <code>tools/list</code> call answers at a 375&nbsp;ms median (p50). Full detail: <a href="${REPO}/blob/main/data/validation.json">validation.json</a>.</p>
<h2>The seventeen servers</h2>
<table><tr><th>Server</th><th>What it does</th><th>Pro price</th></tr>${compactRows}</table>
<h2>All servers, free and Pro limits</h2>
<table><tr><th>Product</th><th>Price</th><th></th></tr>${rows}</table>
<h2>Hosted endpoints</h2><p>No install: <a href="/mcp/connect">/mcp/connect</a> mints an anonymous token and prints a URL per server, <code>mcp.zovo.one/mcp/&lt;server&gt;/t/&lt;token&gt;</code>, that needs no headers. A Pro key can replace the token to remove free-tier limits.</p><h2>How activation works</h2>
<p>After payment you get a key like <code>MCPL1.xxx.yyy</code>. In Claude, run <code>license_activate</code> with the key, or set the environment variable <code>MCP_LICENSE_KEY</code>.</p>
<h2>Setup guides per client</h2>
<p>The exact config file, key and entry for every server in <a href="/setup/claude-desktop">Claude Desktop</a>, <a href="/setup/claude-code">Claude Code</a>, <a href="/setup/cursor">Cursor</a>, <a href="/setup/vscode">VS Code</a>, <a href="/setup/windsurf">Windsurf</a> and <a href="/setup/cline">Cline</a>: <a href="/setup">all 36 setup pages</a>.</p>
<h2>Guides</h2>
<p>Setup and worked examples: ${GUIDE_LINKS}</p>
<p>Source and docs: <a href="${REPO}">${REPO}</a></p>`);
  return html.replace("</title>", "</title>" + meta);
}

/** Free tier of each server in about five words, for the /bundle table. Hand-written from
 * data/facts.json `servers.<id>.free`, not a truncation of that longer sentence. */
const FREE_FIVE_WORDS = {
  "time-tracker": "Unlimited timers, 7-day report window",
  "price-tracker": "Unlimited checks, three tracked watches",
  spreadsheet: "Reads and queries up to 5,000 rows",
  invoice: "Three invoices a month, footer branding",
  "expense-tracker": "Unlimited logging, 30-day history window",
  currency: "Latest rates, 90-day history window",
  docx: "Unlimited docs, three monthly contracts",
  timezone: "Slots for three people, five contacts",
  resume: "One profile, three cover letters",
  recurring: "Three schedules, 30-day upcoming view",
  clauses: "Starter set plus ten own clauses",
  calendar: "Two calendars, 31-day windows",
  pdf: "Merge five files, thirty pages",
  kanban: "Three projects, 200 open tasks",
  image: "Resize and compress, batches of five",
  "bank-statement": "Two accounts, twelve months of history",
  quotes: "Five open quotes at once",
  barcode: "Twenty codes a month, every symbology",
  zip: "Twenty archives a month, unlimited reading",
  "billing-docs": "Five documents a month, unlimited text",
};

const BUNDLE_DESCRIPTION =
  `${SERVER_COUNT} MCP servers for Claude, one $${PRODUCTS.bundle.usd} key, lifetime. Buying singly is $${SERVER_COUNT * PRODUCTS[SERVER_IDS[0]].usd}, so the bundle saves $${BUNDLE_SAVING_USD}.`;

/**
 * GET /bundle: the case for the $39 key on its own page, separate from the home price
 * table. Every number here is computed from PRODUCTS (SERVER_COUNT, BUNDLE_SAVING_USD),
 * never typed twice, so a twentieth server cannot leave this page's math stale.
 */
export function bundlePage() {
  const singleTotal = SERVER_IDS.reduce((n, id) => n + PRODUCTS[id].usd, 0);
  const rows = SERVER_IDS.map((id) => {
    const tagline = PAGES[id]?.tagline || PRODUCTS[id].desc;
    return `<tr><td><a href="/s/${esc(id)}">${esc(PRODUCTS[id].name.replace(/ Pro$/, ""))}</a></td><td>${esc(tagline)}</td><td>${esc(FREE_FIVE_WORDS[id] || "")}</td></tr>`;
  }).join("\n");
  const canonical = "https://mcp.zovo.one/bundle";
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: PRODUCTS.bundle.name,
      description: BUNDLE_DESCRIPTION,
      url: canonical,
      brand: { "@type": "Person", name: "theluckystrike", url: "https://github.com/theluckystrike" },
      offers: {
        "@type": "Offer",
        price: String(PRODUCTS.bundle.usd),
        priceCurrency: "USD",
        url: `${canonical.replace("/bundle", "")}/buy/bundle?src=store.bundle`,
        availability: "https://schema.org/InStock",
      },
    },
  ].map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("");
  const meta = `<meta name="description" content="${esc(BUNDLE_DESCRIPTION).slice(0, 155)}"><link rel="canonical" href="${canonical}">${ld}`;
  const title = `${NUMBER_WORD[SERVER_COUNT] || SERVER_COUNT} MCP servers for Claude, one $${PRODUCTS.bundle.usd} key`;
  const body = `<h1>${esc(title)}</h1>
<p>One lifetime key unlocks Pro on every server below. Bought singly that is ${SERVER_COUNT} &times; $${PRODUCTS[SERVER_IDS[0]].usd} = $${singleTotal}; the bundle is $${PRODUCTS.bundle.usd}, a saving of $${BUNDLE_SAVING_USD}. One key, one payment, no per-server checkout.</p>
<p><a class="buy" href="/buy/bundle?src=store.bundle">Buy the bundle, $${PRODUCTS.bundle.usd}</a></p>
<h2>The ${SERVER_COUNT} servers</h2>
<table><tr><th>Server</th><th>What it does</th><th>Free tier</th></tr>${rows}</table>
<h2>Three ways to start</h2>
<ol>
<li><strong>Connect by URL, no install:</strong> open <a href="/mcp/connect">/mcp/connect</a>, it mints a token and prints a ready URL for every server; paste it into a Claude.ai custom connector, the Claude Desktop connector dialog, Claude Code (<code>claude mcp add --transport http</code>), Cursor or VS Code. The bundle key can replace that token on any of them to remove the free-tier limits.</li>
<li><strong>Install the .mcpb:</strong> download each server's bundle from the <a href="${REPO}/releases/tag/v0.1.1">releases page</a> and open it; Claude Desktop installs the server.</li>
<li><strong>Install locally with npx:</strong> run <code>npx -y @theluckystrike/mcp-&lt;server&gt;</code> for each one and point your client's config at it; exact steps for six clients are on the <a href="/setup">setup pages</a>.</li>
</ol>
<h2>How the key arrives</h2>
<p>Nothing is emailed. The key is rendered once, on the <code>/success</code> page right after payment; reloading that URL always shows the same key, and <code>/recover?session_id=...</code> gets it back from a lost tab. If you bought while connected through a hosted <code>mcp.zovo.one</code> endpoint, that endpoint's token is bound to Pro automatically, with nothing to paste there (docs/CHECKOUT_AUDIT.md).</p>
<p><a class="buy" href="/buy/bundle?src=store.bundle">Buy the bundle, $${PRODUCTS.bundle.usd}</a></p>
<p><a href="/">All ${SERVER_COUNT} servers priced singly</a> &middot; <a href="/setup">Setup per client</a> &middot; <a href="/guides">Guides</a></p>`;
  return page(title, body).replace("</title>", "</title>" + meta);
}

async function stripe(env, path, params, method = "POST") {
  const init = { method, headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } };
  if (method === "POST") {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(params).toString();
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, init);
  const json = await res.json();
  if (!res.ok) throw new Error(`stripe ${path}: ${json?.error?.message || res.status}`);
  return json;
}

async function createCheckout(env, host, productId, probeTag = "", tenant = "") {
  const p = PRODUCTS[productId];
  const ct = checkoutCustomText(productId);
  const s = await stripe(env, "checkout/sessions", {
    mode: "payment",
    "line_items[0][price]": p.price,
    "line_items[0][quantity]": "1",
    success_url: `https://${host}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://${host}/`,
    // Off (audit): a discount field on a $19 one-time page invites the buyer to leave and
    // hunt for a code that does not exist. fulfillmentAllowed keeps its 100%-discount
    // branch for any code issued from the Dashboard against an older session.
    allow_promotion_codes: "false",
    // Always create a Customer, so the email Checkout collects is kept on an object the
    // receipt and any later support lookup can be found by, not only inside the Session.
    customer_creation: "always",
    "custom_text[submit][message]": ct.submit,
    "custom_text[after_submit][message]": ct.after_submit,
    "metadata[product]": productId,
      ...(probeTag ? { "metadata[probe]": "1" } : {}),
      ...(tenant ? { client_reference_id: tenant, "metadata[tenant]": tenant } : {}),
    "payment_intent_data[statement_descriptor_suffix]": "MCP PRO",
    "payment_intent_data[metadata][product]": productId,
  });
  return s;
}

/** Write the hosted bind record. No TTL: a purchase is a lifetime key. */
async function bindTenant(env, tenant, key) {
  await env.REMOTE_DATA.put(`bind:${tenant}`, key);
}

/**
 * Conversion instrument (docs/CONVERSION_INSTRUMENT.md). Every cap message's upgrade
 * link carries ?src=<product>.<tool-or-slug>; a well-formed one is lowercase, digits,
 * dot, underscore and hyphen only, so it is safe to fold into a KV key unescaped.
 */
const SRC_RE = /^[a-z0-9][a-z0-9._-]{0,90}$/;

/** Pure: is this a well-formed src tag? */
export function validSrc(src) {
  return typeof src === "string" && SRC_RE.test(src);
}

const CLICK_DAY_TTL = 60 * 60 * 24 * 120; // 120 days of daily buckets is enough for any 7/30d KPI

/**
 * Count one human click on an upgrade link, before the redirect to Stripe. Two counters
 * per src: a per-day bucket (`click:<src>:<yyyy-mm-dd>`, TTL'd) for recent-window KPIs,
 * and a running total (`click:<src>:total`, no TTL) for lifetime counts. Stored in
 * REMOTE_DATA rather than LICENSES: clicks are hosted-traffic telemetry, the same bucket
 * as anon tokens and rate-limit counters, not a licensing record, and LICENSES is kept
 * lean for the session:/lic: keys the mint path depends on. Read-then-write like the
 * hosted rate limiter (remote/src/index.ts): an undercount under concurrency is the same
 * already-accepted approximation, not a new one.
 */
export async function recordClick(env, src) {
  const day = new Date().toISOString().slice(0, 10);
  const dayKey = `click:${src}:${day}`;
  const totalKey = `click:${src}:total`;
  const [dayN, totalN] = await Promise.all([env.REMOTE_DATA.get(dayKey), env.REMOTE_DATA.get(totalKey)]);
  await Promise.all([
    env.REMOTE_DATA.put(dayKey, String((Number(dayN) || 0) + 1), { expirationTtl: CLICK_DAY_TTL }),
    env.REMOTE_DATA.put(totalKey, String((Number(totalN) || 0) + 1)),
  ]);
}

/**
 * Aggregate click:<src>:<day|total> keys into per-src totals and trailing-7-day counts.
 * REMOTE_DATA.list() is a real runtime binding call (not just a wrangler CLI feature), so
 * this works from a live request, not only from local tooling.
 */
export async function clickStats(env) {
  const today = new Date();
  const last7 = new Set();
  for (let i = 0; i < 7; i++) last7.add(new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10));
  const bySrc = {};
  let cursor;
  for (;;) {
    const page = await env.REMOTE_DATA.list({ prefix: "click:", cursor });
    for (const k of page.keys) {
      const rest = k.name.slice("click:".length);
      const sep = rest.lastIndexOf(":");
      if (sep < 0) continue;
      const src = rest.slice(0, sep);
      const tag = rest.slice(sep + 1);
      if (tag !== "total" && !last7.has(tag)) continue; // older daily buckets don't affect any reported figure
      const n = Number(await env.REMOTE_DATA.get(k.name)) || 0;
      bySrc[src] ??= { total: 0, last7d: 0 };
      if (tag === "total") bySrc[src].total = n;
      else bySrc[src].last7d += n;
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  const total_clicks = Object.values(bySrc).reduce((a, s) => a + s.total, 0);
  const clicks_7d = Object.values(bySrc).reduce((a, s) => a + s.last7d, 0);
  return { generated_at: new Date().toISOString(), by_src: bySrc, total_clicks, clicks_7d };
}

class MintError extends Error {}

/**
 * Idempotent mint: the key for a session is derived once and cached in KV.
 * The caller must have run fulfillmentAllowed() first; productId is the checked id.
 * Review #14: every freshly minted key is verified against the embedded public key
 * before it is stored or returned, so a private/public key mismatch fails loudly
 * instead of charging a customer for an unusable key.
 */
async function keyForSession(env, session, productId) {
  const cached = await env.LICENSES.get(`session:${session.id}`);
  if (cached) return cached;
  const p = PRODUCTS[productId];
  if (!p) throw new Error(`unknown product: ${productId}`);
  const email = session.customer_details?.email || session.customer_email || "";
  const { key } = await mintLicense(env.LICENSE_PRIVATE_KEY_PEM, {
    product: p.payload,
    id: hex(6),
    iat: session.created || Math.floor(Date.now() / 1000),
    email,
  });
  const check = await verifyLicenseKey(key, productId);
  if (!check.ok) {
    console.error(`mint verification failed for session ${session.id} product ${productId}: ${check.reason}`);
    throw new MintError(check.reason);
  }
  // Store-if-absent: re-read to keep a concurrent webhook and /success in agreement.
  const again = await env.LICENSES.get(`session:${session.id}`);
  if (again) return again;
  await env.LICENSES.put(`session:${session.id}`, key, { metadata: { product: productId, email } });
  return key;
}

/** Retrieve a Checkout Session with its line items expanded (review #3). */
async function retrieveSession(env, sid) {
  return stripe(env, `checkout/sessions/${encodeURIComponent(sid)}?expand[]=line_items`, null, "GET");
}

function installSnippet(productId) {
  const p = PRODUCTS[productId];
  if (!p.pkg) {
    return `<pre><code># Bundle: the key works for every server. Example install:
claude mcp add time-tracker -- npx -y @theluckystrike/mcp-time-tracker
claude mcp add price-tracker -- npx -y @theluckystrike/mcp-price-tracker
claude mcp add spreadsheet -- npx -y @theluckystrike/mcp-spreadsheet
claude mcp add invoice -- npx -y @theluckystrike/mcp-invoice</code></pre>`;
  }
  return `<pre><code># Claude Code
claude mcp add ${p.bin.replace(/^mcp-/, "")} -- npx -y ${p.pkg}

# Claude Desktop (claude_desktop_config.json)
{
  "mcpServers": {
    "${p.bin.replace(/^mcp-/, "")}": { "command": "npx", "args": ["-y", "${p.pkg}"] }
  }
}</code></pre>`;
}

export function successPage(key, productId, session, boundTenant = "") {
  const p = PRODUCTS[productId];
  const hostedNote = boundTenant
    ? `<h2>Hosted endpoints</h2>
<p>The hosted endpoint you were using (token <code>${esc(boundTenant)}</code>) is already Pro for ${esc(p.name)} -
nothing further to do there. The key below still works for a local, stdio install.</p>`
    : "";
  return page("Your MCP Pro license key", `<h1>Payment received</h1>
<p>${esc(p.name)} - $${p.usd} one-time, lifetime.</p>
${hostedNote}
<h2>Your license key</h2>
<pre class="key"><code>${esc(key)}</code></pre>
<p class="muted">Save this key now; it is shown again only at this URL. No email is sent with the key.
Reloading this page always shows the same key. If you lose it, email support@zovo.one with your Stripe receipt
(it carries the session id) and the key can be recovered from <code>/recover?session_id=...</code>.</p>
<h2>Activate it</h2>
<p>In Claude: run <code>license_activate</code> with this key.</p>
<p>Alternative, set an environment variable before starting the server:</p>
<pre><code>MCP_LICENSE_KEY=${esc(key)}</code></pre>
<h2>Install</h2>
${installSnippet(productId)}
<p>Docs: <a href="${REPO}">${REPO}</a></p>`);
}

/** Constant-time comparison of two equal-length hex strings. */
function ctEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Stripe signature check. Review #9: a header may carry several v1 values during
 * secret rotation, so every one is kept and each is compared in constant time.
 * Review #10: the timestamp must be a safe integer, otherwise Number(t) is NaN
 * and the replay-window comparison passes.
 */
export async function verifySig(env, body, header) {
  let t = null;
  const v1s = [];
  for (const field of String(header || "").split(",")) {
    const i = field.indexOf("=");
    if (i < 0) continue;
    const k = field.slice(0, i).trim();
    const v = field.slice(i + 1).trim();
    if (k === "t" && t === null) t = v;
    else if (k === "v1") v1s.push(v);
  }
  if (t === null || v1s.length === 0) return false;
  if (!/^\d{1,15}$/.test(t)) return false;
  const ts = Number(t);
  if (!Number.isSafeInteger(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  const enc = new TextEncoder();
  const mac = await crypto.subtle.importKey("raw", enc.encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", mac, enc.encode(`${t}.${body}`)));
  const expected = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  let matched = false;
  for (const v1 of v1s) if (ctEqual(expected, v1)) matched = true; // no early exit
  return matched;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.host;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method === "HEAD" ? "GET" : request.method;

    if (path === "/health") {
      // signer check: mint a throwaway key in-runtime and verify it. No secrets leak.
      let signer = "unavailable";
      try {
        const probe = await mintLicense(env.LICENSE_PRIVATE_KEY_PEM, { product: "health-probe", id: "000000000000", iat: 0 });
        signer = (await verifyLicenseKey(probe.key, "health-probe")).ok ? "ok" : "verify-failed";
      } catch (e) {
        signer = `error: ${e.message}`;
      }
      return Response.json({
        ok: signer === "ok",
        service: "mcp-billing",
        signer,
        products: Object.keys(PRODUCTS),
        stripe_mode: (env.STRIPE_SECRET_KEY || "").includes("_live_") || (env.STRIPE_SECRET_KEY || "").startsWith("rk_live") ? "live" : "test",
        time: new Date().toISOString(),
      });
    }

    if (path === "/" && method === "GET") {
      return new Response(home(), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (path === "/bundle" && method === "GET") {
      return new Response(bundlePage(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }

    if (path.startsWith("/s/") && method === "GET") {
      const id = path.slice(3);
      const pg = PAGES[id];
      if (!pg) return new Response(page("Not found", `<h1>Unknown server</h1><p><a href="/">Back to products</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      const meta = `<meta name="description" content="${esc(pg.description).slice(0, 155)}"><link rel="canonical" href="https://mcp.zovo.one/s/${esc(id)}">
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: pg.title, applicationCategory: "DeveloperApplication", operatingSystem: "macOS, Windows, Linux", description: pg.description, url: `https://mcp.zovo.one/s/${id}`, author: { "@type": "Person", name: "theluckystrike", url: "https://github.com/theluckystrike" }, offers: [{ "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free tier" }, { "@type": "Offer", price: String(PRODUCTS[id].usd), priceCurrency: "USD", name: "Pro, lifetime", url: `https://mcp.zovo.one/buy/${id}?src=store.s.${id}` }] })}</script>`;
      const setupLinks = SETUP_SERVERS[id]
        ? CLIENT_ORDER.map((c) => `<a href="/setup/${c}/${id}">${esc(CLIENTS[c].name)}</a>`).join(" &middot; ")
        : null;
      const body = `<p><a href="/">All servers</a> &middot; <a class="buy" href="/buy/${esc(id)}?src=store.s.${esc(id)}">Buy Pro $${PRODUCTS[id].usd}</a> &middot; <a href="${REPO}/tree/main/servers/${esc(id)}">Source</a> &middot; <a href="${REPO}/releases/tag/v0.1.1">Claude Desktop bundle (.mcpb)</a></p>${pg.html}
${setupLinks ? `<h2>Set it up in your client</h2>\n<p>Exact config path, entry and caveats: ${setupLinks} &middot; <a href="/setup">all clients</a></p>` : ""}
${COMPARE[id] ? `<h2>Compared with the alternatives</h2>\n<p><a href="/compare/${esc(id)}">${esc(COMPARE[id].title)}</a> &middot; <a href="/compare">all comparisons</a></p>` : ""}
<h2>Guides</h2>
<p>${GUIDE_LINKS}</p>`;
      return new Response(page(pg.title + " for Claude, Cursor and any MCP client", body).replace("</title>", "</title>" + meta), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }

    if (path === "/guides" && method === "GET") {
      const items = Object.entries(GUIDES).map(([slug, g]) =>
        `<li><a href="/guides/${esc(slug)}">${esc(g.title)}</a><br><span class="muted">${esc(g.description)}</span></li>`).join("\n");
      const body = `<h1>${esc(GUIDE_INDEX.title)}</h1>
<p>${esc(GUIDE_INDEX.description)} Every server runs locally over stdio, has a free tier that is useful on its own, and a Pro key that is a one-time payment.</p>
<ul>${items}</ul>
<p><a href="/">All servers and prices</a></p>`;
      const meta = `<meta name="description" content="${esc(GUIDE_INDEX.description).slice(0, 155)}"><link rel="canonical" href="https://mcp.zovo.one/guides">`;
      return new Response(page(GUIDE_INDEX.title, body).replace("</title>", "</title>" + meta), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }

    if (path.startsWith("/guides/") && method === "GET") {
      const slug = path.slice("/guides/".length);
      const g = GUIDES[slug];
      if (!g) return new Response(page("Not found", `<h1>Unknown guide</h1><p><a href="/guides">All guides</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      const canonical = `https://mcp.zovo.one/guides/${slug}`;
      const faqHtml = g.faq.map((f) => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`).join("\n");
      const ld = [
        { "@context": "https://schema.org", "@type": "TechArticle", headline: g.title, description: g.description, url: canonical, author: { "@type": "Person", name: "theluckystrike", url: "https://github.com/theluckystrike" }, publisher: { "@type": "Organization", name: "theluckystrike", url: "https://mcp.zovo.one" } },
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
      ].map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("");
      const meta = `<meta name="description" content="${esc(g.description).slice(0, 155)}"><link rel="canonical" href="${canonical}">${ld}`;
      const body = `<p class="muted"><a href="/">Home</a> &middot; <a href="/guides">Guides</a></p>
${g.html}
<h2>Questions</h2>
${faqHtml}
<h2>Related</h2>
<p><a href="/">All MCP servers and prices</a> &middot; <a href="/guides">All guides</a> &middot; <a class="buy" href="/buy/bundle?src=store.guide.${slug}">Buy the bundle $${PRODUCTS.bundle.usd}</a></p>`;
      return new Response(page(g.title, body).replace("</title>", "</title>" + meta), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }

    if (path === "/compare" && method === "GET") {
      const items = Object.entries(COMPARE).map(([slug, c]) =>
        `<li><a href="/compare/${esc(slug)}">${esc(c.title)}</a><br><span class="muted">${esc(c.description)}</span></li>`).join("\n");
      const body = `<h1>${esc(COMPARE_INDEX.title)}</h1>
<p>${esc(COMPARE_INDEX.description)} Where a competing server does something we do not, the page says so and names the tool.</p>
<ul>${items}</ul>
<p><a href="/">All servers and prices</a> &middot; <a href="/guides">Guides</a> &middot; <a href="/setup">Setup</a></p>`;
      const meta = `<meta name="description" content="${esc(COMPARE_INDEX.description).slice(0, 155)}"><link rel="canonical" href="https://mcp.zovo.one/compare">`;
      return new Response(page(COMPARE_INDEX.title, body).replace("</title>", "</title>" + meta), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }

    if (path.startsWith("/compare/") && method === "GET") {
      const slug = path.slice("/compare/".length);
      const c = COMPARE[slug];
      if (!c) return new Response(page("Not found", `<h1>Unknown comparison</h1><p><a href="/compare">All comparisons</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      const canonical = `https://mcp.zovo.one/compare/${slug}`;
      const faqHtml = c.faq.map((f) => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`).join("\n");
      const ld = [
        { "@context": "https://schema.org", "@type": "TechArticle", headline: c.title, description: c.description, url: canonical, author: { "@type": "Person", name: "theluckystrike", url: "https://github.com/theluckystrike" }, publisher: { "@type": "Organization", name: "theluckystrike", url: "https://mcp.zovo.one" } },
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: c.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
      ].map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("");
      const meta = `<meta name="description" content="${esc(c.description).slice(0, 155)}"><link rel="canonical" href="${canonical}">${ld}`;
      const body = `<p class="muted"><a href="/">Home</a> &middot; <a href="/compare">Comparisons</a></p>
${c.html}
<h2>Questions</h2>
${faqHtml}
<h2>Related</h2>
<p><a href="/s/${esc(slug)}">Product page</a> &middot; <a href="/setup">Setup per client</a> &middot; <a href="/guides">Guides</a> &middot; <a href="/compare">All comparisons</a>${PRODUCTS[slug] ? ` &middot; <a class="buy" href="/buy/${esc(slug)}?src=store.compare.${esc(slug)}">Buy Pro $${PRODUCTS[slug].usd}</a>` : ""}</p>`;
      return new Response(page(c.title, body).replace("</title>", "</title>" + meta), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }

    if ((path === "/setup" || path.startsWith("/setup/")) && method === "GET") {
      const parts = path.split("/").filter(Boolean); // ["setup", client?, server?]
      let pg = null;
      let faq = null;
      if (parts.length === 1) pg = setupIndex();
      else if (parts.length === 2) pg = clientHub(parts[1]);
      else if (parts.length === 3) {
        const sp = setupPage(parts[1], parts[2]);
        if (sp) { pg = sp; faq = sp.faq; }
      }
      if (!pg) return new Response(page("Not found", `<h1>Unknown setup page</h1><p><a href="/setup">All setup guides</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      const ld = [
        { "@context": "https://schema.org", "@type": "TechArticle", headline: pg.title, description: pg.description, url: pg.canonical, author: { "@type": "Person", name: "theluckystrike", url: "https://github.com/theluckystrike" }, publisher: { "@type": "Organization", name: "theluckystrike", url: "https://mcp.zovo.one" } },
      ];
      if (faq) ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
      const meta = `<meta name="description" content="${esc(pg.description).slice(0, 155)}"><link rel="canonical" href="${pg.canonical}">` +
        ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("");
      return new Response(page(pg.title, pg.body).replace("</title>", "</title>" + meta), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }

    if (path === "/sitemap.xml") {
      const urls = ["/", "/bundle", "/guides", "/compare", ...Object.keys(PAGES).map((k) => `/s/${k}`), ...Object.keys(GUIDES).map((k) => `/guides/${k}`), ...Object.keys(COMPARE).map((k) => `/compare/${k}`), ...setupUrls()].map((u) => `<url><loc>https://mcp.zovo.one${u}</loc></url>`).join("");
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { "content-type": "application/xml" } });
    }
    if (path === "/22fad93b71a88e2e60acae203c4288ae.txt") {
      return new Response("22fad93b71a88e2e60acae203c4288ae", { headers: { "content-type": "text/plain" } });
    }
    if (path === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\nDisallow: /buy/\nDisallow: /success\nDisallow: /recover\nDisallow: /verify\nDisallow: /bound\nSitemap: https://mcp.zovo.one/sitemap.xml\n", { headers: { "content-type": "text/plain" } });
    }
    if (path === "/llms.txt") {
      const lines = Object.entries(PAGES).map(([k, v]) => `- [${v.title}](https://mcp.zovo.one/s/${k}): ${v.tagline} Install: npx -y @theluckystrike/mcp-${k}`).join("\n");
      const guideLines = Object.entries(GUIDES).map(([k, v]) => `- [${v.title}](https://mcp.zovo.one/guides/${k}): ${v.description}`).join("\n");
      const compareLines = Object.entries(COMPARE).map(([k, v]) => `- [${v.title}](https://mcp.zovo.one/compare/${k}): ${v.description}`).join("\n");
      const setupLines = CLIENT_ORDER.map((c) =>
        `- [MCP servers for ${CLIENTS[c].name}](https://mcp.zovo.one/setup/${c}): config file ${CLIENTS[c].file || "none, a connector URL"}, key ${CLIENTS[c].key || "none"}. ` +
        serversFor(c).map((sv) => `[${SETUP_SERVERS[sv].title} in ${CLIENTS[c].name}](https://mcp.zovo.one/setup/${c}/${sv})`).join(", ")
      ).join("\n");
      return new Response(`# MCP Servers by theluckystrike\n\n> Practical MCP servers with a free tier and a one-time Pro license. Keys verify offline.\n\n${lines}\n\n- [${NUMBER_WORD[SERVER_COUNT] || SERVER_COUNT}-server bundle, $${PRODUCTS.bundle.usd} lifetime](https://mcp.zovo.one/bundle): saves $${BUNDLE_SAVING_USD} against buying all ${SERVER_COUNT} singly\n\n## Guides\n\n${guideLines}\n\n- [All guides](https://mcp.zovo.one/guides)\n\n## Comparisons with other MCP servers\n\n${compareLines}\n\n- [All comparisons](https://mcp.zovo.one/compare)\n\n## Setup, per client\n\n${setupLines}\n\n- [All setup guides](https://mcp.zovo.one/setup)\n- [Connect in one step, no install](https://mcp.zovo.one/mcp/connect): mints an anonymous token and prints a URL per server, https://mcp.zovo.one/mcp/<server>/t/<token>, that works with no headers; a Pro key can replace the token\n- [Buy Pro](https://mcp.zovo.one)\n- [Source](${REPO})\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    if (path.startsWith("/buy/") && method === "GET") {
      // validation probes tag their sessions so funnel metrics can exclude them
      const ua = request.headers.get("user-agent") || "";
      const scripted = /^(curl|python|node|wget|go-http|undici|axios|httpie)/i.test(ua) || ua === "";
      const probeTag = request.headers.get("x-mcp-probe") === "1" || scripted ? "1" : "";
      const id = decodeURIComponent(path.slice("/buy/".length));
      if (!PRODUCTS[id]) return new Response(page("Not found", `<h1>Unknown product</h1><p><a href="/">Back to products</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      const tenantParam = url.searchParams.get("tenant") || "";
      const tenant = validTenant(tenantParam) ? tenantParam : "";
      // Conversion instrument: count the click before the redirect, skipping the same
      // probe-tagged and scripted requests the Stripe metadata already excludes.
      const srcParam = url.searchParams.get("src") || "";
      const src = validSrc(srcParam) ? srcParam : `${id}.unknown`;
      if (!probeTag) ctx.waitUntil(recordClick(env, src));
      try {
        const session = await createCheckout(env, host, id, probeTag, tenant);
        return new Response(null, { status: 303, headers: { Location: session.url, "cache-control": "no-store" } });
      } catch (e) {
        return new Response(page("Checkout error", `<h1>Checkout could not start</h1><p>${esc(e.message)}</p><p><a href="/">Back</a></p>`), { status: 502, headers: { "content-type": "text/html; charset=utf-8" } });
      }
    }

    if (path === "/success" && method === "GET") {
      const sid = url.searchParams.get("session_id");
      if (!sid) return Response.redirect(`https://${host}/`, 303);
      let session;
      try {
        session = await retrieveSession(env, sid);
      } catch (e) {
        console.error(`session retrieve failed for ${sid}: ${e.message}`);
        return new Response(page("Session not found", `<h1>We could not load that checkout session</h1>
<p>The link may be mistyped or expired. If you have paid, email support@zovo.one with your Stripe receipt and your key will be sent back.</p>
<p><a href="/">Back to products</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
      const productId = session.metadata?.product;
      const decision = fulfillmentAllowed(session, productId);
      if (!decision.ok) {
        return new Response(page("Payment not complete", `<h1>Payment not complete</h1>
<p>${esc(decision.reason)}. If you have just paid, reload this page in a few seconds.</p>
<p>Still stuck? Email support@zovo.one with your Stripe receipt.</p><p><a href="/">Back to products</a></p>`), { status: 402, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
      try {
        const key = await keyForSession(env, session, productId);
        const bd = bindDecision(session, true);
        if (bd.bind) {
          try {
            await bindTenant(env, bd.tenant, key);
          } catch (e) {
            console.error(`bind failed for ${sid} tenant ${bd.tenant}: ${e.message}`);
          }
        }
        return new Response(successPage(key, productId, session, bd.bind ? bd.tenant : ""), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      } catch (e) {
        console.error(`mint failed for ${sid}: ${e.message}`);
        return new Response(page("Key could not be issued", `<h1>Your payment went through, the key did not</h1>
<p>Nothing further is needed from you. Email support@zovo.one with your Stripe receipt and the key will be issued by hand, or refunded.</p>`), { status: 500, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
    }

    // Review #15: the documented recovery path. Same fulfillment checks as /success;
    // returns the stored key for a paid session and nothing otherwise.
    if (path === "/recover" && method === "GET") {
      const sid = url.searchParams.get("session_id");
      const nostore = { "cache-control": "no-store" };
      if (!sid) return Response.json({ ok: false, reason: "session_id required" }, { status: 400, headers: nostore });
      let session;
      try {
        session = await retrieveSession(env, sid);
      } catch (e) {
        console.error(`recover retrieve failed for ${sid}: ${e.message}`);
        return Response.json({ ok: false, reason: "session not found" }, { status: 404, headers: nostore });
      }
      const productId = session.metadata?.product;
      const decision = fulfillmentAllowed(session, productId);
      if (!decision.ok) return Response.json({ ok: false, reason: decision.reason }, { status: 402, headers: nostore });
      try {
        const key = await keyForSession(env, session, productId);
        return Response.json({ ok: true, product: productId, key, support: "support@zovo.one" }, { headers: nostore });
      } catch (e) {
        console.error(`recover mint failed for ${sid}: ${e.message}`);
        return Response.json({ ok: false, reason: "key could not be issued, email support@zovo.one" }, { status: 500, headers: nostore });
      }
    }

    if (path === "/webhook" && method === "POST") {
      const body = await request.text();
      if (!(await verifySig(env, body, request.headers.get("stripe-signature")))) {
        return new Response("bad signature", { status: 400 });
      }
      let event;
      try {
        event = JSON.parse(body);
      } catch {
        return new Response("bad json", { status: 400 });
      }
      // Review #7: delayed payment methods complete via async_payment_succeeded,
      // which is fulfilled on exactly the same terms as a synchronous completion.
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const sid = event.data?.object?.id;
        if (!sid) return Response.json({ received: true });
        try {
          // The event payload has no line_items; re-retrieve so price binding is checked.
          const session = await retrieveSession(env, sid);
          const productId = session.metadata?.product;
          const decision = fulfillmentAllowed(session, productId);
          if (!decision.ok) {
            console.error(`webhook ${event.type} not fulfilled for ${sid}: ${decision.reason}`);
            return Response.json({ received: true, fulfilled: false, reason: decision.reason });
          }
          const key = await keyForSession(env, session, productId);
          const bd = bindDecision(session, true);
          if (bd.bind) {
            try {
              await bindTenant(env, bd.tenant, key);
            } catch (e) {
              console.error(`webhook bind failed for ${sid} tenant ${bd.tenant}: ${e.message}`);
            }
          }
        } catch (e) {
          console.error(`webhook ${event.type} mint failed for ${sid}: ${e.message}`);
          return new Response(`mint failed: ${e.message}`, { status: 500 });
        }
      }
      return Response.json({ received: true });
    }

    if (path === "/verify" && method === "GET") {
      const key = url.searchParams.get("key") || "";
      const product = url.searchParams.get("product") || "";
      const r = await verifyLicenseKey(key, product || null);
      return Response.json(
        r.ok ? { ok: true, product: r.payload.p, id: r.payload.id, iat: r.payload.iat, exp: r.payload.exp ?? null }
             : { ok: false, product: null, id: null, reason: r.reason },
        { status: r.ok ? 200 : 400 }
      );
    }

    // Whether an anonymous hosted-endpoint token has been bound to a purchased
    // key (support and the dashboard KPI). Never returns the key itself.
    if (path === "/bound" && method === "GET") {
      const tenant = url.searchParams.get("tenant") || "";
      const nostore = { "cache-control": "no-store" };
      if (!validTenant(tenant)) return Response.json({ bound: false, product: null, reason: "bad tenant" }, { status: 400, headers: nostore });
      const key = await env.REMOTE_DATA.get(`bind:${tenant}`);
      if (!key) return Response.json({ bound: false, product: null }, { headers: nostore });
      const r = await verifyLicenseKey(key, null);
      if (!r.ok) return Response.json({ bound: false, product: null, reason: r.reason }, { headers: nostore });
      return Response.json({ bound: true, product: r.payload.p }, { headers: nostore });
    }

    // Conversion instrument (docs/CONVERSION_INSTRUMENT.md). Plain JSON, no auth: the
    // counters are per-src click counts, nothing that identifies a person.
    if (path === "/stats/clicks" && method === "GET") {
      const stats = await clickStats(env);
      return Response.json(stats, { headers: { "cache-control": "no-store" } });
    }

    return new Response(page("Not found", `<h1>Not found</h1><p><a href="/">Back to products</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  },
};
