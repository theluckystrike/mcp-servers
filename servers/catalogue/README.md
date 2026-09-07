# mcp-catalogue

One price list and one rate card, kept where the invoice and the quote can both read them.
Give a product a code, a name, a unit and a price in minor units, with the day that price
comes into force. Give a role an hourly rate the same way. Then hand the catalogue a list
of what a customer had, and it hands back the line items already priced: the quantity, the
description, the unit price and the VAT rate, in the exact argument shape `invoice_create`
takes and in the exact argument shape `quote_create` takes.

Nothing is invented and nothing is stored twice. A SKU holds its price ROWS, each with a
valid-from date; the price on a date is worked out on the call, so raising a price in July
does not rewrite what June's job was quoted at. An unknown code comes back as a refusal
naming the code, never as a guessed price.

npm publish for `@theluckystrike/mcp-catalogue` is pending, so `npx -y @theluckystrike/mcp-catalogue` returns 404 today. Until then, the `.mcpb` one-click bundle or a clone+build is the working path.

## Install

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "catalogue": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-catalogue"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add catalogue -- npx -y @theluckystrike/mcp-catalogue
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), same entry as Claude Desktop.

## Tools

| Tool | What it does |
| --- | --- |
| `sku_set` | Add a catalogue line or reprice one: code, name, unit, optional VAT rate, and a price in minor units for one currency, tier and valid-from date |
| `sku_get` | The price of one SKU as of a date, naming the row it came from and any later price already booked |
| `sku_list` | The catalogue with the price in force, filtered by code prefix, currency and tier |
| `sku_delete` | Delete a line raised by mistake. Only one nothing depends on. Free on every tier |
| `rate_set` | Set an hourly rate on a role's rate card, from the day it applies, optionally bound to a SKU |
| `rate_get` | The hourly rate for a role as of a date, or every rate card |
| `lines_resolve` | Price a list of sku and role lines into `invoice_create`-ready and `quote_create`-ready items |
| `price_list_text` | The price list as plain text: prices in force, valid-from dates, then the labour rates |
| `price_list_pdf` | The price list as an A4 PDF, per currency and tier |
| `catalogue_report` | SKUs, rows in force, rows a later row already replaces, rows with no price in the default currency |
| `license_status` / `license_activate` | Free or Pro, and where to upgrade |

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| SKUs in the catalogue | 25 | unlimited |
| Price rows per SKU | 100 | 100 |
| Rate cards | unlimited | unlimited |
| Set, price, list, resolve lines | yes | yes |
| Price list (text) | yes | yes |
| Delete an unused SKU | yes | yes |
| Price tiers beyond `standard` | no | yes |
| Price list (PDF) | no | yes |
| Catalogue report | no | yes |

Get Pro: https://mcp.zovo.one/buy/catalogue ($19 one-time for this server, $39 for all of
them, lifetime). Keys are verified offline; nothing is sent anywhere.

## Where the price comes from

A price row is `(currency, tier, valid_from, amount)`. The price on a date is the latest
`valid_from` at or before that date, for that currency and that tier. Setting a row on a
key that already exists REPLACES it, so two rows can never share one key and "the price
that day" is never a coin toss. A date before every row has no price and is refused; a
price that did not exist yet is not a price.

Nothing here converts a currency. A EUR price shown under a PLN heading would be an
invented number, so a SKU with no price in the currency you asked for is listed as having
none, and `catalogue_report` counts them.

## The measured insight

**The two servers this catalogue feeds take the same price in different scales, and the
gap is exactly 100x.** `invoice_create`'s item carries `unit_price` in MAJOR units
("Price per unit in major units, e.g. 90 for 90 EUR", `servers/invoice/src/index.ts`);
`quote_create`'s item carries `unit_price_minor` in MINOR units ("9000 = 90.00 EUR, 90 =
JPY 90. Never a decimal", `servers/quotes/src/index.ts`). Both fields are called the unit
price, both take a plain number, and neither tool can tell that the number it was handed
was scaled for the other one: 45000 passed as `unit_price` is a valid invoice line for
EUR 45,000.00.

Measured on the worked resolution in `test/unit.test.mjs`: the correct payload nets
EUR 2,613.63, and the same items with the quote server's field fed into the invoice
server's engine net EUR 261,363.00, which the suite asserts is exactly 100x. In a
3-decimal currency such as KWD it is 1000x. So the catalogue stores minor units, which is
the only lossless form, and builds BOTH payloads itself in one call, printing the scale
against each. That is the whole reason `lines_resolve` returns two payloads instead of one
"price" the caller reshapes.

The second half of that: every stored price is a whole number of minor units, so
`invoice_create`'s own `computeTotals` rounds the major-unit form straight back to the
integer it came from. `rounding_drift_minor` on a resolution is zero by construction and
the suite asserts it, which is the machine-checkable form of "the invoice will show the
figure the price list showed".

## Privacy

All data stays local: `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/catalogue/`. No
network call is made by any tool. The only file outside that directory this server touches
is the shared business profile, read-only, for the default currency, the default VAT rate
and the name at the top of the price list. It creates no invoice and no quote.

Built by [theluckystrike](https://github.com/theluckystrike).
