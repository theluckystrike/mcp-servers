import type { Block } from "@theluckystrike/mcp-docx/lib";
import type { Education, Experience, Profile } from "./profile.js";

/**
 * Best-effort .docx to profile. Resumes have no schema, so this reads the shapes that
 * are actually common: a name on the first line, a contact line, and headings that name
 * a section. Anything it cannot place is returned under `unparsed` rather than dropped,
 * so nothing silently disappears on the way into the profile.
 */

const SECTIONS: { key: Section; re: RegExp }[] = [
  { key: "summary", re: /^(summary|profile|about|objective|professional summary)\b/i },
  { key: "skills", re: /^(skills|technical skills|core competencies|technologies|stack)\b/i },
  { key: "experience", re: /^(experience|work experience|employment|professional experience|career)\b/i },
  { key: "education", re: /^(education|academic|qualifications)\b/i },
  { key: "certifications", re: /^(certifications?|licenses?|awards?)\b/i },
  { key: "languages", re: /^(languages?)\b/i },
];

type Section = "summary" | "skills" | "experience" | "education" | "certifications" | "languages" | "head";

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(\+?\d[\d\s().-]{6,}\d)/;
const URL = /((?:https?:\/\/|www\.)[^\s|,]+|(?:linkedin\.com|github\.com)\/[^\s|,]+)/gi;

/** "2021 - present", "Jan 2021 to Mar 2024", "(2019-2021)". Returns start and end as written. */
export function parseDates(s: string): { start?: string; end?: string } {
  const m = /((?:[A-Z][a-z]{2,8}\.?\s+)?\d{4})\s*(?:-|--|–|—|to|until)\s*((?:[A-Z][a-z]{2,8}\.?\s+)?\d{4}|present|current|now)/i.exec(s);
  if (m) return { start: m[1].trim(), end: /present|current|now/i.test(m[2]) ? undefined : m[2].trim() };
  const one = /\b((?:[A-Z][a-z]{2,8}\.?\s+)?\d{4})\b/.exec(s);
  return one ? { start: one[1].trim() } : {};
}

function stripDates(s: string): string {
  return s.replace(/\(([^)]*\d{4}[^)]*)\)/g, "").replace(/\b[A-Z][a-z]{2,8}\.?\s+\d{4}\b/g, "")
    .replace(/\b\d{4}\b/g, "").replace(/\s*(?:-|--|–|—|to|until)\s*(?:present|current|now)\b/gi, "")
    .replace(/\s{2,}/g, " ").replace(/[\s,;|-]+$/, "").replace(/^[\s,;|-]+/, "").trim();
}

