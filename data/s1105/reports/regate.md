# S1105 independent re-gate (47 pages)

Score: 71 / 100

Scope. Rendered dist at ~/mcp-site-2026-10-30/build-out/s1105/site/dist. 18 new /can-claude/ pages (A-live.json minus edit-excel-files), 16 /can-chatgpt/, 3 /can-cursor/, 5 live /can-claude/ (make-a-pdf, create-word-documents, create-excel-files, read-zip-files, tell-the-time-in-another-time-zone), 5 /use-cases/. Visible text extracted with a tag-strip script. Run 2026-11-05.

## What passed
- Secrets. 0 `anon_` + hex strings, 0 token values, 0 `sk-` keys in any HTML. Every connector URL shows `<token>`.
- Style. 0 em/en dashes, 0 emoji, 0 exclamation marks, 0 hype words (seamless, powerful, unlock, robust, etc.) in visible text.
- Lengths. Titles 48 to 60 chars, metas 90 to 158 chars. None over 65/165.
- Code-execution framing. All 18 A pages and the 5 live can-claude pages now say code execution is on by default on Free, Pro and Max. Previous-gate rows 1 to 40 are fixed in the rendered output.
- Math checked by hand. Tax Calc (12,349 / 22,667 / 5,311.50, effective 13.0 / 16.2 / 8.6 %). DST 2027 dates (US 14 Mar / 7 Nov, EU 28 Mar / 31 Oct). 9:00 EDT on 17 Mar 2027 = 13:00 London, 14:00 Berlin. 3 Nov 2026 New York on EST. Meeting slot 10:00 NY = 15:00 UTC = 16:00 Warsaw in November.

