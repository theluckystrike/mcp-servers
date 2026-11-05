# S1102 scout: next 6 data satellites

Window: GSC final 2026-10-02..2026-10-30. Commands and raw data in data/s1102/scout/ (pull.py, totals.json, top.json, gh.tsv, reg.txt). Details in scout.json.

Honest read: the uncovered property base is thin. Excluding covered sites and zovo.one, only recipetool.net (363), taxbreakcalc.com (84), assetloancalculator.com (37) and abwex.com (22) have 20+ clicks with a data concept. belikenative.com (719), englishlearner.org (151) and makeroll.com (40) are mostly brand-name queries with nothing a satellite can feed.

| # | repo | money site | clicks 28d | impr 28d | GH field | registry |
|---|---|---|---|---|---|---|
| 1 | car-loan-interest-deduction-calculator-mcp | https://taxbreakcalc.com/ | 84 | 13210 | {'car loan interest deduction mcp': 0, 'obbba tax mcp': 2, 'salt deduction mcp': 0, 'child tax credit mcp': 0, 'tax deduction calculator mcp': 1, 'standard deduction mcp': 0, 'car loan calculator mcp': 0} | none: search car-loan, obbba, salt, tax-deduction, standard deduction, child tax credit al |
| 2 | section-179-deduction-calculator-mcp | https://assetloancalculator.com/ | 37 | 8687 | {'section 179 mcp': 0, 'section 179 deduction calculator mcp': 0, 'bonus depreciation mcp': 0, 'depreciation mcp': 7, 'rv loan calculator mcp': 0, 'land loan calculator mcp': 0, 'manufactured home loan mcp': 0} | none for section-179/179 (hits are unrelated); depreciation has io.github.Evozim/depreciat |
| 3 | subdomain-finder-mcp | https://bugbountyreality.com/ | 12 | 5544 | {'subdomain finder mcp': 1, 'subdomain enumeration mcp': 5, 'certificate transparency mcp': 20, 'subdomain mcp': 66, 'crt.sh mcp': 11} | io.github.pipeworx-io/crtsh; app.subdomain/subdomains and my.sitey/subdomains are hosting  |
| 4 | recipe-nutrition-calculator-mcp | https://recipetool.net/ | 363 | 20089 | {'recipe nutrition mcp': 31, 'nutrition calculator mcp': 4, 'recipe calorie calculator mcp': 0, 'usda nutrition mcp': 26, 'nutrition mcp': 392, 'recipe mcp': 824} | calorie search returns 8 (calorieapi, calorielog, kairo ...); nutrition-calculator and rec |
| 5 | ab-test-sample-size-calculator-mcp | https://abwex.com/ | 22 | 1707 | {'ab test calculator mcp': 2, 'sample size calculator mcp': 0, 'statistical significance mcp': 3, 'fisher exact test mcp': 0, 'ab testing mcp': 37} | so.mida/ab-testing (platform), io.github.srotzin/hive-mcp-abtest; none for sample-size or  |
| 6 | ap-score-distributions-mcp | https://examscorecalc.com/ | 1 | 1341 | {'ap exam score mcp': 1, 'ap score calculator mcp': 1, 'ap exam mcp': 88} | none (ap-score, ap-exam, collegeboard all 0) |

## 1. car-loan-interest-deduction-calculator-mcp

Money site https://taxbreakcalc.com/ (landing https://taxbreakcalc.com/car-loan-interest-calculator/). Monetization: donation links only (paypal.me, buymeacoffee); no ads seen.

Tools:
- calculate_car_loan_interest_deduction: OBBBA 163(h)(4) deduction: 10,000 cap, MAGI phaseout 100k/200k, tax years 2025-2028, US final assembly rule
- calculate_salt_deduction: SALT cap under OBBBA (40,000 raised, MAGI phaseout, 2025-2029 schedule) vs standard deduction
- get_2026_standard_deduction_and_brackets: 2026 standard deduction, brackets, CTC from Rev. Proc. 2025-32
- calculate_child_tax_credit: 2,200 CTC with phaseout and refundable part by filing status
- check_state_overtime_tax: does a state tax overtime pay (state-level table that feeds the 70 taxbreakcalc state pages)

