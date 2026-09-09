#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import { formatMoney } from "@theluckystrike/mcp-invoice/lib";
import { isIsoDate, today } from "@theluckystrike/mcp-quotes/lib";
import { z } from "zod";
import { VERSION } from "./version.js";
import {
  DONE_STATUSES, FAR_FUTURE, LATENESS, MAX_DELIVERABLES, MAX_MINOR, MAX_ROWS, MAX_VAT,
  OPEN_STATUSES, REFERENCE_KINDS, STATUSES, TRANSITIONS,
  byWorst, countsOf, currentStatus, deliverableKey, inferReferenceKind, invoiceItems, isComplete,
  kindLabel, latenessOf, milestoneItems, milestoneTotals, normaliseCurrency, normaliseReference,
  normaliseText, quoteItems, rowsOf, statusAsOf, statusLabel, totalsByCurrency,
  transitionError, valueOf, viewOf,
  type Deliverable, type LateRow, type ReferenceKind, type Schedule, type Status,
} from "./schedule.js";
import {
  byReference, dataDir, getSchedules, lockPath, nextDeliverableId, nextId,
  resolveDeliverable, resolveSchedule, setSchedules,
} from "./store.js";

/**
 * Free tier: THREE open delivery schedules, and every answer about what is late.
 *
 * What is metered is the number of jobs in flight, not the ability to see what has
 * slipped. `late_report` is free on every tier because "what is late" is the question this
 * server exists for, and a free tier that withheld it would withhold the one answer the
 * client is going to ask for. Accepting the last deliverable completes a schedule and
 * frees its slot without deleting anything, and an empty schedule can be deleted; both
 * stay free, so the cap is one you can get back under without a key.
 */
const FREE_OPEN_SCHEDULES = 3;
const MAX_NAME = 200;
const MAX_TEXT = 2000;

const gate = createLicenseGate({ product: "delivery-schedule" });

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

function requirePro(feature: string, toolName: string): void {
  if (!gate.isPro()) throw new Error(`${feature} is Pro. Nothing was written. ${gate.upgradeText(feature, toolName)}`);
}

const money = (minor: number, currency: string) => formatMoney(minor, currency);

const BASIS =
  "No status, no lateness and no total is stored. A deliverable holds its due date, its value in minor units and its dated status history; the current status, the delivered date, the acceptance note, what is late and every total are derived on the call. " +
  "Late is read against the as_of date the caller passes, never against the machine's clock, and a deliverable due on as_of is not late yet.";

const AS_OF_BASIS =
  "Every reading is as at as_of: a deliverable delivered after that date has not been delivered yet, an acceptance after it has not happened, and a deliverable is late only once as_of is PAST its due date, so one due on as_of sits in due_today. " +
  "Dates are compared as YYYY-MM-DD text and day counts are the difference of two UTC midnights, so the answer does not move with the machine's timezone.";

/* ---------------------------------------------------------- shared profile */

const profileCurrency = (): string => (readSharedProfile().default_currency ?? "EUR").toUpperCase();

/** VAT for a deliverable with no rate of its own. The profile's rate, or zero when none. */
function profileTaxRate(): { rate: number; source: "shared profile" | "none" } {
  const r = readSharedProfile().default_tax_rate;
  return typeof r === "number" && Number.isFinite(r) ? { rate: r, source: "shared profile" } : { rate: 0, source: "none" };
}

const PLACEHOLDER_ISSUER = "Your business";

/** The name at the top of the document. From the SHARED profile; no sibling store is opened. */
function issuerName(): string {
  const p = readSharedProfile();
  return p.name?.trim() ? p.name : PLACEHOLDER_ISSUER;
}
const issuerAddress = (): string | undefined => readSharedProfile().address;
const businessMissing = (): boolean => !readSharedProfile().name?.trim();

/* ------------------------------------------------------------------ shaping */

/** The as_of a call runs at, and where it came from, so no answer hides which day it read. */
function asOfFrom(value: string | undefined): { as_of: string; as_of_source: "call" | "today" } {
  if (value === undefined) return { as_of: today(), as_of_source: "today" };
  return { as_of: checkDate(value, "as_of"), as_of_source: "call" };
}

function scheduleSummary(s: Schedule, asOf: string) {
  const c = countsOf(s.deliverables, asOf);
  const v = valueOf(s.deliverables);
  return {
    id: s.id,
    reference: s.reference,
    reference_kind: s.reference_kind,
    reference_date: s.reference_date,
    client: s.client,
    title: s.title,
    currency: s.currency,
    complete: isComplete(s),
    counts: c,
    value: money(v.value_minor, s.currency),
    value_minor: v.value_minor,
    unpriced_deliverables: v.unpriced,
    next_due: nextDue(s, asOf),
  };
}

/** The earliest due date still owed as at `asOf`, or null when nothing is outstanding. */
function nextDue(s: Schedule, asOf: string): string | null {
  const owed = s.deliverables
    .filter((d) => OPEN_STATUSES.includes(statusAsOf(d, asOf)))
    .map((d) => d.due_date)
    .sort();
  return owed.length ? owed[0] : null;
}

