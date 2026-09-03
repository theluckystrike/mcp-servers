// Behaviour of the PDF operations themselves, over the real stdio transport,
// against fixtures generated with pdf-lib inside the test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { extractText } from "../dist/text.js";
import { client, makeEncryptedPdf, makeInvoicePdf, makePdf, proKey, sandbox } from "./_client.mjs";

async function pagesOf(path) {
  return (await PDFDocument.load(readFileSync(path))).getPageCount();
}

async function textOf(path) {
  const doc = await PDFDocument.load(readFileSync(path));
  return extractText(doc, doc.getPageIndices()).pages.map((p) => p.text).join("\n");
}

test("merge: page counts add up and the sources are untouched", async () => {
  const { dir, dataHome } = sandbox();
  const a = await makePdf(join(dir, "a.pdf"), 2, "alpha");
  const b = await makePdf(join(dir, "b.pdf"), 3, "beta");
  const before = [statSync(a).mtimeMs, statSync(b).mtimeMs, statSync(a).size, statSync(b).size];
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const out = join(dir, "merged.pdf");
    const answer = await c.text("pdf_merge", { paths: [a, b], out_path: out });
    assert.match(answer, /Merged 2 files into 5 pages/);
    assert.equal(await pagesOf(out), 5);
    assert.deepEqual([statSync(a).mtimeMs, statSync(b).mtimeMs, statSync(a).size, statSync(b).size], before);
    const t = await textOf(out);
    assert.match(t, /PAGE 1 alpha/);
    assert.match(t, /PAGE 3 beta/);
  } finally { c.close(); }
});

test("split: ranges including an open-ended one, and pages left out are reported", async () => {
  const { dir, dataHome } = sandbox();
  const src = await makePdf(join(dir, "src.pdf"), 9, "s");
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const answer = await c.text("pdf_split", {
      path: src, ranges: "1-3,5,7-", out_path_pattern: join(dir, "out", "{name}-{range}.pdf"),
    });
    assert.match(answer, /into 3 files/);
    assert.equal(await pagesOf(join(dir, "out", "src-1-3.pdf")), 3);
    assert.equal(await pagesOf(join(dir, "out", "src-5.pdf")), 1);
    assert.equal(await pagesOf(join(dir, "out", "src-7-9.pdf")), 3);
    // pages 4 and 6 are in no range
    assert.match(answer, /2 pages of the source are in no range/);
    assert.match(await textOf(join(dir, "out", "src-7-9.pdf")), /PAGE 7 s/);
  } finally { c.close(); }
});

test("split: a range past the end is refused and no part is written", async () => {
  const { dir, dataHome } = sandbox();
  const src = await makePdf(join(dir, "src.pdf"), 3, "s");
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const r = await c.call("pdf_split", { path: src, ranges: "1-2,4-6", out_path_pattern: join(dir, "p-{n}.pdf") });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /page past the end: the file has 3 pages/);
    assert.equal(existsSync(join(dir, "p-1.pdf")), false);
  } finally { c.close(); }
});

test("pages: extraction keeps the order written, duplicates included", async () => {
  const { dir, dataHome } = sandbox();
  const src = await makePdf(join(dir, "src.pdf"), 6, "s");
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const out = join(dir, "picked.pdf");
    const answer = await c.text("pdf_pages", { path: src, pages: "5,1,1", out_path: out });
    assert.match(answer, /Extracted 3 pages/);
    assert.equal(await pagesOf(out), 3);
    const doc = await PDFDocument.load(readFileSync(out));
    const per = extractText(doc, doc.getPageIndices()).pages.map((p) => p.text);
    assert.match(per[0], /PAGE 5/);
    assert.match(per[1], /PAGE 1/);
    assert.match(per[2], /PAGE 1/);
    assert.match(answer, /asked for more than once/);
  } finally { c.close(); }
});

