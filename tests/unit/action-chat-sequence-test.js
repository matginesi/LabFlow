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
    let messages=[],errors=[],updates=[],finishes=[];
    LF.Storage={
      getAiSettings:function(){return{endpoint:'http://127.0.0.1:1234/v1',model:'test-model',provider:'lmstudio'};},
      getApiKey:function(){return'';}
    };
    LF.AIProviders={lmstudio:{keyRequired:false}};
    LF.State={state:{experiment:{id:'exp',derived:{chat:{conversation:[]}}},ui:{}},ensureExperiment:function(){return this.state.experiment;},touch:function(){}};
    LF.PageContext={summary:function(){return'Report · Paper';}};
    LF.UI={activityStart:function(){},activityUpdate:function(options){updates.push(options);},activityFinish:function(options){finishes.push(options);},activityError:function(error,options){errors.push({error:error,options:options});},toast:function(){}};
    LF.Assistant={addActionMessage:function(m){messages.push(m);return m;},render:function(){}};
    LF.ActionRunner={
      effective:function(id){if(id==='report.improve')return{id:id,title:'AI writing help',short_title:'Writing help',output:'text',steps:[{id:'edit',type:'AI'}]};return{id:id,title:id,output:'text',steps:[]};},
      isRunning:function(){return false;},cancel:function(){return true;},retry:function(cb){return runImpl('report.improve',cb);},run:function(id,cb){return runImpl(id,cb);}
    };
    require(uiPath);
    return{messages:messages,errors:errors,updates:updates,finishes:finishes};
  }

  t['SSE progress is token-based and ignores transport event fragmentation']=function(){
    loadUi(function(){return Promise.resolve({status:'done'});});
    const a=LF.ActionUI.streamFraction({content:'x'.repeat(400),targetTokens:1000,events:1});
    const b=LF.ActionUI.streamFraction({content:'x'.repeat(400),targetTokens:1000,events:40});
    assert(b.fraction===a.fraction,'transport event count must not inflate progress');
    assert(b.fraction<=.82,'streaming tokens must reserve validate/store progress');
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
    assert(assistantSource.includes("role:'system'")&&assistantSource.includes('eventTitle'),'Action source not visible as a compact system event');
  };

  t['Action totem receives live and final output throughput']=async function(){
    const env=loadUi(function(id,cb){cb.onProgress({content:'streaming response',tokens:4,rate:22.5,estimated:true,events:2,meaningfulEvents:2,bytes:64,ttftMs:90,targetTokens:100,maxTokens:120});return Promise.resolve({status:'done',actionId:id,aiOutput:'Done.',result:{stored:true},requestMeta:{edit:{model:'test-model',provider:'lmstudio',tokensPerSecond:24.25,usage:{promptTokens:10,completionTokens:4,totalTokens:14}}}});});
    const out=await LF.ActionUI.run('report.improve','',{params:{document_kind:'paper',mode:'paper_results'}});
    assert(out.status==='done','Action did not finish');
    const live=env.updates.find(function(update){return update.stream&&Number(update.stream.rate)>0;});
    assert(live&&live.stream.rate===22.5&&live.stream.estimated===true,'live tok/s telemetry not passed to totem');
    assert(env.finishes[0]&&env.finishes[0].details['Output rate']==='24.3 tok/s','final tok/s missing from totem details');
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
    assert(msg.includes('stack layers suggested: 0'),'Design stack summary missing');
    assert(msg.includes('solution suggestions: 1'),'Design solution summary missing');
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


  t['Design inference stores a suggestion without mutating the Working Copy']=async function(){
    const env=loadUi(function(id,cb){
      const proposal={targetDeviceId:cb.params.deviceId,summary:'Suggested chemistry and stack',solutions:[{name:'Model ink'}],devices:[{sample_names:['S1'],solution_names:['Model ink'],stack:[{role:'ETL',material:'SnO2'}]}],unknowns:[]};
      LF.State.state.experiment.aiDesignProposal=proposal;LF.State.state.experiment.aiDesignProposals={d1:proposal};
      return Promise.resolve({status:'done',actionId:id,aiOutput:proposal,result:{stored:true},requestMeta:{}});
    });
    const exp=LF.State.state.experiment;exp.design={solutions:[],devices:[{id:'d1',name:'D1',sampleNames:['S1'],solutionIds:[],stack:[],process:{}}]};
    const out=await LF.ActionUI.run('design.infer','',{params:{deviceId:'d1'}});
    assert(out.status==='done','Design inference should complete');
    assert(!out.designApplied,'AI suggestion must not be auto-applied');
    assert(exp.design.solutions.length===0&&exp.design.devices[0].stack.length===0,'Working Copy must stay unchanged before acceptance');
    assert(exp.designAiStatus.d1.state==='suggested','selected experiment should become Suggested');
    assert(env.finishes[0].message==='Action completed.','totem should report a normal completed suggestion');
  };

  t['Design inference failure becomes a retryable per-experiment state']=async function(){
    const env=loadUi(function(){return Promise.resolve({status:'error',actionId:'design.infer',message:'provider failed',failedStep:'infer',code:'NETWORK_ERROR',requestMeta:{}});});
    const exp=LF.State.state.experiment;exp.design={solutions:[],devices:[{id:'d1',name:'D1',sampleNames:[],solutionIds:[],stack:[],process:{}}]};
    const out=await LF.ActionUI.run('design.infer','',{params:{deviceId:'d1'}});
    assert(out.status==='error','failed provider request should stay an Action error');
    assert(exp.designAiStatus.d1.state==='error','failure should be stored only on the selected experiment');
    assert(/provider failed/.test(exp.designAiStatus.d1.message),'retry state should retain a useful reason');
    assert(env.errors.length===1,'normal Action retry UI remains available');
  };

  t['Design Suggest all records independent failures without a batch proposal map']=async function(){
    const calls=[];
    const env=loadUi(function(id,options){calls.push(options.params.deviceId);return Promise.resolve({status:'error',actionId:id,message:'provider failed',failedStep:'infer',code:'NETWORK_ERROR',requestMeta:{}});});
    const exp=LF.State.state.experiment;
    exp.design={solutions:[],devices:[
      {id:'d1',name:'D1',sampleNames:[],solutionIds:[],stack:[],process:{}},
      {id:'d2',name:'D2',sampleNames:[],solutionIds:[],stack:[],process:{}}
    ]};
    delete exp.aiDesignProposals;
    delete exp.designAiStatus;
    const out=await LF.ActionUI.runSequence('design-all',{dataset:{}});
    assert(out&&out.status==='done','provider failures should become retryable Design state, not an unhandled rejection');
    assert(calls.join(',')==='d1,d2','each experiment should receive exactly one request');
    assert(exp.aiDesignProposals&&typeof exp.aiDesignProposals==='object','proposal map should be initialized even when the first request fails');
    assert(exp.designAiStatus.d1&&exp.designAiStatus.d1.state==='error','first experiment should become retryable');
    assert(exp.designAiStatus.d2&&exp.designAiStatus.d2.state==='error','second experiment should become retryable');
    assert(/provider failed/.test(exp.designAiStatus.d1.message),'provider error reason should be retained');
    assert(env.finishes.length===1,'sequence should finish its totem instead of throwing');
  };


  t['Design Suggest all stops the run immediately after the first provider rate limit']=async function(){
    const calls=[];
    const env=loadUi(function(id,cb){
      const deviceId=cb.params.deviceId;calls.push(deviceId);const exp=LF.State.state.experiment;
      if(calls.length===1){
        exp.aiDesignProposals=exp.aiDesignProposals||{};
        exp.aiDesignProposals[deviceId]={targetDeviceId:deviceId,summary:'Saved before throttle',solutions:[{name:'Ink'}],devices:[{stack:[{role:'absorber',material:'perovskite'}]}],unknowns:[]};
        return Promise.resolve({status:'done',actionId:id,result:{stored:true},requestMeta:{}});
      }
      return Promise.resolve({status:'error',actionId:id,message:'API rate limit reached · 1305 · slow down',failedStep:'infer',code:'MODEL_RATE_LIMIT',error:{rateLimited:true,providerCode:'1305'},requestMeta:{}});
    });
    const exp=LF.State.state.experiment;exp.design={solutions:[],devices:Array.from({length:4},function(_,i){return{id:'d'+(i+1),name:'D'+(i+1),sampleNames:[],solutionIds:[],stack:[],process:{}};})};
    delete exp.aiDesignProposals;delete exp.designAiStatus;
    const out=await LF.ActionUI.runSequence('design-all',{dataset:{}});
    assert(out&&out.status==='paused'&&out.reason==='provider_rate_limit','rate limit should pause the bulk sequence');
    assert(calls.join(',')==='d1,d2','no request may be sent after the first throttled experiment');
    assert(out.suggested===1&&out.remaining===3,'completed suggestions must be preserved and untouched experiments remain pending');
    assert(exp.designAiStatus.d2&&exp.designAiStatus.d2.state==='idle','throttled experiment should return to pending/idle state');
    assert(!exp.designAiStatus.d4,'future experiments must never be touched after throttle');
    assert(env.finishes.length===1&&/No further requests were sent/.test(String(env.finishes[0].response||'')),'final totem should explain the circuit breaker');
  };


  t['Design Suggest all cancellation preserves completed suggestions and leaves the rest pending']=async function(){
    const calls=[];
    const env=loadUi(function(id,cb){
      const deviceId=cb.params.deviceId;calls.push(deviceId);const exp=LF.State.state.experiment;
      if(calls.length===1){exp.aiDesignProposals=exp.aiDesignProposals||{};exp.aiDesignProposals[deviceId]={targetDeviceId:deviceId,summary:'Saved',solutions:[],devices:[{stack:[{role:'ETL',material:'SnO2'}]}],unknowns:[]};return Promise.resolve({status:'done',actionId:id,result:{stored:true},requestMeta:{}});}
      return Promise.resolve({status:'aborted',actionId:id,message:'Action stopped by the user.',code:'ACTION_ABORTED',requestMeta:{}});
    });
    const exp=LF.State.state.experiment;exp.design={solutions:[],devices:[
      {id:'d1',name:'D1',sampleNames:[],solutionIds:[],stack:[],process:{}},
      {id:'d2',name:'D2',sampleNames:[],solutionIds:[],stack:[],process:{}}
    ]};
    delete exp.aiDesignProposals;delete exp.designAiStatus;
    const out=await LF.ActionUI.runSequence('design-all',{dataset:{}});
    assert(out&&out.status==='aborted'&&out.suggested===1&&out.remaining===1,'cancellation should report preserved and pending work');
    assert(calls.join(',')==='d1,d2','cancellation must not issue another request');
    assert(exp.aiDesignProposals.d1&&!exp.aiDesignProposals.d2,'completed suggestion remains stored');
    assert(exp.designAiStatus.d2.state==='idle','cancelled experiment returns to pending');
    assert(env.finishes.length===1&&/stopped/i.test(String(env.finishes[0].message||'')),'final totem should report a clean stop');
  };


  return t;
};
