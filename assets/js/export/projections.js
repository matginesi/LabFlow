/*
 * Human-readable export projections for NOMAD and Ready-PV.
 * Boundary: LabFlow canonical data stays authoritative; optional projection overrides affect export views only.
 */
(function(){
'use strict';
const LF=window.LabFlow=window.LabFlow||{},C=LF.Core;
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function clean(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function unique(values){return Array.from(new Set(arr(values).map(clean).filter(Boolean)));}
function empty(v){return v==null||v===''||(Array.isArray(v)&&!v.length);}
function sourceFromPath(path){path=String(path||'');if(/^workspace\./.test(path))return'WORKSPACE';if(/^meta\.(workspaceId|processId)/.test(path))return'PROCESS';if(/^meta\.|^samples\[|^measurements\[|^sync\./.test(path))return'EXPERIMENT';if(/^generated|NOMAD schema/.test(path))return'DERIVED';if(/^raw\./.test(path))return'EXPERIMENT';return'DERIVED';}
function display(value){if(value==null||value==='')return'';if(Array.isArray(value))return value.map(function(v){return typeof v==='object'?JSON.stringify(v):String(v);}).join('\n');if(typeof value==='object')return JSON.stringify(value,null,2);return String(value);}
function parseLike(text,base){const raw=String(text==null?'':text).trim();if(Array.isArray(base))return unique(raw.split(/\r?\n|,/));if(typeof base==='number'){if(raw==='')return null;const n=Number(raw);return Number.isFinite(n)?n:raw;}if(typeof base==='boolean')return /^(1|true|yes|on)$/i.test(raw);return raw;}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function settings(){return LF.Storage.getExportSettings();}
function overrides(kind){const all=settings().projectionOverrides||{};return clone(all[kind]||{});}
function saveOverrides(kind,map){
  const s=settings();
  s.projectionOverrides=s.projectionOverrides||{nomad:{},readypv:{}};
  s.projectionOverrides[kind]=clone(map||{});
  LF.Storage.saveExportSettings(s);
  const exp=LF.State&&LF.State.state&&LF.State.state.experiment;
  if(kind==='nomad'&&exp&&exp.nomad){exp.nomad.mappingPlan=null;exp.nomad.validation=null;}
  return s.projectionOverrides[kind];
}
function currentWorkspace(){return LF.Workspace&&LF.Workspace.current?LF.Workspace.current():{contacts:[],locations:[],storageProfiles:[],processes:[]};}
function currentProcess(exp,w){const id=exp&&exp.meta&&exp.meta.processId||'';return arr(w&&w.processes).find(function(p){return String(p.id)===String(id);})||arr(w&&w.processes)[0]||null;}
function cabinet(){return LF.Cabinet&&LF.Cabinet.all?LF.Cabinet.all():[];}
function cabinetById(items,id){return arr(items).find(function(x){return String(x.id)===String(id);})||null;}
function namesForRefs(items,ids,kind){return unique(arr(ids).map(function(id){const item=cabinetById(items,id);if(!item)return String(id||'');if(kind&&item.kind!==kind)return item.name||String(id);return item.name||String(id);}));}
function locationNames(w,ids){return unique(arr(ids).map(function(id){const x=arr(w.locations).find(function(v){return String(v.id)===String(id);});return x?x.name||[x.laboratory,x.building,x.site].filter(Boolean).join(' · '):String(id||'');}));}
function storageNames(w,ids){const pool=arr(w.storageProfiles);const selected=arr(ids).length?arr(ids).map(function(id){return pool.find(function(v){return String(v.id)===String(id);});}).filter(Boolean):pool.slice(0,2);return unique(selected.map(function(x){return x.name||x.locationHint||x.type;}));}
function roleContact(w,role){return arr(w.contacts).find(function(c){return c.role===role;})||{};}
function measurementQuantities(exp,role){const names=[];arr(exp&&exp.measurements).forEach(function(m){arr(role==='controlled_variable'?m.parameters:m.observables).forEach(function(q){if(q&&(q.name||q.symbol||q.id))names.push([q.name||q.symbol||q.id,q.unit].filter(Boolean).join(' [' )+(q.unit?']':'') );});});return unique(names);}
function extensionFormats(exp){return unique(arr(exp&&exp.files).map(function(f){const p=clean(f.path||f.name);const m=p.match(/\.([A-Za-z0-9]{1,12})$/);return m?'.'+m[1].toLowerCase():'';}));}
function formatDocs(items,ids){const docs=[];arr(ids).forEach(function(id){const x=cabinetById(items,id);if(x&&x.kind==='file_format')arr(x.documentationRefs).forEach(function(v){docs.push(v);});});return unique(docs);}
function field(id,label,value,source,opts){opts=opts||{};return{id:id,label:label,value:value,baseValue:clone(value),source:source||'DERIVED',required:!!opts.required,recommended:!!opts.recommended,editable:opts.editable!==false,note:opts.note||'',valueType:Array.isArray(value)?'array':typeof value};}
function applyFieldOverrides(fields,kind){const map=overrides(kind);fields.forEach(function(f){if(Object.prototype.hasOwnProperty.call(map,f.id)){f.value=clone(map[f.id]);f.source='OVERRIDE';f.overridden=true;}});return fields;}
function readiness(fields){
  let possible=0,earned=0,requiredMissing=0,recommendedMissing=0;
  fields.forEach(function(f){
    const weight=f.required?2:f.recommended?1:0;
    if(!weight)return;
    possible+=weight;
    if(!empty(f.value))earned+=weight;
    else if(f.required)requiredMissing++;
    else recommendedMissing++;
  });
  return{score:possible?Math.round(earned/possible*100):100,requiredMissing:requiredMissing,
    recommendedMissing:recommendedMissing};
}
function nomadLabel(path){
  const labels={
    'data.m_def':'Schema definition','data.experiment_name':'Experiment name',
    'data.workspace_id':'Workspace ID','data.workspace_name':'Workspace','data.institution':'Institution',
    'data.process_id':'Process ID','data.process_name':'Scientific process','data.process_kind':'Process kind',
    'data.source_file':'Source archive','data.working_revision':'Working revision','data.sample_count':'Samples',
    'data.measurement_count':'Measurements','data.eligible_measurement_count':'Eligible measurements',
    'data.best_efficiency':'Best efficiency (%)','data.sample_names':'Sample names',
    'data.measurement_ids':'Measurement IDs','data.measurement_samples':'Measurement samples',
    'data.measurement_techniques':'Measurement techniques','data.measurement_efficiencies':'Measurement efficiencies (%)',
    'data.measurement_quality':'Measurement quality','data.instrument_refs':'Instrument references',
    'data.acquisition_software_refs':'Acquisition software','data.output_format_refs':'Output formats',
    'data.provenance_file':'Provenance file','data.canonical_table_file':'Canonical table',
    'data.raw_source_file':'RAW source','data.notes':'Notes'
  };
  return labels[path]||path.replace(/^data\./,'').replace(/_/g,' ');
}
function nomadSection(path){if(/workspace|institution|process/.test(path))return'ENTRY & CONTEXT';if(/sample/.test(path))return'SAMPLES';if(/measurement|efficiency/.test(path))return'MEASUREMENTS & RESULTS';if(/instrument|software|format/.test(path))return'SETUP & FORMATS';if(/file|provenance|notes|revision|m_def/.test(path))return'FILES & PROVENANCE';return'ENTRY';}
function nomad(exp){
  const plan=LF.NomadExport.ensureMapping(exp),
    validation=LF.NomadExport.validate(exp,exp.raw&&exp.raw.sourceArchive);
  const fields=(plan.mappings||[]).map(function(m){
    return field(m.nomad_path,nomadLabel(m.nomad_path),m.value,
      m.overridden?'OVERRIDE':sourceFromPath(m.labflow_path),{
        required:m.required,recommended:!m.required&&m.status!=='disabled',
        editable:m.status!=='disabled',note:m.note
      });
  });
  const groups={};
  fields.forEach(function(f){const sec=nomadSection(f.id);(groups[sec]=groups[sec]||[]).push(f);});
  const ready=readiness(fields),problems=validation.problems||[];
  return{
    kind:'nomad',title:'NOMAD',subtitle:'Experiment projection',fields:fields,
    sections:Object.keys(groups).map(function(name){return{name:name,fields:groups[name]};}),
    readiness:{
      score:validation.status==='blocked'?Math.min(ready.score,75):ready.score,
      requiredMissing:ready.requiredMissing,recommendedMissing:ready.recommendedMissing,status:validation.status,
      blocking:problems.filter(function(p){return p.severity==='blocking';}).length,
      warnings:problems.filter(function(p){return p.severity!=='blocking';}).length
    },
    validation:validation,plan:plan
  };
}
function readyPv(exp){const w=currentWorkspace(),p=currentProcess(exp,w),items=cabinet(),responsible=roleContact(w,'data_responsible'),parser=roleContact(w,'parser_contact'),contributor=roleContact(w,'plugin_contributor');
  const vars=p&&p.variables&&p.variables.length?p.variables.map(function(q){return[q.name,q.unit,q.description].filter(Boolean).join(' · ');}):measurementQuantities(exp,'controlled_variable');
  const obs=p&&p.observables&&p.observables.length?p.observables.map(function(q){return[q.name,q.unit,q.description].filter(Boolean).join(' · ');}):measurementQuantities(exp,'observable');
  const formats=p&&p.outputFormatIds&&p.outputFormatIds.length?namesForRefs(items,p.outputFormatIds,'file_format'):extensionFormats(exp);
  const instruments=p?namesForRefs(items,p.instrumentIds,'instrument'):[];const software=p?namesForRefs(items,p.softwareIds,'software'):[];
  const sampleTypes=p&&p.sampleTypes&&p.sampleTypes.length?p.sampleTypes:unique(arr(exp&&exp.samples).map(function(s){return s.type||s.sampleType||'';}));
  const linkage=p&&p.metadataPolicy&&p.metadataPolicy.sampleLinkage||{};
  const locations=p&&p.locationIds&&p.locationIds.length?locationNames(w,p.locationIds):unique(arr(w.locations).map(function(x){return x.name||x.laboratory||x.site;}));
  const storages=storageNames(w,p&&p.storageProfileIds||[]);
  const rows=[
    ['contact.institution','Institution',w.institution,'WORKSPACE',{required:true}],
    ['contact.name','Contact person name',responsible.name,'WORKSPACE',{required:true}],
    ['contact.email','Contact person email',responsible.email,'WORKSPACE',{required:true}],
    ['contact.parser','Parser contact person & email',[parser.name,parser.email].filter(Boolean).join(' · '),'WORKSPACE',{}],
    ['contact.plugin','Plugin development contributor',[contributor.name,contributor.email].filter(Boolean).join(' · '),'WORKSPACE',{}],
    ['measured.description','General measurement / characterization / simulation description',p&&p.description||[p&&p.name,unique(arr(exp&&exp.measurements).map(function(m){return m.technique;})).join(', ')].filter(Boolean).join(' · '),'PROCESS',{required:true}],
    ['measured.variables','Measurement variables',vars,p&&p.variables&&p.variables.length?'PROCESS':'DERIVED',{required:true}],
    ['measured.observables','Measurement observables',obs,p&&p.observables&&p.observables.length?'PROCESS':'DERIVED',{required:true}],
    ['samples.types','Sample types',sampleTypes,p&&p.sampleTypes&&p.sampleTypes.length?'PROCESS':'EXPERIMENT',{required:true}],
    ['samples.locations','Test location(s)',locations,p&&p.locationIds&&p.locationIds.length?'PROCESS':'WORKSPACE',{required:true}],
    ['samples.frequency','Typical measurement frequency',p&&p.typicalFrequency||'','PROCESS',{recommended:true}],
    ['samples.output_size','Typical size of a single output file / group of files',p&&p.typicalOutputSize||'','PROCESS',{recommended:true}],
    ['samples.capacity','Typical setup capacity',p&&p.parallelCapacity!=null?p.parallelCapacity:'','PROCESS',{recommended:true}],
    ['instruments.main','Main instruments / trackers',instruments,instruments.length?'CABINET':'MISSING',{required:true}],
    ['instruments.software','Data acquisition software',software,software.length?'CABINET':'MISSING',{recommended:true}],
    ['instruments.formats','Output file format(s)',formats,p&&p.outputFormatIds&&p.outputFormatIds.length?'CABINET':'DERIVED',{required:true}],
    ['instruments.docs','File-format documentation',formatDocs(items,p&&p.outputFormatIds||[]),'CABINET',{recommended:true}],
    ['storage.normal','Where data is stored normally',storages,'WORKSPACE',{required:true}],
    ['metadata.location','Where sample metadata is recorded',p&&p.metadataPolicy&&p.metadataPolicy.metadataLocation||'','PROCESS',{recommended:true}],
    ['metadata.linkage','How data is linked to samples',[linkage.method,linkage.rule].filter(Boolean).join(' · '),'PROCESS',{required:true}],
    ['remarks.additional','Additional remarks',[p&&p.notes,w.description].filter(Boolean).join('\n'),'WORKSPACE',{}]
  ].map(function(x){return field(x[0],x[1],x[2],x[3],x[4]);});
  applyFieldOverrides(rows,'readypv');
  const sectionOrder=[['CONTACT','contact.'],['MEASURED QUANTITIES','measured.'],['SAMPLES & SETUP','samples.'],['INSTRUMENTS & FILE FORMATS','instruments.'],['STORAGE','storage.'],['METADATA & DOCUMENTATION','metadata.'],['ADDITIONAL REMARKS','remarks.']];
  const sections=sectionOrder.map(function(pair){return{name:pair[0],fields:rows.filter(function(f){return f.id.indexOf(pair[1])===0;})};});
  return{kind:'readypv',title:'READY-PV',subtitle:'Data-management profile',fields:rows,sections:sections,readiness:readiness(rows),workspace:w,process:p};}
function projection(kind,exp){return kind==='nomad'?nomad(exp):readyPv(exp);}
function saveFieldEdits(kind,exp,entries){const p=projection(kind,exp),byId={};p.fields.forEach(function(f){byId[f.id]=f;});const map=overrides(kind);Object.keys(entries||{}).forEach(function(id){const f=byId[id];if(!f||f.editable===false)return;const parsed=parseLike(entries[id],f.baseValue);if(same(parsed,f.baseValue))delete map[id];else map[id]=parsed;});return saveOverrides(kind,map);}
function reset(kind){return saveOverrides(kind,{});}
function projectionObject(kind,exp){
  const p=projection(kind,exp),out={
    format:kind==='nomad'?'labflow-nomad-projection':'labflow-readypv-profile',
    formatVersion:1,generatedAt:new Date().toISOString(),experimentId:exp&&exp.id||'',
    readiness:p.readiness,sections:{}
  };
  p.sections.forEach(function(sec){
    const target={};
    sec.fields.forEach(function(f){target[f.id]=f.value;});
    out.sections[sec.name]=target;
  });
  return out;
}
function readyPvText(exp){const p=readyPv(exp),lines=[];p.sections.forEach(function(sec){lines.push(sec.name);sec.fields.forEach(function(f){lines.push(f.label+':');lines.push(display(f.value)||'');lines.push('');});});return lines.join('\n').trim()+'\n';}
function serialize(kind,exp,format){format=String(format||'json');if(kind==='nomad'&&format==='yaml')return LF.NomadExport.dataYaml(exp,settings(),LF.NomadExport.ensureMapping(exp));if(kind==='readypv'&&format==='text')return readyPvText(exp);return JSON.stringify(projectionObject(kind,exp),null,2)+'\n';}
function filename(kind,exp,format){const base=C.safeName(exp&&exp.meta&&exp.meta.name||'experiment');if(kind==='nomad')return base+(format==='yaml'?'_nomad.archive.yaml':'_nomad_projection.json');if(format==='text')return base+'_readypv_answers.txt';return base+'_readypv_profile.json';}
LF.ExportProjections={projection:projection,nomad:nomad,readyPv:readyPv,display:display,saveFieldEdits:saveFieldEdits,reset:reset,serialize:serialize,filename:filename,projectionObject:projectionObject,readyPvText:readyPvText,overrides:overrides};
}());