function scheduleDetail(s: Schedule, asOf: string) {
  const rows = s.deliverables.map((d) => viewOf(d, asOf));
  const v = valueOf(s.deliverables);
  const accepted = s.deliverables.filter((d) => statusAsOf(d, asOf) === "accepted");
  const acceptedValue = valueOf(accepted);
  const lateRows = rows.filter((r) => r.state === "late");
  return {
    ...scheduleSummary(s, asOf),
    note: s.note ?? null,
    deliverables: rows.map((r) => ({
      ...r,
      value: typeof r.value_minor === "number" ? money(r.value_minor, s.currency) : null,
    })),
    late: lateRows.map((r) => ({ id: r.id, description: r.description, due_date: r.due_date, days_late: r.days_late })),
    accepted_value: money(acceptedValue.value_minor, s.currency),
    accepted_value_minor: acceptedValue.value_minor,
    unpriced_accepted: acceptedValue.unpriced,
    priced_deliverables: v.priced,
    created: s.created,
    updated: s.updated,
  };
}

function openCount(list: Schedule[]): number {
  return list.filter((s) => !isComplete(s)).length;
}

function freeTierNote(list: Schedule[]): string | null {
  if (gate.isPro()) return null;
  return `Free tier: ${openCount(list)} of ${FREE_OPEN_SCHEDULES} open schedules. delivery_schedule_document and milestone_payload are Pro.`;
}

/** A row as it is reported, with its money formatted and its minor figure beside it. */
function rowJson(r: LateRow) {
  return {
    schedule: r.schedule,
    reference: r.reference,
    client: r.client,
    deliverable: r.id,
    description: r.description,
    due_date: r.due_date,
    status: r.status,
    state: r.state,
    days_late: r.days_late,
    delivered_date: r.delivered_date,
    accepted_date: r.accepted_date,
    currency: r.currency,
    value: typeof r.value_minor === "number" ? money(r.value_minor, r.currency) : null,
    value_minor: r.value_minor,
  };
}

