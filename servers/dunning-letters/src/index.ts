#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import { formatMoney } from "@theluckystrike/mcp-asset-register/lib";
import { z } from "zod";
import { VERSION } from "./version.js";
import {
  accruedFeeMinor, BUCKETS, bucketFor, daysLate, DEFAULT_GAPS, invoiceKey, isIsoDate, isPaid,
  MAX_MINOR, MAX_ROWS, nextAction, outstandingMinor, paidMinor, stageDates, stagesSent,
  STAGE_NAMES, STAGES, today, type ChasedInvoice, type Stage,
} from "./engine.js";
import { renderLetter, type Sender } from "./letters.js";
import { dataDir, getInvoices, lockPath, nextId, resolveInvoice, setInvoices } from "./store.js";

/**
 * Free tier: THREE active unpaid invoices. That is a real chase list for a freelancer --
 * three late payers, each taken from reminder 1 through the final notice, with the aging
 * and the next-action list unmetered. The cap is on how many chases run at once, never on
 * the letters, the aging or the history: an invoice that gets paid stops counting, so the
 * free tier is a ladder, not a demo.
 */
const FREE_ACTIVE_UNPAID = 3;
const MAX_NAME = 200;
const MAX_TEXT = 2000;

const gate = createLicenseGate({ product: "dunning-letters" });

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

const str = (field: string, max: number) => z.string().max(max, `${field} must be ${max} characters or fewer`);

/** Only this server's own register is written, so there is one lock and it is this one. */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(lockPath(), fn, { timeoutMs: 20000 });
}

function checkDate(value: string, field: string): string {
  if (!isIsoDate(value)) throw new Error(`cannot read a date: ${field} "${value}" is not a real date in YYYY-MM-DD form. Nothing was written.`);
  return value;
}

function onDate(value: string | undefined): string {
  const on = value ?? today();
  if (!isIsoDate(on)) throw new Error(`cannot read a date: "${value}" is not a real date in YYYY-MM-DD form.`);
  return on;
}

const BASIS =
  "The ladder is due-anchored and sequential: reminder 1 falls due at due + the first gap, reminder 2 at due + the second, the final notice at due + the third (default 7, 14, 21 days), and a later letter never leapfrogs an unsent earlier one. " +
  "No balance is stored: what is still owed is derived from the invoice amount and the recorded payments on every call. " +
  "Nothing is emailed or sent anywhere: this server renders the letter text, and sending it is your act.";

function sender(): Sender {
  const p = readSharedProfile();
  return { name: p.name, email: p.email };
}

function senderNotes(s: Sender): string[] {
  return (s.name ?? "").trim()
    ? []
    : ["The letters are signed \"[Your name]\": the shared business profile has no name. Run business_set {name} in the invoice server once and every later letter is signed."];
}

function money(minor: number, currency: string): string {
  return formatMoney(minor, currency);
}

/** The ladder state of one invoice on `on`, as JSON. */
function ladderJson(inv: ChasedInvoice, on: string) {
  const dates = stageDates(inv);
  const sent = stagesSent(inv);
  const next = isPaid(inv) ? null : nextAction(inv, on);
  return {
    id: inv.id, client: inv.client, reference: inv.reference, currency: inv.currency,
    amount: money(inv.amount_minor, inv.currency), amount_minor: inv.amount_minor,
    paid_so_far_minor: paidMinor(inv),
    outstanding: money(outstandingMinor(inv), inv.currency), outstanding_minor: outstandingMinor(inv),
    status: isPaid(inv) ? "paid" : "open",
    due: inv.due, issued: inv.issued ?? null,
    days_late: daysLate(inv, on),
    gaps: inv.gaps,
    schedule: STAGES.map((s) => ({
      stage: s, stage_name: STAGE_NAMES[s], date: dates[s - 1],
      sent: inv.letters.find((l) => l.stage === s)?.sent ?? null,
      state: sent.has(s) ? "sent" : on >= dates[s - 1] ? "due" : "pending",
    })),
    next_action: next ? { ...next, send_now: next.due } : null,
    ladder_exhausted: !isPaid(inv) && next === null,
  };
}

function activeUnpaid(list: ChasedInvoice[]): ChasedInvoice[] {
  return list.filter((i) => !isPaid(i));
}

