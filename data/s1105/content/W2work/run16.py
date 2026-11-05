import w2lib
S = w2lib.S
S('checklist').call('make-a-checklist', 4, 'run_report', {'run': 'RUN-2026-0001'})
for s in ['cash-book','bank-statement','deposits','supplier-list','packing-list','catalogue','maintenance-log','kanban','delivery-schedule','backlink-checker','checklist']:
    S(s).call('_license', s, 'license_status', {})
