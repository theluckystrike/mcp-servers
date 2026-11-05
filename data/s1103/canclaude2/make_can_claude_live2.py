#!/usr/bin/env python3
"""s1103 canclaude2: append wave-2 /can-claude/<slug>/ pages to data/content/can-claude-live.json.
Same template and rules as wave 1 (data/s1103/stamp/make_can_claude_live.py). Every example is a real tools/call
run 2026-11-03 against the hosted server (raw responses in data/s1103/canclaude2/calls/<name>.json).
Catalog servers (timezone, currency) live on mcp.zovo.one and need the free token; entries carry server_id.
usage: make_can_claude_live2.py <can-claude-live.json>   (reads, drops earlier wave-2 slugs, appends, writes back)"""
import json, re, sys, pathlib
CALLS = pathlib.Path('/Users/mike/mcp-servers/data/s1103/canclaude2/calls')
RUN = '2026-11-03'

def text(name):
    r = json.load(open(CALLS / f'{name}.json'))['result']
    assert not r.get('isError'), name
    return r['content'][0]['text']

def summary(name, sentences=None):
    t = text(name)
    s = re.split(r'\s\{\s*\n|\n\n\{', t, 1)[0].strip()
    s = s.split('\n\n')[0].strip()
    s = s.replace('\n', '; ')
    if sentences:
        parts = re.split(r'(?<=[.!?])\s+(?=[A-Z$0-9])', s)
        s = ' '.join(parts[:sentences])
    return s

def jfields(name, keys):
    d = json.loads(text(name))
    return json.dumps({k: d[k] for k in keys}, ensure_ascii=False)

def call(name, tool, args, prompt, sentences=None, note='', result=None):
    return {'prompt': prompt, 'tool': tool, 'args': args, 'result': result or summary(name, sentences), 'note': note,
            'is_error': False, 'run': RUN}

def a(name):
    return json.load(open(CALLS / f'{name}.json'))

P = []
P.append(dict(slug='convert-cups-to-grams', repo='cups-to-grams-mcp',
  h1='Can Claude convert cups to grams?', title='Can Claude convert cups to grams? By ingredient',
  query='can claude convert cups to grams',
  answer="Partly. A cup measures volume and a gram measures weight, so the answer depends on the ingredient, and Claude gives a typical figure from memory that may not match the chart your recipe was written with. It also has to guess which cup you mean, since US, metric and UK cups differ. Connect the free Cups to Grams server and Claude reads the weight of each ingredient from a named chart, such as King Arthur Baking or USDA FoodData Central, and says which cup it used.",
  native=['Knows that flour, sugar and butter weigh different amounts per cup.', 'Converts mL, tablespoons and teaspoons, which are fixed volumes.', 'Scales a recipe up or down once it has the weights.'],
  needs=['A gram weight per cup for each ingredient, with the chart it came from.', 'US, metric and imperial cups kept apart.', 'Whole recipes scaled to metric weights, and oven temperatures with a fan setting.'],
  example=call('cups', 'convert_ingredient', {'amount': 1, 'from_unit': 'cup', 'to_unit': 'g', 'ingredient': 'all-purpose flour'}, 'How many grams is 1 cup of all-purpose flour?'),
  example2=call('cups2', 'convert_ingredient', {'amount': 1, 'from_unit': 'cup', 'to_unit': 'g', 'ingredient': 'brown sugar'}, 'And 1 cup of brown sugar?'),
  faq=[('Why is a cup of brown sugar heavier than a cup of flour?', 'Brown sugar is packed into the cup and is denser. In the run above the server gave 220 g for packed brown sugar and 120 g for spooned and leveled flour.'),
       ('Does it handle UK and Australian recipes?', 'Yes. Set the cup system to metric (250 mL) or imperial (284.13 mL), or name the unit, such as metric_cup.')]))

