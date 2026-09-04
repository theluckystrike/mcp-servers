/**
 * The hosted bank-statement endpoint has no disk, so a statement export is uploaded
 * instead of opened: bank_upload {name, content} (or {name, content_base64}) writes
 * /uploads/<name>.<ext> into the per-tenant virtual filesystem, and statement_import's
 * `path` argument is that name (see the expandPath rewrite in remote/build-vendor.mjs).
 *
 * An export written by statement_export lands under /out/ and becomes a one-hour
 * download link; it is not kept, so the tenant document holds the ledger and the
 * uploads and nothing else.
 *
 * Uploads are the tenant's own data: they go through the fs shim, so they are counted
 * against the endpoint's byte and file caps like anything else.
 */
import { Buffer } from "node:buffer";
import { z } from "zod";
import { ctx } from "./ctx.js";
import { byteLen, writeFileSync, unlinkSync, BIN } from "./fs.js";
import { fetchUpload, exactlyOne, URL_ARG_DESCRIPTION } from "./fetch-upload.js";

export const UPLOAD_ROOT = "/uploads/";
/** Everything statement_export writes lands here and comes back as a download link. */
export const OUT_ROOT = "/out/";
/**
 * Hard ceiling on one uploaded statement. The 256 KB request-body cap binds long first:
 * raw text in a JSON-RPC envelope leaves roughly 250 KB, base64 roughly 190 KB.
 */
export const MAX_UPLOAD_BYTES = 1024 * 1024;

/** Extensions a statement may carry. The parser itself reads delimited text (csv/tsv). */
export const STATEMENT_EXTS = [".csv", ".tsv", ".txt", ".ofx", ".qif"];

const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** A statement name is a bare identifier plus an optional extension, never a path. */
export function safeBankName(raw: string): { base: string; ext: string } {
  const s = String(raw ?? "").trim();
  if (!s) throw new Error("name is required");
  if (/[\\/]/.test(s)) throw new Error("name is a statement name, not a path: it cannot contain / or \\");
  if (s.includes("..")) throw new Error('name cannot contain ".."');
  if (s.startsWith(".")) throw new Error("name cannot start with a dot");
  if (/\.(tmp|lock|corrupt)$/i.test(s)) throw new Error("names ending .tmp, .lock or .corrupt are reserved");
  const m = /^([A-Za-z0-9_-]{1,64})(\.[A-Za-z0-9]{1,8})?$/.exec(s);
  if (!m || !NAME_RE.test(m[1])) {
    throw new Error(
      "name must be 1-64 characters of letters, digits, underscore or dash, optionally with a " +
      `${STATEMENT_EXTS.join(", ")} extension (for example "september" or "september.csv")`);
  }
  const ext = (m[2] ?? "").toLowerCase();
  if (ext && !STATEMENT_EXTS.includes(ext)) {
    throw new Error(`${ext} is not a statement extension; use one of ${STATEMENT_EXTS.join(", ")}, or leave it off`);
  }
  return { base: m[1], ext: ext || ".csv" };
}

/**
 * Store an uploaded statement under /uploads/<name>.<ext>. Text is stored as text; a
 * base64 payload is stored as bytes, so a UTF-16 export from Excel still reaches
 * readStatementText with its byte-order mark intact.
 */
export function stageBankUpload(name: string, content?: string, contentB64?: string): { path: string; bytes: number } {
  const { base, ext } = safeBankName(name);
  const path = `${UPLOAD_ROOT}${base}${ext}`;
  let value: string;
  let bytes: number;
  if (contentB64 !== undefined) {
    let buf: Buffer;
    try { buf = Buffer.from(String(contentB64).replace(/\s+/g, ""), "base64"); }
    catch { throw new Error("content_base64 is not valid base64"); }
    if (buf.length === 0) throw new Error("content_base64 decoded to zero bytes");
    value = BIN + buf.toString("base64");
    bytes = buf.length;
  } else {
    const text = String(content ?? "");
    if (text.trim() === "") throw new Error("content is empty; send the statement export as text, header row included");
    value = text;
    bytes = byteLen(text);
  }
  if (bytes > MAX_UPLOAD_BYTES) {
    throw new Error(
      `that statement is ${(bytes / 1048576).toFixed(2)} MB and the hosted cap is ${MAX_UPLOAD_BYTES / 1048576} MB per file. ` +
      "Nothing was stored. Split the export by month, or run the server locally over stdio " +
      "(npx -y @theluckystrike/mcp-bank-statement), where there is no cap.");
  }
  const c = ctx();
  // Replace any other extension stored under the same name, so a name is one file.
  for (const other of [...c.files.keys()]) {
    if (other !== path && other.startsWith(`${UPLOAD_ROOT}${base}.`)) unlinkSync(other);
  }
  writeFileSync(path, value);
  c.dirs.add("/uploads");
  return { path, bytes };
}

/**
 * The magic check for a fetched statement. A bank export is delimited text (csv, tsv,
 * ofx, qif), so a zip, a PDF or an image means the url points at the wrong file. This is
 * the check the base64 path cannot run, because there content_base64 is deliberately
 * whatever bytes the caller says, BOM included.
 */
