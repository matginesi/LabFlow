(function () {
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  const C=LF.Core;
  const Log=LF.Logger.scope('ai');
  let inFlight=false;
  let activeRequest=null;
  let injectedController=null;

  /** The OperationRunner hands over the single shared AbortController for a run. */
  function acceptController(c){injectedController=c||null;}

  function connectionTestPrompt(){
    if(LF.PromptRegistry&&LF.PromptRegistry.promptText)return LF.PromptRegistry.promptText('system.connection-test');
    if(LF.PromptDefaults&&LF.PromptDefaults['system.connection-test'])return LF.PromptDefaults['system.connection-test'];
    throw new Error('The connection-test Markdown prompt is missing from the compiled registry.');
  }

  function resolveChatUrl(endpoint){
    let url=String(endpoint||'').trim();
    if(!url)return '';
    url=url.replace(/\/+$/,'').replace(/\/chat\/completions(?:\/chat\/completions)+$/i,'/chat/completions');
    if(/\/chat\/completions$/i.test(url))return url;
    /* Provider settings store an OpenAI-compatible base URL. Keeping /v1 as the
       preset avoids accidental double suffixes and makes LM Studio/Ollama use
       exactly the same Chat Completions contract. */
    if(/\/v1$/i.test(url))return url+'/chat/completions';
    return url+'/chat/completions';
  }
  function validateHttpUrl(url){
    let parsed;
    try{parsed=new URL(String(url||''));}catch(_){throw new Error('AI endpoint is not a valid URL.');}
    if(parsed.protocol!=='https:'&&parsed.protocol!=='http:')throw new Error('AI endpoint must use http:// or https://.');
    return parsed.toString();
  }
  function isLocalAddress(url){
    let host='';
    try{host=new URL(String(url||'')).hostname.toLowerCase();}catch(_){return false;}
    if(host==='localhost'||host==='127.0.0.1'||host==='::1'||host==='[::1]'||host.endsWith('.local'))return true;
    const parts=host.split('.').map(Number);
    if(parts.length===4&&parts.every(Number.isFinite)){
      if(parts[0]===10||parts[0]===127)return true;
      if(parts[0]===192&&parts[1]===168)return true;
      if(parts[0]===172&&parts[1]>=16&&parts[1]<=31)return true;
      if(parts[0]===169&&parts[1]===254)return true;
    }
    return false;
  }
  function fetchOptions(url,headers,requestBody,controller){
    return {method:'POST',headers:headers,body:requestBody,signal:controller.signal,cache:'no-store',credentials:'omit'};
  }
  function estimateTokens(text){return Math.max(0,Math.round(String(text||'').length/4));}

  function parseProviderError(text,status,requestId){
    let code='',message='';
    try{const obj=JSON.parse(text||'{}'),e=obj.error||obj;code=String(e.code||obj.code||'');message=String(e.message||obj.message||'');}
    catch(_){message=String(text||'').replace(/\s+/g,' ').slice(0,420);}
    const label=status===429?'API rate limit reached':status?'AI request failed ('+status+')':'AI request failed';
    const hint=LF.AIDiagnostics?LF.AIDiagnostics.statusHint(status,code):'';
    const err=new Error(label+(code?' · '+code:'')+(message?' · '+message:'')+hint);
    err.status=status||0;err.providerCode=code;err.providerMessage=message;err.providerResponse=String(text||'').slice(0,12000);err.requestId=requestId||'';return err;
  }

  function headersObject(headers){
    const out={};
    if(headers&&typeof headers.forEach==='function')headers.forEach(function(value,key){out[key]=value;});
    else Object.keys(headers||{}).forEach(function(key){out[key]=headers[key];});
    return out;
  }

  function streamPart(value){
    if(value==null)return'';
    if(typeof value==='string')return value;
    if(Array.isArray(value))return value.map(streamPart).join('');
    if(typeof value==='object')return streamPart(value.text||value.content||value.value||'');
    return String(value);
  }

  /* Some OpenAI-compatible endpoints occasionally emit cumulative or overlapping
     content chunks. Merge defensively so one provider quirk cannot duplicate the
     whole answer, corrupt structured JSON, or make the analysis appear to loop. */
  function mergeStreamContent(current,incoming){
    current=String(current||'');incoming=String(incoming||'');
    if(!incoming)return current;if(!current)return incoming;if(incoming===current)return current;
    if(incoming.length>current.length&&incoming.indexOf(current)===0)return incoming;
    if(incoming.length>=24&&current.endsWith(incoming))return current;
    const max=Math.min(current.length,incoming.length,4096);
    for(let n=max;n>=16;n--){if(current.slice(-n)===incoming.slice(0,n))return current+incoming.slice(n);}
    return current+incoming;
  }
  function outputLoopDetected(value){const s=String(value||'').replace(/\s+/g,' ').trim();for(const n of [512,1024,2048]){if(s.length<n*3)continue;const a=s.slice(-n),b=s.slice(-2*n,-n),c=s.slice(-3*n,-2*n);if(a===b&&b===c)return true;}return false;}

  /** Consume one OpenAI-compatible SSE response in the active request. */
  async function readEventStream(response,onBytes,onProgress,onMeaningful,startedAt,budgetTokens){
    const reader=response.body&&response.body.getReader?response.body.getReader():null;
    if(!reader)throw new Error('The provider declared streaming but the browser exposed no readable response body.');
    const decoder=new TextDecoder(),state={content:'',reasoning:'',finishReason:'',usage:null,model:'',requestId:'',events:0,meaningfulEvents:0,bytes:0,ttftMs:null,budgetTokens:budgetTokens||null},started=startedAt||performance.now();
    let raw='',buffer='';
    function event(data){
      if(!data||data==='[DONE]')return;
      let obj;try{obj=JSON.parse(data);}catch(error){const invalid=new Error('Provider returned an invalid SSE JSON event.');invalid.cause=error;invalid.providerResponse=data;throw invalid;}
      if(obj.error)throw parseProviderError(JSON.stringify(obj),Number(obj.error.status||0),obj.request_id||'');
      const choice=obj.choices&&obj.choices[0]||{},delta=choice.delta||choice.message||{};
      const content=streamPart(delta.content||delta.text||choice.text||obj.output_text||obj.response),reasoning=streamPart(delta.reasoning_content||delta.reasoning||delta.reasoning_details||choice.reasoning_content||obj.reasoning_content||obj.reasoning);
      const meaningful=!!(content||reasoning||choice.finish_reason||obj.usage);
      if((content||reasoning)&&state.ttftMs==null)state.ttftMs=Math.round(performance.now()-started);
      state.content=mergeStreamContent(state.content,content);state.reasoning=mergeStreamContent(state.reasoning,reasoning);state.finishReason=choice.finish_reason||state.finishReason;
      if(meaningful){state.meaningfulEvents++;if(onMeaningful)onMeaningful();}
      if(outputLoopDetected(state.content)||outputLoopDetected(state.reasoning)){const repeated=outputLoopDetected(state.content)?state.content:state.reasoning,loop=new Error('The model entered a repeated-output loop. The checkpoint was stopped before storing duplicated content.');loop.code='MODEL_OUTPUT_LOOP';loop.providerResponse=repeated.slice(-12000);throw loop;}
      const charGuard=Math.max(24000,Number(budgetTokens||0)*8);if(state.content.length+state.reasoning.length>charGuard){const limit=new Error('Provider output exceeded the bounded work-unit size before completion.');limit.code='MODEL_OUTPUT_LIMIT_GUARD';limit.providerResponse=(state.content||state.reasoning).slice(-12000);throw limit;}
      state.usage=obj.usage||state.usage;state.model=obj.model||state.model;state.requestId=obj.request_id||obj.id||state.requestId;state.events++;
      if(onProgress)onProgress({content:state.content,reasoning:state.reasoning,finishReason:state.finishReason,usage:state.usage,events:state.events,meaningfulEvents:state.meaningfulEvents,bytes:state.bytes,ttftMs:state.ttftMs,elapsedMs:Math.round(performance.now()-started),budgetTokens:budgetTokens||null});
    }
    function consume(final){
      const blocks=buffer.split(/\r?\n\r?\n/);if(final)buffer='';else buffer=blocks.pop()||'';
      blocks.forEach(function(block){const data=block.split(/\r?\n/).filter(function(line){return line.indexOf('data:')===0;}).map(function(line){return line.slice(5).trimStart();}).join('\n');if(data)event(data);});
    }
    try{
      while(true){
        const part=await reader.read();
        if(part.done)break;
        state.bytes+=part.value.byteLength;
        const text=decoder.decode(part.value,{stream:true});onBytes(text);raw+=text;buffer+=text;consume(false);
      }
      const tail=decoder.decode();if(tail){raw+=tail;buffer+=tail;}consume(true);
      return{rawText:raw,json:{id:state.requestId,request_id:state.requestId,model:state.model,choices:[{message:{role:'assistant',content:state.content,reasoning_content:state.reasoning},finish_reason:state.finishReason}],usage:state.usage||null},stream:state};
    }catch(err){try{await reader.cancel();}catch(_){}throw err;}
  }

  async function request(url,headers,body,label,timeoutMs,onProgress,hardTimeoutMs){
    if(inFlight)throw new Error('Another AI request is already running.');
    inFlight=true;
    const parentController=injectedController||null,controller=new AbortController();
    const requestState={controller:controller,cancelled:false,timedOut:false,timeoutReason:'',partialRaw:''};
    function abortFromTask(){requestState.cancelled=true;try{controller.abort();}catch(_){}}
    if(parentController){if(parentController.signal.aborted)abortFromTask();else parentController.signal.addEventListener('abort',abortFromTask,{once:true});}
    activeRequest=requestState;
    const limit=Math.max(5000,Number(timeoutMs)||60000),requestedHardLimit=Math.max(0,Number(hardTimeoutMs)||0),hardLimit=requestedHardLimit?Math.max(5000,requestedHardLimit):0;
    let timeout=null,hardTimeout=null;
    function resetInactivity(){clearTimeout(timeout);timeout=setTimeout(function(){requestState.timedOut=true;requestState.timeoutReason='inactivity';controller.abort();},limit);}
    resetInactivity();
    if(hardLimit)hardTimeout=setTimeout(function(){requestState.timedOut=true;requestState.timeoutReason='deadline';controller.abort();},hardLimit);
    const started=performance.now();
    const requestLogId=C.uid('api');
    const requestBody=JSON.stringify(body);
    let responseMeta=null;
    Log.info('request.start',{
      requestLogId:requestLogId,label:label,method:'POST',endpoint:url,timeoutMs:limit,hardTimeoutMs:hardLimit||null,
      request:{headers:headersObject(headers),body:body,bodyChars:requestBody.length,messageCount:(body.messages||[]).length},
      browser:{protocol:location.protocol,origin:location.origin||'null',secureContext:!!window.isSecureContext,localTarget:isLocalAddress(url)},
      provider:{model:body.model,stream:!!body.stream,jsonMode:!!body.response_format,thinking:body.thinking&&body.thinking.type||'n/a',reasoningEffort:body.reasoning_effort||'n/a'}
    });
    try{
      const response=await fetch(url,fetchOptions(url,headers,requestBody,controller));
      resetInactivity();
      const contentType=String(response.headers.get('content-type')||'').toLowerCase();
      let text='',obj=null,streamMeta=null;
      responseMeta={status:response.status,statusText:response.statusText,ok:response.ok,headers:headersObject(response.headers),body:null,bodyChars:0,requestId:response.headers.get('x-request-id')||response.headers.get('request-id')||'',stream:null};
      if(response.ok&&body.stream&&contentType.indexOf('text/event-stream')>=0){const streamed=await readEventStream(response,function(chunk){requestState.partialRaw+=chunk;},onProgress,resetInactivity,started,Number.isFinite(Number(body.max_tokens))?Number(body.max_tokens):null);text=streamed.rawText;obj=streamed.json;streamMeta=streamed.stream;}
      else{text=await response.text();resetInactivity();}
      const elapsed=Math.round(performance.now()-started);
      const responseRequestId=response.headers.get('x-request-id')||response.headers.get('request-id')||'';
      responseMeta={status:response.status,statusText:response.statusText,ok:response.ok,headers:headersObject(response.headers),body:text,bodyChars:text.length,requestId:responseRequestId,stream:streamMeta?{events:streamMeta.events,meaningfulEvents:streamMeta.meaningfulEvents,bytes:streamMeta.bytes,ttftMs:streamMeta.ttftMs,finishReason:streamMeta.finishReason}:null};
      Log.info('request.end',{requestLogId:requestLogId,label:label,method:'POST',endpoint:url,elapsedMs:elapsed,response:responseMeta});
      if(!response.ok)throw parseProviderError(text,response.status,responseRequestId);
      if(!obj)try{obj=text?JSON.parse(text):{};}catch(parseError){const invalid=new Error('Provider returned invalid JSON.');invalid.cause=parseError;invalid.status=response.status;invalid.requestId=responseRequestId;invalid.providerResponse=text;throw invalid;}
      Log.info('response.parsed',{requestLogId:requestLogId,requestId:responseRequestId||obj.request_id||obj.id||'',model:obj.model||body.model,transport:streamMeta?'sse':'json',stream:streamMeta?{events:streamMeta.events,meaningfulEvents:streamMeta.meaningfulEvents,bytes:streamMeta.bytes,ttftMs:streamMeta.ttftMs}:null,usage:obj.usage||null,finishReason:obj.choices&&obj.choices[0]&&obj.choices[0].finish_reason||obj.finish_reason||'',responseKeys:Object.keys(obj||{})});
      return{json:obj,elapsedMs:elapsed,requestId:response.headers.get('x-request-id')||response.headers.get('request-id')||obj.request_id||obj.id||'',requestLogId:requestLogId,rawText:text,stream:streamMeta};
    }catch(err){
      const elapsed=Math.round(performance.now()-started);
      let failure=err;
      if(!(err&&err.status)&&err&&err.name==='AbortError'){
        const wasCancelled=requestState.cancelled||!!(parentController&&parentController.signal.aborted);
        failure=new Error(wasCancelled?'AI request cancelled by the user.':(requestState.timeoutReason==='deadline'?label+' reached its '+Math.round(hardLimit/1000)+' second work-unit deadline.':label+' stopped after '+Math.round(limit/1000)+' seconds without provider bytes.'));
        failure.isNetwork=!wasCancelled;failure.cancelled=wasCancelled;failure.timedOut=!wasCancelled&&requestState.timedOut;failure.timeoutReason=requestState.timeoutReason;failure.timeoutMs=requestState.timeoutReason==='deadline'?hardLimit:limit;failure.elapsedMs=elapsed;failure.cause=err;
      }else if(!(err&&err.status)&&!(err&&err.code)&&!/^Provider returned|^The model returned/.test(String(err&&err.message||''))){
        const providerId=(LF.Storage.getAiSettings()||{}).provider||'';
        const message=LF.AIDiagnostics?LF.AIDiagnostics.networkMessage(label,providerId):label+' could not reach the AI service. Check the endpoint and provider status.';
        failure=new Error(message);failure.isNetwork=true;failure.providerId=providerId;failure.elapsedMs=elapsed;failure.cause=err;
      }
      const responseDetail=responseMeta||{received:false,body:null,bodyChars:0,note:failure.timedOut?'No provider bytes before the inactivity timeout.':failure.cancelled?'Request cancelled before an HTTP response.':'No HTTP response received.'};
      if(requestState.partialRaw){responseDetail.body=requestState.partialRaw;responseDetail.bodyChars=requestState.partialRaw.length;responseDetail.partial=true;responseDetail.note='Partial SSE stream retained before '+(failure.timedOut?'provider inactivity.':'cancellation or failure.');}
      if(requestState.partialRaw&&!failure.providerResponse){failure.providerResponse=requestState.partialRaw;failure.rawProviderResponse=requestState.partialRaw;}
      if(!Number.isFinite(Number(failure.elapsedMs)))failure.elapsedMs=elapsed;
      failure.requestLogId=requestLogId;
      Log.error('request.failed',{requestLogId:requestLogId,label:label,method:'POST',endpoint:url,elapsedMs:elapsed,timeoutMs:limit,hardTimeoutMs:hardLimit||null,status:failure&&failure.status||responseMeta&&responseMeta.status||0,providerCode:failure&&failure.providerCode||'',providerMessage:failure&&failure.providerMessage||'',requestId:failure&&failure.requestId||responseMeta&&responseMeta.requestId||'',request:{headers:headersObject(headers),body:body,bodyChars:requestBody.length},response:responseDetail,error:failure});
      throw failure;
    }finally{
      clearTimeout(timeout);clearTimeout(hardTimeout);if(parentController)parentController.signal.removeEventListener('abort',abortFromTask);if(activeRequest===requestState)activeRequest=null;inFlight=false;
    }
  }

  function abort(){
    if(!activeRequest)return false;
    activeRequest.cancelled=true;
    try{activeRequest.controller.abort();}catch(_){}
    return true;
  }

  function requestConfig(){
    const settings=LF.Storage.getAiSettings();
    const key=LF.Storage.getApiKey();
    const provider=(LF.AIProviders&&LF.AIProviders[settings.provider])||{};
    if(!settings.endpoint||!settings.model)throw new Error('AI provider is not configured. Open Settings.');
    if(provider.keyRequired&&!key)throw new Error((provider.name||settings.provider)+' requires an API key. Open Settings.');
    const url=validateHttpUrl(resolveChatUrl(settings.endpoint));
    const headers={'Content-Type':'application/json','Accept':'application/json'};
    if(settings.provider==='zai')headers['Accept-Language']='en-US,en';
    if(key&&(provider.keyRequired||provider.optionalKey))headers.Authorization='Bearer '+key;
    return{settings:settings,provider:provider,url:url,headers:headers};
  }

  function textFrom(value){
    if(value==null)return '';
    if(typeof value==='string')return value.trim();
    if(typeof value==='number'||typeof value==='boolean')return String(value);
    if(Array.isArray(value))return value.map(textFrom).filter(Boolean).join('\n').trim();
    if(typeof value==='object'){
      if(typeof value.text==='string')return value.text.trim();
      if(value.text&&typeof value.text==='object')return textFrom(value.text.value||value.text.content||value.text);
      if(typeof value.value==='string')return value.value.trim();
      if(typeof value.content==='string'||Array.isArray(value.content))return textFrom(value.content);
      if(typeof value.output_text==='string')return value.output_text.trim();
    }
    return '';
  }

  function extractAssistant(obj){
    const choice=obj&&obj.choices&&obj.choices[0]||{};
    const msg=choice.message||{};
    let content=textFrom(msg.content)||textFrom(msg.text)||textFrom(choice.text)||textFrom(obj&&obj.output_text);
    if(!content&&Array.isArray(obj&&obj.output))content=textFrom(obj.output);
    const reasoning=textFrom(msg.reasoning_content)||textFrom(msg.reasoning)||textFrom(choice.reasoning_content)||textFrom(obj&&obj.reasoning_content);
    const finishReason=String(choice.finish_reason||obj&&obj.finish_reason||'');
    const refusal=textFrom(msg.refusal)||textFrom(choice.refusal);
    if(!content&&refusal)content=refusal;
    return{content:content,reasoning:reasoning,finishReason:finishReason,choice:choice,message:msg};
  }

  function resolveModelsUrl(endpoint){
    const chat=validateHttpUrl(resolveChatUrl(endpoint));
    const u=new URL(chat);
    u.pathname=u.pathname.replace(/\/chat\/completions$/i,'/models');
    u.search='';u.hash='';
    return u.toString();
  }

  async function listModels(providerId,endpoint){
    const settings=LF.Storage.getAiSettings(),provider=(LF.AIProviders&&LF.AIProviders[providerId||settings.provider])||{};
    const key=LF.Storage.getApiKey(),url=resolveModelsUrl(endpoint||settings.endpoint),headers={'Accept':'application/json'};
    if(key&&(provider.keyRequired||provider.optionalKey))headers.Authorization='Bearer '+key;
    const started=performance.now(),response=await fetch(url,{method:'GET',headers:headers,cache:'no-store',credentials:'omit'});
    const text=await response.text();
    if(!response.ok)throw parseProviderError(text,response.status,response.headers.get('x-request-id')||'');
    let obj={};try{obj=text?JSON.parse(text):{};}catch(error){const e=new Error('Model list returned invalid JSON.');e.cause=error;e.providerResponse=text;throw e;}
    const rows=Array.isArray(obj.data)?obj.data:Array.isArray(obj.models)?obj.models:[];
    const models=rows.map(function(item){return typeof item==='string'?item:String(item&&item.id||item&&item.model||item&&item.name||'');}).filter(Boolean);
    return{models:models,elapsedMs:Math.round(performance.now()-started),url:url};
  }

  async function testConnection(){
    const cfg=requestConfig();
    const body={model:cfg.settings.model,messages:[{role:'user',content:connectionTestPrompt()}],stream:false};
    body[cfg.provider.tokenParam||'max_tokens']=32;
    if(cfg.provider.supportsThinking)body.thinking={type:'disabled'};
    if(cfg.provider.reasoningEffort)body.reasoning_effort=cfg.provider.reasoningEffort;
    const r=await request(cfg.url,cfg.headers,body,'AI connection test',cfg.provider.connectionTestTimeoutMs||60000);
    const extracted=extractAssistant(r.json);
    if(!extracted.content)Log.warn('test.empty-content',{model:r.json.model||cfg.settings.model,finishReason:extracted.finishReason,keys:Object.keys(r.json||{})});
    return{ok:true,elapsedMs:r.elapsedMs,model:r.json.model||cfg.settings.model,content:extracted.content,usage:r.json.usage||null,requestId:r.requestId};
  }

  /**
   * Build the exact provider request. The caller (OperationRunner or Settings)
   * owns the already-assembled messages; this is transport only. Deep thinking
   * and temperature overrides for structured actions are explicit caller opts.
   */
  function buildRequest(opts){
    opts=opts||{};
    const cfg=requestConfig();
    if(opts.maxTokens!=null&&!(Number(opts.maxTokens)>0))throw new Error('AI output token budget must be a positive number.');
    const settings=cfg.settings,provider=cfg.provider;
    const model=opts.model||settings.model;
    const messages=Array.isArray(opts.messages)?opts.messages.filter(function(message){return message&&typeof message==='object'&&typeof message.role==='string'&&message.content!=null;}):[];
    if(!messages.length)throw new Error('Chat Completions requires at least one message. LabFlow stopped the request before contacting the provider.');
    const wantsStreaming=opts.stream!==false&&settings.streaming!==false&&provider.supportsStreaming!==false;
    const body={model:model,messages:messages,stream:wantsStreaming};
    if(wantsStreaming&&provider.supportsStreamUsage)body.stream_options={include_usage:true};
    const tokenParam=provider.tokenParam||'max_tokens';
    body[tokenParam]=Math.max(16,Number(opts.maxTokens)||8192);
    if(provider.supportsTemperature!==false)body.temperature=Number.isFinite(Number(opts.temperature))?Number(opts.temperature):(Number.isFinite(Number(settings.temperature))?Number(settings.temperature):0.7);
    if(provider.supportsThinking)body.thinking={type:'disabled'};
    if(provider.reasoningEffort)body.reasoning_effort=provider.reasoningEffort;
    if(opts.jsonSchema&&provider.supportsJsonSchema){const name=String(opts.jsonSchemaName||'labflow_output').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,64)||'labflow_output';body.response_format={type:'json_schema',json_schema:{name:name,strict:true,schema:opts.jsonSchema}};}else if(opts.jsonMode&&provider.supportsJsonMode)body.response_format={type:'json_object'};
    const providerTimeout=Math.max(5000,Number(provider.requestTimeoutMs)||90000);
    const timeoutMs=Math.max(Number(settings.inactivityTimeoutMs)||90000,providerTimeout,Math.max(0,Number(opts.timeoutMs)||0));
    const hardTimeoutMs=Math.max(0,Number(opts.hardTimeoutMs)||0);
    return{url:cfg.url,headers:cfg.headers,body:body,timeoutMs:timeoutMs,hardTimeoutMs:hardTimeoutMs,provider:provider,settings:settings,model:model};
  }

  async function send(spec,opts){
    opts=opts||{};
    const r=await request(spec.url,spec.headers,spec.body,opts.label||'AI request',spec.timeoutMs,opts.onProgress,spec.hardTimeoutMs);
    const obj=r.json,extracted=extractAssistant(obj),usage=obj.usage||{};
    const content=extracted.content,reasoning=extracted.reasoning;
    if(!content){
      Log.warn('response.empty-content',{model:obj.model||spec.settings.model,finishReason:extracted.finishReason,reasoningChars:reasoning.length,responseKeys:Object.keys(obj||{}),messageKeys:Object.keys(extracted.message||{})});
      const suffix=extracted.finishReason?' Finish reason: '+extracted.finishReason+'.':'';
      const hint=reasoning?' The provider returned reasoning but no final answer; the output budget may have been consumed before the final response.':'';
      const emptyError=new Error('The model returned no final text.'+suffix+hint);
      emptyError.isContract=true;emptyError.reasoning=reasoning;emptyError.finishReason=extracted.finishReason;
      emptyError.providerResponse=extracted.refusal||'';emptyError.rawProviderResponse=r.rawText;
      emptyError.requestId=r.requestId;emptyError.requestLogId=r.requestLogId;emptyError.elapsedMs=r.elapsedMs;emptyError.usage=usage;
      throw emptyError;
    }
    const promptTokens=Number.isFinite(Number(usage.prompt_tokens))?Number(usage.prompt_tokens):estimateTokens((spec.body.messages||[]).map(function(m){return m.content||'';}).join('\n'));
    const completionTokens=Number.isFinite(Number(usage.completion_tokens))?Number(usage.completion_tokens):estimateTokens(content+reasoning);
    const totalTokens=Number.isFinite(Number(usage.total_tokens))?Number(usage.total_tokens):promptTokens+completionTokens;
    const tps=r.elapsedMs>0?Number((completionTokens/(r.elapsedMs/1000)).toFixed(2)):null;
    return{content:content,reasoning:reasoning,model:obj.model||spec.settings.model,provider:spec.settings.provider,latencyMs:r.elapsedMs,ttftMs:r.stream&&r.stream.ttftMs||null,tokensPerSecond:tps,usage:{promptTokens:promptTokens,completionTokens:completionTokens,totalTokens:totalTokens,cachedTokens:usage.prompt_tokens_details&&usage.prompt_tokens_details.cached_tokens||null,estimated:!obj.usage},finishReason:extracted.finishReason,requestId:r.requestId,requestLogId:r.requestLogId,rawProviderResponse:r.rawText,streamed:!!r.stream,streamEvents:r.stream&&r.stream.events||0,meaningfulStreamEvents:r.stream&&r.stream.meaningfulEvents||0,responseBytes:r.stream&&r.stream.bytes||r.rawText.length};
  }

  LF.AI={
    buildRequest:buildRequest,
    send:send,
    abort:abort,
    cancel:abort,
    acceptController:acceptController,
    isBusy:function(){return inFlight;},
    resolveChatUrl:resolveChatUrl,
    validateHttpUrl:validateHttpUrl,
    estimateTokens:estimateTokens,
    isLocalAddress:isLocalAddress,
    mergeStreamContent:mergeStreamContent,
    outputLoopDetected:outputLoopDetected,
    resolveModelsUrl:resolveModelsUrl,
    listModels:listModels,
    testConnection:testConnection
  };
}());
