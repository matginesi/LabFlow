#!/usr/bin/env python3
"""Validate the deliberately small LabFlow OPERATION catalog."""
from __future__ import annotations
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; OPERATIONS=ROOT/'operations'
PUBLIC={'dataset.analyze','dataset.correct-safe','dataset.resolve-ambiguities','design.infer','results.interpret','report.generate','report.improve','nomad.prepare'}
INTERNAL={'assistant.chat'}; EXPECTED=PUBLIC|INTERNAL
errors=[]; defs={}
for p in sorted(OPERATIONS.glob('*/operation.json')):
    try:d=json.loads(p.read_text())
    except Exception as e:errors.append(f'{p}: invalid JSON: {e}');continue
    tid=d.get('id');defs[tid]=d
    if tid!=p.parent.name:errors.append(f'{p}: id must match directory')
    if d.get('type') not in {'AI','DETERMINISTIC'}:errors.append(f'{tid}: invalid type')
    for k in ('category','role','strategy'):
        if not str(d.get(k) or '').strip():errors.append(f'{tid}: missing workshop metadata {k}')
    steps=d.get('steps') or []
    if not steps:errors.append(f'{tid}: no steps')
    if d.get('type')=='DETERMINISTIC':
        if any(s.get('type')!='DETERMINISTIC' for s in steps):errors.append(f'{tid}: deterministic operation contains AI step')
        if d.get('policies') or (p.parent/'prompt.md').exists() or any(s.get('prompt') for s in steps):errors.append(f'{tid}: deterministic operation must not contain prompts/policies')
    else:
        ai=[s for s in steps if s.get('type')=='AI']
        if not ai:errors.append(f'{tid}: AI operation has no AI step')
        if int(d.get('max_output_tokens') or 0)<8000:errors.append(f'{tid}: AI budget must be >= 8000')
        if not (p.parent/'prompt.md').is_file():errors.append(f'{tid}: missing prompt.md')
        for s in ai:
            if s.get('prompt')!='prompt.md':errors.append(f'{tid}/{s.get("id")}: prompt must be operation-local prompt.md')
            if s.get('output')=='json' and not (OPERATIONS/'schemas'/f'{s.get("schema")}.json').is_file():errors.append(f'{tid}/{s.get("id")}: missing schema')
if set(defs)!=EXPECTED:errors.append(f'operation ids differ: missing={sorted(EXPECTED-set(defs))}, extra={sorted(set(defs)-EXPECTED)}')
if defs.get('assistant.chat',{}).get('visibility')!='internal':errors.append('assistant.chat must stay outside the researcher Operations Workshop')
for tid in PUBLIC:
    if defs.get(tid,{}).get('visibility')=='internal':errors.append(f'{tid}: public OPERATION cannot be internal')
for tid,kind in {'dataset.analyze':'DETERMINISTIC','dataset.correct-safe':'DETERMINISTIC','dataset.resolve-ambiguities':'AI','design.infer':'AI','results.interpret':'AI','report.generate':'AI','report.improve':'AI','nomad.prepare':'DETERMINISTIC'}.items():
    if defs.get(tid,{}).get('type')!=kind:errors.append(f'{tid}: expected {kind}')
if 'dataset.analyze' not in (defs.get('dataset.resolve-ambiguities',{}).get('requires') or []):errors.append('dataset.resolve-ambiguities must require dataset.analyze')
step_source=(ROOT/'assets/js/ai/operation-steps.js').read_text()
for tid,d in defs.items():
    for s in d.get('steps',[]):
        fn=s.get('fn')
        if fn and ("'"+fn+"':function") not in step_source:errors.append(f'{tid}/{s.get("id")}: unknown deterministic fn {fn}')
render='\n'.join(p.read_text() for p in (ROOT/'assets/js/pages').glob('*.js')); rendered=set(re.findall(r'data-operation="([^"]+)"',render)); unknown={x for x in rendered-set(defs) if '+' not in x and 'C.escapeHtml' not in x}
if unknown:errors.append('UI references unknown operations: '+', '.join(sorted(unknown)))
active='\n'.join(p.read_text(errors='ignore') for p in list((ROOT/'assets/js').rglob('*.js'))+[ROOT/'index.html'])
for marker in ('ActionRunner','ActionRegistry','data-ai-action','derived.actions','activityContinue'):
    if marker in active:errors.append('legacy marker remains: '+marker)
if errors:
    print('Operation contract: FAILED');[print(' - '+e) for e in errors];raise SystemExit(1)
print(f'Operation contract: OK ({len(PUBLIC)} researcher operations + Assistant capability; {sum(defs[x]["type"]=="AI" for x in PUBLIC)} AI, {sum(defs[x]["type"]=="DETERMINISTIC" for x in PUBLIC)} deterministic)')
