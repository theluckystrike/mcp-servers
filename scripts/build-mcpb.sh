#!/opt/homebrew/bin/bash
# Requires bash >= 4 (associative arrays). macOS ships bash 3.2 at /bin/bash, which
# cannot run this script; shebang pins the homebrew bash (5.x) directly.
# Build one-click Claude Desktop extension bundles (.mcpb) for all four servers.
# Idempotent: safe to re-run; each server's bundles/<name>/ dir is rebuilt from scratch.
# Writes only into bundles/ and reads (never edits) servers/* and packages/mcp-license.
set -euo pipefail

ROOT="/Users/mike/mcp-servers"
export npm_config_cache="${npm_config_cache:-/Users/mike/.npm-cache-local}"
mkdir -p "$npm_config_cache"

BUNDLES="$ROOT/bundles"
mkdir -p "$BUNDLES"

MCPB="npx -y @anthropic-ai/mcpb"

declare -A DISPLAY_NAME=(
  [time-tracker]="Time Tracker"
  [price-tracker]="Price Tracker"
  [spreadsheet]="Spreadsheet"
  [invoice]="Invoice"
  [expense-tracker]="Expense Tracker"
  [currency]="Currency Converter"
)

declare -A KEYWORDS=(
  [time-tracker]='["mcp","model-context-protocol","time-tracking","timesheet","invoicing","freelance"]'
  [price-tracker]='["mcp","model-context-protocol","price-tracking","price-drop","shopping","deals"]'
  [spreadsheet]='["mcp","spreadsheet","xlsx","csv","excel","modelcontextprotocol"]'
  [invoice]='["mcp","model-context-protocol","invoice","invoicing","pdf","vat","freelance"]'
  [expense-tracker]='["mcp","model-context-protocol","expenses","receipts","mileage","vat","freelance"]'
  [currency]='["mcp","model-context-protocol","currency","exchange-rates","ecb","fx"]'
)

for NAME in time-tracker price-tracker spreadsheet invoice expense-tracker currency; do
  echo "=== $NAME ==="
  SRC_DIR="$ROOT/servers/$NAME"
  OUT_DIR="$BUNDLES/$NAME"
  PKG_JSON="$SRC_DIR/package.json"
  LIC_SRC="$ROOT/packages/mcp-license"

  if [ ! -d "$SRC_DIR/dist" ]; then
    echo "FATAL: $SRC_DIR/dist missing, run npm run build in servers/$NAME first" >&2
    exit 1
  fi

  VERSION=$(node -e "console.log(require('$PKG_JSON').version)")
  DESCRIPTION=$(node -e "console.log(require('$PKG_JSON').description)")

  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR/server"

  # 1. Copy dist -> server/
  cp -R "$SRC_DIR/dist/." "$OUT_DIR/server/"

  # 2. Self-contained server/package.json with only production deps of the server.
  node -e "
    const fs = require('fs');
    const pkg = require(process.argv[1]);
    const out = { name: pkg.name, version: pkg.version, type: 'module', dependencies: pkg.dependencies || {} };
    fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
  " "$PKG_JSON" "$OUT_DIR/server/package.json"

  vendor_license() {
    local dest="$OUT_DIR/server/node_modules/@theluckystrike/mcp-license"
    rm -rf "$dest"
    mkdir -p "$dest"
    cp -R "$LIC_SRC/dist/." "$dest/"
    node -e "
      const fs = require('fs');
      const pkg = require(process.argv[1]);
      const out = {
        name: pkg.name, version: pkg.version, type: 'module', main: 'index.js',
        exports: { '.': { types: './index.d.ts', import: './index.js' } }
      };
      fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
    " "$LIC_SRC/package.json" "$dest/package.json"
  }

  # 3. Vendor @theluckystrike/mcp-license (not on npm) into server/node_modules.
  vendor_license

  # 4. Install remaining production deps (sdk, zod, and any server-specific extra
  #    such as xlsx/pdfkit) into server/node_modules. --ignore-scripts and
  #    --no-package-lock keep this from touching anything outside OUT_DIR.
  ( cd "$OUT_DIR/server" && npm install --omit=dev --no-audit --no-fund --ignore-scripts --no-package-lock ) \
    > "$OUT_DIR/.npm-install.log" 2>&1 \
    || { echo "npm install failed for $NAME:"; cat "$OUT_DIR/.npm-install.log"; exit 1; }

  # npm install may have removed/altered the vendored mcp-license dir; restore it last.
  vendor_license

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

echo "=== office-suite ==="
# office-suite proxies the five servers above as stdio children, resolved by
# servers/office-suite/src/index.ts either as ../../<id>/dist/index.js (monorepo)
# or via require.resolve("@theluckystrike/mcp-<id>/dist/index.js") (installed).
# For a standalone bundle neither path exists on its own, so every sibling
# (plus the shared license package) is vendored into server/node_modules here.
OS_SRC_DIR="$ROOT/servers/office-suite"
OS_OUT_DIR="$BUNDLES/office-suite"
OS_PKG_JSON="$OS_SRC_DIR/package.json"
LIC_SRC="$ROOT/packages/mcp-license"
CHILDREN="time-tracker price-tracker spreadsheet invoice expense-tracker currency"

if [ ! -d "$OS_SRC_DIR/dist" ]; then
  echo "FATAL: $OS_SRC_DIR/dist missing, run npm run build in servers/office-suite first" >&2
  exit 1
fi
for CHILD in $CHILDREN; do
  if [ ! -d "$ROOT/servers/$CHILD/dist" ]; then
    echo "FATAL: $ROOT/servers/$CHILD/dist missing, run npm run build in servers/$CHILD first" >&2
    exit 1
  fi