test("rotate: the rotation is on the page after a reload, and adds to what was there", async () => {
  const { dir, dataHome } = sandbox();
  const src = await makePdf(join(dir, "src.pdf"), 3, "s");
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const once = join(dir, "r1.pdf");
    await c.text("pdf_rotate", { path: src, degrees: 90, out_path: once });
    let doc = await PDFDocument.load(readFileSync(once));
    assert.deepEqual(doc.getPages().map((p) => p.getRotation().angle), [90, 90, 90]);
    // A second pass adds to the first: 90 + 270 = 0 again.
    const twice = join(dir, "r2.pdf");
    await c.text("pdf_rotate", { path: once, degrees: 270, pages: "2", out_path: twice });
    doc = await PDFDocument.load(readFileSync(twice));
    assert.deepEqual(doc.getPages().map((p) => p.getRotation().angle), [90, 0, 90]);
    const bad = await c.call("pdf_rotate", { path: src, degrees: 45, out_path: join(dir, "r3.pdf") });
    assert.equal(bad.result.isError, true);
    assert.match(bad.result.content[0].text, /multiples of 90/);
    assert.equal(existsSync(join(dir, "r3.pdf")), false);
  } finally { c.close(); }
});

test("stamp: PAID reaches the content stream and the source is unchanged", async () => {
  const { dir, dataHome } = sandbox();
  const src = await makeInvoicePdf(join(dir, "invoice.pdf"));
  const sourceBytes = readFileSync(src);
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const out = join(dir, "invoice-paid.pdf");
    const answer = await c.text("pdf_stamp", { path: src, text: "PAID", out_path: out });
    assert.match(answer, /Stamped "PAID" on 1 page/);
    const t = await textOf(out);
    assert.match(t, /PAID/);
    assert.match(t, /Invoice INV-2026-0007/);
    assert.deepEqual(readFileSync(src), sourceBytes);
  } finally { c.close(); }
});

test("stamp: custom text and colour on Pro, page selection honoured", async () => {
  const { dir, dataHome } = sandbox();
  const src = await makePdf(join(dir, "src.pdf"), 4, "s");
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const out = join(dir, "stamped.pdf");
    const answer = await c.text("pdf_stamp", {
      path: src, text: "CONFIDENTIAL", color: "#1b7f3b", position: "top-right", opacity: 0.9, pages: "2,4", out_path: out,
    });
    assert.match(answer, /on 2 pages/);
    const doc = await PDFDocument.load(readFileSync(out));
    const per = extractText(doc, doc.getPageIndices()).pages.map((p) => p.text);
    assert.equal(/CONFIDENTIAL/.test(per[0]), false);
    assert.match(per[1], /CONFIDENTIAL/);
    assert.match(per[3], /CONFIDENTIAL/);
  } finally { c.close(); }
});

test("stamp: characters a built-in font cannot carry are removed and reported", async () => {
  const { dir, dataHome } = sandbox();
  const src = await makePdf(join(dir, "src.pdf"), 1, "s");
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const out = join(dir, "cjk.pdf");
    const answer = await c.text("pdf_stamp", { path: src, text: "PAID 代金", out_path: out });
    assert.match(answer, /characters were removed/);
    assert.match(await textOf(out), /PAID/);
  } finally { c.close(); }
});

test("reorder: a permutation is applied, an incomplete order is refused", async () => {
  const { dir, dataHome } = sandbox();
  const src = await makePdf(join(dir, "src.pdf"), 3, "s");
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const out = join(dir, "re.pdf");
    await c.text("pdf_reorder", { path: src, order: [3, 1, 2], out_path: out });
    const doc = await PDFDocument.load(readFileSync(out));
    const per = extractText(doc, doc.getPageIndices()).pages.map((p) => p.text);
    assert.match(per[0], /PAGE 3/);
    assert.match(per[1], /PAGE 1/);
    assert.match(per[2], /PAGE 2/);
    const bad = await c.call("pdf_reorder", { path: src, order: [1, 2], out_path: join(dir, "re2.pdf") });
    assert.equal(bad.result.isError, true);
    assert.match(bad.result.content[0].text, /Missing: 3/);
    assert.equal(existsSync(join(dir, "re2.pdf")), false);
  } finally { c.close(); }
});

