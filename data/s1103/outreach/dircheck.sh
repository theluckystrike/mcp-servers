#!/bin/bash
# Checks whether our satellite repos have listing pages on Glama and mcp.directory.
# Controls: a known-listed Glama page, a known mcp.directory page, and a fake name on each.
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
OUT=/private/tmp/claude-501/-Users-mike/0aae16dd-365c-4bae-b2e8-e3082a9e13f9/scratchpad/dircheck.tsv
: > "$OUT"
chk() { curl -s -o /dev/null -m 25 -A "$UA" -w '%{http_code}' "$1"; }
echo "date $(date -u +%FT%TZ)"
echo "control glama cups-to-grams-mcp (expect 200): $(chk https://glama.ai/mcp/servers/theluckystrike/cups-to-grams-mcp)"
echo "control glama fake (expect 404): $(chk https://glama.ai/mcp/servers/theluckystrike/zz-not-real-mcp)"
echo "control mcp.directory github (expect 200): $(chk https://mcp.directory/servers/github)"
echo "control mcp.directory fake (expect 404): $(chk https://mcp.directory/servers/zz-not-real-mcp)"
while read -r r; do
  g=$(chk "https://glama.ai/mcp/servers/theluckystrike/$r"); sleep 1
  m=$(chk "https://mcp.directory/servers/$r"); sleep 1
  printf '%s\t%s\t%s\n' "$r" "$g" "$m" >> "$OUT"
done < <(ls /Users/mike/mcp-servers/satellites | /usr/bin/grep -E -- '-mcp$')
echo "control glama end (expect 200): $(chk https://glama.ai/mcp/servers/theluckystrike/cups-to-grams-mcp)"
echo "control mcp.directory end (expect 200): $(chk https://mcp.directory/servers/github)"
echo "rows: $(wc -l < "$OUT")"
echo "glama codes:"; cut -f2 "$OUT" | sort | uniq -c
echo "mcp.directory codes:"; cut -f3 "$OUT" | sort | uniq -c
echo "glama listed:"; awk -F'\t' '$2==200{print "  "$1}' "$OUT"
