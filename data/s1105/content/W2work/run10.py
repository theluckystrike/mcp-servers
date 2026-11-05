import w2lib
S = w2lib.S
k = S('kanban')
k.call('make-a-kanban-board', 0, 'task_move', {'id': 'HS-1', 'column': 'doing'}, True)
k.call('make-a-kanban-board', 2, 'board', {'project': 'harbor-site'})
k.call('make-a-kanban-board', 3, 'overdue', {'as_of': '2026-11-05'})
d = S('delivery-schedule')
d.call('track-project-deliverables', 0, 'delivery_schedule_create', {'reference': 'Q-2026-0014', 'reference_kind': 'quote', 'reference_date': '2026-10-01', 'client': 'Harbor Dental', 'title': 'Website rebuild', 'currency': 'USD'})
