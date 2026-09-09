'use strict';
require('../../assets/js/logger.js');
const LF=global.LabFlow;
let exportSettings={instance:'NOMAD',endpoint:'https://example.invalid',includeRaw:false,includeDerived:true};
LF.Storage={getExportSettings:function(){return Object.assign({},exportSettings);}};
LF.Analysis={
  analysisOf:function(e){return e.analysis||{summary:{}};},
  measurementsOf:function(e){return e.measurements||[];},
  samplesOf:function(e){return e.samples||[];},
  findingsOf:function(e){return e.findings||[];},
  designOf:function(e){return e.design||{solutions:[],stack:[]};},
  toCSV:function(){return'id,sample\nm1,S1\n';}
};
LF.Export={canonicalSnapshot:function(e){return{format:'labflow-canonical',experiment:{id:e.id}};}};
require('../../assets/js/export/nomad.js');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
function truthy(v,label){if(!v)throw new Error((label||'assert')+': expected truthy');}
function exp(){return{id:'e1',meta:{name:'Demo',sourceName:'demo.zip'},sync:{revision:3},raw:{sourceArchive:null},samples:[{id:'s1',name:'S1'}],measurements:[{id:'m1',sample:'S1',bestEff:20.5,rankingEligible:true,qualityStatus:'valid'}],analysis:{summary:{eligibleCount:999,bestEfficiency:999}},findings:[],patches:[],design:{solutions:[],stack:[]}};}
module.exports=function(t,LF){
  t['NOMAD mapping, validation and YAML use one deterministic plan']=function(){
    const e=exp(),plan=LF.NomadExport.ensureMapping(e),yaml=LF.NomadExport.dataYaml(e,null,plan),validation=LF.NomadExport.validate(e,null);
    assert(plan.sourceRevision,3,'revision');
    assert(plan.mappings.find(function(x){return x.nomad_path==='data.eligible_measurement_count';}).value,1,'eligible derived from canonical measurement');
    assert(plan.mappings.find(function(x){return x.nomad_path==='data.best_efficiency';}).value,20.5,'best efficiency derived from canonical measurement');
    truthy(yaml.indexOf('eligible_measurement_count: 1')>=0,'YAML uses mapping count');
    truthy(yaml.indexOf('best_efficiency: 20.5')>=0,'YAML uses mapping best');
    assert(e.nomad.mappingPlan,plan,'plan stored on experiment');
    truthy(validation.status!=='blocked','valid minimal mapping not blocked');
  };
  t['stale NOMAD mapping is rebuilt automatically']=function(){
    const e=exp(),first=LF.NomadExport.ensureMapping(e);e.sync.revision=4;const second=LF.NomadExport.ensureMapping(e);assert(first===second,false,'new plan');assert(second.sourceRevision,4,'new revision');
  };
  t['NOMAD schema uses the documented named external-section reference']=function(){
    const e=exp(),plan=LF.NomadExport.ensureMapping(e),schema=LF.NomadExport.schemaYaml(),yaml=LF.NomadExport.dataYaml(e,null,plan);
    truthy(schema.indexOf('base_sections:')>=0&&schema.indexOf('nomad.datamodel.data.EntryData')>=0,'top-level custom section inherits EntryData');
    truthy(yaml.indexOf("../upload/raw/labflow_schema.archive.yaml#LabFlowExperiment")>=0,'entry references the named section in the packaged schema');
    assert((schema.match(/experiment_name:\n\s+type: str/g)||[]).length,1,'experiment_name type emitted once');
  };
  t['NOMAD mapping rebuilds when package options change']=function(){
    const e=exp();exportSettings.includeRaw=false;const first=LF.NomadExport.ensureMapping(e);exportSettings.includeRaw=true;const second=LF.NomadExport.ensureMapping(e);
    assert(first===second,false,'option change must invalidate cached mapping');
    assert(first.mappings.find(function(x){return x.nomad_path==='data.raw_source_file';}).status,'disabled','RAW mapping starts disabled');
    assert(second.mappings.find(function(x){return x.nomad_path==='data.raw_source_file';}).status,'mapped','RAW mapping reflects the enabled package option');
    assert(first.optionsSignature===second.optionsSignature,false,'option signature changes with package settings');
    exportSettings.includeRaw=false;
  };
  t['NOMAD validation exposes actionable remediation']=function(){
    const e=exp();exportSettings.includeRaw=true;const validation=LF.NomadExport.validate(e,null),rawProblem=(validation.problems||[]).find(function(x){return x.code==='raw_source_unavailable';});
    truthy(rawProblem&&rawProblem.fix&&rawProblem.fix.kind==='option','missing optional RAW has a safe fix');
    assert(rawProblem.fix.option,'includeRaw','fix targets the RAW option');
    exportSettings.includeRaw=false;
  };

  t['NOMAD provenance audit uses patchType rather than obsolete type field']=function(){
    const e=exp();e.patches=[{id:'p1',kind:'patch',patchType:'sample_mapping',source:'user',createdAt:'2026-09-09T00:00:00Z',reason:'Confirmed mapping',evidence:['researcher evidence']}];
    const v=LF.NomadExport.validate(e,null);assert(v.checks.incompletePatchProvenance,0,'valid current patch schema is complete');
  };
  t['excluded measurement danger findings no longer block NOMAD export']=function(){
    const e=exp();e.measurements[0].excluded=true;e.findings=[{id:'f1',severity:'danger',status:'open',measurementId:'m1',target:'m1'}];
    const v=LF.NomadExport.validate(e,null);assert(v.checks.unresolvedDanger,0,'excluded measurement danger ignored for staging blocker');
  };

  return t;
};
