#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, readSharedProfile, withFileLock } from "@theluckystrike/mcp-license";
import QRCode from "qrcode";
import { z } from "zod";
import { epcPayload, vcardPayload, wifiPayload } from "./payloads.js";
import { LINEAR_DEFAULTS, MAX_PX, MIN_PX, checkOutPath, linearPng, linearSvg, writeAtomic, type Format } from "./render.js";
import { encodeLinear, type Symbology } from "./symbology.js";
import { addCode, countInMonth, dataDir, getCodes, lockPath, setCodes, summarize, type CodeRecord } from "./store.js";
import { VERSION } from "./version.js";

/**
 * stdout carries the JSON-RPC stream and nothing else. Nothing in this server prints, but
 * a dependency can: the same guard the image server needs for omggif is kept here so a
 * future decoder cannot break the transport with a console.log.
 */
const stdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = ((chunk: unknown, enc?: unknown, cb?: unknown): boolean => {
  const s = typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString();
  if (s.startsWith("{") || s.startsWith("[")) return stdoutWrite(chunk as string, enc as BufferEncoding, cb as () => void);
  process.stderr.write(s);
  if (typeof enc === "function") (enc as () => void)();
  else if (typeof cb === "function") (cb as () => void)();
  return true;
}) as typeof process.stdout.write;
const toStderr = (...a: unknown[]) => { process.stderr.write(a.map((x) => String(x)).join(" ") + "\n"); };
console.log = toStderr; console.info = toStderr; console.warn = toStderr; console.debug = toStderr;

const gate = createLicenseGate({ product: "barcode" });

/** Codes a free tier may generate per calendar month. */
const FREE_PER_MONTH = 20;
/** Rows a free tier may pass to barcode_batch. Pro has no batch limit. */
const FREE_BATCH = 1;
/** Hard ceiling on one batch call, both tiers: past this the answer is a script, not a chat. */
const MAX_BATCH = 500;
/** Longest payload accepted for a QR code. Version 40 at level L holds 2,953 bytes. */
const MAX_QR_BYTES = 2953;

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
/** A tier limit is an answer the model has to relay, not a protocol error. */
const limit = (text: string) => ok(text);

function locked<T>(fn: () => T | Promise<T>): Promise<T> { return withFileLock(lockPath(), fn); }

const monthOf = (d = new Date()) => d.toISOString().slice(0, 7);

/**
 * The cap check and the register row are written under ONE lock.
 *
 * Measured, not assumed: with the check in one lock and the row appended in another, two
 * processes on the same data dir drew 23 codes against an allowance of 20, because both
 * read the count before either wrote. The row is therefore appended by the same critical
 * section that reads the count, and the caller releases it if the file write then fails.
 */
async function reserve(n: number, feature: string, toolName: string, rec: Omit<CodeRecord, "id" | "created">): Promise<{ error?: string; id?: string }> {
  const id = randomBytes(4).toString("hex");
  return locked(() => {
    const rows = getCodes();
    const used = countInMonth(rows, monthOf());
    if (!gate.isPro() && used + n > FREE_PER_MONTH) {
      return {
        error:
          `The free tier generates ${FREE_PER_MONTH} codes per calendar month and ${used} have been generated in ${monthOf()}` +
          `${n > 1 ? `, so a batch of ${n} does not fit` : ""}. The count resets on the 1st. Pro has no limit.` +
          `\n\n${gate.upgradeText(feature, toolName)}`,
      };
    }
    addCode({ ...rec, id, created: new Date().toISOString() });
    return { id };
  });
}

/** Update the reserved row once the bytes exist. Best effort: the file is already written. */
async function finalize(id: string, patch: Partial<CodeRecord>): Promise<string> {
  try {
    await locked(() => {
      const rows = getCodes();
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      Object.assign(row, patch);
      setCodes(rows);
    });
    return "";
  } catch (e) {
    return `\n\nThe code was produced, but the register could not be updated: ${String((e as Error).message ?? e)}`;
  }
}

/** Give the reserved slot back when the write failed, so a bad out_path costs no allowance. */
async function release(id: string): Promise<void> {
  try { await locked(() => setCodes(getCodes().filter((r) => r.id !== id))); } catch { /* best effort */ }
}

