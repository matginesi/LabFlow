'use strict';
require('../../assets/js/logger.js');
require('../../assets/js/core.js');
require('../../assets/js/ai/action-registry.js');
require('../../assets/js/storage.js');
require('../../assets/js/ai/providers.js');
require('../../assets/js/ai/settings.js');
require('../../assets/js/pages/settings-page.js');
function assert(ok,msg){if(!ok)throw new Error(msg||'assertion failed');}
module.exports=function(t,LF){
  t['Actions catalog includes every executable Action including Assistant']=function(){
    const ids=LF.ActionRegistry.actions();
    ['assistant.chat','dataset.resolve-ambiguities','design.infer','results.compare','results.interpret'].forEach(function(id){assert(ids.includes(id),id+' missing from registry');});
    assert(ids.length===5,'expected five real Actions');
  };
  t['Every AI Action has bounded context/output and explicit semantic result step']=function(){
    const defs=LF.ActionRegistry.actions().map(function(id){return LF.ActionRegistry.action(id);});
    defs.forEach(function(def){const steps=LF.ActionRegistry.steps(def),resultStep=String(def.execution&&def.execution.result_step||'');assert(!!resultStep,def.id+' missing result_step');assert(steps.some(function(step){return step.id===resultStep;}),def.id+' result_step not declared');steps.filter(function(step){return step.type==='AI';}).forEach(function(step){assert(Number(step.max_input_tokens)>0,def.id+'/'+step.id+' missing input cap');assert(Number(step.max_output_tokens)>0,def.id+'/'+step.id+' missing output cap');assert(['off','auto','on'].includes(step.thinking),def.id+'/'+step.id+' missing thinking policy');});});
    assert(LF.ActionRegistry.actions().length,5,'only researcher-facing capabilities are Actions');
  };

  t['Assistant uses a lightweight bounded request by default']=function(){
    const step=LF.ActionRegistry.steps('assistant.chat')[0];
    assert(step.thinking==='off','Assistant thinking must be off by default');
    assert(step.max_output_tokens===2048,'Assistant output ceiling must stay compact');
    assert(step.target_output_tokens===650,'Assistant target should suit normal chat');
    assert(step.deadline_ms===90000,'Assistant cannot remain provider-blocked indefinitely');
  };

  t['Design inference uses evidence-first current context and bounded model inference']=function(){
    const prompt=LF.ActionRegistry.prompt('design.infer');
    assert(prompt.includes('model inference')||prompt.includes('model_inference'),'Design prompt allows explicit model inference');
    assert(prompt.includes('imported experiment evidence'),'Design prompt keeps imported experiment evidence authoritative');
    const step=LF.ActionRegistry.steps('design.infer').find(function(item){return item.id==='infer';});
    assert(step.thinking==='off','Design should not spend latency on hidden reasoning by default');
  };

  t['provider registry includes OpenRouter and NVIDIA NIM presets']=function(){
    assert(LF.AIProviders.openrouter.endpoint==='https://openrouter.ai/api/v1/chat/completions','OpenRouter endpoint');
    assert(LF.AIProviders.openrouter.keyRequired===true,'OpenRouter key required');
    assert(LF.AIProviders.nvidia.endpoint==='https://integrate.api.nvidia.com/v1/chat/completions','NVIDIA NIM endpoint');
    assert(LF.AIProviders.nvidia.modelsEndpoint==='https://integrate.api.nvidia.com/v1/models','NVIDIA models endpoint');
    assert(LF.AIProviders.nvidia.keyRequired===true,'NVIDIA key required');
    assert(LF.AIProviders.nvidia.modelSelect===true,'NVIDIA uses loaded model select');
    assert(LF.AIProviders.zai.modelSelect===true,'Z.AI Detect exposes the documented model snapshot');
    assert(LF.AIProviders.ollama.modelSelect===true,'Ollama Detect exposes discovered local models');
    assert(LF.AIProviders.lmstudio.modelSelect===true,'LM Studio Detect exposes discovered local models');
    assert(LF.AIProviders.llamacpp.modelSelect===true,'llama.cpp Detect exposes served local models');
    assert(LF.AIProviders.llamacpp.endpoint==='http://127.0.0.1:8080/v1','llama.cpp default endpoint');
    assert(LF.AIProviders.llamacpp.keyRequired===false,'llama.cpp never requires a cloud API key');
    assert(LF.AIProviders.llamacpp.safeThinkingOverrideWhenUnknown===true,'llama.cpp can apply server-level reasoning controls when model metadata is silent');
    assert(LF.AIProviders.llamacpp.connectionTestMaxTokens===64,'llama.cpp probe has a small but reasoning-safe budget');
    assert(LF.AIProviders.llamacpp.recommendedRuntime.parallelSlots===1,'llama.cpp LabFlow profile uses one server slot');
    assert(LF.AIProviders.llamacpp.recommendedRuntime.contextWindow===65536,'llama.cpp LabFlow profile uses a 65K runtime context');
    assert(LF.AIProviders.llamacpp.thinkingModes.off.reasoning_effort==='none','llama.cpp reasoning-off mode disables reasoning effort');assert(LF.AIProviders.llamacpp.thinkingModes.off.chat_template_kwargs.enable_thinking===false,'llama.cpp reasoning-off mode disables template thinking when supported');assert(LF.AIProviders.llamacpp.supportsReasoningControl===true,'llama.cpp can stop ignored reasoning at runtime');
    assert(LF.AIProviders.zai.remoteModelMetadata===false,'Z.AI Detect uses built-in metadata without remote catalogue probing');
    assert(LF.AIProviders.ollama.local===true&&LF.AIProviders.lmstudio.local===true&&LF.AIProviders.llamacpp.local===true,'local provider behavior is declared in the registry');
    assert(!LF.AIProviderList.some(function(provider){return Object.prototype.hasOwnProperty.call(provider,'modelLoadLabel');}),'providers do not define separate detect labels');
    assert(LF.AIProviders.zai.supportsStreamUsage!==true,'Z.AI must not receive undocumented stream_options');
    assert(LF.AIProviders.zai.model==='glm-4.7-flash','Z.AI default model');
    assert(!Object.prototype.hasOwnProperty.call(LF.AIProviders.zai,'rateLimit'),'Z.AI has no obsolete transport retry policy');
    assert(LF.AIProviders.lmstudio.optionalKey===true,'LM Studio can use its own optional API token');
    assert(LF.AIProviders.llamacpp.optionalKey===true,'llama.cpp can use an optional server API key');
    assert(LF.AIProviders.gemini.model==='gemini-3.7-flash','Gemini preset tracks the current OpenAI-compatible example model');
    assert(LF.AIProviders.zai.requestDeadlineMs===180000,'Z.AI has a defensive provider-level request deadline');
    assert(LF.AIProviders.zai.connectionTestMaxTokens===128,'Z.AI connection probe has enough output room for reasoning-capable GLM models');
  };

  t['Z.AI is one provider with the official General API, default Flash model and Detect catalogue']=function(){
    const provider=LF.AIProviders.zai;
    assert(provider.name==='Z.AI','provider display name');
    assert(provider.endpoint==='https://api.z.ai/api/paas/v4/chat/completions','official General API endpoint');
    assert(provider.model==='glm-4.7-flash','default remains free Flash');
    assert(provider.modelSelect===true,'Detect-backed model select');
    assert(provider.staticModelCatalogue===true,'documented static catalogue declared');
    assert(provider.knownModels.includes('glm-4.7-flash'),'default model present in Detect catalogue');
    assert(provider.supportsStreaming===false,'Z.AI uses the conservative direct non-streaming browser path');
    assert(!Object.prototype.hasOwnProperty.call(provider,'browserRelayPath'),'Z.AI has no LabFlow-specific relay');
    assert(provider.remoteModelMetadata===false,'no undocumented remote model-list endpoint is probed');
    assert(!Object.prototype.hasOwnProperty.call(provider,'endpointPresets'),'retired Coding Plan endpoint switch absent');
  };

  t['Z.AI settings use the same Detect control and result semantics as other providers']=function(){
    localStorage.setItem('labflow.ai.settings',JSON.stringify({provider:'zai',endpoint:LF.AIProviders.zai.endpoint,model:'glm-4.7-flash'}));localStorage.removeItem('labflow.ai.keys');localStorage.removeItem('labflow.ai.key');LF.State={state:{ui:{settingsSection:'provider'},experiment:{meta:{sourceName:''}}}};const html=LF.SettingsPage.render();assert(html.indexOf('id="aiModel"')>=0,'Z.AI model input rendered');assert(html.indexOf('id="aiModelSelect"')>=0&&html.indexOf('aria-label="Z.AI model"')>=0,'Z.AI Detect model select rendered');assert(html.indexOf('id="detectProviderModel" >Detect</button>')>=0,'Z.AI uses the shared Detect control');assert(html.indexOf('built-in capability metadata')>=0,'Detect capability guidance');assert(html.indexOf('GLM Coding Plan')<0,'retired access mode absent');assert(html.indexOf('Detect uses provider metadata when available.')>=0,'shared Detect pipeline explained');localStorage.removeItem('labflow.ai.settings');
  };

  t['NVIDIA settings expose key-gated model loading and a real select']=function(){
    localStorage.setItem('labflow.ai.settings',JSON.stringify({provider:'nvidia',endpoint:LF.AIProviders.nvidia.endpoint,model:LF.AIProviders.nvidia.model}));localStorage.removeItem('labflow.ai.keys');localStorage.removeItem('labflow.ai.key');LF.State={state:{ui:{settingsSection:'provider'},experiment:{meta:{sourceName:''}}}};const html=LF.SettingsPage.render();assert(html.indexOf('id="aiModelSelect"')>=0,'NVIDIA select rendered');assert(html.indexOf('aria-label="NVIDIA NIM model"')>=0,'select labelled');assert(html.indexOf('id="detectProviderModel" disabled>Detect</button>')>=0,'NVIDIA uses the shared Detect control');assert(html.indexOf('Enter the NVIDIA NIM API key to enable Detect.')>=0,'key-first guidance');localStorage.removeItem('labflow.ai.settings');
  };


  t['NOMAD settings are explicit local-only preparation for the upload stub']=function(){
    localStorage.removeItem('labflow.nomad.settings');localStorage.removeItem('labflow.nomad.token');
    LF.State={state:{ui:{settingsSection:'nomad'},experiment:{meta:{sourceName:''}}}};
    const html=LF.SettingsPage.render();
    assert(html.indexOf('<strong>NOMAD</strong>')>=0,'NOMAD Settings navigation item missing');
    assert(html.indexOf('Upload not implemented')>=0,'stub status missing');
    assert(html.indexOf('Saving these values performs no network request')>=0,'local-only warning missing');
    LF.Storage.saveNomadSettings({instance:'Test NOMAD',apiEndpoint:'https://nomad.example/api/v1',username:'researcher'});
    LF.Storage.saveNomadToken('secret-token');
    assert(LF.Storage.getNomadSettings().instance==='Test NOMAD','NOMAD instance persisted');
    assert(LF.Storage.getNomadToken()==='secret-token','NOMAD token persisted separately');
    assert(JSON.stringify(LF.Storage.getExportSettings()).indexOf('secret-token')<0,'token must not leak into export settings');
    localStorage.removeItem('labflow.nomad.settings');localStorage.removeItem('labflow.nomad.token');
  };

  t['Action runtime override changes effective definition and prompt and resets cleanly']=function(){
    const id='results.interpret',base=LF.ActionRegistry.action(id),sourcePrompt=LF.ActionRegistry.prompt(id);
    LF.Storage.saveActionOverride(id,{definition:Object.assign({},base,{title:'Runtime title'}),prompt:'Runtime prompt'});
    assert(LF.Storage.getEffectiveAction(id).title==='Runtime title','definition override not effective');
    assert(LF.Storage.getEffectivePrompt(id)==='Runtime prompt','prompt override not effective');
    LF.Storage.resetActionOverride(id);
    assert(LF.Storage.getEffectiveAction(id).title===base.title,'definition reset failed');
    assert(LF.Storage.getEffectivePrompt(id)===sourcePrompt,'prompt reset failed');
  };
  function actionSettingsState(actionId){
    LF.State={state:{ui:{settingsSection:'actions',settingsActionId:actionId},experiment:{meta:{sourceName:'fixture.zip'}}}};
  }

  t['Settings exposes one Actions manager and no split AI helper surface']=function(){
    actionSettingsState('results.compare');
    const html=LF.SettingsPage.render();
    assert(html.indexOf('>Actions<')>=0,'Actions tab missing');
    assert(html.indexOf('AI Helpers')<0,'AI Helpers surface must not exist');
    assert(html.indexOf('Operations Workshop')<0,'Operations Workshop surface must not exist');
    assert(html.indexOf('Compare selected result groups')>=0||html.indexOf('Compare with AI')>=0,'Results compare Action missing from manager');
  };
  t['Actions manager exposes AI step thinking policy']=function(){
    actionSettingsState('design.infer');const design=LF.SettingsPage.render();assert(design.indexOf('thinking off')>=0,'Design inference thinking policy visible');
  };

  t['Local model controls display only the model basename while retaining the exact ID']=function(){
    const full='/home/user/models/NVIDIA-Nemotron-3-Nano-4B-Q4_K_M.gguf';
    localStorage.setItem('labflow.ai.settings',JSON.stringify({provider:'llamacpp',endpoint:'http://127.0.0.1:8080/v1',model:full}));
    LF.State={state:{ui:{settingsSection:'provider'},experiment:{meta:{sourceName:''}}}};
    const html=LF.SettingsPage.render();
    assert(html.indexOf('>NVIDIA-Nemotron-3-Nano-4B-Q4_K_M.gguf</option>')>=0,'local select shows basename');
    assert(html.indexOf('>/home/user/models/NVIDIA-Nemotron-3-Nano-4B-Q4_K_M.gguf</option>')<0,'local select must not show path');
    localStorage.removeItem('labflow.ai.settings');
  };

  t['Unsigned Action overrides cannot shadow the current source contract']=function(){
    const id='results.interpret',base=LF.ActionRegistry.action(id),sourcePrompt=LF.ActionRegistry.prompt(id);
    localStorage.setItem('labflow.action.overrides',JSON.stringify({[id]:{definition:Object.assign({},base,{title:'STALE TITLE'}),prompt:'STALE PROMPT',updatedAt:'2026-01-01T00:00:00Z'}}));
    assert(LF.Storage.getActionOverride(id)===null,'unsigned override should not shadow current source Action');
    assert(LF.Storage.getEffectiveAction(id).title===base.title,'current source definition must win over stale override');
    assert(LF.Storage.getEffectivePrompt(id)===sourcePrompt,'current source prompt must win over stale override');
    localStorage.removeItem('labflow.action.overrides');
  };

};
