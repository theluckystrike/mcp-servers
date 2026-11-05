import re,html,json,sys
def parse(path, notice):
    t=open(path).read()
    i=t.find(notice); i=t.find('High-cost localities',i)
    j=t.find('</table>',i)
    tb=t[i:j]
    out=[];state=None
    for tr in re.findall(r'<tr.*?</tr>',tb,re.S):
        cells=[re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',c))).strip() for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>',tr,re.S)]
        cells=[c for c in cells]
        nonempty=[c for c in cells if c]
        if not nonempty or nonempty[0]=='Key City': continue
        if len(nonempty)==1: state=nonempty[0]; continue
        if len(cells)>=3: city,county,per=cells[0],cells[1],cells[2]
        else: city,county,per=nonempty[0],'',nonempty[-1]
        out.append({'state':state,'city':city,'location':county,'high_cost_portion':per})
    return out
a=parse('irb43.html','Notice 2026-60'); b=parse('irb2541.html','Notice 2025-54')
print(len(a),len(b)); print(a[:2],a[-1]); print(b[:2],b[-1])
json.dump({'2027':a,'2026':b},open('highcost.json','w'),indent=0)
