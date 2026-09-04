#!/usr/bin/env bash
# publish-all.sh — publish every @theluckystrike/* package in this workspace to npm,
# in dependency order. DRY RUN by default: runs `npm publish --access public --dry-run`
# for each package and prints a table. Pass --go to run a real `npm publish`.
#
# The package list and the publish order are both derived from the workspace, not
# hardcoded: every package.json under packages/* and servers/* (per the "workspaces"
# globs in the root package.json) is read, and a topological sort over each package's
# own @theluckystrike/* "dependencies" entries decides the order — a package publishes
# only after every @theluckystrike/* package it depends on. Idempotent: a package whose
# exact current version is already on the npm registry is skipped.
#
# Known cycle: @theluckystrike/mcp-license depends on @theluckystrike/mcp-timezone, and
# @theluckystrike/mcp-timezone depends on @theluckystrike/mcp-license. A strict
# topological order does not exist for these two. The sort below breaks the cycle by
# publishing whichever of the two has the most other packages depending on it first
# (mcp-license, depended on by every other package here) and prints a CYCLE line when
# it does. This does not block a real npm publish: `npm publish` never resolves a
# package's own dependencies against the registry, so the two can be published in
# either order and an installer resolves both once they both exist on npm.
#
# Requires: npm, node, git. Requires npm login already done (npm whoami succeeds)
# before --go.
#
# Usage:
#   scripts/publish-all.sh            # dry run (default, safe)
#   scripts/publish-all.sh --go       # execute for real

set -uo pipefail

export npm_config_cache="${npm_config_cache:-/Users/mike/.npm-cache-local}"
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:/opt/homebrew/bin:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GO=0
[ "${1:-}" = "--go" ] && GO=1

echo "=== publish-all.sh  (mode: $([ "$GO" = 1 ] && echo EXECUTE || echo DRY-RUN)) ==="
echo

if [ "$GO" = "1" ]; then
  if ! npm whoami >/dev/null 2>&1; then
    echo "FATAL: npm whoami failed. Run 'npm login --auth-type=web' first. See docs/HUMAN_GATED_PACK.md section 1." >&2
    exit 1
  fi
  echo "npm authenticated as: $(npm whoami)"
  echo
fi

# --- discover every workspace package and topo-sort by @theluckystrike/* deps ---
# Emits one "dir|name|version|bin" line per package, in publish order, and a leading
# "# CYCLE: ..." comment line for each cycle-break the sort had to make.
ORDER_OUTPUT="$(node -e '
const fs = require("fs");
const path = require("path");
const root = process.argv[1];

function findPackages(globDir) {
  const base = path.join(root, globDir);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base)
    .map((n) => path.join(base, n))
    .filter((p) => fs.existsSync(path.join(p, "package.json")));
}

const dirs = [...findPackages("packages"), ...findPackages("servers")];
const pkgs = {}; // name -> {dir, name, version, bin, deps: [names]}
for (const dir of dirs) {
  const pj = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  pkgs[pj.name] = {
    dir,
    name: pj.name,
    version: pj.version,
    bin: pj.bin || null,
    deps: Object.keys(pj.dependencies || {}).filter((d) => d.startsWith("@theluckystrike/")),
  };
}

const names = Object.keys(pkgs).sort();
const remaining = new Set(names);
const order = [];
const cycles = [];

while (remaining.size > 0) {
  // in-degree 0 among remaining = every @theluckystrike dep already placed
  let ready = names.filter((n) => remaining.has(n) &&
    pkgs[n].deps.every((d) => !remaining.has(d) || !pkgs[d]));
  if (ready.length === 0) {
    // cycle: pick the remaining package with the most remaining dependents
    let best = null, bestCount = -1;
    for (const n of remaining) {
      const dependents = names.filter((m) => remaining.has(m) && pkgs[m].deps.includes(n)).length;
      if (dependents > bestCount) { best = n; bestCount = dependents; }
    }
    const blockedBy = pkgs[best].deps.filter((d) => remaining.has(d));
    cycles.push(`# CYCLE: ${best} depends on ${blockedBy.join(", ")} which depend(s) back on it (directly or transitively); publishing ${best} first, breaking the edge to ${blockedBy.join(", ")}`);
    ready = [best];
  }
  ready.sort();
  for (const n of ready) {
    order.push(n);
    remaining.delete(n);
  }
}

for (const c of cycles) console.log(c);
for (const n of order) {
  const p = pkgs[n];
  const binPath = p.bin ? Object.values(p.bin)[0] : "";
  console.log(`${p.dir}|${p.name}|${p.version}|${binPath}`);
}
' "$ROOT")"

CYCLE_LINES="$(printf '%s\n' "$ORDER_OUTPUT" | grep '^# CYCLE' || true)"
PKG_LINES="$(printf '%s\n' "$ORDER_OUTPUT" | grep -v '^# CYCLE' | grep -v '^$' || true)"

if [ -n "$CYCLE_LINES" ]; then
  echo "--- dependency cycle(s) detected ---"
  printf '%s\n' "$CYCLE_LINES"
  echo
fi

TOTAL=$(printf '%s\n' "$PKG_LINES" | grep -c '|' || true)
echo "--- publish order ($TOTAL packages) ---"
i=0
printf '%s\n' "$PKG_LINES" | while IFS='|' read -r dir name version bin; do
  i=$((i+1))
  echo "  $i. $name@$version"
done
echo

printf '%-4s %-38s %-10s %-24s\n' "#" "PACKAGE" "VERSION" "STATUS"
printf '%-4s %-38s %-10s %-24s\n' "----" "--------------------------------------" "----------" "------------------------"

n=0
while IFS='|' read -r dir name version bin; do
  [ -z "$name" ] && continue
  n=$((n+1))

  if [ ! -d "$dir" ]; then
    printf '%-4s %-38s %-10s %-24s\n' "$n" "$name" "$version" "SKIP: dir missing"
    continue
  fi

  status="ok"
  published_version=$(npm view "${name}@${version}" version 2>/dev/null | tail -1)
  if [ "$published_version" = "$version" ]; then
    printf '%-4s %-38s %-10s %-24s\n' "$n" "$name" "$version" "SKIP: already on npm"
    continue
  fi

  if [ -n "$bin" ] && [ ! -f "$dir/$bin" ]; then
    status="WARN: bin missing ($bin)"
  fi
  if [ ! -d "$dir/dist" ]; then
    status="WARN: dist/ missing"
  fi

  if [ "$GO" = "1" ]; then
    (cd "$dir" && npm publish --access public) 2>&1 | sed 's/^/      /'
    printf '%-4s %-38s %-10s %-24s\n' "$n" "$name" "$version" "PUBLISHED"
  else
    echo "  --- $name@$version dry-run pack contents ---"
    (cd "$dir" && npm publish --access public --dry-run) 2>&1 | sed 's/^/      /'
    printf '%-4s %-38s %-10s %-24s\n' "$n" "$name" "$version" "DRY-RUN ($status)"
  fi
done <<< "$PKG_LINES"

echo
echo "=== done. $([ "$GO" = 1 ] && echo "Verify with scripts/registry-check.sh." || echo "Re-run with --go once npm whoami succeeds.") ==="
