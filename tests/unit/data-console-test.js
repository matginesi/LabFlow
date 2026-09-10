'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/experiment/action-data.js');
require('../../assets/js/experiment/derived-state.js');
require('../../assets/js/state.js');
require('../../assets/js/data/analysis.js');
require('../../assets/js/experiment/data-console.js');
function assert(a,b,l){if(JSON.stringify(a)!==JSON.stringify(b))throw new Error((l||'assert')+': expected '+JSON.stringify(b)+' got '+JSON.stringify(a));}
module.exports=function(t,LF){
  t['Data console facade returns the canonical ExperimentData object']=function(){const e=LF.DataModel.create({sourceName:'console.zip'});e.experiments=[{id:'e1',name:'N3'}];e.samples=[{id:'s1',name:'N3_1_1A',experimentId:'e1',experiment:'N3',group:'N3'}];e.measurements=[{id:'m1',sampleId:'s1',sample:'N3_1_1A',experimentId:'e1',experiment:'N3',group:'N3'}];LF.State.setExperiment(e);assert(LF.Data.current()===LF.State.state.experiment,true,'same canonical object');assert(LF.Data.samples({experiment:'N3'}).map(function(x){return x.id;}),['s1'],'query');assert(LF.Data.get('N3_1_1A').type,'sample','inspect');assert(LF.Data.help().includes('LabFlow.Data.measurements'),true,'help');assert(LF.Data.types().includes('measurement'),true,'types');assert(LF.Data.describe('measurement').fields.includes('fw'),true,'measurement docs');assert(LF.Data.sample('N3_1_1A').id,'s1','singular sample');};
  return t;
};
