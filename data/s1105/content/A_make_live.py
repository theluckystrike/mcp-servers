#!/usr/bin/env python3
"""s1105 A: build content/A-live.json (can-claude-live.json schema) from the raw calls in ~/mcp-servers/data/s1105/calls/A/.
Raw calls were made by A_run_calls.py on 2026-11-05 through https://mcp.zovo.one/mcp/<id>/t/<token> with one free token.
Results are the server's own text. Only two edits are made, both stated in each note when they apply.
(1) The 'Free tier ... Pro ...' footer line is dropped because it carries the token. (2) One-hour download links are shown as <download link>."""
import glob, json, os, re
CALLS = os.path.expanduser('~/mcp-servers/data/s1105/calls/A')
OUT = os.path.expanduser('~/mcp-servers/data/s1105/content/A-live.json')
RUN = '2026-11-05'

def raw(page, n):
    f = glob.glob(f'{CALLS}/{page}.{n}.*.json')
    assert len(f) == 1, (page, n, f)
    return json.load(open(f[0]))

def text(page, n, check=True):
    r = raw(page, n)['response']['result']
    assert not r.get('isError'), (page, n)
    t = '\n'.join(c['text'] for c in r['content'] if c.get('type') == 'text')
    t = '\n'.join(l for l in t.splitlines() if not l.startswith('Free tier: 600 calls/hour'))
    t = re.sub(r'https://mcp\.zovo\.one/mcp/download/[0-9a-f]+', '<download link>', t)
    assert not check or 'anon_' not in t, (page, n)
    return t.strip()

def pick(page, n, keys, sub=None):
    d = json.loads(text(page, n, False))
    if sub: d = sub(d)
    out = json.dumps({k: d[k] for k in keys}, ensure_ascii=False)
    assert 'anon_' not in out, (page, n)
    return out

def ex(page, n, prompt, result, note='', args=None):
    r = raw(page, n)
    a = dict(args if args is not None else r['args'])
    return {'prompt': prompt, 'tool': r['tool'], 'args': a, 'result': result, 'note': note, 'is_error': False, 'run': RUN}

LINK = 'Download links last one hour, so they are shown here as <download link>.'
JSONNOTE = 'The server answers in JSON. These fields are unchanged.'
HOSTED = 'On the hosted server your files and records are kept for your token for 30 days, refreshed on every write. Install the server locally if you want nothing to leave your machine.'
P = []
def page(slug, repo, h1, title, query, answer, native, needs, e1, e2, faq):
    P.append({'slug': slug, 'repo': repo, 'server_id': repo, 'h1': h1, 'title': title, 'query': query, 'answer': answer,
              'native': native, 'needs': needs, 'example': e1, **({'example2': e2} if e2 else {}), 'faq': faq})

page('edit-pdfs', 'pdf', 'Can Claude edit PDFs?', 'Can Claude edit PDFs? Merge, split and stamp pages', 'can claude edit pdfs',
 "Partly. Claude reads PDFs well, but in most apps it cannot hand back a changed PDF on its own. Claude.ai with code execution on can run a script on an uploaded PDF in its sandbox, and Claude Code can run one on your disk. Connect the PDF server (free token) and Claude merges, splits, reorders, rotates and stamps pages as named tools, and every tool writes a new file. Rewriting the words inside a PDF is a different job. Edit the source document and export it again.",
 ['Reads the text of a PDF you attach and summarizes it.', 'Tells you which pages to pull out or reorder.'],
 ['Merging several PDFs into one in a set order.', 'Pulling page ranges into a new file, splitting, rotating and reordering.', 'Stamping PAID or DRAFT, with the original left unchanged.'],
 ex('edit-pdfs', 1, 'Merge contract.pdf and annex.pdf into one file, contract first.', text('edit-pdfs', 1), 'Both PDFs were uploaded with pdf_upload first. ' + LINK),
 ex('edit-pdfs', 2, 'Now take pages 3 to 5 of the merged file as a separate PDF for the client.', text('edit-pdfs', 2), LINK),
 [{'q': 'Can it change the text inside a PDF?', 'a': 'No. The PDF server works on whole pages. It merges, splits, reorders, rotates and stamps. To change wording, edit the Word or source file and export a new PDF.'},
  {'q': 'What is free?', 'a': 'Page tools run on the free tier. A merge takes up to 5 files on the free tier. ' + HOSTED}])

