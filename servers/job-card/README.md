# mcp-job-card

One card per job, the way the paper one on the dashboard works. Open a card for the client and the site, log the hours each worker puts in at their rate and the materials that go into the job, and the card keeps the running totals: labor, materials and the grand total, always in integer cents. Move the card along as the job moves -- open, in progress, done, invoiced, archived -- and when the client wants to see it, print the card with its signature line for sign-off. A daily or weekly summary answers where the crew's hours went and what the work is worth, per currency. Everything stays on this machine; there is no account and no network call.

Built by theluckystrike.

npm publish for `@theluckystrike/mcp-job-card` is pending, so `npx -y @theluckystrike/mcp-job-card` returns 404 today. Until then, a clone+build is the working path.

## Install

### Claude Desktop

macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "job-card": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-job-card"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add job-card -- npx -y @theluckystrike/mcp-job-card
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), same entry as Claude Desktop.

## Tools

| tool | what it does |
| --- | --- |
| `job_card_create` | Open a job card: client, site, what the job is, currency, scheduled date. Returns `JC-YYYY-NNNN` |
| `job_card_log_labor` | Log hours on a job card: who did the work, the day, the hours, the hourly rate in cents, what was done |
| `job_card_log_material` | Log materials used on a job card: the item, the quantity, the unit cost in cents |
| `job_card_update_status` | Move the card exactly one step -- open, in_progress, done, invoiced, archived -- stamping date and note into its history |
| `job_card_list` | List cards newest first with hours and totals; filter by status and client; totals kept per currency |
| `job_card_get` | Read one card in full: every entry, hours per worker, and the running totals in integer cents |
| `job_card_print` | Render the card ready to print, with a signature line for client sign-off. Markdown or self-contained HTML |
| `job_card_delete` | Delete a card entered by mistake. One holding labor or materials is refused; archive it instead |
| `job_card_summary` | A day or a week: cards touched, hours per worker, labor and materials value per currency. A week runs Monday to Sunday |
| `license_status` / `license_activate` | Free or Pro, and the key |

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Active job cards | 10 | Unlimited |
| Labor and material entries per card | Unlimited | Unlimited |
| Running totals, list and get | Yes | Yes |
| Printable card, markdown and HTML | Yes | Yes |
| Daily and weekly summary | Yes | Yes |

The record is never metered. Ten active cards is a real working board for a small crew, and a card stops counting the moment it is archived, so logging, totals, printing and summaries stay free for good. What Pro lifts is how many jobs are on the board at once.

**Get Pro:** https://mcp.zovo.one/buy/job-card -- $19 one-time for this server, or $39 for the bundle.

## Money and rounding

Every amount is an integer number of cents (a cent is 1/100 of the currency unit). A labor line is hours times the hourly rate; a materials line is quantity times the unit cost; each line value is rounded **half-up to the nearest cent** once, at the moment it is logged, and stored on the entry. Totals are the sums of those stored line values, so a total can never drift from its lines. Hours are carried as integer hundredths and quantities as integer thousandths, so 2.5 hours at 4999 cents an hour is 12498 cents, never 12497.499999. Currencies are never added together: this server holds no exchange rate.

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/job-card/`. Two files: `cards.json`, `counter.json`. Nothing is sent anywhere, there is no account, no API key and no network call in this server at all. License keys are verified offline.

Built by theluckystrike. https://github.com/theluckystrike
