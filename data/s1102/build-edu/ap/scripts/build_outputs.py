"""Assemble ap_distributions.json and ap_worksheets.json from parsed files.
usage: python3 -I build_outputs.py <apdir>"""
import json, sys, os
d = sys.argv[1]
P = lambda *a: os.path.join(d, *a)
F = '2026-11-02'
years = {}
for y, url in (('2024', 'https://apcentral.collegeboard.org/media/pdf/ap-score-distributions-by-subject-2024.pdf'),
               ('2025', 'https://apcentral.collegeboard.org/media/pdf/ap-score-distributions-by-subject-2025.pdf')):
    p = json.load(open(P('raw', f'parsed_{y}.json')))
    assert not p['problems'], p['problems']
    years[y] = {'source_url': url, 'source_title': f'STUDENT SCORE DISTRIBUTIONS, AP Exams - May {y}', 'fetched': F,
                'data_kind': 'counts', 'footnote': p['footnote'], 'exams': p['exams']}
years['2024']['alt_source_urls'] = ['https://reports.collegeboard.org/media/pdf/ap-score-distributions-by-subject-2024.pdf (byte-identical)',
                                    'https://reports.collegeboard.org/media/xlsx/ap-score-distributions-by-subject-2024.xlsx']
RENAME = {'AP 2D Art & Design': 'AP 2-D Art and Design', 'AP 3D Art & Design': 'AP 3-D Art and Design',
          'AP English Language & Composition': 'AP English Language and Composition',
          'AP English Literature & Composition': 'AP English Literature and Composition',
          'AP Comparative Government & Politics': 'AP Comparative Government and Politics',
          'AP United States Government & Politics': 'AP United States Government and Politics',
          'AP Physics 1': 'AP Physics 1: Algebra-Based', 'AP Physics 2': 'AP Physics 2: Algebra-Based'}
p26 = json.load(open(P('raw', 'parsed_2026.json')))
assert not p26['problems'] and len(p26['exams']) == 40
canon25 = {e['exam'] for e in years['2025']['exams'] if e['kind'] == 'exam'}
ex26 = []
for e in p26['exams']:
    name = RENAME.get(e['exam'], e['exam'])
    assert name in canon25, name
    ex26.append({'exam': name, 'label_in_source': e['exam'], 'kind': 'exam', 'group': e['group'], 'counts': None, 'total': None,
                 'percents': e['percents'], 'three_plus': {'count': None, 'percent': e['three_plus_percent']}, 'mean': None, 'sd': None})
years['2026'] = {'source_url': 'https://apstudents.collegeboard.org/about-ap-scores/score-distributions', 'source_title': p26['title'],
                 'fetched': F, 'data_kind': 'percents_only',
                 'note': 'Published as whole percentages only; no counts, totals, means or SD for 2026 (per-subject pages, e.g. /score-distributions/ap-biology, also leave Test Takers and Mean blank for 2026). Page says it is updated on a rolling basis. Total Group only; no subscores or Standard Group rows.',
                 'exams': ex26}
json.dump({'generated': F, 'years': years}, open(P('ap_distributions.json'), 'w'), indent=1)

B = 'https://secure-media.collegeboard.org/digitalServices/pdf/ap/'
def ws(subj, file, year, sec1, sec2, cuts, extra=None):
    mx = round(sec1['max_raw'] * sec1['multiplier'] + sum(q['max_raw'] * q['multiplier'] for q in sec2), 2)
    return {'exam': subj, 'source_url': B + file, 'document': f'{year} AP {subj[3:]} Practice Exam, Scoring Worksheet and AP Score Conversion Chart',
            'exam_year_format': year, 'fetched': F, 'section_1_multiple_choice': sec1, 'section_2_free_response': sec2,
            'composite_rule': 'weighted Section I + weighted Section II (do not round parts), round composite to nearest whole number',
            'composite_max_computed': mx, 'conversion_chart': cuts, 'notes': extra or []}
