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
)

declare -A KEYWORDS=(
  [time-tracker]='["mcp","model-context-protocol","time-tracking","timesheet","invoicing","freelance"]'
  [price-tracker]='["mcp","model-context-protocol","price-tracking","price-drop","shopping","deals"]'
  [spreadsheet]='["mcp","spreadsheet","xlsx","csv","excel","modelcontextprotocol"]'
  [invoice]='["mcp","model-context-protocol","invoice","invoicing","pdf","vat","freelance"]'
  [expense-tracker]='["mcp","model-context-protocol","expenses","receipts","mileage","vat","freelance"]'
)

for NAME in time-tracker price-tracker spreadsheet invoice expense-tracker; do
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

echo "=== all bundles built ==="
ls -la "$BUNDLES"/*.mcpb
