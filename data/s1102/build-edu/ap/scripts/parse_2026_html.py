"""Parse the 2026 percent tables from apstudents.collegeboard.org/about-ap-scores/score-distributions.
usage: python3 -I parse_2026_html.py <page.html> > out.json"""
import html, json, re, sys
s = open(sys.argv[1], encoding='utf8').read()
s = re.sub(r'<script.*?</script>|<style.*?</style>', '', s, flags=re.S)
title = html.unescape(re.search(r'<title>(.*?)</title>', s, re.S).group(1)).strip()
out, problems = [], []
for cap_tbl in re.finditer(r'<table.*?</table>', s, re.S):
    t = cap_tbl.group(0)
    cap = re.search(r'<caption[^>]*>(.*?)</caption>', t, re.S)
    capt = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', cap.group(1)))).replace('\u200c', '').strip() if cap else ''
    group = capt.split(':', 1)[1].strip() if ':' in capt else (capt or None)
    for row in re.findall(r'<tr.*?</tr>', t, re.S):
        cells = [re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', c))).replace('‌', '').strip() for c in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', row, re.S)]
        if not cells or cells[0] == 'Exam': continue
        if len(cells) != 7 or not all(re.fullmatch(r'\d+%', c) for c in cells[1:]):
            problems.append(f'unparsed row {cells}'); continue
        p = [int(c[:-1]) for c in cells[1:]]
        pct = dict(zip('54321', p[:5]))
        if pct['5'] + pct['4'] + pct['3'] != p[5] and abs(pct['5'] + pct['4'] + pct['3'] - p[5]) > 1: problems.append(f'{cells[0]} 3+ off by >1')
        out.append({'exam': cells[0], 'group': group, 'percents': pct, 'three_plus_percent': p[5], 'row_sum': sum(p[:5])})
print(json.dumps({'title': title, 'exams': out, 'problems': problems}, indent=1))
