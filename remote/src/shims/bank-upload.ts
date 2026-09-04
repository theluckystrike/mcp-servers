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

const ok = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: `Error: ${t}` }], isError: true as const });

export function registerBankUpload(server: { registerTool: Function }): void {
  server.registerTool("bank_upload", {
    title: "Upload a bank statement file",
    description:
      "Send a bank export to this hosted endpoint. There is no filesystem here, so instead of a path you upload the file once with bank_upload and then pass its name as `path` to statement_import. " +
      "Give either content (the export as text, header row included - this is the normal case for a CSV) or content_base64 (the file's bytes, which keeps a UTF-16 export from Excel readable). " +
      "Uploads are kept for your token between calls; bank_files lists them and bank_delete_upload removes one. " +
      "The request body cap is 256 KB, so a large export has to be split by month, or run over stdio. The binding limit in practice is lower, because the whole file has to be written out as an argument to this call: a few KB of CSV is quick, tens of KB is a long tool call, and 50 KB or more can stall the turn before the upload is sent. Split a big export by month.",
    inputSchema: {
      name: z.string().min(1).max(70).describe('Name to refer to this statement by: 1-64 characters of letters, digits, underscore or dash, e.g. "september"'),
      content: z.string().optional().describe("The export as text, including the header row"),
      content_base64: z.string().optional().describe("The file's bytes, base64-encoded, instead of text"),
    },
  }, async (a: { name: string; content?: string; content_base64?: string }) => {
    try {
      if (a.content === undefined && a.content_base64 === undefined) return fail("give either content or content_base64");
      if (a.content !== undefined && a.content_base64 !== undefined) return fail("give content or content_base64, not both");
      const { path, bytes } = stageBankUpload(a.name, a.content, a.content_base64);
      const name = path.slice(UPLOAD_ROOT.length);
      const lines = a.content ? a.content.split(/\r?\n/).filter((l) => l.trim() !== "").length : 0;
      return ok(
        `Uploaded ${JSON.stringify(name)} (${bytes} bytes${lines ? `, ${lines} lines including the header` : ""}).\n` +
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