P.append(dict(slug='calculate-dscr', repo='dscr-loan-calculator-mcp',
  h1='Can Claude calculate DSCR for a rental loan?', title='Can Claude calculate DSCR for a rental property loan?',
  query='can claude calculate dscr',
  answer="Yes, if you give it every number, but the loan payment math is where long answers slip. DSCR is qualifying rent divided by the full monthly housing cost, and that cost needs an exact amortized payment plus tax, insurance and HOA. Claude also can't know which vacancy factor or ratio band your lender uses. Connect the free DSCR Loan Calculator server and Claude gets the exact payment, PITIA and ratio, the largest loan a target DSCR allows, and the rent you'd need.",
  native=['Explains DSCR, PITIA and why lenders want 1.0 or 1.25.', 'Gets a close answer when you supply the monthly payment yourself.'],
  needs=['The exact principal and interest payment for any rate and term, or interest only.', 'The maximum loan for a target DSCR and LTV, and the rent needed to hit it.', 'Side by side scenarios for down payment and rate.'],
  example=call('dscr', 'calculate_dscr', {'monthly_rent': 2400, 'purchase_price': 300000, 'down_payment_pct': 25, 'annual_rate_pct': 7.25, 'term_years': 30, 'annual_property_tax': 3600, 'annual_insurance': 1500, 'vacancy_pct': 5},
    'A rental rents for $2,400 a month. I buy it for $300,000 with 25% down at 7.25% for 30 years. Tax is $3,600 a year and insurance $1,500. What is the DSCR with 5% vacancy?', sentences=4),
  faq=[('Is 1.16 good enough for a DSCR loan?', 'Many programs accept 1.00 or more, and some want 1.25. Minimums and pricing differ by lender, so the server labels the band and doesn\'t approve anything.'),
       ('Does it use current mortgage rates?', 'No. You give it the rate your lender quoted. It doesn\'t fetch market rates.')]))

P.append(dict(slug='calculate-take-home-pay', repo='paycheck-calculator-mcp',
  h1='Can Claude calculate my take-home pay?', title='Can Claude calculate take-home pay for 2026?',
  query='can claude calculate take home pay',
  answer="It gets close, but the small numbers drift. A paycheck needs the 2026 federal brackets, the standard deduction, the Social Security wage base and the state schedule, and several of those changed after most models were trained. Over a long calculation Claude can also round or slip a digit. Connect the free Paycheck Calculator server and Claude runs the exact 2025 or 2026 tables for federal tax, FICA and all 50 states plus DC.",
  native=['Explains brackets, FICA and pre-tax deductions.', 'Gives a rough estimate from memory.'],
  needs=['The 2026 IRS brackets, standard deduction and $184,500 wage base.', 'Exact 2026 state schedules for CA, NY, NJ, IL, PA, GA and NC, estimates for the rest.', 'Per-paycheck results for weekly, biweekly, semimonthly and monthly pay.'],
  example=call('pay', 'calculate_take_home_pay', {'state': 'NC', 'filing_status': 'single', 'tax_year': 2026, 'gross_annual': 92000, 'pay_frequency': 'biweekly', 'pretax_401k_percent': 6},
    'I got an offer of $92,000 a year, paid biweekly, single, in North Carolina, with 6% to a 401(k). What is my take-home per check in 2026?'),
  faq=[('Is this my exact withholding?', 'No. It estimates annual tax on wages with the standard deduction and no credits. Your employer withholds from your W-4, which can differ.'),
       ('Are local taxes included?', 'No. City and county taxes such as NYC, Ohio cities and Pennsylvania EIT, and state payroll taxes such as CA SDI, are left out and the answer says so.')]))

P.append(dict(slug='calculate-uk-take-home-pay', repo='uk-income-tax-salary-mcp',
  h1='Can Claude work out UK take-home pay for 2026/27?', title='Can Claude work out UK take-home pay for 2026/27?',
  query='can claude calculate uk take home pay',
  answer="Roughly. Claude knows how PAYE, National Insurance and student loans work, but the figures move every April, the Scottish bands change on their own schedule, and 2026/27 began after many models were trained. Pension by salary sacrifice also changes the NI and student loan sums in a way that's easy to miss. Connect the free UK Income Tax and Salary server and Claude runs the 2025/26 or 2026/27 rules for your tax code, region, pension and loan plan.",
  native=['Explains tax codes, NI classes and student loan plans.', 'Gives a ballpark figure from older tax years.'],
  needs=['2025/26 and 2026/27 bands for England, Wales, Northern Ireland and Scotland.', 'Tax codes including K, BR, D0 and emergency codes.', 'Salary sacrifice or relief at source pensions, and Plan 1, 2, 4, 5 and postgraduate loans.', 'Your marginal rate, including the 60% band above £100,000.'],
  example=call('uk', 'calculate_uk_take_home', {'gross_salary': 45000, 'tax_year': '2026/27', 'region': 'england', 'pension_method': 'salary_sacrifice', 'pension_percent': 5, 'student_loan_plans': ['plan_2']},
    'I earn £45,000 in England, put 5% into my pension by salary sacrifice and repay a Plan 2 student loan. What is my take-home in 2026/27?'),
  faq=[('Why can my payslip differ?', 'Payroll works per pay period and the server works on annual figures, so a payslip can differ by a few pounds. The server says so in each answer.'),
       ('Does it cover Scotland?', 'Yes. Set the region to scotland, or use an S tax code, and it applies the six Scottish bands.')]))

