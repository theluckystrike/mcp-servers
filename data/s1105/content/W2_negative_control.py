#!/usr/bin/env python3
"""Negative control for W2_check.py: inject one defect per page class into a copy and confirm each is caught."""
import copy, json, os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(f'{D}/W2-live.json'))
bad = copy.deepcopy(P); pg = bad['pages']
pg[0]['answer'] = pg[0]['answer'].replace('Partly.', 'Partly — really.')            # em dash
pg[1]['slug'] = 'track-expenses'                                                         # existing live slug
pg[2]['example']['result'] = pg[2]['example']['result'].replace('59.99', '59.90')         # altered number
pg[3]['faq'][0]['a'] += ' Tenant anon_0123456789abcdef0123.'                              # token leak
pg[4]['example']['tool'] = 'supplier_due_review'                                          # Pro-only tool example
pg[5]['answer'] = 'Not in most apps on its own. ' + pg[5]['answer']                        # gate-failed phrase
pg[6]['native'][0] = 'Note: this has a colon.'                                            # colon in prose
pg[7]['server_id'] = pg[7]['repo'] = 'payroll'                                             # unpaid server
pg[8]['faq'][1]['a'] = 'maintenance_due is free.'                                          # Pro tool called free, no price
pg[9]['answer'] += ' A truly seamless board.'                                              # hype word
f = os.path.join(D, 'W2work', 'W2-negative.json'); json.dump(bad, open(f, 'w'), indent=1, ensure_ascii=False)
r = subprocess.run([sys.executable, f'{D}/W2_check.py', f], capture_output=True, text=True); print(r.stdout)
want = ['en/em dash', 'already in can-claude-live', 'not traced', 'token', 'Pro-only', 'in most apps', 'colon in prose', 'not a paid catalog', 'calls Pro tool maintenance_due free', 'hype word seamless']
miss = [w for w in want if w not in r.stdout]
print('negative control exit', r.returncode, 'missed', miss)
sys.exit(0 if r.returncode == 1 and not miss else 1)
