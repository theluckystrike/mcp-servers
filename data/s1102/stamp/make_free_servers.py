#!/usr/bin/env python3
"""One-time generator for data/content/free-servers.json (s1102 stamp lane).
Hand-written fields below + live tools/list results in live/<repo>.tools.json.
Later additions: append an object to the "servers" array of the JSON file directly
(or run site/scripts/free-server-tools.mjs to fill "tools" from the live URL)."""
import json, sys, pathlib

HERE = pathlib.Path(__file__).parent
OUT = pathlib.Path(sys.argv[1])
S1030 = pathlib.Path('/Users/mike/mcp-servers/data/s1030')
CHECKED = '2026-11-02'

H = {
 'lake-level-mcp': dict(
  topic='Lake level', name='Lake Level',
  tagline='Live US lake and reservoir levels, read from the government gauge at call time.',
  knows=['The water level of 44 US lakes and reservoirs in 12 states, read now. A model only knows old levels.',
         'The change over 24 hours, 7 days and 30 days, and the distance below full pool.',
         'A daily history for up to 365 days, from the same gauge.'],
  sources='USGS, USACE CWMS, CDEC, Reclamation RISE and TWDB gauges. No key.',
  money=('LakeLevelNow', 'https://lakelevelnow.com'),
  prompts=['Is Lake Travis high enough this weekend? How much has it moved in the last 7 days?',
           "Give me Lake Mead's weekly level for the last 365 days with the low and the high.",
           'Compare Lake Lanier, Lake Texoma and Kentucky Lake. Which is furthest below full pool?']),
 'no-tax-on-overtime-mcp': dict(
  topic='No tax on overtime', name='No Tax on Overtime',
  tagline='The 2025-2028 overtime, tips and senior deductions, worked out the way Schedule 1-A does.',
  knows=['The One Big Beautiful Bill Act deductions (P.L. 119-21), passed in July 2025. Many models were trained before it.',
         'The caps ($12,500 overtime, $25,000 tips, $6,000 per senior) and the MAGI phase-outs.',
         'The 2025 and 2026 IRS bracket tables, to estimate the federal tax you save.'],
  sources='IRS Schedule 1-A, Form 1040 instructions, FS-2025-03, FS-2026-13, Rev. Proc. 2024-40 and 2025-32.',
  money=('NoOvertimeTax', 'https://noovertimetax.com'),
  prompts=['I worked 10 double-time hours at $20 an hour. How much of that is qualified overtime for the deduction?',
           'Married filing jointly, MAGI $142,000, W-2 box 12 TT $9,400, tips $6,000, one spouse is 67. Estimate 2025 federal tax saved.',
           'Do I qualify for no tax on tips if I file married filing separately?']),
 'minimum-wage-mcp': dict(
  topic='Minimum wage', name='Minimum Wage',
  tagline='US state minimum wages for 2026 and 2027, with tipped cash wages and scheduled increases.',
  knows=['The minimum wage in all 50 states and DC on any date in 2026 or 2027.',
         'Increases set for 2026 and January 1, 2027, many announced after model training ended.',
         'The tipped cash wage and the tip credit for each state.'],
  sources='US DOL state tables (July 2026), checked against state labor department pages in October 2026.',
  money=('StateWage', 'https://statewage.com'),
  prompts=["What's the Florida minimum wage and tipped wage now, and what changes on September 30, 2026?",
           'Compare the minimum wage in Michigan, Ohio and Indiana on January 1, 2027, and full-time annual pay at each.',
           "What does a 30-hour-a-week worker earn in a year at Georgia's minimum wage, 50 weeks?"]),
 'dscr-loan-calculator-mcp': dict(
  topic='DSCR loan calculator', name='DSCR Loan Calculator',
  tagline='Cent-exact DSCR, largest loan and rent needed for a rental property loan.',
  knows=['The exact payment to the cent, with the annuity formula. A model doing this in its head often drifts.',
         'The lender bands: 1.25 and up, 1.00 to 1.24, 0.75 to 0.99, under 0.75.',
         'The largest loan for a target DSCR and the rent you need, solved, not guessed.'],
  sources='Fannie Mae Selling Guide (PITIA) and published DSCR lender guides.',
  money=('DSCR Radar', 'https://dscrradar.com'),
  prompts=["A duplex rents for $2,600 a month. Loan $300,000 at 7.25% for 30 years, taxes $400 and insurance $120 a month. What's the DSCR?",
           "Same duplex. What's the largest loan at 7.25%, 30 years that keeps DSCR at 1.25? And what rent would I need at $300,000?",
           'Compare 7.25% fixed, 6.8% fixed and 7.25% interest-only for 10 years on a $300,000 loan, rent $2,600, costs $520 a month.']),
 'paycheck-calculator-mcp': dict(
  topic='Paycheck calculator', name='Paycheck Calculator',
  tagline='US take-home pay for 2025 and 2026, federal and all 50 states plus DC.',
  knows=['The 2026 IRS bracket tables and the mid-2025 standard deduction change ($15,750 single for 2025).',
         'Social Security, Medicare and the extra Medicare tax, per paycheck.',
         'Exact 2026 state schedules for CA, NY, NJ, IL, PA, GA and NC. Other states are labeled as estimates.'],
  sources='IRS Rev. Proc. 2024-40 and 2025-32, IRS Publication 15, and state tax agency tables.',
  money=('StateWage', 'https://statewage.com'),
  prompts=["I got an offer of $92,000 a year, paid biweekly, single, in North Carolina, with 6% to a 401(k). What's my take-home per check in 2026?",
           'Same $110,000 salary: compare take-home in Washington, California, New York and Texas for 2026.',
           "I make $24.50 an hour, 40 hours plus 6 overtime hours a week at 1.5x. What's that a year, and what's $58,000 a year per hour?"]),
 'uk-income-tax-salary-mcp': dict(
  topic='UK income tax and salary', name='UK Income Tax and Salary',
  tagline='UK take-home pay for 2025/26 and 2026/27, Scottish bands and student loans included.',
  knows=["HMRC's 2026/27 rates, including the new Scottish bands. Many models stop at an older tax year.",
         'National Insurance, all student loan plans and pension relief, in one calculation.',
         'The real marginal rate, including the 60% trap between 100,000 and 125,140 GBP.'],
  sources='HMRC rates and thresholds for employers 2025/26 and 2026/27, and gov.uk tax pages.',
  money=('UK Money Calc', 'https://ukmoneycalc.com'),
  prompts=['I earn GBP 104,000 and may get GBP 112,000. How much of the rise do I keep, and what is my marginal rate?',
           'Salary GBP 48,000 in Scotland, 2026/27, Plan 2 student loan, 5% pension by salary sacrifice. What do I take home a month?',
           'Show the 2026/27 bands for England and Scotland, NI thresholds and student loan thresholds.']),
 'cups-to-grams-mcp': dict(
  topic='Cups to grams', name='Cups to Grams',
  tagline='Cups to grams by ingredient, from measured weights, not guessed densities.',
  knows=['Measured grams per cup for 271 ingredients, from USDA FoodData Central and the King Arthur chart.',
         'Which cup a recipe uses: US, metric, imperial, US legal or Japanese.',
         'Oven temperatures in F, C and gas mark, with the fan oven adjustment.'],
  sources='USDA FoodData Central, King Arthur Baking weight chart, NIST conversion factors.',
  money=('Ingredient Calculator', 'https://ingredientcalculator.com'),
  prompts=['Convert this US cookie recipe to grams: 2 1/4 cups all-purpose flour, 1 cup butter, 3/4 cup granulated sugar. Oven is 375 F, my oven is fan.',
           'My Australian recipe says 1 cup of flour. How many grams is that, and is it the same as a US cup?',
           'Scale this bread recipe from 12 servings to 6 and give grams for every line: 4 cups bread flour, 1 1/2 cups water, 2 tbsp honey.']),
 'gold-price-per-gram-mcp': dict(
  topic='Gold price per gram', name='Gold Price per Gram',
  tagline='Live gold price per gram by karat, in about 160 currencies.',
  knows=['The gold spot price right now. Prices change every minute, so a model cannot know them.',
         'Silver, platinum and palladium spot prices, with central-bank FX rates for about 160 currencies.',
         'Melt value of a ring or chain from its weight and karat, and units like tola, baht and tael.'],
  sources='gold-api.com spot feed and Frankfurter central-bank FX rates. No key.',
  money=('Gold Gram Price', 'https://goldgramprice.com'),
  prompts=["I have an 18K gold ring that weighs 6.2 g. What's it worth in PLN today? The shop takes about 15%.",
           "Give me today's 22K and 24K gold price per gram in GBP and EUR.",
           'A seller quotes 2 tola and a 1 baht chain. How many grams is that, and what are silver and platinum doing today in USD?']),
 'us-federal-holidays-business-days-mcp': dict(
  topic='US federal holidays and business days', name='US Federal Holidays and Business Days',
  tagline='Exact US federal holidays and business-day math, 1971 to 2100.',
  knows=['Observed-holiday rules: a Saturday holiday moves to Friday, a Sunday holiday to Monday.',
         'The Federal Reserve calendar, which stays open on the Friday before a Saturday holiday.',
         'Exact date math: add business days, count them, and roll an invoice due date.'],
  sources='OPM federal holiday rules, Federal Reserve holiday schedule, 5 U.S.C. 6103.',
  money=('Create an invoice in Claude', '/use-cases/create-invoice-in-claude/'),
  prompts=['Is Friday July 3, 2026 a business day for an ACH payment?',
           'Invoice dated November 27, 2026, Net 30. If the due date is a weekend or holiday, roll to the next business day.',
           "How many business days are there between December 1, 2026 and January 15, 2027? And what's 10 business days after December 18?"]),
}

