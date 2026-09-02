#!/usr/bin/env node
// Usage: node scripts/sign-license.mjs <product|*> [email] [expUnix]   -- uses keys/license-private.pem
import { createPrivateKey, sign, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
const [,, product = "*", email = "", exp = ""] = process.argv;
const pem = readFileSync(new URL("../keys/license-private.pem", import.meta.url), "utf8");
const payload = { v: 1, p: product, id: randomBytes(6).toString("hex"), iat: Math.floor(Date.now()/1000) };
if (exp) payload.exp = Number(exp);
if (email) payload.h = createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 12);
const enc = b => b.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const body = enc(Buffer.from(JSON.stringify(payload)));
const sig = enc(sign(null, Buffer.from(body), createPrivateKey(pem)));
console.log(`MCPL1.${body}.${sig}`);
