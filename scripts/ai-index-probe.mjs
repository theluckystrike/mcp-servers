#!/usr/bin/env node
// ai-index-probe.mjs — measure whether our domains appear in the search indexes that
// AI assistants actually retrieve from (Claude web search -> Brave; ChatGPT -> Bing;
// Perplexity -> its own crawler).
//
// The design rule that matters: an endpoint is UNMEASURED until it passes its controls.
// A zero from an unmeasured endpoint is not a zero, and this script refuses to print it
// as one. Two controls per endpoint:
//
//   1. LIVENESS   — a query whose answer is not in doubt must return the known domain.
//   2. DISCRIMINATION — two unrelated queries must return DIFFERENT result sets.
//      Without this, an endpoint that ignores the query and serves one canned set
//      passes liveness by accident. Bing's RSS endpoint does exactly that, which is
//      why it is disqualified below rather than reported as "found nothing of ours".
//   3. SITE (only for endpoints used in site: mode) — site:github.com must return
//      github.com URLs and nothing else, proving the operator is honoured.
//
// Usage:
//   node scripts/ai-index-probe.mjs                 # controls + full measurement
//   node scripts/ai-index-probe.mjs --controls-only # qualify endpoints, measure nothing
//   node scripts/ai-index-probe.mjs --out data/ai_index_r1.json
//
// No API keys, no accounts, no paid endpoints.

