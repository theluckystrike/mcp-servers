import fs from 'fs';
const ids = ['time-tracker','price-tracker','spreadsheet','currency','docx','timezone','resume','recurring','clauses','calendar','pdf','image','kanban','quotes','barcode','zip','billing-docs','deposits','per-diem','asset-register','statement-of-account','cash-book','amortization','petty-cash','work-order','catalogue','change-order','delivery-schedule','packing-list','checklist','credit-note','job-card','dunning-letters','supplier-list','maintenance-log','mileage-log'];
const LOG = 'docs/w2_results.log';
const done = new Set();
if (fs.existsSync(LOG)) {
  for (const line of fs.readFileSync(LOG,'utf8').split('\n')) {
    const m = line.match(/^([\w-]+) -> HTTP (\d+)/);
    if (m && (m[2]==='200'||m[2]==='409')) done.add(m[1]);
  }
}
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const log = s => { fs.appendFileSync(LOG, s+'\n'); console.log(s); };
let pending = ids.filter(id=>!done.has(id));
console.log('PENDING: '+pending.length+' ('+pending.join(',')+')');
for (const id of pending) {
  let desc = id;
  try {
    const d = await fetch('https://mcp.zovo.one/s/'+id,{headers:{'User-Agent':UA}});
    const h = await d.text();
    const m = h.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/);
    if (m) desc = m[1].replace(/&amp;/g,'&');
  } catch(e){}
  const body = {name:'zovo/mcp-'+id,title:'mcp-'+id,description:desc,transport_type:'http',remote_url:'https://mcp.zovo.one/mcp/'+id,repository_url:'',website_url:'https://mcp.zovo.one/s/'+id,package_identifier:'',submitter_email:'',_hp:''};
  let code=null, text='', attempts=0;
  while (attempts < 12) {
    attempts++;
    try {
      const r = await fetch('https://mcpplaygroundonline.com/api/mcp-submit',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':UA},body:JSON.stringify(body)});
      code=r.status; text=await r.text();
    } catch(e){ text='FETCH_ERR '+e.message; }
    if (code===429) { console.log('  '+id+' 429 a'+attempts+' wait 120s'); await sleep(120000); continue; }
    break;
  }
  log(id+' -> HTTP '+(code??'ERR')+' '+text);
  await sleep(45000);
}
console.log('ALL_DONE');
