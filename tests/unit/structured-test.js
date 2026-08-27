'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/ai/action-registry.js');
require('../../assets/js/ai/structured.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error((label || 'assert') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}

module.exports = function (t, LF) {
  const SO=LF.StructuredOutput;
  t['parse accepts bare JSON'] = function(){assert(SO.parse('{"a":1}').value,{a:1},'bare JSON');};
  t['parse extracts fenced JSON'] = function(){assert(SO.parse('```json\n{"a":1}\n```').value,{a:1},'fenced JSON');};
  t['parse repairs comments and trailing commas'] = function(){const r=SO.parse('{//x\n"rows":[1,],}');assert(r.value,{rows:[1]},'repair');assert(r.repaired,true,'repaired flag');};
  t['parse diagnoses truncation'] = function(){const r=SO.parse('{"a":[');assert(r.value,null,'no value');assert(/truncat/i.test(r.diagnosis),true,'diagnosis');};
  t['Design schema accepts provider content without asking AI to choose sample identity'] = function(){
    const errors=SO.validate('design_reconstruct',{summary:'x',solutions:[{name:'candidate',provenance_kind:'knowledge',confidence:.4,reason:'retrieved',knowledge_refs:['kb_candidate'],field_confidence:{name:.82}}],devices:[{provenance_kind:'experiment',confidence:1,reason:'test evidence',stack:[]}],unknowns:[]},{registry:LF.ActionRegistry});
    assert(errors,[],'schema passes');
  };
  t['Design schema permits chemistry-only or stack-only suggestions']=function(){const e=SO.validate('design_reconstruct',{summary:'x',solutions:[],devices:[],unknowns:[]},{registry:LF.ActionRegistry});assert(e,[],'missing areas are validated by the deterministic target scope, not a fake device minimum');};
  t['Design normalization accepts common provider variants before schema validation'] = function(){
    const v=SO.normalizeForSchema('design_reconstruct',{assessment:'candidate',solution:{name:'absorber',solutes:['FAI','PbI2'],solvents:['DMF','DMSO']},device_stack:[{function:'substrate',material:'ITO'},{role:'absorber',material:'perovskite'}]});
    assert(v.solutions[0].solutes,'FAI, PbI2','array solutes normalized');
    assert(v.solutions[0].solvents,'DMF, DMSO','array solvents normalized');
    assert(v.solutions[0].provenance_kind,'model_inference','missing provenance becomes conservative model inference');
    assert(v.devices[0].stack.length,2,'root device_stack normalized');
    assert(SO.validate('design_reconstruct',v,{registry:LF.ActionRegistry}),[],'normalized provider output satisfies schema');
  };
  t['Design normalization accepts chemistry-only output without fabricating a device'] = function(){
    const v=SO.normalizeForSchema('design_reconstruct',{summary:'chemistry only',solutions:[{name:'precursor',solutes:'FAI + PbI2',solvents:'DMF:DMSO'}],unknowns:['exact ratio']});
    assert(v.devices,[],'no fake device required');
    assert(SO.validate('design_reconstruct',v,{registry:LF.ActionRegistry}),[],'chemistry-only output satisfies schema');
  };
  t['unknown schema fails closed'] = function(){assert(SO.validate('missing',{} )[0],'SCHEMA_UNKNOWN:missing','unknown schema');};
  t['dataset correction normalization fills safe structural defaults'] = function(){
    const v=SO.normalizeForSchema('dataset_corrections',{proposals:[{patch_type:'reference_classification',target:'measurement:1'}]});
    assert(v.proposals[0].before,null,'missing before');assert(v.proposals[0].after,null,'missing after');assert(v.proposals[0].requires_human_review,true,'human review default');assert(v.unresolved,[],'unresolved default');
  };
  return t;
};
