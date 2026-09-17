# STRATEGY-36 — Distribution + Monetization loop (2026-09-17, 2-4h)

## Inputs measured (commands on file)
- Research file (platform-analysis-2026): final decision 91/100 confidence — 70% Telegram Mini Apps
  behind 14-day gate, 20% MCP servers, 10% Atlassian Forge; TypeScript standard; Telegram is the
  only measured surface combining no-listing-review absorption + native billing rail (Stars/XTR).
- Blind R3 (data/blind_recommendation_r3.json, 2026-09-17): 18 buyer-intent questions, 0 estate
  wins, 0 estate mentions. Competitors win via GitHub repos surfaced by organic search +
  mcpservers.org listings. Our gap: not README craft (36/40 demos), not metadata (38/38 hosted
  URLs in descriptions) — it is (a) zero npm installability, (b) zero stars (66 total estate-wide
  vs competitors' hundreds), (c) no presence on directory surfaces beyond registries.
- Conversion R1 (loop 29): funnel never tested by real humans; 229/294 upgrade clicks were
  automation. "Zero payments is the arithmetic of an empty room, not a conversion defect."
- Distribution ledger: 49 surfaces recorded, 14 verified-live inbound, 11 open PRs to punkpeye
  (7 fresh + 4 older), Awesome-MCP PR #52 (with upstream CI fix = merge bait).
- Registry: all 41 hosted endpoints now visible in the Official MCP Registry (loop 35).
- Estate: 42 servers, $19/$39, live checkout verified end-to-end (browser-shaped POST -> Stripe 303).

## The cold math
Revenue is $0 because room is empty (~10 humans/fortnight). The binding constraint is surface
area that buyers actually search: npm (42 packages absent), GitHub stars (social proof gate for
topics rank), directories (mcpservers.org etc, human-gated), Telegram (the research's #1 ranked
surface — Mini App built but token-gated).

## Tracks (max parallel, biggest-leverage first)
T1 npm publish cascade — BLOCKED on human (token revoked). When token lands: publish 42,
  re-run registry publisher, all entries green. Prepared and queued.
T2 Telegram Stars Mini App go-live prep — BLOCKED on human (BotFather token). Everything else
  done: grammY bot, XTR invoices, Mini App HTML, offline tests. Prep: dry-run deploy script so
  token paste -> live in <5 min.
T3 awesome-list PR follow-through (11 open punkpeye + #52 Albertchamberlain): per-PR status
  check, fix CI/label complaints, nudge-eligible = label `valid` + >48h no review. + 1 new list
  submission from the dist backlog.
T4 Stars growth loop: the only proven lever agents can pull is repo quality signals —
  Ship README badges (npm version placeholder off, registry badge ON now that entries exist),
  topic consistency, and a "works with" matrix page linking the registry entry per server.
T5 measured intel: blind-R4 on the 6 questions where R3 winners are weakest (do registry entries
  move organic results after a week?); snapshot before/after.
T6 KPI instrumentation: add registry-entry count + npm-published count + open-PR merge count to
  dashboard KPI row; recompute after each session.

## KPI targets this loop
- Open PRs green and current: 11 (+1 #52) -> all label-checked, zero stale
- Registry entries with remotes: 41 (done) -> maintain
- New verified-live inbound surfaces: 14 -> 16+
- npm: 0/42 (human gate) -> publish script ready to fire
- Telegram: token-gated -> deploy script ready
