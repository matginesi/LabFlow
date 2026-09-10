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
  function catalogueModel(provider,current,models){provider=provider||{};current=String(current||'').trim();models=Array.isArray(models)?models.map(String).filter(Boolean):[];const preset=String(provider.model||'').trim();return current||preset||models[0]||'';}
  function catalogueChoices(provider,current,models){const providerId=providerIdFromForm(),meta=modelCatalogueMeta[providerId]||{},catalogue=Array.from(new Set((Array.isArray(models)?models:[]).map(String).filter(Boolean))).sort(function(a,b){if(providerId==='openrouter'){const af=meta[a]&&meta[a].free?1:0,bf=meta[b]&&meta[b].free?1:0;if(af!==bf)return bf-af;}return a.localeCompare(b);}),choices=catalogue.slice(),configured=String(current||provider&&provider.model||'').trim();if(configured&&!choices.includes(configured))choices.unshift(configured);return{catalogue:catalogue,choices:choices};}
  function syncModelControls(models,options){options=options||{};const providerId=providerIdFromForm(),provider=LF.AIProviders[providerId]||LF.AIProviders.custom,input=field('aiModel'),select=field('aiModelSelect'),button=field('detectProviderModel'),hint=field('aiModelHint'),key=field('aiKey');if(!input||!select)return;if(!options.manualFallback&&(!Array.isArray(models)||!models.length)&&Array.isArray(modelCatalogues[providerId]))models=modelCatalogues[providerId].slice();if(select.dataset.provider!==providerId){delete select.dataset.manualFallback;delete select.dataset.catalogueCount;select.dataset.provider=providerId;select.replaceChildren();}if(options.manualFallback){select.dataset.manualFallback='true';modelCatalogueFallbacks[providerId]=true;}else if(modelCatalogueFallbacks[providerId])select.dataset.manualFallback='true';if(Array.isArray(models)&&models.length){delete select.dataset.manualFallback;delete modelCatalogueFallbacks[providerId];modelCatalogues[providerId]=models.slice();}const manualFallback=select.dataset.manualFallback==='true',selectMode=!!provider.modelSelect&&!manualFallback,current=String(modelValue(providerId)||provider.model||'');if(Array.isArray(models)&&models.length){const prepared=catalogueChoices(provider,current,models),catalogue=prepared.catalogue,choices=prepared.choices;select.replaceChildren();choices.forEach(function(id){const option=document.createElement('option');option.value=id;option.textContent=modelLabel(providerId,id);select.appendChild(option);});const preferred=catalogueModel(provider,current,choices);if(selectMode){select.value=preferred;setInputModel(input,providerId,preferred);}else{setInputModel(input,providerId,preferred);if(choices.includes(preferred))select.value=preferred;}select.dataset.catalogueCount=String(catalogue.length);}else if(!select.options.length&&current){const option=document.createElement('option');option.value=current;option.textContent=modelLabel(providerId,current);select.appendChild(option);select.value=current;}input.hidden=selectMode;select.hidden=!selectMode;select.setAttribute('aria-label',provider.modelSelectLabel||provider.name+' model');const host=input.closest('.ai-model-control');if(host)host.dataset.modelSelect=selectMode?'true':'false';if(button&&!button.dataset.loading){button.textContent='Detect';button.disabled=!!(provider.keyRequired&&provider.remoteModelMetadata!==false&&!String(key&&key.value||'').trim());}if(hint&&!options.preserveHint){if(provider.keyRequired&&provider.remoteModelMetadata!==false&&!String(key&&key.value||'').trim())hint.textContent='Enter the '+provider.name+' API key to enable Detect.';else if(provider.modelSelect&&manualFallback)hint.textContent='Detect could not read the '+provider.name+' catalogue. Enter an exact model ID manually, then Save & test connection.';else if(provider.remoteModelMetadata===false)hint.textContent='Press Detect to inspect the exact configured model using built-in capability metadata. No provider-wide model catalogue is queried or substituted.';else if(!select.dataset.catalogueCount)hint.textContent='Press Detect to read model capabilities and the catalogue when the provider exposes one.';}}

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
    lines.push('- **Provider / model:** '+String(result.provider||'—')+' / `'+modelLabel(result.provider,result.model||'—').replace(/`/g,'\\`')+'`');
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

  /** Render Settings operation state inline; completion/error uses the canonical Message Totem. */
  function providerFeedback(kind,title,message,details){
    const host=field('providerFeedback');
    if(!host)return;
    host.className='settings-provider-feedback '+(kind||'info');
    host.replaceChildren();
    const strong=document.createElement('strong');strong.textContent=title||'Provider status';host.appendChild(strong);
    if(message){const span=document.createElement('span');span.textContent=' '+String(message).replace(/^#+\s*/,'');host.appendChild(span);}
    if(details&&Object.keys(details).length){const disclosure=document.createElement('details');disclosure.className='settings-test-details';const summary=document.createElement('summary');summary.textContent='Technical details';disclosure.appendChild(summary);const dl=document.createElement('dl');dl.className='settings-test-facts';Object.keys(details).forEach(function(key){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=String(details[key]==null?'—':details[key]);dl.append(dt,dd);});disclosure.appendChild(dl);host.appendChild(disclosure);}
  }
  function settingsActivity(title){let details={};return{
    activityStart:function(info){details=info&&info.details||{};providerFeedback('info',title,(info&&info.stage)||'Starting…',details);},
    activityUpdate:function(info){if(info&&info.details)details=info.details;providerFeedback('info',title,(info&&info.message)||(info&&info.stage)||'Working…',details);},
    activityFinish:function(info){const message=(info&&info.message)||title,kind=/rate limit|inconclusive|differs/i.test(message)?'warning':'success';providerFeedback(kind,message,'Completed.',(info&&info.details)||details);LF.UI.message(message,kind);},
    activityError:function(error,info){providerFeedback('error',title+' failed',(error&&error.message)||String(error),(info&&info.details)||details);LF.UI.message((error&&error.message)||String(error),'error');}
  };}
  function clearFieldErrors(){document.querySelectorAll('.settings-content .field-error').forEach(function(node){node.remove();});document.querySelectorAll('.settings-content [aria-invalid="true"]').forEach(function(node){node.removeAttribute('aria-invalid');});}
  function invalidField(id,message){const input=field(id),wrap=input&&input.closest('.field');if(input){input.setAttribute('aria-invalid','true');input.focus();}if(wrap){const error=document.createElement('div');error.className='field-error';error.textContent=message;wrap.appendChild(error);}throw new Error(message);}

  /** Keep the provider page compact while exposing the browser/network facts that matter. */
  function decorate() {
    const providerSelect=field('aiProvider');
    if(!providerSelect)return;
    const saved=LF.Storage.getAiSettings(),providerId=providerSelect.value||saved.provider,provider=LF.AIProviders[providerId]||LF.AIProviders.custom,endpointField=field('aiEndpoint'),endpoint=endpointField?endpointField.value.trim():saved.endpoint;
    let parsed=null;try{parsed=new URL(endpoint);}catch(_){}
    const space=LF.AI&&LF.AI.targetAddressSpace?LF.AI.targetAddressSpace(endpoint):'',host=parsed?parsed.hostname:'',securePage=typeof location!=='undefined'&&location.protocol==='https:',httpTarget=parsed&&parsed.protocol==='http:',supportsLna=LF.AI&&LF.AI.supportsLocalNetworkAccess?LF.AI.supportsLocalNetworkAccess():false;
    const summary=field('aiConnectivityText'),badge=field('aiConnectivityBadge'),details=field('aiConnectivityDetails'),resolved=field('aiResolvedUrl'),endpointHint=field('aiEndpointHint');
    if(resolved)resolved.textContent='Request URL: '+((LF.AI&&LF.AI.resolveChatUrl&&LF.AI.resolveChatUrl(endpoint))||'—');
    if(provider.local===true){
      if(space==='loopback'){
        if(summary)summary.textContent='This-device endpoint. On a phone, this points to the phone itself.';
        if(badge){badge.className='badge warning';badge.textContent='LOOPBACK';}
        if(details)details.textContent='To use a model server on another computer, replace 127.0.0.1/localhost with a LAN-reachable hostname such as fedora, fedora.local, or a private IP. The model server must listen on a LAN interface and allow this page origin.';
      }else if(space==='local'){
        if(summary)summary.textContent='LAN endpoint · browser connects directly to '+(host||'the configured host')+'.';
        if(badge){badge.className='badge success';badge.textContent='LAN';}
        if(details)details.textContent=(securePage&&httpTarget?'This HTTPS page will request browser Local Network access where supported. Allow that permission when prompted. ':'')+'The model server must be reachable from this device, bound beyond loopback, and configured for CORS. '+(supportsLna?'This browser exposes the Local Network Access request API.':'This browser does not expose the Local Network Access request API; if HTTP is blocked from this HTTPS page, use an HTTPS endpoint or serve LabFlow from a compatible local origin.');
      }else{
        if(summary)summary.textContent='Custom endpoint · verify that this device can resolve and reach '+(host||'the host')+'.';
        if(badge){badge.className='badge info';badge.textContent='CUSTOM';}
        if(details)details.textContent='LabFlow sends the request directly from this browser. The endpoint must accept the current page origin and be reachable from the device running LabFlow.';
      }
      if(endpointHint)endpointHint.innerHTML='Same device: <span class="mono">127.0.0.1</span>. Another device: <span class="mono">fedora</span>, <span class="mono">fedora.local</span>, or a private IP.';
    }else{
      if(summary)summary.textContent='Direct browser API · '+(host||provider.name||providerId)+'.';
      if(badge){badge.className='badge info';badge.textContent='REMOTE';}
      if(details)details.textContent=provider.note||'LabFlow sends requests directly from the browser to the configured API endpoint.';
    }
    const keyField=field('aiKey'),keyWrap=document.querySelector('[data-ai-key-field]'),keyHint=field('aiKeyHint'),providerUsesKey=!!(provider&&(provider.keyRequired||provider.optionalKey));
    if(keyField){keyField.disabled=!providerUsesKey;keyField.placeholder=providerUsesKey?'Stored separately for this provider…':'Not used by this provider';if(!providerUsesKey)keyField.value='';}
    if(keyWrap)keyWrap.classList.toggle('settings-key-unused',!providerUsesKey);
    if(keyHint)keyHint.textContent=provider.keyRequired?'Required by this provider.':provider.optionalKey?'Optional; only needed if this endpoint requires authentication.':'This provider does not use an API key.';
    const testButton=field('testAiConnection');if(testButton)testButton.textContent='Save & test';
    syncModelControls(null,{preserveHint:true});
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
    const provider=LF.AIProviders[settings.provider]||LF.AIProviders.custom;
    if(!settings.endpoint)invalidField('aiEndpoint','Enter the provider endpoint.');
    let endpointUrl;try{endpointUrl=new URL(settings.endpoint);}catch(_){invalidField('aiEndpoint','Enter a complete http(s) endpoint URL.');}if(endpointUrl&&!['http:','https:'].includes(endpointUrl.protocol))invalidField('aiEndpoint','Use an http:// or https:// endpoint.');
    if(!settings.model)invalidField(provider.modelSelect?'aiModelSelect':'aiModel','Choose or enter an exact model ID.');
    if(provider.keyRequired&&!String(field('aiKey')&&field('aiKey').value||'').trim())invalidField('aiKey','Enter the '+(provider.name||settings.provider)+' API key.');
    LF.Storage.saveAiSettings(settings);
    if(provider.keyRequired||provider.optionalKey){const key=field('aiKey').value.trim(),stored=LF.Storage.saveApiKey(key,settings.provider);if(stored===false)throw new Error('The '+(provider.name||settings.provider)+' API key could not be saved in this browser. Check site-storage permissions, then try again.');if(provider.keyRequired&&key&&!LF.Storage.getApiKey(settings.provider))throw new Error('The '+(provider.name||settings.provider)+' API key was not retained by this browser. Check site-storage permissions, then try again.');}
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

  async function detectModel(options) {
    options=options||{};
    const activity=options.silent?{activityStart:function(){},activityUpdate:function(){},activityFinish:function(){},activityError:function(){}}:settingsActivity('Detect model capabilities');
    const providerId=providerIdFromForm();
    const endpoint=(field('aiEndpoint')&&field('aiEndpoint').value.trim())||LF.Storage.getAiSettings().endpoint;
    const apiKey=(field('aiKey')&&field('aiKey').value.trim())||LF.Storage.getApiKey(providerId);
    const button=field('detectProviderModel'),hint=field('aiModelHint'),list=field('aiModelList'),provider=LF.AIProviders[providerId]||LF.AIProviders.custom;
    const detectNeedsKey=provider.keyRequired&&provider.remoteModelMetadata!==false&&!apiKey;
    const localBenchmark=provider.local===true;
    if(detectNeedsKey){
      if(hint)hint.textContent='Enter the '+provider.name+' API key before running Detect.';
      if(field('aiKey'))field('aiKey').focus();
      if(!options.silent)LF.UI.message('Enter the API key before running Detect.','warning');
      syncModelControls();
      return[];
    }
    if(button){button.disabled=true;button.textContent='Detecting…';button.dataset.loading='true';}
    if(hint)hint.textContent='Reading model identity and capability…';
    const detectSteps=[
      {id:'models',label:'Resolve model identity / catalogue',status:'active'},
      {id:'capability',label:'Resolve output / context capability',status:'pending'}
    ];
    if(localBenchmark)detectSteps.push({id:'benchmark',label:'Measure local generation throughput',status:'pending'});
    detectSteps.push({id:'apply',label:'Update provider settings view',status:'pending'});
    activity.activityStart({title:'Detect model capabilities',subtitle:localBenchmark?'Provider metadata + short local throughput benchmark · no experiment data':'Provider metadata · no experiment data',kind:'API',stage:'Resolving model identity',progress:.08,cancellable:false,details:{Provider:provider.name||providerId,Endpoint:endpointHost(endpoint)},steps:detectSteps});
    let models=[],listError=null,catalogueSkipped=false;
    try{
      try{
        const result=await LF.AI.listModels(providerId,endpoint,apiKey),loaded=Array.isArray(result.loadedModels)?result.loadedModels.filter(Boolean):[];
        models=Array.isArray(result.models)?result.models:[];
        if(Array.isArray(result.entries)){modelCatalogueMeta[providerId]={};result.entries.forEach(function(entry){if(entry&&entry.id)modelCatalogueMeta[providerId][String(entry.id)]=entry;});}
        catalogueSkipped=result.skipped===true;
        const detectedChoices=Array.from(new Set(models.concat(loaded)));
        if(list){list.replaceChildren();detectedChoices.forEach(function(id){const option=document.createElement('option');option.value=id;list.appendChild(option);});}
        if(provider.local===true&&loaded.length===1)setModelValue(loaded[0]);
        syncModelControls(detectedChoices.length?detectedChoices:null,{preserveHint:true});
        saveFromForm({toast:false});
        if(catalogueSkipped){
          activity.activityUpdate({stepId:'models',stepStatus:'done',stepNote:'configured model retained',stage:'Configured model retained',progress:.42,message:'This provider does not use remote model discovery. Detect is inspecting the exact configured model without catalogue substitution.'});
        }else{
          activity.activityUpdate({stepId:'models',stepStatus:'done',stepNote:models.length+' found'+(loaded.length?' · '+loaded.length+' running':''),stage:'Model identity resolved',progress:.42,message:models.length?models.length+' model'+(models.length===1?'':'s')+' available.'+(providerId==='openrouter'&&modelCatalogueMeta[providerId]?(' '+Object.keys(modelCatalogueMeta[providerId]).filter(function(id){return modelCatalogueMeta[providerId][id].free;}).length+' free.'):'')+(loaded.length===1?' Running model selected: '+modelLabel(providerId,loaded[0])+'.':loaded.length>1?' '+loaded.length+' models are running; the current selection was preserved.':''):'No model list was exposed; capability detection will still be attempted.'});
        }
      }catch(error){
        listError=error;
        Log.warn('models.list-failed',{provider:providerId,error:error});
        if(provider.modelSelect)syncModelControls(null,{manualFallback:true,preserveHint:true});
        const localHint=provider.local===true?' Endpoint not reachable from this browser. Check the LAN bind, hostname/IP, Local Network permission and CORS.':'';
        activity.activityUpdate({stepId:'models',stepStatus:'done',stepNote:'list unavailable',stage:'Model list unavailable',progress:.34,message:'The provider did not expose a usable model list.'+localHint+' LabFlow is still checking the configured model capability.'});
      }
      activity.activityUpdate({stepId:'capability',stepStatus:'active',stage:'Resolving model capability',progress:.52,message:'Reading output/context limits for the configured model.'});
      const selected=modelValue(providerId)||LF.Storage.getAiSettings().model||'',selectedDisplay=modelLabel(providerId,selected);
      const cap=LF.AI.resolveModelCapabilities?await LF.AI.resolveModelCapabilities({provider:providerId,endpoint:endpoint,model:selected,apiKey:apiKey,force:true}):null;
      const capBits=[];
      if(cap&&cap.contextWindow)capBits.push(Number(cap.contextWindow).toLocaleString()+' context tok');
      if(cap&&cap.maxOutputTokens)capBits.push(Number(cap.maxOutputTokens).toLocaleString()+' max output tok');
      if(cap&&cap.totalSlots)capBits.push(Number(cap.totalSlots)+' slot'+(Number(cap.totalSlots)===1?'':'s'));
      const capText=capBits.length?('model capacity '+capBits.join(' / ')):'model capacity not exposed';
      const reasoningText=cap&&cap.reasoningStatus&&cap.reasoningStatus!=='unknown'?('thinking '+cap.reasoningStatus):(provider.safeThinkingOverrideWhenUnknown?'thinking metadata not exposed · request control available':'thinking capability not exposed');
      const runtimeProfileText=providerId==='llamacpp'&&cap&&cap.runtimeProfileMessage?cap.runtimeProfileMessage:'';
      const details={Model:selectedDisplay,'Loaded model':cap&&cap.loadedModel?modelLabel(providerId,cap.loadedModel):'not exposed','Model list':catalogueSkipped?'not queried':(models.length||'not exposed'),'Max output':cap&&cap.maxOutputTokens?Number(cap.maxOutputTokens).toLocaleString()+' tok':'not exposed','Context window':cap&&cap.contextWindow?Number(cap.contextWindow).toLocaleString()+' tok':'not exposed','Server slots':cap&&cap.totalSlots?Number(cap.totalSlots):'not exposed','LabFlow llama.cpp profile':providerId==='llamacpp'?(runtimeProfileText||'not exposed'):'n/a','Thinking capability':cap&&cap.reasoningStatus||'unknown','Thinking options':cap&&cap.reasoningAllowedOptions&&cap.reasoningAllowedOptions.length?cap.reasoningAllowedOptions.join(', '):'not exposed',Source:cap&&cap.source||'fallback / unknown'};
      activity.activityUpdate({stepId:'capability',stepStatus:'done',stepNote:capText+' · '+reasoningText+(runtimeProfileText?' · '+runtimeProfileText:''),stage:'Capability detected',progress:localBenchmark?.68:.88,details:details});
      let benchmark=null,benchmarkError=null;
      if(localBenchmark&&LF.AI.benchmarkTokensPerSecond){
        activity.activityUpdate({stepId:'benchmark',stepStatus:'active',stage:'Benchmarking local model',progress:.74,message:'Warm-up + 3 short generations. The warm-up is excluded from the average.'});
        try{
          benchmark=await LF.AI.benchmarkTokensPerSecond({provider:providerId,endpoint:endpoint,model:selected,apiKey:apiKey,samples:3,maxTokens:64,warmupTokens:24});
          const sampleText=benchmark.samples.map(function(item){return Number(item.tokensPerSecond).toFixed(1);}).join(' / '),estimateSuffix=benchmark.estimated?' (token count estimated)':'';
          details['Average throughput']=Number(benchmark.averageTokensPerSecond).toFixed(2)+' tok/s'+estimateSuffix;
          details['Throughput range']=Number(benchmark.minTokensPerSecond).toFixed(2)+'–'+Number(benchmark.maxTokensPerSecond).toFixed(2)+' tok/s';
          details['Throughput samples']=sampleText+' tok/s';
          activity.activityUpdate({stepId:'benchmark',stepStatus:'done',stepNote:Number(benchmark.averageTokensPerSecond).toFixed(2)+' tok/s avg'+(benchmark.estimated?' · estimated tokens':'')+' · '+sampleText,stage:'Local throughput measured',progress:.91,details:details});
        }catch(error){
          benchmarkError=error;details['Average throughput']='unavailable';
          activity.activityUpdate({stepId:'benchmark',stepStatus:'done',stepNote:'unavailable',stage:'Throughput benchmark unavailable',progress:.91,message:'Capability detection succeeded, but the optional local throughput benchmark failed: '+(error.message||String(error)),details:details});
          Log.warn('benchmark.failed',{provider:providerId,model:selected,error:error});
        }
      }
      const benchmarkText=benchmark?' · '+Number(benchmark.averageTokensPerSecond).toFixed(2)+' tok/s avg'+(benchmark.estimated?' (estimated tokens)':''):'';
      if(hint)hint.textContent=(catalogueSkipped?'configured model · ':(models.length?models.length+' model'+(models.length===1?'':'s')+' available · ':''))+capText+' · '+reasoningText+benchmarkText+(runtimeProfileText?' · '+runtimeProfileText:'')+(cap&&cap.source?' · '+cap.source:'')+(listError?' · model list unavailable; manual model entry enabled':'')+(benchmarkError?' · throughput unavailable':'');
      activity.activityUpdate({stepId:'apply',stepStatus:'done',stage:'Provider metadata ready',progress:.97,details:details});
      Log.info('models.loaded',{provider:providerId,count:models.length,model:selected,catalogueSkipped:catalogueSkipped,capability:cap,throughput:benchmark});
      activity.activityFinish({message:cap&&cap.runtimeProfileStatus==='mismatch'?'Provider metadata detected · llama.cpp runtime differs from the LabFlow profile.':'Provider metadata detection completed.',response:(catalogueSkipped?'Configured model retained; no provider-wide catalogue was queried. ':(models.length?models.length+' models detected. ':''))+capText+'.'+(benchmark?' Local generation throughput: '+Number(benchmark.averageTokensPerSecond).toFixed(2)+' tok/s average'+(benchmark.estimated?' using estimated token counts':'')+' ('+benchmark.samples.map(function(item){return Number(item.tokensPerSecond).toFixed(1);}).join(', ')+' tok/s).':'')+(runtimeProfileText?' '+runtimeProfileText+'.':'')+' LabFlow Action requests remain much smaller and use explicit per-Action input/output caps.'+(cap&&cap.runtimeProfileStatus==='mismatch'?'\n\nRecommended llama.cpp runtime for this LabFlow profile: --parallel 1 --ctx-size 65536. Detect never divides the n_ctx reported by /props a second time.':'')+(listError?'\n\nThe model catalogue itself was unavailable, but the configured model was still probed.':'')+(benchmarkError?'\n\nThe optional local throughput benchmark was unavailable: '+(benchmarkError.message||String(benchmarkError)):''),details:details,holdMs:0});
      if(cap&&cap.runtimeProfileStatus==='mismatch'&&!options.silent)LF.UI.message('llama.cpp runtime differs from LabFlow profile: use --parallel 1 --ctx-size 65536 for the full 65K Action context.','warning');
      return models;
    }catch(error){
      if(hint)hint.textContent='Could not read provider capability: '+(error.message||String(error));
      Log.warn('models.load-failed',{provider:providerId,error:error});
      activity.activityError(error,{message:'Provider metadata detection did not complete.',response:(error.message||String(error))+'\n\nYou can still type the model name manually; LabFlow will keep Action budgets bounded by their own contracts.',details:{Provider:provider.name||providerId,Endpoint:endpointHost(endpoint)},holdMs:0});
      if(!options.silent)LF.UI.message('Could not read provider capability. The request will use the Action budget unless you force a lower cap.','warning');
      return models;
    }finally{
      if(button){delete button.dataset.loading;button.disabled=false;}
      syncModelControls(null,{preserveHint:true});
    }
  }

  /** Send a minimal probe and keep its diagnostics in the Connection section. */
  async function testConnection(button) {
    const oldText = button.textContent;
    button.textContent = 'Saving…';
    button.disabled = true;
    let settings;
    try{settings=saveFromForm({toast:false});}
    catch(error){button.textContent=oldText;button.disabled=false;providerFeedback('error','Provider settings were not saved',error.message||String(error));LF.UI.message(error.message||String(error),'error');return;}
    const provider = LF.AIProviders[settings.provider] || LF.AIProviders.custom;
    const activity=settingsActivity('Test AI connection');
    button.textContent = 'Testing…';
    activity.activityStart({
      title: 'Test AI connection',
      subtitle: 'Minimal request · no experiment data',
      kind: 'API',
      stage: 'Preparing request',
      progress: .15,
      cancellable: true,
      onCancel: function () { return LF.AI.cancel(); },
      showAiTrace: true,
      response: 'No provider response yet.',
      details: {Provider:provider.name || settings.provider, Model:modelLabel(settings.provider,settings.model), Endpoint:endpointHost(settings.endpoint), Timeout:Math.round((provider.connectionTestTimeoutMs||15000)/1000)+' s', Payload:'No experiment data'},
      steps: [{id:'request', label:'Send minimal provider request', status:'active'}, {id:'response', label:'Read provider response', status:'pending'}]
    });
    try {
      activity.activityUpdate({stage:'Waiting for provider', indeterminate:true, message:settings.provider==='zai'?'Direct request to the official Z.AI endpoint.':'The provider request is in progress.'});
      const result = await LF.AI.testConnection();
      if(result.rateLimited){
        const retryS=Number(result.retryAfterMs||result.retryInMs||0)>0?Math.max(1,Math.ceil(Number(result.retryAfterMs||result.retryInMs)/1000)):0;
        activity.activityFinish({message:'Provider reachable, but rate limited.',details:{Provider:provider.name||settings.provider,Model:modelLabel(settings.provider,settings.model),'Total elapsed':result.elapsedMs+' ms','HTTP status':result.status||429,'Provider code':result.providerCode||'not returned','Provider message':result.providerMessage||'not returned','HTTP requests':1,'Automatic retries':0,'Retry-After':retryS?retryS+' s':'not returned'}});return;
      }
      activity.activityFinish({
        message: result.probeLimited?'Provider reachable · final-text probe inconclusive.':'Provider responded successfully.',
        response: connectionReport(result),
        details: {Provider:provider.name || settings.provider, Model:modelLabel(result.provider||settings.provider,result.model), 'Total elapsed':result.elapsedMs + ' ms', 'Provider round trip':Number.isFinite(Number(result.requestElapsedMs))?result.requestElapsedMs+' ms':'not measured', Tokens:result.usage&&Number.isFinite(Number(result.usage.totalTokens))?result.usage.totalTokens+(result.usage.estimated?' estimated':''):'not returned', 'Finish reason':result.finishReason||'not returned', 'Final text':result.probeLimited?'not verified by tiny probe':'verified', 'Reasoning observed':result.reasoningObserved?'yes':'no', 'HTTP requests':result.httpRequests||1, Retries:0, 'Request ID':result.requestId || 'not returned'},
        holdMs: 0
      });
    } catch (error) {
      Log.error('connection-test.failed',{provider:settings.provider,model:settings.model,endpoint:endpointHost(settings.endpoint),error:error});
      const summary = LF.AIDiagnostics ? LF.AIDiagnostics.errorSummary(error) : {category:'Error', next:'Review provider settings.'};
      activity.activityError(error, {
        response: 'What happened\n' + (error.message || String(error)) + (error.providerResponse ? '\n\nProvider response\n' + error.providerResponse : '') + '\n\nWhat to do next\n' + summary.next + (settings.provider==='zai'?'\n\nZ.AI endpoint\nLabFlow calls the official General API endpoint https://api.z.ai/api/paas/v4/chat/completions directly from the browser. No LabFlow relay is required. If curl succeeds but the browser reports no HTTP response, inspect browser CORS/origin policy.':'') ,
        details: {Provider:provider.name || settings.provider, Model:modelLabel(settings.provider,settings.model), Category:summary.category, Timeout:error.timeoutMs?Math.round(error.timeoutMs/1000)+' s':Math.round((provider.connectionTestTimeoutMs||15000)/1000)+' s', Elapsed:error.elapsedMs?error.elapsedMs+' ms':'', 'HTTP status':summary.status || (error.timedOut?'no response':'network'), 'Provider code':summary.providerCode || 'not returned', 'Request ID':error.requestId || 'not returned', Endpoint:endpointHost(settings.endpoint)},
        holdMs: 0
      });
    } finally {
      button.textContent = oldText;
      button.disabled = false;
    }
  }

  LF.AISettings = {decorate:decorate, saveFromForm:saveFromForm, selectProvider:selectProvider, detectModel:detectModel, testConnection:testConnection, syncModelControls:syncModelControls};
}());
