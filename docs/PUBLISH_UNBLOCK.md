# PUBLISH UNBLOCK — MCP official registry + npm

Date: 2026-10-07 · Evidence: `data/publish_unblock.json` · Source intel: `intel/dist-r29.md`

## USER: run these 2 commands

### 1. Official MCP registry (token expired)

```
mcp-publisher login github
```

Open the URL it prints (https://github.com/login/device) in a browser, enter the code, authorize.
A code was already captured for you this session:

- URL: https://github.com/login/device
- Code: `0003-669A`
- Captured 2026-10-07 ~10:38 local. Codes expire in ~15 min — if it doesn't work, just rerun the command; it prints a fresh code instantly. Do **not** run it in the background and forget it; it waits for authorization.

After it prints "logged in", run:

```
cd /Users/mike/mcp-servers
for n in credit-note delivery-schedule packing-list price-tracker-drop-alert-watch time-tracker-timesheet-billable-hours; do
  (cd servers/$n && mcp-publisher publish server.json)
done
```

Registry already holds these 5 names at 0.22.4 while local manifests say 0.22.0 — bump each local `server.json` version (e.g. to 0.22.5) before publishing, or the registry may reject an older version.

### 2. npm (token dead)

```
npm login
```

Browser opens → log in to npmjs.com → token lands in `~/.npmrc`. Verify:

```
npm whoami   # should print theluckystrike
```

Alternative (granular token): create one at
https://www.npmjs.com/settings/theluckystrike/tokens/new — type **Granular**, packages: read & write on `@theluckystrike/*` — then replace the `//registry.npmjs.org/:_authToken=` line in `~/.npmrc`.

Then publish packages: `cd servers/<name> && npm publish --access public` (bump versions first; 54 package.json files exist).

⚠️ `servers/receipts/package.json` has name `mcp-receipts` — **unscoped**. Verify it's yours and intended before `npm publish`; the other 53 are `@theluckystrike/mcp-*`.

---

## What is actually blocked vs. what already shipped

| Channel | Status | Blocker | Unblock |
|---|---|---|---|
| Official MCP registry | **184 server entries LIVE**, newest publish 2026-09-29 | Saved github token in `~/.config/mcp-publisher/token.json` expired 2026-09-30 04:20 UTC | Command 1 above (~2 min) |
| npm | 54 packages packed, 0 published | `~/.npmrc` token dead: `npm whoami` → E401 | Command 2 above (~2 min) |
| mcpb bundles | 54 `bundles/*.mcpb` packed and referenced by live registry entries | none | — |

**Correction to dist-r29.md:** the registry was *not* left blocked — the 2026-09-29 login succeeded and 184 entries were published (171 use the good `mcp.zovo.one/s/<server>` URL; 4 still use robots-disallowed `/buy/<server>`). The only residual issue is the now-expired token plus 5 manifests where the registry is *ahead* of local (0.22.4 live vs 0.22.0 local).

## Non-interactive auth findings (registry)

- `mcp-publisher 1.8.1` methods: `github` (interactive device flow), `github-oidc` (GitHub Actions only), `dns` (`login dns --domain <d> --private-key <k>`), `http` (same), `none` (no publish rights).
- **The `dns` and `http` methods are genuinely non-interactive** once set up — but setup requires the user to register the domain with the registry and mint a private key once. Worth doing if this expires every ~2 weeks: investigate `mcp-publisher login dns --help` next unblock cycle.
- Token file scope: publish on `io.github.theluckystrike/*` and `io.github.BeLikeNative/*`.

## Full inventory at the moment auth lands

- 54 `servers/<name>/server.json` manifests (47 at v0.22.0, 7 other versions)
- 54 `bundles/*.mcpb` bundles (matching subdirs too)
- 184 distinct names live in the official registry (verified via paginated `?search=theluckystrike&version=latest`)
- 5 manifests needing version bump + republish (see list above)
- 54 npm packages ready (53 scoped, 1 unscoped — verify)
- Registry publish commands + npm publish commands in `data/publish_unblock.json` (`user_actions`, `publish_commands_after_login`)

Nothing was committed; no interactive login was completed (login process was started in background to capture the device code, then killed).
