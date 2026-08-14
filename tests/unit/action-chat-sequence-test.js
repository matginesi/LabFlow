'use strict';
const fs=require('fs');
const path=require('path');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  const root=path.resolve(__dirname,'../..');
  const uiPath=path.join(root,'assets/js/ai/action-ui.js');
  const assistantSource=fs.readFileSync(path.join(root,'assets/js/ai/assistant.js'),'utf8');
  const reportSource=fs.readFileSync(path.join(root,'assets/js/pages/report-page.js'),'utf8');

  function loadUi(runImpl){
    delete require.cache[require.resolve(uiPath)];
    let messages=[];
    LF.Storage={
      getAiSettings:function(){return{endpoint:'http://127.0.0.1:1234/v1',model:'test-model',provider:'lmstudio'};},
      getApiKey:function(){return'';}
    };
    LF.AIProviders={lmstudio:{keyRequired:false}};
    LF.State={state:{experiment:{id:'exp',derived:{chat:{conversation:[]}}},ui:{}},ensureExperiment:function(){return this.state.experiment;}};
    LF.PageContext={summary:function(){return'Report · Paper';}};
    LF.UI={activityStart:function(){},activityUpdate:function(){},activityFinish:function(){},activityError:function(){},toast:function(){}};
    LF.Assistant={addActionMessage:function(m){messages.push(m);return m;},render:function(){}};
    LF.ActionRunner={
      effective:function(id){if(id==='report.improve')return{id:id,title:'AI writing help',short_title:'Writing help',output:'text',steps:[{id:'edit',type:'AI'}]};return{id:id,title:id,output:'text',steps:[]};},
      isRunning:function(){return false;},cancel:function(){return true;},retry:function(cb){return runImpl('report.improve',cb);},run:function(id,cb){return runImpl(id,cb);}
    };
    require(uiPath);
    return{messages:messages};
  }

  t['SSE events refine progress inside the streaming band without reaching completion']=function(){
    loadUi(function(){return Promise.resolve({status:'done'});});
    const a=LF.ActionUI.streamFraction({content:'x'.repeat(400),targetTokens:1000,events:1});
    const b=LF.ActionUI.streamFraction({content:'x'.repeat(400),targetTokens:1000,events:40});
    assert(b.fraction>a.fraction,'events should refine streaming progress');
    assert(b.fraction<=.82,'streaming events must reserve validate/store progress');
    const d={steps:[{id:'infer',weight:.8},{id:'store',weight:.2}]};
    const first=LF.ActionUI.actionProgress(d,0,0,3,.5),second=LF.ActionUI.actionProgress(d,0,1,3,.1),third=LF.ActionUI.actionProgress(d,1,0,1,.1);
    assert(second>first,'next work unit must move global progress forward');
    assert(third>second,'next checkpoint must move global progress forward');
  };

  t['Completed visible text Actions publish their actual result into Assistant chat']=async function(){
    const env=loadUi(function(id,cb){return Promise.resolve({status:'done',actionId:id,aiOutput:'Evidence-backed interpretation.',result:{stored:true},requestMeta:{edit:{model:'test-model',provider:'lmstudio',usage:{promptTokens:10,completionTokens:5,totalTokens:15}}}});});
    const out=await LF.ActionUI.run('report.improve','',{params:{document_kind:'paper',mode:'paper_results'}});
    assert(out.status==='done','Action did not finish');
    assert(env.messages.length===1,'Action should publish one chat message');
    assert(env.messages[0].content==='Evidence-backed interpretation.','text Action result not preserved');
    assert(env.messages[0].actionTitle==='Writing help','Action title not attached');
    assert(env.messages[0].usage&&env.messages[0].usage.totalTokens===15,'Action token metadata not attached');
    assert(assistantSource.includes("Action · '+m.actionTitle"),'Action source not visible in chat telemetry');
  };

  t['Design inference publishes a useful proposal summary instead of an empty structured result']=async function(){
    const env=loadUi(function(){return Promise.resolve(null);});
    LF.ActionUI.publishActionResult(
      {id:'design.infer',output:'json'},
      {status:'done',actionId:'design.infer',aiOutput:{summary:'Filled only unresolved fabrication gaps.',devices:[{id:'d1'}],solutions:[{id:'s1'}],unknowns:['thickness']},result:{stored:true},requestMeta:{}},
      850
    );
    assert(env.messages.length===1,'Design Action should publish one chat message');
    const msg=env.messages[0].content;
    assert(msg.includes('Filled only unresolved fabrication gaps.'),'Design proposal summary missing');
    assert(msg.includes('proposed variants: 1'),'Design variant count missing');
    assert(msg.includes('proposed formulations: 1'),'Design formulation count missing');
    assert(msg.includes('still unknown: 1'),'Design unknown count missing');
    assert(msg.includes('Design Experiment'),'Design review destination missing');
  };

  t['Report and Paper All helpers execute section modes sequentially and aggregate one chat result']=async function(){
    const calls=[];
    const env=loadUi(function(id,cb){calls.push(cb.params.mode);return Promise.resolve({status:'done',actionId:id,aiOutput:'Edited '+cb.params.mode,result:{stored:true},requestMeta:{}});});
    const out=await LF.ActionUI.runSequence('report-all',{dataset:{actionKind:'paper'}});
    const expected=['paper_abstract','paper_introduction','paper_methods','paper_results','paper_discussion','paper_limitations','paper_conclusions'];
    assert(JSON.stringify(calls)===JSON.stringify(expected),'Paper All order mismatch: '+JSON.stringify(calls));
    assert(out&&out.status==='done','All sequence did not complete');
    assert(env.messages.length===1,'All should aggregate to one chat message');
    assert(env.messages[0].content.includes('Completed 7 / 7'),'All completion count missing');
    assert(env.messages[0].content.includes('### Abstract')&&env.messages[0].content.includes('### Conclusions'),'All section results missing');
    assert((reportSource.match(/data-action-sequence="report-all"/g)||[]).length===2,'Report/Paper All buttons missing');
  };


  t['Design All runs only incomplete variants sequentially and publishes one aggregate chat result']=async function(){
    const calls=[];
    const env=loadUi(function(id,cb){calls.push({id:id,deviceId:cb.params.deviceId});return Promise.resolve({status:'done',actionId:id,aiOutput:{summary:'Proposal '+cb.params.deviceId,devices:[],solutions:[],unknowns:[]},result:{stored:true},requestMeta:{}});});
    LF.State.state.experiment.design={solutions:[{id:'s1',name:'Known'}],devices:[
      {id:'complete',name:'Complete',sampleNames:['S0'],solutionIds:['s1'],stack:[{material:'ITO'}],process:{coating:'spin',annealing:'100 C',atmosphere:'N2'}},
      {id:'missing-a',name:'Missing A',sampleNames:['S1'],solutionIds:[],stack:[],process:{}},
      {id:'missing-b',name:'Missing B',sampleNames:['S2'],solutionIds:[],stack:[],process:{coating:'spin'}}
    ]};
    LF.State.state.selectedDesignDeviceId='complete';
    const out=await LF.ActionUI.runSequence('design-all',{});
    assert(JSON.stringify(calls.map(function(x){return x.deviceId;}))===JSON.stringify(['missing-a','missing-b']),'Design All must run incomplete variants one at a time in source order');
    assert(out&&out.status==='done'&&out.result.completed===2,'Design All completion count mismatch');
    assert(env.messages.length===1,'Design All should publish one aggregate chat message');
    assert(env.messages[0].content.includes('Prepared AI completion for 2 / 2'),'Design All aggregate summary missing');
    assert(env.messages[0].content.includes('Missing A')&&env.messages[0].content.includes('Missing B'),'Design All variant names missing');
    assert(LF.State.state.selectedDesignDeviceId==='missing-a','Design All should land on the first proposal ready for review');
  };
  return t;
};