/* ------------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-delivery-schedule", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

const scheduleArg = str("schedule", MAX_NAME).describe("The schedule id, e.g. DS-2026-0001, the reference it delivers, e.g. WO-2026-0001, or its title");
const deliverableArg = str("deliverable", MAX_NAME).describe("The deliverable id, e.g. D01, or its description when only one carries it");
const asOfArg = str("as_of", 10).optional().describe("Read the schedule as at this date, YYYY-MM-DD. Defaults to today");
const currencyArg = z.string().regex(/^[A-Za-z]{3}$/, "currency must be a 3-letter ISO code such as EUR");

server.registerTool("delivery_schedule_create", {
  title: "Open a delivery schedule",
  description: "Open a delivery schedule against a quote, work order or change order and return its DS-YYYY-NNNN number: the reference, its own date, the client, a title and the currency. Free tier: 3 open.",
  inputSchema: {
    reference: str("reference", 64).describe("The quote, work order or change order this schedule delivers, by its id, e.g. WO-2026-0001, Q-2026-0003 or CO-2026-0001"),
    reference_kind: z.enum(["quote", "work_order", "change_order"]).optional().describe("What the reference is. Inferred from the id when omitted: WO- is a work order, CO- a change order, anything else a quote"),
    reference_date: str("reference_date", 10).describe("The date on the reference document itself, YYYY-MM-DD. No due date and no delivery may fall before it"),
    client: str("client", MAX_NAME).describe("The client the work is delivered to, as named on the reference document"),
    title: str("title", MAX_TEXT).describe("What the job is, in one line, e.g. Website rebuild, phase one"),
    currency: currencyArg.optional().describe("ISO code the deliverables are priced in. Defaults to the shared business profile's currency"),
    note: str("note", MAX_TEXT).optional(),
  },
}, async (a) => {
  try {
    const referenceDate = checkDate(a.reference_date, "reference_date");
    const reference = normaliseReference(a.reference);
    if (!reference) throw new Error("reference is empty. A delivery schedule delivers something; name the quote, work order or change order. Nothing was written.");
    const kind: ReferenceKind = a.reference_kind ?? inferReferenceKind(reference);
    const client = normaliseText(a.client);
    if (!client) throw new Error("client is empty. Nothing was written.");
    const title = normaliseText(a.title);
    if (!title) throw new Error("title is empty. A schedule with no title is a job nobody can point at. Nothing was written.");
    const currency = normaliseCurrency(a.currency ?? profileCurrency());

    const rec = await locked(() => {
      const list = getSchedules();

      // One reference carries ONE schedule, and it is refused before the cap so the
      // refusal names an id rather than selling an upgrade. Two schedules against one
      // work order give two answers to "what is late on it", and the caller sees
      // whichever they happened to open.
      const twin = byReference(list, reference);
      if (twin) {
        throw new Error(
          `${reference} already has a delivery schedule: ${twin.id}, "${twin.title}" for ${twin.client}, ${twin.deliverables.length} deliverable(s). ` +
          `One reference carries one schedule, because two would give two answers to what is late on it. Add to ${twin.id} with deliverable_add. Nothing was written.`,
        );
      }
      const open = openCount(list);
      if (!gate.isPro() && open >= FREE_OPEN_SCHEDULES) {
        throw new Error(
          `the free tier holds ${FREE_OPEN_SCHEDULES} open delivery schedules and ${open} are open (${list.filter((s) => !isComplete(s)).map((s) => `${s.id} ${s.reference}`).join(", ")}). ` +
          `A schedule stops counting once every deliverable on it is accepted, and an empty one can be removed with delivery_schedule_delete. Both of those stay free. Nothing was written. ` +
          gate.upgradeText("unlimited delivery schedules", "delivery_schedule_create"),
        );
      }
      const id = nextId(referenceDate.slice(0, 4), list.map((s) => s.id));
      const now = new Date().toISOString();
      const s: Schedule = {
        id, reference, reference_kind: kind, reference_date: referenceDate,
        client, title, currency, deliverables: [], deliverable_counter: 0,
        note: a.note, created: now, updated: now,
      };
      list.push(s);
      setSchedules(list);
      return { s, list };
    });

    const notes: string[] = [];
    const free = freeTierNote(rec.list);
    if (free) notes.push(free);
    return json({
      created: scheduleDetail(rec.s, today()),
      next: "Add every dated deliverable with deliverable_add, then move each one along with deliverable_status as it is started, handed over and signed off. late_report says what has slipped as at any date you name.",
      notes, basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("deliverable_add", {
  title: "Add a dated deliverable",
  description: "Add one dated deliverable and return its D number and the new counts. value_minor is NET of VAT in whole MINOR units. A due date before the reference document's own date is refused. It starts as planned.",
  inputSchema: {
    schedule: scheduleArg,
    description: str("description", MAX_TEXT).describe("What is being handed over, as the client would recognise it, e.g. Wireframes for the five main pages"),
    due_date: str("due_date", 10).describe("The day it is due, YYYY-MM-DD. It cannot fall before the reference document's own date"),
    value_minor: z.number().int().min(0).max(MAX_MINOR).optional().describe("What this deliverable is worth, net of VAT, in whole minor units. 90000 is EUR 900.00. Leave it out when the job is a lump sum and this deliverable carries no price of its own"),
    tax_rate: z.number().finite().min(0).max(MAX_VAT).optional().describe("VAT percent for this deliverable, overriding the shared business profile's default"),
    note: str("note", MAX_TEXT).optional(),
    duplicate_ok: z.boolean().optional().describe("Add it even though this schedule already carries the same description due on the same day. Default false"),
  },
}, async (a) => {
  try {
    const dueDate = checkDate(a.due_date, "due_date");
    const description = normaliseText(a.description);
    if (!description) throw new Error("description is empty. A deliverable the client cannot recognise is one they will not sign off. Nothing was written.");

    const out = await locked(() => {
      const list = getSchedules();
      const s = resolveSchedule(list, a.schedule);
      if (dueDate < s.reference_date) {
        throw new Error(
          `${s.id} delivers ${s.reference} dated ${s.reference_date}, and this deliverable is due ${dueDate}, before it. ` +
          `Nothing can be owed before the document that ordered it exists. Check the due date, or the reference date on the schedule. Nothing was written.`,
        );
      }
      if (s.deliverables.length >= MAX_DELIVERABLES) {
        throw new Error(`${s.id} already carries ${MAX_DELIVERABLES} deliverables, which is the ceiling. Nothing was written.`);
      }
      const key = deliverableKey({ description, due_date: dueDate });
      const twin = s.deliverables.find((d) => deliverableKey(d) === key);
      if (twin && !a.duplicate_ok) {
        throw new Error(
          `${s.id} already carries ${twin.id}: "${twin.description}", due ${twin.due_date}, ${statusLabel(currentStatus(twin))}. ` +
          `Two of one deliverable make every late report count the same miss twice. Nothing was written. If this really is a second hand-over on the same day, pass duplicate_ok true, or say what is different in the description.`,
        );
      }
      const now = new Date().toISOString();
      const d: Deliverable = {
        id: nextDeliverableId(s),
        description,
        due_date: dueDate,
        value_minor: a.value_minor ?? null,
        tax_rate: a.tax_rate ?? null,
        history: [],
        note: a.note,
        created: now,
      };
      s.deliverables.push(d);
      s.updated = now;
      setSchedules(list);
      return { s, d, twin };
    });

    const notes: string[] = [];
    if (out.d.value_minor === null) {
      notes.push(`${out.d.id} carries no value, so it is counted as unpriced everywhere a total is printed and milestone_payload has nothing to bill for it. Add value_minor if this deliverable is separately priced.`);
    }
    if (out.twin) notes.push(`${out.twin.id} is the same deliverable due on the same day and was allowed through because duplicate_ok was passed.`);
    return json({
      added: { ...viewOf(out.d, today()), value: out.d.value_minor === null ? null : money(out.d.value_minor, out.s.currency) },
      schedule: scheduleSummary(out.s, today()),
      notes, basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("deliverable_status", {
  title: "Move a deliverable along",
  description: "Record a dated move on one deliverable: planned, in_progress, delivered, then accepted with a note. An out-of-order move, or a date before the reference document, is refused. The date drives lateness.",
  inputSchema: {
    schedule: scheduleArg,
    deliverable: deliverableArg,
    status: z.enum(["in_progress", "delivered", "accepted"]).describe("The status to move to"),
    date: str("date", 10).optional().describe("The day it happened, YYYY-MM-DD. Default today. This is the date every late reading is taken against, not the day you type it"),
    note: str("note", MAX_TEXT).optional().describe("What happened. On accepted this is the acceptance note, e.g. Signed off by the client on the call, no snags"),
  },
}, async (a) => {
  try {
    const date = a.date ? checkDate(a.date, "date") : today();
    const out = await locked(() => {
      const list = getSchedules();
      const s = resolveSchedule(list, a.schedule);
      const d = resolveDeliverable(s, a.deliverable);
      const from = currentStatus(d);
      const to = a.status as Status;
      const why = transitionError(from, to);
      if (why) throw new Error(`${s.id} ${d.id} "${d.description}" ${why}. Nothing was written.`);
      if (date < s.reference_date) {
        throw new Error(
          `${s.id} delivers ${s.reference} dated ${s.reference_date}, and this move is dated ${date}, before it. ` +
          `Work cannot have been ${statusLabel(to)} before the document that ordered it exists. Nothing was written.`,
        );
      }
      const last = d.history.length ? d.history[d.history.length - 1] : null;
      if (last && date < last.date) {
        throw new Error(
          `${d.id} reached ${statusLabel(last.to)} on ${last.date} and this move is dated ${date}, before it. ` +
          `A status history that runs backwards cannot be read as a timeline, and every late reading is taken from it. Nothing was written.`,
        );
      }
      const now = new Date().toISOString();
      const event = { from, to, date, note: a.note, at: now };
      d.history.push(event);
      s.updated = now;
      setSchedules(list);
      return { s, d, event, list };
    });

    const notes: string[] = [];
    const day = today();
    const late = latenessOf(out.d, day);
    if (out.event.to === "delivered") {
      notes.push(late.state === "delivered_late"
        ? `${out.d.id} was due ${out.d.due_date} and was delivered ${out.event.date}, ${late.days_late} day(s) late. That is now a fact about the delivery and no longer moves with the report date.`
        : `${out.d.id} was due ${out.d.due_date} and was delivered ${out.event.date}, on time. It is off every late report from here on.`);
      notes.push("It is not billable yet. milestone_payload carries a deliverable only once the client has accepted it.");
    }
    if (out.event.to === "accepted") {
      if (!out.event.note) notes.push("No acceptance note was recorded. The note is the only record of what the client actually signed off; pass note on the accepted move.");
      if (out.d.value_minor === null) notes.push(`${out.d.id} carries no value, so it adds nothing to milestone_payload. Its acceptance is still on the record.`);
      if (isComplete(out.s)) {
        notes.push(`Every deliverable on ${out.s.id} is now accepted, so the schedule is complete${gate.isPro() ? "" : " and no longer counts against the free cap"}.`);
      }
    }
    const free = freeTierNote(out.list);
    if (free) notes.push(free);
    return json({
      deliverable: { ...viewOf(out.d, day), value: out.d.value_minor === null ? null : money(out.d.value_minor, out.s.currency) },
      moved: out.event,
      history: out.d.history,
      schedule: scheduleSummary(out.s, day),
      read_as_at: day,
      notes, basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("deliverable_delete", {
  title: "Delete a planned deliverable",
  description: "Delete one deliverable still planned with no history. One started, delivered or accepted is refused, naming when: add a corrected deliverable instead. The D number on a schedule is never reissued.",
  inputSchema: { schedule: scheduleArg, deliverable: deliverableArg },
}, async (a) => {
  try {
    const out = await locked(() => {
      const list = getSchedules();
      const s = resolveSchedule(list, a.schedule);
      const d = resolveDeliverable(s, a.deliverable);
      if (d.history.length) {
        const last = d.history[d.history.length - 1];
        throw new Error(
          `${d.id} is ${statusLabel(last.to)} since ${last.date} and cannot be deleted. A status history is a record of what was handed over and when, and deleting it would take a delivery off the books. ` +
          `Leave it as it stands and add the corrected deliverable with its own due date. Nothing was written.`,
        );
      }
      s.deliverables = s.deliverables.filter((x) => x.id !== d.id);
      s.updated = new Date().toISOString();
      setSchedules(list);
      return { s, d };
    });
    return json({
      deleted: { id: out.d.id, description: out.d.description, due_date: out.d.due_date, value_minor: out.d.value_minor },
      schedule: scheduleSummary(out.s, today()),
      note: "The id is not reissued. The D series on one schedule only ever goes up, so a gap in it is the record that a deliverable was removed.",
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("delivery_schedule_get", {
  title: "Show one delivery schedule",
  description: "Return one schedule in full as at a date: every deliverable with due date, status, delivered and accepted dates, note and value, plus what is late and the totals. The answer names the as_of it used.",
  inputSchema: { schedule: scheduleArg, as_of: asOfArg },
}, async (a) => {
  try {
    const { as_of, as_of_source } = asOfFrom(a.as_of);
    const s = resolveSchedule(getSchedules(), a.schedule);
    return json({
      as_of, as_of_source,
      schedule: scheduleDetail(s, as_of),
      as_of_basis: AS_OF_BASIS,
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("delivery_schedule_list", {
  title: "List delivery schedules",
  description: "List schedules oldest reference first with client, currency and counts as at a date: late, still owed, accepted. Filter by client, reference and state open or complete. Free.",
  inputSchema: {
    client: str("client", MAX_NAME).optional().describe("Only schedules whose client name contains this text"),
    reference: str("reference", 64).optional().describe("Only the schedule against this quote, work order or change order"),
    state: z.enum(["open", "complete"]).optional().describe("open for a job with a deliverable that is not yet accepted, complete for one where every deliverable is"),
    as_of: asOfArg,
    limit: z.number().int().min(1).max(MAX_ROWS).optional().describe(`Maximum schedules returned, default and ceiling ${MAX_ROWS}`),
  },
}, async (a) => {
  try {
    const { as_of, as_of_source } = asOfFrom(a.as_of);
    let list = getSchedules();
    if (a.reference) {
      const ref = normaliseReference(a.reference);
      list = list.filter((s) => s.reference === ref);
    }
    if (a.client) {
      const needle = a.client.trim().toLowerCase();
      list = list.filter((s) => s.client.toLowerCase().includes(needle));
    }
    if (a.state === "open") list = list.filter((s) => !isComplete(s));
    else if (a.state === "complete") list = list.filter((s) => isComplete(s));
    const sorted = [...list].sort((x, y) => x.reference_date.localeCompare(y.reference_date) || x.id.localeCompare(y.id));
    const limit = a.limit ?? MAX_ROWS;
    const shown = sorted.slice(0, limit);
    const truncated = sorted.length > limit;
    return json({
      as_of, as_of_source,
      count: sorted.length,
      returned: shown.length,
      truncated,
      truncation: truncated
        ? `${sorted.length - shown.length} schedule(s) matched and are NOT in this answer, because limit is ${limit}. Raise limit (ceiling ${MAX_ROWS}) or narrow the filters. This is not a free-tier limit.`
        : null,
      schedules: shown.map((s) => scheduleSummary(s, as_of)),
      free_tier_open_limit: gate.isPro() ? null : FREE_OPEN_SCHEDULES,
      open_schedules: openCount(getSchedules()),
      note: "Values are never added across currencies. This server holds no exchange rate, so one schedule priced in EUR and one in PLN have no common total.",
      as_of_basis: AS_OF_BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("delivery_schedule_delete", {
  title: "Delete an empty schedule",
  description: "Delete a schedule carrying no deliverables, freeing an open slot. One holding any is refused, naming them, since they record what was owed. The DS number is never reissued. Free on every tier.",
  inputSchema: { schedule: scheduleArg },
}, async (a) => {
  try {
    const out = await locked(() => {
      const list = getSchedules();
      const s = resolveSchedule(list, a.schedule);
      if (s.deliverables.length) {
        throw new Error(
          `${s.id} carries ${s.deliverables.length} deliverable(s) (${s.deliverables.map((d) => d.id).join(", ")}) and cannot be deleted. ` +
          `They are the record of what was owed on ${s.reference} and when. Delete the planned ones with deliverable_delete first, or leave the schedule as it stands. Nothing was written.`,
        );
      }
      const rest = list.filter((x) => x.id !== s.id);
      setSchedules(rest);
      return { s, rest };
    });
    return json({
      deleted: { id: out.s.id, reference: out.s.reference, client: out.s.client, title: out.s.title },
      open_schedules: openCount(out.rest),
      free_tier_open_limit: gate.isPro() ? null : FREE_OPEN_SCHEDULES,
      note: "The number is not reissued. The DS series only ever goes up, so a gap in it is the record that a schedule was deleted.",
    });
  } catch (e) { return fail((e as Error).message); }
});

/* ------------------------------------------------------------- late report */