P.append(dict(slug='calculate-aca-premium-tax-credit', repo='aca-premium-tax-credit-calculator-mcp',
  h1='Can Claude calculate my 2026 ACA premium tax credit?', title='Can Claude calculate the 2026 ACA premium tax credit?',
  query='can claude calculate aca subsidy',
  answer="Not safely from memory. The enhanced credits that ran from 2021 to 2025 expired, so for 2026 the 400% of poverty limit is back and the share of income you're expected to pay went up. A model trained before that change can apply the old rules and overstate the credit. Connect the free ACA Premium Tax Credit server and Claude uses the 2025 or 2026 poverty lines and applicable percentages, checks the subsidy cliff and works out the repayment cap.",
  native=['Explains the benchmark silver plan and how the credit is set.', 'Does the sum once you give it the expected contribution.'],
  needs=['The poverty line for your household size and state, including Alaska and Hawaii.', 'The 2026 applicable figure for your income, and the 400% cliff.', 'How much excess advance credit you may repay on Form 8962.'],
  example=call('aca', 'calculate_premium_tax_credit', {'household_income': 68000, 'household_size': 2, 'state': 'TX', 'benchmark_premium': 1150, 'year': 2026, 'premium_period': 'monthly'},
    'We are a household of 2 in Texas with $68,000 income. The benchmark silver plan is $1,150 a month. What is our 2026 premium tax credit?'),
  faq=[('Where do I find my benchmark premium?', 'HealthCare.gov or your state Marketplace shows the second lowest cost silver plan for your ZIP code and ages. After the year ends it is on Form 1095-A, column B.'),
       ('Is the estimate official?', 'No. The Marketplace and Form 8962 decide the official amounts. The server gives the same math with the published figures.')]))

P.append(dict(slug='calculate-recipe-nutrition', repo='recipe-nutrition-calculator-mcp',
  h1='Can Claude calculate calories and nutrition for a recipe?', title='Can Claude calculate calories for a recipe? USDA data',
  query='can claude calculate recipe nutrition',
  answer="It estimates, and the estimate can be off. Claude has a rough idea of the calories in common foods, but it doesn't look each ingredient up, and adding a dozen remembered values per serving lets small errors stack. Connect the free Recipe Nutrition Calculator server and Claude matches every ingredient line to a USDA FoodData Central food, totals calories, fat, carbs, protein, fiber and sodium, divides by servings and rounds the way an FDA label does.",
  native=['Reads a recipe and lists the ingredients and amounts.', 'Gives ballpark calories for familiar foods.'],
  needs=['A USDA FoodData Central match for each ingredient line, with grams.', 'Totals and per serving values for calories and the main nutrients.', 'FDA label rounding, and nutrition for a scaled recipe.'],
  example=call('recipe', 'calculate_recipe_nutrition', {'lines': ['2 cups all-purpose flour', '1/2 cup butter', '1 cup sugar', '2 large eggs', '1 cup milk', '2 tsp baking powder'], 'servings': 12},
    'This cake makes 12 slices: 2 cups flour, 1/2 cup butter, 1 cup sugar, 2 large eggs, 1 cup milk, 2 tsp baking powder. How many calories per slice?'),
  faq=[('Does it count cooking losses?', 'No. Values are for the raw ingredients as listed. Water lost in baking or fat left in the pan is not modeled, and the answer says so.'),
       ('Can I use it for a food label?', 'It applies FDA rounding rules, but a label you sell under may need lab testing or a dietitian review. Treat it as a well-sourced estimate.')]))