/** Appending a row for a Pro batch: no cap applies, so the row follows the file. */
async function recordDone(rec: Omit<CodeRecord, "id" | "created">): Promise<string> {
  try {
    await locked(() => addCode({ ...rec, id: randomBytes(4).toString("hex"), created: new Date().toISOString() }));
    return "";
  } catch (e) {
    return `\n\nThe file was written, but the register could not be updated: ${String((e as Error).message ?? e)}`;
  }
}

/* ------------------------------------------------------------------ output */

const formatArg = z.enum(["svg", "png"]).optional().describe("svg (default, free) or png (Pro)");

function tierCheckFormat(format: Format, feature: string, toolName: string): string | null {
  if (format !== "png" || gate.isPro()) return null;
  return `PNG output is a Pro feature; the free tier writes SVG, which scans and prints at any size because it has no resolution. ` +
    `Ask for format: "svg" and this is free.\n\n${gate.upgradeText(feature, toolName)}`;
}

interface Written { where: string; bytes: number }

async function deliver(
  body: { svg: string } | { png: Buffer },
  outPath: string | undefined,
  format: Format,
): Promise<Written | { inline: string }> {
  if (!outPath) {
    if ("png" in body) {
      throw new Error(
        `format "png" needs out_path: a PNG is binary and this server never pastes base64 into a conversation. ` +
        `Pass out_path, for example ~/code.png. Nothing was written.`,
      );
    }
    return { inline: body.svg };
  }
  // outPath has already been through checkOutPath and is absolute by here.
  const bytes = writeAtomic(outPath, "png" in body ? body.png : body.svg);
  return { where: outPath, bytes };
}

function outLine(w: Written | { inline: string }, format: Format): string {
  return "inline" in w ? `\n\n${w.inline}` : `\nWrote ${w.where} (${w.bytes} bytes, ${format.toUpperCase()}).`;
}

/* ---------------------------------------------------------------------- QR */

const ECC = ["L", "M", "Q", "H"] as const;
type Ecc = (typeof ECC)[number];

async function renderQr(text: string, o: { ecc: Ecc; size: number; margin: number; format: Format }): Promise<{ svg: string } | { png: Buffer }> {
  const opts = { errorCorrectionLevel: o.ecc, margin: o.margin };
  if (o.format === "svg") {
    return { svg: await QRCode.toString(text, { ...opts, type: "svg", width: o.size }) };
  }
  return { png: await QRCode.toBuffer(text, { ...opts, type: "png", width: o.size }) };
}

function qrGuard(text: string): string | null {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes === 0) return "there is nothing to encode: the text is empty.";
  if (bytes > MAX_QR_BYTES) {
    return `the payload is ${bytes} bytes. The largest QR code (version 40, error correction L) holds ${MAX_QR_BYTES} bytes, ` +
      `and one that big needs a camera close enough to read 177 modules across. Put the content behind a URL and encode the URL. Nothing was written.`;
  }
  return null;
}

function sizeGuard(size: number | undefined): string | null {
  if (size === undefined) return null;
  if (!Number.isFinite(size)) return `size ${size} is not a number.`;
  if (size < MIN_PX) return `size ${size} is below ${MIN_PX} px; a QR code that small has modules under one printed dot and no scanner reads it.`;
  if (size > MAX_PX) return `size ${size} is above ${MAX_PX} px, which is a 4 m wall poster at 25 dpi. Ask for SVG instead: it prints at any size from one file.`;
  return null;
}

/* ------------------------------------------------------------------ server */

const server = new McpServer(
  { name: "mcp-barcode", version: VERSION },
  { capabilities: { tools: {} } },
);

gate.registerTools(server as unknown as { registerTool: Function });

const qrShape = {
  error_correction: z.enum(ECC).optional().describe("L 7%, M 15% (default), Q 25%, H 30% of the code recoverable when damaged"),
  size: z.number().int().optional().describe(`PNG width in pixels, ${MIN_PX} to ${MAX_PX} (default 300). SVG scales without it`),
  margin: z.number().int().min(0).max(20).optional().describe("Quiet zone in modules, default 4, which is what the QR standard requires"),
  format: formatArg,
  out_path: z.string().optional().describe("Where to write the file. SVG is returned inline when this is left out; PNG always needs it"),
  overwrite: z.boolean().optional().describe("Replace out_path if it already exists (default false)"),
};

