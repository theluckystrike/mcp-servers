// Copy-button coverage for prompt blocks (docs/CONTENT_R21_RESULT.md).
//
// Every prompt a reader is meant to paste into Claude renders as `<pre class="prompt">`,
// on guide pages and in the "First five minutes" sections built by scripts/build-pages.mjs.
// The button itself comes from one inline script in the shared page shell, added to the
// DOM only, so a `<pre class="prompt">` with no JavaScript still renders the prompt text
// exactly as before. This suite checks the markup contract, not the browser behaviour:
// the class exists everywhere a prompt is quoted, the script string appears exactly once
// in the shell, and no code sample (install command, JSON config, tool-call syntax) is
// ever tagged with it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GUIDES } from "../src/content.js";
import { PAGES } from "../src/pages.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_SRC = readFileSync(join(ROOT, "src", "index.js"), "utf8");

test("the copy-button script is defined exactly once in the page shell", () => {
  const defs = INDEX_SRC.match(/const COPY_BUTTON_SCRIPT = `<script>/g) || [];
  assert.equal(defs.length, 1, "COPY_BUTTON_SCRIPT must be defined exactly once");
  const uses = INDEX_SRC.match(/\$\{COPY_BUTTON_SCRIPT\}/g) || [];
  assert.equal(uses.length, 1, "COPY_BUTTON_SCRIPT must be inlined into the shared shell exactly once");
});

test("the page shell sets no Content-Security-Policy header (inline script needs none)", () => {
  assert.doesNotMatch(INDEX_SRC, /content-security-policy/i, "a CSP header would need a nonce or hash on the inline script");
});

test("every First five minutes prompt renders as pre.prompt", () => {
  for (const [id, pg] of Object.entries(PAGES)) {
    const section = pg.html.slice(pg.html.indexOf("<h2>First five minutes</h2>"));
    const plainPre = section.match(/<pre>(?!.*class="prompt")/g);
    assert.ok(!plainPre, `${id}: a First five minutes prompt is a bare <pre>, not <pre class="prompt">`);
    assert.ok(section.includes('<pre class="prompt">'), `${id}: no pre.prompt found in First five minutes`);
    assert.ok(section.includes("Paste this into Claude with the server connected."), `${id}: missing the paste-instruction line`);
  }
});

test("month-end-close guide: every quoted prompt is a pre.prompt with its paste line", () => {
  const g = GUIDES["month-end-close-with-mcp-servers"];
  assert.ok(g, "guide missing");
  assert.ok(!g.html.includes("<blockquote>"), "guide still uses <blockquote> for prompts instead of pre.prompt");
  const prompts = [...g.html.matchAll(/<pre class="prompt">([\s\S]*?)<\/pre>/g)];
  assert.equal(prompts.length, 9, "expected all nine worked-example prompts as pre.prompt");
  for (const m of prompts) {
    assert.ok(!/[<>]/.test(m[1].replace(/&(amp|lt|gt|quot|#39);/g, "")), "prompt text must be plain, copyable text");
  }
  const pasteLines = g.html.match(/Paste this into Claude with the server connected\./g) || [];
  assert.equal(pasteLines.length, 9, "expected one paste-instruction line per prompt");
});

test("no code sample (install command, JSON config, tool-call syntax) is tagged pre.prompt", () => {
  const codeMarkers = [/^claude mcp add/, /^\{/, /^You:/, /^[a-z_]+\s*[({]/, /^#/];
  for (const [slug, g] of Object.entries(GUIDES)) {
    for (const m of g.html.matchAll(/<pre class="prompt">([\s\S]*?)<\/pre>/g)) {
      const text = m[1];
      for (const marker of codeMarkers) {
        assert.ok(!marker.test(text.trim()), `${slug}: a code sample was tagged pre.prompt: ${text.slice(0, 40)}`);
      }
    }
    // Every code sample, in turn, keeps its plain <pre><code> form, never the prompt class.
    for (const m of g.html.matchAll(/<pre><code>([\s\S]*?)<\/code><\/pre>/g)) {
      assert.ok(!m[0].includes('class="prompt"'), `${slug}: a code sample carries the prompt class`);
    }
  }
});

test("the bundle page carries no unclassed prompt pre", () => {
  // bundlePage() renders no hand-written prompt today; if one is added later without
  // the class, this test starts failing rather than silently missing a copy button.
  const src = readFileSync(join(ROOT, "src", "index.js"), "utf8");
  const bundleFn = src.slice(src.indexOf("export function bundlePage"), src.indexOf("export function changelogPage"));
  assert.ok(!/<pre>/.test(bundleFn), "bundlePage renders a bare <pre>; tag any prompt it adds with class=\"prompt\"");
});