P.append(dict(slug='look-up-ap-score-distributions', repo='ap-score-distributions-mcp',
  h1='Can Claude look up 2026 AP score distributions?', title='Can Claude look up 2026 AP score distributions?',
  query='can claude look up ap score distributions',
  answer="Not the 2026 ones from memory. College Board posts the score distributions each summer after the May exams, and most models were trained before the 2026 release, so Claude may quote an older year without saying so. Connect the free AP Score Distributions server and Claude reads the 2024, 2025 and 2026 figures for each exam, compares exams and estimates a percentile for a score.",
  native=['Explains how AP scores of 1 to 5 work and what colleges accept.', 'Recalls distributions from years before its training cutoff.'],
  needs=['The share of 5s, 4s, 3s, 2s and 1s for each exam in 2024, 2025 and 2026.', 'A ranking of exams by pass rate or share of 5s.', 'A percentile estimate for your score, and a score estimate from a practice test.'],
  example=call('ap', 'get_ap_score_distribution', {'exam': 'AP Calculus AB', 'year': 2026}, 'What were the AP Calculus AB score distributions in 2026?'),
  faq=[('Are student counts included for 2026?', 'Not yet. College Board posted whole-number percentages for 2026 and has not published the counts, means or standard deviations. The server says so.'),
       ('Which exams does it cover?', 'All AP exams in the College Board release. Ask it to list them, or use short names such as APUSH, Calc BC or APES.')]))

P.append(dict(slug='calculate-section-179-deduction', repo='section-179-deduction-calculator-mcp',
  h1='Can Claude calculate a Section 179 deduction?', title='Can Claude calculate a 2026 Section 179 deduction?',
  query='can claude calculate section 179',
  answer="Not with current limits from memory. The July 2025 tax law (P.L. 119-21) doubled the Section 179 limit and restored 100% bonus depreciation, and the 2026 figures are indexed for inflation, so a model trained earlier quotes the old numbers. Connect the free Section 179 Deduction server and Claude applies the limit and phase-out for the tax year you name, the business income cap, bonus depreciation by date and the vehicle limits.",
  native=['Explains Section 179, bonus depreciation and the business income limit.', 'Does the math once you give it the right limit.'],
  needs=['The Section 179 limit and phase-out threshold for each tax year.', 'Bonus depreciation by acquisition and in-service date.', 'Vehicle limits by gross vehicle weight, including the heavy SUV cap.'],
  example=call('s179', 'calculate_section_179', {'tax_year': 2026, 'total_section_179_property_cost': 180000, 'business_taxable_income': 250000},
    'We are buying $180,000 of equipment in 2026 and the business has $250,000 of taxable income. How much can we deduct under Section 179?'),
  faq=[('What is the 2026 Section 179 limit?', 'From the server: $2,560,000, reduced dollar for dollar once qualifying property tops $4,090,000.'),
       ('Can the deduction create a loss?', 'No. Section 179 is capped at business taxable income. Bonus depreciation has no such cap, which is why the server handles both.')]))

P.append(dict(slug='calculate-car-loan-interest-deduction', repo='car-loan-interest-deduction-calculator-mcp',
  h1='Can Claude calculate the car loan interest deduction?', title='Can Claude calculate the new car loan interest deduction?',
  query='can claude calculate car loan interest deduction',
  answer="Only if it knows the 2025 law, and many Claude versions don't, or know it only in outline. The deduction runs from 2025 to 2028, is capped at $10,000 a year, phases out above $100,000 of MAGI ($200,000 joint) and only covers new vehicles with US final assembly bought on a loan made after 2024. Connect the free Car Loan Interest Deduction server and Claude checks each rule and works out the deduction and the phase-out.",
  native=['Explains in general terms that some car loan interest became deductible.', 'Adds numbers you give it.'],
  needs=['The P.L. 119-21 rules: the cap, the MAGI phase-out and the vehicle tests.', 'A clear no when a used car, a lease or a business vehicle fails a test.', 'The 2025 and 2026 brackets, SALT cap and child tax credit for the rest of the return.'],
  example=call('carloan', 'calculate_car_loan_interest_deduction', {'filing_status': 'single', 'magi': 85000, 'tax_year': 2025, 'interest_paid': 2400, 'loan_origination_date': '2025-03-15', 'new_vehicle': True, 'us_final_assembly': True, 'personal_use': True},
    'I am single with $85,000 MAGI. I bought a new US-assembled car on a loan made in March 2025 and paid $2,400 interest in 2025. What can I deduct?'),
  faq=[('Do I have to itemize?', 'No. It is a deduction you can take with the standard deduction, on Schedule 1-A.'),
       ('How do I check final assembly?', 'The vehicle label on the window shows it, or the NHTSA VIN decoder. The server asks for it as a yes or no.')]))

