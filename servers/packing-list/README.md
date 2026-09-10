# mcp-packing-list

The packing slip for a shipment, and the answer to the only two questions anybody asks
while packing one: what is in which box, and what is still to pack. A packing list is
raised against an order you name, the lines that order says should ship are declared on
it, cartons are added with a tare weight and their outside dimensions, and goods go into
cartons one call at a time. `packing_shortfall` then reports every line as short, complete,
over-packed, or packed and not on the order at all. `carton_report` gives the tare, net,
gross, volume, volumetric and chargeable weight per carton and for the shipment.

**The slip carries no prices.** That is not a simplification, it is what the document is
for: it travels inside the box, and the consignee's warehouse is not the party that sees
what the goods cost. The invoice against the same order is a different document and lives
in `@theluckystrike/mcp-invoice`. There is no money arithmetic in this server at all, and a
test asserts there is not.

Mass is in whole grams everywhere and dimensions in whole centimetres, for the same reason
money is in minor units: a kilogram carried as a float accumulates error over a hundred
lines and then disagrees with the carrier's scale.

Nothing derived is stored. A record holds its cartons, its declared order lines and its
packed lines; every weight and the whole shortfall are computed on the call. A stored gross
weight is a second copy of what the lines already say, and it is the copy that gets believed
after somebody unpacks a line.

## The chargeable weight, which is the number that costs money

Couriers bill the greater of what a box weighs and what its volume is worth. The volumetric
weight is `length x width x height / divisor`, in centimetres, and the divisor is a tariff
term: 5000 cm3/kg is the courier air default, 6000 the older IATA air figure, 4000 appears
on some road tariffs. It is a parameter on every tool that reports it and never a constant
inside a formula, because a chargeable weight computed against the wrong divisor is a
carrier invoice nobody catches until the account is reconciled.

Two refusals matter here and both are deliberate:

- A carton with only two of its three dimensions is refused outright. Two of three cannot
  make a volume, and a partially measured box would drop silently out of the shipment total.
- If any carton has no dimensions at all, the shipment's volumetric and chargeable totals
  come back as `null`, never as a total that quietly skipped three boxes.

## Install

**One-click (.mcpb):** download `packing-list.mcpb` from the latest release and double-click
it in Claude Desktop: https://github.com/theluckystrike/mcp-servers/releases/latest

npm publish for `@theluckystrike/mcp-packing-list` is pending, so the `npx` line below
returns 404 today. Build from source in the meantime; see `llms-install.md`.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "packing-list": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-packing-list"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add packing-list -- npx -y @theluckystrike/mcp-packing-list
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), same entry as Claude Desktop.

## Tools

| Tool | What it does |
| --- | --- |
| `packing_list_create` | Open a packing list against an order: the reference, the consignee, where it ships to, the date |
| `packing_expect` | Declare an ordered line, so the shortfall is real. Nothing is read from the quotes, work-order or invoice store |
| `carton_add` | Add a carton: a label, the empty weight in whole grams, and all three outside dimensions or none |
| `pack_item` | Put a quantity of one item into a named carton, with the per-unit weight in whole grams |
| `unpack_item` | Take a packed line back out by its L01-style id. Deleted, not zeroed |
| `packing_list_show` | The whole list: cartons with contents and weights, the ordered lines, the shortfall, and whether it is ready to ship |
| `packing_list_list` | Packing lists newest first, filtered by status, order reference or consignee |
| `carton_report` | Tare, net, gross, volume, volumetric and chargeable weight, per carton and for the shipment |
| `packing_shortfall` | Ordered against packed: what is short, what is over-packed, what is not on the order |
| `packing_list_status` | draft to packed to shipped, or cancelled. Shipping records the carrier and tracking, and freezes the list |
| `packing_slip` | The slip as text on every tier. Pro also writes it to `out_path` as a .txt file |
| `packing_list_delete` | Delete a list for good. A shipped list is refused: it is the record of what left the building |
| `license_status` | Which tier this install is on and where the key came from |
| `license_activate` | Store a Pro key for this server |

There is also a resource, `packinglist://contract`, carrying the status machine, the weight
basis, what each shortfall state means, the free-tier limits and the one directory this
server writes; and a prompt, `pack_the_shipment`, that walks the whole job in order.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Open packing lists at once | 3 | unlimited |
| Cartons, packed lines, ordered lines | unlimited | unlimited |
| `carton_report`, `packing_shortfall`, `packing_list_show` | yes | yes |
| The packing slip as text | yes | yes |
| Writing the slip to a file with `out_path` | no | yes |

The cap is on shipments in flight, not on knowing what is in a box. Marking a list shipped
or cancelling it frees its slot, and so does deleting a draft, so a free user can always get
back under the limit without a key.

**Get Pro:** https://mcp.zovo.one/buy/packing-list (one-time), or all servers for one price
at https://mcp.zovo.one/buy/bundle

## Privacy

All data stays local, in
`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/packing-list/`. There is no network call
anywhere in this server, no API key, and no account. The only file it reads that it does not
own is the shared business profile, for the name and address at the top of the slip, and it
never writes to it.

Built by [theluckystrike](https://github.com/theluckystrike). Support: support@zovo.one
