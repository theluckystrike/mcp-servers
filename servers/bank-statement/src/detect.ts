/**
 * Reading a bank CSV export.
 *
 * The file itself is parsed by servers/spreadsheet's RFC 4180 reader and its locale-aware
 * number parser (imported from "@theluckystrike/mcp-spreadsheet/lib"), so "1 234,56" means
 * the same number here as it does in a spreadsheet. Everything in this module is about the
 * layer above that: which column is the date, which is the money, which way the money went.
 *
 * Three things every bank does differently and this module normalises once:
 *  1. Preamble. mBank and PKO print account details for several lines before the header
 *     row, so the header is searched for, never assumed to be row 0.
 *  2. Sign. Some exports use one signed amount column, some a debit and a credit column,
 *     some a positive amount plus a direction word. The sign is decided here and stored;
 *     nothing downstream ever guesses again.
 *  3. Date order. 03/04/2026 is ambiguous in isolation, so the order is inferred from the
 *     whole column (a day over 12 anywhere settles it) and the assumption is reported.
 */

import { parseCsv, parseNumberLoose } from "@theluckystrike/mcp-spreadsheet/lib";
import { currencyDecimals, isKnownCurrency, roundHalfUp } from "./money.js";

export type BankId = "auto" | "revolut" | "wise" | "mbank" | "pko" | "ing" | "n26" | "generic";

export const BANK_IDS: BankId[] = ["auto", "revolut", "wise", "mbank", "pko", "ing", "n26", "generic"];

/** Lowercase, strip diacritics and punctuation, collapse spaces. "#Data operacji" -> "data operacji". */
export function normHeader(s: string): string {
  return s
    .replace(/ł/g, "l").replace(/Ł/g, "L")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* --------------------------------------------------------------- header aliases */
/** Ordered most specific first: the first alias that matches exactly wins. */
const DATE = [
  "data operacji", "data transakcji", "data ksiegowania", "data waluty",
  "completed date", "date completed", "started date", "booking date", "value date",
  "transaction date", "posted date", "buchungstag", "date", "data", "datum",
];
const DESCRIPTION = [
  "opis operacji", "opis transakcji", "tytul operacji", "transaction details",
  "description", "payment reference", "verwendungszweck", "narrative", "details",
  "reference", "tytul", "opis", "memo",
];
const COUNTERPARTY = [
  "dane kontrahenta", "nadawca odbiorca", "partner name", "counterparty",
  "kontrahent", "beneficiary", "merchant", "payee", "odbiorca",
];
const AMOUNT = [
  "kwota transakcji waluta rachunku", "kwota operacji", "kwota transakcji",
  "transaction amount", "amount", "kwota", "betrag", "bedrag",
];
const DEBIT = ["money out", "paid out", "obciazenia", "obciazenie", "withdrawal", "wyplata", "debit", "soll"];
const CREDIT = ["money in", "paid in", "uznania", "uznanie", "deposit", "wplata", "credit", "haben"];
const CURRENCY = ["waluta rachunku", "currency", "waluta", "ccy", "wahrung"];
const BALANCE = ["saldo po operacji", "saldo po transakcji", "running balance", "balance after", "kontostand", "balance", "saldo"];
const DIRECTION = ["typ transakcji", "transaction type", "direction", "type", "typ"];
const STATE = ["state", "status"];

/** A transaction that never happened must not land in the ledger. */
const DEAD_STATES = new Set(["reverted", "declined", "failed", "cancelled", "canceled", "rejected", "odrzucona"]);

const DEBIT_WORDS = [
  "debit", "out", "outgoing", "withdraw", "payment", "obciazenie", "wyplata", "przelew wychodzacy", "wydatek", "dr",
];
const CREDIT_WORDS = [
  "credit", "in", "incoming", "deposit", "uznanie", "wplata", "przelew przychodzacy", "wplyw", "cr",
];

/** Exact alias match first over the whole header row, then a contains pass. */
function findColumn(headers: string[], aliases: string[]): number {
  for (const a of aliases) {
    const i = headers.indexOf(a);
    if (i >= 0) return i;
  }
  for (const a of aliases) {
    const i = headers.findIndex((h) => h === `${a}` || h.startsWith(`${a} `) || h.endsWith(` ${a}`) || h.includes(a));
    if (i >= 0) return i;
  }
  return -1;
}

/* -------------------------------------------------------------------- profiles */

interface Profile {
  id: Exclude<BankId, "auto" | "generic">;
  label: string;
  /** Every one of these normalised headers must be present for the profile to claim the file. */
  signature: string[];
  dateOrder?: "dmy" | "mdy" | "ymd";
}

const PROFILES: Profile[] = [
  { id: "revolut", label: "Revolut", signature: ["completed date", "description"], dateOrder: "ymd" },
  { id: "wise", label: "Wise", signature: ["running balance", "payment reference"], dateOrder: "dmy" },
  { id: "mbank", label: "mBank", signature: ["data operacji", "opis operacji"], dateOrder: "ymd" },
  { id: "pko", label: "PKO BP", signature: ["data waluty", "typ transakcji"], dateOrder: "ymd" },
  { id: "ing", label: "ING", signature: ["data transakcji", "dane kontrahenta"], dateOrder: "ymd" },
  { id: "n26", label: "N26", signature: ["booking date", "partner name"], dateOrder: "ymd" },
];

function matchProfile(headers: string[]): Profile | undefined {
  const has = (a: string) => headers.some((h) => h === a || h.includes(a));
  // Wise also ships an export whose first column literally names the product.
  if (headers.some((h) => h.includes("wise"))) return PROFILES[1];
  return PROFILES.find((p) => p.signature.every(has));
}

/* ----------------------------------------------------------------- date parsing */

export type DateOrder = "dmy" | "mdy" | "ymd";

interface DateParts { a: number; b: number; c: number; iso: boolean }

function dateParts(raw: string): DateParts | null {
  const s = raw.trim().split(/[ T]/)[0];
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return { a: +m[1], b: +m[2], c: +m[3], iso: true };
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return { a: +m[1], b: +m[2], c: y, iso: false };
  }
  return null;
}

