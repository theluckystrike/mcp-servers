import w2lib
S = w2lib.S
p = S('packing-list'); PL = 'PL-2026-0001'
p.call('make-a-packing-slip', 0, 'packing_expect', {'packing_list': PL, 'sku': 'MB-200', 'description': 'Mailer box 200 mm', 'quantity': 40}, False)
p.call('make-a-packing-slip', 0, 'packing_expect', {'packing_list': PL, 'sku': 'TP-48', 'description': 'Packing tape 48 mm', 'quantity': 12}, False)
p.call('make-a-packing-slip', 0, 'carton_add', {'packing_list': PL, 'label': 'Carton 1', 'tare_grams': 850, 'length_cm': 60, 'width_cm': 40, 'height_cm': 40}, False)
p.call('make-a-packing-slip', 0, 'carton_add', {'packing_list': PL, 'label': 'Carton 2', 'tare_grams': 400, 'length_cm': 40, 'width_cm': 30, 'height_cm': 20}, False)
p.call('make-a-packing-slip', 0, 'pack_item', {'packing_list': PL, 'carton': 'C01', 'sku': 'MB-200', 'description': 'Mailer box 200 mm', 'quantity': 40, 'unit_grams': 120}, False)
p.call('make-a-packing-slip', 0, 'pack_item', {'packing_list': PL, 'carton': 'C02', 'sku': 'TP-48', 'description': 'Packing tape 48 mm', 'quantity': 10, 'unit_grams': 150}, False)
p.call('make-a-packing-slip', 1, 'packing_shortfall', {'packing_list': PL})
p.call('make-a-packing-slip', 2, 'packing_slip', {'packing_list': PL})
p.call('calculate-volumetric-weight', 1, 'carton_report', {'packing_list': PL})
p.call('calculate-volumetric-weight', 2, 'carton_report', {'packing_list': PL, 'divisor': 6000})
