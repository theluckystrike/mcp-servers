# mcp-docx

Say "write a proposal for Beta Corp, checkout rebuild, 4,500 EUR, three phases" and get a real `.docx` you can send. This MCP server writes Word documents from chat -- proposals, quotes, service agreements, statements of work and letters -- with your letterhead, headings, bullet and numbered lists and tables. It also turns markdown into `.docx`, reads an existing `.docx` back as text and outline, and fills `{{placeholders}}` in a template you already use, keeping every style, table, header and image of the original. Everything runs locally: no upload, no account, no native dependency.

![docx demo](../../assets/demo-docx.gif)

**Real Word documents from chat -- proposals, contracts and letters, without a template site or an office subscription.**

## 60-second install

npm publish for `@theluckystrike/mcp-docx` is pending. Until then, the `.mcpb` one-click bundle or a clone+build
is the working path -- both are verified below.

**One-click (.mcpb):** download `docx.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "docx": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-docx"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add docx -- npx -y @theluckystrike/mcp-docx
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "docx": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-docx"]
    }
  }
}
```

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above, or
build from source with exactly these three commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/docx
```

Then point your client's `command` at `node` with one arg: the absolute path to `servers/docx/dist/index.js`.

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## Tools

| Tool | What it does |
| --- | --- |
| `business_set` | Store the sender profile printed on every document: name, address, email, VAT id, IBAN, bank, logo, letterhead colour, default currency, tax rate, payment terms. Same field set as [mcp-invoice](../invoice), so one profile serves both |
| `doc_create` | Write a `.docx` from sections: headings, paragraphs, bullet lists, numbered lists and tables. Layouts: `plain`, `letter` (sender block, date, addressee) and `proposal` (letterhead band, cover title) |
| `doc_from_markdown` | Markdown to `.docx`: ATX headings, paragraphs, bullet and numbered lists (indentation kept, up to Word's nine levels), GFM pipe tables, fenced code blocks as monospace, and `**bold**` / `*italic*` / `` `code` `` inline |
| `doc_read` | Extract text, headings with levels, list items and tables from any existing `.docx`, in document order. `format: "json"` returns the block structure |
| `doc_to_html` | Convert a `.docx` to semantic HTML with a print stylesheet. This is the PDF route -- see the note below |
| `doc_fill_template` | Replace `{{placeholders}}` in a `.docx` and write a new file, keeping every style, table, header, footer and image. Called with no `values`, it lists the placeholders the template contains |
| `proposal_create` | A client-ready proposal: summary, scope, deliverables, timeline table, price, terms, validity and signature block, with a reference number that is never reused |
| `proposal_update` | Rewrite an existing proposal in place from its reference: only the fields you pass change, the rest comes from the structured data stored with the document, and the file and reference number stay the same |
| `contract_create` | A plain freelance service agreement skeleton: parties, services, term, fee, IP, confidentiality, contractor status, termination, liability, governing law. A template with labelled placeholders for a lawyer, not legal advice |
| `license_status` | Show free or Pro mode |
| `license_activate` | Activate a Pro key (verified offline) |

Resource: `docs://recent` returns the last 25 documents written, newest first, with kind, client, reference and path.
Prompt: `write_proposal_from_hours` turns tracked hours (or an `invoice_summary` from [mcp-time-tracker](../time-tracker)) into a priced proposal.

## There is no `doc_to_pdf`, and that is deliberate

Every pure-JavaScript path from Word to PDF needs either a native dependency (LibreOffice, a Chromium binary, a C++ rendering library) or a cloud API. This collection ships neither, so `npx` works on any machine with Node and nothing else. `doc_to_html` writes semantic HTML with a print stylesheet instead: open it, print to PDF, and the result is what you would have got. The tool description and the tool's own answer say the same thing, so the model does not promise a PDF it cannot produce.

## What you can say

| You say | Tool |
| --- | --- |
| "Set up my letterhead: Acme Consulting, 1 Road Warsaw, VAT PL1234567890." | `business_set` |
| "Write a proposal for Beta Corp: checkout rebuild, 4,500 EUR, 50/50, three phases." | `proposal_create` |
| "Draft a service agreement with Beta Corp, 3,000 EUR monthly, starting October." | `contract_create` |
| "Turn these meeting notes into a Word document." | `doc_from_markdown` |
| "Write a letter to Beta Corp with an agenda for Tuesday." | `doc_create` with `style: "letter"` |
| "What does this proposal.docx actually say?" | `doc_read` |
| "Fill my NDA template with this client's details." | `doc_fill_template` |
| "Give me a printable version of that document." | `doc_to_html` |

