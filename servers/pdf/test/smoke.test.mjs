// stdio protocol smoke test: handshake, tool list, and one call of each shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { client, makeInvoicePdf, makePdf, proKey, sandbox } from "./_client.mjs";

test("initialize, tools/list and the read-only tools", async () => {
  const { dir, dataHome } = sandbox("mcp-pdf-smoke-");
  const src = await makePdf(join(dir, "a.pdf"), 3, "alpha");
  const c = client({ dataHome });
  try {
    const init = await c.init();
    assert.equal(init.result.serverInfo.name, "mcp-pdf");
    const list = await c.send("tools/list", {});
    const names = list.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "license_activate", "license_status", "pdf_count", "pdf_info", "pdf_merge", "pdf_pages",
      "pdf_reorder", "pdf_rotate", "pdf_split", "pdf_stamp", "pdf_text", "pdf_watermark_business",
    ]);
    for (const t of list.result.tools) {
      assert.ok(t.description && t.description.length > 30, `${t.name} needs a description`);
      assert.equal(/[\u{1F300}-\u{1FAFF}]/u.test(`${t.title ?? ""}${t.description}`), false, `${t.name} must carry no emoji`);
    }
    const info = await c.text("pdf_info", { path: src });
    assert.match(info, /"pages": 3/);
    const count = await c.text("pdf_count", { paths: [src, src] });
    assert.match(count, /"total_pages": 6/);
    const res = await c.send("resources/list", {});
    assert.deepEqual(res.result.resources.map((r) => r.uri), ["pdf://recent"]);
    const prompts = await c.send("prompts/list", {});
    assert.deepEqual(prompts.result.prompts.map((p) => p.name), ["mark_invoice_paid"]);
    const prompt = await c.send("prompts/get", { name: "mark_invoice_paid", arguments: { reference: "INV-2026-0007" } });
    assert.match(prompt.result.messages[0].content.text, /invoice_get/);
    assert.match(prompt.result.messages[0].content.text, /pdf_stamp/);
    const status = await c.text("license_status", {});
    assert.match(status, /"tier": "free"/);
  } finally { c.close(); }
});

test("merge of three fixtures, then the stamped invoice, then the register", async () => {
  const { dir, dataHome } = sandbox("mcp-pdf-smoke-");
  const a = await makePdf(join(dir, "a.pdf"), 1, "a");
  const b = await makePdf(join(dir, "b.pdf"), 2, "b");
  const d = await makePdf(join(dir, "d.pdf"), 3, "d");
  const invoice = await makeInvoicePdf(join(dir, "invoice.pdf"));
  const c = client({ dataHome });
  try {
    await c.init();
    const merged = join(dir, "merged.pdf");
    const m = await c.text("pdf_merge", { paths: [a, b, d], out_path: merged });
    assert.match(m, /Merged 3 files into 6 pages/);
    assert.equal((await PDFDocument.load(readFileSync(merged))).getPageCount(), 6);
    const paid = join(dir, "invoice-paid.pdf");
    const s = await c.text("pdf_stamp", { path: invoice, text: "PAID", out_path: paid });
    assert.match(s, /Stamped "PAID" on 1 page/);
    assert.ok(existsSync(paid));
    const recent = await c.send("resources/read", { uri: "pdf://recent" });
    const ops = JSON.parse(recent.result.contents[0].text);
    assert.deepEqual(ops.map((o) => o.op), ["pdf_stamp", "pdf_merge"]);
  } finally { c.close(); }
});

test("free tier: six files are refused with the upgrade line, Pro merges them", async () => {
  const { dir, dataHome } = sandbox("mcp-pdf-free-");
  const paths = [];
  for (let i = 1; i <= 6; i++) paths.push(await makePdf(join(dir, `f${i}.pdf`), 1, `f${i}`));
  const free = client({ dataHome });
  try {
    await free.init();
    const out = join(dir, "six.pdf");
    const r = await free.call("pdf_merge", { paths, out_path: out });
    assert.notEqual(r.result.isError, true, "a tier limit is an answer, not a protocol error");
    const text = r.result.content[0].text;
    assert.match(text, /free tier merges up to 5 files/);
    assert.match(text, /mcp\.zovo\.one\/buy\/pdf/);
    assert.equal(existsSync(out), false, "nothing may be written when the limit refuses the call");
  } finally { free.close(); }

  const pro = client({ dataHome, key: proKey() });
  try {
    await pro.init();
    const out = join(dir, "six-pro.pdf");
    const text = await pro.text("pdf_merge", { paths, out_path: out });
    assert.match(text, /Merged 6 files into 6 pages/);
    assert.equal((await PDFDocument.load(readFileSync(out))).getPageCount(), 6);
    assert.match(await pro.text("license_status", {}), /"tier": "pro"/);
  } finally { pro.close(); }
});

