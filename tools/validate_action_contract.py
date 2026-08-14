#!/usr/bin/env python3
"""Validate the deliberately small LabFlow Action catalog."""
from __future__ import annotations
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; ACTIONS=ROOT/'actions'
EXPECTED={'analysis.enrich','analysis.summarize','assistant.chat','dataset.analyze','dataset.correct-safe','dataset.resolve-ambiguities','design.infer','nomad.prepare','report.generate','report.improve','results.interpret'}
ROLES={'automatic','researcher','assistant'}; VIS={'public','internal'}; TYPES={'AI','HYBRID','DETERMINISTIC'}
errors=[]; defs={}
for p in sorted(ACTIONS.glob('*/action.json')):
    try:d=json.loads(p.read_text())
    except Exception as e:errors.append(f'{p}: invalid JSON: {e}');continue
    aid=d.get('id');defs[aid]=d
    if aid!=p.parent.name:errors.append(f'{p}: id must match directory')
    for k in ('version','id','title','category','role','purpose','strategy','type','input_scope','output','mutation_scope','steps','visibility'):
        if k not in d:errors.append(f'{aid}: missing {k}')
    if d.get('version')!=1:errors.append(f'{aid}: version must be 1')
    if d.get('type') not in TYPES:errors.append(f'{aid}: invalid type')
    if d.get('role') not in ROLES:errors.append(f'{aid}: invalid role {d.get("role")}')
    if d.get('visibility') not in VIS:errors.append(f'{aid}: invalid visibility')
    if not str(d.get('input_scope') or '').strip():errors.append(f'{aid}: empty input_scope')
    if d.get('mutation_scope') not in ('','dataset','design','report','metadata','nomad'):errors.append(f'{aid}: invalid mutation_scope')
    if d.get('mutation_scope') and d.get('role')!='researcher':errors.append(f'{aid}: mutating Actions must be researcher-triggered')
    for text_field in ('title','purpose','strategy','output'):
        if not str(d.get(text_field) or '').strip():errors.append(f'{aid}: empty {text_field}')
    steps=d.get('steps') or []
    if not steps:errors.append(f'{aid}: no steps');continue
    step_ids=[s.get('id') for s in steps]
    if None in step_ids or len(step_ids)!=len(set(step_ids)):errors.append(f'{aid}: step ids must be present and unique')
    ai=[s for s in steps if s.get('type')=='AI']; det=[s for s in steps if s.get('type')=='DETERMINISTIC']
    if len(ai)+len(det)!=len(steps):errors.append(f'{aid}: unsupported step type')
    expected_type='HYBRID' if ai and det else ('AI' if ai else 'DETERMINISTIC')
    if d.get('type')!=expected_type:errors.append(f'{aid}: type must be {expected_type} for its declared steps')
    prompt=p.parent/'prompt.md'
    if ai:
        if not prompt.is_file():errors.append(f'{aid}: AI Action missing prompt.md')
        if not d.get('policies'):errors.append(f'{aid}: AI Action requires provenance/policy contract')
        for s in ai:
            if s.get('prompt')!='prompt.md':errors.append(f'{aid}/{s.get("id")}: AI step must use action-local prompt.md')
            budget=int(s.get('max_output_tokens') or d.get('max_output_tokens') or 0)
            if not 256<=budget<=32768:errors.append(f'{aid}/{s.get("id")}: output budget must be 256..32768')
            if s.get('output')=='json':
                sid=s.get('schema')
                if not sid or not (ACTIONS/'schemas'/f'{sid}.json').is_file():errors.append(f'{aid}/{s.get("id")}: JSON output requires a registered schema')
    else:
        if prompt.exists():errors.append(f'{aid}: deterministic Action must not have prompt.md')
        if d.get('policies'):errors.append(f'{aid}: deterministic Action must not carry AI policies')
    for req in d.get('requires') or []:
        if req not in EXPECTED:errors.append(f'{aid}: unknown dependency {req}')
if set(defs)!=EXPECTED:errors.append(f'Action ids differ: missing={sorted(EXPECTED-set(defs))}, extra={sorted(set(defs)-EXPECTED)}')
step_source=(ROOT/'assets/js/ai/action-steps.js').read_text()
for aid,d in defs.items():
    for s in d.get('steps',[]):
        fn=s.get('fn')
        if fn and ("'"+fn+"':function") not in step_source:errors.append(f'{aid}/{s.get("id")}: unknown deterministic fn {fn}')
# Static UI references must resolve to an Action id when literal.
ui='\n'.join(p.read_text(errors='ignore') for p in (ROOT/'assets/js').rglob('*.js'))
rendered=set(re.findall(r'data-action="([^"]+)"',ui)); unknown={x for x in rendered-set(defs) if '+' not in x and 'escapeHtml' not in x}
if unknown:errors.append('UI references unknown Actions: '+', '.join(sorted(unknown)))
# There must be one source/runner/context/editor system, not Operations + Helpers twins.
active='\n'.join(p.read_text(errors='ignore') for p in list((ROOT/'assets/js').rglob('*.js'))+[ROOT/'index.html'])
for marker in ('OperationRunner','OperationRegistry','OperationContext','data-operation=','Operations Workshop','AI Helpers'):
    if marker in active:errors.append('legacy execution marker remains: '+marker)
if not (ROOT/'assets/js/ai/action-registry.js').is_file():errors.append('generated Action registry missing')
if not (ROOT/'assets/js/ai/actions.js').is_file():errors.append('Action runner missing')
if not (ROOT/'assets/js/ai/action-ui.js').is_file():errors.append('Action totem bridge missing')
if errors:
    print('Action contract: FAILED');[print(' - '+e) for e in errors];raise SystemExit(1)
print(f'Action contract: OK ({len(defs)} Actions; {sum(d["type"]=="AI" for d in defs.values())} AI, {sum(d["type"]=="HYBRID" for d in defs.values())} hybrid, {sum(d["type"]=="DETERMINISTIC" for d in defs.values())} deterministic)')
