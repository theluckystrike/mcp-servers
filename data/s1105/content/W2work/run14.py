import w2lib
S = w2lib.S
b = S('backlink-checker')
b.call('check-backlinks', 1, 'link_audit', {'page_urls': ['https://en.wikipedia.org/wiki/Model_Context_Protocol', 'https://www.anthropic.com/news/model-context-protocol', 'https://github.com/modelcontextprotocol/servers'], 'target_domain': 'modelcontextprotocol.io'})
c = S('checklist')
c.call('make-a-checklist', 0, 'checklist_create', {'name': 'Van safety check', 'category': 'Fleet', 'description': 'Before the first job of the day'})
for t, req in [('Tyres and tread look OK', True), ('Lights and indicators work', True), ('First aid kit in date', True), ('Windscreen washer topped up', False)]:
    c.call('make-a-checklist', 0, 'checklist_item_add', {'checklist': 'CL-0001', 'text': t, 'required': req}, False)
c.call('make-a-checklist', 1, 'run_start', {'checklist': 'CL-0001', 'title': 'Van 2 daily check', 'reference': 'VAN-2', 'date': '2026-11-05'})
