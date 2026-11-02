# Data sources

Every rule, rate and threshold in `src/core.ts` was copied from the documents below. All were fetched on 2026-11-02.

| Item | Value used | Source |
|---|---|---|
| Car loan interest cap | $10,000 of qualified passenger vehicle loan interest per return | 2025 Schedule 1-A line 24; 2025 Form 1040 instructions, Schedule 1-A Part IV |
| Car loan phase-out | $200 for each $1,000 of MAGI over $100,000 ($200,000 married filing jointly); the division rounds UP ("increase 0.05 to 1") | 2025 Schedule 1-A lines 26-30 |
| Car loan years | Taxable years beginning after Dec 31, 2024 and before Jan 1, 2029 | Notice 2025-57 section 2.01 |
| Car loan eligibility | Loan originated after Dec 31, 2024 by you; used to purchase (not lease); new vehicle; car, minivan, van, SUV, pickup or motorcycle under 14,000 lb GVWR; final assembly in the US; personal use more than 50%; first lien; VIN on the return; refinancing and negative equity rules | 2025 Form 1040 instructions, Schedule 1-A Part IV; Notice 2025-57 section 2.01 |
| SALT cap 2025 | $40,000 ($20,000 MFS); 30% of MAGI over $500,000 ($250,000 MFS); not below $10,000 ($5,000 MFS) | 2025 Schedule A instructions, line 5e and State and Local Tax Deduction Worksheet |
| SALT cap 2026 | $40,400 ($20,200 MFS); threshold $505,000 ($252,500 MFS) | 2026 draft Schedule A line 5e; IRC 164(b)(7)(A)(ii), (B)(ii)(II) |
| SALT cap 2027-2029 | 101% of the prior year for both the cap and the threshold: 2027 $40,804 / $510,050; 2028 $41,212.04 / $515,150.50; 2029 $41,624.16 / $520,302.01 (computed, no IRS form yet) | IRC 164(b)(7)(A)(iii), (B)(ii)(III) |
| SALT cap 2030 on | $10,000, no phase-down | IRC 164(b)(7)(A)(iv) |
| 2025 brackets | Rev. Proc. 2024-40 section 3.01 tables 1-4 | rp-24-40.pdf |
| 2026 brackets | Rev. Proc. 2025-32 section 4.01 tables 1-4 | rp-25-32.pdf |
| 2025 standard deduction | $15,750 single/MFS, $31,500 joint, $23,625 HoH; additional $1,600 married, $2,000 unmarried (chart: $17,750 single, $33,100 joint with one box) | 2025 Form 1040 instructions |
| 2026 standard deduction | $16,100 single/MFS, $32,200 joint, $24,150 HoH; additional $1,650 / $2,050 | Rev. Proc. 2025-32 section 4.14 |
| Child tax credit 2025 | $2,200 per child, refundable up to $1,700, $500 other dependents | 2025 Schedule 8812 lines 5, 7, 16b; Schedule 8812 instructions |
| Child tax credit 2026 | $2,200, refundable $1,700 | Rev. Proc. 2025-32 section 4.05 |
| CTC phase-out | 5% of MAGI over $400,000 joint / $200,000 others; excess rounded up to the next $1,000 | 2025 Schedule 8812 lines 9-12 |
| ACTC earned income | 15% of earned income over $2,500 | 2025 Schedule 8812 lines 18a-20 |

## URLs

- Schedule 1-A (Form 1040) 2025: https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf
- 2025 Form 1040 instructions: https://www.irs.gov/pub/irs-pdf/i1040gi.pdf
- Notice 2025-57: https://www.irs.gov/pub/irs-drop/n-25-57.pdf
- 2025 Schedule A instructions: https://www.irs.gov/pub/irs-pdf/i1040sca.pdf
- 2026 draft Schedule A: https://www.irs.gov/pub/irs-dft/f1040sa--dft.pdf
- IRC 164 (statute text, Cornell LII): https://www.law.cornell.edu/uscode/text/26/164
- Rev. Proc. 2024-40: https://www.irs.gov/pub/irs-drop/rp-24-40.pdf
- Rev. Proc. 2025-32: https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
- Schedule 8812 (2025): https://www.irs.gov/pub/irs-pdf/f1040s8.pdf
- Schedule 8812 instructions (2025): https://www.irs.gov/pub/irs-pdf/i1040s8.pdf

## 2027 check

On 2026-11-02 the IRS had not published the 2027 inflation revenue procedure. Checked: https://www.irs.gov/irb (latest bulletins 2026-41 to 2026-44 list Rev. Proc. 2026-14, 2026-20, 2026-25, 2026-29, 2026-31 and no inflation adjustments), https://www.irs.gov/pub/irs-drop/rp-26-35.pdf through rp-26-50.pdf (all 404; control rp-25-32.pdf 200), and the IRS news release lists for September and the current month. When it is published, add 2027 to `BRACKETS`, `STANDARD_DEDUCTION` and `CTC` in `src/core.ts`.
