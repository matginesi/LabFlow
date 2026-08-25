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
    const errors=SO.validate('design_reconstruct',{summary:'x',solutions:[{name:'candidate',provenance_kind:'knowledge',confidence:.4,reason:'retrieved',knowledge_refs:['kb_candidate'],field_confidence:{name:.82}}],devices:[{provenance_kind:'experiment',confidence:1,reason:'test evidence'}],unknowns:[]},{registry:LF.ActionRegistry});
    assert(errors,[],'schema passes');
  };
  t['schema enforces array minimums']=function(){const e=SO.validate('design_reconstruct',{summary:'x',solutions:[],devices:[],unknowns:[]},{registry:LF.ActionRegistry});assert(e.some(function(x){return /at least 1/.test(x);}),true,'min items');};
  t['unknown schema fails closed'] = function(){assert(SO.validate('missing',{} )[0],'SCHEMA_UNKNOWN:missing','unknown schema');};
  t['dataset correction normalization fills safe structural defaults'] = function(){
    const v=SO.normalizeForSchema('dataset_corrections',{proposals:[{patch_type:'reference_classification',target:'measurement:1'}]});
    assert(v.proposals[0].before,null,'missing before');assert(v.proposals[0].after,null,'missing after');assert(v.proposals[0].requires_human_review,true,'human review default');assert(v.unresolved,[],'unresolved default');
  };
  return t;
};
