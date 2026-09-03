# mcp-pdf: adversarial audit and user-value run

Date 2026-09-03. Scope: `servers/pdf` only. Zero paid API calls. Zero network calls: the server makes
none (a line scan of `src/` for `fetch(`, `node:http`, `node:net`, `node:dns` and bare URLs returns
nothing outside the checkout and repository strings, asserted in `test/adversarial.test.mjs`), and the
run itself called no external service. The claude CLI in part 2 is the user's own subscription client,
not a paid API key.

## Method

**Part 1 harness** - `/private/tmp/pdfaudit/probe.mjs` (free tier) and `pro.mjs` (Pro key from
`scripts/sign-license.mjs pdf`) drive `servers/pdf/dist/index.js` over stdio JSON-RPC through the
repository's own `test/_client.mjs`, which throws on any stdout line that does not parse as JSON.
Fresh `XDG_DATA_HOME` per lane. Fixtures are built by `/private/tmp/pdfaudit/fixtures.mjs`:

| Fixture | What it is |
|---|---|
| `a.pdf`, `b.pdf` | 3 pages, standard font, one readable line per page |
| `big2000.pdf` | 2,000 pages, 851 KB |
| `objstm.pdf` | saved with `useObjectStreams: true`, so it carries `/ObjStm` **and** a `/Type /XRef` cross-reference stream |
| `pdfa.pdf` | XMP packet with `pdfaid:part 1` / `conformance B` plus a `GTS_PDFA1` output intent |
| `truncated.pdf` | first 60% of `a.pdf`'s bytes |
| `wrongheader.pdf` | 1.1 KB of junk prepended to a valid PDF |
| `huge.pdf` | valid PDF plus 200 MB of padding (209,717,329 bytes) |
| `imageonly.pdf` | one page, a filled rectangle, zero text operators |
| `form.pdf` | AcroForm with two filled text fields (`applicant.name`, `total.due`) |

**Input integrity** - sha256 of all ten fixtures is taken before the first probe and after the last one
in every lane, and printed per file.

**Part 2 harness** - the real `claude` CLI as MCP client: `claude -p "<prompt>" --mcp-config
/private/tmp/uv60/mcp.json --strict-mcp-config --model sonnet --output-format json --max-turns 16
--allowedTools "<19 tools written out by name>"`, one session (`--session-id` then five `--resume`),
fresh `XDG_DATA_HOME=/private/tmp/uv60/data` and `XDG_CONFIG_HOME`, `MCP_LICENSE_KEY=""` so both
servers run on the **free tier**. `pdf` and `invoice` are registered as two separate servers. The
per-tool allowlist is written out by name because `--allowedTools "mcp__*"` grants nothing (D-E4,
round 7).

---

## Part 1 - adversarial probes

