# r9_distribution_intel.md — Anthropic Connectors Directory readiness (R9)
DATE: 2026-09-22 | STATUS: shipped
Source: tallyfy.com "How to list your MCP server everywhere in 2026" (2026-09-04) + live probes.

## Surface map (effort x payoff)
1. MCP Registry — self-serve, propagates ecosystem-wide. ESTATE: already published (registry rows rank in SERPs — verified batch-2 sweep).
2. **Anthropic Claude Connectors Directory — public submit-review-publish, FREE, fastest credibility. THE gap.**
3. OpenAI apps in ChatGPT — largest consumer reach; org verification is a hard pre-gate (entity docs, human).
4. AWS Marketplace / Bedrock AgentCore — enterprise-heavy, revenue share; skip until demand.
5. Microsoft Copilot Agent Store — no MCP-native door; wrapping agent; skip.
6. Mistral Le Chat custom connector — self-serve per-tenant, switch on anytime.
7. Google — partnership-only; watch.

## Universal build bar (clears ~80% of every program)
Remote HTTPS + Streamable HTTP (✓ estate has, mcp.zovo.one), OAuth 2.0 with real user-consent flow (✗ MISSING), tool annotations with title + read-only/destructive hints (CHECK), live privacy policy (CHECK), demo account with sample data (N/A — free anonymous tier IS the demo), first-party statement (✓ estate-native servers, not middleware).

## Anthropic gate probe (live, 2026-09-22)
POST https://mcp.zovo.one/mcp/invoice initialize → 200, protocolVersion 2025-06-18, tools/resources/prompts capabilities. No auth required → no OAuth consent flow.

## BLOCKER → R10 headline item
Implement OAuth 2.0 authorization-code + dynamic client registration (RFC 7591) on the worker per MCP auth spec. Once live: submit top servers (invoice, pdf, docx) to the Anthropic Connectors Directory. This is the single biggest credibility/distribution unlock remaining.

## Also open
- OpenAI org verification: needs human/entity docs — HUMAN-GATED.
- cline/mcp-marketplace issue: in flight (deleg_2846ebcb).