P.append(dict(slug='find-subdomains', repo='subdomain-finder-mcp',
  h1='Can Claude find the subdomains of a website?', title='Can Claude find subdomains of a domain? From CT logs',
  query='can claude find subdomains',
  answer="Not on its own. Claude can't send DNS queries or read certificate transparency logs, and web search only shows hosts that someone happened to link to. Connect the free Subdomain Finder server and Claude reads public certificate transparency logs (Cert Spotter, then crt.sh) for the domain, lists the hostnames with first and last seen dates, flags wildcard certificates and can resolve the names over DNS. Use it on domains you own or are allowed to test.",
  native=['Explains certificate transparency, DNS and what a subdomain is.', 'Suggests common names such as www, mail and api to check by hand.'],
  needs=['Every hostname that appeared on a public TLS certificate for the domain.', 'Wildcard entries, which hide individual hosts.', 'DNS resolution and a short attack surface summary.'],
  example=call('subd', 'find_subdomains', {'domain': 'zovo.one', 'limit': 20}, 'Which subdomains of zovo.one show up in certificate logs?', sentences=4,
    note='zovo.one is our own domain. The full answer lists each hostname with its dates and certificate issuer.'),
  faq=[('Does it scan or brute force anything?', 'No. It reads public certificate transparency logs and, if you ask, resolves names over DNS. It does not probe ports or guess names.'),
       ('Why are some hosts missing?', 'A host behind a wildcard certificate never appears by name in the logs, and certspotter lists unexpired certificates only. Use crt.sh with expired certificates for older names.')]))

P.append(dict(slug='calculate-ab-test-sample-size', repo='ab-test-sample-size-calculator-mcp',
  h1='Can Claude calculate A/B test sample size?', title='Can Claude calculate A/B test sample size and duration?',
  query='can claude calculate ab test sample size',
  answer="It knows the formula, but the exact number is easy to get wrong. Sample size depends on z-scores, pooled or unpooled variance and one or two sided tests, and online calculators don't agree on those choices, so a figure from memory can be off by thousands of users. Connect the free A/B Test Sample Size Calculator server and Claude gets the exact count per arm, says which method it used, and turns traffic into days to run the test.",
  native=['Explains power, significance and minimum detectable effect.', 'Gives a rough sample size for a common case.'],
  needs=['The exact sample size per arm for any baseline, lift, alpha, power and number of arms.', 'Test duration from daily traffic, rounded to full weeks.', 'Significance tests, Fisher exact test and the cost of peeking.'],
  example=call('ab', 'calculate_sample_size', {'baseline_rate': 0.04, 'mde': 0.1}, 'My checkout converts at 4%. How many users do I need to detect a 10% relative lift?'),
  example2=call('abdur', 'estimate_test_duration', {'daily_visitors': 3000, 'baseline_rate': 0.04, 'mde': 0.1}, 'We get 3,000 visitors a day into the test. How long will it take?', sentences=2),
  faq=[('Why does Evan Miller\'s calculator give a different number?', 'It uses the baseline variance in both terms. The server uses pooled variance under the null and unpooled under the alternative, and quotes both numbers so you can compare.'),
       ('Can I stop the test early if it looks significant?', 'Checking results again and again raises the false positive rate. The check_peeking_risk tool shows by how much.')]))

P.append(dict(slug='calculate-rap-student-loan-payment', repo='student-loan-repayment-assistance-plan-calculator-mcp',
  h1='Can Claude calculate a RAP student loan payment?', title='Can Claude calculate a RAP student loan payment?',
  query='can claude calculate rap student loan payment',
  answer="Not reliably. The Repayment Assistance Plan comes from the July 2025 law and opened on July 1, 2026, which is after many models were trained, so Claude may not know its income tiers, the $50 a month credit per dependent or the new Tiered Standard plan. Connect the free Student Loan RAP Calculator server and Claude works out the RAP payment, compares it with the standard plans and shows the loan limits and plan dates that apply to you.",
  native=['Explains income-driven repayment in general terms.', 'Compares plans once it has the monthly payments.'],
  needs=['The RAP payment from AGI and dependents, with the $10 minimum.', 'RAP against the Tiered Standard and 10-year Standard plans, monthly and in total.', 'Which plans close and when, and the new federal loan limits.'],
  example=call('rap', 'compare_rap_vs_standard', {'balance': 38000, 'rate': 6.5, 'agi': 52000, 'dependents': 1},
    'I owe $38,000 at 6.5%, my AGI is $52,000 and I have 1 dependent. What would I pay under RAP and under the standard plans?'),
  faq=[('Is this my official payment?', 'No. Your servicer sets it from your certified income and loan records. Check it with the StudentAid.gov Loan Simulator.'),
       ('Does RAP count for PSLF?', 'Yes. On-time RAP payments count toward Public Service Loan Forgiveness, and so do payments under the 10-year Standard plan. Tiered Standard payments do not (20 U.S.C. 1087e(m)(1)(A), as amended by P.L. 119-21 sec. 82004).')]))

