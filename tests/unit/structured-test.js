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
  t['parse repairs Python JSON literals only outside quoted strings'] = function(){const r=SO.parse('{"ok": True, "off": False, "missing": None, "label": "False None True"}');assert(r.value,{ok:true,off:false,missing:null,label:'False None True'},'python literal repair');assert(r.repaired,true,'repaired flag');};
  t['parse diagnoses truncation'] = function(){const r=SO.parse('{"a":[');assert(r.value,null,'no value');assert(/truncat/i.test(r.diagnosis),true,'diagnosis');};
  t['Design schema requires explicit qualitative chemistry keys for solution suggestions'] = function(){
    const errors=SO.validate('design_suggestion',{status:'suggested',summary:'x',solutions:[{name:'candidate',role:'absorber precursor',solutes:'perovskite precursor family',solvents:'polar aprotic solvent family',provenance_kind:'model_inference',confidence:.4,reason:'inferred'}],stack:[],process:{},unresolved_domains:[],unknowns:[]},{registry:LF.ActionRegistry});
    assert(errors,[],'schema passes');
  };
  t['Design schema has one successful proposal state; missing coverage is retried by the Action']=function(){
    const e=SO.validate('design_suggestion',{status:'insufficient_evidence',summary:'More source context is needed.',solutions:[],stack:[],process:{},unresolved_domains:['solutions','stack','process'],unknowns:['stack materials unknown']},{registry:LF.ActionRegistry});
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
  t['Design normalization preserves Knowledge Base provenance and unresolved domains'] = function(){
    const v=SO.normalizeForSchema('design_suggestion',{solutions:[{name:'Referenced ink',role:'absorber precursor',solutes:'FAI + PbI2',solvents:'DMF + DMSO',provenance_kind:'knowledge_reference',evidence:'KB:formulation.perovskite-precursor-family'}],stack:[],process:{},unresolved_domains:['stack','process'],unknowns:['stack unresolved']});
    assert(v.solutions[0].provenance_kind,'knowledge_reference','KB provenance must survive normalization');
    assert(v.unresolved_domains,['stack','process'],'unresolved domains remain explicit');
    assert(SO.validate('design_suggestion',v,{registry:LF.ActionRegistry}),[],'KB-backed canonical proposal satisfies schema');
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
  t['Export preparation schema accepts provenance metadata on unresolved fields']=function(){
    const out={status:'limited',summary:'Missing metadata remains.',suggestions:[],unresolved:[{projection:'nomad',field_id:'data.institution',reason:'Workspace institution missing.',source_kind:'workspace',confidence:.95,evidence:['workspace:w1']}],warnings:[]};
    assert(SO.validate('export_preparation',out,{registry:LF.ActionRegistry}),[],'unresolved provenance metadata is schema-valid');
  };
  t['Export preparation normalization drops null values from unresolved provider variants']=function(){
    const raw={status:'suggested',summary:'Prepare export metadata.',suggestions:[],unresolved:[{
      projection:'nomad',field_id:'data.institution',reason:'No institution is available.',source_kind:'workspace',
      confidence:.9,evidence:['workspace:w1'],value:null
    }],warnings:[]};
    const out=SO.normalizeForSchema('export_preparation',raw);
    if(Object.prototype.hasOwnProperty.call(out.unresolved[0],'value'))throw new Error('unresolved value:null must be discarded');
    assert(SO.validate('export_preparation',out,{registry:LF.ActionRegistry}),[],'normalized unresolved item satisfies schema');
  };
  t['Export preparation normalization canonicalizes harmless provider aliases without opening the contract']=function(){
    const raw={status:'LIMITED',summary:'Missing.',suggestions:[],unresolved:[{
      projection:'Ready-PV',fieldId:'contact.institution',reason:'Missing institution.',sourceKind:'kb',
      confidence:'74%',evidence:'KB:institution-reference',value:null,extra_transport_field:'drop me'
    }],warnings:['Check workspace.'],transport_meta:{ignored:true}};
    const out=SO.normalizeForSchema('export_preparation',raw);
    assert(out.unresolved[0].projection,'readypv','projection alias');
    assert(out.unresolved[0].field_id,'contact.institution','field alias');
    assert(out.unresolved[0].source_kind,'knowledge_reference','source alias');
    assert(out.unresolved[0].confidence,.74,'percentage confidence');
    if(Object.prototype.hasOwnProperty.call(out,'transport_meta'))throw new Error('top-level transport noise must be discarded');
    if(Object.prototype.hasOwnProperty.call(out.unresolved[0],'extra_transport_field'))throw new Error('item transport noise must be discarded');
    assert(SO.validate('export_preparation',out,{registry:LF.ActionRegistry}),[],'canonical export proposal satisfies schema');
  };
  t['Export preparation normalization reports realistic small-model repairs without retry']=function(){
    const raw={result:{status:'LIMITED',summary:'Nemotron-style unresolved metadata.',suggestions:[],unresolved:[{projection:'NOMAD',fieldId:'data.institution',reason:'Not present in workspace.',sourceKind:'workspace',confidence:'74%',evidence:['workspace:w1'],value:null,analysis_note:'not a proposal'}],warnings:[]}},normalized=SO.normalizeForSchemaWithReport('export_preparation',raw);
    assert(SO.validate('export_preparation',normalized.value,{registry:LF.ActionRegistry}),[],'realistic normalized payload reaches valid contract');
    assert(normalized.report.removedNullValues,1,'null value removed');
    if(normalized.report.canonicalizedKeys<2||normalized.report.normalized<4)throw new Error('normalization report missed safe repairs');
  };
  t['Export preparation does not hide a non-null value attached to unresolved']=function(){
    const out=SO.normalizeForSchema('export_preparation',{status:'limited',summary:'unsafe shape',suggestions:[],unresolved:[{projection:'nomad',field_id:'data.institution',reason:'unknown',value:'Invented University'}],warnings:[]}),errors=SO.validate('export_preparation',out,{registry:LF.ActionRegistry});
    if(!errors.some(function(x){return /unexpected field value/.test(x);}))throw new Error('non-null unresolved value must remain visible to strict validation');
  };
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
