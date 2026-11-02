import json,subprocess,sys,time,datetime
sat=json.load(open(sys.argv[1])); out=sys.argv[2]; base='/Users/mike/mcp-servers/data/s1102/'
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
H=['-H','x-tsr-serverFn: true','-H','Accept: */*','-H','Origin: https://mcpservers.org','-H','Referer: https://mcpservers.org/submit','-H','Sec-Fetch-Site: same-origin','-H','Sec-Fetch-Mode: cors','-H','Sec-Fetch-Dest: empty','-H','Accept-Language: en-US,en;q=0.9']
f=open(out,'w')
for x in sat:
    rep=json.load(open(base+x['repo']+'.json'))
    fields=[('name',x['name']),('description',x['desc']),('url',rep['repo_url']),('remoteUrl',rep['hosted_url']),('registryName',rep['registry_name']),('remoteAuthScheme','none'),('category',x['cat']),('email','support@zovo.one'),('plan','free')]
    cmd=['curl','-s','-m','60','-A',UA,'-X','POST']+H
    for k,v in fields: cmd+=['-F',f'{k}={v}']
    cmd+=['-w','\nHTTP%{http_code}','https://mcpservers.org/_serverFn/62b9fa2877951ac582b1d0a4835a88ab4b119b1d5fd1a39a67a6a9faadcbc72d']
    r=subprocess.run(cmd,capture_output=True,text=True).stdout.strip()
    rec={'repo':x['repo'],'at':datetime.datetime.utcnow().strftime('%FT%TZ'),'resp':r}
    f.write(json.dumps(rec)+'\n'); f.flush(); print(json.dumps(rec)[:700]); print()
    time.sleep(15)
