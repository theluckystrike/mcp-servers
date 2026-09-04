/**
 * The hosted spreadsheet endpoint has no disk to open, so the caller uploads the
 * data instead: sheet_load writes a csv or xlsx into the per-tenant in-memory
 * filesystem under /sheets/<name>.<ext>, and every other tool's `path` argument
 * resolves to that same virtual file (see the expandPath rewrite in
 * remote/build-vendor.mjs). The tenant's sheets are persisted to KV.
 */
import { Buffer } from "node:buffer";
import { z } from "zod";
import { ctx } from "./ctx.js";
import { byteLen, BIN, writeFileSync, unlinkSync } from "./fs.js";
import { fetchUpload, exactlyOne, URL_ARG_DESCRIPTION } from "./fetch-upload.js";

export const SHEET_ROOT = "/sheets/";
/** Hard ceiling on everything one tenant keeps in KV for this endpoint. */
export const TENANT_MAX_BYTES = 2 * 1024 * 1024;

/** Extensions sheet_load understands; anything else is not a sheet name. */
export const SHEET_EXT = /\.(csv|tsv|txt|xlsx|xlsm|json)$/i;
/** Suffixes the fs shim and the persistence layer reserve for their own use. */
export const RESERVED_SUFFIX = /\.(tmp|lock|corrupt)$/i;
/** What a sheet name may be once the extension is off: a short, flat identifier. */
export const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * A sheet name is a bare identifier, never a path. Rejected rather than sanitised, so a
 * caller is never silently given a different file than the one it asked for: no slashes,
 * no "..", no leading dot, no reserved suffix, at most 64 chars of [A-Za-z0-9_-]. The
 * stored path is always `/sheets/<name>.<ext>` and cannot escape that prefix.
 */
export function safeName(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) throw new Error("name is required");
  if (/[\\/]/.test(s)) throw new Error("name is a sheet name, not a path: it cannot contain / or \\");
  if (s === "." || s === ".." || s.includes("..")) throw new Error('name cannot contain ".."');
  if (s.startsWith(".")) throw new Error("name cannot start with a dot");
  if (RESERVED_SUFFIX.test(s)) throw new Error("names ending .tmp, .lock or .corrupt are reserved");
  const base = s.replace(SHEET_EXT, "");
  if (!NAME_RE.test(base)) {
    throw new Error(
      "name must be 1-64 characters of letters, digits, underscore or dash, " +
      'optionally with a .csv, .tsv, .txt, .xlsx, .xlsm or .json extension (for example "sales" or "sales.csv")');
  }
  return base;
}

export function tenantBytes(): number {
  let n = 0;
  for (const [k, v] of ctx().files) if (k.startsWith(SHEET_ROOT)) n += byteLen(v) + k.length;
  return n;
}

/**
 * The magic check for a fetched sheet, the counterpart of the PK check the xlsx_base64
 * path runs. A workbook is a zip; anything else has to be delimited text, so a NUL byte
 * or a known binary header means the url points at the wrong file.
 */
export function verifySheetMagic(buf: Buffer): void {
  if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) return;           // .xlsx (zip)
  const head = buf.subarray(0, 8192);
  const binaryHeader =
    head.subarray(0, 5).toString("latin1") === "%PDF-" ||
    (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) ||
    (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff);
  if (binaryHeader || head.includes(0x00)) {
    throw new Error(
      "that file is neither delimited text (csv/tsv) nor an .xlsx workbook (no PK zip header, and the bytes are binary). " +
      "Nothing was loaded. Point at the raw CSV or the .xlsx itself, not at a page or a PDF that shows it.");
  }
}

const ok = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: `Error: ${t}` }], isError: true as const });

