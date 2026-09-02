#!/usr/bin/env bash
# publish-all.sh — sequences build, test, npm publish, git tag, and mcp-publisher
# publish for all 4 servers. DRY RUN by default: prints every command it would run
# and why, but executes nothing that mutates npm/git/the registry. Pass --go to
# actually execute. Idempotent: skips any step whose target already exists
# (published npm version, existing git tag, existing registry server.json version).
#
# Requires: npm, node, git, gh, mcp-publisher (brew install mcp-publisher).
# Requires: npm login already done (npm whoami succeeds) and
#           mcp-publisher login github already done, before --go.
#
# Usage:
#   scripts/publish-all.sh            # dry run (default, safe)
#   scripts/publish-all.sh --go       # execute for real

set -uo pipefail

export npm_config_cache="${npm_config_cache:-/Users/mike/.npm-cache-local}"
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:/opt/homebrew/bin:$PATH"

ROOT="/Users/mike/mcp-servers"
SERVERS=(time-tracker price-tracker spreadsheet invoice)
GO=0
[ "${1:-}" = "--go" ] && GO=1

run() {
  if [ "$GO" = "1" ]; then
    echo "+ $*"
    "$@"
  else
    echo "[dry-run] would run: $*"
  fi
}

echo "=== publish-all.sh  (mode: $([ "$GO" = 1 ] && echo EXECUTE || echo DRY-RUN)) ==="
echo

if [ "$GO" = "1" ]; then
  if ! npm whoami >/dev/null 2>&1; then
    echo "FATAL: npm whoami failed. Run 'npm login --auth-type=web' first. See docs/DISTRIBUTION.md section 1." >&2
    exit 1
  fi
  echo "npm authenticated as: $(npm whoami)"
fi

echo
echo "--- build + test (workspace-wide, once) ---"
run bash -c "cd '$ROOT' && npm run build"
run bash -c "cd '$ROOT' && npm test"

for name in "${SERVERS[@]}"; do
  dir="$ROOT/servers/$name"
  pkg="@theluckystrike/mcp-$name"
  echo
  echo "--- $pkg ---"

  if [ ! -d "$dir" ]; then
    echo "  SKIP: $dir does not exist"
    continue
  fi

  version=$(node -pe "require('$dir/package.json').version" 2>/dev/null)
  if [ -z "$version" ]; then
    echo "  SKIP: could not read version from $dir/package.json"
    continue
  fi
  echo "  version: $version"

  # --- npm publish (idempotent: skip if this exact version is already live) ---
  published_version=$(curl -s --max-time 10 "https://registry.npmjs.org/${pkg}/${version}" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ "$published_version" = "$version" ]; then
    echo "  npm: ${pkg}@${version} already published, skipping"
  else
    run bash -c "cd '$dir' && npm publish --access public"
  fi

  # --- git tag (idempotent: skip if tag exists) ---
  tag="mcp-${name}-v${version}"
  if git -C "$ROOT" rev-parse "$tag" >/dev/null 2>&1; then
    echo "  git tag $tag already exists, skipping"
  else
    run git -C "$ROOT" tag "$tag"
    run git -C "$ROOT" push origin "$tag"
  fi

  # --- mcp-publisher publish (idempotent-ish: mcp-publisher itself rejects a
  #     duplicate version; we just attempt and let it report that) ---
  server_json="$dir/server.json"
  if [ -f "$server_json" ]; then
    run mcp-publisher publish "$server_json"
  else
    echo "  SKIP mcp-publisher: no server.json at $server_json"
  fi

  echo "  URLs:"
  echo "    npm:      https://www.npmjs.com/package/${pkg}"
  echo "    registry: https://registry.modelcontextprotocol.io/v0/servers?search=mcp-${name}"
  echo "    github:   https://github.com/theluckystrike/mcp-${name}"
done

echo
echo "=== done. Run scripts/registry-check.sh to verify. ==="
