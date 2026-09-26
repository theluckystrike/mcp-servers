#!/usr/bin/env python3
"""Generate official-registry server.json for the 7 new estate servers.

Pattern matches servers/invoice/server.json: monorepo subfolder + mcpb release.
Name = io.github.theluckystrike/<server-dir-name> (matching existing naming).
"""
import json, os

NEW = ["pomodoro", "loan-calculator", "receipts", "budget", "payroll", "tax-calc", "stripe-billing"]
VER = "0.1.0"

DESCS = {
    "pomodoro": "Plan a workday into pomodoros, log focus sessions, get daily stats. All data is local.",
    "loan-calculator": "Loan and mortgage math from your AI chat: monthly payment, full amortization schedule, payoff comparison.",
    "receipts": "Parse raw receipt lines into itemized totals with tax. All data is local.",
    "budget": "Set monthly budget categories, log spending, get over/under-budget reports. All data is local.",
    "payroll": "Gross-to-net payroll estimates for hourly staff with common withholding assumptions.",
    "tax-calc": "US federal income tax estimates: brackets, marginal rate, effective rate. Planning values.",
    "stripe-billing": "Read your Stripe billing data from AI chat: balances, invoices, subscriptions. Read-only.",
}

for s in NEW:
    d = {
        "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
        "name": f"io.github.theluckystrike/{s}",
        "description": DESCS[s],
        "version": VER,
        "repository": {
            "url": "https://github.com/theluckystrike/mcp-servers",
            "source": "github",
            "subfolder": f"servers/{s}",
        },
        "packages": [
            {
                "registryType": "npm",
                "identifier": f"mcp-{s}",
                "version": VER,
                "transport": {"type": "stdio"},
            }
        ],
    }
    path = f"servers/{s}/server.json"
    with open(path, "w") as f:
        json.dump(d, f, indent=2)
        f.write("\n")
    print("wrote", path)
