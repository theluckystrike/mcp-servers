import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const [dir]=process.argv.slice(2);
const c=new Client({name:'p',version:'1'});
await c.connect(new StdioClientTransport({command:process.execPath,args:[dir+'/dist/stdio.js']}));
const {tools}=await c.listTools();
for(const t of tools) console.log(t.name, JSON.stringify(Object.fromEntries(Object.entries(t.inputSchema.properties||{}).map(([k,v])=>[k,v.type+(v.enum?':'+v.enum.join('|'):'')]))), 'req='+(t.inputSchema.required||[]).join(','), JSON.stringify(t.annotations||{}));
await c.close();
