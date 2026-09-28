#!/bin/zsh
# launchd runs this hourly. Nonzero exit and a local notification are the alert.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/mike/mcp-servers || exit 1
/opt/homebrew/bin/node scripts/billing-release-gate.mjs monitor
gate_status=$?
/opt/homebrew/bin/node scripts/billing-release-gate.mjs health
health_status=$?
if [ "$health_status" -ne 0 ]; then
  gate_status="$health_status"
fi
/opt/homebrew/bin/node scripts/billing-operations-monitor.mjs
operations_status=$?
if [ "$operations_status" -ne 0 ]; then
  gate_status="$operations_status"
fi
if [ "$gate_status" -ne 0 ]; then
  /usr/bin/osascript -e 'display notification "A live checkout or fulfillment check failed. Inspect billing monitor log." with title "MCP billing alert"' >/dev/null 2>&1
fi
exit "$gate_status"
