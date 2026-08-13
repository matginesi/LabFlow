'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/ai/operations.js');

function assert(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error((label||'assert')+': expected '+JSON.stringify(expected)+' got '+JSON.stringify(actual));
}

module.exports=function(t,LF){
  function install(steps){
    const exp={id:'exp_test',sync:{revision:0},derived:{operations:{},chat:{conversation:[]}}};
    const def={id:'test.operation',type:'DETERMINISTIC',steps:[
      {id:'one',type:'DETERMINISTIC',fn:'one'},
      {id:'two',type:'DETERMINISTIC',fn:'two'},
      {id:'three',type:'DETERMINISTIC',fn:'three'}
    ]};
    LF.Storage={getEffectiveOperation:function(){return def;}};
    LF.OperationSteps=steps;
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{operations:{},chat:{conversation:[]}};},startOperationRun:function(){},endOperationRun:function(){},touch:function(){exp.sync.revision++;}};
    LF.AI={acceptController:function(){}};
    return exp;
  }

  t['automatic checkpoint retry policy is finite: 5s then 10s'] = function(){
    assert(LF.OperationRunner.autoRetryDelays,[5000,10000],'retry delays');
  };

  t['AI checkpoint auto-retries twice and then continues'] = async function(){
    const exp={id:'exp_ai',sync:{revision:0},derived:{operations:{},chat:{conversation:[]}}};
    const def={id:'test.ai',type:'AI',max_output_tokens:100,steps:[{id:'review',type:'AI',output:'text'}]};
    let calls=0;const retries=[];
    LF.Storage={getEffectiveOperation:function(){return def;},getAiSettings:function(){return{streaming:false,maxTokens:100};}};
    LF.OperationContext={build:function(){return{messageList:[{role:'user',content:'x'}]};}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{operations:{},chat:{conversation:[]}};},startOperationRun:function(){},endOperationRun:function(){},touch:function(){exp.sync.revision++;}};
    LF.AI={acceptController:function(){},buildRequest:function(x){return x;},send:async function(){calls++;if(calls<3){const e=new Error('temporary');e.code='MODEL_OUTPUT_INVALID';throw e;}return{content:'ok'};}};
    const realSetTimeout=global.setTimeout;
    global.setTimeout=function(fn){return realSetTimeout(fn,0);};
    try{
      const out=await LF.OperationRunner.run('test.ai',{onAutoRetry:function(x){retries.push(x.delayMs);}});
      assert(out.status,'done','status');assert(calls,3,'provider calls');assert(retries,[5000,10000],'retry schedule');assert(out.result,'ok','final result');
    }finally{global.setTimeout=realSetTimeout;}
  };

  t['successful checkpoints auto-advance without confirmation'] = async function(){
    const order=[];install({one:function(){order.push('one');return 1;},two:function(){order.push('two');return 2;},three:function(){order.push('three');return 3;}});
    const out=await LF.OperationRunner.run('test.operation');
    assert(out.status,'done','status');assert(order,['one','two','three'],'automatic order');assert(out.steps.map(function(s){return s.status;}),['done','done','done'],'all checkpoints');
  };

  t['retry resumes exactly at the failed checkpoint'] = async function(){
    const calls={one:0,two:0,three:0};let fail=true;
    install({one:function(){calls.one++;},two:function(){calls.two++;if(fail){fail=false;throw new Error('boom');}},three:function(){calls.three++;}});
    const first=await LF.OperationRunner.run('test.operation');
    assert(first.status,'error','first failure');assert(first.failedStep,'two','failed checkpoint');assert(calls,{one:1,two:1,three:0},'first run calls');
    const second=await LF.OperationRunner.retry();
    assert(second.status,'done','retry done');assert(calls,{one:1,two:2,three:1},'only failed checkpoint and following steps rerun');
  };
  t['manual retry of a foreach checkpoint resumes at the failed work unit'] = async function(){
    const exp={id:'exp_batch',sync:{revision:0},derived:{operations:{},chat:{conversation:[]}}};
    const def={id:'test.batch',type:'DETERMINISTIC',steps:[
      {id:'collect',type:'DETERMINISTIC',fn:'collect'},
      {id:'batch',type:'DETERMINISTIC',fn:'batch',foreach:'collect.items'},
      {id:'finish',type:'DETERMINISTIC',fn:'finish'}
    ]};
    const calls=[];let fail=true;
    LF.Storage={getEffectiveOperation:function(){return def;}};
    LF.OperationSteps={collect:function(){return{items:[{id:'a'},{id:'b'},{id:'c'}]};},batch:function(ctx){calls.push(ctx.workItem.id);if(ctx.workItem.id==='b'&&fail){fail=false;throw new Error('batch b failed');}return ctx.workItem.id.toUpperCase();},finish:function(){calls.push('finish');return'done';}};
    LF.State={state:{experiment:exp},ensureDerived:function(e){e.derived=e.derived||{operations:{},chat:{conversation:[]}};},startOperationRun:function(){},endOperationRun:function(){},touch:function(){exp.sync.revision++;}};
    LF.AI={acceptController:function(){}};
    const first=await LF.OperationRunner.run('test.batch');
    assert(first.status,'error','first status');assert(first.failedStep,'batch','failed checkpoint');assert(first.failedWorkIndex,1,'failed unit index');assert(first.work.batch,1,'one unit retained');assert(calls,['a','b'],'first calls');
    const second=await LF.OperationRunner.retry();
    assert(second.status,'done','retry status');assert(calls,['a','b','b','c','finish'],'resume from b only');assert(second.outputs.batch,['A','B','C'],'merged work-unit results');
  };

  return t;
};
