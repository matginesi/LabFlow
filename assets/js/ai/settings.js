(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const Log = LF.Logger.scope('ai-settings');
  const modelCatalogues={};
  const modelCatalogueMeta={};
  const modelCatalogueFallbacks={};

  /** Return an element by ID. Settings is dynamically rendered, so resolve lazily. */
  function field(id) { return document.getElementById(id); }

  function providerIdFromForm(){return(field('aiProvider')&&field('aiProvider').value)||LF.Storage.getAiSettings().provider;}
  function activeModelField(providerId){const provider=LF.AIProviders[providerId||providerIdFromForm()]||LF.AIProviders.custom;return provider.modelSelect&&field('aiModelSelect')&&!field('aiModelSelect').hidden?field('aiModelSelect'):field('aiModel');}
  function modelLabel(providerId,value){const raw=String(value==null?'':value),meta=modelCatalogueMeta[providerId]&&modelCatalogueMeta[providerId][raw],base=LF.Core&&LF.Core.modelDisplayName?LF.Core.modelDisplayName(providerId,raw):raw;return meta&&meta.free?base+' · Free':base;}
  function localProvider(providerId){const provider=LF.AIProviders[providerId||providerIdFromForm()]||LF.AIProviders.custom;return provider.local===true;}
  function setInputModel(input,providerId,value){if(!input)return;const raw=String(value||'');if(localProvider(providerId)&&raw){input.dataset.rawModel=raw;input.value=modelLabel(providerId,raw);}else{delete input.dataset.rawModel;input.value=raw;}}
  function modelValue(providerId){const model=activeModelField(providerId);if(!model)return'';const shown=String(model.value||'').trim(),raw=String(model.dataset&&model.dataset.rawModel||'').trim();if(raw&&shown===modelLabel(providerId,raw))return raw;return shown;}
  function setModelValue(value){value=String(value||'');const input=field('aiModel'),select=field('aiModelSelect'),providerId=providerIdFromForm();setInputModel(input,providerId,value);if(select){if(value&&!Array.from(select.options).some(function(option){return option.value===value;})){const option=document.createElement('option');option.value=value;option.textContent=modelLabel(providerId,value);select.appendChild(option);}select.value=value;}}
  function catalogueModel(provider,current,models){provider=provider||{};current=String(current||'').trim();models=Array.isArray(models)?models.map(String).filter(Boolean):[];const preset=String(provider.model||'').trim();if(current&&models.includes(current))return current;if(preset&&models.includes(preset))return preset;return models[0]||current||preset||'';}
  function catalogueChoices(provider,current,models){const providerId=providerIdFromForm(),meta=modelCatalogueMeta[providerId]||{},catalogue=Array.from(new Set((Array.isArray(models)?models:[]).map(String).filter(Boolean))).sort(function(a,b){if(providerId==='openrouter'){const af=meta[a]&&meta[a].free?1:0,bf=meta[b]&&meta[b].free?1:0;if(af!==bf)return bf-af;}return a.localeCompare(b);});return{catalogue:catalogue,choices:catalogue.slice()};}
  function syncModelControls(models,options){options=options||{};const providerId=providerIdFromForm(),provider=LF.AIProviders[providerId]||LF.AIProviders.custom,input=field('aiModel'),select=field('aiModelSelect'),button=field('detectProviderModel'),hint=field('aiModelHint'),key=field('aiKey');if(!input||!select)return;if(!options.manualFallback&&(!Array.isArray(models)||!models.length)&&Array.isArray(modelCatalogues[providerId]))models=modelCatalogues[providerId].slice();if(select.dataset.provider!==providerId){delete select.dataset.manualFallback;delete select.dataset.catalogueCount;select.dataset.provider=providerId;select.replaceChildren();}if(options.manualFallback){select.dataset.manualFallback='true';modelCatalogueFallbacks[providerId]=true;}else if(modelCatalogueFallbacks[providerId])select.dataset.manualFallback='true';if(Array.isArray(models)&&models.length){delete select.dataset.manualFallback;delete modelCatalogueFallbacks[providerId];modelCatalogues[providerId]=models.slice();}const manualFallback=select.dataset.manualFallback==='true',selectMode=!!provider.modelSelect&&!manualFallback,current=String(modelValue(providerId)||provider.model||'');if(Array.isArray(models)&&models.length){const prepared=catalogueChoices(provider,current,models),catalogue=prepared.catalogue,choices=prepared.choices;select.replaceChildren();choices.forEach(function(id){const option=document.createElement('option');option.value=id;option.textContent=modelLabel(providerId,id);select.appendChild(option);});const preferred=catalogueModel(provider,current,choices);if(selectMode){select.value=preferred;setInputModel(input,providerId,preferred);}else{setInputModel(input,providerId,preferred);if(choices.includes(preferred))select.value=preferred;}select.dataset.catalogueCount=String(catalogue.length);}else if(!select.options.length&&current){const option=document.createElement('option');option.value=current;option.textContent=modelLabel(providerId,current);select.appendChild(option);select.value=current;}input.hidden=selectMode;select.hidden=!selectMode;select.setAttribute('aria-label',provider.modelSelectLabel||provider.name+' model');const host=input.closest('.ai-model-control');if(host)host.dataset.modelSelect=selectMode?'true':'false';if(button&&!button.dataset.loading){button.textContent='Detect';button.disabled=false;}if(hint&&!options.preserveHint){if(provider.keyRequired&&!String(key&&key.value||'').trim())hint.textContent='API key required. Detect will fail until it is provided.';else if(provider.modelSelect&&manualFallback)hint.textContent='Detect could not read the '+provider.name+' catalogue. Enter an exact model ID manually, then Save & test connection.';else if(provider.remoteModelMetadata===false)hint.textContent='Press Detect to inspect the exact configured model using built-in capability metadata. No provider-wide model catalogue is queried or substituted.';else if(!select.dataset.catalogueCount)hint.textContent='Press Detect to read model capabilities and the catalogue when the provider exposes one.';}}

  /** Reduce an endpoint to a safe diagnostic host; never expose credentials or query data. */
  function endpointHost(endpoint) {
    try { return new URL(String(endpoint || '')).host; }
    catch (_) { return String(endpoint || ''); }
  }

  /** Provider operations use the shared Message Totem; Settings keeps no parallel status surface. */
  function notify(message,type,title){if(LF.UI&&LF.UI.message)LF.UI.message(message,type||'info',title||'AI provider');}

  function clearFieldErrors(){document.querySelectorAll('.settings-content .field-error').forEach(function(node){node.remove();});document.querySelectorAll('.settings-content [aria-invalid="true"]').forEach(function(node){node.removeAttribute('aria-invalid');});}
  function invalidField(id,message){const input=field(id),wrap=input&&input.closest('.field');if(input){input.setAttribute('aria-invalid','true');input.focus();}if(wrap){const error=document.createElement('div');error.className='field-error';error.textContent=message;wrap.appendChild(error);}throw new Error(message);}

  /** Keep the provider page compact: classify the target, do not pretend it has been tested. */
  function decorate() {
    const providerSelect=field('aiProvider');
    if(!providerSelect)return;
    const saved=LF.Storage.getAiSettings(),providerId=providerSelect.value||saved.provider,provider=LF.AIProviders[providerId]||LF.AIProviders.custom,endpointField=field('aiEndpoint'),endpoint=endpointField?endpointField.value.trim():saved.endpoint;
    let parsed=null;try{parsed=new URL(endpoint);}catch(_){}
    const space=LF.AI&&LF.AI.targetAddressSpace?LF.AI.targetAddressSpace(endpoint):'',host=parsed?parsed.hostname:'';
    const summary=field('aiConnectivityText'),badge=field('aiConnectivityBadge'),endpointHint=field('aiEndpointHint');
    if(provider.local===true){
      if(space==='loopback'){if(summary)summary.textContent='Same device only · '+(host||'loopback');if(badge){badge.className='badge warning';badge.textContent='LOOPBACK';}}
      else if(space==='local'){if(summary)summary.textContent='Local network · '+(host||'configured host');if(badge){badge.className='badge info';badge.textContent='LAN';}}
      else{if(summary)summary.textContent='Custom network target · '+(host||'unresolved');if(badge){badge.className='badge info';badge.textContent='CUSTOM';}}
      if(endpointHint)endpointHint.innerHTML='Same device: <span class="mono">127.0.0.1</span>. Another device: prefer <span class="mono">fedora.local</span> or a private IP; the server must listen beyond loopback and allow browser CORS.';
    }else{
      if(summary)summary.textContent='Remote API · '+(host||provider.name||providerId);
      if(badge){badge.className='badge info';badge.textContent='REMOTE';}
    }
    const keyField=field('aiKey'),keyWrap=document.querySelector('[data-ai-key-field]'),keyHint=field('aiKeyHint'),providerUsesKey=!!(provider&&(provider.keyRequired||provider.optionalKey));
    if(keyField){keyField.disabled=!providerUsesKey;keyField.placeholder=providerUsesKey?'Stored separately for this provider…':'Not used by this provider';if(!providerUsesKey)keyField.value='';}
    if(keyWrap)keyWrap.classList.toggle('settings-key-unused',!providerUsesKey);
    if(keyHint)keyHint.textContent=provider.keyRequired?'Required. Detect and Save & test fail without it.':provider.optionalKey?'Optional; only needed if this endpoint requires authentication.':'This provider does not use an API key.';
    const testButton=field('testAiConnection');if(testButton)testButton.textContent='Save & test';
    syncModelControls(null,{preserveHint:true});
  }

  /** Read exactly what is visible in Settings; never substitute saved/default connection values. */
  function connectionFromForm(){
    const providerId=providerIdFromForm(),provider=LF.AIProviders[providerId]||LF.AIProviders.custom;
    return{providerId:providerId,provider:provider,endpoint:String(field('aiEndpoint')&&field('aiEndpoint').value||'').trim(),model:String(modelValue(providerId)||'').trim(),apiKey:String(field('aiKey')&&field('aiKey').value||'').trim()};
  }
  function validateConnectionForm(config,options){
    options=options||{};
    clearFieldErrors();
    if(!config.endpoint)invalidField('aiEndpoint','Enter the provider endpoint.');
    let endpointUrl;try{endpointUrl=new URL(config.endpoint);}catch(_){invalidField('aiEndpoint','Enter a complete http(s) endpoint URL.');}
    if(endpointUrl&&!['http:','https:'].includes(endpointUrl.protocol))invalidField('aiEndpoint','Use an http:// or https:// endpoint.');
    if(!config.model&&!(options.allowCatalogueModel===true&&config.provider.modelSelect===true))invalidField(config.provider.modelSelect?'aiModelSelect':'aiModel','Choose or enter an exact model ID.');
    if(config.provider.keyRequired&&!config.apiKey)invalidField('aiKey','Enter the '+(config.provider.name||config.providerId)+' API key.');
    return config;
  }

  /** Persist the visible provider form. Experiment data is intentionally untouched. */
  function saveFromForm(options) {
    const providerField = field('aiProvider');
    if (!providerField) throw new Error('AI provider settings are not visible.');
    clearFieldErrors();
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
    const provider=LF.AIProviders[settings.provider]||LF.AIProviders.custom,key=String(field('aiKey')&&field('aiKey').value||'').trim();
    validateConnectionForm({providerId:settings.provider,provider:provider,endpoint:settings.endpoint,model:settings.model,apiKey:key});
    LF.Storage.saveAiSettings(settings);
    if(provider.keyRequired||provider.optionalKey){const stored=LF.Storage.saveApiKey(key,settings.provider);if(stored===false)throw new Error('The '+(provider.name||settings.provider)+' API key could not be saved in this browser. Check site-storage permissions, then try again.');if(provider.keyRequired&&key&&!LF.Storage.getApiKey(settings.provider))throw new Error('The '+(provider.name||settings.provider)+' API key was not retained by this browser. Check site-storage permissions, then try again.');}
    Log.info('saved', {provider:settings.provider, endpoint:settings.endpoint, model:settings.model});
    if(LF.SettingsPage&&LF.SettingsPage.markSaved)LF.SettingsPage.markSaved();
    if (!options || options.toast !== false) LF.UI.message('AI provider saved.', 'success');
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

  /** Detect against the exact visible configuration and fail closed on auth/network/catalogue errors. */
  async function detectModel(options) {
    options=options||{};
    const button=field('detectProviderModel'),list=field('aiModelList');
    let config;
    try{config=validateConnectionForm(connectionFromForm(),{allowCatalogueModel:true});}
    catch(error){if(!options.silent)notify(error.message||String(error),'error','Detect failed');return[];}
    const providerId=config.providerId,provider=config.provider,endpoint=config.endpoint,apiKey=config.apiKey;
    const oldText=button&&button.textContent||'Detect';
    if(button){button.disabled=true;button.textContent='Detecting…';button.dataset.loading='true';}
    try{
      let models=[],loaded=[],catalogueSkipped=false;
      if(provider.modelSelect){
        const result=await LF.AI.listModels(providerId,endpoint,apiKey);
        models=Array.isArray(result.models)?result.models.filter(Boolean):[];
        loaded=Array.isArray(result.loadedModels)?result.loadedModels.filter(Boolean):[];
        catalogueSkipped=result.skipped===true;
        if(Array.isArray(result.entries)){modelCatalogueMeta[providerId]={};result.entries.forEach(function(entry){if(entry&&entry.id)modelCatalogueMeta[providerId][String(entry.id)]=entry;});}
        if(!catalogueSkipped&&!models.length)throw new Error((provider.name||providerId)+' returned an empty model catalogue.');
        const detectedChoices=Array.from(new Set(models.concat(loaded)));
        if(list){list.replaceChildren();detectedChoices.forEach(function(id){const option=document.createElement('option');option.value=id;list.appendChild(option);});}
        syncModelControls(detectedChoices.length?detectedChoices:null,{preserveHint:true});
        if(provider.local===true&&loaded.length===1)setModelValue(loaded[0]);
        else if(models.length)setModelValue(catalogueModel(provider,config.model,models));
      }
      const selected=String(modelValue(providerId)||config.model||'').trim();
      if(!selected)throw new Error('No model is selected after provider discovery.');
      const probe=await LF.AI.testConnection({provider:providerId,endpoint:endpoint,model:selected,apiKey:apiKey});
      if(probe&&probe.rateLimited)throw new Error((provider.name||providerId)+' is reachable but rate limited; Detect cannot verify the model right now.');
      if(!probe||probe.ok!==true)throw new Error((provider.name||providerId)+' did not pass the connection probe.');
      const cap=LF.AI.resolveModelCapabilities?await LF.AI.resolveModelCapabilities({provider:providerId,endpoint:endpoint,model:selected,apiKey:apiKey,force:true}):null;
      Log.info('detect.ok',{provider:providerId,endpoint:endpointHost(endpoint),model:selected,models:models.length,loaded:loaded.length,capability:cap&&{contextWindow:cap.contextWindow,maxOutputTokens:cap.maxOutputTokens,source:cap.source}});
      if(!options.silent)notify((provider.name||providerId)+' reachable. '+(models.length?models.length+' models detected; ':'')+'using '+modelLabel(providerId,selected)+'.','success','Detect completed');
      if(cap&&cap.runtimeProfileStatus==='mismatch'&&!options.silent)notify(cap.runtimeProfileMessage||'llama.cpp runtime differs from the recommended LabFlow profile.','warning','llama.cpp runtime');
      return models;
    }catch(error){
      if(provider.modelSelect)syncModelControls(null,{manualFallback:true,preserveHint:true});
      Log.error('detect.failed',{provider:providerId,endpoint:endpointHost(endpoint),model:config.model,error:error});
      if(!options.silent)notify(error.message||String(error),'error','Detect failed');
      return[];
    }finally{
      if(button){delete button.dataset.loading;button.disabled=false;button.textContent=oldText;}
      syncModelControls(null,{preserveHint:true});
    }
  }

  /** Save and probe the exact visible provider configuration; feedback is Message Totem only. */
  async function testConnection(button) {
    const oldText=button&&button.textContent||'Save & test';
    if(button){button.textContent='Saving…';button.disabled=true;}
    let settings,config;
    try{
      config=validateConnectionForm(connectionFromForm());
      settings=saveFromForm({toast:false});
    }catch(error){
      if(button){button.textContent=oldText;button.disabled=false;}
      notify(error.message||String(error),'error','Save & test failed');
      return null;
    }
    const provider=config.provider;
    if(button)button.textContent='Testing…';
    try{
      const result=await LF.AI.testConnection({provider:settings.provider,endpoint:settings.endpoint,model:settings.model,apiKey:config.apiKey});
      if(result.rateLimited){
        const retryS=Number(result.retryAfterMs||0)>0?Math.max(1,Math.ceil(Number(result.retryAfterMs)/1000)):0;
        const text=(provider.name||settings.provider)+' is reachable but rate limited'+(retryS?' · retry after about '+retryS+' s':'')+'.';
        Log.warn('connection-test.rate-limited',{provider:settings.provider,model:settings.model,endpoint:endpointHost(settings.endpoint),retryAfterMs:result.retryAfterMs||0});
        notify(text,'warning','Connection not ready');
        return result;
      }
      Log.info('connection-test.ok',{provider:settings.provider,model:settings.model,endpoint:endpointHost(settings.endpoint),elapsedMs:result.elapsedMs,requestId:result.requestId||''});
      notify((provider.name||settings.provider)+' connection verified with '+modelLabel(settings.provider,result.model||settings.model)+'.','success','Save & test completed');
      return result;
    }catch(error){
      Log.error('connection-test.failed',{provider:settings.provider,model:settings.model,endpoint:endpointHost(settings.endpoint),error:error});
      const summary=LF.AIDiagnostics?LF.AIDiagnostics.errorSummary(error):null,next=summary&&summary.next?(' '+summary.next):'';
      notify((error.message||String(error))+next,'error','Save & test failed');
      return null;
    }finally{
      if(button){button.textContent=oldText;button.disabled=false;}
    }
  }

  LF.AISettings = {decorate:decorate, saveFromForm:saveFromForm, selectProvider:selectProvider, detectModel:detectModel, testConnection:testConnection, syncModelControls:syncModelControls};
}());
