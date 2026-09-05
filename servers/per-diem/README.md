# mcp-per-diem

Work out the daily travel allowance for a business trip on the rate tables the tax authorities actually publish, and keep the trips you priced. You give it where you went, when you left and when you got back, and which meals somebody else paid for; it gives you the amount per day and the total, in the scheme's own currency, with the partial-day rule and every meal deduction shown next to the number that produced it. Three schemes ship with it: the Polish delegation regulation (domestic and per country), the HMRC benchmark scale rates for travel inside the UK, and the US GSA CONUS standard M&IE and lodging. The tables are bundled files, not a live feed, so the same trip priced twice gives the same answer, and every rate carries the regulation, the source URL and the date it took effect. Nothing leaves your machine.

Built by [theluckystrike](https://github.com/theluckystrike).

![per-diem demo](../../assets/demo-per-diem.gif)

## Install

Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "per-diem": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-per-diem"]
    }
  }
}
```

Claude Code:

```sh
claude mcp add per-diem -- npx -y @theluckystrike/mcp-per-diem
```

Cursor (`~/.cursor/mcp.json` or `.cursor/mcp.json`): the same entry as Claude Desktop.

## Tools

| tool | what it does |
| --- | --- |
| `perdiem_rates` | List a scheme's bundled rates with the authority, instrument, source URL and effective date. Filter by country or city. |
| `perdiem_calc` | Price one trip: the allowance per day and the total, with the partial-day fraction and the meal deductions the scheme's rule applies. |
| `trip_record` | Calculate a trip and save it under a name, with the traveller from the shared business profile. |
| `trip_list` | List saved trips with a total per currency. |
| `trip_export` | The exact `expense_add` arguments for a saved trip, one payload per currency, for the expense-tracker server. |
| `perdiem_report` | Totals per scheme and per calendar month, in each scheme's own currency. |
| `license_status` | Free or Pro, and where to upgrade. |
| `license_activate` | Activate a Pro key. Verified offline. |

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| `perdiem_rates`, `perdiem_calc` | Yes, unlimited | Yes |
| Trips saved per calendar month | 5, by start date | Unlimited |
| `trip_list` | Yes, unlimited | Yes |
| `trip_export` | No | Yes |
| `perdiem_report` | No | Yes |

[Get Pro](https://mcp.zovo.one/buy/per-diem): $19 one-time, or $39 for the bundle.

## What is in the tables, and what is deliberately not

Every table under `src/tables/` carries a `header` with the authority, the instrument, the source URL, the date the rates took effect and the date they were read. `perdiem_rates` returns that header with the rates, so the provenance travels with the number.

The rule for what is in them: **a value that could not be stated with confidence from the public regulation text was left out, not guessed.** A per diem figure ends up on a tax return. A wrong one that looks authoritative is worse than an absent one, because an absent one is refused by name and you go and look it up.

| table | bundled | left out |
| --- | --- | --- |
| Poland, domestic | The 45.00 PLN daily diet, the 150 percent lodging lump sum, and the partial-day and meal rules | The 20 percent local-transport lump sum is listed but not paid: it is not subsistence |
| Poland, foreign | 34 countries of the annex, with the diet and its currency | The other roughly 90 countries, and every per-country lodging limit. A missing country means "not verified here", not "no rate exists" |
| UK, domestic | All four HMRC benchmark scale rates (5, 10 and 15 hour bands and the late-evening supplement) | Nothing |
| UK, overseas | **Nothing.** The file ships with an empty rate list and a header saying so | The whole per-city overseas scale-rate table: roughly 250 cities times eight figures each, in the destination currency. This build could not state them with confidence, so none of them is bundled. `perdiem_calc {scheme:"uk"}` refuses a foreign destination by name and points at the HMRC page |
| US, GSA | The CONUS **standard** M&IE and lodging cap for FY2025 and FY2026, with the published meal breakdown | The roughly 300 non-standard localities (New York City, San Francisco and the rest). A destination that is not one of those takes the standard rate anyway, which is what this table gives |

Rates change. Check the `effective_date` in any answer before you rely on it, and read the `source_url` if the trip is recent.

## Rules the calculator applies

- **Start and end are instants, not wall clocks.** Pass ISO 8601 with an offset (`2026-03-28T22:00:00+01:00`) or a local datetime plus an IANA `timezone`. Elapsed hours are an epoch difference, so a trip across a clock change is 23 or 25 hours, not 24.
- **Poland** counts 24-hour periods from departure. Under 24 hours domestically: nothing under 8 hours, half the diet from 8 to 12, the whole diet above 12. Over 24 hours: a whole diet per period, then half for a remainder up to 8 hours and a whole one above. Abroad the ladder is a third up to 8 hours, half over 8 and up to 12, whole above. Free meals take 25/50/25 percent off a domestic day and 15/30/30 off a foreign one.
- **The UK** pays by band: 5.00 GBP from 5 hours away, 10.00 GBP from 10, 25.00 GBP from 15 when the journey is ongoing at 8pm, nothing under 5. A provided meal removes its share of the band, pro rata. HMRC states the principle ("the rate is not payable for a meal that was provided"); the pro-rata arithmetic is this server's reading of it, and it says so in the answer.
- **The US** counts calendar days in the destination zone, at 75 percent of M&IE on the first and last day. A provided meal is deducted at its own published amount, and the 5.00 USD of incidentals is never deducted. Lodging is a **cap** on receipted reimbursement, not an allowance that is paid out; the answer says so every time.
- **Currencies are never added together.** There is no exchange rate in this server, so a PLN diet and a EUR one stay two figures.

## Exporting to the expense tracker

`trip_export` returns the exact `expense_add` arguments for the [expense-tracker](../expense-tracker) server, one payload per currency, and writes nothing itself. That is deliberate: expense-tracker publishes no library entry point, and its id counter, its category rules, its VAT split and its currency defaults all live inside its own `expense_add` handler under its own lock. Appending a row to its `data.json` directly would produce an expense with none of those applied: one that looks native and is not. Handing back the arguments is the same contract [kanban](../kanban) uses for time-tracker's `timer_start`.

No `vat_rate` is set on the payload. A statutory per diem is an allowance, not a purchase, so there is no input VAT to reclaim on it.

## A measured insight

**Substring matching a country name is how a per diem gets quietly priced at another country's rate.**

The first build resolved a destination by exact name, then ISO code, then `country.includes(destination)`. A trip to Oman came back priced, in EUR, with no warning: `"romania".includes("oman")` is `true`, so it took Romania's 42.00 EUR diet. Oman is not one of the 34 countries this build bundles, so the correct answer was a refusal naming the gap. Instead the caller got a confident number, in the wrong currency, from a country 3,000 km away.

The fix is one line, the fallback is a **prefix** match of four characters or more, and it is asserted in `test/adversarial.test.mjs`. The general form is worth more than the fix: a fuzzy match is safe when a miss is cheap and expensive when a miss is silent. Here a miss produces a tax figure, so the fallback has to fail closed. The table being deliberately partial is exactly what makes the substring fallback dangerous: with a complete table the wrong row is a near miss, and with a partial one it is a row that should never have matched at all.

## Privacy

Everything stays on your machine. Trips are JSON under `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/per-diem/`. The rate tables are files inside the package. There is no network call anywhere in this server, no account and no API key. License keys are verified offline.

## License

MIT. Support: support@zovo.one
