import type { Block } from "@theluckystrike/mcp-docx/lib";
import type { Experience, Profile } from "./profile.js";

export type ResumeStyle = "modern" | "classic" | "compact";

/**
 * Words that fit on one A4 page at 11pt Calibri with 2cm margins, measured on the
 * documents this engine writes: a full page of body text is ~520 words, and a resume
 * spends roughly a seventh of the page on headings, blank lines and the contact block.
 * 450 is that net figure. `compact` sets tighter spacing, so it fits more.
 */
export const WORDS_PER_PAGE = 450;
export const COMPACT_WORDS_PER_PAGE = 540;

export function wordsPerPage(style: ResumeStyle): number {
  return style === "compact" ? COMPACT_WORDS_PER_PAGE : WORDS_PER_PAGE;
}

export function countWords(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

/* ------------------------------------------------------------- keywords */

/** A keyword matches on a word boundary, case-insensitively. "go" never matches "google". */
export function keywordRegex(kw: string): RegExp {
  const esc = kw.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const lead = /^[a-z0-9]/i.test(kw.trim()) ? "\\b" : "";
  const tail = /[a-z0-9]$/i.test(kw.trim()) ? "\\b" : "";
  return new RegExp(`${lead}${esc}${tail}`, "i");
}

export function matchesKeyword(text: string, kw: string): boolean {
  if (!kw.trim()) return false;
  return keywordRegex(kw).test(text);
}

export interface KeywordReport { matched: string[]; missing: string[] }

export function keywordReport(corpus: string, keywords: string[]): KeywordReport {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const kw of keywords) {
    if (!kw.trim()) continue;
    (matchesKeyword(corpus, kw) ? matched : missing).push(kw.trim());
  }
  return { matched, missing };
}

/** Wrap every keyword occurrence in **bold** markers, which the docx writer turns into bold runs. */
export function highlight(text: string, keywords: string[]): string {
  let out = text;
  for (const kw of keywords) {
    const k = kw.trim();
    if (!k) continue;
    const re = new RegExp(keywordRegex(k).source, "gi");
    out = out.replace(re, (m, offset: number, whole: string) => {
      // Never double-wrap: skip a hit that already sits inside ** ... **.
      const before = whole.slice(0, offset);
      const stars = (before.match(/\*\*/g) ?? []).length;
      return stars % 2 === 1 ? m : `**${m}**`;
    });
  }
  return out;
}

/* --------------------------------------------------------- page trimming */

export interface BulletRef { exp: number; index: number; text: string; words: number; score: number }

export interface TrimResult {
  kept: BulletRef[];
  dropped: BulletRef[];
  fixedWords: number;
  totalWords: number;
  budget: number;
  estimatedPages: number;
}

/**
 * Order bullets by evidence, then trim to a word budget.
 *
 * Score = keyword hits (3 each) + recency (the most recent role scores highest) +
 * a floor bonus for the first bullet of every role, so trimming never leaves a job
 * on the page with nothing under it while a later job keeps four lines.
 *
 * Recency reads array position (`experience.length - ei`), trusting index 0 to be the
 * newest role. That is safe because profile_set (index.ts) sorts every stored profile
 * newest-first (sortExperienceNewestFirst, profile.ts) before saving it -- this function
 * does not re-derive recency from `start`/`end` itself.
 */
export function scoreBullets(experience: Experience[], keywords: string[]): BulletRef[] {
  const out: BulletRef[] = [];
  experience.forEach((e, ei) => {
    const recency = Math.max(0, experience.length - ei);
    e.bullets.forEach((b, bi) => {
      let hits = 0;
      for (const kw of keywords) if (matchesKeyword(b, kw)) hits++;
      const firstBonus = bi === 0 ? 100 : 0;
      const order = Math.max(0, 10 - bi);
      out.push({ exp: ei, index: bi, text: b, words: countWords(b), score: firstBonus + hits * 3 + recency + order });
    });
  });
  return out;
}

export function trimToPages(
  experience: Experience[], keywords: string[], fixedWords: number, maxPages: number, perPage: number,
): TrimResult {
  const all = scoreBullets(experience, keywords);
  const budget = Math.max(0, Math.round(maxPages * perPage) - fixedWords);
  const ranked = [...all].sort((a, b) => b.score - a.score || a.exp - b.exp || a.index - b.index);
  const kept: BulletRef[] = [];
  let used = 0;
  for (const b of ranked) {
    if (used + b.words > budget && kept.length) continue;
    kept.push(b);
    used += b.words;
  }
  const keptSet = new Set(kept.map((b) => `${b.exp}:${b.index}`));
  const dropped = all.filter((b) => !keptSet.has(`${b.exp}:${b.index}`));
  kept.sort((a, b) => a.exp - b.exp || a.index - b.index);
  const totalWords = fixedWords + used;
  return { kept, dropped, fixedWords, totalWords, budget, estimatedPages: Math.max(1, Math.ceil(totalWords / perPage)) };
}

/* ------------------------------------------------------------- rendering */

export function dateRange(start?: string, end?: string): string {
  if (!start && !end) return "";
  return `${start ?? ""} - ${end && end.trim() ? end : "present"}`.trim();
}

