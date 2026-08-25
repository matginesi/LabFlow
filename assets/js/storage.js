(function(){
  'use strict';
  const LF=window.LabFlow=window.LabFlow||{};
  const Log=LF.Logger.scope('storage');
  const DB_NAME='labflow.workspace', DB_VERSION=2, EXP_STORE='workspace', HANDLE_STORE='handles', KNOWLEDGE_HANDLE_KEY='design-knowledge-base-directory';
  const API_KEY_STORE='labflow.ai.keys', LEGACY_API_KEY_STORE='labflow.ai.key';
  function read(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(err){Log.warn('local.read-failed',{key:key,error:err});return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(err){Log.warn('local.write-failed',{key:key,error:err});return false;}}
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function getAiSettings(){
    const defaults={provider:'zai',endpoint:'https://api.z.ai/api/paas/v4/chat/completions',model:'glm-4.7-flash',temperature:0.7,thinkingMode:'auto',streaming:true,inactivityTimeoutMs:90000,maxOutputTokensCap:0};
    const out=Object.assign({},defaults,read('labflow.ai.settings',{}));out.endpoint=String(out.endpoint||'').replace(/\/chat\/completions(?:\/chat\/completions)+\/?$/i,'/chat/completions');if(out.provider==='zai'&&/api\.z\.ai\/api\/paas\/v4\/?$/i.test(out.endpoint))out.endpoint=out.endpoint.replace(/\/?$/,'/chat/completions');out.thinkingMode=['auto','off','on'].includes(out.thinkingMode)?out.thinkingMode:'auto';delete out.thinking;out.streaming=out.streaming!==false;out.inactivityTimeoutMs=Math.max(15000,Math.min(600000,Number(out.inactivityTimeoutMs)||90000));out.maxOutputTokensCap=Math.max(0,Math.min(1048576,Number(out.maxOutputTokensCap)||0));return out;
  }
  function saveAiSettings(v){write('labflow.ai.settings',v);Log.info('ai-settings.saved',{provider:v&&v.provider,model:v&&v.model});}
  function getAssistantSettings(){const d={memoryEnabled:true,memoryTurns:6,memoryChars:6000,messageChars:1800,contextChars:12000,maxOutputTokens:0,temperature:0.4},raw=read('labflow.assistant.settings',{}),o=Object.assign({},d,raw);o.memoryEnabled=o.memoryEnabled!==false;o.memoryTurns=Math.max(0,Math.min(20,Number(o.memoryTurns)||0));o.memoryChars=Math.max(500,Math.min(32000,Number(o.memoryChars)||d.memoryChars));o.messageChars=Math.max(250,Math.min(8000,Number(o.messageChars)||d.messageChars));o.contextChars=Math.max(2000,Math.min(48000,Number(o.contextChars)||d.contextChars));o.maxOutputTokens=Math.max(0,Math.min(1048576,Number(o.maxOutputTokens)||0));o.temperature=Math.max(0,Math.min(2,Number(o.temperature)));if(!Number.isFinite(o.temperature))o.temperature=d.temperature;return o;}
  function saveAssistantSettings(v){const next=Object.assign({},getAssistantSettings(),v||{});write('labflow.assistant.settings',next);return getAssistantSettings();}
  function apiKeys(){
    let keys=read(API_KEY_STORE,{});if(!keys||typeof keys!=='object'||Array.isArray(keys))keys={};
    try{const legacy=localStorage.getItem(LEGACY_API_KEY_STORE)||'';if(!legacy)return keys;const saved=read('labflow.ai.settings',{}),provider=String(saved.provider||'zai');if(!keys[provider])keys[provider]=legacy;const stored=write(API_KEY_STORE,keys);if(stored){localStorage.removeItem(LEGACY_API_KEY_STORE);Log.info('api-key.migrated',{provider:provider});}return keys;}catch(_){return keys;}
  }
  function getApiKey(providerId){try{const provider=String(providerId||getAiSettings().provider||'zai');return String(apiKeys()[provider]||'');}catch(_){return'';}}
  function saveApiKey(key,providerId){try{const provider=String(providerId||getAiSettings().provider||'zai'),keys=apiKeys();if(key)keys[provider]=String(key);else delete keys[provider];const stored=write(API_KEY_STORE,keys);if(!stored)Log.warn('api-key.save-failed',{provider:provider});return stored;}catch(err){Log.warn('api-key.save-failed',{error:err});return false;}}

  /* Action overrides are the one browser-local runtime configuration layer.
     Versioned action.json / prompt.md files remain the resettable source defaults. */
  function actionOverrides(){
    const current=read('labflow.action.overrides',null);
    if(current&&typeof current==='object')return current;
    const legacy=read('labflow.operation.overrides',{});
    if(legacy&&Object.keys(legacy).length)write('labflow.action.overrides',legacy);
    return legacy||{};
  }
  function getActionOverride(id){const all=actionOverrides();return all&&all[id]?clone(all[id]):null;}
  function saveActionOverride(id,override){const all=actionOverrides();all[id]=Object.assign({},all[id]||{},clone(override||{}),{updatedAt:new Date().toISOString()});write('labflow.action.overrides',all);Log.info('action.override-saved',{actionId:id,hasDefinition:!!(override&&override.definition),hasPrompt:override&&typeof override.prompt==='string'});return getActionOverride(id);}
  function resetActionOverride(id){const all=actionOverrides();delete all[id];write('labflow.action.overrides',all);Log.info('action.override-reset',{actionId:id});}
  function getEffectiveAction(id){const base=LF.ActionRegistry&&LF.ActionRegistry.action?LF.ActionRegistry.action(id):null,ov=getActionOverride(id);if(!base)return null;if(!ov||!ov.definition)return base;const custom=clone(ov.definition),merged=Object.assign({},base,custom,{id:base.id});if(Array.isArray(custom.steps)){const baseById={};(base.steps||[]).forEach(function(step){if(step&&step.id)baseById[step.id]=step;});merged.steps=custom.steps.map(function(step){const source=step&&step.id&&baseById[step.id]||{};return Object.assign({},source,step||{});});}return merged;}
  function getEffectivePrompt(id){const ov=getActionOverride(id);if(ov&&typeof ov.prompt==='string')return ov.prompt;return LF.ActionRegistry&&LF.ActionRegistry.prompt?LF.ActionRegistry.prompt(id):'';}

  function getUserProfile(){return Object.assign({name:'Matteo Ginesi',organization:'',email:'',defaultAuthor:'Matteo Ginesi'},read('labflow.user.profile',{}));}
  function saveUserProfile(v){write('labflow.user.profile',Object.assign({},getUserProfile(),v||{}));}
  function getUiSettings(){return Object.assign({assistantOpen:true,theme:'instrument'},read('labflow.ui.settings',{}));}
  function saveUiSettings(v){write('labflow.ui.settings',Object.assign({},getUiSettings(),v||{}));}
  function getNomadSettings(){return Object.assign({instance:'NOMAD Central',endpoint:'https://nomad-lab.eu/prod/v1/api/v1',includeRaw:true,includeDerived:true,includeReport:true},read('labflow.nomad.settings',{}));}
  function saveNomadSettings(v){write('labflow.nomad.settings',v);}
  function getLegacyKnowledgeBase(){return clone(read('labflow.design.knowledge-base',{version:1,records:[],updatedAt:null}));}
  function clearLegacyKnowledgeBase(){try{localStorage.removeItem('labflow.design.knowledge-base');return true;}catch(err){Log.warn('knowledge-base.legacy-clear-failed',{error:err});return false;}}

  function db(){return new Promise(function(resolve,reject){if(!window.indexedDB){reject(new Error('IndexedDB is unavailable in this browser.'));return;}const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=function(){const d=req.result;if(!d.objectStoreNames.contains(EXP_STORE))d.createObjectStore(EXP_STORE);if(!d.objectStoreNames.contains(HANDLE_STORE))d.createObjectStore(HANDLE_STORE);};req.onsuccess=function(){resolve(req.result);};req.onerror=function(){reject(req.error||new Error('Could not open LabFlow workspace storage.'));};});}
  async function saveKnowledgeDirectoryHandle(handle){const d=await db();return new Promise(function(resolve,reject){const tx=d.transaction(HANDLE_STORE,'readwrite');tx.objectStore(HANDLE_STORE).put(handle,KNOWLEDGE_HANDLE_KEY);tx.oncomplete=function(){d.close();resolve(true);};tx.onerror=function(){const err=tx.error||new Error('Could not remember the Knowledge Base folder.');d.close();reject(err);};});}
  async function loadKnowledgeDirectoryHandle(){try{const d=await db();return await new Promise(function(resolve,reject){const tx=d.transaction(HANDLE_STORE,'readonly'),req=tx.objectStore(HANDLE_STORE).get(KNOWLEDGE_HANDLE_KEY);req.onsuccess=function(){const value=req.result||null;d.close();resolve(value);};req.onerror=function(){const err=req.error||new Error('Could not restore the Knowledge Base folder.');d.close();reject(err);};});}catch(err){Log.warn('knowledge-base.handle-load-failed',{error:err});return null;}}
  async function clearKnowledgeDirectoryHandle(){try{const d=await db();return await new Promise(function(resolve,reject){const tx=d.transaction(HANDLE_STORE,'readwrite');tx.objectStore(HANDLE_STORE).delete(KNOWLEDGE_HANDLE_KEY);tx.oncomplete=function(){d.close();resolve(true);};tx.onerror=function(){const err=tx.error||new Error('Could not forget the Knowledge Base folder.');d.close();reject(err);};});}catch(err){Log.warn('knowledge-base.handle-clear-failed',{error:err});return false;}}
  async function saveExperiment(exp,ui){const d=await db();return new Promise(function(resolve,reject){const tx=d.transaction(EXP_STORE,'readwrite'),store=tx.objectStore(EXP_STORE),payload={version:2,savedAt:new Date().toISOString(),experiment:exp,ui:{route:ui&&ui.route||'experiment-import',resultsTab:ui&&ui.resultsTab||'overview',selectedMeasurementId:ui&&ui.selectedMeasurementId||null,selectedDesignDeviceId:ui&&ui.selectedDesignDeviceId||null}};store.put(payload,'current');tx.oncomplete=function(){d.close();resolve(payload);};tx.onerror=function(){const err=tx.error||new Error('Could not save the LabFlow workspace.');d.close();reject(err);};});}
  async function loadExperiment(){try{const d=await db();return await new Promise(function(resolve,reject){const tx=d.transaction(EXP_STORE,'readonly'),req=tx.objectStore(EXP_STORE).get('current');req.onsuccess=function(){const v=req.result||null;d.close();resolve(v);};req.onerror=function(){const err=req.error||new Error('Could not read saved LabFlow workspace.');d.close();reject(err);};});}catch(err){Log.warn('workspace.load-failed',{error:err});return null;}}
  async function clearSavedExperiment(){try{const d=await db();return await new Promise(function(resolve,reject){const tx=d.transaction(EXP_STORE,'readwrite');tx.objectStore(EXP_STORE).delete('current');tx.oncomplete=function(){d.close();resolve(true);};tx.onerror=function(){const err=tx.error||new Error('Could not clear saved LabFlow workspace.');d.close();reject(err);};});}catch(err){Log.warn('workspace.clear-failed',{error:err});return false;}}

  LF.Storage={getAiSettings:getAiSettings,saveAiSettings:saveAiSettings,getAssistantSettings:getAssistantSettings,saveAssistantSettings:saveAssistantSettings,getApiKey:getApiKey,saveApiKey:saveApiKey,getActionOverride:getActionOverride,saveActionOverride:saveActionOverride,resetActionOverride:resetActionOverride,getEffectiveAction:getEffectiveAction,getEffectivePrompt:getEffectivePrompt,getUserProfile:getUserProfile,saveUserProfile:saveUserProfile,getUiSettings:getUiSettings,saveUiSettings:saveUiSettings,getNomadSettings:getNomadSettings,saveNomadSettings:saveNomadSettings,getLegacyKnowledgeBase:getLegacyKnowledgeBase,clearLegacyKnowledgeBase:clearLegacyKnowledgeBase,saveKnowledgeDirectoryHandle:saveKnowledgeDirectoryHandle,loadKnowledgeDirectoryHandle:loadKnowledgeDirectoryHandle,clearKnowledgeDirectoryHandle:clearKnowledgeDirectoryHandle,saveExperiment:saveExperiment,loadExperiment:loadExperiment,clearSavedExperiment:clearSavedExperiment};
}());
