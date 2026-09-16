#!/usr/bin/env python3
"""Synchronize deterministic build metadata across application artifacts."""
from __future__ import annotations
import argparse,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
INFO=ROOT/'assets/js/build-info.js'

def read_info():
    text=INFO.read_text(encoding='utf-8')
    vm=re.search(r'LABFLOW_VERSION\s*=\s*["\']([^"\']+)',text)
    bm=re.search(r'LABFLOW_BUILD\s*=\s*["\']([^"\']+)',text)
    if not vm or not bm: raise SystemExit('build-info.js must define LABFLOW_VERSION and LABFLOW_BUILD')
    return vm.group(1),bm.group(1)

def transform(path, version, build):
    text=path.read_text(encoding='utf-8')
    text=re.sub(r'(?<=\?v=)20\d\d\.\d\d\.\d\d-(?:poc-r\d+|\d+\.\d+\.\d+)',build,text)
    if path.name=='ui-kit.html':
        text=re.sub(r'LabFlow build 20\d\d\.\d\d\.\d\d-(?:poc-r\d+|\d+\.\d+\.\d+)',f'LabFlow build {build}',text)
        text=re.sub(r'(?<=<strong>)(?:Prototype r\d+|\d+\.\d+\.\d+)(?=</strong>)',version,text)
    return text

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--write',action='store_true');args=ap.parse_args()
    version,build=read_info(); stale=[]
    for name in ('index.html','ui-kit.html'):
        path=ROOT/name; expected=transform(path,version,build); current=path.read_text(encoding='utf-8')
        if current!=expected:
            stale.append(name)
            if args.write:path.write_text(expected,encoding='utf-8')
    if stale and not args.write:
        print('Build metadata is stale: '+', '.join(stale));raise SystemExit(1)
    print(f'Build metadata: OK ({version} · {build})')
if __name__=='__main__':main()
