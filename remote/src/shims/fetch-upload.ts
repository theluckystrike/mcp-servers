/**
 * One shared `url` path for every upload shim (pdf, docx, image, sheet, bank, zip).
 *
 * D-R74 measured the real ceiling on the hosted upload path: it is not the 256 KB request
 * body, it is how long the model takes to retype a base64 payload. A 13 KB paste took
 * sixteen minutes and never emitted the tool call. So every upload tool now also takes a
 * `url` and the worker fetches the bytes itself, which costs the model one short line.
 *
 * A worker fetch is a server-side fetch, so this is an SSRF surface and it is guarded the
 * same way the vendored price-tracker and calendar fetches are (remote/build-vendor.mjs,
 * `guardTarget`): http/https only, every IPv4 literal form inet_aton accepts parsed to
 * bytes, IPv6 parsed to bytes, internal name patterns refused. Two things are added here
 * that the page fetch does not need:
 *
 *   - the worker's own zone is refused. A worker cannot fetch its own zone anyway
 *     (D-R73: HTTP 522), so the refusal turns a confusing timeout into a sentence.
 *   - the response is capped twice, on the declared `content-length` and again on the
 *     stream, so an endpoint that lies about its length still cannot fill the tenant
 *     document.
 *
 * Only literal addresses and the internal name patterns are caught. A public hostname
 * that resolves to a private address through DNS is not, and is the same accepted
 * residual risk the price-tracker guard carries.
 */
import { Buffer } from "node:buffer";

/** One fetch, start to finish, including every redirect hop. */
export const FETCH_TIMEOUT_MS = 10_000;
/** Hops followed by hand, guarded again on each one. */
export const MAX_REDIRECTS = 3;

/** The zone this worker serves. A fetch back into it is refused before it is attempted. */
export const OWN_HOSTS = ["mcp.zovo.one", "zovo.one"];
/** The workers.dev name of the same worker, refused for the same reason. */
export const OWN_SUFFIXES = [".zovo.one", ".lipmichal.workers.dev"];

/** Thrown with text meant for the caller to read. */
export class UploadFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadFetchError";
  }
}

/** inet_aton: 1-4 parts, each decimal, 0x-hex or 0-prefixed octal. Returns 4 bytes. */
export function ipv4Bytes(h: string): number[] | null {
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
  if (!b) return looksNumeric(h) && !h.includes(":");    // numeric but unparseable: refuse it
  return isPrivateV4Bytes(b);
}

/** Parse an IPv6 literal (brackets, :: compression, dotted v4 tail) to 16 bytes. */
export function ipv6Bytes(raw: string): number[] | null {
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
  if (!b) return h.includes(":");                                             // unparseable colon-host
  if (b.every((x) => x === 0)) return true;                                   // ::
  if (b.slice(0, 15).every((x) => x === 0) && b[15] === 1) return true;       // ::1
  if ((b[0] & 0xfe) === 0xfc) return true;                                    // fc00::/7
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true;                   // fe80::/10
  if (b[0] === 0xff) return true;                                             // ff00::/8
  const zeros10 = b.slice(0, 10).every((x) => x === 0);
  if (zeros10 && b[10] === 0xff && b[11] === 0xff) return isPrivateV4Bytes(b.slice(12));
  if (zeros10 && b[10] === 0 && b[11] === 0) return true;
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return isPrivateV4Bytes(b.slice(12));
  if (b[0] === 0x20 && b[1] === 0x02) return isPrivateV4Bytes(b.slice(2, 6));
  return false;
}

/** True when this host is the zone this worker itself serves (D-R73). */
export function isOwnZone(host: string): boolean {
  return OWN_HOSTS.includes(host) || OWN_SUFFIXES.some((s) => host.endsWith(s));
}

/**
 * Refuse anything that is not a public http(s) address. Throws UploadFetchError with
 * text the caller reads; returns nothing when the target is allowed.
 */
export function guardFetchTarget(u: URL): void {
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new UploadFetchError(
      `url must be http or https (got ${u.protocol}). A data:, file: or ftp: URL cannot be fetched by this endpoint; ` +
      "send the bytes base64-encoded instead.");
  }
  const raw = u.hostname.toLowerCase();
  const host = raw.replace(/\.$/, "");
  if (isOwnZone(host)) {
    throw new UploadFetchError(
      `${u.hostname} is this endpoint's own zone, and a Cloudflare worker cannot fetch the zone it serves ` +
      "(the request comes back HTTP 522). Host the file somewhere else, for example raw.githubusercontent.com, " +
      "or send the bytes base64-encoded.");
  }
  const blocked =
    host === "localhost" || host.endsWith(".localhost") ||
    host === "metadata.google.internal" || host.endsWith(".internal") ||
    host.endsWith(".local") || host === "" ||
    (raw.includes(":") ? isPrivateIPv6(raw) : isPrivateIPv4(host));
  if (blocked) {
    throw new UploadFetchError(
      `${u.hostname} is not a public address, so this hosted endpoint will not fetch it. ` +
      "Only public http(s) URLs can be fetched here; a file on your own machine or network has to be sent " +
      "base64-encoded, or the server run locally over stdio.");
  }
}

export interface FetchedUpload {
  /** The bytes, whole: nothing here is ever truncated to fit. */
  buf: Buffer;
  bytes: number;
  /** Host of the final response, after redirects. This is what the caller is told. */
  host: string;
  finalUrl: string;
  redirects: number;
  contentType: string;
}

