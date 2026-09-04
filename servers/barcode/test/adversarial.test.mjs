// Audit part 1. Every row in docs/BARCODE_RESULT.md's probe table is asserted here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, client, proKey, sandbox } from "./_client.mjs";

test("missing arguments are named, one per required field", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  const a = await c.call("qr_create", {});
  assert.equal(a.isError, true);
  assert.match(a.text, /text/i);
  const b = await c.call("barcode_create", { symbology: "ean13" });
  assert.equal(b.isError, true);
  assert.match(b.text, /value/i);
  const d = await c.call("qr_payment_sepa", { name: "A" });
  assert.equal(d.isError, true);
  assert.match(d.text, /iban/i);
  const e = await c.call("barcode_create", { symbology: "not-a-symbology", value: "1" });
  assert.equal(e.isError, true);
  // Nothing may have been registered by any of them.
  const list = await c.call("code_list", {});
  assert.match(list.text, /0 of 20 free codes used/);
});

test("a 10 KB payload is refused with the version-40 ceiling named, and nothing is written", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  const out = join(box.dir, "big.svg");
  const r = await c.call("qr_create", { text: "a".repeat(10240), out_path: out });
  assert.equal(r.isError, true);
  assert.match(r.text, /10240 bytes/);
  assert.match(r.text, /2953 bytes/);
  assert.equal(existsSync(out), false);

  // The largest payload that does fit still works, at error correction L.
  const okr = await c.call("qr_create", { text: "a".repeat(2953), error_correction: "L" });
  assert.equal(okr.isError, false, okr.text.slice(0, 200));
  assert.match(okr.text, /version 40/);
});

test("an invalid IBAN, a zero amount and a huge amount are each refused by name", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const iban = "DE89370400440532013000";

  const bad = await c.call("qr_payment_sepa", { iban: "DE89370400440532013001", name: "A", amount: 10 });
  assert.equal(bad.isError, true);
  assert.match(bad.text, /check digits do not validate/);

  const zero = await c.call("qr_payment_sepa", { iban, name: "A", amount: 0 });
  assert.equal(zero.isError, true);
  assert.match(zero.text, /0\.01 to 999999999\.99/);
  assert.match(zero.text, /leave amount out/i);

  const huge = await c.call("qr_payment_sepa", { iban, name: "A", amount: 1e15 });
  assert.equal(huge.isError, true);
  assert.match(huge.text, /outside the EPC069-12 range/);

  const negative = await c.call("qr_payment_sepa", { iban, name: "A", amount: -5 });
  assert.equal(negative.isError, true);

  const usd = await c.call("qr_payment_sepa", { iban, name: "A", amount: 10, currency: "USD" });
  assert.equal(usd.isError, true);
  assert.match(usd.text, /euro only/);

  const max = await c.call("qr_payment_sepa", { iban, name: "A", amount: 999999999.99 });
  assert.equal(max.isError, false, max.text.slice(0, 200));
  const list = await c.call("code_list", {});
  assert.match(list.text, /1 of 20 free codes used/, "only the one accepted amount may be registered");
});

test("an IBAN with a valid checksum but the wrong length for its country is refused on length, not silently accepted", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  // PL is 28 characters; this one is 20, with check digits computed by the same ISO 7064
  // algorithm so the checksum alone would pass. Length must be checked independently.
  const wrongLength = "PL151111111111111111";
  const r = await c.call("qr_payment_sepa", { iban: wrongLength, name: "A", amount: 10 });
  assert.equal(r.isError, true);
  assert.match(r.text, /PL IBAN is 28 characters/);
  assert.match(r.text, /is 20/);
});

test("a lowercase BIC is normalized and accepted, not refused for case", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const iban = "DE89370400440532013000";
  const r = await c.call("qr_payment_sepa", { iban, name: "A", amount: 10, bic: "deutdeff" });
  assert.equal(r.isError, false, r.text.slice(0, 200));
});

test("remittance text one character over the EPC limit is refused; exactly at the limit is accepted", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const iban = "DE89370400440532013000";
  const over = await c.call("qr_payment_sepa", { iban, name: "A", amount: 10, remittance: "x".repeat(141) });
  assert.equal(over.isError, true);
  assert.match(over.text, /allows 140/);

  const atLimit = await c.call("qr_payment_sepa", { iban, name: "A", amount: 10, remittance: "x".repeat(140) });
  assert.equal(atLimit.isError, false, atLimit.text.slice(0, 200));
});

