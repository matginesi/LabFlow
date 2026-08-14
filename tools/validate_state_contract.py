#!/usr/bin/env python3
"""Guard the single canonical ExperimentData + Action runtime state."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
state=(ROOT/'assets/js/state.js').read_text(); model=(ROOT/'assets/js/experiment/data-model.js').read_text(); importer=(ROOT/'assets/js/data/importer.js').read_text(); ctx=(ROOT/'assets/js/ai/context.js').read_text()
errors=[]
for m in ('function ensureExperiment(reason)','function touch(scope)','function setExperiment(exp, rawArchive)','function startActionRun(record)','function endActionRun(status)'):
    if m not in state: errors.append('state missing '+m)
for name in ('manifest','rawFormatEvidence','auxiliaryEvidence','samples','measurements','findings','patches','provenance'):
    if name not in model: errors.append('DataModel missing '+name)
if 'derived: { actions: {}, chat: { conversation: [] } }' not in model: errors.append('derived must contain only Action history + chat')
if 'exp.manifest = manifest' not in importer: errors.append('importer does not write canonical manifest')
if 'LF.DataModel.getExperiment()' not in ctx: errors.append('Action context does not resolve canonical experiment')
if 'rawArchive.slice(0)' not in state: errors.append('RAW archive fallback is not cloned before retention')

data_model=(ROOT/'assets/js/experiment/data-model.js').read_text()
if 'opts.bytes.slice(0)' not in data_model: errors.append('DataModel does not clone uploaded RAW bytes')
if errors:
 print('State contract: FAILED',file=sys.stderr); [print(' - '+e,file=sys.stderr) for e in errors]; raise SystemExit(1)
print('State contract: OK')
