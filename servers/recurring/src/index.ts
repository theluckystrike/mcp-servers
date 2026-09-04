#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, withFileLock } from "@theluckystrike/mcp-license";
import {
  addDays, computeTotals, dataDir as invoiceDataDir, findClient, formatMoney,
  getBusiness, getClients, getInvoices, hasBusiness, invoiceLockPath, isoDate,
  nextNumber, renderInvoicePdf, setClients, setInvoices,
  type Business, type Client, type Invoice,
} from "@theluckystrike/mcp-invoice/lib";
import { z } from "zod";
import { isKnownCurrency } from "./currency.js";
import {
  addMonthsIso, everyLabel, isIsoDate, nextOccurrence, occurrencesBetween,
  type Every, type PeriodRule,
} from "./period.js";
import {
  dataDir, findSchedule, generatedKeys, getHistory, getSchedules, lockPath,
  setHistory, setSchedules, type HistoryEntry, type Schedule, type ScheduleItem,
} from "./store.js";
import { VERSION } from "./version.js";

const FREE_ACTIVE_SCHEDULES = 3;
const FREE_UPCOMING_DAYS = 30;
/**
 * D-R39. "Show me the next 3 invoices" on a monthly schedule is a 90-day question, and a
 * 30-day window answered it with one row, so the model finished the answer with its own
 * arithmetic. The free cap is a COUNT of occurrences, not a window of days: the horizon
 * the caller asked for is honoured and the list is truncated at three, with the cap stated.
 */
const FREE_UPCOMING_PERIODS = 3;
const FREE_FORECAST_MONTHS = 3;

/**
 * One call to invoice_generate_due creates at most this many invoices.
 *
 * Measured before the cap: a schedule starting 1900-01-01 offered 1,520 due periods, and
 * `invoice_generate_due {as_of: "2126-01-01"}` on a plain monthly schedule created 1,193
 * real invoices and 1,193 PDFs (6.0 MB, 6.8 s) from a single call, burning 1,193 numbers
 * out of the shared invoice series. A mistyped year is a normal typo, so the run is
 * bounded instead: the oldest periods are billed first, the rest stay due, and the answer
 * says how many are left and that another call continues. Idempotency is unchanged --
 * the key is still (schedule_id, period) -- so continuing is just calling it again.
 */
const MAX_PERIODS_PER_RUN = 60;

/** A schedule prints one invoice per period; a 1,000-line PDF is a mistake, not a retainer. */
const MAX_ITEMS = 200;
const gate = createLicenseGate({ product: "recurring" });

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

/**
 * Locks. Schedule mutations take this server's lock; anything that writes an invoice
 * ALSO takes the invoice server's lock, because that is the lock its number counter is
 * allocated under. The order is always recurring -> invoice, in every path, so two
 * processes cannot deadlock against each other.
 */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(lockPath(), fn, { timeoutMs: 20000 });
}
function lockedWithInvoice<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(lockPath(), () => withFileLock(invoiceLockPath(), fn, { timeoutMs: 20000 }), { timeoutMs: 20000 });
}

/**
 * The issuer block comes from the INVOICE server's profile (business_set lives there;
 * this server deliberately does not have its own copy, so one profile prints on every
 * document). A missing profile never blocks generation: the PDF carries the placeholder
 * issuer and the response says so once.
 */
const PLACEHOLDER_ISSUER = "Your business";
const NO_BUSINESS_NOTE =
  "No business profile yet: generated PDFs show a placeholder issuer. " +
  "Run business_set {name, address, vat_id, iban} in the invoice server (mcp-invoice) and render again.";

function businessMissing(): boolean {
  return !hasBusiness() || !getBusiness().name.trim();
}
function issuer(): Business {
  const b = getBusiness();
  return b.name.trim() ? b : { ...b, name: PLACEHOLDER_ISSUER };
}

/* --------------------------------------------------------------- validation */

const MAX_AMOUNT = 1e12;
const amount = (what: string) =>
  z.number().finite().min(-MAX_AMOUNT, `${what} is out of range`).max(MAX_AMOUNT, `${what} is out of range`);

const itemSchema = z.object({
  description: z.string(),
  quantity: amount("quantity").describe("Hours, units or 1 for a flat fee"),
  unit_price: amount("unit_price").describe("Price per unit in major units, e.g. 90 for 90 EUR"),
  tax_rate: z.number().finite().min(-100).max(1000).optional().describe("VAT percent for this line, overrides the business default"),
});

const everySchema = z.union([
  z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  z.object({ days: z.number().int().min(1).max(3650) }),
]).describe('How often to bill: "weekly", "monthly", "quarterly", "yearly", or {days: 10}. Month steps keep the start date\'s day of month and clamp it to shorter months, so a schedule starting on the 31st bills on the 28th/29th in February and back on the 31st in March');

function ruleOf(s: Schedule): PeriodRule {
  return {
    every: s.every, start_date: s.start_date, end_date: s.end_date,
    anchor_day: s.anchor_day, end_of_month: s.end_of_month,
  };
}

function isActive(s: Schedule, asOf: string): boolean {
  return s.status === "active" && !(s.end_date && s.end_date < asOf);
}

function activeCount(list: Schedule[], asOf: string): number {
  return list.filter((s) => isActive(s, asOf)).length;
}

/* ------------------------------------------------------ invoice generation */

/**
 * Create one invoice for one occurrence, in the invoice server's store: same JSON files,
 * same clients, same `PREFIX-YYYY-NNNN` counter. Must be called under
 * lockedWithInvoice(). Returns the stored record; the PDF is rendered afterwards,
 * outside the lock, so a slow render cannot hold the counter.
 */
