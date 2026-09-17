# S36 T4 — Registry Badge & Discoverability Pass

STATUS: complete (subagent hit budget before working; orchestrator executed directly)

## What was done

- 42/42 server READMEs (`servers/*/README.md`) now carry a registry line on the first screen:

  `**In the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.theluckystrike%2F<name>/versions/latest)** (`io.github.theluckystrike/<name>`).`

- URL form chosen after testing: `/search?q=` is 404 (API-only); the UI at the root has no
  per-name route; the stable human-usable deep link is the `/v0.1/servers/<encoded>/versions/latest`
  endpoint — 200, renders as readable JSON naming the exact server.
- Spot-verified 3 deep links live (amortization, invoice-pdf-billing-generator, mileage-log):
  all 200 with the correct `server.name`.
- Insert position: immediately before the demo-GIF line on each first screen (42/42 had one).
- `node scripts/build-readme.mjs` -> "regions rewritten: none" (badges survive regeneration).
- `node scripts/release-check.mjs` (node 22) -> `release-check: green (23 recorded gap(s))`.

## Counts

- Registry links before: 0/42 server READMEs. After: 42/42.
- Errors: 0.

## Evidence commands

- `grep -l 'registry.modelcontextprotocol.io' servers/*/README.md | wc -l` -> 42
- `curl -s -o /dev/null -w '%{http_code}' .../v0.1/servers/io.github.theluckystrike%2Famortization/versions/latest` -> 200
- `node scripts/build-readme.mjs && node scripts/release-check.mjs` -> green