P.append(dict(slug='tell-the-time-in-another-time-zone', repo='timezone', server_id='timezone',
  h1='Can Claude tell the time in another time zone?', title='Can Claude tell the time in another time zone?',
  query='can claude tell time',
  answer="Not by itself. Claude has no clock, so it doesn't know the current time unless the app passes it in, and some apps only pass the date. Time zone math also trips on daylight saving: the US and Europe change clocks on different dates, so for a few weeks a year the gap between New York and London is 4 hours, not 5. Connect the Timezone server (free token) and Claude reads the current time from the server and converts times with the IANA rules for the exact date.",
  native=['Knows the usual UTC offsets for major cities.', 'Explains daylight saving time and what EST and EDT mean.'],
  needs=['The current time in any city, from a real clock.', 'Conversions that apply daylight saving for the exact date.', 'Working hour overlap across cities, meeting slots and .ics invites.'],
  example=call('tznow', 'now', {'zones': ['Tokyo', 'London', 'New York']}, 'What time is it right now in Tokyo, London and New York?'),
  example2=call('tzconv', 'convert_time', {'time': '2027-03-17 09:00', 'from_zone': 'New York', 'to_zones': ['London', 'Berlin']}, 'A call is set for 9:00 New York time on March 17, 2027. What time is that in London and Berlin?',
    note='On March 17, 2027 New York is already on daylight time and London is not, so the gap is 4 hours.'),
  faq=[('Does Claude know today\'s date?', 'Many apps give Claude the date in the system prompt, but not always the exact time, and Claude can\'t check either one. The server reads the time when the tool runs.'),
       ('What is free on the hosted server?', 'Time conversion, overlap, daylight saving dates and business days are free. Meeting slots for more than 3 people, longer searches, more saved contacts and more .ics files are Pro.')]))

fx = a('fx')['result']
P.append(dict(slug='convert-currency-at-todays-rate', repo='currency', server_id='currency',
  h1="Can Claude convert currency at today's exchange rate?", title="Can Claude convert currency at today's rate? ECB rates",
  query='can claude convert currency',
  answer="Not from memory. Exchange rates change every day and Claude only knows rates from before its training cutoff, so any conversion it does alone uses an old rate. With web search on, Claude.ai can find a quote on a web page, but it may not say which date or source the rate is from. Connect the Currency server (free token) and Claude converts with the European Central Bank reference rate, names the rate date and rounds to the currency's minor units.",
  native=['Does the multiplication once it has a rate you trust.', 'Explains reference rates, cross rates and why banks charge a spread.'],
  needs=["The latest ECB reference rate for every currency the ECB quotes.", 'The rate date, so an invoice or expense report can cite it.', 'One amount in several currencies, and the rate on a past date within the last 90 days on the free tier.'],
  example=call('fx', 'convert', {'amount': 250, 'from': 'EUR', 'to': 'USD'}, 'Convert 250 euros to US dollars at today\'s rate.',
    result=jfields('fx', ['result', 'rate_meaning', 'rate_date', 'source']),
    note='The server answers in JSON. These are four of its fields, unchanged. The ECB publishes once per business day, around 16:00 CET, so the rate date can be the day before.'),
  faq=[('Is the ECB rate what my bank will charge?', 'No. The ECB reference rate is a mid-market rate for information. Banks and card networks add a spread or a fee.'),
       ('How far back does it go?', 'The free tier reads rates for the last 90 days. History back to January 1999 is in Pro.')]))

