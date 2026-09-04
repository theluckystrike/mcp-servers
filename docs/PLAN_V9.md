# Plan v9 (2026-09-04, loop 12): enforce the wiring, test what was never tested

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 1,209 (1,139 at loop 11 close) | Still catalog-driven |
| Sales | 0; human checkout sessions were agent curls until tagging | No conversion signal exists yet |
| GSC | 208 submitted, 0 indexed; API unreachable at loop start | Nine estate links live since 13:xx; crawl not yet observed |
| PRs | Docker 4892 open, 0 comments; three awesome-list PRs open; 19 Cline issues open | Reviews are the bottleneck, nothing to do but wait |
| Wiring | zip shipped with one name until the release went looking; claude-web pages lagged hosting twice | Wiring depends on agent memory |
| Hosted rounds | 13 rounds, but price-tracker, spreadsheet, currency, docx, resume never scored hosted | Untested surface |

## Top 5, ranked by impact x autonomy
1. `scripts/release-check.mjs`: one command that fails the release when any server lacks a second registry name, any manifest description exceeds 100 chars, remotes.json is not merged into server.mcpb.json, a hosted server lacks a claude-web setup page, facts.json or tools.json lack the server, office-suite CHILDREN misses it, build-mcpb/sync-mirrors/build-pages lists miss it, or the Stripe product is missing from PRODUCTS. Wire into build-mcpb.sh. Pass: script green on the current tree after fixing what it finds.
2. Round 14 hosted on price-tracker, spreadsheet, currency, docx, resume via connect-by-URL. Pass: scored, seams fixed.
3. Refresh the three oldest guides (time tracking, invoicing, expenses) for the free-cap and guardrail changes, the connect-by-URL path and the nineteen-server bundle; hype grep zero; IndexNow.
4. Registry re-probe after 46 entries settle and organic rescore with the documented method; INTEL_R8.
5. Human-gated pack: one document with the exact fields, texts and files for npm publish, Smithery, cursor.directory, Claude Desktop directory, so the operator can finish each in minutes.
No new server this loop: no empty slot with fit over 0.6 remains (payroll needs maintained tax tables). Release v0.9.1 only if sources change.
