import w2lib
S = w2lib.S
cb = S('cash-book')
cb.call('do-month-end-close', 2, 'ledger_lines', {'from': '2026-11-01', 'to': '2026-11-30', 'currency': 'USD', 'account': 'receivables'})
d = S('deposits')
d.call('track-client-deposits', 1, 'deposit_record', {'client': 'Bayline Logistics', 'amount_minor': 100000, 'kind': 'retainer', 'currency': 'USD', 'received_date': '2026-11-02', 'reference': 'WIRE 88213'})
S('invoice').call('track-client-deposits', 0, 'invoice_create', {'client': 'Bayline Logistics', 'items': [{'description': 'Trade show stand design', 'quantity': 1, 'unit_price': 650}]}, False)
d.call('track-client-deposits', 0, 'deposit_apply', {'id': 'Bayline Logistics', 'invoice': 'INV-2026-0002', 'date': '2026-11-05'})
d.call('track-client-deposits', 2, 'deposit_balance', {'client': 'Bayline Logistics'})
d.call('track-client-deposits', 3, 'deposit_statement_text', {'client': 'Bayline Logistics', 'as_of': '2026-11-05'})
