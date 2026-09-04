# mcp-barcode

Make a QR code or a barcode in the conversation you are already in. Paste a URL and get a QR code you can put on a
flyer. Give a client's invoice an EPC payment code their banking app scans and fills in for them. Print an EAN-13
for a product, a Code 128 for a shelf label, a WiFi code for the office wall, a vCard for a conference badge.
Everything is drawn on your machine: no upload, no account, no API key, and no network call of any kind.

![barcode demo](../../assets/demo-barcode.gif)

## Install

Claude Desktop, `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "barcode": { "command": "npx", "args": ["-y", "@theluckystrike/mcp-barcode"] }
  }
}
```

Claude Code:

```sh
claude mcp add barcode -- npx -y @theluckystrike/mcp-barcode
```

Cursor, `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "barcode": { "command": "npx", "args": ["-y", "@theluckystrike/mcp-barcode"] }
  }
}
```

## Tools

| tool | what it does |
| --- | --- |
| `qr_create` | Text or a URL as a QR code, at any error correction level, SVG or PNG |
| `qr_wifi` | A code that joins a WiFi network when scanned |
| `qr_vcard` | A code that adds a contact (vCard 3.0) |
| `qr_payment_sepa` | An EPC069-12 payment code a euro banking app scans: IBAN, name, amount, reference |
| `invoice_payment_qr` | The payment code for an invoice, using the IBAN and name from your shared business profile |
| `barcode_create` | Code 128, EAN-13, EAN-8 or UPC-A, with the check digit computed or verified |
| `barcode_batch` | Many codes in one call, into a directory (Pro) |
| `code_list` | What you have generated, and how much of this month's free allowance is left |
| `license_status`, `license_activate` | Free or Pro, and activating a key |

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Codes per calendar month | 20 | Unlimited |
| SVG (prints at any size) | Yes | Yes |
| PNG | No | Yes, 32 to 4000 px |
| `barcode_batch` | No | Yes, up to 500 rows a call |
| QR, WiFi, vCard, SEPA payment codes, all four barcode symbologies | Yes | Yes |

Get Pro: **https://mcp.zovo.one/buy/barcode** - $19 one time, or $39 for every server in the suite, lifetime.
Keys verify offline; nothing is sent anywhere.

## A wrong check digit is refused, not redrawn

Give `barcode_create` twelve digits and the thirteenth is computed for you. Give it thirteen and the thirteenth is
*checked*:

```
Error: EAN-13 check digit is wrong: "5901234123450" ends in 0, but the first 12 digits give 7.
Pass 5901234123457, or pass the first 12 digits and the check digit is computed. Nothing was written.
```

The alternative, silently redrawing the code the caller asked for, prints a label that scans as a different
product, and nobody finds out until the till. The same rule applies to the IBAN in a payment code: it is
validated with ISO 7064 mod 97 before anything is drawn, so a transposed pair of digits is caught here rather
than by a payment that goes nowhere.

## Measured: error correction M is free on a SEPA payment code, Q and H are not

A typical EPC payment record (IBAN, beneficiary, EUR 120.50, an invoice number) is 73 bytes. QR codes come in
fixed capacity steps, so raising the error correction level does not raise the code size smoothly:

| level | recoverable | QR version | modules a side | change |
| --- | --- | --- | --- | --- |
| L | 7% | 4 | 33 | baseline |
| M | 15% | 4 | 33 | **no change at all** |
| Q | 25% | 6 | 41 | +24% |
| H | 30% | 7 | 45 | +36% |

L and M land in the same version 4 symbol: at this payload size the extra recovery data still fits in the same
box, so choosing L over M buys nothing and gives up half the damage tolerance. That is why `M` is the default
here. Q and H are worth asking for only when the code will be printed small, on something that creases, or
behind a logo. On a 300 px PNG the same step costs bytes too: 2,419 at M against 3,462 at H.

## Measured: SVG is flat, PNG grows 14x, and they cross at about 200 px

The same payment code written both ways, at five sizes:

| requested size | PNG bytes | SVG bytes |
| --- | --- | --- |
| 128 px | 1,481 | 2,079 |
| 256 px | 2,186 | 2,079 |
| 512 px | 3,589 | 2,079 |
| 1024 px | 7,585 | 2,081 |
| 2048 px | 21,688 | 2,081 |

An SVG carries the module grid, not the pixels, so its size barely moves: the two extra bytes at 1024 px are the
width attribute getting longer. Below roughly 200 px a PNG is smaller; above it the PNG grows without limit and
the SVG does not, and the SVG is the one that stays sharp when a printer scales it up. That is the reason the
free tier is the SVG tier rather than a small-PNG tier: for the thing most people do with a code, put it in a
document and print it, SVG is the better file, not the consolation prize.

## Privacy

Everything stays on your machine. There is no network code in this server at all: no `fetch`, no HTTP client,
no telemetry. Codes are written where you say, and a small register of what was generated lives under
`~/.local/share/mcp-servers/barcode/` (or `$XDG_DATA_HOME`). License keys verify offline with a public key.

Built by [theluckystrike](https://github.com/theluckystrike). Support: support@zovo.one