| # | Probe | Before | Fixed | After |
|---|---|---|---|---|
| A1 | `pdf_info` with no arguments | PASS | - | zod: `Required at path` |
| A2 | `pdf_merge` with one path | PASS | - | zod: `Array must contain at least 2 element(s) at paths` |
| A3 | `pdf_rotate {degrees: "90"}` | PASS | - | zod: `Expected number, received string at degrees` |
| A4 | `pdf_split {ranges: 5}` | PASS | - | zod: `Expected string, received number at ranges` |
| A5 | `pdf_stamp {text: ""}` | PASS | - | zod: `String must contain at least 1 character(s) at text` |
| B1 | 200 MB input | PASS | - | refused on `statSync` before a byte is read: `is 200.0 MB; this server refuses inputs over 100.0 MB` |
| B2 | `pdf_info` on 2,000 pages | PASS | - | 102 ms, `page_sizes_truncated: "showing 20 of 2000"` |
| B3 | `pdf_count` on 2 x 2,000 pages | PASS | - | 154 ms, 4,000 pages |
| B4 | `pdf_text` on 2,000 pages | **FAIL (unbounded answer)** | yes | see D-P6 |
| B5 | `pdf_merge` 2,000 + 2,000 pages | PASS | - | 4,000 pages, 1.7 MB out, **783 ms**, default heap |
| B6 | `pdf_split` 2,000 pages into 2 x 1,000 (Pro) | PASS | - | 362 ms; `pdf_rotate` 293 ms, `pdf_stamp` 548 ms on the same file |
| C1 | truncated PDF | PASS | - | `could not be parsed as a PDF: Failed to parse PDF document (line:84 col:25 offset=1092)` |
| C2 | `pdf_text` on the truncated PDF | PASS | - | same refusal, nothing written |
| C3 | wrong header | PASS | - | `does not start with %PDF-, so it is not a PDF file. Nothing was read.` |
| C4 | merge of a good file with the truncated one | PASS | - | refused, **no partial output on disk** |
| D1-D3 | object streams + xref stream: info, text, extract | PASS | - | 4 pages read, `PAGE 3 OBJSTM` extracted, pages 2 and 4 written and re-read. pdf-lib handles it |
| D4 | `pdf_info` on the PDF/A file | **FAIL (claim invisible)** | yes | see D-P7 |
| D5 | `pdf_text` on the PDF/A file | PASS | - | text read |
| D6/D7 | stamp and merge a PDF/A | **FAIL (silent break)** | yes | see D-P7 |
| E1 | range `"0"` | PASS | - | `page numbers start at 1; "0" does not.` |
| E2 | range `"3-1"` | PASS | - | `"3-1" runs backwards; write it as 1-3.` |
| E3 | range `"1-"` | PASS | - | pages 1,2,3 |
| E4 | range `"a-b"` | PASS | - | `cannot read "a-b" as a page range.` |
| E5 | duplicates `"1,1,1"` | PASS | - | three copies of page 1, and the answer says `2 pages were asked for more than once` |
| E6-E10 | `"-2"`, `"2-"`, `""`, `"1-9999"`, `"1--3"` | PASS | - | 1-2; 2-3; `empty page range`; `past the end: the file has 3 pages`; `cannot read "1--3"` |
| E11/E12 | `pdf_split` with `"0"`; a pattern that produces one path twice | PASS | - | refused; `produces the path ... twice; nothing was written` |
| F1 | stamp text with a newline | **FAIL (words ran together)** | yes | see D-P2 |
| F2 | 500-character stamp | **FAIL (drawn off the page)** | yes | see D-P4 |
| F3 | `"OPŁACONE 已付款"` | **FAIL (spelled OPACONE)** | yes | see D-P3 |
| F4 | `"已付款"` alone | PASS | - | `the stamp text is empty after removing characters a built-in PDF font cannot carry`, nothing written |
| F5/F6 | `opacity: 5`, `opacity: 0` | PASS | - | `opacity must be greater than 0 and at most 1`, nothing written |
| F7 | `color: "red"` | PASS | - | free tier: Pro answer with the checkout line; Pro: `"color": "red"` |
| F8 | `color: "#zz"` | PASS | - | `cannot read "#zz" as a colour. Use a hex code such as #1b7f3b or one of: red, green, ...` |
| F9/F10 | `font_size: -20`, `font_size: 1e6` | **FAIL (both accepted)** | yes | see D-P5 |
| G1 | `out_path` traversal `../../../../private/tmp/.../trav.pdf` | PASS | - | resolved against cwd and written there; no escape. An absolute path is the caller's own choice, as with any file tool |
| G2-G4 | write, refuse, then `overwrite: true` | PASS | - | `already exists and nothing was written. Pass overwrite: true` |
| G5 | `out_path` with no extension | PASS | - | `.pdf` appended |
| **G6** | **`out_path` equal to the input, `overwrite: true`** | **FAIL (input destroyed)** | yes | see D-P1 |
| H1 | merge the same file three times | PASS | - | 9 pages, three copies of every page, source byte-identical |
| I1/I5 | rotate 0 and 360 | **FAIL (reported a turn that did not happen)** | yes | see D-P8 |
| I2 | rotate -90 | PASS | - | `from 0 to 270` |
| I3 | rotate 450 | **FAIL (silently normalised)** | yes | see D-P8 |
| I4/I6 | rotate 45, rotate 100000 | PASS | - | `a PDF can only record rotation in multiples of 90 degrees` |
| J1 | `pdf_text` on an image-only page | PASS | - | `no text operators on the page (it is probably a scan or a pure image; there is no OCR here)` |
| J2 | `pdf_text` on a filled form | **FAIL (values invisible)** | yes | see D-P9 |
| K1 | two processes on one data dir, 20 concurrent calls | PASS | - | `test/concurrency.test.mjs`: 20 records, 20 distinct outputs, one winner per contended `out_path` |
| K2 | corrupt operation register | PASS | - | quarantined to `operations.json.corrupt-<ts>` with a marker; the PDF is still written and the answer says the history could not be updated |
| K3 | stdout carries JSON-RPC only | PASS | - | the client throws on any non-JSON stdout line; no throw across 5 lanes / 90 requests |
| K4 | no network | PASS | - | line scan of `src/` is empty |
| K5 | inputs byte-identical | **FAIL (see D-P1)** | yes | after the fix, all ten fixtures sha256-identical in every lane |

