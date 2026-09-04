#!/usr/bin/env node
/**
 * Generates servers/<name>/SPEC.md for every shipped server (office-suite excluded:
 * it is a proxy bundle, its contract is the union of its children).
 *
 * Sources, in this order:
 *   1. The built server itself, spawned over stdio: initialize, tools/list,
 *      resources/list, prompts/list. Nothing is read from src for the tool surface.
 *   2. servers/<name>/README.md for the free-vs-pro table.
 *   3. servers/<name>/src/*.ts, grepped for error-message literals (failure modes).
 *   4. The CURATED table below for invariants and storage, which cannot be probed.
 *
 * The output is deterministic: tools, resources, prompts, args and failure modes are
 * sorted, and no timestamp is written. Running it twice produces no diff.
 *
 * Usage: node scripts/gen-spec.mjs [name ...]
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

const SERVERS = [
  "bank-statement", "calendar", "clauses", "currency", "docx", "expense-tracker",
  "image", "invoice", "kanban", "pdf", "price-tracker", "recurring", "resume",
  "spreadsheet", "time-tracker", "timezone",
].sort();

const COMMON_INVARIANTS = [
  "stdout carries JSON-RPC only. Every diagnostic goes to stderr. A single stray stdout write breaks the client session.",
  "A tool never throws across the transport. Failures come back as `{ content: [{ type: \"text\", text: \"Error: ...\" }], isError: true }`.",
  "Writes are atomic: the payload goes to `<file>.<pid>.tmp` and is then `rename`d over the target, so a reader never sees a half-written file.",
  "No partial writes. When a limit or a validation refuses the operation, nothing at all is written; the tool says what was refused and why.",
  "Money is stored and compared in minor units (integer cents), never as a float. Formatting to a decimal string happens at the edge only.",
  "Dates are local calendar dates as `YYYY-MM-DD`. No implicit UTC shift is applied to a user-supplied date.",
  "A store file that fails to parse is quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `<file>.corrupt` marker; nothing is overwritten and every later call fails until a human resolves it.",
  "The load-mutate-save cycle is held under an advisory lock directory (`packages/mcp-license` `withFileLock`), so two processes sharing one data dir cannot lose each other's writes.",
];

/**
 * Hand-curated per server: what cannot be read off the wire.
 * `storage` files are relative to the data dir. `extra` invariants are appended to the
 * common list. `caps` documents the enforced limits that a contract test can assert.
 */
