#!/usr/bin/env python3
from pathlib import Path
import re, sys
css=Path('assets/css/app.css').read_text()
marker=css.find('.settings-page{')
problems=[]
if marker<0: problems.append('canonical Settings CSS block not found')
else:
    early=css[:marker]
    for sel in ['.settings-workspace-grid','.settings-tools-workshop','.settings-rail','.settings-content']:
        if sel in early: problems.append(f'Settings selector appears before canonical Settings block: {sel}')
media=len(re.findall(r'@media\s*\(',css))
if media>90: problems.append(f'responsive media-query count regressed: {media} > 90')
if problems:
    print('CSS contract: FAIL')
    for p in problems: print(' -',p)
    sys.exit(1)
print(f'CSS contract: OK ({media} media queries; Settings selectors centralized)')