## Worked example

```
You: Write a proposal for Beta Corp. Checkout rebuild, 4,500 EUR, 50% on
signature 50% on delivery, three phases: discovery 1 week, build 3 weeks,
launch 1 week. Valid until the end of the year.

  proposal_create {
    client: "Beta Corp", project_title: "Checkout rebuild",
    summary: "Beta Corp loses orders at checkout. This project rebuilds it.",
    scope: ["Audit the current funnel", "Rebuild the checkout", "Ship and measure"],
    deliverables: ["New checkout in production", "A one-page handover"],
    timeline: [{phase: "Discovery", duration: "1 week"},
               {phase: "Build", duration: "3 weeks"},
               {phase: "Launch", duration: "1 week"}],
    price: {amount: 4500, currency: "EUR", terms: "50% on signature, 50% on delivery"},
    valid_until: "2026-12-31"
  }
  -> PROP-2026-0001, EUR 4,500.00
  -> ~/.local/share/mcp-servers/docx/documents/checkout-rebuild.docx
```

The file opens in Word, Pages, LibreOffice and Google Docs: letterhead, cover title, "Prepared for Beta Corp",
Summary, Scope of work, Deliverables, a Timeline table, an Investment table with `EUR 4,500.00`, the payment
terms, and a signature block for both parties. Every amount carries its currency code -- no bare numbers.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| `doc_create`, `doc_from_markdown`, `doc_read`, `doc_to_html` | Unlimited | Unlimited |
| `proposal_create`, `contract_create` | 3 per calendar month, combined | Unlimited |
| `doc_fill_template` | Templates with up to 10 placeholders | Any template |
| Footer | Carries "Generated with mcp-docx by theluckystrike" | No branding |
| Letterhead logo and colour | Default colour, no logo | Your `logo_path` and `brand_color` |
| Tables, lists, letter and proposal layouts, reference numbering | Yes | Yes |

Pro is a one-time $19, or $39 for every server in the collection, lifetime.

**Get Pro: https://mcp.zovo.one/buy/docx**

## How the .docx is produced and read

