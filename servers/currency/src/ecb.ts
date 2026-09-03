import { withFileLock } from "@theluckystrike/mcp-license";
import {
  dailyPath, historyPath, loadDaily, loadHistory, lockPath, writeJsonFile,
  type DailyCache, type HistoryCache, type RateMap,
} from "./store.js";

/** Overridable so the test suite can serve the fixture XML from localhost and never touch the network. */
export function baseUrl(): string {
  return (process.env.ECB_BASE_URL || "https://www.ecb.europa.eu/stats/eurofxref").replace(/\/+$/, "");
}

export const DAILY_URL = () => `${baseUrl()}/eurofxref-daily.xml`;
export const HISTORY_URL = () => `${baseUrl()}/eurofxref-hist.xml`;

/**
 * Deadlines are total: the clock covers connect, headers AND the whole body, because a
 * stalled body is the failure that matters (headers arrive in milliseconds, the 6 MB
 * history is the part that hangs). The abort controller is not cleared until the last
 * byte is read.
 */
export const TIMEOUT_MS = 20_000;
/** eurofxref-hist.xml is ~6 MB, so the body needs a longer total deadline than the daily file. */
export const HISTORY_TIMEOUT_MS = 60_000;
/** eurofxref-hist.xml is about 6 MB. The cap is generous enough for a decade of growth and still bounded. */
export const MAX_BYTES = 40 * 1024 * 1024;

/** Daily rates are refreshed when the cache is older than this. ECB publishes once a day. */
export const DAILY_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** The full history only gains one row a day, so a day-old copy is never wrong about the past. */
export const HISTORY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const PUBLISH_NOTE =
  "ECB reference rates are published around 16:00 CET on TARGET business days; there is no rate for a weekend or a TARGET holiday.";

/**
 * The lock is held for the whole download, so the lock lease must outlast the longest
 * body deadline; otherwise a slow download loses the lock while it is still running, a
 * second process refreshes, and the first one's older response lands last and overwrites
 * the newer cache. LOCK_TIMEOUT_MS >= HISTORY_TIMEOUT_MS is the invariant, asserted at
 * load time. The freshness guards in getDaily/getHistory are the second line of defence:
 * even if a write did land out of order it cannot move the cache backwards.
 */
export const LOCK_TIMEOUT_MS = 90_000;
if (LOCK_TIMEOUT_MS < HISTORY_TIMEOUT_MS) {
  throw new Error("LOCK_TIMEOUT_MS must be at least HISTORY_TIMEOUT_MS: the lock is held across the whole body download.");
}

export class EcbError extends Error {}

/* ---------------------------------------------------------------------- parse */

/**
 * The ECB file is a fixed, machine-generated shape:
 *   <Cube time='2026-09-02'><Cube currency='USD' rate='1.0812'/>...</Cube>
 * so it is read with two scans rather than by pulling in an XML parser as a dependency
 * (CONVENTIONS: no native deps, and every added package is another supply chain).
 * Both single and double quotes are accepted because the daily and the historical file
 * have not always agreed on which they use.
 */
const TIME_RE = /<Cube\b[^>]*\btime=["'](\d{4}-\d{2}-\d{2})["'][^>]*>/g;
const RATE_RE = /<Cube\b[^>]*\bcurrency=["']([A-Za-z]{3})["'][^>]*\brate=["']([^"']+)["']/g;

export interface ParsedDay { date: string; rates: RateMap }

/** Every <Cube time=...> block in the document, oldest-first order not assumed. */
/**
 * The ECB serves a complete document or nothing; a body that stops mid-stream (a dropped
 * connection, a truncating proxy) still parses, because the file is newest-day-first and the
 * head of it is valid XML. Parsing it and keeping it silently replaces a full history with its
 * newest few days. The closing envelope tag is the only in-band proof the body is complete.
 */
export function assertComplete(xml: string): void {
  if (!/<\/(?:\w+:)?Envelope\s*>\s*$/.test(xml.trimEnd())) {
    throw new EcbError("the ECB download ended without its closing </Envelope> tag, so it was truncated in transit; the cached copy was kept.");
  }
}

export function parseEcbXml(xml: string): ParsedDay[] {
  const marks: { date: string; at: number }[] = [];
  TIME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TIME_RE.exec(xml))) marks.push({ date: m[1], at: m.index });
  if (!marks.length) throw new EcbError("the ECB file held no dated rate block; the download was truncated or is not the eurofxref file.");

  const out: ParsedDay[] = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].at;
    const end = i + 1 < marks.length ? marks[i + 1].at : xml.length;
    const slice = xml.slice(start, end);
    const rates: RateMap = {};
    RATE_RE.lastIndex = 0;
    let r: RegExpExecArray | null;
    while ((r = RATE_RE.exec(slice))) {
      const code = r[1].toUpperCase();
      const value = Number(r[2]);
      // "N/A" appears in the historical file for a currency that was not quoted that day.
      if (Number.isFinite(value) && value > 0) rates[code] = value;
    }
    out.push({ date: marks[i].date, rates });
  }
  return out;
}

/* ---------------------------------------------------------------------- fetch */

