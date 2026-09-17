// Tests for billing/src/license-auth.ts. Plain node:test + node:assert, no frameworks.
// Run: node --test test/license-auth.test.mjs
// Node >= 22.6 imports the .ts directly (strip-types); Node 20 compiles it first with the
// repo's tsc into .build/license-auth.js. The module is WebCrypto-only, so plain node runs it.
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as nodeSign, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const [major, minor] = process.versions.node.split(".").map(Number);
const STRIP_TYPES = major > 22 || (major === 22 && minor >= 6);

/** Compile src/license-auth.ts with the repo's tsc into .build/ and return its path. */
function compiledModule() {
  const outDir = join(HERE, ".build");
  mkdirSync(outDir, { recursive: true });
  execFileSync(join(HERE, "../../node_modules/.bin/tsc"), [
    join(HERE, "../src/license-auth.ts"),
    "--outDir", outDir, "--target", "ES2022", "--module", "NodeNext",
    "--moduleResolution", "NodeNext", "--skipLibCheck",
  ], { stdio: "inherit" });
  return join(outDir, "license-auth.js");
}

const { LicenseAuth, payloadShapeError } = await import(
  STRIP_TYPES
    ? "../src/license-auth.ts"
    : compiledModule()
);

/** Mint an ephemeral Ed25519 pair and return { rawB64, mint }. */
function makeSigner() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ format: "der", type: "spki" });
  const raw = der.subarray(der.length - 32); // last 32 bytes of SPKI = raw key
  const rawB64 = raw.toString("base64");
  const enc = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const mint = (payload) => {
    const body = enc(Buffer.from(JSON.stringify(payload)));
    return `MCPL1.${body}.${enc(nodeSign(null, Buffer.from(body), privateKey))}`;
  };
  return { rawB64, mint };
}

const NOW = 1_750_000_000_000; // fixed clock
const auth = (() => {
  const { rawB64, mint } = makeSigner();
  return { inst: new LicenseAuth({ publicKeyB64: rawB64, now: () => NOW }), mint };
})();
const { inst, mint } = auth;

const basePayload = { v: 1, p: "invoice", id: "abc123", iat: 1000 };

test("a well-formed key for the product verifies", async () => {
  const r = await inst.verify(mint(basePayload), "invoice");
  assert.equal(r.ok, true);
  assert.equal(r.payload.id, "abc123");
  assert.equal(r.payload.p, "invoice");
});

test("a bundle (*) key verifies for any single product", async () => {
  const r = await inst.verify(mint({ ...basePayload, p: "*" }), "spreadsheet");
  assert.equal(r.ok, true);
  assert.equal(r.payload.p, "*");
});

test("a key for another product is refused with the product named", async () => {
  const r = await inst.verify(mint(basePayload), "spreadsheet");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "key is for invoice, not spreadsheet");
});

test("a signature tampered by one bit is refused", async () => {
  const key = mint(basePayload);
  const parts = key.split(".");
  const sig = Buffer.from(parts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64");
  sig[0] ^= 1;
  const tampered = `MCPL1.${parts[1]}.${sig.toString("base64url")}`;
  const r = await inst.verify(tampered, "invoice");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "signature invalid");
});

test("a payload swapped after signing is refused (the '*' escalation case)", async () => {
  const key = mint(basePayload);
  const parts = key.split(".");
  const escalated = `MCPL1.${Buffer.from(JSON.stringify({ ...basePayload, p: "*" })).toString("base64url")}.${parts[2]}`;
  const r = await inst.verify(escalated, "invoice");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "signature invalid");
});

test("an expired key is refused; a lifetime key is not", async () => {
  const nowSec = Math.floor(NOW / 1000);
  const expired = await inst.verify(mint({ ...basePayload, exp: nowSec - 1 }), "invoice");
  assert.equal(expired.ok, false);
  assert.equal(expired.reason, "expired");
  const lifetime = await inst.verify(mint(basePayload), "invoice");
  assert.equal(lifetime.ok, true);
});

test("malformed inputs all fail closed", async () => {
  for (const bad of ["", "not-a-key", "MCPL1.a.b.c", "MCPL2.a.b", "MCPL1.!!!.!!!"]) {
    const r = await inst.verify(bad, "invoice");
    assert.equal(r.ok, false, `expected rejection for ${JSON.stringify(bad)}`);
  }
});

test("payloadShapeError rejects wrong shapes (review #19 hardening)", () => {
  assert.equal(payloadShapeError({ v: 2, p: "x", id: "y", iat: 1 }), "unsupported version");
  assert.equal(payloadShapeError({ v: 1, p: "", id: "y", iat: 1 }), "bad payload");
  assert.equal(payloadShapeError({ v: 1, p: "x", id: "bad:id", iat: 1 }), "bad payload");
  assert.equal(payloadShapeError({ v: 1, p: "x", id: "y", iat: "1" }), "bad payload");
  assert.equal(payloadShapeError({ v: 1, p: "x", id: "y", iat: 1, exp: -5 }), "bad payload");
  assert.equal(payloadShapeError({ v: 1, p: "x", id: "y", iat: 1, h: 9 }), "bad payload");
  assert.equal(payloadShapeError(null), "bad payload");
  assert.equal(payloadShapeError({ v: 1, p: "x", id: "y", iat: 1 }), null);
});

test("extract prefers Authorization header, then path segment, then query", () => {
  const url = new URL("https://mcp.zovo.one/mcp/invoice/t/tok1");
  const req = (h) => new Request(url, h ? { headers: h } : {});
  assert.equal(inst.extract(req({ authorization: "Bearer hdr.key" }), url), "hdr.key");
  assert.equal(inst.extract(req(), url), "tok1");
  const urlQ = new URL("https://mcp.zovo.one/mcp/invoice?token=q.key");
  assert.equal(inst.extract(new Request(urlQ), urlQ), "q.key");
});

test("gate denies a tokenless request and names /mcp/connect", async () => {
  const url = new URL("https://mcp.zovo.one/mcp/invoice");
  const d = await inst.gate(new Request(url), url, "invoice");
  assert.equal(d.allow, false);
  assert.match(d.reason, /mcp\/connect/);
});

test("gate allows tools/call with a valid bearer key and reports the license id", async () => {
  const key = mint(basePayload);
  const url = new URL("https://mcp.zovo.one/mcp/invoice");
  const d = await inst.gate(new Request(url, { headers: { authorization: `Bearer ${key}` } }), url, "invoice");
  assert.deepEqual({ allow: d.allow, isPro: d.isPro, licenseId: d.licenseId }, { allow: true, isPro: true, licenseId: "abc123" });
});

test("a minted key cross-verifies against the fleet's real public key and a real sign-license.mjs key", async () => {
  const { readFileSync } = await import("node:fs");
  const rawB64 = readFileSync(new URL("../../keys/license-public.raw.b64", import.meta.url), "utf8").trim();
  const fleet = new LicenseAuth({ publicKeyB64: rawB64, now: () => NOW });
  const { execFileSync } = await import("node:child_process");
  const key = execFileSync("node", ["../../scripts/sign-license.mjs", "invoice", "buyer@example.com"], {
    encoding: "utf8", cwd: HERE,
  }).trim();
  const r = await fleet.verify(key, "invoice");
  assert.equal(r.ok, true, `real key failed: ${r.reason}`);
  assert.equal(r.payload.h, createHash("sha256").update("buyer@example.com").digest("hex").slice(0, 12));
  const wrong = await fleet.verify(key, "spreadsheet");
  assert.equal(wrong.ok, false);
});