P.append(dict(slug='convert-raw-to-cooked-weight', repo='raw-to-cooked-weight-mcp',
  h1='Can Claude convert raw to cooked weight?', title='Can Claude convert raw to cooked meat weight? USDA yields',
  query='can claude convert raw to cooked weight',
  answer="Only roughly. Claude knows that meat loses water and fat as it cooks and often quotes a rule of thumb such as 25%, but the real loss depends on the cut, the fat level and the cooking method, and USDA measured it for each one. Connect the free Raw to Cooked Weight server and Claude uses the USDA cooking yield for that cut and method, with the range seen across USDA samples, in both directions.",
  native=['Explains why meat shrinks when it cooks.', 'Applies a percentage you give it.'],
  needs=['The USDA measured yield for each cut and cooking method, with its range.', 'Cooked weight from raw, and raw weight from a cooked portion for food logging.', 'How much raw meat to buy for a number of cooked servings.'],
  example=call('cooked', 'convert_raw_to_cooked', {'food': '80/20 ground beef patty', 'method': 'pan_broil', 'raw_weight': 1, 'unit': 'lb'}, 'How much does 1 lb of raw 80/20 ground beef weigh after I pan-broil it into patties?', sentences=1),
  example2=call('cooked2', 'convert_cooked_to_raw', {'food': 'chicken thigh', 'method': 'roast', 'cooked_weight': 150, 'unit': 'g'}, 'I ate 150 g of roasted chicken thigh. What did it weigh raw?', sentences=2),
  faq=[('Why log raw weight?', 'Nutrition labels and most food databases list raw meat. Logging a cooked portion against raw values undercounts, so the server converts the cooked portion back to raw.'),
       ('Does it cover fish or rice?', 'No. The USDA table covers meat and poultry only, so the server refuses fish, seafood, duck, rice and pasta and says why.')]))

P.append(dict(slug='calculate-vegetable-yield', repo='vegetable-yield-percentage-mcp',
  h1='Can Claude calculate vegetable yield after peeling and trimming?', title='Can Claude calculate vegetable yield? USDA trim data',
  query='can claude calculate vegetable yield',
  answer="It guesses. Claude knows that peel, seeds and cores are thrown away, but it doesn't have the edible share for each vegetable to hand, so it estimates, and the estimate changes from one answer to the next. Connect the free Vegetable Yield Percentage server and Claude uses the USDA edible yield for that vegetable or fruit to turn a purchased weight into edible weight, or a recipe amount into what to buy.",
  native=['Explains what trim waste is and why yield matters for costing.', 'Does the sum once you give it a yield percent.'],
  needs=['The USDA edible yield percent and what the refuse is, for 305 raw vegetables and fruits.', 'Edible weight and waste from a weight as bought.', 'How much to buy for cups chopped, a weight or a number of whole items.'],
  example=call('veg', 'calculate_edible_weight', {'food': 'butternut squash', 'purchased_weight': 3, 'unit': 'lb'}, 'I bought a 3 lb butternut squash. How much will I have after peeling and seeding it?'),
  example2=call('veg2', 'calculate_amount_to_buy', {'food': 'onion', 'amount': 3, 'measure': 'cup chopped'}, 'My recipe needs 3 cups of chopped onion. How much do I buy?'),
  faq=[('How old is the USDA data?', 'The refuse values come from USDA Standard Reference, Release 28 (2015). They are averages, so a single squash or onion can differ.'),
       ('Does it cover herbs and nuts?', 'No. Herbs such as parsley and basil, nuts and coconut are not in its data. It answers for raw vegetables and fruits.')]))

assert len(P) == 16 and len({p['slug'] for p in P}) == 16
out = sys.argv[1]
doc = json.load(open(out))
new = {p['slug'] for p in P}
doc['pages'] = [p for p in doc['pages'] if p['slug'] not in new] + [{**p, 'faq': [{'q': q, 'a': x} for q, x in p['faq']]} for p in P]
doc['_readme'] = [r for r in doc['_readme'] if 'canclaude2' not in r] + ['s1103 canclaude2: 16 more pages (generator ~/mcp-servers/data/s1103/canclaude2/make_can_claude_live2.py, calls in canclaude2/calls/). Entries with server_id use a catalog server on mcp.zovo.one (free token).']
json.dump(doc, open(out, 'w'), indent=1, ensure_ascii=False)
open(out, 'a').write('\n')
for p in P: print(p['slug'], len(p['title']), p['example']['result'][:100])
print('total pages', len(doc['pages']))
