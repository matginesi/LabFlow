#!/usr/bin/env python3
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
index=(ROOT/'index.html').read_text(); action_ui=(ROOT/'assets/js/ai/action-ui.js').read_text(); feedback=(ROOT/'assets/js/ui/feedback.js').read_text(); pages='\n'.join(p.read_text() for p in (ROOT/'assets/js/pages').glob('*.js')); css=(ROOT/'assets/css/app.css').read_text(); settings=(ROOT/'assets/js/pages/settings-page.js').read_text(); errors=[]
if "closest('button[data-action]')" not in action_ui and 'closest("button[data-action]")' not in action_ui:errors.append('Action delegation not button-only')
for tag in re.findall(r'<([a-zA-Z0-9]+)\b[^>]*data-action=',pages):
    if tag.lower()!='button':errors.append('data-action on non-button '+tag)
if 'id="activityRetry"' not in index or 'Retry checkpoint' not in index:errors.append('Retry control missing')
for marker,label in [('data-action="dataset.analyze"','Analyze dataset'),('data-action="dataset.correct-safe"','Safe corrections'),('data-action="dataset.resolve-ambiguities"','Resolve ambiguities'),('data-action="design.infer"','Infer missing design'),('data-action="results.interpret"','Interpret results'),('data-action="nomad.prepare"','Prepare NOMAD'),('data-action-editor','Actions manager')]:
    if marker not in pages:errors.append(label+' UI missing')
for cls in ('.operation-workshop','.operation-catalog','.operation-inspector','.operation-step-flow','.review-workbench'):
    if cls not in css:errors.append('Required responsive style missing '+cls)
if "['actions','Actions']" not in settings:errors.append('single Actions Settings tab missing')
if 'AI Helpers' in settings or 'Operations Workshop' in settings:errors.append('split Operations/AI Helpers Settings UI remains')
if 'Action Registry' not in settings and 'one registry' not in settings:errors.append('Action execution contract copy missing')
if 'aria-label="Current action"' not in index:errors.append('Action totem not named consistently')
if errors:print('UI contract: FAILED');[print(' - '+e) for e in errors];raise SystemExit(1)
print('UI contract: OK')
