(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};
  const Log = LF.Logger.scope('ai-settings');
  let lastModelProbeKey='',modelProbePending=false;

  /** Return an element by ID. Settings is dynamically rendered, so resolve lazily. */
  function field(id) { return document.getElementById(id); }

  /** Reduce an endpoint to a safe diagnostic host; never expose credentials or query data. */
  function endpointHost(endpoint) {
    try { return new URL(String(endpoint || '')).host; }
    catch (_) { return String(endpoint || ''); }
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
    note.appendChild(document.createTextNode(LF.AIDiagnostics.environmentNote()));

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
    if(keyField){keyField.disabled=!providerUsesKey;keyField.placeholder=providerUsesKey?'Stored only in this browser…':'Not used by this provider';if(!providerUsesKey)keyField.value='';else if(!keyField.value)keyField.value=LF.Storage.getApiKey();}
    if (providerId === 'lmstudio' || providerId === 'ollama') {
      const local = document.createElement('div');
      local.className = 'meta mt-1';
      local.textContent = providerId === 'lmstudio'
        ? 'LM Studio · OpenAI-compatible base http://127.0.0.1:1234/v1 · LabFlow sends POST /v1/chat/completions with a messages array. For browser access start LM Studio with CORS enabled (lms server start --cors).'
        : 'Ollama · OpenAI-compatible base http://127.0.0.1:11434/v1 · LabFlow sends POST /v1/chat/completions with a messages array. Ollama allows localhost web origins by default.';
      note.appendChild(local);
      if(location.protocol==='file:'){
        const origin=document.createElement('div');
        origin.className='notice danger mt-1';
        origin.innerHTML='<strong>Local providers + file://</strong><br>Open LabFlow through its local HTTP server instead: <code>python tools/serve_static.py --port 8765</code>, then use <code>http://127.0.0.1:8765</code>. A file:// page has an opaque browser origin and local APIs commonly reject it during CORS/preflight.';
        note.appendChild(origin);
      }
      if((providerId==='lmstudio'||providerId==='ollama')&&endpoint){
        const probeKey=providerId+'|'+endpoint;
        if(probeKey!==lastModelProbeKey&&!modelProbePending){modelProbePending=true;window.setTimeout(function(){loadModels({silent:true}).finally(function(){lastModelProbeKey=probeKey;modelProbePending=false;});},0);}
      }
    }

    const testButton = field('testAiConnection');
    if (testButton) testButton.textContent = 'Save & test connection';
  }

  /** Persist the visible provider form. Experiment data is intentionally untouched. */
  function saveFromForm(options) {
    const providerField = field('aiProvider');
    if (!providerField) throw new Error('AI provider settings are not visible.');
    const previous = LF.Storage.getAiSettings();
    const settings = {
      provider: providerField.value,
      endpoint: field('aiEndpoint').value.trim(),
      model: field('aiModel').value.trim(),
      temperature: Number.isFinite(Number(previous.temperature)) ? Number(previous.temperature) : 0.7,
      thinking: false,
      streaming: field('aiStreaming') ? field('aiStreaming').checked : previous.streaming !== false,
      inactivityTimeoutMs: field('aiInactivityTimeout') ? Math.max(15000,Number(field('aiInactivityTimeout').value||90)*1000) : previous.inactivityTimeoutMs
    };
    LF.Storage.saveAiSettings(settings);
    const provider=LF.AIProviders[settings.provider]||LF.AIProviders.custom;
    if(provider.keyRequired||provider.optionalKey)LF.Storage.saveApiKey(field('aiKey').value.trim());
    Log.info('saved', {provider:settings.provider, endpoint:settings.endpoint, model:settings.model});
    if (!options || options.toast !== false) LF.UI.toast('AI provider saved.', 'success');
    return settings;
  }

  /** Apply a provider preset to the unsaved form without starting a model request. */
  function selectProvider(providerId) {
    const provider = LF.AIProviders[providerId] || LF.AIProviders.custom;
    field('aiEndpoint').value = provider.endpoint || '';
    field('aiModel').value = provider.model || '';
    Log.info('provider-selected', {provider:provider.id, model:provider.model, endpoint:provider.endpoint});
    decorate();
  }

  async function loadModels(options) {
    options=options||{};
    const providerId=(field('aiProvider')&&field('aiProvider').value)||LF.Storage.getAiSettings().provider;
    if(providerId!=='lmstudio'&&providerId!=='ollama'&&!options.force)return[];
    const endpoint=(field('aiEndpoint')&&field('aiEndpoint').value.trim())||LF.Storage.getAiSettings().endpoint;
    const button=field('loadProviderModels'),hint=field('aiModelHint'),list=field('aiModelList'),model=field('aiModel');
    if(button){button.disabled=true;button.textContent='Reading…';}
    if(hint)hint.textContent='Reading models from the local provider…';
    try{
      const result=await LF.AI.listModels(providerId,endpoint);
      if(list){list.replaceChildren();result.models.forEach(function(id){const option=document.createElement('option');option.value=id;list.appendChild(option);});}
      const current=String(model&&model.value||'').trim();
      if(model&&result.models.length&&(!current||current==='local-model'||(providerId==='lmstudio'&&!result.models.includes(current))))model.value=result.models[0];
      if(hint)hint.textContent=result.models.length?result.models.length+' model'+(result.models.length===1?'':'s')+' available · '+result.elapsedMs+' ms':'Provider returned no visible models.';
      Log.info('models.loaded',{provider:providerId,count:result.models.length,elapsedMs:result.elapsedMs});
      return result.models;
    }catch(error){
      if(hint)hint.textContent='Could not read models: '+(error.message||String(error));
      Log.warn('models.load-failed',{provider:providerId,error:error});
      if(!options.silent)LF.UI.toast('Could not read provider models. You can still type the model name manually.','warning');
      return[];
    }finally{if(button){button.disabled=false;button.textContent='Detect';}}
  }

  /**
   * Send the provider's minimal connection probe. No experiment context is included.
   * Keep the completed/error totem open so provider or credential failures can be read.
   */
  async function testConnection(button) {
    const settings = saveFromForm();
    const provider = LF.AIProviders[settings.provider] || LF.AIProviders.custom;
    const oldText = button.textContent;
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
      const result = await LF.AI.testConnection();
      if(settings.provider==='lmstudio'&&result.model){const modelField=field('aiModel');if(modelField)modelField.value=result.model;if(result.model!==settings.model)LF.Storage.saveAiSettings(Object.assign({},settings,{model:result.model}));}
      LF.UI.activityUpdate({stepId:'request', stepStatus:'done', stepNote:result.elapsedMs + ' ms'});
      LF.UI.activityUpdate({stepId:'response', stepStatus:'done'});
      LF.UI.activityFinish({
        message: 'Provider responded successfully.',
        response: result.content || 'Provider returned an empty test response.',
        details: {Model:result.model, Latency:result.elapsedMs + ' ms', 'Request ID':result.requestId || 'not returned'},
        holdMs: 0
      });
      LF.UI.toast('AI connection OK · ' + result.model + ' · ' + result.elapsedMs + ' ms', 'success');
    } catch (error) {
      const summary = LF.AIDiagnostics ? LF.AIDiagnostics.errorSummary(error) : {category:'Error', next:'Review provider settings.'};
      LF.UI.activityError(error, {
        response: 'What happened\n' + (error.message || String(error)) + (error.providerResponse ? '\n\nProvider response\n' + error.providerResponse : '') + '\n\nWhat to do next\n' + summary.next,
        details: {Provider:provider.name || settings.provider, Model:settings.model, Category:summary.category, Timeout:error.timeoutMs?Math.round(error.timeoutMs/1000)+' s':Math.round((provider.connectionTestTimeoutMs||60000)/1000)+' s', Elapsed:error.elapsedMs?error.elapsedMs+' ms':'', 'HTTP status':summary.status || (error.timedOut?'no response':'network'), 'Provider code':summary.providerCode || 'not returned', 'Request ID':error.requestId || 'not returned', Endpoint:endpointHost(settings.endpoint)},
        holdMs: 0
      });
    } finally {
      button.textContent = oldText;
    }
  }

  LF.AISettings = {decorate:decorate, saveFromForm:saveFromForm, selectProvider:selectProvider, loadModels:loadModels, testConnection:testConnection};
}());
