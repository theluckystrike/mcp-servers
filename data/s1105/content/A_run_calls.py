#!/usr/bin/env python3
"""s1105 A: run the real tools/call sequence for each page against mcp.zovo.one/mcp/<id>/t/<token>.
usage: TOK=... FX=<fixture dir> A_run_calls.py <page-key> [...]   Raw responses -> ~/mcp-servers/data/s1105/calls/A/<page>.<n>.<tool>.json"""
import base64, json, os, sys, urllib.request, urllib.error
TOK = os.environ['TOK']; FX = os.environ['FX']
OUT = os.path.expanduser('~/mcp-servers/data/s1105/calls/A')
b64 = lambda f: base64.b64encode(open(os.path.join(FX, f), 'rb').read()).decode()

class S:
    def __init__(self, sid_):
        self.url = f'https://mcp.zovo.one/mcp/{sid_}/t/{TOK}'; self.sess = None; self.id = 1; self.server = sid_
        self.post({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-03-26', 'capabilities': {}, 'clientInfo': {'name': 's1105-A', 'version': '1'}}})
        try: self.post({'jsonrpc': '2.0', 'method': 'notifications/initialized'})
        except Exception: pass
    def post(self, body):
        h = {'user-agent': 's1105-A/1', 'content-type': 'application/json', 'accept': 'application/json, text/event-stream', 'x-mcp-probe': '1'}
        if self.sess: h['mcp-session-id'] = self.sess
        import time
        for a in range(3):
            try:
                r = urllib.request.urlopen(urllib.request.Request(self.url, data=json.dumps(body).encode(), headers=h), timeout=90); break
            except urllib.error.URLError as e:
                if a == 2 or (getattr(e, 'code', None) or 500) < 500: raise
                time.sleep(8)
        raw = r.read().decode(); self.sess = r.headers.get('mcp-session-id') or self.sess
        if raw.lstrip().startswith('{'): return json.loads(raw)
        for line in raw.splitlines():
            if line.startswith('data:'):
                d = json.loads(line[5:])
                if 'id' in d: return d
        return {'raw': raw}
    def call(self, page, n, tool, args, show=True):
        self.id += 1
        r = self.post({'jsonrpc': '2.0', 'id': self.id, 'method': 'tools/call', 'params': {'name': tool, 'arguments': args}})
        short = {k: (v[:40] + '...' if isinstance(v, str) and len(v) > 200 else v) for k, v in args.items()}
        rec = {'server_id': self.server, 'url_form': '/mcp/<id>/t/<token>', 'tool': tool, 'args': short, 'response': r}
        json.dump(rec, open(f'{OUT}/{page}.{n}.{tool}.json', 'w'), indent=1)
        txt = '\n'.join(c.get('text', '') for c in r.get('result', {}).get('content', []) if c.get('type') == 'text')
        print(f'--- {page}.{n}.{tool} err={r.get("result", {}).get("isError")}\n{txt[:1800] if show else txt[:200]}')
        return r

JOBS = {}
def job(f): JOBS[f.__name__.replace('_', '-')] = f; return f

@job
def edit_pdfs(p):
    s = S('pdf'); s.call(p, 0, 'pdf_upload', {'name': 'contract', 'pdf_base64': b64('contract.pdf')}); s.call(p, 0, 'pdf_upload', {'name': 'annex', 'pdf_base64': b64('annex.pdf')}, False)
    s.call(p, 1, 'pdf_merge', {'paths': ['contract', 'annex'], 'out_path': 'contract-with-annex'})
    s.call(p, 2, 'pdf_pages', {'path': 'contract-with-annex', 'pages': '3-5', 'out_path': 'client-extract'})
@job
def edit_word_documents(p):
    s = S('docx')
    s.call(p, 1, 'doc_read', {'docx_base64': b64('engagement-letter.docx')})
    s.call(p, 2, 'doc_fill_template', {'docx_base64': b64('engagement-letter.docx'), 'values': {'client': 'Harbor Dental', 'start_date': '1 December 2026', 'fee': 'USD 4,800.00'}, 'out_path': 'engagement-harbor-dental'})
CSV = 'Date,Customer,Region,Amount\n2026-10-02,Harbor Dental,East,640\n2026-10-05,Bayline Logistics,West,380\n2026-10-11,Oak Street Cafe,East,1250\n2026-10-19,Northside Gym,West,515\n2026-10-27,Harbor Dental,East,220\n2026-09-28,Bayline Logistics,West,900\n'
@job
def read_excel_files(p):
    s = S('spreadsheet'); s.call(p, 0, 'sheet_load', {'name': 'sales-2026', 'xlsx_base64': b64('sales-2026.xlsx')})
    s.call(p, 1, 'sheet_info', {'path': 'sales-2026'})
    s.call(p, 2, 'sheet_query', {'path': 'sales-2026', 'where': '[Amount] > 500 AND [Date] >= "2026-10-01"', 'sort': {'col': 'Amount', 'dir': 'desc'}})
@job
def edit_excel_files(p):
    s = S('spreadsheet'); s.call(p, 0, 'sheet_load', {'name': 'acme-q3', 'xlsx_base64': b64('acme-q3.xlsx')})
    s.call(p, 1, 'sheet_add_column', {'path': 'acme-q3', 'name': 'VAT', 'formula': '[Net] * 0.2', 'decimals': 2, 'out_path': 'acme-q3-vat'})
    s.call(p, 2, 'sheet_convert', {'path': 'acme-q3-vat', 'to': 'csv'})
@job
def generate_qr_codes(p):
    s = S('barcode'); s.call(p, 1, 'qr_wifi', {'ssid': 'HarborCafe-Guest', 'password': 'latte2026', 'out_path': 'cafe-wifi'})
    s.call(p, 2, 'qr_create', {'text': 'https://www.mcpstamp.com/', 'out_path': 'menu-link'})
@job
def make_barcodes(p):
    s = S('barcode'); s.call(p, 1, 'barcode_create', {'symbology': 'ean13', 'value': '4006381333931', 'out_path': 'sku-4006381333931'})
    s.call(p, 2, 'barcode_create', {'symbology': 'code128', 'value': 'SHELF-B12-0042', 'out_path': 'shelf-b12'})
@job
def edit_images(p):
    s = S('image'); s.call(p, 0, 'image_upload', {'name': 'hero', 'image_base64': b64('hero.jpg')})
    s.call(p, 1, 'image_resize', {'path': 'hero', 'width': 1200, 'out_path': 'hero-1200', 'overwrite': True})
    s.call(p, 2, 'image_compress', {'path': 'hero', 'quality': 70, 'out_path': 'hero-small', 'overwrite': True})
@job
def remove_photo_metadata(p):
    s = S('image'); s.call(p, 0, 'image_upload', {'name': 'front', 'image_base64': b64('front.jpg')})
    s.call(p, 1, 'image_strip_metadata', {'path': 'front', 'out_path': 'front-clean'})
    s.call(p, 2, 'image_info', {'path': 'front-clean'})
@job
def keep_track_of_time(p):
    s = S('time-tracker')
    s.call(p, 1, 'entry_add', {'project': 'harbor-dental-logo', 'task': 'Logo sketches', 'start': '2026-11-04T09:00:00', 'minutes': 150, 'rate': 85, 'currency': 'USD'})
    s.call(p, 0, 'entry_add', {'project': 'harbor-dental-logo', 'task': 'Client revisions', 'start': '2026-11-05T13:30:00', 'minutes': 75, 'rate': 85, 'currency': 'USD'}, False)
    s.call(p, 2, 'report', {'from': '2026-11-02', 'to': '2026-11-08', 'project': 'harbor-dental-logo'})
@job
def zip_files(p):
    s = S('zip')
    s.call(p, 0, 'zip_upload', {'name': 'invoice-0091.pdf', 'content_base64': b64('contract.pdf')}); s.call(p, 0, 'zip_upload', {'name': 'invoice-0092.pdf', 'content_base64': b64('annex.pdf')}, False)
    s.call(p, 0, 'zip_upload', {'name': 'notes.txt', 'content': 'October invoices for Acme. Two files.\n'}, False)
    s.call(p, 1, 'zip_create', {'out_path': 'acme-october', 'paths': ['invoice-0091.pdf', 'invoice-0092.pdf', 'notes.txt']})

PROFILE = {'name': 'Jordan Reyes', 'email': 'jordan.reyes@example.com', 'location': 'Denver, CO', 'summary': 'Marketing coordinator with five years in B2B email and events. I run campaigns end to end and report on pipeline.',
 'skills': ['Email marketing', 'HubSpot', 'Event planning', 'Copywriting', 'Google Analytics', 'Budget tracking'],
 'experience': [{'title': 'Marketing Coordinator', 'company': 'Bayline Logistics', 'start': '2022-03', 'end': 'present', 'bullets': ['Ran 48 email campaigns a year for 3 product lines', 'Planned 6 trade show stands within budget']},
                {'title': 'Marketing Assistant', 'company': 'Oak Street Agency', 'start': '2020-06', 'end': '2022-02', 'bullets': ['Wrote weekly newsletters for 4 clients', 'Kept the campaign calendar for a team of 7']}],
 'education': [{'degree': 'BA Communications', 'school': 'University of Colorado', 'year': '2020'}]}
@job
def make_a_resume(p):
    s = S('resume'); s.call(p, 1, 'profile_set', dict(PROFILE, replace=True))
    s.call(p, 2, 'resume_create', {'target_role': 'Marketing Manager', 'out_path': 'jordan-reyes-resume.docx', 'overwrite': True})
POST = 'Operations Coordinator, Northwind Freight. You will plan events and vendor schedules, track budgets in Excel, write clear email updates, and run reports in Salesforce. Two years of coordination experience. Excel and Salesforce required.'
@job
def write_a_cover_letter(p):
    s = S('resume'); s.call(p, 0, 'profile_set', dict(PROFILE, replace=True), False)
    s.call(p, 1, 'tailor_to_job', {'job_description': POST})
    s.call(p, 2, 'cover_letter_create', {'company': 'Northwind Freight', 'role': 'Operations Coordinator', 'job_description': POST, 'out_path': 'northwind-cover-letter.docx', 'overwrite': True})
def ics(events):
    out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//s1105//A//EN']
    for i, (st, en, t) in enumerate(events):
        out += ['BEGIN:VEVENT', f'UID:a{i}@s1105', 'DTSTAMP:20261105T000000Z', f'DTSTART;TZID=America/Chicago:{st}', f'DTEND;TZID=America/Chicago:{en}', f'SUMMARY:{t}', 'END:VEVENT']
    return '\r\n'.join(out + ['END:VCALENDAR']) + '\r\n'
@job
def find_free_time_in_my_calendar(p):
    s = S('calendar')
    s.call(p, 0, 'ics_import', {'name': 'work', 'text': ics([('20261109T090000', '20261109T103000', 'Client call Harbor Dental'), ('20261109T130000', '20261109T150000', 'Design review'), ('20261110T100000', '20261110T120000', 'Workshop Bayline'), ('20261111T140000', '20261111T150000', 'Weekly team sync')])})
    s.call(p, 0, 'ics_import', {'name': 'family', 'text': ics([('20261109T143000', '20261109T153000', 'Dentist'), ('20261110T160000', '20261110T170000', 'School pickup')])}, False)
    s.call(p, 1, 'free_busy', {'from': '2026-11-09', 'to': '2026-11-11', 'work_start': '09:00', 'work_end': '17:00', 'zone': 'America/Chicago'})
    s.call(p, 2, 'conflicts', {'from': '2026-11-09', 'to': '2026-11-11'})
@job
def track_expenses(p):
    s = S('expense-tracker')
    s.call(p, 1, 'expense_add', {'amount': 86.40, 'currency': 'EUR', 'merchant': 'Office Depot', 'category': 'office', 'note': 'Printer ink', 'date': '2026-11-05', 'vat_rate': 20})
    s.call(p, 0, 'expense_add', {'amount': 24.00, 'currency': 'EUR', 'merchant': 'Adobe', 'category': 'software', 'date': '2026-11-02', 'vat_rate': 20}, False)
    s.call(p, 0, 'expense_add', {'amount': 38.50, 'currency': 'EUR', 'merchant': 'DB Bahn', 'category': 'travel', 'date': '2026-11-03', 'vat_rate': 7}, False)
    s.call(p, 2, 'expense_summary', {'from': '2026-11-01', 'to': '2026-11-30', 'group_by': 'category'})
BANK = 'Date,Description,Amount\n2026-08-03,NETFLIX.COM,-15.49\n2026-08-05,UBER TRIP HELP.UBER.COM,-23.10\n2026-08-14,ADOBE CREATIVE CLOUD,-59.99\n2026-08-15,CLIENT PAYMENT HARBOR DENTAL,1200.00\n2026-09-03,NETFLIX.COM,-15.49\n2026-09-09,WHOLE FOODS MARKET,-86.22\n2026-09-14,ADOBE CREATIVE CLOUD,-59.99\n2026-09-21,UBER TRIP HELP.UBER.COM,-17.85\n2026-10-03,NETFLIX.COM,-15.49\n2026-10-06,UBER TRIP HELP.UBER.COM,-31.40\n2026-10-12,WHOLE FOODS MARKET,-104.67\n2026-10-14,ADOBE CREATIVE CLOUD,-59.99\n2026-10-20,SHELL OIL 5544,-48.30\n2026-10-28,CLIENT PAYMENT BAYLINE,950.00\n'
@job
def categorize_bank_transactions(p):
    s = S('bank-statement'); s.call(p, 0, 'bank_upload', {'name': 'checking-2026', 'content': BANK})
    s.call(p, 0, 'statement_import', {'path': 'checking-2026', 'account': 'checking', 'currency': 'USD', 'overwrite': True})
    s.call(p, 1, 'category_rules', {'rules': [{'match': 'UBER', 'category': 'Transport'}, {'match': 'SHELL', 'category': 'Transport'}, {'match': 'WHOLE FOODS', 'category': 'Groceries'}, {'match': 'NETFLIX', 'category': 'Subscriptions'}, {'match': 'ADOBE', 'category': 'Subscriptions'}], 'reapply_all': True})
    s.call(p, 2, 'statement_summary', {'from': '2026-10-01', 'to': '2026-10-31', 'group_by': 'category'})
@job
def find_recurring_subscriptions(p):
    s = S('bank-statement'); s.call(p, 0, 'bank_upload', {'name': 'checking-2026', 'content': BANK})
    s.call(p, 0, 'statement_import', {'path': 'checking-2026', 'account': 'checking', 'currency': 'USD', 'overwrite': True})
    s.call(p, 1, 'recurring_detect', {'months': 4, 'min_occurrences': 3})
@job
def calculate_loan_payments(p):
    s = S('amortization')
    r = s.call(p, 1, 'loan_create', {'name': 'Equipment loan', 'principal_minor': 2500000, 'currency': 'USD', 'rate_bps': 750, 'compounding': 'monthly', 'payment_frequency': 'monthly', 'term_periods': 48, 'method': 'annuity', 'start_date': '2026-12-01'})
    s.call(p, 2, 'loan_schedule', {'loan': 'Equipment loan', 'limit': 3})
@job
def track_prices(p):
    s = S('price-tracker')
    s.call(p, 1, 'price_check', {'url': os.environ.get('PURL', 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html')})
    s.call(p, 2, 'watch_add', {'url': os.environ.get('PURL', 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html'), 'label': 'A Light in the Attic', 'target_price': 45})
@job
def schedule_recurring_invoices(p):
    s = S('recurring')
    s.call(p, 1, 'schedule_create', {'client': 'Harbor Dental', 'items': [{'description': 'Website hosting and care plan', 'quantity': 1, 'unit_price': 350}], 'currency': 'USD', 'every': 'monthly', 'start_date': '2026-12-01', 'due_days': 14})
    s.call(p, 2, 'schedule_upcoming', {'days': 90})

if __name__ == '__main__':
    for k in sys.argv[1:]: JOBS[k](k)
