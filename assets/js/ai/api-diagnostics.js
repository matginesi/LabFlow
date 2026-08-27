(function () {
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};

  function networkMessage(label,providerId){
    const provider=(LF.AIProviders&&LF.AIProviders[providerId])||null;
    const name=provider&&provider.name?provider.name:'AI provider';
    const local=providerId==='lmstudio'||providerId==='ollama'||providerId==='llamacpp';
    if(local){
      const providerHint=providerId==='lmstudio'?' Check that LM Studio has its local API enabled and accepts this browser origin.':providerId==='llamacpp'?' Check that llama-server is running at the configured endpoint and accepts this browser origin.':' Check that Ollama is running and accepts this browser origin.';
      return label+' ended before LabFlow could read an HTTP response from '+name+'. This may be connectivity or browser-origin policy; it is not evidence of a malformed messages payload.'+providerHint;
    }
    return label+' could not reach '+name+'. Check that the service is running and that the configured endpoint is correct.';
  }

  function statusHint(status,code,message){
    const c=String(code||'');
    if(status===401||status===403)return' Check provider credentials and permissions.';
    if(status===404)return' Check the endpoint path and model name.';
    if(c==='1304')return' The provider daily quota is exhausted; retrying the same request cannot fix it.';
    if(c==='1308')return' The provider usage window is exhausted until its reset time; LabFlow will not loop on retries.';
    if(c==='1310')return' The provider weekly/monthly plan quota is exhausted; LabFlow will not retry automatically.';
    if(c==='1312')return' The selected model is temporarily under high traffic. LabFlow stops the bounded request and lets you retry later.';
    if(c==='1302')return' Provider concurrency is saturated. LabFlow stops this request without retrying it.';
    if(c==='1303')return' Provider request frequency is too high. LabFlow stops this request without retrying it.';
    if(status===429||c==='1305')return' The provider rate limit was reached. LabFlow does not retry automatically and does not create a local cooldown; bulk Design stops immediately and preserves completed suggestions.';
    if(status>=500)return' The provider reported a server-side error.';
    if(c==='1261'||c==='MODEL_CONTEXT_LENGTH')return' The loaded model context window was exceeded. LabFlow will compact bounded Action context before the next request.';
    return'';
  }

  function errorSummary(error){
    const e=error||{},status=Number(e.status||0),code=String(e.providerCode||e.code||'');
    let category='Provider error',next='Review the endpoint, model and provider status.';
    if(e.cancelled){category='Cancelled';next='Run the Action again when ready.';}
    else if(e.timedOut){category='Timeout';next='Retry the request or increase the provider timeout for a slow local model.';}
    else if(e.isNetwork||(!status&&/reach|network|fetch|cors|preflight|blocked/i.test(String(e.message||'')))){
      const providerId=e.providerId||(LF.Storage&&LF.Storage.getAiSettings?LF.Storage.getAiSettings().provider:'');
      category=(providerId==='lmstudio'||providerId==='ollama'||providerId==='llamacpp')?'Browser / CORS':'Network';
      if(providerId==='lmstudio')next='Confirm that the LM Studio local API is running at the configured endpoint and accepts the current browser origin, then retry.';
      else if(providerId==='ollama')next='Confirm that Ollama is running at the configured endpoint and accepts the current browser origin, then retry.';
      else if(providerId==='llamacpp')next='Confirm that llama-server is running at the configured endpoint, serves /v1/chat/completions, and accepts the current browser origin, then retry.';
      else next='Check that the provider process is running and the endpoint is reachable from this browser.';
    }
    else if(e.isContextOverflow||code==='MODEL_CONTEXT_LENGTH'||code==='1261'){category='Model context';next='The prompt exceeded the model context loaded by the provider. LabFlow uses the runtime context capability and compacts the Action Context Pack; if this persists, increase the loaded context or narrow the Action.';}
    else if(e.isContract&&String(e.finishReason||'')==='length'){category='Model output limit';next='The provider returned a valid response envelope but exhausted the bounded output budget before final text. In Test connection, supported local providers report this as reachable/inconclusive instead of a connection failure; in a normal Action, reduce the task or increase that Action budget within its contract.';}
    else if(status===400&&/(?:failed|unable) to load model|model (?:is )?not (?:found|loaded)|invalid (?:request[^.]* )?model/i.test(String(e.providerMessage||e.message||''))){category='Model unavailable';next='The provider could not load the configured model. Load it in the provider, then press Detect or run the connection test again.';}
    else if(status===401||status===403){category='Authentication';next='Check the API key or provider permissions.';}
    else if(status===404){category='Endpoint / model';next='Check the endpoint path and configured model.';}
    else if(['1304','1308','1310'].includes(code)||(e.rateLimited&&e.rateLimitRetryable===false)){category='Provider quota';next=code==='1304'?'The daily quota is exhausted. Check the provider quota/reset status or use another provider.':code==='1310'?'The current plan period is exhausted. Check the provider reset/plan status or use another provider.':'The provider usage window is exhausted. Check its reset time or use another provider.';}
    else if(status===429||['1302','1303','1305','1312'].includes(code)||e.rateLimited){category=code==='1312'?'Model capacity':'Rate limit';const retryMs=Math.max(0,Number(e.retryAfterMs||e.retryInMs)||0);next=code==='1312'?'The model is temporarily under high traffic. Retry later after the provider has recovered.':retryMs?'LabFlow stopped at the provider throttle without retrying. The provider returned Retry-After; retry after about '+Math.max(1,Math.ceil(retryMs/1000))+' s.':'LabFlow stopped at the provider throttle without retrying. Retry later or use another provider.';}
    else if(status>=500){category='Provider server';next='Check the provider logs and retry.';}
    return{category:category,next:next,status:status||'',providerCode:code};
  }

  function contextNote(){return'LabFlow sends AI requests directly from the browser to the configured endpoint.';}

  LF.AIDiagnostics={networkMessage:networkMessage,statusHint:statusHint,errorSummary:errorSummary,contextNote:contextNote};
}());
