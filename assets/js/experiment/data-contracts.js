(function(){
'use strict';
const LF=window.LabFlow=window.LabFlow||{},Schema=LF.DomainSchema;
if(!Schema)throw new Error('LabFlow.DomainSchema must be loaded before data-contracts.js.');

function add(list,code,message,record,path){list.push({code:code,message:message,recordId:record&&record.id||'',path:path||''});}
function present(value){return value!==undefined&&value!==null&&value!=='';}
function ids(rows){const set=new Set();(rows||[]).forEach(function(x){if(x&&x.id)set.add(String(x.id));});return set;}
function includesId(values,id){return(values||[]).map(String).includes(String(id));}
function duplicates(values){const seen=new Set(),out=[];(values||[]).forEach(function(v){v=String(v);if(seen.has(v)&&!out.includes(v))out.push(v);seen.add(v);});return out;}
function collectionForKind(kind){return {file:'files',experiment:'experiments',sample:'samples',run:'runs',measurement:'measurements',finding:'findings',block:'blocks',patch:'patches'}[kind]||'';}
function relationIds(exp){const out={dataset:new Set([String(exp&&exp.id||'')].filter(Boolean))};Schema.rootFields().forEach(function(meta){if(meta.recordKind)out[meta.recordKind]=ids(exp[meta.key]);});out.design_solution=ids(exp.design&&exp.design.solutions);out.design_device=ids(exp.design&&exp.design.devices);return out;}
function relationValues(record,field){const value=record&&record[field];return Array.isArray(value)?value:(value==null||value===''?[]:[value]);}

function validateRecordShape(errors,warnings,record,kind,path){
  const spec=Schema.describe(kind);if(!spec)return;
  const id=String(record&&record.id||'');
  (spec.required||[]).forEach(function(field){if(!present(record&&record[field]))add(errors,'FIELD_REQUIRED',kind+' '+(id||'(missing id)')+' requires '+field+'.',record,path+'.'+field);});
  if(record&&record.kind!==kind)add(errors,'KIND_INVALID',kind+' '+(id||'(missing id)')+' must declare kind="'+kind+'".',record,path+'.kind');
  Object.keys(spec.relations||{}).forEach(function(field){if(Array.isArray(record&&record[field]))duplicates(record[field]).forEach(function(v){add(errors,'DUPLICATE_RELATION',kind+' '+id+' contains duplicate '+field+' reference '+v+'.',record,path+'.'+field);});});
  if(kind==='measurement'){
    if(record.sequence!=null&&!Number.isFinite(Number(record.sequence)))add(warnings,'MEASUREMENT_SEQUENCE_INVALID','Measurement sequence is not numeric.',record,path+'.sequence');
    if(!record.fw&&!record.rv&&!(record.curve&&((record.curve.fw||[]).length||(record.curve.rv||[]).length)))add(warnings,'MEASUREMENT_SCAN_MISSING','Measurement has no parsed FW/RV metrics or curve.',record,path);
  }
  if(kind==='patch'){
    if(!record.target||!record.target.kind||!record.target.id)add(errors,'PATCH_TARGET_REQUIRED','Patch '+id+' requires a typed target {kind,id}.',record,path+'.target');
    if(!['set','remove','add'].includes(record.operation))add(errors,'PATCH_OPERATION_INVALID','Patch '+id+' has unsupported operation '+String(record.operation)+'.',record,path+'.operation');
    if(!['applied','proposed','rejected','superseded'].includes(record.status))add(errors,'PATCH_STATUS_INVALID','Patch '+id+' has unsupported status '+String(record.status)+'.',record,path+'.status');
  }
  if(kind==='block'){
    (record.refs||[]).forEach(function(ref,i){if(!ref||!ref.kind||!ref.id)add(errors,'BLOCK_REF_INVALID','Block '+id+' has an invalid typed reference.',record,path+'.refs.'+i);});
  }
}

function validateRelations(exp,errors,sets,record,kind,path){
  const spec=Schema.describe(kind);if(!spec)return;
  Object.keys(spec.relations||{}).forEach(function(field){const targetKind=spec.relations[field],targetSet=sets[targetKind];if(!targetSet)return;relationValues(record,field).filter(Boolean).forEach(function(value){if(!targetSet.has(String(value)))add(errors,'BROKEN_RELATION',kind+' '+record.id+' references unknown '+targetKind+' '+value+' through '+field+'.',record,path+'.'+field);});});
}

function validateBacklinks(exp,errors,maps){
  (exp.samples||[]).forEach(function(s){const e=maps.experiment.get(String(s.experimentId||''));if(e&&!includesId(e.sampleIds,s.id))add(errors,'MISSING_EXPERIMENT_SAMPLE_BACKLINK','Experiment '+e.id+' does not link back to sample '+s.id+'.',s,'samples');});
  (exp.runs||[]).forEach(function(r){const e=maps.experiment.get(String(r.experimentId||'')),s=maps.sample.get(String(r.sampleId||''));if(e&&!includesId(e.runIds,r.id))add(errors,'MISSING_EXPERIMENT_RUN_BACKLINK','Experiment '+e.id+' does not link back to run '+r.id+'.',r,'runs');if(s&&!includesId(s.runIds,r.id))add(errors,'MISSING_SAMPLE_RUN_BACKLINK','Sample '+s.id+' does not link back to run '+r.id+'.',r,'runs');if(s&&String(s.experimentId)!==String(r.experimentId))add(errors,'RUN_PARENT_MISMATCH','Run '+r.id+' and sample '+s.id+' disagree on experimentId.',r,'runs');});
  (exp.measurements||[]).forEach(function(m){const e=maps.experiment.get(String(m.experimentId||'')),s=maps.sample.get(String(m.sampleId||'')),r=m.runId?maps.run.get(String(m.runId)):null;if(e&&!includesId(e.measurementIds,m.id))add(errors,'MISSING_EXPERIMENT_MEASUREMENT_BACKLINK','Experiment '+e.id+' does not link back to measurement '+m.id+'.',m,'measurements');if(s&&!includesId(s.measurementIds,m.id))add(errors,'MISSING_SAMPLE_MEASUREMENT_BACKLINK','Sample '+s.id+' does not link back to measurement '+m.id+'.',m,'measurements');if(r&&!includesId(r.measurementIds,m.id))add(errors,'MISSING_RUN_MEASUREMENT_BACKLINK','Run '+r.id+' does not link back to measurement '+m.id+'.',m,'measurements');if(s&&String(s.experimentId)!==String(m.experimentId))add(errors,'MEASUREMENT_PARENT_MISMATCH','Measurement '+m.id+' and sample '+s.id+' disagree on experimentId.',m,'measurements');if(r&&(String(r.sampleId)!==String(m.sampleId)||String(r.experimentId)!==String(m.experimentId)))add(errors,'MEASUREMENT_RUN_MISMATCH','Measurement '+m.id+' disagrees with run '+r.id+' parent links.',m,'measurements');});
}

function validate(exp){
  if(!exp||typeof exp!=='object')return{ok:false,errors:[{code:'DATASET_REQUIRED',message:'ExperimentData is required.',recordId:'',path:''}],warnings:[],counts:{}};
  const errors=[],warnings=[],source=exp,actionData=source.actionData;
  // Validate persisted ActionData before hydration. Hydration normalizes malformed values
  // for runtime safety and must not hide a broken persisted contract from validation.
  if(!actionData||typeof actionData!=='object'||Array.isArray(actionData))add(errors,'ACTION_DATA_INVALID','actionData must be the single persisted Action-output store.',source,'actionData');
  else ['proposals','annotations','status'].forEach(function(k){if(!actionData[k]||typeof actionData[k]!=='object'||Array.isArray(actionData[k]))add(errors,'ACTION_DATA_BUCKET_INVALID','actionData.'+k+' must be an object keyed by Action id.',source,'actionData.'+k);});
  exp=LF.DataModel&&LF.DataModel.hydrate?LF.DataModel.hydrate(exp):Schema.normalizeRoot(exp);
  const sets=relationIds(exp),maps={};
  ['experiment','sample','run','measurement'].forEach(function(kind){const key=collectionForKind(kind);maps[kind]=new Map((exp[key]||[]).filter(function(x){return x&&x.id;}).map(function(x){return[String(x.id),x];}));});

  Schema.rootFields().forEach(function(meta){
    if(!meta.recordKind)return;const rows=exp[meta.key]||[],seen=new Set();
    rows.forEach(function(record,index){const path=meta.key+'['+index+']',id=String(record&&record.id||'');if(!id)add(errors,'ID_REQUIRED',meta.recordKind+' record has no id.',record,path);else if(seen.has(id))add(errors,'ID_DUPLICATE','Duplicate '+meta.recordKind+' id: '+id,record,path);else seen.add(id);validateRecordShape(errors,warnings,record,meta.recordKind,path);validateRelations(exp,errors,sets,record,meta.recordKind,path);});
  });

  // Generic typed block references.
  (exp.blocks||[]).forEach(function(block,bi){(block.refs||[]).forEach(function(ref,ri){const set=sets[ref.kind];if(!set)add(errors,'BLOCK_REF_KIND_UNKNOWN','Block '+block.id+' references unsupported kind '+ref.kind+'.',block,'blocks['+bi+'].refs['+ri+']');else if(!set.has(String(ref.id)))add(errors,'BLOCK_REF_BROKEN','Block '+block.id+' references missing '+ref.kind+' '+ref.id+'.',block,'blocks['+bi+'].refs['+ri+']');});});
  // Patch targets are authoritative provenance links.
  (exp.patches||[]).forEach(function(p,pi){if(!p.target||!p.target.kind||!p.target.id)return;const set=sets[p.target.kind];if(!set)add(errors,'PATCH_TARGET_KIND_UNKNOWN','Patch '+p.id+' targets unsupported kind '+p.target.kind+'.',p,'patches['+pi+'].target');else if(!set.has(String(p.target.id)))add(errors,'PATCH_TARGET_BROKEN','Patch '+p.id+' targets missing '+p.target.kind+' '+p.target.id+'.',p,'patches['+pi+'].target');});

  validateBacklinks(exp,errors,maps);

  // Design is a projection over stable domain IDs; names are display caches only.
  const solutionIds=sets.design_solution||new Set(),sampleIds=sets.sample||new Set(),experimentIds=sets.experiment||new Set();
  (exp.design&&exp.design.solutions||[]).forEach(function(x,i){validateRecordShape(errors,warnings,x,'design_solution','design.solutions['+i+']');});
  (exp.design&&exp.design.stack||[]).forEach(function(x,i){validateRecordShape(errors,warnings,x,'design_layer','design.stack['+i+']');});
  (exp.design&&exp.design.devices||[]).forEach(function(d,i){const path='design.devices['+i+']';validateRecordShape(errors,warnings,d,'design_device',path);if(d.experimentId&&!experimentIds.has(String(d.experimentId)))add(errors,'DESIGN_EXPERIMENT_BROKEN','Design device '+d.id+' references missing experiment '+d.experimentId+'.',d,path+'.experimentId');(d.sampleIds||[]).forEach(function(id){if(!sampleIds.has(String(id)))add(errors,'DESIGN_SAMPLE_BROKEN','Design device '+d.id+' references missing sample '+id+'.',d,path+'.sampleIds');});(d.solutionIds||[]).forEach(function(id){if(!solutionIds.has(String(id)))add(errors,'DESIGN_SOLUTION_BROKEN','Design device '+d.id+' references missing solution '+id+'.',d,path+'.solutionIds');});(d.stack||[]).forEach(function(layer,li){validateRecordShape(errors,warnings,layer,'design_layer',path+'.stack['+li+']');});});

  return{ok:errors.length===0,errors:errors,warnings:warnings,counts:{files:exp.files.length,blocks:exp.blocks.length,patches:exp.patches.length,experiments:exp.experiments.length,samples:exp.samples.length,runs:exp.runs.length,measurements:exp.measurements.length,findings:exp.findings.length,designDevices:exp.design&&exp.design.devices?exp.design.devices.length:0}};
}
function assertValid(exp){const out=validate(exp);if(!out.ok){const e=new Error('ExperimentData contract failed: '+out.errors.slice(0,8).map(function(x){return x.message;}).join(' | '));e.code='DATA_CONTRACT_INVALID';e.validation=out;throw e;}return out;}
function describe(type){return Schema.describe(String(type||'').toLowerCase())||({scan:{label:'JV scan',description:'FW or RV direction contained by one measurement.'},result:{label:'Deterministic result',description:'Recomputable projection derived from the LabFlow Data.'}}[String(type||'').toLowerCase()]||null);}
function types(){return Schema.kinds().concat(['scan','result']);}
function rootFields(){return Schema.rootFields();}
LF.DataContracts={types:types,describe:describe,rootFields:rootFields,validate:validate,assert:assertValid};
}());
