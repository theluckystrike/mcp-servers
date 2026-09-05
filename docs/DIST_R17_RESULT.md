# Distribution round 17: wire mcp-statement-of-account into the estate (2026-09-05)

status: DONE

This file is written first, as a checklist, and updated as each item closes, so a stalled
agent leaves a verifiable state rather than an unknown one.

Opening state: `node scripts/release-check.mjs` -> 24 servers at 0.13.0, 27 checks each,
17 failures, 15 of them `statement-of-account` and 2 estate-wide.

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | PRODUCTS entry, bundle derived to twenty-four and $417 | done | billing/src/index.js PRODUCTS["statement-of-account"], price_1UCLpbJKCamubEm1vvAD4jzZ; SERVER_COUNT 24 and BUNDLE_SAVING_USD 417 both derive, bundle desc reads "Saves $417 against buying twenty-four" |
| 2 | SERVER_COUNT 24 in packages/mcp-license and remote/src/shims/license.ts, bundle-link test at 24 | done | packages/mcp-license/src/index.ts and remote/src/shims/license.ts both at 24; bundle-link test derives the expected count from the gates and is 32/32 green |
| 3 | office-suite CHILDREN | done | servers/office-suite/src/index.ts CHILDREN |
| 4 | build-mcpb SERVERS / DISPLAY_NAME / KEYWORDS | done | scripts/build-mcpb.sh SERVERS, DISPLAY_NAME "Statement of Account", KEYWORDS |
| 5 | sync-mirrors ALL_SERVERS + topics_for | done | scripts/sync-mirrors.sh ALL_SERVERS and topics_for |
| 6 | data/facts.json | done | data/facts.json servers.statement-of-account |
| 7 | build-pages ids, regenerate, deploy billing | done | scripts/build-pages.mjs ids; `node scripts/build-pages.mjs` regenerated billing/src/pages.js at 398,227 bytes over 24 pages; billing deployed by wrangler, version 8969214c; /s/statement-of-account 200, /buy/statement-of-account 303, /guides/client-statements-and-dunning-from-chat 200, /setup/claude-web/statement-of-account 200 |
| 8 | data/tools.json from a live tools/list | done | data/tools.json, 8 rows read from a live tools/list over stdio |
| 9 | scripts/validate.mjs probes + buy list, validate green | done | scripts/validate.mjs PROBES entry, 10 assertions per tier, plus the hosted tools/list list and the buy list. `node scripts/validate.mjs` 674/674, run 50; statement-of-account 32/32 in 412 ms |
| 10 | setup: SETUP_SERVERS, six ANGLE entries, a WEB_ANGLE | done | billing/src/setup.js SETUP_SERVERS entry, six ANGLE entries, one WEB_ANGLE |
| 11 | guide /guides/client-statements-and-dunning-from-chat | done | billing/src/content.js GUIDES["client-statements-and-dunning-from-chat"], 9 FAQ rows |
| 12 | compare_none note | done | data/facts.json compare_none, 8 tokens probed on the live registry API |
| 13 | demo GIF under 400 KB | done | assets/demo-statement-of-account.gif, 374,711 bytes |
| 14 | assets/statement-of-account-logo.png | done | assets/statement-of-account-logo.png, 400x400 |
| 15 | Docker catalog entry + repin 24 entries + PR 4892 body row | done | fork commit 75603c4 on add-theluckystrike-mcp-servers: servers/statement-of-account/server.yaml added and all 24 entries repinned to 882b07d after the HEAD check; PR 4892 body gained the row, the name list and the twenty-four/882b07d pin line |
| 16 | Cline marketplace issue | done | https://github.com/cline/mcp-marketplace/issues/2449 |
| 17 | data/distribution.json hosted row | done | data/distribution.json per_server.statement-of-account.hosted |
| 18 | Round 26 user-value run into data/user_value_r26.json | done | data/user_value_r26.json and docs/USER_VALUE_R26_STATEMENT.md, six-prompt stdio free-tier round, 18/18 |
| 19 | `node scripts/release-check.mjs` green | GREEN | 24 servers, 27 checks each, 0 gaps |

Not in scope here: `remote/src/index.ts` SERVERS (`endpoint`), which the remote agent owns.

## What closed the seventeen gaps

