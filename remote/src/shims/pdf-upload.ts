/**
 * The hosted pdf endpoint has no disk, so an input PDF is uploaded instead of opened:
 * pdf_upload {name, pdf_base64} writes /uploads/<name>.pdf into the per-tenant virtual
 * filesystem, and every `path` / `paths[]` argument of every pdf tool is that name
 * (see the expandPath rewrite in remote/build-vendor.mjs).
 *
 * Outputs land under /out/ and become one-hour download links; they are also kept in
 * the tenant document, so a merged file can be stamped by a later call the same way a
 * file on a disk could.
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
/** Everything a pdf tool writes lands here and comes back as a download link. */
export const OUT_ROOT = "/out/";
/**
 * Hard ceiling on one uploaded PDF. The 256 KB request-body cap binds long first: a
 * base64 payload inside a JSON-RPC envelope leaves roughly 190 KB of actual PDF.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** A PDF name is a bare identifier, never a path: rejected, never sanitised. */
export function safePdfName(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) throw new Error("name is required");
  if (/[\\/]/.test(s)) throw new Error("name is a document name, not a path: it cannot contain / or \\");
  if (s.includes("..")) throw new Error('name cannot contain ".."');
  if (s.startsWith(".")) throw new Error("name cannot start with a dot");
  const base = s.replace(/\.pdf$/i, "");
  if (!NAME_RE.test(base)) {
    throw new Error(
      "name must be 1-64 characters of letters, digits, underscore or dash, optionally with a " +
      '.pdf extension (for example "invoice" or "invoice.pdf")');
  }
  return base;
}

/** The magic check the base64 path runs, shared with the url path. */
export function verifyPdfMagic(buf: Buffer): void {
  if (!buf.subarray(0, 1024).toString("latin1").includes("%PDF-")) {
    throw new Error("that file is not a PDF (no %PDF- header in the first kilobyte). Nothing was stored.");
  }
}

/** Store PDF bytes under /uploads/<name>.pdf. The one write path for base64 and url. */
export function stagePdfBuffer(name: string, buf: Buffer): string {
  const base = safePdfName(name);
  const path = `${UPLOAD_ROOT}${base}.pdf`;
  if (buf.length === 0) throw new Error("that PDF is zero bytes");
  verifyPdfMagic(buf);
  if (buf.length > MAX_UPLOAD_BYTES) {
    throw new Error(
      `that PDF is ${(buf.length / 1048576).toFixed(2)} MB and the hosted cap is ${MAX_UPLOAD_BYTES / 1048576} MB per file. ` +
      `Nothing was stored. Run the server locally over stdio (npx -y @theluckystrike/mcp-pdf), where there is no cap.`);
  }
  const c = ctx();
  writeFileSync(path, BIN + buf.toString("base64"));
  c.dirs.add("/uploads");
  return path;
}

/**
 * Decode a base64 PDF and store it under /uploads/<name>.pdf. Returns the virtual path,
 * which every tool's `path` argument resolves to. Throws with caller-facing text.
 */
export function stagePdfUpload(name: string, b64: string): string {
  safePdfName(name);
  let buf: Buffer;
  try { buf = Buffer.from(String(b64).replace(/\s+/g, ""), "base64"); }
  catch { throw new Error("pdf_base64 is not valid base64"); }
  if (buf.length === 0) throw new Error("pdf_base64 decoded to zero bytes");
  if (!buf.subarray(0, 1024).toString("latin1").includes("%PDF-")) {
    throw new Error("that base64 does not decode to a PDF (no %PDF- header in the first kilobyte). Send the file's bytes base64-encoded.");
  }
  return stagePdfBuffer(name, buf);
}

const ok = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: `Error: ${t}` }], isError: true as const });

