# User value audit, round 18 (pdf, hosted url-upload re-run) - 2026-09-05

Round 18 is a single-lane hosted re-run of round 12's six pdf prompts, changed in exactly one way:
the two PDFs arrive as `pdf_upload {url}` fetches of a fixture on `raw.githubusercontent.com`
(Extension 10, shipped 2026-09-04) instead of round 12's base64 paste. Same server, same six
prompts, same hosted arrival path (`https://mcp.zovo.one/mcp/pdf/t/<token>`, no headers, free
tier) - the only question is whether the newer, cheaper upload path still lands the same score.

## Method

- **Arrival.** `GET https://mcp.zovo.one/mcp/connect` -> 200 `text/html`, minting
  `anon_02c50e96aa9d19a4a25e3517797e3e72`. One token, reused for the whole lane.
- **Registration.** One `mcp.json`, one `http` entry, `https://mcp.zovo.one/mcp/pdf/t/<token>`,
  no `--header` anywhere. `pdf` alone, since this lane needs nothing else.
- **Allowlist.** 15 `mcp__pdf__<tool>` entries read from a live `tools/list`: `pdf_info`,
  `pdf_count`, `pdf_merge`, `pdf_split`, `pdf_pages`, `pdf_rotate`, `pdf_stamp`,
  `pdf_watermark_business`, `pdf_reorder`, `pdf_text`, `license_status`, `license_activate`,
  `pdf_upload`, `pdf_files`, `pdf_delete_upload`.
- **Client.** `claude` 2.1.261, `-p`, `--model sonnet`, `--strict-mcp-config`, `--mcp-config`
  pointing at the one-entry file above, `--output-format stream-json --verbose --max-turns 12`,
  one `--session-id` then five `--resume`, `timeout 240` per prompt. Each prompt's stream-json was
  written to its own file (`out/s1.jsonl` .. `out/s6.jsonl`) before the next prompt started.
