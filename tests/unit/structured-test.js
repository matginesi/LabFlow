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
  t['Design schema requires explicit qualitative chemistry keys for solution suggestions'] = function(){
    const errors=SO.validate('design_suggestion',{status:'suggested',summary:'x',solutions:[{name:'candidate',role:'absorber precursor',solutes:'perovskite precursor family',solvents:'polar aprotic solvent family',provenance_kind:'model_inference',confidence:.4,reason:'inferred'}],stack:[],process:{},unknowns:[]},{registry:LF.ActionRegistry});
    assert(errors,[],'schema passes');
  };
  t['Design schema has one successful proposal state; missing coverage is retried by the Action']=function(){
    const e=SO.validate('design_suggestion',{status:'insufficient_evidence',summary:'More source context is needed.',solutions:[],stack:[],process:{},unknowns:['stack materials unknown']},{registry:LF.ActionRegistry});
    if(!e.length)throw new Error('insufficient_evidence must not be a successful Design proposal state');
  };
  t['Design normalization reduces common provider variants to one canonical model-facing shape'] = function(){
    const v=SO.normalizeForSchema('design_suggestion',{assessment:'candidate',solution:{name:'absorber',solutes:['FAI','PbI2'],solvents:['DMF','DMSO']},device_stack:[{function:'substrate',material:'ITO'},{role:'absorber',material:'perovskite'}]});
    assert(v.status,'suggested','status inferred from content');
    assert(v.solutions[0].solutes,'FAI, PbI2','array solutes normalized');
    assert(v.solutions[0].solvents,'DMF, DMSO','array solvents normalized');
    assert(v.solutions[0].provenance_kind,'model_inference','missing provenance becomes conservative model inference');
    assert(v.stack.length,2,'root device_stack normalized');
    assert(SO.validate('design_suggestion',v,{registry:LF.ActionRegistry}),[],'normalized provider output satisfies schema');
  };
  t['Design normalization preserves chemistry when provider omits a display name'] = function(){
    const v=SO.normalizeForSchema('design_suggestion',{solutions:[{role:'absorber precursor',solutes:['FAI','PbI2'],solvents:['DMF','DMSO']}],stack:[],process:{},unknowns:[]});
    assert(v.status,'suggested','chemistry remains useful');
    assert(v.solutions[0].name,'Absorber Precursor','role becomes deterministic display name');
    assert(v.solutions[0].solutes,'FAI, PbI2','solute list preserved');
    assert(v.solutions[0].solvents,'DMF, DMSO','solvent list preserved');
    assert(SO.validate('design_suggestion',v,{registry:LF.ActionRegistry}),[],'provider variant satisfies canonical schema');
  };
  t['Design normalization accepts keyed solution maps and top-level chemistry'] = function(){
    const keyed=SO.normalizeForSchema('design_suggestion',{solutions:{absorber:{solutes:'FAI + PbI2',solvents:'DMF + DMSO'}},stack:[],process:{},unknowns:[]});
    assert(keyed.solutions[0].name,'absorber','map key becomes name');
    assert(keyed.solutions[0].solvents,'DMF + DMSO','map solvent preserved');
    const root=SO.normalizeForSchema('design_suggestion',{solutes:'PEAI',solvents:'IPA',solution_role:'passivation'});
    assert(root.solutions[0].solutes,'PEAI','top-level solute preserved');
    assert(root.solutions[0].solvents,'IPA','top-level solvent preserved');
  };
  t['Design normalization never fabricates content when coverage is empty'] = function(){
    const v=SO.normalizeForSchema('design_suggestion',{summary:'no reliable reconstruction',solutions:[],unknowns:['exact stack']});
    assert(v.status,'suggested','normalizer returns one candidate state for semantic validation');
    assert(v.stack,[],'no fake device or stack required');
    assert(SO.validate('design_suggestion',v,{registry:LF.ActionRegistry}),[],'candidate shape remains schema-valid before coverage validation');
  };
  t['Design normalization keeps a solvent-only suggestion without a provider name'] = function(){
    const v=SO.normalizeForSchema('design_suggestion',{solutions:[{role:'absorber precursor',solvents:'DMF + DMSO'}],stack:[],process:{},unknowns:[]});
    assert(v.solutions.length,1,'solvent-only suggestion is kept');
    assert(v.solutions[0].name,'Absorber Precursor','role supplies display name');
    assert(v.solutions[0].solvents,'DMF + DMSO','solvent preserved');
    assert(SO.validate('design_suggestion',v,{registry:LF.ActionRegistry}),[],'solvent-only suggestion remains schema-valid');
  };
  t['Design structured recovery accepts labelled provider text when JSON envelope is missing'] = function(){
    const v=SO.recoverForSchema('design_suggestion','Solution role: absorber precursor\nSolvents: DMF + DMSO\nCoating: spin coating\nAtmosphere: inert atmosphere');
    if(!v)throw new Error('expected bounded recovery');
    assert(v.solutions[0].solvents,'DMF + DMSO','recovered solvent');
    assert(v.process.coating,'spin coating','recovered process');
    assert(SO.validate('design_suggestion',v,{registry:LF.ActionRegistry}),[],'recovered text satisfies schema');
  };
  t['Design structured recovery refuses unrelated prose'] = function(){assert(SO.recoverForSchema('design_suggestion','I cannot answer this request.'),null,'unrelated prose stays invalid');};
  t['structured Action contracts reject transport-only fields instead of storing them']=function(){const value=SO.normalizeForSchema('dataset_corrections',{summary:'ok',proposals:[],unresolved:[],reasoning_control:true,reasoning_format:'deepseek',response_format:{type:'json_object'}}),errors=SO.validate('dataset_corrections',value,{registry:LF.ActionRegistry});if(!errors.some(function(x){return /unexpected field (reasoning_control|reasoning_format|response_format)/.test(x);}))throw new Error('transport metadata must fail the semantic schema: '+JSON.stringify(errors));};
  t['unknown schema fails closed'] = function(){assert(SO.validate('missing',{} )[0],'SCHEMA_UNKNOWN:missing','unknown schema');};
  t['dataset correction normalization fills safe structural defaults'] = function(){
    const v=SO.normalizeForSchema('dataset_corrections',{proposals:[{patch_type:'reference_classification',target:'measurement:1'}]});
    assert(v.proposals[0].before,null,'missing before');assert(v.proposals[0].after,null,'missing after');assert(v.proposals[0].requires_human_review,true,'human review default');assert(v.unresolved,[],'unresolved default');
  };
  t['Design structured normalization accepts a process-only useful suggestion']=function(){
    const out=SO.normalizeForSchema('design_suggestion',{status:'suggested',summary:'Process inferred',solutions:[],stack:[],process:{coating:'spin coating',atmosphere:'N2'},unknowns:[]});
    if(!out||out.status!=='suggested'||out.process.coating!=='spin coating')throw new Error('process-only Design suggestion was not normalized');
    assert(SO.validate('design_suggestion',out,{registry:LF.ActionRegistry}),[],'process-only suggestion satisfies schema');
  };
  return t;
};
