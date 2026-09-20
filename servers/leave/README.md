# mcp-leave

[![theluckystrike/mcp-leave MCP server](https://glama.ai/mcp/servers/theluckystrike/mcp-leave/badges/score.svg)](https://glama.ai/mcp/servers/theluckystrike/mcp-leave)

**In the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.theluckystrike%2Fleave/versions/latest)** (`io.github.theluckystrike/leave`).
Employee leave/PTO tracking for solopreneurs and small studios: who is off,
when, and how many days each person has left. Add employees with an annual
allowance and any carried-over days, log vacation/sick/personal requests
(including half-days), approve or reject them, and read balances, conflicts
and who-is-out calendars directly from your MCP client — Claude Desktop,
Cursor, or any MCP host.

## Tools

- `"leave_employee_add"` — add an employee with `annualAllowance` (and optional `carriedOver`).
- `"leave_request"` — log a leave request (`employee`, `type`, `start`, `end`, optional `halfDay`, `reason`).
- `"leave_approve"` / `"leave_reject"` — decide a request; decisions are recorded with dates.
- `"leave_cancel"` — cancel a pending or approved request (keeps the audit trail).
- `"leave_balance"` — allowance, carried, approved, pending, committed and remaining days per employee.
- `"leave_out_range"` — who is out in a date range: day-by-day calendar rows plus person-days.
- `"leave_list"` — all employees and requests, filterable by employee and status.
- `"leave_import"` (Pro) — bulk-create requests from CSV; conflicting rows are rejected one by one, valid rows still apply.
- `"leave_export_ics"` (Pro) — export approved leave as an RFC5545 `.ics` calendar.

## The one rule that decides everything else

A day is committed when the request that spends it is **approved or pending**.
Balance is `allowance + carried − approved − pending`. Cancelling returns the
days immediately; rejecting never charged them.

Overlapping requests for the same person are refused at creation time — both
pending and approved count — so the calendar never contains two requests
claiming the same day.

## Free vs Pro

The free tier is the full CRUD surface: employees, requests, approvals,
balances, calendars — watermark-free, no request limits. Pro (an
`MCP_LICENSE_KEY`, activate with `"license_activate"`) adds bulk CSV import
and ICS calendar export. Run `"license_status"` to see the current tier.

## Quick start

```json
{
  "mcpServers": {
    "leave": { "command": "npx", "args": ["-y", "@theluckystrike/mcp-leave"] }
  }
}
```

Data lives in a single JSON store (`~/.mcp-leave/store.json`, or
`$XDG_DATA_HOME/mcp-servers/leave/store.json` when set), written atomically
under a file lock, so two clients on one machine never interleave writes.
