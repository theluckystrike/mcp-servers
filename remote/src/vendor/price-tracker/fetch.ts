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
      `Track a public product page instead, or run the price tracker locally over stdio ` +
      `(npx -y @theluckystrike/mcp-price-tracker), where it can reach your own network.`);
  }
}

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const TIMEOUT_MS = 12_000;
export const MAX_BYTES = 2 * 1024 * 1024;

export class FetchError extends Error {
  constructor(message: string, readonly status?: number, readonly blocked = false) {
    super(message);
    this.name = "FetchError";
  }
}

function blockedText(url: string, status: number): string {
  return (
    `the shop blocked this automated request (HTTP ${status}) for ${url}. ` +
    `Big retailers do this to non-browser traffic. Two ways round it: open the page in your browser, ` +
    `read the price, and record it with price_add_manual {url, price, currency}; ` +
    `or watch a smaller shop / a product page that is not behind a bot wall.`
  );
}

/**
 * A fetched page. `finalUrl` is the URL after every redirect was followed and
 * `status` is the HTTP status of that final response; callers compare
 * `finalUrl` against `requestedUrl` to detect a redirect off the product page
 * (see redirect.ts).
 */
export interface FetchedPage {
  html: string;
  /** the URL asked for, normalised by the URL parser */
  requestedUrl: string;
  /** the URL actually served, after redirects */
  finalUrl: string;
  /** HTTP status of the final response */
  status: number;
  /** true when finalUrl differs from requestedUrl */
  redirected: boolean;
}

/** Fetch a page as a desktop browser would. Throws FetchError with user-facing text. */
export async function fetchPage(url: string, timeoutMs = TIMEOUT_MS): Promise<FetchedPage> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new FetchError(`"${url}" is not a valid URL. Include https://`); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new FetchError(`only http and https URLs are supported (got ${parsed.protocol})`);
  }

  guardTarget(parsed);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  let current = parsed;
  try {
    for (let hop = 0; ; hop++) {
      if (hop > MAX_REDIRECTS) throw new FetchError(`too many redirects (over ${MAX_REDIRECTS}) starting at ${parsed.toString()}`);
      res = await fetch(current.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "accept-encoding": "gzip, deflate, br",
          "cache-control": "no-cache",
          "upgrade-insecure-requests": "1",
        },
      });
      if (res.status < 300 || res.status > 399) break;
      const loc = res.headers.get("location");
      if (!loc) break;
      let next: URL;
      try { next = new URL(loc, current); } catch { throw new FetchError(`the shop redirected to something that is not a URL (${loc})`); }
      guardTarget(next);
      current = next;
    }
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof FetchError) throw e;
    const msg = (e as Error)?.name === "AbortError"
      ? `the page did not answer within ${Math.round(timeoutMs / 1000)}s`
      : `could not reach ${current.hostname} (${(e as Error)?.message ?? "network error"})`;
    throw new FetchError(msg);
  }
  clearTimeout(timer);

  if (res.status === 403 || res.status === 429 || res.status === 401 || res.status === 503) {
    throw new FetchError(blockedText(parsed.toString(), res.status), res.status, true);
  }
  if (!res.ok) throw new FetchError(`the page returned HTTP ${res.status} for ${parsed.toString()}`, res.status);

  const html = await readCapped(res);
  if (/captcha|are you a human|enable javascript and cookies|access denied|unusual traffic/i.test(html.slice(0, 4000))) {
    throw new FetchError(blockedText(res.url || parsed.toString(), res.status), res.status, true);
  }
  const requestedUrl = parsed.toString();
  const finalUrl = current.toString() || res.url || requestedUrl;
  return { html, requestedUrl, finalUrl, status: res.status, redirected: finalUrl !== requestedUrl };
}

async function readCapped(res: Response): Promise<string> {
  const body = res.body;
  if (!body) return (await res.text()).slice(0, MAX_BYTES);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      chunks.push(value.slice(0, Math.max(0, value.byteLength - (total - MAX_BYTES))));
      try { await reader.cancel(); } catch { /* ignore */ }
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}
