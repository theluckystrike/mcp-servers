import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { mintLicense } from "../../billing/src/license.js";

test("billing mint signs the payload and is deterministic for one Session", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ format: "pem", type: "pkcs8" });
  const args = { product: "invoice", id: "ci-session", iat: 1788352878, email: "Buyer@Example.com" };
  const first = await mintLicense(pem, args);
  const second = await mintLicense(pem, args);
  assert.equal(first.key, second.key);
  const [prefix, body, signature] = first.key.split(".");
  assert.equal(prefix, "MCPL1");
  assert.equal(first.payload.p, "invoice");
  assert.equal(first.payload.id, "ci-session");
  assert.equal(verify(null, Buffer.from(body), publicKey, Buffer.from(signature, "base64url")), true);
  const tampered = Buffer.from(body, "base64url").toString("utf8").replace("invoice", "bundle");
  assert.equal(verify(null, Buffer.from(tampered), publicKey, Buffer.from(signature, "base64url")), false);
});
