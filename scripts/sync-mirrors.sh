#!/usr/bin/env bash
# sync-mirrors.sh -- publish each servers/<name> folder to its own public mirror repo.
#
# Why: GitHub repository search ranks repository NAME matches, and Glama/Smithery key on
# one repo URL per server. Our servers live in subfolders of a monorepo named
# "mcp-servers", so a search for "mcp time tracker" cannot find them. One repo per
# server, named mcp-<name>, fixes the name axis without splitting development.
#
# The mirrors are read-only: content is copied out of this monorepo, squashed into a
# single commit "sync from monorepo <sha>" and force-pushed to main. Re-running is
# idempotent -- the mirror always ends up with exactly one commit holding the current
# monorepo content.
#
# Self-contained build: no @theluckystrike/* package is on npm, so the mirror vendors
# every @theluckystrike/* dependency reachable from a server's package.json -- recursively,
# so a vendored package's own @theluckystrike deps are vendored too -- into vendor/<pkg>/,
# and rewrites the dependency to a "file:" path pointing at it (siblings under vendor/
# point at each other with "file:../<pkg>"). For office-suite this also vendors its ten
# proxied servers the same way. A fresh clone therefore passes
# npm install && npm run build && npm test with no access to this monorepo.
#
# Usage:
#   scripts/sync-mirrors.sh                 # all six servers
#   scripts/sync-mirrors.sh time-tracker    # one or more named servers
#   DRY_RUN=1 scripts/sync-mirrors.sh       # build the mirror tree, do not create/push
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OWNER="theluckystrike"
MONOREPO="https://github.com/${OWNER}/mcp-servers"
RAW="https://raw.githubusercontent.com/${OWNER}/mcp-servers/main"
ALL_SERVERS="time-tracker price-tracker spreadsheet invoice expense-tracker currency timezone docx resume recurring clauses pdf calendar kanban image bank-statement office-suite"
DRY_RUN="${DRY_RUN:-0}"
export npm_config_cache="${npm_config_cache:-/Users/mike/.npm-cache-local}"

SERVERS="${*:-$ALL_SERVERS}"
SHA="$(git -C "$ROOT" rev-parse HEAD)"

# Repo-specific topics, appended to the five shared ones.
topics_for() {
  case "$1" in
    time-tracker)    echo "time-tracking timesheet freelance" ;;
    price-tracker)   echo "price-tracking price-drop shopping" ;;
    spreadsheet)     echo "spreadsheet xlsx csv" ;;
    invoice)         echo "invoice pdf vat" ;;
    expense-tracker) echo "expenses receipts mileage" ;;
    currency) echo "currency exchange-rates ecb" ;;
    docx) echo "docx word proposal" ;;
    timezone) echo "timezone meeting-planner ics" ;;
    resume) echo "resume cover-letter job-application" ;;
    recurring) echo "recurring-billing subscription forecast" ;;
    clauses) echo "contract clause proposal" ;;
    office-suite)    echo "office productivity bundle" ;;
  esac
}

tagline_for() {
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["servers"][sys.argv[2]]["tagline"])' \
    "$ROOT/data/facts.json" "$1"
}

# Copy a built package into <mirror>/vendor/<dir> with a trimmed package.json. main,
# types and exports are carried through unchanged (subpath exports like mcp-docx's
# "./lib" have to keep resolving from inside the vendor tree). $1 source package dir,
# $2 mirror dir, $3 vendor dir name (e.g. mcp-docx).
vendor_pkg() {
  local src="$1" mirror="$2" name="$3"
  [ -d "$src/dist" ] || { echo "FATAL: $src/dist missing; run npm run build at the monorepo root" >&2; exit 1; }
  mkdir -p "$mirror/vendor/$name"
  cp -R "$src/dist" "$mirror/vendor/$name/dist"
  for f in README.md LICENSE server.json; do
    [ -f "$src/$f" ] && cp "$src/$f" "$mirror/vendor/$name/$f"
  done
  python3 - "$src/package.json" "$mirror/vendor/$name/package.json" <<'PY'
import json, sys
src, dst = sys.argv[1], sys.argv[2]
p = json.load(open(src))
# A vendored package is already built: drop build tooling and scripts so npm install
# never tries to compile it or reach a registry for a package that is not published.
p.pop("devDependencies", None)
p.pop("scripts", None)
deps = p.get("dependencies") or {}
for k in list(deps):
    if k.startswith("@theluckystrike/"):
        # a sibling @theluckystrike dep is vendored alongside this one, as a flat
        # sibling directory under vendor/, so it resolves via a relative file: path
        deps[k] = "file:../" + k.split("/")[-1]
if deps:
    p["dependencies"] = deps
json.dump(p, open(dst, "w"), indent=2)
open(dst, "a").write("\n")
PY
}

