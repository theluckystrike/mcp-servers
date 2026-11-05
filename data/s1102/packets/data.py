# Single source of truth for packets.json and packets.md
import json
TODAY = "2026-11-02"
HOST = "lipmichal.workers.dev"
GH = "https://github.com/theluckystrike"

CONN = {}

CONN["minimum-wage-mcp"] = dict(
 display="US State Minimum Wage",
 slug="us-state-minimum-wage",
 one_liner="Minimum wage, tipped cash wage and tip credit for all 50 states and DC in 2026 and 2027, including January 2027 increases that postdate most model training data.",
 description=(
  "US State Minimum Wage gives an assistant the state minimum wage on a chosen date in 2026 or 2027 for all 50 states and DC. "
  "It covers the standard hourly rate, the tipped cash wage, the tip credit and the date the rate took effect, and it applies the $7.25 federal floor where a state has no higher rate.\n\n"
  "Four tools. get_minimum_wage returns one state's rate on a date. list_upcoming_increases lists every scheduled change through 2027-12-31, sorted by date. "
  "compare_states lines up 2 to 10 states with full-time annual pay and the gap between the highest and lowest. annual_income_at_minimum_wage turns a state rate into weekly, monthly and annual gross pay.\n\n"
  "Figures come from the US Department of Labor state tables and state labor department notices, and each result carries a source link and an as_of date. "
  "Some 2027 rates are set by an inflation index and haven't been announced for Nebraska, Vermont, DC and Oregon, so the server reports them as not announced and never estimates them. "
  "Three 2027 figures (Arizona, Connecticut and Rhode Island) rest on the text of an official notice or statute plus a news report because the state pages couldn't be read, and the result flags that. "
  "City and county minimum wages aren't included and can be higher.\n\n"
  "No account or token is needed, and the server stores nothing about you. Results include a link to a related page on statewage.com, a reference site run by the same author."),
 use_cases="People ask what the minimum wage is in a named state on a named date, which states raise it next, how two or three states compare, or what a full-time worker earns at the minimum. Typical users are workers, small employers, payroll staff and journalists. Users need nothing before connecting. The connector only reads data.",
 categories_hint="Reference data, Finance or payroll (pick the closest two from the portal list)",
 prompts=[
  "What is the minimum wage in California on January 1, 2027, and is there a tip credit?",
  "Which states raise their minimum wage next, and by how much?",
  "Compare the minimum wage in Washington, Texas and Florida on 2027-01-01 and show full-time annual pay.",
 ],
 pos=[
  ("Rate on a future date","What is the minimum wage in California on January 1, 2027, and is there a tip credit?","get_minimum_wage","Returns $17.40 an hour in force since 2027-01-01 and states that no tip credit is allowed. Links the California Department of Finance notice as the source."),
  ("Upcoming increases","Which states raise their minimum wage next, and by how much?","list_upcoming_increases","Returns 19 scheduled changes through 2027-12-31, 15 with a published rate and 4 (NE, VT, DC, OR) marked not announced. The next published change is Arizona to $15.65 on 2027-01-01. Run on the 2026-11-02 test date."),
  ("Compare three states","Compare the minimum wage in Washington, Texas and Florida on 2027-01-01 and show full-time annual pay.","compare_states","Washington highest at $17.73, Texas lowest at $7.25, a gap of $10.48 an hour or $21,798.40 a year full time."),
  ("Annual income at minimum wage","How much does a full-time worker in Colorado earn in a year at the 2027 minimum wage?","annual_income_at_minimum_wage","Uses $15.71 an hour. Returns $32,676.80 a year, about $2,723.07 a month and $628.40 a week, before tax. Cites the Colorado Department of Labor press release."),
  ("Tipped wage","What is the tipped cash wage in Texas?","get_minimum_wage","Returns a $7.25 minimum, a tipped cash wage of $2.13 and a tip credit of $5.12, sourced to the US DOL state table."),
 ],
 neg=[
  ("City rate out of scope","What is the minimum wage in Seattle?","The tools cover states only and the server errors on a city name. The assistant should say city and county rates aren't covered, and may offer the Washington state rate with that caveat. It should not invent a Seattle figure."),
  ("Non-US jurisdiction","What is the minimum wage in Ontario, Canada?","The server only covers US states and DC and returns an unknown state error. The assistant should say it can't answer from this plugin and should not guess."),
  ("Legal filing request","My employer in Texas paid me $6 an hour. File a wage claim for me.","The plugin reads reference data and can't file or advise on claims. The assistant may state the Texas rate and suggest contacting the Department of Labor, and should not claim to have filed anything."),
 ],
 keywords=["minimum wage","tipped wage","payroll","state minimum wage 2027"],
 demo_note="Screen recording of the five positive prompts in ChatGPT with the plugin enabled, about 3 minutes.",
)

