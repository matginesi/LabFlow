(function () {
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  function localProvider(providerId){const provider=LF.AIProviders&&LF.AIProviders[providerId];return provider?provider.local===true:['ollama','lmstudio','llamacpp'].includes(String(providerId||''));}

  function networkMessage(label,providerId,endpoint){
    const provider=(LF.AIProviders&&LF.AIProviders[providerId])||null;
    const name=provider&&provider.name?provider.name:'AI provider';
    const local=localProvider(providerId);
    if(local){
      const target=String(endpoint||(LF.Storage&&LF.Storage.getAiSettings?LF.Storage.getAiSettings().endpoint:'')||''),space=LF.AI&&LF.AI.targetAddressSpace?LF.AI.targetAddressSpace(target):'',securePage=typeof location!=='undefined'&&location.protocol==='https:';
      const providerHint=providerId==='lmstudio'?' Enable Serve on Local Network and CORS when LabFlow runs on another device.':providerId==='llamacpp'?' Start llama-server on a LAN interface (for example --host 0.0.0.0) and allow the LabFlow origin with CORS.':' Expose Ollama on the LAN with OLLAMA_HOST and allow the LabFlow origin with OLLAMA_ORIGINS.';
      const browserHint=securePage&&space==='local'?' If the browser asks for Local Network access, allow it; browsers without that capability require an HTTPS endpoint or LabFlow served from a compatible local origin.':'';
      const loopbackHint=space==='loopback'?' A loopback endpoint points to the device running this browser, not to another computer on the Wi-Fi/LAN.':'';
      return label+' ended before LabFlow could read an HTTP response from '+name+'. Check network reachability, bind address and browser-origin policy.'+loopbackHint+providerHint+browserHint;
    }
    const relay=evidenceRelay(providerId,endpoint);
    if(providerId==='nvidia')return label+' could not reach hosted NVIDIA NIM from this browser. The hosted API may reject browser CORS/preflight. '+relay;
    if(['zai','openai','gemini'].includes(providerId))return label+' ended before the browser exposed an HTTP response from '+name+'. This is commonly CORS/origin policy for a browser-only client. '+relay;
    if(providerId==='openrouter')return label+' could not reach OpenRouter. If an HTTP 401/403 is visible, fix the API key; if there is no HTTP status, inspect browser CORS/network policy. '+relay;
    return label+' could not reach '+name+'. Check the configured endpoint and browser network policy. '+relay;
  }

  function evidenceRelay(providerId,endpoint){
    const status=LF.AI&&LF.AI.relayStatus?LF.AI.relayStatus():null,available=!!(status&&status.available),eligible=!!(LF.AIProviders&&LF.AIProviders[providerId]&&LF.AIProviders[providerId].relayEligible);
    if(!eligible)return'';
    if(available)return'LabFlow local relay is available and will be used automatically; inspect Logs for the failing relay phase.';
    return'When direct browser CORS is blocked, serve LabFlow with `python3 tools/labflow_server.py --host 0.0.0.0 --port 8000`; the same-origin relay will be used automatically. A static GitHub Pages deployment cannot provide this local relay.';
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
    else if(e.timedOut){const providerId=e.providerId||(LF.Storage&&LF.Storage.getAiSettings?LF.Storage.getAiSettings().provider:''),provider=LF.AIProviders&&LF.AIProviders[providerId];category='Timeout';next=provider&&provider.local===true?'Retry the request or increase the inactivity timeout if the model is still loading.':'The provider did not expose a response before the connection-test deadline. Retry once; if a console/curl probe succeeds while the browser test does not, inspect browser network/CORS.';}
    else if(e.isNetwork||(!status&&/reach|network|fetch|cors|preflight|blocked/i.test(String(e.message||'')))){
      const providerId=e.providerId||(LF.Storage&&LF.Storage.getAiSettings?LF.Storage.getAiSettings().provider:'');
      const provider=LF.AIProviders&&LF.AIProviders[providerId];category=e.relayUpstream||e.transport==='relay'?'Relay upstream network':localProvider(providerId)?'Local endpoint unreachable':'Network';
      if(e.relayUpstream||e.transport==='relay')next='The LabFlow local relay received the request but could not reach the hosted provider upstream. Check DNS/Internet access in the terminal running tools/labflow_server.py; provider credentials were not the cause of this network failure.';
      else if(providerId==='lmstudio')next='Confirm that LM Studio Serve on Local Network and CORS are enabled and use the LAN host/IP in the endpoint when LabFlow runs on another device.';
      else if(providerId==='ollama')next='Confirm that Ollama is exposed on the LAN with OLLAMA_HOST and that OLLAMA_ORIGINS allows the LabFlow page origin.';
      else if(providerId==='llamacpp')next='Confirm that llama-server is listening on a LAN-reachable address (for example --host 0.0.0.0), serves /v1/chat/completions, and allows the LabFlow page origin. From GitHub Pages or another HTTPS origin, allow the browser Local Network permission when prompted; otherwise use an HTTPS endpoint or a compatible local origin.';
      else if(providerId==='nvidia'){category='Browser / CORS';next='Hosted NVIDIA NIM did not expose an HTTP response to this origin. '+evidenceRelay(providerId,e.url||'');}
      else if(['zai','openai','gemini'].includes(providerId)){category='Browser / CORS';next='The browser did not expose an HTTP response from the provider. '+evidenceRelay(providerId,e.url||'');}
      else if(providerId==='openrouter'){category='Network / CORS';next='No provider HTTP response reached LabFlow. '+evidenceRelay(providerId,e.url||'');}
      else next='Check that the provider process is running and the endpoint is reachable from this browser.';
    }
    else if(e.isContextOverflow||code==='MODEL_CONTEXT_LENGTH'||code==='1261'){category='Model context';next='The prompt exceeded the model context loaded by the provider. LabFlow uses the runtime context capability and compacts the Action Context Pack; if this persists, increase the loaded context or narrow the Action.';}
    else if(e.isContract&&String(e.finishReason||'')==='length'){category='Model output limit';next='The provider returned a valid response envelope but exhausted the bounded output budget before final text. In Test connection, supported local providers report this as reachable/inconclusive instead of a connection failure; in a normal Action, reduce the task or increase that Action budget within its contract.';}
    else if(status===400&&/(?:failed|unable) to load model|model (?:is )?not (?:found|loaded)|invalid (?:request[^.]* )?model/i.test(String(e.providerMessage||e.message||''))){category='Model unavailable';next='The provider could not load the configured model. Load it in the provider, then press Detect or run the connection test again.';}
    else if(status===401||status===403){category='Authentication';next='Check the API key or provider permissions.';}
    else if(status===404){const providerId=e.providerId||(LF.Storage&&LF.Storage.getAiSettings?LF.Storage.getAiSettings().provider:'');category=providerId==='nvidia'?'Model unavailable':'Endpoint / model';next=providerId==='nvidia'?'The NVIDIA catalogue can include IDs that are no longer invocable on the hosted endpoint. Choose a currently served model, press Detect, then test again.':'Check the endpoint path and configured model.';}
    else if(['1304','1308','1310'].includes(code)||(e.rateLimited&&e.rateLimitRetryable===false)){category='Provider quota';next=code==='1304'?'The daily quota is exhausted. Check the provider quota/reset status or use another provider.':code==='1310'?'The current plan period is exhausted. Check the provider reset/plan status or use another provider.':'The provider usage window is exhausted. Check its reset time or use another provider.';}
    else if(status===429||['1302','1303','1305','1312'].includes(code)||e.rateLimited){category=code==='1312'?'Model capacity':'Rate limit';const retryMs=Math.max(0,Number(e.retryAfterMs||e.retryInMs)||0);next=code==='1312'?'The model is temporarily under high traffic. Retry later after the provider has recovered.':retryMs?'LabFlow stopped at the provider throttle without retrying. The provider returned Retry-After; retry after about '+Math.max(1,Math.ceil(retryMs/1000))+' s.':'LabFlow stopped at the provider throttle without retrying. Retry later or use another provider.';}
    else if(status>=500){category='Provider server';next='Check the provider logs and retry.';}
    return{category:category,next:next,status:status||'',providerCode:code};
  }

  function contextNote(providerId){providerId=String(providerId||(LF.Storage&&LF.Storage.getAiSettings?LF.Storage.getAiSettings().provider:'')||'');const provider=LF.AIProviders&&LF.AIProviders[providerId],local=provider&&provider.local===true;if(local)return'LabFlow connects directly to this configured local/LAN endpoint.';if(provider&&provider.relayEligible===true)return'LabFlow tries the configured cloud endpoint directly when browser CORS allows it; when served by tools/labflow_server.py it automatically uses the same-origin relay.';return'LabFlow connects to the configured endpoint from the browser.';}

  LF.AIDiagnostics={networkMessage:networkMessage,statusHint:statusHint,errorSummary:errorSummary,contextNote:contextNote,evidenceRelay:evidenceRelay};
}());
