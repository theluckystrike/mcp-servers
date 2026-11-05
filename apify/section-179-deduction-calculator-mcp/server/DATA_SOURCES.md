# Data sources

Every limit, rate and rule in `src/core.ts` was copied from the documents below. All were fetched from irs.gov on 2026-11-02.

| Item | Value used | Source |
|---|---|---|
| Section 179 limit 2025 | $2,500,000, reduced dollar for dollar above $4,000,000; nothing at $6,500,000 | 2025 Form 4562 instructions (What's New, line 1-5 worksheet); Pub. 946 (2025) chapter 2, Jane Ash example ($4,050,000 gives $2,450,000) |
| Section 179 limit 2026 | $2,560,000, reduced above $4,090,000 | Rev. Proc. 2025-32 section 4.24 |
| Heavy SUV cap | $31,300 (2025), $32,000 (2026) for a 4-wheeled passenger vehicle rated over 6,000 and up to 14,000 lb GVWR; exceptions for more than nine seats behind the driver, a cargo area of at least 6 feet, and certain cargo vans | Pub. 946 (2025) chapter 2, Sport Utility and Certain Other Vehicles; Rev. Proc. 2025-32 section 4.24 |
| Business income limit and carryover | Deduction limited to taxable income from active trades or businesses (including wages); excess carries forward | Pub. 946 chapter 2, Business Income Limit; Form 4562 lines 11-13 |
| Bonus depreciation after Jan 19, 2025 | 100% for qualified property acquired after January 19, 2025 (permanent); election for 40% (60% long production and certain aircraft) in the first tax year ending after January 19, 2025 | Notice 2026-11 sections 2.02 and 3.07; 2025 Form 4562 instructions, What's New and line 14 |
| Acquisition date | Not treated as acquired after the date a written binding contract is entered into | Notice 2026-11 sections 2.02(1) and 3.03 |
| Bonus for property acquired before Jan 20, 2025 | TCJA phase-down: 100% through 2022, down 20 points a year from 2023 (from 2024 for long production property and certain aircraft); 40% placed in service in 2025 (60% long production) | Notice 2026-11 section 2.01; 2025 Form 4562 instructions; Pub. 946 chapter 3 |
| Qualified property | MACRS with recovery period of 20 years or less, off-the-shelf software, water utility property, qualified productions; new or used | 2025 Form 4562 instructions line 14 |
| Passenger auto caps 2025 | With bonus $20,200 / $19,600 / $11,800 / $7,060; without bonus $12,200 / $19,600 / $11,800 / $7,060 | Rev. Proc. 2025-16 Tables 1 and 2 |
| Passenger auto caps 2026 | With bonus $20,300 / $19,800 / $11,900 / $7,160; without bonus $12,300 / $19,800 / $11,900 / $7,160 | Rev. Proc. 2026-15 Tables 1 and 2 |
| Passenger automobile | Rated at 6,000 lb or less (gross vehicle weight for trucks and vans) | Pub. 946 chapter 5 |
| Listed property | Section 179 and bonus need more than 50% qualified business use | Pub. 946 chapters 3 and 5 |

Loan payments use the standard amortization formula, payment = P x r / (1 - (1 + r)^-n) with r = APR / 12. Checked against the known value of $1,933.28 for $100,000 at 6% over 60 months.

## URLs

- Rev. Proc. 2025-32: https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
- 2025 Instructions for Form 4562: https://www.irs.gov/pub/irs-pdf/i4562.pdf
- Pub. 946 (2025): https://www.irs.gov/pub/irs-pdf/p946.pdf
- Notice 2026-11: https://www.irs.gov/pub/irs-drop/n-26-11.pdf
- Rev. Proc. 2025-16: https://www.irs.gov/pub/irs-drop/rp-25-16.pdf
- Rev. Proc. 2026-15: https://www.irs.gov/pub/irs-drop/rp-26-15.pdf

## 2027 check

On 2026-11-02 the IRS had not published the 2027 inflation revenue procedure with the 2027 Section 179 limits. Checked: https://www.irs.gov/irb (bulletins 2026-41 to 2026-44: no inflation adjustments revenue procedure), https://www.irs.gov/pub/irs-drop/rp-26-35.pdf through rp-26-50.pdf (all 404; control rp-25-32.pdf 200). The tools return a clear error for 2027 until then. When it is out, add the year to `LIMITS` in `src/core.ts`. The 2027 Section 280F caps come in a separate revenue procedure, usually in the first quarter.
