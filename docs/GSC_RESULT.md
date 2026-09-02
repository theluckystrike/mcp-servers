status: DONE

evidence:
- timeout 3 wc -c ~/Desktop/keys/gsc-sa-key.json -> 2371 (not iCloud-dataless, readable)
- python3 -c "import google.oauth2.service_account, googleapiclient.discovery" -> ok (google-auth present, py3.9 EOL warnings only, no functional error)
- Loaded ~/Desktop/keys/gsc-sa-key.json with scope https://www.googleapis.com/auth/webmasters (read/write; the existing ~/gsc-analysis/auth.py only requests webmasters.readonly, so a fresh credentials.Credentials object was built for this task rather than reusing that module) -> service account zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com, token refresh succeeded
- GET https://www.googleapis.com/webmasters/v3/sites -> HTTP 200, 44 properties. sc-domain:zovo.one is present with permissionLevel "siteFullUser" -> this domain property covers mcp.zovo.one automatically, no new property needed
- PUT https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Azovo.one/sitemaps/https%3A%2F%2Fmcp.zovo.one%2Fsitemap.xml -> HTTP 204 (submitted)
- GET https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Azovo.one/sitemaps -> HTTP 200; https://mcp.zovo.one/sitemap.xml now listed: lastSubmitted 2026-09-02T14:53:32Z, isPending false, warnings 0, errors 0, contents: {type: web, submitted: 13, indexed: 0}
- POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect body {inspectionUrl: "https://mcp.zovo.one/", siteUrl: "sc-domain:zovo.one"} -> HTTP 200, verdict NEUTRAL, coverageState "URL is unknown to Google" (not yet crawled/discovered by Google for this URL specifically)
- POST same endpoint, inspectionUrl "https://mcp.zovo.one/guides/track-time-in-claude-code" -> HTTP 200, verdict NEUTRAL, coverageState "Discovered - currently not indexed", sitemap field correctly lists https://mcp.zovo.one/sitemap.xml as the discovery source
- Interpretation: the sitemap submission itself succeeded cleanly (0 warnings, 0 errors, 13 URLs submitted). "indexed": 0 and the two inspection verdicts above are expected at this point -- the sitemap was submitted seconds before inspection ran, and Google's indexing pipeline (crawl -> render -> index) takes hours to days after a fresh submission, not seconds. This is not a failure or a blocker, just normal latency.

artifacts:
- /Users/mike/mcp-servers/data/distribution.json (surfaces.search-console added)
- /Users/mike/mcp-servers/docs/GSC_RESULT.md (this file)
- credential used: /Users/mike/Desktop/keys/gsc-sa-key.json (service account zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com), scope requested ad hoc for this task only (webmasters, read/write) -- no new GCP resources or keys created
- inspection result links (require Search Console UI login as an owner/full-user of sc-domain:zovo.one to view):
  - https://search.google.com/search-console/inspect?resource_id=sc-domain:zovo.one&id=66Yvd4DsWt36L5DagNevow
  - https://search.google.com/search-console/inspect?resource_id=sc-domain:zovo.one&id=ZgHM8saUP-29f8plCYAw-w

cost: 14 wall minutes, 0 paid API calls (Google Search Console API is free/quota-based, used with an existing service account key; no new credentials, no billing-enabled APIs called)

failures: none. Every step in the task's own step list completed on the first property tried (sc-domain:zovo.one), so the URL-prefix-property-creation fallback (step 3) was not needed.

insight: sc-domain:zovo.one already existed as a domain property with siteFullUser access from prior GSC work on this estate (see ~/gsc-analysis), so mcp.zovo.one was already implicitly covered by an existing verified property -- the task was pure submission/confirmation, not property setup. Re-check sitemaps.list and urlInspection again in 24-48h to see the indexed count move off 0 and the coverageState move off "Discovered - currently not indexed"; this is expected Google-side latency, not something this task can accelerate.
