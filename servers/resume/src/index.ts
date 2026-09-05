#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, EMAIL_PLACEHOLDER, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import { buildDocx, letterhead, readDocx, stripInvalidXml, toHtml, type Block } from "@theluckystrike/mcp-docx/lib";
import { z } from "zod";
import {
  addLetter, dataDir, getProfile, lettersInMonth, normalizeVariant, setProfile, sortExperienceNewestFirst,
  variantNames, type Education, type Experience, type Profile,
} from "./profile.js";
import { blocksToProfile } from "./read.js";
import { buildLetter, unsourcedNumbers, type Tone } from "./letter.js";
import { blocksToMarkdown, renderResume, type ResumeStyle } from "./render.js";
import { analyseGap } from "./tailor.js";
import { VERSION } from "./version.js";

const FREE_LETTERS_PER_MONTH = 3;
const FREE_JD_CHARS = 2000;
const FREE_STYLE: ResumeStyle = "modern";

const gate = createLicenseGate({ product: "resume" });

/** Serialise every read-modify-write cycle on the data dir across processes. */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(join(dataDir(), ".lock"), fn);
}

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

/** A leading `<scheme>://` means the caller has a URL, not a local path. Checked BEFORE
 * any resolution, so a URL is never joined against the server's cwd and the refusal
 * never has a path in it, let alone one that leaks the cwd. */
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

// D-R83: a URL handed to `path` used to be silently resolved as a relative filesystem
// path, producing an error that leaked the server's own cwd. Refused by name instead.
function expandPath(p: string): string {
  if (URL_SCHEME_RE.test(p)) {
    throw new Error(
      `"${p}" is a URL, not a file path; this tool reads local files. On the hosted route, ` +
      `use the url argument of doc_upload, or paste the document's text directly. Locally, download it first and pass the path it was saved to.`,
    );
  }
  const s = p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  return isAbsolute(s) ? s : resolvePath(process.cwd(), s);
}

function slug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "resume";
}

/**
 * Reserve the output path with an exclusive create, never with an existence check:
 * two processes writing the same out_path would otherwise both pass the check and the
 * second would clobber the first. A path this server derived itself is never allowed to
 * land on an earlier file -- it gets -2, -3, ... instead.
 */
function outputPath(out: string | undefined, fallbackName: string, ext: string, overwrite = false): string {
  const p = expandPath(out ?? join(dataDir(), "documents", fallbackName));
  const withExt = p.toLowerCase().endsWith(ext) ? p : `${p}${ext}`;
  mkdirSync(dirname(withExt), { recursive: true });
  if (out === undefined && !overwrite) {
    const stem = withExt.slice(0, withExt.length - ext.length);
    for (let n = 1; n < 1000; n++) {
      const candidate = n === 1 ? withExt : `${stem}-${n}${ext}`;
      try { closeSync(openSync(candidate, "wx")); return candidate; } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      }
    }
    throw new Error(`${withExt} and 999 numbered variants already exist; pass out_path.`);
  }
  if (!overwrite) {
    try { closeSync(openSync(withExt, "wx")); } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      throw new Error(`${withExt} already exists and nothing was written. Pass overwrite: true to replace it, or give a different out_path.`);
    }
  }
  return withExt;
}

/** Every string that reaches document.xml passes through the docx engine's XML sanitiser first. */
function clean(s: string): string { return stripInvalidXml(s).text; }

function cleanBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.type === "bullets") return { ...b, items: b.items.map(clean) };
    if (b.type === "table") return { ...b, headers: b.headers.map(clean), rows: b.rows.map((r) => r.map(clean)) };
    return { ...b, text: clean(b.text) };
  });
}

function proOnly(what: string): string { return `${what} is a Pro feature.\n\n${gate.upgradeText(what)}`; }

/**
 * D-R40. An email is the shared business profile's or an explicit argument, never anything
 * else. With neither, every letterhead shows the bracketed prompt and the answer says so.
 */
