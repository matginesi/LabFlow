'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/ai/actions.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));
}

module.exports=function(t,LF){
  function install(steps){
    const exp={id:'exp_test',sync:{revision:0},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'test.action',type:'DETERMINISTIC',steps:[
      {id:'one',type:'DETERMINISTIC',fn:'one'},
      {id:'two',type:'DETERMINISTIC',fn:'two'},
      {id:'three',type:'DETERMINISTIC',fn:'three'}
    ]};
    LF.Storage={getEffectiveAction:function(){return def;}};
    LF.ActionSteps=steps;
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){exp.sync.revision++;}};
    LF.AI={acceptController:function(){}};
    return exp;
  }

  t['automatic checkpoint retry policy is finite: 5s then 10s'] = function(){
    assert(LF.ActionRunner.autoRetryDelays,[5000,10000],'retry delays');
  };

  t['adaptive token profile uses work size but stays inside Action min target and max']=function(){
    const p=LF.ActionRunner.tokenProfile({min_output_tokens:1800,target_output_tokens:6500,max_output_tokens:12288},{target_words:1100});
    assert(p.minTokens,1800,'minimum');assert(p.targetTokens,2035,'word-sized target');assert(p.maxTokens,12288,'maximum');
    if(!(p.requestTokens>p.targetTokens&&p.requestTokens<=p.maxTokens))throw new Error('request margin must be above target and below Action maximum');
    const small=LF.ActionRunner.tokenProfile({min_output_tokens:1800,target_output_tokens:6500,max_output_tokens:12288},{target_words:280});
    assert(small.targetTokens,1800,'short work does not fall below minimum useful budget');
    const structured=LF.ActionRunner.tokenProfile({output:'json',min_output_tokens:1200,target_output_tokens:2800,max_output_tokens:6144},null);
    assert(structured.targetTokens,2800,'structured target remains useful telemetry');
    assert(structured.requestTokens,6144,'structured response reserves enough room to close the JSON');
  };

  t['declared Action budget is the request target while provider maximum is only a ceiling'] = async function(){
    const exp={id:'exp_budget',sync:{revision:0},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'test.budget',type:'AI',steps:[{id:'brief',type:'AI',output:'text',max_output_tokens:3072,deadline_ms:90000,max_retries:0}]};
    let built=null;
    LF.Storage={getEffectiveAction:function(){return def;},getAiSettings:function(){return{streaming:false,maxOutputTokensCap:0};}};
    LF.ActionContext={build:function(){return{messageList:[{role:'user',content:'compact brief'}]};}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){}};
    LF.AI={acceptController:function(){},estimateTokens:function(){return 20;},resolveModelCapabilities:async function(){return{maxOutputTokens:131072};},resolveOutputBudget:function(cap,actionCap,globalCap){return Math.min(cap.maxOutputTokens,actionCap,globalCap||Infinity);},buildRequest:function(opts){built=opts;return opts;},send:async function(){return{content:'done',finishReason:'stop'};}};
    const out=await LF.ActionRunner.run('test.budget');
    assert(out.status,'done','status');
    assert(built.maxTokens,3072,'Action target wins over provider ceiling');
    assert(built.hardTimeoutMs,90000,'absolute deadline forwarded');
  };

  t['Action thinking policy is reconciled with model capability and recorded'] = async function(){
    const exp={id:'exp_thinking',sync:{revision:0},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'test.thinking',type:'AI',steps:[{id:'draft',type:'AI',output:'text',thinking:'off',max_output_tokens:512,max_retries:0}]};
    let built=null;
    LF.Storage={getEffectiveAction:function(){return def;},getAiSettings:function(){return{provider:'openai',model:'gpt-5.2',thinkingMode:'auto',streaming:false,maxOutputTokensCap:0};}};
    LF.ActionContext={build:function(){return{messageList:[{role:'user',content:'Write directly.'}]};}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){}};
    LF.AI={acceptController:function(){},estimateTokens:function(){return 12;},resolveModelCapabilities:async function(){return{maxOutputTokens:4096,reasoningStatus:'optional'};},resolveOutputBudget:function(cap,actionCap){return Math.min(cap.maxOutputTokens,actionCap);},resolveThinkingPolicy:function(cap,action,global){assert(action,'off','Action policy input');assert(global,'auto','global follows Action');return{requested:'off',transportMode:'off',capability:cap.reasoningStatus,effective:'off',reason:'Action policy'};},buildRequest:function(opts){built=opts;return Object.assign({body:{messages:opts.messages}},opts);},send:async function(spec){return{content:'done',finishReason:'stop',thinkingMode:spec.thinkingMode,thinkingPolicy:spec.thinkingPolicy};}};
    const out=await LF.ActionRunner.run('test.thinking');
    assert(out.status,'done','status');assert(built.thinkingMode,'off','transport mode');assert(built.thinkingPolicy.capability,'optional','capability retained');
    const stored=exp.derived.actions['test.thinking'].runs[0].requestMeta.draft;assert(stored.thinkingRequested,'off','requested policy recorded');assert(stored.thinkingEffective,'off','effective policy recorded');
  };

  t['word-sized drafting work is reduced before prompting when the provider output ceiling is smaller'] = async function(){
    const exp={id:'exp_draft_budget',sync:{revision:0},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'test.draft-budget',type:'HYBRID',steps:[{id:'collect',type:'DETERMINISTIC',fn:'draft.collect'},{id:'draft',type:'AI',output:'text',foreach:'collect.blocks',min_output_tokens:1800,target_output_tokens:6500,max_output_tokens:12288,max_retries:0}]};
    let contextWorkItem=null,built=null;
    LF.Storage={getEffectiveAction:function(){return def;},getAiSettings:function(){return{streaming:false,maxOutputTokensCap:2048};}};
    LF.ActionContext={build:function(action,step,opts){contextWorkItem=opts.workItem;return{messageList:[{role:'user',content:JSON.stringify(opts.workItem)}]};}};
    LF.ActionSteps={'draft.collect':function(){return{blocks:[{id:'discussion',label:'Discussion',target_words:1800,min_words:1200,max_words:2300}]};}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){}};
    LF.AI={acceptController:function(){},estimateTokens:function(){return 50;},resolveModelCapabilities:async function(){return{maxOutputTokens:4096};},resolveOutputBudget:function(cap,actionCap,globalCap){return Math.min(cap.maxOutputTokens,actionCap,globalCap||Infinity);},buildRequest:function(opts){built=opts;return opts;},send:async function(){return{content:'# Discussion\n\nCompleted within the available budget.',finishReason:'stop'};}};
    const out=await LF.ActionRunner.run('test.draft-budget',{params:{},selection:null});
    assert(out.status,'done','status');
    if(!contextWorkItem||!contextWorkItem.output_budget_adjusted)throw new Error('prompt work item must record the output-budget adjustment');
    assert(contextWorkItem.requested_target_words,1800,'original target retained for provenance');
    if(!(contextWorkItem.min_words<contextWorkItem.target_words&&contextWorkItem.max_words>=contextWorkItem.target_words&&contextWorkItem.target_words<1800))throw new Error('adapted word range must be coherent and smaller');
    assert(built.maxTokens,2048,'provider/user ceiling still controls the request');
  };

  t['a truncated drafting block uses its one bounded retry for a complete shorter rewrite'] = async function(){
    const exp={id:'exp_draft_retry',sync:{revision:0},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'test.draft-retry',type:'HYBRID',steps:[{id:'collect',type:'DETERMINISTIC',fn:'draft.collect'},{id:'draft',type:'AI',output:'text',foreach:'collect.blocks',min_output_tokens:1800,target_output_tokens:6500,max_output_tokens:12288,max_retries:1}]};
    const targets=[];let calls=0;
    LF.Storage={getEffectiveAction:function(){return def;},getAiSettings:function(){return{streaming:false,maxOutputTokensCap:0};}};
    LF.ActionContext={build:function(action,step,opts){targets.push(opts.workItem.target_words);return{messageList:[{role:'user',content:JSON.stringify(opts.workItem)}]};}};
    LF.ActionSteps={'draft.collect':function(){return{blocks:[{id:'discussion',label:'Discussion',target_words:1800,min_words:1200,max_words:2300}]};}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){}};
    LF.AI={acceptController:function(){},estimateTokens:function(){return 50;},resolveModelCapabilities:async function(){return{maxOutputTokens:131072};},resolveOutputBudget:function(cap,actionCap){return Math.min(cap.maxOutputTokens,actionCap);},buildRequest:function(opts){return opts;},send:async function(){calls++;return calls===1?{content:Array(901).join('partial '),finishReason:'length'}:{content:'# Discussion\n\nComplete shorter rewrite.',finishReason:'stop'};}};
    const realSetTimeout=global.setTimeout;global.setTimeout=function(fn){return realSetTimeout(fn,0);};
    try{
      const out=await LF.ActionRunner.run('test.draft-retry');
      assert(out.status,'done','status');assert(calls,2,'one bounded retry');
      if(!(targets.length===2&&targets[1]<targets[0]))throw new Error('retry must advertise a smaller coherent work item');
      assert(out.aiOutput,['# Discussion\n\nComplete shorter rewrite.'],'only the complete rewrite is stored');
    }finally{global.setTimeout=realSetTimeout;}
  };

  t['Action context is compacted before LM Studio request to fit the loaded runtime context'] = async function(){
    const exp={id:'exp_context_fit',sync:{revision:0},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'analysis.enrich',type:'AI',steps:[{id:'enrich',type:'AI',output:'text',max_output_tokens:3072,deadline_ms:90000,max_retries:0}]};
    const builds=[];let sent=null;
    LF.Storage={getEffectiveAction:function(){return def;},getAiSettings:function(){return{provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'local-model',streaming:false,maxOutputTokensCap:0};}};
    LF.ActionContext={build:function(action,step,opts){
      const limit=Number(opts&&opts.maxChars)||50000;builds.push(limit);
      const content='X'.repeat(Math.max(1200,Math.min(50000,limit)));
      return{context:{payload:content},messageList:[{role:'user',content:content}]};
    }};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){}};
    LF.AI={acceptController:function(){},estimatePromptTokens:function(messages){return Math.ceil(String(messages[0].content||'').length/1.5);},resolveModelCapabilities:async function(){return{contextWindow:32768,maxOutputTokens:8192,source:'LM Studio loaded instance context'};},resolveOutputBudget:function(cap,actionCap,globalCap,inputTokens){return Math.min(actionCap,cap.maxOutputTokens,Math.max(16,cap.contextWindow-inputTokens-512));},buildRequest:function(opts){sent=opts;return opts;},send:async function(){return{content:'compact done',finishReason:'stop'};}};
    const out=await LF.ActionRunner.run('analysis.enrich');
    assert(out.status,'done','status');
    if(!(builds.length>=2&&builds.some(function(v){return v<50000;})))throw new Error('context builder must be invoked again with a smaller maxChars budget');
    if(!sent||!sent.messages||Math.ceil(sent.messages[0].content.length/1.5)>28000)throw new Error('final request must fit comfortably inside the 32k runtime context');
  };

  t['AI checkpoint with max_retries zero falls back after the first failed attempt'] = async function(){
    const exp={id:'exp_no_retry',sync:{revision:0},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'test.no-retry',type:'AI',steps:[{id:'brief',type:'AI',output:'text',max_output_tokens:3072,max_retries:0}]};
    let calls=0,retries=0;
    LF.Storage={getEffectiveAction:function(){return def;},getAiSettings:function(){return{streaming:false,maxOutputTokensCap:0};}};
    LF.ActionContext={build:function(){return{messageList:[{role:'user',content:'x'}]};}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){}};
    LF.AI={acceptController:function(){},buildRequest:function(x){return x;},send:async function(){calls++;throw new Error('provider failed');}};
    const out=await LF.ActionRunner.run('test.no-retry',{onAutoRetry:function(){retries++;}});
    assert(out.status,'error','status');assert(calls,1,'one provider attempt');assert(retries,0,'no automatic retry');
  };


  t['provider rate limits are not retried again by the Action semantic retry layer'] = async function(){
    const exp={id:'exp_rate',sync:{revision:0},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'test.rate',type:'AI',steps:[{id:'chat',type:'AI',output:'text',max_retries:2}]};
    let calls=0,retries=0;
    LF.Storage={getEffectiveAction:function(){return def;},getAiSettings:function(){return{streaming:false,maxOutputTokensCap:0};}};
    LF.ActionContext={build:function(){return{messageList:[{role:'user',content:'x'}]};}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){}};
    LF.AI={acceptController:function(){},buildRequest:function(x){return x;},send:async function(){calls++;const e=new Error('rate');e.status=429;e.providerCode='1305';throw e;}};
    const out=await LF.ActionRunner.run('test.rate',{onAutoRetry:function(){retries++;}});
    assert(out.status,'error','status');assert(out.code,'MODEL_RATE_LIMIT','classification');assert(calls,1,'transport exhaustion is not semantically retried');assert(retries,0,'no Action retry');
  };

  t['AI checkpoint auto-retries twice and then continues'] = async function(){
    const exp={id:'exp_ai',sync:{revision:0},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'test.ai',type:'AI',max_output_tokens:100,steps:[{id:'review',type:'AI',output:'text'}]};
    let calls=0;const retries=[];
    LF.Storage={getEffectiveAction:function(){return def;},getAiSettings:function(){return{streaming:false,maxTokens:100};}};
    LF.ActionContext={build:function(){return{messageList:[{role:'user',content:'x'}]};}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){exp.sync.revision++;}};
    LF.AI={acceptController:function(){},buildRequest:function(x){return x;},send:async function(){calls++;if(calls<3){const e=new Error('temporary');e.code='MODEL_OUTPUT_INVALID';throw e;}return{content:'ok'};}};
    const realSetTimeout=global.setTimeout;
    global.setTimeout=function(fn){return realSetTimeout(fn,0);};
    try{
      const out=await LF.ActionRunner.run('test.ai',{onAutoRetry:function(x){retries.push(x.delayMs);}});
      assert(out.status,'done','status');assert(calls,3,'provider calls');assert(retries,[5000,10000],'retry schedule');assert(out.result,'ok','final result');
    }finally{global.setTimeout=realSetTimeout;}
  };


  t['AI Action exposes the exact provider request with secrets redacted'] = async function(){
    const exp={id:'exp_trace',sync:{revision:0},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'test.trace',type:'HYBRID',max_output_tokens:512,steps:[{id:'enrich',type:'AI',output:'text'},{id:'store',type:'DETERMINISTIC',fn:'trace.store',capture_result:true}]};
    let observed=null;
    LF.Storage={getEffectiveAction:function(){return def;},getAiSettings:function(){return{streaming:false,maxTokens:512};}};
    LF.ActionContext={build:function(){return{messageList:[{role:'user',content:'bounded context'}]};}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){exp.sync.revision++;}};
    LF.ActionSteps={'trace.store':function(){return{stored:true};}};
    LF.AI={acceptController:function(){},buildRequest:function(){return{url:'http://127.0.0.1:1234/v1/chat/completions',headers:{Authorization:'Bearer secret',Accept:'application/json'},body:{model:'local',messages:[{role:'user',content:'bounded context'}]}};},send:async function(){return{content:'model detail',finishReason:'stop'};}};
    const out=await LF.ActionRunner.run('test.trace',{onRequest:function(info){observed=info;}});
    assert(out.status,'done','trace status');
    assert(observed.actionId,'test.trace','trace action');
    assert(observed.stepId,'enrich','trace checkpoint');
    assert(observed.request.endpoint,'http://127.0.0.1:1234/v1/chat/completions','trace endpoint');
    assert(observed.request.headers.Authorization,'Configured · redacted','authorization redacted');
    assert(observed.request.body.model,'local','body preserved');
    assert(out.aiOutput,'model detail','AI output retained separately');
    assert(out.result,{stored:true},'final technical result retained');
  };

  t['successful checkpoints auto-advance without confirmation'] = async function(){
    const order=[];install({one:function(){order.push('one');return 1;},two:function(){order.push('two');return 2;},three:function(){order.push('three');return 3;}});
    const out=await LF.ActionRunner.run('test.action');
    assert(out.status,'done','status');assert(order,['one','two','three'],'automatic order');assert(out.steps.map(function(s){return s.status;}),['done','done','done'],'all checkpoints');
  };

  t['retry resumes exactly at the failed checkpoint'] = async function(){
    const calls={one:0,two:0,three:0};let fail=true;
    install({one:function(){calls.one++;},two:function(){calls.two++;if(fail){fail=false;throw new Error('boom');}},three:function(){calls.three++;}});
    const first=await LF.ActionRunner.run('test.action');
    assert(first.status,'error','first failure');assert(first.failedStep,'two','failed checkpoint');assert(calls,{one:1,two:1,three:0},'first run calls');
    const second=await LF.ActionRunner.retry();
    assert(second.status,'done','retry done');assert(calls,{one:1,two:2,three:1},'only failed checkpoint and following steps rerun');
  };
  t['manual retry of a foreach checkpoint resumes at the failed work unit'] = async function(){
    const exp={id:'exp_batch',sync:{revision:0},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'test.batch',type:'DETERMINISTIC',steps:[
      {id:'collect',type:'DETERMINISTIC',fn:'collect'},
      {id:'batch',type:'DETERMINISTIC',fn:'batch',foreach:'collect.items'},
      {id:'finish',type:'DETERMINISTIC',fn:'finish'}
    ]};
    const calls=[];let fail=true;
    LF.Storage={getEffectiveAction:function(){return def;}};
    LF.ActionSteps={collect:function(){return{items:[{id:'a'},{id:'b'},{id:'c'}]};},batch:function(ctx){calls.push(ctx.workItem.id);if(ctx.workItem.id==='b'&&fail){fail=false;throw new Error('batch b failed');}return ctx.workItem.id.toUpperCase();},finish:function(){calls.push('finish');return'done';}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){exp.sync.revision++;}};
    LF.AI={acceptController:function(){}};
    const first=await LF.ActionRunner.run('test.batch');
    assert(first.status,'error','first status');assert(first.failedStep,'batch','failed checkpoint');assert(first.failedWorkIndex,1,'failed unit index');assert(first.work.batch,1,'one unit retained');assert(calls,['a','b'],'first calls');
    const second=await LF.ActionRunner.retry();
    assert(second.status,'done','retry status');assert(calls,['a','b','b','c','finish'],'resume from b only');assert(second.outputs.batch,['A','B','C'],'merged work-unit results');
  };



  t['runner does not double-touch an Action that committed its own revision'] = async function(){
    const exp={id:'exp_commit',sync:{revision:4},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'test.commit',type:'DETERMINISTIC',mutation_scope:'dataset',steps:[{id:'commit',type:'DETERMINISTIC',fn:'commit'}]};
    let touches=0;
    LF.Storage={getEffectiveAction:function(){return def;}};
    LF.ActionSteps={commit:function(){LF.State.touch('dataset');return{revision:exp.sync.revision};}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){touches++;exp.sync.revision++;}};
    LF.AI={acceptController:function(){}};
    const out=await LF.ActionRunner.run('test.commit');
    assert(out.status,'done','status');
    assert(touches,1,'one commit only');
    assert(exp.sync.revision,5,'one revision advance');
  };

  t['requires is an actual current-revision prerequisite gate'] = async function(){
    const exp={id:'exp_gate',sync:{revision:3},derived:{actions:{},chat:{conversation:[]}}};
    const def={id:'test.consumer',type:'DETERMINISTIC',requires:['test.producer'],steps:[{id:'consume',type:'DETERMINISTIC',fn:'consume'}]};
    let calls=0;
    LF.Storage={getEffectiveAction:function(){return def;}};
    LF.ActionSteps={consume:function(){calls++;return'ok';}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{actions:{},chat:{conversation:[]}};},startActionRun:function(){},endActionRun:function(){},touch:function(){}};
    LF.AI={acceptController:function(){}};
    const blocked=await LF.ActionRunner.run('test.consumer');
    assert(blocked.status,'error','blocked status');
    assert(blocked.code,'ACTION_PREREQUISITE_REQUIRED','blocked code');
    assert(blocked.requires,['test.producer'],'required action');
    assert(calls,0,'consumer did not run');
    exp.derived.actions['test.producer']={runs:[{status:'done',sourceRevision:2}]};
    const stale=await LF.ActionRunner.run('test.consumer');
    assert(stale.code,'ACTION_PREREQUISITE_REQUIRED','stale prerequisite blocked');
    exp.derived.actions['test.producer'].runs.push({status:'done',sourceRevision:3});
    const out=await LF.ActionRunner.run('test.consumer');
    assert(out.status,'done','fresh prerequisite accepted');
    assert(calls,1,'consumer ran once');
  };

  return t;
};
