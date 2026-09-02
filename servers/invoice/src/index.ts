#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve as resolvePath } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate } from "@theluckystrike/mcp-license";
import { z } from "zod";
import {
  addDays, computeTotals, daysBetween, formatMoney, isoDate,
} from "./money.js";
import { renderInvoicePdf } from "./pdf.js";
import {
  dataDir, findClient, getBusiness, getClients, getInvoices, hasBusiness,
  invoicesInMonth, nextNumber, setBusiness, setClients, setInvoices,
  type Business, type Client, type Invoice,
} from "./store.js";

const FREE_INVOICES_PER_MONTH = 3;
const gate = createLicenseGate({ product: "invoice" });

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

function summarize(inv: Invoice) {
  return {
    number: inv.number,
    client: inv.client.name,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    currency: inv.currency,
    subtotal: formatMoney(inv.subtotal_minor, inv.currency),
    discount: inv.discount_minor ? formatMoney(inv.discount_minor, inv.currency) : undefined,
    tax: inv.tax_lines.filter((t) => t.rate || t.tax_minor)
      .map((t) => `${t.rate}% on ${formatMoney(t.base_minor, inv.currency)} = ${formatMoney(t.tax_minor, inv.currency)}`),
    total: formatMoney(inv.total_minor, inv.currency),
    total_minor: inv.total_minor,
    status: inv.status,
    paid: inv.paid_minor ? formatMoney(inv.paid_minor, inv.currency) : undefined,
    balance_due: formatMoney(inv.total_minor - inv.paid_minor, inv.currency),
  };
}

function expandPath(p: string): string {
  const s = p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

const server = new McpServer(
  { name: "mcp-invoice", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {} } },
);

/* ------------------------------------------------------------------ business */