### Defects and fixes

**D-P1 (critical): `out_path` was allowed to be an input, and destroyed it.**
`pdf_pages {path: a.pdf, pages: "1", out_path: a.pdf, overwrite: true}` returned
`Extracted 1 page ... "source_pages": 3` and left `a.pdf` as a **1-page file**: the pages were already in
memory and were written back over the file they came from. `pdf_merge {paths: [b,b], out_path: b,
overwrite: true}` doubled `b.pdf` into itself. `pdf_stamp` on its own input printed
`The input file is unchanged` while changing it. Worse than the loss is the silence downstream: the very
next probe in the same run, a merge of `a.pdf` three times, answered `Merged 3 files into 3 pages` -
arithmetically consistent, factually wrong, and nothing in the answer pointed at the destroyed source.
sha256 caught it; no message did.
Fix: `reserveOutput(out, overwrite, inputs)` refuses an `out_path` that resolves to, or shares an inode
with, any input of the same call, before `mkdirSync` and before any work. `overwrite: true` does not
override it and the refusal says why: it is consent to replace some other file, never to consume an
input. Applied to merge, split, pages, rotate, stamp, watermark and reorder.

**D-P2: a newline in stamp text ran the words together.** `sanitizeStampText` deleted every code point
below 32, so `"PAID\nIN FULL"` was stamped as **`PAIDIN FULL`** and the answer reported it as such.
Fix: any whitespace control is a word separator, not a deletion, and is not counted as a removed
character.

**D-P3: a Polish stroke was deleted, leaving a different real word.** `OPŁACONE` (paid, Polish) came
back as **`OPACONE`** because U+0141 is outside WinAnsi. A deleted diacritic that leaves a plausible
word is worse than a visible replacement.
Fix: characters outside WinAnsi are first transliterated - an explicit table for the ones with no
decomposition (Ł, đ, ħ, œ, ŋ, ...) plus NFD with the combining marks stripped for the rest - so
`OPŁACONE` stamps `OPLACONE`, and the answer says how many characters were replaced and prints the
text that was actually drawn. Only what cannot be transliterated (CJK) is removed and counted.

**D-P4: an overlong stamp was drawn off the page and reported as success.** `autoSize` stops shrinking
at 6 pt, so 500 characters measured 2,001 pt of text in 595 pt of page and simply was not there when
the file was opened.
Fix: the width is compared against the room actually available (the page width, or the diagonal for a
centred stamp) and the overflow is named: `2001 pt of text at 6 pt in 595 pt of room, the smallest size
this server will use`.

**D-P5: `font_size` was unbounded.** `-20` and `1e6` both produced a "stamped" file with nothing
visible on the page.
Fix: `font_size` must be greater than 0 and at most 1600 points; anything else is refused with nothing
written.

**D-P6: `pdf_text` returned an unbounded answer.** 2,000 pages came back as one message with no cut and
no cap; on a text-heavy document that is megabytes into a chat turn.
Fix: the whole answer is capped at 200,000 characters, the cut is stated with the page it stopped at,
and the answer names the exact argument that continues it: `call pdf_text again with pages: "N-"`.

**D-P7: a PDF/A claim was invisible and silently broken.** `pdf_info` never mentioned the `pdfaid`
packet; `pdf_stamp` embedded a non-embedded standard font into a file that still claimed PDF/A-1b in
its metadata; `pdf_merge`, `pdf_pages`, `pdf_split` and `pdf_reorder` built a new document and dropped
the claim and the output intents with no note. Either way the user ends up with a file whose archival
status is not what they think.
Fix: `loadPdf` reads the claim, `pdf_info` reports `pdfa_claim: "PDF/A-1b"`, the stamp answer says the
copy still carries the claim but is no longer guaranteed to meet it, and every new-document tool says
the output *is not* PDF/A-1b. Nothing is validated - the claim is reported as a claim.

