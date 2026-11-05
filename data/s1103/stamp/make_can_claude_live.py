#!/usr/bin/env python3
"""s1103 stamp: build data/content/can-claude-live.json for /can-claude/<slug>/ pages backed by a free live-data server.
Every example is a real tools/call against the hosted Worker (raw responses in data/s1103/stamp/calls/<name>.json).
usage: make_can_claude_live.py <out.json>"""
import json, re, sys, pathlib
CALLS = pathlib.Path('/Users/mike/mcp-servers/data/s1103/stamp/calls')

def summary(name, sentences=None):
    t = json.load(open(CALLS / f'{name}.json'))['result']['content'][0]['text']
    s = re.split(r'\s\{\s*\n|\n\n\{', t, 1)[0].strip()
    s = s.split('\n\n')[0].strip()
    if sentences:
        parts = re.split(r'(?<=[.!?])\s+(?=[A-Z$0-9])', s)
        s = ' '.join(parts[:sentences])
    return s

def call(name, tool, args, prompt, sentences=None, note=''):
    r = json.load(open(CALLS / f'{name}.json'))['result']
    return {'prompt': prompt, 'tool': tool, 'args': args, 'result': summary(name, sentences), 'note': note,
            'is_error': bool(r.get('isError')), 'run': '2026-11-03'}

P = []
P.append(dict(slug='check-gold-price', repo='gold-price-per-gram-mcp',
  h1='Can Claude check the current gold price?', title='Can Claude check the gold price today? Live per gram',
  query='can claude check gold price',
  answer="Not from memory. Claude's training data ends at a cutoff date, and the gold price changes every minute, so any number it recalls is old. With web search on, Claude.ai can find a price quoted on a news or dealer page, but that quote may be delayed and Claude still has to do the karat and gram math itself. Connect the free Gold Price per Gram server and Claude reads the spot price from a live feed at the moment you ask, then works out price per gram by karat, in about 160 currencies.",
  native=['Explains karats, troy ounces and melt value correctly.', 'Does the arithmetic once it has a price you give it.', 'With web search on, finds a quoted price on a web page.'],
  needs=['The spot price right now, from a live feed, with a timestamp.', 'Price per gram for 10K to 24K and silver, platinum and palladium.', 'Melt value of a ring or chain from its weight, with a dealer spread.'],
  example=call('gold', 'calculate_jewelry_value', {'weight': 6.2, 'unit': 'g', 'karat': 18, 'currency': 'USD', 'dealer_spread_percent': 15},
    'I have an 18K gold ring that weighs 6.2 g. What is it worth today, and what would a shop that keeps 15% offer?'),
  faq=[('Is the gold price from the server real time?', 'It reads the spot price from gold-api.com when the tool runs and returns the timestamp with the answer. Currency conversion uses central-bank rates from Frankfurter.'),
       ('Is melt value what a shop will pay?', 'No. Buyers pay below melt to cover refining and margin, and shops sell jewellery above it. The tool lets you set the dealer spread so you can compare offers.')]))
P.append(dict(slug='check-lake-levels', repo='lake-level-mcp',
  h1='Can Claude check lake levels?', title='Can Claude check lake levels? Live gauge readings',
  query='can claude check lake levels',
  answer="Not on its own. Claude knows what a full pool is and roughly where big reservoirs sat in past years, but not today's reading. Lake levels move every hour, and the numbers sit in USGS, Army Corps, CDEC, Reclamation and Texas Water Development Board gauges that Claude does not read by default. Connect the free Lake Level server and Claude gets the current elevation from the government gauge, the distance below full pool and the change over 24 hours, 7 days and 30 days.",
  native=['Explains full pool, conservation pool and why a lake drops in summer.', 'Plans a trip around a level you give it.'],
  needs=['The current gauge reading for 44 US lakes and reservoirs in 12 states.', 'Change over 24 hours, 7 days and 30 days, and feet below full pool.', 'Up to 365 days of daily or weekly history from the same gauge.'],
  example=call('lake', 'get_lake_level', {'lake': 'Lake Travis'}, 'Is Lake Travis up or down this week, and how far below full is it?'),
  faq=[('Which lakes does it cover?', '44 US lakes and reservoirs in 12 states, including Lake Travis, Lake Mead, Lake Powell, Lake Lanier, Lake Texoma and Kentucky Lake. Ask it to search by name or state.'),
       ('Where do the numbers come from?', 'USGS, USACE CWMS, CDEC, Reclamation RISE and TWDB gauges, read at call time. Each answer names the gauge and links to its data page.')]))
