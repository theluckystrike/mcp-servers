# GEMINI_EXT_R1 -- Gemini CLI extension gallery: verification of the shipped unlock

Date: 2026-09-12
Scope: verification + gap-fix only (coordinator re-scope). Finding: the unlock was
already implemented and already live. No generator code changed this round. Status: DONE.

## 1. Where the feature lives (pre-existing, committed)

- `scripts/mirror-seo.py`
  - `GEMINI_TOPIC = "gemini-cli-extension"` (line 168)
  - `gemini_extension(name)` (lines 212-259) builds the manifest from the server's own
    package.json version, CAPABILITY phrase and facts.json tagline
  - `hosted(name)` (lines 189-204) gates on `data/distribution.json`
  - `topics(name)` (line 278) appends `GEMINI_TOPIC` only when `hosted(name)` is true
- `scripts/sync-mirrors.sh` step 5a1 (lines 388-398) writes `gemini-extension.json` to the
  mirror root via `python3 scripts/mirror-seo.py gemini "$NAME"`, and removes a stale file
  when a server has no endpoint. Step 7 PUTs the topic list on every sync.
- Introduced by commits `0bbf381` (loop 33) and `96727c5`. This round changed none of it.

## 2. Schema findings, from primary sources

Source URLs:

1. https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/extensions/reference.md
2. https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/extensions/releasing.md
3. https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/tools/mcp-server.md
4. Source: packages/cli/src/config/extension-manager.ts (line 787:
   `config = resolveEnvVarsInObject(config, customEnv)`)
5. Source: packages/cli/src/utils/envVarResolver.ts (`$VAR`, `${VAR}`, `${VAR:-default}`
   resolved against the extension's settings env first, then process.env, recursively
   over the whole config object)
6. Source: packages/cli/src/config/extensions/variables.ts (`recursivelyHydrateStrings`
   handles only `${extensionPath}` / `${workspacePath}` / `${/}`; unknown `${VAR}` is left
   intact for layer 5 to resolve)

Minimal valid file:

- `name` (required; lowercase letters/numbers/dashes; expected to match the extension
  directory name) and `version` (required). For GitHub releases the docs say the manifest
  `version` should match the release tag; ours does (`v0.21.0` tag, `"version": "0.21.0"`).
- Optional: `description` (shown on geminicli.com/extensions), `mcpServers`,
  `contextFileName`, `excludeTools`, `settings`, `migratedTo`, `plan`, `themes`.

`mcpServers` entry shape (source 3): exactly one of three transport keys --

| key       | transport                          |
|-----------|------------------------------------|
| `command` | stdio (with `args`, `env`, `cwd`)  |
| `url`     | SSE                                |
| `httpUrl` | streamable HTTP (with `headers`)   |

plus optional `timeout`, `includeTools`, `excludeTools`, `oauth`, etc. `trust` is the
only settings.json MCP option NOT allowed in an extension manifest (source 1).

`settings` entry shape (source 1, verbatim):
`{"name": "API Key", "description": "Your API key for the service.", "envVar": "MY_API_KEY", "sensitive": true}`
Sensitive values are stored in the system keychain; the rest land in the extension's
`.env`. Sources 4+5 prove the declared `${VAR}` is then resolved across the ENTIRE
manifest, including `mcpServers.*.headers` -- so
`"headers": {"Authorization": "Bearer ${ZOVO_MCP_TOKEN}"}` is substituted at load time
with the value the user was prompted for at install.

Gallery indexing (source 2, verbatim quotes): "Add the `gemini-cli-extension` topic to
your repository's About section" because "Our crawler uses this topic to find new
extensions"; "Ensure your `gemini-extension.json` file is in the absolute root of the
repository or the release archive"; "Our system crawls tagged repositories daily";
"You don't need to submit an issue or email us to list your extension." The mirrors
satisfy all three: topic PUT on every sync (sync-mirrors.sh step 7), file at repo root
(step 5a1), annotated tag per release (step 8; `gh api
repos/theluckystrike/mcp-invoice/tags --jq '.[].name'` -> `v0.21.0`).

Real repos sampled (via `gh api -X GET search/repositories -f
q='topic:gemini-cli-extension' --jq '.total_count'` -> 711 on 2026-09-12; DISTRIBUTION_R2
recorded 664):

