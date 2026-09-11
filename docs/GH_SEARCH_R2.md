# What actually ranks on a GitHub query, split by field size

Measured 2026-09-11, the day after the vocabulary pass. This refines the loop-33 finding
rather than overturning it, and it retires a line of work.

## The loop-33 finding, restated

Repository search reads name, description and topics only, and query-term coverage is the
gate. That was measured on fields of 14 to 91 results, where 6 of 18 rank-one repositories had
zero stars and the median was 7.5. Coverage rose 0.608 to 0.862 and queries surfacing us went
22 to 32 of 34, with 15 at rank one.

## What was left open

Contested queries stayed 0 of 7 in the top three across three runs. Two hypotheses were
recorded and neither had been tested: that stars gate them, and that our `mcp-<capability>`
naming shape is wrong.

## Stars gate the large fields. This is now measured.

Seven contested queries, median field 648:

| | rank-one stars |
|---|---|
| small fields, 14 to 91 results | median 7.5, 6 of 18 at zero |
| contested fields, median 648 | **median 998, 0 of 7 at zero** |

Only 1 of 7 result lists is in exact descending star order, so it is not a star sort. But no
zero-star repository holds rank one on a large field, and the rank-one repositories on
`mcp time tracking`, `mcp calendar` and `mcp spreadsheet` carry 86,024, 1,187 and 998 stars
against our zero.

**Conclusion: contested GitHub queries are not winnable in the near term, and no amount of
description work changes that.** Stop spending on them.

## The naming hypothesis is REFUTED as stated

Measuring how much of each query's terms appear in the repository NAME:

    mean name-term coverage, winners in the top three   0.38
    mean name-term coverage, ours                       0.64

We have better name coverage than the repositories beating us. Renaming the fleet to a
phrase shape would not have worked, and the round that proposed it would have been wasted.

## What the split does suggest, as a hypothesis and not a finding

The two readings pull apart by field size. On the large fields the winners have LOW name
coverage and high stars, which is what drags the winners' mean to 0.38. On the two smallest
fields the winners have FULL name coverage and no stars at all:

    mcp invoice generator    field 11   top three all 1.00 name coverage, two of them 0 stars
    mcp currency converter   field 35   rank three 1.00 name coverage, 0 stars
    ours on both                        0.50, and absent from both top tens

So on a small field the full query phrase in the repository name may be what wins, and we sit
at half of it on exactly the two queries we lose. That is n=2 and it is not enough to rename
anything on.

An anomaly worth keeping with it: `mcp-currency` carries every term of `mcp currency
converter` across name, description and topics, and GitHub has freshly reindexed it, proved by
a word that exists only in the new description matching. Full coverage, current index, still
absent from a 35-result top ten. So coverage is necessary and demonstrably not sufficient.

## The proposed test, not run

Rename ONE repository to carry its full buyer phrase, `mcp-invoice` to
`mcp-invoice-generator`, on the query with the smallest field and the clearest gap. GitHub
redirects the old name so nothing breaks. Re-measure after a week against the unchanged
siblings. It was not run here because it touches the registry manifests, the mirror generator
and the homepage field on the strength of two data points, and the estate's own convention is
to test a naming change on one entry and measure before moving a fleet.

## What follows for strategy

The winnable surface is small-field queries, and we already hold 15 rank-one slots there. The
way to get more is not to fight contested queries but to make more uncontested ones exist,
which is what the two wedge pages do: answer a question the market has no settled answer for.
That is the same conclusion the blind recommendation test reached from the other direction.