P.append(dict(slug='look-up-minimum-wage', repo='minimum-wage-mcp',
  h1='Can Claude look up the current minimum wage?', title='Can Claude look up the minimum wage for 2026 and 2027?',
  query='can claude look up minimum wage',
  answer="Partly. Claude knows the federal $7.25 rate and many state rates up to its training cutoff, but states raise their rates every January, and some mid-year, so the number it remembers can be a year out of date. It also mixes up tipped cash wages. Connect the free Minimum Wage server and Claude reads the state rate in force on any date in 2026 or 2027, with the tipped wage, the tip credit and the next scheduled increase.",
  native=['Knows the federal minimum wage and how tip credits work.', 'Works out yearly pay once it has an hourly rate.'],
  needs=['The rate in force in all 50 states and DC on a date you choose in 2026 or 2027.', 'Increases already set for 2026 and January 1, 2027.', 'Tipped cash wage and tip credit for each state.'],
  example=call('minwage', 'compare_states', {'states': ['FL', 'MI', 'OH'], 'date': '2027-01-01'}, 'Compare the minimum wage in Florida, Michigan and Ohio on January 1, 2027.'),
  faq=[('Does it include city minimum wages?', 'No. It returns state rates only. Cities and counties such as Seattle, Denver, Chicago and San Francisco can set higher rates, and the answer says so.'),
       ('How current is the data?', 'US Department of Labor state tables from July 2026, checked against state labor department pages in October 2026, with the source link for each state.')]))
P.append(dict(slug='calculate-no-tax-on-overtime', repo='no-tax-on-overtime-mcp',
  h1='Can Claude calculate the no tax on overtime deduction?', title='Can Claude calculate no tax on overtime? Schedule 1-A',
  query='can claude calculate no tax on overtime',
  answer="Only if its training includes the July 2025 law, and many Claude versions were trained before it or know it only in outline. The deduction has a $12,500 cap ($25,000 joint), a MAGI phase-out from $150,000 and a rule that only the half-time premium counts, which is easy to get wrong in a long answer. Connect the free No Tax on Overtime server and Claude works out the qualified overtime, the cap and the phase-out the way Schedule 1-A does, for 2025 to 2028.",
  native=['Explains in general terms what the overtime deduction is.', 'Does simple sums when you give it the qualified amount.'],
  needs=['The P.L. 119-21 rules: caps, MAGI phase-outs and the FLSA premium rule.', 'Tips and senior deductions with the same rules.', 'The 2025 and 2026 IRS brackets to estimate the tax you save.'],
  example=call('ot', 'calculate_overtime_deduction', {'filing_status': 'single', 'magi': 68000, 'tax_year': 2025, 'hourly_rate': 24, 'overtime_hours': 300, 'multiplier': 1.5},
    'I am single, MAGI $68,000. I worked 300 overtime hours in 2025 at $24 an hour, time and a half. What is my overtime deduction?'),
  faq=[('Does the whole overtime check count?', 'No. Only the premium part counts, the extra half in time and a half. In the example, $10,800 of overtime pay gives a $3,600 deduction.'),
       ('Does it lower Social Security and Medicare tax?', 'No. It lowers federal income tax only. Payroll taxes still apply to overtime pay.')]))
