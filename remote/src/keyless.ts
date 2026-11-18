/**
 * KEYLESS FREE TIER (s1117).
 *
 * Measured 2026-11-14 to 11-16: a real Claude-User connector called
 * https://mcp.zovo.one/mcp/price-tracker 105 times with no credential and every tools/call
 * answered 401. In nine days nothing from Claude's network fetched a discovery document or
 * an /oauth path, so that connector is not running OAuth at all and no header can reach it.
 * A client that cannot run OAuth and cannot set a header still has to get something.
 *
 * So a POST tools/call that carries no credential at all (no Authorization header, no
 * /t/<token> path, no ?token=) now runs on the free tier with these limits:
 *
 *  - Nothing is saved. A keyless call is hydrated from an empty document and never flushed.
 *    It cannot be per-user: Claude's connectors call from a shared pool of addresses, so a
 *    document keyed on the client IP would hand one person's price watches or timesheet to
 *    a stranger. Calls that record data still run (the answer is real), and the result says
 *    plainly that what was recorded is gone and how to keep it.
 *  - Nothing Pro is reachable: isPro is false and there is no token to bind a purchase to.
 *    A Pro refusal names /mcp/connect and /buy/<product>.
 *  - A per-day cap per client IP, counted in isolate memory and added to KV once every
 *    KEYLESS_FLUSH_EVERY calls, never once per request (a sparse caller never writes at all).
 *    Over the cap the call gets a normal tool result naming the free token and Pro.
 *  - No hourly token counter, no funnel record, no last-seen stamp: none of those has a
 *    token to hang on, and each would be a KV or Durable Object write per call.
 *
 * Everything that carries a credential is untouched: a header, path or query token, valid
 * or not, takes exactly the path it took before. The clean /v1 path keeps its 401.
 */

export const KEYLESS_DAILY_CAP = 300;
export const KEYLESS_FLUSH_EVERY = 25;
const KEYLESS_MAP_MAX = 5000;
const DAY_MS = 86_400_000;
const HOST = "https://mcp.zovo.one";

/** Only a tools/call with an id, on the plain path, with no credential in any form. */
export function isKeylessToolCall(httpMethod: string, rpcMethod: string | null, hasId: boolean, hasCredential: boolean, clean: boolean): boolean {
  return httpMethod === "POST" && !hasCredential && !clean && rpcMethod === "tools/call" && hasId;
}

/**
 * The WWW-Authenticate value for a request that carried no credential at all. RFC 6750
 * section 3.1: "If the request lacks any authentication information ... the resource server
 * SHOULD NOT include an error code". The metadata URL is the path-scoped RFC 9728 one for the
 * endpoint that was called, the same URL the initialize challenge already names.
 */
export function noCredentialChallenge(product: string): string {
  const meta = product === "*"
    ? `${HOST}/.well-known/oauth-protected-resource`
    : `${HOST}/.well-known/oauth-protected-resource/mcp/${product}`;
  return `Bearer realm="mcp.zovo.one", resource_metadata="${meta}"`;
}

interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface Slot { seen: number; pending: number; at: number }

export interface KeylessDecision { ok: boolean; used: number; cap: number; resetsAt: string }