ORDER = ['lake-level-mcp', 'gold-price-per-gram-mcp', 'minimum-wage-mcp', 'no-tax-on-overtime-mcp', 'paycheck-calculator-mcp',
         'uk-income-tax-salary-mcp', 'dscr-loan-calculator-mcp', 'us-federal-holidays-business-days-mcp', 'cups-to-grams-mcp']

servers = []
for repo in ORDER:
    s = json.load(open(S1030 / f'{repo}.json'))
    assert s.get('hosted_url'), repo
    h = H[repo]
    tools = json.load(open(HERE / 'live' / f'{repo}.tools.json'))['result']['tools']
    servers.append({
        'repo': repo,
        'topic': h['topic'],
        'name': h['name'],
        'tagline': h['tagline'],
        'knows': h['knows'],
        'sources': h['sources'],
        'hosted_url': s['hosted_url'],
        'repo_url': s['repo_url'],
        'npm': repo,
        'money_site': {'name': h['money'][0], 'url': h['money'][1]},
        'prompts': h['prompts'],
        'tools': [{'name': t['name'], 'title': t.get('title', ''), 'description': t.get('description', '')} for t in tools],
        'tools_checked': CHECKED,
        'added': CHECKED,
    })

doc = {
    '_readme': [
        'Free live-data MCP servers shown at /free-servers/ and on the home page. One object per server.',
        'To add a server: append an object to "servers" with the same fields. Required: repo, topic, name, tagline, hosted_url, repo_url.',
        'tools: paste the live tools/list result (name, title, description), or run `node scripts/free-server-tools.mjs <repo>` in site/.',
        'money_site.url: absolute URL gets UTM tags on the page; a path starting with / is an internal link.',
        'Page URL = /free-servers/<repo>/. H1 = "<topic> MCP server". Order in this file = order on the site.',
    ],
    'servers': servers,
}
OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n')
print(len(servers), 'servers,', sum(len(x['tools']) for x in servers), 'tools ->', OUT)