/** The words a resume spends on everything that is not an experience bullet. */
export function fixedWordCount(p: Profile, targetRole?: string): number {
  let n = countWords(p.name) + countWords(contactLine(p)) + countWords(targetRole ?? "");
  n += countWords(p.summary ?? "") + 2;
  for (const s of p.skills ?? []) n += countWords(s) + 1;
  for (const e of p.experience) n += countWords(e.company) + countWords(e.title) + countWords(dateRange(e.start, e.end)) + 2;
  for (const e of p.education) n += countWords(e.school) + countWords(e.degree) + countWords(dateRange(e.start, e.end)) + 2;
  for (const c of p.certifications ?? []) n += countWords(c) + 1;
  for (const l of p.languages ?? []) n += countWords(l) + 1;
  return n + 12;   // section headings
}

export function contactLine(p: Profile): string {
  return [p.email, p.phone, p.location, ...(p.links ?? [])].filter(Boolean).join("  |  ");
}

export interface RenderOptions {
  style: ResumeStyle;
  targetRole?: string;
  keywords?: string[];
  maxPages?: number;
}

export interface RenderResult {
  blocks: Block[];
  trim: TrimResult;
  keywords: KeywordReport;
}

/** The whole resume as blocks, trimmed and keyword-highlighted. */
export function renderResume(p: Profile, o: RenderOptions): RenderResult {
  const keywords = (o.keywords ?? []).map((k) => k.trim()).filter(Boolean);
  const maxPages = Math.max(1, Math.min(5, o.maxPages ?? 2));
  const perPage = wordsPerPage(o.style);
  const trim = trimToPages(p.experience, keywords, fixedWordCount(p, o.targetRole), maxPages, perPage);
  const hl = (s: string) => (keywords.length ? highlight(s, keywords) : s);

  const blocks: Block[] = [];
  const contact = contactLine(p);
  if (contact) blocks.push({ type: "para", text: contact });
  if (o.targetRole) blocks.push({ type: "para", text: `**${o.targetRole}**` });

  if (p.summary) {
    blocks.push({ type: "heading", level: 2, text: "Summary" });
    blocks.push({ type: "para", text: hl(p.summary) });
  }
  if (p.skills?.length) {
    blocks.push({ type: "heading", level: 2, text: "Skills" });
    blocks.push({ type: "para", text: hl(p.skills.join(" - ")) });
  }
  if (p.experience.length) {
    blocks.push({ type: "heading", level: 2, text: "Experience" });
    p.experience.forEach((e, ei) => {
      const range = dateRange(e.start, e.end);
      blocks.push({ type: "heading", level: 3, text: `${e.title}, ${e.company}${range ? ` (${range})` : ""}` });
      const items = trim.kept.filter((b) => b.exp === ei).map((b) => hl(b.text));
      if (items.length) blocks.push({ type: "bullets", items, ordered: false, levels: items.map(() => 0) });
    });
  }
  if (p.education.length) {
    blocks.push({ type: "heading", level: 2, text: "Education" });
    blocks.push({
      type: "bullets", ordered: false,
      items: p.education.map((e) => {
        const range = dateRange(e.start, e.end);
        return `${e.degree}, ${e.school}${range ? ` (${range})` : ""}`;
      }),
      levels: p.education.map(() => 0),
    });
  }
  if (p.certifications?.length) {
    blocks.push({ type: "heading", level: 2, text: "Certifications" });
    blocks.push({ type: "bullets", items: p.certifications.map(hl), ordered: false, levels: p.certifications.map(() => 0) });
  }
  if (p.languages?.length) {
    blocks.push({ type: "heading", level: 2, text: "Languages" });
    blocks.push({ type: "para", text: p.languages.join(" - ") });
  }
  return { blocks, trim, keywords: keywordReport(profileCorpus(p), keywords) };
}

/** Keyword matching is asked of the whole profile, not only of the bullets that survived trimming. */
export function profileCorpus(p: Profile): string {
  const parts: string[] = [p.summary ?? "", ...(p.skills ?? []), ...(p.certifications ?? []), ...(p.languages ?? [])];
  for (const e of p.experience) parts.push(e.title, e.company, ...e.bullets);
  for (const e of p.education) parts.push(e.degree, e.school);
  return parts.filter(Boolean).join("\n");
}

/** Blocks to markdown. The inverse of the docx server's parseMarkdown for the shapes used here. */
export function blocksToMarkdown(title: string, blocks: Block[]): string {
  const out: string[] = [`# ${title}`, ""];
  for (const b of blocks) {
    if (b.type === "heading") out.push(`${"#".repeat(Math.min(6, b.level + 1))} ${b.text}`, "");
    else if (b.type === "para") out.push(b.text, "");
    else if (b.type === "code") out.push("```", b.text, "```", "");
    else if (b.type === "bullets") {
      b.items.forEach((it, i) => {
        const lvl = Math.min(8, b.levels?.[i] ?? 0);
        out.push(`${"  ".repeat(lvl)}${b.ordered ? `${i + 1}.` : "-"} ${it}`);
      });
      out.push("");
    } else {
      out.push(`| ${b.headers.join(" | ")} |`, `| ${b.headers.map(() => "---").join(" | ")} |`);
      for (const r of b.rows) out.push(`| ${r.join(" | ")} |`);
      out.push("");
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
