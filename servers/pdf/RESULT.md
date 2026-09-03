status: DONE

## evidence

```
$ npm run build -w servers/pdf
> tsc -p tsconfig.json --declaration && node -e "...chmodSync('dist/index.js',0o755)"
(clean, 0.81s wall)

$ npm test -w servers/pdf
1..24
# tests 24
# pass 24
# fail 0
# duration_ms 2912.843791
(2.55s wall)
```

Test files and what they hold:
- `test/pdf.test.mjs` 14 tests: merge page counts and source mtimes unchanged; split "1-3,5,7-" incl. the
  open-ended part plus the "2 pages are in no range" report; a range past the end refused with no part written;
  extraction order "5,1,1" verified page by page; rotate persists after reload and adds to the existing angle
  (90 then 270 on page 2 -> [90,0,90]); 45 degrees refused; PAID reaches the stamped file's content stream while
  the source stays byte-identical; custom text/colour/page-selection on Pro; CJK characters removed and reported;
  reorder permutation applied and an incomplete order refused; pdf_text reads "Invoice INV-2026-0042" and
  "Total EUR 4,500.00" from a standard-font fixture; an image-only page reported as having no text operators;
  an encrypted fixture refused by pdf_text/pages/rotate/stamp/merge with nothing written, while pdf_info reports
  `"encrypted": true`; missing file, non-PDF and directory all refused.
- `test/smoke.test.mjs` 6 tests: initialize, tools/list (12 tools, all with descriptions, none with an emoji),
  resources/list, prompts/list + prompts/get, pdf_info, pdf_count, merge of 3 fixtures to 6 pages, PAID stamp on an
  invoice-like fixture, `pdf://recent` showing both operations, free 6-file merge refused (answer, not error, with
  the checkout URL, nothing written) then the same 6 files merged on Pro, the 31-page free cap, the free stamp
  presets, the two Pro-only tools, exclusive-create refusal then overwrite:true, and the business footer both
  refusing with no profile and printing "Acme Consulting / VAT PL1234567890" with one.
- `test/concurrency.test.mjs` 4 tests: two processes on one data dir, 20 concurrent pdf_pages calls, all 20 records
  and 20 distinct outputs in the register; two processes racing one out_path -> exactly one wins, the loser writes
  nothing, the winner's file is a complete 3-page PDF; a split that collides on part 3 leaves no part-1/part-2
  reservation behind; a corrupt register is quarantined with a marker while the requested PDF is still written and
  the answer says the history could not be updated.

Fixture PDFs are generated with pdf-lib inside the tests (`test/_client.mjs`). The encrypted fixture is a valid
pdf-lib PDF with `/Encrypt 3 0 R` injected into its trailer, which is the signal a reader uses; pdf-lib refuses it
with a message containing "encrypted".

## artifacts

- /Users/mike/mcp-servers/servers/pdf/src/index.ts (12 tools, `pdf://recent`, `mark_invoice_paid` prompt)
- /Users/mike/mcp-servers/servers/pdf/src/pdfio.ts (input guards, 100 MB cap, exclusive-create reservations, range parser)
- /Users/mike/mcp-servers/servers/pdf/src/text.ts (own content-stream parser: node:zlib + Tj/TJ/'/" operators)
- /Users/mike/mcp-servers/servers/pdf/src/store.ts (operation register, corrupt-file quarantine)
- /Users/mike/mcp-servers/servers/pdf/test/{pdf,smoke,concurrency}.test.mjs, test/_client.mjs
- /Users/mike/mcp-servers/servers/pdf/{package.json,tsconfig.json,README.md,LICENSE,llms-install.md,glama.json,smithery.yaml,Dockerfile,server.json,server.mcpb.json,remotes.json}
- /Users/mike/mcp-servers/assets/pdf-logo.png (400x400, "PD" monogram, white on #174E5C)

Registry name `io.github.theluckystrike/pdf-merge-split-stamp-extract-pages`, version 0.5.0, mcpb asset
`https://github.com/theluckystrike/mcp-servers/releases/download/v0.5.0/pdf.mcpb` with `fileSha256: "TBD"` for the
release step. Dependencies: `pdf-lib` only (pure JS), plus the SDK, zod and `@theluckystrike/mcp-license`.
Compiled output 76 KB.

## cost

38 wall minutes.

## failures

None that reached a test run: build clean on the first `tsc`, and all 24 tests passed on their first execution.
Two things were checked before they could become bugs:
- `pdf_split` originally would have written parts 1 and 2 before discovering part 3's path was taken. Reserving
  every target with an exclusive create before writing any of them, and releasing the 0-byte reservations on
  failure, is what the third concurrency test pins.
- The first logo pass ran `Image.quantize(colors=2)` after downsampling, which mapped the white glyph to a
  mid-tone and destroyed the contrast. Rendering at 4x and resizing without quantizing fixed it; the file was
  inspected as an image, not just by size.

## insight

pdf-lib's own page-content accessors are enough to reach the raw stream bytes, so a usable text extractor needs no
PDF parser of its own: `page.node.Contents()` plus `inflateSync` plus a 200-line operator walk read every fixture
written with a standard font. The measured limit is not parsing, it is encoding - a page whose font is subset or CID
returns glyph indices that are structurally indistinguishable from text, so the only honest detector is the output
itself. `!/[A-Za-z0-9]/.test(text)` on a non-empty extraction is the test that separates "this font is not readable"
from "this page has no text", and without it a CJK invoice would come back as confident mojibake instead of a stated
limitation.