export interface FetchUploadOptions {
  /** Per-shim ceiling in bytes. Checked on content-length and again on the stream. */
  maxBytes: number;
  /** What the caller called this thing, for the error text ("PDF", "image", "archive"). */
  label: string;
  /** Magic-byte check, exactly the one the base64 path runs. Throws to refuse. */
  verify?: (buf: Buffer) => void;
  /** Injected in tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function mb(n: number): string {
  return n >= 1048576 ? `${(n / 1048576).toFixed(n % 1048576 === 0 ? 0 : 2)} MB` : `${Math.round(n / 1024)} KB`;
}

/**
 * Fetch a public file for an upload shim. Guards the first hop and every redirect,
 * follows at most MAX_REDIRECTS, gives up after FETCH_TIMEOUT_MS across the whole
 * exchange, refuses a body over `maxBytes` from either the declared length or the
 * stream, and runs the shim's own magic check before the bytes are handed back.
 * Nothing is stored by this function; the caller stages what it returns.
 */
export async function fetchUpload(rawUrl: string, opts: FetchUploadOptions): Promise<FetchedUpload> {
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
  let parsed: URL;
  try { parsed = new URL(String(rawUrl ?? "").trim()); }
  catch { throw new UploadFetchError(`"${rawUrl}" is not a valid URL. Include https://`); }
  guardFetchTarget(parsed);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let current = parsed;
    let redirects = 0;
    let res: Response;
    for (;;) {
      res = await doFetch(current.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { accept: "*/*", "user-agent": "mcp.zovo.one upload fetch (+https://mcp.zovo.one/mcp)" },
      });
      if (res.status < 300 || res.status > 399) break;
      const loc = res.headers.get("location");
      if (!loc) break;
      if (redirects >= MAX_REDIRECTS) {
        throw new UploadFetchError(
          `that URL redirected more than ${MAX_REDIRECTS} times (last hop ${current.toString()}). ` +
          "Give the final URL of the file itself.");
      }
      let next: URL;
      try { next = new URL(loc, current); }
      catch { throw new UploadFetchError(`that URL redirected to something that is not a URL (${loc})`); }
      guardFetchTarget(next);          // every hop, not only the first
      current = next;
      redirects++;
    }

    if (!res.ok) {
      throw new UploadFetchError(
        `the file could not be fetched: HTTP ${res.status} from ${current.hostname}. ` +
        "The URL has to be public and point straight at the file (a login page or a viewer page is not the file).");
    }

    const declared = Number(res.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > opts.maxBytes) {
      try { await res.body?.cancel(); } catch { /* ignore */ }
      throw new UploadFetchError(
        `that file is ${mb(declared)} and the hosted cap is ${mb(opts.maxBytes)} per ${opts.label}. ` +
        "Nothing was fetched or stored.");
    }

    const buf = await readCapped(res, opts.maxBytes, opts.label);
    if (buf.length === 0) {
      throw new UploadFetchError(`${current.hostname} returned an empty file (zero bytes). Nothing was stored.`);
    }
    // The magic check is a refusal about the FILE, not about the network: rethrown as an
    // UploadFetchError so it is not swallowed by the "could not reach <host>" branch below.
    if (opts.verify) {
      try { opts.verify(buf); }
      catch (e) { throw new UploadFetchError(String((e as Error)?.message ?? e)); }
    }
    return {
      buf,
      bytes: buf.length,
      host: current.hostname,
      finalUrl: current.toString(),
      redirects,
      contentType: (res.headers.get("content-type") ?? "").split(";")[0].trim(),
    };
  } catch (e) {
    if (e instanceof UploadFetchError) throw e;
    if ((e as Error)?.name === "AbortError") {
      throw new UploadFetchError(`the server did not answer within ${Math.round(timeoutMs / 1000)}s, so nothing was stored.`);
    }
    throw new UploadFetchError(`could not reach ${parsed.hostname} (${(e as Error)?.message ?? "network error"})`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read a response body, stopping the moment it passes the cap. A server that declares no
 * length, or declares a false one, is caught here: the read is abandoned and the whole
 * fetch is refused rather than a truncated file being stored.
 */
async function readCapped(res: Response, maxBytes: number, label: string): Promise<Buffer> {
  const body = res.body;
  if (!body) {
    const b = Buffer.from(await res.arrayBuffer());
    if (b.length > maxBytes) {
      throw new UploadFetchError(
        `that file is ${mb(b.length)} and the hosted cap is ${mb(maxBytes)} per ${label}. Nothing was stored.`);
    }
    return b;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new UploadFetchError(
        `that file is over the ${mb(maxBytes)} cap per ${label} (reading stopped at ${total} bytes). ` +
        "Nothing was stored. Send a smaller file, or run the server locally over stdio where there is no cap.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/** The sentence every `url` argument carries, so the recommendation reads the same everywhere. */
export const URL_ARG_DESCRIPTION =
  "url: fetch a public file instead of pasting base64 (recommended above about 10 KB)";

/** One of exactly one. Throws the caller-facing text when zero or more than one is given. */
export function exactlyOne(given: Record<string, unknown>): string {
  const names = Object.keys(given);
  const set = names.filter((n) => given[n] !== undefined && given[n] !== null);
  if (set.length === 1) return set[0];
  if (set.length === 0) throw new UploadFetchError(`give exactly one of ${names.join(", ")}`);
  throw new UploadFetchError(`give exactly one of ${names.join(", ")}, not ${set.length} (${set.join(" and ")} were both given)`);
}
