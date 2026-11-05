import w2lib
S = w2lib.S
d = S('delivery-schedule'); DS = 'DS-2026-0001'
d.call('track-project-deliverables', 0, 'deliverable_status', {'schedule': DS, 'deliverable': 'D01', 'status': 'delivered', 'date': '2026-10-14'}, False)
d.call('track-project-deliverables', 0, 'deliverable_status', {'schedule': DS, 'deliverable': 'D01', 'status': 'accepted', 'date': '2026-10-16', 'note': 'Approved by Dr. Lee'}, False)
d.call('track-project-deliverables', 0, 'deliverable_status', {'schedule': DS, 'deliverable': 'D02', 'status': 'in_progress', 'date': '2026-10-20'}, False)
d.call('track-project-deliverables', 2, 'late_report', {'as_of': '2026-11-05'})