Sources:
- https://www.irs.gov/pub/irs-drop/rp-25-32.pdf (fetched 200, 2026 adjusted items)
- https://www.irs.gov/pub/irs-drop/n-25-57.pdf (fetched 200, car loan interest reporting/guidance)
- https://www.irs.gov/irb/2025-45_IRB (fetched 200)

Data changes: annual table + statute; next Rev. Proc. for 2027 expected Oct-Nov 2026, builder must check irs-drop for it
Why a model cannot: OBBBA (July 2025) car-loan-interest deduction, 40k SALT cap and 2026 indexed amounts post-date or sit at the edge of training data; needs exact phaseout arithmetic.

## 2. section-179-deduction-calculator-mcp

Money site https://assetloancalculator.com/ (landing https://assetloancalculator.com/section-179-deduction-calculator/). Monetization: donation links only (paypal.me, buymeacoffee); no ads seen.

Tools:
- calculate_section_179: 179 expensing with 2026 limit and dollar-for-dollar phaseout, taxable-income limit
- calculate_bonus_depreciation: bonus rate by placed-in-service date (100 percent restored for property acquired after 2025-01-19 under OBBBA)
- get_vehicle_depreciation_limits: SUV 179 cap and over-6,000-lb vehicle rules, luxury auto caps
- calculate_asset_loan_payment: exact amortized payment for land/ATV/pontoon/RV/manufactured home loans (the pages that actually get impressions)
- compare_buy_vs_lease_tax_effect: first-year tax effect of 179 plus financing cost

Sources:
- https://www.irs.gov/pub/irs-drop/rp-25-32.pdf sec 4.24 (fetched: 2026 179 limit 2,560,000)
- https://www.irs.gov/instructions/i4562 (fetched 200)
- https://www.irs.gov/publications/p946

Data changes: annual table; same 2027 Rev. Proc. check as #1
Why a model cannot: OBBBA changed 179 limits and restored 100 percent bonus in 2025; 2026 indexed figures are only in Rev. Proc. 2025-32.

## 3. subdomain-finder-mcp

Money site https://bugbountyreality.com/ (landing https://bugbountyreality.com/tools/subdomain-finder/). Monetization: one awin affiliate string; site is an ops database, zovo.one cross-links.

Tools:
- find_subdomains: passive subdomain list for a domain from certificate transparency, deduped, wildcard-stripped
- check_subdomains_resolve: DNS-over-HTTPS A/AAAA/CNAME for a list, flags dangling CNAMEs
- get_certificate_history: issuers and first/last seen for a host
- summarize_attack_surface: group subdomains by label pattern (dev, staging, api, admin)

Sources:
- https://crt.sh/?q=%25.example.com&output=json (fetched 200, 16 rows)
- https://api.certspotter.com/v1/issuances?domain=example.com&include_subdomains=true&expand=dns_names (fetched 200, no key)
- https://cloudflare-dns.com/dns-query (DoH)

Data changes: LIVE. Risk: crt.sh is slow/flaky from Workers, use certspotter as fallback; certspotter free tier is rate limited per IP
Why a model cannot: needs live CT-log and DNS data; no model knows a domain's current subdomains.

## 4. recipe-nutrition-calculator-mcp

Money site https://recipetool.net/ (landing https://recipetool.net/). Monetization: donation links only; no ads seen. 350 of 363 clicks are on the homepage, queries are anonymized so partly brand.

Tools:
- calculate_recipe_nutrition: calories, protein, fat, carbs, fiber, sodium per recipe and per serving from ingredient lines
- lookup_food_nutrition: USDA nutrient values per 100 g and per common household measure
- calculate_macro_split: macro percentages and per-serving label values
- calculate_recipe_cost_per_serving: cost from supplied prices and yield