export function verifyStatementMagic(buf: Buffer): void {
  const head = buf.subarray(0, 8192);
  const bad =
    (head[0] === 0x50 && head[1] === 0x4b) ||
    head.subarray(0, 5).toString("latin1") === "%PDF-" ||
    (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) ||
    (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff);
  // A UTF-16 export from Excel is full of NUL bytes and is a legitimate statement, so
  // only a known binary header is refused here.
  if (bad) {
    throw new Error(
      "that file is not a statement export: it is a zip, a PDF or an image, not delimited text. Nothing was stored. " +
      "Point at the CSV your bank exports, not at the PDF statement.");
  }
}

const ok = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: `Error: ${t}` }], isError: true as const });

export function registerBankUpload(server: { registerTool: Function }): void {
  server.registerTool("bank_upload", {
    title: "Upload a bank statement file",
    description:
      "Send a bank export to this hosted endpoint. There is no filesystem here, so instead of a path you upload the file once with bank_upload and then pass its name as `path` to statement_import. " +
      "Give exactly one of content (the export as text, header row included - this is the normal case for a CSV), content_base64 (the file's bytes, which keeps a UTF-16 export from Excel readable) or url. " +
      URL_ARG_DESCRIPTION + ": the url is fetched here with a 10 second timeout, at most 3 redirects, public http(s) hosts only, and a 1 MB cap; the fetched file has to be delimited text, so a PDF statement is refused rather than stored. " +
      "Uploads are kept for your token between calls; bank_files lists them and bank_delete_upload removes one. " +
      "The request body cap is 256 KB, so a large export pasted as text has to be split by month.",
    inputSchema: {
      name: z.string().min(1).max(70).describe('Name to refer to this statement by: 1-64 characters of letters, digits, underscore or dash, e.g. "september"'),
      content: z.string().optional().describe("The export as text, including the header row"),
      content_base64: z.string().optional().describe("The file's bytes, base64-encoded, instead of text"),
      url: z.string().optional().describe(URL_ARG_DESCRIPTION + ". Public http(s) only; private, link-local and this endpoint's own zone are refused"),
    },
  }, async (a: { name: string; content?: string; content_base64?: string; url?: string }) => {
    try {
      const which = exactlyOne({ content: a.content, content_base64: a.content_base64, url: a.url });
      let path: string;
      let bytes: number;
      let lines = 0;
      let source = "";
      if (which === "url") {
        const f = await fetchUpload(a.url!, { maxBytes: MAX_UPLOAD_BYTES, label: "statement", verify: verifyStatementMagic });
        ({ path, bytes } = stageBankUpload(a.name, undefined, f.buf.toString("base64")));
        lines = f.buf.toString("utf8").split(/\r?\n/).filter((l) => l.trim() !== "").length;
        source = `\nFetched ${f.bytes} bytes from ${f.host}${f.redirects ? ` after ${f.redirects} redirect(s)` : ""}.`;
      } else {
        ({ path, bytes } = stageBankUpload(a.name, a.content, a.content_base64));
        lines = a.content ? a.content.split(/\r?\n/).filter((l) => l.trim() !== "").length : 0;
      }
      const name = path.slice(UPLOAD_ROOT.length);
      return ok(
        `Uploaded ${JSON.stringify(name)} (${bytes} bytes${lines ? `, ${lines} lines including the header` : ""}).${source}\n` +
        `Pass path: ${JSON.stringify(name.replace(/\.[^.]+$/, ""))} to statement_import.`);
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });

  server.registerTool("bank_files", {
    title: "List uploaded statements",
    description: "List the statement files stored for your token, with their sizes.",
    inputSchema: {},
  }, async () => {
    const c = ctx();
    const uploaded = [...c.files.entries()]
      .filter(([k]) => k.startsWith(UPLOAD_ROOT))
      .map(([k, v]) => ({ name: k.slice(UPLOAD_ROOT.length), bytes: byteLen(v) }));
    return ok(JSON.stringify({
      uploaded,
      note: uploaded.length ? undefined : "Nothing uploaded yet. Use bank_upload {name, content}.",
    }, null, 2));
  });

  server.registerTool("bank_delete_upload", {
    title: "Delete an uploaded statement",
    description: "Delete one statement file stored for your token. The transactions already imported from it are kept; transactions_list and the summary still see them.",
    inputSchema: { name: z.string().min(1).max(70) },
  }, async (a: { name: string }) => {
    try {
      const { base } = safeBankName(a.name);
      const c = ctx();
      let n = 0;
      for (const k of [...c.files.keys()]) {
        if (k.startsWith(`${UPLOAD_ROOT}${base}.`)) { unlinkSync(k); n++; }
      }
      if (n === 0) return fail(`nothing uploaded under the name ${JSON.stringify(base)}. Use bank_files to see what is stored.`);
      return ok(`Deleted ${JSON.stringify(base)}.`);
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });
}
