import { formatMoney, type ComputedLine, type TaxLine } from "@theluckystrike/mcp-invoice/lib";

/**
 * The pasteable plain-text body, shared by credit_note_text and purchase_order_text.
 *
 * The totals block right-aligns its LABEL against a column computed from the line layout
 * rather than against the description width, so the amount column lands in the same place
 * whatever the descriptions are. That is the alignment defect fixed in servers/quotes
 * (docs/QUOTES_RESULT.md): padding the totals against the description column pushed
 * "VAT 23% on EUR 1800.00" twelve characters right of the line amounts in the email.
 */

export interface TextDoc {
  currency: string;
  lines: ComputedLine[];
  subtotal_minor: number;
  discount_percent: number;
  discount_minor: number;
  net_minor: number;
  tax_lines: TaxLine[];
  total_minor: number;
}

const pad = (s: string, n: number) => s.length >= n ? s : s + " ".repeat(n - s.length);
const padL = (s: string, n: number) => s.length >= n ? s : " ".repeat(n - s.length) + s;

export function bodyLines(d: TextDoc, totalLabel: string): string[] {
  const cur = d.currency;
  const descW = Math.min(40, Math.max(12, ...d.lines.map((l) => l.description.length)));
  const rows = d.lines.map((l) =>
    `  ${pad(l.description.slice(0, descW), descW)}  ${padL(String(l.quantity), 6)} x ${padL(formatMoney(l.unit_price_minor, cur), 14)}  ${padL(formatMoney(l.gross_minor, cur), 14)}`);
  const labels = ["Subtotal", totalLabel, `Discount ${d.discount_percent}%`, "Net",
    ...d.tax_lines.map((t) => `VAT ${t.rate}% on ${formatMoney(t.base_minor, cur)}`)];
  const labelW = Math.max(descW + 25, ...labels.map((s) => s.length));
  const totalRow = (label: string, value: string) => `  ${padL(label, labelW)}  ${padL(value, 14)}`;

  const out = [...rows, ""];
  out.push(totalRow("Subtotal", formatMoney(d.subtotal_minor, cur)));
  if (d.discount_minor) {
    out.push(totalRow(`Discount ${d.discount_percent}%`, formatMoney(-d.discount_minor, cur)));
    out.push(totalRow("Net", formatMoney(d.net_minor, cur)));
  }
  for (const t of d.tax_lines) {
    if (!t.rate && !t.tax_minor) continue;
    out.push(totalRow(`VAT ${t.rate}% on ${formatMoney(t.base_minor, cur)}`, formatMoney(t.tax_minor, cur)));
  }
  out.push(totalRow(totalLabel, formatMoney(d.total_minor, cur)));
  return out;
}
