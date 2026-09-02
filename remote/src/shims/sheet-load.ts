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
import { byteLen, BIN } from "./fs.js";

export const SHEET_ROOT = "/sheets/";
/** Hard ceiling on everything one tenant keeps in KV for this endpoint. */
export const TENANT_MAX_BYTES = 2 * 1024 * 1024;

/** A sheet name is a filename, never a path: no directories, no traversal. */
export function safeName(raw: string): string {
  const base = String(raw).trim().split(/[\\/]/).pop() ?? "";
  const s = base.replace(/[^A-Za-z0-9._ -]+/g, "_").replace(/^\.+/, "").trim();
  if (!s) throw new Error("name must contain at least one letter, digit, dot, dash or space");
  return s.slice(0, 120);
}

export function tenantBytes(): number {
  let n = 0;
  for (const [k, v] of ctx().files) if (k.startsWith(SHEET_ROOT)) n += byteLen(v) + k.length;
  return n;
}

const ok = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: `Error: ${t}` }], isError: true as const });

export function registerSheetLoad(server: { registerTool: Function }): void {
  server.registerTool("sheet_load", {
    title: "Load a sheet into this session",
    description:
      "Upload data to work on. This hosted endpoint has no filesystem, so instead of a file path you send the data once with sheet_load and then pass its name as `path` to sheet_info, sheet_read, sheet_query, sheet_stats, sheet_find, sheet_add_column, sheet_convert and sheet_write. " +
      "Give either csv (raw text, comma or tab separated) or xlsx_base64 (a base64-encoded .xlsx workbook). Loaded sheets are kept for your token and survive between calls; the total is capped at 2 MB per token. " +
      "Files the other tools write come back as a download link that is valid for one hour.",
    inputSchema: {
      name: z.string().min(1).max(120).describe('Name to refer to this data by, e.g. "sales" or "sales.csv"'),
      csv: z.string().optional().describe("Raw CSV or TSV text, including the header row"),
      xlsx_base64: z.string().optional().describe("Base64-encoded .xlsx workbook"),
    },
  }, async (a: { name: string; csv?: string; xlsx_base64?: string }) => {
    try {
      if (!a.csv && !a.xlsx_base64) return fail("give either csv or xlsx_base64");
      if (a.csv && a.xlsx_base64) return fail("give csv or xlsx_base64, not both");
      const base = safeName(a.name).replace(/\.(csv|tsv|txt|xlsx|xlsm|json)$/i, "");
      const ext = a.xlsx_base64 ? "xlsx" : /\t/.test((a.csv ?? "").split("\n")[0] ?? "") ? "tsv" : "csv";
      const path = `${SHEET_ROOT}${base}.${ext}`;
      const c = ctx();

      let value: string;
      let bytes: number;
      if (a.xlsx_base64) {
        let buf: Buffer;
        try { buf = Buffer.from(a.xlsx_base64.replace(/\s+/g, ""), "base64"); }
        catch { return fail("xlsx_base64 is not valid base64"); }
        if (buf.length === 0) return fail("xlsx_base64 decoded to zero bytes");
        if (buf[0] !== 0x50 || buf[1] !== 0x4b) return fail("that base64 does not decode to an xlsx workbook (no PK zip header)");
        value = BIN + buf.toString("base64");
        bytes = buf.length;
      } else {
        value = a.csv!;
        bytes = byteLen(value);
      }

      const existing = c.files.has(path) ? byteLen(c.files.get(path)!) : 0;
      const after = tenantBytes() - existing + bytes + path.length;
      if (after > TENANT_MAX_BYTES) {
        return fail(
          `that would put this token at ${(after / 1048576).toFixed(2)} MB of loaded sheets and the hosted cap is ${TENANT_MAX_BYTES / 1048576} MB. ` +
          `Nothing was loaded. Drop a sheet with sheet_unload, send fewer columns or rows, or run the server locally where there is no cap: npx -y @theluckystrike/mcp-spreadsheet`);
      }

      const replaced = c.files.has(path);
      for (const other of [...c.files.keys()]) {
        if (other !== path && other.startsWith(`${SHEET_ROOT}${base}.`)) c.files.delete(other);
      }
      c.files.set(path, value);
      c.dirs.add("/sheets");

      const lines = a.csv ? a.csv.split(/\r?\n/).filter((l) => l.trim() !== "").length : 0;
      return ok(
        `${replaced ? "Replaced" : "Loaded"} ${JSON.stringify(base)} (${ext}, ${bytes} bytes${lines ? `, ${lines} lines including the header` : ""}).\n` +
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
    inputSchema: { name: z.string().min(1).max(120) },
  }, async (a: { name: string }) => {
    try {
      const c = ctx();
      const base = safeName(a.name).replace(/\.(csv|tsv|txt|xlsx|xlsm|json)$/i, "");
      let n = 0;
      for (const k of [...c.files.keys()]) {
        if (k === `${SHEET_ROOT}${base}` || k.startsWith(`${SHEET_ROOT}${base}.`)) { c.files.delete(k); n++; }
      }
      if (n === 0) return fail(`nothing loaded under the name ${JSON.stringify(base)}. Use sheet_files to see what is loaded.`);
      return ok(`Deleted ${JSON.stringify(base)}. Loaded for this token: ${(tenantBytes() / 1024).toFixed(1)} KB of ${TENANT_MAX_BYTES / 1048576} MB.`);
    } catch (e) { return fail(String((e as Error).message ?? e)); }
  });
}
