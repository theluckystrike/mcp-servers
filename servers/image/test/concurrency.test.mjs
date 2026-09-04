// Two server processes on one data directory must not lose register records, and two
// racing writes to one out_path must not both "succeed".
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { client, dimensions, makePng, proKey, sandbox, sha256 } from "./_client.mjs";

test("two processes, one data dir: 20 concurrent operations all reach the register", async () => {
  const { dir, dataHome } = sandbox("mcp-image-conc-");
  const key = proKey();
  const src = await makePng(join(dir, "src.png"), 240, 180);
  const before = sha256(src);
  const a = client({ dataHome, key });
  const b = client({ dataHome, key });
  try {
    await a.init();
    await b.init();
    const jobs = [];
    for (let i = 0; i < 10; i++) {
      jobs.push(a.text("image_resize", { path: src, width: 60, out_path: join(dir, `a-${i}.png`) }));
      jobs.push(b.text("image_resize", { path: src, width: 30, out_path: join(dir, `b-${i}.png`) }));
    }
    const answers = await Promise.all(jobs);
    for (const t of answers) assert.match(t, /Resized 240x180/);
    for (let i = 0; i < 10; i++) {
      assert.deepEqual(await dimensions(join(dir, `a-${i}.png`)), { width: 60, height: 45 });
      assert.deepEqual(await dimensions(join(dir, `b-${i}.png`)), { width: 30, height: 23 });
    }
    const ops = JSON.parse(readFileSync(join(dataHome, "mcp-servers", "image", "operations.json"), "utf8"));
    assert.equal(ops.length, 20, `every operation must be in the register, got ${ops.length}`);
    assert.equal(new Set(ops.map((o) => o.id)).size, 20);
    assert.equal(new Set(ops.flatMap((o) => o.outputs)).size, 20);
    assert.equal(sha256(src), before, "20 concurrent reads must leave the source byte-identical");
  } finally { a.close(); b.close(); }
});

test("two processes racing one out_path: exactly one wins and the other writes nothing", async () => {
  const { dir, dataHome } = sandbox("mcp-image-race-");
  const key = proKey();
  const src = await makePng(join(dir, "src.png"), 400, 400);
  const out = join(dir, "same.png");
  const a = client({ dataHome, key });
  const b = client({ dataHome, key });
  try {
    await a.init();
    await b.init();
    const [ra, rb] = await Promise.all([
      a.call("image_resize", { path: src, width: 100, out_path: out }),
      b.call("image_resize", { path: src, width: 200, out_path: out }),
    ]);
    const errors = [ra, rb].filter((r) => r.result.isError === true);
    assert.equal(errors.length, 1, "exactly one of the two racing writes must be refused");
    assert.match(errors[0].result.content[0].text, /already exists and nothing was written/);
    const dims = await dimensions(out);
    assert.ok(dims.width === 100 || dims.width === 200, `the winner's file must be complete, got ${JSON.stringify(dims)}`);
  } finally { a.close(); b.close(); }
});

test("a batch that collides on file 3 leaves no half-done output behind", async () => {
  const { dir, dataHome } = sandbox("mcp-image-partial-");
  const outDir = join(dir, "thumbs");
  const paths = [];
  for (let i = 1; i <= 3; i++) paths.push(await makePng(join(dir, `p${i}.png`), 200, 200, i));
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const { mkdirSync } = await import("node:fs");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "p3-thumb.png"), "taken");
    const r = await c.call("image_thumbnails", { paths, size: 64, out_dir: outDir });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /already exists and nothing was written/);
    assert.equal(existsSync(join(outDir, "p1-thumb.png")), false, "file 1 must not survive a collision on file 3");
    assert.equal(existsSync(join(outDir, "p2-thumb.png")), false, "file 2 must not survive a collision on file 3");
    assert.equal(readFileSync(join(outDir, "p3-thumb.png"), "utf8"), "taken", "the file that was in the way is untouched");
  } finally { c.close(); }
});

test("a corrupt register is quarantined, and the image is still written", async () => {
  const { dir, dataHome } = sandbox("mcp-image-corrupt-");
  const src = await makePng(join(dir, "s.png"), 120, 120);
  const c = client({ dataHome });
  try {
    await c.init();
    await c.text("image_resize", { path: src, width: 60, out_path: join(dir, "one.png") });
    const reg = join(dataHome, "mcp-servers", "image", "operations.json");
    writeFileSync(reg, "{ this is not json");
    const out = join(dir, "two.png");
    const t = await c.text("image_resize", { path: src, width: 30, out_path: out });
    assert.match(t, /Resized 120x120 to 30x30/);
    assert.match(t, /could not be added to the operation history/);
    assert.ok(existsSync(out), "the image is on disk before the register is touched");
    assert.ok(existsSync(`${reg}.corrupt`), "a marker must sit beside the quarantined file");
  } finally { c.close(); }
});
