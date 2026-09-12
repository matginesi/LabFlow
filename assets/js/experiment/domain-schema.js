(function(){
'use strict';
const LF=window.LabFlow=window.LabFlow||{};
if(!LF.Core)throw new Error('LabFlow.Core must be loaded before domain-schema.js.');
const C=LF.Core,uid=C.uid;
const now=function(){return new Date().toISOString();};
const RECORDS={},ROOT={};

/*
 * Canonical domain vocabulary. These values are data contracts, not UI copy.
 * Keep them here so records, validators and feature services share one spelling.
 */
const VALUES=Object.freeze({
  recordStatus:Object.freeze({
    UNKNOWN:'unknown',
    RAW_EVIDENCE:'raw_evidence',
    USER_CONFIRMED:'user_confirmed',
    AI_INFERRED:'ai_inferred'
  }),
  provenanceKind:Object.freeze({
    EVIDENCE:'evidence',
    EXPERIMENT:'experiment',
    KNOWLEDGE_REFERENCE:'knowledge_reference',
    MODEL_INFERENCE:'model_inference'
  }),
  patchStatus:Object.freeze({
    APPLIED:'applied',
    PROPOSED:'proposed',
    REJECTED:'rejected',
    SUPERSEDED:'superseded'
  }),
  patchSource:Object.freeze({
    SYSTEM:'system',
    AUTOMATIC:'automatic',
    RESEARCHER:'researcher',
    ACTION:'action'
  })
});

function arr(v){return Array.isArray(v)?v:[];}
function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
function text(v){return v==null?'':String(v);}
function finiteOrNull(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function mergeDefaults(base,value){return Object.assign({},base,obj(value));}
function registerRecord(kind,spec){
  if(!kind||!spec||typeof spec.defaults!=='function'||typeof spec.normalize!=='function')throw new Error('Domain record requires kind, defaults and normalize: '+kind);
  if(RECORDS[kind])throw new Error('Duplicate domain record kind: '+kind);
  RECORDS[kind]=Object.assign({label:kind,description:'',idPrefix:kind,required:['id'],relations:{}},spec);
}
function create(kind,seed){const spec=RECORDS[kind];if(!spec)throw new Error('Unknown domain record kind: '+kind);const record=Object.assign(spec.defaults(),obj(seed));return spec.normalize(record);}
function normalize(kind,record){const spec=RECORDS[kind];if(!spec)throw new Error('Unknown domain record kind: '+kind);return spec.normalize(record||{});}
function describe(kind){return RECORDS[String(kind||'')]||null;}
function kinds(){return Object.keys(RECORDS);}
function registerRoot(key,meta){ROOT[key]=Object.assign({owner:'domain',layer:'working',persistence:'persistent',description:''},meta||{});}
function rootFields(){return Object.keys(ROOT).map(function(key){return Object.assign({key:key},ROOT[key]);});}
function rootField(key){return ROOT[key]||null;}
function persistentKeys(){return Object.keys(ROOT).filter(function(key){return ROOT[key].persistence!=='runtime';});}
function rootForRecordKind(kind){const key=Object.keys(ROOT).find(function(k){return ROOT[k]&&ROOT[k].recordKind===kind;});return key?Object.assign({key:key},ROOT[key]):null;}
function contract(){return{records:kinds().map(function(kind){const spec=RECORDS[kind];return{kind:kind,label:spec.label||kind,description:spec.description||'',required:(spec.required||[]).slice(),relations:Object.assign({},spec.relations||{})};}),roots:rootFields(),scopes:['dataset','analysis','design','metadata','ai','nomad','validation']};}

registerRecord('file',{
  label:'Source file',description:'One immutable source-file identity from the uploaded archive. Archive path is authoritative provenance; canonical names are display/search fields.',idPrefix:'f',required:['id','kind','path','name','type'],relations:{},
  defaults:function(){return{id:uid('f'),kind:'file',path:'',rawPath:'',name:'',rawName:'',canonicalName:'',canonicalPath:'',extension:'',family:null,type:'unknown',size:0,sha256:'',unreadable:false};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('f');r.kind='file';r.path=text(r.path||r.rawPath||r.name);r.rawPath=text(r.rawPath||r.path);r.name=text(r.name||r.canonicalName||r.rawName||r.path.split('/').filter(Boolean).pop());r.rawName=text(r.rawName||r.name);r.canonicalName=text(r.canonicalName||r.name);r.canonicalPath=text(r.canonicalPath||r.path);r.extension=text(r.extension||((r.name.match(/\.[^.]+$/)||[''])[0])).toLowerCase();r.family=r.family==null?null:text(r.family);r.type=text(r.type||'unknown');r.size=Number(r.size)||0;r.sha256=text(r.sha256);r.unreadable=!!r.unreadable;return r;}
});
registerRecord('manifest_entry',{
  label:'Archive manifest entry',description:'One file or directory entry discovered in the uploaded ZIP manifest.',idPrefix:'manifest',required:['id','kind','path','name','type'],
  defaults:function(){return{id:uid('manifest'),kind:'manifest_entry',path:'',name:'',directory:false,type:'unknown'};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('manifest');r.kind='manifest_entry';r.path=text(r.path);r.name=text(r.name||r.path.split('/').filter(Boolean).pop());r.directory=!!r.directory;r.type=text(r.type||'unknown');return r;}
});
registerRecord('format_evidence',{
  label:'Format evidence',description:'Bounded literal evidence about source text format, delimiter and encoding characteristics.',idPrefix:'fmt',required:['id','kind','path'],
  defaults:function(){return{id:uid('fmt'),kind:'format_evidence',path:'',detectedFamily:'unknown',extension:'',characters:0,lines:0,delimiterCounts:{tabs:0,semicolons:0,commas:0},replacementCharacters:0,rawLines:[]};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('fmt');r.kind='format_evidence';r.path=text(r.path);r.detectedFamily=text(r.detectedFamily||'unknown');r.extension=text(r.extension);r.characters=Number(r.characters)||0;r.lines=Number(r.lines)||0;r.delimiterCounts=mergeDefaults({tabs:0,semicolons:0,commas:0},r.delimiterCounts);r.replacementCharacters=Number(r.replacementCharacters)||0;r.rawLines=arr(r.rawLines).map(text);return r;}
});
registerRecord('auxiliary_evidence',{
  label:'Auxiliary source evidence',description:'Parsed non-JV source evidence such as parameters or tracking metadata linked to stable domain IDs when known.',idPrefix:'aux',required:['id','kind','path','type'],relations:{experimentId:'experiment',sampleId:'sample',runId:'run'},
  defaults:function(){return{id:uid('aux'),kind:'auxiliary_evidence',type:'unknown',file:'',path:'',sample:'',group:'',experiment:'',isRef:false,meta:{},dataColumns:[],rowCount:0,experimentId:'',sampleId:'',runId:'',position:'',cell:''};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('aux');r.kind='auxiliary_evidence';r.type=text(r.type||'unknown');r.file=text(r.file);r.path=text(r.path);r.sample=text(r.sample);r.group=text(r.group);r.experiment=text(r.experiment||r.group);r.isRef=!!r.isRef;r.meta=obj(r.meta);r.dataColumns=arr(r.dataColumns).map(text);r.rowCount=Number(r.rowCount)||0;r.experimentId=text(r.experimentId);r.sampleId=text(r.sampleId);r.runId=text(r.runId);r.position=text(r.position);r.cell=text(r.cell);return r;}
});
registerRecord('experiment',{
  label:'Experiment / condition',description:'One logical scientific condition or group containing physical samples, runs and measurements.',idPrefix:'experiment',required:['id','kind','name','sampleIds','runIds','measurementIds'],relations:{sampleIds:'sample',runIds:'run',measurementIds:'measurement'},
  defaults:function(){return{id:uid('experiment'),kind:'experiment',name:'',isRef:false,sampleIds:[],sampleNames:[],runIds:[],measurementIds:[]};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('experiment');r.kind='experiment';r.name=text(r.name);r.isRef=!!r.isRef;r.sampleIds=arr(r.sampleIds).map(text);r.sampleNames=arr(r.sampleNames).map(text);r.runIds=arr(r.runIds).map(text);r.measurementIds=arr(r.measurementIds).map(text);return r;}
});
registerRecord('sample',{
  label:'Sample / cell',description:'One physical sample, device or cell belonging to exactly one logical experiment/condition.',idPrefix:'sample',required:['id','kind','name','experimentId','runIds','measurementIds'],relations:{experimentId:'experiment',runIds:'run',measurementIds:'measurement'},
  defaults:function(){return{id:uid('sample'),kind:'sample',name:'',rawName:'',aliases:[],experimentId:'',experiment:'',group:'',position:'',cell:'',isRef:false,runIds:[],measurementIds:[],meta:{}};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('sample');r.kind='sample';r.name=text(r.name);r.rawName=text(r.rawName||r.name);r.aliases=Array.from(new Set(arr(r.aliases).concat([r.rawName,r.name]).map(text).filter(Boolean)));r.experimentId=text(r.experimentId);r.experiment=text(r.experiment||r.group);r.group=text(r.group||r.experiment);r.position=text(r.position);r.cell=text(r.cell);r.isRef=!!r.isRef;r.runIds=arr(r.runIds).map(text);r.measurementIds=arr(r.measurementIds).map(text);r.meta=obj(r.meta);return r;}
});
registerRecord('run',{
  label:'Acquisition run',description:'One acquisition session/directory for a sample. A run can contain multiple repeated measurements.',idPrefix:'run',required:['id','kind','sampleId','experimentId','measurementIds'],relations:{experimentId:'experiment',sampleId:'sample',measurementIds:'measurement'},
  defaults:function(){return{id:uid('run'),kind:'run',path:'',label:'',sampleId:'',sample:'',experimentId:'',experiment:'',measurementIds:[],evidencePaths:[]};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('run');r.kind='run';r.path=text(r.path);r.label=text(r.label);r.sampleId=text(r.sampleId);r.sample=text(r.sample);r.experimentId=text(r.experimentId);r.experiment=text(r.experiment);r.measurementIds=arr(r.measurementIds).map(text);r.evidencePaths=arr(r.evidencePaths).map(text);return r;}
});
function normalizeScan(v){if(v==null)return null;v=obj(v);const out={file:text(v.file),direction:text(v.direction),voc:finiteOrNull(v.voc),jsc:finiteOrNull(v.jsc),vmpp:finiteOrNull(v.vmpp),jmpp:finiteOrNull(v.jmpp),pmpp:finiteOrNull(v.pmpp),rs:finiteOrNull(v.rs),rsh:finiteOrNull(v.rsh),ff:finiteOrNull(v.ff),eff:finiteOrNull(v.eff),provenance:text(v.provenance)};return out;}
registerRecord('measurement',{
  label:'JV measurement',description:'One repeated JV acquisition/source file inside a run; FW/RV are scans of this same measurement, not separate experiments.',idPrefix:'m',required:['id','kind','sampleId','experimentId'],relations:{experimentId:'experiment',sampleId:'sample',runId:'run'},
  defaults:function(){return{id:uid('m'),kind:'measurement',file:'',rawFile:'',path:'',rawSample:'',sample:'',sampleAliases:[],identitySource:'',sampleId:'',experiment:'',experimentId:'',group:'',runId:'',position:'',cell:'',sequence:null,isRef:false,fw:null,rv:null,curve:{fw:[],rv:[]},meta:{},source:'',excluded:false,recoveries:[],flags:[],blockingFlags:[],qualityStatus:'unknown',rankingEligible:false,bestEff:null,bestDirection:'',hysteresis:null,jscDiffPct:null,effDiffPct:null};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('m');r.kind='measurement';['file','rawFile','path','rawSample','sample','identitySource','sampleId','experiment','experimentId','group','runId','position','cell','source','qualityStatus','bestDirection'].forEach(function(k){r[k]=text(r[k]);});r.sampleAliases=arr(r.sampleAliases).map(text);r.sequence=r.sequence==null?null:Number(r.sequence);r.isRef=!!r.isRef;r.fw=normalizeScan(r.fw);r.rv=normalizeScan(r.rv);r.curve=obj(r.curve);r.curve.fw=arr(r.curve.fw);r.curve.rv=arr(r.curve.rv);r.meta=obj(r.meta);r.excluded=!!r.excluded;r.recoveries=arr(r.recoveries);r.flags=arr(r.flags);r.blockingFlags=arr(r.blockingFlags);r.rankingEligible=!!r.rankingEligible;['bestEff','hysteresis','jscDiffPct','effDiffPct'].forEach(function(k){r[k]=r[k]==null?null:finiteOrNull(r[k]);});return r;}
});
registerRecord('finding',{
  label:'Review finding',description:'One deterministic observation, warning or ambiguity associated with the current LabFlow Data.',idPrefix:'finding',required:['id','kind','severity','type','title','status','source'],relations:{measurementId:'measurement'},
  defaults:function(){return{id:uid('finding'),kind:'finding',severity:'info',type:'unknown',title:'',detail:'',target:'',evidence:[],status:'open',source:'deterministic',measurementId:'',resolvedAt:null,resolvedBy:''};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('finding');r.kind='finding';r.severity=text(r.severity||'info');r.type=text(r.type||'unknown');r.title=text(r.title);r.detail=text(r.detail);r.target=text(r.target);r.evidence=arr(r.evidence);r.status=text(r.status||'open');r.source=text(r.source||'deterministic');r.measurementId=text(r.measurementId);r.resolvedAt=r.resolvedAt||null;r.resolvedBy=text(r.resolvedBy);return r;}
});
registerRecord('block',{
  label:'Parsed source block',description:'One normalized table, series or key/value view derived from source evidence and linked through typed refs.',idPrefix:'b',required:['id','kind','type','file','refs','schema','data'],relations:{},
  defaults:function(){return{id:uid('b'),kind:'block',type:'table',family:null,name:'',direction:null,file:{id:'',path:'',locator:null},refs:[],schema:{columns:[]},data:{header:[],rows:[]},metadata:{}};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('b');r.kind='block';r.type=text(r.type||'table');r.family=r.family==null?null:text(r.family);r.name=text(r.name);r.direction=r.direction==null?null:text(r.direction);r.file=mergeDefaults({id:'',path:'',locator:null},r.file);r.refs=arr(r.refs).map(function(ref){ref=obj(ref);return{kind:text(ref.kind),id:text(ref.id)};}).filter(function(ref){return ref.kind&&ref.id;});r.schema=obj(r.schema);r.schema.columns=arr(r.schema.columns);r.data=obj(r.data);r.data.header=arr(r.data.header);r.data.rows=arr(r.data.rows);r.metadata=obj(r.metadata);return r;}
});
registerRecord('patch',{
  label:'LabFlow Data patch / provenance',description:'One auditable change/proposal record against a typed LabFlow Data target. RAW source bytes are never edited.',idPrefix:'patch',required:['id','kind','patchType','source','status','createdAt'],relations:{findingId:'finding'},
  defaults:function(){return{id:uid('patch'),kind:'patch',patchType:'value_change',target:{kind:'',id:''},operation:'set',field:'',from:null,to:null,source:'system',reason:'',evidence:[],findingId:'',confidence:null,status:'applied',reviewStatus:'accepted',reviewedBy:'',createdAt:now(),appliedAt:null};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('patch');r.kind='patch';r.patchType=text(r.patchType||r.type||'value_change');const target=obj(r.target);if(typeof r.target==='string')r.target={kind:text(r.targetKind),id:text(r.target)};else r.target={kind:text(target.kind||r.targetKind),id:text(target.id||r.targetId)};if(r.blockId&&!r.target.id)r.target={kind:'block',id:text(r.blockId)};r.operation=text(r.operation||'set');r.field=text(r.field);r.source=text(r.source||'system');r.reason=text(r.reason);r.evidence=arr(r.evidence);r.findingId=text(r.findingId);r.confidence=finiteOrNull(r.confidence);r.status=text(r.status||'applied');r.reviewStatus=text(r.reviewStatus||'accepted');r.reviewedBy=text(r.reviewedBy);r.createdAt=r.createdAt||now();r.appliedAt=r.appliedAt||null;delete r.type;delete r.blockId;delete r.targetKind;delete r.targetId;return r;}
});
registerRecord('design_solution',{
  label:'Design solution',description:'One solution/formulation record in the researcher-editable Design projection.',idPrefix:'sol',required:['id','kind','status'],
  defaults:function(){return{id:uid('sol'),kind:'design_solution',name:'',role:'',solutes:'',solvents:'',concentration:'',additives:'',preparation:'',evidence:'',status:'unknown',confidence:null,provenanceKind:'',cabinetRef:null,aiAssisted:false,aiAssistedAt:null};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('sol');r.kind='design_solution';['name','role','solutes','solvents','concentration','additives','preparation','evidence','status','provenanceKind'].forEach(function(k){r[k]=text(r[k]);});r.confidence=finiteOrNull(r.confidence);r.cabinetRef=r.cabinetRef&&typeof r.cabinetRef==='object'?r.cabinetRef:null;r.aiAssisted=!!r.aiAssisted;r.aiAssistedAt=r.aiAssistedAt||null;return r;}
});
registerRecord('design_layer',{
  label:'Design layer',description:'One material/process layer in a Design device stack.',idPrefix:'layer',required:['id','kind','status'],
  defaults:function(){return{id:uid('layer'),kind:'design_layer',role:'',material:'',thickness:'',process:'',evidence:'',status:'unknown',confidence:null,provenanceKind:'',cabinetRef:null};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('layer');r.kind='design_layer';if(r.layer&&!r.role)r.role=r.layer;['role','material','thickness','process','evidence','status','provenanceKind'].forEach(function(k){r[k]=text(r[k]);});r.confidence=finiteOrNull(r.confidence);r.cabinetRef=r.cabinetRef&&typeof r.cabinetRef==='object'?r.cabinetRef:null;delete r.layer;return r;}
});
registerRecord('design_device',{
  label:'Design experiment/device',description:'One Design projection for a logical experiment/device, linked to experiments/samples/solutions by stable IDs.',idPrefix:'device',required:['id','kind','solutionIds','sampleIds','stack','process','status'],relations:{experimentId:'experiment',sampleIds:'sample',solutionIds:'design_solution'},
  defaults:function(){return{id:uid('device'),kind:'design_device',name:'',group:'',experimentId:'',sampleIds:[],sampleNames:[],isRef:false,solutionIds:[],stack:[],process:{coating:'',annealing:'',atmosphere:'',notes:''},stackSourceRef:null,processSourceRef:null,status:'unknown',evidence:'',confidence:null,provenanceKind:''};},
  normalize:function(r){r=obj(r);if(!r.id)r.id=uid('device');r.kind='design_device';r.name=text(r.name);r.group=text(r.group);r.experimentId=text(r.experimentId);r.sampleIds=arr(r.sampleIds).map(text);r.sampleNames=arr(r.sampleNames).map(text);r.isRef=!!r.isRef;r.solutionIds=arr(r.solutionIds).map(text);r.stack=arr(r.stack).map(function(layer){return create('design_layer',layer);});r.process=mergeDefaults({coating:'',annealing:'',atmosphere:'',notes:''},r.process);r.stackSourceRef=r.stackSourceRef&&typeof r.stackSourceRef==='object'?r.stackSourceRef:null;r.processSourceRef=r.processSourceRef&&typeof r.processSourceRef==='object'?r.processSourceRef:null;r.status=text(r.status||'unknown');r.evidence=text(r.evidence);r.confidence=finiteOrNull(r.confidence);r.provenanceKind=text(r.provenanceKind);return r;}
});

[
 ['id',{owner:'domain',layer:'identity',persistence:'persistent',description:'Stable aggregate identifier.'}],
 ['meta',{owner:'domain',layer:'working',persistence:'persistent'}],
 ['raw',{owner:'importer',layer:'source',persistence:'persistent'}],
 ['files',{owner:'importer',layer:'source',persistence:'persistent',recordKind:'file'}],
 ['blocks',{owner:'importer',layer:'source_interpretation',persistence:'persistent',recordKind:'block'}],
 ['patches',{owner:'domain',layer:'working',persistence:'persistent',recordKind:'patch'}],
 ['manifest',{owner:'importer',layer:'source',persistence:'persistent',recordKind:'manifest_entry'}],
 ['rawFormatEvidence',{owner:'importer',layer:'source',persistence:'persistent',recordKind:'format_evidence'}],
 ['auxiliaryEvidence',{owner:'importer',layer:'source',persistence:'persistent',recordKind:'auxiliary_evidence'}],
 ['experiments',{owner:'domain',layer:'working',persistence:'persistent',recordKind:'experiment'}],
 ['samples',{owner:'domain',layer:'working',persistence:'persistent',recordKind:'sample'}],
 ['runs',{owner:'domain',layer:'working',persistence:'persistent',recordKind:'run'}],
 ['measurements',{owner:'domain',layer:'working',persistence:'persistent',recordKind:'measurement'}],
 ['findings',{owner:'analysis',layer:'working_review',persistence:'persistent',recordKind:'finding'}],
 ['analysisSettings',{owner:'analysis',layer:'working',persistence:'persistent'}],
 ['analysis',{owner:'analysis',layer:'derived',persistence:'persistent'}],
 ['design',{owner:'design',layer:'working',persistence:'persistent'}],
 ['nomad',{owner:'export',layer:'export_projection',persistence:'persistent'}],
 ['interpretationOverrides',{owner:'domain',layer:'working',persistence:'persistent'}],
 ['derived',{owner:'runtime',layer:'interaction_history',persistence:'persistent'}],
 ['actionData',{owner:'actions',layer:'action_outputs',persistence:'persistent'}],
 ['sync',{owner:'state',layer:'runtime_metadata',persistence:'persistent'}],
 ['pipeline',{owner:'pipeline',layer:'runtime',persistence:'runtime'}],
 ['canonical',{owner:'canonical',layer:'derived_cache',persistence:'runtime'}],
 ['datasetAnalysis',{owner:'review',layer:'derived_cache',persistence:'runtime'}],
 ['designAnalysis',{owner:'design',layer:'derived_cache',persistence:'runtime'}],
 ['analysisSummary',{owner:'analysis',layer:'derived_cache',persistence:'runtime'}],
 ['experimentBrief',{owner:'analysis',layer:'derived_cache',persistence:'runtime'}],
 ['autoCleanup',{owner:'review',layer:'derived_cache',persistence:'runtime'}]
].forEach(function(x){registerRoot(x[0],x[1]);});

function createRoot(seed){
  seed=obj(seed);const root={
    id:text(seed.id)||uid('exp'),
    meta:{name:'',createdAt:now(),modifiedAt:null,sourceName:'',sourceSize:0,sourceModifiedAt:null,sourceType:'',importMethod:''},
    raw:{sourceArchive:null,sourceName:'',sha256:''},
    files:[],blocks:[],patches:[],manifest:[],rawFormatEvidence:[],auxiliaryEvidence:[],experiments:[],samples:[],runs:[],measurements:[],findings:[],
    analysisSettings:{mismatchFactor:1},analysis:{summary:{},bestBySample:[],bestByExperiment:[],topNonRef:[],topRef:[]},
    design:{status:'unknown',solutions:[],process:{coating:'',annealing:'',atmosphere:'',notes:''},stack:[],devices:[],evidenceSummary:{sourceRecords:0,parsedRecords:0,samplesCovered:0,experimentsRecovered:0,sourceAvailable:false}},
    nomad:{},interpretationOverrides:{fields:{},units:{},scales:{}},derived:{actions:{},chat:{conversation:[]}},actionData:{proposals:{},annotations:{},status:{}},
    autoCleanup:{applied:0,lastApplied:0,targets:0,items:[],updatedAt:''},sync:{revision:0,lastChange:null,pendingScopes:[]}
  };
  Object.assign(root,seed);return normalizeRoot(root);
}
function normalizeRoot(exp){
  exp=obj(exp);if(!exp.id)exp.id=uid('exp');
  exp.meta=mergeDefaults({name:'',createdAt:now(),modifiedAt:null,sourceName:'',sourceSize:0,sourceModifiedAt:null,sourceType:'',importMethod:''},exp.meta);
  exp.raw=mergeDefaults({sourceArchive:null,sourceName:'',sha256:''},exp.raw);
  rootFields().forEach(function(meta){if(!meta.recordKind)return;exp[meta.key]=arr(exp[meta.key]).map(function(record){return normalize(meta.recordKind,record);});});
  exp.analysisSettings=mergeDefaults({mismatchFactor:1},exp.analysisSettings);
  exp.analysis=mergeDefaults({summary:{},bestBySample:[],bestByExperiment:[],topNonRef:[],topRef:[]},exp.analysis);exp.analysis.summary=obj(exp.analysis.summary);['bestBySample','bestByExperiment','topNonRef','topRef'].forEach(function(k){exp.analysis[k]=arr(exp.analysis[k]);});
  exp.design=mergeDefaults({status:'unknown',solutions:[],process:{coating:'',annealing:'',atmosphere:'',notes:''},stack:[],devices:[],evidenceSummary:{sourceRecords:0,parsedRecords:0,samplesCovered:0,experimentsRecovered:0,sourceAvailable:false}},exp.design);exp.design.solutions=arr(exp.design.solutions).map(function(x){return normalize('design_solution',x);});exp.design.stack=arr(exp.design.stack).map(function(x){return normalize('design_layer',x);});exp.design.devices=arr(exp.design.devices).map(function(x){return normalize('design_device',x);});exp.design.process=mergeDefaults({coating:'',annealing:'',atmosphere:'',notes:''},exp.design.process);exp.design.evidenceSummary=mergeDefaults({sourceRecords:0,parsedRecords:0,samplesCovered:0,experimentsRecovered:0,sourceAvailable:false},exp.design.evidenceSummary);
  exp.nomad=obj(exp.nomad);exp.interpretationOverrides=obj(exp.interpretationOverrides);exp.interpretationOverrides.fields=obj(exp.interpretationOverrides.fields);exp.interpretationOverrides.units=obj(exp.interpretationOverrides.units);exp.interpretationOverrides.scales=obj(exp.interpretationOverrides.scales);
  exp.derived=obj(exp.derived);exp.derived.actions=obj(exp.derived.actions);exp.derived.chat=obj(exp.derived.chat);exp.derived.chat.conversation=arr(exp.derived.chat.conversation);
  exp.actionData=obj(exp.actionData);exp.actionData.proposals=obj(exp.actionData.proposals);exp.actionData.annotations=obj(exp.actionData.annotations);exp.actionData.status=obj(exp.actionData.status);
  exp.autoCleanup=mergeDefaults({applied:0,lastApplied:0,targets:0,items:[],updatedAt:''},exp.autoCleanup);exp.autoCleanup.items=arr(exp.autoCleanup.items);
  {const sync=obj(exp.sync);exp.sync={revision:Math.max(0,Number(sync.revision)||0),lastChange:sync.lastChange||null,pendingScopes:arr(sync.pendingScopes).map(text)};}
  return exp;
}
function cloneValue(value){if(value==null||typeof value!=='object')return value;if(value instanceof ArrayBuffer)return value.slice(0);if(typeof ArrayBuffer!=='undefined'&&ArrayBuffer.isView&&ArrayBuffer.isView(value)){const copy=value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength);return new value.constructor(copy);}if(Array.isArray(value))return value.map(cloneValue);const out={};Object.keys(value).forEach(function(k){out[k]=cloneValue(value[k]);});return out;}
function snapshot(exp,options){exp=normalizeRoot(exp);options=options||{};const out={};persistentKeys().forEach(function(key){if(exp[key]===undefined)return;if(key==='raw'&&options.includeSourceArchive===false){const raw=cloneValue(exp.raw||{});raw.sourceArchive=null;out.raw=raw;return;}out[key]=cloneValue(exp[key]);});return out;}

LF.DomainSchema={registerRecord:registerRecord,create:create,normalize:normalize,describe:describe,kinds:kinds,rootFields:rootFields,rootField:rootField,rootForRecordKind:rootForRecordKind,persistentKeys:persistentKeys,createRoot:createRoot,normalizeRoot:normalizeRoot,snapshot:snapshot,contract:contract,values:VALUES,scopes:['dataset','analysis','design','metadata','ai','nomad','validation']};
}());