Sources:
- https://fdc.nal.usda.gov/download-datasets (fetched 200; SR Legacy/Foundation CSV, public domain, embed a top-N subset)
- https://api.nal.usda.gov/fdc/v1/foods/search (works with DEMO_KEY but DEMO_KEY is rate limited per IP, so do NOT use live from a Worker; real key = OWNER UNLOCK at https://fdc.nal.usda.gov/api-key-signup)

Data changes: static table (SR Legacy frozen 2018, Foundation updated twice a year)
Why a model cannot: WEAKEST of the six on this axis: models estimate nutrition roughly; value is exact USDA lookups plus consistent arithmetic. Included because it is the biggest traffic site by far.

## 5. ab-test-sample-size-calculator-mcp

Money site https://abwex.com/ (landing https://abwex.com/tools/sample-size-calculator.html). Monetization: no ads; cross-links to zovo.one and kappakit.com.

Tools:
- calculate_sample_size: per-variant n for proportions and means, power, alpha, MDE
- test_ab_significance: two-proportion z test, p value, lift, CI
- fisher_freeman_halton_exact_test: exact r x c p value (abwex top click page, 10 clicks)
- calculate_confidence_interval: Wilson, Clopper-Pearson, normal intervals
- estimate_test_duration: days to reach n from daily traffic and baseline

Sources:
- no external data: closed-form statistics; cross-check fixtures against NIST/e-Handbook worked examples https://www.itl.nist.gov/div898/handbook/

Data changes: static math
Why a model cannot: exact r x c Fisher p values and power calculations are not reliable mentally; no official table, so criterion (d) is weak. Impressions figure is for sc-domain:abwex.com (1,707); the site total is in totals.json.

## 6. ap-score-distributions-mcp

Money site https://examscorecalc.com/ (landing https://examscorecalc.com/ap-score-distributions/). Monetization: donation link only.

Tools:
- get_ap_score_distribution: 5/4/3/2/1 counts and percents, mean, SD for an exam and year
- compare_ap_exams: rank exams by pass rate or share of 5s
- estimate_ap_percentile: percentile of a score within an exam
- list_ap_exams: exam names and years available

Sources:
- https://apcentral.collegeboard.org/media/pdf/ap-score-distributions-by-subject-2025.pdf (fetched 200, May 2025 table parsed OK)
- 2026 PDF: guessed -2026.pdf URL returned 404; builder must find the real 2026 link from https://apcentral.collegeboard.org (released July 2026, newer than model). If not found, ship 2025 plus older years and record it

Data changes: annual table (July)
Why a model cannot: official 2026 counts post-date training; exact counts per exam are lookup data. Lowest clicks (1), included for emptiness and data strength.

## Rejected alternates

- handsofflinks.com: dofollow-nofollow-checker-mcp (live page fetch, parse rel/robots/X-Robots-Tag) (0 clicks). 0 clicks in 28d; registry has 35 backlink servers
- kickllm.com / gpt0x.com: llm-pricing (OpenRouter /api/v1/models is live and keyless) (12 / 8 clicks). contested field
- worthmyclaim.com: workers-comp benefit rates by state (1 clicks). 1 click; no single authoritative machine-readable table (state sites, PDFs)
- dismissticket.com: state DMV point tables (1 clicks). 1 click; model already knows it
- belikenative.com, englishlearner.org, makeroll.com, claudflow.com, ml0x.com, ml3x.com, krzen.com: none (719/151/40/38/40/29/25 clicks). clicks are brand-name queries; no data concept. belikenative top query 'belikenative' 241 of 719 clicks

## Builder notes
- Verify the 2027 Rev. Proc. (irs-drop) before shipping #1 and #2; today is 2026-11-02 and it normally lands Oct-Nov.
- #1 must not repeat overtime/tips/senior (already in no-tax-on-overtime-mcp).
- #4 and #6 need data work (USDA subset embed; locating the 2026 College Board file). #4 owner unlock for a real FDC key is optional.
- #3: passive CT-log lookup only; no active scanning.