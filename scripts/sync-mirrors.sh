#!/usr/bin/env bash
# sync-mirrors.sh -- publish each servers/<name> folder to its own public mirror repo.
#
# Why: GitHub repository search ranks repository NAME matches, and Glama/Smithery key on
# one repo URL per server. Our servers live in subfolders of a monorepo named
# "mcp-servers", so a search for "mcp time tracker" cannot find them. One repo per
# server, named mcp-<name>, fixes the name axis without splitting development.
#
# The mirrors are read-only: content is copied out of this monorepo and committed as
# "sync from monorepo <sha>". Since 2026-09-09 that commit is made ON TOP of the mirror's
# existing history (fetch main, reset --soft to it, commit, fast-forward push), so a
# mirror accumulates one real commit per sync instead of being force-pushed as a single
# squashed commit. Why: the mirrors are the public face of each server in every directory
# that keys on one repo per server, and a repository whose entire history is one commit is
# graded down for it -- Glama's Maintenance section reads "1 commit in the last 12 weeks"
# on mcp-statement-of-account, which was true and was purely an artefact of squashing.
# The squash path still exists for a mirror that has no commits yet (a new repo) and can
# be forced with SQUASH=1, which force-pushes and discards history.
#
# Each sync also stamps the mirror with a tag and a GitHub release matching the monorepo
# version in the server's package.json, because a mirror genuinely contains the code of
# that release. Release notes are not written here; they point at the monorepo release.
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
#   scripts/sync-mirrors.sh                 # every server
#   scripts/sync-mirrors.sh time-tracker    # one or more named servers
#   DRY_RUN=1 scripts/sync-mirrors.sh       # build the mirror tree, do not create/push
#   SQUASH=1 scripts/sync-mirrors.sh <name> # discard the mirror's history (force-push)
#   NO_RELEASE=1 scripts/sync-mirrors.sh    # push content only, no tag and no release
#
# Rehearsal:
#   LOCAL_REMOTE=/tmp/rehearse scripts/sync-mirrors.sh timezone
# pushes to /tmp/rehearse/mcp-timezone.git (created bare if missing) instead of GitHub and
# skips every gh call, so the whole commit/push/tag path can be exercised -- including the
# second run, which is the one that has to land on top of the first -- before any public
# repository is touched. It is the only supported way to test a change to this script.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OWNER="theluckystrike"
MONOREPO="https://github.com/${OWNER}/mcp-servers"
RAW="https://raw.githubusercontent.com/${OWNER}/mcp-servers/main"
ALL_SERVERS="time-tracker price-tracker spreadsheet invoice expense-tracker currency timezone docx resume recurring clauses pdf calendar kanban image bank-statement quotes barcode zip billing-docs deposits per-diem asset-register statement-of-account cash-book amortization petty-cash work-order catalogue change-order delivery-schedule checklist packing-list office-suite"
DRY_RUN="${DRY_RUN:-0}"
SQUASH="${SQUASH:-0}"
NO_RELEASE="${NO_RELEASE:-0}"
LOCAL_REMOTE="${LOCAL_REMOTE:-}"
export npm_config_cache="${npm_config_cache:-/Users/mike/.npm-cache-local}"

# Fail fast if a server this run would publish has no capability phrase or facts entry:
# without one it would be pushed with a broken description, and finding that out half way
# through 32 mirrors is expensive.
python3 "$ROOT/scripts/mirror-seo.py" check

SERVERS="${*:-$ALL_SERVERS}"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
FAILED_MIRRORS=()

# A transient network error (the class that killed the whole v0.13.0 run at mcp-barcode,
# leaving seven mirrors stale because `set -e` took down the rest of the loop) is worth
# retrying; anything else -- a bad credential, a real 4xx, a missing repo -- is not, and
# retrying it would just burn three sleeps before failing anyway.
is_retryable_error() {
  printf '%s' "$1" | grep -qiE \
    'unexpected eof|connection reset|HTTP[ /][0-9.]*"? ?5[0-9]{2}|gh: .*\b5[0-9]{2}\b|"status"\s*:\s*"?5[0-9]{2}|(^|[^0-9])5(0[0-9]|1[0-9])([^0-9]|$).*(error|unavailable|gateway|timeout)|(error|unavailable|gateway|timeout).*(^|[^0-9])5(0[0-9]|1[0-9])([^0-9]|$)'
}

