# barcode - contract spec

Written in the shape `scripts/gen-spec.mjs` emits; the tool table below was read off the built server
over stdio (`initialize`, `tools/list`), not off `src`. This server is not yet in the generator's list.

| | |
| --- | --- |
| package | `@theluckystrike/mcp-barcode` |
| version | 0.7.0 |
| bin | `mcp-barcode` |
| serverInfo.name | `mcp-barcode` |
| transport | stdio, JSON-RPC 2.0 |
| tools | 10 |
| resources | 0 |
| prompts | 0 |

## What it does

QR codes and linear barcodes, drawn locally with no network call of any kind: a URL or text, a WiFi join,
a vCard, an EPC069-12 SEPA payment code a euro banking app can scan, and Code 128, EAN-13, EAN-8 and
UPC-A. Output is SVG (free, returned inline or written to out_path) or PNG (Pro, any size up to 4000 px).
Every code is recorded in a local register under the data directory.

## Tools (10)

| tool | description |
| --- | --- |
| `barcode_batch` | Call this tool to draw many barcodes or QR codes at once from a list of rows, each with its own value and file name, into out_dir. Pro; the free tier does one code per call. |
| `barcode_create` | Call this tool to draw a linear barcode (code128, ean13, ean8, upca) as SVG or PNG. A short EAN or UPC gets its check digit computed; a wrong one is refused, never redrawn. |
| `code_list` | List the codes this server generated, newest first, with what each one carried and where it was written, plus how many of this month's free allowance are left. |
| `invoice_payment_qr` | Call this tool to make the payment QR code for an invoice: your IBAN and name come from the shared business profile, the amount and reference from invoice_id or from the arguments. |
| `license_activate` | Activate a Pro license key (format MCPL1.xxx.yyy). Verified offline and saved locally. |
| `license_status` | Show whether this server runs in free or Pro mode and where to upgrade. |
| `qr_create` | Call this tool to turn text or a URL into a QR code, as an SVG returned inline or written to out_path, or as a PNG at a chosen pixel size (Pro). |
| `qr_payment_sepa` | Call this tool to make an EPC069-12 payment QR code a euro banking app can scan: IBAN, beneficiary name, optional amount and reference. The IBAN is checked before drawing. |
| `qr_vcard` | Call this tool to make a QR code that adds a contact when scanned (vCard 3.0: name, org, phone, email, URL, address), written to out_path or returned as SVG. |
| `qr_wifi` | Call this tool to make a QR code that joins a WiFi network when scanned: network name, password and security type, written to out_path or returned as SVG. |

## Shared arguments

Every drawing tool takes `format` (`svg` default, `png` Pro), `out_path`, `overwrite`, and the QR tools take
`error_correction` (`L`, `M` default, `Q`, `H`), `size` (PNG pixels, 32 to 4000, default 300) and `margin`
(quiet zone in modules, default 4). The linear tools take `module_width` (1 to 20, default 2), `height`
(10 to 1000, default 80) and `text` (print the digits, default true).

## Invariants

1. **stdout carries JSON-RPC and nothing else.** `console.*` is redirected to stderr and any non-protocol
   write to stdout is diverted, so a dependency that prints cannot break the transport.
2. **A tier limit is an answer, not a protocol error.** Free-tier refusals return `isError: false` with the
   upgrade text; malformed input returns `isError: true`.
3. **Nothing is half-written.** `out_path` is checked (directory, missing parent, wrong extension, existing
   file without `overwrite`) before anything is encoded, and the file itself is written tmp + rename.
4. **A check digit is never silently corrected.** A full-length EAN, EAN-8 or UPC-A with a wrong check digit
   is refused, with the correct digit named. A short code has its check digit computed.
5. **An IBAN is validated with ISO 7064 mod 97 before a payment code is drawn**, and a non-EUR currency on
   an EPC code is refused rather than encoded as euro.
6. **The register is the only counter.** The free monthly allowance is read from the register and the row is
   appended in the same critical section, so two processes on one data directory cannot both take the last slot.
7. **A corrupt register blocks reads and writes.** It is quarantined byte-for-byte as `codes.json.corrupt-<ts>`
   with a `.corrupt` marker beside it; it is never reported as "no codes yet".
8. **The version is one number**: `package.json`, the generated `src/version.ts`, `serverInfo.version`,
   `server.json` and `server.mcpb.json` agree (asserted in `test/contract.test.mjs`).

## Storage

`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/barcode/codes.json`, an array of records
(`id`, `kind`, `symbology`, `summary` truncated to 120 characters, `format`, `out_path`, `bytes`, `created`),
trimmed to the last 1000 rows. Lock directory `.lock` in the same directory.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Codes per calendar month | 20 | Unlimited |
| SVG output | Yes | Yes |
| PNG output | No | Yes, 32 to 4000 px |
| `barcode_batch` | No | Yes, up to 500 rows per call |
| All symbologies, EPC payment codes, WiFi, vCard | Yes | Yes |
