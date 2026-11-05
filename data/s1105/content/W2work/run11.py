import w2lib
S = w2lib.S
d = S('delivery-schedule'); DS = 'DS-2026-0001'
d.call('track-project-deliverables', 1, 'deliverable_add', {'schedule': DS, 'description': 'Sitemap and wireframes', 'due_date': '2026-10-15', 'value_minor': 80000})
d.call('track-project-deliverables', 0, 'deliverable_add', {'schedule': DS, 'description': 'Homepage design', 'due_date': '2026-10-30', 'value_minor': 120000}, False)
d.call('track-project-deliverables', 0, 'deliverable_add', {'schedule': DS, 'description': 'Launch on live hosting', 'due_date': '2026-11-20', 'value_minor': 100000}, False)
d.call('track-project-deliverables', 0, 'deliverable_status', {'schedule': DS, 'deliverable': 'D1', 'status': 'delivered', 'date': '2026-10-14'}, False)
d.call('track-project-deliverables', 0, 'deliverable_status', {'schedule': DS, 'deliverable': 'D1', 'status': 'accepted', 'date': '2026-10-16', 'note': 'Approved by Dr. Lee'}, False)
d.call('track-project-deliverables', 0, 'deliverable_status', {'schedule': DS, 'deliverable': 'D2', 'status': 'in_progress', 'date': '2026-10-20'}, False)
d.call('track-project-deliverables', 2, 'late_report', {'as_of': '2026-11-05'})