page('edit-word-documents', 'docx', 'Can Claude edit Word documents?', 'Can Claude edit Word documents? Fill a .docx template', 'can claude edit word documents',
 "Partly. Claude reads a Word file you attach and can rewrite its text, but in most apps you paste the new text back into Word yourself. Claude.ai with code execution on can write a changed .docx in its sandbox, and Claude Code can run a script on your disk. Connect the Word server (free token) and Claude reads a .docx and fills {{placeholders}} in your own template, so your fonts and layout stay as they were. It also tells you which placeholders it left empty.",
 ['Reads and rewrites the text of a document you attach.', 'Drafts letters, clauses and summaries as plain text.'],
 ['A real .docx written in your own template layout.', 'A list of filled and unfilled placeholders before you send.', 'The text and outline of an existing .docx, read from the file.'],
 ex('edit-word-documents', 1, 'Read my engagement letter template and list the placeholders.', text('edit-word-documents', 1), 'The template was sent as base64 in the call.', {'docx_base64': '<engagement-letter.docx, base64>'}),
 ex('edit-word-documents', 2, 'Fill it for Harbor Dental, start date 1 December 2026, fee USD 4,800.00.', text('edit-word-documents', 2),
    'I left {{signer}} out on purpose. The server names it as unfilled instead of guessing. ' + LINK,
    {**raw('edit-word-documents', 2)['args'], 'docx_base64': '<engagement-letter.docx, base64>'}),
 [{'q': 'Does it keep my formatting?', 'a': 'Yes. It replaces the placeholder text inside your own .docx and writes a new file, so styles, fonts and headers stay as they were.'},
  {'q': 'What is free?', 'a': 'Reading documents and filling templates with up to 10 placeholders. ' + HOSTED}])

page('read-excel-files', 'spreadsheet', 'Can Claude read Excel files?', 'Can Claude read Excel files? Yes, and query them', 'can claude read excel files',
 "Yes in the Claude app with code execution on. Claude.ai reads an uploaded .xlsx or CSV and can analyze it in its sandbox, and Claude Code can read a file on your disk with a script. Apps without code execution only see what you paste. Connect the Spreadsheet server (free token) and any MCP app can list the sheets and columns of a workbook, filter and sort rows with a query, search every cell and get per-column stats.",
 ['Explains formulas and what a table means.', 'Reads a small table you paste into the chat.'],
 ['Every sheet, column and type in an .xlsx, without pasting.', 'Filters and sorts that run on the real rows.', 'The same query again next month on the new file.'],
 ex('read-excel-files', 1, 'What is in sales-2026.xlsx?', pick('read-excel-files', 1, ['file', 'format', 'sheets'], lambda d: {**d, 'sheets': [{'name': s['name'], 'dimensions': s['dimensions'], 'columns': [c['name'] + ' (' + c['type'] + ')' for c in s['columns']]} for s in d['sheets']]}),
    'The workbook was loaded with sheet_load first. ' + JSONNOTE + ' Each column is shown with its name and type, and the sample values are left out.'),
 ex('read-excel-files', 2, 'List the October orders over 500, largest first.', text('read-excel-files', 2)),
 [{'q': 'Which files does it read?', 'a': 'xlsx, xlsm, xlsb, ods, csv and tsv.'},
  {'q': 'What is free?', 'a': 'Reading, querying and stats. The hosted server holds up to 2 MB of loaded sheets per token. ' + HOSTED}])

page('edit-excel-files', 'spreadsheet', 'Can Claude edit Excel files?', 'Can Claude edit Excel files? Yes, as a new copy', 'can claude edit excel files',
 "Partly. Claude.ai with code execution on can change an uploaded spreadsheet in its sandbox and give you a download, and Claude Code can run a script on your disk. Each time it is a new script. Connect the Spreadsheet server (free token) and Claude adds a computed column, writes rows and converts between xlsx, CSV and JSON as named tools. The result is always a new file, so the original workbook stays as it was.",
 ['Writes the formula you need and explains it.', 'Plans the columns of a new sheet.'],
 ['A computed column added to the real rows.', 'Conversion between xlsx, CSV and JSON.', 'A new file every time, never an overwrite of the source.'],
 ex('edit-excel-files', 1, 'Add a VAT column at 20 percent of Net to acme-q3.xlsx.', text('edit-excel-files', 1), 'The workbook was loaded with sheet_load first. ' + LINK),
 ex('edit-excel-files', 2, 'Save that as a CSV for the import.', text('edit-excel-files', 2), LINK),
 [{'q': 'Does it keep my other sheets?', 'a': 'sheet_write keeps the other sheets of a workbook. A CSV export holds one sheet only.'},
  {'q': 'What is free?', 'a': 'Adding columns and converting. sheet_write writes up to 500 rows per file on the free tier. ' + HOSTED}])

