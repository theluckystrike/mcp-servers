import { formatMoney } from "@theluckystrike/mcp-asset-register/lib";
import {
  accruedFeeMinor, addDays, daysLate, outstandingMinor, STAGE_NAMES,
  type ChasedInvoice, type Stage,
} from "./engine.js";

/**
 * The three chase letters. One block list is built per letter and then serialised to
 * Markdown or to self-contained printable HTML, so the two formats can never drift: they
 * are the same paragraphs. Nothing is emailed or transmitted anywhere; the text is the
 * whole product and sending it is the user's act.
 */

export interface Sender { name?: string; email?: string }

export interface RenderedLetter {
  stage: Stage;
  stage_name: string;
  /** The date the letter is written, which is also the date fees are accrued to. */
  on: string;
  subject: string;
  /** Set only on the final notice: the payment deadline the letter names, on + 7 days. */
  deadline?: string;
  outstanding_minor: number;
  fee_minor: number;
  total_minor: number;
  markdown: string;
  html: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** One paragraph of plain text, with any control characters stripped out. */
function para(s: string): string {
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim();
}

function senderName(sender: Sender): string {
  const n = (sender.name ?? "").trim();
  return n || "[Your name]";
}

function senderLine(sender: Sender): string {
  const bits = [senderName(sender)];
  const e = (sender.email ?? "").trim();
  if (e) bits.push(e);
  return bits.join(" · ");
}

/** The date of the last sent letter of a stage, for "despite my reminder of ...". */
function sentOn(inv: ChasedInvoice, stage: Stage): string | undefined {
  return inv.letters.filter((l) => l.stage === stage).map((l) => l.sent).sort().pop();
}

function invoiceFacts(inv: ChasedInvoice): string {
  const bits = [`invoice ${inv.reference}`, `due ${inv.due}`];
  if (inv.issued) bits.push(`issued ${inv.issued}`);
  bits.push(`amount ${formatMoney(inv.amount_minor, inv.currency)}`);
  return bits.join(", ");
}

function blocks(inv: ChasedInvoice, stage: Stage, on: string, sender: Sender): { subject: string; deadline?: string; body: string[] } {
  const money = (m: number) => formatMoney(m, inv.currency);
  const outstanding = outstandingMinor(inv);
  const late = daysLate(inv, on);
  const fee = accruedFeeMinor(inv, on);
  const total = outstanding + fee;
  const dear = `Dear ${inv.client},`;
  const sign = stage === 3 ? `Yours faithfully,\n\n${senderLine(sender)}` : `Yours sincerely,\n\n${senderLine(sender)}`;

  if (stage === 1) {
    return {
      subject: `Payment reminder: invoice ${inv.reference} for ${money(outstanding)}`,
      body: [
        dear,
        `I hope you are well. This is a polite reminder that invoice ${inv.reference} for ${money(outstanding)}, which fell due on ${inv.due}, ${late > 0 ? `is now ${late} day${late === 1 ? "" : "s"} past due` : "falls due shortly"}.`,
        inv.payments.length
          ? `You have paid ${money(inv.amount_minor - outstanding)} towards it; the balance still open is ${money(outstanding)}.`
          : `The full amount of ${money(outstanding)} is still open.`,
        `If payment is already on its way, please disregard this note and accept my thanks. Otherwise I would be grateful if you could arrange payment of ${money(outstanding)} within the next few days.`,
        `For reference: ${invoiceFacts(inv)}.`,
        sign,
      ],
    };
  }

  if (stage === 2) {
    const first = sentOn(inv, 1);
    return {
      subject: `Second reminder: invoice ${inv.reference} is ${late} days overdue`,
      body: [
        dear,
        `${first ? `Despite my reminder of ${first}, invoice` : "Invoice"} ${inv.reference} for ${money(outstanding)}, due ${inv.due}, remains unpaid. Payment is now ${late} days overdue.`,
        inv.payments.length
          ? `I have received ${money(inv.amount_minor - outstanding)} towards it; the balance of ${money(outstanding)} is what is due.`
          : `Please arrange payment of ${money(outstanding)} immediately.`,
        inv.late_fee_percent_per_month
          ? `Under our agreed terms, late payment interest accrues at ${inv.late_fee_percent_per_month}% per month (simple, pro-rata). Accrued to ${on}, that adds ${money(fee)}, bringing the total now due to ${money(total)}.`
          : `Our terms provide for late payment interest on overdue amounts; please settle promptly so that none has to be charged.`,
        `If there is a problem with the invoice, please tell me today so it can be resolved. Otherwise I expect payment within 7 days.`,
        `For reference: ${invoiceFacts(inv)}.`,
        sign,
      ],
    };
  }

  const first = sentOn(inv, 1);
  const second = sentOn(inv, 2);
  const deadline = addDays(on, 7);
  const prior = [first, second].filter(Boolean) as string[];
  return {
    subject: `Final notice before further action: invoice ${inv.reference}`,
    deadline,
    body: [
      dear,
      `${prior.length ? `Despite my earlier reminder${prior.length > 1 ? "s" : ""} of ${prior.join(" and ")}, invoice` : "Invoice"} ${inv.reference} for ${money(outstanding)}, due ${inv.due}, remains unpaid. Payment is now ${late} days overdue.`,
      fee > 0
        ? `With late payment interest of ${money(fee)} accrued to ${on}, the total now due is ${money(total)}.`
        : `The amount due is ${money(outstanding)}.`,
      `This letter is formal notice that unless payment of ${money(total)} is received by ${deadline}, I will take further steps to recover the debt without further warning. That may include instructing a debt collection agency or starting a court claim, and may add costs, fees and interest for which you may be held liable.`,
      `If you dispute this invoice, please set out the grounds in writing by ${deadline}.`,
      `For reference: ${invoiceFacts(inv)}.`,
      sign,
    ],
  };
}

function toMarkdown(subject: string, body: string[]): string {
  return [`# ${subject}`, "", ...body.flatMap((b) => [b, ""])].join("\n").trimEnd() + "\n";
}

/**
 * Self-contained printable HTML: no external fonts, scripts or images, one inline style
 * block, a print rule that keeps the letter to one column of readable measure. Every
 * interpolated value is HTML-escaped.
 */
function toHtml(subject: string, body: string[]): string {
  const paras = body
    .map((b) => `<p>${esc(b).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>${esc(subject)}</title>`,
    "<style>",
    "body{font-family:Georgia,'Times New Roman',serif;max-width:42rem;margin:3rem auto;padding:0 1.25rem;line-height:1.55;color:#111}",
    "h1{font-size:1.25rem;border-bottom:1px solid #999;padding-bottom:.5rem}",
    "p{margin:.9rem 0}",
    "@media print{body{margin:0;max-width:none}}",
    "</style>",
    "</head>",
    "<body>",
    `<h1>${esc(subject)}</h1>`,
    paras,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

export function renderLetter(inv: ChasedInvoice, stage: Stage, on: string, sender: Sender): RenderedLetter {
  const { subject, deadline, body } = blocks(inv, stage, on, sender);
  const clean = body.map(para);
  const outstanding = outstandingMinor(inv);
  const fee = accruedFeeMinor(inv, on);
  return {
    stage,
    stage_name: STAGE_NAMES[stage],
    on,
    subject,
    deadline,
    outstanding_minor: outstanding,
    fee_minor: fee,
    total_minor: outstanding + fee,
    markdown: toMarkdown(subject, clean),
    html: toHtml(subject, clean),
  };
}
