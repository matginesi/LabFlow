#!/usr/bin/env python3
"""Rebuild the browser Operation registry from operations/*/operation.json."""
from pathlib import Path
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]
operations={}; prompts={}; schemas={}
for p in sorted((ROOT/'operations').iterdir()):
    if not p.is_dir() or p.name=='schemas' or not (p/'operation.json').exists():
        continue
    d=json.loads((p/'operation.json').read_text(encoding='utf-8'))
    operations[d['id']]=d
    if (p/'prompt.md').exists(): prompts[d['id']]=(p/'prompt.md').read_text(encoding='utf-8')
for p in sorted((ROOT/'operations/schemas').glob('*.json')):
    schemas[p.stem]=json.loads(p.read_text(encoding='utf-8'))
payload=json.dumps({'operations':operations,'prompts':prompts,'schemas':schemas},sort_keys=True,ensure_ascii=False).encode()
sha=hashlib.sha256(payload).hexdigest()
js=f"""// GENERATED from operations/*/operation.json + prompt.md. Edit source files, then run tools/build_operation_registry.py.
// SOURCE_SHA256: {sha}
(function(){{
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{{}};
  const OPERATIONS={json.dumps(operations,ensure_ascii=False,separators=(',',':'))};
  const PROMPTS={json.dumps(prompts,ensure_ascii=False,separators=(',',':'))};
  const SCHEMAS={json.dumps(schemas,ensure_ascii=False,separators=(',',':'))};
  function clone(v){{return v==null?v:JSON.parse(JSON.stringify(v));}}
  function operation(id){{return OPERATIONS[id]?clone(OPERATIONS[id]):null;}}
  function ids(){{return Object.keys(OPERATIONS);}}
  function prompt(id){{return PROMPTS[id]||'';}}
  function schema(id){{return SCHEMAS[id]?clone(SCHEMAS[id]):null;}}
  LF.OperationRegistry={{operation:operation,operations:ids,prompt:prompt,schema:schema,definitions:OPERATIONS,schemas:SCHEMAS}};
}}());
"""
(ROOT/'assets/js/ai/operation-registry.js').write_text(js,encoding='utf-8')
print('built',len(operations),'operations',sha)
