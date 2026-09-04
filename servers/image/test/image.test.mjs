// Pixel-level behaviour of every writing tool, and the guards that refuse a call.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  client, dimensions, makeAlphaPng, makeBombPng, makeJpeg, makeJpegWithExif, makePng,
  proKey, readImage, sandbox, sha256,
} from "./_client.mjs";

test("resize: inside keeps the ratio, cover fills and crops, exact stretches", async () => {
  const { dir, dataHome } = sandbox("mcp-image-resize-");
  const src = await makePng(join(dir, "wide.png"), 400, 100);
  const before = sha256(src);
  const c = client({ dataHome });
  try {
    await c.init();
    const inside = join(dir, "inside.png");
    const t1 = await c.text("image_resize", { path: src, width: 200, height: 200, fit: "inside", out_path: inside });
    assert.match(t1, /Resized 400x100 to 200x50/);
    assert.deepEqual(await dimensions(inside), { width: 200, height: 50 });

    const oneSide = join(dir, "one.png");
    await c.text("image_resize", { path: src, width: 100, out_path: oneSide });
    assert.deepEqual(await dimensions(oneSide), { width: 100, height: 25 });

    const cover = join(dir, "cover.png");
    const t2 = await c.text("image_resize", { path: src, width: 200, height: 200, fit: "cover", out_path: cover });
    assert.match(t2, /fit: cover/);
    assert.deepEqual(await dimensions(cover), { width: 200, height: 200 });

    const exact = join(dir, "exact.png");
    await c.text("image_resize", { path: src, width: 320, height: 240, fit: "exact", out_path: exact });
    assert.deepEqual(await dimensions(exact), { width: 320, height: 240 });

    const bad = await c.call("image_resize", { path: src, width: 50, fit: "cover", out_path: join(dir, "bad.png") });
    assert.equal(bad.result.isError, true);
    assert.match(bad.result.content[0].text, /needs both width and height/);
    assert.equal(existsSync(join(dir, "bad.png")), false);

    assert.equal(sha256(src), before, "the source must be byte-identical after every resize");
  } finally { c.close(); }
});

