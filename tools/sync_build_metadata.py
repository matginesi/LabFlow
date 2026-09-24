#!/usr/bin/env python3
"""Synchronize deterministic build metadata and the asset cache revision.

`LABFLOW_BUILD` stays the human release label. `LABFLOW_ASSET_REV` is a deterministic
content hash of the authored assets and is used as the `?v=` cache key, so any source
change forces browsers to fetch fresh CSS/JS after GitHub Pages serves the new HTML.
"""
from __future__ import annotations
import argparse,hashlib,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
INFO=ROOT/'assets/js/build-info.js'
SOURCE_FILES=(ROOT/'index.html',)

def read_info():
    text=INFO.read_text(encoding='utf-8')
    vm=re.search(r'LABFLOW_VERSION\s*=\s*["\']([^"\']+)',text)
    bm=re.search(r'LABFLOW_BUILD\s*=\s*["\']([^"\']+)',text)
    rm=re.search(r'LABFLOW_ASSET_REV\s*=\s*["\']([^"\']*)',text)
    if not vm or not bm: raise SystemExit('build-info.js must define LABFLOW_VERSION and LABFLOW_BUILD')
    return vm.group(1),bm.group(1),(rm.group(1) if rm else '')

def normalized(text):
    """Ignore the current cache key so the revision is computed from source content, not itself."""
    return re.sub(r'(?<=\?v=)[A-Za-z0-9._+-]+','REV',text)

def source_rev():
    digest=hashlib.sha256()
    paths=list(SOURCE_FILES)
    paths+=sorted((ROOT/'assets/css').glob('*.css'))
    paths+=sorted((ROOT/'assets/js').rglob('*.js'))
    for path in paths:
        # build-info.js is the revision owner and cannot be part of its own digest.
        if path.name=='build-info.js': continue
        digest.update(path.relative_to(ROOT).as_posix().encode('utf-8'));digest.update(b'\0')
        digest.update(normalized(path.read_text(encoding='utf-8')).encode('utf-8'));digest.update(b'\0')
    return digest.hexdigest()[:12]

def write_rev(rev):
    text=INFO.read_text(encoding='utf-8')
    if re.search(r'LABFLOW_ASSET_REV\s*=',text):
        text=re.sub(r'LABFLOW_ASSET_REV\s*=\s*["\'][^"\']*["\']',f'LABFLOW_ASSET_REV="{rev}"',text)
    else:
        text=text.rstrip('\n')+f'\nwindow.LABFLOW_ASSET_REV="{rev}";\n'
    INFO.write_text(text,encoding='utf-8')

def transform(path, rev):
    return re.sub(r'(?<=\?v=)[A-Za-z0-9._+-]+',rev,path.read_text(encoding='utf-8'))

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--write',action='store_true');args=ap.parse_args()
    version,build,stored=read_info();computed=source_rev()
    if args.write:
        if computed!=stored: write_rev(computed)
        page=ROOT/'index.html';page.write_text(transform(page,computed),encoding='utf-8')
        print(f'Build metadata: OK ({version} · {build} · assets {computed})')
        return
    rev=stored or computed;stale=[]
    if computed!=stored: stale.append('assets/js/build-info.js')
    page=ROOT/'index.html'
    if page.read_text(encoding='utf-8')!=transform(page,rev): stale.append('index.html')
    if stale:
        print('Build metadata is stale: '+', '.join(sorted(set(stale))));raise SystemExit(1)
    print(f'Build metadata: OK ({version} · {build} · assets {rev})')
if __name__=='__main__':main()
