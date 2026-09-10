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

  /** Simple Settings feedback uses the Message Totem. Detect/Save & test use the Action Totem below. */
  function notify(message,type,title){if(LF.UI&&LF.UI.message)LF.UI.message(message,type||'info',title||'AI provider');}

  function canStartProviderActivity(){
    const actionBusy=LF.ActionRunner&&typeof LF.ActionRunner.isRunning==='function'&&LF.ActionRunner.isRunning();
    const aiBusy=LF.AI&&typeof LF.AI.isBusy==='function'&&LF.AI.isBusy();
    if(actionBusy||aiBusy){notify('Another AI/Action operation is already running.','warning','Provider check unavailable');return false;}
    return true;
  }
  function startProviderActivity(title,subtitle,draft,steps){
    if(!LF.UI||typeof LF.UI.activityStart!=='function')return false;
    const provider=draft&&draft.provider||{},providerId=draft&&draft.providerId||'',endpoint=draft&&draft.endpoint||'',model=draft&&draft.model||'';
    LF.UI.activityStart({title:title,subtitle:subtitle,kind:'AI',stage:'Validating settings',progress:.04,cancellable:false,showAiTrace:false,message:'Using the values currently visible in Settings.',details:{Provider:provider.name||providerId||'—',Endpoint:endpointHost(endpoint)||'—',Model:model?modelLabel(providerId,model):'To be detected'},steps:steps});
    return true;
  }
  function updateProviderActivity(options){if(LF.UI&&typeof LF.UI.activityUpdate==='function')LF.UI.activityUpdate(options||{});}
  function finishProviderActivity(options){if(LF.UI&&typeof LF.UI.activityFinish==='function')LF.UI.activityFinish(Object.assign({holdMs:0},options||{}));}
  function failProviderActivity(error,options){if(LF.UI&&typeof LF.UI.activityError==='function')LF.UI.activityError(error,Object.assign({holdMs:0},options||{}));}

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

  /** Detect against the exact visible configuration. Catalogue discovery is useful
      but never allowed to fake connectivity; the final chat probe is authoritative. */
  async function detectModel(options) {
    options=options||{};
    const button=field('detectProviderModel'),list=field('aiModelList'),diagnosticId=LF.Core&&LF.Core.uid?LF.Core.uid('detect'):'detect_'+Date.now();
    const draft=connectionFromForm(),useActivity=!options.silent&&canStartProviderActivity();
    if(!options.silent&&!useActivity)return[];
    if(useActivity)startProviderActivity('Detect AI provider','Live catalogue + Chat Completions probe',draft,[
      {id:'validate',label:'Validate visible settings',status:'active'},
      {id:'catalogue',label:'Discover available models',status:'pending'},
      {id:'probe',label:'Run live LLM probe',status:'pending'},
      {id:'capabilities',label:'Resolve model capabilities',status:'pending'}
    ]);
    let config;
    try{
      config=validateConnectionForm(draft,{allowCatalogueModel:true});
      if(useActivity)updateProviderActivity({stepId:'validate',stepStatus:'done',stepNote:'Visible settings accepted',stage:'Discovering models',progress:.16});
    }catch(error){
      Log.error('detect.failed',{diagnosticId:diagnosticId,phase:'validate',error:error});
      if(useActivity)failProviderActivity(error,{stage:'Validation failed',message:'Detect could not start.',response:error.message||String(error),details:{Phase:'validate',Diagnostic:diagnosticId}});
      return[];
    }
    const providerId=config.providerId,provider=config.provider,endpoint=config.endpoint,apiKey=config.apiKey;
    const oldText=button&&button.textContent||'Detect';
    if(button){button.disabled=true;button.textContent='Detecting…';button.dataset.loading='true';}
    Log.info('detect.start',{diagnosticId:diagnosticId,provider:providerId,endpoint:endpointHost(endpoint),model:config.model||'',keyConfigured:!!apiKey,source:'visible-form',origin:typeof location!=='undefined'?location.origin:'',targetAddressSpace:LF.AI&&LF.AI.targetAddressSpace?LF.AI.targetAddressSpace(endpoint):'',transport:'direct'});
    try{
      let models=[],loaded=[],catalogueSkipped=false,catalogueError=null;
      if(provider.modelSelect){
        if(useActivity)updateProviderActivity({stepId:'catalogue',stepStatus:'active',stage:'Discovering models',message:'Reading the provider catalogue from the configured endpoint.',progress:.22});
        Log.info('detect.stage',{diagnosticId:diagnosticId,provider:providerId,phase:'catalogue',status:'start'});
        try{
          const result=await LF.AI.listModels(providerId,endpoint,apiKey,{diagnosticId:diagnosticId});
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
          if(useActivity)updateProviderActivity({stepId:'catalogue',stepStatus:'done',stepNote:catalogueSkipped?'Built-in catalogue':models.length+' model'+(models.length===1?'':'s'),stage:'Preparing live probe',progress:.42,details:{Models:models.length,Loaded:loaded.length}});
          Log.info('detect.stage',{diagnosticId:diagnosticId,provider:providerId,phase:'catalogue',status:'ok',models:models.length,loaded:loaded.length});
        }catch(error){
          catalogueError=error;
          const fallbackAllowed=provider.local!==true&&provider.catalogueFallbackToConfiguredModel===true&&!!String(config.model||provider.model||'').trim();
          Log.warn('detect.stage',{diagnosticId:diagnosticId,provider:providerId,phase:'catalogue',status:fallbackAllowed?'fallback':'failed',error:error});
          if(!fallbackAllowed)throw error;
          syncModelControls(null,{manualFallback:true,preserveHint:true});
          if(!config.model&&provider.model)setModelValue(provider.model);
          if(useActivity)updateProviderActivity({stepId:'catalogue',stepStatus:'done',stepNote:'Catalogue unavailable; probing configured model',stage:'Preparing live probe',progress:.42});
        }
      }else if(useActivity){
        updateProviderActivity({stepId:'catalogue',stepStatus:'done',stepNote:'Not required for this provider',stage:'Preparing live probe',progress:.42});
      }
      const selected=String(modelValue(providerId)||config.model||provider.model||'').trim();
      if(!selected)throw new Error('No model is selected after provider discovery.');
      if(useActivity)updateProviderActivity({stepId:'probe',stepStatus:'active',stage:'Testing the LLM',message:'Sending a minimal Chat Completions request to '+(provider.name||providerId)+'.',progress:.52,details:{Model:modelLabel(providerId,selected),Transport:'direct'}});
      Log.info('detect.stage',{diagnosticId:diagnosticId,provider:providerId,phase:'chat-probe',status:'start',model:selected});
      const probe=await LF.AI.testConnection({provider:providerId,endpoint:endpoint,model:selected,apiKey:apiKey,diagnosticId:diagnosticId});
      if(probe&&probe.rateLimited)throw new Error((provider.name||providerId)+' is reachable but rate limited; Detect cannot verify the model right now.');
      if(!probe||probe.ok!==true)throw new Error((provider.name||providerId)+' did not pass the connection probe.');
      if(useActivity)updateProviderActivity({stepId:'probe',stepStatus:'done',stepNote:(probe.elapsedMs?Math.round(probe.elapsedMs)+' ms':'Live response received'),stepId:'probe',stage:'Resolving capabilities',progress:.78});
      Log.info('detect.stage',{diagnosticId:diagnosticId,provider:providerId,phase:'chat-probe',status:'ok',model:selected,elapsedMs:probe.elapsedMs||null,transport:probe.transport||'direct'});
      if(useActivity)updateProviderActivity({stepId:'capabilities',stepStatus:'active',stage:'Resolving capabilities',message:'Inspecting known/runtime model capabilities.',progress:.84});
      Log.info('detect.stage',{diagnosticId:diagnosticId,provider:providerId,phase:'capabilities',status:'start',model:selected});
      const cap=LF.AI.resolveModelCapabilities?await LF.AI.resolveModelCapabilities({provider:providerId,endpoint:endpoint,model:selected,apiKey:apiKey,force:true}):null;
      if(useActivity)updateProviderActivity({stepId:'capabilities',stepStatus:'done',stepNote:cap&&cap.source||'Conservative defaults',progress:.96});
      Log.info('detect.stage',{diagnosticId:diagnosticId,provider:providerId,phase:'capabilities',status:'ok',model:selected,source:cap&&cap.source||'none'});
      Log.info('detect.ok',{diagnosticId:diagnosticId,provider:providerId,endpoint:endpointHost(endpoint),model:selected,models:models.length,loaded:loaded.length,catalogueFallback:!!catalogueError,capability:cap&&{contextWindow:cap.contextWindow,maxOutputTokens:cap.maxOutputTokens,source:cap.source}});
      if(useActivity){
        const warning=catalogueError?'Model catalogue could not be read from this browser; the configured model was tested directly.':'';
        const runtimeWarning=cap&&cap.runtimeProfileStatus==='mismatch'?(cap.runtimeProfileMessage||'llama.cpp runtime differs from the recommended LabFlow profile.'):'';
        finishProviderActivity({stage:'Provider verified',message:(provider.name||providerId)+' is reachable and the model answered the live probe.',response:[warning,runtimeWarning].filter(Boolean).join('\n\n')||'Live provider probe completed successfully.',details:{Provider:provider.name||providerId,Endpoint:endpointHost(endpoint),Model:modelLabel(providerId,selected),Models:models.length||'—',Transport:probe.transport||'direct',Diagnostic:diagnosticId}});
      }
      return models;
    }catch(error){
      if(provider.modelSelect)syncModelControls(null,{manualFallback:true,preserveHint:true});
      const summary=LF.AIDiagnostics?LF.AIDiagnostics.errorSummary(error):null,next=summary&&summary.next?summary.next:'';
      Log.error('detect.failed',{diagnosticId:diagnosticId,provider:providerId,phase:error&&error.phase||'detect',endpoint:endpointHost(endpoint),model:config.model||'',keyConfigured:!!apiKey,category:summary&&summary.category||'',next:next,error:error});
      if(useActivity)failProviderActivity(error,{stage:'Detect failed',message:(summary&&summary.category)||'Provider check failed',response:(error.message||String(error))+(next?'\n\n'+next:''),details:{Provider:provider.name||providerId,Endpoint:endpointHost(endpoint),Phase:error&&error.phase||'detect',Category:summary&&summary.category||'Provider error',Diagnostic:diagnosticId}});
      return[];
    }finally{
      if(button){delete button.dataset.loading;button.disabled=false;button.textContent=oldText;}
      syncModelControls(null,{preserveHint:true});
    }
  }

  /** Verify the exact visible configuration first; persist it only after a successful probe. */
  async function testConnection(button) {
    const oldText=button&&button.textContent||'Save & test',diagnosticId=LF.Core&&LF.Core.uid?LF.Core.uid('test'):'test_'+Date.now(),draft=connectionFromForm();
    const useActivity=canStartProviderActivity();
    if(!useActivity)return null;
    startProviderActivity('Save & test AI provider','Live Chat Completions probe before persistence',draft,[
      {id:'validate',label:'Validate visible settings',status:'active'},
      {id:'probe',label:'Run live LLM probe',status:'pending'},
      {id:'persist',label:'Save verified settings',status:'pending'}
    ]);
    if(button){button.textContent='Testing…';button.disabled=true;}
    let config;
    try{
      config=validateConnectionForm(draft);
      updateProviderActivity({stepId:'validate',stepStatus:'done',stepNote:'Visible settings accepted',stepId:'validate',stage:'Testing the LLM',progress:.18});
    }catch(error){
      if(button){button.textContent=oldText;button.disabled=false;}
      Log.error('connection-test.failed',{diagnosticId:diagnosticId,phase:'validate',error:error});
      failProviderActivity(error,{stage:'Validation failed',message:'Save & test could not start.',response:error.message||String(error),details:{Phase:'validate',Diagnostic:diagnosticId}});
      return null;
    }
    const provider=config.provider;
    Log.info('connection-test.start',{diagnosticId:diagnosticId,provider:config.providerId,endpoint:endpointHost(config.endpoint),model:config.model,keyConfigured:!!config.apiKey,source:'visible-form',transport:'direct'});
    try{
      updateProviderActivity({stepId:'probe',stepStatus:'active',stage:'Testing the LLM',message:'Sending a minimal Chat Completions request to '+(provider.name||config.providerId)+'.',progress:.34,details:{Provider:provider.name||config.providerId,Endpoint:endpointHost(config.endpoint),Model:modelLabel(config.providerId,config.model),Transport:'direct'}});
      const result=await LF.AI.testConnection({provider:config.providerId,endpoint:config.endpoint,model:config.model,apiKey:config.apiKey,diagnosticId:diagnosticId});
      if(result.rateLimited){
        const retryS=Number(result.retryAfterMs||0)>0?Math.max(1,Math.ceil(Number(result.retryAfterMs)/1000)):0,text=(provider.name||config.providerId)+' is reachable but rate limited'+(retryS?' · retry after about '+retryS+' s':'')+'. Settings were not changed.';
        Log.warn('connection-test.rate-limited',{diagnosticId:diagnosticId,provider:config.providerId,model:config.model,endpoint:endpointHost(config.endpoint),retryAfterMs:result.retryAfterMs||0});
        const error=new Error(text);error.providerId=config.providerId;error.phase='chat-probe';
        failProviderActivity(error,{stage:'Provider not ready',message:'The live probe was rate limited.',response:text,details:{Provider:provider.name||config.providerId,Endpoint:endpointHost(config.endpoint),Model:modelLabel(config.providerId,config.model),Phase:'chat-probe',Diagnostic:diagnosticId}});
        return result;
      }
      if(!result||result.ok!==true)throw new Error((provider.name||config.providerId)+' did not pass the connection probe.');
      updateProviderActivity({stepId:'probe',stepStatus:'done',stepNote:result.elapsedMs?Math.round(result.elapsedMs)+' ms':'Live response received',stage:'Saving verified settings',progress:.78});
      updateProviderActivity({stepId:'persist',stepStatus:'active',message:'The provider answered successfully. Persisting this exact configuration.',progress:.82});
      if(button)button.textContent='Saving…';
      Log.info('connection-test.stage',{diagnosticId:diagnosticId,provider:config.providerId,phase:'persist',status:'start'});
      const settings=saveFromForm({toast:false});
      updateProviderActivity({stepId:'persist',stepStatus:'done',stepNote:'Saved',progress:.97});
      Log.info('connection-test.stage',{diagnosticId:diagnosticId,provider:config.providerId,phase:'persist',status:'ok'});
      Log.info('connection-test.ok',{diagnosticId:diagnosticId,provider:settings.provider,model:settings.model,endpoint:endpointHost(settings.endpoint),elapsedMs:result.elapsedMs,requestId:result.requestId||'',transport:result.transport||'direct'});
      finishProviderActivity({stage:'Provider verified and saved',message:(provider.name||settings.provider)+' answered the live probe and the settings were saved.',response:'Provider connection verified with '+modelLabel(settings.provider,result.model||settings.model)+'.',details:{Provider:provider.name||settings.provider,Endpoint:endpointHost(settings.endpoint),Model:modelLabel(settings.provider,result.model||settings.model),Time:result.elapsedMs?Math.round(result.elapsedMs)+' ms':'—',Transport:result.transport||'direct',Diagnostic:diagnosticId}});
      return result;
    }catch(error){
      const summary=LF.AIDiagnostics?LF.AIDiagnostics.errorSummary(error):null,next=summary&&summary.next?summary.next:'';
      Log.error('connection-test.failed',{diagnosticId:diagnosticId,provider:config.providerId,model:config.model,endpoint:endpointHost(config.endpoint),keyConfigured:!!config.apiKey,phase:error&&error.phase||'chat-probe',category:summary&&summary.category||'',next:next,error:error});
      failProviderActivity(error,{stage:'Save & test failed',message:(summary&&summary.category)||'Provider check failed',response:(error.message||String(error))+(next?'\n\n'+next:''),details:{Provider:provider.name||config.providerId,Endpoint:endpointHost(config.endpoint),Model:modelLabel(config.providerId,config.model),Phase:error&&error.phase||'chat-probe',Category:summary&&summary.category||'Provider error',Diagnostic:diagnosticId}});
      return null;
    }finally{if(button){button.textContent=oldText;button.disabled=false;}}
  }

  LF.AISettings = {decorate:decorate, saveFromForm:saveFromForm, selectProvider:selectProvider, detectModel:detectModel, testConnection:testConnection, syncModelControls:syncModelControls};
}());