server.registerTool("late_report", {
  title: "What is late as at a date",
  description: "What has slipped as at a date: every deliverable still owed past its due date, worst first, with value at risk per currency, and what was delivered late kept apart. A reference with no schedule is refused.",
  inputSchema: {
    as_of: str("as_of", 10).optional().describe("Read lateness as at this date, YYYY-MM-DD. Defaults to today. Everything in the answer is as at this date, not as at now"),
    reference: str("reference", 64).optional().describe("Only the schedule against this quote, work order or change order"),
    client: str("client", MAX_NAME).optional().describe("Only schedules whose client name contains this text"),
    include_delivered_late: z.boolean().optional().describe("Include what was handed over after its due date but is no longer outstanding. Default true"),
    limit: z.number().int().min(1).max(MAX_ROWS).optional().describe(`Maximum rows per section, default and ceiling ${MAX_ROWS}`),
  },
}, async (a) => {
  try {
    const { as_of, as_of_source } = asOfFrom(a.as_of);
    let list = getSchedules();
    if (a.reference) {
      const ref = normaliseReference(a.reference);
      list = list.filter((s) => s.reference === ref);
      if (!list.length) {
        throw new Error(`no delivery schedule is on file against "${ref}", so nothing can be said about what is late on it. Open one with delivery_schedule_create. Nothing was invented.`);
      }
    }
    if (a.client) {
      const needle = a.client.trim().toLowerCase();
      list = list.filter((s) => s.client.toLowerCase().includes(needle));
    }
    const rows = list.flatMap((s) => rowsOf(s, as_of));
    const late = rows.filter((r) => r.state === "late").sort(byWorst);
    const dueToday = rows.filter((r) => r.state === "due_today").sort(byWorst);
    const deliveredLate = rows.filter((r) => r.state === "delivered_late").sort(byWorst);
    const limit = a.limit ?? MAX_ROWS;
    const withLate = a.include_delivered_late ?? true;

    const cut = (rs: LateRow[]) => ({ shown: rs.slice(0, limit), hidden: Math.max(0, rs.length - limit) });
    const lateCut = cut(late);
    const dueCut = cut(dueToday);
    const dlCut = withLate ? cut(deliveredLate) : { shown: [] as LateRow[], hidden: 0 };
    const hidden = lateCut.hidden + dueCut.hidden + dlCut.hidden;

    const notes: string[] = [];
    if (hidden) {
      notes.push(`${hidden} row(s) matched and are NOT in this answer, because limit is ${limit}. Raise limit (ceiling ${MAX_ROWS}) or narrow the report by reference or client. The counts above every section are complete; only the rows are cut.`);
    }
    if (!withLate && deliveredLate.length) {
      notes.push(`${deliveredLate.length} deliverable(s) were handed over after their due date and are not listed, because include_delivered_late was false. They are counted in delivered_late_count.`);
    }
    const unpricedLate = late.filter((r) => r.value_minor === null).length;
    if (unpricedLate) {
      notes.push(`${unpricedLate} late deliverable(s) carry no value and are counted apart rather than added in as zero, so value_at_risk understates what is at stake by whatever those are worth.`);
    }
    if (!late.length) {
      notes.push(`Nothing is late as at ${as_of}. A deliverable due on ${as_of} is not late yet; it is in due_today.`);
    }
    const free = freeTierNote(getSchedules());
    if (free) notes.push(free);

    return json({
      as_of, as_of_source,
      scope: { reference: a.reference ? normaliseReference(a.reference) : null, client: a.client ?? null, schedules: list.length, deliverables: rows.length },
      late_count: late.length,
      due_today_count: dueToday.length,
      delivered_late_count: deliveredLate.length,
      not_yet_due_count: rows.filter((r) => r.state === "not_yet_due").length,
      delivered_on_time_count: rows.filter((r) => r.state === "delivered_on_time").length,
      worst: late.length ? rowJson(late[0]) : null,
      value_at_risk: totalsByCurrency(late).map((t) => ({ ...t, value: money(t.value_minor, t.currency) })),
      late: lateCut.shown.map(rowJson),
      due_today: dueCut.shown.map(rowJson),
      delivered_late: dlCut.shown.map(rowJson),
      truncated: hidden > 0,
      rows_not_shown: hidden,
      notes,
      as_of_basis: AS_OF_BASIS,
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

/* ------------------------------------------------------------------ document */

const SIGN_OFF_BLOCK = [
  "Accepted for the client by ..............................  Date ..................",
  "Handed over for the contractor by ......................  Date ..................",
];

function documentText(s: Schedule, asOf: string): string {
  const c = countsOf(s.deliverables, asOf);
  const v = valueOf(s.deliverables);
  const accepted = s.deliverables.filter((d) => statusAsOf(d, asOf) === "accepted");
  const acceptedValue = valueOf(accepted);
  const cur = s.currency;
  const out: string[] = [];
  out.push("DELIVERY SCHEDULE");
  out.push(s.id);
  out.push("");
  out.push(issuerName());
  const addr = issuerAddress();
  if (addr) out.push(addr);
  out.push("");
  out.push(`Client        ${s.client}`);
  out.push(`Against       ${s.reference} (${kindLabel(s.reference_kind)}, dated ${s.reference_date})`);
  out.push(`Job           ${s.title}`);
  out.push(`As at         ${asOf}`);
  out.push("");
  out.push("DELIVERABLES");
  if (!s.deliverables.length) out.push("  none recorded");
  for (const d of s.deliverables) {
    const r = viewOf(d, asOf);
    const value = typeof d.value_minor === "number" ? money(d.value_minor, cur) : "not separately priced";
    out.push(`  ${d.id}  due ${d.due_date}  ${d.description}`);
    out.push(`        ${statusLabel(r.status).padEnd(12)} ${value}`);
    if (r.delivered_date) out.push(`        delivered ${r.delivered_date}${r.state === "delivered_late" ? `, ${r.days_late} day(s) late` : ", on time"}`);
    if (r.accepted_date) out.push(`        accepted  ${r.accepted_date}${r.acceptance_note ? `: ${r.acceptance_note}` : ""}`);
    if (r.state === "late") out.push(`        LATE by ${r.days_late} day(s) as at ${asOf}`);
    if (r.state === "due_today") out.push(`        due today`);
  }
  out.push("");
  out.push(`AS AT ${asOf}`);
  out.push(`  Deliverables        ${c.deliverables}`);
  out.push(`  Planned             ${c.planned}`);
  out.push(`  In progress         ${c.in_progress}`);
  out.push(`  Delivered           ${c.delivered}`);
  out.push(`  Accepted            ${c.accepted}`);
  out.push(`  Late                ${c.late}`);
  out.push(`  Delivered late      ${c.delivered_late}`);
  out.push("");
  out.push("VALUE (net of VAT)");
  out.push(`  Whole schedule      ${money(v.value_minor, cur)}${v.unpriced ? `  (plus ${v.unpriced} deliverable(s) not separately priced)` : ""}`);
  out.push(`  Accepted so far     ${money(acceptedValue.value_minor, cur)}${acceptedValue.unpriced ? `  (plus ${acceptedValue.unpriced} not separately priced)` : ""}`);
  out.push("");
  out.push("SIGN-OFF");
  for (const line of SIGN_OFF_BLOCK) out.push(`  ${line}`);
  if (s.note) { out.push(""); out.push("NOTES"); out.push(`  ${s.note}`); }
  return out.join("\n");
}

server.registerTool("delivery_schedule_document", {
  title: "Delivery schedule document",
  description: "Render one schedule as a plain-text document for the client: every deliverable with its due date, status, delivered and accepted dates and value, the counts as at a date, and a sign-off block. Pro.",
  inputSchema: { schedule: scheduleArg, as_of: asOfArg },
}, async (a) => {
  try {
    requirePro("the delivery schedule document", "delivery_schedule_document");
    const { as_of, as_of_source } = asOfFrom(a.as_of);
    const s = resolveSchedule(getSchedules(), a.schedule);
    const c = countsOf(s.deliverables, as_of);
    const notes: string[] = [];
    if (!s.deliverables.length) notes.push(`${s.id} has no deliverables, so the document promises nothing.`);
    if (businessMissing()) notes.push(`No business profile yet, so the document is headed "${PLACEHOLDER_ISSUER}". Run business_set {name, address} in the invoice server once.`);
    if (as_of_source === "today") notes.push(`No as_of was passed, so the document reads as at today, ${as_of}. Pass as_of to print it as at the day of a meeting instead.`);
    return ok(
      `${documentText(s, as_of)}\n\n${notes.length ? `${notes.join("\n")}\n\n` : ""}` +
      `${JSON.stringify({ schedule: s.id, as_of, late: c.late, accepted: c.accepted, deliverables: c.deliverables }, null, 2)}`,
    );
  } catch (e) { return fail((e as Error).message); }
});

/* --------------------------------------------------------- milestone payload */

server.registerTool("milestone_payload", {
  title: "Invoice payload for accepted milestones",
  description: "Build the delivered-and-accepted deliverables as invoice_create-ready items in MAJOR units and quote_create-ready items in MINOR units, with VAT at the shared profile rate. Writes nothing. Pro.",
  inputSchema: {
    schedule: scheduleArg,
    as_of: str("as_of", 10).optional().describe("Bill what had been accepted by this date, YYYY-MM-DD. Defaults to today"),
    issue_date: str("issue_date", 10).optional().describe("The invoice issue date, YYYY-MM-DD. Default today"),
    tax_rate: z.number().finite().min(0).max(MAX_VAT).optional().describe("VAT percent for deliverables with no rate of their own, overriding the shared business profile's default"),
  },
}, async (a) => {
  try {
    requirePro("the milestone invoice payload", "milestone_payload");
    const { as_of, as_of_source } = asOfFrom(a.as_of);
    const issue = a.issue_date ? checkDate(a.issue_date, "issue_date") : today();
    const s = resolveSchedule(getSchedules(), a.schedule);
    if (!s.deliverables.length) throw new Error(`${s.id} has no deliverables, so there is no milestone to invoice. Add them with deliverable_add.`);

    const accepted = s.deliverables.filter((d) => statusAsOf(d, as_of) === "accepted");
    if (!accepted.length) {
      const c = countsOf(s.deliverables, as_of);
      throw new Error(
        `nothing on ${s.id} had been accepted by ${as_of}: ${c.planned} planned, ${c.in_progress} in progress, ${c.delivered} delivered and awaiting sign-off. ` +
        `A delivery the client has not accepted is not an agreed milestone, and billing one bills for work they may still send back. Record the acceptance with deliverable_status, then build the payload.`,
      );
    }
    const priced = accepted.filter((d) => typeof d.value_minor === "number");
    if (!priced.length) {
      throw new Error(
        `${accepted.length} deliverable(s) on ${s.id} were accepted by ${as_of} (${accepted.map((d) => d.id).join(", ")}) and not one carries a value, so there is nothing to bill. ` +
        `This server will not price a milestone it was never given a price for. Add value_minor to the deliverables that are separately priced, or invoice the job from the quote instead.`,
      );
    }

    const profile = profileTaxRate();
    const rate = a.tax_rate ?? profile.rate;
    const source = a.tax_rate === undefined ? profile.source : "call";
    const items = milestoneItems(accepted, as_of, rate);
    const t = milestoneTotals(items, s.currency);
    const invoice = invoiceItems(items, s.currency).map((i) => ({
      description: i.description, quantity: i.quantity, unit_price: i.unit_price, tax_rate: i.tax_rate,
    }));
    const quote = quoteItems(items, s.currency);
    const unpricedAccepted = accepted.filter((d) => typeof d.value_minor !== "number");
    const outstanding = s.deliverables.filter((d) => statusAsOf(d, as_of) !== "accepted");

    const notes: string[] = [];
    if (source === "none") notes.push("The shared business profile carries no default_tax_rate and no deliverable carried its own, so VAT is 0% on those lines. Run business_set {default_tax_rate} in the invoice server, or pass tax_rate.");
    if (unpricedAccepted.length) {
      notes.push(
        `${unpricedAccepted.length} accepted deliverable(s) carry no value and are NOT in the items: ${unpricedAccepted.map((d) => `${d.id} "${d.description}"`).join(", ")}. ` +
        `They were not billed as zero and they were not priced by this server; add value_minor if they are separately priced.`,
      );
    }
    if (outstanding.length) {
      notes.push(`${outstanding.length} deliverable(s) on ${s.id} had not been accepted by ${as_of} and are not in this payload. This is a milestone invoice, not the whole job.`);
    }
    if (as_of_source === "today") notes.push(`No as_of was passed, so the payload bills what had been accepted by today, ${as_of}.`);

    return json({
      schedule: s.id, reference: s.reference, reference_kind: s.reference_kind, client: s.client, currency: s.currency,
      as_of, as_of_source, issue_date: issue,
      vat_rate_fallback: rate, vat_rate_source: source,
      milestones: items.map((i) => ({
        deliverable: i.deliverable,
        description: i.description,
        due_date: s.deliverables.find((d) => d.id === i.deliverable)?.due_date ?? null,
        delivered_date: i.delivered_date,
        accepted_date: i.accepted_date,
        quantity: i.quantity,
        unit_price: money(i.unit_price_minor, s.currency), unit_price_minor: i.unit_price_minor,
        tax_rate: i.tax_rate,
        value: money(i.value_minor, s.currency), value_minor: i.value_minor,
      })),
      invoice_create: {
        tool: "invoice_create", server: "invoice",
        arguments: {
          client: s.client, currency: s.currency, issue_date: issue, items: invoice,
          notes: `Delivery schedule ${s.id} against ${s.reference}: milestones accepted by ${as_of}.`,
        },
        unit: "MAJOR units, which is what invoice_create's unit_price takes",
      },
      quote_create: {
        tool: "quote_create", server: "quotes",
        arguments: { client: s.client, currency: s.currency, items: quote },
        unit: "MINOR units, which is what quote_create's unit_price_minor takes",
        ready: true,
      },
      totals: {
        subtotal: money(t.subtotal_minor, s.currency), subtotal_minor: t.subtotal_minor,
        net: money(t.net_minor, s.currency), net_minor: t.net_minor,
        tax_lines: t.tax_lines,
        vat: money(t.tax_minor, s.currency), vat_minor: t.tax_minor,
        total: money(t.total_minor, s.currency), total_minor: t.total_minor,
        rounding_drift_minor: t.rounding_drift_minor,
      },
      excluded: {
        accepted_but_unpriced: unpricedAccepted.map((d) => ({ id: d.id, description: d.description, due_date: d.due_date })),
        not_yet_accepted: outstanding.map((d) => ({ id: d.id, description: d.description, due_date: d.due_date, status: statusAsOf(d, as_of) })),
      },
      posted: false,
      note: "Nothing was written and nothing was created. Call invoice_create in the invoice server with the arguments above; the quote_create arguments are the same milestones in the other scale.",
      basis:
        "The same milestone appears twice above in two scales because the two tools take two scales: invoice_create's unit_price is in MAJOR units and quote_create's unit_price_minor is in MINOR units. " +
        "Passing one into the other misprices a 2-decimal line by 100x. Every unit price is a whole minor unit, so computeTotals rounds it straight back and rounding_drift_minor is zero. " +
        "Only a deliverable that was DELIVERED and then ACCEPTED by as_of is here; an accepted deliverable with no value of its own is listed under excluded rather than billed as zero.",
      notes,
    });
  } catch (e) { return fail((e as Error).message); }
});

gate.registerTools(server);

/* ------------------------------------------------------- resource and prompt */

server.registerResource("contract", "deliveryschedule://contract", {
  title: "The status machine, why late is not stored, the two scales and the free tier",
  description: "The four stored statuses and the legal moves, how lateness is derived from as_of, the two payload scales, the free-tier limits and the one directory this server writes.",
  mimeType: "application/json",
}, async () => ({
  contents: [{
    uri: "deliveryschedule://contract", mimeType: "application/json",
    text: JSON.stringify({
      statuses: STATUSES,
      open_statuses: OPEN_STATUSES,
      done_statuses: DONE_STATUSES,
      transitions: TRANSITIONS,
      lateness_states: LATENESS,
      late_is_not_a_status:
        "late is derived from the due date and the as_of the caller passes, and it changes as that date moves. A deliverable is late once as_of is PAST its due date; one due on as_of is due_today, not late. " +
        "A delivered deliverable is delivered_late or delivered_on_time by comparing the delivered date with the due date, which no longer moves with as_of.",
      reference_kinds: REFERENCE_KINDS,
      date_floor: "no due date and no status move may fall before the reference document's own date, which is stated once on the schedule",
      one_schedule_per_reference: true,
      payload_scales: {
        invoice_create: "unit_price in MAJOR units",
        quote_create: "unit_price_minor in MINOR units",
        stored: "MINOR units, the only lossless form",
      },
      unpriced_deliverables: "a deliverable with no value_minor is not worth zero: it is counted apart everywhere a total is printed and is excluded by name from the milestone payload",
      free_tier: {
        open_schedules: FREE_OPEN_SCHEDULES,
        free_tools: [
          "delivery_schedule_create", "deliverable_add", "deliverable_status", "deliverable_delete",
          "delivery_schedule_get", "delivery_schedule_list", "delivery_schedule_delete", "late_report",
        ],
        pro_tools: ["delivery_schedule_document", "milestone_payload"],
      },
      caps: { deliverables_per_schedule: MAX_DELIVERABLES, rows_per_answer: MAX_ROWS },
      writes: [{ store: "delivery-schedule", dir: dataDir(), files: ["schedules.json", "counter.json"] }],
      reads: [{ store: "profile", file: "business.json", why: "the default currency, the default VAT rate and the name on the document", writes: false }],
      creates_invoices: false,
      creates_quotes: false,
      far_future: FAR_FUTURE,
      today: today(),
    }, null, 2),
  }],
}));

server.registerPrompt("run_the_schedule", {
  title: "Plan the deliveries and report what is late",
  description: "Open a schedule against a quote, work order or change order, add the dated deliverables, record each hand-over and sign-off, and bill the accepted milestones.",
  argsSchema: { reference: z.string().describe("The quote, work order or change order id, e.g. WO-2026-0001, Q-2026-0003 or CO-2026-0001") },
}, ({ reference }) => ({
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
      text: `Set up and run the delivery schedule for ${reference}.\n\n` +
        `1. Call delivery_schedule_create with ${reference}, the date on that document, the client and a one-line title. One reference carries one schedule.\n` +
        `2. Call deliverable_add for every dated hand-over: a description the client would recognise, the due date, and value_minor in whole minor units when it is separately priced. Leave value_minor out rather than guessing a price; an unpriced deliverable is reported as unpriced, never as zero.\n` +
        `3. As work moves, call deliverable_status with the day it actually happened: in_progress, then delivered, then accepted with the client's own words in note. Accepting something that was never delivered is refused.\n` +
        `4. Call late_report with the as_of date you are reporting for. Everything in it is read as at that date, not as at now, so a report for the end of last month says what was late then.\n` +
        `5. When milestones are signed off, call milestone_payload and pass invoice_create.arguments straight to the invoice server. Do not retype or rescale a figure: the invoice payload is in MAJOR units and the quote payload is in MINOR units, and swapping them misprices the milestone by 100x.`,
    },
  }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-delivery-schedule ${VERSION} ready; store at ${dataDir()}\n`);