FR = lambda *qs: [{'question': i + 1, 'max_raw': m, 'multiplier': w} for i, (m, w) in enumerate(qs)]
C = lambda *r: [{'ap_score': 5 - i, 'composite_min': lo, 'composite_max': hi} for i, (lo, hi) in enumerate(r)]
W = [
 ws('AP Calculus AB', 'ap-calculus-ab-practice-exam-2012.pdf', 2012, {'max_raw': 45, 'multiplier': 1.2}, FR(*[(9, 1.0)] * 6), C((67, 108), (54, 66), (41, 53), (33, 40), (0, 32))),
 ws('AP Biology', 'ap-biology-practice-exam-2013.pdf', 2013, {'max_raw': 58, 'multiplier': 1.0344}, FR((10, 1.5), (10, 1.5), (4, 1.4285), (4, 1.4285), (4, 1.4285), (3, 1.4285), (3, 1.4285), (3, 1.4285)), C((93, 120), (75, 92), (54, 74), (30, 53), (0, 29))),
 ws('AP Statistics', 'ap-statistics-practice-exam-2012.pdf', 2012, {'max_raw': 39, 'multiplier': 1.282}, FR(*[(4, 1.875)] * 5, (4, 3.125)), C((70, 100), (57, 69), (44, 56), (33, 43), (0, 32)), ['Worksheet footnote: although 40 multiple-choice items were administered, item 14 was not used in scoring (out of 39).']),
 ws('AP World History', 'ap-world-history-practice-exam-2013.pdf', 2013, {'max_raw': 70, 'multiplier': 0.8571}, FR(*[(9, 2.2222)] * 3), C((78, 120), (64, 77), (48, 63), (32, 47), (0, 31)), ['2013 exam was titled AP World History (before the "Modern" course).']),
 ws('AP Psychology', 'ap-psychology-practice-exam-2012.pdf', 2012, {'max_raw': 100, 'multiplier': 1.0}, FR((7, 3.5714), (7, 3.5714)), C((112, 150), (94, 111), (79, 93), (65, 78), (0, 64))),
 ws('AP Macroeconomics', 'ap-macroeconomics-practice-exam-2012.pdf', 2012, {'max_raw': 60, 'multiplier': 1.0}, FR((12, 1.25), (5, 1.5), (6, 1.25)), C((71, 90), (59, 70), (51, 58), (41, 50), (0, 40))),
 ws('AP Microeconomics', 'ap-microeconomics-practice-exam-2012.pdf', 2012, {'max_raw': 60, 'multiplier': 1.0}, FR((10, 1.5), (6, 1.25), (5, 1.5)), C((71, 90), (56, 70), (46, 55), (35, 45), (0, 34))),
]
json.dump({'generated': F, 'caveat': 'Each chart is the conversion College Board printed for that one practice exam (exam format of that year). Cut points differ from year to year and are not published for live exams. Use only as an estimate for that practice exam format; check the current exam format before applying it.', 'worksheets': W,
           'found_but_not_composite_charts': [
             {'url': 'https://secure-media.collegeboard.org/apc/french-lang-2008-scoring-worksheet.pdf', 'what': 'replacement Table 4.4 for 2008 French Language released exam: multiple-choice score ranges vs percent receiving each AP score; composite cuts only in printed book'},
             {'url': 'https://secure-media.collegeboard.org/apc/english-language-released-exam-2007-scoring-worksheet.pdf', 'what': 'same type, 2007 English Language'},
             {'url': 'https://secure-media.collegeboard.org/apc/env-sci-scoring-worksheet-1998.pdf', 'what': 'same type, 1998 Environmental Science'},
             {'url': 'https://secure-media.collegeboard.org/apc/human-geo-2006-scoring-worksheet.pdf', 'what': 'same type, 2006 Human Geography'}]},
          open(P('ap_worksheets.json'), 'w'), indent=1)
for w in W: print(w['exam'], w['composite_max_computed'], w['conversion_chart'][0]['composite_max'])
print({y: (len(v['exams']), sum(e['kind'] == 'exam' for e in v['exams'])) for y, v in years.items()})
