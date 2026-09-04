// stdio protocol smoke test: handshake, tool list, and one call of each shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { client, dimensions, makePng, proKey, sandbox } from "./_client.mjs";

test("initialize, tools/list, resources, prompts", async () => {
  const { dir, dataHome } = sandbox("mcp-image-smoke-");
  const src = await makePng(join(dir, "a.png"), 320, 240);
  const c = client({ dataHome });
  try {
    const init = await c.init();
    assert.equal(init.result.serverInfo.name, "mcp-image");
    const list = await c.send("tools/list", {});
    const names = list.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "image_batch_resize", "image_compress", "image_convert", "image_crop", "image_dominant_colors",
      "image_info", "image_resize", "image_strip_metadata", "image_thumbnails", "image_watermark",
      "license_activate", "license_status",
    ]);
    for (const t of list.result.tools) {
      assert.ok(t.description && t.description.length > 30, `${t.name} needs a description`);
      assert.equal(/[\u{1F300}-\u{1FAFF}]/u.test(`${t.title ?? ""}${t.description}`), false, `${t.name} must carry no emoji`);
    }
    const info = JSON.parse(await c.text("image_info", { path: src }));
    assert.equal(info.format, "png");
    assert.equal(info.width, 320);
    assert.equal(info.height, 240);
    assert.equal(info.megapixels, 0.08);
    assert.equal(info.size_bytes, readFileSync(src).length);

    const res = await c.send("resources/list", {});
    assert.deepEqual(res.result.resources.map((r) => r.uri), ["image://recent"]);
    const prompts = await c.send("prompts/list", {});
    assert.deepEqual(prompts.result.prompts.map((p) => p.name), ["prepare_for_web"]);
    const prompt = await c.send("prompts/get", { name: "prepare_for_web", arguments: { path: src } });
    assert.match(prompt.result.messages[0].content.text, /image_compress/);
    assert.match(prompt.result.messages[0].content.text, /image_info/);

    const status = await c.text("license_status", {});
    assert.match(status, /"tier": "free"/);
  } finally { c.close(); }
});

test("resize, thumbnails of three, and the operation register", async () => {
  const { dir, dataHome } = sandbox("mcp-image-ops-");
  const a = await makePng(join(dir, "a.png"), 400, 300, 1);
  const b = await makePng(join(dir, "b.png"), 200, 500, 2);
  const d = await makePng(join(dir, "d.png"), 640, 480, 3);
  const c = client({ dataHome });
  try {
    await c.init();
    const small = join(dir, "a-small.png");
    const r = await c.text("image_resize", { path: a, width: 100, out_path: small });
    assert.match(r, /Resized 400x300 to 100x75/);
    assert.deepEqual(await dimensions(small), { width: 100, height: 75 });

    const outDir = join(dir, "thumbs");
    const t = await c.text("image_thumbnails", { paths: [a, b, d], size: 128, out_dir: outDir });
    assert.match(t, /3 thumbnails at most 128 px/);
    assert.deepEqual(await dimensions(join(outDir, "a-thumb.png")), { width: 128, height: 96 });
    assert.deepEqual(await dimensions(join(outDir, "b-thumb.png")), { width: 51, height: 128 });
    assert.deepEqual(await dimensions(join(outDir, "d-thumb.png")), { width: 128, height: 96 });

    const recent = await c.send("resources/read", { uri: "image://recent" });
    const ops = JSON.parse(recent.result.contents[0].text);
    assert.deepEqual(ops.map((o) => o.op), ["image_thumbnails", "image_resize"]);
    assert.equal(ops[0].outputs.length, 3);
  } finally { c.close(); }
});

test("free tier: a six-file batch is refused with the checkout URL, Pro runs it", async () => {
  const { dir, dataHome } = sandbox("mcp-image-free-");
  const paths = [];
  for (let i = 1; i <= 6; i++) paths.push(await makePng(join(dir, `f${i}.png`), 100, 100, i));
  const outDir = join(dir, "out");
  const free = client({ dataHome });
  try {
    await free.init();
    const r = await free.call("image_thumbnails", { paths, out_dir: outDir });
    assert.notEqual(r.result.isError, true, "a tier limit is an answer, not a protocol error");
    const text = r.result.content[0].text;
    assert.match(text, /free tier processes up to 5 files/);
    assert.match(text, /mcp\.zovo\.one\/buy\/image/);
    assert.equal(existsSync(join(outDir, "f1-thumb.png")), false, "nothing may be written when a limit refuses the call");
  } finally { free.close(); }

  const pro = client({ dataHome, key: proKey() });
  try {
    await pro.init();
    const t = await pro.text("image_thumbnails", { paths, out_dir: outDir });
    assert.match(t, /6 thumbnails/);
    for (let i = 1; i <= 6; i++) assert.ok(existsSync(join(outDir, `f${i}-thumb.png`)));
    const status = await pro.text("license_status", {});
    assert.match(status, /"tier": "pro"/);
  } finally { pro.close(); }
});

