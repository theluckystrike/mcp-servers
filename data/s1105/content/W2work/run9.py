import w2lib
S = w2lib.S
m = S('maintenance-log')
m.call('track-equipment-maintenance', 1, 'maintenance_log', {'asset': 'CMP-01', 'date': '2026-08-12', 'work': 'Oil change and new intake filter', 'cost_cents': 8450, 'technician': 'Luis', 'interval_days': 90})
m.call('track-equipment-maintenance', 0, 'maintenance_log', {'asset': 'CMP-01', 'date': '2026-10-02', 'work': 'Replaced pressure switch', 'cost_cents': 13900, 'technician': 'Luis'}, False)
m.call('track-equipment-maintenance', 2, 'asset_history', {'asset': 'CMP-01'})
k = S('kanban')
k.call('make-a-kanban-board', 1, 'task_add', {'title': 'Send Harbor Dental homepage mockup', 'project': 'harbor-site', 'due': '2026-11-03', 'estimate_minutes': 180, 'priority': 'high'})
k.call('make-a-kanban-board', 0, 'task_add', {'title': 'Write About page copy', 'project': 'harbor-site', 'due': '2026-11-12', 'estimate_minutes': 90}, False)
k.call('make-a-kanban-board', 0, 'task_add', {'title': 'Collect staff photos', 'project': 'harbor-site', 'estimate_minutes': 30}, False)