async function ipKey(ip: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`keyless\n${ip}`)));
  return [...d.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Per-isolate counter for the keyless cap. The first call this isolate sees for an
 * address and day reads the KV counter once (other isolates' batches); after that the
 * count lives here, and every KEYLESS_FLUSH_EVERY calls the pending calls are added to KV
 * in one write. There is deliberately no time-based flush: with one call every few
 * minutes that would be a write per call. Pending calls an evicted isolate never wrote are
 * lost, which only makes the cap approximate in the caller's favour, like the hourly
 * counter. The KV key carries a hash of the address, never the address itself. KV failures
 * fall back to memory: the cap still holds per isolate.
 */
export function createKeylessCounter(cap = KEYLESS_DAILY_CAP, flushEvery = KEYLESS_FLUSH_EVERY) {
  const slots = new Map<string, Slot>();
  return {
    slots,
    async allow(kv: KvLike, waitUntil: (p: Promise<unknown>) => void, ip: string, now = Date.now()): Promise<KeylessDecision> {
      const day = Math.floor(now / DAY_MS);
      const resetsAt = new Date((day + 1) * DAY_MS).toISOString();
      const memKey = `${ip}:${day}`;
      if (slots.size >= KEYLESS_MAP_MAX) {
        for (const k of slots.keys()) if (!k.endsWith(`:${day}`)) slots.delete(k);
        if (slots.size >= KEYLESS_MAP_MAX) slots.clear();
      }
      const kvKey = `kl:${await ipKey(ip)}:${day}`;
      let slot = slots.get(memKey);
      if (!slot) {
        let seen = 0;
        try { seen = Number(await kv.get(kvKey)) || 0; } catch { seen = 0; }
        slot = { seen, pending: 0, at: now };
        slots.set(memKey, slot);
      }
      const n = slot.seen + slot.pending + 1;
      if (n > cap) return { ok: false, used: slot.seen + slot.pending, cap, resetsAt };
      slot.pending += 1;
      if (slot.pending >= flushEvery) {
        const s = slot;
        const add = s.pending;
        s.pending = 0;
        s.seen += add;
        s.at = now;
        waitUntil((async () => {
          let cur = 0;
          try { cur = Number(await kv.get(kvKey)) || 0; } catch { cur = 0; }
          const v = Math.max(cur + add, s.seen);
          s.seen = Math.max(s.seen, v);
          await kv.put(kvKey, String(v), { expirationTtl: 2 * 86_400 });
        })().catch(() => {}));
      }
      return { ok: true, used: n, cap, resetsAt };
    },
  };
}

export interface Offer { priceUsd: number; bundleUsd: number; serverCount: number }

const tokenUrl = (product: string) => `${HOST}/mcp/${product}/t/<token>`;

/** The tool result text when the keyless cap for this address is used up. */
export function keylessCapText(product: string, d: KeylessDecision, o: Offer, unrecognized = false): string {
  return `This call carried no ${unrecognized ? "recognized " : ""}token, and keyless use of mcp.zovo.one is capped at ${d.cap} tool calls a day per network address. ` +
    `This address has used them; the count resets at ${d.resetsAt}. ` +
    `A free token lifts this to 600 calls an hour and keeps your data for 30 days: open ${HOST}/mcp/connect (one click, no account), ` +
    `then reconnect this server with the URL it prints, ${tokenUrl(product)}. ` +
    `Pro lifts the free-tier limits: $${o.priceUsd} one-time for this server at ${HOST}/buy/${product}?src=${product}.keyless_cap, ` +
    `or all ${o.serverCount} servers for $${o.bundleUsd} at ${HOST}/buy/bundle?src=${product}.keyless_cap.bundle`;
}

/** A JSON-RPC tool result (isError) carrying the cap text, as an ordinary 200 response. */
export function keylessCapBody(id: unknown, text: string): string {
  return JSON.stringify({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], isError: true } });
}

/**
 * Append one text part to a JSON-RPC tool result, success or isError alike: a keyless Pro
 * refusal is an isError result and must name the free token too. Anything that is not a
 * tool result (a JSON-RPC error, a non-JSON body) is returned unchanged.
 */
export function appendResultText(body: string, text: string): { body: string; appended: boolean } {
  try {
    const o = JSON.parse(body) as { result?: { content?: unknown } };
    if (!o || typeof o !== "object" || !o.result || !Array.isArray(o.result.content)) return { body, appended: false };
    (o.result.content as unknown[]).push({ type: "text", text });
    return { body: JSON.stringify(o), appended: true };
  } catch {
    return { body, appended: false };
  }
}

/** The line appended to every keyless tool result. */
export function keylessTrailer(product: string, d: KeylessDecision, wroteData: boolean, o: Offer, unrecognized = false): string {
  return (unrecognized ? `This ran on the keyless free tier, which saves nothing between calls` : `No token was sent, so this ran on the keyless free tier, which saves nothing between calls`) +
    (wroteData ? `: what this call recorded is already gone and will not be there on the next call` : ``) + `. ` +
    `${d.used} of ${d.cap} keyless calls used today from this address. ` +
    `To keep data and get 600 calls an hour, get a free token at ${HOST}/mcp/connect and reconnect with ${tokenUrl(product)}. ` +
    `Pro ($${o.priceUsd}/server or $${o.bundleUsd} for all ${o.serverCount}, one-time): ${HOST}/buy/${product}?src=${product}.keyless`;
}

/* ------------------------------------------------ never-issued credentials (s1118b) */