- wonderwhy-er/DesktopCommanderMCP -- `{"name","version","description", mcpServers:
  {"desktop-commander": {"command": "npx", "args": ["-y", "@wonderwhy-er/desktop-commander"]}},
  "excludeTools": []}`. stdio-via-npx works for them because the package IS on npm.
- pascalorg/editor -- stdio `{"command": "pascal", "args": ["mcp", "connect"]}` plus
  `contextFileName`. Same pattern: the binary the command names actually exists.
- googleworkspace/cli -- name/version/description/contextFileName only, no mcpServers.
  Confirms mcpServers is optional.

## 3. Design decision on the launch command: `httpUrl`, NOT stdio

The task brief suggested stdio command/args matching "the README install snippets".
Measured against the mirrors as they actually ship, every stdio variant is broken on
install, and the README's own first install path is the hosted endpoint:

1. `npx -y @theluckystrike/mcp-<name>` 404s: `curl -s -o /dev/null -w '%{http_code}'
   https://registry.npmjs.org/@theluckystrike%2fmcp-invoice` -> 404; control
   `https://registry.npmjs.org/express` -> 200. Nothing under @theluckystrike is
   published (human-gated, CLAUDE.md rule 10). The two sampled repos can use npx; we
   cannot.
2. `node ${extensionPath}/dist/index.js` points at a file that does not exist in a fresh
   clone: sync-mirrors.sh step 1 excludes `dist` from the mirror and the generated
   `.gitignore` excludes `/dist/`. gemini-extension.json has no install/build hook, so
   nothing would ever produce dist/ at install time.
3. The `.mcpb` bundle is a Claude Desktop format; Gemini CLI does not consume it.

So there is NO working zero-install stdio command, and shipping one would be exactly the
dishonest gallery row the brief warned about. The only working zero-install path is the
hosted endpoint, which is also the FIRST install path the mirror README prints (for
hosted servers). The manifest therefore declares:

```json
"mcpServers": {
  "invoice": {
    "httpUrl": "https://mcp.zovo.one/mcp/invoice",
    "headers": { "Authorization": "Bearer ${ZOVO_MCP_TOKEN}" },
    "description": "..."
  }
}
```

with the token collected by the `settings` prompt (`envVar: ZOVO_MCP_TOKEN`,
`sensitive: true` -> keychain). The bare URL answers 401 on tools/call without the token
(measured below), which is precisely why the token is a declared setting and not assumed
from the host environment. The server alias carries no underscore (invoice, pdf, ...),
per source 1's warning that underscores break the policy engine's fully qualified tool
names.

Honesty gate: a server with no live endpoint gets NO manifest and NO topic
(`hosted()` false), because the manifest would install cleanly and fail on first use.
Currently excluded by that gate: checklist, packing-list ("none by design" in
data/distribution.json), office-suite and delivery-schedule (no hosted entry).

## 4. Verification output (verbatim)

Generator output validates (commands run from /Users/mike/mcp-servers):

```
$ python3 scripts/mirror-seo.py gemini invoice > /tmp/gemini-invoice.json && node -e '...'
JSON.parse: OK
top-level keys: name, version, description, settings, mcpServers
name: mcp-invoice | version: 0.21.0
mcpServers alias: invoice
server keys: httpUrl, headers, description
httpUrl: https://mcp.zovo.one/mcp/invoice
settings[0].envVar: ZOVO_MCP_TOKEN | sensitive: true
schema shape: OK
$ python3 scripts/mirror-seo.py topics invoice
mcp mcp-server model-context-protocol claude claude-desktop claude-code cursor ai llm typescript nodejs invoice invoice-generator vat billing freelance gemini-cli-extension
```

Full mirror build, dry run, nothing pushed:

```
$ DRY_RUN=1 npm_config_cache=/Users/mike/.npm-cache-local scripts/sync-mirrors.sh invoice
mirror-seo check: 34/34 published servers described
=== mcp-invoice  (/var/folders/nd/.../mirror-invoice.2byMHg)
DRY_RUN: mirror built at /var/folders/nd/.../mirror-invoice.2byMHg (not pushed)
=== sync-mirrors summary: all mirrors synced
$ node -e 'JSON.parse(...)' <mirror>/gemini-extension.json
mirror-tree JSON.parse: OK | mcp-invoice 0.21.0 | transport keys: httpUrl,headers,description
generated == live: true        # deep-equal against the file live on mcp-invoice
```

