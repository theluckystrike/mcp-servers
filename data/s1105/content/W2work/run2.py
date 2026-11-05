import w2lib
S = w2lib.S
S('invoice').call('do-bookkeeping', 0, 'invoice_mark_paid', {'number': 'INV-2026-0001', 'amount': 1200, 'paid_date': '2026-11-05', 'method': 'bank transfer', 'reference': 'HD-1105'}, False)
S('expense-tracker').call('do-bookkeeping', 0, 'expense_add', {'amount': 59.99, 'currency': 'USD', 'merchant': 'Adobe', 'category': 'software', 'date': '2026-11-02', 'vat_rate': 0}, False)
S('expense-tracker').call('do-bookkeeping', 0, 'expense_add', {'amount': 48.30, 'currency': 'USD', 'merchant': 'Shell', 'category': 'travel', 'date': '2026-11-03', 'vat_rate': 0}, False)
cb = S('cash-book')
cb.call('do-bookkeeping', 1, 'ledger_build', {'from': '2026-11-01', 'to': '2026-11-30', 'currency': 'USD'})
cb.call('do-bookkeeping', 2, 'ledger_lines', {'from': '2026-11-01', 'to': '2026-11-30', 'currency': 'USD'})
