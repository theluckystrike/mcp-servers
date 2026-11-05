# S1102 apify lane: 5 MCP Actors ready for one-command publishing

Date 2026-11-02. Built in `/Users/mike/mcp-servers/apify/`. Nothing pushed, no account created. Machine twin: `apify.json`. Owner guide: `/Users/mike/mcp-servers/apify/PUBLISH.md`.

## What exists
- 5 Actor directories (section-179, car-loan-interest, subdomain-finder, ab-test, lake-level), each with `.actor/actor.json`, input/output/dataset schemas, `.actor/store-config.json` (SEO title/description, categories, pay-per-event body), `Dockerfile`, hand-written Store-SEO `README.md`, vendored server in `server/`.
- `gen.mjs` + `actors.json` regenerate the machine files; `test-all.sh` + `test-local.mjs` test; `publish-all.sh` publishes (bash -n OK, never run).
- Template: official `ts-mcp-proxy`, changed to plain JS, stateless HTTP, one shared child, charge only after successful `tools/call`.

## Pricing facts (code vs Console)
- Code: `Actor.charge({eventName:'tool-call'})`, actor.json metadata.
- Console or API only: event prices, primary event, SEO name/description, categories, publish switch, billing, KYC. `apify push` sends only name, title, description, Standby flag and source (read in apify-cli 1.11.0). `pay_per_event.json` is reference only.
- Console path: Development > My Actors > Actor > Publishing > Monetization > Set up monetization (Actor pricing, Primary event, Review). Price increases need 14 days and are limited to once a month.
- Prices: $0.03, $0.03, $0.03, $0.02, $0.01 per successful tool call. Apify keeps 20%. Rationale in PUBLISH.md part 5.

## Why vendored dist
npm registry returns 404 for the four unpublished packages; `npx github:` needs git, a clone and a tsc build at start. Vendored dist is pinned, 44-88 KB, no runtime download. `MCP_COMMAND` still overrides.

## Verified (test-all.sh)
validate-schema 5/5; `apify run` Standby with real MCP initialize + tools/list + tools/call + 5 parallel calls + GET 405: 5/5; self-check run 5/5; billing path with ACTOR_TEST_PAY_PER_EVENT: charge logged, spending limit refuses the next call. Live data: Lake Mead 1,038.85 ft, CT hosts for example.com.

## Not verified
Login, push, cloud build, real Standby gateway, real charging/fee, the two PUT /v2/acts calls, Docker build (141 MB base image over the 50 MB cap), Store page and ranking.

## Owner unlocks
Sign up https://console.apify.com/sign-up, token at https://console.apify.com/settings/integrations, billing + KYC under Development > Insights > Payouts, then `export APIFY_TOKEN=...; ./publish-all.sh` and the Console monetization clicks if the API step is refused. About 35 minutes.

## Expectation
Median MCP Actor has 1 successful run in 30 days (money.md). Zero Store hits for "section 179" and "ab test sample size". At 100 calls a month a $0.03 Actor nets about $2.40.
