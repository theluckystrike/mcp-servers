status: DONE

## evidence

```
$ npm install                        # root, npm_config_cache=/Users/mike/.npm-cache-local
added 21 packages in 4s
$ node -e "console.log(require('docx/package.json').version)"
9.7.1

$ npm run build -w servers/docx
> tsc -p tsconfig.json && node -e "...chmodSync('dist/index.js',0o755)"
npm run build -w servers/docx  2.03s user 0.11s system 219% cpu 0.973 total

$ npm test -w servers/docx
1..8
# tests 8
# pass 8
# fail 0
# duration_ms 761.354583
npm test -w servers/docx  1.79s user 0.26s system 230% cpu 0.892 total
```

Tests, all green:

- `test/docx.test.mjs` (4): build a .docx and read it back (headings, bold-as-formatting, bullet vs numbered
  lists kept separate, table cells); markdown headings/lists/GFM pipe table/fenced code round-tripped through
  .docx and through `toHtml`; template fill with `{{client}}` and `{{fee}}` each split across three `w:r` runs,
  unfilled `{{law}}` reported not blanked, package part list unchanged; a non-ZIP input refused.
- `test/smoke.test.mjs` (3): stdio initialize -> `tools/list` (10 tools, no `doc_to_pdf`), `resources/list`
  (`docs://recent`), `prompts/list` (`write_proposal_from_hours`), `business_set`, `proposal_create` at
  EUR 4,500.00 with 3 phases -> `PROP-2026-0001`, `doc_read` of that file contains "Beta Corp",
  "EUR 4,500.00", "Checkout rebuild", "Timeline"; `doc_to_html`; markdown -> .docx -> json blocks;
  `doc_create` letter layout; `contract_create` states template/not-legal-advice on the document itself;
  free 4th proposal refused with the buy URL while `doc_create` stays free, Pro (signed key) allows 4.
- `test/concurrency.test.mjs` (1): two processes, one `XDG_DATA_HOME`, 20 concurrent `proposal_create`.
  All 20 stored, all 20 files on disk, references a contiguous `PROP-2026-0001..0020` with no duplicates and
  no gaps, `counter.json` = 20, `docs://recent` parses with 20 unique ids.

## artifacts

- /Users/mike/mcp-servers/servers/docx/src/{index,store,build,md,wordxml,zip,blocks}.ts
- /Users/mike/mcp-servers/servers/docx/test/{docx,smoke,concurrency}.test.mjs
- /Users/mike/mcp-servers/servers/docx/{package.json,tsconfig.json,README.md,LICENSE,server.json,server.mcpb.json,smithery.yaml,glama.json,Dockerfile,llms-install.md}
- /Users/mike/mcp-servers/assets/docx-logo.png (400x400, "DX" monogram, 0x7A3E22)

## cost

38 wall minutes.

## failures

- `npm run build -w servers/docx` failed with "No workspaces found" when the shell cwd was
  `servers/docx`; the `-w` flag resolves against the cwd, not the workspace root. Fixed by running
  `npm --prefix /Users/mike/mcp-servers run build -w servers/docx`.
- First read-back of a generated document merged the bullet list and the numbered list into one unordered
  block. Fixed by resolving each paragraph's `w:numId` against `word/numbering.xml` (`numberingFormats`),
  and by starting a new list when the `numId` changes.
- Smoke test asserted 5 records in `docs://recent` where 4 are correct: `doc_read` deliberately records
  nothing, only writes do. Assertion corrected, not the code.

## insight

The bullet/numbered distinction does not exist in `word/document.xml`. Both kinds of paragraph carry the same
`<w:numPr><w:numId w:val="N"/>`; whether N renders as "1." or as a dot lives in `word/numbering.xml`, one file
away. Any .docx reader that only parses `document.xml` -- which is what "parse the XML" usually means -- reads
every numbered list back as bullets and silently merges two adjacent lists into one, because from that file
they are identical. Measured here: 4 items in one unordered block where 2 + 2 in two blocks was correct.

The second measured thing: `docx` 9.7.1 emits `xml:space="preserve"` on some runs and not others, so the
placeholder rewrite has to strip and re-add the attribute rather than assume either state; without that, a
value with a leading space loses it in Word but not in the extracted text, which is the kind of defect a
round-trip test cannot see.
