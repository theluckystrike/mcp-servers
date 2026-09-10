#!/usr/bin/env node
/**
 * mcp-packing-list: the packing slip for a shipment, and what is still to pack against the
 * order it ships on.
 *
 * The document this server produces carries NO PRICES. That is the whole point of a packing
 * slip: it travels inside the box, and the consignee's warehouse is not the party that sees
 * what the goods cost. The invoice against the same order is a different document and lives
 * in the invoice server.
 */
import { closeSync, existsSync, mkdirSync, openSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import { isIsoDate, today } from "@theluckystrike/mcp-quotes/lib";
import { z } from "zod";
import { VERSION } from "./version.js";
import {
  CLOSED_STATUSES, DEFAULT_DIVISOR, DIVISORS, MAX_CARTONS, MAX_CM, MAX_GRAMS, MAX_LINES, MAX_QUANTITY, MAX_ROWS,
  OPEN_STATUSES, REFERENCE_KINDS, STATUSES, TRANSITIONS,
  cartonReport, inferReferenceKind, isOpen, kg, linesIn, matchKey, normaliseReference, normaliseSku,
  normaliseText, readyToShip, shipmentTotals, shortfall, slipText, transitionError,
  type Carton, type ExpectedLine, type PackedLine, type PackingList, type ReferenceKind, type Status,
} from "./packing.js";
import { byReference, dataDir, getLists, lockPath, nextId, nextSeq, resolveList, setLists } from "./store.js";

/**
 * Free tier: THREE open packing lists, and every text answer including the slip itself.
 *
 * What is metered is the number of shipments in flight at once, not the ability to see what
 * is in a box or what is still short. `packing_shortfall`, `carton_report` and the slip TEXT
 * are free on every tier, because those are the questions this server exists for and a free
 * tier that withheld them would withhold the reason to install it. Marking a list shipped or
 * cancelling it frees its slot, and so does deleting a draft, so the cap is one a user can
 * get back under without a key (docs/RECOVERABLE_SLOTS_RESULT.md).
 *
 * What Pro adds is writing the slip to a FILE with out_path. The text always comes back.
 */
const FREE_OPEN_LISTS = 3;
const MAX_NAME = 200;
const MAX_TEXT = 2000;

const gate = createLicenseGate({ product: "packing-list" });

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

/* ------------------------------------------------------------------- paths */

/** A leading `<scheme>://` means the caller has a URL, not a local path. Checked BEFORE any
 * resolution, so a URL is never joined against the server's cwd and the refusal never has a
 * path in it, let alone one that leaks the cwd. */
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

function expandPath(p: string): string {
  if (URL_SCHEME_RE.test(p)) {
    throw new Error(`"${p}" is a URL, not a file path; out_path writes a local file. Omit out_path to get the slip back as text.`);
  }
  const s = p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

/**
 * Create a directory and any missing ancestors, without mkdirSync's recursive mode.
 *
 * mkdirSync(recursive) never returns on a pseudo-filesystem: measured on Linux in a
 * node:22-alpine container, mkdir("/proc/nope") answers ENOENT in 0 ms, Node reads that as a
 * missing parent and retries forever, and the call had not returned after 25 seconds. Any
 * caller-supplied output path under /proc, /sys or /dev hung the server permanently. The
 * ancestors are walked here under a hard bound and each level is created non-recursively, so
 * a repeated ENOENT terminates on the first one. Verified on Linux: /proc throws ENOENT and
 * /sys throws EROFS, both in 0 ms, while a normal nested path still succeeds.
 */
function ensureDirBounded(dir: string): void {
  if (existsSync(dir)) return;
  const missing: string[] = [];
  let cur = dir;
  for (let i = 0; i < 64 && !existsSync(cur); i++) {
    missing.push(cur);
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  if (!existsSync(cur)) throw new Error(`cannot create ${dir}: no existing ancestor directory`);
  for (const d of missing.reverse()) mkdirSync(d);
}

/**
 * Reserve the output path with an exclusive create, never with an existence check: two
 * processes writing a derived path would both pass the check and the second would clobber the
 * first. A path this server derived itself gets -2, -3, ... instead; a path the CALLER gave is
 * refused rather than renamed, because silently writing beside the name a caller asked for is
 * how a slip ends up in a directory nobody looks in.
 */
function outputPath(out: string | undefined, fallbackName: string, ext: string, overwrite: boolean): string {
  const p = expandPath(out ?? join(dataDir(), "documents", fallbackName));
  const withExt = p.toLowerCase().endsWith(ext) ? p : `${p}${ext}`;
  ensureDirBounded(dirname(withExt));
  if (out !== undefined) {
    if (overwrite) return withExt;
    try { closeSync(openSync(withExt, "wx")); return withExt; } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      throw new Error(`${withExt} already exists and nothing was written. Pass overwrite: true to replace it, or give a different out_path.`);
    }
  }
  const stem = withExt.slice(0, withExt.length - ext.length);
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? withExt : `${stem}-${n}${ext}`;
    try { closeSync(openSync(candidate, "wx")); return candidate; } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  throw new Error(`${withExt} and 999 numbered variants already exist; pass out_path.`);
}

/** tmp + rename, so a reader never sees half a slip. */
function writeAtomic(path: string, body: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, body);
  renameSync(tmp, path);
}

/* ---------------------------------------------------------- shared profile */

const PLACEHOLDER_ISSUER = "Your business";

/** The name at the top of the slip. From the SHARED profile; no sibling store is opened. */
function issuerName(): string {
  const p = readSharedProfile();
  const name = p.name?.trim() ? p.name : PLACEHOLDER_ISSUER;
  const addr = p.address?.trim();
  return addr ? `${name}\n${addr}` : name;
}
const businessMissing = (): boolean => !readSharedProfile().name?.trim();

const BASIS =
  "No weight and no shortfall is stored. A packing list holds its cartons, its expected lines and its packed lines; " +
  "the net, gross, volumetric and chargeable weights and the shortfall are derived on every call. " +
  "Mass is in WHOLE GRAMS and dimensions in WHOLE CENTIMETRES throughout, for the reason money is in minor units. " +
  "A packing slip carries no prices; raise the invoice against the same order in the invoice server.";

/* ------------------------------------------------------------------ shaping */

function cartonJson(p: PackingList, c: Carton, divisor: number) {
  const r = cartonReport(p, c, divisor);
  return {
    ...r,
    net_kg: kg(r.net_grams), gross_kg: kg(r.gross_grams),
    chargeable_kg: r.chargeable_grams === null ? null : kg(r.chargeable_grams),
    note: c.note ?? null,
    contents: linesIn(p, c.id).map((l) => ({
      id: l.id, sku: l.sku, description: l.description, quantity: l.quantity,
      unit_grams: l.unit_grams, line_grams: l.unit_grams === null ? null : l.unit_grams * l.quantity,
      note: l.note ?? null,
    })),
  };
}

function summary(p: PackingList, divisor: number) {
  const t = shipmentTotals(p, divisor);
  return {
    id: p.id, status: p.status, open: isOpen(p),
    reference: p.reference, reference_kind: p.reference_kind,
    consignee: p.consignee, date: p.date,
    cartons: t.cartons, lines: t.lines, units: t.units,
    gross_grams: t.gross_grams, gross_kg: kg(t.gross_grams), gross_is_lower_bound: !t.net_complete,
    outstanding_lines: shortfall(p).filter((r) => r.state === "short").length,
  };
}

function detail(p: PackingList, divisor: number) {
  const t = shipmentTotals(p, divisor);
  const ready = readyToShip(p);
  return {
    ...summary(p, divisor),
    ship_to: p.ship_to ?? null,
    carrier: p.carrier ?? null, tracking: p.tracking ?? null, shipped_date: p.shipped_date ?? null,
    note: p.note ?? null,
    totals: { ...t, gross_kg: kg(t.gross_grams), chargeable_kg: t.chargeable_grams === null ? null : kg(t.chargeable_grams) },
    cartons_detail: p.cartons.map((c) => cartonJson(p, c, divisor)),
    expected: p.expected.map((e) => ({ ...e, key: matchKey(e.sku, e.description) })),
    shortfall: shortfall(p),
    ready_to_ship: ready.ready, not_ready_because: ready.reasons,
    other_lists_on_this_order: byReference(getLists(), p.reference).filter((o) => o.id !== p.id).map((o) => ({ id: o.id, status: o.status, date: o.date })),
    history: p.history,
    created: p.created, updated: p.updated,
  };
}

function openCount(list: PackingList[]): number { return list.filter((p) => isOpen(p)).length; }

function mutable(p: PackingList): void {
  if (!isOpen(p)) throw new Error(`${p.id} is ${p.status} and cannot be edited. The goods have gone; raise a new packing list for a further shipment. Nothing was written.`);
}

/* ------------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-packing-list", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

const listArg = str("packing_list", MAX_NAME).describe("The packing list id, e.g. PL-2026-0001, or the order reference when only one list carries it");
const divisorArg = z.number().int().refine((n) => (DIVISORS as readonly number[]).includes(n), `divisor must be one of ${DIVISORS.join(", ")}`)
  .optional().describe(`Volumetric divisor in cm3 per kg: 5000 courier air (default), 6000 IATA air, 4000 some road tariffs`);
const skuArg = str("sku", 64).optional().describe("Stock code, upper-cased and stripped of spaces. Lines with a SKU are matched on it, lines without on their description");

server.registerTool("packing_list_create", {
  title: "Open a packing list",
  description: "Open a packing list against an order and return its PL-YYYY-NNNN number: the order reference, the consignee, where it ships to and the date. Free tier: 3 open at once; shipping or cancelling frees a slot.",
  inputSchema: {
    reference: str("reference", 64).describe("The order this ships against, by id, e.g. WO-2026-0001, INV-2026-0007 or PO-4471"),
    reference_kind: z.enum(REFERENCE_KINDS).optional().describe("What the reference is. Inferred from the id when omitted: WO- work order, INV- invoice, Q- quote, otherwise a plain order"),
    consignee: str("consignee", MAX_NAME).describe("Who receives the goods, as named on the order"),
    ship_to: str("ship_to", MAX_TEXT).optional().describe("The delivery address, printed on the slip. Omit to leave it off"),
    date: str("date", 10).optional().describe("The day the list was raised, YYYY-MM-DD. Default today"),
    note: str("note", MAX_TEXT).optional(),
    duplicate_ok: z.boolean().optional().describe("Open it even though an OPEN list already exists on this reference. Default false"),
  },
}, async (a) => {
  try {
    const date = a.date ? checkDate(a.date, "date") : today();
    const reference = normaliseReference(a.reference);
    if (!reference) throw new Error("reference is empty. A packing list ships against something; name the order. Nothing was written.");
    const consignee = normaliseText(a.consignee);
    if (!consignee) throw new Error("consignee is empty. Nothing was written.");
    const kind: ReferenceKind = a.reference_kind ?? inferReferenceKind(reference);

    const rec = await locked(() => {
      const list = getLists();
      const siblings = byReference(list, reference).filter((p) => isOpen(p));
      if (siblings.length && !a.duplicate_ok) {
        throw new Error(`${siblings.map((p) => p.id).join(", ")} is already open against ${reference}. Pack into it, or pass duplicate_ok: true to raise a second shipment. Nothing was written.`);
      }
      if (!gate.isPro() && openCount(list) >= FREE_OPEN_LISTS) {
        throw new Error(`the free tier holds ${FREE_OPEN_LISTS} open packing lists and ${openCount(list)} are open. Mark one shipped or cancel it to free a slot. ${gate.upgradeText("More than 3 open packing lists", "packing_list_create")}`);
      }
      const id = nextId(date.slice(0, 4), list.map((p) => p.id));
      const now = new Date().toISOString();
      const p: PackingList = {
        id, reference, reference_kind: kind, consignee,
        ...(a.ship_to ? { ship_to: normaliseText(a.ship_to) } : {}),
        date, status: "draft", cartons: [], expected: [], packed: [],
        ...(a.note ? { note: normaliseText(a.note) } : {}),
        history: [{ status: "draft", date }], created: now, updated: now,
      };
      setLists([...list, p]);
      return p;
    });
    return json({ created: summary(rec, DEFAULT_DIVISOR), business_profile_missing: businessMissing(), basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("packing_expect", {
  title: "Declare what the order says should ship",
  description: "Add an ordered line to a packing list so the shortfall is real: a SKU, a description and a quantity. Nothing is read from the quotes, work order or invoice store; what the order says is stated here.",
  inputSchema: {
    packing_list: listArg,
    description: str("description", MAX_TEXT).describe("The goods as the order names them, e.g. Oak shelf 900mm"),
    quantity: z.number().int().min(1).max(MAX_QUANTITY).describe("How many units the order says should ship. Whole units"),
    sku: skuArg,
  },
}, async (a) => {
  try {
    const description = normaliseText(a.description);
    if (!description) throw new Error("description is empty. Nothing was written.");
    const rec = await locked(() => {
      const list = getLists();
      const p = resolveList(list, a.packing_list);
      mutable(p);
      if (p.expected.length >= MAX_LINES) throw new Error(`${p.id} already has ${MAX_LINES} expected lines, the maximum. Nothing was written.`);
      const e: ExpectedLine = { id: nextSeq("E", p.expected.map((x) => x.id)), sku: normaliseSku(a.sku), description, quantity: a.quantity };
      p.expected.push(e);
      p.updated = new Date().toISOString();
      setLists(list);
      return { p, e };
    });
    return json({ packing_list: rec.p.id, expected: rec.e, shortfall: shortfall(rec.p), basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("carton_add", {
  title: "Add a carton",
  description: "Add a carton to a packing list and return its C01-style id: a label, the empty weight in WHOLE GRAMS, and optionally length, width and height in WHOLE CENTIMETRES. Dimensions are what make a chargeable weight possible.",
  inputSchema: {
    packing_list: listArg,
    label: str("label", MAX_NAME).describe("What is written on the box, e.g. Box 1 of 3 or Pallet A"),
    tare_grams: z.number().int().min(0).max(MAX_GRAMS).describe("The EMPTY carton with its packaging, in whole grams. 0 when it is not known"),
    length_cm: z.number().int().min(1).max(MAX_CM).optional().describe("Outer length in whole centimetres. All three dimensions or none"),
    width_cm: z.number().int().min(1).max(MAX_CM).optional().describe("Outer width in whole centimetres"),
    height_cm: z.number().int().min(1).max(MAX_CM).optional().describe("Outer height in whole centimetres"),
    note: str("note", MAX_TEXT).optional(),
  },
}, async (a) => {
  try {
    const label = normaliseText(a.label);
    if (!label) throw new Error("label is empty. A carton nobody can point at is a carton that gets mislaid. Nothing was written.");
    const dims = [a.length_cm, a.width_cm, a.height_cm].filter((v) => v !== undefined).length;
    if (dims !== 0 && dims !== 3) {
      throw new Error("give all three of length_cm, width_cm and height_cm, or none. Two of three cannot make a volume, and a partial box silently drops out of the chargeable weight. Nothing was written.");
    }
    const rec = await locked(() => {
      const list = getLists();
      const p = resolveList(list, a.packing_list);
      mutable(p);
      if (p.cartons.length >= MAX_CARTONS) throw new Error(`${p.id} already has ${MAX_CARTONS} cartons, the maximum. Nothing was written.`);
      const c: Carton = {
        id: nextSeq("C", p.cartons.map((x) => x.id)), label, tare_grams: a.tare_grams,
        ...(dims === 3 ? { length_cm: a.length_cm, width_cm: a.width_cm, height_cm: a.height_cm } : {}),
        ...(a.note ? { note: normaliseText(a.note) } : {}),
      };
      p.cartons.push(c);
      p.updated = new Date().toISOString();
      setLists(list);
      return { p, c };
    });
    return json({ packing_list: rec.p.id, carton: cartonJson(rec.p, rec.c, DEFAULT_DIVISOR), basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("pack_item", {
  title: "Pack goods into a carton",
  description: "Put a quantity of one item into a named carton: a description, how many, and the per-unit weight in WHOLE GRAMS. Leave unit_grams out when it was not weighed and the carton gross comes back as a lower bound.",
  inputSchema: {
    packing_list: listArg,
    carton: str("carton", 16).describe("The carton id, e.g. C01, or its exact label"),
    description: str("description", MAX_TEXT).describe("The goods going in, e.g. Oak shelf 900mm"),
    quantity: z.number().int().min(1).max(MAX_QUANTITY).describe("How many units go into THIS carton. Split across cartons with one call each"),
    unit_grams: z.number().int().min(0).max(MAX_GRAMS).optional().describe("Weight of ONE unit in whole grams. Omit when not weighed; the carton is then a lower bound"),
    sku: skuArg,
    note: str("note", MAX_TEXT).optional(),
  },
}, async (a) => {
  try {
    const description = normaliseText(a.description);
    if (!description) throw new Error("description is empty. Nothing was written.");
    const rec = await locked(() => {
      const list = getLists();
      const p = resolveList(list, a.packing_list);
      mutable(p);
      const needle = String(a.carton).trim().toLowerCase();
      const matches = p.cartons.filter((c) => c.id.toLowerCase() === needle || c.label.toLowerCase() === needle);
      if (!matches.length) throw new Error(`${p.id} has no carton "${a.carton}". Cartons: ${p.cartons.map((c) => `${c.id} (${c.label})`).join(", ") || "none yet, run carton_add"}. Nothing was written.`);
      if (matches.length > 1) throw new Error(`"${a.carton}" matches ${matches.map((c) => c.id).join(", ")}. Pass the carton id. Nothing was written.`);
      const c = matches[0];
      if (p.packed.length >= MAX_LINES) throw new Error(`${p.id} already has ${MAX_LINES} packed lines, the maximum. Nothing was written.`);
      const l: PackedLine = {
        id: nextSeq("L", p.packed.map((x) => x.id)), carton: c.id, sku: normaliseSku(a.sku), description,
        quantity: a.quantity, unit_grams: a.unit_grams ?? null,
        ...(a.note ? { note: normaliseText(a.note) } : {}),
      };
      p.packed.push(l);
      p.updated = new Date().toISOString();
      setLists(list);
      return { p, c, l };
    });
    const row = shortfall(rec.p).find((r) => r.key === matchKey(rec.l.sku, rec.l.description));
    return json({ packing_list: rec.p.id, packed: rec.l, carton: cartonJson(rec.p, rec.c, DEFAULT_DIVISOR), line_shortfall: row ?? null, basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("unpack_item", {
  title: "Take a packed line back out",
  description: "Remove one packed line from a packing list by its L01-style id and return the carton it came out of. The line is deleted, not zeroed, so the slip does not print an item nobody packed.",
  inputSchema: {
    packing_list: listArg,
    line: str("line", 16).describe("The packed line id, e.g. L03, as shown by packing_list_show or carton_report"),
  },
}, async (a) => {
  try {
    const rec = await locked(() => {
      const list = getLists();
      const p = resolveList(list, a.packing_list);
      mutable(p);
      const needle = String(a.line).trim().toLowerCase();
      const i = p.packed.findIndex((l) => l.id.toLowerCase() === needle);
      if (i < 0) throw new Error(`${p.id} has no packed line "${a.line}". Lines: ${p.packed.map((l) => `${l.id} (${l.quantity} x ${l.description} in ${l.carton})`).join(", ") || "none"}. Nothing was written.`);
      const [l] = p.packed.splice(i, 1);
      p.updated = new Date().toISOString();
      setLists(list);
      return { p, l };
    });
    const c = rec.p.cartons.find((x) => x.id === rec.l.carton);
    return json({ packing_list: rec.p.id, removed: rec.l, carton: c ? cartonJson(rec.p, c, DEFAULT_DIVISOR) : null, shortfall: shortfall(rec.p), basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("packing_list_show", {
  title: "Show one packing list",
  description: "The whole packing list: its cartons with contents and derived weights, the ordered lines, the shortfall, whether it is ready to ship and why not, and its status history. Nothing here is stored; it is computed.",
  inputSchema: { packing_list: listArg, divisor: divisorArg },
}, async (a) => {
  try {
    const p = resolveList(getLists(), a.packing_list);
    return json({ ...detail(p, a.divisor ?? DEFAULT_DIVISOR), basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("packing_list_list", {
  title: "List packing lists",
  description: "Packing lists newest first, with cartons, units, gross weight and how many ordered lines are still short. Filter by status, by order reference or by consignee. Returns at most 500 rows.",
  inputSchema: {
    status: z.enum(STATUSES).optional().describe("Only lists in this status"),
    open_only: z.boolean().optional().describe("Only draft and packed lists, the ones that count against the free tier. Default false"),
    reference: str("reference", 64).optional().describe("Only lists against this order reference, matched case-insensitively"),
    consignee: str("consignee", MAX_NAME).optional().describe("Only lists whose consignee contains this text"),
    divisor: divisorArg,
  },
}, async (a) => {
  try {
    const divisor = a.divisor ?? DEFAULT_DIVISOR;
    let rows = getLists();
    if (a.status) rows = rows.filter((p) => p.status === a.status);
    if (a.open_only) rows = rows.filter((p) => isOpen(p));
    if (a.reference) rows = byReference(rows, a.reference);
    if (a.consignee) { const n = normaliseText(a.consignee).toLowerCase(); rows = rows.filter((p) => p.consignee.toLowerCase().includes(n)); }
    rows = [...rows].sort((x, y) => y.date.localeCompare(x.date) || y.id.localeCompare(x.id));
    const total = rows.length;
    rows = rows.slice(0, MAX_ROWS);
    const all = getLists();
    return json({
      packing_lists: rows.map((p) => summary(p, divisor)),
      returned: rows.length, total,
      ...(total > rows.length ? { truncated: `showing the newest ${MAX_ROWS} of ${total}; narrow with status, reference or consignee` } : {}),
      open: openCount(all), free_tier_open_limit: gate.isPro() ? null : FREE_OPEN_LISTS,
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("carton_report", {
  title: "Weigh the cartons",
  description: "Per carton and for the shipment: tare, net, gross, volume, volumetric weight and the chargeable weight, the greater of gross and volumetric. A carton with no dimensions makes the chargeable total null, never a guess.",
  inputSchema: { packing_list: listArg, divisor: divisorArg },
}, async (a) => {
  try {
    const divisor = a.divisor ?? DEFAULT_DIVISOR;
    const p = resolveList(getLists(), a.packing_list);
    const t = shipmentTotals(p, divisor);
    return json({
      packing_list: p.id, status: p.status, divisor,
      cartons: p.cartons.map((c) => cartonJson(p, c, divisor)),
      totals: { ...t, tare_kg: kg(t.tare_grams), net_kg: kg(t.net_grams), gross_kg: kg(t.gross_grams), chargeable_kg: t.chargeable_grams === null ? null : kg(t.chargeable_grams) },
      ...(t.net_complete ? {} : { weight_caveat: `${t.unweighed_lines} packed line(s) carry no unit weight, so every net and gross figure here is a LOWER BOUND. Pass unit_grams on pack_item to close it.` }),
      ...(t.cartons_without_dimensions ? { chargeable_caveat: `${t.cartons_without_dimensions} carton(s) have no dimensions, so no chargeable weight is computed for the shipment.` } : {}),
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("packing_shortfall", {
  title: "What is still to pack",
  description: "Ordered against packed, line by line: what is still short, what was over-packed, and what was packed that is not on the order at all. A packed line with no ordered line is reported, never dropped.",
  inputSchema: { packing_list: listArg },
}, async (a) => {
  try {
    const p = resolveList(getLists(), a.packing_list);
    const rows = shortfall(p);
    const ready = readyToShip(p);
    return json({
      packing_list: p.id, status: p.status,
      rows,
      short: rows.filter((r) => r.state === "short").length,
      over: rows.filter((r) => r.state === "over").length,
      not_on_order: rows.filter((r) => r.state === "not_on_order").length,
      complete: rows.filter((r) => r.state === "complete").length,
      ...(p.expected.length ? {} : { no_order_lines: "nothing has been declared with packing_expect, so every packed line reads as not_on_order and no shortfall can be computed." }),
      ready_to_ship: ready.ready, not_ready_because: ready.reasons,
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("packing_list_status", {
  title: "Move a packing list on",
  description: "Move a packing list draft to packed to shipped, or cancel it. Shipping records the carrier, the tracking number and the date, and freezes the list. A shipped list cannot be reopened or edited.",
  inputSchema: {
    packing_list: listArg,
    status: z.enum(STATUSES).describe("The status to move to. draft to packed to shipped, or cancelled from either open status"),
    date: str("date", 10).optional().describe("The day the step happened, YYYY-MM-DD. Default today"),
    carrier: str("carrier", MAX_NAME).optional().describe("Who is carrying it, recorded when moving to shipped"),
    tracking: str("tracking", MAX_NAME).optional().describe("The carrier's consignment or tracking number, recorded when moving to shipped"),
    note: str("note", MAX_TEXT).optional(),
    force: z.boolean().optional().describe("Ship even though lines are short, over-packed or not on the order. Default false, and the reasons come back either way"),
  },
}, async (a) => {
  try {
    const date = a.date ? checkDate(a.date, "date") : today();
    const next = a.status as Status;
    const rec = await locked(() => {
      const list = getLists();
      const p = resolveList(list, a.packing_list);
      const err = transitionError(p.status, next);
      if (err) throw new Error(`${p.id}: ${err} Nothing was written.`);
      const ready = readyToShip(p);
      if (next === "shipped" && !ready.ready && !a.force) {
        throw new Error(`${p.id} is not ready to ship: ${ready.reasons.join("; ")}. Fix it, or pass force: true to ship anyway. Nothing was written.`);
      }
      p.status = next;
      if (next === "shipped") {
        p.shipped_date = date;
        if (a.carrier) p.carrier = normaliseText(a.carrier);
        if (a.tracking) p.tracking = normaliseText(a.tracking);
      }
      p.history.push({ status: next, date, ...(a.note ? { note: normaliseText(a.note) } : {}) });
      p.updated = new Date().toISOString();
      setLists(list);
      return p;
    });
    return json({
      packing_list: summary(rec, DEFAULT_DIVISOR),
      shipped_with_exceptions: rec.status === "shipped" ? readyToShip(rec).reasons : [],
      open: openCount(getLists()), free_tier_open_limit: gate.isPro() ? null : FREE_OPEN_LISTS,
      history: rec.history, basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("packing_slip", {
  title: "Produce the packing slip",
  description: "The packing slip as plain text on every tier: cartons, contents, weights and a signature line, and no prices anywhere. Pro also writes it to out_path as a .txt file. Refuses a URL and refuses to overwrite unless told to.",
  inputSchema: {
    packing_list: listArg,
    out_path: str("out_path", 1000).optional().describe("Where to write the .txt file. Pro only. Omit to get the slip back as text, which every tier can do"),
    overwrite: z.boolean().optional().describe("Replace out_path if a file is already there. Default false, and an existing file is refused with nothing written"),
    divisor: divisorArg,
  },
}, async (a) => {
  try {
    const divisor = a.divisor ?? DEFAULT_DIVISOR;
    const p = resolveList(getLists(), a.packing_list);
    const text = slipText(p, issuerName(), divisor);
    if (a.out_path === undefined) {
      return json({
        packing_list: p.id, slip: text, written: false,
        business_profile_missing: businessMissing(),
        ...(gate.isPro() ? {} : { pro_note: `Pass out_path to write this to a .txt file. ${gate.upgradeText("Writing the packing slip to a file", "packing_slip")}` }),
        basis: BASIS,
      });
    }
    requirePro("Writing the packing slip to a file", "packing_slip");
    const path = outputPath(a.out_path, `${p.id}.txt`, ".txt", a.overwrite === true);
    writeAtomic(path, `${text}\n`);
    return json({ packing_list: p.id, written: true, path, bytes: Buffer.byteLength(text) + 1, business_profile_missing: businessMissing(), basis: BASIS });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("packing_list_delete", {
  title: "Delete a packing list",
  description: "Delete a packing list for good, with its cartons and packed lines. A shipped list is refused: it is the record of what left the building. Cancel a list you no longer want instead of deleting a real shipment.",
  inputSchema: {
    packing_list: listArg,
    confirm: z.literal(true).describe("Must be true. There is no undo and nothing is copied anywhere first"),
  },
}, async (a) => {
  try {
    const rec = await locked(() => {
      const list = getLists();
      const p = resolveList(list, a.packing_list);
      if (p.status === "shipped") throw new Error(`${p.id} shipped on ${p.shipped_date ?? "an earlier date"} and cannot be deleted. It is the record of what left the building. Nothing was written.`);
      setLists(list.filter((x) => x.id !== p.id));
      return p;
    });
    return json({ deleted: rec.id, was: rec.status, cartons: rec.cartons.length, packed_lines: rec.packed.length, open: openCount(getLists()), free_tier_open_limit: gate.isPro() ? null : FREE_OPEN_LISTS });
  } catch (e) { return fail((e as Error).message); }
});


server.registerResource("contract", "packinglist://contract", {
  title: "The status machine, the weight basis, the free tier and where this server writes",
  description: "The four statuses and the legal moves, how a gross and a chargeable weight are built, what a shortfall state means, the free-tier limits and the one directory this server writes.",
  mimeType: "application/json",
}, async () => ({
  contents: [{
    uri: "packinglist://contract", mimeType: "application/json",
    text: JSON.stringify({
      statuses: STATUSES,
      open_statuses: OPEN_STATUSES,
      closed_statuses: CLOSED_STATUSES,
      transitions: TRANSITIONS,
      reference_kinds: REFERENCE_KINDS,
      units: { mass: "whole grams", dimensions: "whole centimetres", money: "none: a packing slip carries no prices" },
      weights: {
        net: "sum of quantity times unit_grams over the lines in the carton; a line with no unit_grams is skipped and the figure becomes a lower bound",
        gross: "tare plus net",
        volumetric: "ceil(length x width x height / divisor x 1000) grams; null when the carton has no dimensions",
        chargeable: "the greater of gross and volumetric; null for the shipment when ANY carton has no dimensions",
        divisors: DIVISORS,
        default_divisor: DEFAULT_DIVISOR,
      },
      shortfall_states: {
        short: "the order says more than was packed",
        complete: "packed exactly what the order says",
        over: "more was packed than the order says",
        not_on_order: "packed and not on the order at all; reported, never dropped",
      },
      free_tier: {
        open_packing_lists: FREE_OPEN_LISTS,
        free_tools: ["packing_list_create", "packing_expect", "carton_add", "pack_item", "unpack_item", "packing_list_show", "packing_list_list", "carton_report", "packing_shortfall", "packing_list_status", "packing_list_delete"],
        pro_tools: ["packing_slip with out_path"],
        note: "the packing slip TEXT is free on every tier; only writing it to a file is Pro",
      },
      writes: [{ store: "packing-list", dir: dataDir(), files: ["packing-lists.json", "counter.json"] }],
      reads: [{ store: "profile", file: "business.json", why: "the business name and address at the top of the slip", writes: false }],
      opens_sibling_stores: false,
      creates_invoices: false,
      today: today(),
      version: VERSION,
    }, null, 2),
  }],
}));

server.registerPrompt("pack_the_shipment", {
  title: "Pack an order into cartons and produce the slip",
  description: "Declare what the order says should ship, pack it into cartons with weights, check nothing is short, and produce the packing slip.",
  argsSchema: { reference: z.string().describe("The order this ships against, e.g. WO-2026-0044 or PO-4471") },
}, ({ reference }) => ({
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
      text: `Pack the goods on ${reference} and produce the packing slip.\n\n` +
        `1. Call packing_list_create with ${reference} and the consignee. Add ship_to if you have the delivery address.\n` +
        `2. Call packing_expect once per line the order says should ship, with the SKU where there is one. Nothing is read from the quote, work order or invoice store, so a line you do not declare cannot appear in the shortfall.\n` +
        `3. Call carton_add per box, with tare_grams and all three dimensions in whole centimetres. Give all three or none: two of three silently drops the box out of the chargeable weight.\n` +
        `4. Call pack_item to put goods in a box, once per item per box. unit_grams is the weight of ONE unit in whole grams; leave it out only when the item was genuinely not weighed, and say in your answer that the gross is then a lower bound.\n` +
        `5. Call packing_shortfall. Fix anything short, over-packed or not on the order before shipping. Do not use force unless the user tells you to ship with the exception.\n` +
        `6. Call packing_list_status with packed, then shipped with the carrier and the tracking number. Call packing_slip for the document. It carries no prices; the invoice against ${reference} is a separate document in the invoice server.`,
    },
  }],
}));

gate.registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-packing-list ${VERSION} ready; store at ${dataDir()}\n`);
