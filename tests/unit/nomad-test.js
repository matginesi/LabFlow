'use strict';
require('../../assets/js/logger.js');
const LF=global.LabFlow;
LF.Storage={getNomadSettings:function(){return{instance:'NOMAD',endpoint:'https://example.invalid',includeRaw:false,includeDerived:true,includeReport:true};}};
LF.Analysis={
  analysisOf:function(e){return e.analysis||{summary:{}};},
  measurementsOf:function(e){return e.measurements||[];},
  samplesOf:function(e){return e.samples||[];},
  findingsOf:function(e){return e.findings||[];},
  designOf:function(e){return e.design||{solutions:[],stack:[]};},
  toCSV:function(){return'id,sample\nm1,S1\n';}
};
LF.Report={activeMarkdown:function(e){return e.report&&e.report.labMarkdown||'';},syncDesignEvidence:function(){}};
LF.Export={canonicalSnapshot:function(e){return{format:'labflow-canonical-v1',experiment:{id:e.id}};}};
require('../../assets/js/nomad/nomad.js');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
function truthy(v,label){if(!v)throw new Error((label||'assert')+': expected truthy');}
function exp(){return{id:'e1',meta:{name:'Demo',sourceName:'demo.zip'},sync:{revision:3},raw:{sourceArchive:null},samples:[{id:'s1',name:'S1'}],measurements:[{id:'m1',sample:'S1',bestEff:20.5,rankingEligible:true,qualityStatus:'valid'}],analysis:{summary:{eligibleCount:999,bestEfficiency:999}},findings:[],patches:[],design:{solutions:[],stack:[]},report:{labMarkdown:'# Current editor'}};}
module.exports=function(t,LF){
  t['NOMAD mapping, validation and YAML use one deterministic plan']=function(){
    const e=exp(),plan=LF.Nomad.ensureMapping(e),yaml=LF.Nomad.dataYaml(e,null,plan),validation=LF.Nomad.validate(e,null);
    assert(plan.sourceRevision,3,'revision');
    assert(plan.mappings.find(function(x){return x.nomad_path==='data.eligible_measurement_count';}).value,1,'eligible derived from canonical measurement');
    assert(plan.mappings.find(function(x){return x.nomad_path==='data.best_efficiency';}).value,20.5,'best efficiency derived from canonical measurement');
    truthy(yaml.indexOf('labflow_schema_version: "1.0"')>=0,'schema version matches mapping');
    truthy(yaml.indexOf('eligible_measurement_count: 1')>=0,'YAML uses mapping count');
    truthy(yaml.indexOf('best_efficiency: 20.5')>=0,'YAML uses mapping best');
    assert(e.nomad.mappingPlan,plan,'plan stored on experiment');
    truthy(validation.status!=='blocked','valid minimal mapping not blocked');
  };
  t['stale NOMAD mapping is rebuilt automatically']=function(){
    const e=exp(),first=LF.Nomad.ensureMapping(e);e.sync.revision=4;const second=LF.Nomad.ensureMapping(e);assert(first===second,false,'new plan');assert(second.sourceRevision,4,'new revision');
  };
  return t;
};
