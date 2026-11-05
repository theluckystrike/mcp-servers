import csv, re, sys
rows=[r['description'] for r in csv.DictReader(open(sys.argv[1], encoding='utf8'))]
for p in sys.argv[2:]:
    rx=re.compile(p, re.I)
    m=sorted([d for d in rows if rx.search(d)], key=len)[:6]
    print('==',p); [print('   ',d) for d in m]
