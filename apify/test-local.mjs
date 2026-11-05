// Raw streamable-HTTP MCP client (no dependencies): initialize, notifications/initialized, tools/list, one tools/call.
// Usage: node test-local.mjs <port|https-url> <toolName> '<argsJson>'  -> prints a JSON verdict, exit 0 only when all steps pass.
// With APIFY_TOKEN set, it is sent as the Bearer token (for the deployed Standby URL).
const [target, tool, argsJson] = process.argv.slice(2);
const url = /^https?:/.test(target) ? target : `http://127.0.0.1:${target}/mcp`;
const auth = process.env.APIFY_TOKEN ? { authorization: `Bearer ${process.env.APIFY_TOKEN}` } : {};
let session;
let id = 0;
async function rpc(method, params, notify = false) {
    const body = notify ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++id, method, params };
    const res = await fetch(url, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(session ? { 'mcp-session-id': session } : {}) },
        body: JSON.stringify(body),
    });
    if (!session && res.headers.get('mcp-session-id')) session = res.headers.get('mcp-session-id');
    const text = await res.text();
    if (notify) return { status: res.status };
    const m = text.match(/^data: (.*)$/m);
    return { status: res.status, msg: JSON.parse(m ? m[1] : text) };
}
const out = {};
const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test-local', version: '1' } });
out.initialize = { status: init.status, server: init.msg.result?.serverInfo, protocolVersion: init.msg.result?.protocolVersion, hasTools: !!init.msg.result?.capabilities?.tools, session: !!session };
out.initialized = (await rpc('notifications/initialized', {}, true)).status;
const list = await rpc('tools/list', {});
out.toolsList = { status: list.status, tools: list.msg.result?.tools?.map((t) => t.name) };
const call = await rpc('tools/call', { name: tool, arguments: JSON.parse(argsJson) });
const r = call.msg.result;
out.toolsCall = { status: call.status, tool, isError: !!r?.isError, error: call.msg.error, textHead: r?.content?.[0]?.text?.slice(0, 300), hasStructured: !!r?.structuredContent };
// stateless server: 5 parallel calls must all succeed, and GET must be refused with 405 (no SSE stream, no sessions)
const par = await Promise.all([1, 2, 3, 4, 5].map(() => rpc('tools/call', { name: tool, arguments: JSON.parse(argsJson) })));
out.parallel5 = par.every((p) => p.status === 200 && p.msg.result && !p.msg.result.isError);
out.getStatus = (await fetch(url, { headers: { ...auth, accept: 'text/event-stream' } })).status;
const ok = out.parallel5 && out.getStatus === 405 && init.status === 200 && out.toolsList.tools?.includes(tool) && call.status === 200 && r && !r.isError;
out.pass = !!ok;
console.log(JSON.stringify(out, null, 2));
process.exit(ok ? 0 : 1);
