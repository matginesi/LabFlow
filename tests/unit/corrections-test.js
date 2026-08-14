'use strict';
require('../../assets/js/logger.js');
const LF=global.LabFlow;
LF.Parser=LF.Parser||{
  canonicalSample:function(v){return String(v||'').trim().toUpperCase();},
  groupFromSample:function(v){return /^REF/i.test(String(v||''))?'REF':'TEST';},
  isReference:function(v){return /^REF/i.test(String(v||''));}
};
LF.State={state:{user:{name:'Tester'}}};
require('../../assets/js/ai/operation-steps.js');
function assert(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));}
module.exports=function(t,LF){
  t['AI correction can target a deterministic finding id']=function(){
    const exp={interpretationOverrides:{fields:{},units:{},scales:{}},patches:[],samples:[{id:'s1',name:'OLD',rawName:'old',aliases:['old'],group:'TEST',isRef:false}],measurements:[{id:'m1',sample:'OLD',rawSample:'old',path:'a.txt',group:'TEST',isRef:false}],findings:[{id:'f1',target:'OLD',measurementId:'m1'}]};
    const p={finding_id:'f1',patch_type:'sample_mapping',target:'f1',before:'OLD',after:'REF-01',reason:'Evidence resolves identity',evidence:['e1'],confidence:.9};
    assert(LF.DatasetCorrections.proposalMeasurements(exp,p).map(function(m){return m.id;}),['m1'],'finding resolves measurement');
    LF.DatasetCorrections.applyProposal(exp,p,'ai');
    assert(exp.measurements[0].sample,'REF-01','sample mapped');
    assert(exp.measurements[0].isRef,true,'reference recomputed');
    assert(p.applied,true,'proposal marked applied');
  };

  t['AI correction storage rejects stale or non-semantic mutations before UI application']=function(){
    const exp={sync:{revision:0},interpretationOverrides:{fields:{},units:{},scales:{}},patches:[],samples:[{id:'s1',name:'OLD',rawName:'old',aliases:['old'],group:'TEST',isRef:false}],measurements:[{id:'m1',sample:'OLD',rawSample:'old',path:'a.txt',group:'TEST',isRef:false}],findings:[{id:'f1',type:'identity',status:'open',target:'OLD',measurementId:'m1'}],datasetAnalysis:{sourceRevision:0,ambiguousFindings:[{id:'f1',type:'identity',target:'OLD',measurementId:'m1'}]}};
    const ctx={exp:exp,sourceRevision:0,lastResult:{summary:'x',proposals:[{finding_id:'f1',patch_type:'sample_mapping',target:'f1',before:'OLD',after:'REF-01',requires_human_review:false},{finding_id:'f1',patch_type:'exclude_measurement',target:'m1',before:false,after:true,requires_human_review:true}],unresolved:[]}};
    const out=LF.OperationSteps['dataset.store-corrections'](ctx);
    assert(out.proposals,1,'only semantic proposal stored');
    assert(out.rejected,1,'unsafe AI mutation rejected');
    assert(exp.aiCorrectionPlan.proposals[0].requires_human_review,true,'human review forced');
    assert(exp.aiCorrectionPlan.proposals[0].target,'m1','canonical measurement target forced');
    assert(exp.aiCorrectionPlan.unresolved.length,1,'rejected proposal retained as unresolved diagnostic');
  };
  return t;
};
