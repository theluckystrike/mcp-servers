#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, withFileLock } from "@theluckystrike/mcp-license";
import { z } from "zod";
import {
  BANK_IDS, counterpartyKey, readStatement, StatementError,
  type BankId, type ParsedRow,
} from "./detect.js";
import {
  currencyDecimals, dayDiff, formatMoney, hasRegexMetacharacters, isIsoDate, isKnownCurrency,
  isoMonthsAgo, isoPlusDays, isoToday, isSafeRegexSource, MAX_MATCH_INPUT, toMajor,
} from "./money.js";
import {
  dataDir, expenseDbPath, load, lockPath, readExpenses, save,
  type Account, type DB, type Rule, type Txn,
} from "./store.js";

const PRODUCT = "bank-statement";
const FREE_ACCOUNTS = 2;
const FREE_WINDOW_MONTHS = 12;
const FREE_RULES = 5;
/** Free text is stored verbatim in data.json and echoed back; a 1 MB category is not a category. */
const MAX_TEXT = 500;
/** The whole CSV is read into memory and parsed, so the size is bounded before the read. */
const MAX_FILE_BYTES = 32 * 1024 * 1024;
/** One import is one statement; a file with more lines than this is not a bank export. */
const MAX_ROWS = 200000;

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

const text = (max = MAX_TEXT) => z.string().max(max, `must be ${max} characters or fewer`);

