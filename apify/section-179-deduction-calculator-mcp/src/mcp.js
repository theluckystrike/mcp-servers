/**
 * MCP proxy: ONE shared stdio MCP server child process per Actor run, wrapped per HTTP request
 * (stateless streamable HTTP) by a light MCP server that forwards every client request to the
 * child and bills tools/call. Stateless on purpose: Apify Standby scales and recycles runs, so
 * an in-memory session id would turn into HTTP 400 after an idle shutdown or when a second run
 * serves the request. The wrapped servers are pure calculators/readers, they need no session.
 * Adapted from the official apify/actor-templates ts-mcp-proxy template (src/mcp.ts).
 * Differences: JS (no build step), billing only after a successful tools/call,
 * a spending-limit check before the call, no logging of tool arguments.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from '@modelcontextprotocol/sdk/shared/protocol.js';
import {
    ClientNotificationSchema,
    ClientRequestSchema,
    ResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { log } from 'apify';

import { chargeToolCall, remainingToolCalls } from './billing.js';

export async function getMcpProxyClient(command) {
    log.info('Starting MCP stdio server', { command });
    // StdioClientTransport passes only a safe env allow-list (PATH, HOME, ...) to the child,
    // so APIFY_TOKEN is never visible to the wrapped server.
    const transport = new StdioClientTransport({ command: command[0], args: command.slice(1) });
    const client = new Client({ name: 'apify-mcp-proxy-client', version: '1.0.0' });
    await client.connect(transport);
    return client;
}

let shared = null;
/** Lazily started shared child; restarted on the next request if it died. */
export function getSharedProxyClient(command) {
    if (!shared) {
        shared = getMcpProxyClient(command).then((client) => {
            client.onclose = () => { shared = null; log.warning('MCP stdio child closed, will restart on next request'); };
            return client;
        }).catch((error) => { shared = null; throw error; });
    }
    return shared;
}

export async function getMcpServer(proxyClient, { timeout } = {}) {
    const upstreamInfo = proxyClient.getServerVersion() ?? { name: 'mcp-server', version: '1.0.0' };
    const server = new McpServer(upstreamInfo);

    // The SDK refuses to install a request handler for a method whose capability is not registered,
    // and we install one for every client request method (as the template does), so register all of them.
    // What the client is TOLD (initialize result below) is the child's real capability set.
    server.server.registerCapabilities({ tools: {}, prompts: {}, resources: {}, completions: {}, logging: {}, tasks: {} });

    for (const schema of ClientRequestSchema.options) {
        const method = schema.shape.method.value;
        server.server.setRequestHandler(schema, async (req) => {
            if (req.method === 'initialize') {
                // Answer here, not in the child: the child was already initialized by our client.
                return {
                    capabilities: proxyClient.getServerCapabilities() ?? {},
                    protocolVersion: req.params.protocolVersion,
                    serverInfo: upstreamInfo,
                    instructions: proxyClient.getInstructions(),
                };
            }
            if (req.method === 'tools/call') {
                const left = remainingToolCalls();
                if (left <= 0) {
                    log.warning('Run spending limit reached, tool call refused');
                    return {
                        isError: true,
                        content: [{
                            type: 'text',
                            text: 'The maximum charge for this Actor run has been reached. Start a new run or raise the run spending limit.',
                        }],
                    };
                }
                log.info('tools/call', { tool: req.params?.name });
                const result = await proxyClient.request(req, ResultSchema, {
                    timeout: timeout || DEFAULT_REQUEST_TIMEOUT_MSEC,
                });
                // Bill only when the tool produced a usable result.
                if (!result.isError) await chargeToolCall();
                return result;
            }
            log.debug('MCP request', { method });
            return proxyClient.request(req, ResultSchema, { timeout: timeout || DEFAULT_REQUEST_TIMEOUT_MSEC });
        });
    }

    for (const schema of ClientNotificationSchema.options) {
        server.server.setNotificationHandler(schema, async (notification) => {
            // The proxy client already sent notifications/initialized to the child.
            if (notification.method === 'notifications/initialized') return;
            await proxyClient.notification(notification);
        });
    }

    // Server-to-client notifications (progress, logging) cannot be delivered in stateless mode; the
    // wrapped servers do not send any.
    return server;
}
