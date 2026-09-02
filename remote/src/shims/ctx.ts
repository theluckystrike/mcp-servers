import { AsyncLocalStorage } from "node:async_hooks";

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
}

export const STORE = new AsyncLocalStorage<RequestCtx>();

export function ctx(): RequestCtx {
  const c = STORE.getStore();
  if (!c) throw new Error("no request context");
  return c;
}