/**
 * The order is a property of the COLUMN, not of a cell: a day above 12 anywhere in the
 * column proves day-first, a month-position value above 12 proves month-first. With no
 * evidence either way the hint is used, and the caller reports the assumption rather than
 * silently booking March as April.
 */
export function inferDateOrder(cells: string[], hint: DateOrder = "dmy"): { order: DateOrder; inferred: boolean } {
  let dayFirst = false, monthFirst = false;
  for (const c of cells) {
    const p = dateParts(c);
    if (!p || p.iso) continue;
    if (p.a > 12) dayFirst = true;
    if (p.b > 12) monthFirst = true;
  }
  if (dayFirst && !monthFirst) return { order: "dmy", inferred: true };
  if (monthFirst && !dayFirst) return { order: "mdy", inferred: true };
  return { order: hint === "ymd" ? "dmy" : hint, inferred: false };
}

function pad(n: number): string { return String(n).padStart(2, "0"); }

export function parseDateCell(raw: string, order: DateOrder): string | null {
  const p = dateParts(raw);
  if (!p) return null;
  let y: number, mo: number, d: number;
  if (p.iso) { y = p.a; mo = p.b; d = p.c; }
  else if (order === "mdy") { mo = p.a; d = p.b; y = p.c; }
  else { d = p.a; mo = p.b; y = p.c; }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${pad(mo)}-${pad(d)}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

/* ------------------------------------------------------------------ the reader */

export interface ParsedRow {
  date: string;
  description: string;
  counterparty?: string;
  amount_minor: number;
  currency: string;
  balance_minor?: number;
  /** Index of the source line in the file, 1-based, for error messages. */
  line: number;
}

export interface ColumnReport {
  date: string;
  description: string;
  amount: string | null;
  debit: string | null;
  credit: string | null;
  currency: string | null;
  balance: string | null;
  counterparty: string | null;
}

export interface ParsedStatement {
  bank: string;
  delimiter: string;
  header_line: number;
  columns: ColumnReport;
  date_order: DateOrder;
  date_order_inferred: boolean;
  rows: ParsedRow[];
  skipped: { line: number; reason: string }[];
  notes: string[];
}

export class StatementError extends Error {}

/** Longest description kept; a bank memo is never a novel and the store echoes it back. */
const MAX_DESC = 300;

/** ISO code sitting inside a money cell: "-1 234,56 PLN", "PLN 1 234,56", "EUR12.30". */
function currencyInCell(cell: string): string | undefined {
  const m = /(?:^|[^A-Za-z])([A-Za-z]{3})(?:[^A-Za-z]|$)/.exec(cell.trim());
  if (m && isKnownCurrency(m[1])) return m[1].toUpperCase();
  return undefined;
}

/** "Amount (EUR)" / "Kwota (PLN)" names the currency in the header itself. */
function currencyInHeader(header: string): string | undefined {
  const m = /\b([a-z]{3})\b\s*$/.exec(header);
  if (m && isKnownCurrency(m[1])) return m[1].toUpperCase();
  return undefined;
}

/**
 * Whole-word match. A substring test would read "in" out of "Zakupy internetowe" and book
 * a card payment as income, so a single-word marker has to be its own token.
 */
function matchWord(s: string, w: string): boolean {
  if (s === w) return true;
  if (w.includes(" ")) return s.includes(w);
  return s.split(" ").includes(w);
}

function direction(cell: string): 1 | -1 | 0 {
  const s = normHeader(cell);
  if (!s) return 0;
  for (const w of DEBIT_WORDS) if (matchWord(s, w)) return -1;
  for (const w of CREDIT_WORDS) if (matchWord(s, w)) return 1;
  return 0;
}

/**
 * Strip the noise a card network staples onto a merchant name so "CARD PAYMENT TO SPOTIFY
 * AB 12345678" and "Spotify AB" collapse to the same counterparty.
 */
export function counterpartyOf(description: string, explicit?: string): string {
  const src = (explicit && explicit.trim()) || description;
  let s = src.trim()
    .replace(/^(card payment (to|from)|payment (to|from)|direct debit|standing order|transfer (to|from)|przelew( wychodzacy| przychodzacy)?|zakup przy uzyciu karty|platnosc karta)\s+/i, "")
    .replace(/\s{2,}/g, " ");
  // cut at a long reference number, a date, or an IBAN-looking token
  s = s.split(/\s(?=(?:\d[\d\s-]{5,})|(?:[A-Z]{2}\d{2}[A-Z0-9]{10,}))/)[0];
  s = s.replace(/[\s,;.*/-]+$/, "").trim();
  return (s || src.trim()).slice(0, 120);
}

/** A stable key for grouping the same payee across months: lowercase, digits removed. */
export function counterpartyKey(s: string): string {
  return normHeader(s).replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
}

export interface ReadOpts {
  bank?: BankId;
  /** Currency to use when the file names none anywhere. */
  fallbackCurrency?: string;
}

/**
 * A trailing minus ("12,50-", "1 234.56 EUR-") is how several German, Polish and SAP-derived
 * exports write a debit. parseNumberLoose strips a trailing non-digit run before parsing, so
 * that sign was silently dropped and the debit was stored as income. The sign is taken off the
 * cell here, before the number is parsed, and applied to the result.
 */
function parseMoneyCell(cell: unknown): number | null {
  const s = String(cell ?? "").trim();
  const trailing = /^(?=.*\d)(.*\S)\s*-$/.exec(s);
  if (trailing && !/^\s*-/.test(s)) {
    const n = parseNumberLoose(trailing[1]);
    return n === null ? null : -Math.abs(n);
  }
  return parseNumberLoose(s);
}

export function readStatement(text: string, opts: ReadOpts = {}): ParsedStatement {
  const parsed = parseCsv(text);
  // Blank rows are kept in place, never filtered out: header_line and every skipped-line
  // number have to point at the line a human sees when they open the file.
  const grid = parsed.rows;
  if (!grid.some((r) => r.some((c) => c.trim() !== ""))) throw new StatementError("the file has no rows. An empty export is not an error to fix here, but there is nothing to import.");

  // 1. Find the header row. Banks print account details above it, so scan the first rows
  //    and take the first that names a date column and some kind of money column.
  let headerIdx = -1, headers: string[] = [];
  const limit = Math.min(grid.length, 25);
  for (let i = 0; i < limit; i++) {
    const h = grid[i].map(normHeader);
    if (findColumn(h, DATE) < 0) continue;
    if (findColumn(h, AMOUNT) < 0 && (findColumn(h, DEBIT) < 0 || findColumn(h, CREDIT) < 0)) continue;
    headerIdx = i; headers = h; break;
  }
  if (headerIdx < 0) {
    const first = grid[0].map((c) => c.trim()).filter(Boolean).slice(0, 12).join(", ");
    throw new StatementError(
      "no header row was found in the first 25 lines: a bank export needs a date column and either an amount column or a debit and a credit column. " +
      `The first line reads: ${first || "(blank)"}. Pass bank: "generic" after renaming the headers, or check that this is the CSV export and not a PDF converted by hand.`,
    );
  }

  const wanted = opts.bank && opts.bank !== "auto" && opts.bank !== "generic"
    ? PROFILES.find((p) => p.id === opts.bank)
    : undefined;
  const detected = matchProfile(headers);
  const profile = wanted ?? (opts.bank === "generic" ? undefined : detected);
  const notes: string[] = [];
  if (wanted && detected && detected.id !== wanted.id) {
    notes.push(`bank was given as "${wanted.id}" but the headers look like ${detected.label}; the given profile was used.`);
  }

  const raw = grid[headerIdx];
  const nameOf = (i: number) => (i < 0 ? null : (raw[i] ?? "").trim() || headers[i]);

  const iDate = findColumn(headers, DATE);
  const iDesc = findColumn(headers, DESCRIPTION);
  const iCp = findColumn(headers, COUNTERPARTY);
  const iAmount = findColumn(headers, AMOUNT);
  const iDebit = findColumn(headers, DEBIT);
  const iCredit = findColumn(headers, CREDIT);
  const iCur = findColumn(headers, CURRENCY);
  const iBal = findColumn(headers, BALANCE);
  const iDir = findColumn(headers, DIRECTION);
  const iState = findColumn(headers, STATE);

  const useDebitCredit = iAmount < 0 && iDebit >= 0 && iCredit >= 0;
  if (iDesc < 0 && iCp < 0) {
    throw new StatementError(
      `the header row (line ${headerIdx + 1}) has no description or counterparty column, so every transaction would be nameless. ` +
      "Rename the column that holds the payee or the memo to \"description\" and import again.",
    );
  }

  const body = grid.slice(headerIdx + 1);
  const dateCells = body.map((r) => (r[iDate] ?? ""));
  const { order, inferred } = inferDateOrder(dateCells, profile?.dateOrder ?? "dmy");
  if (!inferred && dateCells.some((c) => dateParts(c) && !dateParts(c)!.iso)) {
    notes.push(`the date column is ambiguous (no value above 12 in either position), so it was read as ${order === "dmy" ? "day/month/year" : "month/day/year"}${profile ? ` from the ${profile.label} profile` : ""}. Re-import with the right bank profile if that is wrong.`);
  }

  const headerCurrency = iAmount >= 0 ? currencyInHeader(headers[iAmount]) : undefined;
  const fallback = (opts.fallbackCurrency ?? "").toUpperCase();
  const rows: ParsedRow[] = [];
  const skipped: { line: number; reason: string }[] = [];
  let sawNegative = false, sawPositive = false;
  const pending: { row: ParsedRow; signed: boolean }[] = [];
  let usedFallback = false;

  for (let r = 0; r < body.length; r++) {
    const cells = body[r];
    const line = headerIdx + 2 + r;   // 1-based, header included
    if (!cells.some((c) => c.trim() !== "")) continue;   // a blank line is not a skipped transaction
    const dateRaw = (cells[iDate] ?? "").trim();
    if (!dateRaw) { skipped.push({ line, reason: "no date" }); continue; }
    const date = parseDateCell(dateRaw, order);
    if (!date) { skipped.push({ line, reason: `"${dateRaw.slice(0, 40)}" is not a date` }); continue; }

    if (iState >= 0) {
      const st = normHeader(cells[iState] ?? "");
      if (DEAD_STATES.has(st)) { skipped.push({ line, reason: `state "${(cells[iState] ?? "").trim()}"` }); continue; }
    }

    let major: number | null = null;
    let signed = false;
    let moneyCell = "";
    if (useDebitCredit) {
      const d = parseMoneyCell(cells[iDebit] ?? "");
      const c = parseMoneyCell(cells[iCredit] ?? "");
      if (d === null && c === null) { skipped.push({ line, reason: "no amount in the debit or credit column" }); continue; }
      major = (c === null ? 0 : Math.abs(c)) - (d === null ? 0 : Math.abs(d));
      signed = true;
      moneyCell = `${cells[iDebit] ?? ""} ${cells[iCredit] ?? ""}`;
    } else {
      moneyCell = cells[iAmount] ?? "";
      major = parseMoneyCell(moneyCell);
      if (major === null) { skipped.push({ line, reason: `"${String(moneyCell).slice(0, 40)}" is not an amount` }); continue; }
    }
    if (!Number.isFinite(major)) { skipped.push({ line, reason: "amount is not a finite number" }); continue; }

    const currency =
      (iCur >= 0 ? (isKnownCurrency((cells[iCur] ?? "").trim()) ? (cells[iCur] ?? "").trim().toUpperCase() : undefined) : undefined)
      ?? currencyInCell(moneyCell) ?? headerCurrency ?? (fallback && isKnownCurrency(fallback) ? fallback : undefined) ?? "EUR";
    if (currency === "EUR" && iCur < 0 && !headerCurrency && !currencyInCell(moneyCell) && !fallback) usedFallback = true;

    const minor = roundHalfUp(major * Math.pow(10, currencyDecimals(currency)));
    if (!Number.isSafeInteger(minor)) { skipped.push({ line, reason: "amount too large to represent exactly" }); continue; }
    if (minor < 0) sawNegative = true;
    if (minor > 0) sawPositive = true;

    const descParts: string[] = [];
    if (iDesc >= 0 && (cells[iDesc] ?? "").trim()) descParts.push((cells[iDesc] ?? "").trim());
    if (iCp >= 0 && (cells[iCp] ?? "").trim() && !descParts.includes((cells[iCp] ?? "").trim())) descParts.unshift((cells[iCp] ?? "").trim());
    const description = (descParts.join(" - ") || "(no description)").replace(/\s+/g, " ").slice(0, MAX_DESC);

    let balance_minor: number | undefined;
    if (iBal >= 0) {
      const b = parseMoneyCell(cells[iBal] ?? "");
      if (b !== null && Number.isFinite(b)) {
        const bm = roundHalfUp(b * Math.pow(10, currencyDecimals(currency)));
        if (Number.isSafeInteger(bm)) balance_minor = bm;
      }
    }

    const row: ParsedRow = {
      date, description,
      counterparty: counterpartyOf(description, iCp >= 0 ? cells[iCp] : undefined),
      amount_minor: minor, currency, balance_minor, line,
    };
    // the direction word is only consulted below, once the whole column is known
    if (iDir >= 0 && !signed) (row as ParsedRow & { dir?: number }).dir = direction(cells[iDir] ?? "");
    pending.push({ row, signed });
  }

  /**
   * Sign, decided once for the file. An amount column that already carries both signs is
   * trusted. A column that is entirely non-negative with a direction column beside it is
   * signed from that column: this is how PKO and several card exports ship. A column that
   * is entirely non-negative with nothing to sign it by is left alone and reported, because
   * inventing a sign would flip a year of income into spending.
   */
  const allNonNegative = !sawNegative && sawPositive;
  if (allNonNegative && iDir >= 0 && !useDebitCredit) {
    let flipped = 0;
    for (const p of pending) {
      const d = (p.row as ParsedRow & { dir?: number }).dir;
      if (d === -1) { p.row.amount_minor = -p.row.amount_minor; flipped++; }
    }
    notes.push(`every amount in this file is positive, so the direction was taken from the "${nameOf(iDir)}" column: ${flipped} row(s) became debits.`);
  } else if (allNonNegative && !useDebitCredit && pending.length > 1) {
    notes.push("every amount in this file is positive and there is no debit/credit or direction column, so every line was stored as money IN. If this export writes debits without a minus sign, re-import with the right bank profile.");
  }
  for (const p of pending) { delete (p.row as ParsedRow & { dir?: number }).dir; rows.push(p.row); }

  if (usedFallback) notes.push("the file names no currency, so EUR was assumed. Pass the account's currency on the account if that is wrong.");

  return {
    bank: profile?.label ?? "generic",
    delimiter: parsed.delimiter,
    header_line: headerIdx + 1,
    columns: {
      date: nameOf(iDate) ?? "", description: nameOf(iDesc) ?? nameOf(iCp) ?? "",
      amount: useDebitCredit ? null : nameOf(iAmount), debit: useDebitCredit ? nameOf(iDebit) : null,
      credit: useDebitCredit ? nameOf(iCredit) : null, currency: nameOf(iCur),
      balance: nameOf(iBal), counterparty: nameOf(iCp),
    },
    date_order: order, date_order_inferred: inferred,
    rows, skipped, notes,
  };
}
