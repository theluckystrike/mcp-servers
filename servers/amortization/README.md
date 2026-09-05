# mcp-amortization

Loan and lease schedules for an AI assistant. Give it the terms of a credit agreement -- the amount, the nominal annual rate in basis points, how often interest compounds, how often a payment falls due, the term in periods, the method, any arrangement fee and any balloon -- and it works out the payment, the effective annual rate, and the schedule period by period: opening balance, payment, interest, principal, closing balance. It answers what settling early would cost and save, and hands back the double entry for a payment in the same account names the cash book uses. Everything is integer minor units, and every closing balance reaches the balloon, or zero, exactly. Nothing is sent anywhere: the register is a file on your machine.

## Install

**Claude Desktop** -- macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "amortization": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-amortization"]
    }
  }
}
```

**Claude Code**

```sh
claude mcp add amortization -- npx -y @theluckystrike/mcp-amortization
```

**Cursor** -- `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

## Tools

| Tool | What it does |
| --- | --- |
| `loan_create` | Record a loan or lease from its terms. Returns `LOAN-YYYY-NNNN`, the level payment, the effective annual rate and the total interest |
| `loan_schedule` | The schedule: opening, payment, interest, principal, closing for every period, and the total interest |
| `loan_repay_early` | What settling or overpaying at a period costs: the outstanding balance, the penalty, the recalculated remaining schedule and the interest saved, gross and net of the penalty |
| `loan_journal` | The double entry for a period or a month: debit interest expense and loan liability, credit cash, plus an `expense_add`-ready payload |
| `loan_list` | The register, with the balance outstanding and the next payment date at any date |
| `loans_report` | What is owed per currency, when each next payment falls due, and the interest charged in a calendar year |
| `license_status`, `license_activate` | Your tier, and activating a Pro key |

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Loans in the register | 3 | Unlimited |
| Schedules | Unlimited | Unlimited |
| Early repayment (`loan_repay_early`) | - | Yes |
| Journals (`loan_journal`) | - | Yes |
| Report (`loans_report`) | - | Yes |

The schedule is never metered. The payment and the interest are the question this server exists to answer, and a free tier that hides the answer is a demo. The meter is on the number of agreements held, which is the unit of work.

**Get Pro:** https://mcp.zovo.one/buy/amortization -- $19 one-time for this server, or $39 for the bundle.

## A measured insight

**Quoting a rate per quarter as the nominal rate over four is worth 1.0 percent of the interest, in the lender's favour.** Take EUR 10,000 at a nominal 12 percent compounded MONTHLY, repaid in four quarterly instalments. The rate for one quarter is the equivalent rate, `(1 + 0.12/12)^3 - 1 = 3.0301` percent, not `0.12/4 = 3.0000` percent. That 3-basis-point difference sets the payment at EUR 2,692.21 instead of EUR 2,690.27 and the total interest at EUR 768.84 instead of EUR 761.08: **EUR 7.76 more, 1.0 percent of the whole interest bill, on a one-year loan of ten thousand.** The two rates look identical in a quote and diverge in the schedule, which is why this server takes every equivalent rate through the compounding clock and prints the periodic rate it used to six decimal places.

The same arithmetic is why the effective annual rate is reported beside the nominal one on every loan: a nominal 12 percent compounded monthly is an effective 12.68 percent, and 0.68 of a percent is the part of the price the headline rate does not carry.

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/amortization/`. Two files: `loans.json` and `counter.json`. No network call is made by this server at all, for any tool. No schedule is stored: every row is derived from the terms on the call, because a stored schedule is a second copy of a figure the rate and the term already decide, and the copy is the one that gets believed after somebody edits the rate.

Built by theluckystrike. https://github.com/theluckystrike