export function registerSheetLoad(server: { registerTool: Function }): void {
  server.registerTool("sheet_load", {
    title: "Load a sheet into this session",
    description:
      "Upload data to work on. This hosted endpoint has no filesystem, so instead of a file path you send the data once with sheet_load and then pass its name as `path` to sheet_info, sheet_read, sheet_query, sheet_stats, sheet_find, sheet_add_column, sheet_convert and sheet_write. " +
      "Give exactly one of csv (raw text, comma or tab separated), xlsx_base64 (a base64-encoded .xlsx workbook) or url. " + URL_ARG_DESCRIPTION + ": the url is fetched here with a 10 second timeout, at most 3 redirects, public http(s) hosts only, and a 2 MB cap, and a fetched file is stored as an .xlsx when it carries the PK zip header and as delimited text otherwise. " +
      "Loaded sheets are kept for your token and survive between calls; the total is capped at 2 MB per token. " +
      "Files the other tools write come back as a download link that is valid for one hour.",
    inputSchema: {
      name: z.string().min(1).max(70).describe('Name to refer to this data by: 1-64 characters of letters, digits, underscore or dash, e.g. "sales" or "sales.csv"'),
      csv: z.string().optional().describe("Raw CSV or TSV text, including the header row"),
      xlsx_base64: z.string().optional().describe("Base64-encoded .xlsx workbook"),
      url: z.string().optional().describe(URL_ARG_DESCRIPTION + ". Public http(s) only; private, link-local and this endpoint's own zone are refused"),
    },
  }, async (a: { name: string; csv?: string; xlsx_base64?: string; url?: string }) => {
    try {
      const which = exactlyOne({ csv: a.csv, xlsx_base64: a.xlsx_base64, url: a.url });
      const base = safeName(a.name);
      const c = ctx();

      let ext: string;
      let value: string;
      let bytes: number;
      let lines = 0;
      let source = "";

      if (which === "url") {
        const f = await fetchUpload(a.url!, { maxBytes: TENANT_MAX_BYTES, label: "sheet", verify: verifySheetMagic });
        source = `\nFetched ${f.bytes} bytes from ${f.host}${f.redirects ? ` after ${f.redirects} redirect(s)` : ""}.`;
        if (f.buf[0] === 0x50 && f.buf[1] === 0x4b) {
          ext = "xlsx";
          value = BIN + f.buf.toString("base64");
          bytes = f.buf.length;
        } else {
          const text = f.buf.toString("utf8").replace(/^\uFEFF/, "");
          ext = /\t/.test(text.split("\n")[0] ?? "") ? "tsv" : "csv";
          value = text;
          bytes = byteLen(text);
          lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").length;
        }
      } else if (which === "xlsx_base64") {
        let buf: Buffer;
        try { buf = Buffer.from(a.xlsx_base64!.replace(/\s+/g, ""), "base64"); }
        catch { return fail("xlsx_base64 is not valid base64"); }
        if (buf.length === 0) return fail("xlsx_base64 decoded to zero bytes");
        if (buf[0] !== 0x50 || buf[1] !== 0x4b) return fail("that base64 does not decode to an xlsx workbook (no PK zip header)");
        ext = "xlsx";
        value = BIN + buf.toString("base64");
        bytes = buf.length;
      } else {
        ext = /\t/.test((a.csv ?? "").split("\n")[0] ?? "") ? "tsv" : "csv";
        value = a.csv!;
        bytes = byteLen(value);
        lines = a.csv!.split(/\r?\n/).filter((l) => l.trim() !== "").length;
      }

      const path = `${SHEET_ROOT}${base}.${ext}`;
      const existing = c.files.has(path) ? byteLen(c.files.get(path)!) : 0;
      const after = tenantBytes() - existing + bytes + path.length;
      if (after > TENANT_MAX_BYTES) {
        return fail(
          `that would put this token at ${(after / 1048576).toFixed(2)} MB of loaded sheets and the hosted cap is ${TENANT_MAX_BYTES / 1048576} MB. ` +
          `Nothing was loaded. Drop a sheet with sheet_unload, send fewer columns or rows, or run the server locally where there is no cap: npx -y @theluckystrike/mcp-spreadsheet`);
      }

      const replaced = c.files.has(path);
      for (const other of [...c.files.keys()]) {
        if (other !== path && other.startsWith(`${SHEET_ROOT}${base}.`)) unlinkSync(other);
      }
      // Through the fs shim, so the byte and file-count counters stay exact and the
      // per-tenant file cap applies to loaded sheets as well as to written ones.
      writeFileSync(path, value);
      c.dirs.add("/sheets");

      return ok(
        `${replaced ? "Replaced" : "Loaded"} ${JSON.stringify(base)} (${ext}, ${bytes} bytes${lines ? `, ${lines} lines including the header` : ""}).${source}\n` +
        `Pass path: ${JSON.stringify(base)} to sheet_info, sheet_read, sheet_query, sheet_stats, sheet_find, sheet_add_column, sheet_convert or sheet_write.\n` +
        `Loaded for this token: ${(tenantBytes() / 1024).toFixed(1)} KB of ${TENANT_MAX_BYTES / 1048576} MB.`);
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });

  server.registerTool("sheet_files", {
    title: "List loaded sheets",
    description: "List the sheets loaded for this token, with their sizes and the storage left under the 2 MB cap.",
    inputSchema: {},
  }, async () => {
    const c = ctx();
    const files = [...c.files.entries()]
      .filter(([k]) => k.startsWith(SHEET_ROOT))
      .map(([k, v]) => ({ path: k.slice(SHEET_ROOT.length), bytes: byteLen(v) }));
    return ok(JSON.stringify({
      loaded: files,
      used_bytes: tenantBytes(),
      cap_bytes: TENANT_MAX_BYTES,
      note: files.length ? undefined : "Nothing loaded yet. Use sheet_load {name, csv} or sheet_load {name, xlsx_base64}.",
    }, null, 2));
  });

  server.registerTool("sheet_unload", {
    title: "Delete a loaded sheet",
    description: "Delete one sheet loaded for this token, freeing its space under the 2 MB cap.",
    inputSchema: { name: z.string().min(1).max(70) },
  }, async (a: { name: string }) => {
    try {
      const c = ctx();
      const base = safeName(a.name);
      let n = 0;
      for (const k of [...c.files.keys()]) {
        if (k === `${SHEET_ROOT}${base}` || k.startsWith(`${SHEET_ROOT}${base}.`)) { unlinkSync(k); n++; }
      }
      if (n === 0) return fail(`nothing loaded under the name ${JSON.stringify(base)}. Use sheet_files to see what is loaded.`);
      return ok(`Deleted ${JSON.stringify(base)}. Loaded for this token: ${(tenantBytes() / 1024).toFixed(1)} KB of ${TENANT_MAX_BYTES / 1048576} MB.`);
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });
}
