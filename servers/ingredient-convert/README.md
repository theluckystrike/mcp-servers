# mcp-ingredient-convert

**Live hosted endpoint: [mcp.zovo.one/s/ingredient-convert](https://mcp.zovo.one/s/ingredient-convert)**, free tier, no signup.

Ask your assistant how much a cup of flour weighs, how many grams are in three tablespoons of honey, or what half a recipe of something looks like in cups, and get a number that comes from a density table instead of a guess. Cups, tablespoons, teaspoons, millilitres, fluid ounces, grams and ounces convert for 30+ ingredients using per-ingredient grams-per-cup values, so a cup of sugar and a cup of oil do not come out the same. Recipe scaling and fraction helpers come with it, and every answer states the density it used and where the number came from.

Built by [theluckystrike](https://github.com/theluckystrike).

Volume-to-weight is the part of cooking that search engines get asked about most and assistants get wrong most: "1 cup flour in grams", "how many grams in a tablespoon of butter", "250 ml to cups". This server answers those from a table with sources, not from a single generic 240 ml assumption.

## Tools (7)

| Tool | What it does |
|------|--------------|
| `convert_ingredient` | Convert an amount of one ingredient between cups, tbsp, tsp, ml, fl oz, g and oz |
| `list_ingredients` | The full density table (grams per US cup) with sources and aliases |
| `scale_recipe` | Scale a recipe by a factor (double, halve, 1.5x) and print friendly fractions |
| `convert_bulk` | Convert many amounts at once; unknown ingredients are reported, not guessed |
| `decimal_to_fraction` | 0.5 to 1/2, 1.75 to 1 3/4, with a denominator cap |
| `fraction_to_decimal` | "1 1/2" or "3/4" to a decimal amount |
| `common_conversions` | The most-searched conversions, answered directly |

## 60-second install

Hosted, nothing installed: open [mcp.zovo.one/mcp/connect](https://mcp.zovo.one/mcp/connect) and paste the `ingredient-convert` URL into Claude Desktop, Cursor, Windsurf or Cline.

```sh
claude mcp add --transport http ingredient-convert https://mcp.zovo.one/mcp/ingredient-convert/t/<token>
```

From a clone:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git
cd mcp-servers && npm install
npm run build -w servers/ingredient-convert
claude mcp add ingredient-convert -- node "$PWD/servers/ingredient-convert/dist/index.js"
```

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ingredient-convert": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/ingredient-convert/dist/index.js"]
    }
  }
}
```

npm publish for `@theluckystrike/mcp-ingredient-convert` is pending, so the hosted URL or a clone are the working paths today.

## Free and Pro

Free covers every conversion and the full ingredient table, with no expiry. Pro is a one-time key that also unlocks the rest of the suite; it removes the saved-report limit. One key covers every server: [the bundle](https://mcp.zovo.one/buy/bundle?src=store.s.ingredient-convert.bundle).

## Accuracy

Densities are grams per US cup with a cited source per ingredient; the answer text names the density used, and an unknown ingredient is reported as unknown rather than approximated. The tables are validated at startup, so a bad row fails the process instead of returning a wrong weight.

## Licence

MIT.
