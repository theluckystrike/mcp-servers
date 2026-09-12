import type { Sale } from "./store.js";
import { formatMoney } from "./lib.js";

/**
 * The two renderings of one document. Markdown is for the chat and the repo; the HTML is
 * a single self-contained file with every style inline, so it prints to PDF from any
 * browser with no network and no asset beside it. Both carry signature lines, because a
 * bill of sale that cannot be signed is a quote.
 */

const DISCLAIMER =
  "This is a generic template document, not legal advice. Bills of sale for vehicles, boats and regulated goods may have statutory form or filing requirements where the sale happens.";

const AS_IS_CLAUSE =
  "The item is sold AS IS, WHERE IS, with all faults. The seller makes no warranties, express or implied, including any implied warranty of merchantability or fitness for a particular purpose, except as stated in this document.";

const TRANSFER_CLAUSE =
  "The seller certifies that they are the legal owner of the item described above, that it is free of liens and encumbrances except as noted, and that ownership transfers to the buyer on receipt of the payment stated above.";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function partyLines(p: { name: string; address?: string; email?: string; phone?: string }): string[] {
  const lines = [p.name];
  if (p.address) lines.push(p.address);
  const contact = [p.email, p.phone].filter(Boolean).join(" · ");
  if (contact) lines.push(contact);
  return lines;
}

function identifierRows(s: Sale): [string, string][] {
  const ids = s.item.identifiers ?? {};
  const rows: [string, string][] = [];
  if (ids.vin) rows.push(["VIN", ids.vin]);
  if (ids.serial) rows.push(["Serial number", ids.serial]);
  if (ids.imei) rows.push(["IMEI", ids.imei]);
  if (ids.other) rows.push(["Other identifier", ids.other]);
  return rows;
}

export function renderMarkdown(s: Sale): string {
  const out: string[] = [];
  out.push(`# BILL OF SALE`);
  out.push("");
  if (s.status === "draft") out.push(`**DRAFT -- NOT FINALIZED. This copy is for review; it is not the signing copy.**`);
  if (s.status === "draft") out.push("");
  out.push(`Document: **${s.id}**  `);
  out.push(`Date of sale: **${s.date}**${s.finalized_on ? `  \nFinalized: ${s.finalized_on.slice(0, 10)}` : ""}`);
  out.push("");
  out.push(`## Seller`);
  out.push("");
  for (const l of partyLines(s.seller)) out.push(`${l}  `);
  out.push("");
  out.push(`## Buyer`);
  out.push("");
  for (const l of partyLines(s.buyer)) out.push(`${l}  `);
  out.push("");
  out.push(`## Item`);
  out.push("");
  out.push(`| | |`);
  out.push(`| --- | --- |`);
  out.push(`| Description | ${s.item.description} |`);
  if (s.item.category) out.push(`| Category | ${s.item.category} |`);
  if (s.item.quantity !== 1) out.push(`| Quantity | ${s.item.quantity} |`);
  if (s.item.condition) out.push(`| Condition | ${s.item.condition} |`);
  for (const [k, v] of identifierRows(s)) out.push(`| ${k} | ${v} |`);
  out.push("");
  out.push(`## Price`);
  out.push("");
  out.push(`**${formatMoney(s.price_minor, s.currency)}**${s.item.quantity !== 1 ? ` for ${s.item.quantity} units` : ""}`);
  out.push("");
  out.push(`## Terms`);
  out.push("");
  out.push(TRANSFER_CLAUSE);
  out.push("");
  if (s.as_is) {
    out.push(AS_IS_CLAUSE);
    out.push("");
  }
  if (s.warranty) {
    out.push(`**Warranty.** ${s.warranty}`);
    out.push("");
  }
  if (s.notes) {
    out.push(`**Notes.** ${s.notes}`);
    out.push("");
  }
  out.push(`## Signatures`);
  out.push("");
  out.push(`| | Seller | Buyer |`);
  out.push(`| --- | --- | --- |`);
  out.push(`| Signature | ______________________________ | ______________________________ |`);
  out.push(`| Printed name | ______________________________ | ______________________________ |`);
  out.push(`| Date | ______________________________ | ______________________________ |`);
  out.push("");
  out.push(`---`);
  out.push(`*${DISCLAIMER}*`);
  out.push("");
  return out.join("\n");
}

function htmlParty(label: string, p: { name: string; address?: string; email?: string; phone?: string }): string {
  const rows = partyLines(p).map((l, i) => (i === 0 ? `<div class="pname">${esc(l)}</div>` : `<div class="pline">${esc(l)}</div>`));
  return `<div class="party"><div class="plabel">${label}</div>${rows.join("")}</div>`;
}

