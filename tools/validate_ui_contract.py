#!/usr/bin/env python3
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
index=(ROOT/'index.html').read_text(); action_ui=(ROOT/'assets/js/ai/action-ui.js').read_text(); feedback=(ROOT/'assets/js/ui/feedback.js').read_text(); pages='\n'.join(p.read_text() for p in (ROOT/'assets/js/pages').glob('*.js')); css=(ROOT/'assets/css/app.css').read_text(); ui_css=(ROOT/'assets/css/ui.css').read_text(); settings=(ROOT/'assets/js/pages/settings-page.js').read_text(); app=(ROOT/'assets/js/app.js').read_text(); kit=(ROOT/'ui-kit.html').read_text(); skill=(ROOT/'.agent/skills/labflow-ui/SKILL.md').read_text(); errors=[]
if "closest('button[data-action]')" not in action_ui and 'closest("button[data-action]")' not in action_ui:errors.append('Action delegation not button-only')
for tag in re.findall(r'<([a-zA-Z0-9]+)\b[^>]*data-action=',pages):
    if tag.lower()!='button':errors.append('data-action on non-button '+tag)
if 'id="activityRetry"' not in index or 'Retry checkpoint' not in index:errors.append('Retry control missing')
for marker,label in [('id="reanalyzeDataset"','Deterministic re-analysis'),('data-action="dataset.resolve-ambiguities"','Resolve ambiguities'),('data-action="design.infer"','Infer missing design'),('data-action="results.interpret"','Interpret results'),('exportLabFlowZip','Export LabFlow ZIP'),('exportNomadEntry','Export NOMAD entry'),('exportNomadZip','Export NOMAD ZIP'),('data-action-editor','Actions manager')]:
    if marker not in pages:errors.append(label+' UI missing')
for cls in ('.operation-workshop','.operation-catalog','.operation-inspector','.operation-step-flow','.review-workbench'):
    if cls not in css:errors.append('Required responsive style missing '+cls)
if "['actions','Actions']" not in settings:errors.append('single Actions Settings tab missing')
if 'AI Helpers' in settings or 'Operations Workshop' in settings:errors.append('split Operations/AI Helpers Settings UI remains')
if 'Actions are capabilities, not pipeline stages.' not in settings or 'Capability contract' not in settings:errors.append('Action execution contract copy missing')
if 'aria-label="Current action"' not in index:errors.append('Action totem not named consistently')

# UI Kit and the local UI skill are executable contracts, not stale examples.
if "['knowledge','Knowledge Base']" not in settings:errors.append('Knowledge Base Settings tab missing')
if 'Knowledge Base' not in kit:errors.append('UI Kit does not expose current Knowledge Base Settings pattern')
if 'chat-quick-actions' in kit:errors.append('UI Kit still shows retired Assistant quick-action strip')
if 'chat-action-launcher' not in kit:errors.append('UI Kit missing single Assistant Actions launcher')
if not re.search(r'exactly one compact \*\*Actions\*\* launcher',skill,re.I):errors.append('UI skill missing current single Actions launcher contract')
if 'Navigation and scroll contract' not in skill:errors.append('UI skill missing navigation/scroll contract')
# New routes and content-defining tabs start from their own workspace beginning.
for marker,label in [("renderAtWorkspaceStart('.results-main-tabs')",'Results'),("renderAtWorkspaceStart('.settings-tabs')",'Settings'),("renderAtWorkspaceStart('.docs-workbench')",'Documentation'),("renderAtWorkspaceStart('.cabinet-filter-tabs')",'Cabinet')]:
    if marker not in app:errors.append(label+' workspace-start navigation missing')
if 'if(!renderedRoute||routeChanged)main.scrollTop=0' not in app.replace(' ',''):errors.append('route change does not reset main workspace scroll')
if 'scrollMemoryNodes(root)' not in app or 'root.querySelectorAll(SCROLL_MEMORY_SELECTOR)' not in app:errors.append('bounded local scroll memory contract missing')
# Known retired layouts must not survive as compatibility CSS.
retired=('.repair-proposal','.repair-proposal-head','.nomad-flow','.results-layout','.changes-table','.changes-patch-table','.design-edit-table','.design-head-actions','.design-proposal-stats','.review-ai-results','.chat-applied','.chat-action-context','.ground-truth-grid','.result-inspector-grid','.result-inspector-lower','.inspector-kpis','.inspector-provenance','.compare-page','.ai-complete')
all_css=css+'\n'+ui_css
for cls in retired:
    if cls in all_css:errors.append('retired compatibility selector remains '+cls)
if re.search(r'font(?:-size)?:\s*(?:7|7\.5|8|8\.5|9|9\.5)px',all_css):errors.append('literal sub-10px UI font remains; use shared tokens')

if errors:print('UI contract: FAILED');[print(' - '+e) for e in errors];raise SystemExit(1)
print('UI contract: OK')
