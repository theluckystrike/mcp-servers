import w2lib
S = w2lib.S
c = S('catalogue')
c.call('make-a-price-list', 0, 'sku_set', {'sku': 'LOGO-STD', 'name': 'Logo design, standard', 'unit': 'project', 'currency': 'USD', 'price_minor': 120000, 'valid_from': '2026-01-01'}, False)
c.call('make-a-price-list', 1, 'sku_set', {'sku': 'LOGO-STD', 'name': 'Logo design, standard', 'unit': 'project', 'currency': 'USD', 'price_minor': 135000, 'valid_from': '2027-01-01'})
c.call('make-a-price-list', 0, 'sku_set', {'sku': 'WEB-PAGE', 'name': 'Website page, design and build', 'unit': 'page', 'currency': 'USD', 'price_minor': 45000, 'valid_from': '2026-01-01'}, False)
c.call('make-a-price-list', 0, 'rate_set', {'role': 'Designer', 'currency': 'USD', 'hourly_minor': 8500, 'valid_from': '2026-01-01'}, False)
c.call('make-a-price-list', 2, 'price_list_text', {'currency': 'USD', 'date': '2026-11-05'})
m = S('maintenance-log')
m.call('track-equipment-maintenance', 0, 'asset_add', {'name': 'Air compressor', 'tag': 'CMP-01', 'location': 'Workshop bay 2', 'currency': 'USD'}, True)
