import type { Block } from "@theluckystrike/mcp-docx/lib";
import type { Profile } from "./profile.js";
import { profileText } from "./profile.js";
import { countWords, dateRange, matchesKeyword } from "./render.js";
import { extractKeywords, skillTokens } from "./tailor.js";

export type Tone = "formal" | "direct" | "warm";

/**
 * A bracketed prompt. The letter is never allowed to invent a fact, so anything the
 * profile does not contain is left as an instruction to the writer, in square brackets,
 * exactly where the sentence needs it. `[add: metric]` is the common one.
 */
export function prompt(what: string): string { return `[add: ${what}]`; }

const OPENINGS: Record<Tone, (role: string, company: string) => string> = {
  formal: (role, company) => `I am writing to apply for the ${role} position at ${company}.`,
  direct: (role, company) => `I want the ${role} role at ${company}.`,
  warm: (role, company) => `I would very much like to join ${company} as ${role}.`,
};

const CLOSINGS: Record<Tone, string> = {
  formal: "I would welcome the opportunity to discuss how this experience applies to the role.",
  direct: "Happy to walk through any of this on a call.",
  warm: "I would enjoy talking this through with you whenever it suits.",
};

const SIGNOFFS: Record<Tone, string> = { formal: "Yours sincerely,", direct: "Regards,", warm: "Best wishes," };

/** Normalise for the "is this claim already in the profile" test: case, punctuation, whitespace. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(s: string): string[] { return norm(s).split(" ").filter((t) => t.length > 2); }

/**
 * A caller-supplied highlight is only usable if the profile already says it. Exact
 * containment first, then a token-overlap test so a rephrased bullet still counts.
 * Anything below the floor is returned as a bracketed prompt rather than printed as fact.
 */
export function traceHighlight(h: string, p: Profile): { ok: boolean; source?: string } {
  const corpus = norm(profileText(p));
  if (corpus.includes(norm(h))) return { ok: true, source: h };
  const ht = tokens(h);
  if (!ht.length) return { ok: false };
  const candidates: string[] = [...(p.skills ?? []), ...(p.certifications ?? [])];
  for (const e of p.experience) candidates.push(...e.bullets, `${e.title} ${e.company}`);
  let best = { score: 0, text: "" };
  for (const c of candidates) {
    const ct = new Set(tokens(c));
    const hit = ht.filter((t) => ct.has(t)).length / ht.length;
    if (hit > best.score) best = { score: hit, text: c };
  }
  return best.score >= 0.6 ? { ok: true, source: best.text } : { ok: false };
}

/** Every digit run in a text. Used to prove the letter states no number the profile lacks. */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d.,%/-]*/g) ?? []).map((s) => s.replace(/[.,%/-]+$/, "")).filter(Boolean);
}

/**
 * Numbers the letter states that no allowed source contains. A non-empty result is a
 * fabrication and the tool refuses to write the file.
 */
export function unsourcedNumbers(letter: string, sources: string[]): string[] {
  // Whole-number-token comparison, never substring containment: a profile holding "2012"
  // must not license a letter that claims "12", and "4,500" must not license "50".
  const allowed = new Set(numbersIn(sources.join("\n")));
  const out: string[] = [];
  for (const n of numbersIn(letter)) if (!allowed.has(n) && !out.includes(n)) out.push(n);
  return out;
}

export interface LetterInput {
  company: string;
  role: string;
  hiring_manager?: string;
  job_description?: string;
  tone: Tone;
  highlights?: string[];
}

export interface LetterResult {
  blocks: Block[];
  text: string;
  prompts: string[];
  usedHighlights: string[];
  unverifiedHighlights: string[];
  matchedSkills: string[];
  words: number;
}

/**
 * Build the letter: opening, fit, proof, close. Every sentence draws on a profile field
 * or on an argument the caller passed; nothing else is asserted.
 */
