(function () {
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};

  function networkMessage(label,providerId){
    const provider=(LF.AIProviders&&LF.AIProviders[providerId])||null;
    const name=provider&&provider.name?provider.name:'AI provider';
    const local=providerId==='lmstudio'||providerId==='ollama';
    if(local){
      const providerHint=providerId==='lmstudio'?' Check that LM Studio has its local API enabled and accepts this browser origin.':' Check that Ollama is running and accepts this browser origin.';
      return label+' ended before LabFlow could read an HTTP response from '+name+'. This may be connectivity or browser-origin policy; it is not evidence of a malformed messages payload.'+providerHint;
    }
    return label+' could not reach '+name+'. Check that the service is running and that the configured endpoint is correct.';
  }

  function statusHint(status,code){
    if(status===401||status===403)return' Check provider credentials and permissions.';
    if(status===404)return' Check the endpoint path and model name.';
    if(status===429||String(code||'')==='1305')return' The provider rate limit was reached. LabFlow applies a bounded cooldown before retrying the same request.';
    if(status>=500)return' The provider reported a server-side error.';
    if(String(code||'')==='1261'||String(code||'')==='MODEL_CONTEXT_LENGTH')return' The loaded model context window was exceeded. LabFlow will compact bounded Action context before the next request.';
    return'';
  }

  function errorSummary(error){
    const e=error||{},status=Number(e.status||0),code=String(e.providerCode||e.code||'');
    let category='Provider error',next='Review the endpoint, model and provider status.';
    if(e.cancelled){category='Cancelled';next='Run the Action again when ready.';}
    else if(e.timedOut){category='Timeout';next='Retry the request or increase the provider timeout for a slow local model.';}
    else if(e.isNetwork||(!status&&/reach|network|fetch|cors|preflight|blocked/i.test(String(e.message||'')))){
      const providerId=e.providerId||(LF.Storage&&LF.Storage.getAiSettings?LF.Storage.getAiSettings().provider:'');
      category=(providerId==='lmstudio'||providerId==='ollama')?'Browser / CORS':'Network';
      if(providerId==='lmstudio')next='Confirm that the LM Studio local API is running at the configured endpoint and accepts the current browser origin, then retry.';
      else if(providerId==='ollama')next='Confirm that Ollama is running at the configured endpoint and accepts the current browser origin, then retry.';
      else next='Check that the provider process is running and the endpoint is reachable from this browser.';
    }
    else if(e.isContextOverflow||code==='MODEL_CONTEXT_LENGTH'||code==='1261'){category='Model context';next='The prompt exceeded the model context loaded by the provider. LabFlow uses the runtime context capability and compacts the Action Context Pack; if this persists, increase the loaded context or narrow the Action.';}
    else if(e.isContract&&String(e.finishReason||'')==='length'){category='Probe output limit';next='The provider is reachable, but the model used the bounded probe budget before returning final text. Press Detect again so LabFlow can refresh its reasoning capabilities, or select a model with a smaller reasoning budget.';}
    else if(status===400&&/(?:failed|unable) to load model|model (?:is )?not (?:found|loaded)|invalid (?:request[^.]* )?model/i.test(String(e.providerMessage||e.message||''))){category='Model unavailable';next='The provider could not load the configured model. Load it in the provider, then press Detect or run the connection test again.';}
    else if(status===401||status===403){category='Authentication';next='Check the API key or provider permissions.';}
    else if(status===404){category='Endpoint / model';next='Check the endpoint path and configured model.';}
    else if(status===429||code==='1305'){category='Rate limit';next='LabFlow already applied bounded backoff. If it still fails, wait briefly or switch from the shared free Flash endpoint to another model/provider.';}
    else if(status>=500){category='Provider server';next='Check the provider logs and retry.';}
    return{category:category,next:next,status:status||'',providerCode:code};
  }

  function contextNote(){return'LabFlow sends AI requests directly from the browser to the configured endpoint.';}

  LF.AIDiagnostics={networkMessage:networkMessage,statusHint:statusHint,errorSummary:errorSummary,contextNote:contextNote};
}());
