#!/usr/bin/env python3
"""s1103 canclaude2: append raw-to-cooked-weight-mcp and vegetable-yield-percentage-mcp to free-servers.json.
tools = live tools/list from calls/<repo>.tools.json (2026-11-03). usage: add_free_servers.py <free-servers.json>"""
import json, sys
C = '/Users/mike/mcp-servers/data/s1103/canclaude2/calls/'
def tools(repo):
    return [{'name': t['name'], 'title': t.get('title') or t['name'], 'description': t['description']} for t in json.load(open(C + repo + '.tools.json'))['result']['tools']]
NEW = [
 {'repo': 'raw-to-cooked-weight-mcp', 'topic': 'Raw to cooked weight', 'name': 'Raw to Cooked Weight',
  'tagline': 'Raw and cooked weight of meat and poultry from the USDA Table of Cooking Yields.',
  'knows': ['The USDA measured cooking yield for each cut and cooking method, with the range across samples.', 'Cooked weight from raw, raw weight from cooked, and how much raw meat to buy for a number of servings.', 'Beef, pork, chicken, turkey, lamb, veal, game and sausage. Fish and seafood are not in the USDA table.'],
  'sources': 'USDA ARS Table of Cooking Yields for Meat and Poultry (spreadsheet and documentation); NIST SP 811 for pounds and ounces.',
  'hosted_url': 'https://raw-to-cooked-weight-mcp.lipmichal.workers.dev/mcp', 'repo_url': 'https://github.com/theluckystrike/raw-to-cooked-weight-mcp', 'npm': None,
  'tools_checked': '2026-11-03', 'added': '2026-11-03',
  'money_site': {'name': 'RecipeTool raw to cooked weight calculator', 'url': 'https://recipetool.net/tools/raw-to-cooked-weight-calculator'},
  'prompts': ['How much does 1 lb of raw 80/20 ground beef weigh after cooking?', 'I ate 150 g of roasted chicken thigh. What was the raw weight?', 'How much raw pork shoulder should I buy to serve 10 people?']},
 {'repo': 'vegetable-yield-percentage-mcp', 'topic': 'Vegetable yield percentage', 'name': 'Vegetable Yield Percentage',
  'tagline': 'Edible yield of raw vegetables and fruit after peel, seeds and trim, from USDA data.',
  'knows': ['The USDA edible yield percent for 305 raw vegetables and fruits, and what the refuse is.', 'Edible weight from a purchased weight, and how much to buy for a recipe amount.', 'USDA household weights such as 1 medium onion or 1 cup chopped.'],
  'sources': 'USDA National Nutrient Database for Standard Reference, Release 28 (refuse percent and household weights); NIST SP 811 for pounds and ounces.',
  'hosted_url': 'https://vegetable-yield-percentage-mcp.lipmichal.workers.dev/mcp', 'repo_url': 'https://github.com/theluckystrike/vegetable-yield-percentage-mcp', 'npm': None,
  'tools_checked': '2026-11-03', 'added': '2026-11-03',
  'money_site': {'name': 'Ingredient Calculator vegetable yield calculator', 'url': 'https://ingredientcalculator.com/vegetable-yield-percentage-calculator'},
  'prompts': ['How much butternut squash is left after peeling 3 lb?', 'How many onions do I buy for 3 cups chopped?', 'Which vegetables have the lowest edible yield?']},
]
p = sys.argv[1]; d = json.load(open(p))
have = {s['repo'] for s in d['servers']}
for n in NEW:
    n['tools'] = tools(n['repo'])
    if n['repo'] not in have: d['servers'].append(n)
json.dump(d, open(p, 'w'), indent=1, ensure_ascii=False); open(p, 'a').write('\n')
print(len(d['servers']))