function issueInvoice(s: Schedule, period: string): Invoice {
  const biz = issuer();
  let client = findClient(s.client);
  if (!client) {
    const clients = getClients();
    const c: Client = { id: randomBytes(4).toString("hex"), name: s.client.trim(), created: isoDate() };
    clients.push(c);
    setClients(clients);
    client = c;
  }
  const currency = (s.currency ?? biz.default_currency).toUpperCase();
  const totals = computeTotals(s.items as ScheduleItem[], currency, 0, biz.default_tax_rate);
  if (!Number.isSafeInteger(totals.total_minor)) {
    throw new Error(`schedule ${s.id} produces a total too large to represent exactly.`);
  }
  const number = nextNumber(biz.invoice_prefix, period.slice(0, 4));
  const inv: Invoice = {
    number, client_id: client.id,
    client: { name: client.name, address: client.address, email: client.email, vat_id: client.vat_id },
    issue_date: period,
    due_date: addDays(period, s.due_days ?? biz.payment_terms_days),
    currency, decimals: totals.decimals, lines: totals.lines,
    subtotal_minor: totals.subtotal_minor,
    discount_percent: 0, discount_minor: 0,
    net_minor: totals.net_minor, tax_lines: totals.tax_lines, tax_minor: totals.tax_minor,
    total_minor: totals.total_minor,
    // D-R39: the tax reason travels with the money. Both the free-text note and the tax
    // note are printed under the totals; neither one silently replaces the other.
    notes: [s.notes, s.tax_note].filter(Boolean).join("\n") || undefined,
    status: "unpaid", paid_minor: 0,
    created: new Date().toISOString(), branded: !gate.isPro(),
  };
  const all = getInvoices();
  all.push(inv);
  setInvoices(all);
  return inv;
}

interface DueRow { schedule: Schedule; period: string }

/** Every (schedule, period) that is due on or before `asOf` and has no invoice yet. */
function dueRows(schedules: Schedule[], history: HistoryEntry[], asOf: string, only?: string): DueRow[] {
  const done = generatedKeys(history);
  const rows: DueRow[] = [];
  for (const s of schedules) {
    if (only && s.id !== only) continue;
    if (s.status !== "active") continue;
    for (const period of occurrencesBetween(ruleOf(s), asOf)) {
      if (done.has(`${s.id}|${period}`)) continue;
      rows.push({ schedule: s, period });
    }
  }
  rows.sort((a, b) => a.period.localeCompare(b.period) || a.schedule.id.localeCompare(b.schedule.id));
  return rows;
}

function scheduleTotalMinor(s: Schedule, currency: string): number {
  const biz = getBusiness();
  const t = computeTotals(s.items as ScheduleItem[], currency, 0, biz.default_tax_rate);
  return t.total_minor;
}

/**
 * D-R78. Every amount this server prints is the GROSS total: the line items plus whatever
 * default_tax_rate the shared business profile carries. A caller who set up "EUR 1500 a
 * month" and read back "amount: EUR 1845.00" has no way to tell whether the server
 * misunderstood the price or added tax, and the sibling that actually issues the invoice
 * (/mcp/invoice invoice_list) breaks the same number into subtotal + tax and total. Measured
 * in round 15: the model stopped and asked the user which of the two had happened. The number
 * was right; the one line that made it legible was on the other endpoint. Now it is on both.
 */
function scheduleAmounts(s: Schedule, currency: string): { amount: string; subtotal: string; tax: string[]; amount_includes_tax: boolean } {
  const biz = getBusiness();
  const t = computeTotals(s.items as ScheduleItem[], currency, 0, biz.default_tax_rate);
  const tax = (t.tax_lines ?? []).filter((l) => l.rate || l.tax_minor)
    .map((l) => `${l.rate}% on ${formatMoney(l.base_minor, currency)} = ${formatMoney(l.tax_minor, currency)}`);
  return {
    amount: formatMoney(t.total_minor, currency),
    subtotal: formatMoney(t.subtotal_minor, currency),
    tax,
    amount_includes_tax: t.total_minor !== t.subtotal_minor,
  };
}

function currencyOf(s: Schedule): string {
  return (s.currency ?? getBusiness().default_currency).toUpperCase();
}

function summarize(s: Schedule, asOf: string) {
  const cur = currencyOf(s);
  return {
    id: s.id,
    client: s.client,
    every: everyLabel(s.every),
    ...scheduleAmounts(s, cur),
    currency: cur,
    start_date: s.start_date,
    end_date: s.end_date ?? null,
    status: s.status,
    next_due: s.status === "active" ? nextOccurrence(ruleOf(s), addDays(asOf, -1)) : null,
    auto_generate: s.auto_generate,
    items: s.items.length,
  };
}