type QrShape = {
  error_correction?: Ecc; size?: number; margin?: number; format?: Format; out_path?: string; overwrite?: boolean;
};

async function qrTool(text: string, a: QrShape, kind: string, feature: string, toolName: string, extra = "") {
  const format: Format = a.format ?? "svg";
  const tier = tierCheckFormat(format, feature, toolName);
  if (tier) return limit(tier);
  const bad = qrGuard(text) ?? sizeGuard(a.size);
  if (bad) return fail(bad);
  const ecc: Ecc = a.error_correction ?? "M";
  const size = a.size ?? 300;
  const margin = a.margin ?? 4;
  // Everything that can be refused is refused before the slot is taken.
  const target = a.out_path ? checkOutPath(a.out_path, format, a.overwrite === true) : undefined;
  const body = await renderQr(text, { ecc, size, margin, format });

  const r = await reserve(1, feature, toolName, { kind, symbology: "qr", summary: summarize(text), format, out_path: target });
  if (r.error) return limit(r.error);
  let w: Written | { inline: string };
  try {
    w = await deliver(body, target, format);
  } catch (e) {
    await release(r.id as string);
    throw e;
  }
  const note = await finalize(r.id as string, {
    bytes: "bytes" in w ? w.bytes : Buffer.byteLength((w as { inline: string }).inline),
  });
  const info = QRCode.create(text, { errorCorrectionLevel: ecc });
  return ok(
    `${kind} QR code ${r.id}: version ${info.version}, ${info.modules.size}x${info.modules.size} modules, ` +
    `error correction ${ecc}, ${Buffer.byteLength(text, "utf8")} bytes of payload.${extra}` +
    outLine(w, format) + note,
  );
}

const wrap = (fn: () => Promise<ReturnType<typeof ok>>) => fn().catch((e: unknown) => fail(String((e as Error)?.message ?? e)));

server.registerTool("qr_create", {
  title: "QR code",
  description: "Call this tool to turn text or a URL into a QR code, as an SVG returned inline or written to out_path, or as a PNG at a chosen pixel size (Pro).",
  inputSchema: { text: z.string().describe("The text or URL the code carries"), ...qrShape },
}, async (a: QrShape & { text: string }) => wrap(() => qrTool(a.text, a, "text", "qr_create PNG output", "qr_create")));

server.registerTool("qr_wifi", {
  title: "WiFi QR code",
  description: "Call this tool to make a QR code that joins a WiFi network when scanned: network name, password and security type, written to out_path or returned as SVG.",
  inputSchema: {
    ssid: z.string().describe("Network name, exactly as it appears"),
    password: z.string().optional().describe("Passphrase. Leave out only for an open network"),
    auth: z.enum(["WPA", "WEP", "nopass"]).optional().describe("WPA (default when a password is given), WEP, or nopass for an open network"),
    hidden: z.boolean().optional().describe("True if the network does not broadcast its name"),
    ...qrShape,
  },
}, async (a: QrShape & { ssid: string; password?: string; auth?: "WPA" | "WEP" | "nopass"; hidden?: boolean }) =>
  wrap(() => qrTool(wifiPayload(a), a, "wifi", "qr_wifi PNG output", "qr_wifi", ` Network "${a.ssid}".`)));

