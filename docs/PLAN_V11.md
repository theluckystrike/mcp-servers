# Plan v11 (2026-09-04 evening, loop 14): per-tool click sources, profile-first, weakest lanes

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 1,496 | Catalog pull continues |
| Upgrade link clicks | 3 total: time-tracker.full_history 1, recurring.unknown 1, resume.unknown 1 | Two of three clicks carry no source: storefront links lack src |
| Sales | 0 | Three clicks, no checkout completed |
| GSC | key still dataless | Unmeasurable until the operator re-downloads the key |
| TensorBlock PR 2154 | closed: one entry per PR, suggested a single Office Suite entry | Resubmit as one bundle entry |
| Weakest hosted lanes | timezone 9/12, bank-statement 14/18, expense-tracker 10/12 | Re-run after the round 15 fixes |

## Top 5, ranked by impact x autonomy
1. Per-tool click sources: codemod every gate.upgradeText call site to pass the tool name (tested, idempotent, verified by a contract test that every cap message link carries src=<product>.<tool>), and every storefront /buy link carries src=store.<page>. Pass: /stats/clicks never shows .unknown again from a page or a cap.
2. Profile-first audit: for every tool argument that overlaps a shared profile field (name, address, IBAN, timezone, currency, tax rate, email), the argument becomes optional with a profile fallback and a named refusal when neither exists. Pass: grep-driven table, fixes with tests, no required arg left that the profile could fill.
3. Round 16 hosted: timezone, bank-statement, expense-tracker re-run with the round 15 fixes. Pass: scores up, remaining defects logged.
4. TensorBlock resubmission as a single Office Suite entry per maintainer guidance; YuzeHao and awesome-mcpb still open.
5. Estate backlinks for worthmyclaim and dscrradar only via the live-mirror recipe in memory, with a byte-level verify and rollback; skip if the recipe cannot be confirmed.
Release v0.9.3 if sources change.
