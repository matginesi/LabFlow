(function () {
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};

  function networkMessage(label,providerId){
    const provider=(LF.AIProviders&&LF.AIProviders[providerId])||null;
    const name=provider&&provider.name?provider.name:'AI provider';
    const local=providerId==='lmstudio'||providerId==='ollama';
    if(local){
      const fileOrigin=typeof location!=='undefined'&&location.protocol==='file:';
      const originHint=fileOrigin?' LabFlow is running from file://, which is commonly rejected as a browser origin. Serve the app over http://127.0.0.1 instead.':'';
      const providerHint=providerId==='lmstudio'?' LM Studio direct browser access requires CORS (for example: lms server start --cors).':' Ollama accepts localhost web origins by default; custom/file origins may require OLLAMA_ORIGINS.';
      return label+' was blocked before LabFlow could read an HTTP response from '+name+'. This is usually browser CORS/preflight, not a missing messages payload.'+originHint+providerHint;
    }
    return label+' could not reach '+name+'. Check that the service is running and that the configured endpoint is correct.';
  }

  function statusHint(status,code){
    if(status===401||status===403)return' Check provider credentials and permissions.';
    if(status===404)return' Check the endpoint path and model name.';
    if(status===429)return' The provider rate limit or quota was reached.';
    if(status>=500)return' The provider reported a server-side error.';
    if(String(code||'')==='1261')return' The model context window was exceeded.';
    return'';
  }

  function errorSummary(error){
    const e=error||{},status=Number(e.status||0),code=String(e.providerCode||e.code||'');
    let category='Provider error',next='Review the endpoint, model and provider status.';
    if(e.cancelled){category='Cancelled';next='Run the operation again when ready.';}
    else if(e.timedOut){category='Timeout';next='Retry the request or increase the provider timeout for a slow local model.';}
    else if(e.isNetwork||(!status&&/reach|network|fetch|cors|preflight|blocked/i.test(String(e.message||'')))){
      const providerId=e.providerId||(LF.Storage&&LF.Storage.getAiSettings?LF.Storage.getAiSettings().provider:'');
      category=(providerId==='lmstudio'||providerId==='ollama')?'Browser / CORS':'Network';
      if(providerId==='lmstudio')next='Run LabFlow from http://127.0.0.1 (not file://) and start LM Studio with CORS enabled, e.g. lms server start --cors. Then retry.';
      else if(providerId==='ollama')next='Run LabFlow from http://127.0.0.1 (not file://). Ollama allows localhost web origins by default; configure OLLAMA_ORIGINS only for a different origin.';
      else next='Check that the provider process is running and the endpoint is reachable from this browser.';
    }
    else if(status===401||status===403){category='Authentication';next='Check the API key or provider permissions.';}
    else if(status===404){category='Endpoint / model';next='Check the endpoint path and configured model.';}
    else if(status===429){category='Rate limit';next='Retry later or choose another available model/provider.';}
    else if(status>=500){category='Provider server';next='Check the provider logs and retry.';}
    return{category:category,next:next,status:status||'',providerCode:code};
  }

  function contextNote(){return'LabFlow sends AI requests directly from the browser to the configured endpoint.';}

  LF.AIDiagnostics={networkMessage:networkMessage,statusHint:statusHint,errorSummary:errorSummary,contextNote:contextNote};
}());
