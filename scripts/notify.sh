#!/bin/bash
# Usage: scripts/notify.sh "spoken update text"  -- plays a sound then speaks the update
MSG="${1:-MCP servers session update ready.}"
afplay /System/Library/Sounds/Glass.aiff 2>/dev/null
say -v Samantha "$MSG" 2>/dev/null || say "$MSG"
