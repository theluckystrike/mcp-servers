#!/opt/homebrew/bin/bash
# Requires bash >= 4 (associative arrays). macOS ships bash 3.2 at /bin/bash, which
# cannot run this script; shebang pins the homebrew bash (5.x) directly.
# Build one-click Claude Desktop extension bundles (.mcpb) for every server.
# Idempotent: safe to re-run; each server's bundles/<name>/ dir is rebuilt from scratch.
# Writes only into bundles/ and reads (never edits) servers/* and packages/*.
#
# Unpublished siblings: several servers depend on @theluckystrike/* packages that are not
# on npm (mcp-license, and now mcp-docx / mcp-invoice, which resume, clauses and recurring
# import as engines). Those are resolved generically and recursively from each server's
# own package.json: the whole @theluckystrike closure is vendored into
# server/node_modules/@theluckystrike/<pkg>/, and their non-@theluckystrike runtime deps
# are merged into the temporary server/package.json so one npm install covers everything.
set -euo pipefail

ROOT="/Users/mike/mcp-servers"
export npm_config_cache="${npm_config_cache:-/Users/mike/.npm-cache-local}"
mkdir -p "$npm_config_cache"

BUNDLES="$ROOT/bundles"
mkdir -p "$BUNDLES"

MCPB="npx -y @anthropic-ai/mcpb"
LIC_SRC="$ROOT/packages/mcp-license"

SERVERS="time-tracker price-tracker spreadsheet invoice expense-tracker currency timezone docx resume recurring clauses pdf calendar"

declare -A DISPLAY_NAME=(
  [time-tracker]="Time Tracker"
  [price-tracker]="Price Tracker"
  [spreadsheet]="Spreadsheet"
  [invoice]="Invoice"
  [expense-tracker]="Expense Tracker"
  [currency]="Currency Converter"
  [timezone]="Timezone Planner"
  [docx]="Docx"
  [resume]="Resume"
  [recurring]="Recurring Invoices"
  [clauses]="Clause Library"
  [pdf]="PDF Tools"
  [calendar]="Calendar"
)

declare -A KEYWORDS=(
  [time-tracker]='["mcp","model-context-protocol","time-tracking","timesheet","invoicing","freelance"]'
  [price-tracker]='["mcp","model-context-protocol","price-tracking","price-drop","shopping","deals"]'
  [spreadsheet]='["mcp","spreadsheet","xlsx","csv","excel","modelcontextprotocol"]'
  [invoice]='["mcp","model-context-protocol","invoice","invoicing","pdf","vat","freelance"]'
  [expense-tracker]='["mcp","model-context-protocol","expenses","receipts","mileage","vat","freelance"]'
  [currency]='["mcp","model-context-protocol","currency","exchange-rates","ecb","fx"]'
  [timezone]='["mcp","model-context-protocol","timezone","meeting","scheduling","ics"]'
  [docx]='["mcp","model-context-protocol","docx","word","proposal","contract","markdown"]'
  [resume]='["mcp","model-context-protocol","resume","cv","cover-letter","docx","job-application"]'
  [recurring]='["mcp","model-context-protocol","invoice","recurring","subscription","billing","freelance"]'
  [clauses]='["mcp","model-context-protocol","contract","clauses","legal","docx","proposal"]'
  [pdf]='["mcp","model-context-protocol","pdf","merge","split","stamp"]'
  [calendar]='["mcp","model-context-protocol","calendar","ics","events","freebusy"]'
)

# ------------------------------------------------------------------ helpers

# True when servers/<name> is buildable right now (package.json + a built dist).
server_ready() {
  [ -f "$ROOT/servers/$1/package.json" ] && [ -d "$ROOT/servers/$1/dist" ]
}

# Transitive closure of the @theluckystrike/* dependencies of one package.json.
# Prints "<package name><TAB><source dir>" per line, dependencies before dependents.
# @theluckystrike/mcp-<x> resolves to packages/mcp-<x> first, then servers/<x>.
closure_of() {
  node -e '
    const fs = require("fs"), path = require("path");
    const ROOT = process.argv[1];
    const srcDir = (pkg) => {
      const base = pkg.slice("@theluckystrike/".length);
      const short = base.replace(/^mcp-/, "");
      for (const d of [path.join(ROOT, "packages", base), path.join(ROOT, "servers", short)]) {
        if (fs.existsSync(path.join(d, "package.json"))) return d;
      }
      return null;
    };
    const out = new Map();
    const walk = (pjPath) => {
      const p = JSON.parse(fs.readFileSync(pjPath, "utf8"));
      for (const k of Object.keys(p.dependencies || {})) {
        if (!k.startsWith("@theluckystrike/") || out.has(k)) continue;
        const d = srcDir(k);
        if (!d) throw new Error("no source directory in this monorepo for " + k);
        if (!fs.existsSync(path.join(d, "dist"))) {
          throw new Error(k + " has no dist/: run npm run build in " + d + " first");
        }
        out.set(k, d);
        walk(path.join(d, "package.json"));
      }
    };
    for (const pj of process.argv.slice(2)) walk(pj);
    for (const [k, v] of out) console.log(k + "\t" + v);
  ' "$ROOT" "$@"
}

