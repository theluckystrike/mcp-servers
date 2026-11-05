#!/usr/bin/env python3
"""Insert or refresh the S1102 section in ~/mcpstamp-work/dashboard/index.html (the McpStamp Store Report).

Idempotent: the block sits between <!-- s1102:start --> and <!-- s1102:end -->, plus one nav item
between <!-- s1102-nav:start/end -->. Refuses to write if the report changed in the last 3 minutes
(another session edits it). Writes a timestamped backup first.
  python3 ~/mcp-servers/data/s1102/stamp_report_section.py [--force]
"""
import glob, html, json, os, re, shutil, subprocess, sys, time

REPORT = os.path.expanduser('~/mcpstamp-work/dashboard/index.html')
ROOT = os.path.expanduser('~/mcp-servers')
SESSION = json.load(open(f'{ROOT}/data/sessions/2026-11-02.json'))
e = lambda x: html.escape(str(x), quote=True)


def satellites():
    out = []
    for f in sorted(glob.glob(f'{ROOT}/data/s1030/*-mcp.json')) + sorted(glob.glob(f'{ROOT}/data/s1102/*-mcp.json')):
        r = json.load(open(f))
        live = r.get('live_calls_ok') or {}
        if not (live and all(live.values()) and r.get('registry_visible')):
            continue
        ms = str(r.get('money_site', '')).split(' ')[0]
        out.append((r['repo'], r['repo_url'], len(r.get('tools') or []), ms, '/s1102/' in f))
    return out


def block():
    sats = satellites()
    new = sum(1 for s in sats if s[4])
    k = {x['label']: x for x in SESSION['kpis']}
    rows = ''.join(
        f'<tr><td><a href="{e(u)}">{e(n)}</a>{" <b>new</b>" if isnew else ""}</td><td>{t}</td>'
        f'<td><a href="{e(m)}">{e(m.replace("https://", "").rstrip("/"))}</a></td>'
        f'<td><a href="https://www.mcpstamp.com/free-servers/{e(n)}/">page</a></td></tr>'
        for n, u, t, m, isnew in sats)
    kpis = ''.join(f'<tr><td>{e(x["label"])}</td><td><b>{e(x["value"])}</b></td><td>{e(x["note"])}</td></tr>'
                   for x in SESSION['kpis'])
    nxt = ''.join(f'<li>{e(x["title"])}. {e(x["detail"])}</li>' for x in SESSION['next'])
    return f'''<!-- s1102:start -->
<section id="free-servers">
  <h2><span class="no">18</span>Free servers and distribution (session S1102, 2 Nov)</h2>
  <p>A separate run on 2 Nov worked on traffic, not on stores. It added {new} free data servers, so {len(sats)} are live. Each one answers what a model cannot know from training, such as tax rules passed after its cutoff, live prices and exact calendar math. Each answer links to a site that already earns money. None needs a token. All are on <a href="https://www.mcpstamp.com/free-servers/">mcpstamp.com/free-servers</a>.</p>
  <p>Result so far. MCP revenue is still 0 and no channel shows real human use yet. The servers rank first on GitHub for most of their searches and appear in every directory checked, but a web search for a buyer question found them only 1 time in 15. Being listed is not being found.</p>
  <div class="scroll"><table>
    <thead><tr><th>Measure</th><th>Value</th><th>Note</th></tr></thead>
    <tbody>{kpis}</tbody>
  </table></div>
  <h3>Free servers</h3>
  <div class="scroll"><table>
    <thead><tr><th>Server</th><th>Tools</th><th>Sends visitors to</th><th>Setup</th></tr></thead>
    <tbody>{rows}</tbody>
  </table></div>
  <h3>Next steps</h3>
  <ol>{nxt}</ol>
  <p>Full session data is in <code>~/mcp-servers/data/s1102/</code>. The session dashboard is <code>~/mcp-servers/DASHBOARD.html</code>. Re-measure on or after 4 Nov with <code>bash ~/mcp-servers/data/s1102/remeasure.sh</code>.</p>
</section>
<!-- s1102:end -->'''


def main():
    force = '--force' in sys.argv
    age = time.time() - os.path.getmtime(REPORT)
    if age < 180 and not force:
        sys.exit(f'report modified {int(age)} s ago by another session; retry later')
    t = open(REPORT).read()
    shutil.copy2(REPORT, REPORT.replace('index.html', f'index.{time.strftime("%Y%m%d-%H%M%S")}-pre-s1102.html'))
    b = block()
    if '<!-- s1102:start -->' in t:
        t = re.sub(r'<!-- s1102:start -->.*?<!-- s1102:end -->', lambda m: b, t, flags=re.S)
    else:
        assert t.count('<footer>') == 1, 'footer anchor not unique'
        t = t.replace('<footer>', b + '\n\n<footer>', 1)
    nav = '<!-- s1102-nav:start --><li><a href="#free-servers">Free servers and distribution</a></li><!-- s1102-nav:end -->'
    if '<!-- s1102-nav:start -->' in t:
        t = re.sub(r'<!-- s1102-nav:start -->.*?<!-- s1102-nav:end -->', lambda m: nav, t, flags=re.S)
    else:
        anchor = '<li><a href="#evidence">Evidence files</a></li>'
        assert t.count(anchor) == 1, 'nav anchor not unique'
        t = t.replace(anchor, anchor + '\n    ' + nav, 1)
    open(REPORT, 'w').write(t)
    print('wrote', REPORT, len(t), 'bytes;', len(satellites()), 'servers')


if __name__ == '__main__':
    main()
