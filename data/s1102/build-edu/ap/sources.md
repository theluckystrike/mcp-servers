# AP score distribution sources (fetched 2026-11-02)

All fetches with curl and a desktop browser User-Agent. Parsers in `scripts/` (run with `python3 -I`).

## Used

| year | URL | HTTP | what | sha256 |
| --- | --- | --- | --- | --- |
| 2026 | https://apstudents.collegeboard.org/about-ap-scores/score-distributions | 200 | "2026 AP Score Distributions" HTML tables, 40 exams, whole percents for 5/4/3/2/1 and 3+, no counts/means | 0d79311cbdbae798973f511e2e131251a318290c8237e33007036222ce900a39 (page, kept as raw/aps.html) |
| 2025 | https://apcentral.collegeboard.org/media/pdf/ap-score-distributions-by-subject-2025.pdf | 200 | STUDENT SCORE DISTRIBUTIONS, AP Exams - May 2025: N and %, 3+, mean, SD; 40 exams + 3 subscores + 6 Standard Group rows | 2334b63321ee49b0ecd97f840ff23354679c2a5871fdedc33fd164f379d42440 |
| 2024 | https://apcentral.collegeboard.org/media/pdf/ap-score-distributions-by-subject-2024.pdf | 200 | same table for May 2024 (49 rows) | 67a34db92327e09dc4dd8219fb0e1662fbb8f7f5fbd15da8703f0325e8a56c36 |
| 2024 | https://reports.collegeboard.org/media/pdf/ap-score-distributions-by-subject-2024.pdf | 200 | byte-identical to the apcentral 2024 PDF | same |
| 2024 | https://reports.collegeboard.org/media/xlsx/ap-score-distributions-by-subject-2024.xlsx | 200 | xlsx of the 2024 table (not parsed; openpyxl not installed) | 016b5447b71cfc1038eebe0eb6a0701b540cdc5fdb6e3c66a130077d682d2753 |
| check | https://apstudents.collegeboard.org/about-ap-scores/score-distributions/ap-biology | 200 | per-subject history; 2026 row has blank Test Takers and Mean; 2025 row (287,232, 3.24, 18.9% 5s) matches the PDF | - |
| check | https://apstudents.collegeboard.org/about-ap-scores/score-distributions/2025 | 200 | 2025 percent page (not parsed; PDF used) | - |

Cross-checks run by `scripts/parse_pdf_text.py` on 2024 and 2025, all 98 rows pass: counts 5..1 sum to Number of Students; 5+4+3 equals the printed 3-or-higher count; each printed % equals count/total to 0.1; the printed mean equals the count-weighted mean to 0.01. 2026: every row's five percents sum to 100 and 5+4+3 matches the printed 3+ within 1 point.

Footnotes: 2025 table reflects 6,182,171 exams by 3,243,979 students from 23,664 schools; 2024: 5,744,259 exams, 3,079,134 students, 23,722 schools.

## Tried, not found (HTTP status)

- 404 https://apcentral.collegeboard.org/about-ap-scores/score-distributions (and trailing slash)
- 404 https://apcentral.collegeboard.org/scores/score-distributions
- 404 https://apcentral.collegeboard.org/about-ap-scores
- 404 https://apcentral.collegeboard.org/media/pdf/ap-score-distributions-by-subject-2026.pdf
- 404 https://apcentral.collegeboard.org/media/pdf/ap-student-score-distributions-2026.pdf
- 404 https://reports.collegeboard.org/media/pdf/ap-student-score-distributions-2026.pdf
- 404 https://reports.collegeboard.org/media/pdf/2026-ap-student-score-distributions.pdf
- 404 https://reports.collegeboard.org/media/pdf/2025-ap-student-score-distributions.pdf
- 404 https://reports.collegeboard.org/media/pdf/ap-student-score-distributions-2025.pdf
- 404 https://reports.collegeboard.org/media/pdf/ap-score-distributions-by-subject-2025.pdf
- 404 https://reports.collegeboard.org/media/xlsx/ap-score-distributions-by-subject-2025.xlsx
- 404 https://reports.collegeboard.org/media/xlsx/ap-score-distributions-by-subject-2026.xlsx
- 404 https://reports.collegeboard.org/ap-program-results/score-distributions
- 200 https://reports.collegeboard.org/ap-program-results and /ap-program-results/data-archive: archive lists files only through 2024 (no 2025 or 2026 by-subject file there).
- 404 https://apstudents.collegeboard.org/about-ap-scores/score-scale-table