export function buildLetter(p: Profile, o: LetterInput): LetterResult {
  const prompts: string[] = [];
  const use = (what: string) => { const s = prompt(what); prompts.push(s); return s; };
  const jd = o.job_description ?? "";
  const jdKeywords = jd ? extractKeywords(jd, 12, skillTokens(p.skills)) : [];
  const matchedSkills = (p.skills ?? []).filter((s) => jdKeywords.some((k) => matchesKeyword(s, k) || matchesKeyword(k, s)));

  /* opening */
  const paras: string[] = [];
  paras.push(OPENINGS[o.tone](o.role, o.company));

  /* fit */
  const fit: string[] = [];
  if (p.summary) fit.push(p.summary);
  else fit.push(`${use("one sentence on what you do")}`);
  if (matchedSkills.length) {
    fit.push(`The posting asks for ${listOf(matchedSkills.slice(0, 4))}; that is what my profile already lists.`);
  } else if (jd) {
    fit.push(`My profile lists ${listOf((p.skills ?? []).slice(0, 4))}, and ${use("the requirement from the posting this answers")}.`);
  } else {
    fit.push(`${use("paste the job description so the fit paragraph can name the requirement")}`);
  }
  paras.push(fit.join(" "));

  /* proof: verbatim profile facts only */
  const usedHighlights: string[] = [];
  const unverifiedHighlights: string[] = [];
  const proofLines: string[] = [];
  for (const h of o.highlights ?? []) {
    const t = traceHighlight(h, p);
    if (t.ok && t.source) { proofLines.push(t.source); usedHighlights.push(h); }
    else { unverifiedHighlights.push(h); }
  }
  if (!proofLines.length) {
    const ranked = rankBullets(p, jdKeywords);
    proofLines.push(...ranked.slice(0, 3));
  }

  /*
   * Every proof line is printed under the role it actually belongs to. An earlier version
   * printed one header -- the most recent role -- and hung every ranked bullet under it,
   * so work done at a previous employer was stated as work done at the current one. That
   * is a fabricated fact, which is the one thing this letter may not produce.
   */
  const roleOf = (line: string): number => p.experience.findIndex((e) => e.bullets.includes(line));
  const groups: { exp: number; lines: string[] }[] = [];
  for (const line of proofLines) {
    const ei = roleOf(line);
    const last = groups[groups.length - 1];
    if (last && last.exp === ei) last.lines.push(line);
    else groups.push({ exp: ei, lines: [line] });
  }

  const proofBlocks: Block[] = [];
  const bulletItems: string[] = [];
  const withMetric = (line: string) => (numbersIn(line).length ? line : `${line} ${use("metric")}`);
  if (!p.experience.length) {
    paras.push(`${use("at least one role, with company, title and dates")}:`);
  }
  for (const g of groups) {
    const e = g.exp >= 0 ? p.experience[g.exp] : undefined;
    if (e) {
      const range = dateRange(e.start, e.end);
      proofBlocks.push({ type: "para", text: `As ${e.title} at ${e.company}${range ? ` (${range})` : ""}:` });
    } else if (p.experience.length) {
      // A traced highlight that is not one of the stored bullets: stated without an employer.
      proofBlocks.push({ type: "para", text: "From my profile:" });
    }
    const items = g.lines.map(withMetric);
    bulletItems.push(...items);
    proofBlocks.push({ type: "bullets", items, ordered: false, levels: items.map(() => 0) });
  }
  if (unverifiedHighlights.length) {
    const extra = unverifiedHighlights.map((h) => prompt(`"${h}" is not in your profile - add it there or drop it`));
    prompts.push(...extra);
    bulletItems.push(...extra);
    proofBlocks.push({ type: "bullets", items: extra, ordered: false, levels: extra.map(() => 0) });
  }

  /* close */
  const closeParts = [CLOSINGS[o.tone]];
  const reach = [p.email, p.phone].filter(Boolean).join(" or ");
  closeParts.push(reach ? `You can reach me at ${reach}.` : `You can reach me at ${use("email")}.`);
  const close = closeParts.join(" ");

  const salutation = o.hiring_manager ? `Dear ${o.hiring_manager},` : "Dear Hiring Manager,";

  const blocks: Block[] = [
    { type: "para", text: salutation },
    ...paras.map((text) => ({ type: "para" as const, text })),
    ...proofBlocks,
    { type: "para", text: close },
    { type: "para", text: SIGNOFFS[o.tone] },
    { type: "para", text: p.name },
  ];

  const proofText = proofBlocks.map((b) =>
    b.type === "bullets" ? b.items.map((i) => `- ${i}`).join("\n\n") : b.type === "para" ? b.text : "");
  const text = [salutation, ...paras, ...proofText, close, SIGNOFFS[o.tone], p.name].join("\n\n");
  return {
    blocks, text, prompts, usedHighlights, unverifiedHighlights, matchedSkills,
    words: countWords(text),
  };
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Profile bullets, most relevant to the posting first. Recency breaks a tie, read as
 * array position (`experience.length - ei`) on the assumption that profile_set already
 * stored roles newest-first (see sortExperienceNewestFirst in profile.ts).
 */
export function rankBullets(p: Profile, keywords: string[]): string[] {
  const scored: { text: string; score: number }[] = [];
  p.experience.forEach((e, ei) => {
    e.bullets.forEach((b, bi) => {
      let hits = 0;
      for (const k of keywords) if (matchesKeyword(b, k)) hits++;
      scored.push({ text: b, score: hits * 5 + Math.max(0, p.experience.length - ei) + Math.max(0, 5 - bi) });
    });
  });
  return scored.sort((a, b) => b.score - a.score).map((s) => s.text);
}