export function registerPdfUpload(server: { registerTool: Function }): void {
  server.registerTool("pdf_upload", {
    title: "Upload a PDF to work on",
    description:
      "Send a PDF to this hosted endpoint. There is no filesystem here, so instead of a path you upload the file once with pdf_upload and then pass its name as `path` (or inside `paths`) to pdf_info, pdf_count, pdf_merge, pdf_split, pdf_pages, pdf_rotate, pdf_stamp, pdf_reorder and pdf_text. " +
      "Give exactly one of pdf_base64 or url. " + URL_ARG_DESCRIPTION + ": pasting a large base64 payload is slow to write out and can stall the turn before the call is ever sent, while a url costs one line and the fetch happens here. " +
      "Uploads are kept for your token between calls; pdf_files lists them and pdf_delete_upload removes one. " +
      "A file this server writes is named the same way and comes back as a download link valid for one hour. " +
      "The request body cap is 256 KB, which is about 190 KB of PDF once base64-encoded; a url is fetched with a 10 second timeout, at most 3 redirects, public http(s) hosts only, and is capped at 2 MB.",
    inputSchema: {
      name: z.string().min(1).max(70).describe('Name to refer to this PDF by: 1-64 characters of letters, digits, underscore or dash, e.g. "invoice"'),
      pdf_base64: z.string().optional().describe("The PDF file, base64-encoded"),
      url: z.string().optional().describe(URL_ARG_DESCRIPTION + ". Public http(s) only; private, link-local and this endpoint's own zone are refused"),
    },
  }, async (a: { name: string; pdf_base64?: string; url?: string }) => {
    try {
      const which = exactlyOne({ pdf_base64: a.pdf_base64, url: a.url });
      let path: string;
      let source = "";
      if (which === "url") {
        const f = await fetchUpload(a.url!, { maxBytes: MAX_UPLOAD_BYTES, label: "PDF", verify: verifyPdfMagic });
        path = stagePdfBuffer(a.name, f.buf);
        source = `\nFetched ${f.bytes} bytes from ${f.host}${f.redirects ? ` after ${f.redirects} redirect(s)` : ""}.`;
      } else {
        path = stagePdfUpload(a.name, a.pdf_base64!);
      }
      const bytes = byteLen(ctx().files.get(path)!);
      return ok(
        `Uploaded ${JSON.stringify(path.slice(UPLOAD_ROOT.length))} (${bytes} bytes).${source}\n` +
        `Pass path: ${JSON.stringify(path.slice(UPLOAD_ROOT.length, -4))} to any pdf tool.`);
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });

  server.registerTool("pdf_files", {
    title: "List uploaded and generated PDFs",
    description: "List the PDFs stored for your token: what you uploaded, and what this server has written, with their sizes.",
    inputSchema: {},
  }, async () => {
    const c = ctx();
    const uploaded = [...c.files.entries()]
      .filter(([k]) => k.startsWith(UPLOAD_ROOT))
      .map(([k, v]) => ({ name: k.slice(UPLOAD_ROOT.length), bytes: byteLen(v) }));
    const generated = [...c.files.entries()]
      .filter(([k]) => k.startsWith(OUT_ROOT))
      .map(([k, v]) => ({ name: k.slice(OUT_ROOT.length), bytes: byteLen(v) }));
    return ok(JSON.stringify({
      uploaded, generated,
      note: uploaded.length || generated.length ? undefined : "Nothing stored yet. Use pdf_upload {name, pdf_base64}.",
    }, null, 2));
  });

  server.registerTool("pdf_delete_upload", {
    title: "Delete a stored PDF",
    description: "Delete one PDF stored for your token, uploaded or generated.",
    inputSchema: { name: z.string().min(1).max(70) },
  }, async (a: { name: string }) => {
    try {
      const base = safePdfName(a.name);
      const c = ctx();
      for (const root of [UPLOAD_ROOT, OUT_ROOT]) {
        const path = `${root}${base}.pdf`;
        if (c.files.has(path)) { unlinkSync(path); return ok(`Deleted ${JSON.stringify(base)}.`); }
      }
      return fail(`nothing stored under the name ${JSON.stringify(base)}. Use pdf_files to see what is stored.`);
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });
}
