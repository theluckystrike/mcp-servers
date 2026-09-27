#!/opt/homebrew/bin/bash
# Bundle remaining 6 servers using the preinstalled module set from /tmp/npmtest2 (npm is too slow/flaky here).
set -euo pipefail
ROOT="/Users/mike/mcp-servers"
SRC_NM="/tmp/npmtest2/node_modules"
cd "$ROOT"

declare -A DN=( ['pomodoro']="Pomodoro Planner" ['loan-calculator']="Loan Calculator" ['receipts']="Receipt Parser" ['budget']="Budget Tracker" ['payroll']="Payroll Estimator" ['tax-calc']="US Tax Calculator" ['stripe-billing']="Stripe Billing" )
declare -A DESC=( ['loan-calculator']="Monthly loan payments and year-by-year amortization schedules. All local." ['receipts']="Parse raw receipt lines into an itemized total with tax. All local." ['budget']="Set monthly budget categories, record expenses, see remaining amounts. All local." ['payroll']="Gross-to-net payroll estimates for hourly staff and contractor payout totals. All local." ['tax-calc']="Estimate 2026 US federal income tax (single filer, standard deduction). All local." ['stripe-billing']="Check your Stripe balance and draft payment links from any MCP client." )
declare -A TOOLS=( ['loan-calculator']="loan_payment|Monthly payment + total interest for a loan|loan_amortize|Year-by-year amortization schedule" ['receipts']="receipt_parse|Parse raw receipt lines into an itemized total with tax" ['budget']="budget_set|Set a monthly budget category and cap|budget_spend|Record an expense against a budget category|budget_report|Show all budgets and remaining amounts" ['payroll']="payroll_run|Gross-to-net payroll estimate for hourly staff|payroll_invoice_total|Total contractor payout for a list of hours/rate entries" ['tax-calc']="us_federal_tax|Estimate 2026 US federal income tax (single filer, standard deduction)" ['stripe-billing']="stripe_balance|Show available and pending Stripe balance|stripe_payment_link|Formula for creating a Stripe payment link" )

for NAME in loan-calculator receipts budget payroll tax-calc stripe-billing; do
  SRC="$ROOT/servers/$NAME"
  OUT="$ROOT/bundles/$NAME"
  echo "=== $NAME ==="
  rm -rf "$OUT"; mkdir -p "$OUT/server"
  cp -R "$SRC/src/." "$OUT/server/"
  node -e "
    const fs=require('fs');
    const pkg=JSON.parse(fs.readFileSync('$SRC/package.json','utf8'));
    const out={name:pkg.name,version:pkg.version,type:'module',dependencies:pkg.dependencies||{}};
    fs.writeFileSync('$OUT/server/package.json', JSON.stringify(out,null,2)+'\n');
  "
  cp -R "$SRC_NM" "$OUT/server/node_modules"

  TOOLS_JSON=$(node -e "
    const parts = process.argv[1].split('|');
    const tools=[];
    for(let i=0;i<parts.length;i+=2) tools.push({name:parts[i],description:parts[i+1]});
    console.log(JSON.stringify(tools));
  " "${TOOLS[$NAME]}")

  ENV_JSON='{}'
  if [ "$NAME" = "stripe-billing" ]; then
    ENV_JSON='{"STRIPE_SECRET_KEY":"${user_config.stripe_secret_key}"}'
  fi
  USER_CONFIG='{}'
  if [ "$NAME" = "stripe-billing" ]; then
    USER_CONFIG='{"stripe_secret_key":{"type":"string","title":"Stripe secret key","description":"Your Stripe secret key (sk_live_... or sk_test_...).","sensitive":true,"required":true}}'
  fi

  node -e "
    const fs=require('fs');
    const m={
      manifest_version:'0.2',
      name:'mcp-$NAME',
      display_name:process.argv[1],
      version:'1.0.0',
      description:process.argv[2],
      author:{name:'theluckystrike',url:'https://github.com/theluckystrike'},
      repository:{type:'git',url:'https://github.com/theluckystrike/mcp-servers'},
      homepage:'https://mcp.zovo.one',
      license:'MIT',
      server:{type:'node',entry_point:'server/index.js',mcp_config:{command:'node',args:['\${__dirname}/server/index.js'],env:JSON.parse(process.argv[3])}},
      user_config:JSON.parse(process.argv[4]),
      tools:JSON.parse(process.argv[5])
    };
    fs.writeFileSync('$OUT/manifest.json', JSON.stringify(m,null,2)+'\n');
  " "${DN[$NAME]}" "${DESC[$NAME]}" "$ENV_JSON" "$USER_CONFIG" "$TOOLS_JSON"

  npx -y @anthropic-ai/mcpb validate "$OUT/manifest.json" 2>&1 | tee "$OUT/.validate.log" | tail -2
  rm -f "$ROOT/bundles/$NAME.mcpb"
  ( cd "$OUT" && npx -y @anthropic-ai/mcpb pack . "$ROOT/bundles/$NAME.mcpb" ) 2>&1 | tee "$OUT/.pack.log" | tail -2
  echo "--- $NAME done: $(du -h "$ROOT/bundles/$NAME.mcpb" | cut -f1) ---"
done
echo ALL_DONE