server.registerTool("qr_vcard", {
  title: "Contact QR code",
  description: "Call this tool to make a QR code that adds a contact when scanned (vCard 3.0). For your own card pass nothing: name, phone, email and address default to the shared business profile, never asked for.",
  inputSchema: {
    name: z.string().optional().describe("Full name, for example Anna Kowalska. Defaults to the shared business profile's name; pass it only for someone else's card"),
    org: z.string().optional().describe("Company or organisation"),
    title: z.string().optional().describe("Job title"),
    phone: z.string().optional().describe("Phone number, in the form it should be dialled. Defaults to the shared business profile"),
    email: z.string().optional().describe("Email address. Defaults to the shared business profile"),
    url: z.string().optional().describe("Website"),
    address: z.string().optional().describe("Postal address, one line. Defaults to the shared business profile"),
    note: z.string().optional().describe("Free note stored on the contact"),
    ...qrShape,
  },
}, async (a: QrShape & Partial<Parameters<typeof vcardPayload>[0]>) => wrap(async () => {
  // D-R64 species: your own contact card is business identity, not per-call input. A caller
  // who has run business_set once should never be asked for their own name, phone, email or
  // address again; an explicit argument still wins and is not annotated.
  const profile = readSharedProfile();
  const name = a.name ?? profile.name;
  if (!name) {
    return fail(
      `no name: pass name, or set one once in the shared business profile (the invoice server's business_set, field name) and every server in this suite uses it. Nothing was written.`,
    );
  }
  const phone = a.phone ?? profile.phone;
  const email = a.email ?? profile.email;
  const address = a.address ?? profile.address;
  const used = [
    a.name ? null : profile.name ? "name" : null,
    a.phone ? null : profile.phone ? "phone" : null,
    a.email ? null : profile.email ? "email" : null,
    a.address ? null : profile.address ? "address" : null,
  ].filter((x): x is string => x !== null);
  const from = used.length ? ` ${used.join(", ")} taken from the shared business profile.` : "";
  return qrTool(vcardPayload({ ...a, name, phone, email, address }), a, "vcard", "qr_vcard PNG output", "qr_vcard", ` Contact "${name}".${from}`);
}));

server.registerTool("qr_payment_sepa", {
  title: "SEPA payment QR code",
  description: "Call this tool for an EPC069-12 payment QR a euro banking app can scan. Amount and reference are enough: the beneficiary IBAN and name default to the shared business profile, never asked for.",
  inputSchema: {
    iban: z.string().optional().describe("Beneficiary IBAN. Defaults to the iban in the shared business profile (set once with the invoice server's business_set). Checked with ISO 7064 mod 97 and refused if it does not validate"),
    name: z.string().optional().describe("Beneficiary name, up to 70 characters. Defaults to the name in the shared business profile"),
    amount: z.number().optional().describe("Amount in EUR, 0.01 to 999999999.99. Leave out and the payer types it"),
    currency: z.string().optional().describe("EUR only; any other value is refused, because EPC encodes a SEPA credit transfer"),
    bic: z.string().optional().describe("Beneficiary BIC. Optional under EPC version 002"),
    remittance: z.string().optional().describe("Free payment text, up to 140 characters, for example an invoice number"),
    reference: z.string().optional().describe("Structured creditor reference (RF...), up to 35. Use this OR remittance, never both"),
    purpose: z.string().optional().describe("Four-letter ISO 20022 purpose code, for example GDDS"),
    ...qrShape,
  },
}, async (a: QrShape & Partial<Parameters<typeof epcPayload>[0]>) => wrap(async () => {
  // D-R64: the beneficiary is business identity, not per-call input. A caller who has run
  // business_set once should never be asked for their own IBAN again, and a model that is
  // asked stops and asks the user rather than drawing the code.
  const profile = readSharedProfile();
  const iban = a.iban ?? profile.iban;
  const name = a.name ?? profile.name;
  if (!iban) {
    return fail(
      `no IBAN: pass iban, or set one once in the shared business profile (the invoice server's business_set, field iban) and every server in this suite uses it. Nothing was written.`,
    );
  }
  if (!name) return fail(`no beneficiary name: pass name, or set it in the shared business profile. Nothing was written.`);
  const epc = epcPayload({ ...a, iban, name });
  const amount = epc.amount === undefined ? "no amount (the payer types it)" : `EUR ${epc.amount.toFixed(2)}`;
  const from = a.iban && a.name ? "" : " Beneficiary taken from the shared business profile.";
  return qrTool(epc.text, a, "sepa", "qr_payment_sepa PNG output", "qr_payment_sepa", ` Pay ${name} at ${epc.iban}, ${amount}.${from}`);
}));

/**
 * Reading the sibling invoice store, read-only and best effort, the way kanban reads
 * time-tracker: the same XDG data root, a plain JSON read, and any failure degrades to
 * "no invoice found" rather than taking this tool down. No dependency is added on the
 * invoice package, so this server still installs and runs on its own.
 */
