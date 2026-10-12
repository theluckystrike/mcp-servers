# Registry entries at latest version — KPI diagnosis & fix (2026-10-10)

STATUS: in progress

## Method
- Located KPI computation: `scripts/kpi.mjs`, block starting `let registryLatest = null;` (~line 138).
- Reproduced the probe with a standalone script (`/tmp/regcheck.mjs`): collect every `servers/*/server.*.json` manifest name (excluding `server.json`, `server.npm-package.json`), then GET `https://registry.modelcontextprotocol.io/v0.1/servers/<urlencoded name>/versions/latest` sequentially (concurrent bursts got rate-limited), compare version with the manifest's own version.
- Raw probe state saved at `/tmp/regstate.json`, summary at `/tmp/regsummary.json`.

## Evidence (raw GET results)
- Response shape: `{"server":{"name":...,"version":"0.22.0",...}}` — version nested at `.server.version`.
- Example raw GET (curl): `io.github.theluckystrike/amortization` → 200, version `0.22.0` = manifest version.
- Full probe (156 names incl. primaries): **156/156 present**, 0 missing.
- Per-manifest-version comparison: 66 already equal, **65 registry ahead** (registry latest newer than manifest), **25 manifest ahead** (manifest 0.22.0, registry 0.21.0 — the `server.variant.json` spec files).

## Root cause
1. **Harness bug (main cause of 0/149):** `kpi.mjs` compared EVERY name against a single global version — `office-suite/package.json` `rel` (0.22.5) — instead of each manifest's own version. Since almost no registry entry is at 0.22.5, the KPI read 0.
2. **Manifest drift (secondary):** 65 alias/variant manifests still say 0.22.0 while the registry holds 0.22.1–0.23.2; and 25 `server.variant.json` spec manifests say 0.22.0 while the registry entry is still at 0.21.0.

## Actions taken
- [x] Fixed `scripts/kpi.mjs`: per-name version map (`name → {version, src}` from its own manifest) instead of the global office-suite release version.
- [x] Synced the 65 drifted manifests' version fields up to the registry's actual latest version.
- [x] Republished the 25 stale registry entries at their manifest version 0.22.0 (see log below).

## New KPI value
- PENDING

## Remaining gaps
- PENDING
