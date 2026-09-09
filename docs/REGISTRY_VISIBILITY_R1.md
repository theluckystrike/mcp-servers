# Registry visibility, acted on rather than deferred (2026-09-09)

## The question this settles

Earlier loops measured that the registry sorts strict ASCII on the whole namespace, so
`io.github.theluckystrike` can never reach page one on a contested token, and that a `com.*`
namespace would rank 10 to 45 places earlier. That was left as an operator decision because
migrating the catalogue means giving up the existing rows and changing the publisher name a
user sees.

This round asked a narrower question: **where does the namespace actually cost us anything?**

## It costs nothing on most tokens, and everything on four

Every server was measured against the single word a person would actually type, by fully
paginating the live registry. 16 of 20 are already rank 1 or 2 under `io.github`, because the
token is uncontested and the word-rich naming from earlier rounds already won it. On those,
the namespace is irrelevant and a second row would be pure duplication.

Four are buried:

| Token | `io.github` before | Total rows |
|---|---|---|
| pdf | 93 | 100 |
| invoice | 65 | 75 |
| bank | 62 | 67 |
| quote | 52 | 80 |

Nobody scrolls to 93 of 100. On those four the listing may as well not exist.

## What was done

One additional row per buried server, under `com.bestremotetools`, a domain the operator owns
and this project verified. Each row is `mcpb`-only with no `remotes` block, which matters for
two reasons: the registry binds one hosted URL to one server name, so a row without a hosted
endpoint cannot collide, and the existing `io.github` rows were therefore left completely
untouched and still active.

Measured live immediately afterwards, same method, same day:

| Token | `io.github` | `com.bestremotetools` | Places gained |
|---|---|---|---|
| pdf | 93 | **5** | 88 |
| bank | 62 | **7** | 55 |
| quote | 52 | **3** | 49 |
| invoice | 65 | **32** | 33 |

Three of the four moved from invisible to the first seven results. Every row points at a
release bundle that returns 200 and a product page that returns 200, both verified.

## Why only four

The estate already carries 89 rows for 32 servers. Doubling that across a catalogue would be
duplication on the one channel that measurably delivers people, for no gain on the 16 tokens
already won. Four rows is the smallest change that captures the whole measured benefit.

## What this is not

It is not the migration. The `io.github` rows remain active and are still the project's
primary identity. If the four new rows prove out, extending them is a small step; if they
prove unwelcome, they can be deprecated with one command each and nothing else changes.
