# The public measurements repository

**https://github.com/theluckystrike/mcp-ecosystem-measurements**

Published 2026-09-10. Public, 61 files, 12 findings, 10 topics, homepage pointing back at the
server catalogue.

## Why it exists

The blind recommendation test established where MCP server recommendations actually come from:
github.com 21 citations, glama.ai 7, ours 4, the official registry 0. GitHub is the surface.
Meanwhile this project had spent 33 loops making measurements about the ecosystem that were
sitting in a private-ish monorepo's docs directory where nothing reads them.

Those measurements are the most genuinely valuable thing this estate owns and they cost
nothing to give away. A research artifact that is worth citing on its own merits, published on
the surface that produces citations, by the same account that publishes the servers.

## What is in it

Twelve findings. Each ships `measure.py`, the raw dated output that script printed, and a
`finding*.json` with the numbers. Nine also carry a written `NOTES.md`.

The strongest three, in the sense of being both surprising and checkable:

- Registry search matches the NAME only. For the token `invoice`, 75 servers match by name and
  the live search returns exactly that set, while a further 196 carry the word only in their
  description and cannot be found by searching for it. Multi-word phrases return nothing at
  all: `time tracker` gives 0 rows while `time` gives 456 and `tracker` gives 256.
- 34.2% of sampled remote MCP endpoints require auth on the discovery methods, 41 of 120 from
  a seeded sample of a 17,342 pool. Directories health check by calling those methods, so an
  endpoint that answers 401 gets published as not responding.
- Stars do not gate GitHub search results. Across 18 queries, 6 put a zero-star repository at
  rank one, and 29 of the 78 repositories in the pooled top fives have never been starred.

## What was cut, and the honesty machinery

`DISCLOSURE.md` states the conflict of interest at the top rather than at the bottom: these
were made by the maintainer of 32 MCP servers, several findings started as a problem we hit
ourselves, and that should change how a reader weighs them.

Finding 05 publishes a hypothesis of ours that turned out to be **wrong**, and says so. The
earlier claim that the VS Code gallery holds zero entries pointing at a monorepo subfolder was
an artefact of a deprecated endpoint that flattens the repository object with no `subfolder`
key at all; the current endpoint shows 14 of 252 do have one. A directory that publishes its
own refuted hypothesis is more credible than one that quietly drops it.

Finding 11 discloses that 3 of its 18 rank-one slots are our own repositories and reports the
numbers with them removed, because a reader should not have to take that on trust.

Three findings ship their script, data and raw output but no written analysis: 01, 06 and 07.
Publishing the evidence beat holding it back until the prose was ready, and the README says
which three so nobody mistakes an absence for an oversight.

## How it was finished

The agent building it stalled with everything complete except the front page. Rather than lose
the artifact, the orchestrator wrote the README from the findings' own notes and JSON, ran it
through the humanize scanner, fixed the hard formatting fails it caught, and published.

The scanner used is `/Users/mike/content-pipeline/voice/humanize-scan.py`, NOT the one at
`~/Desktop/humanize/scan.py`, which is iCloud-evicted and passes deliberately terrible text
with a clean exit. Both controls were run before trusting the pass: the known-bad file fails,
a known-good file passes.