P.append(dict(slug='adjust-for-inflation', repo='cpi-inflation-calculator-mcp',
  h1='Can Claude adjust a price for inflation?', title='Can Claude adjust for inflation? Official CPI data',
  query='can claude calculate inflation',
  answer="It can do the formula, but it does not know the latest CPI. The Bureau of Labor Statistics publishes a new index every month, and Claude only knows the months before its training cutoff, so an inflation-adjusted figure it gives from memory is stale or guessed. Connect the free CPI Inflation Calculator server and Claude uses official BLS CPI-U, CPI-W and core CPI values from 1913 to the latest month, then gives the exact adjusted amount and the yearly rate.",
  native=['Knows the inflation formula: amount times new CPI over old CPI.', 'Explains the difference between CPI-U, CPI-W and core CPI.'],
  needs=['Official monthly and yearly CPI values, 1913 to the latest release.', 'Whether a raise beat inflation over the same months.', 'The Social Security COLA for a given year.'],
  example=call('cpi', 'calculate_inflation', {'amount': 50000, 'from': '2015-01', 'to': 'latest'}, 'What is $50,000 from January 2015 worth now, in buying power?', sentences=2,
    note='On this run the live BLS check hit its daily request limit, so the server used its bundled BLS data through September 2026 and said so in the answer.'),
  faq=[('Which CPI does it use?', 'CPI-U, all items, US city average, not seasonally adjusted, unless you ask for CPI-W or core CPI.'),
       ('What if the newest month is missing?', 'The answer names the latest month it used. When the live BLS API is not reachable it falls back to bundled data and says so.')]))
P.append(dict(slug='look-up-per-diem-rates', repo='irs-mileage-rate-per-diem-mcp',
  h1='Can Claude look up GSA per diem rates?', title='Can Claude look up GSA per diem rates for a trip?',
  query='can claude look up per diem rates',
  answer="Not reliably from memory. GSA sets lodging and meals rates for hundreds of US areas each fiscal year, many change by month, and the new year starts every October 1, so the rate Claude remembers is often last year's. Connect the free IRS Mileage Rate and Per Diem server and Claude reads the FY2026 and FY2027 GSA rates by city or ZIP code, then totals a trip with the 75% first and last day rule.",
  native=['Explains what per diem covers and how the 75% travel day rule works.', 'Adds up a trip once it has the daily rates.'],
  needs=['GSA lodging and M&IE rates by city, county or ZIP for FY2026 and FY2027.', 'Monthly lodging seasons for areas that have them.', 'The IRS high-low rates and a deduction for meals already provided.'],
  example=call('perdiem', 'calculate_trip_per_diem', {'city': 'Chicago', 'state': 'IL', 'start_date': '2026-11-16', 'end_date': '2026-11-19'}, 'What is the federal per diem for a 4-day trip to Chicago from November 16 to 19, 2026?'),
  faq=[('Does it cover trips abroad?', 'No. It covers the continental US (CONUS) GSA rates only.'),
       ('Can my employer pay up to these rates tax free?', 'Under Rev. Proc. 2019-48 an allowance up to the federal rate counts as substantiated, but you still need records of time, place and business purpose.')]))
P.append(dict(slug='calculate-mileage-deduction', repo='irs-mileage-rate-per-diem-mcp',
  h1='Can Claude calculate a 2026 mileage deduction?', title='Can Claude calculate a 2026 mileage deduction?',
  query='can claude calculate mileage deduction',
  answer="It can multiply, but it may use the wrong rate. 2026 has two IRS business rates, 72.5 cents a mile to June 30 and 76 cents from July 1, and the mid-year change came after most models were trained. Medical and charity miles use other rates. Connect the free IRS Mileage Rate and Per Diem server and Claude applies the right rate to each trip by date and purpose, with the IRS notice that sets it.",
  native=['Explains the standard mileage method and what records to keep.', 'Totals miles from a log you paste.'],
  needs=['The IRS rates for business, medical, charity and moving miles, by date.', 'The July 1, 2026 business rate change (Announcement 2026-11).', 'A line-by-line deduction with the source for each rate.'],
  example=call('mileage', 'calculate_mileage_deduction', {'trips': [{'date': '2026-03-10', 'miles': 1240, 'purpose': 'business'}, {'date': '2026-06-02', 'miles': 85, 'purpose': 'medical'}, {'date': '2026-07-15', 'miles': 40, 'purpose': 'charity'}]},
    'Work out my 2026 mileage deduction: 1,240 business miles in March, 85 medical miles in June and 40 charity miles in July.'),
  faq=[('What are the 2026 IRS mileage rates?', 'Business 72.5 cents to June 30, 2026 and 76 cents from July 1. Medical and moving 20.5 cents, then 23.5 cents from July 1. Charity 14 cents, set by law.'),
       ('Are the 2027 rates included?', 'Not yet. The IRS usually announces them in late December, and the server will be updated then.')]))
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
P.append(dict(slug='count-business-days', repo='us-federal-holidays-business-days-mcp',
  h1='Can Claude count business days?', title='Can Claude count business days between two dates?',
  query='can claude count business days',
  answer="It often gets them wrong. Counting business days means walking a calendar day by day, skipping weekends and the federal holidays, including observed days when a holiday falls on a weekend, and language models are weak at that kind of exact date walk over weeks or months. Connect the free US Federal Holidays and Business Days server and Claude gets an exact count from the OPM rules, 1971 to 2100, plus due dates that roll past weekends and holidays.",
  native=['Lists the federal holidays and explains observed-day rules.', 'Counts short spans correctly most of the time.'],
  needs=['An exact business-day count between any two dates.', 'Adding N business days, and rolling an invoice due date.', 'The Federal Reserve banking calendar as a second option.'],
  example=call('bdays', 'count_business_days', {'start_date': '2026-12-01', 'end_date': '2027-01-15'}, 'How many business days are there from December 1, 2026 to January 15, 2027?'),
  faq=[('Does it know state holidays?', 'No. It uses the federal and Federal Reserve calendars. You can pass extra closed dates, such as a company shutdown, and they are skipped too.'),
       ('What happens when a holiday falls on a Saturday?', 'Federal offices observe it on the Friday before. The Federal Reserve stays open that Friday, which is why the server has both calendars.')]))