function emailNote(): string {
  return `\n\nNo email address was given and none is stored on your shared business profile, so the ` +
    `letterhead and the closing line show "${EMAIL_PLACEHOLDER}". Pass email here, or set it once with ` +
    `business_set {email} in the invoice or docx server. Do not supply an address the user has not given.`;
}

/**
 * D-R33. Report every bullet whose TEXT changed, so a rewrite can never be silent. Round 8
 * turned "wrote the OpenAPI style guide two of those clients still use" into "... and
 * governance documentation ..." to raise a keyword score, and nothing said a word.
 */
function bulletChanges(before: Profile | undefined, after: Profile): string {
  if (!before) return "";
  const key = (e: { company: string; title: string }) => `${e.company}|${e.title}`;
  const old = new Map(before.experience.map((e) => [key(e), e.bullets]));
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  for (const e of after.experience) {
    const prev = old.get(key(e));
    if (!prev) { added.push(...e.bullets.map((b) => `${e.company}: ${b}`)); continue; }
    const seen = new Set(prev);
    for (const b of e.bullets) if (!seen.has(b)) changed.push(`${e.company}: "${b}"`);
    const now = new Set(e.bullets);
    for (const b of prev) if (!now.has(b)) removed.push(`${e.company}: "${b}"`);
  }
  if (!changed.length && !added.length && !removed.length) return "\n\nNo stored bullet changed.";
  const parts: string[] = [];
  if (changed.length) parts.push(`${changed.length} bullet(s) now read differently from what was stored: ${changed.join("; ")}`);
  if (removed.length) parts.push(`${removed.length} stored bullet(s) are gone: ${removed.join("; ")}`);
  if (added.length) parts.push(`${added.length} bullet(s) are on roles that were not stored before: ${added.join("; ")}`);
  return `\n\n${parts.join(". ")}. Every one of these is now a fact this server will let a cover letter claim; check that the user actually said each of them.`;
}

function requireProfile(variant?: string): Profile | string {
  const p = getProfile(variant);
  if (p) return p;
  const known = variantNames();
  return `no profile stored${variant ? ` under variant "${normalizeVariant(variant)}"` : ""}. ` +
    `Run profile_set {name, email, experience, education} first.` +
    (known.length ? ` Stored variants: ${known.join(", ")}.` : "");
}

function sender(p: Profile, pro: boolean) {
  return letterhead({
    name: p.name,
    address: p.location,
    email: p.email,
    brand_color: pro ? p.accent_color : undefined,
  });
}

const server = new McpServer(
  { name: "mcp-resume", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

/* ---------------------------------------------------------------- schemas */

const experienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  start: z.string().min(1).describe("As you want it printed: \"2021\" or \"Jan 2021\""),
  end: z.string().optional().describe("Leave out for a current role; it prints as \"present\""),
  bullets: z.array(z.string()).describe("What you did, one line each. Facts only: everything else in this server refuses to state anything that is not here."),
});

const educationSchema = z.object({
  school: z.string().min(1),
  degree: z.string().min(1),
  start: z.string().optional(),
  end: z.string().optional(),
});

/* ---------------------------------------------------------------- profile */

