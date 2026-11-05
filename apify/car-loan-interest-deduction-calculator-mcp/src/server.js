/**
 * Streamable HTTP MCP endpoint (/mcp) for Apify Standby, adapted from ts-mcp-proxy src/server.ts.
 * Apify's Standby gateway authenticates the caller (Bearer APIFY_TOKEN) before the request
 * reaches this container, so there is no auth code here.
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { log } from 'apify';
import express from 'express';

import { getMcpServer, getSharedProxyClient } from './mcp.js';

function rpcError(res, status, code, message) {
    res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
}

export async function startServer({ serverPort, command }) {
    const app = express();

    app.get('/favicon.ico', (_req, res) => {
        res.writeHead(301, { Location: 'https://apify.com/favicon.ico' });
        res.end();
    });

    // Standby readiness probe
    app.get('/', (req, res) => {
        if (req.headers['x-apify-container-server-readiness-probe']) {
            res.end('ok\n');
            return;
        }
        res.status(200).type('text/plain').end('MCP server Actor. Connect an MCP client to /mcp (streamable HTTP).\n');
    });

    app.use(express.json({ limit: '1mb' }));

    // Stateless streamable HTTP: a fresh transport + wrapper per request, one shared stdio child.
    app.post('/mcp', async (req, res) => {
        try {
            const client = await getSharedProxyClient(command);
            const server = await getMcpServer(client);
            const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
            res.on('close', () => {
                transport.close().catch(() => {});
                server.close().catch(() => {});
            });
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            log.error('Error handling MCP request', { error: String(error) });
            if (!res.headersSent) rpcError(res, 500, -32603, 'Internal server error');
        }
    });

    // No server-initiated streams and no sessions in stateless mode.
    const notAllowed = (_req, res) => rpcError(res.set('Allow', 'POST'), 405, -32000, 'Method not allowed: this MCP endpoint is stateless, use POST');
    app.get('/mcp', notAllowed);
    app.delete('/mcp', notAllowed);

    const httpServer = app.listen(serverPort, () => log.info(`MCP HTTP server listening on port ${serverPort}`));

    const shutdown = async () => {
        httpServer.close();
        try { const c = await getSharedProxyClient(command); await c.close(); } catch { /* ignore */ }
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