test("free tier: over 4 MP is refused, Pro writes it", async () => {
  const { dir, dataHome } = sandbox("mcp-image-mp-");
  const big = await makePng(join(dir, "big.png"), 2200, 2000);
  const free = client({ dataHome });
  try {
    await free.init();
    // Reporting is never capped: image_info answers at any size.
    const info = JSON.parse(await free.text("image_info", { path: big }));
    assert.equal(info.megapixels, 4.4);
    const r = await free.call("image_resize", { path: big, width: 100, out_path: join(dir, "small.png") });
    assert.notEqual(r.result.isError, true);
    assert.match(r.result.content[0].text, /free tier writes images up to 4 MP/);
    assert.equal(existsSync(join(dir, "small.png")), false);
  } finally { free.close(); }

  const pro = client({ dataHome, key: proKey() });
  try {
    await pro.init();
    const t = await pro.text("image_resize", { path: big, width: 100, out_path: join(dir, "small.png") });
    assert.match(t, /Resized 2200x2000 to 100x91/);
    assert.ok(existsSync(join(dir, "small.png")));
  } finally { pro.close(); }
});

test("free watermark uses the shared profile; custom text is Pro", async () => {
  const { dir, dataHome } = sandbox("mcp-image-wm2-");
  const src = await makePng(join(dir, "p.png"), 400, 200);
  const free = client({ dataHome });
  try {
    await free.init();
    const noProfile = await free.call("image_watermark", { path: src, out_path: join(dir, "w1.png") });
    assert.equal(noProfile.result.isError, true);
    assert.match(noProfile.result.content[0].text, /no business name is stored/);
    assert.equal(existsSync(join(dir, "w1.png")), false);

    const custom = await free.call("image_watermark", { path: src, text: "Anything", out_path: join(dir, "w2.png") });
    assert.notEqual(custom.result.isError, true);
    assert.match(custom.result.content[0].text, /Custom watermark text is a Pro feature/);
    assert.equal(existsSync(join(dir, "w2.png")), false);
  } finally { free.close(); }

  // The shared profile the whole suite reads, written the way mcp-invoice writes it.
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const profileDir = join(dataHome, "mcp-servers", "profile");
  mkdirSync(profileDir, { recursive: true });
  writeFileSync(join(profileDir, "business.json"), JSON.stringify({ name: "Acme Consulting", vat_id: "PL1234567890" }));

  const withProfile = client({ dataHome });
  try {
    await withProfile.init();
    const t = await withProfile.text("image_watermark", { path: src, out_path: join(dir, "w3.png") });
    assert.match(t, /Watermarked "Acme Consulting"/);
    assert.match(t, /Text taken from the shared business profile/);
    assert.ok(existsSync(join(dir, "w3.png")));
  } finally { withProfile.close(); }
});

test("exclusive create: an existing out_path is refused until overwrite is passed", async () => {
  const { dir, dataHome } = sandbox("mcp-image-excl-");
  const src = await makePng(join(dir, "s.png"), 200, 100);
  const out = join(dir, "taken.png");
  const c = client({ dataHome });
  try {
    await c.init();
    await c.text("image_resize", { path: src, width: 50, out_path: out });
    const first = readFileSync(out).length;
    const again = await c.call("image_resize", { path: src, width: 20, out_path: out });
    assert.equal(again.result.isError, true);
    assert.match(again.result.content[0].text, /already exists and nothing was written/);
    assert.equal(readFileSync(out).length, first, "the refused call must not have touched the file");
    const forced = await c.text("image_resize", { path: src, width: 20, out_path: out, overwrite: true });
    assert.match(forced, /Resized 200x100 to 20x10/);
    assert.deepEqual(await dimensions(out), { width: 20, height: 10 });
  } finally { c.close(); }
});
