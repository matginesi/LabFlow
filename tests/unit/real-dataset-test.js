'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/ai/prompt-bundle.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/experiment/action-data.js');
require('../../assets/js/experiment/data-contracts.js');
require('../../assets/js/data/parser.js');
require('../../assets/js/data/importer.js');
const fs=require('fs'),path=require('path');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
function truthy(value,label){if(!value)throw new Error((label||'assert')+': expected truthy, got '+JSON.stringify(value));}
module.exports=function(t,LF,env){
  t['private reference dataset keeps the expected scientific projection']=async function(){
    const file=path.join(env.root,'TEST_DATA','2026_01_22.zip');
    if(!fs.existsSync(file))throw new Error('Private fixture TEST_DATA/2026_01_22.zip is required for this integration suite.');
    const buf=fs.readFileSync(file),ab=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
    const exp=await LF.Importer.parseDataset(ab,'2026_01_22.zip');
    assert(exp.experiments.map(function(x){return x.name;}).sort(),['N1','N2','N3','NEW','REF'],'logical experiments');
    assert(exp.samples.length,31,'physical samples/cells');
    assert(exp.runs.length,42,'acquisition runs');
    assert(exp.measurements.length,72,'JV measurements');
    const repeated=exp.samples.find(function(x){return x.name==='N2_1_1A';});
    truthy(repeated,'repeated sample exists');
    assert(repeated.experiment,'N2','sample links to logical experiment');
    assert(repeated.runIds.length,1,'one acquisition run for N2_1_1A');
    assert(repeated.measurementIds.length,5,'five JV measurements stay under one cell');
  };
  return t;
};