**D-P8: rotate lied about no-ops.** `degrees: 0` and `degrees: 360` answered `Rotated 3 pages` having
turned nothing; `450` was normalised to 90 with no word about it.
Fix: a rotation that leaves every page at the angle it had says so, and a magnitude of 360 or more says
`450 degrees is the same as 90 degrees; a PDF stores one angle per page, not a number of turns.`

**D-P9: `pdf_text` could not see the values of a filled form.** A form's values live in the field
objects and in each widget's appearance stream, not in the page content stream the extractor walks, so
a filled application form came back as the single word `Application form` and the two values the user
typed were absent with no note. Silent omission on a document that visibly has text on it.
Fix: `pdf_text` reads the AcroForm fields back by name and prints them under a heading that states why
they were not part of the page text.

**D-P10 (part 2, partially fixed): the self-output refusal left the model stuck.** The D-P1 guard is
correct, but the first message did not tell the caller what to do instead, and the model in scenario 6
wrote `acme-2-rotated.pdf` and told the user it could not replace the original.
Fix: the refusal now names the safe sequence - write beside it, check it, rename it yourself. Replacing
an input in place is deliberately still not a thing this server does.

### Edits made

| File | Change |
|---|---|
| `src/pdfio.ts` | `reserveOutput(out, overwrite, inputs)` refuses an out_path that is an input (path or inode); `sameFile()`; `pdfaClaim()`; `pdfa` on `LoadedPdf` |
| `src/index.ts` | `sanitizeStampText` keeps whitespace as spaces and transliterates non-WinAnsi letters, returning `transliterated` |
| `src/index.ts` | `MAX_FONT_SIZE = 1600` validated before any work; stamp overflow measured and reported |
| `src/index.ts` | `MAX_TEXT_CHARS = 200_000` cap on `pdf_text` with the continuation argument named |
| `src/index.ts` | `formFields()` reads AcroForm values back in `pdf_text` |
| `src/index.ts` | `pdf_info` reports `pdfa_claim`; `pdfaLostNote()` on pages/split/reorder; merge and stamp carry their own PDF/A notes |
| `src/index.ts` | rotate reports a whole-turn no-op and normalises a magnitude over 360 out loud |
| `test/adversarial.test.mjs` | new file, 15 tests: self-output guard, stamp text, font size and fit, PDF/A, form fields, text cap, rotate wording, 200 MB / 2000 pages, malformed input, object streams, ranges, triple merge, image-only page, opacity and colour, transport and network |

---

## Part 2 - user value through a real MCP client

Two servers, one conversation, free tier throughout. Score: 3 = correct, right numbers, no
clarification; 2 = correct but leaves the user a gap; 1 = partially wrong; 0 = failed.

### Scorecard - 17 / 18

| # | Prompt | Score | Turns | Sec | Tools called | Verified |
|---|---|---|---|---|---|---|
| s1 | "Set up my business Lucky Strike Software, VAT PL1234567890." | 3 | 3 | 10.3 | `invoice_business_set` | `profile/business.json`: `name Lucky Strike Software`, `vat_id PL1234567890`; the model relayed that the profile is shared and did not repeat it anywhere else |
| s2 | "Create two invoices for Acme (1,000 EUR and 2,500 EUR at 23% VAT) and render their PDFs." | 3 | 6 | 16.0 | `client_add`, `invoice_create` x2, `invoice_pdf` x2 | `invoices.json`: INV-2026-0001 `total_minor 123000`, INV-2026-0002 `total_minor 307500`, `tax_lines [{rate:23}]`; both PDFs on disk, 1 page each. It also surfaced that Acme has no address rather than inventing one |
| s3 | "Merge the two invoice PDFs into one file and stamp it PAID." | 3 | 4 | 13.2 | `pdf_merge`, `pdf_stamp` | `Acme-merged-PAID.pdf` 2 pages; and it volunteered that the *records* are still unpaid and offered `invoice_mark_paid` - the file/record gap named without being asked |
| s4 | "How many pages is that and what does page 2 say the total is?" | 3 | 4 | 10.8 | `pdf_info`, `pdf_text {pages:"2"}` | answered **2 pages** and **EUR 3,075.00**; independent `pdf_text` of page 2 reads `Total EUR 3075.00`, and `invoices.json` holds `total_minor 307500`. It also noticed the page still reads `Status: UNPAID` under the stamp |
| s5 | "Split the merged file back into single pages named acme-1.pdf and acme-2.pdf." | 3 | 3 | 11.3 | `pdf_split` | `acme-1.pdf` and `acme-2.pdf`, 1 page each, both carrying the PAID stamp |
| s6 | "Rotate the second one 90 degrees." | 2 | 5 | 19.3 | `pdf_rotate` (twice: refused, then a new name) | `acme-2-rotated.pdf` has `rotation: 90`, `acme-2.pdf` unchanged at 0. The rotation is right, but the user asked for "the second one" and got a second file: the model first tried to write over `acme-2.pdf`, hit the D-P1 guard, and could not finish the rename. D-P10 |

