import json, urllib.request, urllib.parse, time, os
seeds = ["can claude create invoices","can claude make invoices","can claude make an invoice","can claude create an invoice","claude invoice","claude invoicing","claude invoice generator","claude invoices","claude bookkeeping","can claude do bookkeeping","can claude do accounting","claude accounting","claude accounts payable","claude accounts receivable","claude ap automation","claude time tracking","can claude track time","claude timesheet","mcp server invoice","mcp server invoicing","mcp server accounting","mcp server bookkeeping","mcp server quickbooks","chatgpt reconcile","can chatgpt reconcile bank statements","can chatgpt create invoices","can chatgpt do bookkeeping","chatgpt invoice","can claude reconcile","can claude make a quote","can claude write an estimate","claude estimate","claude quote","can claude do payroll","claude payroll","can claude make receipts","claude receipt","claude expense","can claude track expenses","claude mileage","claude bank statement","can claude read bank statements","claude purchase order","can claude create purchase orders","claude work order","claude credit note","claude statement of account","claude three way match","chatgpt three way match","claude duplicate invoices","claude supplier statement reconciliation","claude vendor statement","claude depreciation","can claude calculate depreciation","claude fixed asset register","claude petty cash","claude cash book","claude leave tracker","claude pto tracker","claude employee onboarding","can claude do my books","can claude do my accounting","claude for small business accounting","claude overdue invoices","claude payment reminder","claude dunning","chatgpt payment reminder letter","claude budget","can claude make a budget","claude job card","claude inventory","claude aging report","chatgpt aging report","claude cash flow","claude general ledger","claude journal entries","can claude do journal entries","claude month end close","claude xero","claude quickbooks"]
seeds = seeds[:80]
out = {}
for s in seeds:
    u = 'https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=' + urllib.parse.quote(s)
    try:
        r = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=15).read().decode('utf-8', 'replace'))
        out[s] = r[1]
    except Exception as e:
        out[s] = ['ERR ' + str(e)[:60]]
    time.sleep(0.5)
d = os.path.expanduser('~/mcp-servers/data/s1105')
json.dump(out, open(d + '/suggest2.json', 'w'), indent=1)
lines = []
for s, v in out.items():
    lines.append('# ' + s)
    lines += v
open(d + '/suggest2.txt', 'w').write('\n'.join(lines) + '\n')
print(len(seeds), 'requests', sum(1 for v in out.values() if v and v[0].startswith('ERR')), 'errors')
