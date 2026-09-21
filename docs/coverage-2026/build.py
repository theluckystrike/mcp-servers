#!/usr/bin/env python3
"""Render docs/coverage-2026/index.md -> index.html (minimal, clean, no build deps)."""
import re, os

SRC='/Users/mike/mcp-servers/docs/coverage-2026/index.md'
DST='/Users/mike/mcp-servers/docs/coverage-2026/index.html'
md=open(SRC).read()

def esc(s): return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

lines=md.splitlines()
out=[]; in_table=False
for ln in lines:
    ln=ln.rstrip()
    if ln.startswith('|'):
        cells=[esc(c.strip()) for c in ln.strip('|').split('|')]
        if all(re.fullmatch(r'-{3,}', c) for c in cells):
            continue
        tag='th' if not in_table else 'td'
        if not in_table:
            out.append('<table>'); in_table=True
        out.append('<tr>'+''.join(f'<{tag}>{c}</{tag}>' for c in cells)+'</tr>')
        continue
    if in_table:
        out.append('</table>'); in_table=False
    if not ln:
        continue
    if ln.startswith('# '): out.append(f'<h1>{esc(ln[2:])}</h1>')
    elif ln.startswith('## '): out.append(f'<h2>{esc(ln[3:])}</h2>')
    elif ln.startswith('> '): out.append(f'<blockquote><p>{esc(ln[2:])}</p></blockquote>')
    elif ln.startswith('- '):
        body=esc(ln[2:])
        body=re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', body)
        out.append(f'<li>{body}</li>')
    else:
        body=esc(ln)
        body=re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', body)
        out.append(f'<p>{body}</p>')
if in_table: out.append('</table>')

html=f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Measured 2026 market data for MCP server directories: registry growth, Smithery usage concentration, Chrome Web Store comparison, and where a new MCP server actually lands.">
<title>MCP Server Directory Coverage 2026 — measured market data</title>
<style>body{{max-width:820px;margin:2rem auto;padding:0 1rem;font:16px/1.6 -apple-system,Helvetica,sans-serif;color:#1a1a1a}}table{{border-collapse:collapse;width:100%;margin:1rem 0}}td,th{{border:1px solid #ddd;padding:.4rem .6rem;text-align:left}}th{{background:#f5f5f5}}blockquote{{color:#555;border-left:3px solid #ddd;margin:0;padding:.2rem 1rem}}li{{margin:.3rem 0}}a{{color:#0a5}}</style></head><body>
{chr(10).join(out)}
<p><a href="https://mcp.zovo.one">mcp.zovo.one</a> — 46 business-document MCP servers, free tier, no signup.</p>
</body></html>"""
open(DST,'w').write(html)
print('index.html written,', len(html), 'chars')
