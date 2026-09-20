# T17 TOPIC INTEL S47 — New MCP Server Topic Ranking

STATUS: complete

Method: Demand signal = arXiv "How are AI agents used? Evidence from 177,000 MCP tools" (https://arxiv.org/html/2603.23802v1), Table 6 task-domain usage. Competition signal = Smithery registry search server counts (https://smithery.ai/servers?q=<topic>) + paper's per-domain server counts. All 8 topics are NOT in the existing 42-server portfolio.

## 1. Top 8 ranked new-server topics (not covered by existing 42)

Ranked by demand-to-competition ratio (demand = domain usage % / high-use server evidence; competition = server count).

### 1. LMS / Learning Management System
- Demand: Education/HR/professional-dev domain = 8% Claude.ai usage, 1,857 tools published (https://arxiv.org/html/2603.23802v1#S5.T6)
- Competition: only 201 MCP servers in the entire Education/HR domain — lowest of any task domain (https://arxiv.org/html/2603.23802v1#S5.T6)
- Competition: Smithery "lms" search = 101 servers, lowest count of all topics checked (https://smithery.ai/servers?q=lms)

### 2. Employee onboarding
- Demand: HR domain = 8% Claude.ai usage (https://arxiv.org/html/2603.23802v1#S5.T6)
- Competition: Smithery "onboarding" = 192 servers but dominated by tangential matches (tenant onboarding, CPA tenant onboarding); direct HR-onboarding servers are few (staffsign, SquadBear) (https://smithery.ai/servers?q=onboarding)
- Competition: HR domain total = 201 servers (https://arxiv.org/html/2603.23802v1#S5.T6)

### 3. Leave management / PTO
- Demand: HR domain = 8% Claude.ai usage (https://arxiv.org/html/2603.23802v1#S5.T6)
- Competition: Smithery "leave-management" = 194 servers but only SquadBear is a direct leave/HRIS server; rest are loose matches (https://smithery.ai/servers?q=leave-management)
- Gap: existing portfolio has time-tracker but no leave/PTO server

### 4. Performance reviews / HR evaluations
- Demand: HR domain = 8% Claude.ai usage (https://arxiv.org/html/2603.23802v1#S5.T6)
- Competition: Smithery "performance-review" = 176 servers but mostly tangential (customer reviews, trading journal, website speed); no direct employee-performance-review server surfaced (https://smithery.ai/servers?q=performance-review)

### 5. Recruiting / ATS
- Demand: HR domain = 8% Claude.ai usage (https://arxiv.org/html/2603.23802v1#S5.T6)
- Competition: Smithery "recruiting" = 120 servers; direct ATS servers are niche (Metaview 23 uses, Get on Board) (https://smithery.ai/servers?q=recruiting)
- Gap: existing portfolio has resume but no ATS/recruiting pipeline server

### 6. ESG / carbon accounting
- Demand: carbon-factor-matcher server = 3.60k uses; Clarity AI = 1.47k uses (https://smithery.ai/servers?q=esg)
- Competition: Smithery "esg" = 107 servers (https://smithery.ai/servers?q=esg)
- Demand: "Other" domain (incl. sustainability) = 5% usage, 931 servers (https://arxiv.org/html/2603.23802v1#S5.T6)

### 7. Procurement / purchase orders
- Demand: Business/finance/customer-service domain = 11% Claude.ai usage, 18% of tools (https://arxiv.org/html/2603.23802v1#S5.T6)
- Competition: Smithery "procurement" = 124 servers (https://smithery.ai/servers?q=procurement)
- Gap: existing portfolio has supplier-list and quotes but no procurement/purchase-order workflow server

### 8. Budgeting / FP&A forecasting
- Demand: Business/finance domain = 11% Claude.ai usage (https://arxiv.org/html/2603.23802v1#S5.T6)
- Competition: Smithery "budgeting" = 171 servers, "forecasting" = 148 servers (https://smithery.ai/servers?q=budgeting)
- Gap: existing portfolio has cash-book, petty-cash, expense-tracker but no budget/forecast planning server

## 2. Topics to AVOID (saturated: >30 similar servers)

All of these are in the high-demand Business/finance domain but have heavy competition (Smithery server counts):
- CRM — 146 servers (https://smithery.ai/servers?q=crm)
- E-commerce — 119 servers (https://smithery.ai/servers?q=ecommerce)
- SEO — 128 servers (https://smithery.ai/servers?q=seo)
- Trading — 159 servers (https://smithery.ai/servers?q=trading)
- Inventory — 153 servers (https://smithery.ai/servers?q=inventory)
- Tax — 136 servers (https://smithery.ai/servers?q=tax)
- HR (generic) — 123 servers (https://smithery.ai/servers?q=hr)
- Knowledge base — 152 servers (https://smithery.ai/servers?q=knowledge-base)
- Healthcare (generic) — 128 servers (https://smithery.ai/servers?q=healthcare)
- Accounts payable — 175 servers (https://smithery.ai/servers?q=accounts-payable)
- Purchase order (generic) — 175 servers (https://smithery.ai/servers?q=purchase-order)

Note: Smithery search counts are loose keyword matches; the >30 threshold is met by all of the above. The paper's Table 6 confirms CRM, E-Commerce, SEO, Trading are the dominant subclusters of the Business domain (https://arxiv.org/html/2603.23802v1#S5.T6).

## 3. Verdict — which 4 to build first

Build first (highest demand-to-competition, all in the low-competition Education/HR domain or high-use ESG niche):
1. LMS / Learning Management System
2. Employee onboarding
3. Leave management / PTO
4. ESG / carbon accounting

Rationale: The Education/HR domain has the best demand-to-competition ratio in the entire MCP ecosystem (8% Claude.ai usage vs only 201 servers — lowest of any domain, https://arxiv.org/html/2603.23802v1#S5.T6). ESG/carbon has proven high-use servers (3.6k uses) with only 107 total. These four avoid the saturated Business subclusters (CRM/E-Commerce/SEO/Trading) entirely.
