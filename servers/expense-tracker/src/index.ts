#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  currencyDecimals, defaultRegion, formatMoney, hasRegexMetacharacters, isIsoDate, isKnownCurrency,
  isoDaysAgo, isoToday, isSafeRegexSource, MAX_MATCH_INPUT, MILEAGE_RATES, mileageAmount,
  roundHalfUp, toMajor, toMinor, vatSplit,
} from "./money.js";
import { dataDir, load, lockPath, readBankTransactions, save, type DB, type Expense, type Rule } from "./store.js";
import { VERSION } from "./version.js";

const PRODUCT = "expense-tracker";
const FREE_WINDOW_DAYS = 30;
const FREE_PROJECTS = 3;
const FREE_RULES = 5;
const FREE_EXPORT_ROWS = 200;
const FREE_REBILL_ITEMS = 20;
/** Free text is stored verbatim in data.json and echoed back; a 1 MB merchant is not a merchant. */
const MAX_TEXT = 500;
/** A receipt is hashed with readFileSync, so the whole file lands in memory. */
const MAX_RECEIPT_BYTES = 25 * 1024 * 1024;

const gate = createLicenseGate({ product: PRODUCT });

/** Every read-modify-write cycle is serialised across processes on one data dir. */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(lockPath(), fn);
}

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));
/** A limit hit is information, not a transport error: isError stays false. */
const gated = (text: string) => ok(text);

function newId(): string { return randomBytes(4).toString("hex"); }

/** Every free-text field is length-bounded at the schema, so an oversized string never reaches the store. */
const text = (max = MAX_TEXT) => z.string().max(max, `must be ${max} characters or fewer`);

/** Existence, type and size checked before the file is read, so a huge path cannot exhaust memory. */
function hashReceipt(p: string): { path: string; sha256: string } | { error: string } {
  if (!existsSync(p) || !statSync(p).isFile()) return { error: `receipt file not found: ${p}` };
  const size = statSync(p).size;
  if (size > MAX_RECEIPT_BYTES) {
    return { error: `receipt file is ${(size / 1048576).toFixed(1)} MB; the limit is ${MAX_RECEIPT_BYTES / 1048576} MB.` };
  }
  return { path: p, sha256: createHash("sha256").update(readFileSync(p)).digest("hex") };
}

