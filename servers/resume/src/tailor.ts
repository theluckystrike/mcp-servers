import type { Profile } from "./profile.js";
import { matchesKeyword, profileCorpus } from "./render.js";

/** Words that carry no signal in a job posting. Kept short on purpose: an over-long list drops real requirements. */
const STOP = new Set(`a an and are as at be been being but by can could do does doing for from had has have
having he her his how i if in into is it its me my no nor not of on or our ours out over own she should so
some such than that the their them then there these they this those through to too under until up very was
we were what when where which while who whom why will with would you your yours about after again all also
any because before both during each few more most other same then there here what any more will able across
role roles job jobs position positions candidate candidates team teams work working works year years
experience experienced strong good great excellent ideal must plus bonus etc via per using use used
opportunity company companies join looking seeking hire hiring apply application please send email
required require requires essential need needs needed preferred nice core ideally like want
responsibilities requirements qualifications benefits salary remote hybrid office full time part`
  .split(/\s+/).filter(Boolean));

/**
 * Short skill names a generic length filter would delete. Measured: on
 * "Senior Go engineer with Kubernetes and Postgres experience" the old extractor returned
 * kubernetes, engineer, postgres and senior, and never "go" -- the one word the posting is
 * actually about. Anything under three characters is noise *unless* it is a real skill name.
 */
export const SHORT_SKILLS = new Set(
  ["go", "c", "r", "c#", "c++", "f#", "qt", "ui", "ux", "qa", "ml", "ai", "ar", "vr",
   "js", "ts", "k8s", "aws", "gcp", "sql", "ios"],
);

/** Every token of the profile's own skills list, so a user's short skill is never dropped either. */
export function skillTokens(skills: string[] | undefined): Set<string> {
  const out = new Set<string>();
  for (const s of skills ?? []) for (const w of words(s)) if (w) out.add(w);
  return out;
}

function words(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9+#.\s-]+/g, " ").split(/\s+/)
    .map((w) => w.replace(/^[-.]+|[-.]+$/g, "")).filter((w) => w.length > 0);
}

/**
 * Keywords a posting is actually about: every non-stopword unigram, plus any bigram the
 * posting repeats. Ranked by frequency, then by length.
 *
 * Measured correction: an earlier version dropped a unigram once it appeared inside a
 * surviving bigram. On a short posting that deleted "postgresql" and "rust" in favour of
 * "postgresql required" and "essential rust", and the coverage figure fell from 44% to
 * 11% on the same profile. Unigrams are now always kept.
 */
export function extractKeywords(jd: string, limit = 30, known?: Iterable<string>): string[] {
  const ws = words(jd);
  const allow = new Set(SHORT_SKILLS);
  for (const k of known ?? []) allow.add(k.toLowerCase());
  const uni = new Map<string, number>();
  const bi = new Map<string, number>();
  const usable = (w: string | undefined) =>
    !!w && !STOP.has(w) && !/^\d+$/.test(w) && (w.length > 2 || allow.has(w));
  for (let i = 0; i < ws.length; i++) {
    if (!usable(ws[i])) continue;
    uni.set(ws[i], (uni.get(ws[i]) ?? 0) + 1);
    if (usable(ws[i + 1])) {
      const k = `${ws[i]} ${ws[i + 1]}`;
      bi.set(k, (bi.get(k) ?? 0) + 1);
    }
  }
  /*
   * Measured defect: on a posting where every word appears once, ranking a tie by length
   * put "everywhere", "elsewhere" and "backbone" ahead of "go", "kafka" and "grpc", so a
   * twelve-keyword window held no skill at all. A known skill name now outranks any word
   * of the same frequency, whatever its length.
   */
  const isSkill = (w: string) => allow.has(w) || allow.has(w.split(" ")[0]);
  const byCount = (a: [string, number], b: [string, number]) =>
    b[1] - a[1] || Number(isSkill(b[0])) - Number(isSkill(a[0])) ||
    b[0].length - a[0].length || a[0].localeCompare(b[0]);
  const phrases = [...bi.entries()].filter(([, c]) => c >= 2).sort(byCount).map(([k]) => k);
  const singles = [...uni.entries()].sort(byCount).map(([k]) => k);
  const out: string[] = [];
  for (const k of [...phrases, ...singles]) {
    if (!out.includes(k)) out.push(k);
    if (out.length >= limit) break;
  }
  return out;
}

export interface Rewrite {
  keyword: string;
  based_on: string;
  suggestion: string;
  note: string;
}

export interface Gap {
  keywords: string[];
  matched: string[];
  missing: string[];
  matched_in_skills: string[];
  matched_in_bullets: string[];
  coverage: number;
  rewrites: Rewrite[];
  advice: string;
}

/** Split a bullet into clauses that can be reordered without adding a word. */
function clauses(text: string): string[] {
  return text.split(/(?:,\s+|;\s+|\s+-\s+|\s+and\s+)/).map((c) => c.trim()).filter(Boolean);
}

/**
 * A rewrite only ever reorders facts the profile already states. It never adds a claim,
 * so a missing keyword produces no rewrite at all -- it produces a warning.
 */
export function suggestRewrites(p: Profile, keywords: string[], limit = 5): Rewrite[] {
  const out: Rewrite[] = [];
  for (const kw of keywords) {
    if (out.length >= limit) break;
    for (const e of p.experience) {
      const bullet = e.bullets.find((b) => matchesKeyword(b, kw));
      if (!bullet) continue;
      const cs = clauses(bullet);
      const i = cs.findIndex((c) => matchesKeyword(c, kw));
      if (i === 0) break;                          // already leads with it, nothing to do
      if (i <= 0) break;
      const reordered = [cs[i], ...cs.slice(0, i), ...cs.slice(i + 1)].join(", ");
      out.push({
        keyword: kw,
        based_on: bullet,
        suggestion: reordered.charAt(0).toUpperCase() + reordered.slice(1),
        note: "same facts, reordered so the posting's word leads the line. No claim was added.",
      });
      break;
    }
  }
  return out;
}

export function analyseGap(p: Profile, jd: string, limit = 30): Gap {
  const keywords = extractKeywords(jd, limit, skillTokens(p.skills));
  const skills = (p.skills ?? []).join("\n");
  const bullets = p.experience.flatMap((e) => [e.title, ...e.bullets]).join("\n");
  const corpus = profileCorpus(p);
  const matched: string[] = [];
  const missing: string[] = [];
  const inSkills: string[] = [];
  const inBullets: string[] = [];
  for (const kw of keywords) {
    if (matchesKeyword(corpus, kw)) {
      matched.push(kw);
      if (matchesKeyword(skills, kw)) inSkills.push(kw);
      if (matchesKeyword(bullets, kw)) inBullets.push(kw);
    } else missing.push(kw);
  }
  const coverage = keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0;
  const advice = missing.length
    ? `${missing.length} of the posting's ${keywords.length} keywords are absent from your profile. ` +
      `Add them only if they are true: run profile_set with the real skill or bullet. ` +
      `This tool will not write a fact you have not stated.`
    : `Every keyword extracted from the posting already appears in your profile.`;
  return {
    keywords, matched, missing, matched_in_skills: inSkills, matched_in_bullets: inBullets,
    coverage, rewrites: suggestRewrites(p, matched), advice,
  };
}
