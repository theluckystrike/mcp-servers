import json,subprocess,sys,time,datetime
sat=json.load(open(sys.argv[1])); out=sys.argv[2]
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
def post(url,body):
    r=subprocess.run(['curl','-s','-m','60','-A',UA,'-H','Content-Type: application/json','-d',json.dumps(body),'-w','\nHTTP%{http_code}',url],capture_output=True,text=True)
    return r.stdout.strip()
f=open(out,'w')
for x in sat:
    gh='https://github.com/theluckystrike/'+x['repo']
    resp=post('https://mcpmarket.com/api/submit-url',{'url':gh,'type':'server','tier':'free','email':'support@zovo.one'})
    rec={'repo':x['repo'],'at':datetime.datetime.utcnow().strftime('%FT%TZ'),'resp':resp}
    f.write(json.dumps(rec)+'\n'); f.flush(); print(rec)
    time.sleep(20)