## Scoring worksheets (composite to AP score)

Official College Board practice exams with a "Scoring Worksheet" and "AP Score Conversion Chart", all 200, application/pdf:

| exam | URL | sha256 |
| --- | --- | --- |
| Calculus AB 2012 | https://secure-media.collegeboard.org/digitalServices/pdf/ap/ap-calculus-ab-practice-exam-2012.pdf | 846c2f223479c3c7c5ca183a95fcd30f99bea2741a867073be7439afb67967d6 |
| Biology 2013 | https://secure-media.collegeboard.org/digitalServices/pdf/ap/ap-biology-practice-exam-2013.pdf | 8314fcb2f8bb3bc974d246b7441ac782862db3e19dc3b0c7acd4ee0ff4325294 |
| Statistics 2012 | https://secure-media.collegeboard.org/digitalServices/pdf/ap/ap-statistics-practice-exam-2012.pdf | c5bce2e1a1ff99ba70669aec7acd455f0e83327fe95e87bc103fd5da41d7844b |
| World History 2013 | https://secure-media.collegeboard.org/digitalServices/pdf/ap/ap-world-history-practice-exam-2013.pdf | 6eb500526ae7338120367b85c12e69e6750ce0c8f73ec7daff8429ff57fc7f61 |
| Psychology 2012 | https://secure-media.collegeboard.org/digitalServices/pdf/ap/ap-psychology-practice-exam-2012.pdf | c9b76895036daa5abbd1dc99f0178baf46775a7d353ea68f9aa9510ef458924d |
| Macroeconomics 2012 | https://secure-media.collegeboard.org/digitalServices/pdf/ap/ap-macroeconomics-practice-exam-2012.pdf | 689f0d3d50f61049f0d0c4ce5cfc685e74ed53002f6d7eaf2630f02782b9ae66 |
| Microeconomics 2012 | https://secure-media.collegeboard.org/digitalServices/pdf/ap/ap-microeconomics-practice-exam-2012.pdf | d405465711b5d9bdc75d88fa0b6232121cb177583388712df1d9c55f13c651a5 |

Probed the same pattern (ap-<subject>-practice-exam-<2012..2015>.pdf) for 19 subjects; only the 7 above return 200. For each, weights x max raw points reproduce the chart's composite maximum (108, 120, 100, 120, 150, 90, 90).

Found but NOT composite charts (multiple-choice-range vs percent tables for pre-2011 released exams; composite cuts only in the printed book): french-lang-2008, english-language-released-exam-2007, env-sci-1998, human-geo-2006 scoring worksheets under https://secure-media.collegeboard.org/apc/. https://secure-media.collegeboard.org/apc/biology-scoring-worksheet-1999.pdf returns an HTML page, not a PDF.

## Caveats

- 2026 is percent-only and whole-number rounded. No 2026 counts, totals, mean or SD exist on any College Board page found. The page says it updates on a rolling basis; a counts PDF may appear later.
- 2026 has 40 Total Group exams only; 2024/2025 also have Calculus AB subscore, Music Theory aural/nonaural subscores and 6 Standard Group language rows (kind = subscore / standard_group).
- Worksheet charts are for one practice exam format (2012 or 2013). College Board does not publish cut scores for live exams and they vary by year. Current exam formats may differ from the 2012/2013 practice exams (not verified this session); an estimator must say which practice exam it uses and should check the current Course and Exam Description.
- 2024 PDF headers misspell "Alegebra"/"Alegbra"; canonical names used, source label kept in label_in_source.