/**
 * NEVER-ISSUED CREDENTIALS ARE NO CREDENTIAL.
 *
 * Measured 2026-11-17 16:02 and 16:25 UTC (wrangler tail, data/s1116/wall/pt_tail.jsonl):
 * after mcp-remote 6ed934fa, Claude-User from ASN "Anthropic, PBC" sent 8 POSTs to
 * /mcp/price-tracker WITH an Authorization header and every one answered 401. No non-owner
 * OAuth token exchange has ever happened on this worker, so that value was never issued
 * here, and the keyless free tier never applied because a credential was present.
 *
 * So an Authorization header that carries nothing this worker ever issued is treated
 * exactly like a missing header: initialize and tools/list take the anonymous path and
 * tools/call takes the keyless free tier, with one extra line saying the saved token was
 * not recognized. A value that WAS issued and is now expired or revoked keeps the 401, now
 * with an RFC 6750 `error="invalid_token"` challenge, so an OAuth client refreshes.
 *
 * What this worker issues, and how each is recognized:
 *  - `anon_<32 hex>` (GET /mcp/token, /mcp/connect, and the OAuth access token): tok:<token>
 *    while live. Once tok: has expired, `meta:anon:<id>` (stamped by authenticated tool
 *    calls, kept until the 35-day sweep) or `bind:<token>` (a bound purchase) still prove
 *    it was issued. With none of the three the store cannot tell it from a never-issued
 *    value, and it is treated as never issued.
 *  - `rt_<64 hex>` (OAuth refresh token): issued while `oauth_refresh:<rt>` exists. It is
 *    not an access token, so a live one sent as a bearer keeps today's 401.
 *  - `MCPL1.` licence keys are verified by signature in authenticate() and keep their
 *    invalid_license answer: a buyer with a mistyped key must see that, not a free tier.
 *  - Anything else (another scheme, an empty bearer, any other shape) was never issued here
 *    and needs no KV read.
 * A KV failure fails closed to today's behaviour ("issued"): authenticate() decides.
 * No token value is logged or stored; only the reason label below.
 */
export type HeaderCredential =
  | { kind: "none" }
  | { kind: "issued"; tokSeen?: string | null }
  | { kind: "never_issued"; reason: "not_bearer" | "foreign_shape" | "anon_unknown" | "refresh_unknown" };

const ANON_TOKEN_RE = /^anon_[0-9a-f]{32}$/;
const REFRESH_RE = /^rt_[0-9a-f]{64}$/;

export async function classifyAuthorization(kv: Pick<KvLike, "get">, header: string | null): Promise<HeaderCredential> {
  if (!header) return { kind: "none" };
  // Same parse as authenticate(): only `Bearer <value>` carries a token there.
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return { kind: "never_issued", reason: "not_bearer" };
  if (token.startsWith("MCPL1.")) return { kind: "issued" };
  try {
    if (ANON_TOKEN_RE.test(token)) {
      const seen = await kv.get(`tok:${token}`);
      if (seen !== null) return { kind: "issued", tokSeen: seen };
      const [meta, bind] = await Promise.all([kv.get(`meta:anon:${token.slice(5)}`), kv.get(`bind:${token}`)]);
      if (meta !== null || bind !== null) return { kind: "issued", tokSeen: null };
      return { kind: "never_issued", reason: "anon_unknown" };
    }
    if (REFRESH_RE.test(token)) {
      return (await kv.get(`oauth_refresh:${token}`)) !== null ? { kind: "issued" } : { kind: "never_issued", reason: "refresh_unknown" };
    }
  } catch {
    return { kind: "issued" };
  }
  return { kind: "never_issued", reason: "foreign_shape" };
}

/**
 * The challenge for a credential this worker issued that is no longer valid (expired,
 * revoked, or a refresh token sent as an access token): RFC 6750 3.1 invalid_token plus the
 * path-scoped RFC 9728 metadata, so an OAuth client refreshes or re-authorizes.
 */
export function invalidTokenChallenge(product: string): string {
  return noCredentialChallenge(product).replace('realm="mcp.zovo.one", ', 'realm="mcp.zovo.one", error="invalid_token", ');
}

/** The one line added to a keyless result when the request carried a never-issued token. */
export function unrecognizedTokenLine(product: string): string {
  return `The saved connection token was not recognized by mcp.zovo.one, so this ran as if no token was sent. ` +
    `Get a free token at ${HOST}/mcp/connect (one click, no account) and reconnect with ${tokenUrl(product)}.`;
}
