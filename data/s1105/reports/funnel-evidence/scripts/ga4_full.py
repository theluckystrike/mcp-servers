import json, sys
sys.argv=['x']
exec(open('/private/tmp/claude-501/-Users-mike/45fe5236-4e4e-45a6-a3ad-cec4f85b961e/scratchpad/scripts/ga4_report.py').read().split("tok = token()")[0])
tok = token()
DR=[{'startDate':'14daysAgo','endDate':'today'}]
def tbl(title, body):
    st, r = run(tok, body)
    print('###', title, 'HTTP', st)
    if isinstance(r, str): print(r); return
    rows=r.get('rows',[]) 
    for row in rows:
        print(' | '.join([d['value'] for d in row['dimensionValues']] + [m['value'] for m in row['metricValues']]))
    print('rows:', len(rows), 'totals:', [[m['value'] for m in t['metricValues']] for t in r.get('totals',[])])
    json.dump(r, open('/private/tmp/claude-501/-Users-mike/45fe5236-4e4e-45a6-a3ad-cec4f85b961e/scratchpad/ga4_'+title.split()[0]+'.json','w'))
tbl('events eventName,eventCount,totalUsers', {'dateRanges':DR,'dimensions':[{'name':'eventName'}],'metrics':[{'name':'eventCount'},{'name':'totalUsers'}],'orderBys':[{'metric':{'metricName':'eventCount'},'desc':True}],'limit':100})
tbl('daily date,sessions,users,begin_checkout,purchase', {'dateRanges':DR,'dimensions':[{'name':'date'}],'metrics':[{'name':'sessions'},{'name':'totalUsers'},{'name':'keyEvents'},{'name':'ecommercePurchases'}],'orderBys':[{'dimension':{'dimensionName':'date'}}]})
tbl('beginco date,eventCount', {'dateRanges':DR,'dimensions':[{'name':'date'},{'name':'eventName'}],'metrics':[{'name':'eventCount'}],'dimensionFilter':{'filter':{'fieldName':'eventName','inListFilter':{'values':['begin_checkout','purchase','support_click','generate_lead','add_to_cart']}}},'orderBys':[{'dimension':{'dimensionName':'date'}}]})
tbl('bcpages pagePath,eventName,eventCount', {'dateRanges':DR,'dimensions':[{'name':'pagePath'},{'name':'eventName'}],'metrics':[{'name':'eventCount'}],'dimensionFilter':{'filter':{'fieldName':'eventName','inListFilter':{'values':['begin_checkout','purchase','support_click']}}},'orderBys':[{'metric':{'metricName':'eventCount'},'desc':True}],'limit':50})
tbl('source sessionDefaultChannelGroup,sessionSource,sessions,users', {'dateRanges':DR,'dimensions':[{'name':'sessionDefaultChannelGroup'},{'name':'sessionSource'}],'metrics':[{'name':'sessions'},{'name':'totalUsers'},{'name':'engagedSessions'}],'orderBys':[{'metric':{'metricName':'sessions'},'desc':True}],'limit':15})
tbl('landing landingPage,sessions,begin_checkout', {'dateRanges':DR,'dimensions':[{'name':'landingPagePlusQueryString'}],'metrics':[{'name':'sessions'},{'name':'keyEvents'}],'orderBys':[{'metric':{'metricName':'sessions'},'desc':True}],'limit':15})