## Sources used
- Code execution and file creation default on Free/Pro/Max (task ground truth).
- Claude memory opened to the Free plan on 2 Mar 2026 (macrumors.com/2026/03/02/anthropic-memory-import-tool, engadget.com "Anthropic brings memory to Claude's free plan").
- Cursor chat reads an attached PDF and extracts its text with the attach button (forum.cursor.com staff replies, threads 165095 and 1945). .docx and .xlsx still cannot be attached.
- Hosted limits from calls/A/*.tools.json. image_watermark, receipt_attach and zip_bundle_month are not available on the hosted endpoint. watch_refresh of all watches is Pro. pdf_watermark_business is Pro.

## Defects

10 BLOCK rows on 12 pages, 13 FIX rows.

| # | Sev | Page | Quote | Why | Exact fix | File + field |
|---|-----|------|-------|-----|-----------|--------------|
| 1 | BLOCK | /can-claude/edit-images/ | "Connect the Image server (free token) and Claude resizes, crops, compresses, converts and watermarks image files" / FAQ "Resize, crop, compress, convert, thumbnails and text watermarks." | image_watermark says "Not available on this hosted endpoint". The free-token path cannot watermark. | Answer: "...Claude resizes, crops, compresses and converts image files as named tools, and every tool writes a new copy. A local install can also add a text watermark." FAQ: "No. It does file edits only. Resize, crop, compress, convert and thumbnails, plus text watermarks on a local install." | data/content/can-claude-live.json, edit-images answer + faq[0].a |
| 2 | BLOCK | /can-claude/track-prices/ | "One refresh of the whole list in a single call." | watch_refresh schema says refreshing every watch in one call is Pro, free refreshes one id at a time. | "One refresh of the whole list in a single call (Pro)." | can-claude-live.json, track-prices needs[2] |
| 3 | BLOCK | /can-chatgpt/edit-photos/ | "adds a text watermark" + example "add my shop name as a watermark" (image_watermark) under "Every example here works on the free tier" | ChatGPT only reaches the hosted URL, and the hosted Image server has no watermark tool. | with_tool: "...makes thumbnails and strips metadata, always writing a new copy. Watermarks need a local install, which ChatGPT can't reach." Replace the watermark case with a resize + strip-metadata case on ChatGPT pages. | site/src/data/pages.json can-chatgpt/edit-photos with_tool; data/content/a.json image cases (line ~2939) |
| 4 | BLOCK | /can-chatgpt/help-with-finances/ | example step "receipt_attach Attaches the receipt photo" / FAQ "It attaches the file to the expense." | receipt_attach: "Not available on the hosted endpoint". ChatGPT is remote-only. | Drop the receipt_attach step from the case. FAQ: "On a local install it attaches the file to the expense. On the hosted URL put the receipt reference in the note. You give the amount and merchant." | data/content/a.json expense-tracker cases[0].steps (line ~2600) and faq |
| 5 | BLOCK | /can-chatgpt/zip-files/, /can-chatgpt/open-zip-files/ | example "zip_bundle_month Collects 2026-10 files from the sibling servers' output folders" under "Every example here works on the free tier" | zip_bundle_month is "Local (stdio) install only". ChatGPT can only use the hosted URL. | Replace with a hosted case (zip_upload then zip_create with patterns), or label the step "(local install only, not in ChatGPT)". | data/content/b.json zip cases (line ~3629) |
| 6 | BLOCK | /can-claude/read-zip-files/ | "creates archives with glob patterns and bundles a month of invoices for your accountant" + card and example using zip_bundle_month, next to "Paste one URL ... No install" | Same as #5. The previous gate fixed this on /can-claude/zip-files/ only. | with_tool: "...creates archives with glob patterns, and on a local install bundles a month of invoices for your accountant." Mark the case "(local install)". | data/content/jobs.json read-zip-files with_tool; b.json zip case |
| 7 | BLOCK | /can-claude/make-a-pdf/ | "Claude never remembers invoice numbers or your business details between chats." | Claude memory is on all plans including Free since March 2026, and Projects keep files. "Never" is false. | "Memory and Projects can keep your details, but Claude keeps no invoice counter, so numbers can repeat or skip." | data/content/jobs.json make-a-pdf without_tool |
| 8 | BLOCK | /can-claude/make-a-pdf/ | example step "pdf_watermark_business Adds the business name and VAT id..." under "Every example here works on the free tier" | pdf_watermark_business is Pro. The free/Pro table on the same page puts the business footer in the Pro column. | Replace the step with pdf_stamp only, or change the result to "...business footer on every page (Pro)." | data/content/jobs.json make-a-pdf cases (line ~944) |
| 9 | BLOCK | /can-cursor/read-pdf/ | title "With one server", answer "Not reliably on its own. Cursor's file reader is made for text and code.", without_tool "Its editor doesn't read PDF text." | Cursor chat reads an attached PDF and extracts the text (attach button), and its agent runs terminal commands. The page says it cannot. | title: "Can Cursor read PDF files? Yes, two ways". answer: "Yes. Attach a PDF in Cursor chat and it reads the text, and the agent can run a script for more. A PDF server adds page counts, page ranges and new files as named tools." without_tool: "Cursor chat reads a PDF you attach with the attach button. An @-mention of a PDF can come through as raw bytes, and the agent then falls back to a script." | site/src/data/pages.json can-cursor/read-pdf title/meta/answer; data/content/jobs.json without_tool |
| 10 | BLOCK | /can-claude/read-excel-files/ | native block "Reads a small table you paste into the chat." + server block "Every sheet, column and type in an .xlsx, without pasting." | Contradicts the answer on the same page ("Claude.ai reads an uploaded .xlsx or CSV and can analyze it in its sandbox"). | native[1]: "Reads an uploaded .xlsx or CSV and analyzes it in its sandbox when code execution is on." needs[0]: "The same sheet, column and type listing in any MCP app, with no sandbox needed." | can-claude-live.json read-excel-files native[1], needs[0] |
| 11 | FIX | /can-claude/edit-pdfs/ | FAQ "It merges, splits, reorders, rotates and stamps." | Reorder is Pro. The next FAQ says so. | "It merges, splits, rotates and stamps, and reorders on Pro." | can-claude-live.json edit-pdfs faq[0].a |
| 12 | FIX | /can-claude/edit-pdfs/, generate-qr-codes, make-barcodes, zip-files, edit-images, find-free-time-in-my-calendar | "Claude on its own" lists only talk ("Tells you which files to include", "Reads events you paste as text") | The answer says Claude makes the file in its sandbox. The block undersells it. | Add one native line per page, e.g. "Writes a new PDF in its sandbox when code execution is on." / "Reads an .ics file you upload, in that chat." | can-claude-live.json native[] per slug |
| 13 | FIX | /can-claude/make-barcodes/ (meta 90 chars), /can-claude/edit-word-documents/ | meta "Often yes. Works in Claude and Cursor. Open source under MIT. Do your back office in chat." | Answer is cut at the first sentence and padded with fillers and a tagline. Says nothing about barcodes. | make-barcodes meta: "Often yes. With code execution on, Claude can draw a barcode in its sandbox. The Barcode server draws EAN-13, UPC-A and Code 128 as SVG and checks digits." Drop the brand tagline from FILLERS. | can-claude-live.json make-barcodes meta_description; site/src/layouts/Layout.astro FILLERS |
| 14 | FIX | /can-chatgpt/do-my-taxes/ | "Tax Calc is free." then "Every example here works on the free tier. One $39 key removes the limits on all of them." | Contradiction. Tax Calc has no limits or Pro. | Hide the after_case upsell when the server has no Pro. | site/src/components/JobPage.astro line 30 |
| 15 | FIX | /can-chatgpt/create-xlsx-files/, make-a-resume/, update-my-resume/, open-pdfs/, edit-pdfs/ | "Open ~/Downloads/orders_q3.xlsx", "Read my old CV at ~/Documents/CV_2023.docx", "invoices/FV-2026-031.pdf" | ChatGPT only reaches the hosted URL, which has no filesystem. Local paths can't work there. | On can-chatgpt pages use upload wording: "Here is orders_q3.xlsx (uploaded)..." | data/content/b.json cases used on can-chatgpt pages |
| 16 | FIX | /can-chatgpt/create-qr-codes/ | title "Yes, scannable ones" vs meta "Its code tool can sometimes make real ones" | Title and body hedge disagree. | "Can ChatGPT create QR codes? Often, here is how" | site/src/data/pages.json title |
| 17 | FIX | /can-chatgpt/open-zip-files/ | title "Sometimes" vs meta "can often unpack" | Same hedge mismatch. ChatGPT's code tool unzips reliably. | title "Can ChatGPT open zip files? Yes, with its code tool". Answer "Usually. ChatGPT can unpack..." | pages.json title, answer |
| 18 | FIX | /can-cursor/edit-word-documents/ | title "With one server", "which breaks formatting easily" | The agent can run python-docx in the terminal. Gate #40 fixed the same pattern on read-excel-files. | title "Can Cursor edit Word documents? Yes, two ways". without_tool "...patch the XML or use python-docx in a script, which can lose formatting." | pages.json title; jobs.json without_tool |
| 19 | FIX | /can-claude/make-a-pdf/, /use-cases/merge-pdf-in-claude/ | "Each tool returns the path of the new file." / "returning the path" | The hosted URL the page sells returns a one-hour download link. | "...returns the new file's path locally, or a one-hour download link on the hosted URL." | jobs.json with_tool |
| 20 | FIX | /use-cases/resize-and-compress-images/ | "adds a text watermark" + watermark example next to "Paste this URL" | Hosted has no watermark tool. | "...adds a text watermark on a local install..." | jobs.json with_tool; a.json image case |
| 21 | FIX | /can-claude/find-recurring-subscriptions/ | "but it can miss ones with small date shifts" | Unsourced, and with code execution Claude can compute cadence. | "...Claude can spot repeat charges in a statement you upload, but it keeps no ledger to check again next month." | can-claude-live.json answer |
| 22 | FIX | all /can-claude/ live-answer pages, all job pages | "Get a free token first: no account, 30 days...", "Some features are Pro; the server page...", "Invoice Pro: $19 once", "Claude for small business: all jobs", "All 49 paid servers: $39 once" | Colons in prose and headings (semicolon too). | "Get a free token first. No account, 30 days, 600 calls an hour." "Some features are Pro, and the server page lists..." "Invoice Pro, $19 once". "All jobs for small business". | site/src/components/LiveAnswerPage.astro; JobPage.astro |
| 23 | FIX | Spreadsheet pages (create-xlsx, read-excel Cursor, create-excel-files, edit-excel use case) | free table "Read files up to 5 MB" | /can-claude/read-excel-files/ says the hosted server holds 2 MB per token (sheet_unload "2 MB cap"). | Add "Hosted: up to 2 MB of loaded sheets per token." to the free column. | pages.json / pricing source for Spreadsheet free table |

## Compared with gate.md
All 40 earlier rows render as fixed. New BLOCKs come from the hosted-only limits the first gate checked on A pages but not on B/job examples (#3 to #6, #8), one stale claim the first gate did not test (#7 memory), one Cursor fact (#9), and native-block contradictions (#10). The tell-the-time page the first gate left open is now correct.

## Fixes applied
Commit on s1105 in ~/mcp-site-2026-10-30/repo, 2026-11-05. Not pushed or deployed. Local astro build in a scratch copy, exit 0, 253 pages, 0 warnings.

| # | Done | Where |
|---|------|-------|
| 1 | Answer and FAQ now say the hosted path resizes, crops, compresses and converts. Watermark is local install only. Native line added. | can-claude-live.json edit-images |
| 2 | "(Pro)" added to the refresh-all line | can-claude-live.json track-prices needs[2] |
| 3 | edit-photos with_tool says watermarks need a local install. Shared Image case 1 is now batch resize plus strip metadata. Free and Pro watermark rows say "(local install)". | jobs.json, a.json image |
| 4 | receipt_attach step dropped from the expense case. FAQ reworded as given. Free row says receipts on a local install. | a.json expense-tracker |
| 5, 6 | zip_bundle_month case replaced with a hosted zip_create plus zip_list case of uploaded files. read-zip-files with_tool says the monthly bundle is local install. ChatGPT zip-files own example no longer packs a local folder. | b.json zip, jobs.json |
| 7 | Memory and Projects sentence, no invoice counter | jobs.json make-a-pdf without_tool |
| 8 | Example is now pdf_stamp (PAID preset, no Pro colour) plus pdf_count | jobs.json make-a-pdf example |
| 9 | Title "Yes, two ways", answer, intro, meta and without_tool as given | pages.json, jobs.json can-cursor/read-pdf |
| 10 | native[1] and needs[0] as given | can-claude-live.json read-excel-files |
| 11 | FAQ says reorders on Pro | can-claude-live.json edit-pdfs |
| 12 | One sandbox or upload line added to native on edit-pdfs, generate-qr-codes, make-barcodes, zip-files, edit-images, find-free-time-in-my-calendar | can-claude-live.json |
| 13 | New optional meta_description field (LiveAnswerPage, canClaudeLive.ts) set on make-barcodes, edit-word-documents and the UV page. Brand tagline dropped from Layout FILLERS. Short leads now add the server tagline before fillers, so no /can-claude/ meta is under 110 chars. | Layout.astro, LiveAnswerPage.astro |
| 14 | after_case upsell shows only when a page's server has Pro | JobPage.astro |
| 15 | Shared Spreadsheet, Resume and PDF cases use "(uploaded)" wording, no local paths | b.json |
| 16, 17, 18 | Titles as given. QR answer and meta say "often". Zip answer, intro and meta say "Usually". Cursor Word intro, answer, meta and without_tool (python-docx) aligned. | pages.json, jobs.json |
| 19 | Path locally, one-hour link on the hosted URL | jobs.json make-a-pdf, merge-pdf-in-claude |
| 20 | Watermark "on a local install" | jobs.json resize-and-compress-images |
| 21 | Answer as given | can-claude-live.json find-recurring-subscriptions |
| 22 | Colons and the semicolon removed from token line, free FAQ, "more prompts" line, "Pro, $19 once", sticky bars, "All jobs on the ... page" | LiveAnswerPage.astro, JobPage.astro |
| 23 | Free column adds "Hosted, up to 2 MB of loaded sheets per token" | b.json spreadsheet |

Also fixed with the memory ground truth. create-invoice-in-claude and track-billable-time-in-claude no longer say Claude cannot remember between chats. find-free-time-in-my-calendar no longer says Claude starts again in the next chat.

Satellite pages. Every example result matches calls/sat/*.json word for word. Census title cut to 58 chars and "does not get the lookup result" narrowed to "a search result does not run the lookup for your address". Drug page "every week" narrowed. Drug FAQ no longer answers "No" to a medicine question and points to the pharmacist or prescriber. free-servers.json entries checked, no change needed.

Left open. JobCard.astro label "You get: <output>" keeps its colon (UI label, not in a regate row). Colons inside server results and older case data (tax result, mileage FAQ) are untouched.
