# Data sources

This server has no live data. Its value is exact arithmetic. Every formula below is checked against a published
reference or an independent computation, and each test fixture names the one it uses. Fetch dates are the dates each
reference was fetched and checked for this build.

## Formulas

| Tool | Method | Reference |
| --- | --- | --- |
| calculate_sample_size | Two independent proportions, pooled variance under H0, unpooled under H1, no continuity correction; unequal allocation k = n_variant / n_control | Fleiss, Levin and Paik (2003) Statistical Methods for Rates and Proportions, 3rd ed., section 4.2. Same closed form R `power.prop.test` solves: https://stat.ethz.ch/R-manual/R-devel/library/stats/html/power.prop.test.html (fetched 2026-11-02) |
| calculate_sample_size (Evan Miller figure) | `num_subjects()` as published: baseline variance in the first term, alpha/2 always, rounded | https://www.evanmiller.org/ab-testing/sample-size-fixed.js and sample-size.js (fetched 2026-11-02) |
| test_ab_significance | Pooled two-proportion z-test; Wald interval; Pearson chi-square with and without Yates; SRM chi-square goodness of fit | statsmodels `proportions_ztest`, `proportions_chisquare`; scipy `chi2_contingency`, `chisquare` |
| fisher_exact_test (2x2) | Hypergeometric sums; two-sided = all tables with probability <= observed (relative tolerance 1e-7) | R `fisher.test`: https://stat.ethz.ch/R-manual/R-devel/library/stats/html/fisher.test.html (fetched 2026-11-02) |
| fisher_exact_test (r x c) | Fisher-Freeman-Halton exact test, network algorithm with exact longest and shortest completions | Freeman and Halton (1951) Biometrika 38:141-149; Mehta and Patel (1983) JASA 78:427-434 |
| check_peeking_risk | Recursive numerical integration of the crossing probability for equally spaced looks; Pocock and O'Brien-Fleming constants by bisection | Armitage, McPherson and Rowe (1969) JRSS A 132:235-244; Pocock (1977) Biometrika 64:191-199; O'Brien and Fleming (1979) Biometrics 35:549-556; Jennison and Turnbull (2000) Group Sequential Methods, Tables 2.1 and 2.3 |
| all | Inverse normal: Wichura (1988) AS 241. Normal and chi-square tails: regularized incomplete gamma (series and continued fraction), Lanczos log-gamma | Applied Statistics 37:477-484 |

## Fixture references (test/core.test.mjs)

Published outputs, fetched 2026-11-02:

- R `power.prop.test(p1 = .50, p2 = .75, power = .90)` prints `n = 76.7` (R documentation, link above). This server: 76.707, so 77 per group.
- R `fisher.test(TeaTasting, alternative = "greater")` prints `p = 0.2429` (R documentation). This server: 0.242857.
- R `fisher.test(Job)` (Agresti 2002, p. 57, 4 x 4 job satisfaction) prints `# 0.7827` (R documentation). This server: 0.782685.
- Evan Miller's calculator defaults (baseline 20%, MDE 5 points absolute, power 80%, alpha 5%): 1,030 per variation, computed from his published JavaScript. This server: 1,030.

Independent computations with scipy 1.13.1 and statsmodels 0.14.6 (`scripts/reference.py`, which shares no code with `src/`):

- Sample sizes: 10% to 12% = 3,840.847; 5% baseline 20% relative at 90% power = 10,920.389; 20% to 25% two-sided = 1,093.739,
  one-sided = 861.420; 10% to 12% with 2:1 allocation = 2,910.513 control; 3% baseline 10% relative at alpha 0.05/3 = 70,973.997.
- 200/1000 vs 250/1000: z = 2.677398, p = 0.0074196; chi-square 7.168459; Yates 6.884588 (p 0.0086942); Fisher 0.0086492.
- 480/10000 vs 520/10000 one-sided: z = 1.297771, p = 0.097183. SRM 5,000 vs 5,300: p = 0.0031167.
- Fisher 2x2: TeaTasting two-sided 0.485714; R's Convictions table, alternative less, 0.00046518; [[8,2],[1,5]] 0.034965.
- Fisher-Freeman-Halton against brute-force enumeration of every table: 3x3 0.04655035, 2x4 0.03258222, 3x4 0.08956590.
- Job table chi-square 5.965515 on 9 df, p 0.743365.
- Peeking at alpha 0.05 (fine grid, h = 0.01; K = 2 and 3 also checked with scipy's multivariate normal CDF):
  2 looks 0.083118, 3 looks 0.107256, 5 looks 0.141689, 10 looks 0.193357. These match the 0.083, 0.107, 0.142 and 0.193 of Armitage et al. (1969).
- Boundary constants at alpha 0.05: Pocock 2.1783 (K = 2), 2.4132 (K = 5); O'Brien-Fleming 1.9774 (K = 2), 2.0401 (K = 5). These match
  Jennison and Turnbull's tables (2.178, 2.413, 1.977, 2.040).
