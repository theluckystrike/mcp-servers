#!/usr/bin/env python3
"""s1105 W2: build content/W2-live.json (can-claude-live.json entry schema) from raw calls in ~/mcp-servers/data/s1105/calls/W2/.
Raw calls were made on 2026-11-05 through https://mcp.zovo.one/mcp/<id>/t/<token> with one free token (W2work/w2lib.py).
Results are the server's own text. Edits, each stated in the note when it applies:
(1) the 'Free tier: 600 calls/hour ...' footer is dropped because it carries the token, (2) one-hour download links show as <download link>,
(3) JSON answers may be shortened to a subset of fields, with every shown value unchanged."""
import json, os, re
CALLS = os.path.expanduser('~/mcp-servers/data/s1105/calls/W2')
OUT = os.path.expanduser('~/mcp-servers/data/s1105/content/W2-live.json')
RUN = '2026-11-05'

def raw(f):
    return json.load(open(f'{CALLS}/{f}.json'))

def clean(t):
    t = '\n'.join(l for l in t.splitlines() if not l.startswith('Free tier: 600 calls/hour'))
    return re.sub(r'https://mcp\.zovo\.one/mcp/download/[0-9a-f]+', '<download link>', t).strip()

def body(f):
    r = raw(f)['response']['result']
    assert not r.get('isError'), f
    return clean('\n'.join(c['text'] for c in r['content'] if c.get('type') == 'text'))

def text(f):
    t = body(f)
    assert 'anon_' not in t, f
    return t

def js(f):
    return json.loads(body(f))

def keep(d, keys):
    return {k: d[k] for k in keys}

def pick(f, keys, sub=None):
    d = js(f)
    if sub: d = sub(d)
    out = json.dumps(keep(d, keys), ensure_ascii=False)
    assert 'anon_' not in out, f
    return out

def field(f, k):
    v = clean(js(f)[k]); assert 'anon_' not in v; return v

def ex(f, prompt, result, note='', args=None):
    r = raw(f)
    return {'prompt': prompt, 'tool': r['tool'], 'args': dict(args if args is not None else r['args']), 'result': result, 'note': note, 'is_error': False, 'run': RUN}

LINK = 'Download links last one hour, so they are shown here as <download link>.'
SHORT = 'The server answers in JSON. This is a shortened copy, and every field shown is unchanged.'
CODE = 'With code execution on (the default on Free, Pro and Max)'
def PRO(server_name, adds):
    return f'Pro is $19 once for the {server_name} server, or $39 once for all 49 servers. ' + adds

P = []
def page(slug, sid, h1, title, query, meta, answer, native, needs, e1, e2, faq):
    P.append({'slug': slug, 'repo': sid, 'server_id': sid, 'h1': h1, 'title': title, 'query': query, 'meta_description': meta, 'answer': answer,
              'native': native, 'needs': needs, 'example': e1, **({'example2': e2} if e2 else {}), 'faq': faq})

def lines5(d):
    return {**d, 'lines': [keep(l, ['date', 'account', 'debit', 'credit', 'description']) for l in d['lines']]}

