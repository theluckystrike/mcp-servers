import { formatAmount, formatMoney, formatQuantity, formatRate } from "./money.js";
import { reasonLabel, taxLinesOf, type CreditNote } from "./note.js";

/**
 * Render a credit note as a document. Two formats:
 *  - markdown: a pipe-table document to paste into an email, a ticket or a README.
 *  - html: a SELF-CONTAINED printable page. Every style is inline in one <style> block,
 *    there is no external reference of any kind, and every user string passes through
 *    escapeHtml, so the file is safe to save and print as-is.
 *
 * A draft renders with a DRAFT banner: a document a client can mistake for the real
 * thing is how a half-finished credit gets sent.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function heading(n: CreditNote): string {
  return n.status === "final" && n.number ? n.number : `DRAFT ${n.id}`;
}

function detailLines(n: CreditNote): string[] {
  const out: string[] = [];
  if (n.invoice_ref) out.push(n.invoice_ref);
  out.push(reasonLabel(n.reason) + (n.reason_detail ? `: ${n.reason_detail}` : ""));
  return out;
}

export function renderMarkdown(n: CreditNote, footer: string | null): string {
  const lines: string[] = [];
  lines.push(`# CREDIT NOTE ${heading(n)}`);
  lines.push("");
  if (n.status === "draft") lines.push(`> DRAFT - not issued. Finalize before sending.`);
  if (n.status === "draft") lines.push("");
  lines.push(`**Issue date:** ${n.issue_date}  `);
  lines.push(`**Credit to:** ${n.recipient}  `);
  if (n.invoice_ref) lines.push(`**Against invoice:** ${n.invoice_ref}  `);
  lines.push(`**Reason:** ${reasonLabel(n.reason)}${n.reason_detail ? ` - ${n.reason_detail}` : ""}  `);
  lines.push(`**Currency:** ${n.currency}`);
  lines.push("");
  lines.push(`| Description | Qty | Unit price | Tax | Amount |`);
  lines.push(`| --- | ---: | ---: | ---: | ---: |`);
  for (const l of n.lines) {
    lines.push(`| ${l.description} | ${formatQuantity(l.quantity)} | ${formatAmount(l.unit_price_minor, n.currency)} | ${formatRate(l.tax_rate)} | ${formatAmount(l.gross_minor, n.currency)} |`);
  }
  lines.push("");
  lines.push(`**Subtotal:** ${formatMoney(n.subtotal_minor, n.currency)}  `);
  for (const t of taxLinesOf(n.lines)) {
    if (t.rate !== 0) lines.push(`**Tax ${formatRate(t.rate)} on ${formatAmount(t.base_minor, n.currency)}:** ${formatMoney(t.tax_minor, n.currency)}  `);
  }
  lines.push(`**Total credited:** ${formatMoney(n.total_minor, n.currency)}`);
  if (n.notes) {
    lines.push("");
    lines.push(`**Notes:** ${n.notes}`);
  }
  if (footer) {
    lines.push("");
    lines.push(`---`);
    lines.push(footer);
  }
  return lines.join("\n") + "\n";
}

export function renderHtml(n: CreditNote, footer: string | null): string {
  const cur = n.currency;
  const rows = n.lines.map((l) => `      <tr>
        <td>${escapeHtml(l.description)}</td>
        <td class="num">${formatQuantity(l.quantity)}</td>
        <td class="num">${formatAmount(l.unit_price_minor, cur)}</td>
        <td class="num">${formatRate(l.tax_rate)}</td>
        <td class="num">${formatAmount(l.gross_minor, cur)}</td>
      </tr>`).join("\n");
  const taxRows = taxLinesOf(n.lines).filter((t) => t.rate !== 0).map((t) => `      <tr class="totals">
        <td colspan="4">Tax ${formatRate(t.rate)} on ${formatAmount(t.base_minor, cur)}</td>
        <td class="num">${formatAmount(t.tax_minor, cur)}</td>
      </tr>`).join("\n");
  const draft = n.status === "draft"
    ? `  <div class="draft">DRAFT - not issued. Finalize before sending.</div>\n`
    : "";
  const against = n.invoice_ref
    ? `    <p><span class="label">Against invoice:</span> ${escapeHtml(n.invoice_ref)}</p>\n`
    : "";
  const notes = n.notes
    ? `  <section class="notes"><h2>Notes</h2><p>${escapeHtml(n.notes).replace(/\n/g, "<br>")}</p></section>\n`
    : "";
  const foot = footer ? `  <footer>${escapeHtml(footer)}</footer>\n` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Credit note ${escapeHtml(heading(n))}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; margin: 0; padding: 2.5rem; max-width: 800px; margin-left: auto; margin-right: auto; }
  h1 { font-size: 1.4rem; letter-spacing: 0.04em; margin: 0 0 0.25rem; }
  h2 { font-size: 1rem; margin: 1.5rem 0 0.25rem; }
  header { border-bottom: 2px solid #111; padding-bottom: 0.75rem; margin-bottom: 1rem; }
  .label { color: #555; display: inline-block; min-width: 9.5rem; }
  p { margin: 0.15rem 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid #ccc; }
  th { border-bottom: 2px solid #111; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.totals td { border-bottom: none; }
  tr.totals td:first-child { text-align: right; color: #555; }
  tr.grand td { border-top: 2px solid #111; border-bottom: none; font-weight: 700; font-size: 1.05rem; }
  .draft { margin: 1rem 0; padding: 0.6rem 0.8rem; border: 2px dashed #b00; color: #b00; font-weight: 700; text-align: center; letter-spacing: 0.08em; }
  .notes { margin-top: 1.5rem; }
  footer { margin-top: 2.5rem; padding-top: 0.75rem; border-top: 1px solid #ccc; color: #777; font-size: 0.8rem; }
  @media print { body { padding: 0; max-width: none; } }
</style>
</head>
<body>
  <header>
    <h1>CREDIT NOTE</h1>
    <p><strong>${escapeHtml(heading(n))}</strong></p>
  </header>
${draft}  <section>
    <p><span class="label">Issue date:</span> ${n.issue_date}</p>
    <p><span class="label">Credit to:</span> <strong>${escapeHtml(n.recipient)}</strong></p>
${against}    <p><span class="label">Reason:</span> ${escapeHtml(reasonLabel(n.reason))}${n.reason_detail ? ` - ${escapeHtml(n.reason_detail)}` : ""}</p>
    <p><span class="label">Currency:</span> ${cur}</p>
  </section>
  <table>
    <thead>
      <tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Tax</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>
${rows}
      <tr class="totals">
        <td colspan="4">Subtotal</td>
        <td class="num">${formatAmount(n.subtotal_minor, cur)}</td>
      </tr>
${taxRows}
      <tr class="grand">
        <td colspan="4">Total credited (${cur})</td>
        <td class="num">${formatAmount(n.total_minor, cur)}</td>
      </tr>
    </tbody>
  </table>
${notes}${foot}</body>
</html>
`;
}
