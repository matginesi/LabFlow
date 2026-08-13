#!/usr/bin/env python3
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
index=(ROOT/'index.html').read_text();assistant=(ROOT/'assets/js/ai/assistant.js').read_text();feedback=(ROOT/'assets/js/ui/feedback.js').read_text();pages='\n'.join(p.read_text() for p in (ROOT/'assets/js/pages').glob('*.js'));css=(ROOT/'assets/css/app.css').read_text();errors=[]
if "closest('button[data-operation]')" not in assistant and 'closest("button[data-operation]")' not in assistant:errors.append('OPERATION delegation not button-only')
for tag in re.findall(r'<([a-zA-Z0-9]+)\b[^>]*data-operation=',pages):
    if tag.lower()!='button':errors.append('data-operation on non-button '+tag)
if 'id="activityRetry"' not in index or 'Retry checkpoint' not in index:errors.append('Retry control missing')
if 'activityContinue' in index+feedback:errors.append('manual Continue remains')
for marker,label in [('data-operation="dataset.analyze"','Analyze dataset'),('data-operation="dataset.correct-safe"','Safe corrections'),('data-operation="dataset.resolve-ambiguities"','Resolve ambiguities'),('data-operation="design.infer"','Infer missing design'),('data-operation="results.interpret"','Interpret results'),('data-operation="nomad.prepare"','Prepare NOMAD'),('data-operation-workshop','Operations Workshop')]:
    if marker not in pages:errors.append(label+' UI missing')
for cls in ('.operation-workshop','.operation-catalog','.operation-inspector','.operation-step-flow'):
    if cls not in css:errors.append('Workshop style missing '+cls)

settings=(ROOT/'assets/js/pages/settings-page.js').read_text()
if "['ai-helpers','AI Helpers']" not in settings:errors.append('AI Helpers Settings tab missing')
if "operationWorkshopPanel({aiOnly:true})" not in settings:errors.append('AI Helpers must reuse OPERATION Workshop definitions')
if "AI Helpers are Operations." not in settings:errors.append('AI Helpers OPERATION contract copy missing')

if errors:print('UI contract: FAILED');[print(' - '+e) for e in errors];raise SystemExit(1)
print('UI contract: OK')