test("text: a known string comes back from a standard-font fixture", async () => {
  const { dir, dataHome } = sandbox();
  const src = await makeInvoicePdf(join(dir, "invoice.pdf"), "INV-2026-0042");
  const c = client({ dataHome });
  try {
    await c.init();
    const answer = await c.text("pdf_text", { path: src });
    assert.match(answer, /Invoice INV-2026-0042/);
    assert.match(answer, /Total EUR 4,500\.00/);
    assert.match(answer, /No OCR/);
  } finally { c.close(); }
});

test("text: an image-only page is reported as having no text operators", async () => {
  const { dir, dataHome } = sandbox();
  const doc = await PDFDocument.create();
  doc.addPage([300, 300]);
  const { writeFileSync } = await import("node:fs");
  const p = join(dir, "blank.pdf");
  writeFileSync(p, await doc.save({ useObjectStreams: false }));
  const c = client({ dataHome });
  try {
    await c.init();
    const answer = await c.text("pdf_text", { path: p });
    assert.match(answer, /no text extracted/);
  } finally { c.close(); }
});

test("encrypted: every writing tool refuses the file with a reason", async () => {
  const { dir, dataHome } = sandbox();
  const enc = await makeEncryptedPdf(join(dir, "locked.pdf"));
  const plain = await makePdf(join(dir, "plain.pdf"), 1, "p");
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    for (const [tool, args] of [
      ["pdf_text", { path: enc }],
      ["pdf_pages", { path: enc, pages: "1", out_path: join(dir, "o1.pdf") }],
      ["pdf_rotate", { path: enc, degrees: 90, out_path: join(dir, "o2.pdf") }],
      ["pdf_stamp", { path: enc, text: "PAID", out_path: join(dir, "o3.pdf") }],
      ["pdf_merge", { paths: [plain, enc], out_path: join(dir, "o4.pdf") }],
    ]) {
      const r = await c.call(tool, args);
      assert.equal(r.result.isError, true, `${tool} should refuse an encrypted file`);
      assert.match(r.result.content[0].text, /encrypted/, `${tool} should say why`);
    }
    for (const n of ["o1", "o2", "o3", "o4"]) assert.equal(existsSync(join(dir, `${n}.pdf`)), false);
    // pdf_info still answers, with the flag set, because reporting is its whole job.
    const info = await c.text("pdf_info", { path: enc });
    assert.match(info, /"encrypted": true/);
    const count = await c.text("pdf_count", { paths: [plain, enc] });
    assert.match(count, /"readable": 1/);
    assert.match(count, /"unreadable": 1/);
  } finally { c.close(); }
});

test("input guards: missing file, a non-PDF and a directory are all refused", async () => {
  const { dir, dataHome } = sandbox();
  const { writeFileSync } = await import("node:fs");
  const notPdf = join(dir, "notes.txt");
  writeFileSync(notPdf, "this is not a PDF");
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    let r = await c.call("pdf_info", { path: join(dir, "nope.pdf") });
    assert.match(r.result.content[0].text, /does not exist/);
    r = await c.call("pdf_info", { path: notPdf });
    assert.match(r.result.content[0].text, /not a PDF file/);
    r = await c.call("pdf_info", { path: dir });
    assert.match(r.result.content[0].text, /is a directory/);
  } finally { c.close(); }
});

test("info: page sizes, paper names and metadata", async () => {
  const { dir, dataHome } = sandbox();
  const src = await makePdf(join(dir, "src.pdf"), 2, "titled");
  const c = client({ dataHome });
  try {
    await c.init();
    const answer = await c.text("pdf_info", { path: src });
    assert.match(answer, /"pages": 2/);
    assert.match(answer, /"paper": "A4"/);
    assert.match(answer, /"title": "titled"/);
    assert.match(answer, /"encrypted": false/);
  } finally { c.close(); }
});
