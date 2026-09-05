import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getInvoices, type Invoice } from "@theluckystrike/mcp-invoice/lib";
import { getCreditNotes, getPurchaseOrders, type CreditNote, type PurchaseOrder } from "@theluckystrike/mcp-billing-docs/lib";
import { getDeposits, type Deposit } from "@theluckystrike/mcp-deposits/lib";
import { getAssets, type Asset } from "@theluckystrike/mcp-asset-register/lib";

/**
 * The six sibling stores, read READ-ONLY and BEST EFFORT.
 *
 * A cash book is not a place money is entered. It is the one place the money already
 * entered elsewhere is stated twice, once as a debit and once as a credit. Two rules
 * follow and both are load-bearing:
 *
 * 1. Nothing here writes. Not a payment, not a status, not a counter, not into any of the
 *    six stores below. A ledger that also wrote would be posting entries against itself.
 *
 * 2. A sibling store that is missing or empty is reported, never fatal: the common case on
 *    a real machine is a user who invoices and has never installed the deposit server, and
 *    their ledger is correct, it simply has no deposit line. A store that is on disk and
 *    did NOT parse is a different thing: money exists that could not be read, so the
 *    failure is carried into every answer as a named source error. An unreadable store is
 *    never read as an empty one, because that turns a figure that could not be computed
 *    into a figure of zero, and a zero in a ledger balances perfectly while being wrong.
 *
 * There is no fatal store here, not even the invoice ledger: a business with only bank
 * imports and expenses still has a cash book. What a missing store costs is stated on the
 * answer instead, per store and in words.
 *
 * Four of the six publish a `./lib` entry point and are read through it. `expense-tracker`
 * and `bank-statement` publish none (their `exports` map has only `.`), so their
 * `data.json` is read from the shared XDG data root by path, parsed defensively and NEVER
 * written, which is exactly what those two servers already do to each other in
 * `readBankTransactions` and `readExpenses`.
 */

/** The expense record shape servers/expense-tracker/src/store.ts declares, as far as it is used here. */
export interface ExpenseRow {
  id: string;
  date: string;
  /** Gross, POSITIVE, in minor units. VAT-inclusive when `vat_rate` is set. */
  amount_minor: number;
  currency: string;
  category?: string;
  merchant?: string;
  /** Percent. Absent means the amount carries no VAT split at all. */
  vat_rate?: number;
}

/** The transaction shape servers/bank-statement/src/store.ts declares, as far as it is used here. */
export interface BankRow {
  id: string;
  account: string;
  date: string;
  description: string;
  /** SIGNED minor units: a debit (money out) is negative, a credit (money in) positive. */
  amount_minor: number;
  currency: string;
  counterparty?: string;
  category?: string;
}

export interface Source<T> {
  rows: T[];
  error?: string;
  ok: boolean;
}

export interface SourceSet {
  invoices: Source<Invoice>;
  credit_notes: Source<CreditNote>;
  purchase_orders: Source<PurchaseOrder>;
  deposits: Source<Deposit>;
  expenses: Source<ExpenseRow>;
  bank: Source<BankRow>;
  assets: Source<Asset>;
}

function attempt<T>(read: () => T[]): Source<T> {
  try {
    return { rows: read(), ok: true };
  } catch (e) {
    return { rows: [], ok: false, error: (e as Error).message };
  }
}

function xdgFile(server: string, file: string): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mcp-servers", server, file);
}

/**
 * Read one of the two stores that publish no library. The file is opened, parsed and
 * closed; on a parse failure the error is returned and the file is left exactly as it is.
 * Quarantining another server's data file would be a write into a store this server
 * promised not to touch.
 */
function readForeign<T>(server: string, key: "expenses" | "transactions", keep: (r: T) => boolean): Source<T> {
  const file = xdgFile(server, "data.json");
  if (!existsSync(file)) return { rows: [], ok: true };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch (e) {
    return { rows: [], ok: false, error: `${file} did not parse (${(e as Error).message}); it was left untouched` };
  }
  const raw = parsed[key];
  if (!Array.isArray(raw)) {
    return { rows: [], ok: false, error: `${file} carries no ${key} array; it was left untouched` };
  }
  return { rows: (raw as T[]).filter((r) => r && typeof r === "object" && keep(r)), ok: true };
}

