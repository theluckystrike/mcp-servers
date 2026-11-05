import w2lib
S = w2lib.S
S('cash-book').call('do-bookkeeping', 2, 'ledger_lines', {'from': '2026-11-01', 'to': '2026-11-30', 'currency': 'USD', 'source_id': 'INV-2026-0001'})
BANK = 'Date,Description,Amount\n2026-11-03,ADOBE CREATIVE CLOUD,-59.99\n2026-11-04,SHELL OIL 5544,-48.30\n2026-11-04,BLUE BOTTLE COFFEE,-6.75\n2026-11-05,CLIENT PAYMENT HARBOR DENTAL HD-1105,1200.00\n'
b = S('bank-statement')
b.call('reconcile-bank-statements', 0, 'bank_upload', {'name': 'checking-nov', 'content': BANK}, False)
b.call('reconcile-bank-statements', 0, 'statement_import', {'path': 'checking-nov', 'account': 'checking', 'currency': 'USD'})
b.call('reconcile-bank-statements', 1, 'reconcile_expenses', {'from': '2026-11-01', 'to': '2026-11-30'})
