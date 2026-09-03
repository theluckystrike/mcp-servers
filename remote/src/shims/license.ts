/**
 * Request-scoped replacement for @theluckystrike/mcp-license. The bearer token is
 * verified once at the edge (worker index.ts), so the gate only reads the decision.
 * withFileLock is a no-op: a single request owns its virtual filesystem, and KV
 * writes are last-write-wins per tenant.
 */
import { z } from "zod";
import { ctx } from "./ctx.js";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "./fs.js";

export const CHECKOUT_BASE = "https://mcp.zovo.one";
export const PRICE_SINGLE_USD = 19;
export const PRICE_BUNDLE_USD = 39;
export const STALE_MS = 30_000;

/**
 * D-R31 on the remote endpoint. packages/mcp-license/src/profile.ts keeps one shared
 * business profile per machine, at a real path under XDG_DATA_HOME. There is no disk
 * here, so it lives at a fixed path in the per-request virtual filesystem instead:
 * /profile/business.json. The worker (see ServerCfg / hydrate / flush in index.ts)
 * hydrates that path from `${tenant}:profile` for every endpoint before the request
 * runs and flushes any write back to it afterward, so business_set on one endpoint
 * (say /mcp/invoice) is immediately visible to every other endpoint for the same
 * token - the same cross-server sharing the stdio profile gives for free from a
 * shared disk.
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

export function profileDir(): string { return "/profile"; }
export function profilePath(): string { return "/profile/business.json"; }

function markerPath(): string { return `${profilePath()}.corrupt`; }

function randHex(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
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

function quarantine(p: string, why: string): void {
  const moved = `${p}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  try {
    renameSync(p, moved);
    writeFileSync(markerPath(), JSON.stringify({
      quarantined: moved, at: new Date().toISOString(),
      hint: "the shared business profile failed to parse; it was moved, nothing was overwritten; restore it or delete this marker to start fresh",
    }) + "\n");
  } catch { /* read path stays non-fatal */ }
}

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

/**
 * Merge `patch` into the shared profile and write it atomically (tmp + rename, with a
 * random per-write temp name so two writes in the same request cannot clobber one
 * another's temp file). Keys whose value is undefined are ignored; an explicit null or
 * empty string clears the field. Returns the profile as it now stands.
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
  const tmp = `${p}.${randHex()}.tmp`;
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

export async function withFileLock<T>(_lockPath: string, fn: () => Promise<T> | T): Promise<T> {
  return await fn();
}

export interface LicenseGate {
  product: string;
  isPro(): boolean;
  status(): Record<string, unknown>;
  upgradeText(feature: string): string;
  registerTools(server: { registerTool: Function }): void;
}

export function createLicenseGate(opts: { product: string }): LicenseGate {
  const product = opts.product;
  const upgradeUrl = `${CHECKOUT_BASE}/buy/${product}`;
  const gate: LicenseGate = {
    product,
    isPro: () => ctx().isPro,
    status: () => ({
      product,
      tier: ctx().isPro ? "pro" : "free",
      transport: "remote streamable-http",
      tenant: ctx().tenant,
      source: "Authorization: Bearer",
      upgradeUrl,
    }),
    upgradeText: (feature: string) =>
      `"${feature}" is a Pro feature. Pro is a one-time $${PRICE_SINGLE_USD} (or $${PRICE_BUNDLE_USD} for every server, lifetime). ` +
      `Buy at ${upgradeUrl} , then send the key as "Authorization: Bearer <key>" to this endpoint.`,
    registerTools(server) {
      server.registerTool("license_status",
        { title: "License status", description: "Show whether this endpoint runs in free or Pro mode for your token, and where to upgrade.", inputSchema: {} },
        async () => ({ content: [{ type: "text", text: JSON.stringify(gate.status(), null, 2) }] }));
      server.registerTool("license_activate",
        { title: "Activate license", description: "On the remote endpoint a licence is not stored server-side: send the key in the Authorization header instead.", inputSchema: { key: z.string().describe("License key from checkout") } },
        async () => ({
          content: [{ type: "text", text:
            "On the remote endpoint keys are not stored. Reconnect with the header " +
            "\"Authorization: Bearer MCPL1....\" and this endpoint runs in Pro mode for that key." }],
        }));
    },
  };
  return gate;
}
