#!/usr/bin/env python3
"""Check authored JavaScript for forbidden cross-layer dependency direction."""
from pathlib import Path
import re,sys
ROOT=Path(__file__).resolve().parents[1]
errors=[]

pure=[
 'assets/js/data-structures.js','assets/js/experiment/domain-schema.js','assets/js/experiment/data-model.js',
 'assets/js/experiment/derived-state.js','assets/js/experiment/data-contracts.js',
 'assets/js/experiment/canonical-store.js','assets/js/experiment/design-model.js',
 'assets/js/data/parser.js','assets/js/data/analysis.js','assets/js/data/analysis-summary.js'
]
for rel in pure:
 p=ROOT/rel;text=p.read_text(encoding='utf-8')
 forbidden={
  'DOM access':r'\bdocument\.', 'localStorage':r'\blocalStorage\b','sessionStorage':r'\bsessionStorage\b',
  'UI page dependency':r'LF\.[A-Za-z0-9_]+Page\b','UI service':r'LF\.UI\b','storage service':r'LF\.Storage\b',
  'action runner':r'LF\.ActionRunner\b'
 }
 for label,pattern in forbidden.items():
  if re.search(pattern,text):errors.append(f'{rel}: pure layer depends on {label}')

                                                                             
allowed_raw={
 'assets/js/experiment/data-model.js','assets/js/state.js','assets/js/storage.js',
 'assets/js/data/importer.js','assets/js/export/export.js','assets/js/experiment/domain-schema.js'
}
for path in (ROOT/'assets/js').rglob('*.js'):
 rel=path.relative_to(ROOT).as_posix();text=path.read_text(encoding='utf-8')
 if rel not in allowed_raw and re.search(r'\.sourceArchive\s*=',text):
  errors.append(f'{rel}: writes raw.sourceArchive outside the RAW ownership boundary')

html=(ROOT/'index.html').read_text(encoding='utf-8')
scripts=re.findall(r'<script[^>]+src="([^"]+)"',html)
scripts=[s.split('?')[0] for s in scripts]
def before(a,b):
 try:return scripts.index(a)<scripts.index(b)
 except ValueError:return False
for a,b in [
 ('assets/js/build-info.js','assets/js/core.js'),
 ('assets/js/core.js','assets/js/data-structures.js'),
 ('assets/js/data-structures.js','assets/js/experiment/domain-schema.js'),
 ('assets/js/experiment/domain-schema.js','assets/js/state.js'),
 ('assets/js/experiment/data-model.js','assets/js/state.js'),
 ('assets/js/storage.js','assets/js/knowledge/knowledge-base.js'),
 ('assets/js/ai/action-registry.js','assets/js/ai/contracts.js'),
 ('assets/js/experiment/design-model.js','assets/js/cabinet/cabinet.js'),
 ('assets/js/ai/providers.js','assets/js/ai/transport.js'),
 ('assets/js/ai/transport.js','assets/js/ai/actions.js'),
 ('assets/js/pages/settings-page.js','assets/js/app.js'),
]:
 if not before(a,b):errors.append(f'index.html script order must load {a} before {b}')
if not scripts or scripts[-1]!='assets/js/app.js':errors.append('index.html must load app.js last')

if errors:
 print('Dependency layers: FAILED',file=sys.stderr)
 for e in errors:print(' - '+e,file=sys.stderr)
 raise SystemExit(1)
print('Dependency layers: OK')
