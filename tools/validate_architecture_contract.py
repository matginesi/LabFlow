#!/usr/bin/env python3
from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parents[1]
errors=[]

def need(path):
    p=ROOT/path
    if not p.exists(): errors.append(f'missing required architecture file: {path}')
    return p

for path in [
    'knowledge/kb.jsonl',
    'assets/js/experiment/domain-schema.js',
    'assets/js/experiment/data-model.js',
    'assets/js/experiment/data-contracts.js',
    'assets/js/experiment/derived-state.js',
    'assets/js/experiment/action-data.js',
    'assets/js/experiment/design-model.js',
    'assets/js/data/pipeline.js',
    'docs/guides/EXTENDING_LABFLOW.md',
]: need(path)

index=(ROOT/'index.html').read_text(encoding='utf-8')
order=['domain-schema.js','data-model.js','action-data.js','derived-state.js','data-contracts.js']
pos=[index.find(x) for x in order]
if any(x < 0 for x in pos) or pos != sorted(pos):
    errors.append('architecture kernel script load order is invalid')

schema=(ROOT/'assets/js/experiment/domain-schema.js').read_text(encoding='utf-8')
if re.search(r"registerRoot\(\s*['\"]entities['\"]", schema):
    errors.append('parallel entities root is forbidden; samples is the physical identity root')
for required in ['samples','runs','measurements','patches','actionData']:
    patterns=[f"registerRoot('{required}'", f'registerRoot(\"{required}\"', f"['{required}',", f'[\"{required}\",']
    if not any(token in schema for token in patterns):
        errors.append(f'DomainSchema missing root: {required}')

pipeline=(ROOT/'assets/js/data/pipeline.js').read_text(encoding='utf-8')
for stage in ['normalize','link','validate-structure','analyze','index','review','auto-cleanup','project-design','summarize','validate-final']:
    if stage not in pipeline:
        errors.append(f'pipeline missing stage: {stage}')
for token in ['phase:', 'after:', 'reads:', 'writes:']:
    if token not in pipeline:
        errors.append(f'pipeline metadata missing: {token[:-1]}')

contracts=(ROOT/'assets/js/experiment/data-contracts.js').read_text(encoding='utf-8')
if 'ACTION_DATA_INVALID' not in contracts or 'ACTION_DATA_BUCKET_INVALID' not in contracts:
    errors.append('DataContracts must fail closed on malformed ActionData')

# Persistent public Action output has one current boundary: ExperimentData.actionData.
import json
for manifest in sorted((ROOT/'actions').glob('*/action.json')):
    d=json.loads(manifest.read_text(encoding='utf-8'))
    effect=(d.get('contract') or {}).get('effect') or {}
    if d.get('visibility')!='public' or effect.get('mode')=='read_only':
        continue
    for target in effect.get('writes') or []:
        if not str(target).startswith('experiment.actionData.'):
            errors.append(f'public Action {d.get("id")} persists outside experiment.actionData: {target}')

if 'BROKEN_RELATION' not in contracts:
    errors.append('DataContracts must validate graph relations')

ignore=(ROOT/'.gitignore').read_text(encoding='utf-8') if (ROOT/'.gitignore').exists() else ''
for rule in ['*.zip','*.ZIP','**/ORIGINAL_REQUEST/','**/TEST_DATA/']:
    if rule not in ignore:
        errors.append(f'.gitignore missing required rule: {rule}')

if errors:
    print('Architecture contract: FAILED')
    for e in errors: print(' -',e)
    sys.exit(1)
print('Architecture contract: OK (single aggregate, schema-owned roots, declared pipeline, ActionData boundary, repo exclusions)')
