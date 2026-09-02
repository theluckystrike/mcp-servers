// Proves the worker's WebCrypto minting produces keys that the shipped
// @theluckystrike/mcp-license verifier accepts, and that the worker's own
// verifier agrees. Node 18+ exposes globalThis.crypto with Ed25519 support.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mintLicense, verifyLicenseKey, pemToDer, PUBLIC_KEY_B64 } from "../src/license.js";
import { verifyLicense } from "../../packages/mcp-license/dist/index.js";

const PEM = readFileSync(new URL("../../keys/license-private.pem", import.meta.url), "utf8");
const PRODUCTS = ["time-tracker", "price-tracker", "spreadsheet", "invoice"];

test("public key constant matches the shipped package", () => {
  assert.equal(PUBLIC_KEY_B64, readFileSync(new URL("../../keys/license-public.raw.b64", import.meta.url), "utf8").trim());
});

test("pemToDer strips armor and decodes PKCS8", () => {
  const der = pemToDer(PEM);
  assert.ok(der instanceof Uint8Array);
  assert.equal(der[0], 0x30);
  assert.equal(der.length, 48); // Ed25519 PKCS8
});

test("per-product key verifies with the shipped verifier", async () => {
  for (const product of PRODUCTS) {
    const iat = 1788352878;
    const { key, payload } = await mintLicense(PEM, { product, id: "aabbccddeeff", iat, email: "Buyer@Example.com " });
    assert.match(key, /^MCPL1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(payload.h, createHash("sha256").update("buyer@example.com").digest("hex").slice(0, 12));

    const r = verifyLicense(key, product);
    assert.equal(r.ok, true, `shipped verifier rejected ${product}: ${r.reason}`);
    assert.equal(r.payload.p, product);
    assert.equal(r.payload.id, "aabbccddeeff");
    assert.equal(r.payload.iat, iat);

    // wrong product must fail
    const wrong = verifyLicense(key, "spreadsheet" === product ? "invoice" : "spreadsheet");
    assert.equal(wrong.ok, false);

    // worker-side verifier agrees
    const w = await verifyLicenseKey(key, product);
    assert.equal(w.ok, true);
  }
});

test("bundle key ('*') unlocks every product", async () => {
  const { key } = await mintLicense(PEM, { product: "*", id: "0123456789ab", iat: 1788352878, email: "" });
  for (const product of PRODUCTS) {
    assert.equal(verifyLicense(key, product).ok, true, `bundle key rejected for ${product}`);
  }
  assert.equal((await verifyLicenseKey(key, "invoice")).ok, true);
});

test("tampered payload is rejected by both verifiers", async () => {
  const { key } = await mintLicense(PEM, { product: "invoice", id: "aabbccddeeff", iat: 1788352878 });
  const [, body, sig] = key.split(".");
  const forged = JSON.stringify({ v: 1, p: "*", id: "aabbccddeeff", iat: 1788352878 });
  const forgedBody = Buffer.from(forged).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  assert.notEqual(forgedBody, body);
  const bad = `MCPL1.${forgedBody}.${sig}`;
  assert.equal(verifyLicense(bad, "invoice").ok, false);
  assert.equal((await verifyLicenseKey(bad, "invoice")).ok, false);
});

test("same inputs mint the same key (deterministic per session)", async () => {
  const args = { product: "time-tracker", id: "aabbccddeeff", iat: 1788352878, email: "a@b.co" };
  const a = await mintLicense(PEM, args);
  const b = await mintLicense(PEM, args);
  assert.equal(a.key, b.key);
});
