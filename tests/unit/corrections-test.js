'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/experiment/data-model.js');
const LF=global.LabFlow;
LF.Parser=LF.Parser||{
  canonicalSample:function(v){return String(v||'').trim().toUpperCase();},
  groupFromSample:function(v){return /^REF/i.test(String(v||''))?'REF':'TEST';},
  isReference:function(v){return /^REF/i.test(String(v||''));}
};
LF.State={state:{user:{name:'Tester'}}};
require('../../assets/js/ai/action-steps.js');
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

  t['excluded danger diagnostics no longer keep dataset workflow blocked']=function(){
    const oldStore=LF.CanonicalStore;
    LF.CanonicalStore={ensure:function(exp){return{experiment:{name:'x',sourceName:'x.zip'},evidence:[]};},summary:function(){return{files:1,samples:1,measurements:1,evidence:0,relations:0,aliases:0};}};
    const base={sync:{revision:1},interpretationOverrides:{fields:{},units:{},scales:{}},patches:[],files:[],samples:[{id:'s1',name:'A',aliases:[]}],findings:[{id:'f1',type:'measurement-quality',severity:'danger',title:'Bad metric',status:'open',measurementId:'m1'}]};
    const excluded=Object.assign({},base,{measurements:[{id:'m1',sample:'A',group:'A',isRef:false,qualityStatus:'blocked',excluded:true,blockingFlags:[{label:'Bad metric'}]}]});
    const review=LF.DatasetCorrections.analysis(excluded,1);
    assert(review.status,'review','excluded diagnostic is review, not blocker');
    assert(review.summary.blockingFindings,0,'no workflow blockers');
    const active=Object.assign({},base,{measurements:[{id:'m1',sample:'A',group:'A',isRef:false,qualityStatus:'blocked',excluded:false,blockingFlags:[{label:'Bad metric'}]}]});
    const blocked=LF.DatasetCorrections.analysis(active,1);
    assert(blocked.status,'blocked','unapproved scientific exclusion remains blocked');
    assert(blocked.summary.blockingFindings,1,'unapproved exclusion remains a workflow blocker');
    assert(blocked.reviewFixes.length,1,'blocked measurement has an explicit review suggestion');
    const hard=Object.assign({},active,{findings:active.findings.concat([{id:'f-hard',type:'archive',severity:'danger',title:'Archive corruption',status:'open'}])});
    const hardBlocked=LF.DatasetCorrections.analysis(hard,1);
    assert(hardBlocked.status,'blocked','non-fixable danger remains hard blocker');
    LF.CanonicalStore=oldStore;
  };


  t['safe cleanup stays pending until explicit acceptance and then mutates LabFlow Data']=function(){
    const exp={sync:{revision:1},interpretationOverrides:{fields:{},units:{},scales:{}},patches:[],samples:[],measurements:[{id:'m1',sample:'A_1',group:'',isRef:false}],findings:[]};
    const preview=LF.DatasetCorrections.prepareAutomaticSafeFixes(exp);
    assert(preview.pending,1,'one safe cleanup is detected');
    assert(exp.measurements[0].group,'','preview must not mutate data');
    assert((exp.patches||[]).length,0,'preview must not create applied provenance');
    const applied=LF.DatasetCorrections.applyAutomaticSafeFixes(exp);
    assert(applied.lastApplied,1,'accept applies the pending correction');
    assert(exp.measurements[0].group,'TEST','accepted cleanup changes LabFlow Data');
    assert(exp.patches.length,1,'accepted cleanup creates provenance');
    assert(exp.patches[0].source,'automatic','cleanup provenance source');
    assert(exp.patches[0].status,'applied','cleanup patch status');
    const refreshed=LF.DatasetCorrections.prepareAutomaticSafeFixes(exp);
    assert(refreshed.pending,0,'accepted cleanup is no longer pending');
  };


  t['AI correction storage rejects stale or non-semantic mutations before UI application']=function(){
    const exp={sync:{revision:0},interpretationOverrides:{fields:{},units:{},scales:{}},patches:[],samples:[{id:'s1',name:'OLD',rawName:'old',aliases:['old'],group:'TEST',isRef:false}],measurements:[{id:'m1',sample:'OLD',rawSample:'old',path:'a.txt',group:'TEST',isRef:false}],findings:[{id:'f1',type:'identity',status:'open',target:'OLD',measurementId:'m1'}],datasetAnalysis:{sourceRevision:0,ambiguousFindings:[{id:'f1',type:'identity',target:'OLD',measurementId:'m1'}]}};
    const ctx={exp:exp,sourceRevision:0,lastResult:{summary:'x',proposals:[{finding_id:'f1',patch_type:'sample_mapping',target:'f1',before:'OLD',after:'REF-01',requires_human_review:false},{finding_id:'f1',patch_type:'exclude_measurement',target:'m1',before:false,after:true,requires_human_review:true}],unresolved:[]}};
    const out=LF.ActionSteps['dataset.store-corrections'](ctx);
    assert(out.proposals,1,'only semantic proposal stored');
    assert(out.rejected,1,'unsafe AI mutation rejected');
    const plan=LF.ActionData.proposal(exp,'dataset.resolve-ambiguities');assert(plan.proposals[0].requires_human_review,true,'human review forced');
    assert(plan.proposals[0].target,'m1','canonical measurement target forced');
    assert(plan.unresolved.length,1,'rejected proposal retained as unresolved diagnostic');
  };

  t['accepted group correction survives canonical refresh, chaining and persistence']=function(){
    const previous={state:LF.State,derived:LF.DerivedState,pipeline:LF.DataPipeline,contracts:LF.DataContracts,store:LF.CanonicalStore};
    const raw=new Uint8Array([80,75,3,4,17,29]).buffer;
    const exp=LF.DataModel.hydrate({id:'dataset-1',raw:{sourceName:'source.zip',sourceArchive:raw},sync:{revision:4},interpretationOverrides:{fields:{},units:{},scales:{}},patches:[],actionData:{proposals:{},annotations:{},status:{}},experiments:[{id:'e-old',name:'OLD',sampleIds:['s1'],sampleNames:['S1'],runIds:['r1'],measurementIds:['m1','m2']},{id:'e-new',name:'NEW',sampleIds:[],sampleNames:[],runIds:[],measurementIds:[]}],samples:[{id:'s1',name:'S1',rawName:'S1',aliases:['S1'],experimentId:'e-old',experiment:'OLD',group:'OLD',runIds:['r1'],measurementIds:['m1','m2']}],runs:[{id:'r1',path:'run',sampleId:'s1',sample:'S1',experimentId:'e-old',experiment:'OLD',measurementIds:['m1','m2']}],measurements:[{id:'m1',sampleId:'s1',sample:'S1',experimentId:'e-old',experiment:'OLD',group:'OLD',runId:'r1'},{id:'m2',sampleId:'s1',sample:'S1',experimentId:'e-old',experiment:'OLD',group:'OLD',runId:'r1'}],design:{devices:[{id:'d1',name:'Device 1',experimentId:'e-old',group:'OLD',sampleIds:['s1'],sampleNames:['S1'],solutionIds:[],stack:[],process:{},status:'parsed'}]},findings:[{id:'f-group',kind:'finding',type:'group-mapping',severity:'warning',title:'Group needs review',status:'open',source:'deterministic',measurementId:'m1'}]});
    exp.datasetAnalysis={sourceRevision:4,ambiguousFindings:[{id:'f-group',type:'group-mapping',measurementId:'m1',target:'OLD'}]};
    let refreshed=0,notified=0,invalidated=0;
    LF.State={state:{experiment:exp,user:{name:'Tester'},ui:{route:'results'}},notify:function(){notified++;}};
    LF.DerivedState={invalidate:function(){invalidated++;return['canonical-index','analysis-summary'];}};
    LF.DataPipeline={refresh:function(current){refreshed++;LF.DatasetCorrections.rebuildSamples(current);current.analysis={summary:{measurementCount:current.measurements.length,groups:Array.from(new Set(current.measurements.map(function(m){return m.group;})))}};return{status:'ready',sourceRevision:current.sync.revision};}};
    LF.DataContracts={assert:function(){return{ok:true};}};
    const beforeIdentity=LF.State.state.experiment,sourceBefore=Array.from(new Uint8Array(exp.raw.sourceArchive));
    const proposal={finding_id:'f-group',patch_type:'group_mapping',target:'m1',before:'OLD',after:'NEW',reason:'Confirmed group',evidence:['finding:f-group']};
    const out=LF.DatasetCorrections.commitProposals(exp,proposal,'ai',{actionId:'dataset.resolve-ambiguities',reason:'regression'});
    assert(out.committed,true,'commit acknowledged only after refresh');
    assert(out.changed,2,'the sample-level mapping updates both sibling measurements');
    assert(out.revisionBefore,4,'input revision');assert(out.revisionAfter,5,'committed revision');
    assert(LF.State.state.experiment===beforeIdentity,true,'one canonical object identity');
    assert(exp.measurements.map(function(m){return m.group;}),['NEW','NEW'],'Results inputs keep corrected group');
    assert(exp.measurements.map(function(m){return m.experimentId;}),['e-new','e-new'],'stable experiment relation propagated');
    assert(exp.samples[0].experimentId,'e-new','sample relation propagated');assert(exp.runs[0].experimentId,'e-new','run relation propagated');
    assert(exp.design.devices[0].experimentId,'e-new','Design relation propagated');assert(exp.design.devices[0].group,'NEW','Design group propagated');
    assert(exp.analysis.summary.groups,['NEW'],'derived Results recomputed from corrected state');
    assert(exp.patches.length,1,'one sample-scoped provenance patch');assert(exp.patches[0].target,{kind:'sample',id:'s1'},'patch targets the corrected physical sample');
    const chainedInput=LF.State.state.experiment.measurements.map(function(m){return m.group;});assert(chainedInput,['NEW','NEW'],'next Action reads state after Action A');
    const saved=LF.DomainSchema.snapshot(exp),restored=LF.DataModel.hydrate(saved);assert(restored.measurements.map(function(m){return m.group;}),['NEW','NEW'],'saved/exported state retains correction');
    assert(Array.from(new Uint8Array(exp.raw.sourceArchive)),sourceBefore,'source ZIP bytes unchanged');
    assert(refreshed,1,'pipeline refreshed once');assert(invalidated,1,'derived state invalidated once');assert(notified,1,'UI/storage notified after validation');
    LF.State=previous.state;LF.DerivedState=previous.derived;LF.DataPipeline=previous.pipeline;LF.DataContracts=previous.contracts;LF.CanonicalStore=previous.store;
  };
  return t;
};