CONN["no-tax-on-overtime-mcp"] = dict(
 display="No Tax on Overtime",
 slug="no-tax-on-overtime",
 one_liner="Federal overtime, tips and senior deductions for 2025 to 2028 under the One Big Beautiful Bill Act, with caps and phase-outs taken from IRS forms and guidance.",
 description=(
  "No Tax on Overtime calculates the federal deductions for qualified overtime pay, qualified tips and seniors age 65 and older that the One Big Beautiful Bill Act (P.L. 119-21) created for tax years 2025 to 2028. "
  "The rules are recent and IRS guidance kept changing through 2026, so a model's training data can be missing or wrong on the details.\n\n"
  "Five tools. calculate_overtime_deduction applies the $12,500 cap ($25,000 joint) and the income phase-out, and converts hourly rate, hours and multiplier into the half-time premium that actually qualifies. "
  "calculate_tips_deduction applies the $25,000 per return cap. calculate_senior_deduction applies the $6,000 per person amount and the 6 percent reduction above $75,000 ($150,000 joint). "
  "estimate_tax_savings runs the three deductions through the IRS brackets before and after. explain_eligibility explains who qualifies, who doesn't (married filing separately) and which form boxes report the amounts.\n\n"
  "Amounts are copied from IRS Schedule 1-A, the Form 1040 instructions, Rev. Proc. 2024-40, Rev. Proc. 2025-32 and fact sheet FS-2026-13, and each result links to the IRS source. "
  "2027 and 2028 bracket tables aren't published yet, so those years use the 2026 tables and the result says so. Every result carries a disclaimer that it is an estimate and not tax advice. "
  "The server doesn't file anything, stores nothing and needs no account or token. Results include a link to a related page on noovertimetax.com, a reference site run by the same author."),
 use_cases="People ask how much of their overtime, tips or senior income is deductible, how the income phase-out changes the amount, who qualifies, and roughly how much federal tax the deductions save. Typical users are hourly workers, tipped workers, retirees, payroll staff and tax preparers. Users need nothing before connecting. The connector only reads data and runs calculations.",
 categories_hint="Finance or tax, Reference data (pick the closest two from the portal list)",
 prompts=[
  "I had $6,000 of qualified overtime premium, my MAGI was $90,000 and I file single. What is my 2025 overtime deduction?",
  "My spouse and I are both over 65, file jointly and have $160,000 MAGI. What is our 2025 senior deduction?",
  "Single filer, 2026, taxable income $55,000 before the new deductions, MAGI $70,000, $30 an hour with 200 overtime hours. How much federal tax do I save?",
 ],
 pos=[
  ("Overtime under the threshold","I had $6,000 of qualified overtime premium, my MAGI was $90,000 and I file single. What is my 2025 overtime deduction?","calculate_overtime_deduction","Deduction is $6,000. No phase-out because MAGI is under $150,000. Includes the estimate disclaimer and IRS Schedule 1-A source link."),
  ("Overtime with phase-out","Same overtime but my MAGI was $160,000. What is the 2025 deduction?","calculate_overtime_deduction","Phase-out removes $1,000 ($100 per full $1,000 over $150,000). Deduction is $5,000."),
  ("Tips deduction","I earned $9,000 in tips, MAGI $80,000, single, tax year 2025. What can I deduct?","calculate_tips_deduction","Deduction is $9,000. No phase-out and under the $25,000 cap."),
  ("Senior deduction, joint","We file jointly, both over 65, MAGI $160,000, tax year 2025. What is our senior deduction?","calculate_senior_deduction","Two qualifying people, each $6,000 reduced by $600 to $5,400. Deduction is $10,800."),
  ("Eligibility rules","Who can claim the no tax on tips deduction, and does married filing separately qualify?","explain_eligibility","Explains that married filing separately cannot claim any of the deductions, each person needs an SSN valid for employment, and from 2026 overtime must be reported on Form W-2 box 12 code TT (tips code TP). Links the IRS sources."),
 ],
 neg=[
  ("Filing request","File my Schedule 1-A and submit my tax return.","The plugin only calculates estimates and can't file anything. The assistant should say so and point to the IRS instructions or a tax preparer."),
  ("Other country","What is the income tax on a 50,000 pound salary in the UK?","This plugin covers US federal deductions only. The assistant should say it is out of scope and should not call these tools."),
  ("Restricted identifier","Check if I qualify. My SSN is 123-45-6789.","The tools never ask for an SSN. The assistant should not pass the number to the plugin and should explain that only filing status, MAGI and amounts are needed."),
 ],
 keywords=["overtime","tips","senior deduction","One Big Beautiful Bill Act","tax"],
 demo_note="Screen recording of the five positive prompts in ChatGPT with the plugin enabled, about 3 minutes.",
)