# Vendor one built @theluckystrike package into <node_modules>/@theluckystrike/<pkg>/.
# The source layout is preserved (dist/ stays dist/) and main/types/exports are copied
# from the source package.json, so subpath exports such as "./lib" keep working.
# scripts, devDependencies and dependencies are dropped: the package is already built and
# every runtime dependency is hoisted into the bundle's own node_modules by npm install.
vendor_one() {
  local pkg="$1" src="$2" nm="$3"
  local dest="$nm/@theluckystrike/${pkg#@theluckystrike/}"
  rm -rf "$dest"
  mkdir -p "$dest"
  cp -R "$src/dist" "$dest/dist"
  node -e '
    const fs = require("fs");
    const p = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const out = { name: p.name, version: p.version, type: p.type || "module" };
    if (p.main) out.main = p.main;
    if (p.types) out.types = p.types;
    if (p.exports) out.exports = p.exports;
    if (!p.main && !p.exports) { out.main = "dist/index.js"; }
    fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + "\n");
  ' "$src/package.json" "$dest/package.json"
}

# Vendor a whole closure (output of closure_of) into a bundle's node_modules.
vendor_closure() {
  local nm="$1" line pkg src
  shift
  while IFS=$'\t' read -r pkg src; do
    [ -n "$pkg" ] || continue
    vendor_one "$pkg" "$src" "$nm"
  done <<< "$1"
}

# Merge the runtime dependencies of a set of package.json files, dropping every
# @theluckystrike/* entry (those are vendored, never installed) and refusing a conflict.
merged_deps_json() {
  node -e '
    const fs = require("fs");
    const deps = {};
    for (const pj of process.argv.slice(1)) {
      const p = JSON.parse(fs.readFileSync(pj, "utf8"));
      for (const [k, v] of Object.entries(p.dependencies || {})) {
        if (k.startsWith("@theluckystrike/")) continue;
        if (deps[k] && deps[k] !== v) {
          throw new Error("dependency version conflict for " + k + ": " + deps[k] + " vs " + v + " (from " + pj + ")");
        }
        deps[k] = v;
      }
    }
    process.stdout.write(JSON.stringify(deps));
  ' "$@"
}

# ------------------------------------------------------------ per-server bundles

