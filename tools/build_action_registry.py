#!/usr/bin/env python3
"""Build the browser Action registry from actions/*/action.json + optional prompt.md."""
from pathlib import Path
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]
ACTIONS=ROOT/'actions'
actions={}; prompts={}; schemas={}
for p in sorted(ACTIONS.iterdir()):
    if not p.is_dir() or p.name=='schemas' or not (p/'action.json').exists():
        continue
    d=json.loads((p/'action.json').read_text(encoding='utf-8'))
    actions[d['id']]=d
    if (p/'prompt.md').exists():
        prompts[d['id']]=(p/'prompt.md').read_text(encoding='utf-8')
for p in sorted((ACTIONS/'schemas').glob('*.json')):
    schemas[p.stem]=json.loads(p.read_text(encoding='utf-8'))
payload=json.dumps({'actions':actions,'prompts':prompts,'schemas':schemas},sort_keys=True,ensure_ascii=False).encode()
sha=hashlib.sha256(payload).hexdigest()
js=f"""// GENERATED from actions/*/action.json + optional prompt.md. Edit source files, then run tools/build_action_registry.py.
// SOURCE_SHA256: {sha}
(function(){{
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{{}};
  const ACTIONS={json.dumps(actions,ensure_ascii=False,separators=(',',':'))};
  const PROMPTS={json.dumps(prompts,ensure_ascii=False,separators=(',',':'))};
  const SCHEMAS={json.dumps(schemas,ensure_ascii=False,separators=(',',':'))};
  function clone(v){{return v==null?v:JSON.parse(JSON.stringify(v));}}
  function action(id){{return ACTIONS[id]?clone(ACTIONS[id]):null;}}
  function ids(){{return Object.keys(ACTIONS);}}
  function prompt(id){{return PROMPTS[id]||'';}}
  function schema(id){{return SCHEMAS[id]?clone(SCHEMAS[id]):null;}}
  LF.ActionRegistry={{action:action,actions:ids,prompt:prompt,schema:schema,definitions:ACTIONS,schemas:SCHEMAS}};
}}());
"""
(ROOT/'assets/js/ai/action-registry.js').write_text(js,encoding='utf-8')
print('built',len(actions),'actions',sha)
