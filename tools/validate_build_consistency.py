#!/usr/bin/env python3
"""Verify generated artifacts and build metadata are synchronized with source inputs."""
from __future__ import annotations
import re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
info=(ROOT/'assets/js/build-info.js').read_text(encoding='utf-8')
version=re.search(r'LABFLOW_VERSION\s*=\s*["\']([^"\']+)',info).group(1)
build=re.search(r'LABFLOW_BUILD\s*=\s*["\']([^"\']+)',info).group(1)
errors=[]
for rel in ('index.html','ui-kit.html','assets/js/pages/ui-kit-inline.js'):
    p=ROOT/rel
    if not p.exists(): errors.append(f'missing {rel}'); continue
    text=p.read_text(encoding='utf-8')
    for found in sorted(set(re.findall(r'20\d\d\.\d\d\.\d\d-poc-r\d+',text))):
        if found!=build:errors.append(f'{rel}: stale build {found} (expected {build})')
    for found in sorted(set(re.findall(r'Prototype r\d+',text))):
        if found!=version:errors.append(f'{rel}: stale version {found} (expected {version})')
if errors:
    print('Build consistency: FAILED',file=sys.stderr)
    for e in errors:print(' - '+e,file=sys.stderr)
    raise SystemExit(1)
print(f'Build consistency: OK ({version} · {build})')