const CURATED = {
  "bank-statement": {
    summary: "Reads a bank CSV, OFX or QIF export into a local ledger: import, list, search, categorise with rules, summarise a period, detect recurring charges, and reconcile against the expense-tracker ledger.",
    storageFiles: [["data.json", "accounts, transactions and category rules"]],
    primaryFile: "data.json",
    caps: [
      "`FREE_ACCOUNTS` = 2 accounts on free.",
      "`FREE_WINDOW_MONTHS` = 12 months of history read back on free.",
      "`FREE_RULES` = 5 category rules on free.",
      "`FREE_RECONCILE_DAYS` = 31 days per `reconcile_expenses` answer on free. The guardrail answers over the most recent slice and names the cap (docs/GUARDRAILS_RESULT.md).",
      "`FREE_RECURRING_MONTHS` = 3 months and `FREE_RECURRING_CHARGES` = 5 charges per `recurring_detect` answer on free. It answers and names the cap; it does not refuse.",
      "`statement_export` is Pro. The refusal is an answer, not a protocol error, and no file is written.",
      "`MAX_FILE_BYTES` = 32 MB and `MAX_ROWS` = 200000 per imported statement.",
      "`MAX_REGEX_SOURCE` = 100 characters of rule pattern and `MAX_MATCH_INPUT` = 512 characters matched against it.",
    ],
    extra: [
      "Import always stores every row, on either tier. Dropping rows on the way in would make the ledger disagree with the bank; the free limit is on what is read back.",
      "`amount_minor` is a SIGNED integer: a debit is negative, a credit positive. A trailing minus (`12.50-`, the German, Polish and SAP export form) is a debit, not income (D-B1).",
      "A category rule whose `match` is empty or whitespace is refused. `description.includes(\"\")` is true for every row, so an empty rule rewrites the whole ledger (D-B2).",
      "Statement text is decoded from the bytes: a UTF-16 byte-order mark either way is honoured, UTF-8 otherwise (D-B3).",
      "`statement_export` writes through `<out>.<pid>.tmp` then `rename`, and removes the tmp file if the write fails, so a failed export leaves no partial file. Replacing an existing file is allowed but always reported.",
      "The expense-tracker ledger is read read-only, from the same XDG data root; a missing or corrupt sibling store is ignored rather than raised.",
    ],
  },
  "calendar": {
    summary: "Reads .ics calendar exports into a local store and answers questions about them: what is on, what is free, what conflicts, what is next, and writes a chosen set of events back out as a new .ics file.",
    storageFiles: [["data.json", "imported calendars, their events and the source they came from"]],
    primaryFile: "data.json",
    caps: [
      "`FREE_MAX_CALENDARS` = 2 calendars kept on free.",
      "`FREE_MAX_WINDOW_DAYS` = 31 days per question on free.",
      "`FREE_MAX_EXPORT_EVENTS` = 50 events per `event_export` on free. Over the cap nothing is written.",
      "`conflicts` over a longer window is answered for the first 31 days with the cap named, not refused (docs/GUARDRAILS_RESULT.md).",
      "Importing from a `url` or webcal feed is Pro. The refusal names the free path that gets the same result: paste the file contents as `text`.",
      "`MAX_BYTES` = 5 MB per fetched feed, `MAX_TEXT_BYTES` = 5 MB of pasted text, `MAX_WINDOW_DAYS` = 1830, `MAX_IDS` = 500, `MAX_LIST_ROWS` = 500.",
      "`MAX_CANDIDATES` = 100000 and `MAX_OCCURRENCES` = 20000 bound recurrence expansion, so an endless RRULE cannot run away.",
    ],
    extra: [
      "There is exactly one network call in the server, and only when the caller passes a `url`: one fetch, 12-second timeout, 5 MB cap, and loopback, private and cloud-metadata addresses refused before and after any redirect.",
      "Folds are rejoined on the raw bytes before decoding, so a multi-byte character split across an Outlook fold survives (D-24).",
      "`FREQ=HOURLY` is expanded; `FREQ=SECONDLY` and `FREQ=MINUTELY` are deliberately not, and the note says why. `BYSETPOS`, `BYDAY` ordinals and `RDATE`/`EXDATE` are parsed (D-12, D-14).",
      "A `DTEND` before `DTSTART` is read as zero length and says so rather than rendering a plausible appointment (D-19).",
      "A `TZID` that `Intl` does not know keeps the event, read as local time, with the reason named once per file.",
      "Exported times are written in UTC, and one occurrence of a recurring event is one addressable UID, not twelve VEVENTs sharing one.",
      "A per-process parse cache is keyed on the stored file's path, size and mtime, so four questions over a 20,000-event calendar do not re-parse it four times.",
    ],
    dropInvariants: ["Money is stored and compared in minor units"],
  },
  "image": {
    summary: "Local image work with no native dependency: read a header, resize, convert, compress, crop, thumbnail, watermark, strip metadata, batch-resize a folder, and report the dominant colours.",
    storageFiles: [["operations.json", "the last 500 operations this server performed, for the image://recent resource"]],
    primaryFile: "operations.json",
    caps: [
      "`FREE_MAX_PIXELS` = 4000000 output pixels per written file on free. The limit is on what is WRITTEN, not on what is read.",
      "`FREE_MAX_BATCH` = 5 files per `image_thumbnails` or `image_batch_resize` call on free.",
      "`FREE_MAX_COLORS` = 3 colours from `image_dominant_colors` on free. It answers with the top 3 rather than refusing, because a refusal made the model invent hex codes (docs/IMAGE_AUDIT.md).",
      "Custom `image_watermark` text is Pro; free watermarks with the business name from the shared profile.",
      "`MAX_BYTES` = 50 MB and `MAX_DIM` = 10000 px on any input, on either tier.",
    ],
    extra: [
      "`process.stdout.write` is wrapped before the transport is created: anything not beginning `{` or `[` is diverted to stderr, and `console.log/info/warn/debug` are bound to stderr outright. A decoder warning from `omggif` or `jpeg-js` on stdout killed the session (D-I1).",
      "A tier limit is an answer, not a protocol error: it comes back without `isError`, and nothing is written when one refuses a call.",
      "The operation register is best effort. The image is already on disk when the register is touched, so a corrupt register is quarantined and reported as a note on a successful answer, never as \"nothing was written\".",
      "An animated GIF is read as its first frame and the output is a still; the count of frames and that fact are stated rather than left silent (D-I2).",
      "EXIF orientation is applied on read. When the header disagrees, `image_info` prints `declared_in_header` and says a copy written here carries no EXIF block and will not be turned again (D-I3).",
      "A resize past the source resolution says the extra pixels are interpolated, not new detail (D-I4).",
      "Watermark text outside the bundled Latin-1 bitmap font is transliterated or reported, never silently drawn as nothing (D-I5).",
    ],
    dropInvariants: [
      "Money is stored and compared in minor units",
      "A store file that fails to parse is quarantined",
    ],
  },
  "kanban": {
    summary: "A local task board per project: add, move, update and finish tasks across columns, search them, see what is overdue, run a weekly review, and start a timer on the time-tracker server.",
    storageFiles: [["data.json", "boards, their columns and every task"]],
    primaryFile: "data.json",
    caps: [
      "`FREE_PROJECTS` = 3 project boards on free.",
      "`FREE_OPEN_TASKS` = 200 open tasks on free.",
      "`columns_set` (custom columns) is Pro; free boards use the default five: backlog, todo, doing, review, done.",
      "`weekly_review` is free for the current week; a past week is Pro.",
      "`MAX_TITLE` = 300, `MAX_NOTES` = 5000, `MAX_PROJECT` = 100, `MAX_ID` = 64, `MAX_COLUMN_NAME` = 40, `MAX_COLUMNS` = 12, `MAX_TAGS` = 30, `MAX_TAG` = 60, `MAX_QUERY` = 200, `MAX_MINUTES` = 100000.",
      "Listing prints 200 rows by default and `limit` reaches 2000 (`MAX_ROW_LIMIT`). The totals line still counts every row.",
    ],
    extra: [
      "A blank project name is refused, and `resolveProject` never near-matches an empty stored name, so a board with an empty name cannot swallow every later project (D-K2).",
      "`columns_set` validates the normalised list, not the raw array, so a board cannot be collapsed to one column, which would make every task on it read as done (D-K4).",
      "`task_list`, `task_search` and `overdue` cap the printed rows and say what was cut. One 5,000-task listing was 430 KB, roughly 110,000 tokens, which no client can use (D-K9).",
      "`task_start_timer` reads the sibling `time-tracker/data.json` under the same XDG data root, read-only and best effort, and warns before starting when the two stores would resolve the project name differently (D-K10).",
      "Accepted due-date forms: `YYYY-MM-DD` (a real calendar day), `today`, `tomorrow`, `yesterday`, `+Nd`, a bare weekday meaning the nearest on or after today, and `next <weekday>` meaning the nearest strictly after. Anything else is refused with the list.",
    ],
    dropInvariants: ["Money is stored and compared in minor units"],
  },
  "pdf": {
    summary: "Local PDF work with no native dependency: read a document's shape, count and extract pages, merge, split, rotate, reorder, stamp, add a business footer, and read the text back out.",
    storageFiles: [["operations.json", "the last 500 operations this server performed, for the pdf://recent resource"]],
    primaryFile: "operations.json",
    caps: [
      "`FREE_MAX_MERGE_FILES` = 5 files per `pdf_merge` on free.",
      "`FREE_MAX_PAGES` = 30 pages per file for `pdf_split`, `pdf_pages` and `pdf_rotate` on free.",
      "`pdf_stamp` is free for the `PAID` and `DRAFT` presets in their preset colours; custom text, colour and size are Pro.",
      "`pdf_watermark_business` and `pdf_reorder` are Pro.",
      "`MAX_BYTES` = 100 MB per input, `MAX_FONT_SIZE` = 1600 points, `MAX_TEXT_CHARS` = 200000 per `pdf_text` answer.",
    ],
    extra: [
      "`reserveOutput(out, overwrite, inputs)` refuses an `out_path` that resolves to, or shares an inode with, any input of the same call, before any directory is made and before any work. `overwrite: true` does not override it: it is consent to replace some other file, never to consume an input (D-P1).",
      "A tier limit is an answer, not a protocol error: it comes back without `isError`, and nothing is written when one refuses a call.",
      "The operation register is best effort. The file is already on disk when the register is touched, so a corrupt register is quarantined and reported as a note on a successful answer, never as \"nothing was written\".",
      "Stamp text is sanitised, not deleted: a whitespace control is a word separator (D-P2), and a character outside WinAnsi is transliterated (`OPLACONE` for `OPŁACONE`) with the count of replacements and the text actually drawn reported (D-P3).",
      "A stamp that does not fit is refused with the measurement, not drawn off the page: the width is compared against the room available and the overflow is named in points (D-P4).",
      "`pdf_text` is best effort and says so: it reads `Tj`, `TJ`, `'` and `\"` out of the FlateDecode content streams with `node:zlib`. A scan carries no text operators, and the answer names the exact argument that continues a truncated read (D-P6).",
    ],
    dropInvariants: [
      "Money is stored and compared in minor units",
      "A store file that fails to parse is quarantined",
    ],
  },
  "clauses": {
    summary: "A local clause library for contracts: store your own clauses, search them, and assemble a contract from a list of clause titles with variables filled in.",
    storageFiles: [["data.json", "clause library, own clauses plus imports"]],
    primaryFile: "data.json",
    caps: ["`FREE_OWN_CLAUSES` = 10 stored clauses on free.", "`FREE_ASSEMBLE_CLAUSES` = 8 clauses per assembled contract on free."],
    extra: ["`contract_assemble` refuses when a variable referenced by a clause has no value, rather than shipping a contract with an unfilled placeholder."],
  },
  "currency": {
    summary: "ECB reference rates: convert amounts, look up a rate on a past date, and read the local rate cache. One public download from the ECB, cached on disk.",
    storageFiles: [["daily.json", "latest ECB daily reference rates"], ["history.json", "the ECB 90-day / historical series"]],
    primaryFile: "daily.json",
    caps: ["`FREE_HISTORY_DAYS` = 90 days of history on free."],
    extra: [
      "The cache is the only network surface in the repo besides price-tracker: one GET of the ECB eurofxref files, no API key.",
      "A rate is reported with the ECB reference date it belongs to. The ECB publishes around 16:00 CET, so \"today\" before that resolves to the previous business day and the tool says so.",
      "Quarantine wording differs here: the store calls it `the cache file is corrupt`, because losing a cache is recoverable by re-downloading.",
    ],
  },
  "docx": {
    summary: "Writes real .docx files: documents from markdown or sections, proposals, contracts, and template filling. Reads a .docx back to text.",
    storageFiles: [["business.json", "issuer profile printed on proposals and contracts"], ["counter.json", "proposal and contract reference numbers"], ["documents.json", "documents this server has written"]],
    primaryFile: "documents.json",
    caps: ["`FREE_AGREEMENTS_PER_MONTH` = 3 proposals or contracts per calendar month on free.", "`FREE_TEMPLATE_PLACEHOLDERS` = 10 placeholders per template fill on free."],
    extra: ["A reference number is allocated only after every argument has validated, so a rejected call never burns a number."],
  },
  "expense-tracker": {
    summary: "Logs business expenses with categories, VAT, mileage and receipts, and hands the billable ones to the invoice server without double-taxing them.",
    storageFiles: [["data.json", "expenses, category rules, settings"]],
    primaryFile: "data.json",
    caps: [
      "`FREE_WINDOW_DAYS` = 30 days of history readable on free.",
      "`FREE_PROJECTS` = 3 projects on free.",
      "`FREE_RULES` = 5 category rules on free.",
      "`FREE_EXPORT_ROWS` = 200 rows per export on free. Over the cap nothing is written.",
      "`FREE_REBILL_ITEMS` = 20 items per `expense_to_invoice` handoff on free.",
    ],
    extra: [
      "`expense_add` defaults `billable` to true, so an expense logged against a project is not silently dropped from the next invoice.",
      "`expense_to_invoice` passes net amounts and the tax rate separately; it never re-applies VAT to a gross figure.",
      "`expense_mark_rebilled` is the only thing that flips the rebilled flag, and it is not implied by the export.",
    ],
  },
  "invoice": {
    summary: "Issues numbered invoices with per-line tax, discounts and multi-currency lines, renders a PDF, and reports what is overdue.",
    storageFiles: [["business.json", "issuer profile"], ["clients.json", "client records"], ["counter.json", "per-year invoice number counter"], ["invoices.json", "issued invoices"]],
    primaryFile: "invoices.json",
    caps: ["`FREE_INVOICES_PER_MONTH` = 3 invoices per calendar month on free. Over the cap nothing is stored and no number is consumed."],
    extra: [
      "The invoice number is allocated after every argument validates. An impossible `issue_date` is refused before `nextNumber()` runs, so the sequence never carries a gap.",
      "`quantity` and `unit_price` are bounded to a finite +/-1e12 and a total that is not a safe integer is refused, so `total_minor` is never `null`.",
      "Every money value printed by a tool carries its ISO currency code. A bare number is a defect.",
      "A missing business profile never blocks an invoice; the PDF prints a placeholder issuer and the response says so.",
      "`overdue_report` is free. A report about money owed is not a paywall surface.",
    ],
  },
  "price-tracker": {
    summary: "Watches a public product page for its price, keeps the history, and reports drops against a target.",
    storageFiles: [["watches.json", "watched URLs, targets and price history"]],
    primaryFile: "watches.json",
    caps: ["`FREE_WATCH_LIMIT` = 3 watches on free.", "`FREE_HISTORY_LIMIT` = 30 history points per watch on free."],
    extra: [
      "The free-tier check is re-evaluated against a freshly loaded store after the network fetch, because a limit checked before an `await` is not a limit.",
      "`watch_refresh` merges into a freshly loaded store, so a watch added during a refresh is not dropped.",
      "The page read is capped at 2 MB. Only http and https are fetched.",
      "Quarantine wording differs here: the store calls it `the price database ... is not valid JSON`.",
    ],
  },
  "recurring": {
    summary: "Recurring invoice schedules: define a cadence, see what is due, and generate the invoices through the invoice engine.",
    storageFiles: [["schedules.json", "recurring schedules"], ["history.json", "generated runs, one row per issued invoice"]],
    primaryFile: "schedules.json",
    caps: ["`FREE_ACTIVE_SCHEDULES` = 3 active schedules on free.", "`FREE_UPCOMING_DAYS` = 30 days of lookahead on free.", "`FREE_FORECAST_MONTHS` = 3 months of forecast on free."],
    extra: [
      "Reads go through the invoice engine's `readJsonFile`, so the quarantine contract is identical to invoice's.",
      "`invoice_generate_due` is idempotent per period: a period already generated is skipped, not issued twice.",
      "Month arithmetic clamps to the end of a short month rather than rolling into the next one.",
    ],
  },
  "resume": {
    summary: "Keeps a structured profile and writes resumes, cover letters and job-tailored variants from it, as markdown, HTML or .docx.",
    storageFiles: [["profiles.json", "the profile and its named variants"], ["letters.json", "cover letters written, for the per-month cap"]],
    primaryFile: "profiles.json",
    caps: ["`FREE_LETTERS_PER_MONTH` = 3 cover letters per calendar month on free.", "`FREE_JD_CHARS` = 2000 characters of job description on free."],
    extra: ["`tailor_to_job` refuses to write a claim that is not in the stored profile. Inventing experience is a defect, not a feature."],
  },
  "spreadsheet": {
    summary: "Reads, queries and writes CSV and XLSX without a native dependency: filter with an expression, compute stats, add a computed column, convert between formats.",
    storageFiles: [],
    primaryFile: null,
    caps: [
      "`FREE_MAX_ROWS` = 5000 rows and `FREE_MAX_BYTES` = 5 MB per read on free. Over the read cap the tool returns the first 5,000 rows and says what was left out.",
      "`FREE_WRITE_ROWS` = 500 rows per written file on free. Over the write cap nothing is written at all.",
    ],
    extra: [
      "This server is stateless: it owns no store under the data dir and holds nothing between calls. Every path comes from the caller.",
      "The `where` expression is evaluated by the server's own parser, never by `eval` or `Function`.",
      "The read cap truncates and says so; the write cap refuses. A partial file that looks complete is worse than no file.",
    ],
    dropInvariants: [
      "A store file that fails to parse is quarantined",
      "The load-mutate-save cycle is held under an advisory lock",
      "Money is stored and compared in minor units",
    ],
  },
  "time-tracker": {
    summary: "A stopwatch and a manual time log per project, with rates, tags, a billable flag, reports and CSV export.",
    storageFiles: [["data.json", "entries, projects and rates, the running timer"]],
    primaryFile: "data.json",
    caps: ["`FREE_WINDOW_DAYS` = 7 days of history readable on free.", "`FREE_RATED_PROJECTS` = 2 projects with a rate on free."],
    extra: [
      "`timer_stop` with no timer running is a normal answer, not an error.",
      "An entry needs either an `end` or `minutes`; `end` before `start` is refused.",
      "`entry_mark_billed` is the seam to invoice: only it flips the billed flag, so hours cannot be invoiced twice.",
    ],
  },
  "timezone": {
    summary: "Timezone arithmetic for scheduling: current time in several zones, overlap between working hours, meeting slots, DST changes, business days, and an .ics file.",
    storageFiles: [["data.json", "saved contacts with their zones and working hours"]],
    primaryFile: "data.json",
    caps: [
      "`FREE_MAX_PARTICIPANTS` = 3 participants per search on free.",
      "`FREE_MAX_DAYS` = 5 days searched on free.",
      "`FREE_MAX_CONTACTS` = 5 saved contacts on free.",
      "`FREE_ICS_PER_MONTH` = 3 .ics files per calendar month on free.",
    ],
    extra: [
      "Zone arithmetic uses the platform IANA database through `Intl`, so DST is correct without a bundled tzdata.",
      "There is no holiday calendar. `business_days` counts weekdays and says so rather than implying it knows local holidays.",
      "When no slot fits, the tool says no slot fits. It never widens the stated working hours on its own.",
    ],
  },
};

