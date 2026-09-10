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
if "['actions','Actions'" not in settings:errors.append('Actions Settings navigation item missing')
if 'AI Helpers' in settings or 'Operations Workshop' in settings:errors.append('split Operations/AI Helpers Settings UI remains')
if 'Actions are capabilities, not pipeline stages.' not in settings or 'Capability contract' not in settings:errors.append('Action execution contract copy missing')
if 'aria-label="Current action"' not in index:errors.append('Action totem not named consistently')
if 'message-totem message-totem-dialog' not in index:errors.append('canonical Message Totem dialog missing')
if 'message-totem message-totem-compact' not in feedback:errors.append('transient feedback does not use compact Message Totem')
if 'totem-toast' in feedback or 'totem-toast' in css or 'totem-toast' in ui_css:errors.append('retired custom Totem clone remains')
if '.message-totem-dialog' not in ui_css or '.message-totem-compact' not in ui_css:errors.append('Message Totem variants are not owned by shared UI CSS')
if re.search(r'(?m)^\.message-(?:totem|shade)',css):errors.append('Message Totem leaked into page-composition CSS')
if '.input.compact' not in ui_css or '.select.compact' not in ui_css:errors.append('shared compact control sizing missing')

# UI Kit and the local UI skill are executable contracts, not stale examples.
if "['knowledge','Knowledge Base'" not in settings:errors.append('Knowledge Base Settings navigation item missing')
if "['nomad','NOMAD'" not in settings:errors.append('NOMAD Settings navigation item missing')
if 'class="settings-rail"' not in settings or 'class="settings-nav"' not in settings:errors.append('intent-grouped Settings rail missing')
if 'settings-data-contract' not in settings:errors.append('Data contract is not progressive disclosure inside Workspace')
if 'Upload not implemented' not in settings or 'id="saveNomadSettings"' not in settings:errors.append('NOMAD Settings stub/configuration surface missing')
if 'id="uploadNomadStub"' not in pages or 'Stub only.' not in pages:errors.append('Export NOMAD upload stub missing or not explicit')
if "closest('#uploadNomadStub')" not in app or 'no data was sent' not in app:errors.append('NOMAD upload stub must remain non-networking and explicit')
if 'Knowledge Base' not in kit:errors.append('UI Kit does not expose current Knowledge Base Settings pattern')
if 'Message Totem · confirmation' not in kit or 'Message Totem · compact status' not in kit:errors.append('UI Kit missing canonical Message Totem variants')
if 'Action totem' not in kit:errors.append('UI Kit missing canonical Action Totem')
if 'chat-quick-actions' in kit:errors.append('UI Kit still shows retired Assistant quick-action strip')
if 'chat-action-launcher' not in kit:errors.append('UI Kit missing single Assistant Actions launcher')
if not re.search(r'exactly one compact \*\*Actions\*\* launcher',skill,re.I):errors.append('UI skill missing current single Actions launcher contract')
if 'Navigation and scroll contract' not in skill:errors.append('UI skill missing navigation/scroll contract')
# Workflow navigation is the first workflow card and remains visible in the page scroller.
shared=(ROOT/'assets/js/pages/shared.js').read_text()
if 'returnpageNavigation(route)+pageHead(title,subtitle,actions)+experimentStepper();' not in shared.replace(' ',''):errors.append('workflow Previous/Next is not the first workflow surface')
if not re.search(r'\.workflow-page-nav\{[^}]*position:sticky[^}]*top:0',css):errors.append('workflow Previous/Next card is not sticky at the top of the main scroller')
if not re.search(r'first (?:workflow )?card.*sticky|first sticky card',skill,re.I|re.S):errors.append('UI skill missing sticky first-card workflow navigation contract')


# Knowledge Base persistence/backup is JSONL end-to-end.
kb=(ROOT/'assets/js/knowledge/knowledge-base.js').read_text(); storage=(ROOT/'assets/js/storage.js').read_text()
if not (ROOT/'knowledge/kb.jsonl').exists():errors.append('source-controlled Knowledge Base JSONL missing')
if (ROOT/'knowledge/kb.json').exists():errors.append('retired Knowledge Base JSON wrapper still present')
if 'Export custom JSONL' not in settings or 'Import JSONL' not in settings:errors.append('Knowledge Base Settings does not expose JSONL backup/restore')
if 'exportJsonl' not in kb or 'importJsonl' not in kb:errors.append('Knowledge Base JSONL import/export API missing')
if "localStorage.setItem(KNOWLEDGE_STORE,knowledgeJsonl(entries))" not in storage:errors.append('Knowledge Base localStorage is not persisted as JSONL')

