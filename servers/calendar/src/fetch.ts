import { decodeIcs } from "./ics.js";
/**
 * Fetching a calendar feed. Only ever called when the user explicitly passed a URL:
 * nothing here runs on a file or text import, and there is no background refresh.
 *
 * The guard is the price-tracker's shape (protocol check, abort timeout, byte cap)
 * plus a private-address block, because a calendar URL is far likelier than a shop
 * URL to be pasted from somewhere the user did not write.
 */
export const TIMEOUT_MS = 12_000;
export const MAX_BYTES = 5 * 1024 * 1024;
export const USER_AGENT = "mcp-calendar/0.5.0 (+https://github.com/theluckystrike/mcp-servers)";

export class FetchError extends Error {}

/** Hostnames that must never be fetched: loopback, link-local, private ranges, cloud metadata. */
export function isBlockedHost(host: string): string | null {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return "the URL has no host";
  if (h === "localhost" || h.endsWith(".localhost")) return "localhost";
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".home.arpa")) return "a local network name";
  if (h === "metadata.google.internal") return "a cloud metadata service";
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return "the IPv6 loopback address";
  if (/^fe80:/i.test(h) || /^f[cd][0-9a-f]{2}:/i.test(h)) return "a private IPv6 address";
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127) return "a loopback address";
    if (a === 10) return "a private address";
    if (a === 0) return "an unspecified address";
    if (a === 169 && b === 254) return "a link-local address (cloud metadata)";
    if (a === 172 && b >= 16 && b <= 31) return "a private address";
    if (a === 192 && b === 168) return "a private address";
    if (a === 100 && b >= 64 && b <= 127) return "a carrier-private address";
    if (a >= 224) return "a multicast or reserved address";
  }
  return null;
}

export interface Fetched { text: string; finalUrl: string; bytes: number; truncated: boolean }

export async function fetchIcs(url: string, timeoutMs = TIMEOUT_MS): Promise<Fetched> {
  let parsed: URL;
  try { parsed = new URL(url.replace(/^webcal:/i, "https:")); }
  catch { throw new FetchError(`"${String(url).slice(0, 120)}" is not a valid URL. Include https://`); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new FetchError(`only http, https and webcal URLs are supported (got ${parsed.protocol}).`);
  }
  const blocked = isBlockedHost(parsed.hostname);
  if (blocked && !process.env.MCP_CALENDAR_ALLOW_LOCAL) {
    throw new FetchError(
      `refusing to fetch ${parsed.hostname}: that is ${blocked}. A calendar URL must be a public address. ` +
      `Download the file yourself and pass it as {path: "..."} instead.`,
    );
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/calendar, text/plain, */*" },
    });
  } catch (e) {
    clearTimeout(timer);
    throw new FetchError((e as Error)?.name === "AbortError"
      ? `the calendar feed did not answer within ${Math.round(timeoutMs / 1000)}s.`
      : `could not reach ${parsed.hostname} (${(e as Error)?.message ?? "network error"}).`);
  }
  clearTimeout(timer);
  if (!res.ok) throw new FetchError(`the feed returned HTTP ${res.status} for ${parsed.toString()}.`);
  const finalUrl = res.url || parsed.toString();
  const after = new URL(finalUrl);
  const blockedAfter = isBlockedHost(after.hostname);
  if (blockedAfter && !process.env.MCP_CALENDAR_ALLOW_LOCAL) {
    throw new FetchError(`the feed redirected to ${after.hostname}, which is ${blockedAfter}; nothing was read.`);
  }
  const { text, bytes, truncated } = await readCapped(res);
  return { text, finalUrl, bytes, truncated };
}

async function readCapped(res: Response): Promise<{ text: string; bytes: number; truncated: boolean }> {
  const body = res.body;
  if (!body) {
    const t = await res.text();
    const b = Buffer.from(t, "utf8");
    return { text: decodeIcs(b.subarray(0, MAX_BYTES)), bytes: b.length, truncated: b.length > MAX_BYTES };
  }
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      truncated = true;
      try { await reader.cancel(); } catch { /* already closing */ }
      break;
    }
    chunks.push(Buffer.from(value));
  }
  if (truncated) {
    throw new FetchError(`the feed is larger than ${MAX_BYTES / (1024 * 1024)} MB; nothing was imported. Export a narrower date range.`);
  }
  const buf = Buffer.concat(chunks);
  return { text: decodeIcs(buf), bytes: buf.length, truncated: false };
}
