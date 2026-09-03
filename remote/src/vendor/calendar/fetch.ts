import { Buffer } from "node:buffer";
/**
 * SSRF guard for the hosted endpoint (added by remote/build-vendor.mjs).
 * The worker sits inside a network the caller cannot otherwise reach, so a watch URL
 * must not be able to point at loopback, private, link-local or metadata addresses.
 * Every IPv4 literal form inet_aton accepts is parsed here - dotted quad, bare decimal
 * (http://2130706433/), hex (http://0x7f000001/), octal (http://0177.0.0.1/) and the
 * short 1-3 part forms - and IPv6 is parsed to bytes, so a v4-mapped literal
 * ([::ffff:127.0.0.1], which the URL parser rewrites to [::ffff:7f00:1]) is caught too.
 * Only literal addresses and obvious internal names are caught here; a hostname that
 * resolves to a private address through DNS is not, and is an accepted residual risk.
 */
const MAX_REDIRECTS = 5;

/** inet_aton: 1-4 parts, each decimal, 0x-hex or 0-prefixed octal. Returns 4 bytes. */
function ipv4Bytes(h: string): number[] | null {
  const parts = h.split(".");
  if (parts.length < 1 || parts.length > 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    let n: number;
    if (/^0[xX][0-9a-fA-F]{1,8}$/.test(part)) n = parseInt(part.slice(2), 16);
    else if (/^0[0-7]{1,11}$/.test(part)) n = parseInt(part.slice(1), 8);
    else if (/^(0|[1-9][0-9]{0,9})$/.test(part)) n = Number(part);
    else return null;
    if (!Number.isSafeInteger(n) || n < 0) return null;
    nums.push(n);
  }
  for (let i = 0; i < nums.length - 1; i++) if (nums[i] > 255) return null;
  const last = nums[nums.length - 1];
  if (last >= Math.pow(256, 4 - (nums.length - 1))) return null;
  let v = last;
  for (let i = 0; i < nums.length - 1; i++) v += nums[i] * Math.pow(256, 3 - i);
  return [Math.floor(v / 16777216) % 256, Math.floor(v / 65536) % 256, Math.floor(v / 256) % 256, v % 256];
}

/** True when the host is written only out of the characters an IPv4 literal uses. */
function looksNumeric(h: string): boolean { return /^[0-9a-fA-FxX.]+$/.test(h) && /[0-9]/.test(h); }

function isPrivateV4Bytes(b: number[]): boolean {
  const [a, c] = [b[0], b[1]];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && c >= 16 && c <= 31) return true;
  if (a === 192 && c === 168) return true;
  if (a === 192 && c === 0 && b[2] === 0) return true;   // IETF protocol assignments
  if (a === 169 && c === 254) return true;               // link-local, includes 169.254.169.254
  if (a === 100 && c >= 64 && c <= 127) return true;     // carrier-grade NAT
  if (a >= 224) return true;                             // multicast and reserved
  return false;
}

function isPrivateIPv4(h: string): boolean {
  const b = ipv4Bytes(h);
  if (!b) return looksNumeric(h) && !h.includes(":");   // numeric but unparseable: refuse it
  return isPrivateV4Bytes(b);
}

/** Parse an IPv6 literal (with or without brackets, with or without a v4 tail) to 16 bytes. */
function ipv6Bytes(raw: string): number[] | null {
  let s = raw.replace(/^\[/, "").replace(/\]$/, "").toLowerCase().replace(/%.*$/, "");
  if (!s.includes(":")) return null;
  const dotted = /^(.*:)([0-9a-fx.]+\.[0-9a-fx.]+)$/.exec(s);
  if (dotted) {
    const v4 = ipv4Bytes(dotted[2]);
    if (!v4) return null;
    s = dotted[1] + ((v4[0] << 8) | v4[1]).toString(16) + ":" + ((v4[2] << 8) | v4[3]).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] === "" ? [] : halves[0].split(":");
  const tail = halves.length === 2 ? (halves[1] === "" ? [] : halves[1].split(":")) : [];
  let groups: string[];
  if (halves.length === 1) { if (head.length !== 8) return null; groups = head; }
  else {
    const fill = 8 - head.length - tail.length;
    if (fill < 1) return null;
    groups = [...head, ...Array(fill).fill("0"), ...tail];
  }
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const n = parseInt(g, 16);
    out.push(n >> 8, n & 255);
  }
  return out;
}

function isPrivateIPv6(h: string): boolean {
  const b = ipv6Bytes(h);
  if (!b) return h.includes(":");            // an unparseable colon-host is not public either
  if (b.every((x) => x === 0)) return true;                                   // ::
  if (b.slice(0, 15).every((x) => x === 0) && b[15] === 1) return true;       // ::1
  if ((b[0] & 0xfe) === 0xfc) return true;                                    // fc00::/7 unique local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true;                   // fe80::/10 link-local
  if (b[0] === 0xff) return true;                                             // ff00::/8 multicast
  const zeros10 = b.slice(0, 10).every((x) => x === 0);
  if (zeros10 && b[10] === 0xff && b[11] === 0xff) return isPrivateV4Bytes(b.slice(12));   // ::ffff:a.b.c.d
  if (zeros10 && b[10] === 0 && b[11] === 0) return true;                     // ::a.b.c.d and friends
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return isPrivateV4Bytes(b.slice(12));  // NAT64
  if (b[0] === 0x20 && b[1] === 0x02) return isPrivateV4Bytes(b.slice(2, 6)); // 6to4
  return false;
}

export function guardTarget(u: URL): void {
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new FetchError(`only http and https URLs can be fetched (got ${u.protocol})`);
  }
  const raw = u.hostname.toLowerCase();
  const host = raw.replace(/\.$/, "");
  const blocked =
    host === "localhost" || host.endsWith(".localhost") ||
    host === "metadata.google.internal" || host.endsWith(".internal") ||
    host.endsWith(".local") || host === "" ||
    (raw.includes(":") ? isPrivateIPv6(raw) : isPrivateIPv4(host));
  if (blocked) {
    throw new FetchError(
      `${u.hostname} is not a public address, so this hosted endpoint will not fetch it. ` +
      "Paste the calendar's contents as text instead (ics_import {text, name}), or run the calendar server locally over stdio (npx -y @theluckystrike/mcp-calendar), where it can reach your own network.");
  }
}

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
  guardTarget(parsed);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res!: Response;
  let current = parsed;
  try {
    for (let hop = 0; ; hop++) {
      if (hop > MAX_REDIRECTS) throw new FetchError(`too many redirects (over ${MAX_REDIRECTS}) starting at ${parsed.toString()}`);
      res = await fetch(current.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/calendar, text/plain, */*" },
      });
      if (res.status < 300 || res.status > 399) break;
      const loc = res.headers.get("location");
      if (!loc) break;
      let next: URL;
      try { next = new URL(loc, current); } catch { throw new FetchError(`the feed redirected to something that is not a URL (${loc}).`); }
      guardTarget(next);
      current = next;
    }
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof FetchError) throw e;
    throw new FetchError((e as Error)?.name === "AbortError"
      ? `the calendar feed did not answer within ${Math.round(timeoutMs / 1000)}s.`
      : `could not reach ${current.hostname} (${(e as Error)?.message ?? "network error"}).`);
  }
  clearTimeout(timer);
  if (!res.ok) throw new FetchError(`the feed returned HTTP ${res.status} for ${current.toString()}.`);
  const finalUrl = current.toString();
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