page('generate-qr-codes', 'barcode', 'Can Claude generate QR codes?', 'Can Claude generate QR codes? WiFi, links, contacts', 'can claude generate qr codes',
 "Not in most apps on its own. Without code execution Claude can only describe a QR code. Claude.ai with code execution on can sometimes draw one in its sandbox if a QR library is available, and Claude Code can install one. Connect the Barcode server (free token) and Claude writes QR codes for a link, a WiFi login, a contact card or a euro payment, and keeps a list of every code it made.",
 ['Writes the text or URL the code should carry.', 'Explains error correction and print size.'],
 ['A real QR image a phone camera can scan.', 'WiFi, vCard and SEPA payment formats built to the standard.', 'Many codes at once from a list.'],
 ex('generate-qr-codes', 1, 'Make a QR code that joins the HarborCafe-Guest WiFi with password latte2026.', text('generate-qr-codes', 1), LINK + ' Scan a printed code with two phones before you put it on a sign.'),
 ex('generate-qr-codes', 2, 'And one that opens our menu page.', text('generate-qr-codes', 2), LINK),
 [{'q': 'Is SVG or PNG free?', 'a': 'SVG is free and scales to any print size. PNG output is Pro.'},
  {'q': 'Do these codes expire?', 'a': 'No. The code holds the text itself, with no redirect, so it works as long as the link or network inside it works.'}])

page('make-barcodes', 'barcode', 'Can Claude make barcodes?', 'Can Claude make barcodes? EAN-13 and Code 128', 'can claude make barcodes',
 "Not in most apps on its own. Claude can tell you which barcode type to use, but without code execution it cannot draw one. Claude.ai with code execution on may draw one in its sandbox if a library is there. Connect the Barcode server (free token) and Claude draws EAN-13, EAN-8, UPC-A and Code 128 barcodes as SVG, checks the digits, and can make many at once from a list.",
 ['Explains EAN, UPC and Code 128 and when to use each.', 'Works out a check digit by hand, with some risk of error.'],
 ['A scannable barcode image with the right quiet zone.', 'A digit check before anything is printed.', 'Labels for a whole product list in one call.'],
 ex('make-barcodes', 1, 'Draw an EAN-13 barcode for 4006381333931.', text('make-barcodes', 1), LINK),
 ex('make-barcodes', 2, 'And a Code 128 shelf label for SHELF-B12-0042.', text('make-barcodes', 2), LINK),
 [{'q': 'Do I need a GS1 number for EAN-13?', 'a': 'To sell in retail, yes. The server draws any valid number, but the number itself must come from GS1 or your supplier.'},
  {'q': 'Is it free?', 'a': 'SVG barcodes are free. PNG output is Pro.'}])

page('edit-images', 'image', 'Can Claude edit images?', 'Can Claude edit images? Resize, crop and compress', 'can claude edit images',
 "Not with AI retouching. Claude can look at an image and describe it, but it does not repaint or retouch photos. Claude.ai with code execution on can resize or crop an uploaded image in its sandbox, and Claude Code can run an image script on your disk. Connect the Image server (free token) and Claude resizes, crops, compresses, converts and watermarks image files as named tools, and every tool writes a new copy.",
 ['Describes what is in an image and suggests a crop.', 'Tells you which size and format a site needs.'],
 ['A resized, cropped or compressed copy of the real file.', 'Conversion between PNG, JPEG, GIF, BMP and TIFF.', 'The same resize for a whole batch of photos.'],
 ex('edit-images', 1, 'Resize hero.jpg to 1200 pixels wide.', text('edit-images', 1), 'The photo was uploaded with image_upload first. ' + LINK),
 ex('edit-images', 2, 'Now compress the full-size hero.jpg at JPEG quality 70.', text('edit-images', 2), LINK + ' A smooth test image like this one gains less from compression than a busy photo.'),
 [{'q': 'Can it remove objects or fix faces?', 'a': 'No. It does file edits only. Resize, crop, compress, convert, thumbnails and text watermarks.'},
  {'q': 'What is free?', 'a': 'Resizing works on sources up to 4 megapixels on the free tier. ' + HOSTED}])

