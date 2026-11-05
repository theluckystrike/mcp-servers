// S1103: every guard-passing `buy.unknown-product` click in Workers Logs was a real id with
// punctuation or a lost query glued on by a chat autolinker. They now reach the offer page.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { salvageBuyPath } from "../src/index.js";

const kv = () => ({ get: async () => null, put: async () => {}, list: async () => ({ keys: [] }) });
const env = { STRIPE_SECRET_KEY: "sk_test_stub", REMOTE_DATA: kv(), LICENSES: kv() };
const nav = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", accept: "text/html",
  "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "sec-fetch-site": "none", referer: "https://mcp.zovo.one" };
const get = (path, method = "GET") => worker.fetch(new Request(`https://mcp.zovo.one${path}`, { method, headers: nav, redirect: "manual" }), env, { waitUntil: () => {} });

test("salvageBuyPath recovers the id from the observed mangled links", () => {
  assert.equal(salvageBuyPath("work-order（買い切り").slug, "work-order");
  assert.equal(salvageBuyPath("bill-of-sale。このサーバー単体は").slug, "bill-of-sale");
  assert.equal(salvageBuyPath("bundle）").slug, "bundle");
  assert.equal(salvageBuyPath("bundle),").slug, "bundle");
  assert.equal(salvageBuyPath("invoice.").slug, "invoice");
  assert.equal(salvageBuyPath("pdf**").slug, "pdf");
  assert.equal(salvageBuyPath("office-suite.").slug, "office-suite");
  assert.equal(salvageBuyPath("Invoice").slug, "invoice");
  const z = salvageBuyPath("zip&src=csg.mcp.table.zip");
  assert.equal(z.slug, "zip");
  assert.equal(z.params.get("src"), "csg.mcp.table.zip");
});

test("salvageBuyPath refuses ids that are exact, unknown or not a prefix of a product", () => {
  assert.equal(salvageBuyPath("invoice"), null);
  assert.equal(salvageBuyPath("undefined"), null);
  assert.equal(salvageBuyPath("<product>"), null);
  assert.equal(salvageBuyPath("asse"), null);
  assert.equal(salvageBuyPath("crm-lite"), null);
  assert.equal(salvageBuyPath("invoices."), null);
  assert.equal(salvageBuyPath(""), null);
});

test("GET of a mangled link redirects to the real offer page with a src", async () => {
  const r = await get("/buy/work-order%EF%BC%88%E8%B2%B7%E3%81%84%E5%88%87%E3%82%8A");
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("x-mcp-buy"), "salvaged-link");
  assert.equal(r.headers.get("location"), "https://mcp.zovo.one/buy/work-order?src=buy.salvaged");
  const z = await get("/buy/zip&src=csg.mcp.table.zip");
  assert.equal(z.headers.get("location"), "https://mcp.zovo.one/buy/zip?src=csg.mcp.table.zip");
  const k = await get("/buy/bundle.?src=store.x");
  assert.equal(k.headers.get("location"), "https://mcp.zovo.one/buy/bundle?src=store.x");
  const followed = await get("/buy/work-order?src=buy.salvaged");
  assert.equal(followed.status, 200);
});

test("truly unknown ids keep the honest 404, and a stray percent no longer throws", async () => {
  const r = await get("/buy/undefined");
  assert.equal(r.status, 404);
  assert.equal(r.headers.get("x-mcp-buy"), "unknown-product");
  const p = await get("/buy/invoice%E3");
  assert.equal(p.status, 302);
  assert.equal(p.headers.get("location"), "https://mcp.zovo.one/buy/invoice?src=buy.salvaged");
});