export function renderHtml(s: Sale): string {
  const ids = identifierRows(s);
  const itemRows: string[] = [];
  itemRows.push(`<tr><th>Description</th><td>${esc(s.item.description)}</td></tr>`);
  if (s.item.category) itemRows.push(`<tr><th>Category</th><td>${esc(s.item.category)}</td></tr>`);
  if (s.item.quantity !== 1) itemRows.push(`<tr><th>Quantity</th><td>${s.item.quantity}</td></tr>`);
  if (s.item.condition) itemRows.push(`<tr><th>Condition</th><td>${esc(s.item.condition)}</td></tr>`);
  for (const [k, v] of ids) itemRows.push(`<tr><th>${esc(k)}</th><td class="mono">${esc(v)}</td></tr>`);

  const terms: string[] = [`<p>${esc(TRANSFER_CLAUSE)}</p>`];
  if (s.as_is) terms.push(`<p>${esc(AS_IS_CLAUSE)}</p>`);
  if (s.warranty) terms.push(`<p><strong>Warranty.</strong> ${esc(s.warranty)}</p>`);
  if (s.notes) terms.push(`<p><strong>Notes.</strong> ${esc(s.notes)}</p>`);

  const watermark = s.status === "draft" ? `<div class="watermark">DRAFT</div>` : "";
  const watermarkCss = s.status === "draft"
    ? `.watermark { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-24deg);
    font-size: 110px; font-weight: bold; letter-spacing: 12px; color: rgba(170, 40, 40, 0.10);
    pointer-events: none; white-space: nowrap; }`
    : "";
  const draftnote = s.status === "draft"
    ? `<p class="draftnote">DRAFT -- NOT FINALIZED. This copy is for review; it is not the signing copy.</p>`
    : "";

  const sigCell = `<td><div class="sigline"></div><div class="sigcap">Signature</div><div class="sigline"></div><div class="sigcap">Printed name</div><div class="sigline"></div><div class="sigcap">Date</div></td>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bill of Sale ${esc(s.id)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; margin: 0; background: #fff; }
  .page { max-width: 720px; margin: 32px auto; padding: 48px 56px; position: relative; }
  h1 { font-size: 26px; letter-spacing: 4px; text-align: center; margin: 0 0 4px; text-transform: uppercase; }
  .docmeta { text-align: center; color: #444; font-size: 13px; margin-bottom: 28px; }
  .docmeta .docid { font-weight: bold; color: #1a1a1a; }
  .parties { display: flex; gap: 24px; margin-bottom: 24px; }
  .party { flex: 1; border: 1px solid #bbb; padding: 14px 16px; }
  .plabel { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #666; margin-bottom: 6px; }
  .pname { font-size: 16px; font-weight: bold; }
  .pline { font-size: 13px; color: #333; margin-top: 2px; }
  table.item { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  table.item th, table.item td { border: 1px solid #bbb; padding: 8px 12px; font-size: 14px; text-align: left; vertical-align: top; }
  table.item th { width: 180px; background: #f4f4f4; font-weight: bold; }
  .mono { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 13px; }
  .price { border: 2px solid #1a1a1a; padding: 14px 16px; font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 24px; }
  .terms { font-size: 13px; line-height: 1.55; color: #222; margin-bottom: 32px; }
  .terms p { margin: 0 0 10px; }
  table.sigs { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.sigs th { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #666; text-align: left; padding: 0 8px 6px; }
  table.sigs td { width: 50%; padding: 0 8px; vertical-align: top; }
  .sigline { border-bottom: 1px solid #1a1a1a; height: 34px; }
  .sigcap { font-size: 11px; color: #555; margin: 4px 0 14px; }
  .disclaimer { font-size: 11px; color: #777; border-top: 1px solid #ccc; margin-top: 36px; padding-top: 10px; line-height: 1.5; }
  .draftnote { text-align: center; color: #a33; font-weight: bold; font-size: 13px; margin: 0 0 20px; }
  ${watermarkCss}
  @media print { .page { margin: 0 auto; padding: 24px 32px; } }
</style>
</head>
<body>
<div class="page">
  ${watermark}
  <h1>Bill of Sale</h1>
  <div class="docmeta"><span class="docid">${esc(s.id)}</span> &middot; Date of sale: <strong>${esc(s.date)}</strong>${s.finalized_on ? ` &middot; Finalized ${esc(s.finalized_on.slice(0, 10))}` : ""}</div>
  ${draftnote}
  <div class="parties">
    ${htmlParty("Seller", s.seller)}
    ${htmlParty("Buyer", s.buyer)}
  </div>
  <table class="item"><tbody>${itemRows.join("")}</tbody></table>
  <div class="price">${esc(formatMoney(s.price_minor, s.currency))}${s.item.quantity !== 1 ? ` for ${s.item.quantity} units` : ""}</div>
  <div class="terms">${terms.join("")}</div>
  <table class="sigs">
    <tr><th>Seller</th><th>Buyer</th></tr>
    <tr>${sigCell}${sigCell}</tr>
  </table>
  <div class="disclaimer">${esc(DISCLAIMER)}</div>
</div>
</body>
</html>
`;
}