page('remove-photo-metadata', 'image', 'Can Claude remove metadata from photos?', 'Can Claude remove metadata from photos? EXIF and GPS', 'can claude remove metadata from photos',
 "Not on its own in most apps. A phone photo can carry the camera, the time and the GPS position where it was taken. Claude.ai with code execution on can re-save an uploaded photo in its sandbox, and Claude Code can run exiftool if you have it. Connect the Image server (free token) and Claude writes a copy that carries the pixels and nothing else, then shows you the clean file's details.",
 ['Explains what EXIF and GPS data are.', 'Tells you which apps strip metadata when you share.'],
 ['A clean copy with no camera, date or GPS block.', 'A check of the new file before you post it.', 'The original left unchanged.'],
 ex('remove-photo-metadata', 1, 'Strip all metadata from front.jpg before I post it.', text('remove-photo-metadata', 1), 'The test photo carried a camera name, a capture time and GPS coordinates. It was uploaded with image_upload first. ' + LINK),
 ex('remove-photo-metadata', 2, 'Show me the details of the clean copy.', text('remove-photo-metadata', 2)),
 [{'q': 'Why did the clean file get bigger?', 'a': 'The copy is re-encoded from the pixels, and the encoder settings differ from the camera. The server says so and keeps the original.'},
  {'q': 'Does the photo leave my computer?', 'a': 'On the hosted server, yes, it is uploaded under your token. Install the Image server locally to strip metadata on your own machine.'}])

page('keep-track-of-time', 'time-tracker', 'Can Claude keep track of time?', 'Can Claude keep track of time? Timers and timesheets', 'can claude keep track of time',
 "Not by itself. Claude does not run a clock between your messages, so it cannot tell you how long you worked unless you give it the times. Claude.ai memory can recall context, but it is not a timesheet you can total. Connect the Time Tracker server (free token) and Claude starts and stops a timer, logs past work as entries, sets an hourly rate per project and totals hours and money for any period.",
 ['Adds up hours you type in.', 'Plans your week in time blocks.'],
 ['A real timer that keeps running between messages.', 'Saved entries with rate and amount.', 'A weekly or monthly total per project, ready for an invoice.'],
 ex('keep-track-of-time', 1, 'Log 2.5 hours of logo sketches for Harbor Dental yesterday from 9 am, at 85 USD an hour.', text('keep-track-of-time', 1)),
 ex('keep-track-of-time', 2, "What are this week's billable hours for that project?", text('keep-track-of-time', 2), 'A second entry of 1.25 hours was logged before this report.'),
 [{'q': 'Does the timer run if I close the chat?', 'a': 'Yes. timer_start saves the start time on the server, and timer_stop works it out later, in a new chat or another app.'},
  {'q': 'Can it turn hours into an invoice?', 'a': 'invoice_summary turns billable hours into invoice lines, and entry_mark_billed stamps them so they are not billed twice.'}])

page('zip-files', 'zip', 'Can Claude zip files?', 'Can Claude zip files? Pack an archive in chat', 'can claude zip files',
 "Not in most apps on its own. A chat app without code execution cannot write a .zip file. Claude.ai with code execution on can zip files you upload, and Claude Code can run the zip command on your disk. Connect the Zip server (free token) and Claude packs files into a new archive, adds files to an existing one and bundles a month of invoices, with entry names kept safe to unpack.",
 ['Tells you which files to include.', 'Explains zip, tar and compression ratios.'],
 ['A real .zip with a download link.', 'Adding files to an archive you already have.', 'A history of the archives it made.'],
 ex('zip-files', 1, 'Zip the two October invoices and notes.txt into acme-october.zip.', text('zip-files', 1), 'The three files were uploaded with zip_upload first. ' + LINK),
 None,
 [{'q': 'Can it open zip files too?', 'a': 'Yes. See the page on reading zip files. It lists entries, reads one text file and unpacks safely.'},
  {'q': 'Is it free?', 'a': 'Creating and listing archives is free. ' + HOSTED}])

