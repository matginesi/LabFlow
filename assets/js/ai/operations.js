(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  const Log=LF.Logger?LF.Logger.scope('operations'):null;
  const AUTO_RETRY_DELAYS=[5000,10000];
  let controller=null,running=false,failedRun=null;

  function expOf(){return LF.State&&LF.State.state&&LF.State.state.experiment||null;}
  function effective(id){return LF.Storage&&LF.Storage.getEffectiveOperation?LF.Storage.getEffectiveOperation(id):(LF.OperationRegistry&&LF.OperationRegistry.operation?LF.OperationRegistry.operation(id):null);}
  function cancel(){if(!controller||controller.signal.aborted)return false;controller.abort();return true;}
  function cancelError(){const e=new Error('Operation stopped by the user.');e.cancelled=true;e.code='OPERATION_ABORTED';return e;}
  function operationError(code,message){const e=new Error(message);e.code=code;return e;}
  function classify(err){if(err&&err.cancelled)return err.code||'OPERATION_ABORTED';if(err&&err.isContract)return err.code||'MODEL_OUTPUT_INVALID';if(err&&String(err.providerCode||'')==='1261')return'MODEL_CONTEXT_LENGTH';if(err&&err.status===429)return'MODEL_RATE_LIMIT';if(err&&err.timedOut)return'MODEL_TIMEOUT';if(err&&err.isNetwork)return'NETWORK_ERROR';return err&&err.code||'OPERATION_FAILED';}
  function parseJson(step,content){
    const parsed=LF.StructuredOutput.parse(content);
    if(!parsed.value){const e=LF.StructuredOutput.contractError(step.schema,null,{text:content,parseResult:parsed});e.modelOutput=content;throw e;}
    const normalized=step.schema&&LF.StructuredOutput.normalizeForSchema?LF.StructuredOutput.normalizeForSchema(step.schema,parsed.value):parsed.value;
    if(step.schema){const errors=LF.StructuredOutput.validate(step.schema,normalized,{registry:LF.OperationRegistry});if(errors.length){const e=LF.StructuredOutput.contractError(step.schema,normalized,{providerResponse:errors.join('\n')+'\n\n'+content});e.validationErrors=errors;e.modelOutput=content;throw e;}}
    return{value:normalized,note:parsed.strategy||'JSON'};
  }
  function requestMeta(result){return{model:result.model,provider:result.provider,requestId:result.requestId,requestLogId:result.requestLogId,latencyMs:result.latencyMs,usage:result.usage,finishReason:result.finishReason,content:result.content,reasoning:result.reasoning};}
  function getPath(root,path){return String(path||'').split('.').filter(Boolean).reduce(function(v,key){return v==null?undefined:v[key];},root);}
  function retryable(step,err){return step&&step.type==='AI'&&!(err&&err.cancelled);}
  function feedbackFor(err){const details=err&&err.validationErrors&&err.validationErrors.join('\n')||err&&err.providerResponse||err&&err.message||'';return('Previous attempt failed with '+classify(err)+'.\n'+String(details).slice(0,6000)).trim();}
  function delay(ms){return new Promise(function(resolve,reject){if(!controller||controller.signal.aborted){reject(cancelError());return;}const timer=window.setTimeout(done,ms);function cleanup(){window.clearTimeout(timer);controller&&controller.signal.removeEventListener('abort',aborted);}function done(){cleanup();resolve();}function aborted(){cleanup();reject(cancelError());}controller.signal.addEventListener('abort',aborted,{once:true});});}
  function scopeFor(def){return def&&typeof def.mutation_scope==='string'?def.mutation_scope:'';}
  function finishMutation(def){const scope=scopeFor(def);if(scope&&LF.State&&LF.State.touch)LF.State.touch(scope);if(scope==='design'){const e=expOf();if(e&&LF.OperationSteps&&LF.OperationSteps['design.build-analysis'])e.designAnalysis=LF.OperationSteps['design.build-analysis']({exp:e,outputs:{},lastResult:null,params:{}});}}
  function recordHistory(run,status,code){const e=expOf();if(!e)return;LF.State.ensureDerived(e);const entry=e.derived.operations[run.operationId]||{runs:[]};entry.lastStatus=status;entry.lastRunAt=new Date().toISOString();entry.runs.push({runId:run.runId,status:status,code:code||'',sourceRevision:run.sourceRevision,startedAt:run.startedAt,endedAt:new Date().toISOString(),steps:run.steps.slice(),attempts:run.attempts.slice(),work:run.work,result:run.result});if(entry.runs.length>12)entry.runs=entry.runs.slice(-12);e.derived.operations[run.operationId]=entry;}

  async function runOne(run,step,opts,workItem,workIndex,workTotal){
    const e=expOf();
    if(step.type==='DETERMINISTIC'){
      const fn=LF.OperationSteps&&LF.OperationSteps[step.fn];if(!fn)throw operationError('OPERATION_STEP_INVALID','Deterministic step is not registered: '+step.fn);
      return Promise.resolve(fn({operationId:run.operationId,exp:e,step:step,outputs:run.outputs,lastResult:run.result,params:run.params,selection:run.selection,sourceRevision:run.sourceRevision,requestMeta:run.requestMeta,workItem:workItem,workIndex:workIndex,workTotal:workTotal,progress:function(done,total,label){if(opts.onWork)opts.onWork({step:step.id,index:run.currentIndex,totalSteps:run.def.steps.length,workIndex:Number(done)||0,workTotal:Number(total)||0,label:label||''});}}));
    }
    if(step.type!=='AI')throw operationError('OPERATION_STEP_INVALID','Unsupported operation step type: '+step.type);
    const key=step.id+(workTotal>1?':'+workIndex:'');
    const context=LF.OperationContext.build(run.def,step,{outputs:run.outputs,userText:run.userText,params:run.params,selection:run.selection,retryFeedback:run.retryFeedback[key]||'',workItem:workItem,workIndex:workIndex,workTotal:workTotal});
    const jsonMode=step.output==='json',settings=LF.Storage.getAiSettings();
    const schema=jsonMode&&step.schema&&LF.OperationRegistry&&LF.OperationRegistry.schema?LF.OperationRegistry.schema(step.schema):null;
    const assistantBudget=run.operationId==='assistant.chat'&&LF.Storage.getAssistantSettings?LF.Storage.getAssistantSettings().maxOutputTokens:null;
    const outputBudget=Math.max(256,Number(assistantBudget||step.max_output_tokens||run.def.max_output_tokens||8192));
    const spec=LF.AI.buildRequest({messages:context.messageList,stream:settings.streaming!==false,maxTokens:outputBudget,timeoutMs:step.timeout_ms||null,hardTimeoutMs:step.deadline_ms||null,jsonMode:jsonMode,jsonSchema:schema,jsonSchemaName:step.schema||run.operationId,temperature:jsonMode?0.2:undefined});
    const response=await LF.AI.send(spec,{label:run.operationId+'.'+step.id+(workTotal>1?'.'+(workIndex+1):''),onProgress:function(p){if(opts.onProgress)opts.onProgress(Object.assign({},p,{stepId:step.id,workIndex:workIndex,workTotal:workTotal,workItem:workItem}));}});
    run.requestMeta[key]=requestMeta(response);
    if(response.finishReason==='length'){const e=operationError('MODEL_OUTPUT_TRUNCATED','The model reached its output limit before finishing this work unit.');e.providerResponse=response.content;throw e;}
    delete run.retryFeedback[key];
    if(jsonMode){const parsed=parseJson(step,response.content);run.parseNote=parsed.note;return parsed.value;}
    return String(response.content||'');
  }

  async function runUnitWithRetry(run,step,opts,workItem,workIndex,workTotal){
    const key=step.id+(workTotal>1?':'+workIndex:'');let retryNo=0;
    while(true){
      if(controller&&controller.signal.aborted)throw cancelError();
      try{return await runOne(run,step,opts,workItem,workIndex,workTotal);}
      catch(err){
        const code=classify(err),retryDelays=AUTO_RETRY_DELAYS,canRetry=retryNo<retryDelays.length&&retryable(step,err);
        run.attempts.push({step:step.id,index:run.currentIndex,workIndex:workIndex,attempt:retryNo+1,status:canRetry?'retry':'error',code:code,message:String(err&&err.message||err)});
        if(!canRetry)throw err;
        const wait=retryDelays[retryNo];run.retryFeedback[key]=feedbackFor(err);retryNo++;
        if(Log)Log.warn('checkpoint.auto-retry',{runId:run.runId,operationId:run.operationId,step:step.id,workIndex:workIndex,workTotal:workTotal,attempt:retryNo,delayMs:wait,code:code});
        if(opts.onAutoRetry)opts.onAutoRetry({operationId:run.operationId,step:step.id,index:run.currentIndex,total:run.def.steps.length,workIndex:workIndex,workTotal:workTotal,attempt:retryNo,maxAttempts:retryDelays.length,delayMs:wait,code:code,message:String(err&&err.message||err)});
        await delay(wait);
      }
    }
  }

  function stepItem(step,status,index,total,note){return{id:step.id,type:step.type,status:status,index:index,total:total,note:note||''};}
  function setStep(run,item,opts){run.steps=run.steps.filter(function(x){return x.index!==item.index;});run.steps.push(item);run.steps.sort(function(a,b){return a.index-b.index;});if(opts.onStep)opts.onStep(item);}

  async function execute(run,startIndex,opts){
    for(let i=startIndex;i<run.def.steps.length;i++){
      const step=run.def.steps[i];run.currentIndex=i;run.failedIndex=null;run.failedWorkIndex=null;
      const items=step.foreach?getPath(run.outputs,step.foreach):null;
      const units=step.foreach?(Array.isArray(items)?items:[]):[null];
      if(step.foreach&&!Array.isArray(items))throw operationError('OPERATION_WORK_INVALID','Work-unit source is not an array: '+step.foreach);
      if(step.foreach&&!units.length){run.outputs[step.id]=[];setStep(run,stepItem(step,'done',i,run.def.steps.length,'0 work units'),opts);continue;}
      const startUnit=step.foreach?Number(run.work[step.id]||0):0,results=step.foreach?(Array.isArray(run.outputs[step.id])?run.outputs[step.id]:[]):null;
      setStep(run,stepItem(step,'active',i,run.def.steps.length,step.foreach?('Work units '+startUnit+'/'+units.length):step.type),opts);
      const started=performance.now();
      try{
        for(let u=startUnit;u<units.length;u++){
          if(opts.onWork)opts.onWork({step:step.id,index:i,totalSteps:run.def.steps.length,workIndex:u,workTotal:units.length,label:units[u]&&units[u].label||units[u]&&units[u].id||''});
          const value=await runUnitWithRetry(run,step,opts,units[u],u,units.length);
          if(step.foreach){results[u]=value;run.outputs[step.id]=results;run.work[step.id]=u+1;run.result=results;}
          else{run.outputs[step.id]=value;if(value!==undefined&&(step.type==='AI'||run.def.type==='DETERMINISTIC'||step.capture_result))run.result=value;}
        }
        setStep(run,stepItem(step,'done',i,run.def.steps.length,step.foreach?(units.length+' work units · '+Math.round(performance.now()-started)+' ms'):(step.type==='AI'?(run.parseNote||''):(Math.round(performance.now()-started)+' ms'))),opts);
      }catch(err){
        run.failedIndex=i;run.failedWorkIndex=step.foreach?Number(run.work[step.id]||0):null;
        setStep(run,stepItem(step,'error',i,run.def.steps.length,String(err&&err.message||err)),opts);throw err;
      }
    }
    return run;
  }

  function outcome(run,status,extra){return Object.assign({runId:run.runId,operationId:run.operationId,status:status,steps:run.steps,attempts:run.attempts,result:run.result,outputs:run.outputs,requestMeta:run.requestMeta,sourceRevision:run.sourceRevision,failedStep:run.failedIndex!=null&&run.def.steps[run.failedIndex]?run.def.steps[run.failedIndex].id:null,failedWorkIndex:run.failedWorkIndex,work:run.work},extra||{});}
  async function startRun(run,startIndex,opts){
    running=true;controller=new AbortController();if(LF.AI&&LF.AI.acceptController)LF.AI.acceptController(controller);if(LF.State&&LF.State.startOperationRun)LF.State.startOperationRun({operationId:run.operationId,stepIndex:startIndex,runId:run.runId});
    try{await execute(run,startIndex,opts);running=false;failedRun=null;if(LF.AI&&LF.AI.acceptController)LF.AI.acceptController(null);if(LF.State&&LF.State.endOperationRun)LF.State.endOperationRun('done');finishMutation(run.def);recordHistory(run,'done');return outcome(run,'done');}
    catch(err){running=false;if(LF.AI&&LF.AI.acceptController)LF.AI.acceptController(null);const code=classify(err),status=err&&err.cancelled?'aborted':'error';if(LF.State&&LF.State.endOperationRun)LF.State.endOperationRun(status);failedRun=status==='error'?run:null;recordHistory(run,status,code);if(Log)Log.warn('operation.failed',{runId:run.runId,operationId:run.operationId,step:run.failedIndex!=null&&run.def.steps[run.failedIndex]?run.def.steps[run.failedIndex].id:null,stepIndex:run.failedIndex,workIndex:run.failedWorkIndex,code:code,error:err});return outcome(run,status,{code:code,message:String(err&&err.message||'Operation failed.'),error:err});}
  }
  function newRun(operationId,def,opts){const exp=expOf();return{runId:(LF.Core&&LF.Core.uid?LF.Core.uid('operation'):'operation_'+Date.now()),operationId:operationId,def:def,sourceRevision:exp&&exp.sync&&exp.sync.revision||0,startedAt:new Date().toISOString(),params:opts.params||{},selection:opts.selection||null,userText:opts.userText||'',outputs:{},requestMeta:{},retryFeedback:{},steps:[],attempts:[],work:{},result:null,currentIndex:0,failedIndex:null,failedWorkIndex:null};}
  function run(operationId,opts){opts=opts||{};const def=effective(operationId);if(!def)return Promise.resolve({operationId:operationId,status:'error',code:'OPERATION_UNKNOWN',message:'Unknown operation: '+operationId,steps:[]});if(running)return Promise.resolve({operationId:operationId,status:'error',code:'OPERATION_BUSY',message:'Another operation is already running.',steps:[]});const exp=expOf();if(!exp||!exp.id)return Promise.resolve({operationId:operationId,status:'error',code:'OPERATION_UPLOAD_REQUIRED',message:'Upload a ZIP before running this operation.',steps:[]});return startRun(newRun(operationId,def,opts),0,opts);}
  function retry(opts){opts=opts||{};if(running)return Promise.resolve({status:'error',code:'OPERATION_BUSY',message:'Another operation is already running.',steps:[]});if(!failedRun)return Promise.resolve({status:'error',code:'OPERATION_NO_FAILED_RUN',message:'There is no failed checkpoint to retry.',steps:[]});return startRun(failedRun,failedRun.failedIndex==null?0:failedRun.failedIndex,opts);}
  function failed(){return failedRun;}
  LF.OperationRunner={run:run,retry:retry,cancel:cancel,isRunning:function(){return running;},failed:failed,effective:effective,autoRetryDelays:AUTO_RETRY_DELAYS.slice()};
}());
