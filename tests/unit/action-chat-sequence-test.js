'use strict';
const fs=require('fs');
const path=require('path');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  const root=path.resolve(__dirname,'../..');
  const uiPath=path.join(root,'assets/js/ai/action-ui.js');
  const assistantSource=fs.readFileSync(path.join(root,'assets/js/ai/assistant.js'),'utf8');

  function loadUi(runImpl){
    delete require.cache[require.resolve(uiPath)];
    let messages=[],errors=[],updates=[],finishes=[];
    LF.Storage={
      getAiSettings:function(){return{endpoint:'http://127.0.0.1:1234/v1',model:'test-model',provider:'lmstudio'};},
      getApiKey:function(){return'';}
    };
    LF.AIProviders={lmstudio:{keyRequired:false}};
    LF.State={state:{experiment:{id:'exp',derived:{chat:{conversation:[]}}},ui:{}},ensureExperiment:function(){return this.state.experiment;},touch:function(){}};
    LF.PageContext={summary:function(){return'Results · Design';}};
    LF.UI={activityStart:function(){},activityUpdate:function(options){updates.push(options);},activityFinish:function(options){finishes.push(options);},activityError:function(error,options){errors.push({error:error,options:options});},message:function(){}};
    LF.Assistant={addActionMessage:function(m){messages.push(m);return m;},render:function(){}};
    LF.ActionRunner={
      effective:function(id){if(id==='results.interpret')return{id:id,title:'Interpret results',short_title:'Interpret results',contract:{result:{format:'text'}},execution:{mode:'ai',steps:[{id:'interpret',type:'AI'}]}};return{id:id,title:id,contract:{result:{format:id==='design.infer'?'json':'text'}},execution:{mode:id==='design.infer'?'hybrid':'deterministic',steps:id==='design.infer'?[{id:'infer',type:'AI'}]:[]}};},
      isRunning:function(){return false;},cancel:function(){return true;},retry:function(cb){return runImpl('results.interpret',cb);},run:function(id,cb){return runImpl(id,cb);}
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
    const d={execution:{steps:[{id:'infer',weight:.8},{id:'store',weight:.2}]}};
    const first=LF.ActionUI.actionProgress(d,0,0,3,.5),second=LF.ActionUI.actionProgress(d,0,1,3,.1),third=LF.ActionUI.actionProgress(d,1,0,1,.1);
    assert(second>first,'next work unit must move global progress forward');
    assert(third>second,'next checkpoint must move global progress forward');
  };

  t['Completed visible text Actions publish their actual result into Assistant chat']=async function(){
    const env=loadUi(function(id,cb){return Promise.resolve({status:'done',actionId:id,aiOutput:'Evidence-backed interpretation.',result:{stored:true},requestMeta:{interpret:{model:'test-model',provider:'lmstudio',usage:{promptTokens:10,completionTokens:5,totalTokens:15}}}});});
    const out=await LF.ActionUI.run('results.interpret','',{params:{}});
    assert(out.status==='done','Action did not finish');
    assert(env.messages.length===1,'Action should publish one chat message');
    assert(env.messages[0].content==='Evidence-backed interpretation.','text Action result not preserved');
    assert(env.messages[0].actionTitle==='Interpret results','Action title not attached');
    assert(env.messages[0].usage&&env.messages[0].usage.totalTokens===15,'Action token metadata not attached');
    assert(assistantSource.includes("role:'system'")&&assistantSource.includes('eventTitle'),'Action source not visible as a compact system event');
  };

  t['Action totem receives live and final output throughput']=async function(){
    const env=loadUi(function(id,cb){cb.onProgress({content:'streaming response',tokens:4,rate:22.5,estimated:true,events:2,meaningfulEvents:2,bytes:64,ttftMs:90,targetTokens:100,maxTokens:120});return Promise.resolve({status:'done',actionId:id,aiOutput:'Done.',result:{stored:true},requestMeta:{interpret:{model:'test-model',provider:'lmstudio',tokensPerSecond:24.25,usage:{promptTokens:10,completionTokens:4,totalTokens:14}}}});});
    const out=await LF.ActionUI.run('results.interpret','',{params:{}});
    assert(out.status==='done','Action did not finish');
    const live=env.updates.find(function(update){return update.stream&&Number(update.stream.rate)>0;});
    assert(live&&live.stream.rate===22.5&&live.stream.estimated===true,'live tok/s telemetry not passed to totem');
    assert(env.finishes[0]&&env.finishes[0].details['Output rate']==='24.3 tok/s','final tok/s missing from totem details');
  };

  t['Design inference publishes a useful proposal summary instead of an empty structured result']=async function(){
    const env=loadUi(function(){return Promise.resolve(null);});
    LF.ActionUI.publishActionResult(
      {id:'design.infer',contract:{result:{format:'json'}}},
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

  t['Design inference stores a suggestion without mutating the LabFlow Data']=async function(){
    const env=loadUi(function(id,cb){
      const proposal={targetDeviceId:cb.params.deviceId,summary:'Suggested chemistry and stack',solutions:[{name:'Model ink'}],devices:[{sample_names:['S1'],solution_names:['Model ink'],stack:[{role:'ETL',material:'SnO2'}]}],unknowns:[]};
      LF.ActionData.setProposal(LF.State.state.experiment,'design.infer','d1',proposal);
      return Promise.resolve({status:'done',actionId:id,aiOutput:proposal,result:{stored:true},requestMeta:{}});
    });
    const exp=LF.State.state.experiment;exp.design={solutions:[],devices:[{id:'d1',name:'D1',sampleNames:['S1'],solutionIds:[],stack:[],process:{}}]};
    const out=await LF.ActionUI.run('design.infer','',{params:{deviceId:'d1'}});
    assert(out.status==='done','Design inference should complete');
    assert(!out.designApplied,'AI suggestion must not be auto-applied');
    assert(exp.design.solutions.length===0&&exp.design.devices[0].stack.length===0,'LabFlow Data must stay unchanged before acceptance');
    assert(LF.ActionData.status(exp,'design.infer','d1').state==='suggested','selected experiment should become Suggested');
    assert(env.finishes[0].message==='Action completed.','totem should report a normal completed suggestion');
  };

  t['Design inference cannot report success unless the target suggestion was actually stored']=async function(){
    const env=loadUi(function(id){return Promise.resolve({status:'done',actionId:id,aiOutput:{summary:'Unstored suggestion'},result:{stored:true},requestMeta:{}});});
    const exp=LF.State.state.experiment;exp.design={solutions:[],devices:[{id:'d1',name:'D1',sampleNames:[],solutionIds:[],stack:[],process:{}}]};
    LF.ActionData.clear(exp,'design.infer');
    const out=await LF.ActionUI.run('design.infer','',{params:{deviceId:'d1'}});
    assert(out.status==='error'&&out.code==='DESIGN_PROPOSAL_NOT_STORED','a done runner result without a stored target proposal must become an Action error');
    assert(LF.ActionData.status(exp,'design.infer','d1').state==='error','missing stored proposal must leave the target experiment retryable');
    assert(env.finishes.length===0&&env.errors.length===1,'totem must not report completion when persistence did not happen');
  };

  t['Design inference failure becomes a retryable per-experiment state']=async function(){
    const env=loadUi(function(){return Promise.resolve({status:'error',actionId:'design.infer',message:'provider failed',failedStep:'infer',code:'NETWORK_ERROR',requestMeta:{}});});
    const exp=LF.State.state.experiment;exp.design={solutions:[],devices:[{id:'d1',name:'D1',sampleNames:[],solutionIds:[],stack:[],process:{}}]};
    const out=await LF.ActionUI.run('design.infer','',{params:{deviceId:'d1'}});
    assert(out.status==='error','failed provider request should stay an Action error');
    assert(LF.ActionData.status(exp,'design.infer','d1').state==='error','failure should be stored only on the selected experiment');
    assert(/provider failed/.test(LF.ActionData.status(exp,'design.infer','d1').message),'retry state should retain a useful reason');
    assert(env.errors.length===1,'Design failure should still be visible in the Action totem');
    assert(!env.errors[0].options.onRetry&&!env.errors[0].options.retryLabel,'Design totem must not duplicate the page-level Retry inference control');
  };

  t['Design complete-all runs the same design.infer Action independently for every experiment']=async function(){
    const calls=[];
    const env=loadUi(function(id,cb){
      calls.push({id:id,deviceId:cb.params.deviceId});
      return Promise.resolve({status:'error',actionId:id,message:'provider failed',failedStep:'infer',code:'NETWORK_ERROR',requestMeta:{}});
    });
    const exp=LF.State.state.experiment;
    exp.design={solutions:[],devices:[
      {id:'d1',name:'D1',sampleNames:[],solutionIds:[],stack:[],process:{}},
      {id:'d2',name:'D2',sampleNames:[],solutionIds:[],stack:[],process:{}}
    ]};
    LF.ActionData.clear(exp,'design.infer');
    const out=await LF.ActionUI.runSequence('design-all',{dataset:{}});
    assert(out&&out.status==='done'&&out.failed===2,'ordinary per-experiment failures become retry items');
    assert(calls.length===2&&calls.every(function(x){return x.id==='design.infer';}),'Complete-all must reuse design.infer, never a batch Action');
    assert(calls[0].deviceId==='d1'&&calls[1].deviceId==='d2','each experiment gets its own Action context');
    assert(LF.ActionData.status(exp,'design.infer','d1').state==='error'&&LF.ActionData.status(exp,'design.infer','d2').state==='error','failures are isolated per experiment');
    assert(env.finishes.length===1,'sequence completes its own totem');
    assert(env.finishes[0].preserveStepStates===true,'sequence totem must preserve per-experiment success/error states');
    assert(env.finishes[0].progressLabel==='2 need retry','mixed/failed completion must not be labelled as universally complete');
  };

  t['Design complete-all retries incomplete experiments previously marked as error']=async function(){
    const calls=[];
    loadUi(function(id,cb){
      calls.push(cb.params.deviceId);
      return Promise.resolve({status:'error',actionId:id,message:'still failed',failedStep:'infer',code:'NETWORK_ERROR',requestMeta:{}});
    });
    const exp=LF.State.state.experiment;exp.design={solutions:[],devices:[
      {id:'d1',name:'D1',sampleNames:[],solutionIds:[],stack:[],process:{}},
      {id:'d2',name:'D2',sampleNames:[],solutionIds:[],stack:[],process:{}}
    ]};
    LF.ActionData.clear(exp,'design.infer');
    LF.ActionData.setStatus(exp,'design.infer','d1',{state:'error',message:'previous failure'});
    const out=await LF.ActionUI.runSequence('design-all',{dataset:{}});
    assert(out&&out.failed===2,'previous errors remain part of the complete-all queue');
    assert(calls.length===2&&calls[0]==='d1'&&calls[1]==='d2','complete-all must retry an errored incomplete experiment instead of forcing manual retry');
  };

  t['Design complete-all preserves earlier successes and stops after first provider rate limit']=async function(){
    const calls=[];
    const env=loadUi(function(id,cb){
      const deviceId=cb.params.deviceId;calls.push(deviceId);const exp=LF.State.state.experiment;
      if(calls.length===1){
        const proposal={targetDeviceId:deviceId,summary:'Saved before throttle',solutions:[{name:'Ink'}],devices:[{stack:[{role:'absorber',material:'perovskite'}]}],unknowns:[]};
        LF.ActionData.setProposal(exp,'design.infer',deviceId,proposal);
        return Promise.resolve({status:'done',actionId:id,aiOutput:proposal,result:{stored:true},requestMeta:{}});
      }
      return Promise.resolve({status:'error',actionId:id,message:'API rate limit reached · slow down',failedStep:'infer',code:'MODEL_RATE_LIMIT',error:{rateLimited:true},requestMeta:{}});
    });
    const exp=LF.State.state.experiment;exp.design={solutions:[],devices:Array.from({length:4},function(_,i){return{id:'d'+(i+1),name:'D'+(i+1),sampleNames:[],solutionIds:[],stack:[],process:{}};})};
    LF.ActionData.clear(exp,'design.infer');
    const out=await LF.ActionUI.runSequence('design-all',{dataset:{}});
    assert(out&&out.status==='paused'&&out.reason==='provider_rate_limit','rate limit pauses the sequence');
    assert(calls.length===2&&calls[0]==='d1'&&calls[1]==='d2','no request is sent after throttle');
    assert(out.suggested===1&&out.remaining===3,'completed suggestion is preserved');
    assert(LF.ActionData.proposal(exp,'design.infer','d1'),'earlier proposal remains stored');
    assert(LF.ActionData.status(exp,'design.infer','d2').state==='idle','throttled experiment returns to pending state');
    assert(!LF.ActionData.status(exp,'design.infer','d3')&&!LF.ActionData.status(exp,'design.infer','d4'),'future experiments remain untouched');
    assert(env.finishes.length===1&&/No further requests were sent/.test(String(env.finishes[0].response||'')),'totem explains stop');
    assert(env.finishes[0].preserveStepStates===true&&env.finishes[0].progress<1&&/pending/.test(env.finishes[0].progressLabel),'paused totem must keep pending experiments visibly pending');
  };

  t['Design complete-all continues after an exhausted malformed output and stores later successes']=async function(){
    const calls=[];
    const env=loadUi(function(id,cb){
      const deviceId=cb.params.deviceId;calls.push(deviceId);const exp=LF.State.state.experiment;
      if(deviceId==='d1')return Promise.resolve({status:'error',actionId:id,message:'Malformed structured model output.',failedStep:'infer',code:'MODEL_OUTPUT_INVALID',requestMeta:{}});
      const proposal={targetDeviceId:deviceId,summary:'Useful qualitative proposal',solutions:[],devices:[{stack:[{role:'absorber',material:'Perovskite'}]}],unknowns:[]};
      LF.ActionData.setProposal(exp,'design.infer',deviceId,proposal);
      return Promise.resolve({status:'done',actionId:id,aiOutput:proposal,result:{stored:true},requestMeta:{}});
    });
    const exp=LF.State.state.experiment;exp.design={solutions:[],devices:[
      {id:'d1',name:'D1',sampleNames:[],solutionIds:[],stack:[],process:{}},
      {id:'d2',name:'D2',sampleNames:[],solutionIds:[],stack:[],process:{}}
    ]};
    LF.ActionData.clear(exp,'design.infer');
    const out=await LF.ActionUI.runSequence('design-all',{dataset:{}});
    assert(out&&out.status==='done'&&out.suggested===1&&out.failed===1,'one failed experiment must not discard another success');
    assert(calls.length===2,'both experiments were attempted independently');
    assert(LF.ActionData.status(exp,'design.infer','d1').state==='error'&&LF.ActionData.status(exp,'design.infer','d2').state==='suggested','per-experiment states are independent');
    assert(LF.ActionData.proposal(exp,'design.infer','d2'),'successful later proposal is stored');
    assert(env.finishes.length===1&&/1 experiment suggested/.test(String(env.finishes[0].response||'')),'summary reports mixed outcome');
  };


  return t;
};
