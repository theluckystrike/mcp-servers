"""Parse College Board 'Student Score Distributions' PDF (pdftotext -layout output).
usage: python3 -I parse_pdf_text.py <year.txt> <year> > out.json"""
import json, re, sys
path, year = sys.argv[1], sys.argv[2]
# Column labels per block, read from the PDF headers (same layout 2024 and 2025).
# (printed label, canonical exam name, kind)
BLOCKS = [
 [('African American Studies','AP African American Studies','exam'),('Drawing - Art & Design','AP Drawing','exam'),('2-D Art and Design','AP 2-D Art and Design','exam'),('3-D Art and Design','AP 3-D Art and Design','exam'),('Art History','AP Art History','exam'),('Biology','AP Biology','exam')],
 [('Calculus AB','AP Calculus AB','exam'),('Calculus BC','AP Calculus BC','exam'),('Calculus AB Subscore','AP Calculus BC: Calculus AB Subscore','subscore'),('Chemistry','AP Chemistry','exam'),('Chinese Language (Total Group)','AP Chinese Language and Culture','exam'),('Chinese Language (Standard Group)','AP Chinese Language and Culture (Standard Group)','standard_group')],
 [('Computer Science A','AP Computer Science A','exam'),('Computer Science Principles','AP Computer Science Principles','exam'),('Economics - Macro','AP Macroeconomics','exam'),('Economics - Micro','AP Microeconomics','exam'),('English Language & Comp','AP English Language and Composition','exam'),('English Literature & Comp','AP English Literature and Composition','exam')],
 [('Environmental Science','AP Environmental Science','exam'),('European History','AP European History','exam'),('French Language (Total Group)','AP French Language and Culture','exam'),('French Language (Standard Group)','AP French Language and Culture (Standard Group)','standard_group'),('German Language (Total Group)','AP German Language and Culture','exam'),('German Language (Standard Group)','AP German Language and Culture (Standard Group)','standard_group')],
 [('Government & Politics - Comparative','AP Comparative Government and Politics','exam'),('Government & Politics - U.S.','AP United States Government and Politics','exam'),('Human Geography','AP Human Geography','exam'),('Italian Language (Total Group)','AP Italian Language and Culture','exam'),('Italian Language (Standard Group)','AP Italian Language and Culture (Standard Group)','standard_group')],
 [('Japanese Language (Total Group)','AP Japanese Language and Culture','exam'),('Japanese Language (Standard Group)','AP Japanese Language and Culture (Standard Group)','standard_group'),('Latin','AP Latin','exam'),('Music - Theory','AP Music Theory','exam'),('Music Theory Aural Subscore','AP Music Theory: Aural Subscore','subscore'),('Music Theory Nonaural Subscore','AP Music Theory: Nonaural Subscore','subscore')],
 [('Physics 1: Algebra-Based','AP Physics 1: Algebra-Based','exam'),('Physics 2: Algebra-Based','AP Physics 2: Algebra-Based','exam'),('Physics C - Electricity & Magnetism','AP Physics C: Electricity and Magnetism','exam'),('Physics C - Mechanics','AP Physics C: Mechanics','exam'),('Precalculus','AP Precalculus','exam'),('Psychology','AP Psychology','exam')],
 [('Research','AP Research','exam'),('Seminar','AP Seminar','exam'),('Spanish Language (Total Group)','AP Spanish Language and Culture','exam'),('Spanish Language (Standard Group)','AP Spanish Language and Culture (Standard Group)','standard_group'),('Spanish Literature & Culture','AP Spanish Literature and Culture','exam'),('Statistics','AP Statistics','exam')],
 [('United States History','AP United States History','exam'),('World History: Modern','AP World History: Modern','exam')],
]
lines = open(path, encoding='utf8').read().splitlines()
num = lambda s: float(s.replace(',', '')) if '.' in s else int(s.replace(',', ''))
nums = lambda s: [num(x) for x in re.findall(r'\d[\d,]*(?:\.\d+)?', s)]
blocks, cur = [], None
for ln in lines:
    st = ln.strip()
    if st.startswith('Exam Score'):
        cur = {}; blocks.append(cur); continue
    if cur is None: continue
    m = re.match(r'^([1-5])\s+(\d.*)$', st)
    if m and m.group(1) not in cur: cur[m.group(1)] = nums(m.group(2)); continue
    for key, lab in (('total', 'Number of Students'), ('pass', '3 or higher/%'), ('mean', 'Mean Score'), ('sd', 'Standard Deviation')):
        if st.startswith(lab) and key not in cur: cur[key] = nums(st[len(lab):])
assert len(blocks) == len(BLOCKS), (len(blocks), len(BLOCKS))
exams, problems = [], []
for b, cols in zip(blocks, BLOCKS):
    k = len(cols)
    for key in ('5', '4', '3', '2', '1', 'pass'): assert len(b[key]) == 2 * k, (cols[0], key, b[key])
    for key in ('total', 'mean', 'sd'): assert len(b[key]) == k, (cols[0], key, b[key])
    for i, (label, name, kind) in enumerate(cols):
        counts = {s: b[s][2 * i] for s in '54321'}
        pct = {s: b[s][2 * i + 1] for s in '54321'}
        total = b['total'][i]
        e = {'exam': name, 'label_in_source': label, 'kind': kind, 'counts': counts, 'total': total,
             'percents': pct, 'three_plus': {'count': b['pass'][2 * i], 'percent': b['pass'][2 * i + 1]},
             'mean': b['mean'][i], 'sd': b['sd'][i]}
        if sum(counts.values()) != total: problems.append(f'{name}: counts sum {sum(counts.values())} != total {total}')
        if counts['5'] + counts['4'] + counts['3'] != e['three_plus']['count']: problems.append(f'{name}: 3+ count mismatch')
        for s in '54321':
            if abs(round(100 * counts[s] / total, 1) - pct[s]) > 0.051: problems.append(f'{name}: pct {s} {pct[s]} vs {100*counts[s]/total:.2f}')
        mean = sum(int(s) * c for s, c in counts.items()) / total
        if abs(round(mean, 2) - e['mean']) > 0.0051: problems.append(f'{name}: mean {e["mean"]} vs {mean:.4f}')
        exams.append(e)
foot = re.search(r'This table reflects ([\d,]+) AP Exams taken by ([\d,]+) students from ([\d,]+) secondary schools', '\n'.join(lines))
print(json.dumps({'year': int(year), 'exams': exams, 'footnote': {'exams': num(foot.group(1)), 'students': num(foot.group(2)), 'schools': num(foot.group(3))}, 'problems': problems}, indent=1))
