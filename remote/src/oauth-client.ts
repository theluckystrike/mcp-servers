/**
 * Confidential OAuth clients (RFC 7591 §2 and §3.2.1, RFC 6749 §2.3.1) for the hosted
 * endpoints, next to the public clients that have always been supported.
 *
 * Why: Microsoft 365 Copilot (MCP plugins through the Enterprise token store) states
 * "DCR without a client secret isn't supported yet. The authorization server must issue a
 * client secret during registration." Its redirect URI is the fixed
 * https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect. Other enterprise hosts
 * ask for client_secret_basic or client_secret_post by name.
 *
 * Rules:
 * - A registration that asks for client_secret_basic or client_secret_post gets a random
 *   client_id and a 256-bit client_secret. The secret is returned once; KV keeps only
 *   its SHA-256 (hex) in the client record. client_secret_expires_at is 0 (no expiry).
 * - A registration that names no method and whose redirect_uris include a Microsoft
 *   token-store callback is confidential too, with the RFC 7591 §2 default
 *   client_secret_basic. Every other registration is a public client exactly as before:
 *   same deterministic client_id, same response, token_endpoint_auth_method "none".
 * - At the token endpoint a confidential client authenticates for both grants, with the
 *   HTTP Basic header (id and secret form-urlencoded, RFC 6749 §2.3.1) or with
 *   client_id + client_secret in the body. Either one is accepted whatever method was
 *   registered (RFC 6749 §2.3 lets the server accept any suitable scheme); both at once is
 *   invalid_request. Failure is invalid_client, HTTP 401, WWW-Authenticate: Basic.
 * - PKCE stays mandatory for every client. A secret is an additional proof, not a
 *   replacement.
 * - Public clients do not pay for this: an authorization code or refresh token issued to a
 *   confidential client carries `conf: true`, and only those trigger the client lookup.
 *   Public codes and refresh tokens are stored and redeemed byte for byte as before.
 */

type KV = Pick<KVNamespace, "get" | "put">;

export const CONFIDENTIAL_METHODS = ["client_secret_basic", "client_secret_post"] as const;
export type AuthMethod = "none" | (typeof CONFIDENTIAL_METHODS)[number];

/** A confidential client record lives as long as a refresh token and is renewed on use. */
export const OAUTH_CLIENT_TTL = 60 * 60 * 24 * 365;
const RENEW_AFTER_MS = 30 * 86_400_000;

/** Microsoft Enterprise token store callback hosts (commercial, GCC High, DoD). */
const MS_REDIRECT_HOSTS = new Set(["teams.microsoft.com", "teams.microsoft.us", "gov.teams.microsoft.us", "dod.teams.microsoft.us"]);

/** True for a Microsoft 365 Copilot / Teams token-store OAuth callback. */
export function isMicrosoftTokenStoreRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.protocol === "https:" && MS_REDIRECT_HOSTS.has(u.hostname) && u.pathname.toLowerCase().startsWith("/api/platform/");
  } catch {
    return false;
  }
}

/**
 * The token_endpoint_auth_method a registration gets. An unknown or unsupported value
 * falls back to "none", as every registration did before (RFC 7591 §3.2.1 lets the server
 * replace a requested value and report what it chose).
 */
export function registrationAuthMethod(metadata: Record<string, unknown>, redirectUris: string[]): AuthMethod {
  const asked = metadata.token_endpoint_auth_method;
  if (asked === "client_secret_basic" || asked === "client_secret_post") return asked;
  if ((asked === undefined || asked === null || asked === "") && redirectUris.some(isMicrosoftTokenStoreRedirect)) {
    return "client_secret_basic";
  }
  return "none";
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
}

function randomHex(n: number): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return hex(b);
}

/** 128-bit random client_id, same 32-hex shape as the public ids. */
export function newConfidentialClientId(): string {
  return randomHex(16);
}

/** `cs_` plus 32 random bytes in hex (256 bits). */
export function newClientSecret(): string {
  return "cs_" + randomHex(32);
}

export async function sha256Hex(s: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))));
}

/** Constant-time equality of two strings of known equal length (hex digests). */
function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  return diff === 0;
}

export type ClientRecord = {
  metadata: Record<string, unknown>;
  at: number;
  secret_sha256?: string;
  token_endpoint_auth_method?: AuthMethod;
};

/**
 * Register a confidential client: store the record (metadata, SHA-256 of the secret) and
 * return the RFC 7591 §3.2.1 response body. The plain secret exists only in this body.
 */