function expandPath(p: string): string {
  const s = p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

function normCurrency(raw: string | undefined, fallback = "EUR"): string {
  const s = String(raw ?? fallback).trim().toUpperCase();
  return s;
}

/* ------------------------------------------------------------------ filtering */

interface Filter { from?: string; to?: string; project?: string; category?: string; billable?: boolean }

/**
 * D-R77. The free window used to clamp `from` forward and describe the result as "covers
 * <cutoff> onwards", which is a sentence about a range that may not exist: a caller asking
 * for June with a cutoff in August got `from` AFTER `to`, an empty window by construction,
 * and a note claiming coverage from a date past the end of what they asked for. Nothing was
 * read, and the note said the opposite. When the whole requested range is older than the
 * window the answer now says so in those words, the way currency's rate_on does (D-R71).
 */
function windowNote(from: string | undefined, to?: string): { from?: string; note?: string; nothing_read?: boolean } {
  if (gate.isPro()) return { from };
  const cutoff = isoDaysAgo(FREE_WINDOW_DAYS);
  if (from && from >= cutoff) return { from };
  if (to && to < cutoff) {
    return {
      // `from` still clamps the SELECT so no gated row is read; the reported window is null,
      // because printing `from: <cutoff>` next to `to: <an earlier date>` is a range that
      // cannot exist, which is how this defect read on the wire.
      from: cutoff,
      nothing_read: true,
      note: `Nothing was read. The free tier reads the last ${FREE_WINDOW_DAYS} days only, back to ${cutoff}, and every day you asked for (${from ?? "the start of the ledger"} to ${to}) is older than that, so this is not an empty result - the period was never opened. ` +
        gate.upgradeText("full expense history"),
    };
  }
  return {
    from: cutoff,
    note: `Free tier reads the last ${FREE_WINDOW_DAYS} days only, so this covers ${cutoff} to ${to ?? "today"}${from ? ` instead of ${from} to ${to ?? "today"}` : ""}. ` +
      gate.upgradeText("full expense history"),
  };
}

/**
 * D-B4. This server only ever sees hand-logged receipts. When bank-statement has already
 * imported transactions for the same period, a summary or export built from receipts alone
 * looks complete and is not: it names the count and the exact bank tool to call, and stays
 * silent when the sibling store is missing, unreadable or empty for the period, so a normal
 * run without bank-statement installed is unchanged.
 */
function bankLedgerLine(from: string | undefined, to: string, tool: "statement_summary" | "statement_export"): string | undefined {
  const bank = readBankTransactions();
  if (!bank.present || bank.note) return undefined;
  const count = bank.transactions.filter((t) => (!from || t.date >= from) && t.date <= to).length;
  if (count === 0) return undefined;
  return `The bank ledger (mcp-bank-statement) holds ${count} transaction${count === 1 ? "" : "s"} in this period that are not counted here; call that server's ${tool} for them.`;
}

function select(db: DB, f: Filter): Expense[] {
  return db.expenses.filter((e) => {
    if (f.from && e.date < f.from) return false;
    if (f.to && e.date > f.to) return false;
    if (f.project && (e.project ?? "").toLowerCase() !== f.project.toLowerCase()) return false;
    if (f.category && (e.category ?? "").toLowerCase() !== f.category.toLowerCase()) return false;
    if (typeof f.billable === "boolean" && e.billable !== f.billable) return false;
    return true;
  }).sort((a, b) => (a.date === b.date ? a.created.localeCompare(b.created) : a.date.localeCompare(b.date)));
}

function projectsOf(db: DB): string[] {
  const s = new Set<string>();
  for (const e of db.expenses) if (e.project) s.add(e.project);
  return [...s];
}

/** A rule matches on the merchant, as a case-insensitive regex, or as a substring if the regex is invalid. */
function ruleMatches(rule: Rule, merchant: string): boolean {
  const input = merchant.slice(0, MAX_MATCH_INPUT);
  const m = input.toLowerCase();
  if (!hasRegexMetacharacters(rule.match)) return m.includes(rule.match.toLowerCase());
  if (!isSafeRegexSource(rule.match)) return m.includes(rule.match.toLowerCase());
  try { return new RegExp(rule.match, "i").test(input); }
  catch { return m.includes(rule.match.toLowerCase()); }
}

function applyRules(db: DB, merchant: string | undefined): string | undefined {
  if (!merchant) return undefined;
  for (const r of db.rules) if (ruleMatches(r, merchant)) return r.category;
  return undefined;
}

function view(e: Expense) {
  const s = vatSplit(e.amount_minor, e.vat_rate);
  return {
    id: e.id, date: e.date,
    amount: formatMoney(e.amount_minor, e.currency),
    currency: e.currency,
    net: formatMoney(s.net_minor, e.currency),
    vat: formatMoney(s.vat_minor, e.currency),
    vat_rate: e.vat_rate ?? 0,
    category: e.category, merchant: e.merchant, project: e.project,
    billable: e.billable, note: e.note,
    receipt: e.receipt_path ? { path: e.receipt_path, sha256: e.receipt_sha256 } : undefined,
    mileage: e.mileage
      ? `${e.mileage.distance} ${e.mileage.unit} at ${e.mileage.rate} ${e.currency}/${e.mileage.unit} (${e.mileage.region}) - ${e.mileage.purpose}`
      : undefined,
    rebilled_at: e.rebilled_at,
  };
}

const server = new McpServer(
  { name: "mcp-expense-tracker", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

/* ---------------------------------------------------------------- expense_add */

const amount = (name: string) => z.number().finite().refine((n) => n >= 0, `${name} must be zero or positive`);

server.registerTool("expense_add", {
  title: "Add an expense",
  description: "Record one expense and return its id, its net/VAT split and its billable flag. The response states every default that was applied, so the caller can see what was assumed rather than having to guess.",
  inputSchema: {
    amount: amount("amount").describe("Gross amount on the receipt, in major units, e.g. 12.34. It is stored as integer minor units in the expense's own currency, so nothing is lost to floating point."),
    currency: z.string().regex(/^[A-Za-z]{3}$/, "must be a 3-letter ISO code such as EUR").optional().describe("ISO code. Defaults to your expense_settings default_currency, else the shared business profile's default_currency, else EUR"),
    category: text().optional().describe("Category, e.g. software, travel, office. Omit and the stored category rules are matched against the merchant to fill it in"),
    merchant: text().optional().describe("Who was paid, e.g. Adobe"),
    date: text(10).optional().describe("ISO date YYYY-MM-DD, default today"),
    project: text().optional().describe("Project or client this belongs to"),
    note: text(2000).optional(),
    receipt_path: text(4096).optional().describe("Absolute path to the receipt file; it is checked and hashed"),
    billable: z.boolean().optional().describe("Rebillable to the client. Default: true when project is given (a receipt booked to a client project is normally rebilled), false otherwise. Pass it explicitly to override."),
    vat_rate: z.number().finite().min(0).max(100).optional().describe("VAT percent already included in amount; it splits the gross into net and VAT. Omit to use the expense_settings default, or get no split at all when none is set"),
    tax_rate: z.number().finite().min(0).max(100).optional().describe("Alias for vat_rate"),
    vat: z.number().finite().min(0).max(100).optional().describe("Alias for vat_rate"),
  },
}, async (a) => {
  try {
    const date = a.date ?? isoToday();
    if (!isIsoDate(date)) return fail(`date must be a real calendar date as YYYY-MM-DD, got "${date}".`);
    const settings = load().settings;
    // Profile-first sweep: the currency you spend and invoice in is business identity. The
    // chain is the call, then expense_settings, then the shared profile's default_currency,
    // then EUR. An explicit currency wins and is not annotated.
    const sharedCurrency = readSharedProfile().default_currency;
    const profileCurrency = sharedCurrency && /^[A-Za-z]{3}$/.test(sharedCurrency.trim()) ? sharedCurrency.trim() : undefined;
    const currencyFromProfile = !a.currency && !settings.default_currency && !!profileCurrency;
    const currency = normCurrency(a.currency, settings.default_currency ?? profileCurrency ?? "EUR");
    if (!isKnownCurrency(currency)) return fail(`"${currency}" is not an ISO 4217 currency code. Use a real code such as EUR, USD, PLN or GBP.`);
    const minor = toMinor(a.amount, currency);
    if (!Number.isSafeInteger(minor)) return fail("that amount is too large to represent exactly.");

    let receipt: { path: string; sha256: string } | undefined;
    if (a.receipt_path) {
      const r = hashReceipt(expandPath(a.receipt_path));
      if ("error" in r) return fail(r.error);
      receipt = r;
    }

    return await locked(() => {
      const db = load();
      const category = a.category ?? applyRules(db, a.merchant);
      const autoCategorised = !a.category && !!category;
      if (a.project && !gate.isPro()) {
        const known = projectsOf(db);
        if (!known.some((p) => p.toLowerCase() === a.project!.toLowerCase()) && known.length >= FREE_PROJECTS) {
          return gated(`This would be project number ${known.length + 1} (${known.join(", ")} already exist). ` +
            `The free tier tracks ${FREE_PROJECTS} projects. The expense was not saved; add it without a project, or reuse one of those.\n\n` +
            gate.upgradeText("unlimited projects", "expense_add"));
        }
      }
      // D-R3: accept the names a caller actually uses for the same number.
      const givenRate = [a.vat_rate, a.tax_rate, a.vat].find((v) => typeof v === "number");
      // D-R31/D-R34: the rate the user stated once at onboarding lives in the shared
      // business profile. When neither the call nor expense_settings names a rate, use it
      // rather than recording a gross-only row that expense_to_invoice can never correct.
      const sharedRate = readSharedProfile().default_tax_rate;
      let rateSource: "call" | "settings" | "profile" | "none" = "none";
      let vatRate: number | undefined;
      if (typeof givenRate === "number") { vatRate = givenRate; rateSource = "call"; }
      else if (typeof db.settings.default_vat_rate === "number") { vatRate = db.settings.default_vat_rate; rateSource = "settings"; }
      else if (typeof sharedRate === "number" && sharedRate > 0) { vatRate = sharedRate; rateSource = "profile"; }
      const RATE_SOURCE_TEXT: Record<string, string> = {
        call: " (the rate you passed on this call)",
        settings: " (your expense_settings default_vat_rate)",
        profile: " (your shared business profile default_tax_rate, set with business_set)",
        none: "",
      };
      // D-R21: "for <project>" is the only reason to book a client project onto a receipt,
      // and a default of false silently dead-ended expense_to_invoice one turn later.
      const billable = a.billable ?? !!a.project;
      const billableDefaulted = typeof a.billable !== "boolean";
      const e: Expense = {
        id: newId(), date, amount_minor: minor, currency, category,
        merchant: a.merchant, project: a.project, note: a.note,
        receipt_path: receipt?.path, receipt_sha256: receipt?.sha256,
        billable: billable, vat_rate: vatRate,
        created: new Date().toISOString(),
      };
      db.expenses.push(e);
      save(db);
      const s = vatSplit(minor, vatRate);
      return ok(`Saved ${e.id}: ${formatMoney(minor, currency)} on ${date}` +
        (e.merchant ? ` at ${e.merchant}` : "") +
        (category ? ` [${category}${autoCategorised ? ", from a category rule" : ""}]` : " [uncategorised]") +
        (e.project ? ` for ${e.project}` : "") +
        (s.vat_minor
          ? `. Net ${formatMoney(s.net_minor, currency)}, VAT ${formatMoney(s.vat_minor, currency)} at ${s.rate}%${RATE_SOURCE_TEXT[rateSource]}`
          : ". No VAT rate was given and none is stored, so net equals gross and the VAT column is 0. Pass vat_rate on the call, set a default once with expense_settings, or set default_tax_rate on your business profile with business_set, to get the net/VAT split") +
        (e.billable
          ? `. Billable: yes${billableDefaulted && a.project ? " (default for an expense with a project; pass billable: false to keep it off the client's invoice)" : ""} - it will appear in expense_to_invoice.`
          : `. Billable: no${billableDefaulted ? " (default with no project)" : ""} - it will NOT appear in expense_to_invoice; pass billable: true to rebill it.`) +
        (currencyFromProfile ? `. Currency ${currency} came from the shared business profile (default_currency)` : "") +
        (receipt ? `\nReceipt ${receipt.path} sha256 ${receipt.sha256.slice(0, 16)}...` : ""));
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* --------------------------------------------------------------- expense_list */

server.registerTool("expense_list", {
  title: "List expenses",
  description: "List expenses in a date range, optionally filtered by project, category or billable flag. Totals are grouped by currency and never mixed.",
  inputSchema: {
    from: text(10).optional().describe("ISO date, inclusive"),
    to: text(10).optional().describe("ISO date, inclusive"),
    project: text().optional(),
    category: text().optional(),
    billable: z.boolean().optional(),
  },
}, async (a) => {
  try {
    for (const [k, v] of Object.entries({ from: a.from, to: a.to })) {
      if (v && !isIsoDate(v)) return fail(`${k} must be YYYY-MM-DD, got "${v}".`);
    }
    const w = windowNote(a.from, a.to);
    const db = load();
    const rows = select(db, { ...a, from: w.from });
    const totals: Record<string, number> = {};
    for (const e of rows) totals[e.currency] = (totals[e.currency] ?? 0) + e.amount_minor;
    return json({
      from: w.nothing_read ? null : (w.from ?? null), to: a.to ?? null, count: rows.length,
      totals_per_currency: Object.entries(totals).map(([c, v]) => formatMoney(v, c)),
      expenses: rows.map(view),
      nothing_read: w.nothing_read,
      note: w.note,
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ------------------------------------------------------- update / delete */

server.registerTool("expense_update", {
  title: "Update an expense",
  description: "Change any field of a stored expense by id. Only the fields you pass are changed.",
  inputSchema: {
    id: text(64).describe("Expense id from expense_add or expense_list"),
    amount: amount("amount").optional(),
    currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
    category: text().optional(),
    merchant: text().optional(),
    date: text(10).optional(),
    project: text().optional(),
    note: text(2000).optional(),
    billable: z.boolean().optional(),
    vat_rate: z.number().finite().min(0).max(100).optional(),
    rebilled: z.boolean().optional().describe("false clears the rebilled marker and the invoice number, so the expense can be billed again"),
    unlink_rebill: z.boolean().optional().describe("Allow editing amount, currency or vat_rate on a rebilled expense. Clears rebilled_at and rebilled_invoice, because the invoice no longer matches"),
  },
}, async (a) => {
  try {
    if (a.date && !isIsoDate(a.date)) return fail(`date must be YYYY-MM-DD, got "${a.date}".`);
    return await locked(() => {
      const db = load();
      const e = db.expenses.find((x) => x.id === a.id);
      if (!e) return fail(`no expense with id ${a.id}.`);
      // D-R7: an expense already on an invoice cannot silently change what that invoice
      // charged. Money edits either stay out, or break the link explicitly.
      const moneyEdit = typeof a.amount === "number" || a.currency !== undefined || typeof a.vat_rate === "number";
      if (moneyEdit && e.rebilled_at && a.unlink_rebill !== true) {
        return fail(`${e.id} was rebilled${e.rebilled_invoice ? ` on ${e.rebilled_invoice}` : ""} on ${e.rebilled_at}. Changing amount, currency or vat_rate would leave it linked to an invoice that charged something else. Pass unlink_rebill: true to clear the rebill link and edit it, or issue a credit note instead. Nothing was changed.`);
      }
      if (a.currency) {
        const c = normCurrency(a.currency);
        if (!isKnownCurrency(c)) return fail(`"${c}" is not an ISO 4217 currency code.`);
        // Minor units are scaled per currency. Moving EUR (2 decimals) to JPY (0) without a new
        // amount would silently reinterpret 1234 cents as JPY 1234, a 100x error.
        if (currencyDecimals(c) !== currencyDecimals(e.currency) && typeof a.amount !== "number") {
          return fail(`${e.currency} has ${currencyDecimals(e.currency)} decimals and ${c} has ${currencyDecimals(c)}, so the stored amount cannot carry over. Pass amount as well.`);
        }
        e.currency = c;
      }
      if (typeof a.amount === "number") e.amount_minor = toMinor(a.amount, e.currency);
      if (a.category !== undefined) e.category = a.category;
      if (a.merchant !== undefined) e.merchant = a.merchant;
      if (a.date) e.date = a.date;
      if (a.project !== undefined) e.project = a.project;
      if (a.note !== undefined) e.note = a.note;
      if (typeof a.billable === "boolean") e.billable = a.billable;
      if (typeof a.vat_rate === "number") e.vat_rate = a.vat_rate;
      // D-R8: clearing rebilled must drop the invoice number too, or the next rebill keeps
      // pointing at the previous invoice.
      if (a.rebilled === false || (moneyEdit && a.unlink_rebill === true)) {
        delete e.rebilled_at;
        delete e.rebilled_invoice;
      }
      save(db);
      return json({ updated: view(e) });
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("expense_delete", {
  title: "Delete an expense",
  description: "Delete one expense by id. The receipt file itself is left on disk.",
  inputSchema: { id: text(64) },
}, async (a) => {
  try {
    return await locked(() => {
      const db = load();
      const i = db.expenses.findIndex((x) => x.id === a.id);
      if (i < 0) return fail(`no expense with id ${a.id}.`);
      const [e] = db.expenses.splice(i, 1);
      save(db);
      return ok(`Deleted ${e.id}: ${formatMoney(e.amount_minor, e.currency)} on ${e.date}${e.merchant ? ` at ${e.merchant}` : ""}.`);
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* -------------------------------------------------------------- receipt_attach */

server.registerTool("receipt_attach", {
  title: "Attach a receipt",
  description: "Call this tool to attach a receipt file to a stored expense. Returns the stored path and sha256. The file must exist; it is hashed so a later audit can prove the file has not changed.",
  inputSchema: { id: text(64).describe("Expense id from expense_add or expense_list"), path: text(4096).describe("Path to the receipt file. It must already exist; a leading ~ is expanded. The path and its sha256 are stored on the expense") },
}, async (a) => {
  try {
    const r = hashReceipt(expandPath(a.path));
    if ("error" in r) return fail(r.error);
    const { path: p, sha256: sha } = r;
    return await locked(() => {
      const db = load();
      const e = db.expenses.find((x) => x.id === a.id);
      if (!e) return fail(`no expense with id ${a.id}.`);
      e.receipt_path = p;
      e.receipt_sha256 = sha;
      save(db);
      return ok(`Attached ${p} to ${e.id}. sha256 ${sha}`);
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* -------------------------------------------------------------- category_rules */

server.registerTool("category_rules", {
  title: "Category rules",
  description: "Replace the merchant-to-category rules, or call with no rules to list them. Returns the stored rule list. The rules are applied by expense_add whenever a call gives no category of its own.",
  inputSchema: {
    rules: z.array(z.object({
      match: text(200).describe("Matched against the merchant as a case-insensitive regular expression, and as a plain substring if it is not valid regex. The first matching rule in the list wins"),
      category: text().describe("Category to apply"),
    })).max(500).optional().describe("The FULL rule list; it replaces the stored one, so include the rules you want to keep. Omit to list the current rules instead"),
  },
}, async (a) => {
  try {
    if (!a.rules) {
      const db = load();
      return json({ count: db.rules.length, rules: db.rules, free_limit: gate.isPro() ? null : FREE_RULES });
    }
    if (!gate.isPro() && a.rules.length > FREE_RULES) {
      return gated(`That is ${a.rules.length} rules; the free tier stores ${FREE_RULES}. Nothing was changed.\n\n` + gate.upgradeText("unlimited category rules", "category_rules"));
    }
    for (const r of a.rules) {
      if (!r.match.trim()) return fail("a rule needs a non-empty match.");
      if (!r.category.trim()) return fail("a rule needs a non-empty category.");
      // A pattern that looks like regex but can backtrack exponentially is refused outright
      // rather than silently demoted to a substring the user never asked for.
      if (hasRegexMetacharacters(r.match) && !isSafeRegexSource(r.match)) {
        return fail(`the pattern "${r.match}" is not a safe regular expression: a quantified group that itself repeats (such as "(a+)+") can take unbounded time to match. Nothing was changed. Use a plain substring, or a pattern without nested repetition, e.g. "uber|bolt".`);
      }
    }
    return await locked(() => {
      const db = load();
      db.rules = a.rules!.map((r) => ({ match: r.match, category: r.category }));
      save(db);
      return ok(`Stored ${db.rules.length} category rules, replacing the previous list. Each match is tried as a case-insensitive regular expression, and as a plain substring if it is not valid regex; the first match wins. expense_add applies them when a call gives no category:\n` + db.rules.map((r) => `  ${r.match} -> ${r.category}`).join("\n"));
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});


/* ------------------------------------------------------------ expense_settings */

server.registerTool("expense_settings", {
  title: "Expense defaults",
  description: "Read or set the defaults expense_add uses when a call does not name them: default_vat_rate and default_currency. Returns the stored defaults. Call with no arguments to read them without changing anything.",
  inputSchema: {
    default_vat_rate: z.number().finite().min(0).max(100).optional().describe("VAT percent already included in a receipt, e.g. 23 in Poland, 19 in Germany. Set it once and every later expense gets its net/VAT split without the caller repeating the rate. It applies when the expense is inserted, never retroactively. Pass 0 to clear it"),
    default_currency: z.string().regex(/^[A-Za-z]{3}$/).optional().describe("ISO 4217 code to assume when a call gives none, e.g. EUR. Default EUR"),
  },
}, async (a) => {
  try {
    if (a.default_vat_rate === undefined && a.default_currency === undefined) {
      const s0 = load().settings;
      return json({
        default_vat_rate: s0.default_vat_rate ?? null,
        default_currency: s0.default_currency ?? "EUR",
        note: s0.default_vat_rate === undefined
          ? (typeof readSharedProfile().default_tax_rate === "number" && readSharedProfile().default_tax_rate! > 0
            ? `No expense_settings default is set, so expense_add falls back to your shared business profile default_tax_rate of ${readSharedProfile().default_tax_rate}%.`
            : "No default VAT rate is set here or on your shared business profile, so an expense added without vat_rate records 0% and its net equals its gross.")
          : undefined,
      });
    }
    if (a.default_currency !== undefined) {
      const c = normCurrency(a.default_currency);
      if (!isKnownCurrency(c)) return fail(`"${c}" is not an ISO 4217 currency code.`);
    }
    return await locked(() => {
      const db = load();
      if (a.default_vat_rate !== undefined) {
        if (a.default_vat_rate === 0) delete db.settings.default_vat_rate;
        else db.settings.default_vat_rate = a.default_vat_rate;
      }
      if (a.default_currency !== undefined) db.settings.default_currency = normCurrency(a.default_currency);
      save(db);
      return ok(`Defaults: VAT ${db.settings.default_vat_rate ?? "none"}${db.settings.default_vat_rate ? "%" : ""}, currency ${db.settings.default_currency ?? "EUR"}. These apply only when a call does not name its own, and only at the moment an expense is inserted; expenses already stored keep the rate they were recorded with.`);
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ------------------------------------------------------------- expense_summary */

type GroupBy = "category" | "project" | "month" | "merchant";

function groupKey(e: Expense, by: GroupBy): string {
  if (by === "category") return e.category ?? "uncategorised";
  if (by === "project") return e.project ?? "no project";
  if (by === "merchant") return e.merchant ?? "unknown merchant";
  return e.date.slice(0, 7);
}

function summarise(rows: Expense[], by: GroupBy) {
  // Maps, not object literals: a category or project literally named "__proto__" or
  // "constructor" is user input. Indexed into a plain object it either vanishes from the
  // totals or writes through to Object.prototype.
  interface Acc { gross: number; net: number; vat: number; count: number }
  const perCurrency = new Map<string, Map<string, Acc>>();
  for (const e of rows) {
    const s = vatSplit(e.amount_minor, e.vat_rate);
    let c = perCurrency.get(e.currency);
    if (!c) { c = new Map<string, Acc>(); perCurrency.set(e.currency, c); }
    const k = groupKey(e, by);
    let g = c.get(k);
    if (!g) { g = { gross: 0, net: 0, vat: 0, count: 0 }; c.set(k, g); }
    g.gross += s.gross_minor; g.net += s.net_minor; g.vat += s.vat_minor; g.count += 1;
  }
  return [...perCurrency.entries()].map(([currency, groups]) => {
    const rowsOut = [...groups.entries()]
      .sort((a, b) => b[1].gross - a[1].gross)
      .map(([key, g]) => ({
        key, count: g.count,
        gross: formatMoney(g.gross, currency),
        net: formatMoney(g.net, currency),
        vat: formatMoney(g.vat, currency),
      }));
    const t = [...groups.values()].reduce((acc, g) => ({ gross: acc.gross + g.gross, net: acc.net + g.net, vat: acc.vat + g.vat, count: acc.count + g.count }), { gross: 0, net: 0, vat: 0, count: 0 });
    return {
      currency, count: t.count, groups: rowsOut,
      total_gross: formatMoney(t.gross, currency),
      total_net: formatMoney(t.net, currency),
      total_vat: formatMoney(t.vat, currency),
    };
  }).sort((a, b) => a.currency.localeCompare(b.currency));
}

server.registerTool("expense_summary", {
  title: "Summarise expenses",
  description: "Totals for a date range grouped by category, project, month or merchant, per currency with gross, net and VAT, never mixed. Receipts only; bank transactions are totalled by bank-statement's statement_summary.",
  inputSchema: {
    from: text(10).describe("ISO date, inclusive"),
    to: text(10).describe("ISO date, inclusive"),
    group_by: z.enum(["category", "project", "month", "merchant"]).describe("How to group the totals"),
    project: text().optional(),
    billable: z.boolean().optional(),
  },
}, async (a) => {
  try {
    if (!isIsoDate(a.from)) return fail(`from must be YYYY-MM-DD, got "${a.from}".`);
    if (!isIsoDate(a.to)) return fail(`to must be YYYY-MM-DD, got "${a.to}".`);
    const w = windowNote(a.from, a.to);
    const rows = select(load(), { from: w.from, to: a.to, project: a.project, billable: a.billable });
    const bankLine = bankLedgerLine(w.from, a.to, "statement_summary");
    return json({ from: w.nothing_read ? null : w.from, to: a.to, group_by: a.group_by, by_currency: summarise(rows, a.group_by), nothing_read: w.nothing_read, note: w.note, bank_ledger: bankLine });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ---------------------------------------------------------------- mileage_add */

server.registerTool("mileage_add", {
  title: "Add a mileage claim",
  description: "Record a business trip as an expense, priced as distance x rate. Give exactly one of km or miles. Returns the saved id with the rate used, where that rate came from and the money, in the rate's own currency.",
  inputSchema: {
    km: amount("km").optional().describe("Distance in kilometres. Give exactly one of km or miles"),
    miles: amount("miles").optional().describe("Distance in miles. Give exactly one of km or miles"),
    date: z.string().optional().describe("ISO date, default today"),
    purpose: text(2000).describe("Why the trip was made, e.g. client meeting in Krakow"),
    project: text().optional().describe("Bill the trip to a client or project - use the same name you use in time-tracker and expense_add. Without it the drive is invisible to expense_summary by project and to expense_to_invoice"),
    region: z.enum(["PL", "UK", "US", "EU"]).optional().describe("Which built-in table rate to use: PL 1.15 PLN/km, UK 0.45 GBP/mile, US 0.70 USD/mile, EU 0.30 EUR/km. Default US for miles, EU for km. Each is one flat approximate rate per region with no effective dates, no vehicle or engine class and no first-10000-mile band, so it is NOT a tax calculation"),
    rate_per_km: z.number().finite().min(0).optional().describe("Your own rate per supplied unit, overriding the table. Pass it whenever you need your exact scheme rather than the approximate table rate"),
    currency: z.string().regex(/^[A-Za-z]{3}$/).optional().describe("Currency for your own rate. Only accepted together with rate_per_km; a table rate keeps the table currency"),
    billable: z.boolean().optional().describe("Whether the trip is rebilled to the client. Default true, so a mileage claim reaches expense_to_invoice unless you pass false"),
  },
}, async (a) => {
  try {
    const hasKm = typeof a.km === "number";
    const hasMiles = typeof a.miles === "number";
    if (hasKm === hasMiles) return fail("give exactly one of km or miles.");
    const unit: "km" | "mile" = hasMiles ? "mile" : "km";
    const distance = (hasMiles ? a.miles : a.km) as number;
    if (distance <= 0) return fail("distance must be greater than zero.");
    const date = a.date ?? isoToday();
    if (!isIsoDate(date)) return fail(`date must be YYYY-MM-DD, got "${date}".`);

    const region = a.region ?? defaultRegion(unit);
    const table = MILEAGE_RATES[region];
    const usingOwnRate = typeof a.rate_per_km === "number";
    // A table rate is quoted in one currency. Letting the caller relabel PLN 1.15/km as
    // EUR 1.15/km converts nothing and books a 4x overclaim, so currency is only a
    // parameter of the caller's own rate.
    if (a.currency && !usingOwnRate) {
      return fail(`currency is only accepted together with rate_per_km. The ${region} table rate is ${table.rate} ${table.currency}/${table.unit}; pass rate_per_km with your own ${normCurrency(a.currency)} rate, or drop currency to use the table.`);
    }
    const rate = usingOwnRate ? a.rate_per_km! : (table.unit === unit ? table.rate : NaN);
    if (!Number.isFinite(rate)) {
      return fail(`the ${region} rate is per ${table.unit}, but you gave ${unit}. Pass ${table.unit === "km" ? "km" : "miles"}, or pass rate_per_km with your own rate for ${unit}.`);
    }
    const currency = usingOwnRate ? normCurrency(a.currency, table.currency) : table.currency;
    if (!isKnownCurrency(currency)) return fail(`"${currency}" is not an ISO 4217 currency code.`);
    const minor = mileageAmount(distance, rate, currency);
    if (!Number.isSafeInteger(minor)) return fail("that distance is too large to represent exactly.");

    return await locked(() => {
      const db = load();
      if (a.project && !gate.isPro()) {
        const known = projectsOf(db);
        if (!known.some((p) => p.toLowerCase() === a.project!.toLowerCase()) && known.length >= FREE_PROJECTS) {
          return gated(`This would be project number ${known.length + 1}. The free tier tracks ${FREE_PROJECTS} projects. Nothing was saved.\n\n` + gate.upgradeText("unlimited projects", "mileage_add"));
        }
      }
      const e: Expense = {
        id: newId(), date, amount_minor: minor, currency, category: "mileage",
        project: a.project, note: a.purpose, billable: a.billable ?? true,
        mileage: { distance, unit, rate, region, purpose: a.purpose },
        created: new Date().toISOString(),
      };
      db.expenses.push(e);
      save(db);
      const source = usingOwnRate
        ? "your rate_per_km"
        : `table rate ${region} ${table.rate} ${table.currency}/${table.unit}, an approximation; pass rate_per_km for your exact scheme`;
      const billableDefaulted = typeof a.billable !== "boolean";
      return ok(`Saved ${e.id}: ${distance} ${unit}${distance === 1 ? "" : "s"} on ${date} at ${rate} ${currency}/${unit} ` +
        `(${source}) = ${formatMoney(minor, currency)}. ${a.purpose}` +
        (e.project
          ? `\nProject: ${e.project}.`
          : `\nProject: none - this drive will NOT appear in expense_summary {by: "project"} or in expense_to_invoice. Pass project to bill it to a client.`) +
        (e.billable
          ? ` Billable: yes${billableDefaulted ? " (default for a mileage claim; pass billable: false to keep it off the invoice)" : ""}.`
          : " Billable: no - it will NOT appear in expense_to_invoice."));
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ------------------------------------------------------------- expense_export */

function exportRows(rows: Expense[]) {
  return rows.map((e) => {
    const s = vatSplit(e.amount_minor, e.vat_rate);
    return {
      id: e.id, date: e.date, currency: e.currency,
      // D-R38: time-tracker's export_csv calls the money column "amount". Both exports now
      // carry "amount"; "gross" stays as an additional column for existing readers.
      amount: toMajor(s.gross_minor, e.currency),
      gross: toMajor(s.gross_minor, e.currency),
      net: toMajor(s.net_minor, e.currency),
      vat: toMajor(s.vat_minor, e.currency),
      vat_rate: s.rate,
      category: e.category ?? "", merchant: e.merchant ?? "", project: e.project ?? "",
      billable: e.billable ? "yes" : "no",
      note: e.note ?? "",
      receipt_path: e.receipt_path ?? "",
      receipt_sha256: e.receipt_sha256 ?? "",
      mileage: e.mileage ? `${e.mileage.distance} ${e.mileage.unit}` : "",
    };
  });
}

const CSV_HEADERS = ["id", "date", "currency", "amount", "gross", "net", "vat", "vat_rate", "category", "merchant", "project", "billable", "note", "receipt_path", "receipt_sha256", "mileage"];

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

server.registerTool("expense_export", {
  title: "Export expenses",
  description: "Call this tool to write manually logged receipts to a csv, xlsx or json file. Returns the path. Bank transactions for the period are exported by bank-statement's statement_export tool, not this one.",
  inputSchema: {
    from: text(10).describe("ISO date, inclusive"),
    to: text(10).describe("ISO date, inclusive"),
    format: z.enum(["csv", "xlsx", "json"]),
    path: text(4096).optional().describe("Absolute path to write to; a leading ~ is expanded and missing parent directories are created. Default is an exports folder in the server data directory"),
    project: text().optional(),
    category: text().optional(),
    billable: z.boolean().optional(),
  },
}, async (a) => {
  try {
    if (!isIsoDate(a.from)) return fail(`from must be YYYY-MM-DD, got "${a.from}".`);
    if (!isIsoDate(a.to)) return fail(`to must be YYYY-MM-DD, got "${a.to}".`);
    const pro = gate.isPro();
    if (a.format === "xlsx" && !pro) {
      return gated(`xlsx export is a Pro format. Nothing was written. Export as csv instead, which the free tier supports up to ${FREE_EXPORT_ROWS} rows.\n\n` + gate.upgradeText("xlsx export", "expense_export"));
    }
    const w = windowNote(a.from, a.to);
    const rows = select(load(), { from: w.from, to: a.to, project: a.project, category: a.category, billable: a.billable });
    if (!pro && rows.length > FREE_EXPORT_ROWS) {
      // Refuse before opening the file: a truncated export looks complete and is worse than none.
      return gated(`That range holds ${rows.length} expenses and the free tier exports ${FREE_EXPORT_ROWS} rows. No file was written. Narrow the range or filter by project or category to get under ${FREE_EXPORT_ROWS}.\n\n` + gate.upgradeText(`exports over ${FREE_EXPORT_ROWS} rows`, "expense_export"));
    }
    const data = exportRows(rows);
    const target = a.path
      ? expandPath(a.path)
      : join(dataDir(), "exports", `expenses-${a.from}-to-${a.to}.${a.format}`);
    mkdirSync(dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    try {
      if (a.format === "csv") {
        const lines = [CSV_HEADERS.join(",")];
        for (const r of data) lines.push(CSV_HEADERS.map((h) => csvCell((r as Record<string, unknown>)[h])).join(","));
        writeFileSync(tmp, lines.join("\n") + "\n");
      } else if (a.format === "json") {
        writeFileSync(tmp, JSON.stringify({ from: w.from, to: a.to, count: data.length, expenses: data }, null, 2));
      } else {
        const ws = XLSX.utils.json_to_sheet(data, { header: CSV_HEADERS });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Expenses");
        XLSX.writeFile(wb, tmp, { bookType: "xlsx" });
      }
      renameSync(tmp, target);
    } catch (err) {
      try { if (existsSync(tmp)) unlinkSync(tmp); } catch {}
      throw err;
    }
    const bankLine = bankLedgerLine(w.from, a.to, "statement_export");
    return ok(`Wrote ${data.length} expenses to ${target} (${a.format}).` + (w.note ? `\n\n${w.note}` : "") + (bankLine ? `\n\n${bankLine}` : ""));
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ---------------------------------------------------------- expense_to_invoice */

server.registerTool("expense_to_invoice", {
  title: "Rebill expenses to an invoice",
  description: "Preview the unbilled billable expenses of one project as invoice_create line items (description, quantity, unit_price, tax_rate), grouped per currency. Read-only: nothing is marked rebilled here.",
  inputSchema: {
    project: text().describe("Project or client to rebill"),
    from: text(10).describe("ISO date, inclusive"),
    to: text(10).describe("ISO date, inclusive"),
    markup_percent: z.number().finite().min(0).max(1000).optional().describe("Percent added to each net amount. Every line's unit_price is the NET amount and its tax_rate is the VAT rate recorded on the expense, so the invoice recomputes the same tax instead of charging it twice and the line total comes back to the receipt gross"),
    include_rebilled: z.boolean().optional().describe("Include expenses already marked as rebilled, default false"),
    assume_vat_rate: z.number().finite().min(0).max(100).optional().describe("Split expenses that recorded NO VAT rate at this percent, flagged in the description. Only applied when you pass it here. An expense with no rate holds a GROSS amount and is otherwise rebilled as-is with tax_rate 0 plus a warning in its description, so a default tax rate applied on the invoice would tax that receipt a second time. A stored rate of 0 is a real rate (exempt), not a gap. The expense_settings default is never applied retroactively, because that would rewrite the tax meaning of receipts entered before it existed"),
    target_currency: z.string().regex(/^[A-Za-z]{3}$/).optional().describe('Convert every line into this currency and return ONE group, e.g. "USD". Needs fx_rates for each other currency present. Lines are otherwise grouped per currency, because one invoice carries one currency; each converted line carries "[converted from EUR 12.40 at 1.08]" in its description'),
    fx_rates: z.record(z.string(), z.number().finite().positive()).optional().describe('Rate per source currency, meaning 1 unit of that currency = X units of target_currency, e.g. {"EUR": 1.08, "GBP": 1.27}. You supply the rate; nothing here fetches or guesses one. Omit it when the range holds several currencies and the response names the exact argument to pass'),
  },
}, async (a) => {
  try {
    if (!isIsoDate(a.from)) return fail(`from must be YYYY-MM-DD, got "${a.from}".`);
    if (!isIsoDate(a.to)) return fail(`to must be YYYY-MM-DD, got "${a.to}".`);
    // D-R14: FX is caller-supplied. Nothing in this suite fetches or invents a rate.
    const target = a.target_currency ? normCurrency(a.target_currency) : undefined;
    if (target && !isKnownCurrency(target)) return fail(`"${target}" is not an ISO 4217 currency code.`);
    if (a.fx_rates && !target) {
      return fail(`fx_rates needs target_currency as well: a rate of 1.08 means nothing until you say 1.08 of WHAT. Pass target_currency: "USD" with it.`);
    }
    const fx = new Map<string, number>();
    for (const [k, v] of Object.entries(a.fx_rates ?? {})) {
      const c = normCurrency(k);
      if (!isKnownCurrency(c)) return fail(`fx_rates key "${k}" is not an ISO 4217 currency code.`);
      if (!(typeof v === "number" && Number.isFinite(v) && v > 0)) return fail(`fx_rates["${k}"] must be a positive number.`);
      fx.set(c, v);
    }
    // markup_percent used to be Pro-gated. Measured in the user-value run: the model met the
    // paywall, recomputed the markup by hand off the GROSS amount and emitted tax_rate 0, which is
    // the exact double-tax shape expense_to_invoice exists to prevent. The item-count cap below is
    // the free-tier limit; the arithmetic is not.
    const markup = a.markup_percent ?? 0;
    const w = windowNote(a.from, a.to);
    return await locked(() => {
      const db = load();
      let rows = select(db, { from: w.from, to: a.to, project: a.project, billable: true });
      if (!a.include_rebilled) rows = rows.filter((e) => !e.rebilled_at);
      if (!gate.isPro() && rows.length > FREE_REBILL_ITEMS) {
        return gated(`There are ${rows.length} billable expenses to rebill and the free tier converts ${FREE_REBILL_ITEMS} at a time. Nothing was changed. Narrow the date range.\n\n` + gate.upgradeText("unlimited rebill items", "expense_to_invoice"));
      }
      interface Line { description: string; quantity: number; unit_price: number; tax_rate: number }
      const byCurrency = new Map<string, Line[]>();
      const idsByCurrency = new Map<string, string[]>();
      // D-R3: an expense with no recorded VAT rate holds a GROSS amount. Emitting it as a
      // net line with tax_rate 0 lets a downstream invoice default rate tax it a second
      // time, so the line says so in its own description. The retroactive split is applied
      // only when the caller passes assume_vat_rate on THIS call.
      const assume = typeof a.assume_vat_rate === "number" && a.assume_vat_rate > 0 ? a.assume_vat_rate : undefined;
      let assumed = 0, unknownVat = 0, adjustments = 0;
      for (const e of rows) {
        // A stored 0 is a known rate (exempt, or outside VAT). Only a missing/non-finite
        // value is unknown.
        const known = typeof e.vat_rate === "number" && Number.isFinite(e.vat_rate);
        const useAssumed = !known && assume !== undefined;
        const rate = known ? e.vat_rate! : useAssumed ? assume! : 0;
        const s = vatSplit(e.amount_minor, rate);
        const base = e.mileage
          ? `${e.date} mileage ${e.mileage.distance} ${e.mileage.unit} - ${e.mileage.purpose}`
          : `${e.date} ${e.merchant ?? e.category ?? "expense"}${e.note ? ` - ${e.note}` : ""}`;
        let label = base;
        if (useAssumed) { assumed++; label = `${base} [vat assumed ${rate}%]`; }
        else if (!known) {
          unknownVat++;
          label = `${base} [tax_rate: 0 (VAT unknown, gross rebilled as-is; pass assume_vat_rate to split)]`;
        }
        // D-R5: the invoice rounds tax again from the net, so net + tax does not always
        // reproduce the receipt gross (EUR 0.03 at 23% splits 0.02 + 0.01 but the invoice
        // recomputes 0.00 tax and charges 0.02). Reconcile here: nudge unit_price if that
        // lands the invoice total exactly, otherwise emit a visible adjustment line.
        const target = roundHalfUp((s.gross_minor * (100 + markup)) / 100);
        let netMinor = roundHalfUp((s.net_minor * (100 + markup)) / 100);
        const lineTotal = (n: number) => n + (rate ? roundHalfUp((n * rate) / 100) : 0);
        let delta = target - lineTotal(netMinor);
        if (delta !== 0 && lineTotal(netMinor + delta) === target) { netMinor += delta; delta = 0; }
        const items = byCurrency.get(e.currency) ?? [];
        items.push({ description: label, quantity: 1, unit_price: toMajor(netMinor, e.currency), tax_rate: rate });
        if (delta !== 0) {
          adjustments++;
          items.push({
            description: `${base} [rounding adjustment so the line total is the receipt gross ${formatMoney(s.gross_minor, e.currency)}]`,
            quantity: 1,
            unit_price: toMajor(delta, e.currency),
            tax_rate: 0,
          });
        }
        byCurrency.set(e.currency, items);
        idsByCurrency.set(e.currency, [...(idsByCurrency.get(e.currency) ?? []), e.id]);
      }
      let groups = [...byCurrency.entries()].map(([currency, items]) => ({
        currency, items,
        expense_ids: idsByCurrency.get(currency) ?? [],
        total_net: formatMoney(items.reduce((n, i) => n + toMinor(i.unit_price * i.quantity, currency), 0), currency),
      }));

      // D-R14: a freelancer week is routinely USD hours + a EUR receipt + a GBP mileage
      // line, and "invoice everything unbilled in USD" had no argument that could say so.
      // With target_currency + fx_rates every group folds into ONE, and each converted
      // line says on its own face what it was and at what rate. Without the rates the
      // response names the exact argument instead of leaving the caller to invent one.
      const present = groups.map((g) => g.currency);
      const foreign = present.filter((c) => c !== target);
      let converted = 0;
      let fxNote: string | undefined;
      if (target) {
        const missing = foreign.filter((c) => !fx.has(c));
        if (missing.length) {
          return fail(
            `no rate for ${missing.join(", ")}. Pass fx_rates with one entry per currency, meaning 1 unit of that currency = X units of ${target}: ` +
            `expense_to_invoice {project: ${JSON.stringify(a.project)}, from: "${w.from}", to: "${a.to}", target_currency: "${target}", ` +
            `fx_rates: {${missing.map((c) => `"${c}": <rate>`).join(", ")}}}. Nothing here fetches or guesses a rate.`
          );
        }
        const merged: Line[] = [];
        const mergedIds: string[] = [];
        for (const g of groups) {
          const rate = g.currency === target ? 1 : fx.get(g.currency)!;
          for (const it of g.items) {
            if (rate === 1 && g.currency === target) { merged.push(it); continue; }
            const srcMinor = toMinor(it.unit_price * it.quantity, g.currency);
            const tgtMajor = toMajor(toMinor(it.unit_price * rate, target), target);
            converted++;
            merged.push({
              description: `${it.description} [converted from ${formatMoney(srcMinor, g.currency)} at ${rate}]`,
              quantity: it.quantity,
              unit_price: tgtMajor,
              tax_rate: it.tax_rate,
            });
          }
          mergedIds.push(...g.expense_ids);
        }
        groups = merged.length
          ? [{
              currency: target,
              items: merged,
              expense_ids: mergedIds,
              total_net: formatMoney(merged.reduce((n, i) => n + toMinor(i.unit_price * i.quantity, target), 0), target),
            }]
          : [];
        fxNote = converted
          ? `${converted} line(s) converted to ${target} at the rates you passed (${foreign.map((c) => `${c} ${fx.get(c)}`).join(", ")}). Each converted description carries its original amount and rate. The rates are yours, not fetched.`
          : `Nothing needed converting: every line was already in ${target}.`;
      } else if (present.length > 1) {
        fxNote =
          `${present.length} currencies in this range (${present.join(", ")}) and one invoice carries one currency. ` +
          `To get ONE invoice, re-run with the target and your own rates, e.g. ` +
          `expense_to_invoice {project: ${JSON.stringify(a.project)}, from: "${w.from}", to: "${a.to}", target_currency: "${present[0]}", ` +
          `fx_rates: {${present.slice(1).map((c) => `"${c}": <1 ${c} in ${present[0]}>`).join(", ")}}}. ` +
          `Otherwise invoice one group now and rebill the others on their own invoices.`;
      }

      // D-R20: an empty set has no lines, so it must not assert a conversion or a tax fact
      // about them. count 0 returns a plain reason and NO fx_note at all.
      const empty = rows.length === 0;
      const emptyNote =
        "no matching billable, un-rebilled expenses in this range" +
        (a.include_rebilled ? "" : " (an expense must have billable: true and no rebilled_at)") +
        (w.note ? ` ${w.note}` : "");
      if (empty) {
        return json({
          project: a.project, from: w.from, to: a.to,
          markup_percent: markup,
          count: 0,
          marked_rebilled: false,
          vat_assumed_lines: 0,
          vat_unknown_lines: 0,
          rounding_adjustment_lines: 0,
          currencies: [],
          source_currencies: [],
          target_currency: target ?? null,
          converted_lines: 0,
          fx_rates_used: null,
          line_items_per_currency: [],
          next_step: "Nothing to rebill in that range. The two usual causes are: the expenses are not marked billable (expense_add defaults billable to true only when a project is given), or they were already rebilled (pass include_rebilled: true to see those). Check with expense_list {from, to, project}.",
          note: emptyNote,
        });
      }

      return json({
        project: a.project, from: w.from, to: a.to,
        markup_percent: markup,
        count: rows.length,
        marked_rebilled: false,
        vat_assumed_lines: assumed,
        vat_unknown_lines: unknownVat,
        rounding_adjustment_lines: adjustments,
        line_item_note: "Each line's unit_price is the NET amount and its tax_rate is the VAT rate recorded on the expense, so invoice_create recomputes the same tax rather than charging it a second time, and the line total comes back to the receipt gross.",
        vat_note: assumed
          ? `${assumed} line(s) had no VAT rate recorded and were split at the assume_vat_rate you passed (${assume}%), flagged "vat assumed ${assume}%" in the description.`
          : unknownVat
            ? `${unknownVat} line(s) had no VAT rate recorded: the gross amount is rebilled as-is with tax_rate 0 and the description says so. Do not apply a default tax rate to those lines on the invoice, or the receipt is taxed twice. Pass assume_vat_rate {percent} to split them instead; the expense_settings default is deliberately not applied retroactively.`
            : "Every line carries the VAT rate recorded on its expense.",
        currencies: groups.map((g) => g.currency),
        source_currencies: present,
        target_currency: target ?? null,
        converted_lines: converted,
        fx_rates_used: target ? Object.fromEntries([...fx].filter(([c]) => foreign.includes(c))) : null,
        fx_note: fxNote,
        line_items_per_currency: groups,
        next_step: groups.length
          ? `1. Pass one group's items straight to invoice_create {client: "...", currency: "${groups[0].currency}", items: <line_items_per_currency[0].items>}. ` +
            `2. Once that invoice exists, mark exactly that group: expense_mark_rebilled {ids: <line_items_per_currency[0].expense_ids>, invoice_number: "<the number>"}. ` +
            `A range instead of ids needs currency as well, or the other currency groups are marked against an invoice that never carried them.`
          : "Nothing to rebill in that range.",
        note: w.note,
      });
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ------------------------------------------------------ expense_mark_rebilled */

server.registerTool("expense_mark_rebilled", {
  title: "Mark expenses as rebilled",
  description: "Mark expenses as rebilled once the invoice that carries them actually exists. Pass the expense_ids of one currency group from expense_to_invoice, or that project, date range and currency. Returns what was marked.",
  inputSchema: {
    ids: z.array(text(64)).optional().describe("Expense ids, as returned per currency by expense_to_invoice. Takes precedence over project/from/to"),
    project: text().optional().describe("Project rebilled, used with from, to and currency"),
    from: text(10).optional().describe("ISO date, inclusive"),
    to: text(10).optional().describe("ISO date, inclusive"),
    currency: z.string().regex(/^[A-Za-z]{3}$/).optional().describe("Required when marking by range: one invoice carries one currency. A range marks only billable, not-yet-rebilled expenses in this one currency, so invoicing the EUR group cannot mark the PLN one"),
    invoice_number: text(64).describe("Invoice the expenses were billed on. Required: the marker records WHICH invoice carries each expense, and it is stored on every expense marked"),
  },
}, async (a) => {
  try {
    if (!a.ids?.length && !(a.project && a.from && a.to)) {
      return fail("pass either ids, or project with from and to.");
    }
    // D-R6: one invoice carries one currency. A range that spans EUR and PLN would mark
    // both groups against an invoice that only ever carried one of them.
    if (!a.ids?.length && !a.currency) {
      return fail("marking by range needs currency as well: one invoice carries one currency. Pass the expense_ids of one currency group from expense_to_invoice, or add currency.");
    }
    if (a.from && !isIsoDate(a.from)) return fail(`from must be YYYY-MM-DD, got "${a.from}".`);
    if (a.to && !isIsoDate(a.to)) return fail(`to must be YYYY-MM-DD, got "${a.to}".`);
    return await locked(() => {
      const db = load();
      let rows: Expense[];
      if (a.ids?.length) {
        const want = new Set(a.ids);
        rows = db.expenses.filter((e) => want.has(e.id));
        const missing = a.ids.filter((id) => !rows.some((e) => e.id === id));
        if (missing.length) return fail(`no expense with id ${missing.join(", ")}. Nothing was changed.`);
      } else {
        const cur = normCurrency(a.currency!);
        if (!isKnownCurrency(cur)) return fail(`"${cur}" is not an ISO 4217 currency code.`);
        rows = select(db, { from: a.from!, to: a.to!, project: a.project, billable: true })
          .filter((e) => !e.rebilled_at && e.currency === cur);
      }
      if (!rows.length) return ok(`Nothing to mark: no matching unbilled billable expense${a.currency ? ` in ${normCurrency(a.currency)}` : ""}.`);
      const stamp = new Date().toISOString();
      for (const e of rows) {
        e.rebilled_at = stamp;
        e.rebilled_invoice = a.invoice_number;
      }
      save(db);
      return json({
        marked: rows.length,
        invoice_number: a.invoice_number,
        note: a.ids?.length
          ? `Marked by id, so exactly the ${rows.length} expense(s) you passed now carry invoice ${a.invoice_number}.`
          : `Marked by range in ${normCurrency(a.currency!)} only: billable, not-yet-rebilled expenses in that one currency, because one invoice carries one currency.`,
        currency: a.ids?.length ? null : normCurrency(a.currency!),
        ids: rows.map((e) => e.id),
        rebilled_at: stamp,
      });
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ----------------------------------------------------------------- resources */

function monthSummary() {
  const month = isoToday().slice(0, 7);
  const from = `${month}-01`;
  const to = isoToday();
  const rows = select(load(), { from, to });
  return { month, from, to, count: rows.length, by_currency: summarise(rows, "category") };
}

server.registerResource("current-month", "expenses://month", {
  title: "This month's expenses",
  description: "Totals for the current calendar month so far, grouped by category, per currency.",
  mimeType: "application/json",
}, async (uri) => ({
  contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(monthSummary(), null, 2) }],
}));

/* ------------------------------------------------------------------- prompts */

server.registerPrompt("monthly_close", {
  title: "Monthly expense close",
  description: "Close out a month: totals, unbilled billable expenses and expenses with no receipt attached.",
  argsSchema: { month: z.string().optional().describe("YYYY-MM, default the current month") },
}, ({ month }) => {
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : isoToday().slice(0, 7);
  const from = `${m}-01`;
  const endDate = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0));
  const to = endDate.toISOString().slice(0, 10);
  return {
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: [
          `Close the expense month ${m} (${from} to ${to}). Do all of this with the expense tracker tools and report it as one short summary:`,
          `1. expense_summary {from: "${from}", to: "${to}", group_by: "category"} and again with group_by "project". Report totals per currency, with the VAT split.`,
          `2. expense_list {from: "${from}", to: "${to}", billable: true} - list every billable expense that has no rebilled_at, per project, with its amount. Those are the ones still to invoice.`,
          `3. From the same list, name every expense with no receipt attached, with its id, date, merchant and amount, so the receipts can be found before the books close.`,
          `4. If a project has unbilled billable expenses, offer to run expense_to_invoice for it.`,
          `Do not add anything up across currencies.`,
        ].join("\n"),
      },
    }],
  };
});

gate.registerTools(server as unknown as { registerTool: Function });

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-expense-tracker ready (${gate.isPro() ? "pro" : "free"}), data in ${dataDir()}\n`);