server.registerTool("profile_set", {
  title: "Store your CV facts",
  description: "Store the profile every resume and cover letter is built from: contact details, summary, skills, roles with bullets, education, certifications and languages. Returns a count of what was stored.",
  inputSchema: {
    name: z.string().min(1).optional().describe("Your own name. Leave it out and the shared business profile's name is used, so you are never asked for a name the suite already holds"),
    email: z.string().optional().describe("Your own email address. Leave it out and the shared business profile's email is used; with neither, letters and letterheads show \"[add: email]\" and say so. Never invent one"),
    phone: z.string().optional().describe("Your own phone number. Defaults to the shared business profile's phone"),
    location: z.string().optional(),
    links: z.array(z.string()).optional().describe("Portfolio, LinkedIn, GitHub"),
    summary: z.string().optional().describe("Two or three lines. Used verbatim as the fit paragraph of a cover letter."),
    skills: z.array(z.string()).optional(),
    experience: z.array(experienceSchema).default([])
      .describe("Roles in any order you like -- profile_set sorts and stores them newest-first (an open role with no `end` first, then by `end` descending, then by `start` descending) before saving, since page-budget trimming and cover-letter bullet ranking both trust array order to mean recency."),
    education: z.array(educationSchema).default([]),
    certifications: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    accent_color: z.string().optional().describe("Letterhead colour, six hex digits, e.g. 1F3864. Pro only."),
    variant: z.string().optional().describe("Name a second profile, e.g. \"backend\". One profile per data directory on the free tier; named variants are Pro only."),
    merge: z.boolean().optional().describe("Update the stored profile: fields you pass replace their stored value, fields you leave out are kept. Required when a profile already exists, unless you pass replace"),
    replace: z.boolean().optional().describe("Discard the stored profile and store exactly what this call carries. Required when a profile already exists, unless you pass merge"),
  },
}, async (a) => {
  try {
    const wantsVariant = !!a.variant && normalizeVariant(a.variant) !== "default";
    if (wantsVariant && !gate.isPro()) return fail(proOnly("Profile variants"));
    // D-R33: the stored profile is the fact base every resume and cover letter is checked
    // against. A model asked to "tailor my resume" has no write path, so in round 8 it
    // reached for this tool and silently altered a bullet the user had dictated. An
    // existing profile is never overwritten without the caller saying which it means.
    const existing = getProfile(a.variant) ?? undefined;
    if (existing && !a.merge && !a.replace) {
      return fail(
        `a profile is already stored under variant "${normalizeVariant(a.variant)}" ` +
        `(${existing.experience.length} roles, ${existing.experience.reduce((n, e) => n + e.bullets.length, 0)} bullets). ` +
        `Nothing was changed. Pass merge: true to update only the fields you send, or replace: true to discard the stored profile. ` +
        `Do not use this tool to reword bullets for a posting: tailor_to_job is read-only by design and rewriting a stored bullet ` +
        `changes what cover_letter_create is allowed to claim.`,
      );
    }
    const base = a.merge && existing ? existing : undefined;
    // Profile-first sweep: your own name and phone are business identity, held once behind
    // the token. name was required here, so a first-ever profile_set could stop and ask for
    // a name business_set already carries. An explicit argument still wins.
    const shared = readSharedProfile();
    const name = (a.name ?? base?.name ?? shared.name ?? "").trim();
    if (!name) {
      return fail(
        `no name: pass name, or set one once in the shared business profile (the invoice server's business_set, field name) and every server in this suite uses it. Nothing was stored.`,
      );
    }
    const fromProfile: string[] = [];
    if (!a.name && !base?.name && shared.name) fromProfile.push("name");
    const p: Profile = {
      name,
      email: (a.email ?? base?.email ?? shared.email ?? "").trim(),
      phone: a.phone ?? base?.phone ?? shared.phone, location: a.location ?? base?.location,
      links: a.links ?? base?.links, summary: a.summary ?? base?.summary, skills: a.skills ?? base?.skills,
      // Enforced ordering (Review V5 P1): whatever order the caller entered roles in,
      // the stored array is always newest-first, so trimming and letter-bullet ranking
      // (both of which read recency off array position) are correct regardless.
      experience: sortExperienceNewestFirst((a.experience.length ? a.experience : base?.experience ?? []) as Experience[]),
      education: (a.education.length ? a.education : base?.education ?? []) as Education[],
      certifications: a.certifications ?? base?.certifications,
      languages: a.languages ?? base?.languages,
      accent_color: a.accent_color ?? base?.accent_color,
    };
    if (!a.phone && !base?.phone && shared.phone) fromProfile.push("phone");
    if (!a.email && !base?.email && shared.email) fromProfile.push("email");
    const sourced = fromProfile.length ? `\n\nTaken from the shared business profile: ${fromProfile.join(", ")}.` : "";
    const changes = bulletChanges(existing, p);
    await locked(() => setProfile(a.variant, p));
    const bullets = p.experience.reduce((n, e) => n + e.bullets.length, 0);
    const note = a.accent_color && !gate.isPro()
      ? `\n\nThe accent colour is stored but the free tier prints the default colour. ${gate.upgradeText("letterhead colours", "profile_set")}` : "";
    return ok(`Profile "${normalizeVariant(a.variant)}" stored: ${p.experience.length} roles, ${bullets} bullets, ` +
      `${p.skills?.length ?? 0} skills, ${p.education.length} education entries. ` +
      `Stored under ${dataDir()}; nothing leaves this machine.${sourced}${note}${changes}${p.email ? "" : emailNote()}`);
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("profile_get", {
  title: "Show the stored profile",
  description: "Return the stored profile as JSON, exactly as it will be used by resume_create, cover_letter_create and tailor_to_job.",
  inputSchema: { variant: z.string().optional() },
}, async (a) => {
  // Never throw across the transport: a corrupt store must arrive as an "Error: ..." answer.
  try {
    const p = requireProfile(a.variant);
    if (typeof p === "string") return fail(p);
    return json({ variant: normalizeVariant(a.variant), variants: variantNames(), profile: p });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ----------------------------------------------------------------- resume */

server.registerTool("resume_create", {
  title: "Write a resume .docx",
  description: "Call this tool to write the stored profile to a Word .docx. Returns the output path, the estimated page count, which bullets were dropped to fit, and which keywords matched or are missing.",
  inputSchema: {
    variant: z.string().optional(),
    style: z.enum(["modern", "classic", "compact"]).default("modern").describe("Free tier prints \"modern\" only; \"classic\" and \"compact\" are Pro."),
    target_role: z.string().optional().describe("Printed under your name and used to rank bullets"),
    keywords: z.array(z.string()).optional().describe("From the posting. A keyword that appears anywhere in the profile is printed in bold; one that does not is reported as missing and is never added to the resume."),
    max_pages: z.number().int().min(1).max(5).default(2).describe("Bullets are ordered by relevance to target_role and keywords, then trimmed to fit this many pages against a measured word budget. Default 2."),
    out_path: z.string().optional().describe("Where to write the .docx. Defaults to <data dir>/documents/<name>-resume.docx, numbered -2, -3, ... if that exists."),
    overwrite: z.boolean().default(false).describe("Replace an existing file at out_path. Default false: the call fails and nothing is written."),
  },
}, async (a) => {
  try {
    const p = requireProfile(a.variant);
    if (typeof p === "string") return fail(p);
    const style = a.style as ResumeStyle;
    if (style !== FREE_STYLE && !gate.isPro()) return fail(proOnly(`The "${style}" resume style`));
    const r = renderResume(p, { style, targetRole: a.target_role, keywords: a.keywords, maxPages: a.max_pages });
    const path = outputPath(a.out_path, `${slug(p.name)}-resume.docx`, ".docx", a.overwrite);
    const buf = await buildDocx({
      title: clean(p.name),
      blocks: cleanBlocks(r.blocks),
      style: style === "classic" ? "proposal" : "plain",
      business: sender(p, gate.isPro()),
      pro: gate.isPro(),
      recipient: style === "classic" ? a.target_role : undefined,
    });
    writeFileSync(path, buf);
    return json({
      path,
      style,
      estimated_pages: r.trim.estimatedPages,
      max_pages: a.max_pages,
      word_budget: r.trim.budget,
      words_used: r.trim.totalWords,
      bullets_kept: r.trim.kept.length,
      bullets_dropped: r.trim.dropped.map((b) => b.text),
      keywords_matched: r.keywords.matched,
      keywords_missing: r.keywords.missing,
      note: "Bullets were ordered by relevance to the target role and keywords, then trimmed to fit max_pages against a measured word budget. Matched keywords are printed in bold." +
        (r.keywords.missing.length
          ? " Missing keywords were not added anywhere. Add them with profile_set only if they are true."
          : ""),
      free_tier: gate.isPro() ? undefined : "Free tier: the \"modern\" style only, and a footer credit. " + gate.upgradeText("all styles and variants", "resume_create"),
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("resume_to_markdown", {
  title: "Resume as markdown",
  description: "Return the stored profile as markdown: paste it into a form, an email or an ATS box.",
  inputSchema: { variant: z.string().optional(), target_role: z.string().optional(), max_pages: z.number().int().min(1).max(5).default(2) },
}, async (a) => {
  try {
    const p = requireProfile(a.variant);
    if (typeof p === "string") return fail(p);
    const r = renderResume(p, { style: "modern", targetRole: a.target_role, maxPages: a.max_pages });
    return ok(blocksToMarkdown(p.name, r.blocks));
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("resume_to_html", {
  title: "Printable resume HTML",
  description: "Call this tool to write the resume as semantic HTML with a print stylesheet. Returns the output path. Open the file in a browser and print it to PDF.",
  inputSchema: {
    variant: z.string().optional(), target_role: z.string().optional(),
    max_pages: z.number().int().min(1).max(5).default(2).describe("Bullets are trimmed to fit this many pages against a measured word budget. Default 2."),
    out_path: z.string().optional().describe("Where to write the .html. Defaults to <data dir>/documents/<name>-resume.html, numbered -2, -3, ... if that exists."),
    overwrite: z.boolean().default(false).describe("Replace an existing file at out_path. Default false: the call fails and nothing is written."),
  },
}, async (a) => {
  try {
    const p = requireProfile(a.variant);
    if (typeof p === "string") return fail(p);
    const r = renderResume(p, { style: "modern", targetRole: a.target_role, maxPages: a.max_pages });
    const blocks: Block[] = [{ type: "heading", level: 1, text: p.name }, ...r.blocks];
    const path = outputPath(a.out_path, `${slug(p.name)}-resume.html`, ".html", a.overwrite);
    writeFileSync(path, toHtml(p.name, cleanBlocks(blocks)), "utf8");
    return ok(`${path}\n\nOpen it in a browser and use Print > Save as PDF. There is no doc_to_pdf tool here: every pure-JavaScript route to PDF needs a native dependency.`);
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

server.registerTool("resume_read", {
  title: "Read an existing resume .docx",
  description: "Call this tool to extract an existing Word resume into the profile shape: name, contact, summary, skills, roles with bullets, education. Returns the parsed profile, the sections found, and anything unparsed.",
  inputSchema: {
    path: z.string().min(1).describe("Path to an existing .docx. Legacy .doc and .rtf are not readable here. Parsed best effort, section by heading."),
    save: z.boolean().default(false).describe("Store the result as the profile. Default false: nothing is saved. Review the result first."),
    variant: z.string().optional(),
  },
}, async (a) => {
  try {
    const file = expandPath(a.path);
    if (!/\.docx$/i.test(file)) return fail(`${file} is not a .docx file. Legacy .doc and .rtf are not readable here.`);
    const blocks = readDocx(readFileSync(file));
    const r = blocksToProfile(blocks);
    if (a.save) {
      if (a.variant && normalizeVariant(a.variant) !== "default" && !gate.isPro()) return fail(proOnly("Profile variants"));
      if (!r.profile.name) return fail("no name could be read from the document, so nothing was saved. Call again with save: false, then pass the corrected fields to profile_set.");
      await locked(() => setProfile(a.variant, r.profile));
    }
    return json({
      saved: a.save,
      sections_found: r.sectionsFound,
      roles: r.profile.experience.length,
      unparsed: r.unparsed,
      profile: r.profile,
      note: "Best effort, section by heading. Check every field before you send the result anywhere; correct it with profile_set." + (a.save ? "" : " Nothing was saved: call again with save: true, or pass the corrected fields to profile_set."),
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ----------------------------------------------------------- cover letter */

server.registerTool("cover_letter_create", {
  title: "Write a cover letter .docx",
  description: "Call this tool to write a one-page cover letter from the stored profile: opening, fit, proof, close. Returns the output path, the word count, and every bracketed prompt left for you to fill in.",
  inputSchema: {
    company: z.string().min(1),
    role: z.string().min(1),
    hiring_manager: z.string().optional(),
    job_description: z.string().optional().describe("Paste the posting. Used only to pick which of your own skills to lead with; no figure from the posting is ever restated as yours."),
    tone: z.enum(["formal", "direct", "warm"]).default("formal").describe("Default \"formal\"."),
    highlights: z.array(z.string()).optional().describe("Points to lead with. Each is checked against the profile; anything not found there is returned as a bracketed prompt, not printed as fact."),
    out_path: z.string().optional().describe("Where to write the .docx. Defaults to <data dir>/documents/<company>-<role>-cover-letter.docx, numbered -2, -3, ... if that exists."),
    overwrite: z.boolean().default(false).describe("Replace an existing file at out_path. Default false: the call fails and nothing is written."),
  },
  }, async (a) => {
  try {
    const p = requireProfile(undefined);
    if (typeof p === "string") return fail(p);
    const month = new Date().toISOString().slice(0, 7);
    if (!gate.isPro()) {
      const used = lettersInMonth(month).length;
      if (used >= FREE_LETTERS_PER_MONTH) {
        return fail(`You have already written ${used} cover letters in ${month}. The free tier allows ` +
          `${FREE_LETTERS_PER_MONTH} per calendar month; resume_create, resume_to_markdown and resume_to_html stay unlimited.\n\n` +
          gate.upgradeText("unlimited cover letters", "cover_letter_create"));
      }
    }
    const letter = buildLetter(p, {
      company: a.company, role: a.role, hiring_manager: a.hiring_manager,
      job_description: a.job_description, tone: a.tone as Tone, highlights: a.highlights,
    });
    // Nothing numeric may appear that no allowed source states. A hit here is a bug, not a warning.
    // The posting is deliberately NOT a source: its revenue figures, headcounts and throughput
    // numbers are the employer's, and the letter may never restate one as the candidate's.
    const sources = [JSON.stringify(p), a.company, a.role, a.hiring_manager ?? "", ...(a.highlights ?? [])];
    const bad = unsourcedNumbers(letter.text, sources);
    if (bad.length) return fail(`refusing to write the letter: it states ${bad.join(", ")}, which your profile does not. Figures from the posting are the employer's and are never restated as yours. This is a bug; please report it.`);

    const path = outputPath(a.out_path, `${slug(a.company)}-${slug(a.role)}-cover-letter.docx`, ".docx", a.overwrite);
    const buf = await buildDocx({
      title: clean(`${a.role} - ${a.company}`),
      blocks: cleanBlocks(letter.blocks),
      style: "letter",
      business: sender(p, gate.isPro()),
      pro: gate.isPro(),
      recipient: [a.hiring_manager, a.company].filter(Boolean).join("\n"),
    });
    writeFileSync(path, buf);
    let note = "";
    try { await locked(() => addLetter({ id: randomBytes(4).toString("hex"), company: a.company, role: a.role, path, created: new Date().toISOString() })); }
    catch (e) { note = `\n\nThe file was written but could not be added to the letter history: ${String((e as Error).message ?? e)}`; }
    const usedNow = gate.isPro() ? null : lettersInMonth(month).length;
    return json({
      path,
      words: letter.words,
      fills_required: letter.prompts,
      highlights_used: letter.usedHighlights,
      highlights_not_in_profile: letter.unverifiedHighlights,
      skills_the_posting_asked_for: letter.matchedSkills,
      number_check: `every figure in the letter traces to your profile; no figure from the posting was restated as yours`,
      free_tier: usedNow === null ? undefined : `${usedNow} of ${FREE_LETTERS_PER_MONTH} free letters used in ${month}. The free tier allows ${FREE_LETTERS_PER_MONTH} cover letters per calendar month; resume_create, resume_to_markdown and resume_to_html stay unlimited.`,
      note: "This letter states no fact that is not in your profile; anything it did not know was left as a bracketed prompt such as [add: metric]. " +
        (letter.prompts.length ? "Fill every [add: ...] prompt before you send this." : "No gaps: nothing was left bracketed.") + note,
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* ----------------------------------------------------------------- tailor */

server.registerTool("tailor_to_job", {
  title: "Gap analysis against a posting",
  description: "READ-ONLY gap analysis against a posting: writes nothing, changes nothing. Returns matched keywords, missing ones, a coverage figure and orderings of facts you already stated. Act on it with resume_create.",
  inputSchema: {
    job_description: z.string().min(1).describe("Paste the posting. The free tier reads up to 2,000 characters; Pro reads any length."),
    variant: z.string().optional(),
    limit: z.number().int().min(5).max(60).default(30).describe("How many keywords to extract from the posting. Default 30."),
  },
}, async (a) => {
  try {
    const p = requireProfile(a.variant);
    if (typeof p === "string") return fail(p);
    if (!gate.isPro() && a.job_description.length > FREE_JD_CHARS) {
      return fail(`the job description is ${a.job_description.length} characters; the free tier reads up to ${FREE_JD_CHARS}. ` +
        `Paste the requirements section only, or go Pro for the whole posting.\n\n${gate.upgradeText("unlimited tailoring", "tailor_to_job")}`);
    }
    const g = analyseGap(p, a.job_description, a.limit);
    return json({
      variant: normalizeVariant(a.variant), ...g,
      read_only: true,
      note: "This tool wrote nothing: it is a report. Rewrites only reorder facts you already stated. A missing keyword is reported as a warning and never becomes a new claim; add one with profile_set only if it is true." +
        " To use this result, call resume_create {target_role, keywords} - profile_set is for facts the user actually stated, not for raising this score." +
        (gate.isPro() ? "" : ` Free tier: postings up to ${FREE_JD_CHARS} characters.`),
    });
  } catch (e) { return fail(String((e as Error).message ?? e)); }
});

/* -------------------------------------------------------- resource, prompt */

server.registerResource("profile", "resume://profile", {
  title: "Stored profile",
  description: "The stored CV facts, as JSON. Every tool in this server reads from here and nowhere else.",
  mimeType: "application/json",
}, async (uri) => {
  const p = getProfile();
  return {
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify(p ? { variant: "default", variants: variantNames(), profile: p } : { profile: null, hint: "run profile_set first" }, null, 2),
    }],
  };
});

server.registerPrompt("apply_to_job", {
  title: "Apply to a job",
  description: "Chain tailor_to_job, resume_create and cover_letter_create against one posting.",
  argsSchema: {
    company: z.string().describe("The employer"),
    role: z.string().describe("The role as the posting names it"),
    job_description: z.string().describe("Paste the posting"),
  },
}, ({ company, role, job_description }) => ({
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
      text: [
        `Apply to the ${role} role at ${company}. Work in this order and do not skip a step:`,
        ``,
        `1. Call tailor_to_job with this posting. Report matched, missing and coverage to me before going on.`,
        `2. Call resume_create with keywords set to the matched list from step 1, target_role "${role}", max_pages 2.`,
        `   Tell me which bullets it dropped.`,
        `3. Call cover_letter_create with company "${company}", role "${role}" and this posting as job_description.`,
        `4. List every [add: ...] prompt the letter left and ask me for each value. Do not invent any of them,`,
        `   and do not add a missing keyword to my profile unless I confirm it is true.`,
        ``,
        `Posting:`,
        job_description,
      ].join("\n"),
    },
  }],
}));

gate.registerTools(server);

/* ------------------------------------------------------------------- main */

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`mcp-resume ${VERSION} ready (${gate.isPro() ? "Pro" : "free"} tier)\n`);
}

main().catch((e) => {
  process.stderr.write(`mcp-resume failed to start: ${String((e as Error)?.stack ?? e)}\n`);
  process.exit(1);
});
