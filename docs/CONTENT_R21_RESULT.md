# Content round 21: copy buttons on prompt blocks - 2026-09-06

status: DONE

## What shipped

`billing/src/index.js` (one `COPY_BUTTON_SCRIPT` constant, inlined once into the shared
`page()` shell, plus its button CSS), `scripts/build-pages.mjs` (the "First five minutes"
prompt now renders as `<pre class="prompt">` with a static paste-instruction line under
it), `billing/src/pages.js` (regenerated from that change), `billing/test/first-five.test.mjs`
(regex updated to the new class), `billing/test/copy-button.test.mjs` (new), and this file.
`billing/src/content.js` also changed (the nine worked-example prompts in
`/guides/month-end-close-with-mcp-servers` moved from `<blockquote>` to `<pre class="prompt">`)
but is not committed here, per the run's instructions: another agent owns that file.

## The mechanism

One inline `<script>`, defined once as `COPY_BUTTON_SCRIPT` and interpolated once into the
`page()` shell that every route uses (home, `/bundle`, `/s/<id>`, `/guides/<slug>`,
`/compare/<slug>`, `/setup/...`, `/changelog`). No CSP header is set anywhere in this
service (grepped `content-security-policy` and `csp` across `billing/src`, zero hits), so a
plain inline script needs no nonce or hash; if a CSP header is ever added, the same
constant needs a nonce or hash added with it rather than the policy being loosened.

On `DOMContentLoaded` (or immediately if the document is already parsed), the script walks
`document.querySelectorAll("pre.prompt")` and appends a "Copy" button after each one. A
click copies `pre.textContent` via `navigator.clipboard.writeText`, falling back to a
hidden `<textarea>` and `document.execCommand("copy")` where the Clipboard API is
unavailable, then shows "Copied" on the button for two seconds before it reverts. The
script only adds nodes; it changes nothing about the `<pre class="prompt">` markup itself,
so with JavaScript disabled every prompt block renders exactly as it did before this round,
just without the button.

Under each `<pre class="prompt">` block, in static HTML (not script-inserted), a plain
line: "Paste this into Claude with the server connected." No deep link is offered anywhere,
and none is implied: no MCP client publishes a URL scheme that pre-fills a prompt, so the
guides say nothing about one.

## Where the class was introduced

Two places actually render a prompt meant to be pasted verbatim into Claude:

- **First five minutes** (`scripts/build-pages.mjs`, `firstFiveMinutes`): the one `<pre>`
  per server that already quoted a measured, scored prompt verbatim. Changed to
  `<pre class="prompt">`, with the paste line added between the prompt and the existing
  "What it did" evidence sentence.
- **`/guides/month-end-close-with-mcp-servers`**: the nine step prompts, previously each in
  a `<blockquote>`. The guide's own text says "every prompt below is quoted exactly as it
  was typed", which is exactly the case a copy button serves. Converted to
  `<pre class="prompt">`, collapsing each blockquote's wrapped source lines into one
  continuous string first (a `<pre>` preserves whitespace and line breaks the way a
  `<blockquote>` does not, so the mid-sentence line wraps used only for the 89-column
  source would otherwise land inside the copied text as literal breaks).

Left alone, deliberately: the `claude mcp add ...` install lines, the JSON client-config
blocks, the raw MCP tool-call syntax (`invoice_create`, `sheet_query`, `perdiem_calc {...}`,
etc.), and the two "worked example" transcripts in the docx and pdf guides
(`<pre><code>You: Write a proposal...` and `<pre><code>You: Stamp PAID...`). Those two are
not single prompts to paste; each is a multi-part mock transcript showing the prompt, the
tool call it produced and the tool's output together, which is exactly what "leave code
samples alone" means here. The `/bundle` page renders no hand-written prompt today, so
nothing there needed the class; a test now fails if one is ever added without it.

## Test

`billing/test/copy-button.test.mjs` (new, 6 cases):

- the `COPY_BUTTON_SCRIPT` constant is defined exactly once in `billing/src/index.js` and
  interpolated into the shell exactly once
- `billing/src/index.js` sets no `content-security-policy` header anywhere
- every `/s/<id>` page's First five minutes section uses `<pre class="prompt">`, never a
  bare `<pre>`, and carries the paste-instruction line
- the month-end-close guide has no `<blockquote>` left and renders exactly nine
  `<pre class="prompt">` blocks, each followed by the paste line, each holding plain
  copyable text (no leaked markup)
- no code sample across any guide (`claude mcp add`, a JSON object, a `You:` transcript, a
  bare tool-call line, a comment) is ever tagged `pre.prompt`, and no `<pre><code>` block
  carries the prompt class
- `bundlePage()`'s own source renders no bare `<pre>`, guarding the page against a future
  untagged prompt

`billing/test/first-five.test.mjs` updated: `renderedPrompts()` now matches
`<pre class="prompt">...</pre>` instead of a bare `<pre>`, so its existing traceability
checks (every quoted prompt exists verbatim in a `data/user_value_r*.json` file, the score
and round line up, the evidence sentence is a substring of that scenario's note) still run
against the same section, just through the new tag.

## Quality gate

    em dashes on the changed files (index.js, content.js, build-pages.mjs, the two test files) -> 0
    non-ASCII on the same                                                                       -> 0
    hype words on the same (revolutionary, seamless, cutting-edge, etc.)                         -> 0
    emoji on the same                                                                            -> 0
    node --check billing/src/index.js                                                            -> syntax OK
    node --check billing/src/content.js                                                          -> syntax OK

## Verification

    cd billing && npm test   -> 81/81 (75 before, +6 new copy-button cases)
    wrangler deploy          -> mcp.zovo.one, version 54da2781-66de-44d9-9519-5303654a0016

    curl https://mcp.zovo.one/guides/month-end-close-with-mcp-servers
      pre class="prompt" occurrences                                  -> 9
      "Paste this into Claude with the server connected" occurrences  -> 9
      the copy-button <script> block                                 -> present, once
      no content-security-policy response header                     -> confirmed

    curl https://mcp.zovo.one/s/invoice
      pre class="prompt" occurrences -> 2 (its First five minutes prompts)
      copy-btn class present in the page's inline script              -> yes

IndexNow: not needed, no new URLs.

## Concurrency note

`billing/src/content.js` was mid-edit under a separate agent's work at the start of this
round (git status showed it and many unrelated `bundles/*` files already modified in the
working tree). `git pull --rebase --autostash` before deploy found nothing new upstream, so
the nine blockquote-to-`pre.prompt` edits in `month-end-close-with-mcp-servers` were made
directly against the working copy already on disk and are live in this deploy, but per this
round's instructions they are not part of the commit made here; only
`billing/src/index.js`, `scripts/build-pages.mjs`, `billing/src/pages.js`,
`billing/test/**` and this file are committed.

Zero paid API calls.