`release-check` opened the round with 17 failures, 15 of them `statement-of-account` and 2
estate-wide. Both estate-wide ones closed themselves the moment the `PRODUCTS` entry landed:
`SERVER_COUNT` and `BUNDLE_SAVING_USD` derive from `PRODUCTS`, so `twenty-four` and `$417`
were never typed anywhere. Two hand-written numbers did have to move with them.
`NUMBER_WORD` in `billing/src/index.js` needed a `24` row, and
`billing/test/checkout.test.mjs` asserts `/^Twenty-four MCP servers/`: that is the one place
in the repo the count is deliberately spelled out rather than derived, so the test can catch
a broken `countWord`. The `endpoint` gap (`remote/src/index.ts` SERVERS) was closed by the
remote agent during the round and is not this round's work.

`packages/mcp-license` tests read the BUILT package, so bumping `SERVER_COUNT` in
`src/index.ts` alone left `bundle-link.test.mjs` failing at 23 against 24 gates until
`npm run build -w packages/mcp-license` ran. The test derives the expected count from the
servers that actually build a licence gate, so it cannot be satisfied by editing the
assertion.

## The demo, the GIF and the logo

`scripts/demo/drive.mjs` gained a `statement-of-account` scene that seeds the worked month
by importing `servers/statement-of-account/test/_client.mjs`'s own `workedMonth` seeder, so
every figure recorded is one the unit suite asserts and the docs recompute by hand, not one
invented for the recording. The scene shows the statement and its five movements, aging as
at 2026-06-10 beside the sentence naming what the ordinary rule reports on the same books,
aging at the period end for both clients, a level 1 chaser, and the `statements_report` Pro
refusal on the free tier with its two checkout links.

vhs recorded 468,829 bytes at the tape's defaults and 466,586 at 12 fps, both over the
400 KB ceiling, so the recording was re-encoded with ffmpeg at 10 fps on a 64-colour palette
to 374,711 bytes. A frame was read back to confirm the terminal text is still legible rather
than trusting the byte count.

## The Docker catalog entry

`go run ./cmd/validate --name statement-of-account` in the fork at
`/private/tmp/docker-mcp-registry` first failed on `title must have every word capitalized`
for `Statement of Account`; the title is `Statement Of Account`. It then passes name,
directory and title and hangs at the step after, which needs a Docker daemon this machine
does not run. That is the same limitation PR 4892's submitter checklist already records for
`task build -- --tools`, and it is left recorded rather than smoothed over.

The repin was guarded: the local HEAD was compared against `git ls-remote origin main` and
the logo was fetched at that sha over raw.githubusercontent (200) before any file was
rewritten, so no entry can be pinned to a commit that is not public.

## compare_none rather than a comparison page

Eight tokens were probed against the live registry search API on 2026-09-05:
`statement-of-account`, `statement of account`, `aging`, `dunning`, `receivables`,
`accounts receivable`, `debt collection`, `payment reminder`. Seven return 0 rows. `aging`
returns 20 and every one is a substring match on another word: imaging, staging, messaging,
paging, plus one healthy-aging supplement atlas. Nothing in the registry reads an invoice
ledger, computes what is outstanding as at a date, buckets it by days past due or drafts a
chaser, so the self-expiring `data/facts.json` note stands in place of a comparison page and
re-probes in 30 days.

## Evidence

    node scripts/release-check.mjs   green, 0 gaps, 24 servers at 0.13.0, 27 checks each
    node scripts/validate.mjs        674/674, run 50; statement-of-account 32/32 in 412 ms
    npm test -w billing              73/73
    npm test -w packages/mcp-license 32/32
    round 26 user value              18/18, six-prompt stdio free-tier round

## Failures

- The `office-suite` CHILDREN line was written twice: a concurrent agent working the same
  worktree added the same entry between the grep that found one occurrence and the write.
  Caught by re-reading the block rather than trusting the edit, and deduped.
- `data/distribution.json` was first rewritten at `indent=2` by a json round trip, which
  reformatted all 562 lines. Reverted and redone at the file's own `indent=1`, so the diff
  is 14 added lines rather than 1,131 changed ones.
- `WEB_ANGLE` was inserted without its trailing comma and `billing/src/setup.js` failed to
  parse. Caught by importing the module rather than by eye.
- The first demo scene was written against field names guessed from the docs
  (`st.statement.id`, `dun.text`) and threw twice. The response shapes were dumped from the
  live server and the scene rewritten against them.

insight: this round's checklist was written before any work started and updated as each item
closed, and the two agents sharing this worktree collided exactly once, on a list both were
appending to. The release checker caught nothing about that collision, because a duplicated
CHILDREN entry is still a present CHILDREN entry. What caught it was re-reading the edited
block. A gate that asks "is it there" cannot see "is it there twice", and a shared worktree
is the condition that makes the difference matter.