P.append(dict(slug='look-up-401k-limits', repo='retirement-contribution-limits-2027-mcp',
  h1='Can Claude look up the 2027 401(k) limits?', title='Can Claude look up 2027 401(k) and IRA limits?',
  query='can claude look up 2027 401k limits',
  answer="Not yet, and no tool can: on November 3, 2026 the IRS had not announced the 2027 401(k) and IRA limits. Claude may still guess a 2027 number from past increases. Connect the free Retirement Contribution Limits server and Claude gets the published limits only. It says plainly when a year is not out, returns the 2026 figures with the age 60 to 63 super catch-up, and already has the 2027 HSA limits, which are published.",
  native=['Explains catch-up contributions and how 401(k) and IRA limits combine.', 'Recalls limits for years before its training cutoff.'],
  needs=['Published limits only, with a clear answer when a year is not announced.', 'Your maximum for 401(k), 403(b), 457(b), TSP, SIMPLE, IRA and HSA by age.', 'The 2027 HSA limits, already set by the IRS.'],
  example=call('k401_2026', 'calculate_max_contribution', {'age': 61, 'year': 2026, 'plans': ['401k', 'ira']}, 'I am 61. What is the most I can put in my 401(k) and IRA for 2026?'),
  example2=call('k401', 'calculate_max_contribution', {'age': 61, 'year': 2027, 'plans': ['401k', 'ira', 'hsa_self']}, 'Same question for 2027.'),
  faq=[('When will the 2027 limits come out?', 'The 2026 limits were announced in November 2025 (IR-2025-111, Notice 2025-67). The 2027 notice is expected on a similar schedule. The server adds the figures once the IRS publishes them.'),
       ('What are the 2027 HSA limits?', 'From the server: $4,500 for self-only coverage and $9,000 for family coverage, plus $1,000 at age 55 and over.')]))

P.append(dict(slug='check-silver-price', repo='silver-price-per-gram-mcp',
  h1='Can Claude check the current silver price?', title='Can Claude check the silver price today? Live per gram',
  query='can claude check silver price',
  answer="Not from memory. Claude's training data stops at a cutoff, and silver trades every minute, so a price it recalls is out of date. With web search on, Claude.ai can find a quote on a web page, but it may be delayed and the fineness and coin math is left to Claude. Connect the free Silver Price per Gram server and Claude reads the spot price live, then gives price per gram for .999, sterling and coin silver, and the melt value of pre-1965 US coins.",
  native=['Explains sterling, coin silver and what junk silver means.', 'Does the arithmetic once it has a price you give it.', 'With web search on, finds a quoted price on a web page.'],
  needs=['The silver spot price right now, with a timestamp, in about 160 currencies.', 'Price per gram for .999, .9584, .925, .900 and 800 silver.', 'Melt value of 90% US coins from face value, and the gold to silver ratio.'],
  example=call('silver', 'calculate_junk_silver_value', {'face_value_90': 5, 'currency': 'USD', 'dealer_spread_percent': 10}, 'I have $5 face value of pre-1965 dimes and quarters. What is the silver worth today, and what would a dealer at 10% under melt pay?', sentences=4),
  faq=[('Where does the price come from?', 'The gold-api.com silver spot feed, read when the tool runs, with central-bank FX rates from Frankfurter for other currencies.'),
       ('Is melt value what a coin is worth?', 'Not always. Dealers buy below melt and sell above it, and rare or collectible coins can be worth far more than their silver.')]))