# Run "$@", retrying up to 3 times (waits of 5s, 15s, 45s between attempts) when the
# failure looks retryable. $1 is a short label for the log line. Returns the wrapped
# command's final exit code; stdout/stderr of a successful attempt is discarded (callers
# that need output should not send it through here), a failed attempt's combined output is
# printed to stderr so the failure is diagnosable.
with_retry() {
  local desc="$1"; shift
  local delays=(5 15 45)
  local i=0 out rc
  while true; do
    out="$("$@" 2>&1)"; rc=$?
    if [ $rc -eq 0 ]; then
      return 0
    fi
    if [ $i -lt ${#delays[@]} ] && is_retryable_error "$out"; then
      echo "  $desc: attempt $((i + 1)) failed (retryable), waiting ${delays[$i]}s: $(printf '%s' "$out" | tail -1)" >&2
      sleep "${delays[$i]}"
      i=$((i + 1))
      continue
    fi
    echo "  $desc: failed: $out" >&2
    return $rc
  done
}

# Search-facing metadata (repo description, topics, README first screen) lives in one
# place: scripts/mirror-seo.py. It is shared with scripts/apply-mirror-seo.mjs, so what a
# sync writes and what is live on the mirrors are the same bytes by construction and a
# metadata fix applied to a live mirror is not reverted by the next sync.
# The full topic list, shared plus repo-specific, comes back from `topics`.
topics_for() {
  python3 "$ROOT/scripts/mirror-seo.py" topics "$1"
}

# The repo `description`. GitHub repository search matches on name, description and
# topics only -- measured, see the note in mirror-seo.py -- so this carries the buyer
# vocabulary rather than the marketing tagline alone.
description_for() {
  python3 "$ROOT/scripts/mirror-seo.py" description "$1"
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

  # A mirror is built from the WORKING TREE, not from a commit, so uncommitted edits are
  # published to a public repository. That is usually what is wanted (sync straight after
  # an edit), but it is worth saying out loud: a half-finished change in servers/<name>
  # reaches the mirror the moment this runs. REQUIRE_CLEAN=1 turns the warning into a skip.
  DIRTY="$(git -C "$ROOT" status --porcelain -- "servers/$NAME" | head -20)"
  if [ -n "$DIRTY" ]; then
    echo "  WARNING: servers/$NAME has uncommitted changes; the mirror will carry them:" >&2
    printf '%s\n' "$DIRTY" | sed 's/^/    /' >&2
    if [ "${REQUIRE_CLEAN:-0}" = "1" ]; then
      echo "  REQUIRE_CLEAN=1: skipping $REPO" >&2
      FAILED_MIRRORS+=("$REPO: skipped, servers/$NAME is dirty and REQUIRE_CLEAN=1")
      continue
    fi
  fi

  # 1. server folder content at the mirror root (no dist, no node_modules, no RESULT.md)
  ( cd "$SRC" && tar -cf - \
      --exclude dist --exclude node_modules --exclude RESULT.md --exclude .git . ) \
    | ( cd "$MIRROR" && tar -xf - )

  # 1b. Overwrite the monorepo Dockerfile with one that can actually build here.
  #     The copied file does `COPY servers ./servers`, a directory a mirror does not have,
  #     so every mirror shipped a Dockerfile that failed on its first COPY. Measured and
  #     fixed 2026-09-08; the replacement below was verified with a real `docker build`
  #     plus a `docker run` that answered initialize and tools/list over stdio.
  #     A mirror is self-contained: every @theluckystrike dependency is under vendor/ with
  #     its dist committed, so the build context is just this directory.
  cat > "$MIRROR/Dockerfile" <<DOCKERFILE
# Build context: this repository. Self-contained: all @theluckystrike dependencies are
# vendored under vendor/ with their dist committed, so nothing outside this directory is
# needed. Generated by scripts/sync-mirrors.sh; edit that, not this.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
COPY vendor ./vendor
COPY src ./src
RUN npm install --no-audit --no-fund && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY vendor ./vendor
COPY --from=build /app/dist ./dist
RUN npm install --omit=dev --no-audit --no-fund
# A stdio MCP server: no port to expose, protocol traffic on stdout only.
CMD ["node", "dist/index.js"]
DOCKERFILE

  cat > "$MIRROR/.gitignore" <<'EOF'
node_modules/
/dist/
*.log
EOF

  # 1c. CI. A mirror is self-contained -- every @theluckystrike dependency is vendored with
  #     its dist committed -- so its own test suite runs from a fresh clone with nothing but
  #     npm. Running it on every push gives anyone who forks this repository a real signal,
  #     and gives the MCP directories one too: Glama grades Maintenance partly on CI and
  #     reported "CI status not available" for mcp-statement-of-account because no mirror
  #     had a workflow. Node 22 matches the Dockerfile base image. This file is generated
  #     by scripts/sync-mirrors.sh in the monorepo; edit that, not this.
  mkdir -p "$MIRROR/.github/workflows"
  cat > "$MIRROR/.github/workflows/ci.yml" <<'EOF'
# Generated by scripts/sync-mirrors.sh in theluckystrike/mcp-servers. Do not edit here.
name: ci

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  test:
    name: install, build, test
    runs-on: ubuntu-latest
    steps:
      # v5 of both: v4 pins a Node 20 action runtime, which the runner now reports as
      # deprecated on every run (measured on mcp-statement-of-account run 34320638505).
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: "22"
      # No lockfile is committed: the mirror pins its own @theluckystrike dependencies
      # through file: paths into vendor/, so npm install is the reproducible step here.
      - run: npm install --no-audit --no-fund
      - run: npm run build
      - run: npm test
EOF

  # 2. vendored, unpublished dependencies: every @theluckystrike/* package reachable from
  #    this server's own package.json, vendored recursively (so e.g. resume's mcp-docx
  #    dep pulls in mcp-docx's own mcp-license dep too).
  vendor_closure "$ROOT/packages/mcp-license" "$MIRROR" "mcp-license"
  #    office-suite is not a special case: its proxied children are exactly the
  #    @theluckystrike deps in its own package.json, and step 3 below rewrites every one
  #    of them to file:vendor/<pkg>, so a hand-maintained child list here silently
  #    produces a mirror whose npm install cannot resolve the children it left out.
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

  # 3b. The same warning as above, for the packages this mirror vendors. Their SOURCE is
  #     not copied -- only their built dist is -- so an uncommitted edit reaches this mirror
  #     only if that package has been rebuilt since. Both halves are reported: whether the
  #     source is dirty, and whether the dist is newer than the dirty source.
  for V in "$MIRROR"/vendor/*; do
    [ -d "$V" ] || continue
    VBASE="$(basename "$V")"
    VSRC="$(pkg_src_dir "$VBASE")"
    VREL="${VSRC#$ROOT/}"
    VDIRTY="$(git -C "$ROOT" status --porcelain -- "$VREL" | head -10)"
    [ -n "$VDIRTY" ] || continue
    echo "  NOTE: vendored $VBASE has uncommitted changes in $VREL:" >&2
    printf '%s\n' "$VDIRTY" | sed 's/^/    /' >&2
    if [ -f "$VSRC/dist/index.js" ] && [ -f "$VSRC/src/index.ts" ] \
       && [ "$VSRC/dist/index.js" -nt "$VSRC/src/index.ts" ]; then
      echo "    and its dist is NEWER than that source, so the mirror carries the edit" >&2
      if [ "${REQUIRE_CLEAN:-0}" = "1" ]; then
        echo "  REQUIRE_CLEAN=1: skipping $REPO" >&2
        FAILED_MIRRORS+=("$REPO: skipped, vendored $VBASE is dirty and rebuilt")
        continue 2
      fi
    fi
  done

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
  python3 "$ROOT/scripts/mirror-seo.py" readme \
    "$MIRROR/README.md" "$NAME" "$DEMO" "$MONOREPO" "$RAW"

  # 5a1. gemini-extension.json at the mirror ROOT. The Gemini CLI extension gallery
  #      indexes a public repo automatically when it carries the gemini-cli-extension
  #      topic and this file at the repository root; there is no submission step. Only
  #      written for a server with a live hosted endpoint -- see hosted() in mirror-seo.py
  #      for why shipping one without an endpoint would break on first use. A stale file
  #      is removed if a server ever loses its endpoint.
  if python3 "$ROOT/scripts/mirror-seo.py" gemini "$NAME" > "$MIRROR/gemini-extension.json.tmp" 2>/dev/null; then
    mv "$MIRROR/gemini-extension.json.tmp" "$MIRROR/gemini-extension.json"
  else
    rm -f "$MIRROR/gemini-extension.json.tmp" "$MIRROR/gemini-extension.json"
  fi

  # 5a2. office-suite test fixtures (proxy.test.mjs, round7.test.mjs, ...) symlink the
  #      monorepo's node_modules three levels up from test/; in a mirror the package root
  #      is the repo root, so it is one up. Applied to every test file, not just one name.
  for T in "$MIRROR"/test/*.mjs; do
    [ -f "$T" ] || continue
    python3 -c 'import sys; p=sys.argv[1]; t=open(p).read(); open(p,"w").write(t.replace("join(here, \"..\", \"..\", \"..\", \"node_modules\"", "join(here, \"..\", \"node_modules\""))' "$T"
  done

  # 5a2b. The same three-levels-up idiom is used for REPO, the monorepo root, so that a
  #       test can read servers/<name>/package.json or spawn a sibling. In a mirror the
  #       package root is one level up from test/ and there is no servers/ directory, so
  #       REPO becomes the mirror root and join(REPO, "servers", "<name>") collapses to it.
  for T in "$MIRROR"/test/*.mjs; do
    [ -f "$T" ] || continue
    python3 - "$T" "$NAME" <<'PYREPO'
import sys
path, name = sys.argv[1], sys.argv[2]
t = open(path).read()
t = t.replace('join(here, "..", "..", "..")', 'join(here, "..")')
t = t.replace('join(REPO, "servers", "%s", ' % name, 'join(REPO, ')
t = t.replace('join(REPO, "servers", "%s")' % name, 'REPO')
open(path, "w").write(t)
PYREPO
  done

  # 5a2d. A mirror holds exactly ONE server, so any monorepo path of the shape
  #       join(REPO, "servers", ...) that survives 5a2b points at something the mirror does
  #       not contain. Two shapes occur and they need opposite treatment:
  #         - the server's OWN folder reached through a constant rather than a literal
  #           (`const PRODUCT = "pdf"; join(REPO, "servers", PRODUCT, ...)`). 5a2b only
  #           rewrites the literal form. That folder IS the mirror root, so rewrite it.
  #         - a SIBLING server's source: statement-of-account's contract suite reads
  #           servers/invoice/src/store.ts to check that the record shape it seeds still
  #           matches what invoice declares. A mirror vendors a sibling's dist, never its
  #           src, so those blocks are marked skipped, as the scripts/ ones are above.
  #       Measured 2026-09-09: without this, a fresh clone of mcp-statement-of-account
  #       failed `npm test` with ENOENT on <clone>/servers/invoice/src/store.ts -- 1 of 47.
  #       Nine servers carry the pattern: amortization, bank-statement, calendar, cash-book,
  #       image, kanban, pdf, petty-cash, statement-of-account.
  for T in "$MIRROR"/test/*.mjs; do
    [ -f "$T" ] || continue
    python3 - "$T" "$NAME" <<'PYSIBLING'
import re, sys
path, name = sys.argv[1], sys.argv[2]
src = open(path).read()
# the server's own folder reached through a constant holding this server's name
for ident in re.findall(r'const\s+(\w+)\s*=\s*"%s"\s*;' % re.escape(name), src):
    src = src.replace('join(REPO, "servers", %s, ' % ident, 'join(REPO, ')
    src = src.replace('join(REPO, "servers", %s)' % ident, 'REPO')
if 'join(REPO, "servers"' not in src:
    open(path, "w").write(src)
    sys.exit(0)
NOTE = ('// Mirror note: tests that read another server\'s source out of the monorepo are\n'
        '// skipped here. A mirror holds one server and vendors a sibling\'s dist, never its\n'
        '// src, so there is nothing to read; run them in the monorepo.\n')
lines = src.split("\n")
starts = [i for i, l in enumerate(lines) if l.startswith("test(") or l.startswith("test.skip(")]
if not starts:
    open(path, "w").write(NOTE + src)
    sys.exit(0)
head = lines[:starts[0]]
# module-scope constants whose value is a sibling path: a block that uses one is skipped too
sib_vars = re.findall(r'const\s+(\w+)\s*=\s*[^;]*join\(REPO, "servers"', "\n".join(head))
bounds = starts + [len(lines)]
out = lines[:starts[0]]
for a, b in zip(bounds, bounds[1:]):
    block = lines[a:b]
    text = "\n".join(block)
    hit = 'join(REPO, "servers"' in text or any(re.search(r"\b%s\b" % v, text) for v in sib_vars)
    if hit and block[0].startswith("test("):
        block[0] = "test.skip(" + block[0][len("test("):]
    out += block
open(path, "w").write(NOTE + "\n".join(out))
PYSIBLING
  done

  # 5a2c. Some assertions reach into the monorepo's own scripts/ (e.g. running
  #       scripts/sync-versions.mjs --check). That directory is not part of a server
  #       folder and never reaches a mirror, so those test blocks are marked skipped
  #       rather than left to fail on a missing file.
  for T in "$MIRROR"/test/*.mjs; do
    [ -f "$T" ] || continue
    python3 - "$T" <<'PYSCRIPTS'
import re, sys
path = sys.argv[1]
src = open(path).read()
if 'join(REPO, "scripts"' not in src:
    sys.exit(0)
lines = src.split("\n")
starts = [i for i, l in enumerate(lines) if l.startswith("test(") or l.startswith("test.skip(")]
if not starts:
    sys.exit(0)
bounds = starts + [len(lines)]
out = lines[:starts[0]]
for a, b in zip(bounds, bounds[1:]):
    block = lines[a:b]
    if 'join(REPO, "scripts"' in "\n".join(block) and block[0].startswith("test("):
        block[0] = "test.skip(" + block[0][len("test("):]
    out += block
note = ("// Mirror note: tests that run a script from the monorepo's scripts/ directory are\n"
        "// skipped here. That directory is not part of a server folder; run them in the monorepo.\n")
open(path, "w").write(note + "\n".join(out))
PYSCRIPTS
  done

  # 5a2e. 5a2c and 5a2d both match a LITERAL monorepo path -- join(REPO, "scripts" and
  #       join(REPO, "servers". A block can also reach the monorepo through a variable, and
  #       then neither pass sees it. delivery-schedule's contract suite drives a table:
  #
  #         const cases = [["scripts/build-mcpb.sh", /.../, "SERVERS list"], ...];
  #         for (const [file, re, what] of cases) readFileSync(join(REPO, file), "utf8");
  #
  #       It asserts the estate registered this server in build-mcpb.sh, sync-mirrors.sh,
  #       build-pages.mjs and two sibling servers -- all monorepo files, none of which a
  #       mirror holds. Measured 2026-09-09 on the generated tree: "not ok 37 - the estate
  #       lists this server everywhere a new server has to be registered". It is a real and
  #       useful check IN THE MONOREPO, so it is marked skipped here rather than rewritten:
  #       there is nothing in a mirror it could truthfully assert. Recognised by a
  #       "scripts/..." or "servers/..." path literal in a block that also calls join(REPO.
  #       delivery-schedule is the only server where such a block is still live; amortization
  #       and petty-cash carry the same literals inside blocks an earlier pass already
  #       skipped, and this pass leaves those alone.
  for T in "$MIRROR"/test/*.mjs; do
    [ -f "$T" ] || continue
    python3 - "$T" <<'PYTABLE'
import re, sys
path = sys.argv[1]
src = open(path).read()
if not re.search(r'"(scripts|servers)/', src) or "join(REPO" not in src:
    sys.exit(0)
lines = src.split("\n")
starts = [i for i, l in enumerate(lines) if l.startswith("test(") or l.startswith("test.skip(")]
if not starts:
    sys.exit(0)
bounds = starts + [len(lines)]
out = lines[:starts[0]]
changed = False
for a, b in zip(bounds, bounds[1:]):
    block = lines[a:b]
    text = "\n".join(block)
    if block[0].startswith("test(") and re.search(r'"(scripts|servers)/', text) and "join(REPO" in text:
        block[0] = "test.skip(" + block[0][len("test("):]
        changed = True
    out += block
if changed:
    NOTE = ("// Mirror note: a test that reads monorepo files through a table of paths is skipped\n"
            "// here. Those files live outside any server folder and never reach a mirror; run it\n"
            "// in the monorepo, which is the only place it can mean anything.\n")
    open(path, "w").write(NOTE + "\n".join(out))
PYTABLE
  done

  # 5a2f. `const SERVERS = join(here, "..", "..")` is the monorepo's servers/ directory,
  #       reached two levels up from test/. 5a2b rewrites the THREE-level form (the repo
  #       root); this two-level one it leaves alone, and in a mirror it points at whatever
  #       happens to sit NEXT TO the clone -- outside the repository entirely. invoice's
  #       round5 suite imports siblings through it:
  #
  #         const inv = await import(join(SERVERS, "invoice", "dist", "money.js"));
  #         const exp = await import(join(SERVERS, "expense-tracker", "dist", "money.js"));
  #
  #       This one hid from the pre-flight for a while and is worth the warning: a harness
  #       that stages every generated tree side by side RECREATES servers/, so the import
  #       resolves and the test passes for a reason a real one-repo clone will not have.
  #       It was caught only because the trees were built in alphabetical order and
  #       time-tracker had not been built yet when invoice ran. Verify a mirror isolated.
  #
  #       Own-folder uses are rewritten to the mirror root, so the second D-R15 block --
  #       which only imports invoice's own money.js -- stays live and keeps its meaning.
  #       A block still reaching a sibling afterwards is skipped, as in 5a2d.
  for T in "$MIRROR"/test/*.mjs; do
    [ -f "$T" ] || continue
    python3 - "$T" "$NAME" <<'PYSERVERS'
import re, sys
path, name = sys.argv[1], sys.argv[2]
src = open(path).read()
if 'join(here, "..", "..")' not in src:
    sys.exit(0)
lines = src.split("\n")
starts = [i for i, l in enumerate(lines) if l.startswith("test(") or l.startswith("test.skip(")]
head = "\n".join(lines[:starts[0]]) if starts else src
esc = re.findall(r'const\s+(\w+)\s*=\s*join\(here,\s*"\.\.",\s*"\.\."\)\s*;', head)
# the mirror IS this server's folder, so servers/<own name>/... is the mirror root
for v in esc:
    src = src.replace('join(%s, "%s", ' % (v, name), 'join(here, "..", ')
    src = src.replace('join(%s, "%s")' % (v, name), 'join(here, "..")')
lines = src.split("\n")
starts = [i for i, l in enumerate(lines) if l.startswith("test(") or l.startswith("test.skip(")]
if not starts:
    open(path, "w").write(src)
    sys.exit(0)
bounds = starts + [len(lines)]
head_lines = lines[:starts[0]]
# Reached from MODULE SCOPE -- invoice's profile-readers.test.mjs walks the directory inside
# serversThatReadSharedProfile(), and shared-profile.test.mjs spawns siblings from a helper
# defined up there -- and then no test in the file can run, exactly as in 5c. Reached only
# from inside blocks (round5), and just those blocks go. The const's own definition line does
# not count as a use, or every file would skip whole.
defline = re.compile(r'\s*const\s+(?:%s)\s*=' % "|".join(re.escape(v) for v in esc)) if esc else None
head_rest = "\n".join(l for l in head_lines if not (defline and defline.match(l)))
module_scope = 'join(here, "..", "..")' in head_rest or any(
    re.search(r"\b%s\b" % v, head_rest) for v in esc)
out = lines[:starts[0]]
skipped = False
for a, b in zip(bounds, bounds[1:]):
    block = lines[a:b]
    text = "\n".join(block)
    reaches = module_scope or 'join(here, "..", "..")' in text or any(
        re.search(r"\b%s\b" % v, text) for v in esc)
    if reaches and block[0].startswith("test("):
        block[0] = "test.skip(" + block[0][len("test("):]
        skipped = True
    out += block
new = "\n".join(out)
if skipped:
    new = ("// Mirror note: a test that reaches the monorepo's servers/ directory, two levels up\n"
           "// from test/, is skipped here. In a mirror that path lands outside the repository;\n"
           "// the sibling servers it wants are only side by side in the monorepo.\n") + new
if new != open(path).read():
    open(path, "w").write(new)
PYSERVERS
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
  # A signer that lives in a shared helper (test/_client.mjs, test/harness.mjs) is not
  # visible to the per-file scan below: the consuming test file never spells
  # sign-license. Collect the identifiers such a helper exports so a test block that
  # calls one is recognised as pro-tier and skipped, rather than left to fail on the
  # empty key the neutralised helper now returns.
  PRO_HELPER_IDS="$(python3 - "$MIRROR" <<'PYIDS'
import os, re, sys
d = os.path.join(sys.argv[1], "test")
ids = set()
if os.path.isdir(d):
    for f in sorted(os.listdir(d)):
        if not f.endswith(".mjs") or f.endswith(".test.mjs"):
            continue
        src = open(os.path.join(d, f)).read()
        if "sign-license" not in src:
            continue
        for m in re.finditer(r"export\s+(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{", src):
            start = m.end()
            depth, i = 1, start
            while i < len(src) and depth:
                if src[i] == "{":
                    depth += 1
                elif src[i] == "}":
                    depth -= 1
                i += 1
            if "sign-license" in src[start:i]:
                ids.add(m.group(1))
        for m in re.finditer(r"export\s+const\s+(\w+)\s*=[^;]*sign-license", src):
            ids.add(m.group(1))
print(" ".join(sorted(ids)))
PYIDS
)"
  [ -n "$PRO_HELPER_IDS" ] && echo "    pro-tier helper exports: $PRO_HELPER_IDS"
  export PRO_HELPER_IDS

  for T in "$MIRROR"/test/*.mjs; do
    [ -f "$T" ] || continue
    python3 - "$T" <<'PYTESTS'
import re, sys
path = sys.argv[1]
src = open(path).read()
import os
helper_ids = [i for i in (os.environ.get("PRO_HELPER_IDS") or "").split() if i]
uses_helper = any(re.search(r"\b%s\b" % i, src) for i in helper_ids)
if "sign-license" not in src and not uses_helper:
    sys.exit(0)
lines = src.split("\n")
starts = [i for i, l in enumerate(lines) if l.startswith("test(") or l.startswith("test.skip(")]
head = lines[:starts[0]] if starts else lines
# a module-scope line that actually signs a key (not just builds the signer path)
toplevel_key = any("sign-license" in l and ".trim()" in l for l in head)
# variables that hold the signer path, so blocks using them count as pro-tier too
signer_vars = re.findall(r"const\s+(\w+)\s*=\s*[^;]*sign-license", "\n".join(head))
signer_vars = signer_vars + helper_ids
# A LOCAL helper in this file that calls a pro-tier helper is pro-tier itself, and the
# blocks that use it never spell the pro-tier name, so the per-block scan below cannot
# see them. petty-cash: `async function withFloat(t, opts = { key: proKey() })`, and
# eleven tests call withFloat(t). With proKey() neutralised to "" they ran on the free
# tier, where float_report answers a different shape, and failed with
# "Cannot read properties of undefined (reading '0')" -- 11 of 44 on a fresh clone,
# measured 2026-09-09, against 44 of 44 in the monorepo. Resolved to a fixpoint, since a
# wrapper can wrap a wrapper.
head_text = "\n".join(head)
marks = [(m.group(1) or m.group(2), m.start()) for m in
         re.finditer(r"^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(|^(?:export\s+)?const\s+(\w+)\s*=",
                     head_text, re.M)]
spans = {}
for i, (nm, at) in enumerate(marks):
    end = marks[i + 1][1] if i + 1 < len(marks) else len(head_text)
    spans[nm] = head_text[at:end]
pro_ids = set(signer_vars)
changed = True
while changed:
    changed = False
    for nm, body in spans.items():
        if nm in pro_ids:
            continue
        if "sign-license" in body or any(re.search(r"\b%s\b" % re.escape(i), body) for i in pro_ids):
            pro_ids.add(nm)
            changed = True
signer_vars = sorted(pro_ids)
NOTE = ("// Mirror note: tests that need a signed Pro key are skipped here. The signing key\n"
        "// lives only in the monorepo (keys/license-private.pem); run them there.\n")

def is_pro(block):
    text = "\n".join(block)
    if "sign-license" in text:
        return True
    return any(re.search(r"\b%s\b" % v, text) for v in signer_vars)

if (toplevel_key and starts) or (not starts and "sign-license" in src):
    # the key is computed at module scope, so every test in this file depends on it
    src = re.sub(r"execFileSync\([^;]*sign-license[^;]*\.trim\(\)", '""', src)
    src = re.sub(r"^test\(", "test.skip(", src, flags=re.M)
else:
    bounds = starts + [len(lines)]
    out = lines[:starts[0]]
    for a, b in zip(bounds, bounds[1:]):
        block = lines[a:b]
        if is_pro(block) and block[0].startswith("test("):
            block[0] = "test.skip(" + block[0][len("test("):]
        out += block
    src = "\n".join(out)
open(path, "w").write(NOTE + src)
PYTESTS
  done

  # 5c. A skipped test can be the one that sets up a later one. timezone's concurrency
  #     suite signs a Pro key into process.env.CONC_KEY inside its first test and the
  #     second test reads it; 5a2c skips the first (it runs the monorepo's sign-license),
  #     which left the second running on an empty key, on the free tier, asserting 10
  #     counted writes and finding 3. Measured 2026-09-09 on a fresh clone of the
  #     generated mcp-timezone tree: 61 tests, 3 failures, that being one of them.
  #     So: an environment variable that is ONLY ever assigned inside skipped blocks is
  #     not going to be set at run time, and every block that reads one is skipped too.
  #     Restricted to names no live block and no module-scope line assigns, so a suite
  #     that sets its own XDG_DATA_HOME per test is untouched. Iterated to a fixpoint,
  #     because skipping a block can make another name dead in turn.
  for T in "$MIRROR"/test/*.mjs; do
    [ -f "$T" ] || continue
    python3 - "$T" <<'PYENV'
import re, sys
path = sys.argv[1]
src = open(path).read()
lines = src.split("\n")
starts = [i for i, l in enumerate(lines) if l.startswith("test(") or l.startswith("test.skip(")]
if not starts:
    sys.exit(0)
bounds = starts + [len(lines)]
head = lines[:starts[0]]
blocks = [lines[a:b] for a, b in zip(bounds, bounds[1:])]
ASSIGN = re.compile(r"process\.env\.([A-Z][A-Z0-9_]*)\s*=(?!=)")
READ = re.compile(r"process\.env\.([A-Z][A-Z0-9_]*)")
changed = True
while changed:
    changed = False
    dead = set()
    for b in blocks:
        if not b[0].startswith("test.skip("):
            continue
        dead |= set(ASSIGN.findall("\n".join(b)))
    live_assigned = set(ASSIGN.findall("\n".join(head)))
    for b in blocks:
        if b[0].startswith("test.skip("):
            continue
        live_assigned |= set(ASSIGN.findall("\n".join(b)))
    dead -= live_assigned
    if not dead:
        break
    # read at module scope (timezone reads CONC_KEY inside the client() helper every test
    # in the file uses) means no test in this file can run without it
    head_dead = set(READ.findall("\n".join(head))) & dead
    for b in blocks:
        if b[0].startswith("test.skip("):
            continue
        if head_dead or (set(READ.findall("\n".join(b))) & dead):
            b[0] = "test.skip(" + b[0][len("test("):]
            changed = True
out = head + [l for b in blocks for l in b]
NOTE = ("// Mirror note: a test whose setup lives in a skipped test is skipped too; it would\n"
        "// otherwise run without the environment that test provides.\n")
new = "\n".join(out)
if new != src:
    open(path, "w").write(NOTE + new)
PYENV
  done

  # 5d. RESULT.md is deliberately excluded from a mirror by step 1: it is the build agent's
  #     internal work log and carries absolute local paths (/Users/...), wall-clock cost and
  #     process notes that have no business in a public repository. Six servers'
  #     contract suites nevertheless assert it exists, in a list of required files:
  #
  #       test("the required files are all present", () => {
  #         for (const f of ["package.json", ..., "SPEC.md", "RESULT.md", ...])
  #           assert.ok(existsSync(join(HERE, f)), `missing ${f}`);
  #
  #     which fails in every mirror. Measured 2026-09-09 on a fresh clone of the generated
  #     tree: mcp-amortization "not ok 37 - the required files are all present / missing
  #     RESULT.md". Affects amortization, catalogue, change-order, delivery-schedule,
  #     petty-cash and work-order. This is the same class as 5a2d -- a test asserting
  #     something a mirror does not contain -- so it gets the same treatment, except that
  #     skipping the whole block would throw away a real check of twenty other files. Only
  #     the one entry is dropped, so the assertion stays meaningful AND true of the mirror.
  #     The other shape, join(HERE, "RESULT.md") in the em-dash sweep, is already harmless:
  #     that list ends in .filter(existsSync), so a missing file drops out on its own.
  for T in "$MIRROR"/test/*.mjs; do
    [ -f "$T" ] || continue
    python3 - "$T" <<'PYRESULT'
import re, sys
path = sys.argv[1]
src = open(path).read()
if '"RESULT.md"' not in src:
    sys.exit(0)
out, changed = [], False
for line in src.split("\n"):
    # only the bare-filename list form; join(HERE, "RESULT.md") is existsSync-filtered
    if '"RESULT.md"' in line and "join(" not in line:
        new = re.sub(r'\s*"RESULT\.md"\s*,', '', line)
        new = re.sub(r',\s*"RESULT\.md"(?=\s*[\]\)])', '', new)
        if new != line:
            line, changed = new, True
    out.append(line)
if changed:
    NOTE = ("// Mirror note: RESULT.md is the monorepo's build log for this server and is not\n"
            "// published to a mirror, so it is dropped from the required-file list below. Every\n"
            "// other file in that list is still checked.\n")
    open(path, "w").write(NOTE + "\n".join(out))
PYRESULT
  done

  # 6. the commit
  git -C "$MIRROR" init -q -b main

  if [ "$DRY_RUN" = "1" ]; then
    git -C "$MIRROR" add -A
    git -C "$MIRROR" -c user.name="theluckystrike" -c user.email="support@zovo.one" \
      commit -q -m "sync from monorepo $SHA"
    echo "DRY_RUN: mirror built at $MIRROR (not pushed)"
    continue
  fi

  # 7. repo, push, metadata
  DESC="$(description_for "$NAME")"
  if [ -n "$LOCAL_REMOTE" ]; then
    mkdir -p "$LOCAL_REMOTE"
    [ -d "$LOCAL_REMOTE/$REPO.git" ] || git init -q --bare "$LOCAL_REMOTE/$REPO.git"
    git -C "$MIRROR" remote add origin "$LOCAL_REMOTE/$REPO.git"
  else
    if ! gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
      gh repo create "$OWNER/$REPO" --public --description "$DESC" \
        --homepage "https://mcp.zovo.one/s/$NAME"
    fi
    git -C "$MIRROR" remote add origin "https://github.com/$OWNER/$REPO.git"
  fi

  # 7a. Commit on top of whatever the mirror already has, so its history is real. The old
  #     behaviour -- a fresh `git init` force-pushed over main -- left every mirror with
  #     exactly one commit no matter how much work went into it, which is what Glama reads
  #     as "1 commit in the last 12 weeks". Squashing is kept only for a mirror that has no
  #     main yet (a repo created a moment ago) and for an explicit SQUASH=1.
  #     A failed fetch is NOT a reason to fall back to force-push: that would silently
  #     destroy the history this step exists to keep. It fails the mirror instead.
  REMOTE_HEAD=""
  if [ "$SQUASH" != "1" ]; then
    REMOTE_HEAD="$(git -C "$MIRROR" ls-remote origin refs/heads/main 2>/dev/null | awk '{print $1}')"
  fi
  NEW_COMMIT=1
  if [ -n "$REMOTE_HEAD" ]; then
    if ! with_retry "fetch $REPO" git -C "$MIRROR" fetch -q origin main; then
      echo "FAILED $REPO: could not fetch existing history; refusing to force-push over it" >&2
      FAILED_MIRRORS+=("$REPO: fetch of existing main failed, nothing pushed")
      continue
    fi
    git -C "$MIRROR" reset -q --soft "$REMOTE_HEAD"
    git -C "$MIRROR" add -A
    if git -C "$MIRROR" diff --cached --quiet; then
      echo "  content already identical to ${REMOTE_HEAD:0:7}; no commit"
      NEW_COMMIT=0
    else
      git -C "$MIRROR" -c user.name="theluckystrike" -c user.email="support@zovo.one" \
        commit -q -m "sync from monorepo $SHA"
    fi
  else
    git -C "$MIRROR" add -A
    git -C "$MIRROR" -c user.name="theluckystrike" -c user.email="support@zovo.one" \
      commit -q -m "sync from monorepo $SHA"
  fi

  if [ "$NEW_COMMIT" = "1" ]; then
    # A history-mode push is a plain fast-forward: if anything else moved main in the
    # meantime it fails loudly instead of overwriting it. Only the squash path forces.
    PUSH_OPTS=(-q origin main)
    [ -z "$REMOTE_HEAD" ] && PUSH_OPTS=(-q --force origin main)
    if ! with_retry "git push $REPO" git -C "$MIRROR" push "${PUSH_OPTS[@]}"; then
      echo "FAILED $REPO: git push failed after retries" >&2
      FAILED_MIRRORS+=("$REPO: git push failed after retries")
      continue
    fi
    # Verify the push landed: the remote tip must be the commit we just made.
    LOCAL_HEAD="$(git -C "$MIRROR" rev-parse HEAD)"
    LANDED="$(git -C "$MIRROR" ls-remote origin refs/heads/main | awk '{print $1}')"
    if [ "$LANDED" != "$LOCAL_HEAD" ]; then
      echo "FAILED $REPO: remote main is $LANDED, expected $LOCAL_HEAD" >&2
      FAILED_MIRRORS+=("$REPO: post-push verification failed")
      continue
    fi
  fi
  if [ -z "$LOCAL_REMOTE" ]; then
    gh repo edit "$OWNER/$REPO" --description "$DESC" \
      --homepage "https://mcp.zovo.one/s/$NAME" --default-branch main >/dev/null
    TOPIC_ARGS=()
    for t in $(topics_for "$NAME"); do
      TOPIC_ARGS+=(-f "names[]=$t")
    done
    if ! with_retry "topics $REPO" gh api -X PUT "repos/$OWNER/$REPO/topics" "${TOPIC_ARGS[@]}"; then
      echo "FAILED $REPO: topics PUT failed after retries" >&2
      FAILED_MIRRORS+=("$REPO: topics PUT failed after retries")
      continue
    fi
  fi

  # 8. Tag and release the version this mirror actually holds. A mirror carries the code of
  #    a specific monorepo release, so the tag is a statement of fact, not a new release of
  #    a different thing; the notes therefore write no changelog of their own and point at
  #    the monorepo release, which is where the notes and the .mcpb bundle live. This exists
  #    because the directories read GitHub releases: Glama's Maintenance section reported
  #    "No stable releases found" for mcp-statement-of-account, which was true -- no mirror
  #    had ever carried a tag. An existing tag is left alone rather than moved, so the tag
  #    keeps pointing at the tree that actually was that version.
  if [ "$NO_RELEASE" != "1" ]; then
    VER="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$MIRROR/package.json")"
    TAG="v$VER"
    if git -C "$MIRROR" ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
      echo "  tag $TAG already on $REPO, left as it is"
    else
      git -C "$MIRROR" -c user.name="theluckystrike" -c user.email="support@zovo.one" \
        tag -a "$TAG" -m "mirror of monorepo $TAG"
      if ! with_retry "push tag $REPO" git -C "$MIRROR" push -q origin "refs/tags/$TAG"; then
        echo "FAILED $REPO: tag push failed after retries" >&2
        FAILED_MIRRORS+=("$REPO: tag push failed after retries")
        continue
      fi
      if [ -z "$LOCAL_REMOTE" ] && ! gh release view "$TAG" --repo "$OWNER/$REPO" >/dev/null 2>&1; then
        NOTES="Read-only mirror of [\`${MONOREPO##*/}/servers/$NAME\`]($MONOREPO/tree/$TAG/servers/$NAME) at version $VER.

This tag marks this repository's copy of the code released as $TAG in the monorepo. The
changelog for that release, and the one-click \`$NAME.mcpb\` bundle, are there:

$MONOREPO/releases/tag/$TAG

The mirror is self-contained -- every \`@theluckystrike/*\` dependency is vendored under
\`vendor/\` with its \`dist\` committed -- so this tag builds and tests from a fresh clone:

\`\`\`sh
git clone --branch $TAG https://github.com/$OWNER/$REPO.git
cd $REPO
npm install && npm run build && npm test
\`\`\`"
        if ! with_retry "release $REPO" gh release create "$TAG" --repo "$OWNER/$REPO" \
             --title "$TAG" --notes "$NOTES"; then
          echo "FAILED $REPO: release create failed after retries" >&2
          FAILED_MIRRORS+=("$REPO: release create failed after retries")
          continue
        fi
        echo "  released $TAG"
      fi
    fi
  fi

  if [ -n "$LOCAL_REMOTE" ]; then
    echo "rehearsed into $LOCAL_REMOTE/$REPO.git (no GitHub call was made)"
  else
    echo "pushed https://github.com/$OWNER/$REPO"
  fi
done

echo ""
if [ ${#FAILED_MIRRORS[@]} -gt 0 ]; then
  echo "=== sync-mirrors summary: ${#FAILED_MIRRORS[@]} mirror(s) failed after retries"
  for f in "${FAILED_MIRRORS[@]}"; do echo "  FAILED: $f"; done
  exit 1
fi
echo "=== sync-mirrors summary: all mirrors synced"
