/**
 * The library logic, with no filesystem, network or licence dependency, so it can be
 * unit-tested directly: ids, variable extraction, ranked search, variable fill, and the
 * markdown / JSON serialisation used by clause_import and clause_export.
 */
import type { Clause } from "./store.js";
import { categoryRank } from "./store.js";

export const DISCLAIMER =
  "Generic template, not legal advice. Have a qualified lawyer review this document before you sign it.";

const VAR_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/** A stable id from the title, with -2, -3, ... when the slug is already taken. */
export function makeId(title: string, taken: Set<string>): string {
  const base = slugify(title) || "clause";
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const c = `${base}-${n}`;
    if (!taken.has(c)) return c;
  }
  throw new Error(`cannot derive a free id from "${title}"`);
}

/** Every {{name}} in the text, in first-appearance order, deduplicated. */
export function extractVariables(text: string): string[] {
  const out: string[] = [];
  VAR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VAR_RE.exec(text))) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** Declared variables first, then any the body uses but did not declare. */
export function clauseVariables(c: Pick<Clause, "body" | "variables">): string[] {
  const out = [...c.variables];
  for (const v of extractVariables(c.body)) if (!out.includes(v)) out.push(v);
  return out;
}

/** The union of the variables of several clauses, ordered by first appearance. */
export function variablesFor(clauses: Clause[]): string[] {
  const out: string[] = [];
  for (const c of clauses) for (const v of clauseVariables(c)) if (!out.includes(v)) out.push(v);
  return out;
}

export interface FillResult { text: string; filled: string[]; unfilled: string[] }

/**
 * How a missing variable is printed. Measured: the docx engine parses inline markdown, so
 * `[late_fee_percent]` reaches Word as `[latefeepercent]` -- the underscore pair is read as
 * an italic marker and dropped. The prompt is therefore printed with spaces, which is both
 * safe for the writer and easier for a human to fill in. `unfilled` keeps the real names.
 */
export function promptFor(name: string): string {
  return `[${name.replace(/[_.-]+/g, " ").trim()}]`;
}

/**
 * Replace every {{var}} with its value. A variable with no value becomes a bracketed
 * prompt -- [fee] -- rather than an empty gap or a literal {{fee}}, so the missing fact is
 * visible in the printed document and is also returned in `unfilled`.
 */
export function fillVariables(text: string, values: Record<string, string>): FillResult {
  const filled: string[] = [];
  const unfilled: string[] = [];
  const out = text.replace(VAR_RE, (_m, name: string) => {
    const v = values[name];
    if (v !== undefined && String(v).trim() !== "") {
      if (!filled.includes(name)) filled.push(name);
      return String(v);
    }
    if (!unfilled.includes(name)) unfilled.push(name);
    return promptFor(name);
  });
  return { text: out, filled, unfilled };
}

export interface SearchOptions { category?: string; tags?: string[]; jurisdiction?: string }
export interface Hit { clause: Clause; score: number }

/**
 * A query term matches on a word boundary, case-insensitively, the same contract as
 * servers/resume/src/render.ts:keywordRegex -- "art" never matches "party" or "contract".
 * Punctuation is escaped so the term is matched literally, not as a mini pattern.
 */
function wordBoundaryRegex(term: string): RegExp {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lead = /^[a-z0-9]/i.test(term) ? "\\b" : "";
  const tail = /[a-z0-9]$/i.test(term) ? "\\b" : "";
  return new RegExp(`${lead}${esc}${tail}`, "gi");
}

function countWordMatches(text: string, term: string): number {
  return (text.match(wordBoundaryRegex(term)) ?? []).length;
}

/**
 * Ranked word-boundary match, title first, plus tag match. Nothing here is a vector
 * search: the score is the sum of where the query terms land. A term is scored on real
 * word boundaries -- "fee" scores a clause that says "fee" as a word, not one that only
 * contains "fee" inside "coffee". Plain substring containment is kept only as a fallback
 * (Review V5 P2), at a fraction of the weight, so a fluke substring hit can surface a
 * clause that would otherwise be invisible to the query but never outranks a real match.
 */
export function search(clauses: Clause[], query: string, o: SearchOptions = {}): Hit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const pool = clauses.filter((c) => {
    if (o.category && c.category !== o.category) return false;
    if (o.jurisdiction && (c.jurisdiction ?? "").toLowerCase() !== o.jurisdiction.toLowerCase()) return false;
    if (o.tags && o.tags.length) {
      const have = c.tags.map((t) => t.toLowerCase());
      if (!o.tags.every((t) => have.includes(t.toLowerCase()))) return false;
    }
    return true;
  });
  if (!terms.length) {
    return pool
      .map((clause) => ({ clause, score: 0 }))
      .sort((a, b) => categoryRank(a.clause.category) - categoryRank(b.clause.category) || a.clause.title.localeCompare(b.clause.title));
  }
  const hits: Hit[] = [];
  for (const clause of pool) {
    const title = clause.title.toLowerCase();
    const body = clause.body.toLowerCase();
    const tags = clause.tags.map((t) => t.toLowerCase());
    let score = 0;
    for (const t of terms) {
      if (title === t) score += 100;
      else if (title.split(/\W+/).includes(t)) score += 60;
      else if (countWordMatches(title, t)) score += 60;
      else if (title.includes(t)) score += 5;   // substring fallback, ranked well below a real match
      if (tags.includes(t)) score += 30;
      else if (tags.some((x) => x.includes(t))) score += 15;
      if (clause.category.toLowerCase() === t) score += 20;
      if (clause.id.includes(t)) score += 10;
      const wordHits = countWordMatches(body, t);
      if (wordHits) score += Math.min(wordHits, 5) * 4;
      else {
        const substringHits = body.split(t).length - 1;
        if (substringHits) score += Math.min(substringHits, 5) * 1;   // substring fallback
      }
    }
    if (score > 0) hits.push({ clause, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.clause.title.localeCompare(b.clause.title));
}

/** Assembly order: the caller's clause_ids order is kept; a category selection is sorted. */
export function orderByCategory(clauses: Clause[]): Clause[] {
  return [...clauses].sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.title.localeCompare(b.title));
}

