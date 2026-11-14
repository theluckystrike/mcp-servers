/**
 * Google Connected Apps readiness (2026-11-01): upload-tool annotations, per-server
 * initialize instructions, OAuth refresh tokens, the domain verification file, the GET
 * event-stream answer, the clean /mcp/<server>/v1 mode and the tailor_to_job annotation.
 *
 * The worker's default export cannot be imported under plain Node (the vendored
 * price-tracker uses TypeScript parameter properties, which strip-only mode refuses), so
 * this suite does what the sibling suites do: the shims, oauth-refresh.ts and vendored
 * servers are imported for real through the .js -> .ts resolve hook, the pure helpers of
 * index.ts are extracted from the source and run through node:module's
 * stripTypeScriptTypes, and the route wiring is asserted against the source text.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FS_SHIM_URL = new URL("../src/shims/fs.ts", import.meta.url).href;
const TZ_STUB = "data:text/javascript," + encodeURIComponent(
  `import { readFileSync } from ${JSON.stringify(FS_SHIM_URL)};\n` +
  `export function resolveZone() { throw new Error("timezone engine stubbed in this test"); }\n` +
  `export function readJsonFile(file, empty) {\n` +
  `  let raw;\n` +
  `  try { raw = readFileSync(file, "utf8"); }\n` +
  `  catch (e) { if (e && e.code === "ENOENT") return empty; throw e; }\n` +
  `  return JSON.parse(raw);\n` +
  `}\n`);

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith("/timezone/lib.js")) return { url: TZ_STUB, shortCircuit: true };
    if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL) {
      const asJs = new URL(specifier, context.parentURL);
      if (!existsSync(fileURLToPath(asJs))) {
        const asTs = new URL(specifier.slice(0, -3) + ".ts", context.parentURL);
        if (existsSync(fileURLToPath(asTs))) return next(specifier.slice(0, -3) + ".ts", context);
      }
    }
    return next(specifier, context);
  },
});

const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const ctxMod = await import("../src/shims/ctx.ts");
const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { WebStandardStreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js");

/** The text of a top-level function of index.ts, `export` dropped. */
function fnSource(name) {
  let start = src.indexOf(`export function ${name}(`);
  if (start < 0) start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist in remote/src/index.ts`);
  const end = src.indexOf("\n}\n", start) + 3;
  return src.slice(start, end).replace(/^export /, "");
}

/** Evaluate TypeScript source text and return the named bindings. */
function evalTs(code, names, scope = {}) {
  const js = stripTypeScriptTypes(code);
  return new Function(...Object.keys(scope), `${js}\nreturn { ${names.join(", ")} };`)(...Object.values(scope));
}

function requestCtx(server, over = {}) {
  return {
    tenant: "anon:" + "c".repeat(32), server, isPro: false, anonToken: "anon_" + "c".repeat(32),
    files: new Map(), dirs: new Set(), downloads: [], baseUrl: "https://mcp.zovo.one",
    published: new Map(), maxBytes: 512 * 1024, bytes: 0, nfiles: 0, fds: new Map(), nextFd: 100,
    ...over,
  };
}

/** One JSON-RPC request through the real SDK transport, inside a request context. */
async function rpcOnce(server, name, method, params, over = {}) {
  return await ctxMod.STORE.run(requestCtx(name, over), async () => {
    const { createServer } = await import(`../src/vendor/${server}/index.ts`);
    const s = createServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await s.connect(transport);
      const res = await transport.handleRequest(new Request(`https://mcp.zovo.one/mcp/${name}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      }));
      return await res.text();
    } finally {
      await transport.close().catch(() => {});
      await s.close().catch(() => {});
    }
  });
}

/* ------------------------------------------------------------ 1. annotations */

const UP = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
const LS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const DEL = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
const UPLOAD_SHIMS = {
  "sheet-load.ts": ["registerSheetLoad", { sheet_load: UP, sheet_files: LS, sheet_unload: DEL }],
  "docx-upload.ts": ["registerDocxUpload", { doc_upload: UP, doc_files: LS, doc_delete_upload: DEL }],
  "pdf-upload.ts": ["registerPdfUpload", { pdf_upload: UP, pdf_files: LS, pdf_delete_upload: DEL }],
  "image-upload.ts": ["registerImageUpload", { image_upload: UP, image_files: LS, image_delete_upload: DEL }],
  "bank-upload.ts": ["registerBankUpload", { bank_upload: UP, bank_files: LS, bank_delete_upload: DEL }],
  "zip-upload.ts": ["registerZipUpload", { zip_upload: UP, zip_files: LS, zip_delete_upload: DEL }],
};