export function readSources(): SourceSet {
  return {
    invoices: attempt(getInvoices),
    credit_notes: attempt(getCreditNotes),
    purchase_orders: attempt(getPurchaseOrders),
    deposits: attempt(getDeposits),
    assets: attempt(getAssets),
    expenses: readForeign<ExpenseRow>("expense-tracker", "expenses",
      (r) => typeof r.date === "string" && typeof r.amount_minor === "number" && typeof r.currency === "string"),
    bank: readForeign<BankRow>("bank-statement", "transactions",
      (r) => typeof r.date === "string" && typeof r.amount_minor === "number" && typeof r.currency === "string"),
  };
}

/** One line per store, for the `sources` block every answer carries. */
export function sourceReport(s: SourceSet): Array<{ store: string; read: boolean; rows: number; error?: string }> {
  return [
    { store: "invoice", read: s.invoices.ok, rows: s.invoices.rows.length, error: s.invoices.error },
    { store: "billing-docs credit notes", read: s.credit_notes.ok, rows: s.credit_notes.rows.length, error: s.credit_notes.error },
    { store: "billing-docs purchase orders", read: s.purchase_orders.ok, rows: s.purchase_orders.rows.length, error: s.purchase_orders.error },
    { store: "deposits", read: s.deposits.ok, rows: s.deposits.rows.length, error: s.deposits.error },
    { store: "expense-tracker", read: s.expenses.ok, rows: s.expenses.rows.length, error: s.expenses.error },
    { store: "bank-statement", read: s.bank.ok, rows: s.bank.rows.length, error: s.bank.error },
    { store: "asset-register", read: s.assets.ok, rows: s.assets.rows.length, error: s.assets.error },
  ];
}

/**
 * What an unreadable store costs, named store by store and account by account. A ledger
 * short one store is not wrong by a rounding error, it is wrong by everything that store
 * held, and it still balances, because both legs of the missing entry are missing.
 */
export function degradedNotes(s: SourceSet): string[] {
  const out: string[] = [];
  if (!s.invoices.ok) {
    out.push(`The invoice ledger could not be read (${s.invoices.error}). Revenue, receivables, VAT output and every ` +
      `payment received are therefore MISSING from this ledger. It still balances, because both legs are missing.`);
  }
  if (!s.credit_notes.ok) {
    out.push(`The credit note store could not be read (${s.credit_notes.error}). Revenue and VAT output are too high by ` +
      `whatever was credited, and receivables with them.`);
  }
  if (!s.purchase_orders.ok) {
    out.push(`The purchase order store could not be read (${s.purchase_orders.error}). Purchase commitments are a memo and ` +
      `are never posted, so no balance moves; the memo is simply absent.`);
  }
  if (!s.deposits.ok) {
    out.push(`The deposit store could not be read (${s.deposits.error}). Deposits held is missing, and a payment made by ` +
      `applying a deposit is posted against cash instead of against the deposit liability, because the invoice alone cannot say where it came from.`);
  }
  if (!s.expenses.ok) {
    out.push(`The expense ledger could not be read (${s.expenses.error}). Expenses by category and VAT input are MISSING, ` +
      `and every bank debit is therefore unexplained rather than matched.`);
  }
  if (!s.bank.ok) {
    out.push(`The bank import could not be read (${s.bank.error}). No cash line is posted from it in any case; what is lost ` +
      `is the reconciliation, so month_close cannot say which posted cash movement has bank evidence behind it.`);
  }
  if (!s.assets.ok) {
    out.push(`The fixed asset register could not be read (${s.assets.error}). Fixed assets, accumulated depreciation and the ` +
      `depreciation charge are MISSING from this ledger.`);
  }
  return out;
}
