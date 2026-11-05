#!/bin/bash
# usage: gh_rank.sh; writes gh_raw.jsonl
out=gh_raw.jsonl; : > $out
run(){ repo=$1; q=$2
  enc=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$q")
  for try in 1 2 3; do
   r=$(gh api "search/repositories?q=$enc&per_page=30" 2>/dev/null) && break; sleep 30; done
  echo "$r" | python3 -I -c '
import json,sys
repo,q=sys.argv[1],sys.argv[2]
try: d=json.load(sys.stdin)
except Exception: print(json.dumps({"repo":repo,"query":q,"error":"no response"})); sys.exit()
items=d.get("items",[])
rank=None
for i,it in enumerate(items,1):
    if it["full_name"].lower()=="theluckystrike/"+repo: rank=i;break
print(json.dumps({"repo":repo,"query":q,"total_count":d.get("total_count"),"returned":len(items),"rank":rank,"top3":[it["full_name"] for it in items[:3]]}))' "$repo" "$q" >> $out
  sleep 3; }
while IFS=$'\t' read repo q1 q2; do run $repo "$q1"; run $repo "$q2"; done < queries.tsv
run lake-level-mcp "lake level mcp"
