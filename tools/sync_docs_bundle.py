#!/usr/bin/env python3
"""Generate the browser-readable documentation bundle for the static POC.

Markdown files remain the editable source. GitHub Pages cannot render them inside
LabFlow without navigation away from the application, so documentation.html uses
this generated JavaScript object. No runtime fetch/build server is required.
"""
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/docs-bundle.js'
FILES=[ROOT/'README.md', ROOT/'AGENTS.md', ROOT/'CONSOLIDATION_NOTES.md', *sorted((ROOT/'docs').glob('*.md'))]
data={p.relative_to(ROOT).as_posix():p.read_text(encoding='utf-8') for p in FILES}
body='''/**\n * GENERATED FILE — DO NOT EDIT DIRECTLY.\n * Source: README.md, AGENTS.md, CONSOLIDATION_NOTES.md and docs/*.md\n * Regenerate with: python3 tools/sync_docs_bundle.py\n */\nwindow.LabFlowDocsBundle = '''+json.dumps(data,ensure_ascii=False,indent=2)+';\n'
if '--check' in sys.argv:
    if not OUT.exists() or OUT.read_text(encoding='utf-8')!=body:
        print('docs-bundle.js is out of sync',file=sys.stderr);sys.exit(1)
    print(f'docs bundle OK ({len(data)} files)');sys.exit(0)
OUT.write_text(body,encoding='utf-8')
print(f'wrote {OUT.relative_to(ROOT)} ({len(data)} files)')
