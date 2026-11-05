/**
 * Entry point. Standby run (how MCP clients use it): HTTP MCP server on ACTOR_WEB_SERVER_PORT.
 * Normal run (Console "Start" button, Store test runs): self-check that starts the wrapped
 * server, lists its tools, calls one sample tool, and stores the proof; no charge.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Actor, log } from 'apify';

import { getMcpProxyClient } from './mcp.js';
import { startServer } from './server.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'actor.config.json'), 'utf8'));

// MCP_COMMAND: JSON array override, default is the vendored server (see README, "How it runs").
const MCP_COMMAND = process.env.MCP_COMMAND
    ? JSON.parse(process.env.MCP_COMMAND)
    : [process.execPath, join(root, 'server', 'stdio.js')];

const STANDBY_MODE = process.env.APIFY_META_ORIGIN === 'STANDBY';
const SERVER_PORT = parseInt(process.env.ACTOR_WEB_SERVER_PORT || process.env.APIFY_CONTAINER_PORT || '3001', 10);

await Actor.init();

if (STANDBY_MODE) {
    await startServer({ serverPort: SERVER_PORT, command: MCP_COMMAND });
} else {
    const client = await getMcpProxyClient(MCP_COMMAND);
    const { tools } = await client.listTools();
    const sample = await client.callTool({ name: config.sampleTool, arguments: config.sampleArgs });
    await client.close();
    const standbyUrl = process.env.ACTOR_STANDBY_URL ? `${process.env.ACTOR_STANDBY_URL}/mcp` : null;
    const report = {
        actor: config.title,
        mcpEndpoint: standbyUrl,
        howToConnect: 'Point an MCP client at the endpoint with header Authorization: Bearer <your Apify API token>.',
        toolCount: tools.length,
        tools: tools.map((t) => ({ name: t.name, description: t.description })),
        sampleCall: { tool: config.sampleTool, arguments: config.sampleArgs, isError: !!sample.isError, result: sample.content },
    };
    await Actor.pushData(report);
    await Actor.setValue('OUTPUT', report);
    await Actor.setStatusMessage(`Self-check OK: ${tools.length} tools. Use the Standby URL with an MCP client.`, { isStatusMessageTerminal: true });
    log.info('Self-check finished', { toolCount: tools.length, isError: !!sample.isError });
    await Actor.exit();
}
