# Free directory submissions (forms + PR lists) — RESULT

status: PARTIAL

## Surface table

| Surface | Mechanism | Free/paid | What was submitted | Evidence | Status |
|---|---|---|---|---|---|
| https://mcpservers.org/submit | Web form (name, description, url, category, email; hidden `plan` field) | Free tier; optional $39 "Premium Submit" upgrade, declined | 4 servers, one submission each, category productivity/finance, email support@zovo.one | /private/tmp/forms/mcpservers_MCP_{Time_Tracker,Price_Tracker,Spreadsheet,Invoice}_after.png ("Submission Successful!") | submitted |
| https://mcpmarket.com/submit | Web form (repo URL, email, plan radio) | Free Queue $0 (4-6 week wait) vs $29 "Get Listed Now", free selected | 4 repo subdirectory URLs, email support@zovo.one | /private/tmp/forms/mcpmarket_{slug}_after.png, /private/tmp/forms/mcpmarket_invoice_after2.png ("This repository is already in our queue") | submitted |
| https://cursor.directory/mcp | /mcp redirects to /; submit path /plugins/new redirects to /login (GitHub or Google OAuth) | Free but login-gated | nothing | /private/tmp/forms/cursor.directory_plugins_new.png | blocked: login |
| https://www.pulsemcp.com/submit | Web form, currently disabled | Free | nothing | /private/tmp/forms/www.pulsemcp.com_submit.png ("submissions and changes are temporarily paused") | blocked: intake paused |
| https://github.com/wong2/awesome-mcp-servers | No PR intake. README: "We do not accept PRs. Please submit your MCP on the website: https://mcpservers.org/submit" | Free | routed to mcpservers.org (row 1) | README.md line 3-4 of the repo | not applicable: PRs refused |
| https://github.com/appcypher/awesome-mcp-servers | GitHub PR | Free | branch prepared with 4 entries | `gh api repos/appcypher/awesome-mcp-servers` -> `"archived": true`; POST /pulls -> 404 | blocked: repo archived |
| https://mcp-get.com | Was GitHub PR to michaellatman/mcp-get | Free | nothing | /private/tmp/forms/mcp-get.com.png ("This registry is an archived snapshot. The site is read-only, package data is static, and installs, submissions, and analytics are no longer active.") | closed: archived |
| https://www.mcpserverfinder.com | "Submit" link is `mailto:info@mcpserverfinder.com`; /submit is 404 | Free | nothing (no mail channel available to this agent) | /private/tmp/forms/www.mcpserverfinder.com.png, /private/tmp/forms/www.mcpserverfinder.com_submit.png | blocked: email-only |
| https://mcpindex.net | none reachable | unknown | nothing | `curl -o /dev/null -w '%{http_code}'` -> 522; browser body empty | dead: HTTP 522 |
| https://mcp.pizza | none reachable | unknown | nothing | /private/tmp/forms/mcp.pizza.png ("This deployment is temporarily paused") | dead: deployment paused |
| https://portal.mcpcentral.io | none reachable | unknown | nothing | /private/tmp/forms/portal.mcpcentral.io.png (DNS_PROBE_POSSIBLE); curl exit 6 | dead: DNS does not resolve |

No payment details were entered anywhere. No account was created anywhere.

## evidence

```
# mcpservers.org — free path, per server
FILL: {"name":"MCP Time Tracker","desc":"Track billable time without leaving the chat.",
       "url":".../servers/time-tracker","email":"support@zovo.one","cat":"productivity","plan":"free","cb":false}
CLICK: clicked:Submit
AFTER text: Submission Successful! | Your MCP server "MCP Time Tracker" has been submitted successfully.
            Your submission will be reviewed within 12 hours.
# identical result for MCP Price Tracker (finance), MCP Spreadsheet (productivity), MCP Invoice (finance)

# mcpservers.org — the paid trap (first attempt, aborted before any payment data)
# clicking the single unnamed checkbox flips hidden input plan=free -> plan=premium and
# relabels the button "Submit" -> "Submit & Pay ($39)"; that click landed on
# https://checkout.stripe.com/c/pay/cs_live_a1tBGz8b... Stripe page abandoned, nothing entered.
# Rerun without touching the checkbox: plan stayed "free", button stayed "Submit".

# mcpmarket.com — free queue
FILL: {"repo":".../servers/<name>","email":"support@zovo.one","freeChecked":"true"}
BTNLABEL: "Submit to free queue"      # label is "Get listed now" ($29) until Free Queue is selected
CLICK: clicked                         # x4
# verification pass on invoice:
SNIP: Free Queue | ... | $0 | ... | Submit to free queue | Error | This repository is already in our queue.
# verification pass on the other three: "Rate Limited - Too many submissions. Please try again later."
#                                       button disabled "Try again (3600s)"

# appcypher/awesome-mcp-servers
$ git --no-pager diff --stat        -> README.md | 4 ++++
$ git push -u origin add-theluckystrike-mcp-servers   -> ok (fork theluckystrike/awesome-mcp-servers-1)
$ gh pr create --repo appcypher/awesome-mcp-servers ...
  pull request create failed: GraphQL: theluckystrike does not have the correct permissions
$ gh api repos/appcypher/awesome-mcp-servers --jq '{archived,default_branch,has_issues}'
  {"archived":true,"default_branch":"main","has_issues":false}
$ gh api -X POST repos/appcypher/awesome-mcp-servers/pulls ...   -> 404 Not Found

# wong2/awesome-mcp-servers README.md, lines 3-4
> [!NOTE]
> We do not accept PRs. Please submit your MCP on the website: https://mcpservers.org/submit
```

## artifacts
- /Users/mike/mcp-servers/docs/FORMS_RESULT.md
- /Users/mike/mcp-servers/data/distribution.json
- /private/tmp/forms/*.png (17 screenshots)
- /private/tmp/forms/{cdp.py,probe.py,text.py,insp.py,insp2.py,submit_mcpservers.py,submit_mcpmarket.py}
- /private/tmp/appcypher-fork (branch add-theluckystrike-mcp-servers, pushed, unmergeable)

cost: 34 wall minutes

## failures
- mcpservers.org: the first submission reached Stripe checkout. The form's only checkbox is not a terms
  box, it is the $39 Premium upgrade, and it rewrites the hidden `plan` field. Fixed by never touching the
  checkbox and adding a pre-click guard that aborts on any button whose label matches /pay|\$|fee/.
- mcpmarket.com: the submit button label is the plan indicator. Selecting Free Queue renames it from
  "Get listed now" to "Submit to free queue"; a selector matching only the first label silently no-ops.
- mcpmarket.com rate limits at roughly 4 submissions per hour, so 3 of the 4 could not be re-queried for
  a dedupe confirmation within this run.
- appcypher/awesome-mcp-servers is archived; gh reports the failure as a permissions error on
  CreatePullRequest, not as "archived", so the repo state has to be read separately.

## insight
Two of the three PR-based lists in docs/DISTRIBUTION.md section 5 no longer take PRs at all: wong2's list
routes to the mcpservers.org form and appcypher's repo is archived. Every remaining reachable free surface
in this set is a web form whose free path is one mis-click away from a paid one: mcpservers.org defaults the
hidden `plan` field to premium once an unlabelled checkbox is ticked, and mcpmarket.com defaults the plan
radio to the $29 tier. On both, the submit button's own text is the only reliable read of which tier is
armed, so the guard has to be on the button label, not on the form state.
