# mcp-clauses

Say "draft a service agreement for Beta Corp, 4,500 EUR, 14-day terms" and get a real `.docx` built from your own clause library. This MCP server keeps the contract and proposal paragraphs you reuse -- scope, payment terms, late fees, IP assignment, confidentiality, termination, liability cap and twenty more -- as searchable clauses with `{{variables}}` in them. It ships with 25 generic freelance starters, finds the right ones by ranked search, fills the variables you supply, leaves every fact you did not supply as a visible bracketed prompt like `[late fee percent]`, and writes the assembled document to Word or markdown. Every document opens with the line that it is a generic template and not legal advice. Everything runs locally: no upload, no account, no native dependency.

![clauses demo](../../assets/demo-clauses.gif)

**Stop pasting last year's contract into a new file and hoping you changed every name.**

## 60-second install

npm publish for `@theluckystrike/mcp-clauses` is pending. Until then, the `.mcpb` one-click bundle or a clone+build
is the working path -- both are verified below.

**One-click (.mcpb):** download `clauses.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "clauses": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-clauses"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add clauses -- npx -y @theluckystrike/mcp-clauses
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "clauses": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-clauses"]
    }
  }
}
```

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above, or
build from source with exactly these three commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/docx -w servers/clauses
```

Then point your client's `command` at `node` with one arg: the absolute path to `servers/clauses/dist/index.js`.

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## This is not legal advice

The 25 starter clauses are generic freelance templates written in plain language. They are not drafted for your
country, your trade or your deal, and no clause here has been reviewed by a lawyer. Every starter carries the note
`generic template, not legal advice`, and every document `contract_assemble` writes opens with the same line. Treat
the output as a first draft to take to a qualified lawyer, not as a contract to sign.

## Tools

| Tool | What it does |
| --- | --- |
| `clause_add` | Save a reusable clause: title, body with `{{variables}}`, category, tags, optional jurisdiction and language |
| `clause_get` | Return one clause in full, by id or by title (a partial title matches) |
| `clause_update` | Change the text, category, tags, variables or jurisdiction. In Pro the previous text is kept as a version |
| `clause_delete` | Remove a clause. A deleted starter is not re-seeded on the next call |
| `clause_list` | List every clause, in assembly order, optionally narrowed to one category |
| `clause_search` | Ranked search over titles, tags, categories and bodies. A title match outranks a body mention; a term matches on a real word boundary ("fee" never matches inside "coffee"), with plain substring containment kept only as a lower-ranked fallback. The jurisdiction filter is free (citing a clause from the wrong jurisdiction is the error this prevents); the tag filter is Pro and is skipped, never refusing the search |
| `clause_import` | Bulk-load from a markdown file (`## Title`, `category:` / `tags:` lines, blank line, body) or from JSON (Pro). Only short, field-shaped lines right after the title are read as metadata, so body prose that happens to open with a word like "note:" is kept as body, not swallowed |
| `clause_export` | Write the whole library to markdown (free) or JSON (Pro). An existing destination is never replaced unless you pass `overwrite: true` |
| `contract_assemble` | Build a document from clause ids or whole categories: orders the clauses, numbers them, fills the variables, brackets what is missing, prepends the not-legal-advice line, writes `.docx` or `.md`. An existing `out_path` is never replaced unless you pass `overwrite: true` |
| `variables_list` | Every `{{variable}}` a selection of clauses needs, and which clause needs it, before you assemble |
| `license_status` | Show free or Pro mode |
| `license_activate` | Activate a Pro key (verified offline) |

Resource: `clauses://categories` returns every category in the library with its clause count, in assembly order.
Prompt: `draft_contract` picks clauses that fit an engagement, assembles them, and reports the facts still missing.

## The 25 starter clauses

| Category | Clauses |
| --- | --- |
| scope | Scope of Work, Revisions, Acceptance of Deliverables, Change Requests |
| payment | Payment Terms, Late Payment, Kill Fee, Rush Fee |
| expenses | Expenses |
| ip | Intellectual Property Assignment, Portfolio and Credit |
| confidentiality | Confidentiality |
| data | Data Protection |
| term | Termination |
| liability | Limitation of Liability |
| warranty | Warranty Disclaimer |
| disputes | Dispute Resolution |
| general | Governing Law, Force Majeure, Independent Contractor, Non-Solicitation, Notices, Entire Agreement, Severability, Assignment |

They use variables such as `{{client}}`, `{{contractor}}`, `{{project}}`, `{{fee}}`, `{{currency}}`,
`{{payment_days}}`, `{{deposit_percent}}`, `{{late_fee_percent}}`, `{{liability_cap}}`, `{{notice_days}}`,
`{{revision_rounds}}`, `{{acceptance_days}}`, `{{kill_fee_percent}}`, `{{rush_fee_percent}}` and `{{jurisdiction}}`.
Call `variables_list` with the clauses you picked to see exactly which ones your document needs.

## What you can say

| You say | Tool |
| --- | --- |
| "What clauses do I have about late payment?" | `clause_search` |
| "Save this as a clause called Retainer, category payment." | `clause_add` |
| "Draft a service agreement for Beta Corp: scope, payment, late fees, IP, termination. Fee 4,500 EUR, 14-day terms." | `contract_assemble` |
| "What do I still need to fill in for those five clauses?" | `variables_list` |
| "Import my old clauses from clauses.md." | `clause_import` |
| "Export the whole library so I can keep a copy." | `clause_export` |

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| 25 starter clauses | yes | yes |
| Your own clauses | 10 | unlimited |
| Ranked search, category filter | yes | yes |
| Filter by jurisdiction or tag | no | yes |
| Clauses per assembled document | 8 | unlimited |
| Markdown import and export | yes | yes |
| JSON import and export | no | yes |
| Clause version history on `clause_update` | no | yes |

**Get Pro:** https://mcp.zovo.one/buy/clauses -- $19 one-time, or $39 for the whole collection.

## Pairs with

- [mcp-docx](../docx) -- the document engine this server assembles through. Install both and the same conversation
  that picks clauses can also write the covering letter and read the client's own `.docx` back.
- [mcp-invoice](../invoice) -- the payment terms you agreed in the contract are the terms you bill on.
- [mcp-recurring](../recurring) -- once a retainer clause is signed, the schedule that raises its invoices.

## Privacy

Every clause and every assembled document stays on your machine, in
`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/clauses/`. The server makes no network calls at all. Your licence key
is verified offline.

Built by [theluckystrike](https://github.com/theluckystrike). Support: support@zovo.one

## One business profile for the whole suite

Your identity is stored once, at `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/profile/business.json`,
and every server in the suite reads it: the invoice issuer, the docx letterhead, the recurring
issuer, expense-tracker's default VAT rate, time-tracker's and timezone's home zone, and the
resume and contract letterheads. Set it once with `business_set` (invoice or docx) - you never
repeat it anywhere else. An email address is only ever taken from that profile or from an explicit
argument; when none is stored, documents show `[add: email]` and the tool says so rather than
letting anyone improvise an address.
