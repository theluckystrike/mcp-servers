# A/B Test Sample Size Calculator MCP Server

This Actor is an **A/B test sample size calculator** and significance-test toolkit for AI agents and MCP clients (Claude, ChatGPT developer mode, Cursor, VS Code, Cline and others). It works out how many users a test needs, how long it must run, whether a result is significant (z-test, chi-square, Fisher exact), the **Fisher-Freeman-Halton exact test** for larger tables, and how much **peeking** inflates false positives. It needs no API key and makes no network calls.

**How you use it:** run it in Standby mode and connect your MCP client to `https://YOUR_USERNAME--ab-test-sample-size-calculator-mcp.apify.actor/mcp` with your Apify API token. Each successful tool call costs **$0.02**. Listing the tools is free.

## What this MCP server knows that your model does not

- **Exact quantiles and the full formula.** Models round z-values, drop the pooled variance term or confuse relative and absolute MDE, and the answer moves by thousands of users.
- **Why calculators disagree.** Results show the standard pooled formula (as R `power.prop.test`) next to Evan Miller's published formula, so a 31,234 vs 30,244 gap has an explanation.
- **Exact hypergeometric sums.** A Fisher-Freeman-Halton p-value for a 4 x 4 table needs millions of tables summed. It cannot be estimated in your head.
- **Sequential testing numbers.** Checking a test 5 times at p < 0.05 gives a 14.2% false positive rate. The tool returns the Pocock and O'Brien-Fleming boundaries that fix it.

## Tools

| Tool | What it returns |
|---|---|
| `calculate_sample_size` | Users per variant for a conversion-rate test: baseline, relative or absolute MDE, alpha, power, one or two-sided, several variants with optional Bonferroni, unequal splits. |
| `estimate_test_duration` | Days and whole weeks to reach the sample size from daily visitors, traffic share and number of variants. |
| `test_ab_significance` | Two-proportion z-test, p-value, confidence interval, relative lift, chi-square with and without Yates, Fisher exact p and a sample ratio mismatch check. |
| `fisher_exact_test` | Exact p-value for a 2x2 table (two-sided, greater, less) or any r x c table, next to Pearson chi-square and an expected-count check. |
| `check_peeking_risk` | The real false positive rate when a test is checked K times, and Pocock and O'Brien-Fleming boundaries for up to 10 looks. |

Every result has structured JSON, a plain-English summary, `as_of` and `source`, so an agent can quote it and cite it.

## Pricing

Pay per event: **$0.02 per successful tool call** (event `tool-call`). `initialize`, `tools/list` and failed calls are not charged. In Standby mode Apify also bills the small platform usage of the running container on top of the event price. You can set a maximum charge per run in the Apify Console, and the Actor stops answering tool calls when that limit is reached. A normal (non-Standby) run only performs a free self-check.

## How to connect

1. Create a free Apify account and copy your API token from **Settings > API & Integrations** in the Apify Console.
2. The MCP endpoint is `https://YOUR_USERNAME--ab-test-sample-size-calculator-mcp.apify.actor/mcp` (streamable HTTP). Replace `YOUR_USERNAME` with the Apify username that owns this Actor.
3. Send the token as a Bearer header: `Authorization: Bearer YOUR_APIFY_TOKEN`.

### Claude Code

```bash
claude mcp add --transport http ab-test-calculator https://YOUR_USERNAME--ab-test-sample-size-calculator-mcp.apify.actor/mcp --header "Authorization: Bearer $APIFY_TOKEN"
```

### Cursor, VS Code, Cline and other clients with remote MCP support

```json
{
  "mcpServers": {
    "ab-test-calculator": {
      "url": "https://YOUR_USERNAME--ab-test-sample-size-calculator-mcp.apify.actor/mcp",
      "headers": { "Authorization": "Bearer YOUR_APIFY_TOKEN" }
    }
  }
}
```

### Claude Desktop (through the mcp-remote bridge)

```json
{
  "mcpServers": {
    "ab-test-calculator": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://YOUR_USERNAME--ab-test-sample-size-calculator-mcp.apify.actor/mcp", "--header", "Authorization: Bearer YOUR_APIFY_TOKEN"]
    }
  }
}
```

### Apify MCP server and the Apify API

You can also reach this Actor through the Apify MCP server (`https://mcp.apify.com`) or call the Standby URL from any HTTP client that speaks MCP.

## Example prompts

- "My baseline conversion is 3.2% and I want to detect a 10% relative lift at 80% power. How many visitors per variant, and how long with 4,000 visitors a day?"
- "Control: 12,410 visitors and 612 conversions. Variant: 12,388 visitors and 671 conversions. Is it significant?"
- "I plan to check my test 6 times before it ends. What is my real false positive rate?"

## Data and method

Closed-form statistics computed in the Actor. Method references are returned in the `source` field of every result.

## Limits

Statistics help you decide, they do not replace experiment design. Check randomisation, sample ratio and metric definitions before you act on a result.

## FAQ

**Does it call an external API?**  
No. Everything is computed locally, so it is fast and deterministic.

**Can it handle more than two variants?**  
Yes. Sample size supports several variants with an optional Bonferroni correction; the exact test supports r x c tables.

**Why two sample sizes in one answer?**  
Different calculators use different formulas. Showing both explains small gaps between tools.

**How is the Actor run?**  
The Actor starts the open-source MCP server bundled in this image (MIT licence) and exposes it over streamable HTTP in Apify Standby mode. It is built from the `apify/actor-templates` MCP proxy template. Source: https://github.com/theluckystrike/ab-test-sample-size-calculator-mcp

**What is MCP?**  
The Model Context Protocol is an open standard that lets AI assistants call tools. See https://modelcontextprotocol.io

## Related searches

A/B test sample size calculator, ab test significance calculator, Fisher exact test, chi-square test, statistical power, sequential testing, peeking problem, MCP server
