# S1103 lane build-fin

Two new US personal-finance data satellites, built to the S1030 contract and live.

| repo | hosted URL | worker version | tests | live calls | npx github | registry | money page |
|---|---|---|---|---|---|---|---|
| cpi-inflation-calculator-mcp | https://cpi-inflation-calculator-mcp.lipmichal.workers.dev/mcp | 5429cb00-2453-4910-91be-88a918ef4737 | 17/17 | 5/5 | ok | visible 1.0.0 | statewage.com/pay-raise-calculator/ |
| irs-mileage-rate-per-diem-mcp | https://irs-mileage-rate-per-diem-mcp.lipmichal.workers.dev/mcp | 1e4f1af4-1278-40e0-a28e-a2580611a59c | 18/18 | 5/5 | ok | visible 1.0.0 | taxbreakcalc.com/self-employed-set-aside-calculator/ |

Rollback: `npx wrangler delete --name <repo>` (both brand-new workers). CPI also has an earlier version 2e1b1eb7-7dd3-427a-9fbf-a9478a323e64 (`npx wrangler rollback 2e1b1eb7-... --name cpi-inflation-calculator-mcp`).

## Field sizes (gh api search/repositories, 2026-11-03)

"inflation calculator mcp" 0, "cpi inflation calculator mcp" 0, "cpi inflation mcp" 5; "mileage rate mcp" 2, "per diem rates mcp" 2, "per diem mcp" 3, "irs mileage mcp" 5. Not picked: "treasury yield mcp" 18, "mortgage rates mcp" 13, "cpi mcp" 65. FPL and 2026 brackets already exist in our aca and car-loan/paycheck satellites.

## What each knows that a model does not

- CPI: BLS CPI-U/CPI-W/core 1913 to Sept. 2026 (CPI-U 336.940, 12-month 3.7%), the missing October 2025 index (2025 lapse in appropriations), 2025 annual average 321.943. The COLA tool reproduces SSA's 8.7/3.2/2.5/2.8/3.6% for 2023-2027 from CPI-W (positive control).
- Mileage/per diem: 2026 mid-year increase to 76 cents from July 1 (Announcement 2026-11), 72.5 before; depreciation 35 cents; FAVR $61,700; GSA FY2027 per diem by ZIP (standard $113/$68); IRS high-low $329/$230 from Oct. 1, 2026 (Notice 2026-60) with the 91 high-cost localities.

## Verification

Local stdio, `npx -y github:...` from an empty temp dir, and live HTTP against the README URL with no token: initialize, tools/list, one real tools/call per tool, all !isError with source, as_of and a `utm_source=mcp&utm_medium=<repo>` link. Raw responses: build-fin/{cpi,mil}-raw-{stdio,npx,http}/. Registry: `curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=<repo>"` returns each at 1.0.0 (control: section-179).

## Open

- CPI live refresh: the keyless BLS API returned "daily threshold reached" to both this host and the Cloudflare egress IP on 2026-11-03. Hosted answers say `live: false` and use bundled data through Sept. 2026. Success path checked offline with a saved real BLS response. OWNER UNLOCK: free key at https://data.bls.gov/registrationEngine/, then `npx wrangler secret put BLS_API_KEY --name cpi-inflation-calculator-mcp` (code already reads it).
- October 2026 CPI (due mid-November) and 2027 IRS mileage rates (due late December) need a data refresh if the live check stays capped.
- npm: both packages npm-ready, not published (2FA per publish, owner). Glama not submitted.
- Third satellite skipped: Treasury/I bond fields were free but no money-site page fits.
- Pushes: cpi 2, mileage 1. Nothing committed in ~/mcp-servers.
