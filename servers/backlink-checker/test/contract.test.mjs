// Contract: what mcp-backlink-checker promises consumers — tool catalogue, output
// shape, licensing, and the exact strings other documents quote.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { client, sandbox, cleanup, proKey, linkPages } from "./_client.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function fresh(t, key = false) {
  const box = sandbox("mcp-backlink-checker-con-");
  const c = client({ dataHome: box.dataHome, key: key ? proKey() : undefined });
  t.after(() => { c.close(); cleanup(box.dir); });
  return { box, c };
}

test("contract: tool catalogue names, titles, and Pro markers", async (t) => {
  const { c } = fresh(t);
  await c.init();
  const tools = await c.tools();
  const byName = Object.fromEntries(tools.map((x) => [x.name, x]));
  const expectFree = ["link_check", "robots_guard_check", "license_activate", "license_status"];
  const expectPro = ["link_audit"];
  for (const n of expectFree) {
    assert.ok(byName[n], `${n} must exist`);
    assert.doesNotMatch(byName[n].description, /\(Pro\)/, `${n} is free tier`);
  }
  for (const n of expectPro) {
    assert.ok(byName[n], `${n} must exist`);
    assert.match(byName[n].description, /Free tier/, `${n} must state its free tier`);
  }
  for (const x of tools) assert.ok(x.annotations?.readOnlyHint !== false, `${x.name} is a read-only tool`);
});

test("contract: link_check verdicts — dofollow, nofollow, no-link", async (t) => {
  const pages = await linkPages();
  t.after(() => pages.close());
  const { c } = fresh(t);
  await c.init();
  const base = pages.base;
  const dof = await c.call("link_check", { page_url: `${base}/dofollow`, target_domain: "target.example" });
  assert.ok(!dof.isError, dof.text);
  assert.match(dof.text, /Status: 200/);
  assert.match(dof.text, /Links to target\.example: 1/);
  assert.match(dof.text, /DOFOLLOW/);
  assert.match(dof.text, /anchor: "best widgets"/);
  const nof = await c.call("link_check", { page_url: `${base}/nofollow`, target_domain: "target.example" });
  assert.match(nof.text, /nofollow/);
  assert.match(nof.text, /rel="nofollow sponsored"/);
  const none = await c.call("link_check", { page_url: `${base}/nolink`, target_domain: "target.example" });
  assert.match(none.text, /does not link to the target domain/);
});

test("contract: robots_guard_check reports noindex and page-level nofollow", async (t) => {
  const pages = await linkPages();
  t.after(() => pages.close());
  const { c } = fresh(t);
  await c.init();
  const r = await c.call("robots_guard_check", { url: `${pages.base}/noindex` });
  assert.ok(!r.isError, r.text);
  assert.match(r.text, /noindex: YES/i);
  const clean = await c.call("robots_guard_check", { url: `${pages.base}/dofollow` });
  assert.match(clean.text, /noindex: no/i);
});

test("contract: link_audit free tier refuses more than 3 URLs with the upgrade path", async (t) => {
  const pages = await linkPages();
  t.after(() => pages.close());
  const { c } = fresh(t);
  await c.init();
  const urls = ["/dofollow", "/nofollow", "/noindex", "/nolink"].map((p) => `${pages.base}${p}`);
  const r = await c.call("link_audit", { page_urls: urls, target_domain: "target.example" });
  assert.equal(r.isError, true);
  assert.match(r.text, /Pro/);
  assert.match(r.text, /license_activate/);
});

test("contract: link_audit runs up to 3 URLs free, table per URL", async (t) => {
  const pages = await linkPages();
  t.after(() => pages.close());
  const { c } = fresh(t);
  await c.init();
  const urls = ["/dofollow", "/nofollow", "/nolink"].map((p) => `${pages.base}${p}`);
  const r = await c.call("link_audit", { page_urls: urls, target_domain: "target.example" });
  assert.ok(!r.isError, r.text);
  assert.match(r.text, /url \| status \| verdict \| anchor/);
  for (const u of urls) assert.ok(r.text.includes(u), `audit must include ${u}`);
});

test("contract: a valid Pro key lifts the URL cap on the same install", async (t) => {
  const pages = await linkPages();
  t.after(() => pages.close());
  const { c } = fresh(t, true);
  await c.init();
  const urls = ["/dofollow", "/nofollow", "/noindex", "/nolink"].map((p) => `${pages.base}${p}`);
  const r = await c.call("link_audit", { page_urls: urls, target_domain: "target.example" });
  assert.ok(!r.isError, r.text);
});

test("contract: an unreachable page answers an error, never a wrong verdict", async (t) => {
  const { c } = fresh(t);
  await c.init();
  const r = await c.call("link_check", { page_url: "http://127.0.0.1:1/nothing", target_domain: "target.example" });
  assert.match(r.text, /fetch failed|No verdict possible/i);
});

test("contract: server.json matches the shipped tool surface and metadata", async (t) => {
  const { c } = fresh(t);
  await c.init();
  const serverJson = JSON.parse(readFileSync(join(here, "..", "server.json"), "utf8"));
  assert.equal(serverJson.name, "io.github.theluckystrike/backlink-checker");
  assert.equal(serverJson.version, readFileSync(join(here, "..", "package.json"), "utf8").match(/"version": "([^"]+)"/)[1]);
  assert.match(serverJson.description, /link|backlink/i);
  const tools = await c.tools();
  assert.ok(tools.length >= 5, `expected >= 5 tools, got ${tools.length}`);
  const names = new Set(tools.map((x) => x.name));
  for (const t of ["link_check", "link_audit", "robots_guard_check", "license_activate"]) assert.ok(names.has(t), `missing tool ${t}`);
});

test("contract: README quick-start tool names all exist on the live server", async (t) => {
  const { c } = fresh(t);
  await c.init();
  const readme = readFileSync(join(here, "..", "README.md"), "utf8");
  const quoted = [...new Set([...readme.matchAll(/"(link_check|link_audit|robots_guard_check|license_activate|license_status)"/g)].map((m) => m[1]))];
  assert.ok(quoted.length >= 2, "README must quote real tool calls");
  const tools = new Set((await c.tools()).map((x) => x.name));
  for (const name of quoted) assert.ok(tools.has(name), `README quotes "${name}" but the server does not expose it`);
});

test("contract: nothing is stored — the data home stays empty", async (t) => {
  const pages = await linkPages();
  t.after(() => pages.close());
  const { c, box } = fresh(t);
  await c.init();
  await c.call("link_check", { page_url: `${pages.base}/dofollow`, target_domain: "target.example" });
  let files = [];
  try { files = readdirR(box.dataHome); } catch { /* never created is fine */ }
  assert.equal(files.length, 0, `stateless server must write nothing, wrote ${files.join(", ")}`);
});

import { readdirSync, existsSync } from "node:fs";
function readdirR(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) out.push(...readdirR(p)); else out.push(f.name);
  }
  return out;
}