Documents are written with [`docx`](https://www.npmjs.com/package/docx), a pure-JavaScript OOXML writer -- no native module, no headless browser, no office install.

Reading and template filling use no dependency at all. A `.docx` is a ZIP, so `node:zlib` opens it and a small WordprocessingML walk pulls out paragraphs, heading levels (from `w:pStyle`), list items and tables in document order. Numbered lists are told apart from bullets by resolving each paragraph's `w:numId` against `word/numbering.xml`, which is the only place that distinction is recorded -- without it every numbered list reads back as bullets.

Template filling substitutes on the **joined text of each paragraph**, not per run. Word routinely breaks a placeholder you typed as `{{client}}` into three runs (`{{cli`, `ent}}`, ...) after an edit or a spell-check pass, and per-run replacement silently misses those -- the document comes back with the placeholder still in it. The replaced text goes into the first run, keeping its formatting, and the remaining runs of that paragraph are blanked. Every other part of the package is copied byte-for-byte, so styles, images, headers, footers and section setup survive. A placeholder with no value is left in place and reported, never blanked.

## Existing files are never overwritten

Every tool that writes a file (`doc_create`, `doc_from_markdown`, `doc_to_html`, `doc_fill_template`,
`proposal_create`, `contract_create`) refuses an `out_path` that already exists and tells you so:

```
Error: /path/acme-proposal.docx already exists and nothing was written.
Pass overwrite: true to replace it, or give a different out_path.
```

The path is reserved with an exclusive create, not an existence check, so two processes writing the same
`out_path` at the same time cannot clobber each other: one wins, the other is refused and writes nothing.

When you do not pass an `out_path`, the file name is derived from the title, and a derived path never
lands on an earlier document: a second proposal with the same title is written as `...-2.docx`. To change
a proposal you already sent, use `proposal_update {reference}` instead: it rewrites the same file from the
stored structured data and keeps the reference number.

The check runs before anything is built or written, so a refused call leaves the disk untouched and burns
no reference number. Pass `overwrite: true` when replacing the file is what you want.

## Characters Word cannot carry

XML 1.0 allows TAB, LF and CR but no other control code. Every string that reaches `word/document.xml`
is cleaned first: control codes and unpaired surrogates are removed, literal `\n` escapes become real
paragraph breaks, and stray whitespace collapses. When something was removed the tool says so in its
answer instead of handing you a file Word would offer to repair.

## How it stores data

The business profile, the document register and the reference counter live under
`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/docx/` as plain JSON, plus a `documents/` subfolder holding the
generated files when you do not pass `out_path`. Every mutating call runs inside an advisory lock on
`.../docx/.lock`, so two clients on one data directory cannot allocate the same reference number or lose a
record. Saves go to a temporary file and are renamed into place.

If one of those JSON files is unreadable or not valid JSON, it is never treated as "empty". The file is moved
aside byte-for-byte as `<name>.json.corrupt-<timestamp>`, a `<name>.json.corrupt` marker is written, and every
tool returns `data file is corrupt; moved to ...; nothing was written` until you restore a good copy and delete
the marker.

Reference numbers are `PROP-YYYY-NNNN` for proposals and `AGR-YYYY-NNNN` for agreements. The counter is written
before the record is stored, so a crash burns a number rather than reusing one, and existing numbers are scanned
so a restored register can never hand back a reference that is already on a sent document.

## Limits and honest caveats

- No PDF output. Use `doc_to_html` and print. See the section above for why.
- `doc_read` reads `.docx` only. Legacy `.doc`, `.rtf` and Pages files are refused with a message that says so.
- `doc_read` extracts text structure: headings, paragraphs, lists and tables. It does not report fonts, colours,
  comments, tracked changes, footnotes or embedded images.
- `doc_fill_template` keeps the first run's formatting for the whole paragraph it rewrites. A paragraph that mixes
  bold and regular text around a placeholder comes back in the first run's formatting.
- `contract_create` writes a drafting skeleton with `[BRACKETED PLACEHOLDERS]` and says on the document itself that
  it is a template and not legal advice. Nothing here has been reviewed by a lawyer in any jurisdiction.
- The free-tier limit of 3 counts proposals and contracts together, per calendar month, and resets on the 1st.
  Everything else stays unlimited when it closes.

## Privacy

All data stays local. The server reads and writes files on your machine, stores its register under your data
directory, and makes no network request of any kind -- not for licensing (keys are verified offline), not for
fonts, not for telemetry.

## Pairs with

- [mcp-invoice](../invoice/README.md) -- same `business_set` profile shape; the proposal you accepted becomes the invoice you send.
- [mcp-time-tracker](../time-tracker/README.md) -- the `write_proposal_from_hours` prompt turns `invoice_summary` hours into a priced proposal.
- [mcp-expense-tracker](../expense-tracker/README.md) -- quote a project with its pass-through costs already counted.
- [office-suite](../office-suite/README.md) -- several servers behind one install, one config entry.

## Troubleshooting

- **`npx` hangs or fails to find the package**: npm publish for this package is pending. Use the `.mcpb` bundle or
  the clone-and-build path above until it lands.
- **"Wrote ... .docx" but Word will not open it**: check the path is not inside a synced folder that was still
  uploading. The file is complete when the tool returns; nothing is written incrementally.
- **A placeholder did not get replaced**: call `doc_fill_template` with no `values` to list what the template
  actually contains. Names are matched exactly, whitespace inside `{{ }}` is ignored, and the response names every
  key you passed that the template does not have.
- **The letterhead shows "Your business"**: run `business_set` once. Documents are never blocked by a missing
  profile; the response says the sender block is a placeholder.
- **No logo on the document**: the logo is a Pro feature, and `logo_path` must exist and be a PNG, JPG or GIF.
- **Node version**: requires Node >= 18. Check with `node -v`.

MIT licensed. Support: support@zovo.one

Built by [theluckystrike](https://github.com/theluckystrike).

## One business profile for the whole suite

Your identity is stored once, at `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/profile/business.json`,
and every server in the suite reads it: the invoice issuer, the docx letterhead, the recurring
issuer, expense-tracker's default VAT rate, time-tracker's and timezone's home zone, and the
resume and contract letterheads. Set it once with `business_set` (invoice or docx) - you never
repeat it anywhere else. An email address is only ever taken from that profile or from an explicit
argument; when none is stored, documents show `[add: email]` and the tool says so rather than
letting anyone improvise an address.
