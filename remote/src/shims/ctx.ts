import { AsyncLocalStorage } from "node:async_hooks";
import type { Buffer } from "node:buffer";

export interface Download {
  token: string;
  mime: string;
  /** utf-8 text, or base64 when encoding is "base64" */
  body: string;
  filename: string;
  encoding?: "base64";
}

export interface RequestCtx {
  tenant: string;
  server: string;
  isPro: boolean;
  /**
   * The anonymous bearer token of this request (`anon_<32 hex>`), when the caller is
   * anonymous. It is the tenant key a checkout binds to, so the free-cap upgrade text
   * can carry /buy/<product>?tenant=<anonToken> and the purchase needs no key paste.
   * Absent for licence-key callers, who are Pro already.
   */
  anonToken?: string;
  /**
   * How the token actually reached this endpoint: a header, or the URL forms a
   * client with no header field must use. license_status reports it, so a claude.ai
   * or Claude Desktop user is not told their token came from a header they never set.
   */
  authVia?: "Authorization: Bearer" | "URL path segment (/mcp/<server>/t/<token>)" | "URL query parameter (?token=)";
  /** virtual filesystem: absolute path -> file contents (binary values carry the BIN sentinel) */
  files: Map<string, string>;
  dirs: Set<string>;
  downloads: Download[];
  baseUrl: string;
  /** Decides which files a completed atomic write turns into a download link. */
  publish?: (path: string) => boolean;
  /** virtual path -> download URL, filled in by the fs shim, substituted into the response body */
  published: Map<string, string>;
  /** Ceiling on the tenant's stored bytes for this endpoint; a write over it throws. */
  maxBytes?: number;
  /** Persisted bytes (key + value, scratch files excluded), kept incrementally by the fs shim. */
  bytes: number;
  /** Persisted file count (scratch files excluded), kept incrementally by the fs shim. */
  nfiles: number;
  /**
   * Paths hydrated from a cross-tenant shared cache (the ECB rate files). They are not
   * this tenant's data: they are exempt from the per-tenant byte and file caps, and the
   * worker never writes them into the tenant document.
   */
  shared?: Set<string>;
  /** Open file descriptors, request-local: fd -> buffer plus its own read offset. */
  fds: Map<number, { buf: Buffer; pos: number }>;
  nextFd: number;
}

export const STORE = new AsyncLocalStorage<RequestCtx>();

export function ctx(): RequestCtx {
  const c = STORE.getStore();
  if (!c) throw new Error("no request context");
  return c;
}
