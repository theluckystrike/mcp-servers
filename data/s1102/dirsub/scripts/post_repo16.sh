#!/bin/zsh
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
OUT=~/mcp-servers/data/s1102/dirsub/mcprepository-16.jsonl; : > $OUT
for r in $(python3 -I -c "import json;print(' '.join(x['repo'] for x in json.load(open('$1'))))"); do
 resp=$(curl -s -m 60 -A "$UA" -H 'Content-Type: application/json' -w ' HTTP%{http_code}' -d "{\"url\":\"https://github.com/theluckystrike/$r\"}" https://mcprepository.com/api/index)
 echo "{\"repo\":\"$r\",\"at\":\"$(date -u +%FT%TZ)\",\"resp\":$(python3 -I -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$resp")}" | tee -a $OUT
 sleep 8
done
