/**
 * The hosted zip endpoint has no disk, so a file is uploaded instead of opened:
 * zip_upload {name, content} (or {name, content_base64}) writes /uploads/<name><ext>
 * into the per-tenant virtual filesystem, and every `path` argument on this endpoint is
 * one of those names (see the expandPath rewrite in remote/build-vendor.mjs).
 *
 * Two kinds of file are uploaded here and both are needed:
 *   - an ARCHIVE to inspect (zip_list, zip_extract, zip_extract_text, zip_add). A name
 *     ending .zip is checked for the PK\x03\x04 local-file-header magic before it is
 *     stored, so "this is not a zip" is a refusal at upload time rather than a confusing
 *     central-directory error two calls later.
 *   - a plain FILE to pack (zip_create). Anything else is stored as given.
 *
 * Archives written by zip_create, zip_bundle_month and the files zip_extract writes land
 * under /out/ and come back as one-hour download links; they are not persisted.
 */
import { Buffer } from "node:buffer";
import { z } from "zod";
import { ctx } from "./ctx.js";
import { byteLen, writeFileSync, unlinkSync, BIN } from "./fs.js";
import { fetchUpload, exactlyOne, URL_ARG_DESCRIPTION } from "./fetch-upload.js";

export const UPLOAD_ROOT = "/uploads/";
/** Everything a tool writes lands here and comes back as a download link. */
export const OUT_ROOT = "/out/";
/**
 * Hard ceiling on one uploaded file. The 256 KB request-body cap binds long first: a
 * base64 payload inside a JSON-RPC envelope leaves roughly 190 KB of actual file per
 * POST, and raw text roughly 250 KB.
 */
export const MAX_UPLOAD_BYTES = 1024 * 1024;

const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** An upload name is a bare identifier plus an optional extension, never a path. */
export function safeZipName(raw: string, defaultExt = ".zip"): { base: string; ext: string } {
  const s = String(raw ?? "").trim();
  if (!s) throw new Error("name is required");
  if (/[\\/]/.test(s)) throw new Error("name is an upload name, not a path: it cannot contain / or \\");
  if (s.includes("..")) throw new Error('name cannot contain ".."');
  if (s.startsWith(".")) throw new Error("name cannot start with a dot");
  if (/\.(tmp|lock|corrupt)$/i.test(s)) throw new Error("names ending .tmp, .lock or .corrupt are reserved");
  const m = /^([A-Za-z0-9_-]{1,64})(\.[A-Za-z0-9]{1,8})?$/.exec(s);
  if (!m || !NAME_RE.test(m[1])) {
    throw new Error(
      "name must be 1-64 characters of letters, digits, underscore or dash, optionally with an " +
      'extension (for example "reports", "reports.zip" or "notes.txt")');
  }
  return { base: m[1], ext: (m[2] ?? "").toLowerCase() || defaultExt };
}

/** The first four bytes of a zip local file header, an empty archive's EOCD included. */
function looksLikeZip(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return buf[0] === 0x50 && buf[1] === 0x4b && (
    (buf[2] === 0x03 && buf[3] === 0x04) ||   // local file header
    (buf[2] === 0x05 && buf[3] === 0x06) ||   // end of central directory (empty archive)
    (buf[2] === 0x06 && buf[3] === 0x06)      // zip64 EOCD, refused later by name
  );
}

/**
 * Store an uploaded file under /uploads/<name><ext>. Text is stored as text; a base64
 * payload is stored as bytes, which is the only usable form for an archive.
 */
export function stageZipUpload(name: string, content?: string, contentB64?: string): { path: string; bytes: number } {
  const { base, ext } = safeZipName(name);
  const path = `${UPLOAD_ROOT}${base}${ext}`;
  let value: string;
  let bytes: number;
  if (contentB64 !== undefined) {
    let buf: Buffer;
    try { buf = Buffer.from(String(contentB64).replace(/\s+/g, ""), "base64"); }
    catch { throw new Error("content_base64 is not valid base64"); }
    if (buf.length === 0) throw new Error("content_base64 decoded to zero bytes");
    if (ext === ".zip" && !looksLikeZip(buf)) {
      throw new Error(
        `those bytes do not start with the zip magic "PK" (first bytes ${[...buf.subarray(0, 4)].map((b) => b.toString(16).padStart(2, "0")).join(" ")}), ` +
        "so this is not a zip archive and nothing was stored. Upload the .zip file's own bytes, base64-encoded. " +
        "To upload a plain file to pack, give the name its real extension, for example notes.txt.");
    }
    value = BIN + buf.toString("base64");
    bytes = buf.length;
  } else {
    const text = String(content ?? "");
    if (text === "") throw new Error("content is empty; send the file's text, or use content_base64 for bytes");
    if (ext === ".zip") throw new Error("a .zip is bytes, not text: upload it with content_base64");
    value = text;
    bytes = byteLen(text);
  }
  if (bytes > MAX_UPLOAD_BYTES) {
    throw new Error(
      `that file is ${(bytes / 1048576).toFixed(2)} MB and the hosted cap is ${MAX_UPLOAD_BYTES / 1048576} MB per file. ` +
      "Nothing was stored. Run the server locally over stdio (npx -y @theluckystrike/mcp-zip), where there is no cap.");
  }
  const c = ctx();
  writeFileSync(path, value);
  c.dirs.add("/uploads");
  return { path, bytes };
}

