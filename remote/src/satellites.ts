// The 36 satellite MCP servers that are live on *.workers.dev but were not wired into
// this domain. Generated from each satellite's package.json; every URL below was probed
// and returned HTTP 200 on 2026-11-06. Regenerate with scripts/gen-satellites.mjs.

export type Satellite = { name: string; desc: string };

export const SATELLITES: Satellite[] = [
  { name: "ab-test-sample-size-calculator", desc: "MCP server for exact A/B test statistics: sample size, duration, z-test, chi-square, Fisher exact and Fisher-Freeman-Halton tests, peeking risk." },
  { name: "aca-premium-tax-credit-calculator", desc: "MCP server for the 2026 ACA premium tax credit: expired enhanced subsidies, 400% FPL cliff, Rev. Proc. 2025-25 table, FPL and APTC repayment rules." },
  { name: "address-to-census-tract", desc: "MCP server that turns a US address or latitude and longitude into its census tract, block group, block, county FIPS, congressional and state..." },
  { name: "ap-score-distributions", desc: "AP score distributions MCP server: official College Board 2026, 2025 and 2024 AP exam score distributions, percentiles, pass rate comparisons and..." },
  { name: "car-loan-interest-deduction-calculator", desc: "MCP server for the 2025-2028 car loan interest deduction (OBBBA), SALT cap, child tax credit, 2026 brackets and standard deduction from IRS sources." },
  { name: "cpi-inflation-calculator", desc: "MCP server: CPI inflation calculator with official BLS CPI-U, CPI-W and core CPI from 1913 to the latest month, checked live, plus..." },
  { name: "cups-to-grams", desc: "Cups to grams MCP server: ingredient-aware kitchen conversion with measured USDA and King Arthur densities, recipe scaling and oven temperatures." },
  { name: "drug-shortage-list", desc: "MCP server for the FDA drug shortage list. Is a drug in shortage now, by generic or brand name or NDC, with status, availability and reason, from..." },
  { name: "dscr-loan-calculator", desc: "DSCR loan calculator MCP server: debt service coverage ratio, max loan, rent needed, scenarios and amortization for rental property loans." },
  { name: "estate-gift-tax-exemption-calculator", desc: "MCP server for 2026 federal estate and gift tax: $15M exemption under P.L. 119-21, 2001(c) rates, annual exclusion, DSUE." },
  { name: "gold-price-per-gram", desc: "MCP server for the live gold price per gram by karat and currency, silver and platinum prices, jewelry melt value and gold unit conversion." },
  { name: "heating-oil-propane-prices", desc: "MCP server for residential heating oil and propane prices: this week's EIA average price per gallon for the US and each surveyed state, weekly..." },
  { name: "i-bond-rate", desc: "MCP server for the current Series I savings bond rate (5.51 percent for November 2026 to April 2027, fixed 1.40 percent), the rate an existing I..." },
  { name: "ingredient-convert", desc: "Ingredient unit converter MCP server: cups, tablespoons, teaspoons, millilitres, fluid ounces, grams and ounces for 30+ ingredients using a real per-ingredient density table, plus recipe scaling, bulk conversion and fraction helpers." },
  { name: "irs-mileage-rate-per-diem", desc: "MCP server: IRS standard mileage rates 2011-2026 (76 cents from July 1, 2026), GSA per diem rates by ZIP for FY2026-FY2027, IRS high-low per diem." },
  { name: "lake-level", desc: "MCP server for live US lake and reservoir water levels from USGS, USACE, CDEC, USBR and TWDB gauges." },
  { name: "minimum-wage", desc: "MCP server for US state minimum wage rates: 2026 rates, tipped wages, and scheduled 2027 increases for all 50 states and DC." },
  { name: "mortgage-rates-today", desc: "MCP server for mortgage rates today: this week's Freddie Mac PMMS average 30-year and 15-year fixed rates, week and year changes, history since..." },
  { name: "no-tax-on-overtime", desc: "MCP server for the 2025-2028 no tax on overtime, tips and senior deductions (OBBBA), with IRS caps, phase-outs and brackets." },
  { name: "paycheck-calculator", desc: "Paycheck calculator MCP server: 2025-2026 take-home pay with IRS brackets, FICA wage base and state income tax for 50 states + DC." },
  { name: "postage-stamp-price", desc: "MCP server for how much a stamp costs: the current USPS Forever stamp price, postcard, extra ounce, large envelope, international letter and flat..." },
  { name: "raw-to-cooked-weight", desc: "MCP server for raw to cooked weight of meat and poultry by cut and cooking method, from the USDA Table of Cooking Yields for Meat and Poultry." },
  { name: "recipe-nutrition-calculator", desc: "Recipe nutrition calculator MCP server: USDA FoodData Central nutrients for 398 recipe ingredients, per-serving totals, FDA Nutrition Facts label..." },
  { name: "retirement-contribution-limits-2027", desc: "MCP server for 2025-2027 401(k), IRA, HSA and SIMPLE contribution limits, the age 60-63 super catch-up, Roth catch-up rule and Social Security COLA." },
  { name: "river-level", desc: "MCP server for live US river levels, streamflow and NWS flood forecasts from USGS stream gauges." },
  { name: "sat-score-percentiles", desc: "MCP server for SAT score percentiles and class of 2026 SAT averages, participation and benchmarks by state from College Board reports." },
  { name: "section-179-deduction-calculator", desc: "MCP server for the Section 179 deduction, 100% bonus depreciation (OBBBA), heavy SUV and vehicle limits, and asset loan payments with after-tax cost." },
  { name: "silver-price-per-gram", desc: "MCP server for the live silver price per gram and ounce by fineness and currency, sterling and junk silver coin melt value, and the gold to silver..." },
  { name: "social-security-cola-2027", desc: "MCP server for the Social Security COLA 2027 (3.6 percent), full retirement age by birth date, claiming-age benefit, earnings test and 2027..." },
  { name: "student-loan-repayment-assistance-plan-calculator", desc: "MCP server for the federal student loan Repayment Assistance Plan (RAP) payment, 2026 loan limits and SAVE/PAYE/ICR transition dates." },
  { name: "subdomain-finder", desc: "MCP server for passive subdomain enumeration from certificate transparency logs (certspotter, crt.sh) with DNS over HTTPS checks." },
  { name: "uk-income-tax-salary", desc: "MCP server for UK income tax and salary take-home pay 2025/26 and 2026/27: Scottish bands, NI, student loans, pension, 60% trap." },
  { name: "uk-statutory-sick-pay-maternity-pay-calculator", desc: "MCP server for UK Statutory Sick Pay (April 2026 rules), Statutory Maternity Pay and National Living Wage rates." },
  { name: "us-federal-holidays-business-days", desc: "MCP server for exact U.S. federal holidays and business days: OPM and Federal Reserve observance, 1971-2100." },
  { name: "usps-holiday-shipping-deadlines", desc: "MCP server for USPS holiday shipping deadlines: the recommended send-by dates for Christmas delivery by mail class, for the lower 48, Alaska and..." },
  { name: "uv-index-today", desc: "MCP server for today's UV Index forecast by US ZIP code or city, with hourly peak, UV Alert and EPA sun protection advice, from EPA and NWS." },
  { name: "vegetable-yield-percentage", desc: "MCP server for vegetable and fruit yield percentage (edible portion after trimming), trim waste and how much produce to buy, from USDA refuse data." },
];

