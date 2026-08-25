'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/experiment/data-model.js');
require('../../assets/js/experiment/canonical-store.js');
require('../../assets/js/ai/action-steps.js');
require('../../assets/js/tools/registry.js');
require('../../assets/js/ai/prompt-bundle.js');
require('../../assets/js/ai/action-registry.js');
require('../../assets/js/ai/structured.js');
require('../../assets/js/ai/context.js');
require('../../assets/js/ai/actions.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));
}
function truthy(value,label){if(!value)throw new Error(label||'expected truthy');}

module.exports=function(t,LF){
  function fake(){
    const e=LF.DataModel.create({sourceName:'tool-demo.zip'});
    e.meta.name='Tool demo';
    e.files=[{id:'f1',path:'a.txt',name:'a.txt'}];
    e.samples=[{id:'s1',name:'DEVICE A',rawName:'Device_A',aliases:['Device_A'],group:'A',isRef:false,measurementIds:['m1']}];
    e.measurements=[{id:'m1',sample:'DEVICE A',rawSample:'Device_A',group:'A',path:'a.txt',isRef:false,qualityStatus:'valid',rankingEligible:true,bestEff:21.2,fw:{eff:20.8},rv:{eff:21.2}}];
    e.findings=[{id:'fd1',status:'open',severity:'warning',type:'quality',title:'Check repeat',target:'m1',measurementId:'m1',evidence:['a.txt']}];
    e.analysis={summary:{bestSample:'DEVICE A',bestEfficiency:21.2,measurementCount:1},topNonRef:[{id:'m1',sample:'DEVICE A',bestEff:21.2}],topRef:[],bestBySample:[{id:'m1',sample:'DEVICE A',bestEff:21.2}]};
    e.design={devices:[],solutions:[]};
    e.report={kind:'lab',labTitle:'Lab',paperTitle:'Paper',labMarkdown:'# Lab\n\nCurrent report.',paperMarkdown:'# Paper\n\nCurrent paper.',figureSelections:{lab:{bestJvmCurve:true},paper:{bestJvmCurve:false}}};
    e.documentEdits=[];e.patches=[];
    LF.CanonicalStore.build(e);
    return e;
  }
  function state(e){
    LF.State={state:{experiment:e,ui:{}},ensureDerived:function(x){x.derived=x.derived||{};x.derived.actions=x.derived.actions||{};x.derived.chat=x.derived.chat||{conversation:[]};return x.derived;},startActionRun:function(){},endActionRun:function(){},touch:function(){},isDirty:function(){return false;}};
  }

  t['canonical v2 exposes stable grouped domains while retaining compatibility aliases']=function(){const e=fake(),s=LF.CanonicalStore.ensure(e);assert(s.format,'labflow-canonical-v2','format');assert(s.entities.samples[0].id,'s1','entity');assert(s.scientific.results.summary.bestSample,'DEVICE A','results');assert(s.documents.lab.markdown,'# Lab\n\nCurrent report.','document');assert(s.samples[0].id,'s1','legacy alias');};

  t['canonical document view refreshes on draft timestamps without requiring revision bump']=function(){const e=fake();const first=LF.CanonicalStore.ensure(e);e.report.labMarkdown='# Lab\n\nEdited now.';e.report.labUpdatedAt='2026-08-14T07:00:00Z';const second=LF.CanonicalStore.ensure(e);truthy(first!==second,'store rebuilt');assert(second.documents.lab.markdown,'# Lab\n\nEdited now.','fresh draft');};

  t['read tools query canonical data and agent mode rejects write tools']=function(){const e=fake();state(e);const r=LF.ToolRegistry.execute('results.get',{}, {exp:e,agent:true});assert(r.summary.bestSample,'DEVICE A','result');const m=LF.ToolRegistry.execute('measurements.query',{sample:'Device_A'}, {exp:e,agent:true});assert(m[0].id,'m1','alias query');let blocked=false;try{LF.ToolRegistry.execute('dataset.analyze',{}, {exp:e,agent:true});}catch(err){blocked=/cannot invoke non-read tool/i.test(err.message);}assert(blocked,true,'write blocked');};


  t['assistant model text removes leaked LabFlow placeholder markers']=function(){
    const raw='Evidence: the %%LFMD0%% tool returned a paper object whose markdown begins with %%LFMD1%%. No real title is stored.';
    const clean=LF.Core.cleanModelText(raw);
    truthy(clean.indexOf('%%LFMD')<0,'no LFMD marker');
    truthy(clean.indexOf('LabFlow read tool')>=0,'tool marker normalized');
  };

  t['tool catalog keeps stable ids and validates typed arguments'] = function(){
    const e=fake();state(e);
    const listed=LF.ToolRegistry.describeForAgent(['sample.get']);
    assert(listed[0].id,'sample.get','catalog id');
    let missing=false;try{LF.ToolRegistry.execute('sample.get',{}, {exp:e,agent:true});}catch(err){missing=/requires argument: sample/i.test(err.message);}
    assert(missing,true,'required argument');
    let type=false;try{LF.ToolRegistry.execute('measurements.query',{limit:'many'}, {exp:e,agent:true});}catch(err){type=/must be number/i.test(err.message);}
    assert(type,true,'argument type');
  };

  t['assistant Knowledge Base tool is a simple read-only lookup with explicit external provenance']=function(){
    const e=fake(),previous=LF.KnowledgeBase;state(e);LF.KnowledgeBase={status:function(){return{active:true,available:true,records:48};},search:function(query){return[{id:'kb_sno2',collection:'science',kind:'material',name:'SnO2',data:{role:'ETL'},sources:[{doi:'10.1000/source'}],retrieval:{score:12,matched_terms:['sno2']}}];}};
    try{const out=LF.ToolRegistry.execute('knowledge.search',{query:'SnO2 electron contact',limit:4},{exp:e,agent:true});assert(out.available,true,'lookup available without setup');assert(out.total_library_records,48,'library size');assert(out.records[0].id,'kb_sno2','retrieved record');assert(out.records[0].collection,'science','scientific provenance retained');assert(out.records[0].data.role,'ETL','record data retained');const listed=LF.ToolRegistry.describeForAgent(['knowledge.search']);assert(listed[0].id,'knowledge.search','agent-visible tool');}
    finally{LF.KnowledgeBase=previous;}
  };

  t['assistant answers with one provider request using deterministic context']=async function(){const e=fake();state(e);let calls=0,finalMessages=null;LF.Storage={getEffectiveAction:function(id){return LF.ActionRegistry.action(id);},getAiSettings:function(){return{provider:'custom',endpoint:'http://local/v1',model:'demo',streaming:false,maxOutputTokensCap:0};},getAssistantSettings:function(){return{maxOutputTokens:2048,contextChars:12000,memoryTurns:0,memoryChars:0,messageChars:1000,memoryEnabled:false};},getEffectivePrompt:function(id){return LF.ActionRegistry.prompt(id);}};LF.AI={acceptController:function(){},estimateTokens:function(x){return Math.ceil(String(x||'').length/4);},buildRequest:function(x){return x;},send:async function(spec){calls++;finalMessages=spec.messages;return{content:'DEVICE A is the current best sample at 21.2%.',finishReason:'stop',model:'demo',provider:'custom'};}};const out=await LF.ActionRunner.run('assistant.chat',{userText:'Which sample is best?'});assert(out.status,'done','status');assert(out.result,'DEVICE A is the current best sample at 21.2%.','answer');truthy(JSON.stringify(finalMessages).indexOf('DEVICE A')>=0,'deterministic experiment context in request');assert(calls,1,'one LLM request per Assistant turn');};

  t['assistant does not require provider JSON tool-choice support']=async function(){const e=fake();state(e);let calls=0;LF.Storage={getEffectiveAction:function(id){return LF.ActionRegistry.action(id);},getAiSettings:function(){return{provider:'nvidia',endpoint:'http://local/v1',model:'nvidia/nemotron',streaming:false,maxOutputTokensCap:0};},getAssistantSettings:function(){return{maxOutputTokens:2048,contextChars:12000,memoryTurns:0,memoryChars:0,messageChars:1000,memoryEnabled:false};},getEffectivePrompt:function(id){return LF.ActionRegistry.prompt(id);}};LF.AI={acceptController:function(){},estimateTokens:function(x){return Math.ceil(String(x||'').length/4);},buildRequest:function(x){return x;},send:async function(){calls++;return{content:'I can answer directly from the available experiment context.',finishReason:'stop',model:'nvidia/nemotron',provider:'nvidia'};}};const out=await LF.ActionRunner.run('assistant.chat',{userText:'Summarize this experiment.'});assert(out.status,'done','status');assert(out.result,'I can answer directly from the available experiment context.','direct answer');assert(calls,1,'single direct request');};

  return t;
};