const invoiceArg = str("invoice", MAX_NAME).describe("The chased invoice: its id (DUN-2026-0001) or its invoice reference");

/* ------------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-dunning-letters", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

server.registerTool("invoice_register", {
  title: "Register an unpaid invoice to chase",
  description: "Start chasing an unpaid invoice: register the client, the invoice reference, the amount in integer cents, the currency and the due date, and get the three-letter escalation schedule (reminder 1, reminder 2, final notice) with the date each falls due. Free tier: 3 unpaid invoices chased at once.",
  inputSchema: {
    client: str("client", MAX_NAME).describe("Who owes the money, e.g. Acme Ltd"),
    reference: str("reference", MAX_NAME).describe("The invoice number being chased, e.g. INV-1042"),
    amount_minor: z.number().int().min(1).max(MAX_MINOR).describe("The invoice amount in whole minor units (integer cents). 125000 is USD 1,250.00"),
    currency: z.string().regex(/^[A-Za-z]{3}$/, "currency must be a 3-letter ISO code such as USD").describe("ISO code the invoice was issued in"),
    due: str("due", 10).describe("The date payment fell due, YYYY-MM-DD. The ladder is anchored to this date"),
    issued: str("issued", 10).optional().describe("The date the invoice was issued, YYYY-MM-DD, for the letter's reference line"),
    gaps: z.array(z.number().int().min(1).max(365)).length(3).optional().describe("Days after the due date at which reminder 1, reminder 2 and the final notice fall due, strictly increasing. Default [7, 14, 21]"),
    late_fee_percent_per_month: z.number().positive().max(100).optional().describe("Late payment interest your terms allow, percent per month, simple and pro-rata. When set, reminder 2 and the final notice state the accrued figure"),
    note: str("note", MAX_TEXT).optional(),
    duplicate_ok: z.boolean().optional().describe("Register even though an identical invoice is already on the register. Default false"),
  },
}, async (a) => {
  try {
    const due = checkDate(a.due, "due");
    const issued = a.issued !== undefined ? checkDate(a.issued, "issued") : undefined;
    if (issued && issued > due) throw new Error(`the invoice is dated ${issued} but falls due ${due}: it cannot be due before it exists. Nothing was written.`);
    const gaps = (a.gaps ?? DEFAULT_GAPS) as [number, number, number];
    if (!(gaps[0] < gaps[1] && gaps[1] < gaps[2])) {
      throw new Error(`the gaps [${gaps.join(", ")}] must be strictly increasing: reminder 2 cannot chase before reminder 1. Nothing was written.`);
    }
    const currency = a.currency.toUpperCase();
    const on = today();
    const out = await locked(() => {
      const list = getInvoices();
      const active = activeUnpaid(list);
      if (!gate.isPro() && active.length >= FREE_ACTIVE_UNPAID) {
        throw new Error(
          `the free tier chases ${FREE_ACTIVE_UNPAID} unpaid invoices at once and ${active.length} are open (${active.map((i) => `${i.id} ${i.client} ${i.reference}`).join(", ")}). ` +
          `Recording a payment that closes one frees its slot, and invoice_delete frees one too. Nothing was written. ` + gate.upgradeText("unlimited unpaid invoices", "invoice_register"),
        );
      }
      const draft = { client: a.client.trim(), reference: a.reference.trim(), amount_minor: a.amount_minor, currency, due };
      const key = invoiceKey(draft);
      const twin = list.find((i) => invoiceKey(i) === key);
      if (twin && !a.duplicate_ok) {
        throw new Error(
          `${twin.id} is already this invoice, to the byte: ${twin.client}, ${twin.reference}, ${money(twin.amount_minor, currency)}, due ${twin.due}. Chasing it twice would send the client two ladders. ` +
          `Nothing was written. If this really is a second invoice, pass duplicate_ok true, or give it its own reference.`,
        );
      }
      const id = nextId(due.slice(0, 4), list.map((i) => i.id));
      const now = new Date().toISOString();
      const inv: ChasedInvoice = {
        id, ...draft, issued, note: a.note, gaps,
        late_fee_percent_per_month: a.late_fee_percent_per_month,
        payments: [], letters: [], created: now, updated: now,
      };
      list.push(inv);
      setInvoices(list);
      return { inv, active };
    });
    const notes: string[] = [];
    if (!a.late_fee_percent_per_month) notes.push("No late fee rate: reminder 2 and the final notice will say your terms provide for interest, without a figure. Pass late_fee_percent_per_month to have the accrued amount stated.");
    if (daysLate(out.inv, on) === 0) notes.push(`The invoice is not due until ${due}; reminder 1 falls due on ${stageDates(out.inv)[0]}. The schedule below is ready for when it does.`);
    if (!gate.isPro()) notes.push(`Free tier: ${activeUnpaid(getInvoices()).length} of ${FREE_ACTIVE_UNPAID} unpaid-invoice slots in use.`);
    notes.push(...senderNotes(sender()));
    return json({
      registered: ladderJson(out.inv, on),
      letters: "Render each letter with letter_render when its date arrives, then record the sending with letter_sent. Nothing is emailed: the server produces the text, you send it.",
      notes, basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("payment_record", {
  title: "Record a payment received",
  description: "Record money received against a chased invoice, in whole MINOR units: a part payment lowers what is still chased, a payment that covers the balance closes the ladder and frees the free-tier slot. Returns the outstanding amount.",
  inputSchema: {
    invoice: invoiceArg,
    amount_minor: z.number().int().min(1).max(MAX_MINOR).describe("What was received, in whole minor units"),
    date: str("date", 10).optional().describe("The date the money arrived, YYYY-MM-DD. Default today"),
    note: str("note", MAX_TEXT).optional().describe("How it was paid, e.g. Bank transfer, or what it was against"),
  },
}, async (a) => {
  try {
    const date = a.date ? checkDate(a.date, "date") : today();
    const now = today();
    if (date > now) throw new Error(`the payment is dated ${date}, which is after today (${now}). Money that has not arrived yet is a promise, not a payment. Nothing was written.`);
    const out = await locked(() => {
      const list = getInvoices();
      const inv = resolveInvoice(list, a.invoice);
      if (isPaid(inv)) {
        throw new Error(`${inv.id} is already paid in full (${money(inv.amount_minor, inv.currency)} received). There is nothing left to pay. Nothing was written.`);
      }
      const p = {
        id: `PAY-${String(inv.payments.length + 1).padStart(3, "0")}`,
        date, amount_minor: a.amount_minor, note: a.note, recorded: new Date().toISOString(),
      };
      inv.payments.push(p);
      inv.updated = new Date().toISOString();
      setInvoices(list);
      return { inv, p };
    });
    const { inv } = out;
    const outstanding = outstandingMinor(inv);
    const excess = paidMinor(inv) - inv.amount_minor;
    const notes: string[] = [];
    if (isPaid(inv)) {
      notes.push(`That closes ${inv.id}: the ladder stops here, any letters not yet sent are cancelled, and the free-tier slot is free again.`);
      if (inv.letters.length) notes.push(`The client was chased ${inv.letters.length} time${inv.letters.length === 1 ? "" : "s"} before paying; the record stays on the register.`);
    }
    if (excess > 0) notes.push(`The payments now exceed the invoice by ${money(excess, inv.currency)}. That is the client's money: refund it or hold it against the next invoice, and say which in a note.`);
    return json({
      recorded: { ...out.p, amount: money(out.p.amount_minor, inv.currency) },
      invoice: inv.id, client: inv.client, reference: inv.reference, currency: inv.currency,
      paid_so_far: money(paidMinor(inv), inv.currency), paid_so_far_minor: paidMinor(inv),
      outstanding: money(outstanding, inv.currency), outstanding_minor: outstanding,
      excess_minor: Math.max(0, excess),
      status: isPaid(inv) ? "paid" : "open",
      notes, basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("letter_render", {
  title: "Generate the chase letter for the current stage",
  description: "Chase an unpaid invoice: generate the letter for the current stage of the ladder -- reminder 1 (polite), reminder 2 (firm, with the late fees note) or the final notice (before-action wording) -- as Markdown or as self-contained printable HTML. Nothing is emailed or sent anywhere: this server produces the letter text, and sending it is your act. Record the sending with letter_sent so the ladder advances.",
  inputSchema: {
    invoice: invoiceArg,
    format: z.enum(["markdown", "html"]).optional().describe("markdown (default) or html: a self-contained printable page with no external anything"),
    stage: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe("Render a specific stage instead of the one currently due, to preview or to re-issue a letter already sent"),
    on: str("on", 10).optional().describe("The letter's date, YYYY-MM-DD; late fees accrue to it and the final-notice deadline is 7 days after it. Default today"),
  },
}, async (a) => {
  try {
    const on = onDate(a.on);
    const list = getInvoices();
    const inv = resolveInvoice(list, a.invoice);
    if (isPaid(inv)) {
      throw new Error(`${inv.id} is paid in full; there is nothing to chase. The register keeps the record; invoice_delete removes it.`);
    }
    const next = nextAction(inv, on);
    const notes: string[] = [];
    let stage: Stage;
    if (a.stage !== undefined) {
      stage = a.stage;
      const sent = stagesSent(inv);
      if (sent.has(stage)) notes.push(`${STAGE_NAMES[stage]} was already sent on ${inv.letters.find((l) => l.stage === stage)!.sent}; this is a copy, dated ${on}.`);
      for (const s of STAGES) {
        if (s < stage && !sent.has(s)) {
          notes.push(`${STAGE_NAMES[s]} has not been sent yet. The ladder works in order: a ${STAGE_NAMES[stage]} lands harder after the ${STAGE_NAMES[s]}. This letter is rendered anyway, as asked.`);
          break;
        }
      }
    } else {
      if (!next) {
        throw new Error(`all three letters have been sent on ${inv.id} and ${money(outstandingMinor(inv), inv.currency)} is still unpaid. This server has no fourth letter: the next step is a collections agency or legal advice, and it happens outside this server.`);
      }
      if (!next.due) {
        throw new Error(`no letter is due on ${inv.id} yet: ${next.stage_name} falls due on ${next.date} (in ${next.days_until} day${next.days_until === 1 ? "" : "s"}). Pass stage ${next.stage} explicitly to preview it, or chase_today for what is due across the register.`);
      }
      stage = next.stage;
      if (next.days_overdue > 0) notes.push(`${next.stage_name} fell due on ${next.date} and has been waiting ${next.days_overdue} day${next.days_overdue === 1 ? "" : "s"}.`);
    }
    const s = sender();
    notes.push(...senderNotes(s));
    const letter = renderLetter(inv, stage, on, s);
    if (stage === 3) notes.push("The final notice is a template, not legal advice: what a before-action letter must contain varies by jurisdiction. Check the local requirement before sending it.");
    return json({
      invoice: inv.id, client: inv.client, reference: inv.reference, currency: inv.currency,
      stage, stage_name: letter.stage_name, on, deadline: letter.deadline ?? null,
      subject: letter.subject,
      outstanding: money(letter.outstanding_minor, inv.currency), outstanding_minor: letter.outstanding_minor,
      late_fee_accrued: money(letter.fee_minor, inv.currency), late_fee_accrued_minor: letter.fee_minor,
      total_due: money(letter.total_minor, inv.currency), total_due_minor: letter.total_minor,
      format: a.format ?? "markdown",
      letter: (a.format ?? "markdown") === "html" ? letter.html : letter.markdown,
      honesty: "Nothing is emailed or sent anywhere. This is the letter text; sending it -- by email, post or otherwise -- is your act. Record the sending with letter_sent so the ladder advances.",
      notes, basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("letter_sent", {
  title: "Record that a letter was sent",
  description: "Record that a chase letter was actually sent, with its date, so the ladder advances to the next stage. Letters go out in order: reminder 2 cannot be recorded before reminder 1. Returns what is due next and when.",
  inputSchema: {
    invoice: invoiceArg,
    stage: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe("Which letter went out. Default the lowest unsent stage"),
    sent: str("sent", 10).optional().describe("The date it was sent, YYYY-MM-DD. Default today"),
  },
}, async (a) => {
  try {
    const sentDate = a.sent ? checkDate(a.sent, "sent") : today();
    const now = today();
    if (sentDate > now) throw new Error(`the letter is recorded as sent on ${sentDate}, which is after today (${now}). A sending can only be recorded once it has happened. Nothing was written.`);
    const out = await locked(() => {
      const list = getInvoices();
      const inv = resolveInvoice(list, a.invoice);
      if (isPaid(inv)) throw new Error(`${inv.id} is paid in full; there is nothing to chase and no letter to record. Nothing was written.`);
      if (sentDate < inv.due) throw new Error(`the invoice falls due on ${inv.due} and the letter is dated ${sentDate}: you cannot have chased an invoice that was not yet due. Nothing was written.`);
      const sent = stagesSent(inv);
      const lowest = STAGES.find((s) => !sent.has(s));
      if (lowest === undefined) throw new Error(`all three letters on ${inv.id} are already recorded as sent. The ladder is exhausted; the next step is outside this server. Nothing was written.`);
      const stage = a.stage ?? lowest;
      if (stage !== lowest) {
        throw new Error(`the letters go out in order: ${STAGE_NAMES[lowest]} has not been recorded as sent, so ${STAGE_NAMES[stage]} cannot be. Record ${STAGE_NAMES[lowest]} first, or pass stage ${lowest}. Nothing was written.`);
      }
      inv.letters.push({ stage, sent: sentDate, recorded: new Date().toISOString() });
      inv.updated = new Date().toISOString();
      setInvoices(list);
      return { inv, stage };
    });
    const on = today();
    const next = nextAction(out.inv, on);
    const notes: string[] = [];
    const dueDate = stageDates(out.inv)[out.stage - 1];
    if (sentDate < dueDate) notes.push(`${STAGE_NAMES[out.stage]} fell due on ${dueDate} and is recorded as sent on ${sentDate}, before its date. Recorded as a fact; the schedule above is unchanged.`);
    if (next?.due) notes.push(`${next.stage_name} is already due: render it with letter_render and send it today.`);
    if (!next) notes.push(`That was the final notice. If ${money(outstandingMinor(out.inv), out.inv.currency)} does not arrive by the deadline the letter named, the next step is a collections agency or legal advice, outside this server.`);
    return json({
      recorded: { invoice: out.inv.id, stage: out.stage, stage_name: STAGE_NAMES[out.stage], sent: sentDate },
      ladder: ladderJson(out.inv, on),
      notes, basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("overdue_list", {
  title: "List overdue invoices",
  description: "Every unpaid invoice past its due date: how many days late, what is still owed, which letters have gone out, and what is due next and when. Sorted by days late, worst first.",
  inputSchema: {
    on: str("on", 10).optional().describe("The date to judge lateness against, YYYY-MM-DD. Default today"),
    limit: z.number().int().min(1).max(MAX_ROWS).optional().describe(`Maximum rows, default and ceiling ${MAX_ROWS}`),
  },
}, async (a) => {
  try {
    const on = onDate(a.on);
    const limit = a.limit ?? MAX_ROWS;
    const open = getInvoices().filter((i) => !isPaid(i) && daysLate(i, on) > 0)
      .sort((x, y) => {
        const d = daysLate(y, on) - daysLate(x, on);
        return d !== 0 ? d : x.id.localeCompare(y.id);
      });
    const rows = open.slice(0, limit).map((inv) => ({
      ...ladderJson(inv, on),
      bucket: bucketFor(daysLate(inv, on)),
      letters_sent: inv.letters.map((l) => ({ stage: l.stage, stage_name: STAGE_NAMES[l.stage], sent: l.sent })),
    }));
    const byCurrency = new Map<string, { currency: string; invoices: number; outstanding_minor: number }>();
    for (const inv of open) {
      const t = byCurrency.get(inv.currency) ?? { currency: inv.currency, invoices: 0, outstanding_minor: 0 };
      t.invoices += 1; t.outstanding_minor += outstandingMinor(inv);
      byCurrency.set(inv.currency, t);
    }
    return json({
      on,
      overdue: open.length,
      invoices: rows,
      truncated: open.length > limit,
      totals_by_currency: [...byCurrency.values()].map((t) => ({ ...t, outstanding: money(t.outstanding_minor, t.currency) })),
      totals_note: "Currencies are never added together. This server holds no exchange rate, so one total over a USD invoice and a EUR one would be an invented number.",
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("aging_summary", {
  title: "Aging summary of what is owed",
  description: "The aging summary across every unpaid invoice: current, 1-30, 31-60, 61-90 and 91+ day buckets, with counts and totals in integer cents, per currency. This is the answer to \"how much am I owed, and how stale is it\".",
  inputSchema: {
    on: str("on", 10).optional().describe("The date to age against, YYYY-MM-DD. Default today"),
  },
}, async (a) => {
  try {
    const on = onDate(a.on);
    const open = getInvoices().filter((i) => !isPaid(i));
    const byCurrency = new Map<string, { currency: string; invoices: number; outstanding_minor: number; buckets: Record<string, { invoices: number; outstanding_minor: number }> }>();
    for (const inv of open) {
      let t = byCurrency.get(inv.currency);
      if (!t) {
        t = { currency: inv.currency, invoices: 0, outstanding_minor: 0, buckets: {} };
        for (const b of BUCKETS) t.buckets[b] = { invoices: 0, outstanding_minor: 0 };
        byCurrency.set(inv.currency, t);
      }
      const b = t.buckets[bucketFor(daysLate(inv, on))];
      const out = outstandingMinor(inv);
      b.invoices += 1; b.outstanding_minor += out;
      t.invoices += 1; t.outstanding_minor += out;
    }
    return json({
      on,
      unpaid_invoices: open.length,
      per_currency: [...byCurrency.values()].map((t) => ({
        currency: t.currency, invoices: t.invoices,
        outstanding: money(t.outstanding_minor, t.currency), outstanding_minor: t.outstanding_minor,
        buckets: BUCKETS.map((name) => ({
          bucket: name, invoices: t.buckets[name].invoices,
          outstanding: money(t.buckets[name].outstanding_minor, t.currency),
          outstanding_minor: t.buckets[name].outstanding_minor,
        })),
      })),
      buckets_note: "current = not yet due on the date given; the day ranges are whole days past the due date. Currencies are never added together.",
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("chase_today", {
  title: "What to chase today",
  description: "The day's chase list: which invoices cross an escalation threshold today, which letter to send each and how long it has been waiting, what falls due in the next few days, and which invoices have had all three letters and need a decision outside this server.",
  inputSchema: {
    on: str("on", 10).optional().describe("The date to run the list for, YYYY-MM-DD, e.g. to see what Monday will need. Default today"),
    within_days: z.number().int().min(0).max(90).optional().describe("How far ahead to list letters coming due, default 7 days"),
  },
}, async (a) => {
  try {
    const on = onDate(a.on);
    const within = a.within_days ?? 7;
    const open = getInvoices().filter((i) => !isPaid(i));
    const sendNow: unknown[] = [];
    const crossing: unknown[] = [];
    const comingUp: unknown[] = [];
    const exhausted: unknown[] = [];
    for (const inv of open) {
      const next = nextAction(inv, on);
      const base = {
        id: inv.id, client: inv.client, reference: inv.reference, currency: inv.currency,
        outstanding: money(outstandingMinor(inv), inv.currency), outstanding_minor: outstandingMinor(inv),
        due: inv.due, days_late: daysLate(inv, on),
      };
      if (!next) {
        exhausted.push({ ...base, note: "all three letters sent; the next step is a collections agency or legal advice, outside this server" });
      } else if (next.due) {
        const row = { ...base, send: next.stage_name, stage: next.stage, threshold_date: next.date, letter_days_overdue: next.days_overdue };
        sendNow.push(row);
        if (next.date === on) crossing.push(row);
      } else if (next.days_until <= within) {
        comingUp.push({ ...base, send: next.stage_name, stage: next.stage, threshold_date: next.date, days_until: next.days_until });
      }
    }
    return json({
      on,
      send_now: sendNow,
      crossing_today: crossing,
      crossing_note: "These invoices cross an escalation threshold exactly on the date given: the first day their letter can go out.",
      coming_up: comingUp,
      exhausted,
      counts: { unpaid: open.length, send_now: sendNow.length, crossing_today: crossing.length, coming_up: comingUp.length, exhausted: exhausted.length },
      next_step: "Render each send_now letter with letter_render, send it yourself -- nothing is emailed from here -- then record it with letter_sent.",
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("invoice_status", {
  title: "The full state of one chased invoice",
  description: "One chased invoice in full: what was billed, what has been paid and what is still owed, every letter sent with its date, the escalation schedule with each stage's state, and what happens next and when.",
  inputSchema: {
    invoice: invoiceArg,
    on: str("on", 10).optional().describe("The date to judge lateness against, YYYY-MM-DD. Default today"),
  },
}, async (a) => {
  try {
    const on = onDate(a.on);
    const inv = resolveInvoice(getInvoices(), a.invoice);
    return json({
      ...ladderJson(inv, on),
      late_fee_percent_per_month: inv.late_fee_percent_per_month ?? null,
      late_fee_accrued_minor: accruedFeeMinor(inv, on),
      late_fee_note: inv.late_fee_percent_per_month ? `simple interest, pro-rata on a 30-day month, rounded once to the minor unit: the amount outstanding on ${on}, across the days from the due date to ${on}` : "no rate registered",
      payments: inv.payments.map((p) => ({ ...p, amount: money(p.amount_minor, inv.currency) })),
      letters: inv.letters.map((l) => ({ stage: l.stage, stage_name: STAGE_NAMES[l.stage], sent: l.sent })),
      note: inv.note ?? null,
      created: inv.created, updated: inv.updated,
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("invoice_delete", {
  title: "Delete an invoice from the register",
  description: "Delete an invoice entered wrongly, by id or reference: the record, its payments and its letter history. The id is not reissued, so a gap in the DUN series is the record that a deletion happened.",
  inputSchema: {
    invoice: invoiceArg,
  },
}, async (a) => {
  try {
    const out = await locked(() => {
      const list = getInvoices();
      const inv = resolveInvoice(list, a.invoice);
      setInvoices(list.filter((i) => i.id !== inv.id));
      return inv;
    });
    return json({
      deleted: { id: out.id, client: out.client, reference: out.reference, amount_minor: out.amount_minor, currency: out.currency, due: out.due, was_paid: isPaid(out), letters_sent: out.letters.length, payments: out.payments.length },
      note: "The id is not reissued. The DUN series only ever goes up, so a gap in it is the record that an invoice was deleted.",
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

gate.registerTools(server);

/* ------------------------------------------------------- resource and prompt */

