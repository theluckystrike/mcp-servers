# SPEC-S129 — Checkout Conversion Sprint

STATUS: in progress

## Goal
Paid sessions > 0. Click→paid ≥ 2%. Diagnose why ~15 human checkout sessions/day
all end unpaid and fix the leak.

## Evidence so far
- data/kpi.json: 100 human checkout sessions (last 100), 0 paid, click→session 277.8
- stripe CLI live list (last 30): all unpaid; mix of $19 product pages, $99 zovo.one/join, $4.99, one stripe.com cancel_url
- Traffic side green: 9563 human requests/7d, 485 tenants with stored data, 133 tokens minted

## Headings (final)
- Stripe deep-dive: cancel_url split, amount split, creation-time pattern
- Hostile-buyer audit of live /buy/* pages
- Fixes implemented (with file + line)
- Deploy + runtime verification
- KPI movement
- Verdict: verified-green vs blocked

## Budget note
Orchestrator lane; subagents only for isolated analysis. No mid-sprint questions.
