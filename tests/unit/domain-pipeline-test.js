'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/ai/prompt-bundle.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/experiment/action-data.js');
require('../../assets/js/experiment/data-contracts.js');
require('../../assets/js/experiment/derived-state.js');
require('../../assets/js/state.js');
require('../../assets/js/data/parser.js');
require('../../assets/js/experiment/canonical-store.js');
require('../../assets/js/data/importer.js');
require('../../assets/js/data/analysis.js');
require('../../assets/js/data/analysis-summary.js');
require('../../assets/js/experiment/design-model.js');
require('../../assets/js/data/dataset-corrections.js');
require('../../assets/js/experiment/design-analysis.js');
require('../../assets/js/data/pipeline.js');
const fs=require('fs'),path=require('path');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
function truthy(v,label){if(!v)throw new Error(label||'expected truthy');}
module.exports=function(t,LF,env){
  function validGraph(){
    const e=LF.DataModel.create({sourceName:'domain.zip'});
    e.experiments=[{id:'e1',name:'N1',sampleIds:['s1'],runIds:['r1'],measurementIds:['m1']}];
    e.samples=[{id:'s1',name:'N1_1A',experimentId:'e1',experiment:'N1',runIds:['r1'],measurementIds:['m1']}];
    e.runs=[{id:'r1',sampleId:'s1',experimentId:'e1',measurementIds:['m1']}];
    e.measurements=[{id:'m1',sampleId:'s1',sample:'N1_1A',experimentId:'e1',experiment:'N1',runId:'r1',sequence:1,fw:{eff:18},rv:{eff:19}}];
    e.normalize();return e;
  }
  function load(name){const b=fs.readFileSync(path.join(env.root,'TEST_DATA',name));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}

  t['ExperimentData contract validates the canonical experiment-sample-run-measurement graph']=function(){
    const e=validGraph(),out=LF.DataContracts.validate(e);
    assert(out.ok,true,'valid graph');assert(out.counts.experiments,1,'experiment count');assert(out.counts.samples,1,'sample count');assert(out.counts.runs,1,'run count');assert(out.counts.measurements,1,'measurement count');
    assert(LF.DataContracts.describe('measurement').description.indexOf('FW/RV are scans')>=0,true,'measurement semantics documented');
  };

  t['ExperimentData contract fails closed on broken hierarchy links']=function(){
    const e=validGraph();e.measurements[0].sampleId='missing';const out=LF.DataContracts.validate(e);
    assert(out.ok,false,'broken graph rejected');truthy(out.errors.some(function(x){return x.code==='BROKEN_RELATION'&&/sampleId/.test(String(x.path||''));}),'broken measurement sample reported');
  };

  t['Real JV fixture survives the full deterministic pipeline with stable hierarchy']=async function(){
    const e=await LF.Importer.parseDataset(load('2026_01_22.zip'),'2026_01_22.zip');
    LF.State.setExperiment(e);const status=LF.DataPipeline.refresh(e,{reason:'unit-real-jv'});
    assert(e instanceof LF.ExperimentData,true,'aggregate root');
    assert([e.experiments.length,e.samples.length,e.runs.length,e.measurements.length],[5,31,42,72],'hierarchy counts');
    assert(status.status,'ready','pipeline status');assert(status.validation.ok,true,'domain validation');
    assert(status.plan.map(function(x){return x.id;}),['normalize','link','validate-structure','analyze','index','review','auto-cleanup','project-design','summarize','validate-final'],'logical stage plan');
    truthy(status.executions.length>=status.plan.length,'execution trace includes logical plan and any bounded restart');
    truthy(status.restarts>=0,'restart count exposed');
    assert(e.autoCleanup&&e.autoCleanup.applied,0,'scientific exclusions are not automatic');
    assert((e.datasetAnalysis&&e.datasetAnalysis.reviewFixes||[]).length,23,'blocked measurements become reviewable exclusion suggestions');
    assert(e.measurements.filter(function(m){return m.excluded;}).length,0,'suggestions do not mutate measurements before approval');
    const findingCount=e.findings.length,automaticPatches=(e.patches||[]).filter(function(x){return x.source==='automatic';}).length;LF.DataPipeline.refresh(e,{reason:'idempotence-check'});assert(e.findings.length,findingCount,'pipeline refresh must not accumulate duplicate findings');assert((e.patches||[]).filter(function(x){return x.source==='automatic';}).length,automaticPatches,'automatic cleanup is idempotent');
    truthy(e.samples.every(function(s){return s.experimentId&&s.runIds&&s.measurementIds;}),'sample links preserved');
    truthy(e.runs.every(function(r){return r.sampleId&&r.experimentId;}),'run links preserved');
    truthy(e.measurements.every(function(m){return m.sampleId&&m.experimentId&&m.runId;}),'measurement links preserved');
  };
};
