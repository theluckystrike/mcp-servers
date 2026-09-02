# mcp-invoice

Say "make an invoice for Acme, 12 hours at 90 EUR, due in 14 days" and get a real PDF you can send. This MCP server stores your business profile and your clients, allocates a sequential invoice number that is never reused, computes the subtotal, any discount, one tax line per VAT rate and the total in integer minor units, and renders an A4 PDF with your issuer and payment details, a wrapping item table and a proper totals block. It also tracks payments and, on Pro, reports what is overdue and by how many days. Everything is stored in plain JSON files on your own machine; nothing is uploaded anywhere.

## Install

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "invoice": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-invoice"]
    }
  }
}
```

Claude Code:

```sh
claude mcp add invoice -- npx -y @theluckystrike/mcp-invoice
```

Cursor (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "invoice": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-invoice"]
    }
  }
}
```

With a Pro key, add `"env": { "MCP_LICENSE_KEY": "MCPL1...." }` or just run `license_activate` once.

## Tools

| Tool | What it does |
| --- | --- |
| `business_set` | Store the issuer profile: name, address, email, VAT id, IBAN, bank, logo, default currency, default tax rate, payment terms, invoice prefix |
| `client_add` | Add or update a client (name, address, email, VAT id) |
| `client_list` | List stored clients with their ids |
| `invoice_create` | Create an invoice from line items; allocates the next number, computes discount, tax per rate and total. If the client is created from a bare name the response says the BILL TO block has no address and how to add one |
| `invoice_from_hours` | Shortcut: bill one client for N hours at an hourly rate |
| `invoice_list` | List invoices, filtered by status, client and issue-date range |
| `invoice_get` | Full stored record for one invoice number |
| `invoice_mark_paid` | Record a payment in full or in part; reports the balance due |
| `invoice_pdf` | Render the A4 PDF and return the file path |
| `overdue_report` | Unpaid invoices past due, days overdue, outstanding totals per currency. Free |
| `license_status` | Show free or Pro mode |
| `license_activate` | Activate a Pro key (verified offline) |

Resource: `invoices://open` returns every unpaid or partly paid invoice as JSON.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Invoices | 3 per calendar month | Unlimited |
| `overdue_report` | Yes, unlimited | Yes, unlimited |
| PDF | Carries the line "Generated with mcp-invoice by theluckystrike" | No branding |
| Logo on the PDF | No | Yes |
| Custom invoice prefix | No, fixed `INV` | Yes |
| Clients, tax lines, discounts, payments, multi-currency | Yes | Yes |

Pro is a one-time $19, or $39 for every server in the collection, lifetime.

**Get Pro: https://mcp.zovo.one/buy/invoice**

## Numbers and money

Invoice numbers are `PREFIX-YYYY-NNNN`. The counter is persisted per prefix and year and is written before the invoice is stored, so a crash burns a number rather than reusing one; existing numbers are also scanned so a restored data file can never hand back a number that is already on a sent document.

Every money value printed anywhere - line unit prices, line amounts, subtotal, discount, each tax line, the total and the balance due, in the text response and on the PDF - carries its currency code, for example `EUR 1080.00`. No amount is ever shown as a bare number.

All amounts are held as integer minor units (cents, or whole yen for zero-decimal currencies such as JPY). Rounding is per line, then summed: each line's gross is rounded first, an invoice-level `discount_percent` is applied and rounded per line, tax is computed and rounded per line and then grouped into one line per rate, and the totals are plain integer sums of those already-rounded values. A printed total can therefore never disagree with the printed lines. Dates are ISO `YYYY-MM-DD`.

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/invoice/`. There are no network calls: license keys are verified offline with a public key compiled into the package, and PDFs are rendered on your machine.

Built by [theluckystrike](https://github.com/theluckystrike).