Self-checks:

```
$ python3 scripts/mirror-seo.py check
mirror-seo check: 34/34 published servers described
$ npm_config_cache=/Users/mike/.npm-cache-local node scripts/build-readme.mjs --check
README is current
```

Live-mirror census (six named samples; `gh api repos/theluckystrike/<repo>/topics` and
`.../contents/gemini-extension.json -H 'Accept: application/vnd.github.raw'`):

```
=== mcp-invoice ===      topics: PRESENT   file: mcp-invoice v0.21.0 mcpServers=invoice
=== mcp-pdf ===          topics: PRESENT   file: mcp-pdf v0.21.0 mcpServers=pdf
=== mcp-time-tracker === topics: PRESENT   file: mcp-time-tracker v0.21.0 mcpServers=time-tracker
=== mcp-currency ===     topics: PRESENT   file: mcp-currency v0.21.0 mcpServers=currency
=== mcp-kanban ===       topics: PRESENT   file: mcp-kanban v0.21.0 mcpServers=kanban
=== mcp-quotes ===       topics: PRESENT   file: mcp-quotes v0.21.0 mcpServers=quotes
```

Fleet-wide census (all 34 mirrors; per-repo topic GET cross-checked against
`python3 scripts/mirror-seo.py hosted <name>`):

```
mirrors in expected state: 34/34
gaps:
# 30/30 hosted mirrors carry topic AND root file; 4/4 non-hosted carry neither
```

Launch command, live today (the exact URL and auth form the manifest declares):

```
$ TOKEN=$(curl -s https://mcp.zovo.one/mcp/token | python3 -c '...["token"]')
token minted: 37 chars
$ curl -s -X POST https://mcp.zovo.one/mcp/invoice -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"license_status","arguments":{}}}'
{"result":{"content":[{"type":"text","text":"{\n  \"product\": \"invoice\",\n  \"tier\":
 \"free\",\n  \"transport\": \"remote streamable-http\",\n ... \"source\": \"Authorization: Bearer\" ...
$ # same call without token
401
```

npx defect check (coordinator item 4): the generated file declares NO npx command, so
there is no 404ing launch path. The 404 itself is real and is why npx was rejected:
`curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/@theluckystrike%2fmcp-invoice`
-> 404, control `https://registry.npmjs.org/express` -> 200.

## 5. Files changed this round

None in the generator. The implementation pre-existed and passed every check; patching
it would have churned a verified-correct surface.

Added (working tree, uncommitted, orchestrator reviews):

- `docs/GEMINI_EXT_R1.md` -- this report
- `data/gemini_ext_r1.json` -- machine-readable summary

## 6. Ship command

Nothing to ship: live mirrors are byte-identical to what the generator produces
(`generated == live: true` for invoice; topic census 34/34 in expected state; file
census 30/30). The gallery crawl is Google's side, daily, no action available or needed.

If a future change to the manifest or topics ever needs to reach all mirrors, the command
is the ordinary full sync (no arguments = all 34 servers; it rewrites the file and PUTs
the topic list on every run):

```
cd /Users/mike/mcp-servers && npm_config_cache=/Users/mike/.npm-cache-local scripts/sync-mirrors.sh
```

Rehearsal path for any future generator change, per the script's own contract:
`LOCAL_REMOTE=/tmp/rehearse scripts/sync-mirrors.sh <name>` then `DRY_RUN=1` inspection.

## 7. Residual risk, stated

- The gallery listing itself (geminicli.com/extensions/browse/) is JS-rendered; presence
  of our rows could not be confirmed from curl. The three crawl prerequisites (topic,
  root file, tag) are all verified live, so indexing is a matter of the daily crawl, not
  of anything this estate controls.
- `settings` prompting flows through Gemini CLI's experimental extensionConfig path in
  the current source (extension-manager.ts lines 394-420, 790-830). If a released CLI
  build gates that flag off, the token prompt may not appear and the header would stay
  the literal `${ZOVO_MCP_TOKEN}` (left intact by both resolution layers when undefined),
  which the server answers with a clean 401 -- degraded, not broken. The fix if that
  ships is documentation in the README header, not a manifest change.
