# mcp-pdf

Say "stamp PAID on that invoice and save a copy" or "pull pages 2 to 6 out of this scan and merge them with the contract" and it happens, on your machine, in a second. This MCP server does the small PDF jobs that otherwise send you to a web uploader: merge, split by page range, extract or reorder pages, rotate a sideways scan, stamp `PAID` or `DRAFT` or any text you like, put your business name and VAT id in the footer, count pages across a folder of files, and read a PDF's text back as text. No upload, no account, no native dependency, no office install.

![pdf demo](../../assets/demo-pdf.gif)

**The PDF chores of a freelance business, done from chat instead of from a browser tab you do not trust with an invoice.**

## 60-second install

npm publish for `@theluckystrike/mcp-pdf` is pending. Until then, the `.mcpb` one-click bundle or a clone+build
is the working path -- both are verified below.

**One-click (.mcpb):** download `pdf.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pdf": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-pdf"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add pdf -- npx -y @theluckystrike/mcp-pdf
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "pdf": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-pdf"]
    }
  }
}
```

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above, or
build from source with exactly these three commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/pdf
```

Then point your client's `command` at `node` with one arg: the absolute path to `servers/pdf/dist/index.js`.

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## Tools

| Tool | What it does |
| --- | --- |
| `pdf_info` | Page count, every page's size in points and millimetres, the paper name (A4, Letter, custom), the rotation already on each page, the metadata (title, author, producer, dates) and whether the file is encrypted |
| `pdf_count` | Page count per file plus the total, for any number of PDFs. A file it cannot read is reported per file; the rest still count |
| `pdf_merge` | Join PDFs into one, in the order given. Page sizes are kept as they are, and a merged file with mixed sizes says so |
| `pdf_split` | One new file per range. `"1-3,5,7-"` gives pages 1-3, page 5, and page 7 to the end. `out_path_pattern` takes `{n}`, `{range}` and `{name}` |
| `pdf_pages` | Extract selected pages into one new PDF, in the order you write them. `"5,1,1"` puts page 5 first and page 1 in twice |
| `pdf_rotate` | Turn pages by a multiple of 90 degrees, added to the rotation the page already had, which is what a sideways scan needs |
| `pdf_stamp` | Draw text on the pages: `PAID` and `DRAFT` presets, or any text, colour, position, opacity and size. Centre stamps go on the 45-degree diagonal |
| `pdf_watermark_business` | Your business name and VAT id in the footer of every page, from the shared profile [mcp-invoice](../invoice) and [mcp-docx](../docx) write |
| `pdf_text` | Best-effort text extraction from the page content streams. See the honest caveats below |
| `pdf_reorder` | Write a new PDF with the pages in a new order. The order must name every page exactly once, so nothing is dropped by accident |
| `license_status` | Show free or Pro mode |
| `license_activate` | Activate a Pro key (verified offline) |

Resource: `pdf://recent` returns the last 25 operations, newest first, with the inputs, the files written and when.
Prompt: `mark_invoice_paid` chains [mcp-invoice](../invoice)'s `invoice_get` into `pdf_stamp PAID` and saves the stamped copy beside the original.

## What you can say

| You say | Tool |
| --- | --- |
| "Mark invoice INV-2026-0007 as paid." | `mark_invoice_paid` prompt, then `pdf_stamp` |
| "Stamp DRAFT across this contract before I send it." | `pdf_stamp` |
| "Join these three PDFs into one file." | `pdf_merge` |
| "Split the scan: pages 1-3 are the invoice, 4 onwards is the receipt." | `pdf_split` |
| "Pull pages 2 to 6 out of this and save them separately." | `pdf_pages` |
| "This scan is sideways, turn it." | `pdf_rotate` |
| "How many pages are in all of these?" | `pdf_count` |
| "What does page 1 of this PDF say?" | `pdf_text` |
| "Put my company name and VAT number in the footer." | `pdf_watermark_business` |
| "Move the cover page to the front." | `pdf_reorder` |

## Worked example