function expandPath(p: string): string {
  const s = p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

/**
 * Read the file as text. A statement exported from Excel on Windows is often UTF-16, and
 * decoding those bytes as UTF-8 turns "Date" into "D\u0000a\u0000t\u0000e", so the header
 * search failed with "no header row was found" on a file that is perfectly well formed.
 * The byte-order mark decides the encoding; without one the file is UTF-8 as before.
 */
function readStatementText(p: string): string {
  const buf = readFileSync(p);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString("utf16le");
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return buf.subarray(2).swap16().toString("utf16le");
  return buf.toString("utf8");
}

/* ------------------------------------------------------------------- windowing */

/**
 * The free tier reads the last 12 months. Import stores everything -- silently dropping
 * rows on the way in would make the file on disk disagree with the bank -- so the limit is
 * applied on the way out, and every response that moved a `from` says so.
 */
function windowNote(from: string | undefined): { from?: string; note?: string } {
  if (gate.isPro()) return { from };
  const cutoff = isoMonthsAgo(FREE_WINDOW_MONTHS);
  if (from && from >= cutoff) return { from };
  return {
    from: cutoff,
    note: `Free tier reads the last ${FREE_WINDOW_MONTHS} months only, so this covers ${cutoff} onwards${from ? ` instead of ${from}` : ""}. ` +
      gate.upgradeText("full statement history"),
  };
}

interface Filter { from?: string; to?: string; account?: string; category?: string; uncategorized?: boolean }

function select(db: DB, f: Filter): Txn[] {
  return db.transactions.filter((t) => {
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (f.account && t.account.toLowerCase() !== f.account.toLowerCase()) return false;
    if (f.category && (t.category ?? "").toLowerCase() !== f.category.toLowerCase()) return false;
    if (f.uncategorized && t.category) return false;
    return true;
  }).sort((a, b) => (a.date === b.date ? a.imported.localeCompare(b.imported) : a.date.localeCompare(b.date)));
}

/* ----------------------------------------------------------------------- rules */

/**
 * A rule is a plain substring unless it is declared a regex, and a regex is compiled only
 * when it cannot backtrack exponentially: `(a+)+$` against a long description never returns
 * and takes the stdio server with it. An unsafe or invalid pattern degrades to a substring
 * test, which is what most rules are anyway.
 */
function ruleMatches(rule: Rule, subject: string): boolean {
  const input = subject.slice(0, MAX_MATCH_INPUT);
  const lower = input.toLowerCase();
  const wantsRegex = rule.regex === true || (rule.regex === undefined && hasRegexMetacharacters(rule.match));
  if (!wantsRegex) return lower.includes(rule.match.toLowerCase());
  if (!isSafeRegexSource(rule.match)) return lower.includes(rule.match.toLowerCase());
  try { return new RegExp(rule.match, "i").test(input); }
  catch { return lower.includes(rule.match.toLowerCase()); }
}

/** Rules are matched against the counterparty and the description together. */
function applyRules(rules: Rule[], t: { description: string; counterparty?: string }): string | undefined {
  const subject = `${t.counterparty ?? ""} ${t.description}`;
  for (const r of rules) if (ruleMatches(r, subject)) return r.category;
  return undefined;
}

/* ---------------------------------------------------------------------- dedupe */

/**
 * The dedupe key is the date, the signed amount, the currency, the account and a normalised
 * description. Two genuinely identical coffees on one day are two transactions, not a
 * duplicate, so the key carries an occurrence index as well: the Nth identical line in a
 * file matches the Nth identical line already stored, and re-importing the same export
 * therefore matches all of them and adds nothing.
 */
function dedupeBase(account: string, r: { date: string; amount_minor: number; currency: string; description: string }): string {
  const norm = r.description.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256")
    .update(`${account} ${r.date} ${r.amount_minor} ${r.currency} ${norm}`)
    .digest("hex").slice(0, 32);
}

/* -------------------------------------------------------------------- summaries */

interface Bucket { count: number; in_minor: number; out_minor: number }

function summarise(rows: Txn[], groupBy: "category" | "month" | "account" | "counterparty") {
  const byCurrency = new Map<string, Map<string, Bucket>>();
  for (const t of rows) {
    const key = groupBy === "category" ? (t.category ?? "(uncategorised)")
      : groupBy === "month" ? t.date.slice(0, 7)
      : groupBy === "account" ? t.account
      : (t.counterparty ?? t.description).slice(0, 60);
    let g = byCurrency.get(t.currency);
    if (!g) { g = new Map(); byCurrency.set(t.currency, g); }
    const b = g.get(key) ?? { count: 0, in_minor: 0, out_minor: 0 };
    b.count++;
    if (t.amount_minor >= 0) b.in_minor += t.amount_minor; else b.out_minor += -t.amount_minor;
    g.set(key, b);
  }
  const out: Record<string, unknown> = {};
  for (const [cur, g] of byCurrency) {
    const groups = [...g.entries()]
      .map(([k, b]) => ({
        group: k, count: b.count,
        money_in: formatMoney(b.in_minor, cur),
        money_out: formatMoney(b.out_minor, cur),
        net: formatMoney(b.in_minor - b.out_minor, cur),
        net_minor: b.in_minor - b.out_minor,
      }))
      .sort((a, b) => Math.abs(b.net_minor) - Math.abs(a.net_minor));
    const tin = [...g.values()].reduce((s, b) => s + b.in_minor, 0);
    const tout = [...g.values()].reduce((s, b) => s + b.out_minor, 0);
    out[cur] = {
      count: [...g.values()].reduce((s, b) => s + b.count, 0),
      money_in: formatMoney(tin, cur), money_out: formatMoney(tout, cur), net: formatMoney(tin - tout, cur),
      groups,
    };
  }
  return out;
}

function view(t: Txn) {
  return {
    id: t.id, date: t.date, account: t.account,
    amount: formatMoney(t.amount_minor, t.currency), currency: t.currency,
    direction: t.amount_minor < 0 ? "out" : "in",
    description: t.description, counterparty: t.counterparty, category: t.category,
    balance: t.balance_minor === undefined ? undefined : formatMoney(t.balance_minor, t.currency),
  };
}

const server = new McpServer(
  { name: "mcp-bank-statement", version: "0.6.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

/* ------------------------------------------------------------ statement_import */

server.registerTool("statement_import", {
  title: "Import a bank CSV",
  description: "Read a bank CSV export into the local ledger. Columns are detected from the headers (date, description, one signed amount or a debit and a credit column, currency, balance), amounts are read in the file's own locale, and every line already stored is skipped rather than doubled. Returns what was detected, what was stored, and what was skipped and why.",
  inputSchema: {
    path: text(4096).describe("Path to the .csv file exported from the bank. ~ is expanded"),
    account: text(120).optional().describe("Name for this account, e.g. \"business EUR\". Default: the file name without its extension. Later imports of the same account are deduplicated against it"),
    bank: z.enum(BANK_IDS as [BankId, ...BankId[]]).optional().describe("Bank profile. Default \"auto\": the headers decide. \"generic\" skips profile detection and uses the header heuristics alone"),
    overwrite: z.boolean().optional().describe("Delete every transaction already stored for this account before importing, instead of merging. Use it when the bank reissued a corrected export"),
    currency: z.string().regex(/^[A-Za-z]{3}$/, "must be a 3-letter ISO code such as EUR").optional().describe("Currency for rows where the file names none. Without it EUR is assumed and the response says so"),
  },
}, async (a) => {
  try {
    const p = expandPath(a.path);
    if (!existsSync(p) || !statSync(p).isFile()) return fail(`no file at ${p}.`);
    const size = statSync(p).size;
    if (size > MAX_FILE_BYTES) return fail(`that file is ${(size / 1048576).toFixed(1)} MB; the limit is ${MAX_FILE_BYTES / 1048576} MB. Split the export by month.`);
    if (a.currency && !isKnownCurrency(a.currency)) return fail(`"${a.currency.toUpperCase()}" is not an ISO 4217 currency code.`);

    const raw = readStatementText(p);
    const account = (a.account ?? p.split("/").pop()!.replace(/\.[^.]+$/, "")).trim().slice(0, 120) || "default";

    let parsed;
    try { parsed = readStatement(raw, { bank: a.bank ?? "auto", fallbackCurrency: a.currency }); }
    catch (e) { return fail(e instanceof StatementError ? e.message : String((e as Error).message ?? e)); }
    if (parsed.rows.length > MAX_ROWS) return fail(`that file holds ${parsed.rows.length} transactions; the limit is ${MAX_ROWS}.`);

    return await locked(() => {
      const db = load();
      const known = db.accounts.map((x) => x.name);
      const isNew = !known.some((n) => n.toLowerCase() === account.toLowerCase());
      if (isNew && !gate.isPro() && known.length >= FREE_ACCOUNTS) {
        return gated(
          `This would be account number ${known.length + 1} (${known.join(", ")} already exist). ` +
          `The free tier tracks ${FREE_ACCOUNTS} accounts. Nothing was imported; import into one of those, or upgrade.\n\n` +
          gate.upgradeText("unlimited accounts"),
        );
      }

      if (a.overwrite) db.transactions = db.transactions.filter((t) => t.account.toLowerCase() !== account.toLowerCase());

      // Existing occurrence counts, so the Nth identical line matches the Nth stored one.
      const seen = new Map<string, number>();
      for (const t of db.transactions) {
        if (t.account.toLowerCase() !== account.toLowerCase()) continue;
        const base = t.dedupe.split("#")[0];
        seen.set(base, (seen.get(base) ?? 0) + 1);
      }
      const inFile = new Map<string, number>();
      const stamp = new Date().toISOString();
      let added = 0, duplicates = 0, categorised = 0;
      let minDate = "9999-12-31", maxDate = "0000-01-01";
      const currencies = new Set<string>();

      for (const r of parsed.rows as ParsedRow[]) {
        const base = dedupeBase(account, r);
        const n = inFile.get(base) ?? 0;
        inFile.set(base, n + 1);
        if (n < (seen.get(base) ?? 0)) { duplicates++; continue; }
        const category = applyRules(db.rules, r);
        if (category) categorised++;
        db.transactions.push({
          id: newId(), account, date: r.date, description: r.description, counterparty: r.counterparty,
          amount_minor: r.amount_minor, currency: r.currency, balance_minor: r.balance_minor,
          category, bank: parsed.bank, dedupe: `${base}#${n}`, imported: stamp,
        });
        added++;
        if (r.date < minDate) minDate = r.date;
        if (r.date > maxDate) maxDate = r.date;
        currencies.add(r.currency);
      }

      if (isNew) {
        const acc: Account = {
          name: account, bank: parsed.bank, created: stamp,
          currency: currencies.size === 1 ? [...currencies][0] : undefined,
        };
        db.accounts.push(acc);
      }
      save(db);

      const notes = [...parsed.notes];
      if (!gate.isPro()) notes.push(`Everything was stored, but the free tier only READS the last ${FREE_WINDOW_MONTHS} months.`);
      return json({
        account, bank: parsed.bank, delimiter: parsed.delimiter === "\t" ? "tab" : parsed.delimiter,
        header_line: parsed.header_line, columns: parsed.columns,
        date_order: parsed.date_order, date_order_inferred: parsed.date_order_inferred,
        rows_read: parsed.rows.length, imported: added, duplicates_skipped: duplicates,
        auto_categorised: categorised,
        date_range: added ? { from: minDate, to: maxDate } : null,
        currencies: [...currencies],
        skipped_lines: parsed.skipped.slice(0, 20),
        skipped_total: parsed.skipped.length,
        notes,
      });
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ------------------------------------------------------------ transactions_list */

server.registerTool("transactions_list", {
  title: "List transactions",
  description: "List stored transactions in a date range, optionally for one account or category, or only the ones no rule has categorised yet. Totals are reported per currency and never added across currencies.",
  inputSchema: {
    from: text(10).optional().describe("ISO date YYYY-MM-DD, inclusive. Default: the start of the current month"),
    to: text(10).optional().describe("ISO date YYYY-MM-DD, inclusive. Default: today"),
    account: text(120).optional().describe("Limit to one account, as named at import"),
    category: text().optional().describe("Only transactions in this category"),
    uncategorized: z.boolean().optional().describe("Only transactions with no category yet"),
    limit: z.number().int().min(1).max(1000).optional().describe("Rows returned, default 200. Totals always cover the whole range"),
  },
}, async (a) => {
  try {
    const to = a.to ?? isoToday();
    const from = a.from ?? `${isoToday().slice(0, 7)}-01`;
    if (!isIsoDate(from)) return fail(`from must be YYYY-MM-DD, got "${from}".`);
    if (!isIsoDate(to)) return fail(`to must be YYYY-MM-DD, got "${to}".`);
    const w = windowNote(from);
    const rows = select(load(), { from: w.from, to, account: a.account, category: a.category, uncategorized: a.uncategorized });
    const limit = a.limit ?? 200;
    return json({
      from: w.from, to, count: rows.length,
      totals: summarise(rows, "account"),
      transactions: rows.slice(0, limit).map(view),
      truncated: rows.length > limit ? `showing ${limit} of ${rows.length}; raise limit or narrow the range` : undefined,
      note: w.note,
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ---------------------------------------------------------- transactions_search */

server.registerTool("transactions_search", {
  title: "Search transactions",
  description: "Find transactions whose description, counterparty, category or account contains the query. Case-insensitive substring search, never a regex, so a query with brackets in it cannot hang the server.",
  inputSchema: {
    query: text(200).describe("Text to look for, e.g. \"spotify\" or \"acme\""),
    from: text(10).optional().describe("ISO date, inclusive"),
    to: text(10).optional().describe("ISO date, inclusive"),
    limit: z.number().int().min(1).max(500).optional().describe("Rows returned, default 100"),
  },
}, async (a) => {
  try {
    const q = a.query.trim().toLowerCase();
    if (!q) return fail("query is empty.");
    if (a.from && !isIsoDate(a.from)) return fail(`from must be YYYY-MM-DD, got "${a.from}".`);
    if (a.to && !isIsoDate(a.to)) return fail(`to must be YYYY-MM-DD, got "${a.to}".`);
    const w = windowNote(a.from);
    const rows = select(load(), { from: w.from, to: a.to }).filter((t) =>
      `${t.description} ${t.counterparty ?? ""} ${t.category ?? ""} ${t.account}`.toLowerCase().includes(q));
    const limit = a.limit ?? 100;
    return json({
      query: a.query, matches: rows.length,
      totals: summarise(rows, "counterparty"),
      transactions: rows.slice(0, limit).map(view),
      truncated: rows.length > limit ? `showing ${limit} of ${rows.length}` : undefined,
      note: w.note,
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ---------------------------------------------------------------- category_rules */

server.registerTool("category_rules", {
  title: "Set or list category rules",
  description: "Set the rules that categorise transactions, or call with no arguments to list them. Each rule is matched against the counterparty and the description: a plain match is a case-insensitive substring, and regex: true compiles it only when the pattern cannot backtrack exponentially. Setting rules re-applies them to every stored transaction that has no category yet.",
  inputSchema: {
    rules: z.array(z.object({
      match: text(200).describe("Text to look for in the counterparty or description, e.g. \"spotify\""),
      category: text(120).describe("Category to set, e.g. \"software\""),
      regex: z.boolean().optional().describe("Treat match as a regular expression. A pattern that can backtrack exponentially is refused and used as a substring instead"),
    })).optional().describe("The complete rule list; it replaces the stored one. Omit to list the current rules"),
    reapply_all: z.boolean().optional().describe("Also overwrite categories set by an earlier rule or by hand. Default false: only uncategorised transactions are touched"),
  },
}, async (a) => {
  try {
    if (!a.rules) {
      const db = load();
      return json({ count: db.rules.length, rules: db.rules, free_limit: gate.isPro() ? null : FREE_RULES });
    }
    if (!gate.isPro() && a.rules.length > FREE_RULES) {
      return gated(`That is ${a.rules.length} rules; the free tier stores ${FREE_RULES}. Nothing was changed.\n\n` + gate.upgradeText("unlimited category rules"));
    }
    // An empty (or whitespace-only) match is a substring test that every description passes,
    // so one such rule silently stamps its category onto the entire ledger.
    if (a.rules.some((r) => r.match.trim() === "")) {
      return fail("a rule with an empty match would categorise every transaction. Give each rule the text to look for. Nothing was changed.");
    }
    const refused: string[] = [];
    for (const r of a.rules) if (r.regex && !isSafeRegexSource(r.match)) refused.push(r.match);
    const rules = a.rules;
    return await locked(() => {
      const db = load();
      db.rules = rules.map((r) => ({ match: r.match, category: r.category, regex: r.regex }));
      let applied = 0;
      for (const t of db.transactions) {
        if (t.category && !a.reapply_all) continue;
        const c = applyRules(db.rules, t);
        if (c && c !== t.category) { t.category = c; applied++; }
      }
      save(db);
      return json({
        rules: db.rules.length, categorised: applied,
        refused_as_regex: refused.length ? refused : undefined,
        note: refused.length
          ? `${refused.length} pattern(s) could backtrack exponentially and were used as plain substrings instead.`
          : undefined,
      });
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* --------------------------------------------------------- transaction_categorize */

server.registerTool("transaction_categorize", {
  title: "Categorise transactions by id",
  description: "Set the category on one or more transactions by id. Nothing is changed unless every id exists, so a typo cannot half-apply.",
  inputSchema: {
    ids: z.array(text(64)).min(1).describe("Transaction ids, as returned by transactions_list or transactions_search"),
    category: text(120).describe("Category to set. Pass an empty string to clear it"),
  },
}, async (a) => {
  try {
    return await locked(() => {
      const db = load();
      const want = new Set(a.ids);
      const rows = db.transactions.filter((t) => want.has(t.id));
      const missing = a.ids.filter((id) => !rows.some((t) => t.id === id));
      if (missing.length) return fail(`no transaction with id ${missing.join(", ")}. Nothing was changed.`);
      const category = a.category.trim();
      for (const t of rows) t.category = category || undefined;
      save(db);
      return json({ updated: rows.length, category: category || null, ids: rows.map((t) => t.id) });
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ----------------------------------------------------------- statement_summary */

server.registerTool("statement_summary", {
  title: "What I spent, from the bank account",
  description: "What was spent and received in a date range according to the BANK ACCOUNT itself, grouped by category, month, account or counterparty. This is the tool for \"what did I spend in August by category\" whenever a bank statement has been imported: it covers every line the bank shows, not only the receipts that were logged by hand. Every total is reported per currency; amounts in different currencies are never added together and never converted.",
  inputSchema: {
    from: text(10).optional().describe("ISO date, inclusive. Default: the start of the current month"),
    to: text(10).optional().describe("ISO date, inclusive. Default: today"),
    group_by: z.enum(["category", "month", "account", "counterparty"]).optional().describe("Default category"),
    account: text(120).optional().describe("Limit the summary to one account"),
    top: z.number().int().min(1).max(200).optional().describe("Groups returned per currency, largest net first. Default 25"),
  },
}, async (a) => {
  try {
    const to = a.to ?? isoToday();
    const from = a.from ?? `${isoToday().slice(0, 7)}-01`;
    if (!isIsoDate(from)) return fail(`from must be YYYY-MM-DD, got "${from}".`);
    if (!isIsoDate(to)) return fail(`to must be YYYY-MM-DD, got "${to}".`);
    const w = windowNote(from);
    const rows = select(load(), { from: w.from, to, account: a.account });
    const groupBy = a.group_by ?? "category";
    const top = a.top ?? 25;
    const full = summarise(rows, groupBy) as Record<string, { groups: unknown[] }>;
    for (const cur of Object.keys(full)) {
      const g = full[cur].groups;
      if (g.length > top) full[cur].groups = g.slice(0, top);
    }
    return json({ from: w.from, to, group_by: groupBy, count: rows.length, by_currency: full, note: w.note });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ---------------------------------------------------------- reconcile_expenses */

const DEFAULT_RECONCILE_WINDOW = 3;

server.registerTool("reconcile_expenses", {
  title: "Reconcile against the expense ledger",
  description: "Match bank debits against the expenses recorded by mcp-expense-tracker: same currency, same amount, and a date within a few days. Reports what matched, which bank lines have no expense behind them and which expenses never reached the bank. The expense ledger is only ever read, never written.",
  inputSchema: {
    from: text(10).describe("ISO date, inclusive"),
    to: text(10).describe("ISO date, inclusive"),
    account: text(120).optional().describe("Limit to one bank account"),
    window_days: z.number().int().min(0).max(31).optional().describe(`Allowed gap between the expense date and the bank date, default ${DEFAULT_RECONCILE_WINDOW}. A card payment usually settles a day or two after the receipt`),
  },
}, async (a) => {
  try {
    if (!gate.isPro()) return gated(`Reconciliation is a Pro feature.\n\n${gate.upgradeText("reconcile_expenses")}`);
    if (!isIsoDate(a.from)) return fail(`from must be YYYY-MM-DD, got "${a.from}".`);
    if (!isIsoDate(a.to)) return fail(`to must be YYYY-MM-DD, got "${a.to}".`);
    const window = a.window_days ?? DEFAULT_RECONCILE_WINDOW;
    const bank = select(load(), { from: a.from, to: a.to, account: a.account }).filter((t) => t.amount_minor < 0);
    const led = readExpenses();
    if (!led.present) {
      return json({
        matched: 0, expense_ledger: expenseDbPath(), expense_ledger_found: false,
        unmatched_bank: bank.length,
        note: "no expense ledger was found on this machine, so there was nothing to reconcile against. Install mcp-expense-tracker and log the receipts first.",
      });
    }
    // The expense window is widened by the tolerance at both ends, or an expense on the
    // 31st could never match a bank line on the 1st.
    const lo = isoPlusDays(a.from, -window), hi = isoPlusDays(a.to, window);
    const expenses = led.expenses.filter((e) => e.date >= lo && e.date <= hi);

    /**
     * Greedy nearest-date matching. Every candidate pair (same currency, exactly equal
     * amount, within the window) is scored by the date gap and taken smallest first, so a
     * 12.30 on the 3rd matches the receipt of the 3rd rather than the one of the 1st, and
     * neither side is ever used twice.
     */
    const pairs: { b: number; e: number; gap: number }[] = [];
    for (let i = 0; i < bank.length; i++) {
      for (let j = 0; j < expenses.length; j++) {
        if (expenses[j].currency !== bank[i].currency) continue;
        if (expenses[j].amount_minor !== -bank[i].amount_minor) continue;
        const gap = Math.abs(dayDiff(bank[i].date, expenses[j].date));
        if (gap > window) continue;
        pairs.push({ b: i, e: j, gap });
      }
    }
    pairs.sort((x, y) => x.gap - y.gap || x.b - y.b || x.e - y.e);
    const usedB = new Set<number>(), usedE = new Set<number>();
    const matched: unknown[] = [];
    for (const p of pairs) {
      if (usedB.has(p.b) || usedE.has(p.e)) continue;
      usedB.add(p.b); usedE.add(p.e);
      const t = bank[p.b], e = expenses[p.e];
      matched.push({
        amount: formatMoney(t.amount_minor, t.currency),
        bank: { id: t.id, date: t.date, account: t.account, counterparty: t.counterparty ?? t.description },
        expense: { id: e.id, date: e.date, merchant: e.merchant, category: e.category, project: e.project },
        days_apart: p.gap,
      });
    }
    const unmatchedBank = bank.filter((_, i) => !usedB.has(i));
    const unmatchedExp = expenses.filter((e, j) => !usedE.has(j) && e.date >= a.from && e.date <= a.to);
    return json({
      from: a.from, to: a.to, window_days: window,
      expense_ledger: expenseDbPath(), expense_ledger_found: true,
      bank_debits: bank.length, expenses_in_range: expenses.length,
      matched: matched.length, matches: matched.slice(0, 200),
      unmatched_bank: unmatchedBank.map((t) => ({ id: t.id, date: t.date, amount: formatMoney(t.amount_minor, t.currency), counterparty: t.counterparty ?? t.description })).slice(0, 200),
      expenses_without_a_bank_line: unmatchedExp.map((e) => ({ id: e.id, date: e.date, amount: formatMoney(e.amount_minor, e.currency), merchant: e.merchant })).slice(0, 200),
      note: led.note ?? "Matching is by exact amount in the same currency within the date window; a bank line that bundles two receipts will not match either of them.",
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ------------------------------------------------------------- recurring_detect */

interface Recurring {
  counterparty: string; currency: string; occurrences: number; cadence: string;
  typical_amount: string; last_seen: string; next_expected: string | null;
  median_days: number; total_in_window: string; annualised: string | null;
  cadence_confirmed: boolean; cadence_note?: string;
  dates: string[];
}

const CADENCES: { name: string; lo: number; hi: number; perYear: number }[] = [
  { name: "weekly", lo: 6, hi: 8, perYear: 52 },
  { name: "fortnightly", lo: 13, hi: 16, perYear: 26 },
  { name: "monthly", lo: 25, hi: 35, perYear: 12 },
  { name: "quarterly", lo: 84, hi: 96, perYear: 4 },
  { name: "annual", lo: 355, hi: 375, perYear: 1 },
];

function median(ns: number[]): number {
  const s = [...ns].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

server.registerTool("recurring_detect", {
  title: "Subscriptions and recurring charges in the bank data",
  description: "Find the charges that come back: the same counterparty, an amount that barely moves and a steady cadence. Reports the cadence, the typical amount, when it was last taken, when it is next due and what it costs per year, per currency.",
  inputSchema: {
    months: z.number().int().min(1).max(60).optional().describe("How far back to look, default 3. Two occurrences are enough to see a cadence, three make it certain"),
    account: text(120).optional().describe("Limit to one account"),
    min_occurrences: z.number().int().min(2).max(24).optional().describe("Occurrences required before a charge counts as recurring, default 2"),
  },
}, async (a) => {
  try {
    if (!gate.isPro()) return gated(`Recurring-charge detection is a Pro feature.\n\n${gate.upgradeText("recurring_detect")}`);
    const months = a.months ?? 3;
    const minOcc = a.min_occurrences ?? 2;
    const from = isoMonthsAgo(months);
    const to = isoToday();
    const rows = select(load(), { from, to, account: a.account }).filter((t) => t.amount_minor < 0);

    const groups = new Map<string, Txn[]>();
    for (const t of rows) {
      const name = counterpartyKey(t.counterparty ?? t.description);
      if (!name) continue;
      const key = `${t.currency}|${name}`;
      const list = groups.get(key);
      if (list) list.push(t); else groups.set(key, [t]);
    }

    const found: Recurring[] = [];
    for (const [key, list] of groups) {
      if (list.length < minOcc) continue;
      const currency = key.split("|")[0];
      const amounts = list.map((t) => -t.amount_minor);
      const med = median(amounts);
      if (med <= 0) continue;
      // A subscription's amount moves with FX and with a VAT change, not with usage, so
      // 15% (or one minor unit, whichever is larger) keeps a EUR 9.99 charge together
      // across a rate change while a supermarket, whose basket swings far more, stays out.
      const tolerance = Math.max(Math.round(med * 0.15), Math.pow(10, currencyDecimals(currency)));
      if (amounts.some((v) => Math.abs(v - med) > tolerance)) continue;
      const dates = [...new Set(list.map((t) => t.date))].sort();
      if (dates.length < minOcc) continue;
      const gaps: number[] = [];
      for (let i = 1; i < dates.length; i++) gaps.push(dayDiff(dates[i], dates[i - 1]));
      const medGap = median(gaps);
      const cadence = CADENCES.find((c) => medGap >= c.lo && medGap <= c.hi);
      if (!cadence) continue;
      if (gaps.some((g) => g < cadence.lo - 4 || g > cadence.hi + 4)) continue;
      const last = dates[dates.length - 1];
      // Two charges are one gap: they fix a cadence only by assumption. Annualising them
      // turns a single 14-day coincidence into a "EUR 1,599 a year" subscription, so the
      // yearly figure is withheld until a third charge confirms the interval.
      const confirmed = dates.length >= 3;
      found.push({
        counterparty: list[list.length - 1].counterparty ?? list[list.length - 1].description,
        currency, occurrences: list.length, cadence: cadence.name,
        typical_amount: formatMoney(med, currency),
        last_seen: last, next_expected: isoPlusDays(last, medGap), median_days: medGap,
        total_in_window: formatMoney(amounts.reduce((s, v) => s + v, 0), currency),
        annualised: confirmed ? formatMoney(med * cadence.perYear, currency) : null,
        cadence_confirmed: confirmed,
        cadence_note: confirmed ? undefined
          : `only ${dates.length} charges, one interval of ${medGap} days: the cadence is a guess and no yearly cost is reported until a third charge confirms it.`,
        dates,
      });
    }
    found.sort((x, y) => x.currency.localeCompare(y.currency) || y.occurrences - x.occurrences);

    return json({
      from, to, months, min_occurrences: minOcc,
      debits_examined: rows.length, recurring: found.length,
      charges: found,
      note: found.length
        ? "annualised is the typical amount at the detected cadence, not a forecast of what the bank will actually take."
        : `nothing came back at a steady cadence in ${months} month(s). ${months < 3 ? "Try months: 3 or more." : "A subscription needs at least two charges in the window to be visible."}`,
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ------------------------------------------------------------ statement_export */

function csvEscapeCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /["\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

server.registerTool("statement_export", {
  title: "Export bank transactions to a file",
  description: "Write the BANK transactions of a date range (a month, a quarter, a year) to a .csv or .json file and return the path. This is the tool for \"export September to <path>\" once a statement has been imported. The file is written atomically, so a failed export never leaves a half-written file behind.",
  inputSchema: {
    from: text(10).describe("ISO date, inclusive"),
    to: text(10).describe("ISO date, inclusive"),
    format: z.enum(["csv", "json"]).describe("csv for a spreadsheet, json for a program"),
    path: text(4096).describe("Where to write the file. ~ is expanded; the parent directory must exist"),
    account: text(120).optional().describe("Limit to one account"),
    category: text().optional().describe("Limit to one category"),
  },
}, async (a) => {
  try {
    if (!gate.isPro()) return gated(`Export is a Pro feature.\n\n${gate.upgradeText("statement_export")}`);
    if (!isIsoDate(a.from)) return fail(`from must be YYYY-MM-DD, got "${a.from}".`);
    if (!isIsoDate(a.to)) return fail(`to must be YYYY-MM-DD, got "${a.to}".`);
    const out = expandPath(a.path);
    const dir = dirname(out);
    if (!existsSync(dir)) return fail(`the directory ${dir} does not exist. Create it, or choose another path.`);
    // Overwriting is allowed (a monthly export is re-run), but it is never silent.
    const existed = existsSync(out);
    if (existed && statSync(out).isDirectory()) return fail(`${out} is a directory, not a file.`);
    const rows = select(load(), { from: a.from, to: a.to, account: a.account, category: a.category });

    let body: string;
    if (a.format === "json") {
      body = JSON.stringify(rows.map((t) => ({
        id: t.id, date: t.date, account: t.account, description: t.description, counterparty: t.counterparty,
        amount: toMajor(t.amount_minor, t.currency), amount_minor: t.amount_minor, currency: t.currency,
        category: t.category, balance: t.balance_minor === undefined ? null : toMajor(t.balance_minor, t.currency),
        bank: t.bank,
      })), null, 2);
    } else {
      const header = ["id", "date", "account", "description", "counterparty", "amount", "currency", "category", "balance"];
      const lines = [header.join(",")];
      for (const t of rows) {
        lines.push([
          t.id, t.date, t.account, t.description, t.counterparty ?? "",
          toMajor(t.amount_minor, t.currency), t.currency, t.category ?? "",
          t.balance_minor === undefined ? "" : toMajor(t.balance_minor, t.currency),
        ].map(csvEscapeCell).join(","));
      }
      body = lines.join("\n") + "\n";
    }
    // tmp + rename: a crash mid-write must not leave a truncated export that looks complete.
    const tmp = `${out}.${process.pid}.tmp`;
    try {
      writeFileSync(tmp, body);
      renameSync(tmp, out);
    } catch (e) {
      try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* nothing else to do */ }
      return fail(`could not write ${out}: ${(e as Error).message}`);
    }
    return json({
      path: out, format: a.format, rows: rows.length, from: a.from, to: a.to,
      bytes: Buffer.byteLength(body),
      overwrote_existing_file: existed || undefined,
      note: existed ? `${out} already existed and was replaced.` : undefined,
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ---------------------------------------------------------------- accounts_list */

server.registerTool("accounts_list", {
  title: "List accounts",
  description: "List the imported accounts with their bank, currency, transaction count and date range.",
  inputSchema: {},
}, async () => {
  try {
    const db = load();
    const rows = db.accounts.map((acc) => {
      const ts = db.transactions.filter((t) => t.account === acc.name);
      const dates = ts.map((t) => t.date).sort();
      const currencies = [...new Set(ts.map((t) => t.currency))];
      const last = ts.length ? ts[ts.length - 1] : undefined;
      return {
        account: acc.name, bank: acc.bank, currencies,
        transactions: ts.length,
        from: dates[0] ?? null, to: dates[dates.length - 1] ?? null,
        balance: last && currencies.length === 1 && last.balance_minor !== undefined
          ? formatMoney(last.balance_minor, currencies[0]) : null,
      };
    });
    return json({
      count: rows.length, accounts: rows,
      free_limit: gate.isPro() ? null : FREE_ACCOUNTS,
      data_dir: dataDir(),
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

server.registerResource("current-month", "bank://month", {
  title: "This month's bank activity",
  description: "Money in, money out and the net for the current calendar month so far, grouped by category, per currency.",
  mimeType: "application/json",
}, async (uri) => ({
  contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(monthSummary(), null, 2) }],
}));

/* ------------------------------------------------------------------- prompts */

server.registerPrompt("monthly_review", {
  title: "Monthly bank review",
  description: "Review a month of bank activity: totals, uncategorised lines, recurring charges and anything the expense ledger has no receipt for.",
  argsSchema: { month: z.string().optional().describe("YYYY-MM, default the current month") },
}, ({ month }) => {
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : isoToday().slice(0, 7);
  const from = `${m}-01`;
  const to = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return {
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: [
          `Review the bank month ${m} (${from} to ${to}) with the bank statement tools and report it as one short summary:`,
          `1. statement_summary {from: "${from}", to: "${to}", group_by: "category"} and again with group_by "counterparty". Report money in, money out and the net per currency.`,
          `2. transactions_list {from: "${from}", to: "${to}", uncategorized: true} - name every line with no category and propose category_rules entries that would catch them next month.`,
          `3. recurring_detect {months: 6} - list the subscriptions, what each costs per year, and any that were charged twice this month.`,
          `4. reconcile_expenses {from: "${from}", to: "${to}"} - name the bank debits with no expense behind them, and the expenses that never reached the bank.`,
          `Do not add anything up across currencies.`,
        ].join("\n"),
      },
    }],
  };
});

gate.registerTools(server as unknown as { registerTool: Function });

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-bank-statement ready (${gate.isPro() ? "pro" : "free"}), data in ${dataDir()}\n`);
