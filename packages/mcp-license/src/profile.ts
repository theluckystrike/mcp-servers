import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * D-R31. One business profile for the whole suite.
 *
 * Round 8 measured the cost of not having this: a freelancer states "I am X in Warsaw,
 * VAT PL..., EUR, 23%, 14-day terms" once, and eleven servers each decide separately what
 * to do about it. invoice kept the VAT rate, docx had no letterhead, expense-tracker had no
 * default rate, time-tracker did not know the zone. This file is the single place that fact
 * lives; every server reads it first and falls back to its own local copy.
 *
 * Location: ${XDG_DATA_HOME:-~/.local/share}/mcp-servers/profile/business.json
 */
export interface SharedProfile {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  vat_id?: string;
  iban?: string;
  bank?: string;
  default_currency?: string;
  default_tax_rate?: number;
  payment_terms_days?: number;
  invoice_prefix?: string;
  timezone?: string;
  logo_path?: string;
  /** ISO timestamp of the last write. Informational only. */
  updated?: string;
}

export const PROFILE_FIELDS = [
  "name", "address", "email", "phone", "vat_id", "iban", "bank",
  "default_currency", "default_tax_rate", "payment_terms_days",
  "invoice_prefix", "timezone", "logo_path",
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

export function profileDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mcp-servers", "profile");
}

export function profilePath(): string { return join(profileDir(), "business.json"); }

function markerPath(): string { return `${profilePath()}.corrupt`; }

/**
 * Read the shared profile. Never throws: identity is read on paths that must still work
 * (rendering an invoice, stamping a timer), so a missing or unreadable file degrades to
 * "no profile" rather than taking a tool down. A file that is present but not JSON is
 * quarantined byte-for-byte as business.json.corrupt-<ts> with a marker beside it, so a
 * later writeSharedProfile cannot silently overwrite a profile that is still on disk.
 */
export function readSharedProfile(): SharedProfile {
  const p = profilePath();
  if (existsSync(markerPath())) return {};
  let raw: string;
  try {
    raw = readFileSync(p, "utf8");
  } catch {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return sanitize(parsed as Record<string, unknown>);
  } catch (e) {
    quarantine(p, (e as Error).message);
    return {};
  }
}

function quarantine(p: string, why: string): void {
  const moved = `${p}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  try {
    renameSync(p, moved);
    writeFileSync(markerPath(), JSON.stringify({
      quarantined: moved, at: new Date().toISOString(),
      hint: "the shared business profile failed to parse; it was moved, nothing was overwritten; restore it or delete this marker to start fresh",
    }) + "\n");
    process.stderr.write(`shared profile ${p} is not valid JSON (${why}); moved to ${moved}\n`);
  } catch { /* read path stays non-fatal */ }
}

/** Drop unknown keys and wrong-typed values rather than letting them reach a document. */
function sanitize(o: Record<string, unknown>): SharedProfile {
  const out: SharedProfile = {};
  for (const f of PROFILE_FIELDS) {
    const v = o[f];
    if (v === undefined || v === null) continue;
    if (f === "default_tax_rate" || f === "payment_terms_days") {
      if (typeof v === "number" && Number.isFinite(v)) (out as Record<string, unknown>)[f] = v;
    } else if (typeof v === "string" && v.trim() !== "") {
      (out as Record<string, unknown>)[f] = v;
    }
  }
  if (typeof o.updated === "string") out.updated = o.updated;
  return out;
}

/**
 * Merge `patch` into the shared profile and write it atomically (tmp + rename, per-process
 * temp name so two servers writing at once cannot clobber one another's temp file).
 * Keys whose value is undefined are ignored; an explicit null clears the field.
 * Returns the profile as it now stands on disk.
 */
export function writeSharedProfile(patch: Record<string, unknown>): SharedProfile {
  if (existsSync(markerPath())) {
    throw new Error(
      `the shared business profile is quarantined; restore ${profilePath()} then delete ${markerPath()} to continue`,
    );
  }
  const current = readSharedProfile();
  const next: Record<string, unknown> = { ...current };
  for (const f of PROFILE_FIELDS) {
    if (!(f in patch)) continue;
    const v = patch[f];
    if (v === undefined) continue;
    if (v === null || v === "") { delete next[f]; continue; }
    next[f] = v;
  }
  const clean = sanitize(next);
  clean.updated = new Date().toISOString();
  const dir = profileDir();
  mkdirSync(dir, { recursive: true });
  const p = profilePath();
  const tmp = `${p}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(clean, null, 2) + "\n");
    renameSync(tmp, p);
  } catch (e) {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* ignore */ }
    throw e;
  }
  return clean;
}

/** True when the shared profile carries a usable business name. */
export function hasSharedProfile(): boolean {
  return (readSharedProfile().name ?? "").trim() !== "";
}

/**
 * D-R40. An email is only ever the shared profile's or an explicit argument. When neither
 * exists a document prints this marker instead of an address a model improvised.
 */
export const EMAIL_PLACEHOLDER = "[add: email]";

export function resolveEmail(explicit?: string): { email: string; missing: boolean } {
  const given = (explicit ?? "").trim();
  if (given) return { email: given, missing: false };
  const stored = (readSharedProfile().email ?? "").trim();
  if (stored) return { email: stored, missing: false };
  return { email: EMAIL_PLACEHOLDER, missing: true };
}
