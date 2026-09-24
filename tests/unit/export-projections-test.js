'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
const LF=global.LabFlow;
let exportSettings={includeRaw:true,includeDerived:true,projectionOverrides:{nomad:{},readypv:{}}};
LF.Storage={getExportSettings:function(){return JSON.parse(JSON.stringify(exportSettings));},saveExportSettings:function(v){exportSettings=JSON.parse(JSON.stringify(v));}};
LF.Workspace={current:function(){return{id:'w1',name:'PV Lab',institution:'University Test',description:'Ready-PV workspace',contacts:[{role:'data_responsible',name:'Ada Researcher',email:'ada@example.test'},{role:'parser_contact',name:'Parser Person',email:'parser@example.test'}],locations:[{id:'loc1',name:'Lab A'}],storageProfiles:[{id:'st1',name:'Institutional NAS',type:'network_share'}],processes:[{id:'p1',name:'JV characterization',kind:'characterization',description:'Current-voltage characterization of photovoltaic devices',sampleTypes:['PV device'],locationIds:['loc1'],instrumentIds:['i1'],softwareIds:['sw1'],outputFormatIds:['ff1'],variables:[{name:'Voltage',unit:'V'}],observables:[{name:'PCE',unit:'%'}],typicalFrequency:'daily',typicalOutputSize:'100 kB',parallelCapacity:4,storageProfileIds:['st1'],metadataPolicy:{metadataLocation:'LabFlow sample metadata',sampleLinkage:{method:'filename',rule:'sample id in filename'}},notes:'Shared setup'}]};},process:function(){return null;}};
LF.Cabinet={all:function(){return[{id:'i1',kind:'instrument',name:'Keithley 2400'},{id:'sw1',kind:'software',name:'Acquisition Suite'},{id:'ff1',kind:'file_format',name:'JV TXT',documentationRefs:['format.md']}];}};
LF.NomadExport={ensureMapping:function(){return{mappings:[{nomad_path:'data.experiment_name',labflow_path:'meta.name',value:'Demo',required:true,status:'mapped'},{nomad_path:'data.institution',labflow_path:'workspace.institution',value:'University Test',required:false,status:'mapped'}]};},validate:function(){return{status:'ready',problems:[]};},dataYaml:function(){return'data:\n  experiment_name: "Demo"\n';}};
require('../../assets/js/export/projections.js');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
function truthy(v,label){if(!v)throw new Error((label||'assert')+': expected truthy');}
const exp={id:'e1',meta:{name:'Demo',workspaceId:'w1',processId:'p1'},samples:[{id:'s1',name:'S1'}],measurements:[{id:'m1',technique:'jv'}],files:[{path:'a.txt'}],raw:{}};
module.exports=function(t){
  t['Ready-PV projection maps Workspace, Process and Cabinet into the questionnaire structure']=function(){const p=LF.ExportProjections.readyPv(exp),by={};p.fields.forEach(function(f){by[f.id]=f;});assert(by['contact.institution'].value,'University Test','institution');assert(by['contact.name'].value,'Ada Researcher','responsible');assert(by['instruments.main'].value,['Keithley 2400'],'instrument');assert(by['instruments.software'].value,['Acquisition Suite'],'software');assert(by['instruments.formats'].value,['JV TXT'],'format');assert(by['metadata.linkage'].value,'filename · sample id in filename','linkage');truthy(p.readiness.score>80,'readiness');};
  t['Projection edits persist as export-only overrides and reset to canonical values']=function(){LF.ExportProjections.saveFieldEdits('readypv',exp,{'contact.institution':'Override University'});let p=LF.ExportProjections.readyPv(exp),f=p.fields.find(function(x){return x.id==='contact.institution';});assert(f.value,'Override University','override value');assert(f.source,'OVERRIDE','override source');LF.ExportProjections.saveFieldEdits('readypv',exp,{'contact.institution':'University Test'});p=LF.ExportProjections.readyPv(exp);f=p.fields.find(function(x){return x.id==='contact.institution';});assert(f.value,'University Test','canonical restored');assert(f.source,'WORKSPACE','canonical source restored');};
  t['Ready-PV copy text preserves the form headings and field labels']=function(){const text=LF.ExportProjections.readyPvText(exp);truthy(text.indexOf('MEASURED QUANTITIES')>=0,'section heading');truthy(text.indexOf('Measurement variables:')>=0,'variables label');truthy(text.indexOf('Ada Researcher')>=0,'contact value');};
  t['Export preparation context exposes only missing required or recommended fields']=function(){
    const prep=LF.ExportProjections.preparationContext(exp);
    truthy(Array.isArray(prep.allowed_fields.nomad),'nomad allowed fields');
    truthy(prep.allowed_fields.readypv.includes('samples.locations')===false,'populated locations are not repair targets');
    truthy(prep.allowed_fields.readypv.includes('instruments.docs')===false,'documented format is not missing');
  };
  t['Deterministic export preparation applies only to still-missing projection fields']=function(){
    const current=LF.Workspace.current;
    LF.Workspace.current=function(){const w=current();w.processes[0].typicalOutputSize='';return w;};
    const prep=LF.ExportProjections.preparationContext(exp);
    truthy(prep.allowed_fields.readypv.includes('samples.output_size'),'missing recommended field is repairable');
    const applied=LF.ExportProjections.applyPreparation(exp,{suggestions:[
      {projection:'readypv',field_id:'samples.frequency',value:'weekly'},
      {projection:'readypv',field_id:'samples.output_size',value:'100 kB per measurement'}
    ]});
    assert(applied,[{projection:'readypv',field_id:'samples.output_size'}],'only missing field applied');
    const after=LF.ExportProjections.readyPv(exp).fields.find(function(f){return f.id==='samples.output_size';});
    assert(after.value,'100 kB per measurement','override value');
    LF.ExportProjections.reset('readypv');LF.Workspace.current=current;
  };
};