/* ---------------------------------------------------------------- markdown */

export interface ParsedClause {
  title: string; body: string; category: string; tags: string[];
  variables: string[]; jurisdiction?: string; language: string; note?: string;
}

const HEADER_KEYS = new Set(["category", "tags", "variables", "jurisdiction", "language", "note"]);

/**
 * A metadata VALUE is a short field (a word, a name, a comma-separated list): "payment",
 * "retainer, monthly", "generic template, not legal advice". Body prose that happens to
 * start with a recognised key ("Note: the client must pay within 30 days...") reads as a
 * full sentence instead -- long, and/or ending in terminal punctuation. Rejecting those
 * shapes is what keeps a body opening line from being silently swallowed into `meta`
 * (Review V5 P2): `key in HEADER_KEYS` alone is not enough, because "note" and the other
 * keys are also perfectly ordinary English words to start a sentence with.
 */
function looksLikeMetadataValue(v: string): boolean {
  const t = v.trim();
  if (!t) return true;
  const words = t.split(/\s+/).length;
  if (words > 8) return false;
  if (/[.!?]$/.test(t) && words > 3) return false;
  return true;
}

/**
 * Markdown form: `## Title`, then `key: value` lines, then a blank line, then the body.
 * Round-trips with `toMarkdown`. Anything before the first `##` heading is ignored, so a
 * file with a title and a preamble imports cleanly.
 */
export function parseMarkdown(text: string): ParsedClause[] {
  const out: ParsedClause[] = [];
  const parts = text.split(/^##[ \t]+/m).slice(1);
  for (const part of parts) {
    const lines = part.split(/\r?\n/);
    const title = (lines.shift() ?? "").trim();
    if (!title) continue;
    const meta: Record<string, string> = {};
    while (lines.length) {
      const line = lines[0];
      if (!line.trim()) { lines.shift(); if (Object.keys(meta).length) break; continue; }
      const m = /^([a-z_]+):[ \t]*(.*)$/.exec(line.trim());
      if (!m || !HEADER_KEYS.has(m[1]) || !looksLikeMetadataValue(m[2])) break;
      meta[m[1]] = m[2].trim();
      lines.shift();
    }
    const body = lines.join("\n").trim();
    if (!body) continue;
    const list = (k: string) => (meta[k] ? meta[k].split(",").map((s) => s.trim()).filter(Boolean) : []);
    out.push({
      title, body,
      category: meta.category || "general",
      tags: list("tags"),
      variables: list("variables"),
      jurisdiction: meta.jurisdiction || undefined,
      language: meta.language || "en",
      note: meta.note || undefined,
    });
  }
  return out;
}

export function toMarkdown(clauses: Clause[], heading = "Clause library"): string {
  const lines = [`# ${heading}`, "", DISCLAIMER, ""];
  for (const c of clauses) {
    lines.push(`## ${c.title}`);
    lines.push(`category: ${c.category}`);
    if (c.tags.length) lines.push(`tags: ${c.tags.join(", ")}`);
    if (c.variables.length) lines.push(`variables: ${c.variables.join(", ")}`);
    if (c.jurisdiction) lines.push(`jurisdiction: ${c.jurisdiction}`);
    lines.push(`language: ${c.language}`);
    if (c.note) lines.push(`note: ${c.note}`);
    lines.push("", c.body, "");
  }
  return lines.join("\n");
}

/** JSON import accepts either a bare array or {clauses:[...]}. */
export function parseClauseJson(text: string): ParsedClause[] {
  const raw = JSON.parse(text) as unknown;
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { clauses?: unknown }).clauses) ? (raw as { clauses: unknown[] }).clauses : undefined;
  if (!arr) throw new Error("expected a JSON array of clauses, or an object with a clauses array");
  return arr.map((r) => {
    const c = r as Partial<Clause>;
    if (typeof c.title !== "string" || typeof c.body !== "string") throw new Error("every clause needs a title and a body");
    return {
      title: c.title, body: c.body,
      category: typeof c.category === "string" && c.category ? c.category : "general",
      tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
      variables: Array.isArray(c.variables) ? c.variables.map(String) : [],
      jurisdiction: typeof c.jurisdiction === "string" ? c.jurisdiction : undefined,
      language: typeof c.language === "string" && c.language ? c.language : "en",
      note: typeof c.note === "string" ? c.note : undefined,
    };
  });
}

export function toClauseJson(clauses: Clause[]): string {
  return JSON.stringify({
    version: 1,
    note: DISCLAIMER,
    exported: new Date().toISOString(),
    clauses: clauses.map((c) => ({
      title: c.title, body: c.body, category: c.category, tags: c.tags,
      variables: clauseVariables(c), jurisdiction: c.jurisdiction, language: c.language, note: c.note,
    })),
  }, null, 2);
}