import { writeFileSync, readdirSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const argOut = (() => {
  const i = process.argv.indexOf("--out");
  return i > -1 ? process.argv[i + 1] : `${ROOT}/data/ai_index_r1.json`;
})();
const CONTROLS_ONLY = process.argv.includes("--controls-only");
// --only brave,bing_rss  — qualify and measure just these endpoints. The full ten-way
// sweep spends most of its wall clock re-confirming captchas on endpoints already
// recorded as blocked, which is worth doing once, not on every re-run.
const ONLY = (() => {
  const i = process.argv.indexOf("--only");
  return i > -1 ? new Set(process.argv[i + 1].split(",").map((x) => x.trim())) : null;
})();
// Per-endpoint politeness. Brave rate-limits hard under a tight sequential loop and a
// 429 body parses as zero results, which would manufacture a false absence.
const DELAY_MS = 2500;
// Brave measured at ~2 requests per 24s window before it starts returning 429; 30s
// keeps a long run inside it. Raising this is cheaper than a run full of soft-blocks.
const EP_DELAY = { brave: 30000, ddg_html: 7000, marginalia: 6000, bing_rss: 3000, bing_html: 3000 };
const epDelay = (id) => EP_DELAY[id] ?? DELAY_MS;
// Retry budget. Endpoints that answer every scripted request with a challenge page
// (measured below) get a smaller budget: their failure still has to be RECORDED with
// evidence, but spending 4 backed-off attempts to re-confirm a captcha wastes the run.
const EP_ATTEMPTS = { mojeek: 2, startpage: 2, ecosia: 2, yandex: 2, seznam: 2, ddg_html: 2 };
const epAttempts = (id) => EP_ATTEMPTS[id] ?? 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const usable = (r) => r.ok && r.status === 200 && !r.soft_block;

// ---------------------------------------------------------------- fetching

/** True when a 200 body is actually a challenge/backoff page rather than results. */
function isSoftBlock(status, body) {
  if (status === 202 || status === 429 || status === 403 || status === 503) return true;
  const head = body.slice(0, 4000);
  return (
    /Wait For A Moment|currently barraged/i.test(head) ||          // Marginalia backoff
    /anubis_challenge/i.test(head) ||                              // Startpage
    /confirm this search was made by a human|Select all squares/i.test(head) || // DDG
    /JavaScript is required to complete this challenge/i.test(head) ||          // Mojeek
    /Ecosia Firewall/i.test(head)
  );
}

/**
 * GET with backoff, via curl rather than node's fetch.
 *
 * This is not a style choice. Brave returns HTTP 429 to undici (node's fetch) on the
 * very first request regardless of headers — it fingerprints the TLS/HTTP2 client, not
 * the User-Agent — while the identical request from curl returns 200. Measured:
 *   node fetch, full headers -> 429 (73898 bytes)   curl, same UA -> 200 (101264 bytes)
 * Using fetch here would have produced a confident, completely false "mcp.zovo.one is
 * absent from Brave". Shelling out to curl also makes every `command` string recorded
 * in the output a literally reproducible line.
 */
async function get(url, { attempts = 4 } = {}) {
  let last = null;
  for (let a = 0; a < attempts; a++) {
    const t0 = Date.now();
    try {
      const { stdout } = await execFileP(
        "/usr/bin/curl",
        [
          "-sS", "-L", "--max-time", "30",
          "-A", UA,
          "-H", "accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "-H", "accept-language: en-US,en;q=0.9",
          "-w", "\n__HTTP_STATUS__:%{http_code}",
          url,
        ],
        { maxBuffer: 64 * 1024 * 1024, timeout: 45000 },
      );
      const i = stdout.lastIndexOf("__HTTP_STATUS__:");
      const status = i > -1 ? Number(stdout.slice(i + 16).trim()) : 0;
      const body = i > -1 ? stdout.slice(0, i).replace(/\n$/, "") : stdout;
      last = { ok: true, status, body, ms: Date.now() - t0, attempts: a + 1 };
      if (!isSoftBlock(status, body)) return last;
      last.soft_block = true;
    } catch (e) {
      last = { ok: false, status: 0, body: "", error: String(e).slice(0, 200), ms: Date.now() - t0, attempts: a + 1 };
    }
    if (a < attempts - 1) await sleep(5000 * Math.pow(2, a)); // 5s, 10s, 20s
  }
  return last;
}

/** Evidence we can quote in a writeup without pretending. */
const evidence = (r) => ({
  http: r.status,
  bytes: r.body.length,
  first200: r.body.replace(/\s+/g, " ").slice(0, 200),
  attempts: r.attempts ?? 1,
  ...(r.soft_block ? { soft_block: true } : {}),
  ...(r.error ? { error: r.error } : {}),
});

// ---------------------------------------------------------------- parsing

const NAV_HOST =
  /^(?:cdn|imgs|tiles|assets|static|r|th|www)?\.?(?:brave\.com|search\.brave\.com|status\.brave\.app|talk\.brave\.com|account\.brave\.com|bing\.com|r\.bing\.com|th\.bing\.com|go\.microsoft\.com|support\.microsoft\.com|marginalia\.nu|old-search\.marginalia\.nu|marginalia-search\.com|hackerone\.com|mojeek\.com|duckduckgo\.com)$/i;

function hostOf(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Ordered, de-duplicated organic result URLs, chrome removed. */
function organic(urls) {
  const seen = new Set();
  const out = [];
  for (const u of urls) {
    const h = hostOf(u);
    if (!h || NAV_HOST.test(h) || NAV_HOST.test(hostOf(u).replace(/^[a-z]+\./, ""))) continue;
    if (/^(brave\.com|bing\.com|microsoft\.com|marginalia\.nu|marginalia-search\.com|duckduckgo\.com|hackerone\.com)$/i.test(h)) continue;
    const key = u.replace(/[#?].*$/, "").replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

// ---------------------------------------------------------------- endpoints

const ENDPOINTS = {
  brave: {
    id: "brave",
    label: "Brave Search (search.brave.com, HTML)",
    why: "Claude's web search retrieves from Brave. This is the index that matters most here.",
    supportsSite: true,
    url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
    parse(body) {
      // Result anchors are plain absolute hrefs in the server-rendered HTML.
      const urls = [...body.matchAll(/href="(https:\/\/[^"]+)"/g)].map((m) => m[1]);
      return organic(urls);
    },
  },

  bing_rss: {
    id: "bing_rss",
    label: "Bing RSS (www.bing.com/search?format=rss)",
    why: "ChatGPT search retrieves from Bing. This is the only keyless Bing surface that returns parseable results.",
    supportsSite: false,
    url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}&format=rss`,
    parse(body) {
      const urls = [...body.matchAll(/<link>(https?:\/\/[^<]+)<\/link>/g)].map((m) =>
        m[1].replace(/&amp;/g, "&"),
      );
      return organic(urls);
    },
  },

  bing_html: {
    id: "bing_html",
    label: "Bing HTML (www.bing.com/search)",
    why: "Second Bing surface; result URLs are base64 inside /ck/a redirect wrappers.",
    supportsSite: false,
    url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    parse(body) {
      const out = [];
      for (const m of body.matchAll(/u=a1([A-Za-z0-9_-]+)/g)) {
        try {
          const d = Buffer.from(m[1].replace(/_/g, "/").replace(/-/g, "+"), "base64").toString("utf8");
          if (/^https?:\/\//.test(d)) out.push(d);
        } catch {
          /* not a URL payload */
        }
      }
      return organic(out);
    },
  },

  marginalia: {
    id: "marginalia",
    label: "Marginalia Search (old-search.marginalia.nu)",
    why: "Fully independent crawler and index; a presence signal no Bing/Google derivative can give.",
    supportsSite: false,
    url: (q) => `https://old-search.marginalia.nu/search?query=${encodeURIComponent(q)}`,
    parse(body) {
      const urls = [...body.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
      return organic(urls);
    },
  },

  // Kept in the table so the writeup can say exactly how each one refused us,
  // rather than silently omitting them. Their controls are expected to fail.
  ddg_html: {
    id: "ddg_html",
    label: "DuckDuckGo HTML (html.duckduckgo.com/html/)",
    why: "DDG's index is Bing-derived; the html endpoint is historically scriptable.",
    supportsSite: true,
    url: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    parse(body) {
      const urls = [...body.matchAll(/uddg=([^"&]+)/g)].map((m) => decodeURIComponent(m[1]));
      return organic(urls);
    },
  },
  mojeek: {
    id: "mojeek",
    label: "Mojeek (www.mojeek.com/search)",
    why: "Independent crawler and index.",
    supportsSite: true,
    url: (q) => `https://www.mojeek.com/search?q=${encodeURIComponent(q)}`,
    parse(body) {
      const urls = [...body.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
      return organic(urls);
    },
  },
  startpage: {
    id: "startpage",
    label: "Startpage (www.startpage.com/sp/search)",
    why: "Google-derived results without a Google account.",
    supportsSite: true,
    url: (q) => `https://www.startpage.com/sp/search?q=${encodeURIComponent(q)}`,
    parse(body) {
      const urls = [...body.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
      return organic(urls);
    },
  },
  ecosia: {
    id: "ecosia",
    label: "Ecosia (www.ecosia.org/search)",
    why: "Bing-derived index.",
    supportsSite: true,
    url: (q) => `https://www.ecosia.org/search?q=${encodeURIComponent(q)}`,
    parse(body) {
      const urls = [...body.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
      return organic(urls);
    },
  },
  seznam: {
    id: "seznam",
    label: "Seznam (search.seznam.cz)",
    why: "Independent index; an IndexNow recipient.",
    supportsSite: false,
    url: (q) => `https://search.seznam.cz/?q=${encodeURIComponent(q)}`,
    parse(body) {
      const urls = [...body.matchAll(/"url":"(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
      return organic(urls);
    },
  },
  yandex: {
    id: "yandex",
    label: "Yandex (yandex.com/search)",
    why: "Independent index; an IndexNow recipient.",
    supportsSite: true,
    url: (q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}`,
    parse(body) {
      const urls = [...body.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
      return organic(urls);
    },
  },
};

// ---------------------------------------------------------------- controls

// Liveness: unambiguous queries whose correct answer contains a known host.
const LIVENESS = [
  { q: "python asyncio semaphore example", mustContainHost: "docs.python.org" },
  { q: "model context protocol", mustContainHost: "modelcontextprotocol.io" },
];
// Discrimination: two topically disjoint queries. If an endpoint returns the same
// result set for both, it is not reading the query and every "zero" it gives is void.
const DISCRIMINATION = ["sourdough starter hydration ratio", "python asyncio semaphore example"];
// Site operator: must return github.com URLs, and they must dominate.
const SITE_CONTROL = { q: "site:github.com model context protocol", host: "github.com" };
// DOMAIN control. A blind assistant run (docs/BLIND_RECOMMENDATION_R1.md) surfaced the
// mcp.zovo.one homepage for buyer questions at rank 8 and 10, so SOME general index
// holds it. This query is the cheapest way to ask a given endpoint "do you hold it?".
// An endpoint that misses this is unmeasured FOR OUR DOMAIN even if its generic
// controls pass — it cannot be used to claim absence.
const DOMAIN_CONTROL = { q: "MCP servers for Claude invoices time tracking", host: "mcp.zovo.one" };

const jaccard = (a, b) => {
  const A = new Set(a.map((u) => hostOf(u)));
  const B = new Set(b.map((u) => hostOf(u)));
  if (!A.size && !B.size) return 1;
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / (A.size + B.size - inter);
};

async function qualify(ep) {
  const rec = {
    id: ep.id,
    label: ep.label,
    why: ep.why,
    controls: {},
    verdict: "UNMEASURED",
    reasons: [],
    site_mode: "UNMEASURED",
  };

  // --- liveness
  const liveResults = [];
  for (const c of LIVENESS) {
    const url = ep.url(c.q);
    const r = await get(url);
    const results = usable(r) ? ep.parse(r.body) : [];
    const hit = results.some((u) => hostOf(u).endsWith(c.mustContainHost));
    rec.controls[`liveness:${c.q}`] = {
      command: `curl -sS -A "<chrome-ua>" '${url}'`,
      ...evidence(r),
      results_parsed: results.length,
      must_contain_host: c.mustContainHost,
      pass: Boolean(hit),
      top5: results.slice(0, 5),
    };
    liveResults.push({ q: c.q, results });
    if (!hit)
      rec.notes = (rec.notes || []).concat(
        `liveness miss for "${c.q}": ${c.mustContainHost} absent (HTTP ${r.status}, ${r.body.length} bytes${r.soft_block ? ", soft-block" : ""})`,
      );
    await sleep(epDelay(ep.id));
  }
  // ANY, not EVERY: a single query can parse zero because of an answer-card layout
  // while the endpoint is perfectly healthy. One unambiguous hit proves it returns
  // real, relevant results; DISCRIMINATION below proves it is reading the query.
  const livenessPass = LIVENESS.some((c) => rec.controls[`liveness:${c.q}`].pass);

  // --- discrimination (only meaningful if something parsed at all)
  const [qa, qb] = DISCRIMINATION;
  const ra = liveResults.find((x) => x.q === qa)?.results ?? null;
  const rb = liveResults.find((x) => x.q === qb)?.results ?? null;
  let a = ra, b = rb;
  if (!a) {
    const r = await get(ep.url(qa), { attempts: epAttempts(ep.id) });
    a = usable(r) ? ep.parse(r.body) : [];
    await sleep(epDelay(ep.id));
  }
  if (!b) {
    const r = await get(ep.url(qb), { attempts: epAttempts(ep.id) });
    b = usable(r) ? ep.parse(r.body) : [];
    await sleep(epDelay(ep.id));
  }
  const sim = jaccard(a, b);
  const discPass = a.length > 0 && b.length > 0 && sim < 0.5;
  rec.controls.discrimination = {
    query_a: qa,
    query_b: qb,
    hosts_a: [...new Set(a.map(hostOf))].slice(0, 10),
    hosts_b: [...new Set(b.map(hostOf))].slice(0, 10),
    host_jaccard: Number(sim.toFixed(3)),
    threshold: "< 0.5",
    pass: discPass,
  };
  if (!discPass) {
    rec.reasons.push(
      a.length === 0 || b.length === 0
        ? "discrimination FAILED: one or both queries parsed zero results"
        : `discrimination FAILED: two unrelated queries returned host-overlap ${sim.toFixed(3)} — endpoint is not reading the query`,
    );
  }

  if (!livenessPass)
    rec.reasons.push(
      `liveness FAILED: no control query returned its known host across ${LIVENESS.length} attempts (${(rec.notes || []).join("; ")})`,
    );
  rec.verdict = livenessPass && discPass ? "MEASURABLE" : "UNMEASURED";

  // --- site operator, only worth testing on a measurable endpoint
  if (rec.verdict === "MEASURABLE" && ep.supportsSite) {
    const url = ep.url(SITE_CONTROL.q);
    const r = await get(url, { attempts: epAttempts(ep.id) });
    const results = usable(r) ? ep.parse(r.body) : [];
    const onHost = results.filter((u) => hostOf(u).endsWith(SITE_CONTROL.host));
    const ratio = results.length ? onHost.length / results.length : 0;
    const pass = onHost.length >= 3 && ratio >= 0.5;
    rec.controls.site_operator = {
      command: `curl -sS -A "<chrome-ua>" '${url}'`,
      ...evidence(r),
      results_parsed: results.length,
      on_host: onHost.length,
      on_host_ratio: Number(ratio.toFixed(3)),
      threshold: ">=3 on-host AND ratio >=0.5",
      pass,
    };
    rec.site_mode = !usable(r) ? "UNMEASURED" : pass ? "SUPPORTED" : "IGNORED_BY_ENDPOINT";
    if (!pass)
      rec.reasons.push(
        `site: operator IGNORED — site:${SITE_CONTROL.host} returned ${onHost.length}/${results.length} on-host URLs. Any site: zero from this endpoint is void.`,
      );
    await sleep(DELAY_MS);
  } else if (ep.supportsSite) {
    rec.site_mode = "UNMEASURED";
  } else {
    rec.site_mode = "NOT_ATTEMPTED";
  }

  // --- domain control: does this endpoint hold mcp.zovo.one AT ALL?
  if (rec.verdict === "MEASURABLE") {
    const url = ep.url(DOMAIN_CONTROL.q);
    const r = await get(url, { attempts: epAttempts(ep.id) });
    const results = usable(r) ? ep.parse(r.body) : [];
    const hit = results.findIndex((u) => hostOf(u) === DOMAIN_CONTROL.host);
    rec.controls.domain_control = {
      query: DOMAIN_CONTROL.q,
      command: `curl -sS -A "<chrome-ua>" '${url}'`,
      ...evidence(r),
      results_parsed: results.length,
      must_contain_host: DOMAIN_CONTROL.host,
      rank: hit > -1 ? hit + 1 : null,
      pass: hit > -1,
      note:
        hit > -1
          ? "endpoint holds mcp.zovo.one — a zero from it elsewhere is a real ranking zero"
          : "endpoint did NOT return mcp.zovo.one for a query the homepage title matches almost verbatim; treat this endpoint as UNMEASURED FOR OUR DOMAIN, not as evidence of absence",
    };
    rec.holds_our_domain = hit > -1;
    if (hit === -1) rec.reasons.push("domain control FAILED: cannot be used to claim mcp.zovo.one is absent");
    await sleep(DELAY_MS);
  } else {
    rec.holds_our_domain = null;
  }

  return rec;
}

// ---------------------------------------------------------------- queries

const OURS = [
  { label: "mcp.zovo.one", test: (h, u) => h === "mcp.zovo.one" },
  { label: "zovo.one", test: (h) => h === "zovo.one" },
  { label: "github.com/theluckystrike", test: (h, u) => h === "github.com" && /\/theluckystrike\//i.test(u) },
  { label: "registry row", test: (h, u) => /registry\.modelcontextprotocol\.io|glama\.ai|mcpindex\.ai|pulsemcp\.com|mcp\.so|smithery\.ai/.test(h) && /zovo|theluckystrike/i.test(u) },
];

/**
 * DEPTH. "Is the host present" and "how many of its URLs are retrievable" are
 * different questions and only the second makes a channel. Three independent
 * probes, unioned:
 *   - site:<domain> paginated (pages 1..N)
 *   - site:<domain>/<section> for each real section of the site
 *   - the sitemap's own URL count as the denominator
 */
async function measureDepth(ep, domain, sitemapCount) {
  const found = new Map(); // url -> how we found it
  const probes = [];

  const onHost = (u) => {
    const h = hostOf(u);
    return h === domain || h.endsWith(`.${domain}`);
  };

  const run = async (label, q, extra = "") => {
    const url = ep.url(q) + extra;
    const r = await get(url, { attempts: epAttempts(ep.id) });
    const results = usable(r) ? ep.parse(r.body) : [];
    const hits = results.filter(onHost);
    for (const u of hits) if (!found.has(u)) found.set(u, label);
    probes.push({
      probe: label,
      query: q + (extra ? ` [${extra}]` : ""),
      command: `curl -sS -A "<chrome-ua>" '${url}'`,
      ...evidence(r),
      results_parsed: results.length,
      on_host: hits.length,
      urls: [...new Set(hits)],
      usable: usable(r),
    });
    await sleep(epDelay(ep.id));
    return hits.length;
  };

  // paginated site: — stop as soon as a page adds nothing, that is the depth floor
  for (let page = 0; page < 4; page++) {
    const before = found.size;
    await run(`site:paginated p${page + 1}`, `site:${domain}`, page ? `&offset=${page}` : "");
    if (found.size === before && page > 0) break;
  }
  // per-section, so "only the homepage" is provable rather than assumed
  for (const sec of ["s", "guides", "setup", "compare", "bundle"]) {
    await run(`section:/${sec}`, `site:${domain}/${sec}`);
  }

  const urls = [...found.keys()].sort();
  const usableProbes = probes.filter((p) => p.usable).length;
  // A blocked probe parses as zero results. If nothing got through, this is
  // UNMEASURED — reporting it as "0 URLs indexed" would be a fabricated absence.
  if (usableProbes === 0) {
    return {
      domain,
      unmeasured: true,
      reason: `all ${probes.length} depth probes were blocked or errored (statuses: ${[...new Set(probes.map((p) => p.http))].join(", ")})`,
      distinct_urls_retrievable: null,
      probes,
    };
  }
  return {
    domain,
    probes_usable: usableProbes,
    probes_total: probes.length,
    distinct_urls_retrievable: urls.length,
    urls,
    sitemap_urls: sitemapCount,
    pct_of_sitemap: sitemapCount ? Number(((urls.length / sitemapCount) * 100).toFixed(2)) : null,
    is_a_channel:
      urls.length === 0 ? "NO — absent" : urls.length <= 2 ? "NO — host present but only " + urls.length + " URL(s); a single page is a listing, not a channel" : "MAYBE — multiple URLs retrievable",
    probes,
  };
}

async function sitemapCount(host) {
  const r = await get(`https://${host}/sitemap.xml`);
  if (!usable(r)) return null;
  return [...r.body.matchAll(/<loc>/g)].length;
}

function classify(results) {
  const found = [];
  results.forEach((u, i) => {
    const h = hostOf(u);
    for (const o of OURS) if (o.test(h, u)) found.push({ which: o.label, rank: i + 1, url: u });
  });
  return found;
}

function buyerQueries() {
  let servers = [];
  try {
    servers = readdirSync(`${ROOT}/servers`, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    /* servers/ absent — fall back to the fixed list below */
  }
  // Hand-written, in the words a buyer would actually type, one per major server.
  const fixed = [
    "mcp server invoice",
    "mcp server pdf merge",
    "claude mcp expense tracker",
    "mcp server generate quotes",
    "mcp timezone meeting planner",
    "mcp server time tracking",
    "mcp server read excel spreadsheet",
    "claude mcp currency converter",
    "mcp server word document docx",
    "mcp server resume builder",
    "mcp server recurring invoices",
    "mcp server bank statement csv",
    "mcp server barcode qr code",
    "mcp server kanban board",
    "mcp server for freelancers",
  ];
  return { queries: fixed, servers_seen: servers.length };
}

// ---------------------------------------------------------------- main

async function main() {
  const out = {
    status: "MEASURED",
    generated_at: new Date().toISOString(),
    instrument: "scripts/ai-index-probe.mjs",
    control_policy:
      "An endpoint is UNMEASURED until it passes liveness AND discrimination. " +
      "site: results are void unless the site_operator control passes. " +
      "A zero from an UNMEASURED endpoint is reported as null, never as absence.",
    endpoints: {},
    site_presence: {},
    buyer_intent: {},
  };

  // 1. Qualify every endpoint.
  const selected = Object.values(ENDPOINTS).filter((e) => !ONLY || ONLY.has(e.id));
  out.endpoints_skipped = Object.values(ENDPOINTS).filter((e) => ONLY && !ONLY.has(e.id)).map((e) => e.id);
  if (out.endpoints_skipped.length)
    out.endpoints_skipped_note = "not probed in this run (--only); skipped is not the same as measured-absent";
  for (const ep of selected) {
    process.stderr.write(`control: ${ep.id} ... `);
    out.endpoints[ep.id] = await qualify(ep);
    process.stderr.write(`${out.endpoints[ep.id].verdict} site=${out.endpoints[ep.id].site_mode}\n`);
  }

  const measurable = selected.filter((e) => out.endpoints[e.id].verdict === "MEASURABLE");
  const siteCapable = measurable.filter((e) => out.endpoints[e.id].site_mode === "SUPPORTED");

  if (CONTROLS_ONLY) {
    writeFileSync(argOut, JSON.stringify(out, null, 2));
    console.log(`controls-only: ${measurable.length} measurable, ${siteCapable.length} site-capable -> ${argOut}`);
    return;
  }

  // 2. Site-restricted presence, only on endpoints that proved they honour site:.
  const DOMAINS = ["mcp.zovo.one", "zovo.one"]; // zovo.one is the positive control domain
  for (const ep of siteCapable) {
    out.site_presence[ep.id] = {};
    for (const dom of DOMAINS) {
      const q = `site:${dom}`;
      const url = ep.url(q);
      const r = await get(url, { attempts: epAttempts(ep.id) });
      const good = usable(r);
      const results = good ? ep.parse(r.body) : [];
      const onHost = results.filter((u) => hostOf(u) === dom || hostOf(u).endsWith(`.${dom}`));
      out.site_presence[ep.id][dom] = {
        query: q,
        command: `curl -sS -A "<chrome-ua>" '${url}'`,
        ...evidence(r),
        // present is deliberately null, never false, when the response was not usable.
        // A throttled body parses as zero and must not be published as absence.
        ...(good
          ? { urls_found: onHost.length, urls: [...new Set(onHost)].sort(), present: onHost.length > 0 }
          : { unmeasured: true, reason: `response not usable (HTTP ${r.status}${r.soft_block ? ", soft-block" : ""}) after ${r.attempts} attempts`, urls_found: null, present: null }),
      };
      process.stderr.write(`site ${ep.id} ${dom}: ${good ? onHost.length + " URL(s)" : "UNMEASURED (HTTP " + r.status + ")"}\n`);
      await sleep(epDelay(ep.id));
    }
  }
  for (const ep of selected) {
    if (out.endpoints[ep.id].site_mode === "SUPPORTED") continue;
    out.site_presence[ep.id] = {
      unmeasured: true,
      reason: out.endpoints[ep.id].reasons.join("; ") || `site: not usable (site_mode=${out.endpoints[ep.id].site_mode})`,
    };
  }

  // 2b. DEPTH — how many distinct URLs of ours will each index actually return.
  //     One indexed URL and 141 indexed URLs are completely different situations;
  //     only the second is a channel.
  const smCount = await sitemapCount("mcp.zovo.one");
  out.sitemap_urls_live = smCount;
  out.depth = {};
  for (const ep of siteCapable) {
    out.depth[ep.id] = {};
    for (const dom of DOMAINS) {
      out.depth[ep.id][dom] = await measureDepth(ep, dom, dom === "mcp.zovo.one" ? smCount : null);
      process.stderr.write(
        `depth ${ep.id} ${dom}: ${out.depth[ep.id][dom].distinct_urls_retrievable} distinct URL(s)\n`,
      );
    }
  }
  for (const ep of selected) {
    if (out.depth[ep.id]) continue;
    out.depth[ep.id] = {
      unmeasured: true,
      reason: out.endpoints[ep.id].reasons.join("; ") || `site: not usable (site_mode=${out.endpoints[ep.id].site_mode})`,
    };
  }

  // 3. Buyer-intent queries on every measurable endpoint.
  const { queries, servers_seen } = buyerQueries();
  out.buyer_intent_meta = { query_count: queries.length, servers_dir_entries: servers_seen };
  for (const ep of measurable) {
    out.buyer_intent[ep.id] = {};
    for (const q of queries) {
      const url = ep.url(q);
      const r = await get(url, { attempts: epAttempts(ep.id) });
      const good = usable(r);
      const results = good ? ep.parse(r.body) : [];
      const top10 = results.slice(0, 10);
      const ours = good ? classify(top10) : null;
      out.buyer_intent[ep.id][q] = {
        command: `curl -sS -A "<chrome-ua>" '${url}'`,
        http: r.status,
        attempts: r.attempts,
        results_parsed: good ? results.length : null,
        top10: good ? top10 : null,
        // null, not [], when we could not see the page. An empty array here would
        // read as "we looked and we were not there".
        ours_in_top10: ours,
        ...(good ? { zero_results: results.length === 0 } : { unmeasured: true, reason: `response not usable (HTTP ${r.status}${r.soft_block ? ", soft-block" : ""}) after ${r.attempts} attempts` }),
      };
      process.stderr.write(`${ep.id} "${q}": ${good ? results.length + " results, ours=" + ours.length : "UNMEASURED (HTTP " + r.status + ")"}\n`);
      await sleep(epDelay(ep.id));
    }
  }
  for (const ep of selected) {
    if (out.buyer_intent[ep.id]) continue;
    out.buyer_intent[ep.id] = { unmeasured: true, reason: out.endpoints[ep.id].reasons.join("; ") };
  }

  // 4. Roll-up a reader can act on.
  const presentIn = [];
  for (const [epId, doms] of Object.entries(out.site_presence)) {
    if (doms.unmeasured) continue;
    if (doms["mcp.zovo.one"]?.present) presentIn.push(`${epId} (${doms["mcp.zovo.one"].urls_found} URL(s))`);
  }
  let buyerHits = 0, buyerMeasured = 0, buyerUnmeasured = 0;
  for (const per of Object.values(out.buyer_intent)) {
    if (per.unmeasured) continue;
    for (const v of Object.values(per)) {
      if (v.ours_in_top10 === null) { buyerUnmeasured++; continue; }
      buyerMeasured++;
      buyerHits += v.ours_in_top10.length;
    }
  }
  const depthRoll = {};
  for (const [epId, doms] of Object.entries(out.depth || {})) {
    if (doms.unmeasured) continue;
    for (const [dom, d] of Object.entries(doms)) {
      depthRoll[`${epId}:${dom}`] = d.unmeasured ? "UNMEASURED" : d.distinct_urls_retrievable;
    }
  }
  out.summary = {
    endpoints_tested: selected.length,
    endpoints_defined: Object.keys(ENDPOINTS).length,
    endpoints_measurable: measurable.map((e) => e.id),
    endpoints_unmeasured: Object.values(out.endpoints).filter((e) => e.verdict !== "MEASURABLE").map((e) => e.id),
    endpoints_site_capable: siteCapable.map((e) => e.id),
    mcp_zovo_one_present_in: presentIn,
    buyer_intent_top10_hits_total: buyerHits,
    buyer_intent_queries: queries.length,
    buyer_intent_query_runs_measured: buyerMeasured,
    buyer_intent_query_runs_unmeasured: buyerUnmeasured,
    depth_distinct_urls: depthRoll,
    endpoints_holding_our_domain: Object.values(out.endpoints).filter((e) => e.holds_our_domain).map((e) => e.id),
    endpoints_that_cannot_prove_absence: Object.values(out.endpoints)
      .filter((e) => e.holds_our_domain === false || e.verdict !== "MEASURABLE")
      .map((e) => e.id),
  };

  writeFileSync(argOut, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out.summary, null, 2));
  console.log(`\nwrote ${argOut}`);
}

await main();
