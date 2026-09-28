#!/bin/zsh
set -eu
monitor_plist="$HOME/Library/LaunchAgents/one.zovo.mcp-billing-gate.plist"
monitor_log="$HOME/Library/Logs/mcp-billing-gate.log"
monitor_error_log="$HOME/Library/Logs/mcp-billing-gate.error.log"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$monitor_plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>one.zovo.mcp-billing-gate</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>/Users/mike/mcp-servers/scripts/billing-monitor.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>3600</integer>
  <key>StandardOutPath</key><string>$monitor_log</string>
  <key>StandardErrorPath</key><string>$monitor_error_log</string>
</dict></plist>
PLIST
plutil -lint "$monitor_plist"
launchctl bootout "gui/$(id -u)" "$monitor_plist" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$monitor_plist"
launchctl print "gui/$(id -u)/one.zovo.mcp-billing-gate" | rg 'state =|last exit code|runs ='