test("free tier: the page cap, the stamp presets and the Pro-only tools", async () => {
  const { dir, dataHome } = sandbox("mcp-pdf-free2-");
  const big = await makePdf(join(dir, "big.pdf"), 31, "big");
  const small = await makePdf(join(dir, "small.pdf"), 2, "small");
  const c = client({ dataHome });
  try {
    await c.init();
    let t = (await c.call("pdf_split", { path: big, ranges: "1-2", out_path_pattern: join(dir, "p-{n}.pdf") })).result.content[0].text;
    assert.match(t, /up to 30 pages/);
    assert.equal(existsSync(join(dir, "p-1.pdf")), false);
    t = (await c.call("pdf_stamp", { path: small, text: "SAMPLE", out_path: join(dir, "s.pdf") })).result.content[0].text;
    assert.match(t, /presets PAID and DRAFT/);
    assert.equal(existsSync(join(dir, "s.pdf")), false);
    t = (await c.call("pdf_stamp", { path: small, text: "PAID", color: "#123456", out_path: join(dir, "s2.pdf") })).result.content[0].text;
    assert.match(t, /custom stamp colour is a Pro feature/);
    t = (await c.call("pdf_reorder", { path: small, order: [2, 1], out_path: join(dir, "s3.pdf") })).result.content[0].text;
    assert.match(t, /Reordering pages is a Pro feature/);
    t = (await c.call("pdf_watermark_business", { path: small, out_path: join(dir, "s4.pdf") })).result.content[0].text;
    assert.match(t, /business footer is a Pro feature/);
    for (const n of ["s", "s2", "s3", "s4"]) assert.equal(existsSync(join(dir, `${n}.pdf`)), false);
    // DRAFT and PAID do work on the free tier, on a small file.
    const okText = await c.text("pdf_stamp", { path: small, text: "draft", out_path: join(dir, "draft.pdf") });
    assert.match(okText, /Stamped "draft"/);
  } finally { c.close(); }
});

test("an existing out_path is refused and the file on disk is not touched", async () => {
  const { dir, dataHome } = sandbox("mcp-pdf-excl-");
  const a = await makePdf(join(dir, "a.pdf"), 1, "a");
  const b = await makePdf(join(dir, "b.pdf"), 1, "b");
  const out = await makePdf(join(dir, "taken.pdf"), 7, "already here");
  const before = readFileSync(out);
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const r = await c.call("pdf_merge", { paths: [a, b], out_path: out });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /already exists and nothing was written/);
    assert.deepEqual(readFileSync(out), before);
    const forced = await c.text("pdf_merge", { paths: [a, b], out_path: out, overwrite: true });
    assert.match(forced, /Merged 2 files into 2 pages/);
    assert.equal((await PDFDocument.load(readFileSync(out))).getPageCount(), 2);
  } finally { c.close(); }
});

test("the business footer prints the shared profile, and says so when there is none", async () => {
  const { dir, dataHome } = sandbox("mcp-pdf-biz-");
  const src = await makePdf(join(dir, "src.pdf"), 1, "s");
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const r = await c.call("pdf_watermark_business", { path: src, out_path: join(dir, "w.pdf") });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /no business name is stored/);
    assert.equal(existsSync(join(dir, "w.pdf")), false);
  } finally { c.close(); }

  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(join(dataHome, "mcp-servers", "profile"), { recursive: true });
  writeFileSync(join(dataHome, "mcp-servers", "profile", "business.json"),
    JSON.stringify({ name: "Acme Consulting", vat_id: "PL1234567890" }));
  const c2 = client({ dataHome, key: proKey() });
  try {
    await c2.init();
    const out = join(dir, "footed.pdf");
    const text = await c2.text("pdf_watermark_business", { path: src, out_path: out });
    assert.match(text, /Acme Consulting/);
    const doc = await PDFDocument.load(readFileSync(out));
    const { extractText } = await import("../dist/text.js");
    const page = extractText(doc, [0]).pages[0].text;
    assert.match(page, /Acme Consulting/);
    assert.match(page, /VAT PL1234567890/);
  } finally { c2.close(); }
});
