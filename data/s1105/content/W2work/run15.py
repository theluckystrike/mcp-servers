import w2lib
S = w2lib.S
c = S('checklist'); R = 'RUN-2026-0001'
c.call('make-a-checklist', 0, 'run_check', {'run': R, 'item': 'I01', 'state': 'pass', 'by': 'Sam'}, False)
c.call('make-a-checklist', 0, 'run_check', {'run': R, 'item': 'I03', 'state': 'pass', 'by': 'Sam'}, False)
c.call('make-a-checklist', 0, 'run_check', {'run': R, 'item': 'I04', 'state': 'na', 'by': 'Sam'}, False)
c.call('make-a-checklist', 2, 'run_check', {'run': R, 'item': 'I02', 'state': 'fail', 'by': 'Sam', 'note': 'Left rear indicator out'})
c.call('make-a-checklist', 3, 'run_show', {'run': R})
