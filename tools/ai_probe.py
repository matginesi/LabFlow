#!/usr/bin/env python3
"""Small provider/model diagnostic client for LabFlow.

Uses only the Python standard library. It is intentionally independent from the
browser so it can distinguish provider/API problems from browser CORS policy.
"""
from __future__ import annotations
import argparse, json, os, sys, time, urllib.error, urllib.request

PROVIDERS = {
    'zai': {'chat':'https://api.z.ai/api/paas/v4/chat/completions','models':None,'model':'glm-4.7-flash','env':'ZAI_API_KEY'},
    'openrouter': {'chat':'https://openrouter.ai/api/v1/chat/completions','models':'https://openrouter.ai/api/v1/models','model':'openrouter/free','env':'OPENROUTER_API_KEY'},
    'nvidia': {'chat':'https://integrate.api.nvidia.com/v1/chat/completions','models':'https://integrate.api.nvidia.com/v1/models','model':'nvidia/nemotron-3.5-lightning-30b-a3b','env':'NVIDIA_API_KEY'},
}

def request(url, key, method='GET', payload=None, timeout=60):
    headers={'Accept':'application/json'}
    if payload is not None: headers['Content-Type']='application/json'
    if key: headers['Authorization']='Bearer '+key
    if 'openrouter.ai' in url: headers['X-OpenRouter-Title']='LabFlow provider probe'
    data=json.dumps(payload).encode() if payload is not None else None
    req=urllib.request.Request(url,data=data,headers=headers,method=method)
    started=time.perf_counter()
    try:
        with urllib.request.urlopen(req,timeout=timeout) as res:
            raw=res.read().decode('utf-8','replace')
            return res.status, round((time.perf_counter()-started)*1000), json.loads(raw or '{}'), raw
    except urllib.error.HTTPError as exc:
        raw=exc.read().decode('utf-8','replace')
        try: obj=json.loads(raw or '{}')
        except Exception: obj={}
        return exc.code, round((time.perf_counter()-started)*1000), obj, raw

def model_rows(obj):
    if isinstance(obj,dict):
        for key in ('data','models'):
            if isinstance(obj.get(key),list): return obj[key]
    return obj if isinstance(obj,list) else []

def price(v):
    try:return float(v)
    except (TypeError,ValueError):return None

def is_free(row):
    mid=str(row.get('id') or row.get('model') or '')
    pricing=row.get('pricing') if isinstance(row.get('pricing'),dict) else {}
    p,c,r=price(pricing.get('prompt')),price(pricing.get('completion')),price(pricing.get('request'))
    return ':free' in mid or (p==0 and c==0 and (r in (None,0)))

def main():
    ap=argparse.ArgumentParser(description='Test LabFlow AI providers without browser/CORS.')
    ap.add_argument('provider',choices=sorted(PROVIDERS))
    ap.add_argument('--model')
    ap.add_argument('--api-key')
    ap.add_argument('--endpoint')
    ap.add_argument('--timeout',type=int,default=90)
    ap.add_argument('--list-models',action='store_true')
    ap.add_argument('--free-only',action='store_true')
    ap.add_argument('--max-models',type=int,default=100)
    args=ap.parse_args()
    cfg=PROVIDERS[args.provider]; key=args.api_key or os.getenv(cfg['env'],'')
    if not key:
        print(f'ERROR: missing API key. Pass --api-key or set {cfg["env"]}.',file=sys.stderr); return 2
    if args.list_models:
        url=cfg['models']
        if not url:
            print(f'{args.provider}: no live catalogue endpoint configured in LabFlow; test an exact model with --model.')
            return 0
        status,ms,obj,raw=request(url,key,timeout=args.timeout)
        if status>=400:
            print(f'HTTP {status} in {ms} ms\n{raw[:2000]}',file=sys.stderr); return 1
        rows=model_rows(obj); entries=[]
        for row in rows:
            if not isinstance(row,dict): continue
            mid=str(row.get('id') or row.get('model') or row.get('name') or '')
            if not mid: continue
            free=is_free(row)
            if args.free_only and not free: continue
            entries.append((mid,free,row.get('context_length') or row.get('contextWindow') or ''))
        entries.sort(key=lambda x:(not x[1],x[0].lower()))
        print(f'{args.provider}: {len(rows)} catalogue models · {sum(1 for r in rows if isinstance(r,dict) and is_free(r))} free')
        for mid,free,ctx in entries[:max(1,args.max_models)]: print(f'{"FREE " if free else "     "}{mid}{(" · ctx "+str(ctx)) if ctx else ""}')
        return 0
    model=args.model or cfg['model']; url=args.endpoint or cfg['chat']
    payload={'model':model,'messages':[{'role':'user','content':'Reply with exactly: OK'}],'max_tokens':32,'stream':False}
    if args.provider=='zai': payload['thinking']={'type':'disabled'}
    status,ms,obj,raw=request(url,key,'POST',payload,args.timeout)
    print(f'{args.provider} · {model} · HTTP {status} · {ms} ms')
    if status>=400:
        print(raw[:4000]); return 1
    choices=obj.get('choices') if isinstance(obj,dict) else None
    text=''
    if choices and isinstance(choices,list):
        msg=(choices[0] or {}).get('message') or {}; text=str(msg.get('content') or '')
    print('response:',text[:1000] or '<no final text>')
    print('request-id:',obj.get('id','') if isinstance(obj,dict) else '')
    return 0
if __name__=='__main__': raise SystemExit(main())
