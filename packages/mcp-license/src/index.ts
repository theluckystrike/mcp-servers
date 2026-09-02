import { createPublicKey, verify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

// Raw 32-byte Ed25519 public key (base64). Private key never leaves the billing worker.
export const PUBLIC_KEY_B64 = "VZXpvTpJn2XzaEn9ijFXk1vjPjtZvzAHZazC0Z+0pHU=";
export const CHECKOUT_BASE = "https://mcp.zovo.one";
export const PRICE_SINGLE_USD = 19;
export const PRICE_BUNDLE_USD = 39;

export interface LicensePayload {
  v: 1;
  p: string;        // product id or "*" (bundle)
  id: string;       // license id
  iat: number;      // unix seconds
  exp?: number;     // unix seconds, absent = lifetime
  h?: string;       // sha256(email) prefix, optional
}

export interface VerifyResult { ok: boolean; reason?: string; payload?: LicensePayload }

const b64url = {
  dec(s: string): Buffer { return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"); },
  enc(b: Buffer): string { return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
};

function publicKey() {
  const raw = Buffer.from(PUBLIC_KEY_B64, "base64");
  const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
  return createPublicKey({ key: Buffer.concat([spkiPrefix, raw]), format: "der", type: "spki" });
}

/** Verify a key string "MCPL1.<payload>.<sig>" for a product. Pure offline. */
export function verifyLicense(key: string, product: string, now = Math.floor(Date.now() / 1000)): VerifyResult {
  if (typeof key !== "string") return { ok: false, reason: "no key" };
  const parts = key.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "MCPL1") return { ok: false, reason: "malformed key" };
  let payload: LicensePayload;
  try { payload = JSON.parse(b64url.dec(parts[1]).toString("utf8")); } catch { return { ok: false, reason: "bad payload" }; }
  let sigOk = false;
  try { sigOk = verify(null, Buffer.from(parts[1], "utf8"), publicKey(), b64url.dec(parts[2])); } catch { sigOk = false; }
  if (!sigOk) return { ok: false, reason: "signature invalid" };
  if (payload.v !== 1) return { ok: false, reason: "unsupported version" };
  if (payload.p !== "*" && payload.p !== product) return { ok: false, reason: `key is for ${payload.p}, not ${product}` };
  if (payload.exp && payload.exp < now) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}

function configPath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "mcp-servers", "license.json");
}

function readStoredKeys(): Record<string, string> {
  try { return JSON.parse(readFileSync(configPath(), "utf8")); } catch { return {}; }
}

function writeStoredKeys(keys: Record<string, string>) {
  const p = configPath();
  mkdirSync(join(p, ".."), { recursive: true });
  const tmp = p + ".tmp";
  writeFileSync(tmp, JSON.stringify(keys, null, 2));
  renameSync(tmp, p);
}

export interface LicenseGate {
  product: string;
  isPro(): boolean;
  status(): { product: string; tier: "free" | "pro"; licenseId?: string; expires?: string | null; source?: string; reason?: string; upgradeUrl: string };
  activate(key: string): VerifyResult & { savedTo?: string };
  upgradeText(feature: string): string;
  registerTools(server: { registerTool: Function }): void;
}

export function createLicenseGate(opts: { product: string }): LicenseGate {
  const product = opts.product;
  const upgradeUrl = `${CHECKOUT_BASE}/buy/${product}`;
  let cached: { ok: boolean; payload?: LicensePayload; source?: string; reason?: string } | null = null;

  function resolve() {
    if (cached) return cached;
    const env = process.env.MCP_LICENSE_KEY;
    if (env) { const r = verifyLicense(env, product); cached = { ...r, source: "env:MCP_LICENSE_KEY" }; if (r.ok) return cached; }
    const stored = readStoredKeys();
    for (const k of [product, "*"]) {
      if (stored[k]) { const r = verifyLicense(stored[k], product); if (r.ok) { cached = { ...r, source: configPath() }; return cached; } cached = { ...r, source: configPath() }; }
    }
    cached = cached ?? { ok: false, reason: "no license found" };
    return cached;
  }

  const gate: LicenseGate = {
    product,
    isPro: () => resolve().ok,
    status() {
      const r = resolve();
      return {
        product, tier: r.ok ? "pro" : "free", licenseId: r.payload?.id,
        expires: r.payload ? (r.payload.exp ? new Date(r.payload.exp * 1000).toISOString() : null) : undefined,
        source: r.source, reason: r.ok ? undefined : r.reason, upgradeUrl,
      };
    },
    activate(key: string) {
      const r = verifyLicense(key, product);
      if (!r.ok) return r;
      const stored = readStoredKeys();
      stored[r.payload!.p] = key.trim();
      writeStoredKeys(stored);
      cached = null;
      return { ...r, savedTo: configPath() };
    },
    upgradeText(feature: string) {
      return `"${feature}" is a Pro feature. Pro is a one-time $${PRICE_SINGLE_USD} (or $${PRICE_BUNDLE_USD} for every server, lifetime). ` +
        `Buy at ${upgradeUrl} , then run license_activate with the key shown after checkout. Keys verify offline; nothing is sent anywhere.`;
    },
    registerTools(server) {
      server.registerTool("license_status",
        { title: "License status", description: "Show whether this server runs in free or Pro mode and where to upgrade.", inputSchema: {} },
        async () => ({ content: [{ type: "text", text: JSON.stringify(gate.status(), null, 2) }] }));
      server.registerTool("license_activate",
        { title: "Activate license", description: "Activate a Pro license key (format MCPL1.xxx.yyy). Verified offline and saved locally.",
          inputSchema: { key: z.string().describe("License key from the checkout confirmation page") } },
        async ({ key }: { key: string }) => {
          const r = gate.activate(key);
          return r.ok
            ? { content: [{ type: "text", text: `Activated Pro for ${r.payload!.p === "*" ? "all servers (bundle)" : r.payload!.p}. Saved to ${r.savedTo}.` }] }
            : { content: [{ type: "text", text: `Error: license not accepted (${r.reason}).` }], isError: true };
        });
    },
  };
  return gate;
}
