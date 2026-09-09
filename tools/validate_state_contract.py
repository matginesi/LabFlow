#!/usr/bin/env python3
"""Guard the single canonical ExperimentData + Action runtime state."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
state=(ROOT/'assets/js/state.js').read_text(); model=(ROOT/'assets/js/experiment/data-model.js').read_text(); schema=(ROOT/'assets/js/experiment/domain-schema.js').read_text(); importer=(ROOT/'assets/js/data/importer.js').read_text(); ctx=(ROOT/'assets/js/ai/context.js').read_text(); app=(ROOT/'assets/js/app.js').read_text()
errors=[]
for m in ('function ensureExperiment(reason)','function touch(scope)','function setExperiment(exp, rawArchive)','function startActionRun(record)','function endActionRun(status)'):
    if m not in state: errors.append('state missing '+m)
for name in ('manifest','rawFormatEvidence','auxiliaryEvidence','samples','measurements','findings','patches'):
    if "['%s'" % name not in schema and "%s:" % name not in schema: errors.append('DomainSchema missing '+name)
if "derived:{actions:{},chat:{conversation:[]}}" not in schema.replace(' ',''): errors.append('DomainSchema derived root must contain only Action history + chat')
if "['derived',{owner:'runtime',layer:'interaction_history',persistence:'persistent'}]" not in schema.replace(' ',''): errors.append('DomainSchema must own persistent interaction history under derived')
if 'exp.manifest = manifest' not in importer: errors.append('importer does not write canonical manifest')
if 'LF.DataModel.getExperiment()' not in ctx: errors.append('Action context does not resolve canonical experiment')
if 'rawArchive.slice(0)' not in state: errors.append('RAW archive fallback is not cloned before retention')


# UI/transient state has one canonical home under state.ui. Keep route's existing
# proxy for convenience, but do not reintroduce duplicate root storage.
if 'function defaultUiState()' not in state: errors.append('state missing canonical defaultUiState')
if 'Object.assign(state.ui,defaultUiState())' not in state.replace(' ',''): errors.append('resetSession must rebuild canonical UI state with defaultUiState')
ui_fields=('resultsTab','resultsDataMode','resultsJvMode','resultsOverviewMetric','resultsOverviewDirection','resultsOverviewStatistic','selectedMeasurementId','curveSelection','curveOverlaySelection','curveView','curveGroup','curveDirection','curveEligibleOnly','curveSearch','curveZoom','pceDistributionZoom','selectedDesignDeviceId','resultInspectorId','boxPlot','uiKitQuery','uiKitFilter','settingsSection','settingsActionId','assistantOpen','docsSlug','docsQuery','docsSection')
import re
production='\n'.join(p.read_text() for p in (ROOT/'assets/js').rglob('*.js'))
for field in ui_fields:
    if re.search(r'(?:LF\.State|S)\.state\.'+re.escape(field)+r'\b',production): errors.append('legacy root UI state reference remains: '+field)
for action_file in (ROOT/'actions').glob('*/action.json'):
    import json
    try: action=json.loads(action_file.read_text())
    except Exception: continue
    bindings=((action.get('ui') or {}).get('bindings') or {})
    for name,path in bindings.items():
        if isinstance(path,str) and path and not path.startswith('ui.'):
            errors.append(f'{action_file.parent.name} UI binding {name} must use canonical ui.* path')

data_model=(ROOT/'assets/js/experiment/data-model.js').read_text()
if 'opts.bytes.slice(0)' not in data_model: errors.append('DataModel does not clone uploaded RAW bytes')
if errors:
 print('State contract: FAILED',file=sys.stderr); [print(' - '+e,file=sys.stderr) for e in errors]; raise SystemExit(1)
print('State contract: OK')