/* ------------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-recurring", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

server.registerTool("schedule_create", {
  title: "Create a recurring invoice schedule",
  description: "Define a repeating invoice: a client, the line items, how often to bill, and when it starts and ends. Returns the schedule id, a summary and its next dates. Nothing is invoiced until invoice_generate_due runs.",
  inputSchema: {
    client: z.string().describe("Client name or id, as in the invoice server. Unknown names are created on the first generated invoice"),
    items: z.array(itemSchema).min(1).max(MAX_ITEMS, `a schedule can carry at most ${MAX_ITEMS} line items`).describe("The line items billed every period"),
    currency: z.string().regex(/^[A-Za-z]{3}$/, "must be a 3-letter ISO code such as EUR").optional().describe("Defaults to your business default currency"),
    every: everySchema,
    start_date: z.string().describe("YYYY-MM-DD. The first invoice falls on this date, and for weekly/monthly/quarterly/yearly steps its day of month is the billing day for every later period"),
    end_date: z.string().optional().describe("YYYY-MM-DD, INCLUSIVE: an occurrence landing exactly on it is still generated"),
    due_days: z.number().int().optional().describe("Days until each invoice is due, defaults to your payment terms"),
    notes: z.string().optional().describe("Free text printed under the totals of every generated invoice"),
    tax_note: z.string().optional().describe("Why this schedule bills the tax it bills, e.g. 'Reverse charge: VAT accounted for by the recipient, art. 196 Directive 2006/112/EC'. It is printed under the totals of EVERY invoice this schedule generates, so a 0% retainer carries its reason on the document instead of only in the chat"),
    auto_generate: z.boolean().optional().describe("Marks the schedule for the monthly_billing_run prompt. Default false. Nothing runs in the background either way: invoices are created only when invoice_generate_due is called"),
    anchor_day: z.number().int().min(1).max(31).optional().describe("Pro: bill on this day of month instead of the start date's day. 31 means the last day of every month"),
    end_of_month: z.boolean().optional().describe("Pro: always bill on the last day of the month"),
  },
}, async (a) => {
  try {
    return await locked(() => {
      if (!isIsoDate(a.start_date)) return fail(`start_date must be a real calendar date as YYYY-MM-DD, got "${a.start_date}".`);
      if (a.end_date !== undefined && !isIsoDate(a.end_date)) return fail(`end_date must be a real calendar date as YYYY-MM-DD, got "${a.end_date}".`);
      if (a.end_date && a.end_date < a.start_date) return fail(`end_date ${a.end_date} is before start_date ${a.start_date}.`);
      if (a.currency && !isKnownCurrency(a.currency)) return fail(`"${a.currency.toUpperCase()}" is not an ISO 4217 currency code. Use EUR, USD, GBP, PLN and so on.`);
      const list = getSchedules();
      const today = isoDate();
      const pro = gate.isPro();
      if (!pro && activeCount(list, today) >= FREE_ACTIVE_SCHEDULES) {
        return ok(`You already have ${FREE_ACTIVE_SCHEDULES} active schedules. The free tier allows ${FREE_ACTIVE_SCHEDULES}; pause one with schedule_pause, or upgrade.\n\n${gate.upgradeText("unlimited schedules", "schedule_create")}`);
      }
      let note = "";
      let anchor = a.anchor_day;
      let eom = a.end_of_month;
      if (!pro && (anchor !== undefined || eom)) {
        anchor = undefined; eom = undefined;
        note = `\n\nNote: anchor_day and end_of_month are Pro rules; this schedule bills on the start date's day of month instead. ${gate.upgradeText("end-of-month and anchor-day rules", "schedule_create")}`;
      }
      const now = new Date().toISOString();
      const s: Schedule = {
        id: randomBytes(4).toString("hex"),
        client: a.client.trim(),
        items: a.items as ScheduleItem[],
        currency: a.currency ? a.currency.toUpperCase() : undefined,
        every: a.every as Every,
        start_date: a.start_date,
        end_date: a.end_date,
        anchor_day: anchor,
        end_of_month: eom,
        due_days: a.due_days,
        notes: a.notes,
        tax_note: a.tax_note,
        auto_generate: a.auto_generate ?? false,
        status: "active",
        created: now, updated: now,
      };
      list.push(s);
      setSchedules(list);
      const preview = occurrencesBetween(ruleOf(s), addDays(today, 90)).slice(0, 4);
      return ok(
        `Created schedule ${s.id} for ${s.client}, ${everyLabel(s.every)} from ${s.start_date}.\n\n` +
        `${JSON.stringify({ ...summarize(s, today), next_dates: preview }, null, 2)}\n\n` +
        `Nothing is invoiced yet. Run invoice_generate_due when you want the due invoices created. ` +
        `Month steps keep ${s.start_date}'s day of month and clamp it to shorter months.` +
        `${gate.isPro() ? "" : ` The free tier allows ${FREE_ACTIVE_SCHEDULES} active schedules.`}` +
        `${businessMissing() ? `\n\n${NO_BUSINESS_NOTE}` : ""}${note}`,
      );
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("schedule_list", {
  title: "List schedules",
  description: "Every schedule with its cadence, per-period amount, next due date and status (active or paused).",
  inputSchema: { status: z.enum(["active", "paused"]).optional() },
}, async (a) => {
  try {
    const today = isoDate();
    let list = getSchedules();
    if (a.status) list = list.filter((s) => s.status === a.status);
    if (!list.length) return ok("No schedules yet. Create one with schedule_create.");
    return json({ count: list.length, schedules: list.map((s) => summarize(s, today)) });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("schedule_get", {
  title: "Get one schedule",
  description: "The full stored record for one schedule: items, cadence, dates, rules and how many invoices it has generated.",
  inputSchema: { id: z.string().describe("Schedule id, or a client name") },
}, async (a) => {
  try {
    const s = findSchedule(getSchedules(), a.id);
    if (!s) return fail(`no schedule ${a.id}. List them with schedule_list.`);
    const generated = getHistory().filter((h) => h.schedule_id === s.id);
    return json({ ...s, every_label: everyLabel(s.every), generated_count: generated.length, ...summarize(s, isoDate()) });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("schedule_update", {
  title: "Update a schedule",
  description: "Change a schedule's client, items, currency, cadence, dates, due days, notes or auto_generate flag. Periods already invoiced are never re-issued, so changing the amount affects future invoices only.",
  inputSchema: {
    id: z.string(),
    client: z.string().optional(),
    items: z.array(itemSchema).min(1).max(MAX_ITEMS, `a schedule can carry at most ${MAX_ITEMS} line items`).optional(),
    currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
    every: everySchema.optional(),
    start_date: z.string().optional(),
    end_date: z.string().nullable().optional().describe("null clears the end date"),
    due_days: z.number().int().optional(),
    notes: z.string().optional(),
    tax_note: z.string().optional().describe("Replace the tax reason carried onto every future generated invoice. Pass an empty string to clear it"),
    auto_generate: z.boolean().optional(),
    anchor_day: z.number().int().min(1).max(31).nullable().optional().describe("Pro"),
    end_of_month: z.boolean().optional().describe("Pro"),
  },
}, async (a) => {
  try {
    return await locked(() => {
      const list = getSchedules();
      const s = findSchedule(list, a.id);
      if (!s) return fail(`no schedule ${a.id}. List them with schedule_list.`);
      if (a.start_date !== undefined && !isIsoDate(a.start_date)) return fail(`start_date must be YYYY-MM-DD, got "${a.start_date}".`);
      if (a.end_date != null && !isIsoDate(a.end_date)) return fail(`end_date must be YYYY-MM-DD, got "${a.end_date}".`);
      if (a.currency !== undefined && !isKnownCurrency(a.currency)) return fail(`"${a.currency.toUpperCase()}" is not an ISO 4217 currency code. Use EUR, USD, GBP, PLN and so on.`);
      const pro = gate.isPro();
      let note = "";
      if (a.client !== undefined) s.client = a.client.trim();
      if (a.items !== undefined) s.items = a.items as ScheduleItem[];
      if (a.currency !== undefined) s.currency = a.currency.toUpperCase();
      if (a.every !== undefined) s.every = a.every as Every;
      if (a.start_date !== undefined) s.start_date = a.start_date;
      if (a.end_date !== undefined) s.end_date = a.end_date ?? undefined;
      if (a.due_days !== undefined) s.due_days = a.due_days;
      if (a.notes !== undefined) s.notes = a.notes;
      if (a.tax_note !== undefined) s.tax_note = a.tax_note.trim() || undefined;
      if (a.auto_generate !== undefined) s.auto_generate = a.auto_generate;
      if (a.anchor_day !== undefined || a.end_of_month !== undefined) {
        if (pro) {
          if (a.anchor_day !== undefined) s.anchor_day = a.anchor_day ?? undefined;
          if (a.end_of_month !== undefined) s.end_of_month = a.end_of_month;
        } else {
          note = `\n\nNote: anchor_day and end_of_month are Pro rules and were not applied. ${gate.upgradeText("end-of-month and anchor-day rules", "schedule_update")}`;
        }
      }
      if (s.end_date && s.end_date < s.start_date) return fail(`end_date ${s.end_date} is before start_date ${s.start_date}.`);
      s.updated = new Date().toISOString();
      setSchedules(list);
      return ok(`Updated schedule ${s.id}.\n\n${JSON.stringify(summarize(s, isoDate()), null, 2)}${note}`);
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

function setStatus(id: string, status: "active" | "paused") {
  return locked(() => {
    const list = getSchedules();
    const s = findSchedule(list, id);
    if (!s) return fail(`no schedule ${id}. List them with schedule_list.`);
    if (status === "active" && s.status !== "active" && !gate.isPro()
        && activeCount(list, isoDate()) >= FREE_ACTIVE_SCHEDULES) {
      return ok(`Resuming would make ${FREE_ACTIVE_SCHEDULES + 1} active schedules; the free tier allows ${FREE_ACTIVE_SCHEDULES}.\n\n${gate.upgradeText("unlimited schedules")}`);
    }
    s.status = status;
    s.updated = new Date().toISOString();
    setSchedules(list);
    return ok(`Schedule ${s.id} (${s.client}) is now ${status}.` +
      (status === "paused" ? " Paused schedules are skipped by invoice_generate_due and by forecast." : ""));
  });
}

server.registerTool("schedule_pause", {
  title: "Pause a schedule",
  description: "Stop a schedule from generating invoices without deleting it. Its history is kept and it can be resumed.",
  inputSchema: { id: z.string() },
}, async (a) => {
  try { return await setStatus(a.id, "paused"); } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("schedule_resume", {
  title: "Resume a schedule",
  description: "Make a paused schedule active again. Periods that fell due while it was paused are still due and will be created by the next invoice_generate_due.",
  inputSchema: { id: z.string() },
}, async (a) => {
  try { return await setStatus(a.id, "active"); } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("schedule_delete", {
  title: "Delete a schedule",
  description: "Remove a schedule. Invoices it already generated stay in the invoice server untouched and its generation history is kept as an audit trail. Returns the client and how many invoices and history rows remain.",
  inputSchema: { id: z.string().describe("Schedule id, or a client name. Deletion is permanent; re-creating the same schedule afterwards gives it a NEW id, so its old periods count as unbilled again") },
}, async (a) => {
  try {
    return await locked(() => {
      const list = getSchedules();
      const s = findSchedule(list, a.id);
      if (!s) return fail(`no schedule ${a.id}. List them with schedule_list.`);
      setSchedules(list.filter((x) => x.id !== s.id));
      const n = getHistory().filter((h) => h.schedule_id === s.id).length;
      return ok(`Deleted schedule ${s.id} (${s.client}). ${n} generated invoice${n === 1 ? "" : "s"} remain in the invoice server, and its ${n} history row${n === 1 ? "" : "s"} are kept.` + (n ? " Re-creating this schedule starts a new id, so those periods would be offered again; invoice_generate_due warns when that happens." : ""));
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("schedule_skip", {
  title: "Skip one period",
  description: "Skip a single occurrence of a schedule without pausing it: no invoice is ever created for that period, and every other period bills as normal. Returns the amount that will not be billed and how to undo it.",
  inputSchema: {
    id: z.string().describe("Schedule id, or a client name"),
    period: z.string().describe("The occurrence date to skip, YYYY-MM-DD, exactly as it appears in schedule_upcoming or forecast. This is the answer to \"pause this client for October\": schedule_pause stops the whole schedule and a resumed schedule still back-bills the periods it missed, whereas a skipped period is closed for good"),
    undo: z.boolean().optional().describe("Remove a previous skip so the period becomes due again. Works only on a period that has not been invoiced. Default false"),
  },
}, async (a) => {
  try {
    return await locked(() => {
      const list = getSchedules();
      const s = findSchedule(list, a.id);
      if (!s) return fail(`no schedule ${a.id}. List them with schedule_list.`);
      if (!isIsoDate(a.period)) return fail(`period must be a real calendar date as YYYY-MM-DD, got "${a.period}".`);
      const history = getHistory();
      const existing = history.find((h) => h.schedule_id === s.id && h.period === a.period);
      if (a.undo) {
        if (!existing) return fail(`${s.client} has no record for ${a.period}, so there is nothing to undo.`);
        if (!existing.skipped) return fail(`${a.period} was invoiced as ${existing.invoice_number}, not skipped. Delete that invoice in the invoice server if it was wrong.`);
        setHistory(history.filter((h) => h !== existing));
        return ok(`${s.client} ${a.period} is due again. Run invoice_generate_due to create it.`);
      }
      if (existing) {
        return existing.skipped
          ? ok(`${s.client} ${a.period} was already skipped; nothing changed.`)
          : fail(`${a.period} was already invoiced as ${existing.invoice_number}. Skipping only works on a period that has not been billed yet.`);
      }
      const dates = occurrencesBetween(ruleOf(s), a.period, a.period);
      if (!dates.includes(a.period)) {
        const near = occurrencesBetween(ruleOf(s), addDays(a.period, 62), addDays(a.period, -62));
        return fail(`${a.period} is not an occurrence of ${s.client}'s ${everyLabel(s.every)} schedule.` +
          (near.length ? ` Nearby occurrences: ${near.join(", ")}.` : ""));
      }
      const cur = currencyOf(s);
      history.push({
        schedule_id: s.id, period: a.period, invoice_number: "", issue_date: a.period,
        due_date: a.period, currency: cur, total_minor: 0, skipped: true,
        created: new Date().toISOString(),
      });
      setHistory(history);
      return ok(`Skipped ${s.client} ${a.period} (${formatMoney(scheduleTotalMinor(s, cur), cur)} not billed). ` +
        `The schedule stays active, so every other period bills as normal, and this period is closed for good: no invoice will ever be created for it. ` +
        `Undo with schedule_skip {id: "${s.id}", period: "${a.period}", undo: true} while it has not been invoiced.`);
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("schedule_upcoming", {
  title: "What falls due soon",
  description: "Table of every schedule occurrence falling due in the next N days, with the amount per occurrence and the total per currency. Free lists the first 3 occurrences in the horizon you ask for.",
  inputSchema: { days: z.number().int().min(1).max(3650).optional().describe("Days ahead, default 30. The free tier honours the horizon you ask for and lists the first 3 occurrences in it; Pro lists them all") },
}, async (a) => {
  try {
    const today = isoDate();
    const days = a.days ?? FREE_UPCOMING_DAYS;
    let note = "";
    const to = addDays(today, days);
    const upcomingDone = generatedKeys(getHistory());
    const rows: Array<Record<string, unknown>> = [];
    const totals: Record<string, number> = {};
    for (const s of getSchedules()) {
      if (s.status !== "active") continue;
      const cur = currencyOf(s);
      const per = scheduleTotalMinor(s, cur);
      for (const d of occurrencesBetween(ruleOf(s), to, today)) {
        if (upcomingDone.has(`${s.id}|${d}`)) continue;
        rows.push({
          due_date: d, schedule_id: s.id, client: s.client, every: everyLabel(s.every),
          ...scheduleAmounts(s, cur), currency: cur, _minor: per,
          invoice_due: addDays(d, s.due_days ?? getBusiness().payment_terms_days),
        });
        totals[cur] = (totals[cur] ?? 0) + per;
      }
    }
    rows.sort((x, y) => String(x.due_date).localeCompare(String(y.due_date)));
    // D-R39: truncate by count, after sorting, and say exactly what the cap is and how many
    // occurrences were withheld - never return a shorter horizon than the one asked for.
    const foundInHorizon = rows.length;
    let shown = rows;
    const shownTotals: Record<string, number> = {};
    if (!gate.isPro() && foundInHorizon > FREE_UPCOMING_PERIODS) {
      shown = rows.slice(0, FREE_UPCOMING_PERIODS);
      note = `Free tier lists ${FREE_UPCOMING_PERIODS} occurrences per call: showing ${FREE_UPCOMING_PERIODS} of ${foundInHorizon} found in the ${days}-day horizon you asked for. ${gate.upgradeText("every occurrence in the horizon", "schedule_upcoming")}`;
    }
    // D-R5: "what is due" also means the periods that already fell due and were never
    // invoiced. Looking only forward hid a whole unbilled month from the answer.
    for (const r of shown) {
      const c = String(r.currency);
      shownTotals[c] = (shownTotals[c] ?? 0) + Number(r._minor ?? 0);
    }
    for (const r of rows) delete (r as Record<string, unknown>)._minor;
    const history = getHistory();
    const done = generatedKeys(history);
    const backlog: Array<Record<string, unknown>> = [];
    for (const s of getSchedules()) {
      if (s.status !== "active") continue;
      const cur = currencyOf(s);
      const per = scheduleTotalMinor(s, cur);
      for (const d of occurrencesBetween(ruleOf(s), addDays(today, -1))) {
        if (done.has(`${s.id}|${d}`)) continue;
        backlog.push({ period: d, schedule_id: s.id, client: s.client, amount: formatMoney(per, cur), currency: cur });
      }
    }
    backlog.sort((x, y) => String(x.period).localeCompare(String(y.period)));
    return json({
      as_of: today, horizon_days: days, to,
      count: shown.length, occurrences_found_in_horizon: foundInHorizon,
      free_tier_occurrence_cap: gate.isPro() ? undefined : FREE_UPCOMING_PERIODS,
      occurrences: shown,
      past_due_not_yet_invoiced: backlog.length
        ? { count: backlog.length, periods: backlog.slice(0, MAX_PERIODS_PER_RUN), hint: "run invoice_generate_due to create these" }
        : undefined,
      // D-R79. `totals` is summed over every occurrence FOUND, and the free tier lists only
      // the first few, so the total used to be a figure the rows on screen could not add up
      // to, with nothing saying which set it covered. Measured in round 15: 3 rows of
      // EUR 1845.00 printed above a total of EUR 11070.00, and the model filled the gap by
      // inventing the three occurrences it had never been sent. Both totals are named now.
      totals_per_currency: Object.entries(totals).map(([c, v]) => formatMoney(v, c)),
      totals_cover: shown.length === foundInHorizon
        ? `all ${foundInHorizon} occurrence(s) in the horizon, every one of them listed above`
        : `all ${foundInHorizon} occurrence(s) found in the horizon, which is MORE than the ${shown.length} listed above: the rows you can see add up to ${Object.entries(shownTotals).map(([c, v]) => formatMoney(v, c)).join(", ")}`,
      totals_per_currency_listed_rows: shown.length === foundInHorizon ? undefined : Object.entries(shownTotals).map(([c, v]) => formatMoney(v, c)),
      note: note || undefined,
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("invoice_generate_due", {
  title: "Generate the invoices that are due",
  description: "Create a real invoice in the invoice server for every schedule occurrence on or before as_of that has not been invoiced yet, and render each PDF. Returns what was created, what was skipped and what is still due.",
  inputSchema: {
    as_of: z.string().optional().describe("YYYY-MM-DD, defaults to today. Every occurrence on or before this date that has not been invoiced is billed. Idempotent: one invoice per schedule per period, keyed by the occurrence date, so running it twice creates nothing the second time"),
    schedule_id: z.string().optional().describe("Only this schedule. Free and unlimited on every tier"),
    dry_run: z.boolean().optional().describe(`List what would be created without creating anything. Default false. One run creates at most ${MAX_PERIODS_PER_RUN} invoices, oldest period first`),
  },
}, async (a) => {
  try {
    const asOf = a.as_of ?? isoDate();
    if (!isIsoDate(asOf)) return fail(`as_of must be a real calendar date as YYYY-MM-DD, got "${asOf}".`);
    const created: Array<{ invoice: Invoice; schedule: Schedule; period: string }> = [];
    const result = await lockedWithInvoice(() => {
      const schedules = getSchedules();
      if (a.schedule_id && !schedules.some((s) => s.id === a.schedule_id)) {
        throw new Error(`no schedule ${a.schedule_id}. List them with schedule_list.`);
      }
      const history = getHistory();
      const all = dueRows(schedules, history, asOf, a.schedule_id);
      const rows = all.slice(0, MAX_PERIODS_PER_RUN);
      const remaining = all.length - rows.length;
      // D-R3: history is keyed by schedule_id, so a schedule deleted and re-created gets a
      // new id and its old periods look unbilled. Never silently re-bill without saying so.
      // The client name comes from the invoice the row produced, so a history row whose
      // schedule no longer exists is still recognised.
      const nameOfInvoice = new Map(getInvoices().map((i) => [i.number, i.client.name.trim().toLowerCase()]));
      const byClientPeriod = new Set(history.filter((h) => !h.skipped).map((h) => {
        const name = nameOfInvoice.get(h.invoice_number)
          ?? schedules.find((x) => x.id === h.schedule_id)?.client.trim().toLowerCase();
        return name ? `${name}|${h.period}` : `\u0000${h.schedule_id}|${h.period}`;
      }));
      const duplicates = rows
        .filter((r) => byClientPeriod.has(`${r.schedule.client.trim().toLowerCase()}|${r.period}`))
        .map((r) => ({
          schedule_id: r.schedule.id, client: r.schedule.client, period: r.period,
          reason: "another schedule for this client already invoiced this period",
        }));
      const skipped = schedules
        .filter((s) => (!a.schedule_id || s.id === a.schedule_id))
        .flatMap((s) => occurrencesBetween(ruleOf(s), asOf)
          .filter((p) => generatedKeys(history).has(`${s.id}|${p}`))
          .map((p) => ({
            schedule_id: s.id, client: s.client, period: p,
            reason: history.find((h) => h.schedule_id === s.id && h.period === p)?.skipped
              ? "skipped by schedule_skip" : "already invoiced",
          })));
      if (a.dry_run) return { rows, skipped, remaining, duplicates, dry: true as const };
      for (const r of rows) {
        const inv = issueInvoice(r.schedule, r.period);
        history.push({
          schedule_id: r.schedule.id, period: r.period, invoice_number: inv.number,
          issue_date: inv.issue_date, due_date: inv.due_date, currency: inv.currency,
          total_minor: inv.total_minor, created: new Date().toISOString(),
        });
        created.push({ invoice: inv, schedule: r.schedule, period: r.period });
      }
      setHistory(history);
      return { rows, skipped, remaining, duplicates, dry: false as const };
    });
    if (result.dry) {
      return json({
        as_of: asOf, dry_run: true,
        would_create: result.rows.map((r) => ({
          schedule_id: r.schedule.id, client: r.schedule.client, period: r.period,
          amount: formatMoney(scheduleTotalMinor(r.schedule, currencyOf(r.schedule)), currencyOf(r.schedule)),
        })),
        skipped: result.skipped,
        still_due_after_this_run: result.remaining,
        duplicate_warnings: result.duplicates.length ? result.duplicates : undefined,
        note: `Nothing was created: dry_run was true. This tool is idempotent, one invoice per schedule per period keyed by the occurrence date, so running it twice creates nothing the second time.` +
          (result.remaining > 0
            ? ` One run creates at most ${MAX_PERIODS_PER_RUN} invoices. ${result.remaining} more periods would still be due; call invoice_generate_due again to continue.`
            : ""),
      });
    }

    // PDFs are rendered after the locks are released: a slow render must not hold the
    // invoice number counter. The path matches the invoice server's own default, so
    // invoice_pdf there overwrites the same file.
    const biz = issuer();
    const pro = gate.isPro();
    const pdfs: string[] = [];
    for (const c of created) {
      const out = join(invoiceDataDir(), "pdf", `${c.invoice.number}.pdf`);
      await renderInvoicePdf(c.invoice, biz, out, { branded: !pro, logo: pro });
      pdfs.push(out);
    }
    if (pdfs.length) {
      await locked(() => {
        const history = getHistory();
        for (let i = 0; i < created.length; i++) {
          const h = history.find((x) => x.invoice_number === created[i].invoice.number);
          if (h) h.pdf_path = pdfs[i];
        }
        setHistory(history);
      });
    }
    const lines = created.map((c, i) =>
      `${c.invoice.number}  ${c.schedule.client}  period ${c.period}  ${formatMoney(c.invoice.total_minor, c.invoice.currency)}  due ${c.invoice.due_date}  ${pdfs[i]}`);
    const totals: Record<string, number> = {};
    for (const c of created) totals[c.invoice.currency] = (totals[c.invoice.currency] ?? 0) + c.invoice.total_minor;
    return ok(
      `as_of ${asOf}: created ${created.length} invoice${created.length === 1 ? "" : "s"}, skipped ${result.skipped.length} already invoiced.\n\n` +
      (lines.length ? lines.join("\n") + "\n\n" : "") +
      (created.length ? `Total: ${Object.entries(totals).map(([c, v]) => formatMoney(v, c)).join(", ")}\n\n` : "") +
      `They are stored in the invoice server (${invoiceDataDir()}) and appear in its invoice_list and overdue_report. ` +
      `This tool is idempotent -- one invoice per schedule per period, keyed by the occurrence date -- so running it again creates nothing for a period already billed.` +
      (result.remaining > 0
        ? `\n\nOne run creates at most ${MAX_PERIODS_PER_RUN} invoices, oldest period first. ${result.remaining} period${result.remaining === 1 ? " is" : "s are"} still due; call invoice_generate_due again to continue, or check as_of and the schedule's start_date if that number looks wrong.`
        : "") +
      (result.duplicates.length
        ? `\n\nWarning: ${result.duplicates.length} of these repeat a period another schedule for the same client already invoiced (${result.duplicates.slice(0, 5).map((d) => `${d.client} ${d.period}`).join(", ")}). Delete the duplicate invoices in the invoice server if that was not intended.`
        : "") +
      `${businessMissing() ? `\n\n${NO_BUSINESS_NOTE}` : ""}`,
    );
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("schedule_history", {
  title: "Schedule history (Pro)",
  description: "The audit log for one schedule: every period it has generated, the invoice number, dates, amount and PDF path.",
  inputSchema: { id: z.string() },
}, async (a) => {
  try {
    if (!gate.isPro()) {
      return ok(`schedule_history is a Pro feature.\n\n${gate.upgradeText("the schedule audit log", "schedule_history")}`);
    }
    const s = findSchedule(getSchedules(), a.id);
    const id = s?.id ?? a.id;
    const rows = getHistory().filter((h) => h.schedule_id === id)
      .sort((x, y) => x.period.localeCompare(y.period));
    if (!rows.length) return ok(`No invoices generated for ${id} yet.`);
    const paid = new Map(getInvoices().map((i) => [i.number, i]));
    return json({
      schedule_id: id, client: s?.client, count: rows.length,
      generated: rows.map((h) => ({
        period: h.period, invoice: h.skipped ? null : h.invoice_number, issue_date: h.issue_date,
        due_date: h.due_date, amount: formatMoney(h.total_minor, h.currency),
        status: h.skipped ? "skipped" : (paid.get(h.invoice_number)?.status ?? "deleted in the invoice server"),
        pdf: h.pdf_path,
      })),
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("forecast", {
  title: "Revenue forecast",
  description: "Expected invoiced revenue per calendar month per currency from every active schedule. Free covers 3 months ahead; Pro covers up to 120.",
  inputSchema: { months: z.number().int().min(1).max(120).optional().describe("Months ahead including this one, default 12") },
}, async (a) => {
  try {
    const today = isoDate();
    let months = a.months ?? 12;
    let note = "";
    if (!gate.isPro() && months > FREE_FORECAST_MONTHS) {
      months = FREE_FORECAST_MONTHS;
      note = `Free tier forecasts ${FREE_FORECAST_MONTHS} months; showing ${FREE_FORECAST_MONTHS}. ${gate.upgradeText("a 12-month forecast", "forecast")}`;
    }
    const last = addMonthsIso(today, months - 1);
    const to = addMonthsIso(last.slice(0, 8) + "01", 1, 1);   // first of the month after `last`
    const end = addDays(to, -1);
    const buckets = new Map<string, Record<string, number>>();
    // D-R7: a paused schedule used to vanish from the forecast entirely, so pausing one
    // client answered "0" and hid everything. Paused rows are reported separately.
    const pausedRows: Array<Record<string, unknown>> = [];
    // D-R9: a period that is already invoiced, or that schedule_skip closed, is not future
    // revenue. Forecasting the flat cadence contradicted schedule_skip's own answer.
    const settled = generatedKeys(getHistory());
    const skippedRows: Array<Record<string, unknown>> = [];
    for (const s of getSchedules()) {
      const cur = currencyOf(s);
      const per = scheduleTotalMinor(s, cur);
      const dates = occurrencesBetween(ruleOf(s), end, today);
      if (s.status !== "active") {
        if (dates.length) {
          pausedRows.push({
            schedule_id: s.id, client: s.client, occurrences: dates.length,
            would_be: formatMoney(per * dates.length, cur), months: dates.map((d) => d.slice(0, 7)),
          });
        }
        continue;
      }
      for (const d of dates) {
        if (settled.has(`${s.id}|${d}`)) {
          skippedRows.push({ schedule_id: s.id, client: s.client, period: d, amount: formatMoney(per, cur) });
          continue;
        }
        const m = d.slice(0, 7);
        const b = buckets.get(m) ?? {};
        b[cur] = (b[cur] ?? 0) + per;
        buckets.set(m, b);
      }
    }
    const rows = [...buckets.entries()].sort((x, y) => x[0].localeCompare(y[0]))
      .map(([month, per]) => ({ month, revenue: Object.entries(per).map(([c, v]) => formatMoney(v, c)) }));
    const totals: Record<string, number> = {};
    for (const [, per] of buckets) for (const [c, v] of Object.entries(per)) totals[c] = (totals[c] ?? 0) + v;
    return json({
      from: today, months, through: end, count: rows.length, per_month: rows,
      total_per_currency: Object.entries(totals).map(([c, v]) => formatMoney(v, c)),
      excluded_already_invoiced_or_skipped: skippedRows.length ? skippedRows : undefined,
      paused_not_included: pausedRows.length
        ? { count: pausedRows.length, schedules: pausedRows, hint: "resume with schedule_resume, or skip one period with schedule_skip" }
        : undefined,
      note: note || undefined,
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ----------------------------------------------------------------- resource */

