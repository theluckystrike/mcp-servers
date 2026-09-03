// Two server processes on one data directory must not lose register records, and two
// racing writes to one out_path must not both "succeed".
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { client, makePdf, proKey, sandbox } from "./_client.mjs";

test("two processes, one data dir: 20 concurrent operations all reach the register", async () => {
  const { dir, dataHome } = sandbox("mcp-pdf-conc-");
  const key = proKey();
  const src = await makePdf(join(dir, "src.pdf"), 4, "s");
  const a = client({ dataHome, key });
  const b = client({ dataHome, key });
  try {
    await a.init();
    await b.init();
    const jobs = [];
    for (let i = 0; i < 10; i++) {
      jobs.push(a.text("pdf_pages", { path: src, pages: "1", out_path: join(dir, `a-${i}.pdf`) }));
      jobs.push(b.text("pdf_pages", { path: src, pages: "2", out_path: join(dir, `b-${i}.pdf`) }));
    }
    const answers = await Promise.all(jobs);
    for (const t of answers) assert.match(t, /Extracted 1 page/);
    for (let i = 0; i < 10; i++) {
      assert.equal((await PDFDocument.load(readFileSync(join(dir, `a-${i}.pdf`)))).getPageCount(), 1);
      assert.equal((await PDFDocument.load(readFileSync(join(dir, `b-${i}.pdf`)))).getPageCount(), 1);
    }
    const ops = JSON.parse(readFileSync(join(dataHome, "mcp-servers", "pdf", "operations.json"), "utf8"));
    assert.equal(ops.length, 20, `every operation must be in the register, got ${ops.length}`);
    assert.equal(new Set(ops.map((o) => o.id)).size, 20);
    assert.equal(new Set(ops.flatMap((o) => o.outputs)).size, 20);
  } finally { a.close(); b.close(); }
});

test("two processes racing one out_path: exactly one wins and the other writes nothing", async () => {
  const { dir, dataHome } = sandbox("mcp-pdf-race-");
  const key = proKey();
  const src = await makePdf(join(dir, "src.pdf"), 6, "s");
  const a = client({ dataHome, key });
  const b = client({ dataHome, key });
  try {
    await a.init();
    await b.init();
    const out = join(dir, "contested.pdf");
    const [ra, rb] = await Promise.all([
      a.call("pdf_pages", { path: src, pages: "1-3", out_path: out }),
      b.call("pdf_pages", { path: src, pages: "4-6", out_path: out }),
    ]);
    const results = [ra, rb].map((r) => r.result);
    const won = results.filter((r) => r.isError !== true);
    const lost = results.filter((r) => r.isError === true);
    assert.equal(won.length, 1, "exactly one writer may win an exclusive create");
    assert.equal(lost.length, 1);
    assert.match(lost[0].content[0].text, /already exists and nothing was written/);
    // The winner's file is complete: 3 pages, not a truncated or interleaved mix.
    assert.equal((await PDFDocument.load(readFileSync(out))).getPageCount(), 3);
  } finally { a.close(); b.close(); }
});

test("a failed split leaves none of its reserved outputs behind", async () => {
  const { dir, dataHome } = sandbox("mcp-pdf-reserve-");
  const src = await makePdf(join(dir, "src.pdf"), 9, "s");
  const taken = await makePdf(join(dir, "part-3.pdf"), 1, "in the way");
  const before = readFileSync(taken);
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const r = await c.call("pdf_split", { path: src, ranges: "1-3,4-6,7-9", out_path_pattern: join(dir, "part-{n}.pdf") });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /already exists and nothing was written/);
    // parts 1 and 2 were reserved before part 3 collided; the reservations must be gone.
    assert.equal(existsSync(join(dir, "part-1.pdf")), false);
    assert.equal(existsSync(join(dir, "part-2.pdf")), false);
    assert.deepEqual(readFileSync(taken), before);
  } finally { c.close(); }
});

test("a corrupt register blocks the register, not the file that was written", async () => {
  const { dir, dataHome } = sandbox("mcp-pdf-corrupt-");
  const src = await makePdf(join(dir, "src.pdf"), 2, "s");
  const { mkdirSync, writeFileSync, readdirSync } = await import("node:fs");
  mkdirSync(join(dataHome, "mcp-servers", "pdf"), { recursive: true });
  writeFileSync(join(dataHome, "mcp-servers", "pdf", "operations.json"), "{ this is not json");
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const out = join(dir, "out.pdf");
    const text = await c.text("pdf_pages", { path: src, pages: "1", out_path: out });
    assert.match(text, /Extracted 1 page/);
    assert.match(text, /could not be added to the operation history/);
    assert.equal((await PDFDocument.load(readFileSync(out))).getPageCount(), 1);
    const files = readdirSync(join(dataHome, "mcp-servers", "pdf"));
    assert.ok(files.some((f) => f.startsWith("operations.json.corrupt-")), `the bad file must be quarantined, saw ${files.join(", ")}`);
    assert.ok(files.includes("operations.json.corrupt"), "a marker must be left behind");
  } finally { c.close(); }
});
