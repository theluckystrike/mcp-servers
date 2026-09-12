#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, withFileLock } from "@theluckystrike/mcp-license";
import { z } from "zod";
import { VERSION } from "./version.js";
import { formatMoney, roundHalfUp } from "./money.js";
import {
  MAX_LINES, MAX_MINOR, MAX_NAME, MAX_ROWS, MAX_TEXT, REASONS,
  computeLines, findNote, isIsoDate, reasonLabel, taxLinesOf, today, totalsOf,
  type CreditNote, type LineInput, type Reason,
} from "./note.js";
import { dataDir, getNotes, lockPath, nextId, setNotes } from "./store.js";
import { renderHtml, renderMarkdown } from "./render.js";

/**
 * Free tier: TEN finalized credit notes, lifetime.
 *
 * Finalizing is the metered act because that is what turns a draft into the document
 * the client sees. Everything else is free and unlimited: drafts, edits, deletion of
 * drafts, listing, reading, rendering and the totals. A free tier that withholds the
 * rendered document or the totals is a demo; ten real finalized credit notes is a
 * working year for a freelancer who credits an invoice now and then.
 */
const FREE_FINALS = 10;

const gate = createLicenseGate({ product: "credit-note" });

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

const str = (field: string, max: number) => z.string().max(max, `${field} must be ${max} characters or fewer`);

/** Only this server's own store is written, so there is one lock and it is this one. */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(lockPath(), fn, { timeoutMs: 20000 });
}

function checkDate(value: string, field: string): string {
  if (!isIsoDate(value)) throw new Error(`cannot read a date: ${field} "${value}" is not a real date in YYYY-MM-DD form. Nothing was written.`);
  return value;
}

const BASIS =
  "A credit note starts as a draft: editable, deletable, and with a draft id no client sees. Finalizing burns the final CN-YYYY-NNNN number and freezes the note, so the final series never has a gap from a discarded draft, and a finalized note can neither be edited nor deleted. " +
  "Every amount is an integer number of minor units: the line gross is quantity x unit price rounded half-up once, tax is rounded half-up per line, and the totals are plain sums of the rounded lines, so the printed lines always reproduce the total.";

const lineShape = {
  description: str("description", 500).describe("What is being credited, e.g. Returned: 3 x USB-C cable"),
  quantity: z.number().positive("quantity must be more than zero").max(1e6).describe("How many, e.g. 3 or 2.5 hours"),
  unit_price_minor: z.number().int("unit_price_minor must be an integer number of minor units").min(0).max(MAX_MINOR)
    .describe("Unit price in whole minor units (integer cents). 10420 is EUR 104.20"),
  tax_rate: z.number().min(0).max(100).optional().describe("Tax rate in percent, e.g. 23 for 23%. Default 0"),
};

function checkLines(raw: LineInput[]): ReturnType<typeof computeLines> {
  for (const it of raw) {
    const gross = it.quantity * it.unit_price_minor;
    if (gross > MAX_MINOR) {
      throw new Error(`the line "${it.description.trim().slice(0, 60)}" comes to ${gross} minor units, more than one line can credit. Check the quantity and the unit price. Nothing was written.`);
    }
  }
  const lines = computeLines(raw);
  const t = totalsOf(lines);
  if (t.total_minor <= 0) {
    throw new Error(`these lines credit a total of zero. A credit note that credits nothing is not a credit note. Nothing was written.`);
  }
  if (!Number.isSafeInteger(t.total_minor) || t.total_minor > MAX_MINOR) {
    throw new Error(`these lines total more than a credit note can hold. Check the quantities. Nothing was written.`);
  }
  return lines;
}

