/**
 * The hosted image endpoint has no disk, so an input image is uploaded instead of
 * opened: image_upload {name, image_base64} writes /uploads/<name>.<ext> into the
 * per-tenant virtual filesystem, and every `path` argument - and every entry of
 * `paths[]` - of every image tool is that name (see the expandPath rewrite in
 * remote/build-vendor.mjs). This is the same shape servers/pdf uses over pdf_upload.
 *
 * Outputs land under /out/ and become one-hour download links served with the real
 * image content type; they are also kept in the tenant document, so a resized file
 * can be cropped or compressed by a later call the way a file on a disk could.
 *
 * Uploads are the tenant's own data: they go through the fs shim, so they are counted
 * against the endpoint's byte and file caps like anything else.
 */
import { Buffer } from "node:buffer";
import { z } from "zod";
import { ctx } from "./ctx.js";
import { byteLen, writeFileSync, unlinkSync, BIN } from "./fs.js";

export const UPLOAD_ROOT = "/uploads/";
/** Everything an image tool writes lands here and comes back as a download link. */
export const OUT_ROOT = "/out/";
/**
 * Hard ceiling on one uploaded image. The 256 KB request-body cap binds long first: a
 * base64 payload inside a JSON-RPC envelope leaves roughly 190 KB of actual image.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** The extensions this endpoint stores, in the spelling servers/image/src/imageio.ts uses. */
export const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tif", ".tiff"];

/** Magic bytes only, never the caller's claimed extension. */
function sniff(b: Uint8Array): { format: string; ext: string } | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { format: "png", ext: ".png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { format: "jpeg", ext: ".jpg" };
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { format: "gif", ext: ".gif" };
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return { format: "bmp", ext: ".bmp" };
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
    (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a))) return { format: "tiff", ext: ".tif" };
  return null;
}

/** An image name is a bare identifier, never a path: rejected, never sanitised. */
export function safeImageName(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) throw new Error("name is required");
  if (/[\\/]/.test(s)) throw new Error("name is an image name, not a path: it cannot contain / or \\");
  if (s.includes("..")) throw new Error('name cannot contain ".."');
  if (s.startsWith(".")) throw new Error("name cannot start with a dot");
  const base = s.replace(/\.(png|jpe?g|bmp|gif|tiff?)$/i, "");
  if (!NAME_RE.test(base)) {
    throw new Error(
      "name must be 1-64 characters of letters, digits, underscore or dash, optionally with a " +
      '.png, .jpg, .bmp, .gif or .tif extension (for example "shot" or "shot.png")');
  }
  return base;
}

/**
 * Decode a base64 image and store it under /uploads/<name>.<ext>, where the extension
 * comes from the magic bytes rather than from anything the caller said. Returns the
 * virtual path, which every tool's `path` argument resolves to.
 */
export function stageImageUpload(name: string, b64: string): { path: string; format: string } {
  const base = safeImageName(name);
  let buf: Buffer;
  try { buf = Buffer.from(String(b64).replace(/\s+/g, ""), "base64"); }
  catch { throw new Error("image_base64 is not valid base64"); }
  if (buf.length === 0) throw new Error("image_base64 decoded to zero bytes");
  const kind = sniff(buf);
  if (!kind) {
    throw new Error(
      "that base64 does not start with the magic bytes of a PNG, JPEG, BMP, GIF or TIFF, so nothing was stored. " +
      "Send the image file's own bytes, base64-encoded.");
  }
  if (buf.length > MAX_UPLOAD_BYTES) {
    throw new Error(
      `that image is ${(buf.length / 1048576).toFixed(2)} MB and the hosted cap is ${MAX_UPLOAD_BYTES / 1048576} MB per file. ` +
      `Nothing was stored. Run the server locally over stdio (npx -y @theluckystrike/mcp-image), where there is no cap.`);
  }
  const path = `${UPLOAD_ROOT}${base}${kind.ext}`;
  const c = ctx();
  // One name is one image: a second upload under the same name replaces every spelling
  // of it, so "shot" can never resolve to a stale shot.png beside a fresh shot.jpg.
  for (const e of IMAGE_EXTS) {
    const other = `${UPLOAD_ROOT}${base}${e}`;
    if (other !== path && c.files.has(other)) unlinkSync(other);
  }
  writeFileSync(path, BIN + buf.toString("base64"));
  c.dirs.add("/uploads");
  return { path, format: kind.format };
}

const ok = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: `Error: ${t}` }], isError: true as const });

export function registerImageUpload(server: { registerTool: Function }): void {
  server.registerTool("image_upload", {
    title: "Upload an image to work on",
    description:
      "Send an image to this hosted endpoint. There is no filesystem here, so instead of a path you upload the file once with image_upload and then pass its name as `path` (or inside `paths`) to image_info, image_resize, image_convert, image_compress, image_crop, image_thumbnails, image_batch_resize and image_dominant_colors. " +
      "PNG, JPEG, BMP, GIF and TIFF are accepted and the format is read from the file's magic bytes, not from the name. " +
      "Uploads are kept for your token between calls; image_files lists them and image_delete_upload removes one. " +
      "A file this server writes is named the same way and comes back as a download link valid for one hour, served with the real image content type. " +
      "The request body cap is 256 KB, which is about 190 KB of image once base64-encoded. In practice the binding limit is much lower, because the base64 has to be written out in full as an argument to this call: a few tens of KB of base64 is a long tool call and 50 KB or more can stall the turn before the upload is ever sent. Keep a paste to roughly 20 KB of base64 (about 15 KB of image), shrink the file first, or run this server over stdio where a real photo is read from disk by path.",
    inputSchema: {
      name: z.string().min(1).max(70).describe('Name to refer to this image by: 1-64 characters of letters, digits, underscore or dash, e.g. "shot"'),
      image_base64: z.string().describe("The image file, base64-encoded"),
    },
  }, async (a: { name: string; image_base64: string }) => {
    try {
      const { path, format } = stageImageUpload(a.name, a.image_base64);
      const bytes = byteLen(ctx().files.get(path)!);
      const name = path.slice(UPLOAD_ROOT.length);
      return ok(
        `Uploaded ${JSON.stringify(name)} (${format.toUpperCase()}, ${bytes} bytes).\n` +
        `Pass path: ${JSON.stringify(name.replace(/\.[a-z]+$/, ""))} to any image tool.`);
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });

  server.registerTool("image_files", {
    title: "List uploaded and generated images",
    description: "List the images stored for your token: what you uploaded, and what this server has written, with their sizes.",
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
      note: uploaded.length || generated.length ? undefined : "Nothing stored yet. Use image_upload {name, image_base64}.",
    }, null, 2));
  });

  server.registerTool("image_delete_upload", {
    title: "Delete a stored image",
    description: "Delete one image stored for your token, uploaded or generated.",
    inputSchema: { name: z.string().min(1).max(70) },
  }, async (a: { name: string }) => {
    try {
      const base = safeImageName(a.name);
      const c = ctx();
      for (const root of [UPLOAD_ROOT, OUT_ROOT]) {
        for (const e of ["", ...IMAGE_EXTS]) {
          const path = `${root}${base}${e}`;
          if (c.files.has(path)) { unlinkSync(path); return ok(`Deleted ${JSON.stringify(base + e)}.`); }
        }
      }
      return fail(`nothing stored under the name ${JSON.stringify(base)}. Use image_files to see what is stored.`);
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });
}