done

OS_VERSION=$(node -e "console.log(require('$OS_PKG_JSON').version)")
OS_DESCRIPTION=$(node -e "console.log(require('$OS_PKG_JSON').description)")

rm -rf "$OS_OUT_DIR"
mkdir -p "$OS_OUT_DIR/server"

# 1. Copy office-suite's own dist -> server/
cp -R "$OS_SRC_DIR/dist/." "$OS_OUT_DIR/server/"

# 2. Self-contained server/package.json whose "dependencies" is the union of
#    office-suite's own runtime deps (sdk) and every sibling's runtime deps
#    (sdk, zod, xlsx, pdfkit, ...), minus the @theluckystrike/* packages
#    (those are vendored, not npm-installed, since they are not published).
node -e "
  const fs = require('fs');
  const path = require('path');
  const root = process.argv[1];
  const osPkg = require(process.argv[2]);
  const children = process.argv.slice(3, -1);
  const deps = {};
  for (const [k, v] of Object.entries(osPkg.dependencies || {})) {
    if (!k.startsWith('@theluckystrike/')) deps[k] = v;
  }
  for (const id of children) {
    const childPkg = require(path.join(root, 'servers', id, 'package.json'));
    for (const [k, v] of Object.entries(childPkg.dependencies || {})) {
      if (k.startsWith('@theluckystrike/')) continue;
      if (deps[k] && deps[k] !== v) {
        throw new Error('dependency version conflict for ' + k + ': ' + deps[k] + ' vs ' + v + ' (from ' + id + ')');
      }
      deps[k] = v;
    }
  }
  const out = { name: osPkg.name, version: osPkg.version, type: 'module', dependencies: deps };
  fs.writeFileSync(process.argv[process.argv.length - 1], JSON.stringify(out, null, 2) + '\n');
" "$ROOT" "$OS_PKG_JSON" $CHILDREN "$OS_OUT_DIR/server/package.json"

vendor_license_os() {
  local dest="$OS_OUT_DIR/server/node_modules/@theluckystrike/mcp-license"
  rm -rf "$dest"
  mkdir -p "$dest"
  cp -R "$LIC_SRC/dist/." "$dest/"
  node -e "
    const fs = require('fs');
    const pkg = require(process.argv[1]);
    const out = {
      name: pkg.name, version: pkg.version, type: 'module', main: 'index.js',
      exports: { '.': { types: './index.d.ts', import: './index.js' } }
    };
    fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
  " "$LIC_SRC/package.json" "$dest/package.json"
}

# 3. Vendor each sibling's own package (main -> dist/index.js) so
#    require.resolve("@theluckystrike/mcp-<id>") in the bundled office-suite
#    entry finds it, plus the shared mcp-license package the same way the
#    per-server loop above vendors it.
vendor_children_os() {
  for CHILD in $CHILDREN; do
    local dest="$OS_OUT_DIR/server/node_modules/@theluckystrike/mcp-$CHILD"
    rm -rf "$dest"
    mkdir -p "$dest/dist"
    cp -R "$ROOT/servers/$CHILD/dist/." "$dest/dist/"
    node -e "
      const fs = require('fs');
      const pkg = require(process.argv[1]);
      const out = { name: pkg.name, version: pkg.version, type: 'module', main: 'dist/index.js' };
      fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
    " "$ROOT/servers/$CHILD/package.json" "$dest/package.json"
  done
  vendor_license_os
}

vendor_children_os

# 4. Install runtime deps of office-suite AND all five siblings (merged
#    package.json above) into server/node_modules. --ignore-scripts and
#    --no-package-lock keep this from touching anything outside OUT_DIR.
( cd "$OS_OUT_DIR/server" && npm install --omit=dev --no-audit --no-fund --ignore-scripts --no-package-lock ) \
  > "$OS_OUT_DIR/.npm-install.log" 2>&1 \
  || { echo "npm install failed for office-suite:"; cat "$OS_OUT_DIR/.npm-install.log"; exit 1; }

# npm install may have removed/altered the vendored @theluckystrike/* dirs; restore them last.
vendor_children_os

# 5. Extract tool name/description pairs: union of every sibling's
#    registerTool() calls in src/index.ts, plus the two shared license
#    tools once (extract-tools.mjs appends them for each sibling; dedupe here).
OS_TOOLS_JSON=$(node -e "
  const seen = new Map();
  for (const json of process.argv.slice(1)) {
    for (const tool of JSON.parse(json)) {
      if (!seen.has(tool.name)) seen.set(tool.name, tool);
    }
  }
  process.stdout.write(JSON.stringify([...seen.values()]));
" \
  "$(node "$ROOT/scripts/extract-tools.mjs" "$ROOT/servers/time-tracker/src/index.ts" "$LIC_SRC/dist/index.js")" \
  "$(node "$ROOT/scripts/extract-tools.mjs" "$ROOT/servers/price-tracker/src/index.ts" "$LIC_SRC/dist/index.js")" \
  "$(node "$ROOT/scripts/extract-tools.mjs" "$ROOT/servers/spreadsheet/src/index.ts" "$LIC_SRC/dist/index.js")" \
  "$(node "$ROOT/scripts/extract-tools.mjs" "$ROOT/servers/invoice/src/index.ts" "$LIC_SRC/dist/index.js")" \
  "$(node "$ROOT/scripts/extract-tools.mjs" "$ROOT/servers/expense-tracker/src/index.ts" "$LIC_SRC/dist/index.js")" \
  "$(node "$ROOT/scripts/extract-tools.mjs" "$ROOT/servers/currency/src/index.ts" "$LIC_SRC/dist/index.js")")

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