// ---------------------------------------------------------------- stdio client

function rpc(entry, env = {}) {
  const home = mkdtempSync(join(tmpdir(), "mcp-genspec-"));
  const child = spawn(process.execPath, [entry], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, XDG_DATA_HOME: join(home, "data"), XDG_CONFIG_HOME: join(home, "config"), MCP_LICENSE_KEY: "", ...env },
  });
  child.stderr.resume();
  let buf = "";
  const pending = new Map();
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      const r = pending.get(m.id);
      if (r) { pending.delete(m.id); r(m); }
    }
  });
  let id = 0;
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, res);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: mid, method, params }) + "\n");
    const t = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(`timeout on ${method}`)); } }, 20000);
    t.unref();
  });
  return {
    send,
    async init() {
      const r = await send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "gen-spec", version: "0" } });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
      return r.result;
    },
    close() { child.kill(); try { rmSync(home, { recursive: true, force: true }); } catch { /* best effort */ } },
  };
}

// ---------------------------------------------------------------- rendering

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();

/** JSON Schema (as emitted by zod-to-json-schema) -> a short type word. */
function typeOf(s) {
  if (!s || typeof s !== "object") return "any";
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (Array.isArray(s.anyOf)) return s.anyOf.map(typeOf).join(" | ");
  if (Array.isArray(s.oneOf)) return s.oneOf.map(typeOf).join(" | ");
  if (Array.isArray(s.allOf)) return s.allOf.map(typeOf).join(" & ");
  if (s.type === "array") return `${typeOf(s.items)}[]`;
  if (s.type === "object") {
    const keys = Object.keys(s.properties ?? {}).sort();
    return keys.length ? `object{${keys.join(", ")}}` : "object";
  }
  if (Array.isArray(s.type)) return s.type.join(" | ");
  return s.type ?? "any";
}