/**
 * The magic check a fetched file gets, and it depends on the name exactly as the
 * content_base64 path does: a name ending .zip must carry the PK header, anything else
 * is stored as it arrives.
 */
export function verifyZipMagicFor(name: string): (buf: Buffer) => void {
  const { ext } = safeZipName(name);
  return (buf: Buffer) => {
    if (ext === ".zip" && !looksLikeZip(buf)) {
      throw new Error(
        `those bytes do not start with the zip magic "PK" (first bytes ${[...buf.subarray(0, 4)].map((b) => b.toString(16).padStart(2, "0")).join(" ")}), ` +
        "so this is not a zip archive and nothing was stored. Point at the .zip file itself. " +
        "To fetch a plain file to pack, give the name its real extension, for example notes.txt.");
    }
  };
}

const ok = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: `Error: ${t}` }], isError: true as const });

export function registerZipUpload(server: { registerTool: Function }): void {
  server.registerTool("zip_upload", {
    title: "Upload a file or an archive",
    description:
      "Send a file to this hosted endpoint. There is no filesystem here, so instead of a path you upload the file once with zip_upload and then pass its name wherever a path is asked for: an archive to zip_list, zip_extract, zip_extract_text or zip_add, a plain file to zip_create. " +
      "Give exactly one of content_base64 (the file's bytes, the only paste form an archive can take), content (text, for a text file to pack) or url. " +
      URL_ARG_DESCRIPTION + ": the url is fetched here with a 10 second timeout, at most 3 redirects, public http(s) hosts only, and a 1 MB cap, and a name ending .zip is checked for the PK magic before anything is stored. " +
      "Uploads are kept for your token between calls; zip_files lists them and zip_delete_upload removes one. " +
      "The request body cap is 256 KB, so the practical ceiling on a paste is about 190 KB of file once it is base64 inside a JSON-RPC envelope.",
    inputSchema: {
      name: z.string().min(1).max(70).describe('Name to refer to this file by: 1-64 characters of letters, digits, underscore or dash, with an optional extension. No extension means .zip, e.g. "reports" or "notes.txt"'),
      content: z.string().optional().describe("The file as text (a .txt, .csv, .md or source file to pack). Not accepted for a .zip"),
      content_base64: z.string().optional().describe("The file's bytes, base64-encoded. This is the only paste form an archive can be uploaded in"),
      url: z.string().optional().describe(URL_ARG_DESCRIPTION + ". Public http(s) only; private, link-local and this endpoint's own zone are refused"),
    },
  }, async (a: { name: string; content?: string; content_base64?: string; url?: string }) => {
    try {
      const which = exactlyOne({ content: a.content, content_base64: a.content_base64, url: a.url });
      let path: string;
      let bytes: number;
      let source = "";
      if (which === "url") {
        const f = await fetchUpload(a.url!, { maxBytes: MAX_UPLOAD_BYTES, label: "file", verify: verifyZipMagicFor(a.name) });
        ({ path, bytes } = stageZipUpload(a.name, undefined, f.buf.toString("base64")));
        source = `\nFetched ${f.bytes} bytes from ${f.host}${f.redirects ? ` after ${f.redirects} redirect(s)` : ""}.`;
      } else {
        ({ path, bytes } = stageZipUpload(a.name, a.content, a.content_base64));
      }
      const name = path.slice(UPLOAD_ROOT.length);
      return ok(
        `Uploaded ${JSON.stringify(name)} (${bytes} bytes).${source}\n` +
        (name.endsWith(".zip")
          ? `Pass path: ${JSON.stringify(name)} to zip_list, zip_extract, zip_extract_text or zip_add.`
          : `Pass paths: [${JSON.stringify(name)}] to zip_create.`));
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });

  server.registerTool("zip_files", {
    title: "List uploaded files",
    description: "List the files stored for your token on this endpoint, with their sizes. These are the names every path argument here resolves against.",
    inputSchema: {},
  }, async () => {
    const c = ctx();
    const uploaded = [...c.files.entries()]
      .filter(([k]) => k.startsWith(UPLOAD_ROOT))
      .map(([k, v]) => ({ name: k.slice(UPLOAD_ROOT.length), bytes: byteLen(v) }));
    return ok(JSON.stringify({
      uploaded,
      note: uploaded.length ? undefined : "Nothing uploaded yet. Use zip_upload {name, content_base64}.",
    }, null, 2));
  });

  server.registerTool("zip_delete_upload", {
    title: "Delete an uploaded file",
    description: "Delete one uploaded file stored for your token. The register rows zip_history lists are kept.",
    inputSchema: { name: z.string().min(1).max(70) },
  }, async (a: { name: string }) => {
    try {
      const { base } = safeZipName(a.name);
      const c = ctx();
      let n = 0;
      for (const k of [...c.files.keys()]) {
        if (k.startsWith(`${UPLOAD_ROOT}${base}.`) || k === `${UPLOAD_ROOT}${base}`) { unlinkSync(k); n++; }
      }
      if (n === 0) return fail(`nothing uploaded under the name ${JSON.stringify(base)}. Use zip_files to see what is stored.`);
      return ok(`Deleted ${JSON.stringify(base)}.`);
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });
}