page('do-bookkeeping', 'cash-book', 'Can Claude do bookkeeping?', 'Can Claude do bookkeeping? Double entry from your records', 'can claude do bookkeeping',
 'Partly. Claude sorts transactions and drafts entries, but a chat keeps no books. The Cash Book server builds a balanced ledger from your saved invoices.',
 f"Partly. Claude can sort transactions into categories, explain debits and credits and draft journal entries. {CODE} it can build a ledger in a spreadsheet from files you upload, and Projects and memory can keep your chart of accounts. What a chat does not keep is a set of books that adds up from your saved invoices, payments and expenses. Connect the Cash Book server (free token) and Claude derives a balanced double-entry ledger for a period from the records saved in the sibling servers, with every line traced to its source document.",
 ['Sorts transactions into categories and explains debits and credits.', 'Builds a ledger in a spreadsheet from uploaded files when code execution is on.'],
 ['A ledger rebuilt from saved invoices, payments, deposits and expenses.', 'Every line traced to the document and server it came from.', 'A trial balance proved to the cent, free and unlimited.'],
 ex('do-bookkeeping.1.ledger_build', 'Build the November books from my invoices and expenses.', pick('do-bookkeeping.1.ledger_build', ['period', 'lines', 'debits', 'credits', 'balanced', 'accounts']),
    'One USD 2,400.00 invoice with USD 1,200.00 paid, and two expenses, were saved in the Invoice and Expense Tracker servers under the same token first. ' + SHORT),
 ex('do-bookkeeping.2.ledger_lines', 'Show me the ledger lines behind invoice INV-2026-0001.', pick('do-bookkeeping.2.ledger_lines', ['debits', 'credits', 'lines'], lines5),
    'Each line is shown with five of its fields, unchanged. The invoice posts to receivables and revenue, and the part payment moves USD 1,200.00 from receivables to cash.'),
 [{'q': 'Does it post my bank statement too?', 'a': 'No. Cash is posted from your invoice payments and expenses, and an imported bank statement is used only as evidence for the bank reconciliation. Posting both would count the same money twice.'},
  {'q': 'Does it connect to QuickBooks or Xero?', 'a': 'No. It reads only the records saved in the sibling servers under your token, and it writes nothing back to them.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Building a ledger is free for 3 periods a month, and the trial balance and ledger lines are free and unlimited. ' + PRO('Cash Book', 'It adds the month close with a stored snapshot, the account by account ledger report and the CSV export of ledger lines.')}])

def tb(d):
    return {**d, 'accounts': [keep(a, ['account', 'type', 'debits', 'credits', 'balance']) for a in d['accounts']]}
page('do-month-end-close', 'cash-book', 'Can Claude do month-end close?', 'Can Claude do month-end close? Trial balance and checks', 'claude month end close',
 'Partly. Claude can walk through a close, but a chat keeps no books to close. The Cash Book server proves the trial balance, and its Pro close stores a snapshot.',
 f"Partly. Claude can walk you through a close checklist, and {CODE[0].lower() + CODE[1:]} it can total an uploaded ledger and check that debits equal credits. Claude Code routines can run a close script on a schedule. None of that keeps the records the close is checked against. Connect the Cash Book server (free token) and Claude builds the month's ledger from your saved invoices, expenses and deposits and proves the trial balance to the cent. Pro adds month_close, which lists what is unposted or unbalanced, stores the close as a snapshot and names any later drift against it.",
 ['Explains each step of a month-end close.', 'Totals an uploaded ledger in its sandbox when code execution is on.'],
 ['A trial balance from the same saved records every month.', 'The open receivables lines behind the balance.', 'A stored close that later changes are checked against (Pro).'],
 ex('do-month-end-close.1.trial_balance', 'Run the trial balance for November.', pick('do-month-end-close.1.trial_balance', ['balanced', 'debits', 'credits', 'imbalance', 'accounts'], tb),
    'The November ledger was built from the saved invoice and expenses first. The server answers in JSON. This is a shortened copy, and each account is shown with five of its fields, unchanged.'),
 ex('do-month-end-close.2.ledger_lines', 'What is still open in receivables?', pick('do-month-end-close.2.ledger_lines', ['debits', 'credits', 'lines', 'note'], lines5),
    'Each line is shown with five of its fields, unchanged. USD 1,200.00 of the USD 2,400.00 invoice is still owed.'),
 [{'q': 'Can it close the month on the free tier?', 'a': 'No. month_close is Pro. On the free tier trial_balance and ledger_lines are free and unlimited, and ledger_build covers 3 periods a month, so you can check the numbers before you buy.'},
  {'q': 'What does Pro cost and add?', 'a': PRO('Cash Book', 'It adds month_close, the account by account ledger report and the CSV export of ledger lines.')}])

