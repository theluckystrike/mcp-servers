/**
 * Remote replacement for servers/invoice/src/pdf.ts. pdfkit needs a real
 * filesystem for its AFM metrics and a writable stream; on Workers the invoice
 * is rendered as a self-contained, print-to-PDF-ready HTML document that is
 * stored in KV under a one-time token and served for one hour.
 */
import { formatMoney } from "../vendor/invoice/money.js";
import type { Business, Invoice } from "../vendor/invoice/store.js";
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
