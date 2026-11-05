// Owner dashboard: dated activity measurements, never inferred human users.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const count = value => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('en-US') : 'Not measured';
const date = value => value ? esc(value.slice(0, 10)) : 'Not measured';
const window = value => value?.start && value?.end ? `${date(value.start)} to ${date(value.end)}` : 'Not measured';
const localTime = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)) + ' ICT' : 'Not measured';

export function renderTrafficUsers(audit, subscribers, sources = {}) {
  if (!audit || audit.status !== 'OK') return '<div class="card"><h2>Traffic &amp; users</h2><p>A complete traffic snapshot is unavailable. Missing data is not zero.</p></div>';
  const g = audit.search_console, gh = audit.github, f = audit.funnel, s = audit.stripe_28d, paid = audit.stripe_completed;
  const grossEntries = Object.entries(paid.mcp_untagged_paid_checkout_gross_minor_by_currency || {});
  const gross = grossEntries.length ? grossEntries.map(([currency, minor]) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100)).join(' + ') : paid.counts.mcp_untagged_paid === 0 ? '$0' : 'Not measured';
  const card = (value, label, detail) => `<div class="kpi"><div class="n">${esc(value)}</div><div class="k">${esc(label)}</div><p class="dim">${esc(detail)}</p></div>`;
  const rows = [
    ['google-impressions', 'Google Search impressions', count(g.mcp.impressions), window(g.window), 'Finalized storefront-host reporting dates; impressions are search appearances.'],
    ['google-clicks', 'Google Search clicks', count(g.mcp.clicks), window(g.window), 'Clicks from Google results to the storefront host.'],
    ['github-views', 'GitHub repository views', `${count(gh.views)} views / ${count(gh.unique_visitors)} unique visitor clients`, window(gh.window), 'Clients can include automation and operator work; not confirmed people.'],
    ['github-clones', 'GitHub repository clones', `${count(gh.clones)} clones / ${count(gh.clone_unique_clients)} unique clients`, window(gh.window), 'Clones are not installations or active users.'],
    ['hosted-successes', 'Successful hosted tool responses', count(f.ordinary.successful_business_call), window(f.window) + ' UTC; last date partial', 'Unmarked as probes, not verified human activity or completed buyer jobs.'],
    ['hosted-firsts', 'First token/server/day observations', count(f.ordinary.first_successful_anon_token_server_day), window(f.window) + ' UTC; last date partial', 'The same anonymous token can count across multiple days and servers.'],
    ['offer-views', 'Hosted offer views', count(f.ordinary.offer_view), window(f.window) + ' UTC; last date partial', 'Unmarked events, not unique visitors; automation can be included.'],
    ['handoffs', 'Hosted checkout handoffs', count(f.ordinary.checkout_handoff), window(f.window) + ' UTC; last date partial', 'Unmarked events in the hosted instrument, separate from Stripe Sessions.'],
    ['checkout-sessions', 'Checkout Sessions, excluding tagged probes', `${count(s.mcp_untagged_sessions)} Sessions / ${count(s.mcp_untagged_paid_sessions)} paid`, window(s.window) + ' UTC (rolling 28 days)', `${count(s.mcp_tagged_probes)} tagged probes excluded. Sessions are not people.`],
    ['paid', 'Paid MCP Checkout purchases / gross', `${count(paid.counts.mcp_untagged_paid)} / ${gross}`, 'Available completed history; read ' + date(paid.fetched_at), 'Scoped MCP Checkout history only. Gross is not net profit.'],
  ];
  const hasSubscribers = subscribers?.status === 'passed';
  return `<div class="card" style="margin-top:12px">
<h2 style="margin-top:0">Traffic &amp; users</h2>
<p class="dim">Snapshot collected ${esc(localTime(audit.finished_at))}. Static measurements; reporting windows below differ.</p>
<p>Traffic and some hosted usage are recorded. A reliable count of individual human users is not available.</p>
<div class="kpis">${card(count(g.mcp.clicks), 'Google Search clicks', window(g.window))}${card(count(gh.unique_visitors), 'GitHub visitor clients', 'Not confirmed people; ' + window(gh.window))}${card(count(f.ordinary.successful_business_call), 'Hosted successful responses', 'Unmarked as probes; ' + window(f.window))}${card(gross, 'Recorded MCP Checkout gross', 'Available completed history; not profit')}</div>
<h2>Traffic and activity</h2>
<div class="tw"><table style="min-width:760px"><thead><tr><th scope="col">Measurement</th><th scope="col">Result</th><th scope="col">Window</th><th scope="col">What it means</th></tr></thead><tbody>${rows.map(([id, label, value, period, note]) => `<tr data-traffic-metric="${id}"><th scope="row" style="white-space:normal;text-transform:none;font-size:13px;color:var(--tx)">${esc(label)}</th><td><b>${esc(value)}</b></td><td>${esc(period)}</td><td class="dim">${esc(note)}</td></tr>`).join('')}</tbody></table></div>
<p class="dim">Hosted measurements pool servers. Local MCP use is not measured here. Search, GitHub, hosted events and Stripe have different populations; these figures cannot establish a person-level conversion rate. Rolling-window changes alone do not establish growth or decline.</p>
<h2>What we know about the user base</h2>
<div class="grid2"><div class="card"><b>Stored email audience</b><p>${hasSubscribers ? `<strong>${count(subscribers.subscriber_base_records)}</strong> setup-email subscription records; <strong>${count(subscribers.base_records_without_current_suppression)}</strong> without a matching suppression.` : 'Not measured.'}</p><p class="dim">Separately checked ${esc(localTime(subscribers?.at))}. Stored records do not establish verified active people, deliverability or permission for a workflow-trial campaign.</p></div>
<div class="card"><b>Human users and retention</b><p><strong>Not measured:</strong> total individual users, daily/monthly active users, retention and installations.</p><p class="dim">Anonymous tokens, visitor clients and clone clients must not be added together or presented as the user base.</p></div></div>
<p class="links"><a href="${esc(sources.snapshot)}">Traffic and revenue source data</a><a href="${esc(sources.subscribers)}">Dated subscriber inventory</a></p>
</div>`;
}