export async function registerConfidentialClient(
  kv: KV, metadata: Record<string, unknown>, redirectUris: string[], method: Exclude<AuthMethod, "none">,
): Promise<Record<string, unknown>> {
  const clientId = newConfidentialClientId();
  const secret = newClientSecret();
  const now = Date.now();
  const record: ClientRecord = { metadata, at: now, secret_sha256: await sha256Hex(secret), token_endpoint_auth_method: method };
  await kv.put(`oauth_client:${clientId}`, JSON.stringify(record), { expirationTtl: OAUTH_CLIENT_TTL });
  return {
    client_id: clientId,
    client_secret: secret,
    client_secret_expires_at: 0,
    client_id_issued_at: Math.floor(now / 1000),
    redirect_uris: redirectUris,
    token_endpoint_auth_method: method,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
}

/** True when a stored client record (JSON text) is a confidential client. */
export function isConfidentialRecord(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const rec = JSON.parse(raw) as ClientRecord;
    return typeof rec.secret_sha256 === "string" && rec.secret_sha256.length === 64;
  } catch {
    return false;
  }
}

/** application/x-www-form-urlencoded decoding of one Basic credential part. */
function formDecode(s: string): string | null {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return null;
  }
}

export type ClientCredentials = {
  /** client_id from the body, else from the Basic header, else "". */
  id: string;
  /** Parsed Basic header, null when absent or not Basic. */
  basic: { id: string; secret: string } | null;
  /** A Basic header that could not be decoded. */
  basicMalformed: boolean;
  /** client_id and client_secret from the body ("" when absent). */
  postId: string;
  postSecret: string;
};

/** Read client credentials from the Authorization header and the token request body. */
export function clientCredentials(authorization: string | null, form: { get(name: string): unknown }): ClientCredentials {
  const postId = String(form.get("client_id") ?? "");
  const postSecret = String(form.get("client_secret") ?? "");
  let basic: ClientCredentials["basic"] = null;
  let basicMalformed = false;
  const m = /^Basic\s+([A-Za-z0-9+/=_-]+)\s*$/i.exec(authorization ?? "");
  if (m) {
    try {
      const bin = atob(m[1].replace(/-/g, "+").replace(/_/g, "/"));
      const text = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
      const colon = text.indexOf(":");
      const id = colon >= 0 ? formDecode(text.slice(0, colon)) : null;
      const secret = colon >= 0 ? formDecode(text.slice(colon + 1)) : null;
      if (id === null || secret === null) basicMalformed = true;
      else basic = { id, secret };
    } catch {
      basicMalformed = true;
    }
  } else if (/^Basic\b/i.test(authorization ?? "")) {
    basicMalformed = true;
  }
  return { id: postId || basic?.id || "", basic, basicMalformed, postId, postSecret };
}

export type ClientAuthError = { error: "invalid_client" | "invalid_request"; message: string; status: 400 | 401 };

/**
 * Authenticate confidential client `clientId` (the client the code or refresh token was
 * issued to). Returns null on success. On success a record older than 30 days is written
 * back with a fresh TTL, so a client in use never expires (one KV write per 30 days).
 */
export async function authenticateConfidentialClient(kv: KV, clientId: string, creds: ClientCredentials): Promise<ClientAuthError | null> {
  const fail = (message: string): ClientAuthError => ({ error: "invalid_client", message, status: 401 });
  if (creds.basic && creds.postSecret) {
    return { error: "invalid_request", message: "Use one client authentication method: the Basic header or client_secret in the body, not both.", status: 400 };
  }
  if (creds.basicMalformed) return fail("The Basic authorization header could not be decoded.");
  if (creds.basic && creds.postId && creds.basic.id !== creds.postId) return fail("client_id in the body does not match the Basic header.");
  const presentedId = creds.basic ? creds.basic.id : creds.postId;
  const secret = creds.basic ? creds.basic.secret : creds.postSecret;
  if (!secret) return fail("Client authentication is required for this client (client_secret_basic or client_secret_post).");
  if (presentedId && presentedId !== clientId) return fail("Client authentication failed.");
  const raw = await kv.get(`oauth_client:${clientId}`);
  let rec: ClientRecord | null = null;
  try { rec = raw ? JSON.parse(raw) as ClientRecord : null; } catch { rec = null; }
  if (!rec || typeof rec.secret_sha256 !== "string") return fail("Client authentication failed.");
  if (!constantTimeEqual(await sha256Hex(secret), rec.secret_sha256)) return fail("Client authentication failed.");
  if (Date.now() - (Number(rec.at) || 0) >= RENEW_AFTER_MS) {
    await kv.put(`oauth_client:${clientId}`, JSON.stringify({ ...rec, at: Date.now() }), { expirationTtl: OAUTH_CLIENT_TTL });
  }
  return null;
}

/** RFC 6749 §5.2: invalid_client is 401 with a WWW-Authenticate challenge. */
export function clientAuthErrorResponse(e: ClientAuthError): Response {
  const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store" };
  if (e.status === 401) headers["www-authenticate"] = 'Basic realm="mcp.zovo.one", charset="UTF-8"';
  return new Response(JSON.stringify({ error: e.error, error_description: e.message, message: e.message }), { status: e.status, headers });
}
