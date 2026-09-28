# Draft 06 — ccweerasinghe1994/hr-dashboard-v2 #126 — [PAY-001] Payroll domain & calculation architecture

GitHub Issue — OPEN, created 2026-08-09, 0 comments
https://github.com/ccweerasinghe1994/hr-dashboard-v2/issues/126

---

## Draft answer (paste as-is)

For the payroll domain boundaries, the split that holds up in practice:

- **PayRun** (period, cycle, approvals) is an orchestration object — never carry money math on it.
- **Payslip** (per-employee per-run) owns the line items: earnings, deductions, employer contributions. Line items reference immutable rate snapshots — payroll must reproduce past runs byte-identically, so never join to a live rate table at render time.
- **Calculation engine** is a pure function: (employee snapshot, period, rate snapshots) → Payslip. No I/O inside. That makes golden-file tests trivial and is what the taejang issue elsewhere calls "reproduce against golden data".
- Money as integer minor units everywhere; floats are how payroll silently loses cents.

Your dependency list (compensation, time/leave, reconciliation) is right — the one thing I'd add early is the **immutable rate-snapshot table**, because retrofitting it after live runs exist is painful.

If useful as a working reference for the calculation side (runs, payslips, salary math as clean tool calls), I built a free payroll MCP server callable from Claude or any MCP client:

```json
{
  "mcpServers": {
    "payroll": {
      "command": "claude",
      "args": ["mcp", "add", "--mcpb", "https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.0/payroll.mcpb"]
    }
  }
}
```

Setup: https://mcp.zovo.one/s/payroll

Disclosure: I built it — treat accordingly; the immutable-snapshot rule is the part worth keeping regardless.