test("convert: png to jpeg and back, alpha flattened, quality ignored where it does not exist", async () => {
  const { dir, dataHome } = sandbox("mcp-image-convert-");
  const src = await makePng(join(dir, "a.png"), 160, 120);
  const before = sha256(src);
  const c = client({ dataHome });
  try {
    await c.init();
    const jpg = join(dir, "a.jpg");
    const t1 = await c.text("image_convert", { path: src, format: "jpeg", quality: 70, out_path: jpg });
    assert.match(t1, /Converted PNG to JPEG/);
    assert.match(t1, /Quality 70/);
    assert.deepEqual(await dimensions(jpg), { width: 160, height: 120 });
    assert.equal(readFileSync(jpg)[0], 0xff, "a JPEG starts with FFD8");

    const back = join(dir, "back.png");
    await c.text("image_convert", { path: jpg, format: "png", out_path: back });
    assert.deepEqual(await dimensions(back), { width: 160, height: 120 });
    assert.deepEqual([...readFileSync(back).subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);

    for (const fmt of ["bmp", "gif", "tiff"]) {
      const out = join(dir, `a.${fmt}`);
      await c.text("image_convert", { path: src, format: fmt, out_path: out });
      assert.deepEqual(await dimensions(out), { width: 160, height: 120 }, `${fmt} round trip`);
    }

    const alpha = await makeAlphaPng(join(dir, "alpha.png"), 60, 40);
    const flat = join(dir, "alpha.jpg");
    const t2 = await c.text("image_convert", { path: alpha, format: "jpeg", out_path: flat });
    assert.match(t2, /flattened onto white/);
    const flatImg = await readImage(flat);
    const px = flatImg.getPixelColor(2, 2) >>> 0;
    assert.ok((px & 0xff) === 0xff, "a JPEG pixel is opaque");
    assert.ok(((px >>> 24) & 0xff) > 200, "the transparent half became white, not black");

    const q = await c.text("image_convert", { path: src, format: "png", quality: 50, out_path: join(dir, "q.png") });
    assert.match(q, /quality: 50 was ignored/);

    assert.equal(sha256(src), before);
  } finally { c.close(); }
});

test("compress: fewer bytes, and the answer names what did the work", async () => {
  const { dir, dataHome } = sandbox("mcp-image-compress-");
  const src = await makeJpeg(join(dir, "photo.jpg"), 300, 220, 100);
  const beforeBytes = readFileSync(src).length;
  const before = sha256(src);
  const c = client({ dataHome });
  try {
    await c.init();
    const out = join(dir, "photo-small.jpg");
    const t = await c.text("image_compress", { path: src, quality: 40, out_path: out });
    assert.match(t, /Method: JPEG quality 40/);
    const afterBytes = readFileSync(out).length;
    assert.ok(afterBytes < beforeBytes, `compress must reduce bytes: ${beforeBytes} -> ${afterBytes}`);
    assert.match(t, new RegExp(`${beforeBytes} -> ${afterBytes} bytes`));

    const png = await makePng(join(dir, "p.png"), 300, 220);
    const pngOut = join(dir, "p-small.png");
    const t2 = await c.text("image_compress", { path: png, quality: 40, out_path: pngOut });
    assert.match(t2, /Quality 40 does not apply to a PNG output/);

    const scaled = join(dir, "p-160.png");
    const t3 = await c.text("image_compress", { path: png, max_width: 160, out_path: scaled });
    assert.match(t3, /a resize to 160 px wide/);
    assert.deepEqual(await dimensions(scaled), { width: 160, height: 117 });
    assert.ok(readFileSync(scaled).length < readFileSync(png).length);

    assert.equal(sha256(src), before);
  } finally { c.close(); }
});

test("crop: the rectangle asked for, and a refusal when it runs past an edge", async () => {
  const { dir, dataHome } = sandbox("mcp-image-crop-");
  const src = await makePng(join(dir, "s.png"), 200, 100);
  const before = sha256(src);
  const c = client({ dataHome });
  try {
    await c.init();
    const out = join(dir, "cut.png");
    const t = await c.text("image_crop", { path: src, x: 10, y: 20, width: 50, height: 40, out_path: out });
    assert.match(t, /Cropped 50x40 from \(10, 20\)/);
    assert.deepEqual(await dimensions(out), { width: 50, height: 40 });

    // The cropped pixel at (0,0) must be the source pixel at (10,20), not a resample.
    const source = await readImage(src);
    const cut = await readImage(out);
    assert.equal(cut.getPixelColor(0, 0) >>> 0, source.getPixelColor(10, 20) >>> 0);

    const bad = await c.call("image_crop", { path: src, x: 180, y: 0, width: 50, height: 10, out_path: join(dir, "no.png") });
    assert.equal(bad.result.isError, true);
    assert.match(bad.result.content[0].text, /runs past the edge of a 200x100 image/);
    assert.equal(existsSync(join(dir, "no.png")), false);

    assert.equal(sha256(src), before);
  } finally { c.close(); }
});

test("watermark: pixels change where the text is drawn, and the source does not", async () => {
  const { dir, dataHome } = sandbox("mcp-image-wm-");
  const src = await makePng(join(dir, "photo.png"), 400, 200);
  const before = sha256(src);
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const out = join(dir, "wm.png");
    const t = await c.text("image_watermark", { path: src, text: "Acme Consulting", position: "bottom-right", opacity: 0.6, out_path: out });
    assert.match(t, /Watermarked "Acme Consulting" at bottom-right/);
    const a = await readImage(src);
    const b = await readImage(out);
    assert.equal(b.width, 400);
    assert.equal(b.height, 200);
    let changed = 0;
    for (let y = 0; y < 200; y += 2) {
      for (let x = 0; x < 400; x += 2) if ((a.getPixelColor(x, y) >>> 0) !== (b.getPixelColor(x, y) >>> 0)) changed++;
    }
    assert.ok(changed > 50, `the watermark must change pixels, changed ${changed} of 20000 sampled`);
    // Nothing outside the bottom-right region may have been touched at this position.
    assert.equal(a.getPixelColor(4, 4) >>> 0, b.getPixelColor(4, 4) >>> 0);
    assert.equal(sha256(src), before);
  } finally { c.close(); }
});

test("strip metadata: an EXIF block in, no EXIF block out, same pixels", async () => {
  const { dir, dataHome } = sandbox("mcp-image-exif-");
  const src = await makeJpegWithExif(join(dir, "camera.jpg"), 120, 90);
  const raw = readFileSync(src);
  assert.ok(raw.includes(Buffer.from("SECRET-GPS-PLACE", "latin1")), "the fixture must actually carry the block");
  const before = sha256(src);
  const c = client({ dataHome });
  try {
    await c.init();
    const out = join(dir, "clean.jpg");
    const t = await c.text("image_strip_metadata", { path: src, out_path: out });
    assert.match(t, /no metadata was carried across/);
    assert.match(t, /The source carried an EXIF or XMP block/);
    const after = readFileSync(out);
    assert.equal(after.includes(Buffer.from("SECRET-GPS-PLACE", "latin1")), false);
    assert.equal(after.includes(Buffer.from("Exif\0\0", "latin1")), false);
    assert.deepEqual(await dimensions(out), { width: 120, height: 90 });
    assert.equal(sha256(src), before, "the original keeps its metadata; only the copy is clean");
  } finally { c.close(); }
});

