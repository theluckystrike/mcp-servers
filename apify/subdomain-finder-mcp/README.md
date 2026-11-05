# Subdomain Finder MCP: Certificate Transparency

This Actor is a **passive subdomain finder** for AI agents and MCP clients (Claude, ChatGPT developer mode, Cursor, VS Code, Cline and others). It reads public **certificate transparency (CT) logs** (certspotter and crt.sh), merges and cleans the names, and can check them with **DNS over HTTPS** to show which hosts are live and which CNAMEs dangle. It needs no API key.

**How you use it:** run it in Standby mode and connect your MCP client to `https://YOUR_USERNAME--subdomain-finder-mcp.apify.actor/mcp` with your Apify API token. Each successful tool call costs **$0.03**. Listing the tools is free.

## What this MCP server knows that your model does not

- A domain's **current subdomains**: new hosts show up in CT logs within minutes of getting a certificate. A model's training data is months old and never had most of them.
- Which hosts **resolve right now**, which CNAMEs point at a deleted cloud resource (subdomain takeover candidates), and whether the zone has wildcard DNS.
- **Certificate history**: when each name first got a certificate, which CAs issued it, every SAN, revocation status and when the current one expires.
- Clean CT parsing: precertificate and certificate rows merged, e-mail SANs and out-of-scope names dropped, `*.` entries reported as wildcards instead of hosts.

## Tools

| Tool | What it returns |
|---|---|
| `find_subdomains` | Deduplicated hostnames for a domain from CT logs, with first seen, last seen, valid until, certificate count, issuers and a wildcard flag. Optional DNS check of up to 40 names. |
| `resolve_subdomains` | A, AAAA and CNAME chain for up to 40 hosts. Marks live, NXDOMAIN, no records and dangling CNAMEs, names the cloud service behind a CNAME, and detects wildcard DNS. |
| `get_certificate_history` | Certificates for one host: issuer, validity dates, every SAN, revocation status and SHA-256, plus first and latest issuance. |
| `summarize_attack_surface` | The domain's hostnames grouped into development and test, staging, admin, API, auth, mail, remote access, storage and legacy, with naming clusters and the newest names. |

Every result has structured JSON, a plain-English summary, `as_of` and `source`, so an agent can quote it and cite it.

## Pricing

Pay per event: **$0.03 per successful tool call** (event `tool-call`). `initialize`, `tools/list` and failed calls are not charged. In Standby mode Apify also bills the small platform usage of the running container on top of the event price. You can set a maximum charge per run in the Apify Console, and the Actor stops answering tool calls when that limit is reached. A normal (non-Standby) run only performs a free self-check.

## How to connect

1. Create a free Apify account and copy your API token from **Settings > API & Integrations** in the Apify Console.
2. The MCP endpoint is `https://YOUR_USERNAME--subdomain-finder-mcp.apify.actor/mcp` (streamable HTTP). Replace `YOUR_USERNAME` with the Apify username that owns this Actor.
3. Send the token as a Bearer header: `Authorization: Bearer YOUR_APIFY_TOKEN`.

### Claude Code

```bash
claude mcp add --transport http subdomain-finder https://YOUR_USERNAME--subdomain-finder-mcp.apify.actor/mcp --header "Authorization: Bearer $APIFY_TOKEN"
```

### Cursor, VS Code, Cline and other clients with remote MCP support

```json
{
  "mcpServers": {
    "subdomain-finder": {
      "url": "https://YOUR_USERNAME--subdomain-finder-mcp.apify.actor/mcp",
      "headers": { "Authorization": "Bearer YOUR_APIFY_TOKEN" }
    }
  }
}
```

### Claude Desktop (through the mcp-remote bridge)

```json
{
  "mcpServers": {
    "subdomain-finder": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://YOUR_USERNAME--subdomain-finder-mcp.apify.actor/mcp", "--header", "Authorization: Bearer YOUR_APIFY_TOKEN"]
    }
  }
}
```

### Apify MCP server and the Apify API

You can also reach this Actor through the Apify MCP server (`https://mcp.apify.com`) or call the Standby URL from any HTTP client that speaks MCP.

## Example prompts

- "Find subdomains of example.org from certificate transparency and tell me which look like staging or admin hosts."
- "Which of these hosts have dangling CNAMEs? api.example.org, old.example.org, shop.example.org"
- "Show the certificate history for login.example.org and when the current certificate expires."

## Data and method

Public CT logs (certspotter, crt.sh) and Cloudflare DNS over HTTPS, queried at call time. Every result carries `as_of` and the `source` query URL.

## Limits

Passive and read-only: it reads public CT logs and public DNS and sends nothing to the target's servers. No port scanning, no HTTP probing, no brute-force wordlists. Use it on domains you own or are authorised to test, for example inside a bug bounty program's scope. CT logs only list names that received a public certificate, so some hosts will not appear.

## FAQ

**Is this a subdomain scanner that touches the target?**  
No. It only queries public certificate logs and public DNS resolvers.

**Do I need certspotter or crt.sh keys?**  
No. It uses the public endpoints and falls back between them. Very large domains are capped per call.

**Can it find every subdomain?**  
No. Hosts that never had a public certificate (internal names, plain HTTP) do not appear in CT.

**How is the Actor run?**  
The Actor starts the open-source MCP server bundled in this image (MIT licence) and exposes it over streamable HTTP in Apify Standby mode. It is built from the `apify/actor-templates` MCP proxy template. Source: https://github.com/theluckystrike/subdomain-finder-mcp

**What is MCP?**  
The Model Context Protocol is an open standard that lets AI assistants call tools. See https://modelcontextprotocol.io

## Related searches

subdomain finder, subdomain enumeration, certificate transparency search, crt.sh API, certspotter, dangling CNAME checker, bug bounty recon, attack surface, MCP server