function readInvoice(id: string): { number: string; total_minor: number; currency: string; decimals: number; client?: string } | null {
  try {
    const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
    const file = join(base, "mcp-servers", "invoice", "invoices.json");
    if (!existsSync(file)) return null;
    const rows = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>[];
    if (!Array.isArray(rows)) return null;
    const needle = String(id).trim().toLowerCase();
    const hit = rows.find((r) => String(r.number ?? "").toLowerCase() === needle)
      ?? rows.find((r) => String(r.number ?? "").toLowerCase().endsWith(needle));
    if (!hit) return null;
    return {
      number: String(hit.number),
      total_minor: Number(hit.total_minor),
      currency: String(hit.currency ?? "EUR"),
      decimals: Number.isFinite(Number(hit.decimals)) ? Number(hit.decimals) : 2,
      client: typeof (hit.client as { name?: string })?.name === "string" ? (hit.client as { name: string }).name : undefined,
    };
  } catch { return null; }
}

server.registerTool("invoice_payment_qr", {
  title: "Payment QR for an invoice",
  description: "Call this tool for a SEPA payment QR from just an amount and reference: IBAN and name are read from the shared business profile, never asked for; pass invoice_id instead to take the amount from an invoice.",
  inputSchema: {
    invoice_id: z.string().optional().describe("Invoice number, for example INV-2026-0007. Read from the invoice server's store if it is present"),
    amount: z.number().optional().describe("Amount in EUR. Overrides the invoice total; required when there is no invoice to read"),
    reference: z.string().optional().describe("Payment text, up to 140 characters. Defaults to the invoice number"),
    iban: z.string().optional().describe("Override the IBAN in the shared business profile"),
    name: z.string().optional().describe("Override the beneficiary name in the shared business profile"),
    ...qrShape,
  },
}, async (a: QrShape & { invoice_id?: string; amount?: number; reference?: string; iban?: string; name?: string }) => wrap(async () => {
  const profile = readSharedProfile();
  const iban = a.iban ?? profile.iban;
  const name = a.name ?? profile.name;
  if (!iban) {
    return fail(
      `no IBAN: pass iban, or set one once in the shared business profile (the invoice server's business_set, field iban) and every server in this suite uses it. Nothing was written.`,
    );
  }
  if (!name) return fail(`no beneficiary name: pass name, or set it in the shared business profile. Nothing was written.`);

  const inv = a.invoice_id ? readInvoice(a.invoice_id) : null;
  if (a.invoice_id && !inv && a.amount === undefined) {
    return fail(
      `invoice ${a.invoice_id} was not found in the invoice server's store, and no amount was given, so there is nothing to ask for. ` +
      `Pass amount, or create the invoice first. Nothing was written.`,
    );
  }
  let amount = a.amount;
  let note = "";
  if (inv) {
    if (inv.currency !== "EUR") {
      return fail(
        `invoice ${inv.number} is in ${inv.currency}, and an EPC payment QR code is euro only. ` +
        `A ${inv.currency} invoice is paid by bank transfer with the details on the PDF; no code was created.`,
      );
    }
    if (amount === undefined) amount = inv.total_minor / 10 ** inv.decimals;
    else if (Math.abs(amount - inv.total_minor / 10 ** inv.decimals) > 0.005) {
      note = ` The amount given (EUR ${amount.toFixed(2)}) is not the invoice total (EUR ${(inv.total_minor / 10 ** inv.decimals).toFixed(2)}); the code carries the amount given.`;
    }
  } else if (a.invoice_id) {
    note = ` Invoice ${a.invoice_id} was not found in the invoice store; the amount and reference given were used as they are.`;
  }
  const reference = a.reference ?? inv?.number ?? a.invoice_id;
  const epc = epcPayload({ iban, name, amount, remittance: reference });
  const who = inv?.client ? ` for ${inv.client}` : "";
  return qrTool(epc.text, a, "invoice", "invoice_payment_qr PNG output", "invoice_payment_qr",
    ` ${reference ?? "no reference"}${who}: pay ${name} at ${epc.iban}, ` +
    `${amount === undefined ? "no amount (the payer types it)" : `EUR ${amount.toFixed(2)}`}.${note}`);
}));