test("amount given as a formatted string is refused by the protocol, not parsed as a number", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const iban = "DE89370400440532013000";
  const r = await c.call("qr_payment_sepa", { iban, name: "A", amount: "1,230.00" });
  assert.equal(r.isError, true);
  assert.match(r.text, /Expected number, received string/);
  const list = await c.call("code_list", {});
  assert.match(list.text, /0 of 20 free codes used/, "a rejected string amount must cost no allowance");
});

test("an EAN with the wrong check digit is refused and the right one is named", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const out = join(box.dir, "bad.svg");
  const r = await c.call("barcode_create", { symbology: "ean13", value: "5901234123450", out_path: out });
  assert.equal(r.isError, true);
  assert.match(r.text, /ends in 0, but the first 12 digits give 7/);
  assert.equal(existsSync(out), false);
});

test("out_path: a directory, a missing parent, an existing file and a traversal path", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  const dir = join(box.dir, "adir");
  mkdirSync(dir, { recursive: true });
  const asDir = await c.call("barcode_create", { symbology: "code128", value: "ABC", out_path: dir });
  assert.equal(asDir.isError, true);
  assert.match(asDir.text, /is a directory, not a file/);
  assert.equal(statSync(dir).isDirectory(), true);

  const missing = await c.call("barcode_create", { symbology: "code128", value: "ABC", out_path: join(box.dir, "nope", "x.svg") });
  assert.equal(missing.isError, true);
  assert.match(missing.text, /does not exist/);

  const target = join(box.dir, "keep.svg");
  writeFileSync(target, "ORIGINAL");
  const clash = await c.call("barcode_create", { symbology: "code128", value: "ABC", out_path: target });
  assert.equal(clash.isError, true);
  assert.match(clash.text, /already exists \(8 bytes\)/);
  assert.equal(readFileSync(target, "utf8"), "ORIGINAL", "an existing file may not be replaced without overwrite");
  const forced = await c.call("barcode_create", { symbology: "code128", value: "ABC", out_path: target, overwrite: true });
  assert.equal(forced.isError, false, forced.text);
  assert.match(readFileSync(target, "utf8"), /^<svg /);

  // Traversal is not sandboxed (out_path is the caller's own filesystem, the rule the rest
  // of the suite uses), but it resolves to a real path under the sandbox and stays there.
  const nested = join(box.dir, "adir", "deeper");
  mkdirSync(nested, { recursive: true });
  const up = await c.call("barcode_create", { symbology: "code128", value: "ABC", out_path: join(nested, "..", "..", "up.svg") });
  assert.equal(up.isError, false, up.text);
  assert.equal(existsSync(join(box.dir, "up.svg")), true, "the path resolves rather than being taken literally");
  assert.match(up.text, new RegExp(`Wrote ${box.dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/up\\.svg`));

  const ext = await c.call("barcode_create", { symbology: "code128", value: "ABC", out_path: join(box.dir, "x.png") });
  assert.equal(ext.isError, true);
  assert.match(ext.text, /format is svg/);
  assert.equal(existsSync(join(box.dir, "x.png")), false);
});

test("a PNG with no out_path is refused rather than pasted into the conversation", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const r = await c.call("qr_create", { text: "x", format: "png" });
  assert.equal(r.isError, true);
  assert.match(r.text, /needs out_path/);
});

test("size is refused above and below the range a scanner can read", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const small = await c.call("qr_create", { text: "x", format: "png", size: 8, out_path: join(box.dir, "s.png") });
  assert.equal(small.isError, true);
  assert.match(small.text, /below 32 px/);
  const big = await c.call("qr_create", { text: "x", format: "png", size: 99999, out_path: join(box.dir, "b.png") });
  assert.equal(big.isError, true);
  assert.match(big.text, /above 4000 px/);
  assert.equal(readdirSync(box.dir).filter((f) => f.endsWith(".png")).length, 0);
});

test("a corrupt register is quarantined byte for byte and every later call says so", async (t) => {
  const box = sandbox();
  const dir = join(box.dataHome, "mcp-servers", "barcode");
  mkdirSync(dir, { recursive: true });
  const garbage = '[{"id":"a", <<< truncated by a crash';
  writeFileSync(join(dir, "codes.json"), garbage);

  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();

  const r = await c.call("qr_create", { text: "x" });
  assert.equal(r.isError, true, r.text.slice(0, 200));
  assert.match(r.text, /corrupt/i);

  const moved = readdirSync(dir).filter((f) => f.startsWith("codes.json.corrupt-"));
  assert.equal(moved.length, 1, JSON.stringify(readdirSync(dir)));
  assert.equal(readFileSync(join(dir, moved[0]), "utf8"), garbage, "the quarantined copy must be the original bytes");
  assert.equal(readdirSync(dir).includes("codes.json"), false, "an empty register must not be written over the corrupt one");

  // Reads fail too, not only writes: a register that is on disk must never read as empty.
  const l = await c.call("code_list", {});
  assert.equal(l.isError, true);
  assert.match(l.text, /corrupt/i);
});

