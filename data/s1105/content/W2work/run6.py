import w2lib
S = w2lib.S
s = S('supplier-list')
s.call('keep-a-supplier-list', 0, 'supplier_add', {'name': 'Shenzhen Box Co', 'category': 'Packaging', 'contact_name': 'Maria Chen', 'email': 'orders@example.com', 'payment_terms': '50% upfront', 'lead_time_days': 21, 'notes': 'MOQ 500 mailer boxes'}, False)
s.call('keep-a-supplier-list', 1, 'supplier_add', {'name': 'Acme Fasteners', 'category': 'Hardware', 'contact_name': 'Dan Ortiz', 'phone': '+1 303 555 0142', 'payment_terms': 'Net 30', 'lead_time_days': 5})
s.call('keep-a-supplier-list', 2, 'supplier_list', {})
s.call('keep-a-supplier-list', 3, 'supplier_export', {'format': 'csv'})
p = S('packing-list')
p.call('make-a-packing-slip', 0, 'packing_list_create', {'reference': 'ORD-4471', 'reference_kind': 'order', 'consignee': 'Bayline Logistics', 'ship_to': '88 Harbor Rd, Oakland, CA 94607', 'date': '2026-11-05'})