/* ------------------------------------------------------------ 1D barcodes */

const linearShape = {
  module_width: z.number().int().min(1).max(20).optional().describe("Width of the narrowest bar, in pixels or SVG units (default 2)"),
  height: z.number().int().min(10).max(1000).optional().describe("Bar height in the same units (default 80)"),
  text: z.boolean().optional().describe("Print the digits under the bars (default true)"),
  format: formatArg,
  out_path: z.string().optional().describe("Where to write the file. SVG is returned inline when this is left out; PNG always needs it"),
  overwrite: z.boolean().optional().describe("Replace out_path if it already exists (default false)"),
};

type LinearShape = { module_width?: number; height?: number; text?: boolean; format?: Format; out_path?: string; overwrite?: boolean };

const symbologyArg = z.enum(["code128", "ean13", "ean8", "upca"]).describe(
  "code128 for any printable ASCII, ean13 and ean8 for retail products, upca for North American retail",
);

function linearOptions(a: LinearShape) {
  return {
    moduleWidth: a.module_width ?? LINEAR_DEFAULTS.moduleWidth,
    height: a.height ?? LINEAR_DEFAULTS.height,
    text: a.text ?? LINEAR_DEFAULTS.text,
  };
}

server.registerTool("barcode_create", {
  title: "Barcode",
  description: "Call this tool to draw a linear barcode (code128, ean13, ean8, upca) as SVG or PNG. A short EAN or UPC gets its check digit computed; a wrong one is refused, never redrawn.",
  inputSchema: { symbology: symbologyArg, value: z.string().describe("The data to encode. Digits only for EAN and UPC"), ...linearShape },
}, async (a: LinearShape & { symbology: Symbology; value: string }) => wrap(async () => {
  const format: Format = a.format ?? "svg";
  const tier = tierCheckFormat(format, "barcode_create PNG output", "barcode_create");
  if (tier) return limit(tier);
  const enc = encodeLinear(a.symbology, a.value);
  const target = a.out_path ? checkOutPath(a.out_path, format, a.overwrite === true) : undefined;
  const o = linearOptions(a);
  const body = format === "svg" ? { svg: linearSvg(enc, o) } : { png: await linearPng(enc, o) };

  const r = await reserve(1, "barcode_create", "barcode_create", { kind: "barcode", symbology: enc.symbology, summary: summarize(enc.value), format, out_path: target });
  if (r.error) return limit(r.error);
  let w: Written | { inline: string };
  try {
    w = await deliver(body, target, format);
  } catch (e) {
    await release(r.id as string);
    throw e;
  }
  const note = await finalize(r.id as string, { bytes: "bytes" in w ? w.bytes : Buffer.byteLength((w as { inline: string }).inline) });
  const check = enc.value !== String(a.value).replace(/[\s-]/g, "") && a.symbology !== "code128"
    ? ` Check digit ${enc.value.slice(-1)} was computed and added.` : "";
  return ok(
    `${a.symbology.toUpperCase()} ${r.id}: ${enc.value}, ${enc.modules.length} modules plus a ${enc.quiet}-module quiet zone each side.${check}` +
    outLine(w, format) + note,
  );
}));

