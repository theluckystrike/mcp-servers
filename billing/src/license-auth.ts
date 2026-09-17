/**
 * license-auth.ts — token boundary for the hosted MCP worker (mcp-remote).
 *
 * Contract: a request carrying an MCPL1 key (Authorization: Bearer, path segment
 * /mcp/<server>/t/<token>, or ?token=) is allowed to reach tools/call only when the
 * key verifies offline against the fleet's Ed25519 public key, is for the requested
 * product (or the "*" bundle), and is not expired. Keys are minted by the billing
 * worker (billing/src/license.js, WebCrypto) and by scripts/sign-license.mjs
 * (node:crypto) — both sign the same payload shape, verified here.
 *
 * Workers-compatible: WebCrypto only, no node:crypto import, no zod. The public key
 * is injected so tests can use an ephemeral keypair and so the module never hardcodes
 * a secret. Run tsc --noEmit with the strict tsconfig in this directory to check it.
 */

export interface LicensePayload {
  v: 1;
  p: string;        // product id or "*" (bundle)
  id: string;       // license id
  iat: number;      // unix seconds
  exp?: number;     // unix seconds, absent = lifetime
  h?: string;       // sha256(email) prefix, optional
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  payload?: LicensePayload;
}

export interface AuthDecision {
  allow: boolean;
  isPro: boolean;
  reason: string;
  licenseId?: string;
}

/** A key may only appear in a tenant id in these characters (KV prefix safety, remote/src/index.ts). */
const TENANT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Import a raw 32-byte Ed25519 public key as a WebCrypto verify key. Cached per instance. */
class PublicKeyRing {
  private keyPromise: Promise<CryptoKey> | null = null;
  private readonly rawB64: string;
  constructor(rawB64: string) {
    this.rawB64 = rawB64;
  }
  verifyKey(): Promise<CryptoKey> {
    this.keyPromise ??= crypto.subtle.importKey(
      "raw", b64urlToBytes(this.rawB64), { name: "Ed25519" } as AlgorithmIdentifier, false, ["verify"],
    );
    return this.keyPromise;
  }
}

/** Pure payload checks, run AFTER the signature holds (fail closed on shape, review #19). */
export function payloadShapeError(p: unknown): string | null {
  if (typeof p !== "object" || p === null || Array.isArray(p)) return "bad payload";
  const q = p as Record<string, unknown>;
  if (q.v !== 1) return "unsupported version";
  if (typeof q.p !== "string" || q.p.length === 0) return "bad payload";
  if (typeof q.id !== "string" || q.id.length === 0 || !TENANT_ID_RE.test(q.id)) return "bad payload";
  if (typeof q.iat !== "number" || !Number.isSafeInteger(q.iat)) return "bad payload";
  if (q.exp !== undefined && !(typeof q.exp === "number" && Number.isSafeInteger(q.exp) && q.exp > 0)) return "bad payload";
  if (q.h !== undefined && (typeof q.h !== "string" || q.h.length === 0)) return "bad payload";
  return null;
}

export interface LicenseAuthOptions {
  /** Raw 32-byte Ed25519 public key, base64 (keys/license-public.raw.b64 in the repo). */
  publicKeyB64: string;
  /** Clock injection for tests; defaults to Date.now(). */
  now?: () => number;
}

export class LicenseAuth {
  private ring: PublicKeyRing;
  private now: () => number;

  constructor(options: LicenseAuthOptions) {
    this.ring = new PublicKeyRing(options.publicKeyB64);
    this.now = options.now ?? Date.now;
  }

  /** Verify "MCPL1.<payload>.<sig>" against the injected public key. Pure offline. */
  async verify(key: string, product: string): Promise<VerifyResult> {
    if (typeof key !== "string" || key.trim().length === 0) return { ok: false, reason: "no key" };
    const parts = key.trim().split(".");
    if (parts.length !== 3 || parts[0] !== "MCPL1") return { ok: false, reason: "malformed key" };
    const body = parts[1];
    const sigB64 = parts[2];
    if (body === undefined || sigB64 === undefined) return { ok: false, reason: "malformed key" };
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
    } catch {
      return { ok: false, reason: "bad payload" };
    }
    let sigOk = false;
    try {
      sigOk = await crypto.subtle.verify(
        { name: "Ed25519" } as AlgorithmIdentifier,
        await this.ring.verifyKey(),
        b64urlToBytes(sigB64),
        new TextEncoder().encode(body),
      );
    } catch {
      sigOk = false;
    }
    if (!sigOk) return { ok: false, reason: "signature invalid" };
    const shapeErr = payloadShapeError(payload);
    if (shapeErr) return { ok: false, reason: shapeErr };
    const p = payload as LicensePayload;
    if (product !== "*" && p.p !== "*" && p.p !== product) {
      return { ok: false, reason: `key is for ${p.p}, not ${product}` };
    }
    if (p.exp !== undefined && p.exp <= Math.floor(this.now() / 1000)) {
      return { ok: false, reason: "expired" };
    }
    return { ok: true, payload: p };
  }

  /**
   * Extract the presented key from a Request. Order: Authorization: Bearer wins,
   * then the /t/<token> path segment, then ?token=. Matches remote/src/index.ts.
   */
  extract(request: Request, url: URL): string | null {
    const auth = request.headers.get("authorization");
    if (auth && /^bearer\s+\S+/i.test(auth)) {
      const token = auth.replace(/^bearer\s+/i, "").trim();
      if (token.length > 0) return token;
    }
    const m = url.pathname.match(/\/t\/([A-Za-z0-9._-]+)$/);
    if (m) return m[1] ?? null;
    const q = url.searchParams.get("token");
    return q && q.length > 0 ? q : null;
  }

  /**
   * The gate the worker calls before dispatching tools/call. `product` is the server
   * name from the URL (e.g. "invoice"); "*" accepts any valid fleet key.
   */
  async gate(request: Request, url: URL, product: string): Promise<AuthDecision> {
    const key = this.extract(request, url);
    if (key === null) {
      return { allow: false, isPro: false, reason: "no token; mint one at https://mcp.zovo.one/mcp/connect" };
    }
    const v = await this.verify(key, product);
    if (!v.ok) return { allow: false, isPro: false, reason: v.reason ?? "rejected" };
    return { allow: true, isPro: true, reason: "license verified", ...(v.payload?.id !== undefined ? { licenseId: v.payload.id } : {}) };
  }
}
