// Ed25519 license minting/verification for the billing worker (WebCrypto only).
export const PUBLIC_KEY_B64 = "VZXpvTpJn2XzaEn9ijFXk1vjPjtZvzAHZazC0Z+0pHU=";

const enc = new TextEncoder();

function b64ToBytes(b64) {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PEM (PKCS8) -> DER bytes. */
export function pemToDer(pem) {
  const body = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  return b64ToBytes(body);
}

async function importPrivate(pem) {
  const der = pemToDer(pem);
  try {
    return await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
  } catch {
    return await crypto.subtle.importKey("pkcs8", der, { name: "NODE-ED25519", namedCurve: "NODE-ED25519" }, false, ["sign"]);
  }
}

async function importPublic() {
  const raw = b64ToBytes(PUBLIC_KEY_B64);
  const prefix = new Uint8Array([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);
  const spki = new Uint8Array(prefix.length + raw.length);
  spki.set(prefix, 0);
  spki.set(raw, prefix.length);
  try {
    return await crypto.subtle.importKey("spki", spki, { name: "Ed25519" }, false, ["verify"]);
  } catch {
    return await crypto.subtle.importKey("raw", raw, { name: "NODE-ED25519", namedCurve: "NODE-ED25519" }, false, ["verify"]);
  }
}

export async function sha256Hex(s) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hex(nBytes) {
  const b = new Uint8Array(nBytes);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Mint a key "MCPL1.<payloadB64url>.<sigB64url>".
 * Deterministic per (product, id, iat, email) - caller supplies id/iat for determinism.
 */
export async function mintLicense(pem, { product, id, iat, email }) {
  const payload = { v: 1, p: product, id, iat };
  if (email) payload.h = (await sha256Hex(email.trim().toLowerCase())).slice(0, 12);
  const body = bytesToB64url(enc.encode(JSON.stringify(payload)));
  const key = await importPrivate(pem);
  const sig = new Uint8Array(await crypto.subtle.sign("Ed25519" in crypto.subtle ? "Ed25519" : { name: "Ed25519" }, key, enc.encode(body)).catch(async () => {
    return await crypto.subtle.sign({ name: "NODE-ED25519" }, key, enc.encode(body));
  }));
  return { key: `MCPL1.${body}.${bytesToB64url(sig)}`, payload };
}

export async function verifyLicenseKey(keyStr, product) {
  if (typeof keyStr !== "string") return { ok: false, reason: "no key" };
  const parts = keyStr.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "MCPL1") return { ok: false, reason: "malformed key" };
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64ToBytes(parts[1])));
  } catch {
    return { ok: false, reason: "bad payload" };
  }
  let sigOk = false;
  try {
    const pub = await importPublic();
    sigOk = await crypto.subtle.verify({ name: "Ed25519" }, pub, b64ToBytes(parts[2]), enc.encode(parts[1]));
  } catch {
    sigOk = false;
  }
  if (!sigOk) return { ok: false, reason: "signature invalid" };
  if (payload.v !== 1) return { ok: false, reason: "unsupported version" };
  if (product && payload.p !== "*" && payload.p !== product) return { ok: false, reason: `key is for ${payload.p}, not ${product}` };
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}
