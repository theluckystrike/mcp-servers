#!/usr/bin/env python3
"""crosslink2 insert: build one 'Use this data in Claude or ChatGPT' section per site and insert it once.
usage: insert2.py <site> [--apply]   (without --apply only writes snippets/<site>.html)
Prose has no colons and no emoji. Style tokens come from each site's own CSS."""
import sys, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent
STAMP = "https://www.mcpstamp.com/free-servers/{repo}/"
GH = "https://github.com/theluckystrike/{repo}"
HOST = "https://{repo}.lipmichal.workers.dev/mcp"

SITES = {
 "taxbreakcalc": dict(
  repo="car-loan-interest-deduction-calculator-mcp", short="car-loan-interest-deduction",
  file="src-taxbreakcalc/src/pages/index.astro", marker="  <!-- ABOUT / FAQ -->\n", where="before",
  intro="The car loan interest deduction and the other 2026 break calculators on this site are also available as a free MCP server. An AI assistant can use it to work out the deduction for a loan, income and filing status, and to check the SALT deduction, the tax brackets and standard deduction, and the child tax credit, using the IRS figures for 2025 and 2026 rather than what it remembers from training. There is no account or API key.",
  pre="margin:0 0 12px;padding:12px 14px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-sm);font-family:var(--font-mono);font-size:0.8125rem;overflow-x:auto;white-space:pre;color:var(--ink);",
  tpl="""  <!-- USE IN AI ASSISTANTS -->
  <section id="use-in-ai" class="section flush">
    <div class="container measure">
      <h2>Use this data in Claude or ChatGPT</h2>
      <p class="lead" style="max-width:640px">{intro}</p>
      <p style="margin:0 0 6px;font-size:15px"><strong>Claude.ai or ChatGPT.</strong> Add a custom connector with this URL.</p>
      <pre style="{pre}"><code>{url}</code></pre>
      <p style="margin:0 0 6px;font-size:15px"><strong>Claude Code.</strong></p>
      <pre style="{pre}"><code>claude mcp add --transport http {short} {url}</code></pre>
      <p style="font-size:14px"><a href="{stamp}">Setup steps</a> &middot; <a href="{gh}">Source on GitHub</a></p>
    </div>
  </section>

"""),
 "assetloancalculator": dict(
  repo="section-179-deduction-calculator-mcp", short="section-179-deduction",
  file="src-assetloancalculator/src/pages/index.astro", marker="  <script is:inline>\n    (() => {\n      const inp = document.getElementById('assetFilter');", where="before",
  intro="The asset loan math on this site is also available as a free MCP server. An AI assistant can use it to work out the exact payment and total interest on an equipment, truck, RV or land loan, and for a business asset the Section 179 deduction, bonus depreciation and vehicle write-off limits, using the 2025 and 2026 IRS figures rather than what it remembers from training. There is no account or API key.",
  pre="margin:0 0 12px;padding:12px 14px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-sm);font-family:var(--font-num);font-size:12.5px;overflow-x:auto;white-space:pre;color:var(--ink);",
  tpl="""  <section id="use-in-ai" style="padding:40px 0 8px">
    <h2>Use this data in Claude or ChatGPT</h2>
    <p style="color:var(--mut);max-width:68ch">{intro}</p>
    <p style="margin:0 0 6px;font-size:15px"><strong>Claude.ai or ChatGPT.</strong> Add a custom connector with this URL.</p>
    <pre style="{pre}"><code>{url}</code></pre>
    <p style="margin:0 0 6px;font-size:15px"><strong>Claude Code.</strong></p>
    <pre style="{pre}"><code>claude mcp add --transport http {short} {url}</code></pre>
    <p style="font-size:14px;color:var(--mut)"><a href="{stamp}">Setup steps</a> &middot; <a href="{gh}">Source on GitHub</a></p>
  </section>

"""),
 "bugbountyreality": dict(
  repo="subdomain-finder-mcp", short="subdomain-finder",
  file="src-bugbountyreality/index.html", marker=' <div class="ornament">&sect; &nbsp; &sect; &nbsp; &sect;</div>\n\n <!-- ============ COLOPHON', where="before",
  intro="The subdomain finder on this site is also available as a free MCP server. An AI assistant can use it to list the subdomains a domain has in public certificate transparency logs, check which of them resolve over DNS, read the certificate history and summarize the attack surface. It reads public logs and DNS only. It sends no requests to the target and runs no port scans. Use it on your own assets or inside a bug bounty scope. There is no account or API key.",
  pre="margin:0 0 14px;padding:12px 14px;background:rgba(255,255,255,0.5);border:1px solid var(--rule-soft);font-family:var(--mono);font-size:12.5px;overflow-x:auto;white-space:pre;color:var(--ink);",
  tpl=""" <!-- ============ USE IN AI ASSISTANTS ============ -->
 <section class="section" id="use-in-ai">
 <div class="section-head">
 <div class="section-num">&sect; 08 &ndash; Tools</div>
 <h2 class="section-title">Use this data in Claude <em>or ChatGPT.</em></h2>
 </div>
 <div class="essay">
 <p>{intro}</p>
 <p style="margin-bottom:8px"><strong>Claude.ai or ChatGPT.</strong> Add a custom connector with this URL.</p>
 <pre style="{pre}"><code>{url}</code></pre>
 <p style="margin-bottom:8px"><strong>Claude Code.</strong></p>
 <pre style="{pre}"><code>claude mcp add --transport http {short} {url}</code></pre>
 <p style="font-size:15px"><a href="{stamp}">Setup steps</a> &middot; <a href="{gh}">Source on GitHub</a></p>
 </div>
 </section>

"""),
 "abwex": dict(
  repo="ab-test-sample-size-calculator-mcp", short="ab-test-sample-size-calculator",
  file="src-abwex/index.html", marker=' <section class="faq-section">\n', where="before",
  intro="The sample size, duration, significance and Fisher exact math on this site is also available as a free MCP server. An AI assistant can use it to size a test, estimate how long it must run, test a result with a z-test or Fisher exact test, and check the false positive cost of peeking, with exact calculations instead of arithmetic done in its head. There is no account or API key.",
  pre="margin:0 0 12px;padding:12px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);font-family:var(--font-display);font-size:0.8rem;line-height:1.5;overflow-x:auto;color:var(--text);",
  tpl=""" <section class="explainer-section" id="use-in-ai" style="padding:40px 0 8px">
 <h2>Use this data in Claude or ChatGPT</h2>
 <p>{intro}</p>
 <p style="margin:0 0 6px"><strong>Claude.ai or ChatGPT.</strong> Add a custom connector with this URL.</p>
 <pre style="{pre}"><code>{url}</code></pre>
 <p style="margin:0 0 6px"><strong>Claude Code.</strong></p>
 <pre style="{pre}"><code>claude mcp add --transport http {short} {url}</code></pre>
 <p><a href="{stamp}">Setup steps</a> &middot; <a href="{gh}">Source on GitHub</a></p>
 </section>

"""),
 "examscorecalc": dict(
  repo="ap-score-distributions-mcp", short="ap-score-distributions",
  file="src-examscorecalc-live/index.html", marker="  </main><footer class=\"site-foot\">", where="before",
  intro="The AP score distributions on this site are also available as a free MCP server. An AI assistant can use it to look up the College Board score distribution for an AP exam, find the percentile of a score, rank exams by pass rate, and estimate a score from a composite on the seven exams with a printed worksheet. The data covers 2024, 2025 and 2026. There is no account or API key.",
  pre="margin:0 0 10px;padding:11px 13px;background:var(--card);border:1px solid var(--s200);border-radius:var(--radius);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto;white-space:pre;color:var(--ink);",
  tpl="""    <section class="sec" id="use-in-ai"><h2 class="h2">Use this data in Claude or ChatGPT</h2>
      <p class="prose">{intro}</p>
      <p class="prose"><strong>Claude.ai or ChatGPT.</strong> Add a custom connector with this URL.</p>
      <pre style="{pre}"><code>{url}</code></pre>
      <p class="prose"><strong>Claude Code.</strong></p>
      <pre style="{pre}"><code>claude mcp add --transport http {short} {url}</code></pre>
      <p class="prose"><a href="{stamp}">Setup steps &rsaquo;</a> &middot; <a href="{gh}">Source on GitHub &rsaquo;</a></p>
    </section>
"""),
 "recipetool": dict(
  repo="recipe-nutrition-calculator-mcp", short="recipe-nutrition-calculator",
  file="src-recipetool/recipe-dist/index.html", marker='<div class="ad-slot" data-ad-client="ca-pub-2241192243363112" data-ad-pos="end" hidden>', where="before",
  intro="The nutrition math on this site is also available as a free MCP server. An AI assistant can use it to look up USDA FoodData Central values for an ingredient, total the calories and macros of a recipe from plain ingredient lines, scale a recipe by servings, and round a label the way the FDA rules require. It uses the same USDA data as the calculator. There is no account or API key.",
  pre="margin:0 0 12px;padding:11px 13px;background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--radius-sm);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;overflow-x:auto;white-space:pre;color:var(--text);",
  tpl="""<section class="section prose" id="use-in-ai">
  <h2>Use this data in Claude or ChatGPT</h2>
  <p>{intro}</p>
  <p style="margin-bottom:6px"><strong>Claude.ai or ChatGPT.</strong> Add a custom connector with this URL.</p>
  <pre style="{pre}"><code>{url}</code></pre>
  <p style="margin-bottom:6px"><strong>Claude Code.</strong></p>
  <pre style="{pre}"><code>claude mcp add --transport http {short} {url}</code></pre>
  <p><a href="{stamp}">Setup steps</a> &middot; <a href="{gh}">Source on GitHub</a></p>
</section>

"""),
}

def build(site):
    c = SITES[site]
    return c["tpl"].format(intro=c["intro"], pre=c["pre"], url=HOST.format(repo=c["repo"]), short=c["short"],
                           stamp=STAMP.format(repo=c["repo"]), gh=GH.format(repo=c["repo"]))

if __name__ == "__main__":
    site = sys.argv[1]; c = SITES[site]; snip = build(site)
    assert ":" not in re.sub(r'<[^>]*>|https?://\S+|claude mcp add[^<]*|style="[^"]*"', "", snip), "colon in prose"
    (ROOT/"snippets"/f"{site}.html").write_text(snip)
    if "--apply" in sys.argv:
        p = ROOT/c["file"]; t = p.read_text()
        assert "use-in-ai" not in t, "already applied"
        assert t.count(c["marker"]) == 1, f"marker count {t.count(c['marker'])}"
        i = t.index(c["marker"]); t = t[:i] + snip + t[i:]
        p.write_text(t); print("applied", site, len(snip), "bytes")