server.registerTool("business_set", {
  title: "Set your business details",
  description: "Store the issuer profile printed at the top of every invoice: your name, address, VAT id, bank details and defaults (currency, tax rate, payment terms, invoice number prefix). Call this once before creating invoices.",
  inputSchema: {
    name: z.string().describe("Your business or freelancer name"),
    address: z.string().optional().describe("Postal address, newlines allowed"),
    email: z.string().optional(),
    vat_id: z.string().optional().describe("VAT / tax registration id"),
    iban: z.string().optional().describe("IBAN or account number for payment"),
    bank: z.string().optional().describe("Bank name / BIC"),
    logo_path: z.string().optional().describe("Path to a PNG or JPG logo (Pro)"),
    default_currency: z.string().optional().describe("ISO code, e.g. EUR, USD, JPY. Default EUR"),
    default_tax_rate: z.number().optional().describe("Default VAT percent applied to items without their own rate"),
    payment_terms_days: z.number().optional().describe("Default days until due. Default 14"),
    invoice_prefix: z.string().optional().describe("Invoice number prefix, default INV (custom prefix is Pro)"),
  },
}, async (a) => {
  try {
    const prev = getBusiness();
    let prefix = a.invoice_prefix ?? prev.invoice_prefix;
    let note = "";
    if (a.invoice_prefix && a.invoice_prefix !== "INV" && !gate.isPro()) {
      prefix = "INV";
      note = `\n\nNote: custom invoice prefix is a Pro feature, kept "INV". ${gate.upgradeText("custom invoice prefix")}`;
    }
    const biz: Business = {
      name: a.name,
      address: a.address ?? prev.address,
      email: a.email ?? prev.email,
      vat_id: a.vat_id ?? prev.vat_id,
      iban: a.iban ?? prev.iban,
      bank: a.bank ?? prev.bank,
      logo_path: a.logo_path ?? prev.logo_path,
      default_currency: (a.default_currency ?? prev.default_currency).toUpperCase(),
      default_tax_rate: a.default_tax_rate ?? prev.default_tax_rate,
      payment_terms_days: a.payment_terms_days ?? prev.payment_terms_days,
      invoice_prefix: prefix.replace(/[^A-Za-z0-9_-]/g, "") || "INV",
    };
    setBusiness(biz);
    return ok(`Business profile saved to ${dataDir()}.\n\n${JSON.stringify(biz, null, 2)}${note}`);
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ------------------------------------------------------------------- clients */

server.registerTool("client_add", {
  title: "Add a client",
  description: "Store a client so invoices can refer to them by name. Re-adding the same name updates the stored details.",
  inputSchema: {
    name: z.string(),
    address: z.string().optional(),
    email: z.string().optional(),
    vat_id: z.string().optional().describe("Client VAT id, printed for reverse-charge invoices"),
  },
}, async (a) => {
  try {
    const clients = getClients();
    const existing = clients.find((c) => c.name.toLowerCase() === a.name.trim().toLowerCase());
    if (existing) {
      existing.address = a.address ?? existing.address;
      existing.email = a.email ?? existing.email;
      existing.vat_id = a.vat_id ?? existing.vat_id;
      setClients(clients);
      return ok(`Updated client ${existing.name} (${existing.id}).`);
    }
    const c: Client = {
      id: randomBytes(4).toString("hex"), name: a.name.trim(),
      address: a.address, email: a.email, vat_id: a.vat_id, created: isoDate(),
    };
    clients.push(c);
    setClients(clients);
    return ok(`Added client ${c.name} (${c.id}).`);
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("client_list", {
  title: "List clients", description: "List every stored client with their id, address, email and VAT id.",
  inputSchema: {},
}, async () => {
  const clients = getClients();
  if (!clients.length) return ok("No clients yet. Add one with client_add.");
  return json(clients);
});

/* ------------------------------------------------------------------ invoices */

const itemSchema = z.object({
  description: z.string(),
  quantity: z.number().describe("Hours, units or 1 for a flat fee"),
  unit_price: z.number().describe("Price per unit in major units, e.g. 90 for 90 EUR"),
  tax_rate: z.number().optional().describe("VAT percent for this line, overrides the business default"),
});

function monthLimitBlocked(issueDate: string): string | null {
  if (gate.isPro()) return null;
  const used = invoicesInMonth(issueDate.slice(0, 7)).length;
  if (used < FREE_INVOICES_PER_MONTH) return null;
  return `You have already created ${used} invoices in ${issueDate.slice(0, 7)}. ` +
    `The free tier allows ${FREE_INVOICES_PER_MONTH} invoices per calendar month.\n\n` +
    gate.upgradeText("unlimited invoices");
}

function createInvoice(a: {
  client: string; items: z.infer<typeof itemSchema>[]; currency?: string;
  issue_date?: string; due_days?: number; notes?: string; discount_percent?: number;
}): { error?: string; gated?: string; invoice?: Invoice } {
  if (!hasBusiness()) return { error: "no business profile yet. Call business_set first." };
  if (!a.items.length) return { error: "an invoice needs at least one item." };
  const biz = getBusiness();

  let client = findClient(a.client);
  if (!client) {
    const clients = getClients();
    client = { id: randomBytes(4).toString("hex"), name: a.client.trim(), created: isoDate() };
    clients.push(client);
    setClients(clients);
  }

  const issue = a.issue_date ?? isoDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issue)) return { error: `issue_date must be YYYY-MM-DD, got "${issue}".` };
  const gated = monthLimitBlocked(issue);
  if (gated) return { gated };

  const currency = (a.currency ?? biz.default_currency).toUpperCase();
  const totals = computeTotals(a.items, currency, a.discount_percent ?? 0, biz.default_tax_rate);
  const number = nextNumber(biz.invoice_prefix, issue.slice(0, 4));

  const inv: Invoice = {
    number, client_id: client.id,
    client: { name: client.name, address: client.address, email: client.email, vat_id: client.vat_id },
    issue_date: issue,
    due_date: addDays(issue, a.due_days ?? biz.payment_terms_days),
    currency, decimals: totals.decimals, lines: totals.lines,
    subtotal_minor: totals.subtotal_minor,
    discount_percent: totals.discount_percent, discount_minor: totals.discount_minor,
    net_minor: totals.net_minor, tax_lines: totals.tax_lines, tax_minor: totals.tax_minor,
    total_minor: totals.total_minor,
    notes: a.notes, status: "unpaid", paid_minor: 0,
    created: new Date().toISOString(), branded: !gate.isPro(),
  };
  const all = getInvoices();
  all.push(inv);
  setInvoices(all);
  return { invoice: inv };
}

server.registerTool("invoice_create", {
  title: "Create an invoice",
  description: "Create an invoice for a client from a list of items. Allocates the next invoice number (never reused), computes subtotal, discount, tax lines per rate and the total. Amounts are held as integer minor units; every line is rounded first, then summed.",
  inputSchema: {
    client: z.string().describe("Client name or id. Unknown names are added automatically"),
    items: z.array(itemSchema).describe("Line items"),
    currency: z.string().optional(),
    issue_date: z.string().optional().describe("YYYY-MM-DD, defaults to today"),
    due_days: z.number().optional().describe("Days until due, defaults to your payment terms"),
    notes: z.string().optional().describe("Free text printed under the totals"),
    discount_percent: z.number().optional().describe("Discount applied to every line before tax"),
  },
}, async (a) => {
  try {
    const r = createInvoice(a);
    if (r.error) return fail(r.error);
    if (r.gated) return ok(r.gated);
    return ok(`Created invoice ${r.invoice!.number}.\n\n${JSON.stringify(summarize(r.invoice!), null, 2)}\n\nRender it with invoice_pdf.`);
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("invoice_from_hours", {
  title: "Invoice from hours",
  description: "Shortcut for the common case: bill one client for N hours at an hourly rate. Creates a single-line invoice.",
  inputSchema: {
    client: z.string(),
    hours: z.number(),
    rate: z.number().describe("Hourly rate in major units"),
    description: z.string().optional().describe("Line description, default 'Consulting services'"),
    tax_rate: z.number().optional(),
    currency: z.string().optional(),
    issue_date: z.string().optional(),
    due_days: z.number().optional(),
    notes: z.string().optional(),
    discount_percent: z.number().optional(),
  },
}, async (a) => {
  try {
    const r = createInvoice({
      client: a.client,
      items: [{
        description: a.description ?? "Consulting services",
        quantity: a.hours, unit_price: a.rate, tax_rate: a.tax_rate,
      }],
      currency: a.currency, issue_date: a.issue_date, due_days: a.due_days,
      notes: a.notes, discount_percent: a.discount_percent,
    });
    if (r.error) return fail(r.error);
    if (r.gated) return ok(r.gated);
    return ok(`Created invoice ${r.invoice!.number}.\n\n${JSON.stringify(summarize(r.invoice!), null, 2)}`);
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("invoice_list", {
  title: "List invoices",
  description: "List invoices, optionally filtered by status (unpaid, paid, partial), client, and an issue-date range.",
  inputSchema: {
    status: z.enum(["unpaid", "paid", "partial"]).optional(),
    client: z.string().optional(),
    from: z.string().optional().describe("YYYY-MM-DD inclusive"),
    to: z.string().optional().describe("YYYY-MM-DD inclusive"),
  },
}, async (a) => {
  try {
    let list = getInvoices();
    if (a.status) list = list.filter((i) => i.status === a.status);
    if (a.client) {
      const n = a.client.trim().toLowerCase();
      list = list.filter((i) => i.client.name.toLowerCase().includes(n) || i.client_id === a.client);
    }
    if (a.from) list = list.filter((i) => i.issue_date >= a.from!);
    if (a.to) list = list.filter((i) => i.issue_date <= a.to!);
    if (!list.length) return ok("No invoices match.");
    list.sort((x, y) => x.number.localeCompare(y.number));
    return json({ count: list.length, invoices: list.map(summarize) });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("invoice_get", {
  title: "Get one invoice",
  description: "Return the full stored record for one invoice number, including every line and tax breakdown.",
  inputSchema: { number: z.string() },
}, async (a) => {
  const inv = getInvoices().find((i) => i.number === a.number);
  if (!inv) return fail(`no invoice numbered ${a.number}.`);
  return json(inv);
});

server.registerTool("invoice_mark_paid", {
  title: "Mark an invoice paid",
  description: "Record a payment. Without an amount the invoice is marked fully paid; a smaller amount marks it partial and reports the remaining balance.",
  inputSchema: {
    number: z.string(),
    paid_date: z.string().optional().describe("YYYY-MM-DD, defaults to today"),
    amount: z.number().optional().describe("Amount received in major units. Omit for the full total"),
  },
}, async (a) => {
  try {
    const all = getInvoices();
    const inv = all.find((i) => i.number === a.number);
    if (!inv) return fail(`no invoice numbered ${a.number}.`);
    const f = Math.pow(10, inv.decimals);
    const paid = a.amount === undefined ? inv.total_minor : Math.round(a.amount * f);
    inv.paid_minor = paid;
    inv.paid_date = a.paid_date ?? isoDate();
    inv.status = paid >= inv.total_minor ? "paid" : paid > 0 ? "partial" : "unpaid";
    setInvoices(all);
    const bal = inv.total_minor - inv.paid_minor;
    return ok(`${inv.number} marked ${inv.status} on ${inv.paid_date}. Received ${formatMoney(inv.paid_minor, inv.currency)}` +
      (bal > 0 ? `, balance due ${formatMoney(bal, inv.currency)}.` : "."));
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("invoice_pdf", {
  title: "Render invoice PDF",
  description: "Render an invoice as an A4 PDF you can send: issuer block, client block, dates, item table with wrapped descriptions, subtotal, discount, tax lines per rate, total, payment details and notes. Returns the file path.",
  inputSchema: {
    number: z.string(),
    out_path: z.string().optional().describe("Where to write the PDF. Defaults to the data directory"),
  },
}, async (a) => {
  try {
    const inv = getInvoices().find((i) => i.number === a.number);
    if (!inv) return fail(`no invoice numbered ${a.number}.`);
    const biz = getBusiness();
    const pro = gate.isPro();
    const out = expandPath(a.out_path ?? join(dataDir(), "pdf", `${inv.number}.pdf`));
    await renderInvoicePdf(inv, biz, out, { branded: !pro, logo: pro });
    let note = "";
    if (!pro) {
      note = `\n\nFree tier: the PDF carries the line "Generated with mcp-invoice by theluckystrike" and no logo. ` +
        gate.upgradeText("unbranded PDFs with your logo");
    } else if (biz.logo_path && !existsSync(biz.logo_path)) {
      note = `\n\nNote: logo_path ${biz.logo_path} does not exist, rendered without it.`;
    }
    return ok(`Wrote ${out}${note}`);
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("overdue_report", {
  title: "Overdue report",
  description: "List every unpaid or partly paid invoice past its due date with days overdue, plus outstanding totals per currency. Pro.",
  inputSchema: { as_of: z.string().optional().describe("YYYY-MM-DD, defaults to today") },
}, async (a) => {
  try {
    if (!gate.isPro()) return ok(gate.upgradeText("overdue_report"));
    const today = a.as_of ?? isoDate();
    const rows = getInvoices()
      .filter((i) => i.status !== "paid" && i.due_date < today)
      .map((i) => ({
        number: i.number, client: i.client.name, due_date: i.due_date,
        days_overdue: daysBetween(i.due_date, today),
        outstanding: formatMoney(i.total_minor - i.paid_minor, i.currency),
        outstanding_minor: i.total_minor - i.paid_minor, currency: i.currency,
      }))
      .sort((x, y) => y.days_overdue - x.days_overdue);
    const totals: Record<string, number> = {};
    for (const r of rows) totals[r.currency] = (totals[r.currency] ?? 0) + r.outstanding_minor;
    return json({
      as_of: today, count: rows.length, invoices: rows,
      totals_per_currency: Object.entries(totals).map(([c, v]) => formatMoney(v, c)),
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ----------------------------------------------------------------- resources */

server.registerResource("open-invoices", "invoices://open", {
  title: "Open invoices",
  description: "Every unpaid or partly paid invoice as JSON, with the balance due.",
  mimeType: "application/json",
}, async (uri) => ({
  contents: [{
    uri: uri.href, mimeType: "application/json",
    text: JSON.stringify(
      getInvoices().filter((i) => i.status !== "paid").map(summarize), null, 2),
  }],
}));

gate.registerTools(server as unknown as { registerTool: Function });

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-invoice ready (${gate.isPro() ? "pro" : "free"}), data in ${dataDir()}\n`);