for NAME in $SERVERS; do
  SRC_DIR="$ROOT/servers/$NAME"
  OUT_DIR="$BUNDLES/$NAME"
  PKG_JSON="$SRC_DIR/package.json"

  if ! server_ready "$NAME"; then
    echo "=== $NAME: SKIPPED (no package.json or no dist yet -- server still under construction)"
    continue
  fi
  echo "=== $NAME ==="

  VERSION=$(node -e "console.log(require('$PKG_JSON').version)")
  DESCRIPTION=$(node -e "console.log(require('$PKG_JSON').description)")

  # 0. Every unpublished @theluckystrike package this server needs, recursively
  #    (e.g. resume -> mcp-docx -> mcp-license).
  CLOSURE="$(closure_of "$PKG_JSON")"
  CLOSURE_PKGS="$(printf '%s\n' "$CLOSURE" | awk 'NF{print $1}' | tr '\n' ' ')"
  CLOSURE_JSONS=()
  while IFS=$'\t' read -r _p _d; do
    [ -n "$_d" ] && CLOSURE_JSONS+=("$_d/package.json")
  done <<< "$CLOSURE"
  echo "    vendored siblings: ${CLOSURE_PKGS:-none}"

  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR/server"

  # 1. Copy dist -> server/
  cp -R "$SRC_DIR/dist/." "$OUT_DIR/server/"

  # 2. Self-contained server/package.json: the server's own production deps merged with
  #    the production deps of every vendored sibling, minus the @theluckystrike/* ones.
  DEPS_JSON="$(merged_deps_json "$PKG_JSON" "${CLOSURE_JSONS[@]}")"
  node -e "
    const fs = require('fs');
    const pkg = require(process.argv[1]);
    const out = { name: pkg.name, version: pkg.version, type: 'module', dependencies: JSON.parse(process.argv[3]) };
    fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
  " "$PKG_JSON" "$OUT_DIR/server/package.json" "$DEPS_JSON"

  # 3. Vendor the closure into server/node_modules.
  vendor_closure "$OUT_DIR/server/node_modules" "$CLOSURE"

  # 4. Install remaining production deps (sdk, zod, and any server-specific extra
  #    such as xlsx/pdfkit/docx) into server/node_modules. --ignore-scripts and
  #    --no-package-lock keep this from touching anything outside OUT_DIR.
  ( cd "$OUT_DIR/server" && npm install --omit=dev --no-audit --no-fund --ignore-scripts --no-package-lock ) \
    > "$OUT_DIR/.npm-install.log" 2>&1 \
    || { echo "npm install failed for $NAME:"; cat "$OUT_DIR/.npm-install.log"; exit 1; }

  # npm install may have removed/altered the vendored dirs; restore them last.
  vendor_closure "$OUT_DIR/server/node_modules" "$CLOSURE"

  # 5. Extract tool name/description pairs from src/index.ts (registerTool calls)
  #    plus the two shared license tools from the vendored mcp-license package.
  TOOLS_JSON=$(node "$ROOT/scripts/extract-tools.mjs" "$SRC_DIR/src/index.ts" "$LIC_SRC/dist/index.js")

  # 6. Write manifest.json
  node "$ROOT/scripts/gen-manifest.mjs" \
    "$NAME" "${DISPLAY_NAME[$NAME]}" "$VERSION" "$DESCRIPTION" \
    "${KEYWORDS[$NAME]}" "$TOOLS_JSON" "$OUT_DIR/manifest.json"

  # 7. Validate + pack
  ( cd "$OUT_DIR" && $MCPB validate manifest.json ) 2>&1 | tee "$OUT_DIR/.validate.log"
  rm -f "$BUNDLES/$NAME.mcpb"
  ( cd "$OUT_DIR" && $MCPB pack . "$BUNDLES/$NAME.mcpb" ) 2>&1 | tee "$OUT_DIR/.pack.log"

  echo "--- $NAME done: $(du -h "$BUNDLES/$NAME.mcpb" | cut -f1) ---"
done

# ------------------------------------------------------------------ office-suite

echo "=== office-suite ==="
# office-suite proxies the servers above as stdio children, resolved by
# servers/office-suite/src/index.ts either as ../../<id>/dist/index.js (monorepo)
# or via require.resolve("@theluckystrike/mcp-<id>/dist/index.js") (installed).
# For a standalone bundle neither path exists on its own, so every sibling
# (plus their own unpublished dependencies) is vendored into server/node_modules here.
OS_SRC_DIR="$ROOT/servers/office-suite"
OS_OUT_DIR="$BUNDLES/office-suite"
OS_PKG_JSON="$OS_SRC_DIR/package.json"

if [ ! -d "$OS_SRC_DIR/dist" ]; then
  echo "office-suite: SKIPPED (no dist yet, run npm run build in servers/office-suite)" >&2
  exit 0
fi

# Children are the servers that actually built; one still under construction is skipped
# (office-suite already declares resume, recurring and clauses as optional children).
CHILDREN=""
for CHILD in $SERVERS; do
  if server_ready "$CHILD"; then
    CHILDREN="$CHILDREN $CHILD"
  else
    echo "office-suite: skipping child $CHILD (no dist yet)"
  fi
done
CHILDREN="${CHILDREN# }"
echo "office-suite children: $CHILDREN"

OS_VERSION=$(node -e "console.log(require('$OS_PKG_JSON').version)")
OS_DESCRIPTION=$(node -e "console.log(require('$OS_PKG_JSON').description)")

rm -rf "$OS_OUT_DIR"
mkdir -p "$OS_OUT_DIR/server"

# 1. Copy office-suite's own dist -> server/
cp -R "$OS_SRC_DIR/dist/." "$OS_OUT_DIR/server/"