test("a register that parses to the wrong shape is treated as corrupt, not as empty", async (t) => {
  const box = sandbox();
  const dir = join(box.dataHome, "mcp-servers", "barcode");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "codes.json"), '{"codes":[]}');
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const r = await c.call("code_list", {});
  assert.equal(r.isError, true);
  assert.match(r.text, /corrupt/i);
});

test("the free monthly cap counts the register and refuses the 21st code", async (t) => {
  const box = sandbox();
  const dir = join(box.dataHome, "mcp-servers", "barcode");
  mkdirSync(dir, { recursive: true });
  const now = new Date().toISOString();
  const rows = Array.from({ length: 20 }, (_, i) => ({
    id: `x${i}`, kind: "text", symbology: "qr", summary: "seed", format: "svg", created: now,
  }));
  // One row from a previous month must not count against this month.
  rows.push({ id: "old", kind: "text", symbology: "qr", summary: "seed", format: "svg", created: "2001-01-01T00:00:00.000Z" });
  writeFileSync(join(dir, "codes.json"), JSON.stringify(rows));

  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  const r = await c.call("qr_create", { text: "one too many" });
  assert.equal(r.isError, false, "a tier limit is an answer, not a protocol error");
  assert.match(r.text, /20 codes per calendar month and 20 have been generated/);
  assert.match(r.text, /mcp\.zovo\.one\/buy\/barcode/);

  const pro = client({ dataHome: box.dataHome, key: proKey() });
  t.after(() => pro.close());
  await pro.init();
  const p = await pro.call("qr_create", { text: "one too many" });
  assert.equal(p.isError, false, p.text.slice(0, 200));
  assert.match(p.text, /QR code/);
});

test("batch is Pro, is capped, and reports the rows it refused without stopping", async (t) => {
  const box = sandbox();
  const free = client({ dataHome: box.dataHome });
  t.after(() => { free.close(); cleanup(box.dir); });
  await free.init();
  const refused = await free.call("barcode_batch", { out_dir: box.dir, items: [{ value: "A" }] });
  assert.equal(refused.isError, false);
  assert.match(refused.text, /Pro feature/);
  assert.equal(readdirSync(box.dir).some((f) => f.endsWith(".svg")), false);

  const outDir = join(box.dir, "out");
  mkdirSync(outDir, { recursive: true });
  const pro = client({ dataHome: join(box.dir, "pro"), key: proKey() });
  t.after(() => pro.close());
  await pro.init();

  const r = await pro.call("barcode_batch", {
    out_dir: outDir,
    symbology: "ean13",
    items: [{ value: "5901234123457" }, { value: "5901234123450" }, { value: "4006381333931" }, { value: "hello", symbology: "qr" }],
  });
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /Wrote 3 of 4/);
  assert.match(r.text, /row 2 .*check digit is wrong/s);
  assert.equal(readdirSync(outDir).sort().join(","), "4006381333931.svg,5901234123457.svg,hello.svg");

  const tooMany = await pro.call("barcode_batch", { out_dir: outDir, items: Array.from({ length: 501 }, () => ({ value: "A" })) });
  assert.equal(tooMany.isError, true);
  assert.match(tooMany.text, /at most 500/);

  const empty = await pro.call("barcode_batch", { out_dir: outDir, items: [] });
  assert.equal(empty.isError, true);
  assert.match(empty.text, /items is empty/);
});

test("stdout carries JSON-RPC only, including on the error paths", async (t) => {
  const box = sandbox();
  const c = client({ dataHome: box.dataHome });
  t.after(() => { c.close(); cleanup(box.dir); });
  await c.init();
  await c.tools();
  await c.call("qr_create", { text: "ok" });
  await c.call("barcode_create", { symbology: "ean13", value: "5901234123450" });
  await c.call("qr_payment_sepa", { iban: "nonsense", name: "A" });
  await new Promise((r) => setTimeout(r, 150));

  const lines = [...c.stdoutLines, c.tail].filter((l) => l.trim() !== "");
  assert.ok(lines.length >= 5, `expected protocol lines, got ${lines.length}`);
  for (const line of lines) {
    let m;
    try { m = JSON.parse(line); } catch { assert.fail(`non-JSON on stdout: ${line.slice(0, 200)}`); }
    assert.equal(m.jsonrpc, "2.0");
  }
});
