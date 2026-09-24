'use strict';
const LF=global.LabFlow;
LF.AnalysisSummary={ensure:function(){return{
  advanced:{quality:{eligible:7},pairedScans:{count:3,absDeltaPce:{median:0.42}}},
  findings:{open:2},
  anomalies:[{sample:'S3'},{sample:'S8'}]
};}};
require('../../assets/js/ai/assistant-core.js');
require('../../assets/js/ai/assistant.js');
function ok(value,label){if(!value)throw new Error(label||'assertion failed');}
module.exports=function(t){
  const exp={id:'exp_1',analysis:{summary:{measurementCount:12,sampleCount:8,experimentCount:2,eligibleCount:7,bestEfficiency:21.37,bestSample:'S5',bestExperiment:'Control'}},findings:[]};
  t['Assistant explicit local commands answer common Results facts without a provider']=function(){
    const best=LF.Assistant.deterministicAnswer(exp,'/best');
    const count=LF.Assistant.deterministicAnswer(exp,'/count measurements');
    const summary=LF.Assistant.deterministicAnswer(exp,'/summary');
    ok(best&&best.includes('21.37%')&&best.includes('S5'),'best-PCE local command');
    ok(count&&count.includes('12 measurements'),'measurement-count local command');
    ok(summary&&summary.includes('7 ranking-eligible')&&summary.includes('0.42 pp'),'summary local command');
  };
  t['Natural-language questions are never parsed with language-specific fast paths']=function(){
    ok(LF.Assistant.deterministicAnswer(exp,'What is the best PCE?')===null,'English natural language routes');
    ok(LF.Assistant.deterministicAnswer(exp,'Was ist die beste Effizienz?')===null,'German natural language routes');
    ok(LF.Assistant.deterministicAnswer(exp,'¿Cuál es la mejor eficiencia?')===null,'Spanish natural language routes');
  };
  return t;
};
