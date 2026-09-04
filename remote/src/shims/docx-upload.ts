/**
 * The hosted docx endpoint has no disk, so an existing .docx is uploaded instead of
 * opened: doc_upload {name, docx_base64} writes /uploads/<name>.docx into the
 * per-tenant virtual filesystem, and doc_read / doc_to_html / doc_fill_template take
 * that name as their `path` (see the expandPath rewrite in remote/build-vendor.mjs).
 * The same helper backs the `docx_base64` argument those tools gained in hosted mode,
 * which stores the file under the same root instead of asking for a separate upload.
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
/** Generated documents live here and become one-hour download links, never tenant state. */
export const DOC_ROOT = "/docs/";
/** Hard ceiling on one uploaded document. The 256 KB request-body cap binds first. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** A document name is a bare identifier, never a path: rejected, never sanitised. */
export function safeDocName(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) throw new Error("name is required");
  if (/[\\/]/.test(s)) throw new Error("name is a document name, not a path: it cannot contain / or \\");
  if (s.includes("..")) throw new Error('name cannot contain ".."');
  if (s.startsWith(".")) throw new Error("name cannot start with a dot");
  const base = s.replace(/\.docx$/i, "");
  if (!NAME_RE.test(base)) {
    throw new Error(
      "name must be 1-64 characters of letters, digits, underscore or dash, optionally with a " +
      '.docx extension (for example "contract" or "contract.docx")');
  }
  return base;
}

/** The magic check the base64 path runs, shared with the url path: a .docx is a zip. */
export function verifyDocxMagic(buf: Buffer): void {
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error("that file is not a .docx (no PK zip header). A .docx is a zip; nothing was stored.");
  }
}

/** Store .docx bytes under /uploads/<name>.docx. The one write path for base64 and url. */
export function stageDocxBuffer(name: string, buf: Buffer): string {
  const base = safeDocName(name);
  const path = `${UPLOAD_ROOT}${base}.docx`;
  if (buf.length === 0) throw new Error("that document is zero bytes");
  verifyDocxMagic(buf);
  if (buf.length > MAX_UPLOAD_BYTES) {
    throw new Error(
      `that document is ${(buf.length / 1048576).toFixed(2)} MB and the hosted cap is ${MAX_UPLOAD_BYTES / 1048576} MB per document. ` +
      `Nothing was stored. Run the server locally over stdio (npx -y @theluckystrike/mcp-docx), where there is no cap.`);
  }
  const c = ctx();
  writeFileSync(path, BIN + buf.toString("base64"));
  c.dirs.add("/uploads");
  return path;
}

/**
 * Decode a base64 .docx and store it under /uploads/<name>.docx. Returns the virtual
 * path, which every tool's `path` argument resolves to. Throws with caller-facing text.
 */
export function stageUpload(name: string, b64: string): string {
  safeDocName(name);
  let buf: Buffer;
  try { buf = Buffer.from(String(b64).replace(/\s+/g, ""), "base64"); }
  catch { throw new Error("docx_base64 is not valid base64"); }
  if (buf.length === 0) throw new Error("docx_base64 decoded to zero bytes");
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error("that base64 does not decode to a .docx (no PK zip header). A .docx is a zip; send the file's bytes base64-encoded.");
  }
  return stageDocxBuffer(name, buf);
}

const ok = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: `Error: ${t}` }], isError: true as const });

export function registerDocxUpload(server: { registerTool: Function }): void {
  server.registerTool("doc_upload", {
    title: "Upload a .docx to work on",
    description:
      "Send an existing Word document to this hosted endpoint. There is no filesystem here, so instead of a path you upload the file once with doc_upload and then pass its name as `path` to doc_read, doc_to_html and doc_fill_template. " +
      "Give exactly one of docx_base64 or url. " + URL_ARG_DESCRIPTION + ": a 13 KB base64 paste can take minutes to write out, while a url costs one line and the fetch happens here (10 second timeout, at most 3 redirects, public http(s) hosts only, 2 MB cap). " +
      "Uploads are kept for your token between calls; doc_read and doc_fill_template also take docx_base64 directly; that file is stored under the name you give (default 'inline' / 'template') and can be removed with doc_delete_upload. Documents this server writes come back as a download link valid for one hour.",
    inputSchema: {
      name: z.string().min(1).max(70).describe('Name to refer to this document by: 1-64 characters of letters, digits, underscore or dash, e.g. "contract"'),
      docx_base64: z.string().optional().describe("The .docx file, base64-encoded"),
      url: z.string().optional().describe(URL_ARG_DESCRIPTION + ". Public http(s) only; private, link-local and this endpoint's own zone are refused"),
    },
  }, async (a: { name: string; docx_base64?: string; url?: string }) => {
    try {
      const which = exactlyOne({ docx_base64: a.docx_base64, url: a.url });
      let path: string;
      let source = "";
      if (which === "url") {
        const f = await fetchUpload(a.url!, { maxBytes: MAX_UPLOAD_BYTES, label: "document", verify: verifyDocxMagic });
        path = stageDocxBuffer(a.name, f.buf);
        source = `\nFetched ${f.bytes} bytes from ${f.host}${f.redirects ? ` after ${f.redirects} redirect(s)` : ""}.`;
      } else {
        path = stageUpload(a.name, a.docx_base64!);
      }
      const bytes = byteLen(ctx().files.get(path)!);
      return ok(
        `Uploaded ${JSON.stringify(path.slice(UPLOAD_ROOT.length))} (${bytes} bytes).${source}\n` +
        `Pass path: ${JSON.stringify(path.slice(UPLOAD_ROOT.length, -5))} to doc_read, doc_to_html or doc_fill_template.`);
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });

  server.registerTool("doc_files", {
    title: "List uploaded documents",
    description: "List the documents uploaded for your token, with their sizes.",
    inputSchema: {},
  }, async () => {
    const c = ctx();
    const files = [...c.files.entries()]
      .filter(([k]) => k.startsWith(UPLOAD_ROOT))
      .map(([k, v]) => ({ name: k.slice(UPLOAD_ROOT.length), bytes: byteLen(v) }));
    return ok(JSON.stringify({
      uploaded: files,
      note: files.length ? undefined : "Nothing uploaded yet. Use doc_upload {name, docx_base64}.",
    }, null, 2));
  });

  server.registerTool("doc_delete_upload", {
    title: "Delete an uploaded document",
    description: "Delete one document uploaded for your token.",
    inputSchema: { name: z.string().min(1).max(70) },
  }, async (a: { name: string }) => {
    try {
      const base = safeDocName(a.name);
      const path = `${UPLOAD_ROOT}${base}.docx`;
      if (!ctx().files.has(path)) return fail(`nothing uploaded under the name ${JSON.stringify(base)}. Use doc_files to see what is uploaded.`);
      unlinkSync(path);
      return ok(`Deleted ${JSON.stringify(base)}.`);
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });
}