function constraints(s) {
  if (!s || typeof s !== "object") return "";
  const bits = [];
  if (s.minimum !== undefined) bits.push(`min ${s.minimum}`);
  if (s.maximum !== undefined) bits.push(`max ${s.maximum}`);
  if (s.minLength !== undefined) bits.push(`minLength ${s.minLength}`);
  if (s.maxLength !== undefined) bits.push(`maxLength ${s.maxLength}`);
  if (s.pattern) bits.push(`pattern \`${s.pattern}\``);
  if (s.default !== undefined) bits.push(`default ${JSON.stringify(s.default)}`);
  return bits.length ? ` (${bits.join(", ")})` : "";
}

function argTable(schema) {
  const props = schema?.properties ?? {};
  const required = new Set(schema?.required ?? []);
  const names = Object.keys(props).sort();
  if (!names.length) return "No arguments.\n";
  const rows = names.map((n) => {
    const p = props[n];
    return `| \`${n}\` | ${esc(typeOf(p))} | ${required.has(n) ? "yes" : "no"} | ${esc((p?.description ?? "") + constraints(p))} |`;
  });
  return ["| arg | type | required | description |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
}

/** The free-vs-pro markdown table out of the server README. */
function freeProTable(name) {
  const p = join(REPO, "servers", name, "README.md");
  if (!existsSync(p)) return "_No README.md._\n";
  const lines = readFileSync(p, "utf8").split("\n");
  const start = lines.findIndex((l) => /^#{2,3}\s+free\s+vs\.?\s+pro/i.test(l.trim()));
  if (start < 0) return "_No \"Free vs Pro\" section in the README._\n";
  const out = [];
  let seen = false;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{1,6}\s/.test(l)) break;
    if (l.trim().startsWith("|")) { out.push(l.trimEnd()); seen = true; }
    else if (seen && !l.trim()) break;
  }
  return out.length ? out.join("\n") + "\n" : "_No table under \"Free vs Pro\" in the README._\n";
}