page('make-a-resume', 'resume', 'Can Claude make a resume?', 'Can Claude make a resume? Yes, as a real .docx', 'can claude make a resume',
 "Yes for the text. Claude writes and improves resume wording in any app. Claude.ai with code execution on can also save a .docx in its sandbox. What a chat does not keep is your profile, so every new version starts from pasted text. Connect the Resume server (free token) and Claude stores one profile and writes it as a Word .docx, HTML or markdown, ordered for the role you name.",
 ['Rewrites bullets and summaries.', 'Suggests what to cut for a one-page resume.'],
 ['A saved profile that every resume and cover letter uses.', 'A real .docx, HTML or markdown file from that profile.', 'Bullets ranked for a target role and trimmed to fit.'],
 ex('make-a-resume', 1, 'Save my profile from these details.', text('make-a-resume', 1), 'The profile is an invented example.', {'name': 'Jordan Reyes', 'skills': '<6 skills>', 'experience': '<2 roles>', 'education': '<1 entry>', 'replace': True}),
 ex('make-a-resume', 2, 'Write my resume for a Marketing Manager role.', pick('make-a-resume', 2, ['path', 'style', 'estimated_pages', 'words_used', 'bullets_kept']), JSONNOTE + ' ' + LINK),
 [{'q': 'Can it read my old resume?', 'a': 'Yes. resume_read reads an existing .docx resume into the profile shape.'},
  {'q': 'What is free?', 'a': 'The modern style with a footer credit, and unlimited resumes. Other styles and named variants are Pro.'}])

page('write-a-cover-letter', 'resume', 'Can Claude write a cover letter?', 'Can Claude write a cover letter? Checked against the job', 'can claude write a cover letter',
 "Yes for the text. Claude writes a good cover letter from a job post you paste. It also tends to fill gaps with claims you never made. Connect the Resume server (free token) and Claude first checks the posting against your saved profile, then writes a one-page Word letter that states only facts from that profile and leaves a bracketed prompt where it needs more.",
 ['Writes a cover letter from a pasted job post.', 'Suggests a tone and an opening line.'],
 ['A keyword check of the posting against your real profile.', 'A one-page .docx letter with no invented facts.', 'The same profile for every application.'],
 ex('write-a-cover-letter', 1, 'Here is the Operations Coordinator posting at Northwind Freight. What do I match and miss?', pick('write-a-cover-letter', 1, ['matched', 'missing', 'coverage', 'advice']), JSONNOTE + ' The profile and posting are invented examples.', {'job_description': '<the posting, 240 characters>'}),
 ex('write-a-cover-letter', 2, 'Write the cover letter.', pick('write-a-cover-letter', 2, ['path', 'words', 'fills_required', 'number_check', 'note']), JSONNOTE + ' ' + LINK, {'company': 'Northwind Freight', 'role': 'Operations Coordinator', 'job_description': '<the posting>'}),
 [{'q': 'Will it add skills I do not have?', 'a': 'No. Missing keywords come back as a warning. You add a skill to the profile only if it is true.'},
  {'q': 'What is free?', 'a': 'Three cover letters a month and the gap check. Resumes stay unlimited.'}])

page('find-free-time-in-my-calendar', 'calendar', 'Can Claude find free time in my calendar?', 'Can Claude find free time in my calendar? From .ics', 'can claude find free time in my calendar',
 "Partly. Claude.ai has a Google Calendar connector that can read your events. For an Outlook or iCloud export, or any .ics file, Claude needs code execution to parse it, and it starts again in the next chat. Connect the Calendar server (free token) and Claude imports .ics files under a name, merges them, lists free gaps inside your working hours and finds double bookings.",
 ['Reads events you paste as text.', 'Suggests how to block focus time.'],
 ['Free gaps across several calendars at once.', 'Double bookings between work and family calendars.', 'Recurring events expanded to real dates.'],
 ex('find-free-time-in-my-calendar', 1, 'Where am I free Monday to Wednesday next week, 9 to 5 Chicago time?', text('find-free-time-in-my-calendar', 1), 'A work and a family .ics were imported with ics_import first. The events are invented.'),
 ex('find-free-time-in-my-calendar', 2, 'Do any events clash?', text('find-free-time-in-my-calendar', 2), 'The server lists clash times in UTC. 7 pm UTC is 1 pm in Chicago.'),
 [{'q': 'Does it change my calendar?', 'a': 'No. It reads a copy of the .ics you give it. event_export writes chosen events to a new .ics.'},
  {'q': 'What is free?', 'a': 'Two imported calendars. ' + HOSTED}])

