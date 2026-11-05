// S1103 link scan: README links written for the GitHub tree (`../invoice`,
// `../invoice/README.md`, `../../assets/demo-x.gif`, `llms-install.md`) were rendered
// verbatim into /s/<id> pages, where they resolve against mcp.zovo.one and 404.
// scripts/build-pages.mjs now rewrites them; this suite fails if one comes back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES } from "../src/pages.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const targets = (html) => [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]);

test("no product page carries a README-relative href or src", () => {
  const bad = [];
  for (const [id, pg] of Object.entries(PAGES)) {
    for (const u of targets(pg.html)) if (!/^(?:https?:|mailto:|\/|#)/.test(u)) bad.push(`${id}: ${u}`);
  }
  assert.deepEqual(bad, []);
});

test("every /s/<id> link on a product page names a page that exists", () => {
  const bad = [];
  for (const [id, pg] of Object.entries(PAGES)) {
    for (const u of targets(pg.html)) {
      const m = /^\/s\/([^?#"]+)/.exec(u);
      if (m && !PAGES[m[1]]) bad.push(`${id}: ${u}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("rewritten repository links point at files that exist in the repository", () => {
  const bad = [];
  const re = /^https:\/\/(?:github\.com\/theluckystrike\/mcp-servers\/blob\/main|raw\.githubusercontent\.com\/theluckystrike\/mcp-servers\/main)\/([^#?]+)/;
  for (const [id, pg] of Object.entries(PAGES)) {
    for (const u of targets(pg.html)) {
      const m = re.exec(u);
      if (m && !existsSync(join(ROOT, m[1]))) bad.push(`${id}: ${u}`);
    }
  }
  assert.deepEqual(bad, []);
  assert.ok(targets(PAGES.calendar.html).some((u) => u.endsWith("/assets/demo-calendar.gif")), "positive control: the calendar demo image is rewritten");
  assert.ok(targets(PAGES.kanban.html).includes("/s/calendar"), "positive control: ../calendar becomes /s/calendar");
});

test("no page links bare /recover, which answers 400 without a session_id", () => {
  const src = ["content.js", "index.js", "compare.js"].map((f) => readFileSync(join(ROOT, "billing", "src", f), "utf8")).join("\n");
  assert.equal(/href="\/recover"/.test(src), false);
});
