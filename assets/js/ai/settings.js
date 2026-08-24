(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const Log = LF.Logger.scope('ai-settings');
  const modelCatalogues={};
  const modelCatalogueFallbacks={};

  /** Return an element by ID. Settings is dynamically rendered, so resolve lazily. */
  function field(id) { return document.getElementById(id); }

  function providerIdFromForm(){return(field('aiProvider')&&field('aiProvider').value)||LF.Storage.getAiSettings().provider;}
  function activeModelField(providerId){const provider=LF.AIProviders[providerId||providerIdFromForm()]||LF.AIProviders.custom;return provider.modelSelect&&field('aiModelSelect')&&!field('aiModelSelect').hidden?field('aiModelSelect'):field('aiModel');}
  function modelValue(providerId){const model=activeModelField(providerId);return String(model&&model.value||'').trim();}
  function setModelValue(value){value=String(value||'');const input=field('aiModel'),select=field('aiModelSelect');if(input)input.value=value;if(select){if(value&&!Array.from(select.options).some(function(option){return option.value===value;})){const option=document.createElement('option');option.value=value;option.textContent=value;select.appendChild(option);}select.value=value;}}
  function syncModelControls(models,options){options=options||{};const providerId=providerIdFromForm(),provider=LF.AIProviders[providerId]||LF.AIProviders.custom,input=field('aiModel'),select=field('aiModelSelect'),button=field('loadProviderModels'),hint=field('aiModelHint'),key=field('aiKey');if(!input||!select)return;if(!options.manualFallback&&(!Array.isArray(models)||!models.length)&&Array.isArray(modelCatalogues[providerId]))models=modelCatalogues[providerId].slice();if(select.dataset.provider!==providerId){delete select.dataset.manualFallback;delete select.dataset.catalogueCount;select.dataset.provider=providerId;select.replaceChildren();}if(options.manualFallback){select.dataset.manualFallback='true';modelCatalogueFallbacks[providerId]=true;}else if(modelCatalogueFallbacks[providerId])select.dataset.manualFallback='true';if(Array.isArray(models)&&models.length){delete select.dataset.manualFallback;delete modelCatalogueFallbacks[providerId];modelCatalogues[providerId]=models.slice();}const manualFallback=select.dataset.manualFallback==='true',selectMode=!!provider.modelSelect&&!manualFallback,current=String(input.value||modelValue(providerId)||provider.model||'');if(Array.isArray(models)&&models.length){const unique=Array.from(new Set(models.map(String).filter(Boolean))).sort(function(a,b){return a.localeCompare(b);});select.replaceChildren();unique.forEach(function(id){const option=document.createElement('option');option.value=id;option.textContent=id;select.appendChild(option);});const preferred=unique.includes(current)?current:unique.includes(provider.model)?provider.model:unique[0];select.value=preferred;input.value=preferred;select.dataset.catalogueCount=String(unique.length);}else if(!select.options.length&&current){const option=document.createElement('option');option.value=current;option.textContent=current;select.appendChild(option);select.value=current;}input.hidden=selectMode;select.hidden=!selectMode;const host=input.closest('.ai-model-control');if(host)host.dataset.modelSelect=selectMode?'true':'false';if(button&&!button.dataset.loading){button.textContent=selectMode?'Load models':manualFallback?'Retry models':'Detect';button.disabled=!!(provider.keyRequired&&!String(key&&key.value||'').trim());}if(hint&&!options.preserveHint){if(provider.modelSelect&&!String(key&&key.value||'').trim())hint.textContent='Enter the NVIDIA API key to enable model loading.';else if(provider.modelSelect&&manualFallback)hint.textContent='The NVIDIA catalogue is unavailable. Enter an exact model ID manually, then Save & test connection.';else if(provider.modelSelect&&!select.dataset.catalogueCount)hint.textContent='Press Load models to read the catalogue available to this NVIDIA key.';}}

  /** Reduce an endpoint to a safe diagnostic host; never expose credentials or query data. */
  function endpointHost(endpoint) {
    try { return new URL(String(endpoint || '')).host; }
    catch (_) { return String(endpoint || ''); }
  }

  /** Build a readable, locally measured connection report around the tiny provider reply. */
  function connectionReport(result) {
    const usage=result.usage||{},lines=['## Provider response','`'+String(result.content||'—').replace(/`/g,'\\`')+'`','','## Connection diagnostics'];
    lines.push('- **Status:** reachable; response parsed successfully');
    lines.push('- **Provider / model:** '+String(result.provider||'—')+' / `'+String(result.model||'—').replace(/`/g,'\\`')+'`');
    lines.push('- **Thinking override:** '+String(result.thinkingMode||'auto'));
    lines.push('- **Total elapsed:** '+Number(result.elapsedMs||0).toLocaleString()+' ms');
    if(Number.isFinite(Number(result.requestElapsedMs)))lines.push('- **Successful provider round trip:** '+Number(result.requestElapsedMs).toLocaleString()+' ms');
    if(Number.isFinite(Number(result.elapsedMs))&&Number.isFinite(Number(result.requestElapsedMs))&&Number(result.elapsedMs)>Number(result.requestElapsedMs))lines.push('- **Local / pacing / retry overhead:** '+(Number(result.elapsedMs)-Number(result.requestElapsedMs)).toLocaleString()+' ms');
    if(Number.isFinite(Number(usage.totalTokens))){lines.push('- **Tokens:** '+Number(usage.promptTokens||0).toLocaleString()+' input + '+Number(usage.completionTokens||0).toLocaleString()+' output = '+Number(usage.totalTokens).toLocaleString()+' total'+(usage.estimated?' (estimated locally)':' (reported by provider)'));}
    if(Number.isFinite(Number(result.tokensPerSecond)))lines.push('- **End-to-end output rate:** '+Number(result.tokensPerSecond).toFixed(2)+' tok/s');
    if(Number.isFinite(Number(result.responseBytes)))lines.push('- **Response payload:** '+Number(result.responseBytes).toLocaleString()+' bytes');
    lines.push('- **Finish reason:** '+(result.finishReason||'not returned'));
    lines.push('- **Rate-limit retries:** '+Number(result.rateLimitRetries||0));
    lines.push('- **Request ID:** `'+String(result.requestId||'not returned').replace(/`/g,'\\`')+'`');
    return lines.join('\n');
  }

  /**
   * Add runtime-specific connectivity guidance after the Settings view is rendered.
   * DOM APIs keep endpoint diagnostics escaped without growing the HTML template.
   */
  function decorate() {
    const providerSelect = field('aiProvider');
    if (!providerSelect || !LF.AIDiagnostics) return;
    const body = providerSelect.closest('.panel-body');
    const form = providerSelect.closest('.form-grid');
    if (!body || !form) return;

    const saved = LF.Storage.getAiSettings();
    const providerId = providerSelect.value || saved.provider;
    const provider = LF.AIProviders[providerId] || LF.AIProviders.custom;
    const endpointField = field('aiEndpoint');
    const endpoint = endpointField ? endpointField.value.trim() : saved.endpoint;
    let note = body.querySelector('[data-ai-connectivity-note]');
    if (!note) {
      note = document.createElement('div');
      note.dataset.aiConnectivityNote = 'true';
      form.parentElement.insertBefore(note, form);
    }
    note.className = 'notice ' + ((location.protocol === 'file:' || (provider && /^https?:\/\/(?:127\.|localhost|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(endpoint))) ? 'warning' : 'info');
    note.replaceChildren();

    const title = document.createElement('strong');
    title.textContent = 'Direct browser connection. ';
    note.appendChild(title);
    note.appendChild(document.createTextNode(LF.AIDiagnostics.contextNote()));

    const url = document.createElement('div');
    url.className = 'mono meta mt-1';
    url.textContent = 'Request URL: ' + (LF.AI.resolveChatUrl(endpoint) || '—');
    note.appendChild(url);

    if (provider && provider.note) {
      const detail = document.createElement('div');
      detail.className = 'meta mt-1';
      detail.textContent = provider.note;
      note.appendChild(detail);
    }
    const keyField=field('aiKey');
    const providerUsesKey=!!(provider&&(provider.keyRequired||provider.optionalKey));
    if(keyField){keyField.disabled=!providerUsesKey;keyField.placeholder=providerUsesKey?'Stored separately for this provider…':'Not used by this provider';if(!providerUsesKey)keyField.value='';}
    if (providerId === 'lmstudio' || providerId === 'ollama') {
      const local = document.createElement('div');
      local.className = 'meta mt-1';
      local.textContent = providerId === 'lmstudio'
        ? 'LM Studio · OpenAI-compatible base http://127.0.0.1:1234/v1 · LabFlow sends POST /v1/chat/completions with a messages array. Its local API must be running and accept the current browser origin.'
        : 'Ollama · OpenAI-compatible base http://127.0.0.1:11434/v1 · LabFlow sends POST /v1/chat/completions with a messages array. Its local API must be running and accept the current browser origin.';
      note.appendChild(local);
    }

    const testButton = field('testAiConnection');
    if (testButton) testButton.textContent = 'Save & test connection';
    syncModelControls(null,{preserveHint:true});
  }

  /** Persist the visible provider form. Experiment data is intentionally untouched. */
  function saveFromForm(options) {
    const providerField = field('aiProvider');
    if (!providerField) throw new Error('AI provider settings are not visible.');
    const previous = LF.Storage.getAiSettings();
    const settings = {
      provider: providerField.value,
      endpoint: field('aiEndpoint').value.trim(),
      model: modelValue(providerField.value),
      temperature: Number.isFinite(Number(previous.temperature)) ? Number(previous.temperature) : 0.7,
      thinkingMode: field('aiThinkingMode') ? field('aiThinkingMode').value : previous.thinkingMode || 'auto',
      streaming: field('aiStreaming') ? field('aiStreaming').checked : previous.streaming !== false,
      inactivityTimeoutMs: field('aiInactivityTimeout') ? Math.max(15000,Number(field('aiInactivityTimeout').value||90)*1000) : previous.inactivityTimeoutMs,
      maxOutputTokensCap: field('aiMaxOutputTokensCap') ? Math.max(0,Number(field('aiMaxOutputTokensCap').value)||0) : previous.maxOutputTokensCap||0
    };
    LF.Storage.saveAiSettings(settings);
    const provider=LF.AIProviders[settings.provider]||LF.AIProviders.custom;
    if(provider.keyRequired||provider.optionalKey)LF.Storage.saveApiKey(field('aiKey').value.trim(),settings.provider);
    Log.info('saved', {provider:settings.provider, endpoint:settings.endpoint, model:settings.model});
    if (!options || options.toast !== false) LF.UI.toast('AI provider saved.', 'success');
    return settings;
  }

  /** Apply a provider preset to the unsaved form without starting a model request. */
  function selectProvider(providerId) {
    const provider = LF.AIProviders[providerId] || LF.AIProviders.custom;
    field('aiEndpoint').value = provider.endpoint || '';
    setModelValue(provider.model || '');
    if(field('aiKey'))field('aiKey').value=(provider.keyRequired||provider.optionalKey)?LF.Storage.getApiKey(provider.id):'';
    Log.info('provider-selected', {provider:provider.id, model:provider.model, endpoint:provider.endpoint});
    syncModelControls();
    decorate();
  }

  async function loadModels(options) {
    options=options||{};
    const activity=options.silent?{activityStart:function(){},activityUpdate:function(){},activityFinish:function(){},activityError:function(){}}:LF.UI;
    const providerId=providerIdFromForm();
    const endpoint=(field('aiEndpoint')&&field('aiEndpoint').value.trim())||LF.Storage.getAiSettings().endpoint;
    const apiKey=(field('aiKey')&&field('aiKey').value.trim())||LF.Storage.getApiKey(providerId);
    const button=field('loadProviderModels'),hint=field('aiModelHint'),list=field('aiModelList'),provider=LF.AIProviders[providerId]||LF.AIProviders.custom;
    if(provider.keyRequired&&!apiKey){if(hint)hint.textContent='Enter the '+(providerId==='nvidia'?'NVIDIA ':'')+'API key before loading models.';if(field('aiKey'))field('aiKey').focus();if(!options.silent)LF.UI.toast('Enter the API key before loading models.','warning');syncModelControls();return[];}
    if(button){button.disabled=true;button.textContent='Reading…';button.dataset.loading='true';}
    if(hint)hint.textContent='Reading model list and output capability…';
    activity.activityStart({title:'Detect model capabilities',subtitle:'Provider metadata · no experiment data',kind:'API',stage:'Reading model catalogue',progress:.08,cancellable:false,details:{Provider:provider.name||providerId,Endpoint:endpointHost(endpoint)},steps:[{id:'models',label:'Read available models',status:'active'},{id:'capability',label:'Resolve output / context capability',status:'pending'},{id:'apply',label:'Update provider settings view',status:'pending'}]});
    let models=[],listError=null;
    try{
      try{const result=await LF.AI.listModels(providerId,endpoint,apiKey);models=result.models||[];if(list){list.replaceChildren();models.forEach(function(id){const option=document.createElement('option');option.value=id;list.appendChild(option);});}syncModelControls(models,{preserveHint:true});saveFromForm({toast:false});activity.activityUpdate({stepId:'models',stepStatus:'done',stepNote:models.length+' found',stage:'Model catalogue received',progress:.42,message:models.length?models.length+' model'+(models.length===1?'':'s')+' available.':'No model list was exposed; capability detection will still be attempted.'});}
      catch(error){listError=error;Log.warn('models.list-failed',{provider:providerId,error:error});if(provider.modelSelect)syncModelControls(null,{manualFallback:true,preserveHint:true});activity.activityUpdate({stepId:'models',stepStatus:'done',stepNote:'list unavailable',stage:'Model list unavailable',progress:.34,message:'The provider did not expose a model list. LabFlow is still checking the configured model capability.'});}
      activity.activityUpdate({stepId:'capability',stepStatus:'active',stage:'Resolving model capability',progress:.52,message:'Reading output/context limits for the configured model.'});
      let selected=modelValue(providerId)||LF.Storage.getAiSettings().model||'';const cap=LF.AI.resolveModelCapabilities?await LF.AI.resolveModelCapabilities({provider:providerId,endpoint:endpoint,model:selected,apiKey:apiKey,force:true}):null;
      if(providerId==='lmstudio'&&cap&&cap.loadedModel&&cap.loadedModel!==selected){selected=cap.loadedModel;setModelValue(selected);const saved=LF.Storage.getAiSettings();LF.Storage.saveAiSettings(Object.assign({},saved,{provider:providerId,endpoint:endpoint,model:selected}));Log.info('model.auto-detected',{provider:providerId,model:selected,source:cap.source});}
      const capText=cap&&cap.maxOutputTokens?('max output '+Number(cap.maxOutputTokens).toLocaleString()+' tokens'):(cap&&cap.contextWindow?('context ceiling '+Number(cap.contextWindow).toLocaleString()+' tokens'):'output limit not exposed');
      if(hint)hint.textContent=(models.length?models.length+' model'+(models.length===1?'':'s')+' available · ':'')+capText+(cap&&cap.source?' · '+cap.source:'')+(listError?' · model list unavailable; manual model entry enabled':'');
      activity.activityUpdate({stepId:'capability',stepStatus:'done',stepNote:capText,stage:'Capability detected',progress:.88,details:{Model:selected,'Loaded model':cap&&cap.loadedModel||'not exposed','Model list':models.length||'not exposed','Max output':cap&&cap.maxOutputTokens?Number(cap.maxOutputTokens).toLocaleString()+' tok':'not exposed','Context window':cap&&cap.contextWindow?Number(cap.contextWindow).toLocaleString()+' tok':'not exposed',Source:cap&&cap.source||'fallback / unknown'}});
      activity.activityUpdate({stepId:'apply',stepStatus:'done',stage:'Provider metadata ready',progress:.97});
      Log.info('models.loaded',{provider:providerId,count:models.length,model:selected,capability:cap});
      activity.activityFinish({message:'Provider metadata detection completed.',response:(models.length?models.length+' models detected. ':'')+capText+(listError?'\n\nThe model catalogue itself was unavailable, but the configured model was still probed.':''),holdMs:0});
      if(listError&&!cap&&!options.silent)LF.UI.toast('Could not read provider metadata. You can still type the model name manually.','warning');
      return models;
    }catch(error){
      if(hint)hint.textContent='Could not read provider capability: '+(error.message||String(error));
      Log.warn('models.load-failed',{provider:providerId,error:error});
      activity.activityError(error,{message:'Provider metadata detection did not complete.',response:(error.message||String(error))+'\n\nYou can still type the model name manually; LabFlow will keep Action budgets bounded by their own contracts.',details:{Provider:provider.name||providerId,Endpoint:endpointHost(endpoint)},holdMs:0});
      if(!options.silent)LF.UI.toast('Could not read provider capability. The request will use the Action budget unless you force a lower cap.','warning');
      return models;
    }finally{if(button){delete button.dataset.loading;button.disabled=false;}syncModelControls(null,{preserveHint:true});}
  }

  /**
   * Send the provider's minimal connection probe. No experiment context is included.
   * Keep the completed/error totem open so provider or credential failures can be read.
  */
  async function testConnection(button) {
    const oldText = button.textContent;
    button.textContent = 'Detecting…';
    button.disabled = true;
    await loadModels({silent:true});
    const settings = saveFromForm({toast:false});
    const provider = LF.AIProviders[settings.provider] || LF.AIProviders.custom;
    button.textContent = 'Testing…';
    LF.UI.activityStart({
      title: 'Test AI connection',
      subtitle: 'Minimal request · no experiment data',
      kind: 'API',
      stage: 'Preparing request',
      progress: .15,
      cancellable: true,
      onCancel: function () { return LF.AI.cancel(); },
      showAiTrace: true,
      response: 'No provider response yet.',
      details: {Provider:provider.name || settings.provider, Model:settings.model, Endpoint:endpointHost(settings.endpoint), Timeout:Math.round((provider.connectionTestTimeoutMs||60000)/1000)+' s', Payload:'No experiment data'},
      steps: [{id:'request', label:'Send minimal provider request', status:'active'}, {id:'response', label:'Read provider response', status:'pending'}]
    });
    try {
      LF.UI.activityUpdate({stage:'Waiting for provider', indeterminate:true, message:'The direct browser request is in progress.'});
      const result = await LF.AI.testConnection({onProgress:function(p){if(!p)return;if(p.transportState==='rate_limit_wait'){LF.UI.activityUpdate({stage:'Provider reachable · rate limited',progress:.48,progressLabel:'Cooling down',message:'The model endpoint answered with a rate limit. Retrying the same probe in '+Math.max(1,Math.ceil(Number(p.retryInMs||0)/1000))+' s.'});}else if(p.transportState==='provider_pacing'){LF.UI.activityUpdate({stage:'Pacing provider probe',progress:.3,progressLabel:'Waiting to send',message:'LabFlow is spacing this Z.AI request to avoid a burst limit.'});}}});
      if(settings.provider==='lmstudio'&&result.model){setModelValue(result.model);if(result.model!==settings.model)LF.Storage.saveAiSettings(Object.assign({},settings,{model:result.model}));}
      LF.UI.activityUpdate({stepId:'request', stepStatus:'done', stepNote:result.elapsedMs + ' ms'});
      LF.UI.activityUpdate({stepId:'response', stepStatus:'done'});
      LF.UI.activityFinish({
        message: 'Provider responded successfully.',
        response: connectionReport(result),
        details: {Provider:provider.name || settings.provider, Model:result.model, 'Total elapsed':result.elapsedMs + ' ms', 'Provider round trip':Number.isFinite(Number(result.requestElapsedMs))?result.requestElapsedMs+' ms':'not measured', Tokens:result.usage&&Number.isFinite(Number(result.usage.totalTokens))?result.usage.totalTokens+(result.usage.estimated?' estimated':''):'not returned', 'Finish reason':result.finishReason||'not returned', Retries:result.rateLimitRetries||0, 'Request ID':result.requestId || 'not returned'},
        holdMs: 0
      });
      LF.UI.toast('AI connection OK · ' + result.model + ' · ' + result.elapsedMs + ' ms', 'success');
    } catch (error) {
      Log.error('connection-test.failed',{provider:settings.provider,model:settings.model,endpoint:endpointHost(settings.endpoint),error:error});
      const summary = LF.AIDiagnostics ? LF.AIDiagnostics.errorSummary(error) : {category:'Error', next:'Review provider settings.'};
      LF.UI.activityError(error, {
        response: 'What happened\n' + (error.message || String(error)) + (error.providerResponse ? '\n\nProvider response\n' + error.providerResponse : '') + '\n\nWhat to do next\n' + summary.next,
        details: {Provider:provider.name || settings.provider, Model:settings.model, Category:summary.category, Timeout:error.timeoutMs?Math.round(error.timeoutMs/1000)+' s':Math.round((provider.connectionTestTimeoutMs||60000)/1000)+' s', Elapsed:error.elapsedMs?error.elapsedMs+' ms':'', 'HTTP status':summary.status || (error.timedOut?'no response':'network'), 'Provider code':summary.providerCode || 'not returned', 'Request ID':error.requestId || 'not returned', Endpoint:endpointHost(settings.endpoint)},
        holdMs: 0
      });
    } finally {
      button.textContent = oldText;
      button.disabled = false;
    }
  }

  LF.AISettings = {decorate:decorate, saveFromForm:saveFromForm, selectProvider:selectProvider, loadModels:loadModels, testConnection:testConnection, syncModelControls:syncModelControls, modelValue:modelValue};
}());
