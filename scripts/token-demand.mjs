#!/usr/bin/env node
/**
 * token-demand.mjs -- what rank would we land at, for a token, if we published today.
 *
 * The registry's `search=` is not a search engine. Measured in docs/NAMING_R5_RESULT.md and
 * re-confirmed here by a positive and a negative control:
 *
 *   - it matches a SUBSTRING of the full `name` field only (`<namespace>/<local-name>`),
 *     never the description;
 *   - it returns rows in strict ASCII order on that whole name string, case-sensitive, so
 *     uppercase A-Z sorts before lowercase a-z;
 *   - it is cursor-paginated, `metadata.nextCursor` = "<name>:<version>" of the last row.
 *
 * Two consequences drive every number below.
 *
 * 1. Our namespace segment `io.github.theluckystrike` is compared BEFORE the local name is
 *    ever reached. So the local name only reorders us WITHIN our own cluster. It cannot move
 *    us ahead of one single competing namespace. The rank we would land at for a token is
 *    therefore arithmetic on live data, not a guess: it is 1 + the number of rows whose name
 *    sorts strictly before the string "io.github.theluckystrike/".
 *
 * 2. ONE PAGE IS AN UNDERCOUNT. A prior round was burned by reading `metadata.count` off page
 *    one and calling it the total; that field is the row count of the page (max = limit), not
 *    the size of the corpus. `pdf` shows 100 on page one and has 323 rows. Every count here
 *    is produced by paginating to exhaustion.
 *
 * Rows are per stored VERSION, not per server -- `com.hellobasestation/pdfkit` is three rows.
 * Both are reported: `rows` is what the sort actually orders and therefore what sets our
 * rank, `servers` is the distinct-name count and is the honest measure of how many other
 * people are attempting the job.
 *
 * Usage:
 *   node scripts/token-demand.mjs <token> [<token> ...]      one-off probe, human readable
 *   node scripts/token-demand.mjs --json <token> ...         machine readable to stdout
 *   node scripts/token-demand.mjs --file tokens.txt          one token per line
 *   node scripts/token-demand.mjs --controls                 run the two search-semantics controls
 *
 * Env: MCP_REGISTRY (default https://registry.modelcontextprotocol.io), TOKEN_DEMAND_DELAY_MS.
 */

const REGISTRY = process.env.MCP_REGISTRY || "https://registry.modelcontextprotocol.io";
const OURS = "io.github.theluckystrike";
/** The exact string a new server of ours would sort as, before its local name is compared. */
export const OUR_PREFIX = `${OURS}/`;
const DELAY_MS = Number(process.env.TOKEN_DEMAND_DELAY_MS || 120);
const PAGE = 100;
/** A hard stop, so a registry that returns a cursor forever cannot spin this script. */
const MAX_PAGES = 60;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e;
      await sleep(400 * (i + 1));
    }
  }
  throw new Error(`GET ${url}: ${last?.message || last}`);
}

/**
 * Every row the registry holds for a token, in the order it serves them.
 *
 * The cursor loop is the whole point of this function. It also guards against a cursor that
 * does not advance (same value twice) and against a page that repeats a name+version pair,
 * either of which would otherwise loop until the process is killed.
 */
export async function fetchAll(token) {
  const rows = [];
  let cursor = null;
  let pages = 0;
  const seenCursors = new Set();
  for (;;) {
    const u = new URL("/v0/servers", REGISTRY);
    u.searchParams.set("search", token);
    u.searchParams.set("limit", String(PAGE));
    if (cursor) u.searchParams.set("cursor", cursor);
    const body = await getJson(u.toString());
    const page = Array.isArray(body.servers) ? body.servers : [];
    pages += 1;
    for (const r of page) {
      const s = r.server || r;
      rows.push({ name: s.name, version: s.version, description: s.description || "" });
    }
    const next = body.metadata && body.metadata.nextCursor;
    if (!next || page.length === 0) break;
    if (seenCursors.has(next)) break;          // cursor did not advance
    seenCursors.add(next);
    if (pages >= MAX_PAGES) {
      throw new Error(`${token}: still paginating after ${MAX_PAGES} pages (${rows.length} rows) -- refusing to guess a total`);
    }
    cursor = next;
    await sleep(DELAY_MS);
  }
  return { rows, pages };
}