**Totals: 25 tool calls, 80.9 s, 17 / 18.**

### Independent verification

Read from the files, not from the model's prose (`/private/tmp/uv60/verify2.mjs`).

| Claim | Evidence | Verdict |
|---|---|---|
| Business identity written once, shared | `data/mcp-servers/profile/business.json` = `{name: "Lucky Strike Software", vat_id: "PL1234567890", default_currency: "EUR", invoice_prefix: "INV"}` | PASS |
| Two invoices, 23% VAT | `invoices.json`: `subtotal_minor 100000 / tax_minor 23000 / total_minor 123000` and `250000 / 57500 / 307500` | PASS |
| Merged file page count | `pdf_info` on `Acme-merged-PAID.pdf`: `pages: 2` | PASS |
| **Page 2 total, against the store** | `pdf_text {pages:"2"}` reads `Total EUR 3075.00`; store `total_minor 307500` = **EUR 3,075.00**; the model said EUR 3,075.00 | PASS |
| Split parts | `acme-1.pdf` 1 page, `acme-2.pdf` 1 page, both stamped | PASS |
| Rotation | `acme-2-rotated.pdf` `rotation: 90`; `acme-2.pdf` still `rotation: 0` | PASS |
| No source PDF was consumed | sha256 of `INV-2026-0001.pdf` and `INV-2026-0002.pdf` unchanged after the merge, stamp, split and rotate | PASS |

---

## Test summary

```
$ npm run build -w servers/pdf
> tsc -p tsconfig.json --declaration && node -e "...chmodSync('dist/index.js',0o755)"
(clean)

$ npm test -w servers/pdf
1..39
# tests 39
# pass 39
# fail 0
# duration_ms 4640.205208
```

39 tests across four files: `pdf.test.mjs` (14), `smoke.test.mjs` (6), `concurrency.test.mjs` (4),
`adversarial.test.mjs` (15, new). Baseline before this audit was 24.

## RESULT.md block

```
status: DONE
evidence: npm test -w servers/pdf -> 39 pass / 0 fail (4.64 s); build clean.
  Part 1: 60 probes over 5 lanes, free and Pro, fixtures incl. 200 MB, 2000 pages, object streams,
  PDF/A, truncated, wrong header, AcroForm. sha256 of all 10 inputs identical before and after
  every lane once D-P1 was fixed.
  Part 2: claude CLI, sonnet, pdf + invoice, free tier, one resumed session, 6 prompts -> 17/18,
  25 tool calls, 80.9 s. Page-2 total EUR 3,075.00 verified against invoices.json total_minor 307500.
artifacts: servers/pdf/src/{index.ts,pdfio.ts}, servers/pdf/test/adversarial.test.mjs,
  servers/pdf/README.md, docs/PDF_AUDIT.md
cost: 52 wall minutes
failures: 10 defects, D-P1 to D-P10, all fixed server-side. D-P1 was the one that mattered: out_path
  was allowed to be an input, so pdf_pages onto its own source silently took a 3-page file to 1 page
  and the next merge in the same run answered "3 files into 3 pages" - self-consistent and wrong.
insight: every remaining defect was a message that was true about the call and false about the file.
  The stamp answer said "the input file is unchanged" while overwriting it; "Rotated 3 pages" for a
  0-degree turn; "Stamped OPACONE" for OPLACONE; a 500-character stamp reported as drawn when it was
  off the page; a filled form read as one word. sha256 before and after found the destructive one -
  no assertion about the tool's own answer could have, because the answer was internally consistent.
```