/**
 * Failure modes: the literal head of every error message constructed in src.
 * Matches `fail("...")`, `err("...")`, `bad("...")` and `new *Error("...")`, keeping the
 * literal prefix up to the first interpolation. Sorted and deduped, so it is stable.
 */
function failureModes(name) {
  const dir = join(REPO, "servers", name, "src");
  if (!existsSync(dir)) return [];
  const re = /(?:\b(?:fail|err|bad)\(|new (?:[A-Za-z]+)?Error\()\s*(?:`|")((?:[^`"$\\\n]|\\.)*)/g;
  const out = new Set();
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".ts")) continue;
    const text = readFileSync(join(dir, f), "utf8");
    for (const m of text.matchAll(re)) {
      const lit = m[1].replace(/\\(.)/g, "$1").trim();
      if (lit.length >= 12) out.add(lit);
    }
  }
  return [...out].sort();
}

function invariantsFor(name) {
  const c = CURATED[name];
  const drop = c.dropInvariants ?? [];
  const base = COMMON_INVARIANTS.filter((i) => !drop.some((d) => i.startsWith(d)));
  return [...base, ...(c.extra ?? [])];
}

// ---------------------------------------------------------------- generation

async function genOne(name) {
  const c = CURATED[name];
  if (!c) throw new Error(`no curated block for ${name}`);
  const entry = join(REPO, "servers", name, "dist", "index.js");
  if (!existsSync(entry)) throw new Error(`${entry} is missing; run npm run build first`);
  const pkg = JSON.parse(readFileSync(join(REPO, "servers", name, "package.json"), "utf8"));

  const cli = rpc(entry);
  let info, tools, resources, prompts;
  try {
    info = await cli.init();
    tools = (await cli.send("tools/list", {})).result?.tools ?? [];
    const r = await cli.send("resources/list", {});
    resources = r.result?.resources ?? [];
    const p = await cli.send("prompts/list", {});
    prompts = p.result?.prompts ?? [];
  } finally {
    cli.close();
  }
  tools = [...tools].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  resources = [...resources].sort((a, b) => (a.uri < b.uri ? -1 : 1));
  prompts = [...prompts].sort((a, b) => (a.name < b.name ? -1 : 1));

  const L = [];
  L.push(`# ${name} — contract spec`);
  L.push("");
  L.push("Generated by `scripts/gen-spec.mjs` from the built server. Do not edit by hand: re-run the generator.");
  L.push("");
  L.push("| | |");
  L.push("| --- | --- |");
  L.push(`| package | \`${pkg.name}\` |`);
  L.push(`| version | ${pkg.version} |`);
  L.push(`| bin | \`${Object.keys(pkg.bin ?? {}).sort().join(", ") || "—"}\` |`);
  L.push(`| serverInfo.name | \`${esc(info?.serverInfo?.name)}\` |`);
  L.push(`| transport | stdio, JSON-RPC 2.0 |`);
  L.push(`| tools | ${tools.length} |`);
  L.push(`| resources | ${resources.length} |`);
  L.push(`| prompts | ${prompts.length} |`);
  L.push("");
  L.push("## What it does");
  L.push("");
  L.push(c.summary);
  L.push("");

  L.push(`## Tools (${tools.length})`);
  L.push("");
  L.push("| tool | description |");
  L.push("| --- | --- |");
  for (const t of tools) L.push(`| \`${t.name}\` | ${esc(t.description)} |`);
  L.push("");
  for (const t of tools) {
    L.push(`### \`${t.name}\``);
    L.push("");
    if (t.title) L.push(`Title: ${esc(t.title)}`), L.push("");
    L.push(esc(t.description) || "_No description._");
    L.push("");
    L.push(argTable(t.inputSchema));
  }

  L.push("## Resources");
  L.push("");
  if (resources.length) {
    L.push("| uri | name | description |");
    L.push("| --- | --- | --- |");
    for (const r of resources) L.push(`| \`${r.uri}\` | ${esc(r.name)} | ${esc(r.description)} |`);
  } else {
    L.push("None.");
  }
  L.push("");

  L.push("## Prompts");
  L.push("");
  if (prompts.length) {
    L.push("| name | description |");
    L.push("| --- | --- |");
    for (const p of prompts) L.push(`| \`${p.name}\` | ${esc(p.description)} |`);
  } else {
    L.push("None.");
  }
  L.push("");

  L.push("## Invariants");
  L.push("");
  for (const i of invariantsFor(name)) L.push(`- ${i}`);
  L.push("");

  L.push("## Free vs Pro");
  L.push("");
  L.push("From `servers/" + name + "/README.md`.");
  L.push("");
  L.push(freeProTable(name).trimEnd());
  L.push("");
  L.push("Enforced limits in the source:");
  L.push("");
  for (const cap of c.caps) L.push(`- ${cap}`);
  L.push("");

  L.push("## Storage");
  L.push("");
  if (c.storageFiles.length) {
    L.push("Data dir: `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/" + name + "/`");
    L.push("");
    L.push("| file | holds |");
    L.push("| --- | --- |");
    for (const [f, holds] of c.storageFiles) L.push(`| \`${f}\` | ${holds} |`);
    L.push("");
    L.push(`Primary file (the one a corrupt-store test targets): \`${c.primaryFile}\`.`);
    L.push("");
    L.push("Also written on failure: `<file>.corrupt-<timestamp>` (the quarantined original, byte-for-byte) and `<file>.corrupt` (the marker that blocks every later call). Transient: `<file>.<pid>.tmp` and the `.lock` directory.");
  } else {
    L.push("None. This server keeps no state under the data dir; every path is supplied by the caller.");
  }
  L.push("");
  L.push("Licence key lookup order: `MCP_LICENSE_KEY` env, then `${XDG_CONFIG_HOME:-~/.config}/mcp-servers/license.json`, then free tier.");
  L.push("");

  const fm = failureModes(name);
  L.push("## Failure modes");
  L.push("");
  L.push("Literal error-message heads found in `servers/" + name + "/src/*.ts`. Each is returned as `Error: <text>` with `isError: true`, sorted, truncated at the first interpolation.");
  L.push("");
  if (fm.length) for (const f of fm) L.push("- `Error: " + f.replace(/`/g, "'") + "`");
  else L.push("_None matched the literal grep; this server builds its messages entirely from interpolated values._");
  L.push("");

  const out = L.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  writeFileSync(join(REPO, "servers", name, "SPEC.md"), out);
  return { name, tools: tools.length, resources: resources.length, prompts: prompts.length, failureModes: fm.length };
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : SERVERS;
const rows = [];
for (const n of wanted) rows.push(await genOne(n));
for (const r of rows) {
  process.stdout.write(`servers/${r.name}/SPEC.md  tools=${r.tools} resources=${r.resources} prompts=${r.prompts} failure_modes=${r.failureModes}\n`);
}