server.registerResource("upcoming", "recurring://upcoming", {
  title: "Upcoming invoices",
  description: "Every schedule occurrence falling due in the next 30 days as JSON, with amounts per currency.",
  mimeType: "application/json",
}, async (uri) => {
  const today = isoDate();
  const to = addDays(today, 30);
  const rows: Array<Record<string, unknown>> = [];
  for (const s of getSchedules()) {
    if (s.status !== "active") continue;
    const cur = currencyOf(s);
    const per = scheduleTotalMinor(s, cur);
    for (const d of occurrencesBetween(ruleOf(s), to, today)) {
      rows.push({ due_date: d, schedule_id: s.id, client: s.client, amount: formatMoney(per, cur), currency: cur });
    }
  }
  rows.sort((x, y) => String(x.due_date).localeCompare(String(y.due_date)));
  return {
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ as_of: today, to, count: rows.length, occurrences: rows }, null, 2) }],
  };
});

/* ------------------------------------------------------------------- prompt */

server.registerPrompt("monthly_billing_run", {
  title: "Monthly billing run",
  description: "Generate every invoice that is due, list what was created, and report what is still unpaid so reminders can go out.",
  argsSchema: { as_of: z.string().optional().describe("YYYY-MM-DD, defaults to today") },
}, (a: { as_of?: string }) => ({
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
      text: [
        `Run this month's billing${a?.as_of ? ` as of ${a.as_of}` : ""}:`,
        `1. Call invoice_generate_due {dry_run: true${a?.as_of ? `, as_of: "${a.as_of}"` : ""}} and show me what is about to be created.`,
        `2. Then call invoice_generate_due${a?.as_of ? ` {as_of: "${a.as_of}"}` : " {}"} and list every invoice number, client, amount, due date and PDF path.`,
        `3. Call schedule_upcoming {days: 30} so I can see what is coming next.`,
        `4. If the invoice server (mcp-invoice) is connected, call its overdue_report and tell me which clients need a payment reminder, with the amount and the days overdue for each.`,
        `Do not invent amounts: every figure must come from a tool result.`,
      ].join("\n"),
    },
  }],
}));

gate.registerTools(server as unknown as { registerTool: Function });

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(
  `mcp-recurring ready (${gate.isPro() ? "pro" : "free"}), schedules in ${dataDir()}, invoices in ${invoiceDataDir()}\n`,
);