page('track-expenses', 'expense-tracker', 'Can Claude track expenses?', 'Can Claude track expenses? A saved ledger with VAT', 'can claude track expenses',
 "Not on its own. Claude can sort a list of expenses you paste, but it keeps no ledger you can total next month. Claude.ai with code execution on can total an uploaded sheet, and Claude Code can append to a file. Connect the Expense Tracker server (free token) and Claude records each expense with its net and VAT split, category and project, attaches receipts and totals any date range.",
 ['Sorts a pasted list into categories.', 'Explains which costs are usually deductible.'],
 ['A saved record of every expense with its VAT split.', 'Totals by category, project, month or merchant.', 'Rebillable costs turned into invoice lines.'],
 ex('track-expenses', 1, 'Log 86.40 EUR at Office Depot today for printer ink, 20 percent VAT.', text('track-expenses', 1)),
 ex('track-expenses', 2, "Show this month's totals by category.", text('track-expenses', 2), 'Two more expenses were logged before this summary.'),
 [{'q': 'Can it read my receipts?', 'a': 'receipt_attach stores the receipt file with the expense. You give the amount yourself, and Claude can read it from a receipt photo first.'},
  {'q': 'Can I export it?', 'a': 'Yes. expense_export writes CSV, xlsx or JSON.'}])

page('categorize-bank-transactions', 'bank-statement', 'Can Claude categorize bank transactions?', 'Can Claude categorize bank transactions? Rules that stick', 'can claude categorize bank transactions',
 "Partly. Claude.ai with code execution on can read an uploaded bank CSV and label the rows. The rules live in that chat, so next month you start again. Connect the Bank Statement server (free token) and Claude imports the CSV into a ledger, applies your saved category rules and totals spending by category or month.",
 ['Labels transactions you paste.', 'Suggests a set of budget categories.'],
 ['Saved rules that apply to every new statement.', 'Totals by category or month from the real rows.', 'Recurring charges found across months.'],
 ex('categorize-bank-transactions', 1, 'Uber and Shell are Transport, Whole Foods is Groceries, Netflix and Adobe are Subscriptions.', text('categorize-bank-transactions', 1), 'A test CSV with 14 rows from August to October was uploaded and imported first.'),
 ex('categorize-bank-transactions', 2, 'Show October spending by category.', text('categorize-bank-transactions', 2), 'The client payment has no rule, so it stays uncategorised.'),
 [{'q': 'Which banks work?', 'a': 'Any bank CSV. The import reads the headers to find the date, description and amount columns.'},
  {'q': 'What is free?', 'a': 'Five category rules and the last 12 months of transactions. ' + HOSTED}])

page('find-recurring-subscriptions', 'bank-statement', 'Can Claude find my subscriptions?', 'Can Claude find my subscriptions? From a bank CSV', 'can claude find my subscriptions',
 "Partly. Claude can spot repeat charges in a statement you paste or upload, but it can miss ones with small date shifts. Connect the Bank Statement server (free token) and Claude groups debits by who was paid, checks for a steady amount and cadence, and gives the next expected date and a yearly figure for each recurring charge.",
 ['Spots repeat names in a pasted list.', 'Suggests which subscriptions to cancel.'],
 ['Recurring charges found from the real dates and amounts.', 'The next expected date for each one.', 'A yearly figure for each charge.'],
 ex('find-recurring-subscriptions', 1, 'Which charges in my checking account come back every month, three times or more?', pick('find-recurring-subscriptions', 1, ['months', 'debits_examined', 'recurring', 'charges', 'note']),
    JSONNOTE + ' The test CSV had Netflix on the 3rd and Adobe on the 14th, but the free tier window started on 5 August, so only two Netflix charges fell inside it.', {'months': 4, 'min_occurrences': 3}),
 None,
 [{'q': 'Why was Netflix not listed?', 'a': 'The free tier reads the last 3 months. Only two Netflix charges fell in that window, and the call asked for three. With min_occurrences 2 it would show.'},
  {'q': 'What is free?', 'a': 'The last 3 months and up to 5 recurring charges. The full history is Pro.'}])

