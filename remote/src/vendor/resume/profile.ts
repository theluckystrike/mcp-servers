import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "../../shims/fs.js";
import { homedir } from "../../shims/os.js";
import { join } from "node:path";

/** One job. `end` absent means "current". */
export interface Experience {
  company: string;
  title: string;
  start: string;
  end?: string;
  bullets: string[];
}

export interface Education {
  school: string;
  degree: string;
  start?: string;
  end?: string;
}

export interface Profile {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  links?: string[];
  summary?: string;
  skills?: string[];
  experience: Experience[];
  education: Education[];
  certifications?: string[];
  languages?: string[];
  /** Letterhead colour, six hex digits. Pro only; the free tier always uses the default. */
  accent_color?: string;
  updated?: string;
}

/** The default profile has no variant name; Pro users keep several under `variant`. */
export const DEFAULT_VARIANT = "default";

export function normalizeVariant(v?: string): string {
  const s = (v ?? "").trim();
  return s ? s.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || DEFAULT_VARIANT : DEFAULT_VARIANT;
}

export function dataDir(): string {
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, "mcp-servers", "resume");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * A read or parse failure must never look like "no profile yet": the next profile_set
 * would overwrite a CV that is still on disk. Only ENOENT is empty. A parse failure
 * quarantines the file byte-for-byte and writes a marker, so every later call keeps
 * failing until a human resolves it. Same contract as servers/docx/src/store.ts.
 */
export class CorruptDataError extends Error {}

export function markerPath(file: string): string { return `${file}.corrupt`; }

function blocked(file: string, moved: string): CorruptDataError {
  return new CorruptDataError(
    `data file is corrupt; moved to ${moved}; nothing was written. ` +
    `Restore a good copy to ${file}, then delete ${markerPath(file)} to continue.`,
  );
}

export function readJsonFile<T>(file: string, empty: T): T {
  const marker = markerPath(file);
  if (existsSync(marker)) {
    let moved = `${file}.corrupt-*`;
    try {
      const t = readFileSync(marker, "utf8").trim();
      if (t) {
        try {
          const j = JSON.parse(t) as { quarantined?: unknown };
          moved = typeof j.quarantined === "string" && j.quarantined ? j.quarantined : t;
        } catch { moved = t; }
      }
    } catch { /* marker unreadable */ }
    throw blocked(file, moved);
  }
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty;
    throw new CorruptDataError(`cannot read the data file ${file}: ${(e as Error).message}; nothing was written.`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    const moved = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    try {
      renameSync(file, moved);
      writeFileSync(marker, JSON.stringify({
        quarantined: moved, at: new Date().toISOString(),
        hint: "the original data file failed to parse; it was moved, nothing was overwritten",
      }) + "\n");
    } catch { /* keep the parse error */ }
    process.stderr.write(`${file} is not valid JSON (${(e as Error).message}); moved to ${moved}\n`);
    throw blocked(file, moved);
  }
}

function readJson<T>(file: string, fallback: T): T {
  return readJsonFile<T>(join(dataDir(), file), fallback);
}

function writeJson(file: string, value: unknown): void {
  const p = join(dataDir(), file);
  const tmp = `${p}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
}

export type ProfileStore = Record<string, Profile>;

export function getProfiles(): ProfileStore { return readJson<ProfileStore>("profiles.json", {}); }

export function getProfile(variant?: string): Profile | null {
  return getProfiles()[normalizeVariant(variant)] ?? null;
}

export function setProfile(variant: string | undefined, p: Profile): void {
  const all = getProfiles();
  all[normalizeVariant(variant)] = { ...p, updated: new Date().toISOString() };
  writeJson("profiles.json", all);
}

export function variantNames(): string[] { return Object.keys(getProfiles()).sort(); }

/* ------------------------------------------------------------ cover letters */

export interface LetterRecord {
  id: string;
  company: string;
  role: string;
  path: string;
  created: string;
}

export function getLetters(): LetterRecord[] { return readJson<LetterRecord[]>("letters.json", []); }

export function addLetter(rec: LetterRecord): void {
  const all = getLetters();
  all.push(rec);
  writeJson("letters.json", all);
}

export function lettersInMonth(month: string): LetterRecord[] {
  return getLetters().filter((l) => l.created.slice(0, 7) === month);
}

/* --------------------------------------------------------------- text views */

/**
 * Every string a profile holds, as one corpus. This is the only source a cover letter
 * or a tailoring answer is allowed to draw a fact from -- see letter.ts.
 */
export function profileText(p: Profile): string {
  const parts: string[] = [p.name, p.email, p.phone ?? "", p.location ?? "", p.summary ?? ""];
  parts.push(...(p.links ?? []), ...(p.skills ?? []), ...(p.certifications ?? []), ...(p.languages ?? []));
  for (const e of p.experience) parts.push(e.company, e.title, e.start, e.end ?? "", ...e.bullets);
  for (const e of p.education) parts.push(e.school, e.degree, e.start ?? "", e.end ?? "");
  return parts.filter(Boolean).join("\n");
}