```
You: Stamp PAID on ~/invoices/INV-2026-0007.pdf and save a copy.

  pdf_stamp {
    path: "~/invoices/INV-2026-0007.pdf",
    text: "PAID",
    position: "center",
    out_path: "~/invoices/INV-2026-0007-paid.pdf"
  }
  -> Stamped "PAID" on 1 page
  -> ~/invoices/INV-2026-0007-paid.pdf, 0.9 MB
```

The stamp is drawn text, not a flattened image: it can be selected and searched, it is drawn on the 45-degree
diagonal in the preset green, and the original file is byte-for-byte unchanged.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| `pdf_info`, `pdf_count`, `pdf_text` | Unlimited | Unlimited |
| `pdf_merge` | Up to 5 files per call | Any number of files |
| `pdf_split`, `pdf_pages`, `pdf_rotate` | Files up to 30 pages | Any length |
| `pdf_stamp` | The `PAID` and `DRAFT` presets in their preset colours | Any text, any colour, any size |
| `pdf_watermark_business` | - | Your business name and VAT id in the footer |
| `pdf_reorder` | - | Yes |

A tier limit is an answer, not an error, and nothing is written when one refuses a call.

Pro is a one-time $19, or $39 for every server in the collection, lifetime.

**Get Pro: https://mcp.zovo.one/buy/pdf**

## `pdf_text` is best effort, and here is exactly what that means

A PDF does not store text. It stores drawing operators, and the text you see is bytes handed to a font. This server
decompresses each page's FlateDecode content stream with `node:zlib` and reads the four text-showing operators --
`Tj`, `TJ`, `'` and `"` -- plus the positioning operators that end a line. That is a parser written here, in about
two hundred lines, with no `pdfjs` and no native module, and it has three real limits the tool states in its own
answer every time:

- **A scan has no text.** An image-only page carries no text operators, so nothing comes back. There is no OCR here
  and there will not be one; the answer says the page is probably a scan rather than returning an empty string with
  no explanation.
- **A custom or CID encoding returns glyph indices, not letters.** Subset-embedded and CJK fonts map bytes to glyph
  numbers through a table this parser does not read. When the output has no readable characters, the answer says the
  font is the reason.
- **Reading order is drawing order.** There is no column detection and no layout reconstruction. Word spaces are
  recovered from the large negative kerns a `TJ` array uses for them, so a PDF that positions every word separately
  can come back with words run together.

PDFs written by word processors, invoicing tools and report generators -- everything with a standard or fully
embedded font -- read back cleanly. Anything else tells you why it did not.

## Encrypted PDFs are refused, not guessed

`pdf-lib` cannot decrypt, and loading an encrypted file while ignoring the encryption produces pages of garbage that
would be written straight into the output. So a file whose trailer names an `/Encrypt` dictionary is refused by every
tool that writes, with the reason and the fix in the message: open it in a reader with the password, export or print
to a new PDF, and use that file. `pdf_info` still answers, with `encrypted: true`, because reporting is its whole job,
and `pdf_count` reports it as one unreadable file while still counting the rest.

## Existing files are never overwritten, and inputs are never modified

Every tool writes a new file and leaves its inputs byte-for-byte alone -- there is no in-place mode, on purpose.
An `out_path` that already exists is refused:

```
Error: /path/merged.pdf already exists and nothing was written.
Pass overwrite: true to replace it, or give a different out_path.
```

The path is reserved with an exclusive create, not an existence check, so two processes writing the same `out_path`
at the same time cannot clobber each other: one wins, the other is refused and writes nothing. `pdf_split` reserves
every one of its output paths before it writes any of them, so a collision on part 3 does not leave parts 1 and 2
behind as a half-done split -- and the reservations are released, so nothing empty is left on disk either.

Pass `overwrite: true` when replacing the file is what you want.

`overwrite: true` still does not let an output be an input. Writing the result of an operation back over one of its
own sources destroys that source -- the pages are already in memory and get written over the file they came from,
which takes a three-page file to the one page you extracted -- and every later read of that path is then quietly
wrong. So an `out_path` that resolves to (or shares an inode with) any input of the same call is refused before any
work happens:

