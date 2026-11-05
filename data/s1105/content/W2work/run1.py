import w2lib
S = w2lib.S
inv = S('invoice')
inv.call('do-bookkeeping', 0, 'business_set', {'name': 'Reyes Studio', 'address': '210 Pine St, Denver, CO 80202', 'default_currency': 'USD', 'default_tax_rate': 0, 'payment_terms_days': 14}, True)
inv.call('do-bookkeeping', 0, 'invoice_create', {'client': 'Harbor Dental', 'items': [{'description': 'Website redesign, phase 1', 'quantity': 1, 'unit_price': 2400}], 'date': '2026-10-06'}, True)
