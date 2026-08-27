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
  function catalogueModel(provider,current,models,selectMode){provider=provider||{};current=String(current||'').trim();models=Array.isArray(models)?models.map(String).filter(Boolean):[];const preset=String(provider.model||'').trim();return current||preset||models[0]||'';}
  function catalogueChoices(provider,current,models){const catalogue=Array.from(new Set((Array.isArray(models)?models:[]).map(String).filter(Boolean))).sort(function(a,b){return a.localeCompare(b);}),choices=catalogue.slice(),configured=String(current||provider&&provider.model||'').trim();if(configured&&!choices.includes(configured))choices.unshift(configured);return{catalogue:catalogue,choices:choices};}
  function syncModelControls(models,options){options=options||{};const providerId=providerIdFromForm(),provider=LF.AIProviders[providerId]||LF.AIProviders.custom,input=field('aiModel'),select=field('aiModelSelect'),button=field('loadProviderModels'),hint=field('aiModelHint'),key=field('aiKey');if(!input||!select)return;if(!options.manualFallback&&(!Array.isArray(models)||!models.length)&&Array.isArray(modelCatalogues[providerId]))models=modelCatalogues[providerId].slice();if(select.dataset.provider!==providerId){delete select.dataset.manualFallback;delete select.dataset.catalogueCount;select.dataset.provider=providerId;select.replaceChildren();}if(options.manualFallback){select.dataset.manualFallback='true';modelCatalogueFallbacks[providerId]=true;}else if(modelCatalogueFallbacks[providerId])select.dataset.manualFallback='true';if(Array.isArray(models)&&models.length){delete select.dataset.manualFallback;delete modelCatalogueFallbacks[providerId];modelCatalogues[providerId]=models.slice();}const manualFallback=select.dataset.manualFallback==='true',selectMode=!!provider.modelSelect&&!manualFallback,current=String(input.value||modelValue(providerId)||provider.model||'');if(Array.isArray(models)&&models.length){const prepared=catalogueChoices(provider,current,models),catalogue=prepared.catalogue,choices=prepared.choices;select.replaceChildren();choices.forEach(function(id){const option=document.createElement('option');option.value=id;option.textContent=id;select.appendChild(option);});const preferred=catalogueModel(provider,current,choices,selectMode);if(selectMode){select.value=preferred;input.value=preferred;}else{input.value=preferred;if(choices.includes(preferred))select.value=preferred;}select.dataset.catalogueCount=String(catalogue.length);}else if(!select.options.length&&current){const option=document.createElement('option');option.value=current;option.textContent=current;select.appendChild(option);select.value=current;}input.hidden=selectMode;select.hidden=!selectMode;select.setAttribute('aria-label',provider.modelSelectLabel||provider.name+' model');const host=input.closest('.ai-model-control');if(host)host.dataset.modelSelect=selectMode?'true':'false';if(button&&!button.dataset.loading){button.textContent=provider.skipModelCatalogue?'Inspect':'Detect';button.disabled=!!(!provider.skipModelCatalogue&&provider.keyRequired&&!String(key&&key.value||'').trim());}if(hint&&!options.preserveHint){if(provider.keyRequired&&!String(key&&key.value||'').trim())hint.textContent='Enter the '+provider.name+' API key to enable Detect.';else if(provider.modelSelect&&manualFallback)hint.textContent='Detect could not read the '+provider.name+' catalogue. Enter an exact model ID manually, then Save & test connection.';else if(provider.skipModelCatalogue)hint.textContent='Exact model ID is used as configured. LabFlow intentionally skips the provider-wide catalogue for this provider.';else if(!select.dataset.catalogueCount)hint.textContent='Press Detect to read model capabilities and the catalogue when the provider exposes one.';}}

  /** Reduce an endpoint to a safe diagnostic host; never expose credentials or query data. */
  function endpointHost(endpoint) {
    try { return new URL(String(endpoint || '')).host; }
    catch (_) { return String(endpoint || ''); }
  }

  /** Build a readable, locally measured connection report around the tiny provider reply. */
  function connectionReport(result) {
    const usage=result.usage||{},probeLimited=result.probeLimited===true,lines=['## Provider response',probeLimited?'No final probe text · reasoning-only response within the bounded probe budget':'`'+String(result.content||'—').replace(/`/g,'\\`')+'`','','## Connection diagnostics'];
    lines.push(probeLimited?'- **Status:** reachable; Chat Completions response parsed successfully; final-text probe inconclusive':'- **Status:** reachable; response parsed successfully');
    if(probeLimited)lines.push('- **Meaning:** endpoint, model selection and request parsing work. This is not a network/authentication failure. The tiny connection probe is not used to judge normal Action quality.');
    lines.push('- **Provider / model:** '+String(result.provider||'—')+' / `'+String(result.model||'—').replace(/`/g,'\\`')+'`');
    lines.push('- **Thinking request:** '+String(result.thinkingMode||'auto'));
    lines.push('- **Total elapsed:** '+Number(result.elapsedMs||0).toLocaleString()+' ms');
    if(Number.isFinite(Number(result.requestElapsedMs)))lines.push('- **Successful provider round trip:** '+Number(result.requestElapsedMs).toLocaleString()+' ms');
    if(Number.isFinite(Number(result.elapsedMs))&&Number.isFinite(Number(result.requestElapsedMs))&&Number(result.elapsedMs)>Number(result.requestElapsedMs))lines.push('- **Local processing overhead:** '+(Number(result.elapsedMs)-Number(result.requestElapsedMs)).toLocaleString()+' ms');
    if(Number.isFinite(Number(usage.totalTokens))){lines.push('- **Tokens:** '+Number(usage.promptTokens||0).toLocaleString()+' input + '+Number(usage.completionTokens||0).toLocaleString()+' output = '+Number(usage.totalTokens).toLocaleString()+' total'+(usage.estimated?' (estimated locally)':' (reported by provider)'));}
    if(Number.isFinite(Number(result.tokensPerSecond)))lines.push('- **End-to-end output rate:** '+Number(result.tokensPerSecond).toFixed(2)+' tok/s');
    if(Number.isFinite(Number(result.responseBytes)))lines.push('- **Response payload:** '+Number(result.responseBytes).toLocaleString()+' bytes');
    lines.push('- **Finish reason:** '+(result.finishReason||'not returned'));
    lines.push('- **Automatic provider retries:** none');
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
    if (providerId === 'lmstudio' || providerId === 'ollama' || providerId === 'llamacpp') {
      const local = document.createElement('div');
      local.className = 'meta mt-1';
      local.textContent = providerId === 'lmstudio'
        ? 'LM Studio · OpenAI-compatible base http://127.0.0.1:1234/v1 · LabFlow sends POST /v1/chat/completions with a messages array. Its local API must be running and accept the current browser origin.'
        : providerId === 'llamacpp'
          ? 'llama.cpp · llama-server OpenAI-compatible base http://127.0.0.1:8080/v1 · LabFlow sends POST /v1/chat/completions and reads /v1/models. Start llama-server with a browser-reachable host/CORS configuration.'
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
    if(provider.keyRequired||provider.optionalKey){const key=field('aiKey').value.trim(),stored=LF.Storage.saveApiKey(key,settings.provider);if(stored===false)throw new Error('The '+(provider.name||settings.provider)+' API key could not be saved in this browser. Check site-storage permissions, then try again.');if(provider.keyRequired&&key&&!LF.Storage.getApiKey(settings.provider))throw new Error('The '+(provider.name||settings.provider)+' API key was not retained by this browser. Check site-storage permissions, then try again.');}
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
    if(provider.skipModelCatalogue){
      const selected=modelValue(providerId)||provider.model||'';setModelValue(selected);saveFromForm({toast:false});syncModelControls(null,{preserveHint:true});
      const cap=LF.AI&&LF.AI.knownCapability?LF.AI.knownCapability(providerId,selected):null;
      if(hint)hint.textContent='Configured model: '+selected+' · no model substitution'+(cap&&cap.contextWindow?' · model capacity '+Number(cap.contextWindow).toLocaleString()+' context tok':'')+(cap&&cap.maxOutputTokens?' / '+Number(cap.maxOutputTokens).toLocaleString()+' max output tok':'')+' · LabFlow request sizes remain bounded by each Action. Use Save & test connection to verify this API key can access exactly this model.';
      Log.info('models.catalogue-skipped',{provider:providerId,model:selected,reason:'configured-model-only'});
      if(!options.silent)LF.UI.toast('Using exact configured model: '+selected+'.','info');return selected?[selected]:[];
    }
    if(provider.keyRequired&&!apiKey){if(hint)hint.textContent='Enter the '+(providerId==='nvidia'?'NVIDIA ':'')+'API key before loading models.';if(field('aiKey'))field('aiKey').focus();if(!options.silent)LF.UI.toast('Enter the API key before loading models.','warning');syncModelControls();return[];}
    if(button){button.disabled=true;button.textContent='Reading…';button.dataset.loading='true';}
    if(hint)hint.textContent='Reading model list and output capability…';
    activity.activityStart({title:'Detect model capabilities',subtitle:'Provider metadata · no experiment data',kind:'API',stage:'Reading model catalogue',progress:.08,cancellable:false,details:{Provider:provider.name||providerId,Endpoint:endpointHost(endpoint)},steps:[{id:'models',label:'Read available models',status:'active'},{id:'capability',label:'Resolve output / context capability',status:'pending'},{id:'apply',label:'Update provider settings view',status:'pending'}]});
    let models=[],listError=null;
    try{
      try{const result=await LF.AI.listModels(providerId,endpoint,apiKey),loaded=Array.isArray(result.loadedModels)?result.loadedModels.filter(Boolean):[];models=result.models||[];const detectedChoices=Array.from(new Set(models.concat(loaded)));if(list){list.replaceChildren();detectedChoices.forEach(function(id){const option=document.createElement('option');option.value=id;list.appendChild(option);});}if((providerId==='lmstudio'||providerId==='ollama'||providerId==='llamacpp')&&loaded.length===1)setModelValue(loaded[0]);syncModelControls(detectedChoices,{preserveHint:true});saveFromForm({toast:false});activity.activityUpdate({stepId:'models',stepStatus:'done',stepNote:models.length+' found'+(loaded.length?' · '+loaded.length+' running':''),stage:'Model catalogue received',progress:.42,message:models.length?models.length+' model'+(models.length===1?'':'s')+' available.'+(loaded.length===1?' Running model selected: '+loaded[0]+'.':loaded.length>1?' '+loaded.length+' models are running; the current selection was preserved.':''):'No model list was exposed; capability detection will still be attempted.'});}
      catch(error){listError=error;Log.warn('models.list-failed',{provider:providerId,error:error});if(provider.modelSelect)syncModelControls(null,{manualFallback:true,preserveHint:true});const isLocal=['ollama','lmstudio','llamacpp'].includes(providerId),localHint=isLocal?' Local server not reachable or CORS blocked. Ensure '+provider.name+' is running and allows the browser origin (for Ollama: OLLAMA_ORIGINS, LM Studio: CORS enabled, llama.cpp: --host 127.0.0.1 --port 8080).':'';activity.activityUpdate({stepId:'models',stepStatus:'done',stepNote:'list unavailable',stage:'Model list unavailable',progress:.34,message:'The provider did not expose a model list.'+localHint+' LabFlow is still checking the configured model capability.'});}
      activity.activityUpdate({stepId:'capability',stepStatus:'active',stage:'Resolving model capability',progress:.52,message:'Reading output/context limits for the configured model.'});
      const selected=modelValue(providerId)||LF.Storage.getAiSettings().model||'',cap=LF.AI.resolveModelCapabilities?await LF.AI.resolveModelCapabilities({provider:providerId,endpoint:endpoint,model:selected,apiKey:apiKey,force:true}):null;
      const capBits=[];if(cap&&cap.contextWindow)capBits.push(Number(cap.contextWindow).toLocaleString()+' context tok');if(cap&&cap.maxOutputTokens)capBits.push(Number(cap.maxOutputTokens).toLocaleString()+' max output tok');if(cap&&cap.totalSlots)capBits.push(Number(cap.totalSlots)+' slot'+(Number(cap.totalSlots)===1?'':'s'));const capText=capBits.length?('model capacity '+capBits.join(' / ')):'model capacity not exposed',reasoningText=cap&&cap.reasoningStatus&&cap.reasoningStatus!=='unknown'?('thinking '+cap.reasoningStatus):(provider.safeThinkingOverrideWhenUnknown?'thinking metadata not exposed · request control available':'thinking capability not exposed'),runtimeProfileText=providerId==='llamacpp'&&cap&&cap.runtimeProfileMessage?cap.runtimeProfileMessage:'';
      if(hint)hint.textContent=(models.length?models.length+' model'+(models.length===1?'':'s')+' available · ':'')+capText+' · '+reasoningText+(runtimeProfileText?' · '+runtimeProfileText:'')+(cap&&cap.source?' · '+cap.source:'')+(listError?' · model list unavailable; manual model entry enabled':'');
      activity.activityUpdate({stepId:'capability',stepStatus:'done',stepNote:capText+' · '+reasoningText+(runtimeProfileText?' · '+runtimeProfileText:''),stage:'Capability detected',progress:.88,details:{Model:selected,'Loaded model':cap&&cap.loadedModel||'not exposed','Model list':models.length||'not exposed','Max output':cap&&cap.maxOutputTokens?Number(cap.maxOutputTokens).toLocaleString()+' tok':'not exposed','Context window':cap&&cap.contextWindow?Number(cap.contextWindow).toLocaleString()+' tok':'not exposed','Server slots':cap&&cap.totalSlots?Number(cap.totalSlots):'not exposed','LabFlow llama.cpp profile':providerId==='llamacpp'?(runtimeProfileText||'not exposed'):'n/a','Thinking capability':cap&&cap.reasoningStatus||'unknown','Thinking options':cap&&cap.reasoningAllowedOptions&&cap.reasoningAllowedOptions.length?cap.reasoningAllowedOptions.join(', '):'not exposed',Source:cap&&cap.source||'fallback / unknown'}});
      activity.activityUpdate({stepId:'apply',stepStatus:'done',stage:'Provider metadata ready',progress:.97});
      Log.info('models.loaded',{provider:providerId,count:models.length,model:selected,capability:cap});
      activity.activityFinish({message:cap&&cap.runtimeProfileStatus==='mismatch'?'Provider metadata detected · llama.cpp runtime differs from the LabFlow profile.':'Provider metadata detection completed.',response:(models.length?models.length+' models detected. ':'')+capText+'.'+(runtimeProfileText?' '+runtimeProfileText+'.':'')+' LabFlow Action requests remain much smaller and use explicit per-Action input/output caps.'+(cap&&cap.runtimeProfileStatus==='mismatch'?'\n\nRecommended llama.cpp runtime for this LabFlow profile: --parallel 1 --ctx-size 65536. Detect never divides the n_ctx reported by /props a second time.':'')+(listError?'\n\nThe model catalogue itself was unavailable, but the configured model was still probed.':''),holdMs:0});
      if(cap&&cap.runtimeProfileStatus==='mismatch'&&!options.silent)LF.UI.toast('llama.cpp runtime differs from LabFlow profile: use --parallel 1 --ctx-size 65536 for the full 65K Action context.','warning');
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
    button.textContent = 'Saving…';
    button.disabled = true;
    let settings;
    try{settings=saveFromForm({toast:false});}
    catch(error){button.textContent=oldText;button.disabled=false;LF.UI.activityError(error,{response:'What happened\n'+(error.message||String(error))+'\n\nWhat to do next\nAllow site storage for LabFlow and save the provider again.',holdMs:0});return;}
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
      details: {Provider:provider.name || settings.provider, Model:settings.model, Endpoint:endpointHost(settings.endpoint), Timeout:Math.round((provider.connectionTestTimeoutMs||15000)/1000)+' s', Payload:'No experiment data'},
      steps: [{id:'request', label:'Send minimal provider request', status:'active'}, {id:'response', label:'Read provider response', status:'pending'}]
    });
    try {
      LF.UI.activityUpdate({stage:'Waiting for provider', indeterminate:true, message:'The direct browser request is in progress.'});
      const result = await LF.AI.testConnection();
      if(result.rateLimited){
        const retryS=Number(result.retryAfterMs||result.retryInMs||0)>0?Math.max(1,Math.ceil(Number(result.retryAfterMs||result.retryInMs)/1000)):0;
        LF.UI.activityUpdate({stepId:'request',stepStatus:'done',stepNote:result.elapsedMs+' ms'});
        LF.UI.activityUpdate({stepId:'response',stepStatus:'done',stepNote:'rate limited'});
        LF.UI.activityFinish({message:'Provider reachable, but rate limited.',response:'The configured endpoint answered with a provider rate-limit response. LabFlow sent exactly one request, did not retry it, and did not create a local cooldown.'+(retryS?' The provider asked to retry after about '+retryS+' s.':''),details:{Provider:provider.name||settings.provider,Model:settings.model,'Total elapsed':result.elapsedMs+' ms','HTTP status':result.status||429,'Provider code':result.providerCode||'not returned','Provider message':result.providerMessage||'not returned','HTTP requests':1,'Automatic retries':0,'Retry-After':retryS?retryS+' s':'not returned'},holdMs:0});
        LF.UI.toast('Provider reachable, but rate limited. No local cooldown was created.','warning');return;
      }
      LF.UI.activityUpdate({stepId:'request', stepStatus:'done', stepNote:result.elapsedMs + ' ms'});
      LF.UI.activityUpdate({stepId:'response', stepStatus:'done', stepNote:result.probeLimited?'reasoning-only · reachable':'final text received'});
      LF.UI.activityFinish({
        message: result.probeLimited?'Provider reachable · final-text probe inconclusive.':'Provider responded successfully.',
        response: connectionReport(result),
        details: {Provider:provider.name || settings.provider, Model:result.model, 'Total elapsed':result.elapsedMs + ' ms', 'Provider round trip':Number.isFinite(Number(result.requestElapsedMs))?result.requestElapsedMs+' ms':'not measured', Tokens:result.usage&&Number.isFinite(Number(result.usage.totalTokens))?result.usage.totalTokens+(result.usage.estimated?' estimated':''):'not returned', 'Finish reason':result.finishReason||'not returned', 'Final text':result.probeLimited?'not verified by tiny probe':'verified', 'Reasoning observed':result.reasoningObserved?'yes':'no', 'HTTP requests':result.httpRequests||1, Retries:0, 'Request ID':result.requestId || 'not returned'},
        holdMs: 0
      });
      LF.UI.toast((result.probeLimited?'AI endpoint reachable · ':'AI connection OK · ') + result.model + ' · ' + result.elapsedMs + ' ms', result.probeLimited?'warning':'success');
    } catch (error) {
      Log.error('connection-test.failed',{provider:settings.provider,model:settings.model,endpoint:endpointHost(settings.endpoint),error:error});
      const summary = LF.AIDiagnostics ? LF.AIDiagnostics.errorSummary(error) : {category:'Error', next:'Review provider settings.'};
      LF.UI.activityError(error, {
        response: 'What happened\n' + (error.message || String(error)) + (error.providerResponse ? '\n\nProvider response\n' + error.providerResponse : '') + '\n\nWhat to do next\n' + summary.next,
        details: {Provider:provider.name || settings.provider, Model:settings.model, Category:summary.category, Timeout:error.timeoutMs?Math.round(error.timeoutMs/1000)+' s':Math.round((provider.connectionTestTimeoutMs||15000)/1000)+' s', Elapsed:error.elapsedMs?error.elapsedMs+' ms':'', 'HTTP status':summary.status || (error.timedOut?'no response':'network'), 'Provider code':summary.providerCode || 'not returned', 'Request ID':error.requestId || 'not returned', Endpoint:endpointHost(settings.endpoint)},
        holdMs: 0
      });
    } finally {
      button.textContent = oldText;
      button.disabled = false;
    }
  }

  LF.AISettings = {decorate:decorate, saveFromForm:saveFromForm, selectProvider:selectProvider, loadModels:loadModels, testConnection:testConnection, syncModelControls:syncModelControls, modelValue:modelValue, catalogueModel:catalogueModel, catalogueChoices:catalogueChoices};
}());
