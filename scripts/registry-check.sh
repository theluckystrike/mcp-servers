#!/usr/bin/env bash
# registry-check.sh — read-only. Queries the official MCP registry and the npm
# registry for each theluckystrike MCP package and prints FOUND/MISSING.
# Zero paid APIs, no auth required, no writes.
set -uo pipefail

PACKAGES=(mcp-time-tracker mcp-price-tracker mcp-spreadsheet mcp-invoice)
REGISTRY_API="https://registry.modelcontextprotocol.io/v0/servers"
NPM_REGISTRY="https://registry.npmjs.org"

echo "== Official MCP registry (io.github.theluckystrike/*) =="
for name in "${PACKAGES[@]}"; do
  server_name="io.github.theluckystrike/${name}"
  resp=$(curl -s --max-time 10 "${REGISTRY_API}?search=${name}")
  count=$(printf '%s' "$resp" | grep -o '"count":[0-9]*' | head -1 | cut -d: -f2)
  if printf '%s' "$resp" | grep -q "\"${server_name}\""; then
    printf '  FOUND    %s\n' "$server_name"
  else
    printf '  MISSING  %s  (search count=%s)\n' "$server_name" "${count:-0}"
  fi
done

echo
echo "== npm registry (@theluckystrike/*) =="
for name in "${PACKAGES[@]}"; do
  pkg="@theluckystrike/${name}"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${NPM_REGISTRY}/${pkg}")
  if [ "$code" = "200" ]; then
    version=$(curl -s --max-time 10 "${NPM_REGISTRY}/${pkg}/latest" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
    printf '  FOUND    %s  (latest=%s)\n' "$pkg" "${version:-unknown}"
  else
    printf '  MISSING  %s  (HTTP %s)\n' "$pkg" "$code"
  fi
done

echo
echo "== npm whoami =="
if npm whoami >/dev/null 2>&1; then
  printf '  authenticated as: %s\n' "$(npm whoami 2>/dev/null)"
else
  echo "  NOT AUTHENTICATED (npm login required — see docs/DISTRIBUTION.md section 1)"
fi
