/**
 * Remote replacement for servers/invoice/src/pdf.ts. pdfkit needs a real
 * filesystem for its AFM metrics and a writable stream; on Workers the invoice
 * is rendered as a self-contained, print-to-PDF-ready HTML document that is
 * stored in KV under a one-time token and served for one hour.
 */
import { formatMoney } from "../vendor/invoice/money.js";
import type { ComputedLine, TaxLine } from "../vendor/invoice/money.js";
import type { Business, Invoice } from "../vendor/invoice/store.js";
import type { Quote } from "../vendor/quotes/store.js";
import { ctx } from "./ctx.js";

export interface RenderOptions { branded: boolean; logo: boolean }

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function qtyText(q: number): string {
  return Number.isInteger(q) ? String(q) : String(Number(q.toFixed(4)));
}

function token(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function renderInvoicePdf(
  inv: Invoice, biz: Business, filename: string, opts: RenderOptions,
): Promise<string> {
  const cur = inv.currency;
  const m = (v: number) => esc(formatMoney(v, cur));
  const rows = inv.lines.map((l: any) => `<tr>
<td>${esc(l.description)}</td><td class="n">${esc(qtyText(l.quantity))}</td>
<td class="n">${m(l.unit_price_minor)}</td><td class="n">${esc(l.tax_rate)}%</td>
<td class="n">${m(l.net_minor)}</td></tr>`).join("\n");
  const taxRows = inv.tax_lines.map((t) =>
    `<tr><td colspan="4" class="n">Tax ${esc(t.rate)}% on ${m(t.base_minor)}</td><td class="n">${m(t.tax_minor)}</td></tr>`).join("\n");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Invoice ${esc(inv.number)}</title>
<style>@page{size:A4;margin:18mm}
body{font:13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#111;max-width:760px;margin:0 auto;padding:24px}
h1{font-size:24px;margin:0 0 4px}.muted{color:#666}
.head{display:flex;justify-content:space-between;gap:32px;margin-bottom:28px}
table{border-collapse:collapse;width:100%;margin:20px 0}
th,td{text-align:left;padding:7px 6px;border-bottom:1px solid #ccc}
td.n,th.n{text-align:right}
tfoot td{border-bottom:none}.total td{font-weight:700;border-top:2px solid #111}
footer{margin-top:36px;font-size:11px;color:#666}
@media print{body{padding:0}}</style></head><body>
<div class="head"><div><h1>INVOICE ${esc(inv.number)}</h1>
<div class="muted">Issued ${esc(inv.issue_date)} &middot; Due ${esc(inv.due_date)} &middot; ${esc(inv.status)}</div></div>
<div><strong>${esc(biz.name)}</strong><br>${esc(biz.address ?? "").replace(/\n/g, "<br>")}
${biz.vat_id ? `<br>VAT ${esc(biz.vat_id)}` : ""}${biz.email ? `<br>${esc(biz.email)}` : ""}</div></div>
<p><strong>BILL TO</strong><br>${esc(inv.client.name)}<br>${esc(inv.client.address ?? "").replace(/\n/g, "<br>")}
${inv.client.vat_id ? `<br>VAT ${esc(inv.client.vat_id)}` : ""}${inv.client.email ? `<br>${esc(inv.client.email)}` : ""}</p>
<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Tax</th><th class="n">Amount</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="4" class="n">Subtotal</td><td class="n">${m(inv.subtotal_minor)}</td></tr>
${inv.discount_minor ? `<tr><td colspan="4" class="n">Discount ${esc(inv.discount_percent)}%</td><td class="n">-${m(inv.discount_minor)}</td></tr>` : ""}
${taxRows}
<tr class="total"><td colspan="4" class="n">TOTAL</td><td class="n">${m(inv.total_minor)}</td></tr>
${inv.paid_minor ? `<tr><td colspan="4" class="n">Paid</td><td class="n">${m(inv.paid_minor)}</td></tr>
<tr><td colspan="4" class="n">Balance due</td><td class="n">${m(inv.total_minor - inv.paid_minor)}</td></tr>` : ""}
</tfoot></table>
${inv.notes ? `<p>${esc(inv.notes).replace(/\n/g, "<br>")}</p>` : ""}
${biz.iban ? `<p class="muted">Payment: ${esc(biz.bank ?? "")} IBAN ${esc(biz.iban)}</p>` : ""}
<footer>${opts.branded ? "Generated with mcp-invoice by theluckystrike" : ""}</footer>
</body></html>`;

  const c = ctx();
  const t = token();
  c.downloads.push({ token: t, mime: "text/html; charset=utf-8", body: html, filename });
  return `${c.baseUrl}/mcp/download/${t}`;
}

/**
 * The same treatment for servers/quotes/src/pdf.ts, which is pdfkit for the same reason.
 * A quote is not an invoice - the title, the validity line in place of a due date and the
 * acceptance block are what a client reads first - so this is a second renderer beside
 * renderInvoicePdf rather than a flag on it, exactly as it is over stdio. Both land in
 * the same one-hour download, and the vendored servers/quotes/src/lib.ts re-exports these
 * two names instead of its own ./pdf.js.
 */
export interface RenderQuoteOptions { branded: boolean; logo: boolean; expired: boolean }

export async function renderQuotePdf(
  q: Quote, biz: Business, filename: string, opts: RenderQuoteOptions,
): Promise<string> {
  const cur = q.currency;
  const m = (v: number) => esc(formatMoney(v, cur));
  const state = q.status === "open" ? (opts.expired ? "EXPIRED" : "OPEN") : q.status.toUpperCase();
  const rows = q.lines.map((l: any) => `<tr>
<td>${esc(l.description)}</td><td class="n">${esc(qtyText(l.quantity))}</td>
<td class="n">${m(l.unit_price_minor)}</td><td class="n">${l.tax_rate ? `${esc(l.tax_rate)}%` : "-"}</td>
<td class="n">${m(l.gross_minor)}</td></tr>`).join("\n");
  const taxRows = q.tax_lines.filter((t) => t.rate || t.tax_minor).map((t) =>
    `<tr><td colspan="4" class="n">Tax ${esc(t.rate)}% on ${m(t.base_minor)}</td><td class="n">${m(t.tax_minor)}</td></tr>`).join("\n");
  const accept = [
    `This quote is valid until ${esc(q.valid_until)}.`,
    "To accept, reply to this document and it will be invoiced as quoted.",
    q.invoice_number ? `Accepted and invoiced as ${esc(q.invoice_number)}.` : "",
  ].filter(Boolean).join("<br>");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Quote ${esc(q.id)}</title>
<style>@page{size:A4;margin:18mm}
body{font:13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#111;max-width:760px;margin:0 auto;padding:24px}
h1{font-size:24px;margin:0 0 4px}.muted{color:#666}
.head{display:flex;justify-content:space-between;gap:32px;margin-bottom:28px}
table{border-collapse:collapse;width:100%;margin:20px 0}
th,td{text-align:left;padding:7px 6px;border-bottom:1px solid #ccc}
td.n,th.n{text-align:right}
tfoot td{border-bottom:none}.total td{font-weight:700;border-top:2px solid #111}
.accept{border:1px solid #ccc;border-radius:6px;padding:10px 12px;margin-top:24px}
footer{margin-top:36px;font-size:11px;color:#666}
@media print{body{padding:0}}</style></head><body>
<div class="head"><div><h1>QUOTE ${esc(q.id)}</h1>
<div class="muted">Quoted ${esc(q.issue_date)} &middot; Valid until ${esc(q.valid_until)} &middot; ${esc(state)}</div></div>
<div><strong>${esc(biz.name)}</strong><br>${esc(biz.address ?? "").replace(/\n/g, "<br>")}
${biz.vat_id ? `<br>VAT ${esc(biz.vat_id)}` : ""}${biz.email ? `<br>${esc(biz.email)}` : ""}</div></div>
<p><strong>QUOTE FOR</strong><br>${esc(q.client.name)}<br>${esc(q.client.address ?? "").replace(/\n/g, "<br>")}
${q.client.vat_id ? `<br>VAT ${esc(q.client.vat_id)}` : ""}${q.client.email ? `<br>${esc(q.client.email)}` : ""}</p>
<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Tax</th><th class="n">Amount</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="4" class="n">Subtotal</td><td class="n">${m(q.subtotal_minor)}</td></tr>
${q.discount_minor ? `<tr><td colspan="4" class="n">Discount ${esc(q.discount_percent)}%</td><td class="n">-${m(q.discount_minor)}</td></tr>
<tr><td colspan="4" class="n">Net</td><td class="n">${m(q.net_minor)}</td></tr>` : ""}
${taxRows}
<tr class="total"><td colspan="4" class="n">TOTAL</td><td class="n">${m(q.total_minor)}</td></tr>
</tfoot></table>
<div class="accept"><strong>ACCEPTANCE</strong><br>${accept}</div>
${q.notes ? `<p>${esc(q.notes).replace(/\n/g, "<br>")}</p>` : ""}
<footer>${esc(biz.name ?? "")}${biz.vat_id ? ` | VAT ID ${esc(biz.vat_id)}` : ""} | Quote ${esc(q.id)}
${opts.branded ? "<br>Generated with mcp-quotes by theluckystrike" : ""}</footer>
</body></html>`;

  const c = ctx();
  const t = token();
  c.downloads.push({ token: t, mime: "text/html; charset=utf-8", body: html, filename });
  return `${c.baseUrl}/mcp/download/${t}`;
}

/**
 * The same treatment for servers/billing-docs/src/pdf.ts, which is pdfkit for the same
 * reason the other two are. That renderer already takes the document-specific parts as
 * arguments - the title, the reference line under the number, the party label, the meta
 * rows and the block that stands where the invoice prints PAYMENT DETAILS - so this is
 * one HTML renderer for both a CREDIT NOTE and a PURCHASE ORDER rather than a fourth and
 * a fifth function, exactly as it is over stdio. The vendored
 * servers/billing-docs/src/lib.ts re-exports these names instead of its own ./pdf.js.
 */
export interface RenderDoc {
  /** Printed as the heading, e.g. "CREDIT NOTE" or "PURCHASE ORDER". */
  title: string;
  /** This document's own number. */
  number: string;
  /** Second reference line under the number, e.g. "against invoice INV-2026-0001". */
  reference?: string;
  party_label: string;
  party: { name: string; address?: string; email?: string; vat_id?: string };
  /** Label / value rows on the right of the issuer block. */
  meta: [string, string][];
  currency: string;
  lines: ComputedLine[];
  subtotal_minor: number;
  discount_percent: number;
  discount_minor: number;
  net_minor: number;
  tax_lines: TaxLine[];
  total_minor: number;
  /** The block where the invoice prints PAYMENT DETAILS. */
  footer_label: string;
  footer_lines: string[];
  notes?: string;
  /** Named in the free-tier footer credit. */
  product: string;
}

export async function renderDocPdf(
  d: RenderDoc, biz: Business, filename: string, opts: RenderOptions,
): Promise<string> {
  const cur = d.currency;
  const m = (v: number) => esc(formatMoney(v, cur));
  const label = `${d.title.charAt(0)}${d.title.slice(1).toLowerCase()} ${d.number}`;
  const rows = d.lines.map((l: any) => `<tr>
<td>${esc(l.description)}</td><td class="n">${esc(qtyText(l.quantity))}</td>
<td class="n">${m(l.unit_price_minor)}</td><td class="n">${l.tax_rate ? `${esc(l.tax_rate)}%` : "-"}</td>
<td class="n">${m(l.gross_minor)}</td></tr>`).join("\n");
  const taxRows = d.tax_lines.filter((t) => t.rate || t.tax_minor).map((t) =>
    `<tr><td colspan="4" class="n">Tax ${esc(t.rate)}% on ${m(t.base_minor)}</td><td class="n">${m(t.tax_minor)}</td></tr>`).join("\n");
  const meta = d.meta.map(([k, v]) => `<div><span class="muted">${esc(k)}</span> <strong>${esc(v)}</strong></div>`).join("\n");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(label)}</title>
<style>@page{size:A4;margin:18mm}
body{font:13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#111;max-width:760px;margin:0 auto;padding:24px}
h1{font-size:24px;margin:0 0 4px}.muted{color:#666}
.head{display:flex;justify-content:space-between;gap:32px;margin-bottom:28px}
table{border-collapse:collapse;width:100%;margin:20px 0}
th,td{text-align:left;padding:7px 6px;border-bottom:1px solid #ccc}
td.n,th.n{text-align:right}
tfoot td{border-bottom:none}.total td{font-weight:700;border-top:2px solid #111}
.block{border:1px solid #ccc;border-radius:6px;padding:10px 12px;margin-top:24px}
footer{margin-top:36px;font-size:11px;color:#666}
@media print{body{padding:0}}</style></head><body>
<div class="head"><div><h1>${esc(d.title)} ${esc(d.number)}</h1>
${d.reference ? `<div class="muted">${esc(d.reference)}</div>` : ""}
${meta}</div>
<div><strong>${esc(biz.name)}</strong><br>${esc(biz.address ?? "").replace(/\n/g, "<br>")}
${biz.vat_id ? `<br>VAT ${esc(biz.vat_id)}` : ""}${biz.email ? `<br>${esc(biz.email)}` : ""}</div></div>
<p><strong>${esc(d.party_label)}</strong><br>${esc(d.party.name)}<br>${esc(d.party.address ?? "").replace(/\n/g, "<br>")}
${d.party.vat_id ? `<br>VAT ${esc(d.party.vat_id)}` : ""}${d.party.email ? `<br>${esc(d.party.email)}` : ""}</p>
<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Tax</th><th class="n">Amount</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="4" class="n">Subtotal</td><td class="n">${m(d.subtotal_minor)}</td></tr>
${d.discount_minor ? `<tr><td colspan="4" class="n">Discount ${esc(d.discount_percent)}%</td><td class="n">${m(-d.discount_minor)}</td></tr>
<tr><td colspan="4" class="n">Net</td><td class="n">${m(d.net_minor)}</td></tr>` : ""}
${taxRows}
<tr class="total"><td colspan="4" class="n">TOTAL</td><td class="n">${m(d.total_minor)}</td></tr>
</tfoot></table>
${d.footer_lines.length ? `<div class="block"><strong>${esc(d.footer_label)}</strong><br>${d.footer_lines.map((l) => esc(l)).join("<br>")}</div>` : ""}
${d.notes ? `<p>${esc(d.notes).replace(/\n/g, "<br>")}</p>` : ""}
<footer>${esc(biz.name ?? "")}${biz.vat_id ? ` | VAT ID ${esc(biz.vat_id)}` : ""} | ${esc(label)}
${opts.branded ? `<br>Generated with ${esc(d.product)} by theluckystrike` : ""}</footer>
</body></html>`;

  const c = ctx();
  const t = token();
  c.downloads.push({ token: t, mime: "text/html; charset=utf-8", body: html, filename });
  return `${c.baseUrl}/mcp/download/${t}`;
}
