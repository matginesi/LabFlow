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
    assert(ids.includes('assistant.chat'),'Assistant missing from registry');
    assert(ids.includes('dataset.analyze'),'deterministic Action missing');
    assert(ids.includes('report.generate'),'report Action missing');
    assert(ids.includes('analysis.summarize'),'internal deterministic summary missing from registry');
    assert(ids.includes('analysis.enrich'),'shared experiment brief enrichment missing from registry');
    assert(ids.includes('design.infer-batch'),'batch Design Action missing from registry');
    assert(ids.length===12,'expected all 12 Actions');
  };
  t['AI Actions declare bounded output targets and automatic enrichment is fail-fast']=function(){
    const defs=LF.ActionRegistry.actions().map(function(id){return LF.ActionRegistry.action(id);});
    defs.forEach(function(def){(def.steps||[]).filter(function(step){return step.type==='AI';}).forEach(function(step){assert(Number(step.max_output_tokens)>0,def.id+'/'+step.id+' missing output target');assert(['off','auto','on'].includes(step.thinking),def.id+'/'+step.id+' missing thinking policy');});});
    const enrich=LF.ActionRegistry.action('analysis.enrich').steps.find(function(step){return step.id==='enrich';});
    assert(enrich.max_output_tokens===700,'analysis.enrich output ceiling must stay micro');assert(enrich.target_output_tokens===320,'analysis.enrich semantic target must stay micro');assert(enrich.max_input_tokens===6000,'analysis.enrich input cap must fit the fixed prompt/policy envelope');
    assert(enrich.deadline_ms===45000,'analysis.enrich hard deadline must be 45s');
    assert(enrich.max_retries===0,'analysis.enrich must not retry semantically during import');
    const reportDraft=LF.ActionRegistry.action('report.generate').steps.find(function(step){return step.id==='draft';});
    assert(reportDraft.max_input_tokens===12000,'report.generate input cap');assert(reportDraft.target_output_tokens===3600,'report.generate target');assert(reportDraft.max_output_tokens===5000,'report.generate ceiling');assert(reportDraft.deadline_ms===240000,'report.generate inference deadline');assert(reportDraft.max_retries===0,'report.generate must not automatically rerun a failed long draft');
    const reportEdit=LF.ActionRegistry.action('report.improve').steps.find(function(step){return step.id==='edit';});
    assert(reportEdit.max_input_tokens===12000,'report.improve input cap');assert(reportEdit.target_output_tokens===3200,'report.improve target');assert(reportEdit.max_output_tokens===5000,'report.improve ceiling');assert(reportEdit.deadline_ms===240000,'report.improve inference deadline');assert(reportEdit.max_retries===0,'report.improve must not automatically rerun a failed long edit');
  };

  t['Assistant uses a lightweight bounded request by default']=function(){
    const step=LF.ActionRegistry.action('assistant.chat').steps[0];
    assert(step.thinking==='off','Assistant thinking must be off by default');
    assert(step.max_output_tokens===2048,'Assistant output ceiling must stay compact');
    assert(step.target_output_tokens===700,'Assistant target should suit normal chat');
    assert(step.deadline_ms===90000,'Assistant cannot remain provider-blocked indefinitely');
  };

  t['Design inference treats Knowledge Base hits as optional context without capping model confidence']=function(){
    const prompt=LF.ActionRegistry.prompt('design.infer');
    assert(prompt.includes('Use supplied scientific Knowledge Base records when relevant'),'Design prompt makes Knowledge Base context optional');
    assert(prompt.includes('A Knowledge Base miss is normal'),'empty retrieval must not block Design');
    assert(prompt.includes('A Knowledge Base miss is normal'),'KB absence must not block model inference');
    const step=LF.ActionRegistry.action('design.infer').steps.find(function(item){return item.id==='infer';});
    assert(step.thinking==='off','Design should not spend latency on hidden reasoning by default');
    assert(step.max_input_tokens===8000,'Design input budget should stay compact but fit the fixed structured prompt');
    assert(step.max_output_tokens===1400&&step.target_output_tokens===520,'Design output budget should stay compact');
    assert(step.deadline_ms===90000&&step.max_retries===1,'Design may use one declared semantic repair retry for invalid or truncated structured output');
  };

  t['AI settings migrate obsolete thinking flags to a validated provider-neutral policy']=function(){
    localStorage.setItem('labflow.ai.settings',JSON.stringify({provider:'lmstudio',endpoint:'http://127.0.0.1:1234/v1',model:'local',thinking:true,thinkingMode:'unsupported'}));
    const migrated=LF.Storage.getAiSettings();
    assert(migrated.thinkingMode==='auto','invalid thinking mode must fall back to auto');
    assert(!Object.prototype.hasOwnProperty.call(migrated,'thinking'),'obsolete boolean thinking flag must not escape storage');
    LF.Storage.saveAiSettings(Object.assign({},migrated,{thinkingMode:'off'}));
    assert(LF.Storage.getAiSettings().thinkingMode==='off','validated explicit mode must persist');
    localStorage.removeItem('labflow.ai.settings');
  };

  t['provider registry includes OpenRouter and NVIDIA NIM presets']=function(){
    assert(LF.AIProviders.openrouter.endpoint==='https://openrouter.ai/api/v1/chat/completions','OpenRouter endpoint');
    assert(LF.AIProviders.openrouter.keyRequired===true,'OpenRouter key required');
    assert(LF.AIProviders.nvidia.endpoint==='https://integrate.api.nvidia.com/v1/chat/completions','NVIDIA NIM endpoint');
    assert(LF.AIProviders.nvidia.modelsEndpoint==='https://integrate.api.nvidia.com/v1/models','NVIDIA models endpoint');
    assert(LF.AIProviders.nvidia.keyRequired===true,'NVIDIA key required');
    assert(LF.AIProviders.nvidia.modelSelect===true,'NVIDIA uses loaded model select');
    assert(LF.AIProviders.zai.modelSelect===false,'Z.AI uses the exact configured model instead of a remote catalogue');
    assert(LF.AIProviders.ollama.modelSelect===true,'Ollama Detect exposes discovered local models');
    assert(LF.AIProviders.lmstudio.modelSelect===true,'LM Studio Detect exposes discovered local models');
    assert(LF.AIProviders.llamacpp.modelSelect===true,'llama.cpp Detect exposes served local models');
    assert(LF.AIProviders.llamacpp.endpoint==='http://127.0.0.1:8080/v1','llama.cpp default endpoint');
    assert(LF.AIProviders.llamacpp.keyRequired===false,'llama.cpp never requires a cloud API key');
    assert(LF.AIProviders.llamacpp.safeThinkingOverrideWhenUnknown===true,'llama.cpp can apply server-level reasoning controls when model metadata is silent');
    assert(LF.AIProviders.llamacpp.connectionTestMaxTokens===64,'llama.cpp probe has a small but reasoning-safe budget');
    assert(LF.AIProviders.llamacpp.recommendedRuntime.parallelSlots===1,'llama.cpp LabFlow profile uses one server slot');
    assert(LF.AIProviders.llamacpp.recommendedRuntime.contextWindow===65536,'llama.cpp LabFlow profile uses a 65K runtime context');
    assert(LF.AIProviders.llamacpp.thinkingModes.off.reasoning_budget===0,'llama.cpp reasoning-off mode forces zero reasoning budget');
    assert(LF.AIProviders.zai.remoteModelMetadata===false,'Z.AI Detect uses built-in metadata without remote catalogue probing');
    assert(LF.AIProviders.ollama.local===true&&LF.AIProviders.lmstudio.local===true&&LF.AIProviders.llamacpp.local===true,'local provider behavior is declared in the registry');
    assert(!LF.AIProviderList.some(function(provider){return Object.prototype.hasOwnProperty.call(provider,'modelLoadLabel');}),'providers do not define separate detect labels');
    assert(LF.AIProviders.zai.supportsStreamUsage!==true,'Z.AI must not receive undocumented stream_options');
    assert(LF.AIProviders.zai.model==='glm-4.7-flash','Z.AI default model');
    assert(!Object.prototype.hasOwnProperty.call(LF.AIProviders.zai,'rateLimit'),'Z.AI has no legacy transport retry policy');
    assert(LF.AIProviders.lmstudio.optionalKey===true,'LM Studio can use its own optional API token');
    assert(LF.AIProviders.llamacpp.optionalKey===true,'llama.cpp can use an optional server API key');
    assert(LF.AIProviders.gemini.model==='gemini-3.7-flash','Gemini preset tracks the current OpenAI-compatible example model');
    assert(LF.AIProviders.zai.requestDeadlineMs===180000,'Z.AI has a defensive provider-level request deadline');
  };

  t['Z.AI uses the exact configured model and never offers catalogue substitutions']=function(){
    const provider=LF.AIProviders.zai;
    assert(provider.model==='glm-4.7-flash','default remains free Flash');
    assert(provider.modelSelect===false,'manual exact model input');
    assert(provider.remoteModelMetadata===false,'remote model metadata disabled declaratively');
    assert(!Object.prototype.hasOwnProperty.call(provider,'skipModelCatalogue'),'legacy skipModelCatalogue flag removed');
    assert(!Object.prototype.hasOwnProperty.call(provider,'preserveConfiguredModel'),'dead preserveConfiguredModel flag removed');
  };

  t['Z.AI settings use the same Detect control and result semantics as other providers']=function(){
    localStorage.setItem('labflow.ai.settings',JSON.stringify({provider:'zai',endpoint:LF.AIProviders.zai.endpoint,model:'glm-4.7-flash'}));localStorage.removeItem('labflow.ai.keys');localStorage.removeItem('labflow.ai.key');LF.State={state:{settingsSection:'provider',experiment:{meta:{sourceName:''}}}};const html=LF.SettingsPage.render();assert(html.indexOf('id="aiModel"')>=0,'Z.AI manual model input rendered');assert(html.indexOf('id="aiModelSelect"')>=0&&html.indexOf('id="aiModelSelect" aria-label="Z.AI model" hidden')>=0,'remote model select hidden');assert(html.indexOf('id="detectProviderModel" >Detect</button>')>=0,'Z.AI uses the shared Detect control');assert(html.indexOf('built-in capability metadata')>=0,'configured-model Detect guidance');assert(html.indexOf('Provider guardrails.</strong> Detect always uses one shared capability pipeline.')>=0,'shared Detect pipeline explained');localStorage.removeItem('labflow.ai.settings');
  };

  t['NVIDIA settings expose key-gated model loading and a real select']=function(){
    localStorage.setItem('labflow.ai.settings',JSON.stringify({provider:'nvidia',endpoint:LF.AIProviders.nvidia.endpoint,model:LF.AIProviders.nvidia.model}));localStorage.removeItem('labflow.ai.keys');localStorage.removeItem('labflow.ai.key');LF.State={state:{settingsSection:'provider',experiment:{meta:{sourceName:''}}}};const html=LF.SettingsPage.render();assert(html.indexOf('id="aiModelSelect"')>=0,'NVIDIA select rendered');assert(html.indexOf('aria-label="NVIDIA NIM model"')>=0,'select labelled');assert(html.indexOf('id="detectProviderModel" disabled>Detect</button>')>=0,'NVIDIA uses the shared Detect control');assert(html.indexOf('Enter the NVIDIA NIM API key to enable Detect.')>=0,'key-first guidance');localStorage.removeItem('labflow.ai.settings');
  };

  t['API keys are isolated by provider and the legacy key migrates once']=function(){
    localStorage.removeItem('labflow.ai.keys');localStorage.removeItem('labflow.ai.key');localStorage.removeItem('labflow.ai.settings');
    LF.Storage.saveAiSettings(Object.assign({},LF.Storage.getAiSettings(),{provider:'zai'}));
    localStorage.setItem('labflow.ai.key','legacy-zai');
    assert(LF.Storage.getApiKey('zai')==='legacy-zai','legacy key migrated to active provider');
    assert(LF.Storage.getApiKey('openrouter')==='','legacy key not leaked to another provider');
    LF.Storage.saveApiKey('openrouter-key','openrouter');
    assert(LF.Storage.getApiKey('zai')==='legacy-zai','Z.AI key retained');
    assert(LF.Storage.getApiKey('openrouter')==='openrouter-key','OpenRouter key stored separately');
    localStorage.removeItem('labflow.ai.keys');localStorage.removeItem('labflow.ai.settings');
  };

  t['legacy Z.AI key merges with existing provider keys instead of being stranded']=function(){
    localStorage.setItem('labflow.ai.settings',JSON.stringify({provider:'zai'}));
    localStorage.setItem('labflow.ai.keys',JSON.stringify({nvidia:'nvidia-key'}));
    localStorage.setItem('labflow.ai.key','legacy-zai');
    assert(LF.Storage.getApiKey('zai')==='legacy-zai','legacy Z.AI key merged');
    assert(LF.Storage.getApiKey('nvidia')==='nvidia-key','existing provider key retained');
    assert(localStorage.getItem('labflow.ai.key')===null,'legacy key removed after successful merge');
    assert(LF.Storage.saveApiKey('new-zai','zai')===true,'provider key save reports success');
    assert(LF.Storage.getApiKey('zai')==='new-zai','new Z.AI key retained');
    localStorage.removeItem('labflow.ai.keys');localStorage.removeItem('labflow.ai.settings');
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
  function actionSettingsState(kind,actionId){
    LF.State={state:{settingsSection:'actions',settingsActionDocKind:kind,settingsActionId:actionId,ui:{settingsActionId:actionId},experiment:{meta:{sourceName:'fixture.zip'}}}};
  }

  t['older browser Action overrides inherit new source safety fields']=function(){
    const id='analysis.enrich',base=LF.ActionRegistry.action(id),oldDef=JSON.parse(JSON.stringify(base));
    oldDef.steps=oldDef.steps.map(function(step){const copy=Object.assign({},step);delete copy.max_output_tokens;delete copy.deadline_ms;delete copy.max_retries;return copy;});
    LF.Storage.saveActionOverride(id,{definition:oldDef});
    const effective=LF.Storage.getEffectiveAction(id),step=effective.steps.find(function(x){return x.id==='enrich';});
    assert(step.max_output_tokens===700,'source output ceiling inherited');assert(step.target_output_tokens===320,'source output target inherited');assert(step.max_input_tokens===6000,'source input cap inherited');
    assert(step.deadline_ms===45000,'source deadline inherited');
    assert(step.max_retries===0,'source semantic retry policy inherited');
    LF.Storage.resetActionOverride(id);
  };

  t['Settings exposes one Actions manager and no split AI helper surface']=function(){
    actionSettingsState('lab','dataset.analyze');
    const html=LF.SettingsPage.render();
    assert(html.indexOf('>Actions<')>=0,'Actions tab missing');
    assert(html.indexOf('AI Helpers')<0,'legacy AI Helpers surface remains');
    assert(html.indexOf('Operations Workshop')<0,'legacy Operations Workshop surface remains');
    assert(html.indexOf('No prompt required.')>=0,'deterministic Action prompt state missing');
  };
  t['Actions manager exposes each AI step thinking policy']=function(){
    actionSettingsState('lab','report.generate');const report=LF.SettingsPage.render();assert(report.indexOf('thinking off')>=0,'report drafting thinking policy visible');
    actionSettingsState('lab','design.infer');const design=LF.SettingsPage.render();assert(design.indexOf('thinking off')>=0,'Design inference thinking policy visible');
  };

  t['Report Actions expose a document-kind select that drives data-action-kind']=function(){
    actionSettingsState('paper','report.generate');const paper=LF.SettingsPage.render();
    assert(paper.indexOf('id="actionReportDocKind"')>=0,'doc-kind select present for report.generate');
    assert(paper.indexOf('data-action="report.generate" data-action-kind="paper"')>=0,'Run carries paper kind');
    assert(paper.indexOf('<option value="paper" selected>')>=0,'paper option selected from state');
    actionSettingsState('lab','report.improve');const lab=LF.SettingsPage.render();
    assert(lab.indexOf('data-action="report.improve" data-action-kind="lab"')>=0,'Run carries lab kind');
    assert(lab.indexOf('<option value="lab" selected>')>=0,'lab option selected from state');
    actionSettingsState('lab','results.interpret');const other=LF.SettingsPage.render();
    assert(other.indexOf('actionReportDocKind')<0,'no doc-kind select for non-report Action');
    assert(other.indexOf('data-action="results.interpret"')>=0,'plain run preserved');
  };
};