```
Error: out_path /path/scan.pdf is also an input of this operation, so writing it would destroy the source.
Nothing was written. Write beside it instead - /path/scan-out.pdf - and, if the result really is meant to
take the original's place, rename it yourself once you have checked it.
```

## Limits

- Inputs over 100 MB are refused: rewriting a PDF needs several times its size in memory.
- A file that does not start with `%PDF-` is refused before anything is read.
- Rotation is recorded as page metadata, in multiples of 90 degrees, which is all the format has. Nothing is redrawn.
- Stamp text goes through a built-in PDF font, which carries WinAnsi and its 256 code points. A character outside it
  is transliterated where it has an obvious Latin body -- Polish `OPŁACONE` stamps as `OPLACONE`, and the answer says
  so and prints what was actually drawn -- and removed and counted where it does not, so there is no CJK stamp. A
  newline is a word separator, never a deletion.
- `font_size` must be between 1 and 1600 points. A stamp too long to fit even at the smallest size this server will
  use is still drawn, and the answer says how far past the edge it runs, so you can shorten it.
- `pdf_text` caps one answer at 200,000 characters and names the `pages` argument that continues from where it
  stopped. Nothing is missing from the file; the cut is in the answer, not the read.
- No page numbering, no signatures, no redaction, no compression. This server does the page-level jobs; it is not a
  PDF editor. It does not *write* PDF/A: `pdf_info` reports a file's own `pdfa_claim`, and every tool that writes
  says plainly that its output no longer holds that claim.
- Forms are read, not filled: `pdf_text` prints the AcroForm field values, which live in the fields rather than in
  the page content stream and are therefore not part of the page text.
- No OCR. See the `pdf_text` section.

## How it stores data

Only a register of what it did: `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/pdf/operations.json`, the last 500
operations, as plain JSON. Your PDFs stay where you put them. Every write to the register runs inside an advisory
lock on `.../pdf/.lock`, so two clients on one data directory cannot lose a record, and saves go to a temporary file
and are renamed into place.

If the register is unreadable or not valid JSON it is never treated as "empty": it is moved aside byte-for-byte as
`operations.json.corrupt-<timestamp>` with a marker beside it. The PDF you asked for is still written -- the file is
on disk before the register is touched -- and the answer tells you the history could not be updated.

The business footer reads the one shared profile the whole suite uses,
`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/profile/business.json`, written by `business_set` in mcp-invoice or
mcp-docx. Nothing is invented: with no name stored, `pdf_watermark_business` refuses and says which tool to run.

## Privacy

All data stays local. The server reads and writes files on your machine and makes no network request of any kind --
not for licensing (keys are verified offline), not for fonts, not for telemetry. A PDF you stamp is never uploaded
anywhere, which is the entire reason this exists.

## Pairs with

- [mcp-invoice](../invoice/README.md) -- the invoice you sent, stamped PAID: the `mark_invoice_paid` prompt chains `invoice_get` into `pdf_stamp`.
- [mcp-docx](../docx/README.md) -- write the proposal as `.docx`, print it to PDF, then stamp, merge or split it here.
- [mcp-resume](../resume/README.md) -- join a CV, a cover letter and a portfolio into the one file an application form accepts.
- [office-suite](../office-suite/README.md) -- several servers behind one install, one config entry.

## Troubleshooting

- **`npx` hangs or fails to find the package**: npm publish for this package is pending. Use the `.mcpb` bundle or the
  clone-and-build path above until it lands.
- **"is encrypted and was refused"**: the file is password or permissions protected. Open it in a PDF reader, export
  or print to a new PDF, and run the tool on that copy. This server never guesses or strips a password.
- **`pdf_text` returned nothing**: the page is a scan, or its font uses a custom encoding. The answer says which.
  There is no OCR here.
- **The stamp is too small or too big**: by default it is sized to fit the page width. Pass `font_size` for an exact
  point size, and `opacity` between 0 and 1.
- **"already exists and nothing was written"**: pass `overwrite: true`, or a different `out_path`.
- **Node version**: requires Node >= 18. Check with `node -v`.

MIT licensed. Support: support@zovo.one

Built by [theluckystrike](https://github.com/theluckystrike).