# Split layouts respond to the actual workspace width, not just the browser viewport.
if 'container-type: inline-size' not in css:errors.append('main workspace is not a responsive size container')
if not re.search(r'@container\s*\(max-width:1100px\)[\s\S]*?\.kb-workbench[^}]*grid-template-columns:1fr',css):errors.append('KB workbench does not collapse by real workspace width')
if not re.search(r'@container\s*\(max-width:1100px\)[\s\S]*?\.settings-workspace-grid',css):errors.append('shared settings split does not respond to real workspace width')

# Safe cleanup is deterministic detection plus explicit researcher acceptance.
pipeline=(ROOT/'assets/js/data/pipeline.js').read_text(); review=(ROOT/'assets/js/pages/review-panel.js').read_text(); corrections=(ROOT/'assets/js/ai/action-steps.js').read_text()
if 'prepareAutomaticSafeFixes' not in pipeline or 'applyAutomaticSafeFixes(exp)' in pipeline:errors.append('pipeline must detect safe cleanup without silently applying new corrections')
if 'id="applyAutomaticCleanup"' not in review or 'Accept safe cleanup' not in review:errors.append('Review missing explicit safe-cleanup acceptance')
if "closest('#applyAutomaticCleanup')" not in app or 'commitAutomaticSafeFixes(exp)' not in app or 'function commitAutomaticSafeFixes(exp)' not in corrections:errors.append('safe-cleanup acceptance does not use the canonical dataset commit service')

# Routes start at the top; content switches preserve the visible shared anchor.
for marker,label in [("renderWithStableAnchor('.results-main-tabs')",'Results'),("renderWithStableAnchor('.docs-workbench')",'Documentation'),("renderWithStableAnchor('.cabinet-filter-tabs')",'Cabinet')]:
    if marker not in app:errors.append(label+' stable-anchor navigation missing')
if "settingsSection.dataset.settingsSection;render();const main=document.getElementById('main');if(main)main.scrollTop=0" not in app:errors.append('Settings navigation does not start the new context at the workspace beginning')
if 'if(!renderedRoute||routeChanged)main.scrollTop=0' not in app.replace(' ',''):errors.append('route change does not reset main workspace scroll')
if 'main.scrollTop=mainScrollTop' not in app:errors.append('same-context rerender does not preserve main workspace scroll')
if 'scrollMemoryNodes(root)' not in app or 'root.querySelectorAll(SCROLL_MEMORY_SELECTOR)' not in app:errors.append('bounded local scroll memory contract missing')
# Known retired layouts must not survive as compatibility CSS.
retired=('.repair-proposal','.repair-proposal-head','.nomad-flow','.results-layout','.changes-table','.changes-patch-table','.design-edit-table','.design-head-actions','.design-proposal-stats','.review-ai-results','.chat-applied','.chat-action-context','.ground-truth-grid','.result-inspector-grid','.result-inspector-lower','.inspector-kpis','.inspector-provenance','.compare-page','.ai-complete')
all_css=css+'\n'+ui_css
for cls in retired:
    if cls in all_css:errors.append('retired compatibility selector remains '+cls)
if re.search(r'font(?:-size)?:\s*(?:7|7\.5|8|8\.5|9|9\.5)px',all_css):errors.append('literal sub-10px UI font remains; use shared tokens')

# Small-screen tabs/selectors reflow as grids, never horizontal carousels.
if not re.search(r'@media\s*\(max-width:700px\)[\s\S]*?\.tabs\{[^}]*display:grid[^}]*grid-template-columns:',css):
    errors.append('small-screen shared tabs are not a compact grid')
if re.search(r'@media\s*\(max-width:700px\)[\s\S]*?\.tabs\{[^}]*overflow-x:auto',css):
    errors.append('small-screen shared tabs reverted to horizontal scrolling')
if not re.search(r'@media\(max-width:700px\)\{[^}]*.*?\.design-variant-cards\{[^}]*display:grid[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)',css,re.S):
    errors.append('small-screen Design experiment selector is not a compact two-column grid')
if re.search(r'\.design-variant-cards\{display:flex;overflow-x:auto',css):
    errors.append('Design experiment selector still contains the retired mobile carousel')

if errors:print('UI contract: FAILED');[print(' - '+e) for e in errors];raise SystemExit(1)
print('UI contract: OK')