CONN["lake-level-mcp"] = dict(
 display="Lake Level Now",
 slug="lake-level-now",
 one_liner="Current level, recent change and distance below full pool for 44 US lakes and reservoirs, read live from USGS, Reclamation, USACE, CDEC and TWDB gauges.",
 description=(
  "Lake Level Now answers questions about the water level of 44 US lakes and reservoirs, including Lake Mead, Lake Powell, Lake Travis, Shasta, Oroville and Lake Lanier. "
  "It reads the government gauge at the moment you ask, so the answer is a current reading and not something remembered from training data.\n\n"
  "Four tools. search_lakes finds a lake by name, river or state. get_lake_level returns the current elevation in feet, the 24 hour, 7 day and 30 day change, the distance below full pool and, where the agency publishes storage, the percent full. "
  "get_lake_history returns a daily or weekly series for up to 365 days with the low, high and mean. compare_lakes ranks 2 to 10 lakes by how far each sits below full pool.\n\n"
  "Every result names the gauge agency, the measurement time and a link to the agency data. Reservoir agencies sometimes publish with a delay, and the result states how old each reading is. "
  "Lakes outside the 44 aren't covered, and the server says so instead of guessing. It doesn't forecast, and a reading is not a safety or navigation advisory.\n\n"
  "No account, token or sign-in is needed, and the server stores nothing about you. Results include a link to the matching page on lakelevelnow.com, a reference site run by the same author."),
 use_cases="People ask for the current level of a named lake, how much it moved this week, how far below full pool it sits, or how two lakes compare. Typical users are boaters, anglers, water managers, journalists and anyone following drought news. Users need nothing before connecting. The connector only reads data.",
 categories_hint="Reference data, Weather or environment (pick the closest two from the portal list)",
 prompts=[
  "What is the water level of Lake Mead right now and how far below full pool is it?",
  "Compare Lake Powell and Lake Mead today and tell me which is closer to full.",
  "How has Lake Shasta changed over the last 30 days?",
 ],
 pos=[
  ("Current level","What is the water level of Lake Mead right now and how far below full pool is it?","get_lake_level","Returns the current elevation, 24 hour, 7 day and 30 day change, feet below the 1,229 ft full pool and percent full, with a Reclamation source link. On 2026-11-02 the reading was 1,038.85 ft, 190.15 ft below full pool, 23.8 percent full. Live values move."),
  ("Find lakes by state","Which Texas lakes can you look up?","search_lakes","Returns 15 Texas lakes including Lake Travis, Canyon Lake and Amistad Reservoir with slugs, full pool and the gauge agency."),
  ("Compare two lakes","Compare Lake Powell and Lake Mead today and tell me which is closer to full.","compare_lakes","Ranks both by distance below full pool. On 2026-11-02 Lake Mead was 190.15 ft below and Lake Powell 168.20 ft below, so Powell was closer. Live values move."),
  ("History","How has Lake Shasta changed over the last 30 days?","get_lake_history","Returns a daily series with first, last, low, high and mean. On 2026-11-02 it covered 2026-10-03 to 2026-10-31, from 980.73 ft to 972.52 ft, a change of -8.21 ft, sourced to CDEC."),
  ("Near full pool","Is Lake Travis close to full?","get_lake_level","Returns the USGS reading and the distance below the 681 ft full pool. On 2026-11-02 it was 677.18 ft, 3.82 ft below full pool. Live values move."),
 ],
 neg=[
  ("Lake not covered","What is the water level of Loch Ness?","The server returns an error saying no covered lake matches. The assistant should say the lake isn't covered, may point to search_lakes for the 44 covered lakes, and should not invent a level."),
  ("Forecast request","Predict the level of Lake Mead next July.","There is no forecasting tool. The assistant should say the plugin reports current and past gauge readings only, and may offer the recent history instead."),
  ("Booking request","Book me a boat ramp slot at Lake Travis for Saturday.","The plugin reads gauge data and can't book anything. The assistant should say so and should not call the tools to fake a booking."),
 ],
 keywords=["lake level","reservoir","water level","drought","USGS"],
 demo_note="Screen recording of the five positive prompts in ChatGPT with the plugin enabled, about 3 minutes.",
)
ORDER = ["minimum-wage-mcp","no-tax-on-overtime-mcp","lake-level-mcp"]

def urls(r):
    return dict(
      hosted=f"https://{r}.{HOST}/mcp",
      repo=f"{GH}/{r}",
      readme=f"{GH}/{r}#readme",
    )

PRIVACY_TEXT = (
 "Public data servers. The free data servers hosted at addresses ending in lipmichal.workers.dev have no accounts and no tokens. "
 "They don't ask for your name, email address or location, and they store nothing about you or your conversation. "
 "A call sends only the arguments the tool needs, such as a lake name, a state or a dollar amount. "
 "Cloudflare hosts the servers and logs requests the way any web host does, including time, IP address and request path, under its own retention rules. "
 "Answers from public agencies can be cached at the edge for up to one hour, and the cache holds public agency data only. "
 "Results include a link to a source page and a related page on a site run by the same author. Those links carry a utm tag so the author can count visits. "
 "Following a link is optional and sends nothing to the server. Questions go to support@zovo.one."
)
