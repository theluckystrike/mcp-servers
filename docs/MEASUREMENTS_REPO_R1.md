# The public measurements repository, round 1 (2026-09-10)

    https://github.com/theluckystrike/mcp-ecosystem-measurements

Public, MIT, 61 tracked files, 12 findings. Description, topics and homepage set. Every finding
directory holds `measure.py`, the raw `output-2026-09-10.txt` that script printed,
`finding<n>.json` with the numbers, and a `NOTES.md` with the result and a limitations
section. `data/` ships the two dumps gzipped so the arithmetic can be checked without
re-pulling anything.

## What went in

Every one of these was re-run today. None is quoted from this repo's docs without
re-measurement.

1. Registry `search=` matches a substring of the NAME only, never the description, and it is
   not tokenised. 196 servers describe themselves as invoicing and do not appear for
   `invoice`. `time tracker` returns 0 with controls `time` 456 and `tracker` 256.
2. Results are byte ordered on the whole `namespace/name` while matching is case
   insensitive. A capital in a handle is worth a median 16 places earlier, max 56, pooled over
   82 names. Note the direction. Uppercase sorts BEFORE lowercase, so a capital is a gain.
3. The registry holds 30,395 servers under 18,248 namespaces. `metadata.count` is the page
   size and there is no total field. An unfiltered row count runs about 2.3x the server count.
   Five publishers hold 15% of the catalogue.
4. One hosted remote URL binds to one server name. 18,584 distinct URLs, zero shared by two
   active servers, one shared with a deprecated row. Validator quoted from
   `internal/service/registry_service.go`.
5. The gallery VS Code reads holds 252 servers, 0.83% of the registry. The subfolder
   hypothesis is REFUTED, see below.
6. 41 of 120 sampled hosted endpoints, 34.2%, refuse an unauthenticated `initialize`.
   Separately, 11 of 40 return 406 when the Accept header omits `text/event-stream`.
7. Release download counts across other people's MCP repos are heavy tailed, CV 3.60. The
   uniformity claim is REFUTED, see below. Median MCP release asset has 1 download.
8. Glama's score badge returns 200 with a byte identical 2,880 byte placeholder for
   repositories we invented. Only the body distinguishes scored from nonexistent.
9. Description is capped at 100 characters. 40.1% of all descriptions sit in the 90 to 99
   bucket, 5.6% at exactly 100, 24.8% end without terminal punctuation.
10. GitHub repository search reads name, description and topics and not files. 15 of 15 topic
    words matched, 0 of 15 README words matched, hyphenated topic halves matched 1 of 7.
11. Stars do not gate those results. 6 of 18 queries put a zero star repo at rank one, 29 of
    78 pooled top five repos have zero stars. Reported with and without our own repos.
12. Where recommendations come from. github.com 21, glama.ai 7, official registry 0, across 54
    cited URLs from 18 blind questions. Not script reproducible and labelled as such.

## What was cut, and why

The VS Code gallery subfolder finding, as previously stated, is wrong. `VSCODE_GALLERY_R1.md`
claims zero of 252 gallery entries carry `repository.subfolder` against about 19% of registry
entries, with a quoted probability of 9e-24. The gallery's repository object contains only
`id`, `source` and `url`. There is no `subfolder` key in that schema, so counting them returns
zero regardless of the truth. Redone as a join, 223 of the 252 gallery entries match a registry
entry by name and 14 of those carry a subfolder against 13.6 expected at the true base rate.
The true base rate is 6.1%, not 19%. The earlier 19% came from a 100 row sample off the
alphabetical head of the registry. The repository publishes the refutation as finding 5.

The download count uniformity finding does not generalise. Our house rule says MCP release
download counts are near uniform, mean 8.90 and CV 0.417, therefore a machine sweeping. That
was measured on our own 597 assets. Across a seeded sample of 60 third party registry
repositories, the pooled 588 assets have CV 3.60, against 2.58 to 3.88 for three non-MCP
controls. The shape is ordinary heavy tailed demand. What survives is the scale, median 1
download per asset against 3,834 for `cli/cli`, and 48 of 60 repositories publish no assets at
all. The repository publishes that as finding 7.

The registry has ten times more servers than this project believes. `CONTENT_R2.md` records
2,211 distinct servers on 2026-09-08. A full pagination today with `version=latest` returns
30,395, contiguous from `ac.inference.sh/mcp` to `zone.waggle/waggle`, zero duplicates. The
earlier figure came from a run that stopped after 6,000 rows. Any per-token share, competition
density or findability number computed against 2,211 is wrong by roughly 14x on the
denominator.

The auth-required share is higher than the number we quote. `CONTENT_R3.md` cites 25.4%
from registry issue 1626. Our own probe of 120 endpoints gives 34.2%, 95% CI roughly 26 to
43%. Different method, `initialize` rather than `tools/list`, and three days later.

Cut for not being verifiable today without an account or a payment. Smithery `useCount` and
category statistics, the mcp.so issue queue, and the npm `/-/v1/search` total field. All need
either a login or a fee, both of which are forbidden here. Stated as cut in the repository
README rather than published unchecked.

Cut as being about us rather than about anyone else. Our own clone traffic, our own registry
referral counts, our own Glama coverage, and the 443 places gained from the namespace
experiment. Interesting internally, not a measurement of the world.

## Method notes worth keeping

`/v0/servers` pages fine with its keyset cursor. Contrary to a mid-loop report, it did not
stop issuing cursors after 100 rows here. What it does is get slow at depth, roughly 12
seconds a page a long way in. It also accepts a synthetic cursor, so a full dump can be split
into ranges and merged. `tools/fetch_registry.py --from/--until` and `tools/merge_parts.py`
in the published repository do that. Four ranges at 1.2 seconds each finished 30,395 servers
in about 40 minutes with zero duplicates on merge.

`version=latest` is the difference between 30,395 rows and something over 100,000.

The humanize scanner at `~/Desktop/humanize/scan.py` is iCloud-evicted and exits 0 printing
nothing. The rules were applied by hand from `~/humanize-durable/HUMANIZE.md` using a
re-implementation of the hard gate, control tested first on a deliberately bad string which
failed with 6 hard and 12 soft hits. All 17 prose files in the published repository pass with
0 hard and 0 soft.

## What to do next

Re-run finding 12 after the GitHub mirror work has been re-crawled. It is the only KPI in the
set that maps to revenue and it currently reads 0 of 18.

Correct `docs/VSCODE_GALLERY_R1.md`, `docs/CONTENT_R2.md` and the `download_count` line in the
loop brief. Three live documents in this repo now carry numbers that today's measurements
refute.