page('reconcile-bank-statements', 'bank-statement', 'Can Claude reconcile bank statements?', 'Can Claude reconcile bank statements? Match to expenses', 'can claude reconcile bank statements',
 'Yes for a one-off check in its sandbox. The Bank Statement server keeps a bank ledger and matches each debit to an expense you logged, listing what is missing.',
 f"Yes, for a one-off check. {CODE} Claude can compare an uploaded bank CSV with your expense list in its sandbox, and Claude Code can do it with files on your disk. Each month it writes the matching again, and the expense list has to come from somewhere. Connect the Bank Statement server (free token) and Claude imports the bank CSV into a saved ledger and matches each debit to an expense saved in the Expense Tracker server, by currency and exact amount within a few days. It lists what matched, bank lines with no expense and expenses that never hit the bank.",
 ['Compares two files you upload, in its sandbox, when code execution is on.', 'Explains why a bank balance and a ledger can differ.'],
 ['A saved bank ledger that later months add to.', 'Matches against expenses you logged during the month.', 'A list of bank lines with no receipt behind them.'],
 ex('reconcile-bank-statements.1.reconcile_expenses', 'Match my November bank debits against the expenses I logged.', pick('reconcile-bank-statements.1.reconcile_expenses', ['window_days', 'matched', 'matches', 'unmatched_bank', 'expenses_without_a_bank_line', 'note']),
    'A four-line bank CSV was uploaded with bank_upload and imported with statement_import first, and the two expenses were logged in the Expense Tracker server. ' + SHORT),
 ex('reconcile-bank-statements.0.statement_import', 'Import checking-nov.csv as my checking account.', pick('reconcile-bank-statements.0.statement_import', ['account', 'columns', 'date_order', 'rows_read', 'imported', 'duplicates_skipped', 'date_range']),
    'The CSV was uploaded with bank_upload first. ' + SHORT),
 [{'q': 'Can it read a PDF statement?', 'a': 'No. The upload has to be delimited text such as a CSV export, and a PDF statement is refused. Download the CSV from your online banking if it offers one.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'On the free tier a match covers up to 31 days per call, which fits one month, and the free tier reads the last 12 months of imported lines. Category rules are free up to 5. ' + PRO('Bank Statement', 'It matches over any date range.')}])

page('track-client-deposits', 'deposits', 'Can Claude track client deposits and retainers?', 'Can Claude track client deposits? Retainers and refunds', 'can claude track client deposits',
 'Not on its own. A chat keeps no deposit ledger. The Deposits server records retainers, applies them to invoices as payments and says what you still hold.',
 "Not on its own. Claude can work out what you still hold from a list you paste, and Projects and memory can keep notes, but a chat keeps no deposit ledger that invoices draw from. Connect the Deposits server (free token) and Claude records each retainer or security deposit with a DEP number, applies part of it to an invoice as a payment in the Invoice server, records refunds, and tells you how much of each client's money you still hold. It also writes a deposit statement to paste into an email.",
 ['Adds up a list of deposits you paste.', 'Drafts a note to a client about their balance.'],
 ['A numbered record of each retainer or security deposit.', 'Part of a deposit applied to an invoice as a real payment.', 'What you still hold per client, never added across currencies.'],
 ex('track-client-deposits.0.deposit_apply', "Pay Bayline's invoice INV-2026-0002 from their retainer.", pick('track-client-deposits.0.deposit_apply', ['applied', 'invoice', 'note']),
    'A USD 1,000.00 retainer (DEP-2026-0001) and the USD 650.00 invoice were saved first. ' + SHORT),
 ex('track-client-deposits.3.deposit_statement_text', 'Write Bayline a deposit statement I can paste into an email.', text('track-client-deposits.3.deposit_statement_text'), LINK),
 [{'q': 'Does a refund count as a payment?', 'a': 'No. A refund gives held money back to the client and does not touch the invoice server. Only an applied deposit is recorded as a payment on an invoice.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Five deposits a month, applying, refunding, balances and the plain-text statement are free. ' + PRO('Deposits', 'It adds the A4 deposit statement PDF and the deposit book report with the oldest holdings.')}])

def sup(d):
    return {**d, 'created': keep(d['created'], ['id', 'name', 'category', 'contact_name', 'phone', 'payment_terms', 'lead_time_days', 'last_reviewed'])}
page('keep-a-supplier-list', 'supplier-list', 'Can Claude keep a supplier list?', 'Can Claude keep a supplier list? Terms, lead times, reviews', 'can claude keep a supplier list',
 'Partly. Claude drafts a supplier table, but a chat keeps no shared directory. The Supplier List server saves each supplier with terms and lead time.',
 f"Partly. Claude can draft a supplier table, and Projects and memory can hold notes about who you buy from. {CODE} it can also write the table to a spreadsheet. What it does not keep is one directory that every chat reads and updates by supplier number. Connect the Supplier List server (free token) and Claude adds each supplier with a SUP number, contact, payment terms and lead time, finds them again by name or category, and exports the list as CSV.",
 ['Drafts a supplier table from what you tell it.', 'Writes it to a spreadsheet when code execution is on.'],
 ['One saved record per supplier with a number that is never reissued.', 'Payment terms and lead time ready when you place an order.', 'A list of records nobody has checked in 90 days (Pro).'],
 ex('keep-a-supplier-list.1.supplier_add', 'Add Acme Fasteners, hardware, Dan Ortiz, +1 303 555 0142, Net 30, 5 days lead time.', pick('keep-a-supplier-list.1.supplier_add', ['created', 'notes'], sup),
    SHORT + ' The phone number is a 555 test number.'),
 ex('keep-a-supplier-list.3.supplier_export', 'Export the supplier list as CSV.', text('keep-a-supplier-list.3.supplier_export'),
    'One more supplier was added before this export. Its email is an example.com address.'),
 [{'q': 'What is free, and what does Pro add?', 'a': 'Ten suppliers, search and the CSV export are free, and removing a supplier frees its slot. ' + PRO('Supplier List', 'It adds the due-review report of stale records and the Markdown export.')},
  {'q': 'Does it place orders?', 'a': 'No. It keeps the directory. Numbered purchase orders are a separate job for the Billing Docs server.'}])

def sf(d):
    return {**d, 'rows': [keep(r, ['sku', 'description', 'expected', 'packed', 'outstanding', 'state']) for r in d['rows']]}
page('make-a-packing-slip', 'packing-list', 'Can Claude make a packing slip?', 'Can Claude make a packing slip? Cartons, weights, shortfall', 'can claude make a packing slip',
 'Yes, as a document. The Packing List server also checks packed against ordered, line by line, and prints a slip with carton weights and no prices.',
 f"Yes, as a document. Claude can lay out a packing slip from what you tell it, and {CODE[0].lower() + CODE[1:]} it can write it as a file. It does not check what was packed against what was ordered unless you give it both lists every time. Connect the Packing List server (free token) and Claude opens a numbered packing list against an order, records cartons and what went into each, reports any line still short, and prints a slip with weights and no prices.",
 ['Drafts a packing slip layout from a list.', 'Writes it as a file when code execution is on.'],
 ['Ordered against packed, line by line, before the box is sealed.', 'Net, gross and chargeable weight per carton.', 'A slip with a signature line and no prices.'],
 ex('make-a-packing-slip.1.packing_shortfall', 'Is order ORD-4471 ready to ship?', pick('make-a-packing-slip.1.packing_shortfall', ['rows', 'short', 'ready_to_ship', 'not_ready_because'], sf),
    'The packing list, two ordered lines, two cartons and the packed items were recorded first. ' + SHORT),
 ex('make-a-packing-slip.2.packing_slip', 'Print the packing slip.', field('make-a-packing-slip.2.packing_slip', 'slip'),
    'This is the slip field of the answer. The slip comes back as text on every tier, and the note about the Pro file option is left out here.'),
 [{'q': 'Does it put prices on the slip?', 'a': 'No. A packing slip lists goods only. Raise the invoice for the same order in the Invoice server.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'The shortfall, the carton report and the slip as text are free, with up to 3 packing lists open at once. Shipping or cancelling a list frees a slot. ' + PRO('Packing List', 'It also returns the slip as a .txt download file.')}])

def cr(d):
    return {**d, 'cartons': [keep(c, ['id', 'dimensions_cm', 'gross_kg', 'volumetric_grams', 'chargeable_kg', 'chargeable_basis']) for c in d['cartons']],
            'totals': keep(d['totals'], ['gross_kg', 'chargeable_kg'])}
page('calculate-volumetric-weight', 'packing-list', 'Can Claude calculate volumetric weight?', 'Can Claude calculate volumetric weight? Chargeable per carton', 'can claude calculate volumetric weight',
 'Yes, the formula is simple. The Packing List server works it out from the cartons you packed and returns gross, volumetric and chargeable weight.',
 f"Yes. Volumetric weight, also called dimensional weight, is length times width times height divided by the carrier's divisor. Claude can do that math, or run it in its sandbox {CODE[0].lower() + CODE[1:]}. The risk is in the inputs, such as a carton left out or a weight guessed. Connect the Packing List server (free token) and Claude works from the cartons and packed items you recorded, and returns tare, net, gross, volumetric and chargeable weight per carton and for the shipment. A carton with no dimensions makes the chargeable total null instead of a guess.",
 ['Does the length times width times height arithmetic.', 'Explains why carriers bill the greater of gross and volumetric weight.'],
 ['Chargeable weight from the cartons actually packed.', 'The same shipment at another divisor in one call.', 'No guessed total when a carton has no dimensions.'],
 ex('calculate-volumetric-weight.1.carton_report', 'What is the chargeable weight for this shipment?', pick('calculate-volumetric-weight.1.carton_report', ['divisor', 'cartons', 'totals'], cr),
    'These are the two cartons from the packing slip example. The default divisor is 5000 for centimetres and kilograms, so the 60 by 40 by 40 cm carton weighs 19.2 kg by volume. ' + SHORT),
 ex('calculate-volumetric-weight.2.carton_report', 'And at a divisor of 6000?', pick('calculate-volumetric-weight.2.carton_report', ['divisor', 'cartons', 'totals'], cr),
    'Carriers publish their own divisor, so use the one in your contract.'),
 [{'q': 'Which divisor should I use?', 'a': 'The one your carrier publishes. Pass it as divisor on the call. The default is 5000.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'The carton report is free, with up to 3 packing lists open at once. ' + PRO('Packing List', 'It also returns the packing slip as a .txt download file.')}])

def sk(d):
    return {**d, 'updated': keep(d['updated'], ['sku', 'name', 'in_force', 'in_force_on', 'price_rows'])}
page('make-a-price-list', 'catalogue', 'Can Claude make a price list?', 'Can Claude make a price list? Dated prices and rate cards', 'can claude make a price list',
 'Yes, as a one-off document. The Catalogue server keeps each price with the day it starts and prints the list in force on any date.',
 f"Yes, as a one-off document. Claude can format a price list from what you give it, and {CODE[0].lower() + CODE[1:]} it can write it as a file. What a chat does not keep is the price in force on a given day, or a price rise booked for next year. Connect the Catalogue server (free token) and Claude stores each SKU and hourly rate with the date it starts, prints the list in force on any date with later prices shown, and prices quote and invoice lines from it.",
 ['Formats a price list from a table you give it.', 'Writes it as a file when code execution is on.'],
 ['Each price kept with the day it came into force.', "A price rise booked ahead without losing today's price.", 'Quote and invoice lines priced from the same list.'],
 ex('make-a-price-list.1.sku_set', 'From 1 January 2027 the standard logo is USD 1,350.', pick('make-a-price-list.1.sku_set', ['updated', 'notes'], sk),
    'The SKU was first set at USD 1,200.00 from 1 January 2026. ' + SHORT),
 ex('make-a-price-list.2.price_list_text', 'Print my price list as of today.', text('make-a-price-list.2.price_list_text'),
    'Two SKUs and one hourly rate were stored first. ' + LINK),
 [{'q': 'Does a price change rewrite old quotes?', 'a': 'No. A repriced SKU keeps its old rows, and each line is priced as of its own date.'},
  {'q': 'What is free, and what does Pro add?', 'a': '25 SKUs in one price tier, hourly rate cards, the text price list and pricing quote and invoice lines are free. ' + PRO('Catalogue', 'It adds more price tiers such as trade and list, the A4 price list page (on the hosted server an HTML page you print to PDF) and the catalogue report.')}])

def ah(d):
    return {**d, 'log': [keep(l, ['date', 'work', 'cost', 'technician']) for l in d['log']]}
page('track-equipment-maintenance', 'maintenance-log', 'Can Claude track equipment maintenance?', 'Can Claude track equipment maintenance? A service log', 'can claude track equipment maintenance',
 'Not on its own. A chat keeps no service log. The Maintenance Log server saves every service with cost and technician and knows when each machine is next due.',
 "Not on its own. Claude can draft a maintenance schedule, and Projects and memory can keep notes, but a chat keeps no service log that totals what each machine cost and knows when it is next due. Connect the Maintenance Log server (free token) and Claude adds each piece of equipment with an asset tag, logs every service with cost and technician, sets the next due date from a date or an interval, and reads back the full history of any asset.",
 ['Drafts a service schedule from a manual you upload.', 'Explains common service intervals.'],
 ['One record per machine with its tag and location.', 'Every service with cost, technician and next due date.', 'What is overdue across all equipment (Pro).'],
 ex('track-equipment-maintenance.1.maintenance_log', 'Log an oil change and new intake filter on compressor CMP-01 on 12 August, USD 84.50, by Luis, next in 90 days.', pick('track-equipment-maintenance.1.maintenance_log', ['logged', 'notes']),
    'The compressor was added with asset_add first. ' + SHORT),
 ex('track-equipment-maintenance.2.asset_history', 'Show the full history of CMP-01.', pick('track-equipment-maintenance.2.asset_history', ['name', 'tag', 'entries', 'total_spent', 'last_service', 'next_due', 'schedule', 'log'], ah),
    'A pressure switch repair on 2 October was logged before this call. Each log entry is shown with four of its fields, unchanged.'),
 [{'q': 'Does it remind me when a service is due?', 'a': 'No. It sends nothing. Due status is worked out from the date each time you ask, so it cannot go stale.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Three assets with unlimited logging on them, the history and the CSV export are free. ' + PRO('Maintenance Log', 'It adds the due report across every asset and the Markdown export.')}])

page('make-a-kanban-board', 'kanban', 'Can Claude make a kanban board?', 'Can Claude make a kanban board? Saved tasks and due dates', 'can claude make a kanban board',
 'Yes, to look at. The Kanban server keeps tasks with ids, due dates and estimates across chats and lists every overdue task on all your boards.',
 "Yes, to look at. Claude can lay out a board as a table, or build one as an artifact you can click through. The tasks live in that chat or artifact, though, and Projects and memory keep notes rather than task ids and due dates that every chat reads the same way. Connect the Kanban server (free token) and Claude adds tasks with ids, due dates and estimates, moves them between columns, shows each board with totals, and lists every overdue task across your boards.",
 ['Lays out a board as a table or an interactive artifact.', 'Breaks a project into tasks.'],
 ['Tasks with ids, due dates and estimates kept between chats.', 'Every overdue task across all boards in one list.', 'Estimate against actual minutes per task.'],
 ex('make-a-kanban-board.2.board', 'Show the harbor-site board.', text('make-a-kanban-board.2.board'), 'Three tasks were added and HS-1 was moved to doing first.'),
 ex('make-a-kanban-board.3.overdue', 'What is overdue?', text('make-a-kanban-board.3.overdue')),
 [{'q': 'Does it work with the Time Tracker?', 'a': "task_start_timer returns the arguments for the Time Tracker's timer_start and records the link. It starts nothing itself."},
  {'q': 'What is free, and what does Pro add?', 'a': "Three boards with up to 200 open tasks, the default columns and this week's review are free. " + PRO('Kanban', 'It adds custom columns and reviews of past weeks.')}])

def lr(d):
    return {**d, 'late': [keep(l, ['reference', 'client', 'deliverable', 'description', 'due_date', 'status', 'days_late', 'value']) for l in d['late']]}
def dg(d):
    s = d['schedule']
    return {'schedule': {**keep(s, ['id', 'reference', 'client', 'counts', 'value']), 'deliverables': [keep(x, ['id', 'description', 'due_date', 'status', 'state', 'value']) for x in s['deliverables']]}}
page('track-project-deliverables', 'delivery-schedule', 'Can Claude track project deliverables?', 'Can Claude track project deliverables? Due dates and status', 'can claude track project deliverables',
 'Partly. A chat keeps no dated status per deliverable. The Delivery Schedule server records each one against a quote and reports what is late.',
 "Partly. Claude can turn a quote or a statement of work into a list of deliverables, and Projects and memory can keep it as notes. What a chat does not keep is a dated status for each one, so lateness has to be worked out by hand each time. Connect the Delivery Schedule server (free token) and Claude opens a schedule against a quote, work order or change order, records when each deliverable starts, is delivered and is accepted, and reports what has slipped with the value at risk.",
 ['Turns a quote or brief into a deliverables list.', 'Drafts a status update for the client.'],
 ['A dated status history for every deliverable.', 'What is late as at any date, with value at risk.', 'Accepted work turned into invoice lines (Pro).'],
 ex('track-project-deliverables.2.late_report', 'What has slipped on my projects?', pick('track-project-deliverables.2.late_report', ['as_of', 'late_count', 'not_yet_due_count', 'delivered_on_time_count', 'value_at_risk', 'late'], lr),
    'A schedule with three deliverables was set up against quote Q-2026-0014 first. The wireframes were delivered and accepted, and the homepage design is in progress. ' + SHORT),
 ex('track-project-deliverables.3.delivery_schedule_get', 'Show the Harbor Dental schedule.', pick('track-project-deliverables.3.delivery_schedule_get', ['schedule'], dg),
    'The schedule is shown with five of its fields and each deliverable with six, unchanged.'),
 [{'q': 'Which date does it count lateness from?', 'a': 'The as_of date on the call. A report for a past date gives the same answer every time, and a deliverable due on that date is not late yet.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Three open schedules, status changes, the late report and the schedule lookup are free. ' + PRO('Delivery Schedule', 'It adds the plain-text schedule document with a sign-off block for the client, and invoice-ready lines from accepted deliverables.')}])

BL_FREE = {'q': 'What is free, and what does Pro add?', 'a': 'Single-URL link checks and robots checks are free and unlimited, and link_audit takes 3 URLs per call. Nothing is stored, so every check is a fresh fetch. ' + PRO('Backlink Checker', 'It removes the 3 URL limit on link_audit.')}
LIVE = 'Run on 5 November 2026 against live pages, so a later run can differ.'
page('check-backlinks', 'backlink-checker', 'Can Claude check backlinks?', 'Can Claude check backlinks? Verify the links you were promised', 'can claude check backlinks',
 'Partly. Neither Claude nor this server finds new backlinks. The Backlink Checker fetches pages you name and reports status, anchor and nofollow for each link.',
 "Partly, and neither Claude nor this server finds new backlinks for you. That needs a crawler index from an SEO tool. With web search on, Claude can read the text of a page, but that text may not show whether a link is nofollow. Claude Code can fetch the HTML with curl on your machine. Connect the Backlink Checker server (free token) and Claude fetches each referring page you name and reports its HTTP status, every link to your domain with its anchor text, dofollow or nofollow, and any noindex signal.",
 ['Reads the text of a page you point it to, with web search on.', 'Explains dofollow, nofollow and anchor text.'],
 ['Status, anchor and rel for each link, read from the HTML.', 'Several promised links checked in one call.', 'A fresh fetch every time, with nothing cached.'],
 ex('check-backlinks.1.link_audit', 'Check which of these three pages link to modelcontextprotocol.io and how.', text('check-backlinks.1.link_audit'),
    LIVE + ' In this run the Wikipedia and GitHub links came back nofollow.'),
 None,
 [{'q': 'Can it find every site that links to me?', 'a': 'No. It checks pages you already know about. Finding unknown backlinks needs a crawler index from an SEO tool.'}, BL_FREE])

page('check-if-a-link-is-nofollow', 'backlink-checker', 'Can Claude check if a link is nofollow?', 'Can Claude check if a link is nofollow? From the real HTML', 'can claude check if a link is nofollow',
 'Not reliably from page text. The Backlink Checker server fetches the HTML and lists each link to your domain with its anchor and exact rel value.',
 "Not reliably from a chat. The nofollow mark sits in the link's rel attribute in the HTML, and the page text Claude reads with web search may not include it. If you upload or paste the HTML, Claude can read the rel value itself, and Claude Code can fetch it with curl on your machine. Connect the Backlink Checker server (free token) and Claude fetches the page and lists every link to your domain with its anchor text, the exact rel value, and whether the whole page is marked nofollow or noindex.",
 ['Reads the rel value in HTML you upload or paste.', 'Explains nofollow, sponsored and ugc.'],
 ['The rel value of every link to your domain on a live page.', 'The page-level robots signals checked in the same call.', 'A check you can rerun after a site promises a change.'],
 ex('check-if-a-link-is-nofollow.1.link_check', 'Is the Wikipedia link to modelcontextprotocol.io dofollow?', text('check-if-a-link-is-nofollow.1.link_check'), LIVE),
 None,
 [{'q': 'Why does the Wikipedia rel value have two words?', 'a': "Wikipedia's software adds its own mw extlink marker to every external link, next to nofollow. The nofollow part is the value search engines read."}, BL_FREE])

page('check-if-a-page-is-noindexed', 'backlink-checker', 'Can Claude check if a page is noindexed?', 'Can Claude check if a page is noindexed? Meta and header', 'can claude check if a page is noindexed',
 'Not reliably from page text. The Backlink Checker server fetches any URL and reports its status and any noindex or nofollow in the meta tag or header.',
 "Not reliably from a chat. A noindex can sit in a meta robots tag or in an X-Robots-Tag response header, and the page text Claude reads with web search may show neither. Claude Code can fetch the page with curl and read both on your machine. Connect the Backlink Checker server (free token) and Claude fetches any URL and reports its HTTP status, content type, and whether it carries noindex or a page-level nofollow. It reads the page's own signals. For robots.txt rules and whether Google has indexed the page, use Search Console.",
 ['Reads a meta robots tag in HTML you upload or paste.', 'Explains noindex, nofollow and robots.txt.'],
 ['The meta robots tag and X-Robots-Tag header of a live URL.', 'A quick check after a deploy that a page is indexable.', 'The same check on a page that links to you.'],
 ex('check-if-a-page-is-noindexed.1.robots_guard_check', "Is Wikipedia's search page noindexed?", text('check-if-a-page-is-noindexed.1.robots_guard_check'), LIVE),
 ex('check-if-a-page-is-noindexed.2.robots_guard_check', 'And the Model Context Protocol article?', text('check-if-a-page-is-noindexed.2.robots_guard_check'), LIVE),
 [{'q': 'Does noindex mean Google dropped the page?', 'a': 'No. It means the page asks search engines not to index it. Whether Google has indexed it is shown in Search Console.'}, BL_FREE])

page('make-an-inspection-checklist', 'checklist', 'Can Claude make an inspection checklist?', 'Can Claude make an inspection checklist? Runs with sign-off', 'can claude make an inspection checklist',
 'Yes, as a document. The Checklist server also keeps each dated run, who checked each step, the failures and the sign-off.',
 f"Yes, as a document. Claude can write a checklist for a van, a site or a machine, and {CODE[0].lower() + CODE[1:]} it can save it as a file to print. What it does not keep is a record of each time the checklist was run, who ticked what, and who signed. Connect the Checklist server (free token) and Claude stores the checklist, starts a dated run, records pass, fail or not applicable for each step with a name, and blocks sign-off while a required step is failed or unanswered unless you force it, with the exception kept on the record.",
 ['Writes the steps of a checklist for a job.', 'Saves it as a printable file when code execution is on.'],
 ['A dated run per inspection, with who checked each step.', 'Failures kept in full with their notes.', 'A sign-off that freezes the run.'],
 ex('make-an-inspection-checklist.2.run_check', 'Sam says the left rear indicator is out on van 2.', pick('make-an-inspection-checklist.2.run_check', ['answered', 'ready_to_sign_off', 'not_ready_because']),
    'A Van safety check with four steps was created, a run was started for van 2, and the other three steps were answered first. ' + SHORT),
 ex('make-an-inspection-checklist.4.run_report', 'Print the report for this run.', field('make-an-inspection-checklist.4.run_report', 'report'),
    'This is the report field of the answer. The report comes back as text on every tier, and the note about the Pro file option is left out here.'),
 [{'q': 'If I edit the checklist, do old runs change?', 'a': 'No. A run copies the steps when it starts, so what somebody ticked and signed stays as they saw it.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Three checklists with unlimited runs, and the run report as text, are free. ' + PRO('Checklist', 'It also returns the run report as a .txt download file.')}])

SOURCES = {
 'do-bookkeeping': 'can claude do bookkeeping (suggest2, exact)', 'do-month-end-close': 'claude month end close (suggest2, exact)',
 'reconcile-bank-statements': 'can claude reconcile bank statements (suggest2, exact)'}
json.dump({'_readme': ['s1105 W2: /can-claude/<slug>/ live answer pages for paid catalog servers. Generator content/W2_make_live.py, raw calls calls/W2/ (gitignored), checker content/W2_check.py.',
                       'query is the Google autocomplete phrase where one exists (suggest2.txt). Others are constructed: ' + ', '.join(p['slug'] for p in P if p['slug'] not in SOURCES) + '.'],
           'pages': P}, open(OUT, 'w'), indent=1, ensure_ascii=False)
print(len(P), 'pages ->', OUT)
