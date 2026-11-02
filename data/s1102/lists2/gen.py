import re,sys
H=lambda r:f"https://{r}.lipmichal.workers.dev/mcp"
G=lambda r:f"https://github.com/theluckystrike/{r}"
# repo, name, A section, A desc (<=80), B section, B caps, B tags
E_=[
("car-loan-interest-deduction-calculator-mcp","Car Loan Interest Deduction Calculator MCP","Finance","US car loan interest deduction, SALT cap, child tax credit and 2026 brackets","Finance and Commerce","Calculate the 2025-2028 car loan interest deduction with income phase-out, the SALT cap, child tax credit and 2026 tax brackets for US filers","`official` `tax` `usa` `calculator` `streamable-http`"),
("dscr-loan-calculator-mcp","DSCR Loan Calculator MCP","Finance","DSCR, max loan, rent needed and amortization for rental property loans","Finance and Commerce","Debt service coverage ratio, maximum loan for a target DSCR, rent needed, scenario comparison and amortization summary for rental property loans","`official` `real-estate` `lending` `calculator` `streamable-http`"),
("gold-price-per-gram-mcp","Gold Price Per Gram MCP","Finance","Live 24K to 9K gold price per gram in any currency, melt value and tola units","Finance and Commerce","Live gold price per gram by karat in about 160 currencies, silver, platinum and palladium prices, jewelry melt value and tola unit conversion; spot price can be up to 5 minutes old","`official` `markets` `gold` `calculator` `streamable-http`"),
("minimum-wage-mcp","Minimum Wage MCP","Finance","US state minimum wage rates 2026-2027, tipped wages and scheduled increases","Finance and Commerce","US minimum wage by state for 50 states and DC for 2026-2027, tipped wages, upcoming increases, state comparison and annual income at minimum wage","`official` `wages` `usa` `labor` `streamable-http`"),
("no-tax-on-overtime-mcp","No Tax on Overtime MCP","Finance","2025-2028 overtime, tips and senior deduction calculator with IRS caps","Finance and Commerce","Calculate the 2025-2028 federal overtime, tips and senior deductions with IRS caps and income phase-outs, estimate tax savings and explain eligibility","`official` `tax` `usa` `calculator` `streamable-http`"),
("paycheck-calculator-mcp","Paycheck Calculator MCP","Finance","US take-home pay with 2025-2026 IRS brackets, FICA wage base and state tax","Finance and Commerce","US take-home pay from 2025-2026 IRS brackets, FICA wage base and state income tax, state comparison, salary and hourly conversion and federal brackets","`official` `payroll` `tax` `usa` `streamable-http`"),
("retirement-contribution-limits-2027-mcp","Retirement Contribution Limits 2027 MCP","Finance","401k, IRA and HSA limits 2025-2027, age 60-63 catch-up and Social Security COLA","Finance and Commerce","401(k), IRA and HSA contribution limits for 2025-2027, age 60-63 catch-up, maximum contribution for a given profile, Social Security COLA and year comparison","`official` `retirement` `tax` `usa` `streamable-http`"),
("section-179-deduction-calculator-mcp","Section 179 Deduction Calculator MCP","Finance","Section 179 deduction, 100% bonus depreciation, heavy SUV limits and loan cost","Finance and Commerce","Section 179 deduction, 100% bonus depreciation after OBBBA, vehicle depreciation limits including heavy SUVs, and equipment loan payment","`official` `tax` `usa` `depreciation` `streamable-http`"),
("uk-income-tax-salary-mcp","UK Income Tax Salary MCP","Finance","UK take-home pay 2025/26 and 2026/27 with Scottish bands, NI and student loans","Finance and Commerce","UK take-home pay for 2025/26 and 2026/27 with Scottish bands, National Insurance and student loans, tax bands, salary comparison and marginal rate including the 60% trap","`official` `tax` `uk` `payroll` `streamable-http`"),
("us-federal-holidays-business-days-mcp","US Federal Holidays Business Days MCP","Productivity","Exact US business days, OPM and Federal Reserve holidays and invoice due dates","Work and Productivity","US federal holidays with OPM and Federal Reserve observed dates, business day checks, add or count business days and invoice due dates","`official` `calendar` `holidays` `usa` `streamable-http`"),
("ab-test-sample-size-calculator-mcp","A/B Test Sample Size Calculator MCP","Marketing & Analytics","A/B test sample size, duration, z-test, chi-square and Fisher exact tests","Science and Computation","A/B test sample size and duration, z-test and chi-square significance, Fisher exact tests and a check for peeking risk in a running test","`official` `statistics` `ab-testing` `calculator` `streamable-http`"),
("subdomain-finder-mcp","Subdomain Finder MCP","Security","Passive subdomain enumeration from certificate transparency logs and DNS","Monitoring and Security","Passive subdomain enumeration from certificate transparency logs with first and last seen dates, DNS resolution with dangling CNAME detection and an attack surface summary","`official` `recon` `dns` `certificate-transparency` `streamable-http`"),
("ap-score-distributions-mcp","AP Score Distributions MCP","Search & Knowledge","Official College Board AP score distributions, percentiles and pass rates","Search and Research","Official College Board AP score distributions for 2024-2026, percentile and pass rate estimates, exam comparison and composite score to AP score estimates","`official` `education` `ap-exams` `statistics` `streamable-http`"),
("cups-to-grams-mcp","Cups to Grams MCP","Search & Knowledge","Ingredient-aware cups to grams conversion with USDA densities and recipe scaling","Home and Lifestyle","Ingredient-aware cups to grams conversion using USDA and King Arthur densities, ingredient search, recipe scaling and oven temperature conversion","`official` `cooking` `recipes` `conversion` `streamable-http`"),
("recipe-nutrition-calculator-mcp","Recipe Nutrition Calculator MCP","Search & Knowledge","Recipe calories and macros per serving from USDA data with FDA label rounding","Home and Lifestyle","Calories and macros per recipe and per serving from USDA FoodData Central, ingredient lookup, FDA Nutrition Facts label rounding and recipe scaling","`official` `nutrition` `recipes` `usda` `streamable-http`"),
]
mode,path=sys.argv[1],sys.argv[2]
lines=open(path).read().split("\n")
def key(s):
    c=s.split("|")[1].strip()
    c=re.sub(r"^\[|\]\(.*$","",c) if c.startswith("[") else c
    return re.sub(r"^[^A-Za-z0-9]+","",c).lower()
def row(e):
    r,n,a,ad,b,bc,bt=e
    if mode=="A":
        assert len(ad)<=80,(len(ad),ad)
        assert "." not in ad[-1]
        return a,f"| [{n}]({G(r)}) | {ad} | TypeScript |"
    return b,(f"| {n} | [Official source repository]({G(r)}) (hosted `{H(r)}`, Streamable HTTP) | {bc} | None (read-only, no account or key) | {bt} |")
for e in E_:
    sec,rw=row(e)
    hdr=re.compile(r"^### "+re.escape(sec)+r"\s*$")
    i=next(k for k,l in enumerate(lines) if hdr.match(l))
    j=i+1
    while not lines[j].startswith("|"): j+=1
    j+=2  # skip header+separator
    while lines[j].startswith("|") and (lines[j].count("|")<6 and mode=="B" or key(lines[j])<key(rw)): j+=1
    lines.insert(j,rw)
open(path,"w").write("\n".join(lines))