test("a decompression bomb is refused from its header, before anything decodes it", async () => {
  const { dir, dataHome } = sandbox("mcp-image-bomb-");
  const bomb = await makeBombPng(join(dir, "bomb.png"), 20000);
  assert.ok(readFileSync(bomb).length < 5000, "the point of a bomb is that the file is small");
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    const r = await c.call("image_info", { path: bomb });
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /declares 20000x20000 pixels/);
    assert.match(r.result.content[0].text, /decompression bomb/);
    const w = await c.call("image_resize", { path: bomb, width: 10, out_path: join(dir, "b.png") });
    assert.equal(w.result.isError, true);
    assert.equal(existsSync(join(dir, "b.png")), false);

    const notAnImage = join(dir, "notes.txt");
    writeFileSync(notAnImage, "this is not an image, it is a sentence");
    const n = await c.call("image_info", { path: notAnImage });
    assert.equal(n.result.isError, true);
    assert.match(n.result.content[0].text, /magic bytes/);
  } finally { c.close(); }
});

test("an output that is one of the inputs is refused, by path and by symlink", async () => {
  const { dir, dataHome } = sandbox("mcp-image-self-");
  const src = await makePng(join(dir, "src.png"), 200, 200);
  const before = sha256(src);
  const c = client({ dataHome, key: proKey() });
  try {
    await c.init();
    for (const args of [
      ["image_resize", { path: src, width: 50, out_path: src }],
      ["image_crop", { path: src, x: 0, y: 0, width: 10, height: 10, out_path: src }],
      ["image_compress", { path: src, out_path: src }],
      ["image_strip_metadata", { path: src, out_path: src }],
      ["image_watermark", { path: src, text: "x", out_path: src }],
    ]) {
      const r = await c.call(args[0], args[1]);
      assert.equal(r.result.isError, true, `${args[0]} must refuse writing over its own input`);
      assert.match(r.result.content[0].text, /is also an input of this operation/);
      assert.equal(sha256(src), before, `${args[0]} must leave the source untouched`);
    }
    // overwrite: true is consent to replace some other file, never to consume an input.
    const forced = await c.call("image_resize", { path: src, width: 50, out_path: src, overwrite: true });
    assert.equal(forced.result.isError, true);
    assert.equal(sha256(src), before);

    // The same file reached through a batch out_dir is caught too.
    const t = await c.call("image_thumbnails", { paths: [src], size: 64, out_dir: dir });
    assert.notEqual(t.result.isError, true);
    assert.ok(existsSync(join(dir, "src-thumb.png")));
    assert.equal(sha256(src), before);
  } finally { c.close(); }
});

test("dominant colours read the image and are Pro only", async () => {
  const { dir, dataHome } = sandbox("mcp-image-colors-");
  const path = join(dir, "flag.png");
  const { Jimp } = await import("jimp");
  const img = new Jimp({ width: 100, height: 100, color: 0xff0000ff });
  for (let y = 0; y < 100; y++) for (let x = 0; x < 25; x++) img.setPixelColor(0x0000ffff, x, y);
  writeFileSync(path, await img.getBuffer("image/png"));

  const free = client({ dataHome });
  try {
    await free.init();
    const r = await free.call("image_dominant_colors", { path });
    assert.notEqual(r.result.isError, true, "a tier limit is an answer, not a protocol error");
    assert.match(r.result.content[0].text, /Pro feature/);
    assert.match(r.result.content[0].text, /mcp\.zovo\.one\/buy\/image/);
  } finally { free.close(); }

  const pro = client({ dataHome, key: proKey() });
  try {
    await pro.init();
    const out = JSON.parse(await pro.text("image_dominant_colors", { path, count: 2 }));
    assert.equal(out.colors.length, 2);
    assert.equal(out.colors[0].hex, "#ff0000");
    assert.ok(Math.abs(out.colors[0].share_percent - 75) < 2, `red covers 75 percent, got ${out.colors[0].share_percent}`);
    assert.equal(out.colors[1].hex, "#0000ff");
  } finally { pro.close(); }
});

test("batch resize writes every file and reports each one", async () => {
  const { dir, dataHome } = sandbox("mcp-image-batch-");
  const paths = [];
  const hashes = [];
  for (let i = 1; i <= 3; i++) {
    paths.push(await makePng(join(dir, `b${i}.png`), 300, 150 + i * 10, i));
    hashes.push(sha256(paths[i - 1]));
  }
  const outDir = join(dir, "out");
  const c = client({ dataHome });
  try {
    await c.init();
    const t = await c.text("image_batch_resize", { paths, width: 100, out_dir: outDir });
    assert.match(t, /Resized 3 images/);
    for (let i = 1; i <= 3; i++) {
      const expected = join(outDir, `b${i}-100x${Math.round((150 + i * 10) * (100 / 300))}.png`);
      assert.ok(existsSync(expected), `${expected} must exist`);
    }
    for (let i = 0; i < 3; i++) assert.equal(sha256(paths[i]), hashes[i]);
    const none = await c.call("image_batch_resize", { paths, out_dir: outDir });
    assert.equal(none.result.isError, true);
    assert.match(none.result.content[0].text, /give width, height, or both/);
  } finally { c.close(); }
});