function noteJson(n: CreditNote) {
  return {
    id: n.id, number: n.number, status: n.status,
    recipient: n.recipient, invoice_ref: n.invoice_ref,
    reason: n.reason, reason_label: reasonLabel(n.reason), reason_detail: n.reason_detail,
    currency: n.currency, issue_date: n.issue_date,
    lines: n.lines.map((l) => ({
      ...l,
      unit_price: formatMoney(l.unit_price_minor, n.currency),
      gross: formatMoney(l.gross_minor, n.currency),
      tax: formatMoney(l.tax_minor, n.currency),
      total: formatMoney(l.total_minor, n.currency),
    })),
    tax_lines: taxLinesOf(n.lines).map((t) => ({ ...t, base: formatMoney(t.base_minor, n.currency), tax: formatMoney(t.tax_minor, n.currency) })),
    subtotal_minor: n.subtotal_minor, subtotal: formatMoney(n.subtotal_minor, n.currency),
    tax_minor: n.tax_minor, tax: formatMoney(n.tax_minor, n.currency),
    total_minor: n.total_minor, total: formatMoney(n.total_minor, n.currency),
    notes: n.notes,
    created: n.created, updated: n.updated, finalized_at: n.finalized_at,
  };
}

function summaryLine(n: CreditNote) {
  return {
    id: n.id, number: n.number, status: n.status, recipient: n.recipient,
    invoice_ref: n.invoice_ref, reason: n.reason, issue_date: n.issue_date,
    currency: n.currency, total_minor: n.total_minor, total: formatMoney(n.total_minor, n.currency),
    lines: n.lines.length,
  };
}

/** The duplicate guard: same recipient, date, reason, currency and lines is a double entry. */
function noteKey(n: { recipient: string; issue_date: string; reason: string; reason_detail: string | null; currency: string; invoice_ref: string | null; lines: { description: string; quantity: number; unit_price_minor: number; tax_rate: number }[] }): string {
  return JSON.stringify([
    n.recipient.trim().toLowerCase(), n.issue_date, n.reason, n.reason_detail ?? "", n.currency, n.invoice_ref ?? "",
    n.lines.map((l) => [l.description, l.quantity, l.unit_price_minor, l.tax_rate]),
  ]);
}