export const satelliteUrl = (n: string) => `https://${n}-mcp.lipmichal.workers.dev`;

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function toolsPage(base: string): string {
  const rows = SATELLITES.map((s) => {
    const u = satelliteUrl(s.name);
    return `<li><a href="${esc(u)}"><strong>${esc(s.name)}</strong></a><br><span>${esc(s.desc)}</span><br><code>${esc(u)}/mcp</code></li>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MCP tools index: ${SATELLITES.length} hosted servers, no install</title>
<meta name="description" content="Index of ${SATELLITES.length} hosted MCP servers for kitchen conversion, tax, benefits and price data. Each URL is a working remote MCP endpoint.">
<link rel="canonical" href="${base}/mcp/tools">
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:820px;margin:0 auto;padding:24px 16px;color:#1a1a1a;background:#fff}
h1{font-size:1.6rem;line-height:1.2}code{background:#f4f4f4;padding:2px 6px;border-radius:4px;font-size:.85em}
ul{list-style:none;padding:0}li{border-top:1px solid #e6e6e6;padding:12px 0}li span{color:#555;font-size:.92em}</style>
</head><body><h1>MCP tools index</h1>
<p>${SATELLITES.length} hosted Model Context Protocol servers. Each one answers over HTTP with no install and no API key for the free tier. Add the <code>/mcp</code> URL as a remote MCP server in your client.</p>
<ul>${rows}</ul>
<p><a href="${base}/mcp">The hosted, metered endpoints on this domain</a></p>
</body></html>`;
}