- **D-R57 honoured.** The lane ran in an **empty** working directory
  (`/private/tmp/uv-r18pdf/wd`) with the CLI's own filesystem tools disallowed (`Bash, Read,
  Write, Edit, Glob, Grep, WebFetch, WebSearch, NotebookEdit, Task`). Fresh scratch directory
  local to this run, no reuse of any prior round's state.
- **Auth gotcha, caught before any prompt counted.** A first attempt pointed
  `CLAUDE_CONFIG_DIR` at a fresh empty directory to isolate the run and every turn came back
  `Not logged in - Please run /login`. `CLAUDE_CONFIG_DIR` carries the CLI's own OAuth session,
  not the target server's state, and isolating it kills the client rather than the lane. Fixed by
  leaving `CLAUDE_CONFIG_DIR` at the operator's real config (fresh `XDG_DATA_HOME` /
  `XDG_CACHE_HOME` / `XDG_STATE_HOME` still isolate everything else) and re-running from scratch.
  Nothing from the broken attempt is in the scorecard below.
- **Fixture.** `remote/fixtures/sample-doc.pdf` is the **only** PDF fixture committed under
  `remote/fixtures` - confirmed by `find . -iname '*.pdf'` over the working tree and `git log`
  over `remote/fixtures/*.pdf`, both returning exactly one file. Raw URL:
  `https://raw.githubusercontent.com/theluckystrike/mcp-servers/main/remote/fixtures/sample-doc.pdf`.
  Fetched independently by curl before the run: 200, 1074 bytes, byte-identical to the working
  tree copy. Decoded locally with pdf-lib: 2 pages, 400x300 pt, `%PDF-1.7`, page 1 text
  `"fixture page 1"`, page 2 text `"fixture page 2"`, no dollar amounts (this is a generic
  Extension 10 fixture, not an invoice fixture like round 12's pdf-lib pair).
- **The two-PDF prompt, adapted.** Round 12's opener needed two content-distinct PDFs; only one
  is committed here, so `p1` points both `pdf_upload {url}` calls at the same fixture URL under
  two different names (`doc-a`, `doc-b`). This is a fixture gap, not a defect fixed or hidden -
  logged below as `R18-pdf-fixture-gap`. The model itself noticed and said so unprompted.
- **Clock.** 2026-09-05.

Score: 3 = correct, right numbers, no clarification. 2 = correct but needed a second turn, a
workaround, or left the user a gap. 1 = partially wrong. 0 = failed.

## Scorecard - 17 / 18 (round 12: 17 / 18)

| # | Prompt | R12 | R18 | Calls | Sec | What happened |
|---|---|---|---|---|---|---|
| p1 | "Here are two PDFs: `<url>` `<url>`. Upload them as doc-a and doc-b." | 3 | **3** | 2 | 14.9 | Two `pdf_upload {name, url}` calls, one per file, both against the same raw.githubusercontent.com URL (only one fixture exists). Each reply: `Uploaded "doc-a.pdf" (1074 bytes). Fetched 1074 bytes from raw.githubusercontent.com. Pass path: "doc-a" to any pdf tool.` Byte count matches the fixture exactly, and the model told the user unprompted that both uploads are the same source file rather than silently treating them as distinct |
| p2 | "Merge those two into one file." | 3 | **3** | 1 | 10.4 | One `pdf_merge {paths: [doc-a, doc-b], out_path: merged}`. `Merged 2 files into 4 pages` (2+2, since this fixture is 2 pages, not round 12's 1). `GET`: 200, `application/pdf`, `filename="merged.pdf"`, 2,453 B, `%PDF-1.7`, 4 pages - decoded to fixture page 1/2/1/2 in order |
| p3 | "Stamp the merged file PAID and give me the file." | 3 | **3** | 1 | 11.9 | One `pdf_stamp`, all 4 pages, volunteered that the stamp is selectable drawn text and the input is unchanged. Echoed `"source": "merged.pdf"` - **no virtual-root leak; D-R59 still holds live.** `GET`: 4,259 B, `application/pdf`. Independent decode: all 4 pages carry `PAID` **and** the original `fixture page 1`/`fixture page 2` text underneath |
| p4 | "How many pages is that?" | 2 | **2** | 0 | 5.4 | "The stamped file (merged-paid) has 4 pages." Correct - but **no tool ran**, the number restated from `pdf_stamp`'s own `pages` array one turn earlier. Identical shape to round 12's D-R63, recurring unchanged |
| p5 | "What does page 2 say?" | 3 | **3** | 1 | 9.7 | `pdf_text {path: merged-paid, pages: "2"}` read `fixture page 2` plus the `PAID` overlay, and named its own read method (FlateDecode via `node:zlib`, `Tj`/`TJ` operators, no OCR). Prompt adapted from round 12's dollar-total question since this fixture carries no invoice total |
| p6 | "Split the stamped file back into single pages." | 3 | **3** | 1 | 15.5 | One `pdf_split`, four parts (this file has 4 pages, not round 12's 2), echoed `"source": "merged-paid.pdf"` - again no leak. `GET` all four: 1,832-1,834 B each, `application/pdf`, `filename="merged-paid-page1..4.pdf"`. Independent decode: pages 1/3 = `fixture page 1` + `PAID`, pages 2/4 = `fixture page 2` + `PAID`, matching the merge order |

**Totals: 17 / 18, 6 tool calls, 67.9 s.**

## Independent verification

Every number below was re-read from the endpoint by `curl` or decoded locally with pdf-lib and a
FlateDecode/`Tj` scan, not taken from the model's prose.

| Claim | Evidence | Verdict |
|---|---|---|
| Arrival needs no header | one lane, one `/t/<token>` entry, connected first try, no `Authorization` anywhere | PASS |
| `pdf_upload {url}` fetches the fixture and stores the exact bytes | `Fetched 1074 bytes from raw.githubusercontent.com`, matching an independent `curl` of the same URL (also 1074 bytes, identical to the working-tree file) | PASS |
| The downloads are real PDFs | six `GET /mcp/download/<id>`: 2,453 / 4,259 / 1,832-1,834x4 B, all `application/pdf`, all `%PDF-1.7`, filenames matching the caller's names or the split pattern | PASS |
| Page counts and page text, decoded locally | pdf-lib + manual `Tj` extraction: `sample-doc.pdf` 2 pages, `merged.pdf` 4 pages (1/2/1/2), `merged-paid.pdf` 4 pages each carrying `PAID` over the original text, all 4 split parts 1 page each with `PAID` and the right original text | PASS |
| D-R59 (echoed `/out/...` path) stays fixed | `pdf_stamp` -> `"source": "merged.pdf"`; `pdf_split` -> `"source": "merged-paid.pdf"` - neither carries `/uploads/` or `/out/` | PASS, fix holds |
| D-R63 (page count answered without a tool call) | p4 made zero tool calls, answer restated from `pdf_stamp`'s prior reply | CONFIRMED RECURRING, client-side, unchanged from round 12 |

## Defects

### R18-pdf-fixture-gap (low, fixture, not code)

`remote/fixtures/` carries exactly one committed PDF fixture, `sample-doc.pdf`. Round 12's opener
assumed two content-distinct PDFs (two invoices with different totals); this round's url-upload
path had to point both `pdf_upload {url}` calls at the same file under two names. Nothing server
or client side is wrong - the model noticed and said so (`"doc-a and doc-b (1074 bytes each, same
source file)"`) rather than inventing a difference - but a second small PDF fixture
(`sample-doc-2.pdf`, say) would let a future url-path pdf round reproduce round 12's two-distinct-
invoices shape exactly, including the page-2-total question round 12 could ask and this round
could not.

### R18-pdf-p4-recurs (low, client-side, recurring)

D-R63 from round 12 recurs unchanged: "How many pages is that?" is answered from the transcript
(`pdf_stamp`'s own `pages: 4`) rather than a fresh `pdf_count` or `pdf_info` call. The answer is
correct because nothing changed the page count between turns, but nothing server-side moved either
- `pdf_count` exists, costs one call, and was not used. Not a new finding; recorded to show it is
still live two rounds later.

## Bottom line

17/18, unchanged from round 12. The only point lost is the same one round 12 lost, for the same
reason (D-R63, a page count answered from memory instead of a tool call). Everything else that
changed between the two rounds is environmental, not behavioral: round 12 pasted two content-
distinct base64 PDFs in one 76.4s turn; this round fetched one fixture PDF twice by URL across two
tool calls totaling 14.9s, exercising Extension 10's `pdf_upload {url}` path exactly as it was
built - one line from the caller, the worker does the fetch, `Fetched N bytes from
raw.githubusercontent.com` in the reply. D-R59's fix (no virtual `/out/` root in the echoed
`source` field) holds live across both `pdf_stamp` and `pdf_split` this round. Every downloaded
file was independently fetched and decoded rather than believed, and every byte, page count and
extracted string matched the model's prose. The one real gap this round exposed is a fixture gap,
not a code defect: only one PDF lives under `remote/fixtures`, so a "two PDFs" prompt run through
the url path cannot currently reproduce round 12's two-distinct-documents shape.

## RESULT.md block

```
status: DONE
evidence:
  hosted single-lane pdf re-run of round 12's six prompts, changed to arrive via Extension 10's
    pdf_upload {url} instead of a base64 paste, through https://mcp.zovo.one/mcp/pdf/t/<token>
    with NO headers, one anonymous token (anon_02c50e96aa9d19a4a25e3517797e3e72), free tier
  6 prompts adapted from round 12's pdf section, using the one committed PDF fixture
    (remote/fixtures/sample-doc.pdf, 2 pages, fetched from raw.githubusercontent.com) for both
    uploaded names since no second PDF fixture is committed
  scored 17/18 in 6 tool calls and 67.9 s, unchanged from round 12's 17/18
  every download independently fetched and decoded: merged.pdf 4 pages/2453B, merged-paid.pdf
    4 pages/4259B with PAID over the original text, 4 split parts 1832-1834B each with PAID and
    the correct page text; all application/pdf, all %PDF-1.7
  D-R59 (echoed /out/ virtual root) confirmed still fixed live: source fields read "merged.pdf"
    and "merged-paid.pdf", no leak
  D-R63 (a page-count question answered without a tool call) confirmed still recurring,
    client-side, same as round 12 -- the only point lost
  1 fixture gap logged (not a code defect): only one PDF fixture committed under
    remote/fixtures, so "two PDFs" prompts run through the url path reuse the same file twice
```
