#!/usr/bin/env python3
"""Validate the single current LabFlow Action contract.

Actions are user-facing capabilities. Deterministic data lifecycle work belongs to
DataPipeline/local services. The catalog is discovery-based: every
actions/<id>/action.json must be self-contained and valid against this contract.
"""
from __future__ import annotations
import json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ACTIONS=ROOT/'actions'
ROLES={'automatic','researcher','assistant'}
VIS={'public','internal'}
MODES={'ai','hybrid','deterministic'}
RESULT_FORMATS={'json','text'}
EFFECT_MODES={'read_only','store_derived','store_proposal','apply'}
CARDINALITIES={'one','many'}
FORBIDDEN_TOP_LEVEL={'type','steps','input','output','input_scope','mutation_scope','requires','max_input_tokens','max_output_tokens','prerequisites','mutation'}
FORBIDDEN_CONTRACT={'mutation','prerequisites','requires','input','output'}
errors=[]; defs={}

def err(msg): errors.append(msg)

def load_json(path):
    try:return json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:err(f'{path}: invalid JSON: {exc}');return None

for p in sorted(ACTIONS.glob('*/action.json')):
    d=load_json(p)
    if not isinstance(d,dict):continue
    aid=str(d.get('id') or '').strip()
    if not aid:err(f'{p}: id is required');continue
    if aid in defs:err(f'{aid}: duplicate Action id')
    defs[aid]=d
    if aid!=p.parent.name:err(f'{p}: id must match directory')
    for k in ('id','title','category','role','visibility','purpose','strategy','contract','execution'):
        if k not in d:err(f'{aid}: missing {k}')
    forbidden=sorted(FORBIDDEN_TOP_LEVEL.intersection(d))
    if forbidden:err(f'{aid}: obsolete top-level fields are forbidden: {", ".join(forbidden)}')
    if d.get('role') not in ROLES:err(f'{aid}: invalid role {d.get("role")}')
    if d.get('visibility') not in VIS:err(f'{aid}: invalid visibility {d.get("visibility")}')
    ui=d.get('ui') if isinstance(d.get('ui'),dict) else {}
    if d.get('visibility')=='public':
        command=str(ui.get('command') or '').strip()
        routes=ui.get('routes')
        if not command.startswith('/') or ' ' in command.strip('/'):err(f'{aid}: public Action ui.command must be one slash command such as /resolve')
        if not isinstance(routes,list) or not routes or any(not isinstance(x,str) or not x.strip() for x in routes):err(f'{aid}: public Action ui.routes must list one or more recommended application routes')
        bindings=ui.get('bindings',{})
        if not isinstance(bindings,dict) or any(not isinstance(k,str) or not k.strip() or not isinstance(v,str) or not v.strip() for k,v in bindings.items()):err(f'{aid}: ui.bindings must map Action parameter names to application-state paths')

    contract=d.get('contract') if isinstance(d.get('contract'),dict) else {}
    bad=sorted(FORBIDDEN_CONTRACT.intersection(contract))
    if bad:err(f'{aid}: obsolete contract fields are forbidden: {", ".join(bad)}')
    for key in ('target','context','result','effect','guards'):
        if key not in contract:err(f'{aid}: contract.{key} is required')

    target=contract.get('target') if isinstance(contract.get('target'),dict) else {}
    if not str(target.get('kind') or '').strip():err(f'{aid}: contract.target.kind is required')
    if target.get('cardinality') not in CARDINALITIES:err(f'{aid}: contract.target.cardinality must be one|many')
    selection_param=str(target.get('selection_param') or '').strip()
    if selection_param and d.get('visibility')=='public' and selection_param not in (ui.get('bindings') or {}):err(f'{aid}: public Action target.selection_param {selection_param} must have a ui.bindings entry')
    if target.get('minimum') is not None:
        try: minimum=int(target['minimum'])
        except Exception:err(f'{aid}: contract.target.minimum must be an integer')
        else:
            if minimum<1:err(f'{aid}: contract.target.minimum must be >= 1')
            if target.get('cardinality')!='many':err(f'{aid}: contract.target.minimum is only valid for cardinality=many')

    context=contract.get('context') if isinstance(contract.get('context'),dict) else {}
    if not str(context.get('profile') or '').strip():err(f'{aid}: contract.context.profile is required')
    if not str(context.get('scope') or '').strip():err(f'{aid}: contract.context.scope is required')

    result=contract.get('result') if isinstance(contract.get('result'),dict) else {}
    if result.get('format') not in RESULT_FORMATS:err(f'{aid}: contract.result.format must be json|text')
    if not str(result.get('kind') or '').strip():err(f'{aid}: contract.result.kind is required')
    sid=str(result.get('schema') or '').strip()
    if result.get('format')=='json' and sid and not (ACTIONS/'schemas'/f'{sid}.json').is_file():err(f'{aid}: contract.result.schema {sid} does not exist')
    if result.get('format')=='text' and sid:err(f'{aid}: text result must not declare a JSON schema')

    effect=contract.get('effect') if isinstance(contract.get('effect'),dict) else {}
    if effect.get('mode') not in EFFECT_MODES:err(f'{aid}: contract.effect.mode must be one of {sorted(EFFECT_MODES)}')
    writes=effect.get('writes')
    if not isinstance(writes,list) or any(not isinstance(x,str) or not x.strip() for x in writes):err(f'{aid}: contract.effect.writes must be an array of non-empty paths')
    elif effect.get('mode')=='read_only' and writes:err(f'{aid}: read_only Action must not declare write targets')
    elif effect.get('mode')!='read_only' and not writes:err(f'{aid}: {effect.get("mode")} Action must declare at least one write target')

    guards=contract.get('guards')
    if not isinstance(guards,list) or not guards or any(not isinstance(x,str) or not x.strip() for x in guards):err(f'{aid}: contract.guards must be a non-empty array of guard ids')
    elif len(guards)!=len(set(guards)):err(f'{aid}: contract.guards contains duplicates')

    execution=d.get('execution') if isinstance(d.get('execution'),dict) else {}
    mode=str(execution.get('mode') or '').lower()
    if mode not in MODES:err(f'{aid}: execution.mode must be ai|hybrid|deterministic')
    steps=execution.get('steps') if isinstance(execution.get('steps'),list) else []
    if not steps:err(f'{aid}: execution.steps must contain at least one step');continue
    step_ids=[s.get('id') for s in steps]
    if None in step_ids or '' in step_ids or len(step_ids)!=len(set(step_ids)):err(f'{aid}: step ids must be present and unique')
    result_step=str(execution.get('result_step') or '').strip()
    if not result_step:err(f'{aid}: execution.result_step is required')
    elif result_step not in step_ids:err(f'{aid}: execution.result_step must reference a declared step')

    ai=[s for s in steps if s.get('type')=='AI']; det=[s for s in steps if s.get('type')=='DETERMINISTIC']
    if len(ai)+len(det)!=len(steps):err(f'{aid}: step type must be AI or DETERMINISTIC')
    expected='hybrid' if ai and det else ('ai' if ai else 'deterministic')
    if mode!=expected:err(f'{aid}: execution.mode must be {expected} for declared steps')
    for step in det:
        if not str(step.get('tool') or '').strip():err(f'{aid}/{step.get("id")}: deterministic step requires tool')
        if 'fn' in step:err(f'{aid}/{step.get("id")}: fn is unsupported; register a deterministic tool')
    prompt=p.parent/'prompt.md'
    if ai:
        if not prompt.is_file():err(f'{aid}: AI Action missing prompt.md')
        if not isinstance(d.get('policies'),list) or not d.get('policies'):err(f'{aid}: AI Action requires policies[]')
        for step in ai:
            if step.get('prompt')!='prompt.md':err(f'{aid}/{step.get("id")}: AI step must use prompt.md')
            if step.get('thinking') not in {'off','auto','on'}:err(f'{aid}/{step.get("id")}: thinking must be off|auto|on')
            for key,lo,hi in [('max_input_tokens',256,262144),('max_output_tokens',16,1048576)]:
                try:value=int(step.get(key))
                except Exception:err(f'{aid}/{step.get("id")}: {key} must be an integer');continue
                if not lo<=value<=hi:err(f'{aid}/{step.get("id")}: {key} must be {lo}..{hi}')
            if step.get('output')=='json':
                ss=str(step.get('schema') or '').strip()
                if not ss or not (ACTIONS/'schemas'/f'{ss}.json').is_file():err(f'{aid}/{step.get("id")}: JSON output requires a registered schema')
            elif step.get('schema'):err(f'{aid}/{step.get("id")}: non-JSON AI step must not declare schema')
            if step.get('validate_with') is not None and not str(step.get('validate_with') or '').strip():err(f'{aid}/{step.get("id")}: validate_with must be a deterministic tool id')
    else:
        if prompt.exists():err(f'{aid}: deterministic Action must not have prompt.md')
        if d.get('policies'):err(f'{aid}: deterministic Action must not carry AI policies')

    # The semantic Action result and AI schema must describe one current contract.
    rs=next((s for s in steps if s.get('id')==result_step),None)
    if rs and result.get('format')=='json' and rs.get('type')=='AI':
        if not sid:err(f'{aid}: JSON AI result must declare contract.result.schema')
        elif str(rs.get('schema') or '')!=sid:err(f'{aid}: result_step schema must match contract.result.schema')
    if rs and result.get('format')=='text' and rs.get('type')=='AI' and rs.get('output')!='text':err(f'{aid}: text result_step must request text output')