page('calculate-loan-payments', 'amortization', 'Can Claude calculate loan payments?', 'Can Claude calculate loan payments? Full schedule', 'can claude calculate loan payments',
 "Yes, with care. Claude knows the payment formula, but long text math can slip by a few cents or worse. Claude.ai with code execution on can run the numbers in its sandbox. Connect the Amortization server (free token) and Claude stores the loan, returns the exact level payment and effective annual rate, and builds the period by period schedule of interest and principal.",
 ['Explains how an amortizing loan works.', 'Gives a rough payment for a quick check.'],
 ['The exact payment, total interest and effective rate.', 'A schedule row for every period, closing at zero.', 'A saved register of your loans.'],
 ex('calculate-loan-payments', 1, 'Record a 25,000 USD equipment loan at 7.5 percent over 48 months from 1 December 2026.', pick('calculate-loan-payments', 1, ['payment', 'first_payment_date', 'final_payment_date', 'total_payments', 'total_interest'], lambda d: {**d, **{'payment': d['created']['payment']}}), JSONNOTE),
 ex('calculate-loan-payments', 2, 'Show the first three rows of the schedule.', json.dumps([{k: r[k] for k in ('period', 'date', 'opening', 'payment', 'interest', 'principal', 'closing')} for r in json.loads(text('calculate-loan-payments', 2, False))['rows']]), JSONNOTE + ' The minor-unit copies of each figure are left out.'),
 [{'q': 'Does it handle leases and balloons?', 'a': 'Yes. loan_create takes a balloon or residual value, fees and straight-principal as well as level payments.'},
  {'q': 'What is free?', 'a': 'Three loans with schedules. Early repayment, journals and the debt report are Pro.'}])

page('track-prices', 'price-tracker', 'Can Claude track prices?', 'Can Claude track prices? A watch list with history', 'can claude track prices',
 "Not on its own. With web search on, Claude can find a price once, but it keeps no dated price history to compare later. Connect the Price Tracker server (free token) and Claude reads a product page, adds it to a watch list with a target price, stores every check and tells you what dropped. Checks run when you ask. Nothing polls in the background.",
 ['Finds a current price with web search.', 'Compares two products you name.'],
 ['A stored price history for each item.', 'A target price and a list of items that reached it.', 'One refresh of the whole list in a single call.'],
 ex('track-prices', 1, 'What does this book cost right now?', text('track-prices', 1), 'books.toscrape.com is a public practice shop. Low confidence means the price came from a text match, not from structured data on the page.'),
 ex('track-prices', 2, 'Watch it and tell me when it is 45 or less.', text('track-prices', 2)),
 [{'q': 'Does it check prices every day?', 'a': 'No. It checks when you ask. Say refresh my watches at the start of a session, then alerts_pending lists the drops.'},
  {'q': 'What if a shop blocks it?', 'a': 'price_add_manual stores a price you read yourself, so the history stays complete.'}])

page('schedule-recurring-invoices', 'recurring', 'Can Claude schedule recurring invoices?', 'Can Claude schedule recurring invoices? Yes, with a tool', 'can claude schedule recurring invoices',
 "Not alone. Claude does not wake up on the first of the month, and it keeps no billing schedule or invoice numbers between chats. Connect the Recurring server (free token) and Claude stores a client, line items and cadence for each repeating invoice, lists what falls due, and creates a numbered invoice in the Invoice server for each due period when you ask.",
 ['Drafts an invoice when you ask.', 'Works out billing dates by hand.'],
 ['A saved schedule per client with cadence and due days.', 'A list of what falls due in the next weeks.', 'Real numbered invoices for every due period.'],
 ex('schedule-recurring-invoices', 1, 'Bill Harbor Dental 350 USD for hosting on the 1st of each month from December, due in 14 days.', text('schedule-recurring-invoices', 1)),
 ex('schedule-recurring-invoices', 2, 'What is due in the next 90 days?', pick('schedule-recurring-invoices', 2, ['as_of', 'count', 'totals_per_currency'], None) [:-1] + ', "occurrences": ' + json.dumps([{k: o[k] for k in ('due_date', 'client', 'amount', 'invoice_due')} for o in json.loads(text('schedule-recurring-invoices', 2, False))['occurrences']]) + '}', JSONNOTE),
 [{'q': 'Does it send the invoices?', 'a': 'No. invoice_generate_due creates them in the Invoice server. You send the PDF yourself.'},
  {'q': 'What is free?', 'a': 'Three active schedules. Billing on a fixed day of the month is Pro.'}])

json.dump({'pages': P}, open(OUT, 'w'), indent=1, ensure_ascii=False)
print(len(P), 'pages ->', OUT)
