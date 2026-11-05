import w2lib
S = w2lib.S
cb = S('cash-book')
cb.call('do-month-end-close', 0, 'ledger_build', {'from': '2026-11-01', 'to': '2026-11-30', 'currency': 'USD'}, False)
cb.call('do-month-end-close', 1, 'trial_balance', {'from': '2026-11-01', 'to': '2026-11-30', 'currency': 'USD'})
cb.call('do-month-end-close', 9, 'month_close', {'month': '2026-11', 'currency': 'USD', 'dry_run': True})
