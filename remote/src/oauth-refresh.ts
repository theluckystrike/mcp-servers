/**
 * OAuth refresh tokens (RFC 6749 §6, OAuth 2.1 §4.3) for the hosted endpoints.
 *
 * The access token is the anonymous token itself, and that token IS the tenant's data
 * space: rotating it would strand every document stored under it. So a refresh hands back
 * the SAME access token and rotates only the refresh token. What a refresh buys the client
 * is persistence: tok:<token> lives TOK_TTL (31 days) and is pushed out only by writes, so
 * a connection idle for a month used to die with unknown_token. A refresh re-stamps
 * tok:<token>, and the refresh token itself lives a year.
 *
 * KV is written only here, at issuance and at refresh: one put per issued refresh token,
 * and on a refresh one delete, one put and the tok: re-stamp. No MCP request touches it.
 *
 * Each refresh token is bound to the access token and to the client_id it was issued to.
 * It is single-use: redeeming it deletes it before the new one is issued, so a replayed
 * refresh token gets invalid_grant. KV is eventually consistent, so two redemptions racing
 * in different locations can both succeed; each then holds a valid refresh token for the
 * same access token and nothing else is exposed.
 */

/** Refresh token lifetime: a linked app keeps working for a year without a new consent. */
export const OAUTH_REFRESH_TTL = 60 * 60 * 24 * 365;

/** `rt_` plus 32 random bytes in hex. Anything else is refused before any KV read. */
export const REFRESH_TOKEN_RE = /^rt_[0-9a-f]{64}$/;

const ANON_TOKEN_RE = /^anon_[0-9a-f]{32}$/;

type KV = Pick<KVNamespace, "get" | "put" | "delete">;

export type RefreshResult =
  | { ok: true; token: string; refresh_token: string }
  | { ok: false; error: "invalid_grant" | "invalid_request"; message: string };

function newRefreshToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return "rt_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Store a new refresh token bound to (access token, client) and return it. */
export async function issueRefreshToken(kv: KV, token: string, clientId: string): Promise<string> {
  const rt = newRefreshToken();
  await kv.put(`oauth_refresh:${rt}`, JSON.stringify({ token, client_id: clientId, at: Date.now() }),
    { expirationTtl: OAUTH_REFRESH_TTL });
  return rt;
}

/**
 * grant_type=refresh_token. A client_id that is sent must match the one the token was
 * issued to; a public client that omits it is identified by the refresh token alone, the
 * same rule the authorization_code exchange applies.
 */
export async function redeemRefreshToken(kv: KV, refreshToken: string, clientId: string, tokTtl: number): Promise<RefreshResult> {
  if (!refreshToken) return { ok: false, error: "invalid_request", message: "refresh_token is required." };
  if (!REFRESH_TOKEN_RE.test(refreshToken)) return { ok: false, error: "invalid_grant", message: "Refresh token is unknown, used or expired." };
  const stored = await kv.get(`oauth_refresh:${refreshToken}`);
  if (stored === null) return { ok: false, error: "invalid_grant", message: "Refresh token is unknown, used or expired." };
  let grant: { token?: unknown; client_id?: unknown };
  try { grant = JSON.parse(stored) as typeof grant; } catch { grant = {}; }
  const token = typeof grant.token === "string" ? grant.token : "";
  const boundClient = typeof grant.client_id === "string" ? grant.client_id : "";
  if (!ANON_TOKEN_RE.test(token)) return { ok: false, error: "invalid_grant", message: "Refresh token is unknown, used or expired." };
  if (clientId && clientId !== boundClient) return { ok: false, error: "invalid_grant", message: "client_id mismatch." };
  // Single use: the old token is gone before the new one exists.
  await kv.delete(`oauth_refresh:${refreshToken}`);
  const next = await issueRefreshToken(kv, token, boundClient);
  // Persistent linking: the access token is valid again for a full TOK_TTL from now.
  await kv.put(`tok:${token}`, String(Date.now()), { expirationTtl: tokTtl });
  return { ok: true, token, refresh_token: next };
}