server.registerTool("barcode_batch", {
  title: "Barcodes in bulk",
  description: "Call this tool to draw many barcodes or QR codes at once from a list of rows, each with its own value and file name, into out_dir. Pro; the free tier does one code per call.",
  inputSchema: {
    out_dir: z.string().describe("Existing directory the files are written into"),
    items: z.array(z.object({
      value: z.string().describe("The data to encode"),
      symbology: z.enum(["code128", "ean13", "ean8", "upca", "qr"]).optional().describe("Defaults to the call's symbology"),
      filename: z.string().optional().describe("File name without an extension. Defaults to the value, made safe"),
    })).describe("The rows to draw"),
    symbology: z.enum(["code128", "ean13", "ean8", "upca", "qr"]).optional().describe("Default symbology for rows that do not name one (default code128)"),
    stop_on_error: z.boolean().optional().describe("Stop at the first bad row instead of drawing the rest and reporting it (default false)"),
    ...linearShape,
  },
}, async (a: LinearShape & {
  out_dir: string; items: { value: string; symbology?: string; filename?: string }[]; symbology?: string; stop_on_error?: boolean;
}) => wrap(async () => {
  if (!gate.isPro()) {
    return limit(
      `barcode_batch is a Pro feature. The free tier draws ${FREE_BATCH} code per call with barcode_create or qr_create, ` +
      `up to ${FREE_PER_MONTH} a month.\n\n${gate.upgradeText("barcode_batch", "barcode_batch")}`,
    );
  }
  const items = a.items ?? [];
  if (items.length === 0) return fail("items is empty: there is nothing to draw.");
  if (items.length > MAX_BATCH) return fail(`${items.length} rows were given; one call draws at most ${MAX_BATCH}. Split the list. Nothing was written.`);
  const format: Format = a.format ?? "svg";
  const dir = checkOutPath(join(a.out_dir, "probe"), format, true).replace(/\/probe\.[a-z]+$/, "");

  const o = linearOptions(a);
  const done: string[] = [];
  const failed: string[] = [];
  for (const [i, it] of items.entries()) {
    const sym = String(it.symbology ?? a.symbology ?? "code128");
    const safe = (it.filename ?? it.value).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || `row-${i + 1}`;
    try {
      const path = checkOutPath(join(dir, safe), format, a.overwrite === true);
      let bytes: number;
      if (sym === "qr") {
        const body = await renderQr(it.value, { ecc: "M", size: 300, margin: 4, format });
        bytes = writeAtomic(path, "png" in body ? body.png : body.svg);
      } else {
        const enc = encodeLinear(sym as Symbology, it.value);
        const body = format === "svg" ? linearSvg(enc, o) : await linearPng(enc, o);
        bytes = writeAtomic(path, body);
      }
      await recordDone({ kind: "batch", symbology: sym, summary: summarize(it.value), format, out_path: path, bytes });
      done.push(`${path} (${bytes} bytes)`);
    } catch (e) {
      const msg = `row ${i + 1} (${JSON.stringify(String(it.value).slice(0, 40))}): ${String((e as Error).message ?? e)}`;
      if (a.stop_on_error) {
        return fail(`${msg}\n\nStopped at row ${i + 1}; ${done.length} file(s) were already written:\n${done.join("\n")}`);
      }
      failed.push(msg);
    }
  }
  const head = `Wrote ${done.length} of ${items.length} ${format.toUpperCase()} file(s) into ${dir}.`;
  const body = done.length ? `\n${done.join("\n")}` : "";
  const bad = failed.length ? `\n\n${failed.length} row(s) were refused and no file was written for them:\n${failed.join("\n")}` : "";
  return ok(head + body + bad);
}));

server.registerTool("code_list", {
  title: "Codes generated",
  description: "List the codes this server generated, newest first, with what each one carried and where it was written, plus how many of this month's free allowance are left.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("How many rows to show, newest first (default 20)"),
    kind: z.string().optional().describe("Only rows of this kind: text, wifi, vcard, sepa, invoice, barcode or batch"),
  },
}, async (a: { limit?: number; kind?: string }) => wrap(async () => {
  const rows = await locked(() => getCodes());
  const filtered = a.kind ? rows.filter((r) => r.kind === a.kind) : rows;
  const used = countInMonth(rows, monthOf());
  const head = gate.isPro()
    ? `${rows.length} code(s) in the register at ${dataDir()}, ${used} this month. Pro: no limit.`
    : `${rows.length} code(s) in the register at ${dataDir()}. ${used} of ${FREE_PER_MONTH} free codes used in ${monthOf()}.`;
  if (filtered.length === 0) return ok(`${head}\nNothing to list${a.kind ? ` of kind "${a.kind}"` : ""}.`);
  const lines = filtered.slice(-(a.limit ?? 20)).reverse().map((r) =>
    `${r.created.slice(0, 19).replace("T", " ")}  ${r.id}  ${r.kind}/${r.symbology}  ${r.format}  ${r.summary}${r.out_path ? `  -> ${r.out_path}` : ""}`);
  return ok(`${head}\n\n${lines.join("\n")}`);
}));

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-barcode ${VERSION} ready (${gate.isPro() ? "pro" : "free"})\n`);
