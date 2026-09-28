# Draft 02 — Luqueze/stu-ai-web #2 — Add pomodoro timer

GitHub Issue — OPEN, created 2026-09-12, 0 comments
https://github.com/Luqueze/stu-ai-web/issues/2

---

## Draft answer (paste as-is)

For a study app the details that make a pomodoro timer actually stick:

- **Persist the running timer, not just completed sessions.** If the tab reloads mid-focus, restore remaining time from a timestamp (endsAt), not a countdown counter — setInterval drifts and dies on background tabs.
- **Log sessions.** Even a simple array of {start, end, mode} enables the streak/focus-time stats students care about later.
- **Default 25/5/15 with configurable lengths**, and auto-chain: focus → short break ×4 → long break.
- **Notification, not just UI.** A title-bar countdown + Web Notification on completion survives the user switching tabs, which they will.

If you want a reference implementation you can call from any MCP client (or wire into an AI study assistant) rather than embedding UI code, I built a free pomodoro MCP server — start/pause/status/session history as tool calls:

```json
{
  "mcpServers": {
    "pomodoro": {
      "command": "claude",
      "args": ["mcp", "add", "--mcpb", "https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.0/pomodoro.mcpb"]
    }
  }
}
```

Setup + bundles: https://mcp.zovo.one/s/pomodoro

Disclosure: I built it — treat accordingly; the endsAt/timestamp persistence point is the one I'd keep no matter how you implement it.
