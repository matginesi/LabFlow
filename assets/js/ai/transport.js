(function () {
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  const C=LF.Core;
  const Log=LF.Logger.scope('ai');
  let inFlight=false;
  let activeRequest=null;
  let injectedController=null;
  const METADATA_TIMEOUT_MS=5000;
  const STREAM_DIAGNOSTIC_CHARS=131072;

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

  function applyThinkingPromptGuard(messages,provider,mode,enabled){
    const rows=(messages||[]).map(function(message){return Object.assign({},message);});
    if(enabled!==true||mode!=='off'||!(provider&&provider.thinkingPromptGuard===true))return rows;
    const guard='OUTPUT MODE: Do not emit chain-of-thought, hidden reasoning, analysis, or <think> blocks. Produce only the final requested answer. For structured output, begin with the requested JSON immediately.';
    if(rows.length&&rows[0].role==='system')rows[0].content=String(rows[0].content||'').replace(/\s+$/,'')+'\n\n'+guard;
    else rows.unshift({role:'system',content:guard});
    return rows;
  }

  /** Keep connectivity boring: one tiny request, no capability discovery. */
  function connectionProbePolicy(provider){
    const configured=Math.max(8,Math.min(64,Number(provider&&provider.connectionTestMaxTokens)||16));
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
  function limitInfo(status,code,message){
    const c=String(code||''),m=String(message||'').toLowerCase(),http=Number(status)||0;
    const known={
      '1302':{limited:true,retryable:true,kind:'concurrency',label:'Provider concurrency limit reached'},
      '1303':{limited:true,retryable:true,kind:'frequency',label:'Provider request frequency limit reached'},
      '1304':{limited:true,retryable:false,kind:'daily_quota',label:'Provider daily quota exhausted'},
      '1305':{limited:true,retryable:true,kind:'rate_limit',label:'API rate limit reached'},
      '1308':{limited:true,retryable:false,kind:'usage_window',label:'Provider usage window exhausted'},
      '1310':{limited:true,retryable:false,kind:'plan_quota',label:'Provider plan quota exhausted'},
      '1312':{limited:true,retryable:true,kind:'model_capacity',label:'Provider model is temporarily busy'}
    };
    if(known[c])return known[c];
    if(http===429){
      if(/(?:quota|balance|credit|billing|daily|weekly|monthly|usage limit|plan limit|exhausted)/i.test(m))return{limited:true,retryable:false,kind:'quota',label:'Provider quota exhausted'};
      return{limited:true,retryable:true,kind:'rate_limit',label:'API rate limit reached'};
    }
    return{limited:false,retryable:false,kind:'',label:''};
  }
  function parseProviderError(text,status,requestId,headers){
    let code='',message='',providerType='';
    try{const obj=JSON.parse(text||'{}'),e=obj.error||obj;code=String(e.code||obj.code||'');message=String(e.message||obj.message||'');providerType=String(e.type||obj.type||'');}
    catch(_){message=String(text||'').replace(/\s+/g,' ').slice(0,420);}
    const overflow=contextOverflowDetails(text,message),effectiveStatus=Number(status)||overflow&&overflow.httpStatus||0;
    if(overflow){code='MODEL_CONTEXT_LENGTH';providerType=providerType||'exceed_context_size_error';}
    const limit=overflow?{limited:false,retryable:false,kind:'',label:''}:limitInfo(effectiveStatus,code,message);
    const label=overflow?'Model context exceeded':limit.limited?limit.label:effectiveStatus?'AI request failed ('+effectiveStatus+')':'AI request failed';
    const hint=LF.AIDiagnostics?LF.AIDiagnostics.statusHint(effectiveStatus,code,message):'';
    const err=new Error(label+(overflow&&overflow.promptTokens&&overflow.contextWindow?' · '+overflow.promptTokens+' input tokens > '+overflow.contextWindow+' context tokens':'')+(!overflow&&code?' · '+code:'')+(message?' · '+message:'')+hint);
    err.status=effectiveStatus;err.code=overflow?'MODEL_CONTEXT_LENGTH':'';err.providerCode=code;err.providerType=providerType;err.providerMessage=message;err.providerResponse=String(text||'').slice(0,12000);err.requestId=requestId||'';err.retryAfterMs=retryAfterMs(headers);err.isProvider=true;err.rateLimited=limit.limited;err.rateLimitKind=limit.kind;err.rateLimitRetryable=limit.retryable;
    if(overflow){err.promptTokens=overflow.promptTokens;err.contextWindow=overflow.contextWindow;err.isContextOverflow=true;}
    return err;
  }
  function isRateLimitError(err){if(!err)return false;if(err.rateLimited===true)return true;return limitInfo(err.status,err.providerCode,err.providerMessage||err.message).limited;}

  function headersObject(headers){
    const out={};
    if(headers&&typeof headers.forEach==='function')headers.forEach(function(value,key){out[key]=value;});
    else Object.keys(headers||{}).forEach(function(key){out[key]=headers[key];});
    return out;
  }

  function providerAuthHeaders(provider,key){
    const h={'Accept':'application/json'};
    Object.keys(provider.headers||{}).forEach(function(name){h[name]=String(provider.headers[name]);});
    if(key&&(provider.keyRequired||provider.optionalKey))h.Authorization='Bearer '+key;
    return h;
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

  function reasoningControlUrl(chatUrl){return String(chatUrl||'').replace(/\/chat\/completions\/?$/i,'/chat/completions/control');}
  async function sendReasoningEnd(chatUrl,headers,requestId,model,signal){
    const url=reasoningControlUrl(chatUrl),body={id:String(requestId||''),action:'reasoning_end'};if(model)body.model=model;
    if(!body.id)return{ok:false,status:0,message:'request id unavailable'};
    try{
      const response=await fetch(url,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},headers||{}),body:JSON.stringify(body),signal:signal,cache:'no-store',credentials:'omit'}),text=await response.text();
      let parsed={};try{parsed=text?JSON.parse(text):{};}catch(_){}
      const ok=!!(response.ok&&parsed.success!==false);
      Log[ok?'info':'warn']('thinking.control',{requestId:body.id,model:model||'',action:'reasoning_end',status:response.status,ok:ok,message:String(parsed.message||'')});
      return{ok:ok,status:response.status,message:String(parsed.message||'')};
    }catch(error){Log.warn('thinking.control-failed',{requestId:body.id,model:model||'',error:error});return{ok:false,status:0,message:String(error&&error.message||error)};}
  }

  /** Consume one OpenAI-compatible SSE response in the active request. */
  async function readEventStream(response,onBytes,onProgress,onMeaningful,startedAt,budgetTokens,onReasoning){
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
      state.model=obj.model||state.model;state.requestId=obj.request_id||obj.id||state.requestId;
      const meaningful=!!(content||reasoning||choice.finish_reason||obj.usage);
      if((content||reasoning)&&state.ttftMs==null)state.ttftMs=Math.round(performance.now()-started);
      state.content=mergeStreamContent(state.content,content);state.reasoning=mergeStreamContent(state.reasoning,reasoning);state.finishReason=choice.finish_reason||state.finishReason;
      if(reasoning&&onReasoning)onReasoning({requestId:state.requestId,model:state.model,reasoning:reasoning,totalReasoning:state.reasoning});
      if(meaningful){state.meaningfulEvents++;if(onMeaningful)onMeaningful();}
      if(outputLoopDetected(state.content)||outputLoopDetected(state.reasoning)){const repeated=outputLoopDetected(state.content)?state.content:state.reasoning,loop=new Error('The model entered a repeated-output loop. The checkpoint was stopped before storing duplicated content.');loop.code='MODEL_OUTPUT_LOOP';loop.providerResponse=repeated.slice(-12000);throw loop;}
      const charGuard=budgetTokens?Math.max(24000,Number(budgetTokens)*8):4000000;if(state.content.length+state.reasoning.length>charGuard){const limit=new Error('Provider output exceeded the bounded work-unit size before completion.');limit.code='MODEL_OUTPUT_LIMIT_GUARD';limit.providerResponse=(state.content||state.reasoning).slice(-12000);throw limit;}
      state.usage=obj.usage||state.usage;state.events++;
      if(onProgress){const elapsedMs=Math.round(performance.now()-started),reported=state.usage&&Number.isFinite(Number(state.usage.completion_tokens))?Number(state.usage.completion_tokens):null,tokens=reported==null?estimateTokens(state.content+state.reasoning):reported,generationMs=state.ttftMs==null?0:Math.max(0,elapsedMs-state.ttftMs),rate=generationMs>=100?tokens/(generationMs/1000):null;onProgress({content:state.content,reasoning:state.reasoning,finishReason:state.finishReason,usage:state.usage,events:state.events,meaningfulEvents:state.meaningfulEvents,bytes:state.bytes,ttftMs:state.ttftMs,elapsedMs:elapsedMs,generationMs:generationMs,tokens:tokens,rate:Number.isFinite(rate)?rate:null,estimated:reported==null,budgetTokens:budgetTokens||null});}
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
        const text=decoder.decode(part.value,{stream:true});onBytes(text);raw=(raw+text).slice(-STREAM_DIAGNOSTIC_CHARS);buffer+=text;
        if(consume(false)){try{Promise.resolve(reader.cancel()).catch(function(){});}catch(_){}break;}
      }
      const tail=decoder.decode();if(tail){raw=(raw+tail).slice(-STREAM_DIAGNOSTIC_CHARS);buffer+=tail;}if(!state.done)consume(true);
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
      let text='',obj=null,streamMeta=null,reasoningControlPromise=null,reasoningControlRequests=0,reasoningControlResult=null,reasoningControlTriggered=false;
      responseMeta={status:response.status,statusText:response.statusText,ok:response.ok,headers:headersObject(response.headers),body:null,bodyChars:0,requestId:response.headers.get('x-request-id')||response.headers.get('request-id')||'',stream:null};
      function stopReasoning(info){
        if(body.reasoning_control!==true||reasoningControlTriggered||!info||!info.requestId)return;
        reasoningControlTriggered=true;reasoningControlRequests=1;
        Log.warn('thinking.observed-while-off',{requestId:info.requestId,model:info.model||body.model,reasoningChars:String(info.totalReasoning||'').length,control:'reasoning_end'});
        reasoningControlPromise=sendReasoningEnd(url,headers,info.requestId,info.model||body.model,controller.signal).then(function(result){reasoningControlResult=result;return result;});
      }
      if(response.ok&&body.stream&&contentType.indexOf('text/event-stream')>=0){const streamed=await readEventStream(response,function(chunk){requestState.partialRaw=(requestState.partialRaw+chunk).slice(-STREAM_DIAGNOSTIC_CHARS);},onProgress,resetInactivity,started,positiveInt(body.max_completion_tokens||body.max_tokens||body.max_output_tokens),stopReasoning);text=streamed.rawText;obj=streamed.json;streamMeta=streamed.stream;if(reasoningControlPromise)await reasoningControlPromise;}
      else{text=await response.text();resetInactivity();}
      const elapsed=Math.round(performance.now()-started);
      const responseRequestId=response.headers.get('x-request-id')||response.headers.get('request-id')||'';
      responseMeta={status:response.status,statusText:response.statusText,ok:response.ok,headers:headersObject(response.headers),body:text,bodyChars:text.length,requestId:responseRequestId,stream:streamMeta?{events:streamMeta.events,meaningfulEvents:streamMeta.meaningfulEvents,bytes:streamMeta.bytes,ttftMs:streamMeta.ttftMs,finishReason:streamMeta.finishReason,reasoningControlRequests:reasoningControlRequests,reasoningControlOk:reasoningControlResult&&reasoningControlResult.ok===true}:null};
      Log.info('request.end',{requestLogId:requestLogId,label:label,status:response.status,ok:response.ok,elapsedMs:elapsed,responseHeadersMs:responseHeadersMs,bodyChars:text.length,requestId:responseRequestId,stream:responseMeta.stream});Log.debug('response.payload',{requestLogId:requestLogId,status:response.status,body:text.length>12000?text.slice(0,12000)+'…':text});
      if(!response.ok)throw parseProviderError(text,response.status,responseRequestId,response.headers);
      if(!obj)try{obj=text?JSON.parse(text):{};}catch(parseError){const invalid=new Error('Provider returned invalid JSON.');invalid.cause=parseError;invalid.status=response.status;invalid.requestId=responseRequestId;invalid.providerResponse=text;throw invalid;}
      Log.debug('response.parsed',{requestLogId:requestLogId,requestId:responseRequestId||obj.request_id||obj.id||'',model:obj.model||body.model,transport:streamMeta?'sse':'json',stream:streamMeta?{events:streamMeta.events,meaningfulEvents:streamMeta.meaningfulEvents,bytes:streamMeta.bytes,ttftMs:streamMeta.ttftMs}:null,usage:obj.usage||null,finishReason:obj.choices&&obj.choices[0]&&obj.choices[0].finish_reason||obj.finish_reason||'',responseKeys:Object.keys(obj||{})});
      return{json:obj,elapsedMs:elapsed,responseHeadersMs:responseHeadersMs,requestId:response.headers.get('x-request-id')||response.headers.get('request-id')||obj.request_id||obj.id||'',requestLogId:requestLogId,rawText:text,stream:streamMeta,reasoningControlRequests:reasoningControlRequests,reasoningControlResult:reasoningControlResult};
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
      const failureLog={requestLogId:requestLogId,label:label,endpoint:url,model:body.model,elapsedMs:elapsed,timeoutMs:limit,hardTimeoutMs:hardLimit||null,status:failure&&failure.status||responseMeta&&responseMeta.status||0,providerCode:failure&&failure.providerCode||'',providerMessage:failure&&failure.providerMessage||'',requestId:failure&&failure.requestId||responseMeta&&responseMeta.requestId||'',bodyChars:requestBody.length,responseChars:Number(responseDetail&&responseDetail.bodyChars)||0,error:failure};
      if(isRateLimitError(failure))Log.warn('request.rate-limited',failureLog);else Log.error('request.failed',failureLog);Log.debug('request.failed-details',{requestLogId:requestLogId,request:{headers:headersObject(headers),body:body},response:responseDetail});
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

  // Unified helper: same header/auth construction for chat, models and capability probes
  function requestConfig(){
    const settings=LF.Storage.getAiSettings();
    const key=LF.Storage.getApiKey(settings.provider);
    const provider=(LF.AIProviders&&LF.AIProviders[settings.provider])||{};
    if(!settings.endpoint||!settings.model)throw new Error('AI provider is not configured. Open Settings.');
    if(provider.keyRequired&&!key)throw new Error((provider.name||settings.provider)+' requires an API key. Open Settings.');
    const url=validateHttpUrl(resolveChatUrl(settings.endpoint));
    const baseHeaders=providerAuthHeaders(provider,key);
    const headers=Object.assign({'Content-Type':'application/json'},baseHeaders);
    // Avoid duplicating auth header construction; providerAuthHeaders is the single source
    return{settings:settings,provider:provider,url:url,headers:headers};
  }

  /** Build an isolated config for local diagnostics without depending on saved streaming choices. */
  function diagnosticRequestConfig(providerId,endpoint,model,apiKey){
    const saved=LF.Storage.getAiSettings(),provider=(LF.AIProviders&&LF.AIProviders[providerId])||{};
    const key=apiKey!=null?String(apiKey):LF.Storage.getApiKey(providerId);
    const settings=Object.assign({},saved,{provider:providerId,endpoint:String(endpoint||saved.endpoint||''),model:String(model||saved.model||''),streaming:true,thinkingMode:'off'});
    if(!settings.endpoint||!settings.model)throw new Error('AI provider is not configured. Open Settings.');
    if(provider.keyRequired&&!key)throw new Error((provider.name||providerId)+' requires an API key. Open Settings.');
    return{settings:settings,provider:provider,url:validateHttpUrl(resolveChatUrl(settings.endpoint)),headers:Object.assign({'Content-Type':'application/json'},providerAuthHeaders(provider,key))};
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
      if(/^glm-4\.7-flash(?:x)?(?:[.-]|$)/.test(m))return{maxOutputTokens:null,contextWindow:200000,exactOutput:false,reasoningStatus:'optional',reasoningAllowedOptions:['off','on'],reasoningDefault:'on',source:'Z.AI model specification · output maximum not assumed'};
      if(/^glm-4\.5(?:[.-]|$)/.test(m))return{maxOutputTokens:98304,contextWindow:200000,exactOutput:true,reasoningStatus:'optional',reasoningAllowedOptions:['off','on'],reasoningDefault:'on',source:'Z.AI model specification'};
      if(/^glm-(?:4\.[6-9]|5)(?:[.-]|$)/.test(m))return{maxOutputTokens:131072,contextWindow:200000,exactOutput:true,reasoningStatus:'optional',reasoningAllowedOptions:['off','on'],reasoningDefault:'on',source:'Z.AI model specification'};
    }
    return null;
  }
  function resolveThinkingPolicy(capability,actionMode,globalMode,provider){
    capability=capability||{};provider=provider||{};actionMode=['off','on','auto'].includes(actionMode)?actionMode:'auto';globalMode=['off','on'].includes(globalMode)?globalMode:'auto';
    const requested=globalMode==='auto'?actionMode:globalMode,status=['none','optional','required'].includes(capability.reasoningStatus)?capability.reasoningStatus:'unknown',safeUnknown=provider.safeThinkingOverrideWhenUnknown===true&&provider.thinkingModes&&provider.thinkingModes[requested];let transportMode=requested,effective=requested,reason='Action policy';
    if(status==='none'){transportMode='auto';effective='off';reason='Selected model is non-reasoning';}
    else if(status==='required'&&requested==='off'){transportMode='auto';effective='required';reason='Selected model requires reasoning';}
    else if(status==='unknown'&&requested!=='auto'&&!safeUnknown){transportMode='auto';effective='unknown';reason='Model reasoning capability is unknown';}
    else if(status==='unknown'&&requested!=='auto'&&safeUnknown){transportMode=requested;effective=requested;reason='Provider supports an explicit reasoning override even though model metadata does not expose reasoning capability';}
    else if(requested==='auto'){transportMode='auto';effective=status==='required'?'required':(capability.reasoningDefault||'auto');reason='Model default';}
    if(globalMode!=='auto')reason='Global override · '+reason;
    return{actionMode:actionMode,globalMode:globalMode,requested:requested,transportMode:transportMode,effective:effective,capability:status,reason:reason};
  }
  const capabilityCache=new Map();
  function capabilityKey(providerId,endpoint,model){return[String(providerId||''),String(endpoint||''),String(model||'')].join('|');}
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
    const url=providerModelsUrl(provider,endpoint),obj=await fetchJson(url,{method:'GET',headers:providerAuthHeaders(provider,key)}),row=matchingRow(obj,model);return capabilityFromRow(row,providerId==='openrouter'?'OpenRouter model metadata':'provider model metadata');
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
  async function llamaCppCapability(endpoint,model,provider){
    const chat=new URL(validateHttpUrl(resolveChatUrl(endpoint))),url=new URL(chat.origin+'/props');if(model)url.searchParams.set('model',model);
    const obj=await fetchJson(url.toString(),{method:'GET',headers:{Accept:'application/json'}}),defaults=obj&&obj.default_generation_settings||{},params=defaults&&defaults.params||{},context=positiveInt(defaults.n_ctx),maxOutput=positiveInt(params.max_tokens),slots=positiveInt(obj.total_slots),caps=obj&&obj.chat_template_caps&&typeof obj.chat_template_caps==='object'?obj.chat_template_caps:{},recommended=provider&&provider.recommendedRuntime&&typeof provider.recommendedRuntime==='object'?provider.recommendedRuntime:{},recommendedSlots=positiveInt(recommended.parallelSlots)||1,recommendedContext=positiveInt(recommended.contextWindow)||65536;
    const supportsEffort=caps.supports_reasoning_effort===true||caps.reasoning_effort===true,reasoning=supportsEffort?{reasoningStatus:'optional',reasoningAllowedOptions:['off','low','medium','high'],reasoningDefault:'auto'}:{};
    let runtimeProfileStatus='unknown',runtimeProfileMessage='llama.cpp runtime profile not fully exposed';
    if(slots&&context){
      if(slots===recommendedSlots&&context===recommendedContext){runtimeProfileStatus='match';runtimeProfileMessage='LabFlow llama.cpp profile active · '+slots+' slot · '+context.toLocaleString()+' context tok';}
      else{runtimeProfileStatus='mismatch';const issues=[];if(slots!==recommendedSlots)issues.push('expected --parallel '+recommendedSlots+', detected '+slots+' slot'+(slots===1?'':'s'));if(context!==recommendedContext)issues.push('expected -c '+recommendedContext+', detected '+context.toLocaleString()+' context tok per slot');runtimeProfileMessage='Different llama.cpp runtime profile · '+issues.join(' · ');}
    }
    return Object.assign({maxOutputTokens:maxOutput,contextWindow:context,exactOutput:!!maxOutput,runtimeContextWindow:context,totalSlots:slots,recommendedSlots:recommendedSlots,recommendedContextWindow:recommendedContext,runtimeProfileStatus:runtimeProfileStatus,runtimeProfileMessage:runtimeProfileMessage,source:'llama.cpp /props'},reasoning);
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
    try{if(provider.remoteModelMetadata===false)detected=null;else if(providerId==='gemini')detected=await geminiCapability(model,key);else if(providerId==='ollama')detected=await ollamaCapability(endpoint,model);else if(providerId==='lmstudio')detected=await lmStudioCapability(endpoint,model);else if(providerId==='llamacpp')detected=await llamaCppCapability(endpoint,model,provider);else detected=await genericCapability(providerId,endpoint,model,provider,key);}catch(err){error=err;Log.warn('capability.probe-failed',{provider:providerId,model:model,error:err});}
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

  function modelId(item){return typeof item==='string'?item:String(item&&item.id||item&&item.model||item&&item.name||item&&item.key||'');}
  function uniqueModels(rows){return Array.from(new Set((rows||[]).map(modelId).filter(Boolean)));}
  function lmStudioLlmRows(obj){return modelRows(obj).filter(function(item){return !item||!item.type||String(item.type).toLowerCase()==='llm';});}
  function lmStudioLoadedModels(rows){const out=[];(rows||[]).forEach(function(row){const instances=Array.isArray(row&&row.loaded_instances)?row.loaded_instances:[];if(!instances.length)return;const rowId=modelId(row);const explicit=instances.map(function(instance){return String(instance&&instance.model_key||instance&&instance.model_id||instance&&instance.model||'').trim();}).filter(Boolean);const candidates=explicit.length?explicit:(rowId?[rowId]:[]);candidates.forEach(function(id){if(id&&!out.includes(id))out.push(id);});});return out;}

  async function listModels(providerId,endpoint,apiKey){
    const settings=LF.Storage.getAiSettings(),provider=(LF.AIProviders&&LF.AIProviders[providerId||settings.provider])||{};
    const activeProviderId=providerId||settings.provider,key=apiKey!=null?String(apiKey):LF.Storage.getApiKey(activeProviderId),base=endpoint||settings.endpoint,headers=providerAuthHeaders(provider,key);
    const started=performance.now();
    if(provider.remoteModelMetadata===false){
      Log.info('models.list',{provider:activeProviderId,count:0,loaded:0,skipped:true,reason:'configured-model-only'});
      return{models:[],loadedModels:[],elapsedMs:Math.round(performance.now()-started),url:'',source:'configured model · built-in capability metadata',skipped:true};
    }
    const chat=new URL(validateHttpUrl(resolveChatUrl(base))),origin=chat.origin;

    async function read(url){return{obj:await fetchJson(url,{method:'GET',headers:headers}),url:url};}

    if(activeProviderId==='lmstudio'){
      const nativeUrl=origin+'/api/v1/models';
      try{
        const native=await read(nativeUrl),rows=lmStudioLlmRows(native.obj),models=uniqueModels(rows),loadedModels=lmStudioLoadedModels(rows);
        Log.info('models.list',{provider:activeProviderId,count:models.length,loaded:loadedModels.length,url:nativeUrl});
        return{models:models,loadedModels:loadedModels,elapsedMs:Math.round(performance.now()-started),url:nativeUrl,source:'LM Studio native API'};
      }catch(nativeError){
        Log.debug('models.list-candidate-failed',{provider:activeProviderId,url:nativeUrl,error:nativeError});
        const fallbackUrl=origin+'/v1/models',fallback=await read(fallbackUrl),models=uniqueModels(modelRows(fallback.obj));
        Log.info('models.list',{provider:activeProviderId,count:models.length,loaded:0,url:fallbackUrl,fallback:true});
        return{models:models,loadedModels:[],elapsedMs:Math.round(performance.now()-started),url:fallbackUrl,source:'LM Studio OpenAI-compatible fallback'};
      }
    }

    if(activeProviderId==='ollama'){
      let catalogue=null,source='',url=origin+'/api/tags',lastError=null;
      try{catalogue=await read(url);source='Ollama /api/tags';}
      catch(error){lastError=error;Log.debug('models.list-candidate-failed',{provider:activeProviderId,url:url,error:error});url=origin+'/v1/models';try{catalogue=await read(url);source='Ollama OpenAI-compatible fallback';}catch(fallbackError){fallbackError.cause=fallbackError.cause||lastError;throw fallbackError;}}
      const models=uniqueModels(modelRows(catalogue.obj));
      let loadedModels=[];
      try{const running=await read(origin+'/api/ps');loadedModels=uniqueModels(modelRows(running.obj));}
      catch(error){Log.debug('models.running-unavailable',{provider:activeProviderId,url:origin+'/api/ps',error:error});}
      Log.info('models.list',{provider:activeProviderId,count:models.length,loaded:loadedModels.length,url:url});
      return{models:models,loadedModels:loadedModels,elapsedMs:Math.round(performance.now()-started),url:url,source:source};
    }

    const url=providerModelsUrl(provider,base),result=await read(url),models=uniqueModels(modelRows(result.obj)),loadedModels=activeProviderId==='llamacpp'?models.slice():[];
    Log.info('models.list',{provider:activeProviderId,count:models.length,loaded:loadedModels.length,url:url});
    return{models:models,loadedModels:loadedModels,elapsedMs:Math.round(performance.now()-started),url:url,source:'provider model catalogue'};
  }

  /**
   * Measure short-run generation throughput for a local model. One warm-up is
   * intentionally excluded from the arithmetic mean. Detect uses this only for
   * LM Studio, Ollama and llama.cpp so cloud metadata inspection stays request-free.
   */
  async function benchmarkTokensPerSecond(options){
    options=options||{};
    const providerId=String(options.provider||LF.Storage.getAiSettings().provider||''),provider=(LF.AIProviders&&LF.AIProviders[providerId])||{};
    if(provider.local!==true)return{supported:false,provider:providerId,reason:'local-providers-only',samples:[],averageTokensPerSecond:null};
    const cfg=diagnosticRequestConfig(providerId,options.endpoint,options.model,options.apiKey),model=cfg.settings.model;
    const sampleCount=Math.max(2,Math.min(5,Math.floor(Number(options.samples)||3))),sampleTokens=Math.max(32,Math.min(128,Math.floor(Number(options.maxTokens)||64))),warmupTokens=Math.max(16,Math.min(32,Math.floor(Number(options.warmupTokens)||24)));
    const timeoutMs=Math.max(15000,Math.min(120000,Math.floor(Number(options.timeoutMs)||60000)));
    const prompt='Generate a continuous sequence of short lowercase words separated by spaces until the output limit is reached. Output words only. Do not explain, number, format, or stop early.';
    async function run(maxTokens,label){
      const spec=buildRequest({config:cfg,messages:[{role:'user',content:prompt}],stream:options.stream!==false,maxTokens:maxTokens,timeoutMs:timeoutMs,hardTimeoutMs:timeoutMs,temperature:0,thinkingMode:'off',guardThinking:true});
      try{return await send(spec,{label:label});}
      catch(err){
        /* Throughput measures generated tokens, not answer quality. A model that
           spends the tiny benchmark budget entirely in parsed reasoning is still
           measurable and should not make Detect fail. */
        if(err&&err.code==='MODEL_OUTPUT_TRUNCATED'&&Number(err.tokensPerSecond)>0)return{content:'',reasoning:String(err.reasoning||''),model:err.model||model,provider:providerId,thinkingMode:'off',latencyMs:Number(err.elapsedMs)||0,requestElapsedMs:Number(err.requestElapsedMs)||Number(err.elapsedMs)||0,generationMs:Number(err.generationMs)||0,ttftMs:Number.isFinite(Number(err.ttftMs))?Number(err.ttftMs):null,tokensPerSecond:Number(err.tokensPerSecond),usage:err.usage||null,finishReason:err.finishReason||'length',requestId:err.requestId||'',streamed:options.stream!==false,reasoningOnly:true};
        throw err;
      }
    }
    const started=performance.now(),warmup=await run(warmupTokens,'Local model throughput warm-up'),samples=[];
    for(let i=0;i<sampleCount;i++){
      const result=await run(sampleTokens,'Local model throughput sample '+(i+1)+'/'+sampleCount),rate=Number(result.tokensPerSecond);
      if(Number.isFinite(rate)&&rate>0)samples.push({index:i+1,tokensPerSecond:rate,completionTokens:result.usage&&Number(result.usage.completionTokens)||null,generationMs:Number(result.generationMs)||null,ttftMs:Number.isFinite(Number(result.ttftMs))?Number(result.ttftMs):null,estimated:!!(result.usage&&result.usage.estimated)});
    }
    if(samples.length<2)throw new Error('Local throughput benchmark did not return enough measurable samples.');
    const rates=samples.map(function(item){return item.tokensPerSecond;}),average=Number((rates.reduce(function(sum,value){return sum+value;},0)/rates.length).toFixed(2)),minimum=Number(Math.min.apply(Math,rates).toFixed(2)),maximum=Number(Math.max.apply(Math,rates).toFixed(2)),estimated=samples.some(function(item){return item.estimated;});
    const result={supported:true,provider:providerId,model:model,sampleCount:samples.length,warmupTokens:warmup.usage&&Number(warmup.usage.completionTokens)||null,sampleTokenLimit:sampleTokens,averageTokensPerSecond:average,minTokensPerSecond:minimum,maxTokensPerSecond:maximum,estimated:estimated,samples:samples,elapsedMs:Math.round(performance.now()-started),measuredAt:Date.now()};
    const key=capabilityKey(providerId,cfg.settings.endpoint,model),cached=capabilityCache.get(key);if(cached){cached.averageTokensPerSecond=average;cached.throughputBenchmark=result;}
    Log.info('benchmark.completed',{provider:providerId,model:model,averageTokensPerSecond:average,minTokensPerSecond:minimum,maxTokensPerSecond:maximum,samples:samples.map(function(item){return item.tokensPerSecond;}),elapsedMs:result.elapsedMs});
    return result;
  }

  async function testConnection(options){
    options=options||{};const started=performance.now(),cfg=requestConfig(),hard=Math.max(5000,Math.min(30000,Number(cfg.provider.connectionTestTimeoutMs)||15000));
    const probe=connectionProbePolicy(cfg.provider);
    const spec=buildRequest({config:cfg,messages:[{role:'user',content:connectionTestPrompt()}],stream:false,maxTokens:probe.maxTokens,timeoutMs:hard,hardTimeoutMs:hard,temperature:0,thinkingMode:probe.thinkingMode,guardThinking:probe.thinkingMode==='off',connectionTest:true});
    let r;
    try{r=await send(spec,{label:'AI connection test',connectionTest:true,onProgress:typeof options.onProgress==='function'?options.onProgress:undefined});}
    catch(err){
      /* A reasoning model may legitimately consume the deliberately tiny probe
         budget before emitting final text. For providers that opt in to this
         policy, HTTP 200 + a valid Chat Completions envelope still proves that
         endpoint, model selection and request parsing are working. Keep normal
         Actions strict: only the Settings connection probe gets this soft-pass. */
      if(err&&err.isContract&&Number(err.status)===200&&cfg.provider.connectionTestAcceptReasoningOnly===true){
        const elapsed=Math.round(performance.now()-started),raw=String(err.rawProviderResponse||''),reasoning=String(err.reasoning||'');
        Log.info('connection-test.timing',{provider:cfg.settings.provider,model:cfg.settings.model,result:'reachable-reasoning-only',prepareMs:spec.prepareMs||0,requestMs:Number(err.elapsedMs)||elapsed,totalMs:elapsed,httpRequests:1,finishReason:err.finishReason||'',reasoningChars:reasoning.length});
        return{ok:true,reachable:true,rateLimited:false,probeLimited:true,finalTextVerified:false,reasoningObserved:!!reasoning,elapsedMs:elapsed,prepareMs:spec.prepareMs||0,requestElapsedMs:Number(err.elapsedMs)||elapsed,model:err.model||cfg.settings.model,provider:cfg.settings.provider,thinkingMode:spec.thinkingMode||'auto',content:'',reasoning:reasoning,usage:err.usage||null,finishReason:err.finishReason||'',requestId:err.requestId||'',tokensPerSecond:null,responseBytes:raw?new TextEncoder().encode(raw).byteLength:0,streamed:false,httpRequests:1};
      }
      if(!isRateLimitError(err))throw err;
      const elapsed=Math.round(performance.now()-started),retryMs=Math.max(0,Number(err.retryAfterMs)||0);
      Log.info('connection-test.timing',{provider:cfg.settings.provider,model:cfg.settings.model,result:'reachable-rate-limited',prepareMs:spec.prepareMs||0,totalMs:elapsed,httpRequests:1,retryAfterMs:retryMs||null});
      return{ok:false,reachable:true,rateLimited:true,retryAfterMs:retryMs,providerCode:String(err.providerCode||''),providerMessage:String(err.providerMessage||''),status:Number(err.status)||429,elapsedMs:elapsed,requestElapsedMs:err.elapsedMs,model:cfg.settings.model,provider:cfg.settings.provider,thinkingMode:spec.thinkingMode||'auto',content:'',usage:null,finishReason:'',requestId:err.requestId||'',tokensPerSecond:null,responseBytes:0,streamed:false,httpRequests:1};
    }
    if(!r.content)Log.warn('test.empty-content',{model:r.model||cfg.settings.model,finishReason:r.finishReason});
    Log.info('connection-test.timing',{provider:cfg.settings.provider,model:cfg.settings.model,result:'ok',prepareMs:r.prepareMs||0,requestMs:r.requestElapsedMs,totalMs:r.latencyMs,httpRequests:r.httpRequests||1});
    return{ok:true,reachable:true,rateLimited:false,elapsedMs:r.latencyMs,prepareMs:r.prepareMs,responseHeadersMs:r.responseHeadersMs,requestElapsedMs:r.requestElapsedMs,finalizeMs:r.finalizeMs,model:r.model||cfg.settings.model,provider:r.provider||cfg.settings.provider,thinkingMode:r.thinkingMode||'auto',content:r.content,usage:r.usage||null,finishReason:r.finishReason||'',requestId:r.requestId,tokensPerSecond:r.tokensPerSecond,responseBytes:r.responseBytes,streamed:!!r.streamed,httpRequests:r.httpRequests||1};
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
    const rawMessages=Array.isArray(opts.messages)?opts.messages.filter(function(message){return message&&typeof message==='object'&&typeof message.role==='string'&&message.content!=null;}):[];
    if(!rawMessages.length)throw new Error('Chat Completions requires at least one message. LabFlow stopped the request before contacting the provider.');
    const requestedThinking=opts.thinkingMode||settings.thinkingMode||'auto',messages=applyThinkingPromptGuard(rawMessages,provider,requestedThinking,opts.guardThinking===true);
    const wantsStreaming=opts.stream!==false&&settings.streaming!==false&&provider.supportsStreaming!==false;
    const body={model:model,messages:messages,stream:wantsStreaming};
    if(wantsStreaming&&provider.supportsStreamUsage)body.stream_options={include_usage:true};
    const tokenParam=provider.tokenParam||'max_tokens';
    if(opts.maxTokens!=null)body[tokenParam]=Math.max(16,Math.floor(Number(opts.maxTokens)));
    if(provider.supportsTemperature!==false)body.temperature=Number.isFinite(Number(opts.temperature))?Number(opts.temperature):(Number.isFinite(Number(settings.temperature))?Number(settings.temperature):0.7);
    const thinking=applyThinkingMode(body,provider,requestedThinking);
    if(thinking.applied==='off'&&provider.supportsReasoningControl===true&&wantsStreaming)body.reasoning_control=true;
    if(opts.jsonSchema&&provider.supportsJsonSchema){const name=String(opts.jsonSchemaName||'labflow_output').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,64)||'labflow_output';body.response_format={type:'json_schema',json_schema:{name:name,strict:true,schema:opts.jsonSchema}};}else if(opts.jsonMode&&provider.supportsJsonMode)body.response_format={type:'json_object'};
    const providerTimeout=Math.max(5000,Number(provider.requestTimeoutMs)||90000);
    const timeoutMs=opts.connectionTest?Math.max(5000,Number(opts.timeoutMs)||15000):Math.max(Number(settings.inactivityTimeoutMs)||90000,providerTimeout,Math.max(0,Number(opts.timeoutMs)||0));
    const hardTimeoutMs=Math.max(0,Number(opts.hardTimeoutMs)||Number(provider.requestDeadlineMs)||0);
    const policy=Object.assign({},opts.thinkingPolicy||{requested:opts.thinkingMode||settings.thinkingMode||'auto',capability:'unknown',reason:'Direct request'},{applied:thinking.applied});
    return{url:cfg.url,headers:cfg.headers,body:body,timeoutMs:timeoutMs,hardTimeoutMs:hardTimeoutMs,provider:provider,settings:settings,model:model,thinkingMode:thinking.applied,thinkingPolicy:policy,prepareMs:Math.round(performance.now()-prepareStarted)};
  }

  async function send(spec,opts){
    opts=opts||{};const overallStarted=performance.now();
    let r;
    try{
      r=await request(spec.url,spec.headers,spec.body,opts.label||'AI request',spec.timeoutMs,opts.onProgress,Math.max(0,Number(spec.hardTimeoutMs)||0));
    }catch(err){
      if(isRateLimitError(err)){
        const retryMs=Math.max(0,Number(err.retryAfterMs)||0);
        err.retryInMs=retryMs;
        Log.warn('rate-limit.provider-response',{provider:spec.settings&&spec.settings.provider||spec.provider&&spec.provider.id||'',model:spec.model||spec.settings&&spec.settings.model||'',providerCode:String(err.providerCode||''),status:Number(err.status||0),kind:err.rateLimitKind||'rate_limit',retryAfterMs:retryMs||null,retried:false,persisted:false,httpRequests:1});
        if(opts.onProgress)opts.onProgress({transportState:'rate_limit',rateLimit:true,rateLimitKind:err.rateLimitKind||'rate_limit',retryInMs:retryMs,provider:spec.settings&&spec.settings.provider||'',model:spec.model||'',providerCode:String(err.providerCode||''),status:Number(err.status||0),attempt:0,retries:0,willRetry:false});
      }
      throw err;
    }
    const finalizeStarted=performance.now(),obj=r.json,extracted=extractAssistant(obj),usage=obj.usage||{},content=extracted.content,reasoning=extracted.reasoning;
    const promptTokens=Number.isFinite(Number(usage.prompt_tokens))?Number(usage.prompt_tokens):estimateTokens((spec.body.messages||[]).map(function(m){return m.content||'';}).join('\n'));
    const completionTokens=Number.isFinite(Number(usage.completion_tokens))?Number(usage.completion_tokens):estimateTokens(content+reasoning);
    const totalTokens=Number.isFinite(Number(usage.total_tokens))?Number(usage.total_tokens):promptTokens+completionTokens;
    const exactReasoningTokens=usage.completion_tokens_details&&Number.isFinite(Number(usage.completion_tokens_details.reasoning_tokens))?Number(usage.completion_tokens_details.reasoning_tokens):null,estimatedReasoningTokens=reasoning?estimateTokens(reasoning):0,reasoningTokens=exactReasoningTokens==null?estimatedReasoningTokens:exactReasoningTokens,answerTokens=Math.max(0,completionTokens-reasoningTokens);
    const normalizedUsage={promptTokens:promptTokens,completionTokens:completionTokens,totalTokens:totalTokens,cachedTokens:usage.prompt_tokens_details&&usage.prompt_tokens_details.cached_tokens||null,reasoningTokens:reasoningTokens,answerTokens:answerTokens,reasoningEstimated:exactReasoningTokens==null&&!!reasoning,estimated:!obj.usage};
    const finalizeMs=Math.round(performance.now()-finalizeStarted),totalElapsed=Math.round(performance.now()-overallStarted),ttftMs=r.stream&&r.stream.ttftMs||null,generationMs=Math.max(1,(Number(r.elapsedMs)||0)-(ttftMs||0)),tps=generationMs>0?Number((completionTokens/(generationMs/1000)).toFixed(2)):null,reasoningObserved=reasoning.length>0,controlRequests=Math.max(0,Number(r.reasoningControlRequests)||0),httpRequests=1+controlRequests;
    if(spec.thinkingMode==='off'&&reasoningObserved)Log.warn('thinking.override-ignored',{provider:spec.settings.provider,model:obj.model||spec.settings.model,reasoningChars:reasoning.length,reasoningControlRequests:controlRequests,reasoningControlOk:r.reasoningControlResult&&r.reasoningControlResult.ok===true,finishReason:extracted.finishReason||''});
    if(!content){
      Log.warn('response.empty-content',{model:obj.model||spec.settings.model,finishReason:extracted.finishReason,reasoningChars:reasoning.length,completionTokens:completionTokens,responseKeys:Object.keys(obj||{}),messageKeys:Object.keys(extracted.message||{})});
      const suffix=extracted.finishReason?' Finish reason: '+extracted.finishReason+'.':'';
      const hint=reasoning?' The provider returned reasoning but no final answer; the completion budget may have been consumed before the final response.':'';
      const emptyError=new Error('The model returned no final text.'+suffix+hint);
      emptyError.code=extracted.finishReason==='length'?'MODEL_OUTPUT_TRUNCATED':'MODEL_OUTPUT_INVALID';emptyError.isContract=true;emptyError.status=200;emptyError.httpOk=true;emptyError.reasoning=reasoning;emptyError.finishReason=extracted.finishReason;
      emptyError.providerResponse=extracted.refusal||'';emptyError.rawProviderResponse=r.rawText;
      emptyError.requestId=r.requestId;emptyError.requestLogId=r.requestLogId;emptyError.elapsedMs=r.elapsedMs;emptyError.requestElapsedMs=r.elapsedMs;emptyError.generationMs=generationMs;emptyError.ttftMs=ttftMs;emptyError.tokensPerSecond=tps;emptyError.usage=normalizedUsage;emptyError.model=obj.model||spec.settings.model;emptyError.requestedMaxTokens=positiveInt(spec.body.max_completion_tokens||spec.body.max_tokens||spec.body.max_output_tokens);emptyError.thinkingMode=spec.thinkingMode||'auto';emptyError.reasoningObserved=reasoningObserved;emptyError.reasoningControlRequests=controlRequests;emptyError.reasoningControlOk=r.reasoningControlResult&&r.reasoningControlResult.ok===true;
      throw emptyError;
    }
    Log.info('request.timing',{provider:spec.settings.provider,model:obj.model||spec.settings.model,prepareMs:spec.prepareMs||0,responseHeadersMs:r.responseHeadersMs,firstTokenMs:ttftMs,generationMs:generationMs,requestMs:r.elapsedMs,finalizeMs:finalizeMs,totalMs:totalElapsed,httpRequests:httpRequests,reasoningObserved:reasoningObserved,reasoningControlRequests:controlRequests});
    return{content:content,reasoning:reasoning,reasoningObserved:reasoningObserved,reasoningControlRequests:controlRequests,reasoningControlOk:r.reasoningControlResult&&r.reasoningControlResult.ok===true,model:obj.model||spec.settings.model,provider:spec.settings.provider,thinkingMode:spec.thinkingMode||'auto',thinkingPolicy:spec.thinkingPolicy||null,latencyMs:totalElapsed,prepareMs:spec.prepareMs||0,responseHeadersMs:r.responseHeadersMs,finalizeMs:finalizeMs,httpRequests:httpRequests,requestElapsedMs:r.elapsedMs,generationMs:generationMs,ttftMs:ttftMs,tokensPerSecond:tps,usage:normalizedUsage,finishReason:extracted.finishReason,requestId:r.requestId,requestLogId:r.requestLogId,rawProviderResponse:r.rawText,streamed:!!r.stream,streamEvents:r.stream&&r.stream.events||0,meaningfulStreamEvents:r.stream&&r.stream.meaningfulEvents||0,responseBytes:r.stream&&r.stream.bytes||new TextEncoder().encode(r.rawText).byteLength};
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
    limitInfo:limitInfo,
    resolveModelsUrl:resolveModelsUrl,
    listModels:listModels,
    capabilityFromRow:capabilityFromRow,
    knownCapability:knownCapability,
    resolveModelCapabilities:resolveModelCapabilities,
    resolveOutputBudget:resolveOutputBudget,
    resolveThinkingPolicy:resolveThinkingPolicy,
    applyThinkingMode:applyThinkingMode,
    applyThinkingPromptGuard:applyThinkingPromptGuard,
    reasoningControlUrl:reasoningControlUrl,
    connectionProbePolicy:connectionProbePolicy,
    benchmarkTokensPerSecond:benchmarkTokensPerSecond,
    testConnection:testConnection
  };
}());