server.registerResource("ladder", "dunning://ladder", {
  title: "The escalation ladder this server runs",
  description: "The three stages, when each falls due, what each letter says, the free tier, and the one directory this server writes.",
  mimeType: "application/json",
}, async () => ({
  contents: [{
    uri: "dunning://ladder", mimeType: "application/json",
    text: JSON.stringify({
      stages: STAGES.map((s) => ({
        stage: s, name: STAGE_NAMES[s],
        falls_due: `due date + gaps[${s - 1}] (default ${DEFAULT_GAPS[s - 1]} days)`,
        tone: s === 1 ? "polite: assumes oversight, thanks them if payment is on its way" : s === 2 ? "firm: names the days overdue and the late fees note, asks for immediate payment" : "final notice: before-action wording, a 7-day deadline, names collections or a court claim as the next step",
      })),
      rules: [
        "the ladder is due-anchored: every stage date is due + a gap, never the previous letter's date + a gap",
        "the ladder is sequential: a later letter never leapfrogs an unsent earlier one",
        "recording a letter does not move the schedule; it only marks which stage is next",
        "a payment that covers the balance closes the ladder; part payments lower what the letters ask for",
        "nothing is emailed or sent anywhere: the server renders the letter text and the user sends it",
      ],
      free_tier: { active_unpaid_invoices: FREE_ACTIVE_UNPAID, metered: "invoice_register only; every other tool is free" },
      writes: [{ store: "dunning-letters", dir: dataDir(), files: ["invoices.json", "counter.json"] }],
      today: today(),
    }, null, 2),
  }],
}));

server.registerPrompt("weekly_chase", {
  title: "Run the weekly chase",
  description: "List what is overdue, send every letter that is due, and record the sendings.",
}, () => ({
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
      text: "Run my weekly invoice chase.\n\n" +
        "1. Call chase_today. For every invoice in send_now, call letter_render for it, show me the letter, and once I confirm it has gone out, call letter_sent for that invoice and stage.\n" +
        "2. Read me the coming_up list so I know what next week holds.\n" +
        "3. For anything in exhausted, say so plainly: all three letters have gone out and the next step is a collections agency or legal advice.\n" +
        "4. Close with aging_summary so I can see the whole register by staleness.\n\n" +
        "Nothing is emailed by the server: I send every letter myself, and letter_sent only records that I did.",
    },
  }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-dunning-letters ${VERSION} ready; store at ${dataDir()}\n`);