P.append(dict(slug='check-river-levels', repo='river-level-mcp',
  h1='Can Claude check river levels?', title='Can Claude check river levels and flood stage?',
  query='can claude check river levels',
  answer="Not on its own. Claude can explain river stage, discharge and flood categories, but the reading at a gauge changes by the hour and lives in USGS and National Weather Service data that Claude does not read by default. Connect the free River Level server and Claude gets the current stage and flow at any active USGS stream gauge, how far the river is from flood stage, and the NWS forecast where one exists.",
  native=['Explains stage, discharge and the NWS flood categories.', 'Reads a number you paste from a gauge page.'],
  needs=['Current stage and streamflow at any active USGS gauge, found by name, state or location.', 'Distance to NWS flood stage and forecast crests.', 'Daily history for 2 to 366 days.'],
  example=call('river', 'get_river_level', {'site': '07010000'}, 'What is the Mississippi River at St. Louis doing right now, and how far is it from flood stage?', sentences=3,
    note='The server found the gauge number first with find_river_gauges ("Mississippi River St. Louis", MO), then read it.'),
  faq=[('Is the data official?', 'Yes. It comes from USGS stream gauges and the NOAA National Water Prediction Service. USGS real-time values are provisional and can be revised.'),
       ('Does it cover lakes too?', 'Lakes and reservoirs are in the separate Lake Level server, which reads reservoir elevation and full pool.')]))
P.append(dict(slug='look-up-sat-percentiles', repo='sat-score-percentiles-mcp',
  h1='Can Claude tell me my SAT percentile?', title='Can Claude tell me my SAT percentile? Class of 2026',
  query='can claude tell me sat percentile',
  answer="Roughly, from an older year. Claude has seen College Board percentile tables up to its training cutoff, but the tables are updated each year, and the class of 2026 report came out in fall 2026. From memory it may also mix up the user group and nationally representative percentiles. Connect the free SAT Score Percentiles server and Claude reads both percentiles from the College Board tables, plus the class of 2026 mean and state averages.",
  native=['Explains what a percentile means and how SAT sections combine.', 'Gives an approximate percentile from older tables.'],
  needs=['User group and nationally representative percentiles for total, Math and Reading and Writing.', 'The class of 2026 mean, score bands and test-taker counts.', 'Average scores and participation by state.'],
  example=call('sat', 'get_sat_percentile', {'score': 1350, 'section': 'total'}, 'What percentile is a 1350 on the SAT?'),
  faq=[('What is the difference between the two percentiles?', 'The user group percentile compares you with recent SAT takers. The nationally representative one compares you with all US 11th and 12th graders, including students who do not take the SAT, so it is higher.'),
       ('Is this live data?', 'It is static data from the College Board class of 2026 report. It will be rebuilt when the class of 2027 report comes out.')]))
P = [p for p in P if p['slug'] != 'calculate-take-home-pay']

doc = {'_readme': ['s1103 stamp: /can-claude/<slug>/ pages backed by one free live-data server (data/content/free-servers.json).',
                   'answer = first paragraph, an honest yes/no/partly about what Claude does without a tool. example = a real tools/call result.',
                   'Generator: ~/mcp-servers/data/s1103/stamp/make_can_claude_live.py. Raw call responses: ~/mcp-servers/data/s1103/stamp/calls/.'],
       'pages': [{**p, 'faq': [{'q': q, 'a': a} for q, a in p['faq']]} for p in P]}
json.dump(doc, open(sys.argv[1], 'w'), indent=1, ensure_ascii=False)
open(sys.argv[1], 'a').write('\n')
for p in P: print(p['slug'], len(p['title']), p['example']['result'][:90])