/** Strict ASCII byte order, the comparison the registry itself applies. */
export function asciiLess(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a.charCodeAt(i), y = b.charCodeAt(i);
    if (x !== y) return x < y;
  }
  return a.length < b.length;
}

/**
 * The report for one token.
 *
 * `rank` is where our FIRST row would land: 1 + rows sorting strictly before our namespace
 * prefix. `page1` is whether that rank is <= 100, i.e. whether a client that shows one page
 * would ever render us. `visible_p` reuses the estate's own visibility model from
 * data/registry_rank.json -- p = min(1, 10/rank) if we land on page one, else 0 -- so a
 * number here is comparable with every earlier round's.
 */
export async function probe(token) {
  const { rows, pages } = await fetchAll(token);
  const names = rows.map((r) => r.name);
  const sortedAsServed = names.every((n, i) => i === 0 || !asciiLess(n, names[i - 1]));
  const before = names.filter((n) => asciiLess(n, OUR_PREFIX)).length;
  const distinct = new Set(names);
  const oursExisting = [...distinct].filter((n) => n.startsWith(OUR_PREFIX)).sort();
  const rank = before + 1;
  return {
    token,
    pages,
    rows: rows.length,
    servers: distinct.size,
    sorted_as_served: sortedAsServed,
    rows_before_us: before,
    landing_rank: rank,
    page1: rank <= 100,
    visible_p: rank <= 100 ? Math.min(1, 10 / rank) : 0,
    ours_already_matching: oursExisting,
    /** Distinct namespaces attempting this token: the competition count, deduped by publisher. */
    namespaces: new Set(names.map((n) => n.split("/")[0])).size,
    top3: [...distinct].slice(0, 3),
  };
}

/**
 * The two controls that prove the instrument before any zero from it is believed.
 *  positive: a substring that exists ONLY in a namespace must still return that namespace's rows.
 *  negative: a word that exists ONLY in a description must NOT return the server carrying it.
 * A run where the positive control returns 0 means the API changed and every number is void.
 */
async function controls() {
  const pos = await fetchAll("theluckystrike");
  const neg = await fetchAll("offline");
  const negHasOurs = neg.rows.some((r) => r.name.startsWith(OUR_PREFIX) && /offline/i.test(r.description));
  const ok = pos.rows.length > 0 && !negHasOurs;
  return {
    positive_control: { query: "theluckystrike", rows: pos.rows.length, expect: ">0", pass: pos.rows.length > 0 },
    negative_control: { query: "offline", rows: neg.rows.length, expect: "no io.github.theluckystrike row matched on description text", pass: !negHasOurs },
    instrument_trusted: ok,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  let tokens = argv.filter((a) => !a.startsWith("--"));
  const fi = argv.indexOf("--file");
  if (fi !== -1 && argv[fi + 1]) {
    const { readFileSync } = await import("node:fs");
    tokens = readFileSync(argv[fi + 1], "utf8").split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
  }
  if (argv.includes("--controls")) {
    const c = await controls();
    console.log(JSON.stringify(c, null, 2));
    if (!c.instrument_trusted) process.exitCode = 1;
    if (!tokens.length) return;
  }
  if (!tokens.length) {
    console.error("usage: node scripts/token-demand.mjs [--json] [--controls] <token> [...]");
    process.exitCode = 2;
    return;
  }
  const out = [];
  for (const t of tokens) {
    try {
      const r = await probe(t);
      out.push(r);
      if (!json) {
        console.log(
          `${t.padEnd(22)} rows=${String(r.rows).padStart(4)} servers=${String(r.servers).padStart(4)} ` +
          `ns=${String(r.namespaces).padStart(3)} pages=${r.pages} before=${String(r.rows_before_us).padStart(4)} ` +
          `-> rank ${r.landing_rank}${r.page1 ? "" : " (OFF PAGE 1)"}` +
          (r.ours_already_matching.length ? `  [we already match: ${r.ours_already_matching.length}]` : "")
        );
      }
    } catch (e) {
      out.push({ token: t, error: String(e.message || e) });
      if (!json) console.log(`${t.padEnd(22)} ERROR ${e.message || e}`);
    }
    await sleep(DELAY_MS);
  }
  if (json) console.log(JSON.stringify(out, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
