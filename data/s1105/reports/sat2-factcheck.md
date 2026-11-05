# S1105 sat2 fact gate (2026-11-05)

Result: all three satellites PASS. No server number was wrong or unannounced. Live calls in ~/mcp-servers/data/s1105/calls/sat2/.

| fact | server says | official source | match |
|---|---|---|---|
| 2027 COLA | 3.6 percent, paid January 2027, FR doc 2026-21796 published 2026-10-26 | SSA 2027 fact sheet https://www.ssa.gov/cola/factsheets/2027.html (announced 2026-10-14), Federal Register https://www.federalregister.gov/d/2026-21796 | yes |
| 2027 taxable maximum | $192,300 | SSA 2027 fact sheet (up from $184,500) | yes |
| 2027 earnings test | $25,560 ($2,130 a month), $67,920 ($5,660 a month) in the FRA year, $1 per $2 and $1 per $3 | SSA 2027 fact sheet | yes |
| FRA rules | 65 to 1937, +2 months a year 1938 to 1942, 66 for 1943 to 1954, +2 months 1955 to 1959, 67 from 1960; January 1 rule; day-before-birthday rule; 5/9 and 5/12 reductions; survivor FRA 66 and 8 months for 1960 | 20 CFR 404.409, 404.102, 404.311, 404.410 (https://www.ecfr.gov/current/title-20/chapter-III/part-404/section-404.409) | yes (checked born 1960-07-15: FRA 2027-07, earliest 2022-08, 70.417 percent) |
| I bond Nov 2026 to Apr 2027 | composite 5.51 percent, fixed 1.40, semiannual inflation 2.04, next rates 2027-05-01 | TreasuryDirect https://www.treasurydirect.gov/savings-bonds/i-bonds/i-bonds-interest-rates/ and rate chart https://treasurydirect.gov/files/savings-bonds/i-bond-rate-chart.pdf ("effective November 1, 2026") | yes; formula 1.40 + 2x2.04 + 1.40x2.04 = 5.51 |
| I bond April 2022 issue, Oct 2026 to Mar 2027 | 3.34 percent (fixed 0, inflation 1.67 from May 2026) | May 2026 release 4.26 percent with 0.90 fixed implies 1.67 semiannual inflation (https://www.treasurydirect.gov/news/2026/release-05-01-rates/) | yes |
| PMMS latest | 30-year 7.24 percent, 15-year 6.60 percent, week of 2026-10-29, 6.17 a year ago | Freddie Mac release https://freddiemac.gcs-web.com/news-releases/news-release-details/mortgage-rates-decline-further-724 and https://www.freddiemac.com/pmms | yes; the 2026-11-05 release was not yet out when called (14:02 UTC); the server reads the CSV at call time |

## Hosted I bond fallback

Correct. The hosted Worker still gets no answer from TreasuryDirect within 4 s, so it answers from the built-in chart. The numbers match the official chart effective November 1, 2026. The result labels this in `rate_source: "built-in TreasuryDirect rate chart"` and in `live_check: "TreasuryDirect page not reachable (no answer within 4 s); built-in table used"`. A minor gap is that the summary text does not name the chart's effective date, and `source` points to the interest rates page, not the PDF. The site page note states the fallback and the chart date.