export async function fetchText(url: string, totalTimeoutMs: number = TIMEOUT_MS): Promise<string> {
  const ctrl = new AbortController();
  // One deadline for the whole exchange. It is armed before the request and disarmed only
  // after the body is fully read, so a server that sends headers and then stalls is aborted
  // instead of holding the refresh lock open indefinitely.
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, totalTimeoutMs);
  const secs = Math.round(totalTimeoutMs / 1000);
  const fail = (e: unknown): EcbError => {
    if (timedOut || (e as Error)?.name === "AbortError") {
      return new EcbError(`the ECB did not finish sending ${url} within ${secs}s`);
    }
    return new EcbError(`could not reach the ECB (${(e as Error)?.message ?? "network error"})`);
  };
  try {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "follow",
        signal: ctrl.signal,
        headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.8", "user-agent": "mcp-currency (+https://github.com/theluckystrike/mcp-servers)" },
      });
    } catch (e) {
      throw fail(e);
    }
    if (!res.ok) throw new EcbError(`the ECB returned HTTP ${res.status} for ${url}`);
    const body = res.body;
    if (!body) {
      try { return (await res.text()).slice(0, MAX_BYTES); } catch (e) { throw fail(e); }
    }
    const reader = body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (e) {
        throw fail(e);
      }
      if (chunk.done) break;
      const value = chunk.value;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        try { await reader.cancel(); } catch { /* ignore */ }
        throw new EcbError(`the ECB file exceeded ${MAX_BYTES / 1048576} MB; refusing to buffer it.`);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------- refresh */

function ageMs(fetchedAt: string): number {
  const t = Date.parse(fetchedAt);
  return Number.isFinite(t) ? Date.now() - t : Number.POSITIVE_INFINITY;
}

export interface Loaded<T> {
  data: T;
  /** true when this call went to the network */
  refreshed: boolean;
  /** set when the network was tried and failed but a usable cache was on disk */
  offline_note?: string;
}

/**
 * Read-through cache. The cache is authoritative whenever it is fresh, so the second
 * call of a session and every call on a plane cost nothing. When the network fails and
 * a cache exists the cache is used and the answer says how old it is: a stale rate that
 * announces its date is useful, a refusal is not.
 */
async function readThrough<T extends { fetched_at: string }>(
  label: string,
  maxAgeMs: number,
  read: () => T | undefined,
  file: string,
  build: () => Promise<T>,
): Promise<Loaded<T>> {
  const cached = read();
  if (cached && ageMs(cached.fetched_at) < maxAgeMs) return { data: cached, refreshed: false };
  try {
    // The lock makes two processes refreshing at once leave exactly one valid cache:
    // the second re-reads inside the lock and skips the download the first just did.
    return await withFileLock(lockPath(), async () => {
      const again = read();
      if (again && ageMs(again.fetched_at) < maxAgeMs) return { data: again, refreshed: false };
      const built = await build();
      writeJsonFile(file, built);
      return { data: built, refreshed: true };
    }, { timeoutMs: LOCK_TIMEOUT_MS });
  } catch (e) {
    if (cached) {
      return {
        data: cached,
        refreshed: false,
        offline_note: `could not refresh the ${label} from the ECB (${(e as Error).message}); using the copy cached at ${cached.fetched_at}.`,
      };
    }
    throw e;
  }
}

/** loadDaily/loadHistory throw on a corrupt file; for a guard, "no readable cache" is the answer. */
function safe<T>(read: () => T | undefined): T | undefined {
  try { return read(); } catch { return undefined; }
}

/** The newest rate date in a history cache, or undefined when it holds none. */
export function latestDay(days: Record<string, RateMap>): string | undefined {
  let latest: string | undefined;
  for (const d of Object.keys(days)) if (latest === undefined || d > latest) latest = d;
  return latest;
}

export function getDaily(): Promise<Loaded<DailyCache>> {
  return readThrough<DailyCache>("daily rates", DAILY_MAX_AGE_MS, loadDaily, dailyPath(), async () => {
    const xml = await fetchText(DAILY_URL(), TIMEOUT_MS);
    assertComplete(xml);
    const days = parseEcbXml(xml);
    const latest = days.reduce((a, b) => (a.date >= b.date ? a : b));
    if (!Object.keys(latest.rates).length) throw new EcbError("the ECB daily file held a date but no rates.");
    // A response that was in flight while another process refreshed can land last. The rate
    // date only ever moves forward, so a download older than what is already cached is a stale
    // response, never a correction, and must not replace the newer file.
    const have = safe(loadDaily);
    if (have && have.date > latest.date) {
      throw new EcbError(`the ECB daily download was for ${latest.date} but the cache already holds ${have.date}; it was a stale response, so the cached copy was kept.`);
    }
    return { version: 1, fetched_at: new Date().toISOString(), date: latest.date, rates: latest.rates };
  });
}

export function getHistory(): Promise<Loaded<HistoryCache>> {
  return readThrough<HistoryCache>("rate history", HISTORY_MAX_AGE_MS, loadHistory, historyPath(), async () => {
    const xml = await fetchText(HISTORY_URL(), HISTORY_TIMEOUT_MS);
    assertComplete(xml);
    const days = parseEcbXml(xml);
    const map: Record<string, RateMap> = {};
    for (const d of days) if (Object.keys(d.rates).length) map[d.date] = d.rates;
    if (!Object.keys(map).length) throw new EcbError("the ECB history file held no rates.");
    // The series only ever grows, in both directions that can be checked: the number of rate
    // days, and the newest date in it. A refresh that shrinks either one is a truncated body or
    // a stale response that lost a race with a concurrent refresh - never history being revised -
    // and must not replace a good cache.
    const cached = safe(loadHistory)?.days ?? {};
    const have = Object.keys(cached).length;
    const got = Object.keys(map).length;
    if (have && got < have) {
      throw new EcbError(`the ECB history download held ${got} rate days but the cache already holds ${have}; it was incomplete, so the cached copy was kept.`);
    }
    const haveLatest = latestDay(cached), gotLatest = latestDay(map);
    if (haveLatest && gotLatest && gotLatest < haveLatest) {
      throw new EcbError(`the ECB history download ended at ${gotLatest} but the cache already reaches ${haveLatest}; it was a stale response, so the cached copy was kept.`);
    }
    return { version: 1, fetched_at: new Date().toISOString(), days: map };
  });
}