test("every remote-only upload tool carries a title and all four hints, decided from behaviour", async () => {
  let n = 0;
  for (const [file, [fn, expected]] of Object.entries(UPLOAD_SHIMS)) {
    const mod = await import(`../src/shims/${file}`);
    const seen = {};
    mod[fn]({ registerTool: (name, cfg) => { seen[name] = cfg; } });
    assert.deepEqual(Object.keys(seen).sort(), Object.keys(expected).sort(), file);
    for (const [name, hints] of Object.entries(expected)) {
      assert.ok(seen[name].title, `${name} has a title`);
      assert.deepEqual(seen[name].annotations, hints, `${name} annotations`);
      n++;
    }
  }
  assert.equal(n, 18);
});

test("the upload shims reach 21 hosted tools: resume reuses the docx shim", () => {
  const resume = readFileSync(new URL("../src/vendor/resume/index.ts", import.meta.url), "utf8");
  assert.match(resume, /registerDocxUpload\(/);
});

test("an upload under an existing name replaces it, which is why *_upload is destructive", async () => {
  const { stageUpload } = await import("../src/shims/docx-upload.ts");
  const docx = (byte) => Buffer.from([0x50, 0x4b, 3, 4, byte]).toString("base64");
  await ctxMod.STORE.run(requestCtx("docx"), async () => {
    const path = stageUpload("contract", docx(1));
    const first = ctxMod.ctx().files.get(path);
    assert.equal(stageUpload("contract", docx(2)), path);
    assert.notEqual(ctxMod.ctx().files.get(path), first, "the second upload overwrote the first");
  });
});

/* ----------------------------------------------------------- 2. instructions */

const instr = (map) => evalTs(`${fnSource("serverInstructions")}\n${fnSource("withInstructions")}`,
  ["serverInstructions", "withInstructions"], { SERVER_INSTRUCTIONS: map });

test("src/server-instructions.json is an object of strings keyed by hosted server names", () => {
  const map = JSON.parse(readFileSync(new URL("../src/server-instructions.json", import.meta.url), "utf8"));
  assert.equal(typeof map, "object");
  assert.ok(!Array.isArray(map));
  const block = src.slice(src.indexOf("const SERVERS"), src.indexOf("const json ="));
  const names = new Set([...block.matchAll(/\n  "([a-z-]+)": \{/g)].map((m) => m[1]));
  // Snapshot of the hosted catalog. 48 until 2026-11-06, when eleven catalog servers that
  // were 404 on /mcp/<name> were vendored and wired in (office-suite stays unhosted: it
  // spawns local child processes). Bump this only with the SERVERS map, in the same commit.
  assert.equal(names.size, 60, "60 hosted servers");
  for (const [k, v] of Object.entries(map)) {
    assert.ok(names.has(k), `${k} is a hosted server`);
    assert.equal(typeof v, "string");
  }
});

test("a dummy instruction text reaches the real SDK initialize response; a missing one is omitted", async () => {
  const { serverInstructions, withInstructions } = instr({ invoice: "DUMMY: call business_set first.", pdf: "  " });
  const body = await rpcOnce("invoice", "invoice", "initialize",
    { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "1" } });
  const before = JSON.parse(body);
  assert.equal(before.result.instructions, undefined, "the vendored server sends none of its own");
  const after = JSON.parse(withInstructions(body, serverInstructions("invoice")));
  assert.equal(after.result.instructions, "DUMMY: call business_set first.");
  assert.equal(after.result.serverInfo.name, before.result.serverInfo.name);
  assert.equal(after.result.protocolVersion, "2025-11-25");
  assert.equal(serverInstructions("pdf"), undefined, "blank text is treated as missing");
  assert.equal(serverInstructions("kanban"), undefined);
  assert.equal(withInstructions(body, undefined), body, "missing key: byte-identical body");
  const err = '{"jsonrpc":"2.0","id":1,"error":{"code":-32600,"message":"x"}}';
  assert.equal(withInstructions(err, "text"), err, "an error answer is untouched");
});

test("route contract: initialize answers get the instructions, after the strip", () => {
  assert.ok(src.includes('import SERVER_INSTRUCTIONS from "./server-instructions.json";'));
  assert.ok(src.includes('rpc.method === "initialize" ? serverInstructions(product) : undefined'));
  const strip = src.indexOf("for (const prefix of strip) out = out.split(prefix).join(\"\");");
  assert.ok(strip > 0 && src.indexOf("out = withInstructions(out, instructions);") > strip);
});

/* ----------------------------------------------------------- 3. refresh tokens */

const oauth = await import("../src/oauth-refresh.ts");
const TOK = "anon_" + "a".repeat(32);
const TOK_TTL = 2_678_400;

function fakeKv() {
  const m = new Map();
  return {
    m, reads: 0,
    async get(k) { this.reads++; return m.has(k) ? m.get(k).v : null; },
    async put(k, v, o) { m.set(k, { v, ttl: o?.expirationTtl }); },
    async delete(k) { m.delete(k); },
  };
}

test("a refresh token is issued bound to the access token and client, for 365 days", async () => {
  const kv = fakeKv();
  const rt = await oauth.issueRefreshToken(kv, TOK, "client1");
  assert.match(rt, oauth.REFRESH_TOKEN_RE);
  const row = kv.m.get(`oauth_refresh:${rt}`);
  assert.equal(row.ttl, 60 * 60 * 24 * 365);
  assert.deepEqual({ ...JSON.parse(row.v), at: 0 }, { token: TOK, client_id: "client1", at: 0 });
});

test("refresh returns the same access token, rotates the refresh token and re-stamps tok:", async () => {
  const kv = fakeKv();
  const rt1 = await oauth.issueRefreshToken(kv, TOK, "client1");
  const r = await oauth.redeemRefreshToken(kv, rt1, "client1", TOK_TTL);
  assert.equal(r.ok, true);
  assert.equal(r.token, TOK, "the access token is the data space, so it never changes");
  assert.notEqual(r.refresh_token, rt1);
  assert.equal(kv.m.has(`oauth_refresh:${rt1}`), false, "the old one is gone");
  assert.equal(JSON.parse(kv.m.get(`oauth_refresh:${r.refresh_token}`).v).client_id, "client1", "rotation keeps the client binding");
  assert.equal(kv.m.get(`tok:${TOK}`).ttl, TOK_TTL, "an idle access token is valid again");
  const replay = await oauth.redeemRefreshToken(kv, rt1, "client1", TOK_TTL);
  assert.deepEqual([replay.ok, replay.error], [false, "invalid_grant"], "single use");
  const again = await oauth.redeemRefreshToken(kv, r.refresh_token, "", TOK_TTL);
  assert.equal(again.ok, true, "a public client that omits client_id is identified by the token");
});

test("refresh refuses a different client without spending the token, and junk without a KV read", async () => {
  const kv = fakeKv();
  const rt = await oauth.issueRefreshToken(kv, TOK, "client1");
  const wrong = await oauth.redeemRefreshToken(kv, rt, "client2", TOK_TTL);
  assert.deepEqual([wrong.ok, wrong.error], [false, "invalid_grant"]);
  assert.ok(kv.m.has(`oauth_refresh:${rt}`), "a mismatch does not consume the token");
  const reads = kv.reads;
  assert.equal((await oauth.redeemRefreshToken(kv, "rt_short", "client1", TOK_TTL)).error, "invalid_grant");
  assert.equal((await oauth.redeemRefreshToken(kv, "", "client1", TOK_TTL)).error, "invalid_request");
  assert.equal(kv.reads, reads);
  await kv.put(`oauth_refresh:rt_${"b".repeat(64)}`, "not json");
  assert.equal((await oauth.redeemRefreshToken(kv, `rt_${"b".repeat(64)}`, "", TOK_TTL)).error, "invalid_grant");
});

test("route contract: both grants at the token endpoint, both advertised", () => {
  const i = src.indexOf('path === "/oauth/token"');
  const block = src.slice(i, src.indexOf("const dl = path.match", i));
  assert.ok(block.includes('grantType === "refresh_token"'));
  assert.ok(block.includes("redeemRefreshToken(env.REMOTE_DATA"));
  assert.ok(block.includes('if (grantType !== "authorization_code") return json({ error: "unsupported_grant_type" }, 400);'));
  assert.ok(block.includes("refresh_token: await issueRefreshToken(env.REMOTE_DATA, grant.token, grant.client_id)"));
  assert.ok(src.includes('grant_types_supported: ["authorization_code", "refresh_token"]'));
  assert.ok(src.includes('grant_types: ["authorization_code", "refresh_token"]'), "DCR response");
});

/* --------------------------------------------------- 4. domain verification */

test("route contract: /.well-known/google-connected-apps serves gca:verification as is, 404 when unset", () => {
  const i = src.indexOf('path === "/.well-known/google-connected-apps"');
  assert.ok(i > 0);
  const block = src.slice(i, src.indexOf("\n    }\n", i));
  assert.ok(block.includes('env.REMOTE_DATA.get("gca:verification")'));
  assert.ok(block.includes('if (body === null) return json({ error: "not_found" }, 404);'));
  assert.ok(block.includes('"content-type": "application/json"'));
  assert.ok(!/redirect/i.test(block));
});

/* ----------------------------------------------------------- 5. GET streams */

test("route contract: a GET answer is never read to its end, and an SSE-only tokenless GET is 405", () => {
  assert.ok(src.includes('if (req.method !== "GET" && (rctx.published.size > 0 || strip.length > 0 || isToolCall || instructions || clean))'));
  assert.ok(src.includes('if (accept.includes("text/event-stream") && !accept.includes("application/json") && !accept.includes("text/html"))'));
});

/* ------------------------------------------------------- 6 + 8. clean /v1 mode */

const clean = evalTs(
  src.slice(src.indexOf("const LOCAL_INSTALL_RULES"), src.indexOf("];\n", src.indexOf("const LOCAL_INSTALL_RULES")) + 3) +
  [fnSource("cleanText"), fnSource("cleanToolList"), fnSource("cleanJson")].join("\n"),
  ["cleanText", "cleanToolList", "cleanJson"]);

const REL = "download x.mcpb from https://github.com/theluckystrike/mcp-servers/releases/latest and open it in Claude Desktop";
const CASES = [
  // the shapes found in src/shims and src/vendor
  [`Paste the calendar's contents as text instead (ics_import {text, name}), or install the calendar server locally, where it can reach your own network: ${REL}.`,
    "Paste the calendar's contents as text instead (ics_import {text, name})."],
  [`Track a public product page instead, or install the price tracker locally, where it can reach your own network: ${REL}.`,
    "Track a public product page instead."],
  [`kept for 30 days. Install the resume server locally if you would rather it never left your machine: ${REL}.\n\nnext`,
    "kept for 30 days.\n\nnext"],
  [`which this endpoint does not have. Watermark on a local install instead - ${REL} - or upload an image you have already watermarked.`,
    "which this endpoint does not have. Upload an image you have already watermarked."],
  [`nothing was written. Install the image server locally, where image_watermark works - ${REL} - or draw the text yourself and upload the finished image.`,
    "nothing was written. Draw the text yourself and upload the finished image."],
  [`the hosted cap is 2 MB per file. Nothing was stored. To work on PDFs this size, install the pdf server locally: ${REL}, where there is no cap.`,
    "the hosted cap is 2 MB per file. Nothing was stored."],
  [`Nothing was stored. Split the export by month, or install the bank-statement server locally: ${REL}, where there is no cap.`,
    "Nothing was stored. Split the export by month."],
  [`Drop a sheet with sheet_unload, send fewer columns or rows, or install the spreadsheet server locally, where there is no cap: ${REL}.`,
    "Drop a sheet with sheet_unload, send fewer columns or rows."],
  [`attach receipts locally; hosted mode stores no files. Install the expense-tracker server locally to hash and store receipt files - ${REL} - or put the receipt reference in the expense note.`,
    "attach receipts locally; hosted mode stores no files. Put the receipt reference in the expense note."],
];

test("clean mode removes every install-locally pointer and keeps the refusal and its hosted alternative", () => {
  for (const [input, want] of CASES) assert.equal(clean.cleanText(input), want);
  assert.equal(clean.cleanText("No invoices match."), "No invoices match.");
});

test("every install-locally text in src/ is covered by the clean rules", () => {
  const files = ["shims/docx-upload.ts", "shims/pdf-upload.ts", "shims/sheet-load.ts", "shims/zip-upload.ts", "shims/bank-upload.ts",
    "shims/image-upload.ts", "vendor/calendar/index.ts", "vendor/calendar/fetch.ts", "vendor/price-tracker/fetch.ts", "vendor/resume/index.ts",
    "vendor/image/index.ts", "vendor/clauses/index.ts", "vendor/zip/index.ts", "vendor/expense-tracker/index.ts"];
  let n = 0;
  for (const f of files) {
    const text = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8")
      // join the string concatenations so a sentence split over source lines reads whole
      .replace(/["`]\s*\+\s*\n\s*["`]/g, "");
    for (const line of text.split("\n").filter((l) => l.includes("Claude Desktop"))) {
      assert.ok(!clean.cleanText(line).includes("Claude Desktop"), `${f}: ${line.trim().slice(0, 90)}`);
      n++;
    }
  }
  assert.ok(n >= 17, `${n} texts checked`);
});

test("clean annotations: not read-only means destructive; read-only tools are kept", () => {
  const tools = [
    { name: "a", annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } },
    { name: "b", annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    { name: "c" },
  ];
  const out = clean.cleanToolList(tools);
  assert.equal(out[0].annotations.destructiveHint, true);
  assert.deepEqual(out[1], tools[1]);
  assert.deepEqual(out[2], tools[2]);
  assert.equal(tools[0].annotations.destructiveHint, false, "the input is not mutated");
  const body = JSON.stringify({ result: { content: [{ type: "text", text: `x, or install the zip server locally: ${REL}.` }] } });
  assert.equal(JSON.parse(clean.cleanJson(body)).result.content[0].text, "x.");
  assert.equal(clean.cleanJson("not json Claude Desktop"), "not json Claude Desktop");
});

test("clean mode drops the licence tools, pricing resource and upgrade prompt; the normal path keeps them", async () => {
  const listed = async (over) => ({
    tools: JSON.parse(await rpcOnce("invoice", "invoice", "tools/list", {}, over)).result.tools.map((t) => t.name),
    resources: JSON.parse(await rpcOnce("invoice", "invoice", "resources/list", {}, over)).result.resources.map((r) => r.uri),
    prompts: JSON.parse(await rpcOnce("invoice", "invoice", "prompts/list", {}, over)).result.prompts.map((p) => p.name),
  });
  const normal = await listed({});
  const v1 = await listed({ clean: true });
  assert.ok(normal.tools.includes("license_status") && normal.tools.includes("license_activate"));
  assert.ok(normal.resources.includes("pricing://invoice"));
  assert.ok(normal.prompts.includes("upgrade_to_pro"));
  assert.deepEqual(v1.tools, normal.tools.filter((t) => !t.startsWith("license_")));
  assert.deepEqual(v1.resources, normal.resources.filter((r) => r !== "pricing://invoice"));
  assert.deepEqual(v1.prompts, normal.prompts.filter((p) => p !== "upgrade_to_pro"));
});

test("a free-tier refusal in clean mode names the limit and Pro, with no link and no price", async () => {
  const { createLicenseGate } = await import("../src/shims/license.ts");
  const gate = createLicenseGate({ product: "resume" });
  const normal = ctxMod.STORE.run(requestCtx("resume"), () => gate.upgradeText("unlimited tailoring", "tailor_to_job"));
  const v1 = ctxMod.STORE.run(requestCtx("resume", { clean: true }), () => gate.upgradeText("unlimited tailoring", "tailor_to_job"));
  assert.match(normal, /https:\/\/mcp\.zovo\.one\/buy\/resume\?tenant=/);
  assert.equal(v1, '"unlimited tailoring" is not included in the free tier. Pro removes this limit.');
});

test("route contract: /v1 routing, trailer, GET 405, unknown tool and rate limit", () => {
  assert.ok(src.includes("const v1 = path.match(/^\\/mcp\\/([a-z-]+)\\/v1$/);"));
  assert.ok(src.includes("if (v1 && SERVERS[VARIANT_ALIASES[v1[1]] ?? v1[1]]) {"), "only real server names take /v1");
  assert.ok(src.includes("if (successfulBusinessCall && !auth.isPro && !clean) {"), "no success trailer on /v1");
  assert.ok(src.includes('if (clean && (req.method === "GET" || req.method === "HEAD")) {'));
  assert.ok(src.includes("if (!known) return rpcError(rpc.id, -32602, `Unknown tool: ${name}`);"));
  assert.ok(src.includes('return rpcError(rpc.id, -32300, "USER_RATE_LIMITED: rate limit reached, try again later",'));
  assert.ok(src.includes('const key = `${BUILD_VERSION}:${product}:${isPro ? "pro" : "free"}${clean ? ":clean" : ""}`;'), "separate tools/list cache entry");
  const rpcError = evalTs(fnSource("rpcError"), ["rpcError"]).rpcError;
  return rpcError(9, -32602, "Unknown tool: x").json().then((b) =>
    assert.deepEqual(b, { jsonrpc: "2.0", id: 9, error: { code: -32602, message: "Unknown tool: x" } }));
});

/* ------------------------------------------------------- 7. tailor_to_job */

test("tailor_to_job is annotated read-only at the source and in the vendored copy", () => {
  for (const f of ["../../servers/resume/src/index.ts", "../src/vendor/resume/index.ts"]) {
    const text = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.ok(text.includes('registerTool("tailor_to_job", { annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },'), f);
  }
});
