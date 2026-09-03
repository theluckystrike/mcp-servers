import { Buffer } from "node:buffer";
import { withFileLock } from "../../shims/license.js";
import {
  dailyPath, historyPath, loadDaily, loadHistory, lockPath, writeJsonFile,
  type DailyCache, type HistoryCache, type RateMap,
} from "./store.js";

/** Overridable so the test suite can serve the fixture XML from localhost and never touch the network. */
export const ECB_HOSTS = ["www.ecb.europa.eu", "ecb.europa.eu"];
export function baseUrl(): string { return "https://www.ecb.europa.eu/stats/eurofxref"; }

/** Allowlist, not a denylist: only https://(www.)ecb.europa.eu is ever fetched. */
export function guardEcbUrl(raw: string): void {
  let u: URL;
  try { u = new URL(raw); } catch { throw new EcbError(`${raw} is not a URL.`); }
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (u.protocol !== "https:" || !ECB_HOSTS.includes(host)) {
    throw new EcbError(
      `this hosted endpoint only fetches https://www.ecb.europa.eu (asked for ${u.protocol}//${u.hostname}); nothing was downloaded.`);
  }
}

export const DAILY_URL = () => `${baseUrl()}/eurofxref-daily.xml`;
export const HISTORY_URL = () => `${baseUrl()}/eurofxref-hist.xml`;

export const TIMEOUT_MS = 20_000;
/** eurofxref-hist.xml is about 6 MB. The cap is generous enough for a decade of growth and still bounded. */
export const MAX_BYTES = 40 * 1024 * 1024;

/** Daily rates are refreshed when the cache is older than this. ECB publishes once a day. */
export const DAILY_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** The full history only gains one row a day, so a day-old copy is never wrong about the past. */
export const HISTORY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const PUBLISH_NOTE =
  "ECB reference rates are published around 16:00 CET on TARGET business days; there is no rate for a weekend or a TARGET holiday.";

/**
 * The refresh lock is held across the download, and eurofxref-hist.xml is ~6 MB, so the
 * 5 s default would time a second process out while the first is still downloading. A
 * lock older than 30 s is reaped as abandoned; if a download really runs that long both
 * processes write, and because every write is tmp + rename the cache is still exactly
 * one valid file either way.
 */
export const LOCK_TIMEOUT_MS = 60_000;

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

async function fetchText(url: string): Promise<string> {
  guardEcbUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.8", "user-agent": "mcp-currency (+https://github.com/theluckystrike/mcp-servers)" },
    });
  } catch (e) {
    clearTimeout(timer);
    const msg = (e as Error)?.name === "AbortError"
      ? `the ECB did not answer within ${Math.round(TIMEOUT_MS / 1000)}s`
      : `could not reach the ECB (${(e as Error)?.message ?? "network error"})`;
    throw new EcbError(msg);
  }
  clearTimeout(timer);
  if (!res.ok) throw new EcbError(`the ECB returned HTTP ${res.status} for ${url}`);
  const body = res.body;
  if (!body) return (await res.text()).slice(0, MAX_BYTES);
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new EcbError(`the ECB file exceeded ${MAX_BYTES / 1048576} MB; refusing to buffer it.`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
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

export function getDaily(): Promise<Loaded<DailyCache>> {
  return readThrough<DailyCache>("daily rates", DAILY_MAX_AGE_MS, loadDaily, dailyPath(), async () => {
    const xml = await fetchText(DAILY_URL());
    assertComplete(xml);
    const days = parseEcbXml(xml);
    const latest = days.reduce((a, b) => (a.date >= b.date ? a : b));
    if (!Object.keys(latest.rates).length) throw new EcbError("the ECB daily file held a date but no rates.");
    return { version: 1, fetched_at: new Date().toISOString(), date: latest.date, rates: latest.rates };
  });
}

export function getHistory(): Promise<Loaded<HistoryCache>> {
  return readThrough<HistoryCache>("rate history", HISTORY_MAX_AGE_MS, loadHistory, historyPath(), async () => {
    const xml = await fetchText(HISTORY_URL());
    assertComplete(xml);
    const days = parseEcbXml(xml);
    const map: Record<string, RateMap> = {};
    for (const d of days) if (Object.keys(d.rates).length) map[d.date] = d.rates;
    if (!Object.keys(map).length) throw new EcbError("the ECB history file held no rates.");
    // The series only ever grows. A refresh that returns fewer days than the copy already on
    // disk is a bad download, not history being revised, and must not replace a good cache.
    const have = Object.keys(loadHistory()?.days ?? {}).length;
    if (have && Object.keys(map).length < have) {
      throw new EcbError(`the ECB history download held ${Object.keys(map).length} rate days but the cache already holds ${have}; it was incomplete, so the cached copy was kept.`);
    }
    return { version: 1, fetched_at: new Date().toISOString(), days: map };
  });
}