# Registered deterministic tools.
tool_source=(ROOT/'assets/js/tools/registry.js').read_text(encoding='utf-8')
step_source=(ROOT/'assets/js/ai/action-steps.js').read_text(encoding='utf-8')
tool_ids=set(re.findall(r"'([a-z0-9_.-]+)'\s*:\s*\{",tool_source))
tool_ids.update(re.findall(r"^\s*'([a-z0-9_.-]+)'\s*:\s*function",step_source,re.M))
for aid,d in defs.items():
    for step in (d.get('execution') or {}).get('steps',[]):
        for field in ('tool','validate_with'):
            tid=step.get(field)
            if tid and tid not in tool_ids:err(f'{aid}/{step.get("id")}: unknown deterministic tool {tid} referenced by {field}')

# Guards are independently registered and must resolve.
guard_source=(ROOT/'assets/js/ai/action-guards.js').read_text(encoding='utf-8')
guard_ids=set(re.findall(r"register\('([^']+)'",guard_source))
for aid,d in defs.items():
    for gid in (d.get('contract') or {}).get('guards') or []:
        if gid not in guard_ids:err(f'{aid}: unknown Action guard {gid}')

# Context profiles are registry-based. `review` is deterministic and intentionally
# has no AI packer; all AI profiles must exist in ContextBuilder.
context_source=(ROOT/'assets/js/ai/context.js').read_text(encoding='utf-8')
m=re.search(r'const PACKERS=\{([^}]+)\}',context_source)
profiles=set(re.findall(r'([a-zA-Z0-9_-]+)\s*:',m.group(1))) if m else set()
for aid,d in defs.items():
    prof=str(((d.get('contract') or {}).get('context') or {}).get('profile') or '')
    if prof and prof not in profiles and prof!='review':err(f'{aid}: unknown Context profile {prof}')

