import w2lib
S = w2lib.S
S('delivery-schedule').call('track-project-deliverables', 3, 'delivery_schedule_get', {'schedule': 'DS-2026-0001', 'as_of': '2026-11-05'})
b = S('backlink-checker')
b.call('check-if-a-link-is-nofollow', 1, 'link_check', {'page_url': 'https://en.wikipedia.org/wiki/Model_Context_Protocol', 'target_domain': 'modelcontextprotocol.io'})
b.call('check-if-a-page-is-noindexed', 1, 'robots_guard_check', {'url': 'https://en.wikipedia.org/wiki/Special:Search'})
b.call('check-if-a-page-is-noindexed', 2, 'robots_guard_check', {'url': 'https://en.wikipedia.org/wiki/Model_Context_Protocol'})
