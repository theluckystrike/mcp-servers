#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createLicenseGate } from "@theluckystrike/mcp-license";
import { VERSION } from "./version.js";

const FREE_URL_LIMIT = 3;

const gate = createLicenseGate({ product: "backlink-checker" });

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
const text = (t: string): ToolResult => ({ content: [{ type: "text", text: t }] });
const fail = (t: string): ToolResult => ({ content: [{ type: "text", text: `Error: ${t}` }], isError: true });

interface CheckResult {
  url: string;
  status: number | null;
  error?: string;
  contentType?: string;
  noindex: boolean;
 nofollowMeta: boolean;
  dofollow: boolean;
  linksToTarget: boolean;
  anchors: string[];
  relAttributes: string[];
}

const USER_AGENT = "Mozilla/5.0 (compatible; BacklinkChecker/0.1; +https://mcp.zovo.one)";

async function fetchDoc(url: string, timeoutMs = 10000): Promise<{ status: number | null; html: string; contentType: string; error?: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.8" },
    });
    const ct = res.headers.get("content-type") ?? "";
    const html = ct.includes("html") || ct === "" ? await res.text() : "";
    return { status: res.status, html, contentType: ct };
  } catch (e: any) {
    return { status: null, html: "", contentType: "", error: String(e?.cause?.code ?? e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract <a href> entries with their rel attributes and anchor text from the
 * portion of the page containing the target host. Regex-based by design: no DOM
 * dependency, pure JS, and links in HTML are regular enough for rel detection.
 */
export function extractLinks(html: string): { href: string; rel: string; anchor: string }[] {
  const out: { href: string; rel: string; anchor: string }[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const inner = m[2];
    const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (!href) continue;
    const rel = /\brel\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const anchor = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    out.push({ href: href[2] ?? href[3] ?? href[4] ?? "", rel: (rel?.[2] ?? rel?.[3] ?? rel?.[4] ?? "").toLowerCase(), anchor });
  }
  return out;
}

export function classify(link: { href: string; rel: string }, targetHost: string): { linksToTarget: boolean; dofollow: boolean } {
  let host = "";
  try {
    const u = new URL(link.href, "https://placeholder.invalid");
    host = u.hostname.toLowerCase();
  } catch {
    return { linksToTarget: false, dofollow: false };
  }
  const linksToTarget = host === targetHost.toLowerCase() || host.endsWith(`.${targetHost.toLowerCase()}`);
  const nofollow = /\bnofollow\b/.test(link.rel);
  const sponsored = /\bsponsored\b/.test(link.rel);
  const ugc = /\bugc\b/.test(link.rel);
  return { linksToTarget, dofollow: linksToTarget && !nofollow && !sponsored && !ugc };
}

export function pageGuards(html: string): { noindex: boolean; nofollowMeta: boolean } {
  const meta = /<meta\b[^>]*name\s*=\s*["']robots["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  let noindex = false, nofollowMeta = false;
  while ((m = meta.exec(html))) {
    const c = (/\bcontent\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[0])?.[2] ?? /\bcontent\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[0])?.[3] ?? "").toLowerCase();
    if (/\bnoindex\b/.test(c)) noindex = true;
    if (/\bnofollow\b/.test(c)) nofollowMeta = true;
  }
  const header = /<meta\b[^>]*http-equiv\s*=\s*["']x-robots-tag["'][^>]*>/gi;
  while ((m = header.exec(html))) {
    const c = (m[0].match(/content\s*=\s*["']([^"']*)["']/i)?.[1] ?? "").toLowerCase();
    if (/\bnoindex\b/.test(c)) noindex = true;
    if (/\bnofollow\b/.test(c)) nofollowMeta = true;
  }
  return { noindex, nofollowMeta };
}

const server = new McpServer({ name: "backlink-checker", version: VERSION });

function registerTool(name: string, config: any, handler: (args: any) => Promise<ToolResult> | ToolResult): void {
  server.registerTool(name, config, (async (args: any) => {
    try {
      return await handler(args);
    } catch (e: any) {
      return fail(e?.message ?? String(e));
    }
  }) as any);
}

registerTool("link_check", {
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  title: "Check one backlink",
  description: "Fetch a referring page and report whether it links to the target domain, whether that link is dofollow or nofollow, the anchor text, HTTP status and robots guards (meta robots / X-Robots-Tag noindex, nofollow).",
  inputSchema: {
    page_url: z.string().describe("Referring page URL, including https://"),
    target_domain: z.string().describe("Domain the backlink should point at, e.g. example.com"),
  },
}, async ({ page_url, target_domain }): Promise<ToolResult> => {
  let host: string;
  try { host = new URL(page_url).hostname; } catch { return fail(`invalid page_url: ${page_url}`); }
  const { status, html, contentType, error } = await fetchDoc(page_url);
  if (error) return text(`${page_url}\nStatus: fetch failed (${error})\nNo verdict possible.`);
  if (!/html|text/.test(contentType)) return text(`${page_url}\nStatus: ${status}\nContent-Type: ${contentType} - not HTML, no link extraction.`);
  const guards = pageGuards(html);
  const links = extractLinks(html).map((l) => ({ ...l, ...classify(l, target_domain) }));
  const hits = links.filter((l) => l.linksToTarget);
  const lines = [
    `Page: ${page_url}`,
    `Status: ${status}`,
    guards.noindex ? "Robots: NOINDEX present - page may not be indexed" : "Robots: indexable",
    guards.nofollowMeta ? "Page-level nofollow: YES - all links discounted" : "Page-level nofollow: no",
    `Links to ${target_domain}: ${hits.length}`,
  ];
  for (const h of hits) lines.push(`  - ${h.dofollow ? "DOFOLLOW" : "nofollow"}${h.rel ? ` (rel="${h.rel}")` : ""} anchor: "${h.anchor || "(empty)"}" href: ${h.href}`);
  if (!hits.length) lines.push("Verdict: page does not link to the target domain.");
  return text(lines.join("\n"));
});

registerTool("link_audit", {
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  title: "Audit a list of backlinks",
  description: "Check up to N referring pages against one target domain and return a per-URL table: HTTP status, dofollow/nofollow, anchor text, robots guards. Free tier: 3 URLs per call.",
  inputSchema: {
    page_urls: z.array(z.string()).min(1).describe("Referring page URLs"),
    target_domain: z.string().describe("Domain the backlinks should point at"),
  },
}, async ({ page_urls, target_domain }): Promise<ToolResult> => {
  if (page_urls.length > FREE_URL_LIMIT && !gate.isPro()) {
    return fail(gate.upgradeText(`auditing more than ${FREE_URL_LIMIT} URLs per call`, "link_audit"));
  }
  const rows: string[] = ["url | status | verdict | anchor | notes"];
  for (const u of page_urls) {
    const { status, html, contentType, error } = await fetchDoc(u);
    if (error) { rows.push(`${u} | - | fetch failed | - | ${error}`); continue; }
    if (!/html|text/.test(contentType)) { rows.push(`${u} | ${status} | non-HTML | - | ${contentType}`); continue; }
    const guards = pageGuards(html);
    const hits = extractLinks(html).map((l) => ({ ...l, ...classify(l, target_domain) })).filter((l) => l.linksToTarget);
    if (!hits.length) { rows.push(`${u} | ${status} | no link to target | - | ${guards.noindex ? "noindex" : ""}`.trim()); continue; }
    for (const h of hits) {
      rows.push(`${u} | ${status} | ${h.dofollow ? "dofollow" : "nofollow"} | "${h.anchor || "-"}" | ${guards.noindex ? "noindex; " : ""}${guards.nofollowMeta ? "page nofollow" : ""}`.trim());
    }
  }
  return text(rows.join("\n"));
});

registerTool("anchor_profile", {
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  title: "Extract anchor text profile from a page",
  description: "Fetch one referring page and list every outbound link with its anchor text and dofollow/nofollow classification, so you can see how a site links out before requesting a link change.",
  inputSchema: {
    page_url: z.string().describe("Page URL, including https://"),
    limit: z.number().int().min(1).max(200).optional().describe("Max links to return (default 50)"),
  },
}, async ({ page_url, limit }): Promise<ToolResult> => {
  let host: string;
  try { host = new URL(page_url).hostname; } catch { return fail(`invalid page_url: ${page_url}`); }
  const { status, html, contentType, error } = await fetchDoc(page_url);
  if (error) return fail(`fetch failed: ${error}`);
  if (!/html|text/.test(contentType)) return fail(`Content-Type ${contentType} - not HTML, no links.`);
  const links = extractLinks(html).slice(0, limit ?? 50).map((l) => ({ ...l, ...classify(l, host) }));
  const lines = [`Page: ${page_url}`, `Status: ${status}`, `Links: ${links.length}`];
  for (const l of links) lines.push(`  - ${l.dofollow ? "dofollow" : "nofollow"} anchor: "${l.anchor || "(empty)"}" href: ${l.href}`);
  return text(lines.join("\n"));
});

registerTool("referring_domain_summary", {
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  title: "Summarize one referring domain from its page",
  description: "Fetch a page and summarize the referring domain: HTTP status, indexability, outbound link count, and whether the target domain appears anywhere in the text (brand mention without a link).",
  inputSchema: {
    page_url: z.string().describe("Page URL, including https://"),
    target_domain: z.string().describe("Domain to look for, linked or mentioned"),
  },
}, async ({ page_url, target_domain }): Promise<ToolResult> => {
  const { status, html, contentType, error } = await fetchDoc(page_url);
  if (error) return fail(`fetch failed: ${error}`);
  const guards = pageGuards(html);
  const links = extractLinks(html).map((l) => ({ ...l, ...classify(l, target_domain) }));
  const mentions = (html.match(new RegExp(target_domain.replace(/\./g, "\\."), "gi")) || []).length;
  return text([
    `Page: ${page_url}`,
    `Status: ${status}`,
    `Indexable: ${guards.noindex ? "NO (noindex)" : "yes"}`,
    `Outbound links: ${links.length}`,
    `Mentions of ${target_domain} in text: ${mentions}`,
    mentions > 0 && !links.some((l) => l.linksToTarget) ? "Verdict: brand mentioned but NOT linked - a conversion opportunity." : "Verdict: see link_check for per-link detail.",
  ].join("\n"));
});

registerTool("outreach_queue", {
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  title: "Check a list of pages for a link back to your domain",
  description: "Batch link check for outreach follow-ups: pass up to 10 page URLs and your domain, get one line per page (status, linked or not, dofollow). Built for the Monday-morning question: which of the sites that promised a link actually shipped it?",
  inputSchema: {
    page_urls: z.array(z.string()).min(1).max(10).describe("Up to 10 page URLs, including https://"),
    target_domain: z.string().describe("Your domain, e.g. example.com"),
  },
}, async ({ page_urls, target_domain }): Promise<ToolResult> => {
  const lines = [`Target: ${target_domain}`, ""];
  for (const u of page_urls.slice(0, 10)) {
    const { status, html, error } = await fetchDoc(u);
    if (error) { lines.push(`${u} - FETCH FAILED: ${error}`); continue; }
    if (!html) { lines.push(`${u} - HTTP ${status}, no HTML body`); continue; }
    const links = extractLinks(html).map((l) => ({ ...l, ...classify(l, target_domain) }));
    const hits = links.filter((l) => l.linksToTarget);
    if (hits.length === 0) lines.push(`${u} - HTTP ${status} - NO LINK (opportunity)`);
    else lines.push(`${u} - HTTP ${status} - ${hits.length} link(s): ${hits.map((h) => h.dofollow ? "dofollow" : "nofollow").join(", ")}`);
  }
  return text(lines.join("\n"));
});

registerTool("robots_guard_check", {
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  title: "Check robots guards on a page",
  description: "Fetch one URL and report HTTP status plus meta robots / X-Robots-Tag noindex and nofollow signals, without extracting links.",
  inputSchema: { url: z.string().describe("Page URL, including https://") },
}, async ({ url }): Promise<ToolResult> => {
  const { status, html, contentType, error } = await fetchDoc(url);
  if (error) return fail(`fetch failed: ${error}`);
  const g = pageGuards(html);
  return text([
    `URL: ${url}`,
    `Status: ${status}`,
    `Content-Type: ${contentType || "(none)"}`,
    `noindex: ${g.noindex ? "YES" : "no"}`,
    `nofollow (page-level): ${g.nofollowMeta ? "YES" : "no"}`,
  ].join("\n"));
});

gate.registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