# Generic Action surfaces discover public capabilities from manifests; they must
# not grow Action-id switches when a new capability is added.
public_ids={aid for aid,d in defs.items() if d.get('visibility')=='public'}
for rel in ['assets/js/ai/action-capabilities.js','assets/js/ai/assistant.js']:
    text=(ROOT/rel).read_text(encoding='utf-8')
    hardcoded=sorted(aid for aid in public_ids if aid in text)
    if hardcoded:err(f'{rel}: generic Action surface hardcodes public Action ids: {", ".join(hardcoded)}')

# Static UI references must resolve to real Actions.
ui='\n'.join(p.read_text(encoding='utf-8',errors='ignore') for p in (ROOT/'assets/js').rglob('*.js'))
rendered=set(re.findall(r'data-action="([^"]+)"',ui))
unknown={x for x in rendered-set(defs) if '+' not in x and 'escapeHtml' not in x}
if unknown:err('UI references unknown Actions: '+', '.join(sorted(unknown)))

if not defs:err('No Action manifests found')
if errors:
    print('Action contract: FAILED')
    [print(' - '+e) for e in errors]
    raise SystemExit(1)
counts={m:sum(str((d.get('execution') or {}).get('mode'))==m for d in defs.values()) for m in MODES}
print(f'Action contract: OK ({len(defs)} Actions; {counts["ai"]} AI, {counts["hybrid"]} hybrid, {counts["deterministic"]} deterministic; {len(guard_ids)} guards)')