# 2. The closure here is office-suite's own @theluckystrike deps plus every child's,
#    walked recursively, so resume drags in mcp-docx and mcp-docx drags in mcp-license.
OS_PKG_JSONS=("$OS_PKG_JSON")
for CHILD in $CHILDREN; do OS_PKG_JSONS+=("$ROOT/servers/$CHILD/package.json"); done
OS_CLOSURE="$(closure_of "${OS_PKG_JSONS[@]}")"
# The children themselves must be vendored even when nothing depends on them by name.
for CHILD in $CHILDREN; do
  CHILD_PKG_NAME=$(node -e "console.log(require('$ROOT/servers/$CHILD/package.json').name)")
  if ! printf '%s\n' "$OS_CLOSURE" | grep -q "^${CHILD_PKG_NAME}$(printf '\t')"; then
    OS_CLOSURE="$OS_CLOSURE"$'\n'"$CHILD_PKG_NAME"$'\t'"$ROOT/servers/$CHILD"
  fi
done
OS_CLOSURE="$(printf '%s\n' "$OS_CLOSURE" | awk 'NF')"
echo "office-suite vendored siblings: $(printf '%s\n' "$OS_CLOSURE" | awk '{print $1}' | tr '\n' ' ')"

OS_CLOSURE_JSONS=()
while IFS=$'\t' read -r _p _d; do
  [ -n "$_d" ] && OS_CLOSURE_JSONS+=("$_d/package.json")
done <<< "$OS_CLOSURE"

# 3. Self-contained server/package.json whose "dependencies" is the union of
#    office-suite's own runtime deps and every vendored package's runtime deps,
#    minus the @theluckystrike/* packages (vendored, not published).
OS_DEPS_JSON="$(merged_deps_json "${OS_PKG_JSONS[@]}" "${OS_CLOSURE_JSONS[@]}")"
node -e "
  const fs = require('fs');
  const pkg = require(process.argv[1]);
  const out = { name: pkg.name, version: pkg.version, type: 'module', dependencies: JSON.parse(process.argv[3]) };
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
" "$OS_PKG_JSON" "$OS_OUT_DIR/server/package.json" "$OS_DEPS_JSON"

vendor_closure "$OS_OUT_DIR/server/node_modules" "$OS_CLOSURE"

# 4. Install runtime deps of office-suite AND all siblings (merged package.json above).
( cd "$OS_OUT_DIR/server" && npm install --omit=dev --no-audit --no-fund --ignore-scripts --no-package-lock ) \
  > "$OS_OUT_DIR/.npm-install.log" 2>&1 \
  || { echo "npm install failed for office-suite:"; cat "$OS_OUT_DIR/.npm-install.log"; exit 1; }

# npm install may have removed/altered the vendored @theluckystrike/* dirs; restore them last.
vendor_closure "$OS_OUT_DIR/server/node_modules" "$OS_CLOSURE"

# 5. Extract tool name/description pairs: union of every child's registerTool() calls in
#    src/index.ts, plus the two shared license tools once (extract-tools.mjs appends them
#    for each child; dedupe here).
OS_TOOL_ARGS=()
for CHILD in $CHILDREN; do
  OS_TOOL_ARGS+=("$(node "$ROOT/scripts/extract-tools.mjs" "$ROOT/servers/$CHILD/src/index.ts" "$LIC_SRC/dist/index.js")")
done
OS_TOOLS_JSON=$(node -e "
  const seen = new Map();
  for (const json of process.argv.slice(1)) {
    for (const tool of JSON.parse(json)) {
      if (!seen.has(tool.name)) seen.set(tool.name, tool);
    }
  }
  process.stdout.write(JSON.stringify([...seen.values()]));
" "${OS_TOOL_ARGS[@]}")

# 6. Write manifest.json
node "$ROOT/scripts/gen-manifest.mjs" \
  "office-suite" "Office Suite (all five servers)" "$OS_VERSION" "$OS_DESCRIPTION" \
  '["mcp","model-context-protocol","office","bundle","time-tracking","timesheet","price-tracking","price-drop","shopping","deals","spreadsheet","xlsx","csv","excel","invoice","invoicing","pdf","vat","expenses","receipts","mileage","freelance"]' \
  "$OS_TOOLS_JSON" "$OS_OUT_DIR/manifest.json"

# 7. Validate + pack
( cd "$OS_OUT_DIR" && $MCPB validate manifest.json ) 2>&1 | tee "$OS_OUT_DIR/.validate.log"
rm -f "$BUNDLES/office-suite.mcpb"
( cd "$OS_OUT_DIR" && $MCPB pack . "$BUNDLES/office-suite.mcpb" ) 2>&1 | tee "$OS_OUT_DIR/.pack.log"

echo "--- office-suite done: $(du -h "$BUNDLES/office-suite.mcpb" | cut -f1) ---"

echo "=== all bundles built ==="
ls -la "$BUNDLES"/*.mcpb
