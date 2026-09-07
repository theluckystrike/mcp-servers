#!/usr/bin/env node
// Submit storefront URLs to IndexNow (Bing, Yandex, Seznam, Naver). Free, no account.
// Fails loudly rather than reporting success it did not get.
// Usage: node scripts/indexnow.mjs [--all] [--dry]
import { readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const cfg = JSON.parse(readFileSync(`${ROOT}/data/indexnow.json`, "utf8"));
const HOST = cfg.host, KEY = cfg.key, KEY_LOC = cfg.key_location;
const ALL = process.argv.includes("--all");
const DRY = process.argv.includes("--dry");

// The key file must be reachable or every submission is rejected.
const probe = await fetch(KEY_LOC);
const body = (await probe.text()).trim();
if (!probe.ok || body !== KEY) {
  console.error(`FATAL: key file at ${KEY_LOC} returned ${probe.status} with body ${JSON.stringify(body.slice(0, 60))}; expected ${KEY}`);
  process.exit(2);
}
console.log(`key file OK at ${KEY_LOC}`);

const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
let urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const before = urls.length;
if (!ALL) {
  // Default to the pages worth a crawler's budget: everything except the
  // client x product setup permutations, which measured 73-78% similar to
  // each other and earned 8 human views in 7 days across 224 URLs.
  urls = urls.filter((u) => !/\/setup\/[^/]+\/[^/]+/.test(u));
}
console.log(`sitemap ${before} URLs -> submitting ${urls.length}${ALL ? " (all)" : " (permutations excluded)"}`);
if (DRY) { console.log(urls.slice(0, 10).join("\n"), "\n..."); process.exit(0); }

// IndexNow accepts up to 10,000 URLs per POST, but keep batches small so a
// rejection names a manageable set.
const BATCH = 100, endpoints = ["https://api.indexnow.org/indexnow"];
let ok = 0, fail = 0;
for (const ep of endpoints) {
  for (let i = 0; i < urls.length; i += BATCH) {
    const slice = urls.slice(i, i + BATCH);
    const res = await fetch(ep, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOC, urlList: slice }),
    });
    const txt = await res.text();
    // 200 accepted, 202 accepted pending key validation. Anything else is a real failure.
    if (res.status === 200 || res.status === 202) { ok += slice.length; }
    else { fail += slice.length; console.error(`  ${ep} batch ${i}: HTTP ${res.status} ${txt.slice(0, 200)}`); }
    console.log(`  ${ep} batch ${i}-${i + slice.length - 1}: ${res.status}`);
  }
}
console.log(`accepted ${ok}, failed ${fail}`);
process.exit(fail ? 1 : 0);