# Resolve the source directory in this monorepo for a bare package name (e.g.
# mcp-license, mcp-docx): packages/<name> if it exists there, else servers/<name minus
# the mcp- prefix>.
pkg_src_dir() {
  local base="$1"
  if [ -d "$ROOT/packages/$base" ]; then
    echo "$ROOT/packages/$base"
  else
    echo "$ROOT/servers/${base#mcp-}"
  fi
}

# Vendor a package and, recursively, every @theluckystrike/* package it depends on, into
# <mirror>/vendor/. Idempotent within one mirror build: a package already vendored (e.g.
# mcp-license, shared by every server) is not re-copied when reached again by a second
# dependency path.
vendor_closure() {
  local src="$1" mirror="$2" base="$3"
  [ -d "$mirror/vendor/$base" ] && return 0
  vendor_pkg "$src" "$mirror" "$base"
  local dep depbase
  for dep in $(python3 -c '
import json, sys
p = json.load(open(sys.argv[1]))
for k in (p.get("dependencies") or {}):
    if k.startswith("@theluckystrike/"):
        print(k)
' "$src/package.json"); do
    depbase="${dep#@theluckystrike/}"
    vendor_closure "$(pkg_src_dir "$depbase")" "$mirror" "$depbase"
  done
}

for NAME in $SERVERS; do
  SRC="$ROOT/servers/$NAME"
  [ -d "$SRC" ] || { echo "FATAL: no servers/$NAME" >&2; exit 1; }
  REPO="mcp-$NAME"
  MIRROR="$(mktemp -d "${TMPDIR:-/tmp}/mirror-$NAME.XXXXXX")"
  echo "=== $REPO  ($MIRROR)"

  # 1. server folder content at the mirror root (no dist, no node_modules, no RESULT.md)
  ( cd "$SRC" && tar -cf - \
      --exclude dist --exclude node_modules --exclude RESULT.md --exclude .git . ) \
    | ( cd "$MIRROR" && tar -xf - )

  cat > "$MIRROR/.gitignore" <<'EOF'
node_modules/
/dist/
*.log
EOF

  # 2. vendored, unpublished dependencies: every @theluckystrike/* package reachable from
  #    this server's own package.json, vendored recursively (so e.g. resume's mcp-docx
  #    dep pulls in mcp-docx's own mcp-license dep too).
  vendor_closure "$ROOT/packages/mcp-license" "$MIRROR" "mcp-license"
  if [ "$NAME" = "office-suite" ]; then
    for CHILD in time-tracker price-tracker spreadsheet invoice expense-tracker currency timezone docx resume recurring clauses; do
      vendor_closure "$ROOT/servers/$CHILD" "$MIRROR" "mcp-$CHILD"
    done
  else
    for DEP in $(python3 -c '
import json, sys
p = json.load(open(sys.argv[1]))
for k in (p.get("dependencies") or {}):
    if k.startswith("@theluckystrike/"):
        print(k)
' "$SRC/package.json"); do
      DEPBASE="${DEP#@theluckystrike/}"
      vendor_closure "$(pkg_src_dir "$DEPBASE")" "$MIRROR" "$DEPBASE"
    done
  fi

  # 3. package.json: point @theluckystrike deps at the vendored copies
  python3 - "$MIRROR/package.json" <<'PY'
import json, sys
path = sys.argv[1]
p = json.load(open(path))
deps = p.get("dependencies") or {}
for k in list(deps):
    if k.startswith("@theluckystrike/"):
        deps[k] = "file:vendor/" + k.split("/")[-1]
json.dump(p, open(path, "w"), indent=2)
open(path, "a").write("\n")
PY

  # 4. MIRROR.md
  cat > "$MIRROR/MIRROR.md" <<EOF
# This repository is a read-only mirror

The source of truth for this server is the monorepo:

${MONOREPO}/tree/main/servers/${NAME}

Issues and pull requests belong there, not here. Anything pushed to this repository is
overwritten on the next sync, which squashes the monorepo folder into a single commit.

## Why the mirror exists

GitHub repository search ranks repository name matches, and the MCP directories (Glama,
Smithery) key on one repository URL per server. In the monorepo this server is a
subfolder, so it carries the monorepo's name. This mirror gives it its own.

## Self-contained build

\`@theluckystrike/mcp-license\` is not published on npm. To keep this mirror buildable on
its own, the built package is vendored into \`vendor/mcp-license/\` and \`package.json\`
depends on it through a \`file:\` path. $( [ "$NAME" = "office-suite" ] && printf 'The ten servers this bundle proxies, and any @theluckystrike package they depend on, are vendored the same way under vendor/mcp-*. ' )So a fresh clone works with no extra setup:

\`\`\`sh
git clone https://github.com/${OWNER}/${REPO}.git
cd ${REPO}
npm install && npm run build && npm test
\`\`\`

\`vendor/\` is generated by \`scripts/sync-mirrors.sh\` in the monorepo. Do not edit it here.
EOF

  # 5. README header: demo image (absolute raw URL into the monorepo), one-click bundle,
  #    hosted endpoint. Inserted right after the H1 so it is the first thing seen.
  DEMO=""
  if [ -f "$ROOT/assets/demo-$NAME.gif" ]; then
    DEMO="![$NAME demo]($RAW/assets/demo-$NAME.gif)"
  elif [ -f "$ROOT/assets/$NAME-logo.png" ]; then
    DEMO="![$NAME]($RAW/assets/$NAME-logo.png)"
  fi
  python3 - "$MIRROR/README.md" "$NAME" "$DEMO" "$MONOREPO" "$RAW" <<'PY'
import re, sys
path, name, demo, monorepo, raw = sys.argv[1:6]
text = open(path).read()
lines = text.split("\n")
i = 1 if lines and lines[0].startswith("# ") else 0
head = []
if demo:
    head.append(demo)
head += [
    "",
    "**One-click install:** download `%s.mcpb` from the [latest release](%s/releases/latest) and double-click it in Claude Desktop." % (name, monorepo),
    "",
    "**Hosted endpoint (no install):** `https://mcp.zovo.one/mcp/%s` (streamable-http; send `Authorization: Bearer <Pro key or anonymous token from https://mcp.zovo.one/mcp/token>`)." % name,
    "",
    "Read-only mirror of [%s/servers/%s](%s/tree/main/servers/%s). See [MIRROR.md](MIRROR.md)." % (monorepo.split("/")[-1], name, monorepo, name),
    "",
]
body = "\n".join(lines[:i] + [""] + head + lines[i:])
# relative monorepo asset paths do not resolve in a mirror -> absolute raw URLs
body = body.replace("](../../assets/", "](%s/assets/" % raw)
# the monorepo README already carries the same demo image further down: keep one copy
if demo:
    first = body.index(demo) + len(demo)
    body = body[:first] + body[first:].replace(demo + "\n", "", 1)
body = re.sub(r"\]\(\.\./\.\./(?!assets/)([^)]*)\)", r"](%s/tree/main/\1)" % monorepo, body)
open(path, "w").write(body)
PY

  # 5a2. office-suite test fixtures (proxy.test.mjs, round7.test.mjs, ...) symlink the
  #      monorepo's node_modules three levels up from test/; in a mirror the package root
  #      is the repo root, so it is one up. Applied to every test file, not just one name.
  for T in "$MIRROR"/test/*.mjs; do
    [ -f "$T" ] || continue
    python3 -c 'import sys; p=sys.argv[1]; t=open(p).read(); open(p,"w").write(t.replace("join(here, \"..\", \"..\", \"..\", \"node_modules\"", "join(here, \"..\", \"node_modules\""))' "$T"
  done

  # 5a3. recurring's smoke test spawns the sibling invoice server directly (as a second
  #      process, to confirm the invoice server's own process sees what recurring wrote)
  #      via a "../../invoice/dist/index.js" monorepo-sibling path. In a mirror that
  #      sibling folder does not exist; the vendored copy at vendor/mcp-invoice does.
  if [ -f "$MIRROR/test/smoke.test.mjs" ]; then
    python3 -c 'import sys; p=sys.argv[1]; t=open(p).read(); open(p,"w").write(t.replace(
        "join(here, \"..\", \"..\", \"invoice\", \"dist\", \"index.js\")",
        "join(here, \"..\", \"vendor\", \"mcp-invoice\", \"dist\", \"index.js\")"))' "$MIRROR/test/smoke.test.mjs"
  fi

  # 5b. pro-tier tests sign a key with keys/license-private.pem, which is private to the
  #     monorepo and must never reach a public mirror. Mark exactly those tests skipped so
  #     a fresh clone runs green on the free-tier suite.
  for T in "$MIRROR"/test/*.mjs; do
    [ -f "$T" ] || continue
    python3 - "$T" <<'PYTESTS'
import re, sys
path = sys.argv[1]
src = open(path).read()
if "sign-license" not in src:
    sys.exit(0)
lines = src.split("\n")
starts = [i for i, l in enumerate(lines) if l.startswith("test(")]
head = lines[:starts[0]] if starts else lines
# a module-scope line that actually signs a key (not just builds the signer path)
toplevel_key = any("sign-license" in l and ".trim()" in l for l in head)
# variables that hold the signer path, so blocks using them count as pro-tier too
signer_vars = re.findall(r"const\s+(\w+)\s*=\s*[^;]*sign-license", "\n".join(head))
NOTE = ("// Mirror note: tests that need a signed Pro key are skipped here. The signing key\n"
        "// lives only in the monorepo (keys/license-private.pem); run them there.\n")

def is_pro(block):
    text = "\n".join(block)
    if "sign-license" in text:
        return True
    return any(re.search(r"\b%s\b" % v, text) for v in signer_vars)

if toplevel_key or not starts:
    # the key is computed at module scope, so every test in this file depends on it
    src = re.sub(r"execFileSync\([^;]*sign-license[^;]*\.trim\(\)", '""', src)
    src = re.sub(r"^test\(", "test.skip(", src, flags=re.M)
else:
    bounds = starts + [len(lines)]
    out = lines[:starts[0]]
    for a, b in zip(bounds, bounds[1:]):
        block = lines[a:b]
        if is_pro(block):
            block[0] = "test.skip(" + block[0][len("test("):]
        out += block
    src = "\n".join(out)
open(path, "w").write(NOTE + src)
PYTESTS
  done

  # 6. one squashed commit
  git -C "$MIRROR" init -q -b main
  git -C "$MIRROR" add -A
  git -C "$MIRROR" -c user.name="theluckystrike" -c user.email="support@zovo.one" \
    commit -q -m "sync from monorepo $SHA"

  if [ "$DRY_RUN" = "1" ]; then
    echo "DRY_RUN: mirror built at $MIRROR (not pushed)"
    continue
  fi

  # 7. repo, push, metadata
  DESC="$(tagline_for "$NAME")"
  if ! gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
    gh repo create "$OWNER/$REPO" --public --description "$DESC" \
      --homepage "https://mcp.zovo.one/s/$NAME"
  fi
  git -C "$MIRROR" remote add origin "https://github.com/$OWNER/$REPO.git"
  git -C "$MIRROR" push -q --force origin main
  gh repo edit "$OWNER/$REPO" --description "$DESC" \
    --homepage "https://mcp.zovo.one/s/$NAME" --default-branch main >/dev/null
  TOPIC_ARGS=()
  for t in mcp mcp-server model-context-protocol claude cursor $(topics_for "$NAME"); do
    TOPIC_ARGS+=(-f "names[]=$t")
  done
  gh api -X PUT "repos/$OWNER/$REPO/topics" "${TOPIC_ARGS[@]}" >/dev/null
  echo "pushed https://github.com/$OWNER/$REPO"
done