/* ------------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-credit-note", version: VERSION },
  { capabilities: { tools: {} } },
);

server.registerTool("credit_note_create", {
  title: "Issue a credit note",
  description: "Issue a credit note against an invoice, or standalone: the recipient, the reason (returned goods, overcharge, discount correction, service issue, other), line items with quantity, unit price and tax rate, and the currency. Returns a draft you can still revise; credit_note_finalize burns the final CN number.",
  inputSchema: {
    recipient: str("recipient", MAX_NAME).describe("Who the credit is for, e.g. Acme GmbH"),
    reason: z.enum(REASONS).describe("Why the credit is issued: returned_goods, overcharge, discount_correction, service_issue or other"),
    currency: z.string().regex(/^[A-Za-z]{3}$/, "currency must be a 3-letter ISO code such as EUR").describe("ISO code the credit is in"),
    lines: z.array(z.object(lineShape)).min(1, "a credit note needs at least one line").max(MAX_LINES).describe("What is being credited, line by line"),
    invoice_ref: str("invoice_ref", MAX_NAME).optional().describe("The invoice this credits, e.g. INV-2026-0042. Omit for a standalone credit"),
    reason_detail: str("reason_detail", MAX_NAME).optional().describe("One line of specifics, e.g. Client was billed 10 seats, used 7"),
    issue_date: str("issue_date", 10).optional().describe("The date the credit is issued, YYYY-MM-DD. Default today; a future date is refused"),
    notes: str("notes", MAX_TEXT).optional().describe("Text printed at the foot of the document, e.g. how the credit will be settled"),
    duplicate_ok: z.boolean().optional().describe("Create it even though an identical draft or note exists, for a genuinely repeated credit. Default false"),
  },
}, async (a) => {
  try {
    const issue = a.issue_date ? checkDate(a.issue_date, "issue_date") : today();
    const now = today();
    if (issue > now) throw new Error(`the credit note is dated ${issue}, which is after today (${now}). A credit note is issued when it is issued; back-date it to match the return, never forward. Nothing was written.`);
    const recipient = a.recipient.trim();
    if (!recipient) throw new Error(`the recipient is empty. A credit note credits someone. Nothing was written.`);
    const currency = a.currency.toUpperCase();
    const lines = checkLines(a.lines);
    const t = totalsOf(lines);
    const rec = await locked(() => {
      const list = getNotes();
      const draft = {
        recipient, issue_date: issue, reason: a.reason, reason_detail: a.reason_detail?.trim() || null,
        currency, invoice_ref: a.invoice_ref?.trim() || null, lines,
      };
      const twin = list.find((n) => noteKey(n) === noteKey(draft));
      if (twin && !a.duplicate_ok) {
        throw new Error(
          `${twin.id} is already this credit note, to the byte: ${twin.recipient}, ${twin.issue_date}, ${formatMoney(twin.total_minor, twin.currency)}, ${twin.reason}. ` +
          `Nothing was written. If the same credit really is issued twice, pass duplicate_ok true.`,
        );
      }
      const stamp = new Date().toISOString();
      const id = nextId("CN-DRAFT", stamp.slice(0, 4), list.map((n) => n.id));
      const note: CreditNote = {
        id, number: null, status: "draft",
        recipient, invoice_ref: draft.invoice_ref,
        reason: a.reason, reason_detail: draft.reason_detail,
        currency, issue_date: issue, lines,
        notes: a.notes?.trim() || null,
        subtotal_minor: t.subtotal_minor, tax_minor: t.tax_minor, total_minor: t.total_minor,
        created: stamp, updated: stamp, finalized_at: null,
      };
      list.push(note);
      setNotes(list);
      return { note, twin };
    });
    const notes: string[] = [];
    if (rec.twin) notes.push(`${rec.twin.id} is an identical credit note and was allowed through because duplicate_ok was passed.`);
    if (!rec.note.invoice_ref) notes.push("No invoice reference: this is a standalone credit. If it settles an invoice, pass invoice_ref so the paperwork chains together.");
    const finals = getNotes().filter((n) => n.status === "final").length;
    if (!gate.isPro()) notes.push(`Free tier: ${finals} of ${FREE_FINALS} finalized credit notes used. Drafts, edits, deletion of drafts, listing, rendering and totals stay free.`);
    return json({ created: noteJson(rec.note), notes, basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("credit_note_update", {
  title: "Revise a draft credit note",
  description: "Change a draft credit note while it is still a draft: recipient, reason, lines, currency, invoice reference, issue date or notes. Pass only what changes; new lines replace all old ones. A finalized note is immutable and is refused by name.",
  inputSchema: {
    id: str("id", MAX_NAME).describe("The draft id, e.g. CN-DRAFT-2026-0001"),
    recipient: str("recipient", MAX_NAME).optional(),
    reason: z.enum(REASONS).optional(),
    currency: z.string().regex(/^[A-Za-z]{3}$/, "currency must be a 3-letter ISO code such as EUR").optional().describe("ISO code. Changing it reprices nothing: the stored minor units carry over, so only change it to fix a wrong currency"),
    lines: z.array(z.object(lineShape)).min(1).max(MAX_LINES).optional().describe("The full new line set, replacing every existing line"),
    invoice_ref: str("invoice_ref", MAX_NAME).nullable().optional().describe("New invoice reference, or null to detach the note from its invoice"),
    reason_detail: str("reason_detail", MAX_NAME).nullable().optional(),
    issue_date: str("issue_date", 10).optional(),
    notes: str("notes", MAX_TEXT).nullable().optional().describe("New notes text, or null to remove the notes"),
  },
}, async (a) => {
  try {
    if (a.issue_date !== undefined) {
      checkDate(a.issue_date, "issue_date");
      const now = today();
      if (a.issue_date > now) throw new Error(`the credit note would be dated ${a.issue_date}, which is after today (${now}). Nothing was written.`);
    }
    const nextLines = a.lines ? checkLines(a.lines) : null;
    const rec = await locked(() => {
      const list = getNotes();
      const n = findNote(list, a.id);
      if (!n) throw new Error(`no credit note matches "${a.id}". Run credit_note_list to see the ids. Nothing was written.`);
      if (n.status === "final") {
        throw new Error(`${n.number} is finalized and cannot be edited. A finalized credit note is a document the client may have seen. Nothing was written.`);
      }
      if (a.recipient !== undefined) {
        const r = a.recipient.trim();
        if (!r) throw new Error(`the recipient is empty. A credit note credits someone. Nothing was written.`);
        n.recipient = r;
      }
      if (a.reason !== undefined) n.reason = a.reason;
      if (a.reason_detail !== undefined) n.reason_detail = a.reason_detail === null ? null : a.reason_detail.trim() || null;
      if (a.invoice_ref !== undefined) n.invoice_ref = a.invoice_ref === null ? null : a.invoice_ref.trim() || null;
      if (a.issue_date !== undefined) n.issue_date = a.issue_date;
      if (a.notes !== undefined) n.notes = a.notes === null ? null : a.notes.trim() || null;
      if (a.currency !== undefined) n.currency = a.currency.toUpperCase();
      if (nextLines) n.lines = nextLines;
      const t = totalsOf(n.lines);
      n.subtotal_minor = t.subtotal_minor;
      n.tax_minor = t.tax_minor;
      n.total_minor = t.total_minor;
      if (n.total_minor <= 0) throw new Error(`the lines now credit a total of zero. A credit note that credits nothing is not a credit note. Nothing was written.`);
      n.updated = new Date().toISOString();
      setNotes(list);
      return n;
    });
    return json({ updated: noteJson(rec), basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("credit_note_finalize", {
  title: "Finalize a credit note",
  description: "Finalize a draft: burn the final CN-YYYY-NNNN number and freeze the note. From here it cannot be edited or deleted, only rendered and listed, because it is now the document the client sees. Free tier: 10 finalized credit notes; Pro removes the limit.",
  inputSchema: {
    id: str("id", MAX_NAME).describe("The draft id, e.g. CN-DRAFT-2026-0001"),
  },
}, async (a) => {
  try {
    const rec = await locked(() => {
      const list = getNotes();
      const n = findNote(list, a.id);
      if (!n) throw new Error(`no credit note matches "${a.id}". Run credit_note_list to see the ids. Nothing was written.`);
      if (n.status === "final") throw new Error(`${n.number} is already finalized. Nothing was written.`);
      if (!gate.isPro()) {
        const finals = list.filter((x) => x.status === "final").length;
        if (finals >= FREE_FINALS) {
          throw new Error(
            `the free tier finalizes ${FREE_FINALS} credit notes and ${finals} are already final. ` +
            `Drafts, edits, listing, rendering and the totals stay free, so the books can still be read. Nothing was written. ` +
            gate.upgradeText("unlimited finalized credit notes", "credit_note_finalize"),
          );
        }
      }
      const stamp = new Date().toISOString();
      n.number = nextId("CN", n.issue_date.slice(0, 4), list.filter((x) => x.number !== null).map((x) => x.number as string));
      n.status = "final";
      n.finalized_at = stamp;
      n.updated = stamp;
      setNotes(list);
      return n;
    });
    const notes: string[] = [];
    if (!gate.isPro()) {
      const finals = getNotes().filter((x) => x.status === "final").length;
      notes.push(`Free tier: ${finals} of ${FREE_FINALS} finalized credit notes used.`);
    }
    return json({ finalized: noteJson(rec), notes, basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("credit_note_list", {
  title: "List credit notes",
  description: "List credit notes: number or draft id, recipient, reason, status, issue date and total. Filter by recipient (a part of the name is enough), by reason, by status draft or final, and by issue-date period with from and to.",
  inputSchema: {
    recipient: str("recipient", MAX_NAME).optional().describe("Match the recipient, case-insensitive, a part of the name is enough"),
    reason: z.enum(REASONS).optional().describe("Only notes with this reason"),
    status: z.enum(["draft", "final"]).optional().describe("Only drafts or only finalized notes"),
    from: str("from", 10).optional().describe("First issue date to include, YYYY-MM-DD"),
    to: str("to", 10).optional().describe("Last issue date to include, YYYY-MM-DD"),
    limit: z.number().int().min(1).max(MAX_ROWS).optional().describe(`Maximum notes listed, default and ceiling ${MAX_ROWS}`),
  },
}, async (a) => {
  try {
    if (a.from !== undefined) checkDate(a.from, "from");
    if (a.to !== undefined) checkDate(a.to, "to");
    if (a.from && a.to && a.from > a.to) throw new Error(`from ${a.from} is after to ${a.to}. Swap them.`);
    const needle = a.recipient?.trim().toLowerCase();
    let list = getNotes();
    if (needle) list = list.filter((n) => n.recipient.toLowerCase().includes(needle));
    if (a.reason) list = list.filter((n) => n.reason === a.reason);
    if (a.status) list = list.filter((n) => n.status === a.status);
    if (a.from) list = list.filter((n) => n.issue_date >= (a.from as string));
    if (a.to) list = list.filter((n) => n.issue_date <= (a.to as string));
    list = list.sort((x, y) => (x.issue_date === y.issue_date ? x.id.localeCompare(y.id) : x.issue_date < y.issue_date ? -1 : 1));
    const limit = a.limit ?? MAX_ROWS;
    const shown = list.slice(0, limit);
    return json({
      count: shown.length,
      matched: list.length,
      truncated: list.length > shown.length,
      credit_notes: shown.map(summaryLine),
      note: "Drafts and finalized notes are listed together unless status is passed. credit_note_get reads one in full.",
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("credit_note_get", {
  title: "Read one credit note in full",
  description: "Return one credit note by its CN number or draft id: every line with quantity, unit price and tax, the totals per tax rate, the reason, the invoice it credits, and the notes. Reads only; use credit_note_list for the ids.",
  inputSchema: {
    id: str("id", MAX_NAME).describe("The credit note number CN-2026-0001 or draft id CN-DRAFT-2026-0001"),
  },
}, async (a) => {
  try {
    const n = findNote(getNotes(), a.id);
    if (!n) throw new Error(`no credit note matches "${a.id}". Run credit_note_list to see the ids.`);
    return json({ credit_note: noteJson(n), basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("credit_note_delete", {
  title: "Delete a draft credit note",
  description: "Delete a draft credit note entered wrongly, by its draft id. A finalized note is refused by name: it is a document the client may have seen, and deleting it would leave their copy pointing at nothing.",
  inputSchema: {
    id: str("id", MAX_NAME).describe("The draft id, e.g. CN-DRAFT-2026-0001"),
  },
}, async (a) => {
  try {
    const rec = await locked(() => {
      const list = getNotes();
      const n = findNote(list, a.id);
      if (!n) throw new Error(`no credit note matches "${a.id}". Run credit_note_list to see the ids. Nothing was written.`);
      if (n.status === "final") {
        throw new Error(
          `${n.number} is finalized and cannot be deleted. A finalized credit note is a document the client may have seen; deleting it here would not delete their copy. ` +
          `Where a correction is owed, that is a conversation with the client and, where the tax office requires one, a cancellation document outside this store. Nothing was written.`,
        );
      }
      setNotes(list.filter((x) => x.id !== n.id));
      return n;
    });
    return json({
      deleted: noteJson(rec),
      note: "The draft id is not reissued. The series only ever goes up, so a gap in it is the record that a draft was deleted. Final numbers are never deleted, so the final CN series has no gaps at all.",
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("credit_note_render", {
  title: "Render a credit note as Markdown or printable HTML",
  description: "Turn a credit note into the document: Markdown to paste into an email or ticket, or a self-contained printable HTML page with every style inline. Drafts render with a DRAFT banner so a half-finished credit cannot be sent by mistake. Writes nothing. Free; the free tier stamps a one-line footer.",
  inputSchema: {
    id: str("id", MAX_NAME).describe("The credit note number CN-2026-0001 or draft id CN-DRAFT-2026-0001"),
    format: z.enum(["markdown", "html"]).optional().describe("markdown (default) or html, a self-contained printable page"),
  },
}, async (a) => {
  try {
    const n = findNote(getNotes(), a.id);
    if (!n) throw new Error(`no credit note matches "${a.id}". Run credit_note_list to see the ids.`);
    const format = a.format ?? "markdown";
    const footer = gate.isPro() ? null : "Generated with mcp-credit-note by theluckystrike - https://github.com/theluckystrike/mcp-servers";
    const text = format === "html" ? renderHtml(n, footer) : renderMarkdown(n, footer);
    return ok(text);
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("credit_note_summary", {
  title: "Total credited by period, currency and reason",
  description: "How much you have credited: totals per currency over finalized credit notes, broken down by reason and by month, in an optional issue-date period. Drafts count for nothing until they are finalized. Currencies are never added together.",
  inputSchema: {
    from: str("from", 10).optional().describe("First issue date to include, YYYY-MM-DD. Default: the beginning"),
    to: str("to", 10).optional().describe("Last issue date to include, YYYY-MM-DD. Default: today"),
  },
}, async (a) => {
  try {
    if (a.from !== undefined) checkDate(a.from, "from");
    if (a.to !== undefined) checkDate(a.to, "to");
    if (a.from && a.to && a.from > a.to) throw new Error(`from ${a.from} is after to ${a.to}. Swap them.`);
    const all = getNotes();
    let finals = all.filter((n) => n.status === "final");
    if (a.from) finals = finals.filter((n) => n.issue_date >= (a.from as string));
    if (a.to) finals = finals.filter((n) => n.issue_date <= (a.to as string));
    const byCurrency = new Map<string, CreditNote[]>();
    for (const n of finals) {
      const arr = byCurrency.get(n.currency) ?? [];
      arr.push(n);
      byCurrency.set(n.currency, arr);
    }
    const per = [...byCurrency.values()].map((group) => {
      const currency = group[0].currency;
      const sum = (ns: CreditNote[]) => ns.reduce((x, n) => x + n.total_minor, 0);
      const byReason = new Map<Reason, CreditNote[]>();
      const byMonth = new Map<string, CreditNote[]>();
      for (const n of group) {
        const r = byReason.get(n.reason) ?? []; r.push(n); byReason.set(n.reason, r);
        const m = n.issue_date.slice(0, 7);
        const mm = byMonth.get(m) ?? []; mm.push(n); byMonth.set(m, mm);
      }
      return {
        currency,
        notes: group.length,
        subtotal_minor: group.reduce((x, n) => x + n.subtotal_minor, 0),
        tax_minor: group.reduce((x, n) => x + n.tax_minor, 0),
        total_minor: sum(group),
        total: formatMoney(sum(group), currency),
        by_reason: [...byReason.entries()].sort((x, y) => sum(y[1]) - sum(x[1])).map(([reason, ns]) => ({
          reason, reason_label: reasonLabel(reason), notes: ns.length,
          total_minor: sum(ns), total: formatMoney(sum(ns), currency),
        })),
        by_month: [...byMonth.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([month, ns]) => ({
          month, notes: ns.length, total_minor: sum(ns), total: formatMoney(sum(ns), currency),
        })),
      };
    }).sort((x, y) => x.currency.localeCompare(y.currency));
    return json({
      finalized: finals.length,
      drafts_excluded: all.filter((n) => n.status === "draft").length,
      period: { from: a.from ?? null, to: a.to ?? null },
      by_currency: per,
      note: "Currencies are never added together. This server holds no exchange rate, so one total over a EUR note and a USD one would be an invented number.",
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

gate.registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-credit-note ${VERSION} ready; store at ${dataDir()}\n`);