/** "Senior Engineer, Acme (2021-2024)" / "Acme - Senior Engineer". Company is the shorter side. */
export function parseRoleLine(line: string): { title: string; company: string } {
  const bare = stripDates(line);
  const parts = bare.split(/\s+(?:-|--|–|—|\||at|@|,)\s+|,\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { title: parts[0], company: parts.slice(1).join(", ") };
  return { title: bare, company: "" };
}

export interface ReadResult { profile: Profile; unparsed: string[]; sectionsFound: string[] }

export function blocksToProfile(blocks: Block[]): ReadResult {
  const profile: Profile = { name: "", email: "", experience: [], education: [] };
  const unparsed: string[] = [];
  const found = new Set<string>();
  let section: Section = "head";
  const skills: string[] = [];
  const certs: string[] = [];
  const langs: string[] = [];
  const summary: string[] = [];
  const education: Education[] = [];
  let current: Experience | null = null;

  const contact = (text: string) => {
    const e = EMAIL.exec(text);
    if (e && !profile.email) profile.email = e[0];
    const rest = text.replace(EMAIL, " ");
    const ph = PHONE.exec(rest);
    if (ph && !profile.phone) profile.phone = ph[1].trim();
    const links: string[] = [];
    let m: RegExpExecArray | null;
    URL.lastIndex = 0;
    while ((m = URL.exec(text))) links.push(m[1]);
    if (links.length) profile.links = [...(profile.links ?? []), ...links];
    const loc = text.split(/\s*\|\s*|\s{2,}/).map((s) => s.trim())
      .find((s) => s && !EMAIL.test(s) && !PHONE.test(s) && !/https?:|www\.|linkedin|github/i.test(s) && s.split(/\s+/).length <= 4);
    if (loc && !profile.location) profile.location = loc;
  };

  const pushItems = (items: string[]) => {
    if (section === "skills") skills.push(...items.flatMap(splitList));
    else if (section === "certifications") certs.push(...items);
    else if (section === "languages") langs.push(...items.flatMap(splitList));
    else if (section === "education") for (const it of items) education.push(eduOf(it));
    else if (section === "experience" && current) current.bullets.push(...items);
    else if (section === "summary") summary.push(...items);
    else unparsed.push(...items);
  };

  for (const b of blocks) {
    if (b.type === "heading") {
      const hit = SECTIONS.find((s) => s.re.test(b.text.trim()));
      if (hit) { section = hit.key; found.add(hit.key); continue; }
      if (section === "experience") {
        const { title, company } = parseRoleLine(b.text);
        const d = parseDates(b.text);
        current = { company, title, start: d.start ?? "", end: d.end, bullets: [] };
        profile.experience.push(current);
        continue;
      }
      if (section === "education") { education.push(eduOf(b.text)); continue; }
      if (!profile.name) { profile.name = b.text.trim(); continue; }
      unparsed.push(b.text);
      continue;
    }
    if (b.type === "para") {
      const t = b.text.trim();
      if (!t) continue;
      if (section === "head") {
        if (!profile.name) { profile.name = t.split("\n")[0].trim(); continue; }
        if (EMAIL.test(t) || PHONE.test(t) || /linkedin|github|https?:/i.test(t)) { contact(t); continue; }
        summary.push(t);
        continue;
      }
      if (section === "summary") { summary.push(t); continue; }
      if (section === "skills") { skills.push(...splitList(t)); continue; }
      if (section === "languages") { langs.push(...splitList(t)); continue; }
      if (section === "certifications") { certs.push(t); continue; }
      if (section === "education") { education.push(eduOf(t)); continue; }
      if (section === "experience") {
        const d = parseDates(t);
        if (d.start || /\b(20|19)\d{2}\b/.test(t)) {
          const { title, company } = parseRoleLine(t);
          current = { company, title, start: d.start ?? "", end: d.end, bullets: [] };
          profile.experience.push(current);
        } else if (current) current.bullets.push(t);
        else unparsed.push(t);
        continue;
      }
      unparsed.push(t);
      continue;
    }
    if (b.type === "bullets") { pushItems(b.items.map((i) => i.trim()).filter(Boolean)); continue; }
    if (b.type === "table") { for (const r of b.rows) pushItems([r.join(" - ")]); continue; }
    unparsed.push(b.text);
  }

  if (!profile.email) contact(blocks.map((x) => (x.type === "para" ? x.text : "")).join("\n"));
  if (summary.length) profile.summary = summary.join(" ").trim();
  if (skills.length) profile.skills = dedupe(skills);
  if (certs.length) profile.certifications = dedupe(certs);
  if (langs.length) profile.languages = dedupe(langs);
  profile.education = education;
  if (profile.links) profile.links = dedupe(profile.links);
  return { profile, unparsed, sectionsFound: [...found] };
}

function splitList(s: string): string[] {
  return s.split(/\s*(?:,|;|\||•|\s-\s)\s*/).map((x) => x.trim()).filter(Boolean);
}

function dedupe(a: string[]): string[] {
  const seen = new Set<string>();
  return a.filter((x) => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

function eduOf(line: string): Education {
  const d = parseDates(line);
  const bare = stripDates(line);
  const parts = bare.split(/\s*(?:,|–|—|\s-\s|\|)\s*/).map((s) => s.trim()).filter(Boolean);
  return { degree: parts[0] ?? bare, school: parts.slice(1).join(", "), start: d.start, end: d.end };
}
