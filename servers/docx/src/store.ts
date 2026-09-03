import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readSharedProfile, writeSharedProfile } from "@theluckystrike/mcp-license";

/**
 * Same shape as servers/invoice/src/store.ts. The two servers are meant to be
 * merged later, so the business profile is field-for-field identical; brand_color
 * is the only addition (letterhead colour, Pro) and it is optional.
 */
export interface Business {
  name: string;
  address?: string;
  email?: string;
  vat_id?: string;
  iban?: string;
  bank?: string;
  logo_path?: string;
  brand_color?: string;
  default_currency: string;
  default_tax_rate: number;
  payment_terms_days: number;
  invoice_prefix: string;
}

export type DocKind = "document" | "markdown" | "proposal" | "contract" | "template" | "html";

export interface DocRecord {
  id: string;
  kind: DocKind;
  title: string;
  client?: string;
  number?: string;
  path: string;
  created: string;
  /** The structured input a proposal or contract was built from, so it can be rewritten in place. */
  data?: unknown;
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "docx");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * A read or JSON.parse failure must never be reported as "empty database": the next
 * mutation would then overwrite a history that is still on disk. Only ENOENT means
 * empty. A parse failure quarantines the file byte-for-byte as <file>.corrupt-<ts>,
 * writes a marker so every later call keeps failing until a human resolves it, and throws.
 */
export class CorruptDataError extends Error {}

export function markerPath(file: string): string { return `${file}.corrupt`; }

function corruptStamp(): string { return new Date().toISOString().replace(/[:.]/g, "-"); }

function blocked(file: string, moved: string): CorruptDataError {
  return new CorruptDataError(
    `data file is corrupt; moved to ${moved}; nothing was written. ` +
    `Restore a good copy to ${file}, then delete ${markerPath(file)} to continue.`,
  );
}

export function readJsonFile<T>(file: string, empty: T): T {
  const marker = markerPath(file);
  if (existsSync(marker)) {
    let moved = `${file}.corrupt-*`;
    try {
      const t = readFileSync(marker, "utf8").trim();
      if (t) { try { const j = JSON.parse(t) as { quarantined?: unknown }; moved = typeof j.quarantined === "string" && j.quarantined ? j.quarantined : t; } catch { moved = t; } }
    } catch { /* marker unreadable */ }
    throw blocked(file, moved);
  }
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty;
    throw new CorruptDataError(`cannot read the data file ${file}: ${(e as Error).message}; nothing was written.`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    const moved = `${file}.corrupt-${corruptStamp()}`;
    try {
      renameSync(file, moved);
      writeFileSync(marker, JSON.stringify({ quarantined: moved, at: new Date().toISOString(), hint: "the original data file failed to parse; it was moved, nothing was overwritten; restore it manually or delete this marker to start fresh" }) + "\n");
    } catch { /* keep the parse error */ }
    process.stderr.write(`${file} is not valid JSON (${(e as Error).message}); moved to ${moved}\n`);
    throw blocked(file, moved);
  }
}

function readJson<T>(file: string, fallback: T): T {
  return readJsonFile<T>(join(dataDir(), file), fallback);
}

function writeJson(file: string, value: unknown): void {
  const p = join(dataDir(), file);
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
}

export const DEFAULT_BUSINESS: Business = {
  name: "", default_currency: "EUR", default_tax_rate: 0,
  payment_terms_days: 14, invoice_prefix: "INV",
};

/**
 * D-R31. Same rule as invoice: the shared profile is read first and wins field by field,
 * the local business.json stays as the compatibility copy. brand_color is docx-only and
 * therefore never leaves the local file.
 */
export function getBusiness(): Business {
  const local = readJson<Partial<Business>>("business.json", {});
  const shared = readSharedProfile();
  const fromShared: Partial<Business> = {};
  if (shared.name) fromShared.name = shared.name;
  if (shared.address) fromShared.address = shared.address;
  if (shared.email) fromShared.email = shared.email;
  if (shared.vat_id) fromShared.vat_id = shared.vat_id;
  if (shared.iban) fromShared.iban = shared.iban;
  if (shared.bank) fromShared.bank = shared.bank;
  if (shared.logo_path) fromShared.logo_path = shared.logo_path;
  if (shared.default_currency) fromShared.default_currency = shared.default_currency;
  if (typeof shared.default_tax_rate === "number") fromShared.default_tax_rate = shared.default_tax_rate;
  if (typeof shared.payment_terms_days === "number") fromShared.payment_terms_days = shared.payment_terms_days;
  if (shared.invoice_prefix) fromShared.invoice_prefix = shared.invoice_prefix;
  return { ...DEFAULT_BUSINESS, ...local, ...fromShared };
}

/** Writes the shared profile as well, so invoice, expense-tracker and recurring see it. */
export function setBusiness(b: Business): void {
  writeJson("business.json", b);
  const { brand_color: _ignored, ...shared } = b;
  writeSharedProfile(shared as unknown as Record<string, unknown>);
}

export function hasBusiness(): boolean {
  return existsSync(join(dataDir(), "business.json")) || !!readSharedProfile().name;
}

export function getDocs(): DocRecord[] { return readJson<DocRecord[]>("documents.json", []); }
export function setDocs(d: DocRecord[]): void { writeJson("documents.json", d); }

/** Rewrite one stored record in place, keyed by id. Returns false when the id is gone. */
export function updateDoc(id: string, patch: Partial<DocRecord>): boolean {
  const all = getDocs();
  const i = all.findIndex((d) => d.id === id);
  if (i < 0) return false;
  all[i] = { ...all[i], ...patch };
  setDocs(all);
  return true;
}

export function addDoc(rec: DocRecord): void {
  const all = getDocs();
  all.push(rec);
  setDocs(all);
}

/**
 * Allocate the next document reference: <prefix>-<YYYY>-<NNNN>. The counter is
 * written before the record is stored, so a crash burns a number rather than
 * reusing one, and existing numbers are scanned so a restored documents.json can
 * never hand back a reference that is already on a sent document.
 */
export function nextNumber(prefix: string, year: string): string {
  const counters = readJson<Record<string, number>>("counter.json", {});
  const key = `${prefix}-${year}`;
  let n = counters[key] ?? 0;
  const used = new Set(getDocs().map((d) => d.number).filter(Boolean) as string[]);
  do { n += 1; } while (used.has(`${key}-${String(n).padStart(4, "0")}`));
  counters[key] = n;
  writeJson("counter.json", counters);
  return `${key}-${String(n).padStart(4, "0")}`;
}

export function docsInMonth(month: string, kinds: DocKind[]): DocRecord[] {
  return getDocs().filter((d) => d.created.slice(0, 7) === month && kinds.includes(d.kind));
}
