(function () {
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  const C=LF.Core;
  const Log=LF.Logger.scope('ai');
  let inFlight=false;
  let activeRequest=null;
  let injectedController=null;
  const rateStates=new Map();
  const METADATA_TIMEOUT_MS=5000;

  /** The ActionRunner hands over the single shared AbortController for a run. */
  function acceptController(c){injectedController=c||null;}

  function connectionTestPrompt(){
    if(LF.PromptRegistry&&LF.PromptRegistry.promptText)return LF.PromptRegistry.promptText('system.connection-test');
    if(LF.PromptDefaults&&LF.PromptDefaults['system.connection-test'])return LF.PromptDefaults['system.connection-test'];
    throw new Error('The connection-test Markdown prompt is missing from the compiled registry.');
  }

  /** Apply only allowlisted provider fields for the selected thinking policy. */
  function applyThinkingMode(body,provider,mode){
    mode=['off','on'].includes(mode)?mode:'auto';
    const payload=provider&&provider.thinkingModes&&provider.thinkingModes[mode];
    if(!payload||typeof payload!=='object')return{requested:mode,applied:'auto'};
    Object.keys(payload).forEach(function(key){const value=payload[key];body[key]=value&&typeof value==='object'?JSON.parse(JSON.stringify(value)):value;});
    return{requested:mode,applied:mode};
  }

  /** Keep connectivity boring: one tiny request, no capability discovery. */
  function connectionProbePolicy(provider){
    const configured=Math.max(8,Math.min(16,Number(provider&&provider.connectionTestMaxTokens)||16));
    return{thinkingMode:provider&&provider.thinkingModes&&provider.thinkingModes.off?'off':'auto',maxTokens:configured};
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
  function estimatePromptTokens(value){
    const text=Array.isArray(value)?value.map(function(m){return String(m&&m.content||'');}).join('\n'):String(value||'');
    /* JSON-heavy scientific Context Packs tokenize less efficiently than prose.
       Use a conservative estimate for context-fit decisions; provider usage still
       replaces this estimate whenever the API exposes exact token counts. */
    return Math.max(0,Math.ceil(text.length/2.7)+(Array.isArray(value)?value.length*8:0));
  }

  function retryAfterMs(headers){
    if(!headers||typeof headers.get!=='function')return 0;
    const raw=String(headers.get('retry-after')||'').trim();if(!raw)return 0;
    const seconds=Number(raw);if(Number.isFinite(seconds)&&seconds>=0)return Math.round(seconds*1000);
    const when=Date.parse(raw);return Number.isFinite(when)?Math.max(0,when-Date.now()):0;
  }
  function contextOverflowDetails(text,message){
    const raw=String(text||'')+' '+String(message||''),lower=raw.toLowerCase();
    if(lower.indexOf('exceed_context_size_error')<0&&lower.indexOf('exceeds the available context size')<0&&lower.indexOf('context length exceeded')<0)return null;
    const prompt=raw.match(/(?:n_prompt_tokens[\"']?\s*[:=]\s*|request \()([0-9]{2,})\s*(?:tokens)?/i),ctx=raw.match(/(?:n_ctx[\"']?\s*[:=]\s*|context size \()([0-9]{2,})/i),http=raw.match(/returned\s+(4\d\d)\s*:/i);
    return{promptTokens:prompt?Number(prompt[1]):null,contextWindow:ctx?Number(ctx[1]):null,httpStatus:http?Number(http[1]):null};
  }
  function parseProviderError(text,status,requestId,headers){
    let code='',message='',providerType='';
    try{const obj=JSON.parse(text||'{}'),e=obj.error||obj;code=String(e.code||obj.code||'');message=String(e.message||obj.message||'');providerType=String(e.type||obj.type||'');}
    catch(_){message=String(text||'').replace(/\s+/g,' ').slice(0,420);}
    const overflow=contextOverflowDetails(text,message),effectiveStatus=Number(status)||overflow&&overflow.httpStatus||0;
    if(overflow){code='MODEL_CONTEXT_LENGTH';providerType=providerType||'exceed_context_size_error';}
    const rateLimited=effectiveStatus===429||code==='1305';
    const label=overflow?'Model context exceeded':rateLimited?'API rate limit reached':effectiveStatus?'AI request failed ('+effectiveStatus+')':'AI request failed';
    const hint=LF.AIDiagnostics?LF.AIDiagnostics.statusHint(effectiveStatus,code):'';
    const err=new Error(label+(overflow&&overflow.promptTokens&&overflow.contextWindow?' · '+overflow.promptTokens+' input tokens > '+overflow.contextWindow+' context tokens':'')+(!overflow&&code?' · '+code:'')+(message?' · '+message:'')+hint);
    err.status=effectiveStatus;err.code=overflow?'MODEL_CONTEXT_LENGTH':'';err.providerCode=code;err.providerType=providerType;err.providerMessage=message;err.providerResponse=String(text||'').slice(0,12000);err.requestId=requestId||'';err.retryAfterMs=retryAfterMs(headers);err.isProvider=true;
    if(overflow){err.promptTokens=overflow.promptTokens;err.contextWindow=overflow.contextWindow;err.isContextOverflow=true;}
    return err;
  }
  function isRateLimitError(err){return!!(err&&(Number(err.status)===429||String(err.providerCode||'')==='1305'));}
  function rateKey(spec){return[String(spec&&spec.settings&&spec.settings.provider||''),String(spec&&spec.model||spec&&spec.settings&&spec.settings.model||'')].join('|');}
  function ratePolicy(spec){
    const provider=spec&&spec.provider||{},settings=spec&&spec.settings||{},cfg=provider.rateLimit||{},providerId=String(settings.provider||provider.id||''),model=String(spec&&spec.model||settings.model||''),freeZaiFlash=providerId==='zai'&&/^glm-4\.7-flash$/i.test(model);
    const delays=Array.isArray(cfg.delaysMs)&&cfg.delaysMs.length?cfg.delaysMs.map(function(x){return Math.max(0,Number(x)||0);}):[5000,12000],retryCount=Number(cfg.retries);
    return{key:rateKey(spec),retries:Number.isFinite(retryCount)?Math.max(0,Math.min(4,retryCount)):1,delaysMs:delays,maxDelayMs:Math.max(1000,Number(cfg.maxDelayMs)||30000),minIntervalMs:freeZaiFlash?Math.max(0,Number(cfg.freeFlashMinIntervalMs)||0):Math.max(0,Number(cfg.minIntervalMs)||0),adaptiveStepMs:Math.max(250,Number(cfg.adaptiveStepMs)||1000),adaptiveMaxIntervalMs:Math.max(1000,Number(cfg.adaptiveMaxIntervalMs)||10000),providerId:providerId,model:model};
  }
  function rateState(key){if(!rateStates.has(key))rateStates.set(key,{lastStartedAt:0,nextAllowedAt:0,rateLimitCount:0,dynamicMinIntervalMs:0,successCount:0});return rateStates.get(key);}
  function cancelledWaitError(){const e=new Error('AI request cancelled by the user.');e.cancelled=true;e.code='ACTION_ABORTED';return e;}
  function waitFor(ms){
    ms=Math.max(0,Math.round(Number(ms)||0));if(!ms)return Promise.resolve();
    return new Promise(function(resolve,reject){const parent=injectedController&&injectedController.signal;let timer=null;function clean(){if(timer)clearTimeout(timer);if(parent)parent.removeEventListener('abort',aborted);}function done(){clean();resolve();}function aborted(){clean();reject(cancelledWaitError());}if(parent&&parent.aborted){aborted();return;}if(parent)parent.addEventListener('abort',aborted,{once:true});timer=setTimeout(done,ms);});
  }
  function deadlineError(label,hardTimeoutMs){const e=new Error((label||'AI request')+' reached its '+Math.round(Number(hardTimeoutMs||0)/1000)+' second work-unit deadline while waiting for the provider.');e.timedOut=true;e.timeoutReason='deadline';e.timeoutMs=Number(hardTimeoutMs)||0;return e;}
  async function waitForRateSlot(spec,opts,overallStarted,hardTimeoutMs,policy){
    policy=policy||ratePolicy(spec);const state=rateState(policy.key),now=Date.now(),effectiveInterval=Math.max(policy.minIntervalMs,Number(state.dynamicMinIntervalMs)||0),target=opts&&opts.connectionTest?now:Math.max(state.nextAllowedAt||0,(state.lastStartedAt||0)+effectiveInterval),wait=Math.max(0,target-now);
    if(wait){const elapsed=performance.now()-overallStarted;if(hardTimeoutMs&&elapsed+wait>=hardTimeoutMs)throw deadlineError(opts&&opts.label,hardTimeoutMs);if(Log)Log.info('rate-limit.pacing',{provider:policy.providerId,model:policy.model,waitMs:wait,dynamicIntervalMs:state.dynamicMinIntervalMs||0});if(opts&&opts.onProgress)opts.onProgress({transportState:'provider_pacing',waitMs:wait,provider:policy.providerId,model:policy.model});await waitFor(wait);}
    state.lastStartedAt=Date.now();return state;
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
    const decoder=new TextDecoder(),state={content:'',reasoning:'',finishReason:'',usage:null,model:'',requestId:'',events:0,meaningfulEvents:0,bytes:0,ttftMs:null,budgetTokens:budgetTokens||null,done:false},started=startedAt||performance.now();
    let raw='',buffer='';
    function event(data){
      if(!data)return false;
      if(data==='[DONE]'){state.done=true;return true;}
      let obj;try{obj=JSON.parse(data);}catch(error){const invalid=new Error('Provider returned an invalid SSE JSON event.');invalid.cause=error;invalid.providerResponse=data;throw invalid;}
      if(obj.error)throw parseProviderError(JSON.stringify(obj),Number(obj.error.status||0),obj.request_id||'',null);
      const choice=obj.choices&&obj.choices[0]||{},delta=choice.delta||choice.message||{};
      const content=streamPart(delta.content||delta.text||choice.text||obj.output_text||obj.response),reasoning=streamPart(delta.reasoning_content||delta.reasoning||delta.reasoning_details||choice.reasoning_content||obj.reasoning_content||obj.reasoning);
      const meaningful=!!(content||reasoning||choice.finish_reason||obj.usage);
      if((content||reasoning)&&state.ttftMs==null)state.ttftMs=Math.round(performance.now()-started);
      state.content=mergeStreamContent(state.content,content);state.reasoning=mergeStreamContent(state.reasoning,reasoning);state.finishReason=choice.finish_reason||state.finishReason;
      if(meaningful){state.meaningfulEvents++;if(onMeaningful)onMeaningful();}
      if(outputLoopDetected(state.content)||outputLoopDetected(state.reasoning)){const repeated=outputLoopDetected(state.content)?state.content:state.reasoning,loop=new Error('The model entered a repeated-output loop. The checkpoint was stopped before storing duplicated content.');loop.code='MODEL_OUTPUT_LOOP';loop.providerResponse=repeated.slice(-12000);throw loop;}
      const charGuard=budgetTokens?Math.max(24000,Number(budgetTokens)*8):4000000;if(state.content.length+state.reasoning.length>charGuard){const limit=new Error('Provider output exceeded the bounded work-unit size before completion.');limit.code='MODEL_OUTPUT_LIMIT_GUARD';limit.providerResponse=(state.content||state.reasoning).slice(-12000);throw limit;}
      state.usage=obj.usage||state.usage;state.model=obj.model||state.model;state.requestId=obj.request_id||obj.id||state.requestId;state.events++;
      if(onProgress){const elapsedMs=Math.round(performance.now()-started),reported=state.usage&&Number.isFinite(Number(state.usage.completion_tokens))?Number(state.usage.completion_tokens):null,tokens=reported==null?estimateTokens(state.content+state.reasoning):reported,rate=elapsedMs>0?tokens/(elapsedMs/1000):null;onProgress({content:state.content,reasoning:state.reasoning,finishReason:state.finishReason,usage:state.usage,events:state.events,meaningfulEvents:state.meaningfulEvents,bytes:state.bytes,ttftMs:state.ttftMs,elapsedMs:elapsedMs,tokens:tokens,rate:Number.isFinite(rate)?rate:null,estimated:reported==null,budgetTokens:budgetTokens||null});}
      return false;
    }
    function consume(final){
      const blocks=buffer.split(/\r?\n\r?\n/);if(final)buffer='';else buffer=blocks.pop()||'';
      let terminal=false;
      for(const block of blocks){const data=block.split(/\r?\n/).filter(function(line){return line.indexOf('data:')===0;}).map(function(line){return line.slice(5).trimStart();}).join('\n');if(data&&event(data))terminal=true;}
      return terminal;
    }
    try{
      while(true){
        const part=await reader.read();
        if(part.done)break;
        state.bytes+=part.value.byteLength;
        const text=decoder.decode(part.value,{stream:true});onBytes(text);raw+=text;buffer+=text;
        if(consume(false)){try{Promise.resolve(reader.cancel()).catch(function(){});}catch(_){}break;}
      }
      const tail=decoder.decode();if(tail){raw+=tail;buffer+=tail;}if(!state.done)consume(true);
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
    const msgChars=(body.messages||[]).reduce(function(n,m){return n+String(m&&m.content||'').length;},0),maxTokens=body.max_completion_tokens||body.max_tokens||body.max_output_tokens||null;
    Log.info('request.start',{requestLogId:requestLogId,label:label,endpoint:url,model:body.model,stream:!!body.stream,messages:(body.messages||[]).length,messageChars:msgChars,bodyChars:requestBody.length,maxTokens:maxTokens,thinking:body.thinking&&body.thinking.type||body.reasoning_effort||'auto',timeoutMs:limit,hardTimeoutMs:hardLimit||null,localTarget:isLocalAddress(url)});
    Log.debug('request.payload',{requestLogId:requestLogId,headers:headersObject(headers),body:body});
    try{
      const response=await fetch(url,fetchOptions(url,headers,requestBody,controller));
      const responseHeadersMs=Math.round(performance.now()-started);
      resetInactivity();
      const contentType=String(response.headers.get('content-type')||'').toLowerCase();
      let text='',obj=null,streamMeta=null;
      responseMeta={status:response.status,statusText:response.statusText,ok:response.ok,headers:headersObject(response.headers),body:null,bodyChars:0,requestId:response.headers.get('x-request-id')||response.headers.get('request-id')||'',stream:null};
      if(response.ok&&body.stream&&contentType.indexOf('text/event-stream')>=0){const streamed=await readEventStream(response,function(chunk){requestState.partialRaw+=chunk;},onProgress,resetInactivity,started,positiveInt(body.max_completion_tokens||body.max_tokens||body.max_output_tokens));text=streamed.rawText;obj=streamed.json;streamMeta=streamed.stream;}
      else{text=await response.text();resetInactivity();}
      const elapsed=Math.round(performance.now()-started);
      const responseRequestId=response.headers.get('x-request-id')||response.headers.get('request-id')||'';
      responseMeta={status:response.status,statusText:response.statusText,ok:response.ok,headers:headersObject(response.headers),body:text,bodyChars:text.length,requestId:responseRequestId,stream:streamMeta?{events:streamMeta.events,meaningfulEvents:streamMeta.meaningfulEvents,bytes:streamMeta.bytes,ttftMs:streamMeta.ttftMs,finishReason:streamMeta.finishReason}:null};
      Log.info('request.end',{requestLogId:requestLogId,label:label,status:response.status,ok:response.ok,elapsedMs:elapsed,responseHeadersMs:responseHeadersMs,bodyChars:text.length,requestId:responseRequestId,stream:responseMeta.stream});Log.debug('response.payload',{requestLogId:requestLogId,status:response.status,body:text.length>12000?text.slice(0,12000)+'…':text});
      if(!response.ok)throw parseProviderError(text,response.status,responseRequestId,response.headers);
      if(!obj)try{obj=text?JSON.parse(text):{};}catch(parseError){const invalid=new Error('Provider returned invalid JSON.');invalid.cause=parseError;invalid.status=response.status;invalid.requestId=responseRequestId;invalid.providerResponse=text;throw invalid;}
      Log.debug('response.parsed',{requestLogId:requestLogId,requestId:responseRequestId||obj.request_id||obj.id||'',model:obj.model||body.model,transport:streamMeta?'sse':'json',stream:streamMeta?{events:streamMeta.events,meaningfulEvents:streamMeta.meaningfulEvents,bytes:streamMeta.bytes,ttftMs:streamMeta.ttftMs}:null,usage:obj.usage||null,finishReason:obj.choices&&obj.choices[0]&&obj.choices[0].finish_reason||obj.finish_reason||'',responseKeys:Object.keys(obj||{})});
      return{json:obj,elapsedMs:elapsed,responseHeadersMs:responseHeadersMs,requestId:response.headers.get('x-request-id')||response.headers.get('request-id')||obj.request_id||obj.id||'',requestLogId:requestLogId,rawText:text,stream:streamMeta};
    }catch(err){
      const elapsed=Math.round(performance.now()-started);
      let failure=err;
      if(!(err&&err.status)&&err&&err.name==='AbortError'){
        const wasCancelled=requestState.cancelled||!!(parentController&&parentController.signal.aborted);
        failure=new Error(wasCancelled?'AI request cancelled by the user.':(requestState.timeoutReason==='deadline'?label+' reached its '+Math.round(hardLimit/1000)+' second work-unit deadline.':label+' stopped after '+Math.round(limit/1000)+' seconds without provider bytes.'));
        failure.isNetwork=!wasCancelled;failure.cancelled=wasCancelled;failure.timedOut=!wasCancelled&&requestState.timedOut;failure.timeoutReason=requestState.timeoutReason;failure.timeoutMs=requestState.timeoutReason==='deadline'?hardLimit:limit;failure.elapsedMs=elapsed;failure.cause=err;
      }else if(!(err&&err.status)&&!(err&&err.code)&&!(err&&err.isProvider)&&!/^Provider returned|^The model returned/.test(String(err&&err.message||''))){
        const providerId=(LF.Storage.getAiSettings()||{}).provider||'';
        const message=LF.AIDiagnostics?LF.AIDiagnostics.networkMessage(label,providerId):label+' could not reach the AI service. Check the endpoint and provider status.';
        failure=new Error(message);failure.isNetwork=true;failure.providerId=providerId;failure.elapsedMs=elapsed;failure.cause=err;
      }
      const responseDetail=responseMeta||{received:false,body:null,bodyChars:0,note:failure.timedOut?'No provider bytes before the inactivity timeout.':failure.cancelled?'Request cancelled before an HTTP response.':'No HTTP response received.'};
      if(requestState.partialRaw){responseDetail.body=requestState.partialRaw;responseDetail.bodyChars=requestState.partialRaw.length;responseDetail.partial=true;responseDetail.note='Partial SSE stream retained before '+(failure.timedOut?'provider inactivity.':'cancellation or failure.');}
      if(requestState.partialRaw&&!failure.providerResponse){failure.providerResponse=requestState.partialRaw;failure.rawProviderResponse=requestState.partialRaw;}
      if(!Number.isFinite(Number(failure.elapsedMs)))failure.elapsedMs=elapsed;
      failure.requestLogId=requestLogId;
      Log.error('request.failed',{requestLogId:requestLogId,label:label,endpoint:url,model:body.model,elapsedMs:elapsed,timeoutMs:limit,hardTimeoutMs:hardLimit||null,status:failure&&failure.status||responseMeta&&responseMeta.status||0,providerCode:failure&&failure.providerCode||'',providerMessage:failure&&failure.providerMessage||'',requestId:failure&&failure.requestId||responseMeta&&responseMeta.requestId||'',bodyChars:requestBody.length,responseChars:Number(responseDetail&&responseDetail.bodyChars)||0,error:failure});Log.debug('request.failed-details',{requestLogId:requestLogId,request:{headers:headersObject(headers),body:body},response:responseDetail});
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
    const key=LF.Storage.getApiKey(settings.provider);
    const provider=(LF.AIProviders&&LF.AIProviders[settings.provider])||{};
    if(!settings.endpoint||!settings.model)throw new Error('AI provider is not configured. Open Settings.');
    if(provider.keyRequired&&!key)throw new Error((provider.name||settings.provider)+' requires an API key. Open Settings.');
    const url=validateHttpUrl(resolveChatUrl(settings.endpoint));
    const headers={'Content-Type':'application/json','Accept':'application/json'};
    Object.keys(provider.headers||{}).forEach(function(name){headers[name]=String(provider.headers[name]);});
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
  function providerModelsUrl(provider,endpoint){return provider&&provider.modelsEndpoint?validateHttpUrl(provider.modelsEndpoint):resolveModelsUrl(endpoint);}


  function positiveInt(value){const n=Math.floor(Number(value));return Number.isFinite(n)&&n>0?n:null;}
  function capabilityValue(row,names){
    const places=[row,row&&row.capabilities,row&&row.limits,row&&row.metadata,row&&row.config,row&&row.parameters,row&&row.top_provider];
    for(const place of places){if(!place||typeof place!=='object')continue;for(const name of names){const value=positiveInt(place[name]);if(value)return value;}}
    return null;
  }
  function reasoningFromRow(row,source){
    if(!row||typeof row!=='object')return null;
    const capabilities=row.capabilities&&typeof row.capabilities==='object'?row.capabilities:{},raw=row.reasoning!=null?row.reasoning:capabilities.reasoning;
    if(raw===false)return{reasoningStatus:'none',reasoningAllowedOptions:['off'],reasoningDefault:'off'};
    if(raw===true)return{reasoningStatus:'optional',reasoningAllowedOptions:[],reasoningDefault:''};
    if(raw&&typeof raw==='object'){
      const rawAllowed=raw.supported_efforts||raw.allowed_options||raw.allowedOptions||[],allowed=Array.isArray(rawAllowed)?rawAllowed.map(function(x){return String(x).toLowerCase();}):[],mandatory=raw.mandatory===true,def=String(raw.default_effort||raw.default||'').toLowerCase();
      let status='optional';if(mandatory||(allowed.length&&!allowed.includes('off')&&!allowed.includes('none')))status='required';else if(allowed.length&&allowed.every(function(x){return x==='off'||x==='none';}))status='none';
      return{reasoningStatus:status,reasoningAllowedOptions:allowed,reasoningDefault:def};
    }
    const supported=Array.isArray(row.supported_parameters)?row.supported_parameters.map(function(x){return String(x).toLowerCase();}):[];
    if(supported.includes('reasoning')||supported.includes('reasoning_effort'))return{reasoningStatus:'optional',reasoningAllowedOptions:[],reasoningDefault:''};
    if(supported.length&&/openrouter/i.test(String(source||'')))return{reasoningStatus:'none',reasoningAllowedOptions:['off'],reasoningDefault:'off'};
    return null;
  }
  function capabilityFromRow(row,source){
    if(!row||typeof row!=='object')return null;
    const output=capabilityValue(row,['max_output_tokens','maxOutputTokens','output_token_limit','outputTokenLimit','max_completion_tokens','maxCompletionTokens','max_tokens_to_sample']);
    const context=capabilityValue(row,['context_length','contextLength','max_context_length','maxContextLength','context_window','contextWindow','input_token_limit','inputTokenLimit']);
    const reasoning=reasoningFromRow(row,source);
    if(!output&&!context&&!reasoning)return null;
    return Object.assign({maxOutputTokens:output,contextWindow:context,exactOutput:!!output,source:source||'provider metadata'},reasoning||{});
  }
  function knownCapability(providerId,model){
    const id=String(providerId||'').toLowerCase(),m=String(model||'').toLowerCase();
    if(id==='openai'){
      if(/^gpt-5-pro(?:[.-]|$)/.test(m))return{maxOutputTokens:128000,contextWindow:null,exactOutput:true,reasoningStatus:'required',reasoningAllowedOptions:['high'],reasoningDefault:'high',source:'OpenAI model specification'};
      if(/^gpt-5\.(?:[1-9]|\d{2,})(?:[.-]|$)/.test(m))return{maxOutputTokens:128000,contextWindow:null,exactOutput:true,reasoningStatus:'optional',reasoningAllowedOptions:['none','low','medium','high'],reasoningDefault:'none',source:'OpenAI model specification'};
      if(/^gpt-5(?:[.-]|$)/.test(m))return{maxOutputTokens:128000,contextWindow:null,exactOutput:true,reasoningStatus:'required',reasoningAllowedOptions:['minimal','low','medium','high'],reasoningDefault:'medium',source:'OpenAI model specification'};
      if(/^gpt-4\.1(?:[.-]|$)/.test(m))return{maxOutputTokens:32768,contextWindow:null,exactOutput:true,reasoningStatus:'none',reasoningAllowedOptions:['off'],reasoningDefault:'off',source:'OpenAI model specification'};
      if(/^gpt-4o(?:[.-]|$)/.test(m))return{maxOutputTokens:16384,contextWindow:null,exactOutput:true,reasoningStatus:'none',reasoningAllowedOptions:['off'],reasoningDefault:'off',source:'OpenAI model specification'};
      if(/^gpt-4(?:[.-]|$)/.test(m))return{maxOutputTokens:8192,contextWindow:null,exactOutput:true,reasoningStatus:'none',reasoningAllowedOptions:['off'],reasoningDefault:'off',source:'OpenAI model specification'};
      if(/^(?:o1|o3|o4-mini)(?:[.-]|$)/.test(m))return{maxOutputTokens:100000,contextWindow:null,exactOutput:true,reasoningStatus:'required',reasoningAllowedOptions:['low','medium','high'],reasoningDefault:'medium',source:'OpenAI model specification'};
    }
    if(id==='zai'){
      if(/^glm-4\.5(?:[.-]|$)/.test(m))return{maxOutputTokens:98304,contextWindow:null,exactOutput:true,reasoningStatus:'optional',reasoningAllowedOptions:['off','on'],reasoningDefault:'on',source:'Z.AI model specification'};
      if(/^glm-(?:4\.[6-9]|5)(?:[.-]|$)/.test(m))return{maxOutputTokens:131072,contextWindow:null,exactOutput:true,reasoningStatus:'optional',reasoningAllowedOptions:['off','on'],reasoningDefault:'on',source:'Z.AI model specification'};
    }
    return null;
  }
  function resolveThinkingPolicy(capability,actionMode,globalMode){
    capability=capability||{};actionMode=['off','on','auto'].includes(actionMode)?actionMode:'auto';globalMode=['off','on'].includes(globalMode)?globalMode:'auto';
    const requested=globalMode==='auto'?actionMode:globalMode,status=['none','optional','required'].includes(capability.reasoningStatus)?capability.reasoningStatus:'unknown';let transportMode=requested,effective=requested,reason='Action policy';
    if(status==='none'){transportMode='auto';effective='off';reason='Selected model is non-reasoning';}
    else if(status==='required'&&requested==='off'){transportMode='auto';effective='required';reason='Selected model requires reasoning';}
    else if(status==='unknown'&&requested!=='auto'){transportMode='auto';effective='unknown';reason='Model reasoning capability is unknown';}
    else if(requested==='auto'){transportMode='auto';effective=status==='required'?'required':(capability.reasoningDefault||'auto');reason='Model default';}
    if(globalMode!=='auto')reason='Global override · '+reason;
    return{actionMode:actionMode,globalMode:globalMode,requested:requested,transportMode:transportMode,effective:effective,capability:status,reason:reason};
  }
  const capabilityCache=new Map();
  function capabilityKey(providerId,endpoint,model){return[String(providerId||''),String(endpoint||''),String(model||'')].join('|');}
  function authHeaders(provider,key){const h={'Accept':'application/json'};if(key&&(provider.keyRequired||provider.optionalKey))h.Authorization='Bearer '+key;return h;}
  /** Metadata probes must never prevent the real connection request from starting. */
  async function metadataFetch(url,options){
    const controller=new AbortController(),timer=setTimeout(function(){controller.abort();},METADATA_TIMEOUT_MS);
    try{return await fetch(url,Object.assign({cache:'no-store',credentials:'omit'},options||{},{signal:controller.signal}));}
    catch(error){if(controller.signal.aborted){const timeout=new Error('Provider metadata request timed out after '+METADATA_TIMEOUT_MS+' ms.');timeout.timedOut=true;timeout.metadataOnly=true;timeout.cause=error;throw timeout;}throw error;}
    finally{clearTimeout(timer);}
  }
  async function fetchJson(url,options){const response=await metadataFetch(url,options),text=await response.text();if(!response.ok)throw parseProviderError(text,response.status,response.headers.get('x-request-id')||'',response.headers);try{return text?JSON.parse(text):{};}catch(error){const e=new Error('Provider capability metadata returned invalid JSON.');e.cause=error;e.providerResponse=text;throw e;}}
  function modelRows(obj){if(Array.isArray(obj))return obj;if(Array.isArray(obj&&obj.data))return obj.data;if(Array.isArray(obj&&obj.models))return obj.models;return[];}
  function matchingRow(obj,model){const rows=modelRows(obj),wanted=String(model||'');return rows.find(function(item){return String(item&&item.id||item&&item.model||item&&item.name||item&&item.key||'')===wanted;})||rows.find(function(item){const id=String(item&&item.id||item&&item.model||item&&item.name||item&&item.key||'');return id&&wanted&&(id.endsWith('/'+wanted)||wanted.endsWith('/'+id));})||null;}
  async function genericCapability(providerId,endpoint,model,provider,key){
    const url=providerModelsUrl(provider,endpoint),obj=await fetchJson(url,{method:'GET',headers:authHeaders(provider,key)}),row=matchingRow(obj,model);return capabilityFromRow(row,providerId==='openrouter'?'OpenRouter model metadata':'provider model metadata');
  }
  async function geminiCapability(model,key){
    if(!key)return null;const name=String(model||'').replace(/^models\//,'');if(!name)return null;
    const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(name)+'?key='+encodeURIComponent(key),obj=await fetchJson(url,{method:'GET',headers:{Accept:'application/json'}});
    const output=positiveInt(obj.outputTokenLimit),input=positiveInt(obj.inputTokenLimit);return output||input?{maxOutputTokens:output,contextWindow:input,exactOutput:!!output,source:'Gemini Models API'}:null;
  }
  async function ollamaCapability(endpoint,model){
    const chat=new URL(validateHttpUrl(resolveChatUrl(endpoint))),url=chat.origin+'/api/show',obj=await fetchJson(url,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({model:model})});
    let numPredict=null;if(typeof obj.parameters==='string'){const match=obj.parameters.match(/(?:^|\n)\s*num_predict\s+(-?\d+)/);if(match&&Number(match[1])>0)numPredict=positiveInt(match[1]);}
    if(!numPredict&&obj.parameters&&typeof obj.parameters==='object')numPredict=positiveInt(obj.parameters.num_predict);
    let context=null;Object.keys(obj.model_info||{}).some(function(k){if(/context_length$/i.test(k)){context=positiveInt(obj.model_info[k]);return !!context;}return false;});
    const features=Array.isArray(obj.capabilities)?obj.capabilities.map(function(x){return String(x).toLowerCase();}):[],reasoning=features.length?(features.includes('thinking')?{reasoningStatus:'optional',reasoningAllowedOptions:['none','low','medium','high'],reasoningDefault:'medium'}:{reasoningStatus:'none',reasoningAllowedOptions:['off'],reasoningDefault:'off'}):{};
    return numPredict||context||features.length?Object.assign({maxOutputTokens:numPredict,contextWindow:context,exactOutput:!!numPredict,source:numPredict?'Ollama num_predict':'Ollama model metadata'},reasoning):null;
  }
  async function lmStudioCapability(endpoint,model){
    const chat=new URL(validateHttpUrl(resolveChatUrl(endpoint))),urls=[chat.origin+'/api/v1/models',chat.origin+'/v1/models'];let obj=null,lastError=null;
    for(const url of urls){try{obj=await fetchJson(url,{method:'GET',headers:{Accept:'application/json'}});break;}catch(error){lastError=error;Log.debug('lmstudio.capability-candidate-failed',{url:url,error:error});}}
    if(!obj){if(lastError)throw lastError;return null;}
    const rows=modelRows(obj),requestedRow=matchingRow(obj,model),loadedRow=rows.find(function(item){return Array.isArray(item&&item.loaded_instances)&&item.loaded_instances.length;})||null,row=requestedRow||loadedRow||rows[0]||null;
    let cap=capabilityFromRow(row,'LM Studio model metadata');
    const activeRow=requestedRow&&Array.isArray(requestedRow.loaded_instances)&&requestedRow.loaded_instances.length?requestedRow:loadedRow;
    if(activeRow){
      const wanted=String(model||''),loaded=activeRow.loaded_instances.find(function(instance){const id=String(instance&&instance.id||'');return id===wanted||(id&&wanted&&(id.endsWith('/'+wanted)||wanted.endsWith('/'+id)));})||activeRow.loaded_instances[0],instance=capabilityFromRow(loaded,'LM Studio loaded instance context'),loadedModel=String(loaded&&loaded.id||activeRow.id||activeRow.model||activeRow.key||activeRow.name||'');
      const reasoning=activeRow&&activeRow.capabilities&&activeRow.capabilities.reasoning||{};
      const allowed=Array.isArray(reasoning.allowed_options)?reasoning.allowed_options.map(function(x){return String(x).toLowerCase();}):[],reasoningStatus=!reasoning||!Object.keys(reasoning).length?(cap&&cap.reasoningStatus||'unknown'):(allowed.length&&!allowed.includes('off')&&!allowed.includes('none')?'required':allowed.length&&allowed.every(function(x){return x==='off'||x==='none';})?'none':'optional');
      cap=Object.assign({},cap||{},instance||{},{loadedModel:loadedModel,maxOutputTokens:cap&&cap.maxOutputTokens||instance&&instance.maxOutputTokens||null,modelMaxContextWindow:cap&&cap.contextWindow||null,runtimeContextWindow:instance&&instance.contextWindow||null,reasoningStatus:reasoningStatus,reasoningAllowedOptions:allowed,reasoningDefault:String(reasoning.default||''),source:'LM Studio loaded instance context'});
    }
    return cap;
  }
  async function resolveModelCapabilities(options){
    options=options||{};const settings=LF.Storage.getAiSettings(),providerId=options.provider||settings.provider,endpoint=options.endpoint||settings.endpoint,model=options.model||settings.model,provider=(LF.AIProviders&&LF.AIProviders[providerId])||LF.AIProviders.custom||{},key=options.apiKey!=null?String(options.apiKey):LF.Storage.getApiKey(providerId),cacheKey=capabilityKey(providerId,endpoint,model);
    if(!options.force&&capabilityCache.has(cacheKey))return capabilityCache.get(cacheKey);
    const known=knownCapability(providerId,model);
    if(known&&!options.force){const immediate=Object.assign({provider:providerId,model:model,probeError:'',resolvedAt:Date.now()},known);capabilityCache.set(cacheKey,immediate);return immediate;}
    if(!options.force){const fallback={provider:providerId,model:model,maxOutputTokens:null,contextWindow:null,exactOutput:false,reasoningStatus:'unknown',reasoningAllowedOptions:[],reasoningDefault:'',source:'conservative fallback; run Detect for provider metadata',probeError:'',resolvedAt:Date.now()};capabilityCache.set(cacheKey,fallback);return fallback;}
    let detected=null,error=null;
    try{if(providerId==='gemini')detected=await geminiCapability(model,key);else if(providerId==='ollama')detected=await ollamaCapability(endpoint,model);else if(providerId==='lmstudio')detected=await lmStudioCapability(endpoint,model);else detected=await genericCapability(providerId,endpoint,model,provider,key);}catch(err){error=err;Log.warn('capability.probe-failed',{provider:providerId,model:model,error:err});}
    const cap=Object.assign({provider:providerId,model:model,maxOutputTokens:null,contextWindow:null,exactOutput:false,reasoningStatus:'unknown',reasoningAllowedOptions:[],reasoningDefault:'',source:'provider default',probeError:error?String(error.message||error):'',resolvedAt:Date.now()},known||{},detected||{});
    capabilityCache.set(cacheKey,cap);if(cap.loadedModel&&cap.loadedModel!==model)capabilityCache.set(capabilityKey(providerId,endpoint,cap.loadedModel),Object.assign({},cap,{model:cap.loadedModel}));Log.info('capability.resolved',{provider:providerId,model:model,loadedModel:cap.loadedModel||'',maxOutputTokens:cap.maxOutputTokens,contextWindow:cap.contextWindow,reasoningStatus:cap.reasoningStatus,reasoningAllowedOptions:cap.reasoningAllowedOptions||[],exactOutput:cap.exactOutput,source:cap.source});return cap;
  }
  function resolveOutputBudget(capability,requestedCap,globalCap,inputTokens){
    capability=capability||{};const candidates=[],detected=positiveInt(capability.maxOutputTokens),context=positiveInt(capability.contextWindow),input=Math.max(0,Number(inputTokens)||0);
    if(detected)candidates.push(detected);
    if(context)candidates.push(Math.max(16,context-input-512));
    const requested=positiveInt(requestedCap),forced=positiveInt(globalCap);if(requested)candidates.push(requested);if(forced)candidates.push(forced);
    return candidates.length?Math.max(16,Math.min.apply(Math,candidates)):null;
  }

  async function listModels(providerId,endpoint,apiKey){
    const settings=LF.Storage.getAiSettings(),provider=(LF.AIProviders&&LF.AIProviders[providerId||settings.provider])||{};
    const activeProviderId=providerId||settings.provider,key=apiKey!=null?String(apiKey):LF.Storage.getApiKey(activeProviderId),base=endpoint||settings.endpoint,headers={'Accept':'application/json'};
    Object.keys(provider.headers||{}).forEach(function(name){headers[name]=String(provider.headers[name]);});
    if(key&&(provider.keyRequired||provider.optionalKey))headers.Authorization='Bearer '+key;
    const started=performance.now(),chat=new URL(validateHttpUrl(resolveChatUrl(base))),origin=chat.origin,candidates=activeProviderId==='ollama'?[origin+'/api/tags',origin+'/v1/models']:activeProviderId==='lmstudio'?[origin+'/v1/models',origin+'/api/v1/models']:[providerModelsUrl(provider,base)];
    let lastError=null;
    for(const url of candidates){
      try{
        const response=await metadataFetch(url,{method:'GET',headers:headers}),text=await response.text();
        if(!response.ok)throw parseProviderError(text,response.status,response.headers.get('x-request-id')||'',response.headers);
        let obj={};try{obj=text?JSON.parse(text):{};}catch(error){const e=new Error('Model list returned invalid JSON.');e.cause=error;e.providerResponse=text;throw e;}
        const rows=Array.isArray(obj.data)?obj.data:Array.isArray(obj.models)?obj.models:[];
        const models=Array.from(new Set(rows.map(function(item){return typeof item==='string'?item:String(item&&item.id||item&&item.model||item&&item.name||item&&item.key||'');}).filter(Boolean)));
        if(models.length||candidates.length===1){Log.info('models.list',{provider:activeProviderId,count:models.length,url:url});return{models:models,elapsedMs:Math.round(performance.now()-started),url:url};}
      }catch(error){lastError=error;Log.debug('models.list-candidate-failed',{provider:activeProviderId,url:url,error:error});}
    }
    if(lastError)throw lastError;
    return{models:[],elapsedMs:Math.round(performance.now()-started),url:candidates[0]||''};
  }

  async function testConnection(options){
    options=options||{};const started=performance.now(),cfg=requestConfig(),hard=Math.max(5000,Math.min(30000,Number(cfg.provider.connectionTestTimeoutMs)||15000));
    const probe=connectionProbePolicy(cfg.provider);
    const spec=buildRequest({config:cfg,messages:[{role:'user',content:connectionTestPrompt()}],stream:false,maxTokens:probe.maxTokens,timeoutMs:hard,hardTimeoutMs:hard,temperature:0,thinkingMode:probe.thinkingMode,connectionTest:true});
    let r;
    try{r=await send(spec,{label:'AI connection test',connectionTest:true,onProgress:typeof options.onProgress==='function'?options.onProgress:undefined});}
    catch(err){
      if(!isRateLimitError(err))throw err;
      const elapsed=Math.round(performance.now()-started);
      Log.info('connection-test.timing',{provider:cfg.settings.provider,model:cfg.settings.model,result:'reachable-rate-limited',prepareMs:spec.prepareMs||0,pacingMs:0,totalMs:elapsed,httpRequests:1,retries:0});
      return{ok:false,reachable:true,rateLimited:true,elapsedMs:elapsed,requestElapsedMs:err.elapsedMs,model:cfg.settings.model,provider:cfg.settings.provider,thinkingMode:spec.thinkingMode||'auto',content:'',usage:null,finishReason:'',requestId:err.requestId||'',tokensPerSecond:null,responseBytes:0,streamed:false,rateLimitRetries:0,httpRequests:1};
    }
    if(!r.content)Log.warn('test.empty-content',{model:r.model||cfg.settings.model,finishReason:r.finishReason});
    Log.info('connection-test.timing',{provider:cfg.settings.provider,model:cfg.settings.model,result:'ok',prepareMs:r.prepareMs||0,pacingMs:r.pacingMs||0,requestMs:r.requestElapsedMs,totalMs:r.latencyMs,httpRequests:r.httpRequests||1,retries:0});
    return{ok:true,reachable:true,rateLimited:false,elapsedMs:r.latencyMs,prepareMs:r.prepareMs,pacingMs:r.pacingMs,responseHeadersMs:r.responseHeadersMs,requestElapsedMs:r.requestElapsedMs,finalizeMs:r.finalizeMs,model:r.model||cfg.settings.model,provider:r.provider||cfg.settings.provider,thinkingMode:r.thinkingMode||'auto',content:r.content,usage:r.usage||null,finishReason:r.finishReason||'',requestId:r.requestId,tokensPerSecond:r.tokensPerSecond,responseBytes:r.responseBytes,streamed:!!r.streamed,rateLimitRetries:0,httpRequests:r.httpRequests||1};
  }

  /**
   * Build the exact provider request. The caller (ActionRunner or Settings)
   * owns the already-assembled messages; this is transport only. Deep thinking
   * and temperature overrides for structured actions are explicit caller opts.
   */
  function buildRequest(opts){
    const prepareStarted=performance.now();opts=opts||{};
    const cfg=opts.config||requestConfig();
    if(opts.maxTokens!=null&&!(Number(opts.maxTokens)>0))throw new Error('AI output token budget must be a positive number when explicitly set.');
    const settings=cfg.settings,provider=cfg.provider;
    const model=opts.model||settings.model;
    const messages=Array.isArray(opts.messages)?opts.messages.filter(function(message){return message&&typeof message==='object'&&typeof message.role==='string'&&message.content!=null;}):[];
    if(!messages.length)throw new Error('Chat Completions requires at least one message. LabFlow stopped the request before contacting the provider.');
    const wantsStreaming=opts.stream!==false&&settings.streaming!==false&&provider.supportsStreaming!==false;
    const body={model:model,messages:messages,stream:wantsStreaming};
    if(wantsStreaming&&provider.supportsStreamUsage)body.stream_options={include_usage:true};
    const tokenParam=provider.tokenParam||'max_tokens';
    if(opts.maxTokens!=null)body[tokenParam]=Math.max(16,Math.floor(Number(opts.maxTokens)));
    if(provider.supportsTemperature!==false)body.temperature=Number.isFinite(Number(opts.temperature))?Number(opts.temperature):(Number.isFinite(Number(settings.temperature))?Number(settings.temperature):0.7);
    const thinking=applyThinkingMode(body,provider,opts.thinkingMode||settings.thinkingMode||'auto');
    if(opts.jsonSchema&&provider.supportsJsonSchema){const name=String(opts.jsonSchemaName||'labflow_output').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,64)||'labflow_output';body.response_format={type:'json_schema',json_schema:{name:name,strict:true,schema:opts.jsonSchema}};}else if(opts.jsonMode&&provider.supportsJsonMode)body.response_format={type:'json_object'};
    const providerTimeout=Math.max(5000,Number(provider.requestTimeoutMs)||90000);
    const timeoutMs=opts.connectionTest?Math.max(5000,Number(opts.timeoutMs)||15000):Math.max(Number(settings.inactivityTimeoutMs)||90000,providerTimeout,Math.max(0,Number(opts.timeoutMs)||0));
    const hardTimeoutMs=Math.max(0,Number(opts.hardTimeoutMs)||Number(provider.requestDeadlineMs)||0);
    const policy=Object.assign({},opts.thinkingPolicy||{requested:opts.thinkingMode||settings.thinkingMode||'auto',capability:'unknown',reason:'Direct request'},{applied:thinking.applied});
    return{url:cfg.url,headers:cfg.headers,body:body,timeoutMs:timeoutMs,hardTimeoutMs:hardTimeoutMs,provider:provider,settings:settings,model:model,thinkingMode:thinking.applied,thinkingPolicy:policy,prepareMs:Math.round(performance.now()-prepareStarted)};
  }

  async function send(spec,opts){
    opts=opts||{};const normalPolicy=ratePolicy(spec),policy=opts.connectionTest?Object.assign({},normalPolicy,{retries:0,minIntervalMs:0}):normalPolicy,overallStarted=performance.now(),hardTimeoutMs=Math.max(0,Number(spec.hardTimeoutMs)||0);let rateAttempt=0,r=null,pacingMs=0,httpRequests=0;
    while(true){
      const pacingStarted=performance.now(),state=await waitForRateSlot(spec,opts,overallStarted,hardTimeoutMs,policy);pacingMs+=performance.now()-pacingStarted;const elapsedBefore=performance.now()-overallStarted,remainingHard=hardTimeoutMs?Math.max(1,hardTimeoutMs-elapsedBefore):0;
      try{httpRequests++;r=await request(spec.url,spec.headers,spec.body,opts.label||'AI request',spec.timeoutMs,opts.onProgress,remainingHard);state.rateLimitCount=Math.max(0,(state.rateLimitCount||0)-1);state.nextAllowedAt=Math.max(0,state.nextAllowedAt||0);state.successCount=(state.successCount||0)+1;if(state.successCount>=3&&state.dynamicMinIntervalMs){state.dynamicMinIntervalMs=Math.max(0,Math.round(state.dynamicMinIntervalMs*.65)-100);state.successCount=0;}break;}
      catch(err){
        if(!isRateLimitError(err))throw err;
        const configured=policy.delaysMs[Math.min(rateAttempt,policy.delaysMs.length-1)]||5000,serverDelay=Math.max(0,Number(err.retryAfterMs)||0),penalty=Math.min(policy.maxDelayMs,Math.max(configured,serverDelay));
        state.rateLimitCount=(state.rateLimitCount||0)+1;state.successCount=0;state.dynamicMinIntervalMs=Math.min(policy.adaptiveMaxIntervalMs,Math.max(policy.adaptiveStepMs,(state.dynamicMinIntervalMs||0)*1.6,policy.adaptiveStepMs*Math.min(4,state.rateLimitCount)));state.nextAllowedAt=Math.max(state.nextAllowedAt||0,Date.now()+penalty);
        if(rateAttempt>=policy.retries){Log.warn('rate-limit.exhausted',{provider:policy.providerId,model:policy.model,retries:rateAttempt,dynamicIntervalMs:Math.round(state.dynamicMinIntervalMs),retryAfterMs:serverDelay||null});throw err;}rateAttempt++;
        Log.warn('rate-limit.backoff',{provider:policy.providerId,model:policy.model,providerCode:String(err.providerCode||''),status:Number(err.status||0),attempt:rateAttempt,maxAttempts:policy.retries,retryInMs:penalty,retryAfterMs:serverDelay||null,dynamicIntervalMs:Math.round(state.dynamicMinIntervalMs)});
        if(opts.onProgress)opts.onProgress({transportState:'rate_limit_wait',rateLimit:true,retryInMs:penalty,attempt:rateAttempt,maxAttempts:policy.retries,provider:policy.providerId,model:policy.model,providerCode:String(err.providerCode||''),status:Number(err.status||0)});
      }
    }
    const finalizeStarted=performance.now(),obj=r.json,extracted=extractAssistant(obj),usage=obj.usage||{};
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
    const finalizeMs=Math.round(performance.now()-finalizeStarted),totalElapsed=Math.round(performance.now()-overallStarted),roundedPacing=Math.round(pacingMs),tps=totalElapsed>0?Number((completionTokens/(totalElapsed/1000)).toFixed(2)):null;
    Log.info('request.timing',{provider:spec.settings.provider,model:obj.model||spec.settings.model,prepareMs:spec.prepareMs||0,pacingMs:roundedPacing,responseHeadersMs:r.responseHeadersMs,firstTokenMs:r.stream&&r.stream.ttftMs||null,requestMs:r.elapsedMs,finalizeMs:finalizeMs,totalMs:totalElapsed,retries:rateAttempt,httpRequests:httpRequests});
    return{content:content,reasoning:reasoning,model:obj.model||spec.settings.model,provider:spec.settings.provider,thinkingMode:spec.thinkingMode||'auto',thinkingPolicy:spec.thinkingPolicy||null,latencyMs:totalElapsed,prepareMs:spec.prepareMs||0,pacingMs:roundedPacing,responseHeadersMs:r.responseHeadersMs,finalizeMs:finalizeMs,httpRequests:httpRequests,requestElapsedMs:r.elapsedMs,ttftMs:r.stream&&r.stream.ttftMs||null,tokensPerSecond:tps,usage:{promptTokens:promptTokens,completionTokens:completionTokens,totalTokens:totalTokens,cachedTokens:usage.prompt_tokens_details&&usage.prompt_tokens_details.cached_tokens||null,estimated:!obj.usage},finishReason:extracted.finishReason,requestId:r.requestId,requestLogId:r.requestLogId,rawProviderResponse:r.rawText,streamed:!!r.stream,streamEvents:r.stream&&r.stream.events||0,meaningfulStreamEvents:r.stream&&r.stream.meaningfulEvents||0,responseBytes:r.stream&&r.stream.bytes||new TextEncoder().encode(r.rawText).byteLength,rateLimitRetries:rateAttempt};
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
    estimatePromptTokens:estimatePromptTokens,
    isLocalAddress:isLocalAddress,
    mergeStreamContent:mergeStreamContent,
    outputLoopDetected:outputLoopDetected,
    retryAfterMs:retryAfterMs,
    isRateLimitError:isRateLimitError,
    ratePolicy:ratePolicy,
    resolveModelsUrl:resolveModelsUrl,
    listModels:listModels,
    capabilityFromRow:capabilityFromRow,
    knownCapability:knownCapability,
    resolveModelCapabilities:resolveModelCapabilities,
    resolveOutputBudget:resolveOutputBudget,
    resolveThinkingPolicy:resolveThinkingPolicy,
    applyThinkingMode:applyThinkingMode,
    connectionProbePolicy:connectionProbePolicy,
    testConnection:testConnection
  };
}());
