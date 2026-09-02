import { AsyncLocalStorage } from "node:async_hooks";

export interface Download { token: string; mime: string; body: string; filename: string }

export interface RequestCtx {
  tenant: string;
  server: string;
  isPro: boolean;
  /** virtual filesystem: absolute path -> file contents */
  files: Map<string, string>;
  dirs: Set<string>;
  downloads: Download[];
  baseUrl: string;
}

export const STORE = new AsyncLocalStorage<RequestCtx>();

export function ctx(): RequestCtx {
  const c = STORE.getStore();
  if (!c) throw new Error("no request context");
  return c;
}
